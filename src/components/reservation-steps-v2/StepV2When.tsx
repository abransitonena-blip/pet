'use client'

import { Clock, Calendar, ArrowRight } from 'lucide-react'
import { generateTimeSlots, getDayOfWeek } from '@/lib/defaultConfig'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import { isValidSameDayWindow, timeToMinutes } from '@/lib/reservationValidation'

interface StepV2WhenProps {
  form: { whenType: 'asap' | 'scheduled'; date: string; time: string; windowStart: string; windowEnd: string; recurring: boolean; recurringDays: Record<string, string> }
  updateForm: (updates: Partial<{ whenType: 'asap' | 'scheduled'; date: string; time: string; windowStart: string; windowEnd: string; recurring: boolean; recurringDays: Record<string, string> }>) => void
  onNext: () => void
  onBack: () => void
}

export default function StepV2When({ form, updateForm, onNext, onBack }: StepV2WhenProps) {
  const today = new Date().toISOString().split('T')[0]
  const slots = form.date ? generateTimeSlots(getDayOfWeek(form.date)) : []
  const validWindow = isValidSameDayWindow(form.windowStart, form.windowEnd)
  const startMinutes = timeToMinutes(form.windowStart)
  const endOptions = Array.from(new Set(slots.map((slot) => slot.split('-')[1])))
    .filter((end) => startMinutes !== null && (timeToMinutes(end) ?? -1) > startMinutes)

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        ¿Cuándo quieres el paseo?
      </p>

      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Seleccionar momento del paseo">
        <div
          role="radio"
          aria-checked={form.whenType === 'asap'}
          aria-disabled="true"
          tabIndex={-1}
          className="cursor-not-allowed opacity-65"
        >
          <Card
            className={`p-4 transition-all ${form.whenType === 'asap'
              ? 'bg-brand-500/10 border-brand-500/30'
              : 'bg-white/50 border-transparent hover:bg-ink/5'}`}
            style={{ border: form.whenType === 'asap' ? '1px solid var(--brand)' : '1px solid var(--border)' }}
          >
            <Clock size={20} className="mb-2" style={{ color: form.whenType === 'asap' ? 'var(--brand)' : 'var(--text-muted)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Lo antes posible</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Temporalmente en preparación</p>
          </Card>
        </div>

        <div
          role="radio"
          aria-checked={form.whenType === 'scheduled'}
          tabIndex={0}
          onClick={() => updateForm({ whenType: 'scheduled' })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              updateForm({ whenType: 'scheduled' })
            }
          }}
          className="cursor-pointer"
        >
          <Card
            className={`p-4 transition-all ${form.whenType === 'scheduled'
              ? 'bg-brand-500/10 border-brand-500/30'
              : 'bg-white/50 border-transparent hover:bg-ink/5'}`}
            style={{ border: form.whenType === 'scheduled' ? '1px solid var(--brand)' : '1px solid var(--border)' }}
          >
            <Calendar size={20} className="mb-2" style={{ color: form.whenType === 'scheduled' ? 'var(--brand)' : 'var(--text-muted)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Programar</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Elige fecha y horario</p>
          </Card>
        </div>
      </div>

      {form.whenType === 'scheduled' && (
        <Card className="space-y-3 p-4">
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Fecha</label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => updateForm({ date: e.target.value, time: '', windowStart: '', windowEnd: '' })}
              min={today}
            />
          </div>

          {form.date && slots.length > 0 && (
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Ventana de llegada</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.windowStart}
                  onChange={(e) => {
                    const windowStart = e.target.value
                    const keepEnd = windowStart && form.windowEnd && isValidSameDayWindow(windowStart, form.windowEnd)
                    updateForm({
                      windowStart,
                      windowEnd: keepEnd ? form.windowEnd : '',
                      time: keepEnd ? `${windowStart}-${form.windowEnd}` : '',
                    })
                  }}
                  className="px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="">Desde</option>
                  {slots.map(s => <option key={s} value={s.split('-')[0]}>{s}</option>)}
                </select>
                <select
                  value={form.windowEnd}
                  onChange={(e) => {
                    const windowEnd = e.target.value
                    updateForm({ windowEnd, time: form.windowStart && windowEnd ? `${form.windowStart}-${windowEnd}` : '' })
                  }}
                  className="px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="">Hasta</option>
                  {endOptions.map((end) => <option key={end} value={end}>{end}</option>)}
                </select>
              </div>
              {form.windowStart && form.windowEnd && !validWindow && (
                <p className="mt-2 text-xs text-red-700" role="alert">La hora final debe ser posterior a la hora inicial.</p>
              )}
            </div>
          )}

          <p className="text-xs text-muted">Las solicitudes recurrentes se habilitarán cuando exista una programación semanal completa y verificable.</p>
        </Card>
      )}

      {form.whenType === 'asap' && (
        <p className="text-xs p-3 rounded-xl" style={{ background: 'var(--glass-bg)', color: 'var(--text-muted)' }}>
          Buscaremos la primera ventana disponible. No prometemos minutos exactos, pero te confirmaremos en cuanto encontremos un paseador compatible.
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button
          variant="secondary"
          className="min-h-11 rounded-xl"
          onClick={onBack}
        >
          ← Atrás
        </Button>
        <Button
          variant="primary"
          className="min-h-11 rounded-xl"
          onClick={onNext}
          disabled={form.whenType !== 'scheduled' || !form.date || !validWindow || form.time !== `${form.windowStart}-${form.windowEnd}`}
          leftIcon={<ArrowRight size={14} />}
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}
