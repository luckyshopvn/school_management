import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SCHOOL_LEVELS, type SchoolLevelCode } from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import { listGradeLevels } from '../catalogs/catalogs-api.js';
import { ApiError } from '../session/api-client.js';
import { listOrgUnitLevels, setOrgUnitLevels, type OrgUnit } from './org-units-api.js';

// Cấp học của trường chính, phân hiệu, điểm trường (DT-19 phần 19b, YCTD-152). Chỉ hiện khi trường có khối ngoài Mầm non;
// trường chỉ có Mầm non thì mọi đơn vị là Mầm non, màn hình giữ như cũ. Không bỏ được cấp đơn vị đang có lớp (máy chủ kiểm tra)
function UnitLevelsRow({
  unit,
  levels,
  canManage,
  onChanged,
}: {
  unit: OrgUnit;
  levels: SchoolLevelCode[];
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SchoolLevelCode[]>(levels);
  const save = useMutation({
    mutationFn: () => setOrgUnitLevels(unit.id, selected),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['org-unit-levels'] });
      onChanged(`Đã lưu cấp học của ${unit.name}`);
    },
  });
  const changed = selected.join(',') !== levels.join(',');
  return (
    <tr className="border-t border-border" aria-label={`Cấp học của ${unit.name}`}>
      <td className="py-2 pr-4 font-medium text-text">{unit.name}</td>
      {SCHOOL_LEVELS.map((level) => (
        <td key={level.value} className="py-2 pr-4 text-center">
          <input
            type="checkbox"
            className="h-4 w-4"
            aria-label={`${unit.name}: ${level.label}`}
            disabled={!canManage}
            checked={selected.includes(level.value)}
            onChange={(event) =>
              setSelected((current) =>
                event.target.checked
                  ? SCHOOL_LEVELS.map((item) => item.value).filter(
                      (code) => current.includes(code) || code === level.value,
                    )
                  : current.filter((code) => code !== level.value),
              )
            }
          />
        </td>
      ))}
      <td className="py-2">
        {canManage ? (
          <Button disabled={!changed || selected.length === 0 || save.isPending} onClick={() => save.mutate()}>
            Ghi
          </Button>
        ) : null}
        {save.error ? (
          <p className="text-label text-danger">
            {save.error instanceof ApiError ? save.error.message : 'Không lưu được cấp học'}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

export function OrgUnitLevelsPanel({
  units,
  canManage,
  onChanged,
}: {
  units: OrgUnit[];
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const gradeLevels = useQuery({ queryKey: ['grade-levels'], queryFn: listGradeLevels });
  const multiLevel = (gradeLevels.data ?? []).some((grade) => grade.school_level !== 'MN');
  const levels = useQuery({ queryKey: ['org-unit-levels'], queryFn: listOrgUnitLevels, enabled: multiLevel });
  if (!multiLevel || units.length === 0) {
    return null;
  }
  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-label="Cấp học của đơn vị">
      <h2 className="mb-3 text-section-title font-semibold text-text">Cấp học của đơn vị</h2>
      {levels.isError ? <Alert tone="danger">Không tải được cấp học của đơn vị</Alert> : null}
      {levels.data ? (
        <table className="w-full text-content">
          <thead>
            <tr className="text-left text-label text-text-secondary">
              <th className="py-2 pr-4">Đơn vị</th>
              {SCHOOL_LEVELS.map((level) => (
                <th key={level.value} className="py-2 pr-4 text-center">
                  {level.label}
                </th>
              ))}
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => {
              const current = levels.data.find((row) => row.org_unit_id === unit.id)?.school_levels ?? [];
              return (
                <UnitLevelsRow
                  key={`${unit.id}:${current.join(',')}`}
                  unit={unit}
                  levels={current}
                  canManage={canManage}
                  onChanged={onChanged}
                />
              );
            })}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
