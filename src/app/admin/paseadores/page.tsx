'use client'

import { useState, useMemo, useEffect } from 'react'
import { db } from '@/firebase/config'
import {
  doc, updateDoc, collection, query, onSnapshot, where,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FaWalking, FaUser, FaPhone, FaDog, FaWhatsapp, FaSpinner, FaPlus, FaTimes,
  FaCalendarAlt, FaClock, FaMapMarkedAlt, FaChartBar, FaEdit, FaCheck, FaEnvelope, FaKey,
} from 'react-icons/fa'
import { useConfig } from '@/context/ConfigContext'
import { useReservations } from '@/context/ReservationsContext'
import { useToast } from '@/context/ToastContext'
import type { Reservation, Zone } from '@/types'

const DAYS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']
const DAY_LABELS: Record<string, string> = {
  lun: 'Lunes', mar: 'Martes', mie: 'Miércoles', jue: 'Jueves', vie: 'Viernes', sab: 'Sábado', dom: 'Domingo',
}

interface WalkerConfig {
  name: string
  phone: string
  email: string
  uid?: string
  status?: 'invited' | 'active' | 'suspended'
  zones: string[]
  maxDaily: number
  maxWeekly: number
  schedule: Record<string, { start: string; end: string }[]>
}

interface WalkerStats {
  name: string
  phone: string
  totalAssigned: number
  completed: number
  inProgress: number
  todayAssigned: number
  todayCompleted: number
  thisWeek: number
  lastAssignment: string
}

const EMPTY_WALKER: WalkerConfig = {
  name: '',
  phone: '',
  email: '',
  zones: [],
  maxDaily: 8,
  maxWeekly: 40,
  schedule: {},
}

export default function AdminPaseadoresPage() {
  const { config, updateConfig, saving } = useConfig()
  const { reservations, loading } = useReservations()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState<WalkerConfig>(EMPTY_WALKER)
  const [zones, setZones] = useState<Zone[]>([])
  const [expandedWalker, setExpandedWalker] = useState<string | null>(null)
  const [creatingAccount, setCreatingAccount] = useState<number | null>(null)
  const [tempPassword, setTempPassword] = useState<{ index: number; password: string } | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const q = query(collection(db, 'zones'), where('active', '==', true))
    return onSnapshot(q, (snap) => {
      setZones(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Zone)))
    })
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  const walkerStats: WalkerStats[] = useMemo(() => {
    const walkers = (config.walkers || []) as WalkerConfig[]
    return walkers.map((w) => {
      // Match by name (legacy) OR by uid (new auto-assign)
      const assigned = reservations.filter((r) => 
        r.assignedWalker === w.name || 
        r.assignment?.walkerId === w.uid
      )
      return {
        name: w.name,
        phone: w.phone,
        totalAssigned: assigned.length,
        completed: assigned.filter((r) => r.status === 'completed').length,
        inProgress: assigned.filter((r) => r.status === 'en_camino' || r.status === 'paseando' || r.status === 'assigned').length,
        todayAssigned: assigned.filter((r) => r.date === today).length,
        todayCompleted: assigned.filter((r) => r.date === today && r.status === 'completed').length,
        thisWeek: assigned.filter((r) => r.date >= weekAgo).length,
        lastAssignment: assigned[0]?.date || 'Nunca',
      }
    })
  }, [reservations, config.walkers])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_WALKER)
    setShowForm(true)
  }

  const openEdit = (index: number) => {
    const walker = (config.walkers || [])[index] as WalkerConfig | undefined
    if (!walker) return
    setEditing(index)
    setForm({
      name: walker.name || '',
      phone: walker.phone || '',
      email: walker.email || '',
      zones: walker.zones || [],
      maxDaily: walker.maxDaily || 8,
      maxWeekly: walker.maxWeekly || 40,
      schedule: walker.schedule || {},
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) return
    try {
      const walkers = [...(config.walkers || [])] as WalkerConfig[]
      const data = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        zones: form.zones,
        maxDaily: form.maxDaily,
        maxWeekly: form.maxWeekly,
        schedule: form.schedule,
      }

      if (editing !== null) {
        walkers[editing] = { ...walkers[editing], ...data }
      } else {
        walkers.push({ ...data, status: 'invited' })
      }
      await updateConfig({ walkers })
      setShowForm(false)
      setEditing(null)
      setForm(EMPTY_WALKER)
      toast(editing !== null ? 'Paseador actualizado' : 'Paseador agregado')
    } catch {
      toast('Error al guardar paseador', 'error')
    }
  }

  const handleCreateAccount = async (index: number) => {
    const walker = (config.walkers || [])[index] as WalkerConfig | undefined
    if (!walker?.email) {
      toast('El paseador necesita un correo electrónico', 'error')
      return
    }
    setCreatingAccount(index)
    try {
      const createAccount = httpsCallable(functions, 'createWalkerAccount')
      const result = await createAccount({
        email: walker.email,
        name: walker.name,
        phone: walker.phone,
        zones: walker.zones,
        maxDaily: walker.maxDaily,
        maxWeekly: walker.maxWeekly,
        schedule: walker.schedule,
      })

      const { uid, tempPassword } = result.data as { uid: string; tempPassword: string }

      // Update walker config with uid and status
      const walkers = [...(config.walkers || [])] as WalkerConfig[]
      walkers[index] = { ...walkers[index], uid, status: 'active' }
      await updateConfig({ walkers })

      setTempPassword({ index, password: tempPassword })
      toast('Cuenta creada exitosamente')
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : ''
      if (msg.includes('already-exists')) {
        toast('Este correo ya está registrado', 'error')
      } else {
        toast('Error al crear cuenta: ' + (msg || 'Error desconocido'), 'error')
      }
    }
    setCreatingAccount(null)
  }

  const handleRemove = async (index: number) => {
    try {
      const walkers = (config.walkers || []).filter((_: unknown, i: number) => i !== index)
      await updateConfig({ walkers })
      toast('Paseador eliminado')
    } catch {
      toast('Error al eliminar paseador', 'error')
    }
  }

  const toggleScheduleDay = (day: string) => {
    setForm((prev) => {
      const schedule = { ...prev.schedule }
      if (schedule[day]) {
        delete schedule[day]
      } else {
        schedule[day] = [{ start: '09:00', end: '17:00' }]
      }
      return { ...prev, schedule }
    })
  }

  const updateScheduleTime = (day: string, idx: number, field: 'start' | 'end', val: string) => {
    setForm((prev) => {
      const schedule = { ...prev.schedule }
      const slots = [...(schedule[day] || [])]
      slots[idx] = { ...slots[idx], [field]: val }
      schedule[day] = slots
      return { ...prev, schedule }
    })
  }

  const openWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    window.open(`https://wa.me/52${cleaned}?text=Hola, soy de PET Ap 🐾`, '_blank')
  }

  const unassignedToday = useMemo(() => {
    return reservations.filter((r) => r.date === today && !r.assignedWalker && r.status !== 'completed' && r.status !== 'cancelled').length
  }, [reservations, today])

  const todayTotal = useMemo(() => {
    return reservations.filter((r) => r.date === today && r.status !== 'cancelled').length
  }, [reservations])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Gestión de Paseadores</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {(config.walkers || []).length} paseadores · {unassignedToday} sin asignar hoy · {todayTotal} reservas hoy
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary !text-xs inline-flex gap-2">
          <FaPlus size={12} /> Agregar paseador
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      ) : walkerStats.length === 0 ? (
        <div className="text-center py-16">
          <FaWalking className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay paseadores registrados</p>
          <button onClick={openCreate} className="btn-primary !text-xs mt-4 inline-flex gap-2">
            <FaPlus size={12} /> Agregar primer paseador
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {walkerStats.map((w, i) => {
            const walkerConfig = (config.walkers || [])[i] as WalkerConfig | undefined
            const isExpanded = expandedWalker === w.name
            const dailyLoad = w.todayAssigned
            const dailyMax = walkerConfig?.maxDaily || 8
            const dailyPercent = dailyMax > 0 ? Math.round((dailyLoad / dailyMax) * 100) : 0
            const weeklyLoad = w.thisWeek
            const weeklyMax = walkerConfig?.maxWeekly || 40
            const weeklyPercent = weeklyMax > 0 ? Math.round((weeklyLoad / weeklyMax) * 100) : 0

            return (
              <div
                key={w.name}
                className="rounded-xl overflow-hidden transition-all"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                {/* Main Row */}
                <div className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-blue-500 to-blue-600">
                        <FaWalking className="text-white" size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
                          {walkerConfig?.uid ? (
                            <span className="text-2xs px-2 py-0.5 rounded-full bg-success-500/15 text-success-400 font-medium">Activo</span>
                          ) : (
                            <span className="text-2xs px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400 font-medium">Invitado</span>
                          )}
                          {w.inProgress > 0 && (
                            <span className="text-2xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">
                              {w.inProgress} en paseo
                            </span>
                          )}
                          {dailyPercent >= 90 && (
                            <span className="text-2xs px-2 py-0.5 rounded-full bg-danger-500/15 text-danger-400 font-medium">
                              Carga alta
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {walkerConfig?.email && <span className="flex items-center gap-1"><FaEnvelope size={9} /> {walkerConfig.email}</span>}
                          <span className="flex items-center gap-1"><FaPhone size={9} /> {w.phone}</span>
                          <span className="flex items-center gap-1"><FaCalendarAlt size={9} /> {w.todayAssigned}/{dailyMax} hoy</span>
                          <span className="flex items-center gap-1"><FaChartBar size={9} /> {w.thisWeek}/{weeklyMax} semana</span>
                        </div>
                        {walkerConfig?.zones && walkerConfig.zones.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {walkerConfig.zones.map((z) => (
                              <span key={z} className="text-2xs px-2 py-0.5 rounded-full bg-success-500/10 text-success-400 flex items-center gap-1">
                                <FaMapMarkedAlt size={7} /> {z}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!walkerConfig?.uid && walkerConfig?.email && (
                        <button
                          onClick={() => handleCreateAccount(i)}
                          disabled={creatingAccount === i}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-accent-500/10 text-accent-400"
                          title="Crear cuenta de acceso"
                        >
                          {creatingAccount === i ? <FaSpinner className="animate-spin" size={12} /> : <FaKey size={12} />}
                        </button>
                      )}
                      <button onClick={() => setExpandedWalker(isExpanded ? null : w.name)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }} title="Detalles">
                        <FaChartBar size={13} />
                      </button>
                      <button onClick={() => openEdit(i)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }} title="Editar">
                        <FaEdit size={12} />
                      </button>
                      <button onClick={() => openWhatsApp(w.phone)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-success-500/10 text-success-400" title="WhatsApp">
                        <FaWhatsapp size={13} />
                      </button>
                      <button onClick={() => handleRemove(i)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-danger-500/10 text-danger-400" title="Eliminar">
                        <FaTimes size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Load Bars */}
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between text-2xs mb-1" style={{ color: 'var(--text-muted)' }}>
                        <span>Hoy</span>
                        <span>{dailyLoad}/{dailyMax}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(dailyPercent, 100)}%`, background: dailyPercent >= 90 ? 'var(--color-danger)' : dailyPercent >= 70 ? 'var(--color-warning)' : 'var(--color-success)' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-2xs mb-1" style={{ color: 'var(--text-muted)' }}>
                        <span>Semana</span>
                        <span>{weeklyLoad}/{weeklyMax}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(weeklyPercent, 100)}%`, background: weeklyPercent >= 90 ? 'var(--color-danger)' : weeklyPercent >= 70 ? 'var(--color-warning)' : 'var(--color-success)' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded: Schedule & Stats */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                        {/* Schedule */}
                        {walkerConfig?.schedule && Object.keys(walkerConfig.schedule).length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Horario semanal</p>
                            <div className="grid grid-cols-7 gap-1">
                              {DAYS.map((day) => {
                                const slots = walkerConfig.schedule?.[day]
                                const hasSlots = slots && slots.length > 0
                                return (
                                  <div key={day} className="text-center">
                                    <p className="text-2xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{DAY_LABELS[day].slice(0, 2)}</p>
                                    <div className={`rounded-lg py-1.5 text-2xs ${hasSlots ? 'bg-success-500/10 text-success-400' : 'bg-white/5 text-white/20'}`}>
                                      {hasSlots ? `${slots[0].start.slice(0, 5)}` : '—'}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin horario configurado</p>
                        )}

                        {/* Performance */}
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: 'Total', value: w.totalAssigned },
                            { label: 'Completados', value: w.completed },
                            { label: 'En progreso', value: w.inProgress },
                            { label: 'Última', value: 0, display: w.lastAssignment },
                          ].map((s) => (
                            <div key={s.label} className="text-center rounded-lg py-2" style={{ background: 'var(--glass-bg)' }}>
                              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{s.display || s.value}</p>
                              <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {editing !== null ? 'Editar paseador' : 'Nuevo paseador'}
                </h2>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                  <FaTimes size={14} />
                </button>
              </div>

              {/* Name, Phone & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Nombre</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre completo" className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Teléfono</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10 dígitos" className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  <FaEnvelope size={10} className="inline mr-1" />
                  Correo electrónico (para acceso)
                </label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="paseador@petap.com" className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                {!editing && <p className="text-2xs mt-1" style={{ color: 'var(--text-muted)' }}>Se usará para crear la cuenta de acceso del paseador</p>}
              </div>

              {/* Zones */}
              <div>
                <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>Zonas asignadas</label>
                <div className="flex flex-wrap gap-2">
                  {zones.length === 0 ? (
                    <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>No hay zonas configuradas</p>
                  ) : (
                    zones.map((z) => {
                      const selected = form.zones.includes(z.name)
                      return (
                        <button key={z.id} type="button" onClick={() => setForm({ ...form, zones: selected ? form.zones.filter((n) => n !== z.name) : [...form.zones, z.name] })} className="text-2xs px-3 py-1.5 rounded-full border font-medium transition-all" style={{ background: selected ? 'var(--color-success-light)' : 'var(--glass-bg)', borderColor: selected ? 'var(--color-success)' : 'var(--border)', color: selected ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                          {selected && <FaCheck size={7} className="inline mr-1" />}
                          {z.name}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Capacity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Máx. diario</label>
                  <input type="number" min="1" max="20" value={form.maxDaily} onChange={(e) => setForm({ ...form, maxDaily: parseInt(e.target.value) || 8 })} className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Máx. semanal</label>
                  <input type="number" min="1" max="100" value={form.maxWeekly} onChange={(e) => setForm({ ...form, maxWeekly: parseInt(e.target.value) || 40 })} className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>

              {/* Schedule */}
              <div>
                <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>Horario semanal</label>
                <div className="space-y-2">
                  {DAYS.map((day) => {
                    const isActive = !!form.schedule[day]
                    return (
                      <div key={day} className="flex items-center gap-2">
                        <button type="button" onClick={() => toggleScheduleDay(day)} className={`w-20 text-2xs px-2 py-1.5 rounded-lg border font-medium transition-all text-left ${isActive ? 'border-success-500/30 bg-success-500/10 text-success-400' : ''}`} style={!isActive ? { borderColor: 'var(--border)', color: 'var(--text-muted)' } : {}}>
                          {DAY_LABELS[day].slice(0, 3)}
                        </button>
                        {isActive && form.schedule[day]?.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-1 flex-1">
                            <input type="time" value={slot.start} onChange={(e) => updateScheduleTime(day, idx, 'start', e.target.value)} className="flex-1 text-xs px-2 py-1.5 rounded-lg border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                            <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>—</span>
                            <input type="time" value={slot.end} onChange={(e) => updateScheduleTime(day, idx, 'end', e.target.value)} className="flex-1 text-xs px-2 py-1.5 rounded-lg border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                          </div>
                        ))}
                        {!isActive && <span className="text-2xs flex-1" style={{ color: 'var(--text-muted)' }}>No disponible</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.phone.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-40">
                  {saving ? <FaSpinner className="animate-spin" size={14} /> : <FaCheck size={14} />}
                  {editing !== null ? 'Guardar' : 'Agregar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Temp Password Modal */}
      <AnimatePresence>
        {tempPassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setTempPassword(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl p-5 space-y-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-success-500/10 flex items-center justify-center mx-auto mb-3">
                  <FaKey size={20} className="text-success-400" />
                </div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Cuenta creada</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Comparte estas credenciales con el paseador de forma segura
                </p>
              </div>
              <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                <div>
                  <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>Correo</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {(config.walkers || [])[tempPassword.index]?.email}
                  </p>
                </div>
                <div>
                  <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>Contraseña temporal</p>
                  <p className="text-sm font-mono font-bold" style={{ color: 'var(--color-primary)' }}>
                    {tempPassword.password}
                  </p>
                </div>
              </div>
              <p className="text-2xs text-center" style={{ color: 'var(--text-muted)' }}>
                El paseador deberá cambiar esta contraseña en su primer inicio de sesión
              </p>
              <button
                onClick={() => setTempPassword(null)}
                className="w-full py-2.5 rounded-xl text-sm font-medium btn-primary"
              >
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
