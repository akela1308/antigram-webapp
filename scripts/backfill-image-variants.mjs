#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const VARIANTS = {
  thumb: { maxSide: 480, quality: 78 },
  feed: { maxSide: 1080, quality: 82 },
  full: { maxSide: 1600, quality: 85 },
}

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const confirmedSmallBatch = args.has('--confirm-small-batch')
const allowLargeBatch = process.env.BACKFILL_ALLOW_LARGE_BATCH === 'true'
const limit = Number(process.env.BACKFILL_LIMIT ?? '5')
const bucket = process.env.MOMENTS_BUCKET ?? 'moments'
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!Number.isInteger(limit) || limit < 1) {
  console.error('BACKFILL_LIMIT must be a positive integer.')
  process.exit(1)
}

if (apply && !confirmedSmallBatch) {
  console.error('Refusing to apply without --confirm-small-batch.')
  console.error('Example:')
  console.error('  BACKFILL_LIMIT=3 npm run backfill:image-variants -- --apply --confirm-small-batch')
  process.exit(1)
}

if (apply && limit > 25 && !allowLargeBatch) {
  console.error('Refusing to apply more than 25 moments in one batch.')
  console.error('Use smaller batches, or set BACKFILL_ALLOW_LARGE_BATCH=true after testing carefully.')
  process.exit(1)
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Example:')
  console.error('  SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... BACKFILL_LIMIT=5 npm run backfill:image-variants')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function normalizeVariants(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value
}

function needsBackfill(value) {
  const variants = normalizeVariants(value)
  return !variants.thumb || !variants.feed || !variants.full
}

async function fetchSourceImage(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Could not download source image: ${res.status} ${res.statusText}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function makeVariant(source, config) {
  return sharp(source)
    .rotate()
    .resize({
      width: config.maxSide,
      height: config.maxSide,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: config.quality,
      mozjpeg: true,
    })
    .toBuffer()
}

async function uploadVariant(moment, name, data) {
  const path = `${moment.user_id}/${moment.id}/${name}.jpg`
  const { error } = await supabase.storage.from(bucket).upload(path, data, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (error) throw error

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path)
  return publicUrlData.publicUrl
}

async function getBackfillCandidates() {
  const { data, error } = await supabase
    .from('moments')
    .select('id, user_id, photo_url, image_variants, created_at')
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(limit * 4, 200)))

  if (error) throw error

  return (data ?? []).filter(moment => moment.photo_url && needsBackfill(moment.image_variants)).slice(0, limit)
}

async function backfillMoment(moment) {
  const existingVariants = normalizeVariants(moment.image_variants)
  const missingVariants = Object.keys(VARIANTS).filter(name => !existingVariants[name])

  console.log(`- ${moment.id} ${apply ? 'backfilling' : 'would backfill'} (${missingVariants.join(', ')})`)

  if (!apply) return { id: moment.id, dryRun: true }

  const source = await fetchSourceImage(moment.photo_url)
  const imageVariants = {
    ...existingVariants,
    original: existingVariants.original ?? moment.photo_url,
  }

  for (const [name, config] of Object.entries(VARIANTS).filter(([name]) => missingVariants.includes(name))) {
    const variant = await makeVariant(source, config)
    imageVariants[name] = await uploadVariant(moment, name, variant)
    console.log(`  uploaded ${name}`)
  }

  const { error } = await supabase
    .from('moments')
    .update({ image_variants: imageVariants })
    .eq('id', moment.id)

  if (error) throw error
  return { id: moment.id, dryRun: false }
}

async function main() {
  console.log(`Image variants backfill (${apply ? 'APPLY' : 'DRY RUN'})`)
  console.log(`Limit: ${limit}`)
  console.log(`Bucket: ${bucket}`)
  if (apply) console.log('Confirmed small batch: yes')

  const candidates = await getBackfillCandidates()
  if (candidates.length === 0) {
    console.log('No moments need backfill.')
    return
  }

  let ok = 0
  let failed = 0
  for (const moment of candidates) {
    try {
      await backfillMoment(moment)
      ok += 1
    } catch (error) {
      failed += 1
      console.error(`  failed ${moment.id}:`, error.message ?? error)
    }
  }

  console.log(`Done. Successful: ${ok}. Failed: ${failed}.`)
  if (!apply) {
    console.log('Dry run only. Re-run with -- --apply to upload variants and update rows.')
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
