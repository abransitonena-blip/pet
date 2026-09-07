'use client'

import { useState } from 'react'
import Link from 'next/link'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { PHOTO_CONSENT_VERSION, PRIVACY_REQUEST_TYPES, type PrivacyRequestType } from '@/lib/privacyConfig'
import { ShieldCheck, CheckCircle2 } from 'lucide-react'
import { Button, Card } from '@/components/ui'

export default function CustomerPrivacyPage() {
  const [requestType, setRequestType] = useState<PrivacyRequestType>('access')
  const [description, setDescription] = useState('')
  const [captureAllowed, setCaptureAllowed] = useState(false)
  const [publicGalleryAllowed, setPublicGalleryAllowed] = useState(false)
  const [socialMediaAllowed, setSocialMediaAllowed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [folio, setFolio] = useState('')
  const [error, setError] = useState('')

  const submitRequest = async () => {
    const user = auth.currentUser
    if (!user) { setError('Necesitas iniciar sesión para registrar la solicitud.'); return }
    setSubmitting(true)
    setError('')
    try {
      const isPhotoPreferences = requestType === 'photo-consent-update'
      const request = await addDoc(collection(db, 'privacyRequests'), {
        requestType,
        requesterUid: user.uid,
        channel: 'customer-portal',
        status: 'submitted',
        description: description.trim(),
        consentVersion: isPhotoPreferences ? PHOTO_CONSENT_VERSION : null,
        requestedPhotoConsent: isPhotoPreferences ? {
          captureAllowed,
          publicGalleryAllowed,
          socialMediaAllowed,
        } : null,
        createdAt: serverTimestamp(),
      })
      setFolio(request.id)
      setDescription('')
    } catch {
      setError('No pudimos registrar la solicitud. También puedes usar el correo indicado en el aviso de privacidad.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-6">
        <div className="flex items-center gap-3"><ShieldCheck className="text-primary" size={22} /><div><h1 className="text-lg font-semibold text-ink">Privacidad y solicitudes ARCO</h1><p className="text-sm text-muted">Proceso manual del MVP con folio de seguimiento.</p></div></div>
        <p className="mt-4 text-sm text-muted">No adjuntes identificaciones, contraseñas, datos financieros ni expedientes de salud. Si necesitamos verificar identidad, te contactaremos por un canal separado.</p>
      </Card>

      <Card className="p-6 space-y-4">
        <div><label htmlFor="request-type" className="block text-sm font-medium text-ink">Tipo de solicitud <span aria-hidden="true">*</span></label><select id="request-type" value={requestType} onChange={(event) => setRequestType(event.target.value as PrivacyRequestType)} className="input-field mt-1 min-h-11">{PRIVACY_REQUEST_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>

        {requestType === 'photo-consent-update' && <fieldset className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}><legend className="px-1 text-sm font-medium text-ink">Decisiones independientes y opcionales</legend><p className="mb-3 text-xs text-muted">Ninguna opción está premarcada. Autorizar captura privada no autoriza publicación.</p><div className="space-y-3">{[
          { label: 'Permito capturar fotos para mi reporte privado', checked: captureAllowed, set: setCaptureAllowed },
          { label: 'Permito publicar fotos autorizadas en la galería pública', checked: publicGalleryAllowed, set: setPublicGalleryAllowed },
          { label: 'Permito compartir fotos autorizadas en redes sociales', checked: socialMediaAllowed, set: setSocialMediaAllowed },
        ].map((item) => <label key={item.label} className="flex min-h-11 items-start gap-3 text-sm text-ink"><input type="checkbox" checked={item.checked} onChange={(event) => item.set(event.target.checked)} className="mt-1 h-5 w-5" /><span>{item.label}</span></label>)}</div></fieldset>}

        <div><label htmlFor="request-description" className="block text-sm font-medium text-ink">Descripción breve <span className="text-muted">(opcional)</span></label><textarea id="request-description" maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="input-field mt-1" placeholder="Describe qué información o acción necesitas, sin incluir datos sensibles innecesarios." /><p className="mt-1 text-xs text-muted">{description.length}/500</p></div>

        <p className="text-xs text-muted">Al enviar registras una solicitud, no una publicación automática. Administración verificará identidad, alcance y proveedores afectados. Consulta el <Link href="/privacidad" className="underline">aviso de privacidad</Link>.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {folio && <div role="status" className="rounded-xl bg-success/10 p-3 text-sm text-success"><CheckCircle2 className="mr-2 inline" size={16} />Solicitud registrada. Folio: <strong>{folio}</strong></div>}
        <Button type="button" onClick={submitRequest} isLoading={submitting}>{submitting ? 'Registrando…' : 'Registrar solicitud'}</Button>
      </Card>
    </div>
  )
}
