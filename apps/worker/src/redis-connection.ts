import { Redis } from 'ioredis';

export function createRedisConnection(): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('Thiếu biến môi trường REDIS_URL');
  }
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}
