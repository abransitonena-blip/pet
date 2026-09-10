import { NextResponse } from 'next/server'
import { verifyTokenRole } from '@/lib/serverAuth'
import { getPrivilegedFirestore } from '@/lib/finance/serverFirestore'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { checkRateLimit } from '@/lib/rateLimit'
import { notifyUser } from '@/lib/push/pushServer'
import { walkStepCopy } from '@/lib/walkActivity'
import type { SessionStep } from '@/lib/useCanonicalWalkSessions'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
const RATE_LIMIT_MAX = 60
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
const ALREADY_EXISTS = 6
const PUSH_STEPS: readonly SessionStep[] = ['assigned', 'confirmed', 'on_the_way', 'arrived', 'in_progress', 'completed']

/**
 * Avisa a la familia -- y, al asignar, al paseador -- que un paseo avanzó.
 *
 * The browser that just moved the session calls this, but it does not get to
 * say what happened: the server reads the session and announces its current
 * status. So a caller can at most trigger the truthful announcement of a step
 * that really took place, and only the assigned walker or staff can trigger
 * it at all. Each (session, step) is announced once: its marker in
 * `pushEvents` is written with create(), which fails if it already exists,
 * so a retry or a second open tab never pushes twice.
 *
 * Fails closed behind FCM_ENABLED.
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

  const rateLimit = checkRateLimit(`push-session:${caller.uid}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) {
    return NextResponse.json({ code: 'rate-limited' }, { status: 429, headers: { ...noStore, 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const firestore = getPrivilegedFirestore()
  if (!firestore) {
    return NextResponse.json({ code: 'privileged-identity-not-configured' }, { status: 503, headers: noStore })
  }

  let body: { sessionId?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ code: 'invalid-json' }, { status: 400, headers: noStore })
  }
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  if (!sessionId) return NextResponse.json({ code: 'invalid-session-id' }, { status: 400, headers: noStore })

  try {
    const snapshot = await firestore.collection('walkSessions').doc(sessionId).get()
    if (!snapshot.exists) return NextResponse.json({ code: 'not-found' }, { status: 404, headers: noStore })
    const session = snapshot.data() ?? {}

    const isStaff = caller.role === 'admin' || caller.role === 'supervisor'
    const isAssignedWalker = caller.role === 'walker' && session.walkerId === caller.uid
    if (!isStaff && !isAssignedWalker) {
      return NextResponse.json({ code: 'forbidden' }, { status: 403, headers: noStore })
    }

    const step = PUSH_STEPS.find((candidate) => candidate === session.status)
    if (!step) return NextResponse.json({ code: 'nothing-to-announce' }, { headers: noStore })

    try {
      await firestore.collection('pushEvents').doc(`${sessionId}_${step}`).create({
        sessionId,
        step,
        triggeredBy: caller.uid,
        createdAt: new Date().toISOString(),
      })
    } catch (error) {
      if ((error as { code?: unknown }).code === ALREADY_EXISTS) {
        return NextResponse.json({ code: 'already-announced' }, { headers: noStore })
      }
      throw error
    }

    const dogId = Array.isArray(session.dogIds) && typeof session.dogIds[0] === 'string' ? session.dogIds[0] : ''
    const rawDogName = dogId ? (await firestore.collection('dogs').doc(dogId).get()).data()?.name : undefined
    const dogName = typeof rawDogName === 'string' && rawDogName.trim() ? rawDogName.trim() : 'tu mascota'
    const copy = walkStepCopy(step, dogName)

    const family = await notifyUser(firestore, String(session.customerId ?? ''), {
      title: copy.title,
      body: copy.message,
      url: step === 'completed' ? `/familia/reportes/${encodeURIComponent(sessionId)}` : '/familia/notificaciones',
      tag: `session-${sessionId}`,
    })

    let walkerSent = 0
    if (step === 'assigned' && typeof session.walkerId === 'string') {
      const walker = await notifyUser(firestore, session.walkerId, {
        title: 'Tienes un paseo asignado',
        body: [dogName, session.scheduledDate, session.scheduledStart].filter((part) => typeof part === 'string' && part).join(' · '),
        url: '/walker',
        tag: `assigned-${sessionId}`,
      })
      walkerSent = walker.sent
    }

    return NextResponse.json({ code: 'ok', sent: family.sent + walkerSent }, { headers: noStore })
  } catch (error) {
    console.error('push/session-event failed:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ code: 'announce-failed' }, { status: 500, headers: noStore })
  }
}
