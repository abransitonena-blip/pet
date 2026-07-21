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
  const [openH] = hours.open.split(':').map(Number)
  const [closeH] = hours.close.split(':').map(Number)
  const slots: string[] = []
  for (let h = openH; h < closeH; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
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

export interface SiteConfig {
  heroTitle: string
  heroSubtitle: string
  sectionDescriptions: {
    services: string
    howItWorks: string
    faq: string
  }
  whatsapp: string
  instagram: string
  facebook: string
  tiktok: string
  availableSlots: Record<string, string[]>
  walkTips: { title: string; text: string; icon: string }[]
  faq: { question: string; answer: string }[]
  termsContent: string
  walkers: { name: string; phone: string }[]
  maintenance: boolean
}

export const DEFAULT_CONFIG: SiteConfig = {
  heroTitle: 'Paseos caninos en Zona Quebrada 🐾',
  heroSubtitle: 'Paseos supervisados de lunes a sábado. Ejercicio, diversión y mucho amor para tu mejor amigo.',
  sectionDescriptions: {
    services: 'Todos nuestros paseos son supervisados, seguros y pensados para la felicidad de tu perro.',
    howItWorks: 'Reserva en 3 simples pasos y nosotros nos encargamos del resto.',
    faq: 'Respuestas a las preguntas más frecuentes sobre nuestros servicios.',
  },
  whatsapp: '5523053772',
  instagram: 'https://www.instagram.com/pet___ap',
  facebook: '',
  tiktok: '',
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
    { question: '¿Qué incluye el Paseo + Reporte?', answer: 'Duración de 45 min con reporte detallado por WhatsApp, fotos, video, mapa del recorrido y ejercicios personalizados.' },
    { question: '¿Cómo pago?', answer: 'Aceptamos efectivo, transferencia bancaria y depósito. El pago se acuerda al momento de agendar.' },
    { question: '¿Zona Quebrada es la única zona?', answer: 'Sí, actualmente cubrimos exclusivamente Zona Quebrada en Cuautitlán. Esto nos permite dar un servicio más rápido y personalizado.' },
    { question: '¿Mi perro necesita estar vacunado?', answer: 'Sí, pedimos que los perros estén al día con sus vacunas (múltiple y antirrábica) para la seguridad de todos los peludos.' },
  ],
  termsContent: `TÉRMINOS Y CONDICIONES

1. SERVICIOS
Paseos Quebrada ofrece servicios de paseo canino en Zona Quebrada, Cuautitlán. Los paseos son supervisados por personal capacitado.

2. HORARIOS
Los paseos se realizan de lunes a viernes de 7:00 AM a 7:00 PM, y sábados de 8:00 AM a 6:00 PM. Domingo no hay servicio.

3. CANCELACIONES
Puedes cancelar tu reserva sin costo hasta 2 horas antes del paseo. Cancelaciones tardías pueden generar cargos.

4. RESPONSABILIDAD
Paseos Quebrada se compromete a cuidar de tu perro durante el paseo. No nos hacemos responsables por condiciones preexistentes de salud.

5. PAGOS
Los pagos se realizan en efectivo o transferencia el día del paseo.`,
  walkers: [
    { name: 'Efrain', phone: '552305377' },
  ],
  maintenance: false,
}
