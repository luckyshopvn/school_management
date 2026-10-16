import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApplicationError, readBearerToken, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { MAXIMUM_IMPORT_BYTES } from './excel.js';
import { ImportsService } from './imports.service.js';

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

function requireFile(file: UploadedPart | undefined): UploadedPart {
  if (!file || file.size === 0) {
    throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp' }]);
  }
  return file;
}

const fileName = (file: UploadedPart) => Buffer.from(file.originalname, 'latin1').toString('utf8');

// Quyền theo loại dữ liệu nhập: lớp và trẻ chỉ Hiệu trưởng, công nợ đầu kỳ cho kế toán (YCTD-54); tệp CSDL ngành của trẻ
// như nhập trẻ, của nhân sự như nhập nhân sự (YCTD-100)
function permissionOf(type: string): string {
  return type === 'moet_codes'
    ? PERMISSION_CODES.childManage
    : type === 'opening_debts'
      ? PERMISSION_CODES.openingDebtImport
      : type === 'staff' || type === 'moet_staff'
        ? PERMISSION_CODES.importStaff
        : PERMISSION_CODES.importChildren;
}

const UPLOAD_TYPES = ['classes', 'children', 'opening_debts', 'staff', 'moet_children', 'moet_staff'] as const;
type UploadType = (typeof UPLOAD_TYPES)[number];
const isUploadType = (value: unknown): value is UploadType => UPLOAD_TYPES.includes(value as UploadType);

function assertCanImport(currentUser: CurrentUser, type: string): void {
  if (!currentUser.hasPermission(permissionOf(type))) {
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền nhập loại dữ liệu này');
  }
}
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TEMPLATE_PERMISSIONS = [
  PERMISSION_CODES.importChildren,
  PERMISSION_CODES.childManage,
  PERMISSION_CODES.openingDebtImport,
  PERMISSION_CODES.importStaff,
];

// Cột được chọn để nhập gửi kèm tệp dạng "khóa1,khóa2"; bỏ trống là mọi cột (DT-16 phần 16a)
function readColumnKeys(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw validationError([{ field: 'columns', message: 'Danh sách cột không hợp lệ' }]);
  }
  return [...new Set(value.split(',').map((key) => key.trim()).filter(Boolean))];
}

// Nhập dữ liệu ban đầu từ Excel (P01-13): lớp và trẻ chỉ Hiệu trưởng, công nợ đầu kỳ cho kế toán; nhập mã ngành (P02-12)
// cho người lập hồ sơ trẻ (BM-63, YCTD-46, YCTD-54)
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get('templates/:type')
  @RequirePermission(...TEMPLATE_PERMISSIONS)
  async template(
    @Param('type') rawType: string,
    @Query('with_data') withData: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const type = this.importsService.assertImportType(rawType);
    assertCanImport(currentUser, type);
    const buffer = await this.importsService.template(currentUser, type, withData === 'true', request.ip ?? null);
    response.setHeader('content-type', XLSX_TYPE);
    response.setHeader(
      'content-disposition',
      `attachment; filename="mau-nhap-${type}${withData === 'true' ? '-kem-du-lieu' : ''}.xlsx"`,
    );
    response.send(buffer);
  }

  // Cột của mẫu để chọn cột nhập (DT-16 phần 16a)
  @Get('templates/:type/columns')
  @RequirePermission(...TEMPLATE_PERMISSIONS)
  columns(@Param('type') rawType: string, @AuthenticatedUser() currentUser: CurrentUser) {
    const type = this.importsService.assertImportType(rawType);
    assertCanImport(currentUser, type);
    return this.importsService.columns(type);
  }

  // "Tra cứu danh mục": mã, tên các danh mục dùng trong tệp (DT-16 phần 16a)
  @Get('catalogs/:type')
  @RequirePermission(...TEMPLATE_PERMISSIONS)
  async catalogs(@Param('type') rawType: string, @AuthenticatedUser() currentUser: CurrentUser) {
    const type = this.importsService.assertImportType(rawType);
    assertCanImport(currentUser, type);
    return { items: await this.importsService.catalogs(currentUser, type) };
  }

  @Post('moet-codes')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childManage)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  importMoetCodes(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const uploaded = requireFile(file);
    return this.importsService.importMoetCodes(
      currentUser,
      fileName(uploaded),
      uploaded.buffer,
      originOf(request, currentUser),
      readColumnKeys(body?.columns),
    );
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.importChildren, PERMISSION_CODES.openingDebtImport, PERMISSION_CODES.importStaff)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  upload(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const type = body?.type;
    if (!isUploadType(type)) {
      throw validationError([{ field: 'type', message: `Loại dữ liệu nhập là ${UPLOAD_TYPES.join(', ')}` }]);
    }
    assertCanImport(currentUser, type);
    // Tệp CSDL ngành không có đơn vị: người nhập chọn đơn vị để so khớp lớp và gắn hồ sơ mới (YCTD-100)
    const isMoet = type === 'moet_children' || type === 'moet_staff';
    const orgUnitId = body?.org_unit_id;
    if (isMoet && !isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Chọn đơn vị' }]);
    }
    const uploaded = requireFile(file);
    return this.importsService.upload(
      currentUser,
      type,
      fileName(uploaded),
      uploaded.buffer,
      originOf(request, currentUser),
      isMoet ? (orgUnitId as string) : null,
      isMoet ? undefined : readColumnKeys(body?.columns),
    );
  }

  // "Xuất file lỗi": tệp gốc kèm cột Nội dung lỗi theo từng dòng (DT-16 phần 16a)
  @Get(':id/error-file')
  @RequirePermission(...TEMPLATE_PERMISSIONS)
  async errorFile(
    @Param('id', uuidParameter('Mã lần nhập không hợp lệ')) jobId: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    assertCanImport(currentUser, (await this.importsService.get(jobId)).import_type);
    const file = await this.importsService.errorFile(jobId);
    response.setHeader('content-type', XLSX_TYPE);
    // Tên tệp gốc có thể có dấu nên thêm filename* theo RFC 5987; filename là tên không dấu
    response.setHeader(
      'content-disposition',
      `attachment; filename="tep-loi-${jobId.slice(0, 8)}.xlsx"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    response.setHeader('cache-control', 'no-store');
    response.send(file.buffer);
  }

  @Get(':id')
  @RequirePermission(PERMISSION_CODES.importChildren, PERMISSION_CODES.openingDebtImport, PERMISSION_CODES.importStaff)
  async get(
    @Param('id', uuidParameter('Mã lần nhập không hợp lệ')) jobId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const job = await this.importsService.get(jobId);
    assertCanImport(currentUser, job.import_type);
    return job;
  }

  @Post(':id/commit')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.importChildren, PERMISSION_CODES.openingDebtImport, PERMISSION_CODES.importStaff)
  async commit(
    @Param('id', uuidParameter('Mã lần nhập không hợp lệ')) jobId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    assertCanImport(currentUser, (await this.importsService.get(jobId)).import_type);
    return this.importsService.commit(
      currentUser,
      readBearerToken(request.header('authorization')),
      jobId,
      originOf(request, currentUser),
    );
  }
}
