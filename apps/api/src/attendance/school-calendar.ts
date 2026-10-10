import { Injectable } from '@nestjs/common';
import { ruleViolationError } from '@school-management/server';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';

// Ngày học theo lịch năm học (BR-91): thuộc học kỳ 1, học kỳ 2 hoặc kỳ hè, là ngày học trong tuần, không thuộc tuần nghỉ.
// Ngày kỳ hè chỉ dành cho trẻ đã đăng ký học hè tháng đó (BR-92, YCTD-50). Ngày nghỉ lễ và ngày nghỉ bù không là ngày học;
// ngày thứ bảy học bù là ngày học của mọi lớp (BR-84, YCTD-59)
export const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

// Ngày của nhân sự khi chấm công và chốt bảng công (YCTD-59): ngày làm việc là các ngày học trong tuần của lịch năm học
// cộng ngày học bù, kể cả kỳ hè và tuần nghỉ của trẻ; ngày lễ và ngày nghỉ bù là ngày nghỉ, nghỉ bù luôn có lương
export type StaffDay =
  | { kind: 'work' }
  | { kind: 'holiday'; name: string; is_paid: boolean }
  | { kind: 'compensatory_day_off' }
  | { kind: 'rest' };

// Thứ trong tuần theo quy ước của lịch năm học: 1 là thứ hai, 7 là chủ nhật
export function dayOfWeek(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

@Injectable()
export class SchoolCalendar {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
  ) {}

  // Trả lý do khi không phải ngày học; trống là ngày học
  async reasonNotSchoolDay(date: string): Promise<string | null> {
    const { academicYearId, database } = await this.currentSchoolYear.require();
    const system = this.databases.system;
    const year = await system
      .selectFrom('academic_years')
      .select('school_days_of_week')
      .where('id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    const term = await system
      .selectFrom('academic_terms')
      .select('term_type')
      .where('academic_year_id', '=', academicYearId)
      .where('start_date', '<=', date)
      .where('end_date', '>=', date)
      .executeTakeFirst();
    if (!term) {
      return 'Ngày này không thuộc học kỳ nào của năm học đang mở';
    }
    const holiday = await database
      .selectFrom('holidays')
      .select('name')
      .where('holiday_date', '=', date)
      .executeTakeFirst();
    if (holiday) {
      return `Ngày này là ngày nghỉ lễ: ${holiday.name}`;
    }
    const change = await database
      .selectFrom('school_day_changes')
      .select('change_type')
      .where('change_date', '=', date)
      .executeTakeFirst();
    if (change?.change_type === 'compensatory_day_off') {
      return 'Ngày này là ngày nghỉ bù';
    }
    if (change?.change_type === 'makeup_school_day') {
      return null;
    }
    if (!year.school_days_of_week.includes(dayOfWeek(date))) {
      return 'Ngày này không phải ngày học trong tuần';
    }
    const week = await system
      .selectFrom('school_weeks')
      .select('is_off')
      .where('academic_year_id', '=', academicYearId)
      .where('start_date', '<=', date)
      .where('end_date', '>=', date)
      .executeTakeFirst();
    if (week?.is_off) {
      return 'Ngày này thuộc tuần nghỉ của lịch năm học';
    }
    return null;
  }

  // Ngày thuộc kỳ hè của năm học đang mở
  async isSummerDay(date: string): Promise<boolean> {
    const { academicYearId } = await this.currentSchoolYear.require();
    const term = await this.databases.system
      .selectFrom('academic_terms')
      .select('term_type')
      .where('academic_year_id', '=', academicYearId)
      .where('start_date', '<=', date)
      .where('end_date', '>=', date)
      .executeTakeFirst();
    return term?.term_type === 'summer_term';
  }

  // Loại ngày của nhân sự cho từng ngày trong khoảng, tính một lần cho cả khoảng
  async staffDays(from: string, to: string): Promise<Map<string, StaffDay>> {
    const { academicYearId, database } = await this.currentSchoolYear.require();
    const year = await this.databases.system
      .selectFrom('academic_years')
      .select('school_days_of_week')
      .where('id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    const holidays = new Map(
      (
        await database
          .selectFrom('holidays')
          .select(['holiday_date', 'name', 'is_paid'])
          .where('holiday_date', '>=', from)
          .where('holiday_date', '<=', to)
          .execute()
      ).map((row) => [row.holiday_date, row]),
    );
    const changes = new Map(
      (
        await database
          .selectFrom('school_day_changes')
          .select(['change_date', 'change_type'])
          .where('change_date', '>=', from)
          .where('change_date', '<=', to)
          .execute()
      ).map((row) => [row.change_date, row.change_type]),
    );
    const days = new Map<string, StaffDay>();
    for (let cursor = Date.parse(`${from}T00:00:00Z`); ; cursor += 86_400_000) {
      const date = new Date(cursor).toISOString().slice(0, 10);
      if (date > to) {
        break;
      }
      const holiday = holidays.get(date);
      const change = changes.get(date);
      if (holiday) {
        days.set(date, { kind: 'holiday', name: holiday.name, is_paid: holiday.is_paid });
      } else if (change === 'compensatory_day_off') {
        days.set(date, { kind: 'compensatory_day_off' });
      } else if (change === 'makeup_school_day' || year.school_days_of_week.includes(dayOfWeek(date))) {
        days.set(date, { kind: 'work' });
      } else {
        days.set(date, { kind: 'rest' });
      }
    }
    return days;
  }

  async assertSchoolDay(date: string): Promise<void> {
    const reason = await this.reasonNotSchoolDay(date);
    if (reason) {
      throw ruleViolationError('BR-91', reason);
    }
  }

  today(now: Date): string {
    return VIETNAM_DATE.format(now);
  }
}
