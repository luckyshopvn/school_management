import { Injectable } from '@nestjs/common';
import type {
  CompetencyTerm,
  SchoolYearDatabase,
  TrainingMode,
  TrainingOrganizerKind,
  TrainingResult,
} from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { CERTIFICATE_EXPIRY_WARNING_DAYS, PERMISSION_CODES } from '@school-management/shared';
import type { Kysely } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import {
  isUuid,
  notFoundError,
  readInteger,
  readOptionalText,
  readRequiredText,
  type RequestBody,
} from '../common/request-fields.js';
import { PDF_TYPE } from '../kpi/kpi-documents.js';
import { verificationCode } from '../outgoing-documents/outgoing-documents.js';
import { trainingCertificatesPdf, type TrainingCertificateContent } from './training-documents.js';

// Hồ sơ bồi dưỡng giáo viên (DT-22 phần 22e, YCTD-182). Chỉ phần quản trị: ghi nhận, theo dõi, cấp chứng nhận; không làm lớp
// học trực tuyến, khoá học điện tử, bài thi trực tuyến. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - Khoá do trường tổ chức hoặc ghi nhận khoá của cấp trên, đơn vị ngoài; giáo viên đăng ký khi khoá đang mở, chưa quá hạn,
//   còn chỉ tiêu; tổ trưởng duyệt cấp tổ (tùy chọn, chỉ giáo viên trong tổ mình), Ban Giám hiệu duyệt hoặc không duyệt.
// - Kết quả ghi cho đăng ký đã duyệt: số buổi có mặt, đạt hoặc không đạt, số tiết được ghi nhận (đạt mà để trống thì bằng số
//   tiết của khoá, không đạt thì 0), nhận xét.
// - Khoá trường tổ chức có cấp chứng nhận: người đạt nhận chứng nhận ở `staff_certificates` (loại "school") có mã tra cứu 12
//   ký tự như văn bản đi, giấy khen; thu hồi có lý do; cấp lại là thu hồi bản cũ, cấp bản mới mã mới. Trang tra cứu công
//   khai chỉ trả tên người, khoá, ngày cấp, trạng thái.
// - Giáo viên tự nhập chứng chỉ từ nơi khác (loại "manual") vào cùng bảng; số tiết của chứng chỉ nhập tay có ngày cấp trong
//   năm học được cộng vào tổng số tiết so với định mức năm (danh mục hệ thống).
// - Năng lực số: giáo viên tự đánh giá mỗi miền một mức theo kỳ; tổ trưởng (tổ mình) hoặc Ban Giám hiệu xác nhận, đổi mức thì
//   phải có lý do; xác nhận rồi giáo viên không sửa. Miền có mức (đã xác nhận, nếu chưa thì tự đánh giá) dưới ngưỡng của danh
//   mục thì gợi ý chuyên đề gắn miền đó, theo quy tắc, không dùng AI
export const TRAINING_RULE_CODE = 'YCTD-182';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ORGANIZERS: TrainingOrganizerKind[] = ['school', 'external'];
const MODES: TrainingMode[] = ['in_person', 'online', 'self_study'];
export const COMPETENCY_TERMS: CompetencyTerm[] = ['term_1', 'term_2', 'year'];
const DAY = 86_400_000;

type Executor = Kysely<SchoolYearDatabase>;

export interface TrainingCourseInput {
  name: string;
  topic_id: string | null;
  organizer_kind: TrainingOrganizerKind;
  organizer_name: string | null;
  mode: TrainingMode;
  location: string | null;
  start_date: string;
  end_date: string;
  periods: number;
  sessions: number;
  quota: number | null;
  registration_deadline: string | null;
  issues_certificate: boolean;
  note: string | null;
}

export interface TrainingResultInput {
  registration_id: string;
  attended_sessions: number | null;
  result: TrainingResult | null;
  credited_periods: number | null;
  comment: string | null;
}

export function isDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

function readDate(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập ngày' });
    }
    return null;
  }
  if (!isDate(value)) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return null;
  }
  return value;
}

function limitText(value: string | null | undefined, field: string, maximum: number, errors: FieldError[]) {
  if (value && value.length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
  }
  return value ?? null;
}

export function parseTrainingCourse(body: RequestBody): TrainingCourseInput {
  const errors: FieldError[] = [];
  const name = limitText(readRequiredText(body, 'name', errors), 'name', 300, errors) ?? '';
  const topic = body?.topic_id === undefined || body.topic_id === null || body.topic_id === '' ? null : body.topic_id;
  if (topic !== null && !isUuid(topic)) {
    errors.push({ field: 'topic_id', message: 'Chuyên đề không hợp lệ' });
  }
  const organizer = body?.organizer_kind as TrainingOrganizerKind;
  if (!ORGANIZERS.includes(organizer)) {
    errors.push({ field: 'organizer_kind', message: 'Đơn vị tổ chức là school hoặc external' });
  }
  const mode = (body?.mode ?? 'in_person') as TrainingMode;
  if (!MODES.includes(mode)) {
    errors.push({ field: 'mode', message: 'Hình thức là in_person, online hoặc self_study' });
  }
  const start = readDate(body, 'start_date', errors, true);
  const end = readDate(body, 'end_date', errors, true);
  if (start && end && end < start) {
    errors.push({ field: 'end_date', message: 'Ngày kết thúc không trước ngày bắt đầu' });
  }
  const deadline = readDate(body, 'registration_deadline', errors, false);
  const periods = readInteger(body, 'periods', errors, { min: 1, max: 1000 });
  if (periods === undefined && body?.periods === undefined) {
    errors.push({ field: 'periods', message: 'Bắt buộc nhập số tiết' });
  }
  const sessions = readInteger(body, 'sessions', errors, { min: 1, max: 200 }) ?? 1;
  const quota =
    body?.quota === null || body?.quota === ''
      ? null
      : (readInteger(body, 'quota', errors, { min: 1, max: 10000 }) ?? null);
  const issues = body?.issues_certificate === true;
  if (issues && organizer === 'external') {
    errors.push({ field: 'issues_certificate', message: 'Chỉ khoá trường tổ chức mới cấp chứng nhận của trường' });
  }
  const input: TrainingCourseInput = {
    name,
    topic_id: topic as string | null,
    organizer_kind: organizer,
    organizer_name: limitText(readOptionalText(body, 'organizer_name', errors), 'organizer_name', 300, errors),
    mode,
    location: limitText(readOptionalText(body, 'location', errors), 'location', 300, errors),
    start_date: start ?? '',
    end_date: end ?? '',
    periods: periods ?? 1,
    sessions,
    quota,
    registration_deadline: deadline,
    issues_certificate: issues,
    note: limitText(readOptionalText(body, 'note', errors), 'note', 2000, errors),
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

export function parseTrainingResults(body: RequestBody): TrainingResultInput[] {
  const errors: FieldError[] = [];
  const rows = body?.results;
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 1000) {
    throw validationError([{ field: 'results', message: 'Danh sách kết quả từ 1 đến 1000 dòng' }]);
  }
  const seen = new Set<string>();
  const parsed = rows.map((value, index) => {
    const row = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    if (!isUuid(row.registration_id) || seen.has(row.registration_id)) {
      errors.push({ field: `results[${index}].registration_id`, message: 'Đăng ký không hợp lệ hoặc bị trùng' });
    }
    seen.add(row.registration_id as string);
    const result = row.result === undefined || row.result === null || row.result === '' ? null : row.result;
    if (result !== null && result !== 'passed' && result !== 'failed') {
      errors.push({ field: `results[${index}].result`, message: 'Kết quả là passed hoặc failed' });
    }
    const integer = (field: string, maximum: number) => {
      const raw = row[field];
      if (raw === undefined || raw === null || raw === '') {
        return null;
      }
      if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > maximum) {
        errors.push({ field: `results[${index}].${field}`, message: `Số nguyên từ 0 đến ${maximum}` });
        return null;
      }
      return raw;
    };
    const comment = typeof row.comment === 'string' && row.comment.trim() !== '' ? row.comment.trim() : null;
    if (comment && comment.length > 1000) {
      errors.push({ field: `results[${index}].comment`, message: 'Tối đa 1000 ký tự' });
    }
    return {
      registration_id: row.registration_id as string,
      attended_sessions: integer('attended_sessions', 200),
      result: result as TrainingResult | null,
      credited_periods: integer('credited_periods', 1000),
      comment,
    };
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return parsed;
}

// Mức hiệu lực của một miền: mức đã xác nhận, chưa xác nhận thì mức tự đánh giá
export function effectiveLevel(score: { self_level: number; confirmed_level: number | null }): number {
  return score.confirmed_level ?? score.self_level;
}

// Khoảng trống năng lực theo quy tắc: miền có mức dưới ngưỡng thì gợi ý các chuyên đề đang dùng gắn miền đó
export function competencyGaps<T extends { competency_domain_code: string | null }>(
  scores: Array<{ domain_code: string; domain_name: string; self_level: number; confirmed_level: number | null }>,
  threshold: number,
  topics: T[],
): Array<{ domain_code: string; domain_name: string; level: number; topics: T[] }> {
  return scores
    .filter((score) => effectiveLevel(score) < threshold)
    .map((score) => ({
      domain_code: score.domain_code,
      domain_name: score.domain_name,
      level: effectiveLevel(score),
      topics: topics.filter((topic) => topic.competency_domain_code === score.domain_code),
    }));
}

// Số tiết được ghi nhận: kết quả đạt mà để trống thì bằng số tiết của khoá; không đạt thì 0; chưa có kết quả thì trống
export function creditedPeriods(
  result: TrainingResult | null,
  given: number | null,
  coursePeriods: number,
): number | null {
  if (result === 'passed') {
    return given ?? coursePeriods;
  }
  if (result === 'failed') {
    return 0;
  }
  return given;
}

interface TrainingContext {
  database: Executor;
  staff: { id: string; full_name: string; department_id: string | null; org_unit_id: string } | null;
  canManage: boolean;
  canReview: boolean;
}

@Injectable()
export class TrainingService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  async context(currentUser: CurrentUser): Promise<TrainingContext> {
    const { database } = await this.currentSchoolYear.require();
    const staff =
      (await database
        .selectFrom('staff')
        .select(['id', 'full_name', 'department_id', 'org_unit_id'])
        .where('user_id', '=', currentUser.id)
        .where('status', '=', 'active')
        .executeTakeFirst()) ?? null;
    return {
      database,
      staff,
      canManage: currentUser.hasPermission(PERMISSION_CODES.trainingManage),
      canReview: currentUser.hasPermission(PERMISSION_CODES.trainingReview),
    };
  }

  private assertManage(context: TrainingContext) {
    if (!context.canManage) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu quản lý bồi dưỡng được thao tác');
    }
  }

  private requireStaff(context: TrainingContext) {
    if (!context.staff) {
      throw ruleViolationError(TRAINING_RULE_CODE, 'Tài khoản chưa gắn hồ sơ cán bộ, giáo viên đang làm việc');
    }
    return context.staff;
  }

  // Tổ trưởng chỉ thấy, duyệt giáo viên trong tổ mình
  private leadsDepartment(context: TrainingContext, departmentId: string | null): boolean {
    return context.canReview && departmentId !== null && departmentId === context.staff?.department_id;
  }

  // ---- Danh mục (cơ sở dữ liệu hệ thống) ----

  async catalog() {
    const system = this.databases.system;
    const [settings, topics, domains, levels] = await Promise.all([
      system.selectFrom('training_settings').selectAll().where('id', '=', 1).executeTakeFirst(),
      system.selectFrom('training_topics').selectAll().orderBy('order_no').orderBy('code').execute(),
      system.selectFrom('digital_competency_domains').selectAll().orderBy('order_no').orderBy('code').execute(),
      system.selectFrom('digital_competency_levels').selectAll().orderBy('level_no').execute(),
    ]);
    return {
      settings: settings ?? {
        id: 1,
        annual_required_periods: 120,
        competency_gap_level: 2,
        certificate_issuer: null,
        legal_basis: null,
      },
      topics,
      domains,
      levels,
    };
  }

  async updateSettings(currentUser: CurrentUser, body: RequestBody) {
    if (!currentUser.hasPermission(PERMISSION_CODES.trainingManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu sửa danh mục bồi dưỡng');
    }
    const errors: FieldError[] = [];
    const periods = readInteger(body, 'annual_required_periods', errors, { min: 0, max: 1000 });
    const gap = readInteger(body, 'competency_gap_level', errors, { min: 1, max: 10 });
    const issuer = limitText(readOptionalText(body, 'certificate_issuer', errors), 'certificate_issuer', 300, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.databases.system
      .insertInto('training_settings')
      .values({
        id: 1,
        annual_required_periods: periods ?? 120,
        competency_gap_level: gap ?? 2,
        certificate_issuer: issuer,
        updated_by: currentUser.id,
      })
      .onConflict((conflict) =>
        conflict.column('id').doUpdateSet({
          ...(periods !== undefined ? { annual_required_periods: periods } : {}),
          ...(gap !== undefined ? { competency_gap_level: gap } : {}),
          ...(body?.certificate_issuer !== undefined ? { certificate_issuer: issuer } : {}),
          updated_at: this.clock.now(),
          updated_by: currentUser.id,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async saveTopic(currentUser: CurrentUser, id: string | null, body: RequestBody) {
    if (!currentUser.hasPermission(PERMISSION_CODES.trainingManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu sửa danh mục bồi dưỡng');
    }
    const errors: FieldError[] = [];
    const code = readOptionalText(body, 'code', errors);
    if (id === null && (!code || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/.test(code))) {
      errors.push({ field: 'code', message: 'Mã gồm chữ, số, gạch, tối đa 50 ký tự' });
    }
    const name = limitText(readOptionalText(body, 'name', errors), 'name', 300, errors);
    if (id === null && !name) {
      errors.push({ field: 'name', message: 'Bắt buộc nhập' });
    }
    const program = readInteger(body, 'program_no', errors, { min: 1, max: 3 });
    if (id === null && program === undefined) {
      errors.push({ field: 'program_no', message: 'Chương trình 1, 2 hoặc 3' });
    }
    const periods = readInteger(body, 'default_periods', errors, { min: 0, max: 1000 });
    const domain = readOptionalText(body, 'competency_domain_code', errors);
    const status = body?.status;
    if (status !== undefined && status !== 'active' && status !== 'inactive') {
      errors.push({ field: 'status', message: 'Trạng thái là active hoặc inactive' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const values = {
      ...(name ? { name } : {}),
      ...(program !== undefined ? { program_no: program } : {}),
      ...(periods !== undefined ? { default_periods: periods } : {}),
      ...(domain !== undefined ? { competency_domain_code: domain } : {}),
      ...(status !== undefined ? { status: status as 'active' | 'inactive' } : {}),
    };
    if (id === null) {
      const duplicate = await this.databases.system
        .selectFrom('training_topics')
        .select('id')
        .where('code', '=', code as string)
        .executeTakeFirst();
      if (duplicate) {
        throw new ApplicationError('ERR_CONFLICT', 'Mã chuyên đề đã có');
      }
      return this.databases.system
        .insertInto('training_topics')
        .values({ code: code as string, name: name as string, program_no: program as number, ...values })
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    const updated = await this.databases.system
      .updateTable('training_topics')
      .set(values)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!updated) {
      throw notFoundError('Không tìm thấy chuyên đề', 'training_topic');
    }
    return updated;
  }

  async saveDomain(currentUser: CurrentUser, id: string | null, body: RequestBody) {
    if (!currentUser.hasPermission(PERMISSION_CODES.trainingManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu sửa danh mục bồi dưỡng');
    }
    const errors: FieldError[] = [];
    const code = readOptionalText(body, 'code', errors);
    if (id === null && (!code || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/.test(code))) {
      errors.push({ field: 'code', message: 'Mã gồm chữ, số, gạch, tối đa 50 ký tự' });
    }
    const name = limitText(readOptionalText(body, 'name', errors), 'name', 200, errors);
    if (id === null && !name) {
      errors.push({ field: 'name', message: 'Bắt buộc nhập' });
    }
    const description = limitText(readOptionalText(body, 'description', errors), 'description', 1000, errors);
    const order = readInteger(body, 'order_no', errors, { min: 0, max: 1000 });
    const status = body?.status;
    if (status !== undefined && status !== 'active' && status !== 'inactive') {
      errors.push({ field: 'status', message: 'Trạng thái là active hoặc inactive' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const values = {
      ...(name ? { name } : {}),
      ...(body?.description !== undefined ? { description } : {}),
      ...(order !== undefined ? { order_no: order } : {}),
      ...(status !== undefined ? { status: status as 'active' | 'inactive' } : {}),
    };
    if (id === null) {
      const duplicate = await this.databases.system
        .selectFrom('digital_competency_domains')
        .select('id')
        .where('code', '=', code as string)
        .executeTakeFirst();
      if (duplicate) {
        throw new ApplicationError('ERR_CONFLICT', 'Mã miền năng lực đã có');
      }
      return this.databases.system
        .insertInto('digital_competency_domains')
        .values({ code: code as string, name: name as string, ...values })
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    const updated = await this.databases.system
      .updateTable('digital_competency_domains')
      .set(values)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!updated) {
      throw notFoundError('Không tìm thấy miền năng lực', 'digital_competency_domain');
    }
    return updated;
  }

  // ---- Khoá bồi dưỡng ----

  async courses(currentUser: CurrentUser, status: string | null) {
    const context = await this.context(currentUser);
    let query = context.database
      .selectFrom('training_courses')
      .selectAll('training_courses')
      .select((expression) => [
        expression
          .selectFrom('training_registrations')
          .select(expression.fn.countAll<string>().as('count'))
          .whereRef('training_registrations.course_id', '=', 'training_courses.id')
          .where('training_registrations.status', 'in', ['pending', 'team_approved', 'approved'])
          .as('registered'),
        expression
          .selectFrom('training_registrations')
          .select(expression.fn.countAll<string>().as('count'))
          .whereRef('training_registrations.course_id', '=', 'training_courses.id')
          .where('training_registrations.status', '=', 'approved')
          .as('approved'),
      ]);
    if (status === 'open' || status === 'closed' || status === 'completed') {
      query = query.where('training_courses.status', '=', status);
    }
    const rows = await query.orderBy('training_courses.start_date', 'desc').orderBy('training_courses.name').execute();
    const mine = context.staff
      ? await context.database
          .selectFrom('training_registrations')
          .select(['id', 'course_id', 'status', 'result'])
          .where('staff_id', '=', context.staff.id)
          .execute()
      : [];
    return rows.map((row) => ({
      ...row,
      registered: Number(row.registered ?? 0),
      approved: Number(row.approved ?? 0),
      my_registration: mine.find((registration) => registration.course_id === row.id) ?? null,
    }));
  }

  private async topicOf(topicId: string | null) {
    if (!topicId) {
      return null;
    }
    const topic = await this.databases.system
      .selectFrom('training_topics')
      .select(['id', 'name', 'program_no', 'competency_domain_code'])
      .where('id', '=', topicId)
      .executeTakeFirst();
    if (!topic) {
      throw validationError([{ field: 'topic_id', message: 'Chuyên đề không có trong danh mục' }]);
    }
    return topic;
  }

  private async rootUnit(database: Executor): Promise<{ id: string; name: string }> {
    const root = await database
      .selectFrom('org_units')
      .select(['id', 'name'])
      .where('parent_id', 'is', null)
      .orderBy('created_at')
      .executeTakeFirstOrThrow();
    return root;
  }

  async createCourse(currentUser: CurrentUser, input: TrainingCourseInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    const topic = await this.topicOf(input.topic_id);
    const root = await this.rootUnit(context.database);
    const course = await context.database
      .insertInto('training_courses')
      .values({
        ...input,
        org_unit_id: context.staff?.org_unit_id ?? root.id,
        topic_name: topic?.name ?? null,
        program_no: topic?.program_no ?? null,
        competency_domain_code: topic?.competency_domain_code ?? null,
        created_by: currentUser.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAuditLog(context.database, {
      origin,
      orgUnitId: course.org_unit_id,
      entityName: 'training_courses',
      entityId: course.id,
      action: 'create',
      before: null,
      after: course,
    });
    return course;
  }

  private async findCourse(database: Executor, id: string) {
    const course = await database.selectFrom('training_courses').selectAll().where('id', '=', id).executeTakeFirst();
    if (!course) {
      throw notFoundError('Không tìm thấy khoá bồi dưỡng', 'training_course');
    }
    return course;
  }

  async updateCourse(currentUser: CurrentUser, id: string, body: RequestBody, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    const before = await this.findCourse(context.database, id);
    const status = body?.status;
    let values: Record<string, unknown>;
    if (status !== undefined && Object.keys(body ?? {}).length === 1) {
      if (status !== 'open' && status !== 'closed' && status !== 'completed') {
        throw validationError([{ field: 'status', message: 'Trạng thái là open, closed hoặc completed' }]);
      }
      values = { status };
    } else {
      const input = parseTrainingCourse(body);
      const topic = await this.topicOf(input.topic_id);
      values = {
        ...input,
        topic_name: topic?.name ?? null,
        program_no: topic?.program_no ?? null,
        competency_domain_code: topic?.competency_domain_code ?? null,
      };
    }
    const course = await context.database
      .updateTable('training_courses')
      .set({ ...values, updated_at: this.clock.now() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAuditLog(context.database, {
      origin,
      orgUnitId: course.org_unit_id,
      entityName: 'training_courses',
      entityId: id,
      action: 'update',
      before,
      after: course,
    });
    return course;
  }

  // Một khoá kèm đăng ký: Ban Giám hiệu thấy mọi đăng ký, tổ trưởng thấy của tổ mình, giáo viên thấy của mình
  async course(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const course = await this.findCourse(context.database, id);
    let query = context.database
      .selectFrom('training_registrations')
      .leftJoin('departments', 'departments.id', 'training_registrations.department_id')
      .selectAll('training_registrations')
      .select('departments.name as department_name')
      .where('training_registrations.course_id', '=', id);
    if (!context.canManage) {
      const own = context.staff?.id ?? '00000000-0000-0000-0000-000000000000';
      const department = context.canReview ? (context.staff?.department_id ?? null) : null;
      query = query.where((expression) =>
        department
          ? expression.or([
              expression('training_registrations.staff_id', '=', own),
              expression('training_registrations.department_id', '=', department),
            ])
          : expression('training_registrations.staff_id', '=', own),
      );
    }
    const registrations = await query.orderBy('training_registrations.staff_name').execute();
    const certificates = await context.database
      .selectFrom('staff_certificates')
      .select(['id', 'registration_id', 'lookup_code', 'issued_date', 'revoked_at'])
      .where('course_id', '=', id)
      .where('revoked_at', 'is', null)
      .execute();
    return {
      course,
      can_manage: context.canManage,
      registrations: registrations.map((registration) => ({
        ...registration,
        certificate: certificates.find((certificate) => certificate.registration_id === registration.id) ?? null,
        can_team_review:
          !context.canManage &&
          registration.status === 'pending' &&
          this.leadsDepartment(context, registration.department_id),
      })),
    };
  }

  // ---- Đăng ký ----

  async register(currentUser: CurrentUser, courseId: string, note: string | null, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    const staff = this.requireStaff(context);
    const course = await this.findCourse(context.database, courseId);
    if (course.status !== 'open') {
      throw ruleViolationError(TRAINING_RULE_CODE, 'Khoá không còn mở đăng ký');
    }
    if (course.registration_deadline && course.registration_deadline < this.today()) {
      throw ruleViolationError(TRAINING_RULE_CODE, 'Đã quá hạn đăng ký');
    }
    const existing = await context.database
      .selectFrom('training_registrations')
      .selectAll()
      .where('course_id', '=', courseId)
      .where('staff_id', '=', staff.id)
      .executeTakeFirst();
    if (existing && existing.status !== 'cancelled' && existing.status !== 'rejected') {
      throw new ApplicationError('ERR_CONFLICT', 'Bạn đã đăng ký khoá này');
    }
    if (course.quota !== null) {
      const taken = await context.database
        .selectFrom('training_registrations')
        .select((expression) => expression.fn.countAll<string>().as('count'))
        .where('course_id', '=', courseId)
        .where('status', 'in', ['pending', 'team_approved', 'approved'])
        .executeTakeFirstOrThrow();
      if (Number(taken.count) >= course.quota) {
        throw ruleViolationError(TRAINING_RULE_CODE, 'Khoá đã đủ chỉ tiêu');
      }
    }
    const values = {
      status: 'pending' as const,
      note,
      staff_name: staff.full_name,
      department_id: staff.department_id,
      team_reviewed_by_name: null,
      team_reviewed_at: null,
      reviewed_by_name: null,
      reviewed_at: null,
      review_note: null,
      updated_at: this.clock.now(),
    };
    const registration = existing
      ? await context.database
          .updateTable('training_registrations')
          .set(values)
          .where('id', '=', existing.id)
          .returningAll()
          .executeTakeFirstOrThrow()
      : await context.database
          .insertInto('training_registrations')
          .values({ ...values, course_id: courseId, staff_id: staff.id })
          .returningAll()
          .executeTakeFirstOrThrow();
    await writeAuditLog(context.database, {
      origin,
      orgUnitId: course.org_unit_id,
      entityName: 'training_registrations',
      entityId: registration.id,
      action: existing ? 'update' : 'create',
      before: existing ?? null,
      after: registration,
    });
    return registration;
  }

  private async findRegistration(database: Executor, id: string) {
    const registration = await database
      .selectFrom('training_registrations')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!registration) {
      throw notFoundError('Không tìm thấy đăng ký', 'training_registration');
    }
    return registration;
  }

  async cancel(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    const registration = await this.findRegistration(context.database, id);
    if (registration.staff_id !== context.staff?.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người đăng ký huỷ được đăng ký của mình');
    }
    if (registration.status !== 'pending' && registration.status !== 'team_approved') {
      throw ruleViolationError(TRAINING_RULE_CODE, 'Chỉ huỷ được đăng ký đang chờ duyệt');
    }
    const updated = await context.database
      .updateTable('training_registrations')
      .set({ status: 'cancelled', updated_at: this.clock.now() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAuditLog(context.database, {
      origin,
      orgUnitId: context.staff?.org_unit_id ?? (await this.rootUnit(context.database)).id,
      entityName: 'training_registrations',
      entityId: id,
      action: 'update',
      before: registration,
      after: updated,
    });
    return updated;
  }

  // Duyệt: tổ trưởng chuyển "chờ duyệt" sang "tổ đã duyệt" hoặc không duyệt; Ban Giám hiệu duyệt hoặc không duyệt đăng ký
  // đang chờ (có hoặc không qua tổ)
  async review(
    currentUser: CurrentUser,
    id: string,
    decision: 'approve' | 'reject',
    note: string | null,
    origin: ChangeOrigin,
  ) {
    const context = await this.context(currentUser);
    const registration = await this.findRegistration(context.database, id);
    const name = context.staff?.full_name ?? currentUser.description.full_name;
    const now = this.clock.now();
    let values: Record<string, unknown>;
    if (context.canManage) {
      if (registration.status !== 'pending' && registration.status !== 'team_approved') {
        throw ruleViolationError(TRAINING_RULE_CODE, 'Đăng ký không ở trạng thái chờ duyệt');
      }
      values = {
        status: decision === 'approve' ? 'approved' : 'rejected',
        reviewed_by_name: name,
        reviewed_at: now,
        review_note: note,
      };
    } else if (this.leadsDepartment(context, registration.department_id)) {
      if (registration.status !== 'pending') {
        throw ruleViolationError(TRAINING_RULE_CODE, 'Tổ chỉ duyệt đăng ký đang chờ duyệt');
      }
      values = {
        status: decision === 'approve' ? 'team_approved' : 'rejected',
        team_reviewed_by_name: name,
        team_reviewed_at: now,
        review_note: note,
      };
    } else {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ tổ trưởng của tổ hoặc Ban Giám hiệu duyệt đăng ký');
    }
    const updated = await context.database
      .updateTable('training_registrations')
      .set({ ...values, updated_at: now })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    const course = await this.findCourse(context.database, registration.course_id);
    await writeAuditLog(context.database, {
      origin,
      orgUnitId: course.org_unit_id,
      entityName: 'training_registrations',
      entityId: id,
      action: 'update',
      before: registration,
      after: updated,
    });
    return updated;
  }

  // ---- Kết quả, chứng nhận ----

  async saveResults(currentUser: CurrentUser, courseId: string, rows: TrainingResultInput[], origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    const course = await this.findCourse(context.database, courseId);
    const registrations = await context.database
      .selectFrom('training_registrations')
      .selectAll()
      .where('course_id', '=', courseId)
      .execute();
    const errors: FieldError[] = [];
    rows.forEach((row, index) => {
      const registration = registrations.find((item) => item.id === row.registration_id);
      if (!registration || registration.status !== 'approved') {
        errors.push({ field: `results[${index}].registration_id`, message: 'Chỉ ghi kết quả cho đăng ký đã duyệt' });
      }
      if (row.attended_sessions !== null && row.attended_sessions > course.sessions) {
        errors.push({
          field: `results[${index}].attended_sessions`,
          message: `Số buổi có mặt không quá ${course.sessions} buổi của khoá`,
        });
      }
      if (row.credited_periods !== null && row.credited_periods > course.periods) {
        errors.push({
          field: `results[${index}].credited_periods`,
          message: `Số tiết ghi nhận không quá ${course.periods} tiết của khoá`,
        });
      }
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return context.database.transaction().execute(async (transaction) => {
      const saved = [];
      for (const row of rows) {
        const updated = await transaction
          .updateTable('training_registrations')
          .set({
            attended_sessions: row.attended_sessions,
            result: row.result,
            credited_periods: creditedPeriods(row.result, row.credited_periods, course.periods),
            result_comment: row.comment,
            updated_at: this.clock.now(),
          })
          .where('id', '=', row.registration_id)
          .returningAll()
          .executeTakeFirstOrThrow();
        saved.push(updated);
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: course.org_unit_id,
        entityName: 'training_courses',
        entityId: courseId,
        action: 'update',
        before: null,
        after: { results: rows },
      });
      return saved;
    });
  }

  private async issuerName(database: Executor): Promise<string> {
    const settings = await this.databases.system
      .selectFrom('training_settings')
      .select('certificate_issuer')
      .where('id', '=', 1)
      .executeTakeFirst();
    return settings?.certificate_issuer ?? (await this.rootUnit(database)).name;
  }

  // Cấp chứng nhận cho người đạt của khoá trường tổ chức có cấp chứng nhận; người đã có chứng nhận còn hiệu lực thì bỏ qua
  async issueCertificates(currentUser: CurrentUser, courseId: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    const course = await this.findCourse(context.database, courseId);
    if (course.organizer_kind !== 'school' || !course.issues_certificate) {
      throw ruleViolationError(TRAINING_RULE_CODE, 'Khoá không cấp chứng nhận của trường');
    }
    const passed = await context.database
      .selectFrom('training_registrations')
      .selectAll()
      .where('course_id', '=', courseId)
      .where('status', '=', 'approved')
      .where('result', '=', 'passed')
      .where((expression) =>
        expression.not(
          expression.exists(
            expression
              .selectFrom('staff_certificates')
              .select('staff_certificates.id')
              .whereRef('staff_certificates.registration_id', '=', 'training_registrations.id')
              .where('staff_certificates.revoked_at', 'is', null),
          ),
        ),
      )
      .execute();
    if (passed.length === 0) {
      throw ruleViolationError(TRAINING_RULE_CODE, 'Không có người đạt nào chưa được cấp chứng nhận');
    }
    const issuer = await this.issuerName(context.database);
    const today = this.today();
    return context.database.transaction().execute(async (transaction) => {
      const issued = [];
      for (const registration of passed) {
        issued.push(
          await transaction
            .insertInto('staff_certificates')
            .values({
              staff_id: registration.staff_id,
              name: `Chứng nhận hoàn thành khoá bồi dưỡng: ${course.name}`,
              issued_by: issuer,
              issued_date: today,
              kind: 'school',
              course_id: course.id,
              registration_id: registration.id,
              periods: registration.credited_periods,
              lookup_code: verificationCode(),
              created_by: currentUser.id,
            })
            .returning(['id', 'staff_id', 'lookup_code', 'issued_date'])
            .executeTakeFirstOrThrow(),
        );
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: course.org_unit_id,
        entityName: 'staff_certificates',
        entityId: course.id,
        action: 'create',
        before: null,
        after: { course_id: course.id, issued },
      });
      return { issued: issued.length, certificates: issued };
    });
  }

  private async findCertificate(database: Executor, id: string) {
    const certificate = await database
      .selectFrom('staff_certificates')
      .innerJoin('staff', 'staff.id', 'staff_certificates.staff_id')
      .selectAll('staff_certificates')
      .select(['staff.full_name as staff_name', 'staff.department_id', 'staff.org_unit_id'])
      .where('staff_certificates.id', '=', id)
      .executeTakeFirst();
    if (!certificate) {
      throw notFoundError('Không tìm thấy chứng chỉ', 'staff_certificate');
    }
    return certificate;
  }

  async revoke(currentUser: CurrentUser, id: string, reason: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    const certificate = await this.findCertificate(context.database, id);
    if (certificate.kind !== 'school') {
      throw ruleViolationError(TRAINING_RULE_CODE, 'Chỉ thu hồi chứng nhận do trường cấp');
    }
    if (certificate.revoked_at) {
      throw ruleViolationError(TRAINING_RULE_CODE, 'Chứng nhận đã bị thu hồi');
    }
    const updated = await context.database
      .updateTable('staff_certificates')
      .set({ revoked_at: this.clock.now(), revoke_reason: reason })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAuditLog(context.database, {
      origin,
      orgUnitId: certificate.org_unit_id,
      entityName: 'staff_certificates',
      entityId: id,
      action: 'update',
      before: certificate,
      after: updated,
    });
    return updated;
  }

  // Cấp lại: thu hồi bản đang hiệu lực (nếu còn), cấp bản mới mã mới cho cùng đăng ký
  async reissue(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    const certificate = await this.findCertificate(context.database, id);
    if (certificate.kind !== 'school') {
      throw ruleViolationError(TRAINING_RULE_CODE, 'Chỉ cấp lại chứng nhận do trường cấp');
    }
    return context.database.transaction().execute(async (transaction) => {
      if (!certificate.revoked_at) {
        await transaction
          .updateTable('staff_certificates')
          .set({ revoked_at: this.clock.now(), revoke_reason: 'Cấp lại' })
          .where('id', '=', id)
          .execute();
      }
      const fresh = await transaction
        .insertInto('staff_certificates')
        .values({
          staff_id: certificate.staff_id,
          name: certificate.name,
          certificate_no: certificate.certificate_no,
          issued_by: certificate.issued_by,
          issued_date: this.today(),
          kind: 'school',
          course_id: certificate.course_id,
          registration_id: certificate.registration_id,
          periods: certificate.periods,
          lookup_code: verificationCode(),
          created_by: currentUser.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: certificate.org_unit_id,
        entityName: 'staff_certificates',
        entityId: fresh.id,
        action: 'create',
        before: certificate,
        after: fresh,
      });
      return fresh;
    });
  }

  private async certificateContents(database: Executor, ids: string[], origin: string | null) {
    if (ids.length === 0) {
      return [];
    }
    const rows = await database
      .selectFrom('staff_certificates')
      .innerJoin('staff', 'staff.id', 'staff_certificates.staff_id')
      .leftJoin('departments', 'departments.id', 'staff.department_id')
      .innerJoin('training_courses', 'training_courses.id', 'staff_certificates.course_id')
      .select([
        'staff_certificates.id',
        'staff_certificates.issued_by',
        'staff_certificates.issued_date',
        'staff_certificates.periods',
        'staff_certificates.lookup_code',
        'staff.full_name',
        'departments.name as department_name',
        'training_courses.name as course_name',
        'training_courses.start_date',
        'training_courses.end_date',
      ])
      .where('staff_certificates.id', 'in', ids)
      .orderBy('staff.full_name')
      .execute();
    return rows.map((row): TrainingCertificateContent => ({
      issuer: row.issued_by,
      staff_name: row.full_name,
      department: row.department_name,
      course_name: row.course_name,
      start_date: row.start_date,
      end_date: row.end_date,
      periods: row.periods,
      issued_date: row.issued_date,
      lookup_code: row.lookup_code ?? '',
      verification_text: certificateVerificationText(row.lookup_code ?? '', origin),
    }));
  }

  // Một chứng nhận: người được cấp hoặc Ban Giám hiệu tải
  async certificatePdf(currentUser: CurrentUser, id: string, origin: string | null) {
    const context = await this.context(currentUser);
    const certificate = await this.findCertificate(context.database, id);
    if (certificate.staff_id !== context.staff?.id && !context.canManage) {
      throw notFoundError('Không tìm thấy chứng chỉ', 'staff_certificate');
    }
    if (certificate.kind !== 'school' || !certificate.lookup_code || certificate.revoked_at) {
      throw ruleViolationError(TRAINING_RULE_CODE, 'Chỉ in chứng nhận do trường cấp còn hiệu lực');
    }
    const buffer = await trainingCertificatesPdf(await this.certificateContents(context.database, [id], origin));
    return { buffer, contentType: PDF_TYPE, fileName: `chung-nhan-${certificate.lookup_code}.pdf` };
  }

  // Mọi chứng nhận còn hiệu lực của một khoá trong một tệp, mỗi chứng nhận một trang
  async courseCertificatesPdf(currentUser: CurrentUser, courseId: string, origin: string | null) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    await this.findCourse(context.database, courseId);
    const ids = await context.database
      .selectFrom('staff_certificates')
      .select('id')
      .where('course_id', '=', courseId)
      .where('kind', '=', 'school')
      .where('revoked_at', 'is', null)
      .execute();
    if (ids.length === 0) {
      throw ruleViolationError(TRAINING_RULE_CODE, 'Khoá chưa có chứng nhận nào');
    }
    const buffer = await trainingCertificatesPdf(
      await this.certificateContents(
        context.database,
        ids.map((row) => row.id),
        origin,
      ),
    );
    return { buffer, contentType: PDF_TYPE, fileName: `chung-nhan-khoa-${courseId.slice(0, 8)}.pdf` };
  }

  // Tra cứu công khai theo mã: tìm ở mọi năm học, chỉ trả tên người, khoá, ngày cấp, trạng thái
  async verify(code: string) {
    const years = await this.databases.system
      .selectFrom('academic_years')
      .innerJoin('academic_year_databases', 'academic_year_databases.academic_year_id', 'academic_years.id')
      .select('academic_year_databases.database_name')
      .orderBy('academic_years.start_date', 'desc')
      .execute();
    for (const year of years) {
      const database = this.databases.schoolYear<SchoolYearDatabase>(year.database_name);
      try {
        const row = await database
          .selectFrom('staff_certificates')
          .innerJoin('staff', 'staff.id', 'staff_certificates.staff_id')
          .leftJoin('training_courses', 'training_courses.id', 'staff_certificates.course_id')
          .select([
            'staff.full_name as staff_name',
            'staff_certificates.name',
            'staff_certificates.issued_by',
            'staff_certificates.issued_date',
            'staff_certificates.periods',
            'staff_certificates.revoked_at',
            'training_courses.name as course_name',
          ])
          .where('staff_certificates.lookup_code', '=', code)
          .where('staff_certificates.kind', '=', 'school')
          .executeTakeFirst();
        if (row) {
          return {
            code,
            staff_name: row.staff_name,
            certificate_name: row.name,
            course_name: row.course_name,
            issued_by: row.issued_by,
            issued_date: row.issued_date,
            periods: row.periods,
            status: row.revoked_at ? 'revoked' : 'valid',
          };
        }
      } catch {
        // Năm học cũ chưa có cột mã tra cứu thì bỏ qua
      }
    }
    throw notFoundError('Không tìm thấy chứng nhận có mã tra cứu này', 'staff_certificate');
  }

  // ---- Chứng chỉ nhập tay ----

  async addCertificate(currentUser: CurrentUser, body: RequestBody, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    const errors: FieldError[] = [];
    const name = limitText(readRequiredText(body, 'name', errors), 'name', 300, errors) ?? '';
    const number = limitText(readOptionalText(body, 'certificate_no', errors), 'certificate_no', 100, errors);
    const issuedBy = limitText(readRequiredText(body, 'issued_by', errors), 'issued_by', 300, errors) ?? '';
    const issued = readDate(body, 'issued_date', errors, true);
    const expire = readDate(body, 'expire_date', errors, false);
    if (issued && expire && expire < issued) {
      errors.push({ field: 'expire_date', message: 'Ngày hết hạn không trước ngày cấp' });
    }
    const periods = readInteger(body, 'periods', errors, { min: 0, max: 1000 }) ?? null;
    const note = limitText(readOptionalText(body, 'note', errors), 'note', 1000, errors);
    const staffId = body?.staff_id;
    if (staffId !== undefined && staffId !== null && !isUuid(staffId)) {
      errors.push({ field: 'staff_id', message: 'Cán bộ không hợp lệ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    let target = context.staff?.id ?? null;
    if (typeof staffId === 'string' && staffId !== context.staff?.id) {
      this.assertManage(context);
      target = staffId;
    }
    if (!target) {
      this.requireStaff(context);
    }
    const staff = await context.database
      .selectFrom('staff')
      .select(['id', 'org_unit_id'])
      .where('id', '=', target as string)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Không tìm thấy cán bộ', 'staff');
    }
    const certificate = await context.database
      .insertInto('staff_certificates')
      .values({
        staff_id: staff.id,
        name,
        certificate_no: number,
        issued_by: issuedBy,
        issued_date: issued ?? '',
        expire_date: expire,
        periods,
        note,
        kind: 'manual',
        created_by: currentUser.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAuditLog(context.database, {
      origin,
      orgUnitId: staff.org_unit_id,
      entityName: 'staff_certificates',
      entityId: certificate.id,
      action: 'create',
      before: null,
      after: certificate,
    });
    return certificate;
  }

  async deleteCertificate(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    const certificate = await this.findCertificate(context.database, id);
    if (certificate.kind !== 'manual') {
      throw ruleViolationError(TRAINING_RULE_CODE, 'Chứng nhận do trường cấp chỉ thu hồi, không xoá');
    }
    if (certificate.staff_id !== context.staff?.id && !context.canManage) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người có chứng chỉ hoặc Ban Giám hiệu xoá được');
    }
    await context.database.deleteFrom('staff_certificates').where('id', '=', id).execute();
    await writeAuditLog(context.database, {
      origin,
      orgUnitId: certificate.org_unit_id,
      entityName: 'staff_certificates',
      entityId: id,
      action: 'delete',
      before: certificate,
      after: null,
    });
  }

  // ---- Hồ sơ bồi dưỡng ----

  private async yearRange(): Promise<{ start: string; end: string; name: string }> {
    const current = await this.currentSchoolYear.require();
    const year = await this.databases.system
      .selectFrom('academic_years')
      .select(['name', 'start_date', 'end_date'])
      .where('id', '=', current.academicYearId)
      .executeTakeFirstOrThrow();
    return { start: String(year.start_date), end: String(year.end_date), name: year.name };
  }

  // Tổng số tiết của từng cán bộ trong năm học: tiết được ghi nhận của khoá đạt cộng tiết của chứng chỉ nhập tay cấp trong
  // năm học
  private async periodTotals(database: Executor, staffIds: string[], range: { start: string; end: string }) {
    if (staffIds.length === 0) {
      return new Map<string, { courses: number; course_periods: number; manual_periods: number }>();
    }
    const courses = await database
      .selectFrom('training_registrations')
      .select([
        'staff_id',
        (expression) => expression.fn.countAll<string>().as('courses'),
        (expression) => expression.fn.sum<string>('credited_periods').as('periods'),
      ])
      .where('staff_id', 'in', staffIds)
      .where('status', '=', 'approved')
      .where('result', '=', 'passed')
      .groupBy('staff_id')
      .execute();
    const manual = await database
      .selectFrom('staff_certificates')
      .select(['staff_id', (expression) => expression.fn.sum<string>('periods').as('periods')])
      .where('staff_id', 'in', staffIds)
      .where('kind', '=', 'manual')
      .where('issued_date', '>=', range.start)
      .where('issued_date', '<=', range.end)
      .groupBy('staff_id')
      .execute();
    const totals = new Map<string, { courses: number; course_periods: number; manual_periods: number }>();
    for (const id of staffIds) {
      const course = courses.find((row) => row.staff_id === id);
      const own = manual.find((row) => row.staff_id === id);
      totals.set(id, {
        courses: Number(course?.courses ?? 0),
        course_periods: Number(course?.periods ?? 0),
        manual_periods: Number(own?.periods ?? 0),
      });
    }
    return totals;
  }

  private expiringSoon(expireDate: string | null): boolean {
    if (!expireDate) {
      return false;
    }
    const today = this.today();
    const limit = VIETNAM_DATE.format(new Date(this.clock.now().getTime() + CERTIFICATE_EXPIRY_WARNING_DAYS * DAY));
    return expireDate >= today && expireDate <= limit;
  }

  async mine(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    const staff = this.requireStaff(context);
    const range = await this.yearRange();
    const { settings, topics } = await this.catalog();
    const registrations = await context.database
      .selectFrom('training_registrations')
      .innerJoin('training_courses', 'training_courses.id', 'training_registrations.course_id')
      .selectAll('training_registrations')
      .select([
        'training_courses.name as course_name',
        'training_courses.start_date',
        'training_courses.end_date',
        'training_courses.periods as course_periods',
        'training_courses.organizer_kind',
      ])
      .where('training_registrations.staff_id', '=', staff.id)
      .orderBy('training_courses.start_date', 'desc')
      .execute();
    const certificates = await context.database
      .selectFrom('staff_certificates')
      .selectAll()
      .where('staff_id', '=', staff.id)
      .orderBy('issued_date', 'desc')
      .execute();
    const totals = (await this.periodTotals(context.database, [staff.id], range)).get(staff.id);
    const total = (totals?.course_periods ?? 0) + (totals?.manual_periods ?? 0);
    const latest = await this.latestAssessment(context.database, staff.id);
    return {
      year_name: range.name,
      staff: { id: staff.id, full_name: staff.full_name },
      required_periods: settings.annual_required_periods,
      total_periods: total,
      missing_periods: Math.max(0, settings.annual_required_periods - total),
      registrations,
      certificates: certificates.map((certificate) => ({
        ...certificate,
        expiring_soon: this.expiringSoon(certificate.expire_date),
      })),
      competency_gaps: latest
        ? competencyGaps(
            latest.scores,
            settings.competency_gap_level,
            topics.filter((topic) => topic.status === 'active'),
          )
        : [],
    };
  }

  // Hồ sơ theo cá nhân, tổ, trường: Ban Giám hiệu thấy cả trường, tổ trưởng thấy tổ mình
  async records(currentUser: CurrentUser, departmentId: string | null) {
    const context = await this.context(currentUser);
    if (!context.canManage && !context.canReview) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ tổ trưởng, Ban Giám hiệu xem hồ sơ bồi dưỡng');
    }
    const range = await this.yearRange();
    const { settings } = await this.catalog();
    let query = context.database
      .selectFrom('staff')
      .leftJoin('departments', 'departments.id', 'staff.department_id')
      .select(['staff.id', 'staff.full_name', 'staff.department_id', 'departments.name as department_name'])
      .where('staff.status', '=', 'active');
    if (!context.canManage) {
      query = query.where(
        'staff.department_id',
        '=',
        context.staff?.department_id ?? '00000000-0000-0000-0000-000000000000',
      );
    } else if (departmentId) {
      query = query.where('staff.department_id', '=', departmentId);
    }
    const staff = await query.orderBy('departments.name').orderBy('staff.full_name').execute();
    const totals = await this.periodTotals(
      context.database,
      staff.map((row) => row.id),
      range,
    );
    const certificates = staff.length
      ? await context.database
          .selectFrom('staff_certificates')
          .select(['staff_id', 'expire_date', 'revoked_at'])
          .where(
            'staff_id',
            'in',
            staff.map((row) => row.id),
          )
          .execute()
      : [];
    const rows = staff.map((row) => {
      const total = totals.get(row.id);
      const periods = (total?.course_periods ?? 0) + (total?.manual_periods ?? 0);
      const own = certificates.filter((certificate) => certificate.staff_id === row.id && !certificate.revoked_at);
      return {
        staff_id: row.id,
        full_name: row.full_name,
        department_id: row.department_id,
        department_name: row.department_name,
        courses: total?.courses ?? 0,
        course_periods: total?.course_periods ?? 0,
        manual_periods: total?.manual_periods ?? 0,
        total_periods: periods,
        missing_periods: Math.max(0, settings.annual_required_periods - periods),
        certificates: own.length,
        expiring_certificates: own.filter((certificate) => this.expiringSoon(certificate.expire_date)).length,
      };
    });
    const departments = [...new Map(rows.map((row) => [row.department_id ?? '', row.department_name])).entries()].map(
      ([id, name]) => {
        const members = rows.filter((row) => (row.department_id ?? '') === id);
        return {
          department_id: id || null,
          department_name: name,
          staff: members.length,
          completed: members.filter((row) => row.missing_periods === 0).length,
        };
      },
    );
    const courses = await context.database
      .selectFrom('training_courses')
      .select(['status', 'topic_name', 'organizer_kind'])
      .execute();
    return {
      year_name: range.name,
      required_periods: settings.annual_required_periods,
      rows,
      departments,
      plan: {
        courses: courses.length,
        completed: courses.filter((course) => course.status === 'completed').length,
      },
    };
  }

  // ---- Năng lực số ----

  private async latestAssessment(database: Executor, staffId: string) {
    const assessment = await database
      .selectFrom('digital_competency_assessments')
      .selectAll()
      .where('staff_id', '=', staffId)
      .orderBy('updated_at', 'desc')
      .executeTakeFirst();
    if (!assessment) {
      return null;
    }
    const scores = await database
      .selectFrom('digital_competency_scores')
      .selectAll()
      .where('assessment_id', '=', assessment.id)
      .execute();
    return { ...assessment, scores };
  }

  async myAssessment(currentUser: CurrentUser, term: CompetencyTerm) {
    const context = await this.context(currentUser);
    const staff = this.requireStaff(context);
    const { domains, levels, settings, topics } = await this.catalog();
    const assessment = await context.database
      .selectFrom('digital_competency_assessments')
      .selectAll()
      .where('staff_id', '=', staff.id)
      .where('term', '=', term)
      .executeTakeFirst();
    const scores = assessment
      ? await context.database
          .selectFrom('digital_competency_scores')
          .selectAll()
          .where('assessment_id', '=', assessment.id)
          .execute()
      : [];
    return {
      term,
      domains: domains.filter((domain) => domain.status === 'active'),
      levels,
      assessment: assessment ? { ...assessment, scores } : null,
      gaps: competencyGaps(
        scores,
        settings.competency_gap_level,
        topics.filter((topic) => topic.status === 'active'),
      ),
    };
  }

  async submitAssessment(currentUser: CurrentUser, term: CompetencyTerm, body: RequestBody, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    const staff = this.requireStaff(context);
    const { domains, levels } = await this.catalog();
    const active = domains.filter((domain) => domain.status === 'active');
    const maximum = Math.max(...levels.map((level) => level.level_no), 1);
    const raw = body?.scores;
    const errors: FieldError[] = [];
    if (!Array.isArray(raw)) {
      throw validationError([{ field: 'scores', message: 'Danh sách mức theo miền không hợp lệ' }]);
    }
    const scores = active.map((domain) => {
      const entry = raw.find(
        (value) =>
          typeof value === 'object' && value !== null && (value as Record<string, unknown>).domain_code === domain.code,
      ) as Record<string, unknown> | undefined;
      const level = entry?.level;
      if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > maximum) {
        errors.push({
          field: `scores.${domain.code}`,
          message: `Chọn mức từ 1 đến ${maximum} cho miền ${domain.name}`,
        });
      }
      return { domain_code: domain.code, domain_name: domain.name, self_level: level as number };
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const existing = await context.database
      .selectFrom('digital_competency_assessments')
      .selectAll()
      .where('staff_id', '=', staff.id)
      .where('term', '=', term)
      .executeTakeFirst();
    if (existing?.status === 'confirmed') {
      throw ruleViolationError(TRAINING_RULE_CODE, 'Kỳ này đã được xác nhận, không sửa được');
    }
    return context.database.transaction().execute(async (transaction) => {
      const assessment = existing
        ? await transaction
            .updateTable('digital_competency_assessments')
            .set({ updated_at: this.clock.now(), department_id: staff.department_id, staff_name: staff.full_name })
            .where('id', '=', existing.id)
            .returningAll()
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('digital_competency_assessments')
            .values({ staff_id: staff.id, staff_name: staff.full_name, department_id: staff.department_id, term })
            .returningAll()
            .executeTakeFirstOrThrow();
      await transaction.deleteFrom('digital_competency_scores').where('assessment_id', '=', assessment.id).execute();
      await transaction
        .insertInto('digital_competency_scores')
        .values(scores.map((score) => ({ ...score, assessment_id: assessment.id })))
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: staff.org_unit_id,
        entityName: 'digital_competency_assessments',
        entityId: assessment.id,
        action: existing ? 'update' : 'create',
        before: existing ?? null,
        after: { ...assessment, scores },
      });
      return { ...assessment, scores };
    });
  }

  // Bảng năng lực của tổ, trường theo kỳ: mỗi giáo viên một dòng, mỗi miền một cột (bản đồ nhiệt ở giao diện)
  async assessments(currentUser: CurrentUser, term: CompetencyTerm) {
    const context = await this.context(currentUser);
    if (!context.canManage && !context.canReview) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ tổ trưởng, Ban Giám hiệu xem năng lực số của tổ, trường');
    }
    const { domains, levels, settings } = await this.catalog();
    let query = context.database
      .selectFrom('digital_competency_assessments')
      .leftJoin('departments', 'departments.id', 'digital_competency_assessments.department_id')
      .selectAll('digital_competency_assessments')
      .select('departments.name as department_name')
      .where('digital_competency_assessments.term', '=', term);
    if (!context.canManage) {
      query = query.where(
        'digital_competency_assessments.department_id',
        '=',
        context.staff?.department_id ?? '00000000-0000-0000-0000-000000000000',
      );
    }
    const assessments = await query
      .orderBy('departments.name')
      .orderBy('digital_competency_assessments.staff_name')
      .execute();
    const scores = assessments.length
      ? await context.database
          .selectFrom('digital_competency_scores')
          .selectAll()
          .where(
            'assessment_id',
            'in',
            assessments.map((assessment) => assessment.id),
          )
          .execute()
      : [];
    const active = domains.filter((domain) => domain.status === 'active');
    return {
      term,
      domains: active,
      levels,
      gap_level: settings.competency_gap_level,
      rows: assessments.map((assessment) => ({
        ...assessment,
        scores: scores.filter((score) => score.assessment_id === assessment.id),
      })),
      averages: active.map((domain) => {
        const values = scores.filter((score) => score.domain_code === domain.code).map(effectiveLevel);
        return {
          domain_code: domain.code,
          average: values.length
            ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
            : null,
        };
      }),
    };
  }

  async confirmAssessment(currentUser: CurrentUser, id: string, body: RequestBody, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    const assessment = await context.database
      .selectFrom('digital_competency_assessments')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!assessment) {
      throw notFoundError('Không tìm thấy bản tự đánh giá', 'digital_competency_assessment');
    }
    if (!context.canManage && !this.leadsDepartment(context, assessment.department_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ tổ trưởng của tổ hoặc Ban Giám hiệu xác nhận');
    }
    if (assessment.staff_id === context.staff?.id) {
      throw ruleViolationError(TRAINING_RULE_CODE, 'Không tự xác nhận bản tự đánh giá của mình');
    }
    const scores = await context.database
      .selectFrom('digital_competency_scores')
      .selectAll()
      .where('assessment_id', '=', id)
      .execute();
    const { levels } = await this.catalog();
    const maximum = Math.max(...levels.map((level) => level.level_no), 1);
    const raw = Array.isArray(body?.scores) ? (body.scores as Array<Record<string, unknown>>) : [];
    const errors: FieldError[] = [];
    const confirmed = scores.map((score) => {
      const entry = raw.find(
        (value) => typeof value === 'object' && value !== null && value.domain_code === score.domain_code,
      );
      const level = entry?.level ?? score.self_level;
      if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > maximum) {
        errors.push({ field: `scores.${score.domain_code}`, message: `Mức từ 1 đến ${maximum}` });
      }
      const reason = typeof entry?.reason === 'string' && entry.reason.trim() !== '' ? entry.reason.trim() : null;
      if (level !== score.self_level && !reason) {
        errors.push({
          field: `scores.${score.domain_code}.reason`,
          message: `Đổi mức miền ${score.domain_name} phải có lý do`,
        });
      }
      if (reason && reason.length > 500) {
        errors.push({ field: `scores.${score.domain_code}.reason`, message: 'Tối đa 500 ký tự' });
      }
      return { domain_code: score.domain_code, confirmed_level: level as number, reason };
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return context.database.transaction().execute(async (transaction) => {
      for (const score of confirmed) {
        await transaction
          .updateTable('digital_competency_scores')
          .set({ confirmed_level: score.confirmed_level, reason: score.reason })
          .where('assessment_id', '=', id)
          .where('domain_code', '=', score.domain_code)
          .execute();
      }
      const updated = await transaction
        .updateTable('digital_competency_assessments')
        .set({
          status: 'confirmed',
          confirmed_by_name: context.staff?.full_name ?? currentUser.description.full_name,
          confirmed_at: this.clock.now(),
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: context.staff?.org_unit_id ?? (await this.rootUnit(transaction)).id,
        entityName: 'digital_competency_assessments',
        entityId: id,
        action: 'update',
        before: { ...assessment, scores },
        after: { ...updated, scores: confirmed },
      });
      return updated;
    });
  }

  // ---- Việc của tôi ----

  async pendingWork(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    const review =
      context.canManage || context.canReview
        ? await context.database
            .selectFrom('training_registrations')
            .innerJoin('training_courses', 'training_courses.id', 'training_registrations.course_id')
            .select([
              'training_registrations.id',
              'training_registrations.staff_name',
              'training_registrations.created_at',
              'training_registrations.status',
              'training_registrations.department_id',
              'training_courses.name as course_name',
              'training_courses.registration_deadline',
            ])
            .where(
              'training_registrations.status',
              'in',
              context.canManage ? ['pending', 'team_approved'] : ['pending'],
            )
            .execute()
        : [];
    const expiring = context.staff
      ? (
          await context.database
            .selectFrom('staff_certificates')
            .select(['id', 'name', 'expire_date'])
            .where('staff_id', '=', context.staff.id)
            .where('revoked_at', 'is', null)
            .where('expire_date', 'is not', null)
            .execute()
        ).filter((certificate) => this.expiringSoon(certificate.expire_date))
      : [];
    return {
      review: review.filter(
        (registration) => context.canManage || this.leadsDepartment(context, registration.department_id),
      ),
      expiring,
    };
  }
}

// Nội dung mã QR của chứng nhận: địa chỉ trang tra cứu trên cổng của trường (lấy theo nguồn gửi yêu cầu, không ghi cứng tên
// miền); không có nguồn hợp lệ thì chỉ in mã
export function certificateVerificationText(code: string, origin: string | null): string {
  if (origin && /^https?:\/\/[^/\s]+$/.test(origin)) {
    return `${origin}/tra-cuu-chung-nhan?ma=${code}`;
  }
  return code;
}
