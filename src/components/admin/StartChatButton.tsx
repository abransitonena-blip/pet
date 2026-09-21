'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessagesSquare } from 'lucide-react'
import { startConversationAsAdmin } from '@/lib/chat'

/**
 * Abrir el chat con un paseador desde su ficha.
 *
 * El hilo sólo nacía cuando el paseador entraba a su pantalla de mensajes, así
 * que administración no tenía a dónde escribir primero: tenía que salirse a
 * WhatsApp. Esto crea el hilo y lleva a la bandeja con él abierto.
 *
 * Sólo para paseadores. Las familias le escriben a su paseador y no tienen
 * ninguna pantalla donde ver un hilo con administración: el botón les creaba
 * uno que nunca iban a leer ni a poder contestar. A una familia se le escribe
 * por WhatsApp.
 */

interface StartChatButtonProps {
  uid: string
  name: string
  phone?: string
  role: 'walker'
  className?: string
}

export default function StartChatButton({ uid, name, phone = '', role, className = '' }: StartChatButtonProps) {
  const router = useRouter()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const open = async () => {
    setWorking(true)
    setError('')
    try {
      await startConversationAsAdmin({ uid, name, phone, role })
      router.push(`/admin/chat?c=${encodeURIComponent(uid)}`)
    } catch {
      setError('No pudimos abrir la conversación. Revisa tu conexión e inténtalo de nuevo.')
      setWorking(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void open()}
        disabled={working || !uid}
        className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary/10 text-sm font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 ${className}`}
      >
        <MessagesSquare size={14} aria-hidden="true" />
        {working ? 'Abriendo…' : 'Escribir en el chat de PET Ap'}
      </button>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  )
}
