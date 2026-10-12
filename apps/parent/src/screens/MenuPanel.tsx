import { useEffect, useState } from 'react';
import { Alert, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MP-15 Thực đơn (P12-02, P12-03, P12-06; BR-59, BR-83; YCTD-76): phụ huynh xem thực đơn tuần đã duyệt và công bố của
// đơn vị con mình theo độ tuổi của lớp, kèm buffet theo dịp đã duyệt; thực đơn chưa duyệt không hiện (CT-065)
type MealType = 'breakfast' | 'lunch' | 'snack';

interface ChildMenus {
  week_start_date: string;
  menu: {
    items: Array<{ id: string; weekday: number; meal_type: MealType; dish_name: string }>;
  } | null;
  buffets: Array<{ id: string; buffet_date: string; occasion: string; menu_note: string }>;
}

const MEALS: Array<[MealType, string]> = [
  ['breakfast', 'Sáng'],
  ['lunch', 'Trưa'],
  ['snack', 'Xế'],
];
const WEEKDAYS = ['', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export function MenuPanel({ child }: { child: { id: string; full_name: string } }) {
  const [week, setWeek] = useState(today);
  const [data, setData] = useState<ChildMenus>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    if (!week) {
      return;
    }
    let current = true;
    setErrorMessage(undefined);
    requestJson<ChildMenus>(`/api/v1/children/${child.id}/menus?week_start_date=${week}`)
      .then((loaded) => {
        if (current) {
          setData(loaded);
        }
      })
      .catch((error: unknown) => {
        if (current) {
          setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');
        }
      });
    return () => {
      current = false;
    };
  }, [child.id, week]);

  const days = [...new Set((data?.menu?.items ?? []).map((item) => item.weekday))].sort();

  return (
    <section className="flex flex-col gap-3" aria-label={`Thực đơn của ${child.full_name}`}>
      <TextField label="Tuần có ngày" type="date" value={week} onChange={(event) => setWeek(event.target.value)} />
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {data ? <p className="text-label text-text-secondary">Tuần từ {data.week_start_date}</p> : null}
      {data && !data.menu ? <p className="text-content text-text-secondary">Chưa có thực đơn đã công bố.</p> : null}
      {data?.menu ? (
        <ul className="flex flex-col gap-2 text-content">
          {days.map((day) => (
            <li key={day} className="flex flex-col gap-1">
              <span className="font-semibold">{WEEKDAYS[day]}</span>
              {MEALS.map(([meal, label]) => {
                const dishes = (data.menu?.items ?? [])
                  .filter((item) => item.weekday === day && item.meal_type === meal)
                  .map((item) => item.dish_name);
                return dishes.length > 0 ? (
                  <span key={meal}>
                    {label}: {dishes.join(', ')}
                  </span>
                ) : null;
              })}
            </li>
          ))}
        </ul>
      ) : null}
      {(data?.buffets ?? []).map((buffet) => (
        <p key={buffet.id} className="text-content">
          Buffet {buffet.occasion} ngày {buffet.buffet_date}: {buffet.menu_note}
        </p>
      ))}
    </section>
  );
}
