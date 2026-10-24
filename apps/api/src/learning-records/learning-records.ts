import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { SchoolYearDatabase, SupportPlan } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  COMPETENCY_GROUP_LABELS,
  COMPLETION_OUTCOME_LABELS,
  PERMISSION_CODES,
  RATING_LABELS,
  SIGNING_SIGNATURE_TYPE_LABELS,
  STUDENT_AWARD_DEFAULTS,
  YEAR_RESULT_LABELS,
  completionOutcome,
  isSigningProvider,
  nextGradeLevel,
  SECONDARY_AWARD_RULE,
  secondaryAwardBases,
  secondaryPassed,
  SUBJECT_PASS_LABELS,
  type SchoolLevelCode,
  type StudentAwardBasis,
  type YearResultCode,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { createHash, randomUUID } from 'node:crypto';
import { AdmissionsRateLimiter } from '../admissions/public-rate-limit.js';
import { AuthenticatedUser, PublicEndpoint, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { assertLevelEnabled, readSchoolLevel } from '../catalogs/school-level-fields.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection, maskNationalId } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { writeDataAccessLog } from '../common/data-access-log.js';
import { Databases } from '../common/databases.js';
import {
  isUuid,
  notFoundError,
  readOptionalText,
  readRequiredText,
  readStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { storageKey } from '../common/resource-names.js';
import { SchoolLevelResolver } from '../common/school-levels.js';
import { ScoresService } from '../scores/scores.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { certificatePdf } from '../emulation/emulation-documents.js';
import { CONTENT_TYPES } from '../exports/table-file.js';
import { FileStorage } from '../files/file-storage.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { verificationCode } from '../outgoing-documents/outgoing-documents.js';
import { DossierSigner } from '../signing/dossier-signer.js';
import { learningRecordPdf, learningRecordSheets, type LearningRecordContent } from './learning-record-pdf.js';

// Học bạ số, khen thưởng cuối năm, hoàn thành chương trình lớp học, chương trình tiểu học; lên lớp, rèn luyện trong hè, kiểm
// tra lại (DT-20 phần 20e, YCTD-163). Mọi thứ đọc kết quả đánh giá của kỳ cuối năm đã khoá và kết quả cuối năm giáo viên chủ
// nhiệm đã xác nhận (20c). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - giáo viên chủ nhiệm (phân công chủ nhiệm, có `P02.assessment.enter`) đề nghị khen thưởng, ghi kết quả rèn luyện trong hè,
//   kiểm tra lại, lập học bạ, ghi nhận xét; Ban Giám hiệu (`P02.student-record.approve`) làm thay và duyệt khen thưởng, xác
//   nhận, kí học bạ, mở lại học bạ đã kí kèm lý do; xem: `P02.assessment.view` trong phạm vi đơn vị;
// - danh hiệu cuối năm có căn cứ "xuất sắc" chỉ cho học sinh có kết quả cuối năm Hoàn thành xuất sắc; căn cứ "tiêu biểu" cho
//   học sinh Hoàn thành tốt trở lên kèm thành tích (bắt buộc ghi); khen thưởng đột xuất không cần kết quả cuối năm;
// - THCS, THPT (DT-21 phần 21e, YCTD-172) dùng cùng bảng, quy trình: kết quả cuối năm đọc từ sổ điểm 21c (học kỳ II đã khoá,
//   xếp loại học tập, rèn luyện cả năm giáo viên chủ nhiệm đã xác nhận); danh hiệu Xuất sắc, Giỏi và điều kiện lên lớp theo
//   Thông tư 22/2021 (học tập, rèn luyện cả năm từ Đạt trở lên); học bạ có bảng điểm trung bình hai học kỳ, cả năm
// - số định danh in đủ khi người xem, người kí có quyền xem số định danh trong phạm vi đơn vị (ghi nhật ký truy cập), còn lại
//   in che; tệp đã kí in đủ nên chỉ người có quyền xem số định danh hoặc phụ huynh của học sinh tải được
export const LEARNING_RECORD_RULE_CODE = 'YCTD-163';
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
const CODE_PATTERN = /^[A-Z0-9]{12}$/;
const AWARD_BASES: StudentAwardBasis[] = ['excellent', 'outstanding', 'secondary_excellent', 'secondary_good'];
const SECONDARY_EXCELLENT_AVERAGE = SECONDARY_AWARD_RULE.excellent_min_average;
const GENDER_LABELS: Record<string, string> = { male: 'Nam', female: 'Nữ' };

interface ClassContext {
  id: string;
  name: string;
  org_unit_id: string;
  grade_level: string;
  school_level: SchoolLevelCode;
}

interface Access {
  approve: boolean;
  homeroom: boolean;
  view: boolean;
}

function rule(message: string, details: FieldError[] = []) {
  return ruleViolationError(LEARNING_RECORD_RULE_CODE, message, details);
}

@Injectable()
export class LearningRecordsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly organizationScopes: OrganizationScopes,
    private readonly schoolLevels: SchoolLevelResolver,
    private readonly protection: ChildDataProtection,
    private readonly fileStorage: FileStorage,
    private readonly signer: DossierSigner,
    private readonly clock: Clock,
    private readonly scores: ScoresService,
  ) {}

  private today(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(this.clock.now());
  }

  private async inScope(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<boolean> {
    if (!currentUser.hasPermission(permission)) {
      return false;
    }
    const scope = await this.organizationScopes.resolve(currentUser, permission);
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }

  private async findClass(database: Executor, classId: string): Promise<ClassContext> {
    const row = await database
      .selectFrom('classes')
      .select(['id', 'name', 'org_unit_id', 'grade_level', 'school_level'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    return row as ClassContext;
  }

  private async access(database: Executor, currentUser: CurrentUser, classRow: ClassContext): Promise<Access> {
    const approve = await this.inScope(currentUser, PERMISSION_CODES.studentRecordApprove, classRow.org_unit_id);
    const homeroom =
      currentUser.hasPermission(PERMISSION_CODES.assessmentEnter) &&
      Boolean(
        await database
          .selectFrom('class_staff_assignments')
          .select('id')
          .where('class_id', '=', classRow.id)
          .where('staff_user_id', '=', currentUser.id)
          .where('assignment_role', '=', 'homeroom')
          .where('status', '=', 'active')
          .executeTakeFirst(),
      );
    const view =
      approve || homeroom || (await this.inScope(currentUser, PERMISSION_CODES.assessmentView, classRow.org_unit_id));
    return { approve, homeroom, view };
  }

  private async assertView(database: Executor, currentUser: CurrentUser, classRow: ClassContext) {
    const access = await this.access(database, currentUser, classRow);
    if (!access.view) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được kết quả cuối năm của lớp này');
    }
    return access;
  }

  private assertEdit(access: Access) {
    if (!access.approve && !access.homeroom) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên chủ nhiệm hoặc Ban Giám hiệu làm việc này');
    }
  }

  // Kỳ cuối năm của cấp và trạng thái khoá của lớp; học bạ, hoàn thành chương trình chỉ làm khi kỳ cuối năm đã khoá
  private isSecondary(level: SchoolLevelCode): boolean {
    return level === 'THCS' || level === 'THPT';
  }

  private async yearEnd(database: Executor, classRow: ClassContext) {
    if (this.isSecondary(classRow.school_level)) {
      return {
        period: { id: 'second_term', name: 'Học kỳ II' },
        locked: await this.scores.isYearLocked(database, classRow.id),
      };
    }
    const period = await database
      .selectFrom('assessment_periods')
      .select(['id', 'name'])
      .where('school_level', '=', classRow.school_level)
      .where('is_year_end', '=', true)
      .orderBy('order_no', 'desc')
      .executeTakeFirst();
    const locked = period
      ? Boolean(
          await database
            .selectFrom('assessment_locks')
            .select('class_id')
            .where('period_id', '=', period.id)
            .where('class_id', '=', classRow.id)
            .executeTakeFirst(),
        )
      : false;
    return { period: period ?? null, locked };
  }

  private async assertYearEndLocked(database: Executor, classRow: ClassContext) {
    const yearEnd = await this.yearEnd(database, classRow);
    if (!yearEnd.period || !yearEnd.locked) {
      throw rule(
        this.isSecondary(classRow.school_level)
          ? 'Học kỳ II của lớp chưa khoá điểm; Ban Giám hiệu khoá ở Sổ điểm trước'
          : 'Kỳ cuối năm của lớp chưa khoá số liệu; Ban Giám hiệu khoá ở Đánh giá học sinh trước',
      );
    }
    return yearEnd.period;
  }

  // Học sinh của lớp kèm kết quả cuối năm: Tiểu học đọc kết quả hoàn thành chương trình (20c), THCS, THPT đọc xếp loại học
  // tập, rèn luyện cả năm (21c). `has_result`: đã có kết quả đã xác nhận; `needs_support`: chưa đạt, cần rèn luyện hoặc kiểm tra lại
  private async students(database: Executor, classRow: { id: string; school_level: SchoolLevelCode }) {
    const classId = classRow.id;
    const rows = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .leftJoin('year_results', (join) =>
        join.onRef('year_results.child_id', '=', 'children.id').on('year_results.class_id', '=', classId),
      )
      .leftJoin('term_ratings', (join) =>
        join
          .onRef('term_ratings.child_id', '=', 'children.id')
          .on('term_ratings.class_id', '=', classId)
          .on('term_ratings.term_type', '=', 'year'),
      )
      .select([
        'children.id as child_id',
        'children.full_name',
        'year_results.result as year_result',
        'term_ratings.learning',
        'term_ratings.conduct',
      ])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .where('children.deleted_at', 'is', null)
      .orderBy('children.full_name')
      .execute();
    const secondary = this.isSecondary(classRow.school_level);
    return rows.map((row) => {
      const passed = secondary ? secondaryPassed(row.learning, row.conduct) : null;
      return {
        child_id: row.child_id,
        full_name: row.full_name,
        year_result: secondary ? null : row.year_result,
        learning: secondary ? row.learning : null,
        conduct: secondary ? row.conduct : null,
        has_result: secondary ? passed !== null : Boolean(row.year_result),
        needs_support: secondary ? passed === false : row.year_result === 'not_completed',
        year_label:
          secondary && row.learning && row.conduct
            ? `Học tập: ${RATING_LABELS[row.learning]}; rèn luyện: ${RATING_LABELS[row.conduct]}`
            : null,
      };
    });
  }

  // Kết quả cuối năm của THCS, THPT để xét danh hiệu: học tập, rèn luyện đã xác nhận, số môn tính điểm có trung bình cả năm
  // từ ngưỡng của danh hiệu Xuất sắc
  private async secondaryFacts(database: Executor, classRow: ClassContext) {
    const summary = await this.scores.summariesFor(database, classRow.id, 'year');
    const electives = new Set(
      summary.subjects.filter((subject) => subject.is_elective).map((subject) => subject.subject_id),
    );
    return new Map(
      summary.rows.map((row) => [
        row.child_id,
        {
          learning: row.learning,
          conduct: row.conduct,
          highSubjects: row.subjects.filter(
            (item) =>
              item.mode === 'score' &&
              !electives.has(item.subject_id) &&
              item.average !== null &&
              item.average >= SECONDARY_EXCELLENT_AVERAGE,
          ).length,
        },
      ]),
    );
  }

  // ---------- Danh hiệu khen thưởng ----------

  async titles(level: SchoolLevelCode) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    return current.database
      .selectFrom('student_award_titles')
      .select(['id', 'school_level', 'code', 'name', 'kind', 'basis', 'order_no', 'status'])
      .where('school_level', '=', level)
      .orderBy('order_no')
      .orderBy('code')
      .execute();
  }

  async loadTitleDefaults(level: SchoolLevelCode, origin: ChangeOrigin) {
    await assertLevelEnabled(this.schoolLevels, level);
    const defaults = STUDENT_AWARD_DEFAULTS[level] ?? [];
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      const existing = new Set(
        (
          await transaction
            .selectFrom('student_award_titles')
            .select('code')
            .where('school_level', '=', level)
            .execute()
        ).map((row) => row.code),
      );
      const rows = defaults
        .map((item, index) => ({ ...item, school_level: level, order_no: index + 1 }))
        .filter((item) => !existing.has(item.code));
      if (rows.length > 0) {
        await transaction.insertInto('student_award_titles').values(rows).execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'student_award_titles',
        entityId: '00000000-0000-0000-0000-000000000163',
        action: 'create',
        before: null,
        after: { school_level: level, created: rows.map((row) => row.code) },
      });
      return { created: rows.length };
    });
  }

  async createTitle(
    input: {
      school_level: SchoolLevelCode;
      code: string;
      name: string;
      kind: 'year_end' | 'special';
      basis: StudentAwardBasis | null;
    },
    origin: ChangeOrigin,
  ) {
    await assertLevelEnabled(this.schoolLevels, input.school_level);
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      const duplicate = await transaction
        .selectFrom('student_award_titles')
        .select('id')
        .where('school_level', '=', input.school_level)
        .where('code', '=', input.code)
        .executeTakeFirst();
      if (duplicate) {
        throw validationError([{ field: 'code', message: 'Mã danh hiệu đã có' }]);
      }
      const created = await transaction
        .insertInto('student_award_titles')
        .values({ ...input, order_no: 100 })
        .returning(['id', 'school_level', 'code', 'name', 'kind', 'basis', 'order_no', 'status'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'student_award_titles',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async updateTitle(titleId: string, changes: { name?: string; status?: 'active' | 'inactive' }, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const before = await database
      .selectFrom('student_award_titles')
      .selectAll()
      .where('id', '=', titleId)
      .executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy danh hiệu', 'student_award_title');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('student_award_titles')
        .set(changes)
        .where('id', '=', titleId)
        .returning(['id', 'school_level', 'code', 'name', 'kind', 'basis', 'order_no', 'status'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'student_award_titles',
        entityId: titleId,
        action: 'update',
        before,
        after: updated,
      });
      return updated;
    });
  }

  // ---------- Khen thưởng của lớp ----------

  async classAwards(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const access = await this.assertView(database, currentUser, classRow);
    const facts = this.isSecondary(classRow.school_level) ? await this.secondaryFacts(database, classRow) : null;
    const [students, titles, awards] = await Promise.all([
      this.students(database, classRow),
      database
        .selectFrom('student_award_titles')
        .select(['id', 'code', 'name', 'kind', 'basis'])
        .where('school_level', '=', classRow.school_level)
        .where('status', '=', 'active')
        .orderBy('order_no')
        .execute(),
      database
        .selectFrom('student_awards')
        .select([
          'id',
          'child_id',
          'title_id',
          'title_name',
          'achievement',
          'status',
          'proposed_by_name',
          'decided_by_name',
          'decision_note',
          'lookup_code',
        ])
        .where('class_id', '=', classId)
        .orderBy('proposed_at')
        .execute(),
    ]);
    return {
      class: classRow,
      access,
      titles,
      rows: students.map((student) => ({
        ...student,
        // Gợi ý theo Điều 15: Hoàn thành xuất sắc là học sinh Xuất sắc; Hoàn thành tốt là ứng viên học sinh Tiêu biểu
        suggested_title_ids: titles
          .filter((title) => {
            const fact = facts?.get(student.child_id);
            if (fact) {
              // Gợi ý danh hiệu cao nhất đủ điều kiện
              return title.basis === secondaryAwardBases(fact)[0];
            }
            return (
              (title.basis === 'excellent' && student.year_result === 'excellent') ||
              (title.basis === 'outstanding' && student.year_result === 'good')
            );
          })
          .map((title) => title.id),
        awards: awards.filter((award) => award.child_id === student.child_id),
      })),
    };
  }

  async propose(
    currentUser: CurrentUser,
    classId: string,
    input: { childId: string; titleId: string; achievement: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const access = await this.access(database, currentUser, classRow);
    this.assertEdit(access);
    const title = await database
      .selectFrom('student_award_titles')
      .select(['id', 'name', 'kind', 'basis', 'school_level', 'status'])
      .where('id', '=', input.titleId)
      .executeTakeFirst();
    if (!title || title.status !== 'active' || title.school_level !== classRow.school_level) {
      throw validationError([
        { field: 'title_id', message: 'Danh hiệu không có, đã ngừng dùng hoặc khác cấp của lớp' },
      ]);
    }
    const student = (await this.students(database, classRow)).find((row) => row.child_id === input.childId);
    if (!student) {
      throw validationError([{ field: 'child_id', message: 'Học sinh không học lớp này' }]);
    }
    if (title.kind === 'year_end') {
      await this.assertYearEndLocked(database, classRow);
      if (title.basis === 'secondary_excellent' || title.basis === 'secondary_good') {
        const fact = (await this.secondaryFacts(database, classRow)).get(input.childId);
        const bases = fact ? (secondaryAwardBases(fact) as string[]) : [];
        if (!bases.includes(title.basis)) {
          throw rule(
            title.basis === 'secondary_excellent'
              ? `Danh hiệu này cần học tập, rèn luyện cả năm Tốt và ít nhất ${SECONDARY_AWARD_RULE.excellent_min_subjects} môn có điểm trung bình cả năm từ ${SECONDARY_AWARD_RULE.excellent_min_average}`
              : 'Danh hiệu này cần học tập, rèn luyện cả năm đều Tốt',
          );
        }
      } else if (title.basis === 'excellent' && student.year_result !== 'excellent') {
        throw rule('Danh hiệu này chỉ cho học sinh có kết quả cuối năm Hoàn thành xuất sắc');
      }
      if (title.basis === 'outstanding') {
        if (student.year_result !== 'good' && student.year_result !== 'excellent') {
          throw rule('Danh hiệu này chỉ cho học sinh có kết quả cuối năm Hoàn thành tốt trở lên');
        }
        if (!input.achievement) {
          throw validationError([{ field: 'achievement', message: 'Ghi thành tích nổi bật hoặc tiến bộ vượt bậc' }]);
        }
      }
    }
    if (title.kind === 'special' && !input.achievement) {
      throw validationError([{ field: 'achievement', message: 'Ghi thành tích được khen thưởng' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const duplicate = await transaction
        .selectFrom('student_awards')
        .select('id')
        .where('child_id', '=', input.childId)
        .where('title_id', '=', input.titleId)
        .where('status', '<>', 'rejected')
        .executeTakeFirst();
      if (duplicate) {
        throw rule('Học sinh đã được đề nghị danh hiệu này');
      }
      const created = await transaction
        .insertInto('student_awards')
        .values({
          class_id: classId,
          child_id: input.childId,
          title_id: input.titleId,
          title_name: title.name,
          achievement: input.achievement,
          proposed_by: currentUser.id,
          proposed_by_name: currentUser.description.full_name,
        })
        .returning(['id', 'child_id', 'title_id', 'title_name', 'achievement', 'status'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'student_awards',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async decide(
    currentUser: CurrentUser,
    awardId: string,
    input: { approve: boolean; note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const award = await database.selectFrom('student_awards').selectAll().where('id', '=', awardId).executeTakeFirst();
    if (!award) {
      throw notFoundError('Không tìm thấy đề nghị khen thưởng', 'student_award');
    }
    const classRow = await this.findClass(database, award.class_id);
    if (!(await this.inScope(currentUser, PERMISSION_CODES.studentRecordApprove, classRow.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Lớp ngoài phạm vi của bạn');
    }
    if (award.status !== 'proposed') {
      throw rule('Đề nghị đã được xử lý');
    }
    if (!input.approve && !input.note) {
      throw validationError([{ field: 'note', message: 'Ghi lý do không duyệt' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('student_awards')
        .set({
          status: input.approve ? 'approved' : 'rejected',
          decided_by: currentUser.id,
          decided_by_name: currentUser.description.full_name,
          decided_at: this.clock.now(),
          decision_note: input.note,
          lookup_code: input.approve ? verificationCode() : null,
        })
        .where('id', '=', awardId)
        .returning(['id', 'status', 'lookup_code', 'decided_by_name'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'student_awards',
        entityId: awardId,
        action: 'update',
        before: award,
        after: updated,
      });
      return updated;
    });
  }

  private async schoolName(database: Executor): Promise<string> {
    const root = await database
      .selectFrom('org_units')
      .select('name')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    return root?.name ?? 'Trường';
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

  // Giấy khen của danh hiệu đã duyệt, có mã tra cứu (mẫu giấy khen của 22d)
  async certificate(currentUser: CurrentUser, awardId: string) {
    const { database } = await this.currentSchoolYear.require();
    const award = await database
      .selectFrom('student_awards')
      .innerJoin('children', 'children.id', 'student_awards.child_id')
      .innerJoin('classes', 'classes.id', 'student_awards.class_id')
      .select([
        'student_awards.id',
        'student_awards.class_id',
        'student_awards.child_id',
        'student_awards.title_name',
        'student_awards.status',
        'student_awards.lookup_code',
        'student_awards.decided_at',
        'student_awards.decided_by_name',
        'children.full_name',
        'classes.name as class_name',
      ])
      .where('student_awards.id', '=', awardId)
      .executeTakeFirst();
    if (!award || award.status !== 'approved' || !award.lookup_code) {
      throw notFoundError('Không có giấy khen đã duyệt', 'student_award');
    }
    if (!(await this.isGuardian(database, currentUser, award.child_id))) {
      await this.assertView(database, currentUser, await this.findClass(database, award.class_id));
    }
    const school = await this.schoolName(database);
    const pdf = await certificatePdf({
      school,
      title_name: award.title_name,
      kind_label: 'GIẤY KHEN',
      subject_name: award.full_name,
      department: `Lớp ${award.class_name}`,
      year_name: await this.yearName(),
      decision_number: null,
      decision_date: award.decided_at ? award.decided_at.toISOString().slice(0, 10) : null,
      issuer: school,
      lookup_code: award.lookup_code,
      verification_text: award.lookup_code,
    });
    return { fileName: `giay-khen-${award.lookup_code}.pdf`, pdf };
  }

  // Tra cứu công khai mã in trên giấy khen
  async verify(code: string) {
    const { database } = await this.currentSchoolYear.require();
    const award = await database
      .selectFrom('student_awards')
      .innerJoin('children', 'children.id', 'student_awards.child_id')
      .innerJoin('classes', 'classes.id', 'student_awards.class_id')
      .select([
        'student_awards.title_name',
        'student_awards.decided_at',
        'children.full_name',
        'classes.name as class_name',
      ])
      .where('student_awards.lookup_code', '=', code)
      .where('student_awards.status', '=', 'approved')
      .executeTakeFirst();
    if (!award) {
      return { found: false };
    }
    return {
      found: true,
      title_name: award.title_name,
      student_name: award.full_name,
      class_name: award.class_name,
      year_name: await this.yearName(),
      decided_at: award.decided_at,
    };
  }

  // ---------- Hoàn thành chương trình, lên lớp ----------

  private async progression(database: Executor, classRow: ClassContext) {
    const [grades, enabled] = await Promise.all([
      database.selectFrom('grade_levels').select(['code', 'school_level', 'order_no', 'status']).execute(),
      this.schoolLevels.enabled(),
    ]);
    const next = nextGradeLevel(
      grades.map((grade) => ({
        ...grade,
        school_level: grade.school_level as SchoolLevelCode,
        status: grade.status as 'active' | 'inactive',
      })),
      enabled,
      classRow.grade_level,
    );
    const lastGrade = !next || next.kind === 'completed' || next.school_level !== classRow.school_level;
    return { lastGrade, nextCode: next?.kind === 'grade' ? next.code : null };
  }

  async completion(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const access = await this.assertView(database, currentUser, classRow);
    const [students, results, yearEnd, progression] = await Promise.all([
      this.students(database, classRow),
      database
        .selectFrom('completion_results')
        .select([
          'child_id',
          'outcome',
          'support_plan',
          'support_result',
          'support_note',
          'next_grade_level',
          'confirmed_by_name',
          'confirmed_at',
        ])
        .where('class_id', '=', classId)
        .execute(),
      this.yearEnd(database, classRow),
      this.progression(database, classRow),
    ]);
    return {
      class: classRow,
      access,
      year_end_locked: yearEnd.locked,
      last_grade: progression.lastGrade,
      next_grade_level: progression.nextCode,
      rows: students.map((student) => ({
        ...student,
        suggested_outcome: student.has_result
          ? completionOutcome({
              yearResult: (student.needs_support ? 'not_completed' : 'completed') as YearResultCode,
              lastGrade: progression.lastGrade,
              supportResult: null,
            })
          : null,
        result: results.find((row) => row.child_id === student.child_id) ?? null,
      })),
    };
  }

  // Ghi kết quả hoàn thành chương trình của học sinh (kèm kế hoạch, kết quả rèn luyện trong hè, kiểm tra lại)
  async saveCompletion(
    currentUser: CurrentUser,
    classId: string,
    entries: Array<{
      child_id: string;
      support_plan: SupportPlan | null;
      support_result: 'completed' | 'not_completed' | null;
      support_note: string | null;
    }>,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const access = await this.access(database, currentUser, classRow);
    this.assertEdit(access);
    await this.assertYearEndLocked(database, classRow);
    const students = await this.students(database, classRow);
    const progression = await this.progression(database, classRow);
    const errors: FieldError[] = [];
    const rows = entries.map((entry, index) => {
      const student = students.find((row) => row.child_id === entry.child_id);
      if (!student) {
        errors.push({ field: `entries[${index}].child_id`, message: 'Học sinh không học lớp này' });
        return null;
      }
      if (!student.has_result) {
        errors.push({ field: `entries[${index}].child_id`, message: 'Học sinh chưa có kết quả cuối năm đã xác nhận' });
        return null;
      }
      const passed = !student.needs_support;
      if (passed && (entry.support_plan || entry.support_result)) {
        errors.push({
          field: `entries[${index}].support_plan`,
          message: 'Học sinh đã hoàn thành, không cần rèn luyện',
        });
      }
      if (!passed && entry.support_result && !entry.support_plan) {
        errors.push({
          field: `entries[${index}].support_plan`,
          message: 'Chọn hình thức rèn luyện trong hè hoặc kiểm tra lại',
        });
      }
      const outcome = completionOutcome({
        yearResult: (passed ? 'completed' : 'not_completed') as YearResultCode,
        lastGrade: progression.lastGrade,
        supportResult: entry.support_result,
      });
      return {
        child_id: entry.child_id,
        year_result: student.year_result ?? student.learning ?? '',
        outcome,
        support_plan: passed ? null : entry.support_plan,
        support_result: passed ? null : entry.support_result,
        support_note: entry.support_note,
        next_grade_level:
          outcome === 'promoted'
            ? progression.nextCode
            : outcome === 'retained' || outcome === 'pending_support'
              ? classRow.grade_level
              : progression.nextCode,
      };
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      for (const row of rows) {
        if (!row) {
          continue;
        }
        const values = {
          ...row,
          grade_level: classRow.grade_level,
          confirmed_by: currentUser.id,
          confirmed_by_name: currentUser.description.full_name,
          confirmed_at: now,
        };
        await transaction
          .insertInto('completion_results')
          .values({ ...values, class_id: classId })
          .onConflict((conflict) => conflict.columns(['class_id', 'child_id']).doUpdateSet(values))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'completion_results',
        entityId: classId,
        action: 'update',
        before: null,
        after: rows,
      });
    });
    return this.completion(currentUser, classId);
  }

  // ---------- Học bạ ----------

  private async isGuardian(database: Executor, currentUser: CurrentUser, childId: string): Promise<boolean> {
    return Boolean(
      await database
        .selectFrom('child_guardians')
        .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
        .select('guardians.id')
        .where('child_guardians.child_id', '=', childId)
        .where('guardians.user_id', '=', currentUser.id)
        .executeTakeFirst(),
    );
  }

  private async buildContent(
    database: Executor,
    classRow: ClassContext,
    periodId: string,
    childId: string,
  ): Promise<LearningRecordContent> {
    if (this.isSecondary(classRow.school_level)) {
      return this.buildSecondaryContent(database, classRow, childId);
    }
    const [child, guardians, grade, homeroom, subjects, competencies, levels, year, awards, completion] =
      await Promise.all([
        database
          .selectFrom('children')
          .select(['full_name', 'gender', 'dob', 'place_of_birth', 'address', 'moet_student_code'])
          .where('id', '=', childId)
          .executeTakeFirstOrThrow(),
        database
          .selectFrom('child_guardians')
          .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
          .select('guardians.full_name')
          .where('child_guardians.child_id', '=', childId)
          .execute(),
        database.selectFrom('grade_levels').select('name').where('code', '=', classRow.grade_level).executeTakeFirst(),
        database
          .selectFrom('class_staff_assignments')
          .select('staff_name')
          .where('class_id', '=', classRow.id)
          .where('assignment_role', '=', 'homeroom')
          .where('status', '=', 'active')
          .executeTakeFirst(),
        database
          .selectFrom('subject_results')
          .innerJoin('subjects', 'subjects.id', 'subject_results.subject_id')
          .select(['subjects.name', 'subject_results.level_code', 'subject_results.score', 'subject_results.comment'])
          .where('subject_results.period_id', '=', periodId)
          .where('subject_results.class_id', '=', classRow.id)
          .where('subject_results.child_id', '=', childId)
          .orderBy('subjects.order_no')
          .execute(),
        database
          .selectFrom('competency_results')
          .innerJoin('competency_items', 'competency_items.id', 'competency_results.item_id')
          .select(['competency_items.group_code', 'competency_items.name', 'competency_results.level_code'])
          .where('competency_results.period_id', '=', periodId)
          .where('competency_results.class_id', '=', classRow.id)
          .where('competency_results.child_id', '=', childId)
          .orderBy('competency_items.order_no')
          .execute(),
        database
          .selectFrom('assessment_levels')
          .select(['scale', 'code', 'name'])
          .where('school_level', '=', classRow.school_level)
          .execute(),
        database
          .selectFrom('year_results')
          .select('result')
          .where('class_id', '=', classRow.id)
          .where('child_id', '=', childId)
          .executeTakeFirst(),
        database
          .selectFrom('student_awards')
          .select('title_name')
          .where('class_id', '=', classRow.id)
          .where('child_id', '=', childId)
          .where('status', '=', 'approved')
          .execute(),
        database
          .selectFrom('completion_results')
          .select('outcome')
          .where('class_id', '=', classRow.id)
          .where('child_id', '=', childId)
          .executeTakeFirst(),
      ]);
    const levelName = (scale: string, code: string | null) =>
      code ? (levels.find((level) => level.scale === scale && level.code === code)?.name ?? code) : null;
    return {
      school_name: await this.schoolName(database),
      academic_year_name: await this.yearName(),
      class_name: classRow.name,
      grade_name: grade?.name ?? classRow.grade_level,
      student: {
        full_name: child.full_name,
        gender: GENDER_LABELS[child.gender] ?? child.gender,
        dob: child.dob,
        place_of_birth: child.place_of_birth,
        address: child.address,
        moet_student_code: child.moet_student_code,
        guardians: guardians.map((row) => row.full_name),
      },
      homeroom_teacher: homeroom?.staff_name ?? null,
      subjects: subjects.map((row) => ({
        name: row.name,
        level: levelName('subject', row.level_code),
        score: row.score,
        comment: row.comment,
      })),
      competencies: competencies.map((row) => ({
        group: COMPETENCY_GROUP_LABELS[row.group_code],
        name: row.name,
        level: levelName('competency', row.level_code),
      })),
      year_result: year ? YEAR_RESULT_LABELS[year.result] : null,
      awards: awards.map((row) => row.title_name),
      completion: completion ? COMPLETION_OUTCOME_LABELS[completion.outcome] : null,
    };
  }

  // Học bạ THCS, THPT: điểm trung bình môn từng học kỳ, cả năm, xếp loại học tập, rèn luyện (đọc từ sổ điểm 21c)
  private async buildSecondaryContent(
    database: Executor,
    classRow: ClassContext,
    childId: string,
  ): Promise<LearningRecordContent> {
    const [child, guardians, grade, homeroom, awards, completion, first, second, year] = await Promise.all([
      database
        .selectFrom('children')
        .select(['full_name', 'gender', 'dob', 'place_of_birth', 'address', 'moet_student_code'])
        .where('id', '=', childId)
        .executeTakeFirstOrThrow(),
      database
        .selectFrom('child_guardians')
        .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
        .select('guardians.full_name')
        .where('child_guardians.child_id', '=', childId)
        .execute(),
      database.selectFrom('grade_levels').select('name').where('code', '=', classRow.grade_level).executeTakeFirst(),
      database
        .selectFrom('class_staff_assignments')
        .select('staff_name')
        .where('class_id', '=', classRow.id)
        .where('assignment_role', '=', 'homeroom')
        .where('status', '=', 'active')
        .executeTakeFirst(),
      database
        .selectFrom('student_awards')
        .select('title_name')
        .where('class_id', '=', classRow.id)
        .where('child_id', '=', childId)
        .where('status', '=', 'approved')
        .execute(),
      database
        .selectFrom('completion_results')
        .select('outcome')
        .where('class_id', '=', classRow.id)
        .where('child_id', '=', childId)
        .executeTakeFirst(),
      this.scores.summariesFor(database, classRow.id, 'first_term'),
      this.scores.summariesFor(database, classRow.id, 'second_term'),
      this.scores.summariesFor(database, classRow.id, 'year'),
    ]);
    const rowOf = (summary: typeof year) => summary.rows.find((row) => row.child_id === childId);
    const cell = (summary: typeof year, subjectId: string) => {
      const item = rowOf(summary)?.subjects.find((entry) => entry.subject_id === subjectId);
      if (!item) {
        return null;
      }
      return item.mode === 'score'
        ? item.average === null
          ? null
          : String(item.average)
        : item.passed
          ? SUBJECT_PASS_LABELS[item.passed]
          : null;
    };
    const ratingOf = (summary: typeof year) => {
      const row = rowOf(summary);
      return {
        learning: row?.learning ? RATING_LABELS[row.learning] : null,
        conduct: row?.conduct ? RATING_LABELS[row.conduct] : null,
      };
    };
    const yearRating = ratingOf(year);
    return {
      school_name: await this.schoolName(database),
      academic_year_name: await this.yearName(),
      class_name: classRow.name,
      grade_name: grade?.name ?? classRow.grade_level,
      student: {
        full_name: child.full_name,
        gender: GENDER_LABELS[child.gender] ?? child.gender,
        dob: child.dob,
        place_of_birth: child.place_of_birth,
        address: child.address,
        moet_student_code: child.moet_student_code,
        guardians: guardians.map((row) => row.full_name),
      },
      homeroom_teacher: homeroom?.staff_name ?? null,
      subjects: [],
      competencies: [],
      year_result:
        yearRating.learning && yearRating.conduct
          ? `Học tập: ${yearRating.learning}; rèn luyện: ${yearRating.conduct}`
          : null,
      awards: awards.map((row) => row.title_name),
      completion: completion ? COMPLETION_OUTCOME_LABELS[completion.outcome] : null,
      secondary: {
        subjects: year.subjects.map((subject) => ({
          name: subject.subject_name,
          mode: subject.mode,
          first: cell(first, subject.subject_id),
          second: cell(second, subject.subject_id),
          year: cell(year, subject.subject_id),
        })),
        ratings: { first: ratingOf(first), second: ratingOf(second), year: yearRating },
      },
    };
  }

  async classRecords(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const access = await this.assertView(database, currentUser, classRow);
    const yearName = await this.yearName();
    const [students, records, yearEnd] = await Promise.all([
      this.students(database, classRow),
      database
        .selectFrom('learning_records')
        .select(['id', 'child_id', 'status', 'homeroom_comment', 'signed_at', 'signer_name', 'prepared_by_name'])
        .where('class_id', '=', classId)
        .where('academic_year_name', '=', yearName)
        .execute(),
      this.yearEnd(database, classRow),
    ]);
    return {
      class: classRow,
      access,
      year_end_locked: yearEnd.locked,
      rows: students.map((student) => ({
        ...student,
        record: records.find((row) => row.child_id === student.child_id) ?? null,
      })),
    };
  }

  // Lập (hoặc lập lại) học bạ nháp của mọi học sinh của lớp từ kết quả kỳ cuối năm đã khoá; học bạ đã kí giữ nguyên
  async prepare(currentUser: CurrentUser, classId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    const access = await this.access(database, currentUser, classRow);
    this.assertEdit(access);
    const period = await this.assertYearEndLocked(database, classRow);
    const yearName = await this.yearName();
    const students = await this.students(database, classRow);
    const signed = new Set(
      (
        await database
          .selectFrom('learning_records')
          .select('child_id')
          .where('academic_year_name', '=', yearName)
          .where('status', '=', 'signed')
          .execute()
      ).map((row) => row.child_id),
    );
    let prepared = 0;
    await database.transaction().execute(async (transaction) => {
      for (const student of students) {
        if (signed.has(student.child_id)) {
          continue;
        }
        const content = await this.buildContent(transaction, classRow, period.id, student.child_id);
        const values = {
          class_id: classId,
          class_name: classRow.name,
          grade_level: classRow.grade_level,
          school_level: classRow.school_level,
          content: JSON.stringify(content),
          prepared_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        };
        await transaction
          .insertInto('learning_records')
          .values({ ...values, child_id: student.child_id, academic_year_name: yearName })
          .onConflict((conflict) => conflict.columns(['child_id', 'academic_year_name']).doUpdateSet(values))
          .execute();
        prepared += 1;
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'learning_records',
        entityId: classId,
        action: 'update',
        before: null,
        after: { prepared, skipped_signed: students.length - prepared },
      });
    });
    return { prepared, skipped_signed: students.length - prepared };
  }

  private async findRecord(database: Executor, recordId: string) {
    const record = await database
      .selectFrom('learning_records')
      .selectAll()
      .where('id', '=', recordId)
      .executeTakeFirst();
    if (!record) {
      throw notFoundError('Không tìm thấy học bạ', 'learning_record');
    }
    return record;
  }

  async comment(currentUser: CurrentUser, recordId: string, comment: string | null, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const record = await this.findRecord(database, recordId);
    if (!record.class_id) {
      throw rule('Học bạ của năm học trước không sửa được');
    }
    const classRow = await this.findClass(database, record.class_id);
    this.assertEdit(await this.access(database, currentUser, classRow));
    if (record.status === 'signed') {
      throw rule('Học bạ đã kí; Hiệu trưởng mở lại trước khi sửa');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('learning_records')
        .set({ homeroom_comment: comment, updated_at: this.clock.now() })
        .where('id', '=', recordId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'learning_records',
        entityId: recordId,
        action: 'update',
        before: { homeroom_comment: record.homeroom_comment },
        after: { homeroom_comment: comment },
      });
    });
    return { id: recordId, homeroom_comment: comment };
  }

  // Số định danh in ở học bạ: đủ khi người dùng được xem số định danh trong phạm vi đơn vị (ghi nhật ký truy cập), còn lại che
  private async nationalIdFor(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    childId: string,
    orgUnitId: string,
    origin: ChangeOrigin,
  ): Promise<{ text: string; full: boolean }> {
    const child = await database
      .selectFrom('children')
      .select(['national_id_encrypted', 'national_id_last4'])
      .where('id', '=', childId)
      .executeTakeFirstOrThrow();
    if (!(await this.inScope(currentUser, PERMISSION_CODES.nationalIdView, orgUnitId))) {
      return { text: maskNationalId(child.national_id_last4), full: false };
    }
    await writeDataAccessLog(database, {
      origin,
      orgUnitId,
      entityName: 'children',
      entityId: childId,
      scope: 'national_id',
    });
    try {
      return { text: this.protection.decrypt(child.national_id_encrypted), full: true };
    } catch {
      return { text: maskNationalId(child.national_id_last4), full: false };
    }
  }

  // Hiệu trưởng xác nhận và kí học bạ bằng luồng kí nội bộ (16k): tệp PDF in đủ số định danh, kèm khối xác nhận kí
  async sign(currentUser: CurrentUser, recordId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const record = await this.findRecord(database, recordId);
    if (!record.class_id) {
      throw rule('Học bạ của năm học trước đã kí ở năm học đó');
    }
    const classRow = await this.findClass(database, record.class_id);
    if (!(await this.inScope(currentUser, PERMISSION_CODES.studentRecordApprove, classRow.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu xác nhận và kí học bạ');
    }
    if (!(await this.inScope(currentUser, PERMISSION_CODES.nationalIdView, classRow.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Người kí học bạ cần quyền xem số định danh để in đủ như mẫu');
    }
    if (record.status === 'signed') {
      throw rule('Học bạ đã kí');
    }
    const certificate = await this.databases.system.selectFrom('signing_certificates').selectAll().executeTakeFirst();
    if (certificate?.status !== 'registered') {
      throw rule('Chứng thư số nhà trường chưa đăng ký kí nội bộ (Quản lý kí hồ sơ, mục 1.1)');
    }
    if (certificate.valid_to && certificate.valid_to < this.today()) {
      throw rule('Chứng thư số nhà trường đã hết hiệu lực');
    }
    if (!isSigningProvider(certificate.provider)) {
      throw rule('Nhà phát hành chứng thư không có trong danh sách của Sở; đăng ký lại chứng thư');
    }
    const content = record.content as unknown as LearningRecordContent;
    const nationalId = await this.nationalIdFor(database, currentUser, record.child_id, classRow.org_unit_id, origin);
    const signedAt = this.clock.now();
    const original = await learningRecordPdf(content, nationalId.text, record.homeroom_comment, {
      signed: true,
      signer_name: currentUser.description.full_name,
    });
    const sealImage =
      certificate.seal_storage_key && certificate.seal_content_type
        ? `data:${certificate.seal_content_type};base64,${(await this.fileStorage.get(certificate.seal_storage_key)).toString('base64')}`
        : null;
    const result = await this.signer.sign({
      code: `HB-${record.id.slice(0, 8).toUpperCase()}`,
      title: 'HỌC BẠ',
      heading: [
        'HỌC BẠ',
        `${content.student.full_name} · Lớp ${content.class_name} · Năm học ${content.academic_year_name}`,
      ],
      sheets: learningRecordSheets(content, nationalId.text, record.homeroom_comment),
      originalPdf: original,
      originalSha256: createHash('sha256').update(original).digest('hex'),
      signedAt,
      signerName: currentUser.description.full_name,
      certificate: {
        signatureTypeLabel: SIGNING_SIGNATURE_TYPE_LABELS[certificate.signature_type],
        provider: certificate.provider,
        holderName: certificate.holder_name,
        holderTitle: certificate.holder_title,
        serialNumber: certificate.serial_number,
      },
      sealImage,
      verification: null,
    });
    const key = storageKey('learning-records', record.id, randomUUID());
    await this.fileStorage.put(key, result.pdf, CONTENT_TYPES.pdf);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('learning_records')
        .set({
          status: 'signed',
          signed_storage_key: key,
          signed_at: signedAt,
          signer_name: currentUser.description.full_name,
          signature_method: result.method,
          updated_at: signedAt,
        })
        .where('id', '=', recordId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'learning_records',
        entityId: recordId,
        action: 'update',
        before: { status: record.status },
        after: { status: 'signed', signature_method: result.method },
      });
    });
    return { id: recordId, status: 'signed', signed_at: signedAt, signature_method: result.method };
  }

  async reopen(currentUser: CurrentUser, recordId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const record = await this.findRecord(database, recordId);
    if (!record.class_id) {
      throw rule('Học bạ của năm học trước không mở lại được');
    }
    const classRow = await this.findClass(database, record.class_id);
    if (!(await this.inScope(currentUser, PERMISSION_CODES.studentRecordApprove, classRow.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu mở lại học bạ');
    }
    if (record.status !== 'signed') {
      throw rule('Học bạ chưa kí');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('learning_records')
        .set({
          status: 'draft',
          signed_storage_key: null,
          signed_at: null,
          signer_name: null,
          signature_method: null,
          updated_at: this.clock.now(),
        })
        .where('id', '=', recordId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'learning_records',
        entityId: recordId,
        action: 'update',
        before: { status: 'signed', signed_at: record.signed_at, signer_name: record.signer_name },
        after: { status: 'draft', reason },
      });
    });
    return { id: recordId, status: 'draft' };
  }

  // Tệp học bạ: đã kí thì tệp đã kí (in đủ số định danh: người xem số định danh trong phạm vi hoặc phụ huynh của học sinh);
  // chưa kí thì bản xem trước (số định danh theo quyền của người xem)
  async file(currentUser: CurrentUser, recordId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const record = await this.findRecord(database, recordId);
    const child = await database
      .selectFrom('children')
      .select('org_unit_id')
      .where('id', '=', record.child_id)
      .executeTakeFirstOrThrow();
    const guardian = await this.isGuardian(database, currentUser, record.child_id);
    if (!guardian) {
      const classRow = record.class_id ? await this.findClass(database, record.class_id) : null;
      const allowed = classRow
        ? (await this.access(database, currentUser, classRow)).view
        : await this.inScope(currentUser, PERMISSION_CODES.assessmentView, child.org_unit_id);
      if (!allowed) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được học bạ này');
      }
    } else if (record.status !== 'signed') {
      throw rule('Học bạ chưa được Hiệu trưởng kí');
    }
    const fileName = `hoc-ba-${record.academic_year_name}-${record.id.slice(0, 8)}.pdf`;
    if (record.status === 'signed' && record.signed_storage_key) {
      if (!guardian && !(await this.inScope(currentUser, PERMISSION_CODES.nationalIdView, child.org_unit_id))) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Tệp học bạ đã kí in đủ số định danh; cần quyền xem số định danh');
      }
      if (!guardian) {
        await writeDataAccessLog(database, {
          origin,
          orgUnitId: child.org_unit_id,
          entityName: 'children',
          entityId: record.child_id,
          scope: 'national_id',
        });
      }
      return { fileName, pdf: await this.fileStorage.get(record.signed_storage_key) };
    }
    const nationalId = await this.nationalIdFor(database, currentUser, record.child_id, child.org_unit_id, origin);
    const pdf = await learningRecordPdf(
      record.content as unknown as LearningRecordContent,
      nationalId.text,
      record.homeroom_comment,
      { signed: false, signer_name: null },
    );
    return { fileName, pdf };
  }

  // Học bạ các năm của học sinh (năm trước chép sang khi chuyển năm): người xem của đơn vị thấy mọi bản, phụ huynh thấy bản đã kí
  async childRecords(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    const child = await database
      .selectFrom('children')
      .select(['id', 'org_unit_id'])
      .where('id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy học sinh', 'child');
    }
    const guardian = await this.isGuardian(database, currentUser, childId);
    if (!guardian && !(await this.inScope(currentUser, PERMISSION_CODES.assessmentView, child.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được học bạ của học sinh này');
    }
    const [records, awards, completion] = await Promise.all([
      database
        .selectFrom('learning_records')
        .select(['id', 'academic_year_name', 'class_name', 'grade_level', 'status', 'signed_at', 'signer_name'])
        .where('child_id', '=', childId)
        .$if(guardian, (query) => query.where('status', '=', 'signed'))
        .orderBy('academic_year_name', 'desc')
        .execute(),
      database
        .selectFrom('student_awards')
        .select(['id', 'title_name', 'lookup_code', 'decided_at'])
        .where('child_id', '=', childId)
        .where('status', '=', 'approved')
        .execute(),
      database
        .selectFrom('completion_results')
        .select(['outcome', 'support_plan', 'support_result', 'next_grade_level'])
        .where('child_id', '=', childId)
        .orderBy('confirmed_at', 'desc')
        .executeTakeFirst(),
    ]);
    return { records, awards, completion: completion ?? null };
  }
}

function throwIf(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

function sendPdf(response: Response, result: { fileName: string; pdf: Buffer }) {
  response.setHeader('Content-Type', CONTENT_TYPES.pdf);
  response.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
  response.send(result.pdf);
}

@Controller('learning-records')
export class LearningRecordsController {
  constructor(private readonly records: LearningRecordsService) {}

  @Get('award-titles')
  titles(@Query('school_level') level: string | undefined) {
    const errors: FieldError[] = [];
    const parsed = readSchoolLevel({ school_level: level }, 'school_level', errors) ?? 'TH';
    throwIf(errors);
    return this.records.titles(parsed);
  }

  @Post('award-titles/defaults')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  loadTitleDefaults(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const level = readSchoolLevel(body, 'school_level', errors) ?? 'TH';
    throwIf(errors);
    return this.records.loadTitleDefaults(level, originOf(request, currentUser));
  }

  @Post('award-titles')
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  createTitle(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const kind: 'year_end' | 'special' | null =
      body?.kind === 'special' ? 'special' : body?.kind === 'year_end' ? 'year_end' : null;
    if (!kind) {
      errors.push({ field: 'kind', message: 'Loại là year_end (cuối năm) hoặc special (đột xuất)' });
    }
    const basis: StudentAwardBasis | null = AWARD_BASES.includes(body?.basis as StudentAwardBasis)
      ? (body?.basis as StudentAwardBasis)
      : null;
    const input = {
      school_level: readSchoolLevel(body, 'school_level', errors) ?? 'TH',
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      kind: kind ?? 'special',
      basis: kind === 'year_end' ? basis : null,
    };
    throwIf(errors);
    return this.records.createTitle(input, originOf(request, currentUser));
  }

  @Patch('award-titles/:id')
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  updateTitle(
    @Param('id', uuidParameter('Mã không hợp lệ')) titleId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      status: readStatus(body, errors),
    };
    throwIf(errors);
    return this.records.updateTitle(titleId, changes, originOf(request, currentUser));
  }

  @Get('classes/:id/awards')
  classAwards(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.records.classAwards(user, classId);
  }

  @Post('classes/:id/awards')
  propose(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!isUuid(body?.child_id) || !isUuid(body?.title_id)) {
      errors.push({ field: 'child_id', message: 'Bắt buộc chọn học sinh và danh hiệu' });
    }
    const achievement = readOptionalText(body, 'achievement', errors) ?? null;
    throwIf(errors);
    return this.records.propose(
      currentUser,
      classId,
      { childId: String(body?.child_id), titleId: String(body?.title_id), achievement },
      originOf(request, currentUser),
    );
  }

  @Post('awards/:id/decide')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  decide(
    @Param('id', uuidParameter('Mã không hợp lệ')) awardId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (typeof body?.approve !== 'boolean') {
      errors.push({ field: 'approve', message: 'Phải là đúng hoặc sai' });
    }
    const note = readOptionalText(body, 'note', errors) ?? null;
    throwIf(errors);
    return this.records.decide(
      currentUser,
      awardId,
      { approve: body?.approve === true, note },
      originOf(request, currentUser),
    );
  }

  @Get('awards/:id/certificate')
  async certificate(
    @Param('id', uuidParameter('Mã không hợp lệ')) awardId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    sendPdf(response, await this.records.certificate(currentUser, awardId));
  }

  @Get('classes/:id/completion')
  completion(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.records.completion(user, classId);
  }

  @Put('classes/:id/completion')
  saveCompletion(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!Array.isArray(body?.entries) || body.entries.length > 200) {
      errors.push({ field: 'entries', message: 'Cần danh sách tối đa 200 dòng' });
    }
    const entries = ((Array.isArray(body?.entries) ? body.entries : []) as unknown[]).map((value, index) => {
      const item = (typeof value === 'object' && value !== null ? value : {}) as RequestBody;
      if (!isUuid(item?.child_id)) {
        errors.push({ field: `entries[${index}].child_id`, message: 'Mã học sinh không hợp lệ' });
      }
      const plan = item?.support_plan;
      if (plan !== undefined && plan !== null && plan !== 'summer_training' && plan !== 'retest') {
        errors.push({ field: `entries[${index}].support_plan`, message: 'Là summer_training hoặc retest' });
      }
      const result = item?.support_result;
      if (result !== undefined && result !== null && result !== 'completed' && result !== 'not_completed') {
        errors.push({ field: `entries[${index}].support_result`, message: 'Là completed hoặc not_completed' });
      }
      return {
        child_id: String(item?.child_id),
        support_plan: (plan ?? null) as SupportPlan | null,
        support_result: (result ?? null) as 'completed' | 'not_completed' | null,
        support_note: readOptionalText(item, 'support_note', errors) ?? null,
      };
    });
    throwIf(errors);
    return this.records.saveCompletion(currentUser, classId, entries, originOf(request, currentUser));
  }

  @Get('classes/:id/learning-records')
  classRecords(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.records.classRecords(user, classId);
  }

  @Post('classes/:id/learning-records/prepare')
  @HttpCode(200)
  prepare(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.prepare(currentUser, classId, originOf(request, currentUser));
  }

  @Patch('learning-records/:id')
  comment(
    @Param('id', uuidParameter('Mã không hợp lệ')) recordId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const comment = readOptionalText(body, 'homeroom_comment', errors) ?? null;
    if (comment && comment.length > 2000) {
      errors.push({ field: 'homeroom_comment', message: 'Nhận xét tối đa 2000 ký tự' });
    }
    throwIf(errors);
    return this.records.comment(currentUser, recordId, comment, originOf(request, currentUser));
  }

  @Post('learning-records/:id/sign')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  sign(
    @Param('id', uuidParameter('Mã không hợp lệ')) recordId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.sign(currentUser, recordId, originOf(request, currentUser));
  }

  @Post('learning-records/:id/reopen')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.studentRecordApprove)
  reopen(
    @Param('id', uuidParameter('Mã không hợp lệ')) recordId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readOptionalText(body, 'reason', errors);
    if (!reason) {
      errors.push({ field: 'reason', message: 'Bắt buộc ghi lý do mở lại' });
    }
    throwIf(errors);
    return this.records.reopen(currentUser, recordId, reason ?? '', originOf(request, currentUser));
  }

  @Get('learning-records/:id/file')
  async file(
    @Param('id', uuidParameter('Mã không hợp lệ')) recordId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    sendPdf(response, await this.records.file(currentUser, recordId, originOf(request, currentUser)));
  }

  @Get('children/:id')
  childRecords(
    @Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @AuthenticatedUser() user: CurrentUser,
  ) {
    return this.records.childRecords(user, childId);
  }
}

// Tra cứu công khai mã in trên giấy khen học sinh
@Controller('public')
@PublicEndpoint()
export class StudentAwardVerificationController {
  constructor(
    private readonly records: LearningRecordsService,
    private readonly limiter: AdmissionsRateLimiter,
  ) {}

  @Get('student-awards/verify')
  verify(@Query('code') code: string | undefined, @Req() request: Request) {
    this.limiter.hit('read', request.ip);
    const normalized = code?.trim().toUpperCase() ?? '';
    if (!CODE_PATTERN.test(normalized)) {
      throw validationError([{ field: 'code', message: 'Mã tra cứu gồm 12 chữ cái và chữ số' }]);
    }
    return this.records.verify(normalized);
  }
}
