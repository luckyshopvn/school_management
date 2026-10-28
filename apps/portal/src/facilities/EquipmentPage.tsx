import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DEVELOPMENT_AREAS,
  EQUIPMENT_ALL_GROUPS,
  EQUIPMENT_CATALOG_SOURCES,
  EQUIPMENT_GROUPS,
  EQUIPMENT_NORM_BASES,
  EQUIPMENT_TARGET_USERS,
  equipmentGroupsOf,
  PERMISSION_CODES,
  type CodeLabel,
  type DataGridKey,
  type EquipmentSchoolLevel,
} from '@school-management/shared';
import { Alert, Button, DataGrid, StatusBadge, TextField, Toast, type DataGridColumn } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { ExcelImportPanel } from '../imports/ExcelImportPanel.js';
import { AppShell } from '../pages/AppShell.js';
import { matchesSearch } from '../pages/grid-search.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import { useHasPermission } from '../session/permissions.js';
import { UpperLevelSubmissionPanel } from '../submissions/UpperLevelSubmissionPanel.js';
import {
  FACILITY_IMPORTS_API_BASE,
  createEquipmentItem,
  downloadExcel,
  fieldErrorsOf,
  formatNumber,
  listEquipmentItems,
  listHoldings,
  messageOf,
  readEquipmentReport,
  saveHoldings,
  updateEquipmentItem,
  type EquipmentItem,
  type EquipmentReportRow,
} from './facilities-api.js';
import { SelectBox, TabBar } from './facilities-ui.js';

// 2.1 Tổng hợp thiết bị dạy học, 2.2 Thiết bị ngoài danh mục tối thiểu (YCTD-102): tổng hợp định mức, hiện có, thừa,
// thiếu, nhu cầu, tỷ lệ đáp ứng; nhập số hiện có theo đơn vị hoặc lớp; danh mục tối thiểu do Hiệu trưởng chỉnh. Tổng
// hợp, thiết bị ngoài danh mục và danh mục tối thiểu là lưới dữ liệu chung (DT-16 phần 16b): tìm tại chỗ, nhóm tuổi và
// nhóm thiết bị của tổng hợp ở "Mở rộng tìm kiếm"; bảng nhập số hiện có là bảng nhập liệu theo ô nên giữ nguyên. DT-16 phần
// 16i: 2.2 Thiết bị ngoài danh mục tối thiểu thành mục menu riêng, 2.3 Gửi thiết bị dạy học lên cấp trên (mẫu gửi chạy nội
// bộ của 16a), nhập danh mục thiết bị từ Excel ở thẻ Danh mục tối thiểu và ở 2.2
type Tab = 'summary' | 'holdings' | 'catalog';

// Nhập danh mục thiết bị từ Excel bằng công cụ nhập chung (mã đã có thì cập nhật, mã trống là thiết bị mới)
function EquipmentImport({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button variant="secondary" onClick={() => setOpen(!open)}>
          Nhập từ Excel
        </Button>
      </div>
      {open ? (
        <ExcelImportPanel
          type="equipment_items"
          title="Nhập danh mục thiết bị từ Excel"
          apiBase={FACILITY_IMPORTS_API_BASE}
          uploadPath={FACILITY_IMPORTS_API_BASE}
          uploadFields={{ type: 'equipment_items' }}
          onCommitted={async (job) => {
            onSaved(`Đã ghi ${job.assigned_rows ?? 0} thiết bị từ Excel`);
            await queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
            await queryClient.invalidateQueries({ queryKey: ['equipment-report'] });
          }}
        />
      ) : null}
    </div>
  );
}
const labelOf = (values: ReadonlyArray<CodeLabel>, value: string | null) =>
  values.find((item) => item.value === value)?.label ?? '';

// Nhóm tuổi (Mầm non) và khối (cấp phổ thông) của các cấp đang bật, để lọc (YCTD-345)
function useGroupOptions(): CodeLabel[] {
  const { levels } = useEnabledSchoolLevels();
  return levels.flatMap((level) => [...equipmentGroupsOf(level.value)]);
}

// Cấp học đang chọn; cấp đã chọn không còn bật (hoặc danh sách cấp vừa tải xong) thì về cấp đầu tiên đang bật
function useLevelState(): [EquipmentSchoolLevel, (level: EquipmentSchoolLevel) => void] {
  const { levels } = useEnabledSchoolLevels();
  const [level, setLevel] = useState<EquipmentSchoolLevel>('MN');
  const current = levels.some((item) => item.value === level) ? level : (levels[0]?.value ?? 'MN');
  return [current, setLevel];
}

const SUMMARY_COLUMNS: Array<DataGridColumn<EquipmentReportRow>> = [
  {
    id: 'name',
    header: 'Tên thiết bị',
    alwaysVisible: true,
    cell: (row) => (
      <>
        <span className="font-medium">{row.name}</span>
        {row.is_minimum ? null : <span className="text-label text-text-secondary"> (ngoài danh mục)</span>}
      </>
    ),
  },
  { id: 'unit', header: 'Đơn vị tính', cell: (row) => row.unit },
  { id: 'age_group', header: 'Nhóm tuổi, khối', cell: (row) => labelOf(EQUIPMENT_ALL_GROUPS, row.age_group) },
  { id: 'norm', header: 'Định mức', cell: (row) => formatNumber(row.norm) },
  { id: 'available', header: 'Hiện có', cell: (row) => formatNumber(row.available) },
  { id: 'next_year_need', header: 'Nhu cầu bổ sung năm sau', cell: (row) => formatNumber(row.next_year_need) },
  { id: 'surplus', header: 'Thừa', cell: (row) => formatNumber(row.surplus) },
  { id: 'shortage', header: 'Thiếu', cell: (row) => formatNumber(row.shortage) },
  {
    id: 'rate_percent',
    header: 'Tỷ lệ đáp ứng',
    cell: (row) => (row.rate_percent === null ? '' : `${formatNumber(row.rate_percent)}%`),
  },
];

function SummaryTab() {
  const unitChoice = useUnitChoice();
  const grid = useGridSettings('equipment-summary');
  const groupOptions = useGroupOptions();
  const [orgUnitId, setOrgUnitId] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [group, setGroup] = useState('');
  const [classId, setClassId] = useState('');
  const [search, setSearch] = useState('');
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId),
    enabled: orgUnitId !== '',
  });
  const filters = { org_unit_id: orgUnitId, age_group: ageGroup, equipment_group: group, class_id: classId };
  const report = useQuery({ queryKey: ['equipment-report', filters], queryFn: () => readEquipmentReport(filters) });
  // Xuất Excel theo đúng bộ lọc gửi máy chủ như trước, từ khóa tìm tại chỗ không gửi
  const exportFile = useMutation({
    mutationFn: () => downloadExcel('/api/v1/equipment-report/export', filters, 'tong-hop-thiet-bi-day-hoc.xlsx'),
  });
  const rows = (report.data?.rows ?? []).filter((row) => matchesSearch(search, row.name, row.unit));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <SelectBox
          label="Đơn vị"
          value={orgUnitId}
          options={unitChoice.units.map((unit) => ({ value: unit.id, label: unit.name }))}
          emptyLabel="Mọi đơn vị trong phạm vi"
          onChange={(value) => {
            setOrgUnitId(value);
            setClassId('');
          }}
        />
        <SelectBox
          label="Lớp"
          value={classId}
          options={(classes.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
          emptyLabel={orgUnitId ? 'Mọi lớp' : 'Chọn đơn vị để lọc lớp'}
          onChange={setClassId}
        />
      </div>
      {exportFile.error ? <Alert tone="danger">{messageOf(exportFile.error)}</Alert> : null}
      {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
      {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
      {report.data ? (
        <>
          <p className="text-content text-text" aria-label="Tỷ lệ đáp ứng chung">
            Tỷ lệ đáp ứng chung: <strong>{formatNumber(report.data.totals.rate_percent ?? 0)}%</strong> (
            {report.data.totals.met_count}/{report.data.totals.item_count} thiết bị đủ định mức). Danh mục tối thiểu cần
            đối chiếu văn bản hiện hành.
          </p>
          {report.data.unclassified_classes.length > 0 ? (
            <Alert tone="warning">
              Lớp chưa xếp được nhóm tuổi (khối không có trong danh mục bậc học):{' '}
              {report.data.unclassified_classes.join(', ')}
            </Alert>
          ) : null}
        </>
      ) : null}
      <DataGrid
        label="Tổng hợp thiết bị dạy học"
        columns={SUMMARY_COLUMNS}
        rows={rows}
        getRowId={(row) => row.equipment_item_id}
        getRowLabel={(row) => row.name}
        loading={report.isPending}
        emptyText="Không có số liệu."
        search={{ label: 'Tìm theo tên thiết bị', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid gap-3 md:grid-cols-3">
            <SelectBox
              label="Nhóm tuổi, khối"
              value={ageGroup}
              options={groupOptions}
              emptyLabel="Mọi nhóm tuổi, khối"
              onChange={setAgeGroup}
            />
            <SelectBox
              label="Nhóm thiết bị"
              value={group}
              options={EQUIPMENT_GROUPS}
              emptyLabel="Mọi nhóm thiết bị"
              onChange={setGroup}
            />
          </div>
        }
        toolbar={
          <Button variant="secondary" disabled={exportFile.isPending} onClick={() => exportFile.mutate()}>
            Xuất Excel
          </Button>
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

function HoldingsTab({ onSaved }: { onSaved(message: string): void }) {
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId ?? '';
  const groupOptions = useGroupOptions();
  const [target, setTarget] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [values, setValues] = useState<Record<string, { quantity: string; need: string }>>({});
  const queryClient = useQueryClient();
  const items = useQuery({ queryKey: ['equipment-items', 'all'], queryFn: () => listEquipmentItems({}) });
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId),
    enabled: orgUnitId !== '',
  });
  const holdings = useQuery({
    queryKey: ['equipment-holdings', orgUnitId],
    queryFn: () => listHoldings(orgUnitId),
    enabled: orgUnitId !== '',
  });
  useEffect(() => {
    const next: Record<string, { quantity: string; need: string }> = {};
    for (const holding of holdings.data ?? []) {
      if ((holding.class_id ?? '') === target) {
        next[holding.equipment_item_id] = {
          quantity: String(holding.quantity),
          need: holding.next_year_need === null ? '' : String(holding.next_year_need),
        };
      }
    }
    setValues(next);
  }, [holdings.data, target]);
  const visible = (items.data ?? []).filter(
    (item) => item.status === 'active' && (!ageGroup || item.age_group === ageGroup),
  );
  const save = useMutation({
    mutationFn: () =>
      saveHoldings(
        orgUnitId,
        Object.entries(values)
          .filter(([itemId, value]) => value.quantity !== '' && visible.some((item) => item.id === itemId))
          .map(([itemId, value]) => ({
            equipment_item_id: itemId,
            class_id: target || null,
            quantity: Number(value.quantity),
            next_year_need: target || value.need === '' ? null : Number(value.need),
          })),
      ),
    onSuccess: async (result) => {
      onSaved(`Đã ghi số hiện có của ${result.saved} thiết bị`);
      await queryClient.invalidateQueries({ queryKey: ['equipment-holdings', orgUnitId] });
      await queryClient.invalidateQueries({ queryKey: ['equipment-report'] });
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <SelectBox
          label="Đơn vị"
          value={orgUnitId}
          options={unitChoice.units.map((unit) => ({ value: unit.id, label: unit.name }))}
          onChange={(value) => {
            unitChoice.select(value);
            setTarget('');
          }}
        />
        <SelectBox
          label="Nhập cho"
          value={target}
          options={(classes.data ?? []).map((item) => ({ value: item.id, label: `Lớp ${item.name}` }))}
          emptyLabel="Cả đơn vị (kho chung)"
          onChange={setTarget}
        />
        <SelectBox
          label="Nhóm tuổi, khối"
          value={ageGroup}
          options={groupOptions}
          emptyLabel="Mọi nhóm tuổi, khối"
          onChange={setAgeGroup}
        />
        <div className="flex items-end">
          <Button
            variant="primary"
            disabled={save.isPending || !orgUnitId || !holdings.isSuccess || !items.isSuccess}
            onClick={() => save.mutate()}
          >
            Ghi số hiện có
          </Button>
        </div>
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      {/* Chỉ hiện ô nhập khi đã đọc xong số đang lưu, tránh số vừa gõ bị thay bằng số đọc về */}
      {holdings.isSuccess && items.isSuccess ? (
        <section className="overflow-x-auto rounded-xl border border-border bg-card p-4" aria-label="Số lượng hiện có">
          <table className="w-full text-content">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-2">Thiết bị</th>
                <th className="px-3 py-2">Nhóm tuổi, khối</th>
                <th className="px-3 py-2">Hiện có</th>
                {target ? null : <th className="px-3 py-2">Nhu cầu bổ sung năm sau</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const value = values[item.id] ?? { quantity: '', need: '' };
                return (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      {item.name} ({item.unit})
                    </td>
                    <td className="px-3 py-2">{labelOf(EQUIPMENT_ALL_GROUPS, item.age_group)}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        aria-label={`Hiện có ${item.code}`}
                        value={value.quantity}
                        onChange={(event) =>
                          setValues({ ...values, [item.id]: { ...value, quantity: event.target.value } })
                        }
                        className="w-24 rounded-lg border border-border bg-card px-2 py-1"
                      />
                    </td>
                    {target ? null : (
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          aria-label={`Nhu cầu ${item.code}`}
                          value={value.need}
                          onChange={(event) =>
                            setValues({
                              ...values,
                              [item.id]: { quantity: value.quantity || '0', need: event.target.value },
                            })
                          }
                          className="w-24 rounded-lg border border-border bg-card px-2 py-1"
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

const newItem = (level: EquipmentSchoolLevel) => ({
  name: '',
  unit: '',
  equipment_group: 'thiet_bi_do_choi',
  development_area: '',
  age_group: level === 'MN' ? 'mg_5_6' : (equipmentGroupsOf(level)[0]?.value ?? ''),
  quantity: '1',
  norm_basis: 'class',
  target_users: 'tre',
  equipment_type: '',
});

// Ô chọn cấp học theo các cấp đang bật của trường (YCTD-345); trường một cấp vẫn hiện để biết cấp đang nhập
function LevelSelect({
  value,
  onChange,
}: {
  value: EquipmentSchoolLevel;
  onChange(level: EquipmentSchoolLevel): void;
}) {
  const { levels } = useEnabledSchoolLevels();
  return (
    <SelectBox
      label="Cấp học"
      value={value}
      options={levels}
      onChange={(next) => onChange(next as EquipmentSchoolLevel)}
    />
  );
}

// Thêm một thiết bị vào danh mục tối thiểu hoặc ngoài danh mục. Nhóm tuổi chỉ ở Mầm non; cấp phổ thông chọn khối, ghi môn
// học ở ô Loại thiết bị (YCTD-345)
function AddItemForm({
  minimum,
  level,
  onSaved,
}: {
  minimum: boolean;
  level: EquipmentSchoolLevel;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => newItem(level));
  useEffect(() => setDraft(newItem(level)), [level]);
  const create = useMutation({
    mutationFn: () =>
      createEquipmentItem({
        ...draft,
        school_level: level,
        quantity: draft.quantity === '' ? Number.NaN : Number(draft.quantity),
        development_area: level === 'MN' ? draft.development_area || null : null,
        equipment_type: draft.equipment_type || null,
        is_minimum: minimum,
      }),
    onSuccess: async () => {
      setDraft(newItem(level));
      onSaved(minimum ? 'Đã thêm thiết bị vào danh mục tối thiểu' : 'Đã thêm thiết bị ngoài danh mục');
      await queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
      await queryClient.invalidateQueries({ queryKey: ['equipment-minimum'] });
    },
  });
  const errors = fieldErrorsOf(create.error);
  const label = minimum ? 'Thêm thiết bị vào danh mục tối thiểu' : 'Thêm thiết bị ngoài danh mục';
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label={label}>
      <h2 className="text-section-title font-semibold text-text">{label}</h2>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <TextField
          label="Tên thiết bị"
          value={draft.name}
          error={errors.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        <TextField
          label="Đơn vị tính"
          value={draft.unit}
          error={errors.unit}
          onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
        />
        <SelectBox
          label="Nhóm thiết bị"
          value={draft.equipment_group}
          options={EQUIPMENT_GROUPS}
          onChange={(value) => setDraft({ ...draft, equipment_group: value })}
        />
        <TextField
          label={level === 'MN' ? 'Loại thiết bị' : 'Loại thiết bị, môn học'}
          value={draft.equipment_type}
          onChange={(event) => setDraft({ ...draft, equipment_type: event.target.value })}
        />
        <SelectBox
          label={level === 'MN' ? 'Nhóm tuổi' : 'Khối'}
          value={draft.age_group}
          options={equipmentGroupsOf(level)}
          onChange={(value) => setDraft({ ...draft, age_group: value })}
        />
        {level === 'MN' ? (
          <SelectBox
            label="Lĩnh vực phát triển"
            value={draft.development_area}
            options={DEVELOPMENT_AREAS}
            emptyLabel="Không chọn"
            onChange={(value) => setDraft({ ...draft, development_area: value })}
          />
        ) : null}
        <SelectBox
          label="Đối tượng sử dụng"
          value={draft.target_users}
          options={EQUIPMENT_TARGET_USERS}
          onChange={(value) => setDraft({ ...draft, target_users: value })}
        />
        {minimum ? (
          <SelectBox
            label="Tính theo"
            value={draft.norm_basis}
            options={EQUIPMENT_NORM_BASES}
            onChange={(value) => setDraft({ ...draft, norm_basis: value })}
          />
        ) : null}
        <TextField
          label={minimum ? 'Định mức một nhóm, lớp' : 'Số lượng một nhóm áp dụng'}
          type="number"
          value={draft.quantity}
          error={errors.quantity}
          onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
        />
      </div>
      <div>
        <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
          Thêm thiết bị
        </Button>
      </div>
    </section>
  );
}

function OutsideTab({ canManage, onSaved }: { canManage: boolean; onSaved(message: string): void }) {
  const [level, setLevel] = useLevelState();
  const items = useQuery({
    queryKey: ['equipment-items', 'outside'],
    queryFn: () => listEquipmentItems({ is_minimum: 'false' }),
  });
  return (
    <div className="flex flex-col gap-4">
      {canManage ? <EquipmentImport onSaved={onSaved} /> : null}
      {canManage ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <LevelSelect value={level} onChange={setLevel} />
          </div>
          <AddItemForm minimum={false} level={level} onSaved={onSaved} />
        </>
      ) : null}
      {items.error ? <Alert tone="danger">{messageOf(items.error)}</Alert> : null}
      <ItemGrid
        label="Thiết bị ngoài danh mục"
        gridKey="equipment-outside"
        items={items.data ?? []}
        loading={items.isPending}
        canManage={false}
        onSaved={onSaved}
      />
    </div>
  );
}

// Lưới thiết bị của danh mục tối thiểu và thiết bị ngoài danh mục: Hiệu trưởng sửa định mức ngay trong ô Số lượng rồi
// bấm Lưu ở dòng; Ngừng sử dụng, Dùng lại đổi trạng thái như trước (không xóa thiết bị)
function ItemGrid({
  label,
  gridKey,
  items,
  loading,
  canManage,
  onSaved,
}: {
  label: string;
  gridKey: DataGridKey;
  items: EquipmentItem[];
  loading: boolean;
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const grid = useGridSettings(gridKey);
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<{ itemId: string; error: unknown }>();
  const update = useMutation({
    mutationFn: ({ item, changes }: { item: EquipmentItem; changes: Record<string, unknown> }) =>
      updateEquipmentItem(item.id, changes),
    onMutate: () => setFailed(undefined),
    onSuccess: async (_saved, { item }) => {
      onSaved(`Đã cập nhật ${item.name}`);
      await queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
    },
    onError: (error, { item }) => setFailed({ itemId: item.id, error }),
  });
  const quantityOf = (item: EquipmentItem) => quantities[item.id] ?? String(item.quantity);
  const busy = (item: EquipmentItem) => update.isPending && update.variables.item.id === item.id;
  const columns: Array<DataGridColumn<EquipmentItem>> = [
    { id: 'code', header: 'Mã', cell: (item) => item.code },
    {
      id: 'name',
      header: 'Tên thiết bị',
      alwaysVisible: true,
      cell: (item) => (
        <>
          <span className="font-medium">{item.name}</span>
          {failed?.itemId === item.id ? <p className="text-label text-danger">{messageOf(failed.error)}</p> : null}
        </>
      ),
    },
    { id: 'unit', header: 'Đơn vị tính', cell: (item) => item.unit },
    { id: 'age_group', header: 'Nhóm tuổi, khối', cell: (item) => labelOf(EQUIPMENT_ALL_GROUPS, item.age_group) },
    { id: 'equipment_group', header: 'Nhóm thiết bị', cell: (item) => labelOf(EQUIPMENT_GROUPS, item.equipment_group) },
    {
      id: 'quantity',
      header: 'Số lượng',
      cell: (item) =>
        canManage ? (
          <input
            type="number"
            min="0"
            step="0.01"
            aria-label={`Định mức ${item.code}`}
            value={quantityOf(item)}
            onChange={(event) => setQuantities({ ...quantities, [item.id]: event.target.value })}
            className="w-20 rounded-lg border border-border bg-card px-2 py-1"
          />
        ) : (
          formatNumber(item.quantity)
        ),
    },
    { id: 'norm_basis', header: 'Tính theo', cell: (item) => labelOf(EQUIPMENT_NORM_BASES, item.norm_basis) },
    { id: 'note', header: 'Ghi chú', className: 'text-label', cell: (item) => item.note ?? '' },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (item) => (
        <StatusBadge
          tone={item.status === 'active' ? 'success' : 'neutral'}
          label={item.status === 'active' ? 'Đang dùng' : 'Ngừng sử dụng'}
        />
      ),
    },
  ];
  const rows = items.filter((item) => matchesSearch(search, item.code, item.name, item.equipment_type));
  return (
    <>
      {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
      <DataGrid
        label={label}
        columns={columns}
        rows={rows}
        getRowId={(item) => item.id}
        getRowLabel={(item) => item.name}
        loading={loading}
        emptyText="Chưa có thiết bị nào."
        search={{ label: 'Tìm theo mã, tên thiết bị', value: search, onChange: setSearch }}
        rowActions={
          canManage
            ? (item) => (
                <span className="flex flex-wrap justify-end gap-1 whitespace-nowrap">
                  <Button
                    variant="text"
                    disabled={busy(item)}
                    onClick={() => {
                      const quantity = quantityOf(item);
                      update.mutate({ item, changes: { quantity: quantity === '' ? Number.NaN : Number(quantity) } });
                    }}
                  >
                    Lưu
                  </Button>
                  <Button
                    variant="text"
                    disabled={busy(item)}
                    onClick={() =>
                      update.mutate({ item, changes: { status: item.status === 'active' ? 'inactive' : 'active' } })
                    }
                  >
                    {item.status === 'active' ? 'Ngừng sử dụng' : 'Dùng lại'}
                  </Button>
                </span>
              )
            : undefined
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </>
  );
}

// Danh mục tối thiểu theo cấp học (YCTD-345): Mầm non có danh mục mẫu để nạp ở 2.6; Tiểu học, THCS, THPT chưa có danh mục
// chuẩn trong tài liệu dự án nên trường tự nhập (thêm từng thiết bị hoặc nhập từ Excel với cột Nhóm tuổi ghi khối)
function CatalogTab({ canManage, onSaved }: { canManage: boolean; onSaved(message: string): void }) {
  const [level, setLevel] = useLevelState();
  const [ageGroup, setAgeGroup] = useState('');
  const source = EQUIPMENT_CATALOG_SOURCES[level];
  const items = useQuery({
    queryKey: ['equipment-items', 'minimum', level, ageGroup],
    queryFn: () => listEquipmentItems({ is_minimum: 'true', school_level: level, age_group: ageGroup }),
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <LevelSelect
          value={level}
          onChange={(next) => {
            setLevel(next);
            setAgeGroup('');
          }}
        />
        <SelectBox
          label={level === 'MN' ? 'Nhóm tuổi' : 'Khối'}
          value={ageGroup}
          options={equipmentGroupsOf(level)}
          emptyLabel={level === 'MN' ? 'Mọi nhóm tuổi' : 'Mọi khối'}
          onChange={setAgeGroup}
        />
      </div>
      {source.standard ? (
        <Alert tone="warning">
          Danh mục mẫu theo {source.legal_basis}, nạp ở mục 2.6; cần đối chiếu văn bản hiện hành rồi chỉnh định mức.
        </Alert>
      ) : (
        <Alert tone="info">
          Chưa có danh mục chuẩn, trường tự nhập. Tài liệu của dự án chỉ ghi văn bản căn cứ ({source.legal_basis}), chưa
          có nội dung danh mục; nhà trường thêm thiết bị theo khối hoặc nhập từ Excel (cột Nhóm tuổi ghi khối, ví dụ
          &quot;{equipmentGroupsOf(level)[0]?.label}&quot;).
        </Alert>
      )}
      {canManage ? <EquipmentImport onSaved={onSaved} /> : null}
      {canManage ? <AddItemForm minimum level={level} onSaved={onSaved} /> : null}
      {items.error ? <Alert tone="danger">{messageOf(items.error)}</Alert> : null}
      <ItemGrid
        label="Danh mục thiết bị"
        gridKey="equipment-catalog"
        items={items.data ?? []}
        loading={items.isPending}
        canManage={canManage}
        onSaved={onSaved}
      />
    </div>
  );
}

export function EquipmentPage() {
  const canManage = useHasPermission(PERMISSION_CODES.equipmentManage);
  const [tab, setTab] = useState<Tab>('summary');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'summary', label: 'Tổng hợp' },
    ...(canManage ? [{ key: 'holdings' as const, label: 'Nhập số hiện có' }] : []),
    { key: 'catalog', label: 'Danh mục tối thiểu' },
  ];
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/equipment')}</h1>
        <TabBar<Tab> tabs={tabs} current={tab} onSelect={setTab} label="Thiết bị dạy học" />
        {tab === 'summary' ? <SummaryTab /> : null}
        {tab === 'holdings' ? <HoldingsTab onSaved={setToastMessage} /> : null}
        {tab === 'catalog' ? <CatalogTab canManage={canManage} onSaved={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}

// 2.2 Thiết bị ngoài danh mục tối thiểu: mục menu riêng như của Sở (DT-16 phần 16i)
export function EquipmentOutsidePage() {
  const canManage = useHasPermission(PERMISSION_CODES.equipmentManage);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/equipment-outside')}</h1>
        <OutsideTab canManage={canManage} onSaved={setToastMessage} />
      </div>
    </AppShell>
  );
}

// 2.3 Gửi thiết bị dạy học lên cấp trên (DT-16 phần 16i): biểu mẫu tổng hợp thiết bị toàn trường, hoàn thiện dữ liệu,
// "Trường không có dữ liệu", Xuất tệp gửi, Đánh dấu đã gửi, Gửi yêu cầu mở khóa theo mẫu chạy nội bộ của 16a
export function EquipmentSubmissionPage() {
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const report = useQuery({ queryKey: ['equipment-report', 'whole-school'], queryFn: () => readEquipmentReport({}) });
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/equipment-submission')}</h1>
        {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
        {report.data ? (
          <section
            className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4"
            aria-label="Biểu mẫu gửi"
          >
            <h2 className="text-section-title font-semibold text-text">Biểu mẫu: Tổng hợp thiết bị dạy học</h2>
            <p className="text-content text-text">
              {report.data.totals.item_count} thiết bị trong danh mục đang dùng, {report.data.totals.met_count} thiết bị
              đủ định mức; tỷ lệ đáp ứng chung {formatNumber(report.data.totals.rate_percent ?? 0)}%.
            </p>
            <p className="text-label text-text-secondary">
              Tệp gửi gồm tổng hợp theo thiết bị (danh mục tối thiểu và ngoài danh mục) và theo lớp của toàn trường, như
              Xuất Excel ở 2.1. Trường chưa có số liệu thiết bị thì chọn "Trường không có dữ liệu" khi đánh dấu đã gửi.
            </p>
          </section>
        ) : null}
        <UpperLevelSubmissionPanel formCodes={['equipment-summary']} onChanged={setToastMessage} />
      </div>
    </AppShell>
  );
}
