'use client'

import Link from 'next/link'
import { MapPin, Clock, PawPrint, User, Calendar, AlertTriangle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { ReservationPackageType } from '@/lib/walkServices'
import { getReservationValidationIssues, type ReservationStepId } from '@/lib/reservationValidation'
import { formatAmountCents } from '@/lib/servicePricing'

interface StepV2ConfirmProps {
  form: {
    petId: string
    petName: string
    petType: string
    addressId: string
    address: string
    addressNote: string
    whenType: 'asap' | 'scheduled'
    date: string
    time: string
    windowStart: string
    windowEnd: string
    recurring: boolean
    serviceId: string
    serviceName: string
    servicePackageType: ReservationPackageType | ''
    serviceAmountCents: number | null
    serviceVersion: number | null
    serviceComplimentary: boolean
    serviceDurationMinutes: number | null
    walkerId: string
    walkerName: string
    autoSearch: boolean
  }
  updateForm: (updates: Partial<{
    petId: string
    petName: string
    petType: string
    addressId: string
    address: string
    addressNote: string
    whenType: 'asap' | 'scheduled'
    date: string
    time: string
    windowStart: string
    windowEnd: string
    recurring: boolean
    serviceId: string
    serviceName: string
    servicePackageType: ReservationPackageType | ''
    serviceAmountCents: number | null
    serviceVersion: number | null
    serviceComplimentary: boolean
    serviceDurationMinutes: number | null
    walkerId: string
    walkerName: string
    autoSearch: boolean
  }>) => void
  onSubmit: () => void
  onBack: () => void
  onGoToStep: (step: ReservationStepId) => void
  loading: boolean
  error: string
  success: string
  whatsAppPreview: { message: string; url: string } | null
}

export default function StepV2Confirm({ form, updateForm, onSubmit, onBack, onGoToStep, loading, error, success, whatsAppPreview }: StepV2ConfirmProps) {
  const validationIssues = getReservationValidationIssues(form)

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
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{form.serviceName || 'Sin seleccionar'}</p>
            {form.serviceAmountCents === null ? (
              <p className="text-xs font-medium text-amber-800">Precio no configurado</p>
            ) : (
              <p className="text-xs text-muted">{formatAmountCents(form.serviceAmountCents, form.serviceComplimentary)} · MXN · versión {form.serviceVersion}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--glass-bg)' }}>
          <User size={18} style={{ color: 'var(--brand)' }} />
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Paseador</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Asignación pendiente por el equipo PET
            </p>
          </div>
        </div>
      </div>

      <label className="block text-sm font-semibold text-ink" htmlFor="booking-notes">Notas opcionales
        <textarea id="booking-notes" value={form.addressNote} maxLength={500} onChange={(event) => updateForm({ addressNote: event.target.value })} rows={3} placeholder="Indicaciones útiles para revisar la solicitud" className="mt-2 w-full resize-y rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
        <span className="mt-1 block text-right text-xs text-muted">{form.addressNote.length}/500</span>
      </label>

      {validationIssues.length > 0 && !success && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3" role="alert">
          <p className="text-sm font-semibold text-amber-950">Falta completar:</p>
          <ul className="mt-2 space-y-1">
            {validationIssues.map((issue) => (
              <li key={`${issue.step}-${issue.field}`}>
                <button type="button" onClick={() => onGoToStep(issue.step)} className="min-h-11 text-left text-sm font-medium text-amber-900 underline decoration-amber-500 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {issue.label} · volver a {issue.step === 'details' ? 'Perro y dirección' : issue.step === 'schedule' ? 'Fecha y horario' : 'Servicio'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {whatsAppPreview && (
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <h3 className="text-sm font-semibold text-ink">Revisa antes de abrir WhatsApp</h3>
          <p className="mt-1 text-xs text-muted">Se compartirá únicamente el identificador de solicitud, la fecha solicitada y una petición de contacto.</p>
          <pre className="mt-3 whitespace-pre-wrap rounded-lg p-3 text-xs text-ink" style={{ background: 'var(--glass-bg)' }}>{whatsAppPreview.message}</pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={whatsAppPreview.url} target="_blank" rel="noopener noreferrer" className="btn-primary min-h-11 inline-flex items-center">Abrir WhatsApp</a>
            <span className="min-h-11 inline-flex items-center text-xs text-muted">Puedes cerrar esta página sin compartirlo.</span>
          </div>
        </div>
      )}

      {!success && <p className="text-xs text-muted">Usaremos los datos seleccionados para gestionar esta solicitud. Analytics, marketing y publicación de fotografías no son necesarios para reservar. Consulta el <Link href="/privacidad" className="underline">aviso de privacidad</Link>.</p>}

      <div className="flex justify-between pt-2">
        <Button
          variant="secondary"
          className="min-h-11 rounded-xl"
          onClick={onBack}
          disabled={loading || !!success}
        >
          ← Atrás
        </Button>
        <Button
          variant="primary"
          className="min-h-11 rounded-xl"
          onClick={onSubmit}
          disabled={loading || !!success || validationIssues.length > 0}
          leftIcon={loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
        >
          {loading ? 'Solicitando...' : success ? 'Solicitud registrada' : 'Solicitar paseo'}
        </Button>
      </div>
    </div>
  )
}
