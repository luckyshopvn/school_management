import { Injectable } from '@nestjs/common';
import { ApplicationError, Clock, currentTenant } from '@school-management/server';

// Giới hạn số yêu cầu theo địa chỉ mạng cho điểm cuối công khai không cần đăng nhập (P16; YCTD-86), cùng cách cửa sổ cố
// định như khóa API đối tác: nộp hồ sơ tối đa 10 lần mỗi giờ, đọc tin và tra cứu tối đa 60 lần mỗi phút trên một địa chỉ.
// Bộ đếm giữ trong bộ nhớ của tiến trình máy chủ; khởi động lại thì đếm lại
export const PUBLIC_LIMITS = {
  submit: { limit: 10, windowMs: 60 * 60_000, message: 'Mỗi địa chỉ mạng nộp tối đa 10 hồ sơ mỗi giờ' },
  read: { limit: 60, windowMs: 60_000, message: 'Mỗi địa chỉ mạng tối đa 60 yêu cầu mỗi phút' },
} as const;

@Injectable()
export class AdmissionsRateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(private readonly clock: Clock) {}

  hit(kind: keyof typeof PUBLIC_LIMITS, ip: string | undefined): void {
    const rule = PUBLIC_LIMITS[kind];
    // Mỗi trường một bộ đếm riêng (DT-SaaS phần S1b): cùng địa chỉ mạng gọi hai trường không dùng chung hạn mức
    const key = `${currentTenant()?.code ?? ''}:${kind}:${ip ?? 'unknown'}`;
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

  // Bỏ cửa sổ đã hết hạn để bộ nhớ không tăng mãi
  private prune(now: number): void {
    if (this.windows.size < 10_000) {
      return;
    }
    for (const [key, window] of this.windows) {
      if (now - window.start >= PUBLIC_LIMITS.submit.windowMs) {
        this.windows.delete(key);
      }
    }
  }
}
