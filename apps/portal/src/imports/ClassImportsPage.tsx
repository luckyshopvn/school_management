import { useCallback, useState } from 'react';
import { Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ImportSection } from './ImportsPage.js';

// 2.2. Nhập lớp học từ Excel theo Sở (DT-15 phần 15b, YCTD-111): tách phần nhập lớp học của màn hình Nhập dữ liệu (P01-13),
// giữ nguyên mẫu, kiểm tra và ghi; máy chủ chỉ ghi khi không còn dòng lỗi
export function ClassImportsPage() {
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/class-imports')}</h1>
        <p className="text-label text-text-secondary">
          Tải mẫu, điền dữ liệu rồi tải tệp lên. Hệ thống kiểm tra toàn bộ tệp và chỉ ghi khi không còn dòng lỗi.
        </p>
        <ImportSection type="classes" onChanged={setToastMessage} />
      </div>
    </AppShell>
  );
}
