import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Put, Query, Req } from '@nestjs/common';
import type {
  FoodCheckResult,
  FoodInspectionStep,
  FoodRejectionAction,
  MealType,
  SchoolYearDatabase,
} from '@school-management/database';
import { ruleViolationError, type FieldError } from '@school-management/server';
import { FOOD_CHECK_RESULTS, FOOD_REJECTION_ACTIONS, PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { dayOfWeek } from '../attendance/school-calendar.js';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  isUuid,
  notFoundError,
  readOptionalUuid,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { confirmViolations, lotUnusableReason, readClockTime, suggestLots } from './food-safety-calc.js';
import { FoodSafetyRecordsService } from './food-safety-records.js';
import { KitchenAccess } from './kitchen-access.js';
import { MEAL_TYPES, check, queryDate, queryUuid, readDate, readText } from './kitchen-fields.js';
import { KitchenMealsService } from './kitchen-meals.js';

// Kiểm thực ba bước (DT-18 phần 22b, YCTD-146; BR-143) theo Quyết định 1246/QĐ-BYT: mỗi đơn vị mỗi ngày mỗi bước một phiếu.
// Bước 1 (mẫu số 1) kiểm tra từng lô nhập trong ngày; bước 2 (mẫu số 2) kiểm tra từng món khi chế biến, kèm lô đã dùng; bước 3
// (mẫu số 3) kiểm tra từng món trước khi ăn. Lập phiếu thì gợi ý sẵn dòng: lô chờ kiểm tra, món của thực đơn đã công bố và số
// suất của ngày. Xác nhận phiếu thì khóa; xác nhận bước 1 thì lô đạt chuyển "Đạt, đã nhận", lô không đạt chuyển "Không đạt"
// kèm cách xử lý (trả lại, hủy). Người lập và xác nhận cần quyền P12.food-safety.inspect của đơn vị
const MAXIMUM_LINES = 200;
const MAXIMUM_LOTS_PER_LINE = 30;

export interface InspectionLineInput {
  lot_id: string | null;
  meal_type: MealType | null;
  dish_id: string | null;
  dish_name: string | null;
  main_ingredients: string | null;
  servings: number | null;
  first_time: string | null;
  second_time: string | null;
  hygiene_people: FoodCheckResult | null;
  hygiene_equipment: FoodCheckResult | null;
  hygiene_area: FoodCheckResult | null;
  utensils: string | null;
  sensory_result: FoodCheckResult | null;
  rapid_test_result: FoodCheckResult | null;
  rejection_action: FoodRejectionAction | null;
  action: string | null;
  note: string | null;
  lot_ids: string[];
}

interface HeaderInput {
  inspector_name: string;
  inspector_title: string | null;
  inspected_time: string | null;
  location: string | null;
  note: string | null;
}

const EMPTY_LINE: InspectionLineInput = {
  lot_id: null,
  meal_type: null,
  dish_id: null,
  dish_name: null,
  main_ingredients: null,
  servings: null,
  first_time: null,
  second_time: null,
  hygiene_people: null,
  hygiene_equipment: null,
  hygiene_area: null,
  utensils: null,
  sensory_result: null,
  rapid_test_result: null,
  rejection_action: null,
  action: null,
  note: null,
  lot_ids: [],
};

@Injectable()
export class FoodInspectionsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: KitchenAccess,
    private readonly meals: KitchenMealsService,
    private readonly records: FoodSafetyRecordsService,
  ) {}

  private async assertInspect(currentUser: CurrentUser, orgUnitId: string) {
    await this.access.assert(
      currentUser,
      PERMISSION_CODES.foodSafetyInspect,
      orgUnitId,
      'Bạn không có quyền kiểm thực của đơn vị này',
    );
  }

  async list(currentUser: CurrentUser, filter: { orgUnitId: string; from: string | null; to: string | null }) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, filter.orgUnitId);
    const rows = await database
      .selectFrom('food_inspections')
      .leftJoin('food_inspection_lines', 'food_inspection_lines.inspection_id', 'food_inspections.id')
      .select([
        'food_inspections.id',
        'food_inspections.org_unit_id',
        'food_inspections.inspection_date',
        'food_inspections.step',
        'food_inspections.inspector_name',
        'food_inspections.inspector_title',
        'food_inspections.status',
        'food_inspections.confirmed_at',
      ])
      .select((eb) => [
        eb.fn.count<string>('food_inspection_lines.id').as('line_count'),
        eb.fn
          .count<string>('food_inspection_lines.id')
          .filterWhere((inner) =>
            inner.or([
              inner('food_inspection_lines.sensory_result', '=', 'fail'),
              inner('food_inspection_lines.rapid_test_result', '=', 'fail'),
              inner('food_inspection_lines.hygiene_people', '=', 'fail'),
              inner('food_inspection_lines.hygiene_equipment', '=', 'fail'),
              inner('food_inspection_lines.hygiene_area', '=', 'fail'),
            ]),
          )
          .as('fail_count'),
      ])
      .where('food_inspections.org_unit_id', '=', filter.orgUnitId)
      .$if(filter.from !== null, (query) => query.where('food_inspections.inspection_date', '>=', filter.from ?? ''))
      .$if(filter.to !== null, (query) => query.where('food_inspections.inspection_date', '<=', filter.to ?? ''))
      .groupBy('food_inspections.id')
      .orderBy('food_inspections.inspection_date', 'desc')
      .orderBy('food_inspections.step')
      .execute();
    return rows.map((row) => ({ ...row, line_count: Number(row.line_count), fail_count: Number(row.fail_count) }));
  }

  // Ba phiếu của một ngày (phiếu chưa lập là null) và trạng thái theo bước
  async day(currentUser: CurrentUser, orgUnitId: string, date: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, orgUnitId);
    const sheets = await database
      .selectFrom('food_inspections')
      .select('id')
      .where('org_unit_id', '=', orgUnitId)
      .where('inspection_date', '=', date)
      .orderBy('step')
      .execute();
    const details = await Promise.all(sheets.map((sheet) => this.detailOf(database, sheet.id)));
    return {
      org_unit_id: orgUnitId,
      date,
      steps: ([1, 2, 3] as const).map((step) => details.find((detail) => detail.step === step) ?? null),
    };
  }

  async detail(currentUser: CurrentUser, id: string) {
    const { database } = await this.currentSchoolYear.require();
    const inspection = await this.find(database, id);
    await this.access.assertRead(currentUser, inspection.org_unit_id);
    return this.detailOf(database, id);
  }

  async create(
    currentUser: CurrentUser,
    input: HeaderInput & { org_unit_id: string; inspection_date: string; step: FoodInspectionStep },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertInspect(currentUser, input.org_unit_id);
    const existing = await database
      .selectFrom('food_inspections')
      .select('id')
      .where('org_unit_id', '=', input.org_unit_id)
      .where('inspection_date', '=', input.inspection_date)
      .where('step', '=', input.step)
      .executeTakeFirst();
    if (existing) {
      throw ruleViolationError('BR-143', 'Đơn vị đã có phiếu của bước này trong ngày');
    }
    const lines = await this.suggestedLines(database, input.org_unit_id, input.inspection_date, input.step);
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('food_inspections')
        .values({ ...input, created_by: origin.actorUserId })
        .returningAll()
        .executeTakeFirstOrThrow();
      await insertLines(transaction, row.id, lines);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'food_inspections',
        entityId: row.id,
        action: 'create',
        before: null,
        after: { ...row, lines },
      });
      return row;
    });
    return this.detailOf(database, created.id);
  }

  // Dòng gợi ý khi lập phiếu: bước 1 các lô chờ kiểm tra nhập đến ngày đó; bước 2, 3 các món của thực đơn đã công bố trong
  // ngày theo bữa với số suất của ngày; bước 2 kèm nguyên liệu chính và lô gợi ý theo nguyên liệu của món
  async suggestedLines(
    database: Kysely<SchoolYearDatabase>,
    orgUnitId: string,
    date: string,
    step: FoodInspectionStep,
  ): Promise<InspectionLineInput[]> {
    if (step === 1) {
      const lots = await database
        .selectFrom('food_lots')
        .select('id')
        .where('org_unit_id', '=', orgUnitId)
        .where('status', '=', 'pending')
        .where('received_date', '<=', date)
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom('food_inspection_lines')
                .select('food_inspection_lines.id')
                .whereRef('food_inspection_lines.lot_id', '=', 'food_lots.id'),
            ),
          ),
        )
        .orderBy('received_date')
        .orderBy('code')
        .execute();
      return lots.map((lot) => ({ ...EMPTY_LINE, lot_id: lot.id }));
    }
    const norms = await this.meals.dailyNorms(database, orgUnitId, date);
    if (norms.menus.length === 0) {
      return [];
    }
    const servings = new Map(norms.menus.map((menu) => [menu.menu_id, menu.servings]));
    const items = await database
      .selectFrom('menu_items')
      .innerJoin('dishes', 'dishes.id', 'menu_items.dish_id')
      .select(['menu_items.menu_id', 'menu_items.meal_type', 'menu_items.dish_id', 'dishes.name'])
      .where('menu_items.menu_id', 'in', [...servings.keys()])
      .where('menu_items.weekday', '=', dayOfWeek(date))
      .execute();
    const dishes = new Map<string, { meal_type: MealType; dish_id: string; name: string; servings: number }>();
    for (const item of items) {
      const key = `${item.meal_type}:${item.dish_id}`;
      const current = dishes.get(key) ?? {
        meal_type: item.meal_type,
        dish_id: item.dish_id,
        name: item.name,
        servings: 0,
      };
      current.servings += servings.get(item.menu_id) ?? 0;
      dishes.set(key, current);
    }
    const ordered = [...dishes.values()].sort(
      (left, right) =>
        MEAL_TYPES.indexOf(left.meal_type) - MEAL_TYPES.indexOf(right.meal_type) || left.name.localeCompare(right.name),
    );
    if (step === 3) {
      return ordered.map((dish) => ({
        ...EMPTY_LINE,
        meal_type: dish.meal_type,
        dish_id: dish.dish_id,
        dish_name: dish.name,
        servings: dish.servings,
      }));
    }
    const dishIds = ordered.map((dish) => dish.dish_id);
    const dishNorms =
      dishIds.length === 0
        ? []
        : await database
            .selectFrom('ingredient_norms')
            .innerJoin('ingredients', 'ingredients.id', 'ingredient_norms.ingredient_id')
            .select([
              'ingredient_norms.dish_id',
              'ingredient_norms.ingredient_id',
              'ingredient_norms.quantity_per_serving',
              'ingredients.name',
              'ingredients.unit',
            ])
            .where('ingredient_norms.dish_id', 'in', dishIds)
            .orderBy('ingredients.name')
            .execute();
    const ingredientIds = [...new Set(dishNorms.map((norm) => norm.ingredient_id))];
    const lots =
      ingredientIds.length === 0
        ? []
        : await database
            .selectFrom('food_lots')
            .select(['id', 'ingredient_id', 'received_date', 'expiry_date', 'status'])
            .where('org_unit_id', '=', orgUnitId)
            .where('ingredient_id', 'in', ingredientIds)
            .where('status', '=', 'accepted')
            .execute();
    return ordered.map((dish) => {
      const own = dishNorms.filter((norm) => norm.dish_id === dish.dish_id);
      return {
        ...EMPTY_LINE,
        meal_type: dish.meal_type,
        dish_id: dish.dish_id,
        dish_name: dish.name,
        servings: dish.servings,
        main_ingredients:
          own
            .map((norm) => {
              const total = Math.round(Number(norm.quantity_per_serving) * dish.servings * 1000) / 1000;
              return `${norm.name} ${total.toLocaleString('vi-VN')} ${norm.unit}`;
            })
            .join('; ') || null,
        lot_ids: suggestLots(
          own.map((norm) => norm.ingredient_id),
          lots,
          date,
        ),
      };
    });
  }

  async update(
    currentUser: CurrentUser,
    id: string,
    input: { header: Partial<HeaderInput>; lines: InspectionLineInput[] | undefined },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const before = await this.find(database, id);
    await this.assertInspect(currentUser, before.org_unit_id);
    if (before.status !== 'draft') {
      throw ruleViolationError('BR-143', 'Phiếu đã xác nhận, không sửa được');
    }
    if (input.lines) {
      await this.assertLines(database, before, input.lines);
    }
    await database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('food_inspections')
        .set({ ...input.header, updated_at: new Date() })
        .where('id', '=', id)
        .where('status', '=', 'draft')
        .returningAll()
        .executeTakeFirst();
      if (!after) {
        throw ruleViolationError('BR-143', 'Phiếu đã xác nhận, không sửa được');
      }
      if (input.lines) {
        await transaction.deleteFrom('food_inspection_lines').where('inspection_id', '=', id).execute();
        await insertLines(transaction, id, input.lines);
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'food_inspections',
        entityId: id,
        action: 'update',
        before,
        after: { ...after, lines: input.lines },
      });
    });
    return this.detailOf(database, id);
  }

  // Dòng hợp lệ theo bước: bước 1 mỗi dòng một lô của đơn vị chưa kiểm ở phiếu khác; bước 2, 3 phải có tên món và bữa; lô
  // của món ở bước 2 phải dùng được vào ngày chế biến
  private async assertLines(
    database: Kysely<SchoolYearDatabase>,
    inspection: { id: string; org_unit_id: string; inspection_date: string; step: number },
    lines: InspectionLineInput[],
  ) {
    const errors: FieldError[] = [];
    if (inspection.step === 1) {
      const lotIds = lines.map((line) => line.lot_id).filter((value): value is string => value !== null);
      if (lotIds.length !== lines.length) {
        errors.push({ field: 'lines', message: 'Mỗi dòng bước 1 là một lô hàng' });
      }
      if (new Set(lotIds).size !== lotIds.length) {
        errors.push({ field: 'lines', message: 'Mỗi lô chỉ một dòng' });
      }
      if (lotIds.length > 0) {
        const lots = await database
          .selectFrom('food_lots')
          .select(['id', 'code', 'org_unit_id', 'received_date', 'status'])
          .where('id', 'in', lotIds)
          .execute();
        const elsewhere = await database
          .selectFrom('food_inspection_lines')
          .select('lot_id')
          .where('lot_id', 'in', lotIds)
          .where('inspection_id', '!=', inspection.id)
          .execute();
        for (const lotId of lotIds) {
          const lot = lots.find((row) => row.id === lotId);
          if (!lot || lot.org_unit_id !== inspection.org_unit_id) {
            errors.push({ field: 'lines', message: 'Lô hàng phải thuộc đơn vị' });
          } else if (lot.status !== 'pending' || elsewhere.some((row) => row.lot_id === lotId)) {
            errors.push({ field: 'lines', message: `Lô ${lot.code} đã kiểm tra ở phiếu khác` });
          } else if (lot.received_date > inspection.inspection_date) {
            errors.push({ field: 'lines', message: `Lô ${lot.code} nhập sau ngày kiểm tra` });
          }
        }
      }
    } else {
      lines.forEach((line, index) => {
        if (!line.meal_type || !line.dish_name) {
          errors.push({ field: `lines.${index}`, message: `Dòng ${index + 1}: chọn bữa và ghi tên món` });
        }
      });
      const dishIds = [
        ...new Set(lines.map((line) => line.dish_id).filter((value): value is string => value !== null)),
      ];
      if (dishIds.length > 0) {
        const dishes = await database
          .selectFrom('dishes')
          .select('id')
          .where('id', 'in', dishIds)
          .where('org_unit_id', '=', inspection.org_unit_id)
          .execute();
        if (dishes.length !== dishIds.length) {
          errors.push({ field: 'lines', message: 'Món phải thuộc đơn vị' });
        }
      }
      const lotIds = [...new Set(lines.flatMap((line) => line.lot_ids))];
      if (inspection.step === 3 && lotIds.length > 0) {
        errors.push({ field: 'lines', message: 'Bước 3 không ghi lô hàng' });
      } else if (lotIds.length > 0) {
        const lots = await database
          .selectFrom('food_lots')
          .select(['id', 'code', 'org_unit_id', 'status', 'received_date', 'expiry_date'])
          .where('id', 'in', lotIds)
          .execute();
        for (const lotId of lotIds) {
          const lot = lots.find((row) => row.id === lotId);
          const reason =
            !lot || lot.org_unit_id !== inspection.org_unit_id
              ? 'Lô hàng phải thuộc đơn vị'
              : lotUnusableReason(lot, inspection.inspection_date);
          if (reason) {
            errors.push({ field: 'lines', message: reason });
          }
        }
      }
    }
    check(errors);
  }

  async confirm(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const inspection = await this.find(database, id);
    await this.assertInspect(currentUser, inspection.org_unit_id);
    if (inspection.status !== 'draft') {
      throw ruleViolationError('BR-143', 'Phiếu đã xác nhận');
    }
    const lines = await database
      .selectFrom('food_inspection_lines')
      .selectAll()
      .where('inspection_id', '=', id)
      .orderBy('line_no')
      .execute();
    const problems = confirmViolations(inspection.step, lines);
    if (inspection.step === 1) {
      for (const line of lines) {
        if (line.sensory_result === 'fail' || line.rapid_test_result === 'fail') {
          if (!line.rejection_action) {
            problems.push(`Dòng ${line.line_no}: lô không đạt thì chọn cách xử lý (trả lại, hủy)`);
          }
        }
      }
    }
    if (problems.length > 0) {
      throw ruleViolationError('BR-143', problems.join('; '));
    }
    await database.transaction().execute(async (transaction) => {
      const confirmed = await transaction
        .updateTable('food_inspections')
        .set({
          status: 'confirmed',
          confirmed_by: origin.actorUserId,
          confirmed_at: new Date(),
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .where('status', '=', 'draft')
        .returning('id')
        .executeTakeFirst();
      if (!confirmed) {
        throw ruleViolationError('BR-143', 'Phiếu đã xác nhận');
      }
      const lotChanges: Array<{ lot_id: string; status: string }> = [];
      if (inspection.step === 1) {
        for (const line of lines) {
          const failed = line.sensory_result === 'fail' || line.rapid_test_result === 'fail';
          const updated = await transaction
            .updateTable('food_lots')
            .set({
              status: failed ? 'rejected' : 'accepted',
              rejection_action: failed ? line.rejection_action : null,
              handling_note: failed ? line.action : null,
              updated_at: new Date(),
            })
            .where('id', '=', line.lot_id ?? '')
            .where('status', '=', 'pending')
            .returning('id')
            .executeTakeFirst();
          if (!updated) {
            throw ruleViolationError('BR-143', `Dòng ${line.line_no}: lô đã được kiểm tra ở phiếu khác`);
          }
          lotChanges.push({ lot_id: line.lot_id ?? '', status: failed ? 'rejected' : 'accepted' });
        }
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: inspection.org_unit_id,
        entityName: 'food_inspections',
        entityId: id,
        action: 'update',
        before: { status: 'draft' },
        after: { status: 'confirmed', lots: lotChanges },
      });
    });
    return this.detailOf(database, id);
  }

  private async find(database: Kysely<SchoolYearDatabase>, id: string) {
    const inspection = await database
      .selectFrom('food_inspections')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!inspection) {
      throw notFoundError('Không tìm thấy phiếu kiểm thực', 'food_inspection');
    }
    return inspection;
  }

  async detailOf(database: Kysely<SchoolYearDatabase>, id: string) {
    const inspection = await database
      .selectFrom('food_inspections')
      .innerJoin('org_units', 'org_units.id', 'food_inspections.org_unit_id')
      .selectAll('food_inspections')
      .select('org_units.name as org_unit_name')
      .where('food_inspections.id', '=', id)
      .executeTakeFirstOrThrow();
    const lines = await database
      .selectFrom('food_inspection_lines')
      .selectAll()
      .where('inspection_id', '=', id)
      .orderBy('line_no')
      .execute();
    const lineLots =
      lines.length === 0
        ? []
        : await database
            .selectFrom('food_inspection_line_lots')
            .select(['line_id', 'lot_id'])
            .where(
              'line_id',
              'in',
              lines.map((line) => line.id),
            )
            .execute();
    const lotIds = [
      ...new Set([
        ...lines.map((line) => line.lot_id).filter((value): value is string => value !== null),
        ...lineLots.map((row) => row.lot_id),
      ]),
    ];
    const lots = lotIds.length === 0 ? [] : await this.records.lotsByIds(database, lotIds);
    const today = this.records.today();
    const lotView = (lotId: string) => {
      const lot = lots.find((row) => row.id === lotId);
      return lot ? this.records.lotView(lot, today) : null;
    };
    return {
      ...inspection,
      lines: lines.map((line) => ({
        ...line,
        lot: line.lot_id ? lotView(line.lot_id) : null,
        lots: lineLots
          .filter((row) => row.line_id === line.id)
          .map((row) => lotView(row.lot_id))
          .filter((lot) => lot !== null)
          .map((lot) => ({
            id: lot.id,
            code: lot.code,
            ingredient_name: lot.ingredient_name,
            supplier_name: lot.supplier_name,
            received_date: lot.received_date,
            expiry_date: lot.expiry_date,
          })),
      })),
    };
  }
}

async function insertLines(
  transaction: Kysely<SchoolYearDatabase>,
  inspectionId: string,
  lines: InspectionLineInput[],
): Promise<void> {
  for (const [index, line] of lines.entries()) {
    const { lot_ids: lotIds, ...values } = line;
    const row = await transaction
      .insertInto('food_inspection_lines')
      .values({ ...values, inspection_id: inspectionId, line_no: index + 1 })
      .returning('id')
      .executeTakeFirstOrThrow();
    if (lotIds.length > 0) {
      await transaction
        .insertInto('food_inspection_line_lots')
        .values([...new Set(lotIds)].map((lotId) => ({ line_id: row.id, lot_id: lotId })))
        .execute();
    }
  }
}

function readResult(body: RequestBody, field: string, errors: FieldError[], prefix: string): FoodCheckResult | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (!FOOD_CHECK_RESULTS.some((item) => item.value === value)) {
    errors.push({ field: `${prefix}.${field}`, message: 'Kết quả là pass hoặc fail' });
    return null;
  }
  return value as FoodCheckResult;
}

export function readInspectionLines(body: RequestBody, errors: FieldError[]): InspectionLineInput[] | undefined {
  const value = body?.lines;
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length > MAXIMUM_LINES) {
    errors.push({ field: 'lines', message: `Phiếu có tối đa ${MAXIMUM_LINES} dòng` });
    return undefined;
  }
  return value.map((item: RequestBody, index) => {
    const prefix = `lines.${index}`;
    const mealType = item?.meal_type;
    if (mealType !== undefined && mealType !== null && !MEAL_TYPES.includes(mealType as MealType)) {
      errors.push({ field: `${prefix}.meal_type`, message: 'Bữa là breakfast, lunch hoặc snack' });
    }
    const servings = item?.servings;
    if (
      servings !== undefined &&
      servings !== null &&
      (typeof servings !== 'number' || !Number.isInteger(servings) || servings < 0 || servings > 100_000)
    ) {
      errors.push({ field: `${prefix}.servings`, message: 'Số suất là số nguyên không âm' });
    }
    const rejection = item?.rejection_action;
    if (
      rejection !== undefined &&
      rejection !== null &&
      rejection !== '' &&
      !FOOD_REJECTION_ACTIONS.some((action) => action.value === rejection)
    ) {
      errors.push({ field: `${prefix}.rejection_action`, message: 'Cách xử lý không hợp lệ' });
    }
    const lotIds = item?.lot_ids;
    if (
      lotIds !== undefined &&
      (!Array.isArray(lotIds) || lotIds.length > MAXIMUM_LOTS_PER_LINE || !lotIds.every((lotId) => isUuid(lotId)))
    ) {
      errors.push({ field: `${prefix}.lot_ids`, message: `Chọn tối đa ${MAXIMUM_LOTS_PER_LINE} lô hợp lệ` });
    }
    return {
      lot_id: readOptionalUuid(item, 'lot_id', errors) ?? null,
      meal_type: MEAL_TYPES.includes(mealType as MealType) ? (mealType as MealType) : null,
      dish_id: readOptionalUuid(item, 'dish_id', errors) ?? null,
      dish_name: readText(item, 'dish_name', errors),
      main_ingredients: readText(item, 'main_ingredients', errors),
      servings: typeof servings === 'number' && Number.isInteger(servings) && servings >= 0 ? servings : null,
      first_time: readClockTime(item?.first_time, `${prefix}.first_time`, errors),
      second_time: readClockTime(item?.second_time, `${prefix}.second_time`, errors),
      hygiene_people: readResult(item, 'hygiene_people', errors, prefix),
      hygiene_equipment: readResult(item, 'hygiene_equipment', errors, prefix),
      hygiene_area: readResult(item, 'hygiene_area', errors, prefix),
      utensils: readText(item, 'utensils', errors),
      sensory_result: readResult(item, 'sensory_result', errors, prefix),
      rapid_test_result: readResult(item, 'rapid_test_result', errors, prefix),
      rejection_action:
        typeof rejection === 'string' && FOOD_REJECTION_ACTIONS.some((action) => action.value === rejection)
          ? (rejection as FoodRejectionAction)
          : null,
      action: readText(item, 'action', errors),
      note: readText(item, 'note', errors),
      lot_ids: Array.isArray(lotIds) ? lotIds.filter((lotId): lotId is string => isUuid(lotId)) : [],
    };
  });
}

function readHeader(body: RequestBody, errors: FieldError[], partial: boolean): Partial<HeaderInput> {
  const has = (field: string) => !partial || (body !== undefined && field in body);
  const header: Partial<HeaderInput> = {};
  if (has('inspector_name')) {
    header.inspector_name = readText(body, 'inspector_name', errors, true) ?? '';
  }
  if (has('inspector_title')) {
    header.inspector_title = readText(body, 'inspector_title', errors);
  }
  if (has('inspected_time')) {
    header.inspected_time = readClockTime(body?.inspected_time, 'inspected_time', errors);
  }
  if (has('location')) {
    header.location = readText(body, 'location', errors);
  }
  if (has('note')) {
    header.note = readText(body, 'note', errors);
  }
  return header;
}

@Controller()
export class FoodInspectionsController {
  constructor(private readonly inspections: FoodInspectionsService) {}

  @Get('food-inspections')
  list(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.inspections.list(currentUser, {
      orgUnitId: queryUuid(query.org_unit_id, 'org_unit_id', true) ?? '',
      from: queryDate(query.from, 'from'),
      to: queryDate(query.to, 'to'),
    });
  }

  @Get('food-inspections/day')
  day(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.inspections.day(
      currentUser,
      queryUuid(query.org_unit_id, 'org_unit_id', true) ?? '',
      queryDate(query.date, 'date', true) ?? '',
    );
  }

  @Get('food-inspections/:id')
  detail(
    @Param('id', uuidParameter('Mã phiếu kiểm thực không hợp lệ')) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.inspections.detail(currentUser, id);
  }

  @Post('food-inspections')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const date = readDate(body, 'inspection_date', errors, true) ?? '';
    const step = body?.step;
    if (step !== 1 && step !== 2 && step !== 3) {
      errors.push({ field: 'step', message: 'Bước là 1, 2 hoặc 3' });
    }
    const header = readHeader(body, errors, false) as HeaderInput;
    check(errors);
    return this.inspections.create(
      currentUser,
      { ...header, org_unit_id: orgUnitId, inspection_date: date, step: step as FoodInspectionStep },
      originOf(request, currentUser),
    );
  }

  @Put('food-inspections/:id')
  update(
    @Param('id', uuidParameter('Mã phiếu kiểm thực không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const header = readHeader(body, errors, true);
    const lines = readInspectionLines(body, errors);
    check(errors);
    return this.inspections.update(currentUser, id, { header, lines }, originOf(request, currentUser));
  }

  @Post('food-inspections/:id/confirm')
  @HttpCode(200)
  confirm(
    @Param('id', uuidParameter('Mã phiếu kiểm thực không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.inspections.confirm(currentUser, id, originOf(request, currentUser));
  }
}
