import { MEAL_SERVICE_ID, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely, Transaction } from 'kysely';

// Danh sách ăn bán trú của lớp ngoài Mầm non (DT-20 phần 20b, YCTD-159). Hàm thuần đọc dữ liệu, dùng chung cho màn hình bán
// trú, số suất của bếp và tiền ăn: học sinh đang học lớp, đăng ký dịch vụ bán trú của tháng (từ ngày bắt đầu dịch vụ nếu có),
// trừ học sinh báo cắt suất của ngày. Ngày đã chốt thì số suất chính thức là số lưu lúc chốt
export const BOARDING_RULE_CODE = 'YCTD-159';
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export interface RosterChild {
  child_id: string;
  full_name: string;
  cut: { reason: string | null; source: string; created_by_name: string } | null;
}

function periodOf(date: string): { year: number; month: number } {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

// Học sinh đăng ký bán trú của các lớp trong ngày (theo lớp)
export async function registeredChildren(
  database: Executor,
  classIds: string[],
  date: string,
): Promise<Array<{ child_id: string; class_id: string; full_name: string }>> {
  if (classIds.length === 0) {
    return [];
  }
  const period = periodOf(date);
  return database
    .selectFrom('class_enrollments')
    .innerJoin('children', 'children.id', 'class_enrollments.child_id')
    .innerJoin('service_registrations', 'service_registrations.child_id', 'children.id')
    .select(['children.id as child_id', 'class_enrollments.class_id', 'children.full_name'])
    .where('class_enrollments.class_id', 'in', classIds)
    .where('class_enrollments.is_current', '=', true)
    .where('children.status', '=', 'active')
    .where('children.deleted_at', 'is', null)
    .where('service_registrations.service_id', '=', MEAL_SERVICE_ID)
    // Đang chờ duyệt hủy vẫn ăn và vẫn thu như tính học phí
    .where('service_registrations.status', 'in', ['active', 'pending_cancel'])
    .where('service_registrations.period_year', '=', period.year)
    .where('service_registrations.period_month', '=', period.month)
    .where((expression) =>
      expression.or([
        expression('service_registrations.service_start_date', 'is', null),
        expression('service_registrations.service_start_date', '<=', date),
      ]),
    )
    .orderBy('children.full_name')
    .execute();
}

// Danh sách ăn của một lớp trong ngày kèm cắt suất
export async function classRoster(database: Executor, classId: string, date: string): Promise<RosterChild[]> {
  const [registered, cuts] = await Promise.all([
    registeredChildren(database, [classId], date),
    database
      .selectFrom('boarding_meal_cuts')
      .select(['child_id', 'reason', 'source', 'created_by_name'])
      .where('class_id', '=', classId)
      .where('meal_date', '=', date)
      .execute(),
  ]);
  return registered.map((child) => {
    const cut = cuts.find((row) => row.child_id === child.child_id);
    return {
      child_id: child.child_id,
      full_name: child.full_name,
      cut: cut ? { reason: cut.reason, source: cut.source, created_by_name: cut.created_by_name } : null,
    };
  });
}

// Số suất bán trú của các lớp trong ngày: ngày đã chốt lấy số lưu lúc chốt, chưa chốt thì tính đăng ký trừ cắt suất
export async function boardingHeadcounts(
  database: Executor,
  classIds: string[],
  date: string,
): Promise<Map<string, { headcount: number; closed: boolean }>> {
  const result = new Map<string, { headcount: number; closed: boolean }>();
  if (classIds.length === 0) {
    return result;
  }
  const [registered, cuts, days] = await Promise.all([
    registeredChildren(database, classIds, date),
    database
      .selectFrom('boarding_meal_cuts')
      .select(['child_id', 'class_id'])
      .where('class_id', 'in', classIds)
      .where('meal_date', '=', date)
      .execute(),
    database
      .selectFrom('boarding_meal_days')
      .select(['class_id', 'headcount', 'status'])
      .where('class_id', 'in', classIds)
      .where('meal_date', '=', date)
      .execute(),
  ]);
  for (const classId of classIds) {
    const day = days.find((row) => row.class_id === classId && row.status === 'closed');
    if (day) {
      result.set(classId, { headcount: day.headcount, closed: true });
      continue;
    }
    const cut = new Set(cuts.filter((row) => row.class_id === classId).map((row) => row.child_id));
    const live = registered.filter((row) => row.class_id === classId && !cut.has(row.child_id)).length;
    result.set(classId, { headcount: live, closed: false });
  }
  return result;
}

// Ngày ăn thực tế của học sinh lớp ngoài Mầm non trong các ngày học: ngày lớp đã chốt suất mà học sinh không cắt suất
export async function boardingMealDays(
  database: Executor,
  children: Array<{ id: string; class_id: string }>,
  schoolDays: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (children.length === 0 || schoolDays.length === 0) {
    return result;
  }
  const classIds = [...new Set(children.map((child) => child.class_id))];
  const [closed, cuts] = await Promise.all([
    database
      .selectFrom('boarding_meal_days')
      .select(['class_id', 'meal_date'])
      .where('class_id', 'in', classIds)
      .where('meal_date', 'in', schoolDays)
      .where('status', '=', 'closed')
      .execute(),
    database
      .selectFrom('boarding_meal_cuts')
      .select(['child_id', 'meal_date'])
      .where(
        'child_id',
        'in',
        children.map((child) => child.id),
      )
      .where('meal_date', 'in', schoolDays)
      .execute(),
  ]);
  for (const child of children) {
    const cutDays = new Set(cuts.filter((row) => row.child_id === child.id).map((row) => row.meal_date));
    const days = closed.filter((row) => row.class_id === child.class_id && !cutDays.has(row.meal_date)).length;
    result.set(child.id, days);
  }
  return result;
}

// Ngày học lớp chưa chốt suất (chặn tính tiền ăn như chưa chốt điểm danh ở Mầm non)
export async function unclosedBoardingDays(
  database: Executor,
  classIds: string[],
  schoolDays: string[],
): Promise<Array<{ class_id: string; date: string }>> {
  if (classIds.length === 0 || schoolDays.length === 0) {
    return [];
  }
  const closed = await database
    .selectFrom('boarding_meal_days')
    .select(['class_id', 'meal_date'])
    .where('class_id', 'in', classIds)
    .where('meal_date', 'in', schoolDays)
    .where('status', '=', 'closed')
    .execute();
  const keys = new Set(closed.map((row) => `${row.class_id}:${row.meal_date}`));
  return classIds.flatMap((classId) =>
    schoolDays.filter((date) => !keys.has(`${classId}:${date}`)).map((date) => ({ class_id: classId, date })),
  );
}
