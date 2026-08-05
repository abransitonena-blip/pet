import type { MediaProvider, MediaUploadResult, MediaAsset, MediaUploadOptions, MediaVariant, MediaListOptions } from './MediaProvider'

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ''
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || ''
const API_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}`

export class CloudinaryProvider implements MediaProvider {
  private cloudName: string
  private uploadPreset: string

  constructor(config: { cloudName: string; uploadPreset: string }) {
    this.cloudName = config.cloudName
    this.uploadPreset = config.uploadPreset
  }

  async upload(file: File, path: string, options?: MediaUploadOptions): Promise<MediaUploadResult> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', this.uploadPreset)
    formData.append('folder', path)

    if (options?.maxWidth) formData.append('width', String(options.maxWidth))
    if (options?.maxHeight) formData.append('height', String(options.maxHeight))
    if (options?.quality) formData.append('quality', String(options.quality))

    const response = await fetch(`${API_URL}/image/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Cloudinary upload failed: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()

    const variants: MediaVariant[] = options?.variants?.map((v) => ({
      ...v,
      url: this.getVariantUrl(data.public_id, v),
    })) || []

    return {
      mediaId: data.public_id,
      url: data.secure_url,
      variants,
    }
  }

  async delete(mediaId: string): Promise<void> {
    const response = await fetch(`${API_URL}/image/destroy/${mediaId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invalidate: true }),
    })

    if (!response.ok) {
      throw new Error(`Cloudinary delete failed: ${response.statusText}`)
    }
  }

  async getUrl(mediaId: string, variant?: string): Promise<string> {
    if (variant) {
      return `${API_URL}/image/upload/w_${variant}/v1/${mediaId}`
    }
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/v1/${mediaId}`
  }

  async list(ownerId: string, options?: MediaListOptions): Promise<MediaAsset[]> {
    const response = await fetch(
      `${API_URL}/resources/image/upload?prefix=${ownerId}&max_results=${options?.limit || 50}`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`)}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Cloudinary list failed: ${response.statusText}`)
    }

    const data = await response.json()
    return (data.resources || []).map((r: any) => ({
      mediaId: r.public_id,
      provider: 'cloudinary',
      objectKey: r.public_id,
      ownerId,
      mimeType: r.format === 'jpg' ? 'image/jpeg' : `image/${r.format}`,
      width: r.width,
      height: r.height,
      visibility: 'public' as const,
      createdAt: new Date(r.created_at),
    }))
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