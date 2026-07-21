export interface ServiceOption {
  name: string
  price: number
  quantity?: number
  duration: string
  modality: string
  mainBenefit: string
  icon: string
  highlights?: string[]
}

export const SERVICES: ServiceOption[] = [
  {
    name: 'Paseo Individual',
    price: 30,
    duration: '30 min',
    modality: '1 a 1',
    mainBenefit: 'Atención personalizada',
    icon: '🐕',
    highlights: ['Atención personalizada 1 a 1', 'Ruta por Zona Quebrada', 'Ejercicio moderado', 'Supervisión constante'],
  },
  {
    name: 'Paseo Extendido',
    price: 60,
    duration: '1 hora',
    modality: '1 a 1',
    mainBenefit: 'Juegos y ejercicios',
    icon: '🏃',
    highlights: ['1 hora de paseo continuo', 'Juegos y ejercicios', 'Ruta más larga y variada', 'Agua y descansos incluidos'],
  },
  {
    name: 'Paseo Grupal',
    price: 55,
    duration: '45 min',
    modality: 'Máx. 4 perros',
    mainBenefit: 'Socialización',
    icon: '👥',
    highlights: ['Socialización con otros perros', 'Grupos de máximo 4', 'Supervisión todo el tiempo', 'Ejercicio en equipo'],
  },
  {
    name: 'Paseo + Adiestramiento',
    price: 70,
    duration: '1 hora',
    modality: '1 a 1',
    mainBenefit: 'Comandos básicos',
    icon: '🎓',
    highlights: ['Comandos básicos: sentado, quieto, aquí', 'Refuerzo positivo con premios', 'Paseo de 1 hora más entrenamiento', 'Ideal para perros jóvenes'],
  },
  {
    name: 'Paseo Express',
    price: 35,
    duration: '20 min',
    modality: '1 a 1',
    mainBenefit: 'Rápido y directo',
    icon: '⚡',
    highlights: ['Paseo rápido para necesidades', 'Perfecto entre comidas o antes de dormir', 'Sin complicaciones', 'Salida y regreso rápido'],
  },
  {
    name: 'Paseo + Reporte',
    price: 60,
    duration: '45 min',
    modality: '1 a 1',
    mainBenefit: 'Fotos y mapa del recorrido',
    icon: '📸',
    highlights: ['Fotos y video de tu perro', 'Reporte detallado por WhatsApp', 'Mapa del recorrido', 'Ideal para dueños curiosos'],
  },
  {
    name: 'Paquete Semanal',
    price: 390,
    quantity: 6,
    duration: '6 paseos',
    modality: 'Lun a Sáb',
    mainBenefit: 'Paseos toda la semana',
    icon: '📅',
    highlights: ['6 paseos: lunes a sábado', 'Elige el horario cada día', 'Perro feliz toda la semana', 'Conveniencia sin comparar'],
  },
]

export const SERVICE_NAMES = SERVICES.map((s) => s.name)

const LEGACY_NAME_MAP: Record<string, string> = {
  'Paseo Individual (30 min)': 'Paseo Individual',
  'Paseo Extendido (1 hora)': 'Paseo Extendido',
  'Paseo Grupal (45 min)': 'Paseo Grupal',
  'Paseo + Adiestramiento (1 hora)': 'Paseo + Adiestramiento',
  'Paseo Express (20 min)': 'Paseo Express',
  'Paseo + Reporte (45 min)': 'Paseo + Reporte',
  'Paquete Semanal (6 paseos)': 'Paquete Semanal',
}

export function normalizeServiceName(name: string): string {
  return LEGACY_NAME_MAP[name] || name
}

export function getServicePrice(serviceName: string): number {
  const normalized = normalizeServiceName(serviceName)
  return SERVICES.find((s) => s.name === normalized)?.price || 0
}

export function getServiceMeta(serviceName: string) {
  return SERVICES.find((s) => s.name === serviceName)
}

export function calculateSavings(serviceName: string, currentPrice?: number): { regularPrice: number; savings: number } {
  const svc = SERVICES.find((s) => s.name === serviceName)
  if (!svc || !svc.quantity) return { regularPrice: svc?.price || 0, savings: 0 }
  const unitPrice = currentPrice ?? 30
  const regularPrice = unitPrice * svc.quantity
  const savings = regularPrice - svc.price
  return { regularPrice, savings: savings > 0 ? savings : 0 }
}
