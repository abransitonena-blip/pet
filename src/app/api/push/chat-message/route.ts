import { NextResponse } from 'next/server'
import { verifyTokenRole } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { checkRateLimit } from '@/lib/rateLimit'
import { notifyUser } from '@/lib/push/pushServer'
import { ROLES } from '@/lib/roles'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 60
const RATE_LIMIT_WINDOW_MS = 10 * 60_000

/**
 * Avisa al otro lado de una conversación que hay un mensaje nuevo.
 *
 * Un chat que no suena no es un chat: había que acordarse de entrar a mirarlo.
 * Quien acaba de escribir llama aquí, pero no dice a quién avisar ni qué decir:
 * el servidor lee la conversación, comprueba que quien pide sea parte de ella
 * -- o administración -- y avisa al otro lado. El texto del mensaje no viaja en
 * el aviso: un aviso aparece en la pantalla bloqueada, y lo que una familia le
 * escribe a su paseador no tiene por qué leerse ahí.
 *
 * Falla cerrado si los avisos están apagados o no hay identidad de servidor.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) return NextResponse.json({ code: 'auth-required' }, { status: 401, headers: noStore })
  const caller = await verifyTokenRole(idToken)
  if (!caller) return NextResponse.json({ code: 'invalid-token' }, { status: 401, headers: noStore })

  if (!FEATURE_FLAGS.FCM_ENABLED) {
    return NextResponse.json({ code: 'push-not-enabled' }, { status: 503, headers: noStore })
  }

  const rateLimit = checkRateLimit(`push-chat:${caller.uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
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
  if (!conversationId || conversationId.includes('/')) {
    return NextResponse.json({ code: 'invalid-conversation-id' }, { status: 400, headers: noStore })
  }

  try {
    const snapshot = await firestore.collection('conversations').doc(conversationId).get()
    const conversation = snapshot.exists ? snapshot.data() ?? {} : null
    if (!conversation) return NextResponse.json({ code: 'conversation-not-found' }, { status: 404, headers: noStore })

    const participants: string[] = Array.isArray(conversation.participants)
      ? conversation.participants.filter((uid: unknown): uid is string => typeof uid === 'string')
      : []
    const isStaff = caller.role === ROLES.ADMIN || caller.role === ROLES.SUPERVISOR
    if (!isStaff && !participants.includes(caller.uid)) {
      return NextResponse.json({ code: 'not-your-conversation' }, { status: 403, headers: noStore })
    }

    // A quién: a los participantes que no acaban de escribir. Administración no
    // recibe avisos al teléfono -- mira el panel -- así que no se le busca.
    const targets = participants.filter((uid) => uid !== caller.uid)
    const results = await Promise.all(targets.map(async (uid) => {
      // Cada quien a su pantalla. Tener perfil de paseador es lo que distingue
      // a un paseador de una familia, y es un dato que ya vive aquí.
      const isWalker = (await firestore.collection('walkerProfiles').doc(uid).get()).exists
      return notifyUser(firestore, uid, {
        title: 'Mensaje nuevo en PET Ap',
        body: 'Tienes un mensaje. Ábrelo en la app para leerlo.',
        url: isWalker ? '/walker/chat' : '/familia/mensajes',
        tag: `chat-${conversationId}`,
      })
    }))

    return NextResponse.json({
      code: 'ok',
      notified: results.filter((result) => result.sent > 0).length,
    }, { headers: noStore })
  } catch (error) {
    console.error('push/chat-message failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'chat-push-failed' }, { status: 500, headers: noStore })
  }
}
