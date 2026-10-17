import { useCallback, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Toast } from '@school-management/ui';
import { ImportSection } from '../imports/ImportsPage.js';
import { MoetImportSection } from '../imports/MoetImportSection.js';
import { messageOf } from '../imports/import-api.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { downloadMinistryTemplate, readMinistryCatalogs } from './staff-so-api.js';

// 3.1.3. Nhập nhân sự từ Excel (DT-16 phần 16f, mục 3.1.3 của Sở; trước ở màn hình Nhập dữ liệu chung): tệp cán bộ, giáo
// viên theo mẫu 75 cột của CSDL ngành với Tải file mẫu, Tải file mẫu kèm dữ liệu (hồ sơ đang có để sửa rồi nhập lại), Tra
// cứu danh mục của Bộ, Kiểm tra tệp, xem lỗi, Xuất file lỗi, Ghi dữ liệu; bên dưới là mẫu nhân sự của trường (công cụ nhập
// dùng chung của phần 16a)
function MinistryCatalogLookup() {
  const [catalogKey, setCatalogKey] = useState<string>();
  const [search, setSearch] = useState('');
  const selectId = useId();
  const searchId = useId();
  const catalogs = useQuery({ queryKey: ['staff-ministry-catalogs'], queryFn: readMinistryCatalogs });
  const current = catalogs.data?.find((catalog) => catalog.key === catalogKey) ?? catalogs.data?.[0];
  const keyword = search.trim().toLowerCase();
  const items = (current?.items ?? []).filter((item) => keyword === '' || item.name.toLowerCase().includes(keyword));
  if (catalogs.error) {
    return <Alert tone="danger">{messageOf(catalogs.error)}</Alert>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={selectId} className="text-label font-medium text-text">
            Danh mục
          </label>
          <select
            id={selectId}
            value={current?.key ?? ''}
            onChange={(event) => setCatalogKey(event.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
          >
            {(catalogs.data ?? []).map((catalog) => (
              <option key={catalog.key} value={catalog.key}>
                {catalog.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={searchId} className="text-label font-medium text-text">
            Tìm giá trị
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-content text-text"
          />
        </div>
      </div>
      {current ? <p className="text-label text-text-secondary">Ghi vào cột: {current.column}</p> : null}
      <ul className="max-h-60 overflow-y-auto text-content" aria-label={`Danh mục ${current?.title ?? ''}`}>
        {items.map((item) => (
          <li key={item.code} className="border-t border-border px-3 py-1">
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MinistryTemplateTools() {
  const [error, setError] = useState<string>();
  const [lookup, setLookup] = useState(false);
  const regionId = useId();
  const template = (withData: boolean) => {
    setError(undefined);
    downloadMinistryTemplate(withData).catch((reason: unknown) => setError(messageOf(reason)));
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="text" onClick={() => template(false)}>
          Tải file mẫu
        </Button>
        <Button variant="text" onClick={() => template(true)}>
          Tải file mẫu kèm dữ liệu
        </Button>
        <Button variant="text" aria-expanded={lookup} aria-controls={regionId} onClick={() => setLookup(!lookup)}>
          Tra cứu danh mục
        </Button>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {lookup ? (
        <div id={regionId} role="region" aria-label="Tra cứu danh mục" className="rounded-lg border border-border bg-page p-3">
          <MinistryCatalogLookup />
        </div>
      ) : null}
    </div>
  );
}

export function StaffImportsPage() {
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/staff-imports')}</h1>
        <p className="text-label text-text-secondary">
          Tải file mẫu 75 cột theo CSDL ngành (kèm dữ liệu để sửa hồ sơ đang có), điền rồi tải tệp lên. Hệ thống kiểm tra
          toàn bộ tệp và chỉ ghi khi không còn dòng lỗi; tệp có lỗi thì bấm "Xuất file lỗi".
        </p>
        <MoetImportSection type="moet_staff" onChanged={setToastMessage} tools={<MinistryTemplateTools />} />
        <ImportSection type="staff" onChanged={setToastMessage} />
      </div>
    </AppShell>
  );
}
