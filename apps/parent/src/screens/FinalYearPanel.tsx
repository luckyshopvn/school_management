import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, StatusBadge, TextField } from '@school-management/ui';
import { ApiError, fetchWithSession, requestJson } from '../session/api-client.js';

// Hồ sơ cuối cấp (DT-17 phần 17c, YCTD-134): phụ huynh xem hồ sơ của con chuẩn bị vào cấp trên do nhà trường lập, xác nhận
// hoặc đề xuất sửa (ghi nội dung), tải ảnh giấy khai sinh, ảnh thông tin cư trú trên VNeID, minh chứng trước hạn điều chỉnh;
// đồng ý nhập học; gửi yêu cầu hỗ trợ tuyển sinh và xem câu trả lời của nhà trường
type FileKind = 'birth_certificate' | 'residence' | 'evidence';

interface FinalYearRecord {
  id: string;
  child_id: string;
  class_name: string;
  full_name: string;
  dob: string;
  national_id: string;
  current_residence: string | null;
  house_number: string | null;
  street: string | null;
  residential_group: string | null;
  quarter: string | null;
  ward: string | null;
  province: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  routed_school: string | null;
  status: string;
  review_status: 'pending' | 'approved';
  parent_proposal: string | null;
  admission_consent: boolean;
  check_text: string;
  missing: string[];
  files: Array<{ id: string; kind: FileKind; file_name: string; uploaded_by_parent: boolean }>;
}

interface SupportRequest {
  id: string;
  child_id: string | null;
  content: string;
  status: 'pending' | 'answered';
  reply: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  parent_pending: 'PHHS chưa xác nhận',
  awaiting_school_edit: 'Chờ đơn vị chỉnh sửa',
  awaiting_parent_reconfirm: 'Chờ PHHS xác nhận lại',
  parent_confirmed: 'PHHS đã xác nhận',
  school_edited: 'Đã chỉnh sửa',
  parent_confirmed_after_edit: 'PHHS đã xác nhận sau chỉnh sửa',
};
const CONFIRMABLE = ['parent_pending', 'awaiting_parent_reconfirm', 'school_edited'];
const KIND_LABELS: Record<FileKind, string> = {
  birth_certificate: 'Giấy khai sinh',
  residence: 'Ảnh thông tin cư trú trên VNeID',
  evidence: 'Minh chứng',
};

const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

async function openFile(fileId: string) {
  const response = await fetchWithSession(`/api/v1/final-year-records/files/${fileId}`);
  if (!response.ok) {
    throw new ApiError(response.status, 'ERR_FORBIDDEN', 'Không mở được tệp');
  }
  window.open(URL.createObjectURL(await response.blob()), '_blank', 'noopener');
}

function RecordCard({
  record,
  deadline,
  onChanged,
}: {
  record: FinalYearRecord;
  deadline: string | null;
  onChanged(): void;
}) {
  const [proposal, setProposal] = useState('');
  const [proposing, setProposing] = useState(false);
  const [kind, setKind] = useState<FileKind>('residence');
  const [file, setFile] = useState<File>();
  const [notice, setNotice] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const locked = record.review_status === 'approved';

  async function run(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    setErrorMessage(undefined);
    setNotice(undefined);
    try {
      await work();
      setNotice(message);
      onChanged();
    } catch (error) {
      setErrorMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  function submitProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(
      () =>
        requestJson(`/api/v1/parent/final-year-records/${record.id}/propose`, {
          method: 'POST',
          body: JSON.stringify({ content: proposal }),
        }).then(() => setProposing(false)),
      'Đã gửi đề xuất sửa cho nhà trường',
    );
  }

  function upload() {
    if (!file) {
      setErrorMessage('Chọn ảnh hoặc tệp PDF trước');
      return;
    }
    const form = new FormData();
    form.set('kind', kind);
    form.set('file', file);
    void run(
      () => requestJson(`/api/v1/parent/final-year-records/${record.id}/files`, { method: 'POST', body: form }),
      `Đã tải ${KIND_LABELS[kind].toLowerCase()}`,
    );
  }

  const address = [
    record.house_number,
    record.street,
    record.residential_group,
    record.quarter,
    record.ward,
    record.province,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <section className="flex flex-col gap-2" aria-label={`Hồ sơ cuối cấp của ${record.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          tone={record.status.startsWith('parent_confirmed') ? 'success' : 'warning'}
          label={STATUS_LABELS[record.status] ?? record.status}
        />
        {locked ? <StatusBadge tone="success" label="Nhà trường đã duyệt" /> : null}
      </div>
      {deadline ? (
        <p className="text-label text-text-secondary">
          Hạn điều chỉnh thông tin: {deadline.split('-').reverse().join('/')}
        </p>
      ) : null}
      <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-1 text-content">
        <dt className="text-text-secondary">Lớp</dt>
        <dd>{record.class_name}</dd>
        <dt className="text-text-secondary">Ngày sinh</dt>
        <dd>{record.dob.split('-').reverse().join('/')}</dd>
        <dt className="text-text-secondary">Số định danh</dt>
        <dd>{record.national_id}</dd>
        <dt className="text-text-secondary">Nơi ở hiện tại</dt>
        <dd>{record.current_residence ?? ''}</dd>
        <dt className="text-text-secondary">Địa chỉ</dt>
        <dd>{address}</dd>
        <dt className="text-text-secondary">Liên hệ</dt>
        <dd>{[record.contact_name, record.contact_phone].filter(Boolean).join(' · ')}</dd>
        <dt className="text-text-secondary">Trường phân tuyến</dt>
        <dd>{record.routed_school ?? ''}</dd>
        <dt className="text-text-secondary">Kiểm dò</dt>
        <dd>{record.check_text}</dd>
        {record.parent_proposal ? (
          <>
            <dt className="text-text-secondary">Đề xuất đã gửi</dt>
            <dd>{record.parent_proposal}</dd>
          </>
        ) : null}
      </dl>
      <ul className="flex flex-col gap-1 text-label">
        {record.files.map((item) => (
          <li key={item.id}>
            <Button
              variant="text"
              onClick={() => openFile(item.id).catch((error: unknown) => setErrorMessage(messageOf(error)))}
            >
              {KIND_LABELS[item.kind]}: {item.file_name}
            </Button>
          </li>
        ))}
      </ul>
      {!locked ? (
        <div className="flex flex-wrap gap-2">
          {CONFIRMABLE.includes(record.status) ? (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => requestJson(`/api/v1/parent/final-year-records/${record.id}/confirm`, { method: 'POST' }),
                  'Đã xác nhận hồ sơ',
                )
              }
            >
              Xác nhận
            </Button>
          ) : null}
          {record.status !== 'awaiting_school_edit' ? (
            <Button disabled={busy} onClick={() => setProposing(!proposing)}>
              Đề xuất sửa
            </Button>
          ) : null}
        </div>
      ) : null}
      {proposing ? (
        <form onSubmit={submitProposal} noValidate className="flex flex-col gap-2" aria-label="Đề xuất sửa hồ sơ">
          <TextField label="Nội dung cần sửa" value={proposal} onChange={(event) => setProposal(event.target.value)} />
          <div>
            <Button type="submit" variant="primary" disabled={busy}>
              Gửi đề xuất
            </Button>
          </div>
        </form>
      ) : null}
      {!locked ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-label font-medium text-text">
            Loại giấy tờ
            <select
              className="rounded-lg border border-border bg-card px-3 py-2 text-content"
              value={kind}
              onChange={(event) => setKind(event.target.value as FileKind)}
            >
              {(Object.keys(KIND_LABELS) as FileKind[]).map((value) => (
                <option key={value} value={value}>
                  {KIND_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <input
            type="file"
            aria-label="Ảnh giấy tờ"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0])}
          />
          <div>
            <Button disabled={busy} onClick={upload}>
              Tải giấy tờ
            </Button>
          </div>
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-content">
        <input
          type="checkbox"
          checked={record.admission_consent}
          disabled={busy}
          onChange={(event) =>
            void run(
              () =>
                requestJson(`/api/v1/parent/final-year-records/${record.id}/consent`, {
                  method: 'POST',
                  body: JSON.stringify({ consent: event.target.checked }),
                }),
              event.target.checked ? 'Đã ghi đồng ý nhập học' : 'Đã bỏ đồng ý nhập học',
            )
          }
        />
        Đồng ý nhập học
      </label>
    </section>
  );
}

function SupportForm({ childId }: { childId: string }) {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [content, setContent] = useState('');
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const load = useCallback(async () => {
    try {
      const page = await requestJson<{ items: SupportRequest[] }>('/api/v1/parent/admission-support');
      setRequests(page.items.filter((item) => item.child_id === childId));
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  }, [childId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    try {
      await requestJson('/api/v1/parent/admission-support', {
        method: 'POST',
        body: JSON.stringify({ child_id: childId, content, email: email || null }),
      });
      setContent('');
      setNotice('Đã gửi yêu cầu hỗ trợ tuyển sinh');
      await load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Hỗ trợ tuyển sinh">
      <h3 className="text-content font-semibold">Hỗ trợ tuyển sinh</h3>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <form onSubmit={submit} noValidate className="flex flex-col gap-2">
        <TextField label="Nội dung cần hỗ trợ" value={content} onChange={(event) => setContent(event.target.value)} />
        <TextField label="Thư điện tử nhận trả lời" value={email} onChange={(event) => setEmail(event.target.value)} />
        <div>
          <Button type="submit">Gửi yêu cầu</Button>
        </div>
      </form>
      <ul className="flex flex-col gap-1 text-label">
        {requests.map((item) => (
          <li key={item.id}>
            {item.content} — {item.reply ? `Nhà trường trả lời: ${item.reply}` : 'Chưa trả lời'}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FinalYearPanel({ child }: { child: { id: string; full_name: string } }) {
  const [records, setRecords] = useState<FinalYearRecord[]>();
  const [deadline, setDeadline] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>();
  const load = useCallback(async () => {
    try {
      const page = await requestJson<{ items: FinalYearRecord[]; edit_deadline: string | null }>(
        '/api/v1/parent/final-year-records',
      );
      setRecords(page.items.filter((item) => item.child_id === child.id));
      setDeadline(page.edit_deadline);
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  }, [child.id]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-3">
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {records && records.length === 0 ? (
        <p className="text-content text-text-secondary">Con chưa có hồ sơ cuối cấp (chỉ có ở lớp năm cuối cấp).</p>
      ) : null}
      {(records ?? []).map((record) => (
        <RecordCard key={record.id} record={record} deadline={deadline} onChanged={() => void load()} />
      ))}
      <SupportForm childId={child.id} />
    </div>
  );
}
