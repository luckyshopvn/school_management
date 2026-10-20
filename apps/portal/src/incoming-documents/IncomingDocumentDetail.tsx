import { DocumentTaskLinks } from '../directives/DirectivePages.js';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  INCOMING_ASSIGNMENT_STATUS_LABELS,
  INCOMING_AUTHORITY_LABELS,
  INCOMING_COPY_LABELS,
  INCOMING_DOCUMENT_STATUS_LABELS,
  INCOMING_KIND_LABELS,
  INCOMING_ROLE_LABELS,
  INCOMING_TRANSFER_LABELS,
  type IncomingAssignmentRole,
} from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  ConfirmDialog,
  FORM_CONTROL_CLASS,
  StatusBadge,
} from '@school-management/ui';
import { formatDate, messageOf } from '../archives/archive-ui.js';
import { searchArchiveRecords } from '../archives/archives-api.js';
import { IncomingDocumentForm } from './IncomingDocumentForm.js';
import {
  acknowledgeIncoming,
  archiveMany,
  completeIncoming,
  decideExtension,
  deleteIncoming,
  deleteIncomingFile,
  downloadIncomingFile,
  downloadSlip,
  finishIncoming,
  listBooks,
  listDocumentStaff,
  listIncoming,
  listLeaders,
  markUnread,
  readIncoming,
  refuseIncoming,
  registerIncoming,
  replyIncoming,
  requestExtension,
  restrictIncoming,
  returnIncoming,
  revokeIncoming,
  setFlags,
  setRelations,
  transferIncoming,
  uploadIncomingFile,
  type IncomingAssignment,
  type IncomingDocument,
  type SlipType,
} from './incoming-api.js';

// Chi tiết văn bản đến theo VNPT iOffice (DT-18 phần 18a, YCTD-138): ba thẻ Thông tin văn bản, Thông tin nhận, Sơ đồ luồng
// văn bản như biểu mẫu của iOffice, thêm Lịch sử tham mưu. Nút hiện theo danh sách thao tác máy chủ trả về cho người đang
// xem; máy chủ vẫn kiểm tra lại ở từng thao tác
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
const TABS = ['Thông tin văn bản', 'Thông tin nhận', 'Sơ đồ luồng văn bản', 'Lịch sử tham mưu'] as const;
const EVENT_LABELS: Record<string, string> = {
  register: 'Vào sổ',
  interconnect_receive: 'Nhận văn bản liên thông',
  update: 'Cập nhật thông tin',
  acknowledge: 'Đánh dấu tiếp nhận',
  unacknowledge: 'Hủy đánh dấu tiếp nhận',
  file_add: 'Đính kèm tệp',
  file_delete: 'Xóa tệp',
  relations: 'Văn bản liên quan',
  submit_leader: 'Trình lãnh đạo',
  forward_leader: 'Chuyển lãnh đạo',
  forward: 'Chuyển xử lý',
  direct: 'Chuyển trực tiếp',
  rotate: 'Luân chuyển',
  return: 'Trả lại',
  refuse: 'Từ chối',
  revoke: 'Lấy lại',
  finish: 'Xử lý xong',
  request_extension: 'Xin gia hạn',
  approve_extension: 'Đồng ý gia hạn',
  reject_extension: 'Không đồng ý gia hạn',
  complete: 'Kết thúc văn bản',
  restrict: 'Hạn chế xem',
  unrestrict: 'Bỏ hạn chế xem',
  reply: 'Văn bản trả lời',
  archive: 'Lưu hồ sơ',
  // Giao việc, hồ sơ công việc (DT-18 phần 18c)
  create_task: 'Tạo công việc',
  work_file: 'Lưu vào hồ sơ công việc',
};
const SLIPS: Array<{ type: SlipType; label: string }> = [
  { type: 'submission', label: 'In phiếu trình' },
  { type: 'processing', label: 'In phiếu xử lý' },
  { type: 'handover', label: 'Phiếu giao nhận' },
];

const time = (value: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';

function sizeText(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function DeadlineBadges({ overdue, dueSoon }: { overdue: boolean; dueSoon: boolean }) {
  return (
    <>
      {overdue ? <StatusBadge tone="danger" label="Quá hạn" /> : null}
      {dueSoon ? <StatusBadge tone="warning" label="Đến hạn" /> : null}
    </>
  );
}

// Một hộp thoại nhập ghi chú: trả lại, từ chối, xử lý xong, kết thúc
function NoteDialog({
  title,
  label,
  confirmLabel,
  required,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  label: string;
  confirmLabel: string;
  required?: boolean;
  busy: boolean;
  onConfirm(note: string): void;
  onCancel(): void;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  return (
    <ConfirmDialog
      open
      title={title}
      confirmLabel={confirmLabel}
      busy={busy}
      onCancel={onCancel}
      onConfirm={() => {
        if (required && !note.trim()) {
          setError(`Nhập ${label.toLocaleLowerCase('vi')}`);
          return;
        }
        onConfirm(note.trim());
      }}
    >
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        {label}
        <textarea
          className={FORM_CONTROL_CLASS}
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {error ? <p className="text-label text-danger">{error}</p> : null}
    </ConfirmDialog>
  );
}

type TransferMode = 'leader' | 'process' | 'rotate';

// Trình lãnh đạo, chuyển xử lý (xử lý chính, phối hợp, xem để biết), luân chuyển
function TransferDialog({
  document,
  mode,
  busy,
  onConfirm,
  onCancel,
}: {
  document: IncomingDocument;
  mode: TransferMode;
  busy: boolean;
  onConfirm(input: {
    recipients: Array<{ user_id: string; role?: IncomingAssignmentRole; deadline?: string | null }>;
    note: string | null;
    deadline: string | null;
  }): void;
  onCancel(): void;
}) {
  const leaders = useQuery({ queryKey: ['document-leaders'], queryFn: listLeaders, enabled: mode === 'leader' });
  const staff = useQuery({ queryKey: ['document-staff'], queryFn: listDocumentStaff, enabled: mode !== 'leader' });
  const [roles, setRoles] = useState<Record<string, IncomingAssignmentRole | ''>>({});
  const [deadlines, setDeadlines] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [deadline, setDeadline] = useState(document.deadline ?? '');
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string>();
  const people =
    mode === 'leader'
      ? (leaders.data ?? []).map((leader) => ({
          id: leader.user_id,
          name: leader.user_name,
          detail: leader.title ?? '',
        }))
      : (staff.data ?? []).map((person) => ({
          id: person.user_id,
          name: person.full_name,
          detail: [person.job_title_name, person.department_name ?? person.org_unit_name].filter(Boolean).join(', '),
        }));
  const shown = people.filter((person) =>
    `${person.name} ${person.detail}`.toLocaleLowerCase('vi').includes(filter.trim().toLocaleLowerCase('vi')),
  );
  const title =
    mode === 'leader'
      ? document.my_pending_assignment_id
        ? 'Chuyển lãnh đạo'
        : 'Trình lãnh đạo'
      : mode === 'rotate'
        ? 'Luân chuyển'
        : document.my_pending_assignment_id
          ? 'Chuyển xử lý'
          : 'Chuyển trực tiếp';
  const roleChoices: Array<[IncomingAssignmentRole, string]> =
    mode === 'leader'
      ? [['leader', 'Trình']]
      : mode === 'rotate'
        ? [['main', 'Chọn']]
        : [
            ['main', 'XLC'],
            ['coordinate', 'PH'],
            ['view', 'Xem'],
          ];
  return (
    <ConfirmDialog
      open
      title={title}
      confirmLabel={title}
      busy={busy}
      onCancel={onCancel}
      onConfirm={() => {
        const recipients = Object.entries(roles)
          .filter(([, role]) => role)
          .map(([userId, role]) => ({
            user_id: userId,
            role: role as IncomingAssignmentRole,
            deadline: deadlines[userId] || null,
          }));
        if (recipients.length === 0) {
          setError('Chọn người nhận');
          return;
        }
        if (mode === 'rotate' && recipients.length !== 1) {
          setError('Luân chuyển cho đúng một người');
          return;
        }
        if (recipients.filter((recipient) => recipient.role === 'main').length > 1 && mode === 'process') {
          setError('Mỗi lần chuyển chỉ có một người xử lý chính');
          return;
        }
        onConfirm({ recipients, note: note.trim() || null, deadline: deadline || null });
      }}
    >
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
        {mode === 'leader' && (leaders.data ?? []).length === 0 && leaders.data ? (
          <Alert tone="warning">Chưa khai báo lãnh đạo nhận văn bản (Quản trị văn bản, mục 2.5).</Alert>
        ) : null}
        <input
          aria-label="Tìm người nhận"
          placeholder="Tìm theo tên, chức vụ, bộ phận"
          className={FORM_CONTROL_CLASS}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <table className="w-full text-content">
          <thead>
            <tr className="text-left text-label text-text-secondary">
              <th className="py-1">Người nhận</th>
              {roleChoices.map(([role, label]) => (
                <th key={role} className="px-2 py-1 text-center">
                  {label}
                </th>
              ))}
              {mode === 'process' ? <th className="py-1">Hạn xử lý</th> : null}
            </tr>
          </thead>
          <tbody>
            {shown.map((person) => (
              <tr key={person.id} className="border-t border-border">
                <td className="py-1">
                  <span className="font-medium">{person.name}</span>
                  {person.detail ? <span className="block text-label text-text-muted">{person.detail}</span> : null}
                </td>
                {roleChoices.map(([role, label]) => (
                  <td key={role} className="px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label={`${label} ${person.name}`}
                      checked={roles[person.id] === role}
                      onChange={(event) =>
                        setRoles((current) => {
                          const next: Record<string, IncomingAssignmentRole | ''> = {
                            ...current,
                            [person.id]: event.target.checked ? role : '',
                          };
                          // Luân chuyển, xử lý chính: chỉ một người
                          if (event.target.checked && (mode === 'rotate' || role === 'main')) {
                            for (const key of Object.keys(next)) {
                              if (key !== person.id && next[key] === role) {
                                next[key] = '';
                              }
                            }
                          }
                          return next;
                        })
                      }
                    />
                  </td>
                ))}
                {mode === 'process' ? (
                  <td className="py-1">
                    <input
                      type="date"
                      aria-label={`Hạn xử lý của ${person.name}`}
                      className={FORM_CONTROL_CLASS}
                      value={deadlines[person.id] ?? ''}
                      onChange={(event) => setDeadlines((current) => ({ ...current, [person.id]: event.target.value }))}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {mode !== 'rotate' ? (
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Hạn xử lý chung
            <input
              type="date"
              className={FORM_CONTROL_CLASS}
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          {mode === 'leader' ? 'Ý kiến đề xuất' : 'Ý kiến chỉ đạo, ghi chú'}
          <textarea
            className={FORM_CONTROL_CLASS}
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {error ? <p className="text-label text-danger">{error}</p> : null}
      </div>
    </ConfirmDialog>
  );
}

// Sơ đồ luồng văn bản: cây các lần chuyển, mỗi nút một người nhận kèm vai trò, trạng thái
function FlowTree({
  assignments,
  parentId,
  depth,
}: {
  assignments: IncomingAssignment[];
  parentId: string | null;
  depth: number;
}) {
  const children = assignments.filter((row) => row.parent_id === parentId);
  if (children.length === 0) {
    return null;
  }
  return (
    <ul className={depth === 0 ? 'flex flex-col gap-1' : 'ml-6 flex flex-col gap-1 border-l border-border pl-3'}>
      {children.map((row) => (
        <li key={row.id}>
          <div className="flex flex-wrap items-center gap-2 text-content">
            <span className="font-medium">{row.user_name}</span>
            <StatusBadge tone="info" label={INCOMING_ROLE_LABELS[row.role]} />
            <StatusBadge
              tone={
                row.status === 'pending'
                  ? 'warning'
                  : ['returned', 'revoked', 'refused'].includes(row.status)
                    ? 'neutral'
                    : 'success'
              }
              label={INCOMING_ASSIGNMENT_STATUS_LABELS[row.status]}
            />
            <span className="text-label text-text-muted">
              {row.assigned_by_name} chuyển lúc {time(row.created_at)}
            </span>
          </div>
          <FlowTree assignments={assignments} parentId={row.id} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border py-2 md:grid-cols-[14rem_1fr]">
      <dt className="text-label font-medium text-text-secondary">{label}</dt>
      <dd className="text-content text-text">{children}</dd>
    </div>
  );
}

type Dialog =
  | { kind: 'transfer'; mode: TransferMode }
  | { kind: 'note'; action: 'return' | 'refuse' | 'finish' | 'complete' }
  | { kind: 'extension' }
  | { kind: 'reply' }
  | { kind: 'archive' }
  | { kind: 'register' }
  | { kind: 'delete' }
  | { kind: 'decide'; assignment: IncomingAssignment; approve: boolean };

export function IncomingDocumentDetail({
  documentId,
  onChanged,
  onDeleted,
}: {
  documentId: string;
  onChanged(): void;
  onDeleted?(): void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<Dialog>();
  const [message, setMessage] = useState<string>();
  const detail = useQuery({ queryKey: ['incoming-document', documentId], queryFn: () => readIncoming(documentId) });
  const fileInputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [relatedSearch, setRelatedSearch] = useState('');
  const related = useQuery({
    queryKey: ['incoming-related-search', relatedSearch],
    queryFn: () => listIncoming({ view: 'search', q: relatedSearch, page: 1, pageSize: 10 }),
    enabled: editing && relatedSearch.trim().length >= 2,
  });
  const applied = (saved: IncomingDocument | void, text?: string) => {
    if (saved) {
      queryClient.setQueryData(['incoming-document', documentId], saved);
    }
    setDialog(undefined);
    setMessage(text);
    onChanged();
  };
  const run = useMutation({
    mutationFn: (operation: () => Promise<IncomingDocument | void>) => operation(),
    onSuccess: (saved) => applied(saved),
  });
  // Không đọc lại chi tiết sau khi đánh dấu chưa đọc: mở chi tiết là đã đọc
  const unread = useMutation({
    mutationFn: () => markUnread(documentId),
    onSuccess: () => {
      setMessage('Đã đánh dấu chưa đọc');
      onChanged();
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteIncoming(documentId),
    onSuccess: () => {
      setDialog(undefined);
      onChanged();
      onDeleted?.();
    },
  });
  const document = detail.data;
  if (!document) {
    return detail.error ? <Alert tone="danger">{messageOf(detail.error)}</Alert> : <p>Đang tải…</p>;
  }
  const can = (action: IncomingDocument['actions'][number]) => document.actions.includes(action);
  const act = (operation: () => Promise<IncomingDocument | void>) => run.mutate(operation);
  const error = run.error ?? remove.error ?? unread.error;
  const mine = document.assignments.find((row) => row.id === document.my_pending_assignment_id);
  const pendingExtensions = document.assignments.filter((row) => row.extension_status === 'requested');

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <IncomingDocumentForm
          mode="edit"
          document={document}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            applied(saved, 'Đã cập nhật thông tin văn bản');
          }}
        />
        <section className="flex flex-col gap-2" aria-label="Văn bản liên quan">
          <h3 className="font-semibold">Văn bản liên quan</h3>
          <ul className="flex flex-col gap-1">
            {document.related.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-content">
                {item.symbol} – {item.summary}
                <Button
                  variant="text"
                  onClick={() =>
                    act(() =>
                      setRelations(
                        documentId,
                        document.related.filter((other) => other.id !== item.id).map((other) => other.id),
                      ),
                    )
                  }
                >
                  Bỏ
                </Button>
              </li>
            ))}
          </ul>
          <input
            aria-label="Tìm văn bản liên quan theo trích yếu"
            placeholder="Tìm văn bản liên quan theo trích yếu"
            className={FORM_CONTROL_CLASS}
            value={relatedSearch}
            onChange={(event) => setRelatedSearch(event.target.value)}
          />
          {(related.data?.items ?? [])
            .filter((item) => item.id !== documentId && !document.related.some((other) => other.id === item.id))
            .map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-content">
                {item.symbol} – {item.summary}
                <Button
                  variant="text"
                  onClick={() =>
                    act(() => setRelations(documentId, [...document.related.map((other) => other.id), item.id]))
                  }
                >
                  Thêm
                </Button>
              </div>
            ))}
        </section>
      </div>
    );
  }

  const button = (label: string, onClick: () => void, variant: 'primary' | 'secondary' | 'text' = 'secondary') => (
    <Button key={label} variant={variant} disabled={run.isPending} onClick={onClick}>
      {label}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4" aria-label={`Văn bản ${document.symbol}`}>
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Thao tác văn bản">
        {can('register') ? button('Vào sổ', () => setDialog({ kind: 'register' }), 'primary') : null}
        {can('acknowledge')
          ? document.interconnect_status === 'acknowledged'
            ? button('Hủy đánh dấu tiếp nhận', () => act(() => acknowledgeIncoming(documentId, false, null)))
            : button('Đánh dấu tiếp nhận văn bản', () => act(() => acknowledgeIncoming(documentId, true, null)))
          : null}
        {can('submit_leader')
          ? button(
              mine ? 'Chuyển lãnh đạo' : 'Trình lãnh đạo',
              () => setDialog({ kind: 'transfer', mode: 'leader' }),
              'primary',
            )
          : null}
        {can('transfer')
          ? button(mine ? 'Chuyển xử lý' : 'Chuyển trực tiếp', () => setDialog({ kind: 'transfer', mode: 'process' }))
          : null}
        {can('rotate') ? button('Luân chuyển', () => setDialog({ kind: 'transfer', mode: 'rotate' })) : null}
        {can('finish') ? button('Xử lý xong', () => setDialog({ kind: 'note', action: 'finish' })) : null}
        {can('return') ? button('Trả lại', () => setDialog({ kind: 'note', action: 'return' })) : null}
        {can('refuse') ? button('Từ chối', () => setDialog({ kind: 'note', action: 'refuse' })) : null}
        {can('revoke') ? button('Lấy lại', () => act(() => revokeIncoming(documentId))) : null}
        {can('request_extension') ? button('Xin gia hạn', () => setDialog({ kind: 'extension' })) : null}
        {can('update') ? button('Cập nhật thông tin', () => setEditing(true)) : null}
        {can('reply') ? button('Văn bản trả lời', () => setDialog({ kind: 'reply' })) : null}
        {can('archive') ? button('Lưu hồ sơ', () => setDialog({ kind: 'archive' })) : null}
        {can('restrict')
          ? button(document.restricted ? 'Bỏ hạn chế xem' : 'Hạn chế xem', () =>
              act(() => restrictIncoming(documentId, !document.restricted)),
            )
          : null}
        {can('complete') ? button('Kết thúc văn bản', () => setDialog({ kind: 'note', action: 'complete' })) : null}
        {button(document.starred ? 'Bỏ đánh dấu' : 'Đánh dấu', () =>
          act(async () => {
            await setFlags([documentId], { starred: !document.starred });
            return readIncoming(documentId);
          }),
        )}
        {button(document.followed ? 'Bỏ theo dõi' : 'Theo dõi', () =>
          act(async () => {
            await setFlags([documentId], { followed: !document.followed });
            return readIncoming(documentId);
          }),
        )}
        {mine ? button('Đánh dấu chưa đọc', () => unread.mutate()) : null}
        {SLIPS.map((slip) => button(slip.label, () => act(() => downloadSlip(documentId, slip.type)), 'text'))}
        {can('delete') ? button('Xóa', () => setDialog({ kind: 'delete' }), 'text') : null}
      </div>
      <DocumentTaskLinks
        documentId={documentId}
        label={`${document.symbol} – ${document.summary}`.slice(0, 300)}
        registered={document.status !== 'pending_registration'}
      />
      <div role="tablist" aria-label="Thông tin văn bản đến" className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={`-mb-px rounded-t-lg border border-b-0 px-3 py-2 text-content ${
              tab === name ? 'border-border bg-card font-semibold text-text' : 'border-transparent text-text-secondary'
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      {tab === 'Thông tin văn bản' ? (
        <dl>
          <InfoRow label="Trích yếu">{document.summary}</InfoRow>
          <InfoRow label="Số ký hiệu">{document.symbol}</InfoRow>
          <InfoRow label="Đơn vị ban hành">{document.issuer_name}</InfoRow>
          <InfoRow label="Ngày văn bản">{formatDate(document.document_date)}</InfoRow>
          <InfoRow label="Sổ văn bản, số đến, ngày đến">
            {document.book_name
              ? `${document.book_name} – số ${document.arrival_number} – ${formatDate(document.arrival_date)}`
              : 'Chưa vào sổ'}
          </InfoRow>
          <InfoRow label="Hình thức">{document.form_name ?? ''}</InfoRow>
          <InfoRow label="Độ khẩn">{document.urgency_name ?? ''}</InfoRow>
          <InfoRow label="Độ mật">{document.secrecy_name ?? ''}</InfoRow>
          <InfoRow label="Lĩnh vực">{document.field_name ?? ''}</InfoRow>
          <InfoRow label="Hạn xử lý">
            <span className="flex flex-wrap items-center gap-2">
              {formatDate(document.deadline)}
              <DeadlineBadges overdue={document.overdue} dueSoon={document.due_soon} />
            </span>
          </InfoRow>
          <InfoRow label="Thẩm quyền">{INCOMING_AUTHORITY_LABELS[document.authority]}</InfoRow>
          <InfoRow label="Loại văn bản">{INCOMING_KIND_LABELS[document.document_kind]}</InfoRow>
          <InfoRow label="Hình thức chuyển">{INCOMING_TRANSFER_LABELS[document.transfer_method]}</InfoRow>
          <InfoRow label="Hình thức sao">{INCOMING_COPY_LABELS[document.copy_type]}</InfoRow>
          <InfoRow label="Có văn bản giấy">{document.has_paper ? 'Có' : 'Không'}</InfoRow>
          <InfoRow label="Nội dung xử lý">{document.processing_note ?? ''}</InfoRow>
          <InfoRow label="Trạng thái">
            {INCOMING_DOCUMENT_STATUS_LABELS[document.status]}
            {document.restricted ? ` – hạn chế xem (${document.restricted_by_name ?? ''})` : ''}
          </InfoRow>
          {document.source === 'interconnect' ? (
            <InfoRow label="Liên thông">
              {document.interconnect_status === 'acknowledged'
                ? `Đã đánh dấu tiếp nhận ${time(document.acknowledged_at)} (${document.acknowledged_by_name ?? ''})`
                : 'Chưa đánh dấu tiếp nhận'}
              <span className="block text-label text-text-muted">{document.exchange.description}</span>
            </InfoRow>
          ) : null}
          {document.reply_symbol ? (
            <InfoRow label="Văn bản trả lời">
              {document.reply_symbol} ngày {formatDate(document.reply_date)}{' '}
              {document.reply_note ? `– ${document.reply_note}` : ''}
            </InfoRow>
          ) : null}
          {document.archive_record_code ? (
            <InfoRow label="Lưu hồ sơ">
              {document.archive_record_code} – {document.archive_record_title}
            </InfoRow>
          ) : null}
          {document.completed_at ? (
            <InfoRow label="Kết thúc">
              {time(document.completed_at)} – {document.completed_by_name}{' '}
              {document.completion_note ? `: ${document.completion_note}` : ''}
            </InfoRow>
          ) : null}
          <InfoRow label="Văn bản liên quan">
            {document.related.length === 0
              ? 'Không có'
              : document.related.map((item) => (
                  <span key={item.id} className="block">
                    {item.symbol} – {item.summary}
                  </span>
                ))}
          </InfoRow>
          <InfoRow label="File đính kèm">
            <ul aria-label="Danh sách tệp đính kèm" className="flex flex-col gap-1">
              {document.files.map((file) => (
                <li key={file.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{file.file_name}</span>
                  <span className="text-label text-text-muted">
                    {sizeText(file.size_bytes)}
                    {file.scanned ? ', tệp quét' : ''}
                    {file.kind === 'related' ? ', văn bản liên quan' : ''}
                  </span>
                  <Button variant="text" onClick={() => act(() => downloadIncomingFile(documentId, file))}>
                    Tải về
                  </Button>
                  {can('upload') ? (
                    <Button variant="text" onClick={() => act(() => deleteIncomingFile(documentId, file.id))}>
                      Xóa tệp
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {can('upload') ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label htmlFor={fileInputId} className="text-label">
                  Thêm tệp (tối đa 50 MB)
                </label>
                <input
                  id={fileInputId}
                  ref={fileInput}
                  type="file"
                  accept={FILE_ACCEPT}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      act(async () => {
                        const saved = await uploadIncomingFile(documentId, file, {
                          kind: document.status === 'pending_registration' || !mine ? 'main' : 'related',
                          scanned: false,
                        });
                        if (fileInput.current) {
                          fileInput.current.value = '';
                        }
                        return saved;
                      });
                    }
                  }}
                />
              </div>
            ) : null}
          </InfoRow>
        </dl>
      ) : null}
      {tab === 'Thông tin nhận' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-content" aria-label="Thông tin nhận">
            <thead>
              <tr className="text-left text-label text-text-secondary">
                <th className="p-2">Người chuyển</th>
                <th className="p-2">Người nhận</th>
                <th className="p-2">Vai trò</th>
                <th className="p-2">Hạn xử lý</th>
                <th className="p-2">Ý kiến khi chuyển</th>
                <th className="p-2">Ý kiến xử lý</th>
                <th className="p-2">Trạng thái</th>
                <th className="p-2">Gia hạn</th>
              </tr>
            </thead>
            <tbody>
              {document.assignments.map((row) => (
                <tr key={row.id} className="border-t border-border align-top">
                  <td className="p-2">
                    {row.assigned_by_name}
                    <span className="block text-label text-text-muted">{time(row.created_at)}</span>
                  </td>
                  <td className="p-2">
                    {row.user_name}
                    {row.user_title ? <span className="block text-label text-text-muted">{row.user_title}</span> : null}
                  </td>
                  <td className="p-2">{INCOMING_ROLE_LABELS[row.role]}</td>
                  <td className="p-2">
                    {formatDate(row.deadline)} <DeadlineBadges overdue={row.overdue} dueSoon={row.due_soon} />
                  </td>
                  <td className="p-2">{row.note ?? ''}</td>
                  <td className="p-2">{row.result_note ?? ''}</td>
                  <td className="p-2">
                    {INCOMING_ASSIGNMENT_STATUS_LABELS[row.status]}
                    {row.read_at ? '' : row.status === 'pending' ? ' (chưa đọc)' : ''}
                  </td>
                  <td className="p-2">
                    {row.extension_status ? (
                      <span>
                        Đến {formatDate(row.extension_until)}:{' '}
                        {row.extension_status === 'requested'
                          ? 'chờ duyệt'
                          : row.extension_status === 'approved'
                            ? `đồng ý (${row.extension_decided_by_name ?? ''})`
                            : `không đồng ý (${row.extension_decided_by_name ?? ''})`}
                        <span className="block text-label text-text-muted">{row.extension_reason}</span>
                      </span>
                    ) : null}
                    {can('decide_extension') && pendingExtensions.includes(row) ? (
                      <span className="flex gap-1">
                        <Button
                          variant="text"
                          onClick={() => setDialog({ kind: 'decide', assignment: row, approve: true })}
                        >
                          Đồng ý gia hạn
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => setDialog({ kind: 'decide', assignment: row, approve: false })}
                        >
                          Không đồng ý
                        </Button>
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {document.assignments.length === 0 ? <p className="text-text-secondary">Văn bản chưa chuyển xử lý.</p> : null}
        </div>
      ) : null}
      {tab === 'Sơ đồ luồng văn bản' ? (
        <section aria-label="Sơ đồ luồng văn bản" className="flex flex-col gap-2">
          <p className="text-content">
            <span className="font-medium">{document.registered_by_name ?? document.created_by_name}</span> (Văn thư)
          </p>
          <FlowTree assignments={document.assignments} parentId={null} depth={0} />
        </section>
      ) : null}
      {tab === 'Lịch sử tham mưu' ? (
        <ol aria-label="Lịch sử tham mưu" className="flex flex-col gap-1">
          {document.events.map((event) => (
            <li key={event.id} className="text-content">
              <span className="text-text-muted">{time(event.created_at)}</span> –{' '}
              <span className="font-medium">{event.actor_name}</span>: {EVENT_LABELS[event.action] ?? event.action}
              {event.note ? ` – ${event.note}` : ''}
            </li>
          ))}
        </ol>
      ) : null}

      {dialog?.kind === 'transfer' ? (
        <TransferDialog
          document={document}
          mode={dialog.mode}
          busy={run.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={(input) => act(() => transferIncoming(documentId, { mode: dialog.mode, ...input }))}
        />
      ) : null}
      {dialog?.kind === 'note' ? (
        <NoteDialog
          title={
            {
              return: 'Trả lại văn bản',
              refuse: 'Từ chối phối hợp',
              finish: 'Xử lý xong',
              complete: 'Kết thúc văn bản',
            }[dialog.action]
          }
          label={dialog.action === 'return' || dialog.action === 'refuse' ? 'Lý do' : 'Ý kiến xử lý'}
          confirmLabel={
            { return: 'Trả lại', refuse: 'Từ chối', finish: 'Xử lý xong', complete: 'Kết thúc' }[dialog.action]
          }
          required={dialog.action === 'return' || dialog.action === 'refuse'}
          busy={run.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={(note) =>
            act(() =>
              dialog.action === 'return'
                ? returnIncoming(documentId, note)
                : dialog.action === 'refuse'
                  ? refuseIncoming(documentId, note)
                  : dialog.action === 'finish'
                    ? finishIncoming(documentId, note || null)
                    : completeIncoming(documentId, note || null),
            )
          }
        />
      ) : null}
      {dialog?.kind === 'decide' ? (
        <NoteDialog
          title={dialog.approve ? 'Đồng ý gia hạn' : 'Không đồng ý gia hạn'}
          label="Ý kiến"
          confirmLabel={dialog.approve ? 'Đồng ý' : 'Không đồng ý'}
          busy={run.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={(note) =>
            act(() => decideExtension(documentId, dialog.assignment.id, dialog.approve, note || null))
          }
        />
      ) : null}
      {dialog?.kind === 'extension' ? (
        <ExtensionDialog
          busy={run.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={(until, reason) => act(() => requestExtension(documentId, until, reason))}
        />
      ) : null}
      {dialog?.kind === 'reply' ? (
        <ReplyDialog
          document={document}
          busy={run.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={(input) => act(() => replyIncoming(documentId, input))}
        />
      ) : null}
      {dialog?.kind === 'archive' ? (
        <ArchiveDialog
          busy={run.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={(recordId) =>
            act(async () => {
              const [result] = await archiveMany([documentId], recordId);
              if (result && !result.ok) {
                throw new Error(result.message ?? 'Không lưu hồ sơ được');
              }
              return readIncoming(documentId);
            })
          }
        />
      ) : null}
      {dialog?.kind === 'register' ? (
        <RegisterDialog
          busy={run.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={(input) => act(() => registerIncoming(documentId, input))}
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <ConfirmDeleteDialog
          open
          subject={`văn bản ${document.symbol}`}
          busy={remove.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={() => remove.mutate()}
        >
          Các tệp đính kèm của văn bản cũng bị xóa.
        </ConfirmDeleteDialog>
      ) : null}
    </div>
  );
}

function ExtensionDialog({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm(until: string, reason: string): void;
  onCancel(): void;
}) {
  const [until, setUntil] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  return (
    <ConfirmDialog
      open
      title="Xin gia hạn"
      confirmLabel="Gửi đề nghị"
      busy={busy}
      onCancel={onCancel}
      onConfirm={() => {
        if (!until || !reason.trim()) {
          setError('Nhập hạn đề nghị và lý do');
          return;
        }
        onConfirm(until, reason.trim());
      }}
    >
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Gia hạn đến ngày
        <input
          type="date"
          className={FORM_CONTROL_CLASS}
          value={until}
          onChange={(event) => setUntil(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Lý do
        <textarea
          className={FORM_CONTROL_CLASS}
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {error ? <p className="text-label text-danger">{error}</p> : null}
    </ConfirmDialog>
  );
}

function ReplyDialog({
  document,
  busy,
  onConfirm,
  onCancel,
}: {
  document: IncomingDocument;
  busy: boolean;
  onConfirm(input: { reply_symbol: string; reply_date: string; note: string | null }): void;
  onCancel(): void;
}) {
  const [symbol, setSymbol] = useState(document.reply_symbol ?? '');
  const [date, setDate] = useState(document.reply_date ?? VIETNAM_DATE.format(new Date()));
  const [note, setNote] = useState(document.reply_note ?? '');
  return (
    <ConfirmDialog
      open
      title="Văn bản trả lời"
      confirmLabel="Ghi"
      busy={busy}
      onCancel={onCancel}
      onConfirm={() => onConfirm({ reply_symbol: symbol, reply_date: date, note: note.trim() || null })}
    >
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Số ký hiệu văn bản trả lời
        <input className={FORM_CONTROL_CLASS} value={symbol} onChange={(event) => setSymbol(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Ngày văn bản trả lời
        <input
          type="date"
          className={FORM_CONTROL_CLASS}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Ghi chú
        <textarea
          className={FORM_CONTROL_CLASS}
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
    </ConfirmDialog>
  );
}

// Chọn hồ sơ tài liệu chưa hoàn thành của Văn thư lưu trữ (5.10.1)
export function ArchiveDialog({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm(recordId: string): void;
  onCancel(): void;
}) {
  const [search, setSearch] = useState('');
  const [recordId, setRecordId] = useState('');
  const records = useQuery({
    queryKey: ['archive-records', 'incoming-pick', search],
    queryFn: () =>
      searchArchiveRecords({ status: 'pending', search: search.trim() || undefined, page: 1, pageSize: 50 }),
  });
  return (
    <ConfirmDialog
      open
      title="Lưu hồ sơ"
      confirmLabel="Lưu hồ sơ"
      busy={busy}
      onCancel={onCancel}
      onConfirm={() => recordId && onConfirm(recordId)}
    >
      {records.error ? <Alert tone="danger">{messageOf(records.error)}</Alert> : null}
      <input
        aria-label="Tìm hồ sơ tài liệu"
        placeholder="Tìm theo số, ký hiệu hoặc tiêu đề hồ sơ"
        className={FORM_CONTROL_CLASS}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <select
        aria-label="Hồ sơ tài liệu"
        className={FORM_CONTROL_CLASS}
        value={recordId}
        onChange={(event) => setRecordId(event.target.value)}
      >
        <option value="">-- Chọn hồ sơ --</option>
        {(records.data?.items ?? []).map((record) => (
          <option key={record.id} value={record.id}>
            {record.code} – {record.title}
          </option>
        ))}
      </select>
    </ConfirmDialog>
  );
}

function RegisterDialog({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm(input: { book_id: string; arrival_number: number | null; arrival_date: string }): void;
  onCancel(): void;
}) {
  const [date, setDate] = useState(VIETNAM_DATE.format(new Date()));
  const books = useQuery({ queryKey: ['document-books'], queryFn: () => listBooks() });
  const choices = (books.data ?? []).filter((book) => book.year === Number(date.slice(0, 4)));
  const [bookId, setBookId] = useState('');
  const [number, setNumber] = useState('');
  const selected = bookId || choices[0]?.id || '';
  return (
    <ConfirmDialog
      open
      title="Vào sổ văn bản đến"
      confirmLabel="Vào sổ"
      busy={busy}
      onCancel={onCancel}
      onConfirm={() =>
        selected &&
        onConfirm({ book_id: selected, arrival_number: number.trim() ? Number(number) : null, arrival_date: date })
      }
    >
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Ngày đến
        <input
          type="date"
          className={FORM_CONTROL_CLASS}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Sổ văn bản
        <select className={FORM_CONTROL_CLASS} value={selected} onChange={(event) => setBookId(event.target.value)}>
          {choices.map((book) => (
            <option key={book.id} value={book.id}>
              {book.name} (số kế tiếp {book.next_number})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Số đến (để trống là số kế tiếp)
        <input
          className={FORM_CONTROL_CLASS}
          inputMode="numeric"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
        />
      </label>
    </ConfirmDialog>
  );
}
