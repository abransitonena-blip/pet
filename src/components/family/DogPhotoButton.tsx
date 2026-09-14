'use client'

import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { DOG_PHOTO_TYPES, dogPhotoErrorMessage } from '@/lib/dogPhotos'
import { uploadDogPhoto } from '@/lib/media/dogPhotoUpload'

/**
 * La foto de su perro, subida por la familia.
 *
 * La referencia se guarda en el documento del perro, que su dueño ya puede
 * escribir; la foto en sí vive como asset privado y sólo se ve con un enlace que
 * caduca. Mientras no haya foto, el perfil muestra la marca teñida del perro, y
 * este botón es lo que la reemplaza.
 */

interface DogPhotoButtonProps {
  dogId: string
  hasPhoto: boolean
  onUploaded: (reference: string) => void
}

export default function DogPhotoButton({ dogId, hasPhoto, onUploaded }: DogPhotoButtonProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  if (!FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED) return null

  const upload = async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const reference = await uploadDogPhoto(dogId, file)
      await updateDoc(doc(db, 'dogs', dogId), { photoReference: reference })
      onUploaded(reference)
    } catch (cause) {
      setError(dogPhotoErrorMessage(cause instanceof Error ? cause.message : ''))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <input
        ref={fileInput}
        type="file"
        aria-label="Elegir la foto de tu perro"
        accept={DOG_PHOTO_TYPES.join(',')}
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
        {uploading ? 'Subiendo la foto…' : hasPhoto ? 'Cambiar la foto' : 'Subir una foto'}
      </button>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  )
}
