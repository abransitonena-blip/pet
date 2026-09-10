'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { updatePassword } from 'firebase/auth'
import { collection, doc, documentId, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { ArrowLeft, CheckCircle2, Clock3, LockKeyhole, MapPin, Plus, Save, ShieldCheck, UserRound, X } from 'lucide-react'
import { auth, db } from '@/firebase/config'
import { useWalkerPanel } from '@/app/walker/WalkerPanelContext'
import { Button, Card, Input, LoadingState } from '@/components/ui'
import { daySlots, type DaySlot } from '@/lib/dispatch'
import PushOptIn from '@/components/PushOptIn'

const WEEKDAYS = [
  ['monday', 'Lunes'], ['tuesday', 'Martes'], ['wednesday', 'Miércoles'],
  ['thursday', 'Jueves'], ['friday', 'Viernes'], ['saturday', 'Sábado'], ['sunday', 'Domingo'],
] as const

/**
 * Several blocks per day, not one.
 *
 * The schedule has been stored as a list of ranges per day from the start,
 * but this editor only ever read and wrote the first one. A walker available
 * 7–10 and again 17–20 had to declare 7–20, and dispatch then offered them
 * walks in the middle of a day they had never agreed to.
 */
const MAX_RANGES_PER_DAY = 4
const DEFAULT_RANGE: DaySlot = { start: '08:00', end: '18:00' }

interface DaySchedule { active: boolean; ranges: DaySlot[] }
type ScheduleState = Record<string, DaySchedule>

function scheduleFromProfile(schedule: Record<string, DaySlot[]>): ScheduleState {
  return Object.fromEntries(WEEKDAYS.map(([key]) => {
    // daySlots also finds the Spanish keys older admin tooling wrote.
    const ranges = daySlots(schedule, key).map((range) => ({ start: range.start, end: range.end }))
    return [key, { active: ranges.length > 0, ranges: ranges.length > 0 ? ranges : [{ ...DEFAULT_RANGE }] }]
  }))
}

function sortRanges(ranges: DaySlot[]): DaySlot[] {
  return [...ranges].sort((a, b) => a.start.localeCompare(b.start))
}

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = Math.min(h * 60 + m + hours * 60, 23 * 60 + 59)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** One message per invalid day; an empty object means the schedule can be saved. */
function validateSchedule(schedule: ScheduleState): Record<string, string> {
  const problems: Record<string, string> = {}
  for (const [key] of WEEKDAYS) {
    const day = schedule[key]
    if (!day?.active) continue
    const sorted = sortRanges(day.ranges)
    if (sorted.some((range) => !range.start || !range.end || range.start >= range.end)) {
      problems[key] = 'Cada horario debe terminar después de empezar.'
      continue
    }
    if (sorted.some((range, index) => index > 0 && range.start < sorted[index - 1].end)) {
      problems[key] = 'Los horarios de un mismo día no pueden encimarse.'
    }
  }
  return problems
}

export default function WalkerProfilePage() {
  const { uid, profile, updateLocalProfile } = useWalkerPanel()
  const [phone, setPhone] = useState(profile.phone)
  const [schedule, setSchedule] = useState<ScheduleState>(() => scheduleFromProfile(profile.schedule))
  const [zoneNames, setZoneNames] = useState<Record<string, string>>({})
  const [loadingZones, setLoadingZones] = useState(profile.zones.length > 0)
  const [zoneError, setZoneError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [newPassword, setNewPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState('')
  const hasPasswordProvider = useMemo(
    () => auth.currentUser?.providerData.some((provider) => provider.providerId === 'password') ?? false,
    [],
  )
  const problems = useMemo(() => validateSchedule(schedule), [schedule])
  const hasProblems = Object.keys(problems).length > 0

  useEffect(() => {
    if (profile.zones.length === 0) {
      setLoadingZones(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const result: Record<string, string> = {}
        for (let index = 0; index < profile.zones.length; index += 30) {
          const ids = profile.zones.slice(index, index + 30)
          const snapshot = await getDocs(query(
            collection(db, 'zones'),
            where(documentId(), 'in', ids),
            limit(ids.length),
          ))
          snapshot.docs.forEach((zoneDoc) => {
            const data = zoneDoc.data()
            result[zoneDoc.id] = typeof data.name === 'string' && data.name.trim() ? data.name : zoneDoc.id
          })
        }
        if (!cancelled) setZoneNames(result)
      } catch (cause) {
        if (cancelled) return
        const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
        setZoneError(code.includes('permission-denied')
          ? 'No tienes permiso para consultar el catálogo de zonas.'
          : 'No pudimos consultar los nombres de tus zonas.')
      } finally {
        if (!cancelled) setLoadingZones(false)
      }
    })()
    return () => { cancelled = true }
  }, [profile.zones])

  const touch = () => setSaveStatus('idle')

  const toggleDay = (key: string) => {
    setSchedule((current) => ({ ...current, [key]: { ...current[key], active: !current[key].active } }))
    touch()
  }

  const updateRange = (key: string, index: number, changes: Partial<DaySlot>) => {
    setSchedule((current) => {
      const day = current[key]
      const ranges = day.ranges.map((range, position) => (position === index ? { ...range, ...changes } : range))
      return { ...current, [key]: { ...day, ranges } }
    })
    touch()
  }

  const addRange = (key: string) => {
    setSchedule((current) => {
      const day = current[key]
      if (day.ranges.length >= MAX_RANGES_PER_DAY) return current
      const sorted = sortRanges(day.ranges)
      // Start the new block where the last one ends, so the default is valid.
      const start = sorted[sorted.length - 1]?.end ?? DEFAULT_RANGE.start
      return { ...current, [key]: { ...day, ranges: [...day.ranges, { start, end: addHours(start, 2) }] } }
    })
    touch()
  }

  const removeRange = (key: string, index: number) => {
    setSchedule((current) => {
      const day = current[key]
      if (day.ranges.length <= 1) return current
      return { ...current, [key]: { ...day, ranges: day.ranges.filter((_, position) => position !== index) } }
    })
    touch()
  }

  const saveProfile = async () => {
    if (saving || hasProblems) return
    setSaving(true)
    setSaveStatus('idle')
    // Written under the English keys only, which also clears any Spanish keys
    // left by older tooling: after one save there is a single spelling.
    const scheduleData = Object.fromEntries(WEEKDAYS.map(([key]) => [
      key,
      schedule[key]?.active ? sortRanges(schedule[key].ranges).map(({ start, end }) => ({ start, end })) : [],
    ]))
    try {
      await updateDoc(doc(db, 'walkerProfiles', uid), {
        phone: phone.trim(),
        schedule: scheduleData,
        updatedAt: serverTimestamp(),
      })
      updateLocalProfile({ phone: phone.trim(), schedule: scheduleData })
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    if (newPassword.length < 8 || !auth.currentUser) return
    setPasswordStatus('')
    try {
      await updatePassword(auth.currentUser, newPassword)
      setNewPassword('')
      setPasswordStatus('Contraseña actualizada correctamente.')
    } catch (cause) {
      const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
      setPasswordStatus(code === 'auth/requires-recent-login'
        ? 'Por seguridad, cierra sesión y vuelve a entrar antes de cambiar la contraseña.'
        : 'No pudimos actualizar la contraseña. Inténtalo nuevamente.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-center gap-3">
        <Link href="/walker" aria-label="Volver a Mis paseos" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Cuenta operativa</p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Mi perfil</h1>
          <p className="text-sm text-muted">Datos personales y disponibilidad declarada</p>
        </div>
      </header>

      <Card className="p-4 shadow-none sm:p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound size={20} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-bold text-ink">{profile.name}</p>
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success-700">Activo</span>
            </div>
            <p className="truncate text-sm text-muted">{profile.email}</p>
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="walker-phone" className="input-label">Teléfono operativo <span className="font-normal text-muted">(opcional)</span></label>
          <Input
            id="walker-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            value={phone}
            onChange={(event) => { setPhone(event.target.value); touch() }}
            className="mt-1"
          />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-ink/5 p-3"><dt className="text-xs text-muted">Máximo diario</dt><dd className="mt-1 text-sm font-bold text-ink">{profile.maxDaily ?? 'Por definir'}</dd></div>
          <div className="rounded-xl bg-ink/5 p-3"><dt className="text-xs text-muted">Máximo semanal</dt><dd className="mt-1 text-sm font-bold text-ink">{profile.maxWeekly ?? 'Por definir'}</dd></div>
        </dl>
      </Card>

      <Card className="p-4 shadow-none sm:p-5">
        <div className="mb-3 flex items-center gap-2"><MapPin size={17} className="text-primary" /><h2 className="font-bold text-ink">Zonas asignadas</h2></div>
        <p className="mb-4 text-xs text-muted">Administración gestiona estas zonas. El panel no permite modificarlas.</p>
        {loadingZones ? <LoadingState message="Consultando zonas…" rows={1} height="h-10" /> : zoneError ? (
          <p className="rounded-xl bg-danger-500/10 p-3 text-sm text-red-700" role="alert">{zoneError}</p>
        ) : profile.zones.length === 0 ? (
          <p className="rounded-xl bg-warning/10 p-3 text-sm text-amber-800">Aún no tienes zonas asignadas. Contacta a administración antes de aceptar paseos.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {profile.zones.map((zone) => <span key={zone} className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">{zoneNames[zone] || zone}</span>)}
          </div>
        )}
      </Card>

      <Card className="p-4 shadow-none sm:p-5">
        <div className="mb-1 flex items-center gap-2"><Clock3 size={17} className="text-primary" /><h2 className="font-bold text-ink">Disponibilidad semanal</h2></div>
        <p className="mb-4 text-xs text-muted">
          Declara cuándo puedes recibir asignaciones. Puedes registrar hasta {MAX_RANGES_PER_DAY} horarios por día, por ejemplo mañana y tarde. Esto no confirma paseos automáticamente.
        </p>
        <div className="space-y-2">
          {WEEKDAYS.map(([key, label]) => {
            const day = schedule[key]
            return (
              <div key={key} className="rounded-xl bg-ink/[0.035] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-pressed={day.active}
                    aria-label={`${day.active ? 'Desactivar' : 'Activar'} ${label}`}
                    onClick={() => toggleDay(key)}
                    className={`min-h-11 rounded-lg px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-32 ${day.active ? 'bg-primary/10 text-primary' : 'bg-ink/5 text-muted'}`}
                  >
                    {label} <span aria-hidden="true">{day.active ? '✓' : '—'}</span>
                  </button>
                  {day.active && day.ranges.length < MAX_RANGES_PER_DAY && (
                    <button
                      type="button"
                      onClick={() => addRange(key)}
                      className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Plus size={13} aria-hidden="true" /> Agregar horario
                    </button>
                  )}
                </div>
                {day.active && (
                  <div className="mt-2 space-y-2">
                    {day.ranges.map((range, index) => (
                      <div key={index} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                        <Input type="time" aria-label={`Inicio ${label}, horario ${index + 1}`} value={range.start} onChange={(event) => updateRange(key, index, { start: event.target.value })} />
                        <span className="text-xs text-muted">a</span>
                        <Input type="time" aria-label={`Fin ${label}, horario ${index + 1}`} value={range.end} onChange={(event) => updateRange(key, index, { end: event.target.value })} />
                        <button
                          type="button"
                          onClick={() => removeRange(key, index)}
                          disabled={day.ranges.length <= 1}
                          aria-label={`Quitar horario ${index + 1} del ${label.toLowerCase()}`}
                          className="grid h-11 w-11 place-items-center rounded-lg text-muted transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30"
                        >
                          <X size={15} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    {problems[key] && <p className="text-xs text-red-700" role="alert">{problems[key]}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={() => void saveProfile()} isLoading={saving} disabled={hasProblems} leftIcon={<Save size={15} />}>Guardar cambios</Button>
          {hasProblems && <p className="text-sm text-red-700" role="alert">Corrige los horarios marcados antes de guardar.</p>}
          {saveStatus === 'saved' && <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success-700" role="status"><CheckCircle2 size={15} />Cambios guardados</p>}
          {saveStatus === 'error' && <p className="text-sm text-red-700" role="alert">No pudimos guardar. Revisa tu conexión o permisos.</p>}
        </div>
      </Card>

      <PushOptIn description="Recibe asignaciones y solicitudes de PET Ahora en este teléfono, aunque la app esté cerrada." />

      <Card className="p-4 shadow-none sm:p-5">
        <div className="mb-2 flex items-center gap-2"><LockKeyhole size={17} className="text-primary" /><h2 className="font-bold text-ink">Método de acceso</h2></div>
        {hasPasswordProvider ? (
          <div className="space-y-3">
            <p className="text-xs text-muted">La contraseña requiere una sesión reciente y al menos 8 caracteres.</p>
            <Input type="password" autoComplete="new-password" aria-label="Nueva contraseña" placeholder="Nueva contraseña" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            <Button variant="secondary" onClick={() => void changePassword()} disabled={newPassword.length < 8}>Actualizar contraseña</Button>
          </div>
        ) : (
          <p className="inline-flex items-start gap-2 rounded-xl bg-ink/5 p-3 text-sm text-muted"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-success-700" />Tu cuenta usa Google. PET Ap no almacena ni cambia tu contraseña de Google.</p>
        )}
        {passwordStatus && <p className="mt-3 text-sm text-muted" role="status">{passwordStatus}</p>}
      </Card>
    </div>
  )
}
