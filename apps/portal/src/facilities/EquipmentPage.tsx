import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DEVELOPMENT_AREAS,
  EQUIPMENT_AGE_GROUPS,
  EQUIPMENT_GROUPS,
  EQUIPMENT_NORM_BASES,
  EQUIPMENT_TARGET_USERS,
  PERMISSION_CODES,
  type CodeLabel,
} from '@school-management/shared';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useHasPermission } from '../session/permissions.js';
import {
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
} from './facilities-api.js';
import { SelectBox, TabBar } from './facilities-ui.js';

// 2.1 Tổng hợp thiết bị dạy học, 2.2 Thiết bị ngoài danh mục tối thiểu (YCTD-102): tổng hợp định mức, hiện có, thừa,
// thiếu, nhu cầu, tỷ lệ đáp ứng; nhập số hiện có theo đơn vị hoặc lớp; danh mục tối thiểu do Hiệu trưởng chỉnh
type Tab = 'summary' | 'holdings' | 'outside' | 'catalog';
const labelOf = (values: ReadonlyArray<CodeLabel>, value: string | null) =>
  values.find((item) => item.value === value)?.label ?? '';

function SummaryTab() {
  const unitChoice = useUnitChoice();
  const [orgUnitId, setOrgUnitId] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [group, setGroup] = useState('');
  const [classId, setClassId] = useState('');
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId),
    enabled: orgUnitId !== '',
  });
  const filters = { org_unit_id: orgUnitId, age_group: ageGroup, equipment_group: group, class_id: classId };
  const report = useQuery({ queryKey: ['equipment-report', filters], queryFn: () => readEquipmentReport(filters) });
  const exportFile = useMutation({
    mutationFn: () => downloadExcel('/api/v1/equipment-report/export', filters, 'tong-hop-thiet-bi-day-hoc.xlsx'),
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-5">
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
          label="Nhóm tuổi"
          value={ageGroup}
          options={EQUIPMENT_AGE_GROUPS}
          emptyLabel="Mọi nhóm tuổi"
          onChange={setAgeGroup}
        />
        <SelectBox
          label="Nhóm thiết bị"
          value={group}
          options={EQUIPMENT_GROUPS}
          emptyLabel="Mọi nhóm thiết bị"
          onChange={setGroup}
        />
        <SelectBox
          label="Lớp"
          value={classId}
          options={(classes.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
          emptyLabel={orgUnitId ? 'Mọi lớp' : 'Chọn đơn vị để lọc lớp'}
          onChange={setClassId}
        />
        <div className="flex items-end">
          <Button variant="secondary" disabled={exportFile.isPending} onClick={() => exportFile.mutate()}>
            Xuất Excel
          </Button>
        </div>
      </div>
      {exportFile.error ? <Alert tone="danger">{messageOf(exportFile.error)}</Alert> : null}
      {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
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
          <section
            className="overflow-x-auto rounded-xl border border-border bg-card p-4"
            aria-label="Tổng hợp thiết bị dạy học"
          >
            {report.data.rows.length === 0 ? (
              <p className="text-content text-text-secondary">Không có số liệu.</p>
            ) : (
              <table className="w-full text-content">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Tên thiết bị</th>
                    <th className="px-3 py-2">Đơn vị tính</th>
                    <th className="px-3 py-2">Nhóm tuổi</th>
                    <th className="px-3 py-2">Định mức</th>
                    <th className="px-3 py-2">Hiện có</th>
                    <th className="px-3 py-2">Nhu cầu bổ sung năm sau</th>
                    <th className="px-3 py-2">Thừa</th>
                    <th className="px-3 py-2">Thiếu</th>
                    <th className="px-3 py-2">Tỷ lệ đáp ứng</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.rows.map((row) => (
                    <tr key={row.equipment_item_id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <span className="font-medium">{row.name}</span>
                        {row.is_minimum ? null : (
                          <span className="text-label text-text-secondary"> (ngoài danh mục)</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{row.unit}</td>
                      <td className="px-3 py-2">{labelOf(EQUIPMENT_AGE_GROUPS, row.age_group)}</td>
                      <td className="px-3 py-2">{formatNumber(row.norm)}</td>
                      <td className="px-3 py-2">{formatNumber(row.available)}</td>
                      <td className="px-3 py-2">{formatNumber(row.next_year_need)}</td>
                      <td className="px-3 py-2">{formatNumber(row.surplus)}</td>
                      <td className="px-3 py-2">{formatNumber(row.shortage)}</td>
                      <td className="px-3 py-2">
                        {row.rate_percent === null ? '' : `${formatNumber(row.rate_percent)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function HoldingsTab({ onSaved }: { onSaved(message: string): void }) {
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId ?? '';
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
          label="Nhóm tuổi"
          value={ageGroup}
          options={EQUIPMENT_AGE_GROUPS}
          emptyLabel="Mọi nhóm tuổi"
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
                <th className="px-3 py-2">Nhóm tuổi</th>
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
                    <td className="px-3 py-2">{labelOf(EQUIPMENT_AGE_GROUPS, item.age_group)}</td>
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

const NEW_ITEM = {
  name: '',
  unit: '',
  equipment_group: 'thiet_bi_do_choi',
  development_area: '',
  age_group: 'mg_5_6',
  quantity: '1',
  norm_basis: 'class',
  target_users: 'tre',
  equipment_type: '',
};

function OutsideTab({ canManage, onSaved }: { canManage: boolean; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(NEW_ITEM);
  const items = useQuery({
    queryKey: ['equipment-items', 'outside'],
    queryFn: () => listEquipmentItems({ is_minimum: 'false' }),
  });
  const create = useMutation({
    mutationFn: () =>
      createEquipmentItem({
        ...draft,
        quantity: draft.quantity === '' ? Number.NaN : Number(draft.quantity),
        development_area: draft.development_area || null,
        equipment_type: draft.equipment_type || null,
        is_minimum: false,
      }),
    onSuccess: async () => {
      setDraft(NEW_ITEM);
      onSaved('Đã thêm thiết bị ngoài danh mục');
      await queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
    },
  });
  const errors = fieldErrorsOf(create.error);
  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <section
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          aria-label="Thêm thiết bị ngoài danh mục"
        >
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
              label="Loại thiết bị"
              value={draft.equipment_type}
              onChange={(event) => setDraft({ ...draft, equipment_type: event.target.value })}
            />
            <SelectBox
              label="Nhóm tuổi"
              value={draft.age_group}
              options={EQUIPMENT_AGE_GROUPS}
              onChange={(value) => setDraft({ ...draft, age_group: value })}
            />
            <SelectBox
              label="Lĩnh vực phát triển"
              value={draft.development_area}
              options={DEVELOPMENT_AREAS}
              emptyLabel="Không chọn"
              onChange={(value) => setDraft({ ...draft, development_area: value })}
            />
            <SelectBox
              label="Đối tượng sử dụng"
              value={draft.target_users}
              options={EQUIPMENT_TARGET_USERS}
              onChange={(value) => setDraft({ ...draft, target_users: value })}
            />
            <TextField
              label="Số lượng một nhóm áp dụng"
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
      ) : null}
      {items.error ? <Alert tone="danger">{messageOf(items.error)}</Alert> : null}
      <ItemTable items={items.data ?? []} canManage={false} onSaved={onSaved} />
    </div>
  );
}

function ItemRow({
  item,
  canManage,
  onSaved,
}: {
  item: EquipmentItem;
  canManage: boolean;
  onSaved(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(String(item.quantity));
  const update = useMutation({
    mutationFn: (changes: Record<string, unknown>) => updateEquipmentItem(item.id, changes),
    onSuccess: async () => {
      onSaved(`Đã cập nhật ${item.name}`);
      await queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
    },
  });
  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2">{item.code}</td>
      <td className="px-3 py-2">
        <span className="font-medium">{item.name}</span>
        {update.error ? <p className="text-label text-danger">{messageOf(update.error)}</p> : null}
      </td>
      <td className="px-3 py-2">{item.unit}</td>
      <td className="px-3 py-2">{labelOf(EQUIPMENT_AGE_GROUPS, item.age_group)}</td>
      <td className="px-3 py-2">{labelOf(EQUIPMENT_GROUPS, item.equipment_group)}</td>
      <td className="px-3 py-2">
        {canManage ? (
          <input
            type="number"
            min="0"
            step="0.01"
            aria-label={`Định mức ${item.code}`}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="w-20 rounded-lg border border-border bg-card px-2 py-1"
          />
        ) : (
          formatNumber(item.quantity)
        )}
      </td>
      <td className="px-3 py-2">{labelOf(EQUIPMENT_NORM_BASES, item.norm_basis)}</td>
      <td className="px-3 py-2 text-label">{item.note ?? ''}</td>
      <td className="px-3 py-2">
        <StatusBadge
          tone={item.status === 'active' ? 'success' : 'neutral'}
          label={item.status === 'active' ? 'Đang dùng' : 'Ngừng sử dụng'}
        />
      </td>
      {canManage ? (
        <td className="px-3 py-2 whitespace-nowrap text-right">
          <Button
            variant="text"
            disabled={update.isPending}
            onClick={() => update.mutate({ quantity: quantity === '' ? Number.NaN : Number(quantity) })}
          >
            Lưu
          </Button>
          <Button
            variant="text"
            disabled={update.isPending}
            onClick={() => update.mutate({ status: item.status === 'active' ? 'inactive' : 'active' })}
          >
            {item.status === 'active' ? 'Ngừng sử dụng' : 'Dùng lại'}
          </Button>
        </td>
      ) : null}
    </tr>
  );
}

function ItemTable({
  items,
  canManage,
  onSaved,
}: {
  items: EquipmentItem[];
  canManage: boolean;
  onSaved(message: string): void;
}) {
  if (items.length === 0) {
    return <p className="text-content text-text-secondary">Chưa có thiết bị nào.</p>;
  }
  return (
    <section className="overflow-x-auto rounded-xl border border-border bg-card p-4" aria-label="Danh mục thiết bị">
      <table className="w-full text-content">
        <thead className="text-left text-label font-medium text-text-secondary">
          <tr>
            <th className="px-3 py-2">Mã</th>
            <th className="px-3 py-2">Tên thiết bị</th>
            <th className="px-3 py-2">Đơn vị tính</th>
            <th className="px-3 py-2">Nhóm tuổi</th>
            <th className="px-3 py-2">Nhóm thiết bị</th>
            <th className="px-3 py-2">Số lượng</th>
            <th className="px-3 py-2">Tính theo</th>
            <th className="px-3 py-2">Ghi chú</th>
            <th className="px-3 py-2">Trạng thái</th>
            {canManage ? <th className="px-3 py-2" /> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ItemRow key={item.id} item={item} canManage={canManage} onSaved={onSaved} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CatalogTab({ canManage, onSaved }: { canManage: boolean; onSaved(message: string): void }) {
  const [ageGroup, setAgeGroup] = useState('mg_5_6');
  const items = useQuery({
    queryKey: ['equipment-items', 'minimum', ageGroup],
    queryFn: () => listEquipmentItems({ is_minimum: 'true', age_group: ageGroup }),
  });
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="warning">
        Danh mục gieo sẵn chỉ là tên ngắn và số lượng gợi ý, cần đối chiếu văn bản quy định danh mục thiết bị tối thiểu
        hiện hành rồi chỉnh định mức.
      </Alert>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectBox label="Nhóm tuổi" value={ageGroup} options={EQUIPMENT_AGE_GROUPS} onChange={setAgeGroup} />
      </div>
      {items.error ? <Alert tone="danger">{messageOf(items.error)}</Alert> : null}
      <ItemTable items={items.data ?? []} canManage={canManage} onSaved={onSaved} />
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
    { key: 'outside', label: '2.2 Thiết bị ngoài danh mục tối thiểu' },
    { key: 'catalog', label: 'Danh mục tối thiểu' },
  ];
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">2.1 Tổng hợp thiết bị dạy học</h1>
        <TabBar<Tab> tabs={tabs} current={tab} onSelect={setTab} label="Thiết bị dạy học" />
        {tab === 'summary' ? <SummaryTab /> : null}
        {tab === 'holdings' ? <HoldingsTab onSaved={setToastMessage} /> : null}
        {tab === 'outside' ? <OutsideTab canManage={canManage} onSaved={setToastMessage} /> : null}
        {tab === 'catalog' ? <CatalogTab canManage={canManage} onSaved={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
