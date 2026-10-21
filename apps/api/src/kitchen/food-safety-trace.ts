import { Body, Controller, Get, HttpCode, Injectable, Post, Query, Req, Res } from '@nestjs/common';
import type { MealType, SchoolYearDatabase } from '@school-management/database';
import { Clock, validationError, type FieldError } from '@school-management/server';
import {
  FOOD_CHECK_RESULTS,
  FOOD_REJECTION_ACTIONS,
  FOOD_STORAGE_CONDITIONS,
  foodCertificateValidity,
} from '@school-management/shared';
import type { PdfContent } from 'pdfmake';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { buildPdf, buildTableFile, CONTENT_TYPES, type TableFileSheet } from '../exports/table-file.js';
import { fileStamp, sendWorkbook } from '../facilities/facilities-workbook.js';
import { FoodInspectionsService } from './food-inspections.js';
import { suggestLots, vietnamMoment } from './food-safety-calc.js';
import { FoodSafetyRecordsService } from './food-safety-records.js';
import { FoodSamplesService } from './food-samples.js';
import { KitchenAccess } from './kitchen-access.js';
import { MEAL_LABELS, MEAL_TYPES, check, queryDate, queryUuid, readDate } from './kitchen-fields.js';

// Truy xuất nguồn gốc và sổ in của bán trú (DT-18 phần 22b, YCTD-146). Truy xuất từ món ăn của một ngày ra lô hàng, nhà cung
// cấp, giấy tờ an toàn thực phẩm còn hiệu lực vào ngày đó, kết quả ba bước kiểm tra và mẫu lưu: lô lấy từ bước 2 đã ghi
// ("đã ghi"); ngày chưa có bước 2 thì suy ra theo nguyên liệu của món và lô đã đạt nhập trước ngày ("suy ra", cần đối chiếu).
// Sổ in theo các mẫu của Quyết định 1246/QĐ-BYT: sổ kiểm thực ba bước (mẫu số 1 hai bảng, mẫu số 2, mẫu số 3), sổ theo dõi lưu
// và hủy mẫu (mẫu số 5), nhãn mẫu thức ăn lưu (mẫu số 4)
const MAXIMUM_BOOK_DAYS = 62;
const DECISION = 'Theo Quyết định số 1246/QĐ-BYT ngày 31/3/2017 của Bộ Y tế';

const labelOf = (values: ReadonlyArray<{ value: string; label: string }>, value: string | null | undefined) =>
  values.find((item) => item.value === value)?.label ?? '';
const result = (value: string | null | undefined) => labelOf(FOOD_CHECK_RESULTS, value);
const time = (value: string | null) => (value ? value.slice(0, 5) : '');

type Book = 'inspections' | 'samples' | 'labels';

@Injectable()
export class FoodSafetyTraceService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: KitchenAccess,
    private readonly records: FoodSafetyRecordsService,
    private readonly inspections: FoodInspectionsService,
    private readonly samples: FoodSamplesService,
    private readonly clock: Clock,
  ) {}

  async trace(currentUser: CurrentUser, orgUnitId: string, date: string, dishId: string | null) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, orgUnitId);
    const lines = await database
      .selectFrom('food_inspection_lines')
      .innerJoin('food_inspections', 'food_inspections.id', 'food_inspection_lines.inspection_id')
      .select([
        'food_inspection_lines.id',
        'food_inspections.id as inspection_id',
        'food_inspections.step',
        'food_inspections.status as inspection_status',
        'food_inspections.inspector_name',
        'food_inspection_lines.meal_type',
        'food_inspection_lines.dish_id',
        'food_inspection_lines.dish_name',
        'food_inspection_lines.servings',
        'food_inspection_lines.sensory_result',
        'food_inspection_lines.hygiene_people',
        'food_inspection_lines.hygiene_equipment',
        'food_inspection_lines.hygiene_area',
        'food_inspection_lines.action',
      ])
      .where('food_inspections.org_unit_id', '=', orgUnitId)
      .where('food_inspections.inspection_date', '=', date)
      .where('food_inspections.step', 'in', [2, 3])
      .execute();
    const keyOf = (row: { meal_type: MealType | null; dish_id: string | null; dish_name: string | null }) =>
      `${row.meal_type}:${row.dish_id ?? row.dish_name}`;
    const dishes = new Map<
      string,
      { meal_type: MealType; dish_id: string | null; dish_name: string; servings: number | null }
    >();
    for (const line of lines) {
      if (line.meal_type && line.dish_name && !dishes.has(keyOf(line))) {
        dishes.set(keyOf(line), {
          meal_type: line.meal_type,
          dish_id: line.dish_id,
          dish_name: line.dish_name,
          servings: line.servings,
        });
      }
    }
    for (const suggestion of await this.inspections.suggestedLines(database, orgUnitId, date, 3)) {
      if (suggestion.meal_type && suggestion.dish_name && !dishes.has(keyOf(suggestion))) {
        dishes.set(keyOf(suggestion), {
          meal_type: suggestion.meal_type,
          dish_id: suggestion.dish_id,
          dish_name: suggestion.dish_name,
          servings: suggestion.servings,
        });
      }
    }
    const chosen = [...dishes.values()]
      .filter((dish) => dishId === null || dish.dish_id === dishId)
      .sort(
        (left, right) =>
          MEAL_TYPES.indexOf(left.meal_type) - MEAL_TYPES.indexOf(right.meal_type) ||
          left.dish_name.localeCompare(right.dish_name),
      );
    const recordedLots = lines.length
      ? await database
          .selectFrom('food_inspection_line_lots')
          .select(['line_id', 'lot_id'])
          .where(
            'line_id',
            'in',
            lines.map((line) => line.id),
          )
          .execute()
      : [];
    const dishIds = chosen.map((dish) => dish.dish_id).filter((value): value is string => value !== null);
    const norms = dishIds.length
      ? await database
          .selectFrom('ingredient_norms')
          .select(['dish_id', 'ingredient_id'])
          .where('dish_id', 'in', dishIds)
          .execute()
      : [];
    const candidates = await database
      .selectFrom('food_lots')
      .select(['id', 'ingredient_id', 'received_date', 'expiry_date', 'status'])
      .where('org_unit_id', '=', orgUnitId)
      .where('received_date', '<=', date)
      .where('status', 'in', ['accepted', 'used_up'])
      .execute();
    const samples = await database
      .selectFrom('food_samples')
      .selectAll()
      .where('org_unit_id', '=', orgUnitId)
      .where('sample_date', '=', date)
      .execute();
    const now = this.clock.now();
    const plan = chosen.map((dish) => {
      const own = lines.filter((line) => keyOf(line) === keyOf(dish));
      const step2 = own.find((line) => line.step === 2) ?? null;
      const step3 = own.find((line) => line.step === 3) ?? null;
      const recorded = step2 ? recordedLots.filter((row) => row.line_id === step2.id).map((row) => row.lot_id) : [];
      const inferred =
        recorded.length > 0 || !dish.dish_id
          ? []
          : suggestLots(
              norms.filter((norm) => norm.dish_id === dish.dish_id).map((norm) => norm.ingredient_id),
              candidates.map((lot) => ({ ...lot, status: 'accepted' })),
              date,
            );
      return { dish, step2, step3, recorded, inferred };
    });
    const lotIds = [...new Set(plan.flatMap((item) => [...item.recorded, ...item.inferred]))];
    const lots = lotIds.length ? await this.records.lotsByIds(database, lotIds) : [];
    const supplierIds = [...new Set(lots.map((lot) => lot.supplier_id))];
    const certificates = supplierIds.length
      ? await database
          .selectFrom('food_supplier_certificates')
          .select(['id', 'supplier_id', 'certificate_type', 'number', 'issued_on', 'expires_on', 'status'])
          .where('supplier_id', 'in', supplierIds)
          .execute()
      : [];
    const firstSteps = lotIds.length
      ? await database
          .selectFrom('food_inspection_lines')
          .innerJoin('food_inspections', 'food_inspections.id', 'food_inspection_lines.inspection_id')
          .select([
            'food_inspection_lines.lot_id',
            'food_inspections.inspection_date',
            'food_inspections.inspector_name',
            'food_inspection_lines.sensory_result',
            'food_inspection_lines.rapid_test_result',
          ])
          .where('food_inspection_lines.lot_id', 'in', lotIds)
          .execute()
      : [];
    const lotDetail = (lotId: string) => {
      const lot = lots.find((row) => row.id === lotId);
      if (!lot) {
        return null;
      }
      return {
        ...this.records.lotView(lot, date),
        first_step: firstSteps.find((row) => row.lot_id === lotId) ?? null,
        certificates: certificates
          .filter((row) => row.supplier_id === lot.supplier_id)
          .map((row) => ({ ...row, validity_on_date: foodCertificateValidity(row, date, 0) })),
      };
    };
    return {
      org_unit_id: orgUnitId,
      date,
      dishes: plan.map((item) => ({
        ...item.dish,
        step2: item.step2,
        step3: item.step3,
        lots_source: item.recorded.length > 0 ? 'recorded' : item.inferred.length > 0 ? 'inferred' : 'none',
        lots: (item.recorded.length > 0 ? item.recorded : item.inferred).map(lotDetail).filter((lot) => lot !== null),
        samples: samples
          .filter(
            (sample) =>
              sample.meal_type === item.dish.meal_type &&
              (sample.dish_id ?? sample.dish_name) === (item.dish.dish_id ?? item.dish.dish_name),
          )
          .map((sample) => this.samples.view(sample, now)),
      })),
    };
  }

  private async heading(database: Kysely<SchoolYearDatabase>, orgUnitId: string) {
    const root = await database
      .selectFrom('org_units')
      .select('name')
      .where('parent_id', 'is', null)
      .orderBy('created_at')
      .executeTakeFirst();
    const unit = await database
      .selectFrom('org_units')
      .select(['name', 'address'])
      .where('id', '=', orgUnitId)
      .executeTakeFirstOrThrow();
    const name = root && root.name !== unit.name ? `${root.name} – ${unit.name}` : unit.name;
    return { name, address: unit.address };
  }

  // Sổ in theo khoảng ngày; ghi nhật ký xuất (không có dữ liệu cá nhân của học sinh)
  async book(
    currentUser: CurrentUser,
    input: { orgUnitId: string; from: string; to: string; book: Book; format: 'pdf' | 'xlsx' },
    ipAddress: string | null,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, input.orgUnitId);
    const days = (Date.parse(input.to) - Date.parse(input.from)) / 86_400_000;
    if (days < 0 || days > MAXIMUM_BOOK_DAYS) {
      throw validationError([{ field: 'to', message: `Khoảng ngày từ 1 đến ${MAXIMUM_BOOK_DAYS + 1} ngày` }]);
    }
    const place = await this.heading(database, input.orgUnitId);
    const period = input.from === input.to ? `Ngày ${input.from}` : `Từ ngày ${input.from} đến ngày ${input.to}`;
    const createdAt = this.clock.now();
    let sheets: TableFileSheet[];
    let closing: PdfContent[];
    let title: string;
    if (input.book === 'inspections') {
      title = 'Sổ kiểm thực ba bước';
      sheets = await this.inspectionSheets(database, input, place, period);
      closing = signatures(['Người kiểm tra', 'Thủ trưởng đơn vị']);
    } else if (input.book === 'samples') {
      title = 'Sổ theo dõi lưu và hủy mẫu thức ăn lưu';
      sheets = await this.sampleSheets(database, input, place, period);
      closing = signatures(['Người lập sổ', 'Thủ trưởng đơn vị']);
    } else {
      title = 'Nhãn mẫu thức ăn lưu';
      if (input.format !== 'pdf') {
        throw validationError([{ field: 'format', message: 'Nhãn mẫu chỉ in PDF' }]);
      }
      sheets = [];
      closing = await this.labels(database, input);
    }
    const rowCount = sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
    const buffer =
      input.format === 'pdf'
        ? await buildPdf(sheets, createdAt, {
            closing,
            subject: title,
            orientation: input.book === 'labels' ? 'portrait' : 'landscape',
          })
        : await buildTableFile('xlsx', sheets, createdAt);
    const slug = { inspections: 'so-kiem-thuc-ba-buoc', samples: 'so-luu-huy-mau', labels: 'nhan-mau-luu' }[input.book];
    const fileName = `${slug}-${input.from}-${input.to}-${fileStamp(createdAt)}.${input.format}`;
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: `food-safety-${input.book}`,
        filters_data: JSON.stringify({ org_unit_id: input.orgUnitId, from: input.from, to: input.to }),
        org_unit_ids: [input.orgUnitId],
        row_count: rowCount,
        contains_personal_data: false,
        file_name: fileName,
        ip_address: ipAddress,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { buffer, fileName, logId: log.id, contentType: CONTENT_TYPES[input.format], rowCount };
  }

  private async inspectionSheets(
    database: Kysely<SchoolYearDatabase>,
    input: { orgUnitId: string; from: string; to: string },
    place: { name: string; address: string | null },
    period: string,
  ): Promise<TableFileSheet[]> {
    const lines = await database
      .selectFrom('food_inspection_lines')
      .innerJoin('food_inspections', 'food_inspections.id', 'food_inspection_lines.inspection_id')
      .selectAll('food_inspection_lines')
      .select([
        'food_inspections.inspection_date',
        'food_inspections.step',
        'food_inspections.inspector_name',
        'food_inspections.inspector_title',
        'food_inspections.inspected_time',
        'food_inspections.status as inspection_status',
      ])
      .where('food_inspections.org_unit_id', '=', input.orgUnitId)
      .where('food_inspections.inspection_date', '>=', input.from)
      .where('food_inspections.inspection_date', '<=', input.to)
      .orderBy('food_inspections.inspection_date')
      .orderBy('food_inspection_lines.line_no')
      .execute();
    const lotIds = lines.map((line) => line.lot_id).filter((value): value is string => value !== null);
    const lots = lotIds.length ? await this.records.lotsByIds(database, lotIds) : [];
    const head = (form: string, caption: string) => [
      `${form}: ${caption}`,
      `Tên cơ sở: ${place.name}`,
      `Địa điểm kiểm tra: ${place.address ?? place.name}`,
      `${period}. ${DECISION}`,
    ];
    const inspector = (line: (typeof lines)[number]) =>
      `${line.inspector_name}${line.inspector_title ? `, ${line.inspector_title}` : ''}${
        line.inspected_time ? ` (${time(line.inspected_time)})` : ''
      }${line.inspection_status === 'draft' ? ' – chưa xác nhận' : ''}`;
    const stepOne = (category: 'fresh' | 'dry') =>
      lines
        .filter((line) => line.step === 1)
        .map((line) => ({ line, lot: lots.find((lot) => lot.id === line.lot_id) }))
        .filter((item) => item.lot?.food_category === category);
    const handling = (line: (typeof lines)[number]) =>
      [labelOf(FOOD_REJECTION_ACTIONS, line.rejection_action), line.action, line.note].filter(Boolean).join('. ');
    const fresh = stepOne('fresh').map(({ line, lot }) => ({
      date: line.inspection_date,
      food: `${lot?.ingredient_name ?? ''} (${lot?.code ?? ''})`,
      received: `${lot?.received_date ?? ''} ${time(lot?.received_time ?? null)}`.trim(),
      quantity: `${Number(lot?.quantity ?? 0).toLocaleString('vi-VN')} ${lot?.unit ?? ''}`,
      supplier: lot?.supplier_name ?? '',
      contact: [lot?.supplier_address, lot?.supplier_phone].filter(Boolean).join(', '),
      deliverer: lot?.deliverer_name ?? '',
      document: lot?.document_number ?? lot?.purchase_code ?? '',
      veterinary: lot?.veterinary_certificate ?? '',
      quarantine: lot?.quarantine_certificate ?? '',
      sensory: result(line.sensory_result),
      rapid: result(line.rapid_test_result),
      handling: handling(line),
      inspector: inspector(line),
    }));
    const dry = stepOne('dry').map(({ line, lot }) => ({
      date: line.inspection_date,
      food: `${lot?.ingredient_name ?? ''} (${lot?.code ?? ''})`,
      manufacturer: lot?.manufacturer ?? '',
      manufacturer_address: lot?.manufacturer_address ?? '',
      received: `${lot?.received_date ?? ''} ${time(lot?.received_time ?? null)}`.trim(),
      quantity: `${Number(lot?.quantity ?? 0).toLocaleString('vi-VN')} ${lot?.unit ?? ''}`,
      supplier: [lot?.supplier_name, lot?.deliverer_name].filter(Boolean).join(' – '),
      contact: [lot?.supplier_address, lot?.supplier_phone].filter(Boolean).join(', '),
      expiry: lot?.expiry_date ?? '',
      storage: labelOf(FOOD_STORAGE_CONDITIONS, lot?.storage_condition),
      document: lot?.document_number ?? lot?.purchase_code ?? '',
      sensory: result(line.sensory_result),
      handling: handling(line),
      inspector: inspector(line),
    }));
    const meal = (line: (typeof lines)[number]) => (line.meal_type ? MEAL_LABELS[line.meal_type] : '');
    const stepTwo = lines
      .filter((line) => line.step === 2)
      .map((line) => ({
        date: line.inspection_date,
        meal: meal(line),
        dish: line.dish_name ?? '',
        ingredients: line.main_ingredients ?? '',
        servings: line.servings ?? '',
        prepared: time(line.first_time),
        cooked: time(line.second_time),
        people: result(line.hygiene_people),
        equipment: result(line.hygiene_equipment),
        area: result(line.hygiene_area),
        sensory: result(line.sensory_result),
        handling: handling(line),
        inspector: inspector(line),
      }));
    const stepThree = lines
      .filter((line) => line.step === 3)
      .map((line) => ({
        date: line.inspection_date,
        meal: meal(line),
        dish: line.dish_name ?? '',
        servings: line.servings ?? '',
        portioned: time(line.first_time),
        eating: time(line.second_time),
        utensils: line.utensils ?? '',
        sensory: result(line.sensory_result),
        handling: handling(line),
        inspector: inspector(line),
      }));
    return [
      {
        title: 'Mẫu số 1 – I',
        heading: head('Mẫu số 1', 'KIỂM TRA TRƯỚC KHI CHẾ BIẾN THỨC ĂN (Bước 1) – I. Thực phẩm tươi sống, đông lạnh'),
        numbered: true,
        columns: [
          { key: 'date', label: 'Ngày kiểm tra', width: 12 },
          { key: 'food', label: 'Tên thực phẩm', width: 24 },
          { key: 'received', label: 'Thời gian nhập (ngày, giờ)', width: 16 },
          { key: 'quantity', label: 'Khối lượng (kg/lít...)', width: 12 },
          { key: 'supplier', label: 'Nơi cung cấp: tên cơ sở', width: 20 },
          { key: 'contact', label: 'Địa chỉ, điện thoại', width: 22 },
          { key: 'deliverer', label: 'Tên người giao hàng', width: 16 },
          { key: 'document', label: 'Chứng từ, hóa đơn', width: 14 },
          { key: 'veterinary', label: 'Giấy ĐK VS thú y', width: 14 },
          { key: 'quarantine', label: 'Giấy kiểm dịch', width: 14 },
          { key: 'sensory', label: 'Kiểm tra cảm quan', width: 10 },
          { key: 'rapid', label: 'Xét nghiệm nhanh (nếu có)', width: 10 },
          { key: 'handling', label: 'Biện pháp xử lý/Ghi chú', width: 24 },
          { key: 'inspector', label: 'Người kiểm tra', width: 20 },
        ],
        rows: fresh,
      },
      {
        title: 'Mẫu số 1 – II',
        heading: head(
          'Mẫu số 1',
          'KIỂM TRA TRƯỚC KHI CHẾ BIẾN THỨC ĂN (Bước 1) – II. Thực phẩm khô, bao gói sẵn, phụ gia',
        ),
        numbered: true,
        columns: [
          { key: 'date', label: 'Ngày kiểm tra', width: 12 },
          { key: 'food', label: 'Tên thực phẩm', width: 24 },
          { key: 'manufacturer', label: 'Tên cơ sở sản xuất', width: 18 },
          { key: 'manufacturer_address', label: 'Địa chỉ sản xuất', width: 20 },
          { key: 'received', label: 'Thời gian nhập (ngày, giờ)', width: 16 },
          { key: 'quantity', label: 'Khối lượng (kg/lít...)', width: 12 },
          { key: 'supplier', label: 'Nơi cung cấp: tên cơ sở, tên chủ giao hàng', width: 22 },
          { key: 'contact', label: 'Địa chỉ, điện thoại', width: 20 },
          { key: 'expiry', label: 'Hạn sử dụng', width: 12 },
          { key: 'storage', label: 'Điều kiện bảo quản', width: 14 },
          { key: 'document', label: 'Chứng từ, hóa đơn', width: 14 },
          { key: 'sensory', label: 'Kiểm tra cảm quan (nhãn, bao bì, bảo quản, hạn sử dụng...)', width: 14 },
          { key: 'handling', label: 'Biện pháp xử lý/Ghi chú', width: 22 },
          { key: 'inspector', label: 'Người kiểm tra', width: 20 },
        ],
        rows: dry,
      },
      {
        title: 'Mẫu số 2',
        heading: head('Mẫu số 2', 'KIỂM TRA KHI CHẾ BIẾN THỨC ĂN (Bước 2)'),
        numbered: true,
        columns: [
          { key: 'date', label: 'Ngày kiểm tra', width: 12 },
          { key: 'meal', label: 'Ca/bữa ăn', width: 10 },
          { key: 'dish', label: 'Tên món ăn', width: 20 },
          { key: 'ingredients', label: 'Nguyên liệu chính để chế biến (tên, số lượng...)', width: 30 },
          { key: 'servings', label: 'Số lượng/số suất ăn', width: 10 },
          { key: 'prepared', label: 'Thời gian sơ chế xong', width: 10 },
          { key: 'cooked', label: 'Thời gian chế biến xong', width: 10 },
          { key: 'people', label: 'Vệ sinh: người tham gia chế biến', width: 12 },
          { key: 'equipment', label: 'Vệ sinh: trang thiết bị dụng cụ', width: 12 },
          { key: 'area', label: 'Vệ sinh: khu vực chế biến và phụ trợ', width: 12 },
          { key: 'sensory', label: 'Kiểm tra cảm quan thức ăn (màu, mùi, vị, trạng thái, bảo quản...)', width: 14 },
          { key: 'handling', label: 'Biện pháp xử lý/Ghi chú', width: 22 },
          { key: 'inspector', label: 'Người kiểm tra', width: 20 },
        ],
        rows: stepTwo,
      },
      {
        title: 'Mẫu số 3',
        heading: head('Mẫu số 3', 'KIỂM TRA TRƯỚC KHI ĂN (Bước 3)'),
        numbered: true,
        columns: [
          { key: 'date', label: 'Ngày kiểm tra', width: 12 },
          { key: 'meal', label: 'Ca/bữa ăn', width: 10 },
          { key: 'dish', label: 'Tên món ăn', width: 22 },
          { key: 'servings', label: 'Số lượng suất ăn', width: 10 },
          { key: 'portioned', label: 'Thời gian chia món ăn xong', width: 12 },
          { key: 'eating', label: 'Thời gian bắt đầu ăn', width: 12 },
          { key: 'utensils', label: 'Dụng cụ chia, chứa đựng, che đậy, bảo quản thức ăn', width: 26 },
          { key: 'sensory', label: 'Kiểm tra cảm quan món ăn (màu, mùi, vị, trạng thái, bảo quản...)', width: 14 },
          { key: 'handling', label: 'Biện pháp xử lý/Ghi chú', width: 22 },
          { key: 'inspector', label: 'Người kiểm tra', width: 20 },
        ],
        rows: stepThree,
      },
    ];
  }

  private async sampleSheets(
    database: Kysely<SchoolYearDatabase>,
    input: { orgUnitId: string; from: string; to: string },
    place: { name: string; address: string | null },
    period: string,
  ): Promise<TableFileSheet[]> {
    const rows = await database
      .selectFrom('food_samples')
      .selectAll()
      .where('org_unit_id', '=', input.orgUnitId)
      .where('sample_date', '>=', input.from)
      .where('sample_date', '<=', input.to)
      .orderBy('sampled_at')
      .execute();
    return [
      {
        title: 'Mẫu số 5',
        heading: [
          'Mẫu số 5: MẪU THEO DÕI LƯU VÀ HỦY MẪU THỨC ĂN LƯU',
          `Tên cơ sở: ${place.name}`,
          `Địa điểm kiểm tra: ${place.address ?? place.name}`,
          `${period}. ${DECISION}`,
        ],
        numbered: true,
        columns: [
          { key: 'dish', label: 'Tên mẫu thức ăn', width: 22 },
          { key: 'meal', label: 'Bữa ăn (giờ ăn...)', width: 12 },
          { key: 'servings', label: 'Số lượng suất ăn', width: 10 },
          { key: 'quantity', label: 'Khối lượng/thể tích mẫu (gam/ml)', width: 12 },
          { key: 'container', label: 'Dụng cụ chứa mẫu thức ăn lưu', width: 16 },
          { key: 'temperature', label: 'Nhiệt độ bảo quản mẫu (°C)', width: 10 },
          { key: 'sampled', label: 'Thời gian lấy mẫu (giờ, ngày, tháng, năm)', width: 18 },
          { key: 'destroyed', label: 'Thời gian hủy mẫu (giờ, ngày, tháng, năm)', width: 18 },
          { key: 'note', label: 'Ghi chú (chất lượng mẫu thức ăn lưu...)', width: 22 },
          { key: 'sampler', label: 'Người lưu mẫu (ký và ghi rõ họ tên)', width: 18 },
          { key: 'destroyer', label: 'Người hủy mẫu (ký và ghi rõ họ tên)', width: 18 },
        ],
        rows: rows.map((row) => ({
          dish: row.dish_name,
          meal: MEAL_LABELS[row.meal_type],
          servings: row.servings,
          quantity: `${Number(row.quantity).toLocaleString('vi-VN')} ${row.food_form === 'solid' ? 'g' : 'ml'}`,
          container: row.container,
          temperature: Number(row.storage_temperature).toLocaleString('vi-VN'),
          sampled: vietnamMoment(row.sampled_at),
          destroyed: row.status === 'held' ? 'Đang giữ mẫu' : vietnamMoment(row.destroyed_at),
          note: [row.quality_note, row.hold_reason ? `Giữ mẫu: ${row.hold_reason}` : null, row.note]
            .filter(Boolean)
            .join('. '),
          sampler: row.sampled_by_name,
          destroyer: row.destroyed_by_name ?? '',
        })),
      },
    ];
  }

  // Mẫu số 4: nhãn dán dụng cụ chứa mẫu, hai nhãn mỗi hàng
  private async labels(
    database: Kysely<SchoolYearDatabase>,
    input: { orgUnitId: string; from: string; to: string },
  ): Promise<PdfContent[]> {
    const rows = await database
      .selectFrom('food_samples')
      .select(['dish_name', 'meal_type', 'sampled_at', 'sampled_by_name'])
      .where('org_unit_id', '=', input.orgUnitId)
      .where('sample_date', '>=', input.from)
      .where('sample_date', '<=', input.to)
      .orderBy('sampled_at')
      .execute();
    const label = (row: (typeof rows)[number]): PdfContent => ({
      width: '*',
      margin: [0, 0, 8, 8],
      table: {
        widths: ['*'],
        body: [
          [{ text: 'MẪU THỨC ĂN LƯU', bold: true, alignment: 'center', fontSize: 10 }],
          [{ text: `Bữa ăn: ${MEAL_LABELS[row.meal_type]}`, fontSize: 9 }],
          [{ text: `Tên mẫu thức ăn: ${row.dish_name}`, fontSize: 9 }],
          [{ text: `Thời gian lấy: ${vietnamMoment(row.sampled_at)}`, fontSize: 9 }],
          [{ text: `Người lấy mẫu: ${row.sampled_by_name}`, fontSize: 9 }],
          [{ text: '(Họ tên và chữ ký)', italics: true, fontSize: 7, margin: [0, 0, 0, 14] }],
        ],
      },
      layout: {
        hLineWidth: (index: number, node: { table: { body: unknown[] } }) =>
          index === 0 || index === node.table.body.length ? 1 : 0,
      },
    });
    if (rows.length === 0) {
      return [{ text: 'Không có mẫu thức ăn lưu trong khoảng ngày đã chọn.' }];
    }
    const content: PdfContent[] = [
      { text: 'Mẫu số 4: NHÃN MẪU THỨC ĂN LƯU', bold: true, fontSize: 12, margin: [0, 0, 0, 8] },
    ];
    for (let index = 0; index < rows.length; index += 2) {
      const pair = rows.slice(index, index + 2);
      content.push({
        columns: [...pair.map(label), ...(pair.length === 1 ? [{ width: '*', text: '' }] : [])],
        unbreakable: true,
      });
    }
    return content;
  }
}

function signatures(titles: string[]): PdfContent[] {
  return [
    {
      margin: [0, 18, 0, 0],
      unbreakable: true,
      columns: titles.map((title) => ({
        width: '*',
        stack: [
          { text: title, bold: true, alignment: 'center' },
          { text: '(Kí, ghi rõ họ tên)', italics: true, alignment: 'center', fontSize: 7 },
        ],
      })),
    },
  ];
}

@Controller()
export class FoodSafetyTraceController {
  constructor(private readonly trace: FoodSafetyTraceService) {}

  @Get('food-safety/trace')
  traceDay(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.trace.trace(
      currentUser,
      queryUuid(query.org_unit_id, 'org_unit_id', true) ?? '',
      queryDate(query.date, 'date', true) ?? '',
      queryUuid(query.dish_id, 'dish_id'),
    );
  }

  @Post('food-safety/books')
  @HttpCode(200)
  async book(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const from = readDate(body, 'from', errors, true) ?? '';
    const to = readDate(body, 'to', errors, true) ?? '';
    const book = body?.book as Book;
    if (!['inspections', 'samples', 'labels'].includes(book)) {
      errors.push({ field: 'book', message: 'Sổ là inspections, samples hoặc labels' });
    }
    const format =
      body?.format === 'xlsx' ? 'xlsx' : body?.format === undefined || body?.format === 'pdf' ? 'pdf' : null;
    if (!format) {
      errors.push({ field: 'format', message: 'Định dạng là pdf hoặc xlsx' });
    }
    check(errors);
    sendWorkbook(
      response,
      await this.trace.book(currentUser, { orgUnitId, from, to, book, format: format ?? 'pdf' }, request.ip ?? null),
    );
  }
}
