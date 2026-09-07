import type { Money } from '@/lib/finance/domain'
import type { TemporaryTicketSnapshot } from '@/lib/finance/domain/ticketPreview'
import { createPetApDogLogo, EscPosEncoder, PET_AP_58MM_PROFILE, type RasterImage } from './escpos'

export interface PetApTicketBuildOptions {
  readonly logo?: RasterImage
  readonly feedLines?: number
  readonly cut?: boolean
}

function formatMxn(value: Money): string {
  const absolute = Math.abs(value.amountCents)
  const pesos = Math.floor(absolute / 100)
  const cents = String(absolute % 100).padStart(2, '0')
  return `${value.amountCents < 0 ? '-' : ''}$${pesos}.${cents} MXN`
}

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

function lineWrapped(encoder: EscPosEncoder, value: string): void {
  wrap(value).forEach((line) => encoder.line(line))
}

function financialLines(snapshot: TemporaryTicketSnapshot): string[] {
  const financial = snapshot.financial
  if (!financial.reliable) return ['Pago: NO REGISTRADO']
  if (financial.complimentary) return ['Pago: CORTESÍA', 'Total: $0.00 MXN']
  const lines: string[] = []
  if (financial.subtotal) lines.push(`Subtotal: ${formatMxn(financial.subtotal)}`)
  if (financial.discount && financial.discount.amountCents > 0) lines.push(`Descuento: -${formatMxn(financial.discount)}`)
  if (financial.tip && financial.tip.amountCents > 0) lines.push(`Propina: ${formatMxn(financial.tip)}`)
  if (financial.total) lines.push(`Total: ${formatMxn(financial.total)}`)
  if (financial.amountPaid) lines.push(`Pagado: ${formatMxn(financial.amountPaid)}`)
  if (financial.balanceDue && financial.balanceDue.amountCents > 0) lines.push(`Pendiente: ${formatMxn(financial.balanceDue)}`)
  if (financial.paymentMethod) lines.push(`Método: ${financial.paymentMethod}`)
  return lines
}

export class PetApTicketBuilder {
  build(snapshot: TemporaryTicketSnapshot, options: PetApTicketBuildOptions = {}): Uint8Array {
    const encoder = new EscPosEncoder()
      .initialize()
      .selectCp850()
      .align('center')
      .raster(options.logo ?? createPetApDogLogo())
      .line()
      .bold(true)
      .size(2, 2)
      .line('PET Ap')
      .size(1, 1)
      .line('PASEO COMPLETADO')
      .bold(false)
      .line('-'.repeat(PET_AP_58MM_PROFILE.columns))
      .align('left')

    lineWrapped(encoder, snapshot.dogs.map((dog) => dog.displayName).join(', '))
    lineWrapped(encoder, `${snapshot.serviceDisplayName}${snapshot.durationMinutes ? ` - ${snapshot.durationMinutes} min` : ''}`)
    encoder.line(`${snapshot.serviceDate}  ${snapshot.startTime}${snapshot.endTime ? `-${snapshot.endTime}` : ''}`)
    lineWrapped(encoder, `Paseador: ${snapshot.walker.displayName}`)
    lineWrapped(encoder, `Folio: ${snapshot.folio}`)
    encoder.line()
    financialLines(snapshot).forEach((line) => lineWrapped(encoder, line))
    encoder.line().line('-'.repeat(PET_AP_58MM_PROFILE.columns)).line()

    if (snapshot.reportStatus === 'submitted' && snapshot.reportUrl) {
      encoder.align('center').bold(true).line('VER REPORTE DEL PASEO').bold(false).line().qr(snapshot.reportUrl).line()
      encoder.line(new URL(snapshot.reportUrl).hostname)
    } else {
      encoder.align('center').line('REPORTE NO DISPONIBLE')
    }

    encoder.line().line(`Verif: ${snapshot.verificationCode}`)
    if (snapshot.mode === 'reprint') encoder.bold(true).line('REIMPRESIÓN').bold(false)
    encoder.bold(true).line('VISTA PREVIA - NO FISCAL').bold(false)
    if (!snapshot.financial.reliable) encoder.line('Pago no registrado = sin comprobante financiero')
    encoder.line().line('¡Gracias por confiar en PET Ap!')
    encoder.feed(options.feedLines ?? 4)
    if (options.cut === true && PET_AP_58MM_PROFILE.supportsCut) encoder.cut()
    encoder.reset()
    return encoder.encode()
  }
}

export function buildPetApTicket(snapshot: TemporaryTicketSnapshot, options?: PetApTicketBuildOptions): Uint8Array {
  return new PetApTicketBuilder().build(snapshot, options)
}
