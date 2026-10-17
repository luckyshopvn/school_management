import { Inject, Injectable } from '@nestjs/common';
import {
  createEmptyDatabase,
  dropDatabaseIfExists,
  makeDatabaseReadOnly,
  makeDatabaseWritable,
  migrateToLatest,
  type AcademicTermType,
} from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { sql, type Kysely } from 'kysely';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import { Databases } from '../common/databases.js';
import {
  ACADEMIC_YEAR_TRANSITION_STEPS,
  type AcademicYearTransitionStep,
  type TransitionViolation,
} from './academic-year-transition.js';
import { calendarEndDate, generateWeeks, type CalendarInput, type DateRange } from './calendar.js';

const OPEN_ACADEMIC_YEAR_LOCK = 91_093;

export interface AcademicYearSummary {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: 'draft' | 'open' | 'closed';
}

export interface CalendarResponse extends Omit<CalendarInput, 'summer_term'> {
  academic_year_id: string;
  summer_term: DateRange | null;
}

export interface WeekResponse {
  week_no: number;
  start_date: string;
  end_date: string;
  is_off: boolean;
  note: string | null;
  // Khai báo tuần theo Sở (DT-16 phần 16e): học kỳ đang áp dụng (chọn riêng hoặc theo lịch), học kỳ chọn riêng, hiển thị
  term: AcademicTermType | null;
  term_type: AcademicTermType | null;
  is_visible: boolean;
}

export interface WeekChange {
  week_no: number;
  is_off: boolean;
  note: string | null;
  term_type?: AcademicTermType | null;
  is_visible?: boolean;
}

// Học kỳ theo lịch của tuần: học kỳ đầu tiên có ngày nằm trong tuần; tuần giữa hai học kỳ không thuộc học kỳ nào
export function termOfWeek(
  week: { start_date: string; end_date: string },
  terms: Array<{ term_type: AcademicTermType; start_date: string; end_date: string }>,
): AcademicTermType | null {
  const order: AcademicTermType[] = ['first_term', 'second_term', 'summer_term'];
  for (const type of order) {
    const term = terms.find((item) => item.term_type === type);
    if (term && term.start_date <= week.end_date && term.end_date >= week.start_date) {
      return type;
    }
  }
  return null;
}

// Điều kiện hủy chuyển hồ sơ lên năm học mới ghi ở yêu cầu thay đổi của phần 16e
const CANCEL_RULE_CODE = 'YCTD-124';

export interface RolloverStatus {
  current: AcademicYearSummary | null;
  candidates: AcademicYearSummary[];
  cancel: { allowed: boolean; reason: string | null };
}

function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy năm học', [
    { field: 'entity', message: 'academic_year' },
  ]);
}

@Injectable()
export class AcademicYearsService {
  constructor(
    private readonly databases: Databases,
    private readonly clock: Clock,
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    @Inject(ACADEMIC_YEAR_TRANSITION_STEPS) private readonly transitionSteps: AcademicYearTransitionStep[],
  ) {}

  private get system() {
    return this.databases.system;
  }

  listAcademicYears(): Promise<AcademicYearSummary[]> {
    return this.system
      .selectFrom('academic_years')
      .select(['id', 'name', 'start_date', 'end_date', 'status'])
      .orderBy('start_date', 'desc')
      .orderBy('created_at', 'desc')
      .execute();
  }

  async createAcademicYear(name: string, actorUserId: string): Promise<AcademicYearSummary> {
    const existing = await this.system
      .selectFrom('academic_years')
      .select('id')
      .where('name', '=', name)
      .executeTakeFirst();
    if (existing) {
      throw new ApplicationError('ERR_CONFLICT', 'Tên năm học đã tồn tại', [{ field: 'name', message: existing.id }]);
    }
    return this.system
      .insertInto('academic_years')
      .values({ name, created_by: actorUserId })
      .returning(['id', 'name', 'start_date', 'end_date', 'status'])
      .executeTakeFirstOrThrow();
  }

  private async findAcademicYear(academicYearId: string) {
    const year = await this.system
      .selectFrom('academic_years')
      .selectAll()
      .where('id', '=', academicYearId)
      .executeTakeFirst();
    if (!year) {
      throw notFound();
    }
    return year;
  }

  async readCalendar(academicYearId: string): Promise<CalendarResponse> {
    const year = await this.findAcademicYear(academicYearId);
    const terms = await this.system
      .selectFrom('academic_terms')
      .select(['term_type', 'start_date', 'end_date'])
      .where('academic_year_id', '=', academicYearId)
      .execute();
    const termOf = (type: AcademicTermType): DateRange | null => {
      const term = terms.find((item) => item.term_type === type);
      return term ? { start_date: term.start_date, end_date: term.end_date } : null;
    };
    return {
      academic_year_id: year.id,
      first_term: termOf('first_term') ?? { start_date: '', end_date: '' },
      second_term: termOf('second_term') ?? { start_date: '', end_date: '' },
      summer_term: termOf('summer_term'),
      school_days_of_week: year.school_days_of_week,
    };
  }

  // Lịch sửa được cho tới khi năm học đóng; đánh số lại tuần và giữ cờ nghỉ của tuần cùng ngày bắt đầu (BR-91)
  async saveCalendar(academicYearId: string, calendar: CalendarInput, actorUserId: string): Promise<CalendarResponse> {
    const year = await this.findAcademicYear(academicYearId);
    if (year.status === 'closed') {
      throw ruleViolationError('BR-91', 'Năm học đã đóng, không sửa được lịch');
    }
    const now = this.clock.now();
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('academic_years')
        .set({
          start_date: calendar.first_term.start_date,
          end_date: calendarEndDate(calendar),
          school_days_of_week: calendar.school_days_of_week,
          updated_at: now,
        })
        .where('id', '=', academicYearId)
        .execute();

      await transaction.deleteFrom('academic_terms').where('academic_year_id', '=', academicYearId).execute();
      const terms: Array<[AcademicTermType, DateRange | null]> = [
        ['first_term', calendar.first_term],
        ['second_term', calendar.second_term],
        ['summer_term', calendar.summer_term],
      ];
      for (const [termType, range] of terms) {
        if (range) {
          await transaction
            .insertInto('academic_terms')
            .values({ academic_year_id: academicYearId, term_type: termType, ...range, created_by: actorUserId })
            .execute();
        }
      }

      const previousWeeks = await transaction
        .selectFrom('school_weeks')
        .select(['start_date', 'is_off', 'note', 'term_type', 'is_visible'])
        .where('academic_year_id', '=', academicYearId)
        .execute();
      const previousByStartDate = new Map(previousWeeks.map((week) => [week.start_date, week]));
      await transaction.deleteFrom('school_weeks').where('academic_year_id', '=', academicYearId).execute();
      for (const week of generateWeeks(calendar)) {
        const previous = previousByStartDate.get(week.start_date);
        await transaction
          .insertInto('school_weeks')
          .values({
            academic_year_id: academicYearId,
            ...week,
            is_off: previous?.is_off ?? false,
            note: previous?.note ?? null,
            term_type: previous?.term_type ?? null,
            is_visible: previous?.is_visible ?? true,
            created_by: actorUserId,
          })
          .execute();
      }
    });
    return this.readCalendar(academicYearId);
  }

  async listWeeks(academicYearId: string): Promise<WeekResponse[]> {
    await this.findAcademicYear(academicYearId);
    const [weeks, terms] = await Promise.all([
      this.system
        .selectFrom('school_weeks')
        .select(['week_no', 'start_date', 'end_date', 'is_off', 'note', 'term_type', 'is_visible'])
        .where('academic_year_id', '=', academicYearId)
        .orderBy('week_no')
        .execute(),
      this.system
        .selectFrom('academic_terms')
        .select(['term_type', 'start_date', 'end_date'])
        .where('academic_year_id', '=', academicYearId)
        .execute(),
    ]);
    return weeks.map((week) => ({ ...week, term: week.term_type ?? termOfWeek(week, terms) }));
  }

  // Đánh dấu hoặc bỏ đánh dấu tuần nghỉ; số tuần không đổi (BR-91)
  async updateWeeks(academicYearId: string, changes: WeekChange[]): Promise<WeekResponse[]> {
    const year = await this.findAcademicYear(academicYearId);
    if (year.status === 'closed') {
      throw ruleViolationError('BR-91', 'Năm học đã đóng, không sửa được tuần nghỉ');
    }
    const existing = new Set(
      (
        await this.system
          .selectFrom('school_weeks')
          .select('week_no')
          .where('academic_year_id', '=', academicYearId)
          .execute()
      ).map((week) => week.week_no),
    );
    const missing = changes.filter((change) => !existing.has(change.week_no));
    if (missing.length > 0) {
      throw validationError(
        missing.map((change) => ({ field: 'weeks', message: `Không có tuần số ${change.week_no} trong năm học` })),
      );
    }
    const now = this.clock.now();
    await this.system.transaction().execute(async (transaction) => {
      for (const change of changes) {
        await transaction
          .updateTable('school_weeks')
          .set({
            is_off: change.is_off,
            note: change.note,
            ...(change.term_type !== undefined ? { term_type: change.term_type } : {}),
            ...(change.is_visible !== undefined ? { is_visible: change.is_visible } : {}),
            updated_at: now,
          })
          .where('academic_year_id', '=', academicYearId)
          .where('week_no', '=', change.week_no)
          .execute();
      }
    });
    return this.listWeeks(academicYearId);
  }

  // Mở năm học mới là một thao tác: kiểm tra, tạo cơ sở dữ liệu, chuyển dữ liệu, đóng năm đang dùng (BR-93)
  async openAcademicYear(academicYearId: string, actorUserId: string): Promise<AcademicYearSummary> {
    return this.system.connection().execute(async (connection) => {
      const lock = await sql<{
        locked: boolean;
      }>`select pg_try_advisory_lock(${OPEN_ACADEMIC_YEAR_LOCK}) as locked`.execute(connection);
      if (!lock.rows[0]?.locked) {
        throw ruleViolationError('BR-93', 'Đang có thao tác mở năm học khác, vui lòng thử lại sau');
      }
      try {
        return await this.openAcademicYearWhileLocked(academicYearId, actorUserId);
      } finally {
        await sql`select pg_advisory_unlock(${OPEN_ACADEMIC_YEAR_LOCK})`.execute(connection);
      }
    });
  }

  private async openAcademicYearWhileLocked(academicYearId: string, actorUserId: string): Promise<AcademicYearSummary> {
    const year = await this.findAcademicYear(academicYearId);
    if (year.status !== 'draft') {
      throw ruleViolationError('BR-93', 'Năm học này đã được mở trước đó');
    }
    if (!year.start_date || !year.end_date) {
      throw ruleViolationError('BR-91', 'Năm học chưa có lịch, hãy lưu lịch năm học trước khi mở');
    }

    const current = await this.system
      .selectFrom('academic_years')
      .innerJoin('academic_year_databases', 'academic_year_databases.academic_year_id', 'academic_years.id')
      .select(['academic_years.id', 'academic_years.end_date', 'academic_year_databases.database_name'])
      .where('academic_years.status', '=', 'open')
      .executeTakeFirst();
    if (current?.end_date && year.start_date <= current.end_date) {
      throw ruleViolationError('BR-93', 'Năm học mới phải bắt đầu sau khi năm học đang dùng kết thúc');
    }

    if (current) {
      const previousDatabase = this.databases.schoolYear<unknown>(current.database_name);
      const violations: TransitionViolation[] = [];
      for (const step of this.transitionSteps) {
        const violation = await step.check?.(previousDatabase);
        if (violation) {
          violations.push(violation);
        }
      }
      const [firstViolation] = violations;
      if (firstViolation) {
        throw ruleViolationError(
          firstViolation.ruleCode,
          firstViolation.message,
          violations.flatMap((violation) => violation.details),
        );
      }
    }

    const databaseName = `${this.configuration.schoolYearDatabasePrefix}${year.start_date.slice(0, 4)}_${year.end_date.slice(0, 4)}`;
    const registered = await this.system
      .selectFrom('academic_year_databases')
      .select('id')
      .where('database_name', '=', databaseName)
      .executeTakeFirst();
    if (registered) {
      throw new ApplicationError('ERR_CONFLICT', `Cơ sở dữ liệu ${databaseName} đã thuộc một năm học khác`);
    }

    const connectionString = this.databases.schoolYearConnectionString(databaseName);
    await createEmptyDatabase(this.configuration.systemDatabaseUrl, databaseName);
    try {
      const migration = await migrateToLatest('school-year', connectionString);
      if (migration.error) {
        throw migration.error;
      }
      const newDatabase = this.databases.schoolYear<unknown>(databaseName);
      for (const step of this.transitionSteps) {
        await step.carryOver?.({
          previousDatabase: current ? this.databases.schoolYear<unknown>(current.database_name) : null,
          newDatabase,
          academicYear: { id: year.id, startDate: year.start_date },
          actorUserId,
        });
      }

      const now = this.clock.now();
      await this.system.transaction().execute(async (transaction) => {
        if (current) {
          await transaction
            .updateTable('academic_years')
            .set({ status: 'closed', updated_at: now })
            .where('id', '=', current.id)
            .execute();
          await transaction
            .updateTable('academic_year_databases')
            .set({ status: 'read_only', closed_at: now, updated_at: now })
            .where('academic_year_id', '=', current.id)
            .execute();
        }
        await transaction
          .updateTable('academic_years')
          .set({ status: 'open', updated_at: now })
          .where('id', '=', academicYearId)
          .execute();
        await transaction
          .insertInto('academic_year_databases')
          .values({
            academic_year_id: academicYearId,
            database_name: databaseName,
            status: 'active',
            opened_at: now,
            carried_over_by: actorUserId,
            carried_over_at: sql<Date>`now()`,
            created_by: actorUserId,
          })
          .execute();
      });
    } catch (error) {
      await this.databases.closeSchoolYear(databaseName);
      await dropDatabaseIfExists(this.configuration.systemDatabaseUrl, databaseName);
      throw error;
    }

    if (current) {
      await makeDatabaseReadOnly(this.configuration.systemDatabaseUrl, current.database_name);
      await this.databases.closeSchoolYear(current.database_name);
    }
    const opened = await this.findAcademicYear(academicYearId);
    return {
      id: opened.id,
      name: opened.name,
      start_date: opened.start_date,
      end_date: opened.end_date,
      status: opened.status,
    };
  }
  // 5.7 Chuyển hồ sơ lên năm học mới theo Sở (DT-16 phần 16e): năm đang dùng, năm học chờ mở có lịch để "Thực hiện" (dùng
  // lại thao tác mở năm học, BR-93) và năm có thể "Hủy" kèm lý do khi không hủy được
  async rolloverStatus(): Promise<RolloverStatus> {
    const years = await this.listAcademicYears();
    const current = years.find((year) => year.status === 'open') ?? null;
    const candidates = years
      .filter((year) => year.status === 'draft' && year.start_date !== null && year.end_date !== null)
      .filter((year) => !current?.end_date || (year.start_date ?? '') > current.end_date);
    let cancel: RolloverStatus['cancel'] = { allowed: false, reason: 'Chưa có năm học đang dùng' };
    if (current) {
      try {
        await this.assertCancellable(current.id);
        cancel = { allowed: true, reason: null };
      } catch (error) {
        cancel = { allowed: false, reason: error instanceof ApplicationError ? error.message : 'Không kiểm tra được' };
      }
    }
    return { current, candidates, cancel };
  }

  // "Hủy" chuyển hồ sơ: chỉ khi năm học mới chưa phát sinh dữ liệu (không dòng nào thêm hoặc sửa sau giờ chuyển xong, chưa
  // gửi biểu mẫu lên cấp trên) và còn năm học trước để trở lại. Năm học mới về trạng thái chờ mở, cơ sở dữ liệu của năm
  // mới bị xóa; năm học trước mở lại và ghi được như trước khi chuyển
  async cancelOpen(academicYearId: string): Promise<AcademicYearSummary> {
    return this.system.connection().execute(async (connection) => {
      const lock = await sql<{
        locked: boolean;
      }>`select pg_try_advisory_lock(${OPEN_ACADEMIC_YEAR_LOCK}) as locked`.execute(connection);
      if (!lock.rows[0]?.locked) {
        throw ruleViolationError('BR-93', 'Đang có thao tác mở năm học khác, vui lòng thử lại sau');
      }
      try {
        const { opened, previous } = await this.assertCancellable(academicYearId);
        await makeDatabaseWritable(this.configuration.systemDatabaseUrl, previous.database_name);
        const now = this.clock.now();
        await this.system.transaction().execute(async (transaction) => {
          await transaction
            .deleteFrom('academic_year_databases')
            .where('academic_year_id', '=', academicYearId)
            .execute();
          await transaction
            .updateTable('academic_years')
            .set({ status: 'draft', updated_at: now })
            .where('id', '=', academicYearId)
            .execute();
          await transaction
            .updateTable('academic_years')
            .set({ status: 'open', updated_at: now })
            .where('id', '=', previous.academic_year_id)
            .execute();
          await transaction
            .updateTable('academic_year_databases')
            .set({ status: 'active', closed_at: null, updated_at: now })
            .where('academic_year_id', '=', previous.academic_year_id)
            .execute();
        });
        await this.databases.closeSchoolYear(opened.database_name);
        await this.databases.closeSchoolYear(previous.database_name);
        await dropDatabaseIfExists(this.configuration.systemDatabaseUrl, opened.database_name);
        const year = await this.findAcademicYear(academicYearId);
        return {
          id: year.id,
          name: year.name,
          start_date: year.start_date,
          end_date: year.end_date,
          status: year.status,
        };
      } finally {
        await sql`select pg_advisory_unlock(${OPEN_ACADEMIC_YEAR_LOCK})`.execute(connection);
      }
    });
  }

  private async assertCancellable(academicYearId: string) {
    const year = await this.findAcademicYear(academicYearId);
    if (year.status !== 'open') {
      throw ruleViolationError(CANCEL_RULE_CODE, 'Chỉ hủy chuyển hồ sơ của năm học đang dùng');
    }
    const opened = await this.system
      .selectFrom('academic_year_databases')
      .select(['database_name', 'carried_over_at'])
      .where('academic_year_id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    if (!opened.carried_over_at) {
      throw ruleViolationError(
        CANCEL_RULE_CODE,
        'Năm học được mở trước khi có chức năng Hủy nên không kiểm tra được dữ liệu phát sinh; không hủy được',
      );
    }
    const previous = await this.system
      .selectFrom('academic_years')
      .innerJoin('academic_year_databases', 'academic_year_databases.academic_year_id', 'academic_years.id')
      .select(['academic_years.id as academic_year_id', 'academic_years.name', 'academic_year_databases.database_name'])
      .where('academic_years.status', '=', 'closed')
      .where('academic_years.end_date', '<', year.start_date ?? '')
      .orderBy('academic_years.end_date', 'desc')
      .executeTakeFirst();
    if (!previous) {
      throw ruleViolationError(CANCEL_RULE_CODE, 'Không có năm học trước để trở lại; năm học đầu tiên không hủy được');
    }
    const submission = await this.system
      .selectFrom('upper_level_submissions')
      .select('id')
      .where('academic_year_id', '=', academicYearId)
      .executeTakeFirst();
    if (submission) {
      throw ruleViolationError(CANCEL_RULE_CODE, 'Năm học mới đã có biểu mẫu gửi lên cấp trên; không hủy được');
    }
    const changed = await changedTables(
      this.databases.schoolYear<unknown>(opened.database_name),
      opened.carried_over_at,
    );
    if (changed.length > 0) {
      throw ruleViolationError(
        CANCEL_RULE_CODE,
        `Năm học mới đã phát sinh dữ liệu (${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ', …' : ''}); không hủy được`,
      );
    }
    return { opened, previous };
  }
}

// Bảng của năm học mới có dòng thêm hoặc sửa sau giờ chuyển xong hồ sơ (so bằng giờ của máy chủ cơ sở dữ liệu); bảng thay
// đổi cấu trúc của Kysely không tính
async function changedTables(database: Kysely<unknown>, since: Date): Promise<string[]> {
  const columns = await sql<{ table_name: string; column_name: string }>`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and column_name in ('created_at', 'updated_at')
      and table_name not like 'kysely_%'
    order by table_name, column_name`.execute(database);
  const changed: string[] = [];
  for (const { table_name: table, column_name: column } of columns.rows) {
    if (changed.includes(table)) {
      continue;
    }
    const found = await sql<{ found: number }>`
      select 1 as found from ${sql.table(table)} where ${sql.ref(column)} > ${since} limit 1`.execute(database);
    if (found.rows.length > 0) {
      changed.push(table);
    }
  }
  return changed;
}
