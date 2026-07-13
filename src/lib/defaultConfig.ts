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
    lunes: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
    martes: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
    miercoles: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
    jueves: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
    viernes: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
    sabado: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
  },
  walkTips: [
    { title: 'Hidratación', text: 'Asegúrate de que tu perro tenga agua fresca antes y después del paseo.', icon: '💧' },
    { title: 'Descanso', text: 'Después del paseo, deja que tu perro descanse en un lugar tranquilo.', icon: '😴' },
    { title: 'Recompensa', text: 'Un premio después del paseo refuerza su buena conducta.', icon: '🦴' },
  ],
  faq: [],
  termsContent: `TÉRMINOS Y CONDICIONES

1. SERVICIOS
Paseos Quebrada ofrece servicios de paseo canino en Zona Quebrada, Cuautitlán. Los paseos son supervisados por personal capacitado.

2. HORARIOS
Los paseos se realizan de lunes a sábado en horarios previamente acordados. Domingo no hay servicio.

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
