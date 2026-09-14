/**
 * Razas y el color con que se distinguen cuando el perro no tiene foto.
 *
 * No son ilustraciones por raza. Prometer un dibujo distinto para cada una sería
 * prometer cientos de ilustraciones que nadie va a dibujar, y terminaría en un
 * cuadro gris igual para todos. Lo que sí se puede sostener: agrupar las razas
 * por familia -- nórdicas, toy, pastores, retrievers... -- y darle a cada grupo
 * su color. Así dos huskies se ven iguales entre sí y distintos de un chihuahua,
 * y la lista se puede ampliar sin rehacer nada.
 *
 * La raza sigue siendo texto libre en el formulario: obligar a elegir haría que
 * una familia con un mestizo o una raza poco común escriba algo falso. Lo que no
 * esté en esta lista recibe un color estable a partir de su nombre.
 */

export type BreedGroup =
  | 'mestizo' | 'toy' | 'terrier' | 'pastor' | 'retriever'
  | 'nordico' | 'trabajo' | 'sabueso' | 'braquicefalo' | 'sinpelo'

export interface BreedGroupStyle {
  label: string
  background: string
  ink: string
}

export const BREED_GROUP_STYLES: Record<BreedGroup, BreedGroupStyle> = {
  mestizo: { label: 'Mestizo', background: '#FDE8D7', ink: '#C45100' },
  toy: { label: 'Pequeña', background: '#F6E0EC', ink: '#A33B72' },
  terrier: { label: 'Terrier', background: '#EFE6D2', ink: '#8A6A1F' },
  pastor: { label: 'Pastoreo', background: '#DCEFE6', ink: '#0F766E' },
  retriever: { label: 'Cobrador', background: '#FBEBD2', ink: '#9A6212' },
  nordico: { label: 'Nórdica', background: '#DDE7FA', ink: '#2E4FA8' },
  trabajo: { label: 'Trabajo', background: '#E5E2F6', ink: '#5340A8' },
  sabueso: { label: 'Sabueso', background: '#E8E9D8', ink: '#5F6B23' },
  braquicefalo: { label: 'Hocico corto', background: '#F7E2DC', ink: '#A24A36' },
  sinpelo: { label: 'Sin pelo', background: '#E6E4E1', ink: '#5B5450' },
}

/** Raza → grupo. La clave está normalizada: sin acentos, en minúsculas. */
const BREEDS: Record<string, BreedGroup> = {
  mestizo: 'mestizo', criollo: 'mestizo', 'raza mixta': 'mestizo',
  chihuahua: 'toy', pomerania: 'toy', maltes: 'toy', 'shih tzu': 'toy', poodle: 'toy',
  'poodle toy': 'toy', pequines: 'toy', papillon: 'toy', 'bichon frise': 'toy',
  'spitz japones': 'toy', 'lhasa apso': 'toy', chino: 'toy',
  'yorkshire terrier': 'terrier', 'jack russell terrier': 'terrier', 'fox terrier': 'terrier',
  'bull terrier': 'terrier', 'west highland white terrier': 'terrier', schnauzer: 'terrier',
  'schnauzer miniatura': 'terrier', 'scottish terrier': 'terrier', 'airedale terrier': 'terrier',
  'pastor aleman': 'pastor', 'pastor belga': 'pastor', 'pastor australiano': 'pastor',
  'border collie': 'pastor', collie: 'pastor', 'ovejero ingles': 'pastor', 'pastor ganadero': 'pastor',
  corgi: 'pastor', 'welsh corgi': 'pastor',
  'labrador retriever': 'retriever', 'golden retriever': 'retriever', 'cocker spaniel': 'retriever',
  'springer spaniel': 'retriever', 'setter irlandes': 'retriever', braco: 'retriever',
  weimaraner: 'retriever', vizsla: 'retriever',
  'husky siberiano': 'nordico', samoyedo: 'nordico', 'malamute de alaska': 'nordico',
  akita: 'nordico', 'shiba inu': 'nordico', 'chow chow': 'nordico', 'alaskan klee kai': 'nordico',
  rottweiler: 'trabajo', doberman: 'trabajo', boxer: 'trabajo', 'gran danes': 'trabajo',
  'san bernardo': 'trabajo', 'dogo argentino': 'trabajo', 'cane corso': 'trabajo',
  mastin: 'trabajo', pitbull: 'trabajo', 'american bully': 'trabajo', 'staffordshire terrier': 'trabajo',
  'gran pirineo': 'trabajo', 'bernes de la montaña': 'trabajo',
  beagle: 'sabueso', 'dachshund (salchicha)': 'sabueso', dachshund: 'sabueso', salchicha: 'sabueso',
  basset: 'sabueso', 'basset hound': 'sabueso', bloodhound: 'sabueso', galgo: 'sabueso',
  whippet: 'sabueso', 'sabueso español': 'sabueso',
  pug: 'braquicefalo', 'bulldog frances': 'braquicefalo', 'bulldog ingles': 'braquicefalo',
  bulldog: 'braquicefalo', boston: 'braquicefalo', 'boston terrier': 'braquicefalo',
  'shar pei': 'braquicefalo', 'cavalier king charles': 'braquicefalo',
  xoloitzcuintle: 'sinpelo', xolo: 'sinpelo', 'crestado chino': 'sinpelo', 'perro peruano': 'sinpelo',
}

/** Sin acentos y en minúsculas: "Pastor Alemán" y "pastor aleman" son la misma. */
export function normalizeBreed(breed: string): string {
  return breed.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Las claves también se normalizan.
 *
 * Una clave con acento -- "bernés de la montaña", "sabueso español" -- nunca
 * podía encontrarse: lo buscado llega sin acentos y la clave los tenía, así que
 * esas razas quedaban fuera en silencio. Normalizar las dos puntas lo cierra.
 */
const LOOKUP: ReadonlyMap<string, BreedGroup> = new Map(
  Object.entries(BREEDS).map(([name, group]) => [normalizeBreed(name), group]),
)

/**
 * El grupo de una raza, o null si no la conocemos. Reconoce la raza dentro de un
 * texto más largo ("Husky siberiano de ojos azules") porque la gente escribe así.
 */
export function breedGroup(breed: string): BreedGroup | null {
  const clean = normalizeBreed(breed)
  if (!clean) return null
  const exact = LOOKUP.get(clean)
  if (exact) return exact
  // La coincidencia más larga gana: "bulldog frances" antes que "bulldog".
  let best: { name: string; group: BreedGroup } | null = null
  for (const [name, group] of Array.from(LOOKUP.entries())) {
    if (clean.includes(name) && (!best || name.length > best.name.length)) best = { name, group }
  }
  return best?.group ?? null
}

/** Todas las razas conocidas, con mayúsculas presentables, para sugerir. */
export const DOG_BREED_SUGGESTIONS: readonly string[] = Object.keys(BREEDS)
  .map((breed) => breed.replace(/\b[a-z]/g, (letter) => letter.toUpperCase()))
  .sort((a, b) => a.localeCompare(b, 'es'))
