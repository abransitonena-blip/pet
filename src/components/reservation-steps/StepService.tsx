'use client'

import { motion } from 'framer-motion'
import { SERVICES, getServicePrice, calculateSavings } from '@/lib/services'
import { Check } from 'lucide-react'

export default function StepService({ form, prices, onSelect }: {
  form: { service: string }
  prices: Record<string, number>
  onSelect: (service: string) => void
}) {
  return (
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
                background: selected ? 'var(--color-primary-light)' : 'var(--glass-bg)',
                borderColor: selected ? 'var(--color-primary)' : 'var(--border)',
                boxShadow: selected ? '0 0 0 1px var(--color-primary), 0 4px 16px var(--color-primary-glow)' : 'none',
                minHeight: '44px',
              }}
            >
              <input
                type="radio"
                name="service"
                value={svc.name}
                checked={selected}
                onChange={() => onSelect(svc.name)}
                className="sr-only"
              />
              <span className="text-2xl sm:text-3xl mt-0.5 shrink-0">{svc.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {svc.name}
                  </span>
                  {svc.quantity && savings > 0 && (
                    <span className="text-2xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: 'var(--color-success)' }}>
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
                  style={{ background: 'var(--color-primary)' }}
                >
                  <Check size={12} className="text-white" />
                </motion.div>
              )}
            </label>
          )
        })}
      </fieldset>
    </div>
  )
}
