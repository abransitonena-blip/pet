'use client'

import { useEffect, useState } from 'react'

/**
 * Sugerencias de colonia y estado a partir del código postal.
 *
 * Calls this app's own /api/postal-code, which proxies the public lookup --
 * see that route for why the request does not go straight from the browser.
 * Strictly a convenience: any failure leaves `places` empty and the person
 * types the address as before, so this never blocks saving one.
 */

const POSTAL_CODE_PATTERN = /^\d{5}$/
const DEBOUNCE_MS = 400

export interface PostalCodeSuggestion {
  readonly state: string
  readonly places: readonly string[]
}

export function usePostalCodeLookup(postalCode: string): {
  suggestion: PostalCodeSuggestion | null
  loading: boolean
} {
  const [suggestion, setSuggestion] = useState<PostalCodeSuggestion | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const normalized = postalCode.trim()
    if (!POSTAL_CODE_PATTERN.test(normalized)) {
      setSuggestion(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      fetch(`/api/postal-code?cp=${normalized}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { state?: unknown; places?: unknown } | null) => {
          if (cancelled) return
          const places = Array.isArray(data?.places)
            ? data.places.filter((place): place is string => typeof place === 'string')
            : []
          setSuggestion(places.length > 0 || typeof data?.state === 'string'
            ? { state: typeof data?.state === 'string' ? data.state : '', places }
            : null)
        })
        .catch(() => { if (!cancelled) setSuggestion(null) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [postalCode])

  return { suggestion, loading }
}
