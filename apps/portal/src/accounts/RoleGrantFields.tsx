import { WHOLE_SCHOOL_ROLE_CODES } from '@school-management/shared';
import type { OrgUnit } from '../org-units/org-units-api.js';
import type { Role, RoleGrant } from './accounts-api.js';

// Chọn vai trò và đơn vị; vai trò toàn trường không chọn đơn vị (PQ-03)
export function isWholeSchoolRole(roleCode: string): boolean {
  return (WHOLE_SCHOOL_ROLE_CODES as readonly string[]).includes(roleCode);
}

export function RoleGrantFields({
  roles,
  units,
  value,
  onChange,
  idPrefix,
}: {
  roles: Role[];
  units: OrgUnit[];
  value: RoleGrant;
  onChange(value: RoleGrant): void;
  idPrefix: string;
}) {
  const wholeSchool = isWholeSchoolRole(value.role_code);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-role`} className="text-label font-medium text-text">
          Vai trò
        </label>
        <select
          id={`${idPrefix}-role`}
          value={value.role_code}
          onChange={(event) =>
            onChange({
              role_code: event.target.value,
              org_unit_id: isWholeSchoolRole(event.target.value) ? null : value.org_unit_id,
            })
          }
          className="rounded-lg border border-border bg-card px-3 py-2 text-content"
        >
          <option value="">Chọn vai trò</option>
          {roles.map((role) => (
            <option key={role.id} value={role.code}>
              {role.code} {role.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-unit`} className="text-label font-medium text-text">
          Đơn vị
        </label>
        <select
          id={`${idPrefix}-unit`}
          value={value.org_unit_id ?? ''}
          disabled={wholeSchool}
          onChange={(event) => onChange({ ...value, org_unit_id: event.target.value || null })}
          className="rounded-lg border border-border bg-card px-3 py-2 text-content disabled:bg-page"
        >
          <option value="">{wholeSchool ? 'Toàn trường' : 'Chọn đơn vị'}</option>
          {units
            .filter((unit) => unit.status === 'active')
            .map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}
