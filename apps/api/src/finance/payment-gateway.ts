import { randomInt, randomUUID } from 'node:crypto';
import { ruleViolationError } from '@school-management/server';

// Lớp nhà cung cấp tài khoản ảo và mã QR dùng một lần; tiền chuyển vào tài khoản ảo về tài khoản duy nhất của trường.
// Nhà cung cấp thật nối khi chọn xong ở việc T1 (P06-11, Q-142, YCTD-57). Máy chủ bật được nhiều cổng cùng lúc qua sổ
// đăng ký cổng; mỗi tài khoản ngân hàng chọn cổng của mình, trống thì dùng cổng mặc định (G3-05, YCTD-89)
export interface PaymentRequestInput {
  invoiceCode: string;
  transferContent: string;
  amount: number;
  childName: string;
  receivingAccountNumber: string;
  receivingAccountName: string;
  receivingBankBin: string | null;
}

export interface CreatedPaymentRequest {
  provider: string;
  providerReference: string;
  virtualAccountNumber: string;
  qrContent: string;
  expiresAt: Date | null;
}

export abstract class PaymentGateway {
  abstract readonly provider: string;
  abstract readonly label: string;
  // Cổng có báo giao dịch tiền vào về máy chủ; cổng không báo thì tiền vào được đối soát qua tệp sao kê
  abstract readonly supportsWebhook: boolean;
  // Cổng cần mã BIN ngân hàng của tài khoản nhận
  readonly requiresBankBin: boolean = false;
  abstract createPaymentRequest(input: PaymentRequestInput): Promise<CreatedPaymentRequest>;
}

// Chưa nối nhà cung cấp: không cấp được mã QR
export class UnavailablePaymentGateway extends PaymentGateway {
  readonly provider = 'none';
  readonly label = 'Chưa nối cổng thanh toán';
  readonly supportsWebhook = false;

  async createPaymentRequest(): Promise<CreatedPaymentRequest> {
    throw ruleViolationError('P06-11', 'Nhà trường chưa nối nhà cung cấp thanh toán trực tuyến');
  }
}

// Dùng khi phát triển và kiểm thử: tự cấp số tài khoản ảo và nội dung mã QR giả lập, không quét được ở ngân hàng thật
export class DevelopmentPaymentGateway extends PaymentGateway {
  readonly provider = 'development';
  readonly label = 'Giả lập (phát triển, kiểm thử)';
  readonly supportsWebhook = true;

  async createPaymentRequest(input: PaymentRequestInput): Promise<CreatedPaymentRequest> {
    const virtualAccountNumber = `96${String(randomInt(0, 10_000_000_000)).padStart(10, '0')}`;
    return {
      provider: this.provider,
      providerReference: randomUUID(),
      virtualAccountNumber,
      qrContent: `GIA-LAP|${virtualAccountNumber}|${input.amount}|${input.transferContent}`,
      expiresAt: null,
    };
  }
}

// Bảng CRC-16/CCITT-FALSE theo chuẩn EMVCo cho mã QR thanh toán
export function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(text, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

// Chuỗi VietQR (chuẩn EMVCo của NAPAS) chuyển khoản tới tài khoản thật của trường kèm số tiền và nội dung
export function vietQrContent(input: { bankBin: string; accountNumber: string; amount: number; content: string }) {
  const beneficiary = field('00', input.bankBin) + field('01', input.accountNumber);
  const merchant = field('00', 'A000000727') + field('01', beneficiary) + field('02', 'QRIBFTTA');
  const body =
    field('00', '01') +
    field('01', '12') +
    field('38', merchant) +
    field('53', '704') +
    field('54', String(input.amount)) +
    field('58', 'VN') +
    field('62', field('08', input.content));
  return `${body}6304${crc16(`${body}6304`)}`;
}

// Mã VietQR tĩnh: không có tài khoản ảo và không có thông báo tiền vào; phụ huynh chuyển thẳng vào tài khoản thật của
// trường với nội dung là mã hóa đơn bỏ gạch, kế toán nhập sao kê để đối soát và xác nhận lập phiếu thu (YCTD-89)
export class VietQrStaticPaymentGateway extends PaymentGateway {
  readonly provider = 'vietqr-static';
  readonly label = 'VietQR tĩnh (đối soát qua sao kê)';
  readonly supportsWebhook = false;
  override readonly requiresBankBin = true;

  async createPaymentRequest(input: PaymentRequestInput): Promise<CreatedPaymentRequest> {
    if (!input.receivingBankBin || !input.receivingAccountNumber) {
      throw ruleViolationError(
        'P06-11',
        'Tài khoản nhận chưa khai mã BIN ngân hàng hoặc số tài khoản để dựng mã VietQR',
      );
    }
    return {
      provider: this.provider,
      providerReference: randomUUID(),
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
}

export const PAYMENT_PROVIDER_CODES = ['development', 'vietqr-static'] as const;
export type PaymentProviderCode = (typeof PAYMENT_PROVIDER_CODES)[number];

export function createPaymentGateway(code: PaymentProviderCode): PaymentGateway {
  return code === 'development' ? new DevelopmentPaymentGateway() : new VietQrStaticPaymentGateway();
}

// Các cổng máy chủ đã bật; cổng đầu tiên là cổng mặc định cho tài khoản chưa chọn cổng
export class PaymentGatewayRegistry {
  private readonly gateways: PaymentGateway[];

  constructor(gateways: PaymentGateway[]) {
    this.gateways = gateways.length > 0 ? gateways : [new UnavailablePaymentGateway()];
  }

  get defaultGateway(): PaymentGateway {
    return this.gateways[0] as PaymentGateway;
  }

  has(provider: string): boolean {
    return this.gateways.some((gateway) => gateway.provider === provider && provider !== 'none');
  }

  // Cổng của tài khoản: tài khoản chưa chọn dùng cổng mặc định; cổng đã chọn mà máy chủ chưa bật thì báo lỗi
  forAccount(provider: string | null): PaymentGateway {
    if (!provider) {
      return this.defaultGateway;
    }
    const gateway = this.gateways.find((item) => item.provider === provider);
    if (!gateway) {
      throw ruleViolationError('P06-11', `Cổng thanh toán ${provider} của tài khoản chưa được bật trên máy chủ`);
    }
    return gateway;
  }

  list() {
    return this.gateways
      .filter((gateway) => gateway.provider !== 'none')
      .map((gateway, index) => ({
        code: gateway.provider,
        label: gateway.label,
        supports_webhook: gateway.supportsWebhook,
        requires_bank_bin: gateway.requiresBankBin,
        is_default: index === 0,
      }));
  }
}
