import { PawMark } from '@/components/ui/Logo'

/**
 * La imagen del perro cuando todavía no hay foto.
 *
 * En vez de un cuadro gris igual para todos, cada perro recibe siempre el
 * mismo color, elegido a partir de su nombre y su raza: así se distinguen de
 * un vistazo en la lista y el perfil deja de verse vacío.
 *
 * No es un dibujo por raza. Prometer cientos de ilustraciones (husky, pastor,
 * salchicha…) sería prometer algo que no existe en el proyecto; esto es la
 * marca de PET Ap teñida, estable para cada perro, y desaparece en cuanto la
 * familia sube una foto de verdad.
 */

const PALETTE = [
  { background: '#FDE8D7', ink: '#C45100' },
  { background: '#DCEFE6', ink: '#0F766E' },
  { background: '#DDE7FA', ink: '#2E4FA8' },
  { background: '#F6E0EC', ink: '#A33B72' },
  { background: '#EFE6D2', ink: '#8A6A1F' },
  { background: '#E5E2F6', ink: '#5340A8' },
]

/** El mismo perro recibe siempre el mismo color, hoy y en un mes. */
function dogPalette(seed: string) {
  const clean = seed.trim().toLowerCase() || 'pet'
  let total = 0
  for (let index = 0; index < clean.length; index += 1) total += clean.charCodeAt(index)
  return PALETTE[total % PALETTE.length]
}

interface DogAvatarProps {
  name: string
  breed?: string
  photoUrl?: string
  size?: number
  className?: string
}

export default function DogAvatar({ name, breed = '', photoUrl = '', size = 48, className = '' }: DogAvatarProps) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`Foto de ${name || 'la mascota'}`}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  const palette = dogPalette(`${name}${breed}`)
  return (
    <span
      role="img"
      aria-label={`${name || 'Mascota'} sin foto`}
      className={`grid shrink-0 place-items-center rounded-full ${className}`}
      style={{ width: size, height: size, background: palette.background, color: palette.ink }}
    >
      <PawMark size={Math.round(size * 0.58)} />
    </span>
  )
}
