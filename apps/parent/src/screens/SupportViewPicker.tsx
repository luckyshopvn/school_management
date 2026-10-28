import { useEffect, useState } from 'react';
import { Alert } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Chế độ xem của nhân viên hỗ trợ ở ứng dụng phụ huynh (YCTD-315b): quản trị nền tảng vào thẳng không đăng nhập thành một phụ huynh
// cụ thể; chọn lớp rồi học sinh để xem thẻ của học sinh như phụ huynh thấy. Phiên ở kênh phụ huynh luôn chỉ đọc (máy chủ chặn ghi)
interface Option {
  id: string;
  name: string;
}

export function SupportViewPicker({ onPick }: { onPick(classId: string, childId: string): void }) {
  const [classes, setClasses] = useState<Option[]>();
  const [students, setStudents] = useState<Option[]>();
  const [classId, setClassId] = useState('');
  const [childId, setChildId] = useState('');
  const [error, setError] = useState<string>();
  const fail = (caught: unknown) =>
    setError(caught instanceof ApiError ? caught.message : 'Không kết nối được tới máy chủ, vui lòng thử lại');

  useEffect(() => {
    requestJson<{ items: Option[] }>('/api/v1/support-view/classes')
      .then((page) => setClasses(page.items))
      .catch(fail);
  }, []);

  useEffect(() => {
    setChildId('');
    if (!classId) {
      setStudents(undefined);
      return;
    }
    requestJson<{ items: Array<{ id: string; full_name: string }> }>(`/api/v1/support-view/classes/${classId}/students`)
      .then((page) => setStudents(page.items.map((item) => ({ id: item.id, name: item.full_name }))))
      .catch(fail);
  }, [classId]);

  return (
    <section
      aria-label="Chế độ xem hỗ trợ"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <p className="text-label text-text-secondary">
        Chế độ xem của nhân viên hỗ trợ (chỉ đọc): chọn lớp, rồi chọn học sinh để xem như phụ huynh thấy.
      </p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Lớp
        <select
          className="min-h-11 rounded-lg border border-border bg-card px-3"
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
        >
          <option value="">{classes ? 'Chọn lớp' : 'Đang tải…'}</option>
          {(classes ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {students ? (
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Học sinh
          <select
            className="min-h-11 rounded-lg border border-border bg-card px-3"
            value={childId}
            onChange={(event) => {
              setChildId(event.target.value);
              if (event.target.value) {
                onPick(classId, event.target.value);
              }
            }}
          >
            <option value="">{students.length ? 'Chọn học sinh' : 'Lớp chưa có học sinh'}</option>
            {students.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </section>
  );
}
