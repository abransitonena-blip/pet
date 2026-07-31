// ── New category system ──

export interface ServiceCategory {
  id: string
  name: string
  description: string
  duration: string
  modality: string
  icon: string
  benefits: string[]
  restrictions: string[]
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'cotidiano',
    name: 'Paseo cotidiano',
    description: 'Para el cuidado diario de tu perro. Un paseo pensado para sus necesidades regulares de ejercicio y estimulación.',
    duration: '30 min',
    modality: '1 a 1',
    icon: '🐕',
    benefits: [
      'Ruta personalizada según tu zona',
      'Ejercicio moderado y supervisado',
      'Agua y descansos incluidos',
      'Notificación al iniciar y al finalizar',
    ],
    restrictions: ['Disponible en zonas autorizadas', 'Sujeto a disponibilidad de paseadores'],
  },
  {
    id: 'energia',
    name: 'Más energía y ejercicio',
    description: 'Para perros que necesitan quemar más energía. Ideal para razas activas o después de un día en casa.',
    duration: '1 hora',
    modality: '1 a 1',
    icon: '🏃',
    benefits: [
      'Ruta más larga con mayor actividad',
      'Juegos y ejercicios durante el recorrido',
      'Pausas de hidratación programadas',
      'Adecuado para perros de alta energía',
    ],
    restrictions: ['Requiere evaluación de condición física', 'No apto para perros con restricción veterinaria'],
  },
  {
    id: 'acompanamiento',
    name: 'Acompañamiento y reporte',
    description: 'Para dueños que quieren estar al tanto de cada detalle. Incluye fotos, registro y reporte del paseo.',
    duration: '45 min',
    modality: '1 a 1',
    icon: '📸',
    benefits: [
      'Fotos y video durante el paseo',
      'Reporte detallado al finalizar',
      'Registro de ruta y comportamiento',
      'Ideal para dueños curiosos o primerizos',
    ],
    restrictions: ['Requiere conexión a internet para envío de fotos'],
  },
  {
    id: 'rutina',
    name: 'Rutina semanal',
    description: 'Un plan constante para que tu perro tenga paseos regulares todos los días. Sin preocuparte por reservar cada vez.',
    duration: '6 paseos / semana',
    modality: 'Lun a Sáb',
    icon: '📅',
    benefits: [
      'Paseos programados de lunes a sábado',
      'Elige el horario ideal cada día',
      'Continuidad para tu perro',
      'Paseador compatible asignado regularmente',
    ],
    restrictions: ['Requiere disponibilidad semanal confirmada', 'Los horarios pueden ajustarse con 24 h de anticipación'],
  },
]

// ── Legacy compatibility (remove after full migration) ──

export interface ServiceOption {
  name: string
  price: number
  quantity?: number
  duration: string
  modality: string
  mainBenefit: string
  recommendedFor: string
  icon: string
  highlights?: string[]
  disclaimer?: string
}

function getLegacyServices(): ServiceOption[] {
  return [
    { name: 'Paseo Individual', price: 0, duration: '30 min', modality: '1 a 1', mainBenefit: 'Atención personalizada', recommendedFor: 'Cuidado diario', icon: '🐕', highlights: ['Atención personalizada 1 a 1', 'Ruta personalizada', 'Ejercicio moderado', 'Supervisión constante'] },
    { name: 'Paseo Extendido', price: 0, duration: '1 hora', modality: '1 a 1', mainBenefit: 'Juegos y ejercicios', recommendedFor: 'Perros con mucha energía', icon: '🏃', highlights: ['1 hora de paseo continuo', 'Juegos y ejercicios', 'Ruta más larga y variada', 'Agua y descansos incluidos'] },
    { name: 'Paseo Grupal', price: 0, duration: '45 min', modality: 'Máx. 4 perros', mainBenefit: 'Socialización', recommendedFor: 'Perros sociables', icon: '👥', highlights: ['Socialización con otros perros', 'Grupos de máximo 4', 'Supervisión todo el tiempo', 'Ejercicio en equipo'], disclaimer: 'Requiere evaluación previa de compatibilidad con otros perros.' },
    { name: 'Paseo + Adiestramiento', price: 0, duration: '1 hora', modality: '1 a 1', mainBenefit: 'Comandos básicos', recommendedFor: 'Perros jóvenes', icon: '🎓', highlights: ['Práctica guiada de comandos: sentado, quieto, aquí', 'Refuerzo positivo con premios', 'Paseo de 1 hora más entrenamiento', 'Ideal para perros jóvenes'], disclaimer: 'Los resultados dependen de la edad, conducta, historial y continuidad del perro.' },
    { name: 'Paseo Esencial', price: 0, duration: '20 min', modality: '1 a 1', mainBenefit: 'Salida rápida', recommendedFor: 'Necesidades urgentes', icon: '🐾', highlights: ['Paseo rápido para necesidades', 'Perfecto entre comidas o antes de dormir', 'Sin complicaciones', 'Salida y regreso rápido'], disclaimer: 'Sujeto a disponibilidad.' },
    { name: 'Paseo + Reporte', price: 0, duration: '45 min', modality: '1 a 1', mainBenefit: 'Fotos y reporte detallado', recommendedFor: 'Dueños que quieren ver todo', icon: '📸', highlights: ['Fotos y video de tu perro', 'Reporte detallado por WhatsApp', 'Registro GPS del paseo', 'Ideal para dueños curiosos'] },
    { name: 'Paquete Semanal', price: 0, quantity: 6, duration: '6 paseos', modality: 'Lun a Sáb', mainBenefit: 'Paseos toda la semana', recommendedFor: 'Rutina constante', icon: '📅', highlights: ['6 paseos de 30 min: lunes a sábado', 'Elige el horario cada día', 'Conveniencia y ahorro para tu perro'] },
  ]
}

export const SERVICES: ServiceOption[] = getLegacyServices()

export const SERVICE_NAMES = SERVICES.map((s) => s.name)

export const SERVICE_LABELS: Record<string, string> = Object.fromEntries(
  SERVICES.map((s) => [s.name, s.name.replace('Paseo ', '').replace('Paquete ', '')])
)

const LEGACY_NAME_MAP: Record<string, string> = {
  'Paseo Individual (30 min)': 'Paseo Individual',
  'Paseo Extendido (1 hora)': 'Paseo Extendido',
  'Paseo Grupal (45 min)': 'Paseo Grupal',
  'Paseo + Adiestramiento (1 hora)': 'Paseo + Adiestramiento',
  'Paseo Esencial (20 min)': 'Paseo Esencial',
  'Paseo Express (20 min)': 'Paseo Esencial',
  'Paseo Express': 'Paseo Esencial',
  'Paseo + Reporte (45 min)': 'Paseo + Reporte',
  'Paquete Semanal (6 paseos)': 'Paquete Semanal',
}

export function normalizeServiceName(name: string): string {
  return LEGACY_NAME_MAP[name] || name
}

export function getServicePrice(_serviceName: string): number {
  return 0
}

export function getServiceMeta(serviceName: string) {
  return SERVICES.find((s) => s.name === serviceName)
}

export function calculateSavings(_serviceName: string, _currentPrice?: number): { regularPrice: number; savings: number } {
  return { regularPrice: 0, savings: 0 }
}

const CATEGORY_DURATION_MINUTES: Record<string, number> = {
  cotidiano: 30,
  energia: 60,
  acompanamiento: 45,
  rutina: 30,
}

const CATEGORY_BASE_MULTIPLIER: Record<string, number> = {
  cotidiano: 1,
  energia: 1.8,
  acompanamiento: 1.4,
  rutina: 5,
}

const URGENCY_PREMIUM = 1.25
const DOG_MULTIPLIER: Record<number, number> = { 1: 1, 2: 1.4, 3: 1.8, 4: 2.2 }

const MARGIN_RATE = 0.3
const WALKER_SHARE = 0.7
const TAX_RATE = 0.08

const CANCELLATION_POLICY = 'Cancelación gratuita hasta 2 horas antes. Después del límite se cobra el 50%.'
const QUOTE_VALIDITY_HOURS = 2

async function getZoneData(zoneId: string): Promise<{ basePrice: number; fixedAdjustment: number; percentAdjustment: number }> {
  try {
    const { doc, getDoc } = await import('firebase/firestore')
    const { db } = await import('@/firebase/config')
    const snap = await getDoc(doc(db, 'zones', zoneId))
    if (snap.exists()) {
      const d = snap.data()
      return {
        basePrice: d.basePrice ?? 150,
        fixedAdjustment: d.fixedAdjustment ?? 0,
        percentAdjustment: d.percentAdjustment ?? 0,
      }
    }
  } catch {}
  return { basePrice: 150, fixedAdjustment: 0, percentAdjustment: 0 }
}

export async function getQuote(req: QuoteRequest): Promise<Quote> {
  const zone = await getZoneData(req.zoneId)
  const catMultiplier = CATEGORY_BASE_MULTIPLIER[req.categoryId] || 1
  const dogMult = DOG_MULTIPLIER[req.dogCount] || 2.5
  const urgencyMult = req.isUrgent ? URGENCY_PREMIUM : 1

  const subtotal = Math.round(zone.basePrice * catMultiplier * dogMult * urgencyMult)

  const adjustments: { concept: string; amount: number }[] = []
  if (zone.fixedAdjustment) {
    adjustments.push({ concept: 'Ajuste de zona', amount: zone.fixedAdjustment })
  }
  if (zone.percentAdjustment > 0) {
    const amt = Math.round(subtotal * zone.percentAdjustment / 100)
    adjustments.push({ concept: `Ajuste de zona (${zone.percentAdjustment}%)`, amount: amt })
  }

  const adjustmentTotal = adjustments.reduce((s, a) => s + a.amount, 0)
  const afterAdjustments = subtotal + adjustmentTotal
  const discount = 0
  const taxes = Math.round(afterAdjustments * TAX_RATE)
  const total = afterAdjustments + taxes - discount
  const walkerPayout = Math.round(afterAdjustments * WALKER_SHARE)
  const estimatedMargin = Math.round(afterAdjustments * MARGIN_RATE)

  const validUntil = new Date(Date.now() + QUOTE_VALIDITY_HOURS * 60 * 60 * 1000).toISOString()

  return {
    categoryId: req.categoryId,
    subtotal,
    adjustments,
    discount,
    taxes,
    total,
    walkerPayout,
    estimatedMargin,
    currency: 'MXN',
    validUntil,
    cancellationPolicy: CANCELLATION_POLICY,
  }
}

export interface QuoteRequest {
  categoryId: string
  zoneId: string
  dogCount: number
  duration: string
  isUrgent: boolean
  scheduleType: 'now' | 'schedule'
  scheduledDate?: string
  scheduledWindowStart?: string
  scheduledWindowEnd?: string
}

export interface Quote {
  categoryId: string
  subtotal: number
  adjustments: { concept: string; amount: number }[]
  discount: number
  taxes: number
  total: number
  walkerPayout: number
  estimatedMargin: number
  currency: string
  validUntil: string
  cancellationPolicy: string
}

export function getCategories() {
  return SERVICE_CATEGORIES
}

export function getCategory(id: string) {
  return SERVICE_CATEGORIES.find((c) => c.id === id)
}
