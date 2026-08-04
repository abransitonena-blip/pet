'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged, updatePassword } from 'firebase/auth'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Clock, MapPin, User, Lock, CheckCircle } from 'lucide-react'
import Link from 'next/link'

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

interface DaySchedule {
  active: boolean
  start: string
  end: string
}

interface ScheduleState {
  [key: string]: DaySchedule
}

const defaultSchedule: ScheduleState = Object.fromEntries(
  WEEKDAY_KEYS.map((k, i) => [k, { active: i < 6, start: '08:00', end: i < 5 ? '18:00' : '14:00' }])
)

export default function WalkerProfilePage() {
  const router = useRouter()
  const [uid, setUid] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [walkerName, setWalkerName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [zones, setZones] = useState<string[]>([])
  const [allZones, setAllZones] = useState<{ id: string; name: string }[]>([])
  const [schedule, setSchedule] = useState<ScheduleState>(defaultSchedule)
  const [maxDaily, setMaxDaily] = useState(8)
  const [maxWeekly, setMaxWeekly] = useState(40)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return }
      setUid(user.uid)
      setEmail(user.email || '')

      const profileSnap = await getDoc(doc(db, 'walkerProfiles', user.uid))
      if (profileSnap.exists()) {
        const p = profileSnap.data()
        setWalkerName(p.name || '')
        setPhone(p.phone || '')
        setZones(p.zones || [])
        setMaxDaily(p.maxDaily || 8)
        setMaxWeekly(p.maxWeekly || 40)

        if (p.schedule && Object.keys(p.schedule).length > 0) {
          const s: ScheduleState = {}
          WEEKDAY_KEYS.forEach((k) => {
            const day = p.schedule[k]
            if (day && day.length > 0) {
              s[k] = { active: true, start: day[0].start || '08:00', end: day[0].end || '18:00' }
            } else {
              s[k] = { active: false, start: '08:00', end: '18:00' }
            }
          })
          setSchedule(s)
        }
      }

      const zonesSnap = await getDoc(doc(db, 'zones', '_'))
      // Just read all zone docs
      const { getDocs, collection, query } = await import('firebase/firestore')
      const zonesQuery = query(collection(db, 'zones'))
      const zonesSnap2 = await getDocs(zonesQuery)
      setAllZones(zonesSnap2.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })))

      setLoading(false)
    })
    return unsub
  }, [router])

  const toggleZone = (zoneId: string) => {
    setZones((prev) =>
      prev.includes(zoneId) ? prev.filter((z) => z !== zoneId) : [...prev, zoneId]
    )
  }

  const updateDaySchedule = (key: string, field: keyof DaySchedule, value: boolean | string) => {
    setSchedule((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const scheduleData: Record<string, { start: string; end: string }[]> = {}
      WEEKDAY_KEYS.forEach((k) => {
        if (schedule[k]?.active) {
          scheduleData[k] = [{ start: schedule[k].start, end: schedule[k].end }]
        } else {
          scheduleData[k] = []
        }
      })

      await updateDoc(doc(db, 'walkerProfiles', uid), {
        phone,
        zones,
        maxDaily,
        maxWeekly,
        schedule: scheduleData,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      setPasswordMsg('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setPasswordMsg('')
    const user = auth.currentUser
    if (!user) return
    try {
      await updatePassword(user, newPassword)
      setPasswordMsg('✅ Contraseña actualizada')
      setCurrentPassword('')
      setNewPassword('')
    } catch {
      setPasswordMsg('Error: verifica tu sesión o contraseña actual')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/paseador" className="w-9 h-9 rounded-xl card flex items-center justify-center text-muted hover:text-ink transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink">Mi perfil</h1>
          <p className="text-sm text-muted">Horario, zonas y configuración</p>
        </div>
      </div>

      {/* Profile info */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-trust/10 flex items-center justify-center text-trust">
            <User size={24} />
          </div>
          <div>
            <p className="text-lg font-bold text-ink">{walkerName}</p>
            <p className="text-sm text-muted">{email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="input-label">Teléfono</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input mt-1"
              placeholder="5512345678"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Paseos máx. por día</label>
              <input
                type="number"
                value={maxDaily}
                onChange={(e) => setMaxDaily(Number(e.target.value))}
                min={1}
                max={30}
                className="input mt-1"
              />
            </div>
            <div>
              <label className="input-label">Paseos máx. por semana</label>
              <input
                type="number"
                value={maxWeekly}
                onChange={(e) => setMaxWeekly(Number(e.target.value))}
                min={1}
                max={100}
                className="input mt-1"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Zones */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-ink">Zonas disponibles</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {allZones.map((z) => (
            <button
              key={z.id}
              onClick={() => toggleZone(z.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                zones.includes(z.id)
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'border-border text-muted hover:border-hover'
              }`}
            >
              {z.name}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Schedule */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-ink">Horario semanal</h2>
        </div>
        <div className="space-y-3">
          {WEEKDAY_KEYS.map((key, i) => (
            <div key={key} className="flex items-center gap-3">
              <button
                onClick={() => updateDaySchedule(key, 'active', !schedule[key]?.active)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                  schedule[key]?.active
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-border/50 text-muted border border-border'
                }`}
              >
                {schedule[key]?.active ? '✓' : '✗'}
              </button>
              <span className={`text-sm w-20 font-medium ${schedule[key]?.active ? 'text-ink' : 'text-muted'}`}>
                {WEEKDAYS[i]}
              </span>
              {schedule[key]?.active && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={schedule[key]?.start || '08:00'}
                    onChange={(e) => updateDaySchedule(key, 'start', e.target.value)}
                    className="input !py-1.5 !px-2 !text-xs w-24"
                  />
                  <span className="text-xs text-muted">a</span>
                  <input
                    type="time"
                    value={schedule[key]?.end || '18:00'}
                    onChange={(e) => updateDaySchedule(key, 'end', e.target.value)}
                    className="input !py-1.5 !px-2 !text-xs w-24"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary inline-flex items-center gap-2"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
              Guardando...
            </span>
          ) : (
            <>
              <Save size={14} /> Guardar cambios
            </>
          )}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle size={12} /> Guardado
          </span>
        )}
      </div>

      {/* Change password */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-ink">Cambiar contraseña</h2>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nueva contraseña (mín. 6 caracteres)"
            aria-label="Nueva contraseña"
            className="input"
          />
          <button
            onClick={handlePasswordChange}
            disabled={!newPassword || newPassword.length < 6}
            className="btn-secondary text-sm"
          >
            Actualizar contraseña
          </button>
          {passwordMsg && (
            <p className="text-xs text-muted mt-1">{passwordMsg}</p>
          )}
        </div>
      </motion.div>
    </div>
  )
}
