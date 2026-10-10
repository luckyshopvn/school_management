import { Injectable } from '@nestjs/common';
import { ruleViolationError } from '@school-management/server';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';

// Ngày học theo lịch năm học (BR-91): thuộc học kỳ 1 hoặc 2, là ngày học trong tuần, không thuộc tuần nghỉ.
// Kỳ hè chưa có bảng điểm danh cho tới khi có đăng ký học hè P05-13; ngày học bù thứ bảy chờ P08-10 (YCTD-47)
export const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

// Thứ trong tuần theo quy ước của lịch năm học: 1 là thứ hai, 7 là chủ nhật
function dayOfWeek(date: string): number {
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
    const { academicYearId } = await this.currentSchoolYear.require();
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
    if (term.term_type === 'summer_term') {
      return 'Kỳ hè chưa có bảng điểm danh vì chưa có đăng ký học hè (P05-13)';
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
