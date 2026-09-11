'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { FlaskConical, Printer, Clipboard, Check, Download } from 'lucide-react'
import { Button, ErrorState, LoadingState } from '@/components/ui'
import { ROLES } from '@/lib/roles'
import { useSessionRole } from '@/lib/useSessionRole'
import { EscPosEncoder, PET_AP_58MM_PROFILE, createPetApDogLogo, type RasterImage } from '@/lib/printing/escpos'
import { WebBluetoothTransport, bytesToHex } from '@/lib/printing/transports'
import { BluetoothSupportNotice } from '@/components/admin/BluetoothSupportNotice'
import { useWebBluetoothSupport } from '@/lib/useWebBluetoothSupport'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

const MAX_LOGO_WIDTH = PET_AP_58MM_PROFILE.dotsPerLine

function wrap(value: string, columns = PET_AP_58MM_PROFILE.columns): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (word.length > columns) {
      if (current) lines.push(current)
      for (let index = 0; index < word.length; index += columns) lines.push(word.slice(index, index + columns))
      current = ''
    } else if (!current) current = word
    else if (`${current} ${word}`.length <= columns) current = `${current} ${word}`
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function imageToRaster(image: HTMLImageElement, maxWidth: number): RasterImage {
  const scale = Math.min(1, maxWidth / image.width)
  const width = Math.max(8, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas-unavailable')
  context.drawImage(image, 0, 0, width, height)
  const pixels = context.getImageData(0, 0, width, height).data
  const widthBytes = Math.ceil(width / 8)
  const data = new Uint8Array(widthBytes * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const luminance = 0.3 * pixels[offset] + 0.59 * pixels[offset + 1] + 0.11 * pixels[offset + 2]
      if (luminance < 128) data[y * widthBytes + (x >> 3)] |= 1 << (7 - (x & 7))
    }
  }
  return { width, height, data }
}

interface LabFields {
  negocio: string
  titulo: string
  detalles: string
  pago: string
  verifica: string
  reporte: string
  avisoBold: string
  aviso: string
  gracias: string
  qr: string
}

function buildLabTicket(fields: LabFields, logo: RasterImage | null): Uint8Array {
  const encoder = new EscPosEncoder().initialize().selectCp850()
  if (logo) encoder.align('center').raster(logo).line()
  encoder.align('center').bold(true).size(2, 2).line(fields.negocio || 'PET Ap').size(1, 1)
  if (fields.titulo) encoder.line(fields.titulo)
  encoder.bold(false).line('-'.repeat(PET_AP_58MM_PROFILE.columns)).align('left')

  fields.detalles.split('\n').map((line) => line.replace(/\r$/, '')).forEach((line) => {
    if (line.trim()) wrap(line).forEach((piece) => encoder.line(piece))
    else encoder.line()
  })

  if (fields.pago) {
    encoder.line().line(`Pago: ${fields.pago}`).line()
  }
  encoder.line('-'.repeat(PET_AP_58MM_PROFILE.columns)).line()

  encoder.align('center')
  if (fields.reporte) encoder.line(fields.reporte).line()
  if (fields.qr.trim()) encoder.qr(fields.qr.trim()).line()
  if (fields.verifica) encoder.line(`Verif: ${fields.verifica}`)
  if (fields.avisoBold) { encoder.bold(true); wrap(fields.avisoBold).forEach((piece) => encoder.line(piece)); encoder.bold(false) }
  if (fields.aviso) wrap(fields.aviso).forEach((piece) => encoder.line(piece))
  encoder.line()
  if (fields.gracias) encoder.line(fields.gracias)
  encoder.feed(4).reset()
  return encoder.encode()
}

const DEFAULT_FIELDS: LabFields = {
  negocio: 'PET Ap',
  titulo: 'PRUEBA DE IMPRESIÓN',
  detalles: 'Línea de prueba 1\nLínea de prueba 2',
  pago: '',
  verifica: '',
  reporte: '',
  avisoBold: 'LABORATORIO - NO ES UN TICKET REAL',
  aviso: '',
  gracias: '¡Gracias por confiar en PET Ap!',
  qr: '',
}

export default function PrintingLab() {
  const session = useSessionRole([ROLES.ADMIN])
  const [fields, setFields] = useState<LabFields>(DEFAULT_FIELDS)
  const [useLogo, setUseLogo] = useState(true)
  const [customLogo, setCustomLogo] = useState<RasterImage | null>(null)
  const [logoMessage, setLogoMessage] = useState('')
  const [payload, setPayload] = useState<Uint8Array | null>(null)
  const [copied, setCopied] = useState(false)
  const [bluetoothSending, setBluetoothSending] = useState(false)
  const [bluetoothMessage, setBluetoothMessage] = useState('')
  const bluetoothSupported = useWebBluetoothSupport()
  const fileInput = useRef<HTMLInputElement>(null)

  const setField = useCallback(<K extends keyof LabFields>(key: K, value: LabFields[K]) => {
    setFields((current) => ({ ...current, [key]: value }))
  }, [])

  const logo = useLogo ? (customLogo ?? createPetApDogLogo()) : null

  const preview = useMemo(() => {
    const lines: string[] = []
    lines.push(fields.negocio || 'PET Ap')
    if (fields.titulo) lines.push(fields.titulo)
    lines.push('-'.repeat(PET_AP_58MM_PROFILE.columns))
    fields.detalles.split('\n').forEach((line) => lines.push(line))
    if (fields.pago) lines.push('', `Pago: ${fields.pago}`)
    lines.push('', '-'.repeat(PET_AP_58MM_PROFILE.columns))
    if (fields.reporte) lines.push('', fields.reporte)
    if (fields.qr.trim()) lines.push('', '[QR]')
    if (fields.verifica) lines.push('', `Verif: ${fields.verifica}`)
    if (fields.avisoBold) lines.push(fields.avisoBold)
    if (fields.aviso) lines.push(fields.aviso)
    if (fields.gracias) lines.push('', fields.gracias)
    return lines.join('\n')
  }, [fields])

  const generate = useCallback(() => {
    try {
      const bytes = buildLabTicket(fields, logo)
      setPayload(bytes)
      setCopied(false)
      setBluetoothMessage('')
    } catch {
      setPayload(null)
    }
  }, [fields, logo])

  const hex = payload ? bytesToHex(payload) : ''

  const copyHex = useCallback(async () => {
    if (!hex) return
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }, [hex])

  const downloadBinary = useCallback(() => {
    if (!payload) return
    const blob = new Blob([Uint8Array.from(payload)], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'ticket-lab.bin'
    anchor.click()
    URL.revokeObjectURL(url)
  }, [payload])

  const sendOverBluetooth = useCallback(async () => {
    if (!FEATURE_FLAGS.BLUETOOTH_PRINTING_ENABLED || !payload || payload.byteLength === 0) return
    setBluetoothSending(true)
    setBluetoothMessage('')
    const transport = new WebBluetoothTransport()
    try {
      await transport.connect()
      await transport.write(payload)
      const status = await transport.getStatus()
      setBluetoothMessage(status.message ?? 'Payload enviado. Confirma el papel impreso.')
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      setBluetoothMessage(code === 'web-bluetooth-unavailable'
        ? 'Este navegador no permite Bluetooth. Usa Chrome o Edge, o copia el HEX.'
        : 'No pudimos enviar a la impresora. Revisa el emparejamiento e inténtalo otra vez.')
    } finally {
      await transport.disconnect().catch(() => {})
      setBluetoothSending(false)
    }
  }, [payload])

  const onLogoFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const image = new Image()
    image.onload = () => {
      try {
        const raster = imageToRaster(image, MAX_LOGO_WIDTH)
        setCustomLogo(raster)
        setUseLogo(true)
        setLogoMessage(`Logo cargado: ${raster.width}×${raster.height} px`)
      } catch {
        setLogoMessage('No pudimos procesar esa imagen.')
      }
      URL.revokeObjectURL(image.src)
    }
    image.onerror = () => setLogoMessage('No pudimos leer esa imagen.')
    image.src = URL.createObjectURL(file)
  }, [])

  const clearCustomLogo = useCallback(() => {
    setCustomLogo(null)
    setLogoMessage('')
    if (fileInput.current) fileInput.current.value = ''
  }, [])

  if (session.status === 'loading') return <LoadingState message="Verificando acceso administrativo…" rows={3} />
  if (session.status !== 'ready') {
    return <ErrorState title="Acceso exclusivo de Admin" description="Esta herramienta requiere un custom claim admin explícito." onRetry={() => void session.refresh()} />
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 overflow-x-hidden">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Herramienta interna</p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Laboratorio de impresión ESC/POS</h1>
        <p className="max-w-3xl text-sm text-muted">
          Compón un ticket de prueba con texto libre para verificar la impresora física (58 mm · 384 dots · CP850).
          No usa datos de clientes ni sesiones reales, no crea tickets internos ni movimientos. Para reimprimir un
          ticket real, usa <span className="font-semibold text-ink">Prueba de impresión</span>.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <section className="min-w-0 space-y-4 rounded-2xl border border-ink/10 bg-surface p-4 sm:p-5" aria-label="Campos del ticket de prueba">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-ink">Negocio (encabezado)
              <input value={fields.negocio} onChange={(event) => setField('negocio', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" />
            </label>
            <label className="block text-xs font-semibold text-ink">Título de estado
              <input value={fields.titulo} onChange={(event) => setField('titulo', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" />
            </label>
          </div>

          <label className="block text-xs font-semibold text-ink">Detalles (una línea por renglón)
            <textarea value={fields.detalles} onChange={(event) => setField('detalles', event.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-border bg-canvas p-3 font-mono text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-ink">Pago
              <input value={fields.pago} onChange={(event) => setField('pago', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" />
            </label>
            <label className="block text-xs font-semibold text-ink">Verificación
              <input value={fields.verifica} onChange={(event) => setField('verifica', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" />
            </label>
            <label className="block text-xs font-semibold text-ink">Reporte
              <input value={fields.reporte} onChange={(event) => setField('reporte', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" />
            </label>
            <label className="block text-xs font-semibold text-ink">Texto QR (opcional)
              <input value={fields.qr} onChange={(event) => setField('qr', event.target.value)} placeholder="https://…" className="mt-1 min-h-11 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" />
            </label>
          </div>

          <label className="block text-xs font-semibold text-ink">Aviso (negrita)
            <input value={fields.avisoBold} onChange={(event) => setField('avisoBold', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" />
          </label>
          <label className="block text-xs font-semibold text-ink">Aviso secundario
            <input value={fields.aviso} onChange={(event) => setField('aviso', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" />
          </label>
          <label className="block text-xs font-semibold text-ink">Despedida
            <input value={fields.gracias} onChange={(event) => setField('gracias', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" />
          </label>

          <div className="space-y-2 rounded-xl border border-ink/10 p-3">
            <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
              <input type="checkbox" checked={useLogo} onChange={(event) => setUseLogo(event.target.checked)} className="h-5 w-5 accent-primary" />
              Imprimir logo ({customLogo ? 'personalizado' : 'marca PET Ap'})
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogoFile} aria-label="Subir logo personalizado" className="block min-h-11 flex-1 rounded-lg border border-border bg-canvas p-2 text-xs text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:font-semibold file:text-primary" />
              {customLogo && <Button type="button" size="sm" variant="secondary" onClick={clearCustomLogo}>Quitar logo</Button>}
            </div>
            {logoMessage && <p role="status" className="text-xs text-muted">{logoMessage}</p>}
          </div>

          <p className="text-xs text-muted">
            Perfil fijo: 58 mm · 32 columnas · CP850 (único impresora validada). El corte automático y el cajón de
            dinero no están disponibles en este hardware.
          </p>

          <div className="flex flex-wrap gap-2 border-t border-ink/10 pt-4">
            <Button type="button" onClick={generate} leftIcon={<FlaskConical className="h-4 w-4" aria-hidden="true" />}>Generar ESC/POS</Button>
          </div>
        </section>

        <aside className="space-y-4">
          {/* The ticket is 32 columns wide, so size the paper by characters
              rather than by the printer's 384 dots: at 12px monospace those
              dots rendered a strip far wider than the text it holds, which is
              what made the preview look oversized on a phone. */}
          <div className="mx-auto w-fit max-w-full overflow-x-auto rounded-sm bg-white px-3 py-4 font-mono text-[11px] leading-snug text-black shadow-[0_14px_40px_rgba(15,23,42,0.14)]">
            <pre className="w-[32ch] whitespace-pre-wrap break-words">{preview}</pre>
          </div>

          {payload && (
            <div className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <span className="rounded-full bg-ink/5 px-3 py-1.5">{payload.byteLength.toLocaleString('es-MX')} bytes</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => void copyHex()} leftIcon={copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Clipboard className="h-4 w-4" aria-hidden="true" />}>{copied ? 'HEX copiado' : 'Copiar HEX'}</Button>
                <Button type="button" variant="secondary" onClick={downloadBinary} leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}>Descargar .bin</Button>
                {FEATURE_FLAGS.BLUETOOTH_PRINTING_ENABLED && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void sendOverBluetooth()}
                    isLoading={bluetoothSending}
                    disabled={bluetoothSupported !== true}
                    title={bluetoothSupported === true ? undefined : 'Este navegador no permite Bluetooth'}
                    leftIcon={<Printer className="h-4 w-4" aria-hidden="true" />}
                  >
                    Enviar por Bluetooth
                  </Button>
                )}
              </div>
              <BluetoothSupportNotice supported={bluetoothSupported} />
              {bluetoothMessage && <p role="status" className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-ink">{bluetoothMessage}</p>}
              <details className="rounded-xl border border-ink/10 p-3">
                <summary className="min-h-11 cursor-pointer select-none py-2 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">HEX continuo</summary>
                <textarea readOnly value={hex} rows={8} className="mt-2 w-full resize-y break-all rounded-lg border border-border bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" />
              </details>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
