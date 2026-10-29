import { Logger } from '@nestjs/common';
import { currentTenant, type Clock } from '@school-management/server';
import type { Infrastructure } from '../common/infrastructure.js';
import { SmsSender } from './sms-sender.js';

// Bản trình diễn (DT-18 phần 18h, YCTD-145): lệnh tạo dữ liệu trình diễn ghi cấu hình này ở cơ sở dữ liệu định danh; khi
// có thì không gửi tin nhắn thật (mã đăng nhập một lần, mã đặt lại mật khẩu), chỉ ghi nhật ký máy chủ
export const DEMO_ENVIRONMENT_SETTING_KEY = 'demo_environment';
const CACHE_MILLISECONDS = 30_000;

export class DemoAwareSmsSender extends SmsSender {
  private readonly logger = new Logger('SmsSender');
  // Đệm theo mã trường: mỗi trường có dấu trình diễn riêng ở chế độ nhiều trường
  private readonly cached = new Map<string, { value: boolean; at: number }>();

  constructor(
    private readonly inner: SmsSender,
    private readonly infrastructure: Infrastructure,
    private readonly clock: Clock,
  ) {
    super();
  }

  async send(phone: string, text: string): Promise<void> {
    if (await this.isDemo()) {
      this.logger.warn(`Bản trình diễn: không gửi tin nhắn thật tới ${phone}: ${text}`);
      return;
    }
    await this.inner.send(phone, text);
  }

  private async isDemo(): Promise<boolean> {
    const now = this.clock.now().getTime();
    const school = currentTenant()?.code ?? '';
    const cached = this.cached.get(school);
    if (cached && now - cached.at < CACHE_MILLISECONDS) {
      return cached.value;
    }
    const row = await this.infrastructure.database
      .selectFrom('identity_settings')
      .select('value')
      .where('key', '=', DEMO_ENVIRONMENT_SETTING_KEY)
      .executeTakeFirst();
    const value = row?.value === true;
    this.cached.set(school, { value, at: now });
    return value;
  }
}
