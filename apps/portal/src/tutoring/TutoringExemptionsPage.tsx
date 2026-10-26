import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { fetchWithSession } from '../session/api-client.js';
import { tutoringApi } from './tutoring-api.js';
import { messageOf } from './TutoringProgramsPage.js';

// 3. Quyết định tăng thời lượng (DT-27 phần 27b, YCTD-252; Thông tư 19/2026 Điều 2): học sinh thuộc nhóm đối tượng cần học hơn 02
// tiết/tuần một môn thì Giám đốc Sở quyết định theo đề nghị của Hiệu trưởng; Ban Giám hiệu nhập số, ngày, môn, số tiết tối đa mới,
// tệp quyết định, học sinh áp dụng
export function TutoringExemptionsPage() {
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const meta = useQuery({ queryKey: ['tutoring-meta'], queryFn: tutoringApi.meta });
  const exemptions = useQuery({ queryKey: ['tutoring-exemptions'], queryFn: tutoringApi.exemptions });
  const [form, setForm] = useState({
    decision_no: '',
    decision_date: '',
    subject_id: '',
    max_periods_per_week: '3',
    child_ids: '',
    note: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const create = useMutation({
    mutationFn: () => {
      const data = new FormData();
      for (const [key, value] of Object.entries(form)) {
        data.append(key, value);
      }
      if (file) {
        data.append('file', file);
      }
      return tutoringApi.createExemption(data);
    },
    onSuccess: async () => {
      setToastMessage('Đã ghi quyết định của Sở');
      setForm({
        decision_no: '',
        decision_date: '',
        subject_id: '',
        max_periods_per_week: '3',
        child_ids: '',
        note: '',
      });
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ['tutoring-exemptions'] });
    },
  });
  const download = async (id: string, name: string) => {
    const response = await fetchWithSession(`/api/v1/tutoring/exemptions/${id}/file`);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/tutoring/exemptions')}</h1>
        {exemptions.error ? <Alert tone="danger">{messageOf(exemptions.error)}</Alert> : null}
        <table aria-label="Quyết định tăng thời lượng" className="w-full text-content">
          <thead>
            <tr className="text-left text-text-secondary">
              <th>Số quyết định</th>
              <th>Ngày</th>
              <th>Môn</th>
              <th>Tối đa tiết/tuần</th>
              <th>Học sinh</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(exemptions.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.decision_no}</td>
                <td>{row.decision_date}</td>
                <td>{row.subject_name}</td>
                <td>{row.max_periods_per_week}</td>
                <td>{row.children.map((child) => child.full_name).join(', ')}</td>
                <td>
                  {row.file_name ? (
                    <Button onClick={() => void download(row.id, row.file_name as string)}>Tải tệp</Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          aria-label="Ghi quyết định của Sở"
          className="flex flex-col gap-2 rounded-lg border border-border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
          <label className="flex flex-col text-label">
            Số quyết định
            <input
              className={FORM_CONTROL_CLASS}
              value={form.decision_no}
              onChange={(event) => setForm({ ...form, decision_no: event.target.value })}
            />
          </label>
          <label className="flex flex-col text-label">
            Ngày quyết định
            <input
              type="date"
              className={FORM_CONTROL_CLASS}
              value={form.decision_date}
              onChange={(event) => setForm({ ...form, decision_date: event.target.value })}
            />
          </label>
          <label className="flex flex-col text-label">
            Môn
            <select
              className={FORM_CONTROL_CLASS}
              value={form.subject_id}
              onChange={(event) => setForm({ ...form, subject_id: event.target.value })}
            >
              <option value="">Chọn môn</option>
              {(meta.data?.subjects ?? []).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.school_level} · {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-label">
            Số tiết tối đa mỗi tuần
            <input
              inputMode="numeric"
              className={FORM_CONTROL_CLASS}
              value={form.max_periods_per_week}
              onChange={(event) => setForm({ ...form, max_periods_per_week: event.target.value })}
            />
          </label>
          <label className="flex flex-col text-label">
            Mã học sinh áp dụng (cách nhau dấu phẩy)
            <input
              className={FORM_CONTROL_CLASS}
              value={form.child_ids}
              onChange={(event) => setForm({ ...form, child_ids: event.target.value })}
            />
          </label>
          <label className="flex flex-col text-label">
            Tệp quyết định
            <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <label className="flex flex-col text-label">
            Ghi chú
            <input
              className={FORM_CONTROL_CLASS}
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </label>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            Ghi quyết định
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
