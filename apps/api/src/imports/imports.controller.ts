import { Body, Controller, Get, HttpCode, Param, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApplicationError, readBearerToken, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import type { RequestBody } from '../common/request-fields.js';
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

// Quyền theo loại dữ liệu nhập: lớp và trẻ chỉ Hiệu trưởng, công nợ đầu kỳ cho kế toán (YCTD-54)
function permissionOf(type: string): string {
  return type === 'moet_codes'
    ? PERMISSION_CODES.childManage
    : type === 'opening_debts'
      ? PERMISSION_CODES.openingDebtImport
      : PERMISSION_CODES.importChildren;
}

function assertCanImport(currentUser: CurrentUser, type: string): void {
  if (!currentUser.hasPermission(permissionOf(type))) {
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền nhập loại dữ liệu này');
  }
}
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Nhập dữ liệu ban đầu từ Excel (P01-13): lớp và trẻ chỉ Hiệu trưởng, công nợ đầu kỳ cho kế toán; nhập mã ngành (P02-12)
// cho người lập hồ sơ trẻ (BM-63, YCTD-46, YCTD-54)
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get('templates/:type')
  @RequirePermission(PERMISSION_CODES.importChildren, PERMISSION_CODES.childManage, PERMISSION_CODES.openingDebtImport)
  async template(
    @Param('type') rawType: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const type = this.importsService.assertImportType(rawType);
    assertCanImport(currentUser, type);
    response.setHeader('content-type', XLSX_TYPE);
    response.setHeader('content-disposition', `attachment; filename="mau-nhap-${type}.xlsx"`);
    response.send(await this.importsService.template(type));
  }

  @Post('moet-codes')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childManage)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  importMoetCodes(
    @UploadedFile() file: UploadedPart | undefined,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const uploaded = requireFile(file);
    return this.importsService.importMoetCodes(
      currentUser,
      fileName(uploaded),
      uploaded.buffer,
      originOf(request, currentUser),
    );
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.importChildren, PERMISSION_CODES.openingDebtImport)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  upload(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const type = body?.type;
    if (type !== 'classes' && type !== 'children' && type !== 'opening_debts') {
      throw validationError([{ field: 'type', message: 'Loại dữ liệu nhập là classes, children hoặc opening_debts' }]);
    }
    assertCanImport(currentUser, type);
    const uploaded = requireFile(file);
    return this.importsService.upload(
      currentUser,
      type,
      fileName(uploaded),
      uploaded.buffer,
      originOf(request, currentUser),
    );
  }

  @Get(':id')
  @RequirePermission(PERMISSION_CODES.importChildren, PERMISSION_CODES.openingDebtImport)
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
  @RequirePermission(PERMISSION_CODES.importChildren, PERMISSION_CODES.openingDebtImport)
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
