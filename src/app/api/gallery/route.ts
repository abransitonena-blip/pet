import { NextResponse } from 'next/server'
import { getServerFirestore } from '@/lib/serverAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' }
const PUBLIC_ID = /^pet-ap-public\/[a-f0-9-]{36}$/
const CLOUDINARY_URL = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\/[^?#]+$/
const FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp'])

function publicProjection(id: string, value: FirebaseFirestore.DocumentData) {
  if (value.publicationStatus !== 'published'
    || value.consentRecorded !== true
    || value.consentVerified !== true
    || value.publicGalleryAllowed !== true
    || value.usageRights !== 'public-gallery'
    || value.revokedAt !== null
    || value.pendingDeletion !== false
    || typeof value.assetPublicId !== 'string' || !PUBLIC_ID.test(value.assetPublicId)
    || typeof value.url !== 'string' || !CLOUDINARY_URL.test(value.url)
    || !Number.isSafeInteger(value.width) || value.width <= 0 || value.width > 20_000
    || !Number.isSafeInteger(value.height) || value.height <= 0 || value.height > 20_000
    || typeof value.format !== 'string' || !FORMATS.has(value.format)
    || typeof value.altText !== 'string' || value.altText.trim().length < 1 || value.altText.trim().length > 240) return null
  return {
    id,
    assetPublicId: value.assetPublicId,
    url: value.url,
    width: value.width,
    height: value.height,
    format: value.format,
    altText: value.altText.trim(),
  }
}

export async function GET() {
  try {
    const snapshot = await getServerFirestore().collection('gallery-images')
      .where('publicationStatus', '==', 'published')
      .limit(50)
      .get()
    const images = snapshot.docs.map((item) => publicProjection(item.id, item.data())).filter(Boolean)
    return NextResponse.json({ images }, { headers: noStore })
  } catch {
    return NextResponse.json({ code: 'gallery-unavailable', images: [] }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
