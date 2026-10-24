import { Controller, Get, Injectable, Param, Query, Req, Res } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import {
  COMPLETION_OUTCOME_LABELS,
  PERMISSION_CODES,
  YEAR_RESULT_LABELS,
  type CompletionOutcome,
  type YearResultCode,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid } from '../common/request-fields.js';
import { readTableFileFormat } from '../exports/table-file.js';
import {
  buildFacilitiesWorkbook,
  fileStamp,
  sendWorkbook,
  type WorkbookSheet,
} from '../facilities/facilities-workbook.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { loadPrimaryFacts, type PrimaryClassRow, type PrimaryStudentRow } from './primary-facts.js';

// Báo cáo, thống kê Tiểu học (DT-20 phần 20f, YCTD-165): sĩ số theo khối (lớp, học sinh, nữ, dân tộc thiểu số, khuyết tật,
// học 2 buổi/ngày, bán trú); kết quả đánh giá định kỳ theo lớp, khối, trường (mức đạt từng môn, điểm kiểm tra theo khoảng,
// phẩm chất, năng lực; 20c); kết quả cuối năm, hoàn thành chương trình, khen thưởng (20c, 20e); chuyên cần theo tiết (20d) và
// bán trú (20b) theo lớp trong khoảng ngày. Mỗi báo cáo xuất Excel hoặc PDF (ghi nhật ký xuất). Phạm vi: các đơn vị người
// dùng được xem thống kê học sinh (chọn một đơn vị thì chỉ đơn vị đó). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
const STATISTICS = PERMISSION_CODES.childStatisticsView;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
type Group = 'class' | 'grade' | 'school';
const GROUPS: Group[] = ['class', 'grade', 'school'];
const SCORE_BANDS = [
  { key: '9-10', from: 9, to: 10 },
  { key: '7-8', from: 7, to: 8 },
  { key: '5-6', from: 5, to: 6 },
  { key: 'duoi-5', from: 1, to: 4 },
];

function readGroup(value: unknown, errors: FieldError[]): Group {
  if (value === undefined || value === '') {
    return 'grade';
  }
  if (!GROUPS.includes(value as Group)) {
    errors.push({ field: 'group', message: 'Gộp theo class, grade hoặc school' });
  }
  return value as Group;
}

function readDate(value: unknown, field: string, errors: FieldError[]): string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
    return '';
  }
  return value;
}

function throwIf(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

@Injectable()
export class PrimaryReportsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  // Đơn vị trong phạm vi: chọn một đơn vị thì kiểm quyền đơn vị đó; không chọn thì toàn trường hoặc các đơn vị được gán
  async scope(currentUser: CurrentUser, orgUnitId: string | null): Promise<string[] | null> {
    if (orgUnitId) {
      await this.organizationScopes.assertCanAccess(currentUser, STATISTICS, orgUnitId);
      return [orgUnitId];
    }
    const scope = await this.organizationScopes.resolve(currentUser, STATISTICS);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được thống kê học sinh');
    }
    return scope.wholeSchool ? null : scope.orgUnitIds;
  }

  private async gradeNames(database: Kysely<SchoolYearDatabase>) {
    const rows = await database
      .selectFrom('grade_levels')
      .select(['code', 'name', 'order_no'])
      .where('school_level', '=', 'TH')
      .execute();
    return new Map(rows.map((row) => [row.code, row]));
  }

  private groupOf(
    group: Group,
    classRow: PrimaryClassRow | undefined,
    grades: Map<string, { name: string; order_no: number }>,
  ): { key: string; label: string; order: string } {
    if (group === 'school') {
      return { key: 'school', label: 'Toàn trường', order: '0' };
    }
    const grade = classRow?.grade ?? '';
    const gradeName = grades.get(grade)?.name ?? grade;
    const gradeOrder = String(grades.get(grade)?.order_no ?? 0).padStart(4, '0');
    if (group === 'grade') {
      return { key: grade, label: gradeName, order: gradeOrder };
    }
    return {
      key: classRow?.id ?? '',
      label: `${classRow?.name ?? ''} (${gradeName})`,
      order: `${gradeOrder}:${classRow?.name}`,
    };
  }

  // Sĩ số theo khối
  async enrollment(currentUser: CurrentUser, orgUnitId: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const facts = await loadPrimaryFacts(database, await this.scope(currentUser, orgUnitId));
    const grades = await this.gradeNames(database);
    const codes = [...new Set(facts.classes.map((row) => row.grade))].sort(
      (left, right) => (grades.get(left)?.order_no ?? 0) - (grades.get(right)?.order_no ?? 0),
    );
    const row = (label: string, classes: PrimaryClassRow[], students: PrimaryStudentRow[]) => ({
      label,
      classes: classes.length,
      two_sessions_classes: classes.filter((item) => item.two_sessions).length,
      boarding_classes: classes.filter((item) => item.boarding).length,
      students: students.length,
      female: students.filter((item) => item.female).length,
      ethnic: students.filter((item) => item.ethnic).length,
      disabled: students.filter((item) => item.disabled).length,
      two_sessions_students: students.filter((item) => item.two_sessions).length,
      boarding_students: students.filter((item) => item.boarding).length,
    });
    return {
      rows: codes.map((code) =>
        row(
          grades.get(code)?.name ?? code,
          facts.classes.filter((item) => item.grade === code),
          facts.students.filter((item) => item.grade === code),
        ),
      ),
      totals: row('Toàn trường', facts.classes, facts.students),
    };
  }

  // Kết quả đánh giá định kỳ của kỳ theo lớp, khối hoặc toàn trường
  async assessments(currentUser: CurrentUser, filter: { orgUnitId: string | null; periodId: string; group: Group }) {
    const { database } = await this.currentSchoolYear.require();
    const facts = await loadPrimaryFacts(database, await this.scope(currentUser, filter.orgUnitId));
    const period = await database
      .selectFrom('assessment_periods')
      .select(['id', 'name'])
      .where('id', '=', filter.periodId)
      .where('school_level', '=', 'TH')
      .executeTakeFirst();
    if (!period) {
      throw validationError([{ field: 'period_id', message: 'Không có kỳ đánh giá Tiểu học này' }]);
    }
    const classIds = facts.classes.map((row) => row.id);
    const [levels, subjectRows, competencyRows] = await Promise.all([
      database
        .selectFrom('assessment_levels')
        .select(['scale', 'code', 'name', 'rank'])
        .where('school_level', '=', 'TH')
        .orderBy('rank')
        .execute(),
      classIds.length === 0
        ? []
        : database
            .selectFrom('subject_results')
            .innerJoin('subjects', 'subjects.id', 'subject_results.subject_id')
            .select([
              'subject_results.class_id',
              'subject_results.child_id',
              'subjects.name as subject_name',
              'subjects.order_no',
              'subject_results.level_code',
              'subject_results.score',
            ])
            .where('subject_results.period_id', '=', filter.periodId)
            .where('subject_results.class_id', 'in', classIds)
            .execute(),
      classIds.length === 0
        ? []
        : database
            .selectFrom('competency_results')
            .innerJoin('competency_items', 'competency_items.id', 'competency_results.item_id')
            .select([
              'competency_results.class_id',
              'competency_results.child_id',
              'competency_items.name as item_name',
              'competency_items.order_no',
              'competency_results.level_code',
            ])
            .where('competency_results.period_id', '=', filter.periodId)
            .where('competency_results.class_id', 'in', classIds)
            .execute(),
    ]);
    const grades = await this.gradeNames(database);
    const classById = new Map(facts.classes.map((row) => [row.id, row]));
    const enrolled = new Set(facts.students.map((row) => `${row.class_id}:${row.id}`));
    const groups = new Map<string, { label: string; order: string; students: number }>();
    for (const student of facts.students) {
      const group = this.groupOf(filter.group, classById.get(student.class_id), grades);
      const current = groups.get(group.key) ?? { label: group.label, order: group.order, students: 0 };
      current.students += 1;
      groups.set(group.key, current);
    }
    const subjectLevels = levels.filter((level) => level.scale === 'subject');
    const competencyLevels = levels.filter((level) => level.scale === 'competency');
    const subjectStats = new Map<string, Record<string, number | string>>();
    for (const row of subjectRows) {
      if (!enrolled.has(`${row.class_id}:${row.child_id}`)) {
        continue;
      }
      const group = this.groupOf(filter.group, classById.get(row.class_id), grades);
      const mapKey = `${group.key}|${row.subject_name}`;
      const stat = subjectStats.get(mapKey) ?? {
        group_key: group.key,
        group_label: group.label,
        order: `${group.order}|${String(row.order_no).padStart(4, '0')}`,
        subject_name: row.subject_name,
        ...Object.fromEntries(subjectLevels.map((level) => [`level_${level.code}`, 0])),
        ...Object.fromEntries(SCORE_BANDS.map((band) => [`score_${band.key}`, 0])),
      };
      if (row.level_code && stat[`level_${row.level_code}`] !== undefined) {
        stat[`level_${row.level_code}`] = Number(stat[`level_${row.level_code}`]) + 1;
      }
      const band = SCORE_BANDS.find((item) => row.score !== null && row.score >= item.from && row.score <= item.to);
      if (band) {
        stat[`score_${band.key}`] = Number(stat[`score_${band.key}`]) + 1;
      }
      subjectStats.set(mapKey, stat);
    }
    const competencyStats = new Map<string, Record<string, number | string>>();
    for (const row of competencyRows) {
      if (!enrolled.has(`${row.class_id}:${row.child_id}`)) {
        continue;
      }
      const group = this.groupOf(filter.group, classById.get(row.class_id), grades);
      const mapKey = `${group.key}|${row.item_name}`;
      const stat = competencyStats.get(mapKey) ?? {
        group_key: group.key,
        group_label: group.label,
        order: `${group.order}|${String(row.order_no).padStart(4, '0')}`,
        item_name: row.item_name,
        ...Object.fromEntries(competencyLevels.map((level) => [`level_${level.code}`, 0])),
      };
      if (row.level_code && stat[`level_${row.level_code}`] !== undefined) {
        stat[`level_${row.level_code}`] = Number(stat[`level_${row.level_code}`]) + 1;
      }
      competencyStats.set(mapKey, stat);
    }
    const sorted = (map: Map<string, Record<string, number | string>>) =>
      [...map.values()].sort((left, right) => String(left.order).localeCompare(String(right.order), 'vi'));
    return {
      period,
      group: filter.group,
      levels,
      groups: [...groups.entries()]
        .sort((left, right) => left[1].order.localeCompare(right[1].order, 'vi'))
        .map(([key, value]) => ({ key, label: value.label, students: value.students })),
      subjects: sorted(subjectStats),
      competencies: sorted(competencyStats),
    };
  }

  // Kết quả cuối năm, hoàn thành chương trình, khen thưởng theo lớp, khối hoặc toàn trường
  async yearEnd(currentUser: CurrentUser, filter: { orgUnitId: string | null; group: Group }) {
    const { database } = await this.currentSchoolYear.require();
    const facts = await loadPrimaryFacts(database, await this.scope(currentUser, filter.orgUnitId));
    const grades = await this.gradeNames(database);
    const classById = new Map(facts.classes.map((row) => [row.id, row]));
    const groups = new Map<string, { label: string; order: string; students: PrimaryStudentRow[] }>();
    for (const student of facts.students) {
      const group = this.groupOf(filter.group, classById.get(student.class_id), grades);
      const current = groups.get(group.key) ?? { label: group.label, order: group.order, students: [] };
      current.students.push(student);
      groups.set(group.key, current);
    }
    const yearResults = Object.keys(YEAR_RESULT_LABELS) as YearResultCode[];
    const outcomes = Object.keys(COMPLETION_OUTCOME_LABELS) as CompletionOutcome[];
    return {
      group: filter.group,
      rows: [...groups.values()]
        .sort((left, right) => left.order.localeCompare(right.order, 'vi'))
        .map((group) => ({
          label: group.label,
          students: group.students.length,
          ...Object.fromEntries(
            yearResults.map((code) => [code, group.students.filter((row) => row.year_result === code).length]),
          ),
          not_confirmed: group.students.filter((row) => row.year_result === null).length,
          ...Object.fromEntries(
            outcomes.map((code) => [code, group.students.filter((row) => row.completion === code).length]),
          ),
          awarded: group.students.filter((row) => row.awarded).length,
        })),
    };
  }

  // Chuyên cần theo tiết (20d) và bán trú (20b) theo lớp trong khoảng ngày
  async attendance(currentUser: CurrentUser, filter: { orgUnitId: string | null; from: string; to: string }) {
    const { database } = await this.currentSchoolYear.require();
    const facts = await loadPrimaryFacts(database, await this.scope(currentUser, filter.orgUnitId));
    const classIds = facts.classes.map((row) => row.id);
    const [attendance, lessons, mealDays, cuts] =
      classIds.length === 0
        ? [[], [], [], []]
        : await Promise.all([
            database
              .selectFrom('period_attendance')
              .innerJoin('class_logs', 'class_logs.id', 'period_attendance.class_log_id')
              .select(['class_logs.class_id', 'period_attendance.status'])
              .select((expression) => expression.fn.countAll<string>().as('count'))
              .where('class_logs.class_id', 'in', classIds)
              .where('class_logs.lesson_date', '>=', filter.from)
              .where('class_logs.lesson_date', '<=', filter.to)
              .groupBy(['class_logs.class_id', 'period_attendance.status'])
              .execute(),
            database
              .selectFrom('class_logs')
              .select('class_id')
              .select((expression) => expression.fn.countAll<string>().as('count'))
              .where('class_id', 'in', classIds)
              .where('lesson_date', '>=', filter.from)
              .where('lesson_date', '<=', filter.to)
              .groupBy('class_id')
              .execute(),
            database
              .selectFrom('boarding_meal_days')
              .select(['class_id', 'headcount'])
              .where('class_id', 'in', classIds)
              .where('status', '=', 'closed')
              .where('meal_date', '>=', filter.from)
              .where('meal_date', '<=', filter.to)
              .execute(),
            database
              .selectFrom('boarding_meal_cuts')
              .select('class_id')
              .select((expression) => expression.fn.countAll<string>().as('count'))
              .where('class_id', 'in', classIds)
              .where('meal_date', '>=', filter.from)
              .where('meal_date', '<=', filter.to)
              .groupBy('class_id')
              .execute(),
          ]);
    const count = (rows: Array<{ class_id: string; count: string }>, classId: string) =>
      Number(rows.find((row) => row.class_id === classId)?.count ?? 0);
    const statusCount = (classId: string, status: string) =>
      Number(attendance.find((row) => row.class_id === classId && row.status === status)?.count ?? 0);
    const rows = facts.classes.map((classRow) => {
      const days = mealDays.filter((row) => row.class_id === classRow.id);
      return {
        class_name: classRow.name,
        students: facts.students.filter((row) => row.class_id === classRow.id).length,
        lessons: count(lessons, classRow.id),
        present: statusCount(classRow.id, 'present'),
        late: statusCount(classRow.id, 'late'),
        absent_excused: statusCount(classRow.id, 'absent_excused'),
        absent_unexcused: statusCount(classRow.id, 'absent_unexcused'),
        meal_days: days.length,
        meals: days.reduce((sum, row) => sum + row.headcount, 0),
        meal_cuts: count(cuts, classRow.id),
      };
    });
    const total = (key: keyof (typeof rows)[number]) => rows.reduce((sum, row) => sum + Number(row[key]), 0);
    return {
      from: filter.from,
      to: filter.to,
      rows,
      totals: {
        class_name: 'Toàn trường',
        students: total('students'),
        lessons: total('lessons'),
        present: total('present'),
        late: total('late'),
        absent_excused: total('absent_excused'),
        absent_unexcused: total('absent_unexcused'),
        meal_days: total('meal_days'),
        meals: total('meals'),
        meal_cuts: total('meal_cuts'),
      },
    };
  }

  // Bảng xuất tệp của từng báo cáo
  async sheets(currentUser: CurrentUser, report: string, query: Record<string, string | undefined>) {
    const orgUnitId = query.org_unit_id || null;
    const errors: FieldError[] = [];
    if (orgUnitId && !isUuid(orgUnitId)) {
      errors.push({ field: 'org_unit_id', message: 'Mã đơn vị không hợp lệ' });
    }
    if (report === 'enrollment') {
      throwIf(errors);
      const data = await this.enrollment(currentUser, orgUnitId);
      return {
        title: 'Thống kê sĩ số Tiểu học',
        sheets: [
          {
            title: 'Sĩ số theo khối',
            columns: [
              { key: 'label', label: 'Khối', width: 18 },
              { key: 'classes', label: 'Số lớp', width: 10 },
              { key: 'two_sessions_classes', label: 'Lớp 2 buổi/ngày', width: 14 },
              { key: 'boarding_classes', label: 'Lớp có bán trú', width: 14 },
              { key: 'students', label: 'Học sinh', width: 10 },
              { key: 'female', label: 'Nữ', width: 8 },
              { key: 'ethnic', label: 'Dân tộc thiểu số', width: 14 },
              { key: 'disabled', label: 'Khuyết tật', width: 10 },
              { key: 'two_sessions_students', label: 'Học 2 buổi/ngày', width: 14 },
              { key: 'boarding_students', label: 'Bán trú', width: 10 },
            ],
            rows: [...data.rows, data.totals],
          },
        ] satisfies WorkbookSheet[],
      };
    }
    if (report === 'assessments') {
      const group = readGroup(query.group, errors);
      if (!isUuid(query.period_id)) {
        errors.push({ field: 'period_id', message: 'Bắt buộc chọn kỳ đánh giá' });
      }
      throwIf(errors);
      const data = await this.assessments(currentUser, { orgUnitId, periodId: String(query.period_id), group });
      const subjectLevels = data.levels.filter((level) => level.scale === 'subject');
      const competencyLevels = data.levels.filter((level) => level.scale === 'competency');
      return {
        title: `Kết quả đánh giá ${data.period.name}`,
        sheets: [
          {
            title: 'Môn học',
            columns: [
              { key: 'group_label', label: 'Lớp, khối', width: 20 },
              { key: 'subject_name', label: 'Môn học, hoạt động', width: 24 },
              ...subjectLevels.map((level) => ({ key: `level_${level.code}`, label: level.name, width: 14 })),
              ...SCORE_BANDS.map((band) => ({ key: `score_${band.key}`, label: `Điểm ${band.key}`, width: 10 })),
            ],
            rows: data.subjects,
          },
          {
            title: 'Phẩm chất, năng lực',
            columns: [
              { key: 'group_label', label: 'Lớp, khối', width: 20 },
              { key: 'item_name', label: 'Phẩm chất, năng lực', width: 24 },
              ...competencyLevels.map((level) => ({ key: `level_${level.code}`, label: level.name, width: 14 })),
            ],
            rows: data.competencies,
          },
        ] satisfies WorkbookSheet[],
      };
    }
    if (report === 'year-end') {
      const group = readGroup(query.group, errors);
      throwIf(errors);
      const data = await this.yearEnd(currentUser, { orgUnitId, group });
      return {
        title: 'Kết quả cuối năm Tiểu học',
        sheets: [
          {
            title: 'Cuối năm',
            columns: [
              { key: 'label', label: 'Lớp, khối', width: 20 },
              { key: 'students', label: 'Học sinh', width: 10 },
              ...(Object.keys(YEAR_RESULT_LABELS) as YearResultCode[]).map((code) => ({
                key: code,
                label: YEAR_RESULT_LABELS[code],
                width: 14,
              })),
              { key: 'not_confirmed', label: 'Chưa xác nhận', width: 12 },
              ...(Object.keys(COMPLETION_OUTCOME_LABELS) as CompletionOutcome[]).map((code) => ({
                key: code,
                label: COMPLETION_OUTCOME_LABELS[code],
                width: 18,
              })),
              { key: 'awarded', label: 'Được khen thưởng', width: 12 },
            ],
            rows: data.rows,
          },
        ] satisfies WorkbookSheet[],
      };
    }
    if (report === 'attendance') {
      const from = readDate(query.from, 'from', errors);
      const to = readDate(query.to, 'to', errors);
      throwIf(errors);
      const data = await this.attendance(currentUser, { orgUnitId, from, to });
      return {
        title: `Chuyên cần, bán trú từ ${from} đến ${to}`,
        sheets: [
          {
            title: 'Chuyên cần, bán trú',
            columns: [
              { key: 'class_name', label: 'Lớp', width: 16 },
              { key: 'students', label: 'Học sinh', width: 10 },
              { key: 'lessons', label: 'Tiết đã ghi sổ', width: 12 },
              { key: 'present', label: 'Có mặt', width: 10 },
              { key: 'late', label: 'Đi muộn', width: 10 },
              { key: 'absent_excused', label: 'Vắng có phép', width: 12 },
              { key: 'absent_unexcused', label: 'Vắng không phép', width: 14 },
              { key: 'meal_days', label: 'Ngày đã chốt suất', width: 14 },
              { key: 'meals', label: 'Suất ăn', width: 10 },
              { key: 'meal_cuts', label: 'Lượt cắt suất', width: 12 },
            ],
            rows: [...data.rows, data.totals],
          },
        ] satisfies WorkbookSheet[],
      };
    }
    throw validationError([
      { field: 'report', message: 'Báo cáo là enrollment, assessments, year-end hoặc attendance' },
    ]);
  }

  async export(currentUser: CurrentUser, report: string, query: Record<string, string | undefined>, ip: string | null) {
    const format = readTableFileFormat(query.format);
    if (!format) {
      throw validationError([{ field: 'format', message: 'Định dạng là xlsx hoặc pdf' }]);
    }
    const { database } = await this.currentSchoolYear.require();
    const built = await this.sheets(currentUser, report, query);
    const orgUnitIds = (await this.scope(currentUser, query.org_unit_id || null)) ?? [];
    const now = this.clock.now();
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: `primary-${report}`,
      fileName: `bao-cao-tieu-hoc-${report}-${fileStamp(now)}`,
      filters: { ...query },
      orgUnitIds,
      sheets: built.sheets.map((sheet, index) => (index === 0 ? { ...sheet, heading: [built.title] } : sheet)),
      ipAddress: ip,
      createdAt: now,
      format,
    });
  }
}

@Controller('primary-reports')
export class PrimaryReportsController {
  constructor(private readonly reports: PrimaryReportsService) {}

  private orgUnit(query: Record<string, string | undefined>) {
    if (query.org_unit_id && !isUuid(query.org_unit_id)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã đơn vị không hợp lệ' }]);
    }
    return query.org_unit_id || null;
  }

  @Get('enrollment')
  @RequirePermission(STATISTICS)
  enrollment(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.reports.enrollment(currentUser, this.orgUnit(query));
  }

  @Get('assessments')
  @RequirePermission(STATISTICS)
  assessments(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const group = readGroup(query.group, errors);
    if (!isUuid(query.period_id)) {
      errors.push({ field: 'period_id', message: 'Bắt buộc chọn kỳ đánh giá' });
    }
    throwIf(errors);
    return this.reports.assessments(currentUser, {
      orgUnitId: this.orgUnit(query),
      periodId: String(query.period_id),
      group,
    });
  }

  @Get('year-end')
  @RequirePermission(STATISTICS)
  yearEnd(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const group = readGroup(query.group, errors);
    throwIf(errors);
    return this.reports.yearEnd(currentUser, { orgUnitId: this.orgUnit(query), group });
  }

  @Get('attendance')
  @RequirePermission(STATISTICS)
  attendance(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const from = readDate(query.from, 'from', errors);
    const to = readDate(query.to, 'to', errors);
    throwIf(errors);
    return this.reports.attendance(currentUser, { orgUnitId: this.orgUnit(query), from, to });
  }

  @Get(':report/export')
  @RequirePermission(STATISTICS)
  async export(
    @Param('report') report: string,
    @Query() query: Record<string, string | undefined>,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    sendWorkbook(response, await this.reports.export(currentUser, report, query, request.ip ?? null));
  }
}
