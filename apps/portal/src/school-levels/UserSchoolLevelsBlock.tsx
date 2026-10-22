import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SchoolLevelCode } from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { listSchoolLevels, readUserSchoolLevels, saveUserSchoolLevels } from './school-levels-api.js';

// Phạm vi cấp học của tài khoản (DT-19 phần 19a): chỉ hiện ở trường bật từ hai cấp; không tích cấp nào là mọi cấp. Phạm vi
// cấp chỉ thu hẹp quyền đã có, không cấp thêm quyền
export function UserSchoolLevelsBlock({ userId, onChanged }: { userId: string; onChanged(message: string): void }) {
  const levels = useQuery({ queryKey: ['school-levels'], queryFn: listSchoolLevels });
  const enabled = (levels.data?.levels ?? []).filter((level) => level.is_enabled);
  const scope = useQuery({
    queryKey: ['user-school-levels', userId],
    queryFn: () => readUserSchoolLevels(userId),
    enabled: enabled.length > 1,
  });
  if (enabled.length <= 1 || !scope.data) {
    return null;
  }
  return (
    <UserSchoolLevelsForm
      key={userId}
      userId={userId}
      levels={enabled}
      initial={scope.data.school_levels}
      onChanged={onChanged}
    />
  );
}

function UserSchoolLevelsForm({
  userId,
  levels,
  initial,
  onChanged,
}: {
  userId: string;
  levels: Array<{ code: SchoolLevelCode; display_name: string }>;
  initial: SchoolLevelCode[];
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SchoolLevelCode[]>(initial);
  const save = useMutation({
    mutationFn: () => saveUserSchoolLevels(userId, selected),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['user-school-levels', userId] });
      onChanged('Đã ghi phạm vi cấp học');
    },
  });
  return (
    <div className="flex flex-col gap-2" aria-label="Phạm vi cấp học">
      <h3 className="text-label font-semibold text-text-secondary">PHẠM VI CẤP HỌC</h3>
      {save.error ? (
        <Alert tone="danger">
          {save.error instanceof ApiError ? save.error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại'}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-4">
        {levels.map((level) => (
          <label key={level.code} className="flex items-center gap-2 text-content">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={selected.includes(level.code)}
              onChange={(event) =>
                setSelected(
                  event.target.checked ? [...selected, level.code] : selected.filter((code) => code !== level.code),
                )
              }
            />
            {level.display_name}
          </label>
        ))}
      </div>
      <p className="text-label text-text-secondary">Không tích cấp nào là được xem mọi cấp của trường.</p>
      <div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Ghi phạm vi cấp học
        </Button>
      </div>
    </div>
  );
}
