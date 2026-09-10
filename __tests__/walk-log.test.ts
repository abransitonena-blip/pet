import { readFileSync } from 'node:fs'
import { applyWalkLog, walkLogTime } from '@/lib/walkLog'
import { MAX_WALK_PHOTOS, isWalkPhotoReference, validateWalkReportContent, type WalkReportContent } from '@/lib/walkReports'

const read = (path: string) => readFileSync(path, 'utf8')
const empty: WalkReportContent = {
  summary: '', behaviorNotes: '', bathroomNotes: '', waterProvided: false, incidentsSummary: '', mediaReferences: [],
}
// 16:32 UTC is 10:32 in Mexico City (UTC-6).
const at = new Date('2026-09-10T16:32:00Z')
const photo = (index: number) => `pet-ap-private/walk-reports/${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`

describe('bitácora del paseo', () => {
  test('cada registro agrega una línea con la hora de la Ciudad de México en su apartado', () => {
    expect(walkLogTime(at)).toBe('10:32')
    expect(applyWalkLog(empty, 'pipi', at)).toEqual({ ok: true, content: { ...empty, bathroomNotes: '10:32 · Pipí' } })
    expect(applyWalkLog({ ...empty, bathroomNotes: '10:00 · Pipí' }, 'popo', at)).toEqual({
      ok: true,
      content: { ...empty, bathroomNotes: '10:00 · Pipí\n10:32 · Popó' },
    })
    expect(applyWalkLog(empty, 'juego', at)).toEqual({ ok: true, content: { ...empty, behaviorNotes: '10:32 · Jugó' } })
  })

  test('agua queda anotada y marca que se dio agua', () => {
    expect(applyWalkLog(empty, 'agua', at)).toEqual({
      ok: true,
      content: { ...empty, bathroomNotes: '10:32 · Tomó agua', waterProvided: true },
    })
  })

  test('un incidente necesita descripción', () => {
    expect(applyWalkLog(empty, 'incidente', at, '   ')).toEqual({ ok: false, reason: 'detail-required' })
    expect(applyWalkLog(empty, 'incidente', at, 'se asustó con un perro')).toEqual({
      ok: true,
      content: { ...empty, incidentsSummary: '10:32 · Incidente: se asustó con un perro' },
    })
  })

  test('nunca recorta: si la línea no cabe, la rechaza', () => {
    expect(applyWalkLog({ ...empty, bathroomNotes: 'x'.repeat(495) }, 'pipi', at)).toEqual({ ok: false, reason: 'too-long' })
  })

  test('el paseador llega a la bitácora durante el paseo', () => {
    expect(read('src/components/walker/WalkerSessionCard.tsx')).toContain('Bitácora del paseo')
  })
})

describe('fotos privadas del paseo', () => {
  test('solo acepta ids privados del prefijo de reportes, nunca una URL', () => {
    expect(isWalkPhotoReference(photo(1))).toBe(true)
    expect(isWalkPhotoReference('https://res.cloudinary.com/demo/image/upload/foto.jpg')).toBe(false)
    expect(isWalkPhotoReference('pet-ap-public/00000001-0000-4000-8000-000000000000')).toBe(false)
  })

  test('hasta seis por reporte', () => {
    const six = Array.from({ length: MAX_WALK_PHOTOS }, (_, index) => photo(index))
    expect(validateWalkReportContent({ ...empty, mediaReferences: six }, 'draft')).toEqual([])
    expect(validateWalkReportContent({ ...empty, mediaReferences: [...six, photo(99)] }, 'draft')).toContain('too-many-photos')
  })

  test('la familia ve las fotos solo con el reporte enviado, y los enlaces caducan', () => {
    const route = read('src/app/api/media/private/walk-photos/route.ts')
    expect(route).toContain("report.status !== 'submitted'")
    expect(route).toContain('session.walkerId === caller.uid')
    expect(route).toContain('FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED')
    expect(read('src/lib/media/privateMediaAdmin.server.ts')).toContain('expires_at=${expiresAt}')
  })

  test('el public_id lleva la carpeta, así no depende del modo de carpetas de Cloudinary', () => {
    const signer = read('src/lib/media/privateMediaAdmin.server.ts')
    expect(signer).toContain('const publicId = `${folder}/${randomUUID()}`')
    expect(signer).not.toContain('folder=${folder}&')
  })

  test('las reglas validan cada foto y la política lo documenta', () => {
    const rules = read('firestore.rules')
    expect(rules).toContain("reference.matches('^pet-ap-private/walk-reports/[a-f0-9-]{36}$')")
    expect(rules).toContain('references.size() <= 6')
    expect(rules).not.toContain('data.mediaReferences.size() == 0')
    expect(read('MEDIA_POLICY.md')).toContain('Fotos del paseo — activas')
  })
})
