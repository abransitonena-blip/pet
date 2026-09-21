'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { onAuthStateChanged } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { MessagesSquare } from 'lucide-react'
import { auth } from '@/firebase/config'
import ConversationThread from '@/components/chat/ConversationThread'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import LoadingState from '@/components/ui/LoadingState'
import { getCustomerProfile } from '@/lib/customerProfile'
import { openWalkConversation } from '@/lib/chat'
import { canonicalReadErrorMessage, useCustomerWalkSessions } from '@/lib/useCanonicalWalkSessions'
import WalkerCard from '@/components/family/WalkerCard'
import LegacyAdminMessages from '@/components/chat/LegacyAdminMessages'
import { daysAgo } from '@/lib/recentWindow'
import { chatWindowNotice, chatWindowState, pickChatWalk } from '@/lib/chatWindow'

/**
 * Los mensajes de una familia van a quien lleva a su perro.
 *
 * Antes este hilo era con administración, que no está en la calle y tenía que
 * reenviar cada pregunta. Ahora la familia escribe al paseador de su paseo -- el
 * único que puede contestar cómo va, si ya salieron o qué pasó -- y el hilo dura
 * lo que el paseo, así que no se mezclan días distintos.
 *
 * Sin un paseo con paseador asignado no hay a quién escribir, y eso se dice en
 * vez de abrir un hilo que nadie va a leer.
 */

// Un paseo al que todavía le falta o le está pasando algo: es cuando tiene
// sentido escribirle a quien lo lleva.
const OPEN_STATUSES = new Set(['assigned', 'confirmed', 'on_the_way', 'arrived', 'in_progress'])

export default function FamilyMessagesPage() {
  const router = useRouter()
  const [identity, setIdentity] = useState<{ uid: string; name: string; role: 'customer'; phone: string } | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) { router.push('/login'); return }
      void (async () => {
        const profile = await getCustomerProfile(user.uid).catch(() => null)
        setIdentity({
          uid: user.uid,
          name: profile?.name || user.displayName || 'Familia PET',
          role: 'customer',
          phone: profile?.phone || '',
        })
      })()
    })
  }, [router])

  // Desde hace dos semanas en adelante: un paseo abierto nunca es más viejo, y
  // sin piso la consulta traía los 100 paseos más antiguos de la cuenta, donde
  // ya no hay ninguno abierto.
  const since = daysAgo(new Date().toLocaleDateString('en-CA'), 14)
  const { sessions, error, retry } = useCustomerWalkSessions(identity?.uid ?? '', { since })

  // La lista viene de la fecha más antigua a la más nueva: quedarse con el
  // primero enseñaba un paseo viejo sin cerrar en lugar del de hoy.
  const walk = useMemo(() => pickChatWalk(sessions, OPEN_STATUSES), [sessions])

  const open = useCallback(async () => {
    if (!identity || !walk?.walkerId) throw new Error('walk-conversation-incomplete')
    return openWalkConversation({
      sessionId: walk.id,
      customerId: identity.uid,
      customerName: identity.name,
      walkerId: walk.walkerId,
      walkerName: 'Paseador',
      scheduledDate: walk.scheduledDate,
      scheduledStart: walk.scheduledStart,
    })
  }, [identity, walk])

  // El hilo se abre dos horas antes del paseo y se cierra tres después.
  const windowState = walk ? chatWindowState(walk.scheduledDate, walk.scheduledStart) : 'unknown'

  if (!identity) return <LoadingState message="Abriendo tus mensajes…" rows={3} height="h-16" />
  if (error) return <Card className="p-5 shadow-none"><ErrorState description={canonicalReadErrorMessage(error)} onRetry={retry} /></Card>

  if (!walk) {
    return (
      <div className="space-y-3">
        <Card className="p-6 shadow-none">
          <EmptyState illustration="asomando"
            icon={<MessagesSquare size={24} />}
            title="Todavía no hay con quién escribir"
            description="Cuando tu paseo tenga un paseador asignado, podrás escribirle desde aquí y preguntarle cómo va."
            action={<Link href="/familia/nueva-reserva" className="btn-primary">Solicitar un paseo</Link>}
          />
        </Card>
        <LegacyAdminMessages uid={identity.uid} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Con quién está hablando: cara y nombre antes del hilo. */}
      <WalkerCard sessionId={walk.id} />
      <ConversationThread
        identity={identity}
        open={open}
        otherName="Tu paseador"
        title="Mensajes con tu paseador"
        description={`Sobre el paseo del ${walk.scheduledDate}. Pregúntale cómo va, avísale algo de tu perro o cuéntale un detalle de la entrada.`}
        closedNotice={chatWindowNotice(windowState, walk.scheduledDate, walk.scheduledStart, 'family')}
      />
      <LegacyAdminMessages uid={identity.uid} />
    </div>
  )
}
