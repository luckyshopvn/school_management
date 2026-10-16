import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
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
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { listStaff } from '../staff/staff-api.js';
import {
  listCriteria,
  listEvaluations,
  listMyEvaluations,
  messageOf,
  PERIOD_HINTS,
  PERIOD_TYPE_LABELS,
  send,
  STATUS_OF_EVALUATION,
  type Criterion,
  type Evaluation,
  type PeriodType,
} from './work-api.js';

// MH-59 Đánh giá nhân sự (P09-05; BR-47; YCTD-81): quản lý đơn vị, phòng nhân sự cấu hình chỉ số của đơn vị,
// chấm điểm theo kỳ, công bố; đã công bố thì chỉ lập đánh giá lại có lý do. Mọi nhân sự xem phiếu đã công bố của mình.
// Giao diện chung theo Sở (DT-15 phần 15f2): lưới chỉ số (khóa `evaluation-criteria`) và lưới phiếu đánh giá của đơn vị
// (khóa `evaluations`, điểm từng chỉ số mở dưới dòng); Thêm mới và lập phiếu bằng biểu mẫu theo khối có nút Ghi. Kết quả
// của tôi giữ dạng từng phiếu
const filterClass = `mt-1 ${FORM_CONTROL_CLASS}`;

const CRITERION_COLUMNS: Array<DataGridColumn<Criterion>> = [
  { id: 'code', header: 'Mã', cell: (row) => row.code },
  { id: 'name', header: 'Tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'weight', header: 'Trọng số', cell: (row) => row.weight },
  { id: 'max_score', header: 'Điểm tối đa', cell: (row) => row.max_score },
  { id: 'status', header: 'Trạng thái', cell: (row) => (row.status === 'active' ? 'Đang dùng' : 'Ngừng dùng') },
];

const EVALUATION_COLUMNS: Array<DataGridColumn<Evaluation>> = [
  { id: 'full_name', header: 'Nhân sự', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'period', header: 'Kỳ', cell: (row) => `${PERIOD_TYPE_LABELS[row.period_type]} ${row.period_value}` },
  { id: 'total_score', header: 'Tổng điểm', cell: (row) => `${row.total_score} điểm` },
  { id: 'status', header: 'Trạng thái', cell: (row) => STATUS_OF_EVALUATION[row.status] },
  { id: 'evaluated_by_name', header: 'Người đánh giá', hiddenByDefault: true, cell: (row) => row.evaluated_by_name },
  { id: 'comment', header: 'Nhận xét', hiddenByDefault: true, cell: (row) => row.comment ?? '' },
];

// Điểm từng chỉ số, nhận xét và lý do đánh giá lại của một phiếu
function EvaluationScores({ evaluation }: { evaluation: Evaluation }) {
  return (
    <div className="flex flex-col gap-1">
      {evaluation.reevaluation_reason ? (
        <span className="text-label text-text-secondary">Đánh giá lại: {evaluation.reevaluation_reason}</span>
      ) : null}
      <ul className="text-label text-text-secondary">
        {evaluation.scores.map((score) => (
          <li key={score.criterion_id}>
            {score.criterion_name}: {score.score}/{score.max_score}
            {score.comment ? ` (${score.comment})` : ''}
          </li>
        ))}
      </ul>
      {evaluation.comment ? <span className="text-content">Nhận xét: {evaluation.comment}</span> : null}
    </div>
  );
}

function EvaluationCard({ evaluation }: { evaluation: Evaluation }) {
  return (
    <div
      className="flex flex-col gap-1 border-t border-border py-2"
      aria-label={`Phiếu đánh giá ${evaluation.full_name} kỳ ${evaluation.period_value}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{evaluation.full_name}</span>
        <span>
          {PERIOD_TYPE_LABELS[evaluation.period_type]} {evaluation.period_value}
        </span>
        <span className="font-semibold">{evaluation.total_score} điểm</span>
        <span>{STATUS_OF_EVALUATION[evaluation.status]}</span>
      </div>
      <EvaluationScores evaluation={evaluation} />
    </div>
  );
}

function CriterionForm({
  orgUnitId,
  onSaved,
  onCancel,
}: {
  orgUnitId: string;
  onSaved(message: string): void;
  onCancel(): void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('1');
  const [maxScore, setMaxScore] = useState('10');
  const addCriterion = useMutation({
    mutationFn: () =>
      send('POST', '/api/v1/evaluation-criteria', {
        org_unit_id: orgUnitId,
        code,
        name,
        weight: Number(weight),
        max_score: Number(maxScore),
      }),
    onSuccess: () => onSaved('Đã thêm chỉ số'),
  });
  return (
    <form
      aria-label="Thêm chỉ số"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        addCriterion.mutate();
      }}
    >
      {addCriterion.error ? <Alert tone="danger">{messageOf(addCriterion.error)}</Alert> : null}
      <FormBlock title="Thêm chỉ số">
        <FormRow label="Mã chỉ số">
          <input className={FORM_CONTROL_CLASS} value={code} onChange={(event) => setCode(event.target.value)} />
        </FormRow>
        <FormRow label="Tên chỉ số">
          <input className={FORM_CONTROL_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
        </FormRow>
        <FormRow label="Trọng số">
          <input
            type="number"
            className={FORM_CONTROL_CLASS}
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
          />
        </FormRow>
        <FormRow label="Điểm tối đa">
          <input
            type="number"
            className={FORM_CONTROL_CLASS}
            value={maxScore}
            onChange={(event) => setMaxScore(event.target.value)}
          />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={addCriterion.isPending || !code || !name}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

function EvaluationForm({
  orgUnitId,
  criteria,
  onSaved,
}: {
  orgUnitId: string;
  criteria: Criterion[];
  onSaved(message: string): void;
}) {
  const staff = useQuery({ queryKey: ['staff', orgUnitId, ''], queryFn: () => listStaff(orgUnitId, '') });
  const [staffId, setStaffId] = useState('');
  const [periodType, setPeriodType] = useState<PeriodType>('term');
  const [periodValue, setPeriodValue] = useState(PERIOD_HINTS.term);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const active = criteria.filter((criterion) => criterion.status === 'active');
  const evaluate = useMutation({
    mutationFn: () =>
      send('POST', '/api/v1/evaluations', {
        staff_id: staffId,
        period_type: periodType,
        period_value: periodValue,
        comment: comment || null,
        reevaluation_reason: reason || null,
        scores: active.map((criterion) => ({ criterion_id: criterion.id, score: Number(scores[criterion.id] ?? 0) })),
      }),
    onSuccess: () => {
      setScores({});
      setComment('');
      setReason('');
      onSaved('Đã lập phiếu đánh giá nháp');
    },
  });
  const error = staff.error ?? evaluate.error;
  return (
    <form
      aria-label="Phiếu đánh giá"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        evaluate.mutate();
      }}
    >
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <FormBlock title="Nhân sự và kỳ đánh giá">
        <FormRow label="Nhân sự được đánh giá">
          <select className={FORM_CONTROL_CLASS} value={staffId} onChange={(event) => setStaffId(event.target.value)}>
            <option value="">Chọn nhân sự</option>
            {(staff.data ?? [])
              .filter((person) => person.status === 'active')
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
          </select>
        </FormRow>
        <FormRow label="Loại kỳ đánh giá">
          <select
            className={FORM_CONTROL_CLASS}
            value={periodType}
            onChange={(event) => {
              const type = event.target.value as PeriodType;
              setPeriodType(type);
              setPeriodValue(PERIOD_HINTS[type]);
            }}
          >
            {(Object.keys(PERIOD_TYPE_LABELS) as PeriodType[]).map((value) => (
              <option key={value} value={value}>
                {PERIOD_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Kỳ đánh giá">
          <input
            className={FORM_CONTROL_CLASS}
            value={periodValue}
            onChange={(event) => setPeriodValue(event.target.value)}
          />
        </FormRow>
      </FormBlock>
      <FormBlock title="Điểm theo chỉ số">
        {active.length === 0 ? (
          <p className="text-content text-text-secondary">Đơn vị chưa có chỉ số đang dùng.</p>
        ) : null}
        {active.map((criterion) => (
          <FormRow key={criterion.id} label={`Điểm ${criterion.name} (tối đa ${criterion.max_score})`}>
            <input
              type="number"
              className={FORM_CONTROL_CLASS}
              value={scores[criterion.id] ?? ''}
              onChange={(event) => setScores((current) => ({ ...current, [criterion.id]: event.target.value }))}
            />
          </FormRow>
        ))}
        <FormRow label="Nhận xét">
          <input className={FORM_CONTROL_CLASS} value={comment} onChange={(event) => setComment(event.target.value)} />
        </FormRow>
        <FormRow label="Lý do đánh giá lại (khi kỳ đã công bố)">
          <input className={FORM_CONTROL_CLASS} value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormRow>
      </FormBlock>
      <div>
        <Button type="submit" variant="primary" disabled={evaluate.isPending || !staffId || active.length === 0}>
          Ghi
        </Button>
      </div>
    </form>
  );
}

function ManageSection({ orgUnitId, onChanged }: { orgUnitId: string; onChanged(message: string): void }) {
  const criteriaGrid = useGridSettings('evaluation-criteria');
  const evaluationGrid = useGridSettings('evaluations');
  const criteria = useQuery({ queryKey: ['evaluation-criteria', orgUnitId], queryFn: () => listCriteria(orgUnitId) });
  const evaluations = useQuery({ queryKey: ['evaluations', orgUnitId], queryFn: () => listEvaluations(orgUnitId) });
  const [addingCriterion, setAddingCriterion] = useState(false);
  const [criterionSearch, setCriterionSearch] = useState('');
  const [evaluationSearch, setEvaluationSearch] = useState('');
  const [evaluationStatus, setEvaluationStatus] = useState<Evaluation['status'] | ''>('');
  const [openId, setOpenId] = useState<string>();

  const toggleCriterion = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) =>
      send('PATCH', `/api/v1/evaluation-criteria/${id}`, { status }),
    onSuccess: () => onChanged('Đã cập nhật chỉ số'),
  });
  const publish = useMutation({
    mutationFn: (evaluationId: string) => send('POST', `/api/v1/evaluations/${evaluationId}/publish`),
    onSuccess: () => onChanged('Đã công bố kết quả đánh giá'),
  });
  const error = [
    criteria.error,
    evaluations.error,
    toggleCriterion.error,
    publish.error,
    criteriaGrid.error,
    evaluationGrid.error,
  ].find(Boolean);
  const criterionKeyword = criterionSearch.trim().toLocaleLowerCase('vi');
  const criterionRows = (criteria.data ?? []).filter(
    (criterion) =>
      criterionKeyword === '' ||
      criterion.code.toLocaleLowerCase('vi').includes(criterionKeyword) ||
      criterion.name.toLocaleLowerCase('vi').includes(criterionKeyword),
  );
  const evaluationKeyword = evaluationSearch.trim().toLocaleLowerCase('vi');
  const evaluationRows = (evaluations.data ?? []).filter(
    (evaluation) =>
      (evaluationStatus === '' || evaluation.status === evaluationStatus) &&
      (evaluationKeyword === '' ||
        evaluation.full_name.toLocaleLowerCase('vi').includes(evaluationKeyword) ||
        evaluation.period_value.toLocaleLowerCase('vi').includes(evaluationKeyword)),
  );

  return (
    <>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <div className="flex flex-col gap-3">
        <h2 className="text-section-title font-semibold text-text">Chỉ số đánh giá của đơn vị</h2>
        {addingCriterion ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <CriterionForm
              key={orgUnitId}
              orgUnitId={orgUnitId}
              onCancel={() => setAddingCriterion(false)}
              onSaved={(message) => {
                setAddingCriterion(false);
                onChanged(message);
              }}
            />
          </section>
        ) : null}
        <DataGrid
          label="Chỉ số đánh giá"
          columns={CRITERION_COLUMNS}
          rows={criterionRows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `chỉ số ${row.name}`}
          getRowAriaLabel={(row) => `Chỉ số ${row.code}`}
          loading={criteria.isPending}
          emptyText="Đơn vị chưa có chỉ số."
          search={{ label: 'Tìm theo mã, tên chỉ số', value: criterionSearch, onChange: setCriterionSearch }}
          toolbar={
            <Button variant="primary" onClick={() => setAddingCriterion(true)}>
              Thêm mới
            </Button>
          }
          rowActions={(criterion) => (
            <Button
              variant="text"
              onClick={() =>
                toggleCriterion.mutate({
                  id: criterion.id,
                  status: criterion.status === 'active' ? 'inactive' : 'active',
                })
              }
            >
              {criterion.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
            </Button>
          )}
          settings={criteriaGrid.settings}
          onSettingsChange={criteriaGrid.update}
        />
      </div>

      <section
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
        aria-label="Lập phiếu đánh giá"
      >
        <h2 className="text-section-title font-semibold text-text">Lập phiếu đánh giá</h2>
        <EvaluationForm key={orgUnitId} orgUnitId={orgUnitId} criteria={criteria.data ?? []} onSaved={onChanged} />
      </section>

      <div className="flex flex-col gap-3">
        <h2 className="text-section-title font-semibold text-text">Phiếu đánh giá của đơn vị</h2>
        <DataGrid
          label="Phiếu đánh giá của đơn vị"
          columns={EVALUATION_COLUMNS}
          rows={evaluationRows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `phiếu đánh giá ${row.full_name} kỳ ${row.period_value}`}
          getRowAriaLabel={(row) => `Phiếu đánh giá ${row.full_name} kỳ ${row.period_value}`}
          loading={evaluations.isPending}
          emptyText="Chưa có phiếu đánh giá."
          search={{ label: 'Tìm theo tên nhân sự, kỳ', value: evaluationSearch, onChange: setEvaluationSearch }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Trạng thái phiếu
                <select
                  value={evaluationStatus}
                  onChange={(event) => setEvaluationStatus(event.target.value as Evaluation['status'] | '')}
                  className={filterClass}
                >
                  <option value="">Tất cả</option>
                  {(Object.keys(STATUS_OF_EVALUATION) as Array<Evaluation['status']>).map((value) => (
                    <option key={value} value={value}>
                      {STATUS_OF_EVALUATION[value]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
          rowActions={(evaluation) => (
            <span className="flex justify-end gap-2">
              <Button variant="text" onClick={() => setOpenId(openId === evaluation.id ? undefined : evaluation.id)}>
                {openId === evaluation.id ? 'Ẩn' : 'Chi tiết'}
              </Button>
              {evaluation.status === 'draft' ? (
                <Button disabled={publish.isPending} onClick={() => publish.mutate(evaluation.id)}>
                  Công bố
                </Button>
              ) : null}
            </span>
          )}
          activeRowId={openId}
          renderRowDetail={(evaluation) =>
            openId === evaluation.id ? <EvaluationScores evaluation={evaluation} /> : null
          }
          settings={evaluationGrid.settings}
          onSettingsChange={evaluationGrid.update}
        />
      </div>
    </>
  );
}

export function EvaluationsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.evaluationManage);
  const unitChoice = useUnitChoice();
  const mine = useQuery({ queryKey: ['evaluations', 'mine'], queryFn: listMyEvaluations });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const changed = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ['evaluations'] });
    void queryClient.invalidateQueries({ queryKey: ['evaluation-criteria'] });
    setToastMessage(message);
  };
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/evaluations')}</h1>
        {canManage && unitChoice.selectedId ? (
          <>
            <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
            <ManageSection orgUnitId={unitChoice.selectedId} onChanged={changed} />
          </>
        ) : null}
        <section
          className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4"
          aria-label="Kết quả đánh giá của tôi"
        >
          <h2 className="text-section-title font-semibold text-text">Kết quả đánh giá của tôi</h2>
          {mine.error ? <Alert tone="danger">{messageOf(mine.error)}</Alert> : null}
          {(mine.data ?? []).map((evaluation) => (
            <EvaluationCard key={evaluation.id} evaluation={evaluation} />
          ))}
          {mine.data?.length === 0 ? (
            <p className="text-content text-text-secondary">Chưa có kết quả đánh giá đã công bố.</p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
