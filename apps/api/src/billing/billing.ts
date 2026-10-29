import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import {
  ApplicationError,
  Clock,
  currentTenant,
  isMultiTenantMode,
  unauthenticatedError,
} from '@school-management/server';
import {
  applyPlanLifecycle,
  BillingError,
  closeDuePeriod,
  invoiceDetail,
  listInvoices,
  readBillingSettings,
  readPlatformConnectors,
  receivePayment,
  recordStatusDunning,
  runDunning,
  saveInvoicePaymentRequest,
  vietnamDate,
  type BillingUsage,
  type PaymentOutcome,
  type TenancyRuntime,
} from '@school-management/database';
import { PERMISSION_CODES, PLAN_MODULES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AiAssistantService } from '../ai-assistant/ai-assistant.js';
import { PublicEndpoint, RequirePermission } from '../authentication/authentication.guard.js';
import { API_CONFIGURATION, TENANCY_RUNTIME, type ApiConfiguration } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { JobScheduler } from '../common/job-scheduler.js';
import { queueNotification } from '../common/notification-queue.js';
import { countActiveStudents, usedStorageMb } from '../common/plan-limits.js';
import { PaymentGatewayRegistry, type PaymentGateway } from '../finance/payment-gateway.js';
import { createPaymentGateway, isWebhookGateway, WebhookAuthenticationError } from '../finance/payment-providers.js';
import type { StoredConnector } from '../school-settings/school-settings.js';
import { paymentSettingsOf } from '../school-settings/tenant-connectors.js';

// Thu phí tự động ở máy chủ API (DT-SaaS phần S5b, YCTD-196; tài liệu 47 mục 14.5):
// - trang hóa đơn dịch vụ của trường cho quản trị trường (P01.billing.manage): xem, tải, trả tiền bằng mã QR hoặc liên kết thanh toán
//   qua cổng của nền tảng (khóa cổng lưu mã hóa ở cơ sở dữ liệu nền tảng; chưa có khóa thì dùng bộ giả lập đặt ở cấu hình máy chủ);
// - điểm nhận thông báo tiền vào của cổng nền tảng: không theo tên miền trường, xác thực bằng chữ ký hoặc khóa của cổng;
// - việc nền theo trường: chốt số liệu kỳ và lập hóa đơn, nhắc gia hạn trong ứng dụng cho quản trị trường, chuyển trạng thái theo hạn
//   (hàm của S5a cho riêng trường đó). Chỉ chạy ở chế độ nhiều trường; chế độ một trường không có thu phí.

const BILLING_JOB_SECONDS = 3600;
const MODULE_KEYS = PLAN_MODULES.filter((module) => !module.core).map((module) => module.key);
const MODULE_LABELS = Object.fromEntries(PLAN_MODULES.map((module) => [module.key, module.label]));
const PRICING = { allModules: MODULE_KEYS, moduleLabels: MODULE_LABELS };

const billingErrorOf = (error: unknown): unknown => {
  if (error instanceof BillingError) {
    return new ApplicationError(
      error.code === 'not_found' ? 'ERR_NOT_FOUND' : error.code === 'conflict' ? 'ERR_CONFLICT' : 'ERR_VALIDATION',
      error.message,
    );
  }
  return error;
};

// Bảng cổng thanh toán của nền tảng: dựng từ các kết nối đang bật ở cơ sở dữ liệu nền tảng; chưa bật kết nối nào thì dùng cổng giả
// lập đặt ở cấu hình máy chủ (phát triển, kiểm thử). Không bao giờ dùng cổng của trường
@Injectable()
export class PlatformPaymentGateways {
  private cached: { version: string; registry: PaymentGatewayRegistry } | null = null;

  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  async registry(): Promise<PaymentGatewayRegistry> {
    if (!this.tenancy) {
      return new PaymentGatewayRegistry([]);
    }
    const stored = await readPlatformConnectors(this.tenancy.platform, this.tenancy.configuration.masterKey);
    const version = [...stored.values()].map((row) => `${row.connector}:${row.enabled}:${row.version}`).join('|');
    if (this.cached?.version === version) {
      return this.cached.registry;
    }
    const { codes, providers } = paymentSettingsOf(stored as unknown as Map<string, StoredConnector>);
    const registry =
      codes.length > 0
        ? new PaymentGatewayRegistry(codes.map((code) => createPaymentGateway(code, providers)))
        : new PaymentGatewayRegistry(
            (this.configuration.paymentGateways ?? [])
              .filter((code) => code === 'development' || code === 'vietqr-static')
              .map((code) => createPaymentGateway(code)),
          );
    this.cached = { version, registry };
    return registry;
  }
}

@Injectable()
export class SchoolBillingService {
  constructor(
    private readonly gateways: PlatformPaymentGateways,
    private readonly clock: Clock,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  private context() {
    const tenant = currentTenant();
    if (!this.tenancy || !tenant) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Thu phí dịch vụ chỉ có ở nền tảng nhiều trường');
    }
    return { platform: this.tenancy.platform, tenant, today: vietnamDate(this.clock.now()) };
  }

  async list() {
    const { platform, tenant, today } = this.context();
    const [invoices, settings, registry] = await Promise.all([
      listInvoices(platform, { schoolId: tenant.schoolId, today }),
      readBillingSettings(platform),
      this.gateways.registry(),
    ]);
    const gateway = registry.defaultGateway;
    return {
      invoices,
      outstanding: invoices.reduce((sum, invoice) => sum + invoice.outstanding, 0),
      payment: {
        available: gateway.provider !== 'none',
        provider: gateway.provider,
        label: gateway.label,
        simulated: gateway.provider === 'development',
        account_name: settings.receivingAccount.accountName,
      },
    };
  }

  async detail(invoiceId: string) {
    const { platform, tenant, today } = this.context();
    const invoice = await invoiceDetail(platform, invoiceId, today, tenant.schoolId);
    if (!invoice) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy hóa đơn');
    }
    return invoice;
  }

  // Tạo mã QR hoặc liên kết thanh toán cho số còn nợ của hóa đơn qua cổng mặc định của nền tảng
  async pay(invoiceId: string, payerIpAddress: string | null) {
    const { platform } = this.context();
    const invoice = await this.detail(invoiceId);
    if (invoice.status !== 'issued' || invoice.outstanding <= 0) {
      throw new ApplicationError('ERR_CONFLICT', 'Hóa đơn không còn nợ');
    }
    const settings = await readBillingSettings(platform);
    const gateway: PaymentGateway = (await this.gateways.registry()).defaultGateway;
    const account = settings.receivingAccount;
    const created = await gateway.createPaymentRequest({
      invoiceCode: invoice.code,
      transferContent: invoice.payment_content,
      amount: invoice.outstanding,
      childName: invoice.school_name,
      receivingAccountNumber: account.accountNumber ?? '',
      receivingAccountName: account.accountName ?? '',
      receivingBankBin: account.bankBin,
      payerIpAddress,
    });
    const request = {
      provider: created.provider,
      provider_reference: created.providerReference,
      virtual_account_number: created.virtualAccountNumber,
      qr_content: created.qrContent,
      expires_at: created.expiresAt,
      amount: invoice.outstanding,
      transfer_content: invoice.payment_content,
      account_name: account.accountName,
      created_at: this.clock.now(),
    };
    await saveInvoicePaymentRequest(platform, invoice.id, request, this.clock.now());
    return request;
  }

  // Giả lập tiền vào đủ số còn nợ: chỉ khi cổng mặc định của nền tảng là bộ giả lập (phát triển, kiểm thử)
  async simulate(invoiceId: string): Promise<PaymentOutcome> {
    const { platform } = this.context();
    const registry = await this.gateways.registry();
    if (registry.defaultGateway.provider !== 'development') {
      throw new NotFoundException();
    }
    const invoice = await this.detail(invoiceId);
    if (invoice.status !== 'issued' || invoice.outstanding <= 0) {
      throw new ApplicationError('ERR_CONFLICT', 'Hóa đơn không còn nợ');
    }
    const now = this.clock.now();
    return receivePayment(
      platform,
      {
        provider: 'development',
        reference: `GIA-LAP-${randomUUID()}`,
        amount: invoice.outstanding,
        transferContent: `${invoice.payment_content} GIA LAP`,
        receivedAt: now,
      },
      now,
    ).catch((error: unknown) => {
      throw billingErrorOf(error);
    });
  }

  // Bản in hóa đơn (HTML tự chứa, in hoặc lưu thành PDF ở trình duyệt)
  async document(invoiceId: string): Promise<string> {
    const invoice = await this.detail(invoiceId);
    const money = (value: number) => `${value.toLocaleString('vi-VN')} đ`;
    const escape = (value: unknown) =>
      String(value ?? '').replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
    const rows = invoice.lines
      .map(
        (line) =>
          `<tr><td>${escape(line.description)}</td><td class="r">${line.quantity}</td><td class="r">${money(line.unit_price)}</td><td class="r">${money(line.amount)}</td></tr>`,
      )
      .join('');
    const status =
      invoice.status === 'paid' ? 'Đã thanh toán' : invoice.status === 'void' ? 'Đã hủy' : 'Chưa thanh toán';
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Hóa đơn ${escape(invoice.code)}</title>
<style>body{font-family:system-ui,sans-serif;margin:32px;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px}.r{text-align:right}</style></head>
<body><h1>Hóa đơn dịch vụ ${escape(invoice.code)}</h1>
<p>Trường: ${escape(invoice.school_name)} (${escape(invoice.school_code)})<br>Kỳ: ${escape(invoice.period_start)} đến ${escape(invoice.period_end)}<br>Hạn thanh toán: ${escape(invoice.due_on)}<br>Trạng thái: ${status}<br>Nội dung chuyển khoản: ${escape(invoice.payment_content)}</p>
<table><thead><tr><th>Nội dung</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr><td colspan="3">VAT ${invoice.vat_percent}%</td><td class="r">${money(invoice.vat_amount)}</td></tr>
<tr><td colspan="3"><b>Tổng cộng</b></td><td class="r"><b>${money(invoice.total)}</b></td></tr>
<tr><td colspan="3">Đã thanh toán</td><td class="r">${money(invoice.amount_paid)}</td></tr></tfoot></table>
<p>Đây là hóa đơn nội bộ của dịch vụ; hóa đơn điện tử (nếu có) do nhà cung cấp hóa đơn điện tử phát hành.</p></body></html>`;
  }
}

@Controller('billing')
export class SchoolBillingController {
  constructor(private readonly billing: SchoolBillingService) {}

  @Get('invoices')
  @RequirePermission(PERMISSION_CODES.billingManage)
  list() {
    return this.billing.list();
  }

  @Get('invoices/:id')
  @RequirePermission(PERMISSION_CODES.billingManage)
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.billing.detail(id);
  }

  @Get('invoices/:id/document')
  @RequirePermission(PERMISSION_CODES.billingManage)
  async document(@Param('id', ParseUUIDPipe) id: string, @Res() response: Response) {
    const html = await this.billing.document(id);
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.setHeader('content-disposition', `attachment; filename="hoa-don-${id}.html"`);
    response.send(html);
  }

  @Post('invoices/:id/pay')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.billingManage)
  pay(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.billing.pay(id, request.ip ?? null);
  }

  @Post('invoices/:id/simulate-payment')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.billingManage)
  simulate(@Param('id', ParseUUIDPipe) id: string) {
    return this.billing.simulate(id);
  }
}

// Thông báo tiền vào của cổng thanh toán của nền tảng: không theo tên miền trường (đường dẫn không cần trường), xác thực bằng chữ ký hoặc
// khóa của cổng; cổng chưa bật thì 404, chữ ký sai thì 401 và không ghi gì
@Controller('platform-billing/webhooks')
@PublicEndpoint()
export class PlatformBillingWebhooksController {
  private readonly logger = new Logger(PlatformBillingWebhooksController.name);

  constructor(
    private readonly gateways: PlatformPaymentGateways,
    private readonly clock: Clock,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  @Post(':provider')
  @HttpCode(200)
  async receive(@Param('provider') provider: string, @Req() request: Request, @Body() body: unknown) {
    if (!this.tenancy || !['payos', 'sepay', 'casso'].includes(provider)) {
      throw new NotFoundException();
    }
    const gateway = (await this.gateways.registry()).find(provider);
    if (!gateway || !isWebhookGateway(gateway)) {
      throw new NotFoundException();
    }
    const now = this.clock.now();
    let incoming;
    try {
      incoming = gateway.parseWebhook({ headers: request.headers, body }, now);
    } catch (error) {
      if (error instanceof WebhookAuthenticationError) {
        throw unauthenticatedError(error.message);
      }
      throw error;
    }
    for (const transfer of incoming) {
      const outcome = await receivePayment(
        this.tenancy.platform,
        {
          provider: transfer.provider,
          reference: transfer.providerTransactionRef,
          amount: transfer.amount,
          transferContent: transfer.transferContent,
          receivedAt: transfer.receivedAt,
        },
        now,
      );
      this.logger.log(`Tiền vào ${provider}: ${outcome.status} ${outcome.invoiceCode ?? ''}`);
    }
    return { success: true };
  }
}

// Việc nền thu phí theo trường (chạy trong ngữ cảnh của trường, mỗi giờ; các bước chạy lặp được)
@Injectable()
export class BillingCycleJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(BillingCycleJob.name);

  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
    @Optional() @Inject(JobScheduler) private readonly scheduler: JobScheduler | null = null,
    // Tổng hợp token AI lên nền tảng trước khi chốt kỳ để dòng phí AI đủ số liệu (DT-23 phần 23d)
    @Optional() @Inject(AiAssistantService) private readonly aiAssistant: AiAssistantService | null = null,
  ) {}

  onApplicationBootstrap() {
    if (isMultiTenantMode()) {
      this.scheduler?.register({ name: 'billing-cycle', intervalSeconds: BILLING_JOB_SECONDS, run: () => this.run() });
    }
  }

  async usage(): Promise<BillingUsage> {
    const tenant = currentTenant();
    const current = await this.currentSchoolYear.find();
    const [students, storage, levels] = await Promise.all([
      current ? countActiveStudents(current.database) : Promise.resolve(0),
      usedStorageMb(this.databases.system, current?.database ?? null),
      this.databases.system
        .selectFrom('school_levels')
        .select((expression) => expression.fn.countAll<string>().as('total'))
        .where('is_enabled', '=', true)
        .executeTakeFirst(),
    ]);
    return {
      activeStudents: students,
      storageMb: storage,
      schoolLevels: Number(levels?.total ?? 0),
      modules: tenant?.plan?.modules ?? null,
    };
  }

  // Một lượt cho trường trong ngữ cảnh: chốt kỳ, nhắc hạn, chuyển trạng thái
  async run(now: Date = this.clock.now()): Promise<void> {
    const tenant = currentTenant();
    if (!this.tenancy || !tenant) {
      return;
    }
    const platform = this.tenancy.platform;
    const today = vietnamDate(now);
    await this.aiAssistant?.syncUsage();
    const issued = await closeDuePeriod(
      platform,
      { schoolId: tenant.schoolId, today, now, usage: () => this.usage() },
      PRICING,
    );
    if (issued) {
      await this.notify(
        'billing_invoice_issued',
        `Có hóa đơn dịch vụ ${issued.code}`,
        `Số tiền ${issued.total.toLocaleString('vi-VN')} đồng, hạn ${issued.dueOn}`,
        issued.id,
      );
    }
    const notice = await runDunning(platform, { schoolId: tenant.schoolId, today });
    if (notice) {
      const title =
        notice.kind === 'before_due'
          ? `Hóa đơn dịch vụ ${notice.invoiceCode} đến hạn sau ${notice.days} ngày`
          : `Hóa đơn dịch vụ ${notice.invoiceCode} đã quá hạn ${notice.days} ngày`;
      await this.notify(
        'billing_dunning',
        title,
        `Còn nợ ${notice.outstanding.toLocaleString('vi-VN')} đồng, hạn ${notice.dueOn}. Quá hạn lâu trường chuyển sang chế độ chỉ đọc (dữ liệu được giữ nguyên).`,
        notice.invoiceId,
        notice.channels,
      );
    }
    const lifecycle = await applyPlanLifecycle(platform, now, { type: 'system' }, tenant.schoolId);
    for (const change of lifecycle.changes) {
      if (change.to === 'read_only' || change.to === 'suspended') {
        await recordStatusDunning(platform, { schoolId: tenant.schoolId, to: change.to, dueOn: change.dueOn, today });
      }
      this.logger.log(`Trường ${change.code}: ${change.from} → ${change.to}`);
    }
  }

  private async notify(
    templateCode: string,
    title: string,
    body: string,
    targetId: string,
    channels: string[] = ['in_app'],
  ) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return;
    }
    const root = await current.database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    if (!root) {
      return;
    }
    const wanted = channels.filter((channel): channel is 'in_app' | 'sms' => channel === 'in_app' || channel === 'sms');
    await queueNotification(current.database, {
      orgUnitId: root.id,
      templateCode,
      title,
      body,
      targetType: 'service_invoices',
      targetId,
      recipients: ['VT-01', 'VT-02'].flatMap((roleCode) =>
        wanted.map((channel) => ({ roleCode, orgUnitId: root.id, channel })),
      ),
    });
  }
}
