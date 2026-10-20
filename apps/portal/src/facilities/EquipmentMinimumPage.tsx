import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EQUIPMENT_AGE_GROUPS, EQUIPMENT_SCHOOL_LEVELS, PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, DataGrid, StatusBadge, Toast, type DataGridColumn, type StatusTone } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { matchesSearch } from '../pages/grid-search.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import {
  downloadFile,
  listTemplates,
  loadTemplate,
  readComparison,
  type ComparisonRow,
} from './equipment-18g-api.js';
import { formatNumber, messageOf } from './facilities-api.js';
import { SelectBox } from './facilities-ui.js';

// 2.6 Đối sánh danh mục tối thiểu (DT-18 phần 18g, YCTD-143): danh mục thiết bị tối thiểu là cấu hình theo cấp học; nạp
// danh mục mẫu (bản Mầm non theo Thông tư 02/2010, sửa đổi bởi Thông tư 34/2013); đối sánh định mức với hiện có của đơn vị,
// báo đủ, thiếu, chưa có. Sửa định mức từng thiết bị ở 2.1, thẻ "Danh mục tối thiểu"
const labelOf = (values: ReadonlyArray<{ value: string; label: string }>, value: string | null) =>
  values.find((item) => item.value === value)?.label ?? '';

const STATUS: Record<ComparisonRow['status'], { label: string; tone: StatusTone }> = {
  enough: { label: 'Đủ', tone: 'success' },
  short: { label: 'Thiếu', tone: 'warning' },
  none: { label: 'Chưa có', tone: 'danger' },
};

const COLUMNS: Array<DataGridColumn<ComparisonRow>> = [
  { id: 'code', header: 'Mã', alwaysVisible: true, cell: (row) => row.code },
  { id: 'name', header: 'Tên thiết bị', alwaysVisible: true, cell: (row) => <span className="font-medium">{row.name}</span> },
  { id: 'unit', header: 'Đơn vị tính', cell: (row) => row.unit },
  { id: 'age_group', header: 'Nhóm tuổi', cell: (row) => labelOf(EQUIPMENT_AGE_GROUPS, row.age_group) },
  { id: 'norm', header: 'Định mức', cell: (row) => formatNumber(row.norm) },
  { id: 'available', header: 'Hiện có', cell: (row) => formatNumber(row.available) },
  { id: 'shortage', header: 'Thiếu', cell: (row) => formatNumber(row.shortage) },
  {
    id: 'status',
    header: 'Kết quả',
    cell: (row) => <StatusBadge tone={STATUS[row.status].tone} label={STATUS[row.status].label} />,
  },
];

function TemplatePanel({ onLoaded }: { onLoaded(message: string): void }) {
  const queryClient = useQueryClient();
  const [retire, setRetire] = useState(true);
  const templates = useQuery({ queryKey: ['equipment-templates'], queryFn: listTemplates });
  const load = useMutation({
    mutationFn: (code: string) => loadTemplate(code, retire),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['equipment-templates'] });
      await queryClient.invalidateQueries({ queryKey: ['equipment-minimum'] });
      onLoaded(
        `Đã nạp ${result.added} thiết bị, ${result.existing} thiết bị đã có giữ nguyên, ngừng dùng ${result.retired} thiết bị gieo sẵn tạm thời`,
      );
    },
  });
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Danh mục mẫu">
      <h2 className="text-section-title font-semibold text-text">Danh mục mẫu theo cấp học</h2>
      {templates.error ? <Alert tone="danger">{messageOf(templates.error)}</Alert> : null}
      {(templates.data ?? []).map((template) => (
        <div key={template.code} className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-content font-medium text-text">
              {labelOf(EQUIPMENT_SCHOOL_LEVELS, template.school_level)}: {template.title}
            </span>
            <span className="text-label text-text-secondary">
              {template.source}; {template.item_count} thiết bị, đã có {template.loaded_count}
            </span>
          </div>
          <Button variant="primary" disabled={load.isPending} onClick={() => load.mutate(template.code)}>
            Nạp danh mục mẫu
          </Button>
        </div>
      ))}
      <label className="flex items-center gap-2 text-content text-text">
        <input type="checkbox" checked={retire} onChange={(event) => setRetire(event.target.checked)} />
        Ngừng dùng thiết bị gieo sẵn tạm thời (mã NT…, MG…) chưa có số hiện có, tài sản gắn
      </label>
      <p className="text-label text-text-secondary">
        Nạp chỉ thêm thiết bị có mã chưa có, không sửa thiết bị đã có. Danh mục chép từ văn bản đăng trên trang văn bản pháp
        luật, cần đối chiếu bản gốc trên Công báo; các cấp học khác thêm mẫu sau.
      </p>
      {load.error ? <Alert tone="danger">{messageOf(load.error)}</Alert> : null}
    </section>
  );
}

export function EquipmentMinimumPage() {
  const canManage = useHasPermission(PERMISSION_CODES.equipmentManage);
  const unitChoice = useUnitChoice();
  const grid = useGridSettings('equipment-minimum');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [level, setLevel] = useState('MN');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const filters = { org_unit_id: orgUnitId, school_level: level, status };
  const comparison = useQuery({ queryKey: ['equipment-minimum', filters], queryFn: () => readComparison(filters) });
  const exportFile = useMutation({
    mutationFn: (format: 'xlsx' | 'pdf') =>
      downloadFile(
        '/api/v1/equipment-minimum/export',
        { ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)), format },
        `doi-sanh-danh-muc-toi-thieu.${format}`,
      ),
  });
  const rows = (comparison.data?.rows ?? []).filter((row) => matchesSearch(search, row.code, row.name));
  const totals = comparison.data?.totals;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/equipment-minimum')}</h1>
        {canManage ? <TemplatePanel onLoaded={setToastMessage} /> : null}
        <div className="grid gap-3 md:grid-cols-3">
          <SelectBox
            label="Đơn vị"
            value={orgUnitId}
            options={unitChoice.units.map((unit) => ({ value: unit.id, label: unit.name }))}
            emptyLabel="Mọi đơn vị trong phạm vi"
            onChange={setOrgUnitId}
          />
          <SelectBox label="Cấp học" value={level} options={EQUIPMENT_SCHOOL_LEVELS} onChange={setLevel} />
          <SelectBox
            label="Kết quả"
            value={status}
            options={Object.entries(STATUS).map(([value, item]) => ({ value, label: item.label }))}
            emptyLabel="Mọi kết quả"
            onChange={setStatus}
          />
        </div>
        {comparison.error ? <Alert tone="danger">{messageOf(comparison.error)}</Alert> : null}
        {exportFile.error ? <Alert tone="danger">{messageOf(exportFile.error)}</Alert> : null}
        {comparison.data && totals ? (
          <>
            <p className="text-content text-text" aria-label="Kết quả đối sánh">
              Đủ <strong>{totals.enough}</strong>, thiếu <strong>{totals.short}</strong>, chưa có{' '}
              <strong>{totals.none}</strong> trên {totals.item_count} thiết bị áp dụng (
              {formatNumber(totals.rate_percent ?? 0)}% đủ). Danh mục có {comparison.data.catalog_count} thiết bị,{' '}
              {comparison.data.not_applicable_count} thiết bị không áp dụng vì nhóm tuổi không có lớp.
            </p>
            {comparison.data.catalog_count === 0 ? (
              <Alert tone="info">Cấp học này chưa có danh mục tối thiểu. Nạp danh mục mẫu hoặc thêm ở 2.1.</Alert>
            ) : null}
            {comparison.data.unclassified_classes.length > 0 ? (
              <Alert tone="warning">
                Lớp chưa xếp được nhóm tuổi (khối không có trong danh mục bậc học):{' '}
                {comparison.data.unclassified_classes.join(', ')}
              </Alert>
            ) : null}
          </>
        ) : null}
        <DataGrid
          label="Đối sánh danh mục tối thiểu"
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => row.equipment_item_id}
          getRowLabel={(row) => row.name}
          loading={comparison.isPending}
          emptyText="Không có thiết bị nào áp dụng."
          search={{ label: 'Tìm theo mã, tên thiết bị', value: search, onChange: setSearch }}
          toolbar={
            <div className="flex gap-2">
              <Button variant="secondary" disabled={exportFile.isPending} onClick={() => exportFile.mutate('xlsx')}>
                Xuất Excel
              </Button>
              <Button variant="secondary" disabled={exportFile.isPending} onClick={() => exportFile.mutate('pdf')}>
                Xuất PDF
              </Button>
            </div>
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
    </AppShell>
  );
}
