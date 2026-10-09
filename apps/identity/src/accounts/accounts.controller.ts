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

// Tài khoản (P01-06) và gán vai trò (P01-07) do dịch vụ định danh phục vụ (17_DAC_TA_API.md)
@Controller('users')
@UseGuards(AccessTokenGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: Record<string, string | undefined>) {
    const errors: FieldError[] = [];
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    if (!Number.isInteger(page) || page < 1) {
      errors.push({ field: 'page', message: 'Số trang bắt đầu từ 1' });
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      errors.push({ field: 'page_size', message: 'Cỡ trang từ 1 đến 100' });
    }
    if (query.status !== undefined && query.status !== 'active' && query.status !== 'locked') {
      errors.push({ field: 'status', message: 'Trạng thái là active hoặc locked' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const listQuery: ListQuery = {
      q: query.q?.trim() || undefined,
      status: query.status as ListQuery['status'],
      role_code: query.role_code || undefined,
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
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      errors.push({ field: 'page_size', message: 'Cỡ trang từ 1 đến 100' });
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

  @Post(':id/reset-password')
  @HttpCode(200)
  resetPassword(@Req() request: AuthenticatedRequest, @Param('id', uuidParameter('id')) userId: string) {
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

  @Get('permissions')
  listPermissions(@Req() request: AuthenticatedRequest) {
    return this.rolesService.listPermissions(callerOf(request));
  }
}
