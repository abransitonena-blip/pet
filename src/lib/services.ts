export interface ServiceOption {
  name: string
  price: number
}

export const SERVICES: ServiceOption[] = [
  { name: 'Paseo Individual (30 min)', price: 40 },
  { name: 'Paseo Extendido (1 hora)', price: 70 },
  { name: 'Paseo + Adiestramiento (1 hora)', price: 90 },
  { name: 'Paquete Semanal (6 paseos)', price: 400 },
]

export const SERVICE_NAMES = SERVICES.map((s) => s.name)

export function getServicePrice(serviceName: string): number {
  return SERVICES.find((s) => s.name === serviceName)?.price || 0
}
