'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { db } from '@/firebase/config'
import {
  collection, query, orderBy, onSnapshot, doc,
  addDoc, serverTimestamp, updateDoc, increment, getDocs,
} from 'firebase/firestore'
import {
  FaComments, FaTimes, FaPaperPlane, FaUser, FaChevronLeft, FaTrash,
} from 'react-icons/fa'
import type { Conversation, ChatMessage } from '@/types'

export default function AdminChat() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query(collection(db, 'conversations'), orderBy('lastTimestamp', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const list: Conversation[] = []
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Conversation))
      setConversations(list)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!selectedId) return
    const q = query(
      collection(db, 'conversations', selectedId, 'messages'),
      orderBy('timestamp', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      const msgs: ChatMessage[] = []
      snap.forEach((d) => msgs.push({ id: d.id, ...d.data() } as ChatMessage))
      setMessages(msgs)
    })
    updateDoc(doc(db, 'conversations', selectedId), { unreadAdmin: 0 }).catch(() => {})
    return unsub
  }, [selectedId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!selectedId || !input.trim()) return
    const text = input.trim()
    setInput('')
    try {
      await addDoc(collection(db, 'conversations', selectedId, 'messages'), {
        text,
        senderId: 'admin',
        senderRole: 'admin',
        timestamp: serverTimestamp(),
      })
      await updateDoc(doc(db, 'conversations', selectedId), {
        lastMessage: text,
        lastTimestamp: serverTimestamp(),
        unreadClient: increment(1),
      }).catch(() => {})
    } catch {}
  }

  const formatTime = (ts?: { seconds: number; nanoseconds: number }) => {
    if (!ts) return ''
    const d = new Date(ts.seconds * 1000)
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const selectedConv = conversations.find((c) => c.id === selectedId)

  return (
    <div className="flex flex-col h-full" style={{ minHeight: '400px' }}>
      {selectedId && selectedConv ? (
        <>
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setSelectedId(null)}
              className="w-8 h-8 rounded-full flex items-center justify-center touch-action-manipulation"
              style={{ color: 'var(--text-secondary)' }}
            >
              <FaChevronLeft size={14} />
            </button>
            <div className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'var(--glass-bg)' }}
            >
              <FaUser size={14} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <p className="text-sm font-medium">{selectedConv.clientName || 'Cliente'}</p>
              {selectedConv.clientPhone && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedConv.clientPhone}</p>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                No hay mensajes aún
              </p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[80%] px-4 py-2 rounded-2xl text-sm"
                  style={{
                    background: msg.senderRole === 'admin'
                      ? 'linear-gradient(135deg, #E67E22, #D35400)'
                      : 'var(--glass-bg)',
                    color: msg.senderRole === 'admin' ? '#fff' : 'var(--text-primary)',
                    border: msg.senderRole === 'admin' ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  <p className="text-[10px] mt-1 opacity-60 text-right">
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex items-center gap-2 p-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder="Escribe un mensaje..."
              className="flex-1 px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30 transition-all touch-action-manipulation"
              style={{
                background: 'linear-gradient(135deg, #E67E22, #D35400)',
              }}
            >
              <FaPaperPlane size={14} className="text-white" />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FaComments size={14} style={{ color: 'var(--text-secondary)' }} />
              Conversaciones
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && (
              <p className="text-xs text-center py-12" style={{ color: 'var(--text-muted)' }}>
                No hay conversaciones aún
              </p>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-white/5 touch-action-manipulation"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--glass-bg)' }}
                >
                  <FaUser size={14} style={{ color: 'var(--text-secondary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{conv.clientName || 'Cliente'}</span>
                    <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {formatTime(conv.lastTimestamp)}
                    </span>
                  </div>
                  {conv.lastMessage && (
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {conv.lastMessage}
                    </p>
                  )}
                </div>
                {conv.unreadAdmin > 0 && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: '#E67E22' }}
                  >
                    <span className="text-[10px] font-bold text-white">{conv.unreadAdmin}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
