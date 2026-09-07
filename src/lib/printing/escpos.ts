import { encodeCp850 } from './cp850'
import {
  PET_AP_TICKET_DOG_RASTER_HEIGHT,
  PET_AP_TICKET_DOG_RASTER_WIDTH,
  petApTicketDogRasterData,
} from './ticketDogRaster.generated'

export const PET_AP_58MM_PROFILE = Object.freeze({
  paperWidthMm: 58,
  dotsPerLine: 384,
  dpi: 203,
  columns: 32,
  codePage: 'CP850' as const,
  codePageNumber: 2,
  supportsCut: false,
})

export interface RasterImage {
  readonly width: number
  readonly height: number
  readonly data: Uint8Array
}

function byte(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 255) throw new Error('invalid-escpos-byte')
  return value
}

function encodeUtf8(value: string): Uint8Array {
  const output: number[] = []
  Array.from(value).forEach((character) => {
    const code = character.codePointAt(0) ?? 0xfffd
    if (code <= 0x7f) output.push(code)
    else if (code <= 0x7ff) output.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    else if (code <= 0xffff) output.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    else output.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
  })
  return Uint8Array.from(output)
}

export class EscPosEncoder {
  private readonly output: number[] = []

  raw(...values: number[]): this {
    this.output.push(...values.map(byte))
    return this
  }

  initialize(): this {
    return this.raw(0x1b, 0x40)
  }

  selectCp850(): this {
    return this.raw(0x1b, 0x74, PET_AP_58MM_PROFILE.codePageNumber)
  }

  align(alignment: 'left' | 'center' | 'right'): this {
    const value = alignment === 'left' ? 0 : alignment === 'center' ? 1 : 2
    return this.raw(0x1b, 0x61, value)
  }

  bold(enabled: boolean): this {
    return this.raw(0x1b, 0x45, enabled ? 1 : 0)
  }

  size(width: 1 | 2, height: 1 | 2): this {
    return this.raw(0x1d, 0x21, ((width - 1) << 4) | (height - 1))
  }

  text(value: string): this {
    this.output.push(...Array.from(encodeCp850(value)))
    return this
  }

  line(value = ''): this {
    this.text(value)
    return this.raw(0x0a)
  }

  raster(image: RasterImage): this {
    if (!Number.isSafeInteger(image.width) || image.width <= 0 || image.width > PET_AP_58MM_PROFILE.dotsPerLine) throw new Error('invalid-raster-width')
    if (!Number.isSafeInteger(image.height) || image.height <= 0) throw new Error('invalid-raster-height')
    const widthBytes = Math.ceil(image.width / 8)
    if (image.data.length !== widthBytes * image.height) throw new Error('invalid-raster-data')
    this.raw(0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, image.height & 0xff, (image.height >> 8) & 0xff)
    this.output.push(...Array.from(image.data))
    return this
  }

  qr(value: string, moduleSize = 5): this {
    const data = encodeUtf8(value)
    if (data.length === 0 || data.length > 7089) throw new Error('invalid-qr-data')
    const size = Math.min(8, Math.max(1, Math.trunc(moduleSize)))
    this.raw(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00)
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size)
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31)
    const storeLength = data.length + 3
    this.raw(0x1d, 0x28, 0x6b, storeLength & 0xff, (storeLength >> 8) & 0xff, 0x31, 0x50, 0x30)
    this.output.push(...Array.from(data))
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30)
    return this
  }

  feed(lines: number): this {
    return this.raw(0x1b, 0x64, Math.min(255, Math.max(0, Math.trunc(lines))))
  }

  cut(): this {
    return this.raw(0x1d, 0x56, 0x42, 0x00)
  }

  reset(): this {
    return this.raw(0x1b, 0x40)
  }

  encode(): Uint8Array {
    return Uint8Array.from(this.output)
  }
}

/** Exact owner-provided PET Ap dog mark, converted deterministically to 1-bit. */
export function createPetApDogLogo(): RasterImage {
  return Object.freeze({
    width: PET_AP_TICKET_DOG_RASTER_WIDTH,
    height: PET_AP_TICKET_DOG_RASTER_HEIGHT,
    data: petApTicketDogRasterData(),
  })
}

/** @deprecated Prefer the PET Ap dog mark; kept for source compatibility. */
export const createPetApPawLogo = createPetApDogLogo
