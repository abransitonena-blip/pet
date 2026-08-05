'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db, auth } from '@/firebase/config'
import { collection, query, where, limit, onSnapshot, doc, getDocs } from 'firebase/firestore'
import { useSearchParams } from 'next/navigation'
import { SERVICE_NAMES, getServicePrice, getServiceMeta } from '@/lib/services'
import { usePrices } from '@/context/PricesContext'
import { useConfig } from '@/context/ConfigContext'
import { generateTimeSlots, getDayOfWeek } from '@/lib/defaultConfig'
import { submitReservation, applyMarginGuard } from '@/lib/submitReservation'
import StepService from './reservation-steps/StepService'
import StepSchedule from './reservation-steps/StepSchedule'
import StepPet from './reservation-steps/StepPet'
import StepContact from './reservation-steps/StepContact'
import StepWalker from './reservation-steps/StepWalker'
import StepConfirm from './reservation-steps/StepConfirm'
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, CalendarDays, Clock, PawPrint, Check, User } from 'lucide-react'

const STEP_META = [
  { num: 1, label: 'Paseo',    short: 'Servicio' },
  { num: 2, label: 'Horario',  short: 'Cuándo' },
  { num: 3, label: 'Mascota',  short: 'Peludo' },
  { num: 4, label: 'Datos',    short: 'Contacto' },
  { num: 5, label: 'Paseador', short: 'Quién' },
  { num: 6, label: 'Confirmar',short: 'Revisar' },
]

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
}

const STORAGE_KEY = 'pq_reservation_draft'
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000

function loadDraft() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed._savedAt && Date.now() - parsed._savedAt > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch { return null }
}

function saveDraft(data: Record<string, unknown>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, _savedAt: Date.now() })) } catch {}
}

function clearDraft() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

const PET_TYPES = [
  { value: 'perro', emoji: '🐕', label: 'Perro' },
  { value: 'gato',  emoji: '🐈', label: 'Gato' },
  { value: 'otro',  emoji: '🐾', label: 'Otro' },
]

function BookingSummary({ step, form, prices, couponStatus, weeklySchedule }: {
  step: number; form: Record<string, string>; prices: Record<string, number>; couponStatus: { valid?: boolean; discount?: number; type?: string } | null; weeklySchedule?: Record<string, string>
}) {
  const svc = getServiceMeta(form.service)
  const basePrice = form.service ? (prices[form.service] ?? getServicePrice(form.service)) : 0
  const discountAmount = couponStatus?.valid && couponStatus.discount
    ? (couponStatus.type === 'percentage' ? Math.round(basePrice * couponStatus.discount / 100) : couponStatus.discount)
    : 0
  const finalPrice = basePrice - discountAmount
  const isWeekly = form.service === 'Paquete Semanal'
  const scheduledDays = weeklySchedule ? Object.entries(weeklySchedule).filter(([, t]) => t).sort() : []

  const hasData = form.service || form.date || form.petName || form.name

  if (!hasData) return null

  // Steps 1-5: show minimal one-liner only on mobile
  if (step < 6) {
    return (
      <div className="lg:hidden mb-4">
        {form.service && (
          <div className="flex items-center justify-center gap-2 text-xs py-2 px-3 rounded-xl"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <span>{svc?.icon || '🐾'}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{form.service}</span>
            {basePrice > 0 && <span className="font-medium" style={{ color: 'var(--text-primary)' }}>${finalPrice.toLocaleString()} MXN</span>}
          </div>
        )}
      </div>
    )
  }

  const summaryContent = (
    <div className="space-y-2">
      {form.service && (
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            {svc?.icon || '🐾'} {form.service}
          </span>
          {svc?.duration && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{svc.duration}</span>}
        </div>
      )}
      {form.date && (
        <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span className="flex items-center gap-2">
            <CalendarDays size={11} className="text-primary" />
            {isWeekly && scheduledDays.length > 0
              ? `${scheduledDays.length} días: ${scheduledDays[0] ? new Date(scheduledDays[0][0] + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : ''}`
              : new Date(form.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
            }
          </span>
          {!isWeekly && form.time && <span className="flex items-center gap-1"><Clock size={10} className="text-primary" /> {form.time}</span>}
        </div>
      )}
      {isWeekly && scheduledDays.length > 1 && (
        <div className="space-y-1 mt-1">
          {scheduledDays.map(([date, time]) => (
            <div key={date} className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="capitalize">{new Date(date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })}</span>
              <span className="flex items-center gap-1"><Clock size={8} /> {time}</span>
            </div>
          ))}
        </div>
      )}
      {form.petName && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <PawPrint size={11} className="text-primary" />
          {form.petName} ({PET_TYPES.find((p) => p.value === form.petType)?.label})
        </div>
      )}
      {form.name && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <User size={11} className="text-primary" />
          {form.name}
        </div>
      )}
      {basePrice > 0 && (
        <div className="pt-2 mt-2 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>Subtotal</span><span>${basePrice.toLocaleString()}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm" style={{ color: 'var(--color-success)' }}>
              <span>Descuento</span><span>-${discountAmount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold pt-1">
            <span>Total</span>
            <span className="text-primary">${finalPrice.toLocaleString()} MXN</span>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop: sticky sidebar (only on step 5) */}
      <div className="hidden lg:block">
        <div className="sticky top-24 glass-card p-5 rounded-2xl" aria-label="Resumen de la reserva">
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Resumen</h4>
          {summaryContent}
        </div>
      </div>
    </>
  )
}

export default function ReservationForm({ onPhoneChange, onFocusChange }: {
  onPhoneChange?: (phone: string) => void
  onFocusChange?: (active: boolean) => void
}) {
  const searchParams = useSearchParams()
  const referralCode = searchParams.get('ref') || ''
  const draft = useRef(loadDraft())
  const [step, setStep] = useState(draft.current?.step || 1)
  const [direction, setDirection] = useState(1)
  const [form, setForm] = useState(draft.current?.form || {
    name: '', phone: '', petName: '', petType: 'perro',
    service: '', date: '', time: '', notes: '', coupon: '', addressId: '',
    walkerPreference: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const { prices } = usePrices()
  const { config } = useConfig()
  const honeypot = useRef('')
  const lastSubmit = useRef(0)
  const [rateError, setRateError] = useState('')
  const [couponStatus, setCouponStatus] = useState<{ valid: boolean; msg: string; discount?: number; type?: 'percentage' | 'fixed' } | null>(null)
  const [checkingCoupon, setCheckingCoupon] = useState(false)
  const [bookedSlots, setBookedSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showCoupon, setShowCoupon] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [savedPets, setSavedPets] = useState<{ id: string; name: string; petType: string; breed: string }[]>([])
  const [weeklySchedule, setWeeklySchedule] = useState<Record<string, string>>({})
  const [savedAddresses, setSavedAddresses] = useState<{ id: string; alias: string; street: string; colony: string; city: string; zip: string }[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [walkerPreference, setWalkerPreference] = useState(draft.current?.form?.walkerPreference || '')
  const [availableWalkers, setAvailableWalkers] = useState<{ id: string; name: string; photo?: string; zones?: string[]; rating?: number }[]>([])
  const [loadingWalkers, setLoadingWalkers] = useState(false)
  const isWeeklyPackage = form.service === 'Paquete Semanal'

  // Handle ?repeat=<serviceName> query param
  useEffect(() => {
    const repeatService = searchParams.get('repeat')
    if (repeatService && SERVICE_NAMES.includes(repeatService) && !form.service) {
      setForm((prev: typeof form) => ({ ...prev, service: repeatService }))
      setStep(2)
    }
  }, [searchParams])

  const timeSlots = form.date ? generateTimeSlots(getDayOfWeek(form.date)) : []

  // Generate 6 days (Mon-Sat) starting from selected date or next Monday
  const weekDays = useMemo(() => {
    const start = form.date ? new Date(form.date + 'T12:00:00') : new Date()
    // Find next Monday if no date selected
    if (!form.date) {
      const day = start.getDay()
      const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day
      start.setDate(start.getDate() + diff)
    } else {
      // Adjust to Monday if not already
      const day = start.getDay()
      const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day
      start.setDate(start.getDate() + diff)
    }
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return {
        date: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }),
        dayName: d.toLocaleDateString('es-MX', { weekday: 'long' }),
      }
    })
  }, [form.date])

  useEffect(() => {
    const user = auth.currentUser
    if (!user) return

    // Pre-fill client profile from Firestore
    import('firebase/firestore').then(({ getDoc }) =>
      getDoc(doc(db, 'clients', user.uid))
    ).then((snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setForm((prev: typeof form) => ({
          ...prev,
          name: prev.name || data.name || '',
          phone: prev.phone || data.phone || '',
        }))
      }
    }).catch(() => {})

    // Load saved pets
    const q = query(collection(db, 'dogs'), where('ownerId', '==', user.uid), limit(5))
    const unsubPets = onSnapshot(q, (snap) => {
      setSavedPets(snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
        petType: d.data().petType || 'perro',
        breed: d.data().breed || '',
      })))
    }, () => {})

    // Load saved addresses
    const qAddr = query(collection(db, 'addresses'), where('ownerId', '==', user.uid), limit(5))
    const unsubAddr = onSnapshot(qAddr, (snap) => {
      const addrs = snap.docs.map((d) => ({
        id: d.id,
        alias: d.data().alias || 'Otro',
        street: d.data().street || '',
        colony: d.data().colony || '',
        city: d.data().city || '',
        zip: d.data().zip || '',
      }))
      setSavedAddresses(addrs)
      // Auto-select default address
      const defaultAddr = snap.docs.find((d) => d.data().isDefault)
      if (defaultAddr && !selectedAddressId) {
        setSelectedAddressId(defaultAddr.id)
      }
    }, () => {})

    return () => { unsubPets(); unsubAddr() }
  }, [])

  useEffect(() => {
    if (!form.date) { setBookedSlots([]); return }
    const user = auth.currentUser
    if (!user) { setBookedSlots([]); setLoadingSlots(false); return }
    setLoadingSlots(true)
    const q = query(
      collection(db, 'reservations'),
      where('date', '==', form.date),
      where('status', 'in', ['pending', 'on_the_way', 'in_progress']),
    )
    const unsub = onSnapshot(q, (snap) => {
      setBookedSlots(snap.docs.map((d) => d.data().time).filter(Boolean))
      setLoadingSlots(false)
    }, () => setLoadingSlots(false))
    return unsub
  }, [form.date])

  useEffect(() => {
    if (step !== 5 || !form.date || !form.time) return
    setLoadingWalkers(true)
    ;(async () => {
      try {
        const profilesSnap = await getDocs(collection(db, 'walkerProfiles'))
        const configWalkers = (config?.walkers || []) as { name: string; uid?: string; status?: string; zones?: string[]; schedule?: Record<string, { start: string; end: string }[]> }[]
        const dayOfWeek = new Date(form.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short' }).toLowerCase()
        const timeNum = parseInt(form.time.replace(':', ''), 10)

        const activeUids = new Set(
          profilesSnap.docs
            .filter((d) => d.data().status === 'active')
            .map((d) => d.id)
        )
        const merged = profilesSnap.docs.map((d) => {
          const cfg = configWalkers.find((w) => w.uid === d.id)
          const sched = d.data().schedule?.[dayOfWeek] || cfg?.schedule?.[dayOfWeek] || []
          const inWindow = sched.some((s: { start: string; end: string }) => {
            const start = parseInt(s.start.replace(':', ''), 10)
            const end = parseInt(s.end.replace(':', ''), 10)
            return timeNum >= start && timeNum < end
          })
          return {
            id: d.id,
            name: d.data().name || cfg?.name || 'Paseador',
            photo: d.data().photo || d.data().photoURL || '',
            zones: d.data().zones || cfg?.zones || [],
            rating: d.data().performance?.rating || 0,
            available: inWindow || sched.length === 0,
          }
        })

        const active = merged.filter((w) => activeUids.has(w.id) && (w.available || w.zones.length === 0))
        setAvailableWalkers(active.length > 0 ? active : merged.filter((w) => activeUids.has(w.id)))
      } catch {
        setAvailableWalkers([])
      } finally {
        setLoadingWalkers(false)
      }
    })()
  }, [step, form.date, form.time, config])

  useEffect(() => {
    onFocusChange?.(step > 0 && !sent)
    return () => onFocusChange?.(false)
  }, [step, sent])

  useEffect(() => {
    if (!sent) saveDraft({ step, form })
  }, [step, form, sent])

  useEffect(() => {
    if (walkerPreference !== form.walkerPreference) {
      setForm((prev: typeof form) => ({ ...prev, walkerPreference }))
    }
  }, [walkerPreference])

  const set = useCallback(<K extends keyof typeof form>(key: K, val: string) => {
    setForm((p: typeof form) => ({ ...p, [key]: val }))
    if (key === 'phone') onPhoneChange?.(val)
    if (errors[key as string]) setErrors((prev) => { const n = { ...prev }; delete n[key as string]; return n })
  }, [onPhoneChange, errors])

  const goNext = () => { setDirection(1); setStep((s: number) => Math.min(s + 1, 6)) }
  const goBack = () => { setDirection(-1); setStep((s: number) => Math.max(s - 1, 1)) }
  const goToStep = (target: number) => { setDirection(target > step ? 1 : -1); setStep(target) }

  const validateField = useCallback((key: string, val: string) => {
    switch (key) {
      case 'petName': return val.trim() ? '' : 'Escribe el nombre de tu mascota'
      case 'name': return val.trim() ? '' : 'Escribe tu nombre'
      case 'phone': {
        const digits = val.replace(/\D/g, '')
        if (digits.length < 10) return 'Necesitamos un número de 10 dígitos'
        if (digits.length === 10 && !/^[2-9]/.test(digits)) return 'El número debe iniciar con 2-9'
        return ''
      }
      default: return ''
    }
  }, [])

  const handleBlur = useCallback((key: string) => {
    setTouched((prev) => ({ ...prev, [key]: true }))
    const err = validateField(key, form[key as keyof typeof form] as string)
    setErrors((prev) => {
      if (err) return { ...prev, [key]: err }
      const n = { ...prev }; delete n[key]; return n
    })
  }, [form, validateField])

  const canProceed = useMemo(() => {
    switch (step) {
      case 1: return !!form.service
      case 2: {
        if (isWeeklyPackage) {
          return Object.values(weeklySchedule).some((t) => !!t)
        }
        return !!form.date && !!form.time
      }
      case 3: return !!form.petName.trim()
      case 4: {
        const digits = form.phone.replace(/\D/g, '')
        return !!form.name.trim() && digits.length >= 10 && /^[2-9]/.test(digits)
      }
      default: return true
    }
  }, [step, form, isWeeklyPackage, weeklySchedule])

  const ctaLabel = useMemo(() => {
    if (step === 6) return null
    if (step === 1 && form.service) {
      const p = prices[form.service] ?? getServicePrice(form.service)
      return `Continuar con $${p.toLocaleString()} MXN`
    }
    if (step === 4) return 'Elegir paseador'
    if (!canProceed) {
      const labels = ['', 'Selecciona un paseo para continuar', 'Elige fecha y hora', 'Escribe el nombre de tu mascota', 'Completa tu nombre y teléfono']
      return labels[step]
    }
    const labels = ['', 'Elegir horario', 'Agregar mascota', 'Agregar tus datos', 'Confirmar']
    return labels[step]
  }, [step, form.service, canProceed, prices])

  const checkCoupon = async (code: string) => {
    if (!code.trim()) { setCouponStatus(null); return }
    setCheckingCoupon(true)
    try {
      const q = query(collection(db, 'coupons'), where('code', '==', code.trim().toUpperCase()), where('active', '==', true), limit(1))
      const snap = await getDocs(q)
      if (snap.empty) {
        setCouponStatus({ valid: false, msg: 'Cupón no encontrado' })
      } else {
        const c = snap.docs[0].data()
        if (c.maxUses > 0 && c.usedCount >= c.maxUses) {
          setCouponStatus({ valid: false, msg: 'Ya no está disponible' })
        } else {
          setCouponStatus({ valid: true, msg: `-${c.type === 'percentage' ? `${c.discount}%` : `$${c.discount}`}`, discount: c.discount, type: c.type })
        }
      }
    } catch {
      setCouponStatus({ valid: false, msg: 'Error al validar' })
    }
    setCheckingCoupon(false)
  }

  useEffect(() => {
    if (form.coupon.length >= 3) checkCoupon(form.coupon)
    else setCouponStatus(null)
  }, [form.coupon])

  const handleSubmit = async () => {
    if (sending || !canProceed) return
    setSending(true)
    if (honeypot.current) return
    if (Date.now() - lastSubmit.current < 30000) {
      setRateError('Espera un momento antes de enviar otra reserva')
      setSending(false)
      return
    }
    setRateError('')
    lastSubmit.current = Date.now()

    try {
      await submitReservation({
        form, prices, couponStatus, referralCode, weeklySchedule,
        walkerPreference, availableWalkers, selectedAddressId, isWeeklyPackage,
      })
    } catch (e) { console.error('Error saving reservation:', e) }

    setSending(false)
    setSent(true)
    clearDraft()
    setTimeout(() => {
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        ;[523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.frequency.value = freq; osc.type = 'sine'
          gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12)
          gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.12 + 0.04)
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.12 + 0.3)
          osc.start(ctx.currentTime + i * 0.12)
          osc.stop(ctx.currentTime + i * 0.12 + 0.3)
        })
      } catch {}
    }, 100)
    setTimeout(() => {
      setSent(false)
      setStep(1)
      setForm({ name: '', phone: '', petName: '', petType: 'perro', service: '', date: '', time: '', notes: '', coupon: '', addressId: '', walkerPreference: '' })
      setWeeklySchedule({})
      setSelectedAddressId('')
      setCouponStatus(null)
      setShowNotes(false)
      setShowCoupon(false)
      setErrors({})
      setTouched({})
    }, 5000)
  }

  const basePrice = form.service ? (prices[form.service] ?? getServicePrice(form.service)) : 0
  const rawDiscount = couponStatus?.valid && couponStatus.discount
    ? (couponStatus.type === 'percentage' ? Math.round(basePrice * couponStatus.discount / 100) : couponStatus.discount)
    : 0
  const discountAmount = applyMarginGuard(basePrice, rawDiscount)
  const finalPrice = basePrice - discountAmount

  const today = new Date().toISOString().split('T')[0]

  return (
    <section id="reservar" className="relative py-24 sm:py-32">
      <div className="section-container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.32 }}
          className="text-center mb-12 sm:mb-16"
        >
          <span className="text-primary text-sm uppercase tracking-widest font-medium">Agenda su paseo</span>
          <h2 className="section-title mt-3">
            Reserva su <span className="gradient-text">paseo</span>
          </h2>
          <p className="section-subtitle">
            En 6 pasos simples. Fácil, rápido y seguro.
          </p>
        </motion.div>

        <div className="flex gap-8 max-w-5xl mx-auto">
          {/* Main Form */}
          <div className="flex-1 max-w-2xl">
            {/* Mobile: "Paso X de 5" */}
            <div className="lg:hidden text-center mb-3">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Paso {step} de 6 — {STEP_META[step - 1]?.label}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center mb-8 px-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={6} aria-label={`Paso ${step} de 6: ${STEP_META[step - 1]?.label}`}>
              {STEP_META.map((s, i) => (
                <div key={s.num} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <motion.div
                      animate={{
                        scale: step === s.num ? 1.1 : 1,
                        background: step > s.num ? 'linear-gradient(135deg, var(--color-success), #059669)' : step === s.num ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))' : 'var(--glass-bg)',
                      }}
                      transition={{ duration: 0.22 }}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold border"
                      style={{
                        borderColor: step >= s.num ? 'transparent' : 'var(--border)',
                        color: step >= s.num ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {step > s.num ? <Check size={12} /> : s.num}
                    </motion.div>
                    <span className="text-2xs sm:text-xs font-medium hidden sm:block"
                      style={{ color: step >= s.num ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEP_META.length - 1 && (
                    <div className="flex-1 h-[2px] mx-1 sm:mx-2 rounded-full transition-colors duration-500"
                      style={{ background: step > s.num ? 'var(--color-success)' : 'var(--border)' }} />
                  )}
                </div>
              ))}
            </div>

            {/* Form Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="glass-card p-5 sm:p-8"
            >
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={sent ? 'sent' : step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  style={{ minHeight: '300px' }}
                >
                  {/* SUCCESS STATE */}
                  {sent ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className="w-20 h-20 rounded-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, var(--color-success), #059669)' }}
                      >
                        <CheckCircle2 size={36} className="text-white" />
                      </motion.div>
                      <h3 className="text-xl sm:text-2xl font-bold">¡Paseo reservado!</h3>
                      <p className="text-sm text-center max-w-xs" style={{ color: 'var(--text-secondary)' }}>
                        Te contactaremos por WhatsApp en menos de 5 minutos para confirmar.
                      </p>
                    </div>
                   ) : (
                    <>
                      {step === 1 && <StepService form={form} prices={prices} onSelect={(svc) => set('service', svc)} />}
                      {step === 2 && (
                        <StepSchedule
                          form={form} set={set} isWeeklyPackage={isWeeklyPackage}
                          weeklySchedule={weeklySchedule} setWeeklySchedule={setWeeklySchedule}
                          bookedSlots={bookedSlots} loadingSlots={loadingSlots}
                        />
                      )}
                      {step === 3 && (
                        <StepPet form={form} set={set} errors={errors} touched={touched}
                          handleBlur={handleBlur} savedPets={savedPets} />
                      )}
                      {step === 4 && (
                        <StepContact form={form} set={set} errors={errors} touched={touched}
                          handleBlur={handleBlur} showNotes={showNotes} setShowNotes={setShowNotes}
                          savedAddresses={savedAddresses} selectedAddressId={selectedAddressId}
                          setSelectedAddressId={setSelectedAddressId} />
                      )}
                      {step === 5 && (
                        <StepWalker walkerPreference={walkerPreference}
                          setWalkerPreference={setWalkerPreference}
                          availableWalkers={availableWalkers} loadingWalkers={loadingWalkers} />
                      )}
                      {step === 6 && (
                        <StepConfirm form={form} goToStep={goToStep} isWeeklyPackage={isWeeklyPackage}
                          weeklySchedule={weeklySchedule} walkerPreference={walkerPreference}
                          availableWalkers={availableWalkers} basePrice={basePrice}
                          discountAmount={discountAmount} finalPrice={finalPrice}
                          showCoupon={showCoupon} setShowCoupon={setShowCoupon} set={set}
                          couponStatus={couponStatus} checkingCoupon={checkingCoupon}
                          rateError={rateError} />
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              {!sent && (
                <div className="hidden lg:flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={goBack}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                      style={{ background: 'var(--glass-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', minHeight: '44px' }}
                    >
                      <ArrowLeft size={12} /> Atrás
                    </button>
                  ) : <div />}

                  {step < 6 ? (
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!canProceed}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))', minHeight: '44px' }}
                    >
                      {ctaLabel} <ArrowRight size={12} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canProceed || sending}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: 'linear-gradient(135deg, var(--color-success), #059669)', boxShadow: '0 4px 16px var(--color-success-light)', minHeight: '44px' }}
                    >
                      {sending ? <><Loader2 className="animate-spin" size={14} /> Enviando...</> : <><WhatsAppIcon width={14} height={14} /> Confirmar por WhatsApp</>}
                    </button>
                  )}
                </div>
              )}

              {/* Honeypot */}
              <input tabIndex={-1} autoComplete="off" onChange={(e) => { honeypot.current = e.target.value }} className="absolute opacity-0 pointer-events-none" style={{ height: 0, width: 0 }} aria-hidden="true" />
            </motion.div>
          </div>

          {/* Desktop: BookingSummary sidebar */}
          <BookingSummary step={step} form={form} prices={prices} couponStatus={couponStatus} weeklySchedule={weeklySchedule} />
        </div>

        {/* Mobile: Fixed bottom CTA */}
        {!sent && (
           <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[var(--z-sticky)] px-4 pb-[env(safe-area-inset-bottom)]"
            style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between py-3">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{ background: 'var(--glass-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', minHeight: '44px' }}
                >
                  <ArrowLeft size={10} /> Atrás
                </button>
              ) : <div />}

              {step < 6 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canProceed}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))', minHeight: '44px' }}
                >
                  {ctaLabel} <ArrowRight size={12} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canProceed || sending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, var(--color-success), #059669)', minHeight: '44px' }}
                >
                  {sending ? <><Loader2 className="animate-spin" size={14} /> ...</> : <><WhatsAppIcon width={14} height={14} /> Confirmar</>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

import { WhatsAppIcon } from '@/components/ui/SocialIcons'
