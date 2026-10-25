import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { ruleViolationError } from '@school-management/server';
import type { IncomingTransfer } from './online-payments.service.js';
import {
  DevelopmentPaymentGateway,
  PaymentGateway,
  VietQrStaticPaymentGateway,
  vietQrContent,
  type CreatedPaymentRequest,
  type PaymentProviderCode,
  type PaymentRequestInput,
} from './payment-gateway.js';

// Các nhà cung cấp thanh toán thật do Eric chọn ngày 2026-10-13: PayOS, SePay, Casso, VNPay (DT-12 phần 12b, YCTD-92).
// Làm theo tài liệu công khai của từng nhà cung cấp; khóa chỉ đặt ở biến môi trường, không lưu trong cơ sở dữ liệu.
// Chưa thử với tài khoản thật

export interface PayosSettings {
  clientId: string;
  apiKey: string;
  checksumKey: string;
  returnUrl: string;
  cancelUrl: string;
  apiUrl: string;
}

export interface SepaySettings {
  webhookApiKey: string;
}

export interface CassoSettings {
  webhookSecret: string;
}

export interface VnpaySettings {
  tmnCode: string;
  hashSecret: string;
  returnUrl: string;
  paymentUrl: string;
  expireMinutes: number;
}

export interface PaymentProviderSettings {
  payos?: PayosSettings;
  sepay?: SepaySettings;
  casso?: CassoSettings;
  vnpay?: VnpaySettings;
}

// Yêu cầu thông báo tiền vào nhà cung cấp gửi tới điểm cuối công khai
export interface WebhookRequest {
  headers: IncomingHttpHeaders;
  body: unknown;
}

// Chữ ký hoặc khóa của thông báo không đúng: từ chối, không ghi giao dịch
export class WebhookAuthenticationError extends Error {}

// Cổng có điểm cuối nhận thông báo tiền vào; trả danh sách giao dịch tiền vào (trống là bỏ qua, ví dụ tiền ra)
export abstract class WebhookPaymentGateway extends PaymentGateway {
  readonly supportsWebhook = true;
  abstract parseWebhook(request: WebhookRequest, now: Date): IncomingTransfer[];
}

export function isWebhookGateway(gateway: PaymentGateway): gateway is WebhookPaymentGateway {
  return typeof (gateway as Partial<WebhookPaymentGateway>).parseWebhook === 'function';
}

const hmacHex = (algorithm: 'sha256' | 'sha512', key: string, text: string) =>
  createHmac(algorithm, key).update(text, 'utf8').digest('hex');

// So sánh chữ ký hệ 16 không lộ thời gian, không phân biệt hoa thường
export function sameSignature(expected: string, received: string | undefined | null): boolean {
  if (!received) {
    return false;
  }
  const left = Buffer.from(expected.toLowerCase(), 'utf8');
  const right = Buffer.from(received.toLowerCase(), 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

const headerOf = (headers: IncomingHttpHeaders, name: string): string | undefined => {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const textOf = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

// Số tiền nguyên dương; số tiền khác thì không ghi giao dịch
const amountOf = (value: unknown): number | null => {
  const amount = typeof value === 'string' ? Number(value) : value;
  return typeof amount === 'number' && Number.isSafeInteger(amount) && amount > 0 ? amount : null;
};

// Thời điểm giao dịch các nhà cung cấp ghi theo giờ Việt Nam dạng `yyyy-MM-dd HH:mm:ss`; đọc không được thì lấy giờ nhận
export function parseVietnamDateTime(value: unknown, fallback: Date): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(textOf(value).trim());
  if (!match) {
    return fallback;
  }
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second ?? '00'}+07:00`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

// ---------- PayOS (payos.vn/docs) ----------

// Chuỗi ký của dữ liệu PayOS: các khóa xếp theo bảng chữ cái, `khóa=giá trị` nối bằng `&`; null, undefined thành chuỗi
// rỗng; mảng ghi dạng JSON các phần tử đã xếp khóa (theo thư viện payos-node)
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])]),
    );
  }
  return value;
}

export function payosDataString(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .filter((key) => data[key] !== undefined)
    .map((key) => {
      let value = data[key];
      if (Array.isArray(value)) {
        value = JSON.stringify(sortKeys(value));
      }
      if (value === null || value === undefined || value === 'null' || value === 'undefined') {
        value = '';
      }
      return `${key}=${String(value)}`;
    })
    .join('&');
}

export function payosSignature(checksumKey: string, data: Record<string, unknown>): string {
  return hmacHex('sha256', checksumKey, payosDataString(data));
}

// Mã đơn hàng PayOS là số nguyên dương duy nhất: mili giây hiện tại nhân 1000 cộng số ngẫu nhiên, nhỏ hơn
// Number.MAX_SAFE_INTEGER đến năm 2255
export function payosOrderCode(now: Date): number {
  return now.getTime() * 1000 + randomInt(0, 1000);
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export class PayosPaymentGateway extends WebhookPaymentGateway {
  readonly provider = 'payos';
  readonly label = 'PayOS (mã QR theo đơn, báo tiền vào tự động)';

  constructor(
    private readonly settings: PayosSettings,
    private readonly fetcher: FetchLike = (url, init) => fetch(url, init),
    private readonly clock: () => Date = () => new Date(),
  ) {
    super();
  }

  async createPaymentRequest(input: PaymentRequestInput): Promise<CreatedPaymentRequest> {
    const orderCode = payosOrderCode(this.clock());
    // PayOS giới hạn mô tả 25 ký tự với tài khoản không liên kết; nội dung chuyển khoản là mã hóa đơn bỏ gạch
    const description = input.transferContent.slice(0, 25);
    const signed = {
      amount: input.amount,
      cancelUrl: this.settings.cancelUrl,
      description,
      orderCode,
      returnUrl: this.settings.returnUrl,
    };
    const body = { ...signed, signature: payosSignature(this.settings.checksumKey, signed) };
    let result: unknown;
    try {
      const response = await this.fetcher(`${this.settings.apiUrl}/v2/payment-requests`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-client-id': this.settings.clientId,
          'x-api-key': this.settings.apiKey,
        },
        body: JSON.stringify(body),
      });
      result = await response.json();
    } catch {
      throw ruleViolationError('P06-11', 'Không kết nối được cổng PayOS, vui lòng thử lại');
    }
    const data = isRecord(result) && isRecord(result.data) ? result.data : null;
    if (!isRecord(result) || result.code !== '00' || !data || typeof data.qrCode !== 'string') {
      const reason = isRecord(result) && typeof result.desc === 'string' ? `: ${result.desc}` : '';
      throw ruleViolationError('P06-11', `Cổng PayOS không tạo được mã thanh toán${reason}`);
    }
    return {
      provider: this.provider,
      providerReference: String(orderCode),
      virtualAccountNumber: textOf(data.accountNumber) || input.receivingAccountNumber,
      qrContent: data.qrCode,
      expiresAt: null,
    };
  }

  // Thông báo PayOS: {code, desc, success, data, signature}; chữ ký là HMAC-SHA256 của dữ liệu `data`
  parseWebhook(request: WebhookRequest, now: Date): IncomingTransfer[] {
    const body = request.body;
    if (!isRecord(body) || !isRecord(body.data) || typeof body.signature !== 'string') {
      throw new WebhookAuthenticationError('Thông báo PayOS thiếu dữ liệu hoặc chữ ký');
    }
    const data = body.data;
    if (!sameSignature(payosSignature(this.settings.checksumKey, data), body.signature)) {
      throw new WebhookAuthenticationError('Chữ ký thông báo PayOS không đúng');
    }
    const amount = amountOf(data.amount);
    if (body.success === false || textOf(body.code) !== '00' || amount === null) {
      return [];
    }
    const orderCode = textOf(data.orderCode);
    const reference = textOf(data.reference) || `${textOf(data.paymentLinkId)}-${orderCode}`;
    return [
      {
        provider: this.provider,
        providerTransactionRef: `payos-${reference}`,
        providerReference: orderCode || null,
        virtualAccountNumber: null,
        amount,
        transferContent: textOf(data.description),
        receivedAt: parseVietnamDateTime(data.transactionDateTime, now),
      },
    ];
  }
}

// ---------- SePay (docs.sepay.vn) ----------

// Mã VietQR tĩnh tới tài khoản thật của trường; SePay theo dõi tài khoản và báo tiền vào
function staticVietQr(provider: string, input: PaymentRequestInput, reference: string): CreatedPaymentRequest {
  if (!input.receivingBankBin || !input.receivingAccountNumber) {
    throw ruleViolationError('P06-11', 'Tài khoản nhận chưa khai mã BIN ngân hàng hoặc số tài khoản để dựng mã VietQR');
  }
  return {
    provider,
    providerReference: reference,
    virtualAccountNumber: input.receivingAccountNumber,
    qrContent: vietQrContent({
      bankBin: input.receivingBankBin,
      accountNumber: input.receivingAccountNumber,
      amount: input.amount,
      content: input.transferContent,
    }),
    expiresAt: null,
  };
}

export class SepayPaymentGateway extends WebhookPaymentGateway {
  readonly provider = 'sepay';
  readonly label = 'SePay (VietQR, báo tiền vào tự động)';
  override readonly requiresBankBin = true;

  constructor(private readonly settings: SepaySettings) {
    super();
  }

  async createPaymentRequest(input: PaymentRequestInput): Promise<CreatedPaymentRequest> {
    return staticVietQr(this.provider, input, `${input.transferContent}-${Date.now()}`);
  }

  // Thông báo SePay xác thực bằng tiêu đề `Authorization: Apikey <khóa>`; giao dịch tiền ra thì bỏ qua
  parseWebhook(request: WebhookRequest, now: Date): IncomingTransfer[] {
    const authorization = headerOf(request.headers, 'authorization') ?? '';
    const match = /^Apikey\s+(.+)$/i.exec(authorization.trim());
    if (!match || !sameSignature(this.settings.webhookApiKey, match[1]?.trim())) {
      throw new WebhookAuthenticationError('Khóa thông báo SePay không đúng');
    }
    const body = request.body;
    if (!isRecord(body) || body.id === undefined || body.id === null) {
      return [];
    }
    const amount = amountOf(body.transferAmount);
    if (body.transferType !== 'in' || amount === null) {
      return [];
    }
    return [
      {
        provider: this.provider,
        providerTransactionRef: `sepay-${textOf(body.id)}`,
        virtualAccountNumber: null,
        amount,
        transferContent: textOf(body.content) || textOf(body.description),
        receivedAt: parseVietnamDateTime(body.transactionDate, now),
      },
    ];
  }
}

// ---------- Casso (developer.casso.vn, Webhook V2) ----------

// Xếp khóa theo bảng chữ cái ở mọi cấp như mẫu của Casso (github.com/CassoHQ/casso-webhook-v2-verify-signature); null
// giữ nguyên, mảng giữ thứ tự phần tử
export function cassoSortedJson(value: unknown, asciiOnly = false): string {
  const json = JSON.stringify(sortKeys(value));
  // Mẫu python của Casso ghi ký tự ngoài ASCII dạng \uXXXX (json.dumps mặc định)
  return asciiOnly
    ? json.replace(/[\u0080-￿]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
    : json;
}

export function cassoSignature(secret: string, timestamp: string, body: unknown, asciiOnly = false): string {
  return hmacHex('sha512', secret, `${timestamp}.${cassoSortedJson(body, asciiOnly)}`);
}

export class CassoPaymentGateway extends WebhookPaymentGateway {
  readonly provider = 'casso';
  readonly label = 'Casso (VietQR, báo tiền vào tự động)';
  override readonly requiresBankBin = true;

  constructor(private readonly settings: CassoSettings) {
    super();
  }

  async createPaymentRequest(input: PaymentRequestInput): Promise<CreatedPaymentRequest> {
    return staticVietQr(this.provider, input, `${input.transferContent}-${Date.now()}`);
  }

  // Tiêu đề `X-Casso-Signature: t=<thời điểm>,v1=<chữ ký>`; chữ ký là HMAC-SHA512 hệ 16 của `t.JSON thân đã xếp khóa`
  parseWebhook(request: WebhookRequest, now: Date): IncomingTransfer[] {
    const header = headerOf(request.headers, 'x-casso-signature') ?? '';
    const match = /t=(\d+),v1=([a-fA-F0-9]+)/.exec(header);
    // Chưa rõ máy chủ Casso ghi chữ có dấu nguyên dạng hay dạng \uXXXX nên chấp nhận cả hai cách
    const valid =
      match !== null &&
      [false, true].some((asciiOnly) =>
        sameSignature(cassoSignature(this.settings.webhookSecret, match[1] ?? '', request.body, asciiOnly), match[2]),
      );
    if (!valid) {
      throw new WebhookAuthenticationError('Chữ ký thông báo Casso không đúng');
    }
    const body = request.body;
    if (!isRecord(body) || (body.error !== undefined && Number(body.error) !== 0)) {
      return [];
    }
    // Webhook V2 gửi một giao dịch; bản cũ gửi mảng giao dịch
    const rows = Array.isArray(body.data) ? body.data : [body.data];
    return rows.flatMap((row): IncomingTransfer[] => {
      const amount = isRecord(row) ? amountOf(row.amount) : null;
      if (!isRecord(row) || amount === null || row.id === undefined || row.id === null) {
        return [];
      }
      return [
        {
          provider: this.provider,
          providerTransactionRef: `casso-${textOf(row.id)}`,
          virtualAccountNumber: null,
          amount,
          transferContent: textOf(row.description),
          receivedAt: parseVietnamDateTime(row.transactionDateTime ?? row.when, now),
        },
      ];
    });
  }
}

// ---------- VNPay (sandbox.vnpayment.vn/apis) ----------

// Giá trị mã hóa URL, khoảng trắng thành dấu cộng như mẫu của VNPay
const vnpayEncode = (value: string) => encodeURIComponent(value).replace(/%20/g, '+');

// Chuỗi ký của VNPay: các tham số vnp_ xếp theo tên, `tên=giá trị đã mã hóa` nối bằng `&`
export function vnpayQueryString(parameters: Record<string, string>): string {
  return Object.keys(parameters)
    .sort()
    .map((key) => `${vnpayEncode(key)}=${vnpayEncode(parameters[key] ?? '')}`)
    .join('&');
}

export function vnpaySignature(hashSecret: string, parameters: Record<string, string>): string {
  return createHmac('sha512', hashSecret).update(vnpayQueryString(parameters), 'utf8').digest('hex');
}

// Thời điểm dạng yyyyMMddHHmmss theo giờ Việt Nam
export function vnpayDateTime(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

export type VnpayIpnResult =
  | { kind: 'invalid_signature' }
  | { kind: 'payment'; txnRef: string; amount: number | null; succeeded: boolean; incoming: IncomingTransfer | null };

export class VnpayPaymentGateway extends PaymentGateway {
  readonly provider = 'vnpay';
  readonly label = 'VNPay (trang thanh toán, báo kết quả qua IPN)';
  readonly supportsWebhook = true;

  constructor(
    private readonly settings: VnpaySettings,
    private readonly clock: () => Date = () => new Date(),
  ) {
    super();
  }

  // Địa chỉ trang thanh toán VNPay đã ký; phụ huynh mở địa chỉ hoặc quét mã QR của địa chỉ
  async createPaymentRequest(input: PaymentRequestInput): Promise<CreatedPaymentRequest> {
    const now = this.clock();
    const txnRef = `${input.transferContent}${now.getTime()}${randomInt(0, 100)}`;
    const expiresAt = new Date(now.getTime() + this.settings.expireMinutes * 60_000);
    const parameters: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.settings.tmnCode,
      vnp_Amount: String(input.amount * 100),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: input.transferContent,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: this.settings.returnUrl,
      vnp_IpAddr: input.payerIpAddress || '127.0.0.1',
      vnp_CreateDate: vnpayDateTime(now),
      vnp_ExpireDate: vnpayDateTime(expiresAt),
    };
    const query = vnpayQueryString(parameters);
    const secureHash = vnpaySignature(this.settings.hashSecret, parameters);
    return {
      provider: this.provider,
      providerReference: txnRef,
      virtualAccountNumber: txnRef,
      qrContent: `${this.settings.paymentUrl}?${query}&vnp_SecureHash=${secureHash}`,
      expiresAt,
    };
  }

  // Kiểm tra chữ ký IPN (bỏ vnp_SecureHash và vnp_SecureHashType) và đọc kết quả thanh toán
  parseIpn(query: Record<string, unknown>, now: Date): VnpayIpnResult {
    const parameters: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith('vnp_') && key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType') {
        parameters[key] = textOf(Array.isArray(value) ? value[0] : value);
      }
    }
    const received = textOf(query.vnp_SecureHash);
    if (!sameSignature(vnpaySignature(this.settings.hashSecret, parameters), received)) {
      return { kind: 'invalid_signature' };
    }
    const txnRef = parameters.vnp_TxnRef ?? '';
    const rawAmount = Number(parameters.vnp_Amount);
    const amount = Number.isSafeInteger(rawAmount) && rawAmount > 0 && rawAmount % 100 === 0 ? rawAmount / 100 : null;
    const succeeded = parameters.vnp_ResponseCode === '00' && parameters.vnp_TransactionStatus === '00';
    return {
      kind: 'payment',
      txnRef,
      amount,
      succeeded,
      incoming:
        succeeded && amount !== null
          ? {
              provider: this.provider,
              providerTransactionRef: `vnpay-${txnRef}`,
              providerReference: txnRef,
              virtualAccountNumber: null,
              amount,
              transferContent: parameters.vnp_OrderInfo ?? '',
              receivedAt: parseVnpayDate(parameters.vnp_PayDate, now),
            }
          : null,
    };
  }
}

function parseVnpayDate(value: string | undefined, fallback: Date): Date {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(value ?? '');
  return match
    ? parseVietnamDateTime(`${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`, fallback)
    : fallback;
}

// ---------- Cấu hình và tạo cổng ----------

export const DEFAULT_PAYOS_API_URL = 'https://api-merchant.payos.vn';
export const DEFAULT_VNPAY_PAYMENT_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

// Đọc khóa của các cổng đã bật từ biến môi trường; cổng bật mà thiếu biến thì dừng khởi động máy chủ
export function readPaymentProviderSettings(
  codes: readonly PaymentProviderCode[],
  environment: Record<string, string | undefined> = process.env,
): PaymentProviderSettings {
  const missing: string[] = [];
  const read = (name: string) => {
    const value = environment[name]?.trim();
    if (!value) {
      missing.push(name);
    }
    return value ?? '';
  };
  const settings: PaymentProviderSettings = {};
  if (codes.includes('payos')) {
    const clientId = read('PAYOS_CLIENT_ID');
    const apiKey = read('PAYOS_API_KEY');
    const checksumKey = read('PAYOS_CHECKSUM_KEY');
    const returnUrl = read('PAYOS_RETURN_URL');
    settings.payos = {
      clientId,
      apiKey,
      checksumKey,
      returnUrl,
      cancelUrl: environment.PAYOS_CANCEL_URL?.trim() || returnUrl,
      apiUrl: (environment.PAYOS_API_URL?.trim() || DEFAULT_PAYOS_API_URL).replace(/\/+$/, ''),
    };
  }
  if (codes.includes('sepay')) {
    settings.sepay = { webhookApiKey: read('SEPAY_WEBHOOK_API_KEY') };
  }
  if (codes.includes('casso')) {
    settings.casso = { webhookSecret: read('CASSO_WEBHOOK_SECRET') };
  }
  if (codes.includes('vnpay')) {
    settings.vnpay = {
      tmnCode: read('VNPAY_TMN_CODE'),
      hashSecret: read('VNPAY_HASH_SECRET'),
      returnUrl: read('VNPAY_RETURN_URL'),
      paymentUrl: environment.VNPAY_PAYMENT_URL?.trim() || DEFAULT_VNPAY_PAYMENT_URL,
      expireMinutes: 15,
    };
  }
  if (missing.length > 0) {
    throw new Error(`Thiếu biến môi trường cho cổng thanh toán đã bật: ${missing.join(', ')}`);
  }
  return settings;
}

function requireSettings<T>(code: string, value: T | undefined): T {
  if (!value) {
    throw new Error(`Cổng thanh toán ${code} đã bật nhưng chưa có khóa ở biến môi trường`);
  }
  return value;
}

export function createPaymentGateway(
  code: PaymentProviderCode,
  settings: PaymentProviderSettings = {},
): PaymentGateway {
  switch (code) {
    case 'development':
      return new DevelopmentPaymentGateway();
    case 'vietqr-static':
      return new VietQrStaticPaymentGateway();
    case 'payos':
      return new PayosPaymentGateway(requireSettings(code, settings.payos));
    case 'sepay':
      return new SepayPaymentGateway(requireSettings(code, settings.sepay));
    case 'casso':
      return new CassoPaymentGateway(requireSettings(code, settings.casso));
    case 'vnpay':
      return new VnpayPaymentGateway(requireSettings(code, settings.vnpay));
  }
}
