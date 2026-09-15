import { readFileSync } from 'node:fs'

describe('MP-008: buttons never look active while silently failing on a disabled flag', () => {
  test('admin/reservas: the on-the-way and restore actions are gated, not just their toast', () => {
    const source = readFileSync('src/components/admin/LegacyReservationsView.tsx', 'utf8')
    expect(source).toContain("disabled={!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED} className=\"w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-purple-500/10 text-purple-400")
    expect(source).toContain("title={FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED ? 'En camino' : 'Legacy de solo lectura'}")
    expect(source).toContain("title={FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED ? 'Restaurar' : 'Legacy de solo lectura'}")
  })

  test('admin/referidos: add/complete/delete actions are gated by AUTOMATIC_REFERRALS_ENABLED', () => {
    const source = readFileSync('src/app/admin/referidos/page.tsx', 'utf8')
    expect(source).toContain('disabled={!FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED} isLoading={saving}')
    expect(source).toContain("disabled={!FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED} className=\"w-7 h-7 rounded-lg flex items-center justify-center hover:bg-success-500/10")
    expect(source).toContain("disabled={!FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED} className=\"w-7 h-7 rounded-lg flex items-center justify-center hover:bg-danger-500/10")
  })

  test('cancelar: the cancel button is gated by LEGACY_RESERVATION_WRITES_ENABLED', () => {
    const source = readFileSync('src/app/cancelar/page.tsx', 'utf8')
    expect(source).toContain('disabled={cancelling === r.id || !FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED}')
  })

  test('EditReservationModal: save is gated by LEGACY_RESERVATION_WRITES_ENABLED', () => {
    const source = readFileSync('src/components/EditReservationModal.tsx', 'utf8')
    expect(source).toContain('!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED')
    expect(source.match(/disabled=\{saving \|\| !form\.date \|\| !form\.time \|\| !form\.service \|\| !FEATURE_FLAGS\.LEGACY_RESERVATION_WRITES_ENABLED\}/)).not.toBeNull()
  })

  test('WalkSessionModal: save is gated by LEGACY_RESERVATION_WRITES_ENABLED in addition to the top-level PRIVATE_MEDIA_UPLOADS_ENABLED gate', () => {
    const source = readFileSync('src/components/WalkSessionModal.tsx', 'utf8')
    expect(source.match(/disabled=\{!photo \|\| !location \|\| saving \|\| !FEATURE_FLAGS\.LEGACY_RESERVATION_WRITES_ENABLED\}/)).not.toBeNull()
  })
})
