import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Patch, Post, Put, Req } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  conflictOnDuplicate,
  notFoundError,
  readOptionalText,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  readStatus,
  type RecordStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { check, DOCUMENT_TYPES, LedgerAccess } from './ledger-common.js';

// Hệ thống tài khoản và quy tắc ghi sổ (G3-06, N5; RR-05; YCTD-88). Dùng chung toàn trường: ai được xem sổ thì xem; người
// quản lý sổ gán ở Trường chính (kế toán trưởng, kế toán) thêm tài khoản chi tiết dưới một tài khoản có sẵn (số hiệu bắt
// đầu bằng số hiệu tài khoản cha), đổi tên hoặc ngừng dùng tài khoản chi tiết, sửa quy tắc ghi sổ. Tài khoản khởi tạo theo
// chế độ kế toán không đổi tên, không ngừng dùng. Quy tắc mới áp dụng cho chứng từ ghi sổ sau đó, bút toán đã ghi không đổi
const CODE_PATTERN = /^[0-9]{3,12}$/;

@Injectable()
export class LedgerAccountsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: LedgerAccess,
    private readonly clock: Clock,
  ) {}

  private async rootUnit(database: Kysely<SchoolYearDatabase>): Promise<string | null> {
    const root = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    return root?.id ?? null;
  }

  async listAccounts(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.viewUnits(currentUser, database, null);
    const rows = await database.selectFrom('ledger_accounts').selectAll().orderBy('code').execute();
    const parents = new Set(rows.map((row) => row.parent_id).filter((id): id is string => id !== null));
    return {
      can_manage: await this.access.canManageSchoolWide(currentUser),
      accounts: rows.map((row) => ({ ...row, has_children: parents.has(row.id) })),
    };
  }

  async createAccount(
    currentUser: CurrentUser,
    input: { parentId: string; code: string; name: string },
    origin: ChangeOrigin,
  ) {
    await this.access.assertManageSchoolWide(currentUser, 'Chỉ người quản lý sổ ở Trường chính thêm tài khoản');
    const { database } = await this.currentSchoolYear.require();
    const parent = await database
      .selectFrom('ledger_accounts')
      .selectAll()
      .where('id', '=', input.parentId)
      .executeTakeFirst();
    if (!parent) {
      throw notFoundError('Không tìm thấy tài khoản cha', 'ledger_account');
    }
    if (!input.code.startsWith(parent.code) || input.code.length <= parent.code.length) {
      throw ruleViolationError('P06-12', `Số hiệu tài khoản chi tiết phải bắt đầu bằng ${parent.code} và dài hơn`, [
        { field: 'code', message: `Bắt đầu bằng ${parent.code}` },
      ]);
    }
    if (parent.status !== 'active') {
      throw ruleViolationError('P06-12', 'Tài khoản cha đã ngừng dùng');
    }
    const id = await database.transaction().execute(async (transaction) => {
      const row = await conflictOnDuplicate(
        transaction
          .insertInto('ledger_accounts')
          .values({
            code: input.code,
            name: input.name,
            parent_id: parent.id,
            normal_balance: parent.normal_balance,
            created_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow(),
        'Số hiệu tài khoản đã có',
        'code',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: await this.rootUnit(database),
        entityName: 'ledger_accounts',
        entityId: row.id,
        action: 'create',
        before: null,
        after: { code: input.code, name: input.name, parent_code: parent.code },
      });
      return row.id;
    });
    return database.selectFrom('ledger_accounts').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
  }

  async updateAccount(
    currentUser: CurrentUser,
    accountId: string,
    input: { name?: string | null; status?: RecordStatus },
    origin: ChangeOrigin,
  ) {
    await this.access.assertManageSchoolWide(currentUser, 'Chỉ người quản lý sổ ở Trường chính sửa tài khoản');
    const { database } = await this.currentSchoolYear.require();
    const account = await database
      .selectFrom('ledger_accounts')
      .selectAll()
      .where('id', '=', accountId)
      .executeTakeFirst();
    if (!account) {
      throw notFoundError('Không tìm thấy tài khoản', 'ledger_account');
    }
    if (account.is_system) {
      throw ruleViolationError('P06-12', 'Tài khoản theo chế độ kế toán không sửa được, hãy thêm tài khoản chi tiết');
    }
    if (input.status === 'inactive' && account.status === 'active') {
      const child = await database
        .selectFrom('ledger_accounts')
        .select('code')
        .where('parent_id', '=', accountId)
        .where('status', '=', 'active')
        .executeTakeFirst();
      if (child) {
        throw ruleViolationError('P06-12', `Còn tài khoản chi tiết ${child.code} đang dùng`);
      }
      const rule = await database
        .selectFrom('ledger_posting_rules')
        .select('document_type')
        .where((expression) =>
          expression.or([
            expression('debit_account_id', '=', accountId),
            expression('credit_account_id', '=', accountId),
          ]),
        )
        .executeTakeFirst();
      if (rule) {
        throw ruleViolationError('P06-12', `Tài khoản đang dùng trong quy tắc ghi sổ ${rule.document_type}`);
      }
    }
    const values = {
      ...(input.name ? { name: input.name } : {}),
      ...(input.status ? { status: input.status } : {}),
      updated_at: this.clock.now(),
    };
    await database.transaction().execute(async (transaction) => {
      await transaction.updateTable('ledger_accounts').set(values).where('id', '=', accountId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: await this.rootUnit(database),
        entityName: 'ledger_accounts',
        entityId: accountId,
        action: 'update',
        before: { name: account.name, status: account.status },
        after: { name: values.name ?? account.name, status: values.status ?? account.status },
      });
    });
    return database.selectFrom('ledger_accounts').selectAll().where('id', '=', accountId).executeTakeFirstOrThrow();
  }

  async listRules(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.viewUnits(currentUser, database, null);
    const rows = await database
      .selectFrom('ledger_posting_rules')
      .leftJoin('cashflow_categories', 'cashflow_categories.id', 'ledger_posting_rules.category_id')
      .leftJoin('ledger_accounts as debit_accounts', 'debit_accounts.id', 'ledger_posting_rules.debit_account_id')
      .leftJoin('ledger_accounts as credit_accounts', 'credit_accounts.id', 'ledger_posting_rules.credit_account_id')
      .select([
        'ledger_posting_rules.id',
        'ledger_posting_rules.document_type',
        'ledger_posting_rules.category_id',
        'cashflow_categories.name as category_name',
        'ledger_posting_rules.debit_account_id',
        'debit_accounts.code as debit_account_code',
        'ledger_posting_rules.credit_account_id',
        'credit_accounts.code as credit_account_code',
        'ledger_posting_rules.updated_at',
      ])
      .execute();
    const order = Object.keys(DOCUMENT_TYPES);
    return {
      can_manage: await this.access.canManageSchoolWide(currentUser),
      document_types: Object.entries(DOCUMENT_TYPES).map(([code, info]) => ({
        code,
        label: info.label,
        money_side: info.moneySide,
        by_category: info.byCategory,
      })),
      rules: rows
        .map((row) => ({ ...row, label: DOCUMENT_TYPES[row.document_type]?.label ?? row.document_type }))
        .sort(
          (left, right) =>
            order.indexOf(left.document_type) - order.indexOf(right.document_type) ||
            (left.category_name ?? '').localeCompare(right.category_name ?? ''),
        ),
    };
  }

  // Lưu quy tắc của một loại chứng từ (và khoản mục nếu có): chưa có thì thêm, có rồi thì thay tài khoản
  async saveRule(
    currentUser: CurrentUser,
    input: {
      documentType: string;
      categoryId: string | null;
      debitAccountId: string | null;
      creditAccountId: string | null;
    },
    origin: ChangeOrigin,
  ) {
    await this.access.assertManageSchoolWide(currentUser, 'Chỉ người quản lý sổ ở Trường chính sửa quy tắc ghi sổ');
    const info = DOCUMENT_TYPES[input.documentType];
    const errors: FieldError[] = [];
    if (!info) {
      errors.push({ field: 'document_type', message: 'Loại chứng từ không hợp lệ' });
    } else {
      if (input.categoryId && !info.byCategory) {
        errors.push({ field: 'category_id', message: 'Loại chứng từ này không khai báo theo khoản mục' });
      }
      const needDebit = info.moneySide !== 'debit';
      const needCredit = info.moneySide === null || info.moneySide === 'debit';
      if (needDebit !== (input.debitAccountId !== null)) {
        errors.push({
          field: 'debit_account_id',
          message: needDebit ? 'Bắt buộc chọn tài khoản Nợ' : 'Phía Nợ là tài khoản tiền của quỹ, để trống',
        });
      }
      if (needCredit !== (input.creditAccountId !== null)) {
        errors.push({
          field: 'credit_account_id',
          message: needCredit ? 'Bắt buộc chọn tài khoản Có' : 'Phía Có là tài khoản tiền của quỹ, để trống',
        });
      }
      if (input.debitAccountId && input.debitAccountId === input.creditAccountId) {
        errors.push({ field: 'credit_account_id', message: 'Tài khoản Nợ và Có phải khác nhau' });
      }
    }
    check(errors);
    const { database } = await this.currentSchoolYear.require();
    for (const [field, id] of [
      ['debit_account_id', input.debitAccountId],
      ['credit_account_id', input.creditAccountId],
    ] as const) {
      if (!id) {
        continue;
      }
      const account = await database
        .selectFrom('ledger_accounts')
        .select('status')
        .where('id', '=', id)
        .executeTakeFirst();
      if (!account || account.status !== 'active') {
        throw new ApplicationError('ERR_VALIDATION', 'Tài khoản không có hoặc đã ngừng dùng', [
          { field, message: 'Tài khoản không hợp lệ' },
        ]);
      }
    }
    if (input.categoryId) {
      const category = await database
        .selectFrom('cashflow_categories')
        .select('id')
        .where('id', '=', input.categoryId)
        .executeTakeFirst();
      if (!category) {
        throw notFoundError('Không tìm thấy khoản mục thu chi', 'cashflow_category');
      }
    }
    const id = await database.transaction().execute(async (transaction) => {
      let query = transaction
        .selectFrom('ledger_posting_rules')
        .selectAll()
        .where('document_type', '=', input.documentType);
      query = input.categoryId
        ? query.where('category_id', '=', input.categoryId)
        : query.where('category_id', 'is', null);
      const existing = await query.forUpdate().executeTakeFirst();
      const values = {
        debit_account_id: input.debitAccountId,
        credit_account_id: input.creditAccountId,
        updated_by: origin.actorUserId,
        updated_at: this.clock.now(),
      };
      const row = existing
        ? await transaction
            .updateTable('ledger_posting_rules')
            .set(values)
            .where('id', '=', existing.id)
            .returning('id')
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('ledger_posting_rules')
            .values({ ...values, document_type: input.documentType, category_id: input.categoryId })
            .returning('id')
            .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: await this.rootUnit(database),
        entityName: 'ledger_posting_rules',
        entityId: row.id,
        action: existing ? 'update' : 'create',
        before: existing
          ? { debit_account_id: existing.debit_account_id, credit_account_id: existing.credit_account_id }
          : null,
        after: { document_type: input.documentType, category_id: input.categoryId, ...values },
      });
      return row.id;
    });
    return database.selectFrom('ledger_posting_rules').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
  }

  // Bỏ quy tắc riêng theo khoản mục; quy tắc chung của loại chứng từ không bỏ được
  async deleteRule(currentUser: CurrentUser, ruleId: string, origin: ChangeOrigin) {
    await this.access.assertManageSchoolWide(currentUser, 'Chỉ người quản lý sổ ở Trường chính sửa quy tắc ghi sổ');
    const { database } = await this.currentSchoolYear.require();
    const rule = await database
      .selectFrom('ledger_posting_rules')
      .selectAll()
      .where('id', '=', ruleId)
      .executeTakeFirst();
    if (!rule) {
      throw notFoundError('Không tìm thấy quy tắc ghi sổ', 'ledger_posting_rule');
    }
    if (!rule.category_id) {
      throw ruleViolationError('P06-12', 'Quy tắc chung của loại chứng từ không bỏ được, chỉ sửa tài khoản');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('ledger_posting_rules').where('id', '=', ruleId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: await this.rootUnit(database),
        entityName: 'ledger_posting_rules',
        entityId: ruleId,
        action: 'delete',
        before: rule,
        after: null,
      });
    });
    return { id: ruleId, deleted: true };
  }
}

@Controller('ledger')
export class LedgerAccountsController {
  constructor(private readonly service: LedgerAccountsService) {}

  @Get('accounts')
  listAccounts(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.listAccounts(currentUser);
  }

  @Post('accounts')
  @HttpCode(201)
  createAccount(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const parentId = readRequiredUuid(body, 'parent_id', errors, 'Bắt buộc chọn tài khoản cha');
    const code = readRequiredText(body, 'code', errors);
    const name = readRequiredText(body, 'name', errors);
    if (code && !CODE_PATTERN.test(code)) {
      errors.push({ field: 'code', message: 'Số hiệu tài khoản gồm 3 đến 12 chữ số' });
    }
    check(errors);
    return this.service.createAccount(currentUser, { parentId, code, name }, originOf(request, currentUser));
  }

  @Patch('accounts/:id')
  updateAccount(
    @Param('id', uuidParameter('Mã tài khoản không hợp lệ')) accountId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const name = readOptionalText(body, 'name', errors);
    const status = readStatus(body, errors);
    if (name === null) {
      errors.push({ field: 'name', message: 'Tên tài khoản không để trống' });
    }
    check(errors);
    return this.service.updateAccount(currentUser, accountId, { name, status }, originOf(request, currentUser));
  }

  @Get('posting-rules')
  listRules(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.listRules(currentUser);
  }

  @Put('posting-rules')
  saveRule(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const documentType = readRequiredText(body, 'document_type', errors);
    const categoryId = readOptionalUuid(body, 'category_id', errors) ?? null;
    const debitAccountId = readOptionalUuid(body, 'debit_account_id', errors) ?? null;
    const creditAccountId = readOptionalUuid(body, 'credit_account_id', errors) ?? null;
    check(errors);
    return this.service.saveRule(
      currentUser,
      { documentType, categoryId, debitAccountId, creditAccountId },
      originOf(request, currentUser),
    );
  }

  @Delete('posting-rules/:id')
  deleteRule(
    @Param('id', uuidParameter('Mã quy tắc không hợp lệ')) ruleId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.deleteRule(currentUser, ruleId, originOf(request, currentUser));
  }
}
