import { useId, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  INCOMING_KIND_LABELS,
  OUTGOING_DOCUMENT_STATUS_LABELS,
  OUTGOING_FILE_KIND_LABELS,
  OUTGOING_OPINION_STATUS_LABELS,
  OUTGOING_RECIPIENT_TYPE_LABELS,
  OUTGOING_SEND_STATUS_LABELS,
  type OutgoingFileKind,
} from '@school-management/shared';
import { Alert, Button, ConfirmDeleteDialog, ConfirmDialog, FORM_CONTROL_CLASS } from '@school-management/ui';
import { formatDate, messageOf } from '../archives/archive-ui.js';
import { ArchiveDialog } from '../incoming-documents/IncomingDocumentDetail.js';
import { listBooks, listDocumentStaff, listLeaders } from '../incoming-documents/incoming-api.js';
import { OutgoingDocumentForm } from './OutgoingDocumentForm.js';
import {
  archiveOutgoing,
  consultOutgoing,
  declineOutgoing,
  deleteOutgoing,
  deleteOutgoingFile,
  downloadOutgoingFile,
  downloadOutgoingSlip,
  endConsultation,
  freezeOutgoing,
  giveOpinion,
  issueOutgoing,
  markSent,
  nextIssueNumber,
  publishOutgoing,
  readOutgoing,
  returnOutgoing,
  revokeOutgoing,
  signOutgoing,
  submitOutgoing,
  uploadOutgoingFile,
  type OutgoingDocument,
} from './outgoing-api.js';

// Chi tiết văn bản đi theo VNPT iOffice (DT-18 phần 18b, YCTD-140): thẻ Thông tin văn bản, Ý kiến góp ý, Thông tin gửi (đơn
// vị nhận, trạng thái liên thông), Lịch sử. Nút theo danh sách thao tác máy chủ trả về: Cập nhật thông tin, Lấy ý kiến, Kết
// thúc lấy ý kiến, Cho ý kiến, Kết thúc cho ý kiến, Trình ký, Lấy lại, Ký, Không ký, Trả lại, Cấp số và phát hành, Liên thông,
// Public lên cổng TTĐT, Ẩn VB trên cổng TTĐT, Đóng băng, Hủy đóng băng, Lưu hồ sơ, In phiếu trình KG
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
const TABS = ['Thông tin văn bản', 'Ý kiến góp ý', 'Thông tin gửi', 'Lịch sử'] as const;
const UPLOAD_KINDS: OutgoingFileKind[] = ['draft', 'submission', 'attachment'];
const EVENT_LABELS: Record<string, string> = {
  create: 'Tạo dự thảo',
  update: 'Cập nhật thông tin',
  file_add: 'Đính kèm tệp',
  file_delete: 'Xóa tệp',
  consult: 'Lấy ý kiến',
  opinion: 'Cho ý kiến',
  finish_opinion: 'Kết thúc cho ý kiến',
  end_consult: 'Kết thúc lấy ý kiến',
  submit: 'Trình ký',
  revoke: 'Lấy lại',
  sign: 'Ký',
  decline: 'Không ký',
  return: 'Trả lại',
  issue: 'Cấp số và phát hành',
  send: 'Đánh dấu đã gửi liên thông',
  unsend: 'Hủy đánh dấu gửi',
  publish: 'Public lên cổng TTĐT',
  unpublish: 'Ẩn VB trên cổng TTĐT',
  freeze: 'Đóng băng',
  unfreeze: 'Hủy đóng băng',
  archive: 'Lưu hồ sơ',
};

const time = (value: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';

function sizeText(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border py-2 md:grid-cols-[14rem_1fr]">
      <dt className="text-label font-medium text-text-secondary">{label}</dt>
      <dd className="text-content text-text">{children}</dd>
    </div>
  );
}

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

// Lấy ý kiến: chọn người cho ý kiến, hạn, nội dung đề nghị
function ConsultDialog({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm(input: { user_ids: string[]; deadline: string | null; note: string | null }): void;
  onCancel(): void;
}) {
  const staff = useQuery({ queryKey: ['document-staff'], queryFn: listDocumentStaff });
  const [chosen, setChosen] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const shown = (staff.data ?? []).filter((person) =>
    `${person.full_name} ${person.job_title_name ?? ''} ${person.department_name ?? ''}`
      .toLocaleLowerCase('vi')
      .includes(filter.trim().toLocaleLowerCase('vi')),
  );
  return (
    <ConfirmDialog
      open
      title="Lấy ý kiến"
      confirmLabel="Lấy ý kiến"
      busy={busy}
      onCancel={onCancel}
      onConfirm={() => {
        if (chosen.length === 0) {
          setError('Chọn người cho ý kiến');
          return;
        }
        onConfirm({ user_ids: chosen, deadline: deadline || null, note: note.trim() || null });
      }}
    >
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
        <input
          aria-label="Tìm người cho ý kiến"
          placeholder="Tìm theo tên, chức vụ, bộ phận"
          className={FORM_CONTROL_CLASS}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <ul className="flex flex-col gap-1">
          {shown.map((person) => (
            <li key={person.user_id}>
              <label className="flex items-center gap-2 text-content">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={chosen.includes(person.user_id)}
                  onChange={(event) =>
                    setChosen((current) =>
                      event.target.checked
                        ? [...current, person.user_id]
                        : current.filter((userId) => userId !== person.user_id),
                    )
                  }
                />
                {person.full_name}
                <span className="text-label text-text-muted">
                  {[person.job_title_name, person.department_name ?? person.org_unit_name].filter(Boolean).join(', ')}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Hạn cho ý kiến
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Nội dung đề nghị
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

// Trình ký: người ký chọn trong danh sách lãnh đạo (mặc định người ký đã chọn ở biểu mẫu)
function SubmitDialog({
  document,
  busy,
  onConfirm,
  onCancel,
}: {
  document: OutgoingDocument;
  busy: boolean;
  onConfirm(input: { signer_id: string | null; note: string | null }): void;
  onCancel(): void;
}) {
  const leaders = useQuery({ queryKey: ['document-leaders'], queryFn: listLeaders });
  const [signerId, setSignerId] = useState(document.signer_id ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  return (
    <ConfirmDialog
      open
      title="Trình ký"
      confirmLabel="Trình ký"
      busy={busy}
      onCancel={onCancel}
      onConfirm={() => {
        if (!signerId) {
          setError('Chọn người ký');
          return;
        }
        onConfirm({ signer_id: signerId, note: note.trim() || null });
      }}
    >
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Người ký
        <select className={FORM_CONTROL_CLASS} value={signerId} onChange={(event) => setSignerId(event.target.value)}>
          <option value="">Chọn</option>
          {(leaders.data ?? []).map((leader) => (
            <option key={leader.user_id} value={leader.user_id}>
              {[leader.user_name, leader.title].filter(Boolean).join(' – ')}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-label font-medium text-text">
        Ý kiến trình
        <textarea
          className={FORM_CONTROL_CLASS}
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {error ? <p className="text-label text-danger">{error}</p> : null}
    </ConfirmDialog>
  );
}

// Cấp số và phát hành: sổ văn bản đi, số đi (trống là số kế tiếp), phần ký hiệu sau số, ngày ban hành, số bản
function IssueDialog({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm(input: {
    book_id: string;
    issue_number: number | null;
    symbol_suffix: string | null;
    issue_date: string;
    copies: number;
  }): void;
  onCancel(): void;
}) {
  const today = VIETNAM_DATE.format(new Date());
  const books = useQuery({
    queryKey: ['document-books', 'outgoing', today.slice(0, 4)],
    queryFn: () => listBooks(Number(today.slice(0, 4)), 'outgoing'),
  });
  const [bookId, setBookId] = useState('');
  const selected = bookId || books.data?.[0]?.id || '';
  const next = useQuery({
    queryKey: ['outgoing-next-number', selected],
    queryFn: () => nextIssueNumber(selected),
    enabled: Boolean(selected),
  });
  const [number, setNumber] = useState('');
  const [suffix, setSuffix] = useState('');
  const [date, setDate] = useState(today);
  const [copies, setCopies] = useState('1');
  const [error, setError] = useState<string>();
  return (
    <ConfirmDialog
      open
      title="Cấp số và phát hành"
      confirmLabel="Cấp số và phát hành"
      busy={busy}
      onCancel={onCancel}
      onConfirm={() => {
        if (!selected) {
          setError('Chưa có sổ văn bản đi của năm (Quản trị văn bản, mục 2.1)');
          return;
        }
        onConfirm({
          book_id: selected,
          issue_number: number ? Number(number) : null,
          symbol_suffix: suffix.trim() || null,
          issue_date: date,
          copies: Number(copies) || 1,
        });
      }}
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Sổ văn bản đi
          <select className={FORM_CONTROL_CLASS} value={selected} onChange={(event) => setBookId(event.target.value)}>
            {(books.data ?? []).map((book) => (
              <option key={book.id} value={book.id}>
                {book.name} ({book.year})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Số đi
          <input
            inputMode="numeric"
            className={FORM_CONTROL_CLASS}
            placeholder={next.data ? `Số kế tiếp: ${next.data.next_number}` : ''}
            value={number}
            onChange={(event) => setNumber(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Ký hiệu sau số (ví dụ QĐ-THCS)
          <input className={FORM_CONTROL_CLASS} value={suffix} onChange={(event) => setSuffix(event.target.value)} />
        </label>
        <p className="text-label text-text-muted">
          Số ký hiệu: {number || next.data?.next_number || '…'}
          {suffix.trim() ? `/${suffix.trim()}` : ''}
        </p>
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Ngày ban hành
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Số bản
          <input
            inputMode="numeric"
            className={FORM_CONTROL_CLASS}
            value={copies}
            onChange={(event) => setCopies(event.target.value)}
          />
        </label>
        {error ? <p className="text-label text-danger">{error}</p> : null}
      </div>
    </ConfirmDialog>
  );
}

type Dialog =
  | { kind: 'consult' }
  | { kind: 'opinion' }
  | { kind: 'submit' }
  | { kind: 'note'; action: 'decline' | 'return' }
  | { kind: 'issue' }
  | { kind: 'archive' }
  | { kind: 'sign' }
  | { kind: 'delete' };

export function OutgoingDocumentDetail({
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
  const [uploadKind, setUploadKind] = useState<OutgoingFileKind>('draft');
  const [sendIds, setSendIds] = useState<string[]>([]);
  const [reference, setReference] = useState('');
  const detail = useQuery({ queryKey: ['outgoing-document', documentId], queryFn: () => readOutgoing(documentId) });
  const fileInputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const applied = (saved: OutgoingDocument | void, text?: string) => {
    if (saved) {
      queryClient.setQueryData(['outgoing-document', documentId], saved);
    }
    setDialog(undefined);
    setMessage(text);
    onChanged();
  };
  const run = useMutation({
    mutationFn: (operation: () => Promise<OutgoingDocument | void>) => operation(),
    onSuccess: (saved) => applied(saved),
  });
  const remove = useMutation({
    mutationFn: () => deleteOutgoing(documentId),
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
  const can = (action: OutgoingDocument['actions'][number]) => document.actions.includes(action);
  const act = (operation: () => Promise<OutgoingDocument | void>) => run.mutate(operation);
  const error = run.error ?? remove.error;
  const pendingExternal = document.recipients.filter(
    (item) => item.recipient_type === 'external' && item.send_status === 'pending',
  );

  if (editing) {
    return (
      <OutgoingDocumentForm
        document={document}
        onCancel={() => setEditing(false)}
        onSaved={(saved) => {
          setEditing(false);
          applied(saved, 'Đã cập nhật thông tin văn bản');
        }}
      />
    );
  }

  const button = (label: string, onClick: () => void, variant: 'primary' | 'secondary' | 'text' = 'secondary') => (
    <Button key={label} variant={variant} disabled={run.isPending} onClick={onClick}>
      {label}
    </Button>
  );
  const title = document.symbol ?? `số eOffice ${document.eoffice_number}`;

  return (
    <div className="flex flex-col gap-4" aria-label={`Văn bản đi ${title}`}>
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {document.return_note && document.status === 'draft' ? (
        <Alert tone="warning">
          Bị trả lại {time(document.returned_at)} ({document.returned_by_name ?? ''}): {document.return_note}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Thao tác văn bản đi">
        {can('sign') ? button('Ký', () => setDialog({ kind: 'sign' }), 'primary') : null}
        {can('decline') ? button('Không ký', () => setDialog({ kind: 'note', action: 'decline' })) : null}
        {can('issue') ? button('Cấp số và phát hành', () => setDialog({ kind: 'issue' }), 'primary') : null}
        {can('submit') ? button('Trình ký', () => setDialog({ kind: 'submit' }), 'primary') : null}
        {can('opinion') ? button('Cho ý kiến', () => setDialog({ kind: 'opinion' }), 'primary') : null}
        {can('finish_opinion')
          ? button('Kết thúc cho ý kiến', () => act(() => giveOpinion(documentId, { opinion: null, finish: true })))
          : null}
        {can('consult') ? button('Lấy ý kiến', () => setDialog({ kind: 'consult' })) : null}
        {can('end_consult') ? button('Kết thúc lấy ý kiến', () => act(() => endConsultation(documentId))) : null}
        {can('update') ? button('Cập nhật thông tin', () => setEditing(true)) : null}
        {can('revoke') ? button('Lấy lại', () => act(() => revokeOutgoing(documentId))) : null}
        {can('return') ? button('Trả lại', () => setDialog({ kind: 'note', action: 'return' })) : null}
        {can('publish')
          ? button(document.published ? 'Ẩn VB trên cổng TTĐT' : 'Public lên cổng TTĐT', () =>
              act(() => publishOutgoing(documentId, !document.published)),
            )
          : null}
        {can('freeze')
          ? button(document.frozen ? 'Hủy đóng băng' : 'Đóng băng', () =>
              act(() => freezeOutgoing(documentId, !document.frozen)),
            )
          : null}
        {can('archive') ? button('Lưu hồ sơ', () => setDialog({ kind: 'archive' })) : null}
        {button('In phiếu trình KG', () => act(() => downloadOutgoingSlip(documentId)), 'text')}
        {can('delete') ? button('Xóa', () => setDialog({ kind: 'delete' }), 'text') : null}
      </div>
      <div role="tablist" aria-label="Thông tin văn bản đi" className="flex flex-wrap gap-1 border-b border-border">
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
          <InfoRow label="Số eOffice">{document.eoffice_number}</InfoRow>
          <InfoRow label="Số trình ký">{document.submission_number ?? ''}</InfoRow>
          <InfoRow label="Trích yếu">{document.summary}</InfoRow>
          <InfoRow label="Trạng thái">
            {OUTGOING_DOCUMENT_STATUS_LABELS[document.status]}
            {document.frozen ? ` – đóng băng (${document.frozen_by_name ?? ''})` : ''}
            {document.published ? ` – đã public lên cổng TTĐT ${time(document.published_at)}` : ''}
          </InfoRow>
          <InfoRow label="Sổ, số, số ký hiệu">
            {document.book_name
              ? `${document.book_name} – số ${document.issue_number} – ${document.symbol}`
              : 'Chưa cấp số'}
          </InfoRow>
          <InfoRow label="Ngày ban hành, số bản">
            {document.issue_date ? `${formatDate(document.issue_date)} – ${document.copies ?? 1} bản` : ''}
          </InfoRow>
          <InfoRow label="Hình thức">{document.form_name ?? ''}</InfoRow>
          <InfoRow label="Độ khẩn">{document.urgency_name ?? ''}</InfoRow>
          <InfoRow label="Độ mật">{document.secrecy_name ?? ''}</InfoRow>
          <InfoRow label="Lĩnh vực">{document.field_name ?? ''}</InfoRow>
          <InfoRow label="Loại văn bản">{INCOMING_KIND_LABELS[document.document_kind]}</InfoRow>
          <InfoRow label="Phân loại VB ưu tiên">{document.priority ? 'Ưu tiên' : 'Thường'}</InfoRow>
          <InfoRow label="Người soạn thảo">{document.drafter_name}</InfoRow>
          <InfoRow label="Đơn vị soạn thảo">{document.drafting_unit_name ?? ''}</InfoRow>
          <InfoRow label="Người ký">{[document.signer_name, document.signer_title].filter(Boolean).join(', ')}</InfoRow>
          {document.signed_at ? (
            <InfoRow label="Ký">
              {time(document.signed_at)}
              {document.signature_method === 'internal' ? ' – ký xác nhận nội bộ' : ''}
              {document.verification_code ? ` – mã tra cứu ${document.verification_code}` : ''}
              <span className="block text-label text-text-muted">{document.signer_description}</span>
            </InfoRow>
          ) : null}
          {document.meeting_at || document.meeting_place ? (
            <InfoRow label="Thời gian họp, địa điểm">
              {time(document.meeting_at)} {document.meeting_place ? `– ${document.meeting_place}` : ''}
            </InfoRow>
          ) : null}
          <InfoRow label="Chèn QR code">{document.insert_qr ? 'Có' : 'Không'}</InfoRow>
          <InfoRow label="Nội dung trình">{document.content_note ?? ''}</InfoRow>
          {document.reply_to_id ? (
            <InfoRow label="Trả lời văn bản đến">
              {document.reply_to_symbol} – {document.reply_to_summary}
            </InfoRow>
          ) : null}
          <InfoRow label="Văn bản liên quan, văn bản gốc">
            {document.links.length === 0
              ? 'Không có'
              : document.links.map((link) => (
                  <span key={link.id} className="block">
                    {link.link_type === 'original' ? 'Văn bản gốc: ' : ''}
                    {link.symbol} – {link.summary}
                  </span>
                ))}
          </InfoRow>
          {document.archive_record_code ? (
            <InfoRow label="Lưu hồ sơ">
              {document.archive_record_code} – {document.archive_record_title}
            </InfoRow>
          ) : null}
          <InfoRow label="File đính kèm">
            <ul aria-label="Danh sách tệp đính kèm" className="flex flex-col gap-1">
              {document.files.map((file) => (
                <li key={file.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-label font-semibold">{OUTGOING_FILE_KIND_LABELS[file.kind]}</span>
                  <span className="font-medium">{file.file_name}</span>
                  <span className="text-label text-text-muted">{sizeText(file.size_bytes)}</span>
                  <Button variant="text" onClick={() => act(() => downloadOutgoingFile(documentId, file))}>
                    Tải về
                  </Button>
                  {can('upload') && file.kind !== 'signed' ? (
                    <Button variant="text" onClick={() => act(() => deleteOutgoingFile(documentId, file.id))}>
                      Xóa tệp
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {can('upload') ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  aria-label="Loại tệp"
                  className={FORM_CONTROL_CLASS}
                  value={uploadKind}
                  onChange={(event) => setUploadKind(event.target.value as OutgoingFileKind)}
                >
                  {UPLOAD_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {OUTGOING_FILE_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
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
                        const saved = await uploadOutgoingFile(documentId, file, uploadKind);
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
      {tab === 'Ý kiến góp ý' ? (
        <table className="w-full text-content" aria-label="Ý kiến góp ý">
          <thead>
            <tr className="text-left text-label text-text-secondary">
              <th className="py-1">Đợt</th>
              <th className="py-1">Người cho ý kiến</th>
              <th className="py-1">Hạn</th>
              <th className="py-1">Ý kiến</th>
              <th className="py-1">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {document.opinions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-2 text-text-muted">
                  Chưa lấy ý kiến.
                </td>
              </tr>
            ) : (
              document.opinions.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="py-1">{row.round}</td>
                  <td className="py-1">
                    {row.user_name}
                    {row.request_note ? (
                      <span className="block text-label text-text-muted">Đề nghị: {row.request_note}</span>
                    ) : null}
                  </td>
                  <td className="py-1">{formatDate(row.deadline)}</td>
                  <td className="py-1">{row.opinion ?? ''}</td>
                  <td className="py-1">{OUTGOING_OPINION_STATUS_LABELS[row.status]}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : null}
      {tab === 'Thông tin gửi' ? (
        <div className="flex flex-col gap-3">
          <Alert tone="info">{document.exchange.description}</Alert>
          <table className="w-full text-content" aria-label="Đơn vị nhận">
            <thead>
              <tr className="text-left text-label text-text-secondary">
                {can('send') ? <th className="py-1">Chọn</th> : null}
                <th className="py-1">Đơn vị nhận</th>
                <th className="py-1">Loại</th>
                <th className="py-1">Trạng thái liên thông</th>
                <th className="py-1">Thời gian, người gửi</th>
                <th className="py-1">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {document.recipients.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  {can('send') ? (
                    <td className="py-1">
                      {item.recipient_type === 'external' ? (
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          aria-label={`Chọn ${item.name}`}
                          checked={sendIds.includes(item.id)}
                          onChange={(event) =>
                            setSendIds((current) =>
                              event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                            )
                          }
                        />
                      ) : null}
                    </td>
                  ) : null}
                  <td className="py-1">{item.name}</td>
                  <td className="py-1">{OUTGOING_RECIPIENT_TYPE_LABELS[item.recipient_type]}</td>
                  <td className="py-1">{OUTGOING_SEND_STATUS_LABELS[item.send_status]}</td>
                  <td className="py-1">
                    {time(item.sent_at)} {item.sent_by_name ? `– ${item.sent_by_name}` : ''}
                  </td>
                  <td className="py-1">{item.reference ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {can('send') ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-label font-medium text-text">
                Ghi chú gửi (cách gửi, mã tham chiếu)
                <input
                  className={FORM_CONTROL_CLASS}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              </label>
              {button(
                'Đánh dấu đã gửi',
                () =>
                  act(async () => {
                    const saved = await markSent(documentId, {
                      recipient_ids: sendIds.length > 0 ? sendIds : pendingExternal.map((item) => item.id),
                      sent: true,
                      reference: reference.trim() || null,
                    });
                    setSendIds([]);
                    setReference('');
                    return saved;
                  }),
                'primary',
              )}
              {button('Hủy đánh dấu gửi', () =>
                act(async () => {
                  const saved = await markSent(documentId, { recipient_ids: sendIds, sent: false, reference: null });
                  setSendIds([]);
                  return saved;
                }),
              )}
              {document.files
                .filter((file) => file.kind === 'signed')
                .map((file) =>
                  button('Tải bản đã ký để gửi', () => act(() => downloadOutgoingFile(documentId, file)), 'text'),
                )}
            </div>
          ) : null}
        </div>
      ) : null}
      {tab === 'Lịch sử' ? (
        <ol aria-label="Lịch sử văn bản đi" className="flex flex-col gap-1">
          {document.events.map((event) => (
            <li key={event.id} className="text-content">
              <span className="text-label text-text-muted">{time(event.created_at)}</span> –{' '}
              <span className="font-medium">{EVENT_LABELS[event.action] ?? event.action}</span> – {event.actor_name}
              {event.note ? `: ${event.note}` : ''}
            </li>
          ))}
        </ol>
      ) : null}
      {dialog?.kind === 'consult' ? (
        <ConsultDialog
          busy={run.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={(input) => act(() => consultOutgoing(documentId, input))}
        />
      ) : null}
      {dialog?.kind === 'opinion' ? (
        <NoteDialog
          title="Cho ý kiến"
          label="Ý kiến"
          confirmLabel="Gửi ý kiến"
          required
          busy={run.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={(note) => act(() => giveOpinion(documentId, { opinion: note, finish: false }))}
        />
      ) : null}
      {dialog?.kind === 'submit' ? (
        <SubmitDialog
          document={document}
          busy={run.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={(input) => act(() => submitOutgoing(documentId, input))}
        />
      ) : null}
      {dialog?.kind === 'note' ? (
        <NoteDialog
          title={dialog.action === 'decline' ? 'Không ký' : 'Trả lại'}
          label="Lý do"
          confirmLabel={dialog.action === 'decline' ? 'Không ký' : 'Trả lại'}
          required
          busy={run.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={(note) =>
            act(async () => {
              if (dialog.action === 'decline') {
                return declineOutgoing(documentId, note);
              }
              // Văn thư trả lại thì không còn xem được văn bản: đọc lại nếu còn quyền, không thì đóng chi tiết
              const result = await returnOutgoing(documentId, note);
              if (!result.files) {
                setDialog(undefined);
                setMessage('Đã trả lại văn bản cho người soạn');
                onChanged();
                onDeleted?.();
                return;
              }
              return result as OutgoingDocument;
            })
          }
        />
      ) : null}
      {dialog?.kind === 'sign' ? (
        <ConfirmDialog
          open
          title="Ký văn bản"
          confirmLabel="Ký"
          busy={run.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={() => act(() => signOutgoing(documentId))}
        >
          <p>{document.signer_description}</p>
          {document.insert_qr ? <p>Bản đã ký có mã QR để tra cứu.</p> : null}
        </ConfirmDialog>
      ) : null}
      {dialog?.kind === 'issue' ? (
        <IssueDialog
          busy={run.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={(input) => act(() => issueOutgoing(documentId, input))}
        />
      ) : null}
      {dialog?.kind === 'archive' ? (
        <ArchiveDialog
          busy={run.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={(recordId) =>
            act(async () => {
              const [result] = await archiveOutgoing([documentId], recordId);
              if (result && !result.ok) {
                throw new Error(result.message ?? 'Không lưu hồ sơ được');
              }
              return readOutgoing(documentId);
            })
          }
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <ConfirmDeleteDialog
          open
          subject={`dự thảo số eOffice ${document.eoffice_number}`}
          busy={remove.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={() => remove.mutate()}
        />
      ) : null}
    </div>
  );
}
