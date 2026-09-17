/* eslint-disable react-refresh/only-export-components */
'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { watchDocument } from '@/firebase/lazyFirestore'
import { getReservationServiceDefinitions, normalizeServiceName, RESERVATION_SERVICE_IDS } from '@/lib/walkServices'
import {
  createEmptyServicePrices,
  parsePublicServicePricesDocument,
  type PriceDocumentStatus,
  type PublicServicePrice,
} from '@/lib/servicePricing'

const SERVICE_DEFINITIONS = getReservationServiceDefinitions()
const EMPTY_SERVICE_PRICES = createEmptyServicePrices(SERVICE_DEFINITIONS)

interface PricesContextType {
  services: Record<string, PublicServicePrice>
  /** Legacy read-only projection. Missing prices are excluded from totals and flagged separately. */
  prices: Record<string, number>
  hasIncompletePricing: boolean
  version: number
  status: PriceDocumentStatus
  findByLegacyName: (serviceName: string) => PublicServicePrice | null
}

const PricesContext = createContext<PricesContextType>({
  services: EMPTY_SERVICE_PRICES,
  prices: {},
  hasIncompletePricing: true,
  version: 0,
  status: 'loading',
  findByLegacyName: () => null,
})

export function PricesProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<Record<string, PublicServicePrice>>(EMPTY_SERVICE_PRICES)
  const [version, setVersion] = useState(0)
  const [status, setStatus] = useState<PriceDocumentStatus>('loading')

  useEffect(() => {
    return watchDocument(['appSettings', 'servicePrices'], (data) => {
      if (!data) {
        setServices(EMPTY_SERVICE_PRICES)
        setVersion(0)
        setStatus('empty')
        return
      }
      const parsed = parsePublicServicePricesDocument(data, SERVICE_DEFINITIONS)
      if (!parsed) {
        setServices(EMPTY_SERVICE_PRICES)
        setVersion(0)
        setStatus('invalid')
        return
      }
      setServices(parsed.services)
      setVersion(parsed.version)
      setStatus(Object.values(parsed.services).some((service) => service.active) ? 'ready' : 'empty')
    }, (cause) => {
      const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
      setStatus(code.includes('permission-denied') ? 'permission-denied' : 'network-error')
    })
  }, [])

  const findByLegacyName = (serviceName: string): PublicServicePrice | null => {
    const normalizedName = normalizeServiceName(serviceName)
    const serviceId = RESERVATION_SERVICE_IDS[normalizedName]?.id
    return serviceId ? services[serviceId] ?? null : null
  }
  const prices = Object.fromEntries(Object.entries(RESERVATION_SERVICE_IDS).map(([legacyName, definition]) => {
    const amountCents = services[definition.id]?.amountCents
    return [legacyName, amountCents === null || amountCents === undefined ? 0 : amountCents / 100]
  }))
  const hasIncompletePricing = Object.values(services).some((service) => service.amountCents === null)

  return (
    <PricesContext.Provider value={{ services, prices, hasIncompletePricing, version, status, findByLegacyName }}>
      {children}
    </PricesContext.Provider>
  )
}

export function usePrices() {
  return useContext(PricesContext)
}

export { EMPTY_SERVICE_PRICES }
