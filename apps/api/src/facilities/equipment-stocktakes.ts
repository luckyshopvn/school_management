import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  EQUIPMENT_CONDITIONS,
  EQUIPMENT_STOCKTAKE_STATUSES,
  PERMISSION_CODES,
  equipmentQrCodeOf,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely, Transaction } from 'kysely';
import type { PdfContent } from 'pdfmake';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import {
  isUuid,
  notFoundError,
  readOptionalText,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { buildPdf, buildTableFile, CONTENT_TYPES, type TableFileSheet } from '../exports/table-file.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { EQUIPMENT_RULE, loadTargets, locationWithChildren, type EquipmentTarget } from './equipment-locations.js';
import {
  isCondition,
  lineStatus,
  normalizeScan,
  summarizeStocktake,
  type Condition,
  type ScanInput,
} from './equipment-stocktake-calc.js';
import { FacilitiesData } from './facilities-data.js';
import { fileStamp, sendWorkbook } from './facilities-workbook.js';

// Kiểm kê thiết bị bằng điện thoại (DT-18 phần 18g, YCTD-143):
// - lập đợt kiểm kê của một đơn vị (cả đơn vị hoặc một nơi để kèm vị trí con): chụp sổ lúc lập đợt thành từng dòng (tài
//   sản chưa thanh lý, chưa mất; lô có số hiện có), số theo sổ không đổi khi sổ đổi sau đó; mỗi đơn vị một đợt chưa chốt;
// - quét mã tem trên ứng dụng giáo viên hoặc web di động, ghi tình trạng, số đếm được, số dùng được, nơi thấy; quét thiết bị
//   của đơn vị nhưng ngoài sổ của đợt thì thêm dòng "ngoài sổ" với số theo sổ 0; quét lại thì ghi đè;
// - nộp khi mọi dòng trong sổ đã kiểm; duyệt hoặc trả lại; chốt chênh lệch: lô lấy số dùng được làm số hiện có mới, thiết
//   bị thấy ở nơi khác thì đổi nơi để, tài sản hỏng hoặc không tìm thấy thì lập ghi nhận hỏng, mất chờ duyệt ở Kho và tài sản
//   (BR-61) để giữ đúng luồng duyệt của kho;
// - biên bản kiểm kê (PDF hoặc Excel): thông tin đợt, tổng hợp, tỷ lệ sử dụng được, bảng đối chiếu từng dòng, chỗ kí
const MANAGE = PERMISSION_CODES.equipmentManage;
const STOCKTAKE = PERMISSION_CODES.equipmentStocktake;

type Database = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const labelOf = (values: ReadonlyArray<{ value: string; label: string }>, value: string | null) =>
  values.find((item) => item.value === value)?.label ?? value ?? '';

const LINE_STATUS_LABELS = { unchecked: 'Chưa kiểm', matched: 'Khớp', shortage: 'Thiếu', surplus: 'Thừa' } as const;

export interface StocktakeInput {
  org_unit_id: string;
  name: string;
  started_on: string;
  location_id: string | null;
  members: string | null;
  note: string | null;
}

export function readStocktakeInput(body: RequestBody, errors: FieldError[]): StocktakeInput {
  const name = readRequiredText(body, 'name', errors);
  if (name.length > 200) {
    errors.push({ field: 'name', message: 'Tối đa 200 ký tự' });
  }
  const startedOn = body?.started_on;
  if (typeof startedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startedOn) || Number.isNaN(Date.parse(startedOn))) {
    errors.push({ field: 'started_on', message: 'Ngày kiểm kê dạng YYYY-MM-DD' });
  }
  const members = readOptionalText(body, 'members', errors) ?? null;
  if (members && members.length > 1000) {
    errors.push({ field: 'members', message: 'Tối đa 1000 ký tự' });
  }
  const note = readOptionalText(body, 'note', errors) ?? null;
  if (note && note.length > 1000) {
    errors.push({ field: 'note', message: 'Tối đa 1000 ký tự' });
  }
  return {
    org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
    name,
    started_on: typeof startedOn === 'string' ? startedOn : '',
    location_id: readOptionalUuid(body, 'location_id', errors) ?? null,
    members,
    note,
  };
}

export interface ScanRequest extends ScanInput {
  qr_code: string | null;
  line_id: string | null;
  found_location_id: string | null;
  note: string | null;
}

function readNumber(value: unknown, field: string, errors: FieldError[]): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push({ field, message: 'Phải là số' });
    return null;
  }
  return value;
}

export function readScanRequest(body: RequestBody, errors: FieldError[]): ScanRequest {
  const qr = body?.qr_code;
  const qrCode = typeof qr === 'string' && qr.trim() ? equipmentQrCodeOf(qr) : null;
  if (typeof qr === 'string' && qr.trim() && !qrCode) {
    errors.push({ field: 'qr_code', message: 'Mã QR không phải tem thiết bị' });
  }
  const lineId = readOptionalUuid(body, 'line_id', errors) ?? null;
  if (!qrCode && !lineId && !errors.some((error) => error.field === 'qr_code')) {
    errors.push({ field: 'qr_code', message: 'Bắt buộc quét mã tem hoặc chọn dòng' });
  }
  const condition = body?.condition;
  if (condition !== undefined && condition !== null && !isCondition(condition)) {
    errors.push({ field: 'condition', message: 'Tình trạng là good, damaged, unusable hoặc missing' });
  }
  const note = readOptionalText(body, 'note', errors) ?? null;
  if (note && note.length > 500) {
    errors.push({ field: 'note', message: 'Tối đa 500 ký tự' });
  }
  return {
    qr_code: qrCode,
    line_id: lineId,
    condition: isCondition(condition) ? condition : null,
    counted_quantity: readNumber(body?.counted_quantity, 'counted_quantity', errors),
    usable_quantity: readNumber(body?.usable_quantity, 'usable_quantity', errors),
    found_location_id: readOptionalUuid(body, 'found_location_id', errors) ?? null,
    note,
  };
}

function formatLine<
  T extends {
    expected_quantity: string;
    counted_quantity: string | null;
    usable_quantity: string | null;
    condition: Condition | null;
    in_scope: boolean;
  },
>(row: T) {
  const line = {
    ...row,
    expected_quantity: Number(row.expected_quantity),
    counted_quantity: row.counted_quantity === null ? null : Number(row.counted_quantity),
    usable_quantity: row.usable_quantity === null ? null : Number(row.usable_quantity),
  };
  return { ...line, ...lineStatus(line) };
}

@Injectable()
export class EquipmentStocktakesService {
  constructor(
    private readonly data: FacilitiesData,
    private readonly clock: Clock,
  ) {}

  private async load(database: Database, stocktakeId: string) {
    const stocktake = await database
      .selectFrom('equipment_stocktakes')
      .selectAll()
      .where('id', '=', stocktakeId)
      .executeTakeFirst();
    if (!stocktake) {
      throw notFoundError('Không tìm thấy đợt kiểm kê', 'equipment_stocktake');
    }
    return stocktake;
  }

  private assertStatus(status: string, allowed: string[], action: string) {
    if (!allowed.includes(status)) {
      throw ruleViolationError(
        EQUIPMENT_RULE,
        `Đợt kiểm kê đang ở trạng thái "${labelOf(EQUIPMENT_STOCKTAKE_STATUSES, status)}", không ${action} được`,
      );
    }
  }

  private async lines(database: Database, stocktakeId: string) {
    const rows = await database
      .selectFrom('equipment_stocktake_lines')
      .leftJoin('equipment_locations as places', 'places.id', 'equipment_stocktake_lines.location_id')
      .leftJoin('equipment_locations as found', 'found.id', 'equipment_stocktake_lines.found_location_id')
      .leftJoin('assets', 'assets.id', 'equipment_stocktake_lines.asset_id')
      .leftJoin('equipment_holdings', 'equipment_holdings.id', 'equipment_stocktake_lines.holding_id')
      .select([
        'equipment_stocktake_lines.id',
        'equipment_stocktake_lines.target_type',
        'equipment_stocktake_lines.asset_id',
        'equipment_stocktake_lines.holding_id',
        'equipment_stocktake_lines.equipment_item_id',
        'equipment_stocktake_lines.code',
        'equipment_stocktake_lines.name',
        'equipment_stocktake_lines.unit',
        'equipment_stocktake_lines.location_id',
        'places.name as location_name',
        'equipment_stocktake_lines.in_scope',
        'equipment_stocktake_lines.expected_quantity',
        'equipment_stocktake_lines.counted_quantity',
        'equipment_stocktake_lines.usable_quantity',
        'equipment_stocktake_lines.condition',
        'equipment_stocktake_lines.found_location_id',
        'found.name as found_location_name',
        'equipment_stocktake_lines.note',
        'equipment_stocktake_lines.counted_at',
        'equipment_stocktake_lines.damage_id',
        (eb) => eb.fn.coalesce('assets.qr_code', 'equipment_holdings.qr_code').as('qr_code'),
      ])
      .where('equipment_stocktake_lines.stocktake_id', '=', stocktakeId)
      .orderBy('equipment_stocktake_lines.in_scope', 'desc')
      .orderBy('equipment_stocktake_lines.code')
      .execute();
    return rows.map(formatLine);
  }

  async list(currentUser: CurrentUser, filter: { orgUnitId: string | null; status: string | null }) {
    const unitIds = await this.data.units(currentUser, [MANAGE, STOCKTAKE], filter.orgUnitId);
    const database = await this.data.database();
    let query = database
      .selectFrom('equipment_stocktakes')
      .innerJoin('org_units', 'org_units.id', 'equipment_stocktakes.org_unit_id')
      .leftJoin('equipment_locations', 'equipment_locations.id', 'equipment_stocktakes.location_id')
      .select((eb) => [
        'equipment_stocktakes.id',
        'equipment_stocktakes.code',
        'equipment_stocktakes.name',
        'equipment_stocktakes.org_unit_id',
        'org_units.name as org_unit_name',
        'equipment_stocktakes.location_id',
        'equipment_locations.name as location_name',
        'equipment_stocktakes.started_on',
        'equipment_stocktakes.status',
        'equipment_stocktakes.created_at',
        eb
          .selectFrom('equipment_stocktake_lines')
          .select((inner) => inner.fn.countAll<string>().as('count'))
          .whereRef('equipment_stocktake_lines.stocktake_id', '=', 'equipment_stocktakes.id')
          .as('line_count'),
        eb
          .selectFrom('equipment_stocktake_lines')
          .select((inner) => inner.fn.countAll<string>().as('count'))
          .whereRef('equipment_stocktake_lines.stocktake_id', '=', 'equipment_stocktakes.id')
          .where('equipment_stocktake_lines.counted_quantity', 'is not', null)
          .as('counted_count'),
      ])
      .where('equipment_stocktakes.org_unit_id', 'in', unitIds);
    if (filter.status) {
      query = query.where('equipment_stocktakes.status', '=', filter.status as 'counting');
    }
    const rows = await query.orderBy('equipment_stocktakes.created_at', 'desc').execute();
    return rows.map((row) => ({
      ...row,
      line_count: Number(row.line_count ?? 0),
      counted_count: Number(row.counted_count ?? 0),
    }));
  }

  async detail(currentUser: CurrentUser, stocktakeId: string) {
    const database = await this.data.database();
    const stocktake = await this.load(database, stocktakeId);
    await this.data.units(currentUser, [MANAGE, STOCKTAKE], stocktake.org_unit_id);
    const [unit, location, lines] = await Promise.all([
      database.selectFrom('org_units').select('name').where('id', '=', stocktake.org_unit_id).executeTakeFirst(),
      stocktake.location_id
        ? database
            .selectFrom('equipment_locations')
            .select('name')
            .where('id', '=', stocktake.location_id)
            .executeTakeFirst()
        : undefined,
      this.lines(database, stocktakeId),
    ]);
    return {
      ...stocktake,
      org_unit_name: unit?.name ?? '',
      location_name: location?.name ?? null,
      lines,
      summary: summarizeStocktake(lines),
    };
  }

  async create(currentUser: CurrentUser, input: StocktakeInput, origin: ChangeOrigin) {
    await this.data.units(currentUser, [MANAGE], input.org_unit_id);
    const database = await this.data.database();
    let locationIds: string[] | null = null;
    if (input.location_id) {
      const location = await database
        .selectFrom('equipment_locations')
        .select('org_unit_id')
        .where('id', '=', input.location_id)
        .executeTakeFirst();
      if (!location || location.org_unit_id !== input.org_unit_id) {
        throw validationError([{ field: 'location_id', message: 'Nơi để không thuộc đơn vị đã chọn' }]);
      }
      locationIds = await locationWithChildren(database, input.location_id);
    }
    const open = await database
      .selectFrom('equipment_stocktakes')
      .select('code')
      .where('org_unit_id', '=', input.org_unit_id)
      .where('status', 'in', ['counting', 'submitted', 'approved'])
      .executeTakeFirst();
    if (open) {
      throw ruleViolationError(EQUIPMENT_RULE, `Đơn vị đang có đợt kiểm kê ${open.code} chưa chốt`);
    }
    return database.transaction().execute(async (transaction) => {
      const targets = (await loadTargets(transaction, { orgUnitIds: [input.org_unit_id], locationIds })).filter(
        (target) => target.target_type === 'holding' || target.status !== 'lost',
      );
      const created = await transaction
        .insertInto('equipment_stocktakes')
        .values({
          code: await nextDocumentCode(transaction, 'equipment_stocktake', 'KKTB'),
          name: input.name,
          org_unit_id: input.org_unit_id,
          location_id: input.location_id,
          started_on: input.started_on,
          members: input.members,
          note: input.note,
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      for (const target of targets) {
        await transaction
          .insertInto('equipment_stocktake_lines')
          .values(this.lineValues(created.id, target, true))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'equipment_stocktakes',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { ...created, line_count: targets.length },
      });
      return { ...created, line_count: targets.length };
    });
  }

  private lineValues(stocktakeId: string, target: EquipmentTarget, inScope: boolean) {
    return {
      stocktake_id: stocktakeId,
      target_type: target.target_type,
      asset_id: target.target_type === 'asset' ? target.id : null,
      holding_id: target.target_type === 'holding' ? target.id : null,
      equipment_item_id: target.equipment_item_id,
      code: target.code,
      name:
        target.class_name && target.target_type === 'holding' ? `${target.name} (${target.class_name})` : target.name,
      unit: target.unit,
      location_id: target.location_id,
      in_scope: inScope,
      expected_quantity: inScope ? target.quantity : 0,
    };
  }

  // Ghi kết quả quét: theo mã tem (điện thoại) hoặc theo dòng (màn hình danh sách)
  async scan(currentUser: CurrentUser, stocktakeId: string, request: ScanRequest, origin: ChangeOrigin) {
    const database = await this.data.database();
    const stocktake = await this.load(database, stocktakeId);
    await this.data.units(currentUser, [MANAGE, STOCKTAKE], stocktake.org_unit_id);
    this.assertStatus(stocktake.status, ['counting'], 'ghi kết quả');
    if (request.found_location_id) {
      const found = await database
        .selectFrom('equipment_locations')
        .select('org_unit_id')
        .where('id', '=', request.found_location_id)
        .executeTakeFirst();
      if (!found || found.org_unit_id !== stocktake.org_unit_id) {
        throw validationError([{ field: 'found_location_id', message: 'Nơi thấy không thuộc đơn vị kiểm kê' }]);
      }
    }
    return database.transaction().execute(async (transaction) => {
      let line = request.line_id
        ? await transaction
            .selectFrom('equipment_stocktake_lines')
            .selectAll()
            .where('id', '=', request.line_id)
            .where('stocktake_id', '=', stocktakeId)
            .executeTakeFirst()
        : undefined;
      if (request.line_id && !line) {
        throw notFoundError('Không tìm thấy dòng kiểm kê', 'equipment_stocktake_line');
      }
      if (!line && request.qr_code) {
        const [target] = await loadTargets(transaction, {
          orgUnitIds: [stocktake.org_unit_id],
          qrCode: request.qr_code,
        });
        if (!target) {
          const elsewhere =
            (await transaction
              .selectFrom('assets')
              .select('id')
              .where('qr_code', '=', request.qr_code)
              .executeTakeFirst()) ??
            (await transaction
              .selectFrom('equipment_holdings')
              .select('id')
              .where('qr_code', '=', request.qr_code)
              .executeTakeFirst());
          if (elsewhere) {
            throw ruleViolationError(EQUIPMENT_RULE, 'Thiết bị này thuộc đơn vị khác hoặc đã thanh lý');
          }
          throw notFoundError('Không tìm thấy thiết bị có mã tem này', 'equipment_qr');
        }
        line =
          (await transaction
            .selectFrom('equipment_stocktake_lines')
            .selectAll()
            .where('stocktake_id', '=', stocktakeId)
            .where(target.target_type === 'asset' ? 'asset_id' : 'holding_id', '=', target.id)
            .executeTakeFirst()) ??
          // Thiết bị của đơn vị nhưng ngoài sổ của đợt (nơi để khác, mới nhập sau khi lập đợt): thêm dòng ngoài sổ
          (await transaction
            .insertInto('equipment_stocktake_lines')
            .values(this.lineValues(stocktakeId, target, false))
            .returningAll()
            .executeTakeFirstOrThrow());
      }
      if (!line) {
        throw notFoundError('Không tìm thấy dòng kiểm kê', 'equipment_stocktake_line');
      }
      const errors: FieldError[] = [];
      const result = normalizeScan(line.target_type, request, errors);
      if (!result) {
        throw validationError(errors);
      }
      const updated = await transaction
        .updateTable('equipment_stocktake_lines')
        .set({
          ...result,
          found_location_id: request.found_location_id,
          note: request.note,
          counted_by: origin.actorUserId,
          counted_at: this.clock.now(),
        })
        .where('id', '=', line.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: stocktake.org_unit_id,
        entityName: 'equipment_stocktake_lines',
        entityId: line.id,
        action: 'update',
        before: line,
        after: updated,
      });
      return formatLine(updated);
    });
  }

  private async transition(
    currentUser: CurrentUser,
    stocktakeId: string,
    from: string[],
    to: 'counting' | 'submitted' | 'approved' | 'cancelled',
    action: string,
    origin: ChangeOrigin,
    extra: Record<string, unknown> = {},
  ) {
    const database = await this.data.database();
    const stocktake = await this.load(database, stocktakeId);
    await this.data.units(currentUser, [MANAGE], stocktake.org_unit_id);
    this.assertStatus(stocktake.status, from, action);
    if (to === 'submitted') {
      const unchecked = (await this.lines(database, stocktakeId)).filter(
        (line) => line.in_scope && line.counted_quantity === null,
      ).length;
      if (unchecked > 0) {
        throw ruleViolationError(EQUIPMENT_RULE, `Còn ${unchecked} dòng trong sổ chưa kiểm, chưa nộp được`);
      }
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('equipment_stocktakes')
        .set({ status: to, updated_at: this.clock.now(), ...extra })
        .where('id', '=', stocktakeId)
        .where('status', 'in', from as Array<'counting'>)
        .returningAll()
        .executeTakeFirst();
      if (!updated) {
        throw new ApplicationError('ERR_CONFLICT', 'Đợt kiểm kê vừa được người khác cập nhật, tải lại để xem');
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: stocktake.org_unit_id,
        entityName: 'equipment_stocktakes',
        entityId: stocktakeId,
        action: 'update',
        before: stocktake,
        after: updated,
      });
      return updated;
    });
  }

  submit(currentUser: CurrentUser, stocktakeId: string, origin: ChangeOrigin) {
    return this.transition(currentUser, stocktakeId, ['counting'], 'submitted', 'nộp', origin, {
      submitted_by: origin.actorUserId,
      submitted_at: this.clock.now(),
      return_note: null,
    });
  }

  approve(currentUser: CurrentUser, stocktakeId: string, origin: ChangeOrigin) {
    return this.transition(currentUser, stocktakeId, ['submitted'], 'approved', 'duyệt', origin, {
      approved_by: origin.actorUserId,
      approved_at: this.clock.now(),
    });
  }

  returnBack(currentUser: CurrentUser, stocktakeId: string, note: string, origin: ChangeOrigin) {
    return this.transition(currentUser, stocktakeId, ['submitted', 'approved'], 'counting', 'trả lại', origin, {
      return_note: note,
      approved_by: null,
      approved_at: null,
    });
  }

  cancel(currentUser: CurrentUser, stocktakeId: string, origin: ChangeOrigin) {
    return this.transition(currentUser, stocktakeId, ['counting'], 'cancelled', 'hủy', origin);
  }

  // Chốt chênh lệch: áp kết quả đã duyệt vào sổ
  async close(currentUser: CurrentUser, stocktakeId: string, origin: ChangeOrigin) {
    const database = await this.data.database();
    const stocktake = await this.load(database, stocktakeId);
    await this.data.units(currentUser, [MANAGE], stocktake.org_unit_id);
    this.assertStatus(stocktake.status, ['approved'], 'chốt chênh lệch');
    const today = VIETNAM_DATE.format(this.clock.now());
    return database.transaction().execute(async (transaction) => {
      const closed = await transaction
        .updateTable('equipment_stocktakes')
        .set({
          status: 'closed',
          closed_by: origin.actorUserId,
          closed_at: this.clock.now(),
          updated_at: this.clock.now(),
        })
        .where('id', '=', stocktakeId)
        .where('status', '=', 'approved')
        .returningAll()
        .executeTakeFirst();
      if (!closed) {
        throw new ApplicationError('ERR_CONFLICT', 'Đợt kiểm kê vừa được người khác cập nhật, tải lại để xem');
      }
      const lines = await transaction
        .selectFrom('equipment_stocktake_lines')
        .selectAll()
        .where('stocktake_id', '=', stocktakeId)
        .where('counted_quantity', 'is not', null)
        .execute();
      const applied = { holdings: 0, moved: 0, damages: 0, skipped: 0 };
      for (const line of lines) {
        if (line.target_type === 'holding' && line.holding_id) {
          const before = await transaction
            .selectFrom('equipment_holdings')
            .select(['quantity', 'location_id'])
            .where('id', '=', line.holding_id)
            .executeTakeFirstOrThrow();
          const after = {
            quantity: line.usable_quantity ?? '0',
            location_id: line.found_location_id ?? before.location_id,
          };
          await transaction
            .updateTable('equipment_holdings')
            .set({ ...after, updated_by: origin.actorUserId, updated_at: this.clock.now() })
            .where('id', '=', line.holding_id)
            .execute();
          await writeAuditLog(transaction, {
            origin,
            orgUnitId: stocktake.org_unit_id,
            entityName: 'equipment_holdings',
            entityId: line.holding_id,
            action: 'update',
            before,
            after: { ...after, stocktake_code: stocktake.code },
          });
          applied.holdings += 1;
          continue;
        }
        if (!line.asset_id) {
          continue;
        }
        const asset = await transaction
          .selectFrom('assets')
          .select(['id', 'code', 'name', 'status', 'equipment_location_id'])
          .where('id', '=', line.asset_id)
          .executeTakeFirstOrThrow();
        if (line.found_location_id && line.found_location_id !== asset.equipment_location_id) {
          await transaction
            .updateTable('assets')
            .set({ equipment_location_id: line.found_location_id, updated_at: this.clock.now() })
            .where('id', '=', asset.id)
            .execute();
          await writeAuditLog(transaction, {
            origin,
            orgUnitId: stocktake.org_unit_id,
            entityName: 'assets',
            entityId: asset.id,
            action: 'update',
            before: { equipment_location_id: asset.equipment_location_id },
            after: { equipment_location_id: line.found_location_id, stocktake_code: stocktake.code },
          });
          applied.moved += 1;
        }
        if (line.condition === 'good' || line.condition === null) {
          continue;
        }
        const pending = await transaction
          .selectFrom('asset_damages')
          .select('id')
          .where('asset_id', '=', asset.id)
          .where('status', '=', 'pending')
          .executeTakeFirst();
        if (pending || ['lost', 'disposed'].includes(asset.status)) {
          applied.skipped += 1;
          continue;
        }
        const conditionLabel = labelOf(EQUIPMENT_CONDITIONS, line.condition);
        const damage = await transaction
          .insertInto('asset_damages')
          .values({
            code: await nextDocumentCode(transaction, 'asset_damage', 'HMTS'),
            asset_id: asset.id,
            org_unit_id: stocktake.org_unit_id,
            incident_type: line.condition === 'missing' ? 'lost' : 'damaged',
            severity: line.condition === 'damaged' ? 'minor' : 'total',
            description: `Kiểm kê ${stocktake.code}: ${conditionLabel}${line.note ? `. ${line.note}` : ''}`.slice(
              0,
              500,
            ),
            occurred_on: today,
            proposed_handling: line.condition === 'damaged' ? 'Sửa chữa' : 'Xử lý theo kết quả kiểm kê',
            reported_by: origin.actorUserId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await transaction
          .updateTable('equipment_stocktake_lines')
          .set({ damage_id: damage.id })
          .where('id', '=', line.id)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: stocktake.org_unit_id,
          entityName: 'asset_damages',
          entityId: damage.id,
          action: 'create',
          before: null,
          after: damage,
        });
        applied.damages += 1;
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: stocktake.org_unit_id,
        entityName: 'equipment_stocktakes',
        entityId: stocktakeId,
        action: 'update',
        before: stocktake,
        after: { ...closed, applied },
      });
      return { ...closed, applied };
    });
  }

  // Biên bản kiểm kê và chênh lệch; ghi nhật ký xuất (không có dữ liệu cá nhân của học sinh)
  async minutes(currentUser: CurrentUser, stocktakeId: string, format: 'pdf' | 'xlsx', ipAddress: string | null) {
    const detail = await this.detail(currentUser, stocktakeId);
    const database = await this.data.database();
    const createdAt = this.clock.now();
    const summary = detail.summary;
    const heading = [
      'BIÊN BẢN KIỂM KÊ THIẾT BỊ',
      `${detail.code} – ${detail.name}`,
      `Đơn vị: ${detail.org_unit_name}${detail.location_name ? `; nơi kiểm kê: ${detail.location_name}` : ''}; ngày kiểm kê: ${detail.started_on}`,
      `Trạng thái: ${labelOf(EQUIPMENT_STOCKTAKE_STATUSES, detail.status)}`,
      ...(detail.members ? [`Tổ kiểm kê: ${detail.members}`] : []),
    ];
    const sheets: TableFileSheet[] = [
      {
        title: 'Tổng hợp',
        heading,
        columns: [
          { key: 'label', label: 'Chỉ tiêu', width: 40 },
          { key: 'value', label: 'Số liệu', width: 16 },
        ],
        rows: [
          { label: 'Số dòng kiểm kê', value: summary.line_count },
          { label: 'Đã kiểm', value: summary.counted_count },
          { label: 'Chưa kiểm', value: summary.unchecked_count },
          { label: 'Khớp sổ', value: summary.matched_count },
          { label: 'Thiếu so với sổ (số dòng)', value: summary.shortage_count },
          { label: 'Thừa so với sổ (số dòng)', value: summary.surplus_count },
          { label: 'Phát hiện ngoài sổ (số dòng)', value: summary.out_of_scope_count },
          { label: 'Tổng số theo sổ', value: summary.expected_total },
          { label: 'Tổng số đếm được', value: summary.counted_total },
          { label: 'Số lượng thiếu', value: summary.shortage_quantity },
          { label: 'Số lượng thừa', value: summary.surplus_quantity },
          { label: 'Tổng số dùng được', value: summary.usable_total },
          {
            label: 'Tỷ lệ sử dụng được (%)',
            value: summary.usable_rate_percent === null ? '—' : summary.usable_rate_percent,
          },
          ...EQUIPMENT_CONDITIONS.map((condition) => ({
            label: `Tình trạng: ${condition.label} (số dòng)`,
            value: summary.conditions[condition.value],
          })),
        ],
      },
      {
        title: 'Đối chiếu',
        columns: [
          { key: 'code', label: 'Mã', width: 14 },
          { key: 'name', label: 'Tên thiết bị', width: 36 },
          { key: 'unit', label: 'ĐVT', width: 8 },
          { key: 'location_name', label: 'Nơi để theo sổ', width: 18 },
          { key: 'expected_quantity', label: 'Theo sổ' },
          { key: 'counted_quantity', label: 'Đếm được' },
          { key: 'usable_quantity', label: 'Dùng được' },
          { key: 'difference', label: 'Chênh lệch' },
          { key: 'result', label: 'Kết quả', width: 12 },
          { key: 'condition', label: 'Tình trạng', width: 18 },
          { key: 'found_location_name', label: 'Nơi thấy', width: 18 },
          { key: 'note', label: 'Ghi chú', width: 24 },
        ],
        numbered: true,
        rows: detail.lines.map((line) => ({
          ...line,
          name: line.in_scope ? line.name : `${line.name} (ngoài sổ)`,
          result: LINE_STATUS_LABELS[line.status],
          condition: labelOf(EQUIPMENT_CONDITIONS, line.condition),
        })),
      },
    ];
    const closing: PdfContent[] = [
      {
        margin: [0, 18, 0, 0],
        unbreakable: true,
        columns: ['Người lập', 'Tổ kiểm kê', 'Thủ trưởng đơn vị'].map((title) => ({
          width: '*',
          stack: [
            { text: title, bold: true, alignment: 'center' },
            { text: '(Kí, ghi rõ họ tên)', italics: true, alignment: 'center', fontSize: 7 },
          ],
        })),
      },
    ];
    const buffer =
      format === 'pdf'
        ? await buildPdf(sheets, createdAt, { closing, subject: `Biên bản kiểm kê ${detail.code}` })
        : await buildTableFile('xlsx', sheets, createdAt);
    const fileName = `bien-ban-kiem-ke-${detail.code.toLowerCase()}-${fileStamp(createdAt)}.${format}`;
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: 'equipment-stocktake-minutes',
        filters_data: JSON.stringify({ stocktake_id: stocktakeId, format }),
        org_unit_ids: [detail.org_unit_id],
        row_count: detail.lines.length,
        contains_personal_data: false,
        file_name: fileName,
        ip_address: ipAddress,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { buffer, fileName, logId: log.id, contentType: CONTENT_TYPES[format], rowCount: detail.lines.length };
  }
}

@Controller()
export class EquipmentStocktakesController {
  constructor(private readonly stocktakes: EquipmentStocktakesService) {}

  @Get('equipment-stocktakes')
  @RequirePermission(MANAGE, STOCKTAKE)
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = query.org_unit_id ? query.org_unit_id : null;
    if (orgUnitId !== null && !isUuid(orgUnitId)) {
      errors.push({ field: 'org_unit_id', message: 'Mã không hợp lệ' });
    }
    const status = query.status ? query.status : null;
    if (status !== null && !EQUIPMENT_STOCKTAKE_STATUSES.some((item) => item.value === status)) {
      errors.push({ field: 'status', message: 'Trạng thái không hợp lệ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.stocktakes.list(currentUser, { orgUnitId, status });
  }

  @Post('equipment-stocktakes')
  @RequirePermission(MANAGE)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = readStocktakeInput(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.stocktakes.create(currentUser, input, originOf(request, currentUser));
  }

  @Get('equipment-stocktakes/:id')
  @RequirePermission(MANAGE, STOCKTAKE)
  detail(
    @Param('id', uuidParameter('Mã đợt kiểm kê không hợp lệ')) stocktakeId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.stocktakes.detail(currentUser, stocktakeId);
  }

  @Post('equipment-stocktakes/:id/scan')
  @HttpCode(200)
  @RequirePermission(MANAGE, STOCKTAKE)
  scan(
    @Param('id', uuidParameter('Mã đợt kiểm kê không hợp lệ')) stocktakeId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const scan = readScanRequest(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.stocktakes.scan(currentUser, stocktakeId, scan, originOf(request, currentUser));
  }

  @Post('equipment-stocktakes/:id/submit')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  submit(
    @Param('id', uuidParameter('Mã đợt kiểm kê không hợp lệ')) stocktakeId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.stocktakes.submit(currentUser, stocktakeId, originOf(request, currentUser));
  }

  @Post('equipment-stocktakes/:id/approve')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  approve(
    @Param('id', uuidParameter('Mã đợt kiểm kê không hợp lệ')) stocktakeId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.stocktakes.approve(currentUser, stocktakeId, originOf(request, currentUser));
  }

  @Post('equipment-stocktakes/:id/return')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  returnBack(
    @Param('id', uuidParameter('Mã đợt kiểm kê không hợp lệ')) stocktakeId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const note = readRequiredText(body, 'note', errors);
    if (note.length > 500) {
      errors.push({ field: 'note', message: 'Tối đa 500 ký tự' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.stocktakes.returnBack(currentUser, stocktakeId, note, originOf(request, currentUser));
  }

  @Post('equipment-stocktakes/:id/cancel')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  cancel(
    @Param('id', uuidParameter('Mã đợt kiểm kê không hợp lệ')) stocktakeId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.stocktakes.cancel(currentUser, stocktakeId, originOf(request, currentUser));
  }

  @Post('equipment-stocktakes/:id/close')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  close(
    @Param('id', uuidParameter('Mã đợt kiểm kê không hợp lệ')) stocktakeId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.stocktakes.close(currentUser, stocktakeId, originOf(request, currentUser));
  }

  @Post('equipment-stocktakes/:id/minutes')
  @HttpCode(200)
  @RequirePermission(MANAGE, STOCKTAKE)
  async minutes(
    @Param('id', uuidParameter('Mã đợt kiểm kê không hợp lệ')) stocktakeId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const format =
      body?.format === 'xlsx' ? 'xlsx' : body?.format === undefined || body?.format === 'pdf' ? 'pdf' : null;
    if (!format) {
      throw validationError([{ field: 'format', message: 'Định dạng là pdf hoặc xlsx' }]);
    }
    sendWorkbook(response, await this.stocktakes.minutes(currentUser, stocktakeId, format, request.ip ?? null));
  }
}
