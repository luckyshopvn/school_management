import { useCallback, useState } from 'react';
import { PERMISSION_CODES } from '@school-management/shared';
import { Toast } from '@school-management/ui';
import { ImportSection } from '../imports/ImportsPage.js';
import { MoetImportSection } from '../imports/MoetImportSection.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';

// 4.1.2. Nhập học sinh từ Excel (DT-16 phần 16g, mục 4.1.2 của Sở): tách khỏi trang nhập dữ liệu chung. Tệp CSDL ngành 82
// cột có tải file mẫu, tải file mẫu kèm dữ liệu, tra cứu danh mục (gồm tổ/thôn/xóm) và ô "Đồng ý cập nhật dữ liệu học sinh";
// mẫu của trường (trẻ và phụ huynh) và nhập mã định danh ngành dùng bộ nhập chung của phần 16a
export function StudentImportsPage() {
  const canImportChildren = useHasPermission(PERMISSION_CODES.importChildren);
  const canImportMoetCodes = useHasPermission(PERMISSION_CODES.childManage);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/student-imports')}</h1>
        <p className="text-label text-text-secondary">
          Tải file mẫu, điền dữ liệu rồi tải tệp lên. Hệ thống kiểm tra toàn bộ tệp và chỉ ghi khi không còn dòng lỗi;
          tệp có lỗi thì bấm "Xuất file lỗi" để nhận lại tệp kèm cột nội dung lỗi.
        </p>
        {canImportChildren ? (
          <>
            <MoetImportSection type="moet_children" onChanged={setToastMessage} tools />
            <ImportSection type="children" onChanged={setToastMessage} />
          </>
        ) : null}
        {canImportMoetCodes ? <ImportSection type="moet_codes" onChanged={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
