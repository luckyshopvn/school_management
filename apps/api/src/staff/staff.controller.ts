import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { ContractType } from '@school-management/database';
import { readBearerToken, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import { sendExportOutcome } from '../exports/export-jobs.js';
import { CONTENT_TYPES, readTableFileFormat } from '../exports/table-file.js';
import { ministryCatalogs } from './staff-ministry-file.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import {
  isUuid,
  readOptionalText,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readAmount, readEnum } from '../fees/fee-catalog-fields.js';
import { DEFAULT_STAFF_EXPORT_COLUMNS, readStaffListFilter, STAFF_EXPORT_COLUMNS } from './staff-list.js';
import { readStaffProfileChanges } from './staff-profile.js';
import { StaffService, type ContractInput, type StaffInput } from './staff.service.js';

// Hồ sơ nhân sự và hợp đồng lao động (P07-01, P07-02, P07-04; YCTD-58). Quyền kiểm tra ở tầng nghiệp vụ theo đơn vị
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_NUMBER_PATTERN = /^\d{12}$/;
const CONTRACT_TYPES: readonly ContractType[] = ['probation', 'fixed_term', 'indefinite'];
const MAXIMUM_TEXT = 500;

function readDate(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | null {
  const value = body?.[field];
  if ((value === undefined || value === null || value === '') && !required) {
    return null;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
    return null;
  }
  return value;
}

function readStaff(body: RequestBody, errors: FieldError[]): StaffInput {
  const gender = readEnum(body, 'gender', ['male', 'female'] as const, errors, false) ?? null;
  const idNumber = readOptionalText(body, 'id_number', errors);
  if (idNumber && !ID_NUMBER_PATTERN.test(idNumber)) {
    errors.push({ field: 'id_number', message: 'Số định danh cá nhân gồm mười hai chữ số' });
  }
  return {
    orgUnitId: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị chính'),
    code: readRequiredText(body, 'code', errors),
    fullName: readRequiredText(body, 'full_name', errors),
    dob: readDate(body, 'dob', errors, false),
    gender,
    phone: readOptionalText(body, 'phone', errors) ?? null,
    email: readOptionalText(body, 'email', errors) ?? null,
    address: readOptionalText(body, 'address', errors) ?? null,
    idNumber,
    departmentId: readOptionalUuid(body, 'department_id', errors) ?? null,
    jobTitleId: readOptionalUuid(body, 'job_title_id', errors) ?? null,
    startDate: readDate(body, 'start_date', errors, true) ?? '',
  };
}

// Tệp Excel dựng trực tiếp; tên tệp có thể có dấu nên thêm filename* theo RFC 5987
function sendXlsx(response: Response, file: { buffer: Buffer; fileName: string }) {
  response.setHeader('content-type', CONTENT_TYPES.xlsx);
  response.setHeader(
    'content-disposition',
    `attachment; filename="${file.fileName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
  );
  response.setHeader('cache-control', 'no-store');
  response.send(file.buffer);
}

function readAllowances(body: RequestBody, errors: FieldError[]): Array<{ name: string; amount: number }> {
  const value = body?.allowances ?? [];
  if (!Array.isArray(value)) {
    errors.push({ field: 'allowances', message: 'Danh sách phụ cấp không hợp lệ' });
    return [];
  }
  return value.map((entry: unknown, index) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) {
      errors.push({ field: `allowances.${index}.name`, message: 'Bắt buộc nhập tên phụ cấp' });
    }
    return { name, amount: readAmount(row.amount, `allowances.${index}.amount`, errors, 1) };
  });
}

@Controller()
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get('staff')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    for (const field of ['org_unit_id', 'department_id']) {
      if (query[field] !== undefined && !isUuid(query[field])) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    const status = readEnum(query, 'status', ['active', 'terminated'] as const, errors, false) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staff.list(currentUser, {
      orgUnitId: query.org_unit_id ?? null,
      departmentId: query.department_id ?? null,
      status,
      search: query.search?.trim() || null,
    });
  }

  // Lưới 3.1.1 Hồ sơ cán bộ, giáo viên theo Sở: phân trang, bộ lọc mở rộng của mục 3.1.4, A–Z (YCTD-112). `GET /staff`
  // giữ nguyên cho các màn hình khác và giao diện lập trình cho đối tác
  @Get('staff/search')
  search(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    if (!Number.isInteger(page) || page < 1) {
      errors.push({ field: 'page', message: 'Số trang bắt đầu từ 1' });
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
      errors.push({ field: 'page_size', message: 'Cỡ trang từ 1 đến 200' });
    }
    const filter = readStaffListFilter(query, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staff.search(currentUser, { ...filter, page, pageSize });
  }

  // Xuất Excel hoặc PDF theo bộ lọc và các cột đang hiện trên lưới; cần quyền xuất dữ liệu, ghi nhật ký xuất (BR-74).
  // Danh sách lớn trả 202 kèm tác vụ xuất nền (DT-16 phần 16a)
  @Post('staff/export')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.dataExport)
  async exportList(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const filter = readStaffListFilter(body ?? {}, errors);
    const rawColumns = body?.columns;
    let columns = DEFAULT_STAFF_EXPORT_COLUMNS;
    if (rawColumns !== undefined && rawColumns !== null) {
      if (
        !Array.isArray(rawColumns) ||
        rawColumns.length === 0 ||
        rawColumns.some((id) => !STAFF_EXPORT_COLUMNS.some((column) => column.id === id)) ||
        new Set(rawColumns).size !== rawColumns.length
      ) {
        errors.push({ field: 'columns', message: 'Danh sách cột không hợp lệ' });
      } else {
        columns = rawColumns as string[];
      }
    }
    const format = readTableFileFormat(body?.format);
    if (!format) {
      errors.push({ field: 'format', message: 'Định dạng xuất là xlsx hoặc pdf' });
    }
    if (errors.length > 0 || !format) {
      throw validationError(errors);
    }
    sendExportOutcome(response, await this.staff.exportList(currentUser, filter, columns, format, request.ip ?? null));
  }

  // "Xuất tệp theo mẫu Bộ" và "Xuất file lỗi": bản chạy nội bộ của "Đồng bộ hồ sơ lên CSDL Bộ" (DT-16 phần 16f); không gửi đi
  @Post('staff/ministry-export')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.dataExport)
  async ministryExport(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    sendXlsx(response, await this.staff.ministryExport(currentUser, this.filterOf(body), request.ip ?? null));
  }

  @Post('staff/ministry-errors')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.dataExport)
  async ministryErrors(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    sendXlsx(response, await this.staff.ministryErrorFile(currentUser, this.filterOf(body), request.ip ?? null));
  }

  // Tệp mẫu 75 cột của 3.1.3 Nhập nhân sự từ Excel (kèm dữ liệu) và danh mục của Bộ để tra cứu
  @Get('staff/ministry-template')
  @RequirePermission(PERMISSION_CODES.importStaff)
  async ministryTemplate(
    @Query('with_data') withData: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    sendXlsx(response, await this.staff.ministryTemplate(currentUser, withData === 'true', request.ip ?? null));
  }

  @Get('staff/ministry-catalogs')
  @RequirePermission(PERMISSION_CODES.importStaff, PERMISSION_CODES.staffView)
  ministryCatalogs() {
    return { items: ministryCatalogs() };
  }

  // Xóa hồ sơ nhập nhầm, chỉ hồ sơ chưa có dữ liệu liên quan (DT-16 phần 16f)
  @Post('staff/delete')
  @HttpCode(200)
  remove(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const ids = body?.staff_ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || ids.some((id) => !isUuid(id))) {
      throw validationError([{ field: 'staff_ids', message: 'Chọn từ 1 đến 200 hồ sơ' }]);
    }
    return this.staff.remove(currentUser, [...new Set(ids as string[])], originOf(request, currentUser));
  }

  private filterOf(body: RequestBody) {
    const errors: FieldError[] = [];
    const filter = readStaffListFilter(body ?? {}, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return filter;
  }

  @Get('staff/me')
  me(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.staff.me(currentUser);
  }

  // Hồ sơ nhân sự cá nhân ở menu người dùng (DT-16 phần 16c): người dùng tự sửa điện thoại, thư điện tử, chỗ ở của mình
  @Patch('staff/me/contact')
  updateOwnContact(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const contact = {
      phone: readOptionalText(body, 'phone', errors),
      email: readOptionalText(body, 'email', errors),
      address: readOptionalText(body, 'address', errors),
    };
    if (contact.phone && !/^\+?[0-9]{9,15}$/.test(contact.phone)) {
      errors.push({ field: 'phone', message: 'Số điện thoại gồm 9 đến 15 chữ số' });
    }
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      errors.push({ field: 'email', message: 'Thư điện tử không đúng định dạng' });
    }
    for (const [field, value] of Object.entries(contact)) {
      if (value && value.length > MAXIMUM_TEXT) {
        errors.push({ field, message: `Tối đa ${MAXIMUM_TEXT} ký tự` });
      }
    }
    if (errors.length === 0 && Object.values(contact).every((value) => value === undefined)) {
      errors.push({ field: 'contact', message: 'Cần ít nhất một mục liên hệ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staff.updateOwnContact(currentUser, contact, originOf(request, currentUser));
  }

  @Get('staff/expiring-contracts')
  expiring(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.staff.expiring(currentUser);
  }

  @Get('staff/:id')
  read(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.staff.read(currentUser, staffId);
  }

  @Post('staff')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = readStaff(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staff.create(currentUser, input, originOf(request, currentUser));
  }

  @Put('staff/:id')
  update(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readStaff(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staff.update(currentUser, staffId, input, originOf(request, currentUser));
  }

  // Ghi hồ sơ theo biểu mẫu của Sở (ô của Sở lưu ở moet_profile) và thông tin riêng của trường (YCTD-112)
  @Patch('staff/:id/profile')
  updateProfile(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes = readStaffProfileChanges(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staff.updateProfile(currentUser, staffId, changes, originOf(request, currentUser));
  }

  @Post('staff/:id/account')
  @HttpCode(200)
  linkAccount(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const login = readRequiredText(body, 'login', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staff.linkAccount(
      currentUser,
      readBearerToken(request.header('authorization')),
      staffId,
      login,
      originOf(request, currentUser),
    );
  }

  @Delete('staff/:id/account')
  unlinkAccount(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.staff.unlinkAccount(currentUser, staffId, originOf(request, currentUser));
  }

  @Post('staff/:id/contracts')
  @HttpCode(201)
  createContract(
    @Param('id', uuidParameter('Mã nhân sự không hợp lệ')) staffId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input: ContractInput = {
      contractNo: readRequiredText(body, 'contract_no', errors),
      contractType: readEnum(body, 'contract_type', CONTRACT_TYPES, errors, true) ?? 'fixed_term',
      startDate: readDate(body, 'start_date', errors, true) ?? '',
      endDate: readDate(body, 'end_date', errors, false),
      baseSalary: readAmount(body?.base_salary, 'base_salary', errors, 1),
      allowances: readAllowances(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staff.createContract(currentUser, staffId, input, originOf(request, currentUser));
  }

  @Post('employment-contracts/:id/terminate')
  @HttpCode(200)
  terminate(
    @Param('id', uuidParameter('Mã hợp đồng không hợp lệ')) contractId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const terminatedOn = readDate(body, 'terminated_on', errors, true) ?? '';
    const reason = readRequiredText(body, 'reason', errors);
    if (reason.length > MAXIMUM_TEXT) {
      errors.push({ field: 'reason', message: `Tối đa ${MAXIMUM_TEXT} ký tự` });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.staff.terminateContract(
      currentUser,
      readBearerToken(request.header('authorization')),
      contractId,
      { terminatedOn, reason },
      originOf(request, currentUser),
    );
  }
}
