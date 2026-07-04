'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { FaTimes } from 'react-icons/fa'

const SERVICES = [
  'Paseo Individual - $120',
  'Paseo Grupal - $80',
  'Paseo Premium - $200',
  'Individual Semanal (5 días) - $500',
  'Grupal Semanal (5 días) - $350',
  'Premium Semanal (5 días) - $900',
  'Individual Mensual (20 días) - $1,800',
  'Premium Mensual (20 días) - $3,500',
]

export default function EditReservationModal({
  isOpen,
  onClose,
  reservation,
}: {
  isOpen: boolean
  onClose: () => void
  reservation: any
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

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates: any = { ...form }
      if (form.status === 'completed' && reservation?.status !== 'completed') {
        updates.completedAt = serverTimestamp()
      }
      await updateDoc(doc(db, 'reservations', reservation.id), updates)
      onClose()
    } catch {}
    setSaving(false)
  }

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
                  {SERVICES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

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
