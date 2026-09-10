/**
 * Firestore rejects a document that contains `undefined` anywhere, and the
 * site defaults carry optional fields as undefined (termsSections, for one).
 * Because every save in Configuración writes the whole config, that single
 * field made every save fail -- social links, texts, features, all of it --
 * while the page looked as if it had saved.
 *
 * Only plain objects and arrays are walked, so Firestore sentinels such as
 * serverTimestamp() and other class instances pass through untouched.
 */
export function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined).map((item) => withoutUndefined(item)) as T
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, withoutUndefined(entry)]),
    ) as T
  }
  return value
}
