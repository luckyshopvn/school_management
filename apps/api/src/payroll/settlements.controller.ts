import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { ReceiptMethod } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readEnum } from '../fees/fee-catalog-fields.js';
import { SettlementsService } from './settlements.service.js';

// Bảng quyết toán, phiếu thu thu hồi lương, phiếu chi lương (P08-06; BR-90; YCTD-61). Quyền kiểm tra ở tầng nghiệp vụ
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const METHODS: readonly ReceiptMethod[] = ['cash', 'transfer', 'other'];
const MAXIMUM_TEXT = 500;

function readRequestKey(body: RequestBody, errors: FieldError[]): string {
  return readRequiredUuid(body, 'request_key', errors, 'Thiếu mã yêu cầu chống gửi trùng');
}

function readPaymentSource(body: RequestBody) {
  const errors: FieldError[] = [];
  const input = {
    accountId: readRequiredUuid(body, 'account_id', errors, 'Bắt buộc chọn nguồn chi'),
    categoryId: readRequiredUuid(body, 'category_id', errors, 'Bắt buộc chọn khoản mục chi'),
    requestKey: readRequestKey(body, errors),
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

function readReason(body: RequestBody): string {
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!reason || reason.length > MAXIMUM_TEXT) {
    throw validationError([{ field: 'reason', message: `Bắt buộc nhập lý do, tối đa ${MAXIMUM_TEXT} ký tự` }]);
  }
  return reason;
}

@Controller()
export class SettlementsController {
  constructor(private readonly settlements: SettlementsService) {}

  @Get('payroll-settlements')
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.settlements.list(currentUser);
  }

  @Post('payroll-settlements')
  @HttpCode(201)
  calculate(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const contractId = readRequiredUuid(body, 'contract_id', errors, 'Bắt buộc chọn hợp đồng đã chấm dứt');
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.settlements.calculate(currentUser, contractId, originOf(request, currentUser));
  }

  @Get('payroll-settlements/:id')
  read(
    @Param('id', uuidParameter('Mã bảng quyết toán không hợp lệ')) settlementId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.settlements.read(currentUser, settlementId);
  }

  @Post('payroll-settlements/:id/submit')
  submit(
    @Param('id', uuidParameter('Mã bảng quyết toán không hợp lệ')) settlementId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.settlements.submit(currentUser, settlementId, originOf(request, currentUser));
  }

  @Post('payroll-settlements/:id/approve')
  approve(
    @Param('id', uuidParameter('Mã bảng quyết toán không hợp lệ')) settlementId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.settlements.decide(
      currentUser,
      settlementId,
      { approve: true, reason: null },
      originOf(request, currentUser),
    );
  }

  @Post('payroll-settlements/:id/return')
  returnToDraft(
    @Param('id', uuidParameter('Mã bảng quyết toán không hợp lệ')) settlementId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.settlements.decide(
      currentUser,
      settlementId,
      { approve: false, reason: readReason(body) },
      originOf(request, currentUser),
    );
  }

  @Post('payroll-settlements/:id/recovery-receipts')
  @HttpCode(201)
  recover(
    @Param('id', uuidParameter('Mã bảng quyết toán không hợp lệ')) settlementId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const amount = body?.amount;
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
      errors.push({ field: 'amount', message: 'Số tiền là số nguyên đồng lớn hơn 0' });
    }
    const receiptDate = body?.receipt_date;
    if (typeof receiptDate !== 'string' || !DATE_PATTERN.test(receiptDate)) {
      errors.push({ field: 'receipt_date', message: 'Ngày theo dạng YYYY-MM-DD' });
    }
    const content =
      typeof body?.content === 'string' && body.content.trim() ? body.content.trim().slice(0, MAXIMUM_TEXT) : null;
    const input = {
      amount: amount as number,
      method: readEnum(body, 'method', METHODS, errors, true) ?? 'cash',
      accountId: readRequiredUuid(body, 'account_id', errors, 'Bắt buộc chọn quỹ hoặc tài khoản'),
      categoryId: readRequiredUuid(body, 'category_id', errors, 'Bắt buộc chọn khoản mục thu hồi lương'),
      receiptDate: receiptDate as string,
      content,
      requestKey: readRequestKey(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.settlements.recover(currentUser, settlementId, input, originOf(request, currentUser));
  }

  @Post('payroll-settlements/:id/payment')
  @HttpCode(201)
  settlementPayment(
    @Param('id', uuidParameter('Mã bảng quyết toán không hợp lệ')) settlementId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.settlements.createSettlementPayment(
      currentUser,
      settlementId,
      readPaymentSource(body),
      originOf(request, currentUser),
    );
  }

  @Post('payrolls/:id/payment')
  @HttpCode(201)
  payrollPayment(
    @Param('id', uuidParameter('Mã bảng lương không hợp lệ')) payrollId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.settlements.createPayrollPayment(
      currentUser,
      payrollId,
      readPaymentSource(body),
      originOf(request, currentUser),
    );
  }
}
