import { Redis } from '@upstash/redis'

const USAGE_HASH_KEY = 'caption-generator:usage-counts'

let redis: Redis | null | undefined

function getRedis(): Redis | null {
  if (redis !== undefined) return redis

  // Support both the native Upstash env var names and the KV_REST_API_*
  // names Vercel's storage integrations commonly inject.
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

  redis = url && token ? new Redis({ url, token }) : null
  return redis
}

/**
 * Increments the usage count for an access code. No-ops (and logs a
 * warning) if Redis isn't configured, so a missing usage store never breaks
 * caption generation itself.
 */
export async function incrementUsage(code: string): Promise<void> {
  const client = getRedis()
  if (!client) {
    console.warn('Usage tracking skipped: Upstash Redis is not configured.')
    return
  }
  await client.hincrby(USAGE_HASH_KEY, code, 1)
}

/**
 * Returns a map of access code -> usage count for every code that has been
 * used at least once. Codes never used won't have an entry.
 */
export async function getUsageCounts(): Promise<Record<string, number>> {
  const client = getRedis()
  if (!client) return {}
  const counts = await client.hgetall<Record<string, number>>(USAGE_HASH_KEY)
  return counts ?? {}
}
