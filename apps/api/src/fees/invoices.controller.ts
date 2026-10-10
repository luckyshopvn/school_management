import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ruleViolationError, validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { FeeCalculationService } from './fee-calculation.service.js';
import { parsePeriod } from './registration-periods.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readDueDate(body: RequestBody): string {
  const value = body?.due_date;
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw validationError([{ field: 'due_date', message: 'Ngày đến hạn dạng YYYY-MM-DD' }]);
  }
  return value;
}

function readUnit(value: unknown): string {
  if (!isUuid(value)) {
    throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
  }
  return value;
}

// Tính học phí, phát hành hóa đơn chính và bổ sung, xem hóa đơn (P05-05, P05-06; YCTD-51).
// Quyền kiểm tra ở tầng nghiệp vụ theo phạm vi đơn vị và quan hệ phụ huynh
@Controller()
export class InvoicesController {
  constructor(private readonly feeCalculation: FeeCalculationService) {}

  @Post('fee-calculations')
  @HttpCode(201)
  calculate(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.feeCalculation.calculate(
      currentUser,
      readUnit(body?.org_unit_id),
      parsePeriod(body?.period),
      originOf(request, currentUser),
    );
  }

  @Get('fee-calculations/:id')
  readRun(
    @Param('id', uuidParameter('Mã lần tính không hợp lệ')) runId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.feeCalculation.readRun(currentUser, runId);
  }

  @Post('invoices/issue')
  @HttpCode(200)
  issue(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.feeCalculation.issue(
      currentUser,
      readUnit(body?.org_unit_id),
      parsePeriod(body?.period),
      readDueDate(body),
      originOf(request, currentUser),
    );
  }

  @Post('invoices/supplementary')
  @HttpCode(201)
  supplementary(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const childId = readRequiredUuid(body, 'child_id', errors, 'Bắt buộc chọn trẻ');
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.feeCalculation.issueSupplementary(
      currentUser,
      childId,
      parsePeriod(body?.period),
      readDueDate(body),
      originOf(request, currentUser),
    );
  }

  @Get('invoices')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (query.child_id !== undefined && !isUuid(query.child_id)) {
      throw validationError([{ field: 'child_id', message: 'Mã trẻ không hợp lệ' }]);
    }
    if (query.status !== undefined && query.status !== 'draft' && query.status !== 'issued') {
      throw validationError([{ field: 'status', message: 'Trạng thái là draft hoặc issued' }]);
    }
    return this.feeCalculation.list(currentUser, {
      orgUnitId: query.org_unit_id === undefined ? undefined : readUnit(query.org_unit_id),
      period: query.period === undefined ? undefined : parsePeriod(query.period),
      childId: query.child_id,
      status: query.status as 'draft' | 'issued' | undefined,
    });
  }

  @Get('invoices/:id')
  read(
    @Param('id', uuidParameter('Mã hóa đơn không hợp lệ')) invoiceId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.feeCalculation.read(currentUser, invoiceId);
  }

  // Hóa đơn không sửa trực tiếp: hóa đơn nháp sửa bằng chạy lại tính, hóa đơn đã phát hành lập phiếu điều chỉnh (BR-25)
  @Patch('invoices/:id')
  async update(
    @Param('id', uuidParameter('Mã hóa đơn không hợp lệ')) invoiceId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const invoice = await this.feeCalculation.read(currentUser, invoiceId);
    throw invoice.status === 'issued'
      ? ruleViolationError('BR-25', 'Hóa đơn đã phát hành không sửa trực tiếp, cần lập phiếu điều chỉnh')
      : ruleViolationError(
          'BR-25',
          'Hóa đơn nháp không sửa trực tiếp, sửa đăng ký hoặc điểm danh rồi chạy lại tính học phí',
        );
  }
}
