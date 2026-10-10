import { Injectable, Logger } from '@nestjs/common';

// Lớp gửi tin nhắn tới số điện thoại; nhà cung cấp thật nối khi có tài khoản ở việc T1 (XT-09, YCTD-43)
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
