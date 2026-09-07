import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

describe('T2 runtime boundaries', () => {
  test('uses deterministic transactions and never writes financial collections', () => {
    const repository = read('src/lib/tickets.ts')
    expect(repository).toContain("doc(db, 'tickets', ticketId)")
    expect(repository).toContain('runTransaction')
    expect(repository).toContain("'printEvents'")
    expect(repository).not.toMatch(/collection\(db, ['"](?:payments|financialMovements|cashClosings|walkerSettlements)['"]\)/)
  })

  test('Admin routes expose explicit ticket actions and no automatic printing', () => {
    const detail = read('src/components/admin/AdminTicketDetail.tsx')
    const tool = read('src/components/admin/TicketPrintTool.tsx')
    expect(detail).toContain('Copiar HEX')
    expect(detail).toContain('SHA-256: {payloadHash}')
    expect(detail).toContain('Impresión confirmada')
    expect(detail).toContain("recordPrintEvent")
    expect(tool).toContain('Crear ticket')
    expect(tool).toContain('createPersistentTicket')
    expect(detail).not.toContain('navigator.bluetooth')
    expect(detail).not.toContain('window.print')
    expect(detail).not.toContain('<StatusBadge status={ticket.status}')
    expect(detail).toContain('Activo')
  })

  test('Customer and Walker use point-read routes, never global ticket lists', () => {
    const readOnly = read('src/components/tickets/TicketReadOnlyPage.tsx')
    expect(readOnly).toContain('getTicket(ticketId)')
    expect(readOnly).not.toContain("collection(db, 'tickets')")
  })
})
