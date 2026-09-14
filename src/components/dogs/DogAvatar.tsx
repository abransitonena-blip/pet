import { PawMark } from '@/components/ui/Logo'
import { BREED_GROUP_STYLES, breedGroup } from '@/lib/dogBreeds'

/**
 * La imagen del perro cuando todavía no hay foto.
 *
 * El color sale de la familia de su raza: los nórdicos en azul, los de hocico
 * corto en terracota, los toy en rosa. Así dos huskies se ven iguales entre sí y
 * distintos de un chihuahua, que es lo que hace útil un color.
 *
 * No es un dibujo por raza. Prometer cientos de ilustraciones (husky, pastor,
 * salchicha…) sería prometer algo que no existe en el proyecto; esto es la
 * marca de PET Ap teñida por grupo, y desaparece en cuanto la familia sube una
 * foto de verdad.
 *
 * Una raza que no conocemos -- o un mestizo con un nombre propio -- recibe un
 * color estable a partir de su texto, así que sigue distinguiéndose de los
 * demás aunque no esté en el catálogo.
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
function fallbackPalette(seed: string) {
  const clean = seed.trim().toLowerCase() || 'pet'
  let total = 0
  for (let index = 0; index < clean.length; index += 1) total += clean.charCodeAt(index)
  return PALETTE[total % PALETTE.length]
}

/** El color de su grupo de raza; si no la conocemos, uno estable por su texto. */
function dogPalette(name: string, breed: string) {
  const group = breedGroup(breed)
  if (group) {
    const style = BREED_GROUP_STYLES[group]
    return { background: style.background, ink: style.ink }
  }
  return fallbackPalette(`${name}${breed}`)
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

  const palette = dogPalette(name, breed)
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
