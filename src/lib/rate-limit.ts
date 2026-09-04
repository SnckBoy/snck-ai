import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for single-instance deployments. For multi-instance setups,
 * swap this for a Redis-backed limiter (interface is identical).
 */

interface Bucket {
  timestamps: number[];
}

const store = new Map<string, Bucket>();

function prune(bucket: Bucket, windowMs: number) {
  const cutoff = Date.now() - windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
}

export function rateLimit(opts: RateLimitOptions = {}) {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? Number(process.env.RATE_LIMIT_MAX ?? 60);
  const keyPrefix = opts.keyPrefix ?? 'rl';

  return (req: NextRequest, fallbackKey?: string): NextResponse | null => {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      fallbackKey ??
      'unknown';
    const key = `${keyPrefix}:${ip}`;

    let bucket = store.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      store.set(key, bucket);
    }

    prune(bucket, windowMs);
    if (bucket.timestamps.length >= max) {
      const retryAfter = Math.max(1, Math.ceil((windowMs - (Date.now() - bucket.timestamps[0])) / 1000));
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${retryAfter}s.` },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }

    bucket.timestamps.push(Date.now());
    return null;
  };
}

// Periodically clean up stale keys to avoid unbounded growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store.entries()) {
    if (bucket.timestamps.length === 0) store.delete(key);
    else if (now - bucket.timestamps[bucket.timestamps.length - 1] > 60_000) store.delete(key);
  }
}, 5 * 60_000).unref();
