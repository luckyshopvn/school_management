import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { messageOf, selectClass } from '../work/work-api.js';
import {
  confirmCompletion,
  exportCompletion,
  readCompletionClass,
  readCompletionStatistics,
  recordCompletion,
  RESULT_LABELS,
  unconfirmCompletion,
  type CompletionClassDetail,
  type CompletionResult,
} from './program-completion-api.js';

// Quản lý hoàn thành chương trình giáo dục mầm non (YCTD-102): giáo viên chủ nhiệm, quản lý đơn vị ghi kết quả từng trẻ lớp
// mẫu giáo 5-6 tuổi (có thể đánh dấu cả lớp), Ban Giám hiệu xác nhận để khóa danh sách; thống kê tỷ lệ theo lớp, đơn vị;
// xuất danh sách ra Excel
type Draft = Record<string, { result: CompletionResult | ''; note: string }>;

function draftOf(detail: CompletionClassDetail): Draft {
  return Object.fromEntries(
    detail.children.map((child) => [child.child_id, { result: child.result ?? '', note: child.note ?? '' }]),
  );
}

function ClassPanel({ classId, onChanged }: { classId: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ['program-completion', 'class', classId],
    queryFn: () => readCompletionClass(classId),
  });
  const [draft, setDraft] = useState<Draft>({});
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (detail.data) {
      setDraft(draftOf(detail.data));
    }
  }, [detail.data]);
  const refreshed = (message: string) => (data: CompletionClassDetail) => {
    queryClient.setQueryData(['program-completion', 'class', classId], data);
    onChanged(message);
  };
  const save = useMutation({
    mutationFn: () =>
      recordCompletion(
        classId,
        Object.entries(draft)
          .filter(([, value]) => value.result !== '')
          .map(([childId, value]) => ({
            child_id: childId,
            result: value.result as CompletionResult,
            note: value.note.trim() || null,
          })),
      ),
    onSuccess: refreshed('Đã lưu kết quả hoàn thành chương trình'),
  });
  const confirm = useMutation({
    mutationFn: () => confirmCompletion(classId),
    onSuccess: refreshed('Đã xác nhận danh sách của lớp'),
  });
  const unconfirm = useMutation({
    mutationFn: () => unconfirmCompletion(classId, reason),
    onSuccess: (data) => {
      setReason('');
      refreshed('Đã hủy xác nhận danh sách của lớp')(data);
    },
  });
  const download = useMutation({ mutationFn: () => exportCompletion({ classId }) });
  const error = [detail.error, save.error, confirm.error, unconfirm.error, download.error].find(Boolean);
  const data = detail.data;
  if (!data) {
    return error ? <Alert tone="danger">{messageOf(error)}</Alert> : null;
  }
  const editable = data.can_manage && !data.confirmed;
  const marked = Object.values(draft).filter((value) => value.result !== '').length;
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label={`Danh sách lớp ${data.name}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-section-title font-semibold text-text">Lớp {data.name}</h2>
        <span>
          {data.confirmed
            ? `Đã xác nhận bởi ${data.confirmed_by_name ?? ''}`
            : `Chưa xác nhận · đã ghi ${data.children_count - data.unmarked_count}/${data.children_count} trẻ`}
        </span>
        <Button className="ml-auto" disabled={download.isPending} onClick={() => download.mutate()}>
          Xuất Excel
        </Button>
      </div>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <table className="w-full text-content" aria-label={`Kết quả hoàn thành chương trình lớp ${data.name}`}>
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Họ tên trẻ</th>
            <th>Ngày sinh</th>
            <th>Kết quả</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {data.children.map((child) => {
            const value = draft[child.child_id] ?? { result: '', note: '' };
            return (
              <tr key={child.child_id} className="border-t border-border" aria-label={`Trẻ ${child.full_name}`}>
                <td className="py-2">{child.full_name}</td>
                <td>{child.dob}</td>
                <td>
                  {editable ? (
                    <select
                      aria-label={`Kết quả ${child.full_name}`}
                      value={value.result}
                      className={selectClass}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [child.child_id]: { ...value, result: event.target.value as CompletionResult | '' },
                        }))
                      }
                    >
                      <option value="">Chưa ghi</option>
                      {(Object.keys(RESULT_LABELS) as CompletionResult[]).map((result) => (
                        <option key={result} value={result}>
                          {RESULT_LABELS[result]}
                        </option>
                      ))}
                    </select>
                  ) : child.result ? (
                    RESULT_LABELS[child.result]
                  ) : (
                    'Chưa ghi'
                  )}
                </td>
                <td>
                  {editable ? (
                    <input
                      aria-label={`Ghi chú ${child.full_name}`}
                      value={value.note}
                      maxLength={500}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [child.child_id]: { ...value, note: event.target.value },
                        }))
                      }
                    />
                  ) : (
                    (child.note ?? '')
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {data.children.length === 0 ? <p className="text-text-secondary">Lớp chưa có trẻ đang học.</p> : null}
      <div className="flex flex-wrap items-end gap-3">
        {editable ? (
          <>
            <Button
              onClick={() =>
                setDraft((current) =>
                  Object.fromEntries(
                    Object.entries(current).map(([childId, value]) => [childId, { ...value, result: 'completed' }]),
                  ),
                )
              }
            >
              Đánh dấu cả lớp hoàn thành
            </Button>
            <Button variant="primary" disabled={save.isPending || marked === 0} onClick={() => save.mutate()}>
              Lưu kết quả
            </Button>
          </>
        ) : null}
        {data.can_approve && !data.confirmed ? (
          <Button
            variant={editable ? 'secondary' : 'primary'}
            disabled={confirm.isPending || data.unmarked_count > 0 || data.children_count === 0}
            onClick={() => confirm.mutate()}
          >
            Xác nhận danh sách
          </Button>
        ) : null}
        {data.can_approve && data.confirmed ? (
          <>
            <TextField label="Lý do hủy xác nhận" value={reason} onChange={(event) => setReason(event.target.value)} />
            <Button
              variant="danger"
              disabled={unconfirm.isPending || reason.trim() === ''}
              onClick={() => unconfirm.mutate()}
            >
              Hủy xác nhận
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}

export function ProgramCompletionPage() {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const [orgUnitId, setOrgUnitId] = useState('');
  const [classId, setClassId] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const statistics = useQuery({
    queryKey: ['program-completion', 'statistics', orgUnitId],
    queryFn: () => readCompletionStatistics(orgUnitId),
  });
  const download = useMutation({ mutationFn: () => exportCompletion({ orgUnitId: orgUnitId || undefined }) });
  const changed = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ['program-completion', 'statistics'] });
    setToastMessage(message);
  };
  const data = statistics.data;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">Hoàn thành chương trình giáo dục mầm non</h1>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-label font-medium text-text">
            Đơn vị
            <select
              value={orgUnitId}
              className={selectClass}
              onChange={(event) => {
                setOrgUnitId(event.target.value);
                setClassId(undefined);
              }}
            >
              <option value="">Tất cả trong phạm vi</option>
              {unitChoice.units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={download.isPending} onClick={() => download.mutate()}>
            Xuất Excel các lớp
          </Button>
        </div>
        {[statistics.error, download.error].find(Boolean) ? (
          <Alert tone="danger">{messageOf([statistics.error, download.error].find(Boolean))}</Alert>
        ) : null}
        {data ? (
          <section className="flex flex-col gap-2 rounded-lg bg-card p-4" aria-label="Thống kê hoàn thành chương trình">
            <h2 className="text-section-title font-semibold text-text">Thống kê</h2>
            <p>
              Toàn phạm vi: {data.total.completed_count}/{data.total.children_count} trẻ hoàn thành (
              {data.total.completion_rate}%), chưa hoàn thành {data.total.not_completed_count}, chưa ghi{' '}
              {data.total.unmarked_count}
            </p>
            <table className="w-full text-content">
              <thead>
                <tr className="text-left text-text-secondary">
                  <th className="py-2">Đơn vị</th>
                  <th>Số lớp</th>
                  <th>Lớp đã xác nhận</th>
                  <th>Số trẻ</th>
                  <th>Hoàn thành</th>
                  <th>Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {data.units.map((unit) => (
                  <tr key={unit.org_unit_id} className="border-t border-border">
                    <td className="py-2">{unit.org_unit_name}</td>
                    <td>{unit.class_count}</td>
                    <td>{unit.confirmed_class_count}</td>
                    <td>{unit.children_count}</td>
                    <td>{unit.completed_count}</td>
                    <td>{unit.completion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
        <section className="flex flex-col gap-2 rounded-lg bg-card p-4" aria-label="Lớp mẫu giáo 5-6 tuổi">
          <h2 className="text-section-title font-semibold text-text">Lớp mẫu giáo 5-6 tuổi</h2>
          <table className="w-full text-content">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-2">Lớp</th>
                <th>Đơn vị</th>
                <th>Số trẻ</th>
                <th>Hoàn thành</th>
                <th>Chưa hoàn thành</th>
                <th>Chưa ghi</th>
                <th>Tỷ lệ</th>
                <th>Xác nhận</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.classes ?? []).map((row) => (
                <tr key={row.id} className="border-t border-border" aria-label={`Lớp ${row.name}`}>
                  <td className="py-2">{row.name}</td>
                  <td>{row.org_unit_name}</td>
                  <td>{row.children_count}</td>
                  <td>{row.completed_count}</td>
                  <td>{row.not_completed_count}</td>
                  <td>{row.unmarked_count}</td>
                  <td>{row.completion_rate}%</td>
                  <td>{row.confirmed ? 'Đã xác nhận' : 'Chưa xác nhận'}</td>
                  <td>
                    <Button variant="text" onClick={() => setClassId(row.id)}>
                      Mở lớp {row.name}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.classes.length === 0 ? (
            <p className="text-text-secondary">Không có lớp mẫu giáo 5-6 tuổi trong phạm vi.</p>
          ) : null}
        </section>
        {classId ? <ClassPanel key={classId} classId={classId} onChanged={changed} /> : null}
      </div>
    </AppShell>
  );
}
