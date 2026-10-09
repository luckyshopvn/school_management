import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createRedisConnection } from './redis-connection.js';

it('Tiến trình chạy nền kết nối được Redis', async () => {
  const redis = createRedisConnection();
  try {
    assert.equal(await redis.ping(), 'PONG');
  } finally {
    redis.disconnect();
  }
});
