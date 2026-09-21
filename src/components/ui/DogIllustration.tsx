/**
 * Perritos propios: ilustraciones para los lugares donde no hay nada que mostrar.
 *
 * Los huecos vacíos eran un cuadro con un ícono de trazo, igual al de cualquier
 * app. Aquí cada uno tiene un perro haciendo algo que tiene que ver con lo que
 * falta: sentado esperando el primer paseo, dormido cuando no hay nada pendiente,
 * asomándose cuando no hay con quién hablar, olfateando cuando la búsqueda no
 * encuentra.
 *
 * Son dibujos de PET Ap, no de una raza: un mismo perro de cuerpo redondo que
 * cambia de postura. No prometen parecerse al perro de nadie.
 *
 * El color del perro es `currentColor`: el de marca, que el negocio elige en
 * Diseño y marca. Los rasgos son colores fijos (ver arriba) y sólo lo que está
 * fuera del perro -- zetas, correa, lupa -- toma el color del texto del tema.
 */

export type DogPose = 'sentado' | 'caminando' | 'durmiendo' | 'asomando' | 'olfateando'

/** Lo que va SOBRE la página -- zetas, correa, lupa, el borde -- sigue al tema. */
const INK = 'var(--text-primary)'
/**
 * Lo que va sobre el perro no puede seguir al tema: el hocico, las patas y el
 * pecho son de un cálido fijo, porque el color de la tarjeta es justo el del
 * fondo y las patas desaparecían; y ojos, nariz y boca son oscuros fijos, porque
 * sobre el naranja una nariz blanca no es una nariz.
 */
const CREAM = '#FBEBD9'
const FEATURE = '#172033'
const TONGUE = '#F4A3B0'

/** La cara de frente, compartida por el sentado y el que se asoma. */
function Face({ cx, cy, look = 0 }: { cx: number; cy: number; look?: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy + 10} rx={12} ry={9} fill={CREAM} />
      <circle cx={cx - 9} cy={cy - 4 + look} r={2.7} fill={FEATURE} />
      <circle cx={cx + 9} cy={cy - 4 + look} r={2.7} fill={FEATURE} />
      <ellipse cx={cx} cy={cy + 4} rx={4.6} ry={3.3} fill={FEATURE} />
      <path d={`M${cx} ${cy + 7.5}v4M${cx} ${cy + 11.5}q-4 4-8 1M${cx} ${cy + 11.5}q4 4 8 1`} stroke={FEATURE} strokeWidth={1.7} strokeLinecap="round" fill="none" />
    </g>
  )
}

const POSES: Record<DogPose, { viewBox: string; body: React.ReactNode }> = {
  // De frente, sentado, con la lengua afuera: esperando lo primero que pase.
  sentado: {
    viewBox: '0 0 120 120',
    body: (
      <>
        <path d="M86 98q16-2 16-20" stroke="currentColor" strokeWidth={9} strokeLinecap="round" fill="none" />
        <ellipse cx={60} cy={86} rx={27} ry={27} fill="currentColor" />
        <ellipse cx={60} cy={93} rx={13} ry={17} fill={CREAM} opacity={0.92} />
        <rect x={44} y={92} width={13} height={22} rx={6.5} fill="currentColor" />
        <rect x={63} y={92} width={13} height={22} rx={6.5} fill="currentColor" />
        <ellipse cx={50} cy={114} rx={10} ry={5} fill={CREAM} />
        <ellipse cx={70} cy={114} rx={10} ry={5} fill={CREAM} />
        <circle cx={60} cy={46} r={24} fill="currentColor" />
        <path d="M40 32C27 32 24 56 33 63c6-4 9-17 11-31Z" fill="currentColor" />
        <path d="M40 32C27 32 24 56 33 63c6-4 9-17 11-31Z" fill={FEATURE} opacity={0.22} />
        <path d="M80 32c13 0 16 24 7 31-6-4-9-17-11-31Z" fill="currentColor" />
        <path d="M80 32c13 0 16 24 7 31-6-4-9-17-11-31Z" fill={FEATURE} opacity={0.22} />
        <Face cx={60} cy={46} />
        <path d="M56 58q4 9 8 0Z" fill={TONGUE} />
      </>
    ),
  },

  // De lado, con su correa: el paseo.
  caminando: {
    viewBox: '0 0 160 112',
    body: (
      <>
        <path d="M40 60q-17-4-15-26" stroke="currentColor" strokeWidth={8} strokeLinecap="round" fill="none" />
        <rect x={54} y={78} width={10} height={28} rx={5} fill="currentColor" opacity={0.72} />
        <rect x={90} y={78} width={10} height={28} rx={5} fill="currentColor" opacity={0.72} />
        <rect x={36} y={52} width={72} height={34} rx={17} fill="currentColor" />
        <rect x={44} y={78} width={10} height={28} rx={5} fill="currentColor" />
        <rect x={98} y={78} width={10} height={28} rx={5} fill="currentColor" />
        <rect x={56} y={64} width={30} height={22} rx={11} fill={CREAM} opacity={0.85} />
        <circle cx={118} cy={48} r={20} fill="currentColor" />
        <rect x={126} y={48} width={25} height={17} rx={8.5} fill={CREAM} />
        <ellipse cx={146} cy={53} rx={4.4} ry={3.6} fill={FEATURE} />
        <circle cx={123} cy={42} r={2.8} fill={FEATURE} />
        <path d="M109 33C94 36 95 64 106 67c8-7 10-20 12-34Z" fill="currentColor" />
        <path d="M109 33C94 36 95 64 106 67c8-7 10-20 12-34Z" fill={FEATURE} opacity={0.22} />
        <path d="M104 60l11 12" stroke="#2F8F83" strokeWidth={4.5} strokeLinecap="round" />
        <path d="M111 70Q136 68 150 24" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
        <circle cx={150} cy={20} r={4.5} stroke={INK} strokeWidth={2} fill="none" />
      </>
    ),
  },

  // Hecho un caracol, con sus zetas: no hay nada pendiente.
  durmiendo: {
    viewBox: '0 0 160 112',
    body: (
      <>
        <ellipse cx={132} cy={84} rx={17} ry={8} transform="rotate(-24 132 84)" fill="currentColor" />
        <ellipse cx={82} cy={82} rx={50} ry={27} fill="currentColor" />
        <ellipse cx={86} cy={98} rx={34} ry={9} fill={CREAM} opacity={0.85} />
        <circle cx={44} cy={80} r={22} fill="currentColor" />
        <ellipse cx={30} cy={88} rx={12} ry={9.5} fill={CREAM} />
        <ellipse cx={24} cy={85} rx={4.4} ry={3.4} fill={FEATURE} />
        <path d="M37 74q5 5 10 0" stroke={FEATURE} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        <path d="M50 60C62 60 66 82 57 90c-6-3-9-16-7-30Z" fill="currentColor" />
        <path d="M50 60C62 60 66 82 57 90c-6-3-9-16-7-30Z" fill={FEATURE} opacity={0.22} />
        <ellipse cx={48} cy={102} rx={14} ry={6} fill={CREAM} />
        <path d="M112 42h13l-13 15h13" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M133 24h9l-9 10h9" stroke={INK} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.7} />
      </>
    ),
  },

  // Sólo la cabeza sobre el borde, con las patas arriba: ¿hay alguien?
  asomando: {
    viewBox: '0 0 120 90',
    body: (
      <>
        <circle cx={60} cy={38} r={24} fill="currentColor" />
        <path d="M40 24C27 24 24 48 33 55c6-4 9-17 11-31Z" fill="currentColor" />
        <path d="M40 24C27 24 24 48 33 55c6-4 9-17 11-31Z" fill={FEATURE} opacity={0.22} />
        <path d="M80 24c13 0 16 24 7 31-6-4-9-17-11-31Z" fill="currentColor" />
        <path d="M80 24c13 0 16 24 7 31-6-4-9-17-11-31Z" fill={FEATURE} opacity={0.22} />
        <Face cx={60} cy={38} look={-1} />
        <ellipse cx={45} cy={64} rx={10} ry={6} fill="currentColor" />
        <ellipse cx={75} cy={64} rx={10} ry={6} fill="currentColor" />
        <path d="M40 66v2M45 66v2M50 66v2M70 66v2M75 66v2M80 66v2" stroke={CREAM} strokeWidth={1.6} strokeLinecap="round" />
        <rect x={6} y={68} width={108} height={9} rx={4.5} fill={INK} opacity={0.16} />
      </>
    ),
  },

  // Con el hocico en el piso y una lupa: la búsqueda no encontró nada.
  olfateando: {
    viewBox: '0 0 160 112',
    body: (
      <>
        <path d="M126 60q17-3 17-24" stroke="currentColor" strokeWidth={8} strokeLinecap="round" fill="none" />
        <rect x={114} y={78} width={10} height={28} rx={5} fill="currentColor" opacity={0.72} />
        <rect x={76} y={78} width={10} height={28} rx={5} fill="currentColor" opacity={0.72} />
        <rect x={50} y={52} width={78} height={34} rx={17} fill="currentColor" />
        <rect x={104} y={78} width={10} height={28} rx={5} fill="currentColor" />
        <rect x={66} y={78} width={10} height={28} rx={5} fill="currentColor" />
        <rect x={72} y={64} width={32} height={22} rx={11} fill={CREAM} opacity={0.85} />
        <path d="M58 62q-15 8-17 22" stroke="currentColor" strokeWidth={19} strokeLinecap="round" fill="none" />
        <circle cx={40} cy={84} r={18} fill="currentColor" />
        <ellipse cx={27} cy={98} rx={11} ry={8.5} fill={CREAM} />
        <ellipse cx={21} cy={101} rx={4} ry={3.1} fill={FEATURE} />
        <circle cx={36} cy={78} r={2.7} fill={FEATURE} />
        <path d="M47 68C61 68 64 92 54 97c-7-6-9-16-7-29Z" fill="currentColor" />
        <path d="M47 68C61 68 64 92 54 97c-7-6-9-16-7-29Z" fill={FEATURE} opacity={0.22} />
        <circle cx={15} cy={70} r={10.5} stroke={INK} strokeWidth={2.4} fill={CREAM} opacity={0.75} />
        <path d="M8 78l-6 7" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <path d="M4 106h60" stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.25} />
      </>
    ),
  },
}

export interface DogIllustrationProps {
  pose: DogPose
  /** Ancho en píxeles; el alto sale de la proporción del dibujo. */
  size?: number
  className?: string
}

export default function DogIllustration({ pose, size = 112, className = '' }: DogIllustrationProps) {
  const { viewBox, body } = POSES[pose]
  const [, , width, height] = viewBox.split(' ').map(Number)
  return (
    // Decorativo: el título y la descripción de al lado son los que informan.
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={viewBox}
      width={size}
      height={Math.round((size * height) / width)}
      className={`mx-auto block text-primary ${className}`}
    >
      {body}
    </svg>
  )
}

export const DOG_POSES = Object.keys(POSES) as DogPose[]
