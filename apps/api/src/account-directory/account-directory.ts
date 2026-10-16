import { Body, Controller, Get, HttpCode, Injectable, Post, Query, Req, Res } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  readBearerToken,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES, WHOLE_SCHOOL_ROLE_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { IdentityClient, type IdentityAccount, type IdentityAccountPage } from '../authentication/identity-client.js';
import { buildStudentWorkbook, fileStamp, sendWorkbook } from '../children/student-workbook.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// 1.4 Danh sách người dùng đủ theo Sở (DT-16 phần 16d). Tài khoản ở dịch vụ định danh, hồ sơ nhân sự ở cơ sở dữ liệu năm
// học hiện hành nên máy chủ API ghép hai nguồn: lọc "Mã định danh" (mã nhân sự hoặc mã định danh Bộ GD&ĐT) đổi thành danh
// sách mã tài khoản, gọi dịch vụ định danh bằng mã phiên của người thao tác (dịch vụ định danh vẫn tự kiểm tra phạm vi), rồi
// thêm cột Mã nhân sự, Mã Bộ. Xuất Excel theo bộ lọc và cột đang hiện, ghi nhật ký xuất (BR-74). "Lấy danh sách CBQL/GV"
// tạo tài khoản cho nhân sự đang làm việc chưa có tài khoản, mỗi tài khoản một mật khẩu tạm (PQ-14) và liên kết vào hồ sơ
export const ACCOUNT_DIRECTORY_RULE_CODE = 'YCTD-120';
const ACCOUNT_PERMISSIONS = [PERMISSION_CODES.accountManage, PERMISSION_CODES.accountManageInUnit];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZES = new Set([10, 20, 50, 100, 200]);
// Mã định danh khớp với quá 200 nhân sự thì báo thu hẹp, bằng số tài khoản lớn nhất dịch vụ định danh nhận một lần
const IDENTIFIER_MATCH_LIMIT = 200;
const EXPORT_ROW_LIMIT = 10_000;
const IDENTITY_PAGE_SIZE = 200;
const STAFF_ACCOUNT_LIMIT = 200;
const USERNAME_PATTERN = /^[a-z0-9_.]{3,50}$/;
const PHONE_PATTERN = /^0\d{9}$/;

export interface AccountDirectoryFilter {
  q?: string;
  status?: 'active' | 'locked';
  role_code?: string;
  login?: string;
  full_name?: string;
  must_change_password?: 'true' | 'false';
  // Mã nhân sự hoặc mã định danh Bộ GD&ĐT, khớp một phần, không phân biệt hoa thường
  identifier?: string;
  password_expires_from?: string;
  password_expires_to?: string;
}

export interface AccountDirectoryItem extends IdentityAccount {
  staff_id: string | null;
  staff_code: string | null;
  moet_staff_code: string | null;
}

// Cột của tệp Excel, cùng mã cột với lưới 1.4 ở cổng quản trị
function accountType(account: AccountDirectoryItem): string {
  if (account.assignments.length === 0) {
    return 'Chưa có nhóm quyền';
  }
  return account.assignments.every((assignment) => assignment.role_code === 'VT-14')
    ? 'Phụ huynh'
    : 'Cán bộ, nhân viên';
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';
}

export const ACCOUNT_EXPORT_COLUMNS: Array<{
  id: string;
  label: string;
  value(account: AccountDirectoryItem): string;
}> = [
  { id: 'login', label: 'Tên đăng nhập', value: (account) => account.username ?? account.phone ?? '' },
  { id: 'full_name', label: 'Tên hiển thị', value: (account) => account.full_name },
  {
    id: 'roles',
    label: 'Nhóm quyền',
    value: (account) => [...new Set(account.assignments.map((assignment) => assignment.role_name))].join(', '),
  },
  { id: 'staff_code', label: 'Mã nhân sự', value: (account) => account.staff_code ?? '' },
  { id: 'moet_staff_code', label: 'Mã Bộ', value: (account) => account.moet_staff_code ?? '' },
  { id: 'account_type', label: 'Loại tài khoản', value: accountType },
  {
    id: 'status',
    label: 'Trạng thái',
    value: (account) => (account.status === 'active' ? 'Đang hoạt động' : 'Đã khóa'),
  },
  {
    id: 'must_change_password',
    label: 'Trạng thái đổi mật khẩu',
    value: (account) => (account.must_change_password ? 'Chờ đổi mật khẩu' : 'Đã đổi'),
  },
  {
    id: 'password_changed_at',
    label: 'Thời gian đổi mật khẩu',
    value: (account) => formatDateTime(account.password_changed_at),
  },
  {
    id: 'password_expires_at',
    label: 'Ngày hết hạn mật khẩu',
    value: (account) => formatDate(account.password_expires_at),
  },
  { id: 'valid_until', label: 'Ngày hết hiệu lực', value: (account) => account.valid_until ?? '' },
  { id: 'phone', label: 'Số điện thoại', value: (account) => account.phone ?? '' },
  { id: 'last_login_at', label: 'Đăng nhập gần nhất', value: (account) => formatDateTime(account.last_login_at) },
];

export const DEFAULT_ACCOUNT_EXPORT_COLUMNS = [
  'login',
  'full_name',
  'roles',
  'staff_code',
  'moet_staff_code',
  'account_type',
  'status',
  'must_change_password',
  'password_changed_at',
  'password_expires_at',
];

function readText(source: Record<string, unknown>, field: string, errors: FieldError[]): string | undefined {
  const value = source[field];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string' || value.length > 200) {
    errors.push({ field, message: 'Giá trị không hợp lệ' });
    return undefined;
  }
  return value.trim() || undefined;
}

export function readAccountDirectoryFilter(
  source: Record<string, unknown>,
  errors: FieldError[],
): AccountDirectoryFilter {
  const filter: AccountDirectoryFilter = {
    q: readText(source, 'q', errors),
    role_code: readText(source, 'role_code', errors),
    login: readText(source, 'login', errors),
    full_name: readText(source, 'full_name', errors),
    identifier: readText(source, 'identifier', errors),
  };
  const status = readText(source, 'status', errors);
  if (status !== undefined) {
    if (status !== 'active' && status !== 'locked') {
      errors.push({ field: 'status', message: 'Trạng thái là active hoặc locked' });
    } else {
      filter.status = status;
    }
  }
  const mustChange = readText(source, 'must_change_password', errors);
  if (mustChange !== undefined) {
    if (mustChange !== 'true' && mustChange !== 'false') {
      errors.push({ field: 'must_change_password', message: 'Trạng thái đổi mật khẩu là true hoặc false' });
    } else {
      filter.must_change_password = mustChange;
    }
  }
  for (const field of ['password_expires_from', 'password_expires_to'] as const) {
    const value = readText(source, field, errors);
    if (value !== undefined) {
      if (!DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
        errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
      } else {
        filter[field] = value;
      }
    }
  }
  return filter;
}

// Tên đăng nhập gợi ý từ mã nhân sự: chữ thường, bỏ dấu, chỉ giữ chữ, số, dấu chấm, gạch dưới
export function suggestUsername(staffCode: string): string | null {
  const normalized = staffCode
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '');
  return USERNAME_PATTERN.test(normalized) ? normalized : null;
}

@Injectable()
export class AccountDirectoryService {
  constructor(
    private readonly identityClient: IdentityClient,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  async list(accessToken: string, filter: AccountDirectoryFilter, page: number, pageSize: number) {
    const current = await this.currentSchoolYear.find();
    const query = await this.identityQuery(current?.database, filter);
    if (!query) {
      return { items: [], page, page_size: pageSize, total: 0, total_pages: 1 };
    }
    query.set('page', String(page));
    query.set('page_size', String(pageSize));
    const result = await this.identityClient.listAccounts(accessToken, query);
    return { ...result, items: await this.withStaffCodes(current?.database, result.items) };
  }

  async exportList(
    accessToken: string,
    currentUser: CurrentUser,
    filter: AccountDirectoryFilter,
    columnIds: string[],
    ipAddress: string | null,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const query = await this.identityQuery(database, filter);
    const accounts: IdentityAccount[] = [];
    if (query) {
      query.set('page_size', String(IDENTITY_PAGE_SIZE));
      for (let page = 1; ; page++) {
        query.set('page', String(page));
        const result: IdentityAccountPage = await this.identityClient.listAccounts(accessToken, query);
        if (result.total > EXPORT_ROW_LIMIT) {
          throw ruleViolationError(
            ACCOUNT_DIRECTORY_RULE_CODE,
            `Danh sách có hơn ${EXPORT_ROW_LIMIT} người dùng, hãy thu hẹp bộ lọc trước khi xuất Excel`,
          );
        }
        accounts.push(...result.items);
        if (page >= result.total_pages) {
          break;
        }
      }
    }
    const items = await this.withStaffCodes(database, accounts);
    const columns = columnIds.flatMap((id) => ACCOUNT_EXPORT_COLUMNS.filter((column) => column.id === id));
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'accounts',
      title: 'Danh sách người dùng',
      fileName: `danh-sach-nguoi-dung-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter, columns: columnIds },
      orgUnitIds: [
        ...new Set(
          items.flatMap((item) =>
            item.assignments.map((assignment) => assignment.org_unit_id).filter((id): id is string => id !== null),
          ),
        ),
      ],
      columns: columns.map((column) => ({ key: column.id, label: column.label })),
      rows: items.map((item) => Object.fromEntries(columns.map((column) => [column.id, column.value(item)]))),
      ipAddress,
      createdAt,
    });
  }

  // Nhân sự đang làm việc chưa có tài khoản, trong phạm vi quản lý tài khoản của người thao tác
  async staffWithoutAccount(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    const unitIds = await this.accountUnits(currentUser);
    let selection = database
      .selectFrom('staff')
      .leftJoin('org_units', 'org_units.id', 'staff.org_unit_id')
      .select([
        'staff.id',
        'staff.code',
        'staff.full_name',
        'staff.phone',
        'staff.org_unit_id',
        'org_units.name as org_unit_name',
      ])
      .where('staff.status', '=', 'active')
      .where('staff.user_id', 'is', null);
    if (unitIds !== 'all') {
      selection =
        unitIds.length > 0
          ? selection.where('staff.org_unit_id', 'in', unitIds)
          : selection.where('staff.id', 'is', null);
    }
    const rows = await selection.orderBy('staff.full_name').orderBy('staff.code').execute();
    return rows.map((row) => ({
      ...row,
      suggested_username: suggestUsername(row.code),
      phone: row.phone && PHONE_PATTERN.test(row.phone) ? row.phone : null,
    }));
  }

  // Tạo tài khoản cho nhân sự được chọn, nhóm quyền chọn chung; vai trò theo đơn vị gán ở đơn vị chính của nhân sự. Mỗi
  // nhân sự một lần gọi dịch vụ định danh nên lỗi của một người (trùng tên đăng nhập, ngoài phạm vi) không chặn người khác
  async createStaffAccounts(
    accessToken: string,
    currentUser: CurrentUser,
    staffIds: string[],
    roleCode: string,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const unitIds = await this.accountUnits(currentUser);
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'code', 'full_name', 'phone', 'org_unit_id', 'status', 'user_id'])
      .where('id', 'in', staffIds)
      .execute();
    const wholeSchoolRole = (WHOLE_SCHOOL_ROLE_CODES as readonly string[]).includes(roleCode);
    const results: Array<{
      staff_id: string;
      code: string | null;
      full_name: string | null;
      login: string | null;
      temporary_password: string | null;
      error: string | null;
    }> = [];
    for (const staffId of staffIds) {
      const row = staff.find((item) => item.id === staffId);
      const fail = (message: string) =>
        results.push({
          staff_id: staffId,
          code: row?.code ?? null,
          full_name: row?.full_name ?? null,
          login: null,
          temporary_password: null,
          error: message,
        });
      if (!row) {
        fail('Không tìm thấy hồ sơ nhân sự');
        continue;
      }
      if (row.status !== 'active') {
        fail('Nhân sự đã nghỉ việc');
        continue;
      }
      if (row.user_id) {
        fail('Nhân sự đã có tài khoản');
        continue;
      }
      if (unitIds !== 'all' && !unitIds.includes(row.org_unit_id)) {
        fail('Nhân sự nằm ngoài phạm vi của bạn');
        continue;
      }
      const username = suggestUsername(row.code);
      const phone = row.phone && PHONE_PATTERN.test(row.phone) ? row.phone : null;
      if (!username && !phone) {
        fail('Mã nhân sự không dùng làm tên đăng nhập được và chưa có số điện thoại hợp lệ');
        continue;
      }
      const input = {
        full_name: row.full_name,
        username,
        phone,
        valid_until: null,
        roles: [{ role_code: roleCode, org_unit_id: wholeSchoolRole ? null : row.org_unit_id }],
      };
      let created: { account: { id: string }; temporary_password: string | null };
      try {
        try {
          created = await this.identityClient.createAccount(accessToken, input);
        } catch (error) {
          // Số điện thoại đã thuộc tài khoản khác thì tạo lại chỉ bằng tên đăng nhập
          if (
            error instanceof ApplicationError &&
            error.code === 'ERR_CONFLICT' &&
            phone &&
            username &&
            error.details.some((detail) => detail.field === 'phone')
          ) {
            created = await this.identityClient.createAccount(accessToken, { ...input, phone: null });
          } else {
            throw error;
          }
        }
      } catch (error) {
        fail(error instanceof ApplicationError ? error.message : 'Không tạo được tài khoản');
        continue;
      }
      await database.transaction().execute(async (transaction) => {
        await transaction
          .updateTable('staff')
          .set({ user_id: created.account.id, updated_at: this.clock.now() })
          .where('id', '=', staffId)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'staff',
          entityId: staffId,
          action: 'update',
          before: { user_id: null },
          after: { user_id: created.account.id, login: username ?? phone, role_code: roleCode },
        });
      });
      results.push({
        staff_id: staffId,
        code: row.code,
        full_name: row.full_name,
        login: username ?? phone,
        temporary_password: created.temporary_password,
        error: null,
      });
    }
    return { items: results };
  }

  // Đơn vị người thao tác quản lý tài khoản: 'all' khi toàn trường (P01.account.manage hoặc gán ở Trường chính)
  private async accountUnits(currentUser: CurrentUser): Promise<'all' | string[]> {
    if (currentUser.hasPermission(PERMISSION_CODES.accountManage)) {
      return 'all';
    }
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.accountManageInUnit);
    return scope.wholeSchool ? 'all' : scope.orgUnitIds;
  }

  // Tham số gọi dịch vụ định danh; null khi lọc mã định danh không khớp nhân sự nào có tài khoản
  private async identityQuery(
    database: Kysely<SchoolYearDatabase> | undefined,
    filter: AccountDirectoryFilter,
  ): Promise<URLSearchParams | null> {
    const query = new URLSearchParams();
    for (const field of [
      'q',
      'status',
      'role_code',
      'login',
      'full_name',
      'must_change_password',
      'password_expires_from',
      'password_expires_to',
    ] as const) {
      const value = filter[field];
      if (value) {
        query.set(field, value);
      }
    }
    if (filter.identifier) {
      if (!database) {
        return null;
      }
      const pattern = `%${filter.identifier.toLowerCase().replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      const matches = await database
        .selectFrom('staff')
        .select('user_id')
        .where('user_id', 'is not', null)
        .where((expression) =>
          expression.or([
            expression(expression.fn('lower', ['code']), 'like', pattern),
            expression(expression.fn('lower', ['moet_staff_code']), 'like', pattern),
          ]),
        )
        .limit(IDENTIFIER_MATCH_LIMIT + 1)
        .execute();
      const userIds = [...new Set(matches.map((match) => match.user_id).filter((id): id is string => id !== null))];
      if (userIds.length > IDENTIFIER_MATCH_LIMIT) {
        throw ruleViolationError(
          ACCOUNT_DIRECTORY_RULE_CODE,
          `Mã định danh khớp với hơn ${IDENTIFIER_MATCH_LIMIT} nhân sự, hãy nhập thêm ký tự`,
        );
      }
      if (userIds.length === 0) {
        return null;
      }
      query.set('user_ids', userIds.join(','));
    }
    return query;
  }

  // Mã nhân sự, mã Bộ của tài khoản đã liên kết hồ sơ nhân sự ở năm học hiện hành
  private async withStaffCodes(
    database: Kysely<SchoolYearDatabase> | undefined,
    accounts: IdentityAccount[],
  ): Promise<AccountDirectoryItem[]> {
    const userIds = accounts.map((account) => account.id);
    const staff =
      database && userIds.length > 0
        ? await database
            .selectFrom('staff')
            .select(['id', 'user_id', 'code', 'moet_staff_code'])
            .where('user_id', 'in', userIds)
            .orderBy('status')
            .execute()
        : [];
    return accounts.map((account) => {
      const row = staff.find((item) => item.user_id === account.id);
      return {
        ...account,
        staff_id: row?.id ?? null,
        staff_code: row?.code ?? null,
        moet_staff_code: row?.moet_staff_code ?? null,
      };
    });
  }
}

function readPaging(query: Record<string, string | undefined>, errors: FieldError[]) {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.page_size ?? 20);
  if (!Number.isInteger(page) || page < 1) {
    errors.push({ field: 'page', message: 'Số trang bắt đầu từ 1' });
  }
  if (!PAGE_SIZES.has(pageSize)) {
    errors.push({ field: 'page_size', message: 'Cỡ trang là 10, 20, 50, 100 hoặc 200' });
  }
  return { page, pageSize };
}

@Controller('account-directory')
export class AccountDirectoryController {
  constructor(private readonly service: AccountDirectoryService) {}

  @Get()
  @RequirePermission(...ACCOUNT_PERMISSIONS)
  list(@Req() request: Request, @Query() query: Record<string, string | undefined>) {
    const errors: FieldError[] = [];
    const { page, pageSize } = readPaging(query, errors);
    const filter = readAccountDirectoryFilter(query, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.list(readBearerToken(request.header('authorization')), filter, page, pageSize);
  }

  // Xuất Excel cần quyền xuất dữ liệu và quyền quản lý tài khoản; dịch vụ định danh chỉ trả tài khoản trong phạm vi
  @Post('export')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.dataExport)
  async exportList(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!ACCOUNT_PERMISSIONS.some((code) => currentUser.hasPermission(code))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền quản lý tài khoản');
    }
    const errors: FieldError[] = [];
    const filter = readAccountDirectoryFilter(body ?? {}, errors);
    let columns = DEFAULT_ACCOUNT_EXPORT_COLUMNS;
    const rawColumns = body?.columns;
    if (rawColumns !== undefined && rawColumns !== null) {
      if (
        !Array.isArray(rawColumns) ||
        rawColumns.length === 0 ||
        rawColumns.some((id) => !ACCOUNT_EXPORT_COLUMNS.some((column) => column.id === id)) ||
        new Set(rawColumns).size !== rawColumns.length
      ) {
        errors.push({ field: 'columns', message: 'Danh sách cột không hợp lệ' });
      } else {
        columns = rawColumns as string[];
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    sendWorkbook(
      response,
      await this.service.exportList(
        readBearerToken(request.header('authorization')),
        currentUser,
        filter,
        columns,
        request.ip ?? null,
      ),
    );
  }

  @Get('staff-without-account')
  @RequirePermission(...ACCOUNT_PERMISSIONS)
  staffWithoutAccount(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.staffWithoutAccount(currentUser);
  }

  @Post('staff-accounts')
  @HttpCode(200)
  @RequirePermission(...ACCOUNT_PERMISSIONS)
  createStaffAccounts(
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const staffIds = body?.staff_ids;
    if (
      !Array.isArray(staffIds) ||
      staffIds.length === 0 ||
      staffIds.length > STAFF_ACCOUNT_LIMIT ||
      staffIds.some((id) => !isUuid(id))
    ) {
      errors.push({ field: 'staff_ids', message: `Chọn từ 1 đến ${STAFF_ACCOUNT_LIMIT} nhân sự` });
    }
    const roleCode = typeof body?.role_code === 'string' ? body.role_code.trim() : '';
    if (!roleCode) {
      errors.push({ field: 'role_code', message: 'Bắt buộc chọn nhóm quyền' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.createStaffAccounts(
      readBearerToken(request.header('authorization')),
      currentUser,
      [...new Set(staffIds as string[])],
      roleCode,
      originOf(request, currentUser),
    );
  }
}
