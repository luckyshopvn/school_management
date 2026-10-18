import { useCallback, useEffect, useState } from 'react';
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
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { ArchiveUnitField, useDefaultArchiveUnit } from './ArchiveUnitField.js';
import { fieldErrorsOf, messageOf } from './archive-ui.js';
import {
  createArchiveFond,
  deleteArchiveFond,
  listArchiveFonds,
  updateArchiveFond,
  type ArchiveFond,
} from './archives-api.js';

// 5.10.2. Phông lưu trữ (DT-15 phần 15h2, YCTD-118): danh sách phông của trường với mã, tên, ghi chú, số dòng thông tin
// lưu trữ và số hồ sơ thuộc phông; Thêm mới, Sửa bằng biểu mẫu theo khối với nút Ghi; Xóa qua hộp xác nhận, phông còn dữ
// liệu thì máy chủ từ chối. YCTD-122: phông thuộc một đơn vị hoặc toàn trường, danh sách theo phạm vi đơn vị của người xem
const COLUMNS: Array<DataGridColumn<ArchiveFond>> = [
  { id: 'code', header: 'Mã phông', cell: (row) => row.code },
  { id: 'name', header: 'Tên phông', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'org_unit', header: 'Đơn vị', cell: (row) => row.org_unit_name ?? 'Toàn trường' },
  { id: 'holding_count', header: 'Số dòng thông tin lưu trữ', cell: (row) => row.holding_count },
  { id: 'record_count', header: 'Số hồ sơ', cell: (row) => row.record_count },
  { id: 'note', header: 'Ghi chú', cell: (row) => row.note ?? '' },
];

function FondForm({
  fond,
  onSaved,
  onCancel,
}: {
  fond?: ArchiveFond;
  onSaved(saved: ArchiveFond): void;
  onCancel(): void;
}) {
  const defaultUnit = useDefaultArchiveUnit();
  const [values, setValues] = useState({
    code: fond?.code ?? '',
    name: fond?.name ?? '',
    note: fond?.note ?? '',
    org_unit_id: fond?.org_unit_id ?? '',
  });
  // Đơn vị mặc định có sau khi đọc xong danh sách đơn vị
  useEffect(() => {
    if (!fond && defaultUnit) {
      setValues((current) => (current.org_unit_id ? current : { ...current, org_unit_id: defaultUnit }));
    }
  }, [fond, defaultUnit]);
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: () => {
      const input = {
        code: values.code,
        name: values.name,
        note: values.note || null,
        org_unit_id: values.org_unit_id || null,
      };
      return fond ? updateArchiveFond(fond.id, input) : createArchiveFond(input);
    },
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const title = fond ? `Sửa phông ${fond.name}` : 'Thêm mới phông lưu trữ';
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
      <FormBlock title="Thông tin phông">
        <FormRow label="Mã phông" error={errors.code}>
          <input
            className={FORM_CONTROL_CLASS}
            value={values.code}
            onChange={(event) => set('code', event.target.value)}
          />
        </FormRow>
        <FormRow label="Tên phông" error={errors.name}>
          <input
            className={FORM_CONTROL_CLASS}
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </FormRow>
        <ArchiveUnitField
          value={values.org_unit_id}
          onChange={(value) => set('org_unit_id', value)}
          error={errors.org_unit_id}
        />
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

export function ArchiveFondsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.archiveManage);
  const queryClient = useQueryClient();
  const grid = useGridSettings('archive-fonds');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [deleting, setDeleting] = useState<ArchiveFond>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const fonds = useQuery({ queryKey: ['archive-fonds'], queryFn: listArchiveFonds });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['archive-fonds'] });
  const remove = useMutation({
    mutationFn: (fond: ArchiveFond) => deleteArchiveFond(fond.id),
    onSuccess: async (_result, fond) => {
      setDeleting(undefined);
      await refresh();
      setToastMessage(`Đã xóa phông ${fond.name}`);
    },
    onError: () => setDeleting(undefined),
  });
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (fonds.data ?? []).filter(
    (fond) =>
      keyword === '' ||
      fond.name.toLocaleLowerCase('vi').includes(keyword) ||
      fond.code.toLocaleLowerCase('vi').includes(keyword),
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/archive-fonds')}</h1>
        {creating ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <FondForm
              onCancel={() => setCreating(false)}
              onSaved={(saved) => {
                setCreating(false);
                void refresh();
                setToastMessage(`Đã tạo phông ${saved.name}`);
              }}
            />
          </section>
        ) : null}
        {fonds.isError ? <Alert tone="danger">{messageOf(fonds.error)}</Alert> : null}
        {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <DataGrid
          label="Danh sách phông lưu trữ"
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.name}
          loading={fonds.isPending}
          emptyText="Chưa có phông lưu trữ nào."
          search={{ label: 'Tìm theo mã, tên phông', value: search, onChange: setSearch }}
          toolbar={
            canManage ? (
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
              <FondForm
                key={row.id}
                fond={row}
                onCancel={() => setEditingId(undefined)}
                onSaved={(saved) => {
                  setEditingId(undefined);
                  void refresh();
                  setToastMessage(`Đã ghi phông ${saved.name}`);
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
          subject={`phông ${deleting.name}`}
          busy={remove.isPending}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => remove.mutate(deleting)}
        >
          Phông còn thông tin lưu trữ hoặc hồ sơ thì không xóa được.
        </ConfirmDeleteDialog>
      ) : null}
    </AppShell>
  );
}
