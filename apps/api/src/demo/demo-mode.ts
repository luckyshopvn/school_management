import { Controller, Get, Injectable, Logger } from '@nestjs/common';
import type { DemoAccount } from '@school-management/database';
import { Clock, ruleViolationError } from '@school-management/server';
import { DEMO_PASSWORD } from '@school-management/shared';
import { PublicEndpoint } from '../authentication/authentication.guard.js';
import { Databases } from '../common/databases.js';
import type { FacebookPostInput } from '../integrations/facebook-publisher.js';
import { FacebookPublisher } from '../integrations/facebook-publisher.js';
import { ZaloSender } from '../integrations/zalo-sender.js';
import { SmsGateway } from '../notifications/sms-gateway.js';

// Bản trình diễn (DT-18 phần 18h, YCTD-145). Bật bằng dấu ở cơ sở dữ liệu hệ thống (bảng demo_environment) do lệnh tạo dữ
// liệu trình diễn ghi, không bằng biến môi trường của trường: khi chạy nhiều trường (DT-SaaS S5, dùng thử 30 ngày) mỗi
// trường dùng thử có dấu riêng. Khi bật:
// - không gửi tin nhắn SMS, Zalo, không đăng Fanpage, không tạo mã thanh toán thật, không nhận thông báo tiền vào của cổng
//   thanh toán; tin bị chặn chỉ ghi nhật ký máy chủ và vẫn đánh dấu đã gửi để luồng nghiệp vụ chạy như thật;
// - cổng quản trị, ứng dụng giáo viên, phụ huynh hiện dải "Bản trình diễn" và trang chọn vai.
export const DEMO_RULE_CODE = 'YCTD-145';
const CACHE_MILLISECONDS = 30_000;

export interface DemoStatus {
  enabled: boolean;
  seeded_at: Date | null;
  next_reset_at: Date | null;
  reset_interval_hours: number | null;
  accounts: DemoAccount[];
}

const DISABLED: DemoStatus = {
  enabled: false,
  seeded_at: null,
  next_reset_at: null,
  reset_interval_hours: null,
  accounts: [],
};

@Injectable()
export class DemoMode {
  private cached: { status: DemoStatus; at: number } | null = null;

  constructor(
    private readonly databases: Databases,
    private readonly clock: Clock,
  ) {}

  async status(): Promise<DemoStatus> {
    const now = this.clock.now().getTime();
    if (this.cached && now - this.cached.at < CACHE_MILLISECONDS) {
      return this.cached.status;
    }
    const row = await this.databases.system.selectFrom('demo_environment').selectAll().executeTakeFirst();
    const status: DemoStatus = row
      ? {
          enabled: true,
          seeded_at: row.seeded_at,
          next_reset_at: row.next_reset_at,
          reset_interval_hours: row.reset_interval_hours,
          accounts: row.accounts,
        }
      : DISABLED;
    this.cached = { status, at: now };
    return status;
  }

  async isEnabled(): Promise<boolean> {
    return (await this.status()).enabled;
  }

  // Thao tác cần hệ thống ngoài thật: bản trình diễn báo lỗi nghiệp vụ
  async assertLive(action: string): Promise<void> {
    if (await this.isEnabled()) {
      throw ruleViolationError(DEMO_RULE_CODE, `Bản trình diễn không ${action}`);
    }
  }
}

// Trang đăng nhập, dải trình diễn đọc điểm cuối công khai này; mật khẩu chung của tài khoản trình diễn là dữ liệu giả
@Controller('public/demo')
export class DemoController {
  constructor(private readonly demoMode: DemoMode) {}

  @Get()
  @PublicEndpoint()
  async status() {
    const status = await this.demoMode.status();
    return { ...status, password: status.enabled ? DEMO_PASSWORD : null };
  }
}

export class DemoAwareSmsGateway extends SmsGateway {
  private readonly logger = new Logger('SmsGateway');

  constructor(
    readonly inner: SmsGateway,
    private readonly demoMode: DemoMode,
  ) {
    super();
  }

  async send(phone: string, text: string): Promise<void> {
    if (await this.demoMode.isEnabled()) {
      this.logger.warn(`Bản trình diễn: không gửi tin nhắn thật tới ${phone}: ${text}`);
      return;
    }
    await this.inner.send(phone, text);
  }
}

export class DemoAwareZaloSender extends ZaloSender {
  private readonly logger = new Logger('ZaloSender');

  constructor(
    readonly inner: ZaloSender,
    private readonly demoMode: DemoMode,
  ) {
    super();
  }

  get provider(): string {
    return this.inner.provider;
  }

  get available(): boolean {
    return this.inner.available;
  }

  async send(zaloUserId: string, text: string): Promise<void> {
    if (await this.demoMode.isEnabled()) {
      this.logger.warn(`Bản trình diễn: không gửi tin Zalo thật tới ${zaloUserId}: ${text}`);
      return;
    }
    await this.inner.send(zaloUserId, text);
  }

  async verify(): Promise<{ oaId: string; name: string }> {
    await this.demoMode.assertLive('kết nối Zalo Official Account thật');
    return this.inner.verify();
  }
}

export class DemoAwareFacebookPublisher extends FacebookPublisher {
  constructor(
    readonly inner: FacebookPublisher,
    private readonly demoMode: DemoMode,
  ) {
    super();
  }

  get provider(): string {
    return this.inner.provider;
  }

  get available(): boolean {
    return this.inner.available;
  }

  async publish(input: FacebookPostInput): Promise<{ postId: string }> {
    await this.demoMode.assertLive('đăng bài lên Fanpage thật');
    return this.inner.publish(input);
  }

  async verify(pageId: string): Promise<{ id: string; name: string }> {
    await this.demoMode.assertLive('kết nối Fanpage thật');
    return this.inner.verify(pageId);
  }
}
