/**
 * El contador de un menú: no aparece cuando no hay nada que contar.
 *
 * Un cero en el menú es ruido -- dice "hay algo" y no hay nada. Arriba de 9 se
 * muestra "9+", porque el número exacto no cambia lo que uno hace con él.
 */
export default function NavBadge({ count, label, className = '' }: { count: number; label: string; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      aria-label={`${count} ${label}`}
      className={`grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-danger-500 px-1.5 text-2xs font-bold text-white ${className}`}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}
