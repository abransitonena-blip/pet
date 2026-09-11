import Link from 'next/link'
import { PawPrint } from 'lucide-react'
import { BRAND } from '@/lib/brand'

/**
 * La placa, cuando no hay nada que mostrar.
 *
 * Vive dentro del propio segmento para que la ruta tenga su pantalla: quien
 * escanea una placa vieja, o un código que ya no existe, tiene que leer una
 * explicación y una salida, no quedarse frente a una página en blanco.
 */
export default function QrNotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <PawPrint size={32} className="text-muted" aria-hidden="true" />
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-ink">Esta placa no está disponible</h1>
        <p className="text-sm text-muted">
          El código no existe, la familia desactivó el perfil, o las placas todavía no están en uso.
          Si encontraste a una mascota, escríbenos y te ayudamos a localizar a su familia.
        </p>
      </div>
      <a
        href={`https://wa.me/${BRAND.whatsapp}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center rounded-xl bg-success-500/10 px-4 text-sm font-semibold text-success-600"
      >
        Escribir a {BRAND.name} por WhatsApp
      </a>
      <Link href="/" className="text-xs font-medium text-muted underline underline-offset-2">
        Ir al inicio
      </Link>
    </main>
  )
}
