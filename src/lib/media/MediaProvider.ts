export interface MediaAsset {
  mediaId: string
  provider: 'cloudinary' | 'r2' | 'firebase-storage'
  objectKey: string
  publicId?: string
  ownerId: string
  reservationId?: string
  sessionId?: string
  mimeType: string
  width: number
  height: number
  variants?: MediaVariant[]
  visibility: 'public' | 'private' | 'signed'
  createdAt: Date
  deletedAt?: Date
}

export interface MediaVariant {
  name: string
  width: number
  height: number
  quality: number
  format: 'webp' | 'jpg' | 'png'
  url: string
}

export interface MediaUploadResult {
  mediaId: string
  url: string
  variants?: MediaVariant[]
}

export interface MediaProvider {
  upload(file: File, path: string, options?: MediaUploadOptions): Promise<MediaUploadResult>
  delete(mediaId: string): Promise<void>
  getUrl(mediaId: string, variant?: string): Promise<string>
  list(ownerId: string, options?: MediaListOptions): Promise<MediaAsset[]>
}

export interface MediaUploadOptions {
  visibility?: 'public' | 'private' | 'signed'
  variants?: MediaVariant[]
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

export interface MediaListOptions {
  limit?: number
  offset?: number
  orderBy?: 'createdAt' | 'deletedAt'
  orderDir?: 'asc' | 'desc'
  includeDeleted?: boolean
}

export type MediaProviderType = 'cloudinary' | 'r2' | 'firebase-storage'

export interface MediaConfig {
  provider: MediaProviderType
  cloudName?: string
  apiKey?: string
  apiSecret?: string
  bucket?: string
  region?: string
  signedUrlExpiry?: number
  maxFileSize?: number
  allowedTypes?: string[]
}