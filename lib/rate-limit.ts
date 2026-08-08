/**
 * Minimal in-memory token-bucket rate limiter for the ingestion endpoint.
 *
 * Note: state lives per process instance - on serverless (Vercel) each
 * instance enforces its own budget. That is acceptable for MVP-scale
 * traffic; move to a shared store (Upstash/Redis) if you need hard limits.
 */

interface Bucket {
  tokens: number
  lastRefill: number
}

const DEFAULT_MAX = 60 // requests per window
const DEFAULT_WINDOW_MS = 60_000
const MAX_BUCKETS = 10_000

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs?: number
}

export function rateLimit(
  key: string,
  max = DEFAULT_MAX,
  windowMs = DEFAULT_WINDOW_MS
): RateLimitResult {
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { tokens: max, lastRefill: now }
  }

  // Refill tokens proportional to elapsed time.
  const elapsed = now - bucket.lastRefill
  bucket.tokens = Math.min(max, bucket.tokens + (elapsed / windowMs) * max)
  bucket.lastRefill = now

  if (bucket.tokens < 1) {
    buckets.set(key, bucket)
    const retryAfterMs = Math.ceil((1 - bucket.tokens) / (max / windowMs)) * 1000
    return { allowed: false, retryAfterMs }
  }

  bucket.tokens -= 1
  buckets.set(key, bucket)
  return { allowed: true }
}

// Bound memory: if the map grows past the cap, drop it (sensors re-fill
// instantly, so the cost is minimal).
export function __pruneBuckets() {
  if (buckets.size > MAX_BUCKETS) buckets.clear()
}
