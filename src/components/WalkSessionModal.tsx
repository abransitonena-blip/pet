'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { db, storage } from '@/firebase/config'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { FaCamera, FaMapMarkerAlt, FaTimes, FaCheck, FaStop, FaSpinner, FaImage } from 'react-icons/fa'
import { useEscapeKey } from '@/lib/useEscapeKey'
import type { Reservation } from '@/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  reservation: Reservation
  mode: 'check_in' | 'check_out'
}

export default function WalkSessionModal({ isOpen, onClose, reservation, mode }: Props) {
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEscapeKey(onClose, isOpen)

  useEffect(() => {
    if (!isOpen) {
      setPhoto(null)
      setPhotoFile(null)
      setNotes('')
      setSaving(false)
      setPreviewing(false)
      setLocationError('')
      stopCamera()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError('No se pudo obtener ubicación'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [isOpen])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setPreviewing(true)
    } catch {
      fileInputRef.current?.click()
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `${mode}.jpg`, { type: 'image/jpeg' })
      setPhotoFile(file)
      setPhoto(URL.createObjectURL(blob))
      stopCamera()
      setPreviewing(false)
    }, 'image/jpeg', 0.85)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhoto(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!photoFile || !location) return
    setSaving(true)
    try {
      const storagePath = `walks/${reservation.id}/${mode}.jpg`
      const storageRef = ref(storage, storagePath)
      await uploadBytes(storageRef, photoFile)
      const url = await getDownloadURL(storageRef)

      const updateData: Record<string, unknown> = {}
      if (mode === 'check_in') {
        updateData.walkCheckIn = { photo: url, lat: location.lat, lng: location.lng, timestamp: serverTimestamp() }
        updateData.status = 'paseando'
      } else {
        updateData.walkCheckOut = { photo: url, lat: location.lat, lng: location.lng, timestamp: serverTimestamp() }
        updateData.walkNotes = notes || ''
        updateData.status = 'completed'
        updateData.completedAt = serverTimestamp()
      }

      await updateDoc(doc(db, 'reservations', reservation.id), updateData)
      onClose()
    } catch (e) {
      console.error('Failed to save walk session', e)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="rounded-2xl overflow-hidden w-full max-w-md"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="text-sm font-bold">
            {mode === 'check_in' ? '📸 Iniciar paseo' : '✅ Terminar paseo'}
          </span>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--glass-bg)', color: 'var(--text-secondary)' }}
          >
            <FaTimes size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {reservation.petName} — {reservation.service} — {reservation.time}
          </div>

          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              <FaCamera size={11} className="inline mr-1" />
              Foto
            </label>
            {photo ? (
              <div className="relative rounded-xl overflow-hidden">
                <img src={photo} alt="Captura" className="w-full h-48 object-cover" />
                <button onClick={() => { setPhoto(null); setPhotoFile(null) }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white"
                >
                  <FaTimes size={12} />
                </button>
              </div>
            ) : previewing ? (
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video ref={videoRef} autoPlay playsInline className="w-full h-48 object-cover" />
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                  <button onClick={startCamera}
                    className="px-4 py-2 rounded-full text-xs font-semibold bg-white/20 text-white"
                  >
                    Cambiar cámara
                  </button>
                  <button onClick={capturePhoto}
                    className="w-12 h-12 rounded-full bg-white flex items-center justify-center"
                  >
                    <div className="w-10 h-10 rounded-full border-2 border-black" />
                  </button>
                  <button onClick={() => { stopCamera(); setPreviewing(false) }}
                    className="px-4 py-2 rounded-full text-xs font-semibold bg-red-500/30 text-red-300"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={startCamera}
                  className="flex-1 py-8 rounded-xl text-center transition-all touch-action-manipulation"
                  style={{ background: 'var(--glass-bg)', border: '1px dashed var(--border)' }}
                >
                  <FaCamera size={24} className="mx-auto mb-1" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Cámara</span>
                </button>
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-8 rounded-xl text-center transition-all touch-action-manipulation"
                  style={{ background: 'var(--glass-bg)', border: '1px dashed var(--border)' }}
                >
                  <FaImage size={24} className="mx-auto mb-1" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Subir foto</span>
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              <FaMapMarkerAlt size={11} className="inline mr-1" />
              Ubicación
            </label>
            {location ? (
              <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                <span className="ml-2 text-green-500">✓ Capturada</span>
              </p>
            ) : (
              <p className="text-xs" style={{ color: locationError ? '#ef4444' : 'var(--text-muted)' }}>
                {locationError || 'Obteniendo ubicación...'}
              </p>
            )}
          </div>

          {mode === 'check_out' && (
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Notas del paseo
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="¿Cómo estuvo el paseo? ¿Algo que reportar?"
                className="w-full px-3 py-2 rounded-xl text-sm transition-all resize-none"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'var(--glass-bg)', color: 'var(--text-secondary)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!photo || !location || saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-30 transition-all flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #E67E22, #D35400)',
            }}
          >
            {saving ? (
              <><FaSpinner className="animate-spin" size={14} /> Guardando...</>
            ) : mode === 'check_in' ? (
              <><FaCheck size={14} /> Iniciar paseo</>
            ) : (
              <><FaStop size={14} /> Terminar paseo</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
