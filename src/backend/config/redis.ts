import { Redis } from '@upstash/redis';

// Determine if we are on server or edge environment
// In local dev without env vars, this will fail if used before initialized
const getRedisClient = () => {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Upstash Redis credentials are not defined.');
  }
  
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  });
};

export const redis = getRedisClient();
