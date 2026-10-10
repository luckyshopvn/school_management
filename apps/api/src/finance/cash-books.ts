import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApplicationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Sổ quỹ và sổ tài khoản theo khoảng ngày: số dư đầu kỳ, từng giao dịch kèm số phiếu, số dư cuối kỳ
// (P06-05; BR-34; AC-108, AC-112; YCTD-55)
const VIEW_PERMISSIONS = [
  'P06.view',
  PERMISSION_CODES.receiptManage,
  PERMISSION_CODES.paymentManage,
  PERMISSION_CODES.cashAccountManage,
];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class CashBooksService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
  ) {}

  async read(currentUser: CurrentUser, filter: { accountId: string; from: string; to: string }) {
    const { database } = await this.currentSchoolYear.require();
    const account = await database
      .selectFrom('cash_accounts')
      .select(['id', 'org_unit_id', 'name', 'account_type', 'opening_balance', 'current_balance'])
      .where('id', '=', filter.accountId)
      .executeTakeFirst();
    if (!account) {
      throw notFoundError('Không tìm thấy quỹ hoặc tài khoản', 'cash_account');
    }
    await this.assertCanView(currentUser, account.org_unit_id);
    const before = await database
      .selectFrom('account_transactions')
      .select((expression) => expression.fn.sum<string | null>('amount').as('total'))
      .where('account_id', '=', account.id)
      .where('transaction_date', '<', filter.from)
      .executeTakeFirst();
    const openingBalance = Number(account.opening_balance) + Number(before?.total ?? 0);
    const transactions = await database
      .selectFrom('account_transactions')
      .leftJoin('receipts', (join) =>
        join
          .onRef('receipts.id', '=', 'account_transactions.reference_id')
          .on('account_transactions.reference_type', '=', 'receipts'),
      )
      .leftJoin('payments', (join) =>
        join
          .onRef('payments.id', '=', 'account_transactions.reference_id')
          .on('account_transactions.reference_type', '=', 'payments'),
      )
      .leftJoin('receipt_reversals', (join) =>
        join
          .onRef('receipt_reversals.id', '=', 'account_transactions.reference_id')
          .on('account_transactions.reference_type', '=', 'receipt_reversals'),
      )
      .leftJoin('payment_reversals', (join) =>
        join
          .onRef('payment_reversals.id', '=', 'account_transactions.reference_id')
          .on('account_transactions.reference_type', '=', 'payment_reversals'),
      )
      .select([
        'account_transactions.id',
        'account_transactions.transaction_date',
        'account_transactions.transaction_type',
        'account_transactions.amount',
        'account_transactions.balance_after',
        'account_transactions.reference_type',
        'account_transactions.reference_id',
        'account_transactions.description',
        'receipts.code as receipt_code',
        'payments.code as payment_code',
        'receipt_reversals.code as reversal_code',
        'payment_reversals.code as payment_reversal_code',
      ])
      .where('account_transactions.account_id', '=', account.id)
      .where('account_transactions.transaction_date', '>=', filter.from)
      .where('account_transactions.transaction_date', '<=', filter.to)
      .orderBy('account_transactions.transaction_date')
      .orderBy('account_transactions.created_at')
      .execute();
    const rows = transactions.map(({ receipt_code, payment_code, reversal_code, payment_reversal_code, ...row }) => ({
      ...row,
      document_code: receipt_code ?? payment_code ?? reversal_code ?? payment_reversal_code,
      amount: Number(row.amount),
      balance_after: Number(row.balance_after),
    }));
    const totalIn = rows.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0);
    const totalOut = rows.filter((row) => row.amount < 0).reduce((sum, row) => sum - row.amount, 0);
    return {
      account_id: account.id,
      account_name: account.name,
      account_type: account.account_type,
      from: filter.from,
      to: filter.to,
      opening_balance: openingBalance,
      total_in: totalIn,
      total_out: totalOut,
      closing_balance: openingBalance + totalIn - totalOut,
      transactions: rows,
    };
  }

  private async assertCanView(currentUser: CurrentUser, orgUnitId: string): Promise<void> {
    for (const permission of VIEW_PERMISSIONS) {
      const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
      if (scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId)) {
        return;
      }
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem sổ quỹ của đơn vị này');
  }
}

@Controller('cash-books')
export class CashBooksController {
  constructor(private readonly cashBooks: CashBooksService) {}

  @Get()
  read(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (!isUuid(query.account_id)) {
      errors.push({ field: 'account_id', message: 'Bắt buộc chọn quỹ hoặc tài khoản' });
    }
    for (const field of ['from', 'to']) {
      if (!DATE_PATTERN.test(query[field] ?? '')) {
        errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
      }
    }
    if ((query.from ?? '') > (query.to ?? '')) {
      errors.push({ field: 'to', message: 'Đến ngày phải từ ngày bắt đầu trở đi' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.cashBooks.read(currentUser, {
      accountId: query.account_id ?? '',
      from: query.from ?? '',
      to: query.to ?? '',
    });
  }
}
