import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  ConfirmDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  Toast,
  type DataGridColumn,
  type StatusTone,
} from '@school-management/ui';
import { MoetImportSection } from '../imports/MoetImportSection.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  changeSchoolSplitStatus,
  createSchoolSplit,
  deleteSchoolSplit,
  exportSchoolSplit,
  listSchoolSplits,
  listSplitCandidates,
  readSchoolSplit,
  SCHOOL_SPLIT_STATUS_LABELS,
  updateSchoolSplit,
  type SchoolSplitRequest,
  type SchoolSplitStatus,
  type SplitCandidate,
} from './school-api.js';

// 1.8. Tách trường theo Sở, bản chạy nội bộ (DT-16 phần 16e; quyết định của Eric ngày 2026-10-16). Tạo yêu cầu tách hồ sơ:
// trường đến, lý do, danh sách học sinh, nhân sự. Hồ sơ gửi đi là tệp theo mẫu CSDL ngành (82 cột học sinh, 75 cột nhân sự)
// để trường đến nhập; phần mềm không truyền dữ liệu sang trường khác nên nút ghi đúng việc làm: "Xuất hồ sơ…", "Xác nhận đi",
// "Đánh dấu đã tiếp nhận". "Tiếp nhận hồ sơ tách trường" là nhập tệp đó qua bộ nhập tệp CSDL ngành sẵn có
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const STATUS_TONES: Record<SchoolSplitStatus, StatusTone> = {
  draft: 'neutral',
  confirmed: 'info',
  received: 'success',
};

const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleDateString('vi-VN') : '');

const COLUMNS: Array<DataGridColumn<SchoolSplitRequest>> = [
  { id: 'code', header: 'Mã yêu cầu', alwaysVisible: true, className: 'font-medium', cell: (row) => row.code },
  { id: 'destination_school', header: 'Trường đến', cell: (row) => row.destination_school },
  { id: 'destination_code', header: 'Mã trường đến', hiddenByDefault: true, cell: (row) => row.destination_code ?? '' },
  { id: 'reason', header: 'Lý do', cell: (row) => row.reason },
  { id: 'child_count', header: 'Số học sinh', cell: (row) => row.child_count },
  { id: 'staff_count', header: 'Số nhân sự', cell: (row) => row.staff_count },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => <StatusBadge tone={STATUS_TONES[row.status]} label={SCHOOL_SPLIT_STATUS_LABELS[row.status]} />,
  },
  { id: 'confirmed_at', header: 'Ngày xác nhận đi', cell: (row) => formatDateTime(row.confirmed_at) },
  { id: 'received_at', header: 'Ngày tiếp nhận', cell: (row) => formatDateTime(row.received_at) },
  { id: 'received_note', header: 'Ghi chú tiếp nhận', hiddenByDefault: true, cell: (row) => row.received_note ?? '' },
];

// Chọn học sinh hoặc nhân sự: tìm theo tên, mã, lớp rồi tích chọn; danh sách đã chọn hiện bên dưới
function SubjectPicker({
  type,
  title,
  selected,
  onChange,
}: {
  type: 'child' | 'staff';
  title: string;
  selected: SplitCandidate[];
  onChange(next: SplitCandidate[]): void;
}) {
  const [search, setSearch] = useState('');
  const candidates = useQuery({
    queryKey: ['school-splits', 'candidates', type, search.trim()],
    queryFn: () => listSplitCandidates(type, search.trim()),
  });
  const selectedIds = new Set(selected.map((item) => item.id));
  const describe = (item: SplitCandidate) =>
    [item.full_name, item.class_name ?? item.code, item.dob?.split('-').reverse().join('/')].filter(Boolean).join(' – ');
  return (
    <FormBlock title={title}>
      <FormRow label="Tìm">
        <input
          className={FORM_CONTROL_CLASS}
          aria-label={`Tìm ${type === 'child' ? 'học sinh' : 'nhân sự'}`}
          placeholder={type === 'child' ? 'Họ tên, mã học sinh hoặc lớp' : 'Họ tên hoặc mã nhân sự'}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </FormRow>
      <div className="max-h-56 overflow-auto rounded-lg border border-border">
        {candidates.isError ? <Alert tone="danger">{messageOf(candidates.error)}</Alert> : null}
        <ul className="flex flex-col">
          {(candidates.data ?? []).map((item) => (
            <li key={item.id} className="border-t border-border px-3 py-1 first:border-t-0">
              <label className="flex items-center gap-2 text-content">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, item]
                        : selected.filter((chosen) => chosen.id !== item.id),
                    )
                  }
                />
                {describe(item)}
              </label>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-label text-text-secondary">
        Đã chọn {selected.length}
        {selected.length > 0 ? `: ${selected.map((item) => item.full_name).join(', ')}` : ''}
      </p>
    </FormBlock>
  );
}

function SplitForm({
  requestId,
  onSaved,
  onCancel,
}: {
  requestId: string | null;
  onSaved(message: string): void;
  onCancel(): void;
}) {
  const detail = useQuery({
    queryKey: ['school-splits', requestId],
    queryFn: () => readSchoolSplit(requestId ?? ''),
    enabled: requestId !== null,
  });
  const loaded = requestId === null ? null : detail.data;
  const [destination, setDestination] = useState<string>();
  const [destinationCode, setDestinationCode] = useState<string>();
  const [reason, setReason] = useState<string>();
  const [children, setChildren] = useState<SplitCandidate[]>();
  const [staff, setStaff] = useState<SplitCandidate[]>();
  const current = {
    destination: destination ?? loaded?.destination_school ?? '',
    destinationCode: destinationCode ?? loaded?.destination_code ?? '',
    reason: reason ?? loaded?.reason ?? '',
    children:
      children ??
      loaded?.children.map((item) => ({ id: item.id, full_name: item.full_name, dob: item.dob, class_name: item.class_name })) ??
      [],
    staff:
      staff ?? loaded?.staff.map((item) => ({ id: item.id, full_name: item.full_name, dob: null, code: item.code })) ?? [],
  };
  const save = useMutation({
    mutationFn: () => {
      const input = {
        destination_school: current.destination,
        destination_code: current.destinationCode.trim() === '' ? null : current.destinationCode,
        reason: current.reason,
        child_ids: current.children.map((item) => item.id),
        staff_ids: current.staff.map((item) => item.id),
      };
      return requestId ? updateSchoolSplit(requestId, input) : createSchoolSplit(input);
    },
    onSuccess: (saved) => onSaved(requestId ? `Đã ghi yêu cầu ${saved.code}` : `Đã tạo yêu cầu ${saved.code}`),
  });
  const fieldError = (field: string) =>
    save.error instanceof ApiError ? save.error.details.find((detail) => detail.field === field)?.message : undefined;
  if (requestId !== null && detail.isPending) {
    return <div className="h-40 animate-pulse rounded bg-border" aria-hidden="true" />;
  }
  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      aria-label={requestId ? 'Sửa yêu cầu tách hồ sơ' : 'Tạo yêu cầu tách hồ sơ'}
    >
      <h2 className="text-section-title font-semibold text-text">
        {requestId ? `Sửa yêu cầu ${loaded?.code ?? ''}` : 'Tạo yêu cầu tách hồ sơ'}
      </h2>
      {save.error && !(save.error instanceof ApiError && save.error.details.length > 0) ? (
        <Alert tone="danger">{messageOf(save.error)}</Alert>
      ) : null}
      <FormBlock title="Thông tin tách trường">
        <FormRow label="Trường đến" error={fieldError('destination_school')}>
          <input
            className={FORM_CONTROL_CLASS}
            value={current.destination}
            onChange={(event) => setDestination(event.target.value)}
          />
        </FormRow>
        <FormRow label="Mã trường đến" error={fieldError('destination_code')}>
          <input
            className={FORM_CONTROL_CLASS}
            value={current.destinationCode}
            onChange={(event) => setDestinationCode(event.target.value)}
          />
        </FormRow>
        <FormRow label="Lý do" error={fieldError('reason')}>
          <textarea
            className={FORM_CONTROL_CLASS}
            rows={2}
            value={current.reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormRow>
      </FormBlock>
      {fieldError('child_ids') ? <Alert tone="danger">{fieldError('child_ids')}</Alert> : null}
      <SubjectPicker type="child" title="Học sinh tách đi" selected={current.children} onChange={setChildren} />
      <SubjectPicker type="staff" title="Nhân sự tách đi" selected={current.staff} onChange={setStaff} />
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Đóng
        </Button>
      </div>
    </section>
  );
}

type Pending =
  | { kind: 'delete'; row: SchoolSplitRequest }
  | { kind: 'confirm'; row: SchoolSplitRequest }
  | { kind: 'unconfirm'; row: SchoolSplitRequest }
  | { kind: 'receive'; row: SchoolSplitRequest };

export function SchoolSplitsPage() {
  const canExport = useHasPermission(PERMISSION_CODES.dataExport);
  const canImportChildren = useHasPermission(PERMISSION_CODES.importChildren);
  const canImportStaff = useHasPermission(PERMISSION_CODES.importStaff);
  const queryClient = useQueryClient();
  const grid = useGridSettings('school-splits');
  const requests = useQuery({ queryKey: ['school-splits', 'list'], queryFn: listSchoolSplits });
  const [editing, setEditing] = useState<string | null>();
  const [pending, setPending] = useState<Pending>();
  const [receiveNote, setReceiveNote] = useState('');
  const [exportError, setExportError] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['school-splits'] });
  const act = useMutation({
    mutationFn: async (action: Pending) => {
      if (action.kind === 'delete') {
        await deleteSchoolSplit(action.row.id);
        return `Đã xóa yêu cầu ${action.row.code}`;
      }
      await changeSchoolSplitStatus(
        action.row.id,
        action.kind,
        action.kind === 'receive' && receiveNote.trim() !== '' ? receiveNote : null,
      );
      return action.kind === 'confirm'
        ? `Đã xác nhận đi yêu cầu ${action.row.code}`
        : action.kind === 'unconfirm'
          ? `Đã hủy xác nhận yêu cầu ${action.row.code}`
          : `Đã đánh dấu trường đến đã tiếp nhận yêu cầu ${action.row.code}`;
    },
    onSuccess: async (message) => {
      setPending(undefined);
      await refresh();
      setToastMessage(message);
    },
    onError: () => setPending(undefined),
  });
  const runExport = (row: SchoolSplitRequest, subject: 'children' | 'staff') => {
    setExportError(undefined);
    exportSchoolSplit(row.id, subject).catch((error: unknown) => setExportError(messageOf(error)));
  };

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/school-splits')}</h1>
        <Alert tone="info">
          Phần mềm không gửi dữ liệu sang trường khác. Sau khi tạo yêu cầu, bấm "Xuất hồ sơ học sinh", "Xuất hồ sơ nhân sự" để
          tải tệp theo mẫu CSDL ngành (82 cột học sinh, 75 cột nhân sự) rồi gửi cho trường đến; trường đến nhập tệp ở mục
          "Tiếp nhận hồ sơ tách trường". Xác nhận đi, đã tiếp nhận là trạng thái nhà trường tự đánh dấu. Chuyển đi, thôi việc
          của từng hồ sơ làm ở 4.2 Biến động học sinh và hồ sơ nhân sự.
        </Alert>
        {editing !== undefined ? (
          <SplitForm
            key={editing ?? 'new'}
            requestId={editing}
            onCancel={() => setEditing(undefined)}
            onSaved={(message) => {
              setEditing(undefined);
              void refresh();
              setToastMessage(message);
            }}
          />
        ) : null}
        {requests.isError ? <Alert tone="danger">{messageOf(requests.error)}</Alert> : null}
        {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
        {exportError ? <Alert tone="danger">{exportError}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <DataGrid
          label="Danh sách yêu cầu tách hồ sơ"
          columns={COLUMNS}
          rows={requests.data ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.code}
          loading={requests.isPending}
          emptyText="Chưa có yêu cầu tách hồ sơ nào."
          toolbar={
            <Button variant="primary" onClick={() => setEditing(null)}>
              Thêm mới
            </Button>
          }
          rowActions={(row) => (
            <span className="flex flex-wrap justify-end gap-1">
              {row.status === 'draft' ? (
                <>
                  <Button variant="text" onClick={() => setEditing(row.id)}>
                    Sửa
                  </Button>
                  <Button variant="text" onClick={() => setPending({ kind: 'confirm', row })}>
                    Xác nhận đi
                  </Button>
                  <Button variant="text" onClick={() => setPending({ kind: 'delete', row })}>
                    Xóa
                  </Button>
                </>
              ) : null}
              {row.status === 'confirmed' ? (
                <>
                  <Button
                    variant="text"
                    onClick={() => {
                      setReceiveNote('');
                      setPending({ kind: 'receive', row });
                    }}
                  >
                    Đánh dấu đã tiếp nhận
                  </Button>
                  <Button variant="text" onClick={() => setPending({ kind: 'unconfirm', row })}>
                    Hủy xác nhận
                  </Button>
                </>
              ) : null}
              {canExport && row.child_count > 0 ? (
                <Button variant="text" onClick={() => runExport(row, 'children')}>
                  Xuất hồ sơ học sinh
                </Button>
              ) : null}
              {canExport && row.staff_count > 0 ? (
                <Button variant="text" onClick={() => runExport(row, 'staff')}>
                  Xuất hồ sơ nhân sự
                </Button>
              ) : null}
            </span>
          )}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
        {canImportChildren || canImportStaff ? (
          <section className="flex flex-col gap-4" aria-label="Tiếp nhận hồ sơ tách trường">
            <h2 className="text-section-title font-semibold text-text">Tiếp nhận hồ sơ tách trường</h2>
            <p className="text-label text-text-secondary">
              Trường nhận hồ sơ tách từ trường khác: chọn đơn vị, tải lên tệp hồ sơ học sinh hoặc nhân sự theo mẫu CSDL ngành
              mà trường đi gửi. Hệ thống kiểm tra toàn bộ tệp và chỉ ghi khi không còn dòng lỗi.
            </p>
            {canImportChildren ? <MoetImportSection type="moet_children" onChanged={setToastMessage} /> : null}
            {canImportStaff ? <MoetImportSection type="moet_staff" onChanged={setToastMessage} /> : null}
          </section>
        ) : null}
      </div>
      <ConfirmDeleteDialog
        open={pending?.kind === 'delete'}
        subject={pending ? `yêu cầu ${pending.row.code}` : ''}
        busy={act.isPending}
        onCancel={() => setPending(undefined)}
        onConfirm={() => pending && act.mutate(pending)}
      >
        Yêu cầu chưa xác nhận đi bị xóa cùng danh sách học sinh, nhân sự; hồ sơ học sinh, nhân sự không bị ảnh hưởng.
      </ConfirmDeleteDialog>
      {pending && pending.kind !== 'delete' ? (
        <ConfirmDialog
          open
          title={
            pending.kind === 'confirm'
              ? `Xác nhận đi yêu cầu ${pending.row.code}?`
              : pending.kind === 'unconfirm'
                ? `Hủy xác nhận yêu cầu ${pending.row.code}?`
                : `Đánh dấu trường đến đã tiếp nhận yêu cầu ${pending.row.code}?`
          }
          confirmLabel={
            pending.kind === 'confirm' ? 'Xác nhận đi' : pending.kind === 'unconfirm' ? 'Hủy xác nhận' : 'Đánh dấu'
          }
          busy={act.isPending}
          onCancel={() => setPending(undefined)}
          onConfirm={() => act.mutate(pending)}
        >
          {pending.kind === 'confirm' ? (
            'Nhà trường xác nhận hồ sơ được tách sang trường đến; yêu cầu không sửa được nữa. Phần mềm không tự gửi hồ sơ.'
          ) : pending.kind === 'unconfirm' ? (
            'Yêu cầu trở lại chưa xác nhận để sửa.'
          ) : (
            <label className="flex flex-col gap-2 text-label font-medium text-text">
              Ghi chú tiếp nhận (ví dụ văn bản báo nhận của trường đến)
              <input
                className={FORM_CONTROL_CLASS}
                value={receiveNote}
                onChange={(event) => setReceiveNote(event.target.value)}
              />
            </label>
          )}
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
