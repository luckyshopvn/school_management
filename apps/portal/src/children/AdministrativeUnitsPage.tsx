import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, ConfirmDialog, DataGrid, StatusBadge, Toast, type DataGridColumn } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  ADDRESS_TYPE_LABELS,
  convertAddresses,
  downloadMappingTemplate,
  importMappings,
  listMappings,
  listOldAddresses,
  SUGGESTION_LABELS,
  type AddressFilter,
  type AddressType,
  type MappingImportReport,
  type OldAddress,
  type SuggestionStatus,
  type UnitMapping,
} from './administrative-units-api.js';

// 4.1.11. Cập nhật địa danh hành chính (DT-15 phần 15h1, YCTD-116): địa chỉ của học sinh (năm loại địa chỉ theo tệp CSDL
// ngành) còn ghi theo địa danh trước sắp xếp năm 2025, địa danh mới đề xuất theo bảng đối chiếu; chọn nhiều dòng rồi
// "Chuyển địa danh mới". Dòng có nhiều xã/phường mới thì chọn xã mới ngay trên dòng. Bên dưới là bảng đối chiếu, người có
// quyền quản lý danh mục nhập thêm từ Excel
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const formatDate = (value: string) => value.split('-').reverse().join('/');
const SUGGESTION_TONES: Record<SuggestionStatus, 'success' | 'info' | 'danger'> = {
  suggested: 'success',
  multiple: 'info',
  none: 'danger',
};
const rowName = (row: OldAddress) => `${row.full_name} – ${ADDRESS_TYPE_LABELS[row.address_type]}`;

function MappingSection({ onImported }: { onImported(message: string): void }) {
  const canImport = useHasPermission(PERMISSION_CODES.catalogManage);
  const queryClient = useQueryClient();
  const grid = useGridSettings('administrative-unit-mappings');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [file, setFile] = useState<File>();
  const [report, setReport] = useState<MappingImportReport>();
  const [templateError, setTemplateError] = useState<string>();
  const pageSize = grid.settings.pageSize;
  const mappings = useQuery({
    queryKey: ['administrative-unit-mappings', search, page, pageSize],
    queryFn: () => listMappings(search, page, pageSize),
    enabled: grid.ready,
  });
  const upload = useMutation({
    mutationFn: () => importMappings(file ?? new File([], '')),
    onSuccess: async (result) => {
      setReport(result);
      if (result.status === 'committed') {
        await queryClient.invalidateQueries({ queryKey: ['administrative-unit-mappings'] });
        await queryClient.invalidateQueries({ queryKey: ['administrative-addresses'] });
        onImported(`Đã nhập ${result.total_rows} dòng, thêm ${result.created_mappings} dòng đối chiếu`);
      }
    },
  });
  const columns: Array<DataGridColumn<UnitMapping>> = [
    { id: 'old_province', header: 'Tỉnh/Thành phố cũ', cell: (row) => row.old_province },
    { id: 'old_district', header: 'Quận/Huyện cũ', cell: (row) => row.old_district },
    { id: 'old_ward', header: 'Xã/Phường cũ', cell: (row) => row.old_ward },
    { id: 'old_ward_code', header: 'Mã xã/phường cũ', hiddenByDefault: true, cell: (row) => row.old_ward_code ?? '' },
    { id: 'new_province', header: 'Tỉnh/Thành phố mới', cell: (row) => row.new_province },
    { id: 'new_ward', header: 'Xã/Phường mới', alwaysVisible: true, cell: (row) => row.new_ward },
    { id: 'new_ward_code', header: 'Mã xã/phường mới', cell: (row) => row.new_ward_code ?? '' },
    {
      id: 'source',
      header: 'Nguồn',
      hiddenByDefault: true,
      cell: (row) => (row.source === 'official' ? 'Văn bản chính thức' : 'Nhập từ Excel'),
    },
  ];

  return (
    <section className="flex flex-col gap-3" aria-label="Bảng đối chiếu địa danh">
      <h2 className="text-section-title font-semibold text-text">Bảng đối chiếu địa danh</h2>
      <p className="text-label text-text-secondary">
        Gieo sẵn Thành phố Hồ Chí Minh theo Nghị quyết 1685/NQ-UBTVQH15 và danh mục mã số của Cục Thống kê. Tỉnh, thành
        phố khác nhập từ Excel.
      </p>
      {canImport ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="text"
            onClick={() => downloadMappingTemplate().catch((error: unknown) => setTemplateError(messageOf(error)))}
          >
            Tải mẫu Excel
          </Button>
          <input
            type="file"
            aria-label="Tệp bảng đối chiếu"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              setFile(event.target.files?.[0]);
              setReport(undefined);
            }}
          />
          <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
            Nhập từ Excel
          </Button>
        </div>
      ) : null}
      {templateError ? <Alert tone="danger">{templateError}</Alert> : null}
      {upload.error ? <Alert tone="danger">{messageOf(upload.error)}</Alert> : null}
      {report ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3 text-content">
            <StatusBadge
              label={report.status === 'committed' ? 'Đã ghi dữ liệu' : 'Còn dòng lỗi, chưa ghi dòng nào'}
              tone={report.status === 'committed' ? 'success' : 'danger'}
            />
            <span>
              {report.total_rows} dòng, {report.error_rows} dòng lỗi
              {report.status === 'committed'
                ? `, thêm ${report.created_units} đơn vị, ${report.created_mappings} dòng đối chiếu`
                : ''}
            </span>
          </div>
          {report.errors.length > 0 ? (
            <table className="w-full text-content" aria-label="Báo cáo dòng lỗi">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-1">Dòng</th>
                  <th className="px-3 py-1">Cột</th>
                  <th className="px-3 py-1">Lỗi</th>
                </tr>
              </thead>
              <tbody>
                {report.errors.map((error, index) => (
                  <tr key={index} className="border-t border-border">
                    <td className="px-3 py-1">{error.row}</td>
                    <td className="px-3 py-1">{error.column ?? ''}</td>
                    <td className="px-3 py-1">{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
      {mappings.isError ? <Alert tone="danger">{messageOf(mappings.error)}</Alert> : null}
      <DataGrid
        label="Bảng đối chiếu địa danh cũ sang mới"
        columns={columns}
        rows={mappings.data?.items ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `${row.old_ward || row.old_district} sang ${row.new_ward}`}
        loading={!mappings.data && !mappings.isError}
        emptyText="Không có dòng đối chiếu phù hợp."
        search={{
          label: 'Tìm theo tên xã/phường, quận/huyện',
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
        }}
        settings={grid.settings}
        onSettingsChange={grid.update}
        serverPagination={{ page, total: mappings.data?.total ?? 0, onPageChange: setPage }}
      />
    </section>
  );
}

export function AdministrativeUnitsPage() {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const grid = useGridSettings('administrative-addresses');
  const [filter, setFilter] = useState<AddressFilter>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<OldAddress[]>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const activeFilter: AddressFilter = { ...filter, q: search || undefined };
  const pageSize = grid.settings.pageSize;
  const addresses = useQuery({
    queryKey: ['administrative-addresses', activeFilter, page, pageSize],
    queryFn: () => listOldAddresses(activeFilter, page, pageSize),
    enabled: grid.ready,
  });
  const convert = useMutation({
    mutationFn: (rows: OldAddress[]) =>
      convertAddresses(
        rows.map((row) => ({
          child_id: row.child_id,
          address_type: row.address_type,
          ...(choices[row.id] ? { new_unit_id: choices[row.id] } : {}),
        })),
      ),
    onSuccess: async (result) => {
      setConfirming(undefined);
      setChoices({});
      await queryClient.invalidateQueries({ queryKey: ['administrative-addresses'] });
      setToastMessage(`Đã chuyển ${result.updated} địa chỉ của ${result.children} học sinh sang địa danh mới`);
    },
  });
  const change = (key: keyof AddressFilter, value: string) => {
    setFilter((current) => ({ ...current, [key]: value || undefined }));
    setPage(1);
  };
  const counts = addresses.data?.counts;

  const columns: Array<DataGridColumn<OldAddress>> = [
    { id: 'moet_student_code', header: 'Mã định danh Bộ GD&ĐT', cell: (row) => row.moet_student_code ?? '' },
    { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
    { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
    { id: 'class_name', header: 'Lớp', cell: (row) => row.class_name ?? '' },
    { id: 'address_type', header: 'Loại địa chỉ', cell: (row) => ADDRESS_TYPE_LABELS[row.address_type] },
    { id: 'old_province', header: 'Tỉnh/Thành phố cũ', cell: (row) => row.old_province },
    { id: 'old_district', header: 'Quận/Huyện cũ', cell: (row) => row.old_district },
    { id: 'old_ward', header: 'Xã/Phường cũ', cell: (row) => row.old_ward },
    { id: 'old_ward_code', header: 'Mã xã/phường cũ', hiddenByDefault: true, cell: (row) => row.old_ward_code ?? '' },
    {
      id: 'new_province',
      header: 'Tỉnh/Thành phố mới',
      cell: (row) => row.candidates[0]?.province_name ?? '',
    },
    {
      id: 'new_ward',
      header: 'Xã/Phường mới',
      alwaysVisible: true,
      cell: (row) =>
        row.candidates.length > 1 ? (
          <select
            aria-label={`Xã/phường mới của ${rowName(row)}`}
            value={choices[row.id] ?? ''}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setChoices((current) => ({ ...current, [row.id]: event.target.value }))}
            className="rounded-lg border border-border bg-card px-2 py-1 text-content"
          >
            <option value="">Chọn xã/phường mới</option>
            {row.candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.ward_name}
              </option>
            ))}
          </select>
        ) : (
          (row.candidates[0]?.ward_name ?? '')
        ),
    },
    {
      id: 'new_ward_code',
      header: 'Mã xã/phường mới',
      hiddenByDefault: true,
      cell: (row) =>
        (row.candidates.length > 1
          ? row.candidates.find((candidate) => candidate.id === choices[row.id])
          : row.candidates[0]
        )?.code ?? '',
    },
    {
      id: 'suggestion',
      header: 'Tình trạng',
      cell: (row) => <StatusBadge label={SUGGESTION_LABELS[row.suggestion]} tone={SUGGESTION_TONES[row.suggestion]} />,
    },
  ];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/administrative-units')}</h1>
        <p className="text-label text-text-secondary">
          Địa chỉ thường trú, quê quán, nơi khai sinh, nơi sinh, chỗ ở hiện nay của học sinh (theo tệp CSDL ngành) còn
          ghi theo địa danh trước sắp xếp đơn vị hành chính năm 2025. Chọn các dòng rồi bấm &quot;Chuyển địa danh
          mới&quot;: tỉnh, xã/phường đổi theo tên mới, bỏ quận/huyện cũ.
        </p>
        {counts ? (
          <ul className="flex flex-wrap gap-3 text-content" aria-label="Số địa chỉ theo tình trạng">
            {(Object.keys(SUGGESTION_LABELS) as SuggestionStatus[]).map((status) => (
              <li key={status} className="rounded-lg border border-border bg-card px-3 py-2">
                {SUGGESTION_LABELS[status]}: <span className="font-semibold">{counts[status]}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {addresses.isError ? <Alert tone="danger">{messageOf(addresses.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <DataGrid
          label="Địa chỉ học sinh theo địa danh cũ"
          columns={columns}
          rows={addresses.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={rowName}
          loading={!addresses.data && !addresses.isError}
          emptyText="Không còn địa chỉ nào theo địa danh cũ."
          selectable
          search={{
            label: 'Tìm theo họ tên',
            value: search,
            onChange: (value) => {
              setSearch(value);
              setPage(1);
            },
          }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Loại địa chỉ
                <select
                  value={filter.address_type ?? ''}
                  onChange={(event) => change('address_type', event.target.value)}
                  className={selectClass}
                >
                  <option value="">Tất cả</option>
                  {(Object.keys(ADDRESS_TYPE_LABELS) as AddressType[]).map((type) => (
                    <option key={type} value={type}>
                      {ADDRESS_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Tình trạng
                <select
                  value={filter.suggestion ?? ''}
                  onChange={(event) => change('suggestion', event.target.value)}
                  className={selectClass}
                >
                  <option value="">Tất cả</option>
                  {(Object.keys(SUGGESTION_LABELS) as SuggestionStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {SUGGESTION_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Đơn vị
                <select
                  value={filter.org_unit_id ?? ''}
                  onChange={(event) => change('org_unit_id', event.target.value)}
                  className={selectClass}
                >
                  <option value="">Tất cả</option>
                  {unitChoice.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
          toolbar={(selected) => (
            <Button
              disabled={selected.length === 0}
              onClick={() => {
                convert.reset();
                setConfirming(selected);
              }}
            >
              Chuyển địa danh mới
            </Button>
          )}
          settings={grid.settings}
          onSettingsChange={grid.update}
          serverPagination={{ page, total: addresses.data?.total ?? 0, onPageChange: setPage }}
        />
        {confirming ? (
          <ConfirmDialog
            open
            title="Chuyển địa danh mới"
            confirmLabel="Chuyển"
            busy={convert.isPending}
            onCancel={() => setConfirming(undefined)}
            onConfirm={() => convert.mutate(confirming)}
          >
            <div className="flex flex-col gap-3">
              <p>
                Chuyển {confirming.length} địa chỉ đã chọn sang địa danh mới theo bảng đối chiếu. Mỗi học sinh được ghi
                nhật ký thao tác kèm địa chỉ trước và sau.
              </p>
              {convert.error ? <Alert tone="danger">{messageOf(convert.error)}</Alert> : null}
            </div>
          </ConfirmDialog>
        ) : null}
        <MappingSection onImported={setToastMessage} />
      </div>
    </AppShell>
  );
}
