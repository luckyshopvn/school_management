import { Injectable } from '@nestjs/common';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import type { TermRange } from './student-health-calc.js';

const dateText = (value: unknown) =>
  value instanceof Date ? VIETNAM_DATE.format(value) : String(value ?? '').slice(0, 10);

// Học kỳ của năm học đang dùng theo lịch năm học (academic_terms), dùng cho sức khỏe học sinh theo học kỳ, tổng hợp cân đo
// theo học kỳ và thống kê học sinh (DT-16 phần 16h)
@Injectable()
export class SchoolTerms {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
  ) {}

  async ranges(): Promise<TermRange[]> {
    const { academicYearId } = await this.currentSchoolYear.require();
    const rows = await this.databases.system
      .selectFrom('academic_terms')
      .select(['term_type', 'start_date', 'end_date'])
      .where('academic_year_id', '=', academicYearId)
      .execute();
    return rows.map((row) => ({
      term_type: row.term_type,
      start_date: dateText(row.start_date),
      end_date: dateText(row.end_date),
    }));
  }
}
