import { Injectable, Logger } from '@nestjs/common';
import { EsmsClient, type EsmsSettings, type SmsProviderSettings } from '@school-management/server';

// Lớp gửi tin nhắn thông báo tới số điện thoại; nhà cung cấp thật là eSMS.vn (YCTD-71, YCTD-92)
export abstract class SmsGateway {
  abstract send(phone: string, text: string): Promise<void>;
}

// Dùng khi phát triển và kiểm thử: ghi tin nhắn ra nhật ký máy chủ; cấu hình chặn dùng ở môi trường chạy thật
@Injectable()
export class LoggingSmsGateway extends SmsGateway {
  private readonly logger = new Logger('SmsGateway');

  async send(phone: string, text: string): Promise<void> {
    this.logger.warn(`Chưa nối nhà cung cấp tin nhắn; tin nhắn tới ${phone}: ${text}`);
  }
}

// Gửi tin qua eSMS.vn; lỗi của nhà cung cấp được ném ra để tiến trình gửi thông báo ghi lỗi và thử lại (YCTD-92)
export class EsmsSmsGateway extends SmsGateway {
  private readonly client: EsmsClient;

  constructor(settings: EsmsSettings, fetchFunction: typeof fetch = fetch) {
    super();
    this.client = new EsmsClient(settings, fetchFunction);
  }

  async send(phone: string, text: string): Promise<void> {
    await this.client.send(phone, text);
  }
}

// Chọn lớp gửi theo cấu hình SMS_PROVIDER; chưa cấu hình thì ghi nhật ký
export function createSmsGateway(settings: SmsProviderSettings | undefined): SmsGateway {
  return settings?.provider === 'esms' ? new EsmsSmsGateway(settings.esms) : new LoggingSmsGateway();
}

// Dùng khi kiểm thử: giữ tin nhắn trong bộ nhớ; đặt số lần lỗi để giả lập nhà cung cấp trả lỗi
export class RecordingSmsGateway extends SmsGateway {
  readonly messages: Array<{ phone: string; text: string }> = [];
  failuresLeft = 0;

  async send(phone: string, text: string): Promise<void> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new Error('Nhà cung cấp tin nhắn trả lỗi');
    }
    this.messages.push({ phone, text });
  }
}
