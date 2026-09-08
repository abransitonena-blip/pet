'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { ShieldCheck, Upload, X } from 'lucide-react'
import { auth, db } from '@/firebase/config'
import { Button, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import {
  galleryFormatLabel,
  parseGalleryRecord,
  type CompatibleGalleryRecord,
  type GalleryPublicationStatus,
  type ParsedGalleryRecord,
} from '@/lib/media/galleryRecords'
import { ROLES } from '@/lib/roles'
import { useSessionRole } from '@/lib/useSessionRole'

type ReadState = 'loading' | 'ready' | 'permission' | 'network'

const MAXIMUM_BYTES = 10_000_000
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function isCloudinaryResult(value: unknown): value is { public_id: string; secure_url: string; width: number; height: number; format: CompatibleGalleryRecord['format'] } {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.public_id === 'string' && /^pet-ap-public\/[a-f0-9-]{36}$/.test(data.public_id)
    && typeof data.secure_url === 'string' && data.secure_url.startsWith('https://res.cloudinary.com/')
    && Number.isSafeInteger(data.width) && Number(data.width) > 0
    && Number.isSafeInteger(data.height) && Number(data.height) > 0
    && ['jpg', 'jpeg', 'png', 'webp'].includes(String(data.format))
}

function publicProjection(record: CompatibleGalleryRecord, normalizedAltText = record.altText) {
  return {
    schemaVersion: 1,
    assetPublicId: record.assetPublicId,
    url: record.url,
    width: record.width,
    height: record.height,
    format: record.format,
    altText: normalizedAltText,
    updatedAt: serverTimestamp(),
  }
}

export default function AdminGalleryManager() {
  const session = useSessionRole([ROLES.ADMIN, ROLES.SUPERVISOR])
  const [records, setRecords] = useState<ParsedGalleryRecord[]>([])
  const [state, setState] = useState<ReadState>('loading')
  const [filter, setFilter] = useState<'all' | GalleryPublicationStatus>('all')
  const [file, setFile] = useState<File | null>(null)
  const [altText, setAltText] = useState('')
  const [consent, setConsent] = useState(false)
  const [rights, setRights] = useState(false)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [diagnosticsMessage, setDiagnosticsMessage] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editingAltText, setEditingAltText] = useState('')
  const [editingConsent, setEditingConsent] = useState(false)
  const [editingRights, setEditingRights] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const canWrite = session.status === 'ready' && session.role === ROLES.ADMIN && Boolean(session.uid)

  const load = useCallback(async () => {
    if (session.status !== 'ready') return
    setState('loading')
    try {
      const snapshot = await getDocs(query(collection(db, 'gallery-images'), orderBy('createdAt', 'desc'), limit(50)))
      setRecords(snapshot.docs.map((item) => parseGalleryRecord(item.id, item.data())))
      setState('ready')
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : ''
      setState(code.includes('permission-denied') ? 'permission' : 'network')
    }
  }, [session.status])

  useEffect(() => { void load() }, [load])
  const visible = useMemo(() => filter === 'all'
    ? records
    : records.filter((item) => item.kind === 'compatible' && item.record.publicationStatus === filter), [filter, records])
  const recordCounts = useMemo(() => records.reduce<{ compatible: number; legacy: number; invalid: number }>((counts, item) => {
    counts[item.kind] += 1
    return counts
  }, { compatible: 0, legacy: 0, invalid: 0 }), [records])

  const clearDraft = () => {
    setFile(null); setAltText(''); setConsent(false); setRights(false); setMessage('')
    if (fileInput.current) fileInput.current.value = ''
  }

  const uploadDraft = async () => {
    if (!file || !canWrite || !session.uid) return
    if (!ALLOWED_TYPES.has(file.type) || file.size > MAXIMUM_BYTES) {
      setMessage('Usa JPG, PNG o WebP de máximo 10 MB.')
      return
    }
    if (!altText.trim() || altText.trim().length > 240) {
      setMessage('Escribe un texto alternativo de 1 a 240 caracteres.')
      return
    }
    setBusy('upload'); setMessage('')
    try {
      const token = await auth.currentUser?.getIdToken(true)
      if (!token) throw new Error('auth-required')
      const signedResponse = await fetch('/api/admin/gallery/signature', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const signed = await signedResponse.json() as Record<string, unknown>
      if (!signedResponse.ok) throw new Error(String(signed.code ?? 'signature-failed'))
      const body = new FormData()
      body.set('file', file)
      body.set('api_key', String(signed.apiKey))
      body.set('timestamp', String(signed.timestamp))
      body.set('signature', String(signed.signature))
      body.set('public_id', String(signed.publicId))
      body.set('transformation', String(signed.transformation))
      body.set('overwrite', 'false')
      const upload = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(String(signed.cloudName))}/image/upload`, { method: 'POST', body })
      const result = await upload.json()
      if (!upload.ok || !isCloudinaryResult(result)) throw new Error('upload-failed')
      const reference = doc(collection(db, 'gallery-images'))
      await setDoc(reference, {
        schemaVersion: 1,
        publicationStatus: 'draft',
        consentRecorded: consent,
        consentVerified: consent,
        publicGalleryAllowed: consent && rights,
        usageRights: rights ? 'public-gallery' : 'pending',
        assetPublicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        altText: altText.trim(),
        assetDate: serverTimestamp(),
        revokedAt: null,
        pendingDeletion: false,
        createdBy: session.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      clearDraft()
      setMessage('Imagen cargada como borrador. Todavía no es pública.')
      await load()
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      setMessage(code === 'signed-upload-not-configured' ? 'Carga segura no configurada.' : code.includes('permission') ? 'No tienes permiso para registrar esta imagen.' : 'No pudimos completar la carga segura.')
    } finally { setBusy('') }
  }

  const runDiagnostics = async () => {
    setDiagnosticsMessage('Probando…')
    try {
      const token = await auth.currentUser?.getIdToken(true)
      if (!token) throw new Error('auth-required')
      const response = await fetch('/api/admin/gallery/diagnostics', { headers: { Authorization: `Bearer ${token}` } })
      const result = await response.json() as { ok?: boolean; message?: string }
      setDiagnosticsMessage(response.ok && result.ok
        ? 'Credenciales de Cloudinary válidas. El problema no es la contraseña/clave — revisa la firma de subida.'
        : `Cloudinary rechazó las credenciales: ${result.message ?? 'sin detalle'}.`)
    } catch {
      setDiagnosticsMessage('No pudimos ejecutar la prueba (revisa tu sesión).')
    }
  }

  const beginEditing = (record: CompatibleGalleryRecord) => {
    setEditingId(record.id)
    setEditingAltText(record.altText)
    setEditingConsent(record.consentRecorded && record.consentVerified)
    setEditingRights(record.usageRights === 'public-gallery')
    setMessage('')
  }

  const saveMetadata = async (record: CompatibleGalleryRecord) => {
    const normalizedAlt = editingAltText.trim()
    if (!canWrite || editingId !== record.id) return
    if (!normalizedAlt || normalizedAlt.length > 240) {
      setMessage('El texto alternativo debe tener entre 1 y 240 caracteres.')
      return
    }
    setBusy(`metadata:${record.id}`); setMessage('')
    try {
      const batch = writeBatch(db)
      const privateRef = doc(db, 'gallery-images', record.id)
      const publicRef = doc(db, 'gallery-public', record.id)
      const remainsPublished = record.publicationStatus === 'published' && editingConsent && editingRights
      batch.update(privateRef, {
        altText: normalizedAlt,
        consentRecorded: editingConsent,
        consentVerified: editingConsent,
        usageRights: editingRights ? 'public-gallery' : 'pending',
        publicationStatus: remainsPublished ? 'published' : record.publicationStatus === 'published' ? 'withdrawn' : record.publicationStatus,
        publicGalleryAllowed: remainsPublished,
        updatedAt: serverTimestamp(),
      })
      if (remainsPublished) batch.set(publicRef, publicProjection(record, normalizedAlt))
      else if (record.publicationStatus === 'published') batch.delete(publicRef)
      await batch.commit()
      setEditingId('')
      setMessage(remainsPublished || record.publicationStatus !== 'published'
        ? 'Metadata actualizada.'
        : 'Metadata actualizada y publicación retirada por faltar consentimiento o derechos.')
      await load()
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : ''
      setMessage(code.includes('permission-denied') ? 'No tienes permiso para modificar la metadata.' : 'No pudimos actualizar la metadata.')
    } finally { setBusy('') }
  }

  const changeStatus = async (record: CompatibleGalleryRecord, status: 'published' | 'withdrawn') => {
    if (!canWrite) return
    if (status === 'published' && (!record.consentRecorded || !record.consentVerified || record.usageRights !== 'public-gallery' || !record.altText.trim())) {
      setMessage('Completa consentimiento, derechos y texto alternativo antes de publicar.')
      return
    }
    setBusy(`${status}:${record.id}`); setMessage('')
    try {
      const batch = writeBatch(db)
      const privateRef = doc(db, 'gallery-images', record.id)
      const publicRef = doc(db, 'gallery-public', record.id)
      batch.update(privateRef, {
        publicationStatus: status,
        publicGalleryAllowed: status === 'published',
        updatedAt: serverTimestamp(),
      })
      if (status === 'published') batch.set(publicRef, publicProjection(record))
      else batch.delete(publicRef)
      await batch.commit()
      setMessage(status === 'published' ? 'Imagen publicada.' : 'Publicación retirada. El asset externo no fue eliminado.')
      await load()
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : ''
      setMessage(code.includes('permission-denied') ? 'No tienes permiso para cambiar la publicación.' : 'No pudimos actualizar la publicación.')
    } finally { setBusy('') }
  }

  if (session.status === 'loading' || state === 'loading') return <LoadingState message="Consultando galería…" rows={4} />
  if (state === 'permission' || state === 'network') return <ErrorState description={state === 'permission' ? 'No tienes permiso para consultar la galería administrativa.' : 'No pudimos consultar la galería.'} onRetry={() => void load()} />

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl bg-surface p-4 sm:p-5" aria-labelledby="secure-gallery-upload">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-primary" size={20} aria-hidden="true" /><div><h2 id="secure-gallery-upload" className="font-semibold text-ink">Carga firmada</h2><p className="mt-1 text-sm text-muted">Solo Admin. Los secretos permanecen en servidor y Cloudinary elimina el perfil de metadata mediante transformación firmada.</p></div></div>
        {!canWrite ? <p className="text-sm text-muted">Supervisor: consulta de solo lectura.</p> : <>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} aria-label="Seleccionar imagen para cargar" className="block min-h-11 w-full rounded-xl border border-border bg-canvas p-2 text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:font-semibold file:text-primary" />
          <label className="block text-sm font-semibold text-ink">Texto alternativo<textarea value={altText} maxLength={240} onChange={(event) => setAltText(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-border bg-canvas px-4 py-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" /></label>
          <div className="grid gap-2 sm:grid-cols-2"><label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm text-ink"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="h-5 w-5 accent-primary" />Consentimiento registrado</label><label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm text-ink"><input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} className="h-5 w-5 accent-primary" />Derechos para galería pública</label></div>
          <div className="flex flex-wrap gap-2"><Button onClick={() => void uploadDraft()} disabled={!file || busy === 'upload'} isLoading={busy === 'upload'} leftIcon={<Upload size={16} aria-hidden="true" />}>Cargar como borrador</Button><Button variant="secondary" onClick={clearDraft} disabled={busy === 'upload'} leftIcon={<X size={16} aria-hidden="true" />}>Cancelar</Button><Button variant="secondary" onClick={() => void runDiagnostics()}>Probar credenciales de Cloudinary</Button></div>
        </>}
        {message && <p role="status" className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-ink">{message}</p>}
        {diagnosticsMessage && <p role="status" className="rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink">{diagnosticsMessage}</p>}
      </section>

      <section aria-labelledby="gallery-records-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="gallery-records-title" className="text-lg font-semibold text-ink">Imágenes</h2>
            <p className="text-sm text-muted">Máximo 50 registros recientes.</p>
            {(recordCounts.legacy > 0 || recordCounts.invalid > 0) ? (
              <p className="mt-1 text-xs text-muted" role="status">
                {recordCounts.compatible} compatibles · {recordCounts.legacy} anteriores · {recordCounts.invalid} inválidos
              </p>
            ) : null}
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="Filtrar por estado de publicación" className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-ink">
            <option value="all">Todas</option>
            <option value="draft">Borradores</option>
            <option value="published">Publicadas</option>
            <option value="withdrawn">Retiradas</option>
          </select>
        </div>
        {visible.length === 0 ? (
          <div className="mt-4"><EmptyState title="Sin imágenes" description="No hay registros para este filtro." /></div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((entry) => {
              if (entry.kind === 'legacy') {
                const label = entry.record.title ?? entry.record.dog
                return (
                  <article key={entry.record.id} className="rounded-2xl border border-warning/30 bg-surface p-4" aria-label="Registro anterior pendiente de migración">
                    <span className="inline-flex rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-amber-800">Solo lectura</span>
                    <h3 className="mt-3 text-sm font-semibold text-ink">Registro anterior — pendiente de migración</h3>
                    {label ? <p className="mt-2 break-words text-sm text-muted">{label}</p> : null}
                    {entry.record.title && entry.record.dog && entry.record.title !== entry.record.dog ? <p className="mt-1 break-words text-xs text-muted">Perro: {entry.record.dog}</p> : null}
                    <p className="mt-3 text-xs text-muted">No puede publicarse, editarse ni eliminarse desde G1{entry.record.hasValidUrl ? '; conserva una referencia HTTPS anterior' : ''}.</p>
                  </article>
                )
              }

              if (entry.kind === 'invalid') {
                return (
                  <article key={entry.id} className="rounded-2xl border border-danger/30 bg-surface p-4" role="alert">
                    <span className="inline-flex rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">Registro inválido</span>
                    <h3 className="mt-3 text-sm font-semibold text-ink">No se puede administrar este registro</h3>
                    <p className="mt-2 text-sm text-muted">{entry.reason}</p>
                    <p className="mt-2 text-xs text-muted">Referencia: {entry.id.slice(0, 8) || 'sin ID'}</p>
                  </article>
                )
              }

              const record = entry.record
              return (
                <article key={record.id} className="overflow-hidden rounded-2xl bg-surface">
                  <div className="relative aspect-[4/3] bg-ink/5"><Image src={record.url} alt={record.altText} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" /></div>
                  <div className="space-y-3 p-4">
                    {editingId === record.id ? (
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-ink">Texto alternativo<textarea value={editingAltText} maxLength={240} rows={2} onChange={(event) => setEditingAltText(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" /></label>
                        <label className="flex min-h-11 items-center gap-2 text-sm text-ink"><input type="checkbox" checked={editingConsent} onChange={(event) => setEditingConsent(event.target.checked)} className="h-5 w-5 accent-primary" />Consentimiento registrado</label>
                        <label className="flex min-h-11 items-center gap-2 text-sm text-ink"><input type="checkbox" checked={editingRights} onChange={(event) => setEditingRights(event.target.checked)} className="h-5 w-5 accent-primary" />Derechos de galería pública</label>
                        <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void saveMetadata(record)} isLoading={busy === `metadata:${record.id}`}>Guardar metadata</Button><Button size="sm" variant="secondary" onClick={() => setEditingId('')}>Cancelar</Button></div>
                      </div>
                    ) : (
                      <div><p className="line-clamp-2 text-sm font-semibold text-ink">{record.altText}</p><p className="mt-1 text-xs text-muted">{record.width} × {record.height} · {galleryFormatLabel(record.format)}</p></div>
                    )}
                    <span className="inline-flex rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink">{record.publicationStatus === 'published' ? 'Publicada' : record.publicationStatus === 'withdrawn' ? 'Retirada' : 'Borrador'}</span>
                    {canWrite && editingId !== record.id ? (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => beginEditing(record)}>Editar metadata</Button>
                        {record.publicationStatus !== 'published' ? <Button size="sm" onClick={() => void changeStatus(record, 'published')} isLoading={busy === `published:${record.id}`} disabled={!record.consentRecorded || record.usageRights !== 'public-gallery'}>Publicar</Button> : null}
                        {record.publicationStatus === 'published' ? <Button size="sm" variant="secondary" onClick={() => void changeStatus(record, 'withdrawn')} isLoading={busy === `withdrawn:${record.id}`}>Retirar publicación</Button> : null}
                      </div>
                    ) : null}
                    <p className="text-xs text-muted">Retirar oculta la publicación; no elimina el asset de Cloudinary.</p>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
