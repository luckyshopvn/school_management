import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { COMBINATION_RULE, PERMISSION_CODES, SUBJECT_OPTION_GROUP_LABELS } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createCombination,
  listCombinationStudents,
  listCombinations,
  listSubjects,
  updateCombination,
  type Combination,
} from './subjects-api.js';

// 7.12 Tổ hợp môn (DT-21 phần 21a, YCTD-167): tổ hợp môn lựa chọn của THPT do trường xây dựng từ các môn lựa chọn của
// 7.1 (nhóm khoa học xã hội, khoa học tự nhiên, công nghệ và nghệ thuật); danh sách học sinh đăng ký theo tổ hợp. Mọi người
// xem; người quản lý danh mục (P01.catalog.manage) tạo, sửa. Học sinh đăng ký ở hồ sơ học sinh
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

function CombinationForm({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const options = useQuery({ queryKey: ['subjects', 'THPT'], queryFn: () => listSubjects('THPT') });
  const electives = (options.data ?? []).filter((subject) => subject.option_group && subject.status === 'active');
  const create = useMutation({
    mutationFn: () => createCombination({ code, name, order_no: 100, subject_ids: chosen }),
    onSuccess: async (combination) => {
      setCode('');
      setName('');
      setChosen([]);
      await queryClient.invalidateQueries({ queryKey: ['subject-combinations'] });
      onSaved(`Đã thêm tổ hợp ${combination.name}`);
    },
  });
  return (
    <form
      aria-label="Thêm tổ hợp môn"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-label font-medium text-text">
          Mã tổ hợp
          <input
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <label className="text-label font-medium text-text">
          Tên tổ hợp
          <input
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-label font-medium text-text">
          Môn lựa chọn (chọn đúng {COMBINATION_RULE.subject_count} môn thuộc ít nhất {COMBINATION_RULE.min_groups} nhóm)
        </legend>
        {(['social_science', 'natural_science', 'technology_arts'] as const).map((group) => (
          <div key={group} className="flex flex-wrap items-center gap-4">
            <span className="w-52 text-label text-text-secondary">{SUBJECT_OPTION_GROUP_LABELS[group]}</span>
            {electives
              .filter((subject) => subject.option_group === group)
              .map((subject) => (
                <label key={subject.id} className="flex items-center gap-2 text-content">
                  <input
                    type="checkbox"
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
        ))}
        {options.data && electives.length === 0 ? (
          <p className="text-label text-text-secondary">
            Chưa có môn lựa chọn của THPT; nạp môn mẫu ở 7.1 Môn học và hoạt động giáo dục.
          </p>
        ) : null}
      </fieldset>
      <div>
        <Button type="submit" variant="primary" disabled={!code || !name || chosen.length === 0 || create.isPending}>
          Thêm tổ hợp
        </Button>
      </div>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
    </form>
  );
}

function Students({ combination }: { combination: Combination }) {
  const students = useQuery({
    queryKey: ['subject-combination-students', combination.id],
    queryFn: () => listCombinationStudents(combination.id),
  });
  return (
    <ul className="list-disc pl-6 text-content" aria-label={`Học sinh tổ hợp ${combination.name}`}>
      {(students.data ?? []).map((student) => (
        <li key={student.child_id}>
          {student.full_name}
          {student.class_name ? ` (${student.class_name})` : ''}
          {student.status === 'pending' ? ' - chờ duyệt' : ''}
        </li>
      ))}
      {students.data && students.data.length === 0 ? <li className="list-none">Chưa có học sinh đăng ký.</li> : null}
    </ul>
  );
}

export function SubjectCombinationsPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.catalogManage);
  const [toastMessage, setToastMessage] = useState<string>();
  const [openId, setOpenId] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const combinations = useQuery({ queryKey: ['subject-combinations'], queryFn: listCombinations });
  const toggle = useMutation({
    mutationFn: (combination: Combination) =>
      updateCombination(combination.id, { status: combination.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subject-combinations'] });
    },
  });
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/subject-combinations')}</h1>
        {combinations.error ? <Alert tone="danger">{messageOf(combinations.error)}</Alert> : null}
        {toggle.error ? <Alert tone="danger">{messageOf(toggle.error)}</Alert> : null}
        <table className="w-full text-content" aria-label="Tổ hợp môn">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Tên tổ hợp</th>
              <th className="px-3 py-2">Môn lựa chọn</th>
              <th className="px-3 py-2">Học sinh</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(combinations.data ?? []).map((combination) => (
              <tr key={combination.id} className="border-t border-border align-top">
                <td className="px-3 py-2">{combination.code}</td>
                <td className="px-3 py-2">{combination.name}</td>
                <td className="px-3 py-2">{combination.subjects.map((subject) => subject.name).join(', ')}</td>
                <td className="px-3 py-2">
                  <Button
                    variant="text"
                    onClick={() => setOpenId(openId === combination.id ? undefined : combination.id)}
                  >
                    {combination.student_count} học sinh
                  </Button>
                  {openId === combination.id ? <Students combination={combination} /> : null}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge
                    tone={combination.status === 'active' ? 'success' : 'neutral'}
                    label={combination.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  {canManage ? (
                    <Button variant="text" onClick={() => toggle.mutate(combination)}>
                      {combination.status === 'active' ? 'Ngừng dùng' : 'Dùng lại'}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {combinations.data && combinations.data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-2 text-text-secondary">
                  Chưa có tổ hợp môn.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {canManage ? <CombinationForm onSaved={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
