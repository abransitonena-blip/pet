'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/firebase/config'
import { collection, addDoc, serverTimestamp, getDocs, query, where, limit, onSnapshot } from 'firebase/firestore'
import { WHATSAPP_NUMBER } from '@/lib/utils'
import { SERVICES, getServicePrice } from '@/lib/services'
import { usePrices } from '@/context/PricesContext'
import { showPushNotification } from './PWARegister'
import {
  FaDog, FaCalendarAlt, FaClock, FaPhone, FaUser, FaCommentAlt,
  FaPaw, FaSpinner, FaCheckCircle, FaTag, FaCheck, FaTimes,
  FaArrowRight, FaArrowLeft, FaShieldAlt, FaStar, FaBolt, FaHeart,
  FaTicketAlt, FaInfoCircle,
} from 'react-icons/fa'

/* ──────────────────────────────────────────────
   CONSTANTS
   ────────────────────────────────────────────── */

const TIME_SLOTS = [
  '07:00','08:00','09:00','10:00','11:00','12:00',
  '13:00','14:00','15:00','16:00','17:00','18:00',
]

const SERVICE_META: Record<string, { emoji: string; tag?: string; tagColor?: string; desc: string }> = {
  'Paseo Individual (30 min)': { emoji: '🐕', desc: 'Atención 1 a 1, ruta personalizada' },
  'Paseo Extendido (1 hora)':  { emoji: '🏃', tag: 'Popular', tagColor: '#E67E22', desc: 'La favorita — juegos y ejercicios' },
  'Paseo Grupal (45 min)':     { emoji: '👥', desc: 'Socialización con otros perros' },
  'Paseo + Adiestramiento (1 hora)': { emoji: '🎓', desc: 'Comandos básicos + paseo' },
  'Paseo Express (20 min)':    { emoji: '⚡', desc: 'Rápido — entre comidas o antes de dormir' },
  'Paseo + Reporte (45 min)':  { emoji: '📸', desc: 'Fotos + mapa del recorrido' },
  'Paquete Semanal (6 paseos)':{ emoji: '📅', tag: 'Ahorra $60', tagColor: '#22c55e', desc: 'Lunes a sábado — el mejor precio' },
}

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

/* ──────────────────────────────────────────────
   ANIMATION VARIANTS
   ────────────────────────────────────────────── */

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
}

/* ──────────────────────────────────────────────
   MAIN COMPONENT
   ────────────────────────────────────────────── */

export default function ReservationForm({ onPhoneChange, onFocusChange }: {
  onPhoneChange?: (phone: string) => void
  onFocusChange?: (active: boolean) => void
}) {
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [form, setForm] = useState({
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

  /* ── Effects ── */

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

  /* ── Handlers ── */

  const set = useCallback(<K extends keyof typeof form>(key: K, val: string) => {
    setForm((p) => ({ ...p, [key]: val }))
    if (key === 'phone') onPhoneChange?.(val)
  }, [onPhoneChange])

  const goNext = () => { setDirection(1); setStep((s) => Math.min(s + 1, 5)) }
  const goBack = () => { setDirection(-1); setStep((s) => Math.max(s - 1, 1)) }

  const canProceed = useMemo(() => {
    switch (step) {
      case 1: return !!form.service
      case 2: return !!form.date && !!form.time
      case 3: return !!form.petName.trim()
      case 4: return !!form.name.trim() && form.phone.replace(/\D/g, '').length >= 10
      default: return true
    }
  }, [step, form])

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
    }, 5000)
  }

  /* ── Price calc ── */
  const basePrice = form.service ? (prices[form.service] ?? getServicePrice(form.service)) : 0
  const discountAmount = couponStatus?.valid && couponStatus.discount
    ? (couponStatus.type === 'percentage' ? Math.round(basePrice * couponStatus.discount / 100) : couponStatus.discount)
    : 0
  const finalPrice = basePrice - discountAmount

  const today = new Date().toISOString().split('T')[0]

  /* ──────────────────────────────────────────────
     RENDER
     ────────────────────────────────────────────── */

  return (
    <section id="reservar" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Header ── */}
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

        <div className="max-w-2xl mx-auto">
          {/* ── Progress Bar ── */}
          <div className="flex items-center mb-8 px-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={5} aria-label={`Paso ${step} de 5`}>
            {STEP_META.map((s, i) => (
              <div key={s.num} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <motion.div
                    animate={{
                      scale: step === s.num ? 1.1 : 1,
                      background: step <= s.num ? 'linear-gradient(135deg, #E67E22, #D35400)' : 'var(--glass-bg)',
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
                    style={{ background: step > s.num ? '#E67E22' : 'var(--border)' }} />
                )}
              </div>
            ))}
          </div>

          {/* ── Form Card ── */}
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
                {/* ── SUCCESS STATE ── */}
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
                    {/* ════════════════════════════════════════
                        STEP 1 — SERVICE SELECTION
                       ════════════════════════════════════════ */}
                    {step === 1 && (
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold mb-1">¿Qué paseo necesita tu peludo?</h3>
                        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Elige el paquete ideal para tu mascota</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {SERVICES.map((svc) => {
                            const meta = SERVICE_META[svc.name] || { emoji: '🐾', desc: '' }
                            const selected = form.service === svc.name
                            const price = prices[svc.name] ?? svc.price
                            return (
                              <motion.button
                                key={svc.name}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => set('service', svc.name)}
                                className="relative flex items-start gap-3 p-4 rounded-xl text-left transition-all duration-200 border"
                                style={{
                                  background: selected ? 'rgba(230,126,34,0.1)' : 'var(--glass-bg)',
                                  borderColor: selected ? '#E67E22' : 'var(--border)',
                                  boxShadow: selected ? '0 0 0 1px #E67E22, 0 4px 16px rgba(230,126,34,0.15)' : 'none',
                                }}
                              >
                                <span className="text-2xl sm:text-3xl mt-0.5 shrink-0">{meta.emoji}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                      {svc.name.replace(/\(.*\)/, '').trim()}
                                    </span>
                                    {meta.tag && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                                        style={{ background: meta.tagColor || '#E67E22' }}>
                                        {meta.tag}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {svc.name.match(/\((.+)\)/)?.[1]} · {meta.desc}
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
                              </motion.button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* ════════════════════════════════════════
                        STEP 2 — DATE & TIME
                       ════════════════════════════════════════ */}
                    {step === 2 && (
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold mb-1">¿Cuándo lo paseamos?</h3>
                        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Selecciona fecha y hora disponible</p>

                        {/* Date */}
                        <div className="space-y-2 mb-6">
                          <label className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                            <FaCalendarAlt size={13} className="text-primary" /> Fecha
                          </label>
                          <input
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

                        {/* Time slots */}
                        {form.date && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                              <FaClock size={13} className="text-primary" /> Hora
                              {loadingSlots && <FaSpinner className="animate-spin" size={11} />}
                            </label>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {TIME_SLOTS.map((slot) => {
                                const booked = bookedSlots.includes(slot)
                                const selected = form.time === slot
                                return (
                                  <motion.button
                                    key={slot}
                                    whileTap={{ scale: 0.95 }}
                                    disabled={booked}
                                    onClick={() => set('time', slot)}
                                    className="relative py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border"
                                    style={{
                                      background: booked ? 'rgba(239,68,68,0.05)' : selected ? 'rgba(230,126,34,0.15)' : 'var(--glass-bg)',
                                      borderColor: selected ? '#E67E22' : booked ? 'rgba(239,68,68,0.15)' : 'var(--border)',
                                      color: booked ? 'rgba(239,68,68,0.4)' : selected ? '#E67E22' : 'var(--text-secondary)',
                                      cursor: booked ? 'not-allowed' : 'pointer',
                                      textDecoration: booked ? 'line-through' : 'none',
                                    }}
                                  >
                                    {slot}
                                    {booked && <FaTimes size={9} className="absolute top-1 right-1 text-red-400/40" />}
                                    {selected && <FaCheck size={9} className="absolute top-1 right-1 text-primary" />}
                                  </motion.button>
                                )
                              })}
                            </div>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {TIME_SLOTS.length - bookedSlots.length} de {TIME_SLOTS.length} horarios disponibles
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ════════════════════════════════════════
                        STEP 3 — PET INFO
                       ════════════════════════════════════════ */}
                    {step === 3 && (
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold mb-1">¿Cómo se llama tu compañero?</h3>
                        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Cuéntanos sobre tu peludo</p>

                        <div className="space-y-5">
                          <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                              <FaPaw size={13} className="text-primary" /> Nombre
                            </label>
                            <input
                              type="text"
                              value={form.petName}
                              onChange={(e) => set('petName', e.target.value)}
                              placeholder="Ej: Max, Luna, Toby..."
                              autoComplete="off"
                              className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-primary/30"
                              style={{
                                background: 'var(--glass-bg)',
                                borderColor: form.petName ? 'rgba(34,197,94,0.4)' : 'var(--border)',
                                color: 'var(--text-primary)',
                              }}
                            />
                            {form.petName && (
                              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                                className="text-xs text-green-400 flex items-center gap-1">
                                <FaCheck size={10} /> ¡Qué bonito nombre!
                              </motion.p>
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
                                  <motion.button
                                    key={pt.value}
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => set('petType', pt.value)}
                                    className="flex flex-col items-center gap-2 py-4 rounded-xl border transition-all duration-200"
                                    style={{
                                      background: selected ? 'rgba(230,126,34,0.1)' : 'var(--glass-bg)',
                                      borderColor: selected ? '#E67E22' : 'var(--border)',
                                    }}
                                  >
                                    <span className="text-2xl">{pt.emoji}</span>
                                    <span className="text-xs font-medium" style={{ color: selected ? '#E67E22' : 'var(--text-secondary)' }}>
                                      {pt.label}
                                    </span>
                                  </motion.button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ════════════════════════════════════════
                        STEP 4 — CONTACT INFO
                       ════════════════════════════════════════ */}
                    {step === 4 && (
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold mb-1">¿Cómo te contactamos?</h3>
                        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Solo usamos tu información para confirmar el paseo</p>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                              <FaUser size={13} className="text-primary" /> Tu nombre
                            </label>
                            <input
                              type="text"
                              value={form.name}
                              onChange={(e) => set('name', e.target.value)}
                              placeholder="Ej: María García"
                              autoComplete="name"
                              className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-primary/30"
                              style={{
                                background: 'var(--glass-bg)',
                                borderColor: form.name ? 'rgba(34,197,94,0.4)' : 'var(--border)',
                                color: 'var(--text-primary)',
                              }}
                            />
                            {form.name && (
                              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="text-xs text-green-400 flex items-center gap-1"><FaCheck size={10} /> Correcto</motion.p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                              <FaPhone size={13} className="text-primary" /> WhatsApp
                            </label>
                            <input
                              type="tel"
                              value={form.phone}
                              onChange={(e) => set('phone', e.target.value)}
                              placeholder="Ej: 5512345678"
                              autoComplete="tel"
                              inputMode="tel"
                              className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-primary/30"
                              style={{
                                background: 'var(--glass-bg)',
                                borderColor: form.phone.replace(/\D/g, '').length >= 10 ? 'rgba(34,197,94,0.4)' : 'var(--border)',
                                color: 'var(--text-primary)',
                              }}
                            />
                            {form.phone.replace(/\D/g, '').length >= 10 && (
                              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="text-xs text-green-400 flex items-center gap-1"><FaCheck size={10} /> Número válido</motion.p>
                            )}
                          </div>

                          {/* Notes toggle */}
                          <button
                            type="button"
                            onClick={() => setShowNotes(!showNotes)}
                            className="flex items-center gap-2 text-xs transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <FaInfoCircle size={12} />
                            {showNotes ? 'Ocultar notas' : '¿Algo que debamos saber?'}
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

                    {/* ════════════════════════════════════════
                        STEP 5 — CONFIRM
                       ════════════════════════════════════════ */}
                    {step === 5 && (
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold mb-1">¡Revisa tu reserva!</h3>
                        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Confirma que todo esté correcto</p>

                        {/* Summary Card */}
                        <div className="rounded-xl p-4 sm:p-5 space-y-3 mb-5"
                          style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                          {/* Service */}
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{SERVICE_META[form.service]?.emoji || '🐾'}</span>
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{form.service.replace(/\(.*\)/, '').trim()}</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {form.service.match(/\((.+)\)/)?.[1]}
                              </p>
                            </div>
                          </div>
                          <div className="h-px" style={{ background: 'var(--border)' }} />
                          {/* Date & Time */}
                          <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <span className="flex items-center gap-1.5">
                              <FaCalendarAlt size={12} className="text-primary" />
                              {form.date ? new Date(form.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <FaClock size={12} className="text-primary" /> {form.time}
                            </span>
                          </div>
                          <div className="h-px" style={{ background: 'var(--border)' }} />
                          {/* Pet & Owner */}
                          <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <span className="flex items-center gap-1.5">
                              <FaPaw size={12} className="text-primary" />
                              {form.petName} ({PET_TYPES.find((p) => p.value === form.petType)?.label})
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <span className="flex items-center gap-1.5">
                              <FaUser size={12} className="text-primary" /> {form.name}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <FaPhone size={12} className="text-primary" /> {form.phone}
                            </span>
                          </div>
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
                          <button type="button" onClick={() => setShowNotes(!showNotes)}
                            className="flex items-center gap-2 text-xs mb-2 transition-colors" style={{ color: 'var(--text-muted)' }}>
                            <FaTicketAlt size={12} /> ¿Tienes un cupón?
                          </button>
                          <AnimatePresence>
                            {showNotes && (
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

                        {rateError && <p className="text-xs text-red-400 text-center mb-3">{rateError}</p>}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            {/* ── Navigation ── */}
            {!sent && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                {step > 1 ? (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={goBack}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                    style={{ background: 'var(--glass-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    <FaArrowLeft size={12} /> Atrás
                  </motion.button>
                ) : <div />}

                {step < 5 ? (
                  <motion.button
                    whileHover={{ scale: canProceed ? 1.02 : 1 }}
                    whileTap={{ scale: canProceed ? 0.98 : 1 }}
                    onClick={goNext}
                    disabled={!canProceed}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #E67E22, #D35400)' }}
                  >
                    Siguiente <FaArrowRight size={12} />
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: canProceed ? 1.02 : 1 }}
                    whileTap={{ scale: canProceed ? 0.98 : 1 }}
                    onClick={handleSubmit}
                    disabled={!canProceed || sending}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #E67E22, #D35400)', boxShadow: '0 4px 16px rgba(230,126,34,0.3)' }}
                  >
                    {sending ? <><FaSpinner className="animate-spin" size={14} /> Enviando...</> : <>🐾 Confirmar mi paseo</>}
                  </motion.button>
                )}
              </div>
            )}

            {/* ── Honeypot ── */}
            <input tabIndex={-1} autoComplete="off" onChange={(e) => { honeypot.current = e.target.value }} className="absolute opacity-0 pointer-events-none" style={{ height: 0, width: 0 }} aria-hidden="true" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
