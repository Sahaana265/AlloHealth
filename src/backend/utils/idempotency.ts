import { redis } from '../config/redis';
import { NextResponse } from 'next/server';

export class IdempotencyManager {
  /**
   * Checks if an idempotency key exists. 
   * If it does, returns the cached response.
   * If not, it saves the in-progress status.
   */
  static async check(key: string): Promise<NextResponse | null> {
    const cached = await redis.get<any>(`idempotency:${key}`);
    
    if (cached) {
      if (cached === 'IN_PROGRESS') {
        return NextResponse.json({ error: 'Request already in progress' }, { status: 409 });
      }
      return NextResponse.json(cached.body, { status: cached.status });
    }

    // Mark as in progress with a short TTL (e.g. 1 min)
    await redis.set(`idempotency:${key}`, 'IN_PROGRESS', { ex: 60 });
    return null;
  }

  /**
   * Caches the response for a given idempotency key for 24 hours.
   */
  static async cacheResponse(key: string, body: any, status: number): Promise<void> {
    await redis.set(`idempotency:${key}`, { body, status }, { ex: 60 * 60 * 24 });
  }

  /**
   * Clears an idempotency key in case of failure so it can be retried.
   */
  static async clear(key: string): Promise<void> {
    await redis.del(`idempotency:${key}`);
  }
}
