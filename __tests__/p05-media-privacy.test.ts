import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('P0.5 media, privacy and service-worker containment', () => {
  test('public gallery has no fictitious fallback and requires explicit publication consent', () => {
    const gallery = read('src/components/Gallery.tsx')
    expect(gallery).not.toContain('placedog.net')
    expect(gallery).not.toContain('fallbackImages')
    expect(gallery).toContain("collection(db, 'gallery-public')")
    expect(gallery).not.toContain("collection(db, 'gallery-images')")
    expect(gallery).toContain('limit(50)')
    expect(gallery).toContain('Próximamente nuevas historias')
  })

  test('admin gallery cannot perform unsigned uploads or pretend a provider asset was deleted', () => {
    const adminGallery = read('src/components/gallery/AdminGalleryManager.tsx')
    expect(adminGallery).not.toContain('upload_preset')
    expect(adminGallery).not.toContain('deleteDoc')
    expect(adminGallery).toContain('/api/admin/gallery/signature')
    expect(adminGallery).toContain('writeBatch(db)')
    expect(adminGallery).toContain('El asset externo no fue eliminado')
  })

  test('client media services fail closed even if a flag is accidentally enabled', () => {
    const legacyUpload = read('src/lib/cloudinary.ts')
    const provider = read('src/lib/media/CloudinaryProvider.ts')
    expect(legacyUpload).not.toContain('/image/upload')
    expect(legacyUpload).toContain('SIGNED_MEDIA_BACKEND_REQUIRED')
    expect(provider).not.toContain("fetch(`${API_URL}/image/upload`")
    expect(provider).toContain('SIGNED_MEDIA_BACKEND_REQUIRED')
    expect(provider).toContain('TRUSTED_MEDIA_DELETE_BACKEND_REQUIRED')
  })

  test('only the canonical offline worker is registered, and nothing can subscribe to push while FCM stays disabled', () => {
    const register = read('src/components/PWARegister.tsx')
    const offlineWorker = read('public/sw.js')
    const legacyMessagingWorker = read('public/firebase-messaging-sw.js')
    const pushClient = read('src/lib/push/pushClient.ts')
    expect(register).toContain("register('/sw.js', { scope: '/' })")
    expect(register).not.toContain('firebase-messaging-sw.js')
    expect(legacyMessagingWorker).not.toContain('importScripts(')
    // Deliberate change: push handlers now ship in /sw.js so push is ready
    // the moment it is switched on, but they are dormant. A push can only
    // arrive through a subscription, and the only way to create one --
    // enablePush -- returns 'off' before asking for permission until both
    // FCM_ENABLED and a VAPID key exist. The worker still loads no remote code.
    expect(offlineWorker).not.toContain('importScripts(')
    expect(pushClient).toContain("if (!FEATURE_FLAGS.FCM_ENABLED || !VAPID_KEY) return 'off'")
    expect(pushClient.indexOf('return { ok: false, reason: availability }'))
      .toBeLessThan(pushClient.indexOf('Notification.requestPermission()'))
  })

  test('brand fonts are bundled by next/font without a runtime Google stylesheet', () => {
    const layout = read('src/app/layout.tsx')
    const brandContext = read('src/context/BrandContext.tsx')
    const presets = read('src/lib/brandPresets.ts')
    expect(layout).toContain('Inter, Manrope')
    expect(layout).toContain("variable: '--font-inter'")
    expect(brandContext).not.toContain('fonts.googleapis.com')
    expect(presets).toContain('var(--font-inter)')
  })
})
