import { Body, Controller, Get, HttpCode, Inject, Injectable, Optional, Param, Patch, Post, Req } from '@nestjs/common';
import {
  writeAudit,
  type PlatformDatabase,
  type PlatformOperatorRole,
  type TenancyRuntime,
} from '@school-management/database';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { checkNationalId, maskLoginIdentifier } from '../accounts/national-id.js';
import { generateTemporaryPassword } from '../accounts/temporary-password.js';
import { IDENTITY_CONFIGURATION, TENANCY_RUNTIME, type IdentityConfiguration } from '../common/configuration.js';
import { createPlatformOperatorWithTotp, enrollOperatorTotp, PlatformOperatorsService } from './platform-operators.js';
import { PlatformSchoolsService } from './platform-schools.js';
import { SupportSessionsService } from './support-sessions.js';
import { operatorCan, operatorRolesFor } from '@school-management/shared';

// Nhân viên vận hành của công ty (YCTD-311): quản trị nền tảng tạo tài khoản, phân vai, khóa, mở khóa, cấp lại khóa xác thực hai lớp
// ở cổng nền tảng. Nhân viên chỉ vào dữ liệu trường qua phiên hỗ trợ trường đã cấp (support_access_grants, support-sessions), không
// có tài khoản ở trường nào. Xác thực hai lớp bắt buộc: tạo tài khoản là đăng ký luôn khóa TOTP, mật khẩu tạm, mã khôi phục, chỉ trả
// một lần để quản trị trao tận tay. Thao tác tạo và cấp lại khóa phải nhập mã xác thực hai lớp của người thao tác
export const OPERATOR_ROLES: readonly PlatformOperatorRole[] = ['quan_tri', 'ho_tro', 'ky_thuat', 'ke_toan'];

export const OPERATOR_ROLE_LABELS: Record<PlatformOperatorRole, string> = {
  quan_tri: 'Quản trị',
  ho_tro: 'Hỗ trợ',
  ky_thuat: 'Kỹ thuật',
  ke_toan: 'Kế toán',
};

// Tên đăng nhập của nhân viên vận hành: số CCCD cho thống nhất với tài khoản trường (mặc định), hoặc thư điện tử công ty khi đặt
// PLATFORM_OPERATOR_LOGIN_RULE=email (cấu hình platformOperatorLoginRule). Tài khoản đã có (tạo bằng lệnh) giữ tên đăng nhập cũ
export type OperatorLoginRule = 'cccd' | 'email';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function checkOperatorLogin(login: string, rule: OperatorLoginRule): FieldError[] {
  if (rule === 'email') {
    return EMAIL_PATTERN.test(login) ? [] : [{ field: 'login', message: 'Tên đăng nhập là thư điện tử công ty' }];
  }
  return checkNationalId('login', login);
}

function readRole(value: unknown, errors: FieldError[]): PlatformOperatorRole | undefined {
  if (typeof value === 'string' && (OPERATOR_ROLES as readonly string[]).includes(value)) {
    return value as PlatformOperatorRole;
  }
  errors.push({ field: 'role', message: 'Vai trò là quan_tri, ho_tro, ky_thuat hoặc ke_toan' });
  return undefined;
}

function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy nhân viên vận hành');
}

@Injectable()
export class PlatformOperatorAdminService {
  constructor(
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null,
    @Inject(IDENTITY_CONFIGURATION) private readonly configuration: IdentityConfiguration,
    private readonly operators: PlatformOperatorsService,
    private readonly clock: Clock,
    private readonly support: SupportSessionsService,
  ) {}

  private get platform(): Kysely<PlatformDatabase> {
    return this.operators.platformDatabase();
  }

  private loginRule(): OperatorLoginRule {
    return this.configuration.platformOperatorLoginRule ?? 'cccd';
  }

  private masterKey(): Buffer {
    const key = this.tenancy?.configuration.masterKey;
    if (!key) {
      throw notFound();
    }
    return key;
  }

  async list() {
    const rows = await this.platform
      .selectFrom('platform_operators')
      .leftJoin('platform_operator_totp', 'platform_operator_totp.operator_id', 'platform_operators.id')
      .select([
        'platform_operators.id',
        'platform_operators.login',
        'platform_operators.full_name',
        'platform_operators.role',
        'platform_operators.status',
        'platform_operators.locked_until',
        'platform_operators.last_login_at',
        'platform_operators.created_at',
        'platform_operator_totp.operator_id as totp_operator_id',
      ])
      .orderBy('platform_operators.full_name')
      .execute();
    return {
      login_rule: this.loginRule(),
      items: rows.map(({ totp_operator_id: totpOperatorId, ...row }) => ({
        ...row,
        // Số CCCD chỉ hiện dạng che ở danh sách (YCTD-311)
        login: maskLoginIdentifier(row.login),
        totp_enrolled: totpOperatorId !== null,
      })),
    };
  }

  async create(body: Record<string, unknown> | undefined, actor: { id: string }, ipAddress: string | null) {
    const errors: FieldError[] = [];
    const login = typeof body?.login === 'string' ? body.login.trim().toLowerCase() : '';
    const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : '';
    if (!fullName) {
      errors.push({ field: 'full_name', message: 'Bắt buộc nhập họ tên' });
    }
    errors.push(...checkOperatorLogin(login, this.loginRule()));
    const role = readRole(body?.role, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    await this.reauthenticate(actor.id, body, ipAddress);
    const existing = await this.platform
      .selectFrom('platform_operators')
      .select('id')
      .where('login', '=', login)
      .executeTakeFirst();
    if (existing) {
      throw new ApplicationError('ERR_CONFLICT', 'Tên đăng nhập đã có', [
        { field: 'login', message: 'Tên đăng nhập đã có' },
      ]);
    }
    // Mật khẩu tạm 12 ký tự, đủ độ dài tối thiểu của tài khoản vận hành; bắt đổi khi đăng nhập lần đầu
    const password = generateTemporaryPassword();
    const created = await createPlatformOperatorWithTotp(this.platform, this.masterKey(), {
      login,
      fullName,
      password,
      role,
      mustChangePassword: true,
    });
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'operator.create',
      details: { operator_id: created.id, login: maskLoginIdentifier(login), role, ip: ipAddress },
    });
    return {
      id: created.id,
      temporary_password: password,
      totp_secret: created.secret,
      otpauth_uri: created.otpauthUri,
      recovery_codes: created.recoveryCodes,
    };
  }

  // Đổi vai trò, khóa, mở khóa. Không tự khóa hoặc tự hạ vai trò của mình, để nền tảng luôn còn người quản trị
  async update(id: string, body: Record<string, unknown> | undefined, actor: { id: string }) {
    if (!UUID_PATTERN.test(id)) {
      throw notFound();
    }
    const errors: FieldError[] = [];
    const role = body?.role === undefined ? undefined : readRole(body.role, errors);
    const status =
      body?.status === undefined
        ? undefined
        : body.status === 'active' || body.status === 'locked'
          ? body.status
          : (errors.push({ field: 'status', message: 'Trạng thái là active hoặc locked' }), undefined);
    if (role === undefined && status === undefined && errors.length === 0) {
      errors.push({ field: 'role', message: 'Cần vai trò hoặc trạng thái' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    if (id === actor.id && (status === 'locked' || (role !== undefined && role !== 'quan_tri'))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Không tự khóa hoặc tự bỏ vai trò quản trị của mình');
    }
    const now = this.clock.now();
    const updated = await this.platform
      .updateTable('platform_operators')
      .set({
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        ...(status === 'active' ? { failed_login_count: 0, locked_until: null } : {}),
        updated_at: now,
      })
      .where('id', '=', id)
      .returning(['id', 'role', 'status'])
      .executeTakeFirst();
    if (!updated) {
      throw notFound();
    }
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'operator.update',
      details: { operator_id: id, role, status },
    });
    // Bị khóa hoặc không còn được mở phiên hỗ trợ: phiên vào trường đang mở của người đó kết thúc ngay (YCTD-377)
    if (updated.status !== 'active' || !operatorCan(updated.role, 'support.open')) {
      await this.support.endForRequester(
        'operator',
        id,
        updated.status !== 'active' ? 'Nhân viên vận hành bị khóa' : 'Nhân viên vận hành đổi vai trò',
        { type: 'operator', id: actor.id, name: 'Quản trị nền tảng' },
      );
    }
    return updated;
  }

  // Cấp lại khóa xác thực hai lớp khi nhân viên mất điện thoại; khóa cũ và mã khôi phục cũ hết hiệu lực
  async resetTotp(
    id: string,
    body: Record<string, unknown> | undefined,
    actor: { id: string },
    ipAddress: string | null,
  ) {
    if (!UUID_PATTERN.test(id)) {
      throw notFound();
    }
    await this.reauthenticate(actor.id, body, ipAddress);
    const row = await this.platform
      .selectFrom('platform_operators')
      .select(['id', 'login'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) {
      throw notFound();
    }
    const enrolled = await enrollOperatorTotp(this.platform, this.masterKey(), row.id, row.login);
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'operator.totp-reset',
      details: { operator_id: id, ip: ipAddress },
    });
    return { totp_secret: enrolled.secret, otpauth_uri: enrolled.otpauthUri, recovery_codes: enrolled.recoveryCodes };
  }

  private async reauthenticate(actorId: string, body: Record<string, unknown> | undefined, ipAddress: string | null) {
    const otp = typeof body?.otp_code === 'string' ? body.otp_code.trim() : '';
    await this.operators.assertSecondFactor(actorId, otp || undefined, ipAddress, this.clock.now());
  }
}

@Controller('auth/platform/operators')
export class PlatformOperatorAdminController {
  constructor(
    private readonly admin: PlatformOperatorAdminService,
    private readonly schools: PlatformSchoolsService,
  ) {}

  @Get()
  async list(@Req() request: Request) {
    await this.schools.actor(request, operatorRolesFor('operators.manage'));
    return this.admin.list();
  }

  @Post()
  async create(@Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    const actor = await this.schools.actor(request, operatorRolesFor('operators.manage'));
    return this.admin.create(body, { id: actor.id ?? '' }, request.ip ?? null);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    const actor = await this.schools.actor(request, operatorRolesFor('operators.manage'));
    return this.admin.update(id, body, { id: actor.id ?? '' });
  }

  @Post(':id/totp-reset')
  @HttpCode(200)
  async resetTotp(@Param('id') id: string, @Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    const actor = await this.schools.actor(request, operatorRolesFor('operators.manage'));
    return this.admin.resetTotp(id, body, { id: actor.id ?? '' }, request.ip ?? null);
  }
}
