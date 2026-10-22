import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KPI_SCHOOL_LEVELS,
  QUALITY_COUNCIL_POSITION_LABELS,
  QUALITY_EVIDENCE_SOURCE_LABELS,
  QUALITY_EVIDENCE_STATUS_LABELS,
  qualityLevelLabel,
  type KpiSchoolLevelCode,
  type QualityAssessmentStatusCode,
  type QualityCouncilPositionCode,
  type QualityEvidenceSourceCode,
  type QualityEvidenceStatusCode,
  type QualityImprovementAction,
  type QualityReportStatusCode,
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
import { Page, Tabs, useToast } from '../directives/directive-ui.js';
import { useGridSettings } from '../pages/grid-settings.js';
import {
  applyRecognition,
  assessmentAction,
  createEvidence,
  createImprovementPlan,
  deleteAssessment,
  deleteEvidence,
  deleteFramework,
  deleteTreeItem,
  downloadEvidenceFile,
  exportEvidenceList,
  exportSelfReport,
  inheritEvidences,
  listAssessments,
  listEvidences,
  listEvidenceSources,
  listFrameworks,
  listReports,
  loadDefaultFrameworks,
  readAssessment,
  readFramework,
  readQualityOverview,
  readRecognition,
  readReport,
  reportAction,
  saveAssessment,
  saveCouncil,
  saveFramework,
  saveGroups,
  saveRecognition,
  saveTreeItem,
  updateEvidence,
  updateReport,
  uploadEvidenceFile,
  type AssessmentInput,
  type CriterionRow,
  type EvidenceInput,
  type FrameworkInput,
  type QualityAssessment,
  type QualityAssessmentDetail,
  type QualityEvidence,
  type QualityFramework,
  type QualityReportDetail,
  type QualityReportRow,
  type RecognitionState,
  type TreeKind,
} from './quality-api.js';

// Bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f, YCTD-149): đợt tự đánh giá (hội đồng, nhóm công tác, phân công tiêu chí,
// tiến độ, kết quả, báo cáo, kế hoạch cải tiến, công nhận), phiếu đánh giá tiêu chí, minh chứng, theo dõi công nhận, bộ
// tiêu chuẩn cấu hình được
const ASSESSMENT_TONES: Record<QualityAssessmentStatusCode, StatusTone> = {
  draft: 'neutral',
  in_progress: 'info',
  completed: 'success',
};
const REPORT_TONES: Record<QualityReportStatusCode, StatusTone> = {
  draft: 'neutral',
  submitted: 'info',
  approved: 'success',
  returned: 'warning',
};
const EVIDENCE_TONES: Record<QualityEvidenceStatusCode, StatusTone> = {
  missing: 'danger',
  collecting: 'info',
  sufficient: 'success',
  needs_update: 'warning',
};
const RECOGNITION_LABELS: Record<RecognitionState, [string, StatusTone]> = {
  valid: ['Còn hiệu lực', 'success'],
  expiring: ['Sắp hết hiệu lực', 'warning'],
  expired: ['Hết hiệu lực', 'danger'],
  unknown: ['Chưa có thông tin', 'neutral'],
};
const textOrNull = (value: string) => (value.trim() === '' ? null : value.trim());
const textareaClass = `${FORM_CONTROL_CLASS} min-h-24`;

function useOverview() {
  return useQuery({ queryKey: ['quality', 'overview'], queryFn: readQualityOverview });
}

function useAssessments() {
  return useQuery({ queryKey: ['quality', 'assessments'], queryFn: listAssessments });
}

// Ô chọn đợt tự đánh giá dùng chung cho trang phiếu và minh chứng; mặc định đợt mới nhất
function AssessmentSelect({ value, onChange }: { value: string; onChange(id: string): void }) {
  const assessments = useAssessments();
  const first = assessments.data?.[0]?.id;
  useEffect(() => {
    if (!value && first) {
      onChange(first);
    }
  }, [value, first, onChange]);
  return (
    <label className="text-label font-medium text-text">
      Đợt tự đánh giá
      <select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>
        {(assessments.data ?? []).length === 0 ? <option value="">Chưa có đợt</option> : null}
        {(assessments.data ?? []).map((assessment) => (
          <option key={assessment.id} value={assessment.id}>
            {assessment.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function LevelSelect({
  value,
  maxLevel,
  onChange,
  label,
  disabled,
}: {
  value: number | null;
  maxLevel: number;
  onChange(value: number | null): void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={label}
      className={FORM_CONTROL_CLASS}
      disabled={disabled}
      value={value === null ? '' : String(value)}
      onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
    >
      <option value="">Chưa đánh giá</option>
      {Array.from({ length: maxLevel + 1 }, (_unused, level) => (
        <option key={level} value={level}>
          {qualityLevelLabel(level)}
        </option>
      ))}
    </select>
  );
}

// ---- 1.1 Đợt tự đánh giá ----

const ASSESSMENT_COLUMNS: Array<DataGridColumn<QualityAssessment>> = [
  { id: 'title', header: 'Tên đợt', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
  { id: 'framework_name', header: 'Bộ tiêu chuẩn', cell: (row) => row.framework_name },
  {
    id: 'decision',
    header: 'Quyết định thành lập hội đồng',
    cell: (row) => [row.decision_number, formatDate(row.decision_date)].filter(Boolean).join(' ngày '),
  },
  {
    id: 'period',
    header: 'Thời gian',
    cell: (row) => [formatDate(row.start_date), formatDate(row.end_date)].filter(Boolean).join(' – '),
  },
  { id: 'progress', header: 'Phiếu đã duyệt', cell: (row) => `${row.approved_count}/${row.report_count}` },
  { id: 'evidence_count', header: 'Minh chứng', cell: (row) => row.evidence_count },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => <StatusBadge tone={ASSESSMENT_TONES[row.status]} label={row.status_label} />,
  },
  {
    id: 'self_level',
    header: 'Mức tự đánh giá',
    cell: (row) => (row.self_level === null ? '' : qualityLevelLabel(row.self_level)),
  },
];

function AssessmentForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: QualityAssessmentDetail | null;
  onSaved(id: string): void;
  onCancel(): void;
}) {
  const frameworks = useQuery({ queryKey: ['quality', 'frameworks', 'active'], queryFn: () => listFrameworks() });
  const [form, setForm] = useState<AssessmentInput>({
    framework_id: initial?.framework.id ?? '',
    title: initial?.title ?? '',
    decision_number: initial?.decision_number ?? null,
    decision_date: initial?.decision_date ?? null,
    start_date: initial?.start_date ?? null,
    end_date: initial?.end_date ?? null,
    introduction: initial?.introduction ?? null,
    conclusion: initial?.conclusion ?? null,
  });
  const save = useMutation({
    mutationFn: () => saveAssessment(initial?.id ?? null, form),
    onSuccess: (saved) => onSaved(saved.id),
  });
  const errors = fieldErrorsOf(save.error);
  const set = (key: keyof AssessmentInput) => (value: string) => setForm({ ...form, [key]: textOrNull(value) });
  return (
    <form
      className="flex flex-col gap-3"
      aria-label={initial ? 'Sửa đợt tự đánh giá' : 'Lập đợt tự đánh giá'}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error && Object.keys(errors).length === 0 ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin đợt">
        <FormRow label="Bộ tiêu chuẩn" error={errors.framework_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={form.framework_id}
            disabled={initial !== null && initial.status !== 'draft'}
            onChange={(event) => setForm({ ...form, framework_id: event.target.value })}
          >
            <option value="">Chọn bộ tiêu chuẩn</option>
            {(frameworks.data ?? []).map((framework) => (
              <option key={framework.id} value={framework.id}>
                {framework.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Tên đợt" error={errors.title}>
          <input
            className={FORM_CONTROL_CLASS}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </FormRow>
        <FormRow label="Số quyết định thành lập hội đồng" error={errors.decision_number}>
          <input
            className={FORM_CONTROL_CLASS}
            value={form.decision_number ?? ''}
            onChange={(event) => set('decision_number')(event.target.value)}
          />
        </FormRow>
        <FormRow label="Ngày quyết định" error={errors.decision_date}>
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={form.decision_date ?? ''}
            onChange={(event) => set('decision_date')(event.target.value)}
          />
        </FormRow>
        <FormRow label="Ngày bắt đầu" error={errors.start_date}>
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={form.start_date ?? ''}
            onChange={(event) => set('start_date')(event.target.value)}
          />
        </FormRow>
        <FormRow label="Ngày kết thúc" error={errors.end_date}>
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={form.end_date ?? ''}
            onChange={(event) => set('end_date')(event.target.value)}
          />
        </FormRow>
      </FormBlock>
      {initial ? (
        <FormBlock title="Báo cáo tự đánh giá">
          <FormRow label="Đặt vấn đề" error={errors.introduction}>
            <textarea
              className={textareaClass}
              value={form.introduction ?? ''}
              onChange={(event) => set('introduction')(event.target.value)}
            />
          </FormRow>
          <FormRow label="Kết luận chung" error={errors.conclusion}>
            <textarea
              className={textareaClass}
              value={form.conclusion ?? ''}
              onChange={(event) => set('conclusion')(event.target.value)}
            />
          </FormRow>
        </FormBlock>
      ) : null}
      <div className="flex gap-2">
        <Button variant="primary" type="submit" disabled={save.isPending}>
          Ghi
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </form>
  );
}

function CouncilEditor({
  detail,
  onSaved,
}: {
  detail: QualityAssessmentDetail;
  onSaved(next: QualityAssessmentDetail): void;
}) {
  const overview = useOverview();
  const [members, setMembers] = useState(
    detail.council.map((member) => ({ staff_id: member.staff_id, position: member.position, duty: member.duty ?? '' })),
  );
  const save = useMutation({
    mutationFn: () =>
      saveCouncil(
        detail.id,
        members.filter((member) => member.staff_id).map((member) => ({ ...member, duty: textOrNull(member.duty) })),
      ),
    onSuccess: onSaved,
  });
  const editable = detail.can_manage && detail.status !== 'completed';
  return (
    <div className="flex flex-col gap-2" aria-label="Hội đồng tự đánh giá">
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <table className="w-full text-content">
        <thead>
          <tr className="text-left">
            <th className="p-1">Thành viên</th>
            <th className="p-1">Chức danh</th>
            <th className="p-1">Nhiệm vụ</th>
            <th className="p-1" />
          </tr>
        </thead>
        <tbody>
          {members.map((member, index) => (
            <tr key={index}>
              <td className="p-1">
                <select
                  aria-label={`Thành viên ${index + 1}`}
                  className={FORM_CONTROL_CLASS}
                  disabled={!editable}
                  value={member.staff_id}
                  onChange={(event) =>
                    setMembers(
                      members.map((item, at) => (at === index ? { ...item, staff_id: event.target.value } : item)),
                    )
                  }
                >
                  <option value="">Chọn nhân sự</option>
                  {(overview.data?.staff ?? []).map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-1">
                <select
                  aria-label={`Chức danh ${index + 1}`}
                  className={FORM_CONTROL_CLASS}
                  disabled={!editable}
                  value={member.position}
                  onChange={(event) =>
                    setMembers(
                      members.map((item, at) =>
                        at === index ? { ...item, position: event.target.value as QualityCouncilPositionCode } : item,
                      ),
                    )
                  }
                >
                  {Object.entries(QUALITY_COUNCIL_POSITION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-1">
                <input
                  aria-label={`Nhiệm vụ ${index + 1}`}
                  className={FORM_CONTROL_CLASS}
                  disabled={!editable}
                  value={member.duty}
                  onChange={(event) =>
                    setMembers(members.map((item, at) => (at === index ? { ...item, duty: event.target.value } : item)))
                  }
                />
              </td>
              <td className="p-1">
                {editable ? (
                  <Button variant="text" onClick={() => setMembers(members.filter((_item, at) => at !== index))}>
                    Bỏ
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editable ? (
        <div className="flex gap-2">
          <Button
            onClick={() =>
              setMembers([...members, { staff_id: '', position: members.length === 0 ? 'chair' : 'member', duty: '' }])
            }
          >
            Thêm thành viên
          </Button>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            Ghi hội đồng
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function GroupsEditor({
  detail,
  onSaved,
}: {
  detail: QualityAssessmentDetail;
  onSaved(next: QualityAssessmentDetail): void;
}) {
  const overview = useOverview();
  const [groups, setGroups] = useState(
    detail.groups.map((group) => ({
      name: group.name,
      leader_staff_id: group.leader_staff_id ?? '',
      member_staff_ids: group.members.map((member) => member.staff_id),
      criterion_ids: group.criterion_ids,
    })),
  );
  const save = useMutation({
    mutationFn: () =>
      saveGroups(
        detail.id,
        groups.map((group) => ({ ...group, leader_staff_id: group.leader_staff_id || null })),
      ),
    onSuccess: onSaved,
  });
  const editable = detail.can_manage && detail.status !== 'completed';
  const update = (index: number, change: Partial<(typeof groups)[number]>) =>
    setGroups(groups.map((group, at) => (at === index ? { ...group, ...change } : group)));
  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  return (
    <div className="flex flex-col gap-3" aria-label="Nhóm công tác">
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {groups.map((group, index) => (
        <FormBlock key={index} title={group.name || `Nhóm ${index + 1}`}>
          <FormRow label="Tên nhóm">
            <input
              className={FORM_CONTROL_CLASS}
              disabled={!editable}
              value={group.name}
              onChange={(event) => update(index, { name: event.target.value })}
            />
          </FormRow>
          <FormRow label="Trưởng nhóm">
            <select
              className={FORM_CONTROL_CLASS}
              disabled={!editable}
              value={group.leader_staff_id}
              onChange={(event) => update(index, { leader_staff_id: event.target.value })}
            >
              <option value="">Không có</option>
              {(overview.data?.staff ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
            </select>
          </FormRow>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-label font-medium">Thành viên</legend>
            <div className="flex max-h-40 flex-wrap gap-x-4 gap-y-1 overflow-auto">
              {(overview.data?.staff ?? []).map((person) => (
                <label key={person.id} className="flex items-center gap-1 text-content">
                  <input
                    type="checkbox"
                    disabled={!editable}
                    checked={group.member_staff_ids.includes(person.id)}
                    onChange={() => update(index, { member_staff_ids: toggle(group.member_staff_ids, person.id) })}
                  />
                  {person.full_name}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-label font-medium">Tiêu chí được phân công</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {detail.criteria.map((row) => {
                const taken = groups.some(
                  (other, at) => at !== index && other.criterion_ids.includes(row.criterion_id),
                );
                return (
                  <label
                    key={row.criterion_id}
                    className="flex items-center gap-1 text-content"
                    title={row.criterion_title}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Tiêu chí ${row.criterion_code} cho ${group.name || `nhóm ${index + 1}`}`}
                      disabled={!editable || taken}
                      checked={group.criterion_ids.includes(row.criterion_id)}
                      onChange={() => update(index, { criterion_ids: toggle(group.criterion_ids, row.criterion_id) })}
                    />
                    {row.criterion_code}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {editable ? (
            <Button variant="text" onClick={() => setGroups(groups.filter((_group, at) => at !== index))}>
              Bỏ nhóm
            </Button>
          ) : null}
        </FormBlock>
      ))}
      {editable ? (
        <div className="flex gap-2">
          <Button
            onClick={() =>
              setGroups([
                ...groups,
                { name: `Nhóm ${groups.length + 1}`, leader_staff_id: '', member_staff_ids: [], criterion_ids: [] },
              ])
            }
          >
            Thêm nhóm
          </Button>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            Ghi nhóm công tác
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const CRITERION_COLUMNS: Array<DataGridColumn<CriterionRow>> = [
  {
    id: 'criterion_code',
    header: 'Tiêu chí',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => row.criterion_code,
  },
  { id: 'criterion_title', header: 'Tên tiêu chí', cell: (row) => row.criterion_title },
  { id: 'work_group_name', header: 'Nhóm công tác', cell: (row) => row.work_group_name ?? 'Chưa phân công' },
  {
    id: 'status',
    header: 'Phiếu',
    cell: (row) => <StatusBadge tone={REPORT_TONES[row.status]} label={row.status_label} />,
  },
  { id: 'level_label', header: 'Tự đánh giá', cell: (row) => row.level_label },
  { id: 'evidence_count', header: 'Minh chứng', cell: (row) => row.evidence_count },
];

function ResultPanel({
  detail,
  onSaved,
  onMessage,
}: {
  detail: QualityAssessmentDetail;
  onSaved(next: QualityAssessmentDetail): void;
  onMessage(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState<number | null>(detail.self_level ?? detail.summary.suggested);
  const [recognition, setRecognition] = useState({
    external_level: detail.external_level,
    recognition_decision: detail.recognition_decision ?? '',
    recognition_date: detail.recognition_date ?? '',
    recognition_valid_until: detail.recognition_valid_until ?? '',
  });
  const action = useMutation({
    mutationFn: (kind: 'complete' | 'reopen') =>
      assessmentAction(detail.id, kind, kind === 'complete' ? { self_level: level } : undefined),
    onSuccess: (next, kind) => {
      onSaved(next);
      onMessage(kind === 'complete' ? 'Đã hoàn thành đợt tự đánh giá' : 'Đã mở lại đợt tự đánh giá');
    },
  });
  const plan = useMutation({
    mutationFn: () => createImprovementPlan(detail.id),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['quality'] });
      onMessage(`Đã tạo ${result.plans} kế hoạch công việc nháp với ${result.items} đầu việc cải tiến`);
    },
  });
  const report = useMutation({ mutationFn: (format: 'docx' | 'pdf') => exportSelfReport(detail.id, format) });
  const saveResult = useMutation({
    mutationFn: () =>
      saveRecognition(detail.id, {
        external_level: recognition.external_level,
        recognition_decision: textOrNull(recognition.recognition_decision),
        recognition_date: textOrNull(recognition.recognition_date),
        recognition_valid_until: textOrNull(recognition.recognition_valid_until),
      }),
    onSuccess: (next) => {
      onSaved(next);
      onMessage('Đã ghi kết quả công nhận');
    },
  });
  const apply = useMutation({
    mutationFn: () => applyRecognition(detail.id),
    onSuccess: () => onMessage('Đã cập nhật cấp độ, ngày công nhận vào mục 1.7'),
  });
  const error = action.error ?? plan.error ?? report.error ?? saveResult.error ?? apply.error;
  const summary = detail.summary;
  return (
    <div className="flex flex-col gap-3" aria-label="Kết quả và báo cáo">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <p className="text-content" data-testid="quality-summary">
        Đã đánh giá {summary.assessed}/{summary.total} tiêu chí;{' '}
        {summary.by_level
          .map((count, index) => (index === 0 ? `chưa đạt: ${count}` : `Mức ${index}: ${count}`))
          .slice(0, detail.framework.max_level + 1)
          .join('; ')}
        . Mức gợi ý của trường: {summary.suggested === null ? 'chưa đủ phiếu' : qualityLevelLabel(summary.suggested)}.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        {detail.can_manage && detail.status === 'in_progress' ? (
          <>
            <label className="text-label font-medium">
              Mức của trường do hội đồng kết luận
              <LevelSelect
                label="Mức của trường"
                value={level}
                maxLevel={detail.framework.max_level}
                onChange={setLevel}
              />
            </label>
            <Button
              variant="primary"
              disabled={action.isPending || level === null}
              onClick={() => action.mutate('complete')}
            >
              Hoàn thành đợt
            </Button>
          </>
        ) : null}
        {detail.can_manage && detail.status === 'completed' ? (
          <Button disabled={action.isPending} onClick={() => action.mutate('reopen')}>
            Mở lại đợt
          </Button>
        ) : null}
        <Button disabled={report.isPending} onClick={() => report.mutate('docx')}>
          Xuất báo cáo Word
        </Button>
        <Button disabled={report.isPending} onClick={() => report.mutate('pdf')}>
          Xuất báo cáo PDF
        </Button>
        {detail.can_manage && detail.status !== 'draft' && detail.work_plan_ids.length === 0 ? (
          <Button disabled={plan.isPending} onClick={() => plan.mutate()}>
            Tạo kế hoạch cải tiến
          </Button>
        ) : null}
        {detail.work_plan_ids.length > 0 ? (
          <StatusBadge tone="success" label="Đã có kế hoạch công việc cải tiến" />
        ) : null}
      </div>
      {detail.status === 'completed' && detail.can_manage ? (
        <FormBlock title="Kết quả đánh giá ngoài, công nhận">
          <FormRow label="Cấp độ được công nhận">
            <LevelSelect
              label="Cấp độ được công nhận"
              value={recognition.external_level}
              maxLevel={4}
              onChange={(value) => setRecognition({ ...recognition, external_level: value })}
            />
          </FormRow>
          <FormRow label="Số quyết định công nhận">
            <input
              className={FORM_CONTROL_CLASS}
              value={recognition.recognition_decision}
              onChange={(event) => setRecognition({ ...recognition, recognition_decision: event.target.value })}
            />
          </FormRow>
          <FormRow label="Ngày công nhận">
            <input
              type="date"
              className={FORM_CONTROL_CLASS}
              value={recognition.recognition_date}
              onChange={(event) => setRecognition({ ...recognition, recognition_date: event.target.value })}
            />
          </FormRow>
          <FormRow label="Hiệu lực đến (trống: 5 năm)">
            <input
              type="date"
              className={FORM_CONTROL_CLASS}
              value={recognition.recognition_valid_until}
              onChange={(event) => setRecognition({ ...recognition, recognition_valid_until: event.target.value })}
            />
          </FormRow>
          <div className="flex gap-2">
            <Button variant="primary" disabled={saveResult.isPending} onClick={() => saveResult.mutate()}>
              Ghi kết quả
            </Button>
            <Button disabled={apply.isPending || detail.external_level === null} onClick={() => apply.mutate()}>
              Cập nhật vào 1.7
            </Button>
          </div>
        </FormBlock>
      ) : null}
    </div>
  );
}

function AssessmentPanel({ id, onChanged }: { id: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['quality', 'assessment', id], queryFn: () => readAssessment(id) });
  const [tab, setTab] = useState<'info' | 'council' | 'groups' | 'criteria' | 'result'>('info');
  const [editing, setEditing] = useState(false);
  const grid = useGridSettings('quality-assessment-criteria');
  const saved = (next: QualityAssessmentDetail) => {
    queryClient.setQueryData(['quality', 'assessment', id], next);
    void queryClient.invalidateQueries({ queryKey: ['quality', 'assessments'] });
  };
  const start = useMutation({
    mutationFn: () => assessmentAction(id, 'start'),
    onSuccess: (next) => {
      saved(next);
      onChanged('Đã bắt đầu đánh giá; các nhóm soạn phiếu tiêu chí');
    },
  });
  const inherit = useMutation({
    mutationFn: () => inheritEvidences(id),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['quality'] });
      onChanged(`Đã kế thừa ${result.created} minh chứng của năm học ${result.year_name} (bỏ qua ${result.skipped})`);
    },
  });
  const data = detail.data;
  if (detail.error) {
    return <Alert tone="danger">{messageOf(detail.error)}</Alert>;
  }
  if (!data) {
    return <p className="text-content text-text-secondary">Đang tải…</p>;
  }
  const error = start.error ?? inherit.error;
  return (
    <div className="flex flex-col gap-3" aria-label={`Chi tiết đợt ${data.title}`}>
      <Tabs<typeof tab>
        label="Nội dung đợt tự đánh giá"
        value={tab}
        options={[
          { value: 'info', label: 'Thông tin chung' },
          { value: 'council', label: 'Hội đồng' },
          { value: 'groups', label: 'Nhóm công tác' },
          { value: 'criteria', label: 'Tiến độ tiêu chí' },
          { value: 'result', label: 'Kết quả và báo cáo' },
        ]}
        onChange={setTab}
      />
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {tab === 'info' ? (
        editing ? (
          <AssessmentForm
            initial={data}
            onCancel={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false);
              await queryClient.invalidateQueries({ queryKey: ['quality'] });
              onChanged('Đã ghi thông tin đợt');
            }}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-content md:grid-cols-[14rem_minmax(0,1fr)]">
              <dt className="font-medium">Bộ tiêu chuẩn</dt>
              <dd>{data.framework.name}</dd>
              <dt className="font-medium">Trạng thái</dt>
              <dd>
                <StatusBadge tone={ASSESSMENT_TONES[data.status]} label={data.status_label} />
              </dd>
              <dt className="font-medium">Minh chứng</dt>
              <dd>
                {Object.entries(data.evidence_status)
                  .map(
                    ([status, count]) =>
                      `${QUALITY_EVIDENCE_STATUS_LABELS[status as QualityEvidenceStatusCode]}: ${count}`,
                  )
                  .join('; ')}
              </dd>
            </dl>
            {data.can_manage ? (
              <div className="flex flex-wrap gap-2">
                {data.status !== 'completed' ? <Button onClick={() => setEditing(true)}>Sửa</Button> : null}
                {data.status === 'draft' ? (
                  <Button variant="primary" disabled={start.isPending} onClick={() => start.mutate()}>
                    Bắt đầu đánh giá
                  </Button>
                ) : null}
                {data.status !== 'completed' ? (
                  <Button disabled={inherit.isPending} onClick={() => inherit.mutate()}>
                    Kế thừa minh chứng năm trước
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      ) : null}
      {tab === 'council' ? (
        <CouncilEditor
          detail={data}
          onSaved={(next) => {
            saved(next);
            onChanged('Đã ghi hội đồng tự đánh giá');
          }}
        />
      ) : null}
      {tab === 'groups' ? (
        <GroupsEditor
          detail={data}
          onSaved={(next) => {
            saved(next);
            onChanged('Đã ghi nhóm công tác và phân công tiêu chí');
          }}
        />
      ) : null}
      {tab === 'criteria' ? (
        <DataGrid
          label="Tiến độ theo tiêu chí"
          columns={CRITERION_COLUMNS}
          rows={data.criteria}
          getRowId={(row) => row.report_id}
          getRowLabel={(row) => row.criterion_code}
          emptyText="Bộ tiêu chuẩn chưa có tiêu chí."
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      ) : null}
      {tab === 'result' ? <ResultPanel detail={data} onSaved={saved} onMessage={onChanged} /> : null}
    </div>
  );
}

export function QualityAssessmentsPage() {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const assessments = useAssessments();
  const grid = useGridSettings('quality-assessments');
  const { toast, setToast, close } = useToast();
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string>();
  const [deleting, setDeleting] = useState<QualityAssessment>();
  const remove = useMutation({
    mutationFn: (row: QualityAssessment) => deleteAssessment(row.id),
    onSuccess: async (_result, row) => {
      setDeleting(undefined);
      await queryClient.invalidateQueries({ queryKey: ['quality'] });
      setToast(`Đã xóa ${row.title}`);
    },
    onError: () => setDeleting(undefined),
  });
  return (
    <Page path="/quality/assessments" toast={toast} onToastClose={close}>
      {assessments.error ? <Alert tone="danger">{messageOf(assessments.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {creating ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <AssessmentForm
            initial={null}
            onCancel={() => setCreating(false)}
            onSaved={async (id) => {
              setCreating(false);
              await queryClient.invalidateQueries({ queryKey: ['quality'] });
              setActiveId(id);
              setToast('Đã lập đợt tự đánh giá; lập hội đồng, nhóm công tác rồi bắt đầu');
            }}
          />
        </section>
      ) : null}
      <DataGrid
        label="Đợt tự đánh giá"
        columns={ASSESSMENT_COLUMNS}
        rows={assessments.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.title}
        loading={!assessments.data && !assessments.error}
        emptyText="Chưa có đợt tự đánh giá."
        toolbar={
          overview.data?.can_manage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Lập đợt tự đánh giá
            </Button>
          ) : null
        }
        rowActions={(row) =>
          overview.data?.can_manage && row.status === 'draft' ? (
            <Button variant="text" onClick={() => setDeleting(row)}>
              Xóa
            </Button>
          ) : null
        }
        onRowClick={(row) => setActiveId(activeId === row.id ? undefined : row.id)}
        activeRowId={activeId}
        renderRowDetail={(row) => (activeId === row.id ? <AssessmentPanel id={row.id} onChanged={setToast} /> : null)}
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

// ---- 1.2 Phiếu đánh giá tiêu chí ----

const REPORT_COLUMNS: Array<DataGridColumn<QualityReportRow>> = [
  {
    id: 'criterion_code',
    header: 'Tiêu chí',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => row.criterion_code,
  },
  { id: 'criterion_title', header: 'Tên tiêu chí', cell: (row) => row.criterion_title },
  { id: 'work_group_name', header: 'Nhóm công tác', cell: (row) => row.work_group_name ?? '' },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => <StatusBadge tone={REPORT_TONES[row.status]} label={row.status_label} />,
  },
  { id: 'level_label', header: 'Tự đánh giá', cell: (row) => row.level_label },
  { id: 'assessment_title', header: 'Đợt', hiddenByDefault: true, cell: (row) => row.assessment_title },
];

const emptyAction = (): QualityImprovementAction => ({
  content: '',
  owner_staff_id: null,
  due_date: null,
  resources: null,
});

function ReportPanel({ id, maxLevel, onChanged }: { id: string; maxLevel: number; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const detail = useQuery({ queryKey: ['quality', 'report', id], queryFn: () => readReport(id) });
  const [draft, setDraft] = useState<QualityReportDetail>();
  const [note, setNote] = useState('');
  const data = draft ?? detail.data;
  const apply = (next: QualityReportDetail, message: string) => {
    queryClient.setQueryData(['quality', 'report', id], next);
    setDraft(undefined);
    setNote('');
    void queryClient.invalidateQueries({ queryKey: ['quality', 'reports'] });
    void queryClient.invalidateQueries({ queryKey: ['quality', 'assessment'] });
    onChanged(message);
  };
  const save = useMutation({
    mutationFn: (input: QualityReportDetail) =>
      updateReport(id, {
        current_state: textOrNull(input.current_state ?? ''),
        strengths: textOrNull(input.strengths ?? ''),
        weaknesses: textOrNull(input.weaknesses ?? ''),
        improvement_actions: input.improvement_actions.filter((action) => action.content.trim() !== ''),
        indicator_results: input.indicator_results,
        self_level: input.self_level,
      }),
    onSuccess: (next) => apply(next, 'Đã ghi phiếu'),
  });
  const action = useMutation({
    mutationFn: (kind: 'submit' | 'approve' | 'return' | 'reopen') => reportAction(id, kind, note || undefined),
    onSuccess: (next, kind) =>
      apply(
        next,
        { submit: 'Đã nộp phiếu', approve: 'Đã duyệt phiếu', return: 'Đã trả lại phiếu', reopen: 'Đã mở lại phiếu' }[
          kind
        ],
      ),
  });
  if (detail.error) {
    return <Alert tone="danger">{messageOf(detail.error)}</Alert>;
  }
  if (!data) {
    return <p className="text-content text-text-secondary">Đang tải…</p>;
  }
  const edit = (change: Partial<QualityReportDetail>) => setDraft({ ...data, ...change });
  const disabled = !data.can_edit;
  const errors = fieldErrorsOf(save.error);
  const error = save.error ?? action.error;
  const textField = (key: 'current_state' | 'strengths' | 'weaknesses', label: string) => (
    <FormRow label={label} error={errors[key]}>
      <textarea
        className={textareaClass}
        disabled={disabled}
        value={data[key] ?? ''}
        onChange={(event) => edit({ [key]: event.target.value })}
      />
    </FormRow>
  );
  return (
    <div className="flex flex-col gap-3" aria-label={`Phiếu tiêu chí ${data.criterion.code}`}>
      {error && Object.keys(errors).length === 0 ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {data.status === 'returned' && data.return_note ? (
        <Alert tone="warning">Lý do trả lại: {data.return_note}</Alert>
      ) : null}
      <p className="text-content">
        Tiêu chuẩn {data.criterion.standard_code}: {data.criterion.standard_title}.{' '}
        <strong>
          Tiêu chí {data.criterion.code}: {data.criterion.title}
        </strong>
        {data.criterion.evidence_hint ? (
          <span className="text-text-secondary"> (gợi ý minh chứng: {data.criterion.evidence_hint})</span>
        ) : null}
      </p>
      {data.indicators.length > 0 ? (
        <FormBlock title="Chỉ báo">
          {data.indicators.map((indicator) => (
            <label key={indicator.id} className="flex items-start gap-2 text-content">
              <input
                type="checkbox"
                disabled={disabled}
                checked={data.indicator_results[indicator.id] === true}
                onChange={(event) =>
                  edit({ indicator_results: { ...data.indicator_results, [indicator.id]: event.target.checked } })
                }
              />
              <span>
                Mức {indicator.level}, {indicator.code}) {indicator.content}
              </span>
            </label>
          ))}
        </FormBlock>
      ) : null}
      <FormBlock title="Nội dung đánh giá">
        {textField('current_state', 'Mô tả hiện trạng')}
        {textField('strengths', 'Điểm mạnh')}
        {textField('weaknesses', 'Điểm yếu')}
      </FormBlock>
      <FormBlock title="Kế hoạch cải tiến chất lượng">
        {data.improvement_actions.map((item, index) => {
          const change = (patch: Partial<QualityImprovementAction>) =>
            edit({
              improvement_actions: data.improvement_actions.map((other, at) =>
                at === index ? { ...other, ...patch } : other,
              ),
            });
          return (
            <div
              key={index}
              className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_10rem_minmax(0,1fr)_auto]"
            >
              <input
                aria-label={`Nội dung cải tiến ${index + 1}`}
                className={FORM_CONTROL_CLASS}
                disabled={disabled}
                value={item.content}
                onChange={(event) => change({ content: event.target.value })}
              />
              <select
                aria-label={`Người phụ trách ${index + 1}`}
                className={FORM_CONTROL_CLASS}
                disabled={disabled}
                value={item.owner_staff_id ?? ''}
                onChange={(event) => change({ owner_staff_id: event.target.value || null })}
              >
                <option value="">Người phụ trách</option>
                {(overview.data?.staff ?? []).map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Thời hạn ${index + 1}`}
                type="date"
                className={FORM_CONTROL_CLASS}
                disabled={disabled}
                value={item.due_date ?? ''}
                onChange={(event) => change({ due_date: event.target.value || null })}
              />
              <input
                aria-label={`Nguồn lực ${index + 1}`}
                className={FORM_CONTROL_CLASS}
                disabled={disabled}
                value={item.resources ?? ''}
                onChange={(event) => change({ resources: event.target.value || null })}
              />
              {disabled ? null : (
                <Button
                  variant="text"
                  onClick={() =>
                    edit({ improvement_actions: data.improvement_actions.filter((_other, at) => at !== index) })
                  }
                >
                  Bỏ
                </Button>
              )}
            </div>
          );
        })}
        {disabled ? null : (
          <Button onClick={() => edit({ improvement_actions: [...data.improvement_actions, emptyAction()] })}>
            Thêm việc cải tiến
          </Button>
        )}
      </FormBlock>
      <FormRow label="Tự đánh giá" error={errors.self_level}>
        <LevelSelect
          label="Tự đánh giá"
          disabled={disabled}
          value={data.self_level}
          maxLevel={maxLevel}
          onChange={(value) => edit({ self_level: value })}
        />
      </FormRow>
      {data.suggested_level !== null ? (
        <p className="text-content text-text-secondary">
          Mức gợi ý theo chỉ báo đã đạt: {qualityLevelLabel(data.suggested_level)}
        </p>
      ) : null}
      <div className="text-content">
        <p className="font-medium">Minh chứng của tiêu chí</p>
        {data.evidences.length === 0 ? (
          <p className="text-text-secondary">Chưa có minh chứng; thêm ở mục 1.3 Minh chứng.</p>
        ) : (
          <ul className="list-disc pl-5">
            {data.evidences.map((evidence) => (
              <li key={evidence.id}>
                {evidence.code} {evidence.title} ({evidence.status_label}
                {evidence.shared ? ', dùng chung' : ''})
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {data.can_edit ? (
          <>
            <Button variant="primary" disabled={save.isPending || !draft} onClick={() => save.mutate(data)}>
              Ghi phiếu
            </Button>
            <Button disabled={action.isPending || draft !== undefined} onClick={() => action.mutate('submit')}>
              Nộp phiếu
            </Button>
          </>
        ) : null}
        {data.can_review ? (
          <>
            <Button variant="primary" disabled={action.isPending} onClick={() => action.mutate('approve')}>
              Duyệt phiếu
            </Button>
            <input
              aria-label="Lý do trả lại"
              placeholder="Lý do trả lại"
              className={FORM_CONTROL_CLASS}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <Button disabled={action.isPending || note.trim() === ''} onClick={() => action.mutate('return')}>
              Trả lại
            </Button>
          </>
        ) : null}
        {data.status === 'approved' && data.assessment.status === 'in_progress' && overview.data?.can_manage ? (
          <Button disabled={action.isPending} onClick={() => action.mutate('reopen')}>
            Mở lại phiếu
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function QualityReportsPage() {
  const grid = useGridSettings('quality-reports');
  const overview = useOverview();
  const { toast, setToast, close } = useToast();
  const [assessmentId, setAssessmentId] = useState('');
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [activeId, setActiveId] = useState<string>();
  const assessment = useQuery({
    queryKey: ['quality', 'assessment', assessmentId],
    queryFn: () => readAssessment(assessmentId),
    enabled: assessmentId !== '',
  });
  const reports = useQuery({
    queryKey: ['quality', 'reports', assessmentId, scope],
    queryFn: () => listReports({ assessment_id: assessmentId || undefined, mine: scope === 'mine' }),
    enabled: assessmentId !== '',
  });
  return (
    <Page path="/quality/reports" toast={toast} onToastClose={close}>
      <Tabs<'mine' | 'all'>
        label="Phạm vi phiếu"
        value={scope}
        options={[
          { value: 'mine', label: 'Phiếu của nhóm tôi' },
          { value: 'all', label: overview.data?.can_manage ? 'Tất cả phiếu' : 'Phiếu của đợt tôi tham gia' },
        ]}
        onChange={setScope}
      />
      <div className="flex flex-wrap items-end gap-3">
        <AssessmentSelect value={assessmentId} onChange={setAssessmentId} />
      </div>
      {reports.error ? <Alert tone="danger">{messageOf(reports.error)}</Alert> : null}
      <DataGrid
        label="Phiếu đánh giá tiêu chí"
        columns={REPORT_COLUMNS}
        rows={reports.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `${row.criterion_code} ${row.criterion_title}`}
        loading={assessmentId !== '' && !reports.data && !reports.error}
        emptyText="Không có phiếu (đợt chưa bắt đầu hoặc chưa được phân công)."
        onRowClick={(row) => setActiveId(activeId === row.id ? undefined : row.id)}
        activeRowId={activeId}
        renderRowDetail={(row) =>
          activeId === row.id ? (
            <ReportPanel id={row.id} maxLevel={assessment.data?.framework.max_level ?? 3} onChanged={setToast} />
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

// ---- 1.3 Minh chứng ----

const EVIDENCE_COLUMNS: Array<DataGridColumn<QualityEvidence>> = [
  { id: 'code', header: 'Mã minh chứng', alwaysVisible: true, className: 'font-medium', cell: (row) => row.code },
  { id: 'title', header: 'Tên minh chứng', cell: (row) => row.title },
  {
    id: 'issued',
    header: 'Số, ngày ban hành',
    cell: (row) => [row.document_number, formatDate(row.issued_date)].filter(Boolean).join(', '),
  },
  { id: 'issuer', header: 'Nơi ban hành', cell: (row) => row.issuer ?? '' },
  {
    id: 'criteria',
    header: 'Tiêu chí',
    cell: (row) => [row.criterion_code, ...row.shared_criteria.map((item) => item.code)].join(', '),
  },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => <StatusBadge tone={EVIDENCE_TONES[row.status]} label={row.status_label} />,
  },
  {
    id: 'source',
    header: 'Nguồn',
    cell: (row) => (row.source_label ? `${row.source_type_label}: ${row.source_label}` : row.source_type_label),
  },
  {
    id: 'inherited',
    header: 'Kế thừa',
    hiddenByDefault: true,
    cell: (row) => (row.inherited_code ? `${row.inherited_code} (${row.inherited_year_name ?? ''})` : ''),
  },
];

const emptyEvidence = (): EvidenceInput => ({
  title: '',
  document_number: null,
  issued_date: null,
  issuer: null,
  description: null,
  status: 'collecting',
  source_type: 'none',
  source_id: null,
  criterion_ids: [],
});

function EvidenceForm({
  assessmentId,
  criteria,
  initial,
  onSaved,
  onCancel,
}: {
  assessmentId: string;
  criteria: CriterionRow[];
  initial: QualityEvidence | null;
  onSaved(row: QualityEvidence): void;
  onCancel(): void;
}) {
  const [criterionId, setCriterionId] = useState(initial?.criterion_id ?? '');
  const [box, setBox] = useState('');
  const [form, setForm] = useState<EvidenceInput>(
    initial
      ? {
          title: initial.title,
          document_number: initial.document_number,
          issued_date: initial.issued_date,
          issuer: initial.issuer,
          description: initial.description,
          status: initial.status,
          source_type: initial.source_type,
          source_id: initial.professional_document_id ?? initial.system_document_id,
          criterion_ids: initial.shared_criteria.map((item) => item.id),
        }
      : emptyEvidence(),
  );
  const [search, setSearch] = useState('');
  const needsSource = ['professional_document', 'incoming_document', 'outgoing_document'].includes(form.source_type);
  const sources = useQuery({
    queryKey: ['quality', 'sources', form.source_type, search],
    queryFn: () => listEvidenceSources(form.source_type, search),
    enabled: needsSource,
  });
  const save = useMutation({
    mutationFn: () =>
      initial
        ? updateEvidence(initial.id, form)
        : createEvidence({
            ...form,
            assessment_id: assessmentId,
            criterion_id: criterionId,
            ...(box ? { box: Number(box) } : {}),
          }),
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const set = (key: 'document_number' | 'issued_date' | 'issuer' | 'description') => (value: string) =>
    setForm({ ...form, [key]: textOrNull(value) });
  return (
    <form
      className="flex flex-col gap-3"
      aria-label={initial ? `Sửa minh chứng ${initial.code}` : 'Thêm minh chứng'}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error && Object.keys(errors).length === 0 ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Minh chứng">
        {initial ? null : (
          <>
            <FormRow label="Tiêu chí" error={errors.criterion_id}>
              <select
                className={FORM_CONTROL_CLASS}
                value={criterionId}
                onChange={(event) => setCriterionId(event.target.value)}
              >
                <option value="">Chọn tiêu chí</option>
                {criteria.map((row) => (
                  <option key={row.criterion_id} value={row.criterion_id}>
                    {row.criterion_code} {row.criterion_title}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Số hộp (trống: theo tiêu chuẩn)" error={errors.box}>
              <input
                type="number"
                min={1}
                max={99}
                className={FORM_CONTROL_CLASS}
                value={box}
                onChange={(event) => setBox(event.target.value)}
              />
            </FormRow>
          </>
        )}
        <FormRow label="Tên minh chứng" error={errors.title}>
          <input
            className={FORM_CONTROL_CLASS}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </FormRow>
        <FormRow label="Số, kí hiệu" error={errors.document_number}>
          <input
            className={FORM_CONTROL_CLASS}
            value={form.document_number ?? ''}
            onChange={(event) => set('document_number')(event.target.value)}
          />
        </FormRow>
        <FormRow label="Ngày ban hành" error={errors.issued_date}>
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={form.issued_date ?? ''}
            onChange={(event) => set('issued_date')(event.target.value)}
          />
        </FormRow>
        <FormRow label="Nơi ban hành" error={errors.issuer}>
          <input
            className={FORM_CONTROL_CLASS}
            value={form.issuer ?? ''}
            onChange={(event) => set('issuer')(event.target.value)}
          />
        </FormRow>
        <FormRow label="Mô tả" error={errors.description}>
          <textarea
            className={textareaClass}
            value={form.description ?? ''}
            onChange={(event) => set('description')(event.target.value)}
          />
        </FormRow>
        <FormRow label="Trạng thái" error={errors.status}>
          <select
            className={FORM_CONTROL_CLASS}
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value as QualityEvidenceStatusCode })}
          >
            {Object.entries(QUALITY_EVIDENCE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Nguồn" error={errors.source_type}>
          <select
            className={FORM_CONTROL_CLASS}
            value={form.source_type}
            onChange={(event) =>
              setForm({ ...form, source_type: event.target.value as QualityEvidenceSourceCode, source_id: null })
            }
          >
            {Object.entries(QUALITY_EVIDENCE_SOURCE_LABELS)
              .filter(([value]) => value !== 'upload' || initial?.file_id)
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </FormRow>
        {needsSource ? (
          <FormRow label="Hồ sơ, văn bản nguồn" error={errors.source_id}>
            <div className="flex flex-col gap-1">
              <input
                aria-label="Tìm hồ sơ, văn bản"
                placeholder="Tìm theo tên, số, trích yếu"
                className={FORM_CONTROL_CLASS}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                aria-label="Chọn hồ sơ, văn bản"
                className={FORM_CONTROL_CLASS}
                value={form.source_id ?? ''}
                onChange={(event) => setForm({ ...form, source_id: event.target.value || null })}
              >
                <option value="">Chọn</option>
                {(sources.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </FormRow>
        ) : null}
        <fieldset className="flex flex-col gap-1">
          <legend className="text-label font-medium">Dùng chung cho tiêu chí khác</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {criteria
              .filter((row) => row.criterion_id !== (initial?.criterion_id ?? criterionId))
              .map((row) => (
                <label key={row.criterion_id} className="flex items-center gap-1 text-content">
                  <input
                    type="checkbox"
                    checked={form.criterion_ids.includes(row.criterion_id)}
                    onChange={() =>
                      setForm({
                        ...form,
                        criterion_ids: form.criterion_ids.includes(row.criterion_id)
                          ? form.criterion_ids.filter((id) => id !== row.criterion_id)
                          : [...form.criterion_ids, row.criterion_id],
                      })
                    }
                  />
                  {row.criterion_code}
                </label>
              ))}
          </div>
        </fieldset>
      </FormBlock>
      <div className="flex gap-2">
        <Button variant="primary" type="submit" disabled={save.isPending}>
          Ghi
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </form>
  );
}

export function QualityEvidencesPage() {
  const queryClient = useQueryClient();
  const grid = useGridSettings('quality-evidences');
  const { toast, setToast, close } = useToast();
  const [assessmentId, setAssessmentId] = useState('');
  const [criterionId, setCriterionId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState<'create' | QualityEvidence>();
  const [deleting, setDeleting] = useState<QualityEvidence>();
  const assessment = useQuery({
    queryKey: ['quality', 'assessment', assessmentId],
    queryFn: () => readAssessment(assessmentId),
    enabled: assessmentId !== '',
  });
  const evidences = useQuery({
    queryKey: ['quality', 'evidences', assessmentId, criterionId, status, search],
    queryFn: () => listEvidences({ assessment_id: assessmentId, criterion_id: criterionId, status, q: search }),
    enabled: assessmentId !== '',
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['quality'] });
  const upload = useMutation({
    mutationFn: ({ row, file }: { row: QualityEvidence; file: File }) => uploadEvidenceFile(row.id, file),
    onSuccess: async (row) => {
      await refresh();
      setToast(`Đã tải tệp cho minh chứng ${row.code}`);
    },
  });
  const fetchFile = useMutation({ mutationFn: (row: QualityEvidence) => downloadEvidenceFile(row.id) });
  const list = useMutation({ mutationFn: () => exportEvidenceList(assessmentId) });
  const remove = useMutation({
    mutationFn: (row: QualityEvidence) => deleteEvidence(row.id),
    onSuccess: async (_result, row) => {
      setDeleting(undefined);
      await refresh();
      setToast(`Đã xóa minh chứng ${row.code}`);
    },
    onError: () => setDeleting(undefined),
  });
  const detail = assessment.data;
  const editable =
    detail !== undefined && detail.status !== 'completed' && (detail.can_manage || detail.my_group_ids.length > 0);
  const error = evidences.error ?? upload.error ?? fetchFile.error ?? list.error ?? remove.error;
  return (
    <Page path="/quality/evidences" toast={toast} onToastClose={close}>
      <div className="flex flex-wrap items-end gap-3">
        <AssessmentSelect value={assessmentId} onChange={setAssessmentId} />
        <label className="text-label font-medium text-text">
          Tiêu chí
          <select className={selectClass} value={criterionId} onChange={(event) => setCriterionId(event.target.value)}>
            <option value="">Tất cả tiêu chí</option>
            {(detail?.criteria ?? []).map((row) => (
              <option key={row.criterion_id} value={row.criterion_id}>
                {row.criterion_code} {row.criterion_title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Trạng thái
          <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tất cả</option>
            {Object.entries(QUALITY_EVIDENCE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {panel && detail ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <EvidenceForm
            assessmentId={assessmentId}
            criteria={detail.criteria}
            initial={panel === 'create' ? null : panel}
            onCancel={() => setPanel(undefined)}
            onSaved={async (row) => {
              setPanel(undefined);
              await refresh();
              setToast(`Đã ghi minh chứng ${row.code}`);
            }}
          />
        </section>
      ) : null}
      <DataGrid
        label="Minh chứng"
        columns={EVIDENCE_COLUMNS}
        rows={evidences.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `${row.code} ${row.title}`}
        loading={assessmentId !== '' && !evidences.data && !evidences.error}
        emptyText="Chưa có minh chứng."
        search={{ label: 'Tìm theo mã, tên, số minh chứng', value: search, onChange: setSearch }}
        toolbar={
          <span className="flex flex-wrap gap-2">
            {editable ? (
              <Button variant="primary" onClick={() => setPanel('create')}>
                Thêm minh chứng
              </Button>
            ) : null}
            {assessmentId ? (
              <Button disabled={list.isPending} onClick={() => list.mutate()}>
                Xuất danh mục minh chứng
              </Button>
            ) : null}
          </span>
        }
        rowActions={(row) => (
          <span className="flex flex-wrap gap-1">
            {row.file_id || row.professional_document_id ? (
              <Button variant="text" onClick={() => fetchFile.mutate(row)}>
                Xem tệp
              </Button>
            ) : null}
            {editable ? (
              <>
                <label className="cursor-pointer px-2 py-2 text-label font-medium text-primary">
                  Tải tệp lên
                  <input
                    type="file"
                    aria-label={`Tải tệp cho ${row.code}`}
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) {
                        upload.mutate({ row, file });
                      }
                    }}
                  />
                </label>
                <Button variant="text" onClick={() => setPanel(row)}>
                  Sửa
                </Button>
                <Button variant="text" onClick={() => setDeleting(row)}>
                  Xóa
                </Button>
              </>
            ) : null}
          </span>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        subject={deleting ? `${deleting.code} ${deleting.title}` : ''}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(undefined)}
      />
    </Page>
  );
}

// ---- 2.1 Theo dõi công nhận ----

type RecognitionRow = Awaited<ReturnType<typeof readRecognition>>['records'][number];

const RECOGNITION_COLUMNS: Array<DataGridColumn<RecognitionRow>> = [
  { id: 'title', header: 'Đợt tự đánh giá', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
  { id: 'framework_name', header: 'Bộ tiêu chuẩn', cell: (row) => row.framework_name },
  { id: 'self_level_label', header: 'Tự đánh giá', cell: (row) => row.self_level_label },
  { id: 'external_level_label', header: 'Được công nhận', cell: (row) => row.external_level_label },
  { id: 'recognition_decision', header: 'Quyết định', cell: (row) => row.recognition_decision ?? '' },
  { id: 'recognition_date', header: 'Ngày công nhận', cell: (row) => formatDate(row.recognition_date) },
  { id: 'valid_until', header: 'Hiệu lực đến', cell: (row) => formatDate(row.valid_until) },
  {
    id: 'state',
    header: 'Hiệu lực',
    cell: (row) => <StatusBadge tone={RECOGNITION_LABELS[row.state][1]} label={RECOGNITION_LABELS[row.state][0]} />,
  },
];

export function QualityRecognitionPage() {
  const grid = useGridSettings('quality-recognitions');
  const recognition = useQuery({ queryKey: ['quality', 'recognition'], queryFn: readRecognition });
  const review = recognition.data?.review;
  return (
    <Page path="/quality/recognition">
      {recognition.error ? <Alert tone="danger">{messageOf(recognition.error)}</Alert> : null}
      <FormBlock title="Theo mục 1.7 Rà soát thông tin kiểm định CLGD của năm học">
        {review ? (
          <dl
            className="grid grid-cols-1 gap-x-4 gap-y-1 text-content md:grid-cols-[16rem_minmax(0,1fr)]"
            data-testid="quality-recognition-review"
          >
            <dt className="font-medium">Kiểm định chất lượng giáo dục</dt>
            <dd>
              {review.accreditation_level ? `Cấp độ ${review.accreditation_level}` : 'Chưa ghi cấp độ'}
              {review.accreditation_date ? `, ngày ${formatDate(review.accreditation_date)}` : ''}
            </dd>
            <dt className="font-medium">Hiệu lực đến</dt>
            <dd className="flex items-center gap-2">
              {formatDate(review.valid_until)}
              <StatusBadge tone={RECOGNITION_LABELS[review.state][1]} label={RECOGNITION_LABELS[review.state][0]} />
            </dd>
            <dt className="font-medium">Chuẩn quốc gia</dt>
            <dd>
              {review.national_standard_level ? `Mức độ ${review.national_standard_level}` : 'Chưa ghi mức độ'}
              {review.national_standard_date ? `, ngày ${formatDate(review.national_standard_date)}` : ''}
            </dd>
          </dl>
        ) : (
          <p className="text-content text-text-secondary">Chưa có bản rà soát 1.7 của năm học.</p>
        )}
      </FormBlock>
      <DataGrid
        label="Kết quả công nhận của các đợt"
        columns={RECOGNITION_COLUMNS}
        rows={recognition.data?.records ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.title}
        loading={!recognition.data && !recognition.error}
        emptyText="Chưa có đợt tự đánh giá đã hoàn thành."
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

// ---- 2.2 Bộ tiêu chuẩn đánh giá ----

const FRAMEWORK_COLUMNS: Array<DataGridColumn<QualityFramework>> = [
  { id: 'code', header: 'Mã', alwaysVisible: true, className: 'font-medium', cell: (row) => row.code },
  { id: 'name', header: 'Tên bộ tiêu chuẩn', cell: (row) => row.name },
  {
    id: 'school_level',
    header: 'Cấp học',
    cell: (row) => KPI_SCHOOL_LEVELS.find((level) => level.value === row.school_level)?.label ?? 'Mọi cấp',
  },
  { id: 'max_level', header: 'Số mức', cell: (row) => row.max_level },
  {
    id: 'counts',
    header: 'Tiêu chuẩn, tiêu chí, chỉ báo',
    cell: (row) => `${row.standard_count}, ${row.criterion_count}, ${row.indicator_count}`,
  },
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
  { id: 'legal_basis', header: 'Căn cứ', hiddenByDefault: true, cell: (row) => row.legal_basis ?? '' },
];

function FrameworkForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: QualityFramework | null;
  onSaved(): void;
  onCancel(): void;
}) {
  const [form, setForm] = useState<FrameworkInput>({
    code: initial?.code ?? '',
    name: initial?.name ?? '',
    school_level: initial?.school_level ?? 'MN',
    legal_basis: initial?.legal_basis ?? null,
    max_level: initial?.max_level ?? 3,
    sort_order: initial?.sort_order ?? 0,
    status: initial?.status ?? 'active',
  });
  const save = useMutation({ mutationFn: () => saveFramework(initial?.id ?? null, form), onSuccess: onSaved });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      className="flex flex-col gap-3"
      aria-label={initial ? 'Sửa bộ tiêu chuẩn' : 'Thêm bộ tiêu chuẩn'}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error && Object.keys(errors).length === 0 ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Bộ tiêu chuẩn">
        <FormRow label="Mã" error={errors.code}>
          <input
            className={FORM_CONTROL_CLASS}
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
          />
        </FormRow>
        <FormRow label="Tên" error={errors.name}>
          <input
            className={FORM_CONTROL_CLASS}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </FormRow>
        <FormRow label="Cấp học" error={errors.school_level}>
          <select
            className={FORM_CONTROL_CLASS}
            value={form.school_level ?? ''}
            onChange={(event) =>
              setForm({ ...form, school_level: (event.target.value || null) as KpiSchoolLevelCode | null })
            }
          >
            <option value="">Mọi cấp</option>
            {KPI_SCHOOL_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Số mức đạt của tiêu chí" error={errors.max_level}>
          <input
            type="number"
            min={1}
            max={4}
            className={FORM_CONTROL_CLASS}
            value={form.max_level}
            onChange={(event) => setForm({ ...form, max_level: Number(event.target.value) })}
          />
        </FormRow>
        <FormRow label="Căn cứ" error={errors.legal_basis}>
          <textarea
            className={textareaClass}
            value={form.legal_basis ?? ''}
            onChange={(event) => setForm({ ...form, legal_basis: textOrNull(event.target.value) })}
          />
        </FormRow>
        <FormRow label="Trạng thái" error={errors.status}>
          <select
            className={FORM_CONTROL_CLASS}
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value as 'active' | 'inactive' })}
          >
            <option value="active">Đang dùng</option>
            <option value="inactive">Ngừng dùng</option>
          </select>
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button variant="primary" type="submit" disabled={save.isPending}>
          Ghi
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </form>
  );
}

// Một dòng sửa nhanh của cây: mã, tên hoặc nội dung, mức (chỉ báo)
function TreeItemForm({
  kind,
  parentId,
  initial,
  maxLevel,
  onDone,
}: {
  kind: TreeKind;
  parentId: string;
  initial: { id: string; code: string; text: string; level?: number; hint?: string | null } | null;
  maxLevel: number;
  onDone(): void;
}) {
  const [code, setCode] = useState(initial?.code ?? '');
  const [text, setText] = useState(initial?.text ?? '');
  const [level, setLevel] = useState(initial?.level ?? 1);
  const [hint, setHint] = useState(initial?.hint ?? '');
  const save = useMutation({
    mutationFn: () =>
      saveTreeItem(
        kind,
        initial?.id ?? null,
        parentId,
        kind === 'indicators'
          ? { code, content: text, level }
          : kind === 'criteria'
            ? { code, title: text, evidence_hint: textOrNull(hint) }
            : { code, title: text },
      ),
    onSuccess: onDone,
  });
  const label = { standards: 'tiêu chuẩn', criteria: 'tiêu chí', indicators: 'chỉ báo' }[kind];
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      aria-label={`${initial ? 'Sửa' : 'Thêm'} ${label}`}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {kind === 'indicators' ? (
        <select
          aria-label="Mức"
          className={FORM_CONTROL_CLASS}
          value={level}
          onChange={(event) => setLevel(Number(event.target.value))}
        >
          {Array.from({ length: maxLevel }, (_unused, index) => (
            <option key={index} value={index + 1}>
              Mức {index + 1}
            </option>
          ))}
        </select>
      ) : null}
      <input
        aria-label={`Mã ${label}`}
        placeholder="Mã"
        className={`${FORM_CONTROL_CLASS} w-24`}
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <input
        aria-label={`Nội dung ${label}`}
        placeholder={kind === 'indicators' ? 'Nội dung chỉ báo' : 'Tên'}
        className={`${FORM_CONTROL_CLASS} min-w-64 flex-1`}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {kind === 'criteria' ? (
        <input
          aria-label="Gợi ý minh chứng"
          placeholder="Gợi ý minh chứng"
          className={`${FORM_CONTROL_CLASS} min-w-48`}
          value={hint}
          onChange={(event) => setHint(event.target.value)}
        />
      ) : null}
      <Button variant="primary" type="submit" disabled={save.isPending}>
        Ghi
      </Button>
      <Button onClick={onDone}>Hủy</Button>
    </form>
  );
}

function FrameworkTreePanel({ id, canManage }: { id: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const tree = useQuery({ queryKey: ['quality', 'framework', id], queryFn: () => readFramework(id) });
  const [editing, setEditing] = useState<string>();
  const remove = useMutation({
    mutationFn: ({ kind, itemId }: { kind: TreeKind; itemId: string }) => deleteTreeItem(kind, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quality'] }),
  });
  const done = async () => {
    setEditing(undefined);
    await queryClient.invalidateQueries({ queryKey: ['quality'] });
  };
  const data = tree.data;
  if (tree.error) {
    return <Alert tone="danger">{messageOf(tree.error)}</Alert>;
  }
  if (!data) {
    return <p className="text-content text-text-secondary">Đang tải…</p>;
  }
  const tools = (kind: TreeKind, itemId: string, key: string) =>
    canManage ? (
      <span className="flex gap-1">
        <Button variant="text" onClick={() => setEditing(key)}>
          Sửa
        </Button>
        <Button variant="text" onClick={() => remove.mutate({ kind, itemId })}>
          Xóa
        </Button>
      </span>
    ) : null;
  return (
    <div className="flex flex-col gap-2 text-content" aria-label={`Cây ${data.name}`}>
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {data.standards.map((standard) => (
        <section key={standard.id} className="flex flex-col gap-1 rounded-lg border border-border p-2">
          {editing === `s-${standard.id}` ? (
            <TreeItemForm
              kind="standards"
              parentId={id}
              maxLevel={data.max_level}
              initial={{ id: standard.id, code: standard.code, text: standard.title }}
              onDone={done}
            />
          ) : (
            <div className="flex items-center justify-between gap-2 font-semibold">
              <span>
                Tiêu chuẩn {standard.code}: {standard.title}
              </span>
              {tools('standards', standard.id, `s-${standard.id}`)}
            </div>
          )}
          {standard.criteria.map((criterion) => (
            <div key={criterion.id} className="ml-4 flex flex-col gap-1">
              {editing === `c-${criterion.id}` ? (
                <TreeItemForm
                  kind="criteria"
                  parentId={standard.id}
                  maxLevel={data.max_level}
                  initial={{
                    id: criterion.id,
                    code: criterion.code,
                    text: criterion.title,
                    hint: criterion.evidence_hint,
                  }}
                  onDone={done}
                />
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span>
                    Tiêu chí {criterion.code}: {criterion.title}
                  </span>
                  {tools('criteria', criterion.id, `c-${criterion.id}`)}
                </div>
              )}
              {criterion.indicators.map((indicator) =>
                editing === `i-${indicator.id}` ? (
                  <TreeItemForm
                    key={indicator.id}
                    kind="indicators"
                    parentId={criterion.id}
                    maxLevel={data.max_level}
                    initial={{
                      id: indicator.id,
                      code: indicator.code,
                      text: indicator.content,
                      level: indicator.level,
                    }}
                    onDone={done}
                  />
                ) : (
                  <div key={indicator.id} className="ml-4 flex items-center justify-between gap-2 text-text-secondary">
                    <span>
                      Mức {indicator.level}, {indicator.code}) {indicator.content}
                    </span>
                    {tools('indicators', indicator.id, `i-${indicator.id}`)}
                  </div>
                ),
              )}
              {canManage ? (
                editing === `ni-${criterion.id}` ? (
                  <div className="ml-4">
                    <TreeItemForm
                      kind="indicators"
                      parentId={criterion.id}
                      maxLevel={data.max_level}
                      initial={null}
                      onDone={done}
                    />
                  </div>
                ) : (
                  <Button variant="text" className="ml-4 self-start" onClick={() => setEditing(`ni-${criterion.id}`)}>
                    Thêm chỉ báo cho {criterion.code}
                  </Button>
                )
              ) : null}
            </div>
          ))}
          {canManage ? (
            editing === `nc-${standard.id}` ? (
              <div className="ml-4">
                <TreeItemForm
                  kind="criteria"
                  parentId={standard.id}
                  maxLevel={data.max_level}
                  initial={null}
                  onDone={done}
                />
              </div>
            ) : (
              <Button variant="text" className="ml-4 self-start" onClick={() => setEditing(`nc-${standard.id}`)}>
                Thêm tiêu chí cho tiêu chuẩn {standard.code}
              </Button>
            )
          ) : null}
        </section>
      ))}
      {canManage ? (
        editing === 'new-standard' ? (
          <TreeItemForm kind="standards" parentId={id} maxLevel={data.max_level} initial={null} onDone={done} />
        ) : (
          <Button className="self-start" onClick={() => setEditing('new-standard')}>
            Thêm tiêu chuẩn
          </Button>
        )
      ) : null}
    </div>
  );
}

export function QualityFrameworksPage() {
  const queryClient = useQueryClient();
  const overview = useOverview();
  const grid = useGridSettings('quality-frameworks');
  const { toast, setToast, close } = useToast();
  const [level, setLevel] = useState<KpiSchoolLevelCode>('MN');
  const [panel, setPanel] = useState<'create' | QualityFramework>();
  const [activeId, setActiveId] = useState<string>();
  const [deleting, setDeleting] = useState<QualityFramework>();
  const canManage = overview.data?.can_manage === true;
  const frameworks = useQuery({ queryKey: ['quality', 'frameworks', 'all'], queryFn: () => listFrameworks(true) });
  const defaults = useMutation({
    mutationFn: () => loadDefaultFrameworks(level),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['quality'] });
      setToast(`Đã nạp ${result.created} bộ tiêu chuẩn, bỏ qua ${result.skipped} bộ đã có`);
    },
  });
  const remove = useMutation({
    mutationFn: (row: QualityFramework) => deleteFramework(row.id),
    onSuccess: async (_result, row) => {
      setDeleting(undefined);
      await queryClient.invalidateQueries({ queryKey: ['quality'] });
      setToast(`Đã xóa ${row.name}`);
    },
    onError: () => setDeleting(undefined),
  });
  const error = frameworks.error ?? defaults.error ?? remove.error;
  return (
    <Page path="/quality/frameworks" toast={toast} onToastClose={close}>
      {canManage ? (
        <div className="flex flex-wrap items-end gap-3">
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
          <Button disabled={defaults.isPending} onClick={() => defaults.mutate()}>
            Nạp bộ tiêu chuẩn mẫu
          </Button>
        </div>
      ) : null}
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {panel ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <FrameworkForm
            initial={panel === 'create' ? null : panel}
            onCancel={() => setPanel(undefined)}
            onSaved={async () => {
              setPanel(undefined);
              await queryClient.invalidateQueries({ queryKey: ['quality'] });
              setToast('Đã ghi bộ tiêu chuẩn');
            }}
          />
        </section>
      ) : null}
      <DataGrid
        label="Bộ tiêu chuẩn đánh giá"
        columns={FRAMEWORK_COLUMNS}
        rows={frameworks.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={!frameworks.data && !frameworks.error}
        emptyText="Chưa có bộ tiêu chuẩn; nạp bộ mẫu hoặc thêm bộ mới."
        toolbar={
          canManage ? (
            <Button variant="primary" onClick={() => setPanel('create')}>
              Thêm bộ tiêu chuẩn
            </Button>
          ) : null
        }
        rowActions={(row) =>
          canManage ? (
            <span className="flex gap-1">
              <Button variant="text" onClick={() => setPanel(row)}>
                Sửa
              </Button>
              {row.assessment_count === 0 ? (
                <Button variant="text" onClick={() => setDeleting(row)}>
                  Xóa
                </Button>
              ) : null}
            </span>
          ) : null
        }
        onRowClick={(row) => setActiveId(activeId === row.id ? undefined : row.id)}
        activeRowId={activeId}
        renderRowDetail={(row) =>
          activeId === row.id ? <FrameworkTreePanel id={row.id} canManage={canManage} /> : null
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
