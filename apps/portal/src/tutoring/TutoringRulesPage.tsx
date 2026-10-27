import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { tutoringApi } from './tutoring-api.js';
import { messageOf } from './TutoringProgramsPage.js';
import { VideoSettingsCard } from './VideoSettingsCard.js';

// 4. Quy định dạy thêm (DT-27 phần 27b, YCTD-252): số liệu của quy định là dữ liệu có ngày hiệu lực; văn bản đổi thì Ban Giám hiệu
// (hoặc YCTD) thêm dòng mới, không sửa mã. Mọi người dạy xem được quy định đang áp dụng
export function TutoringRulesPage() {
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const meta = useQuery({ queryKey: ['tutoring-meta'], queryFn: tutoringApi.meta });
  const rules = useQuery({ queryKey: ['tutoring-rules'], queryFn: tutoringApi.rules });
  const [form, setForm] = useState({ effective_from: '', max: '2', blocked: 'TH', legal_basis: '' });
  const add = useMutation({
    mutationFn: () =>
      tutoringApi.addRule({
        effective_from: form.effective_from,
        max_curriculum_periods_per_week: Number(form.max),
        curriculum_blocked_levels: form.blocked
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        legal_basis: form.legal_basis,
      }),
    onSuccess: async () => {
      setToastMessage('Đã ghi quy định mới');
      await queryClient.invalidateQueries({ queryKey: ['tutoring-rules'] });
    },
  });
  const current = rules.data?.current;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/tutoring/rules')}</h1>
        {rules.error ? <Alert tone="danger">{messageOf(rules.error)}</Alert> : null}
        {current ? (
          <dl aria-label="Quy định đang áp dụng" className="grid gap-1 text-content sm:grid-cols-[320px_1fr]">
            <dt className="text-text-secondary">Áp dụng từ</dt>
            <dd>{current.effectiveFrom}</dd>
            <dt className="text-text-secondary">Số tiết tối đa mỗi tuần mỗi môn (môn học)</dt>
            <dd>{current.maxCurriculumPeriodsPerWeek}</dd>
            <dt className="text-text-secondary">Cấp không tổ chức dạy thêm môn học</dt>
            <dd>{current.curriculumBlockedLevels.join(', ') || 'Không'}</dd>
            <dt className="text-text-secondary">Dạy thêm môn học trong nhà trường</dt>
            <dd>Không thu tiền của học sinh</dd>
          </dl>
        ) : null}
        <table aria-label="Lịch sử quy định" className="w-full text-content">
          <tbody>
            {(rules.data?.rules ?? []).map((rule) => (
              <tr key={rule.id}>
                <td>{rule.effective_from}</td>
                <td>{rule.max_curriculum_periods_per_week} tiết</td>
                <td>{rule.curriculum_blocked_levels.join(', ')}</td>
                <td>{rule.legal_basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {meta.data?.can_manage ? (
          <form
            aria-label="Thêm quy định có ngày hiệu lực"
            className="flex flex-col gap-2 rounded-lg border border-border p-4"
            onSubmit={(event) => {
              event.preventDefault();
              add.mutate();
            }}
          >
            {add.error ? <Alert tone="danger">{messageOf(add.error)}</Alert> : null}
            <label className="flex flex-col text-label">
              Ngày hiệu lực
              <input
                type="date"
                className={FORM_CONTROL_CLASS}
                value={form.effective_from}
                onChange={(event) => setForm({ ...form, effective_from: event.target.value })}
              />
            </label>
            <label className="flex flex-col text-label">
              Số tiết tối đa mỗi tuần mỗi môn
              <input
                inputMode="numeric"
                className={FORM_CONTROL_CLASS}
                value={form.max}
                onChange={(event) => setForm({ ...form, max: event.target.value })}
              />
            </label>
            <label className="flex flex-col text-label">
              Cấp không tổ chức dạy thêm môn học (cách nhau dấu phẩy)
              <input
                className={FORM_CONTROL_CLASS}
                value={form.blocked}
                onChange={(event) => setForm({ ...form, blocked: event.target.value })}
              />
            </label>
            <label className="flex flex-col text-label">
              Căn cứ (số hiệu văn bản)
              <input
                className={FORM_CONTROL_CLASS}
                value={form.legal_basis}
                onChange={(event) => setForm({ ...form, legal_basis: event.target.value })}
              />
            </label>
            <Button type="submit" variant="primary">
              Ghi quy định
            </Button>
          </form>
        ) : null}
        <VideoSettingsCard notify={setToastMessage} />
      </div>
    </AppShell>
  );
}
