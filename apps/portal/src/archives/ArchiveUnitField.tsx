import { PERMISSION_CODES } from '@school-management/shared';
import { FORM_CONTROL_CLASS, FormRow } from '@school-management/ui';
import { useArchiveUnits } from './archive-ui.js';

// Ô "Đơn vị" của biểu mẫu phông, hồ sơ (YCTD-119): trống là toàn trường, chỉ người có quyền quản lý văn thư toàn trường
// chọn được; người chỉ quản lý một số đơn vị chọn trong các đơn vị đó
export function ArchiveUnitField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange(value: string): void;
  error?: string;
}) {
  const { units, wholeSchool } = useArchiveUnits(PERMISSION_CODES.archiveManage);
  return (
    <FormRow label="Đơn vị" error={error}>
      <select className={FORM_CONTROL_CLASS} value={value} onChange={(event) => onChange(event.target.value)}>
        {wholeSchool ? <option value="">Toàn trường</option> : <option value="">-- Chọn đơn vị --</option>}
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name}
          </option>
        ))}
      </select>
    </FormRow>
  );
}

// Giá trị mặc định của ô Đơn vị khi thêm mới: toàn trường, hoặc đơn vị đầu tiên của người chỉ quản lý một số đơn vị
export function useDefaultArchiveUnit(): string {
  const { units, wholeSchool } = useArchiveUnits(PERMISSION_CODES.archiveManage);
  return wholeSchool ? '' : (units[0]?.id ?? '');
}
