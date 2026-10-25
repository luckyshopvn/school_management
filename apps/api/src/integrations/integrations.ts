import { DemoMode } from '../demo/demo-mode.js';
import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Put, Req } from '@nestjs/common';
import type { IntegrationConnector, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { FacebookPublisher } from './facebook-publisher.js';
import { ZaloSender } from './zalo-sender.js';
import { ZaloTokenStore } from './zalo-token-store.js';

// Cấu hình kết nối ngoài toàn trường (P01.integration.manage, VT-02; G3-03, G3-08; YCTD-90). Mỗi kết nối có bật hay tắt và
// thông tin không bí mật: Fanpage gồm mã trang, tên trang; Zalo gồm mã Official Account, tên. Khóa truy cập chỉ đặt ở biến
// môi trường của máy chủ; API chỉ báo đã có khóa hay chưa. Phụ huynh quan tâm Official Account được người quản trị liên kết
// số điện thoại với mã người dùng Zalo trên màn hình kết nối (chưa có webhook nhận sự kiện quan tâm cho tới việc T7).
// YCTD-92: người quản trị bấm Kiểm tra kết nối để máy chủ gọi Facebook, Zalo bằng khóa đang dùng và trả tên trang, tên
// Official Account hoặc lỗi; khóa làm mới Zalo (hạn 3 tháng) được dán qua API, lưu mã hóa ở cơ sở dữ liệu hệ thống, không
// bao giờ trả lại, nhật ký chỉ ghi việc thay khóa
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export const CONNECTORS: IntegrationConnector[] = ['facebook', 'zalo'];
const CONFIG_FIELDS: Record<IntegrationConnector, { required: string; optional: string }> = {
  facebook: { required: 'page_id', optional: 'page_name' },
  zalo: { required: 'oa_id', optional: 'oa_name' },
};
const LABELS: Record<IntegrationConnector, string> = { facebook: 'Fanpage', zalo: 'Zalo Official Account' };
const PHONE_PATTERN = /^0\d{9}$/;
const EXTERNAL_ID_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;
const REFRESH_TOKEN_PATTERN = /^\S{10,2000}$/;

export interface IntegrationState {
  connector: IntegrationConnector;
  enabled: boolean;
  config: Record<string, string>;
}

// Đọc cấu hình một kết nối; chưa lưu lần nào thì là tắt
export async function readIntegration(database: Executor, connector: IntegrationConnector): Promise<IntegrationState> {
  const row = await database
    .selectFrom('integration_settings')
    .select(['enabled', 'config_data'])
    .where('connector', '=', connector)
    .executeTakeFirst();
  return { connector, enabled: row?.enabled ?? false, config: row?.config_data ?? {} };
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly facebook: FacebookPublisher,
    private readonly zalo: ZaloSender,
    private readonly zaloTokens: ZaloTokenStore,
    private readonly demoMode: DemoMode,
  ) {}

  // Kiểm tra kết nối Fanpage: đọc mã và tên trang bằng khóa trang ở máy chủ
  async testFacebook() {
    const { database } = await this.currentSchoolYear.require();
    const pageId = (await readIntegration(database, 'facebook')).config.page_id;
    if (!pageId) {
      throw ruleViolationError('G3-03', 'Chưa nhập mã trang Fanpage');
    }
    try {
      const page = await this.facebook.verify(pageId);
      return { connector: 'facebook', ok: true, page_id: page.id, page_name: page.name };
    } catch (error) {
      throw ruleViolationError('G3-03', `Kiểm tra kết nối Fanpage lỗi: ${messageOf(error)}`);
    }
  }

  // Kiểm tra kết nối Zalo: đọc thông tin Official Account; khóa sắp hết hạn thì tự làm mới trước
  async testZalo() {
    try {
      const account = await this.zalo.verify();
      return { connector: 'zalo', ok: true, oa_id: account.oaId, oa_name: account.name };
    } catch (error) {
      throw ruleViolationError('G3-08', `Kiểm tra kết nối Zalo lỗi: ${messageOf(error)}`);
    }
  }

  // Thay khóa làm mới Zalo khi khóa cũ hết hạn hoặc bị thu hồi; nhật ký không ghi giá trị khóa
  async replaceZaloRefreshToken(refreshToken: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    // Bản trình diễn không gọi Zalo thật (DT-18 phần 18h)
    await this.demoMode.assertLive('kết nối Zalo Official Account thật');
    const saved = await this.zaloTokens.replaceRefreshToken(refreshToken, origin.actorUserId);
    await writeAuditLog(database, {
      origin,
      orgUnitId: null,
      entityName: 'integration_credentials',
      entityId: saved.id,
      action: saved.replaced ? 'update' : 'create',
      before: null,
      after: { connector: 'zalo', refresh_token: 'đã thay' },
    });
    return this.view(database, 'zalo');
  }

  async list() {
    const { database } = await this.currentSchoolYear.require();
    const result = [];
    for (const connector of CONNECTORS) {
      result.push(await this.view(database, connector));
    }
    return result;
  }

  async update(
    connector: IntegrationConnector,
    input: { enabled: boolean; config: Record<string, string> },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    if (input.enabled && !input.config[CONFIG_FIELDS[connector].required]) {
      throw validationError([
        { field: `config.${CONFIG_FIELDS[connector].required}`, message: `Bật ${LABELS[connector]} phải nhập mã` },
      ]);
    }
    await database.transaction().execute(async (transaction) => {
      const before = await transaction
        .selectFrom('integration_settings')
        .select(['id', 'enabled', 'config_data'])
        .where('connector', '=', connector)
        .executeTakeFirst();
      const saved = await transaction
        .insertInto('integration_settings')
        .values({
          connector,
          enabled: input.enabled,
          config_data: JSON.stringify(input.config),
          updated_by: origin.actorUserId,
        })
        .onConflict((conflict) =>
          conflict.column('connector').doUpdateSet({
            enabled: input.enabled,
            config_data: JSON.stringify(input.config),
            updated_by: origin.actorUserId,
            updated_at: new Date(),
          }),
        )
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'integration_settings',
        entityId: saved.id,
        action: before ? 'update' : 'create',
        before: before ? { enabled: before.enabled, config: before.config_data } : null,
        after: { connector, enabled: input.enabled, config: input.config },
      });
    });
    return this.view(database, connector);
  }

  async followers() {
    const { database } = await this.currentSchoolYear.require();
    return database
      .selectFrom('zalo_followers')
      .selectAll()
      .select((expression) =>
        expression
          .selectFrom('guardians')
          .select('guardians.full_name')
          .whereRef('guardians.phone', '=', 'zalo_followers.phone')
          .limit(1)
          .as('guardian_name'),
      )
      .orderBy('linked_at', 'desc')
      .execute();
  }

  // Liên kết số điện thoại phụ huynh đã quan tâm Official Account với mã người dùng Zalo; số phải là của một phụ huynh
  async link(input: { phone: string; zaloUserId: string; displayName: string | null }, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const guardian = await database
      .selectFrom('guardians')
      .select('id')
      .where('phone', '=', input.phone)
      .executeTakeFirst();
    if (!guardian) {
      throw ruleViolationError('G3-08', 'Số điện thoại không phải của phụ huynh nào trong năm học');
    }
    try {
      return await database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('zalo_followers')
          .values({
            phone: input.phone,
            zalo_user_id: input.zaloUserId,
            display_name: input.displayName,
            linked_by: origin.actorUserId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'zalo_followers',
          entityId: created.id,
          action: 'create',
          before: null,
          after: { phone: input.phone, zalo_user_id: input.zaloUserId },
        });
        return created;
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ApplicationError('ERR_CONFLICT', 'Số điện thoại hoặc mã người dùng Zalo đã được liên kết', [
          { field: 'phone', message: 'Đã liên kết' },
        ]);
      }
      throw error;
    }
  }

  async unlink(id: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    await database.transaction().execute(async (transaction) => {
      const removed = await transaction
        .deleteFrom('zalo_followers')
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!removed) {
        throw notFoundError('Không tìm thấy liên kết Zalo', 'zalo_follower');
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'zalo_followers',
        entityId: id,
        action: 'delete',
        before: { phone: removed.phone, zalo_user_id: removed.zalo_user_id },
        after: null,
      });
    });
  }

  private async view(database: Executor, connector: IntegrationConnector) {
    const state = await readIntegration(database, connector);
    const provider = connector === 'facebook' ? this.facebook : this.zalo;
    return {
      ...state,
      provider: await provider.providerName(),
      // Chỉ báo đã có khóa truy cập hay chưa, không trả khóa
      credentials_configured: await provider.isAvailable(),
      ...(connector === 'zalo' ? { token_status: await this.zaloTokens.status() } : {}),
    };
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readConnector(value: string): IntegrationConnector {
  if (!CONNECTORS.includes(value as IntegrationConnector)) {
    throw notFoundError('Không có kết nối này', 'integration');
  }
  return value as IntegrationConnector;
}

// Chỉ nhận trường không bí mật đã định; trường lạ (ví dụ khóa truy cập) bị từ chối để không lưu bí mật vào cơ sở dữ liệu
function readConfig(connector: IntegrationConnector, value: unknown, errors: FieldError[]): Record<string, string> {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    errors.push({ field: 'config', message: 'Cấu hình phải là đối tượng' });
    return {};
  }
  const allowed = CONFIG_FIELDS[connector];
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (key !== allowed.required && key !== allowed.optional) {
      errors.push({
        field: `config.${key}`,
        message: 'Không nhận trường này; khóa truy cập đặt ở biến môi trường của máy chủ',
      });
      continue;
    }
    if (raw === null || raw === undefined || raw === '') {
      continue;
    }
    if (typeof raw !== 'string' || raw.trim().length > 200) {
      errors.push({ field: `config.${key}`, message: 'Tối đa 200 ký tự' });
      continue;
    }
    if (key === allowed.required && !EXTERNAL_ID_PATTERN.test(raw.trim())) {
      errors.push({ field: `config.${key}`, message: 'Mã chỉ gồm chữ, số, dấu gạch' });
      continue;
    }
    result[key] = raw.trim();
  }
  return result;
}

@Controller()
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get('integrations')
  @RequirePermission(PERMISSION_CODES.integrationManage)
  list() {
    return this.service.list();
  }

  @Put('integrations/:connector')
  @RequirePermission(PERMISSION_CODES.integrationManage)
  update(
    @Param('connector') connectorValue: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const connector = readConnector(connectorValue);
    const errors: FieldError[] = [];
    if (typeof body?.enabled !== 'boolean') {
      errors.push({ field: 'enabled', message: 'Chọn bật hoặc tắt' });
    }
    const config = readConfig(connector, body?.config, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.update(connector, { enabled: body?.enabled === true, config }, originOf(request, currentUser));
  }

  @Post('integrations/facebook/test')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.integrationManage)
  testFacebook() {
    return this.service.testFacebook();
  }

  @Post('integrations/zalo/test')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.integrationManage)
  testZalo() {
    return this.service.testZalo();
  }

  @Put('integrations/zalo/refresh-token')
  @RequirePermission(PERMISSION_CODES.integrationManage)
  replaceZaloRefreshToken(
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const refreshToken = typeof body?.refresh_token === 'string' ? body.refresh_token.trim() : '';
    if (!REFRESH_TOKEN_PATTERN.test(refreshToken)) {
      throw validationError([
        { field: 'refresh_token', message: 'Nhập khóa làm mới do Zalo cấp (từ 10 ký tự, không chứa khoảng trắng)' },
      ]);
    }
    return this.service.replaceZaloRefreshToken(refreshToken, originOf(request, currentUser));
  }

  @Get('integrations/zalo/followers')
  @RequirePermission(PERMISSION_CODES.integrationManage)
  followers() {
    return this.service.followers();
  }

  @Post('integrations/zalo/followers')
  @HttpCode(201)
  @RequirePermission(PERMISSION_CODES.integrationManage)
  link(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    if (!PHONE_PATTERN.test(phone)) {
      errors.push({ field: 'phone', message: 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0' });
    }
    const zaloUserId = typeof body?.zalo_user_id === 'string' ? body.zalo_user_id.trim() : '';
    if (!EXTERNAL_ID_PATTERN.test(zaloUserId)) {
      errors.push({ field: 'zalo_user_id', message: 'Bắt buộc nhập mã người dùng Zalo (chữ, số, dấu gạch)' });
    }
    const displayName =
      typeof body?.display_name === 'string' && body.display_name.trim()
        ? body.display_name.trim().slice(0, 200)
        : null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.link({ phone, zaloUserId, displayName }, originOf(request, currentUser));
  }

  @Delete('integrations/zalo/followers/:id')
  @HttpCode(204)
  @RequirePermission(PERMISSION_CODES.integrationManage)
  async unlink(
    @Param('id', uuidParameter('Mã liên kết không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.service.unlink(id, originOf(request, currentUser));
  }
}
