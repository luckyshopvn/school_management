import { createHash } from 'node:crypto';

// Bộ nối hóa đơn điện tử (DT-SaaS phần S5b, YCTD-196, GD-95): nhà cung cấp thật chưa chốt, chọn sau và viết một bộ nối theo giao diện
// này. Không phát hành hóa đơn thật khi chưa có hợp đồng nhà cung cấp; bộ giả lập `development` chỉ cấp mã giả để kiểm thử

export interface EInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface EInvoiceInput {
  invoiceCode: string;
  issuedOn: string;
  buyerName: string;
  buyerCode: string;
  lines: EInvoiceLine[];
  subtotal: number;
  vatPercent: number;
  vatAmount: number;
  total: number;
}

export interface IssuedEInvoice {
  externalId: string;
  lookupCode: string;
}

export interface EInvoiceProvider {
  readonly code: string;
  readonly label: string;
  readonly available: boolean;
  issue(input: EInvoiceInput): Promise<IssuedEInvoice>;
  cancel(externalId: string, reason: string): Promise<void>;
  lookup(externalId: string): Promise<{ status: 'issued' | 'cancelled' | 'unknown' }>;
}

export class EInvoiceUnavailableError extends Error {
  constructor() {
    super('Nền tảng chưa nối nhà cung cấp hóa đơn điện tử');
  }
}

export class UnavailableEInvoiceProvider implements EInvoiceProvider {
  readonly code = 'none';
  readonly label = 'Chưa nối nhà cung cấp';
  readonly available = false;

  async issue(): Promise<IssuedEInvoice> {
    throw new EInvoiceUnavailableError();
  }

  async cancel(): Promise<void> {
    throw new EInvoiceUnavailableError();
  }

  async lookup(): Promise<{ status: 'unknown' }> {
    return { status: 'unknown' };
  }
}

// Giả lập: mã hóa đơn giả suy từ mã hóa đơn nội bộ (chạy lại cho cùng mã), nhớ trạng thái trong tiến trình
export class DevelopmentEInvoiceProvider implements EInvoiceProvider {
  readonly code = 'development';
  readonly label = 'Giả lập (phát triển, kiểm thử)';
  readonly available = true;
  private readonly cancelled = new Set<string>();

  async issue(input: EInvoiceInput): Promise<IssuedEInvoice> {
    const digest = createHash('sha256').update(input.invoiceCode).digest('hex').slice(0, 10).toUpperCase();
    return { externalId: `GL-${input.invoiceCode}`, lookupCode: `GL${digest}` };
  }

  async cancel(externalId: string): Promise<void> {
    this.cancelled.add(externalId);
  }

  async lookup(externalId: string): Promise<{ status: 'issued' | 'cancelled' }> {
    return { status: this.cancelled.has(externalId) ? 'cancelled' : 'issued' };
  }
}

export const EINVOICE_PROVIDER_CODES = ['none', 'development'] as const;
export type EInvoiceProviderCode = (typeof EINVOICE_PROVIDER_CODES)[number];

const development = new DevelopmentEInvoiceProvider();

export function createEInvoiceProvider(code: string): EInvoiceProvider {
  return code === 'development' ? development : new UnavailableEInvoiceProvider();
}
