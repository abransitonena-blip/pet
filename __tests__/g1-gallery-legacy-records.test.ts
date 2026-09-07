import { readFileSync } from 'node:fs'
import { galleryFormatLabel, parseGalleryRecord } from '@/lib/media/galleryRecords'

describe('G1 defensive gallery record parsing', () => {
  test('classifies the observed legacy contract without throwing', () => {
    const parsed = parseGalleryRecord('h41ub970-example', {
      createdAt: { seconds: 1, nanoseconds: 0 },
      dog: 'Tobi',
      title: 'Paseo anterior',
      url: 'https://example.com/legacy-photo.jpg',
    })

    expect(parsed).toEqual({
      kind: 'legacy',
      record: {
        id: 'h41ub970-example',
        title: 'Paseo anterior',
        dog: 'Tobi',
        hasValidUrl: true,
      },
    })
  })

  test('keeps malformed records isolated from compatible G1 records', () => {
    const invalid = parseGalleryRecord('invalid-record', {
      schemaVersion: 1,
      publicationStatus: 'published',
      format: null,
      url: 'javascript:alert(1)',
    })

    expect(invalid.kind).toBe('invalid')
  })

  test('accepts the exact compatible contract and formats only its validated format', () => {
    const parsed = parseGalleryRecord('g1-record', {
      schemaVersion: 1,
      publicationStatus: 'draft',
      consentRecorded: false,
      consentVerified: false,
      publicGalleryAllowed: false,
      usageRights: 'pending',
      assetPublicId: 'pet-ap-public/123e4567-e89b-12d3-a456-426614174000',
      url: 'https://res.cloudinary.com/pet/image/upload/v1/pet-ap-public/example.jpg',
      width: 1200,
      height: 900,
      format: 'jpg',
      altText: 'Un perro durante su paseo',
      assetDate: { seconds: 1 },
      revokedAt: null,
      pendingDeletion: false,
      createdBy: 'admin-uid',
      createdAt: { seconds: 1 },
      updatedAt: { seconds: 1 },
    })

    expect(parsed.kind).toBe('compatible')
    if (parsed.kind === 'compatible') expect(galleryFormatLabel(parsed.record.format)).toBe('JPG')
  })

  test('the manager does not call string methods on unparsed optional fields', () => {
    const manager = readFileSync('src/components/gallery/AdminGalleryManager.tsx', 'utf8')
    expect(manager).toContain('parseGalleryRecord(item.id, item.data())')
    expect(manager).toContain('Registro anterior — pendiente de migración')
    expect(manager).not.toContain('.format.toUpperCase()')
  })
})
