import { useCallback, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import { listStaff } from '../staff/staff-api.js';
import {
  listCriteria,
  listEvaluations,
  listMyEvaluations,
  messageOf,
  PERIOD_HINTS,
  PERIOD_TYPE_LABELS,
  selectClass,
  send,
  STATUS_OF_EVALUATION,
  type Evaluation,
  type PeriodType,
} from './work-api.js';

// MH-58 (đề xuất) Đánh giá nhân sự (P09-05; BR-47; YCTD-81): quản lý đơn vị, phòng nhân sự cấu hình chỉ số của đơn vị,
// chấm điểm theo kỳ, công bố; đã công bố thì chỉ lập đánh giá lại có lý do. Mọi nhân sự xem phiếu đã công bố của mình
function EvaluationCard({ evaluation, children }: { evaluation: Evaluation; children?: ReactNode }) {
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
        {children}
      </div>
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

function ManageSection({ orgUnitId, onChanged }: { orgUnitId: string; onChanged(message: string): void }) {
  const criteria = useQuery({ queryKey: ['evaluation-criteria', orgUnitId], queryFn: () => listCriteria(orgUnitId) });
  const evaluations = useQuery({ queryKey: ['evaluations', orgUnitId], queryFn: () => listEvaluations(orgUnitId) });
  const staff = useQuery({ queryKey: ['staff', orgUnitId, ''], queryFn: () => listStaff(orgUnitId, '') });
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('1');
  const [maxScore, setMaxScore] = useState('10');
  const [staffId, setStaffId] = useState('');
  const [periodType, setPeriodType] = useState<PeriodType>('term');
  const [periodValue, setPeriodValue] = useState(PERIOD_HINTS.term);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const active = (criteria.data ?? []).filter((criterion) => criterion.status === 'active');

  const addCriterion = useMutation({
    mutationFn: () =>
      send('POST', '/api/v1/evaluation-criteria', {
        org_unit_id: orgUnitId,
        code,
        name,
        weight: Number(weight),
        max_score: Number(maxScore),
      }),
    onSuccess: () => {
      setCode('');
      setName('');
      onChanged('Đã thêm chỉ số');
    },
  });
  const toggleCriterion = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) =>
      send('PATCH', `/api/v1/evaluation-criteria/${id}`, { status }),
    onSuccess: () => onChanged('Đã cập nhật chỉ số'),
  });
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
      onChanged('Đã lập phiếu đánh giá nháp');
    },
  });
  const publish = useMutation({
    mutationFn: (evaluationId: string) => send('POST', `/api/v1/evaluations/${evaluationId}/publish`),
    onSuccess: () => onChanged('Đã công bố kết quả đánh giá'),
  });
  const error = [
    criteria.error,
    evaluations.error,
    addCriterion.error,
    toggleCriterion.error,
    evaluate.error,
    publish.error,
  ].find(Boolean);

  return (
    <>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Chỉ số đánh giá">
        <h2 className="text-section-title font-semibold text-text">Chỉ số đánh giá của đơn vị</h2>
        <form
          aria-label="Thêm chỉ số"
          className="grid grid-cols-1 gap-3 md:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            addCriterion.mutate();
          }}
        >
          <TextField label="Mã chỉ số" value={code} onChange={(event) => setCode(event.target.value)} />
          <TextField label="Tên chỉ số" value={name} onChange={(event) => setName(event.target.value)} />
          <TextField
            label="Trọng số"
            type="number"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
          />
          <TextField
            label="Điểm tối đa"
            type="number"
            value={maxScore}
            onChange={(event) => setMaxScore(event.target.value)}
          />
          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={addCriterion.isPending || !code || !name}>
              Thêm chỉ số
            </Button>
          </div>
        </form>
        <table className="w-full text-content">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-2">Mã</th>
              <th>Tên</th>
              <th>Trọng số</th>
              <th>Điểm tối đa</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(criteria.data ?? []).map((criterion) => (
              <tr key={criterion.id} className="border-t border-border">
                <td className="py-2">{criterion.code}</td>
                <td>{criterion.name}</td>
                <td>{criterion.weight}</td>
                <td>{criterion.max_score}</td>
                <td>{criterion.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}</td>
                <td>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Lập phiếu đánh giá">
        <h2 className="text-section-title font-semibold text-text">Lập phiếu đánh giá</h2>
        <form
          aria-label="Phiếu đánh giá"
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            evaluate.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Nhân sự được đánh giá
              <select value={staffId} onChange={(event) => setStaffId(event.target.value)} className={selectClass}>
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
            <label className="text-label font-medium text-text">
              Loại kỳ đánh giá
              <select
                value={periodType}
                onChange={(event) => {
                  const type = event.target.value as PeriodType;
                  setPeriodType(type);
                  setPeriodValue(PERIOD_HINTS[type]);
                }}
                className={selectClass}
              >
                {(Object.keys(PERIOD_TYPE_LABELS) as PeriodType[]).map((value) => (
                  <option key={value} value={value}>
                    {PERIOD_TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Kỳ đánh giá"
              value={periodValue}
              onChange={(event) => setPeriodValue(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {active.map((criterion) => (
              <TextField
                key={criterion.id}
                label={`Điểm ${criterion.name} (tối đa ${criterion.max_score})`}
                type="number"
                value={scores[criterion.id] ?? ''}
                onChange={(event) => setScores((current) => ({ ...current, [criterion.id]: event.target.value }))}
              />
            ))}
          </div>
          <TextField label="Nhận xét" value={comment} onChange={(event) => setComment(event.target.value)} />
          <TextField
            label="Lý do đánh giá lại (khi kỳ đã công bố)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div>
            <Button type="submit" variant="primary" disabled={evaluate.isPending || !staffId || active.length === 0}>
              Lưu phiếu nháp
            </Button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-1 rounded-lg bg-card p-4" aria-label="Phiếu đánh giá của đơn vị">
        <h2 className="text-section-title font-semibold text-text">Phiếu đánh giá của đơn vị</h2>
        {(evaluations.data ?? []).map((evaluation) => (
          <EvaluationCard key={evaluation.id} evaluation={evaluation}>
            {evaluation.status === 'draft' ? (
              <Button disabled={publish.isPending} onClick={() => publish.mutate(evaluation.id)}>
                Công bố
              </Button>
            ) : null}
          </EvaluationCard>
        ))}
        {evaluations.data?.length === 0 ? (
          <p className="text-content text-text-secondary">Chưa có phiếu đánh giá.</p>
        ) : null}
      </section>
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
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">Đánh giá nhân sự</h1>
        {canManage && unitChoice.selectedId ? (
          <>
            <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
            <ManageSection orgUnitId={unitChoice.selectedId} onChanged={changed} />
          </>
        ) : null}
        <section className="flex flex-col gap-1 rounded-lg bg-card p-4" aria-label="Kết quả đánh giá của tôi">
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
