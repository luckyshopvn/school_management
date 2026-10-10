import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApplicationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import {
  readOptionalText,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readAmount } from '../fees/fee-catalog-fields.js';
import { OnlinePaymentsService } from './online-payments.service.js';

// Thanh toán trực tuyến bằng mã QR (P06-11; YCTD-57). Điểm cuối nhận thông báo của nhà cung cấp thật (BM-62) làm khi chọn
// xong nhà cung cấp; khi phát triển dùng điểm cuối giả lập, chỉ bật với bộ giả lập
const MAXIMUM_TEXT = 500;

@Controller()
export class OnlinePaymentsController {
  constructor(private readonly onlinePayments: OnlinePaymentsService) {}

  @Get('invoices/:id/payment-qr')
  paymentQr(
    @Param('id', uuidParameter('Mã hóa đơn không hợp lệ')) invoiceId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.onlinePayments.paymentQr(currentUser, invoiceId, originOf(request, currentUser));
  }

  @Get('online-payment-settings')
  settings(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.onlinePayments.settings(currentUser);
  }

  @Put('online-payment-settings')
  configure(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const accountId = readRequiredUuid(body, 'account_id', errors, 'Bắt buộc chọn tài khoản ngân hàng');
    const categoryId = readRequiredUuid(body, 'category_id', errors, 'Bắt buộc chọn khoản mục thu');
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.onlinePayments.configure(currentUser, { accountId, categoryId }, originOf(request, currentUser));
  }

  @Get('online-payment-transactions')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.onlinePayments.list(currentUser, { pendingOnly: query.status === 'pending' });
  }

  @Post('online-payment-transactions/:id/resolve')
  @HttpCode(200)
  resolve(
    @Param('id', uuidParameter('Mã giao dịch không hợp lệ')) transactionId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const note = readRequiredText(body, 'note', errors);
    if (note.length > MAXIMUM_TEXT) {
      errors.push({ field: 'note', message: `Tối đa ${MAXIMUM_TEXT} ký tự` });
    }
    const receiptId = readOptionalUuid(body, 'receipt_id', errors) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.onlinePayments.resolve(currentUser, transactionId, { note, receiptId }, originOf(request, currentUser));
  }

  // Giả lập thông báo tiền vào; chỉ có khi dùng bộ giả lập nhà cung cấp, người gọi phải có quyền lập phiếu thu
  @Post('payment-webhooks/development')
  @HttpCode(200)
  simulate(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    if (this.onlinePayments.provider !== 'development') {
      throw new NotFoundException();
    }
    if (!currentUser.hasPermission(PERMISSION_CODES.receiptManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền giả lập giao dịch');
    }
    const errors: FieldError[] = [];
    const input = {
      providerTransactionRef: readRequiredText(body, 'provider_transaction_ref', errors),
      virtualAccountNumber: readOptionalText(body, 'virtual_account_number', errors) ?? null,
      amount: readAmount(body?.amount, 'amount', errors, 1),
      transferContent: readOptionalText(body, 'transfer_content', errors) ?? '',
      receivedAt: new Date(),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.onlinePayments.receive(input);
  }
}
