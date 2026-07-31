'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { uploadToCloudinary, getCurrentPosition } from '@/lib/cloudinary'
import { FaCamera, FaTimes, FaCheck, FaSpinner } from 'react-icons/fa'

interface Props {
  isOpen: boolean
  onClose: () => void
  requestId: string
  mode: 'check_in' | 'check_out'
  onDone: () => void
}

export default function PetAhoraPhotoModal({ isOpen, onClose, requestId, mode, onDone }: Props) {
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener('keydown', handleKeyDown)
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setPhotoFile(f)
    setPhoto(URL.createObjectURL(f))
  }

  const handleSave = async () => {
    if (!photoFile || saving) return
    setSaving(true)
    setError('')
    try {
      let location
      try { location = await getCurrentPosition() } catch { location = null }
      const url = await uploadToCloudinary(photoFile, `pet-ahora/${requestId}`)

      const field = mode === 'check_in' ? 'walkCheckIn' : 'walkCheckOut'
      const nextStatus = mode === 'check_in' ? 'paseando' : 'completed'

      await updateDoc(doc(db, 'petAhoraRequests', requestId), {
        [field]: { photo: url, lat: location?.lat ?? null, lng: location?.lng ?? null, timestamp: serverTimestamp() },
        status: nextStatus,
        ...(mode === 'check_out' ? { completedAt: serverTimestamp() } : {}),
      })

      onDone()
      onClose()
    } catch (e) {
      setError('Error al guardar foto')
    }
    setSaving(false)
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'check_in' ? 'Iniciar paseo' : 'Completar paseo'}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl p-5 w-full max-w-sm"
        style={{ background: 'var(--bg-card)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {mode === 'check_in' ? 'Iniciar paseo' : 'Completar paseo'}
          </h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <FaTimes size={11} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {photo ? (
          <div className="relative mb-4 rounded-xl overflow-hidden aspect-square">
            <img src={photo} alt="Foto" className="w-full h-full object-cover" />
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full aspect-square mb-4 rounded-xl flex flex-col items-center justify-center gap-2 border-2 border-dashed transition-colors hover:bg-white/[0.02]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <FaCamera size={24} />
            <span className="text-xs">{mode === 'check_in' ? 'Tomar foto de inicio' : 'Tomar foto de finalización'}</span>
          </button>
        )}

        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />

        {error && <p className="text-xs mb-3" style={{ color: 'var(--color-danger)' }}>{error}</p>}

        <div className="flex gap-2">
          {photo && (
            <button onClick={() => { setPhoto(null); setPhotoFile(null) }} className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
              Retomar
            </button>
          )}
          <button
            onClick={photo ? handleSave : () => fileRef.current?.click()}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all"
            style={{ background: 'var(--color-primary)' }}
          >
            {saving ? <><FaSpinner className="animate-spin" size={11} /> Guardando...</> : <><FaCheck size={11} /> {photo ? 'Guardar' : 'Seleccionar foto'}</>}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
