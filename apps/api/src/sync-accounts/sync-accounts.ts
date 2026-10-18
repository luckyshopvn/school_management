import { Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Param, Put, Req } from '@nestjs/common';
import type { IntegrationCredentialConnector } from '@school-management/database';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import type { RequestBody } from '../common/request-fields.js';
import { decryptSecret, encryptSecret } from '../common/secret-encryption.js';

// 1.6 Tài khoản đồng bộ của Bộ, của Sở (DT-16 phần 16d, bản chạy nội bộ theo lựa chọn 1 của Eric ngày 2026-10-16): nhà
// trường lưu tên đăng nhập, mật khẩu dùng để đồng bộ hồ sơ lên CSDL ngành của Bộ GD&ĐT và của Sở GD&ĐT. Lưu ở bảng thông
// tin kết nối mã hóa của cơ sở dữ liệu hệ thống (YCTD-92): mật khẩu mã hóa AES-256-GCM, không bao giờ trả về giao diện,
// nhật ký chỉ ghi "đã thay mật khẩu". Chỉ người có quyền cấu hình kết nối ngoài xem, sửa. Chưa có giao diện lập trình của
// Bộ, Sở nên chưa đồng bộ được; khi có thì cài một MinistrySyncGateway đọc mật khẩu bằng readCredentials
export type SyncTarget = 'moet' | 'doet';

export const SYNC_TARGETS: Record<SyncTarget, { connector: IntegrationCredentialConnector; label: string }> = {
  moet: { connector: 'moet_sync', label: 'Tài khoản đồng bộ của Bộ GD&ĐT' },
  doet: { connector: 'doet_sync', label: 'Tài khoản đồng bộ của Sở GD&ĐT' },
};

const USERNAME_MAXIMUM = 100;
const PASSWORD_MAXIMUM = 200;

// Chỗ nối đồng bộ với CSDL ngành của Bộ, Sở; bản chạy nội bộ chưa đồng bộ được
export abstract class MinistrySyncGateway {
  abstract available(target: SyncTarget): boolean;
}

export class UnavailableMinistrySyncGateway extends MinistrySyncGateway {
  available(): boolean {
    return false;
  }
}

export interface SyncAccountView {
  target: SyncTarget;
  label: string;
  username: string | null;
  password_configured: boolean;
  updated_at: Date | null;
  sync_available: boolean;
}

@Injectable()
export class SyncAccountsService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly gateway: MinistrySyncGateway,
    private readonly clock: Clock,
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
  ) {}

  async list(): Promise<SyncAccountView[]> {
    const rows = await this.databases.system
      .selectFrom('integration_credentials')
      .select(['connector', 'account_username', 'account_secret_encrypted', 'updated_at'])
      .where('connector', 'in', ['moet_sync', 'doet_sync'])
      .execute();
    return (Object.keys(SYNC_TARGETS) as SyncTarget[]).map((target) => {
      const row = rows.find((item) => item.connector === SYNC_TARGETS[target].connector);
      return {
        target,
        label: SYNC_TARGETS[target].label,
        username: row?.account_username ?? null,
        password_configured: Boolean(row?.account_secret_encrypted),
        updated_at: row?.updated_at ?? null,
        sync_available: this.gateway.available(target),
      };
    });
  }

  // Mật khẩu để trống thì giữ mật khẩu đã lưu
  async save(target: SyncTarget, input: { username: string; password: string | null }, origin: ChangeOrigin) {
    const connector = SYNC_TARGETS[target].connector;
    const before = await this.read(connector);
    if (!input.password && !before?.account_secret_encrypted) {
      throw validationError([{ field: 'password', message: 'Bắt buộc nhập mật khẩu' }]);
    }
    const values = {
      account_username: input.username,
      ...(input.password
        ? { account_secret_encrypted: encryptSecret(this.configuration.childDataEncryptionKey, input.password) }
        : {}),
      updated_by: origin.actorUserId,
    };
    const saved = await this.databases.system
      .insertInto('integration_credentials')
      .values({ connector, ...values })
      .onConflict((conflict) => conflict.column('connector').doUpdateSet({ ...values, updated_at: this.clock.now() }))
      .returning('id')
      .executeTakeFirstOrThrow();
    await this.audit(saved.id, before ? 'update' : 'create', origin, {
      before: before ? { username: before.account_username } : null,
      after: { connector, username: input.username, password: input.password ? 'đã thay' : 'giữ nguyên' },
    });
    return (await this.list()).find((item) => item.target === target);
  }

  async remove(target: SyncTarget, origin: ChangeOrigin): Promise<void> {
    const connector = SYNC_TARGETS[target].connector;
    const before = await this.read(connector);
    if (!before) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Chưa lưu tài khoản đồng bộ này');
    }
    await this.databases.system.deleteFrom('integration_credentials').where('connector', '=', connector).execute();
    await this.audit(before.id, 'delete', origin, {
      before: { connector, username: before.account_username },
      after: null,
    });
  }

  // Chỗ nối: bộ đồng bộ với Bộ, Sở đọc tên đăng nhập, mật khẩu đã giải mã; không trả qua API
  async readCredentials(target: SyncTarget): Promise<{ username: string; password: string } | null> {
    const row = await this.read(SYNC_TARGETS[target].connector);
    if (!row?.account_username || !row.account_secret_encrypted) {
      return null;
    }
    return {
      username: row.account_username,
      password: decryptSecret(this.configuration.childDataEncryptionKey, row.account_secret_encrypted),
    };
  }

  private read(connector: IntegrationCredentialConnector) {
    return this.databases.system
      .selectFrom('integration_credentials')
      .select(['id', 'account_username', 'account_secret_encrypted'])
      .where('connector', '=', connector)
      .executeTakeFirst();
  }

  // Nhật ký thay đổi ở năm học hiện hành như kết nối ngoài; chưa có năm học thì bỏ qua nhật ký
  private async audit(
    entityId: string,
    action: 'create' | 'update' | 'delete',
    origin: ChangeOrigin,
    data: { before: unknown; after: unknown },
  ): Promise<void> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return;
    }
    await writeAuditLog(current.database, {
      origin,
      orgUnitId: null,
      entityName: 'integration_credentials',
      entityId,
      action,
      before: data.before,
      after: data.after,
    });
  }
}

function readTarget(value: string): SyncTarget {
  if (value !== 'moet' && value !== 'doet') {
    throw new ApplicationError('ERR_NOT_FOUND', 'Không có loại tài khoản đồng bộ này');
  }
  return value;
}

@Controller('sync-accounts')
export class SyncAccountsController {
  constructor(private readonly service: SyncAccountsService) {}

  @Get()
  @RequirePermission(PERMISSION_CODES.integrationManage)
  list() {
    return this.service.list();
  }

  @Put(':target')
  @RequirePermission(PERMISSION_CODES.integrationManage)
  save(
    @Param('target') target: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const syncTarget = readTarget(target);
    const errors: FieldError[] = [];
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    if (!username) {
      errors.push({ field: 'username', message: 'Bắt buộc nhập tên đăng nhập' });
    } else if (username.length > USERNAME_MAXIMUM) {
      errors.push({ field: 'username', message: `Tên đăng nhập tối đa ${USERNAME_MAXIMUM} ký tự` });
    }
    const rawPassword = body?.password;
    let password: string | null = null;
    if (rawPassword !== undefined && rawPassword !== null && rawPassword !== '') {
      if (typeof rawPassword !== 'string' || rawPassword.length > PASSWORD_MAXIMUM) {
        errors.push({ field: 'password', message: `Mật khẩu tối đa ${PASSWORD_MAXIMUM} ký tự` });
      } else {
        password = rawPassword;
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.save(syncTarget, { username, password }, originOf(request, currentUser));
  }

  @Delete(':target')
  @HttpCode(204)
  @RequirePermission(PERMISSION_CODES.integrationManage)
  async remove(
    @Param('target') target: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.service.remove(readTarget(target), originOf(request, currentUser));
  }
}
