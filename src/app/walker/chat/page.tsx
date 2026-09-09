'use client'

import { useMemo } from 'react'
import ConversationThread from '@/components/chat/ConversationThread'
import { useWalkerPanel } from '@/app/walker/WalkerPanelContext'

export default function WalkerChatPage() {
  const { uid, profile } = useWalkerPanel()

  const identity = useMemo(
    () => ({ uid, name: profile.name, role: 'walker' as const, phone: profile.phone }),
    [uid, profile.name, profile.phone],
  )

  return (
    <ConversationThread
      identity={identity}
      title="Mensajes con administración"
      description="Reporta incidencias, cambios de horario o dudas sobre un paseo asignado. Administración ve este hilo en su bandeja."
    />
  )
}
