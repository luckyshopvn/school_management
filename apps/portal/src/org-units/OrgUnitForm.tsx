import { useState, type FormEvent } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { UNIT_TYPE_LABELS, type OrgUnitInput, type OrgUnitType } from './org-units-api.js';

// Biểu mẫu tạo đơn vị: Trường chính khi chưa có, sau đó Phân hiệu hoặc Điểm trường (BR-01, QĐ-23)
export function OrgUnitForm({
  allowedTypes,
  submitLabel,
  onSubmit,
}: {
  allowedTypes: OrgUnitType[];
  submitLabel: string;
  onSubmit(input: OrgUnitInput): Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unitType, setUnitType] = useState<OrgUnitType>(allowedTypes[0] ?? 'diem_truong');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setFieldErrors({});
    setSaving(true);
    try {
      await onSubmit({ code, name, unit_type: unitType, address: address || null, phone: phone || null });
      setCode('');
      setName('');
      setAddress('');
      setPhone('');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
        setFieldErrors(Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])));
      } else {
        setErrorMessage('Không kết nối được tới máy chủ, vui lòng thử lại');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {allowedTypes.length > 1 ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="org-unit-type" className="text-label font-medium text-text">
            Loại đơn vị
          </label>
          <select
            id="org-unit-type"
            value={unitType}
            onChange={(event) => setUnitType(event.target.value as OrgUnitType)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-content"
          >
            {allowedTypes.map((type) => (
              <option key={type} value={type}>
                {UNIT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <TextField
        label="Mã đơn vị"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        error={fieldErrors.code}
      />
      <TextField
        label="Tên đơn vị"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={fieldErrors.name}
      />
      <TextField label="Địa chỉ" value={address} onChange={(event) => setAddress(event.target.value)} />
      <TextField label="Số điện thoại" value={phone} onChange={(event) => setPhone(event.target.value)} />
      <div>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Đang lưu…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
