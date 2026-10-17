import { Body, Controller, HttpCode, Injectable, Post, Req, Res } from '@nestjs/common';
import { Clock, readBearerToken, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { IdentityClient, type IdentityRole } from '../authentication/identity-client.js';
import { readExportColumns } from '../classes/class-list.js';
import { buildStudentWorkbook, fileStamp, sendWorkbook } from '../children/student-workbook.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import type { RequestBody } from '../common/request-fields.js';

// Xuất Excel 1.1. Nhóm người dùng theo Sở (DT-16 phần 16b): nhóm do dịch vụ định danh giữ nên máy chủ API đọc lại bằng mã
// phiên của người xuất (dịch vụ định danh tự kiểm tra quyền xem như khi mở lưới), dựng tệp theo các cột đang hiện, ghi nhật
// ký xuất ở năm học đang mở (BR-74) như các tệp xuất khác. 1.4. Danh sách người dùng xuất ở /account-directory/export (DT-16
// phần 16d). Đường dẫn /account-exports để không trùng nhóm /roles chuyển thẳng sang dịch vụ định danh

// Như "Là nhóm quản trị" trên lưới: nhóm có quyền quản lý tài khoản toàn trường hoặc trong đơn vị
const isAdministratorRole = (role: IdentityRole) =>
  role.permissions.includes(PERMISSION_CODES.accountManage) ||
  role.permissions.includes(PERMISSION_CODES.accountManageInUnit);

export const ROLE_EXPORT_COLUMNS: Array<{ id: string; label: string; value(row: IdentityRole): string | number }> = [
  { id: 'code', label: 'Mã nhóm', value: (row) => row.code },
  { id: 'name', label: 'Tên nhóm', value: (row) => row.name },
  { id: 'active', label: 'Hiệu lực', value: (row) => (row.is_active ? 'Có' : '') },
  { id: 'administrator', label: 'Là nhóm quản trị', value: (row) => (isAdministratorRole(row) ? 'Có' : '') },
  { id: 'system', label: 'Là nhóm hệ thống', value: (row) => (row.is_system ? 'Có' : '') },
  { id: 'permission_count', label: 'Số quyền', value: (row) => row.permissions.length },
  { id: 'user_count', label: 'Số người dùng', value: (row) => row.user_count },
];

export const DEFAULT_ROLE_EXPORT_COLUMNS = ['code', 'name', 'active', 'administrator', 'system'];

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
