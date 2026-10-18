import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { MealType, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { dayOfWeek } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { queueNotification } from '../common/notification-queue.js';
import {
  conflictOnDuplicate,
  notFoundError,
  readOptionalUuid,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { isGuardianOf } from '../finance/receivables.js';
import { KitchenAccess } from './kitchen-access.js';
import {
  MEAL_LABELS,
  MEAL_TYPES,
  addDays,
  check,
  queryDate,
  queryUuid,
  readDate,
  readText,
  weekStartOf,
} from './kitchen-fields.js';
import { KitchenMealsService } from './kitchen-meals.js';
import {
  gradesOverlap,
  menuForGrade,
  readMenuHeader,
  resolveMenuHeader,
  type MenuHeader,
  type MenuHeaderInput,
} from './menu-header.js';

// Thực đơn tuần, duyệt và công bố, định lượng theo số suất, buffet theo dịp, thực đơn của con cho phụ huynh (P12-02,
// P12-03, P12-04, P12-06; BR-59, BR-69, BR-83; YCTD-76). Bếp lập nháp rồi trình; quản lý đơn vị duyệt là công bố ngay cho
// phụ huynh của đơn vị, hoặc trả lại kèm lý do; thực đơn đã công bố không sửa. Phụ huynh chỉ thấy thực đơn đã công bố
// (CT-065) và buffet đã duyệt. Thực đơn có tên, tháng, tuần, từ ngày–đến ngày, khối áp dụng như màn hình 4.5 của Sở; nhập
// từ Excel ở menu-imports.ts (DT-16 phần 16h)
const MAXIMUM_ITEMS = 120;

interface MenuItemInput {
  weekday: number;
  meal_type: MealType;
  dish_id: string;
  note: string | null;
}

@Injectable()
export class KitchenMenusService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: KitchenAccess,
    private readonly meals: KitchenMealsService,
    private readonly clock: Clock,
    private readonly databases: Databases,
  ) {}

  async list(currentUser: CurrentUser, orgUnitId: string, weekStartDate: string | null, month: string | null = null) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, orgUnitId);
    return database
      .selectFrom('menus')
      .select((expression) => [
        'menus.id',
        'menus.org_unit_id',
        'menus.week_start_date',
        'menus.age_group',
        'menus.name',
        'menus.month',
        'menus.week_no',
        'menus.from_date',
        'menus.to_date',
        'menus.grade_levels',
        'menus.status',
        'menus.note',
        'menus.reject_reason',
        'menus.submitted_at',
        'menus.published_at',
        expression
          .selectFrom('menu_items')
          .select((inner) => inner.fn.countAll<string>().as('count'))
          .whereRef('menu_items.menu_id', '=', 'menus.id')
          .as('item_count'),
      ])
      .where('menus.org_unit_id', '=', orgUnitId)
      .$if(weekStartDate !== null, (query) => query.where('menus.week_start_date', '=', weekStartDate ?? ''))
      .$if(month !== null, (query) => query.where('menus.month', '=', month ?? ''))
      .orderBy('menus.week_start_date', 'desc')
      .orderBy('menus.age_group')
      .execute()
      .then((rows) => rows.map((row) => ({ ...row, item_count: Number(row.item_count ?? 0) })));
  }

  // Tuần học (khai báo tuần của năm học đang dùng) chứa tuần của thực đơn; chưa khai báo thì để trống
  async weekNumbers(): Promise<(weekStart: string) => number | null> {
    const { academicYearId } = await this.currentSchoolYear.require();
    const weeks = await this.databases.system
      .selectFrom('school_weeks')
      .select(['week_no', 'start_date', 'end_date'])
      .where('academic_year_id', '=', academicYearId)
      .execute();
    const text = (value: unknown) => String(value instanceof Date ? value.toISOString() : value).slice(0, 10);
    return (weekStart) =>
      weeks.find((week) => text(week.start_date) <= weekStart && text(week.end_date) >= weekStart)?.week_no ?? null;
  }

  // Thông tin chung đầy đủ đã kiểm tra khối trong danh mục; lỗi trả ERR_VALIDATION
  async header(database: Kysely<SchoolYearDatabase>, input: MenuHeaderInput): Promise<MenuHeader> {
    const { errors, header } = resolveMenuHeader(input, await this.weekNumbers());
    if (header) {
      const unknown = await this.unknownGrades(database, header.grade_levels);
      if (unknown.length > 0) {
        errors.push({ field: 'grade_levels', message: `Mã khối không có trong danh mục: ${unknown.join(', ')}` });
      }
    }
    if (errors.length > 0 || !header) {
      throw validationError(errors);
    }
    return header;
  }

  async unknownGrades(database: Kysely<SchoolYearDatabase>, codes: string[]): Promise<string[]> {
    if (codes.length === 0) {
      return [];
    }
    const found = await database.selectFrom('grade_levels').select('code').where('code', 'in', codes).execute();
    const known = new Set(found.map((row) => row.code));
    return codes.filter((code) => !known.has(code));
  }

  // Thực đơn khác cùng đơn vị, cùng tuần trùng khối áp dụng
  async overlapping(
    database: Kysely<SchoolYearDatabase>,
    orgUnitId: string,
    header: Pick<MenuHeader, 'week_start_date' | 'grade_levels'>,
    exceptId: string | null,
  ) {
    const others = await database
      .selectFrom('menus')
      .select(['id', 'name', 'grade_levels'])
      .where('org_unit_id', '=', orgUnitId)
      .where('week_start_date', '=', header.week_start_date)
      .$if(exceptId !== null, (query) => query.where('id', '!=', exceptId ?? ''))
      .execute();
    return others.find((other) => gradesOverlap(other.grade_levels ?? [], header.grade_levels));
  }

  private async assertNoOverlap(
    database: Kysely<SchoolYearDatabase>,
    orgUnitId: string,
    header: MenuHeader,
    exceptId: string | null,
  ) {
    const other = await this.overlapping(database, orgUnitId, header, exceptId);
    if (other) {
      throw validationError([
        {
          field: 'grade_levels',
          message: `Tuần này đã có thực đơn "${other.name ?? ''}" áp dụng cho ${header.grade_levels.length === 0 ? 'mọi khối' : 'khối đã chọn'}`,
        },
      ]);
    }
  }

  async create(
    currentUser: CurrentUser,
    input: MenuHeaderInput & {
      org_unit_id: string;
      note: string | null;
      items: MenuItemInput[] | undefined;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertManage(currentUser, input.org_unit_id);
    const header = await this.header(database, input);
    await this.assertNoOverlap(database, input.org_unit_id, header, null);
    if (input.items) {
      await this.assertDishes(database, input.org_unit_id, input.items);
    }
    const items = input.items;
    const created = await database.transaction().execute(async (transaction) => {
      const menu = await conflictOnDuplicate(
        transaction
          .insertInto('menus')
          .values({ org_unit_id: input.org_unit_id, note: input.note, ...header, created_by: origin.actorUserId })
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Đơn vị đã có thực đơn của tuần này cho khối này',
        'week_start_date',
      );
      if (items && items.length > 0) {
        await transaction
          .insertInto('menu_items')
          .values(items.map((item) => ({ ...item, menu_id: menu.id })))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'menus',
        entityId: menu.id,
        action: 'create',
        before: null,
        after: { ...menu, items: items ?? [] },
      });
      return menu;
    });
    return this.detailOf(database, created.id);
  }

  // "Thay đổi" thông tin chung của thực đơn nháp (4.5): tên, tháng, tuần, từ ngày–đến ngày, khối áp dụng. Đổi sang tuần
  // khác thì món giữ theo thứ trong tuần
  async updateHeader(currentUser: CurrentUser, menuId: string, input: MenuHeaderInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const menu = await this.findMenu(database, menuId);
    await this.access.assertManage(currentUser, menu.org_unit_id);
    if (menu.status !== 'draft') {
      throw ruleViolationError('BR-59', 'Chỉ sửa được thực đơn nháp; thực đơn đã trình hoặc đã công bố không sửa');
    }
    const header = await this.header(database, {
      ...input,
      name: input.name ?? menu.name,
      from_date: input.from_date ?? menu.from_date ?? menu.week_start_date,
      grade_levels: input.grade_levels ?? (input.age_group ? null : menu.grade_levels),
    });
    await this.assertNoOverlap(database, menu.org_unit_id, header, menuId);
    await database.transaction().execute(async (transaction) => {
      const updated = await conflictOnDuplicate(
        transaction
          .updateTable('menus')
          .set({ ...header, updated_at: new Date() })
          .where('id', '=', menuId)
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Đơn vị đã có thực đơn của tuần này cho khối này',
        'week_start_date',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: menu.org_unit_id,
        entityName: 'menus',
        entityId: menuId,
        action: 'update',
        before: menu,
        after: updated,
      });
    });
    return this.detailOf(database, menuId);
  }

  async detail(currentUser: CurrentUser, menuId: string) {
    const { database } = await this.currentSchoolYear.require();
    const menu = await this.findMenu(database, menuId);
    await this.access.assertRead(currentUser, menu.org_unit_id);
    return this.detailOf(database, menuId);
  }

  // Thay toàn bộ món của thực đơn nháp
  async replaceItems(currentUser: CurrentUser, menuId: string, items: MenuItemInput[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const menu = await this.findMenu(database, menuId);
    await this.access.assertManage(currentUser, menu.org_unit_id);
    if (menu.status !== 'draft') {
      throw ruleViolationError('BR-59', 'Chỉ sửa được thực đơn nháp; thực đơn đã trình hoặc đã công bố không sửa');
    }
    await this.assertDishes(database, menu.org_unit_id, items);
    const before = await this.itemsOf(database, menuId);
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('menu_items').where('menu_id', '=', menuId).execute();
      if (items.length > 0) {
        await transaction
          .insertInto('menu_items')
          .values(items.map((item) => ({ ...item, menu_id: menuId })))
          .execute();
      }
      await transaction.updateTable('menus').set({ updated_at: new Date() }).where('id', '=', menuId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: menu.org_unit_id,
        entityName: 'menu_items',
        entityId: menuId,
        action: 'update',
        before,
        after: items,
      });
    });
    return this.detailOf(database, menuId);
  }

  // P12-03: bếp trình duyệt; quản lý đơn vị nhận thông báo
  async submit(currentUser: CurrentUser, menuId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const menu = await this.findMenu(database, menuId);
    await this.access.assertManage(currentUser, menu.org_unit_id);
    if (menu.status !== 'draft') {
      throw ruleViolationError('BR-59', 'Chỉ trình được thực đơn nháp');
    }
    if ((await this.itemsOf(database, menuId)).length === 0) {
      throw ruleViolationError('BR-59', 'Thực đơn chưa có món nào');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('menus')
        .set({ status: 'submitted', submitted_by: origin.actorUserId, submitted_at: this.clock.now() })
        .where('id', '=', menuId)
        .execute();
      await queueNotification(transaction, {
        orgUnitId: menu.org_unit_id,
        templateCode: 'menu_submitted',
        title: 'Thực đơn chờ duyệt',
        body: `Thực đơn tuần từ ${menu.week_start_date} chờ duyệt`,
        targetType: 'menus',
        targetId: menuId,
        recipients: [{ roleCode: 'VT-03', orgUnitId: menu.org_unit_id, channel: 'in_app' }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: menu.org_unit_id,
        entityName: 'menus',
        entityId: menuId,
        action: 'update',
        before: { status: 'draft' },
        after: { status: 'submitted' },
      });
    });
    return this.detailOf(database, menuId);
  }

  // P12-03, BR-59: quản lý đơn vị duyệt là công bố; phụ huynh của đơn vị nhận thông báo (phạm vi theo đơn vị, BR-69)
  async approve(currentUser: CurrentUser, menuId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const menu = await this.findMenu(database, menuId);
    await this.access.assert(
      currentUser,
      PERMISSION_CODES.menuApprove,
      menu.org_unit_id,
      'Bạn không có quyền duyệt thực đơn của đơn vị này',
    );
    if (menu.status !== 'submitted') {
      throw ruleViolationError('BR-59', 'Chỉ duyệt được thực đơn đã trình');
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('menus')
        .set({ status: 'published', approved_by: origin.actorUserId, approved_at: now, published_at: now })
        .where('id', '=', menuId)
        .execute();
      await queueNotification(transaction, {
        orgUnitId: menu.org_unit_id,
        templateCode: 'menu_published',
        title: 'Thực đơn tuần mới',
        body: `Đã có thực đơn tuần từ ${menu.week_start_date}`,
        targetType: 'menus',
        targetId: menuId,
        recipients: [
          { roleCode: 'VT-14', orgUnitId: menu.org_unit_id, channel: 'in_app' },
          { roleCode: 'VT-10', orgUnitId: menu.org_unit_id, channel: 'in_app' },
        ],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: menu.org_unit_id,
        entityName: 'menus',
        entityId: menuId,
        action: 'update',
        before: { status: 'submitted' },
        after: { status: 'published' },
      });
    });
    return this.detailOf(database, menuId);
  }

  async reject(currentUser: CurrentUser, menuId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const menu = await this.findMenu(database, menuId);
    await this.access.assert(
      currentUser,
      PERMISSION_CODES.menuApprove,
      menu.org_unit_id,
      'Bạn không có quyền duyệt thực đơn của đơn vị này',
    );
    if (menu.status !== 'submitted') {
      throw ruleViolationError('BR-59', 'Chỉ trả lại được thực đơn đã trình');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('menus')
        .set({ status: 'draft', reject_reason: reason })
        .where('id', '=', menuId)
        .execute();
      await queueNotification(transaction, {
        orgUnitId: menu.org_unit_id,
        templateCode: 'menu_rejected',
        title: 'Thực đơn bị trả lại',
        body: `Thực đơn tuần từ ${menu.week_start_date} bị trả lại: ${reason}`,
        targetType: 'menus',
        targetId: menuId,
        recipients: [{ roleCode: 'VT-10', orgUnitId: menu.org_unit_id, channel: 'in_app' }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: menu.org_unit_id,
        entityName: 'menus',
        entityId: menuId,
        action: 'update',
        before: { status: 'submitted' },
        after: { status: 'draft', reject_reason: reason },
      });
    });
    return this.detailOf(database, menuId);
  }

  // P12-04: định lượng nguyên liệu của thực đơn trong một ngày theo số suất; không gửi số suất thì lấy số suất của các
  // lớp dùng thực đơn này trong ngày (BR-60)
  async norms(currentUser: CurrentUser, menuId: string, date: string | null, servings: number | null) {
    const { database } = await this.currentSchoolYear.require();
    const menu = await this.findMenu(database, menuId);
    await this.access.assertRead(currentUser, menu.org_unit_id);
    const day = date ?? menu.week_start_date;
    if (day < menu.week_start_date || day > addDays(menu.week_start_date, 6)) {
      throw validationError([{ field: 'date', message: 'Ngày phải thuộc tuần của thực đơn' }]);
    }
    let count = servings;
    if (count === null) {
      const daily = await this.meals.dailyNorms(database, menu.org_unit_id, day);
      count = daily.menus.find((row) => row.menu_id === menuId)?.servings ?? 0;
    }
    const lines = await database
      .selectFrom('menu_items')
      .innerJoin('dishes', 'dishes.id', 'menu_items.dish_id')
      .innerJoin('ingredient_norms', 'ingredient_norms.dish_id', 'menu_items.dish_id')
      .innerJoin('ingredients', 'ingredients.id', 'ingredient_norms.ingredient_id')
      .select([
        'menu_items.meal_type',
        'dishes.name as dish_name',
        'ingredients.id as ingredient_id',
        'ingredients.name as ingredient_name',
        'ingredients.unit',
        'ingredients.current_stock',
        'ingredient_norms.quantity_per_serving',
      ])
      .where('menu_items.menu_id', '=', menuId)
      .where('menu_items.weekday', '=', dayOfWeek(day))
      .orderBy('menu_items.meal_type')
      .orderBy('dishes.name')
      .execute();
    const servingsCount = count;
    const totals = new Map<
      string,
      { ingredient_id: string; name: string; unit: string; current_stock: number; quantity: number }
    >();
    for (const line of lines) {
      const quantity = Number(line.quantity_per_serving) * servingsCount;
      const total = totals.get(line.ingredient_id) ?? {
        ingredient_id: line.ingredient_id,
        name: line.ingredient_name,
        unit: line.unit,
        current_stock: Number(line.current_stock),
        quantity: 0,
      };
      total.quantity += quantity;
      totals.set(line.ingredient_id, total);
    }
    return {
      menu_id: menuId,
      date: day,
      servings: servingsCount,
      lines: lines.map((line) => ({
        meal_type: line.meal_type,
        dish_name: line.dish_name,
        ingredient_id: line.ingredient_id,
        ingredient_name: line.ingredient_name,
        unit: line.unit,
        quantity_per_serving: Number(line.quantity_per_serving),
        quantity: Math.round(Number(line.quantity_per_serving) * servingsCount * 1000) / 1000,
      })),
      totals: [...totals.values()].map((total) => ({
        ...total,
        quantity: Math.round(total.quantity * 1000) / 1000,
        shortage: Math.max(0, Math.round((total.quantity - total.current_stock) * 1000) / 1000),
      })),
    };
  }

  // Thực đơn đã công bố và buffet đã duyệt của tuần cho phụ huynh của trẻ hoặc người xem dữ liệu bếp của đơn vị
  async childMenus(currentUser: CurrentUser, childId: string, weekStartDate: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const child = await database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['children.id', 'children.org_unit_id', 'classes.id as class_id', 'classes.grade_level'])
      .where('children.id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy hồ sơ trẻ', 'child');
    }
    if (
      !(await isGuardianOf(database, childId, currentUser.id)) &&
      !(await this.access.canRead(currentUser, child.org_unit_id))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phụ huynh của trẻ xem được thực đơn của con');
    }
    const week = weekStartOf(weekStartDate ?? this.meals.today());
    const menus = await database
      .selectFrom('menus')
      .select(['id', 'grade_levels'])
      .where('org_unit_id', '=', child.org_unit_id)
      .where('week_start_date', '=', week)
      .where('status', '=', 'published')
      .execute();
    const menu = menuForGrade(menus, child.grade_level);
    const buffets = await database
      .selectFrom('buffet_events')
      .select(['id', 'buffet_date', 'occasion', 'menu_note'])
      .where('org_unit_id', '=', child.org_unit_id)
      .where('status', '=', 'approved')
      .where('buffet_date', '>=', week)
      .where('buffet_date', '<=', addDays(week, 6))
      .where((expression) =>
        expression.or([
          expression('class_id', 'is', null),
          ...(child.class_id ? [expression('class_id', '=', child.class_id)] : []),
        ]),
      )
      .orderBy('buffet_date')
      .execute();
    return {
      child_id: childId,
      week_start_date: week,
      menu: menu ? await this.detailOf(database, menu.id) : null,
      buffets,
    };
  }

  async buffets(currentUser: CurrentUser, orgUnitId: string, from: string | null, to: string | null) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, orgUnitId);
    return database
      .selectFrom('buffet_events')
      .leftJoin('classes', 'classes.id', 'buffet_events.class_id')
      .select([
        'buffet_events.id',
        'buffet_events.org_unit_id',
        'buffet_events.buffet_date',
        'buffet_events.occasion',
        'buffet_events.class_id',
        'classes.name as class_name',
        'buffet_events.menu_note',
        'buffet_events.status',
        'buffet_events.approved_at',
      ])
      .where('buffet_events.org_unit_id', '=', orgUnitId)
      .$if(from !== null, (query) => query.where('buffet_events.buffet_date', '>=', from ?? ''))
      .$if(to !== null, (query) => query.where('buffet_events.buffet_date', '<=', to ?? ''))
      .orderBy('buffet_events.buffet_date', 'desc')
      .execute();
  }

  // P12-06, BR-83: buffet theo dịp nằm trong tiền ăn, không đăng ký, không thu riêng; bếp hoặc quản lý đơn vị lập
  async createBuffet(
    currentUser: CurrentUser,
    input: { org_unit_id: string; buffet_date: string; occasion: string; class_id: string | null; menu_note: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    if (
      !(await this.access.can(currentUser, PERMISSION_CODES.kitchenManage, input.org_unit_id)) &&
      !(await this.access.can(currentUser, PERMISSION_CODES.menuApprove, input.org_unit_id))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền lập buffet của đơn vị này');
    }
    if (input.buffet_date < this.meals.today()) {
      throw validationError([{ field: 'buffet_date', message: 'Ngày tổ chức không trước hôm nay' }]);
    }
    if (input.class_id) {
      const classRow = await database
        .selectFrom('classes')
        .select('org_unit_id')
        .where('id', '=', input.class_id)
        .executeTakeFirst();
      if (!classRow || classRow.org_unit_id !== input.org_unit_id) {
        throw validationError([{ field: 'class_id', message: 'Lớp phải thuộc đơn vị' }]);
      }
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('buffet_events')
        .values({ ...input, created_by: origin.actorUserId })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'buffet_events',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async decideBuffet(currentUser: CurrentUser, buffetId: string, decision: 'approve' | 'cancel', origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const buffet = await database.selectFrom('buffet_events').selectAll().where('id', '=', buffetId).executeTakeFirst();
    if (!buffet) {
      throw notFoundError('Không tìm thấy buffet', 'buffet_event');
    }
    const canApprove = await this.access.can(currentUser, PERMISSION_CODES.menuApprove, buffet.org_unit_id);
    if (
      decision === 'approve'
        ? !canApprove
        : !canApprove && !(await this.access.can(currentUser, PERMISSION_CODES.kitchenManage, buffet.org_unit_id))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền với buffet của đơn vị này');
    }
    if (decision === 'approve' ? buffet.status !== 'draft' : buffet.status === 'cancelled') {
      throw ruleViolationError('P12-06', decision === 'approve' ? 'Chỉ duyệt được buffet nháp' : 'Buffet đã hủy');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('buffet_events')
        .set(
          decision === 'approve'
            ? { status: 'approved', approved_by: origin.actorUserId, approved_at: this.clock.now() }
            : { status: 'cancelled' },
        )
        .where('id', '=', buffetId)
        .returningAll()
        .executeTakeFirstOrThrow();
      if (decision === 'approve') {
        await queueNotification(transaction, {
          orgUnitId: buffet.org_unit_id,
          templateCode: 'buffet_approved',
          title: 'Tiệc buffet',
          body: `${buffet.occasion} ngày ${buffet.buffet_date}: ${buffet.menu_note}`,
          targetType: 'buffet_events',
          targetId: buffetId,
          recipients: [{ roleCode: 'VT-14', orgUnitId: buffet.org_unit_id, channel: 'in_app' }],
        });
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: buffet.org_unit_id,
        entityName: 'buffet_events',
        entityId: buffetId,
        action: 'update',
        before: { status: buffet.status },
        after: { status: updated.status },
      });
      return updated;
    });
  }

  private async findMenu(database: Kysely<SchoolYearDatabase>, menuId: string) {
    const menu = await database.selectFrom('menus').selectAll().where('id', '=', menuId).executeTakeFirst();
    if (!menu) {
      throw notFoundError('Không tìm thấy thực đơn', 'menu');
    }
    return menu;
  }

  private async itemsOf(database: Kysely<SchoolYearDatabase>, menuId: string) {
    return database
      .selectFrom('menu_items')
      .innerJoin('dishes', 'dishes.id', 'menu_items.dish_id')
      .select([
        'menu_items.id',
        'menu_items.weekday',
        'menu_items.meal_type',
        'menu_items.dish_id',
        'dishes.name as dish_name',
        'dishes.group_name',
        'menu_items.note',
      ])
      .where('menu_items.menu_id', '=', menuId)
      .orderBy('menu_items.weekday')
      .orderBy('menu_items.meal_type')
      .orderBy('dishes.name')
      .execute();
  }

  private async detailOf(database: Kysely<SchoolYearDatabase>, menuId: string) {
    const menu = await this.findMenu(database, menuId);
    return {
      id: menu.id,
      org_unit_id: menu.org_unit_id,
      week_start_date: menu.week_start_date,
      age_group: menu.age_group,
      name: menu.name,
      month: menu.month,
      week_no: menu.week_no,
      from_date: menu.from_date,
      to_date: menu.to_date,
      grade_levels: menu.grade_levels,
      status: menu.status,
      note: menu.note,
      reject_reason: menu.reject_reason,
      submitted_at: menu.submitted_at,
      approved_at: menu.approved_at,
      published_at: menu.published_at,
      items: (await this.itemsOf(database, menuId)).map((item) => ({
        ...item,
        meal_label: MEAL_LABELS[item.meal_type],
      })),
    };
  }

  async assertDishes(database: Kysely<SchoolYearDatabase>, orgUnitId: string, items: MenuItemInput[]) {
    if (items.length === 0) {
      return;
    }
    const ids = [...new Set(items.map((item) => item.dish_id))];
    const found = await database
      .selectFrom('dishes')
      .select('id')
      .where('id', 'in', ids)
      .where('org_unit_id', '=', orgUnitId)
      .where('status', '=', 'active')
      .execute();
    if (found.length !== ids.length) {
      throw validationError([{ field: 'items', message: 'Món phải thuộc đơn vị của thực đơn và đang dùng' }]);
    }
  }
}

function readItems(body: RequestBody, errors: FieldError[]): MenuItemInput[] | undefined {
  const value = body?.items;
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length > MAXIMUM_ITEMS) {
    errors.push({ field: 'items', message: `Thực đơn tối đa ${MAXIMUM_ITEMS} món` });
    return undefined;
  }
  const items: MenuItemInput[] = [];
  value.forEach((item: RequestBody, index) => {
    const weekday = item?.weekday;
    const mealType = item?.meal_type as MealType;
    if (typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 1 || weekday > 6) {
      errors.push({ field: `items.${index}.weekday`, message: 'Thứ trong tuần từ 1 (thứ hai) đến 6 (thứ bảy)' });
      return;
    }
    if (!MEAL_TYPES.includes(mealType)) {
      errors.push({ field: `items.${index}.meal_type`, message: 'Bữa là breakfast, lunch hoặc snack' });
      return;
    }
    const dishId = readRequiredUuid(item, 'dish_id', errors, `Dòng ${index + 1}: chọn món`);
    if (dishId) {
      items.push({ weekday, meal_type: mealType, dish_id: dishId, note: readText(item, 'note', errors) });
    }
  });
  const keys = items.map((item) => `${item.weekday}:${item.meal_type}:${item.dish_id}`);
  if (new Set(keys).size !== keys.length) {
    errors.push({ field: 'items', message: 'Một món chỉ một lần trong cùng bữa của ngày' });
  }
  return items;
}

@Controller()
export class KitchenMenusController {
  constructor(private readonly menus: KitchenMenusService) {}

  @Get('menus')
  list(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.menus.list(
      currentUser,
      queryUuid(query.org_unit_id, 'org_unit_id', true) ?? '',
      queryDate(query.week_start_date, 'week_start_date'),
      typeof query.month === 'string' && query.month !== '' ? query.month : null,
    );
  }

  @Post('menus')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      ...readMenuHeader(body, errors),
      note: readText(body, 'note', errors),
      items: readItems(body, errors),
    };
    check(errors);
    return this.menus.create(currentUser, input, originOf(request, currentUser));
  }

  @Get('menus/:id')
  detail(
    @Param('id', uuidParameter('Mã thực đơn không hợp lệ')) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.menus.detail(currentUser, id);
  }

  @Put('menus/:id')
  updateHeader(
    @Param('id', uuidParameter('Mã thực đơn không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readMenuHeader(body, errors);
    check(errors);
    return this.menus.updateHeader(currentUser, id, input, originOf(request, currentUser));
  }

  @Put('menus/:id/items')
  replaceItems(
    @Param('id', uuidParameter('Mã thực đơn không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const items = readItems(body, errors);
    if (items === undefined && errors.length === 0) {
      errors.push({ field: 'items', message: 'Bắt buộc gửi danh sách món' });
    }
    check(errors);
    return this.menus.replaceItems(currentUser, id, items ?? [], originOf(request, currentUser));
  }

  @Post('menus/:id/submit')
  @HttpCode(200)
  submit(
    @Param('id', uuidParameter('Mã thực đơn không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.menus.submit(currentUser, id, originOf(request, currentUser));
  }

  @Post('menus/:id/approve')
  @HttpCode(200)
  approve(
    @Param('id', uuidParameter('Mã thực đơn không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.menus.approve(currentUser, id, originOf(request, currentUser));
  }

  @Post('menus/:id/reject')
  @HttpCode(200)
  reject(
    @Param('id', uuidParameter('Mã thực đơn không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readText(body, 'reason', errors, true) ?? '';
    check(errors);
    return this.menus.reject(currentUser, id, reason, originOf(request, currentUser));
  }

  @Get('menus/:id/norms')
  norms(
    @Param('id', uuidParameter('Mã thực đơn không hợp lệ')) id: string,
    @Query() query: Record<string, unknown>,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    let servings: number | null = null;
    if (query.servings !== undefined && query.servings !== '') {
      servings = Number(query.servings);
      if (!Number.isInteger(servings) || servings < 0 || servings > 5000) {
        throw validationError([{ field: 'servings', message: 'Số suất là số nguyên từ 0 đến 5000' }]);
      }
    }
    return this.menus.norms(currentUser, id, queryDate(query.date, 'date'), servings);
  }

  @Get('children/:id/menus')
  childMenus(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Query('week_start_date') weekStartDate: unknown,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.menus.childMenus(currentUser, childId, queryDate(weekStartDate, 'week_start_date'));
  }

  @Get('buffet-events')
  buffets(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.menus.buffets(
      currentUser,
      queryUuid(query.org_unit_id, 'org_unit_id', true) ?? '',
      queryDate(query.from, 'from'),
      queryDate(query.to, 'to'),
    );
  }

  @Post('buffet-events')
  @HttpCode(201)
  createBuffet(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      buffet_date: readDate(body, 'buffet_date', errors, true) ?? '',
      occasion: readText(body, 'occasion', errors, true) ?? '',
      class_id: readOptionalUuid(body, 'class_id', errors) ?? null,
      menu_note: readText(body, 'menu_note', errors, true) ?? '',
    };
    check(errors);
    return this.menus.createBuffet(currentUser, input, originOf(request, currentUser));
  }

  @Post('buffet-events/:id/approve')
  @HttpCode(200)
  approveBuffet(
    @Param('id', uuidParameter('Mã buffet không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.menus.decideBuffet(currentUser, id, 'approve', originOf(request, currentUser));
  }

  @Post('buffet-events/:id/cancel')
  @HttpCode(200)
  cancelBuffet(
    @Param('id', uuidParameter('Mã buffet không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.menus.decideBuffet(currentUser, id, 'cancel', originOf(request, currentUser));
  }
}
