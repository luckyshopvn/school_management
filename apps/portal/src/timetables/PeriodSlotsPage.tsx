import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERIOD_SESSION_LABELS, PERMISSION_CODES, type SchoolLevelCode } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import { listPeriodSlots, savePeriodSlots, type PeriodSlot } from './timetables-api.js';

// 7.3 Khung giờ tiết học (DT-20 phần 22c1, YCTD-160): mỗi cấp ngoài Mầm non khai báo các tiết trong ngày (buổi, giờ bắt đầu,
// kết thúc) của năm học đang dùng; thời khoá biểu chỉ dùng tiết có trong khung. Mẫu Tiểu học 35 phút một tiết chỉ để điền
// nhanh, nhà trường sửa theo kế hoạch của trường. Người có P02.timetable.manage sửa
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

const PRIMARY_SAMPLE: PeriodSlot[] = [
  { period_no: 1, session: 'morning', start_time: '07:15', end_time: '07:50' },
  { period_no: 2, session: 'morning', start_time: '07:55', end_time: '08:30' },
  { period_no: 3, session: 'morning', start_time: '08:50', end_time: '09:25' },
  { period_no: 4, session: 'morning', start_time: '09:30', end_time: '10:05' },
  { period_no: 5, session: 'afternoon', start_time: '14:00', end_time: '14:35' },
  { period_no: 6, session: 'afternoon', start_time: '14:40', end_time: '15:15' },
  { period_no: 7, session: 'afternoon', start_time: '15:30', end_time: '16:05' },
];

export function PeriodSlotsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.timetableManage);
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.filter((level) => level.value !== 'MN');
  const [chosen, setChosen] = useState<SchoolLevelCode>();
  const level = levels.find((item) => item.value === chosen)?.value ?? levels[0]?.value;
  const queryClient = useQueryClient();
  const slots = useQuery({
    queryKey: ['period-slots', level],
    queryFn: () => listPeriodSlots(level ?? 'TH'),
    enabled: Boolean(level),
  });
  const [rows, setRows] = useState<PeriodSlot[]>([]);
  useEffect(() => setRows(slots.data ?? []), [slots.data]);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const save = useMutation({
    mutationFn: () => savePeriodSlots(level ?? 'TH', rows),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['period-slots'] });
      setToastMessage('Đã ghi khung giờ tiết học');
    },
  });
  const change = (index: number, patch: Partial<PeriodSlot>) =>
    setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/period-slots')}</h1>
        {!level ? (
          <Alert tone="info">Trường chưa bật cấp Tiểu học, THCS hoặc THPT; bật cấp học ở 1.4 Cấu hình trường.</Alert>
        ) : (
          <section className="flex flex-col gap-3" aria-label="Khung giờ tiết học">
            {levels.length > 1 ? (
              <label className="text-label font-medium text-text">
                Cấp học
                <select
                  aria-label="Cấp học"
                  className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                  value={level}
                  onChange={(event) => setChosen(event.target.value as SchoolLevelCode)}
                >
                  {levels.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
            <table className="text-content" aria-label="Các tiết trong ngày">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Tiết</th>
                  <th className="px-3 py-2">Buổi</th>
                  <th className="px-3 py-2">Bắt đầu</th>
                  <th className="px-3 py-2">Kết thúc</th>
                  {canManage ? <th className="px-3 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-t border-border">
                    <td className="px-3 py-2">
                      <input
                        className={`w-16 ${FORM_CONTROL_CLASS}`}
                        aria-label={`Số tiết dòng ${index + 1}`}
                        inputMode="numeric"
                        disabled={!canManage}
                        value={row.period_no}
                        onChange={(event) => change(index, { period_no: Number(event.target.value) })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className={FORM_CONTROL_CLASS}
                        aria-label={`Buổi tiết ${row.period_no}`}
                        disabled={!canManage}
                        value={row.session}
                        onChange={(event) => change(index, { session: event.target.value as PeriodSlot['session'] })}
                      >
                        {Object.entries(PERIOD_SESSION_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        className={FORM_CONTROL_CLASS}
                        aria-label={`Bắt đầu tiết ${row.period_no}`}
                        disabled={!canManage}
                        value={row.start_time}
                        onChange={(event) => change(index, { start_time: event.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        className={FORM_CONTROL_CLASS}
                        aria-label={`Kết thúc tiết ${row.period_no}`}
                        disabled={!canManage}
                        value={row.end_time}
                        onChange={(event) => change(index, { end_time: event.target.value })}
                      />
                    </td>
                    {canManage ? (
                      <td className="px-3 py-2">
                        <Button
                          variant="text"
                          onClick={() => setRows((current) => current.filter((_row, position) => position !== index))}
                        >
                          Bỏ
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-text-secondary">
                      Chưa khai báo tiết nào.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            {canManage ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() =>
                    setRows((current) => [
                      ...current,
                      {
                        period_no: Math.max(0, ...current.map((row) => row.period_no)) + 1,
                        session: 'morning',
                        start_time: '',
                        end_time: '',
                      },
                    ])
                  }
                >
                  Thêm tiết
                </Button>
                {level === 'TH' ? (
                  <Button onClick={() => setRows(PRIMARY_SAMPLE)}>Điền khung mẫu Tiểu học</Button>
                ) : null}
                <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                  Ghi khung giờ
                </Button>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </AppShell>
  );
}
