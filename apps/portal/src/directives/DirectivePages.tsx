import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  DIRECTIVE_ASSIGNMENT_STATUS_LABELS,
  DIRECTIVE_PRIORITY_LABELS,
  DIRECTIVE_RECURRENCE_LABELS,
  DIRECTIVE_ROLE_LABELS,
  DIRECTIVE_STATUS_FILTER_LABELS,
  DIRECTIVE_TARGET_LABELS,
  PERMISSION_CODES,
  type DirectiveAssignmentStatus,
  type DirectivePriority,
  type DirectiveRecurrence,
  type DirectiveRole,
  type DirectiveStatusFilter,
  type DirectiveTarget,
} from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  type DataGridColumn,
  type StatusTone,
} from '@school-management/ui';
import { useGridSettings } from '../pages/grid-settings.js';
import { useHasPermission } from '../session/permissions.js';
import { fieldErrorsOf, formatDate, messageOf, selectClass } from '../archives/archive-ui.js';
import {
  addAssignments,
  approveAssignment,
  cancelDirective,
  createDirective,
  deleteDirectiveFile,
  downloadDirectiveFile,
  listDocumentTasks,
  listInbox,
  listOutbox,
  readDirective,
  readDirectiveOptions,
  reportProgress,
  revokeAssignment,
  updateDirective,
  uploadDirectiveFile,
  type AssignmentDraft,
  type DirectiveAssignment,
  type DirectiveDetail,
  type DirectiveOptions,
  type InboxItem,
  type OutboxItem,
} from './directives-api.js';
import { formatDateTime, Page, Section, todayText, useToast } from './directive-ui.js';
import { SaveToWorkFile } from './WorkFilePages.js';

// Quản lý công việc theo VNPT iOffice (DT-18 phần 18c, YCTD-141): 4.1 Giao việc (THÔNG TIN CÔNG VIỆC và PHÂN CÔNG THỰC
// HIỆN theo cây đơn vị), 4.2 Công việc cần xử lý (lọc trạng thái, vai, loại), 4.3 Công việc đã giao. Bấm một dòng mở chi
// tiết việc ngay dưới dòng: cập nhật tiến độ, phân công tiếp, phê duyệt, thu hồi, tệp đính kèm, hủy việc
const STATUS_TONES: Record<DirectiveAssignmentStatus, StatusTone> = {
  todo: 'neutral',
  in_progress: 'info',
  pending_approval: 'warning',
  done: 'success',
  cancelled: 'neutral',
};
const TASK_STATUS_LABELS = {
  todo: 'Chưa xử lý',
  in_progress: 'Đang xử lý',
  done: 'Đã hoàn thành',
  cancelled: 'Đã hủy',
};
const PRIORITIES = Object.entries(DIRECTIVE_PRIORITY_LABELS) as Array<[DirectivePriority, string]>;
const RECURRENCES = Object.entries(DIRECTIVE_RECURRENCE_LABELS) as Array<[DirectiveRecurrence, string]>;
const STATUS_FILTERS = Object.entries(DIRECTIVE_STATUS_FILTER_LABELS) as Array<[DirectiveStatusFilter, string]>;

function handlerName(row: { staff_name: string | null; department_name: string | null; org_unit_name: string }) {
  return row.staff_name ?? (row.department_name ? `${row.department_name} (${row.org_unit_name})` : row.org_unit_name);
}

// ---- Bảng phân công theo cây đơn vị ----

interface TreeRow {
  key: string;
  label: string;
  depth: number;
  draft: AssignmentDraft;
}

function treeRows(options: DirectiveOptions): TreeRow[] {
  const rows: TreeRow[] = [];
  for (const unit of options.units) {
    rows.push({
      key: `unit:${unit.id}`,
      label: unit.name,
      depth: 0,
      draft: { role: 'main', target_type: 'unit', org_unit_id: unit.id },
    });
    const staffIn = (departmentId: string | null) =>
      unit.staff
        .filter((person) => person.department_id === departmentId)
        .map((person) => ({
          key: `staff:${person.id}`,
          label: person.job_title_name ? `${person.full_name} – ${person.job_title_name}` : person.full_name,
          depth: departmentId ? 2 : 1,
          draft: { role: 'main' as const, target_type: 'staff' as const, staff_id: person.id },
        }));
    for (const department of unit.departments) {
      rows.push({
        key: `department:${department.id}`,
        label: department.name,
        depth: 1,
        draft: { role: 'main', target_type: 'unit', org_unit_id: unit.id, department_id: department.id },
      });
      rows.push(...staffIn(department.id));
    }
    rows.push(...staffIn(null));
  }
  return rows;
}

interface Pick {
  role: DirectiveRole | '';
  start_date: string;
  due_date: string;
}

function AssignmentTree({
  options,
  picks,
  onChange,
  only,
}: {
  options: DirectiveOptions;
  picks: Record<string, Pick>;
  onChange(key: string, pick: Pick): void;
  // Phân công tiếp: chỉ cá nhân trong đơn vị, phòng ban được giao
  only?: (row: TreeRow) => boolean;
}) {
  const rows = treeRows(options).filter((row) => !only || only(row));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-content">
        <thead>
          <tr className="border-b border-border text-left text-label text-text-secondary">
            <th className="p-2">Đơn vị, phòng ban, cá nhân</th>
            <th className="p-2">Vai</th>
            <th className="p-2">Ngày bắt đầu</th>
            <th className="p-2">Ngày hết hạn</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pick = picks[row.key] ?? { role: '', start_date: '', due_date: '' };
            return (
              <tr key={row.key} className="border-b border-border">
                <td className="p-2" style={{ paddingLeft: `${0.5 + row.depth * 1.25}rem` }}>
                  <span
                    className={
                      row.depth === 0 ? 'font-semibold' : row.draft.target_type === 'unit' ? 'font-medium' : ''
                    }
                  >
                    {row.label}
                  </span>
                </td>
                <td className="p-2">
                  <select
                    aria-label={`Vai của ${row.label}`}
                    className={FORM_CONTROL_CLASS}
                    value={pick.role}
                    onChange={(event) => onChange(row.key, { ...pick, role: event.target.value as DirectiveRole | '' })}
                  >
                    <option value="">—</option>
                    {(Object.entries(DIRECTIVE_ROLE_LABELS) as Array<[DirectiveRole, string]>).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <input
                    type="date"
                    aria-label={`Ngày bắt đầu của ${row.label}`}
                    className={FORM_CONTROL_CLASS}
                    value={pick.start_date}
                    disabled={!pick.role}
                    onChange={(event) => onChange(row.key, { ...pick, start_date: event.target.value })}
                  />
                </td>
                <td className="p-2">
                  <input
                    type="date"
                    aria-label={`Ngày hết hạn của ${row.label}`}
                    className={FORM_CONTROL_CLASS}
                    value={pick.due_date}
                    disabled={!pick.role}
                    onChange={(event) => onChange(row.key, { ...pick, due_date: event.target.value })}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function draftsOf(options: DirectiveOptions, picks: Record<string, Pick>): AssignmentDraft[] {
  return treeRows(options)
    .filter((row) => picks[row.key]?.role)
    .map((row) => {
      const pick = picks[row.key] as Pick;
      return {
        ...row.draft,
        role: pick.role as DirectiveRole,
        start_date: pick.start_date || null,
        due_date: pick.due_date || null,
      };
    });
}

// ---- 4.1 Giao việc ----

export function DirectiveFormPage() {
  const search: { document_id?: string; document_label?: string } = useSearch({ strict: false });
  const { toast, setToast, close } = useToast();
  const options = useQuery({ queryKey: ['directive-options'], queryFn: readDirectiveOptions });
  const blank = {
    leader_user_id: '',
    content: '',
    related_documents: '',
    priority: 'normal' as DirectivePriority,
    start_date: todayText(),
    duration_days: '',
    remind_assigner: false,
    recurrence: 'none' as DirectiveRecurrence,
  };
  const [values, setValues] = useState(blank);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [created, setCreated] = useState<DirectiveDetail>();
  const save = useMutation({
    mutationFn: () =>
      createDirective({
        content: values.content,
        leader_user_id: values.leader_user_id || null,
        priority: values.priority,
        start_date: values.start_date || null,
        duration_days: values.duration_days ? Number(values.duration_days) : null,
        remind_assigner: values.remind_assigner,
        recurrence: values.recurrence,
        source_document_id: search.document_id ?? null,
        related_documents: values.related_documents || null,
        assignments: options.data ? draftsOf(options.data, picks) : [],
      }),
    onSuccess: (detail) => {
      setCreated(detail);
      setValues(blank);
      setPicks({});
      setToast(`Đã tạo công việc ${detail.title}`);
    },
  });
  const errors = fieldErrorsOf(save.error);
  const set = <Key extends keyof typeof values>(key: Key, value: (typeof values)[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));
  return (
    <Page path="/directives/new" toast={toast} onToastClose={close}>
      {options.error ? <Alert tone="danger">{messageOf(options.error)}</Alert> : null}
      {created ? (
        <Alert tone="success">
          Đã tạo công việc “{created.title}”, hạn {formatDate(created.due_date)}. Xem ở 4.3 Công việc đã giao.
        </Alert>
      ) : null}
      <form
        noValidate
        aria-label="Giao việc"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
        <FormBlock title="THÔNG TIN CÔNG VIỆC">
          <FormRow label="Lãnh đạo giao việc" error={errors.leader_user_id}>
            <select
              className={FORM_CONTROL_CLASS}
              value={values.leader_user_id}
              onChange={(event) => set('leader_user_id', event.target.value)}
            >
              <option value="">— Chọn lãnh đạo —</option>
              {(options.data?.leaders ?? []).map((leader) => (
                <option key={leader.user_id} value={leader.user_id}>
                  {leader.title ? `${leader.user_name} – ${leader.title}` : leader.user_name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Nội dung nhiệm vụ (*)" error={errors.content}>
            <textarea
              className={`${FORM_CONTROL_CLASS} min-h-24`}
              value={values.content}
              onChange={(event) => set('content', event.target.value)}
            />
          </FormRow>
          {search.document_id ? (
            <FormRow label="Văn bản đến">
              <span>{search.document_label ?? 'Văn bản đã chọn'}</span>
            </FormRow>
          ) : null}
          <FormRow label="Văn bản liên quan" error={errors.related_documents}>
            <input
              className={FORM_CONTROL_CLASS}
              value={values.related_documents}
              onChange={(event) => set('related_documents', event.target.value)}
            />
          </FormRow>
          <FormRow label="Mức độ công việc" error={errors.priority}>
            <select
              className={FORM_CONTROL_CLASS}
              value={values.priority}
              onChange={(event) => set('priority', event.target.value as DirectivePriority)}
            >
              {PRIORITIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Ngày bắt đầu" error={errors.start_date}>
            <input
              type="date"
              className={FORM_CONTROL_CLASS}
              value={values.start_date}
              onChange={(event) => set('start_date', event.target.value)}
            />
          </FormRow>
          <FormRow label="Số ngày thực hiện" error={errors.duration_days}>
            <input
              inputMode="numeric"
              className={FORM_CONTROL_CLASS}
              value={values.duration_days}
              onChange={(event) => set('duration_days', event.target.value)}
            />
          </FormRow>
          <FormRow label="Nhắc việc cho người giao việc">
            <input
              type="checkbox"
              checked={values.remind_assigner}
              onChange={(event) => set('remind_assigner', event.target.checked)}
            />
          </FormRow>
          <FormRow label="Nhắc việc định kì" error={errors.recurrence}>
            <select
              className={FORM_CONTROL_CLASS}
              value={values.recurrence}
              onChange={(event) => set('recurrence', event.target.value as DirectiveRecurrence)}
            >
              {RECURRENCES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormRow>
        </FormBlock>
        <Section title="PHÂN CÔNG THỰC HIỆN">
          {errors.assignments ? <Alert tone="danger">{errors.assignments}</Alert> : null}
          {Object.entries(errors)
            .filter(([field]) => field.startsWith('assignments['))
            .map(([field, message]) => (
              <Alert key={field} tone="danger">
                Dòng {Number(field.slice(12, field.indexOf(']'))) + 1}: {message}
              </Alert>
            ))}
          {options.data ? (
            <AssignmentTree
              options={options.data}
              picks={picks}
              onChange={(key, pick) => setPicks((current) => ({ ...current, [key]: pick }))}
            />
          ) : null}
        </Section>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={save.isPending}>
            Tạo công việc
          </Button>
        </div>
      </form>
    </Page>
  );
}

// ---- Chi tiết việc ----

function AssignmentActions({
  task,
  assignment,
  options,
  onChanged,
}: {
  task: DirectiveDetail;
  assignment: DirectiveAssignment;
  options: DirectiveOptions | undefined;
  onChanged(detail: DirectiveDetail, message: string): void;
}) {
  const [mode, setMode] = useState<'progress' | 'approve' | 'delegate' | 'revoke'>();
  const [progress, setProgress] = useState(String(assignment.progress_percent));
  const [note, setNote] = useState('');
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const action = useMutation({
    mutationFn: async (input: { kind: string; result?: 'done' | 'not_done' }) => {
      if (input.kind === 'progress') {
        return reportProgress(task.id, assignment.id, Number(progress), note || null);
      }
      if (input.kind === 'approve') {
        return approveAssignment(task.id, assignment.id, input.result as 'done' | 'not_done', note || null);
      }
      if (input.kind === 'revoke') {
        return revokeAssignment(task.id, assignment.id, note || null);
      }
      return addAssignments(task.id, options ? draftsOf(options, picks) : [], assignment.id);
    },
    onSuccess: (detail) => {
      setMode(undefined);
      setNote('');
      onChanged(detail, 'Đã ghi');
    },
  });
  const buttons = [
    assignment.can_update ? (['progress', 'Cập nhật tiến độ'] as const) : null,
    assignment.can_delegate ? (['delegate', 'Phân công tiếp'] as const) : null,
    assignment.can_approve ? (['approve', 'Phê duyệt'] as const) : null,
    assignment.can_revoke ? (['revoke', 'Thu hồi'] as const) : null,
  ].filter((item) => item !== null);
  if (buttons.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-wrap gap-1">
        {buttons.map(([value, label]) => (
          <Button key={value} variant="text" onClick={() => setMode(mode === value ? undefined : value)}>
            {label}
          </Button>
        ))}
      </span>
      {action.error ? <Alert tone="danger">{messageOf(action.error)}</Alert> : null}
      {mode ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-2">
          {mode === 'progress' ? (
            <label className="text-label font-medium text-text">
              Phần trăm hoàn thành
              <input
                inputMode="numeric"
                className={selectClass}
                value={progress}
                onChange={(event) => setProgress(event.target.value)}
              />
            </label>
          ) : null}
          {mode === 'delegate' && options ? (
            <AssignmentTree
              options={options}
              picks={picks}
              onChange={(key, pick) => setPicks((current) => ({ ...current, [key]: pick }))}
              only={(row) =>
                row.draft.target_type === 'staff' &&
                (options.units
                  .find((unit) => unit.id === assignment.org_unit_id)
                  ?.staff.some(
                    (person) =>
                      person.id === row.draft.staff_id &&
                      (!assignment.department_id || person.department_id === assignment.department_id),
                  ) ??
                  false)
              }
            />
          ) : null}
          {mode !== 'delegate' ? (
            <label className="text-label font-medium text-text">
              {mode === 'revoke' ? 'Lý do thu hồi' : mode === 'approve' ? 'Ý kiến phê duyệt' : 'Kết quả, ý kiến'}
              <textarea className={selectClass} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
          ) : null}
          <span className="flex flex-wrap gap-2">
            {mode === 'approve' ? (
              <>
                <Button variant="primary" onClick={() => action.mutate({ kind: 'approve', result: 'done' })}>
                  Duyệt xử lý xong
                </Button>
                <Button variant="secondary" onClick={() => action.mutate({ kind: 'approve', result: 'not_done' })}>
                  Chưa xử lý xong
                </Button>
              </>
            ) : (
              <Button variant="primary" disabled={action.isPending} onClick={() => action.mutate({ kind: mode })}>
                Ghi
              </Button>
            )}
            <Button variant="text" onClick={() => setMode(undefined)}>
              Hủy
            </Button>
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function DirectiveDetailPanel({ id, onChanged }: { id: string; onChanged?(message: string): void }) {
  const queryClient = useQueryClient();
  const canFile = useHasPermission(PERMISSION_CODES.workFileUse);
  const detail = useQuery({ queryKey: ['directive', id], queryFn: () => readDirective(id) });
  const needsOptions = detail.data?.assignments.some((assignment) => assignment.can_delegate) ?? false;
  const options = useQuery({ queryKey: ['directive-options'], queryFn: readDirectiveOptions, enabled: needsOptions });
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState<string>();
  const refresh = (next: DirectiveDetail, text: string) => {
    queryClient.setQueryData(['directive', id], next);
    void queryClient.invalidateQueries({ queryKey: ['directives'] });
    setMessage(text);
    onChanged?.(text);
  };
  const cancel = useMutation({
    mutationFn: () => cancelDirective(id, cancelReason),
    onSuccess: (next) => refresh(next, 'Đã hủy việc'),
  });
  const recurrence = useMutation({
    mutationFn: (value: DirectiveRecurrence) => updateDirective(id, { recurrence: value }),
    onSuccess: (next) => refresh(next, 'Đã đổi nhắc việc định kì'),
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadDirectiveFile(id, file),
    onSuccess: (next) => refresh(next, 'Đã đính kèm tệp'),
  });
  const removeFile = useMutation({
    mutationFn: (fileId: string) => deleteDirectiveFile(id, fileId),
    onSuccess: (next) => refresh(next, 'Đã xóa tệp'),
  });
  if (detail.error) {
    return <Alert tone="danger">{messageOf(detail.error)}</Alert>;
  }
  const task = detail.data;
  if (!task) {
    return <p className="text-content text-text-secondary">Đang tải…</p>;
  }
  const open = task.status === 'todo' || task.status === 'in_progress';
  return (
    <div className="flex flex-col gap-3" aria-label={`Chi tiết công việc ${task.title}`}>
      {message ? <Alert tone="success">{message}</Alert> : null}
      {[cancel.error, recurrence.error, upload.error, removeFile.error].filter(Boolean).map((error, index) => (
        <Alert key={index} tone="danger">
          {messageOf(error)}
        </Alert>
      ))}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-content md:grid-cols-[12rem_minmax(0,1fr)]">
        <dt className="font-medium">Nội dung nhiệm vụ</dt>
        <dd className="whitespace-pre-wrap">{task.description}</dd>
        <dt className="font-medium">Lãnh đạo giao việc</dt>
        <dd>{task.leader_name ?? ''}</dd>
        <dt className="font-medium">Người giao việc</dt>
        <dd>{task.assigner_name}</dd>
        <dt className="font-medium">Mức độ</dt>
        <dd>{DIRECTIVE_PRIORITY_LABELS[task.priority]}</dd>
        <dt className="font-medium">Ngày bắt đầu, hạn</dt>
        <dd>
          {formatDate(task.start_date)} – {formatDate(task.due_date)}{' '}
          {task.overdue ? <StatusBadge tone="danger" label="Quá hạn" /> : null}
        </dd>
        <dt className="font-medium">Trạng thái</dt>
        <dd>
          {TASK_STATUS_LABELS[task.status]}, {task.progress_percent}%
          {task.cancel_reason ? `. Lý do hủy: ${task.cancel_reason}` : ''}
        </dd>
        {task.source_document_label ? (
          <>
            <dt className="font-medium">Văn bản đến</dt>
            <dd>{task.source_document_label}</dd>
          </>
        ) : null}
        {task.related_documents ? (
          <>
            <dt className="font-medium">Văn bản liên quan</dt>
            <dd>{task.related_documents}</dd>
          </>
        ) : null}
        <dt className="font-medium">Nhắc việc định kì</dt>
        <dd>
          {task.can_edit ? (
            <select
              aria-label="Nhắc việc định kì"
              className={FORM_CONTROL_CLASS}
              value={task.recurrence}
              onChange={(event) => recurrence.mutate(event.target.value as DirectiveRecurrence)}
            >
              {RECURRENCES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            DIRECTIVE_RECURRENCE_LABELS[task.recurrence]
          )}
          {task.next_reminder_on && open ? ` (lần tới ${formatDate(task.next_reminder_on)})` : ''}
        </dd>
      </dl>
      <h3 className="text-content font-semibold">Phân công thực hiện</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-content">
          <thead>
            <tr className="border-b border-border text-left text-label text-text-secondary">
              <th className="p-2">Vai</th>
              <th className="p-2">Người, đơn vị xử lý</th>
              <th className="p-2">Bắt đầu</th>
              <th className="p-2">Hết hạn</th>
              <th className="p-2">Trạng thái</th>
              <th className="p-2">Kết quả</th>
              <th className="p-2">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {task.assignments.map((assignment) => (
              <tr key={assignment.id} className="border-b border-border align-top">
                <td className="p-2">
                  {assignment.parent_id ? '↳ ' : ''}
                  {DIRECTIVE_ROLE_LABELS[assignment.role]}
                </td>
                <td className="p-2">
                  {handlerName(assignment)}{' '}
                  <span className="text-label text-text-secondary">
                    ({DIRECTIVE_TARGET_LABELS[assignment.target_type]})
                  </span>
                </td>
                <td className="p-2">{formatDate(assignment.start_date)}</td>
                <td className="p-2">
                  {formatDate(assignment.due_date)}{' '}
                  {assignment.overdue ? <StatusBadge tone="danger" label="Quá hạn" /> : null}
                </td>
                <td className="p-2">
                  <StatusBadge
                    tone={STATUS_TONES[assignment.status]}
                    label={`${DIRECTIVE_ASSIGNMENT_STATUS_LABELS[assignment.status]} ${assignment.progress_percent}%`}
                  />
                  {assignment.approval_result === 'not_done' && assignment.status !== 'done' ? (
                    <span className="block text-label text-warning">Duyệt chưa xử lý xong</span>
                  ) : null}
                </td>
                <td className="p-2">
                  {assignment.result_note ?? ''}
                  {assignment.approval_note ? (
                    <span className="block text-label text-text-secondary">
                      Ý kiến duyệt: {assignment.approval_note}
                    </span>
                  ) : null}
                </td>
                <td className="p-2">
                  <AssignmentActions task={task} assignment={assignment} options={options.data} onChanged={refresh} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="text-content font-semibold">Tệp đính kèm</h3>
      <ul className="flex flex-col gap-1 text-content">
        {task.files.map((file) => (
          <li key={file.id} className="flex flex-wrap items-center gap-2">
            <button type="button" className="text-link underline" onClick={() => void downloadDirectiveFile(id, file)}>
              {file.file_name}
            </button>
            <span className="text-label text-text-secondary">{file.created_by_name}</span>
            <Button variant="text" onClick={() => removeFile.mutate(file.id)}>
              Xóa tệp
            </Button>
          </li>
        ))}
      </ul>
      {open ? (
        <label className="text-label font-medium text-text">
          Đính kèm tệp
          <input
            type="file"
            className="mt-1 block"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
              event.target.value = '';
            }}
          />
        </label>
      ) : null}
      {canFile ? <SaveToWorkFile itemType="task" itemId={task.id} /> : null}
      <h3 className="text-content font-semibold">Lịch sử cập nhật tiến độ</h3>
      <ul className="flex flex-col gap-1 text-content">
        {task.updates.length === 0 ? <li className="text-text-secondary">Chưa có cập nhật</li> : null}
        {task.updates.map((update) => (
          <li key={update.id}>
            {formatDateTime(update.created_at)} – <span className="font-medium">{update.created_by_name}</span>:{' '}
            {update.progress_percent}%{update.content ? `. ${update.content}` : ''}
          </li>
        ))}
      </ul>
      {task.can_edit ? (
        <div className="flex flex-wrap items-end gap-2">
          {cancelling ? (
            <>
              <label className="text-label font-medium text-text">
                Lý do hủy việc
                <input
                  className={selectClass}
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                />
              </label>
              <Button variant="primary" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
                Xác nhận hủy việc
              </Button>
              <Button variant="text" onClick={() => setCancelling(false)}>
                Thôi
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setCancelling(true)}>
              Hủy việc
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---- 4.2 Công việc cần xử lý ----

const INBOX_COLUMNS: Array<DataGridColumn<InboxItem>> = [
  {
    id: 'title',
    header: 'Nội dung công việc',
    alwaysVisible: true,
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1">
        {row.overdue ? <span className="text-label font-semibold text-danger">[QH]</span> : null}
        <span className={row.priority === 'high' ? 'font-semibold text-danger' : 'font-medium'}>{row.title}</span>
      </span>
    ),
  },
  { id: 'role', header: 'Vai', cell: (row) => DIRECTIVE_ROLE_LABELS[row.role] },
  {
    id: 'target',
    header: 'Loại',
    cell: (row) => (row.target_type === 'staff' ? 'Việc cho cá nhân' : 'Việc cho đơn vị'),
  },
  { id: 'handler', header: 'Người, đơn vị xử lý', hiddenByDefault: true, cell: (row) => handlerName(row) },
  { id: 'assigner_name', header: 'Người giao việc', cell: (row) => row.leader_name ?? row.assigner_name },
  { id: 'priority', header: 'Mức độ', cell: (row) => DIRECTIVE_PRIORITY_LABELS[row.priority] },
  { id: 'start_date', header: 'Ngày bắt đầu', cell: (row) => formatDate(row.start_date) },
  {
    id: 'due_date',
    header: 'Ngày hết hạn',
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1">
        {formatDate(row.due_date)}
        {row.overdue ? <StatusBadge tone="danger" label="Quá hạn" /> : null}
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => (
      <StatusBadge
        tone={STATUS_TONES[row.status]}
        label={`${DIRECTIVE_ASSIGNMENT_STATUS_LABELS[row.status]} ${row.progress_percent}%`}
      />
    ),
  },
  { id: 'source', header: 'Văn bản đến', hiddenByDefault: true, cell: (row) => row.source_document_label ?? '' },
];

export function DirectiveInboxPage() {
  const grid = useGridSettings('directive-inbox');
  const [filter, setFilter] = useState({
    status: '' as DirectiveStatusFilter | '',
    role: '' as DirectiveRole | '',
    target: '' as DirectiveTarget | '',
    q: '',
  });
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string>();
  const list = useQuery({
    queryKey: ['directives', 'inbox', filter, page, grid.settings.pageSize],
    queryFn: () => listInbox({ ...filter, page, page_size: grid.settings.pageSize }),
  });
  const set = <Key extends keyof typeof filter>(key: Key, value: (typeof filter)[Key]) => {
    setFilter((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  return (
    <Page path="/directives/inbox">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-label font-medium text-text">
          Trạng thái
          <select
            className={selectClass}
            value={filter.status}
            onChange={(event) => set('status', event.target.value as DirectiveStatusFilter | '')}
          >
            <option value="">Tất cả</option>
            {STATUS_FILTERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Vai
          <select
            className={selectClass}
            value={filter.role}
            onChange={(event) => set('role', event.target.value as DirectiveRole | '')}
          >
            <option value="">Tất cả</option>
            {(Object.entries(DIRECTIVE_ROLE_LABELS) as Array<[DirectiveRole, string]>).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Loại
          <select
            className={selectClass}
            value={filter.target}
            onChange={(event) => set('target', event.target.value as DirectiveTarget | '')}
          >
            <option value="">Tất cả</option>
            <option value="staff">Việc cho cá nhân</option>
            <option value="unit">Việc cho đơn vị</option>
          </select>
        </label>
      </div>
      {list.error ? <Alert tone="danger">{messageOf(list.error)}</Alert> : null}
      <DataGrid
        label="Công việc cần xử lý"
        columns={INBOX_COLUMNS}
        rows={list.data?.items ?? []}
        getRowId={(row) => row.assignment_id}
        getRowLabel={(row) => row.title}
        loading={!list.data && !list.error}
        emptyText="Không có công việc theo bộ lọc."
        search={{ label: 'Tìm theo nội dung', value: filter.q, onChange: (value) => set('q', value) }}
        onRowClick={(row) => setActiveId(activeId === row.assignment_id ? undefined : row.assignment_id)}
        activeRowId={activeId}
        renderRowDetail={(row) => (activeId === row.assignment_id ? <DirectiveDetailPanel id={row.id} /> : null)}
        settings={grid.settings}
        onSettingsChange={grid.update}
        serverPagination={{ page, total: list.data?.total ?? 0, onPageChange: setPage }}
      />
    </Page>
  );
}

// ---- 4.3 Công việc đã giao ----

const OUTBOX_COLUMNS: Array<DataGridColumn<OutboxItem>> = [
  {
    id: 'title',
    header: 'Nội dung công việc',
    alwaysVisible: true,
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1">
        {row.overdue ? <span className="text-label font-semibold text-danger">[QH]</span> : null}
        <span className="font-medium">{row.title}</span>
        {row.pending_approval > 0 ? (
          <StatusBadge tone="warning" label={`${row.pending_approval} chờ phê duyệt`} />
        ) : null}
      </span>
    ),
  },
  { id: 'main_handlers', header: 'Xử lý chính', cell: (row) => row.main_handlers },
  { id: 'coordinate_handlers', header: 'Phối hợp', cell: (row) => row.coordinate_handlers },
  { id: 'follow_handlers', header: 'Theo dõi', hiddenByDefault: true, cell: (row) => row.follow_handlers },
  { id: 'priority', header: 'Mức độ', cell: (row) => DIRECTIVE_PRIORITY_LABELS[row.priority] },
  { id: 'due_date', header: 'Hạn', cell: (row) => formatDate(row.due_date) },
  { id: 'status', header: 'Trạng thái', cell: (row) => `${TASK_STATUS_LABELS[row.status]} ${row.progress_percent}%` },
  {
    id: 'task_type',
    header: 'Loại giao',
    hiddenByDefault: true,
    cell: (row) => (row.task_type === 'directive' ? 'Theo cây đơn vị' : 'Công việc và kế hoạch (3.1 Nhân sự)'),
  },
  { id: 'source', header: 'Văn bản đến', hiddenByDefault: true, cell: (row) => row.source_document_label ?? '' },
];

export function DirectiveOutboxPage() {
  const grid = useGridSettings('directive-outbox');
  const [status, setStatus] = useState<DirectiveStatusFilter | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string>();
  const list = useQuery({
    queryKey: ['directives', 'outbox', status, search, page, grid.settings.pageSize],
    queryFn: () => listOutbox({ status, q: search, page, page_size: grid.settings.pageSize }),
  });
  return (
    <Page path="/directives/outbox">
      <label className="max-w-sm text-label font-medium text-text">
        Trạng thái
        <select
          className={selectClass}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as DirectiveStatusFilter | '');
            setPage(1);
          }}
        >
          <option value="">Tất cả</option>
          {STATUS_FILTERS.filter(([value]) => !value.startsWith('approved')).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {list.error ? <Alert tone="danger">{messageOf(list.error)}</Alert> : null}
      <DataGrid
        label="Công việc đã giao"
        columns={OUTBOX_COLUMNS}
        rows={list.data?.items ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.title}
        loading={!list.data && !list.error}
        emptyText="Chưa có công việc đã giao."
        search={{
          label: 'Tìm theo nội dung',
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
        }}
        onRowClick={(row) => setActiveId(activeId === row.id ? undefined : row.id)}
        activeRowId={activeId}
        renderRowDetail={(row) =>
          activeId === row.id ? (
            row.task_type === 'directive' ? (
              <DirectiveDetailPanel id={row.id} />
            ) : (
              <p className="text-content text-text-secondary">
                Việc giao cho một người ở 3.1 Công việc và kế hoạch của phân hệ Nhân sự; xem, sửa ở màn hình đó.
              </p>
            )
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
        serverPagination={{ page, total: list.data?.total ?? 0, onPageChange: setPage }}
      />
    </Page>
  );
}

// Ở chi tiết văn bản đến (18a): tạo việc từ văn bản, lưu văn bản vào hồ sơ công việc, danh sách việc đã tạo từ văn bản
export function DocumentTaskLinks({
  documentId,
  label,
  registered,
}: {
  documentId: string;
  label: string;
  registered: boolean;
}) {
  const navigate = useNavigate();
  const canDirect = useHasPermission(PERMISSION_CODES.taskDirect);
  const canFile = useHasPermission(PERMISSION_CODES.workFileUse);
  const tasks = useQuery({ queryKey: ['document-tasks', documentId], queryFn: () => listDocumentTasks(documentId) });
  return (
    <section aria-label="Công việc từ văn bản" className="flex flex-col gap-2">
      <span className="flex flex-wrap items-center gap-2">
        {canDirect && registered ? (
          <Button
            variant="secondary"
            onClick={() =>
              void navigate({ to: '/directives/new', search: { document_id: documentId, document_label: label } })
            }
          >
            Tạo công việc
          </Button>
        ) : null}
        {canFile ? <SaveToWorkFile itemType="incoming_document" itemId={documentId} /> : null}
      </span>
      {tasks.data && tasks.data.length > 0 ? (
        <ul className="flex flex-col gap-1 text-content">
          {tasks.data.map((task) => (
            <li key={task.id}>
              Công việc: <span className="font-medium">{task.title}</span> – {task.assigner_name}, hạn{' '}
              {formatDate(task.due_date)} (
              {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status})
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
