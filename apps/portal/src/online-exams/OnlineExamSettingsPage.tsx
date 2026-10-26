import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SCHOOL_LEVELS, type SchoolLevelCode } from '@school-management/shared';
import { Alert, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { messageOf } from '../exams/exam-filters.js';
import { listLevelSettings, updateLevelSetting } from './online-exams-api.js';

// 3. Cấu hình thi trực tuyến (DT-23 phần 23a, GD-105 Eric chốt 2026-10-26): học sinh tự đăng nhập làm bài ở mọi cấp học, kể cả
// Tiểu học; trường tắt được theo từng cấp. Tắt thì học sinh cấp đó không vào được và không giao đề mới; bài đã làm giữ nguyên
export function OnlineExamSettingsPage() {
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const settings = useQuery({ queryKey: ['online-exam-settings'], queryFn: listLevelSettings });
  const update = useMutation({
    mutationFn: (input: { level: SchoolLevelCode; enabled: boolean }) => updateLevelSetting(input.level, input.enabled),
    onSuccess: async (data, input) => {
      queryClient.setQueryData(['online-exam-settings'], data);
      setToastMessage(
        input.enabled
          ? 'Đã cho học sinh cấp này đăng nhập làm bài'
          : 'Đã tắt đăng nhập làm bài của học sinh cấp này',
      );
    },
  });
  const levelName = (code: SchoolLevelCode) => SCHOOL_LEVELS.find((level) => level.value === code)?.label ?? code;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/online-exams/settings')}</h1>
        <Alert tone="info">
          Học sinh dùng tài khoản ở 4.1.10 Tài khoản học và thi để vào làm bài; trẻ nhỏ làm bài với sự hướng dẫn của cha mẹ hoặc
          giáo viên. Camera chỉ xử lý ngay trên máy học sinh, không gửi hình hay video lên máy chủ. Chỉ người quản lý đề, kiểm tra
          (Hiệu trưởng, Phó Hiệu trưởng) bật, tắt theo cấp.
        </Alert>
        {settings.error ? <Alert tone="danger">{messageOf(settings.error)}</Alert> : null}
        {update.error ? <Alert tone="danger">{messageOf(update.error)}</Alert> : null}
        <section aria-label="Cho học sinh đăng nhập làm bài theo cấp" className="flex flex-col gap-2">
          <h2 className="text-section-title font-semibold text-text">Cho học sinh đăng nhập làm bài theo cấp</h2>
          {(settings.data ?? []).map((row) => (
            <label key={row.school_level} className="text-content text-text">
              <input
                type="checkbox"
                aria-label={`Cho học sinh ${levelName(row.school_level)} đăng nhập làm bài`}
                checked={row.student_login_enabled}
                disabled={update.isPending}
                onChange={(event) => update.mutate({ level: row.school_level, enabled: event.target.checked })}
              />{' '}
              {levelName(row.school_level)}
              {row.updated_by_name ? ` (sửa lần cuối bởi ${row.updated_by_name})` : ''}
            </label>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
