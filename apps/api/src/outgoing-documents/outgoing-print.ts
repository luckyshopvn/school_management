import { Injectable } from '@nestjs/common';
import type { SystemDatabase } from '@school-management/database';
import { ApplicationError, Clock, validationError } from '@school-management/server';
import {
  INCOMING_KIND_LABELS,
  OUTGOING_DOCUMENT_STATUS_LABELS,
  OUTGOING_OPINION_STATUS_LABELS,
  PERMISSION_CODES,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { notFoundError } from '../common/request-fields.js';
import { buildPdf, type TableFileSheet } from '../exports/table-file.js';
import { buildFacilitiesWorkbook, fileStamp, type WorkbookColumn } from '../facilities/facilities-workbook.js';
import { hasWholeSchool } from '../incoming-documents/document-admin.js';
import { OutgoingDocumentsService } from './outgoing-documents.js';

// In của văn bản đi (DT-18 phần 18b, YCTD-140): phiếu trình ký (nút "In phiếu trình KG" của iOffice: thông tin văn bản, ý
// kiến góp ý, ô ý kiến của người ký) và sổ văn bản đi theo cột của iOffice: Ngày ban hành, Số, Số ký hiệu, Trích yếu, Người
// ký, Đơn vị soạn thảo, Số bản, Nơi nhận, Hình thức, Độ khẩn, Lĩnh vực; xuất Excel ghi nhật ký xuất (BR-74). Mẫu phiếu
// Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 vì khảo sát chỉ ghi tên nút
const date = (value: string | null | undefined) => (value ? value.split('-').reverse().join('/') : '');
const time = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';

export const OUTGOING_REGISTER_COLUMNS: WorkbookColumn[] = [
  { key: 'issue_date', label: 'Ngày ban hành', width: 12 },
  { key: 'issue_number', label: 'Số', width: 8 },
  { key: 'symbol', label: 'Số ký hiệu', width: 18 },
  { key: 'summary', label: 'Trích yếu', width: 50 },
  { key: 'signer_name', label: 'Người ký', width: 22 },
  { key: 'drafting_unit_name', label: 'Đơn vị soạn thảo', width: 22 },
  { key: 'copies', label: 'Số bản', width: 8 },
  { key: 'recipients', label: 'Nơi nhận', width: 30 },
  { key: 'form_name', label: 'Hình thức', width: 14 },
  { key: 'urgency_name', label: 'Độ khẩn', width: 10 },
  { key: 'field_name', label: 'Lĩnh vực', width: 16 },
];

@Injectable()
export class OutgoingPrintService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly documents: OutgoingDocumentsService,
    private readonly clock: Clock,
  ) {}

  private get system(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

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

  async slip(currentUser: CurrentUser, id: string) {
    const view = await this.documents.view(currentUser, id);
    const school = await this.schoolName();
    const title = 'PHIẾU TRÌNH KÝ VĂN BẢN';
    const info: TableFileSheet = {
      title,
      heading: [
        title,
        ...(school ? [school] : []),
        `Số eOffice: ${view.eoffice_number}; Số trình ký: ${view.submission_number ?? '—'}`,
      ],
      columns: [
        { key: 'label', label: 'Thông tin', width: 22 },
        { key: 'value', label: 'Nội dung', width: 70 },
      ],
      rows: [
        { label: 'Trích yếu', value: view.summary },
        { label: 'Hình thức', value: view.form_name ?? '' },
        { label: 'Độ khẩn', value: view.urgency_name ?? '' },
        { label: 'Độ mật', value: view.secrecy_name ?? '' },
        { label: 'Loại văn bản', value: INCOMING_KIND_LABELS[view.document_kind] },
        { label: 'Văn bản ưu tiên', value: view.priority ? 'Có' : 'Không' },
        { label: 'Người soạn thảo', value: view.drafter_name },
        { label: 'Đơn vị soạn thảo', value: view.drafting_unit_name ?? '' },
        { label: 'Người ký', value: [view.signer_name, view.signer_title].filter(Boolean).join(', ') },
        { label: 'Đơn vị dự kiến nhận', value: view.recipients.map((recipient) => recipient.name).join('; ') },
        { label: 'Nội dung trình', value: view.content_note ?? '' },
        { label: 'Trạng thái', value: OUTGOING_DOCUMENT_STATUS_LABELS[view.status] },
      ],
    };
    const opinions: TableFileSheet = {
      title: 'Ý kiến góp ý dự thảo',
      numbered: true,
      columns: [
        { key: 'round', label: 'Đợt', width: 6 },
        { key: 'user', label: 'Người cho ý kiến', width: 22 },
        { key: 'opinion', label: 'Ý kiến', width: 44 },
        { key: 'status', label: 'Trạng thái', width: 16 },
        { key: 'time', label: 'Thời gian', width: 16 },
      ],
      rows: view.opinions.map((row) => ({
        round: row.round,
        user: [row.user_name, row.user_title].filter(Boolean).join(', '),
        opinion: row.opinion ?? '',
        status: OUTGOING_OPINION_STATUS_LABELS[row.status],
        time: time(row.answered_at),
      })),
    };
    const decision: TableFileSheet = {
      title: 'Ý kiến của người ký',
      columns: [
        { key: 'signer', label: 'Người ký', width: 30 },
        { key: 'opinion', label: 'Ý kiến', width: 50 },
        { key: 'time', label: 'Thời gian', width: 16 },
      ],
      rows: [
        {
          signer: [view.signer_name, view.signer_title].filter(Boolean).join(', '),
          opinion: view.status === 'signed' || view.status === 'issued' ? 'Đã ký' : (view.return_note ?? ''),
          time: time(view.signed_at ?? view.returned_at),
        },
      ],
    };
    const now = this.clock.now();
    const pdf = await buildPdf([info, opinions, decision], now, { orientation: 'portrait', subject: title });
    return { fileName: `phieu-trinh-ky-${view.eoffice_number}-${fileStamp(now)}.pdf`, body: pdf };
  }

  // ---- Sổ văn bản đi ----

  async register(currentUser: CurrentUser, bookId: string, from: string | null, to: string | null) {
    if (
      !hasWholeSchool(currentUser, PERMISSION_CODES.outgoingDocumentIssue) &&
      !hasWholeSchool(currentUser, PERMISSION_CODES.incomingDocumentAdmin)
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Cần quyền văn thư hoặc quản trị văn bản ở phạm vi toàn trường');
    }
    const book = await this.system
      .selectFrom('document_books')
      .select(['id', 'name', 'year', 'direction'])
      .where('id', '=', bookId)
      .executeTakeFirst();
    if (!book || book.direction !== 'outgoing') {
      throw notFoundError('Không tìm thấy sổ văn bản đi', 'document_book');
    }
    if (from && to && from > to) {
      throw validationError([{ field: 'to', message: 'Đến ngày không trước từ ngày' }]);
    }
    let query = this.system
      .selectFrom('outgoing_documents')
      .leftJoin('document_catalog_items as form', 'form.id', 'outgoing_documents.form_id')
      .leftJoin('document_catalog_items as urgency', 'urgency.id', 'outgoing_documents.urgency_id')
      .leftJoin('document_catalog_items as field', 'field.id', 'outgoing_documents.field_id')
      .leftJoin('document_catalog_items as secrecy', 'secrecy.id', 'outgoing_documents.secrecy_id')
      .select([
        'outgoing_documents.id',
        'outgoing_documents.issue_date',
        'outgoing_documents.issue_number',
        'outgoing_documents.symbol',
        'outgoing_documents.summary',
        'outgoing_documents.signer_name',
        'outgoing_documents.drafting_unit_name',
        'outgoing_documents.copies',
        'form.name as form_name',
        'urgency.name as urgency_name',
        'field.name as field_name',
        'secrecy.level as secrecy_level',
      ])
      .where('outgoing_documents.book_id', '=', bookId);
    if (from) {
      query = query.where('outgoing_documents.issue_date', '>=', from);
    }
    if (to) {
      query = query.where('outgoing_documents.issue_date', '<=', to);
    }
    const rows = await query.orderBy('outgoing_documents.issue_number').execute();
    const recipients =
      rows.length > 0
        ? await this.system
            .selectFrom('outgoing_document_recipients')
            .select(['document_id', 'name'])
            .where(
              'document_id',
              'in',
              rows.map((row) => row.id),
            )
            .orderBy('sort_order')
            .execute()
        : [];
    const items = rows.map(({ secrecy_level: secrecyLevel, ...row }) => ({
      ...row,
      // Văn bản mật chỉ in số, ngày; trích yếu che như sổ giấy của văn bản mật
      summary: (secrecyLevel ?? 0) > 0 ? '(Văn bản mật)' : row.summary,
      recipients: recipients
        .filter((recipient) => recipient.document_id === row.id)
        .map((recipient) => recipient.name)
        .join(', '),
    }));
    return { book, items };
  }

  async exportRegister(
    currentUser: CurrentUser,
    bookId: string,
    from: string | null,
    to: string | null,
    ipAddress: string | null,
  ) {
    const { book, items } = await this.register(currentUser, bookId, from, to);
    const current = await this.currentSchoolYear.require();
    const school = await this.schoolName();
    const now = this.clock.now();
    return buildFacilitiesWorkbook({
      database: current.database,
      currentUser,
      reportCode: 'outgoing_document_register',
      fileName: `so-van-ban-di-${book.year}-${fileStamp(now)}`,
      filters: { book_id: bookId, from, to },
      orgUnitIds: [],
      sheets: [
        {
          title: 'Sổ văn bản đi',
          heading: [
            'SỔ VĂN BẢN ĐI',
            ...(school ? [school] : []),
            `${book.name} – năm ${book.year}${from || to ? ` (từ ${date(from) || '…'} đến ${date(to) || '…'})` : ''}`,
          ],
          columns: OUTGOING_REGISTER_COLUMNS,
          rows: items.map((item) => ({ ...item, issue_date: date(item.issue_date) })),
        },
      ],
      ipAddress,
      createdAt: now,
    });
  }
}
