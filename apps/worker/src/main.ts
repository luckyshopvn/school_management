import { createRedisConnection } from './redis-connection.js';
import { consumeGenerationQueue } from './timetable-generation.js';

// Tiến trình chạy nền: máy xếp thời khoá biểu (DT-20 phần 22c2). Mỗi lúc một việc nên lệnh chờ hàng đợi (BLPOP) và lệnh ghi
// tiến độ dùng chung một kết nối
const redis = createRedisConnection();
await redis.ping();
let running = true;
console.log('Tiến trình chạy nền đã kết nối Redis');

const stopped = consumeGenerationQueue(redis, () => running);

process.on('SIGTERM', () => {
  running = false;
  void stopped.finally(() => redis.disconnect());
});
