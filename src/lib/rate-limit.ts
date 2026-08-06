// Minimal in-memory rate limiter for the handful of genuinely expensive
// public endpoints (external PDF fetches, ZIP bundling) the infrastructure
// audit flagged as possible abuse/egress vectors — see
// docs/PHASE_2_QUERY_REMEDIATION.md item 6.
//
// This is a deliberately dependency-free, best-effort limiter: on Vercel's
// serverless runtime each function instance has its own memory, so a client
// hammering an endpoint across many cold starts or regions won't be caught
// by a single instance's counters. It still stops the common case (one
// instance getting hit repeatedly while warm) without adding a paid
// dependency (Upstash/Vercel KV) — see the remediation doc for the tradeoff
// and the recommended real fix if this becomes a real problem.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Reclaim memory for expired buckets instead of growing forever across a
// long-lived warm instance.
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Fixed-window limiter: at most `limit` calls per `windowSeconds` for a
 * given `key` (typically `${routeName}:${clientIp}`).
 */
export function checkRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true };
}

/** Best-effort client identifier from standard proxy headers (Vercel sets x-forwarded-for). */
export function clientIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
