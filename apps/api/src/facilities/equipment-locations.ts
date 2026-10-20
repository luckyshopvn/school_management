import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { Clock, validationError, type FieldError } from '@school-management/server';
import { EQUIPMENT_LOCATION_TYPES, PERMISSION_CODES, equipmentQrCodeOf } from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely, Transaction } from 'kysely';
import pdfmake, { type PdfContent } from 'pdfmake';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readOptionalText,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { ensureFonts } from '../exports/table-file.js';
import { generateQrCode } from './equipment-stocktake-calc.js';
import { FacilitiesData } from './facilities-data.js';
import { fileStamp, sendWorkbook } from './facilities-workbook.js';

// Nơi để thiết bị và tem QR (DT-18 phần 18g, YCTD-143):
// - nơi để của một đơn vị: phòng (gắn phòng đã khai báo), kho, vị trí trong phòng hoặc kho; mã nơi để duy nhất trong đơn vị;
// - gán nơi để hàng loạt cho tài sản (từng thiết bị) và lô (số hiện có của một thiết bị tại đơn vị hoặc lớp);
// - in tem QR khổ A4, 3 cột × 8 dòng; mã tem cấp khi in lần đầu và giữ nguyên khi in lại; nội dung QR chỉ là mã tem, không
//   có tên miền; tra mã tem trả thông tin thiết bị và nơi để để quét kiểm kê
const MANAGE = PERMISSION_CODES.equipmentManage;
const REPORT = PERMISSION_CODES.facilitiesReport;
const STOCKTAKE = PERMISSION_CODES.equipmentStocktake;
export const EQUIPMENT_RULE = 'YCTD-143';
const MAX_TARGETS = 500;

export type TargetType = 'asset' | 'holding';

export interface LocationInput {
  code?: string;
  name?: string;
  location_type?: 'room' | 'store' | 'position';
  room_id?: string | null;
  parent_id?: string | null;
  status?: 'active' | 'inactive';
  note?: string | null;
}

export interface TargetRef {
  target_type: TargetType;
  id: string;
}

// Một tài sản hoặc một lô kèm nơi để và mã tem, dùng cho danh sách gán nơi để, in tem và tra mã QR
export interface EquipmentTarget {
  target_type: TargetType;
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  equipment_item_id: string | null;
  equipment_item_code: string | null;
  class_name: string | null;
  location_id: string | null;
  location_name: string | null;
  qr_code: string | null;
  status: string;
}

export function readLocationInput(body: RequestBody, errors: FieldError[], creating: boolean): LocationInput {
  const input: LocationInput = {};
  const code = creating ? readRequiredText(body, 'code', errors) : readOptionalText(body, 'code', errors);
  if (code !== undefined && code !== null) {
    if (code.length > 30) {
      errors.push({ field: 'code', message: 'Tối đa 30 ký tự' });
    } else if (code) {
      input.code = code;
    }
  } else if (code === null) {
    errors.push({ field: 'code', message: 'Bắt buộc nhập' });
  }
  const name = creating ? readRequiredText(body, 'name', errors) : readOptionalText(body, 'name', errors);
  if (name !== undefined && name !== null) {
    if (name.length > 200) {
      errors.push({ field: 'name', message: 'Tối đa 200 ký tự' });
    } else if (name) {
      input.name = name;
    }
  } else if (name === null) {
    errors.push({ field: 'name', message: 'Bắt buộc nhập' });
  }
  const type = body?.location_type;
  if (type !== undefined || creating) {
    if (typeof type !== 'string' || !EQUIPMENT_LOCATION_TYPES.some((item) => item.value === type)) {
      errors.push({ field: 'location_type', message: 'Loại nơi để là room, store hoặc position' });
    } else {
      input.location_type = type as LocationInput['location_type'];
    }
  }
  const roomId = readOptionalUuid(body, 'room_id', errors);
  if (roomId !== undefined) {
    input.room_id = roomId;
  }
  const parentId = readOptionalUuid(body, 'parent_id', errors);
  if (parentId !== undefined) {
    input.parent_id = parentId;
  }
  const note = readOptionalText(body, 'note', errors);
  if (note !== undefined) {
    if (note && note.length > 500) {
      errors.push({ field: 'note', message: 'Tối đa 500 ký tự' });
    } else {
      input.note = note;
    }
  }
  if (!creating) {
    const status = body?.status;
    if (status !== undefined && status !== 'active' && status !== 'inactive') {
      errors.push({ field: 'status', message: 'Trạng thái phải là active hoặc inactive' });
    } else if (status) {
      input.status = status;
    }
  }
  return input;
}

export function readTargets(body: RequestBody, errors: FieldError[]): TargetRef[] {
  const raw = body?.targets;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_TARGETS) {
    errors.push({ field: 'targets', message: `Chọn từ 1 đến ${MAX_TARGETS} thiết bị hoặc lô` });
    return [];
  }
  const seen = new Set<string>();
  const targets: TargetRef[] = [];
  raw.forEach((entry, index) => {
    const item = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    if ((item.target_type !== 'asset' && item.target_type !== 'holding') || !isUuid(item.id)) {
      errors.push({ field: `targets.${index}`, message: 'Đối tượng phải là asset hoặc holding kèm mã' });
      return;
    }
    const key = `${item.target_type}:${item.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      targets.push({ target_type: item.target_type, id: item.id });
    }
  });
  return targets;
}

// Đọc tài sản (chưa thanh lý) và lô của các đơn vị; lọc theo nơi để (kể cả vị trí con), loại, mã đã chọn
export async function loadTargets(
  database: Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>,
  filter: {
    orgUnitIds: string[];
    locationIds?: string[] | null;
    targetType?: TargetType | null;
    refs?: TargetRef[];
    qrCode?: string;
    search?: string | null;
  },
): Promise<EquipmentTarget[]> {
  if (filter.orgUnitIds.length === 0) {
    return [];
  }
  const assetIds = filter.refs?.filter((ref) => ref.target_type === 'asset').map((ref) => ref.id);
  const holdingIds = filter.refs?.filter((ref) => ref.target_type === 'holding').map((ref) => ref.id);
  const result: EquipmentTarget[] = [];
  if (filter.targetType !== 'holding' && (!assetIds || assetIds.length > 0)) {
    let query = database
      .selectFrom('assets')
      .innerJoin('org_units', 'org_units.id', 'assets.org_unit_id')
      .leftJoin('equipment_items', 'equipment_items.id', 'assets.equipment_item_id')
      .leftJoin('equipment_locations', 'equipment_locations.id', 'assets.equipment_location_id')
      .select([
        'assets.id',
        'assets.org_unit_id',
        'org_units.name as org_unit_name',
        'assets.code',
        'assets.name',
        'assets.unit',
        'assets.equipment_item_id',
        'equipment_items.code as equipment_item_code',
        'assets.equipment_location_id as location_id',
        'equipment_locations.name as location_name',
        'assets.qr_code',
        'assets.status',
        // Nơi cấp phát của kho (phòng, lớp, người) dùng làm nơi để khi chưa gán nơi để
        'assets.location_name as class_name',
      ])
      .where('assets.org_unit_id', 'in', filter.orgUnitIds)
      .where('assets.status', '<>', 'disposed');
    if (assetIds) {
      query = query.where('assets.id', 'in', assetIds);
    }
    if (filter.qrCode) {
      query = query.where('assets.qr_code', '=', filter.qrCode);
    }
    if (filter.locationIds) {
      query = query.where('assets.equipment_location_id', 'in', filter.locationIds);
    }
    if (filter.search) {
      const pattern = `%${filter.search}%`;
      query = query.where((eb) => eb.or([eb('assets.code', 'ilike', pattern), eb('assets.name', 'ilike', pattern)]));
    }
    for (const row of await query.orderBy('assets.code').execute()) {
      result.push({ ...row, target_type: 'asset', quantity: 1 });
    }
  }
  if (filter.targetType !== 'asset' && (!holdingIds || holdingIds.length > 0)) {
    let query = database
      .selectFrom('equipment_holdings')
      .innerJoin('org_units', 'org_units.id', 'equipment_holdings.org_unit_id')
      .innerJoin('equipment_items', 'equipment_items.id', 'equipment_holdings.equipment_item_id')
      .leftJoin('classes', 'classes.id', 'equipment_holdings.class_id')
      .leftJoin('equipment_locations', 'equipment_locations.id', 'equipment_holdings.location_id')
      .select([
        'equipment_holdings.id',
        'equipment_holdings.org_unit_id',
        'org_units.name as org_unit_name',
        'equipment_items.code',
        'equipment_items.name',
        'equipment_items.unit',
        'equipment_holdings.quantity',
        'equipment_holdings.equipment_item_id',
        'equipment_items.code as equipment_item_code',
        'classes.name as class_name',
        'equipment_holdings.location_id',
        'equipment_locations.name as location_name',
        'equipment_holdings.qr_code',
        'equipment_items.status',
      ])
      .where('equipment_holdings.org_unit_id', 'in', filter.orgUnitIds);
    if (holdingIds) {
      query = query.where('equipment_holdings.id', 'in', holdingIds);
    } else if (!filter.qrCode) {
      // Lô đã về 0 và chưa có tem thì không còn gì để dán tem hay kiểm kê
      query = query.where((eb) =>
        eb.or([eb('equipment_holdings.quantity', '>', '0'), eb('equipment_holdings.qr_code', 'is not', null)]),
      );
    }
    if (filter.qrCode) {
      query = query.where('equipment_holdings.qr_code', '=', filter.qrCode);
    }
    if (filter.locationIds) {
      query = query.where('equipment_holdings.location_id', 'in', filter.locationIds);
    }
    if (filter.search) {
      const pattern = `%${filter.search}%`;
      query = query.where((eb) =>
        eb.or([eb('equipment_items.code', 'ilike', pattern), eb('equipment_items.name', 'ilike', pattern)]),
      );
    }
    for (const row of await query.orderBy('equipment_items.order_no').orderBy('equipment_items.code').execute()) {
      result.push({
        ...row,
        target_type: 'holding',
        quantity: Number(row.quantity),
        equipment_item_id: row.equipment_item_id,
      });
    }
  }
  return result;
}

// Nơi để và các vị trí con của nó (một cấp con: vị trí trong phòng hoặc kho)
export async function locationWithChildren(
  database: Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>,
  locationId: string,
): Promise<string[]> {
  const children = await database
    .selectFrom('equipment_locations')
    .select('id')
    .where('parent_id', '=', locationId)
    .execute();
  return [locationId, ...children.map((row) => row.id)];
}

// Cấp mã tem cho đối tượng chưa có; thử lại khi trùng (xác suất rất nhỏ)
export async function ensureQrCodes(transaction: Transaction<SchoolYearDatabase>, targets: EquipmentTarget[]) {
  for (const target of targets) {
    if (target.qr_code) {
      continue;
    }
    for (let attempt = 0; ; attempt += 1) {
      const code = generateQrCode();
      const taken =
        (await transaction.selectFrom('assets').select('id').where('qr_code', '=', code).executeTakeFirst()) ??
        (await transaction
          .selectFrom('equipment_holdings')
          .select('id')
          .where('qr_code', '=', code)
          .executeTakeFirst());
      if (taken && attempt < 5) {
        continue;
      }
      if (target.target_type === 'asset') {
        await transaction.updateTable('assets').set({ qr_code: code }).where('id', '=', target.id).execute();
      } else {
        await transaction
          .updateTable('equipment_holdings')
          .set({ qr_code: code })
          .where('id', '=', target.id)
          .execute();
      }
      target.qr_code = code;
      break;
    }
  }
}

// Tem khổ A4 dọc, 3 cột × 8 dòng (cỡ giấy tem dán phổ biến 70 × 37 mm); mỗi tem có mã QR, mã tem, tên, mã thiết bị, nơi để
export async function buildLabelPdf(targets: EquipmentTarget[], createdAt: Date): Promise<Buffer> {
  ensureFonts();
  const cells: PdfContent[] = targets.map((target) => ({
    columns: [
      { width: 62, qr: target.qr_code ?? '', fit: 62, margin: [0, 2, 0, 0] },
      {
        width: '*',
        stack: [
          { text: target.qr_code ?? '', bold: true, fontSize: 8 },
          { text: target.name, fontSize: 7, maxHeight: 24 },
          {
            text: [
              target.target_type === 'holding'
                ? `Lô ${target.equipment_item_code ?? target.code}: ${target.quantity} ${target.unit}`
                : `Mã: ${target.code}`,
            ].join(''),
            fontSize: 6,
          },
          {
            text: [target.location_name ?? target.class_name, target.org_unit_name].filter(Boolean).join(' – '),
            fontSize: 6,
          },
        ],
      },
    ],
    columnGap: 4,
    margin: [4, 4, 4, 4],
  }));
  const rows: PdfContent[][] = [];
  for (let index = 0; index < cells.length; index += 3) {
    const row = cells.slice(index, index + 3);
    while (row.length < 3) {
      row.push({ text: '' });
    }
    rows.push(row);
  }
  const definition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [14, 22, 14, 22],
    info: { title: 'Tem QR thiết bị', creator: 'School Management' },
    defaultStyle: { font: 'Roboto', fontSize: 7 },
    content: [
      {
        table: { widths: ['*', '*', '*'], heights: 101, dontBreakRows: true, body: rows },
        layout: {
          hLineWidth: () => 0.3,
          vLineWidth: () => 0.3,
          hLineColor: () => '#bbbbbb',
          vLineColor: () => '#bbbbbb',
        },
      },
    ],
    footer: (currentPage: number, pageCount: number) => ({
      text: `In lúc ${createdAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} – Trang ${currentPage}/${pageCount}`,
      fontSize: 6,
      alignment: 'right',
      margin: [14, 6, 14, 0],
    }),
  };
  return pdfmake.createPdf(definition as unknown as Parameters<typeof pdfmake.createPdf>[0]).getBuffer();
}

@Injectable()
export class EquipmentLocationsService {
  constructor(
    private readonly data: FacilitiesData,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser, orgUnitId: string | null) {
    const unitIds = await this.data.units(currentUser, [MANAGE, REPORT, STOCKTAKE], orgUnitId);
    const database = await this.data.database();
    const [rows, counts] = await Promise.all([
      database
        .selectFrom('equipment_locations')
        .innerJoin('org_units', 'org_units.id', 'equipment_locations.org_unit_id')
        .leftJoin('rooms', 'rooms.id', 'equipment_locations.room_id')
        .leftJoin('equipment_locations as parents', 'parents.id', 'equipment_locations.parent_id')
        .select([
          'equipment_locations.id',
          'equipment_locations.org_unit_id',
          'org_units.name as org_unit_name',
          'equipment_locations.code',
          'equipment_locations.name',
          'equipment_locations.location_type',
          'equipment_locations.room_id',
          'rooms.name as room_name',
          'equipment_locations.parent_id',
          'parents.name as parent_name',
          'equipment_locations.status',
          'equipment_locations.note',
        ])
        .where('equipment_locations.org_unit_id', 'in', unitIds)
        .orderBy('org_units.name')
        .orderBy('equipment_locations.code')
        .execute(),
      loadTargets(database, { orgUnitIds: unitIds }),
    ]);
    return rows.map((row) => ({
      ...row,
      target_count: counts.filter((target) => target.location_id === row.id).length,
    }));
  }

  private async checkReferences(
    database: Kysely<SchoolYearDatabase>,
    orgUnitId: string,
    input: LocationInput,
    locationId: string | null,
  ) {
    const errors: FieldError[] = [];
    if (input.room_id) {
      const room = await database
        .selectFrom('rooms')
        .select(['id', 'org_unit_id'])
        .where('id', '=', input.room_id)
        .executeTakeFirst();
      if (!room || room.org_unit_id !== orgUnitId) {
        errors.push({ field: 'room_id', message: 'Phòng không thuộc đơn vị đã chọn' });
      }
    }
    if (input.parent_id) {
      const parent = await database
        .selectFrom('equipment_locations')
        .select(['id', 'org_unit_id', 'parent_id'])
        .where('id', '=', input.parent_id)
        .executeTakeFirst();
      if (!parent || parent.org_unit_id !== orgUnitId) {
        errors.push({ field: 'parent_id', message: 'Nơi để cha không thuộc đơn vị đã chọn' });
      } else if (parent.id === locationId || parent.parent_id !== null) {
        // Chỉ hai cấp: phòng hoặc kho, rồi vị trí bên trong
        errors.push({ field: 'parent_id', message: 'Nơi để cha phải là phòng hoặc kho không nằm trong nơi khác' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
  }

  async create(currentUser: CurrentUser, orgUnitId: string, input: LocationInput, origin: ChangeOrigin) {
    await this.data.units(currentUser, [MANAGE], orgUnitId);
    const database = await this.data.database();
    await this.checkReferences(database, orgUnitId, input, null);
    return database.transaction().execute(async (transaction) => {
      const created = await conflictOnDuplicate(
        transaction
          .insertInto('equipment_locations')
          .values({
            org_unit_id: orgUnitId,
            code: input.code ?? '',
            name: input.name ?? '',
            location_type: input.location_type ?? 'room',
            room_id: input.room_id ?? null,
            parent_id: input.parent_id ?? null,
            note: input.note ?? null,
            created_by: origin.actorUserId,
          })
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Mã nơi để đã có trong đơn vị',
        'code',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'equipment_locations',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async update(currentUser: CurrentUser, locationId: string, input: LocationInput, origin: ChangeOrigin) {
    const database = await this.data.database();
    const existing = await database
      .selectFrom('equipment_locations')
      .selectAll()
      .where('id', '=', locationId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy nơi để', 'equipment_location');
    }
    await this.data.units(currentUser, [MANAGE], existing.org_unit_id);
    await this.checkReferences(database, existing.org_unit_id, input, locationId);
    if (input.parent_id) {
      const children = await database
        .selectFrom('equipment_locations')
        .select('id')
        .where('parent_id', '=', locationId)
        .executeTakeFirst();
      if (children) {
        throw validationError([
          { field: 'parent_id', message: 'Nơi để đang có vị trí con, không đặt vào nơi khác được' },
        ]);
      }
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await conflictOnDuplicate(
        transaction
          .updateTable('equipment_locations')
          .set({ ...input, updated_at: this.clock.now() })
          .where('id', '=', locationId)
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Mã nơi để đã có trong đơn vị',
        'code',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: existing.org_unit_id,
        entityName: 'equipment_locations',
        entityId: locationId,
        action: 'update',
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  async targets(
    currentUser: CurrentUser,
    filter: {
      orgUnitId: string | null;
      locationId: string | null;
      targetType: TargetType | null;
      search: string | null;
    },
  ) {
    const unitIds = await this.data.units(currentUser, [MANAGE, REPORT], filter.orgUnitId);
    const database = await this.data.database();
    return loadTargets(database, {
      orgUnitIds: unitIds,
      locationIds: filter.locationId ? await locationWithChildren(database, filter.locationId) : null,
      targetType: filter.targetType,
      search: filter.search,
    });
  }

  // Gán (hoặc bỏ) nơi để cho nhiều tài sản, lô của một đơn vị
  async place(
    currentUser: CurrentUser,
    orgUnitId: string,
    locationId: string | null,
    refs: TargetRef[],
    origin: ChangeOrigin,
  ) {
    await this.data.units(currentUser, [MANAGE], orgUnitId);
    const database = await this.data.database();
    if (locationId) {
      const location = await database
        .selectFrom('equipment_locations')
        .select(['org_unit_id', 'status'])
        .where('id', '=', locationId)
        .executeTakeFirst();
      if (!location || location.org_unit_id !== orgUnitId) {
        throw validationError([{ field: 'location_id', message: 'Nơi để không thuộc đơn vị đã chọn' }]);
      }
      if (location.status !== 'active') {
        throw validationError([{ field: 'location_id', message: 'Nơi để đã ngừng dùng' }]);
      }
    }
    const targets = await loadTargets(database, { orgUnitIds: [orgUnitId], refs });
    if (targets.length !== refs.length) {
      throw validationError([{ field: 'targets', message: 'Có thiết bị hoặc lô không thuộc đơn vị đã chọn' }]);
    }
    return database.transaction().execute(async (transaction) => {
      for (const target of targets) {
        if (target.target_type === 'asset') {
          await transaction
            .updateTable('assets')
            .set({ equipment_location_id: locationId, updated_at: this.clock.now() })
            .where('id', '=', target.id)
            .execute();
        } else {
          await transaction
            .updateTable('equipment_holdings')
            .set({ location_id: locationId, updated_at: this.clock.now() })
            .where('id', '=', target.id)
            .execute();
        }
        await writeAuditLog(transaction, {
          origin,
          orgUnitId,
          entityName: target.target_type === 'asset' ? 'assets' : 'equipment_holdings',
          entityId: target.id,
          action: 'update',
          before: { location_id: target.location_id },
          after: { location_id: locationId },
        });
      }
      return { saved: targets.length };
    });
  }

  // In tem: cấp mã cho đối tượng chưa có rồi dựng tệp PDF; ghi nhật ký xuất (không có dữ liệu cá nhân)
  async labels(currentUser: CurrentUser, orgUnitId: string, refs: TargetRef[], ipAddress: string | null) {
    await this.data.units(currentUser, [MANAGE], orgUnitId);
    const database = await this.data.database();
    const createdAt = this.clock.now();
    const targets = await database.transaction().execute(async (transaction) => {
      const loaded = await loadTargets(transaction, { orgUnitIds: [orgUnitId], refs });
      if (loaded.length !== refs.length) {
        throw validationError([{ field: 'targets', message: 'Có thiết bị hoặc lô không thuộc đơn vị đã chọn' }]);
      }
      await ensureQrCodes(transaction, loaded);
      return loaded;
    });
    const order = new Map(refs.map((ref, index) => [`${ref.target_type}:${ref.id}`, index]));
    targets.sort(
      (left, right) =>
        (order.get(`${left.target_type}:${left.id}`) ?? 0) - (order.get(`${right.target_type}:${right.id}`) ?? 0),
    );
    const buffer = await buildLabelPdf(targets, createdAt);
    const fileName = `tem-qr-thiet-bi-${fileStamp(createdAt)}.pdf`;
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: 'equipment-labels',
        filters_data: JSON.stringify({ org_unit_id: orgUnitId, count: targets.length }),
        org_unit_ids: [orgUnitId],
        row_count: targets.length,
        contains_personal_data: false,
        file_name: fileName,
        ip_address: ipAddress,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { buffer, fileName, logId: log.id, contentType: 'application/pdf', rowCount: targets.length };
  }

  // Tra mã tem đã quét (nhận cả đường dẫn có mã); trả thiết bị hoặc lô trong phạm vi của người quét
  async lookup(currentUser: CurrentUser, scanned: string) {
    const code = equipmentQrCodeOf(scanned);
    if (!code) {
      throw validationError([{ field: 'qr_code', message: 'Mã QR không phải tem thiết bị' }]);
    }
    const unitIds = await this.data.units(currentUser, [MANAGE, REPORT, STOCKTAKE], null);
    const database = await this.data.database();
    const [target] = await loadTargets(database, { orgUnitIds: unitIds, qrCode: code });
    if (!target) {
      throw notFoundError('Không tìm thấy thiết bị có mã tem này trong phạm vi của bạn', 'equipment_qr');
    }
    return target;
  }
}

function readTargetType(value: string | undefined, errors: FieldError[]): TargetType | null {
  if (value === undefined || value === '') {
    return null;
  }
  if (value !== 'asset' && value !== 'holding') {
    errors.push({ field: 'target_type', message: 'Giá trị là asset hoặc holding' });
    return null;
  }
  return value;
}

function readUuidQuery(value: string | undefined, field: string, errors: FieldError[]): string | null {
  if (value === undefined || value === '') {
    return null;
  }
  if (!isUuid(value)) {
    errors.push({ field, message: 'Mã không hợp lệ' });
    return null;
  }
  return value;
}

@Controller()
export class EquipmentLocationsController {
  constructor(private readonly locations: EquipmentLocationsService) {}

  @Get('equipment-locations')
  @RequirePermission(MANAGE, REPORT, STOCKTAKE)
  list(@Query('org_unit_id') orgUnitId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const unit = readUuidQuery(orgUnitId, 'org_unit_id', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.locations.list(currentUser, unit);
  }

  @Post('equipment-locations')
  @RequirePermission(MANAGE)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const input = readLocationInput(body, errors, true);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.locations.create(currentUser, orgUnitId, input, originOf(request, currentUser));
  }

  @Patch('equipment-locations/:id')
  @RequirePermission(MANAGE)
  update(
    @Param('id', uuidParameter('Mã nơi để không hợp lệ')) locationId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readLocationInput(body, errors, false);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.locations.update(currentUser, locationId, input, originOf(request, currentUser));
  }

  @Get('equipment-placements')
  @RequirePermission(MANAGE, REPORT)
  targets(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = {
      orgUnitId: readUuidQuery(query.org_unit_id, 'org_unit_id', errors),
      locationId: readUuidQuery(query.location_id, 'location_id', errors),
      targetType: readTargetType(query.target_type, errors),
      search: query.search?.trim() ? query.search.trim().slice(0, 100) : null,
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.locations.targets(currentUser, filter);
  }

  @Put('equipment-placements')
  @RequirePermission(MANAGE)
  place(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const locationId = readOptionalUuid(body, 'location_id', errors) ?? null;
    const targets = readTargets(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.locations.place(currentUser, orgUnitId, locationId, targets, originOf(request, currentUser));
  }

  @Post('equipment-labels')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  async labels(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const targets = readTargets(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    sendWorkbook(response, await this.locations.labels(currentUser, orgUnitId, targets, request.ip ?? null));
  }

  @Get('equipment-qr/:code')
  @RequirePermission(MANAGE, REPORT, STOCKTAKE)
  lookup(@Param('code') code: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.locations.lookup(currentUser, code);
  }
}
