import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
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
import { RegistrationPeriods } from '../fees/registration-periods.js';
import { assertDateOpen } from '../finance/fiscal-period-lock.js';
import { check, DATE_PATTERN, LedgerAccess, readDateRange } from './ledger-common.js';
import { insertJournalEntry, LedgerPostingService, type PostingLine } from './ledger-posting.js';
import { LedgerReportsService } from './ledger-reports.js';

// Bút toán thủ công và lệnh ghi sổ chứng từ (G3-06, N5; BR-95; YCTD-88). Kế toán, kế toán trưởng (P06.ledger.manage) ghi
// bút toán thủ công của đơn vị trong phạm vi: ngày thuộc năm học đang mở và không sau hôm nay, ít nhất hai dòng, mỗi dòng
// một phía Nợ hoặc Có với số tiền nguyên dương, tổng Nợ bằng tổng Có, tài khoản đang dùng. Ghi là vào sổ ngay, không qua
// phê duyệt (bút toán tự động từ chứng từ đã duyệt chiếm phần lớn; bút toán thủ công chỉ là điều chỉnh của kế toán). Không
// sửa bút toán; sai thì hủy kèm lý do rồi ghi lại. Bút toán tự động, bút toán số dư đầu năm không hủy được (sai thì sửa
// chứng từ gốc bằng phiếu đảo, phiếu điều chỉnh). Kỳ tài chính đã chốt của đơn vị khóa việc ghi và hủy bút toán thủ công có
// ngày thuộc kỳ (BR-95)
const MAX_LINES = 50;

interface ManualLineInput {
  account_id: string;
  debit: number;
  credit: number;
  description: string | null;
}

function readLines(body: RequestBody, errors: FieldError[]): ManualLineInput[] {
  const value = body?.lines;
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_LINES) {
    errors.push({ field: 'lines', message: `Bút toán có từ 2 đến ${MAX_LINES} dòng` });
    return [];
  }
  return value.map((item: unknown, index) => {
    const line = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const accountId = line.account_id;
    const amount = (key: string) => {
      const raw = line[key];
      if (raw === undefined || raw === null || raw === '' || raw === 0) {
        return 0;
      }
      if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0) {
        errors.push({ field: `lines[${index}].${key}`, message: 'Số tiền là số nguyên không âm (đồng)' });
        return 0;
      }
      return raw;
    };
    const debit = amount('debit');
    const credit = amount('credit');
    if (!isUuid(accountId)) {
      errors.push({ field: `lines[${index}].account_id`, message: 'Bắt buộc chọn tài khoản' });
    }
    if (debit > 0 === credit > 0) {
      errors.push({ field: `lines[${index}]`, message: 'Mỗi dòng ghi một phía Nợ hoặc Có, số tiền lớn hơn 0' });
    }
    const description =
      typeof line.description === 'string' && line.description.trim() !== '' ? line.description.trim() : null;
    return { account_id: isUuid(accountId) ? accountId : '', debit, credit, description };
  });
}

@Injectable()
export class LedgerEntriesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: LedgerAccess,
    private readonly posting: LedgerPostingService,
    private readonly periods: RegistrationPeriods,
    private readonly clock: Clock,
  ) {}

  async postDocuments(currentUser: CurrentUser) {
    await this.access.assertManageAny(currentUser);
    return this.posting.postPending();
  }

  async get(currentUser: CurrentUser, entryId: string) {
    const { database } = await this.currentSchoolYear.require();
    const entry = await database.selectFrom('journal_entries').selectAll().where('id', '=', entryId).executeTakeFirst();
    if (!entry) {
      throw notFoundError('Không tìm thấy bút toán', 'journal_entry');
    }
    await this.access.viewUnits(currentUser, database, entry.org_unit_id);
    const lines = await database
      .selectFrom('journal_lines')
      .innerJoin('ledger_accounts', 'ledger_accounts.id', 'journal_lines.account_id')
      .select([
        'journal_lines.line_no',
        'journal_lines.account_id',
        'ledger_accounts.code as account_code',
        'ledger_accounts.name as account_name',
        'journal_lines.debit',
        'journal_lines.credit',
        'journal_lines.description',
      ])
      .where('journal_lines.entry_id', '=', entryId)
      .orderBy('journal_lines.line_no')
      .execute();
    return {
      ...entry,
      total_amount: Number(entry.total_amount),
      lines: lines.map((line) => ({ ...line, debit: Number(line.debit), credit: Number(line.credit) })),
    };
  }

  async create(
    currentUser: CurrentUser,
    input: {
      orgUnitId: string;
      entryDate: string;
      description: string;
      lines: ManualLineInput[];
      requestKey: string | null;
    },
    origin: ChangeOrigin,
  ) {
    await this.access.assertManageUnit(currentUser, input.orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    if (input.requestKey) {
      const existing = await database
        .selectFrom('journal_entries')
        .select('id')
        .where('request_key', '=', input.requestKey)
        .executeTakeFirst();
      if (existing) {
        return this.get(currentUser, existing.id);
      }
    }
    if (input.entryDate > VIETNAM_DATE.format(this.clock.now())) {
      throw validationError([{ field: 'entry_date', message: 'Ngày ghi sổ không sau hôm nay' }]);
    }
    await this.periods.require({
      year: Number(input.entryDate.slice(0, 4)),
      month: Number(input.entryDate.slice(5, 7)),
    });
    const debit = input.lines.reduce((total, line) => total + line.debit, 0);
    const credit = input.lines.reduce((total, line) => total + line.credit, 0);
    if (debit !== credit) {
      throw validationError([{ field: 'lines', message: `Tổng Nợ ${debit} phải bằng tổng Có ${credit}` }]);
    }
    const accountIds = [...new Set(input.lines.map((line) => line.account_id))];
    const accounts = await database
      .selectFrom('ledger_accounts')
      .select(['id', 'status'])
      .where('id', 'in', accountIds)
      .execute();
    const inactive = accountIds.filter((id) => accounts.find((account) => account.id === id)?.status !== 'active');
    if (inactive.length > 0) {
      throw validationError(
        inactive.map((id) => ({ field: 'lines', message: `Tài khoản ${id} không có hoặc đã ngừng dùng` })),
      );
    }
    const unit = await database
      .selectFrom('org_units')
      .select('id')
      .where('id', '=', input.orgUnitId)
      .executeTakeFirst();
    if (!unit) {
      throw notFoundError('Không tìm thấy đơn vị', 'org_unit');
    }
    const id = await database.transaction().execute(async (transaction) => {
      await assertDateOpen(transaction, input.orgUnitId, input.entryDate, 'ghi bút toán có ngày thuộc kỳ');
      const lines: PostingLine[] = input.lines.map((line) => ({
        accountId: line.account_id,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      }));
      const entryId = await insertJournalEntry(transaction, {
        orgUnitId: input.orgUnitId,
        entryDate: input.entryDate,
        description: input.description,
        entryType: 'manual',
        sourceType: null,
        sourceId: null,
        sourceCode: null,
        lines,
        createdBy: origin.actorUserId,
        requestKey: input.requestKey,
      });
      if (!entryId) {
        throw validationError([{ field: 'lines', message: 'Bút toán không có số tiền' }]);
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.orgUnitId,
        entityName: 'journal_entries',
        entityId: entryId,
        action: 'create',
        before: null,
        after: { entry_date: input.entryDate, description: input.description, total_amount: debit, lines: input.lines },
      });
      return entryId;
    });
    return this.get(currentUser, id);
  }

  async void(currentUser: CurrentUser, entryId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const entry = await database.selectFrom('journal_entries').selectAll().where('id', '=', entryId).executeTakeFirst();
    if (!entry) {
      throw notFoundError('Không tìm thấy bút toán', 'journal_entry');
    }
    await this.access.assertManageUnit(currentUser, entry.org_unit_id);
    if (entry.entry_type !== 'manual') {
      throw new ApplicationError(
        'ERR_CONFLICT',
        'Bút toán tự động, bút toán số dư đầu năm không hủy được; sửa chứng từ gốc bằng phiếu đảo hoặc phiếu điều chỉnh',
      );
    }
    await database.transaction().execute(async (transaction) => {
      await assertDateOpen(transaction, entry.org_unit_id, entry.entry_date, 'hủy bút toán có ngày thuộc kỳ');
      const updated = await transaction
        .updateTable('journal_entries')
        .set({ status: 'voided', voided_by: origin.actorUserId, voided_at: this.clock.now(), void_reason: reason })
        .where('id', '=', entryId)
        .where('status', '=', 'posted')
        .returning('id')
        .executeTakeFirst();
      if (!updated) {
        throw new ApplicationError('ERR_CONFLICT', 'Bút toán đã hủy');
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: entry.org_unit_id,
        entityName: 'journal_entries',
        entityId: entryId,
        action: 'update',
        before: { status: 'posted' },
        after: { status: 'voided', void_reason: reason },
      });
    });
    return this.get(currentUser, entryId);
  }
}

function readFilter(query: Record<string, string | undefined>) {
  const errors: FieldError[] = [];
  const orgUnitId = query.org_unit_id ? query.org_unit_id : null;
  if (orgUnitId && !isUuid(orgUnitId)) {
    errors.push({ field: 'org_unit_id', message: 'Mã đơn vị không hợp lệ' });
  }
  const range = readDateRange(query, errors);
  return { errors, filter: { orgUnitId, ...range } };
}

@Controller('ledger')
export class LedgerEntriesController {
  constructor(
    private readonly service: LedgerEntriesService,
    private readonly reports: LedgerReportsService,
  ) {}

  @Post('post-documents')
  @HttpCode(200)
  postDocuments(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.postDocuments(currentUser);
  }

  @Get('entries')
  journal(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const { errors, filter } = readFilter(query);
    check(errors);
    return this.reports.journal(currentUser, filter);
  }

  @Get('entries/:id')
  get(
    @Param('id', uuidParameter('Mã bút toán không hợp lệ')) entryId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.get(currentUser, entryId);
  }

  @Post('entries')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const entryDate = readRequiredText(body, 'entry_date', errors);
    if (entryDate && !DATE_PATTERN.test(entryDate)) {
      errors.push({ field: 'entry_date', message: 'Ngày theo dạng YYYY-MM-DD' });
    }
    const description = readRequiredText(body, 'description', errors);
    const lines = readLines(body, errors);
    const requestKey = readOptionalUuid(body, 'request_key', errors) ?? null;
    check(errors);
    return this.service.create(
      currentUser,
      { orgUnitId, entryDate, description, lines, requestKey },
      originOf(request, currentUser),
    );
  }

  @Post('entries/:id/void')
  @HttpCode(200)
  void(
    @Param('id', uuidParameter('Mã bút toán không hợp lệ')) entryId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readOptionalText(body, 'reason', errors);
    if (!reason) {
      errors.push({ field: 'reason', message: 'Bắt buộc nhập lý do hủy' });
    }
    check(errors);
    return this.service.void(currentUser, entryId, reason ?? '', originOf(request, currentUser));
  }

  @Get('reports/trial-balance')
  trialBalance(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const { errors, filter } = readFilter(query);
    check(errors);
    return this.reports.trialBalance(currentUser, filter);
  }

  @Get('reports/general-ledger')
  generalLedger(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const { errors, filter } = readFilter(query);
    if (!isUuid(query.account_id)) {
      errors.push({ field: 'account_id', message: 'Bắt buộc chọn tài khoản' });
    }
    check(errors);
    return this.reports.generalLedger(currentUser, { ...filter, accountId: query.account_id ?? '' });
  }
}
