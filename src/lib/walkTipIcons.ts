import {
  Bone,
  Clock,
  Droplets,
  Footprints,
  Heart,
  Moon,
  PawPrint,
  ShieldCheck,
  Sun,
  Syringe,
  Tag,
  Thermometer,
  type LucideIcon,
} from 'lucide-react'

/**
 * Los iconos de los consejos: trazo simple, en el naranja de PET Ap.
 *
 * Antes cada consejo guardaba un emoji, que se dibuja distinto en cada teléfono
 * y nunca combina con la marca. Aquí hay un juego corto de iconos de línea, y el
 * consejo guarda el nombre en vez del dibujo.
 *
 * Lo que ya estaba guardado con emoji se sigue mostrando tal cual: nada
 * desaparece de la configuración de nadie por este cambio.
 */

export interface WalkTipIcon {
  name: string
  label: string
  icon: LucideIcon
}

export const WALK_TIP_ICONS: readonly WalkTipIcon[] = [
  { name: 'agua', label: 'Agua', icon: Droplets },
  { name: 'descanso', label: 'Descanso', icon: Moon },
  { name: 'premio', label: 'Premio', icon: Bone },
  { name: 'calor', label: 'Calor', icon: Sun },
  { name: 'patas', label: 'Patas', icon: Footprints },
  { name: 'temperatura', label: 'Temperatura', icon: Thermometer },
  { name: 'placa', label: 'Placa e identificación', icon: Tag },
  { name: 'vacunas', label: 'Vacunas', icon: Syringe },
  { name: 'correa', label: 'Correa y seguridad', icon: ShieldCheck },
  { name: 'rutina', label: 'Rutina y horarios', icon: Clock },
  { name: 'salud', label: 'Salud', icon: Heart },
  { name: 'paseo', label: 'Paseo', icon: PawPrint },
]

const BY_NAME = new Map(WALK_TIP_ICONS.map((entry) => [entry.name, entry.icon]))

/**
 * Los emojis que ya estaban guardados, traducidos.
 *
 * Cambiar los consejos de fábrica no cambia los que ya se guardaron en la
 * configuración: ahí siguen sus emojis, así que el sitio seguía dibujando
 * calcomanías. En vez de pedirle a alguien que edite consejo por consejo, el
 * emoji conocido se traduce al icono equivalente. Un emoji que no esté en esta
 * lista se sigue mostrando tal cual.
 */
const BY_LEGACY_EMOJI = new Map<string, string>([
  ['💧', 'agua'],
  ['💦', 'agua'],
  ['😴', 'descanso'],
  ['🛌', 'descanso'],
  ['🦴', 'premio'],
  ['🍖', 'premio'],
  ['☀️', 'calor'],
  ['🌡️', 'temperatura'],
  ['🐾', 'paseo'],
  ['🏷️', 'placa'],
  ['💉', 'vacunas'],
  ['🦮', 'correa'],
  ['⏰', 'rutina'],
  ['❤️', 'salud'],
  ['🩺', 'salud'],
])

/** El icono de ese nombre, o null si lo guardado no corresponde a ninguno. */
export function walkTipIcon(name: string): LucideIcon | null {
  const clean = name.trim().toLowerCase()
  const resolved = BY_NAME.get(clean)
  if (resolved) return resolved
  const fromEmoji = BY_LEGACY_EMOJI.get(name.trim())
  return fromEmoji ? BY_NAME.get(fromEmoji) ?? null : null
}
