import { useCallback, useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import type { MyClass } from './ClassesScreen.js';

// MG-14 Báo cơm của lớp (P12-07; BR-58; YCTD-76): giáo viên chủ nhiệm báo số suất ăn của lớp trong ngày cho bếp khi chưa chốt
// điểm danh; mặc định là số trẻ có mặt đã lưu trên bảng điểm danh. Chốt điểm danh rồi thì số suất lấy theo điểm danh
interface MealReportView {
  class_name: string;
  date: string;
  enrolled_count: number;
  attendance_meal_count: number;
  day_locked: boolean;
  headcount: number;
  source: 'attendance_locked' | 'meal_report' | 'attendance_open';
  report: { headcount: number; reported_at: string; note: string | null } | null;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join(': ')
    : 'Không kết nối được tới máy chủ';
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export function MealReportScreen({ myClass, onBack }: { myClass: MyClass; onBack(): void }) {
  const [date, setDate] = useState(today);
  const [view, setView] = useState<MealReportView>();
  const [headcount, setHeadcount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean }>();

  const load = useCallback(async () => {
    try {
      const loaded = await requestJson<MealReportView>(`/api/v1/classes/${myClass.id}/meal-report?date=${date}`);
      setView(loaded);
      setHeadcount(String(loaded.report?.headcount ?? loaded.attendance_meal_count));
      setNote(loaded.report?.note ?? '');
    } catch (error) {
      setMessage({ text: messageOf(error), failed: true });
    }
  }, [myClass.id, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    try {
      await requestJson(`/api/v1/classes/${myClass.id}/meal-report`, {
        method: 'POST',
        body: JSON.stringify({ date, headcount: Number(headcount), note: note || null }),
      });
      setMessage({ text: `Đã báo ${headcount} suất cho bếp`, failed: false });
      await load();
    } catch (error) {
      setMessage({ text: messageOf(error), failed: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-page">
      <ApplicationHeader title={`Báo cơm lớp ${myClass.name}`} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4">
        <div>
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
        </div>
        {message ? <Alert tone={message.failed ? 'danger' : 'success'}>{message.text}</Alert> : null}
        <TextField label="Ngày" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        {view ? (
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Báo cơm">
            <p className="text-content text-text">
              Sĩ số {view.enrolled_count} trẻ; có mặt theo điểm danh đã lưu {view.attendance_meal_count} trẻ.
            </p>
            {view.report ? (
              <p className="text-content text-text-secondary">Đã báo {view.report.headcount} suất cho bếp.</p>
            ) : null}
            {view.day_locked ? (
              <Alert tone="info">Điểm danh đã chốt: bếp tính {view.headcount} suất theo điểm danh.</Alert>
            ) : (
              <>
                <TextField
                  label="Số suất mỗi bữa"
                  inputMode="numeric"
                  value={headcount}
                  onChange={(event) => setHeadcount(event.target.value.replace(/\D/g, ''))}
                />
                <TextField label="Ghi chú cho bếp" value={note} onChange={(event) => setNote(event.target.value)} />
                <Button variant="primary" disabled={busy || headcount === ''} onClick={() => void submit()}>
                  Gửi báo cơm
                </Button>
              </>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
