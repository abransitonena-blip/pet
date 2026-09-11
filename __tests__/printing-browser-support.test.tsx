import fs from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { BluetoothSupportNotice } from '@/components/admin/BluetoothSupportNotice'
import { isWebBluetoothAvailable } from '@/lib/printing/transports'

const root = path.resolve(__dirname, '..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('impresión: qué navegador puede', () => {
  afterEach(() => {
    delete (navigator as Navigator & { bluetooth?: unknown }).bluetooth
  })

  test('sin Web Bluetooth el navegador no puede imprimir; con él, sí', () => {
    expect(isWebBluetoothAvailable()).toBe(false)
    Object.defineProperty(navigator, 'bluetooth', { value: {}, configurable: true })
    expect(isWebBluetoothAvailable()).toBe(true)
  })

  test('el aviso explica el caso de iPhone y Safari, y qué hacer mientras tanto', () => {
    const { unmount } = render(<BluetoothSupportNotice supported={false} />)
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('iPhone')
    expect(notice).toHaveTextContent('Chrome')
    expect(notice).toHaveTextContent('.bin')
    unmount()

    // Nothing to say when it works, or before the browser has been checked.
    expect(render(<BluetoothSupportNotice supported />).container).toBeEmptyDOMElement()
    expect(render(<BluetoothSupportNotice supported={null} />).container).toBeEmptyDOMElement()
  })

  test('las dos pantallas avisan y solo habilitan el botón cuando el navegador sí puede', () => {
    for (const file of ['src/components/admin/TicketPrintTool.tsx', 'src/components/admin/PrintingLab.tsx']) {
      const source = read(file)
      expect(source).toContain('const bluetoothSupported = useWebBluetoothSupport()')
      expect(source).toContain('<BluetoothSupportNotice supported={bluetoothSupported} />')
      expect(source).toContain('disabled={bluetoothSupported !== true}')
      // Reading navigator while rendering would break hydration.
      expect(source).not.toContain('disabled={!isWebBluetoothAvailable()}')
    }
  })
})
