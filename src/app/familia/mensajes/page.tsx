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

  const { sessions, error, retry } = useCustomerWalkSessions(identity?.uid ?? '')

  const walk = useMemo(
    () => sessions.find((session) => OPEN_STATUSES.has(session.status) && session.walkerId),
    [sessions],
  )

  const open = useCallback(async () => {
    if (!identity || !walk?.walkerId) throw new Error('walk-conversation-incomplete')
    return openWalkConversation({
      sessionId: walk.id,
      customerId: identity.uid,
      customerName: identity.name,
      walkerId: walk.walkerId,
      walkerName: 'Paseador',
      scheduledDate: walk.scheduledDate,
    })
  }, [identity, walk])

  if (!identity) return <LoadingState message="Abriendo tus mensajes…" rows={3} height="h-16" />
  if (error) return <Card className="p-5 shadow-none"><ErrorState description={canonicalReadErrorMessage(error)} onRetry={retry} /></Card>

  if (!walk) {
    return (
      <Card className="p-6 shadow-none">
        <EmptyState
          icon={<MessagesSquare size={24} />}
          title="Todavía no hay con quién escribir"
          description="Cuando tu paseo tenga un paseador asignado, podrás escribirle desde aquí y preguntarle cómo va."
          action={<Link href="/familia/nueva-reserva" className="btn-primary">Solicitar un paseo</Link>}
        />
      </Card>
    )
  }

  return (
    <ConversationThread
      identity={identity}
      open={open}
      otherName="Tu paseador"
      title="Mensajes con tu paseador"
      description={`Sobre el paseo del ${walk.scheduledDate}. Pregúntale cómo va, avísale algo de tu perro o cuéntale un detalle de la entrada.`}
    />
  )
}
