import 'client-only'

import { FEATURE_FLAGS } from '@/lib/featureFlags'
import type { MediaProvider, MediaUploadResult, MediaAsset, MediaUploadOptions, MediaVariant, MediaListOptions } from './MediaProvider'

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ''
const API_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}`

export class CloudinaryProvider implements MediaProvider {
  private cloudName: string
  private uploadPreset: string

  constructor(config: { cloudName: string; uploadPreset: string }) {
    this.cloudName = config.cloudName
    this.uploadPreset = config.uploadPreset
  }

  async upload(file: File, path: string, options?: MediaUploadOptions): Promise<MediaUploadResult> {
    void file
    void path
    void options
    void this.uploadPreset
    if (!FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED) {
      throw new Error('PRIVATE_MEDIA_UPLOADS_UNAVAILABLE')
    }
    throw new Error('SIGNED_MEDIA_BACKEND_REQUIRED')
  }

  async delete(mediaId: string): Promise<void> {
    void mediaId
    throw new Error('TRUSTED_MEDIA_DELETE_BACKEND_REQUIRED')
  }

  async getUrl(mediaId: string, variant?: string): Promise<string> {
    if (variant) {
      return `${API_URL}/image/upload/w_${variant}/v1/${mediaId}`
    }
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/v1/${mediaId}`
  }

  async list(ownerId: string, options?: MediaListOptions): Promise<MediaAsset[]> {
    void ownerId
    void options
    throw new Error('Cloudinary asset listing is only available from a trusted server module')
  }

  private getVariantUrl(publicId: string, variant: MediaVariant): string {
    const params = new URLSearchParams()
    params.set('w', String(variant.width))
    params.set('h', String(variant.height))
    params.set('q', String(variant.quality))
    params.set('f', variant.format)
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${params.toString()}/v1/${publicId}`
  }
}
