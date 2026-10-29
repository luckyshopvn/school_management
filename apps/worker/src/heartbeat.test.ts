import assert from 'node:assert/strict';
import { it } from 'node:test';
import { WORKER_HEARTBEAT_KEY, WORKER_HEARTBEAT_TTL_SECONDS } from '@school-management/server/service-status';
import { writeHeartbeat } from './heartbeat.js';
import { createRedisConnection } from './redis-connection.js';

// Tín hiệu còn sống của tiến trình nền (YCTD-376), kịch bản CT-376-2: ghi giờ dạng ISO, hết hạn sau một ngày
it('tiến trình nền ghi tín hiệu còn sống vào Redis', async () => {
  const redis = createRedisConnection();
  try {
    const at = new Date('2030-01-02T03:04:05.000Z');
    await writeHeartbeat(redis, at);
    assert.equal(await redis.get(WORKER_HEARTBEAT_KEY), at.toISOString());
    const ttl = await redis.ttl(WORKER_HEARTBEAT_KEY);
    assert.ok(ttl > WORKER_HEARTBEAT_TTL_SECONDS - 10 && ttl <= WORKER_HEARTBEAT_TTL_SECONDS, String(ttl));
  } finally {
    redis.disconnect();
  }
});
