import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import { ExcelImportPanel } from './ExcelImportPanel.js';
import { MoetImportSection } from './MoetImportSection.js';

// MH-40 Nhập dữ liệu ban đầu từ Excel (P01-13) và nhập mã định danh ngành (P02-12) (YCTD-46).
// Giao diện chỉ chuyển tệp và hiện báo cáo; máy chủ kiểm tra toàn bộ và chỉ ghi khi không còn dòng lỗi. Nhập lớp học tách
// sang màn hình "2.2. Nhập lớp học từ Excel" (DT-15 phần 15b, YCTD-111). Từ DT-16 phần 16a mỗi phần nhập dùng thành phần nhập
// Excel dùng chung theo mẫu của Sở (tải file mẫu, tra cứu danh mục, chọn cột để nhập, xuất file lỗi)
type ImportType = 'classes' | 'children' | 'moet_codes' | 'opening_debts' | 'staff';

const TYPE_LABELS: Record<ImportType, string> = {
  classes: 'Lớp học',
  children: 'Trẻ và phụ huynh',
  moet_codes: 'Mã định danh ngành',
  opening_debts: 'Công nợ đầu kỳ',
  staff: 'Nhân sự',
};

export function ImportSection({ type, onChanged }: { type: ImportType; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const moetCodes = type === 'moet_codes';
  return (
    <ExcelImportPanel
      type={type}
      title={TYPE_LABELS[type]}
      uploadPath={moetCodes ? '/api/v1/imports/moet-codes' : '/api/v1/imports'}
      uploadFields={moetCodes ? {} : { type }}
      uploadLabel={moetCodes ? 'Nhập mã ngành' : 'Tải lên'}
      writesOnUpload={moetCodes}
      onUploaded={async (result) => {
        if (moetCodes) {
          await queryClient.invalidateQueries({ queryKey: ['children'] });
          onChanged(`Đã gán mã ngành cho ${result.assigned_rows ?? 0} trẻ`);
        }
      }}
      onCommitted={async (result) => {
        await queryClient.invalidateQueries();
        onChanged(`Đã ghi ${result.total_rows} dòng ${TYPE_LABELS[type].toLowerCase()}`);
      }}
    />
  );
}

export function ImportsPage() {
  const canImportChildren = useHasPermission(PERMISSION_CODES.importChildren);
  const canImportMoetCodes = useHasPermission(PERMISSION_CODES.childManage);
  const canImportOpeningDebts = useHasPermission(PERMISSION_CODES.openingDebtImport);
  const canImportStaff = useHasPermission(PERMISSION_CODES.importStaff);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Nhập dữ liệu</h1>
        <p className="text-label text-text-secondary">
          Tải file mẫu, điền dữ liệu rồi tải tệp lên. Hệ thống kiểm tra toàn bộ tệp và chỉ ghi khi không còn dòng lỗi; tệp
          có lỗi thì bấm "Xuất file lỗi" để nhận lại tệp kèm cột nội dung lỗi. Trẻ nhập vào thẳng trạng thái đang học; giấy
          khai sinh bổ sung sau ở màn hình Hồ sơ trẻ.
        </p>
        {canImportChildren ? (
          <>
            <ImportSection type="children" onChanged={setToastMessage} />
            <MoetImportSection type="moet_children" onChanged={setToastMessage} />
          </>
        ) : null}
        {canImportMoetCodes ? <ImportSection type="moet_codes" onChanged={setToastMessage} /> : null}
        {canImportOpeningDebts ? <ImportSection type="opening_debts" onChanged={setToastMessage} /> : null}
        {canImportStaff ? (
          <>
            <ImportSection type="staff" onChanged={setToastMessage} />
            <MoetImportSection type="moet_staff" onChanged={setToastMessage} />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
