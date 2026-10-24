import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { messageOf, NO_LEVEL_MESSAGE, ScopeFilters, useExamScope } from './exam-filters.js';
import {
  createPlan,
  listPlans,
  planAction,
  PLAN_FORM_LABELS,
  PLAN_KIND_LABELS,
  PLAN_STATUS_LABELS,
} from './exams-api.js';

// 8.3 Kế hoạch kiểm tra (DT-21 phần 22g1, YCTD-168): kế hoạch theo học kỳ, khối, môn (thường xuyên, giữa kỳ, cuối kỳ;
// hình thức, thời gian, ngày); tổ trưởng lập, gửi; Ban giám hiệu duyệt hoặc trả lại; số đề đã giao, đã khoá; nhắc trùng tiết
// với thời khoá biểu đang áp dụng
export function AssessmentPlansPage() {
  const scope = useExamScope();
  const reviewer = useHasPermission(PERMISSION_CODES.examReview);
  const manager = useHasPermission(PERMISSION_CODES.examManage);
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const plans = useQuery({
    queryKey: ['assessment-plans', scope.level],
    queryFn: () => listPlans(scope.level ?? 'THCS'),
    enabled: Boolean(scope.level),
  });
  const [form, setForm] = useState({
    term: 'HK1',
    kind: 'midterm',
    form: 'mixed',
    duration_minutes: '90',
    planned_date: '',
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['assessment-plans'] });
    setToastMessage(message);
  };
  const create = useMutation({
    mutationFn: () =>
      createPlan({
        school_level: scope.level,
        subject_id: scope.subjectId,
        grade_level_code: scope.grade,
        term: form.term,
        kind: form.kind,
        form: form.form,
        duration_minutes: Number(form.duration_minutes),
        planned_date: form.planned_date || null,
      }),
    onSuccess: () => refresh('Đã thêm kế hoạch kiểm tra'),
  });
  const act = useMutation({
    mutationFn: (input: { id: string; action: 'submit' | 'decide'; body?: unknown; message: string }) =>
      planAction(input.id, input.action, input.body),
    onSuccess: (_data, input) => refresh(input.message),
  });
  const select = (label: string, key: keyof typeof form, options: Record<string, string>) => (
    <label className="text-label font-medium text-text">
      {label}
      <select
        aria-label={label}
        className={`mt-2 block ${FORM_CONTROL_CLASS}`}
        value={form[key]}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      >
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/assessment-plans')}</h1>
        {!scope.level ? (
          <Alert tone="info">{NO_LEVEL_MESSAGE}</Alert>
        ) : (
          <>
            {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
            <div className="overflow-x-auto">
              <table className="w-full text-content" aria-label="Kế hoạch kiểm tra">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Học kỳ</th>
                    <th className="px-3 py-2">Khối</th>
                    <th className="px-3 py-2">Môn</th>
                    <th className="px-3 py-2">Loại</th>
                    <th className="px-3 py-2">Hình thức</th>
                    <th className="px-3 py-2">Thời gian</th>
                    <th className="px-3 py-2">Ngày</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2">Đề</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(plans.data ?? []).map((plan) => (
                    <tr key={plan.id} className="border-t border-border align-top">
                      <td className="px-3 py-2">{plan.term === 'HK1' ? 'Học kỳ I' : 'Học kỳ II'}</td>
                      <td className="px-3 py-2">{plan.grade_level_code}</td>
                      <td className="px-3 py-2">{plan.subject_name}</td>
                      <td className="px-3 py-2">{PLAN_KIND_LABELS[plan.kind]}</td>
                      <td className="px-3 py-2">{PLAN_FORM_LABELS[plan.form]}</td>
                      <td className="px-3 py-2">{plan.duration_minutes} phút</td>
                      <td className="px-3 py-2">
                        {plan.planned_date?.split('-').reverse().join('/') ?? ''}
                        {plan.timetable_note ? (
                          <span className="block text-label text-text-secondary">{plan.timetable_note}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          tone={plan.status === 'approved' ? 'success' : 'neutral'}
                          label={PLAN_STATUS_LABELS[plan.status] ?? plan.status}
                        />
                        {plan.review_note ? <span className="block text-label">{plan.review_note}</span> : null}
                      </td>
                      <td className="px-3 py-2">
                        {plan.exam_count} đề, {plan.locked_count} đã khoá
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(reviewer || manager) && (plan.status === 'draft' || plan.status === 'rejected') ? (
                          <Button
                            variant="text"
                            onClick={() =>
                              act.mutate({ id: plan.id, action: 'submit', message: 'Đã gửi duyệt kế hoạch' })
                            }
                          >
                            Gửi duyệt
                          </Button>
                        ) : null}
                        {manager && plan.status === 'submitted' ? (
                          <>
                            <Button
                              variant="text"
                              onClick={() =>
                                act.mutate({
                                  id: plan.id,
                                  action: 'decide',
                                  body: { decision: 'approve' },
                                  message: 'Đã duyệt kế hoạch',
                                })
                              }
                            >
                              Duyệt
                            </Button>
                            <Button
                              variant="text"
                              onClick={() => {
                                const note = window.prompt('Lý do trả lại');
                                if (note) {
                                  act.mutate({
                                    id: plan.id,
                                    action: 'decide',
                                    body: { decision: 'return', note },
                                    message: 'Đã trả lại kế hoạch',
                                  });
                                }
                              }}
                            >
                              Trả lại
                            </Button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {plans.data && plans.data.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-2 text-text-secondary">
                        Chưa có kế hoạch kiểm tra.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {reviewer || manager ? (
              <section className="flex flex-col gap-3" aria-label="Thêm kế hoạch kiểm tra">
                <h2 className="text-section-title font-semibold text-text">Thêm kế hoạch kiểm tra</h2>
                {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
                <ScopeFilters scope={scope} />
                <div className="flex flex-wrap items-end gap-3">
                  {select('Học kỳ', 'term', { HK1: 'Học kỳ I', HK2: 'Học kỳ II' })}
                  {select('Loại kiểm tra', 'kind', PLAN_KIND_LABELS)}
                  {select('Hình thức', 'form', PLAN_FORM_LABELS)}
                  <label className="text-label font-medium text-text">
                    Thời gian (phút)
                    <input
                      type="number"
                      aria-label="Thời gian (phút)"
                      className={`mt-2 block w-24 ${FORM_CONTROL_CLASS}`}
                      value={form.duration_minutes}
                      onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })}
                    />
                  </label>
                  <label className="text-label font-medium text-text">
                    Ngày kiểm tra
                    <input
                      type="date"
                      aria-label="Ngày kiểm tra"
                      className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                      value={form.planned_date}
                      onChange={(event) => setForm({ ...form, planned_date: event.target.value })}
                    />
                  </label>
                  <Button
                    variant="primary"
                    disabled={!scope.subjectId || !scope.grade || create.isPending}
                    onClick={() => create.mutate()}
                  >
                    Thêm kế hoạch
                  </Button>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
