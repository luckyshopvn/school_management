import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { AttendanceStatus, SchoolYearDatabase } from '@school-management/database';
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
import { SchoolCalendar, VIETNAM_DATE, dayOfWeek } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError, readRequiredInteger, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { KitchenAccess } from './kitchen-access.js';
import { MEAL_TYPES, addDays, check, queryDate, queryUuid, readDate, readText, weekStartOf } from './kitchen-fields.js';

// Suất ăn theo ngày, báo cơm, định lượng của ngày, báo cáo ăn và bếp (P12-04, P12-05, P12-07, P17-08; BR-58, BR-60;
// YCTD-76). Số suất của một lớp trong ngày lấy theo thứ tự: điểm danh đã chốt; nếu chưa chốt thì báo cơm của giáo viên
// chủ nhiệm; nếu chưa báo cơm thì số trẻ có mặt đã lưu trên bảng điểm danh. Ba bữa sáng, trưa, xế cùng một số suất
// (BR-58). Chốt điểm danh xong thì số suất theo điểm danh, báo cơm không còn tác dụng
const MEAL_STATUSES: AttendanceStatus[] = ['present', 'late', 'early_leave', 'late_and_early_leave'];
const MAXIMUM_REPORT_DAYS = 62;

export type ClassMealSource = 'attendance_locked' | 'meal_report' | 'attendance_open';

export interface ClassMealCount {
  class_id: string;
  class_name: string;
  grade_level: string;
  enrolled_count: number;
  day_locked: boolean;
  attendance_meal_count: number;
  meal_report_headcount: number | null;
  source: ClassMealSource;
  headcount: number;
}

@Injectable()
export class KitchenMealsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: KitchenAccess,
    private readonly calendar: SchoolCalendar,
    private readonly clock: Clock,
  ) {}

  today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // Số suất từng lớp đang hoạt động của đơn vị trong ngày
  async classCounts(database: Kysely<SchoolYearDatabase>, orgUnitId: string, date: string): Promise<ClassMealCount[]> {
    const classes = await database
      .selectFrom('classes')
      .select(['id', 'name', 'grade_level'])
      .where('org_unit_id', '=', orgUnitId)
      .where('status', '=', 'active')
      .orderBy('name')
      .execute();
    if (classes.length === 0) {
      return [];
    }
    const classIds = classes.map((row) => row.id);
    const enrolled = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select(['class_enrollments.class_id', (expression) => expression.fn.countAll<string>().as('count')])
      .where('class_enrollments.class_id', 'in', classIds)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .groupBy('class_enrollments.class_id')
      .execute();
    const present = await database
      .selectFrom('attendance_records')
      .select(['class_id', (expression) => expression.fn.countAll<string>().as('count')])
      .where('class_id', 'in', classIds)
      .where('attendance_date', '=', date)
      .where('status', 'in', MEAL_STATUSES)
      .groupBy('class_id')
      .execute();
    const locked = await database
      .selectFrom('attendance_days')
      .select('class_id')
      .where('class_id', 'in', classIds)
      .where('attendance_date', '=', date)
      .where('status', '=', 'locked')
      .execute();
    const reports = await database
      .selectFrom('meal_reports')
      .select(['class_id', 'headcount'])
      .where('class_id', 'in', classIds)
      .where('report_date', '=', date)
      .execute();
    return classes.map((classRow) => {
      const dayLocked = locked.some((row) => row.class_id === classRow.id);
      const attendanceMealCount = Number(present.find((row) => row.class_id === classRow.id)?.count ?? 0);
      const report = reports.find((row) => row.class_id === classRow.id);
      const source: ClassMealSource = dayLocked ? 'attendance_locked' : report ? 'meal_report' : 'attendance_open';
      return {
        class_id: classRow.id,
        class_name: classRow.name,
        grade_level: classRow.grade_level,
        enrolled_count: Number(enrolled.find((row) => row.class_id === classRow.id)?.count ?? 0),
        day_locked: dayLocked,
        attendance_meal_count: attendanceMealCount,
        meal_report_headcount: report?.headcount ?? null,
        source,
        headcount: source === 'meal_report' ? (report?.headcount ?? 0) : attendanceMealCount,
      };
    });
  }

  // P12-05: số suất của ngày tính tại thời điểm xem, kèm số đã lưu gần nhất
  async mealPlan(currentUser: CurrentUser, orgUnitId: string, date: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, orgUnitId);
    const classes = await this.classCounts(database, orgUnitId, date);
    const headcount = classes.reduce((sum, row) => sum + row.headcount, 0);
    const allLocked = classes.every((row) => row.day_locked);
    const stored = await database
      .selectFrom('meal_plans')
      .select(['meal_type', 'headcount', 'computed_from', 'status', 'computed_at'])
      .where('org_unit_id', '=', orgUnitId)
      .where('meal_date', '=', date)
      .execute();
    return {
      org_unit_id: orgUnitId,
      date,
      headcount,
      meals: MEAL_TYPES.map((mealType) => ({ meal_type: mealType, headcount })),
      status: allLocked ? ('final' as const) : ('provisional' as const),
      computed_from: allLocked ? ('attendance' as const) : ('mixed' as const),
      classes,
      stored: MEAL_TYPES.map((mealType) => stored.find((row) => row.meal_type === mealType) ?? null).filter(
        (row) => row !== null,
      ),
    };
  }

  // Lưu số suất của ngày cho ba bữa; bếp và kế toán dùng cùng một con số (BR-58)
  async computeMealPlan(currentUser: CurrentUser, orgUnitId: string, date: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertManage(currentUser, orgUnitId);
    if (date > this.today()) {
      throw validationError([{ field: 'date', message: 'Chỉ tính suất ăn cho hôm nay hoặc ngày đã qua' }]);
    }
    await this.calendar.assertSchoolDay(date);
    const plan = await this.mealPlan(currentUser, orgUnitId, date);
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      for (const mealType of MEAL_TYPES) {
        await transaction
          .insertInto('meal_plans')
          .values({
            org_unit_id: orgUnitId,
            meal_date: date,
            meal_type: mealType,
            headcount: plan.headcount,
            computed_from: plan.computed_from,
            status: plan.status,
            computed_by: origin.actorUserId,
            computed_at: now,
          })
          .onConflict((conflict) =>
            conflict.columns(['org_unit_id', 'meal_date', 'meal_type']).doUpdateSet({
              headcount: plan.headcount,
              computed_from: plan.computed_from,
              status: plan.status,
              computed_by: origin.actorUserId,
              computed_at: now,
            }),
          )
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'meal_plans',
        entityId: orgUnitId,
        action: 'update',
        before: plan.stored,
        after: { date, headcount: plan.headcount, status: plan.status, computed_from: plan.computed_from },
      });
    });
    return this.mealPlan(currentUser, orgUnitId, date);
  }

  // P12-04: nhu cầu nguyên liệu của ngày từ các thực đơn đã công bố của tuần và số suất từng lớp. Lớp dùng thực đơn đúng
  // độ tuổi (mã khối của lớp), không có thì dùng thực đơn chung (age_group = all)
  async dailyNorms(database: Kysely<SchoolYearDatabase>, orgUnitId: string, date: string) {
    const weekday = dayOfWeek(date);
    const menus = await database
      .selectFrom('menus')
      .select(['id', 'age_group'])
      .where('org_unit_id', '=', orgUnitId)
      .where('week_start_date', '=', weekStartOf(date))
      .where('status', '=', 'published')
      .execute();
    const classes = await this.classCounts(database, orgUnitId, date);
    const servings = new Map<string, number>();
    const classesWithoutMenu: string[] = [];
    for (const classRow of classes) {
      const menu =
        menus.find((row) => row.age_group === classRow.grade_level) ?? menus.find((row) => row.age_group === 'all');
      if (!menu) {
        classesWithoutMenu.push(classRow.class_name);
        continue;
      }
      servings.set(menu.id, (servings.get(menu.id) ?? 0) + classRow.headcount);
    }
    const required = new Map<string, number>();
    const menuIds = [...servings.keys()];
    if (menuIds.length > 0) {
      const lines = await database
        .selectFrom('menu_items')
        .innerJoin('ingredient_norms', 'ingredient_norms.dish_id', 'menu_items.dish_id')
        .select(['menu_items.menu_id', 'ingredient_norms.ingredient_id', 'ingredient_norms.quantity_per_serving'])
        .where('menu_items.menu_id', 'in', menuIds)
        .where('menu_items.weekday', '=', weekday)
        .execute();
      for (const line of lines) {
        const quantity = Number(line.quantity_per_serving) * (servings.get(line.menu_id) ?? 0);
        required.set(line.ingredient_id, (required.get(line.ingredient_id) ?? 0) + quantity);
      }
    }
    const ingredients =
      required.size === 0
        ? []
        : await database
            .selectFrom('ingredients')
            .select(['id', 'code', 'name', 'unit', 'current_stock'])
            .where('id', 'in', [...required.keys()])
            .orderBy('name')
            .execute();
    return {
      org_unit_id: orgUnitId,
      date,
      menus: menus
        .filter((menu) => servings.has(menu.id))
        .map((menu) => ({ menu_id: menu.id, age_group: menu.age_group, servings: servings.get(menu.id) ?? 0 })),
      classes_without_menu: classesWithoutMenu,
      ingredients: ingredients.map((row) => ({
        ingredient_id: row.id,
        code: row.code,
        name: row.name,
        unit: row.unit,
        current_stock: Number(row.current_stock),
        required_quantity: Math.round((required.get(row.id) ?? 0) * 1000) / 1000,
      })),
    };
  }

  async dailyNormsFor(currentUser: CurrentUser, orgUnitId: string, date: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, orgUnitId);
    return this.dailyNorms(database, orgUnitId, date);
  }

  // P12-07: thông tin báo cơm của lớp trong ngày cho giáo viên và bếp
  async mealReport(currentUser: CurrentUser, classId: string, date: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    if (
      !(await this.isHomeroom(database, currentUser, classId)) &&
      !(await this.access.canRead(currentUser, classRow.org_unit_id))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không phụ trách lớp này');
    }
    const counts = (await this.classCounts(database, classRow.org_unit_id, date)).find(
      (row) => row.class_id === classId,
    );
    const report = await database
      .selectFrom('meal_reports')
      .select(['id', 'report_date', 'headcount', 'note', 'reported_at'])
      .where('class_id', '=', classId)
      .where('report_date', '=', date)
      .executeTakeFirst();
    return {
      class_id: classId,
      class_name: classRow.name,
      date,
      enrolled_count: counts?.enrolled_count ?? 0,
      attendance_meal_count: counts?.attendance_meal_count ?? 0,
      day_locked: counts?.day_locked ?? false,
      report: report ?? null,
      headcount: counts?.headcount ?? 0,
      source: counts?.source ?? 'attendance_open',
    };
  }

  // Giáo viên chủ nhiệm báo cơm của lớp mình khi chưa chốt điểm danh; báo lại thì ghi đè (P12-07, BR-58)
  async submitMealReport(
    currentUser: CurrentUser,
    classId: string,
    input: { date: string | null; headcount: number; note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.findClass(database, classId);
    if (
      !currentUser.hasPermission(PERMISSION_CODES.mealReportSubmit) ||
      !(await this.isHomeroom(database, currentUser, classId))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên chủ nhiệm của lớp báo cơm được');
    }
    const date = input.date ?? this.today();
    if (date > this.today()) {
      throw validationError([{ field: 'date', message: 'Chỉ báo cơm cho hôm nay hoặc ngày đã qua' }]);
    }
    await this.calendar.assertSchoolDay(date);
    const counts = (await this.classCounts(database, classRow.org_unit_id, date)).find(
      (row) => row.class_id === classId,
    );
    if (counts?.day_locked) {
      throw ruleViolationError('BR-58', 'Điểm danh của lớp đã chốt, số suất lấy theo điểm danh');
    }
    if (input.headcount > (counts?.enrolled_count ?? 0)) {
      throw ruleViolationError('BR-58', `Số suất không quá sĩ số đang học của lớp (${counts?.enrolled_count ?? 0})`);
    }
    return database.transaction().execute(async (transaction) => {
      const saved = await transaction
        .insertInto('meal_reports')
        .values({
          class_id: classId,
          org_unit_id: classRow.org_unit_id,
          report_date: date,
          headcount: input.headcount,
          note: input.note,
          reported_by: origin.actorUserId,
          reported_at: this.clock.now(),
        })
        .onConflict((conflict) =>
          conflict.columns(['class_id', 'report_date']).doUpdateSet({
            headcount: input.headcount,
            note: input.note,
            reported_by: origin.actorUserId,
            reported_at: this.clock.now(),
          }),
        )
        .returningAll()
        .executeTakeFirstOrThrow();
      await queueNotification(transaction, {
        orgUnitId: classRow.org_unit_id,
        templateCode: 'meal_report',
        title: 'Báo cơm',
        body: `Lớp ${classRow.name} báo ${input.headcount} suất ngày ${date}`,
        targetType: 'meal_reports',
        targetId: saved.id,
        recipients: [{ roleCode: 'VT-10', orgUnitId: classRow.org_unit_id, channel: 'in_app' }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRow.org_unit_id,
        entityName: 'meal_reports',
        entityId: saved.id,
        action: 'update',
        before: counts?.meal_report_headcount === null ? null : { headcount: counts?.meal_report_headcount },
        after: saved,
      });
      return saved;
    });
  }

  // P17-08: đối chiếu số suất đã lưu của từng ngày với điểm danh đã chốt (CT-081) và chi phí đi chợ theo kỳ
  async report(currentUser: CurrentUser, orgUnitId: string, from: string, to: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assert(
      currentUser,
      PERMISSION_CODES.kitchenReport,
      orgUnitId,
      'Bạn không được xem báo cáo ăn và bếp của đơn vị này',
    );
    if (to < from || addDays(from, MAXIMUM_REPORT_DAYS - 1) < to) {
      throw validationError([{ field: 'to', message: `Kỳ báo cáo từ 1 đến ${MAXIMUM_REPORT_DAYS} ngày` }]);
    }
    const attendance = await database
      .selectFrom('attendance_records')
      .innerJoin('classes', 'classes.id', 'attendance_records.class_id')
      .leftJoin('attendance_days', (join) =>
        join
          .onRef('attendance_days.class_id', '=', 'attendance_records.class_id')
          .onRef('attendance_days.attendance_date', '=', 'attendance_records.attendance_date'),
      )
      .select([
        'attendance_records.attendance_date',
        'attendance_records.class_id',
        'attendance_records.status',
        'attendance_days.status as day_status',
      ])
      .where('classes.org_unit_id', '=', orgUnitId)
      .where('attendance_records.attendance_date', '>=', from)
      .where('attendance_records.attendance_date', '<=', to)
      .execute();
    const plans = await database
      .selectFrom('meal_plans')
      .select(['meal_date', 'headcount', 'status', 'computed_at'])
      .where('org_unit_id', '=', orgUnitId)
      .where('meal_type', '=', 'lunch')
      .where('meal_date', '>=', from)
      .where('meal_date', '<=', to)
      .execute();
    const dates = [...new Set([...attendance.map((row) => row.attendance_date), ...plans.map((row) => row.meal_date)])];
    dates.sort();
    const days = dates.map((date) => {
      const records = attendance.filter((row) => row.attendance_date === date);
      const classIds = [...new Set(records.map((row) => row.class_id))];
      const lockedClassIds = new Set(records.filter((row) => row.day_status === 'locked').map((row) => row.class_id));
      const lockedMealCount = records.filter(
        (row) => row.day_status === 'locked' && MEAL_STATUSES.includes(row.status),
      ).length;
      const absentCount = records.filter((row) => !MEAL_STATUSES.includes(row.status)).length;
      const plan = plans.find((row) => row.meal_date === date);
      const allLocked = classIds.length > 0 && classIds.every((id) => lockedClassIds.has(id));
      return {
        date,
        class_count: classIds.length,
        locked_class_count: lockedClassIds.size,
        attendance_locked: allLocked,
        attendance_meal_count: lockedMealCount,
        absent_count: absentCount,
        meal_headcount: plan?.headcount ?? null,
        meal_plan_status: plan?.status ?? null,
        // Khớp khi đã lưu số suất, mọi lớp có điểm danh đã chốt và số suất bằng số trẻ có mặt theo điểm danh đã chốt
        matched: plan && allLocked ? plan.headcount === lockedMealCount : null,
      };
    });
    const purchases = await database
      .selectFrom('market_purchases')
      .innerJoin('food_suppliers', 'food_suppliers.id', 'market_purchases.supplier_id')
      .select([
        'market_purchases.supplier_id',
        'food_suppliers.name as supplier_name',
        'market_purchases.total_amount',
        'market_purchases.payment_status',
      ])
      .where('market_purchases.org_unit_id', '=', orgUnitId)
      .where('market_purchases.status', '=', 'received')
      .where('market_purchases.purchase_date', '>=', from)
      .where('market_purchases.purchase_date', '<=', to)
      .execute();
    const sum = (rows: typeof purchases) => rows.reduce((total, row) => total + Number(row.total_amount), 0);
    const suppliers = [...new Set(purchases.map((row) => row.supplier_id))].map((supplierId) => {
      const rows = purchases.filter((row) => row.supplier_id === supplierId);
      return {
        supplier_id: supplierId,
        supplier_name: rows[0]?.supplier_name ?? '',
        count: rows.length,
        amount: sum(rows),
      };
    });
    const totalServings = days.reduce((total, day) => total + (day.meal_headcount ?? 0), 0);
    return {
      org_unit_id: orgUnitId,
      from,
      to,
      days,
      total_meal_days: totalServings,
      mismatched_days: days.filter((day) => day.matched === false).map((day) => day.date),
      purchases: {
        count: purchases.length,
        total_amount: sum(purchases),
        awaiting_payment_amount: sum(purchases.filter((row) => row.payment_status === 'awaiting_payment')),
        paid_amount: sum(purchases.filter((row) => row.payment_status === 'paid')),
        by_supplier: suppliers,
      },
      // Chi phí nguyên liệu trên một ngày suất (ba bữa) của kỳ, làm tròn đồng
      cost_per_meal_day: totalServings > 0 ? Math.round(sum(purchases) / totalServings) : null,
    };
  }

  private async findClass(database: Kysely<SchoolYearDatabase>, classId: string) {
    const classRow = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'name', 'status'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRow) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    return classRow;
  }

  private async isHomeroom(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser, classId: string) {
    const row = await database
      .selectFrom('class_staff_assignments')
      .select('id')
      .where('class_id', '=', classId)
      .where('staff_user_id', '=', currentUser.id)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .executeTakeFirst();
    return row !== undefined;
  }
}

@Controller()
export class KitchenMealsController {
  constructor(private readonly meals: KitchenMealsService) {}

  @Get('meal-plans')
  mealPlan(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.meals.mealPlan(
      currentUser,
      queryUuid(query.org_unit_id, 'org_unit_id', true) ?? '',
      queryDate(query.date, 'date') ?? this.meals.today(),
    );
  }

  @Post('meal-plans/compute')
  @HttpCode(200)
  compute(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const date = readDate(body, 'date', errors, true) ?? '';
    check(errors);
    return this.meals.computeMealPlan(currentUser, orgUnitId, date, originOf(request, currentUser));
  }

  @Get('kitchen/daily-norms')
  dailyNorms(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.meals.dailyNormsFor(
      currentUser,
      queryUuid(query.org_unit_id, 'org_unit_id', true) ?? '',
      queryDate(query.date, 'date') ?? this.meals.today(),
    );
  }

  @Get('classes/:id/meal-report')
  mealReport(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Query('date') date: unknown,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.meals.mealReport(currentUser, classId, queryDate(date, 'date') ?? this.meals.today());
  }

  @Post('classes/:id/meal-report')
  @HttpCode(200)
  submitMealReport(
    @Param('id', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      date: readDate(body, 'date', errors, false),
      headcount: readRequiredInteger(body, 'headcount', errors, { min: 0, max: 200 }),
      note: readText(body, 'note', errors),
    };
    check(errors);
    return this.meals.submitMealReport(currentUser, classId, input, originOf(request, currentUser));
  }

  @Get('reports/meals')
  report(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    const today = this.meals.today();
    return this.meals.report(
      currentUser,
      queryUuid(query.org_unit_id, 'org_unit_id', true) ?? '',
      queryDate(query.from, 'from') ?? `${today.slice(0, 7)}-01`,
      queryDate(query.to, 'to') ?? today,
    );
  }
}
