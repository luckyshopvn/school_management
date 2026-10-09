import { createRedisConnection } from './redis-connection.js';

// Tiến trình chạy nền; các tác vụ được thêm ở các đợt sau
const redis = createRedisConnection();
await redis.ping();
console.log('Tiến trình chạy nền đã kết nối Redis');

process.on('SIGTERM', () => {
  redis.disconnect();
});
