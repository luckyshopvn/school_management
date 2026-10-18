import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUnitChoice } from '../catalogs/UnitSelect.js';
import type { StudentFilter } from '../children/children-api.js';
import { listClasses } from '../classes/classes-api.js';

// Bộ lọc đơn vị, lớp dùng chung cho các màn hình học sinh của phần 16g ("Mở rộng tìm kiếm" của lưới)
const selectClass = 'mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

export function useStudentClassFilter(extra: StudentFilter = {}): {
  filter: StudentFilter;
  controls(onChange: () => void, more?: ReactNode): ReactNode;
} {
  const unitChoice = useUnitChoice();
  const [orgUnitId, setOrgUnitId] = useState('');
  const [classId, setClassId] = useState('');
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId),
    enabled: Boolean(orgUnitId),
  });
  return {
    filter: { ...extra, org_unit_id: orgUnitId || undefined, class_id: classId || undefined },
    controls: (onChange, more) => (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <label className="text-label font-medium text-text">
          Đơn vị
          <select
            value={orgUnitId}
            onChange={(event) => {
              setOrgUnitId(event.target.value);
              setClassId('');
              onChange();
            }}
            className={selectClass}
          >
            <option value="">Tất cả</option>
            {unitChoice.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
        {orgUnitId ? (
          <label className="text-label font-medium text-text">
            Lớp
            <select
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                onChange();
              }}
              className={selectClass}
            >
              <option value="">Tất cả</option>
              {(classes.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {more}
      </div>
    ),
  };
}
