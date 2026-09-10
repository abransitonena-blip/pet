import { NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { checkRateLimit } from '@/lib/rateLimit'
import { notifyUser } from '@/lib/push/pushServer'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 120
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

/**
 * Avisa a la persona que administración respondió en su conversación.
 *
 * The body is generic on purpose: a push lands on the lock screen, where
 * anyone near the phone can read it, and a chat reply can carry an address
 * or a door code. The person reads the actual message inside the app.
 * Admin-only; fails closed behind FCM_ENABLED.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const adminUid = await verifyAdminToken(idToken)
  if (!adminUid) return NextResponse.json({ code: 'admin-required' }, { status: 403, headers: noStore })

  if (!FEATURE_FLAGS.FCM_ENABLED) {
    return NextResponse.json({ code: 'push-not-enabled' }, { status: 503, headers: noStore })
  }

  const rateLimit = checkRateLimit(`push-chat:${adminUid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { conversationId?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : ''
  if (!conversationId) return NextResponse.json({ code: 'invalid-conversation-id' }, { status: 400, headers: noStore })

  try {
    const snapshot = await firestore.collection('conversations').doc(conversationId).get()
    if (!snapshot.exists) return NextResponse.json({ code: 'not-found' }, { status: 404, headers: noStore })
    const conversation = snapshot.data() ?? {}
    const participant = Array.isArray(conversation.participants) && typeof conversation.participants[0] === 'string'
      ? conversation.participants[0]
      : String(conversation.customerId ?? '')
    if (!participant) return NextResponse.json({ code: 'not-found' }, { status: 404, headers: noStore })

    const result = await notifyUser(firestore, participant, {
      title: 'Respuesta de PET Ap',
      body: 'Tienes un mensaje nuevo en tu conversación.',
      url: conversation.participantRole === 'walker' ? '/walker/chat' : '/familia/mensajes',
      tag: 'chat',
    })
    return NextResponse.json({ code: 'ok', sent: result.sent }, { headers: noStore })
  } catch (error) {
    console.error('push/chat-reply failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'announce-failed' }, { status: 500, headers: noStore })
  }
}
