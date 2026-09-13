import { CalendarX, Camera, Clock, CloudRain, HelpCircle, Ruler, Syringe, Wallet } from 'lucide-react'
import { faqIcon } from '@/lib/faqIcons'

/**
 * Cada pregunta frecuente llevaba el mismo signo de interrogación. El icono sale
 * del tema de la pregunta, sin pedirle a nadie que capture un campo nuevo.
 *
 * Se compara con el componente importado, no con su nombre: lucide renombra sus
 * iconos entre versiones (HelpCircle se llama CircleQuestionMark por dentro) y
 * una prueba atada al nombre se rompería sin que nada estuviera mal.
 */
describe('faqIcon', () => {
  it('reconoce los temas de las preguntas de fábrica', () => {
    expect(faqIcon('¿En qué horario realizan los paseos?')).toBe(Clock)
    expect(faqIcon('¿Qué pasa si llueve?')).toBe(CloudRain)
    expect(faqIcon('¿Cómo funcionan las cancelaciones?')).toBe(CalendarX)
    expect(faqIcon('¿Cómo pago?')).toBe(Wallet)
    expect(faqIcon('¿Mi perro necesita estar vacunado?')).toBe(Syringe)
    expect(faqIcon('¿Pasean perros de todas las tallas?')).toBe(Ruler)
    expect(faqIcon('¿Qué incluye el Paseo + Reporte?')).toBe(Camera)
  })

  it('una pregunta de otro tema cae en el signo de interrogación', () => {
    expect(faqIcon('¿Dónde están sus oficinas?')).toBe(HelpCircle)
  })

  it('no depende de mayúsculas', () => {
    expect(faqIcon('HORARIO de atención')).toBe(Clock)
  })

  it('lo específico gana sobre lo general', () => {
    // Menciona "perro", pero de lo que trata es de la cancelación.
    expect(faqIcon('¿Puedo cancelar el paseo de mi perro?')).toBe(CalendarX)
  })
})
