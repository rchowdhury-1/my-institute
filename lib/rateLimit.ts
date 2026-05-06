/**
 * Simple in-memory rate limiter for Next.js API routes.
 *
 * NOTE: This store is per-process. On Vercel (serverless), each function
 * instance has its own store, so limits are per-instance rather than global.
 * For production at scale, replace with an Upstash Redis-backed limiter.
 * For this single-instance deployment (standalone Next.js or Render), it works correctly.
 */

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

export function checkRateLimit(
  ip: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}
