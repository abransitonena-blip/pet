export interface ServiceOption {
  name: string
  price: number
}

export const SERVICES: ServiceOption[] = [
  { name: 'Paseo Individual (30 min)', price: 30 },
  { name: 'Paseo Extendido (1 hora)', price: 50 },
  { name: 'Paseo Grupal (45 min)', price: 35 },
  { name: 'Paseo + Adiestramiento (1 hora)', price: 60 },
  { name: 'Ruta Premium (90 min)', price: 70 },
  { name: 'Paseo Express (20 min)', price: 20 },
  { name: 'Paquete Semanal (6 paseos)', price: 150 },
  { name: 'Paseo + Reporte (45 min)', price: 40 },
]

export const SERVICE_NAMES = SERVICES.map((s) => s.name)

export function getServicePrice(serviceName: string): number {
  return SERVICES.find((s) => s.name === serviceName)?.price || 0
}
