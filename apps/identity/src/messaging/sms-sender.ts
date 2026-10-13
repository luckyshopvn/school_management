import { Injectable, Logger } from '@nestjs/common';
import { EsmsClient, type EsmsSettings, type SmsProviderSettings } from '@school-management/server';

// Lớp gửi tin nhắn tới số điện thoại; nhà cung cấp thật là eSMS.vn (XT-09, YCTD-43, YCTD-92)
export abstract class SmsSender {
  abstract send(phone: string, text: string): Promise<void>;
}

// Dùng khi phát triển: ghi tin nhắn ra nhật ký máy chủ; cấu hình chặn dùng ở môi trường chạy thật
@Injectable()
export class LoggingSmsSender extends SmsSender {
  private readonly logger = new Logger('SmsSender');

  async send(phone: string, text: string): Promise<void> {
    this.logger.warn(`Chưa nối nhà cung cấp tin nhắn; tin nhắn tới ${phone}: ${text}`);
  }
}

// Gửi tin qua eSMS.vn; lỗi của nhà cung cấp được ném ra để luồng gửi mã đăng nhập báo lỗi (YCTD-92)
export class EsmsSmsSender extends SmsSender {
  private readonly client: EsmsClient;

  constructor(settings: EsmsSettings, fetchFunction: typeof fetch = fetch) {
    super();
    this.client = new EsmsClient(settings, fetchFunction);
  }

  async send(phone: string, text: string): Promise<void> {
    await this.client.send(phone, text);
  }
}

// Chọn lớp gửi theo cấu hình SMS_PROVIDER
export function createSmsSender(settings: SmsProviderSettings): SmsSender {
  return settings.provider === 'esms' ? new EsmsSmsSender(settings.esms) : new LoggingSmsSender();
}

// Dùng khi kiểm thử: giữ tin nhắn trong bộ nhớ để kiểm thử đọc
export class RecordingSmsSender extends SmsSender {
  readonly messages: Array<{ phone: string; text: string }> = [];

  async send(phone: string, text: string): Promise<void> {
    this.messages.push({ phone, text });
  }

  lastTo(phone: string): string | undefined {
    return this.messages.filter((message) => message.phone === phone).at(-1)?.text;
  }
}
