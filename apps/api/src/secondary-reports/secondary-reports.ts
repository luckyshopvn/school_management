import { Controller, Get, Injectable, Param, Query, Req, Res } from '@nestjs/common';
import { Clock, validationError, type FieldError } from '@school-management/server';
import {
  PERMISSION_CODES,
  RATING_LABELS,
  SCORE_DISTRIBUTION_BANDS,
  scoreBand,
  type RatingCode,
} from '@school-management/shared';
import type { RatingTermValue, SchoolYearDatabase } from '@school-management/database';
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
import { PrimaryReportsService } from '../primary-reports/primary-reports.js';
import { ScoresService } from '../scores/scores.js';
import { loadSecondaryFacts, type SecondaryClassRow, type SecondaryStudentRow } from './secondary-facts.js';

// Báo cáo, thống kê THCS, THPT (DT-21 phần 21g, YCTD-175): sĩ số theo khối (lớp, học sinh, nữ, dân tộc thiểu số, khuyết tật,
// nội trú, bán trú; học sinh theo tổ hợp ở THPT); kết quả cuối năm theo lớp, khối, trường (xếp loại học tập, rèn luyện cả năm
// của 21c, danh hiệu Xuất sắc, Giỏi, lên lớp, ở lại lớp của 21e, tốt nghiệp của 21f); phổ điểm trung bình môn theo học kỳ
// hoặc cả năm (điểm của sổ điểm 21c, khoảng theo ngưỡng của Thông tư 22/2021); tổng hợp theo giáo viên và tổ bộ môn (điểm
// trung bình môn của các lớp giáo viên dạy theo phân công). Mỗi báo cáo xuất Excel, PDF, ghi nhật ký xuất. Phạm vi đơn vị như
// thống kê Tiểu học (19d, 20f). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
export const SECONDARY_REPORT_RULE_CODE = 'YCTD-175';
const STATISTICS = PERMISSION_CODES.childStatisticsView;
type Level = 'THCS' | 'THPT';
type Group = 'class' | 'grade' | 'school';
const GROUPS: Group[] = ['class', 'grade', 'school'];
const TERMS: RatingTermValue[] = ['first_term', 'second_term', 'year'];
const RATINGS = Object.keys(RATING_LABELS) as RatingCode[];

export interface SecondaryReportQuery {
  level: Level;
  orgUnitId: string | null;
  group: Group;
  term: RatingTermValue;
  subjectId: string | null;
}

export function parseSecondaryQuery(query: Record<string, string | undefined>): SecondaryReportQuery {
  const errors: FieldError[] = [];
  const level = query.school_level as Level;
  if (level !== 'THCS' && level !== 'THPT') {
    errors.push({ field: 'school_level', message: 'Cấp học là THCS hoặc THPT' });
  }
  const group = (query.group || 'grade') as Group;
  if (!GROUPS.includes(group)) {
    errors.push({ field: 'group', message: 'Gộp theo class, grade hoặc school' });
  }
  const term = (query.term || 'year') as RatingTermValue;
  if (!TERMS.includes(term)) {
    errors.push({ field: 'term', message: 'Kỳ là first_term, second_term hoặc year' });
  }
  for (const field of ['org_unit_id', 'subject_id']) {
    if (query[field] && !isUuid(query[field])) {
      errors.push({ field, message: 'Mã không hợp lệ' });
    }
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { level, orgUnitId: query.org_unit_id || null, group, term, subjectId: query.subject_id || null };
}

const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);
const mean = (values: number[]) =>
  values.length === 0 ? null : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;

@Injectable()
export class SecondaryReportsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly primary: PrimaryReportsService,
    private readonly scores: ScoresService,
    private readonly clock: Clock,
  ) {}

  private async gradeNames(database: Kysely<SchoolYearDatabase>, level: Level) {
    const rows = await database
      .selectFrom('grade_levels')
      .select(['code', 'name', 'order_no'])
      .where('school_level', '=', level)
      .execute();
    return new Map(rows.map((row) => [row.code, row]));
  }

  private async facts(currentUser: CurrentUser, query: SecondaryReportQuery) {
    const { database } = await this.currentSchoolYear.require();
    const orgUnits = await this.primary.scope(currentUser, query.orgUnitId);
    return {
      database,
      orgUnits,
      grades: await this.gradeNames(database, query.level),
      ...(await loadSecondaryFacts(database, query.level, orgUnits)),
    };
  }

  // Nhóm của lớp theo cách gộp: lớp, khối hoặc toàn trường; thứ tự theo thứ tự khối rồi tên lớp
  private groups(
    group: Group,
    classes: SecondaryClassRow[],
    grades: Map<string, { name: string; order_no: number }>,
  ): Array<{ key: string; label: string; classIds: string[] }> {
    if (group === 'school') {
      return [{ key: 'school', label: 'Toàn trường', classIds: classes.map((row) => row.id) }];
    }
    const order = (grade: string) => grades.get(grade)?.order_no ?? 0;
    const sorted = [...classes].sort(
      (left, right) => order(left.grade) - order(right.grade) || left.name.localeCompare(right.name, 'vi'),
    );
    if (group === 'class') {
      return sorted.map((row) => ({
        key: row.id,
        label: `${row.name} (${grades.get(row.grade)?.name ?? row.grade})`,
        classIds: [row.id],
      }));
    }
    const codes = [...new Set(sorted.map((row) => row.grade))];
    return codes.map((code) => ({
      key: code,
      label: grades.get(code)?.name ?? code,
      classIds: sorted.filter((row) => row.grade === code).map((row) => row.id),
    }));
  }

  // Sĩ số theo khối kèm dòng toàn trường; THPT thêm học sinh theo tổ hợp
  async enrollment(currentUser: CurrentUser, query: SecondaryReportQuery) {
    const { classes, students, grades } = await this.facts(currentUser, query);
    const row = (label: string, classRows: SecondaryClassRow[], studentRows: SecondaryStudentRow[]) => ({
      label,
      classes: classRows.length,
      students: studentRows.length,
      female: studentRows.filter((item) => item.female).length,
      ethnic: studentRows.filter((item) => item.ethnic).length,
      disabled: studentRows.filter((item) => item.disabled).length,
      boarding: studentRows.filter((item) => item.boarding).length,
    });
    const groups = this.groups('grade', classes, grades);
    const combinations = [...new Set(students.map((item) => item.combination ?? ''))].sort();
    return {
      school_level: query.level,
      rows: [
        ...groups.map((group) =>
          row(
            group.label,
            classes.filter((item) => group.classIds.includes(item.id)),
            students.filter((item) => group.classIds.includes(item.class_id)),
          ),
        ),
        row('Toàn trường', classes, students),
      ],
      combinations:
        query.level === 'THPT'
          ? combinations.map((code) => ({
              combination: code || 'Chưa đăng ký',
              students: students.filter((item) => (item.combination ?? '') === code).length,
            }))
          : [],
    };
  }

  // Kết quả cuối năm theo lớp, khối, trường
  async results(currentUser: CurrentUser, query: SecondaryReportQuery) {
    const { classes, students, grades } = await this.facts(currentUser, query);
    return {
      school_level: query.level,
      group: query.group,
      rows: this.groups(query.group, classes, grades).map((group) => {
        const own = students.filter((item) => group.classIds.includes(item.class_id));
        const count = (predicate: (item: SecondaryStudentRow) => boolean) => own.filter(predicate).length;
        return {
          label: group.label,
          students: own.length,
          learning: Object.fromEntries(RATINGS.map((code) => [code, count((item) => item.learning === code)])),
          learning_missing: count((item) => item.learning === null),
          conduct: Object.fromEntries(RATINGS.map((code) => [code, count((item) => item.conduct === code)])),
          conduct_missing: count((item) => item.conduct === null),
          excellent: count((item) => item.title === 'excellent'),
          good_title: count((item) => item.title === 'good'),
          promoted: count((item) => item.completion === 'promoted' || item.completion === 'level_completed'),
          pending_support: count((item) => item.completion === 'pending_support'),
          retained: count((item) => item.completion === 'retained'),
          graduated: count((item) => item.graduation === 'graduated'),
          not_graduated: count((item) => item.graduation === 'not_graduated'),
        };
      }),
    };
  }

  // Điểm trung bình môn của học sinh các lớp trong kỳ, đọc từ sổ điểm (21c)
  private async averages(database: Kysely<SchoolYearDatabase>, classIds: string[], term: RatingTermValue) {
    const rows: Array<{ class_id: string; child_id: string; subject_id: string; average: number }> = [];
    const subjects = new Map<string, string>();
    for (const classId of classIds) {
      const summary = await this.scores.summariesFor(database, classId, term);
      for (const subject of summary.subjects) {
        if (subject.mode === 'score') {
          subjects.set(subject.subject_id, subject.subject_name);
        }
      }
      for (const student of summary.rows) {
        for (const item of student.subjects) {
          if (item.average !== null && item.mode === 'score') {
            rows.push({
              class_id: classId,
              child_id: student.child_id,
              subject_id: item.subject_id,
              average: item.average,
            });
          }
        }
      }
    }
    return { rows, subjects };
  }

  // Phổ điểm trung bình môn: số học sinh theo khoảng điểm của một môn (hoặc mọi môn tính điểm) theo lớp, khối, trường
  async distribution(currentUser: CurrentUser, query: SecondaryReportQuery) {
    const { database, classes, grades } = await this.facts(currentUser, query);
    const { rows, subjects } = await this.averages(
      database,
      classes.map((row) => row.id),
      query.term,
    );
    const chosen = rows.filter((row) => query.subjectId === null || row.subject_id === query.subjectId);
    return {
      school_level: query.level,
      term: query.term,
      subjects: [...subjects.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name, 'vi')),
      bands: SCORE_DISTRIBUTION_BANDS.map((band) => ({ key: band.key, label: band.label })),
      rows: this.groups(query.group, classes, grades).map((group) => {
        const own = chosen.filter((row) => group.classIds.includes(row.class_id));
        return {
          label: group.label,
          count: own.length,
          bands: Object.fromEntries(
            SCORE_DISTRIBUTION_BANDS.map((band) => [
              band.key,
              own.filter((row) => scoreBand(row.average) === band.key).length,
            ]),
          ),
          mean: mean(own.map((row) => row.average)),
          below_five_percent: percent(own.filter((row) => row.average < 5).length, own.length),
        };
      }),
    };
  }

  // Tổng hợp theo giáo viên (môn, lớp theo phân công giảng dạy đang hiệu lực) và theo tổ bộ môn (tổ có môn đó)
  async teachers(currentUser: CurrentUser, query: SecondaryReportQuery) {
    const { database, classes } = await this.facts(currentUser, query);
    const classIds = classes.map((row) => row.id);
    if (classIds.length === 0) {
      return { school_level: query.level, term: query.term, teachers: [], teams: [] };
    }
    const [{ rows }, assignments, teams] = await Promise.all([
      this.averages(database, classIds, query.term),
      database
        .selectFrom('class_staff_assignments')
        .innerJoin('subjects', 'subjects.id', 'class_staff_assignments.subject_id')
        .select([
          'class_staff_assignments.class_id',
          'class_staff_assignments.staff_user_id',
          'class_staff_assignments.staff_name',
          'class_staff_assignments.subject_id',
          'subjects.name as subject_name',
        ])
        .where('class_staff_assignments.class_id', 'in', classIds)
        .where('class_staff_assignments.assignment_role', '=', 'subject')
        .where('class_staff_assignments.status', '=', 'active')
        .execute(),
      database
        .selectFrom('subject_teams')
        .innerJoin('subject_team_subjects', 'subject_team_subjects.team_id', 'subject_teams.id')
        .select(['subject_teams.id', 'subject_teams.name', 'subject_team_subjects.subject_id'])
        .where('subject_teams.school_level', '=', query.level)
        .where('subject_teams.status', '=', 'active')
        .execute(),
    ]);
    const classNames = new Map(classes.map((row) => [row.id, row.name]));
    const summarize = (averages: number[]) => ({
      students: averages.length,
      mean: mean(averages),
      at_least_five_percent: percent(averages.filter((value) => value >= 5).length, averages.length),
      at_least_eight_percent: percent(averages.filter((value) => value >= 8).length, averages.length),
    });
    const teamOf = (subjectId: string) => teams.find((team) => team.subject_id === subjectId);
    const teacherRows = new Map<
      string,
      { staff_name: string; team: string; subjects: Set<string>; classes: Set<string>; averages: number[] }
    >();
    for (const assignment of assignments) {
      const entry = teacherRows.get(assignment.staff_user_id) ?? {
        staff_name: assignment.staff_name,
        team: teamOf(assignment.subject_id ?? '')?.name ?? '',
        subjects: new Set<string>(),
        classes: new Set<string>(),
        averages: [],
      };
      entry.subjects.add(assignment.subject_name);
      entry.classes.add(classNames.get(assignment.class_id) ?? '');
      entry.averages.push(
        ...rows
          .filter((row) => row.class_id === assignment.class_id && row.subject_id === assignment.subject_id)
          .map((row) => row.average),
      );
      teacherRows.set(assignment.staff_user_id, entry);
    }
    const teamNames = [...new Set(teams.map((team) => team.name))].sort((left, right) =>
      left.localeCompare(right, 'vi'),
    );
    return {
      school_level: query.level,
      term: query.term,
      teachers: [...teacherRows.values()]
        .map((entry) => ({
          staff_name: entry.staff_name,
          team: entry.team,
          subjects: [...entry.subjects].join(', '),
          classes: [...entry.classes].sort((left, right) => left.localeCompare(right, 'vi')).join(', '),
          ...summarize(entry.averages),
        }))
        .sort((left, right) => left.staff_name.localeCompare(right.staff_name, 'vi')),
      teams: teamNames.map((name) => {
        const subjectIds = new Set(teams.filter((team) => team.name === name).map((team) => team.subject_id));
        return {
          team: name,
          ...summarize(rows.filter((row) => subjectIds.has(row.subject_id)).map((row) => row.average)),
        };
      }),
    };
  }

  private async sheets(currentUser: CurrentUser, report: string, query: SecondaryReportQuery) {
    const levelName = query.level;
    if (report === 'enrollment') {
      const data = await this.enrollment(currentUser, query);
      const sheets: WorkbookSheet[] = [
        {
          title: 'Sĩ số',
          heading: [`Sĩ số ${levelName} theo khối`],
          columns: [
            { key: 'label', label: 'Khối', width: 16 },
            { key: 'classes', label: 'Số lớp', width: 10 },
            { key: 'students', label: 'Học sinh', width: 10 },
            { key: 'female', label: 'Nữ', width: 8 },
            { key: 'ethnic', label: 'Dân tộc thiểu số', width: 14 },
            { key: 'disabled', label: 'Khuyết tật', width: 10 },
            { key: 'boarding', label: 'Nội trú, bán trú', width: 14 },
          ],
          rows: data.rows,
        },
      ];
      if (data.combinations.length > 0) {
        sheets.push({
          title: 'Tổ hợp',
          columns: [
            { key: 'combination', label: 'Tổ hợp', width: 20 },
            { key: 'students', label: 'Học sinh', width: 10 },
          ],
          rows: data.combinations,
        });
      }
      return sheets;
    }
    if (report === 'results') {
      const data = await this.results(currentUser, query);
      return [
        {
          title: 'Kết quả cuối năm',
          heading: [`Kết quả cuối năm ${levelName}`],
          columns: [
            { key: 'label', label: 'Nhóm', width: 22 },
            { key: 'students', label: 'Học sinh', width: 10 },
            ...RATINGS.map((code) => ({ key: `learning_${code}`, label: `Học tập ${RATING_LABELS[code]}`, width: 12 })),
            ...RATINGS.map((code) => ({
              key: `conduct_${code}`,
              label: `Rèn luyện ${RATING_LABELS[code]}`,
              width: 12,
            })),
            { key: 'excellent', label: 'Xuất sắc', width: 10 },
            { key: 'good_title', label: 'Giỏi', width: 8 },
            { key: 'promoted', label: 'Lên lớp, hoàn thành', width: 12 },
            { key: 'pending_support', label: 'Rèn luyện hè, kiểm tra lại', width: 14 },
            { key: 'retained', label: 'Ở lại lớp', width: 10 },
            { key: 'graduated', label: 'Tốt nghiệp', width: 10 },
          ],
          rows: data.rows.map((row) => ({
            ...row,
            ...Object.fromEntries(RATINGS.map((code) => [`learning_${code}`, row.learning[code]])),
            ...Object.fromEntries(RATINGS.map((code) => [`conduct_${code}`, row.conduct[code]])),
          })),
        },
      ];
    }
    if (report === 'scores') {
      const data = await this.distribution(currentUser, query);
      const subject = data.subjects.find((item) => item.id === query.subjectId)?.name ?? 'mọi môn tính điểm';
      return [
        {
          title: 'Phổ điểm',
          heading: [`Phổ điểm trung bình môn ${levelName}, ${subject}`],
          columns: [
            { key: 'label', label: 'Nhóm', width: 22 },
            { key: 'count', label: 'Số điểm', width: 10 },
            ...data.bands.map((band) => ({ key: band.key, label: band.label, width: 12 })),
            { key: 'mean', label: 'Trung bình', width: 10 },
            { key: 'below_five_percent', label: 'Dưới 5 (%)', width: 10 },
          ],
          rows: data.rows.map((row) => ({ ...row, ...row.bands })),
        },
      ];
    }
    if (report === 'teachers') {
      const data = await this.teachers(currentUser, query);
      const columns = [
        { key: 'students', label: 'Số điểm', width: 10 },
        { key: 'mean', label: 'Trung bình', width: 10 },
        { key: 'at_least_five_percent', label: 'Từ 5 (%)', width: 10 },
        { key: 'at_least_eight_percent', label: 'Từ 8 (%)', width: 10 },
      ];
      return [
        {
          title: 'Theo giáo viên',
          heading: [`Kết quả môn học theo giáo viên ${levelName}`],
          columns: [
            { key: 'staff_name', label: 'Giáo viên', width: 22 },
            { key: 'team', label: 'Tổ bộ môn', width: 16 },
            { key: 'subjects', label: 'Môn', width: 16 },
            { key: 'classes', label: 'Lớp', width: 20 },
            ...columns,
          ],
          rows: data.teachers,
        },
        {
          title: 'Theo tổ bộ môn',
          columns: [{ key: 'team', label: 'Tổ bộ môn', width: 22 }, ...columns],
          rows: data.teams,
        },
      ];
    }
    throw validationError([{ field: 'report', message: 'Báo cáo là enrollment, results, scores hoặc teachers' }]);
  }

  async export(currentUser: CurrentUser, report: string, query: Record<string, string | undefined>, ip: string | null) {
    const format = readTableFileFormat(query.format);
    if (!format) {
      throw validationError([{ field: 'format', message: 'Định dạng là xlsx hoặc pdf' }]);
    }
    const parsed = parseSecondaryQuery(query);
    const sheets = await this.sheets(currentUser, report, parsed);
    const { database } = await this.currentSchoolYear.require();
    const now = this.clock.now();
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: `secondary-${report}`,
      fileName: `bao-cao-${parsed.level.toLowerCase()}-${report}-${fileStamp(now)}`,
      filters: { ...query },
      orgUnitIds: (await this.primary.scope(currentUser, parsed.orgUnitId)) ?? [],
      sheets,
      ipAddress: ip,
      createdAt: now,
      format,
    });
  }
}

@Controller('secondary-reports')
export class SecondaryReportsController {
  constructor(private readonly reports: SecondaryReportsService) {}

  @Get('enrollment')
  @RequirePermission(STATISTICS)
  enrollment(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.reports.enrollment(currentUser, parseSecondaryQuery(query));
  }

  @Get('results')
  @RequirePermission(STATISTICS)
  results(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.reports.results(currentUser, parseSecondaryQuery(query));
  }

  @Get('scores')
  @RequirePermission(STATISTICS)
  scores(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.reports.distribution(currentUser, parseSecondaryQuery(query));
  }

  @Get('teachers')
  @RequirePermission(STATISTICS)
  teachers(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.reports.teachers(currentUser, parseSecondaryQuery(query));
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
