'use client'

import { useCallback, useEffect, useState } from 'react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { Check, Copy, Download, QrCode } from 'lucide-react'
import { auth } from '@/firebase/config'
import { db } from '@/firebase/db'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import {
  activateEmergencyProfile,
  deactivateEmergencyProfile,
  emergencyProfileUrl,
  generatePublicSlug,
} from '@/lib/emergencyProfile'

/**
 * Placa QR de emergencia, activada por la familia.
 *
 * Nothing is published until the owner turns it on, and what gets published is
 * only what they can see here: name, breed, size and type. Their phone travels
 * to the public document only while the second switch is on -- turning it off
 * rewrites the document without it, and turning the tag off deletes it.
 *
 * The address, the health record, the notes and the walks never leave the
 * family's own documents.
 */

interface EmergencyTagSectionProps {
  dogId: string
  petName: string
  breed: string
  size: string
  petType: string
}

interface TagState {
  enabled: boolean
  publicSlug: string
  showOwnerPhone: boolean
}

const IDLE: TagState = { enabled: false, publicSlug: '', showOwnerPhone: false }

export default function EmergencyTagSection(props: EmergencyTagSectionProps) {
  const { dogId, petName, breed, size, petType } = props
  const [tag, setTag] = useState<TagState>(IDLE)
  const [ownerPhone, setOwnerPhone] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!FEATURE_FLAGS.PET_EMERGENCY_QR_ENABLED) return
    let cancelled = false
    const uid = auth.currentUser?.uid
    Promise.all([
      getDoc(doc(db, 'dogs', dogId)),
      uid ? getDoc(doc(db, 'customerProfiles', uid)) : Promise.resolve(null),
    ])
      .then(([dogSnapshot, profileSnapshot]) => {
        if (cancelled) return
        const stored = dogSnapshot.data()?.emergencyProfile as Partial<TagState> | undefined
        setTag({
          enabled: stored?.enabled === true,
          publicSlug: typeof stored?.publicSlug === 'string' ? stored.publicSlug : '',
          showOwnerPhone: stored?.showOwnerPhone === true,
        })
        const phone = profileSnapshot?.data()?.phone
        setOwnerPhone(typeof phone === 'string' ? phone : '')
        setState('ready')
      })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [dogId])

  const publicUrl = tag.publicSlug ? emergencyProfileUrl(tag.publicSlug) : ''

  useEffect(() => {
    if (!tag.enabled || !publicUrl) {
      setQrDataUrl('')
      return
    }
    let cancelled = false
    void import('qrcode')
      .then((module) => module.default.toDataURL(publicUrl, { errorCorrectionLevel: 'M', margin: 2, width: 240 }))
      .then((url) => { if (!cancelled) setQrDataUrl(url) })
      .catch(() => { if (!cancelled) setQrDataUrl('') })
    return () => { cancelled = true }
  }, [tag.enabled, publicUrl])

  const persist = useCallback(async (next: TagState) => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    setState('saving')
    try {
      if (next.enabled) {
        await activateEmergencyProfile({
          publicSlug: next.publicSlug,
          ownerId: uid,
          ownerPhone,
          petName,
          breed,
          size: size as 'pequeño' | 'mediano' | 'grande',
          petType: petType as 'perro' | 'gato' | 'otro',
          showOwnerPhone: next.showOwnerPhone,
        })
      } else if (next.publicSlug) {
        await deactivateEmergencyProfile(next.publicSlug)
      }
      await updateDoc(doc(db, 'dogs', dogId), { emergencyProfile: next })
      setTag(next)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [breed, dogId, ownerPhone, petName, petType, size])

  const copyLink = async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const downloadQr = () => {
    if (!qrDataUrl) return
    const anchor = document.createElement('a')
    anchor.href = qrDataUrl
    anchor.download = `placa-${petName.toLowerCase().replace(/\s+/g, '-') || 'mascota'}.png`
    anchor.click()
  }

  if (!FEATURE_FLAGS.PET_EMERGENCY_QR_ENABLED) return null

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Placa QR de emergencia</h2>

      <div className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-4">
        <p className="text-sm text-muted">
          Imprime un QR para la placa de {petName || 'tu mascota'}. Quien lo escanee verá su nombre, raza y tamaño, y podrá
          avisarte. Tu dirección, su expediente de salud y sus paseos nunca se publican.
        </p>

        {state === 'error' && (
          <p role="alert" className="rounded-xl bg-danger-500/10 px-3 py-2 text-xs text-red-700">
            No pudimos guardar el cambio. Revisa tu conexión e inténtalo de nuevo.
          </p>
        )}

        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-ink">Placa activada</span>
          <input
            type="checkbox"
            checked={tag.enabled}
            disabled={state === 'loading' || state === 'saving'}
            onChange={(event) => void persist({
              ...tag,
              enabled: event.target.checked,
              publicSlug: tag.publicSlug || generatePublicSlug(),
            })}
            className="h-6 w-11 cursor-pointer"
            aria-label="Activar la placa QR de emergencia"
          />
        </label>

        {tag.enabled && (
          <>
            <label className="flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
              <span className="text-sm text-ink">
                Mostrar mi teléfono
                <span className="block text-xs text-muted">
                  {ownerPhone
                    ? `Quien escanee podrá llamarte al ${ownerPhone}. Si lo dejas apagado, el contacto pasa por PET Ap.`
                    : 'Agrega tu teléfono en tu cuenta para poder activarlo.'}
                </span>
              </span>
              <input
                type="checkbox"
                checked={tag.showOwnerPhone}
                disabled={!ownerPhone || state === 'saving'}
                onChange={(event) => void persist({ ...tag, showOwnerPhone: event.target.checked })}
                className="h-6 w-11 cursor-pointer"
                aria-label="Mostrar mi teléfono en la placa"
              />
            </label>

            <div className="flex flex-col items-center gap-3 border-t border-ink/10 pt-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`Código QR de la placa de ${petName}`} className="h-40 w-40" />
              ) : (
                <div className="grid h-40 w-40 place-items-center rounded-xl bg-ink/[0.04] text-muted">
                  <QrCode size={24} aria-hidden="true" />
                </div>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-ink/10 px-3 text-xs font-medium text-ink"
                >
                  {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {copied ? 'Enlace copiado' : 'Copiar enlace'}
                </button>
                <button
                  type="button"
                  onClick={downloadQr}
                  disabled={!qrDataUrl}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-ink/10 px-3 text-xs font-medium text-ink disabled:opacity-40"
                >
                  <Download size={14} aria-hidden="true" /> Descargar el QR
                </button>
              </div>
              {publicUrl && <p className="break-all text-center text-2xs text-muted">{publicUrl}</p>}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
