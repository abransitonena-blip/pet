'use client'

import { useEffect, useRef, useState } from 'react'
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { AlertTriangle, CheckCircle2, CircleDollarSign, RefreshCw } from 'lucide-react'
import { auth } from '@/firebase/config'
import { db } from '@/firebase/db'
import { getReservationServiceDefinitions } from '@/lib/walkServices'
import {
  buildServicePriceDocuments,
  createEmptyServicePrices,
  formatAmountCents,
  parseAdminServicePricesDocument,
  parseMxnInputToCents,
  ServicePriceConflictError,
  ServicePriceValidationError,
  type AdminServicePricesDocument,
  type PublicServicePrice,
} from '@/lib/servicePricing'
import { useSessionRole } from '@/lib/useSessionRole'
import { ROLES } from '@/lib/roles'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const DEFINITIONS = getReservationServiceDefinitions()

type LoadStatus = 'loading' | 'ready' | 'empty' | 'permission-denied' | 'network-error' | 'invalid' | 'conflict'
type Draft = { amountInput: string; active: boolean; complimentary: boolean }
type ChangePreview = { id: string; name: string; before: string; after: string }

function draftsFromDocument(document: AdminServicePricesDocument | null): Record<string, Draft> {
  const empty = createEmptyServicePrices(DEFINITIONS)
  return Object.fromEntries(DEFINITIONS.map((definition) => {
    const service = document?.services[definition.id] ?? empty[definition.id]
    return [definition.id, {
      amountInput: service.amountCents === null ? '' : (service.amountCents / 100).toFixed(2),
      active: service.active,
      complimentary: service.complimentary,
    }]
  }))
}

function classifyError(cause: unknown): { status: LoadStatus; message: string } {
  if (cause instanceof ServicePriceConflictError) return { status: 'conflict', message: 'Otra sesión actualizó los precios. Recarga antes de volver a guardar.' }
  if (cause instanceof ServicePriceValidationError) return { status: 'invalid', message: cause.message }
  const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
  if (code.includes('permission-denied')) return { status: 'permission-denied', message: 'Tu sesión no tiene permiso para administrar precios.' }
  return { status: 'network-error', message: 'No pudimos guardar la configuración. Revisa tu conexión.' }
}

export default function AdminServicePricing() {
  const session = useSessionRole([ROLES.ADMIN, ROLES.SUPERVISOR])
  const canEdit = session.status === 'ready' && session.role === ROLES.ADMIN
  const [document, setDocument] = useState<AdminServicePricesDocument | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => draftsFromDocument(null))
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [message, setMessage] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [changes, setChanges] = useState<ChangePreview[]>([])
  const [pendingServices, setPendingServices] = useState<Record<string, PublicServicePrice> | null>(null)
  const savingRef = useRef(false)
  const expectedVersionRef = useRef(0)

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'admin', 'prices'), (snapshot) => {
      if (!snapshot.exists()) {
        setDrafts(draftsFromDocument(null))
        setDocument(null)
        expectedVersionRef.current = 0
        setStatus('empty')
        return
      }
      const parsed = parseAdminServicePricesDocument(snapshot.data(), DEFINITIONS)
      if (!parsed) {
        setStatus('invalid')
        setMessage('La configuración existente no cumple el esquema esperado. No se modificó.')
        return
      }
      setDocument(parsed)
      setDrafts(draftsFromDocument(parsed))
      expectedVersionRef.current = parsed.version
      setDirty(false)
      setStatus('ready')
    }, (cause) => {
      const classified = classifyError(cause)
      setStatus(classified.status)
      setMessage(classified.message)
    })
    return unsubscribe
  }, [])

  const updateDraft = (id: string, update: Partial<Draft>) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...update } }))
    setDirty(true)
    setMessage('')
  }

  const buildNextServices = () => {
    const result: Record<string, PublicServicePrice> = {}
    for (const definition of DEFINITIONS) {
      const draft = drafts[definition.id]
      const amountCents = parseMxnInputToCents(draft.amountInput)
      result[definition.id] = {
        ...definition,
        amountCents,
        currency: 'MXN',
        active: amountCents === null ? false : draft.active,
        complimentary: amountCents === 0 ? draft.complimentary : false,
        version: document?.services[definition.id]?.version ?? 0,
      }
    }
    return result
  }

  const prepareSave = () => {
    try {
      const nextServices = buildNextServices()
      const preview = DEFINITIONS.flatMap((definition) => {
        const previous = document?.services[definition.id] ?? null
        const next = nextServices[definition.id]
        const changed = !previous
          || previous.amountCents !== next.amountCents
          || previous.active !== next.active
          || previous.complimentary !== next.complimentary
        return changed ? [{
          id: definition.id,
          name: definition.name,
          before: previous ? `${formatAmountCents(previous.amountCents, previous.complimentary)} · ${previous.active ? 'Activo' : 'Inactivo'}` : 'Sin configuración',
          after: `${formatAmountCents(next.amountCents, next.complimentary)} · ${next.active ? 'Activo' : 'Inactivo'}`,
        }] : []
      })
      if (preview.length === 0) {
        setMessage('No hay cambios pendientes.')
        return
      }
      setChanges(preview)
      setPendingServices(nextServices)
      setConfirmOpen(true)
    } catch (cause) {
      const classified = classifyError(cause)
      setStatus(classified.status)
      setMessage(classified.message)
    }
  }

  const save = async () => {
    if (savingRef.current || !canEdit || !pendingServices) return
    const user = auth.currentUser
    if (!user) {
      setMessage('Tu sesión terminó. Inicia sesión nuevamente.')
      return
    }
    savingRef.current = true
    setSaving(true)
    setMessage('')
    try {
      const adminRef = doc(db, 'admin', 'prices')
      const publicRef = doc(db, 'appSettings', 'servicePrices')
      await runTransaction(db, async (transaction) => {
        const currentSnapshot = await transaction.get(adminRef)
        const current = currentSnapshot.exists()
          ? parseAdminServicePricesDocument(currentSnapshot.data(), DEFINITIONS)
          : null
        if (currentSnapshot.exists() && !current) throw new ServicePriceValidationError('invalid-existing-document', 'La configuración actual no cumple el esquema esperado.')
        if ((current?.version ?? 0) !== expectedVersionRef.current) throw new ServicePriceConflictError()
        const documents = buildServicePriceDocuments({
          definitions: DEFINITIONS,
          previous: current,
          nextServices: pendingServices,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        })
        transaction.set(adminRef, documents.admin)
        transaction.set(publicRef, documents.public)
      })
      setConfirmOpen(false)
      setDirty(false)
      setStatus('ready')
      setMessage('Precios guardados correctamente.')
    } catch (cause) {
      const classified = classifyError(cause)
      setStatus(classified.status)
      setMessage(classified.message)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const reload = () => {
    setDirty(false)
    setDrafts(draftsFromDocument(document))
    expectedVersionRef.current = document?.version ?? 0
    setStatus(document ? 'ready' : 'empty')
    setMessage('Cambios locales descartados; se conserva la configuración remota.')
  }

  return (
    <section className="space-y-4" aria-labelledby="service-pricing-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="service-pricing-title" className="flex items-center gap-2 text-base font-bold text-ink"><CircleDollarSign size={19} className="text-primary" />Precios de servicios</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted">Importes en centavos y moneda MXN. Una solicitud conserva la versión del servicio, no un total confirmado.</p>
        </div>
        <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-muted">Versión {document?.version ?? 0}</span>
      </div>

      {status === 'loading' && <p className="rounded-xl bg-ink/5 p-4 text-sm text-muted" role="status">Consultando configuración de precios…</p>}
      {(status === 'permission-denied' || status === 'network-error' || status === 'invalid' || status === 'conflict') && (
        <div className="flex items-start gap-2 rounded-xl bg-danger-500/10 p-4 text-sm text-red-700" role="alert"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><div><p>{message}</p>{status === 'conflict' && <Button variant="secondary" className="mt-3 min-h-11" onClick={reload} leftIcon={<RefreshCw size={15} />}>Recargar</Button>}</div></div>
      )}
      {status === 'empty' && <p className="rounded-xl bg-warning/10 p-4 text-sm text-amber-900">Aún no existe configuración. Todos los servicios permanecen inactivos y sin importe.</p>}
      {message && status !== 'permission-denied' && status !== 'network-error' && status !== 'invalid' && status !== 'conflict' && (
        <p className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-sm text-success" role="status"><CheckCircle2 size={16} />{message}</p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {DEFINITIONS.map((definition) => {
          const draft = drafts[definition.id]
          const amountIsZero = draft.amountInput.trim() !== '' && (() => { try { return parseMxnInputToCents(draft.amountInput) === 0 } catch { return false } })()
          return (
            <Card key={definition.id} className="p-4 shadow-none motion-reduce:transition-none">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="font-semibold text-ink">{definition.name}</p><p className="text-xs text-muted">{definition.duration} · {definition.id}</p></div>
                <label className="flex min-h-11 items-center gap-2 text-sm text-ink"><input type="checkbox" checked={draft.active} disabled={!canEdit || !draft.amountInput.trim()} onChange={(event) => updateDraft(definition.id, { active: event.target.checked })} className="h-5 w-5" />Activo</label>
              </div>
              <label htmlFor={`price-${definition.id}`} className="mt-3 block text-sm font-medium text-ink">Importe MXN</label>
              <Input id={`price-${definition.id}`} inputMode="decimal" placeholder="Sin configurar" value={draft.amountInput} disabled={!canEdit} onChange={(event) => updateDraft(definition.id, { amountInput: event.target.value, active: event.target.value.trim() ? draft.active : false, complimentary: false })} className="mt-1 min-h-11" aria-describedby={`help-${definition.id}`} />
              <p id={`help-${definition.id}`} className="mt-1 text-xs text-muted">Vacío significa precio no configurado. No se convierte en cero.</p>
              {amountIsZero && <label className="mt-3 flex min-h-11 items-start gap-2 text-sm text-amber-900"><input type="checkbox" checked={draft.complimentary} disabled={!canEdit} onChange={(event) => updateDraft(definition.id, { complimentary: event.target.checked })} className="mt-1 h-5 w-5" />Confirmo que este servicio será una cortesía explícita.</label>}
            </Card>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted">Responsable: {auth.currentUser?.email || 'sesión administrativa'} · Moneda fija: MXN</p>
        <Button onClick={prepareSave} disabled={!canEdit || !dirty || saving || status === 'conflict' || status === 'invalid'} isLoading={saving} className="min-h-11 rounded-xl">Revisar y guardar</Button>
      </div>

      {!canEdit && session.status === 'ready' && <p className="text-sm text-muted">Supervisión dispone de lectura; solo Admin puede guardar cambios.</p>}

      <ConfirmDialog open={confirmOpen} title="Confirmar cambios de precios" description={`${changes.length} servicio(s) cambiarán. Revisa el detalle antes de confirmar.`} confirmLabel="Guardar precios" loading={saving} onCancel={() => setConfirmOpen(false)} onConfirm={() => void save()} />
      {confirmOpen && <div className="fixed inset-x-4 bottom-4 z-[calc(var(--z-modal)+1)] mx-auto max-w-sm rounded-xl border border-border bg-card p-3 shadow-lg" aria-live="polite"><p className="text-xs font-semibold text-ink">Resumen</p><ul className="mt-2 max-h-36 space-y-2 overflow-y-auto">{changes.map((change) => <li key={change.id} className="text-xs text-muted"><strong className="text-ink">{change.name}</strong><br />{change.before} → {change.after}</li>)}</ul><p className="mt-2 text-xs text-muted">Moneda: MXN · Responsable: {auth.currentUser?.email || 'sesión administrativa'}</p></div>}
    </section>
  )
}
