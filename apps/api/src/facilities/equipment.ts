import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  DEVELOPMENT_AREAS,
  EQUIPMENT_AGE_GROUPS,
  EQUIPMENT_GROUPS,
  EQUIPMENT_NORM_BASES,
  EQUIPMENT_TARGET_USERS,
  PERMISSION_CODES,
  type CodeLabel,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import { sql } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readOptionalText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { buildEquipmentReport } from './equipment-report-calc.js';
import { FacilitiesData } from './facilities-data.js';
import { buildFacilitiesWorkbook, fileStamp, sendWorkbook } from './facilities-workbook.js';

// Thiết bị dạy học (khảo sát mục 4, dòng 2.1 và 2.2; DT-14 phần 14d, YCTD-102):
// - danh mục thiết bị dùng chung toàn trường: danh mục tối thiểu (định mức theo nhóm, lớp hoặc theo học sinh) và thiết bị
//   ngoài danh mục; chỉ người có quyền quản lý thiết bị ở phạm vi toàn trường sửa danh mục;
// - số lượng hiện có nhập tay theo đơn vị hoặc theo lớp, nhu cầu bổ sung năm sau nhập ở dòng của đơn vị;
// - tài sản (P13) gắn với một thiết bị được cộng vào số hiện có;
// - tổng hợp thiết bị dạy học: định mức, hiện có, thừa, thiếu, nhu cầu bổ sung, tỷ lệ đáp ứng; xuất Excel
const MANAGE = PERMISSION_CODES.equipmentManage;
const REPORT = PERMISSION_CODES.facilitiesReport;
const RULE = 'YCTD-102';
const MAX_QUANTITY = 100_000;

const ITEM_COLUMNS = [
  'id',
  'code',
  'name',
  'unit',
  'equipment_group',
  'development_area',
  'age_group',
  'quantity',
  'norm_basis',
  'target_users',
  'equipment_type',
  'is_minimum',
  'is_seeded',
  'order_no',
  'status',
  'note',
] as const;

export interface EquipmentItemInput {
  code?: string;
  name?: string;
  unit?: string;
  equipment_group?: string;
  development_area?: string | null;
  age_group?: string;
  quantity?: number;
  norm_basis?: string;
  target_users?: string;
  equipment_type?: string | null;
  is_minimum?: boolean;
  status?: 'active' | 'inactive';
  note?: string | null;
}

export interface EquipmentFilter {
  orgUnitId: string | null;
  classId: string | null;
  ageGroup: string | null;
  equipmentGroup: string | null;
  developmentArea: string | null;
  isMinimum: boolean | null;
}

export interface HoldingInput {
  equipment_item_id: string;
  class_id: string | null;
  quantity: number;
  next_year_need: number | null;
  note: string | null;
}

const labelOf = (values: ReadonlyArray<CodeLabel>, value: string | null) =>
  values.find((item) => item.value === value)?.label ?? value ?? '';

function formatItem<T extends { quantity: string }>(row: T): Omit<T, 'quantity'> & { quantity: number } {
  return { ...row, quantity: Number(row.quantity) };
}

function readCode(
  body: RequestBody,
  field: string,
  values: ReadonlyArray<CodeLabel>,
  errors: FieldError[],
  required: boolean,
  nullable = false,
): string | null | undefined {
  const raw = body?.[field];
  if (raw === undefined || raw === null || raw === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc chọn' });
    }
    return raw === undefined ? undefined : nullable ? null : undefined;
  }
  if (typeof raw !== 'string' || !values.some((item) => item.value === raw)) {
    errors.push({ field, message: `Giá trị là ${values.map((item) => item.value).join(', ')}` });
    return undefined;
  }
  return raw;
}

function readQuantity(value: unknown, field: string, errors: FieldError[], required: boolean): number | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_QUANTITY) {
    errors.push({ field, message: `Số lượng từ 0 đến ${MAX_QUANTITY}` });
    return undefined;
  }
  return Math.round(value * 100) / 100;
}

function readTextLimited(body: RequestBody, field: string, errors: FieldError[], max: number) {
  const value = readOptionalText(body, field, errors);
  if (typeof value === 'string' && value.length > max) {
    errors.push({ field, message: `Tối đa ${max} ký tự` });
    return undefined;
  }
  return value;
}

export function readItemInput(body: RequestBody, errors: FieldError[], creating: boolean): EquipmentItemInput {
  const input: EquipmentItemInput = {};
  const code = readTextLimited(body, 'code', errors, 30);
  if (code) {
    input.code = code;
  }
  const name = readTextLimited(body, 'name', errors, 300);
  if (name === null || (creating && !name)) {
    errors.push({ field: 'name', message: 'Bắt buộc nhập' });
  } else if (name) {
    input.name = name;
  }
  const unit = readTextLimited(body, 'unit', errors, 30);
  if (unit === null || (creating && !unit)) {
    errors.push({ field: 'unit', message: 'Bắt buộc nhập' });
  } else if (unit) {
    input.unit = unit;
  }
  const group = readCode(body, 'equipment_group', EQUIPMENT_GROUPS, errors, creating);
  if (group) {
    input.equipment_group = group;
  }
  const area = readCode(body, 'development_area', DEVELOPMENT_AREAS, errors, false, true);
  if (area !== undefined) {
    input.development_area = area;
  }
  const age = readCode(body, 'age_group', EQUIPMENT_AGE_GROUPS, errors, creating);
  if (age) {
    input.age_group = age;
  }
  const quantity = readQuantity(body?.quantity, 'quantity', errors, creating);
  if (quantity !== undefined) {
    input.quantity = quantity;
  }
  const basis = readCode(body, 'norm_basis', EQUIPMENT_NORM_BASES, errors, false);
  if (basis) {
    input.norm_basis = basis;
  }
  const target = readCode(body, 'target_users', EQUIPMENT_TARGET_USERS, errors, false);
  if (target) {
    input.target_users = target;
  }
  const type = readTextLimited(body, 'equipment_type', errors, 100);
  if (type !== undefined) {
    input.equipment_type = type;
  }
  const note = readTextLimited(body, 'note', errors, 500);
  if (note !== undefined) {
    input.note = note;
  }
  if (creating) {
    const minimum = body?.is_minimum;
    if (minimum !== undefined && typeof minimum !== 'boolean') {
      errors.push({ field: 'is_minimum', message: 'Phải là có hoặc không' });
    }
    input.is_minimum = minimum === true;
  } else {
    const status = body?.status;
    if (status !== undefined && status !== 'active' && status !== 'inactive') {
      errors.push({ field: 'status', message: 'Trạng thái phải là active hoặc inactive' });
    } else if (status) {
      input.status = status;
    }
  }
  return input;
}

export function readHoldingItems(body: RequestBody, errors: FieldError[]): HoldingInput[] {
  const raw = body?.items;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 500) {
    errors.push({ field: 'items', message: 'Danh sách từ 1 đến 500 dòng' });
    return [];
  }
  const seen = new Set<string>();
  return raw.map((entry, index) => {
    const item = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    const prefix = `items.${index}`;
    const equipmentItemId = isUuid(item.equipment_item_id) ? item.equipment_item_id : '';
    if (!equipmentItemId) {
      errors.push({ field: `${prefix}.equipment_item_id`, message: 'Mã thiết bị không hợp lệ' });
    }
    const classId =
      item.class_id === undefined || item.class_id === null || item.class_id === '' ? null : item.class_id;
    if (classId !== null && !isUuid(classId)) {
      errors.push({ field: `${prefix}.class_id`, message: 'Mã lớp không hợp lệ' });
    }
    const key = `${equipmentItemId}:${String(classId)}`;
    if (seen.has(key)) {
      errors.push({ field: `${prefix}.equipment_item_id`, message: 'Trùng thiết bị và lớp trong danh sách' });
    }
    seen.add(key);
    const quantity = readQuantity(item.quantity, `${prefix}.quantity`, errors, true) ?? 0;
    const need = readQuantity(item.next_year_need, `${prefix}.next_year_need`, errors, false) ?? null;
    if (need !== null && classId !== null) {
      errors.push({
        field: `${prefix}.next_year_need`,
        message: 'Nhu cầu bổ sung nhập ở dòng của đơn vị, không theo lớp',
      });
    }
    const note = typeof item.note === 'string' && item.note.trim() ? item.note.trim().slice(0, 500) : null;
    return {
      equipment_item_id: equipmentItemId,
      class_id: classId as string | null,
      quantity,
      next_year_need: need,
      note,
    };
  });
}

function readBooleanQuery(value: string | undefined, field: string, errors: FieldError[]): boolean | null {
  if (value === undefined || value === '') {
    return null;
  }
  if (value !== 'true' && value !== 'false') {
    errors.push({ field, message: 'Giá trị là true hoặc false' });
    return null;
  }
  return value === 'true';
}

function readCodeQuery(
  value: string | undefined,
  field: string,
  values: ReadonlyArray<CodeLabel>,
  errors: FieldError[],
): string | null {
  if (value === undefined || value === '') {
    return null;
  }
  if (!values.some((item) => item.value === value)) {
    errors.push({ field, message: `Giá trị là ${values.map((item) => item.value).join(', ')}` });
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

export function readEquipmentFilter(query: Record<string, string | undefined>): EquipmentFilter {
  const errors: FieldError[] = [];
  const filter: EquipmentFilter = {
    orgUnitId: readUuidQuery(query.org_unit_id, 'org_unit_id', errors),
    classId: readUuidQuery(query.class_id, 'class_id', errors),
    ageGroup: readCodeQuery(query.age_group, 'age_group', EQUIPMENT_AGE_GROUPS, errors),
    equipmentGroup: readCodeQuery(query.equipment_group, 'equipment_group', EQUIPMENT_GROUPS, errors),
    developmentArea: readCodeQuery(query.development_area, 'development_area', DEVELOPMENT_AREAS, errors),
    isMinimum: readBooleanQuery(query.is_minimum, 'is_minimum', errors),
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return filter;
}

@Injectable()
export class EquipmentService {
  constructor(
    private readonly data: FacilitiesData,
    private readonly clock: Clock,
  ) {}

  async listItems(currentUser: CurrentUser, filter: { ageGroup: string | null; isMinimum: boolean | null }) {
    await this.data.units(currentUser, [MANAGE, REPORT], null);
    const database = await this.data.database();
    let query = database.selectFrom('equipment_items').select(ITEM_COLUMNS).orderBy('order_no').orderBy('code');
    if (filter.ageGroup) {
      query = query.where('age_group', '=', filter.ageGroup);
    }
    if (filter.isMinimum !== null) {
      query = query.where('is_minimum', '=', filter.isMinimum);
    }
    return (await query.execute()).map(formatItem);
  }

  async createItem(currentUser: CurrentUser, input: EquipmentItemInput, origin: ChangeOrigin) {
    await this.data.assertWholeSchool(
      currentUser,
      [MANAGE],
      'Chỉ người quản lý thiết bị toàn trường sửa được danh mục thiết bị',
    );
    const database = await this.data.database();
    return database.transaction().execute(async (transaction) => {
      const last = await transaction
        .selectFrom('equipment_items')
        .select(sql<number>`coalesce(max(order_no), 0)`.as('order_no'))
        .executeTakeFirstOrThrow();
      const orderNo = Number(last.order_no) + 1;
      const code = input.code ?? `${input.is_minimum ? 'TT' : 'NDM'}-${String(orderNo).padStart(4, '0')}`;
      const created = await conflictOnDuplicate(
        transaction
          .insertInto('equipment_items')
          .values({
            code,
            name: input.name ?? '',
            unit: input.unit ?? '',
            equipment_group: input.equipment_group ?? '',
            development_area: input.development_area ?? null,
            age_group: input.age_group ?? '',
            quantity: input.quantity ?? 0,
            norm_basis: input.norm_basis ?? 'class',
            target_users: input.target_users ?? 'tre',
            equipment_type: input.equipment_type ?? null,
            is_minimum: input.is_minimum ?? false,
            note: input.note ?? null,
            order_no: orderNo,
            created_by: origin.actorUserId,
          })
          .returning(ITEM_COLUMNS)
          .executeTakeFirstOrThrow(),
        'Mã thiết bị đã có',
        'code',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'equipment_items',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return formatItem(created);
    });
  }

  async updateItem(currentUser: CurrentUser, itemId: string, input: EquipmentItemInput, origin: ChangeOrigin) {
    await this.data.assertWholeSchool(
      currentUser,
      [MANAGE],
      'Chỉ người quản lý thiết bị toàn trường sửa được danh mục thiết bị',
    );
    const database = await this.data.database();
    const existing = await database
      .selectFrom('equipment_items')
      .select(ITEM_COLUMNS)
      .where('id', '=', itemId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy thiết bị', 'equipment_item');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await conflictOnDuplicate(
        transaction
          .updateTable('equipment_items')
          .set({ ...input, updated_at: this.clock.now() })
          .where('id', '=', itemId)
          .returning(ITEM_COLUMNS)
          .executeTakeFirstOrThrow(),
        'Mã thiết bị đã có',
        'code',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'equipment_items',
        entityId: itemId,
        action: 'update',
        before: existing,
        after: updated,
      });
      return formatItem(updated);
    });
  }

  // Số lượng hiện có nhập tay của một đơn vị (dòng của đơn vị và của từng lớp)
  async listHoldings(currentUser: CurrentUser, orgUnitId: string) {
    await this.data.units(currentUser, [MANAGE, REPORT], orgUnitId);
    const database = await this.data.database();
    const rows = await database
      .selectFrom('equipment_holdings')
      .leftJoin('classes', 'classes.id', 'equipment_holdings.class_id')
      .select([
        'equipment_holdings.id',
        'equipment_holdings.equipment_item_id',
        'equipment_holdings.class_id',
        'classes.name as class_name',
        'equipment_holdings.quantity',
        'equipment_holdings.next_year_need',
        'equipment_holdings.note',
        'equipment_holdings.updated_at',
      ])
      .where('equipment_holdings.org_unit_id', '=', orgUnitId)
      .execute();
    return rows.map((row) => ({
      ...row,
      quantity: Number(row.quantity),
      next_year_need: row.next_year_need === null ? null : Number(row.next_year_need),
    }));
  }

  // Ghi số lượng hiện có theo đơn vị hoặc lớp; ghi lại thì thay số cũ
  async saveHoldings(currentUser: CurrentUser, orgUnitId: string, items: HoldingInput[], origin: ChangeOrigin) {
    await this.data.units(currentUser, [MANAGE], orgUnitId);
    const database = await this.data.database();
    const unit = await database.selectFrom('org_units').select('status').where('id', '=', orgUnitId).executeTakeFirst();
    if (!unit) {
      throw notFoundError('Không tìm thấy đơn vị', 'org_unit');
    }
    if (unit.status !== 'active') {
      throw ruleViolationError('BR-75', 'Đơn vị đã ngừng sử dụng');
    }
    const itemIds = [...new Set(items.map((item) => item.equipment_item_id))];
    const known = await database
      .selectFrom('equipment_items')
      .select(['id', 'status'])
      .where('id', 'in', itemIds)
      .execute();
    const errors: FieldError[] = [];
    items.forEach((item, index) => {
      const found = known.find((row) => row.id === item.equipment_item_id);
      if (!found) {
        errors.push({ field: `items.${index}.equipment_item_id`, message: 'Không có thiết bị này' });
      }
    });
    const classIds = [...new Set(items.map((item) => item.class_id).filter((id): id is string => id !== null))];
    const classes = classIds.length
      ? await database
          .selectFrom('classes')
          .select(['id', 'org_unit_id', 'status'])
          .where('id', 'in', classIds)
          .execute()
      : [];
    items.forEach((item, index) => {
      if (item.class_id && !classes.some((row) => row.id === item.class_id && row.org_unit_id === orgUnitId)) {
        errors.push({ field: `items.${index}.class_id`, message: 'Lớp không thuộc đơn vị đã chọn' });
      }
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    if (items.some((item) => known.find((row) => row.id === item.equipment_item_id)?.status === 'inactive')) {
      throw ruleViolationError(RULE, 'Thiết bị đã ngừng dùng, không ghi số lượng được');
    }
    return database.transaction().execute(async (transaction) => {
      let saved = 0;
      for (const item of items) {
        const existing = await transaction
          .selectFrom('equipment_holdings')
          .selectAll()
          .where('equipment_item_id', '=', item.equipment_item_id)
          .where('org_unit_id', '=', orgUnitId)
          .where((eb) => (item.class_id === null ? eb('class_id', 'is', null) : eb('class_id', '=', item.class_id)))
          .executeTakeFirst();
        const values = {
          quantity: item.quantity,
          next_year_need: item.next_year_need,
          note: item.note,
          updated_by: origin.actorUserId,
        };
        const after = existing
          ? await transaction
              .updateTable('equipment_holdings')
              .set({ ...values, updated_at: this.clock.now() })
              .where('id', '=', existing.id)
              .returningAll()
              .executeTakeFirstOrThrow()
          : await transaction
              .insertInto('equipment_holdings')
              .values({
                ...values,
                equipment_item_id: item.equipment_item_id,
                org_unit_id: orgUnitId,
                class_id: item.class_id,
              })
              .returningAll()
              .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId,
          entityName: 'equipment_holdings',
          entityId: after.id,
          action: existing ? 'update' : 'create',
          before: existing ?? null,
          after,
        });
        saved += 1;
      }
      return { saved };
    });
  }

  // Gắn hoặc bỏ gắn tài sản với một thiết bị trong danh mục; tài sản gắn được cộng vào số hiện có
  async linkAsset(currentUser: CurrentUser, assetId: string, itemId: string | null, origin: ChangeOrigin) {
    const database = await this.data.database();
    const asset = await database
      .selectFrom('assets')
      .select(['id', 'org_unit_id', 'equipment_item_id', 'status'])
      .where('id', '=', assetId)
      .executeTakeFirst();
    if (!asset) {
      throw notFoundError('Không tìm thấy tài sản', 'asset');
    }
    await this.data.units(currentUser, [MANAGE], asset.org_unit_id);
    if (itemId) {
      const item = await database
        .selectFrom('equipment_items')
        .select(['id', 'status'])
        .where('id', '=', itemId)
        .executeTakeFirst();
      if (!item) {
        throw validationError([{ field: 'equipment_item_id', message: 'Không có thiết bị này' }]);
      }
      if (item.status === 'inactive') {
        throw ruleViolationError(RULE, 'Thiết bị đã ngừng dùng, không gắn tài sản được');
      }
    }
    if (asset.status === 'disposed') {
      throw ruleViolationError(RULE, 'Tài sản đã thanh lý, không gắn với thiết bị được');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('assets')
        .set({ equipment_item_id: itemId, updated_at: this.clock.now() })
        .where('id', '=', assetId)
        .returning(['id', 'org_unit_id', 'equipment_item_id'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: asset.org_unit_id,
        entityName: 'assets',
        entityId: assetId,
        action: 'update',
        before: { equipment_item_id: asset.equipment_item_id },
        after: { equipment_item_id: itemId },
      });
      return updated;
    });
  }

  async report(currentUser: CurrentUser, filter: EquipmentFilter) {
    const unitIds = await this.data.units(currentUser, [REPORT, MANAGE], filter.orgUnitId);
    const database = await this.data.database();
    const [allClasses, allItems, holdings, assets] = await Promise.all([
      this.data.classes(database, unitIds),
      this.data.items(database),
      this.data.holdings(database, unitIds),
      this.data.assets(database, unitIds),
    ]);
    if (filter.classId && !allClasses.some((row) => row.id === filter.classId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Lớp này nằm ngoài phạm vi của bạn');
    }
    const items = allItems.filter(
      (item) =>
        (!filter.ageGroup || item.age_group === filter.ageGroup) &&
        (!filter.equipmentGroup || item.equipment_group === filter.equipmentGroup) &&
        (!filter.developmentArea || item.development_area === filter.developmentArea) &&
        (filter.isMinimum === null || item.is_minimum === filter.isMinimum),
    );
    const classes = filter.ageGroup ? allClasses.filter((row) => row.age_group === filter.ageGroup) : allClasses;
    return {
      org_unit_ids: unitIds,
      // Lớp chưa xếp được nhóm tuổi (khối không có trong danh mục bậc học) không tính định mức
      unclassified_classes: allClasses.filter((row) => row.age_group === null).map((row) => row.name),
      ...buildEquipmentReport({ items, classes, holdings, assets, classId: filter.classId }),
    };
  }

  async export(currentUser: CurrentUser, filter: EquipmentFilter, ipAddress: string | null) {
    const report = await this.report(currentUser, filter);
    const database = await this.data.database();
    const createdAt = this.clock.now();
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: 'equipment-summary',
      fileName: `tong-hop-thiet-bi-day-hoc-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter },
      orgUnitIds: report.org_unit_ids,
      ipAddress,
      createdAt,
      sheets: [
        {
          title: 'Tổng hợp thiết bị',
          heading: [
            '2.1 Tổng hợp thiết bị dạy học',
            `Tỷ lệ đáp ứng chung: ${report.totals.rate_percent ?? 0}% (${report.totals.met_count}/${report.totals.item_count} thiết bị đủ định mức)`,
            'Danh mục tối thiểu cần đối chiếu văn bản hiện hành',
          ],
          columns: [
            { key: 'code', label: 'Mã', width: 12 },
            { key: 'name', label: 'Tên thiết bị', width: 40 },
            { key: 'unit', label: 'Đơn vị tính', width: 10 },
            { key: 'age_group', label: 'Nhóm tuổi', width: 20 },
            { key: 'equipment_group', label: 'Nhóm thiết bị', width: 24 },
            { key: 'kind', label: 'Danh mục', width: 14 },
            { key: 'norm', label: 'Định mức tối thiểu' },
            { key: 'available', label: 'Hiện có' },
            { key: 'next_year_need', label: 'Nhu cầu bổ sung năm sau' },
            { key: 'surplus', label: 'Thừa' },
            { key: 'shortage', label: 'Thiếu' },
            { key: 'rate_percent', label: 'Tỷ lệ đáp ứng (%)' },
          ],
          rows: report.rows.map((row) => ({
            ...row,
            age_group: labelOf(EQUIPMENT_AGE_GROUPS, row.age_group),
            equipment_group: labelOf(EQUIPMENT_GROUPS, row.equipment_group),
            kind: row.is_minimum ? 'Tối thiểu' : 'Ngoài danh mục',
          })),
        },
        {
          title: 'Theo lớp',
          columns: [
            { key: 'class_name', label: 'Lớp', width: 24 },
            { key: 'age_group', label: 'Nhóm tuổi', width: 20 },
            { key: 'child_count', label: 'Sĩ số' },
            { key: 'norm', label: 'Định mức' },
            { key: 'covered', label: 'Đáp ứng' },
            { key: 'rate_percent', label: 'Tỷ lệ đáp ứng (%)' },
          ],
          rows: report.classes.map((row) => ({ ...row, age_group: labelOf(EQUIPMENT_AGE_GROUPS, row.age_group) })),
        },
      ],
    });
  }
}

@Controller()
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @Get('equipment-items')
  @RequirePermission(MANAGE, REPORT)
  listItems(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = {
      ageGroup: readCodeQuery(query.age_group, 'age_group', EQUIPMENT_AGE_GROUPS, errors),
      isMinimum: readBooleanQuery(query.is_minimum, 'is_minimum', errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.equipment.listItems(currentUser, filter);
  }

  @Post('equipment-items')
  @RequirePermission(MANAGE)
  createItem(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = readItemInput(body, errors, true);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.equipment.createItem(currentUser, input, originOf(request, currentUser));
  }

  @Patch('equipment-items/:id')
  @RequirePermission(MANAGE)
  updateItem(
    @Param('id', uuidParameter('Mã thiết bị không hợp lệ')) itemId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readItemInput(body, errors, false);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.equipment.updateItem(currentUser, itemId, input, originOf(request, currentUser));
  }

  @Get('equipment-holdings')
  @RequirePermission(MANAGE, REPORT)
  listHoldings(@Query('org_unit_id') orgUnitId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' }]);
    }
    return this.equipment.listHoldings(currentUser, orgUnitId);
  }

  @Put('equipment-holdings')
  @RequirePermission(MANAGE)
  saveHoldings(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const items = readHoldingItems(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.equipment.saveHoldings(currentUser, orgUnitId, items, originOf(request, currentUser));
  }

  @Post('equipment-assets')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  linkAsset(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const assetId = readRequiredUuid(body, 'asset_id', errors, 'Bắt buộc chọn tài sản');
    const itemId = body?.equipment_item_id ?? null;
    if (itemId !== null && !isUuid(itemId)) {
      errors.push({ field: 'equipment_item_id', message: 'Mã thiết bị không hợp lệ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.equipment.linkAsset(currentUser, assetId, itemId as string | null, originOf(request, currentUser));
  }

  @Get('equipment-report')
  @RequirePermission(REPORT, MANAGE)
  report(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.equipment.report(currentUser, readEquipmentFilter(query));
  }

  @Post('equipment-report/export')
  @HttpCode(200)
  @RequirePermission(REPORT, MANAGE)
  async export(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const query = Object.fromEntries(
      Object.entries(body ?? {})
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    );
    const file = await this.equipment.export(currentUser, readEquipmentFilter(query), request.ip ?? null);
    sendWorkbook(response, file);
  }
}
