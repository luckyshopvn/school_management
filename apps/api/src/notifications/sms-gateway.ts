import { Injectable, Logger } from '@nestjs/common';

// Lớp gửi tin nhắn thông báo tới số điện thoại; nhà cung cấp thật nối khi có tài khoản ở việc T1 (YCTD-71)
export abstract class SmsGateway {
  abstract send(phone: string, text: string): Promise<void>;
}

// Dùng khi phát triển và tới khi chọn xong nhà cung cấp: ghi tin nhắn ra nhật ký máy chủ
@Injectable()
export class LoggingSmsGateway extends SmsGateway {
  private readonly logger = new Logger('SmsGateway');

  async send(phone: string, text: string): Promise<void> {
    this.logger.warn(`Chưa nối nhà cung cấp tin nhắn; tin nhắn tới ${phone}: ${text}`);
  }
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
