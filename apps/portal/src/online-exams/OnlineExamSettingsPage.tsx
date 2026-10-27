import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EXAM_MODE_LABELS, SCHOOL_LEVELS, type ExamMode, type SchoolLevelCode } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { messageOf } from '../exams/exam-filters.js';
import { listLevelSettings, readSchoolSettings, updateLevelSetting, updateSchoolSettings } from './online-exams-api.js';

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
        input.enabled ? 'Đã cho học sinh cấp này đăng nhập làm bài' : 'Đã tắt đăng nhập làm bài của học sinh cấp này',
      );
    },
  });
  // Chế độ thi mặc định, thi từ xa, dải mạng, hạn mã phòng (Eric chốt 2026-10-26: mặc định chỉ thi tại trường)
  const school = useQuery({ queryKey: ['online-exam-school-settings'], queryFn: readSchoolSettings });
  const [mode, setMode] = useState<ExamMode>('at-school');
  const [allowRemote, setAllowRemote] = useState(false);
  const [networks, setNetworks] = useState('');
  const [minutes, setMinutes] = useState('60');
  const [allowLive, setAllowLive] = useState(false);
  const [allowRecording, setAllowRecording] = useState(false);
  const [retention, setRetention] = useState('30');
  useEffect(() => {
    if (school.data) {
      setMode(school.data.default_exam_mode);
      setAllowRemote(school.data.allow_remote);
      setNetworks(school.data.allowed_networks.join('\n'));
      setMinutes(String(school.data.room_code_minutes));
      setAllowLive(school.data.allow_live_proctoring);
      setAllowRecording(school.data.allow_recording);
      setRetention(String(school.data.recording_retention_days));
    }
  }, [school.data]);
  const saveSchool = useMutation({
    mutationFn: () =>
      updateSchoolSettings({
        default_exam_mode: mode,
        allow_remote: allowRemote,
        allowed_networks: networks
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line !== ''),
        room_code_minutes: Number(minutes),
        allow_live_proctoring: allowLive,
        allow_recording: allowRecording,
        recording_retention_days: Number(retention),
      }),
    onSuccess: async (data) => {
      queryClient.setQueryData(['online-exam-school-settings'], data);
      setToastMessage('Đã ghi chế độ thi của trường');
    },
  });
  const levelName = (code: SchoolLevelCode) => SCHOOL_LEVELS.find((level) => level.value === code)?.label ?? code;
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/online-exams/settings')}</h1>
        <Alert tone="info">
          Học sinh dùng tài khoản ở 4.1.10 Tài khoản học và thi để vào làm bài; trẻ nhỏ làm bài với sự hướng dẫn của cha
          mẹ hoặc giáo viên. Camera chỉ xử lý ngay trên máy học sinh, không gửi hình hay video lên máy chủ. Chỉ người
          quản lý đề, kiểm tra (Hiệu trưởng, Phó Hiệu trưởng) bật, tắt theo cấp.
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
        <section aria-label="Chế độ thi của trường" className="flex flex-col gap-3">
          <h2 className="text-section-title font-semibold text-text">Chế độ thi của trường</h2>
          <Alert tone="info">
            Mặc định chỉ thi tại trường: giám thị mở phòng thi, học sinh nhập mã phòng; nếu khai dải mạng thì chỉ vào
            được từ mạng của trường. Thi từ xa tắt mặc định, trường phải bật.
          </Alert>
          {school.error ? <Alert tone="danger">{messageOf(school.error)}</Alert> : null}
          {saveSchool.error ? <Alert tone="danger">{messageOf(saveSchool.error)}</Alert> : null}
          <label className="text-content text-text">
            <input type="checkbox" checked={allowRemote} onChange={(event) => setAllowRemote(event.target.checked)} />{' '}
            Cho phép giao bài thi từ xa
          </label>
          <label className="text-label font-medium text-text">
            Chế độ thi mặc định
            <select
              aria-label="Chế độ thi mặc định"
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={mode}
              onChange={(event) => setMode(event.target.value as ExamMode)}
            >
              {(Object.keys(EXAM_MODE_LABELS) as ExamMode[]).map((key) => (
                <option key={key} value={key} disabled={key === 'remote' && !allowRemote}>
                  {EXAM_MODE_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-label font-medium text-text">
            Dải mạng của trường (mỗi dòng một dải, ví dụ 10.0.0.0/8; để trống là không giới hạn)
            <textarea
              aria-label="Dải mạng của trường"
              className={`mt-2 block min-h-24 w-80 ${FORM_CONTROL_CLASS}`}
              value={networks}
              onChange={(event) => setNetworks(event.target.value)}
            />
          </label>
          <label className="text-label font-medium text-text">
            Hạn của mã phòng thi (phút)
            <input
              type="number"
              aria-label="Hạn của mã phòng thi"
              className={`mt-2 block w-24 ${FORM_CONTROL_CLASS}`}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </label>
          <h3 className="text-label font-semibold text-text">Giám sát bằng camera (mặc định tắt)</h3>
          <Alert tone="info">
            Khi bật, giáo viên chọn từng bài giao có xem camera trực tiếp hoặc ghi hình. Học sinh đọc thông báo trước
            khi vào thi; học sinh dưới 16 tuổi cần cha mẹ đồng ý từng loại. Hình xem trực tiếp đi thẳng giữa trình
            duyệt, không lưu ở máy chủ. Bản ghi lưu mã hoá, chỉ giáo viên giao bài và người quản lý xem, tự xoá sau thời
            hạn. Nên có ý kiến pháp lý (PL-15) trước khi bật ở trường thật.
          </Alert>
          <label className="text-content text-text">
            <input type="checkbox" checked={allowLive} onChange={(event) => setAllowLive(event.target.checked)} /> Cho
            phép giáo viên xem camera trực tiếp
          </label>
          <label className="text-content text-text">
            <input
              type="checkbox"
              checked={allowRecording}
              onChange={(event) => setAllowRecording(event.target.checked)}
            />{' '}
            Cho phép ghi hình camera
          </label>
          <label className="text-label font-medium text-text">
            Thời hạn giữ bản ghi (ngày, từ 7 đến 90)
            <input
              type="number"
              aria-label="Thời hạn giữ bản ghi"
              className={`mt-2 block w-24 ${FORM_CONTROL_CLASS}`}
              value={retention}
              onChange={(event) => setRetention(event.target.value)}
            />
          </label>
          <div>
            <Button variant="primary" onClick={() => saveSchool.mutate()} disabled={saveSchool.isPending}>
              Ghi chế độ thi
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
