import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApplicationError, Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { sql } from 'kysely';
import pdfmake, { type PdfContent } from 'pdfmake';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { isUuid, notFoundError, readOptionalText, readRequiredText, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { ensureFonts, readTableFileFormat, type TableFileFormat } from '../exports/table-file.js';
import { buildFacilitiesWorkbook, fileStamp, sendWorkbook } from '../facilities/facilities-workbook.js';
import { indicatorPassed, indicatorValues, LIBRARY_RULE_CODE, normalizeScannedCode, overdueDays, stocktakeResult } from './library-calc.js';
import { LibraryCatalogService } from './library-catalog.js';
import { LibraryCore } from './library-core.js';

// Kiểm kê, báo cáo thống kê và chỉ tiêu theo chuẩn thư viện, in thẻ bạn đọc (DT-22 phần 22a, YCTD-181; tài liệu 32 mục 13.4).
// - kiểm kê: mở đợt (cả kho hoặc một kệ), quét mã bản sao, đối chiếu với sổ (thiếu, thừa, hỏng), đóng đợt rồi xử lý chênh
//   lệch: đánh dấu mất hoặc thanh lý bản thiếu;
// - báo cáo: kho theo phân loại, khối; sách giáo khoa, tham khảo trên học sinh; lượt mượn theo tháng, lớp; ấn phẩm, bạn đọc
//   tích cực; quá hạn; chỉ tiêu theo chuẩn, ngưỡng cấu hình ở thiết lập (để trống đến khi đọc văn bản gốc, mục 13.2)
const MANAGE = PERMISSION_CODES.schoolLibraryManage;
const MAXIMUM_CARDS = 500;

@Injectable()
export class LibraryReportsService {
  constructor(
    private readonly core: LibraryCore,
    private readonly catalog: LibraryCatalogService,
    private readonly clock: Clock,
  ) {}

  // ------------------------------------------------------------------------------------------------------------------
  // Kiểm kê
  // ------------------------------------------------------------------------------------------------------------------

  async stocktakes() {
    const database = await this.core.database();
    return database
      .selectFrom('library_stocktakes')
      .select([
        'library_stocktakes.id',
        'library_stocktakes.name',
        'library_stocktakes.shelf',
        'library_stocktakes.status',
        'library_stocktakes.started_by_name',
        'library_stocktakes.started_at',
        'library_stocktakes.closed_at',
        sql<string>`(select count(*) from library_stocktake_items where library_stocktake_items.stocktake_id = library_stocktakes.id)`.as(
          'scanned',
        ),
      ])
      .orderBy('library_stocktakes.started_at', 'desc')
      .limit(200)
      .execute()
      .then((rows) => rows.map((row) => ({ ...row, scanned: Number(row.scanned) })));
  }

  async startStocktake(currentUser: CurrentUser, input: { name: string; shelf: string | null }, origin: ChangeOrigin) {
    const database = await this.core.database();
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('library_stocktakes')
        .values({ name: input.name, shelf: input.shelf, started_by_name: currentUser.description.full_name })
        .returning(['id', 'name', 'shelf', 'status'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_stocktakes',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  private async findStocktake(stocktakeId: string) {
    const database = await this.core.database();
    const row = await database
      .selectFrom('library_stocktakes')
      .select(['id', 'name', 'shelf', 'status', 'started_at', 'closed_at'])
      .where('id', '=', stocktakeId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy đợt kiểm kê', 'library_stocktake');
    }
    return { database, stocktake: row };
  }

  async scan(currentUser: CurrentUser, stocktakeId: string, code: string) {
    const { database, stocktake } = await this.findStocktake(stocktakeId);
    if (stocktake.status !== 'open') {
      throw ruleViolationError(LIBRARY_RULE_CODE, 'Đợt kiểm kê đã đóng');
    }
    const copy = await database
      .selectFrom('library_copies')
      .innerJoin('library_titles', 'library_titles.id', 'library_copies.title_id')
      .select(['library_copies.id', 'library_copies.copy_no', 'library_copies.condition', 'library_copies.shelf', 'library_titles.title'])
      .where('library_copies.copy_no', '=', normalizeScannedCode(code))
      .executeTakeFirst();
    if (!copy) {
      throw notFoundError(`Không tìm thấy bản sao ${code}`, 'library_copy');
    }
    const inserted = await database
      .insertInto('library_stocktake_items')
      .values({ stocktake_id: stocktakeId, copy_id: copy.id, scanned_by_name: currentUser.description.full_name })
      .onConflict((conflict) => conflict.columns(['stocktake_id', 'copy_id']).doNothing())
      .returning('copy_id')
      .executeTakeFirst();
    const onLoan = await database
      .selectFrom('library_loans')
      .select('id')
      .where('copy_id', '=', copy.id)
      .where('status', '=', 'open')
      .executeTakeFirst();
    const total = await database
      .selectFrom('library_stocktake_items')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .where('stocktake_id', '=', stocktakeId)
      .executeTakeFirstOrThrow();
    return {
      copy_no: copy.copy_no,
      title: copy.title,
      condition: copy.condition,
      shelf: copy.shelf,
      duplicate: inserted === undefined,
      on_loan: onLoan !== undefined,
      outside_shelf: stocktake.shelf !== null && copy.shelf !== stocktake.shelf,
      scanned: Number(total.total),
    };
  }

  async stocktake(stocktakeId: string) {
    const { database, stocktake } = await this.findStocktake(stocktakeId);
    const scannedRows = await database
      .selectFrom('library_stocktake_items')
      .select('copy_id')
      .where('stocktake_id', '=', stocktakeId)
      .execute();
    const scanned = new Set(scannedRows.map((row) => row.copy_id));
    const rows = await database
      .selectFrom('library_copies')
      .innerJoin('library_titles', 'library_titles.id', 'library_copies.title_id')
      .select([
        'library_copies.id',
        'library_copies.copy_no',
        'library_copies.condition',
        'library_copies.shelf',
        'library_titles.title',
        sql<boolean>`exists (select 1 from library_loans where library_loans.copy_id = library_copies.id and library_loans.status = 'open')`.as(
          'on_loan',
        ),
      ])
      .$if(stocktake.shelf !== null, (builder) =>
        builder.where((eb) => eb.or([eb('library_copies.shelf', '=', stocktake.shelf ?? ''), eb('library_copies.id', 'in', [...scanned, ''])])),
      )
      .orderBy('library_copies.copy_no')
      .execute();
    const result = stocktakeResult(rows.map((row) => ({ id: row.id, condition: row.condition, onLoan: row.on_loan, scanned: scanned.has(row.id) })));
    const byId = new Map(rows.map((row) => [row.id, row]));
    const describe = (ids: string[]) =>
      ids.map((id) => {
        const row = byId.get(id);
        return { id, copy_no: row?.copy_no ?? '', title: row?.title ?? '', shelf: row?.shelf ?? null, condition: row?.condition ?? 'good', on_loan: row?.on_loan ?? false };
      });
    return {
      ...stocktake,
      expected: rows.filter((row) => row.condition !== 'lost' && row.condition !== 'disposed').length,
      found: result.found,
      missing: describe(result.missing),
      surplus: describe(result.surplus),
      damaged: describe(result.damaged),
    };
  }

  async closeStocktake(currentUser: CurrentUser, stocktakeId: string, origin: ChangeOrigin) {
    const { database, stocktake } = await this.findStocktake(stocktakeId);
    if (stocktake.status !== 'open') {
      throw ruleViolationError(LIBRARY_RULE_CODE, 'Đợt kiểm kê đã đóng');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('library_stocktakes')
        .set({ status: 'closed', closed_at: this.clock.now(), closed_by_name: currentUser.description.full_name })
        .where('id', '=', stocktakeId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_stocktakes',
        entityId: stocktakeId,
        action: 'update',
        before: { status: 'open' },
        after: { status: 'closed' },
      });
    });
    return this.stocktake(stocktakeId);
  }

  // Xử lý bản thiếu sau khi đóng đợt: đánh dấu mất hoặc thanh lý (có lý do)
  async resolve(
    currentUser: CurrentUser,
    stocktakeId: string,
    input: { copyIds: string[]; action: 'lost' | 'dispose'; reason: string },
    origin: ChangeOrigin,
  ) {
    const { database, stocktake } = await this.findStocktake(stocktakeId);
    if (stocktake.status !== 'closed') {
      throw ruleViolationError(LIBRARY_RULE_CODE, 'Đóng đợt kiểm kê rồi mới xử lý chênh lệch');
    }
    const report = await this.stocktake(stocktakeId);
    const allowed = new Set(report.missing.map((item) => item.id));
    if (input.copyIds.some((id) => !allowed.has(id))) {
      throw validationError([{ field: 'copy_ids', message: 'Chỉ xử lý được bản thiếu của đợt kiểm kê này' }]);
    }
    if (input.action === 'dispose') {
      return this.catalog.disposeCopies(input.copyIds, input.reason, currentUser, origin);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('library_copies')
        .set({ condition: 'lost', note: input.reason, updated_at: this.clock.now() })
        .where('id', 'in', input.copyIds)
        .execute();
      await transaction
        .updateTable('library_reservations')
        .set({ status: 'waiting', copy_id: null, ready_on: null, expires_on: null })
        .where('copy_id', 'in', input.copyIds)
        .where('status', '=', 'ready')
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'library_copies',
        entityId: input.copyIds[0] ?? stocktakeId,
        action: 'update',
        before: null,
        after: { condition: 'lost', reason: input.reason, stocktake_id: stocktakeId },
      });
    });
    return { lost: input.copyIds.length };
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Báo cáo
  // ------------------------------------------------------------------------------------------------------------------

  async overview() {
    const database = await this.core.database();
    const settings = await this.core.settings(database);
    const today = this.core.today();
    const num = (value: string | number | null | undefined) => Number(value ?? 0);

    const [byCategory, byGrade, conditions, titleCounts, students, teachers, readersWithLoan, loanTotals, byMonth, byClass, topTitles, topReaders, indicators] =
      await Promise.all([
        database
          .selectFrom('library_categories')
          .leftJoin('library_titles', (join) => join.onRef('library_titles.category_id', '=', 'library_categories.id').on('library_titles.status', '=', 'active'))
          .leftJoin('library_copies', (join) =>
            join.onRef('library_copies.title_id', '=', 'library_titles.id').on('library_copies.condition', 'in', ['good', 'damaged']),
          )
          .select([
            'library_categories.code',
            'library_categories.name',
            sql<string>`count(distinct library_titles.id)`.as('titles'),
            sql<string>`count(library_copies.id)`.as('copies'),
          ])
          .groupBy(['library_categories.code', 'library_categories.name', 'library_categories.order_no'])
          .orderBy('library_categories.order_no')
          .execute(),
        database
          .selectFrom('library_titles')
          .innerJoin('library_copies', (join) =>
            join.onRef('library_copies.title_id', '=', 'library_titles.id').on('library_copies.condition', 'in', ['good', 'damaged']),
          )
          .select([sql<string>`coalesce(library_titles.grade_level, '')`.as('grade_level'), sql<string>`count(*)`.as('copies')])
          .where('library_titles.status', '=', 'active')
          .groupBy(sql`coalesce(library_titles.grade_level, '')`)
          .orderBy(sql`coalesce(library_titles.grade_level, '')`)
          .execute(),
        database
          .selectFrom('library_copies')
          .select(['condition', sql<string>`count(*)`.as('copies')])
          .groupBy('condition')
          .execute(),
        database
          .selectFrom('library_titles')
          .leftJoin('library_title_files', 'library_title_files.title_id', 'library_titles.id')
          .select([
            sql<string>`count(distinct library_titles.id)`.as('active_titles'),
            sql<string>`count(distinct library_title_files.title_id)`.as('digital_titles'),
          ])
          .where('library_titles.status', '=', 'active')
          .executeTakeFirstOrThrow(),
        settings.student_levels.length === 0
          ? Promise.resolve({ total: '0' })
          : database
              .selectFrom('children')
              .innerJoin('class_enrollments', (join) =>
                join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
              )
              .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
              .select((eb) => eb.fn.countAll<string>().as('total'))
              .where('children.status', '=', 'active')
              .where('classes.school_level', 'in', settings.student_levels)
              .executeTakeFirstOrThrow(),
        database
          .selectFrom('staff')
          .select((eb) => eb.fn.countAll<string>().as('total'))
          .where('status', '=', 'active')
          .executeTakeFirstOrThrow(),
        database
          .selectFrom('library_loans')
          .select(sql<string>`count(distinct reader_id)`.as('total'))
          .executeTakeFirstOrThrow(),
        database
          .selectFrom('library_loans')
          .select([
            sql<string>`count(*)`.as('loans'),
            sql<string>`count(*) filter (where status = 'open')`.as('open_loans'),
            sql<string>`count(*) filter (where status = 'open' and due_on < ${today}::date)`.as('overdue_loans'),
            sql<string>`count(*) filter (where status = 'lost')`.as('lost_loans'),
          ])
          .executeTakeFirstOrThrow(),
        database
          .selectFrom('library_loans')
          .select([sql<string>`to_char(loaned_on, 'YYYY-MM')`.as('month'), sql<string>`count(*)`.as('loans')])
          .where('kind', '=', 'regular')
          .groupBy(sql`to_char(loaned_on, 'YYYY-MM')`)
          .orderBy(sql`to_char(loaned_on, 'YYYY-MM')`)
          .execute(),
        database
          .selectFrom('library_loans')
          .innerJoin('classes', 'classes.id', 'library_loans.class_id')
          .select(['classes.name as class_name', sql<string>`count(*)`.as('loans')])
          .where('library_loans.kind', '=', 'regular')
          .groupBy('classes.name')
          .orderBy(sql`count(*)`, 'desc')
          .limit(10)
          .execute(),
        database
          .selectFrom('library_loans')
          .innerJoin('library_copies', 'library_copies.id', 'library_loans.copy_id')
          .innerJoin('library_titles', 'library_titles.id', 'library_copies.title_id')
          .select(['library_titles.title', sql<string>`count(*)`.as('loans')])
          .where('library_loans.kind', '=', 'regular')
          .groupBy('library_titles.title')
          .orderBy(sql`count(*)`, 'desc')
          .limit(10)
          .execute(),
        database
          .selectFrom('library_loans')
          .innerJoin('library_readers', 'library_readers.id', 'library_loans.reader_id')
          .leftJoin('staff', 'staff.id', 'library_readers.staff_id')
          .leftJoin('children', 'children.id', 'library_readers.child_id')
          .select([sql<string>`coalesce(staff.full_name, children.full_name)`.as('reader_name'), 'library_readers.card_no', sql<string>`count(*)`.as('loans')])
          .where('library_loans.kind', '=', 'regular')
          .groupBy([sql`coalesce(staff.full_name, children.full_name)`, 'library_readers.card_no'])
          .orderBy(sql`count(*)`, 'desc')
          .limit(10)
          .execute(),
        database.selectFrom('library_indicators').select(['code', 'name', 'threshold', 'enabled']).orderBy('order_no').execute(),
      ]);

    const copiesOf = (code: string) => num(byCategory.find((row) => row.code === code)?.copies);
    const studentCount = num(students.total);
    const teacherCount = num(teachers.total);
    const totalCopies = byCategory.reduce((sum, row) => sum + num(row.copies), 0);
    const values = indicatorValues({
      students: studentCount,
      teachers: teacherCount,
      textbookCopies: copiesOf('SGK'),
      referenceCopies: copiesOf('STK'),
      teacherBookCopies: copiesOf('SGV') + copiesOf('STK'),
      totalCopies,
      activeTitles: num(titleCounts.active_titles),
      digitalTitles: num(titleCounts.digital_titles),
      readersWithLoan: num(readersWithLoan.total),
    });
    return {
      as_of: today,
      students: studentCount,
      teachers: teacherCount,
      titles: num(titleCounts.active_titles),
      copies: totalCopies,
      by_category: byCategory.map((row) => ({ code: row.code, name: row.name, titles: num(row.titles), copies: num(row.copies) })),
      by_grade: byGrade.map((row) => ({ grade_level: row.grade_level, copies: num(row.copies) })),
      by_condition: conditions.map((row) => ({ condition: row.condition, copies: num(row.copies) })),
      loans: {
        total: num(loanTotals.loans),
        open: num(loanTotals.open_loans),
        overdue: num(loanTotals.overdue_loans),
        lost: num(loanTotals.lost_loans),
      },
      by_month: byMonth.map((row) => ({ month: row.month, loans: num(row.loans) })),
      by_class: byClass.map((row) => ({ class_name: row.class_name, loans: num(row.loans) })),
      top_titles: topTitles.map((row) => ({ title: row.title, loans: num(row.loans) })),
      top_readers: topReaders.map((row) => ({ reader_name: row.reader_name, card_no: row.card_no, loans: num(row.loans) })),
      indicators: indicators
        .filter((item) => item.enabled)
        .map((item) => {
          const value = values[item.code as keyof typeof values] ?? null;
          const threshold = item.threshold === null ? null : Number(item.threshold);
          return { code: item.code, name: item.name, value, threshold, passed: indicatorPassed(value, threshold) };
        }),
    };
  }

  async exportReport(type: 'overview' | 'loans' | 'overdue', format: TableFileFormat, currentUser: CurrentUser, ipAddress: string | null) {
    const database = await this.core.database();
    const createdAt = this.clock.now();
    const today = this.core.today();
    const common = {
      database,
      currentUser,
      reportCode: `library-${type}`,
      filters: { type },
      orgUnitIds: [],
      ipAddress,
      createdAt,
      format,
    };
    if (type === 'overview') {
      const data = await this.overview();
      return buildFacilitiesWorkbook({
        ...common,
        fileName: `bao-cao-thu-vien-${fileStamp(createdAt)}.xlsx`,
        sheets: [
          {
            title: 'Chỉ tiêu',
            heading: ['Báo cáo thư viện', `Tính đến ngày ${data.as_of}`],
            columns: [
              { key: 'name', label: 'Chỉ tiêu', width: 50 },
              { key: 'value', label: 'Giá trị', width: 14 },
              { key: 'threshold', label: 'Ngưỡng', width: 14 },
              { key: 'passed', label: 'Kết luận', width: 14 },
            ],
            rows: data.indicators.map((item) => ({
              ...item,
              passed: item.passed === null ? 'Chưa kết luận' : item.passed ? 'Đạt' : 'Chưa đạt',
            })),
          },
          {
            title: 'Kho theo phân loại',
            columns: [
              { key: 'name', label: 'Phân loại', width: 30 },
              { key: 'titles', label: 'Số đầu', width: 12 },
              { key: 'copies', label: 'Số bản', width: 12 },
            ],
            rows: data.by_category,
          },
          {
            title: 'Mượn theo tháng',
            columns: [
              { key: 'month', label: 'Tháng', width: 12 },
              { key: 'loans', label: 'Lượt mượn', width: 12 },
            ],
            rows: data.by_month,
          },
          {
            title: 'Mượn nhiều nhất',
            columns: [
              { key: 'title', label: 'Nhan đề', width: 50 },
              { key: 'loans', label: 'Lượt mượn', width: 12 },
            ],
            rows: data.top_titles,
          },
        ],
      });
    }
    const rows = await database
      .selectFrom('library_loans')
      .innerJoin('library_copies', 'library_copies.id', 'library_loans.copy_id')
      .innerJoin('library_titles', 'library_titles.id', 'library_copies.title_id')
      .innerJoin('library_readers', 'library_readers.id', 'library_loans.reader_id')
      .leftJoin('staff', 'staff.id', 'library_readers.staff_id')
      .leftJoin('children', 'children.id', 'library_readers.child_id')
      .leftJoin('classes', 'classes.id', 'library_loans.class_id')
      .select([
        'library_copies.copy_no',
        'library_titles.title',
        'library_readers.card_no',
        sql<string>`coalesce(staff.full_name, children.full_name)`.as('reader_name'),
        'classes.name as class_name',
        'library_loans.kind',
        'library_loans.loaned_on',
        'library_loans.due_on',
        'library_loans.returned_on',
        'library_loans.status',
        'library_loans.fine_amount',
      ])
      .$if(type === 'overdue', (builder) => builder.where('library_loans.status', '=', 'open').where('library_loans.due_on', '<', today))
      .orderBy('library_loans.due_on')
      .execute();
    const STATUS: Record<string, string> = { open: 'Đang mượn', returned: 'Đã trả', lost: 'Mất' };
    return buildFacilitiesWorkbook({
      ...common,
      fileName: `${type === 'overdue' ? 'sach-qua-han' : 'so-muon-tra'}-${fileStamp(createdAt)}.xlsx`,
      sheets: [
        {
          title: type === 'overdue' ? 'Sách quá hạn' : 'Sổ mượn trả',
          heading: [type === 'overdue' ? 'Danh sách sách quá hạn' : 'Sổ mượn trả', `Tính đến ngày ${today}`],
          columns: [
            { key: 'copy_no', label: 'Số đăng ký', width: 14 },
            { key: 'title', label: 'Nhan đề', width: 40 },
            { key: 'card_no', label: 'Số thẻ', width: 12 },
            { key: 'reader_name', label: 'Bạn đọc', width: 26 },
            { key: 'class_name', label: 'Lớp', width: 12 },
            { key: 'kind', label: 'Loại', width: 14 },
            { key: 'loaned_on', label: 'Ngày mượn', width: 12 },
            { key: 'due_on', label: 'Hạn trả', width: 12 },
            { key: 'overdue_days', label: 'Ngày trễ', width: 10 },
            { key: 'returned_on', label: 'Ngày trả', width: 12 },
            { key: 'status', label: 'Tình trạng', width: 12 },
            { key: 'fine_amount', label: 'Tiền phạt', width: 12 },
          ],
          rows: rows.map((row) => ({
            ...row,
            kind: row.kind === 'textbook' ? 'Sách giáo khoa' : 'Mượn thường',
            status: STATUS[row.status] ?? row.status,
            overdue_days: row.status === 'open' ? overdueDays(row.due_on, today) : '',
          })),
        },
      ],
    });
  }

  // In thẻ bạn đọc: khổ A4 dọc, 2 cột × 5 dòng; mã QR là số thẻ
  async cards(readerIds: string[], currentUser: CurrentUser, ipAddress: string | null) {
    const database = await this.core.database();
    const rows = await database
      .selectFrom('library_readers')
      .leftJoin('staff', 'staff.id', 'library_readers.staff_id')
      .leftJoin('children', 'children.id', 'library_readers.child_id')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'library_readers.child_id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'library_readers.id',
        'library_readers.card_no',
        'library_readers.reader_kind',
        sql<string>`coalesce(staff.full_name, children.full_name)`.as('full_name'),
        'classes.name as class_name',
      ])
      .where('library_readers.id', 'in', readerIds)
      .execute();
    if (rows.length !== new Set(readerIds).size) {
      throw validationError([{ field: 'reader_ids', message: 'Có bạn đọc không tồn tại' }]);
    }
    const order = new Map(readerIds.map((id, index) => [id, index]));
    rows.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
    ensureFonts();
    const cells: PdfContent[] = rows.map((row) => ({
      stack: [
        { text: 'THẺ BẠN ĐỌC', bold: true, fontSize: 9, alignment: 'center' },
        {
          columns: [
            { width: 64, qr: row.card_no, fit: 64, margin: [0, 6, 0, 0] },
            {
              width: '*',
              stack: [
                { text: row.full_name, bold: true, fontSize: 10, margin: [0, 8, 0, 2] },
                { text: row.reader_kind === 'staff' ? 'Cán bộ, giáo viên' : `Lớp ${row.class_name ?? ''}`, fontSize: 8 },
                { text: row.card_no, fontSize: 9, margin: [0, 4, 0, 0] },
              ],
            },
          ],
          columnGap: 8,
        },
      ],
      margin: [8, 8, 8, 8],
    }));
    const body: PdfContent[][] = [];
    for (let index = 0; index < cells.length; index += 2) {
      const line = cells.slice(index, index + 2);
      while (line.length < 2) {
        line.push({ text: '' });
      }
      body.push(line);
    }
    const definition = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [24, 28, 24, 28],
      info: { title: 'Thẻ bạn đọc', creator: 'School Management' },
      defaultStyle: { font: 'Roboto', fontSize: 8 },
      content: [
        {
          table: { widths: ['*', '*'], heights: 118, dontBreakRows: true, body },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#999999', vLineColor: () => '#999999' },
        },
      ],
    };
    const buffer = await pdfmake.createPdf(definition as unknown as Parameters<typeof pdfmake.createPdf>[0]).getBuffer();
    const createdAt = this.clock.now();
    const fileName = `the-ban-doc-${fileStamp(createdAt)}.pdf`;
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: 'library-cards',
        filters_data: JSON.stringify({ count: rows.length }),
        org_unit_ids: [],
        row_count: rows.length,
        contains_personal_data: true,
        file_name: fileName,
        ip_address: ipAddress,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { buffer, fileName, logId: log.id, contentType: 'application/pdf', rowCount: rows.length };
  }
}

@Controller('library')
export class LibraryReportsController {
  constructor(private readonly reports: LibraryReportsService) {}

  @Get('stocktakes')
  @RequirePermission(MANAGE)
  stocktakes() {
    return this.reports.stocktakes();
  }

  @Post('stocktakes')
  @RequirePermission(MANAGE)
  start(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const name = readRequiredText(body, 'name', errors);
    const shelf = readOptionalText(body, 'shelf', errors) ?? null;
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.reports.startStocktake(currentUser, { name, shelf }, originOf(request, currentUser));
  }

  @Get('stocktakes/:id')
  @RequirePermission(MANAGE)
  stocktake(@Param('id', uuidParameter('Mã đợt kiểm kê không hợp lệ')) stocktakeId: string) {
    return this.reports.stocktake(stocktakeId);
  }

  @Post('stocktakes/:id/scan')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  scan(
    @Param('id', uuidParameter('Mã đợt kiểm kê không hợp lệ')) stocktakeId: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const code = readRequiredText(body, 'code', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.reports.scan(currentUser, stocktakeId, code);
  }

  @Post('stocktakes/:id/close')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  close(
    @Param('id', uuidParameter('Mã đợt kiểm kê không hợp lệ')) stocktakeId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.reports.closeStocktake(currentUser, stocktakeId, originOf(request, currentUser));
  }

  @Post('stocktakes/:id/resolve')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  resolve(
    @Param('id', uuidParameter('Mã đợt kiểm kê không hợp lệ')) stocktakeId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const ids = body?.copy_ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || ids.some((id) => !isUuid(id))) {
      errors.push({ field: 'copy_ids', message: 'Chọn từ 1 đến 500 bản sao' });
    }
    if (body?.action !== 'lost' && body?.action !== 'dispose') {
      errors.push({ field: 'action', message: 'Xử lý là lost (đánh dấu mất) hoặc dispose (thanh lý)' });
    }
    const reason = readRequiredText(body, 'reason', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.reports.resolve(
      currentUser,
      stocktakeId,
      { copyIds: ids as string[], action: body?.action as 'lost' | 'dispose', reason },
      originOf(request, currentUser),
    );
  }

  @Get('reports/overview')
  @RequirePermission(MANAGE)
  overview() {
    return this.reports.overview();
  }

  @Get('reports/export')
  @RequirePermission(MANAGE)
  async exportReport(
    @Query('type') type: string | undefined,
    @Query('format') format: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const parsed = readTableFileFormat(format);
    if (!parsed) {
      throw validationError([{ field: 'format', message: 'Định dạng là xlsx hoặc pdf' }]);
    }
    if (type !== 'overview' && type !== 'loans' && type !== 'overdue') {
      throw validationError([{ field: 'type', message: 'Báo cáo là overview, loans hoặc overdue' }]);
    }
    sendWorkbook(response, await this.reports.exportReport(type, parsed, currentUser, request.ip ?? null));
  }

  @Post('readers/cards')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  async cards(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const ids = body?.reader_ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAXIMUM_CARDS || ids.some((id) => !isUuid(id))) {
      throw validationError([{ field: 'reader_ids', message: `Chọn từ 1 đến ${MAXIMUM_CARDS} bạn đọc` }]);
    }
    sendWorkbook(response, await this.reports.cards(ids as string[], currentUser, request.ip ?? null));
  }
}

