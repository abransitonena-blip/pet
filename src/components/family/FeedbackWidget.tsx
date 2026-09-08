'use client'

import { useState } from 'react'
import { MessageSquareHeart } from 'lucide-react'
import { auth } from '@/firebase/config'
import { Button, Card } from '@/components/ui'

const CATEGORIES = [
  { value: 'sugerencia', label: 'Sugerencia' },
  { value: 'elogio', label: 'Elogio' },
  { value: 'queja', label: 'Queja' },
  { value: 'otro', label: 'Otro' },
] as const

const MAX_LENGTH = 800

export default function FeedbackWidget() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>('sugerencia')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')

  const send = async () => {
    if (!message.trim()) return
    setSending(true)
    setStatus('idle')
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('auth-required')
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: message.trim(), category }),
      })
      if (!response.ok) throw new Error('submit-failed')
      setMessage('')
      setStatus('sent')
    } catch {
      setStatus('error')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="p-6" aria-labelledby="feedback-widget-title">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquareHeart size={18} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <p id="feedback-widget-title" className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Danos tu opinión</p>
      </div>
      <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        Este mensaje es privado para nuestro equipo, no es una reseña pública.
      </p>
      <label htmlFor="feedback-category" className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Tipo</label>
      <select
        id="feedback-category"
        value={category}
        onChange={(e) => setCategory(e.target.value as typeof category)}
        className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
      >
        {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <label htmlFor="feedback-message" className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Mensaje</label>
      <textarea
        id="feedback-message"
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
        rows={3}
        maxLength={MAX_LENGTH}
        placeholder="Cuéntanos qué podemos mejorar…"
        className="mb-3 w-full resize-none rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
      />
      <Button size="sm" onClick={() => void send()} disabled={!message.trim()} isLoading={sending}>Enviar</Button>
      {status === 'sent' && <p role="status" className="mt-2 text-xs" style={{ color: 'var(--color-success, #16a34a)' }}>Gracias, tu mensaje llegó a nuestro equipo.</p>}
      {status === 'error' && <p role="alert" className="mt-2 text-xs" style={{ color: 'var(--color-danger)' }}>No pudimos enviar tu mensaje. Intenta de nuevo.</p>}
    </Card>
  )
}
