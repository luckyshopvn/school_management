import { Body, Controller, Get, HttpCode, Inject, Injectable, Optional, Param, Post, Put, Req } from '@nestjs/common';
import {
  ADMIN_UNIT_LEVEL_LABELS,
  AGGREGATE_CATEGORIES,
  AGGREGATE_CATEGORY_LABELS,
  CHILD_LEVEL,
  defaultAdminUnits,
  importAdminUnits,
  isAdminUnitLevel,
  isAggregateCategory,
  subtreeUnitIds,
  writeAudit,
  type AdminUnitLevel,
  type AdminUnitSeed,
  type PlatformDatabase,
  type TenancyRuntime,
} from '@school-management/database';
import {
  ApplicationError,
  Clock,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  readBearerToken,
  ruleViolationError,
  totpUri,
  unauthenticatedError,
  validationError,
  verifyTotp,
  type FieldError,
} from '@school-management/server';
import { decryptSecret, encryptSecret } from '@school-management/server/tenancy';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import {
  checkPasswordPolicy,
  hashPassword,
  passwordNeedsRehash,
  placeholderPasswordHash,
  verifyPassword,
} from '../authentication/password.js';
import { OTP_REQUIRED_MESSAGE } from '../authentication/totp.service.js';
import { TokenService } from '../authentication/token.service.js';
import { TENANCY_RUNTIME } from '../common/configuration.js';
import { OPERATOR_MINIMUM_PASSWORD_LENGTH, PlatformOperatorsService } from './platform-operators.js';
import { PlatformSchoolsService } from './platform-schools.js';
import { SupportSessionsService } from './support-sessions.js';
import { operatorRolesFor, type OperatorCapability } from '@school-management/shared';

// Đơn vị cấp trên ở dịch vụ định danh (DT-SaaS phần S6, YCTD-202; tài liệu 47 mục 14.5 "S6"). Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11:
// - người vận hành quản lý cây đơn vị hành chính (thêm, sửa, ngừng, gộp, tách, nạp bộ nút mặc định hoặc tệp danh mục), gắn trường
//   vào nút quản lý, tạo tài khoản cấp trên (mật khẩu tối thiểu 12 ký tự như tài khoản vận hành, xác thực hai lớp bắt buộc: khóa
//   TOTP và mã khôi phục trả một lần khi tạo, cấp lại);
// - tài khoản cấp trên đăng nhập ở tên miền của cổng nền tảng (trang Đơn vị cấp trên), mã phiên có đối tượng riêng; số liệu tổng
//   hợp đọc ở máy chủ API (`/api/v1/parent-org/*`) bằng mã phiên này;
// - xem chi tiết: tài khoản cấp trên gửi đề nghị (trường trong phạm vi, nhóm dữ liệu, lý do, thời hạn), quản trị trường duyệt ở cổng
//   quản trị; đề nghị đã duyệt mở phiên hỗ trợ chỉ đọc của S4 (đường liên kết một lần), mỗi lần mở ghi nhật ký của nền tảng và của
//   trường; trường rút được bất kỳ lúc nào.
export const PARENT_ORG_RULE_CODE = 'YCTD-202';
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const CODE_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
}

function text(body: Record<string, unknown> | undefined, field: string): string {
  const value = body?.[field];
  return typeof value === 'string' ? value.trim() : '';
}

interface ParentOrgUserRow {
  id: string;
  login: string;
  full_name: string;
  admin_unit_id: string;
  status: 'active' | 'locked';
}

@Injectable()
export class ParentOrgsService {
  constructor(
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null,
    private readonly tokenService: TokenService,
    private readonly operators: PlatformOperatorsService,
    private readonly support: SupportSessionsService,
    private readonly clock: Clock,
  ) {}

  private get platform(): Kysely<PlatformDatabase> {
    if (!this.tenancy) {
      throw notFound();
    }
    return this.tenancy.platform;
  }

  private get masterKey(): Buffer {
    return this.tenancy?.configuration.masterKey as Buffer;
  }

  // ----- Cây đơn vị (người vận hành) -----

  async units() {
    const [units, schools, users] = await Promise.all([
      this.platform
        .selectFrom('admin_units')
        .select(['id', 'level', 'code', 'name', 'parent_id', 'status', 'merged_into_id', 'updated_at'])
        .orderBy('level')
        .orderBy('name')
        .execute(),
      this.platform
        .selectFrom('schools')
        .select(['id', 'code', 'name', 'status', 'admin_unit_id'])
        .where('status', '!=', 'deleted')
        .orderBy('code')
        .execute(),
      this.platform
        .selectFrom('parent_org_users')
        .select(['id', 'login', 'full_name', 'admin_unit_id', 'status', 'last_login_at'])
        .orderBy('login')
        .execute(),
    ]);
    return {
      levels: ADMIN_UNIT_LEVEL_LABELS,
      units: units.map((unit) => ({
        ...unit,
        school_count: schools.filter((school) => school.admin_unit_id === unit.id).length,
        user_count: users.filter((user) => user.admin_unit_id === unit.id).length,
      })),
      schools,
      users,
    };
  }

  private async unitById(id: string) {
    const unit = await this.platform.selectFrom('admin_units').selectAll().where('id', '=', id).executeTakeFirst();
    if (!unit) {
      throw notFound();
    }
    return unit;
  }

  async createUnit(body: Record<string, unknown> | undefined, actor: { id: string; name: string }) {
    const errors: FieldError[] = [];
    const level = body?.level;
    const code = text(body, 'code').toLowerCase();
    const name = text(body, 'name');
    const parentId = typeof body?.parent_id === 'string' && body.parent_id ? body.parent_id : null;
    if (!isAdminUnitLevel(level)) errors.push({ field: 'level', message: 'Cấp là Bộ, Sở hoặc Phòng' });
    if (!CODE_PATTERN.test(code)) errors.push({ field: 'code', message: 'Mã chữ thường, số, gạch ngang' });
    if (!name || name.length > 200) errors.push({ field: 'name', message: 'Tên từ 1 đến 200 ký tự' });
    if (errors.length) throw validationError(errors);
    const parent = parentId ? await this.unitById(parentId) : null;
    if ((parent ? CHILD_LEVEL[parent.level] : 'ministry') !== level) {
      throw validationError([{ field: 'parent_id', message: 'Bộ không có nút cha; Sở thuộc Bộ; Phòng thuộc Sở' }]);
    }
    if (await this.platform.selectFrom('admin_units').select('id').where('code', '=', code).executeTakeFirst()) {
      throw new ApplicationError('ERR_CONFLICT', 'Mã đơn vị đã có');
    }
    const unit = await this.platform
      .insertInto('admin_units')
      .values({ level: level as AdminUnitLevel, code, name, parent_id: parent?.id ?? null })
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'admin-unit.create',
      details: { code, level },
    });
    return unit;
  }

  async updateUnit(id: string, body: Record<string, unknown> | undefined, actor: { id: string; name: string }) {
    const unit = await this.unitById(id);
    if (unit.status === 'merged') {
      throw ruleViolationError(PARENT_ORG_RULE_CODE, 'Nút đã gộp, sửa ở nút nhận');
    }
    const name = text(body, 'name') || unit.name;
    const status = body?.status === 'inactive' ? 'inactive' : body?.status === 'active' ? 'active' : unit.status;
    if (name.length > 200) throw validationError([{ field: 'name', message: 'Tên đến 200 ký tự' }]);
    const updated = await this.platform
      .updateTable('admin_units')
      .set({ name, status, updated_at: this.clock.now() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'admin-unit.update',
      details: { code: unit.code, before: { name: unit.name, status: unit.status }, after: { name, status } },
    });
    return updated;
  }

  // Gộp: chuyển nút con, trường, tài khoản cấp trên sang nút nhận cùng cấp; nút cũ giữ lại ở trạng thái `merged`
  async mergeUnit(id: string, body: Record<string, unknown> | undefined, actor: { id: string; name: string }) {
    const source = await this.unitById(id);
    const target = await this.unitById(text(body, 'into_id'));
    if (source.id === target.id || source.level !== target.level || target.status !== 'active') {
      throw validationError([{ field: 'into_id', message: 'Nút nhận phải khác nút gộp, cùng cấp và đang dùng' }]);
    }
    const now = this.clock.now();
    await this.platform.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('admin_units')
        .set({ parent_id: target.id, updated_at: now })
        .where('parent_id', '=', source.id)
        .execute();
      await transaction
        .updateTable('schools')
        .set({ admin_unit_id: target.id })
        .where('admin_unit_id', '=', source.id)
        .execute();
      await transaction
        .updateTable('parent_org_users')
        .set({ admin_unit_id: target.id, updated_at: now })
        .where('admin_unit_id', '=', source.id)
        .execute();
      await transaction
        .updateTable('admin_units')
        .set({ status: 'merged', merged_into_id: target.id, updated_at: now })
        .where('id', '=', source.id)
        .execute();
    });
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'admin-unit.merge',
      details: { from: source.code, into: target.code },
    });
    return { merged: source.code, into: target.code };
  }

  // Tách: tạo nút mới cùng cấp, cùng nút cha, chuyển các trường và nút con được chọn sang
  async splitUnit(id: string, body: Record<string, unknown> | undefined, actor: { id: string; name: string }) {
    const source = await this.unitById(id);
    const schoolIds = Array.isArray(body?.school_ids)
      ? body.school_ids.filter((value): value is string => typeof value === 'string')
      : [];
    const childIds = Array.isArray(body?.child_ids)
      ? body.child_ids.filter((value): value is string => typeof value === 'string')
      : [];
    const created = await this.createUnit(
      { level: source.level, code: body?.code, name: body?.name, parent_id: source.parent_id ?? '' },
      actor,
    );
    const now = this.clock.now();
    if (schoolIds.length) {
      await this.platform
        .updateTable('schools')
        .set({ admin_unit_id: created.id })
        .where('id', 'in', schoolIds)
        .where('admin_unit_id', '=', source.id)
        .execute();
    }
    if (childIds.length) {
      await this.platform
        .updateTable('admin_units')
        .set({ parent_id: created.id, updated_at: now })
        .where('id', 'in', childIds)
        .where('parent_id', '=', source.id)
        .execute();
    }
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'admin-unit.split',
      details: { from: source.code, to: created.code, schools: schoolIds.length, children: childIds.length },
    });
    return created;
  }

  async importUnits(body: Record<string, unknown> | undefined, actor: { id: string; name: string }) {
    let units: AdminUnitSeed[];
    if (body?.preset === 'default') {
      units = defaultAdminUnits();
    } else if (Array.isArray(body?.units)) {
      units = (body.units as Array<Record<string, unknown>>).map((item) => ({
        level: item.level as AdminUnitLevel,
        code: String(item.code ?? '')
          .trim()
          .toLowerCase(),
        name: String(item.name ?? '').trim(),
        parent_code:
          typeof item.parent_code === 'string' && item.parent_code ? item.parent_code.trim().toLowerCase() : null,
      }));
      const bad = units.findIndex(
        (unit) => !isAdminUnitLevel(unit.level) || !CODE_PATTERN.test(unit.code) || !unit.name,
      );
      if (bad >= 0) {
        throw validationError([{ field: 'units', message: `Dòng ${bad + 1}: cấp, mã hoặc tên không hợp lệ` }]);
      }
    } else {
      throw validationError([{ field: 'units', message: 'Gửi danh sách nút hoặc preset "default"' }]);
    }
    let result: { created: number; skipped: number };
    try {
      result = await importAdminUnits(this.platform, units);
    } catch (error) {
      throw validationError([{ field: 'units', message: error instanceof Error ? error.message : 'Không nạp được' }]);
    }
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'admin-unit.import',
      details: result,
    });
    return result;
  }

  async assignSchool(code: string, body: Record<string, unknown> | undefined, actor: { id: string; name: string }) {
    const school = await this.platform
      .selectFrom('schools')
      .select(['id', 'admin_unit_id'])
      .where('code', '=', code)
      .executeTakeFirst();
    if (!school) {
      throw notFound();
    }
    const unitId = typeof body?.admin_unit_id === 'string' && body.admin_unit_id ? body.admin_unit_id : null;
    if (unitId) {
      const unit = await this.unitById(unitId);
      if (unit.status !== 'active') {
        throw validationError([{ field: 'admin_unit_id', message: 'Nút không đang dùng' }]);
      }
    }
    await this.platform.updateTable('schools').set({ admin_unit_id: unitId }).where('id', '=', school.id).execute();
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'school.admin-unit',
      schoolId: school.id,
      details: { before: school.admin_unit_id, after: unitId },
    });
    return { code, admin_unit_id: unitId };
  }

  // ----- Tài khoản cấp trên (người vận hành) -----

  async createUser(body: Record<string, unknown> | undefined, actor: { id: string; name: string }) {
    const login = text(body, 'login').toLowerCase();
    const fullName = text(body, 'full_name');
    const password = typeof body?.password === 'string' ? body.password : '';
    const unitId = text(body, 'admin_unit_id');
    const errors: FieldError[] = [];
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(login))
      errors.push({ field: 'login', message: 'Tên đăng nhập 3 đến 64 ký tự' });
    if (!fullName) errors.push({ field: 'full_name', message: 'Bắt buộc nhập' });
    errors.push(...checkPasswordPolicy('password', password, OPERATOR_MINIMUM_PASSWORD_LENGTH));
    if (errors.length) throw validationError(errors);
    const unit = await this.unitById(unitId);
    if (unit.status !== 'active') throw validationError([{ field: 'admin_unit_id', message: 'Nút không đang dùng' }]);
    if (await this.platform.selectFrom('parent_org_users').select('id').where('login', '=', login).executeTakeFirst()) {
      throw new ApplicationError('ERR_CONFLICT', 'Tên đăng nhập đã có');
    }
    const user = await this.platform
      .insertInto('parent_org_users')
      .values({
        login,
        full_name: fullName,
        password_hash: await hashPassword(password),
        admin_unit_id: unit.id,
        created_by_name: actor.name,
      })
      .returning(['id', 'login', 'full_name', 'admin_unit_id', 'status'])
      .executeTakeFirstOrThrow();
    const enrollment = await enrollParentOrgTotp(this.platform, this.masterKey, user.id, login);
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'parent-org.user-create',
      details: { login, unit: unit.code },
    });
    return { user, totp: enrollment };
  }

  async resetTotp(id: string, actor: { id: string; name: string }) {
    const user = await this.platform
      .selectFrom('parent_org_users')
      .select(['id', 'login'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!user) throw notFound();
    const enrollment = await enrollParentOrgTotp(this.platform, this.masterKey, user.id, user.login);
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'parent-org.totp-reset',
      details: { login: user.login },
    });
    return enrollment;
  }

  async setUserStatus(id: string, body: Record<string, unknown> | undefined, actor: { id: string; name: string }) {
    const status = body?.status === 'locked' ? 'locked' : body?.status === 'active' ? 'active' : null;
    if (!status) throw validationError([{ field: 'status', message: 'Trạng thái là active hoặc locked' }]);
    const user = await this.platform
      .updateTable('parent_org_users')
      .set({ status, failed_login_count: 0, locked_until: null, updated_at: this.clock.now() })
      .where('id', '=', id)
      .returning(['id', 'login', 'status'])
      .executeTakeFirst();
    if (!user) throw notFound();
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: `parent-org.user-${status}`,
      details: { login: user.login },
    });
    // Tài khoản cấp trên bị khóa: phiên xem chi tiết đang mở kết thúc ngay (YCTD-377)
    if (status === 'locked') {
      await this.support.endForRequester('parent_org', id, 'Tài khoản cấp trên bị khóa', {
        type: 'operator',
        id: actor.id,
        name: actor.name,
      });
    }
    return user;
  }

  // ----- Tài khoản cấp trên tự dùng -----

  async login(body: Record<string, unknown> | undefined, ipAddress: string | null) {
    const login = text(body, 'login').toLowerCase();
    const password = typeof body?.password === 'string' ? body.password : '';
    const otpCode = typeof body?.otp_code === 'string' ? body.otp_code : undefined;
    if (!login || !password) {
      throw validationError([{ field: 'login', message: 'Nhập tên đăng nhập và mật khẩu' }]);
    }
    const platform = this.platform;
    const row = await platform.selectFrom('parent_org_users').selectAll().where('login', '=', login).executeTakeFirst();
    const now = this.clock.now();
    if (!row) {
      await verifyPassword(await placeholderPasswordHash(), password);
      throw unauthenticatedError('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    if (row.status === 'locked' || (row.locked_until && row.locked_until.getTime() > now.getTime())) {
      await verifyPassword(await placeholderPasswordHash(), password);
      throw unauthenticatedError('Tài khoản tạm khóa, vui lòng thử lại sau');
    }
    if (!(await verifyPassword(row.password_hash, password))) {
      await this.registerFailure(row.id, row.failed_login_count, 'parent-org.login-failed', ipAddress, now);
      throw unauthenticatedError('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    await this.assertSecondFactor(row.id, otpCode, ipAddress, now);
    // Giá trị băm dùng tham số cũ yếu hơn thì băm lại khi đăng nhập đúng (YCTD-311)
    const rehashed = passwordNeedsRehash(row.password_hash) ? { password_hash: await hashPassword(password) } : {};
    await platform
      .updateTable('parent_org_users')
      .set({ ...rehashed, failed_login_count: 0, locked_until: null, last_login_at: now, updated_at: now })
      .where('id', '=', row.id)
      .execute();
    await writeAudit(platform, {
      actorType: 'system',
      action: 'parent-org.login',
      details: { user_id: row.id, ip: ipAddress },
    });
    return { access_token: await this.tokenService.signParentOrgToken(row.id), user: await this.describe(row.id) };
  }

  private async registerFailure(userId: string, previous: number, action: string, ipAddress: string | null, now: Date) {
    const failures = previous + 1;
    const lock = failures >= MAX_FAILED_LOGINS;
    await this.platform
      .updateTable('parent_org_users')
      .set({
        failed_login_count: lock ? 0 : failures,
        locked_until: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
        updated_at: now,
      })
      .where('id', '=', userId)
      .execute();
    await writeAudit(this.platform, {
      actorType: 'system',
      action: lock ? 'parent-org.login-locked' : action,
      details: { user_id: userId, ip: ipAddress },
    });
  }

  // Xác thực hai lớp bắt buộc như tài khoản vận hành (S8b): mã TOTP 6 số dùng một lần theo bước thời gian, hoặc mã khôi phục
  private async assertSecondFactor(userId: string, otpCode: string | undefined, ipAddress: string | null, now: Date) {
    const platform = this.platform;
    const totp = await platform
      .selectFrom('parent_org_user_totp')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!totp) {
      throw unauthenticatedError(
        'Tài khoản chưa đăng ký xác thực hai lớp (bắt buộc); đề nghị người vận hành nền tảng cấp lại',
      );
    }
    if (!otpCode) {
      throw new ApplicationError('ERR_UNAUTHENTICATED', 'Cần mã xác thực hai lớp', [
        { field: 'otp_code', message: OTP_REQUIRED_MESSAGE },
      ]);
    }
    const lastStep = totp.last_step === null ? null : Number(totp.last_step);
    const step = verifyTotp(decryptSecret(this.masterKey, totp.secret_encrypted), otpCode, now, {
      lastUsedStep: lastStep,
    });
    let accepted = false;
    if (step !== null) {
      const updated = await platform
        .updateTable('parent_org_user_totp')
        .set({ last_step: String(step) })
        .where('user_id', '=', userId)
        .where((expression) =>
          expression.or([expression('last_step', 'is', null), expression('last_step', '<', String(step))]),
        )
        .executeTakeFirst();
      accepted = Number(updated.numUpdatedRows) > 0;
    } else if (!/^\d{6}$/.test(otpCode.trim())) {
      const consumed = await platform
        .updateTable('parent_org_user_recovery_codes')
        .set({ used_at: now })
        .where('user_id', '=', userId)
        .where('code_hash', '=', hashRecoveryCode(otpCode))
        .where('used_at', 'is', null)
        .executeTakeFirst();
      accepted = Number(consumed.numUpdatedRows) > 0;
    }
    if (!accepted) {
      const row = await platform
        .selectFrom('parent_org_users')
        .select('failed_login_count')
        .where('id', '=', userId)
        .executeTakeFirstOrThrow();
      await this.registerFailure(userId, row.failed_login_count, 'parent-org.totp-failed', ipAddress, now);
      throw unauthenticatedError('Mã xác thực hai lớp không đúng');
    }
  }

  async userFromRequest(request: Request): Promise<ParentOrgUserRow> {
    this.operators.assertConsoleHost(request);
    const userId = await this.tokenService.verifyParentOrgToken(readBearerToken(request.header('authorization')));
    const row = await this.platform
      .selectFrom('parent_org_users')
      .select(['id', 'login', 'full_name', 'admin_unit_id', 'status'])
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!row || row.status !== 'active') {
      throw unauthenticatedError();
    }
    return row;
  }

  async describe(userId: string) {
    const user = await this.platform
      .selectFrom('parent_org_users')
      .innerJoin('admin_units', 'admin_units.id', 'parent_org_users.admin_unit_id')
      .select([
        'parent_org_users.id',
        'parent_org_users.login',
        'parent_org_users.full_name',
        'admin_units.id as unit_id',
        'admin_units.code as unit_code',
        'admin_units.name as unit_name',
        'admin_units.level as unit_level',
      ])
      .where('parent_org_users.id', '=', userId)
      .executeTakeFirstOrThrow();
    const unitIds = await subtreeUnitIds(this.platform, user.unit_id);
    const units = await this.platform
      .selectFrom('admin_units')
      .select(['id', 'code', 'name', 'level', 'parent_id'])
      .where('id', 'in', unitIds)
      .orderBy('level')
      .orderBy('name')
      .execute();
    const schools = await this.platform
      .selectFrom('schools')
      .select(['id', 'code', 'name', 'admin_unit_id'])
      .where('admin_unit_id', 'in', unitIds)
      .where('status', 'in', ['trial', 'active', 'read_only'])
      .orderBy('name')
      .execute();
    return {
      id: user.id,
      login: user.login,
      full_name: user.full_name,
      unit: { id: user.unit_id, code: user.unit_code, name: user.unit_name, level: user.unit_level },
      level_label: ADMIN_UNIT_LEVEL_LABELS[user.unit_level],
      units,
      schools,
      categories: AGGREGATE_CATEGORIES.map((key) => ({ key, label: AGGREGATE_CATEGORY_LABELS[key] })),
    };
  }

  async listRequests(user: ParentOrgUserRow) {
    return {
      items: await this.platform
        .selectFrom('parent_org_access_requests')
        .innerJoin('schools', 'schools.id', 'parent_org_access_requests.school_id')
        .select([
          'parent_org_access_requests.id',
          'schools.code as school_code',
          'schools.name as school_name',
          'parent_org_access_requests.categories',
          'parent_org_access_requests.reason',
          'parent_org_access_requests.hours',
          'parent_org_access_requests.status',
          'parent_org_access_requests.decided_at',
          'parent_org_access_requests.decided_by_name',
          'parent_org_access_requests.expires_at',
          'parent_org_access_requests.revoked_at',
          'parent_org_access_requests.withdrawn_at',
          'parent_org_access_requests.created_at',
        ])
        .where('parent_org_access_requests.user_id', '=', user.id)
        .orderBy('parent_org_access_requests.created_at', 'desc')
        .limit(50)
        .execute(),
    };
  }

  // Đề nghị xem chi tiết một trường trong phạm vi; trường duyệt ở cổng quản trị của trường
  async createRequest(user: ParentOrgUserRow, body: Record<string, unknown> | undefined) {
    const code = text(body, 'school_code');
    const reason = text(body, 'reason');
    const hours = body?.hours === undefined ? 24 : Number(body.hours);
    const categories = Array.isArray(body?.categories) ? [...new Set(body.categories.filter(isAggregateCategory))] : [];
    const errors: FieldError[] = [];
    if (reason.length < 5 || reason.length > 500) errors.push({ field: 'reason', message: 'Lý do từ 5 đến 500 ký tự' });
    if (!Number.isInteger(hours) || hours < 1 || hours > 168)
      errors.push({ field: 'hours', message: 'Thời hạn từ 1 đến 168 giờ' });
    if (!categories.length) errors.push({ field: 'categories', message: 'Chọn ít nhất một nhóm dữ liệu' });
    if (errors.length) throw validationError(errors);
    const school = await this.platform
      .selectFrom('schools')
      .select(['id', 'admin_unit_id'])
      .where('code', '=', code)
      .executeTakeFirst();
    const scope = await subtreeUnitIds(this.platform, user.admin_unit_id);
    if (!school || !school.admin_unit_id || !scope.includes(school.admin_unit_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Trường không thuộc phạm vi của đơn vị');
    }
    const unit = await this.unitById(user.admin_unit_id);
    const created = await this.platform
      .insertInto('parent_org_access_requests')
      .values({
        school_id: school.id,
        user_id: user.id,
        user_name: user.full_name,
        unit_name: unit.name,
        categories: JSON.stringify(categories),
        reason,
        hours,
      })
      .returning(['id', 'status', 'created_at'])
      .executeTakeFirstOrThrow();
    await writeAudit(this.platform, {
      actorType: 'system',
      action: 'parent-org.access-requested',
      schoolId: school.id,
      details: { request_id: created.id, user_id: user.id, categories, hours },
    });
    return created;
  }

  async openRequest(user: ParentOrgUserRow, id: string) {
    const unit = await this.unitById(user.admin_unit_id);
    const request = await this.platform
      .selectFrom('parent_org_access_requests')
      .select(['school_id', 'user_id'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!request || request.user_id !== user.id) {
      throw notFound();
    }
    const school = await this.platform
      .selectFrom('schools')
      .select('admin_unit_id')
      .where('id', '=', request.school_id)
      .executeTakeFirst();
    const scope = await subtreeUnitIds(this.platform, user.admin_unit_id);
    if (!school?.admin_unit_id || !scope.includes(school.admin_unit_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Trường không còn thuộc phạm vi của đơn vị');
    }
    return this.support.startForParentOrg(id, { id: user.id, name: user.full_name, unitName: unit.name });
  }
  // Cấp trên rút đề nghị của mình (YCTD-367): đề nghị chờ duyệt, hoặc đã duyệt còn hạn (phiên xem chi tiết đang mở kết thúc ngay). Chỉ
  // người gửi; trường thấy trạng thái "Cấp trên đã rút". Quyền theo tài khoản cấp trên, không theo vai trò vận hành
  async withdrawRequest(user: ParentOrgUserRow, id: string) {
    if (!REQUEST_ID.test(id)) throw notFound();
    const now = new Date();
    const row = await this.platform
      .selectFrom('parent_org_access_requests')
      .select(['id', 'school_id', 'user_id', 'status', 'expires_at'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row || row.user_id !== user.id) throw notFound();
    const active = row.status === 'approved' && row.expires_at !== null && row.expires_at > now;
    if (row.status !== 'pending' && !active) {
      throw validationError([{ field: 'status', message: 'Chỉ rút được đề nghị đang chờ hoặc đã duyệt còn hạn' }]);
    }
    const updated = await this.platform
      .updateTable('parent_org_access_requests')
      .set({ status: 'withdrawn', withdrawn_at: now })
      .where('id', '=', id)
      .where('status', '=', row.status)
      .returning('id')
      .executeTakeFirst();
    if (!updated) throw new ApplicationError('ERR_CONFLICT', 'Đề nghị vừa đổi trạng thái; tải lại danh sách');
    const sessions = await this.platform
      .selectFrom('support_sessions')
      .select('id')
      .where('access_request_id', '=', id)
      .where('ended_at', 'is', null)
      .execute();
    for (const session of sessions) {
      await this.support.end(session.id, 'withdrawn', { type: 'system', name: user.full_name });
    }
    await writeAudit(this.platform, {
      actorType: 'system',
      action: 'parent-org.access-withdrawn',
      schoolId: row.school_id,
      details: { request_id: id, user_id: user.id, previous_status: row.status, sessions_ended: sessions.length },
    });
    return { id, status: 'withdrawn' as const };
  }
}

// Đề nghị xem chi tiết: mã là uuid (mã khác thì 404, không để cơ sở dữ liệu báo lỗi kiểu)
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Đăng ký (hoặc cấp lại) xác thực hai lớp của tài khoản cấp trên: khóa mã hóa bằng khóa gốc của nền tảng, mã khôi phục chỉ lưu bản
// băm; khóa và mã khôi phục chỉ trả một lần
export async function enrollParentOrgTotp(
  platform: Kysely<PlatformDatabase>,
  masterKey: Buffer,
  userId: string,
  account: string,
): Promise<{ secret: string; otpauth_uri: string; recovery_codes: string[] }> {
  const secret = generateTotpSecret();
  const recoveryCodes = generateRecoveryCodes();
  await platform.transaction().execute(async (transaction) => {
    await transaction.deleteFrom('parent_org_user_recovery_codes').where('user_id', '=', userId).execute();
    await transaction.deleteFrom('parent_org_user_totp').where('user_id', '=', userId).execute();
    await transaction
      .insertInto('parent_org_user_totp')
      .values({ user_id: userId, secret_encrypted: encryptSecret(masterKey, secret) })
      .execute();
    await transaction
      .insertInto('parent_org_user_recovery_codes')
      .values(recoveryCodes.map((code) => ({ user_id: userId, code_hash: hashRecoveryCode(code) })))
      .execute();
  });
  return {
    secret,
    otpauth_uri: totpUri(secret, account, 'School Management (cấp trên)'),
    recovery_codes: recoveryCodes,
  };
}

@Controller('auth/platform')
export class PlatformParentOrgsController {
  constructor(
    private readonly parentOrgs: ParentOrgsService,
    private readonly schools: PlatformSchoolsService,
  ) {}

  // Mặc định chỉ việc sửa cây đơn vị và tài khoản cấp trên (YCTD-323)
  private async actor(request: Request, capability: OperatorCapability = 'parent-orgs.manage') {
    const actor = await this.schools.actor(request, operatorRolesFor(capability));
    return { id: actor.id ?? '', name: actor.name };
  }

  @Get('admin-units')
  async units(@Req() request: Request) {
    await this.actor(request, 'parent-orgs.view');
    return this.parentOrgs.units();
  }

  @Post('admin-units')
  @HttpCode(200)
  async create(@Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    return this.parentOrgs.createUnit(body, await this.actor(request));
  }

  @Post('admin-units/import')
  @HttpCode(200)
  async import(@Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    return this.parentOrgs.importUnits(body, await this.actor(request));
  }

  @Put('admin-units/:id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    return this.parentOrgs.updateUnit(id, body, await this.actor(request));
  }

  @Post('admin-units/:id/merge')
  @HttpCode(200)
  async merge(@Param('id') id: string, @Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    return this.parentOrgs.mergeUnit(id, body, await this.actor(request));
  }

  @Post('admin-units/:id/split')
  @HttpCode(200)
  async split(@Param('id') id: string, @Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    return this.parentOrgs.splitUnit(id, body, await this.actor(request));
  }

  @Put('schools/:code/admin-unit')
  async assign(
    @Param('code') code: string,
    @Body() body: Record<string, unknown> | undefined,
    @Req() request: Request,
  ) {
    return this.parentOrgs.assignSchool(code, body, await this.actor(request));
  }

  @Post('parent-org-users')
  @HttpCode(200)
  async createUser(@Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    return this.parentOrgs.createUser(body, await this.actor(request));
  }

  @Post('parent-org-users/:id/totp')
  @HttpCode(200)
  async resetTotp(@Param('id') id: string, @Req() request: Request) {
    return this.parentOrgs.resetTotp(id, await this.actor(request));
  }

  @Post('parent-org-users/:id/status')
  @HttpCode(200)
  async status(@Param('id') id: string, @Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    return this.parentOrgs.setUserStatus(id, body, await this.actor(request));
  }
}

@Controller('auth/parent-org')
export class ParentOrgAuthController {
  constructor(
    private readonly parentOrgs: ParentOrgsService,
    private readonly operators: PlatformOperatorsService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    this.operators.assertConsoleHost(request);
    return this.parentOrgs.login(body, request.ip ?? null);
  }

  @Get('me')
  async me(@Req() request: Request) {
    const user = await this.parentOrgs.userFromRequest(request);
    return this.parentOrgs.describe(user.id);
  }

  @Get('access-requests')
  async requests(@Req() request: Request) {
    return this.parentOrgs.listRequests(await this.parentOrgs.userFromRequest(request));
  }

  @Post('access-requests')
  @HttpCode(200)
  async createRequest(@Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    return this.parentOrgs.createRequest(await this.parentOrgs.userFromRequest(request), body);
  }

  @Post('access-requests/:id/open')
  @HttpCode(200)
  async open(@Param('id') id: string, @Req() request: Request) {
    return this.parentOrgs.openRequest(await this.parentOrgs.userFromRequest(request), id);
  }

  @Post('access-requests/:id/withdraw')
  @HttpCode(200)
  async withdraw(@Param('id') id: string, @Req() request: Request) {
    return this.parentOrgs.withdrawRequest(await this.parentOrgs.userFromRequest(request), id);
  }
}
