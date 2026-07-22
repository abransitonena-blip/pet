'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/firebase/config'
import {
  collection, query, orderBy, onSnapshot, doc,
  addDoc, serverTimestamp, setDoc, updateDoc, increment, getDoc,
} from 'firebase/firestore'
import { FaComments, FaTimes, FaPaperPlane, FaUser } from 'react-icons/fa'
import type { ChatMessage } from '@/types'

interface Props {
  clientUid: string | null
  onLoginRequired: () => void
}

export default function ChatWidget({ clientUid, onLoginRequired }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [clientName, setClientName] = useState('')
  const [show, setShow] = useState(false)
  const [unread, setUnread] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!clientUid) { setClientName(''); return }
    getDoc(doc(db, 'clients', clientUid)).then((snap) => {
      if (snap.exists()) setClientName(snap.data().name || '')
    }).catch(() => {})
  }, [clientUid])

  useEffect(() => {
    if (!clientUid) return
    const unsub = onSnapshot(doc(db, 'conversations', clientUid), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setUnread(data.unreadClient || 0)
      }
    })
    return unsub
  }, [clientUid])

  useEffect(() => {
    if (!clientUid || !open) return
    const q = query(
      collection(db, 'conversations', clientUid, 'messages'),
      orderBy('timestamp', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      const msgs: ChatMessage[] = []
      snap.forEach((d) => msgs.push({ id: d.id, ...d.data() } as ChatMessage))
      setMessages(msgs)
    })
    updateDoc(doc(db, 'conversations', clientUid), { unreadClient: 0 }).catch(() => {})
    return unsub
  }, [clientUid, open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!clientUid || !input.trim()) return
    const text = input.trim()
    setInput('')
    try {
      await addDoc(collection(db, 'conversations', clientUid, 'messages'), {
        text,
        senderId: clientUid,
        senderRole: 'client',
        timestamp: serverTimestamp(),
      })
      try {
        await updateDoc(doc(db, 'conversations', clientUid), {
          lastMessage: text,
          lastTimestamp: serverTimestamp(),
          unreadAdmin: increment(1),
        })
      } catch {
        await setDoc(doc(db, 'conversations', clientUid), {
          clientId: clientUid,
          clientName,
          lastMessage: text,
          lastTimestamp: serverTimestamp(),
          unreadAdmin: 1,
          unreadClient: 0,
          createdAt: serverTimestamp(),
        })
      }
    } catch {}
  }

  const formatTime = (ts?: { seconds: number; nanoseconds: number }) => {
    if (!ts) return ''
    const d = new Date(ts.seconds * 1000)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'ahora'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  }

  const handleOpen = () => {
    if (!clientUid) {
      onLoginRequired()
      return
    }
    setOpen(true)
  }

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed bottom-6 right-6 z-[var(--z-sticky)] flex flex-col items-end gap-3">
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="w-[85vw] max-w-sm rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  maxHeight: '60vh',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'linear-gradient(135deg, #E67E22, #D35400)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <FaComments size={16} className="text-white" />
                    <span className="text-sm font-semibold text-white">Chat PET Ap</span>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="w-7 h-7 rounded-full flex items-center justify-center bg-white/20 touch-action-manipulation"
                  >
                    <FaTimes size={12} className="text-white" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {messages.length === 0 && (
                    <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
                      ¡Hola! Escríbenos cualquier duda sobre los paseos
                    </p>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.senderRole === 'client' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className="max-w-[85%] px-3 py-2 rounded-2xl text-sm"
                        style={{
                          background: msg.senderRole === 'client'
                            ? 'linear-gradient(135deg, #E67E22, #D35400)'
                            : 'var(--glass-bg)',
                          color: msg.senderRole === 'client' ? '#fff' : 'var(--text-primary)',
                          border: msg.senderRole === 'client' ? 'none' : '1px solid var(--border)',
                        }}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        <p className="text-[10px] mt-1 opacity-50 text-right">
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
                    className="flex-1 px-4 py-2 rounded-xl text-sm transition-all"
                    style={{
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30 transition-all touch-action-manipulation shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, #E67E22, #D35400)',
                    }}
                  >
                    <FaPaperPlane size={12} className="text-white" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleOpen}
            className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all touch-action-manipulation"
            style={{
              background: open ? 'var(--bg-card)' : 'linear-gradient(135deg, #E67E22, #D35400)',
              border: open ? '1px solid var(--border)' : 'none',
              boxShadow: open ? 'none' : '0 4px 20px rgba(230, 126, 34, 0.4)',
            }}
          >
            {open ? (
              <FaTimes size={20} style={{ color: 'var(--text-primary)' }} />
            ) : (
              <>
                <FaComments size={22} className="text-white" />
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full border-2 border-orange-300/40"
                />
              </>
            )}
            {!open && unread > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: '#e74c3c' }}
              >
                <span className="text-[10px] font-bold text-white">{unread}</span>
              </div>
            )}
          </button>
        </div>
      )}
    </AnimatePresence>
  )
}
