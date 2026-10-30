import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, fillLearnerTerm } from '@school-management/shared';
import { Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useLearnerWord, useSchoolLevelTerms } from '../school-levels/working-level.js';
import { useHasPermission } from '../session/permissions.js';
import { ExcelImportPanel } from './ExcelImportPanel.js';

// MH-40 Nhập dữ liệu ban đầu từ Excel (P01-13) và nhập mã định danh ngành (P02-12) (YCTD-46).
// Giao diện chỉ chuyển tệp và hiện báo cáo; máy chủ kiểm tra toàn bộ và chỉ ghi khi không còn dòng lỗi. Nhập lớp học tách
// sang màn hình "2.2. Nhập lớp học từ Excel" (DT-15 phần 15b, YCTD-111). Từ DT-16 phần 16a mỗi phần nhập dùng thành phần nhập
// Excel dùng chung theo mẫu của Sở (tải file mẫu, tra cứu danh mục, chọn cột để nhập, xuất file lỗi). Nhập nhân sự tách sang
// "3.1.3. Nhập nhân sự từ Excel" (DT-16 phần 16f); nhập học sinh (trẻ và phụ huynh, tệp CSDL ngành, mã định danh ngành) tách
// sang "4.1.2. Nhập học sinh từ Excel" (DT-16 phần 16g), trang này còn công nợ đầu kỳ
type ImportType =
  | 'classes'
  | 'children'
  | 'moet_codes'
  | 'opening_debts'
  | 'staff'
  // Điện thoại nhận tin, số định danh, địa chỉ mới của học sinh (DT-16 phần 16g)
  | 'sms_phones'
  | 'national_ids'
  | 'student_addresses';

const TYPE_LABELS: Record<ImportType, string> = {
  classes: 'Lớp học',
  children: '{Người học} và phụ huynh',
  moet_codes: 'Mã định danh ngành',
  opening_debts: 'Công nợ đầu kỳ',
  staff: 'Nhân sự',
  sms_phones: 'Điện thoại nhận tin',
  national_ids: 'Số định danh',
  student_addresses: 'Địa chỉ mới của học sinh',
};

export function ImportSection({ type, onChanged }: { type: ImportType; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const terms = useSchoolLevelTerms();
  const learner = useLearnerWord();
  const moetCodes = type === 'moet_codes';
  const title = fillLearnerTerm(TYPE_LABELS[type], terms);
  return (
    <ExcelImportPanel
      type={type}
      title={title}
      uploadPath={moetCodes ? '/api/v1/imports/moet-codes' : '/api/v1/imports'}
      uploadFields={moetCodes ? {} : { type }}
      uploadLabel={moetCodes ? 'Nhập mã ngành' : 'Tải lên'}
      writesOnUpload={moetCodes}
      onUploaded={async (result) => {
        if (moetCodes) {
          await queryClient.invalidateQueries({ queryKey: ['children'] });
          onChanged(`Đã gán mã ngành cho ${result.assigned_rows ?? 0} ${learner}`);
        }
      }}
      onCommitted={async (result) => {
        await queryClient.invalidateQueries();
        onChanged(`Đã ghi ${result.total_rows} dòng ${title.toLocaleLowerCase('vi')}`);
      }}
    />
  );
}

export function ImportsPage() {
  const canImportOpeningDebts = useHasPermission(PERMISSION_CODES.openingDebtImport);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Nhập dữ liệu khác từ Excel</h1>
        <p className="text-label text-text-secondary">
          Tải file mẫu, điền dữ liệu rồi tải tệp lên. Hệ thống kiểm tra toàn bộ tệp và chỉ ghi khi không còn dòng lỗi;
          tệp có lỗi thì bấm "Xuất file lỗi" để nhận lại tệp kèm cột nội dung lỗi. Nhập học sinh ở "4.1.2. Nhập học sinh
          từ Excel", nhập nhân sự ở "3.1.3. Nhập nhân sự từ Excel".
        </p>
        {canImportOpeningDebts ? <ImportSection type="opening_debts" onChanged={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
