import fs from 'node:fs'
import path from 'node:path'
import { FEATURE_FLAGS, FEATURE_FLAG_NAMES } from '@/lib/featureFlags'

const root = path.resolve(__dirname, '..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('P0.2 safe feature defaults', () => {
  it('keeps every contained capability disabled by default', () => {
    expect(FEATURE_FLAG_NAMES).toEqual(expect.arrayContaining([
      'PET_AHORA_ENABLED',
      'WALLET_MUTATIONS_ENABLED',
      'LOYALTY_REDEMPTION_ENABLED',
      'AUTOMATIC_REFERRALS_ENABLED',
      'FCM_ENABLED',
      'AUTOMATED_REMINDERS_ENABLED',
      'PUBLIC_REVIEWS_ENABLED',
      'PUBLIC_PHONE_CANCELLATION_ENABLED',
      'PRIVATE_MEDIA_UPLOADS_ENABLED',
      'WALK_REPORTS_ENABLED',
    ]))
    // PET_AHORA_ENABLED was turned on by an explicit owner decision. It stays
    // double-gated: the code flag below plus config.features.petAhoraEnabled,
    // the operational switch an admin controls from Configuración.
    // BLUETOOTH_PRINTING_ENABLED: owner decision, to test with the physical printer.
    // PRIVATE_MEDIA_UPLOADS_ENABLED: owner decision for walk photos, private and behind expiring links.
    // WALK_TRACKING_ENABLED: owner decision, location every ~2 min only during a walk.
    // PET_EMERGENCY_QR_ENABLED: owner decision (2026-09-12), once the
    // emergency-profiles rules were published. Still double-gated: nothing is
    // published for a dog without its own emergencyProfile.enabled opt-in.
    // FCM_ENABLED: owner decision (2026-09-13). Double-gated too: without
    // NEXT_PUBLIC_FIREBASE_VAPID_KEY the client returns 'off', and the browser
    // permission is granted by each person, never by the app.
    const enabledByDesign = new Set(['WALK_REPORTS_ENABLED', 'PUBLIC_REVIEWS_ENABLED', 'PET_AHORA_ENABLED', 'BLUETOOTH_PRINTING_ENABLED', 'PRIVATE_MEDIA_UPLOADS_ENABLED', 'WALK_TRACKING_ENABLED', 'PET_EMERGENCY_QR_ENABLED', 'FCM_ENABLED'])
    expect(Object.entries(FEATURE_FLAGS).every(([name, enabled]) => enabledByDesign.has(name) ? enabled : enabled === false)).toBe(true)
  })

  it('PUBLIC_REVIEWS_ENABLED may only be true alongside a real server-side write path (auth + rate limit)', () => {
    if (!FEATURE_FLAGS.PUBLIC_REVIEWS_ENABLED) return
    const route = read('src/app/api/reviews/submit/route.ts')
    expect(route).toContain('verifyAuthenticatedToken')
    expect(route).toContain('checkRateLimit(')
    expect(read('src/components/ReviewForm.tsx')).not.toContain("addDoc(collection(db, 'reviews')")
  })

  it('does not ship callable invocations in application source', () => {
    const files = [
      'src/lib/useWallet.ts',
      'src/components/LoyaltyProgram.tsx',
      'src/app/admin/paseadores/page.tsx',
      'src/firebase/config.ts',
    ]
    for (const file of files) {
      expect(read(file)).not.toMatch(/httpsCallable|getFunctions\(/)
    }
  })

  it('blocks PET Ahora before listeners and writes and exposes the scheduled alternative', () => {
    expect(read('src/lib/usePetAhoraDispatch.ts')).toContain('if (!FEATURE_FLAGS.PET_AHORA_ENABLED)')
    expect(read('src/lib/usePetAhoraWalker.ts')).toContain('if (!FEATURE_FLAGS.PET_AHORA_ENABLED)')
    expect(read('src/lib/usePetAhoraActiveWalks.ts')).toContain('if (!FEATURE_FLAGS.PET_AHORA_ENABLED)')
    const form = read('src/components/PetAhoraRequestForm.tsx')
    expect(form).toContain('PET Ahora está temporalmente en preparación')
    expect(form).toContain('href="/familia/nueva-reserva"')
    expect(form).not.toMatch(/setTimeout/)
  })

  it('does not register FCM and keeps one service worker registration', () => {
    const pwa = read('src/components/PWARegister.tsx')
    expect(pwa).not.toContain('firebase-messaging-sw.js')
    expect(pwa.match(/navigator\.serviceWorker\.register\(/g)).toHaveLength(1)
  })

  it('does not use callables for credits or automatic loyalty redemption', () => {
    const wallet = read('src/lib/useWallet.ts')
    const loyalty = read('src/components/LoyaltyProgram.tsx')
    expect(wallet).not.toContain('deductFromWallet')
    expect(wallet).toContain('WALLET_MUTATIONS_ENABLED')
    expect(loyalty).not.toContain('redeemFreeWalk')
    expect(loyalty).toContain('Solicitar revisión manual')
  })

  it('does not create pending referral conversions and states the real conditions', () => {
    expect(read('src/lib/submitReservation.ts')).not.toContain("reservationId: 'pending'")
    const referrals = read('src/app/familia/referir/page.tsx')
    expect(referrals).toMatch(/primer paseo pagado y completado/i)
    expect(referrals).not.toContain('$20 de descuento')
  })

  it('blocks public cancellation, public reviews and private operational uploads', () => {
    expect(read('src/app/cancelar/page.tsx')).toContain('PUBLIC_PHONE_CANCELLATION_ENABLED')
    expect(read('src/components/ReviewForm.tsx')).toContain('PUBLIC_REVIEWS_ENABLED')
    expect(read('src/lib/cloudinary.ts')).toContain('PRIVATE_MEDIA_UPLOADS_ENABLED')
    expect(read('src/components/WalkSessionModal.tsx')).toContain('Fotos operativas temporalmente desactivadas')
  })

  it('enables canonical reports while private report media stays contained', () => {
    expect(FEATURE_FLAGS.WALK_REPORTS_ENABLED).toBe(true)
    expect(read('src/lib/useWalkReport.ts')).toContain("if (!FEATURE_FLAGS.WALK_REPORTS_ENABLED)")
    expect(read('src/components/walker/WalkReportEditor.tsx')).toContain('Fotos privadas no disponibles todavía')
    // Photos are on now, but the upload UI still hangs off the flag.
    expect(read('src/components/walker/WalkReportEditor.tsx')).toContain('FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED ?')
  })

  it('distinguishes an empty credit history from a query failure', () => {
    const page = read('src/app/familia/billetera/page.tsx')
    expect(page).toContain('Sin movimientos aún')
    expect(page).toContain('No pudimos consultar tus movimientos')
  })
})
