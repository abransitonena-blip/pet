export interface ServiceOption {
  name: string
  price: number
  highlights?: string[]
}

export const SERVICES: ServiceOption[] = [
  { name: 'Paseo Individual (30 min)', price: 30, highlights: ['Atención personalizada 1 a 1', 'Ruta por Zona Quebrada', 'Ejercicio moderado', 'Supervisión constante'] },
  { name: 'Paseo Extendido (1 hora)', price: 60, highlights: ['1 hora de paseo continuo', 'Juegos y ejercicios', 'Ruta más larga y variada', 'Agua y descansos incluidos'] },
  { name: 'Paseo Grupal (45 min)', price: 55, highlights: ['Socialización con otros perros', 'Grupos de máximo 4', 'Supervisión todo el tiempo', 'Ejercicio en equipo'] },
  { name: 'Paseo + Adiestramiento (1 hora)', price: 70, highlights: ['Comandos básicos: sentado, quieto, aquí', 'Refuerzo positivo con premios', 'Paseo de 1 hora más entrenamiento', 'Ideal para perros jóvenes'] },
  { name: 'Paseo Express (20 min)', price: 35, highlights: ['Paseo rápido para necesidades', 'Perfecto entre comidas o antes de dormir', 'Sin complicaciones', 'Salida y regreso rápido'] },
  { name: 'Paseo + Reporte (45 min)', price: 60, highlights: ['Fotos y video de tu perro', 'Reporte detallado por WhatsApp', 'Mapa del recorrido', 'Ideal para dueños curiosos'] },
  { name: 'Paquete Semanal (6 paseos)', price: 390, highlights: ['6 paseos: lunes a sábado', 'Elige el horario cada día', 'Ahorras comparado con paseos sueltos', 'Perro feliz toda la semana'] },
]

export const SERVICE_NAMES = SERVICES.map((s) => s.name)

export function getServicePrice(serviceName: string): number {
  return SERVICES.find((s) => s.name === serviceName)?.price || 0
}
