export interface ServiceOption {
  name: string
  price: number
}

export const SERVICES: ServiceOption[] = [
  { name: 'Paseo Individual (30 min)', price: 40 },
  { name: 'Paseo Plus (60 min)', price: 70 },
  { name: 'Paseo Grupal (45 min)', price: 55 },
  { name: 'Ruta Premium (90 min)', price: 100 },
  { name: 'Paquete Semanal (5 paseos)', price: 180 },
  { name: 'Paquete Mensual (20 paseos)', price: 650 },
  { name: 'Paseo + Reporte (45 min)', price: 55 },
  { name: 'Paseo Express (20 min)', price: 30 },
]

export const SERVICE_NAMES = SERVICES.map((s) => s.name)

export function getServicePrice(serviceName: string): number {
  return SERVICES.find((s) => s.name === serviceName)?.price || 0
}
