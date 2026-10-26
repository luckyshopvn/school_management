import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Param,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { ApplicationError, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, PublicEndpoint, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { Databases } from '../common/databases.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import type { RequestBody } from '../common/request-fields.js';
import { FileStorage, S3FileStorage } from '../files/file-storage.js';
import { IntegrationsService } from '../integrations/integrations.js';
import { PortalContextService } from '../portal-shell/portal-shell.js';
import {
  CONNECTOR_SPECS,
  isSecretConnector,
  SchoolSettings,
  SECRET_CONNECTORS,
  type SecretConnector,
} from './school-settings.js';
import { paymentSettingsOf } from './tenant-connectors.js';
import { createPaymentGateway } from '../finance/payment-providers.js';
import { revisionOf, type PwaBranding } from './pwa-branding.js';

// Màn hình quản trị cấu hình riêng của trường (4. Quản trị hệ thống; DT-SaaS phần S3, YCTD-195): nhập khóa của các kết nối ngoài, kiểm tra
// kết nối, xem địa chỉ gọi lại (webhook) của trường để dán vào cổng thanh toán, chọn màu và tên hiển thị. Không bao giờ trả lại giá trị bí mật đã
// lưu (chỉ bốn ký tự cuối); nhật ký chỉ ghi tên kết nối và tên các trường đã đổi, không ghi giá trị

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const APP_SHORT_NAME_MAXIMUM = 9;
const ESMS_BALANCE_URL = 'https://rest.esms.vn/MainService.svc/json/GetBalance';
const TEST_TIMEOUT_MILLISECONDS = 10_000;

function readConnector(value: string): SecretConnector {
  if (!isSecretConnector(value)) {
    throw new ApplicationError('ERR_NOT_FOUND', 'Không có kết nối này');
  }
  return value;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class SchoolSettingsService {
  constructor(
    private readonly settings: SchoolSettings,
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly integrations: IntegrationsService,
    private readonly portalContext: PortalContextService,
    private readonly fileStorage: FileStorage,
  ) {}

  async list(callbackBase: string) {
    const connectors = [];
    for (const connector of SECRET_CONNECTORS) {
      const view = await this.settings.view(connector);
      connectors.push({
        ...view,
        webhook_url: view.webhook_path ? `${callbackBase}${view.webhook_path}` : null,
      });
    }
    return connectors;
  }

  async save(
    connector: SecretConnector,
    input: { enabled: boolean; values: Record<string, unknown> },
    currentUser: CurrentUser,
    origin: ChangeOrigin,
  ) {
    const before = (await this.settings.all()).get(connector);
    const view = await this.settings.save(connector, input, {
      id: currentUser.id,
      name: currentUser.description.full_name,
    });
    await this.audit(origin, connector, before ? 'update' : 'create', {
      connector,
      enabled: input.enabled,
      fields: Object.keys(input.values).filter(
        (name) => typeof input.values[name] === 'string' && input.values[name] !== '',
      ),
    });
    return view;
  }

  async remove(connector: SecretConnector, origin: ChangeOrigin) {
    if (await this.settings.remove(connector)) {
      await this.audit(origin, connector, 'delete', { connector });
    }
    return this.settings.view(connector);
  }

  private async audit(
    origin: ChangeOrigin,
    connector: SecretConnector,
    action: 'create' | 'update' | 'delete',
    after: unknown,
  ) {
    // Trường chưa có năm học đang dùng (vừa khởi tạo) thì chưa có nơi ghi nhật ký thay đổi: bỏ qua, cấu hình vẫn lưu được
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return;
    }
    const row = (await this.settings.all()).get(connector);
    await writeAuditLog(current.database, {
      origin,
      orgUnitId: null,
      entityName: 'integration_secrets',
      entityId: row?.id ?? '00000000-0000-4000-8000-000000000000',
      action,
      before: null,
      after,
    });
  }

  // Kiểm tra kết nối: gọi nhà cung cấp bằng giá trị đã lưu khi có thể; thanh toán chỉ kiểm tra đủ giá trị và dựng được cổng
  async test(connector: SecretConnector) {
    const stored = await this.settings.active(connector);
    if (!stored) {
      throw ruleViolationError('G3-10', `Chưa bật hoặc chưa nhập ${CONNECTOR_SPECS[connector].label}`);
    }
    const label = CONNECTOR_SPECS[connector].label;
    try {
      switch (connector) {
        case 'facebook':
          return { ...(await this.integrations.testFacebook()), connector, ok: true };
        case 'zalo':
          return { ...(await this.integrations.testZalo()), connector, ok: true };
        case 'esms':
          return { connector, ok: true, ...(await this.testEsms(stored.values)) };
        case 'storage': {
          const storage = new S3FileStorage({
            endpoint: stored.values.endpoint ?? '',
            region: stored.values.region ?? '',
            bucket: stored.values.bucket ?? '',
            accessKeyId: stored.values.access_key_id ?? '',
            secretAccessKey: stored.values.secret_access_key ?? '',
          });
          const key = `connection-test/${Date.now()}.txt`;
          await storage.put(key, Buffer.from('kiem-tra-ket-noi'), 'text/plain');
          await storage.delete(key);
          return { connector, ok: true, message: 'Ghi và xóa tệp thử thành công' };
        }
        case 'vietqr':
          return { connector, ok: true, message: 'Cổng VietQR tĩnh không cần khóa; đối soát qua sao kê ngân hàng' };
        default: {
          const { codes, providers } = paymentSettingsOf(new Map([[connector, stored]]));
          for (const code of codes) {
            createPaymentGateway(code, providers);
          }
          return {
            connector,
            ok: true,
            message:
              'Đã đủ khóa và dựng được cổng; nhà cung cấp chỉ xác nhận khi có giao dịch thật hoặc thử từ trang quản trị của họ',
          };
        }
      }
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      throw ruleViolationError('G3-10', `Kiểm tra kết nối ${label} lỗi: ${messageOf(error)}`);
    }
  }

  private async testEsms(values: Record<string, string>) {
    const url = `${ESMS_BALANCE_URL}/${encodeURIComponent(values.api_key ?? '')}/${encodeURIComponent(values.secret_key ?? '')}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(TEST_TIMEOUT_MILLISECONDS) });
    const body = (await response.json().catch(() => ({}))) as {
      CodeResponse?: string;
      Balance?: number;
      ErrorMessage?: string;
    };
    if (body.CodeResponse !== '100') {
      throw new Error(body.ErrorMessage || `eSMS trả mã ${body.CodeResponse ?? response.status}`);
    }
    return { balance: body.Balance ?? null };
  }

  // ---- Thương hiệu
  async branding() {
    const row = await this.databases.system
      .selectFrom('school_branding')
      .selectAll()
      .where('id', '=', 1)
      .executeTakeFirst();
    const website = await this.databases.system
      .selectFrom('website_settings')
      .select(['primary_color', 'logo_file_id'])
      .where('id', '=', 1)
      .executeTakeFirst();
    const identity = await this.portalContext.schoolIdentity();
    return {
      display_name: row?.display_name ?? null,
      school_name: identity.school_name,
      primary_color: row?.primary_color ?? website?.primary_color ?? null,
      app_short_name: row?.app_short_name ?? null,
      has_logo: Boolean(website?.logo_file_id),
      logo_file_id: website?.logo_file_id ?? null,
    };
  }

  // Tên ngắn dưới biểu tượng khi cài lên màn hình chính (DT-26 phần 26a): `undefined` giữ giá trị đang có
  async updateBranding(
    input: { display_name: string | null; primary_color: string | null; app_short_name?: string | null },
    currentUser: CurrentUser,
  ) {
    const appShortName =
      input.app_short_name === undefined ? ((await this.branding()).app_short_name ?? null) : input.app_short_name;
    await this.databases.system
      .insertInto('school_branding')
      .values({
        id: 1,
        display_name: input.display_name,
        primary_color: input.primary_color,
        app_short_name: appShortName,
        updated_by_name: currentUser.description.full_name,
      })
      .onConflict((conflict) =>
        conflict.column('id').doUpdateSet({
          display_name: input.display_name,
          primary_color: input.primary_color,
          app_short_name: appShortName,
          updated_at: new Date(),
          updated_by_name: currentUser.description.full_name,
        }),
      )
      .execute();
    return this.adminBranding();
  }

  // Màn hình Thương hiệu của cổng quản trị: không trả mã tệp biểu trưng
  async adminBranding() {
    const branding = await this.branding();
    return {
      display_name: branding.display_name,
      school_name: branding.school_name,
      primary_color: branding.primary_color,
      app_short_name: branding.app_short_name,
      has_logo: branding.has_logo,
    };
  }

  // Thương hiệu cho manifest và biểu tượng của ứng dụng web cài được (DT-26 phần 26a): công khai, không có dữ liệu cá nhân
  async pwaBranding(): Promise<PwaBranding> {
    const branding = await this.branding();
    const logo = branding.logo_file_id
      ? await this.databases.system
          .selectFrom('website_files')
          .select('content_type')
          .where('id', '=', branding.logo_file_id)
          .executeTakeFirst()
      : undefined;
    const displayName = branding.display_name ?? branding.school_name ?? 'Trường';
    return {
      display_name: displayName,
      app_short_name: branding.app_short_name,
      primary_color: branding.primary_color,
      logo_content_type: logo?.content_type ?? null,
      revision: revisionOf([displayName, branding.app_short_name, branding.primary_color, branding.logo_file_id]),
    };
  }

  // Công khai: tên hiển thị, màu và có biểu trưng hay không (cho trang đăng nhập)
  async publicBranding() {
    const branding = await this.branding();
    return {
      display_name: branding.display_name ?? branding.school_name,
      primary_color: branding.primary_color,
      logo_url: branding.has_logo ? '/api/v1/public/branding/logo' : null,
    };
  }

  async logo(): Promise<{ data: Buffer; contentType: string } | null> {
    const settings = await this.databases.system
      .selectFrom('website_settings')
      .select('logo_file_id')
      .where('id', '=', 1)
      .executeTakeFirst();
    if (!settings?.logo_file_id) {
      return null;
    }
    const file = await this.databases.system
      .selectFrom('website_files')
      .select(['storage_key', 'content_type'])
      .where('id', '=', settings.logo_file_id)
      .executeTakeFirst();
    if (!file) {
      return null;
    }
    return { data: await this.fileStorage.get(file.storage_key), contentType: file.content_type };
  }
}

function readValues(body: RequestBody): { enabled: boolean; values: Record<string, unknown> } {
  const errors = [];
  if (typeof body?.enabled !== 'boolean') {
    errors.push({ field: 'enabled', message: 'Chọn bật hoặc tắt' });
  }
  const values = body?.values;
  if (values !== undefined && (typeof values !== 'object' || values === null || Array.isArray(values))) {
    errors.push({ field: 'values', message: 'Giá trị phải là một đối tượng' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { enabled: body?.enabled === true, values: (values ?? {}) as Record<string, unknown> };
}

// Địa chỉ gốc của trường để dựng địa chỉ gọi lại: lấy từ tên miền yêu cầu (chế độ nhiều trường mỗi trường một tên miền)
function callbackBaseOf(request: Request): string {
  const forwarded = request.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwarded === 'http' || forwarded === 'https' ? forwarded : request.protocol;
  return `${protocol}://${request.header('host') ?? request.hostname}`;
}

@Controller('school-settings')
export class SchoolSettingsController {
  constructor(@Inject(SchoolSettingsService) private readonly service: SchoolSettingsService) {}

  @Get('integrations')
  @RequirePermission(PERMISSION_CODES.integrationManage)
  list(@Req() request: Request) {
    return this.service.list(callbackBaseOf(request));
  }

  @Put('integrations/:connector')
  @RequirePermission(PERMISSION_CODES.integrationManage)
  save(
    @Param('connector') connectorValue: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.save(
      readConnector(connectorValue),
      readValues(body),
      currentUser,
      originOf(request, currentUser),
    );
  }

  @Delete('integrations/:connector')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.integrationManage)
  remove(
    @Param('connector') connectorValue: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.remove(readConnector(connectorValue), originOf(request, currentUser));
  }

  @Post('integrations/:connector/test')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.integrationManage)
  test(@Param('connector') connectorValue: string) {
    return this.service.test(readConnector(connectorValue));
  }

  @Get('branding')
  @RequirePermission(PERMISSION_CODES.integrationManage)
  branding() {
    return this.service.adminBranding();
  }

  @Put('branding')
  @RequirePermission(PERMISSION_CODES.integrationManage)
  updateBranding(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors = [];
    const name = typeof body?.display_name === 'string' ? body.display_name.trim() : '';
    if (body?.display_name !== undefined && body.display_name !== null && typeof body.display_name !== 'string') {
      errors.push({ field: 'display_name', message: 'Tên hiển thị phải là chuỗi' });
    }
    if (name.length > 200) {
      errors.push({ field: 'display_name', message: 'Tên hiển thị tối đa 200 ký tự' });
    }
    const color = typeof body?.primary_color === 'string' ? body.primary_color.trim() : '';
    if (color !== '' && !COLOR_PATTERN.test(color)) {
      errors.push({ field: 'primary_color', message: 'Màu dạng #RRGGBB' });
    }
    // Tên ngắn dưới biểu tượng khi cài lên màn hình chính (DT-26 phần 26a): tối đa 9 ký tự, ứng dụng thêm "GV", "PH"
    const shortName = typeof body?.app_short_name === 'string' ? body.app_short_name.trim() : '';
    if (body?.app_short_name !== undefined && body.app_short_name !== null && typeof body.app_short_name !== 'string') {
      errors.push({ field: 'app_short_name', message: 'Tên ngắn phải là chuỗi' });
    }
    if (Array.from(shortName).length > APP_SHORT_NAME_MAXIMUM) {
      errors.push({ field: 'app_short_name', message: `Tên ngắn tối đa ${APP_SHORT_NAME_MAXIMUM} ký tự` });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.updateBranding(
      {
        display_name: name === '' ? null : name,
        primary_color: color === '' ? null : color,
        app_short_name: body?.app_short_name === undefined ? undefined : shortName === '' ? null : shortName,
      },
      currentUser,
    );
  }
}

// Công khai theo tên miền của trường: trang đăng nhập hiện tên, màu và biểu trưng của trường
@Controller('public/branding')
@PublicEndpoint()
export class PublicBrandingController {
  constructor(@Inject(SchoolSettingsService) private readonly service: SchoolSettingsService) {}

  @Get()
  info() {
    return this.service.publicBranding();
  }

  @Get('logo')
  async logo(@Res() response: Response) {
    const logo = await this.service.logo();
    if (!logo) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Trường chưa có biểu trưng');
    }
    response.status(200).type(logo.contentType).set('cache-control', 'public, max-age=300').send(logo.data);
  }
}
