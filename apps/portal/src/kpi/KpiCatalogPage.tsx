import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KPI_SCHOOL_LEVELS, PERMISSION_CODES } from '@school-management/shared';
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
import {
  downloadFile,
  listCatalog,
  listIndicatorProgress,
  listRuleSets,
  messageOf,
  send,
  uploadFile,
  type CatalogItem,
} from './kpi-api.js';
import { filterClass, useRuleConfig } from './KpiCommon.js';

// MH-162 Danh mục công việc chuẩn (DT-18 phần 18d, YCTD-139): danh mục chung của trường và danh mục của từng đơn vị, theo
// bộ quy tắc; chỉ báo theo cấp học, vị trí việc làm và số chỉ báo đã nhập so với số mong đợi; nhập từ Excel theo tệp mẫu
// (có lỗi thì tải tệp kèm cột nội dung lỗi); cán bộ đề xuất thêm việc, người quản lý duyệt
const STATUS_LABELS: Record<CatalogItem['status'], string> = {
  active: 'Đang dùng',
  inactive: 'Ngừng dùng',
  proposed: 'Chờ duyệt',
  rejected: 'Không duyệt',
};

const COLUMNS: Array<DataGridColumn<CatalogItem>> = [
  { id: 'code', header: 'Mã công việc', cell: (row) => row.code },
  {
    id: 'name',
    header: 'Tên công việc',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => `${row.is_required ? '(*) ' : ''}${row.is_confidential ? '(Mật) ' : ''}${row.name}`,
  },
  { id: 'output_result', header: 'Kết quả đầu ra', cell: (row) => row.output_result ?? '' },
  { id: 'axis_code', header: 'Trục', cell: (row) => row.axis_code },
  { id: 'difficulty_code', header: 'Hệ số độ khó', cell: (row) => row.difficulty_code },
  { id: 'deadline_hint', header: 'Thời hạn', hiddenByDefault: true, cell: (row) => row.deadline_hint ?? '' },
  {
    id: 'school_level',
    header: 'Cấp học',
    cell: (row) => KPI_SCHOOL_LEVELS.find((level) => level.value === row.school_level)?.label ?? '',
  },
  { id: 'job_position', header: 'Vị trí việc làm', hiddenByDefault: true, cell: (row) => row.job_position ?? '' },
  { id: 'rule_set_name', header: 'Bộ quy tắc', cell: (row) => row.rule_set_name ?? 'Mọi bộ' },
  { id: 'org_unit_name', header: 'Thuộc danh mục', cell: (row) => row.org_unit_name ?? 'Danh mục chung' },
  { id: 'proposed_by_name', header: 'Người đề xuất', hiddenByDefault: true, cell: (row) => row.proposed_by_name ?? '' },
  { id: 'status', header: 'Trạng thái', cell: (row) => STATUS_LABELS[row.status] },
];

function CatalogForm({
  orgUnitId,
  ruleSetId,
  proposing,
  onSaved,
  onCancel,
}: {
  orgUnitId: string | null;
  ruleSetId: string;
  proposing: boolean;
  onSaved(message: string): void;
  onCancel(): void;
}) {
  const ruleSets = useQuery({ queryKey: ['kpi', 'rule-sets'], queryFn: listRuleSets });
  const versionId = ruleSets.data?.find((set) => set.id === ruleSetId)?.versions.find((item) => item.status === 'published')?.id;
  const config = useRuleConfig(versionId);
  const [values, setValues] = useState<Record<string, string>>({ code: '', name: '', output_result: '', axis_code: '', difficulty_code: '', school_level: '', job_position: '', expected_evidence: '', deadline_hint: '' });
  const [isRequired, setIsRequired] = useState(false);
  const [isConfidential, setIsConfidential] = useState(false);
  const set = (field: string, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const save = useMutation({
    mutationFn: () =>
      send('POST', proposing ? '/api/v1/kpi/catalog/proposals' : '/api/v1/kpi/catalog', {
        org_unit_id: orgUnitId,
        rule_set_id: ruleSetId,
        code: values.code,
        name: values.name,
        output_result: values.output_result || null,
        axis_code: values.axis_code || config?.axes[0]?.code,
        difficulty_code: values.difficulty_code || null,
        school_level: values.school_level || null,
        job_position: values.job_position || null,
        expected_evidence: values.expected_evidence || null,
        deadline_hint: values.deadline_hint || null,
        is_required: isRequired,
        is_confidential: isConfidential,
      }),
    onSuccess: () => onSaved(proposing ? 'Đã gửi đề xuất, chờ người quản lý duyệt' : 'Đã thêm công việc vào danh mục'),
  });
  return (
    <form
      aria-label={proposing ? 'Đề xuất công việc' : 'Thêm công việc'}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title={proposing ? 'Đề xuất công việc vào danh mục của đơn vị' : 'Thêm công việc'}>
        <FormRow label="Mã công việc">
          <input className={FORM_CONTROL_CLASS} value={values.code} onChange={(event) => set('code', event.target.value)} />
        </FormRow>
        <FormRow label="Tên công việc">
          <textarea className={FORM_CONTROL_CLASS} rows={2} value={values.name} onChange={(event) => set('name', event.target.value)} />
        </FormRow>
        <FormRow label="Kết quả đầu ra">
          <input className={FORM_CONTROL_CLASS} value={values.output_result} onChange={(event) => set('output_result', event.target.value)} />
        </FormRow>
        <FormRow label="Trục">
          <select className={FORM_CONTROL_CLASS} value={values.axis_code} onChange={(event) => set('axis_code', event.target.value)}>
            {(config?.axes ?? []).map((axis) => (
              <option key={axis.code} value={axis.code}>
                {axis.code}. {axis.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Hệ số độ khó">
          <select className={FORM_CONTROL_CLASS} value={values.difficulty_code} onChange={(event) => set('difficulty_code', event.target.value)}>
            {(config?.difficulty_levels ?? []).map((level) => (
              <option key={level.code} value={level.code}>
                {level.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Cấp học">
          <select className={FORM_CONTROL_CLASS} value={values.school_level} onChange={(event) => set('school_level', event.target.value)}>
            <option value="">Mọi cấp</option>
            {KPI_SCHOOL_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </FormRow>
        {config?.job_positions.length ? (
          <FormRow label="Vị trí việc làm">
            <select className={FORM_CONTROL_CLASS} value={values.job_position} onChange={(event) => set('job_position', event.target.value)}>
              <option value="">Mọi vị trí</option>
              {config.job_positions.map((position) => (
                <option key={position.code} value={position.code}>
                  {position.label}
                </option>
              ))}
            </select>
          </FormRow>
        ) : null}
        <FormRow label="Minh chứng dự kiến">
          <input className={FORM_CONTROL_CLASS} value={values.expected_evidence} onChange={(event) => set('expected_evidence', event.target.value)} />
        </FormRow>
        <FormRow label="Thời hạn hoàn thành">
          <input className={FORM_CONTROL_CLASS} value={values.deadline_hint} onChange={(event) => set('deadline_hint', event.target.value)} />
        </FormRow>
        <FormRow label="Bắt buộc đăng ký (*)">
          <input type="checkbox" checked={isRequired} onChange={(event) => setIsRequired(event.target.checked)} />
        </FormRow>
        <FormRow label="Nội dung mật">
          <input type="checkbox" checked={isConfidential} onChange={(event) => setIsConfidential(event.target.checked)} />
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

export function KpiCatalogPage() {
  const queryClient = useQueryClient();
  const canConfigure = useHasPermission(PERMISSION_CODES.kpiConfigure);
  const canManage = useHasPermission(PERMISSION_CODES.kpiManage);
  const canParticipate = useHasPermission(PERMISSION_CODES.kpiParticipate);
  const unitChoice = useUnitChoice();
  const ruleSets = useQuery({ queryKey: ['kpi', 'rule-sets'], queryFn: listRuleSets });
  const [scope, setScope] = useState<'common' | 'unit'>('common');
  const [ruleSetId, setRuleSetId] = useState('');
  const [status, setStatus] = useState('');
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<'add' | 'propose'>();
  const [importFile, setImportFile] = useState<File>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const chosenRuleSet = ruleSetId || ruleSets.data?.find((set) => set.is_default)?.id || '';
  const params = new URLSearchParams();
  if (scope === 'common') {
    params.set('common', 'true');
  } else if (unitChoice.selectedId) {
    params.set('org_unit_id', unitChoice.selectedId);
  }
  if (ruleSetId) {
    params.set('rule_set_id', ruleSetId);
  }
  if (status) {
    params.set('status', status);
  }
  if (level) {
    params.set('school_level', level);
  }
  if (search.trim()) {
    params.set('q', search.trim());
  }
  const query = params.toString();
  const items = useQuery({ queryKey: ['kpi', 'catalog', query], queryFn: () => listCatalog(query) });
  const progress = useQuery({ queryKey: ['kpi', 'indicator-progress'], queryFn: listIndicatorProgress });
  const grid = useGridSettings('kpi-catalog');
  const changed = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ['kpi', 'catalog'] });
    void queryClient.invalidateQueries({ queryKey: ['kpi', 'indicator-progress'] });
    setAdding(undefined);
    setToastMessage(message);
  };
  const toggle = useMutation({
    mutationFn: (item: CatalogItem) =>
      send('PATCH', `/api/v1/kpi/catalog/${item.id}`, { status: item.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: () => changed('Đã đổi trạng thái'),
  });
  const decide = useMutation({
    mutationFn: (input: { item: CatalogItem; approve: boolean }) =>
      send('POST', `/api/v1/kpi/catalog/${input.item.id}/decision`, {
        approve: input.approve,
        note: input.approve ? null : window.prompt('Lý do không duyệt') || null,
      }),
    onSuccess: () => changed('Đã xử lý đề xuất'),
  });
  const importRows = useMutation({
    mutationFn: () =>
      uploadFile<{ created?: number; errors?: unknown[]; errorFile?: boolean }>(
        '/api/v1/kpi/catalog/import?error_file=true',
        { org_unit_id: scope === 'unit' ? (unitChoice.selectedId ?? '') : '', rule_set_id: chosenRuleSet },
        importFile!,
      ),
    onSuccess: (result) =>
      result.errorFile
        ? setToastMessage('Tệp có lỗi, đã tải danh sách lỗi; chưa ghi dòng nào')
        : changed(`Đã nhập ${result.created ?? 0} công việc`),
  });
  const template = useMutation({
    mutationFn: () => downloadFile(`/api/v1/kpi/catalog/template?rule_set_id=${chosenRuleSet}`, 'mau-danh-muc-cong-viec.xlsx'),
  });
  const exportFile = useMutation({
    mutationFn: () => downloadFile(`/api/v1/kpi/catalog/export?${query}`, 'danh-muc-cong-viec.xlsx'),
  });
  const canEdit = scope === 'common' ? canConfigure : canConfigure || canManage;
  const error = [items.error, toggle.error, decide.error, importRows.error, template.error, exportFile.error, grid.error].find(Boolean);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/kpi/catalog')}</h1>
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        {progress.data?.length ? (
          <section aria-label="Số chỉ báo đã nhập" className="flex flex-wrap gap-4 rounded-xl border border-border bg-card p-4 text-content">
            {progress.data.map((row) => (
              <span key={`${row.rule_set_name}-${row.school_level}`}>
                {row.rule_set_name}, {KPI_SCHOOL_LEVELS.find((item) => item.value === row.school_level)?.label}: đã nhập{' '}
                {row.entered}/{row.target} chỉ báo
              </span>
            ))}
          </section>
        ) : null}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-label font-medium text-text">
            Danh mục
            <select className={filterClass} value={scope} onChange={(event) => setScope(event.target.value as 'common' | 'unit')}>
              <option value="common">Danh mục chung của trường</option>
              <option value="unit">Danh mục của đơn vị</option>
            </select>
          </label>
          {scope === 'unit' ? (
            <UnitSelect units={unitChoice.units} selectedId={unitChoice.selectedId} onSelect={unitChoice.select} />
          ) : null}
          <label className="text-label font-medium text-text">
            Bộ quy tắc
            <select className={filterClass} value={ruleSetId} onChange={(event) => setRuleSetId(event.target.value)}>
              <option value="">Tất cả</option>
              {(ruleSets.data ?? []).map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {adding ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <CatalogForm
              orgUnitId={scope === 'unit' ? (unitChoice.selectedId ?? null) : null}
              ruleSetId={chosenRuleSet}
              proposing={adding === 'propose'}
              onSaved={changed}
              onCancel={() => setAdding(undefined)}
            />
          </section>
        ) : null}
        {canEdit ? (
          <section className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4" aria-label="Nhập từ Excel">
            <Button onClick={() => template.mutate()}>Tải tệp mẫu</Button>
            <label className="text-label font-medium text-text">
              Tệp Excel
              <input type="file" accept=".xlsx" className={filterClass} onChange={(event) => setImportFile(event.target.files?.[0])} />
            </label>
            <Button disabled={!importFile || importRows.isPending} onClick={() => importRows.mutate()}>
              Nhập từ Excel
            </Button>
          </section>
        ) : null}
        <DataGrid
          label="Danh mục công việc chuẩn"
          columns={COLUMNS}
          rows={items.data ?? []}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `công việc ${row.code}`}
          getRowAriaLabel={(row) => `Công việc ${row.code}`}
          loading={items.isPending}
          emptyText="Danh mục chưa có công việc."
          search={{ label: 'Tìm theo mã, tên công việc', value: search, onChange: setSearch }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Trạng thái
                <select className={filterClass} value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">Tất cả</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Cấp học
                <select className={filterClass} value={level} onChange={(event) => setLevel(event.target.value)}>
                  <option value="">Tất cả</option>
                  {KPI_SCHOOL_LEVELS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
          toolbar={
            <span className="flex gap-2">
              {canEdit ? (
                <Button variant="primary" onClick={() => setAdding('add')}>
                  Thêm mới
                </Button>
              ) : null}
              {canParticipate ? <Button onClick={() => setAdding('propose')}>Đề xuất công việc</Button> : null}
              <Button onClick={() => exportFile.mutate()}>Xuất Excel</Button>
            </span>
          }
          rowActions={(item) =>
            item.status === 'proposed' && (canManage || canConfigure) ? (
              <span className="flex justify-end gap-2">
                <Button onClick={() => decide.mutate({ item, approve: true })}>Duyệt</Button>
                <Button variant="text" onClick={() => decide.mutate({ item, approve: false })}>
                  Không duyệt
                </Button>
              </span>
            ) : (item.status === 'active' || item.status === 'inactive') && (canManage || canConfigure) ? (
              <Button variant="text" onClick={() => toggle.mutate(item)}>
                {item.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
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
