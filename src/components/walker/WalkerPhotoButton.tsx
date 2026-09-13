'use client'

import { useRef, useState } from 'react'
import { Camera, UserRound } from 'lucide-react'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { WALKER_PHOTO_TYPES, walkerPhotoErrorMessage } from '@/lib/walkerPhotos'
import { uploadWalkerPhoto } from '@/lib/media/walkerPhotoUpload'

/**
 * La foto del paseador, subida por él.
 *
 * La familia va a entregarle su perro a alguien que no conoce: ver su cara antes
 * de abrir la puerta convierte a "el paseador asignado" en una persona.
 *
 * La referencia queda en su propio perfil -- las reglas ya le permiten editarlo
 * -- y la foto vive como asset privado que sólo se ve con un enlace que caduca.
 */

interface WalkerPhotoButtonProps {
  uid: string
  photoUrl: string
  hasPhoto: boolean
  onUploaded: (reference: string) => void
}

export default function WalkerPhotoButton({ uid, photoUrl, hasPhoto, onUploaded }: WalkerPhotoButtonProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  if (!FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED) return null

  const upload = async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const reference = await uploadWalkerPhoto(file)
      await updateDoc(doc(db, 'walkerProfiles', uid), { photoReference: reference, updatedAt: serverTimestamp() })
      onUploaded(reference)
    } catch (cause) {
      setError(walkerPhotoErrorMessage(cause instanceof Error ? cause.message : ''))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-primary">
        {photoUrl
          ? <img src={photoUrl} alt="Tu foto de perfil" className="h-full w-full object-cover" />
          : <UserRound size={26} aria-hidden="true" />}
      </span>
      <div className="min-w-0 space-y-1">
        <input
          ref={fileInput}
          type="file"
          accept={WALKER_PHOTO_TYPES.join(',')}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink/[0.04] px-4 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
        >
          <Camera size={15} aria-hidden="true" />
          {uploading ? 'Subiendo tu foto…' : hasPhoto ? 'Cambiar mi foto' : 'Subir mi foto'}
        </button>
        <p className="text-xs text-muted">La familia la ve cuando te asignan su paseo.</p>
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>
    </div>
  )
}
