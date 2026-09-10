/**
 * Dispositivos registrados por cuenta: pocos y recientes.
 *
 * Pure helpers shared by the server routes and the tests. A person who
 * reinstalls, clears site data or changes phones gets a new token each time;
 * without a cap the list only ever grows, and every push would be retried
 * against devices that stopped existing long ago.
 */

export const MAX_DEVICES = 10
const MIN_TOKEN_LENGTH = 20
const MAX_TOKEN_LENGTH = 4096

export function isPlausibleToken(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= MIN_TOKEN_LENGTH
    && value.length <= MAX_TOKEN_LENGTH
    && !/\s/.test(value)
}

/** Adds `token` as the most recent device, without duplicates, keeping the newest MAX_DEVICES. */
export function mergeDeviceTokens(existing: readonly string[], token: string): string[] {
  return [...existing.filter((item) => item !== token), token].slice(-MAX_DEVICES)
}

export function withoutTokens(existing: readonly string[], removed: ReadonlySet<string>): string[] {
  return existing.filter((item) => !removed.has(item))
}
