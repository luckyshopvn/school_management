import { Logger } from '@nestjs/common';

// Lớp gửi tin qua Zalo Official Account (G3-08; YCTD-90). Khóa truy cập chỉ đọc từ biến môi trường ZALO_OA_ACCESS_TOKEN,
// không lưu trong cơ sở dữ liệu và không trả qua API. Kết nối thật dùng khi trường có Official Account đã xác thực (việc T7);
// khi phát triển và kiểm thử đặt ZALO_SENDER=development
export abstract class ZaloSender {
  abstract readonly provider: string;
  abstract readonly available: boolean;
  abstract send(zaloUserId: string, text: string): Promise<void>;
}

export class UnavailableZaloSender extends ZaloSender {
  readonly provider = 'none';
  readonly available = false;

  async send(): Promise<void> {
    throw new Error('Chưa cấu hình khóa truy cập Zalo Official Account');
  }
}

// Bộ giả lập: ghi tin ra nhật ký máy chủ và giữ trong bộ nhớ; đặt failuresLeft để giả lập Zalo trả lỗi
export class DevelopmentZaloSender extends ZaloSender {
  readonly provider = 'development';
  readonly available = true;
  readonly messages: Array<{ zaloUserId: string; text: string }> = [];
  failuresLeft = 0;
  private readonly logger = new Logger('ZaloSender');

  async send(zaloUserId: string, text: string): Promise<void> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new Error('Zalo trả lỗi (giả lập)');
    }
    this.messages.push({ zaloUserId, text });
    this.logger.warn(`Giả lập gửi Zalo tới ${zaloUserId}: ${text}`);
  }
}

// Kết nối Official Account: gửi tin tư vấn tới người đã quan tâm. Khóa truy cập của Zalo hết hạn theo giờ nên khi triển khai
// thật cần thêm bước làm mới khóa (việc T7); chưa kiểm thử với tài khoản thật
export class OfficialAccountZaloSender extends ZaloSender {
  readonly provider = 'zalo_oa';
  readonly available = true;

  constructor(private readonly accessToken: string) {
    super();
  }

  async send(zaloUserId: string, text: string): Promise<void> {
    const response = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', access_token: this.accessToken },
      body: JSON.stringify({ recipient: { user_id: zaloUserId }, message: { text } }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: number; message?: string };
    if (!response.ok || (result.error !== undefined && result.error !== 0)) {
      throw new Error(`Zalo trả lỗi: ${result.message ?? response.status}`);
    }
  }
}
