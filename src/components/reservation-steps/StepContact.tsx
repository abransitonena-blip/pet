'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Phone, Info, MapPin, Check, X, Plus } from 'lucide-react'

export default function StepContact({
  form, set, errors, touched, handleBlur, showNotes, setShowNotes,
  savedAddresses, selectedAddressId, setSelectedAddressId,
}: {
  form: { name: string; phone: string; notes: string }
  set: (key: string, val: string) => void
  errors: Record<string, string>
  touched: Record<string, boolean>
  handleBlur: (key: string) => void
  showNotes: boolean
  setShowNotes: (v: boolean) => void
  savedAddresses: { id: string; alias: string; street: string; colony: string; city: string; zip: string }[]
  selectedAddressId: string
  setSelectedAddressId: (id: string) => void
}) {
  return (
    <div>
      <h3 className="text-lg sm:text-xl font-bold mb-1">¿Cómo te contactamos?</h3>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Solo usamos tu información para confirmar el paseo</p>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="owner-name" className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <User size={13} className="text-primary" /> Tu nombre <span style={{ color: 'var(--color-danger)' }}>*</span>
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
              borderColor: errors.name ? 'var(--color-error)' : form.name ? 'var(--color-success)' : 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {errors.name && touched.name && (
            <p id="name-error" className="text-xs flex items-center gap-1 animate-shake" role="alert" style={{ color: 'var(--color-danger)' }}>
              <X size={10} /> {errors.name}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="owner-phone" className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Phone size={13} className="text-primary" /> WhatsApp <span style={{ color: 'var(--color-danger)' }}>*</span>
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
              borderColor: errors.phone ? 'var(--color-error)' : form.phone.replace(/\D/g, '').length >= 10 && /^[2-9]/.test(form.phone.replace(/\D/g, '')) ? 'var(--color-success)' : 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {errors.phone && touched.phone && (
            <p id="phone-error" className="text-xs flex items-center gap-1 animate-shake" role="alert" style={{ color: 'var(--color-danger)' }}>
              <X size={10} /> {errors.phone}
            </p>
          )}
          {!errors.phone && form.phone.replace(/\D/g, '').length >= 10 && /^[2-9]/.test(form.phone.replace(/\D/g, '')) && (
            <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
              <Check size={10} /> Número válido
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowNotes(!showNotes)}
          className="flex items-center gap-2 text-xs transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <Info size={12} />
          {showNotes ? 'Ocultar notas' : '¿Algo que debamos saber?'} <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>(opcional)</span>
        </button>
        <AnimatePresence>
          {showNotes && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={3}
                placeholder="Ej: Mi perro es nervioso con otros perros grandes..."
                className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                aria-label="Notas adicionales"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {savedAddresses.length > 0 && (
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <label className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <MapPin size={13} className="text-primary" /> Dirección de recolección
            </label>
            <div className="space-y-2">
              {savedAddresses.map((addr) => {
                const selected = selectedAddressId === addr.id
                return (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => setSelectedAddressId(selected ? '' : addr.id)}
                    className="w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all"
                    style={{
                      background: selected ? 'var(--color-primary-light)' : 'var(--glass-bg)',
                      borderColor: selected ? 'var(--color-primary)' : 'var(--border)',
                    }}
                  >
                    <span className="text-base mt-0.5">{addr.alias === 'Casa' ? '🏠' : addr.alias === 'Trabajo' ? '🏢' : '📍'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium" style={{ color: selected ? 'var(--color-primary)' : 'var(--text-secondary)' }}>{addr.alias}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{addr.street}, {addr.colony}</p>
                    </div>
                    {selected && <Check size={12} className="text-primary mt-1 shrink-0" />}
                  </button>
                )
              })}
              <a href="/familia/direcciones" target="_blank" className="text-2xs flex items-center gap-1 transition-colors hover:text-primary" style={{ color: 'var(--text-muted)' }}>
                <Plus size={8} /> Agregar nueva dirección
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
