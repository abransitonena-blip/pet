import {
  CalendarX,
  Camera,
  Clock,
  CloudRain,
  Dog,
  HelpCircle,
  Ruler,
  ShieldCheck,
  Syringe,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

/**
 * El icono de cada pregunta frecuente.
 *
 * Todas llevaban el mismo signo de interrogación, que no dice nada: una lista de
 * seis preguntas idénticas de un vistazo. El icono sale de lo que la pregunta
 * trata, no de un campo nuevo -- así lo que administración ya escribió se
 * ilustra solo, sin que nadie tenga que volver a capturar nada.
 *
 * El orden importa: gana la primera regla que coincide, así que lo específico va
 * antes que lo general.
 */

interface FaqIconRule {
  icon: LucideIcon
  keywords: readonly string[]
}

const RULES: readonly FaqIconRule[] = [
  { icon: CalendarX, keywords: ['cancel', 'reprogram', 'no-show', 'no show'] },
  { icon: CloudRain, keywords: ['llueve', 'lluvia', 'clima', 'tormenta', 'frío', 'frio'] },
  { icon: Clock, keywords: ['horario', 'hora', 'cuándo', 'cuando', 'duración', 'duracion', 'tarda'] },
  { icon: Syringe, keywords: ['vacun', 'desparasit', 'salud'] },
  { icon: Wallet, keywords: ['pago', 'pagar', 'precio', 'costo', 'cuesta', 'cobr', 'efectivo', 'transferencia'] },
  { icon: Ruler, keywords: ['talla', 'tamaño', 'tamano', 'peso', 'grande', 'pequeñ'] },
  { icon: Camera, keywords: ['foto', 'reporte', 'video', 'seguimiento'] },
  { icon: ShieldCheck, keywords: ['segur', 'confian', 'pierde', 'escapa', 'accidente'] },
  { icon: Dog, keywords: ['perro', 'mascota', 'cachorro', 'raza'] },
]

export function faqIcon(question: string): LucideIcon {
  const text = question.toLowerCase()
  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) return rule.icon
  }
  return HelpCircle
}
