'use client'

import { FaCheck, FaDog } from 'react-icons/fa'

export default function StepWalker({
  walkerPreference, setWalkerPreference, availableWalkers, loadingWalkers,
}: {
  walkerPreference: string
  setWalkerPreference: (id: string) => void
  availableWalkers: { id: string; name: string; photo?: string; zones?: string[]; rating?: number }[]
  loadingWalkers: boolean
}) {
  return (
    <div>
      <h3 className="text-lg sm:text-xl font-bold mb-1">¿Quién pasea a tu peludo?</h3>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        Elige un paseador preferido o déjalo en automático
      </p>

      {loadingWalkers ? (
        <div className="flex items-center justify-center py-8 gap-3" style={{ color: 'var(--text-muted)' }}>
          <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Buscando paseadores disponibles…</span>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setWalkerPreference('')}
            className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
            style={{
              background: walkerPreference === '' ? 'var(--color-primary-light)' : 'var(--glass-bg)',
              borderColor: walkerPreference === '' ? 'var(--color-primary)' : 'var(--border)',
            }}
          >
            <span className="text-xl">🎲</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: walkerPreference === '' ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                Asignación automática
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                El sistema elige al paseador más cercano
              </p>
            </div>
            {walkerPreference === '' && <FaCheck size={12} className="text-primary mt-1 shrink-0" />}
          </button>

          {availableWalkers.map((walker) => {
            const selected = walkerPreference === walker.id
            return (
              <button
                key={walker.id}
                type="button"
                onClick={() => setWalkerPreference(selected ? '' : walker.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
                style={{
                  background: selected ? 'var(--color-primary-light)' : 'var(--glass-bg)',
                  borderColor: selected ? 'var(--color-primary)' : 'var(--border)',
                }}
              >
                {walker.photo ? (
                  <img src={walker.photo} alt={walker.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--color-primary)', color: '#fff' }}>
                    {walker.name[0]}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: selected ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                    {walker.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {(walker.zones?.length ?? 0) > 0 ? walker.zones!.join(' · ') : 'Todas las zonas'}
                    {walker.rating ? ` · ${walker.rating}★` : ''}
                  </p>
                </div>
                {selected && <FaCheck size={12} className="text-primary mt-1 shrink-0" />}
              </button>
            )
          })}

          {availableWalkers.length === 0 && !loadingWalkers && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
              No hay paseadores disponibles para esta fecha y hora
            </p>
          )}
        </div>
      )}
    </div>
  )
}
