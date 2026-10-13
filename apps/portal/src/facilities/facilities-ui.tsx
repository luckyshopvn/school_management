import { useId } from 'react';
import type { ProfileField } from '@school-management/shared';
import { Button } from '@school-management/ui';

// Thành phần dùng chung của các màn hình cơ sở vật chất, thiết bị dạy học, hồ sơ trường, EMIS (YCTD-102)
export function SelectBox({
  label,
  value,
  options,
  onChange,
  emptyLabel,
  error,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange(value: string): void;
  emptyLabel?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label font-medium text-text">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`rounded-lg border bg-card px-3 py-2 text-content ${error ? 'border-danger' : 'border-border'}`}
      >
        {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-label text-danger">{error}</p> : null}
    </div>
  );
}

export function TabBar<Key extends string>({
  tabs,
  current,
  onSelect,
  label,
}: {
  tabs: ReadonlyArray<{ key: Key; label: string }>;
  current: Key;
  onSelect(key: Key): void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <Button
          key={tab.key}
          role="tab"
          aria-selected={current === tab.key}
          variant={current === tab.key ? 'secondary' : 'text'}
          onClick={() => onSelect(tab.key)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}

// Một ô của biểu mẫu theo danh sách trường cố định (hồ sơ trường, thuộc tính phòng); giá trị gửi lên đúng kiểu
export function ProfileFieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: ProfileField;
  value: unknown;
  error?: string;
  onChange(value: unknown): void;
}) {
  const id = useId();
  if (field.kind === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-content text-text">
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
        {field.label}
        {error ? <span className="text-label text-danger">{error}</span> : null}
      </label>
    );
  }
  if (field.kind === 'choice') {
    return (
      <SelectBox
        label={field.label}
        value={typeof value === 'string' ? value : ''}
        options={field.options ?? []}
        emptyLabel="Chưa chọn"
        error={error}
        onChange={(next) => onChange(next || null)}
      />
    );
  }
  const numeric = field.kind === 'integer' || field.kind === 'number';
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label font-medium text-text">
        {field.label}
      </label>
      <input
        id={id}
        type={numeric ? 'number' : field.kind === 'date' ? 'date' : 'text'}
        step={field.kind === 'number' ? '0.01' : undefined}
        value={value === null || value === undefined ? '' : String(value)}
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === '' ? null : numeric ? Number(raw) : raw);
        }}
        className={`rounded-lg border bg-card px-3 py-2 text-content ${error ? 'border-danger' : 'border-border'}`}
      />
      {error ? <p className="text-label text-danger">{error}</p> : null}
    </div>
  );
}
