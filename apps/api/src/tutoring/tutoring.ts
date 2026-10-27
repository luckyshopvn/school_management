import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, currentTenant, validationError, type FieldError } from '@school-management/server';
import {
  feeRuleViolations,
  isModuleInPlan,
  isoWeekday,
  periodsForSession,
  PERMISSION_CODES,
  programRuleViolations,
  timesOverlap,
  weekStart,
  weeklyDates,
  weeklyLoadViolations,
  attendanceFromRoomEvents,
  type SchoolLevelCode,
  type TutoringAttendanceStatus,
  type TutoringAudience,
  type TutoringContentType,
  type TutoringCancelRefund,
  type TutoringDelivery,
  type TutoringFeeBasis,
  type TutoringFundingSource,
  type TutoringRuleSet,
  type TutoringRuleViolation,
} from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { storageKey } from '../common/resource-names.js';
import { FileStorage } from '../files/file-storage.js';
import { TimetablesService } from '../timetables/timetables.js';
import { creditCancelledSession } from './tutoring-fees.js';

// Gia sư trong trường (DT-27 phần 27b, YCTD-252; tài liệu 32 mục 19.2, 19.5): chương trình, buổi học lặp theo tuần, đơn đăng ký của
// cha mẹ, điểm danh, quyết định tăng thời lượng của Sở, quy định dạy thêm có ngày hiệu lực. Mọi khóa của Thông tư 29/2024 sửa bởi
// Thông tư 19/2026 kiểm ở máy chủ (hàm thuần ở `@school-management/shared/tutoring`). Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11:
// - người lập chương trình (P02.tutoring.teach) là giáo viên dạy mặc định; Ban Giám hiệu (P02.tutoring.manage) duyệt trước khi mở
//   đăng ký, thấy mọi chương trình; giáo viên thấy chương trình mình dạy hoặc của lớp mình chủ nhiệm;
// - đơn đăng ký do giáo viên chủ nhiệm của học sinh, giáo viên dạy chương trình hoặc Ban Giám hiệu duyệt; duyệt đơn và xếp buổi đều
//   kiểm giới hạn tiết mỗi tuần mỗi môn với nội dung `curriculum` (đếm cả chương trình khác cùng môn);
// - buổi học kiểm trùng thời khoá biểu chính khoá đang áp dụng của giáo viên dạy và của lớp đối tượng theo khung giờ tiết; trường
//   chưa khai khung giờ tiết thì không so được giờ (ghi rõ ở YCTD), số tiết quy đổi theo độ dài tiết mặc định của quy định;
// - điểm danh: nhật ký vào ra phòng video (27a) cho điểm danh gợi ý, giáo viên xác nhận; vắng báo cha mẹ một lần;
// - nhắn tin của chương trình luôn qua luồng trao đổi giáo viên với cha mẹ của học sinh (không có luồng riêng với học sinh).
type Database = Kysely<SchoolYearDatabase>;
type Executor = Database | Transaction<SchoolYearDatabase>;

export const TUTORING_RULE_CODE = 'YCTD-252';
const MANAGE = PERMISSION_CODES.tutoringManage;
const TEACH = PERMISSION_CODES.tutoringTeach;
const CONTENT_TYPES: TutoringContentType[] = ['curriculum', 'enrichment'];
const AUDIENCES: TutoringAudience[] = ['below_standard', 'gifted', 'final_year_review'];
const DELIVERIES: TutoringDelivery[] = ['live_video', 'course', 'qa', 'mixed'];
const LEVELS: SchoolLevelCode[] = ['TH', 'THCS', 'THPT'];
const ATTENDANCE: TutoringAttendanceStatus[] = ['present', 'late', 'left_early', 'absent'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertTutoringModule(): void {
  const plan = currentTenant()?.plan;
  if (plan && !isModuleInPlan('tutoring', plan.modules)) {
    throw new ApplicationError('MODULE_NOT_IN_PLAN', 'Phân hệ này không có trong gói dịch vụ của trường', [
      { field: 'plan', message: plan.code },
    ]);
  }
}

// Vi phạm quy định dạy thêm (và quy tắc thu phí, thù lao của 27c): báo lỗi quy tắc kèm mã từng dòng để giao diện và kiểm thử đối chiếu
export function tutoringRuleError(violations: { code: string; message: string }[]): ApplicationError {
  return new ApplicationError(
    'ERR_RULE_VIOLATION',
    violations.map((violation) => violation.message).join('; '),
    violations.map((violation) => ({ field: violation.code, message: violation.message })),
    undefined,
    TUTORING_RULE_CODE,
  );
}

type Body = Record<string, unknown> | undefined;
const text = (body: Body, field: string) => (typeof body?.[field] === 'string' ? (body[field] as string).trim() : '');
const optionalText = (body: Body, field: string, max: number) => text(body, field).slice(0, max) || null;

function idList(body: Body, field: string, errors: FieldError[]): string[] {
  const value = body?.[field];
  if (value === undefined || value === null) {
    return [];
  }
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || !UUID.test(item)) ||
    value.length > 500
  ) {
    errors.push({ field, message: 'Danh sách mã không hợp lệ' });
    return [];
  }
  return [...new Set(value as string[])];
}

export interface ProgramInput {
  name: string;
  schoolLevel: SchoolLevelCode;
  subjectId: string | null;
  topic: string | null;
  contentType: TutoringContentType;
  audience: TutoringAudience | null;
  chargesFee: boolean;
  delivery: TutoringDelivery;
  description: string | null;
  registrationForm: string;
  maxStudents: number | null;
  startsOn: string;
  endsOn: string;
  classIds: string[];
  teacherUserIds: string[];
  // Thu phí và thù lao (YCTD-253)
  feeBasis: TutoringFeeBasis | null;
  feeAmount: number | null;
  cancelRefund: TutoringCancelRefund;
  payRatePerPeriod: number | null;
  fundingSource: TutoringFundingSource;
  teacherPayRates: Record<string, number | null>;
}

const FEE_BASES: TutoringFeeBasis[] = ['per_session', 'per_program'];
const CANCEL_REFUNDS: TutoringCancelRefund[] = ['deduct_next', 'adjust_invoice'];
const FUNDING_SOURCES: TutoringFundingSource[] = ['school_budget', 'tutoring_fees'];

// Số tiền tùy chọn: bỏ trống là không có; có thì là số (kiểm số nguyên dương ở hàm thuần)
function optionalAmount(body: Body, field: string, errors: FieldError[]): number | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push({ field, message: 'Số tiền không hợp lệ' });
    return null;
  }
  return value;
}

export function parseProgramInput(body: Body): ProgramInput {
  const errors: FieldError[] = [];
  const name = text(body, 'name');
  if (name.length < 3 || name.length > 200) {
    errors.push({ field: 'name', message: 'Tên chương trình từ 3 đến 200 ký tự' });
  }
  const schoolLevel = body?.school_level as SchoolLevelCode;
  if (!LEVELS.includes(schoolLevel)) {
    errors.push({ field: 'school_level', message: 'Cấp học là TH, THCS hoặc THPT' });
  }
  const contentType = body?.content_type as TutoringContentType;
  if (!CONTENT_TYPES.includes(contentType)) {
    errors.push({
      field: 'content_type',
      message: 'Chọn loại nội dung: môn học trong chương trình hoặc bổ trợ ngoài chương trình',
    });
  }
  const audience =
    body?.audience === undefined || body.audience === null || body.audience === ''
      ? null
      : (body.audience as TutoringAudience);
  if (audience !== null && !AUDIENCES.includes(audience)) {
    errors.push({ field: 'audience', message: 'Nhóm đối tượng không hợp lệ' });
  }
  const delivery = (body?.delivery ?? 'live_video') as TutoringDelivery;
  if (!DELIVERIES.includes(delivery)) {
    errors.push({ field: 'delivery', message: 'Hình thức không hợp lệ' });
  }
  const subjectId = text(body, 'subject_id') || null;
  if (subjectId && !UUID.test(subjectId)) {
    errors.push({ field: 'subject_id', message: 'Môn không hợp lệ' });
  }
  const startsOn = text(body, 'starts_on');
  const endsOn = text(body, 'ends_on');
  if (!DATE.test(startsOn) || !DATE.test(endsOn) || endsOn < startsOn) {
    errors.push({
      field: 'starts_on',
      message: 'Ngày bắt đầu, kết thúc dạng yyyy-mm-dd, kết thúc không trước bắt đầu',
    });
  }
  const registrationForm = text(body, 'registration_form');
  if (registrationForm.length < 10 || registrationForm.length > 5000) {
    errors.push({ field: 'registration_form', message: 'Mẫu đơn đăng ký từ 10 đến 5000 ký tự' });
  }
  const maxStudents = body?.max_students;
  if (
    maxStudents !== undefined &&
    maxStudents !== null &&
    (typeof maxStudents !== 'number' || !Number.isInteger(maxStudents) || maxStudents < 1 || maxStudents > 500)
  ) {
    errors.push({ field: 'max_students', message: 'Sĩ số tối đa từ 1 đến 500' });
  }
  const feeBasis =
    body?.fee_basis === undefined || body.fee_basis === null || body.fee_basis === ''
      ? null
      : (body.fee_basis as TutoringFeeBasis);
  if (feeBasis !== null && !FEE_BASES.includes(feeBasis)) {
    errors.push({ field: 'fee_basis', message: 'Cách tính là theo buổi hoặc trọn gói' });
  }
  const cancelRefund = (body?.cancel_refund ?? 'deduct_next') as TutoringCancelRefund;
  if (!CANCEL_REFUNDS.includes(cancelRefund)) {
    errors.push({ field: 'cancel_refund', message: 'Cách xử lý buổi hủy không hợp lệ' });
  }
  const fundingSource = (body?.funding_source ?? 'school_budget') as TutoringFundingSource;
  if (!FUNDING_SOURCES.includes(fundingSource)) {
    errors.push({ field: 'funding_source', message: 'Nguồn chi thù lao không hợp lệ' });
  }
  const teacherPayRates: Record<string, number | null> = {};
  const rawRates = body?.teacher_pay_rates;
  if (rawRates !== undefined && rawRates !== null) {
    if (typeof rawRates !== 'object' || Array.isArray(rawRates)) {
      errors.push({ field: 'teacher_pay_rates', message: 'Đơn giá riêng của giáo viên không hợp lệ' });
    } else {
      for (const [teacherId, rate] of Object.entries(rawRates as Record<string, unknown>)) {
        if (!UUID.test(teacherId) || (rate !== null && (typeof rate !== 'number' || !Number.isFinite(rate)))) {
          errors.push({ field: 'teacher_pay_rates', message: 'Đơn giá riêng của giáo viên không hợp lệ' });
          break;
        }
        teacherPayRates[teacherId] = rate as number | null;
      }
    }
  }
  const input: ProgramInput = {
    feeBasis,
    feeAmount: optionalAmount(body, 'fee_amount', errors),
    cancelRefund,
    payRatePerPeriod: optionalAmount(body, 'pay_rate_per_period', errors),
    fundingSource,
    teacherPayRates,
    name,
    schoolLevel,
    subjectId,
    topic: optionalText(body, 'topic', 300),
    contentType,
    audience,
    chargesFee: body?.charges_fee === true,
    delivery,
    description: optionalText(body, 'description', 5000),
    registrationForm,
    maxStudents: typeof maxStudents === 'number' ? maxStudents : null,
    startsOn,
    endsOn,
    classIds: idList(body, 'class_ids', errors),
    teacherUserIds: idList(body, 'teacher_user_ids', errors),
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

interface ProgramRow {
  id: string;
  name: string;
  school_level: SchoolLevelCode;
  subject_id: string | null;
  content_type: TutoringContentType;
  audience: TutoringAudience | null;
  charges_fee: boolean;
  status: string;
  starts_on: unknown;
  ends_on: unknown;
  max_students: number | null;
  registration_form: string;
  created_by: string;
}

const dateText = (value: unknown) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const vietnamToday = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);

@Injectable()
export class TutoringService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly timetables: TimetablesService,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  private async database(): Promise<Database> {
    assertTutoringModule();
    return (await this.currentSchoolYear.require()).database;
  }

  today(): string {
    return vietnamToday(this.clock.now());
  }

  // ---------- Quy định dạy thêm có ngày hiệu lực

  async ruleSet(database: Executor, date: string): Promise<TutoringRuleSet> {
    const row = await database
      .selectFrom('tutoring_rules')
      .selectAll()
      .where('effective_from', '<=', date)
      .orderBy('effective_from', 'desc')
      .executeTakeFirst();
    return {
      effectiveFrom: row ? dateText(row.effective_from) : date,
      maxCurriculumPeriodsPerWeek: row?.max_curriculum_periods_per_week ?? 2,
      curriculumBlockedLevels: row?.curriculum_blocked_levels ?? ['TH'],
      defaultPeriodMinutes: row?.default_period_minutes ?? { TH: 35, THCS: 45, THPT: 45 },
    };
  }

  async listRules() {
    const database = await this.database();
    const rows = await database.selectFrom('tutoring_rules').selectAll().orderBy('effective_from', 'desc').execute();
    return {
      current: await this.ruleSet(database, this.today()),
      rules: rows.map((row) => ({ ...row, effective_from: dateText(row.effective_from) })),
    };
  }

  async addRule(currentUser: CurrentUser, body: Body, origin: ChangeOrigin) {
    const database = await this.database();
    const errors: FieldError[] = [];
    const effectiveFrom = text(body, 'effective_from');
    if (!DATE.test(effectiveFrom)) {
      errors.push({ field: 'effective_from', message: 'Ngày hiệu lực dạng yyyy-mm-dd' });
    }
    const max = body?.max_curriculum_periods_per_week;
    if (typeof max !== 'number' || !Number.isInteger(max) || max < 0 || max > 20) {
      errors.push({ field: 'max_curriculum_periods_per_week', message: 'Số tiết từ 0 đến 20' });
    }
    const blocked = Array.isArray(body?.curriculum_blocked_levels) ? (body.curriculum_blocked_levels as unknown[]) : [];
    if (blocked.some((level) => !['MN', 'TH', 'THCS', 'THPT'].includes(level as string))) {
      errors.push({ field: 'curriculum_blocked_levels', message: 'Cấp học không hợp lệ' });
    }
    const legalBasis = text(body, 'legal_basis');
    if (legalBasis.length < 10) {
      errors.push({ field: 'legal_basis', message: 'Ghi căn cứ (số hiệu văn bản) từ 10 ký tự' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const current = await this.ruleSet(database, effectiveFrom);
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('tutoring_rules')
        .values({
          effective_from: effectiveFrom,
          max_curriculum_periods_per_week: max as number,
          curriculum_blocked_levels: JSON.stringify(blocked),
          default_period_minutes: JSON.stringify(current.defaultPeriodMinutes),
          legal_basis: legalBasis,
          created_by_name: currentUser.description.full_name,
        })
        .onConflict((conflict) =>
          conflict.column('effective_from').doUpdateSet({
            max_curriculum_periods_per_week: max as number,
            curriculum_blocked_levels: JSON.stringify(blocked),
            legal_basis: legalBasis,
            created_by_name: currentUser.description.full_name,
          }),
        )
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'tutoring_rules',
        entityId: created.id,
        action: 'create',
        before: null,
        after: {
          effective_from: effectiveFrom,
          max_curriculum_periods_per_week: max,
          curriculum_blocked_levels: blocked,
        },
      });
      return { id: created.id };
    });
  }

  // ---------- Danh mục cho biểu mẫu

  async meta(currentUser: CurrentUser) {
    const database = await this.database();
    const [subjects, classes, teachers] = await Promise.all([
      database
        .selectFrom('subjects')
        .select(['id', 'code', 'name', 'school_level'])
        .where('school_level', 'in', LEVELS)
        .orderBy('school_level')
        .orderBy('order_no')
        .execute(),
      database
        .selectFrom('classes')
        .select(['id', 'name', 'grade_level', 'school_level'])
        .where('status', '=', 'active')
        .where('school_level', 'in', LEVELS)
        .orderBy('grade_level')
        .orderBy('name')
        .execute(),
      database
        .selectFrom('class_staff_assignments')
        .select(['staff_user_id', 'staff_name'])
        .where('status', '=', 'active')
        .distinct()
        .orderBy('staff_name')
        .execute(),
    ]);
    return {
      can_manage: currentUser.hasPermission(MANAGE),
      rules: await this.ruleSet(database, this.today()),
      subjects,
      classes,
      teachers: teachers.map((row) => ({ user_id: row.staff_user_id, name: row.staff_name })),
    };
  }

  // ---------- Chương trình

  private async homeroomClassIds(database: Executor, userId: string): Promise<string[]> {
    const rows = await database
      .selectFrom('class_staff_assignments')
      .select('class_id')
      .where('staff_user_id', '=', userId)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .execute();
    return rows.map((row) => row.class_id);
  }

  private async visibleProgramIds(database: Executor, currentUser: CurrentUser): Promise<string[] | null> {
    if (currentUser.hasPermission(MANAGE)) {
      return null;
    }
    const homeroom = await this.homeroomClassIds(database, currentUser.id);
    const [teaching, byClass] = await Promise.all([
      database
        .selectFrom('tutoring_program_teachers')
        .select('program_id')
        .where('teacher_user_id', '=', currentUser.id)
        .execute(),
      homeroom.length
        ? database
            .selectFrom('tutoring_program_classes')
            .select('program_id')
            .where('class_id', 'in', homeroom)
            .execute()
        : Promise.resolve([]),
    ]);
    return [...new Set([...teaching, ...byClass].map((row) => row.program_id))];
  }

  async listPrograms(currentUser: CurrentUser) {
    const database = await this.database();
    const visible = await this.visibleProgramIds(database, currentUser);
    if (visible !== null && visible.length === 0) {
      return [];
    }
    let query = database
      .selectFrom('tutoring_programs')
      .leftJoin('subjects', 'subjects.id', 'tutoring_programs.subject_id')
      .select([
        'tutoring_programs.id',
        'tutoring_programs.name',
        'tutoring_programs.school_level',
        'tutoring_programs.content_type',
        'tutoring_programs.audience',
        'tutoring_programs.charges_fee',
        'tutoring_programs.fee_basis',
        'tutoring_programs.fee_amount',
        'tutoring_programs.delivery',
        'tutoring_programs.status',
        'tutoring_programs.starts_on',
        'tutoring_programs.ends_on',
        'tutoring_programs.created_by_name',
        'subjects.name as subject_name',
      ])
      .orderBy('tutoring_programs.created_at', 'desc');
    if (visible !== null) {
      query = query.where('tutoring_programs.id', 'in', visible);
    }
    const rows = await query.execute();
    return rows.map((row) => ({ ...row, starts_on: dateText(row.starts_on), ends_on: dateText(row.ends_on) }));
  }

  private async loadProgram(database: Executor, id: string): Promise<ProgramRow> {
    if (!UUID.test(id)) {
      throw notFoundError('Không tìm thấy chương trình', 'program');
    }
    const program = await database
      .selectFrom('tutoring_programs')
      .select([
        'id',
        'name',
        'school_level',
        'subject_id',
        'content_type',
        'audience',
        'charges_fee',
        'status',
        'starts_on',
        'ends_on',
        'max_students',
        'registration_form',
        'created_by',
      ])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!program) {
      throw notFoundError('Không tìm thấy chương trình', 'program');
    }
    return program;
  }

  private async assertCanSee(database: Executor, currentUser: CurrentUser, programId: string) {
    const visible = await this.visibleProgramIds(database, currentUser);
    if (visible !== null && !visible.includes(programId)) {
      throw notFoundError('Không tìm thấy chương trình', 'program');
    }
  }

  private async assertTeaches(database: Executor, currentUser: CurrentUser, programId: string) {
    if (currentUser.hasPermission(MANAGE)) {
      return;
    }
    const teacher = await database
      .selectFrom('tutoring_program_teachers')
      .select('program_id')
      .where('program_id', '=', programId)
      .where('teacher_user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!teacher) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Chỉ giáo viên dạy chương trình hoặc Ban Giám hiệu làm được việc này',
      );
    }
  }

  async getProgram(currentUser: CurrentUser, id: string) {
    const database = await this.database();
    const program = await this.loadProgram(database, id);
    await this.assertCanSee(database, currentUser, id);
    const [detail, teachers, classes, candidates, sessions, registrations] = await Promise.all([
      database.selectFrom('tutoring_programs').selectAll().where('id', '=', id).executeTakeFirstOrThrow(),
      database.selectFrom('tutoring_program_teachers').selectAll().where('program_id', '=', id).execute(),
      database
        .selectFrom('tutoring_program_classes')
        .innerJoin('classes', 'classes.id', 'tutoring_program_classes.class_id')
        .select(['classes.id', 'classes.name'])
        .where('tutoring_program_classes.program_id', '=', id)
        .execute(),
      database
        .selectFrom('tutoring_program_candidates')
        .innerJoin('children', 'children.id', 'tutoring_program_candidates.child_id')
        .select(['children.id', 'children.full_name', 'tutoring_program_candidates.source'])
        .where('tutoring_program_candidates.program_id', '=', id)
        .orderBy('children.full_name')
        .execute(),
      database
        .selectFrom('tutoring_sessions')
        .selectAll()
        .where('program_id', '=', id)
        .orderBy('session_date')
        .orderBy('start_time')
        .execute(),
      this.registrationRows(database, id),
    ]);
    return {
      ...detail,
      starts_on: dateText(detail.starts_on),
      ends_on: dateText(detail.ends_on),
      teachers,
      classes,
      candidates,
      sessions: sessions.map((session) => ({ ...session, session_date: dateText(session.session_date) })),
      registrations,
      can_manage: currentUser.hasPermission(MANAGE),
      can_teach:
        program.created_by === currentUser.id || teachers.some((teacher) => teacher.teacher_user_id === currentUser.id),
    };
  }

  private async registrationRows(database: Executor, programId: string) {
    return database
      .selectFrom('tutoring_registrations')
      .innerJoin('children', 'children.id', 'tutoring_registrations.child_id')
      .select([
        'tutoring_registrations.id',
        'tutoring_registrations.child_id',
        'children.full_name as child_name',
        'tutoring_registrations.guardian_name',
        'tutoring_registrations.status',
        'tutoring_registrations.submitted_at',
        'tutoring_registrations.decided_by_name',
        'tutoring_registrations.reject_reason',
        'tutoring_registrations.note',
      ])
      .where('tutoring_registrations.program_id', '=', programId)
      .orderBy('tutoring_registrations.submitted_at')
      .execute();
  }

  // Kiểm quy định của chương trình, lớp đúng cấp, giáo viên có trong phân công
  private async validateProgram(database: Executor, input: ProgramInput) {
    const rules = await this.ruleSet(database, input.startsOn);
    // Nháp có thu được lưu khi chưa đặt giá; duyệt mới bắt buộc có giá (YCTD-253)
    const violations = [
      ...programRuleViolations(input, rules),
      ...feeRuleViolations({ ...input, teacherPayRates: Object.values(input.teacherPayRates) }).filter(
        (violation) => !(violation.code === 'fee_missing' && input.chargesFee),
      ),
    ];
    if (violations.length > 0) {
      throw tutoringRuleError(violations);
    }
    if (input.subjectId) {
      const subject = await database
        .selectFrom('subjects')
        .select('school_level')
        .where('id', '=', input.subjectId)
        .executeTakeFirst();
      if (!subject || subject.school_level !== input.schoolLevel) {
        throw validationError([{ field: 'subject_id', message: 'Môn không thuộc cấp học của chương trình' }]);
      }
    }
    if (input.classIds.length > 0) {
      const classes = await database
        .selectFrom('classes')
        .select(['id', 'school_level'])
        .where('id', 'in', input.classIds)
        .execute();
      if (classes.length !== input.classIds.length || classes.some((row) => row.school_level !== input.schoolLevel)) {
        throw validationError([
          { field: 'class_ids', message: 'Có lớp không tồn tại hoặc không thuộc cấp học của chương trình' },
        ]);
      }
    }
  }

  async saveProgram(currentUser: CurrentUser, id: string | null, input: ProgramInput, origin: ChangeOrigin) {
    const database = await this.database();
    if (id) {
      const existing = await this.loadProgram(database, id);
      if (existing.created_by !== currentUser.id && !currentUser.hasPermission(MANAGE)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người lập hoặc Ban Giám hiệu sửa được chương trình');
      }
      if (!['draft', 'rejected'].includes(existing.status)) {
        throw new ApplicationError('ERR_CONFLICT', 'Chỉ sửa được chương trình nháp hoặc không duyệt');
      }
    }
    await this.validateProgram(database, input);
    const teacherIds = input.teacherUserIds.length > 0 ? input.teacherUserIds : [currentUser.id];
    const known = await database
      .selectFrom('class_staff_assignments')
      .select(['staff_user_id', 'staff_name'])
      .where('staff_user_id', 'in', teacherIds)
      .execute();
    const names = new Map(known.map((row) => [row.staff_user_id, row.staff_name]));
    names.set(currentUser.id, names.get(currentUser.id) ?? currentUser.description.full_name);
    if (teacherIds.some((teacherId) => !names.has(teacherId))) {
      throw validationError([
        { field: 'teacher_user_ids', message: 'Có giáo viên không có trong phân công giảng dạy của trường' },
      ]);
    }
    const now = this.clock.now();
    const values = {
      name: input.name,
      school_level: input.schoolLevel,
      subject_id: input.subjectId,
      topic: input.topic,
      content_type: input.contentType,
      audience: input.audience,
      // Dạy thêm môn học trong nhà trường luôn không thu tiền (đã kiểm ở trên, ghi lại cho chắc)
      charges_fee: input.contentType === 'curriculum' ? false : input.chargesFee,
      // Giá chỉ có ở chương trình bổ trợ có thu; nguồn chi thù lao của `curriculum` luôn là kinh phí của trường (YCTD-253)
      fee_basis: input.chargesFee ? input.feeBasis : null,
      fee_amount: input.chargesFee ? input.feeAmount : null,
      cancel_refund: input.cancelRefund,
      pay_rate_per_period: input.payRatePerPeriod,
      funding_source: input.contentType === 'curriculum' ? ('school_budget' as const) : input.fundingSource,
      delivery: input.delivery,
      description: input.description,
      registration_form: input.registrationForm,
      max_students: input.maxStudents,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    };
    return database.transaction().execute(async (transaction) => {
      const saved = id
        ? await transaction
            .updateTable('tutoring_programs')
            .set({ ...values, status: 'draft', reject_reason: null, updated_at: now })
            .where('id', '=', id)
            .returning('id')
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('tutoring_programs')
            .values({ ...values, created_by: currentUser.id, created_by_name: currentUser.description.full_name })
            .returning('id')
            .executeTakeFirstOrThrow();
      await transaction.deleteFrom('tutoring_program_teachers').where('program_id', '=', saved.id).execute();
      await transaction
        .insertInto('tutoring_program_teachers')
        .values(
          teacherIds.map((teacherId) => ({
            program_id: saved.id,
            teacher_user_id: teacherId,
            teacher_name: names.get(teacherId) as string,
            pay_rate_per_period: input.teacherPayRates[teacherId] ?? null,
          })),
        )
        .execute();
      await transaction.deleteFrom('tutoring_program_classes').where('program_id', '=', saved.id).execute();
      if (input.classIds.length > 0) {
        await transaction
          .insertInto('tutoring_program_classes')
          .values(input.classIds.map((classId) => ({ program_id: saved.id, class_id: classId })))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'tutoring_programs',
        entityId: saved.id,
        action: id ? 'update' : 'create',
        before: null,
        after: { ...values, class_ids: input.classIds, teacher_user_ids: teacherIds },
      });
      return { id: saved.id };
    });
  }

  // Nộp, duyệt, không duyệt, đóng
  async transition(
    currentUser: CurrentUser,
    id: string,
    action: 'submit' | 'approve' | 'reject' | 'close',
    reason: string | null,
    origin: ChangeOrigin,
  ) {
    const database = await this.database();
    const program = await this.loadProgram(database, id);
    const allowed: Record<typeof action, string[]> = {
      submit: ['draft', 'rejected'],
      approve: ['submitted'],
      reject: ['submitted'],
      close: ['approved'],
    };
    if (!allowed[action].includes(program.status)) {
      throw new ApplicationError('ERR_CONFLICT', 'Trạng thái chương trình không cho làm việc này');
    }
    if (action === 'submit') {
      await this.assertTeaches(database, currentUser, id);
    } else if (!currentUser.hasPermission(MANAGE)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu duyệt, đóng chương trình');
    }
    if (action === 'reject' && (!reason || reason.length < 3)) {
      throw validationError([{ field: 'reason', message: 'Ghi lý do không duyệt' }]);
    }
    if (action === 'approve') {
      // Duyệt lại theo quy định hiện hành (quy định có thể đổi sau khi lập)
      const violations: { code: string; message: string }[] = programRuleViolations(
        {
          contentType: program.content_type,
          chargesFee: program.charges_fee,
          audience: program.audience,
          subjectId: program.subject_id,
          schoolLevel: program.school_level,
        },
        await this.ruleSet(database, dateText(program.starts_on)),
      );
      // Chương trình có thu phải có giá trước khi mở đăng ký; `curriculum` không có giá, nguồn chi là kinh phí trường (YCTD-253)
      const money = await database
        .selectFrom('tutoring_programs')
        .select(['fee_basis', 'fee_amount', 'pay_rate_per_period', 'funding_source'])
        .where('id', '=', id)
        .executeTakeFirstOrThrow();
      violations.push(
        ...feeRuleViolations({
          contentType: program.content_type,
          chargesFee: program.charges_fee,
          feeBasis: money.fee_basis,
          feeAmount: money.fee_amount === null ? null : Number(money.fee_amount),
          fundingSource: money.funding_source,
          payRatePerPeriod: money.pay_rate_per_period === null ? null : Number(money.pay_rate_per_period),
        }),
      );
      if (violations.length > 0) {
        throw tutoringRuleError(violations);
      }
    }
    const status = { submit: 'submitted', approve: 'approved', reject: 'rejected', close: 'closed' }[action] as
      'submitted' | 'approved' | 'rejected' | 'closed';
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('tutoring_programs')
        .set({
          status,
          updated_at: now,
          ...(action === 'submit'
            ? {}
            : { decided_by: currentUser.id, decided_by_name: currentUser.description.full_name, decided_at: now }),
          ...(action === 'reject' ? { reject_reason: reason } : {}),
        })
        .where('id', '=', id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'tutoring_programs',
        entityId: id,
        action: 'update',
        before: { status: program.status },
        after: { status, reason },
      });
    });
    return { status };
  }

  // Gợi ý học sinh chưa đạt môn ở kỳ gần nhất có kết quả (sổ điểm), trong các lớp đối tượng
  async suggestCandidates(currentUser: CurrentUser, id: string) {
    const database = await this.database();
    const program = await this.loadProgram(database, id);
    await this.assertTeaches(database, currentUser, id);
    if (!program.subject_id) {
      return [];
    }
    const classIds = (
      await database.selectFrom('tutoring_program_classes').select('class_id').where('program_id', '=', id).execute()
    ).map((row) => row.class_id);
    if (classIds.length === 0) {
      return [];
    }
    const rows = await database
      .selectFrom('subject_term_results')
      .innerJoin('children', 'children.id', 'subject_term_results.child_id')
      .select(['children.id', 'children.full_name', 'subject_term_results.term_type'])
      .where('subject_term_results.subject_id', '=', program.subject_id)
      .where('subject_term_results.class_id', 'in', classIds)
      .where('subject_term_results.result', '=', 'fail')
      .orderBy('children.full_name')
      .execute();
    const unique = new Map(rows.map((row) => [row.id, row]));
    return [...unique.values()];
  }

  async setCandidates(currentUser: CurrentUser, id: string, body: Body, origin: ChangeOrigin) {
    const database = await this.database();
    await this.loadProgram(database, id);
    await this.assertTeaches(database, currentUser, id);
    const errors: FieldError[] = [];
    const childIds = idList(body, 'child_ids', errors);
    const suggested = new Set(idList(body, 'suggested_ids', errors));
    if (errors.length > 0) {
      throw validationError(errors);
    }
    if (childIds.length > 0) {
      const found = await database.selectFrom('children').select('id').where('id', 'in', childIds).execute();
      if (found.length !== childIds.length) {
        throw notFoundError('Có học sinh không tồn tại', 'child');
      }
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('tutoring_program_candidates').where('program_id', '=', id).execute();
      if (childIds.length > 0) {
        await transaction
          .insertInto('tutoring_program_candidates')
          .values(
            childIds.map((childId) => ({
              program_id: id,
              child_id: childId,
              source: suggested.has(childId) ? ('suggested' as const) : ('manual' as const),
              confirmed_by_name: currentUser.description.full_name,
            })),
          )
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'tutoring_program_candidates',
        entityId: id,
        action: 'update',
        before: null,
        after: { child_ids: childIds },
      });
    });
    return { count: childIds.length };
  }

  // ---------- Buổi học

  // Độ dài một tiết của cấp: theo khung giờ tiết của trường, chưa khai thì theo quy định
  private async periodContext(level: SchoolLevelCode, rules: TutoringRuleSet) {
    const slots = await this.timetables.periodSlots(level);
    const first = slots[0];
    const minutes = first
      ? Math.round((Date.parse(`2000-01-01T${first.end_time}`) - Date.parse(`2000-01-01T${first.start_time}`)) / 60_000)
      : (rules.defaultPeriodMinutes[level] ?? 45);
    return { periodMinutes: minutes > 0 ? minutes : 45, slots: new Map(slots.map((slot) => [slot.period_no, slot])) };
  }

  // Trùng thời khoá biểu chính khoá của giáo viên dạy hoặc của lớp đối tượng (chỉ đọc thời khoá biểu)
  private async timetableConflicts(
    database: Executor,
    program: ProgramRow,
    teacherIds: string[],
    classIds: string[],
    slots: Map<number, { start_time: string; end_time: string }>,
    sessions: Array<{ date: string; start: string; end: string }>,
  ): Promise<TutoringRuleViolation[]> {
    if (slots.size === 0 || sessions.length === 0) {
      return [];
    }
    const violations: TutoringRuleViolation[] = [];
    for (const session of sessions) {
      const versions = await this.timetables.applyingVersions(database, session.date, program.school_level);
      const version = versions[0];
      if (!version) {
        continue;
      }
      const lessons = await database
        .selectFrom('timetable_lessons')
        .leftJoin('classes', 'classes.id', 'timetable_lessons.class_id')
        .select([
          'timetable_lessons.period_no',
          'timetable_lessons.teacher_user_id',
          'timetable_lessons.class_id',
          'timetable_lessons.teacher_name',
          'classes.name as class_name',
        ])
        .where('timetable_lessons.version_id', '=', version.id)
        .where('timetable_lessons.weekday', '=', isoWeekday(session.date))
        .where((expression) =>
          expression.or([
            ...(teacherIds.length ? [expression('timetable_lessons.teacher_user_id', 'in', teacherIds)] : []),
            ...(classIds.length ? [expression('timetable_lessons.class_id', 'in', classIds)] : []),
            expression.val(false),
          ]),
        )
        .execute();
      for (const lesson of lessons) {
        const slot = slots.get(lesson.period_no);
        if (
          !slot ||
          !timesOverlap({ start: session.start, end: session.end }, { start: slot.start_time, end: slot.end_time })
        ) {
          continue;
        }
        if (lesson.teacher_user_id && teacherIds.includes(lesson.teacher_user_id)) {
          violations.push({
            code: 'timetable_teacher',
            message: `Ngày ${session.date} trùng tiết ${lesson.period_no} chính khoá của ${lesson.teacher_name ?? 'giáo viên'}`,
          });
        } else if (classIds.includes(lesson.class_id)) {
          violations.push({
            code: 'timetable_class',
            message: `Ngày ${session.date} trùng tiết ${lesson.period_no} chính khoá của lớp ${lesson.class_name ?? ''}`,
          });
        }
      }
    }
    return violations;
  }

  // Giới hạn tiết mỗi tuần mỗi môn của nội dung `curriculum` cho các học sinh, cộng thêm các buổi dự kiến
  private async weeklyLimitViolations(
    database: Executor,
    subjectId: string,
    childIds: string[],
    extra: Array<{ childId: string; date: string; periods: number }>,
    rules: TutoringRuleSet,
  ): Promise<TutoringRuleViolation[]> {
    if (childIds.length === 0) {
      return [];
    }
    const existing = await database
      .selectFrom('tutoring_sessions')
      .innerJoin('tutoring_programs', 'tutoring_programs.id', 'tutoring_sessions.program_id')
      .innerJoin('tutoring_registrations', 'tutoring_registrations.program_id', 'tutoring_programs.id')
      .select(['tutoring_registrations.child_id', 'tutoring_sessions.session_date', 'tutoring_sessions.periods'])
      .where('tutoring_programs.content_type', '=', 'curriculum')
      .where('tutoring_programs.subject_id', '=', subjectId)
      .where('tutoring_programs.status', 'in', ['submitted', 'approved', 'draft'])
      .where('tutoring_sessions.status', '=', 'scheduled')
      .where('tutoring_registrations.status', '=', 'approved')
      .where('tutoring_registrations.child_id', 'in', childIds)
      .execute();
    const loads = [
      ...existing.map((row) => ({
        childId: row.child_id,
        subjectId,
        week: weekStart(dateText(row.session_date)),
        periods: row.periods,
      })),
      ...extra.map((item) => ({ childId: item.childId, subjectId, week: weekStart(item.date), periods: item.periods })),
    ];
    const exemptions = await database
      .selectFrom('tutoring_exemption_children')
      .innerJoin('tutoring_exemptions', 'tutoring_exemptions.id', 'tutoring_exemption_children.exemption_id')
      .select(['tutoring_exemption_children.child_id', 'tutoring_exemptions.max_periods_per_week'])
      .where('tutoring_exemptions.subject_id', '=', subjectId)
      .where('tutoring_exemption_children.child_id', 'in', childIds)
      .execute();
    const over = weeklyLoadViolations(
      loads,
      rules.maxCurriculumPeriodsPerWeek,
      exemptions.map((row) => ({ childId: row.child_id, subjectId, maxPeriods: row.max_periods_per_week })),
    );
    if (over.length === 0) {
      return [];
    }
    const names = new Map(
      (
        await database
          .selectFrom('children')
          .select(['id', 'full_name'])
          .where('id', 'in', [...new Set(over.map((item) => item.childId))])
          .execute()
      ).map((row) => [row.id, row.full_name]),
    );
    return over.map((item) => ({
      code: 'weekly_periods' as const,
      message: `${names.get(item.childId) ?? 'Học sinh'} học ${item.periods} tiết môn này trong tuần từ ${item.week}, quá ${item.limit} tiết; cần quyết định tăng thời lượng của Sở`,
    }));
  }

  private async approvedChildIds(database: Executor, programId: string): Promise<string[]> {
    const rows = await database
      .selectFrom('tutoring_registrations')
      .select('child_id')
      .where('program_id', '=', programId)
      .where('status', '=', 'approved')
      .execute();
    return rows.map((row) => row.child_id);
  }

  async createSessions(currentUser: CurrentUser, programId: string, body: Body, origin: ChangeOrigin) {
    const database = await this.database();
    const program = await this.loadProgram(database, programId);
    await this.assertTeaches(database, currentUser, programId);
    if (!['draft', 'submitted', 'approved'].includes(program.status)) {
      throw new ApplicationError('ERR_CONFLICT', 'Chương trình đã đóng hoặc không duyệt');
    }
    const errors: FieldError[] = [];
    const startTime = text(body, 'start_time');
    const endTime = text(body, 'end_time');
    if (!TIME.test(startTime) || !TIME.test(endTime) || endTime <= startTime) {
      errors.push({ field: 'start_time', message: 'Giờ dạng HH:MM, kết thúc sau bắt đầu' });
    }
    const startsOn = dateText(program.starts_on);
    const endsOn = dateText(program.ends_on);
    let dates: string[] = [];
    const weekly = body?.weekly as Record<string, unknown> | undefined;
    if (weekly) {
      const from = text(weekly, 'from') || startsOn;
      const to = text(weekly, 'to') || endsOn;
      const weekdays = Array.isArray(weekly.weekdays) ? (weekly.weekdays as unknown[]) : [];
      if (
        !DATE.test(from) ||
        !DATE.test(to) ||
        weekdays.length === 0 ||
        weekdays.some((day) => !Number.isInteger(day) || (day as number) < 1 || (day as number) > 7)
      ) {
        errors.push({
          field: 'weekly',
          message: 'Lặp theo tuần cần từ ngày, đến ngày, các thứ (1 là thứ Hai đến 7 là Chủ nhật)',
        });
      } else {
        dates = weeklyDates(from, to, weekdays as number[]);
      }
    } else {
      const date = text(body, 'session_date');
      if (!DATE.test(date)) {
        errors.push({ field: 'session_date', message: 'Ngày buổi học dạng yyyy-mm-dd' });
      } else {
        dates = [date];
      }
    }
    if (dates.some((date) => date < startsOn || date > endsOn)) {
      errors.push({
        field: 'session_date',
        message: `Buổi học phải trong thời gian của chương trình (${startsOn} đến ${endsOn})`,
      });
    }
    if (errors.length === 0 && dates.length === 0) {
      errors.push({ field: 'weekly', message: 'Không có ngày nào rơi vào các thứ đã chọn' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const rules = await this.ruleSet(database, dates[0] as string);
    const { periodMinutes, slots } = await this.periodContext(program.school_level, rules);
    const periods = periodsForSession(startTime, endTime, periodMinutes);
    const [teachers, classes] = await Promise.all([
      database
        .selectFrom('tutoring_program_teachers')
        .select('teacher_user_id')
        .where('program_id', '=', programId)
        .execute(),
      database.selectFrom('tutoring_program_classes').select('class_id').where('program_id', '=', programId).execute(),
    ]);
    const violations = await this.timetableConflicts(
      database,
      program,
      teachers.map((row) => row.teacher_user_id),
      classes.map((row) => row.class_id),
      slots,
      dates.map((date) => ({ date, start: startTime, end: endTime })),
    );
    if (program.content_type === 'curriculum' && program.subject_id) {
      const childIds = await this.approvedChildIds(database, programId);
      violations.push(
        ...(await this.weeklyLimitViolations(
          database,
          program.subject_id,
          childIds,
          childIds.flatMap((childId) => dates.map((date) => ({ childId, date, periods }))),
          rules,
        )),
      );
    }
    if (violations.length > 0) {
      throw tutoringRuleError(violations.slice(0, 10));
    }
    const seriesId = dates.length > 1 ? randomUUID() : null;
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('tutoring_sessions')
        .values(
          dates.map((date) => ({
            program_id: programId,
            series_id: seriesId,
            session_date: date,
            start_time: startTime,
            end_time: endTime,
            periods,
            location: optionalText(body, 'location', 200),
            created_by: currentUser.id,
          })),
        )
        .returning('id')
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'tutoring_sessions',
        entityId: seriesId ?? (created[0]?.id as string),
        action: 'create',
        before: null,
        after: { program_id: programId, dates, start_time: startTime, end_time: endTime, periods },
      });
      return { count: created.length, periods };
    });
  }

  private async guardianRecipients(database: Executor, programId: string): Promise<NotificationRecipient[]> {
    const rows = await database
      .selectFrom('tutoring_registrations')
      .select('guardian_user_id')
      .where('program_id', '=', programId)
      .where('status', '=', 'approved')
      .execute();
    return [...new Set(rows.map((row) => row.guardian_user_id))].map((userId) => ({
      userId,
      channel: 'in_app' as const,
    }));
  }

  private async rootOrgUnit(database: Executor): Promise<string | null> {
    const root = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    return root?.id ?? null;
  }

  async cancelSession(currentUser: CurrentUser, sessionId: string, reason: string, origin: ChangeOrigin) {
    const database = await this.database();
    const session = await this.loadSession(database, sessionId);
    await this.assertTeaches(database, currentUser, session.program_id);
    if (session.status === 'cancelled') {
      throw new ApplicationError('ERR_CONFLICT', 'Buổi học đã hủy');
    }
    if (reason.length < 3) {
      throw validationError([{ field: 'reason', message: 'Ghi lý do hủy buổi' }]);
    }
    // Buổi đã xác nhận điểm danh là buổi đã dạy (tính thù lao), không hủy được (YCTD-253)
    const confirmed = await database
      .selectFrom('tutoring_sessions')
      .select('attendance_confirmed_at')
      .where('id', '=', sessionId)
      .executeTakeFirstOrThrow();
    if (confirmed.attendance_confirmed_at) {
      throw new ApplicationError('ERR_CONFLICT', 'Buổi đã xác nhận điểm danh là buổi đã dạy, không hủy được');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('tutoring_sessions')
        .set({ status: 'cancelled', cancel_reason: reason })
        .where('id', '=', sessionId)
        .execute();
      // Buổi đã thu tiền thì lập khoản trừ: trừ kỳ sau hoặc kế toán điều chỉnh hóa đơn, hoàn theo cấu hình (YCTD-253)
      const credited = await creditCancelledSession(transaction, {
        sessionId,
        programId: session.program_id,
        reason: `Hủy buổi ${dateText(session.session_date)}: ${reason}`,
        actorName: currentUser.description.full_name,
      });
      await queueNotification(transaction, {
        orgUnitId: await this.rootOrgUnit(transaction),
        templateCode: 'tutoring_session_cancelled',
        title: `Hủy buổi ${session.program_name} ngày ${dateText(session.session_date)}`,
        body: `${session.start_time}–${session.end_time}: ${reason}${
          credited > 0 ? '. Khoản đã thu cho buổi này được trừ vào kỳ sau hoặc hoàn theo quy định của trường' : ''
        }`,
        targetType: 'tutoring_sessions',
        targetId: sessionId,
        recipients: await this.guardianRecipients(transaction, session.program_id),
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'tutoring_sessions',
        entityId: sessionId,
        action: 'update',
        before: { status: 'scheduled' },
        after: { status: 'cancelled', reason },
      });
    });
    return { status: 'cancelled' };
  }

  private async loadSession(database: Executor, sessionId: string) {
    if (!UUID.test(sessionId)) {
      throw notFoundError('Không tìm thấy buổi học', 'session');
    }
    const session = await database
      .selectFrom('tutoring_sessions')
      .innerJoin('tutoring_programs', 'tutoring_programs.id', 'tutoring_sessions.program_id')
      .select([
        'tutoring_sessions.id',
        'tutoring_sessions.program_id',
        'tutoring_sessions.session_date',
        'tutoring_sessions.start_time',
        'tutoring_sessions.end_time',
        'tutoring_sessions.status',
        'tutoring_sessions.attendance_confirmed_at',
        'tutoring_programs.name as program_name',
      ])
      .where('tutoring_sessions.id', '=', sessionId)
      .executeTakeFirst();
    if (!session) {
      throw notFoundError('Không tìm thấy buổi học', 'session');
    }
    return session;
  }

  // Lịch buổi học: giáo viên thấy buổi của chương trình mình dạy, Ban Giám hiệu thấy mọi buổi
  async listSessions(currentUser: CurrentUser, from: string, to: string) {
    const database = await this.database();
    if (!DATE.test(from) || !DATE.test(to) || to < from) {
      throw validationError([{ field: 'from', message: 'Khoảng ngày dạng yyyy-mm-dd' }]);
    }
    let query = database
      .selectFrom('tutoring_sessions')
      .innerJoin('tutoring_programs', 'tutoring_programs.id', 'tutoring_sessions.program_id')
      .select([
        'tutoring_sessions.id',
        'tutoring_sessions.program_id',
        'tutoring_programs.name as program_name',
        'tutoring_programs.content_type',
        'tutoring_sessions.session_date',
        'tutoring_sessions.start_time',
        'tutoring_sessions.end_time',
        'tutoring_sessions.periods',
        'tutoring_sessions.location',
        'tutoring_sessions.status',
        'tutoring_sessions.cancel_reason',
        'tutoring_sessions.attendance_confirmed_at',
      ])
      .where('tutoring_sessions.session_date', '>=', from)
      .where('tutoring_sessions.session_date', '<=', to)
      .orderBy('tutoring_sessions.session_date')
      .orderBy('tutoring_sessions.start_time');
    if (!currentUser.hasPermission(MANAGE)) {
      query = query.where('tutoring_sessions.program_id', 'in', (subquery) =>
        subquery
          .selectFrom('tutoring_program_teachers')
          .select('program_id')
          .where('teacher_user_id', '=', currentUser.id),
      );
    }
    const rows = await query.execute();
    return rows.map((row) => ({ ...row, session_date: dateText(row.session_date) }));
  }

  // ---------- Điểm danh

  async attendance(currentUser: CurrentUser, sessionId: string) {
    const database = await this.database();
    const session = await this.loadSession(database, sessionId);
    await this.assertTeaches(database, currentUser, session.program_id);
    const [registrants, rows] = await Promise.all([
      database
        .selectFrom('tutoring_registrations')
        .innerJoin('children', 'children.id', 'tutoring_registrations.child_id')
        .select(['children.id', 'children.full_name'])
        .where('tutoring_registrations.program_id', '=', session.program_id)
        .where('tutoring_registrations.status', '=', 'approved')
        .orderBy('children.full_name')
        .execute(),
      database.selectFrom('tutoring_attendance').selectAll().where('session_id', '=', sessionId).execute(),
    ]);
    const byChild = new Map(rows.map((row) => [row.child_id, row]));
    // Giáo viên của chương trình và người đã dạy buổi (chọn khi Ban Giám hiệu xác nhận thay, YCTD-253)
    const [teachers, taught] = await Promise.all([
      database
        .selectFrom('tutoring_program_teachers')
        .select(['teacher_user_id', 'teacher_name'])
        .where('program_id', '=', session.program_id)
        .execute(),
      database
        .selectFrom('tutoring_sessions')
        .select('taught_by_user_id')
        .where('id', '=', sessionId)
        .executeTakeFirstOrThrow(),
    ]);
    return {
      teachers,
      taught_by_user_id: taught.taught_by_user_id,
      session: { ...session, session_date: dateText(session.session_date) },
      students: registrants.map((child) => {
        const row = byChild.get(child.id);
        return {
          child_id: child.id,
          full_name: child.full_name,
          status: row?.status ?? null,
          source: row?.source ?? null,
          joined_at: row?.joined_at ?? null,
          left_at: row?.left_at ?? null,
          confirmed_at: row?.confirmed_at ?? null,
          note: row?.note ?? null,
        };
      }),
    };
  }

  async confirmAttendance(currentUser: CurrentUser, sessionId: string, body: Body, origin: ChangeOrigin) {
    const database = await this.database();
    const session = await this.loadSession(database, sessionId);
    await this.assertTeaches(database, currentUser, session.program_id);
    if (session.status === 'cancelled') {
      throw new ApplicationError('ERR_CONFLICT', 'Buổi học đã hủy');
    }
    const entries = Array.isArray(body?.entries) ? (body.entries as Array<Record<string, unknown>>) : [];
    const registrants = new Set(await this.approvedChildIds(database, session.program_id));
    const errors: FieldError[] = [];
    if (entries.length === 0 || entries.length > 500) {
      errors.push({ field: 'entries', message: 'Danh sách điểm danh trống hoặc quá dài' });
    }
    for (const entry of entries) {
      if (
        typeof entry?.child_id !== 'string' ||
        !registrants.has(entry.child_id) ||
        !ATTENDANCE.includes(entry.status as TutoringAttendanceStatus)
      ) {
        errors.push({
          field: 'entries',
          message: 'Có học sinh không đăng ký chương trình hoặc trạng thái không hợp lệ',
        });
        break;
      }
    }
    // Người dạy buổi (tính thù lao, YCTD-253): giáo viên của chương trình đang xác nhận; Ban Giám hiệu xác nhận thay thì chọn
    // `taught_by_user_id`, chương trình chỉ có một giáo viên thì là giáo viên đó
    const teachers = await database
      .selectFrom('tutoring_program_teachers')
      .select(['teacher_user_id', 'teacher_name'])
      .where('program_id', '=', session.program_id)
      .execute();
    const requested = typeof body?.taught_by_user_id === 'string' ? body.taught_by_user_id : null;
    const taughtBy =
      teachers.find((teacher) => teacher.teacher_user_id === requested) ??
      teachers.find((teacher) => teacher.teacher_user_id === currentUser.id) ??
      (teachers.length === 1 ? teachers[0] : undefined);
    if (!taughtBy) {
      errors.push({ field: 'taught_by_user_id', message: 'Chọn giáo viên đã dạy buổi này' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const now = this.clock.now();
    const existing = new Map(
      (await database.selectFrom('tutoring_attendance').selectAll().where('session_id', '=', sessionId).execute()).map(
        (row) => [row.child_id, row],
      ),
    );
    const notify: string[] = [];
    await database.transaction().execute(async (transaction) => {
      for (const entry of entries) {
        const childId = entry.child_id as string;
        const status = entry.status as TutoringAttendanceStatus;
        const before = existing.get(childId);
        const shouldNotify = status === 'absent' && !before?.guardian_notified_at;
        await transaction
          .insertInto('tutoring_attendance')
          .values({
            session_id: sessionId,
            child_id: childId,
            status,
            source: 'teacher',
            note: typeof entry.note === 'string' ? entry.note.slice(0, 500) : null,
            confirmed_by_name: currentUser.description.full_name,
            confirmed_at: now,
            guardian_notified_at: shouldNotify ? now : (before?.guardian_notified_at ?? null),
          })
          .onConflict((conflict) =>
            conflict.columns(['session_id', 'child_id']).doUpdateSet({
              status,
              note: typeof entry.note === 'string' ? entry.note.slice(0, 500) : null,
              confirmed_by_name: currentUser.description.full_name,
              confirmed_at: now,
              ...(shouldNotify ? { guardian_notified_at: now } : {}),
            }),
          )
          .execute();
        if (shouldNotify) {
          notify.push(childId);
        }
      }
      await transaction
        .updateTable('tutoring_sessions')
        .set({
          attendance_confirmed_at: now,
          attendance_confirmed_by_name: currentUser.description.full_name,
          taught_by_user_id: taughtBy?.teacher_user_id ?? null,
          taught_by_name: taughtBy?.teacher_name ?? null,
        })
        .where('id', '=', sessionId)
        .execute();
      if (notify.length > 0) {
        const guardians = await transaction
          .selectFrom('tutoring_registrations')
          .innerJoin('children', 'children.id', 'tutoring_registrations.child_id')
          .select(['tutoring_registrations.guardian_user_id', 'children.full_name'])
          .where('tutoring_registrations.program_id', '=', session.program_id)
          .where('tutoring_registrations.status', '=', 'approved')
          .where('tutoring_registrations.child_id', 'in', notify)
          .execute();
        const orgUnitId = await this.rootOrgUnit(transaction);
        for (const guardian of guardians) {
          await queueNotification(transaction, {
            orgUnitId,
            templateCode: 'tutoring_absent',
            title: `${guardian.full_name} vắng buổi ${session.program_name}`,
            body: `Buổi ngày ${dateText(session.session_date)}, ${session.start_time}–${session.end_time}`,
            targetType: 'tutoring_sessions',
            targetId: sessionId,
            recipients: [{ userId: guardian.guardian_user_id, channel: 'in_app' }],
          });
        }
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'tutoring_attendance',
        entityId: sessionId,
        action: 'update',
        before: null,
        after: { entries: entries.map((entry) => ({ child_id: entry.child_id, status: entry.status })) },
      });
    });
    return { confirmed: entries.length, notified: notify.length };
  }

  // Chỗ nối của 27a: nhận sự kiện vào, ra phòng video của buổi và cập nhật điểm danh gợi ý (chưa xác nhận) theo nhật ký
  async recordRoomEvents(
    sessionId: string,
    events: Array<{ childId: string; kind: 'join' | 'leave'; at: Date }>,
    source: string,
  ): Promise<{ recorded: number }> {
    const database = await this.database();
    const session = await this.loadSession(database, sessionId);
    const registrants = new Set(await this.approvedChildIds(database, session.program_id));
    const valid = events.filter((event) => registrants.has(event.childId));
    if (valid.length === 0) {
      return { recorded: 0 };
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('tutoring_room_events')
        .values(
          valid.map((event) => ({
            session_id: sessionId,
            child_id: event.childId,
            kind: event.kind,
            at: event.at,
            source,
          })),
        )
        .execute();
      for (const childId of new Set(valid.map((event) => event.childId))) {
        const all = await transaction
          .selectFrom('tutoring_room_events')
          .select(['kind', 'at'])
          .where('session_id', '=', sessionId)
          .where('child_id', '=', childId)
          .execute();
        const derived = attendanceFromRoomEvents(all, {
          date: dateText(session.session_date),
          startTime: session.start_time,
          endTime: session.end_time,
        });
        await transaction
          .insertInto('tutoring_attendance')
          .values({
            session_id: sessionId,
            child_id: childId,
            status: derived.status,
            source: 'room_log',
            joined_at: derived.joinedAt,
            left_at: derived.leftAt,
          })
          .onConflict((conflict) =>
            conflict
              .columns(['session_id', 'child_id'])
              .doUpdateSet({ status: derived.status, joined_at: derived.joinedAt, left_at: derived.leftAt })
              .where('tutoring_attendance.confirmed_at', 'is', null),
          )
          .execute();
      }
    });
    return { recorded: valid.length };
  }

  // ---------- Đơn đăng ký (phía nhà trường)

  async listRegistrations(currentUser: CurrentUser, programId: string) {
    const database = await this.database();
    await this.loadProgram(database, programId);
    await this.assertCanSee(database, currentUser, programId);
    return this.registrationRows(database, programId);
  }

  async decideRegistration(
    currentUser: CurrentUser,
    registrationId: string,
    approve: boolean,
    reason: string | null,
    origin: ChangeOrigin,
  ) {
    const database = await this.database();
    if (!UUID.test(registrationId)) {
      throw notFoundError('Không tìm thấy đơn', 'registration');
    }
    const registration = await database
      .selectFrom('tutoring_registrations')
      .selectAll()
      .where('id', '=', registrationId)
      .executeTakeFirst();
    if (!registration) {
      throw notFoundError('Không tìm thấy đơn', 'registration');
    }
    const program = await this.loadProgram(database, registration.program_id);
    if (!currentUser.hasPermission(MANAGE)) {
      const homeroom = await this.homeroomClassIds(database, currentUser.id);
      const childClass = await database
        .selectFrom('class_enrollments')
        .select('class_id')
        .where('child_id', '=', registration.child_id)
        .where('is_current', '=', true)
        .executeTakeFirst();
      const teaches = await database
        .selectFrom('tutoring_program_teachers')
        .select('program_id')
        .where('program_id', '=', program.id)
        .where('teacher_user_id', '=', currentUser.id)
        .executeTakeFirst();
      if (!teaches && !(childClass && homeroom.includes(childClass.class_id))) {
        throw new ApplicationError(
          'ERR_FORBIDDEN',
          'Chỉ giáo viên chủ nhiệm của học sinh, giáo viên dạy chương trình hoặc Ban Giám hiệu duyệt đơn',
        );
      }
    }
    if (registration.status !== 'pending') {
      throw new ApplicationError('ERR_CONFLICT', 'Đơn không còn chờ duyệt');
    }
    if (!approve && (!reason || reason.length < 3)) {
      throw validationError([{ field: 'reason', message: 'Ghi lý do không duyệt' }]);
    }
    if (approve) {
      if (program.max_students) {
        const approved = await this.approvedChildIds(database, program.id);
        if (approved.length >= program.max_students) {
          throw new ApplicationError('ERR_CONFLICT', 'Chương trình đã đủ sĩ số');
        }
      }
      if (program.content_type === 'curriculum' && program.subject_id) {
        const upcoming = await database
          .selectFrom('tutoring_sessions')
          .select(['session_date', 'periods'])
          .where('program_id', '=', program.id)
          .where('status', '=', 'scheduled')
          .execute();
        const violations = await this.weeklyLimitViolations(
          database,
          program.subject_id,
          [registration.child_id],
          upcoming.map((session) => ({
            childId: registration.child_id,
            date: dateText(session.session_date),
            periods: session.periods,
          })),
          await this.ruleSet(database, this.today()),
        );
        if (violations.length > 0) {
          throw tutoringRuleError(violations.slice(0, 5));
        }
      }
    }
    const now = this.clock.now();
    const status = approve ? ('approved' as const) : ('rejected' as const);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('tutoring_registrations')
        .set({
          status,
          decided_by_name: currentUser.description.full_name,
          decided_at: now,
          reject_reason: approve ? null : reason,
        })
        .where('id', '=', registrationId)
        .execute();
      await queueNotification(transaction, {
        orgUnitId: await this.rootOrgUnit(transaction),
        templateCode: 'tutoring_registration_decided',
        title: approve ? `Đơn đăng ký ${program.name} đã được duyệt` : `Đơn đăng ký ${program.name} không được duyệt`,
        body: approve ? 'Xem lịch học ở mục Gia sư của con' : (reason ?? ''),
        targetType: 'tutoring_registrations',
        targetId: registrationId,
        recipients: [{ userId: registration.guardian_user_id, channel: 'in_app' }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'tutoring_registrations',
        entityId: registrationId,
        action: 'update',
        before: { status: 'pending' },
        after: { status, reason },
      });
    });
    return { status };
  }

  // Nhắn cha mẹ của học sinh trong chương trình: luôn qua luồng trao đổi giáo viên với cha mẹ của học sinh (không có luồng riêng với
  // học sinh); dùng lại `message_threads` của phân hệ trao đổi
  async messageGuardian(currentUser: CurrentUser, programId: string, body: Body, origin: ChangeOrigin) {
    const database = await this.database();
    await this.loadProgram(database, programId);
    await this.assertTeaches(database, currentUser, programId);
    const childId = text(body, 'child_id');
    const content = text(body, 'content');
    if (!UUID.test(childId) || content.length < 1 || content.length > 2000) {
      throw validationError([{ field: 'content', message: 'Chọn học sinh và ghi nội dung từ 1 đến 2000 ký tự' }]);
    }
    const registration = await database
      .selectFrom('tutoring_registrations')
      .innerJoin('children', 'children.id', 'tutoring_registrations.child_id')
      .select(['tutoring_registrations.guardian_user_id', 'children.org_unit_id', 'children.full_name'])
      .where('tutoring_registrations.program_id', '=', programId)
      .where('tutoring_registrations.child_id', '=', childId)
      .where('tutoring_registrations.status', 'in', ['pending', 'approved'])
      .executeTakeFirst();
    if (!registration) {
      throw notFoundError('Học sinh không đăng ký chương trình này', 'child');
    }
    const now = this.clock.now();
    return database.transaction().execute(async (transaction) => {
      const existing = await transaction
        .selectFrom('message_threads')
        .select('id')
        .where('child_id', '=', childId)
        .where('guardian_user_id', '=', registration.guardian_user_id)
        .executeTakeFirst();
      const thread =
        existing ??
        (await transaction
          .insertInto('message_threads')
          .values({
            org_unit_id: registration.org_unit_id,
            child_id: childId,
            guardian_user_id: registration.guardian_user_id,
            created_by: currentUser.id,
          })
          .returning('id')
          .executeTakeFirstOrThrow());
      const message = await transaction
        .insertInto('messages')
        .values({
          thread_id: thread.id,
          sender_user_id: currentUser.id,
          sender_side: 'staff',
          sender_name: currentUser.description.full_name,
          content,
          sent_at: now,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await transaction
        .updateTable('message_threads')
        .set({ last_message_at: now })
        .where('id', '=', thread.id)
        .execute();
      await queueNotification(transaction, {
        orgUnitId: registration.org_unit_id,
        templateCode: 'message_received',
        title: 'Tin nhắn từ nhà trường',
        body: content.length > 200 ? `${content.slice(0, 200)}…` : content,
        targetType: 'message_threads',
        targetId: thread.id,
        recipients: [{ userId: registration.guardian_user_id, channel: 'in_app' }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: registration.org_unit_id,
        entityName: 'messages',
        entityId: message.id,
        action: 'create',
        before: null,
        after: { thread_id: thread.id, sender_side: 'staff', tutoring_program_id: programId },
      });
      return { thread_id: thread.id };
    });
  }

  // ---------- Quyết định tăng thời lượng của Sở

  async listExemptions() {
    const database = await this.database();
    const rows = await database
      .selectFrom('tutoring_exemptions')
      .innerJoin('subjects', 'subjects.id', 'tutoring_exemptions.subject_id')
      .select([
        'tutoring_exemptions.id',
        'tutoring_exemptions.decision_no',
        'tutoring_exemptions.decision_date',
        'tutoring_exemptions.max_periods_per_week',
        'tutoring_exemptions.file_name',
        'tutoring_exemptions.note',
        'tutoring_exemptions.created_by_name',
        'subjects.name as subject_name',
      ])
      .orderBy('tutoring_exemptions.decision_date', 'desc')
      .execute();
    const children = rows.length
      ? await database
          .selectFrom('tutoring_exemption_children')
          .innerJoin('children', 'children.id', 'tutoring_exemption_children.child_id')
          .select(['tutoring_exemption_children.exemption_id', 'children.id', 'children.full_name'])
          .where(
            'tutoring_exemption_children.exemption_id',
            'in',
            rows.map((row) => row.id),
          )
          .execute()
      : [];
    return rows.map((row) => ({
      ...row,
      decision_date: dateText(row.decision_date),
      children: children
        .filter((child) => child.exemption_id === row.id)
        .map((child) => ({ id: child.id, full_name: child.full_name })),
    }));
  }

  async createExemption(
    currentUser: CurrentUser,
    body: Body,
    file: { fileName: string; body: Buffer; contentType: string } | null,
    origin: ChangeOrigin,
  ) {
    const database = await this.database();
    const errors: FieldError[] = [];
    const decisionNo = text(body, 'decision_no');
    if (decisionNo.length < 2 || decisionNo.length > 100) {
      errors.push({ field: 'decision_no', message: 'Ghi số quyết định' });
    }
    const decisionDate = text(body, 'decision_date');
    if (!DATE.test(decisionDate)) {
      errors.push({ field: 'decision_date', message: 'Ngày quyết định dạng yyyy-mm-dd' });
    }
    const subjectId = text(body, 'subject_id');
    if (!UUID.test(subjectId)) {
      errors.push({ field: 'subject_id', message: 'Chọn môn' });
    }
    const max = Number(body?.max_periods_per_week);
    if (!Number.isInteger(max) || max < 1 || max > 20) {
      errors.push({ field: 'max_periods_per_week', message: 'Số tiết tối đa mỗi tuần từ 1 đến 20' });
    }
    const rawChildren =
      typeof body?.child_ids === 'string'
        ? (body.child_ids as string)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : body?.child_ids;
    const childIds = idList({ child_ids: rawChildren }, 'child_ids', errors);
    if (childIds.length === 0) {
      errors.push({ field: 'child_ids', message: 'Chọn học sinh áp dụng quyết định' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const found = await database.selectFrom('children').select('id').where('id', 'in', childIds).execute();
    if (found.length !== childIds.length) {
      throw notFoundError('Có học sinh không tồn tại', 'child');
    }
    const id = randomUUID();
    let stored: { key: string; name: string } | null = null;
    if (file) {
      const safeName = file.fileName.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 120) || 'quyet-dinh';
      stored = {
        key: storageKey(
          'tutoring-exemptions',
          id,
          `${createHash('sha256').update(file.body).digest('hex').slice(0, 12)}-${safeName}`,
        ),
        name: safeName,
      };
      await this.fileStorage.put(stored.key, file.body, file.contentType || 'application/octet-stream');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('tutoring_exemptions')
        .values({
          id,
          decision_no: decisionNo,
          decision_date: decisionDate,
          subject_id: subjectId,
          max_periods_per_week: max,
          file_key: stored?.key ?? null,
          file_name: stored?.name ?? null,
          note: optionalText(body, 'note', 1000),
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })
        .execute();
      await transaction
        .insertInto('tutoring_exemption_children')
        .values(childIds.map((childId) => ({ exemption_id: id, child_id: childId })))
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'tutoring_exemptions',
        entityId: id,
        action: 'create',
        before: null,
        after: {
          decision_no: decisionNo,
          decision_date: decisionDate,
          subject_id: subjectId,
          max_periods_per_week: max,
          child_ids: childIds,
        },
      });
    });
    return { id };
  }

  async exemptionFile(id: string) {
    const database = await this.database();
    if (!UUID.test(id)) {
      throw notFoundError('Không tìm thấy quyết định', 'exemption');
    }
    const row = await database
      .selectFrom('tutoring_exemptions')
      .select(['file_key', 'file_name'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row?.file_key) {
      throw notFoundError('Quyết định không có tệp', 'exemption');
    }
    return { name: row.file_name ?? 'quyet-dinh', body: await this.fileStorage.get(row.file_key) };
  }

  // ---------- Phía cha mẹ (ứng dụng phụ huynh)

  private async assertGuardian(database: Executor, currentUser: CurrentUser, childId: string) {
    if (!UUID.test(childId)) {
      throw notFoundError('Không tìm thấy học sinh', 'child');
    }
    const guardian = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.full_name')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!guardian) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ cha mẹ, người giám hộ của học sinh làm được việc này');
    }
    return guardian;
  }

  // Chương trình đã duyệt, còn hạn mà con thuộc lớp đối tượng (hoặc danh sách học sinh của chương trình)
  private async eligiblePrograms(database: Executor, childId: string, today: string) {
    const enrollment = await database
      .selectFrom('class_enrollments')
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['classes.id as class_id', 'classes.school_level'])
      .where('class_enrollments.child_id', '=', childId)
      .where('class_enrollments.is_current', '=', true)
      .executeTakeFirst();
    const programs = await database
      .selectFrom('tutoring_programs')
      .leftJoin('subjects', 'subjects.id', 'tutoring_programs.subject_id')
      .select([
        'tutoring_programs.id',
        'tutoring_programs.name',
        'tutoring_programs.school_level',
        'tutoring_programs.content_type',
        'tutoring_programs.audience',
        'tutoring_programs.charges_fee',
        'tutoring_programs.fee_basis',
        'tutoring_programs.fee_amount',
        'tutoring_programs.delivery',
        'tutoring_programs.description',
        'tutoring_programs.registration_form',
        'tutoring_programs.starts_on',
        'tutoring_programs.ends_on',
        'subjects.name as subject_name',
      ])
      .where('tutoring_programs.status', '=', 'approved')
      .where('tutoring_programs.ends_on', '>=', today)
      .execute();
    if (programs.length === 0) {
      return [];
    }
    const ids = programs.map((program) => program.id);
    const [classes, candidates] = await Promise.all([
      database
        .selectFrom('tutoring_program_classes')
        .select(['program_id', 'class_id'])
        .where('program_id', 'in', ids)
        .execute(),
      database
        .selectFrom('tutoring_program_candidates')
        .select(['program_id', 'child_id'])
        .where('program_id', 'in', ids)
        .execute(),
    ]);
    return programs.filter((program) => {
      const programCandidates = candidates.filter((row) => row.program_id === program.id);
      if (programCandidates.length > 0) {
        return programCandidates.some((row) => row.child_id === childId);
      }
      const programClasses = classes.filter((row) => row.program_id === program.id);
      if (programClasses.length > 0) {
        return Boolean(enrollment) && programClasses.some((row) => row.class_id === enrollment?.class_id);
      }
      return enrollment?.school_level === program.school_level;
    });
  }

  async childOverview(currentUser: CurrentUser, childId: string) {
    const database = await this.database();
    await this.assertGuardian(database, currentUser, childId);
    const today = this.today();
    const [programs, registrations] = await Promise.all([
      this.eligiblePrograms(database, childId, today),
      database
        .selectFrom('tutoring_registrations')
        .innerJoin('tutoring_programs', 'tutoring_programs.id', 'tutoring_registrations.program_id')
        .select([
          'tutoring_registrations.id',
          'tutoring_registrations.program_id',
          'tutoring_programs.name as program_name',
          'tutoring_registrations.status',
          'tutoring_registrations.submitted_at',
          'tutoring_registrations.reject_reason',
        ])
        .where('tutoring_registrations.child_id', '=', childId)
        .orderBy('tutoring_registrations.submitted_at', 'desc')
        .execute(),
    ]);
    const approvedPrograms = registrations.filter((row) => row.status === 'approved').map((row) => row.program_id);
    const sessions = approvedPrograms.length
      ? await database
          .selectFrom('tutoring_sessions')
          .innerJoin('tutoring_programs', 'tutoring_programs.id', 'tutoring_sessions.program_id')
          .leftJoin('tutoring_attendance', (join) =>
            join
              .onRef('tutoring_attendance.session_id', '=', 'tutoring_sessions.id')
              .on('tutoring_attendance.child_id', '=', childId),
          )
          .select([
            'tutoring_sessions.id',
            'tutoring_programs.name as program_name',
            'tutoring_sessions.session_date',
            'tutoring_sessions.start_time',
            'tutoring_sessions.end_time',
            'tutoring_sessions.location',
            'tutoring_sessions.status',
            'tutoring_sessions.cancel_reason',
            'tutoring_attendance.status as attendance',
            'tutoring_attendance.confirmed_at',
          ])
          .where('tutoring_sessions.program_id', 'in', approvedPrograms)
          .orderBy('tutoring_sessions.session_date')
          .orderBy('tutoring_sessions.start_time')
          .limit(100)
          .execute()
      : [];
    const active = new Set(
      registrations.filter((row) => row.status === 'pending' || row.status === 'approved').map((row) => row.program_id),
    );
    return {
      programs: programs.map((program) => ({
        ...program,
        starts_on: dateText(program.starts_on),
        ends_on: dateText(program.ends_on),
        registered: active.has(program.id),
      })),
      registrations,
      sessions: sessions.map((session) => ({
        ...session,
        session_date: dateText(session.session_date),
        attendance: session.confirmed_at ? session.attendance : null,
      })),
    };
  }

  async register(currentUser: CurrentUser, childId: string, body: Body, origin: ChangeOrigin) {
    const database = await this.database();
    const guardian = await this.assertGuardian(database, currentUser, childId);
    const programId = text(body, 'program_id');
    if (body?.agree !== true) {
      throw validationError([{ field: 'agree', message: 'Cha mẹ cần đọc và xác nhận nội dung đơn đăng ký' }]);
    }
    const programs = await this.eligiblePrograms(database, childId, this.today());
    const program = programs.find((item) => item.id === programId);
    if (!program) {
      throw notFoundError('Chương trình không mở cho học sinh này', 'program');
    }
    const formText = program.registration_form;
    try {
      return await database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('tutoring_registrations')
          .values({
            program_id: programId,
            child_id: childId,
            guardian_user_id: currentUser.id,
            guardian_name: guardian.full_name,
            form_text: formText,
            form_hash: createHash('sha256').update(formText).digest('hex'),
            note: optionalText(body, 'note', 1000),
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'tutoring_registrations',
          entityId: created.id,
          action: 'create',
          before: null,
          after: { program_id: programId, child_id: childId },
        });
        return { id: created.id, status: 'pending' };
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code?: string }).code === '23505') {
        throw new ApplicationError('ERR_CONFLICT', 'Học sinh đã có đơn đăng ký chương trình này');
      }
      throw error;
    }
  }

  async withdraw(currentUser: CurrentUser, childId: string, registrationId: string, origin: ChangeOrigin) {
    const database = await this.database();
    await this.assertGuardian(database, currentUser, childId);
    if (!UUID.test(registrationId)) {
      throw notFoundError('Không tìm thấy đơn', 'registration');
    }
    const registration = await database
      .selectFrom('tutoring_registrations')
      .select(['id', 'status'])
      .where('id', '=', registrationId)
      .where('child_id', '=', childId)
      .executeTakeFirst();
    if (!registration) {
      throw notFoundError('Không tìm thấy đơn', 'registration');
    }
    if (registration.status !== 'pending' && registration.status !== 'approved') {
      throw new ApplicationError('ERR_CONFLICT', 'Đơn đã kết thúc');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('tutoring_registrations')
        .set({ status: 'withdrawn', withdrawn_at: this.clock.now() })
        .where('id', '=', registrationId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'tutoring_registrations',
        entityId: registrationId,
        action: 'update',
        before: { status: registration.status },
        after: { status: 'withdrawn' },
      });
    });
    return { status: 'withdrawn' };
  }

  // Ngày áp dụng cho kiểm thử: ngày hiện tại của máy chủ
  hasTeachPermission(currentUser: CurrentUser): boolean {
    return currentUser.hasPermission(TEACH) || currentUser.hasPermission(MANAGE);
  }
}
