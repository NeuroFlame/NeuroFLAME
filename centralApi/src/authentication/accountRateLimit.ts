import { createHash } from 'node:crypto'
import { GraphQLError, GraphQLSchema, defaultFieldResolver } from 'graphql'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const policies: Record<string, { limit: number; windowMs: number; accountLimit?: number }> = {
  login: { limit: 30, windowMs: 15 * MINUTE, accountLimit: 10 },
  userCreate: { limit: 5, windowMs: HOUR },
  requestPasswordReset: { limit: 5, windowMs: HOUR, accountLimit: 3 },
  resetPassword: { limit: 20, windowMs: 15 * MINUTE },
  userChangePassword: { limit: 10, windowMs: 15 * MINUTE },
  adminChangeUserPassword: { limit: 20, windowMs: 15 * MINUTE },
  adminCreateVaultUser: { limit: 20, windowMs: 15 * MINUTE },
}

const limited = (retryAfterSeconds: number): GraphQLError => new GraphQLError(
  'Too many account requests. Please try again later.',
  { extensions: { code: 'TOO_MANY_REQUESTS', retryAfterSeconds } },
)

export const createAccountRateLimiter = ({ now = Date.now, maxBuckets = 20_000 } = {}) => {
  const buckets = new Map<string, { count: number; expiresAt: number }>()
  let nextSweep = 0
  return {
    check(operation: string, clientAddress: string, account?: string): void {
      const policy = policies[operation]
      if (!policy) return
      const time = now()
      if (time >= nextSweep) {
        for (const [key, bucket] of buckets) if (bucket.expiresAt <= time) buckets.delete(key)
        nextSweep = time + MINUTE
      }
      // Keys never contain credentials, reset tokens or email addresses.
      const client = createHash('sha256').update(clientAddress).digest('hex')
      const checks = [
        { key: `all:${client}`, limit: 60, windowMs: 15 * MINUTE },
        { key: `${operation}:${client}`, ...policy },
      ]
      if (account && policy.accountLimit) {
        const target = createHash('sha256').update(account.trim().toLowerCase()).digest('hex')
        checks.push({ key: `${operation}:${client}:${target}`, ...policy, limit: policy.accountLimit })
      }
      for (const check of checks) {
        const bucket = buckets.get(check.key)
        if (bucket && bucket.expiresAt > time && bucket.count >= check.limit) {
          throw limited(Math.max(1, Math.ceil((bucket.expiresAt - time) / 1000)))
        }
      }
      const missing = checks.filter(({ key }) => !buckets.has(key)).length
      // Never evict active quotas to make room: rotating targets must not reset limits.
      if (buckets.size + missing > maxBuckets) throw limited(60)
      for (const check of checks) {
        const bucket = buckets.get(check.key)
        if (!bucket || bucket.expiresAt <= time) {
          buckets.set(check.key, { count: 1, expiresAt: time + check.windowMs })
        } else { bucket.count++ }
      }
    },
  }
}

export const installAccountRateLimits = (
  schema: GraphQLSchema,
  limiter = createAccountRateLimiter(),
): void => {
  const fields = schema.getMutationType()?.getFields()
  for (const operation of Object.keys(policies)) {
    const field = fields?.[operation]
    if (!field) continue
    const resolve = field.resolve ?? defaultFieldResolver
    field.resolve = (source, args, context, info) => {
      limiter.check(operation, context?.clientAddress ?? 'unknown', args.username)
      return resolve(source, args, context, info)
    }
  }
}
