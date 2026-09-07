import { NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/serverAuth'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { sendPushNotification } from '@/lib/notifications/fcmAdmin.server'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }

/**
 * N1 push send, Admin-only. Title, body, and target device token always
 * come from the caller -- this endpoint invents no notification content.
 * Sends via the FCM HTTP v1 API using the T3 Workload Identity Federation
 * client (see fcmAdmin.server.ts), so it does not need Cloud Functions or
 * the Blaze plan. Fails closed behind FCM_ENABLED, which stays off until
 * the client-side registration flow (permission request, token storage)
 * is built and reviewed.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const adminUid = await verifyAdminToken(token)
  if (!adminUid) return NextResponse.json({ code: 'admin-required' }, { status: 403, headers: noStore })

  if (!FEATURE_FLAGS.FCM_ENABLED) {
    return NextResponse.json({ code: 'fcm-not-enabled' }, { status: 503, headers: noStore })
  }

  let body: { deviceToken?: unknown; title?: unknown; body?: unknown; url?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  if (typeof body.deviceToken !== 'string' || !body.deviceToken
    || typeof body.title !== 'string' || !body.title.trim()
    || typeof body.body !== 'string' || !body.body.trim()) {
    return NextResponse.json({ code: 'invalid-notification' }, { status: 400, headers: noStore })
  }

  const result = await sendPushNotification({
    deviceToken: body.deviceToken,
    title: body.title.trim(),
    body: body.body.trim(),
    url: typeof body.url === 'string' ? body.url : undefined,
  })

  if (!result.ok) {
    return NextResponse.json(
      { code: result.reason === 'not-configured' ? 'privileged-identity-not-configured' : 'send-failed' },
      { status: result.reason === 'not-configured' ? 503 : 502, headers: noStore },
    )
  }

  return NextResponse.json({ code: 'ok', messageName: result.messageName }, { headers: noStore })
}
