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
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { FormButtons, FormPanel } from '../pages/FormPanel.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { matchesSearch } from '../pages/grid-search.js';
import { menuPageTitle } from '../pages/page-title.js';
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
// và công bố tin, tiếp nhận và sàng lọc ứng viên, phỏng vấn, quyết định tuyển, tạo hồ sơ nhân sự từ ứng viên đã tuyển.
// Giao diện chung theo Sở (DT-15 phần 15f3, YCTD-115): đề nghị, đề nghị chờ duyệt, tin tuyển dụng và ứng viên là lưới dữ
// liệu chung (khóa `recruitment-requests`, `recruitment-approvals`, `job-postings`, `candidates`); lập đề nghị, soạn tin và
// thêm ứng viên bằng biểu mẫu theo khối có nút Ghi; hồ sơ ứng viên giữ dạng trang chi tiết dưới lưới
type Tab = 'requests' | 'pending' | 'postings' | 'candidates';
type Notify = (message: string) => void;

const selectClass = 'rounded-lg border border-border bg-card px-3 py-2 text-content';
const filterClass = `mt-1 ${FORM_CONTROL_CLASS}`;
const actionInputClass = 'w-40 rounded-lg border border-border bg-card px-3 py-2 text-content text-text';

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
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/recruitment')}</h1>
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

const REQUEST_COLUMNS: Array<DataGridColumn<RecruitmentRequest>> = [
  { id: 'code', header: 'Mã', alwaysVisible: true, className: 'font-medium', cell: (row) => row.code },
  { id: 'unit_name', header: 'Đơn vị', cell: (row) => row.unit_name },
  { id: 'position', header: 'Vị trí', cell: (row) => row.position },
  { id: 'hired', header: 'Đã tuyển / cần', cell: (row) => `${row.hired_count} / ${row.quantity}` },
  { id: 'requirements', header: 'Yêu cầu', hiddenByDefault: true, cell: (row) => row.requirements },
  { id: 'reason', header: 'Lý do', cell: (row) => row.reason },
  { id: 'needed_by', header: 'Cần người trước ngày', hiddenByDefault: true, cell: (row) => row.needed_by ?? '' },
  { id: 'requester_name', header: 'Người đề nghị', cell: (row) => row.requester_name },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) =>
      `${REQUEST_STATUS_LABELS[row.status]}${row.approver_name ? ` (${row.approver_name})` : ''}${row.reject_reason ? `. Lý do: ${row.reject_reason}` : ''}${row.close_reason ? `. Lý do đóng: ${row.close_reason}` : ''}`,
  },
];

// Lưới đề nghị tuyển dụng dùng chung cho tab đề nghị và tab chờ duyệt
function RequestGrid({
  label,
  gridKey,
  rows,
  loading,
  toolbar,
  actions,
}: {
  label: string;
  gridKey: DataGridKey;
  rows: RecruitmentRequest[];
  loading: boolean;
  toolbar?: ReactNode;
  actions(row: RecruitmentRequest): ReactNode;
}) {
  const grid = useGridSettings(gridKey);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RecruitmentRequest['status'] | ''>('');
  const shown = rows.filter(
    (row) =>
      (status === '' || row.status === status) &&
      matchesSearch(search, row.code, row.unit_name, row.position, row.requester_name),
  );
  return (
    <>
      {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
      <DataGrid
        label={label}
        columns={REQUEST_COLUMNS}
        rows={shown}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `đề nghị ${row.code}`}
        loading={loading}
        emptyText="Chưa có đề nghị nào"
        search={{ label: 'Tìm theo mã, đơn vị, vị trí, người đề nghị', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Trạng thái đề nghị
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(REQUEST_STATUS_LABELS).map(([code, text]) => (
                  <option key={code} value={code}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        toolbar={toolbar}
        rowActions={actions}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </>
  );
}

function RequestForm({ onSaved, onCancel }: { onSaved(created: RecruitmentRequest): void; onCancel(): void }) {
  const unitChoice = useUnitChoice();
  const [form, setForm] = useState({ position: '', quantity: '1', requirements: '', reason: '', needed_by: '' });
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
    onSuccess: onSaved,
  });
  const complete = form.position && form.quantity && form.requirements && form.reason;
  return (
    <form
      aria-label="Lập đề nghị tuyển dụng"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Lập đề nghị tuyển dụng">
        <FormRow label="Đơn vị">
          <select
            className={FORM_CONTROL_CLASS}
            value={unitChoice.selectedId ?? ''}
            onChange={(event) => unitChoice.select(event.target.value)}
          >
            {unitChoice.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Vị trí cần tuyển">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.position}
            onChange={(event) => setForm({ ...form, position: event.target.value })}
          />
        </FormRow>
        <FormRow label="Số lượng">
          <input
            type="number"
            min={1}
            className={FORM_CONTROL_CLASS}
            value={form.quantity}
            onChange={(event) => setForm({ ...form, quantity: event.target.value })}
          />
        </FormRow>
        <FormRow label="Yêu cầu">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.requirements}
            onChange={(event) => setForm({ ...form, requirements: event.target.value })}
          />
        </FormRow>
        <FormRow label="Lý do tuyển">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
          />
        </FormRow>
        <FormRow label="Cần người trước ngày">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={form.needed_by}
            onChange={(event) => setForm({ ...form, needed_by: event.target.value })}
          />
        </FormRow>
      </FormBlock>
      <FormButtons busy={create.isPending} disabled={!complete || !unitChoice.selectedId} onCancel={onCancel} />
    </form>
  );
}

function RequestsTab({ canCreate, onDone }: { canCreate: boolean; onDone: Notify }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [closeReasons, setCloseReasons] = useState<Record<string, string>>({});
  const requests = useQuery({
    queryKey: ['recruitment-requests', 'all'],
    queryFn: () => getJson<RecruitmentRequest[]>('/api/v1/recruitment-requests?view=all'),
  });
  const mine = useQuery({
    queryKey: ['recruitment-requests', 'mine'],
    queryFn: () => getJson<RecruitmentRequest[]>('/api/v1/recruitment-requests?view=mine'),
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
  return (
    <div className="flex flex-col gap-4">
      {close.error ? <Alert tone="danger">{messageOf(close.error)}</Alert> : null}
      {canCreate && creating ? (
        <FormPanel>
          <RequestForm
            onCancel={() => setCreating(false)}
            onSaved={async (created) => {
              setCreating(false);
              await queryClient.invalidateQueries({ queryKey: ['recruitment-requests'] });
              onDone(`Đã gửi đề nghị ${created.code}, chờ Ban Giám hiệu duyệt`);
            }}
          />
        </FormPanel>
      ) : null}
      <RequestGrid
        label="Đề nghị tuyển dụng"
        gridKey="recruitment-requests"
        rows={rows}
        loading={requests.isPending && mine.isPending}
        toolbar={
          canCreate ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        actions={(row) =>
          row.status === 'pending' || row.status === 'approved' ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <input
                aria-label="Lý do đóng"
                placeholder="Lý do đóng"
                className={actionInputClass}
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

function PendingTab({ onDone }: { onDone: Notify }) {
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
      <RequestGrid
        label="Đề nghị chờ duyệt"
        gridKey="recruitment-approvals"
        rows={pending.data ?? []}
        loading={pending.isPending}
        actions={(row) => (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="primary"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: row.id, approve: true })}
            >
              Duyệt
            </Button>
            <input
              aria-label="Lý do từ chối"
              placeholder="Lý do từ chối"
              className={actionInputClass}
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

// ---------- Tin tuyển dụng (P18-02) ----------

const POSTING_COLUMNS: Array<DataGridColumn<JobPosting>> = [
  { id: 'title', header: 'Tiêu đề', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
  { id: 'request', header: 'Đề nghị', cell: (row) => `${row.request_code} ${row.position}` },
  { id: 'unit_name', header: 'Đơn vị', hiddenByDefault: true, cell: (row) => row.unit_name },
  { id: 'deadline', header: 'Hạn nộp', cell: (row) => row.deadline },
  { id: 'candidate_count', header: 'Ứng viên', cell: (row) => row.candidate_count },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => `${POSTING_STATUS_LABELS[row.status]}${row.is_open ? ', đang nhận hồ sơ' : ''}`,
  },
];

function PostingForm({ onSaved, onCancel }: { onSaved(): void; onCancel(): void }) {
  const [form, setForm] = useState({ request_id: '', title: '', description: '', requirements: '', deadline: '' });
  const approved = useQuery({
    queryKey: ['recruitment-requests', 'approved'],
    queryFn: () => getJson<RecruitmentRequest[]>('/api/v1/recruitment-requests?view=all&status=approved'),
  });
  const create = useMutation({
    mutationFn: () => postJson<JobPosting>('/api/v1/job-postings', form),
    onSuccess: onSaved,
  });
  const complete = form.request_id && form.title && form.description && form.requirements && form.deadline;
  return (
    <form
      aria-label="Soạn tin tuyển dụng"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Soạn tin tuyển dụng">
        <FormRow label="Đề nghị đã duyệt">
          <select
            className={FORM_CONTROL_CLASS}
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
        </FormRow>
        <FormRow label="Tiêu đề tin">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </FormRow>
        <FormRow label="Mô tả công việc">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </FormRow>
        <FormRow label="Yêu cầu ứng viên">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.requirements}
            onChange={(event) => setForm({ ...form, requirements: event.target.value })}
          />
        </FormRow>
        <FormRow label="Hạn nộp hồ sơ">
          <input
            type="date"
            min={vietnamToday()}
            className={FORM_CONTROL_CLASS}
            value={form.deadline}
            onChange={(event) => setForm({ ...form, deadline: event.target.value })}
          />
        </FormRow>
      </FormBlock>
      <FormButtons busy={create.isPending} disabled={!complete} onCancel={onCancel} />
    </form>
  );
}

function PostingsTab({ canManage, onDone }: { canManage: boolean; onDone: Notify }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('job-postings');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<JobPosting['status'] | ''>('');
  const postings = useQuery({
    queryKey: ['job-postings'],
    queryFn: () => getJson<JobPosting[]>('/api/v1/job-postings'),
  });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'close' }) =>
      postJson<JobPosting>(`/api/v1/job-postings/${id}/${action}`),
    onSuccess: async (posting) => {
      await queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      onDone(posting.status === 'published' ? `Đã công bố tin ${posting.title}` : `Đã đóng tin ${posting.title}`);
    },
  });
  const error = postings.error ?? act.error ?? grid.error;
  const rows = (postings.data ?? []).filter(
    (posting) =>
      (status === '' || posting.status === status) &&
      matchesSearch(search, posting.title, posting.request_code, posting.position),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canManage && creating ? (
        <FormPanel>
          <PostingForm
            onCancel={() => setCreating(false)}
            onSaved={async () => {
              setCreating(false);
              await queryClient.invalidateQueries({ queryKey: ['job-postings'] });
              onDone('Đã lưu tin tuyển dụng ở trạng thái đang soạn');
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label="Tin tuyển dụng"
        columns={POSTING_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `tin ${row.title}`}
        loading={postings.isPending}
        emptyText="Chưa có tin tuyển dụng nào"
        search={{ label: 'Tìm theo tiêu đề, mã đề nghị, vị trí', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Trạng thái tin
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className={filterClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(POSTING_STATUS_LABELS).map(([code, text]) => (
                  <option key={code} value={code}>
                    {text}
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
        rowActions={
          canManage
            ? (posting) => (
                <span className="flex justify-end gap-2">
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
                </span>
              )
            : undefined
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

// ---------- Ứng viên, phỏng vấn, quyết định tuyển (P18-03, P18-04) ----------

const CANDIDATE_COLUMNS: Array<DataGridColumn<CandidateRow>> = [
  { id: 'full_name', header: 'Họ tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'posting_title', header: 'Tin tuyển dụng', cell: (row) => row.posting_title },
  { id: 'source', header: 'Nguồn', cell: (row) => SOURCE_LABELS[row.source] },
  { id: 'has_cv', header: 'Hồ sơ xin việc', hiddenByDefault: true, cell: (row) => (row.has_cv ? 'Có' : 'Chưa có') },
  {
    id: 'created_at',
    header: 'Ngày nộp',
    hiddenByDefault: true,
    cell: (row) => new Date(row.created_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
  },
  { id: 'status', header: 'Trạng thái', cell: (row) => CANDIDATE_STATUS_LABELS[row.status] },
];

function CandidatesTab({ onDone }: { onDone: Notify }) {
  const canManage = useHasPermission(PERMISSION_CODES.recruitmentManage);
  const grid = useGridSettings('candidates');
  const [postingId, setPostingId] = useState('');
  const [status, setStatus] = useState<CandidateRow['status'] | ''>('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const postings = useQuery({
    queryKey: ['job-postings'],
    queryFn: () => getJson<JobPosting[]>('/api/v1/job-postings'),
  });
  const candidates = useQuery({
    queryKey: ['candidates', postingId],
    queryFn: () => getJson<CandidateRow[]>(`/api/v1/candidates${postingId ? `?posting_id=${postingId}` : ''}`),
  });
  const error = candidates.error ?? grid.error;
  const rows = (candidates.data ?? []).filter(
    (row) => (status === '' || row.status === status) && matchesSearch(search, row.full_name, row.posting_title),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {canManage && creating ? (
        <FormPanel>
          <AddCandidateForm
            postings={postings.data ?? []}
            onCancel={() => setCreating(false)}
            onDone={(message) => {
              setCreating(false);
              onDone(message);
            }}
          />
        </FormPanel>
      ) : null}
      <DataGrid
        label="Ứng viên"
        columns={CANDIDATE_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `ứng viên ${row.full_name}`}
        loading={candidates.isPending}
        emptyText="Chưa có ứng viên nào"
        search={{ label: 'Tìm theo họ tên, tin tuyển dụng', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Lọc theo tin tuyển dụng
              <select className={filterClass} value={postingId} onChange={(event) => setPostingId(event.target.value)}>
                <option value="">Tất cả tin</option>
                {(postings.data ?? []).map((posting) => (
                  <option key={posting.id} value={posting.id}>
                    {posting.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Trạng thái ứng viên
              <select
                className={filterClass}
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
              >
                <option value="">Tất cả</option>
                {Object.entries(CANDIDATE_STATUS_LABELS).map(([code, text]) => (
                  <option key={code} value={code}>
                    {text}
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
        rowActions={(row) => (
          <Button variant="text" onClick={() => setSelectedId(row.id)}>
            Xem hồ sơ {row.full_name}
          </Button>
        )}
        activeRowId={selectedId}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      {selectedId ? <CandidatePanel key={selectedId} candidateId={selectedId} onDone={onDone} /> : null}
    </div>
  );
}

function AddCandidateForm({
  postings,
  onDone,
  onCancel,
}: {
  postings: JobPosting[];
  onDone: Notify;
  onCancel(): void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ posting_id: '', full_name: '', phone: '', email: '', source: 'referral' });
  const create = useMutation({
    mutationFn: () => postJson<CandidateDetail>('/api/v1/candidates', { ...form, email: form.email || null }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['candidates'] });
      onDone(`Đã thêm ứng viên ${created.full_name}`);
    },
  });
  return (
    <form
      aria-label="Thêm ứng viên"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <FormBlock title="Thêm ứng viên">
        <FormRow label="Tin ứng tuyển">
          <select
            className={FORM_CONTROL_CLASS}
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
        </FormRow>
        <FormRow label="Họ tên ứng viên">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.full_name}
            onChange={(event) => setForm({ ...form, full_name: event.target.value })}
          />
        </FormRow>
        <FormRow label="Điện thoại ứng viên">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </FormRow>
        <FormRow label="Thư điện tử ứng viên">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </FormRow>
        <FormRow label="Nguồn hồ sơ">
          <select
            className={FORM_CONTROL_CLASS}
            value={form.source}
            onChange={(event) => setForm({ ...form, source: event.target.value as CandidateSource })}
          >
            {Object.entries(SOURCE_LABELS).map(([code, text]) => (
              <option key={code} value={code}>
                {text}
              </option>
            ))}
          </select>
        </FormRow>
      </FormBlock>
      <FormButtons
        busy={create.isPending}
        disabled={!form.posting_id || !form.full_name || !form.phone}
        onCancel={onCancel}
      />
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
