import { brand } from '@/lib/brand'

export interface DayHours {
  open: string
  close: string
}

export const BUSINESS_HOURS: Record<string, DayHours | null> = {
  lunes:     { open: '07:00', close: '19:00' },
  martes:    { open: '07:00', close: '19:00' },
  miercoles: { open: '07:00', close: '19:00' },
  jueves:    { open: '07:00', close: '19:00' },
  viernes:   { open: '07:00', close: '19:00' },
  sabado:    { open: '08:00', close: '18:00' },
  domingo:   null,
}

export function generateTimeSlots(dayOfWeek: string): string[] {
  const hours = BUSINESS_HOURS[dayOfWeek]
  if (!hours) return []
  const [openH, openM] = hours.open.split(':').map(Number)
  const [closeH, closeM] = hours.close.split(':').map(Number)
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM
  const WINDOW_MINUTES = 20
  const slots: string[] = []
  for (let m = openMinutes; m < closeMinutes; m += WINDOW_MINUTES) {
    const endM = Math.min(m + WINDOW_MINUTES, closeMinutes)
    const startStr = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    const endStr = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
    slots.push(`${startStr}-${endStr}`)
  }
  return slots
}

export function formatBusinessHours(): { weekday: string; hours: string }[] {
  return [
    { weekday: 'Lun - Vie', hours: '7:00 - 19:00' },
    { weekday: 'Sábado', hours: '8:00 - 18:00' },
  ]
}

export function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  return days[date.getDay()]
}

export interface Announcement {
  id: string
  title: string
  message: string
  icon: string
  startDate: string
  endDate: string
  active: boolean
}

export interface SiteConfig {
  schemaVersion?: number
  brandName?: string
  heroTitle: string
  heroSubtitle: string
  sectionDescriptions: {
    services: string
    howItWorks: string
    faq: string
  }
  whatsapp: string
  whatsappE164?: string
  displayPhone?: string
  contactEmail?: string
  instagram: string
  instagramUrl?: string
  facebook: string
  tiktok: string
  analyticsEnabled?: boolean
  availableSlots: Record<string, string[]>
  walkTips: { title: string; text: string; icon: string }[]
  faq: { question: string; answer: string }[]
  termsSections?: { title: string; content: string }[]
  privacySections?: { title: string; content: string }[]
  // Los paseadores viven en `walkerProfiles`, la colección en la que confían
  // las reglas. El registro que se guardaba aquí ya no lo lee ningún panel.
  maintenance: boolean
  features: {
    petAhoraEnabled: boolean
  }
  announcements: Announcement[]
}

export const DEFAULT_CONFIG: SiteConfig = {
  schemaVersion: 2,
  brandName: brand.name,
  heroTitle: 'Bienestar para tu perro. Tranquilidad para ti.',
  heroSubtitle: 'Solicita paseos programados y consulta su estado desde Familia PET.',
  sectionDescriptions: {
    services: 'Consulta las opciones disponibles y solicita el paseo que se adapte a las necesidades de tu perro.',
    howItWorks: 'Reserva en 3 simples pasos y nosotros nos encargamos del resto.',
    faq: 'Respuestas a las preguntas más frecuentes sobre nuestros servicios.',
  },
  whatsapp: brand.whatsapp,
  whatsappE164: brand.whatsapp,
  displayPhone: brand.displayPhone,
  contactEmail: brand.email,
  instagram: 'https://www.instagram.com/pet___ap',
  instagramUrl: 'https://www.instagram.com/pet___ap',
  facebook: '',
  tiktok: '',
  analyticsEnabled: false,
  availableSlots: {
    lunes:     generateTimeSlots('lunes'),
    martes:    generateTimeSlots('martes'),
    miercoles: generateTimeSlots('miercoles'),
    jueves:    generateTimeSlots('jueves'),
    viernes:   generateTimeSlots('viernes'),
    sabado:    generateTimeSlots('sabado'),
  },
  walkTips: [
    { title: 'Hidratación', text: 'Asegúrate de que tu perro tenga agua fresca antes y después del paseo.', icon: '💧' },
    { title: 'Descanso', text: 'Después del paseo, deja que tu perro descanse en un lugar tranquilo.', icon: '😴' },
    { title: 'Recompensa', text: 'Un premio después del paseo refuerza su buena conducta.', icon: '🦴' },
  ],
  faq: [
    { question: '¿En qué horario realizan los paseos?', answer: 'Operamos de Lunes a Viernes de 7:00 AM a 7:00 PM, y Sábados de 8:00 AM a 6:00 PM. Los paseos se agendan según disponibilidad.' },
    { question: '¿Qué pasa si llueve?', answer: 'En caso de lluvia ligera, el paseo se realiza normalmente (a los perros les encanta). Si hay tormenta o condiciones peligrosas, te contactaremos para reprogramar sin costo.' },
    { question: '¿Cómo funcionan las cancelaciones?', answer: 'Puedes cancelar sin costo hasta 2 horas antes del paseo. Cancelaciones tardías o no-show pueden generar un cargo del 50%. Entendemos emergencias, háblanos.' },
    { question: '¿Pasean perros de todas las tallas?', answer: '¡Claro! Desde chihuahuas hasta grandes daneses. Agrupamos por tamaño y temperamento para la seguridad de todos.' },
    { question: '¿Qué incluye el Paseo + Reporte?', answer: 'Duración de 45 min con reporte detallado por WhatsApp, fotos, video y ejercicios personalizados.' },
    { question: '¿Cómo pago?', answer: 'Aceptamos efectivo, transferencia bancaria y depósito. El pago se acuerda al momento de agendar.' },
    { question: '¿Mi perro necesita estar vacunado?', answer: 'Sí, pedimos que los perros estén al día con sus vacunas (múltiple y antirrábica) para la seguridad de todos los peludos.' },
  ],
  termsSections: undefined,
  privacySections: undefined,
  maintenance: false,
  features: {
    petAhoraEnabled: false,
  },
  announcements: [],
}
