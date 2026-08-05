'use client'

import { Dog, MapPin, Clock, PawPrint, User, Calendar, AlertTriangle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'

interface StepV2ConfirmProps {
  form: {
    petName: string
    petType: string
    address: string
    addressNote: string
    whenType: string
    date: string
    time: string
    windowStart: string
    windowEnd: string
    recurring: boolean
    service: string
    walkerId: string
    walkerName: string
    autoSearch: boolean
  }
  updateForm: (updates: Partial<{
    petName: string
    petType: string
    address: string
    addressNote: string
    whenType: string
    date: string
    time: string
    windowStart: string
    windowEnd: string
    recurring: boolean
    service: string
    walkerId: string
    walkerName: string
    autoSearch: boolean
  }>) => void
  onSubmit: () => void
  onBack: () => void
  loading: boolean
  error: string
  success: string
}

export default function StepV2Confirm({ form, updateForm, onSubmit, onBack, loading, error, success }: StepV2ConfirmProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Revisa tu solicitud antes de enviarla.
      </p>

      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--glass-bg)' }}>
          <PawPrint size={18} style={{ color: 'var(--brand)' }} />
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Compañero</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{form.petName}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--glass-bg)' }}>
          <MapPin size={18} style={{ color: 'var(--brand)' }} />
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Dirección</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{form.address}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--glass-bg)' }}>
          <Clock size={18} style={{ color: 'var(--brand)' }} />
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Momento</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {form.whenType === 'asap' ? 'Lo antes posible' : `${form.date} · ${form.windowStart}-${form.windowEnd}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--glass-bg)' }}>
          <Calendar size={18} style={{ color: 'var(--brand)' }} />
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Servicio</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{form.service}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--glass-bg)' }}>
          <User size={18} style={{ color: 'var(--brand)' }} />
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Paseador</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {form.autoSearch ? 'Búsqueda automática' : form.walkerName || 'No asignado'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl text-sm flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }} role="alert">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {success && (
        <div className="p-3 rounded-xl text-sm flex items-center gap-2" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)' }} role="status">
          <CheckCircle2 size={14} /> {success}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-ink/5" style={{ color: 'var(--text-muted)' }}>
          ← Atrás
        </button>
        <button
          onClick={onSubmit}
          disabled={loading}
          className="btn-primary inline-flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Solicitando...
            </>
          ) : (
            <>
              Solicitar paseo <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}