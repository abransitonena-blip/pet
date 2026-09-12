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

/** El icono de ese nombre, o null si lo guardado es un emoji u otra cosa. */
export function walkTipIcon(name: string): LucideIcon | null {
  return BY_NAME.get(name.trim().toLowerCase()) ?? null
}
