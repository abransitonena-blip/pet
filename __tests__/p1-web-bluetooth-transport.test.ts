import { readFileSync } from 'node:fs'
import {
  BLE_CHUNK_BYTES,
  PRINTER_SERVICE_UUID,
  PRINTER_WRITE_CHARACTERISTIC_UUID,
  WebBluetoothTransport,
  chunkPayload,
  isWebBluetoothAvailable,
} from '@/lib/printing/transports'

describe('P1 Web Bluetooth transport', () => {
  test('targets the documented SUZWIP service and write characteristic', () => {
    expect(PRINTER_SERVICE_UUID).toBe(0xff00)
    expect(PRINTER_WRITE_CHARACTERISTIC_UUID).toBe(0xff02)
  })

  test('chunks a payload larger than one BLE write into ordered, complete pieces', () => {
    const payload = Uint8Array.from({ length: BLE_CHUNK_BYTES * 2 + 37 }, (_, i) => i % 256)
    const chunks = chunkPayload(payload)

    expect(chunks).toHaveLength(3)
    expect(chunks[0].byteLength).toBe(BLE_CHUNK_BYTES)
    expect(chunks[2].byteLength).toBe(37)
    expect(Buffer.concat(chunks.map((c) => Buffer.from(c)))).toEqual(Buffer.from(payload))
  })

  test('rejects an invalid chunk size instead of looping forever', () => {
    expect(() => chunkPayload(Uint8Array.of(1, 2, 3), 0)).toThrow('invalid-chunk-size')
  })

  test('fails closed when the browser has no Web Bluetooth (Safari, Firefox, insecure origin)', async () => {
    expect(isWebBluetoothAvailable()).toBe(false)
    const transport = new WebBluetoothTransport()
    await expect(transport.connect()).rejects.toThrow('web-bluetooth-unavailable')

    const status = await transport.getStatus()
    expect(status.state).toBe('failed')
    expect(status.bytesWritten).toBe(0)
  })

  test('refuses to write before a connection exists', async () => {
    const transport = new WebBluetoothTransport()
    await expect(transport.write(Uint8Array.of(1, 2, 3))).rejects.toThrow('printer-not-connected')
  })

  test('never reports a printed state -- FF02 is write-without-response, paper is confirmed by a human', () => {
    const source = readFileSync('src/lib/printing/transports.ts', 'utf8')
    expect(source).toContain('writeValueWithoutResponse')
    expect(source).not.toMatch(/state\s*=\s*'printed'/)
    expect(source).not.toMatch(/'printed'/)
  })
})
