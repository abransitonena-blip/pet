export type PrinterConnectionState = 'disconnected' | 'connected' | 'ready' | 'failed'

export interface PrinterStatus {
  readonly state: PrinterConnectionState
  readonly bytesWritten: number
  readonly message: string | null
}

export interface PrinterTransport {
  connect(): Promise<void>
  disconnect(): Promise<void>
  write(data: Uint8Array): Promise<void>
  getStatus(): Promise<PrinterStatus>
}

export function bytesToHex(data: Uint8Array): string {
  return Array.from(data, (value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export class MockPrinterTransport implements PrinterTransport {
  private state: PrinterConnectionState = 'disconnected'
  private bytesWritten = 0
  private readonly payloads: Uint8Array[] = []

  async connect(): Promise<void> {
    this.state = 'connected'
  }

  async disconnect(): Promise<void> {
    this.state = 'disconnected'
  }

  async write(data: Uint8Array): Promise<void> {
    if (this.state !== 'connected' && this.state !== 'ready') throw new Error('printer-not-connected')
    const copy = Uint8Array.from(data)
    this.payloads.push(copy)
    this.bytesWritten += copy.byteLength
    this.state = 'ready'
  }

  async getStatus(): Promise<PrinterStatus> {
    return Object.freeze({ state: this.state, bytesWritten: this.bytesWritten, message: null })
  }

  getWrites(): readonly Uint8Array[] {
    return Object.freeze(this.payloads.map((payload) => Uint8Array.from(payload)))
  }
}

export class ManualHexTransport implements PrinterTransport {
  private state: PrinterConnectionState = 'disconnected'
  private bytesWritten = 0
  private hex = ''

  async connect(): Promise<void> {
    this.state = 'connected'
  }

  async disconnect(): Promise<void> {
    this.state = 'disconnected'
  }

  async write(data: Uint8Array): Promise<void> {
    if (this.state !== 'connected' && this.state !== 'ready') throw new Error('printer-not-connected')
    this.hex = bytesToHex(data)
    this.bytesWritten = data.byteLength
    this.state = 'ready'
  }

  async getStatus(): Promise<PrinterStatus> {
    return Object.freeze({ state: this.state, bytesWritten: this.bytesWritten, message: null })
  }

  getHex(): string {
    return this.hex
  }
}

/**
 * Minimal Web Bluetooth surface. The standard TS DOM lib does not ship these
 * types, and pulling @types/web-bluetooth for four members is not worth a
 * dependency. Only what this transport actually calls is declared.
 */
interface BluetoothRemoteCharacteristic {
  writeValueWithoutResponse(value: Uint8Array): Promise<void>
}

interface BluetoothRemoteService {
  getCharacteristic(characteristic: number | string): Promise<BluetoothRemoteCharacteristic>
}

interface BluetoothRemoteServer {
  connected: boolean
  connect(): Promise<BluetoothRemoteServer>
  disconnect(): void
  getPrimaryService(service: number | string): Promise<BluetoothRemoteService>
}

interface BluetoothDeviceLike {
  name?: string
  gatt?: BluetoothRemoteServer
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void
}

interface BluetoothLike {
  requestDevice(options: { filters: { services: (number | string)[] }[] }): Promise<BluetoothDeviceLike>
}

/** SUZWIP 58 mm: BLE service FF00, write characteristic FF02 (write without response). */
export const PRINTER_SERVICE_UUID = 0xff00
export const PRINTER_WRITE_CHARACTERISTIC_UUID = 0xff02

/** BLE writes are capped well below one ESC/POS payload, so chunk conservatively. */
export const BLE_CHUNK_BYTES = 180
const CHUNK_PAUSE_MS = 20

function getBluetooth(): BluetoothLike | null {
  if (typeof navigator === 'undefined') return null
  const candidate = (navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth
  return candidate ?? null
}

export function isWebBluetoothAvailable(): boolean {
  return getBluetooth() !== null
}

export function chunkPayload(data: Uint8Array, size = BLE_CHUNK_BYTES): Uint8Array[] {
  if (size <= 0) throw new Error('invalid-chunk-size')
  const chunks: Uint8Array[] = []
  for (let offset = 0; offset < data.byteLength; offset += size) {
    chunks.push(data.slice(offset, Math.min(offset + size, data.byteLength)))
  }
  return chunks
}

/**
 * Real BLE transport for the SUZWIP 58 mm printer.
 *
 * Deliberately never reports a `printed` state: FF02 is write-without-response,
 * so a successful write proves bytes left the browser, not that paper came out.
 * That is why the ticket event model has `payload_exported` / `operator_confirmed`
 * / `failed` and no `printed` -- a human still confirms the paper.
 *
 * connect() must be called from a user gesture (browser requirement) and only
 * works on a secure origin in Chromium-based browsers; Safari and Firefox do not
 * implement Web Bluetooth, where this fails closed with `web-bluetooth-unavailable`.
 */
export class WebBluetoothTransport implements PrinterTransport {
  private state: PrinterConnectionState = 'disconnected'
  private bytesWritten = 0
  private message: string | null = null
  private device: BluetoothDeviceLike | null = null
  private characteristic: BluetoothRemoteCharacteristic | null = null

  async connect(): Promise<void> {
    const bluetooth = getBluetooth()
    if (!bluetooth) {
      this.state = 'failed'
      this.message = 'Este navegador no permite Bluetooth. Usa Chrome o Edge en Android o escritorio.'
      throw new Error('web-bluetooth-unavailable')
    }
    try {
      const device = await bluetooth.requestDevice({ filters: [{ services: [PRINTER_SERVICE_UUID] }] })
      const server = await device.gatt?.connect()
      if (!server) throw new Error('printer-gatt-unavailable')
      const service = await server.getPrimaryService(PRINTER_SERVICE_UUID)
      this.characteristic = await service.getCharacteristic(PRINTER_WRITE_CHARACTERISTIC_UUID)
      device.addEventListener('gattserverdisconnected', () => {
        this.state = 'disconnected'
        this.characteristic = null
        this.message = 'La impresora se desconectó.'
      })
      this.device = device
      this.state = 'connected'
      this.message = device.name ? `Conectada a ${device.name}` : 'Impresora conectada'
    } catch (cause) {
      this.state = 'failed'
      this.characteristic = null
      const reason = cause instanceof Error ? cause.message : ''
      this.message = reason === 'printer-gatt-unavailable'
        ? 'No pudimos abrir el canal GATT de la impresora.'
        : 'No se completó el emparejamiento con la impresora.'
      throw cause instanceof Error ? cause : new Error('printer-connect-failed')
    }
  }

  async disconnect(): Promise<void> {
    this.device?.gatt?.disconnect()
    this.device = null
    this.characteristic = null
    this.state = 'disconnected'
    this.message = null
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.characteristic || (this.state !== 'connected' && this.state !== 'ready')) {
      throw new Error('printer-not-connected')
    }
    let sent = 0
    for (const chunk of chunkPayload(data)) {
      await this.characteristic.writeValueWithoutResponse(chunk)
      sent += chunk.byteLength
      if (CHUNK_PAUSE_MS > 0) await new Promise((resolve) => setTimeout(resolve, CHUNK_PAUSE_MS))
    }
    this.bytesWritten += sent
    this.state = 'ready'
    this.message = `${sent} bytes enviados. Confirma manualmente el papel impreso.`
  }

  async getStatus(): Promise<PrinterStatus> {
    return Object.freeze({ state: this.state, bytesWritten: this.bytesWritten, message: this.message })
  }
}
