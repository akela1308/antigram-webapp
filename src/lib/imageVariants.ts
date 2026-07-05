import type { ImageVariantName, ImageVariants, Moment } from './types'

export const MOMENT_IMAGE_VARIANTS: Record<Exclude<ImageVariantName, 'original'>, { maxSide: number; quality: number }> = {
  thumb: { maxSide: 480, quality: 0.78 },
  feed: { maxSide: 1080, quality: 0.82 },
  full: { maxSide: 1600, quality: 0.85 },
}

export function getMomentImageUrl(
  moment: Pick<Moment, 'photo_url' | 'image_variants'>,
  variant: ImageVariantName,
): string {
  const variants = moment.image_variants ?? {}

  if (variant === 'thumb') {
    return variants.thumb ?? variants.feed ?? variants.full ?? variants.original ?? moment.photo_url
  }

  if (variant === 'feed') {
    return variants.feed ?? variants.full ?? variants.original ?? variants.thumb ?? moment.photo_url
  }

  if (variant === 'full') {
    return variants.full ?? variants.original ?? variants.feed ?? variants.thumb ?? moment.photo_url
  }

  return variants.original ?? variants.full ?? variants.feed ?? variants.thumb ?? moment.photo_url
}

export async function createResizedJpegBlob(source: Blob, maxSide: number, quality: number): Promise<Blob> {
  const image = await loadImage(source)
  const sourceMaxSide = Math.max(image.naturalWidth, image.naturalHeight)

  if (sourceMaxSide <= maxSide) return source

  const scale = maxSide / sourceMaxSide
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Could not export resized JPEG'))
    }, 'image/jpeg', quality)
  })
}

export function normalizeImageVariants(value: unknown): ImageVariants {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const variants: ImageVariants = {}
  for (const key of ['original', 'full', 'feed', 'thumb'] as ImageVariantName[]) {
    const maybeUrl = (value as Record<string, unknown>)[key]
    if (typeof maybeUrl === 'string' && maybeUrl.length > 0) {
      variants[key] = maybeUrl
    }
  }

  return variants
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load image for resizing'))
    }

    image.src = url
  })
}

