import { readFileSync } from 'node:fs'

describe('G1 signed public gallery', () => {
  const signatureRoute = readFileSync('src/app/api/admin/gallery/signature/route.ts', 'utf8')
  const serverSigner = readFileSync('src/lib/media/cloudinaryAdmin.server.ts', 'utf8')
  const adminGallery = readFileSync('src/components/gallery/AdminGalleryManager.tsx', 'utf8')
  const publicGallery = readFileSync('src/components/Gallery.tsx', 'utf8')
  const serverAuth = readFileSync('src/lib/serverAuth.ts', 'utf8')

  test('keeps Cloudinary signing server-only and verifies the Admin claim', () => {
    expect(signatureRoute).toContain("export const runtime = 'nodejs'")
    expect(signatureRoute).toContain('verifyAdminToken')
    expect(signatureRoute).not.toContain('CLOUDINARY_API_SECRET')
    expect(serverSigner).toContain('CLOUDINARY_API_SECRET')
    expect(serverSigner).toContain('fl_strip_profile')
    expect(serverSigner).not.toContain('NEXT_PUBLIC_CLOUDINARY_API_SECRET')
    expect(serverAuth).toContain('initializeApp({ projectId })')
    expect(serverAuth).toContain('NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  })

  test('contains no unsigned upload fallback and stores only strict public metadata', () => {
    expect(adminGallery).not.toMatch(/upload_preset|unsigned/)
    expect(adminGallery).toContain("publicationStatus: 'draft'")
    expect(adminGallery).toContain('consentRecorded')
    expect(adminGallery).toContain("usageRights: rights ? 'public-gallery' : 'pending'")
    expect(adminGallery).toContain('revokedAt: null')
    expect(adminGallery).toContain('pendingDeletion: false')
  })

  test('public client reads only the minimal projection with a hard limit', () => {
    expect(publicGallery).toContain("collection(db, 'gallery-public')")
    expect(publicGallery).toContain("orderBy('updatedAt', 'desc')")
    expect(publicGallery).toContain('limit(50)')
    expect(publicGallery).not.toContain("collection(db, 'gallery-images')")
    expect(publicGallery).not.toContain('placedog.net')
  })

  test('publishing and withdrawing update private metadata and public projection atomically', () => {
    expect(adminGallery).toContain('writeBatch(db)')
    expect(adminGallery).toContain("doc(db, 'gallery-public', record.id)")
    expect(adminGallery).toContain('batch.set(publicRef, publicProjection(record))')
    expect(adminGallery).toContain('batch.delete(publicRef)')
    expect(adminGallery).toContain('await batch.commit()')
  })
})
