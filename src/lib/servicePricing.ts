export const SERVICE_PRICE_SCHEMA_VERSION = 1
export const SERVICE_PRICE_CURRENCY = 'MXN' as const
export const MAX_SERVICE_AMOUNT_CENTS = 100_000_000

export type ServicePriceCurrency = typeof SERVICE_PRICE_CURRENCY

export interface ServicePriceDefinition {
  id: string
  name: string
  duration: string
}

export interface PublicServicePrice {
  id: string
  name: string
  duration: string
  amountCents: number | null
  currency: ServicePriceCurrency
  active: boolean
  complimentary: boolean
  version: number
}

export interface AdminServicePrice extends PublicServicePrice {
  updatedAt: unknown
  updatedBy: string
}

export interface PublicServicePricesDocument {
  schemaVersion: number
  version: number
  services: Record<string, PublicServicePrice>
  updatedAt: unknown
}

export interface AdminServicePricesDocument {
  schemaVersion: number
  version: number
  services: Record<string, AdminServicePrice>
  updatedAt: unknown
  updatedBy: string
}

export type PriceDocumentStatus = 'loading' | 'ready' | 'empty' | 'permission-denied' | 'network-error' | 'invalid'

export class ServicePriceValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'ServicePriceValidationError'
  }
}

export class ServicePriceConflictError extends Error {
  constructor() {
    super('PRICE_VERSION_CONFLICT')
    this.name = 'ServicePriceConflictError'
  }
}

export function isValidAmountCents(value: unknown): value is number {
  return Number.isSafeInteger(value)
    && Number(value) >= 0
    && Number(value) <= MAX_SERVICE_AMOUNT_CENTS
}

export function parseMxnInputToCents(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')
  if (!normalized) return null
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new ServicePriceValidationError('invalid-format', 'Usa un importe con máximo dos decimales.')
  }
  const [whole, fraction = ''] = normalized.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!isValidAmountCents(cents)) {
    throw new ServicePriceValidationError('out-of-range', 'El importe está fuera del límite permitido.')
  }
  return cents
}

export function validateServicePrice(input: PublicServicePrice): void {
  if (!input.id || input.id.length > 80) throw new ServicePriceValidationError('invalid-id', 'El ID del servicio no es válido.')
  if (!input.name || input.name.length > 120) throw new ServicePriceValidationError('invalid-name', 'El nombre del servicio no es válido.')
  if (!input.duration || input.duration.length > 80) throw new ServicePriceValidationError('invalid-duration', 'La duración no es válida.')
  if (input.currency !== SERVICE_PRICE_CURRENCY) throw new ServicePriceValidationError('invalid-currency', 'La moneda debe ser MXN.')
  if (!Number.isSafeInteger(input.version) || input.version < 0) throw new ServicePriceValidationError('invalid-version', 'La versión no es válida.')
  if (input.amountCents !== null && !isValidAmountCents(input.amountCents)) {
    throw new ServicePriceValidationError('invalid-amount', 'El importe debe expresarse en centavos enteros.')
  }
  if (input.amountCents === null && input.active) {
    throw new ServicePriceValidationError('active-without-price', 'Un servicio sin precio no puede estar activo.')
  }
  if (input.amountCents === 0 && !input.complimentary) {
    throw new ServicePriceValidationError('courtesy-not-confirmed', 'Confirma explícitamente que el servicio es una cortesía.')
  }
  if (input.amountCents !== 0 && input.complimentary) {
    throw new ServicePriceValidationError('invalid-courtesy', 'Solo un importe explícito de cero puede marcarse como cortesía.')
  }
}

export function isRequestableServicePrice(price: PublicServicePrice | null | undefined): price is PublicServicePrice {
  if (!price || !price.active || price.amountCents === null) return false
  if (!isValidAmountCents(price.amountCents)) return false
  return price.amountCents > 0 || price.complimentary === true
}

export function formatAmountCents(amountCents: number | null, complimentary = false): string {
  if (amountCents === null) return 'Precio no configurado'
  if (amountCents === 0 && complimentary) return 'Cortesía'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: SERVICE_PRICE_CURRENCY }).format(amountCents / 100)
}

export function createEmptyServicePrices(definitions: readonly ServicePriceDefinition[]): Record<string, PublicServicePrice> {
  return Object.fromEntries(definitions.map((definition) => [definition.id, {
    ...definition,
    amountCents: null,
    currency: SERVICE_PRICE_CURRENCY,
    active: false,
    complimentary: false,
    version: 0,
  }]))
}

export function parsePublicServicePricesDocument(
  value: unknown,
  definitions: readonly ServicePriceDefinition[],
): PublicServicePricesDocument | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (raw.schemaVersion !== SERVICE_PRICE_SCHEMA_VERSION || !Number.isSafeInteger(raw.version) || !raw.services || typeof raw.services !== 'object') return null
  const expected = new Map(definitions.map((definition) => [definition.id, definition]))
  const rawServices = raw.services as Record<string, unknown>
  if (Object.keys(rawServices).length !== expected.size) return null
  const services: Record<string, PublicServicePrice> = {}
  for (const definition of definitions) {
    const id = definition.id
    const candidate = rawServices[id]
    if (!candidate || typeof candidate !== 'object') return null
    const record = candidate as Record<string, unknown>
    const parsed: PublicServicePrice = {
      id: String(record.id ?? ''),
      name: String(record.name ?? ''),
      duration: String(record.duration ?? ''),
      amountCents: record.amountCents === null ? null : Number(record.amountCents),
      currency: record.currency as ServicePriceCurrency,
      active: record.active === true,
      complimentary: record.complimentary === true,
      version: Number(record.version),
    }
    if (parsed.id !== id || parsed.name !== definition.name || parsed.duration !== definition.duration) return null
    try { validateServicePrice(parsed) } catch { return null }
    services[id] = parsed
  }
  return {
    schemaVersion: SERVICE_PRICE_SCHEMA_VERSION,
    version: Number(raw.version),
    services,
    updatedAt: raw.updatedAt ?? null,
  }
}

export function parseAdminServicePricesDocument(
  value: unknown,
  definitions: readonly ServicePriceDefinition[],
): AdminServicePricesDocument | null {
  const publicDocument = parsePublicServicePricesDocument(value, definitions)
  if (!publicDocument || !value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.updatedBy !== 'string' || !raw.updatedBy) return null
  const rawServices = raw.services as Record<string, Record<string, unknown>>
  const services: Record<string, AdminServicePrice> = {}
  for (const [id, publicService] of Object.entries(publicDocument.services)) {
    const rawService = rawServices[id]
    if (typeof rawService.updatedBy !== 'string' || !rawService.updatedBy || !('updatedAt' in rawService)) return null
    services[id] = {
      ...publicService,
      updatedAt: rawService.updatedAt,
      updatedBy: rawService.updatedBy,
    }
  }
  return {
    ...publicDocument,
    services,
    updatedBy: raw.updatedBy,
  }
}

export function buildServicePriceDocuments({
  definitions,
  previous,
  nextServices,
  updatedAt,
  updatedBy,
}: {
  definitions: readonly ServicePriceDefinition[]
  previous: AdminServicePricesDocument | null
  nextServices: Record<string, PublicServicePrice>
  updatedAt: unknown
  updatedBy: string
}): { admin: AdminServicePricesDocument; public: PublicServicePricesDocument } {
  if (!updatedBy) throw new ServicePriceValidationError('missing-actor', 'No se pudo identificar al usuario responsable.')
  const allowedIds = new Set(definitions.map((definition) => definition.id))
  if (Object.keys(nextServices).length !== allowedIds.size || Object.keys(nextServices).some((id) => !allowedIds.has(id))) {
    throw new ServicePriceValidationError('invalid-service-set', 'El catálogo de servicios no coincide con la configuración permitida.')
  }
  const adminServices: Record<string, AdminServicePrice> = {}
  const publicServices: Record<string, PublicServicePrice> = {}
  for (const definition of definitions) {
    const candidate = nextServices[definition.id]
    if (!candidate || candidate.id !== definition.id || candidate.name !== definition.name || candidate.duration !== definition.duration) {
      throw new ServicePriceValidationError('service-definition-changed', 'No se permite cambiar la identidad del servicio desde precios.')
    }
    const previousService = previous?.services[definition.id]
    const changed = !previousService
      || previousService.amountCents !== candidate.amountCents
      || previousService.active !== candidate.active
      || previousService.complimentary !== candidate.complimentary
    const normalized: PublicServicePrice = {
      ...candidate,
      currency: SERVICE_PRICE_CURRENCY,
      version: changed ? (previousService?.version ?? 0) + 1 : previousService.version,
    }
    validateServicePrice(normalized)
    publicServices[definition.id] = normalized
    adminServices[definition.id] = { ...normalized, updatedAt, updatedBy }
  }
  const version = (previous?.version ?? 0) + 1
  return {
    admin: {
      schemaVersion: SERVICE_PRICE_SCHEMA_VERSION,
      version,
      services: adminServices,
      updatedAt,
      updatedBy,
    },
    public: {
      schemaVersion: SERVICE_PRICE_SCHEMA_VERSION,
      version,
      services: publicServices,
      updatedAt,
    },
  }
}
