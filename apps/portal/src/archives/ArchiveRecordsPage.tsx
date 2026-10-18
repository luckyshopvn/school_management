import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  Toast,
  resolveVisibleColumns,
  type DataGridColumn,
} from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { ArchiveUnitField, useDefaultArchiveUnit } from './ArchiveUnitField.js';
import { fieldErrorsOf, formatDate, messageOf, numberOrText, selectClass, useArchiveUnits } from './archive-ui.js';
import {
  ARCHIVE_STATUS_LABELS,
  createArchiveRecord,
  deleteArchiveFile,
  deleteArchiveRecord,
  downloadArchiveFile,
  exportArchiveRecords,
  listArchiveFonds,
  listArchiveHandlers,
  readArchiveRecord,
  retentionText,
  searchArchiveRecords,
  updateArchiveRecord,
  uploadArchiveFile,
  type ArchiveFond,
  type ArchiveRecord,
  type ArchiveRecordFile,
  type ArchiveRecordFilter,
  type ArchiveRecordStatus,
  type ArchiveRetention,
} from './archives-api.js';

// 5.10.1. Hồ sơ tài liệu (DT-15 phần 15h2, YCTD-118): hai danh sách "Chưa hoàn thành" và "Hoàn thành" theo mục 5.10 của
// Sở, có người giải quyết và thời hạn; hồ sơ chưa hoàn thành đã qua thời hạn hiện "Quá hạn". Lưới dùng chung phân trang ở
// máy chủ, tìm theo số, ký hiệu hoặc tiêu đề, Mở rộng tìm kiếm theo phông, người giải quyết, thời hạn; Thêm mới, Sửa bằng
// biểu mẫu theo khối với nút Ghi, Xóa qua hộp xác nhận, Xuất Excel các cột đang hiện. Tệp đính kèm lưu ở kho tệp chung.
// YCTD-122: hồ sơ thuộc một đơn vị hoặc toàn trường, lọc theo đơn vị; người giải quyết chọn từ nhân sự đang làm việc (người
// ngoài danh sách thì nhập tên); hồ sơ chưa hoàn thành có thời hạn trong 3 ngày tới hiện "Sắp đến hạn"
const TABS: Array<{ status: ArchiveRecordStatus; label: string }> = [
  { status: 'pending', label: 'Chưa hoàn thành' },
  { status: 'completed', label: 'Hoàn thành' },
];
const MAXIMUM_FILE_BYTES = 10 * 1024 * 1024;
const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';

function columnsOf(status: ArchiveRecordStatus): Array<DataGridColumn<ArchiveRecord>> {
  return [
    { id: 'code', header: 'Số, ký hiệu', cell: (row) => row.code },
    { id: 'title', header: 'Tiêu đề hồ sơ', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
    { id: 'fond', header: 'Phông', cell: (row) => row.fond_name ?? '' },
    { id: 'org_unit', header: 'Đơn vị', cell: (row) => row.org_unit_name ?? 'Toàn trường' },
    { id: 'handler_name', header: 'Người giải quyết', cell: (row) => row.handler_name },
    { id: 'opened_on', header: 'Ngày mở hồ sơ', cell: (row) => formatDate(row.opened_on) },
    {
      id: 'due_date',
      header: 'Thời hạn',
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          {formatDate(row.due_date)}
          {row.overdue ? <StatusBadge tone="danger" label="Quá hạn" /> : null}
          {row.due_soon ? <StatusBadge tone="warning" label="Sắp đến hạn" /> : null}
        </span>
      ),
    },
    ...(status === 'completed'
      ? [{ id: 'completed_on', header: 'Ngày hoàn thành', cell: (row: ArchiveRecord) => formatDate(row.completed_on) }]
      : []),
    { id: 'retention', header: 'Thời hạn bảo quản', cell: (row) => retentionText(row.retention, row.retention_years) },
    { id: 'sheet_count', header: 'Số tờ', hiddenByDefault: true, cell: (row) => row.sheet_count ?? '' },
    { id: 'file_count', header: 'Tệp đính kèm', cell: (row) => (row.file_count > 0 ? row.file_count : '') },
    { id: 'note', header: 'Ghi chú', hiddenByDefault: true, cell: (row) => row.note ?? '' },
  ];
}

const OTHER_HANDLER = 'other';
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

function RecordForm({
  record,
  fonds,
  defaultStatus,
  onSaved,
  onCancel,
}: {
  record?: ArchiveRecord;
  fonds: ArchiveFond[];
  defaultStatus: ArchiveRecordStatus;
  onSaved(saved: ArchiveRecord): void;
  onCancel(): void;
}) {
  const [values, setValues] = useState({
    code: record?.code ?? '',
    title: record?.title ?? '',
    fond_id: record?.fond_id ?? '',
    sheet_count: record?.sheet_count === null || !record ? '' : String(record.sheet_count),
    note: record?.note ?? '',
    org_unit_id: record?.org_unit_id ?? '',
    // Mã nhân sự giải quyết; OTHER_HANDLER là người ngoài danh sách, nhập tên
    handler_staff_id: record ? (record.handler_staff_id ?? OTHER_HANDLER) : '',
    handler_name: record?.handler_name ?? '',
    opened_on: record?.opened_on ?? VIETNAM_DATE.format(new Date()),
    due_date: record?.due_date ?? '',
    status: record?.status ?? defaultStatus,
    completed_on: record?.completed_on ?? '',
    retention: (record?.retention ?? 'permanent') as ArchiveRetention,
    retention_years: record?.retention_years === null || !record ? '' : String(record.retention_years),
  });
  const set = <Key extends keyof typeof values>(key: Key, value: (typeof values)[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const defaultUnit = useDefaultArchiveUnit();
  // Đơn vị mặc định có sau khi đọc xong danh sách đơn vị
  useEffect(() => {
    if (!record && defaultUnit) {
      setValues((current) => (current.org_unit_id ? current : { ...current, org_unit_id: defaultUnit }));
    }
  }, [record, defaultUnit]);
  const handlers = useQuery({ queryKey: ['archive-handlers'], queryFn: listArchiveHandlers });
  const handlerChoices = (handlers.data ?? []).filter(
    (handler) =>
      !values.org_unit_id || handler.org_unit_id === values.org_unit_id || handler.id === values.handler_staff_id,
  );
  // Phông toàn trường hoặc cùng đơn vị với hồ sơ
  const fondChoices = fonds.filter((fond) => fond.org_unit_id === null || fond.org_unit_id === values.org_unit_id);
  const otherHandler = values.handler_staff_id === OTHER_HANDLER;
  const save = useMutation({
    mutationFn: () => {
      const input = {
        code: values.code,
        title: values.title,
        fond_id: values.fond_id || null,
        org_unit_id: values.org_unit_id || null,
        handler_staff_id: otherHandler ? null : values.handler_staff_id || null,
        handler_name: otherHandler ? values.handler_name : '',
        opened_on: values.opened_on,
        due_date: values.due_date || null,
        status: values.status,
        completed_on: values.status === 'completed' ? values.completed_on || null : null,
        retention: values.retention,
        retention_years: values.retention === 'limited' ? numberOrText(values.retention_years) : null,
        sheet_count: numberOrText(values.sheet_count),
        note: values.note || null,
      };
      return record ? updateArchiveRecord(record.id, input) : createArchiveRecord(input);
    },
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const title = record ? `Sửa hồ sơ ${record.code}` : 'Thêm mới hồ sơ tài liệu';
  const input = (key: 'code' | 'title' | 'handler_name' | 'sheet_count' | 'retention_years', label: string) => (
    <FormRow label={label} error={errors[key]}>
      <input
        className={FORM_CONTROL_CLASS}
        inputMode={key === 'sheet_count' || key === 'retention_years' ? 'numeric' : undefined}
        value={values[key]}
        onChange={(event) => set(key, event.target.value)}
      />
    </FormRow>
  );
  const date = (key: 'opened_on' | 'due_date' | 'completed_on', label: string) => (
    <FormRow label={label} error={errors[key]}>
      <input
        type="date"
        className={FORM_CONTROL_CLASS}
        value={values[key]}
        onChange={(event) => set(key, event.target.value)}
      />
    </FormRow>
  );
  return (
    <form
      noValidate
      aria-label={title}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold text-text">{title}</h2>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin hồ sơ">
        {input('code', 'Số, ký hiệu hồ sơ')}
        {input('title', 'Tiêu đề hồ sơ')}
        <FormRow label="Phông lưu trữ" error={errors.fond_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.fond_id}
            onChange={(event) => set('fond_id', event.target.value)}
          >
            <option value="">-- Không thuộc phông --</option>
            {fondChoices.map((fond) => (
              <option key={fond.id} value={fond.id}>
                {fond.code} - {fond.name}
              </option>
            ))}
          </select>
        </FormRow>
        {input('sheet_count', 'Số tờ')}
        <FormRow label="Ghi chú" error={errors.note}>
          <textarea
            className={FORM_CONTROL_CLASS}
            rows={2}
            value={values.note}
            onChange={(event) => set('note', event.target.value)}
          />
        </FormRow>
      </FormBlock>
      <FormBlock title="Giải quyết">
        <ArchiveUnitField
          value={values.org_unit_id}
          onChange={(value) => set('org_unit_id', value)}
          error={errors.org_unit_id}
        />
        <FormRow
          label="Người giải quyết"
          error={errors.handler_staff_id ?? (otherHandler ? undefined : errors.handler_name)}
        >
          <select
            className={FORM_CONTROL_CLASS}
            value={values.handler_staff_id}
            onChange={(event) => set('handler_staff_id', event.target.value)}
          >
            <option value="">-- Chọn nhân sự --</option>
            {handlerChoices.map((handler) => (
              <option key={handler.id} value={handler.id}>
                {handler.full_name} ({handler.code})
              </option>
            ))}
            <option value={OTHER_HANDLER}>Người khác (nhập tên)</option>
          </select>
        </FormRow>
        {otherHandler ? input('handler_name', 'Tên người giải quyết') : null}
        {date('opened_on', 'Ngày mở hồ sơ')}
        {date('due_date', 'Thời hạn giải quyết')}
        <FormRow label="Trạng thái" error={errors.status}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.status}
            onChange={(event) => set('status', event.target.value as ArchiveRecordStatus)}
          >
            <option value="pending">Chưa hoàn thành</option>
            <option value="completed">Hoàn thành</option>
          </select>
        </FormRow>
        {values.status === 'completed' ? date('completed_on', 'Ngày hoàn thành') : null}
      </FormBlock>
      <FormBlock title="Bảo quản">
        <FormRow label="Thời hạn bảo quản" error={errors.retention}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.retention}
            onChange={(event) => set('retention', event.target.value as ArchiveRetention)}
          >
            <option value="permanent">Vĩnh viễn</option>
            <option value="limited">Có thời hạn</option>
          </select>
        </FormRow>
        {values.retention === 'limited' ? input('retention_years', 'Số năm bảo quản') : null}
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

function sizeText(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Tệp đính kèm của hồ sơ: người xem tải về; người quản lý tải lên, xóa
function RecordFiles({ recordId, canManage, onChanged }: { recordId: string; canManage: boolean; onChanged(): void }) {
  const queryClient = useQueryClient();
  const inputId = useId();
  const inputReference = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string>();
  const [deleting, setDeleting] = useState<ArchiveRecordFile>();
  const detail = useQuery({ queryKey: ['archive-record', recordId], queryFn: () => readArchiveRecord(recordId) });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['archive-record', recordId] });
    onChanged();
  };
  const upload = useMutation({
    mutationFn: (file: File) => uploadArchiveFile(recordId, file),
    onSuccess: async () => {
      if (inputReference.current) {
        inputReference.current.value = '';
      }
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (file: ArchiveRecordFile) => deleteArchiveFile(recordId, file.id),
    onSuccess: async () => {
      setDeleting(undefined);
      await refresh();
    },
    onError: () => setDeleting(undefined),
  });
  const download = useMutation({ mutationFn: (file: ArchiveRecordFile) => downloadArchiveFile(recordId, file) });
  const files = detail.data?.files ?? [];
  const failure = upload.error ?? remove.error ?? download.error ?? detail.error;
  const error = localError ?? (failure ? messageOf(failure) : undefined);

  return (
    <FormBlock title="Tệp đính kèm">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {files.length === 0 && detail.data ? (
        <p className="text-content text-text-secondary">Chưa có tệp đính kèm.</p>
      ) : null}
      {files.length > 0 ? (
        <ul aria-label="Danh sách tệp đính kèm" className="flex flex-col gap-1">
          {files.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center gap-2 text-content">
              <span className="font-medium">{file.file_name}</span>
              <span className="text-label text-text-muted">{sizeText(file.size)}</span>
              <Button variant="text" onClick={() => download.mutate(file)}>
                Tải về
              </Button>
              {canManage ? (
                <Button variant="text" onClick={() => setDeleting(file)}>
                  Xóa tệp
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={inputId} className="text-label font-medium text-text">
            Chọn tệp (PDF, ảnh, Word, Excel; tối đa 10 MB)
          </label>
          <input
            id={inputId}
            ref={inputReference}
            type="file"
            accept={FILE_ACCEPT}
            disabled={upload.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setLocalError(undefined);
              upload.reset();
              if (!file) {
                return;
              }
              if (file.size > MAXIMUM_FILE_BYTES) {
                setLocalError('Tệp đính kèm tối đa 10 MB');
                event.target.value = '';
                return;
              }
              upload.mutate(file);
            }}
          />
        </div>
      ) : null}
      {deleting ? (
        <ConfirmDeleteDialog
          open
          subject={`tệp ${deleting.file_name}`}
          busy={remove.isPending}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => remove.mutate(deleting)}
        />
      ) : null}
    </FormBlock>
  );
}

export function ArchiveRecordsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.archiveManage);
  const canExport = useHasPermission(PERMISSION_CODES.archiveExport);
  const queryClient = useQueryClient();
  const grid = useGridSettings('archive-records');
  const [status, setStatus] = useState<ArchiveRecordStatus>('pending');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Omit<ArchiveRecordFilter, 'status' | 'search'>>({});
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [deleting, setDeleting] = useState<ArchiveRecord>();
  const [toastMessage, setToastMessage] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const fonds = useQuery({ queryKey: ['archive-fonds'], queryFn: listArchiveFonds });
  const activeFilter: ArchiveRecordFilter = {
    ...filter,
    overdue: status === 'pending' ? filter.overdue : undefined,
    due_soon: status === 'pending' ? filter.due_soon : undefined,
    status,
    search: search.trim() || undefined,
  };
  const pageSize = grid.settings.pageSize;
  const records = useQuery({
    queryKey: ['archive-records', activeFilter, page, pageSize],
    queryFn: () => searchArchiveRecords({ ...activeFilter, page, pageSize }),
    enabled: grid.ready,
  });
  const columns = columnsOf(status);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['archive-records'] }),
      queryClient.invalidateQueries({ queryKey: ['archive-fonds'] }),
    ]);
  const remove = useMutation({
    mutationFn: (record: ArchiveRecord) => deleteArchiveRecord(record.id),
    onSuccess: async (_result, record) => {
      setDeleting(undefined);
      setEditingId(undefined);
      await refresh();
      setToastMessage(`Đã xóa hồ sơ ${record.code}`);
    },
    onError: () => setDeleting(undefined),
  });
  const change = <Key extends keyof typeof filter>(key: Key, value: (typeof filter)[Key]) => {
    setFilter((current) => ({ ...current, [key]: value || undefined }));
    setPage(1);
  };
  const runExport = async () => {
    setExportError(undefined);
    setExporting(true);
    try {
      await exportArchiveRecords(
        activeFilter,
        resolveVisibleColumns(columns, grid.settings.columns).map((column) => column.id),
      );
    } catch (error) {
      setExportError(messageOf(error));
    } finally {
      setExporting(false);
    }
  };
  const fondList = fonds.data ?? [];
  const viewUnits = useArchiveUnits(PERMISSION_CODES.archiveView);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/archive-records')}</h1>
        <div
          role="tablist"
          aria-label="Danh sách hồ sơ tài liệu"
          className="flex flex-wrap gap-1 border-b border-border"
        >
          {TABS.map((tab) => (
            <button
              key={tab.status}
              type="button"
              role="tab"
              aria-selected={status === tab.status}
              onClick={() => {
                setStatus(tab.status);
                setPage(1);
                setEditingId(undefined);
              }}
              className={`-mb-px rounded-t-lg border border-b-0 px-3 py-2 text-content ${
                status === tab.status
                  ? 'border-border bg-card font-semibold text-text'
                  : 'border-transparent text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {creating ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <RecordForm
              fonds={fondList}
              defaultStatus={status}
              onCancel={() => setCreating(false)}
              onSaved={(saved) => {
                setCreating(false);
                void refresh();
                // Mở hồ sơ vừa tạo ở danh sách của nó để đính kèm tệp ngay
                setStatus(saved.status);
                setSearch(saved.code);
                setFilter({});
                setPage(1);
                setEditingId(saved.id);
                setToastMessage(`Đã tạo hồ sơ ${saved.code}`);
              }}
            />
          </section>
        ) : null}
        {records.isError ? <Alert tone="danger">{messageOf(records.error)}</Alert> : null}
        {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        {exportError ? <Alert tone="danger">{exportError}</Alert> : null}
        <DataGrid
          label={`Danh sách hồ sơ ${ARCHIVE_STATUS_LABELS[status].toLocaleLowerCase('vi')}`}
          columns={columns}
          rows={records.data?.items ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.code}
          getRowAriaLabel={(row) => `Hồ sơ ${row.code}`}
          loading={!records.data && !records.isError}
          emptyText="Chưa có hồ sơ nào."
          search={{
            label: 'Tìm theo số, ký hiệu hoặc tiêu đề',
            value: search,
            onChange: (value) => {
              setSearch(value);
              setPage(1);
            },
          }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
              <label className="text-label font-medium text-text">
                Đơn vị
                <select
                  value={filter.org_unit_id ?? ''}
                  onChange={(event) => change('org_unit_id', event.target.value)}
                  className={selectClass}
                >
                  <option value="">Tất cả</option>
                  {viewUnits.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Phông lưu trữ
                <select
                  value={filter.fond_id ?? ''}
                  onChange={(event) => change('fond_id', event.target.value)}
                  className={selectClass}
                >
                  <option value="">Tất cả</option>
                  {fondList.map((fond) => (
                    <option key={fond.id} value={fond.id}>
                      {fond.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Người giải quyết
                <input
                  value={filter.handler ?? ''}
                  onChange={(event) => change('handler', event.target.value)}
                  className={selectClass}
                />
              </label>
              <label className="text-label font-medium text-text">
                Thời hạn từ ngày
                <input
                  type="date"
                  value={filter.due_from ?? ''}
                  onChange={(event) => change('due_from', event.target.value)}
                  className={selectClass}
                />
              </label>
              <label className="text-label font-medium text-text">
                Thời hạn đến ngày
                <input
                  type="date"
                  value={filter.due_to ?? ''}
                  onChange={(event) => change('due_to', event.target.value)}
                  className={selectClass}
                />
              </label>
              {status === 'pending' ? (
                <label className="flex items-center gap-2 text-label font-medium text-text">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={filter.overdue === true}
                    onChange={(event) => change('overdue', event.target.checked)}
                  />
                  Chỉ hồ sơ quá hạn
                </label>
              ) : null}
              {status === 'pending' ? (
                <label className="flex items-center gap-2 text-label font-medium text-text">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={filter.due_soon === true}
                    onChange={(event) => change('due_soon', event.target.checked)}
                  />
                  Chỉ hồ sơ sắp đến hạn
                </label>
              ) : null}
            </div>
          }
          toolbar={() => (
            <>
              {canManage ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    setCreating(true);
                    setEditingId(undefined);
                  }}
                >
                  Thêm mới
                </Button>
              ) : null}
              {canExport ? (
                <Button disabled={exporting} onClick={() => void runExport()}>
                  Xuất Excel
                </Button>
              ) : null}
            </>
          )}
          rowActions={(row) => (
            <span className="flex flex-wrap justify-end gap-1">
              <Button
                variant="text"
                onClick={() => {
                  setCreating(false);
                  setEditingId(editingId === row.id ? undefined : row.id);
                }}
              >
                {canManage ? 'Sửa' : editingId === row.id ? 'Ẩn' : 'Xem'}
              </Button>
              {canManage ? (
                <Button variant="text" onClick={() => setDeleting(row)}>
                  Xóa
                </Button>
              ) : null}
            </span>
          )}
          activeRowId={editingId}
          renderRowDetail={(row) =>
            editingId === row.id ? (
              <div className="flex flex-col gap-4">
                {canManage ? (
                  <RecordForm
                    key={`${row.id}-${row.updated_at}`}
                    record={row}
                    fonds={fondList}
                    defaultStatus={status}
                    onCancel={() => setEditingId(undefined)}
                    onSaved={(saved) => {
                      void refresh();
                      setToastMessage(`Đã ghi hồ sơ ${saved.code}`);
                      if (saved.status !== status) {
                        setEditingId(undefined);
                      }
                    }}
                  />
                ) : null}
                <RecordFiles recordId={row.id} canManage={canManage} onChanged={() => void refresh()} />
              </div>
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
          serverPagination={{ page, total: records.data?.total ?? 0, onPageChange: setPage }}
        />
      </div>
      {deleting ? (
        <ConfirmDeleteDialog
          open
          subject={`hồ sơ ${deleting.code}`}
          busy={remove.isPending}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => remove.mutate(deleting)}
        >
          Các tệp đính kèm của hồ sơ cũng bị xóa.
        </ConfirmDeleteDialog>
      ) : null}
    </AppShell>
  );
}
