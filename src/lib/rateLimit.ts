/**
 * Best-effort, per-instance rate limiter. Vercel serverless functions can run
 * as multiple concurrent instances, so this does not enforce a hard global
 * cap — it raises the bar against a single script hammering one endpoint
 * without requiring any external store (Redis, etc.), which this project's
 * GCP project cannot provision today (no billing account). Fine for the
 * write-mutation endpoints this guards; not a substitute for a distributed
 * limiter if traffic ever justifies one.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  readonly allowed: boolean
  readonly retryAfterSeconds: number
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) }
  }

  existing.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}
