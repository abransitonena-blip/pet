'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { auth } from '@/firebase/config'
import ConversationThread from '@/components/chat/ConversationThread'
import LoadingState from '@/components/ui/LoadingState'
import { getCustomerProfile } from '@/lib/customerProfile'

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

  if (!identity) return <LoadingState message="Abriendo tu conversación…" rows={3} height="h-16" />

  return (
    <ConversationThread
      identity={identity}
      title="Mensajes con PET Ap"
      description="Escríbenos sobre una reserva, un cambio de horario o cualquier duda. Te respondemos desde administración."
    />
  )
}
