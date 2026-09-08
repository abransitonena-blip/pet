import { NextResponse } from 'next/server'
import { listCloudinaryAssets } from '@/lib/media/cloudinaryAdmin.server'
import { verifyAdminToken } from '@/lib/serverAuth'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }

/**
 * Read-only credential check: confirms CLOUDINARY_API_KEY/SECRET are a valid
 * pair via Basic Auth against Cloudinary's resources endpoint, independent of
 * this app's own signed-upload signature logic. Narrows a broken upload down
 * to "bad credentials" vs. "signature computation bug" without guessing.
 */
export async function GET(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const adminUid = await verifyAdminToken(token)
  if (!adminUid) return NextResponse.json({ code: 'admin-required' }, { status: 403, headers: noStore })

  try {
    const assets = await listCloudinaryAssets('pet-ap-public', { limit: 1 })
    return NextResponse.json({ ok: true, resourceCount: assets.length }, { headers: noStore })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-error'
    return NextResponse.json({ ok: false, code: 'cloudinary-auth-failed', message }, { status: 502, headers: noStore })
  }
}
