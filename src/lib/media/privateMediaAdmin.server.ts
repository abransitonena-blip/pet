import 'server-only'

import { createHash, randomUUID } from 'node:crypto'

function getCloudinaryAdminConfig() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary server credentials are not configured')
  }

  return { cloudName, apiKey, apiSecret }
}

export interface CloudinarySignedPrivateUpload {
  cloudName: string
  apiKey: string
  timestamp: number
  signature: string
  publicId: string
  folder: string
  type: 'authenticated'
  transformation: 'fl_strip_profile'
  overwrite: false
}

/**
 * Signs an "authenticated" delivery-type Cloudinary upload for operational
 * (private) photos -- walk reports, PET Ahora, incidents. Unlike the public
 * gallery signature (createCloudinaryGallerySignature), `type=authenticated`
 * means the resulting asset is NOT viewable by its URL alone; every read
 * requires its own short-lived signed URL. The public_id is an opaque
 * random UUID under a fixed private prefix -- never the session/report id,
 * customer name, address, or any other identifying data (MEDIA_POLICY.md).
 */
export function createCloudinaryPrivateUploadSignature(folder: string, now = Date.now()): CloudinarySignedPrivateUpload {
  if (!/^pet-ap-private\/[a-z0-9-]{1,64}$/.test(folder)) {
    throw new Error('INVALID_PRIVATE_MEDIA_FOLDER')
  }
  const { cloudName, apiKey, apiSecret } = getCloudinaryAdminConfig()
  const timestamp = Math.floor(now / 1000)
  const publicId = randomUUID()
  const type = 'authenticated' as const
  const transformation = 'fl_strip_profile' as const
  const overwrite = false as const
  const canonical = `folder=${folder}&overwrite=false&public_id=${publicId}&timestamp=${timestamp}&transformation=${transformation}&type=${type}${apiSecret}`
  const signature = createHash('sha1').update(canonical).digest('hex')
  return { cloudName, apiKey, timestamp, signature, publicId, folder, type, transformation, overwrite }
}

export function isAllowedCloudinaryPrivateResult(value: unknown): value is {
  public_id: string
  secure_url: string
  width: number
  height: number
  format: 'jpg' | 'jpeg' | 'png' | 'webp'
  type: 'authenticated'
} {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.public_id === 'string'
    && /^pet-ap-private\/[a-z0-9-]{1,64}\/[a-f0-9-]{36}$/.test(data.public_id)
    && data.type === 'authenticated'
    && typeof data.secure_url === 'string'
    && /^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/authenticated\//.test(data.secure_url)
    && Number.isSafeInteger(data.width) && Number(data.width) > 0 && Number(data.width) <= 12000
    && Number.isSafeInteger(data.height) && Number(data.height) > 0 && Number(data.height) <= 12000
    && ['jpg', 'jpeg', 'png', 'webp'].includes(String(data.format))
}
