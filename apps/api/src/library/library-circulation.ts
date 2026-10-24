import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { sql, type Kysely } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import {
  isUuid,
  notFoundError,
  readInteger,
  readOptionalText,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { addDays, lateFine, LIBRARY_RULE_CODE, normalizeScannedCode, overdueDays } from './library-calc.js';
import { LibraryCore, type LibraryExecutor } from './library-core.js';

// Bạn đọc, mượn trả, đặt trước, phát và thu sách giáo khoa của thư viện (DT-22 phần 22a, YCTD-181; tài liệu 32 mục 13.4).
// - Thẻ bạn đọc: cán bộ (từ `staff`) và học sinh (từ `children`, lớp hiện tại thuộc cấp có học sinh mượn); cấp thẻ khi đồng bộ
//   hoặc khi mượn lần đầu, khóa khi nghỉ, chuyển trường, không xóa lịch sử;
// - mượn: kiểm tra quy định của loại bạn đọc (số bản tối đa, không mượn thêm khi còn bản quá hạn), ấn phẩm cho mượn về, bản
//   tốt, không đang mượn, không đang giữ chỗ cho người khác; trả: tính phạt trễ hạn theo quy định, ghi tình trạng, bản trả về
//   được giữ cho người đặt trước đầu hàng đợi và báo cho họ;
// - sách giáo khoa: bộ sách theo khối phát cho cả lớp (mỗi học sinh một bản mỗi đầu sách trong bộ, hạn là hết năm học), thu
//   cuối năm bằng chức năng trả hàng loạt; thiếu bản thì báo đầu sách thiếu bao nhiêu và phát phần còn đủ
const VIEW = PERMISSION_CODES.schoolLibraryView;
const MANAGE = PERMISSION_CODES.schoolLibraryManage;
const MAXIMUM_PAGE = 200;
const MAXIMUM_BATCH = 200;

type Database = Kysely<SchoolYearDatabase>;

interface ReaderRow {
  id: string;
  reader_kind: 'staff' | 'student';
  staff_id: string | null;
  child_id: string | null;
  card_no: string;
  status: 'active' | 'locked';
  locked_reason: string | null;
  issued_on: string;
  full_name: string;
  person_code: string | null;
  org_unit_id: string;
  person_active: boolean;
  class_id: string | null;
  class_name: string | null;
}

@Injectable()
export class LibraryCirculationService {
  constructor(
    private readonly core: LibraryCore,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  // ------------------------------------------------------------------------------------------------------------------
  // Bạn đọc
  // ------------------------------------------------------------------------------------------------------------------

  private readerQuery(database: LibraryExecutor) {
    return database
      .selectFrom('library_readers')
      .leftJoin('staff', 'staff.id', 'library_readers.staff_id')
      .leftJoin('children', 'children.id', 'library_readers.child_id')
      .leftJoin('class_enrollments', (join) =>
        join
          .onRef('class_enrollments.child_id', '=', 'library_readers.child_id')
          .on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'library_readers.id',
        'library_readers.reader_kind',
        'library_readers.staff_id',
        'library_readers.child_id',
        'library_readers.card_no',
        'library_readers.status',
        'library_readers.locked_reason',
        'library_readers.issued_on',
        sql<string>`coalesce(staff.full_name, children.full_name)`.as('full_name'),
        sql<string | null>`coalesce(staff.code, children.moet_student_code)`.as('person_code'),
        sql<string>`coalesce(staff.org_unit_id, children.org_unit_id)`.as('org_unit_id'),
        sql<boolean>`coalesce(staff.status = 'active', children.status = 'active', false)`.as('person_active'),
        'classes.id as class_id',
        'classes.name as class_name',
      ]);
  }

  async readers(
    currentUser: CurrentUser,
    filter: { kind?: 'staff' | 'student'; query?: string; classId?: string; status?: 'active' | 'locked'; limit: number; offset: number },
  ) {
    const database = await this.core.database();
    const scope = await this.organizationScopes.resolve(currentUser, MANAGE);
    const base = this.readerQuery(database)
      .$if(filter.kind !== undefined, (builder) => builder.where('library_readers.reader_kind', '=', filter.kind ?? 'staff'))
      .$if(filter.status !== undefined, (builder) => builder.where('library_readers.status', '=', filter.status ?? 'active'))
      .$if(filter.classId !== undefined, (builder) => builder.where('classes.id', '=', filter.classId ?? ''))
      .$if(!scope.wholeSchool, (builder) =>
        builder.where(sql<string>`coalesce(staff.org_unit_id, children.org_unit_id)`, 'in', [...scope.orgUnitIds, '']),
      )
      .$if(Boolean(filter.query), (builder) => {
        const pattern = `%${(filter.query ?? '').replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
        return builder.where(
          sql<boolean>`(coalesce(staff.full_name, children.full_name) ilike ${pattern} or library_readers.card_no ilike ${pattern})`,
        );
      });
    const total = await database
      .selectFrom(base.as('readers'))
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .executeTakeFirstOrThrow();
    const rows = await base
      .orderBy(sql`coalesce(staff.full_name, children.full_name)`)
      .orderBy('library_readers.id')
      .limit(filter.limit)
      .offset(filter.offset)
      .execute();
    const loanCounts = await this.loanCounts(database, rows.map((row) => row.id));
    return {
      total: Number(total.total),
      items: rows.map((row) => ({ ...row, ...(loanCounts.get(row.id) ?? { open_loans: 0, overdue_loans: 0 }) })),
    };
  }

  private async loanCounts(database: Database, readerIds: string[]) {
    const result = new Map<string, { open_loans: number; overdue_loans: number }>();
    if (readerIds.length === 0) {
      return result;
    }
    const today = this.core.today();
    const rows = await database
      .selectFrom('library_loans')
      .select([
        'reader_id',
        sql<string>`count(*)`.as('open_loans'),
        sql<string>`count(*) filter (where due_on < ${today}::date)`.as('overdue_loans'),
      ])
      .where('reader_id', 'in', readerIds)
      .where('status', '=', 'open')
      .groupBy('reader_id')
      .execute();
    for (const row of rows) {
      result.set(row.reader_id, { open_loans: Number(row.open_loans), overdue_loans: Number(row.overdue_loans) });
    }
    return result;
  }

  private async findReader(executor: LibraryExecutor, readerId: string): Promise<ReaderRow> {
    const row = await this.readerQuery(executor).where('library_readers.id', '=', readerId).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy bạn đọc', 'library_reader');
    }
    return row as ReaderRow;
  }

  // Tìm bạn đọc theo số thẻ (quét thẻ) hoặc theo tên; chưa có thẻ thì gợi ý người dùng cấp thẻ
  async lookupReader(currentUser: CurrentUser, text: string) {
    const database = await this.core.database();
    const code = normalizeScannedCode(text);
    const scope = await this.organizationScopes.resolve(currentUser, MANAGE);
    const rows = await this.readerQuery(database)
      .where((eb) =>
        eb.or([
          eb('library_readers.card_no', '=', code),
          sql<boolean>`coalesce(staff.full_name, children.full_name) ilike ${`%${text.trim().replace(/[\\%_]/g, (match) => `\\${match}`)}%`}`,
        ]),
      )
      .$if(!scope.wholeSchool, (builder) =>
        builder.where(sql<string>`coalesce(staff.org_unit_id, children.org_unit_id)`, 'in', [...scope.orgUnitIds, '']),
      )
      .limit(20)
      .execute();
    const loanCounts = await this.loanCounts(database, rows.map((row) => row.id));
    return rows.map((row) => ({ ...row, ...(loanCounts.get(row.id) ?? { open_loans: 0, overdue_loans: 0 }) }));
  }

  // Cấp thẻ cho một người (cán bộ hoặc học sinh); đã có thẻ thì trả thẻ đó
  async ensureReader(
    executor: LibraryExecutor,
    person: { staffId?: string; childId?: string },
    currentUser: CurrentUser | null,
    origin: ChangeOrigin | null,
  ) {
    const existing = await executor
      .selectFrom('library_readers')
      .select(['id', 'card_no'])
      .$if(person.staffId !== undefined, (builder) => builder.where('staff_id', '=', person.staffId ?? ''))
      .$if(person.childId !== undefined, (builder) => builder.where('child_id', '=', person.childId ?? ''))
      .executeTakeFirst();
    if (existing) {
      return existing;
    }
    const settings = await this.core.settings(executor);
    if (person.staffId) {
      const staff = await executor
        .selectFrom('staff')
        .select(['id', 'status', 'org_unit_id'])
        .where('id', '=', person.staffId)
        .executeTakeFirst();
      if (!staff) {
        throw notFoundError('Không tìm thấy cán bộ', 'staff');
      }
      if (staff.status !== 'active') {
        throw ruleViolationError(LIBRARY_RULE_CODE, 'Cán bộ đã nghỉ việc, không cấp thẻ');
      }
      if (currentUser) {
        await this.organizationScopes.assertCanAccess(currentUser, MANAGE, staff.org_unit_id);
      }
    } else if (person.childId) {
      const child = await executor
        .selectFrom('children')
        .leftJoin('class_enrollments', (join) =>
          join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
        )
        .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
        .select(['children.id', 'children.status', 'children.org_unit_id', 'classes.school_level'])
        .where('children.id', '=', person.childId)
        .executeTakeFirst();
      if (!child) {
        throw notFoundError('Không tìm thấy học sinh', 'child');
      }
      if (child.status !== 'active') {
        throw ruleViolationError(LIBRARY_RULE_CODE, 'Học sinh không còn đang học, không cấp thẻ');
      }
      if (!child.school_level || !settings.student_levels.includes(child.school_level)) {
        throw ruleViolationError(LIBRARY_RULE_CODE, 'Học sinh chưa xếp lớp hoặc lớp thuộc cấp chưa bật mượn sách ở thiết lập thư viện');
      }
      if (currentUser) {
        await this.organizationScopes.assertCanAccess(currentUser, MANAGE, child.org_unit_id);
      }
    } else {
      throw validationError([{ field: 'person', message: 'Chọn cán bộ hoặc học sinh' }]);
    }
    const [cardNo] = await this.core.nextCardNumbers(executor, 1);
    const created = await executor
      .insertInto('library_readers')
      .values({
        reader_kind: person.staffId ? 'staff' : 'student',
        staff_id: person.staffId ?? null,
        child_id: person.childId ?? null,
        card_no: cardNo ?? '',
        issued_on: this.core.today(),
      })
      .returning(['id', 'card_no'])
      .executeTakeFirstOrThrow();
    if (origin) {
      await writeAuditLog(executor as never, {
        origin,
        orgUnitId: null,
        entityName: 'library_readers',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { card_no: created.card_no, ...person },
      });
    }
    return created;
  }

  async issueReader(currentUser: CurrentUser, person: { staffId?: string; childId?: string }, origin: ChangeOrigin) {
    const database = await this.core.database();
    const created = await database.transaction().execute((transaction) => this.ensureReader(transaction, person, currentUser, origin));
    return this.findReader(database, created.id);
  }

  // Cấp thẻ cho mọi cán bộ, học sinh đủ điều kiện chưa có thẻ; khóa thẻ của người đã nghỉ, đã chuyển trường
  async syncReaders(currentUser: CurrentUser, origin: ChangeOrigin) {
    const database = await this.core.database();
    const settings = await this.core.settings(database);
    const scope = await this.organizationScopes.resolve(currentUser, MANAGE);
    return database.transaction().execute(async (transaction) => {
      const staff = await transaction
        .selectFrom('staff')
        .select('staff.id')
        .where('staff.status', '=', 'active')
        .where((eb) => eb.not(eb.exists(eb.selectFrom('library_readers').select('id').whereRef('library_readers.staff_id', '=', 'staff.id'))))
        .$if(!scope.wholeSchool, (builder) => builder.where('staff.org_unit_id', 'in', [...scope.orgUnitIds, '']))
        .execute();
      const students =
        settings.student_levels.length === 0
          ? []
          : await transaction
              .selectFrom('children')
              .innerJoin('class_enrollments', (join) =>
                join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
              )
              .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
              .select('children.id')
              .where('children.status', '=', 'active')
              .where('classes.school_level', 'in', settings.student_levels)
              .where((eb) =>
                eb.not(eb.exists(eb.selectFrom('library_readers').select('id').whereRef('library_readers.child_id', '=', 'children.id'))),
              )
              .$if(!scope.wholeSchool, (builder) => builder.where('children.org_unit_id', 'in', [...scope.orgUnitIds, '']))
              .execute();
      const total = staff.length + students.length;
      if (total > 0) {
        const numbers = await this.core.nextCardNumbers(transaction, total);
        const today = this.core.today();
        const values = [
          ...staff.map((row) => ({ reader_kind: 'staff' as const, staff_id: row.id, child_id: null })),
          ...students.map((row) => ({ reader_kind: 'student' as const, staff_id: null, child_id: row.id })),
        ].map((row, index) => ({ ...row, card_no: numbers[index] ?? '', issued_on: today }));
        for (let start = 0; start < values.length; start += 500) {
          await transaction.insertInto('library_readers').values(values.slice(start, start + 500)).execute();
        }
      }
      const locked = await transaction
        .updateTable('library_readers')
        .set({ status: 'locked', locked_reason: 'Đã nghỉ, chuyển trường hoặc không còn trong cấp có học sinh mượn', updated_at: this.clock.now() })
        .where('status', '=', 'active')
        .where((eb) =>
          eb.or([
            eb('staff_id', 'in', eb.selectFrom('staff').select('id').where('status', '!=', 'active')),
            eb('child_id', 'in', eb.selectFrom('children').select('id').where('status', '!=', 'active')),
          ]),
        )
        .returning('id')
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_readers',
        entityId: '00000000-0000-0000-0000-000000000001',
        action: 'update',
        before: null,
        after: { issued: total, locked: locked.length },
      });
      return { issued_staff: staff.length, issued_students: students.length, locked: locked.length };
    });
  }

  async setReaderStatus(readerId: string, status: 'active' | 'locked', reason: string | null, origin: ChangeOrigin) {
    const database = await this.core.database();
    const reader = await this.findReader(database, readerId);
    if (status === 'active' && !reader.person_active) {
      throw ruleViolationError(LIBRARY_RULE_CODE, 'Người này đã nghỉ, không mở khóa thẻ được');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('library_readers')
        .set({ status, locked_reason: status === 'locked' ? reason : null, updated_at: this.clock.now() })
        .where('id', '=', readerId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: reader.org_unit_id,
        entityName: 'library_readers',
        entityId: readerId,
        action: 'update',
        before: { status: reader.status },
        after: { status, reason },
      });
    });
    return this.findReader(database, readerId);
  }

  // Dữ liệu in thẻ: tên, số thẻ, lớp (mã QR do bộ dựng PDF của thẻ sinh từ số thẻ)
  async cardData(readerIds: string[]) {
    const database = await this.core.database();
    const rows = await this.readerQuery(database).where('library_readers.id', 'in', readerIds).execute();
    return rows;
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Mượn trả
  // ------------------------------------------------------------------------------------------------------------------

  private async recipientsOf(executor: LibraryExecutor, reader: ReaderRow): Promise<NotificationRecipient[]> {
    if (reader.staff_id) {
      const staff = await executor.selectFrom('staff').select('user_id').where('id', '=', reader.staff_id).executeTakeFirst();
      return staff?.user_id ? [{ userId: staff.user_id, channel: 'in_app' }] : [];
    }
    if (!reader.child_id) {
      return [];
    }
    const guardians = await executor
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.user_id')
      .where('child_guardians.child_id', '=', reader.child_id)
      .where('guardians.user_id', 'is not', null)
      .execute();
    return guardians.flatMap((guardian) => (guardian.user_id ? [{ userId: guardian.user_id, channel: 'in_app' as const }] : []));
  }

  private async openLoanCount(executor: LibraryExecutor, readerId: string): Promise<number> {
    const row = await executor
      .selectFrom('library_loans')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .where('reader_id', '=', readerId)
      .where('status', '=', 'open')
      .executeTakeFirstOrThrow();
    return Number(row.total);
  }

  async loans(
    currentUser: CurrentUser,
    filter: {
      status?: 'open' | 'overdue' | 'returned' | 'lost';
      readerId?: string;
      classId?: string;
      kind?: 'regular' | 'textbook';
      query?: string;
      limit: number;
      offset: number;
    },
  ) {
    const database = await this.core.database();
    const scope = await this.organizationScopes.resolve(currentUser, MANAGE);
    const today = this.core.today();
    const base = database
      .selectFrom('library_loans')
      .innerJoin('library_copies', 'library_copies.id', 'library_loans.copy_id')
      .innerJoin('library_titles', 'library_titles.id', 'library_copies.title_id')
      .innerJoin('library_readers', 'library_readers.id', 'library_loans.reader_id')
      .leftJoin('staff', 'staff.id', 'library_readers.staff_id')
      .leftJoin('children', 'children.id', 'library_readers.child_id')
      .$if(filter.status === 'open', (builder) => builder.where('library_loans.status', '=', 'open'))
      .$if(filter.status === 'overdue', (builder) =>
        builder.where('library_loans.status', '=', 'open').where('library_loans.due_on', '<', today),
      )
      .$if(filter.status === 'returned' || filter.status === 'lost', (builder) =>
        builder.where('library_loans.status', '=', filter.status === 'lost' ? 'lost' : 'returned'),
      )
      .$if(filter.readerId !== undefined, (builder) => builder.where('library_loans.reader_id', '=', filter.readerId ?? ''))
      .$if(filter.classId !== undefined, (builder) => builder.where('library_loans.class_id', '=', filter.classId ?? ''))
      .$if(filter.kind !== undefined, (builder) => builder.where('library_loans.kind', '=', filter.kind ?? 'regular'))
      .$if(!scope.wholeSchool, (builder) =>
        builder.where(sql<string>`coalesce(staff.org_unit_id, children.org_unit_id)`, 'in', [...scope.orgUnitIds, '']),
      )
      .$if(Boolean(filter.query), (builder) => {
        const pattern = `%${(filter.query ?? '').replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
        return builder.where(
          sql<boolean>`(library_titles.title ilike ${pattern} or library_copies.copy_no ilike ${pattern}
            or coalesce(staff.full_name, children.full_name) ilike ${pattern} or library_readers.card_no ilike ${pattern})`,
        );
      });
    const total = await base.select((eb) => eb.fn.countAll<string>().as('total')).executeTakeFirstOrThrow();
    const rows = await base
      .select([
        'library_loans.id',
        'library_loans.copy_id',
        'library_copies.copy_no',
        'library_titles.title',
        'library_loans.reader_id',
        'library_readers.card_no',
        'library_readers.reader_kind',
        sql<string>`coalesce(staff.full_name, children.full_name)`.as('reader_name'),
        'library_loans.class_id',
        'library_loans.kind',
        'library_loans.loaned_on',
        'library_loans.due_on',
        'library_loans.returned_on',
        'library_loans.renewals',
        'library_loans.status',
        'library_loans.return_condition',
        'library_loans.fine_amount',
        'library_loans.note',
      ])
      .orderBy('library_loans.status')
      .orderBy('library_loans.due_on')
      .orderBy('library_loans.id')
      .limit(filter.limit)
      .offset(filter.offset)
      .execute();
    return {
      total: Number(total.total),
      items: rows.map((row) => ({
        ...row,
        overdue_days: row.status === 'open' ? overdueDays(row.due_on, today) : 0,
      })),
    };
  }

  // Mượn nhiều bản cho một bạn đọc (cũng dùng cho giáo viên mượn bộ sách cho lớp). Tất cả cùng thành công hoặc không bản nào
  async lend(
    currentUser: CurrentUser,
    input: { readerId: string; copyCodes: string[]; classId: string | null; note: string | null },
    origin: ChangeOrigin,
  ) {
    const database = await this.core.database();
    return database.transaction().execute(async (transaction) => {
      const reader = await this.findReader(transaction, input.readerId);
      await this.organizationScopes.assertCanAccess(currentUser, MANAGE, reader.org_unit_id);
      this.assertReaderCanBorrow(reader);
      const rule = await this.core.rule(transaction, reader.reader_kind);
      const today = this.core.today();
      const overdue = await transaction
        .selectFrom('library_loans')
        .select('id')
        .where('reader_id', '=', reader.id)
        .where('status', '=', 'open')
        .where('due_on', '<', today)
        .executeTakeFirst();
      if (overdue) {
        throw ruleViolationError(LIBRARY_RULE_CODE, 'Bạn đọc còn sách quá hạn, trả sách rồi mới mượn tiếp');
      }
      const codes = [...new Set(input.copyCodes.map(normalizeScannedCode))];
      const open = await this.openLoanCount(transaction, reader.id);
      if (open + codes.length > rule.max_items) {
        throw ruleViolationError(
          LIBRARY_RULE_CODE,
          `Bạn đọc đang mượn ${open} bản, mượn thêm ${codes.length} sẽ vượt mức ${rule.max_items} bản`,
          [{ field: 'copy_codes', message: `Tối đa ${rule.max_items} bản cùng lúc` }],
        );
      }
      const created: Array<{ id: string; copy_no: string; title: string; due_on: string }> = [];
      for (const code of codes) {
        const copy = await transaction
          .selectFrom('library_copies')
          .innerJoin('library_titles', 'library_titles.id', 'library_copies.title_id')
          .innerJoin('library_categories', 'library_categories.id', 'library_titles.category_id')
          .select([
            'library_copies.id',
            'library_copies.copy_no',
            'library_copies.condition',
            'library_copies.title_id',
            'library_titles.title',
            'library_titles.status as title_status',
            'library_categories.lendable',
          ])
          .where('library_copies.copy_no', '=', code)
          .forUpdate()
          .executeTakeFirst();
        if (!copy) {
          throw notFoundError(`Không tìm thấy bản sao ${code}`, 'library_copy');
        }
        this.assertCopyLendable(copy);
        const hold = await transaction
          .selectFrom('library_reservations')
          .select(['id', 'reader_id'])
          .where('copy_id', '=', copy.id)
          .where('status', '=', 'ready')
          .executeTakeFirst();
        if (hold && hold.reader_id !== reader.id) {
          throw ruleViolationError(LIBRARY_RULE_CODE, `Bản ${copy.copy_no} đang giữ cho người đặt trước`);
        }
        const loan = await this.insertLoan(transaction, {
          copyId: copy.id,
          readerId: reader.id,
          classId: input.classId,
          kind: 'regular',
          dueOn: addDays(today, rule.loan_days),
          note: input.note,
          currentUser,
        });
        created.push({ id: loan.id, copy_no: copy.copy_no, title: copy.title, due_on: loan.due_on });
        await this.fulfilReservation(transaction, reader.id, copy.title_id);
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: reader.org_unit_id,
        entityName: 'library_loans',
        entityId: created[0]?.id ?? reader.id,
        action: 'create',
        before: null,
        after: { reader_id: reader.id, copies: created.map((item) => item.copy_no) },
      });
      return { reader: { id: reader.id, full_name: reader.full_name, card_no: reader.card_no }, loans: created };
    });
  }

  private assertReaderCanBorrow(reader: ReaderRow) {
    if (reader.status !== 'active' || !reader.person_active) {
      throw ruleViolationError(LIBRARY_RULE_CODE, 'Thẻ bạn đọc đã khóa hoặc người này không còn trong trường');
    }
  }

  private assertCopyLendable(copy: { copy_no: string; condition: string; title_status: string; lendable: boolean }) {
    if (copy.condition !== 'good') {
      throw ruleViolationError(LIBRARY_RULE_CODE, `Bản ${copy.copy_no} không ở tình trạng tốt (${copy.condition}), không cho mượn`);
    }
    if (copy.title_status !== 'active') {
      throw ruleViolationError(LIBRARY_RULE_CODE, `Ấn phẩm của bản ${copy.copy_no} đã ngừng dùng`);
    }
    if (!copy.lendable) {
      throw ruleViolationError(LIBRARY_RULE_CODE, `Ấn phẩm của bản ${copy.copy_no} chỉ đọc tại chỗ, không cho mượn về`);
    }
  }

  private async insertLoan(
    transaction: LibraryExecutor,
    input: {
      copyId: string;
      readerId: string;
      classId: string | null;
      kind: 'regular' | 'textbook';
      dueOn: string;
      note: string | null;
      currentUser: CurrentUser;
    },
  ) {
    const open = await transaction
      .selectFrom('library_loans')
      .select('id')
      .where('copy_id', '=', input.copyId)
      .where('status', '=', 'open')
      .executeTakeFirst();
    if (open) {
      throw ruleViolationError(LIBRARY_RULE_CODE, 'Bản này đang có người mượn');
    }
    return transaction
      .insertInto('library_loans')
      .values({
        copy_id: input.copyId,
        reader_id: input.readerId,
        class_id: input.classId,
        kind: input.kind,
        loaned_on: this.core.today(),
        due_on: input.dueOn,
        note: input.note,
        loaned_by: input.currentUser.id,
        loaned_by_name: input.currentUser.description.full_name,
      })
      .returning(['id', 'due_on'])
      .executeTakeFirstOrThrow();
  }

  // Người mượn bản của ấn phẩm mình đã đặt thì đóng lượt đặt
  private async fulfilReservation(transaction: LibraryExecutor, readerId: string, titleId: string) {
    await transaction
      .updateTable('library_reservations')
      .set({ status: 'fulfilled', copy_id: null, closed_at: this.clock.now() })
      .where('reader_id', '=', readerId)
      .where('title_id', '=', titleId)
      .where('status', 'in', ['waiting', 'ready'])
      .execute();
  }

  // Trả một bản: tính phạt trễ hạn, ghi tình trạng, giữ bản cho người đặt trước đầu hàng đợi
  async giveBack(
    currentUser: CurrentUser,
    input: { copyCode?: string; loanId?: string; condition: 'good' | 'damaged' | 'lost' },
    origin: ChangeOrigin,
  ) {
    const database = await this.core.database();
    return database.transaction().execute(async (transaction) => {
      const result = await this.returnOne(transaction, currentUser, input);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: result.orgUnitId,
        entityName: 'library_loans',
        entityId: result.loan.id,
        action: 'update',
        before: null,
        after: { status: result.loan.status, condition: input.condition, fine: result.loan.fine_amount },
      });
      return result.loan;
    });
  }

  private async returnOne(
    transaction: LibraryExecutor,
    currentUser: CurrentUser,
    input: { copyCode?: string; loanId?: string; condition: 'good' | 'damaged' | 'lost' },
  ) {
    const query = transaction
      .selectFrom('library_loans')
      .innerJoin('library_copies', 'library_copies.id', 'library_loans.copy_id')
      .select([
        'library_loans.id',
        'library_loans.copy_id',
        'library_loans.reader_id',
        'library_loans.due_on',
        'library_copies.copy_no',
        'library_copies.title_id',
      ])
      .where('library_loans.status', '=', 'open');
    const open = input.loanId
      ? await query.where('library_loans.id', '=', input.loanId).forUpdate().executeTakeFirst()
      : await query.where('library_copies.copy_no', '=', normalizeScannedCode(input.copyCode ?? '')).forUpdate().executeTakeFirst();
    if (!open) {
      throw ruleViolationError(LIBRARY_RULE_CODE, 'Không có lượt mượn đang mở của bản này');
    }
    const reader = await this.findReader(transaction, open.reader_id);
    await this.organizationScopes.assertCanAccess(currentUser, MANAGE, reader.org_unit_id);
    const rule = await this.core.rule(transaction, reader.reader_kind);
    const today = this.core.today();
    const fine = lateFine(rule.fine_per_day, open.due_on, today);
    const lost = input.condition === 'lost';
    const loan = await transaction
      .updateTable('library_loans')
      .set({
        status: lost ? 'lost' : 'returned',
        returned_on: today,
        return_condition: input.condition,
        fine_amount: fine,
        received_by_name: currentUser.description.full_name,
        updated_at: this.clock.now(),
      })
      .where('id', '=', open.id)
      .returning(['id', 'status', 'returned_on', 'fine_amount', 'return_condition'])
      .executeTakeFirstOrThrow();
    if (input.condition !== 'good') {
      await transaction
        .updateTable('library_copies')
        .set({ condition: lost ? 'lost' : 'damaged', updated_at: this.clock.now() })
        .where('id', '=', open.copy_id)
        .execute();
    }
    const notified = lost || input.condition === 'damaged' ? null : await this.holdForNextReservation(transaction, open.title_id, open.copy_id);
    return {
      orgUnitId: reader.org_unit_id,
      loan: {
        ...loan,
        copy_no: open.copy_no,
        reader_name: reader.full_name,
        overdue_days: overdueDays(open.due_on, today),
        reservation_for: notified,
      },
    };
  }

  // Trả hàng loạt (thu sách giáo khoa cuối năm): mỗi dòng một lượt mượn và tình trạng; cùng thành công hoặc không dòng nào
  async giveBackMany(currentUser: CurrentUser, items: Array<{ loanId: string; condition: 'good' | 'damaged' | 'lost' }>, origin: ChangeOrigin) {
    const database = await this.core.database();
    return database.transaction().execute(async (transaction) => {
      const results = [];
      for (const item of items) {
        results.push((await this.returnOne(transaction, currentUser, item)).loan);
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_loans',
        entityId: results[0]?.id ?? '00000000-0000-0000-0000-000000000001',
        action: 'update',
        before: null,
        after: { returned: results.length },
      });
      return { returned: results.length, loans: results };
    });
  }

  async renew(currentUser: CurrentUser, loanId: string, origin: ChangeOrigin) {
    const database = await this.core.database();
    return database.transaction().execute(async (transaction) => {
      const loan = await transaction
        .selectFrom('library_loans')
        .innerJoin('library_copies', 'library_copies.id', 'library_loans.copy_id')
        .select([
          'library_loans.id',
          'library_loans.reader_id',
          'library_loans.due_on',
          'library_loans.renewals',
          'library_loans.kind',
          'library_copies.title_id',
        ])
        .where('library_loans.id', '=', loanId)
        .where('library_loans.status', '=', 'open')
        .forUpdate()
        .executeTakeFirst();
      if (!loan) {
        throw ruleViolationError(LIBRARY_RULE_CODE, 'Không có lượt mượn đang mở');
      }
      const reader = await this.findReader(transaction, loan.reader_id);
      await this.organizationScopes.assertCanAccess(currentUser, MANAGE, reader.org_unit_id);
      if (loan.kind === 'textbook') {
        throw ruleViolationError(LIBRARY_RULE_CODE, 'Sách giáo khoa cấp đầu năm không gia hạn, hạn là hết năm học');
      }
      this.assertReaderCanBorrow(reader);
      const rule = await this.core.rule(transaction, reader.reader_kind);
      if (loan.renewals >= rule.max_renewals) {
        throw ruleViolationError(LIBRARY_RULE_CODE, `Đã gia hạn đủ ${rule.max_renewals} lần`);
      }
      const waiting = await transaction
        .selectFrom('library_reservations')
        .select('id')
        .where('title_id', '=', loan.title_id)
        .where('status', 'in', ['waiting', 'ready'])
        .executeTakeFirst();
      if (waiting) {
        throw ruleViolationError(LIBRARY_RULE_CODE, 'Có người đang đặt trước ấn phẩm này, không gia hạn được');
      }
      const today = this.core.today();
      const dueOn = addDays(loan.due_on > today ? loan.due_on : today, rule.loan_days);
      await transaction
        .updateTable('library_loans')
        .set({ due_on: dueOn, renewals: loan.renewals + 1, updated_at: this.clock.now() })
        .where('id', '=', loanId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: reader.org_unit_id,
        entityName: 'library_loans',
        entityId: loanId,
        action: 'update',
        before: { due_on: loan.due_on },
        after: { due_on: dueOn },
      });
      return { id: loanId, due_on: dueOn, renewals: loan.renewals + 1 };
    });
  }

  // Báo mất: đóng lượt mượn là mất, bản sao đánh dấu mất; bồi thường chỉ ghi nhận trong ghi chú, không thu tiền ở đây
  async reportLost(currentUser: CurrentUser, loanId: string, note: string | null, origin: ChangeOrigin) {
    const database = await this.core.database();
    return database.transaction().execute(async (transaction) => {
      const result = await this.returnOne(transaction, currentUser, { loanId, condition: 'lost' });
      if (note) {
        await transaction.updateTable('library_loans').set({ note }).where('id', '=', loanId).execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: result.orgUnitId,
        entityName: 'library_loans',
        entityId: loanId,
        action: 'update',
        before: null,
        after: { status: 'lost', note },
      });
      return result.loan;
    });
  }

  // Nhắc bạn đọc có bản quá hạn: ghi thông báo vào hàng đợi, mỗi lượt mượn nhắc tối đa một lần mỗi ngày
  async remindOverdue(currentUser: CurrentUser, origin: ChangeOrigin) {
    const database = await this.core.database();
    const today = this.core.today();
    const scope = await this.organizationScopes.resolve(currentUser, MANAGE);
    return database.transaction().execute(async (transaction) => {
      const rows = await transaction
        .selectFrom('library_loans')
        .innerJoin('library_copies', 'library_copies.id', 'library_loans.copy_id')
        .innerJoin('library_titles', 'library_titles.id', 'library_copies.title_id')
        .select([
          'library_loans.id',
          'library_loans.reader_id',
          'library_loans.due_on',
          'library_titles.title',
          'library_copies.copy_no',
        ])
        .where('library_loans.status', '=', 'open')
        .where('library_loans.due_on', '<', today)
        .where((eb) => eb.or([eb('library_loans.reminded_on', 'is', null), eb('library_loans.reminded_on', '<', today)]))
        .execute();
      const byReader = new Map<string, typeof rows>();
      for (const row of rows) {
        byReader.set(row.reader_id, [...(byReader.get(row.reader_id) ?? []), row]);
      }
      let readers = 0;
      let loans = 0;
      for (const [readerId, items] of byReader) {
        const reader = await this.findReader(transaction, readerId);
        if (!scope.wholeSchool && !scope.orgUnitIds.includes(reader.org_unit_id)) {
          continue;
        }
        const recipients = await this.recipientsOf(transaction, reader);
        if (recipients.length === 0) {
          continue;
        }
        await queueNotification(transaction, {
          orgUnitId: reader.org_unit_id,
          templateCode: 'library_overdue',
          title: 'Sách thư viện quá hạn',
          body: `${reader.full_name} còn ${items.length} bản quá hạn: ${items
            .slice(0, 5)
            .map((item) => `${item.title} (hạn ${item.due_on})`)
            .join('; ')}. Vui lòng trả sách về thư viện`,
          targetType: 'library_readers',
          targetId: readerId,
          recipients,
        });
        await transaction
          .updateTable('library_loans')
          .set({ reminded_on: today })
          .where('id', 'in', items.map((item) => item.id))
          .execute();
        readers += 1;
        loans += items.length;
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_loans',
        entityId: '00000000-0000-0000-0000-000000000001',
        action: 'update',
        before: null,
        after: { reminded_readers: readers, reminded_loans: loans },
      });
      return { readers, loans };
    });
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Đặt trước
  // ------------------------------------------------------------------------------------------------------------------

  // Bản sẵn sàng chưa ai giữ của ấn phẩm: tốt, không đang mượn, không đang giữ chỗ
  private async freeCopy(executor: LibraryExecutor, titleId: string, preferred?: string): Promise<string | undefined> {
    const rows = await executor
      .selectFrom('library_copies')
      .select('library_copies.id')
      .where('library_copies.title_id', '=', titleId)
      .where('library_copies.condition', '=', 'good')
      .where((eb) =>
        eb.not(
          eb.exists(
            eb.selectFrom('library_loans').select('id').whereRef('library_loans.copy_id', '=', 'library_copies.id').where('library_loans.status', '=', 'open'),
          ),
        ),
      )
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('library_reservations')
              .select('id')
              .whereRef('library_reservations.copy_id', '=', 'library_copies.id')
              .where('library_reservations.status', '=', 'ready'),
          ),
        ),
      )
      .orderBy('library_copies.copy_no')
      .execute();
    return rows.find((row) => row.id === preferred)?.id ?? rows[0]?.id;
  }

  // Giữ một bản đã sẵn sàng cho người đặt trước đầu hàng đợi của ấn phẩm; báo cho họ. Trả tên người được giữ chỗ
  private async holdForNextReservation(transaction: LibraryExecutor, titleId: string, preferredCopyId?: string): Promise<string | null> {
    await this.expireReservations(transaction, titleId);
    const next = await transaction
      .selectFrom('library_reservations')
      .select(['id', 'reader_id'])
      .where('title_id', '=', titleId)
      .where('status', '=', 'waiting')
      .orderBy('reserved_at')
      .orderBy('id')
      .executeTakeFirst();
    if (!next) {
      return null;
    }
    const copyId = await this.freeCopy(transaction, titleId, preferredCopyId);
    if (!copyId) {
      return null;
    }
    const settings = await this.core.settings(transaction);
    const today = this.core.today();
    await transaction
      .updateTable('library_reservations')
      .set({ status: 'ready', copy_id: copyId, ready_on: today, expires_on: addDays(today, settings.hold_days) })
      .where('id', '=', next.id)
      .execute();
    const reader = await this.findReader(transaction, next.reader_id);
    const title = await this.core.findTitle(transaction, titleId);
    await queueNotification(transaction, {
      orgUnitId: reader.org_unit_id,
      templateCode: 'library_reservation_ready',
      title: 'Sách đặt trước đã sẵn sàng',
      body: `"${title.title}" đã có bản cho ${reader.full_name}, giữ đến ngày ${addDays(today, settings.hold_days)}`,
      targetType: 'library_readers',
      targetId: reader.id,
      recipients: await this.recipientsOf(transaction, reader),
    });
    return reader.full_name;
  }

  // Lượt giữ chỗ quá hạn thì hết hiệu lực, bản được giữ cho người kế tiếp
  private async expireReservations(transaction: LibraryExecutor, titleId?: string) {
    const today = this.core.today();
    const expired = await transaction
      .updateTable('library_reservations')
      .set({ status: 'expired', copy_id: null, closed_at: this.clock.now() })
      .where('status', '=', 'ready')
      .where('expires_on', '<', today)
      .$if(titleId !== undefined, (builder) => builder.where('title_id', '=', titleId ?? ''))
      .returning('title_id')
      .execute();
    return [...new Set(expired.map((row) => row.title_id))];
  }

  async reservations(currentUser: CurrentUser, filter: { status?: string; readerId?: string; titleId?: string }) {
    const database = await this.core.database();
    await database.transaction().execute(async (transaction) => {
      for (const titleId of await this.expireReservations(transaction)) {
        await this.holdForNextReservation(transaction, titleId);
      }
    });
    const scope = await this.organizationScopes.resolve(currentUser, MANAGE);
    return database
      .selectFrom('library_reservations')
      .innerJoin('library_titles', 'library_titles.id', 'library_reservations.title_id')
      .innerJoin('library_readers', 'library_readers.id', 'library_reservations.reader_id')
      .leftJoin('staff', 'staff.id', 'library_readers.staff_id')
      .leftJoin('children', 'children.id', 'library_readers.child_id')
      .leftJoin('library_copies', 'library_copies.id', 'library_reservations.copy_id')
      .select([
        'library_reservations.id',
        'library_reservations.title_id',
        'library_titles.title',
        'library_reservations.reader_id',
        'library_readers.card_no',
        sql<string>`coalesce(staff.full_name, children.full_name)`.as('reader_name'),
        'library_reservations.status',
        'library_copies.copy_no',
        'library_reservations.reserved_at',
        'library_reservations.ready_on',
        'library_reservations.expires_on',
      ])
      .$if(filter.status !== undefined, (builder) => builder.where('library_reservations.status', '=', (filter.status ?? 'waiting') as 'waiting'))
      .$if(filter.status === undefined, (builder) => builder.where('library_reservations.status', 'in', ['waiting', 'ready']))
      .$if(filter.readerId !== undefined, (builder) => builder.where('library_reservations.reader_id', '=', filter.readerId ?? ''))
      .$if(filter.titleId !== undefined, (builder) => builder.where('library_reservations.title_id', '=', filter.titleId ?? ''))
      .$if(!scope.wholeSchool, (builder) =>
        builder.where(sql<string>`coalesce(staff.org_unit_id, children.org_unit_id)`, 'in', [...scope.orgUnitIds, '']),
      )
      .orderBy('library_reservations.reserved_at')
      .limit(500)
      .execute();
  }

  async reserve(currentUser: CurrentUser, input: { readerId: string; titleId: string }, origin: ChangeOrigin) {
    const database = await this.core.database();
    return database.transaction().execute(async (transaction) => {
      const reader = await this.findReader(transaction, input.readerId);
      await this.organizationScopes.assertCanAccess(currentUser, MANAGE, reader.org_unit_id);
      this.assertReaderCanBorrow(reader);
      const title = await transaction
        .selectFrom('library_titles')
        .innerJoin('library_categories', 'library_categories.id', 'library_titles.category_id')
        .select(['library_titles.id', 'library_titles.status', 'library_categories.lendable'])
        .where('library_titles.id', '=', input.titleId)
        .executeTakeFirst();
      if (!title) {
        throw notFoundError('Không tìm thấy ấn phẩm', 'library_title');
      }
      if (title.status !== 'active' || !title.lendable) {
        throw ruleViolationError(LIBRARY_RULE_CODE, 'Ấn phẩm đã ngừng dùng hoặc chỉ đọc tại chỗ, không đặt trước');
      }
      if (await this.freeCopy(transaction, input.titleId)) {
        throw ruleViolationError(LIBRARY_RULE_CODE, 'Còn bản sẵn sàng, cho mượn trực tiếp không cần đặt trước');
      }
      const copies = await transaction
        .selectFrom('library_copies')
        .select('id')
        .where('title_id', '=', input.titleId)
        .where('condition', 'in', ['good'])
        .executeTakeFirst();
      if (!copies) {
        throw ruleViolationError(LIBRARY_RULE_CODE, 'Ấn phẩm chưa có bản nào ở tình trạng tốt để đặt trước');
      }
      const duplicate = await transaction
        .selectFrom('library_reservations')
        .select('id')
        .where('title_id', '=', input.titleId)
        .where('reader_id', '=', input.readerId)
        .where('status', 'in', ['waiting', 'ready'])
        .executeTakeFirst();
      if (duplicate) {
        throw ruleViolationError(LIBRARY_RULE_CODE, 'Bạn đọc đã đặt trước ấn phẩm này');
      }
      const created = await transaction
        .insertInto('library_reservations')
        .values({ title_id: input.titleId, reader_id: input.readerId, created_by: currentUser.id })
        .returning(['id', 'status'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: reader.org_unit_id,
        entityName: 'library_reservations',
        entityId: created.id,
        action: 'create',
        before: null,
        after: input,
      });
      return created;
    });
  }

  async cancelReservation(currentUser: CurrentUser, reservationId: string, origin: ChangeOrigin) {
    const database = await this.core.database();
    await database.transaction().execute(async (transaction) => {
      const reservation = await transaction
        .selectFrom('library_reservations')
        .select(['id', 'title_id', 'reader_id', 'status', 'copy_id'])
        .where('id', '=', reservationId)
        .forUpdate()
        .executeTakeFirst();
      if (!reservation) {
        throw notFoundError('Không tìm thấy lượt đặt trước', 'library_reservation');
      }
      if (reservation.status !== 'waiting' && reservation.status !== 'ready') {
        throw ruleViolationError(LIBRARY_RULE_CODE, 'Lượt đặt trước đã đóng');
      }
      const reader = await this.findReader(transaction, reservation.reader_id);
      await this.organizationScopes.assertCanAccess(currentUser, MANAGE, reader.org_unit_id);
      await transaction
        .updateTable('library_reservations')
        .set({ status: 'cancelled', copy_id: null, closed_at: this.clock.now() })
        .where('id', '=', reservationId)
        .execute();
      if (reservation.status === 'ready') {
        await this.holdForNextReservation(transaction, reservation.title_id, reservation.copy_id ?? undefined);
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: reader.org_unit_id,
        entityName: 'library_reservations',
        entityId: reservationId,
        action: 'update',
        before: { status: reservation.status },
        after: { status: 'cancelled' },
      });
    });
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Sách giáo khoa
  // ------------------------------------------------------------------------------------------------------------------

  async textbookSets() {
    const database = await this.core.database();
    const sets = await database
      .selectFrom('library_textbook_sets')
      .select(['id', 'name', 'grade_level', 'status'])
      .orderBy('grade_level')
      .orderBy('name')
      .execute();
    const titles = await database
      .selectFrom('library_textbook_set_titles')
      .innerJoin('library_titles', 'library_titles.id', 'library_textbook_set_titles.title_id')
      .select(['library_textbook_set_titles.set_id', 'library_titles.id as title_id', 'library_titles.title'])
      .orderBy('library_titles.title')
      .execute();
    return sets.map((set) => ({ ...set, titles: titles.filter((title) => title.set_id === set.id).map(({ title_id, title }) => ({ title_id, title })) }));
  }

  async saveTextbookSet(
    setId: string | null,
    input: { name: string; gradeLevel: string; titleIds: string[]; status?: 'active' | 'inactive' },
    origin: ChangeOrigin,
  ) {
    const database = await this.core.database();
    const found = await database.selectFrom('library_titles').select('id').where('id', 'in', input.titleIds).execute();
    if (found.length !== new Set(input.titleIds).size) {
      throw validationError([{ field: 'title_ids', message: 'Có ấn phẩm không tồn tại' }]);
    }
    return database.transaction().execute(async (transaction) => {
      let id = setId;
      if (id) {
        const updated = await transaction
          .updateTable('library_textbook_sets')
          .set({ name: input.name, grade_level: input.gradeLevel, ...(input.status ? { status: input.status } : {}), updated_at: this.clock.now() })
          .where('id', '=', id)
          .returning('id')
          .executeTakeFirst();
        if (!updated) {
          throw notFoundError('Không tìm thấy bộ sách', 'library_textbook_set');
        }
        await transaction.deleteFrom('library_textbook_set_titles').where('set_id', '=', id).execute();
      } else {
        const created = await transaction
          .insertInto('library_textbook_sets')
          .values({ name: input.name, grade_level: input.gradeLevel })
          .returning('id')
          .executeTakeFirstOrThrow();
        id = created.id;
      }
      if (input.titleIds.length > 0) {
        await transaction
          .insertInto('library_textbook_set_titles')
          .values([...new Set(input.titleIds)].map((titleId) => ({ set_id: id ?? '', title_id: titleId })))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_textbook_sets',
        entityId: id,
        action: setId ? 'update' : 'create',
        before: null,
        after: input,
      });
      return { id };
    });
  }

  // Phát bộ sách cho cả lớp: mỗi học sinh một bản mỗi đầu sách của bộ, hạn là ngày kết thúc năm học; học sinh đã giữ bản của
  // đầu sách đó thì bỏ qua; thiếu bản thì phát phần còn đủ và báo đầu sách thiếu
  async issueTextbooks(currentUser: CurrentUser, input: { classId: string; setId: string }, origin: ChangeOrigin) {
    const database = await this.core.database();
    const settings = await this.core.settings(database);
    const classRow = await database
      .selectFrom('classes')
      .select(['id', 'name', 'org_unit_id', 'grade_level', 'school_level', 'status'])
      .where('id', '=', input.classId)
      .executeTakeFirst();
    if (!classRow) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    await this.organizationScopes.assertCanAccess(currentUser, MANAGE, classRow.org_unit_id);
    if (!settings.student_levels.includes(classRow.school_level)) {
      throw ruleViolationError(LIBRARY_RULE_CODE, 'Cấp của lớp chưa bật mượn sách ở thiết lập thư viện');
    }
    const set = await database
      .selectFrom('library_textbook_sets')
      .select(['id', 'name', 'grade_level', 'status'])
      .where('id', '=', input.setId)
      .executeTakeFirst();
    if (!set || set.status !== 'active') {
      throw notFoundError('Không tìm thấy bộ sách đang dùng', 'library_textbook_set');
    }
    if (set.grade_level !== classRow.grade_level) {
      throw ruleViolationError(LIBRARY_RULE_CODE, 'Bộ sách không cùng khối với lớp');
    }
    const titles = await database
      .selectFrom('library_textbook_set_titles')
      .innerJoin('library_titles', 'library_titles.id', 'library_textbook_set_titles.title_id')
      .select(['library_titles.id', 'library_titles.title'])
      .where('library_textbook_set_titles.set_id', '=', input.setId)
      .where('library_titles.status', '=', 'active')
      .execute();
    if (titles.length === 0) {
      throw ruleViolationError(LIBRARY_RULE_CODE, 'Bộ sách chưa có đầu sách nào');
    }
    const academicEnd = await this.core.academicYearEnd();
    const today = this.core.today();
    const dueOn = academicEnd && academicEnd >= today ? academicEnd : addDays(today, 300);
    return database.transaction().execute(async (transaction) => {
      const students = await transaction
        .selectFrom('children')
        .innerJoin('class_enrollments', (join) =>
          join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
        )
        .select(['children.id', 'children.full_name'])
        .where('class_enrollments.class_id', '=', input.classId)
        .where('children.status', '=', 'active')
        .orderBy('children.full_name')
        .execute();
      const need = new Map<string, number>();
      let issued = 0;
      const withoutCard: string[] = [];
      for (const student of students) {
        let reader: { id: string };
        try {
          reader = await this.ensureReader(transaction, { childId: student.id }, currentUser, null);
        } catch (error) {
          if (error instanceof ApplicationError) {
            withoutCard.push(student.full_name);
            continue;
          }
          throw error;
        }
        const readerRow = await this.findReader(transaction, reader.id);
        if (readerRow.status !== 'active') {
          withoutCard.push(student.full_name);
          continue;
        }
        for (const title of titles) {
          const held = await transaction
            .selectFrom('library_loans')
            .innerJoin('library_copies', 'library_copies.id', 'library_loans.copy_id')
            .select('library_loans.id')
            .where('library_loans.reader_id', '=', reader.id)
            .where('library_loans.kind', '=', 'textbook')
            .where('library_loans.status', '=', 'open')
            .where('library_copies.title_id', '=', title.id)
            .executeTakeFirst();
          if (held) {
            continue;
          }
          const copyId = await this.freeCopy(transaction, title.id);
          if (!copyId) {
            need.set(title.id, (need.get(title.id) ?? 0) + 1);
            continue;
          }
          await this.insertLoan(transaction, {
            copyId,
            readerId: reader.id,
            classId: input.classId,
            kind: 'textbook',
            dueOn,
            note: set.name,
            currentUser,
          });
          issued += 1;
        }
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'library_loans',
        entityId: input.classId,
        action: 'create',
        before: null,
        after: { class_id: input.classId, set_id: input.setId, issued },
      });
      return {
        class_name: classRow.name,
        students: students.length,
        issued,
        due_on: dueOn,
        without_card: withoutCard,
        shortages: titles
          .filter((title) => need.has(title.id))
          .map((title) => ({ title_id: title.id, title: title.title, missing: need.get(title.id) ?? 0 })),
      };
    });
  }

  // Sách giáo khoa lớp còn giữ: theo học sinh, kèm hạn, để thu cuối năm
  async textbooksOfClass(currentUser: CurrentUser, classId: string) {
    const database = await this.core.database();
    const classRow = await database.selectFrom('classes').select(['id', 'org_unit_id']).where('id', '=', classId).executeTakeFirst();
    if (!classRow) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    await this.organizationScopes.assertCanAccess(currentUser, MANAGE, classRow.org_unit_id);
    return database
      .selectFrom('library_loans')
      .innerJoin('library_copies', 'library_copies.id', 'library_loans.copy_id')
      .innerJoin('library_titles', 'library_titles.id', 'library_copies.title_id')
      .innerJoin('library_readers', 'library_readers.id', 'library_loans.reader_id')
      .innerJoin('children', 'children.id', 'library_readers.child_id')
      .select([
        'library_loans.id',
        'library_copies.copy_no',
        'library_titles.title',
        'children.full_name as reader_name',
        'library_loans.loaned_on',
        'library_loans.due_on',
      ])
      .where('library_loans.class_id', '=', classId)
      .where('library_loans.kind', '=', 'textbook')
      .where('library_loans.status', '=', 'open')
      .orderBy('children.full_name')
      .orderBy('library_titles.title')
      .execute();
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Của tôi (cán bộ), của con (phụ huynh)
  // ------------------------------------------------------------------------------------------------------------------

  async myLoans(currentUser: CurrentUser) {
    const database = await this.core.database();
    const staff = await database.selectFrom('staff').select('id').where('user_id', '=', currentUser.id).executeTakeFirst();
    if (!staff) {
      return { reader: null, loans: [] };
    }
    const reader = await database.selectFrom('library_readers').select(['id', 'card_no', 'status']).where('staff_id', '=', staff.id).executeTakeFirst();
    if (!reader) {
      return { reader: null, loans: [] };
    }
    return { reader, loans: await this.openLoansOf(database, reader.id) };
  }

  async childLoans(currentUser: CurrentUser, childId: string) {
    const database = await this.core.database();
    const guardian = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.id')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!guardian) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không phải phụ huynh của học sinh này');
    }
    const reader = await database.selectFrom('library_readers').select(['id', 'card_no', 'status']).where('child_id', '=', childId).executeTakeFirst();
    if (!reader) {
      return { reader: null, loans: [] };
    }
    return { reader, loans: await this.openLoansOf(database, reader.id) };
  }

  private async openLoansOf(database: Database, readerId: string) {
    const today = this.core.today();
    const rows = await database
      .selectFrom('library_loans')
      .innerJoin('library_copies', 'library_copies.id', 'library_loans.copy_id')
      .innerJoin('library_titles', 'library_titles.id', 'library_copies.title_id')
      .select([
        'library_loans.id',
        'library_copies.copy_no',
        'library_titles.title',
        'library_loans.kind',
        'library_loans.loaned_on',
        'library_loans.due_on',
      ])
      .where('library_loans.reader_id', '=', readerId)
      .where('library_loans.status', '=', 'open')
      .orderBy('library_loans.due_on')
      .execute();
    return rows.map((row) => ({ ...row, overdue_days: overdueDays(row.due_on, today) }));
  }

  async readerLoanHistory(currentUser: CurrentUser, readerId: string) {
    const database = await this.core.database();
    const reader = await this.findReader(database, readerId);
    await this.organizationScopes.assertCanAccess(currentUser, MANAGE, reader.org_unit_id);
    return this.loans(currentUser, { readerId, limit: MAXIMUM_PAGE, offset: 0 });
  }
}

// ------------------------------------------------------------------------------------------------------------------
// Điểm cuối
// ------------------------------------------------------------------------------------------------------------------

const CONDITIONS = ['good', 'damaged', 'lost'] as const;

function readCondition(body: RequestBody, errors: FieldError[]): 'good' | 'damaged' | 'lost' {
  const value = body?.condition ?? 'good';
  if (!(CONDITIONS as readonly unknown[]).includes(value)) {
    errors.push({ field: 'condition', message: 'Tình trạng là good, damaged hoặc lost' });
    return 'good';
  }
  return value as 'good' | 'damaged' | 'lost';
}

function pageOf(query: Record<string, string | undefined>) {
  return { limit: Math.min(Number(query.limit) || 50, MAXIMUM_PAGE), offset: Math.max(Number(query.offset) || 0, 0) };
}

@Controller('library')
export class LibraryCirculationController {
  constructor(private readonly circulation: LibraryCirculationService) {}

  @Get('readers')
  @RequirePermission(MANAGE)
  readers(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (query.kind && query.kind !== 'staff' && query.kind !== 'student') {
      errors.push({ field: 'kind', message: 'Loại là staff hoặc student' });
    }
    if (query.status && query.status !== 'active' && query.status !== 'locked') {
      errors.push({ field: 'status', message: 'Trạng thái là active hoặc locked' });
    }
    if (query.class_id && !isUuid(query.class_id)) {
      errors.push({ field: 'class_id', message: 'Mã lớp không hợp lệ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.circulation.readers(currentUser, {
      kind: (query.kind as 'staff' | 'student' | undefined) || undefined,
      query: query.query?.trim() || undefined,
      classId: query.class_id || undefined,
      status: (query.status as 'active' | 'locked' | undefined) || undefined,
      ...pageOf(query),
    });
  }

  @Get('readers/lookup')
  @RequirePermission(MANAGE)
  lookup(@Query('q') text: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!text || text.trim().length < 2) {
      throw validationError([{ field: 'q', message: 'Nhập số thẻ hoặc ít nhất 2 ký tự của tên' }]);
    }
    return this.circulation.lookupReader(currentUser, text);
  }

  @Post('readers')
  @RequirePermission(MANAGE)
  issue(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const staffId = readOptionalUuid(body, 'staff_id', errors) ?? undefined;
    const childId = readOptionalUuid(body, 'child_id', errors) ?? undefined;
    if ((staffId === undefined) === (childId === undefined)) {
      errors.push({ field: 'person', message: 'Chọn một cán bộ hoặc một học sinh' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.circulation.issueReader(currentUser, { staffId, childId }, originOf(request, currentUser));
  }

  @Post('readers/sync')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  sync(@Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.circulation.syncReaders(currentUser, originOf(request, currentUser));
  }

  @Patch('readers/:id')
  @RequirePermission(MANAGE)
  setStatus(
    @Param('id', uuidParameter('Mã bạn đọc không hợp lệ')) readerId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const status = body?.status;
    if (status !== 'active' && status !== 'locked') {
      errors.push({ field: 'status', message: 'Trạng thái là active hoặc locked' });
    }
    const reason = readOptionalText(body, 'reason', errors) ?? null;
    if (status === 'locked' && !reason) {
      errors.push({ field: 'reason', message: 'Bắt buộc ghi lý do khóa thẻ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.circulation.setReaderStatus(readerId, status as 'active' | 'locked', reason, originOf(request, currentUser));
  }

  @Get('readers/:id/loans')
  @RequirePermission(MANAGE)
  history(@Param('id', uuidParameter('Mã bạn đọc không hợp lệ')) readerId: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.circulation.readerLoanHistory(currentUser, readerId);
  }

  @Get('loans')
  @RequirePermission(MANAGE)
  loans(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (query.status && !['open', 'overdue', 'returned', 'lost'].includes(query.status)) {
      errors.push({ field: 'status', message: 'Trạng thái là open, overdue, returned hoặc lost' });
    }
    if (query.kind && query.kind !== 'regular' && query.kind !== 'textbook') {
      errors.push({ field: 'kind', message: 'Loại là regular hoặc textbook' });
    }
    for (const field of ['reader_id', 'class_id']) {
      if (query[field] && !isUuid(query[field])) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.circulation.loans(currentUser, {
      status: (query.status as 'open' | 'overdue' | 'returned' | 'lost' | undefined) || undefined,
      readerId: query.reader_id || undefined,
      classId: query.class_id || undefined,
      kind: (query.kind as 'regular' | 'textbook' | undefined) || undefined,
      query: query.query?.trim() || undefined,
      ...pageOf(query),
    });
  }

  @Post('loans')
  @RequirePermission(MANAGE)
  lend(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const readerId = readRequiredUuid(body, 'reader_id', errors, 'Bắt buộc chọn bạn đọc');
    const codes = body?.copy_codes;
    if (!Array.isArray(codes) || codes.length === 0 || codes.length > 50 || codes.some((code) => typeof code !== 'string' || !code.trim())) {
      errors.push({ field: 'copy_codes', message: 'Quét từ 1 đến 50 mã bản sao' });
    }
    const classId = readOptionalUuid(body, 'class_id', errors) ?? null;
    const note = readOptionalText(body, 'note', errors) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.circulation.lend(currentUser, { readerId, copyCodes: codes as string[], classId, note }, originOf(request, currentUser));
  }

  @Post('loans/return')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  giveBack(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const copyCode = readOptionalText(body, 'copy_code', errors) ?? undefined;
    const loanId = readOptionalUuid(body, 'loan_id', errors) ?? undefined;
    if ((copyCode === undefined) === (loanId === undefined)) {
      errors.push({ field: 'copy_code', message: 'Nhập mã bản sao hoặc mã lượt mượn' });
    }
    const condition = readCondition(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.circulation.giveBack(currentUser, { copyCode, loanId, condition }, originOf(request, currentUser));
  }

  @Post('loans/return-many')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  giveBackMany(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const raw = body?.items;
    const items: Array<{ loanId: string; condition: 'good' | 'damaged' | 'lost' }> = [];
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAXIMUM_BATCH) {
      errors.push({ field: 'items', message: `Chọn từ 1 đến ${MAXIMUM_BATCH} lượt mượn` });
    } else {
      for (const item of raw as RequestBody[]) {
        const itemErrors: FieldError[] = [];
        const loanId = readRequiredUuid(item, 'loan_id', itemErrors, 'Bắt buộc có mã lượt mượn');
        const condition = readCondition(item, itemErrors);
        errors.push(...itemErrors);
        items.push({ loanId, condition });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.circulation.giveBackMany(currentUser, items, originOf(request, currentUser));
  }

  @Post('loans/remind')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  remind(@Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.circulation.remindOverdue(currentUser, originOf(request, currentUser));
  }

  @Post('loans/:id/renew')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  renew(
    @Param('id', uuidParameter('Mã lượt mượn không hợp lệ')) loanId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.circulation.renew(currentUser, loanId, originOf(request, currentUser));
  }

  @Post('loans/:id/lost')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  lost(
    @Param('id', uuidParameter('Mã lượt mượn không hợp lệ')) loanId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const note = readOptionalText(body, 'note', errors) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.circulation.reportLost(currentUser, loanId, note, originOf(request, currentUser));
  }

  @Get('reservations')
  @RequirePermission(MANAGE)
  reservations(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (query.status && !['waiting', 'ready', 'fulfilled', 'cancelled', 'expired'].includes(query.status)) {
      errors.push({ field: 'status', message: 'Trạng thái không hợp lệ' });
    }
    for (const field of ['reader_id', 'title_id']) {
      if (query[field] && !isUuid(query[field])) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.circulation.reservations(currentUser, {
      status: query.status || undefined,
      readerId: query.reader_id || undefined,
      titleId: query.title_id || undefined,
    });
  }

  @Post('reservations')
  @RequirePermission(MANAGE)
  reserve(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      readerId: readRequiredUuid(body, 'reader_id', errors, 'Bắt buộc chọn bạn đọc'),
      titleId: readRequiredUuid(body, 'title_id', errors, 'Bắt buộc chọn ấn phẩm'),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.circulation.reserve(currentUser, input, originOf(request, currentUser));
  }

  @Delete('reservations/:id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async cancel(
    @Param('id', uuidParameter('Mã lượt đặt trước không hợp lệ')) reservationId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.circulation.cancelReservation(currentUser, reservationId, originOf(request, currentUser));
  }

  @Get('textbook-sets')
  @RequirePermission(MANAGE)
  textbookSets() {
    return this.circulation.textbookSets();
  }

  @Post('textbook-sets')
  @RequirePermission(MANAGE)
  createSet(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.circulation.saveTextbookSet(null, readSetInput(body), originOf(request, currentUser));
  }

  @Patch('textbook-sets/:id')
  @RequirePermission(MANAGE)
  updateSet(
    @Param('id', uuidParameter('Mã bộ sách không hợp lệ')) setId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.circulation.saveTextbookSet(setId, readSetInput(body), originOf(request, currentUser));
  }

  @Post('textbooks/issue')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  issueTextbooks(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      classId: readRequiredUuid(body, 'class_id', errors, 'Bắt buộc chọn lớp'),
      setId: readRequiredUuid(body, 'set_id', errors, 'Bắt buộc chọn bộ sách'),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.circulation.issueTextbooks(currentUser, input, originOf(request, currentUser));
  }

  @Get('textbooks/outstanding')
  @RequirePermission(MANAGE)
  outstanding(@Query('class_id') classId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!classId || !isUuid(classId)) {
      throw validationError([{ field: 'class_id', message: 'Bắt buộc chọn lớp' }]);
    }
    return this.circulation.textbooksOfClass(currentUser, classId);
  }

  // Cán bộ: sách mình đang mượn (ứng dụng giáo viên, cổng quản trị)
  @Get('my-loans')
  @RequirePermission(VIEW, MANAGE)
  myLoans(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.circulation.myLoans(currentUser);
  }

  // Phụ huynh: sách con đang mượn (ứng dụng phụ huynh); máy chủ kiểm tra quan hệ phụ huynh, không cần quyền
  @Get('children/:id/loans')
  childLoans(@Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.circulation.childLoans(currentUser, childId);
  }
}

function readSetInput(body: RequestBody) {
  const errors: FieldError[] = [];
  const name = readRequiredText(body, 'name', errors);
  const gradeLevel = readRequiredText(body, 'grade_level', errors);
  const raw = body?.title_ids;
  if (!Array.isArray(raw) || raw.length > 50 || raw.some((id) => !isUuid(id))) {
    errors.push({ field: 'title_ids', message: 'Chọn tối đa 50 đầu sách' });
  }
  const status: 'active' | 'inactive' | null | undefined =
    body?.status === undefined ? undefined : body.status === 'inactive' ? 'inactive' : body.status === 'active' ? 'active' : null;
  if (status === null) {
    errors.push({ field: 'status', message: 'Trạng thái là active hoặc inactive' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { name, gradeLevel, titleIds: (raw as string[] | undefined) ?? [], status: status ?? undefined };
}
