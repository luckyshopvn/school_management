import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KPI_SCHOOL_LEVELS,
  PROFESSIONAL_ACTION_LABELS,
  PROFESSIONAL_APPROVAL_FLOW_LABELS,
  PROFESSIONAL_BRANCH_LABELS,
  PROFESSIONAL_STATUS_LABELS,
  type KpiSchoolLevelCode,
  type PortalQuickLinkPath,
  type ProfessionalApprovalFlowCode,
  type ProfessionalBranchCode,
  type ProfessionalDocumentStatusCode,
} from '@school-management/shared';
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
  type StatusTone,
} from '@school-management/ui';
import { fieldErrorsOf, formatDate, messageOf, selectClass } from '../archives/archive-ui.js';
import { formatDateTime, Page, Tabs, todayText, useToast } from '../directives/directive-ui.js';
import { useGridSettings } from '../pages/grid-settings.js';
import {
  createProfessionalDocument,
  deleteProfessionalDocument,
  deleteProfessionalFolder,
  downloadProfessionalVersion,
  downloadSignedProfessional,
  listProfessionalDocuments,
  listProfessionalFolders,
  listProfessionalRounds,
  listWorkGroups,
  loadDefaultFolders,
  professionalAction,
  readProfessionalDocument,
  readProfessionalOptions,
  readProfessionalOverview,
  readProfessionalStatistics,
  readRoundStatus,
  roundAction,
  saveProfessionalFolder,
  saveProfessionalRound,
  saveWorkGroup,
  setProfessionalLock,
  uploadProfessionalVersion,
  type FolderInput,
  type ProfessionalDocument,
  type ProfessionalDocumentDetail,
  type ProfessionalFolder,
  type ProfessionalRound,
  type RoundInput,
  type RoundSubmitter,
  type WorkGroup,
} from './professional-api.js';

// Hồ sơ chuyên môn (DT-18 phần 18e, YCTD-142) theo mô tả công khai của GIKIDI Nhà Trường: kho ba nhánh (cá nhân, tổ hoặc
// nhóm, trường) theo năm học, đợt nộp có hạn, luồng duyệt theo thư mục (tổ trưởng, Ban Giám hiệu), trả lại, phiên bản khi
// nộp lại, kí nội bộ, thống kê nộp đúng hạn, trễ, chưa nộp; thư mục, nhóm công tác, khóa năm học
const STATUS_TONES: Record<ProfessionalDocumentStatusCode, StatusTone> = {
  draft: 'neutral',
  pending_leader: 'info',
  pending_approval: 'info',
  approved: 'success',
  returned: 'warning',
};
const STATE_LABELS: Record<RoundSubmitter['state'], string> = {
  on_time: 'Nộp đúng hạn',
  late: 'Nộp trễ',
  draft: 'Chưa nộp (đã tạo hồ sơ)',
  missing: 'Chưa nộp',
};
const STATE_TONES: Record<RoundSubmitter['state'], StatusTone> = {
  on_time: 'success',
  late: 'warning',
  draft: 'danger',
  missing: 'danger',
};

function useOverview() {
  return useQuery({ queryKey: ['professional', 'overview'], queryFn: readProfessionalOverview });
}

// Cây thư mục thành danh sách thụt lề theo cấp để chọn
function folderOptions(folders: ProfessionalFolder[]): Array<{ id: string; label: string }> {
  const result: Array<{ id: string; label: string }> = [];
  const walk = (parent: string | null, depth: number) => {
    for (const folder of folders.filter((item) => item.parent_id === parent)) {
      result.push({ id: folder.id, label: `${'— '.repeat(depth)}${folder.name}` });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return result;
}

function LockNotice() {
  const overview = useOverview();
  return overview.data?.locked ? (
    <Alert tone="warning">
      Năm học đã khóa hồ sơ chuyên môn
      {overview.data.locked_by_name ? ` (${overview.data.locked_by_name})` : ''}: chỉ xem, tải tệp; không thêm, nộp,
      duyệt.
    </Alert>
  ) : null;
}

// ---- Chi tiết hồ sơ ----

export function DocumentPanel({ id, onChanged }: { id: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['professional-document', id], queryFn: () => readProfessionalDocument(id) });
  const [file, setFile] = useState<File>();
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'return' | 'approve' | 'leader-approve' | 'submit'>();
  const apply = (next: ProfessionalDocumentDetail, message: string) => {
    queryClient.setQueryData(['professional-document', id], next);
    void queryClient.invalidateQueries({ queryKey: ['professional-documents'] });
    void queryClient.invalidateQueries({ queryKey: ['professional-rounds'] });
    void queryClient.invalidateQueries({ queryKey: ['my-work'] });
    setMode(undefined);
    setNote('');
    onChanged(message);
  };
  const upload = useMutation({
    mutationFn: () => uploadProfessionalVersion(id, file as File, note),
    onSuccess: (next) => {
      setFile(undefined);
      apply(next, `Đã tải phiên bản ${next.current_version}`);
    },
  });
  const action = useMutation({
    mutationFn: (kind: 'submit' | 'withdraw' | 'leader-approve' | 'approve' | 'return') =>
      professionalAction(id, kind, note || undefined),
    onSuccess: (next, kind) =>
      apply(
        next,
        {
          submit: 'Đã nộp hồ sơ',
          withdraw: 'Đã rút lại hồ sơ',
          'leader-approve': 'Tổ trưởng đã duyệt',
          approve: 'Đã duyệt hồ sơ',
          return: 'Đã trả lại hồ sơ',
        }[kind],
      ),
  });
  const document = detail.data;
  if (detail.error) {
    return <Alert tone="danger">{messageOf(detail.error)}</Alert>;
  }
  if (!document) {
    return <p className="text-content text-text-secondary">Đang tải…</p>;
  }
  const actions = document.actions;
  return (
    <div className="flex flex-col gap-3" aria-label={`Chi tiết hồ sơ ${document.title}`}>
      {upload.error ? <Alert tone="danger">{messageOf(upload.error)}</Alert> : null}
      {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
      {document.status === 'returned' && document.return_note ? (
        <Alert tone="warning">Lý do trả lại: {document.return_note}</Alert>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-content md:grid-cols-[12rem_minmax(0,1fr)]">
        <dt className="font-medium">Thư mục</dt>
        <dd>
          {PROFESSIONAL_BRANCH_LABELS[document.branch]}: {document.folder_name}
        </dd>
        <dt className="font-medium">Luồng duyệt</dt>
        <dd>
          {PROFESSIONAL_APPROVAL_FLOW_LABELS[document.approval_flow]}
          {document.requires_signing ? '; kí nội bộ khi duyệt' : ''}
        </dd>
        <dt className="font-medium">Người nộp</dt>
        <dd>
          {document.owner_name}
          {document.department_name ? ` – ${document.department_name}` : ''}
          {document.work_group_name ? ` – ${document.work_group_name}` : ''}
        </dd>
        {document.round_title ? (
          <>
            <dt className="font-medium">Đợt nộp</dt>
            <dd>
              {document.round_title}, hạn {document.round_due_at ? formatDateTime(document.round_due_at) : ''}
            </dd>
          </>
        ) : null}
        {document.submitted_at ? (
          <>
            <dt className="font-medium">Nộp lần đầu</dt>
            <dd>
              {formatDateTime(document.submitted_at)}
              {document.submitted_late ? ' (nộp trễ)' : ''}
            </dd>
          </>
        ) : null}
        {document.leader_name ? (
          <>
            <dt className="font-medium">Tổ trưởng duyệt</dt>
            <dd>{document.leader_name}</dd>
          </>
        ) : null}
        {document.approved_by_name ? (
          <>
            <dt className="font-medium">Người duyệt</dt>
            <dd>
              {document.approved_by_name}
              {document.approved_at ? `, ${formatDateTime(document.approved_at)}` : ''}
            </dd>
          </>
        ) : null}
      </dl>
      {document.signed_file_id ? (
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="success" label="Đã kí nội bộ" />
          <Button variant="secondary" onClick={() => void downloadSignedProfessional(id)}>
            Tải bản đã kí
          </Button>
          <span className="text-label text-text-secondary">{document.signer_description}</span>
        </span>
      ) : null}
      <h3 className="text-content font-semibold">Phiên bản</h3>
      <ul className="flex flex-col gap-1 text-content">
        {document.versions.length === 0 ? <li className="text-text-secondary">Chưa có tệp</li> : null}
        {document.versions.map((version) => (
          <li key={version.id} className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="info" label={`Phiên bản ${version.version_no}`} />
            <Button variant="text" onClick={() => void downloadProfessionalVersion(id, version)}>
              {version.file_name}
            </Button>
            <span className="text-text-secondary">
              {version.created_by_name}, {formatDateTime(version.created_at)}
              {version.note ? `: ${version.note}` : ''}
            </span>
          </li>
        ))}
      </ul>
      {actions.upload ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
          <label className="text-label font-medium text-text">
            Tệp hồ sơ (PDF, Word, Excel, ảnh; tối đa 20 MB)
            <input
              type="file"
              className={selectClass}
              onChange={(event) => setFile(event.target.files?.[0] ?? undefined)}
            />
          </label>
          <label className="text-label font-medium text-text">
            Ghi chú phiên bản
            <input className={selectClass} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <Button variant="secondary" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
            Tải phiên bản mới
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {actions.submit ? (
          <Button variant="primary" disabled={action.isPending} onClick={() => action.mutate('submit')}>
            {document.status === 'returned' ? 'Nộp lại' : 'Nộp hồ sơ'}
          </Button>
        ) : null}
        {actions.withdraw ? (
          <Button variant="secondary" onClick={() => action.mutate('withdraw')}>
            Rút lại
          </Button>
        ) : null}
        {actions.leader_approve ? (
          <Button variant="primary" onClick={() => setMode('leader-approve')}>
            Tổ trưởng duyệt
          </Button>
        ) : null}
        {actions.approve ? (
          <Button variant="primary" onClick={() => setMode('approve')}>
            {document.requires_signing ? 'Duyệt và kí' : 'Duyệt'}
          </Button>
        ) : null}
        {actions.return ? (
          <Button variant="secondary" onClick={() => setMode('return')}>
            Trả lại
          </Button>
        ) : null}
      </div>
      {mode ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <label className="text-label font-medium text-text">
            {mode === 'return' ? 'Lý do trả lại' : 'Ý kiến'}
            <textarea className={selectClass} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
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
        {document.events.map((event) => (
          <li key={event.id}>
            {formatDateTime(event.created_at)} – <span className="font-medium">{event.actor_name}</span>:{' '}
            {PROFESSIONAL_ACTION_LABELS[event.action] ?? event.action}
            {event.note ? `. ${event.note}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Thêm hồ sơ ----

function DocumentForm({
  branch,
  onSaved,
  onCancel,
}: {
  branch: ProfessionalBranchCode;
  onSaved(id: string, title: string): void;
  onCancel(): void;
}) {
  const overview = useOverview();
  const folders = useQuery({
    queryKey: ['professional-folders', branch],
    queryFn: () => listProfessionalFolders(branch),
  });
  const rounds = useQuery({ queryKey: ['professional-rounds', 'open'], queryFn: () => listProfessionalRounds('open') });
  const [values, setValues] = useState({ folder_id: '', round_id: '', title: '', description: '', owner: '' });
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: () => {
      const [kind, ownerId] = values.owner.split(':');
      return createProfessionalDocument({
        folder_id: values.folder_id,
        round_id: values.round_id || null,
        title: values.title,
        description: values.description || null,
        department_id: kind === 'department' ? ownerId : null,
        work_group_id: kind === 'work_group' ? ownerId : null,
      });
    },
    onSuccess: (created) => onSaved(created.id, values.title),
  });
  const errors = fieldErrorsOf(save.error);
  const folderRounds = (rounds.data ?? []).filter((round) => round.folder_id === values.folder_id);
  return (
    <form
      noValidate
      aria-label="Thêm hồ sơ chuyên môn"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin hồ sơ">
        <FormRow label="Thư mục" error={errors.folder_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.folder_id}
            onChange={(event) => set('folder_id', event.target.value)}
          >
            <option value="">— Chọn thư mục —</option>
            {folderOptions(folders.data ?? []).map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.label}
              </option>
            ))}
          </select>
        </FormRow>
        {branch === 'group' ? (
          <FormRow label="Tổ, nhóm" error={errors.department_id ?? errors.work_group_id}>
            <select
              className={FORM_CONTROL_CLASS}
              value={values.owner}
              onChange={(event) => set('owner', event.target.value)}
            >
              <option value="">Tổ chuyên môn của tôi</option>
              {(overview.data?.my_groups ?? []).map((group) => (
                <option key={`${group.kind}:${group.id}`} value={`${group.kind}:${group.id}`}>
                  {group.kind === 'department' ? 'Tổ' : 'Nhóm'} {group.name}
                </option>
              ))}
            </select>
          </FormRow>
        ) : null}
        {folderRounds.length > 0 ? (
          <FormRow label="Đợt nộp" error={errors.round_id}>
            <select
              className={FORM_CONTROL_CLASS}
              value={values.round_id}
              onChange={(event) => set('round_id', event.target.value)}
            >
              <option value="">Không theo đợt</option>
              {folderRounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.title} (hạn {formatDateTime(round.due_at)})
                </option>
              ))}
            </select>
          </FormRow>
        ) : null}
        <FormRow label="Tên hồ sơ" error={errors.title}>
          <input
            className={FORM_CONTROL_CLASS}
            value={values.title}
            onChange={(event) => set('title', event.target.value)}
          />
        </FormRow>
        <FormRow label="Mô tả" error={errors.description}>
          <textarea
            className={FORM_CONTROL_CLASS}
            value={values.description}
            onChange={(event) => set('description', event.target.value)}
          />
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

// ---- Danh sách hồ sơ ----

const DOCUMENT_COLUMNS: Array<DataGridColumn<ProfessionalDocument>> = [
  { id: 'title', header: 'Tên hồ sơ', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
  { id: 'folder_name', header: 'Thư mục', cell: (row) => row.folder_name },
  {
    id: 'owner_name',
    header: 'Người nộp',
    cell: (row) => [row.owner_name, row.department_name ?? row.work_group_name].filter(Boolean).join(' – '),
  },
  { id: 'round_title', header: 'Đợt nộp', cell: (row) => row.round_title ?? '' },
  { id: 'current_version', header: 'Phiên bản', cell: (row) => row.current_version },
  {
    id: 'submitted_at',
    header: 'Nộp lúc',
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1">
        {row.submitted_at ? formatDateTime(row.submitted_at) : ''}
        {row.submitted_late ? <StatusBadge tone="warning" label="Nộp trễ" /> : null}
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1">
        <StatusBadge tone={STATUS_TONES[row.status]} label={row.status_label} />
        {row.signed_at ? <StatusBadge tone="success" label="Đã kí" /> : null}
      </span>
    ),
  },
  { id: 'org_unit_name', header: 'Đơn vị', hiddenByDefault: true, cell: (row) => row.org_unit_name },
  { id: 'approved_by_name', header: 'Người duyệt', hiddenByDefault: true, cell: (row) => row.approved_by_name ?? '' },
];

function DocumentList({
  view,
  path,
  label,
  branch,
}: {
  view: 'mine' | 'groups' | 'school' | 'review';
  path: PortalQuickLinkPath;
  label: string;
  branch: ProfessionalBranchCode | null;
}) {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const { toast, setToast, close } = useToast();
  const grid = useGridSettings(view === 'review' ? 'professional-review' : 'professional-documents');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [folderId, setFolderId] = useState('');
  const [all, setAll] = useState(false);
  const [processed, setProcessed] = useState<'pending' | 'processed'>('pending');
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string>();
  const [deleting, setDeleting] = useState<ProfessionalDocument>();
  const folders = useQuery({
    queryKey: ['professional-folders', branch ?? 'all'],
    queryFn: () => listProfessionalFolders(branch ?? undefined),
  });
  const documents = useQuery({
    queryKey: ['professional-documents', view, search, status, folderId, all, processed],
    queryFn: () =>
      listProfessionalDocuments({
        view,
        q: search,
        status,
        folder_id: folderId,
        all,
        processed: processed === 'processed',
      }),
  });
  const remove = useMutation({
    mutationFn: (document: ProfessionalDocument) => deleteProfessionalDocument(document.id),
    onSuccess: async (_result, document) => {
      setDeleting(undefined);
      await queryClient.invalidateQueries({ queryKey: ['professional-documents'] });
      setToast(`Đã xóa ${document.title}`);
    },
    onError: () => setDeleting(undefined),
  });
  const canCreate =
    !overview.data?.locked &&
    branch !== null &&
    (branch === 'school' ? overview.data?.can_manage : overview.data?.has_staff && overview.data.can_use);
  const canSeeAll = overview.data?.can_manage || overview.data?.can_approve;
  return (
    <Page path={path} toast={toast} onToastClose={close}>
      <LockNotice />
      {view === 'review' ? (
        <Tabs<'pending' | 'processed'>
          label="Hồ sơ cần duyệt"
          value={processed}
          options={[
            { value: 'pending', label: 'Chờ tôi duyệt' },
            { value: 'processed', label: 'Tôi đã duyệt' },
          ]}
          onChange={setProcessed}
        />
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-label font-medium text-text">
          Thư mục
          <select className={selectClass} value={folderId} onChange={(event) => setFolderId(event.target.value)}>
            <option value="">Tất cả thư mục</option>
            {folderOptions(folders.data ?? []).map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Trạng thái
          <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tất cả</option>
            {Object.entries(PROFESSIONAL_STATUS_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
        {view === 'mine' && canSeeAll ? (
          <label className="flex items-center gap-2 text-label font-medium text-text">
            <input type="checkbox" checked={all} onChange={(event) => setAll(event.target.checked)} />
            Hồ sơ cá nhân của mọi người trong phạm vi
          </label>
        ) : null}
      </div>
      {documents.error ? <Alert tone="danger">{messageOf(documents.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {creating && branch ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <DocumentForm
            branch={branch}
            onCancel={() => setCreating(false)}
            onSaved={async (id, title) => {
              setCreating(false);
              await queryClient.invalidateQueries({ queryKey: ['professional-documents'] });
              setActiveId(id);
              setToast(`Đã tạo hồ sơ ${title}; tải tệp rồi nộp`);
            }}
          />
        </section>
      ) : null}
      <DataGrid
        label={label}
        columns={DOCUMENT_COLUMNS}
        rows={documents.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.title}
        loading={!documents.data && !documents.error}
        emptyText="Không có hồ sơ."
        search={{ label: 'Tìm theo tên hồ sơ, người nộp', value: search, onChange: setSearch }}
        toolbar={
          canCreate ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm hồ sơ
            </Button>
          ) : null
        }
        rowActions={(row) =>
          row.status === 'draft' && !row.submitted_at && view !== 'review' ? (
            <Button variant="text" onClick={() => setDeleting(row)}>
              Xóa
            </Button>
          ) : null
        }
        onRowClick={(row) => setActiveId(activeId === row.id ? undefined : row.id)}
        activeRowId={activeId}
        renderRowDetail={(row) =>
          activeId === row.id ? <DocumentPanel id={row.id} onChanged={(message) => setToast(message)} /> : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        subject={deleting?.title ?? ''}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(undefined)}
      />
    </Page>
  );
}

export const PersonalRecordsPage = () => (
  <DocumentList view="mine" path="/professional-records" label="Hồ sơ cá nhân" branch="personal" />
);
export const GroupRecordsPage = () => (
  <DocumentList view="groups" path="/professional-records/groups" label="Hồ sơ tổ, nhóm" branch="group" />
);
export const SchoolRecordsPage = () => (
  <DocumentList view="school" path="/professional-records/school" label="Hồ sơ trường" branch="school" />
);
export const ReviewRecordsPage = () => (
  <DocumentList view="review" path="/professional-records/review" label="Duyệt hồ sơ" branch={null} />
);

// ---- Đợt nộp ----

function RoundForm({
  round,
  onSaved,
  onCancel,
}: {
  round?: ProfessionalRound;
  onSaved(round: ProfessionalRound): void;
  onCancel(): void;
}) {
  const folders = useQuery({ queryKey: ['professional-folders', 'all'], queryFn: () => listProfessionalFolders() });
  const options = useQuery({ queryKey: ['professional', 'options'], queryFn: readProfessionalOptions });
  const [values, setValues] = useState({
    title: round?.title ?? '',
    description: round?.description ?? '',
    submitter_kind: round?.submitter_kind ?? ('staff' as 'staff' | 'group'),
    folder_id: round?.folder_id ?? '',
    org_unit_id: round?.org_unit_id ?? '',
    opens_on: round?.opens_on ?? todayText(),
    due_at: round
      ? new Date(round.due_at).toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 16).replace(' ', 'T')
      : '',
  });
  const [departments, setDepartments] = useState<string[]>(round?.department_ids ?? []);
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: () => {
      const input: RoundInput = {
        ...values,
        description: values.description || null,
        org_unit_id: values.org_unit_id || null,
        department_ids: departments,
      };
      return saveProfessionalRound(round?.id ?? null, input);
    },
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const branch = values.submitter_kind === 'staff' ? 'personal' : 'group';
  return (
    <form
      noValidate
      aria-label={round ? `Sửa đợt ${round.title}` : 'Thêm đợt nộp'}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin đợt nộp">
        <FormRow label="Tên đợt" error={errors.title}>
          <input
            className={FORM_CONTROL_CLASS}
            value={values.title}
            onChange={(event) => set('title', event.target.value)}
          />
        </FormRow>
        <FormRow label="Nộp theo" error={errors.submitter_kind}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.submitter_kind}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                submitter_kind: event.target.value as 'staff' | 'group',
                folder_id: '',
              }))
            }
          >
            <option value="staff">Cá nhân (mỗi người một hồ sơ)</option>
            <option value="group">Tổ chuyên môn (mỗi tổ một hồ sơ)</option>
          </select>
        </FormRow>
        <FormRow label="Thư mục" error={errors.folder_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.folder_id}
            onChange={(event) => set('folder_id', event.target.value)}
          >
            <option value="">— Chọn thư mục —</option>
            {folderOptions((folders.data ?? []).filter((folder) => folder.branch === branch)).map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Đơn vị" error={errors.org_unit_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.org_unit_id}
            onChange={(event) => set('org_unit_id', event.target.value)}
          >
            <option value="">Toàn trường</option>
            {(options.data?.units ?? []).map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Tổ áp dụng (để trống là mọi tổ)" error={errors.department_ids}>
          <div className="flex flex-wrap gap-3">
            {(options.data?.departments ?? [])
              .filter((department) => !values.org_unit_id || department.org_unit_id === values.org_unit_id)
              .map((department) => (
                <label key={department.id} className="flex items-center gap-1 text-content">
                  <input
                    type="checkbox"
                    checked={departments.includes(department.id)}
                    onChange={(event) =>
                      setDepartments((current) =>
                        event.target.checked
                          ? [...current, department.id]
                          : current.filter((id) => id !== department.id),
                      )
                    }
                  />
                  {department.name}
                </label>
              ))}
          </div>
        </FormRow>
        <FormRow label="Ngày mở đợt" error={errors.opens_on}>
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={values.opens_on}
            onChange={(event) => set('opens_on', event.target.value)}
          />
        </FormRow>
        <FormRow label="Hạn nộp" error={errors.due_at}>
          <input
            type="datetime-local"
            className={FORM_CONTROL_CLASS}
            value={values.due_at}
            onChange={(event) => set('due_at', event.target.value)}
          />
        </FormRow>
        <FormRow label="Yêu cầu" error={errors.description}>
          <textarea
            className={FORM_CONTROL_CLASS}
            value={values.description}
            onChange={(event) => set('description', event.target.value)}
          />
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

function RoundPanel({
  round,
  canSeeStatus,
  onChanged,
}: {
  round: ProfessionalRound;
  canSeeStatus: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ['professional-round-status', round.id],
    queryFn: () => readRoundStatus(round.id),
    enabled: canSeeStatus,
  });
  const grid = useGridSettings('professional-round-status');
  const [documentId, setDocumentId] = useState<string | null>(round.my_document_id);
  const start = useMutation({
    mutationFn: () =>
      createProfessionalDocument({ folder_id: round.folder_id, round_id: round.id, title: round.title }),
    onSuccess: async (created) => {
      setDocumentId(created.id);
      await queryClient.invalidateQueries({ queryKey: ['professional-rounds'] });
      onChanged('Đã tạo hồ sơ của đợt; tải tệp rồi nộp');
    },
  });
  const columns: Array<DataGridColumn<RoundSubmitter>> = [
    {
      id: 'name',
      header: round.submitter_kind === 'staff' ? 'Người nộp' : 'Tổ',
      alwaysVisible: true,
      cell: (row) => row.name,
    },
    { id: 'department_name', header: 'Tổ', cell: (row) => row.department_name ?? '' },
    { id: 'org_unit_name', header: 'Đơn vị', cell: (row) => row.org_unit_name ?? '' },
    {
      id: 'submitted_at',
      header: 'Nộp lúc',
      cell: (row) => (row.submitted_at ? formatDateTime(row.submitted_at) : ''),
    },
    {
      id: 'state',
      header: 'Tình trạng',
      cell: (row) => <StatusBadge tone={STATE_TONES[row.state]} label={STATE_LABELS[row.state]} />,
    },
    {
      id: 'status',
      header: 'Trạng thái hồ sơ',
      cell: (row) => (row.status ? PROFESSIONAL_STATUS_LABELS[row.status] : ''),
    },
  ];
  return (
    <div className="flex flex-col gap-3" aria-label={`Chi tiết đợt ${round.title}`}>
      {round.description ? <p className="text-content">{round.description}</p> : null}
      {start.error ? <Alert tone="danger">{messageOf(start.error)}</Alert> : null}
      {round.submitter_kind === 'staff' && round.my_state && !documentId && round.status === 'open' ? (
        <Button variant="primary" disabled={start.isPending} onClick={() => start.mutate()}>
          Nộp hồ sơ cho đợt này
        </Button>
      ) : null}
      {documentId ? <DocumentPanel id={documentId} onChanged={onChanged} /> : null}
      {canSeeStatus ? (
        <>
          {status.error ? <Alert tone="danger">{messageOf(status.error)}</Alert> : null}
          <DataGrid
            label={`Tình trạng nộp của đợt ${round.title}`}
            columns={columns}
            rows={status.data?.submitters ?? []}
            getRowId={(row) => row.key}
            getRowLabel={(row) => row.name}
            loading={!status.data && !status.error}
            emptyText="Đợt không có đối tượng phải nộp."
            settings={grid.settings}
            onSettingsChange={grid.update}
          />
        </>
      ) : null}
    </div>
  );
}

export function RoundsPage() {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const { toast, setToast, close } = useToast();
  const grid = useGridSettings('professional-rounds');
  const [status, setStatus] = useState<'open' | 'closed' | 'all'>('open');
  const [editing, setEditing] = useState<ProfessionalRound | 'new'>();
  const [activeId, setActiveId] = useState<string>();
  const rounds = useQuery({ queryKey: ['professional-rounds', status], queryFn: () => listProfessionalRounds(status) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['professional-rounds'] });
  const act = useMutation({
    mutationFn: ({ round, kind }: { round: ProfessionalRound; kind: 'close' | 'reopen' | 'remind' }) =>
      roundAction(round.id, kind),
    onSuccess: async (result, { kind }) => {
      await refresh();
      setToast(
        kind === 'remind'
          ? `Đã nhắc ${result.reminded ?? 0} người, tổ chưa nộp`
          : kind === 'close'
            ? 'Đã đóng đợt nộp'
            : 'Đã mở lại đợt nộp',
      );
    },
  });
  const manage = overview.data?.can_manage && !overview.data.locked;
  const canSeeStatus = Boolean(overview.data?.can_manage || overview.data?.can_approve || overview.data?.can_review);
  const columns: Array<DataGridColumn<ProfessionalRound>> = [
    { id: 'title', header: 'Đợt nộp', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
    { id: 'folder_name', header: 'Thư mục', cell: (row) => row.folder_name },
    { id: 'submitter_kind', header: 'Nộp theo', cell: (row) => (row.submitter_kind === 'staff' ? 'Cá nhân' : 'Tổ') },
    { id: 'org_unit_name', header: 'Đơn vị', cell: (row) => row.org_unit_name ?? 'Toàn trường' },
    { id: 'opens_on', header: 'Mở từ', cell: (row) => formatDate(row.opens_on) },
    {
      id: 'due_at',
      header: 'Hạn nộp',
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1">
          {formatDateTime(row.due_at)}
          {row.overdue ? <StatusBadge tone="danger" label="Đã quá hạn" /> : null}
        </span>
      ),
    },
    {
      id: 'progress',
      header: 'Đúng hạn / trễ / chưa nộp',
      cell: (row) => `${row.on_time} / ${row.late} / ${row.missing} (trên ${row.expected})`,
    },
    {
      id: 'my_state',
      header: 'Của tôi',
      cell: (row) =>
        row.my_state ? <StatusBadge tone={STATE_TONES[row.my_state]} label={STATE_LABELS[row.my_state]} /> : '',
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <StatusBadge
          tone={row.status === 'open' ? 'info' : 'neutral'}
          label={row.status === 'open' ? 'Đang mở' : 'Đã đóng'}
        />
      ),
    },
  ];
  return (
    <Page path="/professional-rounds" toast={toast} onToastClose={close}>
      <LockNotice />
      <Tabs<'open' | 'closed' | 'all'>
        label="Trạng thái đợt"
        value={status}
        options={[
          { value: 'open', label: 'Đang mở' },
          { value: 'closed', label: 'Đã đóng' },
          { value: 'all', label: 'Tất cả' },
        ]}
        onChange={setStatus}
      />
      {rounds.error ? <Alert tone="danger">{messageOf(rounds.error)}</Alert> : null}
      {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
      {editing ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <RoundForm
            round={editing === 'new' ? undefined : editing}
            onCancel={() => setEditing(undefined)}
            onSaved={async (round) => {
              setEditing(undefined);
              await refresh();
              setToast(`Đã ghi đợt ${round.title}`);
            }}
          />
        </section>
      ) : null}
      <DataGrid
        label="Đợt nộp hồ sơ"
        columns={columns}
        rows={rounds.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.title}
        loading={!rounds.data && !rounds.error}
        emptyText="Không có đợt nộp."
        toolbar={
          manage ? (
            <Button variant="primary" onClick={() => setEditing('new')}>
              Thêm đợt nộp
            </Button>
          ) : null
        }
        rowActions={(row) =>
          manage ? (
            <span className="flex flex-wrap gap-1">
              <Button variant="text" onClick={() => setEditing(row)}>
                Sửa
              </Button>
              {row.status === 'open' ? (
                <>
                  <Button variant="text" onClick={() => act.mutate({ round: row, kind: 'remind' })}>
                    Nhắc chưa nộp
                  </Button>
                  <Button variant="text" onClick={() => act.mutate({ round: row, kind: 'close' })}>
                    Đóng đợt
                  </Button>
                </>
              ) : (
                <Button variant="text" onClick={() => act.mutate({ round: row, kind: 'reopen' })}>
                  Mở lại
                </Button>
              )}
            </span>
          ) : null
        }
        onRowClick={(row) => setActiveId(activeId === row.id ? undefined : row.id)}
        activeRowId={activeId}
        renderRowDetail={(row) =>
          activeId === row.id ? (
            <RoundPanel round={row} canSeeStatus={canSeeStatus} onChanged={(message) => setToast(message)} />
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

// ---- Thống kê ----

export function StatisticsPage() {
  const grid = useGridSettings('professional-statistics');
  const statistics = useQuery({
    queryKey: ['professional', 'statistics'],
    queryFn: () => readProfessionalStatistics(),
  });
  type RoundRow = NonNullable<typeof statistics.data>['rounds'][number];
  type DepartmentRow = NonNullable<typeof statistics.data>['departments'][number];
  const totals = statistics.data?.totals;
  const roundColumns: Array<DataGridColumn<RoundRow>> = [
    { id: 'title', header: 'Đợt nộp', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
    { id: 'due_at', header: 'Hạn nộp', cell: (row) => formatDateTime(row.due_at) },
    { id: 'expected', header: 'Phải nộp', cell: (row) => row.expected },
    { id: 'on_time', header: 'Đúng hạn', cell: (row) => row.on_time },
    { id: 'late', header: 'Nộp trễ', cell: (row) => row.late },
    { id: 'missing', header: 'Chưa nộp', cell: (row) => row.missing },
    {
      id: 'on_time_percent',
      header: 'Tỷ lệ đúng hạn',
      cell: (row) => (row.on_time_percent === null ? '' : `${row.on_time_percent}%`),
    },
  ];
  const departmentColumns: Array<DataGridColumn<DepartmentRow>> = [
    { id: 'department', header: 'Tổ', alwaysVisible: true, className: 'font-medium', cell: (row) => row.department },
    { id: 'on_time', header: 'Đúng hạn', cell: (row) => row.on_time },
    { id: 'late', header: 'Nộp trễ', cell: (row) => row.late },
    { id: 'missing', header: 'Chưa nộp', cell: (row) => row.missing },
  ];
  return (
    <Page path="/professional-records/statistics">
      {statistics.error ? <Alert tone="danger">{messageOf(statistics.error)}</Alert> : null}
      {totals ? (
        <p className="text-content text-text" data-testid="professional-totals">
          Tổng {totals.expected} lượt phải nộp: <strong>{totals.on_time}</strong> đúng hạn,{' '}
          <strong>{totals.late}</strong> nộp trễ, <strong className="text-danger">{totals.missing}</strong> chưa nộp.
        </p>
      ) : null}
      <DataGrid
        label="Thống kê theo đợt nộp"
        columns={roundColumns}
        rows={statistics.data?.rounds ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.title}
        loading={!statistics.data && !statistics.error}
        emptyText="Chưa có đợt nộp."
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      <DataGrid
        label="Thống kê theo tổ"
        columns={departmentColumns}
        rows={statistics.data?.departments ?? []}
        getRowId={(row) => row.department}
        getRowLabel={(row) => row.department}
        loading={!statistics.data && !statistics.error}
        emptyText="Chưa có số liệu."
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

// ---- Thư mục, khóa năm học ----

function FolderForm({
  folder,
  folders,
  onSaved,
  onCancel,
}: {
  folder?: ProfessionalFolder;
  folders: ProfessionalFolder[];
  onSaved(folder: ProfessionalFolder): void;
  onCancel(): void;
}) {
  const [values, setValues] = useState<FolderInput>({
    parent_id: folder?.parent_id ?? null,
    branch: folder?.branch ?? 'personal',
    name: folder?.name ?? '',
    description: folder?.description ?? null,
    school_level: folder?.school_level ?? null,
    approval_flow: folder?.approval_flow ?? 'two_level',
    requires_signing: folder?.requires_signing ?? false,
    sort_order: folder?.sort_order ?? 0,
    status: folder?.status ?? 'active',
  });
  const save = useMutation({
    mutationFn: () => saveProfessionalFolder(folder?.id ?? null, values),
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const set = <Key extends keyof FolderInput>(key: Key, value: FolderInput[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));
  return (
    <form
      noValidate
      aria-label={folder ? `Sửa thư mục ${folder.name}` : 'Thêm thư mục'}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thư mục hồ sơ">
        <FormRow label="Nhánh" error={errors.branch}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.branch}
            disabled={Boolean(folder)}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                branch: event.target.value as ProfessionalBranchCode,
                parent_id: null,
              }))
            }
          >
            {Object.entries(PROFESSIONAL_BRANCH_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Thư mục cha" error={errors.parent_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.parent_id ?? ''}
            onChange={(event) => set('parent_id', event.target.value || null)}
          >
            <option value="">Thư mục gốc</option>
            {folderOptions(folders.filter((item) => item.branch === values.branch && item.id !== folder?.id)).map(
              (item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ),
            )}
          </select>
        </FormRow>
        <FormRow label="Tên thư mục" error={errors.name}>
          <input
            className={FORM_CONTROL_CLASS}
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </FormRow>
        <FormRow label="Luồng duyệt" error={errors.approval_flow}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.approval_flow}
            onChange={(event) => set('approval_flow', event.target.value as ProfessionalApprovalFlowCode)}
          >
            {Object.entries(PROFESSIONAL_APPROVAL_FLOW_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Kí nội bộ khi duyệt" error={errors.requires_signing}>
          <input
            type="checkbox"
            checked={values.requires_signing}
            onChange={(event) => set('requires_signing', event.target.checked)}
          />
        </FormRow>
        <FormRow label="Cấp học" error={errors.school_level}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.school_level ?? ''}
            onChange={(event) => set('school_level', (event.target.value || null) as KpiSchoolLevelCode | null)}
          >
            <option value="">Mọi cấp học</option>
            {KPI_SCHOOL_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Thứ tự" error={errors.sort_order}>
          <input
            className={FORM_CONTROL_CLASS}
            inputMode="numeric"
            value={String(values.sort_order)}
            onChange={(event) => set('sort_order', Number(event.target.value) || 0)}
          />
        </FormRow>
        <FormRow label="Trạng thái" error={errors.status}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.status}
            onChange={(event) => set('status', event.target.value as 'active' | 'inactive')}
          >
            <option value="active">Đang dùng</option>
            <option value="inactive">Ngừng dùng</option>
          </select>
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

export function FoldersPage() {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const { toast, setToast, close } = useToast();
  const grid = useGridSettings('professional-folders');
  const [level, setLevel] = useState<KpiSchoolLevelCode>('MN');
  const [editing, setEditing] = useState<ProfessionalFolder | 'new'>();
  const [deleting, setDeleting] = useState<ProfessionalFolder>();
  const folders = useQuery({
    queryKey: ['professional-folders', 'manage'],
    queryFn: () => listProfessionalFolders(undefined, true),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['professional-folders'] });
  const defaults = useMutation({
    mutationFn: () => loadDefaultFolders(level),
    onSuccess: async (result) => {
      await refresh();
      setToast(`Đã thêm ${result.created} thư mục, bỏ qua ${result.skipped} thư mục đã có`);
    },
  });
  const lock = useMutation({
    mutationFn: (locked: boolean) => setProfessionalLock(locked),
    onSuccess: (next) => {
      queryClient.setQueryData(['professional', 'overview'], next);
      setToast(next.locked ? 'Đã khóa năm học' : 'Đã mở khóa năm học');
    },
  });
  const remove = useMutation({
    mutationFn: (folder: ProfessionalFolder) => deleteProfessionalFolder(folder.id),
    onSuccess: async (_result, folder) => {
      setDeleting(undefined);
      await refresh();
      setToast(`Đã xóa thư mục ${folder.name}`);
    },
    onError: () => setDeleting(undefined),
  });
  const rows = folders.data ?? [];
  const byId = new Map(rows.map((folder) => [folder.id, folder]));
  const columns: Array<DataGridColumn<ProfessionalFolder>> = [
    { id: 'branch', header: 'Nhánh', cell: (row) => PROFESSIONAL_BRANCH_LABELS[row.branch] },
    { id: 'name', header: 'Thư mục', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
    {
      id: 'parent',
      header: 'Thư mục cha',
      cell: (row) => (row.parent_id ? (byId.get(row.parent_id)?.name ?? '') : ''),
    },
    { id: 'approval_flow', header: 'Luồng duyệt', cell: (row) => PROFESSIONAL_APPROVAL_FLOW_LABELS[row.approval_flow] },
    { id: 'requires_signing', header: 'Kí nội bộ', cell: (row) => (row.requires_signing ? 'Có' : '') },
    {
      id: 'school_level',
      header: 'Cấp học',
      cell: (row) => KPI_SCHOOL_LEVELS.find((item) => item.value === row.school_level)?.label ?? 'Mọi cấp',
    },
    { id: 'document_count', header: 'Số hồ sơ', cell: (row) => row.document_count },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <StatusBadge
          tone={row.status === 'active' ? 'success' : 'neutral'}
          label={row.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}
        />
      ),
    },
  ];
  const locked = overview.data?.locked ?? false;
  return (
    <Page path="/professional-folders" toast={toast} onToastClose={close}>
      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <span className="text-content">
          Khóa năm học: {locked ? <strong>đang khóa</strong> : 'đang mở'}
          {locked && overview.data?.locked_at ? ` từ ${formatDateTime(overview.data.locked_at)}` : ''}
        </span>
        <Button variant="secondary" disabled={lock.isPending} onClick={() => lock.mutate(!locked)}>
          {locked ? 'Mở khóa năm học' : 'Khóa năm học'}
        </Button>
        {lock.error ? <Alert tone="danger">{messageOf(lock.error)}</Alert> : null}
      </section>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-label font-medium text-text">
          Cấp học
          <select
            className={selectClass}
            value={level}
            onChange={(event) => setLevel(event.target.value as KpiSchoolLevelCode)}
          >
            {KPI_SCHOOL_LEVELS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" disabled={defaults.isPending || locked} onClick={() => defaults.mutate()}>
          Nạp danh mục mặc định
        </Button>
      </div>
      {defaults.error ? <Alert tone="danger">{messageOf(defaults.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {folders.error ? <Alert tone="danger">{messageOf(folders.error)}</Alert> : null}
      {editing ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <FolderForm
            folder={editing === 'new' ? undefined : editing}
            folders={rows}
            onCancel={() => setEditing(undefined)}
            onSaved={async (folder) => {
              setEditing(undefined);
              await refresh();
              setToast(`Đã ghi thư mục ${folder.name}`);
            }}
          />
        </section>
      ) : null}
      <DataGrid
        label="Thư mục hồ sơ chuyên môn"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={!folders.data && !folders.error}
        emptyText="Chưa có thư mục; nạp danh mục mặc định theo cấp học hoặc thêm mới."
        toolbar={
          locked ? null : (
            <Button variant="primary" onClick={() => setEditing('new')}>
              Thêm thư mục
            </Button>
          )
        }
        rowActions={(row) =>
          locked ? null : (
            <span className="flex gap-1">
              <Button variant="text" onClick={() => setEditing(row)}>
                Sửa
              </Button>
              {row.document_count === 0 ? (
                <Button variant="text" onClick={() => setDeleting(row)}>
                  Xóa
                </Button>
              ) : null}
            </span>
          )
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        subject={deleting?.name ?? ''}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(undefined)}
      />
    </Page>
  );
}

// ---- Nhóm công tác ----

function WorkGroupForm({
  group,
  onSaved,
  onCancel,
}: {
  group?: WorkGroup;
  onSaved(group: WorkGroup): void;
  onCancel(): void;
}) {
  const options = useQuery({ queryKey: ['professional', 'options'], queryFn: readProfessionalOptions });
  const [values, setValues] = useState({
    org_unit_id: group?.org_unit_id ?? '',
    name: group?.name ?? '',
    description: group?.description ?? '',
    status: group?.status ?? ('active' as 'active' | 'inactive'),
  });
  const [members, setMembers] = useState<Record<string, 'member' | 'leader'>>(
    Object.fromEntries(
      (group?.members ?? []).map((member) => [member.staff_id, member.is_leader ? 'leader' : 'member']),
    ),
  );
  const save = useMutation({
    mutationFn: () =>
      saveWorkGroup(group?.id ?? null, {
        ...values,
        description: values.description || null,
        members: Object.entries(members).map(([staffId, role]) => ({
          staff_id: staffId,
          is_leader: role === 'leader',
        })),
      }),
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const staff = (options.data?.staff ?? []).filter(
    (person) => !values.org_unit_id || person.org_unit_id === values.org_unit_id,
  );
  return (
    <form
      noValidate
      aria-label={group ? `Sửa nhóm ${group.name}` : 'Thêm nhóm công tác'}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Nhóm công tác">
        <FormRow label="Đơn vị" error={errors.org_unit_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.org_unit_id}
            onChange={(event) => setValues((current) => ({ ...current, org_unit_id: event.target.value }))}
          >
            <option value="">— Chọn đơn vị —</option>
            {(options.data?.units ?? []).map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Tên nhóm" error={errors.name}>
          <input
            className={FORM_CONTROL_CLASS}
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
          />
        </FormRow>
        <FormRow label="Mô tả" error={errors.description}>
          <input
            className={FORM_CONTROL_CLASS}
            value={values.description}
            onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
          />
        </FormRow>
        <FormRow label="Trạng thái" error={errors.status}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.status}
            onChange={(event) =>
              setValues((current) => ({ ...current, status: event.target.value as 'active' | 'inactive' }))
            }
          >
            <option value="active">Đang dùng</option>
            <option value="inactive">Ngừng dùng</option>
          </select>
        </FormRow>
        <FormRow label="Thành viên" error={errors.members}>
          <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto md:grid-cols-2">
            {staff.map((person) => (
              <label key={person.id} className="flex items-center gap-2 text-content">
                <select
                  aria-label={`Vai trò của ${person.full_name}`}
                  className={FORM_CONTROL_CLASS}
                  value={members[person.id] ?? ''}
                  onChange={(event) =>
                    setMembers((current) => {
                      const next = { ...current };
                      if (event.target.value) {
                        next[person.id] = event.target.value as 'member' | 'leader';
                      } else {
                        delete next[person.id];
                      }
                      return next;
                    })
                  }
                >
                  <option value="">Không tham gia</option>
                  <option value="member">Thành viên</option>
                  <option value="leader">Trưởng nhóm</option>
                </select>
                {person.full_name}
                {person.department_name ? ` (${person.department_name})` : ''}
              </label>
            ))}
          </div>
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

export function WorkGroupsPage() {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const { toast, setToast, close } = useToast();
  const grid = useGridSettings('professional-work-groups');
  const [editing, setEditing] = useState<WorkGroup | 'new'>();
  const groups = useQuery({ queryKey: ['professional-work-groups'], queryFn: listWorkGroups });
  const locked = overview.data?.locked ?? false;
  const columns: Array<DataGridColumn<WorkGroup>> = [
    { id: 'name', header: 'Nhóm công tác', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
    { id: 'org_unit_name', header: 'Đơn vị', cell: (row) => row.org_unit_name },
    {
      id: 'leaders',
      header: 'Trưởng nhóm',
      cell: (row) =>
        row.members
          .filter((member) => member.is_leader)
          .map((member) => member.full_name)
          .join(', '),
    },
    { id: 'member_count', header: 'Số thành viên', cell: (row) => row.members.length },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <StatusBadge
          tone={row.status === 'active' ? 'success' : 'neutral'}
          label={row.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}
        />
      ),
    },
  ];
  return (
    <Page path="/professional-work-groups" toast={toast} onToastClose={close}>
      <LockNotice />
      {groups.error ? <Alert tone="danger">{messageOf(groups.error)}</Alert> : null}
      {editing ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <WorkGroupForm
            group={editing === 'new' ? undefined : editing}
            onCancel={() => setEditing(undefined)}
            onSaved={async (group) => {
              setEditing(undefined);
              await queryClient.invalidateQueries({ queryKey: ['professional-work-groups'] });
              setToast(`Đã ghi nhóm ${group.name}`);
            }}
          />
        </section>
      ) : null}
      <DataGrid
        label="Nhóm công tác"
        columns={columns}
        rows={groups.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={!groups.data && !groups.error}
        emptyText="Chưa có nhóm công tác."
        toolbar={
          locked ? null : (
            <Button variant="primary" onClick={() => setEditing('new')}>
              Thêm nhóm
            </Button>
          )
        }
        rowActions={(row) =>
          locked ? null : (
            <Button variant="text" onClick={() => setEditing(row)}>
              Sửa
            </Button>
          )
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}
