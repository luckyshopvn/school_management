import { Controller, Get, Injectable, Query } from '@nestjs/common';
import type { ProfessionalLevel, ProfessionalStandardType } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import { matchStaffCatalog, PERMISSION_CODES, STAFF_CATALOGS, type StaffCatalogKey } from '@school-management/shared';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { PROFESSIONAL_LEVELS } from '../professional-standards/standard-rating.js';
import { optionalUuid, type QueryValues } from '../reports/report-filters.js';
import { ReportsService } from '../reports/reports.service.js';
import { NOT_ENTERED, percentOf, profileText } from './statistics-calc.js';

// 5.2 Thống kê nhân sự theo hệ thống của Sở (DT-16 phần 16f): theo trình độ đào tạo, vị trí việc làm, hình thức hợp đồng,
// nhóm chức vụ, mỗi phần đủ các dòng của danh mục Bộ (kể cả dòng 0), giá trị chữ tự do cũ ngoài danh mục ghi thêm dòng
// riêng, chưa nhập gom vào "Chưa nhập"; theo chuẩn nghề nghiệp cán bộ quản lý (chuẩn hiệu trưởng) và giáo viên: số phiếu đã
// chốt theo mức của từng tiêu chí và xếp loại chung. Nhân sự là nhân sự đang làm việc trong phạm vi quyền
// P17.staff-statistics.view. Vị trí việc làm trống thì lấy chức danh của trường, hình thức hợp đồng trống thì lấy loại hợp
// đồng lao động đang hiệu lực (như 5.2 trước đây)
const CONTRACT_TYPE_LABELS: Record<string, string> = {
  probation: 'Thử việc',
  fixed_term: 'Hợp đồng lao động có thời hạn',
  indefinite: 'Hợp đồng lao động không thời hạn',
};
const NO_ID = '00000000-0000-0000-0000-000000000000';

export interface CatalogCount {
  value: string;
  in_catalog: boolean;
  count: number;
  female: number;
  percent: number;
}

// Đếm theo danh mục của Bộ: đủ mục của danh mục theo thứ tự, rồi giá trị ngoài danh mục, cuối cùng "Chưa nhập"
export function catalogBreakdown<T extends { gender: string | null }>(
  rows: T[],
  key: StaffCatalogKey,
  valueOf: (row: T) => string | null,
): CatalogCount[] {
  const counts = new Map<string, { count: number; female: number; inCatalog: boolean }>();
  for (const item of STAFF_CATALOGS[key].items) {
    counts.set(item, { count: 0, female: 0, inCatalog: true });
  }
  const others = new Map<string, { count: number; female: number; inCatalog: boolean }>();
  for (const row of rows) {
    const raw = valueOf(row)?.trim() || null;
    const matched = matchStaffCatalog(key, raw);
    const target = matched ? counts : others;
    const name = matched ?? raw ?? NOT_ENTERED;
    const entry = target.get(name) ?? { count: 0, female: 0, inCatalog: false };
    entry.count += 1;
    entry.female += row.gender === 'female' ? 1 : 0;
    target.set(name, entry);
  }
  const otherEntries = [...others.entries()].sort((a, b) =>
    a[0] === NOT_ENTERED ? 1 : b[0] === NOT_ENTERED ? -1 : a[0].localeCompare(b[0], 'vi'),
  );
  return [...counts.entries(), ...otherEntries].map(([value, entry]) => ({
    value,
    in_catalog: entry.inCatalog,
    count: entry.count,
    female: entry.female,
    percent: percentOf(entry.count, rows.length),
  }));
}

type LevelCounts = Record<ProfessionalLevel, number>;
const emptyLevels = (): LevelCounts => ({ not_met: 0, met: 0, good: 0, excellent: 0 });

@Injectable()
export class StaffStatisticsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly reports: ReportsService,
  ) {}

  async build(currentUser: CurrentUser, orgUnitId: string | null) {
    const scope = await this.reports.unitScope(currentUser, PERMISSION_CODES.staffStatisticsView, orgUnitId, false);
    const { database } = await this.currentSchoolYear.require();
    const units = scope.orgUnitIds.length > 0 ? scope.orgUnitIds : [NO_ID];
    const staff = await database
      .selectFrom('staff')
      .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id')
      .select(['staff.id', 'staff.gender', 'staff.moet_profile', 'job_titles.name as job_title_name'])
      .where('staff.status', '=', 'active')
      .where('staff.org_unit_id', 'in', units)
      .execute();
    const contracts = await database
      .selectFrom('employment_contracts')
      .select(['staff_id', 'contract_type'])
      .where('status', '=', 'active')
      .where('staff_id', 'in', staff.length > 0 ? staff.map((row) => row.id) : [NO_ID])
      .orderBy('start_date', 'desc')
      .execute();
    const contractOf = new Map<string, string>();
    for (const contract of contracts) {
      if (!contractOf.has(contract.staff_id)) {
        contractOf.set(contract.staff_id, contract.contract_type);
      }
    }
    const text = (row: (typeof staff)[number], key: string) => profileText(row.moet_profile, key);
    return {
      totals: { staff_count: staff.length, female_count: staff.filter((row) => row.gender === 'female').length },
      by_qualification: catalogBreakdown(staff, 'professional_qualification', (row) =>
        text(row, 'professional_qualification'),
      ),
      by_job_position: catalogBreakdown(staff, 'job_position', (row) => text(row, 'job_position') ?? row.job_title_name),
      by_contract_form: catalogBreakdown(staff, 'contract_form', (row) => {
        const contractType = contractOf.get(row.id);
        return text(row, 'contract_form') ?? (contractType ? (CONTRACT_TYPE_LABELS[contractType] ?? contractType) : null);
      }),
      by_position_group: catalogBreakdown(staff, 'position_group', (row) => text(row, 'position_group')),
      standards: await this.standards(units),
    };
  }

  // Chuẩn nghề nghiệp: phiếu đã chốt của nhân sự đang làm việc theo từng tiêu chí (mức của người đánh giá) và xếp loại chung
  private async standards(units: string[]) {
    const { database } = await this.currentSchoolYear.require();
    const evaluations = await database
      .selectFrom('professional_evaluations')
      .innerJoin('staff', 'staff.id', 'professional_evaluations.staff_id')
      .select([
        'professional_evaluations.id',
        'professional_evaluations.standard_type',
        'professional_evaluations.status',
        'professional_evaluations.overall_level',
      ])
      .where('professional_evaluations.org_unit_id', 'in', units)
      .where('staff.status', '=', 'active')
      .execute();
    const finalized = evaluations.filter((row) => row.status === 'finalized');
    const items =
      finalized.length === 0
        ? []
        : await database
            .selectFrom('professional_evaluation_items')
            .select([
              'evaluation_id',
              'standard_code',
              'standard_name',
              'criterion_code',
              'criterion_name',
              'order_no',
              'assessor_rating',
            ])
            .where(
              'evaluation_id',
              'in',
              finalized.map((row) => row.id),
            )
            .orderBy('order_no')
            .execute();
    const typeOf = new Map(finalized.map((row) => [row.id, row.standard_type]));
    return (['principal', 'teacher'] as ProfessionalStandardType[]).map((standardType) => {
      const own = finalized.filter((row) => row.standard_type === standardType);
      const overall = emptyLevels();
      for (const row of own) {
        if (row.overall_level) {
          overall[row.overall_level] += 1;
        }
      }
      const criteria = new Map<
        string,
        { standard_code: string; standard_name: string; code: string; name: string; order: number; levels: LevelCounts }
      >();
      for (const item of items.filter((entry) => typeOf.get(entry.evaluation_id) === standardType)) {
        const entry = criteria.get(item.criterion_code) ?? {
          standard_code: item.standard_code,
          standard_name: item.standard_name,
          code: item.criterion_code,
          name: item.criterion_name,
          order: item.order_no,
          levels: emptyLevels(),
        };
        if (item.assessor_rating) {
          entry.levels[item.assessor_rating] += 1;
        }
        criteria.set(item.criterion_code, entry);
      }
      return {
        standard_type: standardType,
        evaluations: evaluations.filter((row) => row.standard_type === standardType).length,
        finalized: own.length,
        overall,
        overall_rates: Object.fromEntries(
          PROFESSIONAL_LEVELS.map((level) => [level, percentOf(overall[level], own.length)]),
        ) as LevelCounts,
        criteria: [...criteria.values()]
          .sort((a, b) => a.order - b.order)
          .map(({ order: _order, ...criterion }) => criterion),
      };
    });
  }
}

@Controller('statistics')
export class StaffStatisticsController {
  constructor(private readonly statistics: StaffStatisticsService) {}

  @Get('staff-so')
  @RequirePermission(PERMISSION_CODES.staffStatisticsView)
  staff(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = optionalUuid(query, 'org_unit_id', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.statistics.build(currentUser, orgUnitId);
  }
}
