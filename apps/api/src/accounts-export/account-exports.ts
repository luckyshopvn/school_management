import { Body, Controller, HttpCode, Injectable, Post, Req, Res } from '@nestjs/common';
import {
  Clock,
  readBearerToken,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { IdentityClient, type IdentityAccount, type IdentityRole } from '../authentication/identity-client.js';
import { readExportColumns } from '../classes/class-list.js';
import { buildStudentWorkbook, fileStamp, sendWorkbook } from '../children/student-workbook.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import type { RequestBody } from '../common/request-fields.js';

// Xuất Excel 1.1. Nhóm người dùng và 1.4. Danh sách người dùng theo Sở (DT-16 phần 16b): tài khoản, nhóm do dịch vụ định
// danh giữ nên máy chủ API đọc lại bằng mã phiên của người xuất (dịch vụ định danh tự kiểm tra quyền xem như khi mở lưới),
// dựng tệp theo các cột đang hiện, ghi nhật ký xuất ở năm học đang mở (BR-74) như các tệp xuất khác. Đường dẫn
// /account-exports để không trùng nhóm /users, /roles chuyển thẳng sang dịch vụ định danh
const EXPORT_LIMIT = 10_000;
const IDENTITY_PAGE_SIZE = 200;
// Quy tắc xuất dữ liệu ra tệp (BR-74)
const ACCOUNT_RULE_CODE = 'BR-74';

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';

// Như cột Loại tài khoản trên lưới: chỉ có vai trò phụ huynh (VT-14) là tài khoản phụ huynh
function accountType(account: IdentityAccount): string {
  if (account.assignments.length === 0) {
    return 'Chưa có nhóm quyền';
  }
  return account.assignments.every((assignment) => assignment.role_code === 'VT-14')
    ? 'Phụ huynh'
    : 'Cán bộ, nhân viên';
}

export const ACCOUNT_EXPORT_COLUMNS: Array<{ id: string; label: string; value(row: IdentityAccount): string }> = [
  { id: 'login', label: 'Tên đăng nhập', value: (row) => row.username ?? row.phone ?? '' },
  { id: 'full_name', label: 'Tên hiển thị', value: (row) => row.full_name },
  {
    id: 'roles',
    label: 'Nhóm quyền',
    value: (row) => [...new Set(row.assignments.map((assignment) => assignment.role_name))].join(', '),
  },
  { id: 'account_type', label: 'Loại tài khoản', value: accountType },
  { id: 'status', label: 'Trạng thái', value: (row) => (row.status === 'active' ? 'Đang hoạt động' : 'Đã khóa') },
  {
    id: 'must_change_password',
    label: 'Trạng thái đổi mật khẩu',
    value: (row) => (row.must_change_password ? 'Chờ đổi mật khẩu' : 'Đã đổi'),
  },
  { id: 'valid_until', label: 'Ngày hết hiệu lực', value: (row) => row.valid_until ?? '' },
  { id: 'phone', label: 'Số điện thoại', value: (row) => row.phone ?? '' },
  { id: 'last_login_at', label: 'Đăng nhập gần nhất', value: (row) => formatDateTime(row.last_login_at) },
  {
    id: 'password_changed_at',
    label: 'Thời gian đổi mật khẩu',
    value: (row) => formatDateTime(row.password_changed_at),
  },
];

export const DEFAULT_ACCOUNT_EXPORT_COLUMNS = [
  'login',
  'full_name',
  'roles',
  'account_type',
  'status',
  'must_change_password',
];

// Như "Là nhóm quản trị" trên lưới: nhóm có quyền quản lý tài khoản toàn trường hoặc trong đơn vị
const isAdministratorRole = (role: IdentityRole) =>
  role.permissions.includes(PERMISSION_CODES.accountManage) ||
  role.permissions.includes(PERMISSION_CODES.accountManageInUnit);

export const ROLE_EXPORT_COLUMNS: Array<{ id: string; label: string; value(row: IdentityRole): string | number }> = [
  { id: 'code', label: 'Mã nhóm', value: (row) => row.code },
  { id: 'name', label: 'Tên nhóm', value: (row) => row.name },
  { id: 'active', label: 'Hiệu lực', value: () => 'Có' },
  { id: 'administrator', label: 'Là nhóm quản trị', value: (row) => (isAdministratorRole(row) ? 'Có' : '') },
  { id: 'system', label: 'Là nhóm hệ thống', value: (row) => (row.is_system ? 'Có' : '') },
  { id: 'permission_count', label: 'Số quyền', value: (row) => row.permissions.length },
];

export const DEFAULT_ROLE_EXPORT_COLUMNS = ['code', 'name', 'active', 'administrator', 'system'];

// Bộ lọc của 1.4 như lưới gửi cho dịch vụ định danh; giá trị sai do dịch vụ định danh báo lỗi
const ACCOUNT_FILTER_FIELDS = ['q', 'status', 'role_code', 'login', 'full_name', 'must_change_password'] as const;

function readAccountFilter(body: RequestBody, errors: FieldError[]): Record<string, string> {
  const filter: Record<string, string> = {};
  for (const field of ACCOUNT_FILTER_FIELDS) {
    const value = body?.[field];
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (typeof value !== 'string' || value.length > 100) {
      errors.push({ field, message: 'Phải là chữ, tối đa 100 ký tự' });
      continue;
    }
    if (value.trim() !== '') {
      filter[field] = value.trim();
    }
  }
  return filter;
}

// Từ khóa ô Tìm kiếm của 1.1: mã hoặc tên nhóm chứa từ khóa
function readRoleKeyword(body: RequestBody, errors: FieldError[]): string | null {
  const value = body?.q;
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string' || value.length > 100) {
    errors.push({ field: 'q', message: 'Phải là chữ, tối đa 100 ký tự' });
    return null;
  }
  return value.trim() === '' ? null : value.trim().toLocaleLowerCase('vi');
}

@Injectable()
export class AccountExportsService {
  constructor(
    private readonly identityClient: IdentityClient,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  async exportAccounts(
    currentUser: CurrentUser,
    accessToken: string,
    filter: Record<string, string>,
    columns: string[],
    ipAddress: string | null,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const rows: IdentityAccount[] = [];
    for (let page = 1; ; page += 1) {
      const query = new URLSearchParams({ ...filter, page: String(page), page_size: String(IDENTITY_PAGE_SIZE) });
      const result = await this.identityClient.listAccounts(accessToken, query);
      if (result.total > EXPORT_LIMIT) {
        throw ruleViolationError(
          ACCOUNT_RULE_CODE,
          `Danh sách có hơn ${EXPORT_LIMIT} tài khoản; hãy thu hẹp bộ lọc trước khi xuất`,
        );
      }
      rows.push(...result.items);
      if (page >= result.total_pages || result.items.length === 0) {
        break;
      }
    }
    const selected = columns.flatMap((id) => ACCOUNT_EXPORT_COLUMNS.filter((column) => column.id === id));
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'accounts',
      title: 'Danh sách người dùng',
      fileName: `danh-sach-nguoi-dung-${fileStamp(createdAt)}.xlsx`,
      filters: filter,
      orgUnitIds: [],
      columns: selected.map((column) => ({ key: column.id, label: column.label })),
      rows: rows.map((row) => Object.fromEntries(selected.map((column) => [column.id, column.value(row)]))),
      ipAddress,
      createdAt,
    });
  }

  async exportRoles(
    currentUser: CurrentUser,
    accessToken: string,
    keyword: string | null,
    columns: string[],
    ipAddress: string | null,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const rows = (await this.identityClient.listRoles(accessToken)).filter(
      (role) =>
        keyword === null ||
        role.code.toLocaleLowerCase('vi').includes(keyword) ||
        role.name.toLocaleLowerCase('vi').includes(keyword),
    );
    const selected = columns.flatMap((id) => ROLE_EXPORT_COLUMNS.filter((column) => column.id === id));
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'roles',
      title: 'Nhóm người dùng',
      fileName: `nhom-nguoi-dung-${fileStamp(createdAt)}.xlsx`,
      filters: { q: keyword },
      orgUnitIds: [],
      columns: selected.map((column) => ({ key: column.id, label: column.label })),
      rows: rows.map((row) => Object.fromEntries(selected.map((column) => [column.id, column.value(row)]))),
      ipAddress,
      createdAt,
      containsPersonalData: false,
    });
  }
}

@Controller('account-exports')
export class AccountExportsController {
  constructor(private readonly service: AccountExportsService) {}

  // Xuất Excel 1.4 Danh sách người dùng theo bộ lọc và các cột đang hiện; cần quyền xuất dữ liệu (BR-74)
  @Post('users')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.dataExport)
  async exportAccounts(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const filter = readAccountFilter(body, errors);
    const columns = readExportColumns(body, ACCOUNT_EXPORT_COLUMNS, DEFAULT_ACCOUNT_EXPORT_COLUMNS, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const accessToken = readBearerToken(request.header('authorization'));
    sendWorkbook(
      response,
      await this.service.exportAccounts(currentUser, accessToken, filter, columns, request.ip ?? null),
    );
  }

  // Xuất Excel 1.1 Nhóm người dùng theo từ khóa và các cột đang hiện; cần quyền xuất dữ liệu (BR-74)
  @Post('roles')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.dataExport)
  async exportRoles(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const keyword = readRoleKeyword(body, errors);
    const columns = readExportColumns(body, ROLE_EXPORT_COLUMNS, DEFAULT_ROLE_EXPORT_COLUMNS, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const accessToken = readBearerToken(request.header('authorization'));
    sendWorkbook(
      response,
      await this.service.exportRoles(currentUser, accessToken, keyword, columns, request.ip ?? null),
    );
  }
}
