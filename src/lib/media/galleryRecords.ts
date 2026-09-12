import { GALLERY_FORMATS, type GalleryFormat } from '@/lib/media/galleryMedia'

export type GalleryPublicationStatus = 'draft' | 'published' | 'withdrawn'
export type { GalleryFormat }

export interface CompatibleGalleryRecord {
  id: string
  schemaVersion: 1
  publicationStatus: GalleryPublicationStatus
  consentRecorded: boolean
  consentVerified: boolean
  publicGalleryAllowed: boolean
  usageRights: 'pending' | 'public-gallery'
  assetPublicId: string
  url: string
  width: number
  height: number
  format: GalleryFormat
  altText: string
  assetDate: unknown
  revokedAt: unknown | null
  pendingDeletion: false
  createdBy: string
  createdAt: unknown
  updatedAt: unknown
}

export interface LegacyGalleryRecord {
  id: string
  title: string | null
  dog: string | null
  hasValidUrl: boolean
}

export type ParsedGalleryRecord =
  | { kind: 'compatible'; record: CompatibleGalleryRecord }
  | { kind: 'legacy'; record: LegacyGalleryRecord }
  | { kind: 'invalid'; id: string; reason: string }

const PUBLIC_ID = /^pet-ap-public\/[a-f0-9-]{36}$/
const CLOUDINARY_URL = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\/[^?#]+$/
const PUBLICATION_STATUSES = new Set<GalleryPublicationStatus>(['draft', 'published', 'withdrawn'])
const FORMATS = new Set<GalleryFormat>(GALLERY_FORMATS)
const USAGE_RIGHTS = new Set(['pending', 'public-gallery'])
const LEGACY_KEYS = new Set(['createdAt', 'dog', 'title', 'url'])
const G1_KEYS = new Set([
  'schemaVersion', 'publicationStatus', 'consentRecorded', 'consentVerified',
  'publicGalleryAllowed', 'usageRights', 'assetPublicId', 'url', 'width', 'height',
  'format', 'altText', 'assetDate', 'revokedAt', 'pendingDeletion', 'createdBy',
  'createdAt', 'updatedAt',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function safeLegacyText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 && normalized.length <= 120 ? normalized : null
}

function isSafeLegacyUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2_048) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
  } catch {
    return false
  }
}

function isCompatibleRecord(value: Record<string, unknown>): value is Omit<CompatibleGalleryRecord, 'id'> {
  return Object.keys(value).every((key) => G1_KEYS.has(key))
    && value.schemaVersion === 1
    && typeof value.publicationStatus === 'string'
    && PUBLICATION_STATUSES.has(value.publicationStatus as GalleryPublicationStatus)
    && typeof value.consentRecorded === 'boolean'
    && typeof value.consentVerified === 'boolean'
    && typeof value.publicGalleryAllowed === 'boolean'
    && typeof value.usageRights === 'string'
    && USAGE_RIGHTS.has(value.usageRights)
    && typeof value.assetPublicId === 'string'
    && PUBLIC_ID.test(value.assetPublicId)
    && typeof value.url === 'string'
    && CLOUDINARY_URL.test(value.url)
    && Number.isSafeInteger(value.width) && Number(value.width) > 0 && Number(value.width) <= 20_000
    && Number.isSafeInteger(value.height) && Number(value.height) > 0 && Number(value.height) <= 20_000
    && typeof value.format === 'string'
    && FORMATS.has(value.format as GalleryFormat)
    && typeof value.altText === 'string'
    && value.altText.trim().length > 0 && value.altText.trim().length <= 240
    && 'assetDate' in value
    && ('revokedAt' in value) && (value.revokedAt === null || typeof value.revokedAt === 'object')
    && value.pendingDeletion === false
    && typeof value.createdBy === 'string' && value.createdBy.length > 0 && value.createdBy.length <= 128
    && 'createdAt' in value
    && 'updatedAt' in value
    && (value.publicationStatus === 'published'
      ? value.consentRecorded === true
        && value.consentVerified === true
        && value.publicGalleryAllowed === true
        && value.usageRights === 'public-gallery'
      : value.publicGalleryAllowed === false)
}

function isObservedLegacyRecord(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value)
  return keys.length > 0
    && keys.every((key) => LEGACY_KEYS.has(key))
    && 'createdAt' in value
    && ('title' in value || 'dog' in value || 'url' in value)
}

export function parseGalleryRecord(id: string, value: unknown): ParsedGalleryRecord {
  if (!id || !isRecord(value)) return { kind: 'invalid', id, reason: 'El documento no tiene una estructura válida.' }

  if (isCompatibleRecord(value)) {
    return {
      kind: 'compatible',
      record: { id, ...value, altText: value.altText.trim() },
    }
  }

  if (isObservedLegacyRecord(value)) {
    return {
      kind: 'legacy',
      record: {
        id,
        title: safeLegacyText(value.title),
        dog: safeLegacyText(value.dog),
        hasValidUrl: isSafeLegacyUrl(value.url),
      },
    }
  }

  return {
    kind: 'invalid',
    id,
    reason: 'El registro no cumple el contrato G1 ni el formato legacy reconocido.',
  }
}

export function galleryFormatLabel(format: GalleryFormat): string {
  const labels: Record<GalleryFormat, string> = {
    jpg: 'JPG',
    jpeg: 'JPEG',
    png: 'PNG',
    webp: 'WEBP',
    gif: 'GIF animado',
    mp4: 'Video MP4',
    webm: 'Video WebM',
  }
  return labels[format]
}
