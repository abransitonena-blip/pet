'use client'

import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot, orderBy, query, type FirestoreError } from 'firebase/firestore'
import { Send, MessagesSquare } from 'lucide-react'
import { db } from '@/firebase/db'
import Card from '@/components/ui/Card'
import ErrorState from '@/components/ui/ErrorState'
import { CHAT_MESSAGE_MAX_LENGTH, markConversationRead, openConversation, sendChatMessage, type ConversationIdentity } from '@/lib/chat'
import type { ChatMessage } from '@/types'
import { notifyChatMessage } from '@/lib/push/pushClient'

/**
 * Un hilo de conversación visto desde el lado de la persona.
 *
 * Por defecto es su hilo con administración -- el que el paseador usa, y el que
 * el inbox de /admin/chat lista. Con `open` se puede apuntar a otro hilo ya
 * resuelto: así la familia habla con el paseador de su paseo, que es quien puede
 * contestarle lo que pregunta mientras el paseo ocurre.
 */

interface ConversationThreadProps {
  identity: ConversationIdentity
  title: string
  description: string
  /** Abre (o crea) el hilo y devuelve su id. Por defecto, el de administración. */
  open?: () => Promise<string>
  /** Cómo se llama el otro lado en los mensajes que no son míos. */
  otherName?: string
}


export default function ConversationThread({ identity, title, description, open, otherName = 'Administración' }: ConversationThreadProps) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  // The thread document has to exist before its messages subcollection can be
  // listened to, and creating it is also what makes the person visible in the
  // admin inbox -- so it happens on open, not on first message.
  useEffect(() => {
    let cancelled = false
    ;(open ? open() : openConversation(identity))
      .then((id) => { if (!cancelled) setConversationId(id) })
      .catch(() => { if (!cancelled) setError('No pudimos abrir la conversación. Revisa tu conexión e inténtalo de nuevo.') })
    return () => { cancelled = true }
  }, [identity, open])

  useEffect(() => {
    if (!conversationId) return
    const unsubscribe = onSnapshot(
      query(collection(db, 'conversations', conversationId, 'messages'), orderBy('timestamp', 'asc')),
      (snapshot) => {
        setMessages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ChatMessage)))
        setError('')
      },
      (cause: FirestoreError) => {
        setError(cause.code === 'permission-denied'
          ? 'Tu sesión no tiene permiso para ver esta conversación.'
          : 'No pudimos cargar los mensajes. Revisa tu conexión.')
      },
    )
    void markConversationRead(conversationId, 'participant').catch(() => {})
    return unsubscribe
  }, [conversationId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!conversationId || !text || sending) return
    setSending(true)
    setInput('')
    try {
      await sendChatMessage(conversationId, { text, senderId: identity.uid, senderRole: identity.role })
      // Que suene del otro lado: el servidor decide a quién y sin el texto.
      notifyChatMessage(conversationId)
    } catch {
      setInput(text)
      setError('No pudimos enviar el mensaje. Inténtalo de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (timestamp?: { seconds: number }) => {
    if (!timestamp) return 'Enviando…'
    return new Date(timestamp.seconds * 1000).toLocaleString('es-MX', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="flex h-full min-h-[24rem] flex-col gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>

      {error && (
        <Card className="p-3 shadow-none">
          <ErrorState description={error} />
        </Card>
      )}

      <Card className="flex min-h-0 flex-1 flex-col p-0 shadow-none">
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center">
              <MessagesSquare size={22} className="text-muted" aria-hidden="true" />
              <p className="text-sm text-muted">Todavía no hay mensajes. Escribe el primero y administración lo verá en su bandeja.</p>
            </div>
          ) : (
            messages.map((message) => {
              // Quién lo escribió, no qué rol tiene: en el hilo de un paseo
              // la familia y el paseador no son administración, y con la regla
              // vieja los mensajes de ambos se veían como propios.
              const mine = message.senderId === identity.uid
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? 'bg-primary text-primary-foreground' : 'bg-ink/5 text-ink'}`}>
                    <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
                    <p className={`mt-1 text-2xs ${mine ? 'text-primary-foreground/70' : 'text-muted'}`}>
                      {mine ? 'Tú' : otherName} · {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={endRef} />
        </div>

        <form
          className="flex items-end gap-2 border-t border-border p-3"
          onSubmit={(event) => { event.preventDefault(); void handleSend() }}
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, CHAT_MESSAGE_MAX_LENGTH))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void handleSend()
              }
            }}
            rows={2}
            placeholder="Escribe tu mensaje…"
            aria-label="Mensaje para administración"
            className="input-field flex-1 resize-none"
          />
          <button
            type="submit"
            disabled={!conversationId || sending || !input.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Enviar mensaje"
          >
            <Send size={16} />
          </button>
        </form>
      </Card>
    </div>
  )
}
