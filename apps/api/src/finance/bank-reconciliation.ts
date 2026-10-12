import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { check, InventoryAccess, readDate, readText } from '../inventory/inventory-common.js';
import { assertDateOpen } from './fiscal-period-lock.js';

// Tài khoản ngân hàng và lịch sử giao dịch (P06-06; BR-34; YCTD-82). Kế toán nhập các dòng sao kê của ngân hàng (tiền vào
// dương, tiền ra âm) rồi đối chiếu với giao dịch tài khoản mà hệ thống ghi từ phiếu thu, phiếu chi, phiếu đảo. Dòng sao kê
// không đổi số dư (số dư chỉ đổi qua phiếu, BR-34); khoản có trên sao kê mà chưa có phiếu (phí, lãi ngân hàng) thì lập phiếu
// thu hoặc phiếu chi rồi khớp. Khớp một dòng với một giao dịch cùng tài khoản và cùng số tiền
const VIEW_PERMISSIONS = [PERMISSION_CODES.bankTransactionManage, PERMISSION_CODES.cashAccountManage, 'P06.view'];
const AUTO_MATCH_DAYS = 3;
const MAXIMUM_AMOUNT = 1_000_000_000_000;

const dayDistance = (left: string, right: string) =>
  Math.abs(Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / 86_400_000;

@Injectable()
export class BankReconciliationService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: InventoryAccess,
    private readonly clock: Clock,
  ) {}

  private async loadAccount(database: Kysely<SchoolYearDatabase>, accountId: string) {
    const account = await database
      .selectFrom('cash_accounts')
      .select(['id', 'org_unit_id', 'name', 'account_type', 'bank_name', 'account_number', 'opening_balance', 'status'])
      .where('id', '=', accountId)
      .executeTakeFirst();
    if (!account) {
      throw notFoundError('Không tìm thấy tài khoản', 'cash_account');
    }
    if (account.account_type !== 'bank') {
      throw validationError([{ field: 'account_id', message: 'Chỉ đối chiếu tài khoản ngân hàng' }]);
    }
    return account;
  }

  private async assertManage(currentUser: CurrentUser, orgUnitId: string) {
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.bankTransactionManage],
      orgUnitId,
      'Bạn không có quyền ghi giao dịch ngân hàng của đơn vị này',
    );
  }

  async list(currentUser: CurrentUser, filter: { accountId: string; from: string | null; to: string | null }) {
    const { database } = await this.currentSchoolYear.require();
    const account = await this.loadAccount(database, filter.accountId);
    await this.access.assertUnit(
      currentUser,
      VIEW_PERMISSIONS,
      account.org_unit_id,
      'Bạn không có quyền xem giao dịch ngân hàng của đơn vị này',
    );
    return this.lines(database, account.id, filter.from, filter.to);
  }

  private async lines(database: Kysely<SchoolYearDatabase>, accountId: string, from: string | null, to: string | null) {
    let query = database
      .selectFrom('bank_statement_lines')
      .leftJoin('account_transactions', 'account_transactions.id', 'bank_statement_lines.matched_transaction_id')
      .selectAll('bank_statement_lines')
      .select([
        'account_transactions.description as matched_description',
        'account_transactions.transaction_date as matched_date',
      ])
      .where('bank_statement_lines.account_id', '=', accountId)
      .orderBy('bank_statement_lines.transaction_date')
      .orderBy('bank_statement_lines.created_at');
    if (from) {
      query = query.where('bank_statement_lines.transaction_date', '>=', from);
    }
    if (to) {
      query = query.where('bank_statement_lines.transaction_date', '<=', to);
    }
    return (await query.execute()).map((row) => ({ ...row, amount: Number(row.amount) }));
  }

  async create(
    currentUser: CurrentUser,
    input: {
      accountId: string;
      transactionDate: string;
      amount: number;
      description: string;
      bankReference: string | null;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const account = await this.loadAccount(database, input.accountId);
    await this.assertManage(currentUser, account.org_unit_id);
    if (input.transactionDate > this.today()) {
      throw validationError([{ field: 'transaction_date', message: 'Ngày giao dịch không sau hôm nay' }]);
    }
    await assertDateOpen(database, account.org_unit_id, input.transactionDate, 'ghi giao dịch ngân hàng');
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('bank_statement_lines')
        .values({
          account_id: account.id,
          org_unit_id: account.org_unit_id,
          transaction_date: input.transactionDate,
          amount: input.amount,
          description: input.description,
          bank_reference: input.bankReference,
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: account.org_unit_id,
        entityName: 'bank_statement_lines',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return { ...created, amount: Number(created.amount) };
    });
  }

  private async loadLine(database: Kysely<SchoolYearDatabase>, lineId: string) {
    const line = await database
      .selectFrom('bank_statement_lines')
      .selectAll()
      .where('id', '=', lineId)
      .executeTakeFirst();
    if (!line) {
      throw notFoundError('Không tìm thấy dòng giao dịch ngân hàng', 'bank_statement_line');
    }
    return line;
  }

  // Xóa dòng nhập nhầm; dòng đã khớp phải bỏ khớp trước
  async remove(currentUser: CurrentUser, lineId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const line = await this.loadLine(database, lineId);
    await this.assertManage(currentUser, line.org_unit_id);
    await assertDateOpen(database, line.org_unit_id, line.transaction_date, 'xóa giao dịch ngân hàng');
    if (line.status === 'matched') {
      throw ruleViolationError('BR-34', 'Dòng đã khớp, bỏ khớp trước khi xóa');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('bank_statement_lines').where('id', '=', lineId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: line.org_unit_id,
        entityName: 'bank_statement_lines',
        entityId: lineId,
        action: 'delete',
        before: line,
        after: null,
      });
    });
    return { id: lineId, deleted: true };
  }

  async match(currentUser: CurrentUser, lineId: string, accountTransactionId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const line = await this.loadLine(database, lineId);
    await this.assertManage(currentUser, line.org_unit_id);
    await assertDateOpen(database, line.org_unit_id, line.transaction_date, 'đối chiếu giao dịch ngân hàng');
    if (line.status === 'matched') {
      throw new ApplicationError('ERR_CONFLICT', 'Dòng này đã khớp');
    }
    const entry = await database
      .selectFrom('account_transactions')
      .select(['id', 'account_id', 'amount', 'description'])
      .where('id', '=', accountTransactionId)
      .executeTakeFirst();
    if (!entry) {
      throw notFoundError('Không tìm thấy giao dịch tài khoản', 'account_transaction');
    }
    if (entry.account_id !== line.account_id || Number(entry.amount) !== Number(line.amount)) {
      throw ruleViolationError('BR-34', 'Chỉ khớp với giao dịch cùng tài khoản và cùng số tiền', [
        { field: 'account_transaction_id', message: `Số tiền của dòng sao kê ${Number(line.amount)} đồng` },
      ]);
    }
    await this.applyMatch(database, line, entry.id, origin);
    return (await this.lines(database, line.account_id, line.transaction_date, line.transaction_date)).find(
      (row) => row.id === lineId,
    );
  }

  private async applyMatch(
    database: Kysely<SchoolYearDatabase>,
    line: { id: string; org_unit_id: string },
    transactionId: string,
    origin: ChangeOrigin,
  ) {
    await database.transaction().execute(async (transaction) => {
      try {
        const updated = await transaction
          .updateTable('bank_statement_lines')
          .set({
            status: 'matched',
            matched_transaction_id: transactionId,
            matched_by: origin.actorUserId,
            matched_at: this.clock.now(),
          })
          .where('id', '=', line.id)
          .where('status', '=', 'unmatched')
          .returning('id')
          .executeTakeFirst();
        if (!updated) {
          throw new ApplicationError('ERR_CONFLICT', 'Dòng này đã khớp');
        }
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new ApplicationError('ERR_CONFLICT', 'Giao dịch tài khoản này đã khớp với dòng sao kê khác', [
            { field: 'account_transaction_id', message: 'Đã khớp' },
          ]);
        }
        throw error;
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: line.org_unit_id,
        entityName: 'bank_statement_lines',
        entityId: line.id,
        action: 'update',
        before: { status: 'unmatched' },
        after: { status: 'matched', matched_transaction_id: transactionId },
      });
    });
  }

  async unmatch(currentUser: CurrentUser, lineId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const line = await this.loadLine(database, lineId);
    await this.assertManage(currentUser, line.org_unit_id);
    await assertDateOpen(database, line.org_unit_id, line.transaction_date, 'bỏ khớp giao dịch ngân hàng');
    if (line.status !== 'matched') {
      throw new ApplicationError('ERR_CONFLICT', 'Dòng này chưa khớp');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('bank_statement_lines')
        .set({ status: 'unmatched', matched_transaction_id: null, matched_by: null, matched_at: null })
        .where('id', '=', lineId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: line.org_unit_id,
        entityName: 'bank_statement_lines',
        entityId: lineId,
        action: 'update',
        before: { status: 'matched', matched_transaction_id: line.matched_transaction_id },
        after: { status: 'unmatched' },
      });
    });
    return { id: lineId, status: 'unmatched' };
  }

  // Khớp tự động: dòng chưa khớp với giao dịch chưa khớp cùng số tiền, ngày lệch không quá 3 ngày, chọn ngày gần nhất
  async autoMatch(
    currentUser: CurrentUser,
    filter: { accountId: string; from: string; to: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const account = await this.loadAccount(database, filter.accountId);
    await this.assertManage(currentUser, account.org_unit_id);
    const book = await this.bookEntries(database, account.id, filter.from, filter.to, AUTO_MATCH_DAYS);
    const available = book.filter((entry) => !entry.matched);
    const lines = (await this.lines(database, account.id, filter.from, filter.to)).filter(
      (line) => line.status === 'unmatched',
    );
    let matched = 0;
    for (const line of lines) {
      const candidates = available
        .filter(
          (entry) =>
            entry.amount === line.amount &&
            dayDistance(entry.transaction_date, line.transaction_date) <= AUTO_MATCH_DAYS,
        )
        .sort(
          (left, right) =>
            dayDistance(left.transaction_date, line.transaction_date) -
            dayDistance(right.transaction_date, line.transaction_date),
        );
      const chosen = candidates[0];
      if (!chosen) {
        continue;
      }
      try {
        await assertDateOpen(database, account.org_unit_id, line.transaction_date, 'đối chiếu giao dịch ngân hàng');
        await this.applyMatch(database, line, chosen.id, origin);
        available.splice(available.indexOf(chosen), 1);
        matched += 1;
      } catch (error) {
        if (!(error instanceof ApplicationError)) {
          throw error;
        }
      }
    }
    return { ...(await this.reconcile(currentUser, filter)), auto_matched_count: matched };
  }

  private async bookEntries(
    database: Kysely<SchoolYearDatabase>,
    accountId: string,
    from: string,
    to: string,
    widenDays = 0,
  ) {
    const shift = (date: string, days: number) =>
      new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
    const rows = await database
      .selectFrom('account_transactions')
      .leftJoin('bank_statement_lines', 'bank_statement_lines.matched_transaction_id', 'account_transactions.id')
      .select([
        'account_transactions.id',
        'account_transactions.transaction_date',
        'account_transactions.transaction_type',
        'account_transactions.amount',
        'account_transactions.balance_after',
        'account_transactions.reference_type',
        'account_transactions.reference_id',
        'account_transactions.description',
        'bank_statement_lines.id as statement_line_id',
      ])
      .where('account_transactions.account_id', '=', accountId)
      .where('account_transactions.transaction_date', '>=', shift(from, -widenDays))
      .where('account_transactions.transaction_date', '<=', shift(to, widenDays))
      .orderBy('account_transactions.transaction_date')
      .orderBy('account_transactions.created_at')
      .execute();
    return rows.map((row) => ({
      ...row,
      amount: Number(row.amount),
      balance_after: Number(row.balance_after),
      matched: row.statement_line_id !== null,
    }));
  }

  // Bảng đối chiếu trong khoảng ngày: phát sinh theo sổ hệ thống và theo sao kê, các dòng chưa khớp hai bên, chênh lệch
  async reconcile(currentUser: CurrentUser, filter: { accountId: string; from: string; to: string }) {
    const { database } = await this.currentSchoolYear.require();
    const account = await this.loadAccount(database, filter.accountId);
    await this.access.assertUnit(
      currentUser,
      VIEW_PERMISSIONS,
      account.org_unit_id,
      'Bạn không có quyền xem đối chiếu ngân hàng của đơn vị này',
    );
    const before = await database
      .selectFrom('account_transactions')
      .select((expression) => expression.fn.sum<string | null>('amount').as('total'))
      .where('account_id', '=', account.id)
      .where('transaction_date', '<', filter.from)
      .executeTakeFirst();
    const book = await this.bookEntries(database, account.id, filter.from, filter.to);
    const lines = await this.lines(database, account.id, filter.from, filter.to);
    const bookOpening = Number(account.opening_balance) + Number(before?.total ?? 0);
    const bookMovement = book.reduce((sum, entry) => sum + entry.amount, 0);
    const statementMovement = lines.reduce((sum, line) => sum + line.amount, 0);
    return {
      account: {
        id: account.id,
        name: account.name,
        bank_name: account.bank_name,
        account_number: account.account_number,
        org_unit_id: account.org_unit_id,
      },
      from: filter.from,
      to: filter.to,
      book_opening_balance: bookOpening,
      book_movement: bookMovement,
      book_closing_balance: bookOpening + bookMovement,
      statement_movement: statementMovement,
      difference: bookMovement - statementMovement,
      matched_count: lines.filter((line) => line.status === 'matched').length,
      unmatched_book: book.filter((entry) => !entry.matched),
      unmatched_statement: lines.filter((line) => line.status === 'unmatched'),
      book,
      statement: lines,
    };
  }

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }
}

function readRange(query: Record<string, string | undefined>, required: boolean) {
  const errors: FieldError[] = [];
  if (!isUuid(query.account_id)) {
    errors.push({ field: 'account_id', message: 'Bắt buộc chọn tài khoản ngân hàng' });
  }
  const from = readDate(query, 'from', errors, required);
  const to = readDate(query, 'to', errors, required);
  if (from && to && from > to) {
    errors.push({ field: 'to', message: 'Đến ngày không trước từ ngày' });
  }
  check(errors);
  return { accountId: query.account_id ?? '', from, to };
}

@Controller()
export class BankReconciliationController {
  constructor(private readonly service: BankReconciliationService) {}

  @Get('bank-transactions')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.list(currentUser, readRange(query, false));
  }

  @Post('bank-transactions')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const amount = body?.amount;
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > MAXIMUM_AMOUNT) {
      errors.push({ field: 'amount', message: 'Số nguyên đồng khác 0: tiền vào dương, tiền ra âm' });
    }
    const input = {
      accountId: readRequiredUuid(body, 'account_id', errors, 'Bắt buộc chọn tài khoản ngân hàng'),
      transactionDate: readDate(body, 'transaction_date', errors, true) ?? '',
      amount: amount as number,
      description: readText(body, 'description', errors, true) ?? '',
      bankReference: readText(body, 'bank_reference', errors, false),
    };
    check(errors);
    return this.service.create(currentUser, input, originOf(request, currentUser));
  }

  @Post('bank-transactions/auto-match')
  @HttpCode(200)
  autoMatch(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const range = readRange((body ?? {}) as Record<string, string | undefined>, true);
    return this.service.autoMatch(
      currentUser,
      { accountId: range.accountId, from: range.from ?? '', to: range.to ?? '' },
      originOf(request, currentUser),
    );
  }

  @Delete('bank-transactions/:id')
  remove(
    @Param('id', uuidParameter('Mã giao dịch không hợp lệ')) lineId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.remove(currentUser, lineId, originOf(request, currentUser));
  }

  @Post('bank-transactions/:id/match')
  @HttpCode(200)
  match(
    @Param('id', uuidParameter('Mã giao dịch không hợp lệ')) lineId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const transactionId = readRequiredUuid(body, 'account_transaction_id', errors, 'Chọn giao dịch tài khoản');
    check(errors);
    return this.service.match(currentUser, lineId, transactionId, originOf(request, currentUser));
  }

  @Post('bank-transactions/:id/unmatch')
  @HttpCode(200)
  unmatch(
    @Param('id', uuidParameter('Mã giao dịch không hợp lệ')) lineId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.unmatch(currentUser, lineId, originOf(request, currentUser));
  }

  @Get('bank-reconciliation')
  reconcile(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const range = readRange(query, true);
    return this.service.reconcile(currentUser, {
      accountId: range.accountId,
      from: range.from ?? '',
      to: range.to ?? '',
    });
  }
}
