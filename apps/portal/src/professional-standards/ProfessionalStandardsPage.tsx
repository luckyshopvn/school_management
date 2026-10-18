import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, DataGrid, TextField, Toast, type DataGridColumn } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { ExcelImportPanel } from '../imports/ExcelImportPanel.js';
import { AppShell } from '../pages/AppShell.js';
import { matchesSearch } from '../pages/grid-search.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { listStaff } from '../staff/staff-api.js';
import { messageOf, selectClass } from '../work/work-api.js';
import {
  createCriterion,
  finalizeEvaluation,
  LEVEL_LABELS,
  listEvaluations,
  listStandards,
  openEvaluations,
  readEvaluation,
  readMyEvaluation,
  readStatistics,
  saveAssessment,
  saveSelf,
  STANDARD_TYPE_LABELS,
  STATUS_LABELS,
  submitSelf,
  updateCriterion,
  type EvaluationDetail,
  type EvaluationStatus,
  type EvaluationSummary,
  type Level,
  type StandardType,
} from './professional-standards-api.js';

// Đánh giá chuẩn nghề nghiệp (YCTD-102): nhân sự tự đánh giá từng tiêu chí kèm minh chứng rồi gửi; quản lý đơn vị đánh giá
// giáo viên trong đơn vị, Hiệu trưởng đánh giá chuẩn hiệu trưởng; chốt phiếu thì hệ thống xếp loại chung. Thống kê theo
// mức; Hiệu trưởng sửa danh mục tiêu chí (tiêu chí trọng yếu, ngừng dùng, thêm tiêu chí)
// Danh sách phiếu đánh giá của đơn vị theo lưới dữ liệu chung: tìm tại chỗ theo tên nhân sự, Mở rộng tìm kiếm theo loại
// chuẩn, trạng thái (DT-16 phần 16b); phiếu tự đánh giá, thống kê xếp loại và bảng tiêu chí giữ bố cục cũ
type Ratings = Record<string, { rating: Level | ''; text: string }>;
const LEVELS = Object.keys(LEVEL_LABELS) as Level[];

const EVALUATION_COLUMNS: Array<DataGridColumn<EvaluationSummary>> = [
  { id: 'full_name', header: 'Nhân sự', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'standard_type', header: 'Loại chuẩn', cell: (row) => STANDARD_TYPE_LABELS[row.standard_type] },
  { id: 'status', header: 'Trạng thái', cell: (row) => STATUS_LABELS[row.status] },
  {
    id: 'overall_level',
    header: 'Xếp loại',
    cell: (row) => (row.overall_level ? LEVEL_LABELS[row.overall_level] : ''),
  },
];

function LevelSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Level | '';
  onChange(value: Level | ''): void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      className={selectClass}
      onChange={(event) => onChange(event.target.value as Level | '')}
    >
      <option value="">Chưa chọn</option>
      {LEVELS.map((level) => (
        <option key={level} value={level}>
          {LEVEL_LABELS[level]}
        </option>
      ))}
    </select>
  );
}

// Bảng tiêu chí của phiếu: tự đánh giá (minh chứng) hoặc người đánh giá (nhận xét); chọn một mức cho mọi tiêu chí cho nhanh
function EvaluationForm({
  evaluation,
  mode,
  onSaved,
}: {
  evaluation: EvaluationDetail;
  mode: 'self' | 'assess';
  onSaved(evaluation: EvaluationDetail, message: string): void;
}) {
  const initial = useCallback(
    (): Ratings =>
      Object.fromEntries(
        evaluation.items.map((item) => [
          item.criterion_id,
          mode === 'self'
            ? { rating: item.self_rating ?? '', text: item.self_evidence ?? '' }
            : { rating: item.assessor_rating ?? '', text: item.assessor_note ?? '' },
        ]),
      ),
    [evaluation, mode],
  );
  const [ratings, setRatings] = useState<Ratings>(initial);
  const [comment, setComment] = useState(evaluation.assessor_comment ?? '');
  useEffect(() => setRatings(initial()), [initial]);
  const editable =
    (mode === 'self' && evaluation.is_self && evaluation.status === 'self_assessing') ||
    (mode === 'assess' && evaluation.can_assess && evaluation.status === 'self_submitted');
  const items = evaluation.items.map((item) => ({
    criterion_id: item.criterion_id,
    rating: (ratings[item.criterion_id]?.rating || null) as Level | null,
    text: ratings[item.criterion_id]?.text.trim() || null,
  }));
  const save = useMutation({
    mutationFn: () =>
      mode === 'self'
        ? saveSelf(
            evaluation.id,
            items.map((item) => ({ criterion_id: item.criterion_id, rating: item.rating, evidence: item.text })),
          )
        : saveAssessment(
            evaluation.id,
            items.map((item) => ({ criterion_id: item.criterion_id, rating: item.rating, note: item.text })),
            comment.trim() || null,
          ),
    onSuccess: (data) => onSaved(data, mode === 'self' ? 'Đã lưu tự đánh giá' : 'Đã lưu đánh giá'),
  });
  const complete = useMutation({
    mutationFn: async () => {
      const saved = await save.mutateAsync();
      return mode === 'self' ? submitSelf(saved.id) : finalizeEvaluation(saved.id);
    },
    onSuccess: (data) =>
      onSaved(
        data,
        mode === 'self' ? 'Đã gửi tự đánh giá' : `Đã chốt phiếu: ${LEVEL_LABELS[data.overall_level ?? 'met']}`,
      ),
  });
  const error = [save.error, complete.error].find(Boolean);
  const textLabel = mode === 'self' ? 'Minh chứng' : 'Nhận xét';
  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {editable ? (
        <div className="max-w-xs">
          <LevelSelect
            label="Mức cho mọi tiêu chí"
            value=""
            onChange={(level) =>
              setRatings((current) =>
                Object.fromEntries(Object.entries(current).map(([id, value]) => [id, { ...value, rating: level }])),
              )
            }
          />
        </div>
      ) : null}
      <table
        className="w-full text-content"
        aria-label={mode === 'self' ? 'Tiêu chí tự đánh giá' : 'Tiêu chí đánh giá'}
      >
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Tiêu chí</th>
            {mode === 'assess' ? <th>Tự đánh giá</th> : null}
            <th>{mode === 'self' ? 'Tự đánh giá' : 'Đánh giá'}</th>
            <th>{textLabel}</th>
          </tr>
        </thead>
        <tbody>
          {evaluation.items.map((item) => {
            const value = ratings[item.criterion_id] ?? { rating: '', text: '' };
            return (
              <tr key={item.criterion_id} className="border-t border-border align-top">
                <td className="py-2">
                  <span className="text-text-secondary">{item.standard_code} · </span>
                  {item.criterion_code}. {item.criterion_name}
                  {item.is_key ? <span className="text-text-secondary"> (trọng yếu)</span> : null}
                </td>
                {mode === 'assess' ? (
                  <td>
                    {item.self_rating ? LEVEL_LABELS[item.self_rating] : 'Chưa có'}
                    {item.self_evidence ? (
                      <div className="text-label text-text-secondary">{item.self_evidence}</div>
                    ) : null}
                  </td>
                ) : null}
                <td>
                  {editable ? (
                    <LevelSelect
                      label={`${mode === 'self' ? 'Tự đánh giá' : 'Đánh giá'} tiêu chí ${item.criterion_code}`}
                      value={value.rating}
                      onChange={(rating) =>
                        setRatings((current) => ({ ...current, [item.criterion_id]: { ...value, rating } }))
                      }
                    />
                  ) : (
                    (() => {
                      const shown = mode === 'self' ? item.self_rating : item.assessor_rating;
                      return shown ? LEVEL_LABELS[shown] : 'Chưa có';
                    })()
                  )}
                </td>
                <td>
                  {editable ? (
                    <input
                      aria-label={`${textLabel} tiêu chí ${item.criterion_code}`}
                      value={value.text}
                      maxLength={2000}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2"
                      onChange={(event) =>
                        setRatings((current) => ({
                          ...current,
                          [item.criterion_id]: { ...value, text: event.target.value },
                        }))
                      }
                    />
                  ) : (
                    ((mode === 'self' ? item.self_evidence : item.assessor_note) ?? '')
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {mode === 'assess' && editable ? (
        <TextField label="Nhận xét chung" value={comment} onChange={(event) => setComment(event.target.value)} />
      ) : null}
      {editable ? (
        <div className="flex gap-3">
          <Button disabled={save.isPending || complete.isPending} onClick={() => save.mutate()}>
            {mode === 'self' ? 'Lưu tự đánh giá' : 'Lưu đánh giá'}
          </Button>
          <Button
            variant="primary"
            disabled={save.isPending || complete.isPending || items.some((item) => item.rating === null)}
            onClick={() => complete.mutate()}
          >
            {mode === 'self' ? 'Gửi tự đánh giá' : 'Chốt phiếu'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function EvaluationHeader({ evaluation }: { evaluation: EvaluationDetail }) {
  return (
    <p>
      {STANDARD_TYPE_LABELS[evaluation.standard_type]} · {STATUS_LABELS[evaluation.status]}
      {evaluation.overall_level ? ` · Xếp loại: ${LEVEL_LABELS[evaluation.overall_level]}` : ''}
      {evaluation.assessor_comment ? ` · Nhận xét: ${evaluation.assessor_comment}` : ''}
    </p>
  );
}

function MyEvaluation({ onChanged }: { onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: ['professional-evaluations', 'mine'], queryFn: readMyEvaluation });
  const evaluation = mine.data?.evaluation;
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Phiếu tự đánh giá của tôi">
      <h2 className="text-section-title font-semibold text-text">Phiếu tự đánh giá của tôi</h2>
      {mine.error ? <Alert tone="danger">{messageOf(mine.error)}</Alert> : null}
      {mine.data && !evaluation ? (
        <p className="text-text-secondary">Năm học này chưa được mở phiếu đánh giá chuẩn nghề nghiệp.</p>
      ) : null}
      {evaluation ? (
        <>
          <EvaluationHeader evaluation={evaluation} />
          <EvaluationForm
            evaluation={evaluation}
            mode="self"
            onSaved={(data, message) => {
              queryClient.setQueryData(['professional-evaluations', 'mine'], { evaluation: data });
              onChanged(message);
            }}
          />
        </>
      ) : null}
    </section>
  );
}

function AssessmentPanel({ evaluationId, onChanged }: { evaluationId: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ['professional-evaluations', 'detail', evaluationId],
    queryFn: () => readEvaluation(evaluationId),
  });
  if (!detail.data) {
    return detail.error ? <Alert tone="danger">{messageOf(detail.error)}</Alert> : null;
  }
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label={`Phiếu của ${detail.data.full_name}`}>
      <h2 className="text-section-title font-semibold text-text">Phiếu của {detail.data.full_name}</h2>
      <EvaluationHeader evaluation={detail.data} />
      <EvaluationForm
        evaluation={detail.data}
        mode="assess"
        onSaved={(data, message) => {
          queryClient.setQueryData(['professional-evaluations', 'detail', evaluationId], data);
          onChanged(message);
        }}
      />
    </section>
  );
}

function OpenForm({ orgUnitId, onChanged }: { orgUnitId: string; onChanged(message: string): void }) {
  const staff = useQuery({ queryKey: ['staff', orgUnitId, ''], queryFn: () => listStaff(orgUnitId, ''), retry: false });
  const [standardType, setStandardType] = useState<StandardType>('teacher');
  const [chosen, setChosen] = useState<string[]>([]);
  const open = useMutation({
    mutationFn: () => openEvaluations(standardType, chosen),
    onSuccess: (result) => {
      setChosen([]);
      onChanged(
        `Đã mở ${result.created_count} phiếu${result.skipped_staff_ids.length ? `, bỏ qua ${result.skipped_staff_ids.length} nhân sự đã có phiếu` : ''}`,
      );
    },
  });
  const active = (staff.data ?? []).filter((person) => person.status === 'active');
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4" aria-label="Mở phiếu đánh giá">
      <h2 className="text-section-title font-semibold text-text">Mở phiếu đánh giá năm học</h2>
      {open.error ? <Alert tone="danger">{messageOf(open.error)}</Alert> : null}
      <label className="max-w-xs text-label font-medium text-text">
        Loại chuẩn
        <select
          value={standardType}
          className={selectClass}
          onChange={(event) => setStandardType(event.target.value as StandardType)}
        >
          {(Object.keys(STANDARD_TYPE_LABELS) as StandardType[]).map((type) => (
            <option key={type} value={type}>
              {STANDARD_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-3">
        {active.map((person) => (
          <label key={person.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={chosen.includes(person.id)}
              onChange={(event) =>
                setChosen((current) =>
                  event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id),
                )
              }
            />
            {person.full_name}
          </label>
        ))}
      </div>
      <div>
        <Button variant="primary" disabled={open.isPending || chosen.length === 0} onClick={() => open.mutate()}>
          Mở phiếu
        </Button>
      </div>
    </section>
  );
}

function ManageSection({ orgUnitId, onChanged }: { orgUnitId: string; onChanged(message: string): void }) {
  const evaluations = useQuery({
    queryKey: ['professional-evaluations', 'list', orgUnitId],
    queryFn: () => listEvaluations(orgUnitId),
  });
  const statistics = useQuery({
    queryKey: ['professional-evaluations', 'statistics', orgUnitId],
    queryFn: () => readStatistics(orgUnitId),
  });
  const grid = useGridSettings('professional-evaluations');
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<StandardType | ''>('');
  const [statusFilter, setStatusFilter] = useState<EvaluationStatus | ''>('');
  const error = [evaluations.error, statistics.error].find(Boolean);
  const rows = (evaluations.data ?? []).filter(
    (row) =>
      (typeFilter === '' || row.standard_type === typeFilter) &&
      (statusFilter === '' || row.status === statusFilter) &&
      matchesSearch(search, row.full_name),
  );
  return (
    <>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <OpenForm orgUnitId={orgUnitId} onChanged={onChanged} />
      <section className="flex flex-col gap-2 rounded-lg bg-card p-4" aria-label="Thống kê xếp loại">
        <h2 className="text-section-title font-semibold text-text">Thống kê xếp loại</h2>
        <table className="w-full text-content">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-2">Loại chuẩn</th>
              <th>Số phiếu</th>
              <th>Chưa chốt</th>
              {LEVELS.map((level) => (
                <th key={level}>{LEVEL_LABELS[level]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(statistics.data ?? []).map((row) => (
              <tr key={row.standard_type} className="border-t border-border">
                <td className="py-2">{STANDARD_TYPE_LABELS[row.standard_type]}</td>
                <td>{row.total}</td>
                <td>{row.pending}</td>
                {LEVELS.map((level) => (
                  <td key={level}>
                    {row.levels[level]} ({row.level_rates[level]}%)
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
      <DataGrid
        label="Phiếu đánh giá của đơn vị"
        columns={EVALUATION_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.full_name}
        getRowAriaLabel={(row) => `Phiếu ${row.full_name}`}
        loading={evaluations.isPending}
        emptyText="Chưa mở phiếu nào."
        search={{ label: 'Tìm theo tên nhân sự', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Loại chuẩn
              <select
                value={typeFilter}
                className={selectClass}
                onChange={(event) => setTypeFilter(event.target.value as StandardType | '')}
              >
                <option value="">Tất cả</option>
                {(Object.keys(STANDARD_TYPE_LABELS) as StandardType[]).map((type) => (
                  <option key={type} value={type}>
                    {STANDARD_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Trạng thái
              <select
                value={statusFilter}
                className={selectClass}
                onChange={(event) => setStatusFilter(event.target.value as EvaluationStatus | '')}
              >
                <option value="">Tất cả</option>
                {(Object.keys(STATUS_LABELS) as EvaluationStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        rowActions={(row) => (
          <Button variant="text" onClick={() => setSelectedId(row.id)}>
            {row.can_assess && row.status === 'self_submitted' ? 'Đánh giá' : 'Xem'} {row.full_name}
          </Button>
        )}
        activeRowId={selectedId}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      {selectedId ? <AssessmentPanel key={selectedId} evaluationId={selectedId} onChanged={onChanged} /> : null}
    </>
  );
}

function CatalogSection({ canEdit, onChanged }: { canEdit: boolean; onChanged(message: string): void }) {
  const standards = useQuery({ queryKey: ['professional-standards'], queryFn: listStandards });
  const [newNames, setNewNames] = useState<Record<string, string>>({});
  const update = useMutation({
    mutationFn: (input: { id: string; patch: { is_key?: boolean; status?: 'active' | 'inactive' } }) =>
      updateCriterion(input.id, input.patch),
    onSuccess: () => onChanged('Đã cập nhật tiêu chí'),
  });
  const add = useMutation({
    mutationFn: (standardId: string) =>
      createCriterion({ standard_id: standardId, name: newNames[standardId] ?? '', is_key: false }),
    onSuccess: (_, standardId) => {
      setNewNames((current) => ({ ...current, [standardId]: '' }));
      onChanged('Đã thêm tiêu chí');
    },
  });
  const error = [standards.error, update.error, add.error].find(Boolean);
  return (
    <details className="rounded-lg bg-card p-4">
      <summary className="cursor-pointer text-section-title font-semibold text-text">
        Danh mục tiêu chuẩn, tiêu chí
      </summary>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <p className="text-label text-text-secondary">
        Tên tiêu chí rút gọn theo Thông tư 26/2018/TT-BGDĐT và 25/2018/TT-BGDĐT; tiêu chí trọng yếu dùng khi xếp loại
        Khá, Tốt.
      </p>
      {(standards.data ?? []).map((standard) => (
        <div key={standard.id} className="mt-3 flex flex-col gap-1">
          <h3 className="font-semibold">
            {STANDARD_TYPE_LABELS[standard.standard_type]} · {standard.code}. {standard.name}
          </h3>
          <ul className="flex flex-col gap-1">
            {standard.criteria.map((criterion) => (
              <li key={criterion.id} className="flex flex-wrap items-center gap-3">
                <span className={criterion.status === 'active' ? '' : 'text-text-secondary line-through'}>
                  {criterion.code}. {criterion.name}
                </span>
                {canEdit ? (
                  <>
                    <label className="flex items-center gap-1 text-label">
                      <input
                        type="checkbox"
                        checked={criterion.is_key}
                        onChange={(event) =>
                          update.mutate({ id: criterion.id, patch: { is_key: event.target.checked } })
                        }
                      />
                      Trọng yếu
                    </label>
                    <Button
                      variant="text"
                      onClick={() =>
                        update.mutate({
                          id: criterion.id,
                          patch: { status: criterion.status === 'active' ? 'inactive' : 'active' },
                        })
                      }
                    >
                      {criterion.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
                    </Button>
                  </>
                ) : criterion.is_key ? (
                  <span className="text-label text-text-secondary">trọng yếu</span>
                ) : null}
              </li>
            ))}
          </ul>
          {canEdit ? (
            <div className="flex items-end gap-2">
              <TextField
                label={`Tiêu chí mới của ${standard.code} (${STANDARD_TYPE_LABELS[standard.standard_type]})`}
                value={newNames[standard.id] ?? ''}
                onChange={(event) => setNewNames((current) => ({ ...current, [standard.id]: event.target.value }))}
              />
              <Button
                disabled={add.isPending || !(newNames[standard.id] ?? '').trim()}
                onClick={() => add.mutate(standard.id)}
              >
                Thêm tiêu chí
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </details>
  );
}

export function ProfessionalStandardsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.professionalStandardManage);
  const canAssess = useHasPermission(PERMISSION_CODES.professionalStandardAssess);
  const unitChoice = useUnitChoice();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const changed = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ['professional-evaluations'] });
    void queryClient.invalidateQueries({ queryKey: ['professional-standards'] });
    setToastMessage(message);
  };
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/professional-standards')}</h1>
        <MyEvaluation onChanged={changed} />
        {(canManage || canAssess) && unitChoice.selectedId ? (
          <>
            <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
            <ManageSection key={unitChoice.selectedId} orgUnitId={unitChoice.selectedId} onChanged={changed} />
          </>
        ) : null}
        {canAssess ? (
          // Nhập mức đánh giá từ Excel (DT-16 phần 16f, mục 3.2 của Sở): file mẫu, file mẫu kèm dữ liệu (phiếu chưa chốt)
          <ExcelImportPanel
            type="professional_ratings"
            title="Nhập mức đánh giá từ Excel"
            uploadPath="/api/v1/imports"
            uploadFields={{ type: 'professional_ratings' }}
            onCommitted={(result) => changed(`Đã ghi mức đánh giá của ${result.total_rows} phiếu`)}
          />
        ) : null}
        <CatalogSection canEdit={canManage} onChanged={changed} />
      </div>
    </AppShell>
  );
}
