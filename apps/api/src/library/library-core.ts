import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { Clock, ruleViolationError, validationError } from '@school-management/server';
import type { SchoolLevelCode } from '@school-management/shared';
import { sql, type Kysely, type Transaction } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { notFoundError } from '../common/request-fields.js';
import { cardNumber, copyNumber, LIBRARY_RULE_CODE } from './library-calc.js';

export type LibraryExecutor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export interface LibrarySettings {
  student_levels: SchoolLevelCode[];
  hold_days: number;
}

export interface LoanRule {
  reader_kind: 'staff' | 'student';
  max_items: number;
  loan_days: number;
  max_renewals: number;
  fine_per_day: number;
}

// Phần dùng chung của thư viện: năm học đang dùng, ngày hôm nay, thiết lập, bộ đếm số đăng ký cá biệt và số thẻ
@Injectable()
export class LibraryCore {
  constructor(
    readonly currentSchoolYear: CurrentSchoolYearResolver,
    readonly clock: Clock,
    private readonly databases: Databases,
  ) {}

  today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  async database() {
    return (await this.currentSchoolYear.require()).database;
  }

  async settings(executor?: LibraryExecutor): Promise<LibrarySettings> {
    const database = executor ?? (await this.database());
    const row = await database
      .selectFrom('library_settings')
      .select(['student_levels', 'hold_days'])
      .executeTakeFirst();
    return row ?? { student_levels: ['TH', 'THCS', 'THPT'], hold_days: 3 };
  }

  async rules(executor?: LibraryExecutor): Promise<LoanRule[]> {
    const database = executor ?? (await this.database());
    return database
      .selectFrom('library_loan_rules')
      .select(['reader_kind', 'max_items', 'loan_days', 'max_renewals', 'fine_per_day'])
      .orderBy('reader_kind', 'desc')
      .execute();
  }

  async rule(executor: LibraryExecutor, kind: 'staff' | 'student'): Promise<LoanRule> {
    const rule = (await this.rules(executor)).find((item) => item.reader_kind === kind);
    if (!rule) {
      throw ruleViolationError(LIBRARY_RULE_CODE, 'Chưa có quy định mượn cho loại bạn đọc này');
    }
    return rule;
  }

  // Cấp số từ bộ đếm (nguyên tử trong giao dịch); trả về dãy số vừa cấp
  private async reserve(executor: LibraryExecutor, name: string, count: number): Promise<number[]> {
    const row = await executor
      .insertInto('library_counters')
      .values({ name, value: count })
      .onConflict((conflict) => conflict.column('name').doUpdateSet({ value: sql`library_counters.value + ${count}` }))
      .returning('value')
      .executeTakeFirstOrThrow();
    return Array.from({ length: count }, (_, index) => row.value - count + index + 1);
  }

  async nextCopyNumbers(executor: LibraryExecutor, count: number): Promise<string[]> {
    return (await this.reserve(executor, 'copy', count)).map(copyNumber);
  }

  async nextCardNumbers(executor: LibraryExecutor, count: number): Promise<string[]> {
    return (await this.reserve(executor, 'card', count)).map(cardNumber);
  }

  // Ngày kết thúc của năm học đang dùng (hạn trả sách giáo khoa cấp đầu năm); chưa khai báo thì để trống
  async academicYearEnd(): Promise<string | null> {
    const year = await this.currentSchoolYear.require();
    const row = await this.databases.system
      .selectFrom('academic_years')
      .select('end_date')
      .where('id', '=', year.academicYearId)
      .executeTakeFirst();
    return row?.end_date ?? null;
  }

  async findTitle(executor: LibraryExecutor, titleId: string) {
    const title = await executor
      .selectFrom('library_titles')
      .select(['id', 'title', 'category_id', 'status', 'grade_level', 'shelf'])
      .where('id', '=', titleId)
      .executeTakeFirst();
    if (!title) {
      throw notFoundError('Không tìm thấy ấn phẩm', 'library_title');
    }
    return title;
  }

  assertDate(value: unknown, field: string): string {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    ) {
      throw validationError([{ field, message: 'Ngày theo dạng YYYY-MM-DD' }]);
    }
    return value;
  }
}
