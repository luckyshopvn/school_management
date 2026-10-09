import { useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, StatusBadge, TextField } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import type { CatalogStatus } from './catalogs-api.js';

// Bảng danh mục dùng chung cho các màn hình MH-33, MH-34, MH-49, MH-50: thêm, sửa tại chỗ, ngừng sử dụng, dùng lại (BR-75).
// Giao diện chỉ chuyển dữ liệu; máy chủ kiểm tra giá trị và quyền
export interface CatalogField {
  key: string;
  label: string;
  kind?: 'text' | 'number' | 'select';
  options?: Array<{ value: string; label: string }>;
  // Trường không sửa được sau khi tạo, ví dụ mã bậc học
  fixedAfterCreate?: boolean;
}

export interface CatalogColumn<Row> {
  label: string;
  render(row: Row): ReactNode;
}

interface CatalogRow {
  id: string;
  status: CatalogStatus;
}

export type FieldValues = Record<string, string>;

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function fieldErrorsOf(error: unknown): Record<string, string> {
  return error instanceof ApiError
    ? Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]))
    : {};
}

function FieldInputs({
  fields,
  values,
  errors,
  onChange,
  editing,
}: {
  fields: CatalogField[];
  values: FieldValues;
  errors: Record<string, string>;
  onChange(values: FieldValues): void;
  editing: boolean;
}) {
  return (
    <>
      {fields
        .filter((field) => !(editing && field.fixedAfterCreate))
        .map((field) =>
          field.kind === 'select' ? (
            <div key={field.key} className="flex flex-col gap-2">
              <label className="text-label font-medium text-text">
                {field.label}
                <select
                  value={values[field.key] ?? ''}
                  onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
                  className="mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {errors[field.key] ? <p className="text-label text-danger">{errors[field.key]}</p> : null}
            </div>
          ) : (
            <TextField
              key={field.key}
              label={field.label}
              type={field.kind === 'number' ? 'number' : 'text'}
              value={values[field.key] ?? ''}
              error={errors[field.key]}
              onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
            />
          ),
        )}
    </>
  );
}

function CatalogTableRow<Row extends CatalogRow>({
  row,
  columns,
  fields,
  canManage,
  valuesOf,
  onUpdate,
  onChanged,
}: {
  row: Row;
  columns: CatalogColumn<Row>[];
  fields: CatalogField[];
  canManage: boolean;
  valuesOf(row: Row): FieldValues;
  onUpdate(row: Row, changes: FieldValues | { status: CatalogStatus }): Promise<unknown>;
  onChanged(message: string): void;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<FieldValues>({});
  const update = useMutation({
    mutationFn: (changes: FieldValues | { status: CatalogStatus }) => onUpdate(row, changes),
    onSuccess: (_result, changes) => {
      setEditing(false);
      onChanged('status' in changes ? 'Đã cập nhật trạng thái' : 'Đã lưu');
    },
  });

  return (
    <>
      <tr className="border-t border-border align-top">
        {columns.map((column) => (
          <td key={column.label} className="px-3 py-2">
            {column.render(row)}
          </td>
        ))}
        <td className="px-3 py-2">
          <StatusBadge
            tone={row.status === 'active' ? 'success' : 'neutral'}
            label={row.status === 'active' ? 'Đang dùng' : 'Ngừng sử dụng'}
          />
        </td>
        {canManage ? (
          <td className="px-3 py-2 text-right whitespace-nowrap">
            <Button
              variant="text"
              onClick={() => {
                setValues(valuesOf(row));
                setEditing(true);
              }}
            >
              Sửa
            </Button>
            <Button
              variant="text"
              disabled={update.isPending}
              onClick={() => update.mutate({ status: row.status === 'active' ? 'inactive' : 'active' })}
            >
              {row.status === 'active' ? 'Ngừng sử dụng' : 'Dùng lại'}
            </Button>
          </td>
        ) : null}
      </tr>
      {update.error && !editing ? (
        <tr>
          <td colSpan={columns.length + 2} className="px-3 pb-2">
            <Alert tone="danger">{messageOf(update.error)}</Alert>
          </td>
        </tr>
      ) : null}
      {editing ? (
        <tr>
          <td colSpan={columns.length + 2} className="px-3 pb-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              {update.error ? (
                <div className="md:col-span-4">
                  <Alert tone="danger">{messageOf(update.error)}</Alert>
                </div>
              ) : null}
              <FieldInputs
                fields={fields}
                values={values}
                errors={fieldErrorsOf(update.error)}
                onChange={setValues}
                editing
              />
              <div className="flex items-end gap-2">
                <Button disabled={update.isPending} onClick={() => update.mutate(values)}>
                  Lưu
                </Button>
                <Button variant="text" onClick={() => setEditing(false)}>
                  Hủy
                </Button>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function CatalogTable<Row extends CatalogRow>({
  title,
  rows,
  isPending,
  error,
  columns,
  fields,
  canManage,
  initialValues,
  valuesOf,
  onCreate,
  onUpdate,
  onChanged,
}: {
  title: string;
  rows: Row[] | undefined;
  isPending: boolean;
  error: unknown;
  columns: CatalogColumn<Row>[];
  fields: CatalogField[];
  canManage: boolean;
  initialValues: FieldValues;
  valuesOf(row: Row): FieldValues;
  onCreate(values: FieldValues): Promise<unknown>;
  onUpdate(row: Row, changes: FieldValues | { status: CatalogStatus }): Promise<unknown>;
  onChanged(message: string): void;
}) {
  const [values, setValues] = useState<FieldValues>(initialValues);
  const create = useMutation({
    mutationFn: () => onCreate(values),
    onSuccess: () => {
      setValues(initialValues);
      onChanged(`Đã thêm vào ${title.toLowerCase()}`);
    },
  });

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4" aria-label={title}>
      {canManage ? (
        <div className="flex flex-col gap-3">
          {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <FieldInputs
              fields={fields}
              values={values}
              errors={fieldErrorsOf(create.error)}
              onChange={setValues}
              editing={false}
            />
            <div className="flex items-end">
              <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
                Thêm
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {isPending ? <div className="h-32 animate-pulse rounded bg-border" aria-hidden="true" /> : null}
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {rows && rows.length === 0 ? <p className="text-content text-text-secondary">Chưa có mục nào.</p> : null}
      {rows && rows.length > 0 ? (
        <table className="w-full text-content">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              {columns.map((column) => (
                <th key={column.label} className="px-3 py-2">
                  {column.label}
                </th>
              ))}
              <th className="px-3 py-2">Trạng thái</th>
              {canManage ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <CatalogTableRow
                key={row.id}
                row={row}
                columns={columns}
                fields={fields}
                canManage={canManage}
                valuesOf={valuesOf}
                onUpdate={onUpdate}
                onChanged={onChanged}
              />
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
