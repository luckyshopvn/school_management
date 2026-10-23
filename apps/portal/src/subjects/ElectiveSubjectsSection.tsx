import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { readElectiveSubjects, saveElectiveSubjects } from './subjects-api.js';

// Môn tự chọn của học sinh (hồ sơ học sinh Tiểu học, DT-20 phần 20a): chỉ hiện khi khối của lớp đang học có môn tự chọn theo
// chương trình của lớp, nên hồ sơ trẻ Mầm non không đổi. Người quản lý hồ sơ học sinh sửa
export function ElectiveSubjectsSection({ childId, onChanged }: { childId: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.childManage);
  const electives = useQuery({
    queryKey: ['elective-subjects', childId],
    queryFn: () => readElectiveSubjects(childId),
  });
  const [chosen, setChosen] = useState<string[]>([]);
  useEffect(() => setChosen((electives.data?.subjects ?? []).map((subject) => subject.id)), [electives.data]);
  const save = useMutation({
    mutationFn: () => saveElectiveSubjects(childId, chosen),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['elective-subjects', childId] });
      onChanged('Đã ghi môn tự chọn');
    },
  });
  const options = electives.data?.options ?? [];
  if (options.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2" aria-label="Môn tự chọn">
      <h3 className="text-content font-semibold text-text">Môn tự chọn</h3>
      <div className="flex flex-wrap gap-4">
        {options.map((subject) => (
          <label key={subject.id} className="flex items-center gap-2 text-content">
            <input
              type="checkbox"
              disabled={!canManage}
              checked={chosen.includes(subject.id)}
              onChange={(event) =>
                setChosen((current) =>
                  event.target.checked ? [...current, subject.id] : current.filter((id) => id !== subject.id),
                )
              }
            />
            {subject.name}
          </label>
        ))}
      </div>
      {save.error ? (
        <Alert tone="danger">
          {save.error instanceof ApiError ? save.error.message : 'Không ghi được môn tự chọn'}
        </Alert>
      ) : null}
      {canManage ? (
        <div>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Ghi môn tự chọn
          </Button>
        </div>
      ) : null}
    </section>
  );
}
