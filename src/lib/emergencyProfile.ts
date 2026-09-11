/**
 * Feature J — emergencyProfile helpers.
 *
 * This module owns the read/write contract for the emergency-profiles/{slug}
 * mirror collection. It is the only place that decides which fields from a
 * dogs/{petId} document are safe to publish publicly.
 *
 * Privacy rules (do NOT relax without explicit owner approval):
 * - NEVER include: address, health, preferences, metrics, ownerId email, petId.
 * - ONLY include: petName, breed, size, petType, photoUrl (if any), showPhone,
 *   ownerPhone (only if showPhone === true), ownerId (for delete-gate only).
 * - publicSlug is a random 22-char base64url token — it is not the petId.
 */

import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Campos que se almacenan en emergency-profiles/{slug}. */
export interface EmergencyProfileDoc {
  /** ID interno para validar que solo el dueño borra/actualiza. Nunca expuesto en la UI pública. */
  ownerId: string
  petName: string
  breed: string
  size: 'pequeño' | 'mediano' | 'grande'
  petType: 'perro' | 'gato' | 'otro'
  /** URL de foto si el perfil de la mascota tiene una. Puede ser undefined. */
  photoUrl?: string
  /** Si true, ownerPhone está presente en este doc y se muestra en /qr/[slug]. */
  showPhone: boolean
  /** Solo presente cuando showPhone === true. Nunca se guarda en falso. */
  ownerPhone?: string
  /** Fecha de creación/actualización para TTL opcional futuro. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any
}

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

const SLUG_BYTES = 16 // 128 bits de entropía → slug de ~22 chars base64url

/**
 * Genera un token aleatorio no adivinable usando Web Crypto.
 * Sin dependencias de npm (no nanoid, no uuid).
 * Devuelve base64url sin padding.
 */
export function generatePublicSlug(): string {
  const bytes = new Uint8Array(SLUG_BYTES)
  crypto.getRandomValues(bytes)
  // Sin spread: iterar un Uint8Array exige downlevelIteration con este target.
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Un slug válido: 22 caracteres base64url, como los genera generatePublicSlug. */
export function isEmergencySlug(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{20,24}$/.test(value)
}

/**
 * Lo único que ve quien escanea la placa. Es un subconjunto deliberado de
 * EmergencyProfileDoc: sin ownerId, sin fechas, sin nada del expediente.
 */
export interface PublicEmergencyProfile {
  petName: string
  breed: string
  size: string
  petType: string
  photoUrl?: string
  showPhone: boolean
  ownerPhone?: string
}

// ---------------------------------------------------------------------------
// Firestore writes
// ---------------------------------------------------------------------------

/** Nombre de la colección espejo — centralizado para evitar typos. */
export const EMERGENCY_PROFILES_COLLECTION = 'emergency-profiles'

export interface ActivateEmergencyProfileInput {
  publicSlug: string
  ownerId: string
  ownerPhone: string
  petName: string
  breed: string
  size: 'pequeño' | 'mediano' | 'grande'
  petType: 'perro' | 'gato' | 'otro'
  photoUrl?: string
  showOwnerPhone: boolean
}

/**
 * Escribe (o sobreescribe) el documento espejo en emergency-profiles/{slug}.
 *
 * Llamar solo cuando el dueño activa explícitamente el perfil o cambia
 * showOwnerPhone. Esta función es la única fuente de escritura — no existe
 * otro camino para crear un documento en emergency-profiles.
 */
export async function activateEmergencyProfile(input: ActivateEmergencyProfileInput): Promise<void> {
  const payload: EmergencyProfileDoc = {
    ownerId: input.ownerId,
    petName: input.petName,
    breed: input.breed,
    size: input.size,
    petType: input.petType,
    showPhone: input.showOwnerPhone,
    createdAt: serverTimestamp(),
  }
  // photoUrl solo si existe — evitar guardar cadena vacía
  if (input.photoUrl) payload.photoUrl = input.photoUrl
  // ownerPhone solo si showOwnerPhone === true
  if (input.showOwnerPhone && input.ownerPhone) payload.ownerPhone = input.ownerPhone

  const ref = doc(db, EMERGENCY_PROFILES_COLLECTION, input.publicSlug)
  await setDoc(ref, payload)
}

/**
 * Elimina el documento espejo. Llamar cuando el dueño desactiva el perfil.
 * Si el documento no existe, Firestore no lanza error (deleteDoc es idempotente).
 */
export async function deactivateEmergencyProfile(publicSlug: string): Promise<void> {
  const ref = doc(db, EMERGENCY_PROFILES_COLLECTION, publicSlug)
  await deleteDoc(ref)
}

// ---------------------------------------------------------------------------
// URL builder (para generar la URL que va en el QR)
// ---------------------------------------------------------------------------

/**
 * Construye la URL pública del perfil de emergencia.
 * Usa NEXT_PUBLIC_SITE_URL si está definida; de lo contrario origin del browser.
 */
export function emergencyProfileUrl(publicSlug: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://pet-euhz.vercel.app')
  return `${base}/qr/${publicSlug}`
}
