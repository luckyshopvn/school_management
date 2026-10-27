import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SchoolLevelCode } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError, requestJson } from '../session/api-client.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';

// 9.6 Bài về nhà (DT-28 phần 28f, YCTD-276): khối lượng bài về nhà của lớp theo tuần (mọi môn, theo ngày đến hạn) cho chủ nhiệm,
// giáo viên của lớp, Ban Giám hiệu; quy tắc khối lượng do Ban Giám hiệu đặt theo cấp, khối (GD-143, Eric chốt 2026-10-26: nền tảng
// không đặt giới hạn mặc định, trường chưa đặt thì không chặn, không cảnh báo; trường tự đối chiếu quy định và ghi căn cứ). Bảng mẫu
// gợi ý ở hướng dẫn sử dụng, không bật sẵn
interface Policy {
  id: string;
  school_level: 'TH' | 'THCS' | 'THPT';
  grade: number;
  no_homework: boolean;
  max_items_per_day: number | null;
  max_minutes_per_day: number | null;
  blocked_weekdays: number[];
  skip_holidays: boolean;
  action: 'warn' | 'block';
  basis: string | null;
  updated_by_name: string;
}

interface Workload {
  class: { name: string };
  policy: Policy | null;
  days: Array<{
    date: string;
    weekday: number;
    count: number;
    minutes: number;
    items: Array<{ activity_id: string; title: string; subject_name: string | null; minutes: number | null }>;
  }>;
}

const WEEKDAYS = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
const todayInVietnam = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value));

function policyText(policy: Policy) {
  const parts = [
    policy.no_homework ? 'không giao bài về nhà' : null,
    policy.max_items_per_day ? `tối đa ${policy.max_items_per_day} bài mỗi ngày` : null,
    policy.max_minutes_per_day ? `tối đa ${policy.max_minutes_per_day} phút mỗi ngày` : null,
    policy.blocked_weekdays.length > 0
      ? `không để hạn vào ${policy.blocked_weekdays.map((day) => WEEKDAYS[day]).join(', ')}`
      : null,
    policy.skip_holidays ? 'không để hạn vào ngày lễ' : null,
  ].filter(Boolean);
  return `${parts.join('; ') || 'chưa có giới hạn'} · ${policy.action === 'block' ? 'chặn' : 'cảnh báo'}`;
}

function WorkloadSection() {
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.filter((level) => level.value !== 'MN').map((level) => level.value as SchoolLevelCode);
  const [classId, setClassId] = useState('');
  const [from, setFrom] = useState(todayInVietnam());
  const classes = useQuery({
    queryKey: ['classes', 'homework-levels', levels.join(',')],
    queryFn: async () =>
      (
        await Promise.all(
          levels.map((level) =>
            requestJson<Array<{ id: string; name: string }>>(`/api/v1/classes?school_level=${level}&status=active`),
          ),
        )
      ).flat(),
    enabled: levels.length > 0,
  });
  const workload = useQuery({
    queryKey: ['homework-workload', classId, from],
    queryFn: () => requestJson<Workload>(`/api/v1/learning/homework/workload?class_id=${classId}&from=${from}`),
    enabled: classId !== '',
  });
  return (
    <section className="flex flex-col gap-3" aria-label="Khối lượng theo lớp">
      <h2 className="text-section-title font-semibold text-text">Khối lượng bài về nhà theo lớp</h2>
      <div className="flex flex-wrap gap-3">
        <label className="text-label font-medium text-text">
          Lớp
          <select
            aria-label="Lớp"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            <option value="">Chọn lớp</option>
            {(classes.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Từ ngày
          <input
            type="date"
            aria-label="Từ ngày"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
      </div>
      {workload.error ? <Alert tone="danger">{messageOf(workload.error)}</Alert> : null}
      {workload.data ? (
        <>
          <p className="text-label text-text-secondary">
            {workload.data.policy
              ? `Quy tắc áp cho lớp: ${policyText(workload.data.policy)}`
              : 'Trường chưa đặt quy tắc cho khối của lớp.'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-content" aria-label={`Khối lượng ${workload.data.class.name}`}>
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2">Ngày đến hạn</th>
                  <th className="p-2">Số bài</th>
                  <th className="p-2">Số phút</th>
                  <th className="p-2">Bài</th>
                </tr>
              </thead>
              <tbody>
                {workload.data.days.map((day) => (
                  <tr key={day.date} className="border-b border-border">
                    <td className="p-2">
                      {WEEKDAYS[day.weekday]} {day.date.split('-').reverse().join('/')}
                    </td>
                    <td className="p-2">{day.count}</td>
                    <td className="p-2">{day.minutes}</td>
                    <td className="p-2">
                      {day.items
                        .map((item) => `${item.subject_name ? `${item.subject_name}: ` : ''}${item.title}`)
                        .join('; ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

const EMPTY_FORM = {
  school_level: 'TH' as Policy['school_level'],
  grade: '0',
  no_homework: false,
  max_items: '',
  max_minutes: '',
  weekdays: [] as number[],
  skip_holidays: false,
  action: 'warn' as Policy['action'],
  basis: '',
};

function PoliciesSection({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [reminderTime, setReminderTime] = useState<string>();
  const policies = useQuery({
    queryKey: ['homework-policies'],
    queryFn: () => requestJson<{ policies: Policy[]; reminder_time: string }>('/api/v1/learning/homework/policies'),
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['homework-policies'] });
  const save = useMutation({
    mutationFn: () =>
      requestJson('/api/v1/learning/homework/policies', {
        method: 'PUT',
        body: JSON.stringify({
          school_level: form.school_level,
          grade: Number(form.grade),
          no_homework: form.no_homework,
          max_items_per_day: numberOrNull(form.max_items),
          max_minutes_per_day: numberOrNull(form.max_minutes),
          blocked_weekdays: form.weekdays,
          skip_holidays: form.skip_holidays,
          action: form.action,
          basis: form.basis,
        }),
      }),
    onSuccess: () => {
      setForm(EMPTY_FORM);
      void refresh();
      onSaved('Đã lưu quy tắc bài về nhà');
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => requestJson(`/api/v1/learning/homework/policies/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void refresh();
      onSaved('Đã bỏ quy tắc');
    },
  });
  const saveTime = useMutation({
    mutationFn: (value: string) =>
      requestJson('/api/v1/learning/homework/reminder-time', {
        method: 'PUT',
        body: JSON.stringify({ reminder_time: value }),
      }),
    onSuccess: () => {
      void refresh();
      onSaved('Đã lưu giờ nhắc');
    },
  });
  if (policies.error instanceof ApiError && policies.error.status === 403) {
    return null;
  }
  const error = save.error ?? remove.error ?? saveTime.error ?? policies.error;
  return (
    <section className="flex flex-col gap-3" aria-label="Quy tắc bài về nhà của trường">
      <h2 className="text-section-title font-semibold text-text">Quy tắc bài về nhà của trường</h2>
      <Alert tone="info">
        Nền tảng không đặt giới hạn sẵn. Trường tự đối chiếu văn bản của Sở, của trường và ghi căn cứ; chưa đặt quy tắc
        thì giáo viên giao bài không bị chặn, không bị cảnh báo.
      </Alert>
      <details className="rounded-lg border border-border bg-card p-3 text-label text-text">
        <summary className="font-semibold">Bảng mẫu gợi ý để tham khảo (chưa xác minh, không bật sẵn)</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
          <li>
            Lớp 1: không giao bài tập về nhà (theo Công văn 3977 của Bộ Giáo dục và Đào tạo, chưa xác minh văn bản đang
            áp dụng). Nếu dùng: chọn cấp Tiểu học, khối 1, đánh dấu &quot;Khối không giao bài về nhà&quot;.
          </li>
          <li>Ngưỡng số bài, số phút mỗi ngày theo cấp, khối: trường tự đặt theo văn bản của Sở, của trường.</li>
          <li>Ghi số hiệu văn bản vào ô Căn cứ để giáo viên biết vì sao bị cảnh báo hoặc chặn.</li>
        </ul>
      </details>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <ul className="flex flex-col gap-2" aria-label="Các quy tắc">
        {(policies.data?.policies ?? []).map((policy) => (
          <li key={policy.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
            <span className="flex-1 text-content">
              <span className="font-semibold">
                {policy.school_level} · {policy.grade === 0 ? 'mọi khối' : `khối ${policy.grade}`}
              </span>
              : {policyText(policy)}
              {policy.basis ? ` · căn cứ: ${policy.basis}` : ''}
            </span>
            <Button variant="text" onClick={() => remove.mutate(policy.id)}>
              Bỏ quy tắc
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-3">
        <label className="text-label font-medium text-text">
          Cấp
          <select
            aria-label="Cấp"
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            value={form.school_level}
            onChange={(event) => setForm({ ...form, school_level: event.target.value as Policy['school_level'] })}
          >
            <option value="TH">Tiểu học</option>
            <option value="THCS">THCS</option>
            <option value="THPT">THPT</option>
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Khối (0 là mọi khối của cấp)
          <input
            type="number"
            min={0}
            max={12}
            aria-label="Khối"
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            value={form.grade}
            onChange={(event) => setForm({ ...form, grade: event.target.value })}
          />
        </label>
        <label className="text-label font-medium text-text">
          Khi vượt
          <select
            aria-label="Khi vượt"
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            value={form.action}
            onChange={(event) => setForm({ ...form, action: event.target.value as Policy['action'] })}
          >
            <option value="warn">Cảnh báo, giáo viên xác nhận vẫn giao</option>
            <option value="block">Chặn, Ban Giám hiệu cho vượt có lý do</option>
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Số bài tối đa mỗi ngày
          <input
            type="number"
            min={1}
            max={20}
            aria-label="Số bài tối đa mỗi ngày"
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            value={form.max_items}
            onChange={(event) => setForm({ ...form, max_items: event.target.value })}
          />
        </label>
        <label className="text-label font-medium text-text">
          Số phút tối đa mỗi ngày
          <input
            type="number"
            min={5}
            max={600}
            aria-label="Số phút tối đa mỗi ngày"
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            value={form.max_minutes}
            onChange={(event) => setForm({ ...form, max_minutes: event.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-label text-text">
          <input
            type="checkbox"
            checked={form.no_homework}
            onChange={(event) => setForm({ ...form, no_homework: event.target.checked })}
          />
          Khối không giao bài về nhà
        </label>
        <fieldset className="flex flex-wrap gap-2 text-label text-text md:col-span-2">
          <legend className="font-medium">Không để hạn vào</legend>
          {WEEKDAYS.slice(1).map((label, index) => (
            <label key={label} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={form.weekdays.includes(index + 1)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    weekdays: event.target.checked
                      ? [...form.weekdays, index + 1]
                      : form.weekdays.filter((day) => day !== index + 1),
                  })
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-2 text-label text-text">
          <input
            type="checkbox"
            checked={form.skip_holidays}
            onChange={(event) => setForm({ ...form, skip_holidays: event.target.checked })}
          />
          Không để hạn vào ngày lễ
        </label>
        <label className="text-label font-medium text-text md:col-span-3">
          Căn cứ (văn bản của Sở, của trường)
          <textarea
            aria-label="Căn cứ"
            className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
            value={form.basis}
            onChange={(event) => setForm({ ...form, basis: event.target.value })}
          />
        </label>
        <div>
          <Button variant="primary" onClick={() => save.mutate()}>
            Lưu quy tắc
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-label font-medium text-text">
          Giờ nhắc bài sắp đến hạn (hôm trước)
          <input
            type="time"
            aria-label="Giờ nhắc"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={reminderTime ?? policies.data?.reminder_time ?? '19:00'}
            onChange={(event) => setReminderTime(event.target.value)}
          />
        </label>
        <Button
          variant="secondary"
          disabled={!reminderTime}
          onClick={() => reminderTime && saveTime.mutate(reminderTime)}
        >
          Lưu giờ nhắc
        </Button>
        <span className="text-label text-text-secondary">Không gửi nhắc từ 21:00 đến 6:00.</span>
      </div>
    </section>
  );
}

export function HomeworkPage() {
  const [toastMessage, setToastMessage] = useState<string>();
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={() => setToastMessage(undefined)} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/online-homework')}</h1>
        <WorkloadSection />
        <PoliciesSection onSaved={setToastMessage} />
      </div>
    </AppShell>
  );
}
