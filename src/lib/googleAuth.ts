import { GoogleAuthProvider } from 'firebase/auth'
import { ACCESS_MESSAGES } from '@/lib/roles'

// Shared, client-safe provider. Google client IDs are public configuration;
// no secret, claim mutation or account provisioning belongs in this module.
export const googleAuthProvider = new GoogleAuthProvider()
googleAuthProvider.setCustomParameters({ prompt: 'select_account' })

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || ''

export function isGoogleAuthConfigured(): boolean {
  return GOOGLE_CLIENT_ID.length > 0
}

export type WalkerProfileAccess =
  | { allowed: true }
  | { allowed: false; reason: 'profile-missing' | 'suspended' | 'invited' | 'inactive'; message: string }

export function evaluateWalkerProfileAccess(profile: unknown): WalkerProfileAccess {
  if (!profile || typeof profile !== 'object') {
    return { allowed: false, reason: 'profile-missing', message: ACCESS_MESSAGES.walkerProfileMissing }
  }
  const status = 'status' in profile ? (profile as { status?: unknown }).status : undefined
  if (status === 'active') return { allowed: true }
  if (status === 'suspended') return { allowed: false, reason: 'suspended', message: ACCESS_MESSAGES.suspended }
  if (status === 'invited') return { allowed: false, reason: 'invited', message: ACCESS_MESSAGES.invited }
  return { allowed: false, reason: 'inactive', message: ACCESS_MESSAGES.inactive }
}
