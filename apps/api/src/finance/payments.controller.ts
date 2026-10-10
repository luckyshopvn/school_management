import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { PaymentType } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
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
import { PaymentReversalsService } from './payment-reversals.service.js';
import { PaymentsService, type PaymentInput } from './payments.service.js';

// Phiếu chi và duyệt theo hạn mức (P06-04; YCTD-55). Quyền kiểm tra ở tầng nghiệp vụ theo phạm vi đơn vị
const PAYMENT_TYPES: readonly PaymentType[] = ['regular', 'refund', 'payroll'];
const STATUSES = ['draft', 'pending', 'issued', 'pending_reversal', 'reversed'] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAXIMUM_TEXT = 500;

function readPayment(body: RequestBody, errors: FieldError[]): PaymentInput {
  const paymentType = readEnum(body, 'payment_type', PAYMENT_TYPES, errors, true) ?? 'regular';
  const childId = readOptionalUuid(body, 'child_id', errors) ?? null;
  if (paymentType === 'refund' && !childId) {
    errors.push({ field: 'child_id', message: 'Phiếu chi hoàn tiền phải chọn trẻ' });
  }
  const content = readRequiredText(body, 'content', errors);
  if (content.length > MAXIMUM_TEXT) {
    errors.push({ field: 'content', message: `Tối đa ${MAXIMUM_TEXT} ký tự` });
  }
  const fileIds = body?.file_ids ?? [];
  if (!Array.isArray(fileIds) || fileIds.some((fileId) => !isUuid(fileId))) {
    errors.push({ field: 'file_ids', message: 'Danh sách chứng từ không hợp lệ' });
  }
  return {
    paymentType,
    childId: paymentType === 'refund' ? childId : null,
    payeeName: readRequiredText(body, 'payee_name', errors),
    amount: readAmount(body?.amount, 'amount', errors, 1),
    content,
    accountId: readRequiredUuid(body, 'account_id', errors, 'Bắt buộc chọn nguồn chi'),
    categoryId: readRequiredUuid(body, 'category_id', errors, 'Bắt buộc chọn khoản mục chi'),
    fileIds: Array.isArray(fileIds) ? (fileIds as string[]) : [],
  };
}

@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly reversals: PaymentReversalsService,
  ) {}

  @Post('payments')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const requestKey = readRequiredUuid(body, 'request_key', errors, 'Thiếu mã yêu cầu');
    const input = readPayment(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.payments.create(currentUser, { ...input, orgUnitId, requestKey }, originOf(request, currentUser));
  }

  @Get('payments')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (query.org_unit_id !== undefined && !isUuid(query.org_unit_id)) {
      errors.push({ field: 'org_unit_id', message: 'Mã đơn vị không hợp lệ' });
    }
    const status = readEnum(query, 'status', STATUSES, errors, false) ?? null;
    for (const field of ['from', 'to']) {
      if (query[field] && !DATE_PATTERN.test(query[field] ?? '')) {
        errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.payments.list(currentUser, {
      orgUnitId: query.org_unit_id ?? null,
      status,
      from: query.from || null,
      to: query.to || null,
    });
  }

  @Get('payments/pending')
  pending(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (query.org_unit_id !== undefined && !isUuid(query.org_unit_id)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã đơn vị không hợp lệ' }]);
    }
    return this.payments.pending(currentUser, query.org_unit_id ?? null);
  }

  @Get('payment-reversals/pending')
  pendingReversals(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (query.org_unit_id !== undefined && !isUuid(query.org_unit_id)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã đơn vị không hợp lệ' }]);
    }
    return this.reversals.pending(currentUser, query.org_unit_id ?? null);
  }

  // Lập phiếu đảo phiếu chi kèm lý do, chờ Ban Giám hiệu duyệt theo hạn mức (QT-05 bước 8, AC-214)
  @Post('payments/:id/reverse')
  @HttpCode(201)
  reverse(
    @Param('id', uuidParameter('Mã phiếu chi không hợp lệ')) paymentId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readRequiredText(body, 'reason', errors);
    if (reason.length > MAXIMUM_TEXT) {
      errors.push({ field: 'reason', message: `Tối đa ${MAXIMUM_TEXT} ký tự` });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.reversals.create(currentUser, paymentId, reason, originOf(request, currentUser));
  }

  @Post('payments/:id/reverse/approve')
  @HttpCode(200)
  approveReversal(
    @Param('id', uuidParameter('Mã phiếu chi không hợp lệ')) paymentId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.reversals.decide(
      currentUser,
      paymentId,
      { approve: true, reason: null },
      originOf(request, currentUser),
    );
  }

  @Post('payments/:id/reverse/reject')
  @HttpCode(200)
  rejectReversal(
    @Param('id', uuidParameter('Mã phiếu chi không hợp lệ')) paymentId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readOptionalText(body, 'reason', errors) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.reversals.decide(currentUser, paymentId, { approve: false, reason }, originOf(request, currentUser));
  }

  @Get('payments/:id')
  read(
    @Param('id', uuidParameter('Mã phiếu chi không hợp lệ')) paymentId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.payments.read(currentUser, paymentId);
  }

  @Patch('payments/:id')
  update(
    @Param('id', uuidParameter('Mã phiếu chi không hợp lệ')) paymentId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readPayment(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.payments.update(currentUser, paymentId, input, originOf(request, currentUser));
  }

  @Delete('payments/:id')
  @HttpCode(204)
  async remove(
    @Param('id', uuidParameter('Mã phiếu chi không hợp lệ')) paymentId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.payments.remove(currentUser, paymentId, originOf(request, currentUser));
  }

  @Post('payments/:id/submit')
  @HttpCode(200)
  submit(
    @Param('id', uuidParameter('Mã phiếu chi không hợp lệ')) paymentId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.payments.submit(currentUser, paymentId, originOf(request, currentUser));
  }

  @Post('payments/:id/approve')
  @HttpCode(200)
  approve(
    @Param('id', uuidParameter('Mã phiếu chi không hợp lệ')) paymentId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.payments.decide(
      currentUser,
      paymentId,
      { approve: true, reason: null },
      originOf(request, currentUser),
    );
  }

  @Post('payments/:id/reject')
  @HttpCode(200)
  reject(
    @Param('id', uuidParameter('Mã phiếu chi không hợp lệ')) paymentId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readOptionalText(body, 'reason', errors) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.payments.decide(currentUser, paymentId, { approve: false, reason }, originOf(request, currentUser));
  }
}
