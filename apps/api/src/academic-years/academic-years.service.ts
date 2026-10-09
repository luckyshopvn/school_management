import { Inject, Injectable } from '@nestjs/common';
import {
  createEmptyDatabase,
  dropDatabaseIfExists,
  makeDatabaseReadOnly,
  migrateToLatest,
  type AcademicTermType,
} from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { sql } from 'kysely';
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
        .select(['start_date', 'is_off', 'note'])
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
            created_by: actorUserId,
          })
          .execute();
      }
    });
    return this.readCalendar(academicYearId);
  }

  async listWeeks(academicYearId: string): Promise<WeekResponse[]> {
    await this.findAcademicYear(academicYearId);
    return this.system
      .selectFrom('school_weeks')
      .select(['week_no', 'start_date', 'end_date', 'is_off', 'note'])
      .where('academic_year_id', '=', academicYearId)
      .orderBy('week_no')
      .execute();
  }

  // Đánh dấu hoặc bỏ đánh dấu tuần nghỉ; số tuần không đổi (BR-91)
  async updateWeeks(
    academicYearId: string,
    changes: Array<{ week_no: number; is_off: boolean; note: string | null }>,
  ): Promise<WeekResponse[]> {
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
          .set({ is_off: change.is_off, note: change.note, updated_at: now })
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
}
