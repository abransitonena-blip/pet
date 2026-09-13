'use client'

import { useCallback, useMemo, useState } from 'react'
import ConversationThread from '@/components/chat/ConversationThread'
import { useWalkerPanel } from '@/app/walker/WalkerPanelContext'
import { useWalkerSessions } from '@/lib/useServiceOrders'
import { walkerSessionDate, walkerSessionStatus } from '@/lib/walkerPanel'
import { openWalkConversation } from '@/lib/chat'

/**
 * Los mensajes del paseador: con administración, y con la familia de cada paseo.
 *
 * El hilo con administración es el de siempre -- incidencias, horarios, dudas.
 * Lo nuevo es que cada paseo asignado trae su propio hilo con la familia, porque
 * es a él a quien le preguntan cómo va su perro, y antes esa pregunta tenía que
 * dar la vuelta por administración.
 */

// Un paseo por el que todavía pueden escribirle.
const OPEN_STATUSES = new Set(['assigned', 'confirmed', 'on_the_way', 'arrived', 'in_progress'])

export default function WalkerChatPage() {
  const { uid, profile } = useWalkerPanel()
  const { sessions } = useWalkerSessions(uid)
  const [selected, setSelected] = useState<string>('admin')

  const identity = useMemo(
    () => ({ uid, name: profile.name, role: 'walker' as const, phone: profile.phone }),
    [uid, profile.name, profile.phone],
  )

  const walks = useMemo(
    () => sessions.filter((session) => OPEN_STATUSES.has(walkerSessionStatus(session))),
    [sessions],
  )

  const walk = walks.find((session) => session.id === selected)

  const open = useCallback(async () => {
    if (!walk) throw new Error('walk-conversation-incomplete')
    const customerId = 'customerId' in walk && typeof walk.customerId === 'string' ? walk.customerId : ''
    return openWalkConversation({
      sessionId: walk.id,
      customerId,
      customerName: walk.dogName ? `Familia de ${walk.dogName}` : 'Familia',
      walkerId: uid,
      walkerName: profile.name,
      scheduledDate: walkerSessionDate(walk),
    })
  }, [walk, uid, profile.name])

  return (
    <div className="space-y-3">
      {walks.length > 0 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Elegir conversación">
          <button
            type="button"
            role="tab"
            aria-selected={selected === 'admin'}
            onClick={() => setSelected('admin')}
            className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${selected === 'admin' ? 'bg-primary/10 text-primary' : 'bg-ink/[0.04] text-muted'}`}
          >
            Administración
          </button>
          {walks.map((session) => (
            <button
              key={session.id}
              type="button"
              role="tab"
              aria-selected={selected === session.id}
              onClick={() => setSelected(session.id)}
              className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${selected === session.id ? 'bg-primary/10 text-primary' : 'bg-ink/[0.04] text-muted'}`}
            >
              {session.dogName || 'Paseo'} · {walkerSessionDate(session)}
            </button>
          ))}
        </div>
      )}

      {walk ? (
        <ConversationThread
          key={walk.id}
          identity={identity}
          open={open}
          otherName="La familia"
          title={`Mensajes con la familia de ${walk.dogName || 'este paseo'}`}
          description={`Sobre el paseo del ${walkerSessionDate(walk)}. Avísale cómo va, o pregúntale algo que necesites para salir.`}
        />
      ) : (
        <ConversationThread
          identity={identity}
          title="Mensajes con administración"
          description="Reporta incidencias, cambios de horario o dudas sobre un paseo asignado. Administración ve este hilo en su bandeja."
        />
      )}
    </div>
  )
}
