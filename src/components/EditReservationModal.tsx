'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { X } from 'lucide-react'
import type { Reservation } from '@/types'
import { SERVICE_NAMES, normalizeServiceName } from '@/lib/walkServices'
import { logAudit } from '@/lib/auditLog'
import { useEscapeKey } from '@/lib/useEscapeKey'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useToast } from '@/context/ToastContext'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

export default function EditReservationModal({
  isOpen,
  onClose,
  reservation,
  reservations = [],
}: {
  isOpen: boolean
  onClose: () => void
  reservation: Reservation | null
  reservations?: Reservation[]
}) {
  const [form, setForm] = useState({
    date: reservation?.date || '',
    time: reservation?.time || '',
    service: normalizeServiceName(reservation?.service || ''),
    notes: reservation?.notes || '',
    internalNotes: reservation?.internalNotes || '',
    assignedWalker: reservation?.assignedWalker || '',
    status: reservation?.status || 'pending',
  })
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const trapRef = useFocusTrap(isOpen)
  useEscapeKey(onClose, isOpen)

  const handleSave = async () => {
    if (!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED) {
      toast('Esta reserva pertenece al historial legacy y es de solo lectura.', 'error')
      return
    }
    if (!reservation) return
    if (!form.date || !form.time || !form.service) return
    setSaving(true)
    try {
      const changes: Record<string, { from: unknown; to: unknown }> = {}
      Object.keys(form).forEach((key) => {
        const fk = key as keyof typeof form
        const rv = (reservation as unknown as Record<string, unknown>)[key]
        if (form[fk] !== rv) {
          changes[key] = { from: rv, to: form[fk] }
        }
      })
      const updates: Record<string, unknown> = { ...form }
      if (form.status === "completed" && reservation.status !== "completed") {
        updates.completedAt = serverTimestamp()
      }
      await updateDoc(doc(db, "reservations", reservation.id), updates)
      if (Object.keys(changes).length > 0) {
        void logAudit({ action: 'update', entity: 'reservation', entityId: reservation.id, meta: changes })
      }
      onClose()
      toast('Reserva guardada')
    } catch { toast('Error al guardar reserva', 'error') }
    setSaving(false)
  }

  const conflictMessage = useMemo(() => {
    if (!form.date || !form.time || !form.service) return ''
    const conflict = reservations.find(
      (r) =>
        r.id !== reservation?.id &&
        r.date === form.date &&
        r.time === form.time &&
        r.status !== 'completed'
    )
    if (conflict) {
      return `⚠ Ya hay una reserva de ${conflict.name} para ${conflict.petName} el ${form.date} a las ${form.time}`
    }
    return ''
  }, [form.date, form.time, form.service, reservations, reservation?.id])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[var(--z-overlay)] bg-black/80 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-ink/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl shadow-primary/10"
          >
            <div className="flex items-center justify-between p-5 border-b border-ink/10">
              <h3 className="text-lg font-bold text-ink">Editar reserva</h3>
              <button onClick={onClose} className="w-11 h-11 rounded-full bg-ink/5 flex items-center justify-center text-muted hover:text-ink hover:bg-ink/10 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-res-date" className="block text-xs text-muted mb-1">Fecha</label>
                  <input
                    id="edit-res-date"
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="edit-res-time" className="block text-xs text-muted mb-1">Hora</label>
                  <input
                    id="edit-res-time"
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-res-service" className="block text-xs text-muted mb-1">Servicio</label>
                <select
                  id="edit-res-service"
                  value={form.service}
                  onChange={(e) => setForm({ ...form, service: e.target.value })}
                  className="w-full bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Seleccionar...</option>
                  {SERVICE_NAMES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {conflictMessage && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                   <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{conflictMessage}</p>
                </div>
              )}

              <div>
                <label htmlFor="edit-res-status" className="block text-xs text-muted mb-1">Estado</label>
                <select
                  id="edit-res-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                  className="w-full bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary"
                >
                  <option value="pending">Pendiente</option>
                  <option value="on_the_way">En camino</option>
                  <option value="in_progress">Paseando</option>
                  <option value="completed">Completada</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-res-notes" className="block text-xs text-muted mb-1">Notas del cliente</label>
                <textarea
                  id="edit-res-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="border-t border-ink/10 pt-4">
                <p className="text-xs text-primary mb-3 font-medium">🔒 Solo administrador</p>
                <div>
                  <label htmlFor="edit-res-internal-notes" className="block text-xs text-muted mb-1">Notas internas</label>
                  <textarea
                    id="edit-res-internal-notes"
                    value={form.internalNotes}
                    onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
                    rows={2}
                    placeholder="Notas privadas (solo visible en el panel)..."
                    className="w-full bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary resize-none placeholder:text-muted"
                  />
                </div>
                <div className="mt-3">
                  <p className="block text-xs text-muted mb-1">Paseador asignado</p>
                  <p className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink">
                    {form.assignedWalker || 'Sin asignar'}
                  </p>
                  {/* El desplegable salía de un registro viejo en la configuración.
                      Las asignaciones reales se hacen en Solicitudes canónicas. */}
                  <p className="text-2xs mt-1 text-muted">
                    Este historial es de solo lectura. Las asignaciones se hacen en Solicitudes canónicas.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-5 border-t border-ink/10">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm text-muted hover:text-ink border border-ink/10 hover:border-ink/20 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.date || !form.time || !form.service || !FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-amber-600 text-white hover:opacity-90 transition-all disabled:opacity-50"
                title={FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED ? undefined : 'Esta reserva pertenece al historial legacy y es de solo lectura'}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
