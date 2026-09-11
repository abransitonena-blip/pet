'use client'

import { FEATURE_FLAGS } from '@/lib/featureFlags'

/**
 * Aviso cuando el navegador no puede imprimir por Bluetooth.
 *
 * Before this, the print button was simply disabled with a `title` tooltip --
 * invisible on a touch screen, so on an iPhone the page looked broken instead
 * of explaining that Safari has no Web Bluetooth at all. Support is detected
 * after mount (see useWebBluetoothSupport); `null` means not checked yet, and
 * an unchecked browser says nothing rather than guessing.
 */
export function BluetoothSupportNotice({ supported }: { supported: boolean | null }) {
  if (!FEATURE_FLAGS.BLUETOOTH_PRINTING_ENABLED || supported !== false) return null
  return (
    <p role="status" className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-900">
      Este navegador no puede imprimir por Bluetooth: en iPhone y en Safari esa función no existe.
      Abre esta página en Chrome o Edge, en Android o en computadora, para enviar el ticket a la impresora.
      Mientras tanto puedes copiar el HEX o descargar el .bin.
    </p>
  )
}
