import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EDUCATION_PLAN_ACTION_LABELS,
  EDUCATION_PLAN_DEFAULT_KIND,
  EDUCATION_PLAN_PERIOD_LABELS,
  EDUCATION_PLAN_SCOPE_LABELS,
  EDUCATION_PLAN_STATUS_LABELS,
  EDUCATION_PLAN_STEP_LABELS,
  EDUCATION_PLAN_STEPS,
  KPI_SCHOOL_LEVELS,
  type EducationPlanContent,
  type EducationPlanPeriodCode,
  type EducationPlanScopeCode,
  type EducationPlanSection,
  type EducationPlanStatusCode,
  type KpiSchoolLevelCode,
  type PortalQuickLinkPath,
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
import { formatDateTime, Page, Tabs, useToast } from '../directives/directive-ui.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import { listProfessionalFolders } from '../professional-records/professional-api.js';
import {
  copyPreviousPlan,
  createPlan,
  createWorkPlan,
  deletePlan,
  deletePlanTemplate,
  downloadSignedPlan,
  exportPlan,
  exportPlanProgress,
  listPlans,
  listPlanTemplates,
  listPreviousPlans,
  loadDefaultTemplates,
  planAction,
  readPlan,
  readPlanDiff,
  readPlanOverview,
  readPlanProgress,
  savePlanTemplate,
  updatePlan,
  type EducationPlan,
  type EducationPlanDetail,
  type EducationPlanTemplate,
  type PlanDiff,
  type PlanProgress,
  type PreviousPlans,
  type TemplateInput,
} from './education-plan-api.js';

// Kế hoạch giáo dục (DT-18 phần 22i, YCTD-147): kế hoạch của tôi (cá nhân, nhóm lớp), của tổ, nhóm, của trường; duyệt theo
// bước tổ trưởng, Phó Hiệu trưởng, Hiệu trưởng; so sánh với phiên bản cũ hoặc bản năm trước; xuất Word, PDF; bảng tiến độ
// duyệt; thư viện mẫu theo cấp học
const STATUS_TONES: Record<EducationPlanStatusCode, StatusTone> = {
  draft: 'neutral',
  pending: 'info',
  approved: 'success',
  returned: 'warning',
};
const LEVEL_LABEL = (level: KpiSchoolLevelCode | null) =>
  KPI_SCHOOL_LEVELS.find((item) => item.value === level)?.label ?? 'Mọi cấp';
// Màn hình danh sách nào lập loại kế hoạch nào
const VIEW_SCOPES: Record<'mine' | 'groups' | 'school', EducationPlanScopeCode[]> = {
  mine: ['personal', 'class'],
  groups: ['group'],
  school: ['school'],
};

function useOverview() {
  return useQuery({ queryKey: ['education-plans', 'overview'], queryFn: readPlanOverview });
}

const stepsText = (steps: string[]) =>
  steps.length === 0
    ? 'Không duyệt'
    : steps.map((step) => EDUCATION_PLAN_STEP_LABELS[step as keyof typeof EDUCATION_PLAN_STEP_LABELS]).join(' → ');

// ---- Nội dung kế hoạch ----

function SectionView({ section, content }: { section: EducationPlanSection; content: EducationPlanContent }) {
  const value = content[section.key];
  if (section.kind === 'table') {
    const rows = Array.isArray(value) ? value : [];
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-content" aria-label={section.title}>
          <thead>
            <tr>
              {(section.columns ?? []).map((column) => (
                <th key={column.key} className="border border-border px-2 py-1 text-left font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="border border-border px-2 py-1 text-text-secondary" colSpan={section.columns?.length}>
                  Chưa có dòng nào
                </td>
              </tr>
            ) : null}
            {rows.map((row, index) => (
              <tr key={index}>
                {(section.columns ?? []).map((column, cell) => (
                  <td key={column.key} className="border border-border px-2 py-1">
                    {row[cell] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-content">
      {typeof value === 'string' && value ? value : <span className="text-text-secondary">Chưa có nội dung</span>}
    </p>
  );
}

function TableEditor({
  section,
  rows,
  onChange,
}: {
  section: EducationPlanSection;
  rows: string[][];
  onChange(rows: string[][]): void;
}) {
  const columns = section.columns ?? [];
  const setCell = (rowIndex: number, cellIndex: number, value: string) =>
    onChange(
      rows.map((row, index) => (index === rowIndex ? row.map((cell, at) => (at === cellIndex ? value : cell)) : row)),
    );
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-content">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="border border-border px-2 py-1 text-left font-medium">
                  {column.label}
                </th>
              ))}
              <th className="border border-border px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column, cellIndex) => (
                  <td key={column.key} className="border border-border p-1">
                    <input
                      className={FORM_CONTROL_CLASS}
                      type={column.type === 'date' ? 'date' : 'text'}
                      aria-label={`${section.title}, dòng ${rowIndex + 1}, ${column.label}`}
                      value={row[cellIndex] ?? ''}
                      onChange={(event) => setCell(rowIndex, cellIndex, event.target.value)}
                    />
                  </td>
                ))}
                <td className="border border-border p-1">
                  <Button
                    variant="text"
                    aria-label={`Xóa dòng ${rowIndex + 1} của ${section.title}`}
                    onClick={() => onChange(rows.filter((_row, index) => index !== rowIndex))}
                  >
                    Xóa
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span>
        <Button
          variant="secondary"
          aria-label={`Thêm dòng vào ${section.title}`}
          onClick={() => onChange([...rows, columns.map(() => '')])}
        >
          Thêm dòng
        </Button>
      </span>
    </div>
  );
}

function PlanEditor({ plan, onSaved }: { plan: EducationPlanDetail; onSaved(next: EducationPlanDetail): void }) {
  const [values, setValues] = useState({
    title: plan.title,
    period_label: plan.period_label ?? '',
    period_start: plan.period_start ?? '',
    period_end: plan.period_end ?? '',
  });
  const [content, setContent] = useState<EducationPlanContent>(plan.content);
  const save = useMutation({
    mutationFn: () =>
      updatePlan(plan.id, {
        title: values.title,
        period_label: values.period_label || null,
        period_start: values.period_start || null,
        period_end: values.period_end || null,
        content,
      }),
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  return (
    <form
      noValidate
      aria-label="Nội dung kế hoạch"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin chung">
        <FormRow label="Tên kế hoạch" error={errors.title}>
          <input
            className={FORM_CONTROL_CLASS}
            value={values.title}
            onChange={(event) => set('title', event.target.value)}
          />
        </FormRow>
        <FormRow label="Kì kế hoạch" error={errors.period_label}>
          <input
            className={FORM_CONTROL_CLASS}
            placeholder="Ví dụ: Tháng 10, Tuần 5, Học kì I"
            value={values.period_label}
            onChange={(event) => set('period_label', event.target.value)}
          />
        </FormRow>
        <FormRow label="Từ ngày" error={errors.period_start}>
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={values.period_start}
            onChange={(event) => set('period_start', event.target.value)}
          />
        </FormRow>
        <FormRow label="Đến ngày" error={errors.period_end}>
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={values.period_end}
            onChange={(event) => set('period_end', event.target.value)}
          />
        </FormRow>
      </FormBlock>
      {plan.sections.map((section) => (
        <FormBlock key={section.key} title={section.title}>
          {section.hint ? <p className="text-label text-text-secondary">{section.hint}</p> : null}
          {errors[`content.${section.key}`] ? (
            <p className="text-label text-danger">{errors[`content.${section.key}`]}</p>
          ) : null}
          {section.kind === 'table' ? (
            <TableEditor
              section={section}
              rows={Array.isArray(content[section.key]) ? (content[section.key] as string[][]) : []}
              onChange={(rows) => setContent((current) => ({ ...current, [section.key]: rows }))}
            />
          ) : (
            <textarea
              className={`${FORM_CONTROL_CLASS} min-h-28`}
              aria-label={section.title}
              value={typeof content[section.key] === 'string' ? (content[section.key] as string) : ''}
              onChange={(event) => setContent((current) => ({ ...current, [section.key]: event.target.value }))}
            />
          )}
        </FormBlock>
      ))}
      {Object.keys(errors).some((key) => key.startsWith('content.') && key.split('.').length > 2) ? (
        <Alert tone="danger">Có ô chưa đúng: ô ngày nhập dạng ngày, mỗi ô tối đa 2000 kí tự.</Alert>
      ) : null}
      <span>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi nội dung
        </Button>
      </span>
    </form>
  );
}

function DiffView({ diff }: { diff: PlanDiff }) {
  const tones = { same: 'neutral', changed: 'warning', added: 'success', removed: 'danger' } as const;
  const labels = { same: 'Như cũ', changed: 'Có thay đổi', added: 'Mục mới', removed: 'Mục đã bỏ' };
  return (
    <section aria-label="Khác biệt" className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <p className="text-content">
        So {diff.from_label} với {diff.to_label}: <strong>{diff.changed}</strong> mục khác nhau.
      </p>
      {diff.sections.map((section) => (
        <div key={section.key} className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {section.title}
            <StatusBadge tone={tones[section.state]} label={labels[section.state]} />
          </span>
          {section.state === 'same' ? null : (
            <ul className="flex flex-col font-mono text-label">
              {section.lines.map((line, index) => (
                <li
                  key={index}
                  className={
                    line.op === 'added'
                      ? 'bg-success/10 text-success'
                      : line.op === 'removed'
                        ? 'bg-danger/10 text-danger line-through'
                        : 'text-text-secondary'
                  }
                >
                  {line.op === 'added' ? '+ ' : line.op === 'removed' ? '− ' : '  '}
                  {line.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

export function PlanPanel({ id, onChanged }: { id: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['education-plan', id], queryFn: () => readPlan(id) });
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'submit' | 'approve' | 'return'>();
  const [compareFrom, setCompareFrom] = useState('');
  const [diff, setDiff] = useState<PlanDiff>();
  const apply = (next: EducationPlanDetail, message: string) => {
    queryClient.setQueryData(['education-plan', id], next);
    void queryClient.invalidateQueries({ queryKey: ['education-plans'] });
    void queryClient.invalidateQueries({ queryKey: ['my-work'] });
    setMode(undefined);
    setNote('');
    setDiff(undefined);
    onChanged(message);
  };
  const action = useMutation({
    mutationFn: (kind: 'submit' | 'withdraw' | 'approve' | 'return') => planAction(id, kind, note || undefined),
    onSuccess: (next, kind) =>
      apply(
        next,
        {
          submit: next.status === 'approved' ? 'Đã trình và duyệt xong kế hoạch' : 'Đã trình duyệt kế hoạch',
          withdraw: 'Đã rút lại kế hoạch',
          approve: next.status === 'approved' ? 'Đã duyệt xong kế hoạch' : 'Đã duyệt, chuyển bước tiếp theo',
          return: 'Đã trả lại kế hoạch',
        }[kind],
      ),
  });
  const compare = useMutation({
    mutationFn: () => readPlanDiff(id, compareFrom),
    onSuccess: setDiff,
  });
  const workPlan = useMutation({
    mutationFn: () => createWorkPlan(id),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['education-plan', id] });
      onChanged(`Đã tạo kế hoạch công việc nháp với ${result.items} đầu việc`);
    },
  });
  const download = useMutation({
    mutationFn: (format: 'docx' | 'pdf' | 'signed') =>
      format === 'signed' ? downloadSignedPlan(id) : exportPlan(id, format),
  });
  const plan = detail.data;
  if (detail.error) {
    return <Alert tone="danger">{messageOf(detail.error)}</Alert>;
  }
  if (!plan) {
    return <p className="text-content text-text-secondary">Đang tải…</p>;
  }
  const actions = plan.actions;
  const error = action.error ?? compare.error ?? workPlan.error ?? download.error;
  return (
    <div className="flex flex-col gap-3" aria-label={`Chi tiết kế hoạch ${plan.title}`}>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {plan.status === 'returned' && plan.return_note ? (
        <Alert tone="warning">Lý do trả lại: {plan.return_note}</Alert>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-content md:grid-cols-[12rem_minmax(0,1fr)]">
        <dt className="font-medium">Mẫu</dt>
        <dd>
          {plan.template_name} ({plan.scope_label}, {plan.period_type_label})
        </dd>
        <dt className="font-medium">Người lập</dt>
        <dd>
          {[plan.owner_name, plan.department_name, plan.work_group_name, plan.class_name].filter(Boolean).join(' – ')}
        </dd>
        <dt className="font-medium">Các bước duyệt</dt>
        <dd>
          {stepsText(plan.approval_steps)}
          {plan.requires_signing ? '; kí nội bộ khi duyệt xong' : ''}
        </dd>
        <dt className="font-medium">Trạng thái</dt>
        <dd>
          <StatusBadge tone={STATUS_TONES[plan.status]} label={plan.status_label} />
        </dd>
        {plan.source_year_name ? (
          <>
            <dt className="font-medium">Sao chép từ</dt>
            <dd>Năm học {plan.source_year_name}</dd>
          </>
        ) : null}
        {plan.approved_by_name ? (
          <>
            <dt className="font-medium">Duyệt xong</dt>
            <dd>
              {plan.approved_by_name}
              {plan.approved_at ? `, ${formatDateTime(plan.approved_at)}` : ''}
            </dd>
          </>
        ) : null}
        {plan.archived_document ? (
          <>
            <dt className="font-medium">Lưu ở kho hồ sơ</dt>
            <dd>{plan.archived_document.folder_name}</dd>
          </>
        ) : null}
        {plan.work_plan_id ? (
          <>
            <dt className="font-medium">Kế hoạch công việc</dt>
            <dd>Đã tạo (Quản lý công việc, kế hoạch theo kỳ)</dd>
          </>
        ) : null}
      </dl>
      {plan.signed_file_id ? (
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="success" label="Đã kí nội bộ" />
          <Button variant="secondary" onClick={() => download.mutate('signed')}>
            Tải bản đã kí
          </Button>
          <span className="text-label text-text-secondary">{plan.signer_description}</span>
        </span>
      ) : null}
      {actions.edit ? (
        <PlanEditor key={plan.updated_at} plan={plan} onSaved={(next) => apply(next, 'Đã ghi nội dung kế hoạch')} />
      ) : (
        <section aria-label="Nội dung kế hoạch" className="flex flex-col gap-2">
          {plan.sections.map((section) => (
            <div key={section.key} className="flex flex-col gap-1">
              <h3 className="text-content font-semibold">{section.title}</h3>
              <SectionView section={section} content={plan.content} />
            </div>
          ))}
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.submit ? (
          <Button variant="primary" disabled={action.isPending} onClick={() => setMode('submit')}>
            {plan.status === 'returned' ? 'Trình lại' : 'Trình duyệt'}
          </Button>
        ) : null}
        {actions.withdraw ? (
          <Button variant="secondary" onClick={() => action.mutate('withdraw')}>
            Rút lại
          </Button>
        ) : null}
        {actions.approve ? (
          <Button variant="primary" onClick={() => setMode('approve')}>
            Duyệt
          </Button>
        ) : null}
        {actions.return ? (
          <Button variant="secondary" onClick={() => setMode('return')}>
            Trả lại
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => download.mutate('docx')}>
          Xuất Word
        </Button>
        <Button variant="secondary" onClick={() => download.mutate('pdf')}>
          Xuất PDF
        </Button>
        {actions.work_plan ? (
          <Button variant="secondary" disabled={workPlan.isPending} onClick={() => workPlan.mutate()}>
            Tạo kế hoạch công việc
          </Button>
        ) : null}
      </div>
      {mode ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <label className="text-label font-medium text-text">
            {mode === 'return' ? 'Lý do trả lại' : mode === 'submit' ? 'Ghi chú khi trình' : 'Ý kiến'}
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
      {plan.has_source || plan.versions.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-label font-medium text-text">
            So sánh bản hiện tại với
            <select
              className={selectClass}
              value={compareFrom}
              onChange={(event) => setCompareFrom(event.target.value)}
            >
              <option value="">— Chọn bản —</option>
              {plan.has_source ? <option value="source">Bản năm học {plan.source_year_name}</option> : null}
              {plan.versions.map((version) => (
                <option key={version.version_no} value={String(version.version_no)}>
                  Phiên bản {version.version_no} ({formatDateTime(version.created_at)})
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" disabled={!compareFrom || compare.isPending} onClick={() => compare.mutate()}>
            So sánh
          </Button>
        </div>
      ) : null}
      {diff ? <DiffView diff={diff} /> : null}
      <h3 className="text-content font-semibold">Lịch sử kế hoạch</h3>
      <ul className="flex flex-col gap-1 text-content">
        {plan.events.map((event) => (
          <li key={event.id}>
            {formatDateTime(event.created_at)} – <span className="font-medium">{event.actor_name}</span>:{' '}
            {EDUCATION_PLAN_ACTION_LABELS[event.action] ?? event.action}
            {event.step ? ` (bước ${EDUCATION_PLAN_STEP_LABELS[event.step]})` : ''}
            {event.note ? `. ${event.note}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Lập kế hoạch, sao chép từ năm trước ----

function PlanForm({
  scopes,
  onSaved,
  onCancel,
}: {
  scopes: EducationPlanScopeCode[];
  onSaved(plan: EducationPlanDetail): void;
  onCancel(): void;
}) {
  const overview = useOverview();
  const templates = useQuery({ queryKey: ['education-plan-templates', 'active'], queryFn: () => listPlanTemplates() });
  const [values, setValues] = useState({
    template_id: '',
    title: '',
    period_label: '',
    period_start: '',
    period_end: '',
    class_id: '',
    owner: '',
    org_unit_id: '',
  });
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const available = (templates.data ?? []).filter((template) => scopes.includes(template.scope));
  const template = available.find((item) => item.id === values.template_id);
  const save = useMutation({
    mutationFn: () => {
      const [kind, ownerId] = values.owner.split(':');
      return createPlan({
        template_id: values.template_id,
        title: values.title,
        period_label: values.period_label || null,
        period_start: values.period_start || null,
        period_end: values.period_end || null,
        org_unit_id: values.org_unit_id || null,
        department_id: kind === 'department' ? (ownerId ?? null) : null,
        work_group_id: kind === 'work_group' ? (ownerId ?? null) : null,
        class_id: values.class_id || null,
      });
    },
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      noValidate
      aria-label="Lập kế hoạch giáo dục"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin kế hoạch">
        <FormRow label="Mẫu kế hoạch" error={errors.template_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.template_id}
            onChange={(event) => {
              const chosen = available.find((item) => item.id === event.target.value);
              setValues((current) => ({
                ...current,
                template_id: event.target.value,
                title: current.title || chosen?.name || '',
              }));
            }}
          >
            <option value="">— Chọn mẫu —</option>
            {available.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </FormRow>
        {available.length === 0 && templates.data ? (
          <p className="text-label text-text-secondary">
            Thư viện chưa có mẫu cho loại kế hoạch này; Ban Giám hiệu nạp mẫu ở mục 5.6.
          </p>
        ) : null}
        {template?.scope === 'class' ? (
          <FormRow label="Nhóm, lớp" error={errors.class_id}>
            <select
              className={FORM_CONTROL_CLASS}
              value={values.class_id}
              onChange={(event) => set('class_id', event.target.value)}
            >
              <option value="">— Chọn nhóm, lớp —</option>
              {(overview.data?.classes ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormRow>
        ) : null}
        {template?.scope === 'group' && (overview.data?.my_groups.length ?? 0) > 1 ? (
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
        {template?.scope === 'school' ? (
          <FormRow label="Đơn vị" error={errors.org_unit_id}>
            <select
              className={FORM_CONTROL_CLASS}
              value={values.org_unit_id}
              onChange={(event) => set('org_unit_id', event.target.value)}
            >
              <option value="">Trường chính</option>
              {(overview.data?.org_units ?? []).map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </FormRow>
        ) : null}
        <FormRow label="Tên kế hoạch" error={errors.title}>
          <input
            className={FORM_CONTROL_CLASS}
            value={values.title}
            onChange={(event) => set('title', event.target.value)}
          />
        </FormRow>
        <FormRow label="Kì kế hoạch" error={errors.period_label}>
          <input
            className={FORM_CONTROL_CLASS}
            placeholder="Ví dụ: Tháng 10, Tuần 5, Học kì I"
            value={values.period_label}
            onChange={(event) => set('period_label', event.target.value)}
          />
        </FormRow>
        <FormRow label="Từ ngày" error={errors.period_start}>
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={values.period_start}
            onChange={(event) => set('period_start', event.target.value)}
          />
        </FormRow>
        <FormRow label="Đến ngày" error={errors.period_end}>
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={values.period_end}
            onChange={(event) => set('period_end', event.target.value)}
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

type PreviousRow = PreviousPlans['plans'][number];

function CopyPanel({
  scopes,
  onCopied,
  onCancel,
}: {
  scopes: EducationPlanScopeCode[];
  onCopied(plan: EducationPlanDetail, yearName: string): void;
  onCancel(): void;
}) {
  const overview = useOverview();
  const grid = useGridSettings('education-plan-previous');
  const previous = useQuery({ queryKey: ['education-plans', 'previous-year'], queryFn: listPreviousPlans });
  const [chosen, setChosen] = useState<PreviousRow>();
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState('');
  const copy = useMutation({
    mutationFn: () =>
      copyPreviousPlan({
        source_id: chosen?.id ?? '',
        title: title || null,
        class_id: classId || null,
        period_label: null,
        period_start: null,
        period_end: null,
      }),
    onSuccess: (plan) => onCopied(plan, previous.data?.year_name ?? ''),
  });
  const rows = (previous.data?.plans ?? []).filter((plan) => scopes.includes(plan.scope));
  const columns: Array<DataGridColumn<PreviousRow>> = [
    {
      id: 'title',
      header: 'Kế hoạch năm trước',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (row) => row.title,
    },
    { id: 'template_name', header: 'Mẫu', cell: (row) => row.template_name },
    { id: 'owner_name', header: 'Người lập', cell: (row) => row.owner_name },
    { id: 'status', header: 'Trạng thái', cell: (row) => row.status_label },
  ];
  return (
    <section
      aria-label="Sao chép kế hoạch năm trước"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <h2 className="text-content font-semibold">
        Sao chép từ năm học {previous.data?.year_name ?? overview.data?.previous_year ?? 'trước'}
      </h2>
      {previous.error ? <Alert tone="danger">{messageOf(previous.error)}</Alert> : null}
      {copy.error ? <Alert tone="danger">{messageOf(copy.error)}</Alert> : null}
      <DataGrid
        label="Kế hoạch năm trước"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.title}
        loading={!previous.data && !previous.error}
        emptyText="Năm trước không có kế hoạch nào của bạn."
        rowActions={(row) => (
          <Button
            variant="text"
            onClick={() => {
              setChosen(row);
              setTitle(row.title);
            }}
          >
            Chọn
          </Button>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      {chosen ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-label font-medium text-text">
            Tên kế hoạch năm nay
            <input className={selectClass} value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          {chosen.scope === 'class' ? (
            <label className="text-label font-medium text-text">
              Nhóm, lớp năm nay
              <select className={selectClass} value={classId} onChange={(event) => setClassId(event.target.value)}>
                <option value="">— Chọn nhóm, lớp —</option>
                {(overview.data?.classes ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Button variant="primary" disabled={copy.isPending} onClick={() => copy.mutate()}>
            Sao chép kế hoạch
          </Button>
        </div>
      ) : null}
      <span>
        <Button variant="text" onClick={onCancel}>
          Đóng
        </Button>
      </span>
    </section>
  );
}

// ---- Danh sách kế hoạch ----

const PLAN_COLUMNS: Array<DataGridColumn<EducationPlan>> = [
  { id: 'title', header: 'Tên kế hoạch', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
  { id: 'template_name', header: 'Mẫu', cell: (row) => row.template_name },
  {
    id: 'owner_name',
    header: 'Người lập',
    cell: (row) =>
      [row.owner_name, row.class_name ?? row.department_name ?? row.work_group_name].filter(Boolean).join(' – '),
  },
  {
    id: 'period_label',
    header: 'Kì',
    cell: (row) =>
      row.period_label ?? (row.period_start ? formatDate(row.period_start) : EDUCATION_PLAN_PERIOD_LABELS[row.period]),
  },
  { id: 'version_no', header: 'Phiên bản', cell: (row) => row.version_no },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1">
        <StatusBadge tone={STATUS_TONES[row.status]} label={row.status_label} />
        {row.signed_at ? <StatusBadge tone="success" label="Đã kí" /> : null}
        {row.source_year_name ? <StatusBadge tone="neutral" label={`Từ ${row.source_year_name}`} /> : null}
      </span>
    ),
  },
  { id: 'org_unit_name', header: 'Đơn vị', hiddenByDefault: true, cell: (row) => row.org_unit_name },
  { id: 'approved_by_name', header: 'Người duyệt', hiddenByDefault: true, cell: (row) => row.approved_by_name ?? '' },
];

function PlanList({
  view,
  path,
  label,
}: {
  view: 'mine' | 'groups' | 'school' | 'review';
  path: PortalQuickLinkPath;
  label: string;
}) {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const { toast, setToast, close } = useToast();
  const grid = useGridSettings(view === 'review' ? 'education-plan-review' : 'education-plans');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [processed, setProcessed] = useState<'pending' | 'processed'>('pending');
  const [panel, setPanel] = useState<'create' | 'copy'>();
  const [activeId, setActiveId] = useState<string>();
  const [deleting, setDeleting] = useState<EducationPlan>();
  const templates = useQuery({ queryKey: ['education-plan-templates', 'active'], queryFn: () => listPlanTemplates() });
  const plans = useQuery({
    queryKey: ['education-plans', view, search, status, templateId, processed],
    queryFn: () =>
      listPlans({ view, q: search, status, template_id: templateId, processed: processed === 'processed' }),
  });
  const remove = useMutation({
    mutationFn: (plan: EducationPlan) => deletePlan(plan.id),
    onSuccess: async (_result, plan) => {
      setDeleting(undefined);
      await queryClient.invalidateQueries({ queryKey: ['education-plans'] });
      setToast(`Đã xóa ${plan.title}`);
    },
    onError: () => setDeleting(undefined),
  });
  const scopes = view === 'review' ? [] : VIEW_SCOPES[view];
  const data = overview.data;
  const canCreate =
    data !== undefined &&
    (view === 'school'
      ? data.can_manage
      : view === 'groups'
        ? data.has_staff && data.my_groups.length > 0
        : view === 'mine' && data.has_staff && data.can_use);
  const opened = async (plan: EducationPlanDetail, message: string) => {
    setPanel(undefined);
    await queryClient.invalidateQueries({ queryKey: ['education-plans'] });
    setActiveId(plan.id);
    setToast(message);
  };
  return (
    <Page path={path} toast={toast} onToastClose={close}>
      {view === 'review' ? (
        <Tabs<'pending' | 'processed'>
          label="Kế hoạch cần duyệt"
          value={processed}
          options={[
            { value: 'pending', label: 'Chờ tôi duyệt' },
            { value: 'processed', label: 'Tôi đã xử lý' },
          ]}
          onChange={setProcessed}
        />
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-label font-medium text-text">
          Mẫu kế hoạch
          <select className={selectClass} value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">Tất cả mẫu</option>
            {(templates.data ?? [])
              .filter((template) => view === 'review' || scopes.includes(template.scope))
              .map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Trạng thái
          <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tất cả</option>
            {Object.entries(EDUCATION_PLAN_STATUS_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
      </div>
      {plans.error ? <Alert tone="danger">{messageOf(plans.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {panel === 'create' ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <PlanForm
            scopes={scopes}
            onCancel={() => setPanel(undefined)}
            onSaved={(plan) => void opened(plan, `Đã tạo kế hoạch ${plan.title}; nhập nội dung rồi trình duyệt`)}
          />
        </section>
      ) : null}
      {panel === 'copy' ? (
        <CopyPanel
          scopes={scopes}
          onCancel={() => setPanel(undefined)}
          onCopied={(plan, yearName) => void opened(plan, `Đã sao chép kế hoạch từ năm học ${yearName}`)}
        />
      ) : null}
      <DataGrid
        label={label}
        columns={PLAN_COLUMNS}
        rows={plans.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.title}
        loading={!plans.data && !plans.error}
        emptyText="Không có kế hoạch."
        search={{ label: 'Tìm theo tên kế hoạch, người lập', value: search, onChange: setSearch }}
        toolbar={
          canCreate ? (
            <span className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setPanel('create')}>
                Lập kế hoạch
              </Button>
              {data?.previous_year ? (
                <Button variant="secondary" onClick={() => setPanel('copy')}>
                  Sao chép từ năm trước
                </Button>
              ) : null}
            </span>
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
          activeId === row.id ? <PlanPanel id={row.id} onChanged={(message) => setToast(message)} /> : null
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

export const MyPlansPage = () => <PlanList view="mine" path="/education-plans" label="Kế hoạch của tôi" />;
export const GroupPlansPage = () => <PlanList view="groups" path="/education-plans/groups" label="Kế hoạch tổ, nhóm" />;
export const SchoolPlansPage = () => (
  <PlanList view="school" path="/education-plans/school" label="Kế hoạch của trường" />
);
export const ReviewPlansPage = () => <PlanList view="review" path="/education-plans/review" label="Duyệt kế hoạch" />;

// ---- Bảng tiến độ duyệt ----

type ProgressRow = PlanProgress['by_template'][number];
type WaitingRow = PlanProgress['waiting'][number];

export function PlanProgressPage() {
  const grid = useGridSettings('education-plan-progress');
  const [templateId, setTemplateId] = useState('');
  const templates = useQuery({ queryKey: ['education-plan-templates', 'active'], queryFn: () => listPlanTemplates() });
  const progress = useQuery({
    queryKey: ['education-plans', 'progress', templateId],
    queryFn: () => readPlanProgress(templateId || undefined),
  });
  const download = useMutation({ mutationFn: () => exportPlanProgress(templateId || undefined) });
  const totals = progress.data?.totals;
  const countColumns = (title: string): Array<DataGridColumn<ProgressRow>> => [
    { id: 'name', header: title, alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
    { id: 'draft', header: 'Đang soạn', cell: (row) => row.draft },
    { id: 'pending', header: 'Chờ duyệt', cell: (row) => row.pending },
    { id: 'returned', header: 'Bị trả lại', cell: (row) => row.returned },
    { id: 'approved', header: 'Đã duyệt', cell: (row) => row.approved },
    { id: 'total', header: 'Tổng', cell: (row) => row.total },
    { id: 'approved_percent', header: 'Tỉ lệ đã duyệt', cell: (row) => `${row.approved_percent}%` },
  ];
  const waitingColumns: Array<DataGridColumn<WaitingRow>> = [
    { id: 'title', header: 'Kế hoạch', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
    { id: 'owner_name', header: 'Người lập', cell: (row) => row.owner_name },
    { id: 'template_name', header: 'Mẫu', cell: (row) => row.template_name },
    { id: 'step_label', header: 'Chờ bước', cell: (row) => row.step_label },
    { id: 'waiting_days', header: 'Số ngày chờ', cell: (row) => row.waiting_days },
  ];
  return (
    <Page path="/education-plans/progress">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-label font-medium text-text">
          Mẫu kế hoạch
          <select className={selectClass} value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">Tất cả mẫu</option>
            {(templates.data ?? []).map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" disabled={download.isPending} onClick={() => download.mutate()}>
          Xuất Excel
        </Button>
      </div>
      {progress.error ? <Alert tone="danger">{messageOf(progress.error)}</Alert> : null}
      {download.error ? <Alert tone="danger">{messageOf(download.error)}</Alert> : null}
      {totals && progress.data ? (
        <div className="flex flex-col gap-1 text-content" data-testid="education-plan-totals">
          <p>
            Tổng {totals.total} kế hoạch: <strong>{totals.approved}</strong> đã duyệt ({totals.approved_percent}%),{' '}
            <strong>{totals.pending}</strong> chờ duyệt, <strong>{totals.returned}</strong> bị trả lại,{' '}
            <strong>{totals.draft}</strong> đang soạn.
          </p>
          <p className="flex flex-wrap gap-2">
            {EDUCATION_PLAN_STEPS.map((step) => (
              <StatusBadge
                key={step}
                tone={progress.data.by_step[step] > 0 ? 'info' : 'neutral'}
                label={`Chờ ${EDUCATION_PLAN_STEP_LABELS[step]}: ${progress.data.by_step[step]}`}
              />
            ))}
          </p>
        </div>
      ) : null}
      <DataGrid
        label="Tiến độ theo mẫu kế hoạch"
        columns={countColumns('Mẫu kế hoạch')}
        rows={progress.data?.by_template ?? []}
        getRowId={(row) => row.name}
        getRowLabel={(row) => row.name}
        loading={!progress.data && !progress.error}
        emptyText="Chưa có kế hoạch."
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      <DataGrid
        label="Tiến độ theo tổ chuyên môn"
        columns={countColumns('Tổ chuyên môn')}
        rows={progress.data?.by_department ?? []}
        getRowId={(row) => row.name}
        getRowLabel={(row) => row.name}
        loading={!progress.data && !progress.error}
        emptyText="Chưa có kế hoạch."
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      <DataGrid
        label="Kế hoạch đang chờ duyệt"
        columns={waitingColumns}
        rows={progress.data?.waiting ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.title}
        loading={!progress.data && !progress.error}
        emptyText="Không có kế hoạch đang chờ duyệt."
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

// ---- Thư viện mẫu ----

// Cột của mục bảng nhập mỗi dòng một cột: "mã | tên" hoặc "mã | tên | ngày"
const columnsText = (section: EducationPlanSection) =>
  (section.columns ?? [])
    .map((column) => [column.key, column.label, column.type === 'date' ? 'ngày' : ''].filter(Boolean).join(' | '))
    .join('\n');
const parseColumns = (text: string) =>
  text
    .split('\n')
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter((parts) => parts[0])
    .map(([key, label, type]) => ({
      key: key ?? '',
      label: label ?? '',
      ...(type === 'ngày' || type === 'date' ? { type: 'date' as const } : {}),
    }));

function TemplateForm({
  template,
  onSaved,
  onCancel,
}: {
  template?: EducationPlanTemplate;
  onSaved(template: EducationPlanTemplate): void;
  onCancel(): void;
}) {
  // Chỉ cấp đang bật của trường (YCTD-345); mẫu cũ của cấp đã tắt vẫn giữ cấp của nó
  const enabledLevels = useEnabledSchoolLevels().levels;
  const levelChoices = KPI_SCHOOL_LEVELS.filter(
    (level) => enabledLevels.some((item) => item.value === level.value) || level.value === template?.school_level,
  );
  const folders = useQuery({ queryKey: ['professional-folders', 'all'], queryFn: () => listProfessionalFolders() });
  const [values, setValues] = useState<TemplateInput>({
    code: template?.code ?? '',
    name: template?.name ?? '',
    description: template?.description ?? null,
    school_level: template?.school_level ?? 'MN',
    scope: template?.scope ?? 'class',
    period: template?.period ?? 'year',
    sections: template?.sections ?? [{ key: 'noi_dung', title: 'Nội dung', kind: 'text' }],
    approval_steps: template?.approval_steps ?? ['leader'],
    requires_signing: template?.requires_signing ?? false,
    archive_folder_id: template?.archive_folder_id ?? null,
    sort_order: template?.sort_order ?? 0,
    status: template?.status ?? 'active',
  });
  const [columnDrafts, setColumnDrafts] = useState<string[]>(values.sections.map(columnsText));
  const set = <Key extends keyof TemplateInput>(key: Key, value: TemplateInput[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const setSection = (index: number, patch: Partial<EducationPlanSection>) =>
    set(
      'sections',
      values.sections.map((section, at) => (at === index ? { ...section, ...patch } : section)),
    );
  const save = useMutation({
    mutationFn: () =>
      savePlanTemplate(template?.id ?? null, {
        ...values,
        sections: values.sections.map((section, index) =>
          section.kind === 'table'
            ? { ...section, columns: parseColumns(columnDrafts[index] ?? '') }
            : { key: section.key, title: section.title, kind: 'text', ...(section.hint ? { hint: section.hint } : {}) },
        ),
      }),
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      noValidate
      aria-label={template ? `Sửa mẫu ${template.name}` : 'Thêm mẫu kế hoạch'}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin mẫu">
        <FormRow label="Mã mẫu" error={errors.code}>
          <input
            className={FORM_CONTROL_CLASS}
            value={values.code}
            onChange={(event) => set('code', event.target.value)}
          />
        </FormRow>
        <FormRow label="Tên mẫu" error={errors.name}>
          <input
            className={FORM_CONTROL_CLASS}
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </FormRow>
        <FormRow label="Mô tả" error={errors.description}>
          <textarea
            className={FORM_CONTROL_CLASS}
            value={values.description ?? ''}
            onChange={(event) => set('description', event.target.value || null)}
          />
        </FormRow>
        <FormRow label="Cấp học" error={errors.school_level}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.school_level ?? ''}
            onChange={(event) => set('school_level', (event.target.value || null) as KpiSchoolLevelCode | null)}
          >
            <option value="">Mọi cấp</option>
            {levelChoices.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Loại kế hoạch" error={errors.scope}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.scope}
            onChange={(event) => set('scope', event.target.value as EducationPlanScopeCode)}
          >
            {Object.entries(EDUCATION_PLAN_SCOPE_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Kì" error={errors.period}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.period}
            onChange={(event) => set('period', event.target.value as EducationPlanPeriodCode)}
          >
            {Object.entries(EDUCATION_PLAN_PERIOD_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Các bước duyệt" error={errors.approval_steps}>
          <span className="flex flex-wrap gap-3">
            {EDUCATION_PLAN_STEPS.map((step) => (
              <label key={step} className="flex items-center gap-1 text-content">
                <input
                  type="checkbox"
                  checked={values.approval_steps.includes(step)}
                  onChange={(event) =>
                    set(
                      'approval_steps',
                      event.target.checked
                        ? EDUCATION_PLAN_STEPS.filter((item) => item === step || values.approval_steps.includes(item))
                        : values.approval_steps.filter((item) => item !== step),
                    )
                  }
                />
                {EDUCATION_PLAN_STEP_LABELS[step]}
              </label>
            ))}
          </span>
        </FormRow>
        <FormRow label="Kí nội bộ khi duyệt xong" error={errors.requires_signing}>
          <input
            type="checkbox"
            checked={values.requires_signing}
            onChange={(event) => set('requires_signing', event.target.checked)}
          />
        </FormRow>
        <FormRow label="Lưu bản đã duyệt vào thư mục" error={errors.archive_folder_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.archive_folder_id ?? ''}
            onChange={(event) => set('archive_folder_id', event.target.value || null)}
          >
            <option value="">Không lưu vào kho hồ sơ</option>
            {(folders.data ?? []).map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Thứ tự" error={errors.sort_order}>
          <input
            type="number"
            className={FORM_CONTROL_CLASS}
            value={values.sort_order}
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
      <FormBlock title="Các mục của kế hoạch">
        {errors.sections ? <p className="text-label text-danger">{errors.sections}</p> : null}
        {values.sections.map((section, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-lg border border-border p-2">
            <span className="flex flex-wrap items-end gap-2">
              <label className="text-label font-medium text-text">
                Mã mục {index + 1}
                <input
                  className={selectClass}
                  value={section.key}
                  onChange={(event) => setSection(index, { key: event.target.value })}
                />
              </label>
              <label className="text-label font-medium text-text">
                Tên mục {index + 1}
                <input
                  className={selectClass}
                  value={section.title}
                  onChange={(event) => setSection(index, { title: event.target.value })}
                />
              </label>
              <label className="text-label font-medium text-text">
                Loại mục {index + 1}
                <select
                  className={selectClass}
                  value={section.kind}
                  onChange={(event) => setSection(index, { kind: event.target.value as 'text' | 'table' })}
                >
                  <option value="text">Văn bản</option>
                  <option value="table">Bảng</option>
                </select>
              </label>
              <Button
                variant="text"
                onClick={() => {
                  set(
                    'sections',
                    values.sections.filter((_item, at) => at !== index),
                  );
                  setColumnDrafts((current) => current.filter((_item, at) => at !== index));
                }}
              >
                Bỏ mục
              </Button>
            </span>
            <label className="text-label font-medium text-text">
              Gợi ý nhập mục {index + 1}
              <input
                className={selectClass}
                value={section.hint ?? ''}
                onChange={(event) => setSection(index, { hint: event.target.value })}
              />
            </label>
            {section.kind === 'table' ? (
              <label className="text-label font-medium text-text">
                Cột của mục {index + 1} (mỗi dòng: mã | tên, thêm "| ngày" cho cột ngày)
                <textarea
                  className={selectClass}
                  value={columnDrafts[index] ?? ''}
                  onChange={(event) =>
                    setColumnDrafts((current) => current.map((item, at) => (at === index ? event.target.value : item)))
                  }
                />
              </label>
            ) : null}
            {Object.entries(errors)
              .filter(([field]) => field.startsWith(`sections.${index}.`))
              .map(([field, message]) => (
                <p key={field} className="text-label text-danger">
                  {message}
                </p>
              ))}
          </div>
        ))}
        <span>
          <Button
            variant="secondary"
            onClick={() => {
              set('sections', [...values.sections, { key: '', title: '', kind: 'text' }]);
              setColumnDrafts((current) => [...current, '']);
            }}
          >
            Thêm mục
          </Button>
        </span>
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

export function PlanTemplatesPage() {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const { toast, setToast, close } = useToast();
  const grid = useGridSettings('education-plan-templates');
  // Cấp học theo các cấp đang bật của trường (YCTD-345); chưa chọn thì lấy cấp đầu tiên
  const enabledLevels = useEnabledSchoolLevels().levels;
  const [chosenLevel, setLevel] = useState<KpiSchoolLevelCode>();
  const level: KpiSchoolLevelCode =
    chosenLevel && enabledLevels.some((item) => item.value === chosenLevel)
      ? chosenLevel
      : (enabledLevels[0]?.value ?? 'MN');
  const [editing, setEditing] = useState<EducationPlanTemplate | 'new'>();
  const [deleting, setDeleting] = useState<EducationPlanTemplate>();
  const canManage = overview.data?.can_manage ?? false;
  const templates = useQuery({
    queryKey: ['education-plan-templates', 'manage'],
    queryFn: () => listPlanTemplates(undefined, true),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['education-plan-templates'] });
  const defaults = useMutation({
    mutationFn: () => loadDefaultTemplates(level),
    onSuccess: async (result) => {
      await refresh();
      setToast(
        result.kind === 'frame'
          ? `Đã thêm ${result.created} khung rỗng, bỏ qua ${result.skipped} khung đã có; trường tự thêm mục cho từng khung`
          : `Đã thêm ${result.created} mẫu, bỏ qua ${result.skipped} mẫu đã có`,
      );
    },
  });
  const remove = useMutation({
    mutationFn: (template: EducationPlanTemplate) => deletePlanTemplate(template.id),
    onSuccess: async (_result, template) => {
      setDeleting(undefined);
      await refresh();
      setToast(`Đã xóa mẫu ${template.name}`);
    },
    onError: () => setDeleting(undefined),
  });
  const columns: Array<DataGridColumn<EducationPlanTemplate>> = [
    { id: 'name', header: 'Mẫu kế hoạch', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
    { id: 'code', header: 'Mã', cell: (row) => row.code },
    { id: 'school_level', header: 'Cấp học', cell: (row) => LEVEL_LABEL(row.school_level) },
    { id: 'scope', header: 'Loại', cell: (row) => EDUCATION_PLAN_SCOPE_LABELS[row.scope] },
    { id: 'period', header: 'Kì', cell: (row) => EDUCATION_PLAN_PERIOD_LABELS[row.period] },
    { id: 'approval_steps', header: 'Các bước duyệt', cell: (row) => stepsText(row.approval_steps) },
    { id: 'requires_signing', header: 'Kí nội bộ', cell: (row) => (row.requires_signing ? 'Có' : '') },
    { id: 'archive_folder_name', header: 'Lưu vào kho', cell: (row) => row.archive_folder_name ?? '' },
    { id: 'sections', header: 'Số mục', cell: (row) => row.sections.length },
    { id: 'plan_count', header: 'Số kế hoạch', cell: (row) => row.plan_count },
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
    <Page path="/education-plan-templates" toast={toast} onToastClose={close}>
      {canManage ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-label font-medium text-text">
            Cấp học
            <select
              className={selectClass}
              value={level}
              onChange={(event) => setLevel(event.target.value as KpiSchoolLevelCode)}
            >
              {enabledLevels.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" disabled={defaults.isPending} onClick={() => defaults.mutate()}>
            {EDUCATION_PLAN_DEFAULT_KIND[level] === 'frame' ? 'Nạp khung rỗng' : 'Nạp mẫu mặc định'}
          </Button>
        </div>
      ) : null}
      {canManage && EDUCATION_PLAN_DEFAULT_KIND[level] === 'frame' ? (
        <Alert tone="info">
          Chưa có mẫu chuẩn cho cấp học này, trường tự nhập. Tài liệu của dự án chưa có nội dung mẫu kế hoạch của cấp
          phổ thông; &quot;Nạp khung rỗng&quot; chỉ thêm các loại kế hoạch (nhà trường, tổ chuyên môn, dự giờ, thao
          giảng, giáo viên, chủ nhiệm, bài dạy), mỗi khung một mục trống. Bấm Sửa để thêm mục, cột theo hướng dẫn hiện
          hành, hoặc &quot;Thêm mẫu&quot; để tạo mẫu riêng.
        </Alert>
      ) : null}
      {defaults.error ? <Alert tone="danger">{messageOf(defaults.error)}</Alert> : null}
      {templates.error ? <Alert tone="danger">{messageOf(templates.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {editing ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <TemplateForm
            key={editing === 'new' ? 'new' : editing.id}
            template={editing === 'new' ? undefined : editing}
            onCancel={() => setEditing(undefined)}
            onSaved={async (saved) => {
              setEditing(undefined);
              await refresh();
              setToast(`Đã ghi mẫu ${saved.name}`);
            }}
          />
        </section>
      ) : null}
      <DataGrid
        label="Thư viện mẫu kế hoạch"
        columns={columns}
        rows={templates.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={!templates.data && !templates.error}
        emptyText="Thư viện chưa có mẫu; nạp mẫu mặc định theo cấp học."
        toolbar={
          canManage ? (
            <Button variant="primary" onClick={() => setEditing('new')}>
              Thêm mẫu
            </Button>
          ) : null
        }
        rowActions={(row) =>
          canManage ? (
            <span className="flex gap-1">
              <Button variant="text" onClick={() => setEditing(row)}>
                Sửa
              </Button>
              {row.plan_count === 0 ? (
                <Button variant="text" onClick={() => setDeleting(row)}>
                  Xóa
                </Button>
              ) : null}
            </span>
          ) : null
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
