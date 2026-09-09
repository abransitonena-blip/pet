'use client'

import { useState, useMemo, useEffect } from 'react'
import { db } from '@/firebase/config'
import {
  collection, query, onSnapshot, where, limit,
} from 'firebase/firestore'
import { motion, AnimatePresence } from 'framer-motion'
import { PersonStanding, Phone, Plus, X,
  CalendarDays, MapPinned, ChartBar, Pencil, Check, Mail } from 'lucide-react'
import { useConfig } from '@/context/ConfigContext'
import { useReservations } from '@/context/ReservationsContext'
import { useToast } from '@/context/ToastContext'
import PageHeader from '@/components/ui/PageHeader'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import TeamProvisionPanel from '@/components/admin/TeamProvisionPanel'
import { setWalkerStatus } from '@/lib/adminWalkers'
import type { Zone } from '@/types'
import { confirmWhatsAppShare } from '@/lib/utils'

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
  uid?: string
  status: 'active' | 'inactive' | 'suspended' | 'legacy-invited'
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
  const [walkerProfiles, setWalkerProfiles] = useState<Array<{ uid: string; name: string; email: string; phone: string; status: string }>>([])
  const [profileError, setProfileError] = useState('')
  const [expandedWalker, setExpandedWalker] = useState<string | null>(null)
  const [changingStatus, setChangingStatus] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const q = query(collection(db, 'zones'), where('active', '==', true), limit(100))
    return onSnapshot(q, (snap) => {
      setZones(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Zone)))
    })
  }, [])

  useEffect(() => {
    const profilesQuery = query(collection(db, 'walkerProfiles'), limit(100))
    return onSnapshot(profilesQuery, (snapshot) => {
      setWalkerProfiles(snapshot.docs.map((item) => ({
        uid: item.id,
        name: String(item.data().name || 'Paseador'),
        email: String(item.data().email || ''),
        phone: String(item.data().phone || ''),
        status: String(item.data().status || 'inactive'),
      })))
      setProfileError('')
    }, () => setProfileError('No pudimos consultar los perfiles canónicos de paseadores.'))
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  const walkerStats: WalkerStats[] = useMemo(() => {
    const walkers = (config.walkers || []) as WalkerConfig[]
    return walkers.map((w) => {
      // Email matching is only a read-only bridge to locate the canonical UID;
      // authorization and assignments continue to use the walker profile document ID.
      const canonical = walkerProfiles.find((profile) => profile.uid === w.uid)
        || walkerProfiles.find((profile) => profile.email && profile.email === w.email)
      const canonicalUid = canonical?.uid || w.uid
      const assigned = reservations.filter((r) => 
        r.assignment?.walkerId === canonicalUid
      )
      return {
        uid: canonicalUid,
        status: canonical ? (canonical.status as WalkerStats['status']) : 'legacy-invited',
        name: canonical?.name || w.name,
        phone: canonical?.phone || w.phone,
        totalAssigned: assigned.length,
        completed: assigned.filter((r) => r.status === 'completed').length,
        inProgress: assigned.filter((r) => r.status === 'on_the_way' || r.status === 'in_progress' || r.status === 'assigned').length,
        todayAssigned: assigned.filter((r) => r.date === today).length,
        todayCompleted: assigned.filter((r) => r.date === today && r.status === 'completed').length,
        thisWeek: assigned.filter((r) => r.date >= weekAgo).length,
        lastAssignment: assigned[0]?.date || 'Nunca',
      }
    })
  }, [reservations, config.walkers, walkerProfiles])

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

  /**
   * Activar o suspender un paseador ya vinculado. Las reglas de Firestore
   * exigen `walkerProfiles/{uid}.status == 'active'` tanto para asignarle un
   * paseo como para que él mueva su estado, así que este interruptor es lo
   * que realmente habilita a la persona para trabajar.
   */
  const handleStatusChange = async (uid: string, status: 'active' | 'inactive' | 'suspended') => {
    setChangingStatus(uid)
    try {
      await setWalkerStatus(uid, status)
      toast(status === 'active' ? 'Paseador activado' : status === 'suspended' ? 'Paseador suspendido' : 'Paseador desactivado')
    } catch {
      toast('No pudimos cambiar el estado del paseador', 'error')
    } finally {
      setChangingStatus(null)
    }
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
    confirmWhatsAppShare(`52${cleaned}`, 'Hola, soy de PET Ap. Solicito ponerme en contacto contigo.')
  }

  const unassignedToday = useMemo(() => {
    return reservations.filter((r) => r.date === today && !r.assignedWalker && r.status !== 'completed' && r.status !== 'cancelled').length
  }, [reservations, today])

  const todayTotal = useMemo(() => {
    return reservations.filter((r) => r.date === today && r.status !== 'cancelled').length
  }, [reservations])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Paseadores"
        description={`${(config.walkers || []).length} paseadores · ${unassignedToday} sin asignar hoy · ${todayTotal} reservas hoy`}
        actions={
          <Button size="sm" onClick={openCreate} leftIcon={<Plus size={12} />}>
            Agregar paseador
          </Button>
        }
      />

      {profileError && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger" role="alert">{profileError}</p>}

      <TeamProvisionPanel zones={zones} />

      {loading ? (
        <LoadingState rows={3} height="h-32" />
      ) : walkerStats.length === 0 ? (
        <EmptyState
          icon={<PersonStanding size={24} />}
          title="No hay paseadores registrados"
          action={
            <Button size="sm" onClick={openCreate} leftIcon={<Plus size={12} />}>
              Agregar primer paseador
            </Button>
          }
        />
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
                key={w.uid || `legacy-${w.name}`}
                className="rounded-xl border border-ink/10 bg-surface shadow-sm overflow-hidden transition-all"
              >
                {/* Main Row */}
                <div className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-blue-500 to-blue-600">
                        <PersonStanding className="text-white" size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
                          {w.status === 'active' ? (
                            <span className="text-2xs px-2 py-0.5 rounded-full bg-success-500/15 text-success-600 font-medium">Activo</span>
                          ) : w.status === 'suspended' ? (
                            <span className="text-2xs px-2 py-0.5 rounded-full bg-danger-500/15 text-red-700 font-medium">Suspendido</span>
                          ) : w.status === 'inactive' ? (
                            <span className="text-2xs px-2 py-0.5 rounded-full bg-ink/10 text-muted font-medium">Inactivo</span>
                          ) : (
                            <span className="text-2xs px-2 py-0.5 rounded-full bg-warning/10 text-amber-800 font-medium">Registro legacy sin vincular</span>
                          )}
                          {w.inProgress > 0 && (
                            <span className="text-2xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">
                              {w.inProgress} en paseo
                            </span>
                          )}
                          {dailyPercent >= 90 && (
                            <span className="text-2xs px-2 py-0.5 rounded-full bg-danger-500/15 text-red-700 font-medium">
                              Carga alta
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {walkerConfig?.email && <span className="flex items-center gap-1"><Mail size={9} /> {walkerConfig.email}</span>}
                          <span className="flex items-center gap-1"><Phone size={9} /> {w.phone}</span>
                          <span className="flex items-center gap-1"><CalendarDays size={9} /> {w.todayAssigned}/{dailyMax} hoy</span>
                          <span className="flex items-center gap-1"><ChartBar size={9} /> {w.thisWeek}/{weeklyMax} semana</span>
                        </div>
                        {walkerConfig?.zones && walkerConfig.zones.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {walkerConfig.zones.map((z) => (
                              <span key={z} className="text-2xs px-2 py-0.5 rounded-full bg-success-500/10 text-success-400 flex items-center gap-1">
                                <MapPinned size={7} /> {z}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {w.uid && (
                        <select
                          value={w.status === 'legacy-invited' ? 'inactive' : w.status}
                          onChange={(event) => void handleStatusChange(w.uid as string, event.target.value as 'active' | 'inactive' | 'suspended')}
                          disabled={changingStatus === w.uid}
                          aria-label={`Estado operativo de ${w.name}`}
                          className="h-11 rounded-xl border border-ink/10 bg-surface px-2 text-2xs font-medium text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <option value="active">Activo</option>
                          <option value="inactive">Inactivo</option>
                          <option value="suspended">Suspendido</option>
                        </select>
                      )}
                      <button onClick={() => setExpandedWalker(isExpanded ? null : w.name)} className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ color: 'var(--text-muted)' }} title="Detalles" aria-label={`Ver detalles de ${w.name}`}>
                        <ChartBar size={13} />
                      </button>
                      <button onClick={() => openEdit(i)} className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ color: 'var(--text-muted)' }} title="Editar" aria-label={`Editar ${w.name}`}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => openWhatsApp(w.phone)} className="flex h-11 w-11 items-center justify-center rounded-xl text-success-400 transition-colors hover:bg-success-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" title="WhatsApp" aria-label={`Contactar a ${w.name} por WhatsApp`}>
                        <WhatsAppIcon width={13} height={13} />
                      </button>
                      <button onClick={() => handleRemove(i)} className="flex h-11 w-11 items-center justify-center rounded-xl text-danger-400 transition-colors hover:bg-danger-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500" title="Eliminar" aria-label={`Retirar registro legacy de ${w.name}`}>
                        <X size={12} />
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
                      <div className="border-t border-ink/10 px-4 pb-4 pt-2 space-y-3">
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
                                    <div className={`rounded-lg py-1.5 text-2xs ${hasSlots ? 'bg-success-500/10 text-success-400' : 'bg-ink/5 text-muted'}`}>
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
              className="w-full max-w-md rounded-xl border border-ink/10 bg-surface p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {editing !== null ? 'Editar paseador' : 'Nuevo paseador'}
                </h2>
                <Button variant="icon" onClick={() => setShowForm(false)} aria-label="Cerrar formulario">
                  <X size={14} />
                </Button>
              </div>

              {/* Name, Phone & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="walker-name" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Nombre</label>
                  <input id="walker-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre completo" className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label htmlFor="walker-phone" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Teléfono</label>
                  <input id="walker-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10 dígitos" className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div>
                <label htmlFor="walker-email" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  <Mail size={10} className="inline mr-1" />
                  Correo electrónico (para acceso)
                </label>
                <input id="walker-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="paseador@petap.com" className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
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
                          {selected && <Check size={7} className="inline mr-1" />}
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
                  <label htmlFor="walker-max-daily" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Máx. diario</label>
                  <input id="walker-max-daily" type="number" min="1" max="20" value={form.maxDaily} onChange={(e) => setForm({ ...form, maxDaily: parseInt(e.target.value) || 8 })} className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label htmlFor="walker-max-weekly" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Máx. semanal</label>
                  <input id="walker-max-weekly" type="number" min="1" max="100" value={form.maxWeekly} onChange={(e) => setForm({ ...form, maxWeekly: parseInt(e.target.value) || 40 })} className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
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
                        <button type="button" onClick={() => toggleScheduleDay(day)} className={`w-20 text-2xs px-2 py-1.5 rounded-lg border font-medium transition-all text-left ${isActive ? 'border-success-500/30 bg-success-500/10 text-success-600' : ''}`} style={!isActive ? { borderColor: 'var(--border)', color: 'var(--text-muted)' } : {}}>
                          {DAY_LABELS[day].slice(0, 3)}
                        </button>
                        {isActive && form.schedule[day]?.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-1 flex-1">
                            <label htmlFor={`walker-slot-start-${day}-${idx}`} className="sr-only">Hora de inicio</label>
                            <input id={`walker-slot-start-${day}-${idx}`} type="time" value={slot.start} onChange={(e) => updateScheduleTime(day, idx, 'start', e.target.value)} className="flex-1 text-xs px-2 py-1.5 rounded-lg border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                            <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>—</span>
                            <label htmlFor={`walker-slot-end-${day}-${idx}`} className="sr-only">Hora de fin</label>
                            <input id={`walker-slot-end-${day}-${idx}`} type="time" value={slot.end} onChange={(e) => updateScheduleTime(day, idx, 'end', e.target.value)} className="flex-1 text-xs px-2 py-1.5 rounded-lg border bg-transparent" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
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
                <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleSave} disabled={!form.name.trim() || !form.phone.trim()} isLoading={saving} leftIcon={<Check size={14} />}>
                  {editing !== null ? 'Guardar' : 'Agregar'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

import { WhatsAppIcon } from '@/components/ui/SocialIcons'
