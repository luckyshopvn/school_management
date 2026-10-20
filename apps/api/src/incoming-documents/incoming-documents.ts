import { Injectable } from '@nestjs/common';
import type {
  IncomingAssignmentRole,
  IncomingAssignmentStatus,
  IncomingDocumentStatus,
  SchoolYearDatabase,
  SystemDatabase,
} from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import {
  INCOMING_DUE_SOON_DAYS,
  INCOMING_MAXIMUM_FILE_BYTES,
  INCOMING_ROLE_LABELS,
  PERMISSION_CODES,
} from '@school-management/shared';
import { sql, type ExpressionBuilder, type Kysely, type Transaction } from 'kysely';
import { createHash, randomUUID } from 'node:crypto';
import { detectArchiveFileType } from '../archives/archives.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { storageKey } from '../common/resource-names.js';
import { FileStorage } from '../files/file-storage.js';
import { DocumentAdminService, hasWholeSchool, INCOMING_RULE_CODE, type StaffAccount } from './document-admin.js';
import { DocumentExchange } from './document-exchange.js';
import {
  escapeLike,
  type IncomingDocumentInput,
  type IncomingListFilter,
  type RegistrationInput,
  type TransferInput,
} from './incoming-fields.js';

// Văn bản đến theo VNPT iOffice (DT-18 phần 18a, YCTD-138; quyết định của Eric ngày 2026-10-19). Văn thư vào sổ văn bản
// đến (số đến cấp theo sổ, có thể sửa nếu chưa trùng), đính kèm tệp quét hoặc tải lên, rồi trình lãnh đạo hoặc chuyển trực
// tiếp. Mỗi lần chuyển là một dòng của luồng xử lý cho một người với vai trò lãnh đạo, xử lý chính, phối hợp hoặc xem để
// biết; người nhận chuyển tiếp (chuyển lãnh đạo, chuyển xử lý, luân chuyển), trả lại, từ chối (phối hợp), xử lý xong phần
// mình, xin gia hạn (xử lý chính); người chuyển lấy lại khi người nhận chưa xử lý. Kết thúc văn bản đóng mọi dòng còn chờ.
// Hạn chế xem chỉ cho người trong luồng xem. Văn bản nhận qua trục liên thông là bản chạy nội bộ: văn thư nhập, đánh dấu
// tiếp nhận rồi vào sổ (DocumentExchange là chỗ nối). Lịch sử tham mưu ghi ở incoming_document_events.
// Chi tiết do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-138
const REGISTER = PERMISSION_CODES.incomingDocumentRegister;
const SEARCH = PERMISSION_CODES.incomingDocumentSearch;
const DAY_MILLISECONDS = 86_400_000;
const MAXIMUM_FILES = 30;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const ACTIVE_ROLES: IncomingAssignmentRole[] = ['leader', 'main', 'coordinate'];
// Dòng không còn hiệu lực trong luồng: không tính là người đang xử lý, người xử lý chính
const INACTIVE_STATUSES: IncomingAssignmentStatus[] = ['returned', 'revoked', 'refused'];

type Executor = Kysely<SystemDatabase> | Transaction<SystemDatabase>;
type DocumentExpression = ExpressionBuilder<SystemDatabase, 'incoming_documents'>;

export type IncomingAction =
  | 'update'
  | 'delete'
  | 'register'
  | 'acknowledge'
  | 'submit_leader'
  | 'transfer'
  | 'rotate'
  | 'return'
  | 'refuse'
  | 'finish'
  | 'revoke'
  | 'request_extension'
  | 'decide_extension'
  | 'complete'
  | 'restrict'
  | 'reply'
  | 'archive'
  | 'upload';

interface DocumentRow {
  id: string;
  status: IncomingDocumentStatus;
  restricted: boolean;
  created_by: string;
  registered_by: string | null;
  restricted_by: string | null;
  book_id: string | null;
  deadline: string | null;
  summary: string;
  symbol: string;
  arrival_number: number | null;
  source: 'manual' | 'interconnect' | 'internal';
  interconnect_status: 'received' | 'acknowledged' | null;
}

interface AssignmentRow {
  id: string;
  document_id: string;
  parent_id: string | null;
  user_id: string;
  user_name: string;
  role: IncomingAssignmentRole;
  status: IncomingAssignmentStatus;
  deadline: string | null;
  extension_status: 'requested' | 'approved' | 'rejected' | null;
  extension_until: string | null;
  read_at: Date | null;
  assigned_by: string;
}

export interface BatchResult {
  id: string;
  ok: boolean;
  message: string | null;
}

const sha256 = (body: Buffer) => createHash('sha256').update(body).digest('hex');

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MILLISECONDS).toISOString().slice(0, 10);
}

// Quá hạn: hạn xử lý trước hôm nay; đến hạn: hạn trong INCOMING_DUE_SOON_DAYS ngày tới kể cả hôm nay
export function deadlineState(deadline: string | null, today: string, finished: boolean) {
  if (!deadline || finished) {
    return { overdue: false, due_soon: false };
  }
  return {
    overdue: deadline < today,
    due_soon: deadline >= today && deadline <= addDays(today, INCOMING_DUE_SOON_DAYS),
  };
}

@Injectable()
export class IncomingDocumentsService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly fileStorage: FileStorage,
    private readonly admin: DocumentAdminService,
    private readonly exchange: DocumentExchange,
    private readonly clock: Clock,
  ) {}

  private get system(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

  today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  canRegister(currentUser: CurrentUser): boolean {
    return hasWholeSchool(currentUser, REGISTER);
  }

  private canSearch(currentUser: CurrentUser): boolean {
    return hasWholeSchool(currentUser, SEARCH);
  }

  private assertRegister(currentUser: CurrentUser): void {
    if (!this.canRegister(currentUser)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Cần quyền văn thư (vào sổ văn bản đến) ở phạm vi toàn trường');
    }
  }

  // Văn bản người dùng xem được: có trong luồng (được chuyển, vào sổ, tạo), là người theo dõi, quản trị sổ, hoặc là văn
  // thư, người tra cứu với văn bản không hạn chế xem
  private visible(currentUser: CurrentUser) {
    const me = currentUser.id;
    const broad = this.canRegister(currentUser) || this.canSearch(currentUser);
    return (expression: DocumentExpression) =>
      expression.or([
        expression('incoming_documents.created_by', '=', me),
        expression('incoming_documents.registered_by', '=', me),
        expression('incoming_documents.restricted_by', '=', me),
        expression.exists(
          expression
            .selectFrom('incoming_document_assignments as mine')
            .select('mine.id')
            .whereRef('mine.document_id', '=', 'incoming_documents.id')
            .where('mine.user_id', '=', me),
        ),
        expression.and([
          expression('incoming_documents.restricted', '=', false),
          broad
            ? expression.lit(true)
            : expression.exists(
                expression
                  .selectFrom('document_book_members as member')
                  .select('member.book_id')
                  .whereRef('member.book_id', '=', 'incoming_documents.book_id')
                  .where('member.user_id', '=', me),
              ),
        ]),
      ]);
  }

  private async event(executor: Executor, documentId: string, action: string, note: string | null, user: CurrentUser) {
    await executor
      .insertInto('incoming_document_events')
      .values({
        document_id: documentId,
        action,
        note: note?.slice(0, 4000) ?? null,
        actor_id: user.id,
        actor_name: user.description.full_name,
      })
      .execute();
  }

  // Thông báo trong ứng dụng cho người nhận; chưa có năm học thì bỏ qua (hàng đợi thông báo ở cơ sở dữ liệu năm học)
  private async notify(userIds: string[], document: DocumentRow, title: string, body: string): Promise<void> {
    const recipients = [...new Set(userIds)];
    if (recipients.length === 0) {
      return;
    }
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return;
    }
    await queueNotification(current.database as Kysely<SchoolYearDatabase>, {
      orgUnitId: null,
      templateCode: 'incoming_document',
      title,
      body: `${body}: ${document.symbol} – ${document.summary.slice(0, 200)}`,
      targetType: 'incoming_document',
      targetId: document.id,
      recipients: recipients.map((userId) => ({ userId, channel: 'in_app' })),
    });
  }

  private async findDocument(executor: Executor, id: string, lock = false): Promise<DocumentRow> {
    let query = executor
      .selectFrom('incoming_documents')
      .select([
        'id',
        'status',
        'restricted',
        'created_by',
        'registered_by',
        'restricted_by',
        'book_id',
        'deadline',
        'summary',
        'symbol',
        'arrival_number',
        'source',
        'interconnect_status',
      ])
      .where('id', '=', id);
    if (lock) {
      query = query.forUpdate();
    }
    const row = await query.executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy văn bản đến', 'incoming_document');
    }
    return row;
  }

  // Văn bản người dùng xem được; không xem được thì báo không tìm thấy như văn bản không có
  async assertVisible(currentUser: CurrentUser, id: string): Promise<DocumentRow> {
    const row = await this.system
      .selectFrom('incoming_documents')
      .select('id')
      .where('id', '=', id)
      .where(this.visible(currentUser))
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy văn bản đến', 'incoming_document');
    }
    return this.findDocument(this.system, id);
  }

  private assignments(executor: Executor, documentId: string): Promise<AssignmentRow[]> {
    return executor
      .selectFrom('incoming_document_assignments')
      .select([
        'id',
        'document_id',
        'parent_id',
        'user_id',
        'user_name',
        'role',
        'status',
        'deadline',
        'extension_status',
        'extension_until',
        'read_at',
        'assigned_by',
      ])
      .where('document_id', '=', documentId)
      .orderBy('created_at')
      .execute();
  }

  // Dòng đang chờ của người dùng: ưu tiên vai trò xử lý (lãnh đạo, xử lý chính, phối hợp) rồi đến xem để biết
  private pendingOf(assignments: AssignmentRow[], userId: string): AssignmentRow | undefined {
    const pending = assignments.filter((row) => row.user_id === userId && row.status === 'pending');
    return pending.find((row) => ACTIVE_ROLES.includes(row.role)) ?? pending[0];
  }

  // Người dùng đang hoặc đã là lãnh đạo, xử lý chính trong luồng (dòng còn hiệu lực)
  private hasRole(assignments: AssignmentRow[], userId: string, role: IncomingAssignmentRole): boolean {
    return assignments.some(
      (row) => row.user_id === userId && row.role === role && !INACTIVE_STATUSES.includes(row.status),
    );
  }

  private inFlow(document: DocumentRow, assignments: AssignmentRow[], userId: string): boolean {
    return (
      document.created_by === userId ||
      document.registered_by === userId ||
      document.restricted_by === userId ||
      assignments.some((row) => row.user_id === userId)
    );
  }

  // Nhóm dòng người dùng lấy lại được: con của dòng đã chuyển gần nhất của mình (hoặc con gốc khi văn thư chuyển), mọi dòng
  // con còn chờ và chưa chuyển tiếp
  private revocable(document: DocumentRow, assignments: AssignmentRow[], currentUser: CurrentUser) {
    const forwarded = assignments.filter((row) => row.user_id === currentUser.id && row.status === 'forwarded');
    const source = forwarded.at(-1);
    let children: AssignmentRow[];
    if (source) {
      children = assignments.filter((row) => row.parent_id === source.id);
    } else if (
      this.canRegister(currentUser) &&
      (!document.restricted || this.inFlow(document, assignments, currentUser.id))
    ) {
      children = assignments.filter((row) => row.parent_id === null && !INACTIVE_STATUSES.includes(row.status));
    } else {
      return undefined;
    }
    const active = children.filter((row) => !INACTIVE_STATUSES.includes(row.status));
    if (active.length === 0) {
      return undefined;
    }
    const untouched = active.every(
      (row) =>
        (row.status === 'pending' || (row.role === 'view' && row.status === 'done')) &&
        !assignments.some((child) => child.parent_id === row.id),
    );
    return { source: source ?? null, children: active, untouched };
  }

  // Thao tác người dùng làm được trên văn bản, để cổng quản trị hiện nút; máy chủ vẫn kiểm tra lại ở từng thao tác
  actionsOf(document: DocumentRow, assignments: AssignmentRow[], currentUser: CurrentUser): IncomingAction[] {
    const me = currentUser.id;
    const clerk = this.canRegister(currentUser) && (!document.restricted || this.inFlow(document, assignments, me));
    const mine = this.pendingOf(assignments, me);
    const working = mine && ACTIVE_ROLES.includes(mine.role) ? mine : undefined;
    const leader = this.hasRole(assignments, me, 'leader');
    const main = this.hasRole(assignments, me, 'main');
    const open = document.status === 'registered' || document.status === 'processing';
    const actions: IncomingAction[] = [];
    if (clerk && document.status !== 'completed') {
      actions.push('update', 'upload');
    }
    if (clerk && document.status === 'pending_registration') {
      actions.push('register', 'acknowledge');
      if (assignments.length === 0) {
        actions.push('delete');
      }
    }
    if (clerk && document.status === 'registered' && assignments.length === 0) {
      actions.push('delete');
    }
    if (open && ((clerk && document.status === 'registered') || working)) {
      actions.push('submit_leader', 'transfer');
    }
    if (open && working) {
      actions.push('rotate', 'return', 'finish');
      if (working.role === 'coordinate') {
        actions.push('refuse');
      }
      if (working.role === 'main' && working.extension_status !== 'requested') {
        actions.push('request_extension');
      }
      if (!actions.includes('upload')) {
        actions.push('upload');
      }
    }
    if (open && this.revocable(document, assignments, currentUser)?.untouched) {
      actions.push('revoke');
    }
    const requested = assignments.filter((row) => row.extension_status === 'requested');
    if (open && requested.some((row) => this.canDecideExtension(row, assignments, currentUser, clerk))) {
      actions.push('decide_extension');
    }
    if (open && (clerk || leader || working?.role === 'main')) {
      actions.push('complete');
    }
    if (document.status !== 'pending_registration' && (clerk || leader)) {
      actions.push('restrict');
    }
    if (document.status !== 'pending_registration' && (clerk || main)) {
      actions.push('reply', 'archive');
    }
    return actions;
  }

  private canDecideExtension(
    row: AssignmentRow,
    assignments: AssignmentRow[],
    currentUser: CurrentUser,
    clerk: boolean,
  ): boolean {
    const parent = assignments.find((item) => item.id === row.parent_id);
    return clerk || parent?.user_id === currentUser.id || this.hasRole(assignments, currentUser.id, 'leader');
  }

  private async assertAction(
    executor: Executor,
    documentId: string,
    currentUser: CurrentUser,
    action: IncomingAction,
    message: string,
  ) {
    const document = await this.findDocument(executor, documentId, executor !== this.system);
    const assignments = await this.assignments(executor, documentId);
    const visible =
      this.inFlow(document, assignments, currentUser.id) ||
      (!document.restricted && (this.canRegister(currentUser) || this.canSearch(currentUser)));
    if (!visible) {
      throw notFoundError('Không tìm thấy văn bản đến', 'incoming_document');
    }
    if (!this.actionsOf(document, assignments, currentUser).includes(action)) {
      throw ruleViolationError(INCOMING_RULE_CODE, message);
    }
    return { document, assignments };
  }

  // ---- Danh sách ----

  async list(currentUser: CurrentUser, filter: IncomingListFilter, page: number, pageSize: number) {
    const me = currentUser.id;
    if (['registered', 'processing', 'completed', 'interconnect'].includes(filter.view)) {
      this.assertRegister(currentUser);
    }
    const today = this.today();
    let query = this.system.selectFrom('incoming_documents').where(this.visible(currentUser));
    // Có dòng của mình trong luồng, theo vai trò đang lọc (xử lý chính, phối hợp, xem) và chỉ dòng còn chờ nếu cần
    const mineExists = (expression: DocumentExpression, pendingOnly: boolean) => {
      let inner = expression
        .selectFrom('incoming_document_assignments as mine')
        .select('mine.id')
        .whereRef('mine.document_id', '=', 'incoming_documents.id')
        .where('mine.user_id', '=', me);
      if (filter.role !== 'all') {
        inner = inner.where('mine.role', '=', filter.role);
      }
      if (pendingOnly) {
        inner = inner.where('mine.status', '=', 'pending');
      }
      return expression.exists(inner);
    };
    switch (filter.view) {
      case 'inbox':
        query = query.where((expression) => mineExists(expression, true));
        break;
      case 'processed':
        query = query
          .where((expression) => mineExists(expression, false))
          .where((expression) =>
            expression.not(
              expression.exists(
                expression
                  .selectFrom('incoming_document_assignments as waiting')
                  .select('waiting.id')
                  .whereRef('waiting.document_id', '=', 'incoming_documents.id')
                  .where('waiting.user_id', '=', me)
                  .where('waiting.status', '=', 'pending'),
              ),
            ),
          );
        break;
      case 'for_information':
        query = query.where((expression) =>
          expression.exists(
            expression
              .selectFrom('incoming_document_assignments as mine')
              .select('mine.id')
              .whereRef('mine.document_id', '=', 'incoming_documents.id')
              .where('mine.user_id', '=', me)
              .where('mine.role', '=', 'view'),
          ),
        );
        break;
      case 'starred':
      case 'followed':
        query = query.where((expression) =>
          expression.exists(
            expression
              .selectFrom('incoming_document_flags as flag')
              .select('flag.document_id')
              .whereRef('flag.document_id', '=', 'incoming_documents.id')
              .where('flag.user_id', '=', me)
              .where(filter.view === 'starred' ? 'flag.starred' : 'flag.followed', '=', true),
          ),
        );
        break;
      case 'registered':
      case 'processing':
      case 'completed':
        query = query.where('incoming_documents.status', '=', filter.view);
        break;
      case 'interconnect':
        query = query.where('incoming_documents.status', '=', 'pending_registration');
        break;
      case 'search':
        if (filter.role !== 'all') {
          query = query.where((expression) => mineExists(expression, false));
        }
        break;
    }
    if (filter.q) {
      query = query.where('incoming_documents.summary', 'ilike', `%${escapeLike(filter.q)}%`);
    }
    if (filter.symbol) {
      query = query.where('incoming_documents.symbol', 'ilike', `%${escapeLike(filter.symbol)}%`);
    }
    if (filter.arrival_number) {
      query = query.where('incoming_documents.arrival_number', '=', filter.arrival_number);
    }
    if (filter.issuer) {
      query = query.where('incoming_documents.issuer_name', 'ilike', `%${escapeLike(filter.issuer)}%`);
    }
    if (filter.arrival_from) {
      query = query.where('incoming_documents.arrival_date', '>=', filter.arrival_from);
    }
    if (filter.arrival_to) {
      query = query.where('incoming_documents.arrival_date', '<=', filter.arrival_to);
    }
    for (const key of ['book_id', 'form_id', 'urgency_id'] as const) {
      const value = filter[key];
      if (value) {
        query = query.where(`incoming_documents.${key}`, '=', value);
      }
    }
    if (filter.overdue || filter.due_soon) {
      query = query.where('incoming_documents.status', 'in', ['registered', 'processing']);
      query = filter.overdue
        ? query.where('incoming_documents.deadline', '<', today)
        : query
            .where('incoming_documents.deadline', '>=', today)
            .where('incoming_documents.deadline', '<=', addDays(today, INCOMING_DUE_SOON_DAYS));
    }
    const total = await query
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    const rows = await query
      .leftJoin('document_books', 'document_books.id', 'incoming_documents.book_id')
      .leftJoin('document_catalog_items as form', 'form.id', 'incoming_documents.form_id')
      .leftJoin('document_catalog_items as urgency', 'urgency.id', 'incoming_documents.urgency_id')
      .leftJoin('document_catalog_items as secrecy', 'secrecy.id', 'incoming_documents.secrecy_id')
      .leftJoin('incoming_document_flags as flag', (join) =>
        join.onRef('flag.document_id', '=', 'incoming_documents.id').on('flag.user_id', '=', me),
      )
      .select([
        'incoming_documents.id',
        'incoming_documents.book_id',
        'document_books.name as book_name',
        'incoming_documents.arrival_number',
        'incoming_documents.arrival_date',
        'incoming_documents.summary',
        'incoming_documents.symbol',
        'incoming_documents.issuer_name',
        'incoming_documents.document_date',
        'incoming_documents.deadline',
        'incoming_documents.status',
        'incoming_documents.restricted',
        'incoming_documents.source',
        'incoming_documents.interconnect_status',
        'incoming_documents.received_at',
        'incoming_documents.acknowledged_at',
        'incoming_documents.acknowledged_by_name',
        'incoming_documents.updated_at',
        'form.name as form_name',
        'urgency.name as urgency_name',
        'urgency.level as urgency_level',
        'secrecy.name as secrecy_name',
        'secrecy.level as secrecy_level',
        'flag.starred',
        'flag.followed',
        (expression) =>
          sql<number>`(select count(*)::int from incoming_document_files files
            where files.document_id = ${expression.ref('incoming_documents.id')})`.as('file_count'),
      ])
      .orderBy('incoming_documents.arrival_date', (order) => order.desc().nullsFirst())
      .orderBy('incoming_documents.arrival_number', (order) => order.desc().nullsFirst())
      .orderBy('incoming_documents.created_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute();
    const ids = rows.map((row) => row.id);
    const flows =
      ids.length > 0
        ? await this.system
            .selectFrom('incoming_document_assignments')
            .select(['document_id', 'user_id', 'user_name', 'role', 'status', 'deadline', 'read_at', 'created_at'])
            .where('document_id', 'in', ids)
            .orderBy('created_at')
            .execute()
        : [];
    const items = rows.map((row) => {
      const flow = flows.filter((item) => item.document_id === row.id);
      const mine = flow.filter((item) => item.user_id === me);
      const current =
        mine.find((item) => item.status === 'pending' && ACTIVE_ROLES.includes(item.role)) ??
        mine.find((item) => item.status === 'pending') ??
        mine.at(-1);
      const main = flow.filter((item) => item.role === 'main' && !INACTIVE_STATUSES.includes(item.status)).at(-1);
      const deadline = current?.status === 'pending' ? (current.deadline ?? row.deadline) : row.deadline;
      const finished = row.status === 'completed' || (current !== undefined && current.status !== 'pending');
      return {
        ...row,
        starred: row.starred ?? false,
        followed: row.followed ?? false,
        my_role: current?.role ?? null,
        my_status: current?.status ?? null,
        unread: current?.status === 'pending' && current.read_at === null,
        effective_deadline: deadline,
        ...deadlineState(deadline, today, finished),
        main_handler_name: main?.user_name ?? null,
        // Chỉ đạo: văn bản đã qua lãnh đạo cho ý kiến (màu xanh của iOffice)
        directed: flow.some((item) => item.role === 'leader' && item.status === 'forwarded'),
      };
    });
    return { items, total: Number(total.count), page, page_size: pageSize };
  }

  // ---- Chi tiết ----

  async detail(currentUser: CurrentUser, id: string) {
    await this.assertVisible(currentUser, id);
    // Mở văn bản là đã đọc; văn bản xem để biết coi như đã xem xong
    const now = this.clock.now();
    await this.system
      .updateTable('incoming_document_assignments')
      .set({ read_at: now })
      .where('document_id', '=', id)
      .where('user_id', '=', currentUser.id)
      .where('status', '=', 'pending')
      .where('read_at', 'is', null)
      .execute();
    await this.system
      .updateTable('incoming_document_assignments')
      .set({ status: 'done', finished_at: now })
      .where('document_id', '=', id)
      .where('user_id', '=', currentUser.id)
      .where('status', '=', 'pending')
      .where('role', '=', 'view')
      .execute();
    return this.view(currentUser, id);
  }

  async view(currentUser: CurrentUser, id: string) {
    const document = await this.system
      .selectFrom('incoming_documents')
      .leftJoin('document_books', 'document_books.id', 'incoming_documents.book_id')
      .leftJoin('document_catalog_items as form', 'form.id', 'incoming_documents.form_id')
      .leftJoin('document_catalog_items as urgency', 'urgency.id', 'incoming_documents.urgency_id')
      .leftJoin('document_catalog_items as secrecy', 'secrecy.id', 'incoming_documents.secrecy_id')
      .leftJoin('document_catalog_items as field', 'field.id', 'incoming_documents.field_id')
      .leftJoin('archive_records', 'archive_records.id', 'incoming_documents.archive_record_id')
      .selectAll('incoming_documents')
      .select([
        'document_books.name as book_name',
        'form.name as form_name',
        'urgency.name as urgency_name',
        'urgency.level as urgency_level',
        'secrecy.name as secrecy_name',
        'secrecy.level as secrecy_level',
        'field.name as field_name',
        'archive_records.code as archive_record_code',
        'archive_records.title as archive_record_title',
      ])
      .where('incoming_documents.id', '=', id)
      .executeTakeFirstOrThrow();
    const assignments = await this.system
      .selectFrom('incoming_document_assignments')
      .selectAll()
      .where('document_id', '=', id)
      .orderBy('created_at')
      .execute();
    const files = await this.system
      .selectFrom('incoming_document_files')
      .select([
        'id',
        'kind',
        'file_name',
        'content_type',
        'size_bytes',
        'sha256',
        'scanned',
        'created_by_name',
        'created_at',
      ])
      .where('document_id', '=', id)
      .orderBy('created_at')
      .execute();
    const related = await this.system
      .selectFrom('incoming_document_relations')
      .innerJoin('incoming_documents as other', 'other.id', 'incoming_document_relations.related_id')
      .select(['other.id', 'other.symbol', 'other.summary', 'other.arrival_number', 'other.arrival_date'])
      .where('incoming_document_relations.document_id', '=', id)
      .execute();
    const events = await this.system
      .selectFrom('incoming_document_events')
      .select(['id', 'action', 'note', 'actor_name', 'created_at'])
      .where('document_id', '=', id)
      .orderBy('created_at')
      .execute();
    const flag = await this.system
      .selectFrom('incoming_document_flags')
      .select(['starred', 'followed'])
      .where('document_id', '=', id)
      .where('user_id', '=', currentUser.id)
      .executeTakeFirst();
    const row = document as unknown as DocumentRow;
    const today = this.today();
    return {
      ...document,
      ...deadlineState(document.deadline, today, document.status === 'completed'),
      starred: flag?.starred ?? false,
      followed: flag?.followed ?? false,
      files,
      related,
      assignments: assignments.map((assignment) => ({
        ...assignment,
        ...deadlineState(assignment.deadline, today, assignment.status !== 'pending'),
      })),
      events,
      my_pending_assignment_id: this.pendingOf(assignments, currentUser.id)?.id ?? null,
      actions: this.actionsOf(row, assignments, currentUser),
      exchange: { connected: this.exchange.connected, description: this.exchange.description },
    };
  }

  // ---- Vào sổ, cập nhật thông tin, xóa ----

  private async resolveInput(executor: Executor, input: IncomingDocumentInput) {
    const ids = [input.form_id, input.urgency_id, input.secrecy_id, input.field_id].filter(
      (value): value is string => value !== null,
    );
    const items = ids.length
      ? await executor.selectFrom('document_catalog_items').select(['id', 'kind']).where('id', 'in', ids).execute()
      : [];
    const errors: Array<{ field: string; message: string }> = [];
    for (const [field, kind] of [
      ['form_id', 'form'],
      ['urgency_id', 'urgency'],
      ['secrecy_id', 'secrecy'],
      ['field_id', 'field'],
    ] as const) {
      const value = input[field];
      if (value && !items.some((item) => item.id === value && item.kind === kind)) {
        errors.push({ field, message: 'Không có trong danh mục văn bản' });
      }
    }
    let issuerName = input.issuer_name;
    if (input.issuer_unit_id) {
      const unit = await executor
        .selectFrom('external_units')
        .select('name')
        .where('id', '=', input.issuer_unit_id)
        .executeTakeFirst();
      if (!unit) {
        errors.push({ field: 'issuer_unit_id', message: 'Không có trong danh mục đơn vị bên ngoài' });
      }
      issuerName = unit?.name ?? issuerName;
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return { ...input, issuer_name: issuerName as string };
  }

  // Cấp số đến trong sổ: khóa theo sổ để hai lần vào sổ cùng lúc không trùng số; số nhập tay phải chưa có trong sổ
  private async numberInBook(executor: Transaction<SystemDatabase>, registration: RegistrationInput): Promise<number> {
    const book = await executor
      .selectFrom('document_books')
      .select(['id', 'direction', 'start_number', 'start_date', 'end_date'])
      .where('id', '=', registration.book_id)
      .executeTakeFirst();
    if (!book || book.direction !== 'incoming') {
      throw validationError([{ field: 'book_id', message: 'Không tìm thấy sổ văn bản đến' }]);
    }
    if (registration.arrival_date < book.start_date || (book.end_date && registration.arrival_date > book.end_date)) {
      throw ruleViolationError(INCOMING_RULE_CODE, 'Ngày đến nằm ngoài thời gian áp dụng của sổ văn bản', [
        { field: 'arrival_date', message: 'Ngày đến nằm ngoài thời gian áp dụng của sổ' },
      ]);
    }
    await sql`select pg_advisory_xact_lock(hashtext(${`document-book:${book.id}`}))`.execute(executor);
    if (registration.arrival_number) {
      const taken = await executor
        .selectFrom('incoming_documents')
        .select('id')
        .where('book_id', '=', book.id)
        .where('arrival_number', '=', registration.arrival_number)
        .executeTakeFirst();
      if (taken) {
        throw new ApplicationError('ERR_CONFLICT', 'Số đến đã có trong sổ', [
          { field: 'arrival_number', message: 'Số đến đã có trong sổ' },
        ]);
      }
      return registration.arrival_number;
    }
    const last = await executor
      .selectFrom('incoming_documents')
      .select((expression) => expression.fn.max('arrival_number').as('maximum'))
      .where('book_id', '=', book.id)
      .executeTakeFirst();
    return Math.max(book.start_number, Number(last?.maximum ?? 0) + 1);
  }

  async nextNumber(currentUser: CurrentUser, bookId: string) {
    this.assertRegister(currentUser);
    const book = await this.system
      .selectFrom('document_books')
      .select(['start_number'])
      .where('id', '=', bookId)
      .where('direction', '=', 'incoming')
      .executeTakeFirst();
    if (!book) {
      throw notFoundError('Không tìm thấy sổ văn bản đến', 'document_book');
    }
    const last = await this.system
      .selectFrom('incoming_documents')
      .select((expression) => expression.fn.max('arrival_number').as('maximum'))
      .where('book_id', '=', bookId)
      .executeTakeFirst();
    return { next_number: Math.max(book.start_number, Number(last?.maximum ?? 0) + 1) };
  }

  // Vào sổ văn bản đến (biểu mẫu Thêm mới) hoặc nhập văn bản nhận qua liên thông, chờ vào sổ
  async create(currentUser: CurrentUser, rawInput: IncomingDocumentInput, registration: RegistrationInput | null) {
    this.assertRegister(currentUser);
    const id = await this.system.transaction().execute(async (transaction) => {
      const input = await this.resolveInput(transaction, rawInput);
      const now = this.clock.now();
      const actor = { id: currentUser.id, name: currentUser.description.full_name };
      const base = { ...input, created_by: actor.id, created_by_name: actor.name };
      let values;
      if (registration) {
        const number = await this.numberInBook(transaction, registration);
        values = {
          ...base,
          book_id: registration.book_id,
          arrival_number: number,
          arrival_date: registration.arrival_date,
          status: 'registered' as const,
          registered_at: now,
          registered_by: actor.id,
          registered_by_name: actor.name,
        };
      } else {
        values = {
          ...base,
          transfer_method: 'interconnect' as const,
          status: 'pending_registration' as const,
          source: 'interconnect' as const,
          interconnect_status: 'received' as const,
          received_at: now,
        };
      }
      const row = await transaction
        .insertInto('incoming_documents')
        .values(values)
        .returning('id')
        .executeTakeFirstOrThrow();
      await this.event(
        transaction,
        row.id,
        registration ? 'register' : 'interconnect_receive',
        registration ? null : 'Nhập văn bản nhận qua liên thông (bản chạy nội bộ)',
        currentUser,
      );
      return row.id;
    });
    return this.view(currentUser, id);
  }

  async update(currentUser: CurrentUser, id: string, rawInput: IncomingDocumentInput) {
    await this.system.transaction().execute(async (transaction) => {
      await this.assertAction(transaction, id, currentUser, 'update', 'Văn bản đã kết thúc, không cập nhật được');
      const input = await this.resolveInput(transaction, rawInput);
      await transaction
        .updateTable('incoming_documents')
        .set({ ...input, updated_at: this.clock.now() })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, 'update', null, currentUser);
    });
    return this.view(currentUser, id);
  }

  // Vào sổ văn bản nhận qua liên thông
  async register(currentUser: CurrentUser, id: string, registration: RegistrationInput) {
    await this.system.transaction().execute(async (transaction) => {
      await this.assertAction(transaction, id, currentUser, 'register', 'Văn bản không còn chờ vào sổ');
      const number = await this.numberInBook(transaction, registration);
      await transaction
        .updateTable('incoming_documents')
        .set({
          book_id: registration.book_id,
          arrival_number: number,
          arrival_date: registration.arrival_date,
          status: 'registered',
          registered_at: this.clock.now(),
          registered_by: currentUser.id,
          registered_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, 'register', `Số đến ${number}`, currentUser);
    });
    return this.view(currentUser, id);
  }

  // Đánh dấu tiếp nhận văn bản liên thông (gửi báo nhận lên trục qua chỗ nối khi có kết nối thật) hoặc hủy đánh dấu
  async acknowledge(currentUser: CurrentUser, id: string, acknowledged: boolean, reference: string | null) {
    await this.system.transaction().execute(async (transaction) => {
      const { document } = await this.assertAction(
        transaction,
        id,
        currentUser,
        'acknowledge',
        'Chỉ đánh dấu tiếp nhận văn bản liên thông còn chờ vào sổ',
      );
      if (acknowledged) {
        await this.exchange.acknowledge({
          documentId: id,
          reference,
          acknowledgedBy: currentUser.description.full_name,
        });
      }
      await transaction
        .updateTable('incoming_documents')
        .set({
          interconnect_status: acknowledged ? 'acknowledged' : 'received',
          interconnect_reference: reference ?? (acknowledged ? null : undefined),
          acknowledged_at: acknowledged ? this.clock.now() : null,
          acknowledged_by_name: acknowledged ? currentUser.description.full_name : null,
          updated_at: this.clock.now(),
        })
        .where('id', '=', document.id)
        .execute();
      await this.event(transaction, id, acknowledged ? 'acknowledge' : 'unacknowledge', reference, currentUser);
    });
    return this.view(currentUser, id);
  }

  async remove(currentUser: CurrentUser, id: string): Promise<void> {
    const keys = await this.system.transaction().execute(async (transaction) => {
      await this.assertAction(transaction, id, currentUser, 'delete', 'Chỉ xóa văn bản chưa chuyển xử lý');
      const files = await transaction
        .selectFrom('incoming_document_files')
        .select('storage_key')
        .where('document_id', '=', id)
        .execute();
      await transaction.deleteFrom('incoming_documents').where('id', '=', id).execute();
      return files.map((file) => file.storage_key);
    });
    for (const key of keys) {
      await this.fileStorage.delete(key).catch(() => undefined);
    }
  }

  // ---- Tệp đính kèm, văn bản liên quan ----

  async addFile(
    currentUser: CurrentUser,
    id: string,
    upload: { fileName: string; body: Buffer; kind: 'main' | 'related'; scanned: boolean },
  ) {
    await this.assertAction(this.system, id, currentUser, 'upload', 'Không đính kèm tệp được cho văn bản này');
    if (upload.body.length > INCOMING_MAXIMUM_FILE_BYTES) {
      throw validationError([{ field: 'file', message: 'Tệp đính kèm tối đa 50 MB' }]);
    }
    const contentType = detectArchiveFileType(upload.fileName, upload.body);
    if (!contentType) {
      throw validationError([
        { field: 'file', message: 'Tệp đính kèm là PDF, ảnh JPEG, PNG, Word (.doc, .docx) hoặc Excel (.xls, .xlsx)' },
      ]);
    }
    const key = storageKey('incoming-documents', id, randomUUID());
    await this.fileStorage.put(key, upload.body, contentType);
    try {
      await this.system.transaction().execute(async (transaction) => {
        await sql`select pg_advisory_xact_lock(hashtext(${`incoming-document-files:${id}`}))`.execute(transaction);
        const count = await transaction
          .selectFrom('incoming_document_files')
          .select((expression) => expression.fn.countAll<string>().as('count'))
          .where('document_id', '=', id)
          .executeTakeFirstOrThrow();
        if (Number(count.count) >= MAXIMUM_FILES) {
          throw ruleViolationError(INCOMING_RULE_CODE, `Mỗi văn bản đính kèm tối đa ${MAXIMUM_FILES} tệp`);
        }
        await transaction
          .insertInto('incoming_document_files')
          .values({
            document_id: id,
            kind: upload.kind,
            file_name: upload.fileName.slice(0, 200),
            content_type: contentType,
            size_bytes: upload.body.length,
            sha256: sha256(upload.body),
            storage_key: key,
            scanned: upload.scanned,
            created_by: currentUser.id,
            created_by_name: currentUser.description.full_name,
          })
          .execute();
        await this.event(transaction, id, 'file_add', upload.fileName.slice(0, 200), currentUser);
      });
    } catch (error) {
      await this.fileStorage.delete(key).catch(() => undefined);
      throw error;
    }
    return this.view(currentUser, id);
  }

  async readFile(currentUser: CurrentUser, id: string, fileId: string) {
    await this.assertVisible(currentUser, id);
    const file = await this.system
      .selectFrom('incoming_document_files')
      .select(['file_name', 'content_type', 'storage_key'])
      .where('id', '=', fileId)
      .where('document_id', '=', id)
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp đính kèm', 'incoming_document_file');
    }
    return {
      fileName: file.file_name,
      contentType: file.content_type,
      body: await this.fileStorage.get(file.storage_key),
    };
  }

  // Người tải lên hoặc văn thư xóa tệp khi văn bản chưa kết thúc
  async deleteFile(currentUser: CurrentUser, id: string, fileId: string) {
    const document = await this.assertVisible(currentUser, id);
    const file = await this.system
      .selectFrom('incoming_document_files')
      .select(['file_name', 'storage_key', 'created_by'])
      .where('id', '=', fileId)
      .where('document_id', '=', id)
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp đính kèm', 'incoming_document_file');
    }
    if (document.status === 'completed' || (file.created_by !== currentUser.id && !this.canRegister(currentUser))) {
      throw ruleViolationError(INCOMING_RULE_CODE, 'Chỉ người tải lên hoặc văn thư xóa tệp khi văn bản chưa kết thúc');
    }
    await this.system.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('incoming_document_files').where('id', '=', fileId).execute();
      await this.event(transaction, id, 'file_delete', file.file_name, currentUser);
    });
    await this.fileStorage.delete(file.storage_key).catch(() => undefined);
    return this.view(currentUser, id);
  }

  async setRelations(currentUser: CurrentUser, id: string, relatedIds: string[]) {
    await this.assertAction(this.system, id, currentUser, 'update', 'Văn bản đã kết thúc, không cập nhật được');
    const ids = relatedIds.filter((relatedId) => relatedId !== id);
    if (ids.length > 0) {
      const found = await this.system
        .selectFrom('incoming_documents')
        .select('id')
        .where('id', 'in', ids)
        .where(this.visible(currentUser))
        .execute();
      if (found.length !== ids.length) {
        throw validationError([{ field: 'related_ids', message: 'Có văn bản liên quan không tìm thấy' }]);
      }
    }
    await this.system.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('incoming_document_relations').where('document_id', '=', id).execute();
      if (ids.length > 0) {
        await transaction
          .insertInto('incoming_document_relations')
          .values(ids.map((relatedId) => ({ document_id: id, related_id: relatedId })))
          .execute();
      }
      await this.event(transaction, id, 'relations', `${ids.length} văn bản liên quan`, currentUser);
    });
    return this.view(currentUser, id);
  }

  // ---- Luồng xử lý ----

  // Trình lãnh đạo, chuyển lãnh đạo (người nhận phải ở danh sách lãnh đạo nhận văn bản), chuyển xử lý, chuyển trực tiếp
  // (văn thư chuyển khi chưa qua lãnh đạo), luân chuyển (giao vai trò của mình cho người khác)
  async transfer(currentUser: CurrentUser, id: string, input: TransferInput) {
    const notices = await this.system.transaction().execute(async (transaction) => {
      const action = input.mode === 'leader' ? 'submit_leader' : input.mode === 'rotate' ? 'rotate' : 'transfer';
      const { document, assignments } = await this.assertAction(
        transaction,
        id,
        currentUser,
        action,
        'Bạn không có văn bản này đang chờ xử lý để chuyển',
      );
      const files = await transaction
        .selectFrom('incoming_document_files')
        .select('id')
        .where('document_id', '=', id)
        .where('kind', '=', 'main')
        .limit(1)
        .executeTakeFirst();
      if (!files) {
        throw ruleViolationError(
          INCOMING_RULE_CODE,
          'Văn bản chưa có tệp đính kèm (quét hoặc tải lên), hãy đính kèm trước khi chuyển',
        );
      }
      const userIds = input.recipients.map((recipient) => recipient.user_id);
      if (userIds.includes(currentUser.id)) {
        throw validationError([{ field: 'recipients', message: 'Không chuyển văn bản cho chính mình' }]);
      }
      let accounts: Map<string, { name: string; title: string | null }>;
      if (input.mode === 'leader') {
        const leaders = await transaction
          .selectFrom('document_leaders')
          .select(['user_id', 'user_name', 'title'])
          .where('user_id', 'in', userIds)
          .execute();
        if (leaders.length !== userIds.length) {
          throw validationError([
            { field: 'recipients', message: 'Chỉ trình cho người ở danh sách lãnh đạo nhận văn bản' },
          ]);
        }
        accounts = new Map(leaders.map((leader) => [leader.user_id, { name: leader.user_name, title: leader.title }]));
      } else {
        const staff = await this.admin.resolveAccounts(userIds, 'recipients');
        accounts = new Map(
          [...staff.values()].map((account: StaffAccount) => [
            account.user_id,
            {
              name: account.full_name,
              title:
                [account.job_title_name, account.department_name ?? account.org_unit_name].filter(Boolean).join(', ') ||
                null,
            },
          ]),
        );
      }
      const busy = assignments.find((row) => userIds.includes(row.user_id) && row.status === 'pending');
      if (busy) {
        throw ruleViolationError(INCOMING_RULE_CODE, `${busy.user_name} đang có văn bản này chờ xử lý`);
      }
      const mine = this.pendingOf(assignments, currentUser.id);
      const working = mine && ACTIVE_ROLES.includes(mine.role) ? mine : undefined;
      const now = this.clock.now();
      let parentId: string | null = working?.id ?? null;
      let rotatedRole: IncomingAssignmentRole | null = null;
      if (input.mode === 'rotate') {
        if (!working) {
          throw ruleViolationError(INCOMING_RULE_CODE, 'Chỉ luân chuyển văn bản đang chờ mình xử lý');
        }
        parentId = working.parent_id;
        rotatedRole = working.role;
      }
      if (working) {
        await transaction
          .updateTable('incoming_document_assignments')
          .set({ status: 'forwarded', finished_at: now, result_note: input.note })
          .where('id', '=', working.id)
          .execute();
      }
      await transaction
        .insertInto('incoming_document_assignments')
        .values(
          input.recipients.map((recipient) => {
            const account = accounts.get(recipient.user_id) as { name: string; title: string | null };
            return {
              document_id: id,
              parent_id: parentId,
              user_id: recipient.user_id,
              user_name: account.name,
              user_title: account.title,
              role: rotatedRole ?? recipient.role,
              deadline:
                recipient.deadline ?? input.deadline ?? (rotatedRole ? (working?.deadline ?? null) : document.deadline),
              note: input.note,
              assigned_by: currentUser.id,
              assigned_by_name: currentUser.description.full_name,
            };
          }),
        )
        .execute();
      if (document.status === 'registered') {
        await transaction
          .updateTable('incoming_documents')
          .set({ status: 'processing', updated_at: now })
          .where('id', '=', id)
          .execute();
      }
      const names = input.recipients
        .map((recipient) => {
          const role = rotatedRole ?? recipient.role;
          return `${accounts.get(recipient.user_id)?.name} (${INCOMING_ROLE_LABELS[role]})`;
        })
        .join(', ');
      const eventAction =
        input.mode === 'leader'
          ? working
            ? 'forward_leader'
            : 'submit_leader'
          : input.mode === 'rotate'
            ? 'rotate'
            : working
              ? 'forward'
              : 'direct';
      await this.event(transaction, id, eventAction, [names, input.note].filter(Boolean).join(' – '), currentUser);
      return { document, userIds };
    });
    await this.notify(notices.userIds, notices.document, 'Văn bản đến chờ xử lý', 'Bạn nhận văn bản đến');
    return this.view(currentUser, id);
  }

  // Trả lại người chuyển (hoặc văn thư khi văn thư chuyển); từ chối là trả lại của người phối hợp
  async giveBack(currentUser: CurrentUser, id: string, refuse: boolean, note: string | null) {
    const notice = await this.system.transaction().execute(async (transaction) => {
      const { document, assignments } = await this.assertAction(
        transaction,
        id,
        currentUser,
        refuse ? 'refuse' : 'return',
        refuse
          ? 'Chỉ người phối hợp đang chờ xử lý từ chối được'
          : 'Bạn không có văn bản này đang chờ xử lý để trả lại',
      );
      const mine = this.pendingOf(assignments, currentUser.id) as AssignmentRow;
      const now = this.clock.now();
      await transaction
        .updateTable('incoming_document_assignments')
        .set({ status: refuse ? 'refused' : 'returned', finished_at: now, result_note: note })
        .where('id', '=', mine.id)
        .execute();
      const parent = assignments.find((row) => row.id === mine.parent_id);
      if (parent && !refuse) {
        // Người chuyển nhận lại văn bản để xử lý tiếp
        await transaction
          .updateTable('incoming_document_assignments')
          .set({ status: 'pending', finished_at: null, read_at: null })
          .where('id', '=', parent.id)
          .execute();
      }
      if (!parent) {
        const stillPending = assignments.some((row) => row.id !== mine.id && row.status === 'pending');
        if (!stillPending && !refuse) {
          await transaction
            .updateTable('incoming_documents')
            .set({ status: 'registered', updated_at: now })
            .where('id', '=', id)
            .execute();
        }
      }
      await this.event(transaction, id, refuse ? 'refuse' : 'return', note, currentUser);
      return { document, userId: parent?.user_id ?? document.registered_by ?? document.created_by };
    });
    await this.notify(
      [notice.userId],
      notice.document,
      refuse ? 'Văn bản đến bị từ chối phối hợp' : 'Văn bản đến bị trả lại',
      `${currentUser.description.full_name} ${refuse ? 'từ chối phối hợp' : 'trả lại'} văn bản`,
    );
    return this.view(currentUser, id);
  }

  // Lấy lại văn bản đã chuyển khi người nhận chưa xử lý, chưa chuyển tiếp
  async revoke(currentUser: CurrentUser, id: string) {
    const notice = await this.system.transaction().execute(async (transaction) => {
      const document = await this.findDocument(transaction, id, true);
      const assignments = await this.assignments(transaction, id);
      const group = this.revocable(document, assignments, currentUser);
      if (!group) {
        throw ruleViolationError(INCOMING_RULE_CODE, 'Không có lần chuyển nào của bạn để lấy lại');
      }
      if (!group.untouched || (document.status !== 'processing' && document.status !== 'registered')) {
        throw ruleViolationError(INCOMING_RULE_CODE, 'Người nhận đã xử lý hoặc chuyển tiếp, không lấy lại được');
      }
      const now = this.clock.now();
      await transaction
        .updateTable('incoming_document_assignments')
        .set({ status: 'revoked', finished_at: now })
        .where(
          'id',
          'in',
          group.children.map((row) => row.id),
        )
        .execute();
      if (group.source) {
        await transaction
          .updateTable('incoming_document_assignments')
          .set({ status: 'pending', finished_at: null })
          .where('id', '=', group.source.id)
          .execute();
      } else {
        const others = assignments.some(
          (row) => row.status === 'pending' && !group.children.some((child) => child.id === row.id),
        );
        if (!others) {
          await transaction
            .updateTable('incoming_documents')
            .set({ status: 'registered', updated_at: now })
            .where('id', '=', id)
            .execute();
        }
      }
      await this.event(transaction, id, 'revoke', group.children.map((row) => row.user_name).join(', '), currentUser);
      return { document, userIds: group.children.map((row) => row.user_id) };
    });
    await this.notify(notice.userIds, notice.document, 'Văn bản đến đã bị lấy lại', 'Người chuyển đã lấy lại văn bản');
    return this.view(currentUser, id);
  }

  // Xử lý xong phần của mình, ghi ý kiến xử lý
  async finish(currentUser: CurrentUser, id: string, note: string | null) {
    const notice = await this.system.transaction().execute(async (transaction) => {
      const { document, assignments } = await this.assertAction(
        transaction,
        id,
        currentUser,
        'finish',
        'Bạn không có văn bản này đang chờ xử lý',
      );
      const mine = this.pendingOf(assignments, currentUser.id) as AssignmentRow;
      await transaction
        .updateTable('incoming_document_assignments')
        .set({ status: 'done', finished_at: this.clock.now(), result_note: note })
        .where('id', '=', mine.id)
        .execute();
      await this.event(transaction, id, 'finish', note, currentUser);
      const parent = assignments.find((row) => row.id === mine.parent_id);
      return { document, userId: parent?.user_id ?? document.registered_by ?? document.created_by };
    });
    await this.notify(
      [notice.userId],
      notice.document,
      'Văn bản đến đã xử lý',
      `${currentUser.description.full_name} đã xử lý xong phần được giao`,
    );
    return this.view(currentUser, id);
  }

  async requestExtension(currentUser: CurrentUser, id: string, until: string, reason: string) {
    const notice = await this.system.transaction().execute(async (transaction) => {
      const { document, assignments } = await this.assertAction(
        transaction,
        id,
        currentUser,
        'request_extension',
        'Chỉ người xử lý chính đang xử lý xin gia hạn, mỗi lần một đề nghị',
      );
      const mine = this.pendingOf(assignments, currentUser.id) as AssignmentRow;
      const current = mine.deadline ?? document.deadline;
      if (current && until <= current) {
        throw validationError([{ field: 'until', message: 'Hạn đề nghị phải sau hạn xử lý hiện tại' }]);
      }
      if (until < this.today()) {
        throw validationError([{ field: 'until', message: 'Hạn đề nghị không trước hôm nay' }]);
      }
      await transaction
        .updateTable('incoming_document_assignments')
        .set({
          extension_until: until,
          extension_reason: reason,
          extension_status: 'requested',
          extension_decided_at: null,
          extension_decided_by_name: null,
        })
        .where('id', '=', mine.id)
        .execute();
      await this.event(transaction, id, 'request_extension', `Đến ngày ${until}: ${reason}`, currentUser);
      const parent = assignments.find((row) => row.id === mine.parent_id);
      return { document, userId: parent?.user_id ?? document.registered_by ?? document.created_by };
    });
    await this.notify([notice.userId], notice.document, 'Đề nghị gia hạn xử lý văn bản', 'Có đề nghị gia hạn');
    return this.view(currentUser, id);
  }

  // Người chuyển, lãnh đạo trong luồng hoặc văn thư đồng ý (đổi hạn xử lý) hoặc không đồng ý đề nghị gia hạn
  async decideExtension(
    currentUser: CurrentUser,
    id: string,
    assignmentId: string,
    approve: boolean,
    note: string | null,
  ) {
    const notice = await this.system.transaction().execute(async (transaction) => {
      const document = await this.findDocument(transaction, id, true);
      const assignments = await this.assignments(transaction, id);
      const row = assignments.find((item) => item.id === assignmentId);
      const clerk =
        this.canRegister(currentUser) && (!document.restricted || this.inFlow(document, assignments, currentUser.id));
      if (!row || row.extension_status !== 'requested') {
        throw ruleViolationError(INCOMING_RULE_CODE, 'Không có đề nghị gia hạn đang chờ');
      }
      if (!this.canDecideExtension(row, assignments, currentUser, clerk)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người chuyển, lãnh đạo hoặc văn thư duyệt gia hạn');
      }
      const now = this.clock.now();
      await transaction
        .updateTable('incoming_document_assignments')
        .set({
          extension_status: approve ? 'approved' : 'rejected',
          extension_decided_at: now,
          extension_decided_by_name: currentUser.description.full_name,
          ...(approve ? { deadline: row.extension_until } : {}),
        })
        .where('id', '=', row.id)
        .execute();
      if (approve && row.extension_until && (!document.deadline || document.deadline < row.extension_until)) {
        await transaction
          .updateTable('incoming_documents')
          .set({ deadline: row.extension_until, updated_at: now })
          .where('id', '=', id)
          .execute();
      }
      await this.event(
        transaction,
        id,
        approve ? 'approve_extension' : 'reject_extension',
        [`${row.user_name}, đến ngày ${row.extension_until}`, note].filter(Boolean).join(' – '),
        currentUser,
      );
      return { document, userId: row.user_id };
    });
    await this.notify(
      [notice.userId],
      notice.document,
      approve ? 'Đề nghị gia hạn được đồng ý' : 'Đề nghị gia hạn không được đồng ý',
      'Kết quả đề nghị gia hạn',
    );
    return this.view(currentUser, id);
  }

  // Kết thúc văn bản: đóng mọi dòng còn chờ
  private async completeOne(
    transaction: Transaction<SystemDatabase>,
    currentUser: CurrentUser,
    id: string,
    note: string | null,
  ) {
    await this.assertAction(transaction, id, currentUser, 'complete', 'Bạn không kết thúc được văn bản này');
    const now = this.clock.now();
    await transaction
      .updateTable('incoming_document_assignments')
      .set({ status: 'closed', finished_at: now })
      .where('document_id', '=', id)
      .where('status', '=', 'pending')
      .execute();
    await transaction
      .updateTable('incoming_documents')
      .set({
        status: 'completed',
        completed_at: now,
        completed_by: currentUser.id,
        completed_by_name: currentUser.description.full_name,
        completion_note: note,
        updated_at: now,
      })
      .where('id', '=', id)
      .execute();
    await this.event(transaction, id, 'complete', note, currentUser);
  }

  async complete(currentUser: CurrentUser, id: string, note: string | null) {
    await this.system.transaction().execute((transaction) => this.completeOne(transaction, currentUser, id, note));
    return this.view(currentUser, id);
  }

  // Thao tác hàng loạt: mỗi văn bản một giao dịch, văn bản không làm được thì ghi lý do và làm tiếp văn bản khác
  private async batch(ids: string[], run: (id: string) => Promise<void>): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    for (const id of ids) {
      try {
        await run(id);
        results.push({ id, ok: true, message: null });
      } catch (error) {
        if (!(error instanceof ApplicationError)) {
          throw error;
        }
        results.push({ id, ok: false, message: error.message });
      }
    }
    return results;
  }

  completeMany(currentUser: CurrentUser, ids: string[], note: string | null) {
    return this.batch(ids, (id) =>
      this.system.transaction().execute((transaction) => this.completeOne(transaction, currentUser, id, note)),
    );
  }

  // Lưu hồ sơ: gắn văn bản vào hồ sơ tài liệu của Văn thư lưu trữ (5.10.1)
  async archiveMany(currentUser: CurrentUser, ids: string[], archiveRecordId: string) {
    const record = await this.system
      .selectFrom('archive_records')
      .select(['id', 'code'])
      .where('id', '=', archiveRecordId)
      .executeTakeFirst();
    if (!record) {
      throw validationError([{ field: 'archive_record_id', message: 'Không tìm thấy hồ sơ tài liệu' }]);
    }
    return this.batch(ids, (id) =>
      this.system.transaction().execute(async (transaction) => {
        await this.assertAction(
          transaction,
          id,
          currentUser,
          'archive',
          'Chỉ văn thư hoặc người xử lý chính lưu hồ sơ',
        );
        await transaction
          .updateTable('incoming_documents')
          .set({
            archive_record_id: record.id,
            archived_at: this.clock.now(),
            archived_by_name: currentUser.description.full_name,
            updated_at: this.clock.now(),
          })
          .where('id', '=', id)
          .execute();
        await this.event(transaction, id, 'archive', `Hồ sơ ${record.code}`, currentUser);
      }),
    );
  }

  async restrict(currentUser: CurrentUser, id: string, restricted: boolean) {
    await this.system.transaction().execute(async (transaction) => {
      await this.assertAction(transaction, id, currentUser, 'restrict', 'Chỉ văn thư hoặc lãnh đạo đặt hạn chế xem');
      await transaction
        .updateTable('incoming_documents')
        .set({
          restricted,
          restricted_at: restricted ? this.clock.now() : null,
          restricted_by: restricted ? currentUser.id : null,
          restricted_by_name: restricted ? currentUser.description.full_name : null,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, restricted ? 'restrict' : 'unrestrict', null, currentUser);
    });
    return this.view(currentUser, id);
  }

  // Văn bản trả lời: ghi số ký hiệu, ngày của văn bản đi trả lời (nối sổ văn bản đi khi phần 18b gộp)
  async reply(currentUser: CurrentUser, id: string, input: { symbol: string; date: string; note: string | null }) {
    await this.system.transaction().execute(async (transaction) => {
      await this.assertAction(
        transaction,
        id,
        currentUser,
        'reply',
        'Chỉ văn thư hoặc người xử lý chính ghi văn bản trả lời',
      );
      await transaction
        .updateTable('incoming_documents')
        .set({
          reply_symbol: input.symbol,
          reply_date: input.date,
          reply_note: input.note,
          replied_at: this.clock.now(),
          replied_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, 'reply', `${input.symbol} ngày ${input.date}`, currentUser);
    });
    return this.view(currentUser, id);
  }

  // Đánh dấu, theo dõi (của riêng người dùng), hàng loạt
  async setFlags(currentUser: CurrentUser, ids: string[], flags: { starred?: boolean; followed?: boolean }) {
    const visible = await this.system
      .selectFrom('incoming_documents')
      .select('id')
      .where('id', 'in', ids)
      .where(this.visible(currentUser))
      .execute();
    if (visible.length !== ids.length) {
      throw notFoundError('Có văn bản không tìm thấy', 'incoming_document');
    }
    const now = this.clock.now();
    await this.system
      .insertInto('incoming_document_flags')
      .values(ids.map((id) => ({ document_id: id, user_id: currentUser.id, ...flags, updated_at: now })))
      .onConflict((conflict) => conflict.columns(['document_id', 'user_id']).doUpdateSet({ ...flags, updated_at: now }))
      .execute();
    return { updated: ids.length };
  }

  // Đánh dấu chưa đọc: văn bản đang chờ mình hiện lại như chưa mở
  async markUnread(currentUser: CurrentUser, id: string) {
    await this.assertVisible(currentUser, id);
    const result = await this.system
      .updateTable('incoming_document_assignments')
      .set({ read_at: null })
      .where('document_id', '=', id)
      .where('user_id', '=', currentUser.id)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
      throw ruleViolationError(INCOMING_RULE_CODE, 'Chỉ đánh dấu chưa đọc văn bản đang chờ mình xử lý');
    }
    return { unread: true };
  }
}
