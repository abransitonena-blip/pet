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
