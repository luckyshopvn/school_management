import { Injectable } from '@nestjs/common';
import { ApplicationError, Clock, currentTenant } from '@school-management/server';

// Giới hạn tần suất của học sinh khi làm bài (DT-23 phần 23a, YCTD-211; 15.6 "Tải đồng thời lúc cả khối vào làm bài cùng giờ"):
// lưu nháp và báo sự kiện tối đa 240 yêu cầu mỗi phút cho một học sinh (giao diện gom và chờ 0,8 giây giữa các lần lưu nên dùng
// chừng một phần mười), tối đa 30.000 yêu cầu mỗi phút cho cả trường (khối 400 học sinh làm bài cùng giờ). Cửa sổ cố định, bộ
// đếm giữ trong bộ nhớ của tiến trình máy chủ như bộ giới hạn công khai; mỗi trường một bộ đếm riêng (DT-SaaS phần S1b)
export const EXAM_LIMITS = {
  student: { limit: 240, windowMs: 60_000, message: 'Em gửi quá nhiều yêu cầu, hãy đợi một chút rồi làm tiếp' },
  school: { limit: 30_000, windowMs: 60_000, message: 'Hệ thống thi đang quá tải, hãy đợi một chút rồi làm tiếp' },
} as const;

@Injectable()
export class ExamRateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(private readonly clock: Clock) {}

  hit(childId: string): void {
    const tenant = currentTenant()?.code ?? '';
    this.consume(`${tenant}:school`, EXAM_LIMITS.school);
    this.consume(`${tenant}:student:${childId}`, EXAM_LIMITS.student);
  }

  private consume(key: string, rule: { limit: number; windowMs: number; message: string }): void {
    const now = this.clock.now().getTime();
    const window = this.windows.get(key);
    if (!window || now - window.start >= rule.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      this.prune(now);
      return;
    }
    window.count += 1;
    if (window.count > rule.limit) {
      throw new ApplicationError('ERR_RATE_LIMIT', rule.message);
    }
  }

  // Xóa mọi bộ đếm; dùng trong kiểm thử
  reset(): void {
    this.windows.clear();
  }

  private prune(now: number): void {
    if (this.windows.size < 20_000) {
      return;
    }
    for (const [key, window] of this.windows) {
      if (now - window.start >= EXAM_LIMITS.student.windowMs) {
        this.windows.delete(key);
      }
    }
  }
}
