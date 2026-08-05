'use client'

import { PawPrint, ArrowRight } from 'lucide-react'
import { getServicePrice, getServiceMeta, SERVICE_NAMES } from '@/lib/services'

interface StepV2ServiceProps {
  form: { service: string }
  updateForm: (updates: Partial<{ service: string }>) => void
  onNext: () => void
  onBack: () => void
}

const MAIN_SERVICES = ['Paseo 30 min', 'Paseo 60 min', 'Paseo 90 min', 'Paquete Semanal']

export default function StepV2Service({ form, updateForm, onNext, onBack }: StepV2ServiceProps) {
  const mainServices = MAIN_SERVICES.filter(s => SERVICE_NAMES.includes(s))

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        ¿Qué servicio necesitas?
      </p>

      <div className="space-y-2">
        {mainServices.map(svc => {
          const meta = getServiceMeta(svc)
          const price = getServicePrice(svc)
          const isSelected = form.service === svc

          return (
            <button
              key={svc}
              onClick={() => updateForm({ service: svc })}
              className={`w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all ${
                isSelected
                  ? 'bg-brand-500/10 border-brand-500/30'
                  : 'bg-white/50 border-transparent hover:bg-ink/5'
              }`}
              style={{ border: isSelected ? '1px solid var(--brand)' : '1px solid var(--border)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: isSelected ? 'var(--brand)' : 'var(--glass-bg)' }}
              >
                <PawPrint size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{svc}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{meta?.mainBenefit || ''}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold" style={{ color: 'var(--brand)' }}>${price.toLocaleString()}</p>
                <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>MXN</p>
              </div>
              {isSelected && <ArrowRight size={16} className="ml-2" style={{ color: 'var(--brand)' }} />}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Más servicios disponibles al confirmar
      </p>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-ink/5" style={{ color: 'var(--text-muted)' }}>
          ← Atrás
        </button>
        <button
          onClick={onNext}
          disabled={!form.service}
          className="btn-primary inline-flex items-center gap-2"
        >
          Siguiente <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}