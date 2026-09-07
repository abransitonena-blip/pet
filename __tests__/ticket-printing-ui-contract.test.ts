import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const toolPath = path.join(root, 'src/components/admin/TicketPrintTool.tsx')
const pagePath = path.join(root, 'src/app/admin/printing/test/page.tsx')

describe('Admin T1 tool runtime boundary', () => {
  const source = fs.readFileSync(toolPath, 'utf8')
  const page = fs.readFileSync(pagePath, 'utf8')

  it('requires the authoritative Admin custom claim and is noindex', () => {
    expect(source).toContain('useSessionRole([ROLES.ADMIN])')
    expect(source).not.toContain('users.role')
    expect(page).toContain('robots: { index: false, follow: false }')
  })

  it('limits session reads to 50 and reads a selected report pointwise', () => {
    expect(source).toContain('TICKET_SESSION_READ_LIMIT = 50')
    expect(source).toContain("getDoc(doc(db, 'walkReports', session.id))")
    expect(source).not.toContain("collection(db, 'walkReports')")
  })

  it('does not import Firestore writes or financial mutation functions', () => {
    const firestoreImport = source.match(/import \{([^}]+)\} from 'firebase\/firestore'/)?.[1] ?? ''
    expect(firestoreImport).not.toMatch(/addDoc|setDoc|updateDoc|writeBatch|runTransaction|deleteDoc/)
    expect(source).not.toMatch(/createPayment|financialMovement|printCount|ledger|cashClosing/)
  })

  it('generates only after an explicit action and never invokes browser print', () => {
    expect(source).toContain('onClick={() => void generate()}')
    expect(source).not.toContain('window.print')
    expect(source).not.toContain('navigator.bluetooth')
    expect(source).toContain('No crea pagos, movimientos, cierres ni CFDI')
    expect(source).toContain('createPersistentTicket')
  })

  it('provides accessible 44px controls and a collapsible technical panel', () => {
    expect(source).toContain('min-h-11')
    expect(source).toContain('<details')
    expect(source).toContain('HEX continuo')
  })

  it('uses the exact owner-provided dog asset in the thermal preview', () => {
    const mark = fs.readFileSync(path.join(root, 'src/components/tickets/PetApDogMark.tsx'), 'utf8')
    expect(mark).toContain('/brand/pet-ap-ticket-dog.png')
    expect(mark).toContain('width={1035}')
    expect(mark).toContain('height={961}')
    expect(mark).toContain('unoptimized')
    expect(source).toContain('<PetApDogMark')
  })
})
