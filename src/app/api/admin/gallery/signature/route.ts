import { NextResponse } from 'next/server'
import { createCloudinaryGallerySignature } from '@/lib/media/cloudinaryAdmin.server'
import { verifyAdminToken } from '@/lib/serverAuth'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const adminUid = await verifyAdminToken(token)
  if (!adminUid) return NextResponse.json({ code: 'admin-required' }, { status: 403, headers: noStore })

  try {
    const signed = createCloudinaryGallerySignature()
    return NextResponse.json({
      cloudName: signed.cloudName,
      apiKey: signed.apiKey,
      timestamp: signed.timestamp,
      signature: signed.signature,
      publicId: signed.publicId,
      transformation: signed.transformation,
      overwrite: signed.overwrite,
      allowedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      maximumBytes: 10_000_000,
    }, { headers: noStore })
  } catch {
    return NextResponse.json({ code: 'signed-upload-not-configured' }, { status: 503, headers: noStore })
  }
}
