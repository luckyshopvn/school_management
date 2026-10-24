import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { decideChildCombination, readChildCombination, saveChildCombination } from './subjects-api.js';

// Tổ hợp môn của học sinh THPT (DT-21 phần 21a, YCTD-167): chỉ hiện khi học sinh đang học lớp THPT (máy chủ trả danh sách
// tổ hợp rỗng với cấp khác nên hồ sơ Mầm non, Tiểu học không đổi). Đăng ký lần đầu có hiệu lực ngay; đổi tổ hợp đã duyệt thì
// chờ Ban Giám hiệu (quyền quản lý lớp) duyệt
export function ChildCombinationSection({ childId, onChanged }: { childId: string; onChanged(message: string): void }) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.childManage);
  const canApprove = useHasPermission(PERMISSION_CODES.classManage);
  const combination = useQuery({
    queryKey: ['child-combination', childId],
    queryFn: () => readChildCombination(childId),
  });
  const [chosen, setChosen] = useState('');
  useEffect(() => setChosen(combination.data?.registration?.combination_id ?? ''), [combination.data]);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['child-combination', childId] });
    await queryClient.invalidateQueries({ queryKey: ['elective-subjects', childId] });
    await queryClient.invalidateQueries({ queryKey: ['subject-combinations'] });
    onChanged(message);
  };
  const save = useMutation({
    mutationFn: () => saveChildCombination(childId, chosen),
    onSuccess: () => refresh('Đã ghi tổ hợp môn'),
  });
  const decide = useMutation({
    mutationFn: (approve: boolean) => decideChildCombination(childId, approve),
    onSuccess: () => refresh('Đã xử lý đề nghị đổi tổ hợp'),
  });
  const options = combination.data?.options ?? [];
  if (options.length === 0) {
    return null;
  }
  const registration = combination.data?.registration ?? null;
  const error = save.error ?? decide.error;
  return (
    <section className="flex flex-col gap-2" aria-label="Tổ hợp môn">
      <h3 className="text-content font-semibold text-text">Tổ hợp môn</h3>
      {registration ? (
        <p className="text-content">
          {registration.status === 'pending'
            ? `Đề nghị đổi sang tổ hợp ${registration.combination_name}, chờ duyệt.`
            : `Tổ hợp đã đăng ký: ${registration.combination_name}.`}
        </p>
      ) : (
        <p className="text-content text-text-secondary">Học sinh chưa đăng ký tổ hợp.</p>
      )}
      {canManage ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-label font-medium text-text">
            Tổ hợp
            <select
              aria-label="Tổ hợp môn của học sinh"
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={chosen}
              onChange={(event) => setChosen(event.target.value)}
            >
              <option value="">Chọn tổ hợp</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={!chosen || save.isPending} onClick={() => save.mutate()}>
            Ghi tổ hợp môn
          </Button>
        </div>
      ) : null}
      {registration?.status === 'pending' && canApprove ? (
        <div className="flex gap-2">
          <Button variant="primary" disabled={decide.isPending} onClick={() => decide.mutate(true)}>
            Duyệt đổi tổ hợp
          </Button>
          <Button disabled={decide.isPending} onClick={() => decide.mutate(false)}>
            Từ chối
          </Button>
        </div>
      ) : null}
      {error ? (
        <Alert tone="danger">{error instanceof ApiError ? error.message : 'Không ghi được tổ hợp môn'}</Alert>
      ) : null}
    </section>
  );
}
