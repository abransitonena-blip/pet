'use client'

import { useState, useMemo } from 'react'
import { db } from '@/firebase/config'
import { doc, updateDoc } from 'firebase/firestore'
import { FaWalking, FaUser, FaPhone, FaCalendarAlt, FaDog, FaWhatsapp, FaSpinner } from 'react-icons/fa'
import { useConfig } from '@/context/ConfigContext'
import { useReservations } from '@/context/ReservationsContext'
import { useToast } from '@/context/ToastContext'
import type { Reservation } from '@/types'

interface WalkerStats {
  name: string
  phone: string
  totalAssigned: number
  completed: number
  inProgress: number
  thisWeek: number
  lastAssignment: string
}

export default function AdminPaseadoresPage() {
  const { config, updateConfig, saving } = useConfig()
  const { reservations, loading } = useReservations()
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [adding, setAdding] = useState(false)
  const { toast } = useToast()

  const walkerStats: WalkerStats[] = useMemo(() => {
    const walkers = config.walkers || []
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

    return walkers.map((w) => {
      const assigned = reservations.filter((r) => r.assignedWalker === w.name)
      return {
        name: w.name,
        phone: w.phone,
        totalAssigned: assigned.length,
        completed: assigned.filter((r) => r.status === 'completed').length,
        inProgress: assigned.filter((r) => r.status === 'en_camino' || r.status === 'paseando').length,
        thisWeek: assigned.filter((r) => r.date >= weekAgo).length,
        lastAssignment: assigned[0]?.date || 'Nunca',
      }
    })
  }, [reservations, config.walkers])

  const handleAddWalker = async () => {
    if (!newName.trim() || !newPhone.trim()) return
    setAdding(true)
    try {
      const updatedWalkers = [...(config.walkers || []), { name: newName.trim(), phone: newPhone.trim() }]
      await updateConfig({ walkers: updatedWalkers })
      setNewName('')
      setNewPhone('')
      toast('Paseador agregado')
    } catch { toast('Error al agregar paseador', 'error') }
    setAdding(false)
  }

  const handleRemoveWalker = async (index: number) => {
    try {
      const updatedWalkers = (config.walkers || []).filter((_, i) => i !== index)
      await updateConfig({ walkers: updatedWalkers })
      toast('Paseador eliminado')
    } catch { toast('Error al eliminar paseador', 'error') }
  }

  const openWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    window.open(`https://wa.me/52${cleaned}?text=Hola, soy de PET Ap 🐾`, '_blank')
  }

  const unassignedToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return reservations.filter((r) => r.date === today && !r.assignedWalker && r.status !== 'completed' && r.status !== 'cancelled').length
  }, [reservations])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Gestión de Paseadores</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {(config.walkers || []).length} paseadores · {unassignedToday} reservas sin asignar hoy
        </p>
      </div>

      {/* Add new walker */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Agregar paseador</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Nombre"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input-field flex-1"
          />
          <input
            type="tel"
            placeholder="Teléfono"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            className="input-field flex-1"
          />
          <button
            onClick={handleAddWalker}
            disabled={!newName.trim() || !newPhone.trim() || adding}
            className="btn-primary !text-xs flex items-center gap-1.5 shrink-0"
          >
            {adding ? <FaSpinner className="animate-spin" size={10} /> : <FaUser size={10} />}
            Agregar
          </button>
        </div>
      </div>

      {/* Walker cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : walkerStats.length === 0 ? (
        <div className="text-center py-16">
          <FaWalking className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay paseadores registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {walkerStats.map((w) => (
            <div
              key={w.name}
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-blue-500 to-blue-600">
                    <FaWalking className="text-white" size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
                      {w.inProgress > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">
                          En paseo
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>📞 {w.phone}</span>
                      <span>📋 {w.totalAssigned} asignadas</span>
                      <span>✅ {w.completed} completadas</span>
                      <span>📅 Esta semana: {w.thisWeek}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => openWhatsApp(w.phone)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-success-500/10 text-success-400"
                    title="WhatsApp"
                  >
                    <FaWhatsapp size={13} />
                  </button>
                  <button
                    onClick={() => handleRemoveWalker(walkerStats.indexOf(w))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-danger-500/10 text-danger-400"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
                  <span>Completadas</span>
                  <span>{w.totalAssigned > 0 ? Math.round((w.completed / w.totalAssigned) * 100) : 0}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                  <div
                    className="h-full rounded-full bg-success-500 transition-all"
                    style={{ width: `${w.totalAssigned > 0 ? (w.completed / w.totalAssigned) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
