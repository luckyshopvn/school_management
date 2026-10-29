import { startHeartbeat } from './heartbeat.js';
import { createRedisConnection } from './redis-connection.js';
import { consumeGenerationQueue } from './timetable-generation.js';

// Tiến trình chạy nền: máy xếp thời khoá biểu (DT-20 phần 22c2). Mỗi lúc một việc nên lệnh chờ hàng đợi (BLPOP) và lệnh ghi
// tiến độ dùng chung một kết nối
const redis = createRedisConnection();
await redis.ping();
let running = true;
console.log('Tiến trình chạy nền đã kết nối Redis');

const stopped = consumeGenerationQueue(redis, () => running);
// Tín hiệu còn sống cho cổng vận hành (YCTD-376), kết nối riêng vì BLPOP giữ kết nối chính
const heartbeatRedis = createRedisConnection();
const stopHeartbeat = startHeartbeat(heartbeatRedis);

process.on('SIGTERM', () => {
  running = false;
  stopHeartbeat();
  heartbeatRedis.disconnect();
  void stopped.finally(() => redis.disconnect());
});
