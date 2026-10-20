import { Injectable } from '@nestjs/common';
import type {
  OutgoingDocumentStatus,
  OutgoingFileKind,
  OutgoingOpinionStatus,
  SchoolYearDatabase,
  SystemDatabase,
} from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import {
  isSigningProvider,
  OUTGOING_MAXIMUM_FILE_BYTES,
  PERMISSION_CODES,
  SIGNING_SIGNATURE_TYPE_LABELS,
} from '@school-management/shared';
import { sql, type ExpressionBuilder, type Kysely, type Transaction } from 'kysely';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { detectArchiveFileType } from '../archives/archives.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { storageKey } from '../common/resource-names.js';
import { CONTENT_TYPES } from '../exports/table-file.js';
import { FileStorage } from '../files/file-storage.js';
import { DocumentAdminService, hasWholeSchool } from '../incoming-documents/document-admin.js';
import { DocumentExchange } from '../incoming-documents/document-exchange.js';
import { escapeLike } from '../incoming-documents/incoming-fields.js';
import { DossierSigner } from '../signing/dossier-signer.js';
import {
  symbolOf,
  type ConsultInput,
  type IssueInput,
  type LinkInput,
  type OutgoingDocumentInput,
  type OutgoingListFilter,
  type RecipientInput,
} from './outgoing-fields.js';

// Văn bản đi theo VNPT iOffice (DT-18 phần 18b, YCTD-140; quyết định của Eric ngày 2026-10-19). Người soạn lập dự thảo
// (biểu mẫu của iOffice: số trình ký, trích yếu, hình thức, độ khẩn, loại văn bản, người soạn thảo, đơn vị soạn thảo, người
// ký, phân loại ưu tiên, thời gian và địa điểm họp, chèn mã QR, tệp, văn bản liên quan, văn bản gốc, đơn vị dự kiến nhận),
// lấy ý kiến (người được hỏi cho ý kiến, kết thúc cho ý kiến; người soạn kết thúc lấy ý kiến), trình ký. Người ký ký nội
// bộ (quy trình kí của phân hệ Quản lý kí hồ sơ 16k, 17b qua chỗ nối DossierSigner: bản đã ký có khối xác nhận và mã QR tra
// cứu), không ký hoặc trả lại. Văn thư cấp số và phát hành theo sổ văn bản đi (số đi, số ký hiệu, ngày ban hành, số bản);
// khi phát hành, đơn vị nhận trong trường nhận ngay một văn bản đến chờ vào sổ (liên thông nội bộ), đơn vị bên ngoài gửi
// qua trục là bản chạy nội bộ: văn thư gửi bằng cách khác rồi đánh dấu (DocumentExchange là chỗ nối). Văn bản đã ban hành
// công bố được lên website trường (cột published để phần 18f đọc), đóng băng, lưu hồ sơ. Lịch sử ghi ở
// outgoing_document_events. Chi tiết do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-140
export const OUTGOING_RULE_CODE = 'YCTD-140';
const DRAFT = PERMISSION_CODES.outgoingDocumentDraft;
const SIGN = PERMISSION_CODES.outgoingDocumentSign;
const ISSUE = PERMISSION_CODES.outgoingDocumentIssue;
const SEARCH = PERMISSION_CODES.outgoingDocumentSearch;
export const OUTGOING_PERMISSIONS = [DRAFT, SIGN, ISSUE, SEARCH];
const MAXIMUM_FILES = 30;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
// Mã tra cứu: 12 ký tự chữ hoa và số, bỏ các ký tự dễ nhầm (0, O, 1, I)
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const OPEN_OPINIONS: OutgoingOpinionStatus[] = ['pending', 'answered'];
const EDITABLE: OutgoingDocumentStatus[] = ['draft', 'consulting'];
const UPLOAD_KINDS: OutgoingFileKind[] = ['draft', 'submission', 'attachment'];

type Executor = Kysely<SystemDatabase> | Transaction<SystemDatabase>;
type DocumentExpression = ExpressionBuilder<SystemDatabase, 'outgoing_documents'>;

export type OutgoingAction =
  | 'update'
  | 'delete'
  | 'upload'
  | 'consult'
  | 'end_consult'
  | 'opinion'
  | 'finish_opinion'
  | 'submit'
  | 'revoke'
  | 'sign'
  | 'decline'
  | 'return'
  | 'issue'
  | 'send'
  | 'publish'
  | 'freeze'
  | 'archive';

interface DocumentRow {
  id: string;
  status: OutgoingDocumentStatus;
  eoffice_number: number;
  summary: string;
  symbol: string | null;
  created_by: string;
  drafter_id: string;
  signer_id: string | null;
  submitted_at: Date | null;
  frozen: boolean;
  published: boolean;
  secrecy_id: string | null;
}

interface OpinionRow {
  id: string;
  round: number;
  user_id: string;
  status: OutgoingOpinionStatus;
}

export interface BatchResult {
  id: string;
  ok: boolean;
  message: string | null;
}

const sha256 = (body: Buffer) => createHash('sha256').update(body).digest('hex');

export function verificationCode(): string {
  return [...randomBytes(12)].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

// Nội dung mã QR: địa chỉ trang tra cứu trên cổng của trường (lấy theo nguồn gửi yêu cầu, không ghi cứng tên miền); không
// có nguồn hợp lệ thì chỉ in mã
export function verificationText(code: string, origin: string | null): string {
  if (origin && /^https?:\/\/[^/\s]+$/.test(origin)) {
    return `${origin}/tra-cuu-van-ban?ma=${code}`;
  }
  return code;
}

@Injectable()
export class OutgoingDocumentsService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly fileStorage: FileStorage,
    private readonly admin: DocumentAdminService,
    private readonly exchange: DocumentExchange,
    private readonly signer: DossierSigner,
    private readonly clock: Clock,
  ) {}

  private get system(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

  today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  canIssue(currentUser: CurrentUser): boolean {
    return hasWholeSchool(currentUser, ISSUE);
  }

  private canSearch(currentUser: CurrentUser): boolean {
    return hasWholeSchool(currentUser, SEARCH);
  }

  private assertIssue(currentUser: CurrentUser): void {
    if (!this.canIssue(currentUser)) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Cần quyền văn thư (cấp số, phát hành văn bản đi) ở phạm vi toàn trường',
      );
    }
  }

  // Văn bản người dùng xem được: người tạo, người soạn thảo, người ký, người được lấy ý kiến; văn thư xem văn bản đã ký,
  // đã ban hành; người tra cứu xem văn bản từ khi trình ký
  private visible(currentUser: CurrentUser) {
    const me = currentUser.id;
    const clerk = this.canIssue(currentUser);
    const search = this.canSearch(currentUser);
    return (expression: DocumentExpression) =>
      expression.or([
        expression('outgoing_documents.created_by', '=', me),
        expression('outgoing_documents.drafter_id', '=', me),
        expression('outgoing_documents.signer_id', '=', me),
        expression.exists(
          expression
            .selectFrom('outgoing_document_opinions as mine')
            .select('mine.id')
            .whereRef('mine.document_id', '=', 'outgoing_documents.id')
            .where('mine.user_id', '=', me),
        ),
        ...(clerk ? [expression('outgoing_documents.status', 'in', ['signed', 'issued'] as const)] : []),
        ...(search
          ? [expression('outgoing_documents.status', 'in', ['pending_signature', 'signed', 'issued'] as const)]
          : []),
      ]);
  }

  private async event(executor: Executor, documentId: string, action: string, note: string | null, user: CurrentUser) {
    await executor
      .insertInto('outgoing_document_events')
      .values({
        document_id: documentId,
        action,
        note: note?.slice(0, 4000) ?? null,
        actor_id: user.id,
        actor_name: user.description.full_name,
      })
      .execute();
  }

  // Thông báo trong ứng dụng; chưa có năm học thì bỏ qua (hàng đợi thông báo ở cơ sở dữ liệu năm học)
  private async notify(userIds: Array<string | null>, document: DocumentRow, title: string, body: string) {
    const recipients = [...new Set(userIds.filter((id): id is string => id !== null))];
    if (recipients.length === 0) {
      return;
    }
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return;
    }
    await queueNotification(current.database as Kysely<SchoolYearDatabase>, {
      orgUnitId: null,
      templateCode: 'outgoing_document',
      title,
      body: `${body}: ${document.symbol ?? `Số eOffice ${document.eoffice_number}`} – ${document.summary.slice(0, 200)}`,
      targetType: 'outgoing_document',
      targetId: document.id,
      recipients: recipients.map((userId) => ({ userId, channel: 'in_app' })),
    });
  }

  private async findDocument(executor: Executor, id: string, lock = false): Promise<DocumentRow> {
    let query = executor
      .selectFrom('outgoing_documents')
      .select([
        'id',
        'status',
        'eoffice_number',
        'summary',
        'symbol',
        'created_by',
        'drafter_id',
        'signer_id',
        'submitted_at',
        'frozen',
        'published',
        'secrecy_id',
      ])
      .where('id', '=', id);
    if (lock) {
      query = query.forUpdate();
    }
    const row = await query.executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy văn bản đi', 'outgoing_document');
    }
    return row;
  }

  async assertVisible(currentUser: CurrentUser, id: string): Promise<DocumentRow> {
    const row = await this.system
      .selectFrom('outgoing_documents')
      .select('id')
      .where('id', '=', id)
      .where(this.visible(currentUser))
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy văn bản đi', 'outgoing_document');
    }
    return this.findDocument(this.system, id);
  }

  private opinions(executor: Executor, documentId: string): Promise<OpinionRow[]> {
    return executor
      .selectFrom('outgoing_document_opinions')
      .select(['id', 'round', 'user_id', 'status'])
      .where('document_id', '=', documentId)
      .orderBy('round')
      .orderBy('created_at')
      .execute();
  }

  // Dòng lấy ý kiến còn mở của người dùng ở đợt đang lấy ý kiến
  private openOpinionOf(document: DocumentRow, opinions: OpinionRow[], userId: string): OpinionRow | undefined {
    if (document.status !== 'consulting') {
      return undefined;
    }
    const round = Math.max(0, ...opinions.map((row) => row.round));
    return opinions.find((row) => row.round === round && row.user_id === userId && OPEN_OPINIONS.includes(row.status));
  }

  // Thao tác người dùng làm được trên văn bản, để cổng quản trị hiện nút; máy chủ kiểm tra lại ở từng thao tác
  actionsOf(document: DocumentRow, opinions: OpinionRow[], currentUser: CurrentUser): OutgoingAction[] {
    const me = currentUser.id;
    const owner = document.created_by === me || document.drafter_id === me;
    const clerk = this.canIssue(currentUser);
    const signer =
      document.signer_id === me && document.status === 'pending_signature' && currentUser.hasPermission(SIGN);
    const actions: OutgoingAction[] = [];
    if (EDITABLE.includes(document.status) && (owner || clerk)) {
      actions.push('update', 'upload', 'consult');
    }
    if (document.status === 'consulting' && (owner || clerk)) {
      actions.push('end_consult');
    }
    if (document.status === 'draft' && (owner || clerk)) {
      actions.push('submit');
      if (owner && document.submitted_at === null) {
        actions.push('delete');
      }
    }
    if (this.openOpinionOf(document, opinions, me)) {
      actions.push('opinion', 'finish_opinion');
    }
    if (document.status === 'pending_signature' && owner && !signer) {
      actions.push('revoke');
    }
    if (signer) {
      actions.push('sign', 'decline', 'return');
    }
    if (document.status === 'signed' && clerk) {
      actions.push('issue', 'return');
    }
    if (document.status === 'issued' && clerk) {
      actions.push('freeze');
      if (!document.frozen) {
        actions.push('send', 'publish', 'archive');
      }
    }
    if (document.status === 'issued' && owner && !document.frozen && !actions.includes('archive')) {
      actions.push('archive');
    }
    return actions;
  }

  private async assertAction(
    executor: Executor,
    documentId: string,
    currentUser: CurrentUser,
    action: OutgoingAction,
    message: string,
  ) {
    const document = await this.findDocument(executor, documentId, executor !== this.system);
    const opinions = await this.opinions(executor, documentId);
    const visible = await executor
      .selectFrom('outgoing_documents')
      .select('id')
      .where('id', '=', documentId)
      .where(this.visible(currentUser))
      .executeTakeFirst();
    if (!visible) {
      throw notFoundError('Không tìm thấy văn bản đi', 'outgoing_document');
    }
    if (!this.actionsOf(document, opinions, currentUser).includes(action)) {
      throw ruleViolationError(OUTGOING_RULE_CODE, message);
    }
    return { document, opinions };
  }

  // ---- Danh sách ----

  async list(currentUser: CurrentUser, filter: OutgoingListFilter, page: number, pageSize: number) {
    const me = currentUser.id;
    if (filter.view === 'to_issue' || filter.view === 'issued') {
      this.assertIssue(currentUser);
    }
    if (filter.view === 'search' && !this.canIssue(currentUser) && !this.canSearch(currentUser)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Cần quyền tra cứu văn bản đi hoặc quyền văn thư');
    }
    let query = this.system.selectFrom('outgoing_documents').where(this.visible(currentUser));
    const mineOpinion = (expression: DocumentExpression, statuses: OutgoingOpinionStatus[]) =>
      expression.exists(
        expression
          .selectFrom('outgoing_document_opinions as mine')
          .select('mine.id')
          .whereRef('mine.document_id', '=', 'outgoing_documents.id')
          .where('mine.user_id', '=', me)
          .where('mine.status', 'in', statuses),
      );
    switch (filter.view) {
      // Dự thảo: văn bản mình soạn còn ở dự thảo, đang lấy ý kiến
      case 'drafts':
        query = query
          .where((expression) =>
            expression.or([
              expression('outgoing_documents.created_by', '=', me),
              expression('outgoing_documents.drafter_id', '=', me),
            ]),
          )
          .where('outgoing_documents.status', 'in', ['draft', 'consulting']);
        break;
      // Chờ xử lý: chờ mình cho ý kiến hoặc chờ mình ký
      case 'pending':
        query = query.where((expression) =>
          expression.or([
            expression.and([
              expression('outgoing_documents.status', '=', 'consulting'),
              mineOpinion(expression, OPEN_OPINIONS),
            ]),
            expression.and([
              expression('outgoing_documents.status', '=', 'pending_signature'),
              expression('outgoing_documents.signer_id', '=', me),
            ]),
          ]),
        );
        break;
      // Đã xử lý: mình đã cho ý kiến, đã ký, hoặc văn bản mình soạn đã qua dự thảo
      case 'processed':
        query = query.where((expression) =>
          expression.or([
            mineOpinion(expression, ['finished', 'closed']),
            expression.and([
              expression('outgoing_documents.signer_id', '=', me),
              expression('outgoing_documents.status', 'in', ['signed', 'issued']),
            ]),
            expression.and([
              expression.or([
                expression('outgoing_documents.created_by', '=', me),
                expression('outgoing_documents.drafter_id', '=', me),
              ]),
              expression('outgoing_documents.status', 'in', ['pending_signature', 'signed', 'issued']),
            ]),
          ]),
        );
        break;
      case 'to_issue':
        query = query.where('outgoing_documents.status', '=', 'signed');
        break;
      case 'issued':
        query = query.where('outgoing_documents.status', '=', 'issued');
        break;
      case 'search':
        break;
    }
    if (filter.q) {
      query = query.where('outgoing_documents.summary', 'ilike', `%${escapeLike(filter.q)}%`);
    }
    if (filter.symbol) {
      query = query.where('outgoing_documents.symbol', 'ilike', `%${escapeLike(filter.symbol)}%`);
    }
    if (filter.issue_number) {
      query = query.where('outgoing_documents.issue_number', '=', filter.issue_number);
    }
    if (filter.signer) {
      query = query.where('outgoing_documents.signer_name', 'ilike', `%${escapeLike(filter.signer)}%`);
    }
    if (filter.issue_from) {
      query = query.where('outgoing_documents.issue_date', '>=', filter.issue_from);
    }
    if (filter.issue_to) {
      query = query.where('outgoing_documents.issue_date', '<=', filter.issue_to);
    }
    for (const key of ['book_id', 'form_id', 'urgency_id'] as const) {
      const value = filter[key];
      if (value) {
        query = query.where(`outgoing_documents.${key}`, '=', value);
      }
    }
    if (filter.published) {
      query = query.where('outgoing_documents.published', '=', true);
    }
    const total = await query
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    const items = await query
      .leftJoin('document_books', 'document_books.id', 'outgoing_documents.book_id')
      .leftJoin('document_catalog_items as form', 'form.id', 'outgoing_documents.form_id')
      .leftJoin('document_catalog_items as urgency', 'urgency.id', 'outgoing_documents.urgency_id')
      .leftJoin('document_catalog_items as secrecy', 'secrecy.id', 'outgoing_documents.secrecy_id')
      .select([
        'outgoing_documents.id',
        'outgoing_documents.eoffice_number',
        'outgoing_documents.submission_number',
        'outgoing_documents.summary',
        'outgoing_documents.status',
        'outgoing_documents.priority',
        'outgoing_documents.drafter_name',
        'outgoing_documents.drafting_unit_name',
        'outgoing_documents.signer_name',
        'outgoing_documents.book_id',
        'document_books.name as book_name',
        'outgoing_documents.issue_number',
        'outgoing_documents.symbol',
        'outgoing_documents.issue_date',
        'outgoing_documents.copies',
        'outgoing_documents.published',
        'outgoing_documents.frozen',
        'outgoing_documents.updated_at',
        'form.name as form_name',
        'urgency.name as urgency_name',
        'urgency.level as urgency_level',
        'secrecy.name as secrecy_name',
        (expression) =>
          sql<number>`(select count(*)::int from outgoing_document_recipients recipients
            where recipients.document_id = ${expression.ref('outgoing_documents.id')}
              and recipients.send_status = 'pending')`.as('pending_recipients'),
      ])
      .orderBy('outgoing_documents.issue_date', (order) => order.desc().nullsFirst())
      .orderBy('outgoing_documents.issue_number', (order) => order.desc().nullsFirst())
      .orderBy('outgoing_documents.updated_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute();
    return { items, total: Number(total.count), page, page_size: pageSize };
  }

  // Liên thông văn bản đi: các đơn vị nhận của văn bản đã ban hành theo trạng thái gửi
  async recipients(currentUser: CurrentUser, status: 'pending' | 'sent' | 'delivered' | 'all') {
    this.assertIssue(currentUser);
    let query = this.system
      .selectFrom('outgoing_document_recipients as recipient')
      .innerJoin('outgoing_documents as document', 'document.id', 'recipient.document_id')
      .select([
        'recipient.id',
        'recipient.document_id',
        'recipient.recipient_type',
        'recipient.name',
        'recipient.electronic_code',
        'recipient.send_status',
        'recipient.sent_at',
        'recipient.sent_by_name',
        'recipient.reference',
        'document.symbol',
        'document.summary',
        'document.issue_date',
        'document.frozen',
      ])
      .where('document.status', '=', 'issued');
    if (status !== 'all') {
      query = query.where('recipient.send_status', '=', status);
    }
    return query
      .orderBy('document.issue_date', 'desc')
      .orderBy('document.issue_number', 'desc')
      .orderBy('recipient.sort_order')
      .limit(500)
      .execute();
  }

  // ---- Chi tiết ----

  async view(currentUser: CurrentUser, id: string) {
    await this.assertVisible(currentUser, id);
    const document = await this.system
      .selectFrom('outgoing_documents')
      .leftJoin('document_books', 'document_books.id', 'outgoing_documents.book_id')
      .leftJoin('document_catalog_items as form', 'form.id', 'outgoing_documents.form_id')
      .leftJoin('document_catalog_items as urgency', 'urgency.id', 'outgoing_documents.urgency_id')
      .leftJoin('document_catalog_items as secrecy', 'secrecy.id', 'outgoing_documents.secrecy_id')
      .leftJoin('document_catalog_items as field', 'field.id', 'outgoing_documents.field_id')
      .leftJoin('archive_records', 'archive_records.id', 'outgoing_documents.archive_record_id')
      .leftJoin('incoming_documents as reply', 'reply.id', 'outgoing_documents.reply_to_id')
      .selectAll('outgoing_documents')
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
        'reply.symbol as reply_to_symbol',
        'reply.summary as reply_to_summary',
      ])
      .where('outgoing_documents.id', '=', id)
      .executeTakeFirstOrThrow();
    const files = await this.system
      .selectFrom('outgoing_document_files')
      .select(['id', 'kind', 'file_name', 'content_type', 'size_bytes', 'sha256', 'created_by_name', 'created_at'])
      .where('document_id', '=', id)
      .orderBy('created_at')
      .execute();
    const links = await this.system
      .selectFrom('outgoing_document_links as link')
      .leftJoin('outgoing_documents as outgoing', 'outgoing.id', 'link.outgoing_id')
      .leftJoin('incoming_documents as incoming', 'incoming.id', 'link.incoming_id')
      .select([
        'link.id',
        'link.link_type',
        'link.outgoing_id',
        'link.incoming_id',
        sql<string>`coalesce(outgoing.symbol, 'eOffice ' || outgoing.eoffice_number::text, incoming.symbol)`.as(
          'symbol',
        ),
        sql<string>`coalesce(outgoing.summary, incoming.summary)`.as('summary'),
      ])
      .where('link.document_id', '=', id)
      .execute();
    const opinions = await this.system
      .selectFrom('outgoing_document_opinions')
      .selectAll()
      .where('document_id', '=', id)
      .orderBy('round')
      .orderBy('created_at')
      .orderBy('user_name')
      .execute();
    const recipients = await this.system
      .selectFrom('outgoing_document_recipients')
      .selectAll()
      .where('document_id', '=', id)
      .orderBy('sort_order')
      .execute();
    const events = await this.system
      .selectFrom('outgoing_document_events')
      .select(['id', 'action', 'note', 'actor_name', 'created_at'])
      .where('document_id', '=', id)
      .orderBy('created_at')
      .execute();
    const row = await this.findDocument(this.system, id);
    const opinionRows = opinions.map(({ id: opinionId, round, user_id, status }) => ({
      id: opinionId,
      round,
      user_id,
      status,
    }));
    return {
      ...document,
      files,
      links,
      opinions,
      recipients,
      events,
      my_open_opinion_id: this.openOpinionOf(row, opinionRows, currentUser.id)?.id ?? null,
      actions: this.actionsOf(row, opinionRows, currentUser),
      exchange: { connected: this.exchange.connected, description: this.exchange.description },
      signer_description: this.signer.description,
    };
  }

  // ---- Dự thảo: tạo, cập nhật, xóa ----

  // Kiểm tra mã danh mục, người soạn, đơn vị soạn thảo, người ký; trả tên ghi lại
  private async resolveInput(executor: Executor, currentUser: CurrentUser, input: OutgoingDocumentInput) {
    const errors: Array<{ field: string; message: string }> = [];
    const ids = [input.form_id, input.urgency_id, input.secrecy_id, input.field_id].filter(
      (value): value is string => value !== null,
    );
    const items = ids.length
      ? await executor.selectFrom('document_catalog_items').select(['id', 'kind']).where('id', 'in', ids).execute()
      : [];
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
    // Người soạn thảo: mặc định là người tạo; tên lấy theo hồ sơ nhân sự (không có hồ sơ thì theo tài khoản)
    const drafterId = input.drafter_id ?? currentUser.id;
    const account = (await this.admin.staffAccounts([drafterId]))[0];
    const drafter = { id: drafterId, name: account?.full_name ?? currentUser.description.full_name };
    if (!account && drafterId !== currentUser.id) {
      errors.push({ field: 'drafter_id', message: 'Người soạn thảo không phải nhân sự đang làm việc có tài khoản' });
    }
    let unitName: string | null = null;
    if (input.drafting_unit_id) {
      const current = await this.currentSchoolYear.find();
      const unit = current
        ? await current.database
            .selectFrom('org_units')
            .select('name')
            .where('id', '=', input.drafting_unit_id)
            .executeTakeFirst()
        : undefined;
      if (!unit) {
        errors.push({ field: 'drafting_unit_id', message: 'Không tìm thấy đơn vị' });
      }
      unitName = unit?.name ?? null;
    }
    let signer: { signer_id: string | null; signer_name: string | null; signer_title: string | null } = {
      signer_id: null,
      signer_name: null,
      signer_title: null,
    };
    if (input.signer_id) {
      const leader = await executor
        .selectFrom('document_leaders')
        .select(['user_id', 'user_name', 'title'])
        .where('user_id', '=', input.signer_id)
        .executeTakeFirst();
      if (!leader) {
        errors.push({
          field: 'signer_id',
          message: 'Người ký chọn trong danh sách lãnh đạo (Quản trị văn bản, mục 2.5)',
        });
      } else {
        signer = { signer_id: leader.user_id, signer_name: leader.user_name, signer_title: leader.title };
      }
    }
    if (input.reply_to_id) {
      const incoming = await executor
        .selectFrom('incoming_documents')
        .select('id')
        .where('id', '=', input.reply_to_id)
        .executeTakeFirst();
      if (!incoming) {
        errors.push({ field: 'reply_to_id', message: 'Không tìm thấy văn bản đến được trả lời' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    // Người soạn thảo, người ký ghi theo mã đã kiểm tra (ghi đè giá trị gửi lên)
    return {
      ...input,
      ...signer,
      drafter_id: drafter.id,
      drafter_name: drafter.name,
      drafting_unit_name: unitName,
    };
  }

  // Đơn vị nhận: đơn vị bên ngoài ở danh mục 2.2 (đang dùng), đơn vị trong trường ở cây đơn vị năm học
  private async resolveRecipients(executor: Executor, recipients: RecipientInput[]) {
    const externalIds = recipients.flatMap((item) => (item.external_unit_id ? [item.external_unit_id] : []));
    const internalIds = recipients.flatMap((item) => (item.org_unit_id ? [item.org_unit_id] : []));
    const externals = externalIds.length
      ? await executor
          .selectFrom('external_units')
          .select(['id', 'name', 'electronic_code'])
          .where('id', 'in', externalIds)
          .where('active', '=', true)
          .execute()
      : [];
    let internals: Array<{ id: string; name: string }> = [];
    if (internalIds.length > 0) {
      const current = await this.currentSchoolYear.require();
      internals = await current.database
        .selectFrom('org_units')
        .select(['id', 'name'])
        .where('id', 'in', internalIds)
        .execute();
    }
    const resolved = recipients.map((item, index) => {
      if (item.external_unit_id) {
        const unit = externals.find((external) => external.id === item.external_unit_id);
        return unit
          ? {
              recipient_type: 'external' as const,
              external_unit_id: unit.id,
              org_unit_id: null,
              name: unit.name,
              electronic_code: unit.electronic_code,
              sort_order: index,
            }
          : null;
      }
      const unit = internals.find((internal) => internal.id === item.org_unit_id);
      return unit
        ? {
            recipient_type: 'internal' as const,
            external_unit_id: null,
            org_unit_id: unit.id,
            name: unit.name,
            electronic_code: null,
            sort_order: index,
          }
        : null;
    });
    if (resolved.some((item) => item === null)) {
      throw validationError([{ field: 'recipients', message: 'Có đơn vị nhận không tìm thấy hoặc ngừng sử dụng' }]);
    }
    return resolved as Array<NonNullable<(typeof resolved)[number]>>;
  }

  private async replaceRecipients(transaction: Transaction<SystemDatabase>, id: string, recipients: RecipientInput[]) {
    const rows = await this.resolveRecipients(transaction, recipients);
    await transaction.deleteFrom('outgoing_document_recipients').where('document_id', '=', id).execute();
    if (rows.length > 0) {
      await transaction
        .insertInto('outgoing_document_recipients')
        .values(rows.map((row) => ({ ...row, document_id: id })))
        .execute();
    }
  }

  private async replaceLinks(transaction: Transaction<SystemDatabase>, id: string, links: LinkInput[]) {
    const outgoingIds = links.flatMap((link) => (link.outgoing_id ? [link.outgoing_id] : []));
    const incomingIds = links.flatMap((link) => (link.incoming_id ? [link.incoming_id] : []));
    if (outgoingIds.includes(id)) {
      throw validationError([{ field: 'links', message: 'Văn bản không liên quan với chính nó' }]);
    }
    const foundOutgoing = outgoingIds.length
      ? await transaction.selectFrom('outgoing_documents').select('id').where('id', 'in', outgoingIds).execute()
      : [];
    const foundIncoming = incomingIds.length
      ? await transaction.selectFrom('incoming_documents').select('id').where('id', 'in', incomingIds).execute()
      : [];
    if (foundOutgoing.length !== new Set(outgoingIds).size || foundIncoming.length !== new Set(incomingIds).size) {
      throw validationError([{ field: 'links', message: 'Có văn bản liên quan không tìm thấy' }]);
    }
    await transaction.deleteFrom('outgoing_document_links').where('document_id', '=', id).execute();
    const unique = new Map(
      links.map((link) => [`${link.link_type}:${link.outgoing_id ?? link.incoming_id}`, link] as const),
    );
    if (unique.size > 0) {
      await transaction
        .insertInto('outgoing_document_links')
        .values([...unique.values()].map((link) => ({ ...link, document_id: id })))
        .execute();
    }
  }

  async create(
    currentUser: CurrentUser,
    rawInput: OutgoingDocumentInput,
    recipients: RecipientInput[] | undefined,
    links: LinkInput[] | undefined,
  ) {
    const id = await this.system.transaction().execute(async (transaction) => {
      const input = await this.resolveInput(transaction, currentUser, rawInput);
      // Số eOffice: số thứ tự toàn phần mềm, khóa để hai lần tạo cùng lúc không trùng
      await sql`select pg_advisory_xact_lock(hashtext('outgoing-documents:eoffice'))`.execute(transaction);
      const last = await transaction
        .selectFrom('outgoing_documents')
        .select((expression) => expression.fn.max('eoffice_number').as('maximum'))
        .executeTakeFirst();
      const row = await transaction
        .insertInto('outgoing_documents')
        .values({
          ...input,
          eoffice_number: Number(last?.maximum ?? 0) + 1,
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (recipients) {
        await this.replaceRecipients(transaction, row.id, recipients);
      }
      if (links) {
        await this.replaceLinks(transaction, row.id, links);
      }
      await this.event(transaction, row.id, 'create', null, currentUser);
      return row.id;
    });
    return this.view(currentUser, id);
  }

  async update(
    currentUser: CurrentUser,
    id: string,
    rawInput: OutgoingDocumentInput,
    recipients: RecipientInput[] | undefined,
    links: LinkInput[] | undefined,
  ) {
    await this.system.transaction().execute(async (transaction) => {
      await this.assertAction(transaction, id, currentUser, 'update', 'Chỉ sửa văn bản còn ở dự thảo, đang lấy ý kiến');
      const input = await this.resolveInput(transaction, currentUser, rawInput);
      await transaction
        .updateTable('outgoing_documents')
        .set({ ...input, updated_at: this.clock.now() })
        .where('id', '=', id)
        .execute();
      if (recipients) {
        await this.replaceRecipients(transaction, id, recipients);
      }
      if (links) {
        await this.replaceLinks(transaction, id, links);
      }
      await this.event(transaction, id, 'update', null, currentUser);
    });
    return this.view(currentUser, id);
  }

  async remove(currentUser: CurrentUser, id: string): Promise<void> {
    const keys = await this.system.transaction().execute(async (transaction) => {
      await this.assertAction(transaction, id, currentUser, 'delete', 'Chỉ người soạn xóa dự thảo chưa trình ký');
      const files = await transaction
        .selectFrom('outgoing_document_files')
        .select('storage_key')
        .where('document_id', '=', id)
        .execute();
      await transaction.deleteFrom('outgoing_documents').where('id', '=', id).execute();
      return files.map((file) => file.storage_key);
    });
    for (const key of keys) {
      await this.fileStorage.delete(key).catch(() => undefined);
    }
  }

  // ---- Tệp ----

  async addFile(
    currentUser: CurrentUser,
    id: string,
    upload: { fileName: string; body: Buffer; kind: OutgoingFileKind },
  ) {
    if (!UPLOAD_KINDS.includes(upload.kind)) {
      throw validationError([{ field: 'kind', message: 'Chọn tệp dự thảo, file phiếu trình hoặc văn bản gửi kèm' }]);
    }
    await this.assertAction(this.system, id, currentUser, 'upload', 'Chỉ đính kèm tệp khi văn bản còn ở dự thảo');
    if (upload.body.length > OUTGOING_MAXIMUM_FILE_BYTES) {
      throw validationError([{ field: 'file', message: 'Tệp đính kèm tối đa 50 MB' }]);
    }
    const contentType = detectArchiveFileType(upload.fileName, upload.body);
    if (!contentType) {
      throw validationError([
        { field: 'file', message: 'Tệp đính kèm là PDF, ảnh JPEG, PNG, Word (.doc, .docx) hoặc Excel (.xls, .xlsx)' },
      ]);
    }
    const key = storageKey('outgoing-documents', id, randomUUID());
    await this.fileStorage.put(key, upload.body, contentType);
    try {
      await this.system.transaction().execute(async (transaction) => {
        await sql`select pg_advisory_xact_lock(hashtext(${`outgoing-document-files:${id}`}))`.execute(transaction);
        const count = await transaction
          .selectFrom('outgoing_document_files')
          .select((expression) => expression.fn.countAll<string>().as('count'))
          .where('document_id', '=', id)
          .executeTakeFirstOrThrow();
        if (Number(count.count) >= MAXIMUM_FILES) {
          throw ruleViolationError(OUTGOING_RULE_CODE, `Mỗi văn bản đính kèm tối đa ${MAXIMUM_FILES} tệp`);
        }
        await transaction
          .insertInto('outgoing_document_files')
          .values({
            document_id: id,
            kind: upload.kind,
            file_name: upload.fileName.slice(0, 200),
            content_type: contentType,
            size_bytes: upload.body.length,
            sha256: sha256(upload.body),
            storage_key: key,
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
      .selectFrom('outgoing_document_files')
      .select(['file_name', 'content_type', 'storage_key'])
      .where('id', '=', fileId)
      .where('document_id', '=', id)
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp đính kèm', 'outgoing_document_file');
    }
    return {
      fileName: file.file_name,
      contentType: file.content_type,
      body: await this.fileStorage.get(file.storage_key),
    };
  }

  async deleteFile(currentUser: CurrentUser, id: string, fileId: string) {
    const file = await this.system.transaction().execute(async (transaction) => {
      await this.assertAction(transaction, id, currentUser, 'upload', 'Chỉ xóa tệp khi văn bản còn ở dự thảo');
      const row = await transaction
        .selectFrom('outgoing_document_files')
        .select(['file_name', 'storage_key', 'kind'])
        .where('id', '=', fileId)
        .where('document_id', '=', id)
        .executeTakeFirst();
      if (!row) {
        throw notFoundError('Không tìm thấy tệp đính kèm', 'outgoing_document_file');
      }
      await transaction.deleteFrom('outgoing_document_files').where('id', '=', fileId).execute();
      await this.event(transaction, id, 'file_delete', row.file_name, currentUser);
      return row;
    });
    await this.fileStorage.delete(file.storage_key).catch(() => undefined);
    return this.view(currentUser, id);
  }

  // ---- Lấy ý kiến, cho ý kiến ----

  // Lấy ý kiến: mở đợt mới (văn bản đang ở dự thảo) hoặc hỏi thêm người trong đợt đang mở
  async consult(currentUser: CurrentUser, id: string, input: ConsultInput) {
    const { document, notified } = await this.system.transaction().execute(async (transaction) => {
      const { document, opinions } = await this.assertAction(
        transaction,
        id,
        currentUser,
        'consult',
        'Chỉ lấy ý kiến khi văn bản còn ở dự thảo',
      );
      if (input.deadline && input.deadline < this.today()) {
        throw validationError([{ field: 'deadline', message: 'Hạn cho ý kiến không trước hôm nay' }]);
      }
      const accounts = await this.admin.resolveAccounts(input.user_ids, 'user_ids');
      const last = Math.max(0, ...opinions.map((row) => row.round));
      const round = document.status === 'consulting' ? last : last + 1;
      const asked = new Set(opinions.filter((row) => row.round === round).map((row) => row.user_id));
      const fresh = input.user_ids.filter((userId) => !asked.has(userId));
      if (fresh.length === 0) {
        throw ruleViolationError(OUTGOING_RULE_CODE, 'Những người đã chọn đều đã được lấy ý kiến trong đợt này');
      }
      await transaction
        .insertInto('outgoing_document_opinions')
        .values(
          fresh.map((userId) => {
            const account = accounts.get(userId);
            return {
              document_id: id,
              round,
              user_id: userId,
              user_name: account?.full_name ?? '',
              user_title: account?.job_title_name ?? null,
              deadline: input.deadline,
              request_note: input.note,
              requested_by: currentUser.id,
              requested_by_name: currentUser.description.full_name,
            };
          }),
        )
        .execute();
      await transaction
        .updateTable('outgoing_documents')
        .set({ status: 'consulting', updated_at: this.clock.now() })
        .where('id', '=', id)
        .execute();
      await this.event(
        transaction,
        id,
        'consult',
        `Đợt ${round}: ${fresh.map((userId) => accounts.get(userId)?.full_name).join(', ')}`,
        currentUser,
      );
      return { document, notified: fresh };
    });
    await this.notify(notified, document, 'Lấy ý kiến văn bản đi', 'Đề nghị cho ý kiến dự thảo');
    return this.view(currentUser, id);
  }

  // Cho ý kiến (sửa được tới khi kết thúc cho ý kiến) hoặc kết thúc cho ý kiến
  async giveOpinion(currentUser: CurrentUser, id: string, opinion: string | null, finish: boolean) {
    const document = await this.system.transaction().execute(async (transaction) => {
      const { document, opinions } = await this.assertAction(
        transaction,
        id,
        currentUser,
        finish ? 'finish_opinion' : 'opinion',
        'Bạn không có đề nghị cho ý kiến đang mở ở văn bản này',
      );
      const row = this.openOpinionOf(document, opinions, currentUser.id) as OpinionRow;
      if (!finish && !opinion) {
        throw validationError([{ field: 'opinion', message: 'Bắt buộc nhập' }]);
      }
      const now = this.clock.now();
      await transaction
        .updateTable('outgoing_document_opinions')
        .set({
          status: finish ? 'finished' : 'answered',
          ...(opinion ? { opinion, answered_at: now } : {}),
          ...(finish ? { finished_at: now } : {}),
        })
        .where('id', '=', row.id)
        .execute();
      await this.event(transaction, id, finish ? 'finish_opinion' : 'opinion', opinion, currentUser);
      return document;
    });
    await this.notify(
      [document.drafter_id, document.created_by].filter((userId) => userId !== currentUser.id),
      document,
      'Ý kiến về dự thảo',
      `${currentUser.description.full_name} ${finish ? 'kết thúc cho ý kiến' : 'cho ý kiến'}`,
    );
    return this.view(currentUser, id);
  }

  // Kết thúc lấy ý kiến: người chưa cho ý kiến đóng lại, văn bản về dự thảo
  async endConsultation(currentUser: CurrentUser, id: string) {
    await this.system.transaction().execute(async (transaction) => {
      await this.assertAction(transaction, id, currentUser, 'end_consult', 'Văn bản không đang lấy ý kiến');
      const now = this.clock.now();
      await transaction
        .updateTable('outgoing_document_opinions')
        .set({ status: 'finished', finished_at: now })
        .where('document_id', '=', id)
        .where('status', '=', 'answered')
        .execute();
      const closed = await transaction
        .updateTable('outgoing_document_opinions')
        .set({ status: 'closed', finished_at: now })
        .where('document_id', '=', id)
        .where('status', '=', 'pending')
        .executeTakeFirst();
      await transaction
        .updateTable('outgoing_documents')
        .set({ status: 'draft', updated_at: now })
        .where('id', '=', id)
        .execute();
      await this.event(
        transaction,
        id,
        'end_consult',
        Number(closed.numUpdatedRows) > 0 ? `${closed.numUpdatedRows} người chưa cho ý kiến` : null,
        currentUser,
      );
    });
    return this.view(currentUser, id);
  }

  // ---- Trình ký, lấy lại, ký, không ký, trả lại ----

  async submit(currentUser: CurrentUser, id: string, signerId: string | null, note: string | null) {
    const document = await this.system.transaction().execute(async (transaction) => {
      const { document } = await this.assertAction(
        transaction,
        id,
        currentUser,
        'submit',
        'Chỉ trình ký văn bản ở dự thảo (kết thúc lấy ý kiến trước)',
      );
      let signer = await transaction
        .selectFrom('outgoing_documents')
        .select(['signer_id', 'signer_name', 'signer_title'])
        .where('id', '=', id)
        .executeTakeFirstOrThrow();
      if (signerId) {
        const leader = await transaction
          .selectFrom('document_leaders')
          .select(['user_id', 'user_name', 'title'])
          .where('user_id', '=', signerId)
          .executeTakeFirst();
        if (!leader) {
          throw validationError([
            { field: 'signer_id', message: 'Người ký chọn trong danh sách lãnh đạo (Quản trị văn bản, mục 2.5)' },
          ]);
        }
        signer = { signer_id: leader.user_id, signer_name: leader.user_name, signer_title: leader.title };
      }
      if (!signer.signer_id) {
        throw validationError([{ field: 'signer_id', message: 'Chọn người ký' }]);
      }
      const draft = await transaction
        .selectFrom('outgoing_document_files')
        .select('id')
        .where('document_id', '=', id)
        .where('kind', '=', 'draft')
        .executeTakeFirst();
      if (!draft) {
        throw ruleViolationError(OUTGOING_RULE_CODE, 'Đính kèm tệp dự thảo trước khi trình ký');
      }
      await transaction
        .updateTable('outgoing_documents')
        .set({
          ...signer,
          status: 'pending_signature',
          submitted_at: this.clock.now(),
          return_note: null,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, 'submit', [signer.signer_name, note].filter(Boolean).join(': '), currentUser);
      return { ...document, signer_id: signer.signer_id };
    });
    await this.notify([document.signer_id], document, 'Trình ký văn bản đi', 'Văn bản chờ bạn ký');
    return this.view(currentUser, id);
  }

  // Lấy lại: người soạn rút văn bản đang chờ ký về dự thảo
  async revoke(currentUser: CurrentUser, id: string) {
    await this.system.transaction().execute(async (transaction) => {
      await this.assertAction(transaction, id, currentUser, 'revoke', 'Chỉ lấy lại văn bản mình soạn đang chờ ký');
      await transaction
        .updateTable('outgoing_documents')
        .set({ status: 'draft', updated_at: this.clock.now() })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, 'revoke', null, currentUser);
    });
    return this.view(currentUser, id);
  }

  // Ký nội bộ: lập bản đã ký qua DossierSigner (khối xác nhận, ảnh con dấu, mã QR tra cứu) khi chứng thư số nhà trường đã
  // đăng ký kí nội bộ (mục 1.1 của Quản lý kí hồ sơ) và còn hiệu lực, như kí hồ sơ ở 16k
  async sign(currentUser: CurrentUser, id: string, origin: string | null) {
    const { document } = await this.assertAction(
      this.system,
      id,
      currentUser,
      'sign',
      'Chỉ người ký được trình ký văn bản đang chờ ký',
    );
    const certificate = await this.system.selectFrom('signing_certificates').selectAll().executeTakeFirst();
    if (certificate?.status !== 'registered') {
      throw ruleViolationError(
        OUTGOING_RULE_CODE,
        'Chứng thư số nhà trường chưa đăng ký kí nội bộ (Quản lý kí hồ sơ, mục 1.1); đăng ký trước khi ký văn bản',
      );
    }
    if (certificate.valid_to && certificate.valid_to < this.today()) {
      throw ruleViolationError(OUTGOING_RULE_CODE, 'Chứng thư số nhà trường đã hết hiệu lực');
    }
    if (!isSigningProvider(certificate.provider)) {
      throw ruleViolationError(
        OUTGOING_RULE_CODE,
        'Nhà phát hành chứng thư không có trong danh sách của Sở; đăng ký lại chứng thư (Quản lý kí hồ sơ, mục 1.1)',
      );
    }
    const detail = await this.system
      .selectFrom('outgoing_documents')
      .leftJoin('document_catalog_items as form', 'form.id', 'outgoing_documents.form_id')
      .leftJoin('document_catalog_items as urgency', 'urgency.id', 'outgoing_documents.urgency_id')
      .select([
        'outgoing_documents.eoffice_number',
        'outgoing_documents.submission_number',
        'outgoing_documents.summary',
        'outgoing_documents.drafter_name',
        'outgoing_documents.drafting_unit_name',
        'outgoing_documents.signer_title',
        'outgoing_documents.insert_qr',
        'form.name as form_name',
        'urgency.name as urgency_name',
      ])
      .where('outgoing_documents.id', '=', id)
      .executeTakeFirstOrThrow();
    const draft = await this.system
      .selectFrom('outgoing_document_files')
      .select(['file_name', 'sha256', 'storage_key'])
      .where('document_id', '=', id)
      .where('kind', '=', 'draft')
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
    if (!draft) {
      throw ruleViolationError(OUTGOING_RULE_CODE, 'Văn bản chưa có tệp dự thảo để ký');
    }
    const sealImage =
      certificate.seal_storage_key && certificate.seal_content_type
        ? `data:${certificate.seal_content_type};base64,${(await this.fileStorage.get(certificate.seal_storage_key)).toString('base64')}`
        : null;
    const code = verificationCode();
    const signedAt = this.clock.now();
    const title = 'VĂN BẢN ĐI ĐÃ KÝ';
    const result = await this.signer.sign({
      code: `VBDI-${detail.eoffice_number}`,
      title,
      heading: [
        title,
        `Số eOffice ${detail.eoffice_number}${detail.submission_number ? `; số trình ký ${detail.submission_number}` : ''}`,
      ],
      sheets: [
        {
          title,
          columns: [
            { key: 'label', label: 'Thông tin', width: 22 },
            { key: 'value', label: 'Nội dung', width: 70 },
          ],
          rows: [
            { label: 'Trích yếu', value: detail.summary },
            { label: 'Hình thức', value: detail.form_name ?? '' },
            { label: 'Độ khẩn', value: detail.urgency_name ?? '' },
            { label: 'Người soạn thảo', value: detail.drafter_name },
            { label: 'Đơn vị soạn thảo', value: detail.drafting_unit_name ?? '' },
            { label: 'Tệp dự thảo đã ký', value: draft.file_name },
            { label: 'Mã băm SHA-256 của tệp dự thảo', value: draft.sha256 },
          ],
        },
      ],
      originalPdf: await this.fileStorage.get(draft.storage_key),
      originalSha256: draft.sha256,
      signedAt,
      signerName: [currentUser.description.full_name, detail.signer_title].filter(Boolean).join(', '),
      certificate: {
        signatureTypeLabel: SIGNING_SIGNATURE_TYPE_LABELS[certificate.signature_type],
        provider: certificate.provider,
        holderName: certificate.holder_name,
        holderTitle: certificate.holder_title,
        serialNumber: certificate.serial_number,
      },
      sealImage,
      verification: detail.insert_qr ? { code, text: verificationText(code, origin) } : null,
    });
    const key = storageKey('outgoing-documents', id, randomUUID());
    await this.fileStorage.put(key, result.pdf, CONTENT_TYPES.pdf);
    try {
      await this.system.transaction().execute(async (transaction) => {
        const changed = await transaction
          .updateTable('outgoing_documents')
          .set({
            status: 'signed',
            signed_at: signedAt,
            signature_method: result.method,
            verification_code: code,
            updated_at: signedAt,
          })
          .where('id', '=', id)
          .where('status', '=', 'pending_signature')
          .where('signer_id', '=', currentUser.id)
          .executeTakeFirst();
        if (Number(changed.numUpdatedRows) !== 1) {
          throw ruleViolationError(OUTGOING_RULE_CODE, 'Văn bản không còn chờ bạn ký');
        }
        await transaction
          .insertInto('outgoing_document_files')
          .values({
            document_id: id,
            kind: 'signed',
            file_name: `van-ban-di-${detail.eoffice_number}-da-ky.pdf`,
            content_type: CONTENT_TYPES.pdf,
            size_bytes: result.pdf.length,
            sha256: sha256(result.pdf),
            storage_key: key,
            created_by: currentUser.id,
            created_by_name: currentUser.description.full_name,
          })
          .execute();
        await this.event(transaction, id, 'sign', this.signer.digital ? 'Ký số' : 'Ký xác nhận nội bộ', currentUser);
      });
    } catch (error) {
      await this.fileStorage.delete(key).catch(() => undefined);
      throw error;
    }
    await this.notify(
      [document.drafter_id, document.created_by],
      document,
      'Văn bản đi đã ký',
      'Văn bản đã ký, chờ văn thư cấp số',
    );
    return this.view(currentUser, id);
  }

  // Không ký (người ký từ chối), trả lại (người ký hoặc văn thư trả về để sửa): văn bản về dự thảo; trả lại sau khi ký thì
  // bỏ bản đã ký
  async giveBack(currentUser: CurrentUser, id: string, decline: boolean, note: string) {
    const { document, keys } = await this.system.transaction().execute(async (transaction) => {
      const { document } = await this.assertAction(
        transaction,
        id,
        currentUser,
        decline ? 'decline' : 'return',
        decline ? 'Chỉ người ký không ký văn bản đang chờ mình ký' : 'Không trả lại được văn bản này',
      );
      const signed = await transaction
        .deleteFrom('outgoing_document_files')
        .where('document_id', '=', id)
        .where('kind', '=', 'signed')
        .returning('storage_key')
        .execute();
      const now = this.clock.now();
      await transaction
        .updateTable('outgoing_documents')
        .set({
          status: 'draft',
          return_note: note,
          returned_at: now,
          returned_by_name: currentUser.description.full_name,
          signed_at: null,
          signature_method: null,
          verification_code: null,
          updated_at: now,
        })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, decline ? 'decline' : 'return', note, currentUser);
      return { document, keys: signed.map((row) => row.storage_key) };
    });
    for (const key of keys) {
      await this.fileStorage.delete(key).catch(() => undefined);
    }
    await this.notify(
      [document.drafter_id, document.created_by],
      document,
      decline ? 'Văn bản đi không được ký' : 'Văn bản đi bị trả lại',
      note,
    );
    // Văn thư trả lại thì văn bản về dự thảo, văn thư không còn xem được: trả trạng thái mới thay cho chi tiết
    const visible = await this.system
      .selectFrom('outgoing_documents')
      .select('id')
      .where('id', '=', id)
      .where(this.visible(currentUser))
      .executeTakeFirst();
    return visible ? this.view(currentUser, id) : { id, status: 'draft' as const, actions: [] };
  }

  // ---- Cấp số và phát hành ----

  async nextNumber(currentUser: CurrentUser, bookId: string) {
    this.assertIssue(currentUser);
    const book = await this.system
      .selectFrom('document_books')
      .select(['start_number'])
      .where('id', '=', bookId)
      .where('direction', '=', 'outgoing')
      .executeTakeFirst();
    if (!book) {
      throw notFoundError('Không tìm thấy sổ văn bản đi', 'document_book');
    }
    const last = await this.system
      .selectFrom('outgoing_documents')
      .select((expression) => expression.fn.max('issue_number').as('maximum'))
      .where('book_id', '=', bookId)
      .executeTakeFirst();
    return { next_number: Math.max(book.start_number, Number(last?.maximum ?? 0) + 1) };
  }

  // Cấp số đi trong sổ: khóa theo sổ để hai lần cấp số cùng lúc không trùng; số nhập tay phải chưa có trong sổ
  private async numberInBook(transaction: Transaction<SystemDatabase>, input: IssueInput): Promise<number> {
    const book = await transaction
      .selectFrom('document_books')
      .select(['id', 'direction', 'start_number', 'start_date', 'end_date'])
      .where('id', '=', input.book_id)
      .executeTakeFirst();
    if (!book || book.direction !== 'outgoing') {
      throw validationError([{ field: 'book_id', message: 'Không tìm thấy sổ văn bản đi' }]);
    }
    if (input.issue_date < book.start_date || (book.end_date && input.issue_date > book.end_date)) {
      throw ruleViolationError(OUTGOING_RULE_CODE, 'Ngày ban hành nằm ngoài thời gian áp dụng của sổ văn bản', [
        { field: 'issue_date', message: 'Ngày ban hành nằm ngoài thời gian áp dụng của sổ' },
      ]);
    }
    await sql`select pg_advisory_xact_lock(hashtext(${`document-book:${book.id}`}))`.execute(transaction);
    if (input.issue_number) {
      const taken = await transaction
        .selectFrom('outgoing_documents')
        .select('id')
        .where('book_id', '=', book.id)
        .where('issue_number', '=', input.issue_number)
        .executeTakeFirst();
      if (taken) {
        throw new ApplicationError('ERR_CONFLICT', 'Số đi đã có trong sổ', [
          { field: 'issue_number', message: 'Số đi đã có trong sổ' },
        ]);
      }
      return input.issue_number;
    }
    const last = await transaction
      .selectFrom('outgoing_documents')
      .select((expression) => expression.fn.max('issue_number').as('maximum'))
      .where('book_id', '=', book.id)
      .executeTakeFirst();
    return Math.max(book.start_number, Number(last?.maximum ?? 0) + 1);
  }

  // Tên trường làm đơn vị ban hành của văn bản đến tạo qua liên thông nội bộ: đơn vị gốc của cây đơn vị năm học
  private async schoolName(): Promise<string | null> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return null;
    }
    const root = await current.database
      .selectFrom('org_units')
      .select('name')
      .where('parent_id', 'is', null)
      .orderBy('created_at')
      .executeTakeFirst();
    return root?.name ?? null;
  }

  // Cấp số và phát hành. Đơn vị nhận trong trường nhận ngay một văn bản đến chờ vào sổ kèm bản đã ký, văn bản gửi kèm
  // (liên thông nội bộ); đơn vị bên ngoài ở trạng thái chờ gửi. Văn bản trả lời ghi số ký hiệu vào văn bản đến được trả lời
  async issue(currentUser: CurrentUser, id: string, input: IssueInput, recipients: RecipientInput[] | undefined) {
    const files = await this.system
      .selectFrom('outgoing_document_files')
      .select(['kind', 'file_name', 'content_type', 'size_bytes', 'sha256', 'storage_key'])
      .where('document_id', '=', id)
      .where('kind', 'in', ['signed', 'attachment'])
      .orderBy('created_at')
      .execute();
    const issuer = (await this.schoolName()) ?? 'Nhà trường';
    const copies: string[] = [];
    try {
      const result = await this.system.transaction().execute(async (transaction) => {
        const { document } = await this.assertAction(transaction, id, currentUser, 'issue', 'Chỉ cấp số văn bản đã ký');
        const number = await this.numberInBook(transaction, input);
        const symbol = symbolOf(number, input.symbol_suffix);
        const now = this.clock.now();
        if (recipients) {
          await this.replaceRecipients(transaction, id, recipients);
        }
        const detail = await transaction
          .updateTable('outgoing_documents')
          .set({
            status: 'issued',
            book_id: input.book_id,
            issue_number: number,
            symbol,
            issue_date: input.issue_date,
            copies: input.copies,
            issued_at: now,
            issued_by: currentUser.id,
            issued_by_name: currentUser.description.full_name,
            updated_at: now,
          })
          .where('id', '=', id)
          .returning([
            'summary',
            'form_id',
            'urgency_id',
            'secrecy_id',
            'field_id',
            'document_kind',
            'reply_to_id',
            'drafter_id',
            'signer_id',
          ])
          .executeTakeFirstOrThrow();
        const internals = await transaction
          .selectFrom('outgoing_document_recipients')
          .select(['id', 'org_unit_id', 'name'])
          .where('document_id', '=', id)
          .where('recipient_type', '=', 'internal')
          .orderBy('sort_order')
          .execute();
        for (const recipient of internals) {
          const incoming = await transaction
            .insertInto('incoming_documents')
            .values({
              summary: detail.summary,
              symbol,
              issuer_name: issuer,
              document_date: input.issue_date,
              form_id: detail.form_id,
              urgency_id: detail.urgency_id,
              secrecy_id: detail.secrecy_id,
              field_id: detail.field_id,
              document_kind: detail.document_kind,
              transfer_method: 'interconnect',
              status: 'pending_registration',
              source: 'internal',
              interconnect_status: 'received',
              received_at: now,
              outgoing_document_id: id,
              recipient_org_unit_id: recipient.org_unit_id,
              recipient_org_unit_name: recipient.name,
              created_by: currentUser.id,
              created_by_name: currentUser.description.full_name,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          for (const file of files) {
            const key = storageKey('incoming-documents', incoming.id, randomUUID());
            await this.fileStorage.put(key, await this.fileStorage.get(file.storage_key), file.content_type);
            copies.push(key);
            await transaction
              .insertInto('incoming_document_files')
              .values({
                document_id: incoming.id,
                kind: file.kind === 'signed' ? 'main' : 'related',
                file_name: file.file_name,
                content_type: file.content_type,
                size_bytes: file.size_bytes,
                sha256: file.sha256,
                storage_key: key,
                created_by: currentUser.id,
                created_by_name: currentUser.description.full_name,
              })
              .execute();
          }
          await transaction
            .insertInto('incoming_document_events')
            .values({
              document_id: incoming.id,
              action: 'interconnect_receive',
              note: `Nhận qua liên thông nội bộ: văn bản đi ${symbol} gửi ${recipient.name}`,
              actor_id: currentUser.id,
              actor_name: currentUser.description.full_name,
            })
            .execute();
          await transaction
            .updateTable('outgoing_document_recipients')
            .set({
              send_status: 'delivered',
              sent_at: now,
              sent_by_name: currentUser.description.full_name,
              incoming_document_id: incoming.id,
            })
            .where('id', '=', recipient.id)
            .execute();
        }
        if (detail.reply_to_id) {
          await transaction
            .updateTable('incoming_documents')
            .set({
              reply_symbol: symbol,
              reply_date: input.issue_date,
              reply_note: detail.summary.slice(0, 4000),
              replied_at: now,
              replied_by_name: currentUser.description.full_name,
              updated_at: now,
            })
            .where('id', '=', detail.reply_to_id)
            .execute();
          await transaction
            .insertInto('incoming_document_events')
            .values({
              document_id: detail.reply_to_id,
              action: 'reply',
              note: `${symbol} ngày ${input.issue_date} (văn bản đi đã ban hành)`,
              actor_id: currentUser.id,
              actor_name: currentUser.description.full_name,
            })
            .execute();
        }
        await this.event(
          transaction,
          id,
          'issue',
          `Số ${number}, ký hiệu ${symbol}, ngày ${input.issue_date}, ${input.copies} bản` +
            (internals.length > 0 ? `; liên thông nội bộ ${internals.length} đơn vị` : ''),
          currentUser,
        );
        return { document: { ...document, symbol }, detail };
      });
      await this.notify(
        [result.detail.drafter_id, result.detail.signer_id, result.document.created_by],
        result.document,
        'Văn bản đi đã ban hành',
        'Văn bản đã cấp số và phát hành',
      );
    } catch (error) {
      for (const key of copies) {
        await this.fileStorage.delete(key).catch(() => undefined);
      }
      throw error;
    }
    return this.view(currentUser, id);
  }

  // Liên thông tới đơn vị bên ngoài, bản chạy nội bộ: văn thư đánh dấu đã gửi (kèm mã tham chiếu) hoặc hủy đánh dấu
  async markSent(
    currentUser: CurrentUser,
    id: string,
    input: { recipient_ids: string[]; sent: boolean; reference: string | null },
  ) {
    await this.system.transaction().execute(async (transaction) => {
      const { document } = await this.assertAction(
        transaction,
        id,
        currentUser,
        'send',
        'Chỉ văn thư đánh dấu gửi văn bản đã ban hành, chưa đóng băng',
      );
      const rows = await transaction
        .selectFrom('outgoing_document_recipients')
        .select(['id', 'recipient_type', 'send_status', 'electronic_code', 'name'])
        .where('document_id', '=', id)
        .where('id', 'in', input.recipient_ids)
        .execute();
      if (rows.length !== input.recipient_ids.length || rows.some((row) => row.recipient_type !== 'external')) {
        throw validationError([{ field: 'recipient_ids', message: 'Chọn đơn vị bên ngoài của văn bản này' }]);
      }
      const now = this.clock.now();
      for (const row of rows) {
        const reference = input.sent
          ? await this.exchange.send({
              documentId: id,
              recipientId: row.id,
              electronicCode: row.electronic_code,
              symbol: document.symbol ?? '',
              reference: input.reference,
              sentBy: currentUser.description.full_name,
            })
          : null;
        await transaction
          .updateTable('outgoing_document_recipients')
          .set({
            send_status: input.sent ? 'sent' : 'pending',
            sent_at: input.sent ? now : null,
            sent_by_name: input.sent ? currentUser.description.full_name : null,
            reference,
          })
          .where('id', '=', row.id)
          .execute();
      }
      await this.event(
        transaction,
        id,
        input.sent ? 'send' : 'unsend',
        [rows.map((row) => row.name).join(', '), input.reference].filter(Boolean).join('; '),
        currentUser,
      );
    });
    return this.view(currentUser, id);
  }

  // Công bố lên website trường (cổng thông tin điện tử) hoặc ẩn; văn bản mật không công bố
  async publish(currentUser: CurrentUser, id: string, published: boolean) {
    await this.system.transaction().execute(async (transaction) => {
      const { document } = await this.assertAction(
        transaction,
        id,
        currentUser,
        'publish',
        'Chỉ văn thư công bố văn bản đã ban hành, chưa đóng băng',
      );
      if (published && document.secrecy_id) {
        const secrecy = await transaction
          .selectFrom('document_catalog_items')
          .select('level')
          .where('id', '=', document.secrecy_id)
          .executeTakeFirst();
        if ((secrecy?.level ?? 0) > 0) {
          throw ruleViolationError(OUTGOING_RULE_CODE, 'Văn bản mật, tối mật không công bố lên website');
        }
      }
      await transaction
        .updateTable('outgoing_documents')
        .set({
          published,
          published_at: published ? this.clock.now() : null,
          published_by_name: published ? currentUser.description.full_name : null,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, published ? 'publish' : 'unpublish', null, currentUser);
    });
    return this.view(currentUser, id);
  }

  // Đóng băng: khóa văn bản đã ban hành (không gửi, công bố, lưu hồ sơ) tới khi hủy đóng băng
  async freeze(currentUser: CurrentUser, id: string, frozen: boolean) {
    await this.system.transaction().execute(async (transaction) => {
      const { document } = await this.assertAction(
        transaction,
        id,
        currentUser,
        'freeze',
        'Chỉ văn thư đóng băng văn bản đã ban hành',
      );
      if (document.frozen === frozen) {
        throw ruleViolationError(OUTGOING_RULE_CODE, frozen ? 'Văn bản đã đóng băng' : 'Văn bản chưa đóng băng');
      }
      await transaction
        .updateTable('outgoing_documents')
        .set({
          frozen,
          frozen_at: frozen ? this.clock.now() : null,
          frozen_by_name: frozen ? currentUser.description.full_name : null,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, frozen ? 'freeze' : 'unfreeze', null, currentUser);
    });
    return this.view(currentUser, id);
  }

  // Lưu hồ sơ: gắn văn bản đã ban hành vào hồ sơ tài liệu của Văn thư lưu trữ (5.10.1); mỗi văn bản một giao dịch
  async archiveMany(currentUser: CurrentUser, ids: string[], archiveRecordId: string): Promise<BatchResult[]> {
    const record = await this.system
      .selectFrom('archive_records')
      .select(['id', 'code'])
      .where('id', '=', archiveRecordId)
      .executeTakeFirst();
    if (!record) {
      throw validationError([{ field: 'archive_record_id', message: 'Không tìm thấy hồ sơ tài liệu' }]);
    }
    const results: BatchResult[] = [];
    for (const id of ids) {
      try {
        await this.system.transaction().execute(async (transaction) => {
          await this.assertAction(
            transaction,
            id,
            currentUser,
            'archive',
            'Chỉ lưu hồ sơ văn bản đã ban hành, chưa đóng băng',
          );
          await transaction
            .updateTable('outgoing_documents')
            .set({
              archive_record_id: record.id,
              archived_at: this.clock.now(),
              archived_by_name: currentUser.description.full_name,
              updated_at: this.clock.now(),
            })
            .where('id', '=', id)
            .execute();
          await this.event(transaction, id, 'archive', `Hồ sơ ${record.code}`, currentUser);
        });
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

  // ---- Tra cứu mã QR (trang công khai) ----

  // Thông tin để người nhận đối chiếu bản giấy hoặc tệp: số ký hiệu, ngày ban hành, người ký, thời điểm ký, mã băm bản đã
  // ký; trích yếu chỉ hiện với văn bản không mật đã ban hành
  async verify(code: string) {
    const row = await this.system
      .selectFrom('outgoing_documents')
      .leftJoin('document_catalog_items as secrecy', 'secrecy.id', 'outgoing_documents.secrecy_id')
      .select([
        'outgoing_documents.id',
        'outgoing_documents.status',
        'outgoing_documents.summary',
        'outgoing_documents.symbol',
        'outgoing_documents.issue_date',
        'outgoing_documents.signer_name',
        'outgoing_documents.signer_title',
        'outgoing_documents.signed_at',
        'outgoing_documents.signature_method',
        'secrecy.level as secrecy_level',
      ])
      .where('outgoing_documents.verification_code', '=', code)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy văn bản có mã tra cứu này', 'outgoing_document');
    }
    const signed = await this.system
      .selectFrom('outgoing_document_files')
      .select(['sha256', 'size_bytes'])
      .where('document_id', '=', row.id)
      .where('kind', '=', 'signed')
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
    const issued = row.status === 'issued';
    return {
      code,
      school_name: await this.schoolName(),
      issued,
      symbol: row.symbol,
      issue_date: row.issue_date,
      summary: issued && (row.secrecy_level ?? 0) === 0 ? row.summary : null,
      signer_name: row.signer_name,
      signer_title: row.signer_title,
      signed_at: row.signed_at,
      internal_signature: row.signature_method === 'internal',
      signed_sha256: signed?.sha256 ?? null,
      signed_size_bytes: signed?.size_bytes ?? null,
    };
  }
}
