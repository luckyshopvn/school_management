import { Logger } from '@nestjs/common';
import type { FetchFunction } from './facebook-publisher.js';
import type { ZaloTokenStore } from './zalo-token-store.js';

// Lớp gửi tin qua Zalo Official Account (G3-08; YCTD-90, YCTD-92). Khóa truy cập và khóa làm mới lấy từ kho khóa mã hóa ở
// cơ sở dữ liệu hệ thống (ZaloTokenStore), không trả qua API. Bật kết nối thật bằng ZALO_SENDER=zalo_oa cùng ZALO_APP_ID,
// ZALO_APP_SECRET; khi phát triển và kiểm thử đặt ZALO_SENDER=development
export abstract class ZaloSender {
  abstract readonly provider: string;
  abstract readonly available: boolean;
  abstract send(zaloUserId: string, text: string): Promise<void>;
  // Kiểm tra kết nối: đọc thông tin Official Account bằng khóa đang dùng; lỗi thì ném lỗi tiếng Việt
  abstract verify(): Promise<{ oaId: string; name: string }>;
}

export class UnavailableZaloSender extends ZaloSender {
  readonly provider = 'none';
  readonly available = false;

  async send(): Promise<void> {
    throw new Error('Chưa cấu hình kết nối Zalo Official Account');
  }

  async verify(): Promise<{ oaId: string; name: string }> {
    throw new Error('Chưa cấu hình kết nối Zalo Official Account');
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

  async verify(): Promise<{ oaId: string; name: string }> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new Error('Zalo trả lỗi (giả lập)');
    }
    return { oaId: 'development', name: 'Official Account giả lập' };
  }
}

export const ZALO_MESSAGE_URL = 'https://openapi.zalo.me/v3.0/oa/message/cs';
export const ZALO_GET_OA_URL = 'https://openapi.zalo.me/v2.0/oa/getoa';
// Mã lỗi Zalo báo khóa truy cập không hợp lệ hoặc hết hạn: làm mới khóa rồi thử lại một lần
const INVALID_TOKEN_CODES = new Set([-216, -124]);

// Mã lỗi thường gặp của Zalo OpenAPI đổi sang lời báo tiếng Việt; lỗi gửi tin được bộ gửi thông báo ghi lại rồi gửi bằng tin
// nhắn (NotificationDispatcher)
const ZALO_ERRORS: Record<number, string> = {
  [-216]: 'Khóa truy cập Zalo không hợp lệ hoặc đã hết hạn',
  [-124]: 'Khóa truy cập Zalo không hợp lệ hoặc đã hết hạn',
  [-213]: 'Phụ huynh chưa quan tâm Official Account hoặc đã bỏ quan tâm',
  [-230]: 'Phụ huynh chưa tương tác với Official Account trong thời hạn cho phép gửi tin tư vấn',
  [-201]: 'Tham số gửi Zalo không hợp lệ (mã người dùng hoặc nội dung)',
  [-224]: 'Official Account đã hết hạn mức gửi tin của gói dịch vụ',
  [-32]: 'Zalo đang giới hạn số lần gọi, vui lòng thử lại sau',
};

export function zaloErrorMessage(code: number | undefined, message: string | undefined, status: number): string {
  const known = code !== undefined ? ZALO_ERRORS[code] : undefined;
  return `Zalo trả lỗi: ${known ?? message ?? status}${code !== undefined ? ` (mã ${code})` : ''}`;
}

class ZaloApiError extends Error {
  constructor(
    readonly code: number | undefined,
    message: string,
  ) {
    super(message);
  }
}

// Kết nối Official Account: gửi tin tư vấn (API v3.0, loại cs) tới người đã quan tâm. Ngoài thời hạn tương tác Zalo có thể từ
// chối tin tư vấn; lỗi được đổi sang lời báo rõ và bộ gửi thông báo chuyển sang tin nhắn
export class OfficialAccountZaloSender extends ZaloSender {
  readonly provider = 'zalo_oa';
  readonly available = true;

  constructor(
    private readonly tokens: ZaloTokenStore,
    private readonly fetcher: FetchFunction = (input, init) => fetch(input, init),
  ) {
    super();
  }

  async send(zaloUserId: string, text: string): Promise<void> {
    await this.withToken((accessToken) =>
      this.call(ZALO_MESSAGE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', access_token: accessToken },
        body: JSON.stringify({ recipient: { user_id: zaloUserId }, message: { text } }),
      }),
    );
  }

  async verify(): Promise<{ oaId: string; name: string }> {
    const result = await this.withToken((accessToken) =>
      this.call(ZALO_GET_OA_URL, { method: 'GET', headers: { access_token: accessToken } }),
    );
    const data = (result.data ?? {}) as { oa_id?: string | number; name?: string };
    return { oaId: String(data.oa_id ?? ''), name: String(data.name ?? '') };
  }

  // Zalo báo khóa không hợp lệ thì làm mới khóa và thử lại đúng một lần
  private async withToken<T>(action: (accessToken: string) => Promise<T>): Promise<T> {
    const accessToken = await this.tokens.accessToken();
    try {
      return await action(accessToken);
    } catch (error) {
      if (error instanceof ZaloApiError && error.code !== undefined && INVALID_TOKEN_CODES.has(error.code)) {
        return action(await this.tokens.refresh(accessToken));
      }
      throw error;
    }
  }

  private async call(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.fetcher(url, init);
    } catch {
      throw new Error('Không kết nối được tới Zalo, vui lòng thử lại');
    }
    const result = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
      error?: number;
      message?: string;
    };
    if (!response.ok || (result.error !== undefined && result.error !== 0)) {
      throw new ZaloApiError(result.error, zaloErrorMessage(result.error, result.message, response.status));
    }
    return result;
  }
}
