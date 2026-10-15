import { useCallback, useState, type ReactNode } from 'react';
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
  TextField,
  Toast,
  type DataGridColumn,
  type StatusTone,
} from '@school-management/ui';
import { listCatalogItems } from '../catalogs/catalogs-api.js';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { listStaff } from '../staff/staff-api.js';
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  describeLeaveDates,
  LEAVE_STATUS_LABELS,
  listLeaveRequests,
  readMyLeave,
  rejectLeaveRequest,
  type DayHalf,
  type LeaveRequest,
  type LeaveRequestStatus,
} from './staff-attendance-api.js';

// MH-44 và MH-13 Đơn nghỉ phép (P08-03, BR-40, BR-41, YCTD-59): nhân sự tự gửi đơn, xem số ngày phép năm còn lại;
// phòng nhân sự lập hộ; Hiệu trưởng, Phó Hiệu trưởng duyệt hoặc từ chối đơn của đơn vị. Giao diện chung theo Sở (DT-15
// phần 15f2): lưới đơn của tôi (khóa `my-leave-requests`) và lưới đơn của đơn vị (khóa `leave-requests`, mở rộng tìm kiếm
// theo trạng thái đơn); Thêm mới mở biểu mẫu theo khối, nút Ghi gửi đơn
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const STATUS_TONES: Record<LeaveRequestStatus, StatusTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};

function columnsOf(showStaff: boolean): Array<DataGridColumn<LeaveRequest>> {
  return [
    ...(showStaff
      ? [
          {
            id: 'full_name',
            header: 'Nhân sự',
            alwaysVisible: true,
            className: 'font-medium',
            cell: (row: LeaveRequest) => row.full_name,
          },
        ]
      : []),
    { id: 'leave_type_name', header: 'Loại nghỉ', cell: (row) => row.leave_type_name },
    { id: 'dates', header: 'Thời gian', alwaysVisible: !showStaff, cell: (row) => describeLeaveDates(row) },
    { id: 'days', header: 'Số ngày', cell: (row) => Number(row.days) },
    { id: 'reason', header: 'Lý do', cell: (row) => row.reason },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <>
          <StatusBadge tone={STATUS_TONES[row.status]} label={LEAVE_STATUS_LABELS[row.status]} />
          {row.reject_reason ? <p className="text-label text-text-secondary">{row.reject_reason}</p> : null}
        </>
      ),
    },
  ];
}

const MY_COLUMNS = columnsOf(false);
const UNIT_COLUMNS = columnsOf(true);

function LeaveForm({
  label,
  staffOptions,
  onSaved,
  onCancel,
}: {
  label: string;
  staffOptions?: Array<{ id: string; label: string }>;
  onSaved(message: string): void;
  onCancel(): void;
}) {
  const leaveTypes = useQuery({
    queryKey: ['catalog-items', 'leave_type'],
    queryFn: () => listCatalogItems('leave_type'),
  });
  const [staffId, setStaffId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [firstHalf, setFirstHalf] = useState('');
  const [lastHalf, setLastHalf] = useState('');
  const [reason, setReason] = useState('');
  const singleDay = !toDate || toDate === fromDate;
  const save = useMutation({
    mutationFn: () =>
      createLeaveRequest({
        ...(staffOptions ? { staff_id: staffId } : {}),
        leave_type_id: leaveTypeId,
        from_date: fromDate,
        to_date: toDate || fromDate,
        first_day_half: (firstHalf || null) as DayHalf | null,
        last_day_half: singleDay ? null : ((lastHalf || null) as DayHalf | null),
        reason,
      }),
    onSuccess: (request) => onSaved(`Đã gửi đơn nghỉ ${request.days} ngày`),
  });

  return (
    <form
      className="flex flex-col gap-3"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title={label}>
        {staffOptions ? (
          <FormRow label="Nhân sự nghỉ">
            <select className={FORM_CONTROL_CLASS} value={staffId} onChange={(event) => setStaffId(event.target.value)}>
              <option value="">Chọn nhân sự</option>
              {staffOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormRow>
        ) : null}
        <FormRow label="Loại nghỉ">
          <select
            className={FORM_CONTROL_CLASS}
            value={leaveTypeId}
            onChange={(event) => setLeaveTypeId(event.target.value)}
          >
            <option value="">Chọn loại nghỉ</option>
            {(leaveTypes.data ?? [])
              .filter((item) => item.status === 'active')
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </FormRow>
        <FormRow label="Từ ngày">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </FormRow>
        <FormRow label="Đến ngày">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </FormRow>
        <FormRow label={singleDay ? 'Buổi nghỉ' : 'Ngày đầu'}>
          <select
            className={FORM_CONTROL_CLASS}
            value={firstHalf}
            onChange={(event) => setFirstHalf(event.target.value)}
          >
            <option value="">Cả ngày</option>
            {singleDay ? <option value="morning">Buổi sáng</option> : null}
            <option value="afternoon">Buổi chiều</option>
          </select>
        </FormRow>
        {singleDay ? null : (
          <FormRow label="Ngày cuối">
            <select
              className={FORM_CONTROL_CLASS}
              value={lastHalf}
              onChange={(event) => setLastHalf(event.target.value)}
            >
              <option value="">Cả ngày</option>
              <option value="morning">Buổi sáng</option>
            </select>
          </FormRow>
        )}
        <FormRow label="Lý do nghỉ">
          <input className={FORM_CONTROL_CLASS} value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

// Thao tác trên đơn chờ duyệt: duyệt, từ chối có lý do, hủy đơn
function RequestActions({
  request,
  canApprove,
  canCancel,
  onChanged,
}: {
  request: LeaveRequest;
  canApprove: boolean;
  canCancel: boolean;
  onChanged(message: string): void;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const approve = useMutation({
    mutationFn: () => approveLeaveRequest(request.id),
    onSuccess: () => onChanged('Đã duyệt đơn nghỉ'),
  });
  const reject = useMutation({
    mutationFn: () => rejectLeaveRequest(request.id, rejectReason),
    onSuccess: () => onChanged('Đã từ chối đơn nghỉ'),
  });
  const cancel = useMutation({
    mutationFn: () => cancelLeaveRequest(request.id),
    onSuccess: () => onChanged('Đã hủy đơn nghỉ'),
  });
  const error = approve.error ?? reject.error ?? cancel.error;
  if (request.status !== 'pending') {
    return null;
  }
  return (
    <div className="flex flex-col items-end gap-2 whitespace-normal">
      {canApprove ? (
        <>
          <Button variant="primary" disabled={approve.isPending} onClick={() => approve.mutate()}>
            Duyệt
          </Button>
          <TextField
            label="Lý do từ chối"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
          />
          <Button variant="danger" disabled={reject.isPending} onClick={() => reject.mutate()}>
            Từ chối
          </Button>
        </>
      ) : null}
      {canCancel ? (
        <Button variant="text" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
          Hủy đơn
        </Button>
      ) : null}
      {error ? <p className="text-label text-danger">{messageOf(error)}</p> : null}
    </div>
  );
}

function useRequestSearch(requests: LeaveRequest[]) {
  const [search, setSearch] = useState('');
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = requests.filter(
    (request) =>
      keyword === '' ||
      [request.full_name, request.staff_code, request.leave_type_name, request.reason].some((value) =>
        value.toLocaleLowerCase('vi').includes(keyword),
      ),
  );
  return { search, setSearch, rows };
}

function RequestGrid({
  label,
  gridKey,
  showStaff,
  requests,
  loading,
  canApprove,
  canCancel,
  onChanged,
  toolbar,
  advancedSearch,
}: {
  label: string;
  gridKey: DataGridKey;
  showStaff: boolean;
  requests: LeaveRequest[];
  loading: boolean;
  canApprove: boolean;
  canCancel: boolean;
  onChanged(message: string): void;
  toolbar?: ReactNode;
  advancedSearch?: ReactNode;
}) {
  const grid = useGridSettings(gridKey);
  const { search, setSearch, rows } = useRequestSearch(requests);
  return (
    <>
      {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
      <DataGrid
        label={label}
        columns={showStaff ? UNIT_COLUMNS : MY_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `đơn nghỉ của ${row.full_name} ${row.from_date}`}
        getRowAriaLabel={(row) => `Đơn nghỉ của ${row.full_name} ${row.from_date}`}
        loading={loading}
        emptyText="Chưa có đơn nghỉ."
        search={{
          label: showStaff ? 'Tìm theo tên nhân sự, loại nghỉ, lý do' : 'Tìm theo loại nghỉ, lý do',
          value: search,
          onChange: setSearch,
        }}
        advancedSearch={advancedSearch}
        toolbar={toolbar}
        rowActions={
          canApprove || canCancel
            ? (row) => (
                <RequestActions request={row} canApprove={canApprove} canCancel={canCancel} onChanged={onChanged} />
              )
            : undefined
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </>
  );
}

function MyLeaveSection({ onChanged }: { onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: ['my-leave'], queryFn: readMyLeave, retry: false });
  const [creating, setCreating] = useState(false);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['my-leave'] });
    await queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    onChanged(message);
  };
  if (mine.error instanceof ApiError && mine.error.status === 404) {
    return null;
  }
  const balance = mine.data?.balance;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold text-text">Đơn nghỉ của tôi</h2>
      {mine.error ? <Alert tone="danger">{messageOf(mine.error)}</Alert> : null}
      {balance ? (
        <p className="text-content text-text">
          {balance.policy_missing
            ? `Năm ${balance.year} chưa có quy định phép năm cho bạn.`
            : `Phép năm ${balance.year}: được ${balance.entitled_days ?? 0} ngày, đã nghỉ ${balance.used_days}, còn ${balance.remaining_days ?? 0} ngày.`}
        </p>
      ) : null}
      {creating ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <LeaveForm
            label="Gửi đơn nghỉ của tôi"
            onCancel={() => setCreating(false)}
            onSaved={(message) => {
              setCreating(false);
              void refresh(message);
            }}
          />
        </section>
      ) : null}
      <RequestGrid
        label="Đơn nghỉ của tôi"
        gridKey="my-leave-requests"
        showStaff={false}
        requests={mine.data?.requests ?? []}
        loading={mine.isPending}
        canApprove={false}
        canCancel
        onChanged={refresh}
        toolbar={
          mine.data ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
      />
    </div>
  );
}

function UnitLeaveSection({ onChanged }: { onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [status, setStatus] = useState<LeaveRequestStatus | ''>('pending');
  const [creating, setCreating] = useState(false);
  const requests = useQuery({
    queryKey: ['leave-requests', orgUnitId, status],
    queryFn: () => listLeaveRequests(orgUnitId ?? '', status),
    enabled: Boolean(orgUnitId),
  });
  const canManage = requests.data?.can_manage ?? false;
  const staff = useQuery({
    queryKey: ['staff', orgUnitId, ''],
    queryFn: () => listStaff(orgUnitId ?? '', ''),
    enabled: Boolean(orgUnitId) && canManage,
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    await queryClient.invalidateQueries({ queryKey: ['my-leave'] });
    onChanged(message);
  };

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold text-text">Đơn nghỉ của đơn vị</h2>
      <UnitSelect
        units={unitChoice.units}
        selectedId={orgUnitId}
        onSelect={(id) => {
          setCreating(false);
          unitChoice.select(id);
        }}
      />
      {requests.error ? <Alert tone="danger">{messageOf(requests.error)}</Alert> : null}
      {creating && canManage && staff.data ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <LeaveForm
            key={orgUnitId}
            label="Lập đơn nghỉ hộ"
            staffOptions={staff.data
              .filter((row) => row.status === 'active')
              .map((row) => ({ id: row.id, label: `${row.code} – ${row.full_name}` }))}
            onCancel={() => setCreating(false)}
            onSaved={(message) => {
              setCreating(false);
              void refresh(message);
            }}
          />
        </section>
      ) : null}
      <RequestGrid
        label="Đơn nghỉ của đơn vị"
        gridKey="leave-requests"
        showStaff
        requests={requests.data?.requests ?? []}
        loading={Boolean(orgUnitId) && requests.isPending}
        canApprove={requests.data?.can_approve ?? false}
        canCancel={canManage}
        onChanged={refresh}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Trạng thái đơn
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as LeaveRequestStatus | '')}
                className={`mt-1 ${FORM_CONTROL_CLASS}`}
              >
                <option value="">Tất cả</option>
                {(Object.keys(LEAVE_STATUS_LABELS) as LeaveRequestStatus[]).map((value) => (
                  <option key={value} value={value}>
                    {LEAVE_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        toolbar={
          canManage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
      />
    </div>
  );
}

export function LeaveRequestsPage() {
  const canApprove = useHasPermission(PERMISSION_CODES.leaveApprove);
  const canViewAttendance = useHasPermission(PERMISSION_CODES.staffAttendanceView);
  const canSeeUnit = canApprove || canViewAttendance;
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/leave-requests')}</h1>
        <MyLeaveSection onChanged={setToastMessage} />
        {canSeeUnit ? <UnitLeaveSection onChanged={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
