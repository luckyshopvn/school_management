import { Logger } from '@nestjs/common';
import type { Clock } from '@school-management/server';
import type { Infrastructure } from '../common/infrastructure.js';
import { SmsSender } from './sms-sender.js';

// Bản trình diễn (DT-18 phần 18h, YCTD-145): lệnh tạo dữ liệu trình diễn ghi cấu hình này ở cơ sở dữ liệu định danh; khi
// có thì không gửi tin nhắn thật (mã đăng nhập một lần, mã đặt lại mật khẩu), chỉ ghi nhật ký máy chủ
export const DEMO_ENVIRONMENT_SETTING_KEY = 'demo_environment';
const CACHE_MILLISECONDS = 30_000;

export class DemoAwareSmsSender extends SmsSender {
  private readonly logger = new Logger('SmsSender');
  private cached: { value: boolean; at: number } | null = null;

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
    if (this.cached && now - this.cached.at < CACHE_MILLISECONDS) {
      return this.cached.value;
    }
    const row = await this.infrastructure.database
      .selectFrom('identity_settings')
      .select('value')
      .where('key', '=', DEMO_ENVIRONMENT_SETTING_KEY)
      .executeTakeFirst();
    const value = row?.value === true;
    this.cached = { value, at: now };
    return value;
  }
}
