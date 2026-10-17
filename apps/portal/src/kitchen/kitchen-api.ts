import { ApiError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối bếp, thực đơn, suất ăn, phiếu đi chợ, báo cáo ăn và bếp (P12, P17-08; YCTD-76)
export type MealType = 'breakfast' | 'lunch' | 'snack';
export const MEAL_LABELS: Record<MealType, string> = { breakfast: 'Bữa sáng', lunch: 'Bữa trưa', snack: 'Bữa xế' };
export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack'];
export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Thứ hai',
  2: 'Thứ ba',
  3: 'Thứ tư',
  4: 'Thứ năm',
  5: 'Thứ sáu',
  6: 'Thứ bảy',
};
export const MENU_STATUS_LABELS = { draft: 'Nháp', submitted: 'Chờ duyệt', published: 'Đã công bố' };
export const SOURCE_LABELS = {
  attendance_locked: 'Điểm danh đã chốt',
  meal_report: 'Báo cơm',
  attendance_open: 'Điểm danh chưa chốt',
};

export interface Ingredient {
  id: string;
  code: string;
  name: string;
  unit: string;
  current_stock: number;
  status: 'active' | 'inactive';
}

export interface Dish {
  id: string;
  name: string;
  group_name: string | null;
  recipe_note: string | null;
  status: 'active' | 'inactive';
  norms: Array<{ ingredient_id: string; ingredient_name: string; unit: string; quantity_per_serving: number }>;
}

export interface Supplier {
  id: string;
  name: string;
  food_groups: string | null;
  phone: string | null;
  status: 'active' | 'inactive';
}

export interface MenuItem {
  weekday: number;
  meal_type: MealType;
  dish_id: string;
  dish_name?: string;
  note?: string | null;
}

export interface MenuSummary {
  id: string;
  week_start_date: string;
  age_group: string;
  // Tên thực đơn, tháng, tuần, từ ngày–đến ngày, khối áp dụng như màn hình 4.5 của Sở (DT-16 phần 16h)
  name: string | null;
  month: string | null;
  week_no: number | null;
  from_date: string | null;
  to_date: string | null;
  grade_levels: string[];
  status: keyof typeof MENU_STATUS_LABELS;
  reject_reason: string | null;
  item_count: number;
}

export interface MenuDetail extends Omit<MenuSummary, 'item_count'> {
  items: Array<MenuItem & { id: string; dish_name: string }>;
}

export interface MealPlan {
  headcount: number;
  status: 'provisional' | 'final';
  classes: Array<{
    class_id: string;
    class_name: string;
    enrolled_count: number;
    attendance_meal_count: number;
    meal_report_headcount: number | null;
    source: keyof typeof SOURCE_LABELS;
    headcount: number;
  }>;
  stored: Array<{ meal_type: MealType; headcount: number; status: string; computed_at: string }>;
}

export interface DailyNorms {
  classes_without_menu: string[];
  menus: Array<{ menu_id: string; age_group: string; servings: number }>;
  ingredients: Array<{
    ingredient_id: string;
    name: string;
    unit: string;
    current_stock: number;
    required_quantity: number;
  }>;
}

export interface Purchase {
  id: string;
  code: string;
  purchase_date: string;
  supplier_name: string;
  total_amount: number;
  status: 'draft' | 'received' | 'cancelled';
  payment_status: 'awaiting_payment' | 'paid' | null;
  payment_code: string | null;
}

export interface PurchaseDetail extends Purchase {
  items: Array<{
    id: string;
    ingredient_name: string;
    unit: string;
    quantity: number;
    planned_quantity: number | null;
    difference: number | null;
    unit_price: number;
    amount: number;
  }>;
}

export interface Buffet {
  id: string;
  buffet_date: string;
  occasion: string;
  class_name: string | null;
  menu_note: string;
  status: 'draft' | 'approved' | 'cancelled';
}

export interface MealsReport {
  days: Array<{
    date: string;
    class_count: number;
    locked_class_count: number;
    attendance_meal_count: number;
    absent_count: number;
    meal_headcount: number | null;
    meal_plan_status: string | null;
    matched: boolean | null;
  }>;
  mismatched_days: string[];
  total_meal_days: number;
  cost_per_meal_day: number | null;
  purchases: {
    count: number;
    total_amount: number;
    awaiting_payment_amount: number;
    paid_amount: number;
    by_supplier: Array<{ supplier_id: string; supplier_name: string; count: number; amount: number }>;
  };
}

export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export const postJson = <Result>(path: string, body: unknown, method = 'POST') =>
  requestJson<Result>(path, { method, body: JSON.stringify(body) });

export const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export function mondayOf(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  const day = parsed.getUTCDay();
  return new Date(parsed.getTime() - (day === 0 ? 6 : day - 1) * 86_400_000).toISOString().slice(0, 10);
}

export const formatMoney = (value: number) => `${value.toLocaleString('vi-VN')} đ`;
