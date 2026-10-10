import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import {
  isUuid,
  readOptionalText,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { DiscountsService } from './discounts.service.js';
import { MAXIMUM_AMOUNT } from './fee-catalog-fields.js';

const MAXIMUM_TEXT = 500;

function readLimited(body: RequestBody, field: string, errors: FieldError[]): string {
  const value = readRequiredText(body, field, errors);
  if (value.length > MAXIMUM_TEXT) {
    errors.push({ field, message: `Tối đa ${MAXIMUM_TEXT} ký tự` });
  }
  return value;
}

function readReason(body: RequestBody): string | null {
  const errors: FieldError[] = [];
  const reason = readOptionalText(body, 'reason', errors) ?? null;
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return reason;
}

// Miễn giảm, phiếu điều chỉnh hóa đơn và duyệt theo hạn mức (P05-07, P05-08; YCTD-52).
// Quyền kiểm tra ở tầng nghiệp vụ theo phạm vi đơn vị và hạn mức
@Controller()
export class DiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @Post('invoices/:id/discounts')
  @HttpCode(201)
  createDiscount(
    @Param('id', uuidParameter('Mã hóa đơn không hợp lệ')) invoiceId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const discountTypeId = readRequiredUuid(body, 'discount_type_id', errors, 'Loại miễn giảm không có trong danh mục');
    const basis = readLimited(body, 'basis', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.discounts.createDiscount(
      currentUser,
      invoiceId,
      { discountTypeId, basis },
      originOf(request, currentUser),
    );
  }

  @Post('invoices/:id/discounts/copy-previous')
  @HttpCode(201)
  copyPrevious(
    @Param('id', uuidParameter('Mã hóa đơn không hợp lệ')) invoiceId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.discounts.copyPrevious(currentUser, invoiceId, originOf(request, currentUser));
  }

  @Post('discounts/:id/approve')
  @HttpCode(200)
  approveDiscount(
    @Param('id', uuidParameter('Mã miễn giảm không hợp lệ')) discountId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.discounts.decideDiscount(
      currentUser,
      discountId,
      { approve: true, reason: null },
      originOf(request, currentUser),
    );
  }

  @Post('discounts/:id/reject')
  @HttpCode(200)
  rejectDiscount(
    @Param('id', uuidParameter('Mã miễn giảm không hợp lệ')) discountId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.discounts.decideDiscount(
      currentUser,
      discountId,
      { approve: false, reason: readReason(body) },
      originOf(request, currentUser),
    );
  }

  @Post('invoice-adjustments')
  @HttpCode(201)
  createAdjustment(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const invoiceId = readRequiredUuid(body, 'invoice_id', errors, 'Bắt buộc chọn hóa đơn');
    const amount = body?.amount;
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > MAXIMUM_AMOUNT) {
      errors.push({ field: 'amount', message: 'Số tiền điều chỉnh là số nguyên đồng khác 0, âm là giảm' });
    }
    const reason = readLimited(body, 'reason', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.discounts.createAdjustment(
      currentUser,
      { invoiceId, amount: amount as number, reason },
      originOf(request, currentUser),
    );
  }

  @Post('invoice-adjustments/:id/approve')
  @HttpCode(200)
  approveAdjustment(
    @Param('id', uuidParameter('Mã phiếu điều chỉnh không hợp lệ')) adjustmentId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.discounts.decideAdjustment(
      currentUser,
      adjustmentId,
      { approve: true, reason: null },
      originOf(request, currentUser),
    );
  }

  @Post('invoice-adjustments/:id/reject')
  @HttpCode(200)
  rejectAdjustment(
    @Param('id', uuidParameter('Mã phiếu điều chỉnh không hợp lệ')) adjustmentId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.discounts.decideAdjustment(
      currentUser,
      adjustmentId,
      { approve: false, reason: readReason(body) },
      originOf(request, currentUser),
    );
  }

  @Get('fee-approvals/pending')
  pending(@Query('org_unit_id') orgUnitId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (orgUnitId !== undefined && !isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã đơn vị không hợp lệ' }]);
    }
    return this.discounts.pending(currentUser, orgUnitId ?? null);
  }
}
