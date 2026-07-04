'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { db } from '@/firebase/config'
import { collection, addDoc, serverTimestamp, getDocs, query, where, limit } from 'firebase/firestore'
import { WHATSAPP_NUMBER } from '@/lib/utils'
import { SERVICE_NAMES, getServicePrice } from '@/lib/services'
import AvailabilityCalendar from './AvailabilityCalendar'
import { showPushNotification } from './PWARegister'
import {
  FaDog,
  FaCalendarAlt,
  FaClock,
  FaPhone,
  FaUser,
  FaCommentAlt,
  FaPaw,
  FaSpinner,
  FaCheckCircle,
  FaWalking,
  FaTag,
  FaCheck,
  FaTimes,
} from 'react-icons/fa'

export default function ReservationForm({ onPhoneChange }: { onPhoneChange?: (phone: string) => void }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    petName: '',
    petType: 'perro',
    service: '',
    date: '',
    time: '',
    notes: '',
    coupon: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [couponStatus, setCouponStatus] = useState<{ valid: boolean; msg: string; discount?: number; type?: 'percentage' | 'fixed' } | null>(null)
  const [checkingCoupon, setCheckingCoupon] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const val = e.target.value
    setForm((prev) => ({ ...prev, [e.target.name]: val }))
    if (e.target.name === 'phone') onPhoneChange?.(val)
  }

  const checkCoupon = async (code: string) => {
    if (!code.trim()) { setCouponStatus(null); return }
    setCheckingCoupon(true)
    const q = query(collection(db, 'coupons'), where('code', '==', code.trim().toUpperCase()), where('active', '==', true), limit(1))
    const snap = await getDocs(q)
    if (snap.empty) {
      setCouponStatus({ valid: false, msg: 'Cupón no válido' })
    } else {
      const c = snap.docs[0].data()
      if (c.maxUses > 0 && c.usedCount >= c.maxUses) {
        setCouponStatus({ valid: false, msg: 'Este cupón ya no está disponible' })
      } else {
        setCouponStatus({ valid: true, msg: `Descuento aplicado: ${c.type === 'percentage' ? `${c.discount}%` : `$${c.discount}`}`, discount: c.discount, type: c.type })
      }
    }
    setCheckingCoupon(false)
  }

  const handleCouponChange = (val: string) => {
    setForm((prev) => ({ ...prev, coupon: val }))
    setCouponStatus(null)
    if (val.length >= 3) checkCoupon(val)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)

    const basePrice = getServicePrice(form.service)
    let discountAmount = 0
    if (couponStatus?.valid && couponStatus.discount) {
      discountAmount = couponStatus.type === 'percentage' ? Math.round(basePrice * couponStatus.discount / 100) : couponStatus.discount
    }
    const finalPrice = basePrice - discountAmount

    let message = `🐾 *Nuevo Paseo - Paseos Quebrada* 🐾
    *Nombre:* ${form.name}
    *Teléfono:* ${form.phone}
    *Perro:* ${form.petName} (${form.petType})
    *Paquete:* ${form.service}`
    if (basePrice > 0) message += `\n    *Precio:* $${basePrice.toLocaleString()}`
    if (discountAmount > 0) message += `\n    *Descuento:* -$${discountAmount.toLocaleString()} (${form.coupon.toUpperCase()})`
    message += `\n    *Total:* $${finalPrice.toLocaleString()}`
    message += `\n    *Fecha:* ${form.date}
    *Hora:* ${form.time}
    *Notas:* ${form.notes || 'Sin notas'}`

    try {
      await addDoc(collection(db, 'reservations'), {
        ...form,
        createdAt: serverTimestamp(),
        status: 'pending',
        appliedCoupon: form.coupon.toUpperCase(),
        discountApplied: discountAmount,
        finalPrice,
      })
      showPushNotification(
        '🐾 Nueva reserva recibida',
        form.name + ' agendó "' + form.service + '" para ' + form.petName
      )
    } catch {
      // Firebase save optional
    }

    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank')

    setSending(false)
    setSent(true)
    setCouponStatus(null)
    setForm({
      name: '',
      phone: '',
      petName: '',
      petType: 'perro',
      service: '',
      date: '',
      time: '',
      notes: '',
      coupon: '',
    })

    setTimeout(() => setSent(false), 5000)
  }

  return (
    <section id="reservar" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-primary/80 text-sm uppercase tracking-widest font-medium">
            Agenda su paseo
          </span>
          <h2 className="section-title mt-3">
            Reserva su{' '}
            <span className="gradient-text">paseo</span>
          </h2>
          <p className="section-subtitle">
            Llena el formulario y te enviaremos la confirmación directo a tu
            WhatsApp. Fácil y rápido. ¡Tu perro te lo va a agradecer!
          </p>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="glass-card p-6 sm:p-10 space-y-5"
          >
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm text-white/60 flex items-center gap-2">
                  <FaUser className="text-primary" size={12} />
                  Tu nombre
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Ej: María García"
                  className="input-field"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/60 flex items-center gap-2">
                  <FaPhone className="text-primary" size={12} />
                  WhatsApp
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  placeholder="Ej: 5523053772"
                  className="input-field"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm text-white/60 flex items-center gap-2">
                  <FaPaw className="text-primary" size={12} />
                  Nombre de tu perro
                </label>
                <input
                  type="text"
                  name="petName"
                  value={form.petName}
                  onChange={handleChange}
                  required
                  placeholder="Ej: Max"
                  className="input-field"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/60 flex items-center gap-2">
                  <FaDog className="text-primary" size={12} />
                  Raza o talla
                </label>
                <select
                  name="petType"
                  value={form.petType}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="perro">Perro</option>
                  <option value="gato">Gato</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/60 flex items-center gap-2">
                <FaWalking className="text-primary" size={12} />
                Paquete de paseo
              </label>
              <select
                name="service"
                value={form.service}
                onChange={handleChange}
                required
                className="input-field"
              >
                <option value="">Selecciona un paquete</option>
                  {SERVICE_NAMES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm text-white/60 flex items-center gap-2">
                  <FaCalendarAlt className="text-primary" size={12} />
                  Fecha
                </label>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  required
                  className="input-field"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/60 flex items-center gap-2">
                  <FaClock className="text-primary" size={12} />
                  Hora
                </label>
                <input
                  type="time"
                  name="time"
                  value={form.time}
                  onChange={handleChange}
                  required
                  className="input-field"
                />
              </div>
            </div>

            {form.date && (
              <div className="space-y-2">
                <label className="text-sm text-white/40 flex items-center gap-2">
                  <FaCalendarAlt className="text-primary" size={10} />
                  Disponibilidad
                </label>
                <div className="glass-card p-3">
                  <AvailabilityCalendar
                    date={form.date}
                    onSelect={(time) => setForm((prev) => ({ ...prev, time }))}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-white/60 flex items-center gap-2">
                <FaCommentAlt className="text-primary" size={12} />
                Notas adicionales
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Alguna observación importante..."
                className="input-field resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/60 flex items-center gap-2">
                <FaTag className="text-primary" size={12} />
                Cupón de descuento
              </label>
              <div className="relative">
                <input
                  name="coupon"
                  value={form.coupon}
                  onChange={(e) => handleCouponChange(e.target.value)}
                  placeholder="Código (opcional)"
                  className="input-field pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingCoupon ? (
                    <FaSpinner className="animate-spin text-white/30" size={14} />
                  ) : couponStatus ? (
                    couponStatus.valid ? <FaCheck className="text-green-400" size={14} /> : <FaTimes className="text-red-400" size={14} />
                  ) : null}
                </div>
              </div>
              {couponStatus && (
                <p className={`text-xs ${couponStatus.valid ? 'text-green-400' : 'text-red-400'}`}>
                  {couponStatus.msg}
                </p>
              )}
            </div>

            <motion.button
              type="submit"
              disabled={sending || sent}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary w-full text-lg flex items-center justify-center gap-2"
            >
              {sending ? (
                <FaSpinner className="animate-spin" />
              ) : sent ? (
                <FaCheckCircle />
              ) : (
                <FaPhone />
              )}
              {sending
                ? 'Enviando...'
                : sent
                ? '¡Enviado!'
                : 'Reservar paseo por WhatsApp'}
            </motion.button>

            {sent && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-green-400 text-sm"
              >
                ¡Solicitud enviada! Te contactaremos por WhatsApp.
              </motion.p>
            )}
          </motion.form>
        </div>
      </div>
    </section>
  )
}
