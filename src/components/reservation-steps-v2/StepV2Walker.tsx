'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, User, CheckCircle2, Loader2 } from 'lucide-react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/firebase/config'

interface Walker {
  id: string
  name: string
  rating: number
  completedWalks: number
  zones: string[]
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
  form, updateForm, availableWalkers, setAvailableWalkers,
  searchingWalkers, setSearchingWalkers, searchResult, setSearchResult,
  onNext, onBack,
}: StepV2WalkerProps) {
  const [searching, setSearching] = useState(false)

  const handleAutoSearch = useCallback(async () => {
    setSearching(true)
    setSearchResult(null)

    try {
      const user = auth.currentUser
      if (!user) return

      const snapshot = await getDocs(
        query(collection(db, 'walkerProfiles'), where('status', '==', 'active'), limit(5))
      )

      const walkers = snapshot.docs.map(d => ({
        id: d.id,
        name: d.data().name || 'Paseador',
        rating: d.data().rating || 0,
        completedWalks: d.data().completedWalks || 0,
        zones: d.data().zones || [],
      }))

      setAvailableWalkers(walkers)

      if (walkers.length > 0) {
        const best = walkers[0]
        setSearchResult({ id: best.id, name: best.name, reason: 'Mejor compatibilidad' })
        updateForm({ walkerId: best.id, walkerName: best.name, autoSearch: true })
      } else {
        setSearchResult({ id: '', name: '', reason: 'No se encontraron paseadores disponibles' })
      }
    } catch {
      setSearchResult({ id: '', name: '', reason: 'Error al buscar paseadores' })
    } finally {
      setSearching(false)
      setSearchingWalkers(false)
    }
  }, [updateForm, setAvailableWalkers, setSearchingWalkers, setSearchResult])

  useEffect(() => {
    if (form.autoSearch && availableWalkers.length === 0 && !searching) {
      handleAutoSearch()
    }
  }, [])

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        ¿Quién te acompaña?
      </p>

      {form.autoSearch && !searchResult && (
        <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'var(--glass-bg)' }}>
          <Loader2 size={16} className="animate-spin" style={{ color: 'var(--brand)' }} />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Buscando paseador compatible...</span>
          <button
            onClick={() => updateForm({ autoSearch: false, searchCancel: true })}
            className="text-xs ml-auto"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancelar
          </button>
        </div>
      )}

      {searchResult && !searchResult.id && (
        <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
          {searchResult.reason}
        </div>
      )}

      {searchResult && searchResult.id && (
        <div className="p-3 rounded-xl" style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand)' }}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} style={{ color: 'var(--brand)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {searchResult.name} — {searchResult.reason}
            </span>
          </div>
        </div>
      )}

      {!form.autoSearch && (
        <div className="space-y-2">
          {availableWalkers.map(walker => (
            <button
              key={walker.id}
              onClick={() => updateForm({ walkerId: walker.id, walkerName: walker.name })}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                form.walkerId === walker.id
                  ? 'bg-brand-500/10 border-brand-500/30'
                  : 'bg-white/50 border-transparent hover:bg-ink/5'
              }`}
              style={{ border: form.walkerId === walker.id ? '1px solid var(--brand)' : '1px solid var(--border)' }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: form.walkerId === walker.id ? 'var(--brand)' : 'var(--glass-bg)' }}
              >
                <User size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{walker.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  ⭐ {walker.rating} · {walker.completedWalks} paseos
                </p>
              </div>
              {form.walkerId === walker.id && (
                <CheckCircle2 size={16} className="ml-auto shrink-0" style={{ color: 'var(--brand)' }} />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-ink/5" style={{ color: 'var(--text-muted)' }}>
          ← Atrás
        </button>
        <button
          onClick={onNext}
          disabled={form.autoSearch && !searchResult?.id}
          className="btn-primary inline-flex items-center gap-2"
        >
          Siguiente <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}