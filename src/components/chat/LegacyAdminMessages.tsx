'use client'

import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ChevronDown } from 'lucide-react'
import { db } from '@/firebase/db'
import { markConversationRead } from '@/lib/chat'
import type { ChatMessage } from '@/types'

/**
 * Lo que administración ya le había escrito a una familia.
 *
 * Antes la familia hablaba con administración en un hilo propio. Ahora habla con
 * su paseador, y ese hilo dejó de tener pantalla: lo que administración
 * contestó ahí -- y la insignia de "mensajes nuevos" que dejó pendiente -- se
 * quedaba sin poder leerse. Aquí se conserva, sólo para leer, y sólo aparece si
 * el hilo tiene algo. Una familia que nunca escribió a administración no ve
 * nada nuevo.
 */

/** Los más recientes: un hilo viejo no necesita cargarse entero. */
const MAX_MESSAGES = 30

export default function LegacyAdminMessages({ uid }: { uid: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    if (!uid) return
    return onSnapshot(
      query(collection(db, 'conversations', uid, 'messages'), orderBy('timestamp', 'desc'), limit(MAX_MESSAGES)),
      // Del más viejo al más nuevo, como se lee una conversación.
      (snapshot) => setMessages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ChatMessage)).reverse()),
      // Sin hilo no hay permiso para leerlo, y eso sólo significa que no hay nada.
      () => setMessages([]),
    )
  }, [uid])

  if (messages.length === 0) return null

  return (
    <details
      className="group rounded-2xl border border-ink/10 bg-surface p-4"
      onToggle={(event) => {
        // Abrirlo es leerlo: se apaga la insignia que lo anunciaba.
        if ((event.currentTarget as HTMLDetailsElement).open) void markConversationRead(uid, 'participant').catch(() => {})
      }}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        Mensajes anteriores de administración
        <ChevronDown size={16} aria-hidden="true" className="text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <p className="mt-1 text-xs text-muted">
        Sólo para leer. Para hablar de un paseo, escríbele a tu paseador; para todo lo demás, por WhatsApp.
      </p>
      <ul className="mt-3 space-y-2">
        {messages.map((message) => (
          <li
            key={message.id}
            className={`rounded-xl px-3 py-2 text-sm ${message.senderRole === 'admin' ? 'bg-primary/10 text-ink' : 'bg-ink/[0.04] text-ink'}`}
          >
            <p className="text-2xs font-semibold text-muted">{message.senderRole === 'admin' ? 'Administración' : 'Tú'}</p>
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          </li>
        ))}
      </ul>
    </details>
  )
}
