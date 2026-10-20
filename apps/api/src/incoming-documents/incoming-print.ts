import { Injectable } from '@nestjs/common';
import type { SystemDatabase } from '@school-management/database';
import { ApplicationError, Clock, validationError } from '@school-management/server';
import {
  INCOMING_ASSIGNMENT_STATUS_LABELS,
  INCOMING_AUTHORITY_LABELS,
  INCOMING_COPY_LABELS,
  INCOMING_DOCUMENT_STATUS_LABELS,
  INCOMING_KIND_LABELS,
  INCOMING_ROLE_LABELS,
  INCOMING_TRANSFER_LABELS,
  PERMISSION_CODES,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { notFoundError } from '../common/request-fields.js';
import { buildPdf, type TableFileSheet } from '../exports/table-file.js';
import { buildFacilitiesWorkbook, fileStamp, type WorkbookColumn } from '../facilities/facilities-workbook.js';
import { hasWholeSchool } from './document-admin.js';
import { IncomingDocumentsService } from './incoming-documents.js';

// In phiếu của văn bản đến (DT-18 phần 18a, YCTD-138) theo các nút của VNPT iOffice: phiếu trình (trình lãnh đạo, có ô ý
// kiến chỉ đạo), phiếu xử lý (tổng hợp ý kiến xử lý của cả luồng), phiếu giao nhận (danh sách người nhận, cột ký nhận). Sổ
// văn bản đến in theo cột của iOffice: Ngày đến, Số đến, Tác giả, Số ký hiệu, Ngày văn bản, Trích yếu, Nơi nhận, Hình
// thức, Độ khẩn, Lĩnh vực, Xử lý chính; xuất Excel ghi nhật ký xuất (BR-74). Mẫu phiếu Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11 vì khảo sát chỉ ghi tên nút
export type SlipType = 'submission' | 'processing' | 'handover';
export const SLIP_TYPES: SlipType[] = ['submission', 'processing', 'handover'];
const SLIP_TITLES: Record<SlipType, string> = {
  submission: 'PHIẾU TRÌNH VĂN BẢN ĐẾN',
  processing: 'PHIẾU XỬ LÝ VĂN BẢN ĐẾN',
  handover: 'PHIẾU GIAO NHẬN VĂN BẢN',
};
const SLIP_FILE_NAMES: Record<SlipType, string> = {
  submission: 'phieu-trinh',
  processing: 'phieu-xu-ly',
  handover: 'phieu-giao-nhan',
};

const date = (value: string | null | undefined) => (value ? value.split('-').reverse().join('/') : '');
const time = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';

export const REGISTER_COLUMNS: WorkbookColumn[] = [
  { key: 'arrival_date', label: 'Ngày đến', width: 12 },
  { key: 'arrival_number', label: 'Số đến', width: 8 },
  { key: 'issuer_name', label: 'Tác giả', width: 28 },
  { key: 'symbol', label: 'Số ký hiệu', width: 16 },
  { key: 'document_date', label: 'Ngày văn bản', width: 12 },
  { key: 'summary', label: 'Trích yếu', width: 50 },
  { key: 'recipients', label: 'Nơi nhận', width: 28 },
  { key: 'form_name', label: 'Hình thức', width: 14 },
  { key: 'urgency_name', label: 'Độ khẩn', width: 10 },
  { key: 'field_name', label: 'Lĩnh vực', width: 16 },
  { key: 'main_handler', label: 'Xử lý chính', width: 22 },
];

@Injectable()
export class IncomingPrintService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly documents: IncomingDocumentsService,
    private readonly clock: Clock,
  ) {}

  private get system(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

  // Tên trường in đầu phiếu: đơn vị gốc của cây đơn vị năm học đang dùng
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

  async slip(currentUser: CurrentUser, id: string, type: SlipType) {
    await this.documents.assertVisible(currentUser, id);
    const view = await this.documents.view(currentUser, id);
    const school = await this.schoolName();
    const info: TableFileSheet = {
      title: SLIP_TITLES[type],
      heading: [
        SLIP_TITLES[type],
        ...(school ? [school] : []),
        `Sổ: ${view.book_name ?? '—'}; Số đến: ${view.arrival_number ?? '—'}; Ngày đến: ${date(view.arrival_date)}`,
      ],
      columns: [
        { key: 'label', label: 'Thông tin', width: 22 },
        { key: 'value', label: 'Nội dung', width: 70 },
      ],
      rows: [
        { label: 'Trích yếu', value: view.summary },
        { label: 'Số ký hiệu', value: view.symbol },
        { label: 'Đơn vị ban hành', value: view.issuer_name },
        { label: 'Ngày văn bản', value: date(view.document_date) },
        { label: 'Hình thức', value: view.form_name ?? '' },
        { label: 'Độ khẩn', value: view.urgency_name ?? '' },
        { label: 'Độ mật', value: view.secrecy_name ?? '' },
        { label: 'Thẩm quyền', value: INCOMING_AUTHORITY_LABELS[view.authority] },
        { label: 'Loại văn bản', value: INCOMING_KIND_LABELS[view.document_kind] },
        { label: 'Hình thức chuyển', value: INCOMING_TRANSFER_LABELS[view.transfer_method] },
        { label: 'Hình thức sao', value: INCOMING_COPY_LABELS[view.copy_type] },
        { label: 'Có văn bản giấy', value: view.has_paper ? 'Có' : 'Không' },
        { label: 'Hạn xử lý', value: date(view.deadline) },
        { label: 'Nội dung xử lý', value: view.processing_note ?? '' },
        { label: 'Trạng thái', value: INCOMING_DOCUMENT_STATUS_LABELS[view.status] },
      ],
    };
    const assignments = view.assignments;
    let detail: TableFileSheet;
    if (type === 'submission') {
      const leaders = assignments.filter((row) => row.role === 'leader');
      detail = {
        title: 'Ý kiến của lãnh đạo',
        columns: [
          { key: 'leader', label: 'Lãnh đạo', width: 22 },
          { key: 'proposal', label: 'Đề xuất của người trình', width: 30 },
          { key: 'opinion', label: 'Ý kiến chỉ đạo', width: 40 },
          { key: 'time', label: 'Thời gian', width: 16 },
        ],
        rows:
          leaders.length > 0
            ? leaders.map((row) => ({
                leader: [row.user_name, row.user_title].filter(Boolean).join(', '),
                proposal: [row.assigned_by_name, row.note].filter(Boolean).join(': '),
                opinion: row.result_note ?? '',
                time: time(row.finished_at),
              }))
            : [{ leader: '', proposal: view.processing_note ?? '', opinion: '', time: '' }],
      };
    } else if (type === 'processing') {
      detail = {
        title: 'Tổng hợp ý kiến xử lý',
        numbered: true,
        columns: [
          { key: 'from', label: 'Người chuyển', width: 18 },
          { key: 'to', label: 'Người nhận', width: 20 },
          { key: 'role', label: 'Vai trò', width: 12 },
          { key: 'deadline', label: 'Hạn xử lý', width: 11 },
          { key: 'note', label: 'Ý kiến khi chuyển', width: 24 },
          { key: 'result', label: 'Ý kiến xử lý', width: 24 },
          { key: 'status', label: 'Trạng thái', width: 12 },
        ],
        rows: assignments.map((row) => ({
          from: row.assigned_by_name,
          to: row.user_name,
          role: INCOMING_ROLE_LABELS[row.role],
          deadline: date(row.deadline),
          note: row.note ?? '',
          result: row.result_note ?? '',
          status: INCOMING_ASSIGNMENT_STATUS_LABELS[row.status],
        })),
      };
    } else {
      detail = {
        title: 'Danh sách giao nhận',
        numbered: true,
        columns: [
          { key: 'to', label: 'Người nhận', width: 24 },
          { key: 'role', label: 'Vai trò', width: 14 },
          { key: 'given', label: 'Người giao', width: 20 },
          { key: 'time', label: 'Thời gian giao', width: 18 },
          { key: 'sign', label: 'Ký nhận', width: 18 },
        ],
        rows: assignments
          .filter((row) => !['revoked'].includes(row.status))
          .map((row) => ({
            to: [row.user_name, row.user_title].filter(Boolean).join(', '),
            role: INCOMING_ROLE_LABELS[row.role],
            given: row.assigned_by_name,
            time: time(row.created_at),
            sign: '',
          })),
      };
    }
    const now = this.clock.now();
    const pdf = await buildPdf([info, detail], now, { orientation: 'portrait', subject: SLIP_TITLES[type] });
    return { fileName: `${SLIP_FILE_NAMES[type]}-${view.arrival_number ?? 'cho-vao-so'}-${fileStamp(now)}.pdf`, body: pdf };
  }

  // ---- Sổ văn bản đến ----

  async register(currentUser: CurrentUser, bookId: string, from: string | null, to: string | null) {
    if (
      !hasWholeSchool(currentUser, PERMISSION_CODES.incomingDocumentRegister) &&
      !hasWholeSchool(currentUser, PERMISSION_CODES.incomingDocumentAdmin)
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Cần quyền văn thư hoặc quản trị văn bản ở phạm vi toàn trường');
    }
    const book = await this.system
      .selectFrom('document_books')
      .select(['id', 'name', 'year', 'direction'])
      .where('id', '=', bookId)
      .executeTakeFirst();
    if (!book || book.direction !== 'incoming') {
      throw notFoundError('Không tìm thấy sổ văn bản đến', 'document_book');
    }
    if (from && to && from > to) {
      throw validationError([{ field: 'to', message: 'Đến ngày không trước từ ngày' }]);
    }
    let query = this.system
      .selectFrom('incoming_documents')
      .leftJoin('document_catalog_items as form', 'form.id', 'incoming_documents.form_id')
      .leftJoin('document_catalog_items as urgency', 'urgency.id', 'incoming_documents.urgency_id')
      .leftJoin('document_catalog_items as field', 'field.id', 'incoming_documents.field_id')
      .select([
        'incoming_documents.id',
        'incoming_documents.arrival_date',
        'incoming_documents.arrival_number',
        'incoming_documents.issuer_name',
        'incoming_documents.symbol',
        'incoming_documents.document_date',
        'incoming_documents.summary',
        'incoming_documents.restricted',
        'form.name as form_name',
        'urgency.name as urgency_name',
        'field.name as field_name',
      ])
      .where('incoming_documents.book_id', '=', bookId);
    if (from) {
      query = query.where('incoming_documents.arrival_date', '>=', from);
    }
    if (to) {
      query = query.where('incoming_documents.arrival_date', '<=', to);
    }
    const rows = await query.orderBy('incoming_documents.arrival_number').execute();
    const flows =
      rows.length > 0
        ? await this.system
            .selectFrom('incoming_document_assignments')
            .select(['document_id', 'user_name', 'role', 'status', 'parent_id'])
            .where(
              'document_id',
              'in',
              rows.map((row) => row.id),
            )
            .orderBy('created_at')
            .execute()
        : [];
    const inactive = ['returned', 'revoked', 'refused'];
    const items = rows.map((row) => {
      const flow = flows.filter((item) => item.document_id === row.id && !inactive.includes(item.status));
      // Văn bản hạn chế xem chỉ in số, ngày; trích yếu che như sổ giấy của văn bản mật
      return {
        ...row,
        summary: row.restricted ? '(Văn bản hạn chế xem)' : row.summary,
        recipients: flow
          .filter((item) => item.parent_id === null)
          .map((item) => item.user_name)
          .join(', '),
        main_handler: flow.filter((item) => item.role === 'main').at(-1)?.user_name ?? '',
      };
    });
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
      reportCode: 'incoming_document_register',
      fileName: `so-van-ban-den-${book.year}-${fileStamp(now)}`,
      filters: { book_id: bookId, from, to },
      orgUnitIds: [],
      sheets: [
        {
          title: 'Sổ văn bản đến',
          heading: [
            'SỔ VĂN BẢN ĐẾN',
            ...(school ? [school] : []),
            `${book.name} – năm ${book.year}${from || to ? ` (từ ${date(from) || '…'} đến ${date(to) || '…'})` : ''}`,
          ],
          columns: REGISTER_COLUMNS,
          rows: items.map((item) => ({
            ...item,
            arrival_date: date(item.arrival_date),
            document_date: date(item.document_date),
          })),
        },
      ],
      ipAddress,
      createdAt: now,
    });
  }
}
