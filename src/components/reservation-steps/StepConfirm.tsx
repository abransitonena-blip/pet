'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { getServiceMeta } from '@/lib/services'
import { CalendarDays, Clock, PawPrint, User, Phone, Dog, MessageSquare, Pencil, Star, Zap, ShieldCheck, Heart, Ticket, Loader2, Check, X } from 'lucide-react'

const PET_TYPES = [
  { value: 'perro', label: 'Perro' },
  { value: 'gato', label: 'Gato' },
  { value: 'otro', label: 'Otro' },
]

export default function StepConfirm({
  form, goToStep, isWeeklyPackage, weeklySchedule, walkerPreference, availableWalkers,
  basePrice, discountAmount, finalPrice, showCoupon, setShowCoupon, set,
  couponStatus, checkingCoupon, rateError,
}: {
  form: { service: string; date: string; time: string; petName: string; petType: string; name: string; phone: string; notes: string; coupon: string }
  goToStep: (step: number) => void
  isWeeklyPackage: boolean
  weeklySchedule: Record<string, string>
  walkerPreference: string
  availableWalkers: { id: string; name: string }[]
  basePrice: number
  discountAmount: number
  finalPrice: number
  showCoupon: boolean
  setShowCoupon: (v: boolean) => void
  set: (key: string, val: string) => void
  couponStatus: { valid: boolean; msg: string; discount?: number; type?: 'percentage' | 'fixed' } | null
  checkingCoupon: boolean
  rateError: string
}) {
  return (
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
          <button onClick={() => goToStep(1)} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-all hover:bg-ink/5" style={{ color: 'var(--text-muted)' }}>
            <Pencil size={10} /> Editar
          </button>
        </div>

        <div className="h-px" style={{ background: 'var(--border)' }} />

        {/* Date & Time */}
        <div className="flex items-center justify-between">
          <div className="flex-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {isWeeklyPackage && Object.values(weeklySchedule).some((t) => t) ? (
              <div className="space-y-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <CalendarDays size={12} className="text-primary" /> {Object.values(weeklySchedule).filter(Boolean).length} sesiones en la semana
                </span>
                {Object.entries(weeklySchedule).filter(([, t]) => t).sort().slice(0, 3).map(([date, time]) => (
                  <div key={date} className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span className="capitalize">{new Date(date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })}</span>
                    <span className="flex items-center gap-1"><Clock size={8} /> {time}</span>
                  </div>
                ))}
                {Object.values(weeklySchedule).filter(Boolean).length > 3 && (
                  <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>+{Object.values(weeklySchedule).filter(Boolean).length - 3} más</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={12} className="text-primary" />
                  {form.date ? new Date(form.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={12} className="text-primary" /> {form.time}
                </span>
              </div>
            )}
          </div>
          <button onClick={() => goToStep(2)} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-all hover:bg-ink/5 shrink-0" style={{ color: 'var(--text-muted)' }}>
            <Pencil size={10} /> Editar
          </button>
        </div>

        <div className="h-px" style={{ background: 'var(--border)' }} />

        {/* Pet */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <PawPrint size={12} className="text-primary" />
            {form.petName} ({PET_TYPES.find((p) => p.value === form.petType)?.label})
          </div>
          <button onClick={() => goToStep(3)} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-all hover:bg-ink/5" style={{ color: 'var(--text-muted)' }}>
            <Pencil size={10} /> Editar
          </button>
        </div>

        <div className="h-px" style={{ background: 'var(--border)' }} />

        {/* Owner */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex items-center gap-1.5">
              <User size={12} className="text-primary" /> {form.name}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone size={12} className="text-primary" /> {form.phone}
            </span>
          </div>
          <button onClick={() => goToStep(4)} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-all hover:bg-ink/5" style={{ color: 'var(--text-muted)' }}>
            <Pencil size={10} /> Editar
          </button>
        </div>

        <div className="h-px" style={{ background: 'var(--border)' }} />

        {/* Walker Preference */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Dog size={12} className="text-primary" />
            {walkerPreference
              ? availableWalkers.find((w) => w.id === walkerPreference)?.name || 'Paseador preferido'
              : 'Asignación automática'}
          </div>
          <button onClick={() => goToStep(5)} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-all hover:bg-ink/5" style={{ color: 'var(--text-muted)' }}>
            <Pencil size={10} /> Editar
          </button>
        </div>

        {form.notes && (
          <>
            <div className="h-px" style={{ background: 'var(--border)' }} />
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1.5">
                <MessageSquare size={12} className="text-primary" /> {form.notes}
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
            <div className="flex justify-between text-sm" style={{ color: 'var(--color-success)' }}>
              <span>Descuento ({form.coupon.toUpperCase()})</span><span>-${discountAmount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold pt-1">
            <span>Total</span>
            <span className="text-primary">${finalPrice.toLocaleString()} MXN</span>
          </div>
        </div>
      </div>

      {/* Coupon */}
      <div className="mb-5">
        <button type="button" onClick={() => setShowCoupon(!showCoupon)}
          className="flex items-center gap-2 text-xs mb-2 transition-colors" style={{ color: 'var(--text-muted)' }}>
          <Ticket size={12} /> ¿Tienes un cupón? <span className="text-2xs">(opcional)</span>
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
                    borderColor: couponStatus?.valid ? 'var(--color-success)' : couponStatus && !couponStatus.valid ? 'var(--color-error)' : 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  aria-label="Código de cupón"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingCoupon ? <Loader2 className="animate-spin" size={13} style={{ color: 'var(--text-muted)' }} />
                    : couponStatus?.valid ? <Check size={13} style={{ color: 'var(--color-success)' }} />
                    : couponStatus && !couponStatus.valid ? <X size={13} style={{ color: 'var(--color-danger)' }} /> : null}
                </div>
              </div>
              {couponStatus && (
                <p className="text-xs mt-1" style={{ color: couponStatus.valid ? 'var(--color-success)' : 'var(--color-error)' }}>
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
          { icon: <Star size={12} />, text: 'Calificación real de clientes', color: 'var(--color-primary)' },
          { icon: <Zap size={12} />, text: 'Respuesta rápida', color: 'var(--color-success)' },
          { icon: <ShieldCheck size={12} />, text: 'Equipo propio', color: '#3b82f6' },
          { icon: <Heart size={12} />, text: 'Atención personalizada', color: '#ec4899' },
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

      {rateError && <p className="text-xs text-center mb-3" style={{ color: 'var(--color-error)' }}>{rateError}</p>}
    </div>
  )
}
