import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BRAND } from '@/lib/brand'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { isShareToken } from '@/lib/locationShare'
import SeguimientoPublicView from './SeguimientoPublicView'

/**
 * Página pública de un enlace de ubicación temporal (fase 36).
 *
 * El documento vive en `walkShareLinks/{token}` y las reglas lo cierran por
 * completo (`allow read, write: if false`): a diferencia de la placa de
 * emergencia, aquí no basta con que el token sea el secreto -- lo que hay
 * detrás es la ubicación de una persona en tiempo real, así que la vista la
 * sirve /api/tracking/share/view con identidad privilegiada, nunca el SDK
 * web directo.
 *
 * Nunca indexada: existe para quien tiene el enlace, no para buscarla.
 */

export const metadata: Metadata = {
  title: `Paseo en curso — ${BRAND.name}`,
  description: 'Enlace temporal para ver por dónde va un paseo.',
  robots: { index: false, follow: false },
}

export default function SeguimientoTokenPage({ params }: { params: { token: string } }) {
  if (!FEATURE_FLAGS.LOCATION_SHARE_LINKS_ENABLED || !isShareToken(params.token)) {
    notFound()
  }
  return <SeguimientoPublicView token={params.token} />
}
