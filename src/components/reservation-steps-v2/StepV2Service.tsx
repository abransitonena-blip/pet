'use client'

import { PawPrint, ArrowRight, AlertCircle } from 'lucide-react'
import { getReservationServiceOptions, type ReservationPackageType } from '@/lib/walkServices'
import { formatAmountCents, type PriceDocumentStatus, type PublicServicePrice } from '@/lib/servicePricing'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

interface StepV2ServiceProps {
  form: { serviceId: string; serviceName: string; servicePackageType: ReservationPackageType | ''; serviceAmountCents: number | null; serviceVersion: number | null; serviceComplimentary: boolean; serviceDurationMinutes: number | null }
  updateForm: (updates: Partial<{ serviceId: string; serviceName: string; servicePackageType: ReservationPackageType | ''; serviceAmountCents: number | null; serviceVersion: number | null; serviceComplimentary: boolean; serviceDurationMinutes: number | null }>) => void
  prices: Record<string, PublicServicePrice>
  priceStatus: PriceDocumentStatus
  onNext: () => void
  onBack?: () => void
}

export default function StepV2Service({ form, updateForm, prices, priceStatus, onNext, onBack }: StepV2ServiceProps) {
  const services = getReservationServiceOptions(prices)
  const selectedOption = services.find((service) => service.id === form.serviceId)

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        ¿Qué servicio necesitas?
      </p>

      {priceStatus === 'loading' && <p className="rounded-xl bg-ink/5 px-3 py-3 text-sm text-muted" role="status">Consultando servicios y precios…</p>}
      {(priceStatus === 'permission-denied' || priceStatus === 'network-error' || priceStatus === 'invalid') && (
        <p className="flex items-start gap-2 rounded-xl bg-danger-500/10 px-3 py-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 shrink-0" size={16} />
          {priceStatus === 'permission-denied'
            ? 'Tu sesión no tiene permiso para consultar la configuración de servicios.'
            : priceStatus === 'invalid'
              ? 'La configuración de servicios no es válida. Ninguna opción fue habilitada.'
            : 'No pudimos consultar la configuración de servicios. Revisa tu conexión.'}
        </p>
      )}

      <div className="space-y-2" role="radiogroup" aria-label="Seleccionar servicio">
        {services.map((service) => {
          const isSelected = form.serviceId === service.id

          return (
            <button
              type="button"
              key={service.id}
              role="radio"
              aria-checked={isSelected}
              disabled={!service.isRequestable || priceStatus !== 'ready'}
              onClick={() => updateForm({
                serviceId: service.id,
                serviceName: service.name,
                servicePackageType: service.packageType,
                serviceAmountCents: service.amountCents,
                serviceVersion: service.version,
                serviceComplimentary: service.complimentary,
                serviceDurationMinutes: service.durationMinutes,
              })}
              className="w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed motion-reduce:transition-none"
            >
              <Card
                className={`flex min-h-11 w-full items-center gap-3 p-3 shadow-none transition-colors motion-reduce:transition-none ${isSelected
                  ? 'border-primary bg-primary/10'
                  : service.isRequestable && priceStatus === 'ready'
                    ? 'hover:border-primary/40 hover:bg-primary/[0.04]'
                    : 'bg-ink/[0.025] opacity-70'}`}
              >
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-ink/5 text-muted'}`}>
                  <PawPrint size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">{service.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{service.duration} · {service.mainBenefit}</p>
                  {service.unavailableReason && <p className="mt-1 text-xs font-medium text-amber-800">{service.unavailableReason}</p>}
                </div>
                <div className="text-right shrink-0">
                  {service.amountCents === null ? (
                    <p className="max-w-28 text-xs font-semibold text-muted">Precio no configurado</p>
                  ) : (
                    <><p className="text-sm font-bold text-primary">{formatAmountCents(service.amountCents, service.complimentary)}</p><p className="text-2xs text-muted">MXN · v{service.version}</p></>
                  )}
                </div>
                {isSelected && <ArrowRight size={16} className="ml-1 text-primary" />}
              </Card>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-muted">
        Las opciones sin tarifa válida no pueden solicitarse. El equipo PET debe configurar el precio antes de habilitarlas.
      </p>

      <div className="flex justify-between pt-2">
        {onBack ? <Button variant="secondary" className="min-h-11 rounded-xl" onClick={onBack}>← Atrás</Button> : <span />}
        <Button
          variant="primary"
          className="min-h-11 rounded-xl"
          onClick={onNext}
          disabled={!selectedOption?.isRequestable || priceStatus !== 'ready'}
          leftIcon={<ArrowRight size={14} />}
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}
