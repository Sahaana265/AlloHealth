import { redis } from '../config/redis';
import { v4 as uuidv4 } from 'uuid';

/**
 * A simple distributed lock implementation using Upstash Redis.
 */
export class RedisLock {
  private key: string;
  private token: string;
  private ttlSeconds: number;

  constructor(resource: string, ttlSeconds: number = 30) {
    this.key = `lock:${resource}`;
    this.token = uuidv4();
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Attempts to acquire the lock.
   * Returns true if acquired, false otherwise.
   */
  async acquire(): Promise<boolean> {
    try {
      // NX ensures SET only succeeds if key doesn't exist.
      // EX sets expiry in seconds.
      const result = await redis.set(this.key, this.token, {
        nx: true,
        ex: this.ttlSeconds,
      });

      return result === 'OK';
    } catch (error) {
      console.error(`Failed to acquire lock for ${this.key}:`, error);
      return false;
    }
  }

  /**
   * Releases the lock using a Lua script to ensure we only delete it
   * if the token matches (preventing us from deleting someone else's lock
   * if our lock expired and was acquired by another process).
   */
  async release(): Promise<void> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      await redis.eval(script, [this.key], [this.token]);
    } catch (error) {
      console.error(`Failed to release lock for ${this.key}:`, error);
    }
  }
}
