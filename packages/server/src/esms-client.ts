import { randomUUID } from 'node:crypto';

// Kết nối nhà cung cấp tin nhắn eSMS.vn, dùng chung cho dịch vụ định danh (mã đăng nhập phụ huynh) và máy chủ API
// (thông báo); anh Eric chọn eSMS.vn ngày 2026-10-13 (DT-12 phần 12a, YCTD-92)
export const ESMS_SEND_URL = 'https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/';
// Loại tin 2 là tin chăm sóc khách hàng có tên thương hiệu
const ESMS_BRANDNAME_CARE_TYPE = '2';
const ESMS_SUCCESS_CODE = '100';
const DEFAULT_TIMEOUT_MILLISECONDS = 10_000;

export interface EsmsSettings {
  apiKey: string;
  secretKey: string;
  // Tên thương hiệu đã đăng ký với eSMS.vn
  brandname: string;
  // Gửi thử: eSMS.vn nhận yêu cầu nhưng không gửi tin thật
  sandbox: boolean;
  // Gửi tin có dấu; tin có dấu tốn tiền hơn nên mặc định bỏ dấu
  unicode: boolean;
}

// Nhà cung cấp tin nhắn chọn ở biến SMS_PROVIDER: 'log' chỉ ghi nhật ký khi phát triển, 'esms' là eSMS.vn
export type SmsProviderSettings = { provider: 'log' } | { provider: 'esms'; esms: EsmsSettings };

type Environment = Record<string, string | undefined>;

function readRequired(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}`);
  }
  return value;
}

export function readEsmsSettings(environment: Environment = process.env): EsmsSettings {
  return {
    apiKey: readRequired(environment, 'ESMS_API_KEY'),
    secretKey: readRequired(environment, 'ESMS_SECRET_KEY'),
    brandname: readRequired(environment, 'ESMS_BRANDNAME'),
    sandbox: environment.ESMS_SANDBOX === 'true',
    unicode: environment.ESMS_UNICODE === 'true',
  };
}

// Môi trường chạy thật bắt buộc có nhà cung cấp thật; 'log' chỉ dùng khi phát triển và kiểm thử
export function readSmsProviderSettings(environment: Environment = process.env): SmsProviderSettings {
  const provider = environment.SMS_PROVIDER || 'log';
  if (provider === 'esms') {
    return { provider, esms: readEsmsSettings(environment) };
  }
  if (provider !== 'log') {
    throw new Error(`Nhà cung cấp tin nhắn ${provider} chưa được hỗ trợ`);
  }
  // Hồ sơ thử nghiệm (DT-SaaS phần S9) cho phép ghi mã ra nhật ký khi đặt rõ SMS_ALLOW_LOG=true: chỉ trường dữ liệu giả, người vận
  // hành đọc mã ở nhật ký máy chủ; trường dữ liệu thật cấu hình eSMS
  if (environment.NODE_ENV === 'production' && environment.SMS_ALLOW_LOG !== 'true') {
    throw new Error('Chưa cấu hình nhà cung cấp tin nhắn cho môi trường chạy thật (đặt SMS_PROVIDER=esms)');
  }
  return { provider };
}

// Bỏ dấu tiếng Việt, gồm cả chữ đ; ký tự khác giữ nguyên
export function removeVietnameseDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

// Chuẩn hóa số điện thoại Việt Nam về dạng 84xxxxxxxxx; số không đúng dạng thì báo lỗi, không gửi
export function normalizeVietnamesePhone(phone: string): string {
  const digits = phone.replace(/[\s.()-]/g, '').replace(/^\+/, '');
  if (/^0\d{9}$/.test(digits)) {
    return `84${digits.slice(1)}`;
  }
  if (/^84\d{9}$/.test(digits)) {
    return digits;
  }
  throw new Error(`Số điện thoại ${phone} không đúng dạng số Việt Nam`);
}

interface EsmsResponse {
  CodeResult?: string;
  SMSID?: string;
  ErrorMessage?: string;
}

export class EsmsClient {
  constructor(
    private readonly settings: EsmsSettings,
    private readonly fetchFunction: typeof fetch = fetch,
    private readonly timeoutMilliseconds = DEFAULT_TIMEOUT_MILLISECONDS,
  ) {}

  // Gửi một tin; trả mã tin của eSMS.vn, nhà cung cấp trả mã khác 100 thì báo lỗi kèm mã và nội dung lỗi
  async send(phone: string, text: string): Promise<{ smsId: string | null }> {
    const body = {
      ApiKey: this.settings.apiKey,
      SecretKey: this.settings.secretKey,
      Phone: normalizeVietnamesePhone(phone),
      Content: this.settings.unicode ? text : removeVietnameseDiacritics(text),
      Brandname: this.settings.brandname,
      SmsType: ESMS_BRANDNAME_CARE_TYPE,
      IsUnicode: this.settings.unicode ? '1' : '0',
      Sandbox: this.settings.sandbox ? '1' : '0',
      RequestId: randomUUID(),
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMilliseconds);
    let response: Response;
    try {
      response = await this.fetchFunction(ESMS_SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`eSMS.vn không phản hồi sau ${this.timeoutMilliseconds} ms`, { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      throw new Error(`eSMS.vn trả mã HTTP ${response.status}`);
    }
    const result = (await response.json()) as EsmsResponse;
    if (result.CodeResult !== ESMS_SUCCESS_CODE) {
      throw new Error(`eSMS.vn trả lỗi ${result.CodeResult ?? 'không rõ'}: ${result.ErrorMessage ?? ''}`.trim());
    }
    return { smsId: result.SMSID ?? null };
  }
}
