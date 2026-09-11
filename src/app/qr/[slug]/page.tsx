import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BRAND } from '@/lib/brand'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { isEmergencySlug } from '@/lib/emergencyProfile'
import QrPublicView from './QrPublicView'

/**
 * Página pública de la placa QR.
 *
 * The document is read in the browser, by id, with the web SDK: the rules
 * allow `get` on emergency-profiles and forbid `list`, so the slug itself is
 * the secret. Reading it here on the server would need privileged credentials
 * that only exist in production, and this page has to work wherever the QR is
 * scanned.
 *
 * Never indexed: the page exists for whoever has the printed tag in hand.
 */

export const metadata: Metadata = {
  title: `Mascota encontrada — ${BRAND.name}`,
  description: 'Perfil de emergencia de una mascota. Si la encontraste, aquí puedes avisar a su familia.',
  robots: { index: false, follow: false },
}

export default function QrSlugPage({ params }: { params: { slug: string } }) {
  if (!FEATURE_FLAGS.PET_EMERGENCY_QR_ENABLED || !isEmergencySlug(params.slug)) {
    notFound()
  }
  return <QrPublicView slug={params.slug} />
}
