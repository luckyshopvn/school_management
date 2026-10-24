import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { LibraryCopyCondition, LibraryCopySource, SchoolYearDatabase } from '@school-management/database';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES, SCHOOL_LEVEL_CODES, type SchoolLevelCode } from '@school-management/shared';
import type { Request, Response } from 'express';
import { sql, type Kysely } from 'kysely';
import pdfmake, { type PdfContent } from 'pdfmake';
import { decodeFileName, type UploadedPart } from '../activities/content-files.js';
import { detectArchiveFileType } from '../archives/archives.js';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readInteger,
  readOptionalText,
  readOptionalUuid,
  readRequiredInteger,
  readRequiredText,
  readRequiredUuid,
  readStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { storageKey } from '../common/resource-names.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { ensureFonts, type TableFileFormat, readTableFileFormat } from '../exports/table-file.js';
import { FileStorage } from '../files/file-storage.js';
import { buildFacilitiesWorkbook, fileStamp, sendWorkbook } from '../facilities/facilities-workbook.js';
import { LIBRARY_RULE_CODE, normalizeScannedCode } from './library-calc.js';
import { LibraryCore } from './library-core.js';

// Danh mục thư viện trường học (DT-22 phần 22a, YCTD-181; tài liệu 32 mục 13.4): thiết lập (quy định mượn, cấp có học sinh
// mượn, ngày giữ chỗ), phân loại ấn phẩm, ấn phẩm, bản sao có số đăng ký cá biệt, tem mã vạch (mã QR), thanh lý, tệp tài liệu
// số, sổ đăng ký cá biệt. Chỉ người có quyền quản lý thư viện ghi được; mọi cán bộ có quyền xem tra cứu danh mục
const VIEW = PERMISSION_CODES.schoolLibraryView;
const MANAGE = PERMISSION_CODES.schoolLibraryManage;
const MAXIMUM_PAGE = 200;
const MAXIMUM_COPIES_AT_ONCE = 500;
const MAXIMUM_DIGITAL_BYTES = 20 * 1024 * 1024;
const MAXIMUM_DIGITAL_FILES = 20;
const COPY_SOURCES: LibraryCopySource[] = ['purchase', 'donation', 'supplied'];
const COPY_CONDITIONS: LibraryCopyCondition[] = ['good', 'damaged'];
const CATEGORY_COLUMNS = ['id', 'code', 'name', 'lendable', 'order_no', 'status'] as const;
const TITLE_COLUMNS = [
  'library_titles.id',
  'library_titles.category_id',
  'library_titles.title',
  'library_titles.authors',
  'library_titles.publisher',
  'library_titles.publish_year',
  'library_titles.isbn',
  'library_titles.school_level',
  'library_titles.grade_level',
  'library_titles.subject_id',
  'library_titles.topic',
  'library_titles.language',
  'library_titles.shelf',
  'library_titles.description',
  'library_titles.status',
] as const;

export interface TitleInput {
  category_id: string;
  title: string;
  authors: string | null;
  publisher: string | null;
  publish_year: number | null;
  isbn: string | null;
  school_level: SchoolLevelCode | null;
  grade_level: string | null;
  subject_id: string | null;
  topic: string | null;
  language: string;
  shelf: string | null;
  description: string | null;
}

export interface CopyInput {
  source: LibraryCopySource;
  price: number | null;
  acquired_on: string | null;
  shelf: string | null;
}

// Điều kiện lọc ấn phẩm, dùng chung cho danh sách và báo cáo
export interface TitleFilter {
  query?: string;
  categoryId?: string;
  gradeLevel?: string;
  subjectId?: string;
  schoolLevel?: SchoolLevelCode;
  status?: 'active' | 'retired';
  limit: number;
  offset: number;
}

@Injectable()
export class LibraryCatalogService {
  constructor(
    private readonly core: LibraryCore,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  async settings() {
    const database = await this.core.database();
    const [settings, rules, categories, indicators] = await Promise.all([
      this.core.settings(database),
      this.core.rules(database),
      database.selectFrom('library_categories').select(CATEGORY_COLUMNS).orderBy('order_no').orderBy('code').execute(),
      database
        .selectFrom('library_indicators')
        .select(['code', 'name', 'threshold', 'enabled', 'order_no'])
        .orderBy('order_no')
        .execute(),
    ]);
    return {
      ...settings,
      rules,
      categories,
      indicators: indicators.map((item) => ({
        ...item,
        threshold: item.threshold === null ? null : Number(item.threshold),
      })),
    };
  }

  async saveSettings(
    currentUser: CurrentUser,
    input: {
      studentLevels: SchoolLevelCode[];
      holdDays: number;
      rules: Array<{
        reader_kind: 'staff' | 'student';
        max_items: number;
        loan_days: number;
        max_renewals: number;
        fine_per_day: number;
      }>;
      indicators: Array<{ code: string; threshold: number | null; enabled: boolean }>;
    },
    origin: ChangeOrigin,
  ) {
    const database = await this.core.database();
    const before = await this.settings();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('library_settings')
        .set({
          student_levels: input.studentLevels,
          hold_days: input.holdDays,
          updated_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        })
        .where('id', '=', 1)
        .execute();
      for (const rule of input.rules) {
        await transaction
          .updateTable('library_loan_rules')
          .set({
            max_items: rule.max_items,
            loan_days: rule.loan_days,
            max_renewals: rule.max_renewals,
            fine_per_day: rule.fine_per_day,
          })
          .where('reader_kind', '=', rule.reader_kind)
          .execute();
      }
      for (const indicator of input.indicators) {
        await transaction
          .updateTable('library_indicators')
          .set({ threshold: indicator.threshold, enabled: indicator.enabled })
          .where('code', '=', indicator.code)
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_settings',
        entityId: '00000000-0000-0000-0000-000000000001',
        action: 'update',
        before,
        after: input,
      });
    });
    return this.settings();
  }

  async createCategory(
    input: { code: string; name: string; lendable: boolean; order_no: number },
    origin: ChangeOrigin,
  ) {
    const database = await this.core.database();
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('library_categories')
          .values(input)
          .returning(CATEGORY_COLUMNS)
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'library_categories',
          entityId: created.id,
          action: 'create',
          before: null,
          after: created,
        });
        return created;
      }),
      'Mã phân loại đã có',
      'code',
    );
  }

  async updateCategory(
    categoryId: string,
    changes: { name?: string; lendable?: boolean; order_no?: number; status?: 'active' | 'inactive' },
    origin: ChangeOrigin,
  ) {
    const database = await this.core.database();
    const existing = await database
      .selectFrom('library_categories')
      .select(CATEGORY_COLUMNS)
      .where('id', '=', categoryId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy phân loại', 'library_category');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('library_categories')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', categoryId)
        .returning(CATEGORY_COLUMNS)
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_categories',
        entityId: categoryId,
        action: 'update',
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  // Ấn phẩm kèm số bản đang dùng (tốt, hỏng) và số bản sẵn sàng cho mượn
  async titles(filter: TitleFilter) {
    const database = await this.core.database();
    const query = database
      .selectFrom('library_titles')
      .innerJoin('library_categories', 'library_categories.id', 'library_titles.category_id')
      .$if(filter.status !== undefined, (builder) =>
        builder.where('library_titles.status', '=', filter.status ?? 'active'),
      )
      .$if(filter.categoryId !== undefined, (builder) =>
        builder.where('library_titles.category_id', '=', filter.categoryId ?? ''),
      )
      .$if(filter.gradeLevel !== undefined, (builder) =>
        builder.where('library_titles.grade_level', '=', filter.gradeLevel ?? ''),
      )
      .$if(filter.subjectId !== undefined, (builder) =>
        builder.where('library_titles.subject_id', '=', filter.subjectId ?? ''),
      )
      .$if(filter.schoolLevel !== undefined, (builder) =>
        builder.where('library_titles.school_level', '=', filter.schoolLevel ?? 'TH'),
      )
      .$if(Boolean(filter.query), (builder) => {
        const pattern = `%${(filter.query ?? '').replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
        return builder.where((eb) =>
          eb.or([
            eb('library_titles.title', 'ilike', pattern),
            eb('library_titles.authors', 'ilike', pattern),
            eb('library_titles.isbn', 'ilike', pattern),
            eb('library_titles.topic', 'ilike', pattern),
            eb('library_titles.publisher', 'ilike', pattern),
          ]),
        );
      });
    const total = await query.select((eb) => eb.fn.countAll<string>().as('total')).executeTakeFirstOrThrow();
    const rows = await query
      .select([...TITLE_COLUMNS, 'library_categories.name as category_name', 'library_categories.lendable'])
      .orderBy('library_titles.title')
      .orderBy('library_titles.id')
      .limit(filter.limit)
      .offset(filter.offset)
      .execute();
    const counts = await this.copyCounts(
      database,
      rows.map((row) => row.id),
    );
    return {
      total: Number(total.total),
      items: rows.map((row) => ({ ...row, ...(counts.get(row.id) ?? { copies_total: 0, copies_available: 0 }) })),
    };
  }

  // Số bản đang dùng (tốt, hỏng) và số bản sẵn sàng (tốt, không đang mượn, không đang giữ chỗ) của các ấn phẩm
  async copyCounts(database: Kysely<SchoolYearDatabase>, titleIds: string[]) {
    const result = new Map<string, { copies_total: number; copies_available: number }>();
    if (titleIds.length === 0) {
      return result;
    }
    const rows = await database
      .selectFrom('library_copies')
      .select([
        'library_copies.title_id',
        sql<string>`count(*) filter (where library_copies.condition in ('good', 'damaged'))`.as('copies_total'),
        sql<string>`count(*) filter (where library_copies.condition = 'good'
          and not exists (select 1 from library_loans where library_loans.copy_id = library_copies.id and library_loans.status = 'open')
          and not exists (select 1 from library_reservations where library_reservations.copy_id = library_copies.id and library_reservations.status = 'ready'))`.as(
          'copies_available',
        ),
      ])
      .where('library_copies.title_id', 'in', titleIds)
      .groupBy('library_copies.title_id')
      .execute();
    for (const row of rows) {
      result.set(row.title_id, {
        copies_total: Number(row.copies_total),
        copies_available: Number(row.copies_available),
      });
    }
    return result;
  }

  async title(titleId: string) {
    const database = await this.core.database();
    const row = await database
      .selectFrom('library_titles')
      .innerJoin('library_categories', 'library_categories.id', 'library_titles.category_id')
      .select([...TITLE_COLUMNS, 'library_categories.name as category_name', 'library_categories.lendable'])
      .where('library_titles.id', '=', titleId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy ấn phẩm', 'library_title');
    }
    const [copies, files, counts] = await Promise.all([
      this.copies({ titleId }),
      this.titleFiles(titleId),
      this.copyCounts(database, [titleId]),
    ]);
    return { ...row, ...(counts.get(titleId) ?? { copies_total: 0, copies_available: 0 }), copies, files };
  }

  private async assertTitleRefs(database: Kysely<SchoolYearDatabase>, input: Partial<TitleInput>) {
    if (input.category_id) {
      const category = await database
        .selectFrom('library_categories')
        .select('id')
        .where('id', '=', input.category_id)
        .where('status', '=', 'active')
        .executeTakeFirst();
      if (!category) {
        throw validationError([{ field: 'category_id', message: 'Phân loại không có hoặc đã ngừng dùng' }]);
      }
    }
    if (input.subject_id) {
      const subject = await database
        .selectFrom('subjects')
        .select('id')
        .where('id', '=', input.subject_id)
        .executeTakeFirst();
      if (!subject) {
        throw validationError([{ field: 'subject_id', message: 'Không tìm thấy môn học' }]);
      }
    }
  }

  async createTitle(input: TitleInput, currentUser: CurrentUser, origin: ChangeOrigin) {
    const database = await this.core.database();
    await this.assertTitleRefs(database, input);
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('library_titles')
        .values({ ...input, created_by: currentUser.id })
        .returning(['id'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_titles',
        entityId: created.id,
        action: 'create',
        before: null,
        after: input,
      });
      return created;
    });
  }

  async updateTitle(
    titleId: string,
    changes: Partial<TitleInput> & { status?: 'active' | 'retired' },
    origin: ChangeOrigin,
  ) {
    const database = await this.core.database();
    const existing = await this.core.findTitle(database, titleId);
    await this.assertTitleRefs(database, changes);
    if (changes.status === 'retired') {
      const open = await database
        .selectFrom('library_loans')
        .innerJoin('library_copies', 'library_copies.id', 'library_loans.copy_id')
        .select('library_loans.id')
        .where('library_copies.title_id', '=', titleId)
        .where('library_loans.status', '=', 'open')
        .executeTakeFirst();
      if (open) {
        throw ruleViolationError(LIBRARY_RULE_CODE, 'Còn bản đang cho mượn, trả hết rồi mới ngừng dùng ấn phẩm');
      }
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('library_titles')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', titleId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_titles',
        entityId: titleId,
        action: 'update',
        before: existing,
        after: changes,
      });
    });
    return this.title(titleId);
  }

  async copies(filter: { titleId?: string; code?: string; shelf?: string; condition?: string }) {
    const database = await this.core.database();
    return database
      .selectFrom('library_copies')
      .innerJoin('library_titles', 'library_titles.id', 'library_copies.title_id')
      .leftJoin('library_loans', (join) =>
        join.onRef('library_loans.copy_id', '=', 'library_copies.id').on('library_loans.status', '=', 'open'),
      )
      .select([
        'library_copies.id',
        'library_copies.title_id',
        'library_titles.title',
        'library_copies.copy_no',
        'library_copies.source',
        'library_copies.price',
        'library_copies.acquired_on',
        'library_copies.shelf',
        'library_copies.condition',
        'library_copies.note',
        'library_copies.disposed_on',
        'library_copies.disposal_reason',
        'library_loans.id as loan_id',
        'library_loans.due_on as loan_due_on',
      ])
      .$if(filter.titleId !== undefined, (builder) =>
        builder.where('library_copies.title_id', '=', filter.titleId ?? ''),
      )
      .$if(filter.code !== undefined, (builder) =>
        builder.where('library_copies.copy_no', '=', normalizeScannedCode(filter.code ?? '')),
      )
      .$if(filter.shelf !== undefined, (builder) => builder.where('library_copies.shelf', '=', filter.shelf ?? ''))
      .$if(filter.condition !== undefined, (builder) =>
        builder.where('library_copies.condition', '=', (filter.condition ?? 'good') as LibraryCopyCondition),
      )
      .orderBy('library_copies.copy_no')
      .limit(2000)
      .execute();
  }

  // Thêm `quantity` bản sao cho ấn phẩm, cấp số đăng ký cá biệt liên tiếp
  async addCopies(titleId: string, quantity: number, input: CopyInput, currentUser: CurrentUser, origin: ChangeOrigin) {
    const database = await this.core.database();
    const title = await this.core.findTitle(database, titleId);
    if (title.status !== 'active') {
      throw ruleViolationError(LIBRARY_RULE_CODE, 'Ấn phẩm đã ngừng dùng, không thêm bản sao');
    }
    return database.transaction().execute(async (transaction) => {
      const numbers = await this.core.nextCopyNumbers(transaction, quantity);
      const created = await transaction
        .insertInto('library_copies')
        .values(
          numbers.map((copyNo) => ({
            title_id: titleId,
            copy_no: copyNo,
            source: input.source,
            price: input.price,
            acquired_on: input.acquired_on ?? this.core.today(),
            shelf: input.shelf ?? title.shelf,
            created_by: currentUser.id,
          })),
        )
        .returning(['id', 'copy_no'])
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_copies',
        entityId: titleId,
        action: 'create',
        before: null,
        after: { title_id: titleId, copy_numbers: numbers },
      });
      return created;
    });
  }

  async updateCopy(
    copyId: string,
    changes: { condition?: LibraryCopyCondition; shelf?: string | null; note?: string | null; price?: number | null },
    origin: ChangeOrigin,
  ) {
    const database = await this.core.database();
    const existing = await database
      .selectFrom('library_copies')
      .select(['id', 'condition', 'shelf', 'note', 'price'])
      .where('id', '=', copyId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy bản sao', 'library_copy');
    }
    if (existing.condition === 'lost' || existing.condition === 'disposed') {
      throw ruleViolationError(LIBRARY_RULE_CODE, 'Bản đã mất hoặc đã thanh lý, không sửa tình trạng được');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('library_copies')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', copyId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_copies',
        entityId: copyId,
        action: 'update',
        before: existing,
        after: changes,
      });
    });
    return { id: copyId, ...changes };
  }

  // Thanh lý: có lý do, bản không đang cho mượn; bản đã thanh lý không cho mượn nữa
  async disposeCopies(copyIds: string[], reason: string, currentUser: CurrentUser, origin: ChangeOrigin) {
    const database = await this.core.database();
    return database.transaction().execute(async (transaction) => {
      const copies = await transaction
        .selectFrom('library_copies')
        .select(['id', 'copy_no', 'condition'])
        .where('id', 'in', copyIds)
        .forUpdate()
        .execute();
      if (copies.length !== new Set(copyIds).size) {
        throw validationError([{ field: 'copy_ids', message: 'Có bản sao không tồn tại' }]);
      }
      const onLoan = await transaction
        .selectFrom('library_loans')
        .select('copy_id')
        .where('copy_id', 'in', copyIds)
        .where('status', '=', 'open')
        .execute();
      if (onLoan.length > 0) {
        throw ruleViolationError(LIBRARY_RULE_CODE, 'Có bản đang cho mượn, trả về rồi mới thanh lý', [
          { field: 'copy_ids', message: 'Bản đang cho mượn' },
        ]);
      }
      const already = copies.find((copy) => copy.condition === 'disposed');
      if (already) {
        throw ruleViolationError(LIBRARY_RULE_CODE, `Bản ${already.copy_no} đã thanh lý`);
      }
      await transaction
        .updateTable('library_copies')
        .set({
          condition: 'disposed',
          disposed_on: this.core.today(),
          disposal_reason: reason,
          disposed_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        })
        .where('id', 'in', copyIds)
        .execute();
      await transaction
        .updateTable('library_reservations')
        .set({ status: 'waiting', copy_id: null, ready_on: null, expires_on: null })
        .where('copy_id', 'in', copyIds)
        .where('status', '=', 'ready')
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_copies',
        entityId: copies[0]?.id ?? copyIds[0] ?? '',
        action: 'update',
        before: copies,
        after: { condition: 'disposed', reason },
      });
      return { disposed: copies.map((copy) => copy.copy_no) };
    });
  }

  // Tem mã: khổ A4 dọc, 3 cột × 10 dòng; mỗi tem có mã QR của số đăng ký cá biệt, nhan đề, tác giả, kệ
  async labels(copyIds: string[], currentUser: CurrentUser, ipAddress: string | null) {
    const database = await this.core.database();
    const rows = await database
      .selectFrom('library_copies')
      .innerJoin('library_titles', 'library_titles.id', 'library_copies.title_id')
      .select([
        'library_copies.id',
        'library_copies.copy_no',
        'library_copies.shelf',
        'library_titles.title',
        'library_titles.authors',
      ])
      .where('library_copies.id', 'in', copyIds)
      .execute();
    if (rows.length !== new Set(copyIds).size) {
      throw validationError([{ field: 'copy_ids', message: 'Có bản sao không tồn tại' }]);
    }
    const order = new Map(copyIds.map((id, index) => [id, index]));
    rows.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
    const createdAt = this.clock.now();
    ensureFonts();
    const cells: PdfContent[] = rows.map((row) => ({
      columns: [
        { width: 46, qr: row.copy_no, fit: 46, margin: [0, 2, 0, 0] },
        {
          width: '*',
          stack: [
            { text: row.copy_no, bold: true, fontSize: 8 },
            { text: row.title, fontSize: 7, maxHeight: 22 },
            { text: row.authors ?? '', fontSize: 6, maxHeight: 8 },
            { text: row.shelf ? `Kệ ${row.shelf}` : '', fontSize: 6 },
          ],
        },
      ],
      columnGap: 4,
      margin: [4, 3, 4, 3],
    }));
    const body: PdfContent[][] = [];
    for (let index = 0; index < cells.length; index += 3) {
      const line = cells.slice(index, index + 3);
      while (line.length < 3) {
        line.push({ text: '' });
      }
      body.push(line);
    }
    const definition = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [14, 22, 14, 22],
      info: { title: 'Tem mã sách', creator: 'School Management' },
      defaultStyle: { font: 'Roboto', fontSize: 7 },
      content: [
        {
          table: { widths: ['*', '*', '*'], heights: 62, dontBreakRows: true, body },
          layout: {
            hLineWidth: () => 0.3,
            vLineWidth: () => 0.3,
            hLineColor: () => '#bbbbbb',
            vLineColor: () => '#bbbbbb',
          },
        },
      ],
    };
    const buffer = await pdfmake
      .createPdf(definition as unknown as Parameters<typeof pdfmake.createPdf>[0])
      .getBuffer();
    const fileName = `tem-ma-sach-${fileStamp(createdAt)}.pdf`;
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: 'library-labels',
        filters_data: JSON.stringify({ count: rows.length }),
        org_unit_ids: [],
        row_count: rows.length,
        contains_personal_data: false,
        file_name: fileName,
        ip_address: ipAddress,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { buffer, fileName, logId: log.id, contentType: 'application/pdf', rowCount: rows.length };
  }

  // Sổ đăng ký cá biệt: mọi bản sao, kể cả đã mất, thanh lý
  async registry(format: TableFileFormat, currentUser: CurrentUser, ipAddress: string | null) {
    const database = await this.core.database();
    const rows = await database
      .selectFrom('library_copies')
      .innerJoin('library_titles', 'library_titles.id', 'library_copies.title_id')
      .innerJoin('library_categories', 'library_categories.id', 'library_titles.category_id')
      .select([
        'library_copies.copy_no',
        'library_titles.title',
        'library_titles.authors',
        'library_titles.publisher',
        'library_titles.publish_year',
        'library_categories.name as category_name',
        'library_copies.source',
        'library_copies.price',
        'library_copies.acquired_on',
        'library_copies.shelf',
        'library_copies.condition',
        'library_copies.disposed_on',
        'library_copies.disposal_reason',
      ])
      .orderBy('library_copies.copy_no')
      .execute();
    const SOURCE: Record<string, string> = { purchase: 'Mua', donation: 'Tặng', supplied: 'Cấp' };
    const CONDITION: Record<string, string> = { good: 'Tốt', damaged: 'Hỏng', lost: 'Mất', disposed: 'Thanh lý' };
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: 'library-registry',
      fileName: `so-dang-ky-ca-biet-${fileStamp(this.clock.now())}.xlsx`,
      filters: {},
      orgUnitIds: [],
      ipAddress,
      createdAt: this.clock.now(),
      format,
      sheets: [
        {
          title: 'Sổ đăng ký cá biệt',
          heading: ['Sổ đăng ký cá biệt'],
          columns: [
            { key: 'copy_no', label: 'Số đăng ký', width: 14 },
            { key: 'title', label: 'Nhan đề', width: 40 },
            { key: 'authors', label: 'Tác giả', width: 24 },
            { key: 'publisher', label: 'Nhà xuất bản', width: 24 },
            { key: 'publish_year', label: 'Năm', width: 8 },
            { key: 'category_name', label: 'Phân loại', width: 20 },
            { key: 'source', label: 'Nguồn', width: 10 },
            { key: 'price', label: 'Giá', width: 12 },
            { key: 'acquired_on', label: 'Ngày nhập', width: 12 },
            { key: 'shelf', label: 'Kệ', width: 10 },
            { key: 'condition', label: 'Tình trạng', width: 12 },
            { key: 'disposed_on', label: 'Ngày thanh lý', width: 12 },
            { key: 'disposal_reason', label: 'Lý do thanh lý', width: 30 },
          ],
          rows: rows.map((row) => ({
            ...row,
            source: SOURCE[row.source] ?? row.source,
            condition: CONDITION[row.condition] ?? row.condition,
          })),
        },
      ],
    });
  }

  async titleFiles(titleId: string) {
    const database = await this.core.database();
    return database
      .selectFrom('library_title_files')
      .select(['id', 'file_name', 'content_type', 'size_bytes', 'created_at'])
      .where('title_id', '=', titleId)
      .orderBy('created_at')
      .execute();
  }

  async attachFile(
    titleId: string,
    file: { fileName: string; body: Buffer },
    currentUser: CurrentUser,
    origin: ChangeOrigin,
  ) {
    const database = await this.core.database();
    await this.core.findTitle(database, titleId);
    if (file.body.length === 0 || file.body.length > MAXIMUM_DIGITAL_BYTES) {
      throw validationError([{ field: 'file', message: 'Tệp từ 1 byte đến 20 MB' }]);
    }
    const contentType = detectArchiveFileType(file.fileName, file.body);
    if (!contentType) {
      throw validationError([{ field: 'file', message: 'Chỉ nhận PDF, ảnh JPEG, PNG, tệp Word hoặc Excel' }]);
    }
    const count = await database
      .selectFrom('library_title_files')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .where('title_id', '=', titleId)
      .executeTakeFirstOrThrow();
    if (Number(count.total) >= MAXIMUM_DIGITAL_FILES) {
      throw ruleViolationError(LIBRARY_RULE_CODE, `Mỗi ấn phẩm tối đa ${MAXIMUM_DIGITAL_FILES} tệp`);
    }
    const id = crypto.randomUUID();
    const key = storageKey('library', titleId, id);
    await this.fileStorage.put(key, file.body, contentType);
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('library_title_files')
        .values({
          id,
          title_id: titleId,
          file_name: file.fileName.slice(0, 200),
          content_type: contentType,
          size_bytes: file.body.length,
          storage_key: key,
          created_by: currentUser.id,
        })
        .returning(['id', 'file_name', 'content_type', 'size_bytes'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_title_files',
        entityId: id,
        action: 'create',
        before: null,
        after: { title_id: titleId, file_name: created.file_name },
      });
      return created;
    });
  }

  async readFile(titleId: string, fileId: string) {
    const database = await this.core.database();
    const file = await database
      .selectFrom('library_title_files')
      .select(['file_name', 'content_type', 'storage_key'])
      .where('id', '=', fileId)
      .where('title_id', '=', titleId)
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp', 'library_title_file');
    }
    return { file, body: await this.fileStorage.get(file.storage_key) };
  }

  async removeFile(titleId: string, fileId: string, origin: ChangeOrigin) {
    const database = await this.core.database();
    const file = await database
      .selectFrom('library_title_files')
      .select(['id', 'file_name', 'storage_key'])
      .where('id', '=', fileId)
      .where('title_id', '=', titleId)
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp', 'library_title_file');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('library_title_files').where('id', '=', fileId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_title_files',
        entityId: fileId,
        action: 'delete',
        before: { title_id: titleId, file_name: file.file_name },
        after: null,
      });
    });
    await this.fileStorage.delete(file.storage_key);
  }
}

// ------------------------------------------------------------------------------------------------------------------
// Điểm cuối
// ------------------------------------------------------------------------------------------------------------------

function readSchoolLevelOrNull(
  body: RequestBody,
  field: string,
  errors: FieldError[],
): SchoolLevelCode | null | undefined {
  const value = body?.[field];
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  if (!(SCHOOL_LEVEL_CODES as readonly string[]).includes(value as string)) {
    errors.push({ field, message: 'Cấp học là MN, TH, THCS hoặc THPT' });
    return undefined;
  }
  return value as SchoolLevelCode;
}

function readTitleChanges(body: RequestBody, errors: FieldError[], creating: boolean): Partial<TitleInput> {
  const changes: Partial<TitleInput> = {};
  const required = (field: keyof TitleInput) => creating || body?.[field] !== undefined;
  if (creating) {
    changes.category_id = readRequiredUuid(body, 'category_id', errors, 'Bắt buộc chọn phân loại');
  } else if (body?.category_id !== undefined) {
    changes.category_id = readRequiredUuid(body, 'category_id', errors, 'Bắt buộc chọn phân loại');
  }
  if (required('title')) {
    changes.title = readRequiredText(body, 'title', errors);
  }
  for (const field of ['authors', 'publisher', 'isbn', 'topic', 'shelf', 'description'] as const) {
    const value = readOptionalText(body, field, errors);
    if (value !== undefined) {
      changes[field] = value;
    } else if (creating) {
      changes[field] = null;
    }
  }
  const year = body?.publish_year === null ? null : readInteger(body, 'publish_year', errors, { min: 1000, max: 2200 });
  if (year !== undefined) {
    changes.publish_year = year;
  } else if (creating) {
    changes.publish_year = null;
  }
  const level = readSchoolLevelOrNull(body, 'school_level', errors);
  if (level !== undefined) {
    changes.school_level = level;
  } else if (creating) {
    changes.school_level = null;
  }
  const grade = readOptionalText(body, 'grade_level', errors);
  if (grade !== undefined) {
    changes.grade_level = grade;
  } else if (creating) {
    changes.grade_level = null;
  }
  const subject = readOptionalUuid(body, 'subject_id', errors);
  if (subject !== undefined) {
    changes.subject_id = subject;
  } else if (creating) {
    changes.subject_id = null;
  }
  const language = readOptionalText(body, 'language', errors);
  if (language) {
    changes.language = language;
  } else if (creating) {
    changes.language = 'vi';
  }
  return changes;
}

function readIds(body: RequestBody, field: string, errors: FieldError[], maximum: number): string[] {
  const raw = body?.[field];
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > maximum || raw.some((value) => !isUuid(value))) {
    errors.push({ field, message: `Chọn từ 1 đến ${maximum} bản sao` });
    return [];
  }
  return raw as string[];
}

@Controller('library')
export class LibraryCatalogController {
  constructor(private readonly catalog: LibraryCatalogService) {}

  @Get('settings')
  @RequirePermission(VIEW, MANAGE)
  settings() {
    return this.catalog.settings();
  }

  @Put('settings')
  @RequirePermission(MANAGE)
  saveSettings(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const levels = body?.student_levels;
    if (!Array.isArray(levels) || levels.some((level) => !(SCHOOL_LEVEL_CODES as readonly string[]).includes(level))) {
      errors.push({ field: 'student_levels', message: 'Cấp học là MN, TH, THCS hoặc THPT' });
    }
    const holdDays = readRequiredInteger(body, 'hold_days', errors, { min: 1, max: 30 });
    const rules: Array<{
      reader_kind: 'staff' | 'student';
      max_items: number;
      loan_days: number;
      max_renewals: number;
      fine_per_day: number;
    }> = [];
    const rawRules = body?.rules;
    if (!Array.isArray(rawRules)) {
      errors.push({ field: 'rules', message: 'Bắt buộc có quy định mượn' });
    } else {
      for (const raw of rawRules as RequestBody[]) {
        const kind = raw?.reader_kind;
        if (kind !== 'staff' && kind !== 'student') {
          errors.push({ field: 'rules', message: 'Loại bạn đọc là staff hoặc student' });
          continue;
        }
        rules.push({
          reader_kind: kind,
          max_items: readRequiredInteger(raw, 'max_items', errors, { min: 1, max: 100 }),
          loan_days: readRequiredInteger(raw, 'loan_days', errors, { min: 1, max: 365 }),
          max_renewals: readRequiredInteger(raw, 'max_renewals', errors, { min: 0, max: 10 }),
          fine_per_day: readRequiredInteger(raw, 'fine_per_day', errors, { min: 0, max: 1000000 }),
        });
      }
    }
    const indicators: Array<{ code: string; threshold: number | null; enabled: boolean }> = [];
    const rawIndicators = body?.indicators;
    if (rawIndicators !== undefined) {
      if (!Array.isArray(rawIndicators)) {
        errors.push({ field: 'indicators', message: 'Phải là danh sách' });
      } else {
        for (const raw of rawIndicators as RequestBody[]) {
          const threshold = raw?.threshold;
          if (
            typeof raw?.code !== 'string' ||
            (threshold !== null && threshold !== undefined && (typeof threshold !== 'number' || threshold < 0))
          ) {
            errors.push({ field: 'indicators', message: 'Chỉ tiêu cần mã và ngưỡng không âm' });
            continue;
          }
          indicators.push({ code: raw.code, threshold: threshold ?? null, enabled: raw.enabled !== false });
        }
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.catalog.saveSettings(
      currentUser,
      { studentLevels: levels as SchoolLevelCode[], holdDays, rules, indicators },
      originOf(request, currentUser),
    );
  }

  @Post('categories')
  @RequirePermission(MANAGE)
  createCategory(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      lendable: body?.lendable !== false,
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 9999 }) ?? 0,
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.catalog.createCategory(input, originOf(request, currentUser));
  }

  @Patch('categories/:id')
  @RequirePermission(MANAGE)
  updateCategory(
    @Param('id', uuidParameter('Mã phân loại không hợp lệ')) categoryId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (body?.code !== undefined) {
      errors.push({ field: 'code', message: 'Mã phân loại không đổi được' });
    }
    const changes = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      lendable: typeof body?.lendable === 'boolean' ? body.lendable : undefined,
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 9999 }),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.catalog.updateCategory(categoryId, changes, originOf(request, currentUser));
  }

  @Get('titles')
  @RequirePermission(VIEW, MANAGE)
  titles(@Query() query: Record<string, string | undefined>) {
    const errors: FieldError[] = [];
    for (const field of ['category_id', 'subject_id']) {
      if (query[field] && !isUuid(query[field])) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    const level = readSchoolLevelOrNull(query, 'school_level', errors);
    if (query.status && query.status !== 'active' && query.status !== 'retired') {
      errors.push({ field: 'status', message: 'Trạng thái là active hoặc retired' });
    }
    const limit = Math.min(Number(query.limit) || 50, MAXIMUM_PAGE);
    const offset = Math.max(Number(query.offset) || 0, 0);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.catalog.titles({
      query: query.query?.trim() || undefined,
      categoryId: query.category_id || undefined,
      gradeLevel: query.grade_level || undefined,
      subjectId: query.subject_id || undefined,
      schoolLevel: level ?? undefined,
      status: (query.status as 'active' | 'retired' | undefined) ?? 'active',
      limit,
      offset,
    });
  }

  @Post('titles')
  @RequirePermission(MANAGE)
  createTitle(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = readTitleChanges(body, errors, true) as TitleInput;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.catalog.createTitle(input, currentUser, originOf(request, currentUser));
  }

  @Get('titles/:id')
  @RequirePermission(VIEW, MANAGE)
  title(@Param('id', uuidParameter('Mã ấn phẩm không hợp lệ')) titleId: string) {
    return this.catalog.title(titleId);
  }

  @Patch('titles/:id')
  @RequirePermission(MANAGE)
  updateTitle(
    @Param('id', uuidParameter('Mã ấn phẩm không hợp lệ')) titleId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes: Partial<TitleInput> & { status?: 'active' | 'retired' } = readTitleChanges(body, errors, false);
    if (body?.status !== undefined) {
      if (body.status !== 'active' && body.status !== 'retired') {
        errors.push({ field: 'status', message: 'Trạng thái là active hoặc retired' });
      } else {
        changes.status = body.status;
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.catalog.updateTitle(titleId, changes, originOf(request, currentUser));
  }

  @Post('titles/:id/copies')
  @RequirePermission(MANAGE)
  addCopies(
    @Param('id', uuidParameter('Mã ấn phẩm không hợp lệ')) titleId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const quantity = readRequiredInteger(body, 'quantity', errors, { min: 1, max: MAXIMUM_COPIES_AT_ONCE });
    const source = (body?.source ?? 'purchase') as LibraryCopySource;
    if (!COPY_SOURCES.includes(source)) {
      errors.push({ field: 'source', message: 'Nguồn là purchase, donation hoặc supplied' });
    }
    const price =
      body?.price === undefined || body.price === null
        ? null
        : (readInteger(body, 'price', errors, { min: 0, max: 1000000000 }) ?? null);
    const acquired = readOptionalText(body, 'acquired_on', errors) ?? null;
    if (acquired !== null && !/^\d{4}-\d{2}-\d{2}$/.test(acquired)) {
      errors.push({ field: 'acquired_on', message: 'Ngày theo dạng YYYY-MM-DD' });
    }
    const shelf = readOptionalText(body, 'shelf', errors) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.catalog.addCopies(
      titleId,
      quantity,
      { source, price, acquired_on: acquired, shelf },
      currentUser,
      originOf(request, currentUser),
    );
  }

  @Get('copies')
  @RequirePermission(MANAGE)
  copies(@Query() query: Record<string, string | undefined>) {
    const errors: FieldError[] = [];
    if (query.title_id && !isUuid(query.title_id)) {
      errors.push({ field: 'title_id', message: 'Mã không hợp lệ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.catalog.copies({
      titleId: query.title_id || undefined,
      code: query.code || undefined,
      shelf: query.shelf || undefined,
      condition: query.condition || undefined,
    });
  }

  @Patch('copies/:id')
  @RequirePermission(MANAGE)
  updateCopy(
    @Param('id', uuidParameter('Mã bản sao không hợp lệ')) copyId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const condition = body?.condition as LibraryCopyCondition | undefined;
    if (condition !== undefined && !COPY_CONDITIONS.includes(condition)) {
      errors.push({
        field: 'condition',
        message: 'Tình trạng là good hoặc damaged; mất, thanh lý làm ở chức năng riêng',
      });
    }
    const changes = {
      condition,
      shelf: readOptionalText(body, 'shelf', errors),
      note: readOptionalText(body, 'note', errors),
      price: body?.price === null ? null : readInteger(body, 'price', errors, { min: 0, max: 1000000000 }),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.catalog.updateCopy(copyId, changes, originOf(request, currentUser));
  }

  @Post('copies/dispose')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  dispose(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = readIds(body, 'copy_ids', errors, MAXIMUM_COPIES_AT_ONCE);
    const reason = readRequiredText(body, 'reason', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.catalog.disposeCopies(ids, reason, currentUser, originOf(request, currentUser));
  }

  @Post('labels')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  async labels(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const ids = readIds(body, 'copy_ids', errors, MAXIMUM_COPIES_AT_ONCE);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    sendWorkbook(response, await this.catalog.labels(ids, currentUser, request.ip ?? null));
  }

  @Get('registry')
  @RequirePermission(MANAGE)
  async registry(
    @Query('format') format: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const parsed = readTableFileFormat(format);
    if (!parsed) {
      throw validationError([{ field: 'format', message: 'Định dạng là xlsx hoặc pdf' }]);
    }
    sendWorkbook(response, await this.catalog.registry(parsed, currentUser, request.ip ?? null));
  }

  @Get('titles/:id/files')
  @RequirePermission(VIEW, MANAGE)
  files(@Param('id', uuidParameter('Mã ấn phẩm không hợp lệ')) titleId: string) {
    return this.catalog.titleFiles(titleId);
  }

  @Post('titles/:id/files')
  @RequirePermission(MANAGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_DIGITAL_BYTES, files: 1 } }))
  attach(
    @Param('id', uuidParameter('Mã ấn phẩm không hợp lệ')) titleId: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp' }]);
    }
    return this.catalog.attachFile(
      titleId,
      { fileName: decodeFileName(file), body: file.buffer },
      currentUser,
      originOf(request, currentUser),
    );
  }

  @Get('titles/:id/files/:fileId')
  @RequirePermission(VIEW, MANAGE)
  async file(
    @Param('id', uuidParameter('Mã ấn phẩm không hợp lệ')) titleId: string,
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @Res() response: Response,
  ) {
    const { file, body } = await this.catalog.readFile(titleId, fileId);
    response.setHeader('content-type', file.content_type);
    response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
    response.setHeader('cache-control', 'no-store');
    response.send(body);
  }

  @Delete('titles/:id/files/:fileId')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async removeFile(
    @Param('id', uuidParameter('Mã ấn phẩm không hợp lệ')) titleId: string,
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.catalog.removeFile(titleId, fileId, originOf(request, currentUser));
  }
}
