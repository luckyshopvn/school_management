import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KPI_PERIOD_TYPE_LABELS,
  KPI_SCHOOL_LEVELS,
  KPI_SCORING_MODE_LABELS,
  type KpiRuleConfig,
} from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDialog,
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
import {
  downloadFile,
  listPeriods,
  listProfiles,
  listRuleSets,
  messageOf,
  readRuleVersion,
  send,
  uploadFile,
  vietnamToday,
  type Period,
  type Profile,
  type RuleSet,
} from './kpi-api.js';
import { filterClass, SUBJECT_GROUP_LABELS } from './KpiCommon.js';

// MH-158 Kỳ đánh giá, MH-159 Bộ quy tắc chấm, MH-160 Đối tượng đánh giá, MH-161 Nhập dữ liệu từ hệ thống KPI cũ (DT-18 phần
// 18d, YCTD-139): người cấu hình lập kỳ và lịch kỳ, khóa và mở lại kỳ; xem cấu hình của từng phiên bản quy tắc, lập phiên bản
// mới, sửa bản nháp (cấu hình dạng JSON được kiểm tra ở máy chủ), ban hành; gán đối tượng đánh giá cho nhân sự; nhập tệp sao
// lưu của hệ thống KPI cũ (xem trước rồi mới ghi)
const PERIOD_COLUMNS: Array<DataGridColumn<Period>> = [
  { id: 'code', header: 'Mã kỳ', cell: (row) => row.code },
  { id: 'name', header: 'Tên kỳ', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'period_type', header: 'Loại kỳ', cell: (row) => KPI_PERIOD_TYPE_LABELS[row.period_type] ?? row.period_type },
  { id: 'dates', header: 'Thời gian', cell: (row) => `${row.start_date} – ${row.end_date}` },
  {
    id: 'register',
    header: 'Đăng ký, thực hiện',
    cell: (row) => (row.register_from ? `${row.register_from} – ${row.register_to ?? ''}` : ''),
  },
  { id: 'self', header: 'Tự đánh giá', cell: (row) => (row.self_from ? `${row.self_from} – ${row.self_to ?? ''}` : '') },
  {
    id: 'review',
    header: 'Cấp trên đánh giá',
    hiddenByDefault: true,
    cell: (row) => (row.review_from ? `${row.review_from} – ${row.review_to ?? ''}` : ''),
  },
  {
    id: 'advisory',
    header: 'Tham mưu',
    hiddenByDefault: true,
    cell: (row) => (row.advisory_from ? `${row.advisory_from} – ${row.advisory_to ?? ''}` : ''),
  },
  {
    id: 'rule_versions',
    header: 'Bộ quy tắc áp dụng',
    cell: (row) => row.rule_versions.map((item) => `${item.rule_set_name} (phiên bản ${item.version_no})`).join('; '),
  },
  { id: 'status', header: 'Trạng thái', cell: (row) => (row.status === 'open' ? 'Đang mở' : 'Đã khóa') },
];

const PHASES = [
  ['register_from', 'register_to', 'Đăng ký và thực hiện'],
  ['self_from', 'self_to', 'Cá nhân tự đánh giá'],
  ['review_from', 'review_to', 'Cấp trên đánh giá'],
  ['advisory_from', 'advisory_to', 'Tham mưu tổng hợp'],
] as const;

function PeriodForm({ period, onSaved, onCancel }: { period?: Period; onSaved(message: string): void; onCancel(): void }) {
  const today = vietnamToday();
  const [values, setValues] = useState<Record<string, string>>({
    code: period?.code ?? '',
    name: period?.name ?? '',
    period_type: period?.period_type ?? 'quarter',
    start_date: period?.start_date ?? today,
    end_date: period?.end_date ?? today,
    ...Object.fromEntries(PHASES.flatMap(([from, to]) => [[from, period?.[from] ?? ''], [to, period?.[to] ?? '']])),
  });
  const set = (field: string, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { ...values };
      for (const [from, to] of PHASES) {
        body[from] = values[from] || null;
        body[to] = values[to] || null;
      }
      if (period) {
        delete body.code;
        return send('PATCH', `/api/v1/kpi/periods/${period.id}`, body);
      }
      return send('POST', '/api/v1/kpi/periods', body);
    },
    onSuccess: () => onSaved(period ? 'Đã sửa kỳ đánh giá' : 'Đã thêm kỳ đánh giá'),
  });
  return (
    <form
      aria-label={period ? 'Sửa kỳ đánh giá' : 'Thêm kỳ đánh giá'}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin kỳ">
        <FormRow label="Mã kỳ">
          <input className={FORM_CONTROL_CLASS} value={values.code} disabled={Boolean(period)} onChange={(event) => set('code', event.target.value)} />
        </FormRow>
        <FormRow label="Tên kỳ">
          <input className={FORM_CONTROL_CLASS} value={values.name} onChange={(event) => set('name', event.target.value)} />
        </FormRow>
        <FormRow label="Loại kỳ">
          <select className={FORM_CONTROL_CLASS} value={values.period_type} onChange={(event) => set('period_type', event.target.value)}>
            {Object.entries(KPI_PERIOD_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Từ ngày">
          <input type="date" className={FORM_CONTROL_CLASS} value={values.start_date} onChange={(event) => set('start_date', event.target.value)} />
        </FormRow>
        <FormRow label="Đến ngày">
          <input type="date" className={FORM_CONTROL_CLASS} value={values.end_date} onChange={(event) => set('end_date', event.target.value)} />
        </FormRow>
      </FormBlock>
      <FormBlock title="Lịch kỳ">
        {PHASES.map(([from, to, label]) => (
          <div key={from} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormRow label={`${label} từ ngày`}>
              <input type="date" className={FORM_CONTROL_CLASS} value={values[from]} onChange={(event) => set(from, event.target.value)} />
            </FormRow>
            <FormRow label={`${label} đến ngày`}>
              <input type="date" className={FORM_CONTROL_CLASS} value={values[to]} onChange={(event) => set(to, event.target.value)} />
            </FormRow>
          </div>
        ))}
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

export function KpiPeriodsPage() {
  const queryClient = useQueryClient();
  const periods = useQuery({ queryKey: ['kpi', 'periods'], queryFn: listPeriods });
  const ruleSets = useQuery({ queryKey: ['kpi', 'rule-sets'], queryFn: listRuleSets });
  const grid = useGridSettings('kpi-periods');
  const [editing, setEditing] = useState<Period | 'new'>();
  const [locking, setLocking] = useState<Period>();
  const [reopening, setReopening] = useState<Period>();
  const [note, setNote] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const [search, setSearch] = useState('');
  const changed = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ['kpi'] });
    setEditing(undefined);
    setLocking(undefined);
    setReopening(undefined);
    setNote('');
    setToastMessage(message);
  };
  const lock = useMutation({
    mutationFn: (period: Period) => send('POST', `/api/v1/kpi/periods/${period.id}/lock`, { note: note || null }),
    onSuccess: () => changed('Đã khóa kỳ, chốt mức xếp loại'),
  });
  const reopen = useMutation({
    mutationFn: (period: Period) => send('POST', `/api/v1/kpi/periods/${period.id}/reopen`, { note }),
    onSuccess: () => changed('Đã mở lại kỳ'),
  });
  const setVersion = useMutation({
    mutationFn: (input: { period: Period; ruleSetId: string; versionId: string }) =>
      send('PUT', `/api/v1/kpi/periods/${input.period.id}/rule-versions`, {
        rule_set_id: input.ruleSetId,
        rule_set_version_id: input.versionId,
      }),
    onSuccess: () => changed('Đã đổi phiên bản quy tắc của kỳ'),
  });
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (periods.data ?? []).filter(
    (period) => !keyword || `${period.code} ${period.name}`.toLocaleLowerCase('vi').includes(keyword),
  );
  const error = [periods.error, lock.error, reopen.error, setVersion.error, grid.error].find(Boolean);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/kpi/periods')}</h1>
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        {editing ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <PeriodForm
              key={editing === 'new' ? 'new' : editing.id}
              period={editing === 'new' ? undefined : editing}
              onSaved={changed}
              onCancel={() => setEditing(undefined)}
            />
          </section>
        ) : null}
        <DataGrid
          label="Kỳ đánh giá"
          columns={PERIOD_COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `kỳ ${row.name}`}
          getRowAriaLabel={(row) => `Kỳ ${row.code}`}
          loading={periods.isPending}
          emptyText="Chưa có kỳ đánh giá."
          search={{ label: 'Tìm theo mã, tên kỳ', value: search, onChange: setSearch }}
          toolbar={
            <Button variant="primary" onClick={() => setEditing('new')}>
              Thêm mới
            </Button>
          }
          rowActions={(period) => (
            <span className="flex flex-wrap justify-end gap-2">
              {period.status === 'open' ? (
                <>
                  <Button variant="text" onClick={() => setEditing(period)}>
                    Sửa
                  </Button>
                  <Button onClick={() => setLocking(period)}>Khóa kỳ</Button>
                </>
              ) : (
                <Button onClick={() => setReopening(period)}>Mở lại kỳ</Button>
              )}
            </span>
          )}
          renderRowDetail={(period) =>
            period.status === 'open' ? (
              <div className="flex flex-wrap gap-3">
                {(ruleSets.data ?? []).map((set) => {
                  const current = period.rule_versions.find((item) => item.rule_set_id === set.id);
                  return (
                    <label key={set.id} className="text-label font-medium text-text">
                      Phiên bản {set.name}
                      <select
                        className={filterClass}
                        value={current?.rule_set_version_id ?? ''}
                        onChange={(event) =>
                          setVersion.mutate({ period, ruleSetId: set.id, versionId: event.target.value })
                        }
                      >
                        <option value="">Không áp dụng</option>
                        {set.versions
                          .filter((version) => version.status === 'published')
                          .map((version) => (
                            <option key={version.id} value={version.id}>
                              Phiên bản {version.version_no}
                            </option>
                          ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            ) : period.lock_note ? (
              <span className="text-label text-text-secondary">
                Khóa bởi {period.locked_by_name ?? ''}: {period.lock_note}
              </span>
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
      <ConfirmDialog
        open={Boolean(locking)}
        title="Khóa kỳ đánh giá"
        confirmLabel="Khóa kỳ"
        busy={lock.isPending}
        onConfirm={() => locking && lock.mutate(locking)}
        onCancel={() => setLocking(undefined)}
      >
        <p className="text-content">
          Khóa kỳ chốt mức xếp loại cuối cùng của từng người (theo biểu quyết, tham mưu, cấp trên) và giữ phiên bản quy tắc đã
          dùng; sau khi khóa không ai sửa được việc, điểm của kỳ.
        </p>
        <label className="mt-2 block text-label font-medium text-text">
          Ghi chú
          <input className={filterClass} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(reopening)}
        title="Mở lại kỳ đánh giá"
        confirmLabel="Mở lại"
        busy={reopen.isPending}
        onConfirm={() => reopening && reopen.mutate(reopening)}
        onCancel={() => setReopening(undefined)}
      >
        <label className="block text-label font-medium text-text">
          Lý do mở lại
          <input className={filterClass} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      </ConfirmDialog>
    </AppShell>
  );
}

// Tóm tắt cấu hình của phiên bản quy tắc: tham số chấm điểm dạng bảng để người dùng đọc
function ConfigSummary({ config }: { config: KpiRuleConfig }) {
  const list = (items: string[]) => (
    <ul className="list-disc pl-5 text-content">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-label="Tóm tắt cấu hình">
      <div>
        <h3 className="font-semibold">Cách chấm</h3>
        {list([
          KPI_SCORING_MODE_LABELS[config.scoring_mode],
          `Tiêu chí chung ${config.general.max} điểm; kết quả nhiệm vụ ${config.task_part.max} điểm; tổng tối đa ${config.total_max}`,
          ...(config.scoring_mode === 'progress_quality'
            ? [`Trọng số: tiến độ ${config.weights.progress}%, kết quả ${config.weights.quality}%`]
            : []),
          `Điểm thưởng ${config.bonus.rate_percent}% mỗi việc, tối đa ${config.bonus.max_total} điểm`,
        ])}
      </div>
      <div>
        <h3 className="font-semibold">Hạn và giới hạn</h3>
        {list([
          `Duyệt, xác nhận việc trong ${config.deadlines.approval_days} ngày, quá hạn tự vào danh mục`,
          `Cấp trên chấm trong ${config.deadlines.grading_days} ngày, quá hạn lấy kết quả tự đánh giá`,
          `Chuyển trả việc tối đa ${config.deadlines.max_returns} lần`,
          `Xuất sắc không quá ${config.excellent_quota.percent}%`,
        ])}
      </div>
      <div>
        <h3 className="font-semibold">Mức xếp loại</h3>
        {list(config.ranks.map((rank) => `${rank.label}: từ ${rank.min_score} điểm`))}
      </div>
      <div>
        <h3 className="font-semibold">{config.scoring_mode === 'progress_quality' ? 'Mức tiến độ và kết quả' : 'Thang mức'}</h3>
        {config.scoring_mode === 'progress_quality'
          ? list([
              ...config.progress_levels.map((level) => `Tiến độ ${level.percent}%: ${level.label}`),
              ...config.quality_levels.map((level) => `Kết quả ${level.percent}%: ${level.label}`),
            ])
          : list(config.result_levels.map((level) => `${level.label}: ${level.percent / 100}`))}
      </div>
      <div>
        <h3 className="font-semibold">Trục, mảng công việc</h3>
        {list(config.axes.map((axis) => `${axis.code}. ${axis.name}`))}
      </div>
      <div>
        <h3 className="font-semibold">Hệ số độ khó</h3>
        {list(config.difficulty_levels.map((level) => level.label))}
      </div>
    </div>
  );
}

function RuleSetDetail({ ruleSet, onChanged }: { ruleSet: RuleSet; onChanged(message: string): void }) {
  const [versionId, setVersionId] = useState(ruleSet.versions[0]?.id ?? '');
  const version = useQuery({
    queryKey: ['kpi', 'rule-version', versionId],
    queryFn: () => readRuleVersion(versionId),
    enabled: Boolean(versionId),
  });
  const [draft, setDraft] = useState<string>();
  const [level, setLevel] = useState('');
  const createVersion = useMutation({
    mutationFn: () => send<{ id: string }>('POST', `/api/v1/kpi/rule-sets/${ruleSet.id}/versions`, { note: null }),
    onSuccess: (created) => {
      setVersionId(created.id);
      onChanged('Đã lập bản nháp phiên bản mới');
    },
  });
  const save = useMutation({
    mutationFn: () => send('PATCH', `/api/v1/kpi/rule-versions/${versionId}`, { config: JSON.parse(draft ?? '{}') }),
    onSuccess: () => {
      setDraft(undefined);
      onChanged('Đã ghi cấu hình bản nháp');
    },
  });
  const publish = useMutation({
    mutationFn: () => send('POST', `/api/v1/kpi/rule-versions/${versionId}/publish`),
    onSuccess: () => onChanged('Đã ban hành phiên bản'),
  });
  const regulation = useMutation({
    mutationFn: () =>
      downloadFile(
        `/api/v1/kpi/reports/regulation?rule_set_version_id=${versionId}${level ? `&school_level=${level}` : ''}`,
        'quy-che.docx',
      ),
  });
  const error = [version.error, createVersion.error, save.error, publish.error, regulation.error].find(Boolean);
  const isDraft = version.data?.status === 'draft';
  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{error instanceof SyntaxError ? 'Cấu hình không đúng dạng JSON' : messageOf(error)}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-label font-medium text-text">
          Phiên bản
          <select className={filterClass} value={versionId} onChange={(event) => setVersionId(event.target.value)}>
            {ruleSet.versions.map((item) => (
              <option key={item.id} value={item.id}>
                Phiên bản {item.version_no} ({item.status === 'draft' ? 'bản nháp' : 'đã ban hành'})
              </option>
            ))}
          </select>
        </label>
        {ruleSet.versions.some((item) => item.status === 'draft') ? null : (
          <Button onClick={() => createVersion.mutate()} disabled={createVersion.isPending}>
            Lập phiên bản mới
          </Button>
        )}
        {isDraft ? (
          <>
            <Button onClick={() => setDraft(JSON.stringify(version.data?.config, null, 2))}>Sửa cấu hình</Button>
            <Button variant="primary" onClick={() => publish.mutate()} disabled={publish.isPending}>
              Ban hành
            </Button>
          </>
        ) : null}
        <label className="text-label font-medium text-text">
          Cấp học của quy chế
          <select className={filterClass} value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="">Mọi cấp</option>
            {KPI_SCHOOL_LEVELS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => regulation.mutate()} disabled={!versionId || regulation.isPending}>
          Tải mẫu quy chế (Word)
        </Button>
      </div>
      {draft !== undefined ? (
        <form
          className="flex flex-col gap-2"
          aria-label="Sửa cấu hình bản nháp"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label className="text-label font-medium text-text">
            Cấu hình (JSON)
            <textarea
              className={`${filterClass} font-mono`}
              rows={24}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={save.isPending}>
              Ghi
            </Button>
            <Button variant="text" onClick={() => setDraft(undefined)}>
              Hủy
            </Button>
          </div>
        </form>
      ) : version.data ? (
        <ConfigSummary config={version.data.config} />
      ) : null}
    </div>
  );
}

const RULE_SET_COLUMNS: Array<DataGridColumn<RuleSet>> = [
  { id: 'code', header: 'Mã', cell: (row) => row.code },
  { id: 'name', header: 'Tên bộ quy tắc', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'description', header: 'Mô tả', cell: (row) => row.description ?? '' },
  { id: 'is_default', header: 'Mặc định', cell: (row) => (row.is_default ? 'Có' : '') },
  {
    id: 'versions',
    header: 'Phiên bản mới nhất',
    cell: (row) => {
      const latest = row.versions[0];
      return latest ? `${latest.version_no} (${latest.status === 'draft' ? 'bản nháp' : 'đã ban hành'})` : '';
    },
  },
  { id: 'status', header: 'Trạng thái', cell: (row) => (row.status === 'active' ? 'Đang dùng' : 'Ngừng dùng') },
];

export function KpiRuleSetsPage() {
  const queryClient = useQueryClient();
  const ruleSets = useQuery({ queryKey: ['kpi', 'rule-sets'], queryFn: listRuleSets });
  const grid = useGridSettings('kpi-rule-sets');
  const [openId, setOpenId] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const [search, setSearch] = useState('');
  const keyword = search.trim().toLocaleLowerCase('vi');
  const changed = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ['kpi'] });
    setToastMessage(message);
  };
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/kpi/rule-sets')}</h1>
        {ruleSets.error ? <Alert tone="danger">{messageOf(ruleSets.error)}</Alert> : null}
        <DataGrid
          label="Bộ quy tắc chấm"
          columns={RULE_SET_COLUMNS}
          rows={(ruleSets.data ?? []).filter((row) => !keyword || `${row.code} ${row.name}`.toLocaleLowerCase('vi').includes(keyword))}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `bộ quy tắc ${row.name}`}
          getRowAriaLabel={(row) => `Bộ quy tắc ${row.code}`}
          loading={ruleSets.isPending}
          search={{ label: 'Tìm theo mã, tên bộ quy tắc', value: search, onChange: setSearch }}
          rowActions={(row) => (
            <Button variant="text" onClick={() => setOpenId(openId === row.id ? undefined : row.id)}>
              {openId === row.id ? 'Ẩn' : 'Cấu hình'}
            </Button>
          )}
          activeRowId={openId}
          renderRowDetail={(row) => (openId === row.id ? <RuleSetDetail ruleSet={row} onChanged={changed} /> : null)}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}

const PROFILE_COLUMNS: Array<DataGridColumn<Profile>> = [
  { id: 'staff_code', header: 'Mã nhân sự', cell: (row) => row.staff_code },
  { id: 'full_name', header: 'Họ và tên', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'job_title_name', header: 'Chức danh', cell: (row) => row.job_title_name ?? '' },
  { id: 'rule_set_name', header: 'Bộ quy tắc', cell: (row) => row.rule_set_name ?? 'Chưa gán' },
  { id: 'subject_group', header: 'Nhóm đối tượng', cell: (row) => (row.subject_group ? SUBJECT_GROUP_LABELS[row.subject_group] : '') },
  {
    id: 'school_level',
    header: 'Cấp học',
    cell: (row) => KPI_SCHOOL_LEVELS.find((level) => level.value === row.school_level)?.label ?? '',
  },
  { id: 'job_position', header: 'Vị trí việc làm', cell: (row) => row.job_position ?? '' },
  { id: 'superior_name', header: 'Cấp trên trực tiếp', cell: (row) => row.superior_name ?? '' },
  { id: 'is_head', header: 'Người đứng đầu', hiddenByDefault: true, cell: (row) => (row.is_head ? 'Có' : '') },
  { id: 'excluded', header: 'Không đánh giá', hiddenByDefault: true, cell: (row) => (row.excluded ? 'Có' : '') },
];

function ProfileForm({
  selected,
  ruleSets,
  people,
  onSaved,
  onCancel,
}: {
  selected: Profile[];
  ruleSets: RuleSet[];
  people: Profile[];
  onSaved(message: string): void;
  onCancel(): void;
}) {
  const first = selected[0];
  const [ruleSetId, setRuleSetId] = useState(first?.rule_set_id ?? ruleSets.find((set) => set.is_default)?.id ?? '');
  const [subjectGroup, setSubjectGroup] = useState(first?.subject_group ?? 'staff');
  const [schoolLevel, setSchoolLevel] = useState(first?.school_level ?? '');
  const [jobPosition, setJobPosition] = useState(first?.job_position ?? '');
  const [superior, setSuperior] = useState(first?.superior_staff_id ?? '');
  const [isHead, setIsHead] = useState(Boolean(first?.is_head));
  const [excluded, setExcluded] = useState(Boolean(first?.excluded));
  const ruleSet = ruleSets.find((set) => set.id === ruleSetId);
  const version = useQuery({
    queryKey: ['kpi', 'rule-version', ruleSet?.versions.find((item) => item.status === 'published')?.id],
    queryFn: () => readRuleVersion(ruleSet!.versions.find((item) => item.status === 'published')!.id),
    enabled: Boolean(ruleSet?.versions.some((item) => item.status === 'published')),
  });
  const positions = (version.data?.config.job_positions ?? []).filter(
    (position) => !schoolLevel || position.levels.includes(schoolLevel as never),
  );
  const save = useMutation({
    mutationFn: () =>
      send('PUT', '/api/v1/kpi/profiles', {
        staff_ids: selected.map((row) => row.staff_id),
        rule_set_id: ruleSetId,
        subject_group: subjectGroup,
        school_level: schoolLevel || null,
        job_position: jobPosition || null,
        superior_staff_id: superior || null,
        is_head: isHead,
        excluded,
      }),
    onSuccess: () => onSaved(`Đã ghi đối tượng đánh giá cho ${selected.length} người`),
  });
  return (
    <form
      aria-label="Gán đối tượng đánh giá"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title={`Gán đối tượng đánh giá (${selected.map((row) => row.full_name).join(', ')})`}>
        <FormRow label="Bộ quy tắc">
          <select className={FORM_CONTROL_CLASS} value={ruleSetId} onChange={(event) => setRuleSetId(event.target.value)}>
            {ruleSets
              .filter((set) => set.status === 'active')
              .map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
          </select>
        </FormRow>
        <FormRow label="Nhóm đối tượng">
          <select className={FORM_CONTROL_CLASS} value={subjectGroup} onChange={(event) => setSubjectGroup(event.target.value as 'leader' | 'staff')}>
            {(version.data?.config.subject_groups ?? []).map((group) => (
              <option key={group.code} value={group.code}>
                {group.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Cấp học">
          <select className={FORM_CONTROL_CLASS} value={schoolLevel} onChange={(event) => setSchoolLevel(event.target.value)}>
            <option value="">Không chọn</option>
            {KPI_SCHOOL_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Vị trí việc làm">
          <select className={FORM_CONTROL_CLASS} value={jobPosition} onChange={(event) => setJobPosition(event.target.value)}>
            <option value="">Không chọn</option>
            {positions.map((position) => (
              <option key={position.code} value={position.code}>
                {position.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Cấp trên trực tiếp">
          <select className={FORM_CONTROL_CLASS} value={superior} onChange={(event) => setSuperior(event.target.value)}>
            <option value="">Người quản lý đơn vị</option>
            {people
              .filter((person) => !selected.some((row) => row.staff_id === person.staff_id))
              .map((person) => (
                <option key={person.staff_id} value={person.staff_id}>
                  {person.full_name}
                </option>
              ))}
          </select>
        </FormRow>
        <FormRow label="Người đứng đầu">
          <input type="checkbox" checked={isHead} onChange={(event) => setIsHead(event.target.checked)} />
        </FormRow>
        <FormRow label="Không đánh giá KPI">
          <input type="checkbox" checked={excluded} onChange={(event) => setExcluded(event.target.checked)} />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending || !ruleSetId}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

export function KpiProfilesPage() {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const [search, setSearch] = useState('');
  const profiles = useQuery({
    queryKey: ['kpi', 'profiles', unitChoice.selectedId],
    queryFn: () => listProfiles(unitChoice.selectedId!, ''),
    enabled: Boolean(unitChoice.selectedId),
  });
  const ruleSets = useQuery({ queryKey: ['kpi', 'rule-sets'], queryFn: listRuleSets });
  const grid = useGridSettings('kpi-profiles');
  const [selected, setSelected] = useState<Profile[]>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (profiles.data ?? []).filter(
    (row) => !keyword || `${row.staff_code} ${row.full_name}`.toLocaleLowerCase('vi').includes(keyword),
  );
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/kpi/profiles')}</h1>
        {profiles.error ? <Alert tone="danger">{messageOf(profiles.error)}</Alert> : null}
        <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
        {selected ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <ProfileForm
              selected={selected}
              ruleSets={ruleSets.data ?? []}
              people={profiles.data ?? []}
              onCancel={() => setSelected(undefined)}
              onSaved={(message) => {
                setSelected(undefined);
                void queryClient.invalidateQueries({ queryKey: ['kpi', 'profiles'] });
                setToastMessage(message);
              }}
            />
          </section>
        ) : null}
        <DataGrid
          label="Đối tượng đánh giá"
          columns={PROFILE_COLUMNS}
          rows={rows}
          getRowId={(row) => row.staff_id}
          getRowLabel={(row) => row.full_name}
          getRowAriaLabel={(row) => `Nhân sự ${row.full_name}`}
          loading={profiles.isPending}
          emptyText="Đơn vị chưa có nhân sự đang làm việc."
          search={{ label: 'Tìm theo mã, họ tên', value: search, onChange: setSearch }}
          selectable
          toolbar={(chosen) => (
            <Button variant="primary" disabled={chosen.length === 0} onClick={() => setSelected(chosen)}>
              Gán cho người đã chọn
            </Button>
          )}
          rowActions={(row) => (
            <Button variant="text" onClick={() => setSelected([row])}>
              Gán
            </Button>
          )}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}

interface LegacyResult {
  preview: boolean;
  periods: number;
  catalog_items: number;
  tasks: number;
  evaluations: number;
  profiles: number;
  unmatched_people: string[];
  skipped_tasks: number;
}

export function KpiLegacyImportPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File>();
  const [result, setResult] = useState<LegacyResult>();
  const run = useMutation({
    mutationFn: (preview: boolean) =>
      uploadFile<LegacyResult>('/api/v1/kpi/legacy-import', { preview: String(preview) }, file!),
    onSuccess: (data) => {
      setResult(data);
      if (!data.preview) {
        void queryClient.invalidateQueries({ queryKey: ['kpi'] });
      }
    },
  });
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/kpi/legacy-import')}</h1>
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <p className="text-content">
            Chọn tệp sao lưu (tệp .db) tải từ hệ thống KPI cũ. Hệ thống chuyển kỳ, danh mục công việc chuẩn, việc của từng người
            và kết quả đánh giá sang Bộ quy tắc 1; người được ghép theo họ tên với hồ sơ nhân sự. Bấm Xem trước để kiểm tra số
            lượng, rồi bấm Chuyển dữ liệu để ghi. Chạy lại không nhân đôi dữ liệu.
          </p>
          {run.error ? <Alert tone="danger">{messageOf(run.error)}</Alert> : null}
          <label className="text-label font-medium text-text">
            Tệp sao lưu
            <input
              type="file"
              accept=".db,.sqlite"
              className={filterClass}
              onChange={(event) => {
                setFile(event.target.files?.[0]);
                setResult(undefined);
              }}
            />
          </label>
          <div className="flex gap-2">
            <Button disabled={!file || run.isPending} onClick={() => run.mutate(true)}>
              Xem trước
            </Button>
            <Button variant="primary" disabled={!file || !result?.preview || run.isPending} onClick={() => run.mutate(false)}>
              Chuyển dữ liệu
            </Button>
          </div>
          {result ? (
            <div aria-label="Kết quả chuyển dữ liệu" className="flex flex-col gap-1 text-content">
              <strong>{result.preview ? 'Xem trước (chưa ghi)' : 'Đã chuyển dữ liệu'}</strong>
              <span>Kỳ: {result.periods}</span>
              <span>Công việc trong danh mục: {result.catalog_items}</span>
              <span>Việc của từng người: {result.tasks}</span>
              <span>Phiếu đánh giá: {result.evaluations}</span>
              <span>Đối tượng đánh giá mới: {result.profiles}</span>
              <span>Việc bỏ qua (không ghép được người hoặc kỳ): {result.skipped_tasks}</span>
              {result.unmatched_people.length ? (
                <span>Người không ghép được: {result.unmatched_people.join(', ')}</span>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
