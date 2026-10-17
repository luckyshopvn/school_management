import { useCallback, useId, useState } from 'react';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, Toast } from '@school-management/ui';
import { CatalogLookup } from '../imports/ExcelImportPanel.js';
import { ImportSection } from '../imports/ImportsPage.js';
import { messageOf } from '../imports/import-api.js';
import { MoetImportSection } from '../imports/MoetImportSection.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { downloadMoetTemplate, readMoetCatalogs } from './students-api.js';

// 4.1.2. Nhập học sinh từ Excel (DT-16 phần 16g, mục 4.1.2 của Sở): tách khỏi trang nhập dữ liệu chung. Tệp CSDL ngành 82
// cột có tải file mẫu, tải file mẫu kèm dữ liệu, tra cứu danh mục (gồm tổ/thôn/xóm) và ô "Đồng ý cập nhật dữ liệu học sinh";
// mẫu của trường (trẻ và phụ huynh) và nhập mã định danh ngành dùng bộ nhập chung của phần 16a

// Tải file mẫu 82 cột, kèm dữ liệu và tra cứu danh mục cho tệp CSDL ngành của học sinh
function StudentMoetTools() {
  const [lookup, setLookup] = useState(false);
  const [templateError, setTemplateError] = useState<string>();
  const lookupId = useId();
  const template = (withData: boolean) => {
    setTemplateError(undefined);
    downloadMoetTemplate(withData).catch((error: unknown) => setTemplateError(messageOf(error)));
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="text" onClick={() => template(false)}>
          Tải file mẫu
        </Button>
        <Button variant="text" onClick={() => template(true)}>
          Tải file mẫu kèm dữ liệu
        </Button>
        <Button variant="text" aria-expanded={lookup} aria-controls={lookupId} onClick={() => setLookup(!lookup)}>
          Tra cứu danh mục
        </Button>
      </div>
      {templateError ? <Alert tone="danger">{templateError}</Alert> : null}
      {lookup ? (
        <div
          id={lookupId}
          role="region"
          aria-label="Tra cứu danh mục"
          className="rounded-lg border border-border bg-page p-3"
        >
          <CatalogLookup type="moet_children" load={readMoetCatalogs} />
        </div>
      ) : null}
    </>
  );
}

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
            <MoetImportSection
              type="moet_children"
              onChanged={setToastMessage}
              tools={<StudentMoetTools />}
              confirmUpdates
            />
            <ImportSection type="children" onChanged={setToastMessage} />
          </>
        ) : null}
        {canImportMoetCodes ? <ImportSection type="moet_codes" onChanged={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
