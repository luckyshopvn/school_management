import { useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { DataGridKey } from '@school-management/shared';
import {
  Alert,
  Button,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  type DataGridColumn,
} from '@school-management/ui';
import { useGridSettings } from '../pages/grid-settings.js';
import { ApiError } from '../session/api-client.js';
import type { CatalogField, FieldValues } from './CatalogTable.js';
import type { CatalogStatus } from './catalogs-api.js';

// Danh mục trên lưới dữ liệu dùng chung (DT-15 phần 15f1): như CatalogTable (thêm, sửa, ngừng sử dụng, dùng lại; BR-75)
// nhưng theo mẫu của Sở: Tìm kiếm, Mở rộng tìm kiếm theo trạng thái, cột và số dòng nhớ theo người dùng; Thêm mới và Sửa
// mở biểu mẫu theo khối, nhãn bên trái, nút Ghi. Giao diện chỉ chuyển dữ liệu; máy chủ kiểm tra giá trị và quyền
export interface CatalogGridColumn<Row> {
  id: string;
  header: string;
  cell(row: Row): ReactNode;
  alwaysVisible?: boolean;
}

interface CatalogRow {
  id: string;
  status: CatalogStatus;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function fieldErrorsOf(error: unknown): Record<string, string> {
  return error instanceof ApiError
    ? Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]))
    : {};
}

function CatalogForm({
  title,
  fields,
  initialValues,
  editing,
  onSubmit,
  onCancel,
}: {
  title: string;
  fields: CatalogField[];
  initialValues: FieldValues;
  editing: boolean;
  onSubmit(values: FieldValues): Promise<unknown>;
  onCancel(): void;
}) {
  const [values, setValues] = useState<FieldValues>(initialValues);
  const save = useMutation({ mutationFn: () => onSubmit(values) });
  const errors = fieldErrorsOf(save.error);
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
      <FormBlock title="Thông tin chung">
        {fields
          .filter((field) => !(editing && field.fixedAfterCreate))
          .map((field) => (
            <FormRow key={field.key} label={field.label} error={errors[field.key]}>
              {field.kind === 'select' ? (
                <select
                  className={FORM_CONTROL_CLASS}
                  value={values[field.key] ?? ''}
                  onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={FORM_CONTROL_CLASS}
                  type={field.kind === 'number' ? 'number' : 'text'}
                  value={values[field.key] ?? ''}
                  onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                />
              )}
            </FormRow>
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

export function CatalogGrid<Row extends CatalogRow>({
  title,
  gridKey,
  rows,
  isPending,
  error,
  columns,
  searchText,
  searchLabel = 'Tìm theo mã, tên',
  getRowLabel,
  fields,
  canManage,
  initialValues,
  valuesOf,
  onCreate,
  onUpdate,
  onChanged,
}: {
  // Tên lưới, cũng là nhãn vùng của lưới
  title: string;
  gridKey: DataGridKey;
  rows: Row[] | undefined;
  isPending: boolean;
  error: unknown;
  columns: Array<CatalogGridColumn<Row>>;
  // Chuỗi để tìm của một dòng
  searchText(row: Row): string;
  searchLabel?: string;
  getRowLabel(row: Row): string;
  fields: CatalogField[];
  canManage: boolean;
  initialValues: FieldValues;
  valuesOf(row: Row): FieldValues;
  onCreate(values: FieldValues): Promise<unknown>;
  onUpdate(row: Row, changes: FieldValues | { status: CatalogStatus }): Promise<unknown>;
  onChanged(message: string): void;
}) {
  const grid = useGridSettings(gridKey);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const toggle = useMutation({
    mutationFn: (row: Row) => onUpdate(row, { status: row.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: () => onChanged('Đã cập nhật trạng thái'),
  });
  const keyword = search.trim().toLocaleLowerCase('vi');
  const shown = (rows ?? []).filter(
    (row) =>
      (status === '' || row.status === status) &&
      (keyword === '' || searchText(row).toLocaleLowerCase('vi').includes(keyword)),
  );
  const gridColumns: Array<DataGridColumn<Row>> = [
    ...columns,
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <StatusBadge
          tone={row.status === 'active' ? 'success' : 'neutral'}
          label={row.status === 'active' ? 'Đang dùng' : 'Ngừng sử dụng'}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {creating ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <CatalogForm
            title={`Thêm mới vào ${title.toLocaleLowerCase('vi')}`}
            fields={fields}
            initialValues={initialValues}
            editing={false}
            onCancel={() => setCreating(false)}
            onSubmit={async (values) => {
              await onCreate(values);
              setCreating(false);
              onChanged(`Đã thêm vào ${title.toLocaleLowerCase('vi')}`);
            }}
          />
        </section>
      ) : null}
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {toggle.error ? <Alert tone="danger">{messageOf(toggle.error)}</Alert> : null}
      {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
      <DataGrid
        label={title}
        columns={gridColumns}
        rows={shown}
        getRowId={(row) => row.id}
        getRowLabel={getRowLabel}
        loading={isPending}
        emptyText="Chưa có mục nào."
        search={{ label: searchLabel, value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Trạng thái
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={`mt-1 ${FORM_CONTROL_CLASS}`}
              >
                <option value="">Tất cả</option>
                <option value="active">Đang dùng</option>
                <option value="inactive">Ngừng sử dụng</option>
              </select>
            </label>
          </div>
        }
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
                    aria-label={`Sửa ${getRowLabel(row)}`}
                    onClick={() => {
                      setCreating(false);
                      setEditingId(editingId === row.id ? undefined : row.id);
                    }}
                  >
                    Sửa
                  </Button>
                  <Button variant="text" disabled={toggle.isPending} onClick={() => toggle.mutate(row)}>
                    {row.status === 'active' ? 'Ngừng sử dụng' : 'Dùng lại'}
                  </Button>
                </span>
              )
            : undefined
        }
        activeRowId={editingId}
        renderRowDetail={(row) =>
          editingId === row.id ? (
            <CatalogForm
              key={row.id}
              title={`Sửa ${getRowLabel(row)}`}
              fields={fields}
              initialValues={valuesOf(row)}
              editing
              onCancel={() => setEditingId(undefined)}
              onSubmit={async (values) => {
                await onUpdate(row, values);
                setEditingId(undefined);
                onChanged('Đã lưu');
              }}
            />
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}
