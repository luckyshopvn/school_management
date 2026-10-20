import { Fragment, useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KPI_EVALUATION_STATUS_LABELS, KPI_FORM_LABELS, KPI_TASK_STATUS_LABELS } from '@school-management/shared';
import { Alert, Button, DataGrid, Toast, type DataGridColumn } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import {
  downloadFile,
  listEvaluations,
  listManagerActions,
  listSummary,
  listVoting,
  messageOf,
  rankLabel,
  readAdvisory,
  readEvaluation,
  readMyEvaluation,
  send,
  type EvaluationDetail,
  type EvaluationRow,
  type ManagerActionRow,
  type SummaryRow,
} from './kpi-api.js';
import {
  displayName,
  filterClass,
  PeriodSelect,
  SUBJECT_GROUP_LABELS,
  usePeriodChoice,
  useRuleConfig,
} from './KpiCommon.js';

// MH-166 Tự đánh giá, xếp loại; MH-167 Đánh giá, xếp loại cán bộ; MH-168 Tổng hợp tham mưu; MH-169 Biểu quyết xếp loại;
// MH-170 Báo cáo KPI (DT-18 phần 18d, YCTD-139). Phiếu theo Mẫu 01-A (lãnh đạo, quản lý) hoặc 01-B (cán bộ): tiêu chí chung
// đảm bảo hoặc không, phần kết quả nhiệm vụ tự tính (A, B), điểm thưởng, mức đề xuất; cấp trên điều chỉnh, đánh dấu trường
// hợp loại trừ, kết luận; tham mưu đề xuất mức kèm kiểm tra tỷ lệ xuất sắc; tập thể lãnh đạo biểu quyết. Mẫu báo cáo tải
// Excel, Word, PDF
function ScoreLine({ detail }: { detail: EvaluationDetail }) {
  const config = detail.config;
  return (
    <div
      aria-label="Tổng hợp điểm"
      className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-4 text-content md:grid-cols-6"
    >
      <span>
        Tiêu chí chung: <strong>{detail.general_score}</strong>/{config.general_max}
      </span>
      <span>A (tối đa đầu kỳ): {detail.plan_max}</span>
      <span>B (thực tế): {detail.actual_total}</span>
      <span>
        Kết quả nhiệm vụ: <strong>{detail.task_score}</strong>/{config.task_part_max}
      </span>
      <span>Thưởng: {detail.bonus_score}</span>
      <span>
        Tổng điểm: <strong>{detail.total_score}</strong>
      </span>
      <span className="col-span-2 md:col-span-6">
        Mức đề xuất theo điểm: {rankLabel(config, detail.suggested_rank)}
      </span>
    </div>
  );
}

function CriteriaTable({
  detail,
  marks,
  onToggle,
  superior,
}: {
  detail: EvaluationDetail;
  marks: Record<string, boolean>;
  onToggle?(code: string, value: boolean): void;
  superior?: boolean;
}) {
  return (
    <table className="w-full text-content" aria-label="Tiêu chí chung">
      <thead>
        <tr className="text-left">
          <th className="p-1">TT</th>
          <th className="p-1">Tiêu chí / Nội dung</th>
          <th className="p-1">Điểm tối đa</th>
          <th className="p-1">{superior ? 'Cấp trên: đảm bảo' : 'Đảm bảo'}</th>
        </tr>
      </thead>
      <tbody>
        {detail.criteria.map((group) => (
          <Fragment key={group.code}>
            <tr className="font-semibold">
              <td className="p-1">{group.code}</td>
              <td className="p-1" colSpan={3}>
                {group.title}
              </td>
            </tr>
            {group.items.map((item) => (
              <tr key={`${group.code}-${item.code}`} className="border-t border-border">
                <td className="p-1 align-top">{item.code}</td>
                <td className="p-1">{item.title}</td>
                <td className="p-1 align-top">{item.max_score}</td>
                <td className="p-1 align-top">
                  <input
                    type="checkbox"
                    aria-label={`Đảm bảo tiêu chí ${item.code}`}
                    disabled={!onToggle}
                    checked={marks[item.code] ?? false}
                    onChange={(event) => onToggle?.(item.code, event.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

function TaskSummary({ detail }: { detail: EvaluationDetail }) {
  return (
    <table className="w-full text-content" aria-label="Kết quả từng việc">
      <thead>
        <tr className="text-left">
          <th className="p-1">Trục</th>
          <th className="p-1">Công việc</th>
          <th className="p-1">Trạng thái</th>
          <th className="p-1">Tối đa</th>
          <th className="p-1">Tỷ lệ</th>
          <th className="p-1">Quy đổi</th>
        </tr>
      </thead>
      <tbody>
        {detail.tasks.map((task) => (
          <tr key={task.id} className="border-t border-border">
            <td className="p-1">{task.axis_code}</td>
            <td className="p-1">
              {displayName(task)}
              {task.in_plan ? '' : ' (phát sinh)'}
              {task.exceeded ? ' — vượt yêu cầu' : ''}
            </td>
            <td className="p-1">{KPI_TASK_STATUS_LABELS[task.status] ?? task.status}</td>
            <td className="p-1">{task.max_converted}</td>
            <td className="p-1">{task.task_percent === null ? '' : `${task.task_percent}%`}</td>
            <td className="p-1">{task.converted_score ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReportButtons({ detail }: { detail: EvaluationDetail }) {
  const download = useMutation({
    mutationFn: (input: { path: string; name: string }) => downloadFile(input.path, input.name),
  });
  const base = `/api/v1/kpi/reports/evaluations/${detail.id}`;
  return (
    <div className="flex flex-wrap gap-2">
      {download.error ? <Alert tone="danger">{messageOf(download.error)}</Alert> : null}
      <Button onClick={() => download.mutate({ path: `${base}/task-sheet?format=xlsx`, name: 'bang-tinh-diem.xlsx' })}>
        {KPI_FORM_LABELS.task_sheet} (Excel)
      </Button>
      <Button
        onClick={() => download.mutate({ path: `${base}/self-evaluation?format=docx`, name: 'ban-tu-danh-gia.docx' })}
      >
        {KPI_FORM_LABELS.self_evaluation} (Word)
      </Button>
      <Button
        onClick={() => download.mutate({ path: `${base}/self-evaluation?format=pdf`, name: 'ban-tu-danh-gia.pdf' })}
      >
        {KPI_FORM_LABELS.self_evaluation} (PDF)
      </Button>
      {detail.config.forms.includes('monthly_sheet') ? (
        <Button
          onClick={() =>
            download.mutate({ path: `${base}/monthly-sheet?format=docx`, name: 'phieu-danh-gia-thang.docx' })
          }
        >
          {KPI_FORM_LABELS.monthly_sheet} (Word)
        </Button>
      ) : null}
    </div>
  );
}

const marksOf = (detail: EvaluationDetail | undefined, superior: boolean) =>
  Object.fromEntries(
    (detail?.criteria ?? []).flatMap((group) =>
      group.items.map((item) => [
        item.code,
        superior ? (item.superior_satisfied ?? item.self_satisfied) : item.self_satisfied,
      ]),
    ),
  );

function MyEvaluationForm({ detail, onChanged }: { detail: EvaluationDetail; onChanged(message: string): void }) {
  const [marks, setMarks] = useState<Record<string, boolean>>(() => marksOf(detail, false));
  const [selfRank, setSelfRank] = useState(detail.self_rank ?? detail.suggested_rank ?? '');
  const [comment, setComment] = useState(detail.self_comment ?? '');
  const editable = detail.period_status === 'open' && (detail.status === 'draft' || detail.status === 'returned');
  const body = () => ({
    period_id: detail.period_id,
    criteria: Object.entries(marks).map(([code, satisfied]) => ({ code, satisfied })),
    self_rank: selfRank || null,
    self_comment: comment || null,
  });
  const save = useMutation({
    mutationFn: () => send('PUT', '/api/v1/kpi/evaluations/mine', body()),
    onSuccess: () => onChanged('Đã ghi bản tự đánh giá'),
  });
  const submit = useMutation({
    mutationFn: async () => {
      await send('PUT', '/api/v1/kpi/evaluations/mine', body());
      return send('POST', '/api/v1/kpi/evaluations/mine/submit', { period_id: detail.period_id });
    },
    onSuccess: () => onChanged('Đã nộp bản tự đánh giá'),
  });
  const error = [save.error, submit.error].find(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <p className="text-content">
        {detail.full_name} — {detail.org_unit_name} — {SUBJECT_GROUP_LABELS[detail.subject_group]} —{' '}
        {detail.rule_set_name} (phiên bản {detail.version_no}) — {KPI_EVALUATION_STATUS_LABELS[detail.status]}
      </p>
      {detail.return_reason ? <Alert tone="warning">Cấp trên trả lại: {detail.return_reason}</Alert> : null}
      <ScoreLine detail={detail} />
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-section-title font-semibold">A. Nhóm tiêu chí chung</h2>
        <CriteriaTable
          detail={detail}
          marks={marks}
          onToggle={editable ? (code, value) => setMarks({ ...marks, [code]: value }) : undefined}
        />
      </section>
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-section-title font-semibold">B. Kết quả thực hiện nhiệm vụ</h2>
        <TaskSummary detail={detail} />
      </section>
      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <label className="text-label font-medium text-text">
          Tự đề xuất xếp loại
          <select
            disabled={!editable}
            className={filterClass}
            value={selfRank}
            onChange={(event) => setSelfRank(event.target.value)}
          >
            <option value="">Chọn mức</option>
            {detail.config.ranks.map((rank) => (
              <option key={rank.code} value={rank.code}>
                {rank.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Tự nhận xét
          <textarea
            disabled={!editable}
            rows={3}
            className={filterClass}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
        {detail.superior_rank ? (
          <span className="text-content">
            Cấp trên ({detail.superior_by_name}): {rankLabel(detail.config, detail.superior_rank)}
            {detail.superior_comment ? ` — ${detail.superior_comment}` : ''}
          </span>
        ) : null}
        {detail.final_rank ? <strong>Kết quả xếp loại: {rankLabel(detail.config, detail.final_rank)}</strong> : null}
        {editable ? (
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Ghi
            </Button>
            <Button variant="primary" onClick={() => submit.mutate()} disabled={!selfRank || submit.isPending}>
              Nộp bản tự đánh giá
            </Button>
          </div>
        ) : null}
      </section>
      <ReportButtons detail={detail} />
    </div>
  );
}

export function KpiMyEvaluationPage() {
  const queryClient = useQueryClient();
  const choice = usePeriodChoice();
  const periodId = choice.period?.id;
  const evaluation = useQuery({
    queryKey: ['kpi', 'my-evaluation', periodId],
    queryFn: () => readMyEvaluation(periodId!),
    enabled: Boolean(periodId),
    retry: false,
  });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/kpi/my-evaluation')}</h1>
        <PeriodSelect choice={choice} />
        {evaluation.error ? <Alert tone="warning">{messageOf(evaluation.error)}</Alert> : null}
        {evaluation.data ? (
          <MyEvaluationForm
            key={`${evaluation.data.id}-${evaluation.data.status}`}
            detail={evaluation.data}
            onChanged={(message) => {
              void queryClient.invalidateQueries({ queryKey: ['kpi'] });
              setToastMessage(message);
            }}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

function ConcludeForm({ evaluationId, onChanged }: { evaluationId: string; onChanged(message: string): void }) {
  const detail = useQuery({
    queryKey: ['kpi', 'evaluation', evaluationId],
    queryFn: () => readEvaluation(evaluationId),
  });
  if (!detail.data) {
    return detail.error ? <Alert tone="danger">{messageOf(detail.error)}</Alert> : null;
  }
  return <ConcludeBody key={detail.data.status} detail={detail.data} onChanged={onChanged} />;
}

function ConcludeBody({ detail, onChanged }: { detail: EvaluationDetail; onChanged(message: string): void }) {
  const [marks, setMarks] = useState<Record<string, boolean>>(() => marksOf(detail, true));
  const [rank, setRank] = useState(detail.superior_rank ?? detail.suggested_rank ?? '');
  const [exclusions, setExclusions] = useState<string[]>(detail.exclusions ?? []);
  const [exclusionNote, setExclusionNote] = useState(detail.exclusion_note ?? '');
  const [comment, setComment] = useState(detail.superior_comment ?? '');
  const open = detail.period_status === 'open' && (detail.status === 'submitted' || detail.status === 'concluded');
  const conclude = useMutation({
    mutationFn: () =>
      send('POST', `/api/v1/kpi/evaluations/${detail.id}/conclude`, {
        criteria: Object.entries(marks).map(([code, satisfied]) => ({ code, satisfied })),
        exclusions,
        exclusion_note: exclusionNote || null,
        rank,
        comment: comment || null,
      }),
    onSuccess: () => onChanged('Đã kết luận đánh giá'),
  });
  const giveBack = useMutation({
    mutationFn: () => send('POST', `/api/v1/kpi/evaluations/${detail.id}/return`, { reason: comment }),
    onSuccess: () => onChanged('Đã trả lại bản tự đánh giá'),
  });
  const error = [conclude.error, giveBack.error].find(Boolean);
  return (
    <div className="flex flex-col gap-3" aria-label={`Đánh giá ${detail.full_name}`}>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <ScoreLine detail={detail} />
      <span className="text-content">
        Tự đề xuất: {rankLabel(detail.config, detail.self_rank)}
        {detail.self_comment ? ` — ${detail.self_comment}` : ''}
      </span>
      <CriteriaTable
        detail={detail}
        marks={marks}
        superior
        onToggle={open ? (code, value) => setMarks({ ...marks, [code]: value }) : undefined}
      />
      <TaskSummary detail={detail} />
      {open ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <fieldset className="text-label">
            <legend className="font-medium">Trường hợp loại trừ</legend>
            {detail.config.exclusions.map((item) => (
              <label key={item.code} className="block">
                <input
                  type="checkbox"
                  checked={exclusions.includes(item.code)}
                  onChange={(event) =>
                    setExclusions(
                      event.target.checked
                        ? [...exclusions, item.code]
                        : exclusions.filter((code) => code !== item.code),
                    )
                  }
                />{' '}
                {item.label}
              </label>
            ))}
            <input
              className={filterClass}
              placeholder="Ghi chú trường hợp loại trừ"
              value={exclusionNote}
              onChange={(event) => setExclusionNote(event.target.value)}
            />
          </fieldset>
          <div className="flex flex-col gap-2">
            <label className="text-label font-medium text-text">
              Mức xếp loại
              <select className={filterClass} value={rank} onChange={(event) => setRank(event.target.value)}>
                <option value="">Chọn mức</option>
                {detail.config.ranks.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Nhận xét (lý do khi trả lại)
              <textarea
                rows={2}
                className={filterClass}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <Button variant="primary" disabled={!rank || conclude.isPending} onClick={() => conclude.mutate()}>
                Kết luận
              </Button>
              <Button disabled={!comment || giveBack.isPending} onClick={() => giveBack.mutate()}>
                Trả lại
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <ReportButtons detail={detail} />
    </div>
  );
}

function evaluationColumns(extra: Array<DataGridColumn<EvaluationRow>> = []): Array<DataGridColumn<EvaluationRow>> {
  return [
    {
      id: 'full_name',
      header: 'Họ và tên',
      alwaysVisible: true,
      className: 'font-medium',
      cell: (row) => row.full_name,
    },
    { id: 'org_unit_name', header: 'Đơn vị', cell: (row) => row.org_unit_name },
    { id: 'subject_group', header: 'Nhóm', cell: (row) => SUBJECT_GROUP_LABELS[row.subject_group] },
    { id: 'rule_set_name', header: 'Bộ quy tắc', hiddenByDefault: true, cell: (row) => row.rule_set_name },
    { id: 'status', header: 'Trạng thái', cell: (row) => KPI_EVALUATION_STATUS_LABELS[row.status] ?? row.status },
    { id: 'general_score', header: 'Tiêu chí chung', cell: (row) => row.general_score },
    { id: 'task_score', header: 'Kết quả nhiệm vụ', cell: (row) => row.task_score },
    { id: 'bonus_score', header: 'Thưởng', hiddenByDefault: true, cell: (row) => row.bonus_score },
    { id: 'total_score', header: 'Tổng điểm', cell: (row) => row.total_score },
    ...extra,
  ];
}

function RankCell({ versionId, code }: { versionId: string | null; code: string | null }) {
  const config = useRuleConfig(versionId);
  return <>{rankLabel(config, code)}</>;
}

export function KpiEvaluationsPage() {
  const queryClient = useQueryClient();
  const choice = usePeriodChoice();
  const periodId = choice.period?.id;
  const rows = useQuery({
    queryKey: ['kpi', 'evaluations', periodId],
    queryFn: () => listEvaluations(periodId!),
    enabled: Boolean(periodId),
  });
  const grid = useGridSettings('kpi-evaluations');
  const [openId, setOpenId] = useState<string>();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const keyword = search.trim().toLocaleLowerCase('vi');
  const columns = evaluationColumns([
    {
      id: 'self_rank',
      header: 'Tự xếp loại',
      cell: (row) => <RankCell versionId={row.rule_set_version_id} code={row.self_rank} />,
    },
    {
      id: 'superior_rank',
      header: 'Cấp trên xếp loại',
      cell: (row) => <RankCell versionId={row.rule_set_version_id} code={row.superior_rank} />,
    },
  ]);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/kpi/evaluations')}</h1>
        {rows.error ? <Alert tone="danger">{messageOf(rows.error)}</Alert> : null}
        <PeriodSelect choice={choice} />
        <DataGrid
          label="Đánh giá, xếp loại cán bộ"
          columns={columns}
          rows={(rows.data ?? []).filter(
            (row) =>
              (!status || row.status === status) &&
              (!keyword || row.full_name.toLocaleLowerCase('vi').includes(keyword)),
          )}
          getRowId={(row) => row.staff_id}
          getRowLabel={(row) => row.full_name}
          getRowAriaLabel={(row) => `Phiếu của ${row.full_name}`}
          loading={rows.isPending && Boolean(periodId)}
          emptyText="Chưa có đối tượng đánh giá."
          search={{ label: 'Tìm theo họ tên', value: search, onChange: setSearch }}
          advancedSearch={
            <label className="text-label font-medium text-text">
              Trạng thái
              <select className={filterClass} value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Tất cả</option>
                {Object.entries(KPI_EVALUATION_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          }
          rowActions={(row) =>
            row.id ? (
              <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : (row.id ?? undefined))}>
                {openId === row.id ? 'Ẩn' : row.status === 'submitted' ? 'Đánh giá' : 'Xem'}
              </Button>
            ) : null
          }
          activeRowId={openId ? rows.data?.find((row) => row.id === openId)?.staff_id : undefined}
          renderRowDetail={(row) =>
            row.id && openId === row.id ? (
              <ConcludeForm
                evaluationId={row.id}
                onChanged={(message) => {
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

function AdvisoryRow({
  row,
  value,
  onChange,
}: {
  row: EvaluationRow;
  value: { rank: string; comment: string };
  onChange(next: { rank: string; comment: string }): void;
}) {
  const config = useRuleConfig(row.rule_set_version_id);
  return (
    <span className="flex flex-wrap gap-2">
      <select
        aria-label={`Mức tham mưu cho ${row.full_name}`}
        className={filterClass}
        value={value.rank}
        onChange={(event) => onChange({ ...value, rank: event.target.value })}
      >
        <option value="">Chưa đề xuất</option>
        {(config?.ranks ?? []).map((rank) => (
          <option key={rank.code} value={rank.code}>
            {rank.label}
          </option>
        ))}
      </select>
      <input
        aria-label={`Ghi chú tham mưu cho ${row.full_name}`}
        className={filterClass}
        value={value.comment}
        onChange={(event) => onChange({ ...value, comment: event.target.value })}
      />
    </span>
  );
}

export function KpiAdvisoryPage() {
  const queryClient = useQueryClient();
  const choice = usePeriodChoice();
  const periodId = choice.period?.id;
  const advisory = useQuery({
    queryKey: ['kpi', 'advisory', periodId],
    queryFn: () => readAdvisory(periodId!),
    enabled: Boolean(periodId),
  });
  const grid = useGridSettings('kpi-advisory');
  const [values, setValues] = useState<Record<string, { rank: string; comment: string }>>({});
  const [search, setSearch] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const concluded = (advisory.data?.rows ?? []).filter((row) => row.id && row.status === 'concluded');
  const valueOf = (row: EvaluationRow) =>
    values[row.id!] ?? { rank: row.advisory_rank ?? row.superior_rank ?? '', comment: row.advisory_comment ?? '' };
  const save = useMutation({
    mutationFn: () =>
      send('PUT', '/api/v1/kpi/advisory', {
        period_id: periodId,
        items: concluded.map((row) => ({
          evaluation_id: row.id,
          rank: valueOf(row).rank || null,
          comment: valueOf(row).comment || null,
        })),
      }),
    onSuccess: () => {
      setValues({});
      void queryClient.invalidateQueries({ queryKey: ['kpi'] });
      setToastMessage('Đã ghi đề xuất tham mưu');
    },
  });
  const keyword = search.trim().toLocaleLowerCase('vi');
  const columns = evaluationColumns([
    {
      id: 'superior_rank',
      header: 'Cấp trên xếp loại',
      cell: (row) => <RankCell versionId={row.rule_set_version_id} code={row.superior_rank} />,
    },
    {
      id: 'votes',
      header: 'Biểu quyết',
      cell: (row) =>
        Object.entries(row.votes ?? {})
          .map(([code, count]) => `${code}: ${count}`)
          .join(', '),
    },
    {
      id: 'advisory',
      header: 'Tham mưu đề xuất',
      alwaysVisible: true,
      cell: (row) =>
        row.id && row.status === 'concluded' && choice.period?.status === 'open' ? (
          <AdvisoryRow row={row} value={valueOf(row)} onChange={(next) => setValues({ ...values, [row.id!]: next })} />
        ) : (
          <RankCell versionId={row.rule_set_version_id} code={row.advisory_rank} />
        ),
    },
  ]);
  const error = [advisory.error, save.error].find(Boolean);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/kpi/advisory')}</h1>
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        <PeriodSelect choice={choice} />
        {(advisory.data?.quotas ?? []).map((quota) => (
          <Alert key={`${quota.rule_set_name}-${quota.group}`} tone={quota.exceeded ? 'warning' : 'info'}>
            {quota.rule_set_name}
            {quota.group !== 'all' ? `, ${SUBJECT_GROUP_LABELS[quota.group]}` : ''}: xuất sắc {quota.excellent}/
            {quota.limit} người được phép (tính trên {quota.base} người){quota.exceeded ? ' — vượt tỷ lệ' : ''}
          </Alert>
        ))}
        <DataGrid
          label="Tổng hợp tham mưu"
          columns={columns}
          rows={(advisory.data?.rows ?? []).filter(
            (row) => !keyword || row.full_name.toLocaleLowerCase('vi').includes(keyword),
          )}
          getRowId={(row) => row.staff_id}
          getRowLabel={(row) => row.full_name}
          getRowAriaLabel={(row) => `Tham mưu ${row.full_name}`}
          loading={advisory.isPending && Boolean(periodId)}
          search={{ label: 'Tìm theo họ tên', value: search, onChange: setSearch }}
          toolbar={
            choice.period?.status === 'open' ? (
              <Button
                variant="primary"
                disabled={concluded.length === 0 || save.isPending}
                onClick={() => save.mutate()}
              >
                Ghi đề xuất
              </Button>
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}

function VoteCell({ row, value, onChange }: { row: EvaluationRow; value: string; onChange(next: string): void }) {
  const config = useRuleConfig(row.rule_set_version_id);
  return (
    <select
      aria-label={`Biểu quyết cho ${row.full_name}`}
      className={filterClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Chưa biểu quyết</option>
      {(config?.ranks ?? []).map((rank) => (
        <option key={rank.code} value={rank.code}>
          {rank.label}
        </option>
      ))}
    </select>
  );
}

export function KpiVotingPage() {
  const queryClient = useQueryClient();
  const choice = usePeriodChoice();
  const periodId = choice.period?.id;
  const rows = useQuery({
    queryKey: ['kpi', 'voting', periodId],
    queryFn: () => listVoting(periodId!),
    enabled: Boolean(periodId),
  });
  const grid = useGridSettings('kpi-voting');
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const [search, setSearch] = useState('');
  const chosen = (row: EvaluationRow) => votes[row.id!] ?? row.my_vote ?? '';
  const save = useMutation({
    mutationFn: () =>
      send('PUT', '/api/v1/kpi/voting', {
        period_id: periodId,
        votes: (rows.data ?? [])
          .filter((row) => chosen(row))
          .map((row) => ({ evaluation_id: row.id, rank: chosen(row) })),
      }),
    onSuccess: () => {
      setVotes({});
      void queryClient.invalidateQueries({ queryKey: ['kpi'] });
      setToastMessage('Đã ghi biểu quyết');
    },
  });
  const keyword = search.trim().toLocaleLowerCase('vi');
  const columns = evaluationColumns([
    {
      id: 'advisory_rank',
      header: 'Tham mưu đề xuất',
      cell: (row) => <RankCell versionId={row.rule_set_version_id} code={row.advisory_rank ?? row.superior_rank} />,
    },
    {
      id: 'votes',
      header: 'Kết quả biểu quyết',
      cell: (row) =>
        Object.entries(row.votes ?? {})
          .map(([code, count]) => `${code}: ${count}`)
          .join(', '),
    },
    {
      id: 'my_vote',
      header: 'Biểu quyết của tôi',
      alwaysVisible: true,
      cell: (row) =>
        choice.period?.status === 'open' ? (
          <VoteCell row={row} value={chosen(row)} onChange={(next) => setVotes({ ...votes, [row.id!]: next })} />
        ) : (
          <RankCell versionId={row.rule_set_version_id} code={row.my_vote ?? null} />
        ),
    },
  ]);
  const error = [rows.error, save.error].find(Boolean);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/kpi/voting')}</h1>
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        <PeriodSelect choice={choice} />
        <DataGrid
          label="Biểu quyết xếp loại"
          columns={columns}
          rows={(rows.data ?? []).filter((row) => !keyword || row.full_name.toLocaleLowerCase('vi').includes(keyword))}
          getRowId={(row) => row.staff_id}
          getRowLabel={(row) => row.full_name}
          getRowAriaLabel={(row) => `Biểu quyết ${row.full_name}`}
          loading={rows.isPending && Boolean(periodId)}
          emptyText="Chưa có phiếu đã được cấp trên kết luận."
          search={{ label: 'Tìm theo họ tên', value: search, onChange: setSearch }}
          toolbar={
            choice.period?.status === 'open' ? (
              <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                Ghi biểu quyết
              </Button>
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}

const SUMMARY_COLUMNS: Array<DataGridColumn<SummaryRow>> = [
  { id: 'full_name', header: 'Họ và tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'job_title_name', header: 'Chức vụ', hiddenByDefault: true, cell: (row) => row.job_title_name ?? '' },
  { id: 'org_unit_name', header: 'Đơn vị', cell: (row) => row.org_unit_name },
  { id: 'status_label', header: 'Trạng thái', cell: (row) => row.status_label },
  { id: 'general_score', header: 'Tiêu chí chung', cell: (row) => row.general_score },
  { id: 'task_score', header: 'Kết quả nhiệm vụ', cell: (row) => row.task_score },
  { id: 'bonus_score', header: 'Thưởng', cell: (row) => row.bonus_score },
  { id: 'total_score', header: 'Tổng điểm', cell: (row) => row.total_score },
  { id: 'self_rank', header: 'Tự xếp loại', hiddenByDefault: true, cell: (row) => row.self_rank },
  { id: 'superior_rank', header: 'Cấp trên', cell: (row) => row.superior_rank },
  { id: 'advisory_rank', header: 'Tham mưu', hiddenByDefault: true, cell: (row) => row.advisory_rank },
  { id: 'final_rank', header: 'Kết quả xếp loại', cell: (row) => row.final_rank },
];

const ACTION_COLUMNS: Array<DataGridColumn<ManagerActionRow>> = [
  {
    id: 'manager_name',
    header: 'Người quản lý',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => row.manager_name,
  },
  { id: 'org_unit_name', header: 'Đơn vị', cell: (row) => row.org_unit_name ?? '' },
  { id: 'action_label', header: 'Việc phải làm', cell: (row) => row.action_label },
  { id: 'total', header: 'Tổng số', cell: (row) => row.total },
  { id: 'on_time', header: 'Đúng hạn', cell: (row) => row.on_time },
  { id: 'late', header: 'Quá hạn', cell: (row) => row.late },
  { id: 'automatic', header: 'Hệ thống tự xử lý', cell: (row) => row.automatic },
];

export function KpiReportsPage() {
  const choice = usePeriodChoice();
  const periodId = choice.period?.id;
  const summary = useQuery({
    queryKey: ['kpi', 'summary', periodId],
    queryFn: () => listSummary(periodId!),
    enabled: Boolean(periodId),
    retry: false,
  });
  const actions = useQuery({
    queryKey: ['kpi', 'manager-actions', periodId],
    queryFn: () => listManagerActions(periodId!),
    enabled: Boolean(periodId),
    retry: false,
  });
  const summaryGrid = useGridSettings('kpi-evaluations');
  const actionsGrid = useGridSettings('kpi-manager-actions');
  const [staffId, setStaffId] = useState('');
  const download = useMutation({
    mutationFn: (input: { path: string; name: string }) => downloadFile(input.path, input.name),
  });
  const base = `/api/v1/kpi/reports/periods/${periodId}`;
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/kpi/reports')}</h1>
        {download.error ? <Alert tone="danger">{messageOf(download.error)}</Alert> : null}
        <PeriodSelect choice={choice} />
        <p className="text-content text-text-secondary">
          Mẫu của từng người (Bảng tính điểm KPI, Bản tự đánh giá, Phiếu theo dõi tháng) tải ở mục 4.1 hoặc 4.2.
        </p>
        {summary.error ? (
          <Alert tone="info">{messageOf(summary.error)}</Alert>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {(['xlsx', 'pdf', 'docx'] as const).map((format) => (
                <Button
                  key={format}
                  disabled={!periodId}
                  onClick={() =>
                    download.mutate({ path: `${base}/unit-summary?format=${format}`, name: `tong-hop.${format}` })
                  }
                >
                  {KPI_FORM_LABELS.unit_summary} ({format === 'xlsx' ? 'Excel' : format === 'pdf' ? 'PDF' : 'Word'})
                </Button>
              ))}
              <Button
                disabled={!periodId}
                onClick={() => download.mutate({ path: `${base}/manager-actions/export`, name: 'trach-nhiem.xlsx' })}
              >
                Sổ trách nhiệm chấm, duyệt (Excel)
              </Button>
            </div>
            {choice.period?.period_type === 'year' ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-label font-medium text-text">
                  Phiếu xếp loại năm của
                  <select className={filterClass} value={staffId} onChange={(event) => setStaffId(event.target.value)}>
                    <option value="">Chọn người</option>
                    {(summary.data ?? []).map((row) => (
                      <option key={row.staff_id} value={row.staff_id}>
                        {row.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  disabled={!staffId}
                  onClick={() =>
                    download.mutate({
                      path: `${base}/annual-sheet?staff_id=${staffId}&format=docx`,
                      name: 'phieu-nam.docx',
                    })
                  }
                >
                  {KPI_FORM_LABELS.annual_sheet} (Word)
                </Button>
              </div>
            ) : null}
            <DataGrid
              label="Bảng tổng hợp kết quả đánh giá"
              columns={SUMMARY_COLUMNS}
              rows={summary.data ?? []}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.full_name}
              loading={summary.isPending && Boolean(periodId)}
              emptyText="Chưa có phiếu đánh giá."
              settings={summaryGrid.settings}
              onSettingsChange={summaryGrid.update}
            />
            <h2 className="text-section-title font-semibold">Trách nhiệm chấm, duyệt của người quản lý</h2>
            <DataGrid
              label="Trách nhiệm chấm, duyệt"
              columns={ACTION_COLUMNS}
              rows={actions.data ?? []}
              getRowId={(row) => `${row.manager_name}-${row.action}`}
              getRowLabel={(row) => row.manager_name}
              loading={actions.isPending && Boolean(periodId)}
              emptyText="Chưa có việc duyệt, chấm."
              settings={actionsGrid.settings}
              onSettingsChange={actionsGrid.update}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
