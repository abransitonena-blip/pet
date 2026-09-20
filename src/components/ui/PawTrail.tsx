/**
 * Huellas que avanzan mientras algo carga.
 *
 * Una barra gris dice "espera"; unas huellas dicen "espera, y esto es PET Ap".
 * Es la misma señal de siempre -- algo está en camino -- contada con la marca
 * de la casa en vez de con un rectángulo.
 *
 * No lleva JavaScript: la animación es CSS (`.paw-trail` en globals.css), así
 * que el bloque de "reducir movimiento" la apaga entera y no pesa en la
 * descarga. Es decorativa, así que va oculta para quien usa lector de
 * pantalla: el texto de al lado es el que informa.
 */

/** Una huella de perro rellena: cuatro dedos y la almohadilla. */
function Paw({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <ellipse cx="5.4" cy="11.2" rx="2.1" ry="2.7" transform="rotate(-24 5.4 11.2)" />
      <ellipse cx="9.7" cy="7.3" rx="2.2" ry="2.9" transform="rotate(-8 9.7 7.3)" />
      <ellipse cx="14.5" cy="7.3" rx="2.2" ry="2.9" transform="rotate(8 14.5 7.3)" />
      <ellipse cx="18.8" cy="11.2" rx="2.1" ry="2.7" transform="rotate(24 18.8 11.2)" />
      <path d="M12.1 12.3c3.1 0 5.9 2.4 5.9 5.2 0 2.2-1.8 3.6-3.8 3.6-1 0-1.5-.3-2.1-.3s-1.1.3-2.1.3c-2 0-3.8-1.4-3.8-3.6 0-2.8 2.8-5.2 5.9-5.2Z" />
    </svg>
  )
}

export default function PawTrail({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`paw-trail inline-flex items-end gap-1 text-primary ${className}`}>
      {/* Las huellas alternan de altura, como las de un perro que camina. */}
      {[0, 1, 2, 3].map((step) => (
        <span key={step} className="block" style={{ transform: `translateY(${step % 2 === 0 ? 0 : size * 0.28}px)` }}>
          <Paw size={size} />
        </span>
      ))}
    </span>
  )
}
