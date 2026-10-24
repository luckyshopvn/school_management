import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  assignRoomIndexes,
  examNumber,
  GRADUATION_DEFAULTS,
  GRADUATION_LAST_GRADE,
  GRADUATION_MINUTES_LABELS,
  GRADUATION_SUBMISSION_LABELS,
  graduationEligibility,
  graduationScore,
  PERMISSION_CODES,
  schoolAverage,
  validateGraduationConfig,
  type GraduationConfig,
  type GraduationLevel,
  type GraduationMinutesKind,
  type GraduationSubmissionKind,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { assertLevelEnabled } from '../catalogs/school-level-fields.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import { SchoolLevelResolver } from '../common/school-levels.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { buildTableFile, CONTENT_TYPES, type TableFileSheet } from '../exports/table-file.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { ScoresService } from '../scores/scores.js';
import { graduationCertificatePdf, graduationMinutesPdf } from './graduation-pdf.js';

// Xét tốt nghiệp THCS, THPT và hồ sơ thi (DT-21 phần 21f, YCTD-174). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - mỗi năm học một kỳ cho mỗi cấp; thí sinh là học sinh đang học khối cuối cấp (khối 9, khối 12); đủ điều kiện khi xếp loại
//   học tập, rèn luyện cả năm từ Đạt trở lên (sổ điểm 21c); THPT thêm đăng ký bài thi (bắt buộc và tự chọn theo cấu hình), số
//   báo danh, phòng thi, điểm thi, điểm ưu tiên, khuyến khích, điểm trung bình các năm học (lớp 12 đọc từ sổ điểm, lớp 10, 11
//   đọc từ học bạ đã chép, sửa tay được);
// - quản lý (cấu hình, tạo kỳ, lập danh sách, phòng, số báo danh, xét, công nhận, xuất tệp, hồ sơ chuyển cấp): người có
//   \`P02.student-record.approve\` toàn trường; xem: người có quyền xem, quản lý đánh giá hoặc duyệt học bạ;
// - công nhận cần ít nhất một biên bản họp hội đồng và mọi thí sinh đã có kết quả đề xuất; công nhận xong kỳ khoá, đánh số
//   giấy chứng nhận cho người tốt nghiệp;
// - tệp xuất theo bố cục chung, ghi lại lần xuất; trạng thái đã gửi do người dùng đánh dấu (nối hệ thống của Sở, Bộ sau);
//   hồ sơ chuyển cấp THCS chỉ lập cho người đã được công nhận tốt nghiệp có học bạ đã kí
export const GRADUATION_RULE_CODE = 'YCTD-174';
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
const GENDER_LABELS: Record<string, string> = { male: 'Nam', female: 'Nữ' };
const LEVEL_LABELS: Record<GraduationLevel, string> = {
  THCS: 'Trung học cơ sở',
  THPT: 'Trung học phổ thông',
};

function rule(message: string, details: FieldError[] = []) {
  return ruleViolationError(GRADUATION_RULE_CODE, message, details);
}

interface GradeAverages {
  g10: number | null;
  g11: number | null;
  g12: number | null;
}

@Injectable()
export class GraduationService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly organizationScopes: OrganizationScopes,
    private readonly schoolLevels: SchoolLevelResolver,
    private readonly scores: ScoresService,
    private readonly clock: Clock,
  ) {}

  private async assertManage(currentUser: CurrentUser) {
    if (
      currentUser.hasPermission(PERMISSION_CODES.studentRecordApprove) &&
      (await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.studentRecordApprove)).wholeSchool
    ) {
      return;
    }
    throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu làm việc này');
  }

  private assertView(currentUser: CurrentUser) {
    if (
      ![PERMISSION_CODES.assessmentView, PERMISSION_CODES.assessmentManage, PERMISSION_CODES.studentRecordApprove].some(
        (permission) => currentUser.hasPermission(permission),
      )
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được xét tốt nghiệp, hồ sơ thi');
    }
  }

  private async yearName(): Promise<string> {
    const { academicYearId } = await this.currentSchoolYear.require();
    const year = await this.databases.system
      .selectFrom('academic_years')
      .select('name')
      .where('id', '=', academicYearId)
      .executeTakeFirst();
    return year?.name ?? '';
  }

  private async schoolName(database: Executor): Promise<string> {
    const root = await database
      .selectFrom('org_units')
      .select('name')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    return root?.name ?? 'Trường';
  }

  async config(level: GraduationLevel): Promise<GraduationConfig> {
    const { database } = await this.currentSchoolYear.require();
    return this.readConfig(database, level);
  }

  private async readConfig(database: Executor, level: GraduationLevel): Promise<GraduationConfig> {
    const row = await database
      .selectFrom('graduation_configs')
      .select('config')
      .where('school_level', '=', level)
      .executeTakeFirst();
    return row
      ? ({ ...GRADUATION_DEFAULTS[level], ...(row.config as GraduationConfig) } as GraduationConfig)
      : GRADUATION_DEFAULTS[level];
  }

  async saveConfig(level: GraduationLevel, config: GraduationConfig, currentUser: CurrentUser, origin: ChangeOrigin) {
    await this.assertManage(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const before = await this.readConfig(database, level);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('graduation_configs')
        .values({ school_level: level, config: JSON.stringify(config), updated_by: currentUser.id })
        .onConflict((conflict) =>
          conflict.column('school_level').doUpdateSet({
            config: JSON.stringify(config),
            updated_by: currentUser.id,
            updated_at: this.clock.now(),
          }),
        )
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'graduation_configs',
        entityId: level === 'THCS' ? '00000000-0000-4000-8000-0000021f0001' : '00000000-0000-4000-8000-0000021f0002',
        action: 'update',
        before,
        after: config,
      });
    });
    return config;
  }

  async sessions(currentUser: CurrentUser, level: GraduationLevel) {
    this.assertView(currentUser);
    const { database } = await this.currentSchoolYear.require();
    return database
      .selectFrom('graduation_sessions')
      .select(['id', 'school_level', 'name', 'academic_year_name', 'exam_date', 'status'])
      .where('school_level', '=', level)
      .orderBy('created_at', 'desc')
      .execute();
  }

  async createSession(
    currentUser: CurrentUser,
    input: { level: GraduationLevel; name: string; examDate: string | null },
    origin: ChangeOrigin,
  ) {
    await this.assertManage(currentUser);
    await assertLevelEnabled(this.schoolLevels, input.level);
    const { database } = await this.currentSchoolYear.require();
    const yearName = await this.yearName();
    const existing = await database
      .selectFrom('graduation_sessions')
      .select('id')
      .where('school_level', '=', input.level)
      .where('academic_year_name', '=', yearName)
      .executeTakeFirst();
    if (existing) {
      throw rule('Năm học này đã có kỳ xét tốt nghiệp của cấp');
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('graduation_sessions')
        .values({
          school_level: input.level,
          name: input.name,
          academic_year_name: yearName,
          exam_date: input.examDate,
          created_by_name: currentUser.description.full_name,
        })
        .returning(['id', 'school_level', 'name', 'academic_year_name', 'exam_date', 'status'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'graduation_sessions',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  private async findSession(database: Executor, sessionId: string) {
    const session = await database
      .selectFrom('graduation_sessions')
      .selectAll()
      .where('id', '=', sessionId)
      .executeTakeFirst();
    if (!session) {
      throw notFoundError('Không tìm thấy kỳ xét tốt nghiệp', 'graduation_session');
    }
    return session;
  }

  private assertOpen(session: { status: string }) {
    if (session.status !== 'open') {
      throw rule('Kỳ đã công nhận kết quả, không sửa được');
    }
  }

  private gradesOf(row: { grade_averages: unknown }): GradeAverages {
    const value = (row.grade_averages ?? {}) as Partial<GradeAverages>;
    return { g10: value.g10 ?? null, g11: value.g11 ?? null, g12: value.g12 ?? null };
  }

  // Toàn bộ dữ liệu của một kỳ cho màn hình: thí sinh (kèm điểm, kết quả), phòng thi, biên bản, tệp đã xuất, hồ sơ chuyển cấp
  async view(currentUser: CurrentUser, sessionId: string) {
    this.assertView(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const session = await this.findSession(database, sessionId);
    const level = session.school_level;
    const config = await this.readConfig(database, level);
    const [candidates, scores, decisions, rooms, minutes, submissions, dossiers, subjects] = await Promise.all([
      database
        .selectFrom('graduation_candidates')
        .innerJoin('children', 'children.id', 'graduation_candidates.child_id')
        .innerJoin('classes', 'classes.id', 'graduation_candidates.class_id')
        .select([
          'graduation_candidates.id',
          'graduation_candidates.child_id',
          'children.full_name',
          'classes.name as class_name',
          'graduation_candidates.exam_number',
          'graduation_candidates.eligible',
          'graduation_candidates.eligibility_note',
          'graduation_candidates.priority_points',
          'graduation_candidates.incentive_points',
          'graduation_candidates.grade_averages',
          'graduation_candidates.exam_subjects',
          'graduation_candidates.exempt_subjects',
          'graduation_candidates.room_id',
        ])
        .where('graduation_candidates.session_id', '=', sessionId)
        .orderBy('classes.name')
        .orderBy('children.full_name')
        .execute(),
      database
        .selectFrom('graduation_scores')
        .innerJoin('graduation_candidates', 'graduation_candidates.id', 'graduation_scores.candidate_id')
        .select(['graduation_scores.candidate_id', 'graduation_scores.subject_code', 'graduation_scores.score'])
        .where('graduation_candidates.session_id', '=', sessionId)
        .execute(),
      database
        .selectFrom('graduation_decisions')
        .innerJoin('graduation_candidates', 'graduation_candidates.id', 'graduation_decisions.candidate_id')
        .select([
          'graduation_decisions.candidate_id',
          'graduation_decisions.outcome',
          'graduation_decisions.status',
          'graduation_decisions.exam_average',
          'graduation_decisions.score',
          'graduation_decisions.note',
          'graduation_decisions.certificate_no',
        ])
        .where('graduation_candidates.session_id', '=', sessionId)
        .execute(),
      database
        .selectFrom('graduation_rooms')
        .select(['id', 'code', 'name', 'capacity', 'proctors'])
        .where('session_id', '=', sessionId)
        .orderBy('code')
        .execute(),
      database
        .selectFrom('graduation_minutes')
        .select(['id', 'kind', 'title', 'created_by_name', 'created_at'])
        .where('session_id', '=', sessionId)
        .orderBy('created_at')
        .execute(),
      database
        .selectFrom('graduation_submissions')
        .select([
          'id',
          'kind',
          'file_name',
          'exported_by_name',
          'exported_at',
          'status',
          'sent_by_name',
          'sent_at',
          'note',
        ])
        .where('session_id', '=', sessionId)
        .orderBy('exported_at', 'desc')
        .execute(),
      database
        .selectFrom('transfer_dossiers')
        .innerJoin('children', 'children.id', 'transfer_dossiers.child_id')
        .select([
          'transfer_dossiers.id',
          'transfer_dossiers.child_id',
          'children.full_name',
          'transfer_dossiers.destination',
          'transfer_dossiers.status',
          'transfer_dossiers.sent_at',
        ])
        .where('transfer_dossiers.session_id', '=', sessionId)
        .orderBy('children.full_name')
        .execute(),
      database.selectFrom('subjects').select(['code', 'name']).where('school_level', '=', level).execute(),
    ]);
    return {
      session,
      config,
      subjects,
      candidates: candidates.map((row) => {
        const grades = this.gradesOf(row);
        return {
          ...row,
          priority_points: Number(row.priority_points),
          incentive_points: Number(row.incentive_points),
          grades,
          school_average: schoolAverage(grades, config.grade_weights),
          scores: scores
            .filter((item) => item.candidate_id === row.id)
            .map((item) => ({ subject_code: item.subject_code, score: Number(item.score) })),
          decision: decisions.find((item) => item.candidate_id === row.id) ?? null,
        };
      }),
      rooms,
      minutes,
      submissions,
      dossiers,
    };
  }

  // Điểm trung bình các môn tính điểm (không kể môn tự chọn) của học sinh lớp cuối cấp theo sổ điểm; thiếu môn nào thì null
  private async yearAveragesOfClass(database: Executor, classId: string): Promise<Map<string, number | null>> {
    const summary = await this.scores.summariesFor(database, classId, 'year');
    const counted = summary.subjects.filter((subject) => subject.mode === 'score' && !subject.is_elective);
    return new Map(
      summary.rows.map((row) => {
        const values = counted.map(
          (subject) => row.subjects.find((item) => item.subject_id === subject.subject_id)?.average ?? null,
        );
        return [
          row.child_id,
          values.length === 0 || values.some((value) => value === null)
            ? null
            : Math.round((values.reduce<number>((sum, value) => sum + (value ?? 0), 0) / values.length) * 100) / 100,
        ];
      }),
    );
  }

  // Điểm trung bình lớp 10, 11 đọc từ học bạ đã lập (nội dung `secondary` của học bạ THPT các năm trước)
  private async previousAverages(database: Executor, childId: string): Promise<Pick<GradeAverages, 'g10' | 'g11'>> {
    const records = await database
      .selectFrom('learning_records')
      .select(['grade_level', 'content'])
      .where('child_id', '=', childId)
      .where('grade_level', 'in', ['K10', 'K11'])
      .execute();
    const result: Pick<GradeAverages, 'g10' | 'g11'> = { g10: null, g11: null };
    for (const record of records) {
      const secondary = (record.content as { secondary?: { subjects: Array<{ mode: string; year: string | null }> } })
        .secondary;
      const values = (secondary?.subjects ?? [])
        .filter((subject) => subject.mode === 'score')
        .map((subject) => (subject.year === null ? null : Number(subject.year)));
      if (values.length > 0 && values.every((value) => value !== null && Number.isFinite(value))) {
        const mean =
          Math.round((values.reduce<number>((sum, value) => sum + (value ?? 0), 0) / values.length) * 100) / 100;
        if (record.grade_level === 'K10') {
          result.g10 = mean;
        } else {
          result.g11 = mean;
        }
      }
    }
    return result;
  }

  // Lập danh sách thí sinh của kỳ từ học sinh đang học khối cuối cấp; lập lại thì cập nhật điều kiện, giữ điểm đã sửa tay
  async generateCandidates(currentUser: CurrentUser, sessionId: string, origin: ChangeOrigin) {
    await this.assertManage(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const session = await this.findSession(database, sessionId);
    this.assertOpen(session);
    const level = session.school_level;
    const classes = await database
      .selectFrom('classes')
      .select(['id', 'name'])
      .where('school_level', '=', level)
      .where('grade_level', '=', GRADUATION_LAST_GRADE[level])
      .where('status', '=', 'active')
      .execute();
    let created = 0;
    let updated = 0;
    await database.transaction().execute(async (transaction) => {
      for (const classRow of classes) {
        const students = await transaction
          .selectFrom('class_enrollments')
          .innerJoin('children', 'children.id', 'class_enrollments.child_id')
          .leftJoin('term_ratings', (join) =>
            join
              .onRef('term_ratings.child_id', '=', 'children.id')
              .on('term_ratings.class_id', '=', classRow.id)
              .on('term_ratings.term_type', '=', 'year'),
          )
          .select(['children.id as child_id', 'term_ratings.learning', 'term_ratings.conduct'])
          .where('class_enrollments.class_id', '=', classRow.id)
          .where('class_enrollments.is_current', '=', true)
          .where('children.status', '=', 'active')
          .where('children.deleted_at', 'is', null)
          .execute();
        const averages = level === 'THPT' ? await this.yearAveragesOfClass(transaction, classRow.id) : new Map();
        for (const student of students) {
          const eligibility = graduationEligibility(student.learning, student.conduct);
          const current = await transaction
            .selectFrom('graduation_candidates')
            .select(['id', 'grade_averages'])
            .where('session_id', '=', sessionId)
            .where('child_id', '=', student.child_id)
            .executeTakeFirst();
          let grades: GradeAverages | null = null;
          if (level === 'THPT') {
            const stored = current ? this.gradesOf(current) : { g10: null, g11: null, g12: null };
            const previous = await this.previousAverages(transaction, student.child_id);
            grades = {
              g10: stored.g10 ?? previous.g10,
              g11: stored.g11 ?? previous.g11,
              g12: stored.g12 ?? averages.get(student.child_id) ?? null,
            };
          }
          if (current) {
            await transaction
              .updateTable('graduation_candidates')
              .set({
                eligible: eligibility.eligible,
                eligibility_note: eligibility.note,
                class_id: classRow.id,
                grade_averages: grades ? JSON.stringify(grades) : null,
              })
              .where('id', '=', current.id)
              .execute();
            updated += 1;
          } else {
            await transaction
              .insertInto('graduation_candidates')
              .values({
                session_id: sessionId,
                child_id: student.child_id,
                class_id: classRow.id,
                eligible: eligibility.eligible,
                eligibility_note: eligibility.note,
                grade_averages: grades ? JSON.stringify(grades) : null,
              })
              .execute();
            created += 1;
          }
        }
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'graduation_candidates',
        entityId: sessionId,
        action: 'update',
        before: null,
        after: { created, updated },
      });
    });
    return { created, updated, classes: classes.length };
  }

  async updateCandidate(
    currentUser: CurrentUser,
    candidateId: string,
    patch: {
      priority_points?: number;
      incentive_points?: number;
      exam_subjects?: string[];
      exempt_subjects?: string[];
      grades?: Partial<GradeAverages>;
    },
    origin: ChangeOrigin,
  ) {
    await this.assertManage(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const candidate = await database
      .selectFrom('graduation_candidates')
      .selectAll()
      .where('id', '=', candidateId)
      .executeTakeFirst();
    if (!candidate) {
      throw notFoundError('Không tìm thấy thí sinh', 'graduation_candidate');
    }
    const session = await this.findSession(database, candidate.session_id);
    this.assertOpen(session);
    const config = await this.readConfig(database, session.school_level);
    const errors: FieldError[] = [];
    if (!candidate.eligible && (patch.exam_subjects || patch.exempt_subjects)) {
      errors.push({ field: 'exam_subjects', message: 'Thí sinh chưa đủ điều kiện dự thi' });
    }
    if (patch.priority_points !== undefined && patch.priority_points > config.max_priority) {
      errors.push({ field: 'priority_points', message: `Điểm ưu tiên tối đa ${config.max_priority}` });
    }
    if (patch.incentive_points !== undefined && patch.incentive_points > config.max_incentive) {
      errors.push({ field: 'incentive_points', message: `Điểm khuyến khích tối đa ${config.max_incentive}` });
    }
    if (patch.exam_subjects) {
      const chosen = patch.exam_subjects;
      const electives = chosen.filter((code) => !config.required_subjects.includes(code));
      if (
        config.required_subjects.some((code) => !chosen.includes(code)) ||
        electives.length !== config.elective_count ||
        electives.some((code) => !config.elective_pool.includes(code)) ||
        new Set(chosen).size !== chosen.length
      ) {
        errors.push({
          field: 'exam_subjects',
          message: `Bài thi gồm ${config.required_subjects.length} bài bắt buộc và ${config.elective_count} bài tự chọn trong danh sách của kỳ thi`,
        });
      }
    }
    const examSubjects = patch.exam_subjects ?? (candidate.exam_subjects as string[]);
    if (patch.exempt_subjects && patch.exempt_subjects.some((code) => !examSubjects.includes(code))) {
      errors.push({ field: 'exempt_subjects', message: 'Bài được miễn phải là bài thi đã đăng ký' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const grades = patch.grades ? { ...this.gradesOf(candidate), ...patch.grades } : null;
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('graduation_candidates')
        .set({
          ...(patch.priority_points === undefined ? {} : { priority_points: patch.priority_points }),
          ...(patch.incentive_points === undefined ? {} : { incentive_points: patch.incentive_points }),
          ...(patch.exam_subjects ? { exam_subjects: JSON.stringify(patch.exam_subjects) } : {}),
          ...(patch.exempt_subjects ? { exempt_subjects: JSON.stringify(patch.exempt_subjects) } : {}),
          ...(grades ? { grade_averages: JSON.stringify(grades) } : {}),
        })
        .where('id', '=', candidateId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'graduation_candidates',
        entityId: candidateId,
        action: 'update',
        before: null,
        after: patch,
      });
    });
    return { id: candidateId };
  }

  // Số báo danh theo thứ tự lớp, họ tên cho thí sinh đủ điều kiện chưa có số; giữ số đã cấp
  async assignExamNumbers(currentUser: CurrentUser, sessionId: string, origin: ChangeOrigin) {
    await this.assertManage(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const session = await this.findSession(database, sessionId);
    this.assertOpen(session);
    if (session.school_level !== 'THPT') {
      throw rule('Số báo danh chỉ dùng cho kỳ thi tốt nghiệp THPT');
    }
    const config = await this.readConfig(database, 'THPT');
    return database.transaction().execute(async (transaction) => {
      const all = await transaction
        .selectFrom('graduation_candidates')
        .innerJoin('children', 'children.id', 'graduation_candidates.child_id')
        .innerJoin('classes', 'classes.id', 'graduation_candidates.class_id')
        .select(['graduation_candidates.id', 'graduation_candidates.exam_number', 'graduation_candidates.eligible'])
        .where('graduation_candidates.session_id', '=', sessionId)
        .orderBy('classes.name')
        .orderBy('children.full_name')
        .execute();
      let next =
        all.reduce((max, row) => {
          const digits = Number((row.exam_number ?? '').slice(config.exam_number_prefix.length));
          return Number.isFinite(digits) ? Math.max(max, digits) : max;
        }, 0) + 1;
      let assigned = 0;
      for (const row of all.filter((item) => item.eligible && !item.exam_number)) {
        await transaction
          .updateTable('graduation_candidates')
          .set({ exam_number: examNumber(config.exam_number_prefix, next) })
          .where('id', '=', row.id)
          .execute();
        next += 1;
        assigned += 1;
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'graduation_candidates',
        entityId: sessionId,
        action: 'update',
        before: null,
        after: { exam_numbers_assigned: assigned },
      });
      return { assigned };
    });
  }

  async addRoom(
    currentUser: CurrentUser,
    sessionId: string,
    input: { code: string; name: string; capacity: number; proctors: string | null },
    origin: ChangeOrigin,
  ) {
    await this.assertManage(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const session = await this.findSession(database, sessionId);
    this.assertOpen(session);
    try {
      return await database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('graduation_rooms')
          .values({ session_id: sessionId, ...input })
          .returning(['id', 'code', 'name', 'capacity', 'proctors'])
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'graduation_rooms',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return created;
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ApplicationError('ERR_CONFLICT', 'Mã phòng thi đã có trong kỳ', [
          { field: 'code', message: 'Mã phòng thi đã có trong kỳ' },
        ]);
      }
      throw error;
    }
  }

  // Xếp thí sinh đã có số báo danh vào phòng theo thứ tự số báo danh và sức chứa; thiếu chỗ thì không xếp
  async assignRooms(currentUser: CurrentUser, sessionId: string, origin: ChangeOrigin) {
    await this.assertManage(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const session = await this.findSession(database, sessionId);
    this.assertOpen(session);
    const rooms = await database
      .selectFrom('graduation_rooms')
      .select(['id', 'capacity'])
      .where('session_id', '=', sessionId)
      .orderBy('code')
      .execute();
    const candidates = await database
      .selectFrom('graduation_candidates')
      .select(['id', 'exam_number'])
      .where('session_id', '=', sessionId)
      .where('eligible', '=', true)
      .orderBy('exam_number')
      .execute();
    if (candidates.some((row) => !row.exam_number)) {
      throw rule('Còn thí sinh chưa có số báo danh; đánh số báo danh trước');
    }
    const indexes = assignRoomIndexes(
      candidates.length,
      rooms.map((room) => room.capacity),
    );
    if (!indexes) {
      throw rule('Các phòng thi không đủ chỗ cho mọi thí sinh', [
        {
          field: 'rooms',
          message: `${candidates.length} thí sinh, sức chứa ${rooms.reduce((sum, room) => sum + room.capacity, 0)}`,
        },
      ]);
    }
    await database.transaction().execute(async (transaction) => {
      for (const [position, candidate] of candidates.entries()) {
        await transaction
          .updateTable('graduation_candidates')
          .set({ room_id: rooms[indexes[position] ?? 0]?.id ?? null })
          .where('id', '=', candidate.id)
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'graduation_rooms',
        entityId: sessionId,
        action: 'update',
        before: null,
        after: { assigned: candidates.length },
      });
    });
    return { assigned: candidates.length };
  }

  async saveScores(
    currentUser: CurrentUser,
    candidateId: string,
    entries: Array<{ subject_code: string; score: number | null }>,
    origin: ChangeOrigin,
  ) {
    await this.assertManage(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const candidate = await database
      .selectFrom('graduation_candidates')
      .select(['id', 'session_id', 'eligible', 'exam_subjects', 'exempt_subjects'])
      .where('id', '=', candidateId)
      .executeTakeFirst();
    if (!candidate) {
      throw notFoundError('Không tìm thấy thí sinh', 'graduation_candidate');
    }
    this.assertOpen(await this.findSession(database, candidate.session_id));
    const taking = (candidate.exam_subjects as string[]).filter(
      (code) => !(candidate.exempt_subjects as string[]).includes(code),
    );
    const wrong = entries.filter((entry) => !taking.includes(entry.subject_code));
    if (!candidate.eligible || wrong.length > 0) {
      throw validationError(
        wrong.map((entry, index) => ({
          field: `entries[${index}].subject_code`,
          message: 'Bài thi không có trong danh sách bài thi của thí sinh hoặc được miễn',
        })),
      );
    }
    await database.transaction().execute(async (transaction) => {
      for (const entry of entries) {
        if (entry.score === null) {
          await transaction
            .deleteFrom('graduation_scores')
            .where('candidate_id', '=', candidateId)
            .where('subject_code', '=', entry.subject_code)
            .execute();
        } else {
          const values = {
            score: entry.score,
            updated_by_name: currentUser.description.full_name,
            updated_at: this.clock.now(),
          };
          await transaction
            .insertInto('graduation_scores')
            .values({ candidate_id: candidateId, subject_code: entry.subject_code, ...values })
            .onConflict((conflict) => conflict.columns(['candidate_id', 'subject_code']).doUpdateSet(values))
            .execute();
        }
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'graduation_scores',
        entityId: candidateId,
        action: 'update',
        before: null,
        after: entries,
      });
    });
    return { id: candidateId };
  }

  // Đề xuất kết quả: THCS theo điều kiện; THPT theo điểm xét; thí sinh thiếu điểm chưa có đề xuất; kết quả đã công nhận giữ nguyên
  async evaluate(currentUser: CurrentUser, sessionId: string, origin: ChangeOrigin) {
    await this.assertManage(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const session = await this.findSession(database, sessionId);
    this.assertOpen(session);
    const config = await this.readConfig(database, session.school_level);
    const candidates = await database
      .selectFrom('graduation_candidates')
      .selectAll()
      .where('session_id', '=', sessionId)
      .execute();
    const scoreRows = await database
      .selectFrom('graduation_scores')
      .innerJoin('graduation_candidates', 'graduation_candidates.id', 'graduation_scores.candidate_id')
      .select(['graduation_scores.candidate_id', 'graduation_scores.subject_code', 'graduation_scores.score'])
      .where('graduation_candidates.session_id', '=', sessionId)
      .execute();
    let proposed = 0;
    let incomplete = 0;
    await database.transaction().execute(async (transaction) => {
      for (const candidate of candidates) {
        let outcome: 'graduated' | 'not_graduated' = 'not_graduated';
        let note: string | null = null;
        let score: number | null = null;
        let examAverage: number | null = null;
        if (!candidate.eligible) {
          note = candidate.eligibility_note ?? 'Không đủ điều kiện';
        } else if (session.school_level === 'THCS') {
          outcome = 'graduated';
        } else {
          const taking = (candidate.exam_subjects as string[]).filter(
            (code) => !(candidate.exempt_subjects as string[]).includes(code),
          );
          const own = scoreRows.filter((row) => row.candidate_id === candidate.id);
          if (taking.length === 0 || taking.some((code) => !own.some((row) => row.subject_code === code))) {
            incomplete += 1;
            continue;
          }
          const result = graduationScore(
            {
              examScores: taking.map((code) => Number(own.find((row) => row.subject_code === code)?.score ?? 0)),
              incentive: Number(candidate.incentive_points),
              priority: Number(candidate.priority_points),
              schoolAverage: schoolAverage(this.gradesOf(candidate), config.grade_weights),
            },
            config,
          );
          outcome = result.passed ? 'graduated' : 'not_graduated';
          note = result.reason;
          score = result.score;
          examAverage = result.exam_average;
        }
        const current = await transaction
          .selectFrom('graduation_decisions')
          .select('status')
          .where('candidate_id', '=', candidate.id)
          .executeTakeFirst();
        if (current?.status === 'confirmed') {
          continue;
        }
        const values = {
          outcome,
          status: 'proposed' as const,
          exam_average: examAverage,
          score,
          note,
          updated_at: this.clock.now(),
        };
        await transaction
          .insertInto('graduation_decisions')
          .values({ candidate_id: candidate.id, ...values })
          .onConflict((conflict) => conflict.column('candidate_id').doUpdateSet(values))
          .execute();
        proposed += 1;
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'graduation_decisions',
        entityId: sessionId,
        action: 'update',
        before: null,
        after: { proposed, incomplete },
      });
    });
    return { proposed, incomplete };
  }

  // Hội đồng công nhận: cần biên bản họp hội đồng, mọi thí sinh đã có đề xuất; đánh số giấy chứng nhận, khoá kỳ
  async confirm(currentUser: CurrentUser, sessionId: string, origin: ChangeOrigin) {
    await this.assertManage(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const session = await this.findSession(database, sessionId);
    this.assertOpen(session);
    const config = await this.readConfig(database, session.school_level);
    const council = await database
      .selectFrom('graduation_minutes')
      .select('id')
      .where('session_id', '=', sessionId)
      .where('kind', '=', 'council')
      .executeTakeFirst();
    if (!council) {
      throw rule('Chưa có biên bản họp hội đồng xét tốt nghiệp');
    }
    const rows = await database
      .selectFrom('graduation_candidates')
      .leftJoin('graduation_decisions', 'graduation_decisions.candidate_id', 'graduation_candidates.id')
      .select(['graduation_candidates.id', 'graduation_decisions.outcome', 'graduation_decisions.certificate_no'])
      .where('graduation_candidates.session_id', '=', sessionId)
      .orderBy('graduation_candidates.exam_number')
      .orderBy('graduation_candidates.id')
      .execute();
    if (rows.length === 0 || rows.some((row) => !row.outcome)) {
      throw rule('Còn thí sinh chưa có kết quả đề xuất; xét kết quả trước');
    }
    let sequence = 0;
    return database.transaction().execute(async (transaction) => {
      const now = this.clock.now();
      for (const row of rows) {
        const certificate =
          row.outcome === 'graduated'
            ? (row.certificate_no ??
              `${config.certificate_prefix}-${session.academic_year_name}-${String((sequence += 1)).padStart(5, '0')}`)
            : null;
        await transaction
          .updateTable('graduation_decisions')
          .set({
            status: 'confirmed',
            certificate_no: certificate,
            decided_by_name: currentUser.description.full_name,
            decided_at: now,
            updated_at: now,
          })
          .where('candidate_id', '=', row.id)
          .execute();
      }
      await transaction
        .updateTable('graduation_sessions')
        .set({ status: 'finalized' })
        .where('id', '=', sessionId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'graduation_sessions',
        entityId: sessionId,
        action: 'update',
        before: { status: 'open' },
        after: { status: 'finalized', graduated: rows.filter((row) => row.outcome === 'graduated').length },
      });
      return { graduated: rows.filter((row) => row.outcome === 'graduated').length, total: rows.length };
    });
  }

  async addMinutes(
    currentUser: CurrentUser,
    sessionId: string,
    input: { kind: GraduationMinutesKind; title: string; content: string },
    origin: ChangeOrigin,
  ) {
    await this.assertManage(currentUser);
    const { database } = await this.currentSchoolYear.require();
    await this.findSession(database, sessionId);
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('graduation_minutes')
        .values({ session_id: sessionId, ...input, created_by_name: currentUser.description.full_name })
        .returning(['id', 'kind', 'title', 'created_by_name', 'created_at'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'graduation_minutes',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async minutesFile(currentUser: CurrentUser, minutesId: string) {
    this.assertView(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const minutes = await database
      .selectFrom('graduation_minutes')
      .innerJoin('graduation_sessions', 'graduation_sessions.id', 'graduation_minutes.session_id')
      .select([
        'graduation_minutes.kind',
        'graduation_minutes.title',
        'graduation_minutes.content',
        'graduation_minutes.created_by_name',
        'graduation_minutes.created_at',
        'graduation_sessions.name as session_name',
      ])
      .where('graduation_minutes.id', '=', minutesId)
      .executeTakeFirst();
    if (!minutes) {
      throw notFoundError('Không tìm thấy biên bản', 'graduation_minutes');
    }
    const pdf = await graduationMinutesPdf({
      school_name: await this.schoolName(database),
      session_name: minutes.session_name,
      kind_label: GRADUATION_MINUTES_LABELS[minutes.kind],
      title: minutes.title,
      content: minutes.content,
      author: minutes.created_by_name,
      created_at: minutes.created_at.toISOString(),
    });
    return { fileName: `bien-ban-${minutesId.slice(0, 8)}.pdf`, pdf };
  }

  async certificate(currentUser: CurrentUser, candidateId: string) {
    this.assertView(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const row = await database
      .selectFrom('graduation_candidates')
      .innerJoin('graduation_decisions', 'graduation_decisions.candidate_id', 'graduation_candidates.id')
      .innerJoin('graduation_sessions', 'graduation_sessions.id', 'graduation_candidates.session_id')
      .innerJoin('children', 'children.id', 'graduation_candidates.child_id')
      .select([
        'children.full_name',
        'children.dob',
        'children.place_of_birth',
        'children.gender',
        'graduation_decisions.outcome',
        'graduation_decisions.status',
        'graduation_decisions.score',
        'graduation_decisions.certificate_no',
        'graduation_decisions.decided_at',
        'graduation_sessions.name as session_name',
        'graduation_sessions.school_level',
      ])
      .where('graduation_candidates.id', '=', candidateId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy thí sinh', 'graduation_candidate');
    }
    if (row.status !== 'confirmed' || row.outcome !== 'graduated' || !row.certificate_no) {
      throw rule('Chỉ cấp giấy chứng nhận cho người đã được công nhận tốt nghiệp');
    }
    const pdf = await graduationCertificatePdf({
      school_name: await this.schoolName(database),
      level_label: LEVEL_LABELS[row.school_level],
      session_name: row.session_name,
      certificate_no: row.certificate_no,
      student: {
        full_name: row.full_name,
        dob: row.dob,
        place_of_birth: row.place_of_birth,
        gender: GENDER_LABELS[row.gender] ?? row.gender,
      },
      score: row.score,
      decided_at: row.decided_at ? row.decided_at.toISOString().slice(0, 10) : null,
    });
    return { fileName: `giay-chung-nhan-${row.certificate_no}.pdf`, pdf };
  }

  // Tệp xuất theo bố cục chung (danh sách thí sinh hoặc kết quả); mỗi lần xuất ghi một dòng để theo dõi trạng thái gửi
  async exportFile(currentUser: CurrentUser, sessionId: string, kind: GraduationSubmissionKind, origin: ChangeOrigin) {
    await this.assertManage(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const view = await this.view(currentUser, sessionId);
    const heading = [await this.schoolName(database), view.session.name];
    const room = (id: string | null) => view.rooms.find((item) => item.id === id)?.code ?? '';
    const nameOf = (code: string) => view.subjects.find((item) => item.code === code)?.name ?? code;
    const sheets: TableFileSheet[] =
      kind === 'candidates'
        ? [
            {
              title: 'Thí sinh',
              heading,
              numbered: true,
              columns: [
                { key: 'number', label: 'Số báo danh', width: 14 },
                { key: 'name', label: 'Họ và tên', width: 28 },
                { key: 'class', label: 'Lớp', width: 12 },
                { key: 'eligible', label: 'Đủ điều kiện', width: 14 },
                { key: 'subjects', label: 'Bài thi', width: 40 },
                { key: 'exempt', label: 'Miễn thi', width: 24 },
                { key: 'priority', label: 'Điểm ưu tiên', width: 12 },
                { key: 'incentive', label: 'Điểm khuyến khích', width: 14 },
                { key: 'room', label: 'Phòng thi', width: 12 },
              ],
              rows: view.candidates.map((row) => ({
                number: row.exam_number ?? '',
                name: row.full_name,
                class: row.class_name,
                eligible: row.eligible ? 'Có' : `Không: ${row.eligibility_note ?? ''}`,
                subjects: (row.exam_subjects as string[]).map(nameOf).join('; '),
                exempt: (row.exempt_subjects as string[]).map(nameOf).join('; '),
                priority: row.priority_points,
                incentive: row.incentive_points,
                room: room(row.room_id),
              })),
            },
          ]
        : [
            {
              title: 'Kết quả',
              heading,
              numbered: true,
              columns: [
                { key: 'number', label: 'Số báo danh', width: 14 },
                { key: 'name', label: 'Họ và tên', width: 28 },
                { key: 'class', label: 'Lớp', width: 12 },
                { key: 'scores', label: 'Điểm các bài thi', width: 40 },
                { key: 'school', label: 'Điểm trung bình các năm', width: 16 },
                { key: 'score', label: 'Điểm xét tốt nghiệp', width: 16 },
                { key: 'outcome', label: 'Kết quả', width: 30 },
                { key: 'certificate', label: 'Số giấy chứng nhận', width: 22 },
              ],
              rows: view.candidates.map((row) => ({
                number: row.exam_number ?? '',
                name: row.full_name,
                class: row.class_name,
                scores: row.scores.map((item) => `${nameOf(item.subject_code)} ${item.score}`).join('; '),
                school: row.school_average ?? '',
                score: row.decision?.score ?? '',
                outcome: row.decision
                  ? row.decision.outcome === 'graduated'
                    ? `Tốt nghiệp${row.decision.status === 'proposed' ? ' (đề xuất)' : ''}`
                    : `Chưa tốt nghiệp${row.decision.note ? `: ${row.decision.note}` : ''}`
                  : 'Chưa xét',
                certificate: row.decision?.certificate_no ?? '',
              })),
            },
          ];
    const buffer = await buildTableFile('xlsx', sheets, this.clock.now());
    const fileName = `${kind === 'candidates' ? 'thi-sinh' : 'ket-qua'}-${view.session.school_level.toLowerCase()}-${view.session.academic_year_name.replace(/[^0-9A-Za-z]+/g, '-')}.xlsx`;
    await database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('graduation_submissions')
        .values({
          session_id: sessionId,
          kind,
          file_name: fileName,
          exported_by_name: currentUser.description.full_name,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'graduation_submissions',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { kind, file_name: fileName },
      });
    });
    return { fileName, buffer };
  }

  async markSent(currentUser: CurrentUser, submissionId: string, note: string | null, origin: ChangeOrigin) {
    await this.assertManage(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const row = await database
      .selectFrom('graduation_submissions')
      .select(['id', 'status'])
      .where('id', '=', submissionId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy tệp đã xuất', 'graduation_submission');
    }
    if (row.status === 'sent') {
      throw rule('Tệp đã đánh dấu đã gửi');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('graduation_submissions')
        .set({ status: 'sent', sent_by_name: currentUser.description.full_name, sent_at: this.clock.now(), note })
        .where('id', '=', submissionId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'graduation_submissions',
        entityId: submissionId,
        action: 'update',
        before: { status: 'exported' },
        after: { status: 'sent', note },
      });
    });
    return { id: submissionId, status: 'sent' };
  }

  // Hồ sơ chuyển cấp lên THPT của học sinh THCS đã được công nhận tốt nghiệp: cần học bạ năm học đã kí và giấy chứng nhận
  async prepareDossiers(currentUser: CurrentUser, sessionId: string, destination: string | null, origin: ChangeOrigin) {
    await this.assertManage(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const session = await this.findSession(database, sessionId);
    if (session.school_level !== 'THCS') {
      throw rule('Hồ sơ chuyển cấp chỉ lập cho học sinh THCS tốt nghiệp');
    }
    if (session.status !== 'finalized') {
      throw rule('Chỉ lập hồ sơ chuyển cấp sau khi hội đồng công nhận tốt nghiệp');
    }
    const graduates = await database
      .selectFrom('graduation_candidates')
      .innerJoin('graduation_decisions', 'graduation_decisions.candidate_id', 'graduation_candidates.id')
      .innerJoin('children', 'children.id', 'graduation_candidates.child_id')
      .select(['graduation_candidates.child_id', 'children.full_name', 'graduation_decisions.certificate_no'])
      .where('graduation_candidates.session_id', '=', sessionId)
      .where('graduation_decisions.outcome', '=', 'graduated')
      .where('graduation_decisions.status', '=', 'confirmed')
      .execute();
    const signed = new Set(
      (
        await database
          .selectFrom('learning_records')
          .select('child_id')
          .where('academic_year_name', '=', session.academic_year_name)
          .where('status', '=', 'signed')
          .execute()
      ).map((row) => row.child_id),
    );
    const skipped: Array<{ child_id: string; full_name: string; reason: string }> = [];
    let created = 0;
    await database.transaction().execute(async (transaction) => {
      for (const graduate of graduates) {
        if (!signed.has(graduate.child_id)) {
          skipped.push({
            child_id: graduate.child_id,
            full_name: graduate.full_name,
            reason: 'Học bạ năm học chưa được Hiệu trưởng kí',
          });
          continue;
        }
        const inserted = await transaction
          .insertInto('transfer_dossiers')
          .values({
            session_id: sessionId,
            child_id: graduate.child_id,
            destination,
            prepared_by_name: currentUser.description.full_name,
          })
          .onConflict((conflict) => conflict.columns(['session_id', 'child_id']).doNothing())
          .returning('id')
          .executeTakeFirst();
        if (inserted) {
          created += 1;
        }
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'transfer_dossiers',
        entityId: sessionId,
        action: 'create',
        before: null,
        after: { created, skipped: skipped.length },
      });
    });
    return { created, skipped };
  }

  async markDossierSent(currentUser: CurrentUser, dossierId: string, origin: ChangeOrigin) {
    await this.assertManage(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const row = await database
      .selectFrom('transfer_dossiers')
      .select(['id', 'status'])
      .where('id', '=', dossierId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy hồ sơ chuyển cấp', 'transfer_dossier');
    }
    if (row.status === 'sent') {
      throw rule('Hồ sơ đã đánh dấu đã gửi');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('transfer_dossiers')
        .set({ status: 'sent', sent_at: this.clock.now() })
        .where('id', '=', dossierId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'transfer_dossiers',
        entityId: dossierId,
        action: 'update',
        before: { status: 'prepared' },
        after: { status: 'sent' },
      });
    });
    return { id: dossierId, status: 'sent' };
  }
}

function levelOf(value: unknown): GraduationLevel {
  if (value === 'THCS' || value === 'THPT') {
    return value;
  }
  throw validationError([{ field: 'school_level', message: 'Cấp học là THCS hoặc THPT' }]);
}

function throwIf(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

function sendFile(response: Response, contentType: string, fileName: string, data: Buffer) {
  response.setHeader('Content-Type', contentType);
  response.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/[^0-9A-Za-z._-]+/g, '-')}"`);
  response.send(data);
}

function readPoints(value: unknown, field: string, errors: FieldError[]): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 10 ||
    Math.round(value * 100) !== value * 100
  ) {
    errors.push({ field, message: 'Điểm từ 0 đến 10, tối đa hai chữ số thập phân' });
    return undefined;
  }
  return value;
}

function readCodes(value: unknown, field: string, errors: FieldError[]): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.length === 0 || item.length > 30)
  ) {
    errors.push({ field, message: 'Danh sách mã môn' });
    return undefined;
  }
  return [...new Set(value as string[])];
}

@Controller('graduation')
export class GraduationController {
  constructor(private readonly graduation: GraduationService) {}

  @Get('config')
  async config(@Query('school_level') level: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    const parsed = levelOf(level);
    if (
      !currentUser.hasPermission(PERMISSION_CODES.assessmentView) &&
      !currentUser.hasPermission(PERMISSION_CODES.studentRecordApprove)
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được cấu hình xét tốt nghiệp');
    }
    return { school_level: parsed, config: await this.graduation.config(parsed) };
  }

  @Put('config')
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  async saveConfig(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const level = levelOf(body?.school_level);
    throwIf(validateGraduationConfig(body?.config, level));
    const config = await this.graduation.saveConfig(
      level,
      body?.config as GraduationConfig,
      currentUser,
      originOf(request, currentUser),
    );
    return { school_level: level, config };
  }

  @Get('sessions')
  sessions(@Query('school_level') level: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.graduation.sessions(currentUser, levelOf(level));
  }

  @Post('sessions')
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  createSession(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const level = levelOf(body?.school_level);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (name.length === 0 || name.length > 200) {
      errors.push({ field: 'name', message: 'Tên kỳ từ 1 đến 200 ký tự' });
    }
    const examDate =
      body?.exam_date === undefined || body.exam_date === null || body.exam_date === '' ? null : String(body.exam_date);
    if (examDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) {
      errors.push({ field: 'exam_date', message: 'Ngày theo dạng YYYY-MM-DD' });
    }
    throwIf(errors);
    return this.graduation.createSession(currentUser, { level, name, examDate }, originOf(request, currentUser));
  }

  @Get('sessions/:id')
  view(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) sessionId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.graduation.view(currentUser, sessionId);
  }

  @Post('sessions/:id/candidates/generate')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  generate(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) sessionId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.graduation.generateCandidates(currentUser, sessionId, originOf(request, currentUser));
  }

  @Patch('candidates/:id')
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  updateCandidate(
    @Param('id', uuidParameter('Mã thí sinh không hợp lệ')) candidateId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const grades: Partial<Record<'g10' | 'g11' | 'g12', number | null>> = {};
    if (body?.grades !== undefined) {
      const raw = (typeof body.grades === 'object' && body.grades !== null ? body.grades : {}) as Record<
        string,
        unknown
      >;
      for (const key of ['g10', 'g11', 'g12'] as const) {
        if (raw[key] === undefined) {
          continue;
        }
        if (raw[key] === null) {
          grades[key] = null;
        } else {
          const value = readPoints(raw[key], `grades.${key}`, errors);
          if (value !== undefined) {
            grades[key] = value;
          }
        }
      }
    }
    const patch = {
      priority_points: readPoints(body?.priority_points, 'priority_points', errors),
      incentive_points: readPoints(body?.incentive_points, 'incentive_points', errors),
      exam_subjects: readCodes(body?.exam_subjects, 'exam_subjects', errors),
      exempt_subjects: readCodes(body?.exempt_subjects, 'exempt_subjects', errors),
      grades: body?.grades === undefined ? undefined : grades,
    };
    throwIf(errors);
    return this.graduation.updateCandidate(currentUser, candidateId, patch, originOf(request, currentUser));
  }

  @Put('candidates/:id/scores')
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  saveScores(
    @Param('id', uuidParameter('Mã thí sinh không hợp lệ')) candidateId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!Array.isArray(body?.scores) || body.scores.length === 0 || body.scores.length > 20) {
      throw validationError([{ field: 'scores', message: 'Cần danh sách điểm tối đa 20 bài thi' }]);
    }
    const entries = (body.scores as unknown[]).map((value, index) => {
      const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
      if (typeof item.subject_code !== 'string' || item.subject_code.length === 0) {
        errors.push({ field: `scores[${index}].subject_code`, message: 'Bắt buộc chọn bài thi' });
      }
      const score =
        item.score === null || item.score === undefined || item.score === ''
          ? null
          : (() => {
              const number = item.score;
              if (typeof number !== 'number' || number < 0 || number > 10 || Math.round(number * 10) !== number * 10) {
                errors.push({ field: `scores[${index}].score`, message: 'Điểm từ 0 đến 10, một chữ số thập phân' });
                return null;
              }
              return number;
            })();
      return { subject_code: String(item.subject_code), score };
    });
    throwIf(errors);
    return this.graduation.saveScores(currentUser, candidateId, entries, originOf(request, currentUser));
  }

  @Post('sessions/:id/exam-numbers')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  examNumbers(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) sessionId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.graduation.assignExamNumbers(currentUser, sessionId, originOf(request, currentUser));
  }

  @Post('sessions/:id/rooms')
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  addRoom(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) sessionId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (code.length === 0 || code.length > 30) {
      errors.push({ field: 'code', message: 'Mã phòng từ 1 đến 30 ký tự' });
    }
    if (name.length === 0 || name.length > 200) {
      errors.push({ field: 'name', message: 'Tên phòng từ 1 đến 200 ký tự' });
    }
    const capacity = body?.capacity;
    if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
      errors.push({ field: 'capacity', message: 'Sức chứa từ 1 đến 100' });
    }
    const proctors =
      typeof body?.proctors === 'string' && body.proctors.trim() ? body.proctors.trim().slice(0, 500) : null;
    throwIf(errors);
    return this.graduation.addRoom(
      currentUser,
      sessionId,
      { code, name, capacity: capacity as number, proctors },
      originOf(request, currentUser),
    );
  }

  @Post('sessions/:id/rooms/assign')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  assignRooms(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) sessionId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.graduation.assignRooms(currentUser, sessionId, originOf(request, currentUser));
  }

  @Post('sessions/:id/evaluate')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  evaluate(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) sessionId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.graduation.evaluate(currentUser, sessionId, originOf(request, currentUser));
  }

  @Post('sessions/:id/confirm')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  confirm(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) sessionId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.graduation.confirm(currentUser, sessionId, originOf(request, currentUser));
  }

  @Post('sessions/:id/minutes')
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  addMinutes(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) sessionId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const kind = body?.kind;
    if (kind !== 'council' && kind !== 'exam_room' && kind !== 'scoring') {
      errors.push({ field: 'kind', message: 'Loại là council, exam_room hoặc scoring' });
    }
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    if (title.length === 0 || title.length > 200) {
      errors.push({ field: 'title', message: 'Tiêu đề từ 1 đến 200 ký tự' });
    }
    if (content.length === 0 || content.length > 8000) {
      errors.push({ field: 'content', message: 'Nội dung từ 1 đến 8000 ký tự' });
    }
    throwIf(errors);
    return this.graduation.addMinutes(
      currentUser,
      sessionId,
      { kind: kind as GraduationMinutesKind, title, content },
      originOf(request, currentUser),
    );
  }

  @Get('minutes/:id/file')
  async minutesFile(
    @Param('id', uuidParameter('Mã biên bản không hợp lệ')) minutesId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const file = await this.graduation.minutesFile(currentUser, minutesId);
    sendFile(response, CONTENT_TYPES.pdf, file.fileName, file.pdf);
  }

  @Get('candidates/:id/certificate')
  async certificate(
    @Param('id', uuidParameter('Mã thí sinh không hợp lệ')) candidateId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const file = await this.graduation.certificate(currentUser, candidateId);
    sendFile(response, CONTENT_TYPES.pdf, file.fileName, file.pdf);
  }

  @Get('sessions/:id/export')
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  async exportFile(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) sessionId: string,
    @Query('kind') kind: string | undefined,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    if (kind !== 'candidates' && kind !== 'results') {
      throw validationError([
        { field: 'kind', message: `Loại tệp là ${Object.keys(GRADUATION_SUBMISSION_LABELS).join(' hoặc ')}` },
      ]);
    }
    const file = await this.graduation.exportFile(currentUser, sessionId, kind, originOf(request, currentUser));
    sendFile(response, CONTENT_TYPES.xlsx, file.fileName, file.buffer);
  }

  @Post('submissions/:id/mark-sent')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  markSent(
    @Param('id', uuidParameter('Mã tệp không hợp lệ')) submissionId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
    return this.graduation.markSent(currentUser, submissionId, note, originOf(request, currentUser));
  }

  @Post('sessions/:id/transfer-dossiers')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  prepareDossiers(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) sessionId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const destination =
      typeof body?.destination === 'string' && body.destination.trim() ? body.destination.trim().slice(0, 300) : null;
    return this.graduation.prepareDossiers(currentUser, sessionId, destination, originOf(request, currentUser));
  }

  @Post('transfer-dossiers/:id/mark-sent')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  markDossierSent(
    @Param('id', uuidParameter('Mã hồ sơ không hợp lệ')) dossierId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.graduation.markDossierSent(currentUser, dossierId, originOf(request, currentUser));
  }
}
