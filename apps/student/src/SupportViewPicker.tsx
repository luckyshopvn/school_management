import { Alert, Button } from '@school-management/ui';
import { useEffect, useState } from 'react';
import { requestStudentJson, setSupportViewChild, supportViewChild } from './student-api.js';

// Chế độ xem của nhân viên hỗ trợ ở ứng dụng học sinh (YCTD-315b): quản trị nền tảng vào thẳng không đăng nhập thành một học sinh cụ
// thể; chọn lớp rồi chọn học sinh để xem ứng dụng như học sinh đó thấy, chỉ đọc (không làm bài, không nộp bài). Mọi lần xem ghi vào
// nhật ký phiên hỗ trợ ở máy chủ
interface Option {
  id: string;
  name: string;
}

export interface SupportStatus {
  support: { full_access?: boolean; operator_name: string } | null;
}

export function readSupportStatus(): Promise<SupportStatus> {
  return requestStudentJson<SupportStatus>('/api/v1/auth/me');
}

export function hasSupportViewChild(): boolean {
  return supportViewChild() !== null;
}

export function SupportViewBar({ name, onChange }: { name: string | null; onChange(): void }) {
  return (
    <div
      role="status"
      aria-label="Chế độ xem hỗ trợ"
      className="bg-header-accent px-4 py-2 text-center text-label text-text"
    >
      Chế độ xem của nhân viên hỗ trợ (chỉ đọc){name ? `: đang xem ${name}` : ''}.{' '}
      <button type="button" className="font-semibold underline" onClick={onChange}>
        Đổi học sinh
      </button>
    </div>
  );
}

export function SupportViewPicker({ onPicked }: { onPicked(name: string): void }) {
  const [classes, setClasses] = useState<Option[]>();
  const [students, setStudents] = useState<Option[]>();
  const [classId, setClassId] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    requestStudentJson<{ items: Option[] }>('/api/v1/student/support-view/classes')
      .then((page) => setClasses(page.items))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Không tải được danh sách lớp'));
  }, []);

  useEffect(() => {
    if (!classId) {
      setStudents(undefined);
      return;
    }
    requestStudentJson<{ items: Array<{ id: string; full_name: string }> }>(
      `/api/v1/student/support-view/classes/${classId}/students`,
    )
      .then((page) => setStudents(page.items.map((item) => ({ id: item.id, name: item.full_name }))))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Không tải được học sinh'));
  }, [classId]);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <h1 className="text-page-title font-bold text-text">Chọn học sinh để xem</h1>
      <p className="text-content text-text-secondary">
        Bạn đang ở chế độ xem của nhân viên hỗ trợ: chọn lớp, rồi chọn học sinh để xem ứng dụng như học sinh đó thấy.
        Chỉ xem, không làm bài, không nộp bài.
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
        students.length === 0 ? (
          <p className="text-content text-text-secondary">Lớp chưa có học sinh.</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Học sinh của lớp">
            {students.map((student) => (
              <li key={student.id}>
                <Button
                  onClick={() => {
                    setSupportViewChild(student.id);
                    onPicked(student.name);
                  }}
                >
                  {student.name}
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </main>
  );
}
