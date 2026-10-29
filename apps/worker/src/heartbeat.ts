import type { Redis } from 'ioredis';
import {
  WORKER_HEARTBEAT_KEY,
  WORKER_HEARTBEAT_SECONDS,
  WORKER_HEARTBEAT_TTL_SECONDS,
} from '@school-management/server/service-status';

// Tín hiệu còn sống của tiến trình nền cho khối "Tình trạng dịch vụ" của cổng vận hành (YCTD-376): ghi giờ hiện tại vào Redis mỗi 30
// giây. Lệnh chờ hàng đợi (BLPOP) giữ kết nối chính tới 5 giây nên tín hiệu dùng kết nối riêng
export async function writeHeartbeat(connection: Pick<Redis, 'set'>, now: Date = new Date()): Promise<void> {
  await connection.set(WORKER_HEARTBEAT_KEY, now.toISOString(), 'EX', WORKER_HEARTBEAT_TTL_SECONDS);
}

export function startHeartbeat(connection: Pick<Redis, 'set'>): () => void {
  const beat = () =>
    void writeHeartbeat(connection).catch((error: unknown) =>
      console.warn(`Không ghi được tín hiệu còn sống: ${error instanceof Error ? error.message : String(error)}`),
    );
  beat();
  const timer = setInterval(beat, WORKER_HEARTBEAT_SECONDS * 1000);
  return () => clearInterval(timer);
}
