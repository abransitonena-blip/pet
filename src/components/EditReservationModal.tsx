'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { FaTimes } from 'react-icons/fa'
import type { Reservation } from '@/types'
import { SERVICE_NAMES } from '@/lib/services'
import { logChange } from '@/lib/audit'
import { useEscapeKey } from '@/lib/useEscapeKey'

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
    service: reservation?.service || '',
    notes: reservation?.notes || '',
    internalNotes: reservation?.internalNotes || '',
    assignedWalker: reservation?.assignedWalker || '',
    status: reservation?.status || 'pending',
  })
  const [saving, setSaving] = useState(false)
  useEscapeKey(onClose, isOpen)

  const handleSave = async () => {
    if (!reservation) return
    setSaving(true)
    try {
      const changes: Record<string, any> = {}
      Object.keys(form).forEach((key) => {
        if ((form as any)[key] !== (reservation as any)[key]) {
          changes[key] = { from: (reservation as any)[key], to: (form as any)[key] }
        }
      })
      const updates: any = { ...form }
      if (form.status === "completed" && reservation.status !== "completed") {
        updates.completedAt = serverTimestamp()
      }
      await updateDoc(doc(db, "reservations", reservation.id), updates)
      if (Object.keys(changes).length > 0) {
        logChange("edit", reservation.id, changes)
      }
      onClose()
    } catch {}
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
          className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-dark-card border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl shadow-primary/10"
          >
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="text-lg font-bold text-white">Editar reserva</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all">
                <FaTimes size={12} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Fecha</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Hora</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-1">Servicio</label>
                <select
                  value={form.service}
                  onChange={(e) => setForm({ ...form, service: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Seleccionar...</option>
                  {SERVICE_NAMES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {conflictMessage && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-xs text-red-400">{conflictMessage}</p>
                </div>
              )}

              <div>
                <label className="block text-xs text-white/40 mb-1">Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                >
                  <option value="pending">Pendiente</option>
                  <option value="en_camino">En camino</option>
                  <option value="paseando">Paseando</option>
                  <option value="completed">Completada</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-1">Notas del cliente</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="border-t border-white/5 pt-4">
                <p className="text-xs text-primary mb-3 font-medium">🔒 Solo administrador</p>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Notas internas</label>
                  <textarea
                    value={form.internalNotes}
                    onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
                    rows={2}
                    placeholder="Notas privadas (solo visible en el panel)..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary resize-none placeholder:text-white/20"
                  />
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-white/40 mb-1">Paseador asignado</label>
                  <input
                    type="text"
                    value={form.assignedWalker}
                    onChange={(e) => setForm({ ...form, assignedWalker: e.target.value })}
                    placeholder="Nombre del paseador..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary placeholder:text-white/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-5 border-t border-white/5">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm text-white/50 hover:text-white border border-white/10 hover:border-white/20 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-amber-600 text-white hover:opacity-90 transition-all disabled:opacity-50"
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
