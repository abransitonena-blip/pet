'use client'

import { useEffect } from 'react'
import { ShieldCheck, ArrowRight } from 'lucide-react'

interface Walker {
  id: string
  name: string
  rating: number
  completedWalks: number
}

interface StepV2WalkerProps {
  form: { walkerId: string; walkerName: string; autoSearch: boolean; searchCancel: boolean }
  updateForm: (updates: Partial<{ walkerId: string; walkerName: string; autoSearch: boolean; searchCancel: boolean }>) => void
  availableWalkers: Walker[]
  setAvailableWalkers: (walkers: Walker[]) => void
  searchingWalkers: boolean
  setSearchingWalkers: (searching: boolean) => void
  searchResult: { id: string; name: string; reason: string } | null
  setSearchResult: (result: { id: string; name: string; reason: string } | null) => void
  onNext: () => void
  onBack: () => void
}

export default function StepV2Walker({
  form, updateForm, onNext, onBack,
}: StepV2WalkerProps) {
  useEffect(() => {
    if (form.walkerId || form.walkerName || !form.autoSearch) {
      updateForm({ walkerId: '', walkerName: '', autoSearch: true, searchCancel: false })
    }
  }, [form.autoSearch, form.walkerId, form.walkerName, updateForm])

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Asignación del paseo
      </p>

      <div className="p-4 rounded-xl" style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand)' }}>
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--brand)' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              El equipo PET asignará al paseador
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Revisaremos zona, disponibilidad y necesidades del paseo. Tu solicitud no queda asignada hasta que la confirmemos.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-ink/5" style={{ color: 'var(--text-muted)' }}>
          ← Atrás
        </button>
        <button
          onClick={onNext}
          className="btn-primary inline-flex items-center gap-2"
        >
          Siguiente <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
