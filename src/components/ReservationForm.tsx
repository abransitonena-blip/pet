'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/firebase/config'
import { collection, addDoc, serverTimestamp, getDocs, query, where, limit, onSnapshot } from 'firebase/firestore'
import { WHATSAPP_NUMBER } from '@/lib/utils'
import { SERVICES, getServicePrice, getServiceMeta, calculateSavings } from '@/lib/services'
import { usePrices } from '@/context/PricesContext'
import { showPushNotification } from './PWARegister'
import { generateTimeSlots, getDayOfWeek } from '@/lib/defaultConfig'
import {
  FaDog, FaCalendarAlt, FaClock, FaPhone, FaUser, FaCommentAlt,
  FaPaw, FaSpinner, FaCheckCircle, FaTag, FaCheck, FaTimes,
  FaArrowRight, FaArrowLeft, FaShieldAlt, FaStar, FaBolt, FaHeart,
  FaTicketAlt, FaInfoCircle, FaEdit, FaWhatsapp,
} from 'react-icons/fa'

const PET_TYPES = [
  { value: 'perro', emoji: '🐕', label: 'Perro' },
  { value: 'gato',  emoji: '🐈', label: 'Gato' },
  { value: 'otro',  emoji: '🐾', label: 'Otro' },
]

const STEP_META = [
  { num: 1, label: 'Paseo',    short: 'Servicio' },
  { num: 2, label: 'Horario',  short: 'Cuándo' },
  { num: 3, label: 'Mascota',  short: 'Peludo' },
  { num: 4, label: 'Datos',    short: 'Contacto' },
  { num: 5, label: 'Confirmar',short: 'Revisar' },
]

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
}

const STORAGE_KEY = 'pq_reservation_draft'

function loadDraft() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function saveDraft(data: any) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}

function clearDraft() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
}

function BookingSummary({ step, form, prices, couponStatus }: {
  step: number; form: any; prices: Record<string, number>; couponStatus: any
}) {
  const [expanded, setExpanded] = useState(false)
  const svc = getServiceMeta(form.service)
  const basePrice = form.service ? (prices[form.service] ?? getServicePrice(form.service)) : 0
  const discountAmount = couponStatus?.valid && couponStatus.discount
    ? (couponStatus.type === 'percentage' ? Math.round(basePrice * couponStatus.discount / 100) : couponStatus.discount)
    : 0
  const finalPrice = basePrice - discountAmount

  const hasData = form.service || form.date || form.petName || form.name

  if (!hasData) return null

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
            <FaCalendarAlt size={11} className="text-primary" />
            {new Date(form.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          {form.time && <span className="flex items-center gap-1"><FaClock size={10} className="text-primary" /> {form.time}</span>}
        </div>
      )}
      {form.petName && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <FaPaw size={11} className="text-primary" />
          {form.petName} ({PET_TYPES.find((p) => p.value === form.petType)?.label})
        </div>
      )}
      {form.name && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <FaUser size={11} className="text-primary" />
          {form.name}
        </div>
      )}
      {basePrice > 0 && (
        <div className="pt-2 mt-2 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>Subtotal</span><span>${basePrice.toLocaleString()}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-400">
              <span>Descuento</span><span>-${discountAmount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold pt-1">
            <span>Total</span>
            <span className="gradient-text">${finalPrice.toLocaleString()} MXN</span>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop: sticky sidebar */}
      <div className="hidden lg:block">
        <div className="sticky top-24 glass-card p-5 rounded-2xl">
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Resumen</h4>
          {summaryContent}
        </div>
      </div>

      {/* Mobile: expandable compact summary */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 rounded-xl text-sm"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}
        >
          <span className="flex items-center gap-2 font-medium" style={{ color: 'var(--text-primary)' }}>
            <FaTag size={12} className="text-primary" />
            Resumen {form.service ? `— ${form.service}` : ''}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{expanded ? 'Ocultar' : 'Ver'}</span>
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-3 mt-2 rounded-xl" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                {summaryContent}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

export default function ReservationForm({ onPhoneChange, onFocusChange }: {
  onPhoneChange?: (phone: string) => void
  onFocusChange?: (active: boolean) => void
}) {
  const draft = useRef(loadDraft())
  const [step, setStep] = useState(draft.current?.step || 1)
  const [direction, setDirection] = useState(1)
  const [form, setForm] = useState(draft.current?.form || {
    name: '', phone: '', petName: '', petType: 'perro',
    service: '', date: '', time: '', notes: '', coupon: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const { prices } = usePrices()
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

  const timeSlots = form.date ? generateTimeSlots(getDayOfWeek(form.date)) : []

  useEffect(() => {
    if (!form.date) { setBookedSlots([]); return }
    setLoadingSlots(true)
    const q = query(
      collection(db, 'reservations'),
      where('date', '==', form.date),
      where('status', 'in', ['pending', 'en_camino', 'paseando']),
    )
    const unsub = onSnapshot(q, (snap) => {
      setBookedSlots(snap.docs.map((d) => d.data().time).filter(Boolean))
      setLoadingSlots(false)
    }, () => setLoadingSlots(false))
    return unsub
  }, [form.date])

  useEffect(() => {
    onFocusChange?.(step > 0 && !sent)
    return () => onFocusChange?.(false)
  }, [step, sent])

  useEffect(() => {
    if (!sent) saveDraft({ step, form })
  }, [step, form, sent])

  const set = useCallback(<K extends keyof typeof form>(key: K, val: string) => {
    setForm((p: typeof form) => ({ ...p, [key]: val }))
    if (key === 'phone') onPhoneChange?.(val)
    if (errors[key as string]) setErrors((prev) => { const n = { ...prev }; delete n[key as string]; return n })
  }, [onPhoneChange, errors])

  const goNext = () => { setDirection(1); setStep((s) => Math.min(s + 1, 5)) }
  const goBack = () => { setDirection(-1); setStep((s) => Math.max(s - 1, 1)) }
  const goToStep = (target: number) => { setDirection(target > step ? 1 : -1); setStep(target) }

  const validateField = useCallback((key: string, val: string) => {
    switch (key) {
      case 'petName': return val.trim() ? '' : 'Escribe el nombre de tu mascota'
      case 'name': return val.trim() ? '' : 'Escribe tu nombre'
      case 'phone': return val.replace(/\D/g, '').length >= 10 ? '' : 'Necesitamos un número de 10 dígitos'
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
      case 2: return !!form.date && !!form.time
      case 3: return !!form.petName.trim()
      case 4: return !!form.name.trim() && form.phone.replace(/\D/g, '').length >= 10
      default: return true
    }
  }, [step, form])

  const ctaLabel = useMemo(() => {
    if (step === 5) return null
    if (step === 1 && form.service) {
      const p = prices[form.service] ?? getServicePrice(form.service)
      return `Continuar con $${p.toLocaleString()} MXN`
    }
    if (step === 4) return 'Revisar reserva'
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

    const basePrice = prices[form.service] ?? getServicePrice(form.service)
    let discountAmount = 0
    if (couponStatus?.valid && couponStatus.discount) {
      discountAmount = couponStatus.type === 'percentage' ? Math.round(basePrice * couponStatus.discount / 100) : couponStatus.discount
    }
    const finalPrice = basePrice - discountAmount

    const petTypeLabel = PET_TYPES.find((p) => p.value === form.petType)?.label || form.petType
    let message = `🐾 *Nuevo Paseo — Paseos Quebrada*\n`
    message += `👤 *Nombre:* ${form.name}\n`
    message += `📱 *Teléfono:* ${form.phone}\n`
    message += `🐶 *Mascota:* ${form.petName} (${petTypeLabel})\n`
    message += `🎒 *Paquete:* ${form.service}\n`
    if (basePrice > 0) message += `💰 *Precio:* $${basePrice.toLocaleString()}\n`
    if (discountAmount > 0) message += `🏷️ *Descuento:* -$${discountAmount.toLocaleString()} (${form.coupon.toUpperCase()})\n`
    message += `💵 *Total:* $${finalPrice.toLocaleString()}\n`
    message += `📅 *Fecha:* ${form.date}\n`
    message += `🕐 *Hora:* ${form.time}\n`
    if (form.notes) message += `📝 *Notas:* ${form.notes}\n`

    try {
      await addDoc(collection(db, 'reservations'), {
        ...form,
        createdAt: serverTimestamp(),
        status: 'pending',
        appliedCoupon: form.coupon.toUpperCase(),
        discountApplied: discountAmount,
        finalPrice,
      })
      showPushNotification('🐾 Nueva reserva', `${form.name} agendó "${form.service}" para ${form.petName}`)
    } catch {}

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank')

    setSending(false)
    setSent(true)
    clearDraft()
    setTimeout(() => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
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
      setForm({ name: '', phone: '', petName: '', petType: 'perro', service: '', date: '', time: '', notes: '', coupon: '' })
      setCouponStatus(null)
      setShowNotes(false)
      setShowCoupon(false)
      setErrors({})
      setTouched({})
    }, 5000)
  }

  const basePrice = form.service ? (prices[form.service] ?? getServicePrice(form.service)) : 0
  const discountAmount = couponStatus?.valid && couponStatus.discount
    ? (couponStatus.type === 'percentage' ? Math.round(basePrice * couponStatus.discount / 100) : couponStatus.discount)
    : 0
  const finalPrice = basePrice - discountAmount

  const today = new Date().toISOString().split('T')[0]

  return (
    <section id="reservar" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 sm:mb-16"
        >
          <span className="text-primary/80 text-sm uppercase tracking-widest font-medium">Agenda su paseo</span>
          <h2 className="section-title mt-3">
            Reserva su <span className="gradient-text">paseo</span>
          </h2>
          <p className="section-subtitle">
            En 5 pasos simples. Fácil, rápido y seguro.
          </p>
        </motion.div>

        <div className="flex gap-8 max-w-5xl mx-auto">
          {/* Main Form */}
          <div className="flex-1 max-w-2xl">
            {/* Mobile: "Paso X de 5" */}
            <div className="lg:hidden text-center mb-3">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Paso {step} de 5 — {STEP_META[step - 1]?.label}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center mb-8 px-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={5} aria-label={`Paso ${step} de 5: ${STEP_META[step - 1]?.label}`}>
              {STEP_META.map((s, i) => (
                <div key={s.num} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <motion.div
                      animate={{
                        scale: step === s.num ? 1.1 : 1,
                        background: step < s.num ? 'linear-gradient(135deg, #22c55e, #16a34a)' : step === s.num ? 'linear-gradient(135deg, #E67E22, #D35400)' : 'var(--glass-bg)',
                      }}
                      transition={{ duration: 0.3 }}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold border"
                      style={{
                        borderColor: step <= s.num ? 'transparent' : 'var(--border)',
                        color: step <= s.num ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {step > s.num ? <FaCheck size={12} /> : s.num}
                    </motion.div>
                    <span className="text-[10px] sm:text-xs font-medium hidden sm:block"
                      style={{ color: step >= s.num ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEP_META.length - 1 && (
                    <div className="flex-1 h-[2px] mx-1 sm:mx-2 rounded-full transition-colors duration-500"
                      style={{ background: step > s.num ? '#22c55e' : 'var(--border)' }} />
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
                        style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                      >
                        <FaCheckCircle size={36} className="text-white" />
                      </motion.div>
                      <h3 className="text-xl sm:text-2xl font-bold">¡Paseo reservado!</h3>
                      <p className="text-sm text-center max-w-xs" style={{ color: 'var(--text-secondary)' }}>
                        Te contactaremos por WhatsApp en menos de 5 minutos para confirmar.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* ═══════════ STEP 1 — SERVICE ═══════════ */}
                      {step === 1 && (
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold mb-1">¿Qué paseo necesita tu peludo?</h3>
                          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Elige el paquete ideal para tu mascota</p>
                          <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <legend className="sr-only">Selecciona un paseo</legend>
                            {SERVICES.map((svc) => {
                              const price = prices[svc.name] ?? svc.price
                              const selected = form.service === svc.name
                              const { savings } = calculateSavings(svc.name, prices['Paseo Individual'] ?? 30)
                              return (
                                <label
                                  key={svc.name}
                                  className="relative flex items-start gap-3 p-4 rounded-xl text-left transition-all duration-200 border cursor-pointer"
                                  style={{
                                    background: selected ? 'rgba(230,126,34,0.1)' : 'var(--glass-bg)',
                                    borderColor: selected ? '#E67E22' : 'var(--border)',
                                    boxShadow: selected ? '0 0 0 1px #E67E22, 0 4px 16px rgba(230,126,34,0.15)' : 'none',
                                    minHeight: '44px',
                                  }}
                                >
                                  <input
                                    type="radio"
                                    name="service"
                                    value={svc.name}
                                    checked={selected}
                                    onChange={() => set('service', svc.name)}
                                    className="sr-only"
                                  />
                                  <span className="text-2xl sm:text-3xl mt-0.5 shrink-0">{svc.icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                        {svc.name}
                                      </span>
                                      {svc.quantity && savings > 0 && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: '#22c55e' }}>
                                          Ahorra ${savings}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                      {svc.duration} · {svc.modality} · {svc.mainBenefit}
                                    </p>
                                    <p className="text-sm font-bold mt-1.5" style={{ color: 'var(--text-primary)' }}>
                                      ${price.toLocaleString()} MXN
                                    </p>
                                  </div>
                                  {selected && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1"
                                      style={{ background: '#E67E22' }}
                                    >
                                      <FaCheck size={12} className="text-white" />
                                    </motion.div>
                                  )}
                                </label>
                              )
                            })}
                          </fieldset>
                        </div>
                      )}

                      {/* ═══════════ STEP 2 — DATE & TIME ═══════════ */}
                      {step === 2 && (
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold mb-1">¿Cuándo lo paseamos?</h3>
                          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Selecciona fecha y hora disponible</p>

                          <div className="space-y-2 mb-6">
                            <label htmlFor="reservation-date" className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                              <FaCalendarAlt size={13} className="text-primary" /> Fecha <span className="text-red-400">*</span>
                            </label>
                            <input
                              id="reservation-date"
                              type="date"
                              value={form.date}
                              onChange={(e) => { set('date', e.target.value); set('time', '') }}
                              min={today}
                              required
                              className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-primary/30"
                              style={{
                                background: 'var(--glass-bg)',
                                borderColor: 'var(--border)',
                                color: 'var(--text-primary)',
                              }}
                            />
                            {form.date && (
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {new Date(form.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                              </p>
                            )}
                          </div>

                          {form.date && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                <FaClock size={13} className="text-primary" /> Hora <span className="text-red-400">*</span>
                                {loadingSlots && <FaSpinner className="animate-spin" size={11} />}
                              </label>
                              {timeSlots.length === 0 ? (
                                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                                  No hay servicio este día
                                </p>
                              ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                  {timeSlots.map((slot) => {
                                    const booked = bookedSlots.includes(slot)
                                    const selected = form.time === slot
                                    return (
                                      <button
                                        key={slot}
                                        type="button"
                                        disabled={booked}
                                        onClick={() => set('time', slot)}
                                        className="relative py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border"
                                        style={{
                                          background: booked ? 'rgba(239,68,68,0.05)' : selected ? 'rgba(230,126,34,0.15)' : 'var(--glass-bg)',
                                          borderColor: selected ? '#E67E22' : booked ? 'rgba(239,68,68,0.15)' : 'var(--border)',
                                          color: booked ? 'rgba(239,68,68,0.4)' : selected ? '#E67E22' : 'var(--text-secondary)',
                                          cursor: booked ? 'not-allowed' : 'pointer',
                                          textDecoration: booked ? 'line-through' : 'none',
                                          minHeight: '44px',
                                        }}
                                      >
                                        {slot}
                                        {booked && <FaTimes size={9} className="absolute top-1 right-1 text-red-400/40" />}
                                        {selected && <FaCheck size={9} className="absolute top-1 right-1 text-primary" />}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {timeSlots.length - bookedSlots.length} de {timeSlots.length} horarios disponibles
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ═══════════ STEP 3 — PET INFO ═══════════ */}
                      {step === 3 && (
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold mb-1">¿Cómo se llama tu compañero?</h3>
                          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Cuéntanos sobre tu peludo</p>

                          <div className="space-y-5">
                            <div className="space-y-2">
                              <label htmlFor="pet-name" className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                <FaPaw size={13} className="text-primary" /> Nombre <span className="text-red-400">*</span>
                              </label>
                              <input
                                id="pet-name"
                                type="text"
                                value={form.petName}
                                onChange={(e) => set('petName', e.target.value)}
                                onBlur={() => handleBlur('petName')}
                                placeholder="Ej: Max, Luna, Toby..."
                                autoComplete="off"
                                aria-describedby={errors.petName ? 'pet-name-error' : undefined}
                                aria-invalid={!!errors.petName}
                                className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-primary/30"
                                style={{
                                  background: 'var(--glass-bg)',
                                  borderColor: errors.petName ? '#ef4444' : form.petName ? 'rgba(34,197,94,0.4)' : 'var(--border)',
                                  color: 'var(--text-primary)',
                                }}
                              />
                              {errors.petName && touched.petName && (
                                <p id="pet-name-error" className="text-xs text-red-400 flex items-center gap-1" role="alert">
                                  <FaTimes size={10} /> {errors.petName}
                                </p>
                              )}
                              {!errors.petName && form.petName && (
                                <p className="text-xs text-green-400 flex items-center gap-1">
                                  <FaCheck size={10} /> ¡Qué bonito nombre!
                                </p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                <FaDog size={13} className="text-primary" /> Tipo de mascota
                              </label>
                              <div className="grid grid-cols-3 gap-3">
                                {PET_TYPES.map((pt) => {
                                  const selected = form.petType === pt.value
                                  return (
                                    <button
                                      key={pt.value}
                                      type="button"
                                      onClick={() => set('petType', pt.value)}
                                      className="flex flex-col items-center gap-2 py-4 rounded-xl border transition-all duration-200"
                                      style={{
                                        background: selected ? 'rgba(230,126,34,0.1)' : 'var(--glass-bg)',
                                        borderColor: selected ? '#E67E22' : 'var(--border)',
                                        minHeight: '44px',
                                      }}
                                    >
                                      <span className="text-2xl">{pt.emoji}</span>
                                      <span className="text-xs font-medium" style={{ color: selected ? '#E67E22' : 'var(--text-secondary)' }}>
                                        {pt.label}
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ═══════════ STEP 4 — CONTACT ═══════════ */}
                      {step === 4 && (
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold mb-1">¿Cómo te contactamos?</h3>
                          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Solo usamos tu información para confirmar el paseo</p>

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label htmlFor="owner-name" className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                <FaUser size={13} className="text-primary" /> Tu nombre <span className="text-red-400">*</span>
                              </label>
                              <input
                                id="owner-name"
                                type="text"
                                value={form.name}
                                onChange={(e) => set('name', e.target.value)}
                                onBlur={() => handleBlur('name')}
                                placeholder="Ej: María García"
                                autoComplete="name"
                                aria-describedby={errors.name ? 'name-error' : undefined}
                                aria-invalid={!!errors.name}
                                className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-primary/30"
                                style={{
                                  background: 'var(--glass-bg)',
                                  borderColor: errors.name ? '#ef4444' : form.name ? 'rgba(34,197,94,0.4)' : 'var(--border)',
                                  color: 'var(--text-primary)',
                                }}
                              />
                              {errors.name && touched.name && (
                                <p id="name-error" className="text-xs text-red-400 flex items-center gap-1" role="alert">
                                  <FaTimes size={10} /> {errors.name}
                                </p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <label htmlFor="owner-phone" className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                <FaPhone size={13} className="text-primary" /> WhatsApp <span className="text-red-400">*</span>
                              </label>
                              <input
                                id="owner-phone"
                                type="tel"
                                value={form.phone}
                                onChange={(e) => set('phone', e.target.value)}
                                onBlur={() => handleBlur('phone')}
                                placeholder="Ej: 5512345678"
                                autoComplete="tel"
                                inputMode="tel"
                                aria-describedby={errors.phone ? 'phone-error' : undefined}
                                aria-invalid={!!errors.phone}
                                className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-primary/30"
                                style={{
                                  background: 'var(--glass-bg)',
                                  borderColor: errors.phone ? '#ef4444' : form.phone.replace(/\D/g, '').length >= 10 ? 'rgba(34,197,94,0.4)' : 'var(--border)',
                                  color: 'var(--text-primary)',
                                }}
                              />
                              {errors.phone && touched.phone && (
                                <p id="phone-error" className="text-xs text-red-400 flex items-center gap-1" role="alert">
                                  <FaTimes size={10} /> {errors.phone}
                                </p>
                              )}
                              {!errors.phone && form.phone.replace(/\D/g, '').length >= 10 && (
                                <p className="text-xs text-green-400 flex items-center gap-1">
                                  <FaCheck size={10} /> Número válido
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setShowNotes(!showNotes)}
                              className="flex items-center gap-2 text-xs transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <FaInfoCircle size={12} />
                              {showNotes ? 'Ocultar notas' : '¿Algo que debamos saber?'} <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>(opcional)</span>
                            </button>
                            <AnimatePresence>
                              {showNotes && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <textarea
                                    value={form.notes}
                                    onChange={(e) => set('notes', e.target.value)}
                                    rows={3}
                                    placeholder="Ej: Mi perro es nervioso con otros perros grandes..."
                                    className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                                    style={{
                                      background: 'var(--glass-bg)',
                                      borderColor: 'var(--border)',
                                      color: 'var(--text-primary)',
                                    }}
                                  />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      )}

                      {/* ═══════════ STEP 5 — CONFIRM ═══════════ */}
                      {step === 5 && (
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold mb-1">¡Revisa tu reserva!</h3>
                          <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Confirma que todo esté correcto</p>

                          <div className="rounded-xl p-4 sm:p-5 space-y-3 mb-5"
                            style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                            {/* Service */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{getServiceMeta(form.service)?.icon || '🐾'}</span>
                                <div>
                                  <p className="text-sm font-semibold">{form.service}</p>
                                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {getServiceMeta(form.service)?.duration} · {getServiceMeta(form.service)?.modality}
                                  </p>
                                </div>
                              </div>
                              <button onClick={() => goToStep(1)} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-all hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                                <FaEdit size={10} /> Editar
                              </button>
                            </div>

                            <div className="h-px" style={{ background: 'var(--border)' }} />

                            {/* Date & Time */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                <span className="flex items-center gap-1.5">
                                  <FaCalendarAlt size={12} className="text-primary" />
                                  {form.date ? new Date(form.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <FaClock size={12} className="text-primary" /> {form.time}
                                </span>
                              </div>
                              <button onClick={() => goToStep(2)} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-all hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                                <FaEdit size={10} /> Editar
                              </button>
                            </div>

                            <div className="h-px" style={{ background: 'var(--border)' }} />

                            {/* Pet */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                <FaPaw size={12} className="text-primary" />
                                {form.petName} ({PET_TYPES.find((p) => p.value === form.petType)?.label})
                              </div>
                              <button onClick={() => goToStep(3)} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-all hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                                <FaEdit size={10} /> Editar
                              </button>
                            </div>

                            <div className="h-px" style={{ background: 'var(--border)' }} />

                            {/* Owner */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                <span className="flex items-center gap-1.5">
                                  <FaUser size={12} className="text-primary" /> {form.name}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <FaPhone size={12} className="text-primary" /> {form.phone}
                                </span>
                              </div>
                              <button onClick={() => goToStep(4)} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-all hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                                <FaEdit size={10} /> Editar
                              </button>
                            </div>

                            {form.notes && (
                              <>
                                <div className="h-px" style={{ background: 'var(--border)' }} />
                                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                  <span className="flex items-center gap-1.5">
                                    <FaCommentAlt size={12} className="text-primary" /> {form.notes}
                                  </span>
                                </div>
                              </>
                            )}

                            {/* Price */}
                            <div className="h-px" style={{ background: 'var(--border)' }} />
                            <div className="space-y-1">
                              {basePrice > 0 && (
                                <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                                  <span>Subtotal</span><span>${basePrice.toLocaleString()}</span>
                                </div>
                              )}
                              {discountAmount > 0 && (
                                <div className="flex justify-between text-sm text-green-400">
                                  <span>Descuento ({form.coupon.toUpperCase()})</span><span>-${discountAmount.toLocaleString()}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-base font-bold pt-1">
                                <span>Total</span>
                                <span className="gradient-text">${finalPrice.toLocaleString()} MXN</span>
                              </div>
                            </div>
                          </div>

                          {/* Coupon */}
                          <div className="mb-5">
                            <button type="button" onClick={() => setShowCoupon(!showCoupon)}
                              className="flex items-center gap-2 text-xs mb-2 transition-colors" style={{ color: 'var(--text-muted)' }}>
                              <FaTicketAlt size={12} /> ¿Tienes un cupón? <span className="text-[10px]">(opcional)</span>
                            </button>
                            <AnimatePresence>
                              {showCoupon && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={form.coupon}
                                      onChange={(e) => set('coupon', e.target.value)}
                                      placeholder="Código de cupón"
                                      autoComplete="off"
                                      className="w-full px-4 py-2.5 pr-10 rounded-xl text-sm border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                      style={{
                                        background: 'var(--glass-bg)',
                                        borderColor: couponStatus?.valid ? '#22c55e' : couponStatus && !couponStatus.valid ? '#ef4444' : 'var(--border)',
                                        color: 'var(--text-primary)',
                                      }}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                      {checkingCoupon ? <FaSpinner className="animate-spin" size={13} style={{ color: 'var(--text-muted)' }} />
                                        : couponStatus?.valid ? <FaCheck size={13} className="text-green-400" />
                                        : couponStatus && !couponStatus.valid ? <FaTimes size={13} className="text-red-400" /> : null}
                                    </div>
                                  </div>
                                  {couponStatus && (
                                    <p className={`text-xs mt-1 ${couponStatus.valid ? 'text-green-400' : 'text-red-400'}`}>
                                      {couponStatus.msg}
                                    </p>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Trust Signals */}
                          <div className="grid grid-cols-2 gap-2 mb-5">
                            {[
                              { icon: <FaStar size={12} />, text: '4.9/5 — 250+ paseos', color: '#E67E22' },
                              { icon: <FaBolt size={12} />, text: 'Respuesta en 5 min', color: '#22c55e' },
                              { icon: <FaShieldAlt size={12} />, text: 'Paseadores verificados', color: '#3b82f6' },
                              { icon: <FaHeart size={12} />, text: 'Seguro para mascotas', color: '#ec4899' },
                            ].map((badge, i) => (
                              <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg text-xs"
                                style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                                <span style={{ color: badge.color }}>{badge.icon}</span>
                                <span style={{ color: 'var(--text-secondary)' }}>{badge.text}</span>
                              </div>
                            ))}
                          </div>

                          <p className="text-xs text-center mb-4 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                            No se realizará ningún cobro desde esta página.<br />
                            Confirmaremos la disponibilidad contigo por WhatsApp.
                          </p>

                          {rateError && <p className="text-xs text-red-400 text-center mb-3">{rateError}</p>}
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              {!sent && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={goBack}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                      style={{ background: 'var(--glass-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', minHeight: '44px' }}
                    >
                      <FaArrowLeft size={12} /> Atrás
                    </button>
                  ) : <div />}

                  {step < 5 ? (
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!canProceed}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: 'linear-gradient(135deg, #E67E22, #D35400)', minHeight: '44px' }}
                    >
                      {ctaLabel} <FaArrowRight size={12} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canProceed || sending}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 16px rgba(34,197,94,0.3)', minHeight: '44px' }}
                    >
                      {sending ? <><FaSpinner className="animate-spin" size={14} /> Enviando...</> : <><FaWhatsapp size={14} /> Confirmar por WhatsApp</>}
                    </button>
                  )}
                </div>
              )}

              {/* Honeypot */}
              <input tabIndex={-1} autoComplete="off" onChange={(e) => { honeypot.current = e.target.value }} className="absolute opacity-0 pointer-events-none" style={{ height: 0, width: 0 }} aria-hidden="true" />
            </motion.div>
          </div>

          {/* Desktop: BookingSummary sidebar */}
          <BookingSummary step={step} form={form} prices={prices} couponStatus={couponStatus} />
        </div>

        {/* Mobile: Fixed bottom CTA */}
        {!sent && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-4 pb-[env(safe-area-inset-bottom)]"
            style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between py-3">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{ background: 'var(--glass-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', minHeight: '44px' }}
                >
                  <FaArrowLeft size={10} /> Atrás
                </button>
              ) : <div />}

              {step < 5 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canProceed}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #E67E22, #D35400)', minHeight: '44px' }}
                >
                  {ctaLabel} <FaArrowRight size={12} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canProceed || sending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', minHeight: '44px' }}
                >
                  {sending ? <><FaSpinner className="animate-spin" size={14} /> ...</> : <><FaWhatsapp size={14} /> Confirmar</>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
