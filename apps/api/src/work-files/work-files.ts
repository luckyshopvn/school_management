import { Injectable } from '@nestjs/common';
import type {
  ArchiveRetention,
  SchoolYearDatabase,
  SystemDatabase,
  WorkFileSharePermission,
  WorkFileStatus,
} from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { sql, type Kysely, type Transaction } from 'kysely';
import { ArchivesService } from '../archives/archives.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser } from '../authentication/current-user.js';
import type { ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { queueNotification } from '../common/notification-queue.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { DocumentAdminService } from '../incoming-documents/document-admin.js';
import { IncomingDocumentsService } from '../incoming-documents/incoming-documents.js';
import { DIRECTIVE_RULE_CODE } from '../work/directive-fields.js';
import { readWorkText } from '../work/work-access.js';

// Hồ sơ công việc theo VNPT iOffice (DT-18 phần 18c, YCTD-141; quyết định của Eric ngày 2026-10-19): mỗi cán bộ lập hồ sơ
// cá nhân theo năm (ký hiệu, tiêu đề, thời hạn bảo quản), gom văn bản đến mình xem được, công việc mình giao hoặc được giao,
// ghi chú; chia sẻ cho người khác xem hoặc cùng cập nhật; chuyển giao cho người khác (người nhận thành chủ hồ sơ, hồ sơ hiện ở
// "Hồ sơ được chuyển giao"). Kết thúc hồ sơ rồi nộp lưu: văn thư lưu trữ (15h2) tiếp nhận thành hồ sơ tài liệu ở 5.10 với
// thời hạn bảo quản, hoặc trả về kèm lý do. Hồ sơ đã lưu có thời hạn mà quá năm bảo quản hiện ở "Hồ sơ hết hạn bảo quản".
// Trạng thái theo màn hình Quản lý hồ sơ lưu trữ của iOffice: Đang cập nhật, Đã hoàn thành, Đã bàn giao, Bị trả về, Đã lưu
// trữ. Chi tiết do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-141
type Executor = Kysely<SystemDatabase> | Transaction<SystemDatabase>;

const ARCHIVE_MANAGE = PERMISSION_CODES.archiveManage;
const ARCHIVE_VIEW = PERMISSION_CODES.archiveView;
export const WORK_FILE_BOXES = ['personal', 'shared', 'transferred', 'archive', 'expired'] as const;
export type WorkFileBox = (typeof WORK_FILE_BOXES)[number];
const EDITABLE: WorkFileStatus[] = ['open', 'returned'];

interface FileRow {
  id: string;
  code: string;
  title: string;
  year: number;
  owner_user_id: string;
  owner_name: string;
  status: WorkFileStatus;
  retention: ArchiveRetention;
  retention_years: number | null;
  org_unit_id: string | null;
  opened_on: string;
}

function readRetention(body: RequestBody, errors: FieldError[]) {
  const retention = (body?.retention ?? 'limited') as ArchiveRetention;
  if (retention !== 'permanent' && retention !== 'limited') {
    errors.push({ field: 'retention', message: 'Thời hạn bảo quản là permanent (vĩnh viễn) hoặc limited (có thời hạn)' });
  }
  const years = body?.retention_years;
  let retentionYears: number | null = null;
  if (retention === 'limited' && years !== undefined && years !== null && years !== '') {
    if (typeof years !== 'number' || !Number.isInteger(years) || years < 1 || years > 100) {
      errors.push({ field: 'retention_years', message: 'Số năm bảo quản là số nguyên từ 1 đến 100' });
    } else {
      retentionYears = years;
    }
  }
  return { retention, retention_years: retention === 'permanent' ? null : retentionYears };
}

export function parseWorkFile(body: RequestBody) {
  const errors: FieldError[] = [];
  const year = body?.year;
  if (typeof year !== 'number' || !Number.isInteger(year) || year < 1900 || year > 2200) {
    errors.push({ field: 'year', message: 'Năm là số từ 1900 đến 2200' });
  }
  const orgUnitId = body?.org_unit_id;
  if (orgUnitId !== undefined && orgUnitId !== null && orgUnitId !== '' && !isUuid(orgUnitId)) {
    errors.push({ field: 'org_unit_id', message: 'Mã không hợp lệ' });
  }
  const input = {
    code: readWorkText(body, 'code', errors, { required: true, maximum: 50 }) ?? '',
    title: readWorkText(body, 'title', errors, { required: true, maximum: 500 }) ?? '',
    year: typeof year === 'number' ? year : 0,
    description: readWorkText(body, 'description', errors, { maximum: 2000 }),
    org_unit_id: typeof orgUnitId === 'string' && orgUnitId !== '' ? orgUnitId : null,
    ...readRetention(body, errors),
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

// Năm hết hạn bảo quản: năm lưu cộng số năm; vĩnh viễn hoặc chưa ghi số năm thì không hết hạn
export function expiryYear(file: { retention: ArchiveRetention; retention_years: number | null; archived_on: string | null }) {
  if (file.retention !== 'limited' || !file.retention_years || !file.archived_on) {
    return null;
  }
  return Number(file.archived_on.slice(0, 4)) + file.retention_years;
}

@Injectable()
export class WorkFilesService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly admin: DocumentAdminService,
    private readonly incoming: IncomingDocumentsService,
    private readonly archives: ArchivesService,
    private readonly clock: Clock,
  ) {}

  private get system(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  private async event(executor: Executor, fileId: string, action: string, note: string | null, user: CurrentUser) {
    await executor
      .insertInto('work_file_events')
      .values({
        file_id: fileId,
        action,
        note: note?.slice(0, 2000) ?? null,
        actor_id: user.id,
        actor_name: user.description.full_name,
      })
      .execute();
  }

  private async notify(userIds: string[], title: string, body: string, fileId: string) {
    const recipients = [...new Set(userIds)];
    const current = await this.currentSchoolYear.find();
    if (!current || recipients.length === 0) {
      return;
    }
    await queueNotification(current.database as Kysely<SchoolYearDatabase>, {
      orgUnitId: null,
      templateCode: 'work_file',
      title,
      body: body.slice(0, 1000),
      targetType: 'work_file',
      targetId: fileId,
      recipients: recipients.map((userId) => ({ userId, channel: 'in_app' })),
    });
  }

  // Quyền với một hồ sơ: chủ hồ sơ toàn quyền; người được chia sẻ xem hoặc cập nhật thành phần; văn thư lưu trữ xem hồ sơ
  // đã nộp lưu, đã lưu
  private async access(executor: Executor, currentUser: CurrentUser, id: string) {
    const file = (await executor
      .selectFrom('work_files')
      .select([
        'id',
        'code',
        'title',
        'year',
        'owner_user_id',
        'owner_name',
        'status',
        'retention',
        'retention_years',
        'org_unit_id',
        'opened_on',
      ])
      .where('id', '=', id)
      .executeTakeFirst()) as FileRow | undefined;
    if (!file) {
      throw notFoundError('Không tìm thấy hồ sơ công việc', 'work_file');
    }
    const owner = file.owner_user_id === currentUser.id;
    const share = owner
      ? undefined
      : await executor
          .selectFrom('work_file_shares')
          .select('permission')
          .where('file_id', '=', id)
          .where('user_id', '=', currentUser.id)
          .executeTakeFirst();
    const archivist =
      ['submitted', 'archived', 'returned'].includes(file.status) &&
      (currentUser.hasPermission(ARCHIVE_MANAGE) || currentUser.hasPermission(ARCHIVE_VIEW));
    if (!owner && !share && !archivist) {
      throw notFoundError('Không tìm thấy hồ sơ công việc', 'work_file');
    }
    return { file, owner, canEditItems: owner || share?.permission === 'edit' };
  }

  async list(currentUser: CurrentUser, box: WorkFileBox, filter: { year: number | null; search: string | null }) {
    let query = this.system.selectFrom('work_files').selectAll('work_files');
    if (box === 'personal') {
      query = query.where('owner_user_id', '=', currentUser.id).where('transferred_from_user_id', 'is', null);
    } else if (box === 'transferred') {
      query = query.where('owner_user_id', '=', currentUser.id).where('transferred_from_user_id', 'is not', null);
    } else if (box === 'shared') {
      query = query
        .innerJoin('work_file_shares', 'work_file_shares.file_id', 'work_files.id')
        .where('work_file_shares.user_id', '=', currentUser.id)
        .select('work_file_shares.permission as share_permission');
    } else if (box === 'archive') {
      if (!currentUser.hasPermission(ARCHIVE_MANAGE)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Cần quyền quản lý văn thư lưu trữ');
      }
      query = query.where('status', 'in', ['submitted', 'archived', 'returned']);
    } else {
      if (!currentUser.hasPermission(ARCHIVE_MANAGE) && !currentUser.hasPermission(ARCHIVE_VIEW)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Cần quyền xem văn thư lưu trữ');
      }
      const year = Number(this.today().slice(0, 4));
      query = query
        .where('status', '=', 'archived')
        .where('retention', '=', 'limited')
        .where('retention_years', 'is not', null)
        .where(sql<boolean>`date_part('year', archived_on) + retention_years < ${year}`);
    }
    if (filter.year) {
      query = query.where('work_files.year', '=', filter.year);
    }
    if (filter.search) {
      const pattern = `%${filter.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      query = query.where((expression) =>
        expression.or([expression('work_files.title', 'ilike', pattern), expression('work_files.code', 'ilike', pattern)]),
      );
    }
    const rows = await query.orderBy('work_files.year', 'desc').orderBy('work_files.code').limit(1000).execute();
    const counts = rows.length
      ? await this.system
          .selectFrom('work_file_items')
          .select(['file_id', (expression) => expression.fn.countAll<string>().as('count')])
          .where(
            'file_id',
            'in',
            rows.map((row) => row.id),
          )
          .groupBy('file_id')
          .execute()
      : [];
    const archiveCodes = await this.archiveCodes(rows.map((row) => row.archive_record_id));
    return rows.map((row) => ({
      ...row,
      item_count: Number(counts.find((count) => count.file_id === row.id)?.count ?? 0),
      archive_record_code: row.archive_record_id ? (archiveCodes.get(row.archive_record_id) ?? null) : null,
      expiry_year: expiryYear(row),
    }));
  }

  private async archiveCodes(ids: Array<string | null>) {
    const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
    if (wanted.length === 0) {
      return new Map<string, string>();
    }
    const rows = await this.system.selectFrom('archive_records').select(['id', 'code']).where('id', 'in', wanted).execute();
    return new Map(rows.map((row) => [row.id, row.code]));
  }

  async detail(currentUser: CurrentUser, id: string) {
    const { owner, canEditItems } = await this.access(this.system, currentUser, id);
    const file = await this.system.selectFrom('work_files').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
    const items = await this.system
      .selectFrom('work_file_items')
      .leftJoin('incoming_documents', 'incoming_documents.id', 'work_file_items.incoming_document_id')
      .selectAll('work_file_items')
      .select([
        'incoming_documents.symbol as document_symbol',
        'incoming_documents.arrival_number as document_arrival_number',
        'incoming_documents.status as document_status',
      ])
      .where('work_file_items.file_id', '=', id)
      .orderBy('work_file_items.created_at')
      .execute();
    const shares = await this.system
      .selectFrom('work_file_shares')
      .select(['user_id', 'user_name', 'permission'])
      .where('file_id', '=', id)
      .orderBy('user_name')
      .execute();
    const events = await this.system
      .selectFrom('work_file_events')
      .select(['id', 'action', 'note', 'actor_name', 'created_at'])
      .where('file_id', '=', id)
      .orderBy('created_at')
      .execute();
    const archiveCodes = await this.archiveCodes([file.archive_record_id]);
    const editable = EDITABLE.includes(file.status);
    return {
      ...file,
      archive_record_code: file.archive_record_id ? (archiveCodes.get(file.archive_record_id) ?? null) : null,
      expiry_year: expiryYear(file),
      items,
      shares: owner ? shares : [],
      events,
      is_owner: owner,
      can_edit: owner && editable,
      can_edit_items: canEditItems && editable,
      can_close: owner && editable,
      can_reopen: owner && file.status === 'closed',
      can_submit: owner && file.status === 'closed',
      can_accept: file.status === 'submitted' && currentUser.hasPermission(ARCHIVE_MANAGE),
    };
  }

  async create(currentUser: CurrentUser, body: RequestBody) {
    const input = parseWorkFile(body);
    try {
      const created = await this.system.transaction().execute(async (transaction) => {
        const row = await transaction
          .insertInto('work_files')
          .values({
            ...input,
            owner_user_id: currentUser.id,
            owner_name: currentUser.description.full_name,
            opened_on: this.today(),
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await this.event(transaction, row.id, 'create', input.title, currentUser);
        return row;
      });
      return this.detail(currentUser, created.id);
    } catch (error) {
      throw conflictOf(error);
    }
  }

  async update(currentUser: CurrentUser, id: string, body: RequestBody) {
    const { file, owner } = await this.access(this.system, currentUser, id);
    if (!owner || !EDITABLE.includes(file.status)) {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Chỉ chủ hồ sơ sửa hồ sơ đang cập nhật hoặc bị trả về');
    }
    const input = parseWorkFile(body);
    try {
      await this.system.transaction().execute(async (transaction) => {
        await transaction
          .updateTable('work_files')
          .set({ ...input, updated_at: this.clock.now() })
          .where('id', '=', id)
          .execute();
        await this.event(transaction, id, 'update', null, currentUser);
      });
    } catch (error) {
      throw conflictOf(error);
    }
    return this.detail(currentUser, id);
  }

  async remove(currentUser: CurrentUser, id: string) {
    const { file, owner } = await this.access(this.system, currentUser, id);
    if (!owner || !EDITABLE.includes(file.status)) {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Chỉ chủ hồ sơ xóa hồ sơ chưa kết thúc, chưa nộp lưu');
    }
    await this.system.deleteFrom('work_files').where('id', '=', id).execute();
  }

  // ---- Thành phần hồ sơ: văn bản đến, công việc, ghi chú ----

  async addItem(currentUser: CurrentUser, id: string, body: RequestBody) {
    const { file, canEditItems } = await this.access(this.system, currentUser, id);
    if (!canEditItems || !EDITABLE.includes(file.status)) {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Hồ sơ đã kết thúc hoặc bạn chỉ được xem');
    }
    const errors: FieldError[] = [];
    const type = body?.item_type;
    const note = readWorkText(body, 'note', errors, { maximum: 2000 });
    let title = readWorkText(body, 'title', errors, { maximum: 500 });
    let documentId: string | null = null;
    let taskId: string | null = null;
    if (type === 'incoming_document') {
      if (!isUuid(body?.incoming_document_id)) {
        errors.push({ field: 'incoming_document_id', message: 'Chọn văn bản đến' });
      } else {
        documentId = body.incoming_document_id;
      }
    } else if (type === 'task') {
      if (!isUuid(body?.task_id)) {
        errors.push({ field: 'task_id', message: 'Chọn công việc' });
      } else {
        taskId = body.task_id;
      }
    } else if (type === 'note') {
      if (!title) {
        errors.push({ field: 'title', message: 'Bắt buộc nhập' });
      }
    } else {
      errors.push({ field: 'item_type', message: 'Thành phần là incoming_document, task hoặc note' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    if (documentId) {
      // Chỉ thêm văn bản mình xem được
      const document = await this.incoming.assertVisible(currentUser, documentId);
      title = `${document.symbol} – ${document.summary}`.slice(0, 500);
    }
    if (taskId) {
      title = await this.taskTitle(currentUser, taskId);
    }
    const duplicate = await this.system
      .selectFrom('work_file_items')
      .select('id')
      .where('file_id', '=', id)
      .where((expression) =>
        documentId
          ? expression('incoming_document_id', '=', documentId)
          : taskId
            ? expression('task_id', '=', taskId)
            : expression.val(false),
      )
      .executeTakeFirst();
    if (duplicate) {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Thành phần này đã có trong hồ sơ');
    }
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('work_file_items')
        .values({
          file_id: id,
          item_type: type as 'incoming_document' | 'task' | 'note',
          incoming_document_id: documentId,
          task_id: taskId,
          title: title as string,
          note,
          added_by: currentUser.id,
          added_by_name: currentUser.description.full_name,
        })
        .execute();
      await this.event(transaction, id, 'item_add', title, currentUser);
    });
    if (documentId) {
      await this.incoming.recordEvent(currentUser, documentId, 'work_file', `Hồ sơ công việc ${file.code}`);
    }
    return this.detail(currentUser, id);
  }

  // Công việc thêm vào hồ sơ: việc mình giao, mình là lãnh đạo giao việc, mình nhận (cá nhân) hoặc việc cá nhân của mình
  private async taskTitle(currentUser: CurrentUser, taskId: string): Promise<string> {
    const { database } = await this.currentSchoolYear.require();
    const staff = await database.selectFrom('staff').select('id').where('user_id', '=', currentUser.id).executeTakeFirst();
    const task = await database
      .selectFrom('tasks')
      .select(['title'])
      .where('id', '=', taskId)
      .where((expression) =>
        expression.or([
          expression('assigner_user_id', '=', currentUser.id),
          expression('leader_user_id', '=', currentUser.id),
          ...(staff
            ? [
                expression('assignee_staff_id', '=', staff.id),
                expression.exists(
                  expression
                    .selectFrom('task_assignments')
                    .select('task_assignments.id')
                    .whereRef('task_assignments.task_id', '=', 'tasks.id')
                    .where('task_assignments.staff_id', '=', staff.id),
                ),
              ]
            : []),
        ]),
      )
      .executeTakeFirst();
    if (!task) {
      throw validationError([{ field: 'task_id', message: 'Không tìm thấy công việc của bạn' }]);
    }
    return task.title.slice(0, 500);
  }

  async removeItem(currentUser: CurrentUser, id: string, itemId: string) {
    const { file, canEditItems } = await this.access(this.system, currentUser, id);
    if (!canEditItems || !EDITABLE.includes(file.status)) {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Hồ sơ đã kết thúc hoặc bạn chỉ được xem');
    }
    const item = await this.system
      .deleteFrom('work_file_items')
      .where('id', '=', itemId)
      .where('file_id', '=', id)
      .returning('title')
      .executeTakeFirst();
    if (!item) {
      throw notFoundError('Không tìm thấy thành phần hồ sơ', 'work_file_item');
    }
    await this.event(this.system, id, 'item_remove', item.title, currentUser);
    return this.detail(currentUser, id);
  }

  // ---- Chia sẻ, chuyển giao ----

  async share(currentUser: CurrentUser, id: string, body: RequestBody) {
    const { owner } = await this.access(this.system, currentUser, id);
    if (!owner) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ chủ hồ sơ chia sẻ được');
    }
    const shares = body?.shares;
    if (
      !Array.isArray(shares) ||
      shares.length > 200 ||
      shares.some(
        (share) =>
          !isUuid((share as RequestBody)?.user_id) ||
          !['view', 'edit', undefined].includes((share as RequestBody)?.permission as string | undefined),
      )
    ) {
      throw validationError([{ field: 'shares', message: 'Danh sách chia sẻ không hợp lệ' }]);
    }
    const wanted = new Map(
      (shares as Array<{ user_id: string; permission?: WorkFileSharePermission }>)
        .filter((share) => share.user_id !== currentUser.id)
        .map((share) => [share.user_id, share.permission ?? 'view']),
    );
    const accounts = await this.admin.resolveAccounts([...wanted.keys()], 'shares');
    const before = await this.system.selectFrom('work_file_shares').select('user_id').where('file_id', '=', id).execute();
    await this.system.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('work_file_shares').where('file_id', '=', id).execute();
      if (wanted.size > 0) {
        await transaction
          .insertInto('work_file_shares')
          .values(
            [...wanted].map(([userId, permission]) => ({
              file_id: id,
              user_id: userId,
              user_name: accounts.get(userId)?.full_name ?? '',
              permission,
            })),
          )
          .execute();
      }
      await this.event(transaction, id, 'share', `${wanted.size} người`, currentUser);
    });
    const added = [...wanted.keys()].filter((userId) => !before.some((row) => row.user_id === userId));
    const file = await this.system.selectFrom('work_files').select(['title']).where('id', '=', id).executeTakeFirstOrThrow();
    await this.notify(added, 'Hồ sơ công việc được chia sẻ', `${currentUser.description.full_name} chia sẻ hồ sơ: ${file.title}`, id);
    return this.detail(currentUser, id);
  }

  async transfer(currentUser: CurrentUser, id: string, body: RequestBody) {
    const { file, owner } = await this.access(this.system, currentUser, id);
    if (!owner) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ chủ hồ sơ chuyển giao được');
    }
    if (file.status === 'submitted' || file.status === 'archived') {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Hồ sơ đã nộp lưu, không chuyển giao được');
    }
    const errors: FieldError[] = [];
    const note = readWorkText(body, 'note', errors, { maximum: 1000 });
    if (!isUuid(body?.user_id)) {
      errors.push({ field: 'user_id', message: 'Chọn người nhận hồ sơ' });
    } else if (body.user_id === currentUser.id) {
      errors.push({ field: 'user_id', message: 'Chọn người khác' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const receiverId = body?.user_id as string;
    const receiver = (await this.admin.resolveAccounts([receiverId], 'user_id')).get(receiverId);
    try {
      await this.system.transaction().execute(async (transaction) => {
        await transaction
          .updateTable('work_files')
          .set({
            owner_user_id: receiverId,
            owner_name: receiver?.full_name ?? '',
            transferred_from_user_id: currentUser.id,
            transferred_from_name: currentUser.description.full_name,
            transferred_at: this.clock.now(),
            transfer_note: note,
            updated_at: this.clock.now(),
          })
          .where('id', '=', id)
          .execute();
        // Người nhận là chủ mới nên bỏ dòng chia sẻ của họ nếu có
        await transaction
          .deleteFrom('work_file_shares')
          .where('file_id', '=', id)
          .where('user_id', '=', receiverId)
          .execute();
        await this.event(transaction, id, 'transfer', `Chuyển giao cho ${receiver?.full_name ?? ''}${note ? `: ${note}` : ''}`, currentUser);
      });
    } catch (error) {
      throw conflictOf(error);
    }
    await this.notify([receiverId], 'Bạn được chuyển giao hồ sơ công việc', `${file.code} – ${file.title}`, id);
    return { id, owner_name: receiver?.full_name ?? '' };
  }

  // ---- Kết thúc, nộp lưu, tiếp nhận, trả về ----

  async setStatus(currentUser: CurrentUser, id: string, action: 'close' | 'reopen' | 'submit', body: RequestBody) {
    const { file, owner } = await this.access(this.system, currentUser, id);
    if (!owner) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ chủ hồ sơ thao tác được');
    }
    const allowed: Record<typeof action, WorkFileStatus[]> = {
      close: EDITABLE,
      reopen: ['closed'],
      submit: ['closed'],
    };
    if (!allowed[action].includes(file.status)) {
      throw ruleViolationError(
        DIRECTIVE_RULE_CODE,
        action === 'submit' ? 'Kết thúc hồ sơ trước khi nộp lưu' : 'Trạng thái hồ sơ không cho phép thao tác này',
      );
    }
    const values =
      action === 'close'
        ? { status: 'closed' as const, closed_on: this.today() }
        : action === 'reopen'
          ? { status: 'open' as const, closed_on: null }
          : { status: 'submitted' as const, submitted_at: this.clock.now(), ...this.submitRetention(body, file) };
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('work_files')
        .set({ ...values, updated_at: this.clock.now() })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, action, null, currentUser);
    });
    return this.detail(currentUser, id);
  }

  // Nộp lưu có thể chỉnh thời hạn bảo quản; không gửi thì giữ như đã khai
  private submitRetention(body: RequestBody, file: FileRow) {
    if (body?.retention === undefined) {
      return { retention: file.retention, retention_years: file.retention_years };
    }
    const errors: FieldError[] = [];
    const retention = readRetention(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return retention;
  }

  async accept(currentUser: CurrentUser, id: string, body: RequestBody, origin: ChangeOrigin) {
    if (!currentUser.hasPermission(ARCHIVE_MANAGE)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Cần quyền quản lý văn thư lưu trữ');
    }
    const file = await this.system.selectFrom('work_files').selectAll().where('id', '=', id).executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy hồ sơ công việc', 'work_file');
    }
    if (file.status !== 'submitted') {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Hồ sơ không ở trạng thái đã bàn giao');
    }
    const errors: FieldError[] = [];
    const code = readWorkText(body, 'code', errors, { maximum: 50 }) ?? `${file.year}-${file.code}`.slice(0, 50);
    const fondId = body?.fond_id;
    if (fondId !== undefined && fondId !== null && fondId !== '' && !isUuid(fondId)) {
      errors.push({ field: 'fond_id', message: 'Mã không hợp lệ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const { database } = await this.currentSchoolYear.require();
    const handler = await database
      .selectFrom('staff')
      .select('id')
      .where('user_id', '=', file.owner_user_id)
      .where('status', '=', 'active')
      .executeTakeFirst();
    const today = this.today();
    const items = await this.system
      .selectFrom('work_file_items')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('file_id', '=', id)
      .executeTakeFirstOrThrow();
    // Hồ sơ tài liệu ở 5.10 Văn thư lưu trữ: hoàn thành, người giải quyết là chủ hồ sơ, thời hạn bảo quản như hồ sơ công việc
    const record = await this.archives.createRecord(
      currentUser,
      {
        code,
        title: file.title.slice(0, 500),
        fond_id: typeof fondId === 'string' && fondId !== '' ? fondId : null,
        org_unit_id: file.org_unit_id,
        handler_staff_id: handler?.id ?? null,
        handler_name: file.owner_name.slice(0, 200),
        opened_on: file.opened_on,
        due_date: null,
        status: 'completed',
        completed_on: file.closed_on ?? today,
        retention: file.retention,
        retention_years: file.retention === 'limited' ? (file.retention_years ?? 10) : null,
        sheet_count: null,
        note: `Từ hồ sơ công việc ${file.code}, ${items.count} thành phần`.slice(0, 1000),
      },
      origin,
    );
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('work_files')
        .set({
          status: 'archived',
          archive_record_id: record.id,
          archived_on: today,
          archived_by_name: currentUser.description.full_name,
          retention_years: file.retention === 'limited' ? (file.retention_years ?? 10) : null,
          return_note: null,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, 'archive', `Hồ sơ tài liệu ${code}`, currentUser);
    });
    await this.notify([file.owner_user_id], 'Hồ sơ công việc đã được lưu trữ', `${file.code} – ${file.title}`, id);
    return this.detail(currentUser, id);
  }

  async returnFile(currentUser: CurrentUser, id: string, body: RequestBody) {
    if (!currentUser.hasPermission(ARCHIVE_MANAGE)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Cần quyền quản lý văn thư lưu trữ');
    }
    const errors: FieldError[] = [];
    const note = readWorkText(body, 'note', errors, { required: true, maximum: 1000 });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const file = await this.system
      .selectFrom('work_files')
      .select(['status', 'owner_user_id', 'code', 'title'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy hồ sơ công việc', 'work_file');
    }
    if (file.status !== 'submitted') {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Hồ sơ không ở trạng thái đã bàn giao');
    }
    await this.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('work_files')
        .set({ status: 'returned', return_note: note, updated_at: this.clock.now() })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, 'return', note, currentUser);
    });
    await this.notify([file.owner_user_id], 'Hồ sơ công việc bị trả về', `${file.code} – ${file.title}: ${note}`, id);
    return this.detail(currentUser, id);
  }
}

function conflictOf(error: unknown): unknown {
  if ((error as { code?: string }).code === '23505') {
    return new ApplicationError('ERR_CONFLICT', 'Ký hiệu hồ sơ đã có trong năm của người giữ hồ sơ', [
      { field: 'code', message: 'Ký hiệu đã có' },
    ]);
  }
  return error;
}
