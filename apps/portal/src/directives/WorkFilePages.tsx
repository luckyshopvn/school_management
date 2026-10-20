import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, WORK_FILE_STATUS_LABELS, type PortalQuickLinkPath } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  type DataGridColumn,
} from '@school-management/ui';
import { useGridSettings } from '../pages/grid-settings.js';
import { fieldErrorsOf, formatDate, messageOf, selectClass, useArchiveUnits } from '../archives/archive-ui.js';
import { listDocumentStaff } from '../incoming-documents/incoming-api.js';
import {
  addWorkFileItem,
  deleteWorkFile,
  listWorkFiles,
  readWorkFile,
  removeWorkFileItem,
  saveWorkFile,
  shareWorkFile,
  transferWorkFile,
  workFileAction,
  type WorkFile,
  type WorkFileBox,
  type WorkFileDetail,
} from './directives-api.js';
import { formatDateTime, Page, todayText, useToast } from './directive-ui.js';

// Hồ sơ công việc theo VNPT iOffice (DT-18 phần 18c, YCTD-141): 5.1 Hồ sơ cá nhân, 5.2 Hồ sơ được chia sẻ, 5.3 Hồ sơ được
// chuyển giao; nộp lưu sang văn thư lưu trữ (5.10): 5.4 Hồ sơ nộp lưu (tiếp nhận, trả về), 5.5 Hồ sơ hết hạn bảo quản
const ITEM_LABELS = { incoming_document: 'Văn bản đến', task: 'Công việc', note: 'Ghi chú' };
const EVENT_LABELS: Record<string, string> = {
  create: 'Lập hồ sơ',
  update: 'Sửa thông tin',
  item_add: 'Thêm thành phần',
  item_remove: 'Bỏ thành phần',
  share: 'Chia sẻ',
  transfer: 'Chuyển giao',
  close: 'Kết thúc hồ sơ',
  reopen: 'Mở lại hồ sơ',
  submit: 'Nộp lưu',
  return: 'Trả về',
  archive: 'Tiếp nhận lưu trữ',
};

function WorkFileForm({
  file,
  onSaved,
  onCancel,
}: {
  file?: WorkFile;
  onSaved(file: WorkFileDetail): void;
  onCancel(): void;
}) {
  const units = useArchiveUnits(PERMISSION_CODES.workFileUse);
  const [values, setValues] = useState({
    code: file?.code ?? '',
    title: file?.title ?? '',
    year: String(file?.year ?? Number(todayText().slice(0, 4))),
    description: file?.description ?? '',
    org_unit_id: file?.org_unit_id ?? '',
    retention: file?.retention ?? 'limited',
    retention_years: file?.retention_years ? String(file.retention_years) : '10',
  });
  const save = useMutation({
    mutationFn: () =>
      saveWorkFile(file?.id ?? null, {
        ...values,
        year: Number(values.year) || values.year,
        org_unit_id: values.org_unit_id || null,
        description: values.description || null,
        retention_years: values.retention === 'limited' ? Number(values.retention_years) || null : null,
      }),
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const input = (key: 'code' | 'title' | 'year' | 'description', label: string) => (
    <FormRow label={label} error={errors[key]}>
      <input className={FORM_CONTROL_CLASS} value={values[key]} onChange={(event) => set(key, event.target.value)} />
    </FormRow>
  );
  return (
    <form
      noValidate
      aria-label={file ? `Sửa hồ sơ ${file.code}` : 'Thêm mới hồ sơ công việc'}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin hồ sơ">
        {input('code', 'Số ký hiệu hồ sơ')}
        {input('title', 'Tiêu đề hồ sơ')}
        {input('year', 'Năm hình thành')}
        {input('description', 'Mô tả')}
        <FormRow label="Đơn vị" error={errors.org_unit_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.org_unit_id}
            onChange={(event) => set('org_unit_id', event.target.value)}
          >
            <option value="">Toàn trường</option>
            {units.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Thời hạn bảo quản" error={errors.retention}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.retention}
            onChange={(event) => set('retention', event.target.value)}
          >
            <option value="limited">Có thời hạn</option>
            <option value="permanent">Vĩnh viễn</option>
          </select>
        </FormRow>
        {values.retention === 'limited' ? (
          <FormRow label="Số năm bảo quản" error={errors.retention_years}>
            <input
              className={FORM_CONTROL_CLASS}
              value={values.retention_years}
              onChange={(event) => set('retention_years', event.target.value)}
            />
          </FormRow>
        ) : null}
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

function WorkFileDetailPanel({ id, onChanged }: { id: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['work-file', id], queryFn: () => readWorkFile(id) });
  const staff = useQuery({ queryKey: ['document-staff'], queryFn: listDocumentStaff });
  const [mode, setMode] = useState<'edit' | 'note' | 'share' | 'transfer' | 'return' | 'accept'>();
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [receiver, setReceiver] = useState('');
  const [shares, setShares] = useState<Record<string, 'view' | 'edit' | ''>>({});
  const apply = (next: WorkFileDetail | null, message: string) => {
    if (next) queryClient.setQueryData(['work-file', id], next);
    void queryClient.invalidateQueries({ queryKey: ['work-files'] });
    setMode(undefined);
    setText('');
    setNote('');
    onChanged(message);
  };
  const action = useMutation({
    mutationFn: async (kind: string): Promise<[WorkFileDetail | null, string]> => {
      switch (kind) {
        case 'note':
          return [await addWorkFileItem(id, { item_type: 'note', title: text, note: note || null }), 'Đã thêm ghi chú'];
        case 'share':
          return [
            await shareWorkFile(
              id,
              Object.entries(shares)
                .filter(([, permission]) => permission)
                .map(([userId, permission]) => ({ user_id: userId, permission: permission as 'view' | 'edit' })),
            ),
            'Đã chia sẻ hồ sơ',
          ];
        case 'transfer':
          await transferWorkFile(id, receiver, note || null);
          return [null, 'Đã chuyển giao hồ sơ'];
        case 'accept':
          return [await workFileAction(id, 'accept', text ? { code: text } : {}), 'Đã tiếp nhận lưu trữ'];
        case 'return':
          return [await workFileAction(id, 'return', { note }), 'Đã trả về hồ sơ'];
        default:
          return [
            await workFileAction(id, kind as 'close' | 'reopen' | 'submit'),
            kind === 'close' ? 'Đã kết thúc hồ sơ' : kind === 'reopen' ? 'Đã mở lại hồ sơ' : 'Đã nộp lưu hồ sơ',
          ];
      }
    },
    onSuccess: ([next, message]) => apply(next, message),
  });
  const removeItem = useMutation({
    mutationFn: (itemId: string) => removeWorkFileItem(id, itemId),
    onSuccess: (next) => apply(next, 'Đã bỏ thành phần'),
  });
  const file = detail.data;
  if (detail.error) {
    return <Alert tone="danger">{messageOf(detail.error)}</Alert>;
  }
  if (!file) {
    return <p className="text-content text-text-secondary">Đang tải…</p>;
  }
  return (
    <div className="flex flex-col gap-3" aria-label={`Chi tiết hồ sơ ${file.code}`}>
      {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
      {removeItem.error ? <Alert tone="danger">{messageOf(removeItem.error)}</Alert> : null}
      {file.return_note && file.status === 'returned' ? (
        <Alert tone="warning">Lý do trả về: {file.return_note}</Alert>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-content md:grid-cols-[12rem_minmax(0,1fr)]">
        <dt className="font-medium">Người lập hồ sơ</dt>
        <dd>{file.owner_name}</dd>
        <dt className="font-medium">Ngày bắt đầu, kết thúc</dt>
        <dd>
          {formatDate(file.opened_on)} – {formatDate(file.closed_on)}
        </dd>
        <dt className="font-medium">Thời hạn bảo quản</dt>
        <dd>{file.retention === 'permanent' ? 'Vĩnh viễn' : `${file.retention_years ?? ''} năm`}</dd>
        {file.transferred_from_name ? (
          <>
            <dt className="font-medium">Chuyển giao từ</dt>
            <dd>
              {file.transferred_from_name}
              {file.transfer_note ? `: ${file.transfer_note}` : ''}
            </dd>
          </>
        ) : null}
        {file.archive_record_code ? (
          <>
            <dt className="font-medium">Hồ sơ lưu trữ</dt>
            <dd>
              {file.archive_record_code}, lưu ngày {formatDate(file.archived_on)}
              {file.expiry_year ? `, hết hạn bảo quản năm ${file.expiry_year}` : ''}
            </dd>
          </>
        ) : null}
      </dl>
      <h3 className="text-content font-semibold">Thành phần hồ sơ</h3>
      <ul className="flex flex-col gap-1 text-content">
        {file.items.length === 0 ? <li className="text-text-secondary">Chưa có thành phần</li> : null}
        {file.items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="info" label={ITEM_LABELS[item.item_type]} />
            <span className="font-medium">{item.title}</span>
            {item.note ? <span className="text-text-secondary">{item.note}</span> : null}
            {file.can_edit_items ? (
              <Button variant="text" onClick={() => removeItem.mutate(item.id)}>
                Bỏ
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {file.can_edit_items ? (
        <p className="text-label text-text-secondary">
          Thêm văn bản đến từ chi tiết văn bản (nút “Lưu vào hồ sơ công việc”), thêm công việc từ chi tiết công việc.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {file.can_edit_items ? (
          <Button variant="secondary" onClick={() => setMode('note')}>
            Thêm ghi chú
          </Button>
        ) : null}
        {file.can_edit ? (
          <Button variant="secondary" onClick={() => setMode('edit')}>
            Sửa thông tin
          </Button>
        ) : null}
        {file.is_owner ? (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShares(Object.fromEntries(file.shares.map((share) => [share.user_id, share.permission])));
                setMode('share');
              }}
            >
              Chia sẻ
            </Button>
            {file.status !== 'submitted' && file.status !== 'archived' ? (
              <Button variant="secondary" onClick={() => setMode('transfer')}>
                Chuyển giao
              </Button>
            ) : null}
          </>
        ) : null}
        {file.can_close ? (
          <Button variant="secondary" onClick={() => action.mutate('close')}>
            Kết thúc hồ sơ
          </Button>
        ) : null}
        {file.can_reopen ? (
          <Button variant="secondary" onClick={() => action.mutate('reopen')}>
            Mở lại
          </Button>
        ) : null}
        {file.can_submit ? (
          <Button variant="primary" onClick={() => action.mutate('submit')}>
            Nộp lưu
          </Button>
        ) : null}
        {file.can_accept ? (
          <>
            <Button variant="primary" onClick={() => setMode('accept')}>
              Tiếp nhận lưu trữ
            </Button>
            <Button variant="secondary" onClick={() => setMode('return')}>
              Trả về
            </Button>
          </>
        ) : null}
      </div>
      {mode === 'edit' ? (
        <WorkFileForm file={file} onCancel={() => setMode(undefined)} onSaved={(next) => apply(next, 'Đã ghi hồ sơ')} />
      ) : null}
      {mode && mode !== 'edit' ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          {mode === 'note' ? (
            <label className="text-label font-medium text-text">
              Tiêu đề ghi chú
              <input className={selectClass} value={text} onChange={(event) => setText(event.target.value)} />
            </label>
          ) : null}
          {mode === 'accept' ? (
            <label className="text-label font-medium text-text">
              Số, ký hiệu hồ sơ lưu trữ (trống thì lấy năm và ký hiệu hồ sơ)
              <input className={selectClass} value={text} onChange={(event) => setText(event.target.value)} />
            </label>
          ) : null}
          {mode === 'transfer' ? (
            <label className="text-label font-medium text-text">
              Người nhận hồ sơ
              <select className={selectClass} value={receiver} onChange={(event) => setReceiver(event.target.value)}>
                <option value="">— Chọn người nhận —</option>
                {(staff.data ?? []).map((person) => (
                  <option key={person.user_id} value={person.user_id}>
                    {person.full_name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {mode === 'share' ? (
            <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto md:grid-cols-2">
              {(staff.data ?? []).map((person) => (
                <label key={person.user_id} className="flex items-center gap-2 text-content">
                  <select
                    aria-label={`Quyền của ${person.full_name}`}
                    className={FORM_CONTROL_CLASS}
                    value={shares[person.user_id] ?? ''}
                    onChange={(event) =>
                      setShares((current) => ({
                        ...current,
                        [person.user_id]: event.target.value as 'view' | 'edit' | '',
                      }))
                    }
                  >
                    <option value="">Không chia sẻ</option>
                    <option value="view">Xem</option>
                    <option value="edit">Cập nhật</option>
                  </select>
                  {person.full_name}
                </label>
              ))}
            </div>
          ) : null}
          {mode === 'note' || mode === 'transfer' || mode === 'return' ? (
            <label className="text-label font-medium text-text">
              {mode === 'return' ? 'Lý do trả về' : mode === 'transfer' ? 'Ghi chú chuyển giao' : 'Nội dung'}
              <textarea className={selectClass} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
          ) : null}
          <span className="flex gap-2">
            <Button variant="primary" disabled={action.isPending} onClick={() => action.mutate(mode)}>
              Ghi
            </Button>
            <Button variant="text" onClick={() => setMode(undefined)}>
              Hủy
            </Button>
          </span>
        </div>
      ) : null}
      <h3 className="text-content font-semibold">Lịch sử hồ sơ</h3>
      <ul className="flex flex-col gap-1 text-content">
        {file.events.map((event) => (
          <li key={event.id}>
            {formatDateTime(event.created_at)} – <span className="font-medium">{event.actor_name}</span>:{' '}
            {EVENT_LABELS[event.action] ?? event.action}
            {event.note ? `. ${event.note}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

function columnsOf(box: WorkFileBox): Array<DataGridColumn<WorkFile>> {
  return [
    { id: 'code', header: 'Số ký hiệu hồ sơ', cell: (row) => row.code },
    { id: 'title', header: 'Tiêu đề hồ sơ', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
    { id: 'year', header: 'Năm', cell: (row) => row.year },
    { id: 'owner_name', header: 'Người lập hồ sơ', cell: (row) => row.owner_name },
    ...(box === 'transferred'
      ? [{ id: 'from', header: 'Chuyển giao từ', cell: (row: WorkFile) => row.transferred_from_name ?? '' }]
      : []),
    ...(box === 'shared'
      ? [
          {
            id: 'permission',
            header: 'Quyền',
            cell: (row: WorkFile) => (row.share_permission === 'edit' ? 'Cập nhật' : 'Xem'),
          },
        ]
      : []),
    { id: 'item_count', header: 'Số thành phần', cell: (row) => row.item_count ?? 0 },
    {
      id: 'retention',
      header: 'Thời hạn bảo quản',
      cell: (row) => (row.retention === 'permanent' ? 'Vĩnh viễn' : `${row.retention_years ?? ''} năm`),
    },
    ...(box === 'archive' || box === 'expired'
      ? [
          {
            id: 'archive_record_code',
            header: 'Hồ sơ lưu trữ',
            cell: (row: WorkFile) => row.archive_record_code ?? '',
          },
          { id: 'expiry_year', header: 'Năm hết hạn', cell: (row: WorkFile) => row.expiry_year ?? '' },
        ]
      : []),
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <StatusBadge
          tone={row.status === 'returned' ? 'warning' : 'info'}
          label={WORK_FILE_STATUS_LABELS[row.status]}
        />
      ),
    },
  ];
}

function WorkFileList({ box, path, label }: { box: WorkFileBox; path: PortalQuickLinkPath; label: string }) {
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const grid = useGridSettings('work-files');
  const [year, setYear] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string>();
  const [deleting, setDeleting] = useState<WorkFile>();
  const files = useQuery({
    queryKey: ['work-files', box, year, search],
    queryFn: () => listWorkFiles(box, { year, q: search }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['work-files'] });
  const remove = useMutation({
    mutationFn: (file: WorkFile) => deleteWorkFile(file.id),
    onSuccess: async (_result, file) => {
      setDeleting(undefined);
      await refresh();
      setToast(`Đã xóa ${file.code}`);
    },
    onError: () => setDeleting(undefined),
  });
  return (
    <Page path={path} toast={toast} onToastClose={close}>
      <label className="max-w-xs text-label font-medium text-text">
        Năm
        <input
          className={selectClass}
          inputMode="numeric"
          value={year}
          onChange={(event) => setYear(event.target.value)}
        />
      </label>
      {files.error ? <Alert tone="danger">{messageOf(files.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {creating ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <WorkFileForm
            onCancel={() => setCreating(false)}
            onSaved={async (file) => {
              setCreating(false);
              await refresh();
              setToast(`Đã lập hồ sơ ${file.code}`);
            }}
          />
        </section>
      ) : null}
      <DataGrid
        label={label}
        columns={columnsOf(box)}
        rows={files.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.code}
        loading={!files.data && !files.error}
        emptyText="Không có hồ sơ."
        search={{ label: 'Tìm theo ký hiệu, tiêu đề', value: search, onChange: setSearch }}
        toolbar={
          box === 'personal' ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        rowActions={(row) =>
          box === 'personal' && (row.status === 'open' || row.status === 'returned') ? (
            <Button variant="text" onClick={() => setDeleting(row)}>
              Xóa
            </Button>
          ) : null
        }
        onRowClick={(row) => setActiveId(activeId === row.id ? undefined : row.id)}
        activeRowId={activeId}
        renderRowDetail={(row) =>
          activeId === row.id ? (
            <WorkFileDetailPanel
              id={row.id}
              onChanged={(message) => {
                setToast(message);
                if (message === 'Đã chuyển giao hồ sơ') setActiveId(undefined);
              }}
            />
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        subject={deleting?.code ?? ''}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(undefined)}
      />
    </Page>
  );
}

export const PersonalWorkFilesPage = () => <WorkFileList box="personal" path="/work-files" label="Hồ sơ cá nhân" />;
export const SharedWorkFilesPage = () => (
  <WorkFileList box="shared" path="/work-files/shared" label="Hồ sơ được chia sẻ" />
);
export const TransferredWorkFilesPage = () => (
  <WorkFileList box="transferred" path="/work-files/transferred" label="Hồ sơ được chuyển giao" />
);
export const ArchiveWorkFilesPage = () => (
  <WorkFileList box="archive" path="/work-files/archive" label="Hồ sơ nộp lưu" />
);
export const ExpiredWorkFilesPage = () => (
  <WorkFileList box="expired" path="/work-files/expired" label="Hồ sơ hết hạn bảo quản" />
);

// Lưu văn bản đến hoặc công việc vào một hồ sơ công việc đang cập nhật của mình (hoặc được chia sẻ quyền cập nhật)
export function SaveToWorkFile({ itemType, itemId }: { itemType: 'incoming_document' | 'task'; itemId: string }) {
  const [open, setOpen] = useState(false);
  const [fileId, setFileId] = useState('');
  const files = useQuery({
    queryKey: ['work-files', 'writable'],
    queryFn: async () => {
      const [personal, transferred, shared] = await Promise.all([
        listWorkFiles('personal', {}),
        listWorkFiles('transferred', {}),
        listWorkFiles('shared', {}),
      ]);
      return [...personal, ...transferred, ...shared.filter((file) => file.share_permission === 'edit')].filter(
        (file) => file.status === 'open' || file.status === 'returned',
      );
    },
    enabled: open,
  });
  const save = useMutation({
    mutationFn: () =>
      addWorkFileItem(fileId, {
        item_type: itemType,
        ...(itemType === 'task' ? { task_id: itemId } : { incoming_document_id: itemId }),
      }),
    onSuccess: () => setOpen(false),
  });
  if (!open) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Lưu vào hồ sơ công việc
        </Button>
        {save.isSuccess ? <span className="text-label text-success">Đã lưu vào hồ sơ</span> : null}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-label font-medium text-text">
        Hồ sơ công việc
        <select className={selectClass} value={fileId} onChange={(event) => setFileId(event.target.value)}>
          <option value="">— Chọn hồ sơ —</option>
          {(files.data ?? []).map((file) => (
            <option key={file.id} value={file.id}>
              {file.code} – {file.title}
            </option>
          ))}
        </select>
      </label>
      <Button variant="primary" disabled={!fileId || save.isPending} onClick={() => save.mutate()}>
        Lưu
      </Button>
      <Button variant="text" onClick={() => setOpen(false)}>
        Hủy
      </Button>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
    </div>
  );
}
