'use client'

import { useEffect, useState } from 'react'
import { CloudOff } from 'lucide-react'

/**
 * Decir cuándo no hay señal.
 *
 * Desde que la caché de Firestore vive en el disco, un panel sin internet se ve
 * exactamente igual que uno con internet: los datos de hace una hora se ven como
 * los de ahora, y lo que alguien escribe se queda esperando sin decirlo. Eso es
 * peor que un error: un paseador puede creer que su nota ya salió.
 *
 * Esta franja aparece sólo mientras el navegador dice que no hay conexión, y
 * explica las dos cosas que importan: lo que se ve puede estar viejo, y lo que
 * se escriba va a salir solo cuando vuelva la red.
 *
 * `navigator.onLine` no es perfecto -- dice "sí" en una red que no llega a
 * ningún lado --, pero cuando dice "no", no hay duda. Por eso sólo se muestra
 * en ese caso, y nunca al revés.
 */
export default function OfflineNotice() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!offline) return null

  return (
    <p
      role="status"
      className="flex items-start gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-amber-900"
    >
      <CloudOff size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        Sin conexión. Lo que ves puede estar desactualizado, y lo que anotes se guardará en este
        teléfono y saldrá solo cuando vuelva la señal.
      </span>
    </p>
  )
}
