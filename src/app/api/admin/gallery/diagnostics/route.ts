import { NextResponse } from 'next/server'
import { describeCloudinaryConfig, listCloudinaryAssets } from '@/lib/media/cloudinaryAdmin.server'
import { verifyAdminToken } from '@/lib/serverAuth'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }

/**
 * Read-only credential check for the gallery upload.
 *
 * Cloudinary answers a signed upload it cannot authenticate with "Upload
 * preset must be specified" -- the same message you get for a genuinely
 * unsigned request -- so from the browser a wrong key, a key belonging to a
 * different cloud, and a missing key are indistinguishable. This reports which
 * variables exist in this deployment (never their values) and then tries a
 * Basic-Auth read against the same cloud, which fails with 401 exactly when
 * the key does not belong to it.
 */
export async function GET(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const adminUid = await verifyAdminToken(token)
  if (!adminUid) return NextResponse.json({ code: 'admin-required' }, { status: 403, headers: noStore })

  const config = describeCloudinaryConfig()
  if (!config.cloudNameConfigured || !config.apiKeyConfigured || !config.apiSecretConfigured) {
    return NextResponse.json({
      ok: false,
      code: 'cloudinary-not-configured',
      config,
      hint: 'Faltan variables de entorno en este entorno de Vercel. Revisa NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET, y vuelve a desplegar.',
    }, { status: 503, headers: noStore })
  }

  try {
    const assets = await listCloudinaryAssets('pet-ap-public', { limit: 1 })
    return NextResponse.json({ ok: true, config, resourceCount: assets.length }, { headers: noStore })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-error'
    const unauthorized = /\b401\b/.test(message)
    return NextResponse.json({
      ok: false,
      code: unauthorized ? 'cloudinary-credentials-rejected' : 'cloudinary-request-failed',
      config,
      message,
      hint: unauthorized
        ? `Cloudinary rechazó la llave para el cloud "${config.cloudName}". Normalmente significa que la llave pertenece a otra cuenta de Cloudinary o fue rotada.`
        : 'Cloudinary respondió con un error distinto a credenciales. Revisa el mensaje.',
    }, { status: 502, headers: noStore })
  }
}
