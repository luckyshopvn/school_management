import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  MEAL_LABELS,
  MEAL_TYPES,
  MENU_STATUS_LABELS,
  SOURCE_LABELS,
  WEEKDAY_LABELS,
  formatMoney,
  messageOf,
  mondayOf,
  postJson,
  vietnamToday,
  type Buffet,
  type DailyNorms,
  type Dish,
  type Ingredient,
  type MealPlan,
  type MealType,
  type MealsReport,
  type MenuDetail,
  type MenuItem,
  type MenuSummary,
  type Purchase,
  type PurchaseDetail,
  type Supplier,
} from './kitchen-api.js';

// MH-18 Thực đơn và định lượng nguyên liệu, MH-38 Phiếu đi chợ và nhà cung cấp thực phẩm, báo cáo ăn và bếp (P12-01 đến
// P12-09, P17-08; YCTD-76): bếp lập món, nguyên liệu, thực đơn tuần, trình duyệt; quản lý đơn vị duyệt và công bố; xem
// suất ăn theo ngày, định lượng; lập và xác nhận nhập phiếu đi chợ; kế toán gắn phiếu chi; báo cáo đối chiếu suất ăn
type Tab = 'menus' | 'meals' | 'dishes' | 'purchases' | 'buffets' | 'report';
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

interface TabProps {
  orgUnitId: string;
  onDone(message: string): void;
}

export function KitchenPage() {
  const canReport = useHasPermission(PERMISSION_CODES.kitchenReport);
  const [tab, setTab] = useState<Tab>('menus');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const tabs: Array<[Tab, string]> = [
    ['menus', 'Thực đơn tuần'],
    ['meals', 'Suất ăn theo ngày'],
    ['dishes', 'Món ăn và nguyên liệu'],
    ['purchases', 'Phiếu đi chợ'],
    ['buffets', 'Buffet theo dịp'],
    ...(canReport ? ([['report', 'Báo cáo ăn và bếp']] as Array<[Tab, string]>) : []),
  ];
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">Bếp và thực đơn</h1>
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Bếp">
          {tabs.map(([code, label]) => (
            <Button
              key={code}
              role="tab"
              aria-selected={tab === code}
              variant={tab === code ? 'secondary' : 'text'}
              onClick={() => setTab(code)}
            >
              {label}
            </Button>
          ))}
        </div>
        {orgUnitId ? (
          <>
            {tab === 'menus' ? <MenusTab key={orgUnitId} orgUnitId={orgUnitId} onDone={setToastMessage} /> : null}
            {tab === 'meals' ? <MealsTab key={orgUnitId} orgUnitId={orgUnitId} onDone={setToastMessage} /> : null}
            {tab === 'dishes' ? <DishesTab key={orgUnitId} orgUnitId={orgUnitId} onDone={setToastMessage} /> : null}
            {tab === 'purchases' ? (
              <PurchasesTab key={orgUnitId} orgUnitId={orgUnitId} onDone={setToastMessage} />
            ) : null}
            {tab === 'buffets' ? <BuffetsTab key={orgUnitId} orgUnitId={orgUnitId} onDone={setToastMessage} /> : null}
            {tab === 'report' ? <ReportTab key={orgUnitId} orgUnitId={orgUnitId} onDone={setToastMessage} /> : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function useDishes(orgUnitId: string) {
  return useQuery({
    queryKey: ['kitchen-dishes', orgUnitId],
    queryFn: () => requestJson<Dish[]>(`/api/v1/dishes?org_unit_id=${orgUnitId}`),
  });
}

function useIngredients(orgUnitId: string) {
  return useQuery({
    queryKey: ['kitchen-ingredients', orgUnitId],
    queryFn: () => requestJson<Ingredient[]>(`/api/v1/ingredients?org_unit_id=${orgUnitId}`),
  });
}

function MenusTab({ orgUnitId, onDone }: TabProps) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.kitchenManage);
  const canApprove = useHasPermission(PERMISSION_CODES.menuApprove);
  const [menuId, setMenuId] = useState('');
  const [weekStart, setWeekStart] = useState(() => mondayOf(vietnamToday()));
  const [ageGroup, setAgeGroup] = useState('all');
  const [weekday, setWeekday] = useState(1);
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [dishId, setDishId] = useState('');
  const [reason, setReason] = useState('');
  const [normsDate, setNormsDate] = useState('');
  const menus = useQuery({
    queryKey: ['kitchen-menus', orgUnitId],
    queryFn: () => requestJson<MenuSummary[]>(`/api/v1/menus?org_unit_id=${orgUnitId}`),
  });
  const detail = useQuery({
    queryKey: ['kitchen-menu', menuId],
    queryFn: () => requestJson<MenuDetail>(`/api/v1/menus/${menuId}`),
    enabled: Boolean(menuId),
  });
  const dishes = useDishes(orgUnitId);
  const norms = useQuery({
    queryKey: ['kitchen-menu-norms', menuId, normsDate],
    queryFn: () =>
      requestJson<{
        servings: number;
        totals: Array<{ ingredient_id: string; name: string; unit: string; quantity: number; shortage: number }>;
      }>(`/api/v1/menus/${menuId}/norms?date=${normsDate}`),
    enabled: Boolean(menuId && normsDate),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['kitchen-menus'] });
    await queryClient.invalidateQueries({ queryKey: ['kitchen-menu'] });
    onDone(message);
  };
  const create = useMutation({
    mutationFn: () =>
      postJson<MenuDetail>('/api/v1/menus', {
        org_unit_id: orgUnitId,
        week_start_date: weekStart,
        age_group: ageGroup,
      }),
    onSuccess: (menu) => {
      setMenuId(menu.id);
      return refresh('Đã lập thực đơn nháp');
    },
  });
  const saveItems = useMutation({
    mutationFn: (items: MenuItem[]) =>
      postJson<MenuDetail>(
        `/api/v1/menus/${menuId}/items`,
        {
          items: items.map((item) => ({ weekday: item.weekday, meal_type: item.meal_type, dish_id: item.dish_id })),
        },
        'PUT',
      ),
    onSuccess: () => refresh('Đã lưu món của thực đơn'),
  });
  const action = useMutation({
    mutationFn: (kind: 'submit' | 'approve' | 'reject') =>
      postJson<MenuDetail>(`/api/v1/menus/${menuId}/${kind}`, kind === 'reject' ? { reason } : {}),
    onSuccess: (menu, kind) => {
      setReason('');
      return refresh(
        kind === 'submit'
          ? 'Đã trình duyệt thực đơn'
          : kind === 'approve'
            ? 'Đã duyệt và công bố thực đơn'
            : 'Đã trả lại thực đơn',
      );
    },
  });
  const error = [menus.error, detail.error, create.error, saveItems.error, action.error, norms.error].find(Boolean);
  const menu = detail.data;
  const items = menu?.items ?? [];
  const activeDishes = (dishes.data ?? []).filter((dish) => dish.status === 'active');

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canManage ? (
        <form
          aria-label="Lập thực đơn"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <TextField
            label="Tuần bắt đầu (thứ hai)"
            type="date"
            value={weekStart}
            onChange={(event) => setWeekStart(event.target.value)}
          />
          <TextField
            label="Độ tuổi (mã khối hoặc all)"
            value={ageGroup}
            onChange={(event) => setAgeGroup(event.target.value)}
          />
          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={create.isPending || weekStart === ''}>
              Lập thực đơn
            </Button>
          </div>
        </form>
      ) : null}
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Tuần</th>
            <th>Độ tuổi</th>
            <th>Số món</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(menus.data ?? []).map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="py-2">{row.week_start_date}</td>
              <td>{row.age_group === 'all' ? 'Chung' : row.age_group}</td>
              <td>{row.item_count}</td>
              <td>{MENU_STATUS_LABELS[row.status]}</td>
              <td>
                <Button
                  variant="text"
                  aria-label={`Xem thực đơn tuần ${row.week_start_date} ${row.age_group}`}
                  onClick={() => setMenuId(row.id)}
                >
                  Xem
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {menu ? (
        <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Chi tiết thực đơn">
          <h2 className="text-section-title font-semibold text-text">
            Thực đơn tuần {menu.week_start_date} ({menu.age_group === 'all' ? 'chung' : menu.age_group}):{' '}
            {MENU_STATUS_LABELS[menu.status]}
          </h2>
          {menu.reject_reason && menu.status === 'draft' ? (
            <Alert tone="warning">Bị trả lại: {menu.reject_reason}</Alert>
          ) : null}
          <table className="w-full text-content">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-2">Thứ</th>
                {MEAL_TYPES.map((meal) => (
                  <th key={meal}>{MEAL_LABELS[meal]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6].map((day) => (
                <tr key={day} className="border-t border-border">
                  <td className="py-2">{WEEKDAY_LABELS[day]}</td>
                  {MEAL_TYPES.map((meal) => (
                    <td key={meal}>
                      {items
                        .filter((item) => item.weekday === day && item.meal_type === meal)
                        .map((item) => (
                          <span key={item.id} className="mr-2 inline-flex items-center gap-1">
                            {item.dish_name}
                            {menu.status === 'draft' && canManage ? (
                              <button
                                type="button"
                                className="text-link"
                                aria-label={`Bỏ ${item.dish_name} ${WEEKDAY_LABELS[day]} ${MEAL_LABELS[meal]}`}
                                onClick={() => saveItems.mutate(items.filter((other) => other.id !== item.id))}
                              >
                                (bỏ)
                              </button>
                            ) : null}
                          </span>
                        ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {menu.status === 'draft' && canManage ? (
            <form
              aria-label="Thêm món"
              className="grid grid-cols-1 gap-3 md:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveItems.mutate([...items, { weekday, meal_type: mealType, dish_id: dishId }]);
              }}
            >
              <label className="text-label font-medium text-text">
                Thứ
                <select
                  value={weekday}
                  onChange={(event) => setWeekday(Number(event.target.value))}
                  className={selectClass}
                >
                  {[1, 2, 3, 4, 5, 6].map((day) => (
                    <option key={day} value={day}>
                      {WEEKDAY_LABELS[day]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Bữa
                <select
                  value={mealType}
                  onChange={(event) => setMealType(event.target.value as MealType)}
                  className={selectClass}
                >
                  {MEAL_TYPES.map((meal) => (
                    <option key={meal} value={meal}>
                      {MEAL_LABELS[meal]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Món
                <select value={dishId} onChange={(event) => setDishId(event.target.value)} className={selectClass}>
                  <option value="">Chọn món</option>
                  {activeDishes.map((dish) => (
                    <option key={dish.id} value={dish.id}>
                      {dish.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <Button type="submit" disabled={saveItems.isPending || dishId === ''}>
                  Thêm món
                </Button>
              </div>
            </form>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            {menu.status === 'draft' && canManage ? (
              <Button variant="primary" disabled={action.isPending} onClick={() => action.mutate('submit')}>
                Trình duyệt
              </Button>
            ) : null}
            {menu.status === 'submitted' && canApprove ? (
              <>
                <Button variant="primary" disabled={action.isPending} onClick={() => action.mutate('approve')}>
                  Duyệt và công bố
                </Button>
                <TextField label="Lý do trả lại" value={reason} onChange={(event) => setReason(event.target.value)} />
                <Button disabled={action.isPending || reason === ''} onClick={() => action.mutate('reject')}>
                  Trả lại
                </Button>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <TextField
              label="Ngày tính định lượng"
              type="date"
              value={normsDate}
              onChange={(event) => setNormsDate(event.target.value)}
            />
          </div>
          {norms.data ? (
            <table className="w-full text-content" aria-label="Định lượng nguyên liệu">
              <caption className="text-left text-text-secondary">Số suất: {norms.data.servings}</caption>
              <thead>
                <tr className="text-left text-text-secondary">
                  <th className="py-2">Nguyên liệu</th>
                  <th>Cần dùng</th>
                  <th>Thiếu so với tồn</th>
                </tr>
              </thead>
              <tbody>
                {norms.data.totals.map((row) => (
                  <tr key={row.ingredient_id} className="border-t border-border">
                    <td className="py-2">{row.name}</td>
                    <td>
                      {row.quantity} {row.unit}
                    </td>
                    <td>
                      {row.shortage} {row.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function MealsTab({ orgUnitId, onDone }: TabProps) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.kitchenManage);
  const [date, setDate] = useState(vietnamToday);
  const plan = useQuery({
    queryKey: ['kitchen-meal-plan', orgUnitId, date],
    queryFn: () => requestJson<MealPlan>(`/api/v1/meal-plans?org_unit_id=${orgUnitId}&date=${date}`),
    enabled: date !== '',
  });
  const norms = useQuery({
    queryKey: ['kitchen-daily-norms', orgUnitId, date],
    queryFn: () => requestJson<DailyNorms>(`/api/v1/kitchen/daily-norms?org_unit_id=${orgUnitId}&date=${date}`),
    enabled: date !== '',
  });
  const compute = useMutation({
    mutationFn: () => postJson<MealPlan>('/api/v1/meal-plans/compute', { org_unit_id: orgUnitId, date }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['kitchen-meal-plan'] });
      onDone(`Đã lưu ${result.headcount} suất cho mỗi bữa`);
    },
  });
  const error = [plan.error, norms.error, compute.error].find(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        <TextField label="Ngày" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        {canManage ? (
          <Button variant="primary" disabled={compute.isPending} onClick={() => compute.mutate()}>
            Tính và lưu số suất
          </Button>
        ) : null}
      </div>
      {plan.data ? (
        <section aria-label="Suất ăn theo ngày" className="flex flex-col gap-2">
          <p className="text-content text-text">
            Mỗi bữa sáng, trưa, xế: <strong>{plan.data.headcount}</strong> suất (
            {plan.data.status === 'final' ? 'mọi lớp đã chốt điểm danh' : 'tạm tính, còn lớp chưa chốt điểm danh'})
            {plan.data.stored[0] ? `; đã lưu ${plan.data.stored[0].headcount} suất` : '; chưa lưu'}
          </p>
          <table className="w-full text-content">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-2">Lớp</th>
                <th>Sĩ số</th>
                <th>Có mặt theo điểm danh</th>
                <th>Báo cơm</th>
                <th>Nguồn</th>
                <th>Số suất</th>
              </tr>
            </thead>
            <tbody>
              {plan.data.classes.map((row) => (
                <tr key={row.class_id} className="border-t border-border">
                  <td className="py-2">{row.class_name}</td>
                  <td>{row.enrolled_count}</td>
                  <td>{row.attendance_meal_count}</td>
                  <td>{row.meal_report_headcount ?? ''}</td>
                  <td>{SOURCE_LABELS[row.source]}</td>
                  <td>{row.headcount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {norms.data ? (
        <section aria-label="Định lượng của ngày" className="flex flex-col gap-2">
          <h2 className="text-section-title font-semibold text-text">Định lượng nguyên liệu của ngày</h2>
          {norms.data.classes_without_menu.length > 0 ? (
            <Alert tone="warning">Lớp chưa có thực đơn đã công bố: {norms.data.classes_without_menu.join(', ')}</Alert>
          ) : null}
          <table className="w-full text-content">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-2">Nguyên liệu</th>
                <th>Cần dùng</th>
                <th>Tồn</th>
              </tr>
            </thead>
            <tbody>
              {norms.data.ingredients.map((row) => (
                <tr key={row.ingredient_id} className="border-t border-border">
                  <td className="py-2">{row.name}</td>
                  <td>
                    {row.required_quantity} {row.unit}
                  </td>
                  <td>
                    {row.current_stock} {row.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

function DishesTab({ orgUnitId, onDone }: TabProps) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.kitchenManage);
  const ingredients = useIngredients(orgUnitId);
  const dishes = useDishes(orgUnitId);
  const [ingredient, setIngredient] = useState({ code: '', name: '', unit: '' });
  const [dish, setDish] = useState({ name: '', group_name: '', recipe_note: '' });
  const [dishId, setDishId] = useState('');
  const [normIngredientId, setNormIngredientId] = useState('');
  const [normQuantity, setNormQuantity] = useState('');
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['kitchen-ingredients'] });
    await queryClient.invalidateQueries({ queryKey: ['kitchen-dishes'] });
    onDone(message);
  };
  const createIngredient = useMutation({
    mutationFn: () => postJson('/api/v1/ingredients', { org_unit_id: orgUnitId, ...ingredient }),
    onSuccess: () => {
      setIngredient({ code: '', name: '', unit: '' });
      return refresh('Đã thêm nguyên liệu');
    },
  });
  const createDish = useMutation({
    mutationFn: () =>
      postJson<Dish>('/api/v1/dishes', {
        org_unit_id: orgUnitId,
        name: dish.name,
        group_name: dish.group_name || null,
        recipe_note: dish.recipe_note || null,
      }),
    onSuccess: (created) => {
      setDish({ name: '', group_name: '', recipe_note: '' });
      setDishId(created.id);
      return refresh('Đã thêm món ăn');
    },
  });
  const saveNorms = useMutation({
    mutationFn: (norms: Array<{ ingredient_id: string; quantity_per_serving: number }>) =>
      postJson(`/api/v1/dishes/${dishId}/norms`, { norms }, 'PUT'),
    onSuccess: () => {
      setNormQuantity('');
      return refresh('Đã lưu định lượng');
    },
  });
  const error = [ingredients.error, dishes.error, createIngredient.error, createDish.error, saveNorms.error].find(
    Boolean,
  );
  const selected = dishes.data?.find((row) => row.id === dishId);
  const currentNorms = (selected?.norms ?? []).map((norm) => ({
    ingredient_id: norm.ingredient_id,
    quantity_per_serving: norm.quantity_per_serving,
  }));

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <section className="flex flex-col gap-2" aria-label="Nguyên liệu">
        <h2 className="text-section-title font-semibold text-text">Nguyên liệu và tồn</h2>
        {canManage ? (
          <form
            aria-label="Thêm nguyên liệu"
            className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              createIngredient.mutate();
            }}
          >
            <TextField
              label="Mã nguyên liệu"
              value={ingredient.code}
              onChange={(event) => setIngredient({ ...ingredient, code: event.target.value })}
            />
            <TextField
              label="Tên nguyên liệu"
              value={ingredient.name}
              onChange={(event) => setIngredient({ ...ingredient, name: event.target.value })}
            />
            <TextField
              label="Đơn vị tính"
              value={ingredient.unit}
              onChange={(event) => setIngredient({ ...ingredient, unit: event.target.value })}
            />
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={createIngredient.isPending || !ingredient.code || !ingredient.name || !ingredient.unit}
              >
                Thêm nguyên liệu
              </Button>
            </div>
          </form>
        ) : null}
        <table className="w-full text-content">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-2">Mã</th>
              <th>Tên</th>
              <th>Tồn</th>
            </tr>
          </thead>
          <tbody>
            {(ingredients.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="py-2">{row.code}</td>
                <td>{row.name}</td>
                <td>
                  {row.current_stock} {row.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2" aria-label="Món ăn">
        <h2 className="text-section-title font-semibold text-text">Món ăn và định lượng trên một suất</h2>
        {canManage ? (
          <form
            aria-label="Thêm món ăn"
            className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              createDish.mutate();
            }}
          >
            <TextField
              label="Tên món"
              value={dish.name}
              onChange={(event) => setDish({ ...dish, name: event.target.value })}
            />
            <TextField
              label="Nhóm chất"
              value={dish.group_name}
              onChange={(event) => setDish({ ...dish, group_name: event.target.value })}
            />
            <TextField
              label="Cách chế biến"
              value={dish.recipe_note}
              onChange={(event) => setDish({ ...dish, recipe_note: event.target.value })}
            />
            <div className="flex items-end">
              <Button type="submit" disabled={createDish.isPending || !dish.name}>
                Thêm món ăn
              </Button>
            </div>
          </form>
        ) : null}
        <table className="w-full text-content">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-2">Món</th>
              <th>Nhóm chất</th>
              <th>Định lượng một suất</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(dishes.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="py-2">{row.name}</td>
                <td>{row.group_name ?? ''}</td>
                <td>
                  {row.norms
                    .map((norm) => `${norm.ingredient_name} ${norm.quantity_per_serving} ${norm.unit}`)
                    .join('; ')}
                </td>
                <td>
                  {canManage ? (
                    <Button variant="text" aria-label={`Định lượng ${row.name}`} onClick={() => setDishId(row.id)}>
                      Định lượng
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {selected && canManage ? (
          <form
            aria-label={`Định lượng của ${selected.name}`}
            className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              saveNorms.mutate([
                ...currentNorms.filter((norm) => norm.ingredient_id !== normIngredientId),
                { ingredient_id: normIngredientId, quantity_per_serving: Number(normQuantity.replace(',', '.')) },
              ]);
            }}
          >
            <label className="text-label font-medium text-text">
              Nguyên liệu
              <select
                value={normIngredientId}
                onChange={(event) => setNormIngredientId(event.target.value)}
                className={selectClass}
              >
                <option value="">Chọn nguyên liệu</option>
                {(ingredients.data ?? [])
                  .filter((row) => row.status === 'active')
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} ({row.unit})
                    </option>
                  ))}
              </select>
            </label>
            <TextField
              label="Định lượng một suất"
              value={normQuantity}
              onChange={(event) => setNormQuantity(event.target.value)}
            />
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={saveNorms.isPending || !normIngredientId || !normQuantity}>
                Lưu định lượng
              </Button>
              {normIngredientId && currentNorms.some((norm) => norm.ingredient_id === normIngredientId) ? (
                <Button
                  variant="text"
                  onClick={() =>
                    saveNorms.mutate(currentNorms.filter((norm) => norm.ingredient_id !== normIngredientId))
                  }
                >
                  Bỏ nguyên liệu
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}

interface Line {
  ingredient_id: string;
  quantity: string;
  unit_price: string;
}

function PurchasesTab({ orgUnitId, onDone }: TabProps) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.kitchenManage);
  const canPay = useHasPermission(PERMISSION_CODES.paymentManage);
  const ingredients = useIngredients(orgUnitId);
  const [supplier, setSupplier] = useState({ name: '', food_groups: '', phone: '' });
  const [purchaseDate, setPurchaseDate] = useState(vietnamToday);
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [detailId, setDetailId] = useState('');
  const [paymentChoice, setPaymentChoice] = useState<Record<string, string>>({});
  const suppliers = useQuery({
    queryKey: ['kitchen-suppliers', orgUnitId],
    queryFn: () => requestJson<Supplier[]>(`/api/v1/food-suppliers?org_unit_id=${orgUnitId}`),
  });
  const purchases = useQuery({
    queryKey: ['kitchen-purchases', orgUnitId],
    queryFn: () => requestJson<Purchase[]>(`/api/v1/market-purchases?org_unit_id=${orgUnitId}`),
  });
  const detail = useQuery({
    queryKey: ['kitchen-purchase', detailId],
    queryFn: () => requestJson<PurchaseDetail>(`/api/v1/market-purchases/${detailId}`),
    enabled: Boolean(detailId),
  });
  const payments = useQuery({
    queryKey: ['kitchen-issued-payments', orgUnitId],
    queryFn: () =>
      requestJson<Array<{ id: string; code: string | null; amount: number; payee_name: string }>>(
        `/api/v1/payments?org_unit_id=${orgUnitId}&status=issued`,
      ),
    enabled: canPay,
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['kitchen-suppliers'] });
    await queryClient.invalidateQueries({ queryKey: ['kitchen-purchases'] });
    await queryClient.invalidateQueries({ queryKey: ['kitchen-purchase'] });
    await queryClient.invalidateQueries({ queryKey: ['kitchen-ingredients'] });
    onDone(message);
  };
  const createSupplier = useMutation({
    mutationFn: () =>
      postJson('/api/v1/food-suppliers', {
        org_unit_id: orgUnitId,
        name: supplier.name,
        food_groups: supplier.food_groups || null,
        phone: supplier.phone || null,
      }),
    onSuccess: () => {
      setSupplier({ name: '', food_groups: '', phone: '' });
      return refresh('Đã thêm nhà cung cấp thực phẩm');
    },
  });
  const prefill = useMutation({
    mutationFn: () =>
      requestJson<DailyNorms>(`/api/v1/kitchen/daily-norms?org_unit_id=${orgUnitId}&date=${purchaseDate}`),
    onSuccess: (norms) =>
      setLines(
        norms.ingredients.map((row) => ({
          ingredient_id: row.ingredient_id,
          quantity: String(Math.max(row.required_quantity - row.current_stock, 0) || row.required_quantity),
          unit_price: '',
        })),
      ),
  });
  const create = useMutation({
    mutationFn: () =>
      postJson<PurchaseDetail>('/api/v1/market-purchases', {
        org_unit_id: orgUnitId,
        purchase_date: purchaseDate,
        supplier_id: supplierId,
        items: lines.map((line) => ({
          ingredient_id: line.ingredient_id,
          quantity: Number(line.quantity.replace(',', '.')),
          unit_price: Number(line.unit_price.replace(/\D/g, '')),
        })),
      }),
    onSuccess: (created) => {
      setLines([]);
      setDetailId(created.id);
      return refresh(`Đã lập phiếu đi chợ ${created.code}`);
    },
  });
  const act = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: 'receive' | 'cancel' | 'link-payment' }) =>
      postJson<PurchaseDetail>(
        `/api/v1/market-purchases/${id}/${kind}`,
        kind === 'link-payment' ? { payment_id: paymentChoice[id] } : {},
      ),
    onSuccess: (purchase, { kind }) =>
      refresh(
        kind === 'receive'
          ? `Đã nhập nguyên liệu của phiếu ${purchase.code}, chờ kế toán thanh toán`
          : kind === 'cancel'
            ? `Đã hủy phiếu ${purchase.code}`
            : `Đã gắn phiếu chi cho phiếu ${purchase.code}`,
      ),
  });
  const error = [suppliers.error, purchases.error, createSupplier.error, prefill.error, create.error, act.error].find(
    Boolean,
  );
  const updateLine = (index: number, change: Partial<Line>) =>
    setLines(lines.map((line, position) => (position === index ? { ...line, ...change } : line)));

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <section className="flex flex-col gap-2" aria-label="Nhà cung cấp thực phẩm">
        <h2 className="text-section-title font-semibold text-text">Nhà cung cấp thực phẩm</h2>
        {canManage ? (
          <form
            aria-label="Thêm nhà cung cấp"
            className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              createSupplier.mutate();
            }}
          >
            <TextField
              label="Tên nhà cung cấp"
              value={supplier.name}
              onChange={(event) => setSupplier({ ...supplier, name: event.target.value })}
            />
            <TextField
              label="Nhóm thực phẩm cung cấp"
              value={supplier.food_groups}
              onChange={(event) => setSupplier({ ...supplier, food_groups: event.target.value })}
            />
            <TextField
              label="Điện thoại"
              value={supplier.phone}
              onChange={(event) => setSupplier({ ...supplier, phone: event.target.value })}
            />
            <div className="flex items-end">
              <Button type="submit" disabled={createSupplier.isPending || !supplier.name}>
                Thêm nhà cung cấp
              </Button>
            </div>
          </form>
        ) : null}
        <ul className="text-content">
          {(suppliers.data ?? []).map((row) => (
            <li key={row.id}>
              {row.name}
              {row.food_groups ? ` (${row.food_groups})` : ''}
              {row.phone ? `, ${row.phone}` : ''}
            </li>
          ))}
        </ul>
      </section>

      {canManage ? (
        <form
          aria-label="Lập phiếu đi chợ"
          className="flex flex-col gap-3 rounded-lg bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <TextField
              label="Ngày đi chợ"
              type="date"
              value={purchaseDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
            />
            <label className="text-label font-medium text-text">
              Nhà cung cấp
              <select
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                className={selectClass}
              >
                <option value="">Chọn nhà cung cấp</option>
                {(suppliers.data ?? [])
                  .filter((row) => row.status === 'active')
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button disabled={prefill.isPending} onClick={() => prefill.mutate()}>
                Lấy theo định lượng của ngày
              </Button>
              <Button onClick={() => setLines([...lines, { ingredient_id: '', quantity: '', unit_price: '' }])}>
                Thêm dòng
              </Button>
            </div>
          </div>
          {lines.map((line, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 md:grid-cols-4" aria-label={`Dòng ${index + 1}`}>
              <label className="text-label font-medium text-text">
                Nguyên liệu
                <select
                  value={line.ingredient_id}
                  onChange={(event) => updateLine(index, { ingredient_id: event.target.value })}
                  className={selectClass}
                >
                  <option value="">Chọn nguyên liệu</option>
                  {(ingredients.data ?? []).map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} ({row.unit})
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="Số lượng"
                value={line.quantity}
                onChange={(event) => updateLine(index, { quantity: event.target.value })}
              />
              <TextField
                label="Đơn giá"
                value={line.unit_price}
                onChange={(event) => updateLine(index, { unit_price: event.target.value })}
              />
              <div className="flex items-end">
                <Button variant="text" onClick={() => setLines(lines.filter((_, position) => position !== index))}>
                  Bỏ dòng
                </Button>
              </div>
            </div>
          ))}
          <div>
            <Button
              type="submit"
              variant="primary"
              disabled={
                create.isPending ||
                !supplierId ||
                lines.length === 0 ||
                lines.some((line) => !line.ingredient_id || !line.quantity || line.unit_price === '')
              }
            >
              Lập phiếu
            </Button>
          </div>
        </form>
      ) : null}

      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Số phiếu</th>
            <th>Ngày</th>
            <th>Nhà cung cấp</th>
            <th>Tổng tiền</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(purchases.data ?? []).map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="py-2">
                <Button variant="text" onClick={() => setDetailId(row.id)}>
                  {row.code}
                </Button>
              </td>
              <td>{row.purchase_date}</td>
              <td>{row.supplier_name}</td>
              <td>{formatMoney(row.total_amount)}</td>
              <td>
                {row.status === 'draft'
                  ? 'Nháp'
                  : row.status === 'cancelled'
                    ? 'Đã hủy'
                    : row.payment_status === 'paid'
                      ? `Đã thanh toán (${row.payment_code ?? ''})`
                      : 'Đã nhập, chờ thanh toán'}
              </td>
              <td className="flex flex-wrap gap-2">
                {row.status === 'draft' && canManage ? (
                  <>
                    <Button disabled={act.isPending} onClick={() => act.mutate({ id: row.id, kind: 'receive' })}>
                      Xác nhận nhập
                    </Button>
                    <Button
                      variant="text"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: row.id, kind: 'cancel' })}
                    >
                      Hủy phiếu
                    </Button>
                  </>
                ) : null}
                {row.payment_status === 'awaiting_payment' && canPay ? (
                  <>
                    <select
                      aria-label={`Phiếu chi cho ${row.code}`}
                      value={paymentChoice[row.id] ?? ''}
                      onChange={(event) => setPaymentChoice({ ...paymentChoice, [row.id]: event.target.value })}
                      className="rounded-lg border border-border bg-card px-2 py-1"
                    >
                      <option value="">Chọn phiếu chi đã phát hành</option>
                      {(payments.data ?? [])
                        .filter((payment) => payment.amount === row.total_amount)
                        .map((payment) => (
                          <option key={payment.id} value={payment.id}>
                            {payment.code} {payment.payee_name}
                          </option>
                        ))}
                    </select>
                    <Button
                      disabled={act.isPending || !paymentChoice[row.id]}
                      onClick={() => act.mutate({ id: row.id, kind: 'link-payment' })}
                    >
                      Gắn phiếu chi
                    </Button>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {detail.data ? (
        <table className="w-full text-content" aria-label={`Chi tiết phiếu ${detail.data.code}`}>
          <caption className="text-left font-semibold text-text">Phiếu {detail.data.code}</caption>
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-2">Nguyên liệu</th>
              <th>Thực mua</th>
              <th>Định lượng của ngày</th>
              <th>Chênh lệch</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {detail.data.items.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="py-2">{item.ingredient_name}</td>
                <td>
                  {item.quantity} {item.unit}
                </td>
                <td>{item.planned_quantity ?? ''}</td>
                <td>{item.difference ?? ''}</td>
                <td>{formatMoney(item.unit_price)}</td>
                <td>{formatMoney(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function BuffetsTab({ orgUnitId, onDone }: TabProps) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.kitchenManage);
  const canApprove = useHasPermission(PERMISSION_CODES.menuApprove);
  const [form, setForm] = useState({ buffet_date: vietnamToday(), occasion: '', class_id: '', menu_note: '' });
  const buffets = useQuery({
    queryKey: ['kitchen-buffets', orgUnitId],
    queryFn: () => requestJson<Buffet[]>(`/api/v1/buffet-events?org_unit_id=${orgUnitId}`),
  });
  const classes = useQuery({ queryKey: ['classes', orgUnitId], queryFn: () => listClasses(orgUnitId) });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['kitchen-buffets'] });
    onDone(message);
  };
  const create = useMutation({
    mutationFn: () =>
      postJson('/api/v1/buffet-events', { org_unit_id: orgUnitId, ...form, class_id: form.class_id || null }),
    onSuccess: () => {
      setForm({ ...form, occasion: '', menu_note: '' });
      return refresh('Đã lập buffet');
    },
  });
  const decide = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: 'approve' | 'cancel' }) =>
      postJson(`/api/v1/buffet-events/${id}/${kind}`, {}),
    onSuccess: (_, { kind }) => refresh(kind === 'approve' ? 'Đã duyệt buffet' : 'Đã hủy buffet'),
  });
  const error = [buffets.error, create.error, decide.error].find(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <p className="text-content text-text-secondary">Buffet nằm trong tiền ăn, không đăng ký và không thu riêng.</p>
      {canManage || canApprove ? (
        <form
          aria-label="Lập buffet"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <TextField
            label="Ngày tổ chức"
            type="date"
            value={form.buffet_date}
            onChange={(event) => setForm({ ...form, buffet_date: event.target.value })}
          />
          <TextField
            label="Dịp"
            value={form.occasion}
            onChange={(event) => setForm({ ...form, occasion: event.target.value })}
          />
          <label className="text-label font-medium text-text">
            Phạm vi
            <select
              value={form.class_id}
              onChange={(event) => setForm({ ...form, class_id: event.target.value })}
              className={selectClass}
            >
              <option value="">Toàn đơn vị</option>
              {(classes.data ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Thực đơn buffet"
            value={form.menu_note}
            onChange={(event) => setForm({ ...form, menu_note: event.target.value })}
          />
          <div className="flex items-end">
            <Button type="submit" disabled={create.isPending || !form.occasion || !form.menu_note}>
              Lập buffet
            </Button>
          </div>
        </form>
      ) : null}
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Ngày</th>
            <th>Dịp</th>
            <th>Phạm vi</th>
            <th>Thực đơn</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(buffets.data ?? []).map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="py-2">{row.buffet_date}</td>
              <td>{row.occasion}</td>
              <td>{row.class_name ?? 'Toàn đơn vị'}</td>
              <td>{row.menu_note}</td>
              <td>{row.status === 'draft' ? 'Chờ duyệt' : row.status === 'approved' ? 'Đã duyệt' : 'Đã hủy'}</td>
              <td className="flex gap-2">
                {row.status === 'draft' && canApprove ? (
                  <Button disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, kind: 'approve' })}>
                    Duyệt buffet
                  </Button>
                ) : null}
                {row.status !== 'cancelled' && (canManage || canApprove) ? (
                  <Button
                    variant="text"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: row.id, kind: 'cancel' })}
                  >
                    Hủy buffet
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportTab({ orgUnitId }: TabProps) {
  const today = vietnamToday();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const report = useQuery({
    queryKey: ['kitchen-report', orgUnitId, from, to],
    queryFn: () => requestJson<MealsReport>(`/api/v1/reports/meals?org_unit_id=${orgUnitId}&from=${from}&to=${to}`),
    enabled: from !== '' && to !== '',
  });
  const data = report.data;
  return (
    <div className="flex flex-col gap-4">
      {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
      <div className="flex flex-wrap gap-3">
        <TextField label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <TextField label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      {data ? (
        <>
          {data.mismatched_days.length > 0 ? (
            <Alert tone="warning">
              Số suất đã lưu lệch điểm danh đã chốt các ngày: {data.mismatched_days.join(', ')}. Tính lại ở thẻ Suất ăn
              theo ngày.
            </Alert>
          ) : null}
          <table className="w-full text-content" aria-label="Đối chiếu suất ăn và điểm danh">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-2">Ngày</th>
                <th>Lớp đã chốt</th>
                <th>Có mặt theo điểm danh đã chốt</th>
                <th>Nghỉ</th>
                <th>Số suất mỗi bữa</th>
                <th>Đối chiếu</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((day) => (
                <tr key={day.date} className="border-t border-border">
                  <td className="py-2">{day.date}</td>
                  <td>
                    {day.locked_class_count}/{day.class_count}
                  </td>
                  <td>{day.attendance_meal_count}</td>
                  <td>{day.absent_count}</td>
                  <td>{day.meal_headcount ?? 'Chưa lưu'}</td>
                  <td>{day.matched === null ? 'Chưa đối chiếu được' : day.matched ? 'Khớp' : 'Lệch'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <section aria-label="Chi phí đi chợ" className="flex flex-col gap-1 text-content">
            <h2 className="text-section-title font-semibold text-text">Chi phí đi chợ của kỳ</h2>
            <p>
              {data.purchases.count} phiếu đã nhập, tổng {formatMoney(data.purchases.total_amount)}; đã thanh toán{' '}
              {formatMoney(data.purchases.paid_amount)}; chờ thanh toán{' '}
              {formatMoney(data.purchases.awaiting_payment_amount)}
            </p>
            {data.cost_per_meal_day !== null ? (
              <p>Chi phí nguyên liệu trên một suất ngày: {formatMoney(data.cost_per_meal_day)}</p>
            ) : null}
            <ul>
              {data.purchases.by_supplier.map((row) => (
                <li key={row.supplier_id}>
                  {row.supplier_name}: {row.count} phiếu, {formatMoney(row.amount)}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
