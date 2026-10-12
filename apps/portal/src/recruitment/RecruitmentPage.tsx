import { useCallback, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import { listStaff } from '../staff/staff-api.js';
import {
  CANDIDATE_STATUS_LABELS,
  getJson,
  messageOf,
  openCv,
  POSTING_STATUS_LABELS,
  postJson,
  REQUEST_STATUS_LABELS,
  SOURCE_LABELS,
  uploadCv,
  vietnamToday,
  type CandidateDetail,
  type CandidateRow,
  type CandidateSource,
  type JobPosting,
  type RecruitmentRequest,
} from './recruitment-api.js';

// MH-27 Tuyển dụng (P18-01 đến P18-04; BR-37, BR-69, BR-74, BR-75, BR-80; YCTD-87): lập và duyệt đề nghị tuyển dụng, soạn
// và công bố tin, tiếp nhận và sàng lọc ứng viên, phỏng vấn, quyết định tuyển, tạo hồ sơ nhân sự từ ứng viên đã tuyển
type Tab = 'requests' | 'pending' | 'postings' | 'candidates';

const selectClass = 'rounded-lg border border-border bg-card px-3 py-2 text-content';

export function RecruitmentPage() {
  const canCreate = useHasPermission(PERMISSION_CODES.recruitmentRequestCreate);
  const canApprove = useHasPermission(PERMISSION_CODES.recruitmentRequestApprove);
  const canManage = useHasPermission(PERMISSION_CODES.recruitmentManage);
  const canInterview = useHasPermission(PERMISSION_CODES.interviewManage);
  const tabs: Array<[Tab, string, boolean]> = [
    ['requests', 'Đề nghị tuyển dụng', canCreate || canManage || canInterview],
    ['pending', 'Đề nghị chờ duyệt', canApprove],
    ['postings', 'Tin tuyển dụng', canManage || canInterview || canApprove],
    ['candidates', 'Ứng viên', canManage || canInterview],
  ];
  const visible = tabs.filter(([, , allowed]) => allowed);
  const [tab, setTab] = useState<Tab>();
  const current = tab ?? visible[0]?.[0];
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">Tuyển dụng</h1>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tuyển dụng">
          {visible.map(([code, label]) => (
            <Button
              key={code}
              role="tab"
              aria-selected={current === code}
              variant={current === code ? 'secondary' : 'text'}
              onClick={() => setTab(code)}
            >
              {label}
            </Button>
          ))}
        </div>
        {current === 'requests' ? <RequestsTab canCreate={canCreate} onDone={setToastMessage} /> : null}
        {current === 'pending' ? <PendingTab onDone={setToastMessage} /> : null}
        {current === 'postings' ? <PostingsTab canManage={canManage} onDone={setToastMessage} /> : null}
        {current === 'candidates' ? <CandidatesTab onDone={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}

// ---------- Đề nghị tuyển dụng (P18-01) ----------

function RequestsTab({ canCreate, onDone }: { canCreate: boolean; onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const [form, setForm] = useState({ position: '', quantity: '1', requirements: '', reason: '', needed_by: '' });
  const [closeReasons, setCloseReasons] = useState<Record<string, string>>({});
  const requests = useQuery({
    queryKey: ['recruitment-requests', 'all'],
    queryFn: () => getJson<RecruitmentRequest[]>('/api/v1/recruitment-requests?view=all'),
  });
  const mine = useQuery({
    queryKey: ['recruitment-requests', 'mine'],
    queryFn: () => getJson<RecruitmentRequest[]>('/api/v1/recruitment-requests?view=mine'),
  });
  const create = useMutation({
    mutationFn: () =>
      postJson<RecruitmentRequest>('/api/v1/recruitment-requests', {
        org_unit_id: unitChoice.selectedId,
        position: form.position,
        quantity: Number(form.quantity),
        requirements: form.requirements,
        reason: form.reason,
        needed_by: form.needed_by || null,
      }),
    onSuccess: async (created) => {
      setForm({ position: '', quantity: '1', requirements: '', reason: '', needed_by: '' });
      await queryClient.invalidateQueries({ queryKey: ['recruitment-requests'] });
      onDone(`Đã gửi đề nghị ${created.code}, chờ Ban Giám hiệu duyệt`);
    },
  });
  const close = useMutation({
    mutationFn: (id: string) =>
      postJson<RecruitmentRequest>(`/api/v1/recruitment-requests/${id}/close`, { reason: closeReasons[id] ?? '' }),
    onSuccess: async (closed) => {
      await queryClient.invalidateQueries({ queryKey: ['recruitment-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      onDone(`Đã đóng đề nghị ${closed.code}`);
    },
  });
  // Người chỉ có quyền lập đề nghị xem đề nghị của mình; người có quyền khác xem trong phạm vi
  const rows = requests.data ?? mine.data ?? [];
  const complete = form.position && form.quantity && form.requirements && form.reason;
  return (
    <div className="flex flex-col gap-4">
      {create.error || close.error ? <Alert tone="danger">{messageOf(create.error ?? close.error)}</Alert> : null}
      {canCreate ? (
        <form
          aria-label="Lập đề nghị tuyển dụng"
          className="flex flex-col gap-3 rounded-lg bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
            <TextField
              label="Vị trí cần tuyển"
              value={form.position}
              onChange={(event) => setForm({ ...form, position: event.target.value })}
            />
            <TextField
              label="Số lượng"
              type="number"
              min={1}
              value={form.quantity}
              onChange={(event) => setForm({ ...form, quantity: event.target.value })}
            />
            <TextField
              label="Yêu cầu"
              value={form.requirements}
              onChange={(event) => setForm({ ...form, requirements: event.target.value })}
            />
            <TextField
              label="Lý do tuyển"
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
            />
            <TextField
              label="Cần người trước ngày"
              type="date"
              value={form.needed_by}
              onChange={(event) => setForm({ ...form, needed_by: event.target.value })}
            />
          </div>
          <div>
            <Button type="submit" variant="primary" disabled={create.isPending || !complete || !unitChoice.selectedId}>
              Gửi đề nghị tuyển dụng
            </Button>
          </div>
        </form>
      ) : null}
      <RequestTable
        rows={rows}
        actions={(row) =>
          row.status === 'pending' || row.status === 'approved' ? (
            <div className="flex flex-wrap items-end gap-2">
              <TextField
                label="Lý do đóng"
                value={closeReasons[row.id] ?? ''}
                onChange={(event) => setCloseReasons((previous) => ({ ...previous, [row.id]: event.target.value }))}
              />
              <Button
                variant="text"
                disabled={close.isPending || !closeReasons[row.id]}
                onClick={() => close.mutate(row.id)}
              >
                Đóng đề nghị
              </Button>
            </div>
          ) : null
        }
      />
    </div>
  );
}

function PendingTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const pending = useQuery({
    queryKey: ['recruitment-requests', 'pending'],
    queryFn: () => getJson<RecruitmentRequest[]>('/api/v1/recruitment-requests?view=pending'),
  });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      postJson<RecruitmentRequest>(
        `/api/v1/recruitment-requests/${id}/${approve ? 'approve' : 'reject'}`,
        approve ? {} : { reason: reasons[id] ?? '' },
      ),
    onSuccess: async (decided) => {
      await queryClient.invalidateQueries({ queryKey: ['recruitment-requests'] });
      onDone(decided.status === 'approved' ? `Đã duyệt đề nghị ${decided.code}` : `Đã từ chối đề nghị ${decided.code}`);
    },
  });
  return (
    <div className="flex flex-col gap-4">
      {pending.error || decide.error ? <Alert tone="danger">{messageOf(pending.error ?? decide.error)}</Alert> : null}
      <RequestTable
        rows={pending.data ?? []}
        actions={(row) => (
          <div className="flex flex-wrap items-end gap-2">
            <Button
              variant="primary"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: row.id, approve: true })}
            >
              Duyệt
            </Button>
            <TextField
              label="Lý do từ chối"
              value={reasons[row.id] ?? ''}
              onChange={(event) => setReasons((previous) => ({ ...previous, [row.id]: event.target.value }))}
            />
            <Button
              variant="text"
              disabled={decide.isPending || !reasons[row.id]}
              onClick={() => decide.mutate({ id: row.id, approve: false })}
            >
              Từ chối
            </Button>
          </div>
        )}
      />
    </div>
  );
}

function RequestTable({
  rows,
  actions,
}: {
  rows: RecruitmentRequest[];
  actions?: (row: RecruitmentRequest) => ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="text-content text-text-secondary">Chưa có đề nghị nào</p>;
  }
  return (
    <table className="w-full text-content">
      <thead>
        <tr className="text-left text-text-secondary">
          <th className="py-2">Mã</th>
          <th>Đơn vị</th>
          <th>Vị trí</th>
          <th>Đã tuyển / cần</th>
          <th>Lý do</th>
          <th>Người đề nghị</th>
          <th>Trạng thái</th>
          {actions ? <th /> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-border">
            <td className="py-2">{row.code}</td>
            <td>{row.unit_name}</td>
            <td>{row.position}</td>
            <td>
              {row.hired_count} / {row.quantity}
            </td>
            <td>{row.reason}</td>
            <td>{row.requester_name}</td>
            <td>
              {REQUEST_STATUS_LABELS[row.status]}
              {row.approver_name ? ` (${row.approver_name})` : ''}
              {row.reject_reason ? `. Lý do: ${row.reject_reason}` : ''}
              {row.close_reason ? `. Lý do đóng: ${row.close_reason}` : ''}
            </td>
            {actions ? <td>{actions(row)}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- Tin tuyển dụng (P18-02) ----------

function PostingsTab({ canManage, onDone }: { canManage: boolean; onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ request_id: '', title: '', description: '', requirements: '', deadline: '' });
  const approved = useQuery({
    queryKey: ['recruitment-requests', 'approved'],
    queryFn: () => getJson<RecruitmentRequest[]>('/api/v1/recruitment-requests?view=all&status=approved'),
    enabled: canManage,
  });
  const postings = useQuery({
    queryKey: ['job-postings'],
    queryFn: () => getJson<JobPosting[]>('/api/v1/job-postings'),
  });
  const create = useMutation({
    mutationFn: () => postJson<JobPosting>('/api/v1/job-postings', form),
    onSuccess: async () => {
      setForm({ request_id: '', title: '', description: '', requirements: '', deadline: '' });
      await queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      onDone('Đã lưu tin tuyển dụng ở trạng thái đang soạn');
    },
  });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'close' }) =>
      postJson<JobPosting>(`/api/v1/job-postings/${id}/${action}`),
    onSuccess: async (posting) => {
      await queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      onDone(posting.status === 'published' ? `Đã công bố tin ${posting.title}` : `Đã đóng tin ${posting.title}`);
    },
  });
  const complete = form.request_id && form.title && form.description && form.requirements && form.deadline;
  return (
    <div className="flex flex-col gap-4">
      {postings.error || create.error || act.error ? (
        <Alert tone="danger">{messageOf(postings.error ?? create.error ?? act.error)}</Alert>
      ) : null}
      {canManage ? (
        <form
          aria-label="Soạn tin tuyển dụng"
          className="flex flex-col gap-3 rounded-lg bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-label font-medium text-text">
              Đề nghị đã duyệt
              <select
                className={selectClass}
                value={form.request_id}
                onChange={(event) => setForm({ ...form, request_id: event.target.value })}
              >
                <option value="">Chọn đề nghị</option>
                {(approved.data ?? []).map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.code} {request.position} ({request.unit_name})
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Tiêu đề tin"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
            <TextField
              label="Mô tả công việc"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
            <TextField
              label="Yêu cầu ứng viên"
              value={form.requirements}
              onChange={(event) => setForm({ ...form, requirements: event.target.value })}
            />
            <TextField
              label="Hạn nộp hồ sơ"
              type="date"
              min={vietnamToday()}
              value={form.deadline}
              onChange={(event) => setForm({ ...form, deadline: event.target.value })}
            />
          </div>
          <div>
            <Button type="submit" variant="primary" disabled={create.isPending || !complete}>
              Lưu tin
            </Button>
          </div>
        </form>
      ) : null}
      {(postings.data ?? []).length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có tin tuyển dụng nào</p>
      ) : (
        <table className="w-full text-content">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-2">Tiêu đề</th>
              <th>Đề nghị</th>
              <th>Hạn nộp</th>
              <th>Ứng viên</th>
              <th>Trạng thái</th>
              {canManage ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {(postings.data ?? []).map((posting) => (
              <tr key={posting.id} className="border-t border-border">
                <td className="py-2">{posting.title}</td>
                <td>
                  {posting.request_code} {posting.position}
                </td>
                <td>{posting.deadline}</td>
                <td>{posting.candidate_count}</td>
                <td>
                  {POSTING_STATUS_LABELS[posting.status]}
                  {posting.is_open ? ', đang nhận hồ sơ' : ''}
                </td>
                {canManage ? (
                  <td className="flex gap-2">
                    {posting.status === 'draft' ? (
                      <Button
                        variant="primary"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ id: posting.id, action: 'publish' })}
                      >
                        Công bố
                      </Button>
                    ) : null}
                    {posting.status !== 'closed' ? (
                      <Button
                        variant="text"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ id: posting.id, action: 'close' })}
                      >
                        Đóng tin
                      </Button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- Ứng viên, phỏng vấn, quyết định tuyển (P18-03, P18-04) ----------

function CandidatesTab({ onDone }: { onDone(message: string): void }) {
  const [postingId, setPostingId] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const postings = useQuery({
    queryKey: ['job-postings'],
    queryFn: () => getJson<JobPosting[]>('/api/v1/job-postings'),
  });
  const candidates = useQuery({
    queryKey: ['candidates', postingId],
    queryFn: () => getJson<CandidateRow[]>(`/api/v1/candidates${postingId ? `?posting_id=${postingId}` : ''}`),
  });
  return (
    <div className="flex flex-col gap-4">
      {candidates.error ? <Alert tone="danger">{messageOf(candidates.error)}</Alert> : null}
      <label className="flex max-w-md flex-col gap-2 text-label font-medium text-text">
        Lọc theo tin tuyển dụng
        <select className={selectClass} value={postingId} onChange={(event) => setPostingId(event.target.value)}>
          <option value="">Tất cả tin</option>
          {(postings.data ?? []).map((posting) => (
            <option key={posting.id} value={posting.id}>
              {posting.title}
            </option>
          ))}
        </select>
      </label>
      <AddCandidateForm postings={postings.data ?? []} onDone={onDone} />
      {(candidates.data ?? []).length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có ứng viên nào</p>
      ) : (
        <table className="w-full text-content">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-2">Họ tên</th>
              <th>Tin tuyển dụng</th>
              <th>Nguồn</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(candidates.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="py-2">{row.full_name}</td>
                <td>{row.posting_title}</td>
                <td>{SOURCE_LABELS[row.source]}</td>
                <td>{CANDIDATE_STATUS_LABELS[row.status]}</td>
                <td>
                  <Button variant="text" onClick={() => setSelectedId(row.id)}>
                    Xem hồ sơ {row.full_name}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {selectedId ? <CandidatePanel candidateId={selectedId} onDone={onDone} /> : null}
    </div>
  );
}

function AddCandidateForm({ postings, onDone }: { postings: JobPosting[]; onDone(message: string): void }) {
  const canManage = useHasPermission(PERMISSION_CODES.recruitmentManage);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ posting_id: '', full_name: '', phone: '', email: '', source: 'referral' });
  const create = useMutation({
    mutationFn: () => postJson<CandidateDetail>('/api/v1/candidates', { ...form, email: form.email || null }),
    onSuccess: async (created) => {
      setForm({ posting_id: '', full_name: '', phone: '', email: '', source: 'referral' });
      await queryClient.invalidateQueries({ queryKey: ['candidates'] });
      onDone(`Đã thêm ứng viên ${created.full_name}`);
    },
  });
  if (!canManage) {
    return null;
  }
  return (
    <form
      aria-label="Thêm ứng viên"
      className="flex flex-col gap-3 rounded-lg bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Tin ứng tuyển
          <select
            className={selectClass}
            value={form.posting_id}
            onChange={(event) => setForm({ ...form, posting_id: event.target.value })}
          >
            <option value="">Chọn tin</option>
            {postings
              .filter((posting) => posting.status !== 'draft')
              .map((posting) => (
                <option key={posting.id} value={posting.id}>
                  {posting.title}
                </option>
              ))}
          </select>
        </label>
        <TextField
          label="Họ tên ứng viên"
          value={form.full_name}
          onChange={(event) => setForm({ ...form, full_name: event.target.value })}
        />
        <TextField
          label="Điện thoại ứng viên"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
        <TextField
          label="Thư điện tử ứng viên"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Nguồn hồ sơ
          <select
            className={selectClass}
            value={form.source}
            onChange={(event) => setForm({ ...form, source: event.target.value as CandidateSource })}
          >
            {Object.entries(SOURCE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <Button
          type="submit"
          variant="primary"
          disabled={create.isPending || !form.posting_id || !form.full_name || !form.phone}
        >
          Thêm ứng viên
        </Button>
      </div>
    </form>
  );
}

function CandidatePanel({ candidateId, onDone }: { candidateId: string; onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ['candidate', candidateId],
    queryFn: () => getJson<CandidateDetail>(`/api/v1/candidates/${candidateId}`),
  });
  const [reason, setReason] = useState('');
  const [interview, setInterview] = useState({ scheduled_at: '', location: '', interviewer: '' });
  const [result, setResult] = useState({ score: '', evaluation: '' });
  const [decisionNote, setDecisionNote] = useState('');
  const [staffForm, setStaffForm] = useState({ code: '', start_date: vietnamToday() });
  const [error, setError] = useState<string>();
  const candidate = detail.data;
  const staff = useQuery({
    queryKey: ['staff', candidate?.org_unit_id],
    queryFn: () => listStaff(candidate?.org_unit_id ?? '', ''),
    enabled: Boolean(candidate?.can_interview),
  });
  const run = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      setError(undefined);
      await queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] });
      await queryClient.invalidateQueries({ queryKey: ['candidates'] });
      onDone('Đã cập nhật hồ sơ ứng viên');
    },
    onError: (failure) => setError(messageOf(failure)),
  });
  if (detail.error) {
    return <Alert tone="danger">{messageOf(detail.error)}</Alert>;
  }
  if (!candidate) {
    return null;
  }
  const scheduled = candidate.interviews.find((item) => item.status === 'scheduled');
  return (
    <section
      aria-label={`Hồ sơ ứng viên ${candidate.full_name}`}
      className="flex flex-col gap-3 rounded-lg bg-card p-4"
    >
      <h2 className="text-section-title font-semibold text-text">{candidate.full_name}</h2>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <dl className="grid grid-cols-1 gap-2 text-content md:grid-cols-3">
        <div>
          <dt className="text-text-secondary">Trạng thái</dt>
          <dd>
            {CANDIDATE_STATUS_LABELS[candidate.status]}
            {candidate.status_reason ? `. ${candidate.status_reason}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">Điện thoại</dt>
          <dd>{candidate.phone}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Thư điện tử</dt>
          <dd>{candidate.email ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Vị trí</dt>
          <dd>{candidate.position}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Thư giới thiệu</dt>
          <dd>{candidate.cover_letter ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Hồ sơ nhân sự</dt>
          <dd>{candidate.staff_code ?? '—'}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-end gap-2">
        {candidate.cv_file_id ? (
          <Button
            variant="secondary"
            onClick={() => openCv(candidateId).catch((failure) => setError(messageOf(failure)))}
          >
            Mở hồ sơ xin việc
          </Button>
        ) : null}
        {candidate.can_manage && !['hired', 'rejected', 'withdrawn'].includes(candidate.status) ? (
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Tải hồ sơ xin việc
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  run.mutate(() => uploadCv(candidateId, file));
                }
              }}
            />
          </label>
        ) : null}
      </div>
      {candidate.can_manage && ['new', 'screening', 'interviewing'].includes(candidate.status) ? (
        <div className="flex flex-wrap items-end gap-2">
          {candidate.status === 'new' ? (
            <Button
              variant="primary"
              onClick={() =>
                run.mutate(() => postJson(`/api/v1/candidates/${candidateId}/status`, { status: 'screening' }))
              }
            >
              Chuyển sàng lọc
            </Button>
          ) : null}
          <TextField label="Lý do loại hoặc rút" value={reason} onChange={(event) => setReason(event.target.value)} />
          {candidate.status !== 'interviewing' ? (
            <Button
              variant="text"
              disabled={!reason}
              onClick={() =>
                run.mutate(() => postJson(`/api/v1/candidates/${candidateId}/status`, { status: 'rejected', reason }))
              }
            >
              Loại hồ sơ
            </Button>
          ) : null}
          <Button
            variant="text"
            disabled={!reason}
            onClick={() =>
              run.mutate(() => postJson(`/api/v1/candidates/${candidateId}/status`, { status: 'withdrawn', reason }))
            }
          >
            Ứng viên rút hồ sơ
          </Button>
        </div>
      ) : null}
      <h3 className="text-label font-semibold text-text">Phỏng vấn</h3>
      {candidate.interviews.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có lịch phỏng vấn</p>
      ) : null}
      <ul className="flex flex-col gap-1 text-content">
        {candidate.interviews.map((item) => (
          <li key={item.id}>
            Vòng {item.round}: {new Date(item.scheduled_at).toLocaleString('vi-VN')} tại {item.location}, người phỏng
            vấn {item.interviewers.map((person) => person.full_name).join(', ')}.{' '}
            {item.status === 'completed'
              ? `${item.result === 'passed' ? 'Đạt' : 'Không đạt'}${item.score !== null ? `, ${item.score} điểm` : ''}: ${item.evaluation ?? ''}`
              : item.status === 'cancelled'
                ? `Đã hủy: ${item.cancel_reason ?? ''}`
                : 'Chờ phỏng vấn'}
          </li>
        ))}
      </ul>
      {candidate.can_interview &&
      (candidate.status === 'screening' || candidate.status === 'interviewing') &&
      !scheduled ? (
        <div className="flex flex-wrap items-end gap-2">
          <TextField
            label="Thời điểm phỏng vấn"
            type="datetime-local"
            value={interview.scheduled_at}
            onChange={(event) => setInterview({ ...interview, scheduled_at: event.target.value })}
          />
          <TextField
            label="Địa điểm phỏng vấn"
            value={interview.location}
            onChange={(event) => setInterview({ ...interview, location: event.target.value })}
          />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Người phỏng vấn
            <select
              className={selectClass}
              value={interview.interviewer}
              onChange={(event) => setInterview({ ...interview, interviewer: event.target.value })}
            >
              <option value="">Chọn nhân sự</option>
              {(staff.data ?? [])
                .filter((person) => person.status === 'active')
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                  </option>
                ))}
            </select>
          </label>
          <Button
            variant="primary"
            disabled={!interview.scheduled_at || !interview.location || !interview.interviewer}
            onClick={() =>
              run.mutate(() =>
                postJson(`/api/v1/candidates/${candidateId}/interviews`, {
                  scheduled_at: new Date(interview.scheduled_at).toISOString(),
                  location: interview.location,
                  interviewer_staff_ids: [interview.interviewer],
                }),
              )
            }
          >
            Lên lịch phỏng vấn
          </Button>
        </div>
      ) : null}
      {candidate.can_interview && scheduled ? (
        <div className="flex flex-wrap items-end gap-2">
          <TextField
            label="Điểm phỏng vấn"
            value={result.score}
            onChange={(event) => setResult({ ...result, score: event.target.value })}
          />
          <TextField
            label="Đánh giá"
            value={result.evaluation}
            onChange={(event) => setResult({ ...result, evaluation: event.target.value })}
          />
          {(['passed', 'failed'] as const).map((value) => (
            <Button
              key={value}
              variant={value === 'passed' ? 'primary' : 'text'}
              disabled={!result.evaluation}
              onClick={() =>
                run.mutate(() =>
                  postJson(`/api/v1/interviews/${scheduled.id}/result`, {
                    result: value,
                    score: result.score ? Number(result.score.replace(',', '.')) : null,
                    evaluation: result.evaluation,
                  }),
                )
              }
            >
              {value === 'passed' ? 'Ghi kết quả đạt' : 'Ghi kết quả không đạt'}
            </Button>
          ))}
        </div>
      ) : null}
      {candidate.can_interview && candidate.status === 'interviewing' && !scheduled ? (
        <div className="flex flex-wrap items-end gap-2">
          <TextField
            label="Ghi chú quyết định"
            value={decisionNote}
            onChange={(event) => setDecisionNote(event.target.value)}
          />
          <Button
            variant="primary"
            onClick={() =>
              run.mutate(() =>
                postJson(`/api/v1/candidates/${candidateId}/decision`, { result: 'hired', note: decisionNote || null }),
              )
            }
          >
            Quyết định tuyển
          </Button>
          <Button
            variant="text"
            disabled={!decisionNote}
            onClick={() =>
              run.mutate(() =>
                postJson(`/api/v1/candidates/${candidateId}/decision`, { result: 'rejected', note: decisionNote }),
              )
            }
          >
            Không tuyển
          </Button>
        </div>
      ) : null}
      {candidate.can_manage && candidate.status === 'hired' && !candidate.staff_id ? (
        <div className="flex flex-wrap items-end gap-2">
          <TextField
            label="Mã nhân sự mới"
            value={staffForm.code}
            onChange={(event) => setStaffForm({ ...staffForm, code: event.target.value })}
          />
          <TextField
            label="Ngày vào làm"
            type="date"
            value={staffForm.start_date}
            onChange={(event) => setStaffForm({ ...staffForm, start_date: event.target.value })}
          />
          <Button
            variant="primary"
            disabled={!staffForm.code || !staffForm.start_date}
            onClick={() => run.mutate(() => postJson(`/api/v1/candidates/${candidateId}/staff`, staffForm))}
          >
            Tạo hồ sơ nhân sự
          </Button>
        </div>
      ) : null}
    </section>
  );
}
