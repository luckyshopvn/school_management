import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { ReceiptMethod } from '@school-management/database';
import { ruleViolationError, validationError, type FieldError } from '@school-management/server';
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
import { DebtsService } from '../fees/debts.service.js';
import { readAmount, readEnum } from '../fees/fee-catalog-fields.js';
import { ReceiptReversalsService } from './receipt-reversals.service.js';
import { ReceiptsService, type AllocationInput } from './receipts.service.js';

// Phiếu thu, phân bổ và công nợ phải thu (P05-09, P06-01, P06-02; YCTD-53).
// Quyền kiểm tra ở tầng nghiệp vụ theo phạm vi đơn vị của trẻ
const METHODS: readonly ReceiptMethod[] = ['cash', 'transfer', 'other'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAXIMUM_TEXT = 500;

function readDate(value: unknown, field: string, errors: FieldError[]): string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
    return '';
  }
  return value;
}

function readOptionalDate(value: string | undefined, field: string, errors: FieldError[]): string | null {
  return value === undefined || value === '' ? null : readDate(value, field, errors);
}

function readAllocations(body: RequestBody, errors: FieldError[]): AllocationInput[] {
  const value = body?.allocations ?? [];
  if (!Array.isArray(value)) {
    errors.push({ field: 'allocations', message: 'Danh sách hóa đơn phân bổ không hợp lệ' });
    return [];
  }
  return value.map((entry: unknown, index) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    if (!isUuid(row.invoice_id)) {
      errors.push({ field: `allocations.${index}.invoice_id`, message: 'Mã hóa đơn không hợp lệ' });
    }
    return {
      invoiceId: isUuid(row.invoice_id) ? row.invoice_id : '',
      amount: readAmount(row.amount, `allocations.${index}.amount`, errors, 1),
    };
  });
}

@Controller()
export class ReceiptsController {
  constructor(
    private readonly receipts: ReceiptsService,
    private readonly reversals: ReceiptReversalsService,
    private readonly debts: DebtsService,
  ) {}

  // Lập và phát hành phiếu thu ngay, kèm danh sách hóa đơn phân bổ; tiền thừa thành số dư có của trẻ
  @Post('receipts')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const content = readOptionalText(body, 'content', errors) ?? null;
    if (content && content.length > MAXIMUM_TEXT) {
      errors.push({ field: 'content', message: `Tối đa ${MAXIMUM_TEXT} ký tự` });
    }
    const input = {
      requestKey: readRequiredUuid(body, 'request_key', errors, 'Thiếu mã yêu cầu'),
      childId: readRequiredUuid(body, 'child_id', errors, 'Bắt buộc chọn trẻ'),
      payerName: readRequiredText(body, 'payer_name', errors),
      amount: readAmount(body?.amount, 'amount', errors, 1),
      method: readEnum(body, 'method', METHODS, errors, true) ?? 'cash',
      accountId: readRequiredUuid(body, 'account_id', errors, 'Bắt buộc chọn tài khoản nhận'),
      categoryId: readRequiredUuid(body, 'category_id', errors, 'Bắt buộc chọn khoản mục thu'),
      receiptDate: readDate(body?.receipt_date, 'receipt_date', errors),
      content,
      allocations: readAllocations(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.receipts.create(currentUser, input, originOf(request, currentUser));
  }

  @Get('receipts')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    for (const field of ['org_unit_id', 'child_id']) {
      if (query[field] !== undefined && !isUuid(query[field])) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    const from = readOptionalDate(query.from, 'from', errors);
    const to = readOptionalDate(query.to, 'to', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.receipts.list(currentUser, {
      orgUnitId: query.org_unit_id ?? null,
      childId: query.child_id ?? null,
      from,
      to,
    });
  }

  @Get('receipts/:id')
  read(
    @Param('id', uuidParameter('Mã phiếu thu không hợp lệ')) receiptId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.receipts.read(currentUser, receiptId);
  }

  // Phiếu thu đã phát hành không xóa được; sai thì lập phiếu đảo (BR-29, AC-33)
  @Delete('receipts/:id')
  async remove(
    @Param('id', uuidParameter('Mã phiếu thu không hợp lệ')) receiptId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.receipts.read(currentUser, receiptId);
    throw ruleViolationError('BR-29', 'Không xóa được phiếu đã phát hành, lập phiếu đảo để điều chỉnh');
  }

  // Lập phiếu đảo kèm lý do, chờ Ban Giám hiệu duyệt theo hạn mức (P06-03, AC-212)
  @Post('receipts/:id/reverse')
  @HttpCode(201)
  reverse(
    @Param('id', uuidParameter('Mã phiếu thu không hợp lệ')) receiptId: string,
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
    return this.reversals.create(currentUser, receiptId, reason, originOf(request, currentUser));
  }

  @Post('receipts/:id/reverse/approve')
  @HttpCode(200)
  approveReversal(
    @Param('id', uuidParameter('Mã phiếu thu không hợp lệ')) receiptId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.reversals.decide(
      currentUser,
      receiptId,
      { approve: true, reason: null },
      originOf(request, currentUser),
    );
  }

  @Post('receipts/:id/reverse/reject')
  @HttpCode(200)
  rejectReversal(
    @Param('id', uuidParameter('Mã phiếu thu không hợp lệ')) receiptId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readOptionalText(body, 'reason', errors) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.reversals.decide(currentUser, receiptId, { approve: false, reason }, originOf(request, currentUser));
  }

  @Get('receipt-reversals/pending')
  pendingReversals(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (query.org_unit_id !== undefined && !isUuid(query.org_unit_id)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã đơn vị không hợp lệ' }]);
    }
    return this.reversals.pending(currentUser, query.org_unit_id ?? null);
  }

  @Get('children/:id/receipts')
  ofChild(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.receipts.ofChild(currentUser, childId);
  }

  @Post('children/:id/credit-allocations')
  @HttpCode(201)
  allocateCredit(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const allocations = readAllocations(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.receipts.allocateCredit(currentUser, childId, allocations, originOf(request, currentUser));
  }

  @Get('debts')
  debtList(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (!isUuid(query.org_unit_id)) {
      errors.push({ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' });
    }
    if (query.class_id !== undefined && !isUuid(query.class_id)) {
      errors.push({ field: 'class_id', message: 'Mã lớp không hợp lệ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.debts.list(currentUser, {
      orgUnitId: query.org_unit_id ?? '',
      classId: query.class_id ?? null,
      overdueOnly: query.overdue_only === 'true',
    });
  }

  @Get('children/:id/debt')
  childDebt(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.debts.child(currentUser, childId);
  }
}
