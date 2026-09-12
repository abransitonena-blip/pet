'use client'

import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { persistWalkReport, useWalkReport } from '@/lib/useWalkReport'
import { uploadWalkPhoto, walkPhotoErrorMessage } from '@/lib/media/walkPhotoUpload'
import { MAX_WALK_PHOTOS, walkReportContentOf } from '@/lib/walkReports'

/**
 * Una foto del paseo, desde la tarjeta y sin salir de ella.
 *
 * Las fotos siempre pudieron subirse, pero sólo entrando a la bitácora: un
 * paseador con la correa en una mano no navega tres pantallas para mandar la
 * foto del perro en el parque. Esto abre la cámara de una vez y la deja en el
 * mismo borrador que usa la bitácora, así que aparece ahí y la familia la ve
 * cuando el reporte se envía, igual que las demás.
 */

interface WalkPhotoButtonProps {
  sessionId: string
}

export default function WalkPhotoButton({ sessionId }: WalkPhotoButtonProps) {
  const { report, state } = useWalkReport(sessionId, 'live')
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (!FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED || state === 'unavailable') return null
  // Un reporte ya enviado no admite cambios; la bitácora dice lo mismo.
  if (report?.status === 'submitted') return null

  const taken = report?.mediaReferences?.length ?? 0
  const full = taken >= MAX_WALK_PHOTOS

  const addPhoto = async (file: File) => {
    setUploading(true)
    setError('')
    setMessage('')
    try {
      const reference = await uploadWalkPhoto(sessionId, file)
      const content = walkReportContentOf(report)
      await persistWalkReport({
        sessionId,
        content: { ...content, mediaReferences: [...content.mediaReferences, reference] },
        mode: 'draft',
      })
      setMessage('Foto guardada en la bitácora.')
    } catch (cause) {
      setError(walkPhotoErrorMessage(cause instanceof Error ? cause.message : ''))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void addPhoto(file)
        }}
      />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={uploading || full}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink/[0.04] px-5 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
      >
        <Camera size={16} aria-hidden="true" />
        {uploading ? 'Subiendo la foto…' : full ? `Ya son ${MAX_WALK_PHOTOS} fotos` : 'Tomar una foto'}
        {taken > 0 && !uploading && !full && <span className="text-xs font-normal text-muted">{taken}/{MAX_WALK_PHOTOS}</span>}
      </button>
      {message && <p role="status" className="text-xs text-success-600">{message}</p>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  )
}
