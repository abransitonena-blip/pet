'use client'

import { useState } from 'react'
import { MapPin, Plus, CheckCircle2, ArrowRight } from 'lucide-react'

interface StepV2AddressProps {
  form: { addressId: string; address: string; addressNote: string }
  updateForm: (updates: Partial<{ addressId: string; address: string; addressNote: string }>) => void
  userAddresses: { id: string; address: string }[]
  onNext: () => void
  onBack: () => void
}

export default function StepV2Address({ form, updateForm, userAddresses, onNext, onBack }: StepV2AddressProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [newAddress, setNewAddress] = useState('')

  const handleAddAddress = () => {
    if (!newAddress.trim()) return
    updateForm({ addressId: `addr_${Date.now()}`, address: newAddress.trim() })
    setNewAddress('')
    setShowAdd(false)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        ¿Dónde recogeremos a tu compañero?
      </p>

      {userAddresses.length > 0 && (
        <div className="space-y-2">
          {userAddresses.map(addr => (
            <button
              key={addr.id}
              onClick={() => updateForm({ addressId: addr.id, address: addr.address })}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                form.addressId === addr.id
                  ? 'bg-brand-500/10 border-brand-500/30'
                  : 'bg-white/50 border-transparent hover:bg-ink/5'
              }`}
              style={{ border: form.addressId === addr.id ? '1px solid var(--brand)' : '1px solid var(--border)' }}
            >
              <MapPin size={20} className="shrink-0" style={{ color: form.addressId === addr.id ? 'var(--brand)' : 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{addr.address}</p>
              {form.addressId === addr.id && (
                <CheckCircle2 size={16} className="ml-auto shrink-0" style={{ color: 'var(--brand)' }} />
              )}
            </button>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="space-y-3 p-4 rounded-xl" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="Dirección de recogida"
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddAddress}
              disabled={!newAddress.trim()}
              className="flex-1 py-3 rounded-xl text-sm font-semibold bg-brand-500 text-white hover:opacity-90 transition-all disabled:opacity-40"
            >
              Agregar
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-ink/5"
              style={{ color: 'var(--text-muted)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-ink/5"
          style={{ color: 'var(--text-muted)', border: '1px dashed var(--border)' }}
        >
          <Plus size={16} /> Agregar dirección
        </button>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-ink/5" style={{ color: 'var(--text-muted)' }}>
          ← Atrás
        </button>
        <button
          onClick={onNext}
          disabled={!form.addressId}
          className="btn-primary inline-flex items-center gap-2"
        >
          Siguiente <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}