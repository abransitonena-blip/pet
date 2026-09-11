'use client'

import { useEffect, useState } from 'react'
import { isWebBluetoothAvailable } from '@/lib/printing/transports'

/**
 * Si este navegador puede hablar con la impresora.
 *
 * Web Bluetooth only exists in Chromium browsers (Chrome or Edge, on Android
 * or a computer). Safari and Firefox never implement it, so from an iPhone the
 * printer cannot be reached at all.
 *
 * The check runs after mount: there is no `navigator` on the server, so
 * reading it while rendering would make the button disagree with itself on
 * hydration. `null` means "not checked yet", and callers keep the button
 * disabled until support is confirmed.
 */
export function useWebBluetoothSupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null)
  useEffect(() => { setSupported(isWebBluetoothAvailable()) }, [])
  return supported
}
