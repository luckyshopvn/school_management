import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, type DataGridKey } from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { messageOf } from '../imports/import-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { searchStaff } from './staff-api.js';
import {
  approveStaffMovement,
  confirmStaffMovement,
  createStaffMovement,
  createTransferInFromFile,
  downloadMovementMinistryFile,
  downloadMovementPdf,
  listStaffMovements,
  rejectStaffMovement,
  type MovementType,
  type StaffMovement,
} from './staff-so-api.js';

// 3.5. Biến động nhân sự (DT-16 phần 16f, mục 3.5 của Sở), bản chạy nội bộ vì chưa liên thông giữa các trường: bốn thẻ Tiếp
// nhận nhân sự chuyển đến (chuyển từ tỉnh, xã, trường; tải tệp hồ sơ chuyển theo mẫu Bộ; Tiếp nhận tạo hồ sơ nháp; xem và in
// PDF), Duyệt chuyển đi (ngày chuyển, đã xác nhận, trạng thái; xuất hồ sơ chuyển PDF và tệp theo mẫu Bộ), Giáo viên đi thỉnh
// giảng (môn dạy, trường đến, trạng thái duyệt), Xác nhận giáo viên đến thỉnh giảng
interface TabInfo {
  type: MovementType;
  label: string;
  gridKey: DataGridKey;
  approveLabel: string;
  schoolLabel: string;
  dateLabel: string;
}

const TABS: TabInfo[] = [
  {
    type: 'transfer_in',
    label: 'Tiếp nhận nhân sự chuyển đến',
    gridKey: 'staff-movements-in',
    approveLabel: 'Tiếp nhận',
    schoolLabel: 'Chuyển từ trường',
    dateLabel: 'Ngày chuyển đến',
  },
  {
    type: 'transfer_out',
    label: 'Duyệt chuyển đi',
    gridKey: 'staff-movements-out',
    approveLabel: 'Duyệt',
    schoolLabel: 'Chuyển đến trường',
    dateLabel: 'Ngày chuyển',
  },
  {
    type: 'guest_out',
    label: 'Giáo viên đi thỉnh giảng',
    gridKey: 'staff-guests-out',
    approveLabel: 'Duyệt',
    schoolLabel: 'Trường đến',
    dateLabel: 'Từ ngày',
  },
  {
    type: 'guest_in',
    label: 'Giáo viên đến thỉnh giảng',
    gridKey: 'staff-guests-in',
    approveLabel: 'Xác nhận',
    schoolLabel: 'Trường cử đến',
    dateLabel: 'Từ ngày',
  },
];

const formatDate = (value: string | null) => (value ? value.slice(0, 10).split('-').reverse().join('/') : '');
const STATUS_TONES = { pending: 'warning', approved: 'success', rejected: 'neutral' } as const;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

function columnsOf(tab: TabInfo): Array<DataGridColumn<StaffMovement>> {
  const guest = tab.type === 'guest_in' || tab.type === 'guest_out';
  return [
    { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
    { id: 'dob', header: 'Ngày sinh', hiddenByDefault: guest, cell: (row) => formatDate(row.dob) },
    ...(tab.type === 'transfer_in' || tab.type === 'transfer_out'
      ? ([
          { id: 'province', header: tab.type === 'transfer_in' ? 'Chuyển từ tỉnh' : 'Chuyển đến tỉnh', cell: (row) => row.other_province ?? '' },
          { id: 'ward', header: tab.type === 'transfer_in' ? 'Chuyển từ xã' : 'Chuyển đến xã', cell: (row) => row.other_ward ?? '' },
        ] satisfies Array<DataGridColumn<StaffMovement>>)
      : []),
    { id: 'school', header: tab.schoolLabel, cell: (row) => row.other_school ?? '' },
    ...(guest ? ([{ id: 'subject', header: 'Môn dạy', cell: (row) => row.subject ?? '' }] satisfies Array<DataGridColumn<StaffMovement>>) : []),
    { id: 'date', header: tab.dateLabel, cell: (row) => formatDate(row.movement_date) },
    ...(guest ? ([{ id: 'end_date', header: 'Đến ngày', cell: (row) => formatDate(row.end_date) }] satisfies Array<DataGridColumn<StaffMovement>>) : []),
    ...(tab.type === 'transfer_out'
      ? ([
          {
            id: 'confirmed',
            header: 'Đã xác nhận',
            cell: (row) => (row.confirmed ? `Trường đến đã tiếp nhận ${formatDate(row.confirmed_on)}` : 'Chưa'),
          },
        ] satisfies Array<DataGridColumn<StaffMovement>>)
      : []),
    {
      id: 'status',
      header: tab.type === 'guest_out' ? 'Trạng thái duyệt' : 'Trạng thái',
      cell: (row) => <StatusBadge tone={STATUS_TONES[row.status]} label={row.status_label} />,
    },
    { id: 'unit', header: 'Đơn vị', hiddenByDefault: true, cell: (row) => row.unit_name },
    { id: 'decision_no', header: 'Số quyết định', hiddenByDefault: true, cell: (row) => row.decision_no ?? '' },
    { id: 'decided_by', header: 'Người xử lý', hiddenByDefault: true, cell: (row) => row.decided_by_name ?? '' },
  ];
}

function CreateMovementForm({ tab, onCreated, onCancel }: { tab: TabInfo; onCreated(message: string): void; onCancel(): void }) {
  const unitChoice = useUnitChoice();
  const forStaff = tab.type === 'transfer_out' || tab.type === 'guest_out';
  const guest = tab.type === 'guest_in' || tab.type === 'guest_out';
  const [values, setValues] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File>();
  const staff = useQuery({
    queryKey: ['staff', 'search', 'movement-picker'],
    queryFn: () => searchStaff({ status: 'active', page: 1, pageSize: 200 }),
    enabled: forStaff,
  });
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, string> = {
        ...values,
        movement_type: tab.type,
        ...(forStaff ? {} : { org_unit_id: values.org_unit_id ?? unitChoice.selectedId ?? '' }),
      };
      return tab.type === 'transfer_in' && file ? createTransferInFromFile(file, body) : createStaffMovement(body);
    },
    onSuccess: (created) => onCreated(`Đã lập ${tab.label.toLowerCase()}: ${created.full_name}`),
  });
  const errors =
    save.error instanceof ApiError
      ? Object.fromEntries(save.error.details.map((detail) => [detail.field, detail.message]))
      : {};
  const input = (key: string, type = 'text') => (
    <input type={type} value={values[key] ?? ''} onChange={(event) => set(key, event.target.value)} className={FORM_CONTROL_CLASS} />
  );
  return (
    <form
      noValidate
      aria-label={`Thêm ${tab.label.toLowerCase()}`}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold text-text">Thêm mới: {tab.label}</h2>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin">
        {forStaff ? (
          <FormRow label="Nhân sự" error={errors.staff_id}>
            <select value={values.staff_id ?? ''} onChange={(event) => set('staff_id', event.target.value)} className={FORM_CONTROL_CLASS}>
              <option value="">Chọn nhân sự</option>
              {(staff.data?.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} – {item.full_name}
                </option>
              ))}
            </select>
          </FormRow>
        ) : (
          <>
            <FormRow label="Đơn vị tiếp nhận" error={errors.org_unit_id}>
              <select
                value={values.org_unit_id ?? unitChoice.selectedId ?? ''}
                onChange={(event) => set('org_unit_id', event.target.value)}
                className={FORM_CONTROL_CLASS}
              >
                {unitChoice.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </FormRow>
            {tab.type === 'transfer_in' ? (
              <FormRow label="Tệp hồ sơ chuyển (mẫu Bộ)" error={errors.file}>
                <input
                  type="file"
                  aria-label="Tệp hồ sơ chuyển"
                  accept=".xls,.xlsx"
                  onChange={(event) => setFile(event.target.files?.[0])}
                />
              </FormRow>
            ) : null}
            {!file ? (
              <>
                <FormRow label="Họ tên" error={errors.full_name}>
                  {input('full_name')}
                </FormRow>
                <FormRow label="Ngày sinh" error={errors.dob}>
                  {input('dob', 'date')}
                </FormRow>
                <FormRow label="Giới tính" error={errors.gender}>
                  <select value={values.gender ?? ''} onChange={(event) => set('gender', event.target.value)} className={FORM_CONTROL_CLASS}>
                    <option value="">Chưa chọn</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                </FormRow>
              </>
            ) : null}
          </>
        )}
        {tab.type === 'transfer_in' || tab.type === 'transfer_out' ? (
          <>
            <FormRow label={tab.type === 'transfer_in' ? 'Chuyển từ tỉnh' : 'Chuyển đến tỉnh'} error={errors.other_province}>
              {input('other_province')}
            </FormRow>
            <FormRow label={tab.type === 'transfer_in' ? 'Chuyển từ xã' : 'Chuyển đến xã'} error={errors.other_ward}>
              {input('other_ward')}
            </FormRow>
          </>
        ) : null}
        <FormRow label={tab.schoolLabel} error={errors.other_school}>
          {input('other_school')}
        </FormRow>
        {guest ? (
          <FormRow label="Môn dạy" error={errors.subject}>
            {input('subject')}
          </FormRow>
        ) : null}
        <FormRow label={tab.dateLabel} error={errors.movement_date}>
          {input('movement_date', 'date')}
        </FormRow>
        {guest ? (
          <FormRow label="Đến ngày" error={errors.end_date}>
            {input('end_date', 'date')}
          </FormRow>
        ) : (
          <>
            <FormRow label="Số quyết định" error={errors.decision_no}>
              {input('decision_no')}
            </FormRow>
            <FormRow label="Lý do" error={errors.reason}>
              {input('reason')}
            </FormRow>
          </>
        )}
        <FormRow label="Ghi chú" error={errors.note}>
          {input('note')}
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </form>
  );
}

// Thao tác trên một biến động: duyệt, từ chối, đánh dấu trường đến đã tiếp nhận, PDF, tệp theo mẫu Bộ
function MovementActions({
  tab,
  movement,
  canManage,
  canExport,
  onChanged,
}: {
  tab: TabInfo;
  movement: StaffMovement;
  canManage: boolean;
  canExport: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [confirmedOn, setConfirmedOn] = useState(today());
  const [fileError, setFileError] = useState<string>();
  const refresh = async (message: string) => {
    onChanged(message);
    await queryClient.invalidateQueries({ queryKey: ['staff-movements'] });
    await queryClient.invalidateQueries({ queryKey: ['staff'] });
  };
  const approve = useMutation({
    mutationFn: () => approveStaffMovement(movement.id),
    onSuccess: () => refresh(`Đã ${tab.approveLabel.toLowerCase()}: ${movement.full_name}`),
  });
  const reject = useMutation({
    mutationFn: () => rejectStaffMovement(movement.id, note),
    onSuccess: () => refresh(`Đã từ chối: ${movement.full_name}`),
  });
  const confirm = useMutation({
    mutationFn: () => confirmStaffMovement(movement.id, confirmedOn),
    onSuccess: () => refresh(`Đã đánh dấu trường đến đã tiếp nhận: ${movement.full_name}`),
  });
  const file = (build: () => Promise<void>) => {
    setFileError(undefined);
    build().catch((error: unknown) => setFileError(messageOf(error)));
  };
  const error = approve.error ?? reject.error ?? confirm.error;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-page p-3" aria-label={`Biến động ${movement.full_name}`}>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {fileError ? <Alert tone="danger">{fileError}</Alert> : null}
      <p className="text-content text-text">
        {[movement.decision_no && `Số quyết định ${movement.decision_no}`, movement.reason, movement.note, movement.decision_note]
          .filter(Boolean)
          .join(' · ') || 'Không có ghi chú.'}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        {canManage && movement.status === 'pending' ? (
          <>
            <Button variant="primary" disabled={approve.isPending} onClick={() => approve.mutate()}>
              {tab.approveLabel}
            </Button>
            <label className="flex items-center gap-2 text-label font-medium text-text">
              Lý do từ chối
              <input value={note} onChange={(event) => setNote(event.target.value)} className={FORM_CONTROL_CLASS} />
            </label>
            <Button disabled={!note.trim() || reject.isPending} onClick={() => reject.mutate()}>
              Từ chối
            </Button>
          </>
        ) : null}
        {canManage && tab.type === 'transfer_out' && movement.status === 'approved' && !movement.confirmed ? (
          <>
            <label className="flex items-center gap-2 text-label font-medium text-text">
              Ngày trường đến tiếp nhận
              <input type="date" value={confirmedOn} onChange={(event) => setConfirmedOn(event.target.value)} className={FORM_CONTROL_CLASS} />
            </label>
            <Button disabled={confirm.isPending} onClick={() => confirm.mutate()}>
              Đánh dấu trường đến đã tiếp nhận
            </Button>
          </>
        ) : null}
        <Button onClick={() => file(() => downloadMovementPdf(movement.id))}>Xem và in PDF</Button>
        {canExport && tab.type === 'transfer_out' ? (
          <Button
            title="Tệp 75 cột một dòng để trao cho trường đến; hệ thống không gửi đi"
            onClick={() => file(() => downloadMovementMinistryFile(movement.id))}
          >
            Xuất tệp theo mẫu Bộ
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function MovementTab({ tab, onChanged }: { tab: TabInfo; onChanged(message: string): void }) {
  const canManage = useHasPermission(PERMISSION_CODES.staffManage);
  const canExport = useHasPermission(PERMISSION_CODES.dataExport);
  const queryClient = useQueryClient();
  const grid = useGridSettings(tab.gridKey);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string>();
  const pageSize = grid.settings.pageSize;
  const list = useQuery({
    queryKey: ['staff-movements', tab.type, status, search, page, pageSize],
    queryFn: () =>
      listStaffMovements({ type: tab.type, status: status || undefined, q: search || undefined, page, page_size: pageSize }),
    enabled: grid.ready,
  });
  const error = list.error ?? grid.error;
  return (
    <div className="flex flex-col gap-4">
      {creating ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <CreateMovementForm
            tab={tab}
            onCancel={() => setCreating(false)}
            onCreated={(message) => {
              setCreating(false);
              onChanged(message);
              void queryClient.invalidateQueries({ queryKey: ['staff-movements'] });
            }}
          />
        </section>
      ) : null}
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <DataGrid
        label={tab.label}
        columns={columnsOf(tab)}
        rows={list.data?.items ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.full_name}
        getRowAriaLabel={(row) => `Biến động ${row.full_name}`}
        loading={!list.data && !list.isError}
        emptyText="Chưa có biến động."
        search={{
          label: 'Tìm theo họ tên hoặc trường',
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
        }}
        advancedSearch={
          <label className="text-label font-medium text-text">
            Trạng thái
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal md:w-64"
            >
              <option value="">Tất cả</option>
              <option value="pending">Chờ xử lý</option>
              <option value="approved">{tab.type === 'transfer_in' ? 'Đã tiếp nhận' : tab.type === 'guest_in' ? 'Đã xác nhận' : 'Đã duyệt'}</option>
              <option value="rejected">Từ chối</option>
            </select>
          </label>
        }
        toolbar={
          canManage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        rowActions={(row) => (
          <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
            {openId === row.id ? 'Ẩn' : 'Hồ sơ'}
          </Button>
        )}
        activeRowId={openId}
        renderRowDetail={(row) =>
          openId === row.id ? (
            <MovementActions tab={tab} movement={row} canManage={canManage} canExport={canExport} onChanged={onChanged} />
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
        serverPagination={{ page, total: list.data?.total ?? 0, onPageChange: setPage }}
      />
    </div>
  );
}

export function StaffMovementsPage() {
  const [active, setActive] = useState<MovementType>('transfer_in');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const tab = TABS.find((item) => item.type === active) ?? TABS[0]!;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/staff-movements')}</h1>
        <Alert tone="info">
          Chưa liên thông giữa các trường: hồ sơ chuyển trao tay bằng tệp theo mẫu Bộ hoặc PDF; trạng thái tiếp nhận của
          trường đến do trường mình đánh dấu.
        </Alert>
        <div role="tablist" aria-label="Biến động nhân sự" className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((item) => (
            <button
              key={item.type}
              type="button"
              role="tab"
              aria-selected={active === item.type}
              onClick={() => setActive(item.type)}
              className={`-mb-px rounded-t-lg border border-b-0 px-3 py-2 text-content ${
                active === item.type ? 'border-border bg-card font-semibold text-text' : 'border-transparent text-text-secondary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <MovementTab key={tab.type} tab={tab} onChanged={setToastMessage} />
      </div>
    </AppShell>
  );
}
