/**
 * Los paneles de administración: qué es cada uno y cuáles se muestran.
 *
 * El menú vivía sólo dentro del layout, así que nadie podía explicar un panel
 * ni decidir si le sirve. Aquí quedan los datos -- el nombre, su grupo y una
 * línea que dice qué hace y de dónde salen sus números -- para que Configuración
 * pueda mostrarlos, ocultarlos, reordenarlos y decidir qué ve un supervisor.
 *
 * Los iconos y las rutas siguen en el layout: esto describe los paneles, no los
 * dibuja.
 */

export interface AdminPanel {
  id: string
  label: string
  group: string
  /** Qué hace el panel y de dónde salen sus datos. */
  description: string
}

export const ADMIN_PANELS: readonly AdminPanel[] = [
  { id: 'dashboard', label: 'Resumen', group: 'General', description: 'La foto del día: paseos de hoy, lo que falta por asignar y la actividad reciente.' },
  { id: 'reservas', label: 'Solicitudes y paseos', group: 'Operación', description: 'Donde se asigna cada paseo a un paseador. El historial viejo queda en solo lectura.' },
  { id: 'reportes', label: 'Reportes de paseo', group: 'Operación', description: 'Lo que el paseador escribió y las fotos que subió, cuando envía su reporte.' },
  { id: 'rutas', label: 'Rutas', group: 'Operación', description: 'Dónde empezó y terminó cada paseo, su recorrido y las alertas de salida de zona.' },
  { id: 'pet-ahora', label: 'PET Ahora', group: 'Operación', description: 'Paseos al instante: a quién se le ofreció cada solicitud y quién la tomó.' },
  { id: 'clientes', label: 'Familias', group: 'Personas', description: 'Las cuentas registradas, con su etapa (nueva, activa, en riesgo) y sus paseos.' },
  { id: 'perros', label: 'Perros', group: 'Personas', description: 'Todos los perros dados de alta, con alergias, medicamento y refuerzos de vacuna.' },
  { id: 'paseadores', label: 'Paseadores', group: 'Personas', description: 'Alta y activación del equipo, sus zonas y su carga de trabajo real.' },
  { id: 'tickets', label: 'Tickets internos', group: 'Cobros', description: 'Recibos internos de paseos completados. No son CFDI ni registran un pago.' },
  { id: 'printing-test', label: 'Prueba de impresión', group: 'Cobros', description: 'Genera el ticket de un paseo real y lo manda a la impresora Bluetooth.' },
  { id: 'printing-lab', label: 'Laboratorio de impresión', group: 'Cobros', description: 'Prueba el formato del ticket con datos inventados, sin tocar un paseo real.' },
  { id: 'finanzas', label: 'Finanzas', group: 'Cobros', description: 'Valor de los paseos completados, contado sólo cuando su tarifa se puede verificar.' },
  { id: 'cupones', label: 'Cupones', group: 'Contenido', description: 'Códigos de descuento y su uso.' },
  { id: 'referidos', label: 'Referidos', group: 'Contenido', description: 'Quién invitó a quién. Las recompensas automáticas están apagadas.' },
  { id: 'resenas', label: 'Reseñas', group: 'Contenido', description: 'Las reseñas de las familias, que se publican en el sitio.' },
  { id: 'comentarios', label: 'Comentarios de familias', group: 'Contenido', description: 'Comentarios privados que llegan desde el panel de familia y no se publican.' },
  { id: 'galeria', label: 'Galería', group: 'Contenido', description: 'Fotos públicas del sitio, con su consentimiento registrado.' },
  { id: 'chat', label: 'Chat', group: 'Contenido', description: 'Los hilos con familias y paseadores: uno por persona.' },
  { id: 'zonas', label: 'Zonas', group: 'Configuración', description: 'Centro y radio de cada zona, códigos postales que cubre y lugares para pasear.' },
  { id: 'config', label: 'Configuración', group: 'Configuración', description: 'Precios, horarios, textos del sitio, funciones encendidas y estos paneles.' },
  { id: 'analitica', label: 'Analítica', group: 'Sistema', description: 'Cifras del periodo a partir de los paseos reales.' },
  { id: 'logs', label: 'Logs', group: 'Sistema', description: 'Registro de los cambios hechos desde el panel.' },
  { id: 'errores', label: 'Errores de aplicación', group: 'Sistema', description: 'Errores que reportaron los navegadores de las familias.' },
  { id: 'ia', label: 'Insights', group: 'Sistema', description: 'Lo que merece atención: paseos sin asignar, reportes sin enviar, familias en riesgo.' },
]

export const ADMIN_PANEL_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  ADMIN_PANELS.map((panel) => [panel.id, panel.description]),
)

export interface AdminPanelPreferences {
  /** Paneles ocultos para todo el equipo. */
  hidden?: string[]
  /** Orden elegido; lo que no esté aquí conserva su lugar natural, al final. */
  order?: string[]
  /** Paneles que además se ocultan a un supervisor. */
  supervisorHidden?: string[]
}

/** El panel de Configuración nunca se oculta: sería la puerta que se cierra por dentro. */
export const ALWAYS_VISIBLE_PANEL = 'config'

export function isPanelVisible(id: string, preferences: AdminPanelPreferences | undefined, role: string): boolean {
  if (id === ALWAYS_VISIBLE_PANEL) return true
  if (preferences?.hidden?.includes(id)) return false
  if (role === 'supervisor' && preferences?.supervisorHidden?.includes(id)) return false
  return true
}

/**
 * Aplica lo elegido a la lista del menú: primero quita lo oculto, luego ordena.
 * Un panel sin lugar asignado conserva su posición relativa al final.
 */
export function applyPanelPreferences<T extends { id: string }>(
  items: readonly T[],
  preferences: AdminPanelPreferences | undefined,
  role: string,
): T[] {
  const visible = items.filter((item) => isPanelVisible(item.id, preferences, role))
  const order = preferences?.order ?? []
  if (order.length === 0) return visible
  const rank = new Map(order.map((id, index) => [id, index]))
  return [...visible].sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length))
}

/** La lista completa en el orden vigente, para pintarla en Configuración. */
export function orderedPanels(preferences: AdminPanelPreferences | undefined): AdminPanel[] {
  const order = preferences?.order ?? []
  if (order.length === 0) return [...ADMIN_PANELS]
  const rank = new Map(order.map((id, index) => [id, index]))
  return [...ADMIN_PANELS].sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length))
}

/** Sube o baja un panel dentro del orden, devolviendo la lista completa de ids. */
export function movePanel(preferences: AdminPanelPreferences | undefined, id: string, direction: -1 | 1): string[] {
  const ids = orderedPanels(preferences).map((panel) => panel.id)
  const from = ids.indexOf(id)
  const to = from + direction
  if (from < 0 || to < 0 || to >= ids.length) return ids
  const next = [...ids]
  next[from] = ids[to]
  next[to] = ids[from]
  return next
}

/** Enciende o apaga un id dentro de una lista, sin repetirlo. */
export function togglePanelId(list: string[] | undefined, id: string): string[] {
  const current = list ?? []
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
}
