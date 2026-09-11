import { readFileSync } from 'node:fs'
import { looksLikeShortFolio, matchesShortFolio, shortFolio, SHORT_FOLIO_LENGTH } from '@/lib/ticketFolio'

const read = (path: string) => readFileSync(path, 'utf8')

describe('folio corto del ticket', () => {
  test('son los últimos seis caracteres del folio guardado, en mayúsculas', () => {
    expect(SHORT_FOLIO_LENGTH).toBe(6)
    expect(shortFolio('TKT-abcdefghij123456')).toBe('123456')
    expect(shortFolio('TKT-AbCdEf')).toBe('ABCDEF')
    // Más corto que seis: se devuelve lo que hay, no se inventa relleno.
    expect(shortFolio('TKT-ab')).toBe('TKTAB')
    expect(shortFolio('')).toBe('')
  })

  test('distingue lo que alguien escribe en el buscador', () => {
    expect(looksLikeShortFolio('AB12CD')).toBe(true)
    expect(looksLikeShortFolio('ab12cd')).toBe(true)
    expect(looksLikeShortFolio('TKT-abcdefghij123456')).toBe(false)
    expect(looksLikeShortFolio('ABCDEFG')).toBe(false)
    expect(looksLikeShortFolio('   ')).toBe(false)
  })

  test('un código corto encuentra su folio largo', () => {
    const folio = 'TKT-xyzABC123456'
    expect(matchesShortFolio(folio, '123456')).toBe(true)
    expect(matchesShortFolio(folio, '123456 ')).toBe(true)
    expect(matchesShortFolio(folio, 'ZZZZZZ')).toBe(false)
    expect(matchesShortFolio(folio, '')).toBe(false)
  })

  test('el papel imprime el corto y ya no repite el folio de servicio', () => {
    expect(read('src/lib/printing/petApTicketBuilder.ts')).toContain('`Folio: ${shortFolio(snapshot.folio)}`')
    const receipt = read('src/components/tickets/TicketReceiptView.tsx')
    expect(receipt).toContain('{shortFolio(ticket.folio)}')
    expect(receipt).not.toContain('ticket.serviceFolio')
  })

  test('en admin se ve el corto arriba y el largo como referencia, y el buscador acepta los dos', () => {
    const detail = read('src/components/admin/AdminTicketDetail.tsx')
    expect(detail).toContain('{shortFolio(ticket.folio)}')
    expect(detail).toContain('{ticket.folio}')
    expect(detail).toContain('`ticket-${shortFolio(ticket.folio)}.bin`')
    const list = read('src/components/admin/AdminTicketsList.tsx')
    expect(list).toContain('looksLikeShortFolio(typed)')
    expect(list).toContain('matchesShortFolio(ticket.folio, typed)')
  })
})
