import { FEATURE_FLAGS } from '@/lib/featureFlags'

/**
 * Qué fotos operativas están activas, por ámbito.
 *
 * PRIVATE_MEDIA_UPLOADS_ENABLED is the master switch; within it only
 * walk-report photos have passed review (MEDIA_POLICY.md). PET Ahora and
 * incident photos stay off. Flipping one of these alone would still fail
 * closed: the upload signer only signs the walk-reports folder.
 */
export const WALK_REPORT_PHOTOS_ENABLED = FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED
export const PET_AHORA_PHOTOS_ENABLED = false
export const INCIDENT_PHOTOS_ENABLED = false
