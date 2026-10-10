import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { Clock, validationError } from '@school-management/server';
import type { Kysely } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { SettingsService } from '../settings/settings.service.js';

// Kỳ đăng ký là một tháng dương lịch thuộc năm học đang mở (GD-24). Ngày chốt là ngày cấu hình của đơn vị trong tháng
// trước kỳ, mặc định ngày 25; sau ngày chốt hoặc khi kế toán đã chốt danh sách kỳ thì đăng ký, hủy là trễ (BR-26, YCTD-49)
export interface Period {
  year: number;
  month: number;
}

export interface PeriodInfo {
  period: string;
  is_summer: boolean;
}

const PERIOD_PATTERN = /^(\d{4})-(\d{2})$/;
const DEFAULT_CLOSING_DAY = 25;

export function parsePeriod(value: unknown, field = 'period'): Period {
  const match = typeof value === 'string' ? PERIOD_PATTERN.exec(value) : null;
  const month = Number(match?.[2]);
  if (!match || month < 1 || month > 12) {
    throw validationError([{ field, message: 'Kỳ dạng YYYY-MM' }]);
  }
  return { year: Number(match[1]), month };
}

export const formatPeriod = (period: Period) => `${period.year}-${String(period.month).padStart(2, '0')}`;

const lastDayOf = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export function periodRange(period: Period): { from: string; to: string } {
  const prefix = formatPeriod(period);
  return { from: `${prefix}-01`, to: `${prefix}-${String(lastDayOf(period.year, period.month)).padStart(2, '0')}` };
}

@Injectable()
export class RegistrationPeriods {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // Các tháng của năm học đang mở, đánh dấu tháng thuộc kỳ hè
  async list(): Promise<PeriodInfo[]> {
    const { academicYearId } = await this.currentSchoolYear.require();
    const terms = await this.databases.system
      .selectFrom('academic_terms')
      .select(['term_type', 'start_date', 'end_date'])
      .where('academic_year_id', '=', academicYearId)
      .orderBy('start_date')
      .execute();
    const first = terms[0];
    const last = terms.at(-1);
    if (!first || !last) {
      return [];
    }
    const summer = terms.find((term) => term.term_type === 'summer_term');
    const periods: PeriodInfo[] = [];
    let cursor = { year: Number(first.start_date.slice(0, 4)), month: Number(first.start_date.slice(5, 7)) };
    const end = last.end_date.slice(0, 7);
    while (formatPeriod(cursor) <= end) {
      const { from, to } = periodRange(cursor);
      // Tháng hè là tháng có ngày của kỳ hè và không có ngày của học kỳ 1, học kỳ 2
      const overlaps = (term: { start_date: string; end_date: string }) =>
        term.start_date <= to && term.end_date >= from;
      const isSummer =
        summer !== undefined &&
        overlaps(summer) &&
        !terms.some((term) => term.term_type !== 'summer_term' && overlaps(term));
      periods.push({ period: formatPeriod(cursor), is_summer: isSummer });
      cursor =
        cursor.month === 12 ? { year: cursor.year + 1, month: 1 } : { year: cursor.year, month: cursor.month + 1 };
    }
    return periods;
  }

  // Kỳ phải thuộc năm học đang mở
  async require(period: Period): Promise<PeriodInfo> {
    const info = (await this.list()).find((item) => item.period === formatPeriod(period));
    if (!info) {
      throw validationError([{ field: 'period', message: 'Kỳ không thuộc năm học đang mở' }]);
    }
    return info;
  }

  async closingDate(orgUnitId: string, period: Period): Promise<string> {
    const setting = (await this.settings.effective(orgUnitId)).find(
      (item) => item.key === 'service_registration_closing_day',
    );
    const previous =
      period.month === 1 ? { year: period.year - 1, month: 12 } : { year: period.year, month: period.month - 1 };
    const lastDay = lastDayOf(previous.year, previous.month);
    const day = setting?.value === 'last' ? lastDay : Math.min(Number(setting?.value ?? DEFAULT_CLOSING_DAY), lastDay);
    return `${formatPeriod(previous)}-${String(day).padStart(2, '0')}`;
  }

  // Đơn vị bật chặn đăng ký thêm dịch vụ khi trẻ còn nợ quá hạn (BR-33)
  async blocksWhenOverdue(orgUnitId: string): Promise<boolean> {
    const setting = (await this.settings.effective(orgUnitId)).find(
      (item) => item.key === 'block_service_registration_when_overdue',
    );
    return setting?.value === true;
  }

  async isLocked(database: Kysely<SchoolYearDatabase>, orgUnitId: string, period: Period): Promise<boolean> {
    const row = await database
      .selectFrom('registration_periods')
      .select('status')
      .where('org_unit_id', '=', orgUnitId)
      .where('period_year', '=', period.year)
      .where('period_month', '=', period.month)
      .executeTakeFirst();
    return row?.status === 'locked';
  }

  // Thông tin kỳ của một đơn vị: ngày chốt, đã chốt danh sách chưa, đang là thời gian trễ chưa
  async state(database: Kysely<SchoolYearDatabase>, orgUnitId: string, period: Period) {
    const info = await this.require(period);
    const closingDate = await this.closingDate(orgUnitId, period);
    const locked = await this.isLocked(database, orgUnitId, period);
    return {
      period: info.period,
      is_summer: info.is_summer,
      closing_date: closingDate,
      is_locked: locked,
      is_late: locked || this.today() > closingDate,
    };
  }
}
