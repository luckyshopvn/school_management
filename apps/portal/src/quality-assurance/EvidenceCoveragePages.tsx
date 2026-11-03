import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormRow,
  StatusBadge,
  type DataGridColumn,
} from '@school-management/ui';
import { formatDate, messageOf, selectClass } from '../archives/archive-ui.js';
import { Page, useToast } from '../directives/directive-ui.js';
import { useGridSettings } from '../pages/grid-settings.js';
import {
  assignEvidenceCriteria,
  assignEvidenceFromGroups,
  listEvidenceAssignees,
  readEvidenceCoverage,
  readEvidenceFrameworks,
  readEvidenceOverview,
  type EvidenceCoverageRow,
} from './evidence-api.js';

// Tổng quan (MH-678), độ phủ theo tiêu chí (MH-682), phân công phụ trách tiêu chí (MH-683) của kho minh chứng (YCTD-396 lát
// L4). Tiêu chí thiếu khi không có minh chứng Đã đủ, còn hiệu lực, dùng cho một năm học trong chu kỳ của bộ (BR-548)

const textOrNull = (value: string) => (value.trim() === '' ? null : value.trim());

function coverageText(covered: number, total: number, percent: number) {
  return `${covered}/${total} tiêu chí (${percent}%)`;
}

// Ô chọn bộ tiêu chí dùng chung cho Độ phủ và Phân công; mở sẵn bộ ở đường dẫn (?framework_id=) hoặc bộ đang dùng đầu tiên
export function useFrameworkChoice() {
  const frameworks = useQuery({ queryKey: ['evidence', 'frameworks'], queryFn: readEvidenceFrameworks });
  const [frameworkId, setFrameworkId] = useState(
    () => new URLSearchParams(window.location.search).get('framework_id') ?? '',
  );
  // Như danh sách minh chứng: bộ đang dùng đầu tiên đã có tiêu chí
  const active = (frameworks.data?.frameworks ?? []).filter((row) => row.status === 'active');
  const first = (active.find((row) => row.standards.some((standard) => standard.criteria.length > 0)) ?? active[0])?.id;
  useEffect(() => {
    if (!frameworkId && first) {
      setFrameworkId(first);
    }
  }, [frameworkId, first]);
  const select = (
    <label className="text-label font-medium text-text">
      Bộ tiêu chí
      <select className={selectClass} value={frameworkId} onChange={(event) => setFrameworkId(event.target.value)}>
        {(frameworks.data?.frameworks ?? []).length === 0 ? <option value="">Chưa có bộ tiêu chí</option> : null}
        {(frameworks.data?.frameworks ?? []).map((row) => (
          <option key={row.id} value={row.id}>
            {row.code} · {row.name}
          </option>
        ))}
      </select>
    </label>
  );
  return { frameworkId, select, error: frameworks.error };
}

const COVERAGE_COLUMNS: Array<DataGridColumn<EvidenceCoverageRow>> = [
  {
    id: 'code',
    header: 'Tiêu chí',
    alwaysVisible: true,
    className: 'font-medium whitespace-nowrap',
    cell: (row) => row.code,
  },
  { id: 'title', header: 'Nội dung', cell: (row) => row.title },
  {
    id: 'covered',
    header: 'Độ phủ',
    cell: (row) =>
      row.covered ? <StatusBadge tone="success" label="Đủ minh chứng" /> : <StatusBadge tone="danger" label="Thiếu" />,
  },
  { id: 'sufficient', header: 'Đã đủ', className: 'text-right', cell: (row) => row.sufficient },
  { id: 'collecting', header: 'Đang thu thập', className: 'text-right', cell: (row) => row.collecting },
  { id: 'missing', header: 'Chưa có', className: 'text-right', cell: (row) => row.missing },
  { id: 'needs_update', header: 'Cần cập nhật', className: 'text-right', cell: (row) => row.needs_update },
  { id: 'expired', header: 'Hết hiệu lực', className: 'text-right', cell: (row) => row.expired },
  {
    id: 'out_of_cycle',
    header: 'Ngoài chu kỳ',
    className: 'text-right',
    hiddenByDefault: true,
    cell: (row) => row.out_of_cycle,
  },
  {
    id: 'hint',
    header: 'Gợi ý minh chứng',
    hiddenByDefault: true,
    cell: (row) => (row.covered ? '' : (row.evidence_hint ?? '')),
  },
  { id: 'assignee', header: 'Người phụ trách', cell: (row) => row.assignee?.user_name ?? '' },
  { id: 'due', header: 'Hạn', cell: (row) => formatDate(row.assignee?.due_date ?? null) },
];

// 1.1 Tổng quan
export function EvidenceOverviewPage() {
  const overview = useQuery({ queryKey: ['evidence', 'overview'], queryFn: readEvidenceOverview });
  const data = overview.data;
  return (
    <Page path="/quality/evidence-overview">
      {overview.error ? <Alert tone="danger">{messageOf(overview.error)}</Alert> : null}
      {data ? <p className="text-content text-muted">Năm học {data.school_year_name}</p> : null}
      {data && data.mine.length > 0 ? (
        <section aria-label="Tiêu chí tôi phụ trách" className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-title font-semibold">Tiêu chí tôi phụ trách</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {data.mine.map((row) => (
              <li key={`${row.framework_id}:${row.id}`} className="text-content">
                <a
                  className="text-primary underline"
                  href={`/quality/evidence-coverage?framework_id=${row.framework_id}`}
                >
                  {row.code} {row.title}
                </a>{' '}
                · {row.framework_name}
                {row.due_date ? ` · hạn ${formatDate(row.due_date)}` : ''}{' '}
                {row.covered ? (
                  <StatusBadge tone="success" label="Đủ minh chứng" />
                ) : (
                  <StatusBadge tone="danger" label="Thiếu" />
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data && data.frameworks.length === 0 ? <Alert tone="info">Năm học này chưa có bộ tiêu chí.</Alert> : null}
      {(data?.frameworks ?? []).map((framework) => (
        <section
          key={framework.id}
          aria-label={`Độ phủ ${framework.name}`}
          className="rounded-xl border border-border bg-card p-4"
        >
          <h2 className="text-title font-semibold">
            {framework.code} · {framework.name}
          </h2>
          <p className="text-content">
            Đủ minh chứng: {coverageText(framework.covered_count, framework.criterion_count, framework.covered_percent)}
          </p>
          <ul className="mt-2 grid gap-1 md:grid-cols-2">
            {framework.standards.map((standard) => (
              <li key={standard.code} className="text-content">
                Tiêu chuẩn {standard.code}:{' '}
                {coverageText(standard.covered_count, standard.criterion_count, standard.covered_percent)}
              </li>
            ))}
          </ul>
          {framework.missing.length > 0 ? (
            <>
              <h3 className="mt-3 font-medium">Tiêu chí còn thiếu ({framework.missing_count})</h3>
              <ul className="flex flex-col gap-1">
                {framework.missing.map((row) => (
                  <li key={row.id} className="text-content">
                    {row.code} {row.title}
                    {row.assignee_name ? ` · ${row.assignee_name}` : ' · chưa phân công'}
                    {row.due_date ? ` · hạn ${formatDate(row.due_date)}` : ''}
                  </li>
                ))}
              </ul>
              <a className="text-primary underline" href={`/quality/evidence-coverage?framework_id=${framework.id}`}>
                Xem độ phủ của bộ
              </a>
            </>
          ) : null}
        </section>
      ))}
      {data && data.expiring.length > 0 ? (
        <section aria-label="Minh chứng sắp hết hiệu lực" className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-title font-semibold">Minh chứng sắp hết hoặc đã hết hiệu lực</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {data.expiring.map((row) => (
              <li key={row.id} className="text-content">
                {row.title} · đến {formatDate(row.valid_until)}{' '}
                <StatusBadge tone={row.validity === 'expired' ? 'danger' : 'warning'} label={row.validity_label} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Page>
  );
}

// 1.3 Độ phủ theo tiêu chí
export function EvidenceCoveragePage() {
  const grid = useGridSettings('quality-evidence-coverage');
  const choice = useFrameworkChoice();
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [search, setSearch] = useState('');
  const coverage = useQuery({
    queryKey: ['evidence', 'coverage', choice.frameworkId],
    queryFn: () => readEvidenceCoverage(choice.frameworkId),
    enabled: choice.frameworkId !== '',
  });
  const data = coverage.data;
  const needle = search.trim().toLowerCase();
  const rows = (data?.criteria ?? []).filter(
    (row) =>
      (!onlyMissing || !row.covered) && (needle === '' || `${row.code} ${row.title}`.toLowerCase().includes(needle)),
  );
  return (
    <Page path="/quality/evidence-coverage">
      <div className="flex flex-wrap items-end gap-3">
        {choice.select}
        <label className="flex min-h-11 items-center gap-2 text-content">
          <input type="checkbox" checked={onlyMissing} onChange={(event) => setOnlyMissing(event.target.checked)} />
          Chỉ tiêu chí còn thiếu
        </label>
      </div>
      {choice.error || coverage.error ? <Alert tone="danger">{messageOf(choice.error ?? coverage.error)}</Alert> : null}
      {data ? (
        <p className="text-content">
          Đủ minh chứng: {coverageText(data.covered_count, data.criterion_count, data.covered_percent)}. Chu kỳ đánh
          giá: {data.cycle_year_names.join(', ')}.
        </p>
      ) : null}
      <DataGrid
        label="Độ phủ theo tiêu chí"
        columns={COVERAGE_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `${row.code} ${row.title}`}
        loading={choice.frameworkId !== '' && !data && !coverage.error}
        emptyText="Không có tiêu chí nào."
        search={{ label: 'Tìm theo mã, nội dung tiêu chí', value: search, onChange: setSearch }}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

const ASSIGNMENT_COLUMNS: Array<DataGridColumn<EvidenceCoverageRow>> = [
  {
    id: 'code',
    header: 'Tiêu chí',
    alwaysVisible: true,
    className: 'font-medium whitespace-nowrap',
    cell: (row) => row.code,
  },
  { id: 'title', header: 'Nội dung', cell: (row) => row.title },
  { id: 'assignee', header: 'Người phụ trách', cell: (row) => row.assignee?.user_name ?? '' },
  { id: 'due', header: 'Hạn', cell: (row) => formatDate(row.assignee?.due_date ?? null) },
  { id: 'note', header: 'Ghi chú', hiddenByDefault: true, cell: (row) => row.assignee?.note ?? '' },
  { id: 'leader', header: 'Trưởng nhóm công tác', cell: (row) => row.group_leader?.user_name ?? '' },
  {
    id: 'covered',
    header: 'Độ phủ',
    cell: (row) =>
      row.covered ? <StatusBadge tone="success" label="Đủ minh chứng" /> : <StatusBadge tone="danger" label="Thiếu" />,
  },
];

// 3.2 Phân công phụ trách tiêu chí
export function EvidenceAssignmentsPage() {
  const queryClient = useQueryClient();
  const grid = useGridSettings('quality-evidence-assignments');
  const { toast, setToast, close } = useToast();
  const choice = useFrameworkChoice();
  const [selected, setSelected] = useState<EvidenceCoverageRow[] | null>(null);
  const [userId, setUserId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const coverage = useQuery({
    queryKey: ['evidence', 'coverage', choice.frameworkId],
    queryFn: () => readEvidenceCoverage(choice.frameworkId),
    enabled: choice.frameworkId !== '',
  });
  const assignees = useQuery({ queryKey: ['evidence', 'assignees'], queryFn: listEvidenceAssignees });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['evidence'] });
  const assign = useMutation({
    mutationFn: (remove: boolean) =>
      assignEvidenceCriteria({
        framework_id: choice.frameworkId,
        node_ids: (selected ?? []).map((row) => row.id),
        user_id: remove ? null : userId,
        due_date: remove ? null : textOrNull(dueDate),
        note: remove ? null : textOrNull(note),
      }),
    onSuccess: async (result) => {
      setSelected(null);
      await refresh();
      setToast(
        result.removed > 0 ? `Đã bỏ phân công ${result.removed} tiêu chí` : `Đã phân công ${result.assigned} tiêu chí`,
      );
    },
  });
  const fromGroups = useMutation({
    mutationFn: () => assignEvidenceFromGroups(choice.frameworkId),
    onSuccess: async (result) => {
      await refresh();
      setToast(`Đã lấy trưởng nhóm công tác làm người phụ trách cho ${result.assigned} tiêu chí`);
    },
  });
  const error = choice.error ?? coverage.error ?? assignees.error ?? assign.error ?? fromGroups.error;
  return (
    <Page path="/quality/evidence-assignments" toast={toast} onToastClose={close}>
      <div className="flex flex-wrap items-end gap-3">{choice.select}</div>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {selected ? (
        <form
          aria-label="Phân công phụ trách"
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            assign.mutate(false);
          }}
        >
          <p className="text-content">Tiêu chí đã chọn: {selected.map((row) => row.code).join(', ')}</p>
          <FormRow label="Người phụ trách">
            <select className={selectClass} value={userId} required onChange={(event) => setUserId(event.target.value)}>
              <option value="">Chọn cán bộ</option>
              {(assignees.data ?? []).map((row) => (
                <option key={row.user_id} value={row.user_id}>
                  {row.full_name} ({row.code})
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Hạn hoàn thành">
            <input
              type="date"
              className={FORM_CONTROL_CLASS}
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </FormRow>
          <FormRow label="Ghi chú">
            <input
              className={FORM_CONTROL_CLASS}
              value={note}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormRow>
          <span className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={assign.isPending || userId === ''}>
              Ghi phân công
            </Button>
            <Button disabled={assign.isPending} onClick={() => assign.mutate(true)}>
              Bỏ phân công
            </Button>
            <Button variant="text" onClick={() => setSelected(null)}>
              Hủy
            </Button>
          </span>
        </form>
      ) : null}
      <DataGrid
        label="Phân công phụ trách tiêu chí"
        columns={ASSIGNMENT_COLUMNS}
        rows={coverage.data?.criteria ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `${row.code} ${row.title}`}
        loading={choice.frameworkId !== '' && !coverage.data && !coverage.error}
        emptyText="Bộ này chưa có tiêu chí."
        selectable
        selectionActions={(rows) => (
          <Button
            variant="primary"
            onClick={() => {
              setSelected(rows);
              setUserId(rows[0]?.assignee?.user_id ?? rows[0]?.group_leader?.user_id ?? '');
              setDueDate(rows[0]?.assignee?.due_date ?? '');
              setNote(rows[0]?.assignee?.note ?? '');
            }}
          >
            Phân công
          </Button>
        )}
        toolbar={
          choice.frameworkId ? (
            <Button disabled={fromGroups.isPending} onClick={() => fromGroups.mutate()}>
              Lấy trưởng nhóm công tác làm người phụ trách
            </Button>
          ) : null
        }
        rowActions={(row) => (
          <Button
            variant="text"
            onClick={() => {
              setSelected([row]);
              setUserId(row.assignee?.user_id ?? row.group_leader?.user_id ?? '');
              setDueDate(row.assignee?.due_date ?? '');
              setNote(row.assignee?.note ?? '');
            }}
          >
            Phân công
          </Button>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}
