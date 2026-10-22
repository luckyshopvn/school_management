import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { readBearerToken, validationError, type FieldError } from '@school-management/server';
import { isSchoolLevelCode } from '@school-management/shared';
import { AccessTokenGuard, type AuthenticatedRequest } from '../authentication/access-token.guard.js';
import {
  AccountsService,
  type AccountChanges,
  type AccountInput,
  type CallerContext,
  type ListQuery,
  type RoleGrant,
} from './accounts.service.js';
import { RolesService } from './roles.service.js';
import { StaffDirectoryService } from './staff-directory.service.js';
import { GuardianAccountsService } from './guardian-accounts.service.js';
import { StaffAccountsService } from './staff-accounts.service.js';
import { IdentityDataExportService } from './identity-data-export.js';
import { ImpersonationService } from '../authentication/impersonation.service.js';

type RequestBody = Record<string, unknown> | undefined;

const PHONE_PATTERN = /^0\d{9}$/;
const USERNAME_PATTERN = /^[a-z0-9_.]{3,50}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuidParameter = (field: string) =>
  new ParseUUIDPipe({ exceptionFactory: () => validationError([{ field, message: 'Mã không hợp lệ' }]) });

function callerOf(request: AuthenticatedRequest): CallerContext {
  return {
    claims: request.accessTokenClaims,
    accessToken: readBearerToken(request.header('authorization')),
    ipAddress: request.ip ?? null,
  };
}

function readNullableText(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  pattern?: { regex: RegExp; message: string },
): string | null | undefined {
  const value = body?.[field];
  if (value === undefined) {
    return undefined;
  }
  if (value === null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: 'Phải là chữ' });
    return undefined;
  }
  const trimmed = value.trim();
  if (pattern && !pattern.regex.test(trimmed)) {
    errors.push({ field, message: pattern.message });
    return undefined;
  }
  return trimmed;
}

const PHONE_RULE = { regex: PHONE_PATTERN, message: 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0' };
const USERNAME_RULE = {
  regex: USERNAME_PATTERN,
  message: 'Tên đăng nhập gồm 3 đến 50 ký tự chữ thường, số, dấu chấm hoặc gạch dưới',
};
const DATE_RULE = { regex: DATE_PATTERN, message: 'Ngày dạng YYYY-MM-DD' };

function readGrant(value: unknown, field: string, errors: FieldError[]): RoleGrant | undefined {
  const grant = (value ?? {}) as Record<string, unknown>;
  if (typeof grant.role_code !== 'string' || grant.role_code === '') {
    errors.push({ field: `${field}.role_code`, message: 'Bắt buộc chọn vai trò' });
    return undefined;
  }
  const orgUnitId = grant.org_unit_id ?? null;
  if (orgUnitId !== null && (typeof orgUnitId !== 'string' || !UUID_PATTERN.test(orgUnitId))) {
    errors.push({ field: `${field}.org_unit_id`, message: 'Mã đơn vị không hợp lệ' });
    return undefined;
  }
  return { role_code: grant.role_code, org_unit_id: orgUnitId as string | null };
}

// Thao tác hàng loạt và bộ lọc theo mã tài khoản nhận tối đa 200 tài khoản, bằng cỡ trang lớn nhất của lưới
const MAXIMUM_BULK = 200;

function readUserIds(body: RequestBody): string[] {
  const value = body?.user_ids;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAXIMUM_BULK ||
    value.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id))
  ) {
    throw validationError([{ field: 'user_ids', message: `Chọn từ 1 đến ${MAXIMUM_BULK} tài khoản` }]);
  }
  return [...new Set(value as string[])];
}

// Tài khoản (P01-06) và gán vai trò (P01-07) do dịch vụ định danh phục vụ (17_DAC_TA_API.md)
@Controller('users')
@UseGuards(AccessTokenGuard)
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly staffDirectory: StaffDirectoryService,
    private readonly guardianAccounts: GuardianAccountsService,
    private readonly staffAccounts: StaffAccountsService,
    private readonly impersonation: ImpersonationService,
    private readonly dataExport: IdentityDataExportService,
  ) {}

  // Dữ liệu của dịch vụ định danh cho gói ZIP toàn bộ dữ liệu của trường, không có mật khẩu và mã bí mật (DT-18 phần 18h)
  @Get('data-export')
  exportData(@Req() request: AuthenticatedRequest) {
    return this.dataExport.snapshot(request.accessTokenClaims);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: Record<string, string | undefined>) {
    const errors: FieldError[] = [];
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    if (!Number.isInteger(page) || page < 1) {
      errors.push({ field: 'page', message: 'Số trang bắt đầu từ 1' });
    }
    // Tối đa 200 dòng mỗi trang theo lưới dữ liệu dùng chung (DT-15 phần 15a)
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
      errors.push({ field: 'page_size', message: 'Cỡ trang từ 1 đến 200' });
    }
    if (query.status !== undefined && query.status !== 'active' && query.status !== 'locked') {
      errors.push({ field: 'status', message: 'Trạng thái là active hoặc locked' });
    }
    if (
      query.must_change_password !== undefined &&
      query.must_change_password !== 'true' &&
      query.must_change_password !== 'false'
    ) {
      errors.push({ field: 'must_change_password', message: 'Trạng thái đổi mật khẩu là true hoặc false' });
    }
    // Bộ lọc thêm của DT-16 phần 16d: danh sách mã tài khoản (tối đa 200), ngày hết hạn mật khẩu từ, đến
    let userIds: string[] | undefined;
    if (query.user_ids !== undefined) {
      userIds = query.user_ids === '' ? [] : query.user_ids.split(',');
      if (userIds.length > MAXIMUM_BULK || userIds.some((id) => !UUID_PATTERN.test(id))) {
        errors.push({ field: 'user_ids', message: `Danh sách mã tài khoản không hợp lệ (tối đa ${MAXIMUM_BULK})` });
      }
    }
    for (const field of ['password_expires_from', 'password_expires_to'] as const) {
      if (query[field] && !DATE_PATTERN.test(query[field] ?? '')) {
        errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const listQuery: ListQuery = {
      user_ids: userIds,
      password_expires_from: query.password_expires_from || undefined,
      password_expires_to: query.password_expires_to || undefined,
      q: query.q?.trim() || undefined,
      status: query.status as ListQuery['status'],
      role_code: query.role_code || undefined,
      // Bộ lọc theo danh sách người dùng của Sở (DT-15 phần 15e)
      login: query.login?.trim() || undefined,
      full_name: query.full_name?.trim() || undefined,
      must_change_password:
        query.must_change_password === undefined ? undefined : query.must_change_password === 'true',
      page,
      page_size: pageSize,
    };
    return this.accountsService.list(callerOf(request), listQuery);
  }

  @Get('audit-logs')
  auditLogs(@Req() request: AuthenticatedRequest, @Query() query: Record<string, string | undefined>) {
    const errors: FieldError[] = [];
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    if (!Number.isInteger(page) || page < 1) {
      errors.push({ field: 'page', message: 'Số trang bắt đầu từ 1' });
    }
    // Tối đa 200 dòng mỗi trang theo lưới dữ liệu dùng chung (DT-15 phần 15e)
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
      errors.push({ field: 'page_size', message: 'Cỡ trang từ 1 đến 200' });
    }
    for (const field of ['entity_id', 'actor_user_id'] as const) {
      if (query[field] && !UUID_PATTERN.test(query[field] ?? '')) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    for (const field of ['from_date', 'to_date'] as const) {
      if (query[field] && !DATE_PATTERN.test(query[field] ?? '')) {
        errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.accountsService.listAuditLogs(callerOf(request), {
      entity_id: query.entity_id,
      actor_user_id: query.actor_user_id,
      from_date: query.from_date,
      to_date: query.to_date,
      page,
      page_size: pageSize,
    });
  }

  // Khai báo trước ':id' để không bị hiểu là mã tài khoản
  @Get('directory')
  directory(@Req() request: AuthenticatedRequest, @Query() query: Record<string, string | undefined>) {
    const errors: FieldError[] = [];
    if (!query.role_code) {
      errors.push({ field: 'role_code', message: 'Bắt buộc chọn vai trò' });
    }
    if (!query.org_unit_id || !UUID_PATTERN.test(query.org_unit_id)) {
      errors.push({ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staffDirectory.list(callerOf(request), query.role_code ?? '', query.org_unit_id ?? '');
  }

  // Máy chủ API gọi khi duyệt hồ sơ trẻ, bằng mã phiên của người duyệt (QT-01 bước 9, YCTD-45)
  @Post('guardian-accounts')
  @HttpCode(200)
  ensureGuardianAccount(@Req() request: AuthenticatedRequest, @Body() body: RequestBody) {
    const errors: FieldError[] = [];
    const phone = readNullableText(body, 'phone', errors, PHONE_RULE);
    const fullName = readNullableText(body, 'full_name', errors);
    const orgUnitId = body?.org_unit_id;
    if (!phone) {
      errors.push({ field: 'phone', message: 'Bắt buộc nhập số điện thoại' });
    }
    if (!fullName) {
      errors.push({ field: 'full_name', message: 'Bắt buộc nhập họ tên' });
    }
    if (typeof orgUnitId !== 'string' || !UUID_PATTERN.test(orgUnitId)) {
      errors.push({ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.guardianAccounts.ensure(callerOf(request), {
      phone: phone ?? '',
      full_name: fullName ?? '',
      org_unit_id: orgUnitId as string,
    });
  }

  // Máy chủ API gọi khi phòng nhân sự liên kết tài khoản với hồ sơ nhân sự (P07-01, YCTD-58)
  @Post('staff-accounts/lookup')
  @HttpCode(200)
  lookupStaffAccount(@Req() request: AuthenticatedRequest, @Body() body: RequestBody) {
    const login = typeof body?.login === 'string' ? body.login.trim() : '';
    const orgUnitId = body?.org_unit_id;
    const errors: FieldError[] = [];
    if (!login) {
      errors.push({ field: 'login', message: 'Bắt buộc nhập tên đăng nhập hoặc số điện thoại' });
    }
    if (typeof orgUnitId !== 'string' || !UUID_PATTERN.test(orgUnitId)) {
      errors.push({ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staffAccounts.lookup(callerOf(request), { login, org_unit_id: orgUnitId as string });
  }

  // 1.4 Danh sách người dùng của Sở: Cấp mật khẩu hàng loạt (DT-16 phần 16d)
  @Post('bulk-reset-password')
  @HttpCode(200)
  async bulkResetPassword(@Req() request: AuthenticatedRequest, @Body() body: RequestBody) {
    await this.impersonation.assertNotImpersonating(request.accessTokenClaims.sessionId, 'cấp mật khẩu');
    return this.accountsService.bulkResetPassword(callerOf(request), readUserIds(body));
  }

  // 1.4 Danh sách người dùng của Sở: Phân nhóm quyền hàng loạt (DT-16 phần 16d)
  @Post('bulk-roles')
  @HttpCode(200)
  bulkAddRole(@Req() request: AuthenticatedRequest, @Body() body: RequestBody) {
    const userIds = readUserIds(body);
    const errors: FieldError[] = [];
    const grant = readGrant(body?.role, 'role', errors);
    if (!grant || errors.length > 0) {
      throw validationError(errors);
    }
    return this.accountsService.bulkAddRole(callerOf(request), userIds, grant);
  }

  // Máy chủ API gọi khi chấm dứt hợp đồng lao động: khóa tài khoản ngay (BR-05)
  @Post(':id/terminate-employment')
  @HttpCode(200)
  terminateEmployment(
    @Req() request: AuthenticatedRequest,
    @Param('id', uuidParameter('id')) userId: string,
    @Body() body: RequestBody,
  ) {
    const orgUnitId = body?.org_unit_id;
    if (typeof orgUnitId !== 'string' || !UUID_PATTERN.test(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
    }
    return this.staffAccounts.lockForTermination(callerOf(request), userId, { org_unit_id: orgUnitId });
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id', uuidParameter('id')) userId: string) {
    return this.accountsService.get(callerOf(request), userId);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: RequestBody) {
    const errors: FieldError[] = [];
    const fullName = readNullableText(body, 'full_name', errors);
    if (!fullName) {
      errors.push({ field: 'full_name', message: 'Bắt buộc nhập họ tên' });
    }
    const phone = readNullableText(body, 'phone', errors, PHONE_RULE) ?? null;
    const username = readNullableText(body, 'username', errors, USERNAME_RULE) ?? null;
    if (!phone && !username && !errors.some((error) => error.field === 'phone' || error.field === 'username')) {
      errors.push({ field: 'phone', message: 'Cần số điện thoại hoặc tên đăng nhập' });
    }
    const validUntil = readNullableText(body, 'valid_until', errors, DATE_RULE) ?? null;
    const rawRoles = body?.roles;
    const roles: RoleGrant[] = [];
    if (!Array.isArray(rawRoles) || rawRoles.length === 0) {
      errors.push({ field: 'roles', message: 'Cần ít nhất một vai trò' });
    } else {
      rawRoles.forEach((value, index) => {
        const grant = readGrant(value, `roles[${index}]`, errors);
        if (grant) {
          roles.push(grant);
        }
      });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const input: AccountInput = { full_name: fullName ?? '', phone, username, valid_until: validUntil, roles };
    return this.accountsService.create(callerOf(request), input);
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', uuidParameter('id')) userId: string,
    @Body() body: RequestBody,
  ) {
    const errors: FieldError[] = [];
    const changes: AccountChanges = {};
    const fullName = readNullableText(body, 'full_name', errors);
    if (fullName === null) {
      errors.push({ field: 'full_name', message: 'Họ tên không được trống' });
    } else if (fullName !== undefined) {
      changes.full_name = fullName;
    }
    changes.phone = readNullableText(body, 'phone', errors, PHONE_RULE);
    changes.username = readNullableText(body, 'username', errors, USERNAME_RULE);
    changes.valid_until = readNullableText(body, 'valid_until', errors, DATE_RULE);
    if (body?.status !== undefined) {
      if (body.status !== 'active' && body.status !== 'locked') {
        errors.push({ field: 'status', message: 'Trạng thái là active hoặc locked' });
      } else {
        changes.status = body.status;
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.accountsService.update(callerOf(request), userId, changes);
  }

  // Phạm vi cấp học của tài khoản (DT-19 phần 19a): danh sách mã cấp, trống là mọi cấp
  @Get(':id/school-levels')
  schoolLevels(@Req() request: AuthenticatedRequest, @Param('id', uuidParameter('id')) userId: string) {
    return this.accountsService.schoolLevels(callerOf(request), userId);
  }

  @Put(':id/school-levels')
  setSchoolLevels(
    @Req() request: AuthenticatedRequest,
    @Param('id', uuidParameter('id')) userId: string,
    @Body() body: RequestBody,
  ) {
    const levels = body?.school_levels;
    if (!Array.isArray(levels) || !levels.every((level) => isSchoolLevelCode(level))) {
      throw validationError([{ field: 'school_levels', message: 'Mã cấp là MN, TH, THCS hoặc THPT' }]);
    }
    return this.accountsService.setSchoolLevels(callerOf(request), userId, [...new Set(levels as string[])]);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  async resetPassword(@Req() request: AuthenticatedRequest, @Param('id', uuidParameter('id')) userId: string) {
    await this.impersonation.assertNotImpersonating(request.accessTokenClaims.sessionId, 'đặt lại mật khẩu');
    return this.accountsService.resetPassword(callerOf(request), userId);
  }

  @Post(':id/roles')
  @HttpCode(200)
  addRole(
    @Req() request: AuthenticatedRequest,
    @Param('id', uuidParameter('id')) userId: string,
    @Body() body: RequestBody,
  ) {
    const errors: FieldError[] = [];
    const grant = readGrant(body, 'role', errors);
    if (!grant || errors.length > 0) {
      throw validationError(errors);
    }
    return this.accountsService.addRole(callerOf(request), userId, grant);
  }

  @Delete(':id/roles/:assignmentId')
  removeRole(
    @Req() request: AuthenticatedRequest,
    @Param('id', uuidParameter('id')) userId: string,
    @Param('assignmentId', uuidParameter('assignmentId')) assignmentId: string,
  ) {
    return this.accountsService.removeRole(callerOf(request), userId, assignmentId);
  }
}

@Controller()
@UseGuards(AccessTokenGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  listRoles(@Req() request: AuthenticatedRequest) {
    return this.rolesService.listRoles(callerOf(request));
  }

  @Post('roles')
  createRole(@Req() request: AuthenticatedRequest, @Body() body: RequestBody) {
    const errors: FieldError[] = [];
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!code) {
      errors.push({ field: 'code', message: 'Bắt buộc nhập mã vai trò' });
    }
    if (!name) {
      errors.push({ field: 'name', message: 'Bắt buộc nhập tên vai trò' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.rolesService.createRole(callerOf(request), code, name);
  }

  @Put('roles/:id/permissions')
  replacePermissions(
    @Req() request: AuthenticatedRequest,
    @Param('id', uuidParameter('id')) roleId: string,
    @Body() body: RequestBody,
  ) {
    const codes = body?.permission_codes;
    if (!Array.isArray(codes) || codes.some((code) => typeof code !== 'string')) {
      throw validationError([{ field: 'permission_codes', message: 'Danh sách mã quyền không hợp lệ' }]);
    }
    return this.rolesService.replacePermissions(callerOf(request), roleId, codes as string[]);
  }

  // 1.1 Nhóm người dùng: sửa tên, hiệu lực (DT-16 phần 16d)
  @Patch('roles/:id')
  updateRole(
    @Req() request: AuthenticatedRequest,
    @Param('id', uuidParameter('id')) roleId: string,
    @Body() body: RequestBody,
  ) {
    const errors: FieldError[] = [];
    const changes: { name?: string; is_active?: boolean } = {};
    if (body?.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        errors.push({ field: 'name', message: 'Bắt buộc nhập tên nhóm' });
      } else if (body.name.trim().length > 200) {
        errors.push({ field: 'name', message: 'Tên nhóm tối đa 200 ký tự' });
      } else {
        changes.name = body.name.trim();
      }
    }
    if (body?.is_active !== undefined) {
      if (typeof body.is_active !== 'boolean') {
        errors.push({ field: 'is_active', message: 'Hiệu lực là đúng hoặc sai' });
      } else {
        changes.is_active = body.is_active;
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.rolesService.updateRole(callerOf(request), roleId, changes);
  }

  @Delete('roles/:id')
  @HttpCode(204)
  async deleteRole(@Req() request: AuthenticatedRequest, @Param('id', uuidParameter('id')) roleId: string) {
    await this.rolesService.deleteRole(callerOf(request), roleId);
  }

  // 1.2 Phân quyền nhóm theo phần mềm: thay toàn bộ phân hệ của cổng quản trị nhóm được dùng
  @Put('roles/:id/workspaces')
  replaceWorkspaces(
    @Req() request: AuthenticatedRequest,
    @Param('id', uuidParameter('id')) roleId: string,
    @Body() body: RequestBody,
  ) {
    const keys = body?.workspace_keys;
    if (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string')) {
      throw validationError([{ field: 'workspace_keys', message: 'Danh sách phân hệ không hợp lệ' }]);
    }
    return this.rolesService.replaceWorkspaces(callerOf(request), roleId, [...new Set(keys as string[])]);
  }

  @Get('permissions')
  listPermissions(@Req() request: AuthenticatedRequest) {
    return this.rolesService.listPermissions(callerOf(request));
  }
}
