# Image Variants Backfill

This is a local operator script for old `moments` rows that were created before `image_variants`.

New uploads already create:

- `thumb`
- `feed`
- `full`
- `original`

The backfill script downloads the existing `photo_url`, creates JPEG variants with `sharp`, uploads them to Supabase Storage, and updates `moments.image_variants`.

## Safety

The script is a dry run by default. It does not upload or update rows unless `--apply` is passed.

Run small batches first because this touches Storage and can increase egress while processing.

## Required Environment

Use the Supabase project URL and service role key:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

Do not put the service role key in client `.env` files or Vercel frontend variables.

Optional:

```bash
export BACKFILL_LIMIT=5
export MOMENTS_BUCKET=moments
```

## Dry Run

```bash
npm run backfill:image-variants
```

This lists the first moments that need backfill.

## Apply

```bash
BACKFILL_LIMIT=3 npm run backfill:image-variants -- --apply --confirm-small-batch
```

The script refuses to apply without `--confirm-small-batch`. It also refuses batches larger than 25 unless `BACKFILL_ALLOW_LARGE_BATCH=true` is set intentionally.

Increase `BACKFILL_LIMIT` only after confirming the first small batch works and Supabase egress looks normal.

## Verify

```sql
select
  count(*) filter (
    where image_variants is null
       or image_variants = '{}'::jsonb
       or not (image_variants ? 'thumb')
       or not (image_variants ? 'feed')
       or not (image_variants ? 'full')
  ) as missing_variants,
  count(*) as total_moments
from public.moments;
```

## Rollback

The script stores variants at:

```text
moments/{user_id}/{moment_id}/{variant}.jpg
```

If a batch is bad, clear `image_variants` for affected moments and delete those Storage paths manually.
