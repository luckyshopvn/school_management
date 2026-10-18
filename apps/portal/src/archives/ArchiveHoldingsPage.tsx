import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { fieldErrorsOf, formatNumber, messageOf, numberOrText, selectClass, useArchiveUnits } from './archive-ui.js';
import {
  createArchiveHolding,
  deleteArchiveHolding,
  listArchiveFonds,
  listArchiveHoldings,
  periodText,
  retentionText,
  updateArchiveHolding,
  type ArchiveFond,
  type ArchiveHolding,
  type ArchiveRetention,
} from './archives-api.js';

// 5.10.3. Thông tin lưu trữ (DT-15 phần 15h2, YCTD-118): mỗi dòng là tài liệu của một phông trong một giai đoạn, cùng tình
// trạng chỉnh lý, còn hay hết giá trị, thời hạn bảo quản, số bó, số hộp, số mét giá và nơi bảo quản theo mục 5.10 của Sở;
// Báo cáo lưu trữ cộng các dòng này. Thêm mới, Sửa bằng biểu mẫu theo khối với nút Ghi, Xóa qua hộp xác nhận
function columnsOf(unitName: (orgUnitId: string | null) => string): Array<DataGridColumn<ArchiveHolding>> {
  return [
    { id: 'fond', header: 'Phông', alwaysVisible: true, className: 'font-medium', cell: (row) => row.fond_name },
    { id: 'org_unit', header: 'Đơn vị', cell: (row) => unitName(row.org_unit_id) },
    { id: 'period', header: 'Giai đoạn', cell: (row) => periodText(row.period_from_year, row.period_to_year) },
    {
      id: 'arranged',
      header: 'Chỉnh lý',
      cell: (row) =>
        row.arranged ? (
          <StatusBadge tone="success" label="Đã chỉnh lý" />
        ) : (
          <StatusBadge tone="warning" label="Chưa chỉnh lý" />
        ),
    },
    {
      id: 'expired',
      header: 'Giá trị',
      cell: (row) =>
        row.expired ? (
          <StatusBadge tone="danger" label="Hết giá trị" />
        ) : (
          <StatusBadge tone="neutral" label="Còn giá trị" />
        ),
    },
    { id: 'retention', header: 'Thời hạn bảo quản', cell: (row) => retentionText(row.retention, row.retention_years) },
    { id: 'bundle_count', header: 'Số bó', cell: (row) => formatNumber(row.bundle_count) },
    { id: 'box_count', header: 'Số hộp', cell: (row) => formatNumber(row.box_count) },
    { id: 'shelf_meters', header: 'Số mét giá', cell: (row) => formatNumber(row.shelf_meters) },
    { id: 'storage_location', header: 'Nơi bảo quản', cell: (row) => row.storage_location },
    { id: 'note', header: 'Ghi chú', hiddenByDefault: true, cell: (row) => row.note ?? '' },
  ];
}

const text = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value));

function HoldingForm({
  holding,
  fonds,
  onSaved,
  onCancel,
}: {
  holding?: ArchiveHolding;
  fonds: ArchiveFond[];
  onSaved(saved: ArchiveHolding): void;
  onCancel(): void;
}) {
  const [values, setValues] = useState({
    fond_id: holding?.fond_id ?? '',
    period_from_year: text(holding?.period_from_year),
    period_to_year: text(holding?.period_to_year),
    arranged: holding ? (holding.arranged ? 'yes' : 'no') : '',
    expired: holding?.expired ?? false,
    retention: (holding?.retention ?? 'permanent') as ArchiveRetention,
    retention_years: text(holding?.retention_years),
    bundle_count: text(holding?.bundle_count),
    box_count: text(holding?.box_count),
    shelf_meters: text(holding?.shelf_meters),
    storage_location: holding?.storage_location ?? '',
    note: holding?.note ?? '',
  });
  const set = <Key extends keyof typeof values>(key: Key, value: (typeof values)[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: () => {
      const input = {
        fond_id: values.fond_id,
        period_from_year: numberOrText(values.period_from_year),
        period_to_year: numberOrText(values.period_to_year),
        arranged: values.arranged === 'yes' ? true : values.arranged === 'no' ? false : null,
        expired: values.retention === 'limited' && values.expired,
        retention: values.retention,
        retention_years: values.retention === 'limited' ? numberOrText(values.retention_years) : null,
        bundle_count: numberOrText(values.bundle_count),
        box_count: numberOrText(values.box_count),
        shelf_meters: numberOrText(values.shelf_meters),
        storage_location: values.storage_location,
        note: values.note || null,
      };
      return holding ? updateArchiveHolding(holding.id, input) : createArchiveHolding(input);
    },
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const title = holding ? `Sửa thông tin lưu trữ ${holding.fond_name}` : 'Thêm mới thông tin lưu trữ';
  const numberField = (
    key: 'period_from_year' | 'period_to_year' | 'retention_years' | 'bundle_count' | 'box_count' | 'shelf_meters',
    label: string,
  ) => (
    <FormRow label={label} error={errors[key]}>
      <input
        className={FORM_CONTROL_CLASS}
        inputMode={key === 'shelf_meters' ? 'decimal' : 'numeric'}
        value={values[key]}
        onChange={(event) => set(key, event.target.value)}
      />
    </FormRow>
  );
  return (
    <form
      noValidate
      aria-label={title}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-section-title font-semibold text-text">{title}</h2>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Phông và giai đoạn">
        <FormRow label="Phông lưu trữ" error={errors.fond_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.fond_id}
            onChange={(event) => set('fond_id', event.target.value)}
          >
            <option value="">-- Chọn phông --</option>
            {fonds.map((fond) => (
              <option key={fond.id} value={fond.id}>
                {fond.code} - {fond.name}
              </option>
            ))}
          </select>
        </FormRow>
        {numberField('period_from_year', 'Từ năm')}
        {numberField('period_to_year', 'Đến năm')}
      </FormBlock>
      <FormBlock title="Tình trạng tài liệu">
        <FormRow label="Chỉnh lý" error={errors.arranged}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.arranged}
            onChange={(event) => set('arranged', event.target.value)}
          >
            <option value="">-- Chọn --</option>
            <option value="yes">Đã chỉnh lý</option>
            <option value="no">Chưa chỉnh lý</option>
          </select>
        </FormRow>
        <FormRow label="Thời hạn bảo quản" error={errors.retention}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.retention}
            onChange={(event) => set('retention', event.target.value as ArchiveRetention)}
          >
            <option value="permanent">Vĩnh viễn</option>
            <option value="limited">Có thời hạn</option>
          </select>
        </FormRow>
        {values.retention === 'limited' ? (
          <>
            {numberField('retention_years', 'Số năm bảo quản')}
            <FormRow label="Hết giá trị" error={errors.expired}>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={values.expired}
                onChange={(event) => set('expired', event.target.checked)}
              />
            </FormRow>
          </>
        ) : null}
      </FormBlock>
      <FormBlock title="Số lượng và nơi bảo quản">
        {numberField('bundle_count', 'Số bó')}
        {numberField('box_count', 'Số hộp')}
        {numberField('shelf_meters', 'Số mét giá')}
        <FormRow label="Nơi bảo quản" error={errors.storage_location}>
          <input
            className={FORM_CONTROL_CLASS}
            value={values.storage_location}
            onChange={(event) => set('storage_location', event.target.value)}
          />
        </FormRow>
        <FormRow label="Ghi chú" error={errors.note}>
          <textarea
            className={FORM_CONTROL_CLASS}
            rows={2}
            value={values.note}
            onChange={(event) => set('note', event.target.value)}
          />
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

export function ArchiveHoldingsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.archiveManage);
  const queryClient = useQueryClient();
  const grid = useGridSettings('archive-holdings');
  const [search, setSearch] = useState('');
  const [fondId, setFondId] = useState('');
  const [arranged, setArranged] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [deleting, setDeleting] = useState<ArchiveHolding>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const fonds = useQuery({ queryKey: ['archive-fonds'], queryFn: listArchiveFonds });
  const holdings = useQuery({ queryKey: ['archive-holdings', fondId], queryFn: () => listArchiveHoldings(fondId) });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['archive-holdings'] }),
      queryClient.invalidateQueries({ queryKey: ['archive-fonds'] }),
    ]);
  const remove = useMutation({
    mutationFn: (holding: ArchiveHolding) => deleteArchiveHolding(holding.id),
    onSuccess: async () => {
      setDeleting(undefined);
      await refresh();
      setToastMessage('Đã xóa thông tin lưu trữ');
    },
    onError: () => setDeleting(undefined),
  });
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (holdings.data ?? []).filter(
    (holding) =>
      (arranged === '' || String(holding.arranged) === arranged) &&
      (keyword === '' ||
        holding.fond_name.toLocaleLowerCase('vi').includes(keyword) ||
        holding.storage_location.toLocaleLowerCase('vi').includes(keyword)),
  );
  const fondList = fonds.data ?? [];
  const units = useArchiveUnits(PERMISSION_CODES.archiveView);

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/archive-holdings')}</h1>
        {fonds.data && fondList.length === 0 ? (
          <Alert tone="warning">Chưa có phông lưu trữ. Hãy thêm phông ở mục 5.10.2. Phông lưu trữ trước.</Alert>
        ) : null}
        {creating ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <HoldingForm
              fonds={fondList}
              onCancel={() => setCreating(false)}
              onSaved={() => {
                setCreating(false);
                void refresh();
                setToastMessage('Đã thêm thông tin lưu trữ');
              }}
            />
          </section>
        ) : null}
        {holdings.isError ? <Alert tone="danger">{messageOf(holdings.error)}</Alert> : null}
        {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <DataGrid
          label="Danh sách thông tin lưu trữ"
          columns={columnsOf(units.nameOf)}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `${row.fond_name} ${periodText(row.period_from_year, row.period_to_year)}`}
          loading={holdings.isPending}
          emptyText="Chưa có thông tin lưu trữ nào."
          search={{ label: 'Tìm theo phông, nơi bảo quản', value: search, onChange: setSearch }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Phông lưu trữ
                <select value={fondId} onChange={(event) => setFondId(event.target.value)} className={selectClass}>
                  <option value="">Tất cả</option>
                  {fondList.map((fond) => (
                    <option key={fond.id} value={fond.id}>
                      {fond.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Chỉnh lý
                <select value={arranged} onChange={(event) => setArranged(event.target.value)} className={selectClass}>
                  <option value="">Tất cả</option>
                  <option value="true">Đã chỉnh lý</option>
                  <option value="false">Chưa chỉnh lý</option>
                </select>
              </label>
            </div>
          }
          toolbar={
            canManage && fondList.length > 0 ? (
              <Button
                variant="primary"
                onClick={() => {
                  setCreating(true);
                  setEditingId(undefined);
                }}
              >
                Thêm mới
              </Button>
            ) : null
          }
          rowActions={
            canManage
              ? (row) => (
                  <span className="flex flex-wrap justify-end gap-1">
                    <Button
                      variant="text"
                      onClick={() => {
                        setCreating(false);
                        setEditingId(editingId === row.id ? undefined : row.id);
                      }}
                    >
                      Sửa
                    </Button>
                    <Button variant="text" onClick={() => setDeleting(row)}>
                      Xóa
                    </Button>
                  </span>
                )
              : undefined
          }
          activeRowId={editingId}
          renderRowDetail={(row) =>
            editingId === row.id ? (
              <HoldingForm
                key={row.id}
                holding={row}
                fonds={fondList}
                onCancel={() => setEditingId(undefined)}
                onSaved={() => {
                  setEditingId(undefined);
                  void refresh();
                  setToastMessage('Đã ghi thông tin lưu trữ');
                }}
              />
            ) : null
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
      {deleting ? (
        <ConfirmDeleteDialog
          open
          subject={`thông tin lưu trữ ${deleting.fond_name} giai đoạn ${periodText(deleting.period_from_year, deleting.period_to_year)}`}
          busy={remove.isPending}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => remove.mutate(deleting)}
        />
      ) : null}
    </AppShell>
  );
}
