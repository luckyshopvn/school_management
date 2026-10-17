import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  StatusBadge,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { messageOf } from '../imports/import-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  ID_VERIFICATION_LABELS,
  listStaffIdentity,
  markStaffIdentity,
  type IdVerificationStatus,
  type MarkResult,
  type StaffIdentityRow,
} from './staff-so-api.js';

// 3.1.5. Xác thực số định danh nhân sự với CSDLQG về dân cư (DT-16 phần 16f, bản chạy nội bộ): cột theo Sở (CMND/CCCD, thông
// tin thường trú, trạng thái xác thực, ghi chú) kèm ngày, người đánh dấu. Chưa kết nối CSDLQG nên nút "Xác thực" của Sở là
// "Đánh dấu đã xác thực" sau khi đã đối chiếu (VNeID, CCCD gốc); hệ thống kiểm tra số đủ 12 chữ số. "Đánh dấu sai thông tin"
// cần ghi chú
const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const formatDate = (value: string | null) => (value ? value.slice(0, 10).split('-').reverse().join('/') : '');
const TONES: Record<IdVerificationStatus, 'neutral' | 'success' | 'danger'> = {
  unverified: 'neutral',
  verified: 'success',
  invalid: 'danger',
};

const columns: Array<DataGridColumn<StaffIdentityRow>> = [
  { id: 'moet_staff_code', header: 'Mã định danh Bộ GD&ĐT', cell: (row) => row.moet_staff_code ?? 'Chưa có' },
  { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'dob', header: 'Ngày sinh', cell: (row) => formatDate(row.dob) },
  { id: 'id_number', header: 'CMND/CCCD', cell: (row) => row.id_number_masked ?? 'Chưa có' },
  { id: 'permanent_address', header: 'Thông tin thường trú', cell: (row) => row.permanent_address },
  {
    id: 'status',
    header: 'Trạng thái xác thực',
    cell: (row) => (
      <StatusBadge
        tone={TONES[row.id_verification_status]}
        label={ID_VERIFICATION_LABELS[row.id_verification_status]}
      />
    ),
  },
  { id: 'note', header: 'Ghi chú', cell: (row) => row.id_verification_note ?? '' },
  { id: 'verified_at', header: 'Ngày đánh dấu', cell: (row) => formatDate(row.id_verified_at) },
  { id: 'verified_by', header: 'Người đánh dấu', cell: (row) => row.id_verified_by_name ?? '' },
  { id: 'code', header: 'Mã nhân sự', hiddenByDefault: true, cell: (row) => row.code },
  { id: 'unit', header: 'Đơn vị', hiddenByDefault: true, cell: (row) => row.unit_name },
  { id: 'department', header: 'Phòng ban', hiddenByDefault: true, cell: (row) => row.department_name ?? '' },
];

export function StaffIdentityPage() {
  const canManage = useHasPermission(PERMISSION_CODES.staffManage);
  const unitChoice = useUnitChoice();
  const queryClient = useQueryClient();
  const grid = useGridSettings('staff-identity');
  const [search, setSearch] = useState('');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<MarkResult>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const pageSize = grid.settings.pageSize;
  const list = useQuery({
    queryKey: ['staff-identity', orgUnitId, status, search, page, pageSize],
    queryFn: () =>
      listStaffIdentity({
        org_unit_id: orgUnitId || undefined,
        status: status || undefined,
        q: search || undefined,
        page,
        page_size: pageSize,
      }),
    enabled: grid.ready,
  });
  const mark = useMutation({
    mutationFn: (input: { staffIds: string[]; status: IdVerificationStatus }) =>
      markStaffIdentity(input.staffIds, input.status, note),
    onSuccess: async (marked) => {
      setResult(marked);
      setNote('');
      if (marked.updated_count > 0) {
        setToastMessage(`Đã cập nhật ${marked.updated_count} hồ sơ`);
      }
      await queryClient.invalidateQueries({ queryKey: ['staff-identity'] });
    },
  });
  const failed = (result?.results ?? []).filter((item) => item.error);
  const error = list.error ?? grid.error ?? mark.error;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/staff-identity')}</h1>
        {list.data && !list.data.automatic ? (
          <Alert tone="info">
            Chưa kết nối CSDLQG về dân cư: hệ thống không gửi số định danh đi đâu. Đối chiếu trên VNeID hoặc CCCD gốc
            rồi bấm "Đánh dấu đã xác thực" hoặc "Đánh dấu sai thông tin"; hệ thống ghi ngày, người đánh dấu và kiểm tra
            số đủ 12 chữ số.
          </Alert>
        ) : null}
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        {failed.length > 0 ? (
          <Alert tone="warning">
            <span>Không cập nhật được {failed.length} hồ sơ:</span>
            <ul className="ml-4 list-disc" aria-label="Hồ sơ không cập nhật được">
              {failed.map((item) => (
                <li key={item.id}>
                  {item.full_name}: {item.error}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}
        <DataGrid
          label="Danh sách xác thực số định danh"
          columns={columns}
          rows={list.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.full_name}
          getRowAriaLabel={(row) => `Nhân sự ${row.full_name}`}
          loading={!list.data && !list.isError}
          emptyText="Không có nhân sự."
          search={{
            label: 'Tìm theo tên hoặc mã',
            value: search,
            onChange: (value) => {
              setSearch(value);
              setPage(1);
            },
          }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Đơn vị
                <select
                  value={orgUnitId}
                  onChange={(event) => {
                    setOrgUnitId(event.target.value);
                    setPage(1);
                  }}
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
              <label className="text-label font-medium text-text">
                Trạng thái xác thực
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className={selectClass}
                >
                  <option value="">Tất cả</option>
                  {(Object.keys(ID_VERIFICATION_LABELS) as IdVerificationStatus[]).map((key) => (
                    <option key={key} value={key}>
                      {ID_VERIFICATION_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
          toolbar={(selectedRows) =>
            canManage ? (
              <>
                <label className="flex items-center gap-2 text-label font-medium text-text">
                  Ghi chú
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className={FORM_CONTROL_CLASS}
                  />
                </label>
                <Button
                  variant="primary"
                  disabled={mark.isPending || selectedRows.length === 0}
                  onClick={() => mark.mutate({ staffIds: selectedRows.map((row) => row.id), status: 'verified' })}
                >
                  Đánh dấu đã xác thực
                </Button>
                <Button
                  disabled={mark.isPending || selectedRows.length === 0 || !note.trim()}
                  title={!note.trim() ? 'Ghi chú thông tin sai trước khi đánh dấu' : undefined}
                  onClick={() => mark.mutate({ staffIds: selectedRows.map((row) => row.id), status: 'invalid' })}
                >
                  Đánh dấu sai thông tin
                </Button>
                <Button
                  variant="text"
                  disabled={mark.isPending || selectedRows.length === 0}
                  onClick={() => mark.mutate({ staffIds: selectedRows.map((row) => row.id), status: 'unverified' })}
                >
                  Đặt lại chưa xác thực
                </Button>
              </>
            ) : null
          }
          selectable
          settings={grid.settings}
          onSettingsChange={grid.update}
          serverPagination={{ page, total: list.data?.total ?? 0, onPageChange: setPage }}
        />
      </div>
    </AppShell>
  );
}
