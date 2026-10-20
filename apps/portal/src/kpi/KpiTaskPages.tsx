import { useCallback, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KPI_TASK_ORIGIN_LABELS, KPI_TASK_STATUS_LABELS, type KpiRuleConfig } from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import {
  downloadFile,
  listCatalog,
  listMyTasks,
  listStaffOptions,
  listTasks,
  messageOf,
  readTask,
  send,
  uploadFile,
  vietnamToday,
  type Task,
} from './kpi-api.js';
import { displayName, filterClass, PeriodSelect, usePeriodChoice, useRuleConfig } from './KpiCommon.js';

// MH-163 Việc của tôi, MH-164 Giao việc và duyệt đăng ký, MH-165 Chấm điểm công việc (DT-18 phần 18d, YCTD-139): cán bộ đăng
// ký việc, xác nhận hoặc chuyển trả việc được giao, nộp minh chứng (số ký hiệu văn bản ghi chữ tự do, tệp), xin gia hạn, tự
// đánh giá; người quản lý giao việc cho một hoặc nhiều người, duyệt đăng ký, giao lại việc bị chuyển trả, duyệt gia hạn, hủy
// việc, ủy quyền chấm; người chấm chấm mức kết quả, điều chỉnh tiến độ khi chậm vì lý do khách quan, xác nhận vượt yêu cầu
// và thưởng, hoặc trả lại làm lại
const statusText = (task: Task) =>
  `${KPI_TASK_STATUS_LABELS[task.status] ?? task.status}${task.auto_approved ? ' (tự vào danh mục)' : ''}${
    task.auto_graded ? ' (lấy kết quả tự đánh giá)' : ''
  }`;

const BASE_COLUMNS: Array<DataGridColumn<Task>> = [
  {
    id: 'name',
    header: 'Tên công việc',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => displayName(row),
  },
  { id: 'axis_code', header: 'Trục', cell: (row) => row.axis_code },
  {
    id: 'origin',
    header: 'Nguồn',
    cell: (row) => `${KPI_TASK_ORIGIN_LABELS[row.origin] ?? row.origin}${row.in_plan ? '' : ', phát sinh'}`,
  },
  { id: 'deadline', header: 'Hạn', cell: (row) => row.deadline },
  { id: 'max_converted', header: 'Điểm tối đa', cell: (row) => row.max_converted },
  { id: 'status', header: 'Trạng thái', cell: statusText },
  { id: 'converted_score', header: 'Điểm quy đổi', cell: (row) => row.converted_score ?? '' },
  {
    id: 'document_number',
    header: 'Số ký hiệu văn bản',
    hiddenByDefault: true,
    cell: (row) => row.document_number ?? '',
  },
  {
    id: 'evaluator_name',
    header: 'Người chấm được ủy quyền',
    hiddenByDefault: true,
    cell: (row) => row.evaluator_name ?? '',
  },
];

const MANAGER_COLUMNS: Array<DataGridColumn<Task>> = [
  { id: 'full_name', header: 'Người thực hiện', alwaysVisible: true, cell: (row) => row.full_name },
  { id: 'org_unit_name', header: 'Đơn vị', hiddenByDefault: true, cell: (row) => row.org_unit_name },
  ...BASE_COLUMNS,
];

function levelOptions(config: KpiRuleConfig | undefined) {
  if (!config) {
    return [];
  }
  return config.scoring_mode === 'progress_quality'
    ? config.quality_levels.map((level) => ({ code: level.code, label: `${level.percent}% — ${level.label}` }))
    : config.result_levels.map((level) => ({ code: level.code, label: `${level.label} (${level.percent / 100})` }));
}

// Biểu mẫu nội dung việc: chọn từ danh mục hoặc nhập mới
function TaskContentForm({
  title,
  config,
  submitLabel,
  extra,
  onSubmit,
  onCancel,
  busy,
  error,
}: {
  title: string;
  config: KpiRuleConfig | undefined;
  submitLabel: string;
  extra?: ReactNode;
  onSubmit(body: Record<string, unknown>): void;
  onCancel(): void;
  busy: boolean;
  error: unknown;
}) {
  const catalog = useQuery({
    queryKey: ['kpi', 'catalog', 'status=active'],
    queryFn: () => listCatalog('status=active'),
  });
  const [catalogItemId, setCatalogItemId] = useState('');
  const [name, setName] = useState('');
  const [axisCode, setAxisCode] = useState('');
  const [difficultyCode, setDifficultyCode] = useState('');
  const [deadline, setDeadline] = useState(vietnamToday());
  const [confidential, setConfidential] = useState(false);
  return (
    <form
      aria-label={title}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          catalog_item_id: catalogItemId || null,
          name: name || null,
          axis_code: axisCode || (catalogItemId ? null : config?.axes[0]?.code),
          difficulty_code: difficultyCode || null,
          deadline,
          is_confidential: confidential,
        });
      }}
    >
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <FormBlock title={title}>
        {extra}
        <FormRow label="Chọn từ danh mục">
          <select
            className={FORM_CONTROL_CLASS}
            value={catalogItemId}
            onChange={(event) => setCatalogItemId(event.target.value)}
          >
            <option value="">Nhập việc mới</option>
            {(catalog.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} — {item.is_confidential ? '(Mật) ' : ''}
                {item.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Tên công việc">
          <input
            className={FORM_CONTROL_CLASS}
            value={name}
            placeholder={catalogItemId ? 'Để trống thì lấy tên trong danh mục' : ''}
            onChange={(event) => setName(event.target.value)}
          />
        </FormRow>
        <FormRow label="Trục">
          <select className={FORM_CONTROL_CLASS} value={axisCode} onChange={(event) => setAxisCode(event.target.value)}>
            {catalogItemId ? <option value="">Theo danh mục</option> : null}
            {(config?.axes ?? []).map((axis) => (
              <option key={axis.code} value={axis.code}>
                {axis.code}. {axis.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Hệ số độ khó">
          <select
            className={FORM_CONTROL_CLASS}
            value={difficultyCode}
            onChange={(event) => setDifficultyCode(event.target.value)}
          >
            <option value="">{catalogItemId ? 'Theo danh mục' : 'Mức đầu tiên'}</option>
            {(config?.difficulty_levels ?? []).map((level) => (
              <option key={level.code} value={level.code}>
                {level.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Hạn hoàn thành">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        </FormRow>
        <FormRow label="Nội dung mật">
          <input type="checkbox" checked={confidential} onChange={(event) => setConfidential(event.target.checked)} />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {submitLabel}
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

// Chi tiết việc của tôi: minh chứng, tệp, gia hạn, tự đánh giá
function MyTaskDetail({
  task,
  config,
  onChanged,
}: {
  task: Task;
  config: KpiRuleConfig | undefined;
  onChanged(message: string): void;
}) {
  const detail = useQuery({ queryKey: ['kpi', 'task', task.id], queryFn: () => readTask(task.id) });
  const [finish, setFinish] = useState(task.actual_finish_date ?? vietnamToday());
  const [evidence, setEvidence] = useState(task.evidence_text ?? '');
  const [documentNumber, setDocumentNumber] = useState(task.document_number ?? '');
  const [level, setLevel] = useState(task.self_quality_code ?? task.self_result_code ?? '');
  const [bonus, setBonus] = useState(task.bonus_proposed);
  const [bonusReason, setBonusReason] = useState(task.bonus_reason ?? '');
  const [file, setFile] = useState<File>();
  const [extension, setExtension] = useState('');
  const [extensionReason, setExtensionReason] = useState('');
  const editable = task.status === 'in_progress' || task.status === 'rework';
  const saveEvidence = useMutation({
    mutationFn: () =>
      send('PUT', `/api/v1/kpi/tasks/${task.id}/evidence`, {
        actual_finish_date: finish || null,
        evidence_text: evidence || null,
        document_number: documentNumber || null,
      }),
    onSuccess: () => onChanged('Đã ghi minh chứng'),
  });
  const attach = useMutation({
    mutationFn: () => uploadFile(`/api/v1/kpi/tasks/${task.id}/files`, {}, file!),
    onSuccess: () => onChanged('Đã đính kèm tệp minh chứng'),
  });
  const selfAssess = useMutation({
    mutationFn: async () => {
      await send('PUT', `/api/v1/kpi/tasks/${task.id}/evidence`, {
        actual_finish_date: finish || null,
        evidence_text: evidence || null,
        document_number: documentNumber || null,
      });
      return send('POST', `/api/v1/kpi/tasks/${task.id}/self-assess`, {
        [config?.scoring_mode === 'level_scale' ? 'result_code' : 'quality_code']: level,
        bonus_proposed: bonus,
        bonus_reason: bonusReason || null,
      });
    },
    onSuccess: () => onChanged('Đã nộp kết quả tự đánh giá, chờ cấp trên chấm'),
  });
  const requestExtension = useMutation({
    mutationFn: () =>
      send('POST', `/api/v1/kpi/tasks/${task.id}/extension`, {
        requested_deadline: extension,
        reason: extensionReason,
      }),
    onSuccess: () => onChanged('Đã gửi đề nghị gia hạn'),
  });
  const open = useMutation({
    mutationFn: (fileId: string) => downloadFile(`/api/v1/kpi/tasks/${task.id}/files/${fileId}`, 'minh-chung'),
  });
  const error = [saveEvidence.error, attach.error, selfAssess.error, requestExtension.error, open.error].find(Boolean);
  return (
    <div className="flex flex-col gap-3" aria-label={`Chi tiết việc ${task.name}`}>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {task.return_reason ? <span className="text-label">Lý do chuyển trả: {task.return_reason}</span> : null}
      {task.rework_reason ? <span className="text-label">Cấp trên trả lại: {task.rework_reason}</span> : null}
      {task.decision_note ? <span className="text-label">Ghi chú của cấp trên: {task.decision_note}</span> : null}
      {task.grader_comment ? <span className="text-label">Nhận xét khi chấm: {task.grader_comment}</span> : null}
      {task.progress_percent !== null ? (
        <span className="text-label">
          Tiến độ {task.progress_percent}% (chậm {task.late_days ?? 0} ngày làm việc); tỷ lệ hoàn thành{' '}
          {task.task_percent}%; điểm thực hiện {task.execution_score}; điểm quy đổi {task.converted_score}
          {task.exceeded ? '; vượt yêu cầu' : ''}
          {task.bonus_score ? `; thưởng ${task.bonus_score}` : ''}
        </span>
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-label font-medium text-text">
          Ngày hoàn thành
          <input
            type="date"
            disabled={!editable}
            className={filterClass}
            value={finish}
            onChange={(event) => setFinish(event.target.value)}
          />
        </label>
        <label className="text-label font-medium text-text">
          Số ký hiệu văn bản
          <input
            disabled={!editable}
            className={filterClass}
            placeholder="Ví dụ 12/KH-TRƯỜNG ngày 01/10/2026"
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
          />
        </label>
        <label className="text-label font-medium text-text">
          Mô tả minh chứng, kết quả
          <input
            disabled={!editable}
            className={filterClass}
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {(detail.data?.files ?? []).map((item) => (
          <Button key={item.id} variant="text" onClick={() => open.mutate(item.id)}>
            {item.file_name}
          </Button>
        ))}
        {editable ? (
          <>
            <label className="text-label font-medium text-text">
              Tệp minh chứng
              <input type="file" className={filterClass} onChange={(event) => setFile(event.target.files?.[0])} />
            </label>
            <Button disabled={!file || attach.isPending} onClick={() => attach.mutate()}>
              Đính kèm
            </Button>
            <Button onClick={() => saveEvidence.mutate()} disabled={saveEvidence.isPending}>
              Ghi minh chứng
            </Button>
          </>
        ) : null}
      </div>
      {editable ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-label font-medium text-text">
            Tự đánh giá kết quả
            <select className={filterClass} value={level} onChange={(event) => setLevel(event.target.value)}>
              <option value="">Chọn mức</option>
              {levelOptions(config).map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-label font-medium text-text">
            <input type="checkbox" checked={bonus} onChange={(event) => setBonus(event.target.checked)} /> Đề xuất
            thưởng (nổi trội, sáng kiến)
            {bonus ? (
              <input
                className={filterClass}
                placeholder="Lý do đề xuất thưởng"
                value={bonusReason}
                onChange={(event) => setBonusReason(event.target.value)}
              />
            ) : null}
          </label>
          <div className="flex items-end">
            <Button variant="primary" disabled={!level || selfAssess.isPending} onClick={() => selfAssess.mutate()}>
              Nộp kết quả tự đánh giá
            </Button>
          </div>
        </div>
      ) : null}
      {editable && task.extension_status !== 'pending' ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-label font-medium text-text">
            Xin gia hạn đến ngày
            <input
              type="date"
              className={filterClass}
              value={extension}
              onChange={(event) => setExtension(event.target.value)}
            />
          </label>
          <label className="text-label font-medium text-text">
            Lý do
            <input
              className={filterClass}
              value={extensionReason}
              onChange={(event) => setExtensionReason(event.target.value)}
            />
          </label>
          <Button
            disabled={!extension || !extensionReason || requestExtension.isPending}
            onClick={() => requestExtension.mutate()}
          >
            Xin gia hạn
          </Button>
        </div>
      ) : task.extension_status === 'pending' ? (
        <span className="text-label">Đang chờ duyệt gia hạn đến {task.requested_deadline}</span>
      ) : null}
    </div>
  );
}

export function KpiMyTasksPage() {
  const queryClient = useQueryClient();
  const choice = usePeriodChoice();
  const periodId = choice.period?.id;
  const tasks = useQuery({
    queryKey: ['kpi', 'my-tasks', periodId],
    queryFn: () => listMyTasks(periodId!),
    enabled: Boolean(periodId),
  });
  const evaluation = useQuery({
    queryKey: ['kpi', 'my-evaluation-version', periodId],
    queryFn: () => send<{ rule_set_version_id: string }>('GET', `/api/v1/kpi/evaluations/mine?period_id=${periodId}`),
    enabled: Boolean(periodId) && choice.period?.status === 'open',
    retry: false,
  });
  const config = useRuleConfig(evaluation.data?.rule_set_version_id);
  const grid = useGridSettings('kpi-my-tasks');
  const [registering, setRegistering] = useState(false);
  const [openId, setOpenId] = useState<string>();
  const [search, setSearch] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const changed = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ['kpi'] });
    setRegistering(false);
    setToastMessage(message);
  };
  const register = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      send('POST', '/api/v1/kpi/tasks/register', { ...body, period_id: periodId }),
    onSuccess: () => changed('Đã đăng ký việc, chờ cấp trên duyệt'),
  });
  const accept = useMutation({
    mutationFn: (task: Task) => send('POST', `/api/v1/kpi/tasks/${task.id}/accept`),
    onSuccess: () => changed('Đã xác nhận việc'),
  });
  const returnTask = useMutation({
    mutationFn: (task: Task) =>
      send('POST', `/api/v1/kpi/tasks/${task.id}/return`, { reason: window.prompt('Lý do chuyển trả việc') ?? '' }),
    onSuccess: () => changed('Đã chuyển trả việc cho người giao'),
  });
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (tasks.data ?? []).filter((task) => !keyword || task.name.toLocaleLowerCase('vi').includes(keyword));
  const error = [choice.error, tasks.error, accept.error, returnTask.error, grid.error].find(Boolean);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/kpi/my-tasks')}</h1>
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        {evaluation.error ? <Alert tone="warning">{messageOf(evaluation.error)}</Alert> : null}
        <PeriodSelect choice={choice} />
        {registering ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <TaskContentForm
              title="Đăng ký việc"
              config={config}
              submitLabel="Gửi đăng ký"
              busy={register.isPending}
              error={register.error}
              onSubmit={(body) => register.mutate(body)}
              onCancel={() => setRegistering(false)}
            />
          </section>
        ) : null}
        <DataGrid
          label="Việc của tôi"
          columns={BASE_COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `việc ${row.name}`}
          getRowAriaLabel={(row) => `Việc ${row.name}`}
          loading={tasks.isPending && Boolean(periodId)}
          emptyText="Chưa có việc trong kỳ."
          search={{ label: 'Tìm theo tên công việc', value: search, onChange: setSearch }}
          toolbar={
            choice.period?.status === 'open' ? (
              <Button variant="primary" onClick={() => setRegistering(true)}>
                Đăng ký việc
              </Button>
            ) : null
          }
          rowActions={(task) => (
            <span className="flex flex-wrap justify-end gap-2">
              {task.status === 'assigned' ? (
                <>
                  <Button onClick={() => accept.mutate(task)}>Xác nhận</Button>
                  <Button variant="text" onClick={() => returnTask.mutate(task)}>
                    Chuyển trả
                  </Button>
                </>
              ) : null}
              <Button variant="text" onClick={() => setOpenId(openId === task.id ? undefined : task.id)}>
                {openId === task.id ? 'Ẩn' : 'Chi tiết'}
              </Button>
            </span>
          )}
          activeRowId={openId}
          renderRowDetail={(task) =>
            openId === task.id ? <MyTaskDetail task={task} config={config} onChanged={changed} /> : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}

const ASSIGNMENT_STATUSES = ['pending_approval', 'assigned', 'returned_to_assigner', 'in_progress', 'rework'];

export function KpiAssignmentsPage() {
  const queryClient = useQueryClient();
  const choice = usePeriodChoice();
  const periodId = choice.period?.id;
  const tasks = useQuery({
    queryKey: ['kpi', 'tasks', periodId],
    queryFn: () => listTasks(periodId!),
    enabled: Boolean(periodId),
  });
  const staff = useQuery({
    queryKey: ['kpi', 'staff-options', periodId],
    queryFn: () => listStaffOptions(periodId!),
    enabled: Boolean(periodId),
  });
  const grid = useGridSettings('kpi-assignments');
  const [assigning, setAssigning] = useState(false);
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [delegateTo, setDelegateTo] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const firstStaff = staff.data?.find((row) => row.id === staffIds[0]);
  const config = useRuleConfig(firstStaff?.rule_set_version_id);
  const changed = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ['kpi'] });
    setAssigning(false);
    setToastMessage(message);
  };
  const assign = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      send('POST', '/api/v1/kpi/tasks/assign', { ...body, period_id: periodId, staff_ids: staffIds }),
    onSuccess: () => changed('Đã giao việc'),
  });
  const decide = useMutation({
    mutationFn: (input: { task: Task; approve: boolean }) =>
      send('POST', `/api/v1/kpi/tasks/${input.task.id}/decision`, {
        approve: input.approve,
        note: input.approve ? null : (window.prompt('Lý do không duyệt') ?? ''),
      }),
    onSuccess: () => changed('Đã xử lý đăng ký'),
  });
  const extension = useMutation({
    mutationFn: (input: { task: Task; approve: boolean }) =>
      send('POST', `/api/v1/kpi/tasks/${input.task.id}/extension/decision`, { approve: input.approve }),
    onSuccess: () => changed('Đã xử lý đề nghị gia hạn'),
  });
  const reassign = useMutation({
    mutationFn: (task: Task) => send('PATCH', `/api/v1/kpi/tasks/${task.id}`, { deadline: task.deadline }),
    onSuccess: () => changed('Đã giao lại việc'),
  });
  const cancel = useMutation({
    mutationFn: (task: Task) =>
      send('POST', `/api/v1/kpi/tasks/${task.id}/cancel`, { reason: window.prompt('Lý do hủy việc') ?? '' }),
    onSuccess: () => changed('Đã hủy việc'),
  });
  const delegate = useMutation({
    mutationFn: (ids: string[]) =>
      send('POST', '/api/v1/kpi/tasks/delegate', { task_ids: ids, evaluator_staff_id: delegateTo || null }),
    onSuccess: () => changed(delegateTo ? 'Đã ủy quyền chấm' : 'Đã thu hồi ủy quyền chấm'),
  });
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (tasks.data ?? []).filter(
    (task) =>
      (status
        ? task.status === status
        : ASSIGNMENT_STATUSES.includes(task.status) || task.extension_status === 'pending') &&
      (!keyword || `${task.name} ${task.full_name}`.toLocaleLowerCase('vi').includes(keyword)),
  );
  const error = [
    choice.error,
    tasks.error,
    staff.error,
    decide.error,
    extension.error,
    reassign.error,
    cancel.error,
    delegate.error,
  ].find(Boolean);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/kpi/assignments')}</h1>
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        <PeriodSelect choice={choice} />
        {assigning ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <TaskContentForm
              title="Giao việc"
              config={config}
              submitLabel="Giao việc"
              busy={assign.isPending}
              error={assign.error}
              onSubmit={(body) => assign.mutate(body)}
              onCancel={() => setAssigning(false)}
              extra={
                <FormRow label="Người thực hiện">
                  <select
                    multiple
                    className={FORM_CONTROL_CLASS}
                    value={staffIds}
                    onChange={(event) => setStaffIds([...event.target.selectedOptions].map((option) => option.value))}
                  >
                    {(staff.data ?? []).map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.full_name} — {row.org_unit_name}
                      </option>
                    ))}
                  </select>
                </FormRow>
              }
            />
          </section>
        ) : null}
        <DataGrid
          label="Giao việc và duyệt đăng ký"
          columns={MANAGER_COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `việc ${row.name} của ${row.full_name}`}
          getRowAriaLabel={(row) => `Việc ${row.name} của ${row.full_name}`}
          loading={tasks.isPending && Boolean(periodId)}
          emptyText="Không có việc chờ xử lý."
          search={{ label: 'Tìm theo tên việc, người thực hiện', value: search, onChange: setSearch }}
          advancedSearch={
            <label className="text-label font-medium text-text">
              Trạng thái
              <select className={filterClass} value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Đang chờ xử lý</option>
                {Object.entries(KPI_TASK_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          }
          selectable
          toolbar={(selected) => (
            <span className="flex flex-wrap items-end gap-2">
              {choice.period?.status === 'open' ? (
                <Button variant="primary" onClick={() => setAssigning(true)}>
                  Giao việc
                </Button>
              ) : null}
              <label className="text-label font-medium text-text">
                Ủy quyền chấm cho
                <select
                  className={filterClass}
                  value={delegateTo}
                  onChange={(event) => setDelegateTo(event.target.value)}
                >
                  <option value="">Thu hồi ủy quyền</option>
                  {(staff.data ?? []).map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                disabled={selected.length === 0 || delegate.isPending}
                onClick={() => delegate.mutate(selected.map((row) => row.id))}
              >
                Ủy quyền chấm
              </Button>
            </span>
          )}
          rowActions={(task) => (
            <span className="flex flex-wrap justify-end gap-2">
              {task.status === 'pending_approval' ? (
                <>
                  <Button onClick={() => decide.mutate({ task, approve: true })}>Duyệt</Button>
                  <Button variant="text" onClick={() => decide.mutate({ task, approve: false })}>
                    Không duyệt
                  </Button>
                </>
              ) : null}
              {task.status === 'returned_to_assigner' ? (
                <Button onClick={() => reassign.mutate(task)}>Giao lại</Button>
              ) : null}
              {task.extension_status === 'pending' ? (
                <>
                  <Button onClick={() => extension.mutate({ task, approve: true })}>Duyệt gia hạn</Button>
                  <Button variant="text" onClick={() => extension.mutate({ task, approve: false })}>
                    Không gia hạn
                  </Button>
                </>
              ) : null}
              {['pending_approval', 'assigned', 'returned_to_assigner', 'in_progress'].includes(task.status) ? (
                <Button variant="text" onClick={() => cancel.mutate(task)}>
                  Hủy việc
                </Button>
              ) : null}
            </span>
          )}
          renderRowDetail={(task) =>
            task.return_reason || task.extension_reason ? (
              <span className="text-label">
                {task.return_reason ? `Lý do chuyển trả: ${task.return_reason}. ` : ''}
                {task.extension_reason ? `Xin gia hạn đến ${task.requested_deadline}: ${task.extension_reason}` : ''}
              </span>
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}

function GradeForm({ task, onChanged }: { task: Task; onChanged(message: string): void }) {
  const evaluationVersion = useQuery({
    queryKey: ['kpi', 'task', task.id],
    queryFn: () => readTask(task.id),
  });
  const staffOptions = useQuery({
    queryKey: ['kpi', 'staff-options', task.period_id],
    queryFn: () => listStaffOptions(task.period_id),
  });
  const versionId = staffOptions.data?.find((row) => row.id === task.staff_id)?.rule_set_version_id;
  const config = useRuleConfig(versionId);
  const [level, setLevel] = useState(
    task.quality_code ?? task.result_code ?? task.self_quality_code ?? task.self_result_code ?? '',
  );
  const [progress, setProgress] = useState('');
  const [progressReason, setProgressReason] = useState('');
  const [exceeded, setExceeded] = useState(task.exceeded);
  const [bonus, setBonus] = useState(task.bonus_approved || task.bonus_proposed);
  const [comment, setComment] = useState(task.grader_comment ?? '');
  const grade = useMutation({
    mutationFn: () =>
      send('POST', `/api/v1/kpi/tasks/${task.id}/grade`, {
        [config?.scoring_mode === 'level_scale' ? 'result_code' : 'quality_code']: level,
        progress_percent: progress === '' ? null : Number(progress),
        progress_adjust_reason: progressReason || null,
        exceeded,
        bonus_approved: bonus,
        comment: comment || null,
      }),
    onSuccess: () => onChanged('Đã chấm việc'),
  });
  const rework = useMutation({
    mutationFn: () => send('POST', `/api/v1/kpi/tasks/${task.id}/rework`, { reason: comment }),
    onSuccess: () => onChanged('Đã trả lại để làm lại'),
  });
  const open = useMutation({
    mutationFn: (fileId: string) => downloadFile(`/api/v1/kpi/tasks/${task.id}/files/${fileId}`, 'minh-chung'),
  });
  const error = [grade.error, rework.error, open.error].find(Boolean);
  return (
    <form
      aria-label={`Chấm việc ${task.name}`}
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        grade.mutate();
      }}
    >
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <span className="text-label">
        Hoàn thành {task.actual_finish_date ?? 'chưa ghi'} (hạn {task.deadline}); số ký hiệu văn bản:{' '}
        {task.document_number ?? 'không'}; minh chứng: {task.evidence_text ?? 'không'}; tự đánh giá:{' '}
        {levelOptions(config).find((item) => item.code === (task.self_quality_code ?? task.self_result_code))?.label ??
          ''}
        {task.bonus_proposed ? `; đề xuất thưởng: ${task.bonus_reason ?? ''}` : ''}
      </span>
      <span className="flex flex-wrap gap-2">
        {(evaluationVersion.data?.files ?? []).map((file) => (
          <Button key={file.id} variant="text" onClick={() => open.mutate(file.id)}>
            {file.file_name}
          </Button>
        ))}
      </span>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-label font-medium text-text">
          Mức kết quả
          <select className={filterClass} value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="">Chọn mức</option>
            {levelOptions(config).map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {config?.scoring_mode === 'progress_quality' ? (
          <>
            <label className="text-label font-medium text-text">
              Điều chỉnh tiến độ (%)
              <input
                type="number"
                min={0}
                max={100}
                className={filterClass}
                value={progress}
                placeholder="Để trống: tự tính theo hạn"
                onChange={(event) => setProgress(event.target.value)}
              />
            </label>
            <label className="text-label font-medium text-text">
              Lý do điều chỉnh tiến độ
              <input
                className={filterClass}
                value={progressReason}
                onChange={(event) => setProgressReason(event.target.value)}
              />
            </label>
          </>
        ) : null}
        <label className="text-label font-medium text-text">
          <input type="checkbox" checked={exceeded} onChange={(event) => setExceeded(event.target.checked)} /> Xác nhận
          vượt yêu cầu
        </label>
        <label className="text-label font-medium text-text">
          <input type="checkbox" checked={bonus} onChange={(event) => setBonus(event.target.checked)} /> Xác nhận thưởng
        </label>
        <label className="text-label font-medium text-text">
          Nhận xét
          <input className={filterClass} value={comment} onChange={(event) => setComment(event.target.value)} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={!level || grade.isPending}>
          Chấm
        </Button>
        {task.status === 'self_assessed' ? (
          <Button disabled={!comment || rework.isPending} onClick={() => rework.mutate()}>
            Trả lại làm lại
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function KpiGradingPage() {
  const queryClient = useQueryClient();
  const choice = usePeriodChoice();
  const periodId = choice.period?.id;
  const tasks = useQuery({
    queryKey: ['kpi', 'tasks', periodId],
    queryFn: () => listTasks(periodId!),
    enabled: Boolean(periodId),
  });
  const grid = useGridSettings('kpi-grading');
  const [openId, setOpenId] = useState<string>();
  const [status, setStatus] = useState('self_assessed');
  const [search, setSearch] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (tasks.data ?? []).filter(
    (task) =>
      (status ? task.status === status : ['self_assessed', 'graded'].includes(task.status)) &&
      (!keyword || `${task.name} ${task.full_name}`.toLocaleLowerCase('vi').includes(keyword)),
  );
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/kpi/grading')}</h1>
        {tasks.error ? <Alert tone="danger">{messageOf(tasks.error)}</Alert> : null}
        <PeriodSelect choice={choice} />
        <DataGrid
          label="Chấm điểm công việc"
          columns={MANAGER_COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `việc ${row.name} của ${row.full_name}`}
          getRowAriaLabel={(row) => `Việc ${row.name} của ${row.full_name}`}
          loading={tasks.isPending && Boolean(periodId)}
          emptyText="Không có việc chờ chấm."
          search={{ label: 'Tìm theo tên việc, người thực hiện', value: search, onChange: setSearch }}
          advancedSearch={
            <label className="text-label font-medium text-text">
              Trạng thái
              <select className={filterClass} value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="self_assessed">Chờ chấm</option>
                <option value="graded">Đã chấm</option>
                <option value="">Tất cả</option>
              </select>
            </label>
          }
          rowActions={(task) =>
            choice.period?.status === 'open' ? (
              <Button variant="text" onClick={() => setOpenId(openId === task.id ? undefined : task.id)}>
                {openId === task.id ? 'Ẩn' : task.status === 'graded' ? 'Chấm lại' : 'Chấm'}
              </Button>
            ) : null
          }
          activeRowId={openId}
          renderRowDetail={(task) =>
            openId === task.id ? (
              <GradeForm
                task={task}
                onChanged={(message) => {
                  setOpenId(undefined);
                  void queryClient.invalidateQueries({ queryKey: ['kpi'] });
                  setToastMessage(message);
                }}
              />
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
