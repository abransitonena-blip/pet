'use client'

import { Clock, Calendar, Repeat, ArrowRight } from 'lucide-react'
import { generateTimeSlots, getDayOfWeek } from '@/lib/defaultConfig'

interface StepV2WhenProps {
  form: { whenType: 'asap' | 'scheduled'; date: string; time: string; windowStart: string; windowEnd: string; recurring: boolean; recurringDays: Record<string, string> }
  updateForm: (updates: Partial<{ whenType: 'asap' | 'scheduled'; date: string; time: string; windowStart: string; windowEnd: string; recurring: boolean; recurringDays: Record<string, string> }>) => void
  onNext: () => void
  onBack: () => void
}

export default function StepV2When({ form, updateForm, onNext, onBack }: StepV2WhenProps) {
  const today = new Date().toISOString().split('T')[0]
  const slots = form.date ? generateTimeSlots(getDayOfWeek(form.date)) : []

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        ¿Cuándo quieres el paseo?
      </p>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => updateForm({ whenType: 'asap' })}
          className={`p-4 rounded-xl text-left transition-all ${
            form.whenType === 'asap'
              ? 'bg-brand-500/10 border-brand-500/30'
              : 'bg-white/50 border-transparent hover:bg-ink/5'
          }`}
          style={{ border: form.whenType === 'asap' ? '1px solid var(--brand)' : '1px solid var(--border)' }}
        >
          <Clock size={20} className="mb-2" style={{ color: form.whenType === 'asap' ? 'var(--brand)' : 'var(--text-muted)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Lo antes posible</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Buscamos disponibilidad inmediata</p>
        </button>

        <button
          onClick={() => updateForm({ whenType: 'scheduled' })}
          className={`p-4 rounded-xl text-left transition-all ${
            form.whenType === 'scheduled'
              ? 'bg-brand-500/10 border-brand-500/30'
              : 'bg-white/50 border-transparent hover:bg-ink/5'
          }`}
          style={{ border: form.whenType === 'scheduled' ? '1px solid var(--brand)' : '1px solid var(--border)' }}
        >
          <Calendar size={20} className="mb-2" style={{ color: form.whenType === 'scheduled' ? 'var(--brand)' : 'var(--text-muted)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Programar</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Elige fecha y horario</p>
        </button>
      </div>

      {form.whenType === 'scheduled' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Fecha</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => updateForm({ date: e.target.value, time: '', windowStart: '', windowEnd: '' })}
              min={today}
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>

          {form.date && slots.length > 0 && (
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Ventana de llegada</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.windowStart}
                  onChange={(e) => updateForm({ windowStart: e.target.value })}
                  className="px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="">Desde</option>
                  {slots.map(s => <option key={s} value={s.split('-')[0]}>{s}</option>)}
                </select>
                <select
                  value={form.windowEnd}
                  onChange={(e) => updateForm({ windowEnd: e.target.value })}
                  className="px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="">Hasta</option>
                  {slots.map(s => <option key={s} value={s.split('-')[1]}>{s.split('-')[1]}</option>)}
                </select>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.recurring}
              onChange={(e) => updateForm({ recurring: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <Repeat size={14} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Paseo recurrente (semanal)</span>
          </label>
        </div>
      )}

      {form.whenType === 'asap' && (
        <p className="text-xs p-3 rounded-xl" style={{ background: 'var(--glass-bg)', color: 'var(--text-muted)' }}>
          Buscaremos la primera ventana disponible. No prometemos minutos exactos, pero te confirmaremos en cuanto encontremos un paseador compatible.
        </p>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-ink/5" style={{ color: 'var(--text-muted)' }}>
          ← Atrás
        </button>
        <button
          onClick={onNext}
          disabled={form.whenType === 'scheduled' && (!form.date || !form.windowStart || !form.windowEnd)}
          className="btn-primary inline-flex items-center gap-2"
        >
          Siguiente <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}