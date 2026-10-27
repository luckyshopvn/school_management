import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { LearningResourceAction, SchoolYearDatabase, SystemDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  LEARNING_RESOURCE_MAXIMUM_FILE_BYTES,
  LEARNING_RESOURCE_REVIEW_DAYS,
  PERMISSION_CODES,
  type LearningResourceReportKind,
  type LearningResourceStatus,
} from '@school-management/shared';
import { sql, type Kysely, type Selectable } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { storageKey } from '../common/resource-names.js';
import { notFoundError, readOptionalText, type RequestBody } from '../common/request-fields.js';
import { buildTableFile, CONTENT_TYPES } from '../exports/table-file.js';
import { FileStorage } from '../files/file-storage.js';
import {
  detectResourceFileType,
  LEARNING_RESOURCE_RULE_CODE,
  needsSchoolReview,
  normalizeFileName,
  parseExternalLink,
  submitProblems,
  type LearningResourceInput,
} from './learning-resource-rules.js';

// Kho học liệu số (DT-22 phần 22h1, YCTD-183). Học liệu, phiên bản, bộ sưu tập, danh mục ở cơ sở dữ liệu hệ thống; sự kiện
// duyệt, báo lỗi, lượt xem, tải ở năm học hiện hành. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - Ai thấy học liệu: người sở hữu; thủ kho (mọi học liệu); học liệu đã công bố phạm vi toàn trường (mọi người dùng kho) hoặc
//   phạm vi tổ (người cùng tổ); học liệu chờ duyệt với người duyệt của bước đó.
// - Luồng: nháp hoặc bị trả lại → gửi duyệt → chờ tổ duyệt (tổ trưởng của tổ người sở hữu; Ban Giám hiệu duyệt thay khi người
//   sở hữu không thuộc tổ nào) → chờ Ban Giám hiệu duyệt nếu thuộc luồng rủi ro → công bố. Trả lại kèm lý do; học liệu đã công
//   bố mà bản nộp lại bị trả thì bản đã công bố vẫn dùng. Người duyệt không duyệt học liệu của chính mình.
// - Nộp lại: thêm phiên bản (tệp, liên kết, kế hoạch bài dạy), gửi duyệt lại; bản cũ lưu.
// - Thủ kho ẩn tạm (khi xử lý báo lỗi), mở lại; người sở hữu hoặc thủ kho ngừng dùng (giữ lịch sử).
type SystemExecutor = Kysely<SystemDatabase>;
type ResourceRow = Selectable<SystemDatabase['learning_resources']>;
const DAY = 86_400_000;
const NO_ID = '00000000-0000-0000-0000-000000000000';

export interface ResourceContext {
  userId: string;
  name: string;
  staffDepartmentId: string | null;
  staffDepartmentName: string | null;
  canUse: boolean;
  canReview: boolean;
  canApprove: boolean;
  canManage: boolean;
  year: { database: Kysely<SchoolYearDatabase>; databaseName: string } | null;
}

export function resourceRule(message: string) {
  return ruleViolationError(LEARNING_RESOURCE_RULE_CODE, message);
}

@Injectable()
export class LearningResourcesService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  private get system(): SystemExecutor {
    return this.databases.system;
  }

  async context(currentUser: CurrentUser): Promise<ResourceContext> {
    const current = await this.currentSchoolYear.find();
    let department: { id: string | null; name: string | null } = { id: null, name: null };
    if (current) {
      const staff = await current.database
        .selectFrom('staff')
        .leftJoin('departments', 'departments.id', 'staff.department_id')
        .select(['staff.department_id', 'departments.name'])
        .where('staff.user_id', '=', currentUser.id)
        .where('staff.status', '=', 'active')
        .executeTakeFirst();
      department = { id: staff?.department_id ?? null, name: staff?.name ?? null };
    }
    const registry = current
      ? await this.system
          .selectFrom('academic_year_databases')
          .select('database_name')
          .where('academic_year_id', '=', current.academicYearId)
          .executeTakeFirst()
      : undefined;
    return {
      userId: currentUser.id,
      name: currentUser.description.full_name,
      staffDepartmentId: department.id,
      staffDepartmentName: department.name,
      canUse: currentUser.hasPermission(PERMISSION_CODES.learningResourceUse),
      canReview: currentUser.hasPermission(PERMISSION_CODES.learningResourceReview),
      canApprove: currentUser.hasPermission(PERMISSION_CODES.learningResourceApprove),
      canManage: currentUser.hasPermission(PERMISSION_CODES.learningResourceManage),
      year: current && registry ? { database: current.database, databaseName: registry.database_name } : null,
    };
  }

  private requireYear(context: ResourceContext) {
    if (!context.year) {
      throw resourceRule('Chưa có năm học đang dùng, hãy mở năm học trước');
    }
    return context.year.database;
  }

  // Người duyệt của bước đang chờ: bước tổ là tổ trưởng cùng tổ (hoặc Ban Giám hiệu khi người sở hữu không thuộc tổ); bước
  // trường là Ban Giám hiệu
  private reviewsStep(context: ResourceContext, row: ResourceRow): boolean {
    if (row.owner_user_id === context.userId) {
      return false;
    }
    if (row.status === 'pending_unit') {
      return (
        (context.canReview && row.department_id !== null && row.department_id === context.staffDepartmentId) ||
        context.canApprove
      );
    }
    return row.status === 'pending_school' && context.canApprove;
  }

  canSee(context: ResourceContext, row: ResourceRow): boolean {
    if (row.owner_user_id === context.userId || context.canManage || this.reviewsStep(context, row)) {
      return true;
    }
    const published =
      row.published_version !== null &&
      (row.status === 'published' || row.status.startsWith('pending') || row.status === 'returned');
    if (!published) {
      return false;
    }
    return (
      row.visibility === 'school' ||
      (row.visibility === 'unit' && row.department_id !== null && row.department_id === context.staffDepartmentId)
    );
  }

  private async findResource(id: string) {
    const row = await this.system.selectFrom('learning_resources').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy học liệu', 'learning_resource');
    }
    return row;
  }

  private async visibleResource(context: ResourceContext, id: string) {
    const row = await this.findResource(id);
    if (!this.canSee(context, row)) {
      throw notFoundError('Không tìm thấy học liệu', 'learning_resource');
    }
    return row;
  }

  private assertOwner(context: ResourceContext, row: ResourceRow) {
    if (row.owner_user_id !== context.userId) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người sở hữu sửa được học liệu');
    }
  }

  private async event(
    context: ResourceContext,
    resourceId: string,
    action: LearningResourceAction,
    versionNo: number | null,
    note: string | null,
  ) {
    if (!context.year) {
      return;
    }
    await context.year.database
      .insertInto('learning_resource_events')
      .values({
        resource_id: resourceId,
        version_no: versionNo,
        action,
        note,
        actor_user_id: context.userId,
        actor_name: context.name,
      })
      .execute();
  }

  // ---- Danh mục ----

  async catalog() {
    const [types, licenses, topics] = await Promise.all([
      this.system.selectFrom('resource_types').selectAll().orderBy('order_no').orderBy('code').execute(),
      this.system.selectFrom('resource_licenses').selectAll().orderBy('order_no').orderBy('code').execute(),
      this.system.selectFrom('resource_topics').selectAll().orderBy('order_no').orderBy('name').execute(),
    ]);
    const current = await this.currentSchoolYear.find();
    const subjects = current
      ? await current.database
          .selectFrom('subjects')
          .select(['code', 'name', 'school_level'])
          .where('status', '=', 'active')
          .orderBy('school_level')
          .orderBy('order_no')
          .execute()
      : [];
    const grades = current
      ? await current.database
          .selectFrom('grade_levels')
          .select(['code', 'name', 'school_level'])
          .orderBy('order_no')
          .execute()
      : [];
    return { types, licenses, topics, subjects, grades };
  }

  private assertManage(currentUser: CurrentUser) {
    if (!currentUser.hasPermission(PERMISSION_CODES.learningResourceManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ thủ kho học liệu sửa danh mục');
    }
  }

  private readCatalogFields(body: RequestBody, creating: boolean, codeRequired: boolean) {
    const errors: FieldError[] = [];
    const code = readOptionalText(body, 'code', errors);
    if (creating && codeRequired && (!code || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/.test(code))) {
      errors.push({ field: 'code', message: 'Mã gồm chữ, số, gạch, tối đa 50 ký tự' });
    }
    const name = readOptionalText(body, 'name', errors);
    if ((creating && !name) || (name && name.length > 300)) {
      errors.push({ field: 'name', message: 'Tên từ 1 đến 300 ký tự' });
    }
    const status = body?.status;
    if (status !== undefined && status !== 'active' && status !== 'inactive') {
      errors.push({ field: 'status', message: 'Trạng thái là active hoặc inactive' });
    }
    const flag = (field: string) => {
      const value = body?.[field];
      if (value !== undefined && typeof value !== 'boolean') {
        errors.push({ field, message: 'Phải là đúng hoặc sai' });
      }
      return value as boolean | undefined;
    };
    return { errors, code, name, status: status as 'active' | 'inactive' | undefined, flag };
  }

  async saveType(currentUser: CurrentUser, id: string | null, body: RequestBody) {
    this.assertManage(currentUser);
    const fields = this.readCatalogFields(body, id === null, true);
    const school = fields.flag('requires_school_review');
    if (fields.errors.length > 0) {
      throw validationError(fields.errors);
    }
    const values = {
      ...(fields.name ? { name: fields.name } : {}),
      ...(school !== undefined ? { requires_school_review: school } : {}),
      ...(fields.status ? { status: fields.status } : {}),
    };
    return this.saveCatalogRow('resource_types', id, fields.code, values, 'Mã loại học liệu đã có');
  }

  async saveLicense(currentUser: CurrentUser, id: string | null, body: RequestBody) {
    this.assertManage(currentUser);
    const fields = this.readCatalogFields(body, id === null, true);
    const blocked = fields.flag('blocked');
    const privateOnly = fields.flag('private_only');
    const grant = fields.flag('requires_grant_source');
    if (fields.errors.length > 0) {
      throw validationError(fields.errors);
    }
    const values = {
      ...(fields.name ? { name: fields.name } : {}),
      ...(blocked !== undefined ? { blocked } : {}),
      ...(privateOnly !== undefined ? { private_only: privateOnly } : {}),
      ...(grant !== undefined ? { requires_grant_source: grant } : {}),
      ...(fields.status ? { status: fields.status } : {}),
    };
    return this.saveCatalogRow('resource_licenses', id, fields.code, values, 'Mã giấy phép đã có');
  }

  private async saveCatalogRow(
    table: 'resource_types' | 'resource_licenses',
    id: string | null,
    code: string | null | undefined,
    values: Record<string, unknown>,
    duplicateMessage: string,
  ) {
    if (id === null) {
      const duplicate = await this.system
        .selectFrom(table)
        .select('id')
        .where('code', '=', code as string)
        .executeTakeFirst();
      if (duplicate) {
        throw new ApplicationError('ERR_CONFLICT', duplicateMessage);
      }
      return this.system
        .insertInto(table)
        .values({ code: code as string, ...values } as never)
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    const updated = await this.system
      .updateTable(table)
      .set(values as never)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!updated) {
      throw notFoundError('Không tìm thấy mục danh mục', table);
    }
    return updated;
  }

  // Chủ đề: thủ kho thêm, sửa; giáo viên cũng thêm được chủ đề mới khi nhập học liệu (trường tự nhập)
  async saveTopic(currentUser: CurrentUser, id: string | null, body: RequestBody) {
    if (id !== null) {
      this.assertManage(currentUser);
    }
    const errors: FieldError[] = [];
    const name = readOptionalText(body, 'name', errors);
    if ((id === null && !name) || (name && name.length > 300)) {
      errors.push({ field: 'name', message: 'Tên chủ đề từ 1 đến 300 ký tự' });
    }
    const subject = readOptionalText(body, 'subject_code', errors);
    const grade = readOptionalText(body, 'grade_level_code', errors);
    const status = body?.status;
    if (status !== undefined && status !== 'active' && status !== 'inactive') {
      errors.push({ field: 'status', message: 'Trạng thái là active hoặc inactive' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    if (id === null) {
      return this.system
        .insertInto('resource_topics')
        .values({
          name: name as string,
          subject_code: subject ?? null,
          grade_level_code: grade ?? null,
          created_by: currentUser.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    const updated = await this.system
      .updateTable('resource_topics')
      .set({
        ...(name ? { name } : {}),
        ...(subject !== undefined ? { subject_code: subject } : {}),
        ...(grade !== undefined ? { grade_level_code: grade } : {}),
        ...(status !== undefined ? { status: status as 'active' | 'inactive' } : {}),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!updated) {
      throw notFoundError('Không tìm thấy chủ đề', 'resource_topic');
    }
    return updated;
  }

  // ---- Học liệu ----

  private async resolveMetadata(input: LearningResourceInput) {
    const type = await this.system
      .selectFrom('resource_types')
      .select(['id', 'status'])
      .where('id', '=', input.type_id)
      .executeTakeFirst();
    if (!type || type.status !== 'active') {
      throw validationError([{ field: 'type_id', message: 'Loại học liệu không có trong danh mục' }]);
    }
    if (input.license_id) {
      const license = await this.system
        .selectFrom('resource_licenses')
        .select('id')
        .where('id', '=', input.license_id)
        .executeTakeFirst();
      if (!license) {
        throw validationError([{ field: 'license_id', message: 'Giấy phép không có trong danh mục' }]);
      }
    }
    if (input.topic_id) {
      const topic = await this.system
        .selectFrom('resource_topics')
        .select('id')
        .where('id', '=', input.topic_id)
        .executeTakeFirst();
      if (!topic) {
        throw validationError([{ field: 'topic_id', message: 'Chủ đề không có trong danh mục' }]);
      }
    }
    let subjectName: string | null = null;
    if (input.subject_code) {
      const current = await this.currentSchoolYear.find();
      const subject = current
        ? await current.database
            .selectFrom('subjects')
            .select('name')
            .where('code', '=', input.subject_code)
            .executeTakeFirst()
        : undefined;
      if (!subject) {
        throw validationError([{ field: 'subject_code', message: 'Môn học không có trong danh mục môn của năm học' }]);
      }
      subjectName = subject.name;
    }
    return { subject_name: subjectName };
  }

  async create(currentUser: CurrentUser, input: LearningResourceInput) {
    const context = await this.context(currentUser);
    const metadata = await this.resolveMetadata(input);
    return this.system
      .insertInto('learning_resources')
      .values({
        ...input,
        ...metadata,
        owner_user_id: context.userId,
        owner_name: context.name,
        department_id: context.staffDepartmentId,
        department_name: context.staffDepartmentName,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  // Sửa metadata khi đang nháp hoặc bị trả lại (học liệu đã công bố thì nộp phiên bản mới, sửa sau khi bị trả lại)
  async update(currentUser: CurrentUser, id: string, input: LearningResourceInput) {
    const context = await this.context(currentUser);
    const row = await this.findResource(id);
    this.assertOwner(context, row);
    if (
      row.status !== 'draft' &&
      row.status !== 'returned' &&
      !(row.status === 'published' && input.visibility === row.visibility)
    ) {
      throw resourceRule('Chỉ sửa học liệu nháp, bị trả lại hoặc đã công bố (giữ phạm vi xem)');
    }
    const metadata = await this.resolveMetadata(input);
    return this.system
      .updateTable('learning_resources')
      .set({ ...input, ...metadata, updated_at: this.clock.now() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  private assertEditable(row: ResourceRow) {
    if (row.status === 'pending_unit' || row.status === 'pending_school') {
      throw resourceRule('Học liệu đang chờ duyệt, không thêm phiên bản được');
    }
    if (row.status === 'retired' || row.status === 'hidden') {
      throw resourceRule('Học liệu đã ngừng dùng hoặc đang ẩn tạm');
    }
  }

  private async addVersion(row: ResourceRow, values: Record<string, unknown>, userId: string) {
    return this.system.transaction().execute(async (transaction) => {
      const next = row.current_version + 1;
      const version = await transaction
        .insertInto('learning_resource_versions')
        .values({ ...(values as object), resource_id: row.id, version_no: next, created_by: userId } as never)
        .returningAll()
        .executeTakeFirstOrThrow();
      await transaction
        .updateTable('learning_resources')
        .set({
          current_version: next,
          // Học liệu đã công bố giữ trạng thái, bản mới chờ gửi duyệt; nháp, bị trả lại thì về nháp
          status: row.status === 'published' ? 'published' : 'draft',
          updated_at: this.clock.now(),
        })
        .where('id', '=', row.id)
        .execute();
      return version;
    });
  }

  async addFile(currentUser: CurrentUser, id: string, upload: { fileName: string; body: Buffer }) {
    const context = await this.context(currentUser);
    const row = await this.findResource(id);
    this.assertOwner(context, row);
    this.assertEditable(row);
    if (upload.body.length > LEARNING_RESOURCE_MAXIMUM_FILE_BYTES) {
      throw validationError([{ field: 'file', message: 'Tệp học liệu tối đa 50 MB' }]);
    }
    const contentType = detectResourceFileType(upload.fileName, upload.body);
    if (!contentType) {
      throw validationError([
        { field: 'file', message: 'Tệp học liệu là PDF, ảnh, Word, Excel, PowerPoint hoặc video MP4' },
      ]);
    }
    const key = storageKey('learning-resources', id, randomUUID());
    await this.fileStorage.put(key, upload.body, contentType);
    try {
      return await this.addVersion(
        row,
        {
          kind: 'file',
          storage_key: key,
          file_name: normalizeFileName(upload.fileName),
          content_type: contentType,
          size_bytes: upload.body.length,
          sha256: createHash('sha256').update(upload.body).digest('hex'),
        },
        context.userId,
      );
    } catch (error) {
      await this.fileStorage.delete(key).catch(() => undefined);
      throw error;
    }
  }

  // Cửa cho gói SCORM (DT-28 phần 28h): tệp zip của học liệu loại `scorm` là một phiên bản tệp như mọi học liệu (người soạn,
  // còn sửa được, rồi gửi duyệt như cũ); phần kiểm và giải nén gói do `ScormPackagesService` làm trước khi gọi
  async addTypedFileVersion(
    currentUser: CurrentUser,
    id: string,
    upload: { fileName: string; body: Buffer; contentType: string; storageKey: string },
    typeCode: string,
  ) {
    const context = await this.context(currentUser);
    const row = await this.findResource(id);
    this.assertOwner(context, row);
    this.assertEditable(row);
    const type = await this.system
      .selectFrom('resource_types')
      .select('code')
      .where('id', '=', row.type_id)
      .executeTakeFirst();
    if (type?.code !== typeCode) {
      throw resourceRule('Loại học liệu không nhận tệp này');
    }
    await this.fileStorage.put(upload.storageKey, upload.body, upload.contentType);
    try {
      return await this.addVersion(
        row,
        {
          kind: 'file',
          storage_key: upload.storageKey,
          file_name: normalizeFileName(upload.fileName),
          content_type: upload.contentType,
          size_bytes: upload.body.length,
          sha256: createHash('sha256').update(upload.body).digest('hex'),
        },
        context.userId,
      );
    } catch (error) {
      await this.fileStorage.delete(upload.storageKey).catch(() => undefined);
      throw error;
    }
  }

  // Kế hoạch bài dạy nháp do trợ lý AI soạn (DT-23 phần 23d): học liệu riêng tư, trạng thái nháp, mang cờ `ai_generated`; nội dung lưu
  // thành tệp văn bản Markdown ở phiên bản 1. Muốn chia sẻ phải điền giấy phép rồi gửi duyệt như mọi học liệu (kiểm duyệt 22h1)
  async createAiLessonPlanDraft(
    currentUser: CurrentUser,
    input: {
      title: string;
      markdown: string;
      school_level: string | null;
      grade_level_code: string | null;
      subject_code: string | null;
      duration_minutes: number | null;
      requestId: string;
    },
  ) {
    const context = await this.context(currentUser);
    const type = await this.system
      .selectFrom('resource_types')
      .select('id')
      .where('code', '=', 'lesson_plan')
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!type) {
      throw resourceRule('Danh mục loại học liệu chưa có "Kế hoạch bài dạy"');
    }
    const metadata = await this.resolveMetadata({
      type_id: type.id,
      license_id: null,
      topic_id: null,
      subject_code: input.subject_code,
    } as LearningResourceInput);
    const created = await this.system
      .insertInto('learning_resources')
      .values({
        title: input.title.slice(0, 300),
        description: 'Bản nháp do trợ lý AI soạn, cần giáo viên kiểm tra trước khi dùng',
        type_id: type.id,
        school_level: input.school_level,
        grade_level_code: input.grade_level_code,
        subject_code: input.subject_code,
        ...metadata,
        keywords: ['do AI soạn'],
        author_name: context.name,
        duration_minutes: input.duration_minutes,
        visibility: 'private',
        owner_user_id: context.userId,
        owner_name: context.name,
        department_id: context.staffDepartmentId,
        department_name: context.staffDepartmentName,
        ai_generated: true,
        ai_request_id: input.requestId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    const body = Buffer.from(input.markdown, 'utf8');
    const key = storageKey('learning-resources', created.id, randomUUID());
    await this.fileStorage.put(key, body, 'text/markdown');
    try {
      await this.addVersion(
        created,
        {
          kind: 'file',
          storage_key: key,
          file_name: 'ke-hoach-bai-day-ai.md',
          content_type: 'text/markdown',
          size_bytes: body.length,
          sha256: createHash('sha256').update(body).digest('hex'),
          note: 'Do trợ lý AI soạn',
        },
        context.userId,
      );
    } catch (error) {
      await this.fileStorage.delete(key).catch(() => undefined);
      await this.system.deleteFrom('learning_resources').where('id', '=', created.id).execute();
      throw error;
    }
    return this.findResource(created.id);
  }

  async addLink(currentUser: CurrentUser, id: string, body: RequestBody) {
    const context = await this.context(currentUser);
    const row = await this.findResource(id);
    this.assertOwner(context, row);
    this.assertEditable(row);
    const url = parseExternalLink(body?.url);
    const title = typeof body?.link_title === 'string' ? body.link_title.trim().slice(0, 300) || null : null;
    return this.addVersion(row, { kind: 'link', url, link_title: title }, context.userId);
  }

  // Kế hoạch bài dạy ở năm học hiện hành đưa vào kho bằng tham chiếu: chỉ kế hoạch của chính người sở hữu
  async addLessonPlan(currentUser: CurrentUser, id: string, lessonPlanId: string) {
    const context = await this.context(currentUser);
    const row = await this.findResource(id);
    this.assertOwner(context, row);
    this.assertEditable(row);
    const database = this.requireYear(context);
    const plan = await database
      .selectFrom('lesson_plans')
      .select(['id', 'teacher_id'])
      .where('id', '=', lessonPlanId)
      .executeTakeFirst();
    if (!plan || plan.teacher_id !== context.userId) {
      throw notFoundError('Không tìm thấy kế hoạch bài dạy của bạn', 'lesson_plan');
    }
    return this.addVersion(
      row,
      { kind: 'lesson_plan', lesson_plan_id: plan.id, lesson_plan_database: context.year?.databaseName ?? null },
      context.userId,
    );
  }

  async submit(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    this.requireYear(context);
    const row = await this.findResource(id);
    this.assertOwner(context, row);
    if (row.status === 'pending_unit' || row.status === 'pending_school') {
      throw resourceRule('Học liệu đang chờ duyệt');
    }
    if (row.status === 'retired' || row.status === 'hidden') {
      throw resourceRule('Học liệu đã ngừng dùng hoặc đang ẩn tạm');
    }
    if (row.status === 'published' && row.published_version === row.current_version) {
      throw resourceRule('Phiên bản hiện tại đã công bố; thêm phiên bản mới để gửi duyệt lại');
    }
    const license = row.license_id
      ? await this.system
          .selectFrom('resource_licenses')
          .selectAll()
          .where('id', '=', row.license_id)
          .executeTakeFirst()
      : undefined;
    const problems = submitProblems({
      hasVersion: row.current_version > 0,
      visibility: row.visibility,
      license: license ?? null,
      licenseSource: row.license_source,
    });
    if (problems.length > 0) {
      throw resourceRule(problems.join('; '));
    }
    const [type, version] = await Promise.all([
      this.system.selectFrom('resource_types').selectAll().where('id', '=', row.type_id).executeTakeFirstOrThrow(),
      this.system
        .selectFrom('learning_resource_versions')
        .select('kind')
        .where('resource_id', '=', id)
        .where('version_no', '=', row.current_version)
        .executeTakeFirstOrThrow(),
    ]);
    const school = needsSchoolReview({
      typeCode: type.code,
      typeRequiresSchool: type.requires_school_review,
      versionKind: version.kind,
      licenseRequiresGrant: license?.requires_grant_source ?? false,
    });
    const updated = await this.system
      .updateTable('learning_resources')
      .set({
        status: row.department_id ? 'pending_unit' : 'pending_school',
        needs_school_review: school,
        submitted_at: this.clock.now(),
        return_note: null,
        updated_at: this.clock.now(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.event(context, id, 'submit', row.current_version, null);
    return updated;
  }

  async review(currentUser: CurrentUser, id: string, decision: 'approve' | 'return', note: string | null) {
    const context = await this.context(currentUser);
    this.requireYear(context);
    const row = await this.findResource(id);
    if (row.status !== 'pending_unit' && row.status !== 'pending_school') {
      throw resourceRule('Học liệu không ở trạng thái chờ duyệt');
    }
    if (!this.reviewsStep(context, row)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không phải người duyệt của bước này');
    }
    const now = this.clock.now();
    if (decision === 'return') {
      if (!note) {
        throw validationError([{ field: 'note', message: 'Bắt buộc ghi lý do trả lại' }]);
      }
      const updated = await this.system
        .updateTable('learning_resources')
        .set({
          status: row.published_version !== null ? 'published' : 'returned',
          return_note: note,
          updated_at: now,
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.event(context, id, 'return', row.current_version, note);
      return updated;
    }
    const stepAction: LearningResourceAction = row.status === 'pending_unit' ? 'unit_approve' : 'school_approve';
    const publish = row.status === 'pending_school' || !row.needs_school_review;
    const updated = await this.system
      .updateTable('learning_resources')
      .set(
        publish
          ? {
              status: 'published',
              published_version: row.current_version,
              published_at: now,
              return_note: null,
              updated_at: now,
            }
          : { status: 'pending_school', updated_at: now },
      )
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.event(context, id, stepAction, row.current_version, note);
    if (publish) {
      await this.event(context, id, 'publish', row.current_version, null);
    }
    return updated;
  }

  async setLifecycle(currentUser: CurrentUser, id: string, action: 'hide' | 'restore' | 'retire', note: string | null) {
    const context = await this.context(currentUser);
    const row = await this.visibleResource(context, id);
    let status: LearningResourceStatus;
    if (action === 'retire') {
      if (row.owner_user_id !== context.userId && !context.canManage) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người sở hữu hoặc thủ kho ngừng dùng học liệu');
      }
      if (row.status === 'retired') {
        throw resourceRule('Học liệu đã ngừng dùng');
      }
      status = 'retired';
    } else {
      if (!context.canManage) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ thủ kho ẩn tạm, mở lại học liệu');
      }
      if (action === 'hide' && row.status === 'hidden') {
        throw resourceRule('Học liệu đang ẩn tạm');
      }
      if (action === 'restore' && row.status !== 'hidden') {
        throw resourceRule('Chỉ mở lại học liệu đang ẩn tạm');
      }
      status = action === 'hide' ? 'hidden' : row.published_version !== null ? 'published' : 'draft';
    }
    const updated = await this.system
      .updateTable('learning_resources')
      .set({ status, updated_at: this.clock.now() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.event(context, id, action, row.current_version, note);
    return updated;
  }

  // ---- Tìm, xem, tải ----

  private listQuery() {
    return this.system
      .selectFrom('learning_resources')
      .innerJoin('resource_types', 'resource_types.id', 'learning_resources.type_id')
      .leftJoin('resource_licenses', 'resource_licenses.id', 'learning_resources.license_id')
      .leftJoin('resource_topics', 'resource_topics.id', 'learning_resources.topic_id')
      .selectAll('learning_resources')
      .select([
        'resource_types.name as type_name',
        'resource_types.code as type_code',
        'resource_licenses.name as license_name',
        'resource_licenses.code as license_code',
        'resource_topics.name as topic_name',
      ]);
  }

  async search(
    currentUser: CurrentUser,
    filter: {
      q: string | null;
      type_id: string | null;
      school_level: string | null;
      grade_level_code: string | null;
      subject_code: string | null;
      topic_id: string | null;
      license_id: string | null;
      scope: 'all' | 'mine' | 'review';
    },
  ) {
    const context = await this.context(currentUser);
    let query = this.listQuery();
    if (filter.scope === 'mine') {
      query = query.where('learning_resources.owner_user_id', '=', context.userId);
    } else if (filter.scope === 'review') {
      query = query.where('learning_resources.status', 'in', ['pending_unit', 'pending_school']);
    } else {
      // Kho chung: đã công bố (phạm vi trường; tổ của mình), cộng học liệu của mình
      query = query.where((expression) =>
        expression.or([
          expression('learning_resources.owner_user_id', '=', context.userId),
          expression.and([
            expression('learning_resources.published_version', 'is not', null),
            expression('learning_resources.status', 'not in', ['hidden', 'retired']),
            expression.or([
              expression('learning_resources.visibility', '=', 'school'),
              expression.and([
                expression('learning_resources.visibility', '=', 'unit'),
                expression('learning_resources.department_id', '=', context.staffDepartmentId ?? NO_ID),
              ]),
            ]),
          ]),
        ]),
      );
    }
    if (filter.q) {
      const pattern = `%${filter.q.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      query = query.where((expression) =>
        expression.or([
          expression('learning_resources.title', 'ilike', pattern),
          expression('learning_resources.description', 'ilike', pattern),
          expression('learning_resources.author_name', 'ilike', pattern),
          expression(sql<string>`array_to_string(learning_resources.keywords, ' ')`, 'ilike', pattern),
        ]),
      );
    }
    for (const [column, value] of [
      ['learning_resources.type_id', filter.type_id],
      ['learning_resources.school_level', filter.school_level],
      ['learning_resources.grade_level_code', filter.grade_level_code],
      ['learning_resources.subject_code', filter.subject_code],
      ['learning_resources.topic_id', filter.topic_id],
      ['learning_resources.license_id', filter.license_id],
    ] as const) {
      if (value) {
        query = query.where(column, '=', value);
      }
    }
    const rows = await query.orderBy('learning_resources.updated_at', 'desc').limit(500).execute();
    return rows
      .filter((row) => filter.scope !== 'review' || this.reviewsStep(context, row))
      .map((row) => ({
        ...row,
        can_review: this.reviewsStep(context, row),
        is_owner: row.owner_user_id === context.userId,
      }));
  }

  async detail(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const row = await this.visibleResource(context, id);
    const full = await this.listQuery().where('learning_resources.id', '=', id).executeTakeFirstOrThrow();
    const ownerView = row.owner_user_id === context.userId || context.canManage || this.reviewsStep(context, row);
    let versions = await this.system
      .selectFrom('learning_resource_versions')
      .select([
        'id',
        'version_no',
        'kind',
        'file_name',
        'content_type',
        'size_bytes',
        'sha256',
        'url',
        'link_title',
        'lesson_plan_id',
        'note',
        'created_at',
      ])
      .where('resource_id', '=', id)
      .orderBy('version_no', 'desc')
      .execute();
    if (!ownerView) {
      versions = versions.filter((version) => version.version_no === row.published_version);
    }
    const events = context.year
      ? await context.year.database
          .selectFrom('learning_resource_events')
          .select(['action', 'version_no', 'note', 'actor_name', 'created_at'])
          .where('resource_id', '=', id)
          .orderBy('created_at')
          .execute()
      : [];
    const usage = context.year
      ? await context.year.database
          .selectFrom('learning_resource_usage')
          .select(['kind', (expression) => expression.fn.countAll<string>().as('count')])
          .where('resource_id', '=', id)
          .groupBy('kind')
          .execute()
      : [];
    if (context.year && row.owner_user_id !== context.userId) {
      await context.year.database
        .insertInto('learning_resource_usage')
        .values({ resource_id: id, kind: 'view', user_id: context.userId })
        .execute();
    }
    return {
      resource: { ...full, can_review: this.reviewsStep(context, row), is_owner: row.owner_user_id === context.userId },
      versions,
      events: ownerView ? events : [],
      views: Number(usage.find((item) => item.kind === 'view')?.count ?? 0),
      downloads: Number(usage.find((item) => item.kind === 'download')?.count ?? 0),
    };
  }

  // Tải bản đã công bố (người sở hữu, người duyệt, thủ kho tải được mọi phiên bản)
  async download(currentUser: CurrentUser, id: string, versionNo: number | null) {
    const context = await this.context(currentUser);
    const row = await this.visibleResource(context, id);
    const ownerView = row.owner_user_id === context.userId || context.canManage || this.reviewsStep(context, row);
    const wanted = versionNo ?? (ownerView ? row.current_version : row.published_version);
    if (wanted === null || (!ownerView && wanted !== row.published_version)) {
      throw notFoundError('Không tìm thấy phiên bản', 'learning_resource_version');
    }
    const version = await this.system
      .selectFrom('learning_resource_versions')
      .selectAll()
      .where('resource_id', '=', id)
      .where('version_no', '=', wanted)
      .executeTakeFirst();
    if (!version) {
      throw notFoundError('Không tìm thấy phiên bản', 'learning_resource_version');
    }
    if (context.year && row.owner_user_id !== context.userId) {
      await context.year.database
        .insertInto('learning_resource_usage')
        .values({ resource_id: id, kind: 'download', user_id: context.userId })
        .execute();
    }
    if (version.kind === 'file' && version.storage_key) {
      return {
        kind: 'file' as const,
        buffer: await this.fileStorage.get(version.storage_key),
        contentType: version.content_type ?? 'application/octet-stream',
        fileName: version.file_name ?? 'hoc-lieu',
      };
    }
    if (version.kind === 'link') {
      return { kind: 'link' as const, url: version.url, link_title: version.link_title };
    }
    const plan =
      version.lesson_plan_database && version.lesson_plan_id
        ? await this.databases
            .schoolYear<SchoolYearDatabase>(version.lesson_plan_database)
            .selectFrom('lesson_plans')
            .innerJoin('lessons', 'lessons.id', 'lesson_plans.lesson_id')
            .select([
              'lessons.name as lesson_name',
              'lesson_plans.planned_date',
              'lesson_plans.activities',
              'lesson_plans.duration_minutes',
              'lesson_plans.materials',
              'lesson_plans.teacher_name',
              'lesson_plans.status',
            ])
            .where('lesson_plans.id', '=', version.lesson_plan_id)
            .executeTakeFirst()
        : undefined;
    return { kind: 'lesson_plan' as const, lesson_plan: plan ?? null };
  }

  // ---- Bộ sưu tập ----

  async visibleCollection(context: ResourceContext, id: string) {
    const collection = await this.system
      .selectFrom('resource_collections')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    const visible =
      collection &&
      (collection.owner_user_id === context.userId ||
        context.canManage ||
        collection.visibility === 'school' ||
        (collection.visibility === 'unit' &&
          collection.department_id !== null &&
          collection.department_id === context.staffDepartmentId));
    if (!collection || !visible) {
      throw notFoundError('Không tìm thấy bộ sưu tập', 'resource_collection');
    }
    return collection;
  }

  async collections(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    const rows = await this.system
      .selectFrom('resource_collections')
      .selectAll('resource_collections')
      .select((expression) =>
        expression
          .selectFrom('resource_collection_items')
          .select(expression.fn.countAll<string>().as('count'))
          .whereRef('resource_collection_items.collection_id', '=', 'resource_collections.id')
          .as('items'),
      )
      .where((expression) =>
        expression.or([
          expression('owner_user_id', '=', context.userId),
          expression('visibility', '=', 'school'),
          expression.and([
            expression('visibility', '=', 'unit'),
            expression('department_id', '=', context.staffDepartmentId ?? NO_ID),
          ]),
        ]),
      )
      .orderBy('updated_at', 'desc')
      .execute();
    return rows.map((row) => ({
      ...row,
      items: Number(row.items ?? 0),
      is_owner: row.owner_user_id === context.userId,
    }));
  }

  async saveCollection(currentUser: CurrentUser, id: string | null, body: RequestBody) {
    const context = await this.context(currentUser);
    const errors: FieldError[] = [];
    const name = readOptionalText(body, 'name', errors);
    if ((id === null && !name) || (name && name.length > 300)) {
      errors.push({ field: 'name', message: 'Tên bộ sưu tập từ 1 đến 300 ký tự' });
    }
    const description = readOptionalText(body, 'description', errors);
    const visibility = body?.visibility;
    if (visibility !== undefined && visibility !== 'private' && visibility !== 'unit' && visibility !== 'school') {
      errors.push({ field: 'visibility', message: 'Phạm vi là private, unit hoặc school' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    if (id === null) {
      return this.system
        .insertInto('resource_collections')
        .values({
          name: name as string,
          description: description ?? null,
          visibility: (visibility ?? 'private') as 'private' | 'unit' | 'school',
          owner_user_id: context.userId,
          owner_name: context.name,
          department_id: context.staffDepartmentId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    const collection = await this.visibleCollection(context, id);
    if (collection.owner_user_id !== context.userId) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người lập sửa được bộ sưu tập');
    }
    return this.system
      .updateTable('resource_collections')
      .set({
        ...(name ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(visibility !== undefined ? { visibility: visibility as 'private' | 'unit' | 'school' } : {}),
        updated_at: this.clock.now(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async deleteCollection(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const collection = await this.visibleCollection(context, id);
    if (collection.owner_user_id !== context.userId && !context.canManage) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người lập xoá được bộ sưu tập');
    }
    await this.system.deleteFrom('resource_collections').where('id', '=', id).execute();
  }

  async collection(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const collection = await this.visibleCollection(context, id);
    const items = await this.listQuery()
      .innerJoin('resource_collection_items', 'resource_collection_items.resource_id', 'learning_resources.id')
      .select('resource_collection_items.position')
      .where('resource_collection_items.collection_id', '=', id)
      .orderBy('resource_collection_items.position')
      .execute();
    return {
      collection: { ...collection, is_owner: collection.owner_user_id === context.userId },
      items: items.filter((item) => this.canSee(context, item)),
    };
  }

  // Thay danh sách học liệu theo thứ tự gửi lên (thêm, bỏ, sắp xếp một lần); chỉ học liệu người lập thấy được
  async setCollectionItems(currentUser: CurrentUser, id: string, resourceIds: string[]) {
    const context = await this.context(currentUser);
    const collection = await this.visibleCollection(context, id);
    if (collection.owner_user_id !== context.userId) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người lập sửa được bộ sưu tập');
    }
    if (new Set(resourceIds).size !== resourceIds.length || resourceIds.length > 500) {
      throw validationError([{ field: 'resource_ids', message: 'Danh sách học liệu không trùng, tối đa 500' }]);
    }
    const rows = resourceIds.length
      ? await this.system.selectFrom('learning_resources').selectAll().where('id', 'in', resourceIds).execute()
      : [];
    const invisible = resourceIds.filter((resourceId) => {
      const row = rows.find((item) => item.id === resourceId);
      return !row || !this.canSee(context, row);
    });
    if (invisible.length > 0) {
      throw validationError([{ field: 'resource_ids', message: 'Có học liệu không tồn tại hoặc bạn không xem được' }]);
    }
    await this.system.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('resource_collection_items').where('collection_id', '=', id).execute();
      if (resourceIds.length > 0) {
        await transaction
          .insertInto('resource_collection_items')
          .values(
            resourceIds.map((resourceId, index) => ({
              collection_id: id,
              resource_id: resourceId,
              position: index + 1,
            })),
          )
          .execute();
      }
      await transaction
        .updateTable('resource_collections')
        .set({ updated_at: this.clock.now() })
        .where('id', '=', id)
        .execute();
    });
    return this.collection(currentUser, id);
  }

  async exportCollection(currentUser: CurrentUser, id: string) {
    const detail = await this.collection(currentUser, id);
    const buffer = await buildTableFile(
      'xlsx',
      [
        {
          title: 'Bộ sưu tập',
          heading: [detail.collection.name],
          numbered: true,
          columns: [
            { key: 'title', label: 'Tiêu đề', width: 40 },
            { key: 'type_name', label: 'Loại', width: 20 },
            { key: 'subject_name', label: 'Môn', width: 18 },
            { key: 'grade_level_code', label: 'Khối', width: 10 },
            { key: 'topic_name', label: 'Chủ đề', width: 24 },
            { key: 'license_name', label: 'Giấy phép', width: 30 },
            { key: 'owner_name', label: 'Người đóng góp', width: 22 },
          ],
          rows: detail.items,
        },
      ],
      this.clock.now(),
    );
    return { buffer, contentType: CONTENT_TYPES.xlsx, fileName: 'bo-suu-tap-hoc-lieu.xlsx' };
  }

  // ---- Báo lỗi ----

  async report(currentUser: CurrentUser, id: string, kind: LearningResourceReportKind, description: string) {
    const context = await this.context(currentUser);
    const database = this.requireYear(context);
    const row = await this.visibleResource(context, id);
    return database
      .insertInto('learning_resource_reports')
      .values({
        resource_id: id,
        resource_title: row.title,
        kind,
        description,
        reporter_user_id: context.userId,
        reporter_name: context.name,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  // Thủ kho thấy mọi báo lỗi; người khác thấy báo lỗi mình gửi và báo lỗi về học liệu của mình
  async reports(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    if (!context.year) {
      return [];
    }
    const rows = await context.year.database
      .selectFrom('learning_resource_reports')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();
    if (context.canManage) {
      return rows;
    }
    const own = await this.system
      .selectFrom('learning_resources')
      .select('id')
      .where('owner_user_id', '=', context.userId)
      .execute();
    const ownIds = new Set(own.map((item) => item.id));
    return rows.filter((row) => row.reporter_user_id === context.userId || ownIds.has(row.resource_id));
  }

  async handleReport(
    currentUser: CurrentUser,
    reportId: string,
    input: { status: 'resolved' | 'rejected'; response: string; hide: boolean },
  ) {
    const context = await this.context(currentUser);
    if (!context.canManage) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ thủ kho xử lý báo lỗi');
    }
    const database = this.requireYear(context);
    const report = await database
      .selectFrom('learning_resource_reports')
      .selectAll()
      .where('id', '=', reportId)
      .executeTakeFirst();
    if (!report) {
      throw notFoundError('Không tìm thấy báo lỗi', 'learning_resource_report');
    }
    if (report.status !== 'open') {
      throw resourceRule('Báo lỗi đã được xử lý');
    }
    const updated = await database
      .updateTable('learning_resource_reports')
      .set({
        status: input.status,
        response: input.response,
        handled_by_name: context.name,
        handled_at: this.clock.now(),
      })
      .where('id', '=', reportId)
      .returningAll()
      .executeTakeFirstOrThrow();
    if (input.hide) {
      const row = await this.findResource(report.resource_id);
      if (row.status !== 'hidden' && row.status !== 'retired') {
        await this.setLifecycle(currentUser, report.resource_id, 'hide', `Báo lỗi: ${input.response}`);
      }
    }
    return updated;
  }

  // ---- Thống kê ----

  async statistics(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    if (!context.canManage && !context.canApprove && !context.canReview) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ tổ trưởng, Ban Giám hiệu, thủ kho xem thống kê kho');
    }
    let query = this.listQuery().where('learning_resources.status', '!=', 'retired');
    if (!context.canManage && !context.canApprove) {
      query = query.where('learning_resources.department_id', '=', context.staffDepartmentId ?? NO_ID);
    }
    const rows = await query.execute();
    const count = <K extends string>(key: (row: (typeof rows)[number]) => K | null) => {
      const map = new Map<string, number>();
      for (const row of rows) {
        const value = key(row) ?? '';
        map.set(value, (map.get(value) ?? 0) + 1);
      }
      return [...map.entries()]
        .map(([label, total]) => ({ label: label || 'Chưa ghi', total }))
        .sort((a, b) => b.total - a.total);
    };
    const now = this.clock.now();
    const overdueBefore = new Date(now.getTime() - LEARNING_RESOURCE_REVIEW_DAYS * DAY);
    const today = VIETNAM_DATE.format(now);
    const soon = VIETNAM_DATE.format(new Date(now.getTime() + 30 * DAY));
    const ids = rows.map((row) => row.id);
    const usage =
      context.year && ids.length
        ? await context.year.database
            .selectFrom('learning_resource_usage')
            .select(['resource_id', 'kind', (expression) => expression.fn.countAll<string>().as('count')])
            .where('resource_id', 'in', ids)
            .groupBy(['resource_id', 'kind'])
            .execute()
        : [];
    const reports =
      context.year && ids.length
        ? await context.year.database
            .selectFrom('learning_resource_reports')
            .select(['resource_id', (expression) => expression.fn.countAll<string>().as('count')])
            .where('resource_id', 'in', ids)
            .groupBy('resource_id')
            .execute()
        : [];
    const usageOf = (id: string, kind: 'view' | 'download') =>
      Number(usage.find((item) => item.resource_id === id && item.kind === kind)?.count ?? 0);
    return {
      total: rows.length,
      published: rows.filter((row) => row.published_version !== null && row.status !== 'hidden').length,
      pending: rows.filter((row) => row.status === 'pending_unit' || row.status === 'pending_school').length,
      overdue: rows.filter(
        (row) =>
          (row.status === 'pending_unit' || row.status === 'pending_school') &&
          row.submitted_at !== null &&
          row.submitted_at < overdueBefore,
      ).length,
      license_expiring: rows
        .filter((row) => row.license_expires_on && row.license_expires_on >= today && row.license_expires_on <= soon)
        .map((row) => ({ id: row.id, title: row.title, license_expires_on: row.license_expires_on })),
      by_subject: count((row) => row.subject_name),
      by_grade: count((row) => row.grade_level_code),
      by_type: count((row) => row.type_name),
      by_license: count((row) => row.license_name),
      by_department: count((row) => row.department_name),
      contributors: count((row) => row.owner_name),
      top: rows
        .map((row) => ({
          id: row.id,
          title: row.title,
          views: usageOf(row.id, 'view'),
          downloads: usageOf(row.id, 'download'),
          reports: Number(reports.find((item) => item.resource_id === row.id)?.count ?? 0),
        }))
        .sort((a, b) => b.views + b.downloads - (a.views + a.downloads))
        .slice(0, 20),
    };
  }

  // ---- Việc của tôi ----

  async pendingWork(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    const pending =
      context.canReview || context.canApprove
        ? (
            await this.system
              .selectFrom('learning_resources')
              .selectAll()
              .where('status', 'in', ['pending_unit', 'pending_school'])
              .execute()
          ).filter((row) => this.reviewsStep(context, row))
        : [];
    const returned = await this.system
      .selectFrom('learning_resources')
      .select(['id', 'title', 'return_note', 'updated_at', 'status', 'published_version'])
      .where('owner_user_id', '=', context.userId)
      .where('return_note', 'is not', null)
      .where('status', 'in', ['returned', 'published'])
      .execute();
    const reports =
      context.canManage && context.year
        ? await context.year.database
            .selectFrom('learning_resource_reports')
            .select(['id', 'resource_title', 'kind', 'created_at'])
            .where('status', '=', 'open')
            .execute()
        : [];
    return { pending, returned, reports };
  }
}
