'use client'

import Link from 'next/link'
import { MapPin, Plus, CheckCircle2, ArrowRight } from 'lucide-react'
import Button from '@/components/ui/Button'

interface StepV2AddressProps {
  form: { addressId: string; address: string; addressNote: string; zoneId: string; zoneActive: boolean }
  updateForm: (updates: Partial<{ addressId: string; address: string; addressNote: string; zoneId: string; zoneActive: boolean }>) => void
  userAddresses: { id: string; address: string; zoneId: string; zoneActive: boolean }[]
  onNext: () => void
  onBack: () => void
}

export default function StepV2Address({ form, updateForm, userAddresses, onNext, onBack }: StepV2AddressProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        ¿Dónde recogeremos a tu compañero?
      </p>

      {userAddresses.length > 0 && (
        <div className="space-y-2">
          {userAddresses.map(addr => (
            <Button
              key={addr.id}
              variant={form.addressId === addr.id ? 'primary' : 'secondary'}
              disabled={!addr.zoneActive}
              onClick={() => updateForm({ addressId: addr.id, address: addr.address, zoneId: addr.zoneId, zoneActive: addr.zoneActive })}
              className="w-full justify-start"
              leftIcon={
                <MapPin size={20} className="shrink-0" style={{ color: form.addressId === addr.id ? 'var(--brand)' : 'var(--text-muted)' }} />
              }
            >
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm text-ink">{addr.address}</span>
                {!addr.zoneActive && (
                  <span className="block text-xs text-warning">
                    La zona de esta dirección ya no está disponible. Actualízala antes de reservar.
                  </span>
                )}
              </span>
              {form.addressId === addr.id && (
                <CheckCircle2 size={16} className="ml-auto shrink-0" style={{ color: 'var(--brand)' }} />
              )}
            </Button>
          ))}
        </div>
      )}

      <Link href="/familia/direcciones?returnTo=/familia/nueva-reserva" className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-ink/20 px-4 text-sm font-medium text-muted transition hover:border-primary/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <Plus size={16} aria-hidden="true" /> Gestionar direcciones y zonas
      </Link>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-ink/5" style={{ color: 'var(--text-muted)' }}>
          ← Atrás
        </button>
        <button
          onClick={onNext}
          disabled={!form.addressId || !form.zoneId || !form.zoneActive}
          className="btn-primary inline-flex items-center gap-2"
        >
          Siguiente <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
