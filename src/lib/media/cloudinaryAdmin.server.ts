import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import type { MediaAsset, MediaListOptions } from './MediaProvider'

function getCloudinaryAdminConfig() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary server credentials are not configured')
  }

  return { cloudName, apiKey, apiSecret }
}

export interface CloudinaryConfigReport {
  readonly cloudNameConfigured: boolean
  readonly apiKeyConfigured: boolean
  readonly apiSecretConfigured: boolean
  /** Public value: it already ships to the browser as NEXT_PUBLIC_. */
  readonly cloudName: string
}

/**
 * Which Cloudinary variables exist in this deployment -- never their values.
 *
 * Uploads fail with Cloudinary's "Upload preset must be specified" whenever it
 * cannot match the api_key to the cloud in the URL, which looks identical to a
 * missing key from the browser's side. Reporting presence per variable, plus
 * the cloud name, separates "not configured here" from "key does not belong to
 * this cloud" without ever exposing a secret.
 */
export function describeCloudinaryConfig(): CloudinaryConfigReport {
  return {
    cloudNameConfigured: Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME),
    apiKeyConfigured: Boolean(process.env.CLOUDINARY_API_KEY),
    apiSecretConfigured: Boolean(process.env.CLOUDINARY_API_SECRET),
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
  }
}

export interface CloudinarySignedUpload {
  cloudName: string
  apiKey: string
  timestamp: number
  signature: string
  publicId: string
  transformation: 'fl_strip_profile'
  overwrite: false
}

export function createCloudinaryGallerySignature(now = Date.now()): CloudinarySignedUpload {
  const { cloudName, apiKey, apiSecret } = getCloudinaryAdminConfig()
  const timestamp = Math.floor(now / 1000)
  const publicId = `pet-ap-public/${randomUUID()}`
  const transformation = 'fl_strip_profile' as const
  const overwrite = false as const
  const canonical = `overwrite=false&public_id=${publicId}&timestamp=${timestamp}&transformation=${transformation}${apiSecret}`
  const signature = createHash('sha1').update(canonical).digest('hex')
  return { cloudName, apiKey, timestamp, signature, publicId, transformation, overwrite }
}

export function isAllowedCloudinaryGalleryResult(value: unknown): value is {
  public_id: string
  secure_url: string
  width: number
  height: number
  format: 'jpg' | 'jpeg' | 'png' | 'webp'
} {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.public_id === 'string'
    && /^pet-ap-public\/[a-f0-9-]{36}$/.test(data.public_id)
    && typeof data.secure_url === 'string'
    && /^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\//.test(data.secure_url)
    && Number.isSafeInteger(data.width) && Number(data.width) > 0 && Number(data.width) <= 12000
    && Number.isSafeInteger(data.height) && Number(data.height) > 0 && Number(data.height) <= 12000
    && ['jpg', 'jpeg', 'png', 'webp'].includes(String(data.format))
}

export async function listCloudinaryAssets(
  ownerId: string,
  options?: MediaListOptions
): Promise<MediaAsset[]> {
  const { cloudName, apiKey, apiSecret } = getCloudinaryAdminConfig()
  const params = new URLSearchParams({
    prefix: ownerId,
    max_results: String(options?.limit ?? 50),
  })
  const authorization = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?${params}`,
    { headers: { Authorization: `Basic ${authorization}` } }
  )

  if (!response.ok) {
    throw new Error(`Cloudinary list failed with status ${response.status}`)
  }

  const data = await response.json() as {
    resources?: Array<{
      public_id?: string
      format?: string
      width?: number
      height?: number
      created_at?: string
    }>
  }

  return (data.resources ?? []).flatMap((resource) => {
    if (!resource.public_id || !resource.format) return []
    return [{
      mediaId: resource.public_id,
      provider: 'cloudinary' as const,
      objectKey: resource.public_id,
      ownerId,
      mimeType: resource.format === 'jpg' ? 'image/jpeg' : `image/${resource.format}`,
      width: resource.width ?? 0,
      height: resource.height ?? 0,
      visibility: 'public' as const,
      createdAt: new Date(resource.created_at ?? 0),
    }]
  })
}
