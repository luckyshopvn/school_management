import { randomInt, randomUUID } from 'node:crypto';
import { ruleViolationError } from '@school-management/server';

// Lớp nhà cung cấp tài khoản ảo và mã QR dùng một lần; tiền chuyển vào tài khoản ảo về tài khoản duy nhất của trường.
// Nhà cung cấp thật nối khi chọn xong ở việc T1 (P06-11, Q-142, YCTD-57)
export interface PaymentRequestInput {
  invoiceCode: string;
  transferContent: string;
  amount: number;
  childName: string;
  receivingAccountNumber: string;
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
  abstract createPaymentRequest(input: PaymentRequestInput): Promise<CreatedPaymentRequest>;
}

// Chưa nối nhà cung cấp: không cấp được mã QR
export class UnavailablePaymentGateway extends PaymentGateway {
  readonly provider = 'none';

  async createPaymentRequest(): Promise<CreatedPaymentRequest> {
    throw ruleViolationError('P06-11', 'Nhà trường chưa nối nhà cung cấp thanh toán trực tuyến');
  }
}

// Dùng khi phát triển và kiểm thử: tự cấp số tài khoản ảo và nội dung mã QR giả lập, không quét được ở ngân hàng thật
export class DevelopmentPaymentGateway extends PaymentGateway {
  readonly provider = 'development';

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
