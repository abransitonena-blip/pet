'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { AlertTriangle, Download, PawPrint, Phone } from 'lucide-react'
import { db } from '@/firebase/config'
import { BRAND } from '@/lib/brand'
import { EMERGENCY_PROFILES_COLLECTION, type PublicEmergencyProfile } from '@/lib/emergencyProfile'
import { WhatsAppIcon } from '@/components/ui/SocialIcons'

/**
 * Lo que ve quien escanea la placa.
 *
 * Solo se muestra lo que el documento espejo trae, y ese documento solo lleva
 * lo que el dueño aceptó publicar. Si no activó su teléfono, el contacto pasa
 * por el WhatsApp de PET Ap, que ya conoce a la familia.
 */

const SIZE_LABELS: Record<string, string> = {
  'pequeño': 'Pequeño (menos de 10 kg)',
  pequeno: 'Pequeño (menos de 10 kg)',
  mediano: 'Mediano (10 a 25 kg)',
  grande: 'Grande (más de 25 kg)',
}

const TYPE_EMOJI: Record<string, string> = { perro: '🐕', gato: '🐈', otro: '🐾' }

type ViewState = 'loading' | 'ready' | 'not-found' | 'error'

function useEmergencyProfile(slug: string) {
  const [profile, setProfile] = useState<PublicEmergencyProfile | null>(null)
  const [state, setState] = useState<ViewState>('loading')

  useEffect(() => {
    let cancelled = false
    getDoc(doc(db, EMERGENCY_PROFILES_COLLECTION, slug))
      .then((snapshot) => {
        if (cancelled) return
        if (!snapshot.exists()) {
          setState('not-found')
          return
        }
        const data = snapshot.data()
        const showPhone = data.showPhone === true
        setProfile({
          petName: typeof data.petName === 'string' ? data.petName : '',
          breed: typeof data.breed === 'string' ? data.breed : '',
          size: typeof data.size === 'string' ? data.size : '',
          petType: typeof data.petType === 'string' ? data.petType : 'perro',
          photoUrl: typeof data.photoUrl === 'string' && data.photoUrl ? data.photoUrl : undefined,
          showPhone,
          ownerPhone: showPhone && typeof data.ownerPhone === 'string' ? data.ownerPhone : undefined,
        })
        setState('ready')
      })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [slug])

  return { profile, state }
}

function useQrImage(text: string) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    if (!text) return
    let cancelled = false
    void import('qrcode')
      .then((module) => module.default.toDataURL(text, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 240,
        color: { dark: '#172033', light: '#FFF8F1' },
      }))
      .then((url) => { if (!cancelled) setDataUrl(url) })
      .catch(() => { if (!cancelled) setDataUrl('') })
    return () => { cancelled = true }
  }, [text])

  return dataUrl
}

export default function QrPublicView({ slug }: { slug: string }) {
  const { profile, state } = useEmergencyProfile(slug)
  const [pageUrl, setPageUrl] = useState('')
  const qrDataUrl = useQrImage(pageUrl)

  useEffect(() => { setPageUrl(window.location.href) }, [])

  const download = () => {
    if (!qrDataUrl || !profile) return
    const anchor = document.createElement('a')
    anchor.href = qrDataUrl
    anchor.download = `qr-${profile.petName.toLowerCase().replace(/\s+/g, '-') || 'mascota'}.png`
    anchor.click()
  }

  if (state === 'loading') {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4">
        <p className="text-sm text-muted">Consultando la placa…</p>
      </main>
    )
  }

  if (state !== 'ready' || !profile) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <PawPrint size={28} className="text-muted" aria-hidden="true" />
        <h1 className="text-lg font-bold text-ink">Esta placa no está activa</h1>
        <p className="text-sm text-muted">
          {state === 'error'
            ? 'No pudimos consultarla en este momento. Revisa tu conexión e inténtalo de nuevo.'
            : 'La familia desactivó este perfil o el código ya no existe.'}
        </p>
        <a
          href={`https://wa.me/${BRAND.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-success-500/10 px-4 text-sm font-semibold text-success-600"
        >
          <WhatsAppIcon width={14} height={14} /> Escribir a {BRAND.name}
        </a>
      </main>
    )
  }

  const emoji = TYPE_EMOJI[profile.petType] ?? '🐾'
  const details = [profile.breed, SIZE_LABELS[profile.size] ?? profile.size].filter(Boolean).join(' · ')

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-12 pt-6">
      <div className="flex items-center justify-center gap-2 text-muted">
        <PawPrint size={18} aria-hidden="true" />
        <span className="text-sm font-semibold">{BRAND.name}</span>
      </div>

      <p role="status" className="flex items-start gap-2 rounded-2xl bg-warning/10 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span><strong>¿Encontraste a esta mascota?</strong> Desde aquí puedes avisar a su familia.</span>
      </p>

      <section className="rounded-2xl border border-ink/10 bg-surface p-5 shadow-sm">
        {profile.photoUrl && (
          <img
            src={profile.photoUrl}
            alt={profile.petName}
            className="mb-4 h-48 w-full rounded-xl object-cover"
          />
        )}
        <h1 className="text-2xl font-bold leading-tight text-ink">{emoji} {profile.petName || 'Mascota'}</h1>
        {details && <p className="mt-1 text-sm text-muted">{details}</p>}

        {profile.showPhone && profile.ownerPhone ? (
          <a
            href={`tel:${profile.ownerPhone.replace(/[^\d+]/g, '')}`}
            className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-bold text-white"
          >
            <Phone size={18} aria-hidden="true" /> Llamar a la familia
          </a>
        ) : (
          <a
            href={`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(`¡Hola! Encontré a ${profile.petName || 'una mascota'} y quiero ayudar a que regrese a casa.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-success-500 px-4 text-base font-bold text-white"
          >
            <WhatsAppIcon width={18} height={18} /> Avisar por WhatsApp a {BRAND.name}
          </a>
        )}

        <p className="mt-3 text-center text-xs text-muted">
          {profile.showPhone && profile.ownerPhone
            ? 'La familia activó su teléfono en esta placa.'
            : `La familia prefiere que el contacto pase por ${BRAND.name}.`}
        </p>
      </section>

      {qrDataUrl && (
        <section className="rounded-2xl border border-ink/10 bg-surface p-4 text-center">
          <p className="mb-3 text-xs text-muted">Código QR de esta placa</p>
          <img src={qrDataUrl} alt="Código QR de la placa" className="mx-auto h-44 w-44" />
          <button
            type="button"
            onClick={download}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-ink/10 px-4 text-sm font-medium text-ink"
          >
            <Download size={14} aria-hidden="true" /> Descargar el QR
          </button>
        </section>
      )}
    </main>
  )
}
