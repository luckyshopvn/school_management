import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { BankStatementAmountMode, BankStatementDateFormat, SchoolYearDatabase } from '@school-management/database';
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
import {
  isUuid,
  notFoundError,
  readOptionalText,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { invoiceAmounts } from '../fees/invoice-amounts.js';
import { MAXIMUM_IMPORT_BYTES, MAXIMUM_IMPORT_ROWS } from '../imports/excel.js';
import { InventoryAccess } from '../inventory/inventory-common.js';
import { BankReconciliationService, MAXIMUM_AMOUNT, VIEW_PERMISSIONS } from './bank-reconciliation.js';
import {
  detectFormat,
  normalizeHeader,
  parseAmount,
  parseStatementDate,
  readStatementRows,
} from './bank-statement-file.js';
import { autoMatchLines, compactCode, refreshSuggestions } from './bank-statement-matching.js';
import { assertDateOpen } from './fiscal-period-lock.js';
import { ReceiptsService } from './receipts.service.js';

// Nhập tệp sao kê ngân hàng và đối soát tự động (G3-05; P06-06; BR-31, BR-34; YCTD-89). Mỗi tài khoản ngân hàng có một cấu
// hình cột dùng lại cho các lần nhập. Dòng trùng (cùng tài khoản, ngày, số tiền, số tham chiếu; không có số tham chiếu thì
// so diễn giải) bỏ qua; dòng lỗi báo lại, dòng hợp lệ vẫn ghi để nhập lại tệp đã sửa không ghi trùng. Ghi xong chạy đối
// soát tự động trên các dòng vừa nhập. Dòng tiền vào có mã hóa đơn còn nợ mà chưa có phiếu thu thì chỉ đề xuất; kế toán
// xác nhận mới lập phiếu thu chuyển khoản và khớp ngay
const IMPORT_PERMISSIONS = [PERMISSION_CODES.bankStatementImport];
const DATE_FORMATS: readonly BankStatementDateFormat[] = ['dmy', 'ymd', 'mdy'];
const AMOUNT_MODES: readonly BankStatementAmountMode[] = ['signed', 'split'];
const MAXIMUM_COLUMN_NAME = 100;
const MAXIMUM_DESCRIPTION = 500;
const NO_DESCRIPTION = 'Không có diễn giải';

export interface ProfileInput {
  headerRow: number;
  dateColumn: string;
  dateFormat: BankStatementDateFormat;
  amountMode: BankStatementAmountMode;
  amountColumn: string | null;
  creditColumn: string | null;
  debitColumn: string | null;
  descriptionColumn: string;
  referenceColumn: string | null;
}

interface RowError {
  row: number;
  column: string | null;
  message: string;
}

interface ParsedLine {
  row: number;
  transactionDate: string;
  amount: number;
  description: string;
  reference: string | null;
}

// Khóa nhận dạng dòng trùng
const duplicateKey = (line: { date: string; amount: number; reference: string | null; description: string }) =>
  `${line.date}|${line.amount}|${line.reference ? `R:${compactCode(line.reference)}` : `D:${compactCode(line.description)}`}`;

@Injectable()
export class BankStatementImportsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: InventoryAccess,
    private readonly reconciliation: BankReconciliationService,
    private readonly receipts: ReceiptsService,
    private readonly clock: Clock,
  ) {}

  private profileView(row: Record<string, unknown> | undefined) {
    return row ?? null;
  }

  async readProfile(currentUser: CurrentUser, accountId: string) {
    const { database } = await this.currentSchoolYear.require();
    const account = await this.reconciliation.loadAccount(database, accountId);
    await this.access.assertUnit(
      currentUser,
      [...IMPORT_PERMISSIONS, ...VIEW_PERMISSIONS],
      account.org_unit_id,
      'Bạn không có quyền xem cấu hình sao kê của tài khoản này',
    );
    const profile = await database
      .selectFrom('bank_statement_profiles')
      .selectAll()
      .where('account_id', '=', accountId)
      .executeTakeFirst();
    return { account_id: accountId, profile: this.profileView(profile) };
  }

  async saveProfile(currentUser: CurrentUser, accountId: string, input: ProfileInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const account = await this.reconciliation.loadAccount(database, accountId);
    await this.assertImport(currentUser, account.org_unit_id);
    const values = {
      header_row: input.headerRow,
      date_column: input.dateColumn,
      date_format: input.dateFormat,
      amount_mode: input.amountMode,
      amount_column: input.amountMode === 'signed' ? input.amountColumn : null,
      credit_column: input.amountMode === 'split' ? input.creditColumn : null,
      debit_column: input.amountMode === 'split' ? input.debitColumn : null,
      description_column: input.descriptionColumn,
      reference_column: input.referenceColumn,
      updated_by: origin.actorUserId,
    };
    await database.transaction().execute(async (transaction) => {
      const before = await transaction
        .selectFrom('bank_statement_profiles')
        .selectAll()
        .where('account_id', '=', accountId)
        .executeTakeFirst();
      const saved = await transaction
        .insertInto('bank_statement_profiles')
        .values({ ...values, account_id: accountId, org_unit_id: account.org_unit_id })
        .onConflict((conflict) =>
          conflict.column('account_id').doUpdateSet({ ...values, updated_at: this.clock.now() }),
        )
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: account.org_unit_id,
        entityName: 'bank_statement_profiles',
        entityId: saved.id,
        action: before ? 'update' : 'create',
        before: before ?? null,
        after: saved,
      });
    });
    return this.readProfile(currentUser, accountId);
  }

  async list(currentUser: CurrentUser, accountId: string) {
    const { database } = await this.currentSchoolYear.require();
    const account = await this.reconciliation.loadAccount(database, accountId);
    await this.access.assertUnit(
      currentUser,
      [...IMPORT_PERMISSIONS, ...VIEW_PERMISSIONS],
      account.org_unit_id,
      'Bạn không có quyền xem các lần nhập sao kê của tài khoản này',
    );
    return database
      .selectFrom('bank_statement_imports')
      .selectAll()
      .where('account_id', '=', accountId)
      .orderBy('created_at', 'desc')
      .execute();
  }

  async importFile(
    currentUser: CurrentUser,
    input: { accountId: string; fileName: string; body: Buffer },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const account = await this.reconciliation.loadAccount(database, input.accountId);
    await this.assertImport(currentUser, account.org_unit_id);
    if (account.status !== 'active') {
      throw validationError([{ field: 'account_id', message: 'Tài khoản ngân hàng đã ngừng dùng' }]);
    }
    const profile = await database
      .selectFrom('bank_statement_profiles')
      .selectAll()
      .where('account_id', '=', account.id)
      .executeTakeFirst();
    if (!profile) {
      throw ruleViolationError('P06-06', 'Tài khoản chưa có cấu hình cột của tệp sao kê, lưu cấu hình trước khi nhập');
    }
    const format = detectFormat(input.body);
    const rows = await readStatementRows(input.body, format);
    const header = (rows[profile.header_row - 1] ?? []).map(normalizeHeader);
    const columnOf = (name: string | null) => (name ? header.indexOf(normalizeHeader(name)) : -1);
    const required: Array<[string, string | null]> = [
      ['date_column', profile.date_column],
      ['description_column', profile.description_column],
      ...(profile.amount_mode === 'signed'
        ? ([['amount_column', profile.amount_column]] as Array<[string, string | null]>)
        : ([
            ['credit_column', profile.credit_column],
            ['debit_column', profile.debit_column],
          ] as Array<[string, string | null]>)),
      ...(profile.reference_column
        ? ([['reference_column', profile.reference_column]] as Array<[string, string | null]>)
        : []),
    ];
    const missing = required.filter(([, name]) => columnOf(name) < 0);
    if (missing.length > 0) {
      throw validationError(
        missing.map(([field, name]) => ({
          field,
          message: `Không thấy cột "${name ?? ''}" ở dòng tiêu đề số ${profile.header_row} của tệp`,
        })),
      );
    }
    const dataRows = rows
      .map((values, index) => ({ row: index + 1, values }))
      .slice(profile.header_row)
      .filter((row) => row.values.some((value) => value.trim() !== ''));
    if (dataRows.length === 0) {
      throw validationError([{ field: 'file', message: 'Tệp chưa có dòng giao dịch nào' }]);
    }
    if (dataRows.length > MAXIMUM_IMPORT_ROWS) {
      throw validationError([{ field: 'file', message: `Mỗi tệp tối đa ${MAXIMUM_IMPORT_ROWS} dòng` }]);
    }

    const today = VIETNAM_DATE.format(this.clock.now());
    const errors: RowError[] = [];
    const parsed: ParsedLine[] = [];
    const openDates = new Map<string, string | null>();
    const cell = (values: string[], name: string | null) => {
      const index = columnOf(name);
      return index >= 0 ? (values[index] ?? '').trim() : '';
    };
    for (const { row, values } of dataRows) {
      const dateText = cell(values, profile.date_column);
      const transactionDate = parseStatementDate(dateText, profile.date_format);
      if (!transactionDate) {
        errors.push({
          row,
          column: profile.date_column,
          message: `Ngày "${dateText}" không đúng cách ghi đã cấu hình`,
        });
        continue;
      }
      if (transactionDate > today) {
        errors.push({ row, column: profile.date_column, message: 'Ngày giao dịch sau hôm nay' });
        continue;
      }
      let amount: number | null;
      if (profile.amount_mode === 'signed') {
        amount = parseAmount(cell(values, profile.amount_column));
      } else {
        const credit = parseAmount(cell(values, profile.credit_column));
        const debit = parseAmount(cell(values, profile.debit_column));
        amount = credit === null || debit === null ? null : Math.abs(credit) - Math.abs(debit);
      }
      if (amount === null || amount === 0 || Math.abs(amount) > MAXIMUM_AMOUNT) {
        errors.push({
          row,
          column: profile.amount_mode === 'signed' ? profile.amount_column : profile.credit_column,
          message: amount === 0 ? 'Số tiền bằng 0' : 'Số tiền không đọc được hoặc có phần lẻ dưới một đồng',
        });
        continue;
      }
      if (!openDates.has(transactionDate)) {
        try {
          await assertDateOpen(database, account.org_unit_id, transactionDate, 'nhập dòng sao kê');
          openDates.set(transactionDate, null);
        } catch (error) {
          if (!(error instanceof ApplicationError)) {
            throw error;
          }
          openDates.set(transactionDate, error.message);
        }
      }
      const closed = openDates.get(transactionDate);
      if (closed) {
        errors.push({ row, column: profile.date_column, message: closed });
        continue;
      }
      const description = cell(values, profile.description_column).slice(0, MAXIMUM_DESCRIPTION) || NO_DESCRIPTION;
      const reference = cell(values, profile.reference_column).slice(0, MAXIMUM_COLUMN_NAME) || null;
      parsed.push({ row, transactionDate, amount, description, reference });
    }

    // Dòng trùng với dòng đã có của tài khoản hoặc với dòng phía trên trong cùng tệp thì bỏ qua
    const dates = parsed.map((line) => line.transactionDate).sort();
    const existing =
      parsed.length > 0
        ? await database
            .selectFrom('bank_statement_lines')
            .select(['transaction_date', 'amount', 'description', 'bank_reference'])
            .where('account_id', '=', account.id)
            .where('transaction_date', '>=', dates[0] ?? today)
            .where('transaction_date', '<=', dates[dates.length - 1] ?? today)
            .execute()
        : [];
    const seen = new Set(
      existing.map((line) =>
        duplicateKey({
          date: line.transaction_date,
          amount: Number(line.amount),
          reference: line.bank_reference,
          description: line.description,
        }),
      ),
    );
    const accepted: ParsedLine[] = [];
    const duplicates: Array<{ row: number; transaction_date: string; amount: number; reference: string | null }> = [];
    for (const line of parsed) {
      const key = duplicateKey({
        date: line.transactionDate,
        amount: line.amount,
        reference: line.reference,
        description: line.description,
      });
      if (seen.has(key)) {
        duplicates.push({
          row: line.row,
          transaction_date: line.transactionDate,
          amount: line.amount,
          reference: line.reference,
        });
        continue;
      }
      seen.add(key);
      accepted.push(line);
    }

    const created = await database.transaction().execute(async (transaction) => {
      const record = await transaction
        .insertInto('bank_statement_imports')
        .values({
          account_id: account.id,
          org_unit_id: account.org_unit_id,
          file_name: input.fileName,
          file_format: format,
          total_rows: dataRows.length,
          imported_count: accepted.length,
          duplicate_count: duplicates.length,
          error_count: errors.length,
          errors: JSON.stringify(errors),
          duplicates: JSON.stringify(duplicates),
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (accepted.length > 0) {
        await transaction
          .insertInto('bank_statement_lines')
          .values(
            accepted.map((line) => ({
              account_id: account.id,
              org_unit_id: account.org_unit_id,
              transaction_date: line.transactionDate,
              amount: line.amount,
              description: line.description,
              bank_reference: line.reference,
              import_id: record.id,
              created_by: origin.actorUserId,
            })),
          )
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: account.org_unit_id,
        entityName: 'bank_statement_imports',
        entityId: record.id,
        action: 'create',
        before: null,
        after: {
          account_id: account.id,
          file_name: input.fileName,
          total_rows: dataRows.length,
          imported_count: accepted.length,
          duplicate_count: duplicates.length,
          error_count: errors.length,
        },
      });
      return record;
    });

    // Đối soát tự động các dòng vừa nhập rồi đề xuất lập phiếu thu cho dòng tiền vào còn chưa khớp
    const imported = await this.reconciliation.lines(database, account.id, null, null, created.id);
    const autoMatched = await autoMatchLines(
      database,
      account.id,
      imported,
      await this.reconciliation.matchDays(account.org_unit_id),
      origin,
      this.clock.now(),
    );
    const suggested = await refreshSuggestions(
      database,
      imported.map((line) => line.id),
    );
    await database
      .updateTable('bank_statement_imports')
      .set({ auto_matched_count: autoMatched, suggested_count: suggested })
      .where('id', '=', created.id)
      .execute();
    return this.readImport(database, created.id, account.id);
  }

  private async readImport(database: Kysely<SchoolYearDatabase>, importId: string, accountId: string) {
    const record = await database
      .selectFrom('bank_statement_imports')
      .selectAll()
      .where('id', '=', importId)
      .executeTakeFirstOrThrow();
    return { ...record, lines: await this.reconciliation.lines(database, accountId, null, null, importId) };
  }

  // Kế toán xác nhận đề xuất: lập phiếu thu chuyển khoản vào tài khoản của dòng sao kê, phân bổ hết số còn nợ của hóa đơn
  // (phần dư thành số dư có của trẻ), ngày thu là ngày giao dịch; khớp dòng với giao dịch của phiếu vừa lập
  async createReceipt(
    currentUser: CurrentUser,
    lineId: string,
    input: { categoryId: string; invoiceId: string | null; payerName: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const line = await this.reconciliation.loadLine(database, lineId);
    await this.reconciliation.assertManage(currentUser, line.org_unit_id);
    if (line.status === 'matched') {
      throw new ApplicationError('ERR_CONFLICT', 'Dòng này đã khớp');
    }
    if (Number(line.amount) <= 0) {
      throw validationError([{ field: 'id', message: 'Chỉ lập phiếu thu cho dòng tiền vào' }]);
    }
    const invoiceId = input.invoiceId ?? line.suggested_invoice_id;
    if (!invoiceId) {
      throw validationError([{ field: 'invoice_id', message: 'Dòng chưa có hóa đơn đề xuất, chọn hóa đơn' }]);
    }
    const invoice = await database
      .selectFrom('invoices')
      .innerJoin('children', 'children.id', 'invoices.child_id')
      .select([
        'invoices.id',
        'invoices.code',
        'invoices.status',
        'invoices.total_amount',
        'invoices.org_unit_id',
        'children.id as child_id',
        'children.org_unit_id as child_org_unit_id',
        'children.full_name as child_name',
      ])
      .where('invoices.id', '=', invoiceId)
      .executeTakeFirst();
    if (!invoice) {
      throw notFoundError('Không tìm thấy hóa đơn', 'invoice');
    }
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.receiptManage],
      invoice.org_unit_id,
      'Bạn không có quyền lập phiếu thu cho đơn vị của hóa đơn này',
    );
    if (invoice.status !== 'issued') {
      throw ruleViolationError('BR-31', 'Chỉ thu cho hóa đơn đã phát hành');
    }
    const outstanding = (await invoiceAmounts(database, [invoice])).get(invoice.id)?.outstanding_amount ?? 0;
    if (outstanding <= 0) {
      throw ruleViolationError('BR-31', `Hóa đơn ${invoice.code ?? ''} đã thu đủ`);
    }
    if (Number(line.amount) < outstanding) {
      throw ruleViolationError('BR-31', 'Không nhận thanh toán một phần; số tiền của dòng nhỏ hơn số còn phải nộp', [
        { field: 'invoice_id', message: `${invoice.code ?? ''} còn phải nộp ${outstanding}` },
      ]);
    }
    const category = await database
      .selectFrom('cashflow_categories')
      .select(['id', 'flow_type', 'status'])
      .where('id', '=', input.categoryId)
      .executeTakeFirst();
    if (!category || category.status !== 'active' || category.flow_type !== 'income') {
      throw validationError([{ field: 'category_id', message: 'Khoản mục phải là khoản mục thu đang dùng' }]);
    }
    const account = await database
      .selectFrom('cash_accounts')
      .select(['id', 'name', 'status'])
      .where('id', '=', line.account_id)
      .executeTakeFirstOrThrow();
    if (account.status !== 'active') {
      throw validationError([{ field: 'account_id', message: 'Tài khoản ngân hàng đã ngừng dùng' }]);
    }
    const receiptId = await database.transaction().execute(async (transaction) => {
      const locked = await transaction
        .selectFrom('bank_statement_lines')
        .select('status')
        .where('id', '=', lineId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (locked.status !== 'unmatched') {
        throw new ApplicationError('ERR_CONFLICT', 'Dòng này đã khớp');
      }
      const createdReceiptId = await this.receipts.issueInTransaction(
        transaction,
        { id: invoice.child_id, org_unit_id: invoice.child_org_unit_id, full_name: invoice.child_name },
        account,
        category.id,
        {
          requestKey: randomUUID(),
          childId: invoice.child_id,
          payerName: input.payerName ?? 'Chuyển khoản ngân hàng',
          amount: Number(line.amount),
          method: 'transfer',
          accountId: account.id,
          categoryId: category.id,
          receiptDate: line.transaction_date,
          content: `Đối soát sao kê: ${line.description}`.slice(0, MAXIMUM_DESCRIPTION),
          allocations: [{ invoiceId: invoice.id, amount: outstanding }],
        },
        origin,
      );
      const entry = await transaction
        .selectFrom('account_transactions')
        .select('id')
        .where('reference_type', '=', 'receipts')
        .where('reference_id', '=', createdReceiptId)
        .executeTakeFirstOrThrow();
      await transaction
        .updateTable('bank_statement_lines')
        .set({
          status: 'matched',
          matched_transaction_id: entry.id,
          matched_by: origin.actorUserId,
          matched_at: this.clock.now(),
          suggested_invoice_id: null,
        })
        .where('id', '=', lineId)
        .execute();
      // Mã VietQR còn hiệu lực của hóa đơn đã thu đủ thì đóng
      await transaction
        .updateTable('payment_requests')
        .set({ status: 'paid', closed_at: this.clock.now() })
        .where('invoice_id', '=', invoice.id)
        .where('status', '=', 'active')
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: line.org_unit_id,
        entityName: 'bank_statement_lines',
        entityId: lineId,
        action: 'update',
        before: { status: 'unmatched', suggested_invoice_id: line.suggested_invoice_id },
        after: { status: 'matched', matched_transaction_id: entry.id, receipt_id: createdReceiptId },
      });
      return createdReceiptId;
    });
    const receipt = await database
      .selectFrom('receipts')
      .select(['id', 'code', 'amount'])
      .where('id', '=', receiptId)
      .executeTakeFirstOrThrow();
    const view = (
      await this.reconciliation.lines(database, line.account_id, line.transaction_date, line.transaction_date)
    ).find((row) => row.id === lineId);
    return { line: view, receipt: { ...receipt, amount: Number(receipt.amount) } };
  }

  // Kế toán bỏ đề xuất không đúng (ví dụ phụ huynh ghi nhầm mã hóa đơn); lần đối soát sau có thể đề xuất lại
  async dismissSuggestion(currentUser: CurrentUser, lineId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const line = await this.reconciliation.loadLine(database, lineId);
    await this.reconciliation.assertManage(currentUser, line.org_unit_id);
    if (!line.suggested_invoice_id) {
      throw new ApplicationError('ERR_CONFLICT', 'Dòng không có đề xuất lập phiếu thu');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('bank_statement_lines')
        .set({ suggested_invoice_id: null })
        .where('id', '=', lineId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: line.org_unit_id,
        entityName: 'bank_statement_lines',
        entityId: lineId,
        action: 'update',
        before: { suggested_invoice_id: line.suggested_invoice_id },
        after: { suggested_invoice_id: null },
      });
    });
    return { id: lineId, suggested_invoice_id: null };
  }

  private async assertImport(currentUser: CurrentUser, orgUnitId: string) {
    await this.access.assertUnit(
      currentUser,
      IMPORT_PERMISSIONS,
      orgUnitId,
      'Bạn không có quyền nhập sao kê của tài khoản đơn vị này',
    );
  }
}

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

function readColumnName(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | null {
  const value = required ? readRequiredText(body, field, errors) : (readOptionalText(body, field, errors) ?? null);
  if (value && value.length > MAXIMUM_COLUMN_NAME) {
    errors.push({ field, message: `Tối đa ${MAXIMUM_COLUMN_NAME} ký tự` });
  }
  return value || null;
}

export function readProfile(body: RequestBody): ProfileInput {
  const errors: FieldError[] = [];
  const headerRow = body?.header_row ?? 1;
  if (typeof headerRow !== 'number' || !Number.isInteger(headerRow) || headerRow < 1 || headerRow > 50) {
    errors.push({ field: 'header_row', message: 'Dòng tiêu đề là số nguyên từ 1 đến 50' });
  }
  const dateFormat = (body?.date_format ?? 'dmy') as BankStatementDateFormat;
  if (!DATE_FORMATS.includes(dateFormat)) {
    errors.push({ field: 'date_format', message: 'Cách ghi ngày là dmy, ymd hoặc mdy' });
  }
  const amountMode = body?.amount_mode as BankStatementAmountMode;
  if (!AMOUNT_MODES.includes(amountMode)) {
    errors.push({ field: 'amount_mode', message: 'Cách ghi số tiền là signed (một cột có dấu) hoặc split (hai cột)' });
  }
  const input: ProfileInput = {
    headerRow: headerRow as number,
    dateColumn: readColumnName(body, 'date_column', errors, true) ?? '',
    dateFormat,
    amountMode,
    amountColumn: readColumnName(body, 'amount_column', errors, amountMode === 'signed'),
    creditColumn: readColumnName(body, 'credit_column', errors, amountMode === 'split'),
    debitColumn: readColumnName(body, 'debit_column', errors, amountMode === 'split'),
    descriptionColumn: readColumnName(body, 'description_column', errors, true) ?? '',
    referenceColumn: readColumnName(body, 'reference_column', errors, false),
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

@Controller()
export class BankStatementImportsController {
  constructor(private readonly service: BankStatementImportsService) {}

  @Get('bank-statement-profiles/:accountId')
  readProfile(
    @Param('accountId', uuidParameter('Mã tài khoản không hợp lệ')) accountId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.readProfile(currentUser, accountId);
  }

  @Put('bank-statement-profiles/:accountId')
  saveProfile(
    @Param('accountId', uuidParameter('Mã tài khoản không hợp lệ')) accountId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.saveProfile(currentUser, accountId, readProfile(body), originOf(request, currentUser));
  }

  @Get('bank-statement-imports')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(query.account_id)) {
      throw validationError([{ field: 'account_id', message: 'Bắt buộc chọn tài khoản ngân hàng' }]);
    }
    return this.service.list(currentUser, query.account_id ?? '');
  }

  @Post('bank-statement-imports')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  importFile(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const accountId = readRequiredUuid(body, 'account_id', errors, 'Bắt buộc chọn tài khoản ngân hàng');
    if (!file || file.size === 0) {
      errors.push({ field: 'file', message: 'Bắt buộc chọn tệp' });
    }
    if (errors.length > 0 || !file) {
      throw validationError(errors);
    }
    return this.service.importFile(
      currentUser,
      {
        accountId,
        fileName: Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 255),
        body: file.buffer,
      },
      originOf(request, currentUser),
    );
  }

  @Post('bank-transactions/:id/create-receipt')
  @HttpCode(201)
  createReceipt(
    @Param('id', uuidParameter('Mã giao dịch không hợp lệ')) lineId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      categoryId: readRequiredUuid(body, 'category_id', errors, 'Bắt buộc chọn khoản mục thu'),
      invoiceId: readOptionalUuid(body, 'invoice_id', errors) ?? null,
      payerName: readOptionalText(body, 'payer_name', errors) ?? null,
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.createReceipt(currentUser, lineId, input, originOf(request, currentUser));
  }

  @Post('bank-transactions/:id/dismiss-suggestion')
  @HttpCode(200)
  dismissSuggestion(
    @Param('id', uuidParameter('Mã giao dịch không hợp lệ')) lineId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.dismissSuggestion(currentUser, lineId, originOf(request, currentUser));
  }
}
