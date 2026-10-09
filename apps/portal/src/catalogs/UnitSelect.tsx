import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentUser } from '../session/api-client.js';
import { listOrgUnits, type OrgUnit } from '../org-units/org-units-api.js';

// Chọn đơn vị cho danh mục thuộc đơn vị; mặc định là Trường chính với người toàn trường, còn lại là đơn vị được gán đầu tiên
export function useUnitChoice(): {
  units: OrgUnit[];
  selectedId: string | undefined;
  select(orgUnitId: string): void;
  isPending: boolean;
} {
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  const units = useQuery({ queryKey: ['org-units', 'flat', ''], queryFn: () => listOrgUnits() });
  const [chosenId, setChosenId] = useState<string>();
  const activeUnits = (units.data ?? []).filter((unit) => unit.status === 'active');
  const assignedIds = (currentUser.data?.assignments ?? []).map((assignment) => assignment.org_unit_id);
  const wholeSchool = assignedIds.includes(null);
  const fallbackId = wholeSchool
    ? activeUnits.find((unit) => unit.unit_type === 'truong_chinh')?.id
    : activeUnits.find((unit) => assignedIds.includes(unit.id))?.id;
  return {
    units: activeUnits,
    selectedId: chosenId ?? fallbackId ?? activeUnits[0]?.id,
    select: setChosenId,
    isPending: units.isPending || currentUser.isPending,
  };
}

export function UnitSelect({
  units,
  selectedId,
  onSelect,
}: {
  units: OrgUnit[];
  selectedId: string | undefined;
  onSelect(orgUnitId: string): void;
}) {
  const selectId = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={selectId} className="text-label font-medium text-text">
        Đơn vị
      </label>
      <select
        id={selectId}
        value={selectedId ?? ''}
        onChange={(event) => onSelect(event.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-content"
      >
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name}
          </option>
        ))}
      </select>
    </div>
  );
}
