import { createHash } from 'crypto'

const WINDOW_MS = 15 * 60 * 1000
const MAX_IP_ATTEMPTS = 20
const MAX_ACCOUNT_ATTEMPTS = 10
const MAX_TRACKED_BUCKETS = 10_000

interface Bucket {
  attempts: number
  expiresAt: number
}

export class AuthorizationRateLimitError extends Error {}

export class AuthorizationAttemptLimiter {
  private readonly ipBuckets = new Map<string, Bucket>()
  private readonly accountBuckets = new Map<string, Bucket>()

  allow(remoteAddress: string, account: string, now = Date.now()): boolean {
    this.prune(now)
    const accountKey = createHash('sha256')
      .update(account.trim().toLowerCase())
      .digest('hex')
    return this.consume(this.ipBuckets, remoteAddress || 'unknown', MAX_IP_ATTEMPTS, now) &&
      this.consume(this.accountBuckets, accountKey, MAX_ACCOUNT_ATTEMPTS, now)
  }

  private consume(
    buckets: Map<string, Bucket>,
    key: string,
    limit: number,
    now: number,
  ): boolean {
    const current = buckets.get(key)
    if (!current || current.expiresAt <= now) {
      if (buckets.size >= MAX_TRACKED_BUCKETS) return false
      buckets.set(key, { attempts: 1, expiresAt: now + WINDOW_MS })
      return true
    }
    if (current.attempts >= limit) return false
    current.attempts += 1
    return true
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.ipBuckets) {
      if (bucket.expiresAt <= now) this.ipBuckets.delete(key)
    }
    for (const [key, bucket] of this.accountBuckets) {
      if (bucket.expiresAt <= now) this.accountBuckets.delete(key)
    }
  }
}

export const authorizationAttemptLimiter = new AuthorizationAttemptLimiter()
