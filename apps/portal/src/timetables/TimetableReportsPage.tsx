import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { PERMISSION_CODES, TIMETABLE_WEEKDAY_LABELS, type SchoolLevelCode } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import {
  createLookupCode,
  listLookupCodes,
  listSubstituteTeachers,
  lookupUrl,
  readRoomReport,
  readTeachingReport,
  revokeLookupCode,
  type LookupCode,
} from './timetable-generator-api.js';
import { listLevelClasses } from './TimetableGeneratorPage.js';

// 7.10 Báo cáo tiết dạy, dùng phòng và mã QR tra cứu (DT-20 phần 22c2, YCTD-164): tiết dạy theo giáo viên trong khoảng ngày
// (theo thời khoá biểu, dạy thay, được dạy thay, đổi tiết, thực dạy); dùng phòng của bản đang áp dụng; mã QR của lớp hoặc
// giáo viên trỏ tới trang tra cứu công khai (địa chỉ ghép từ tên miền đang mở), in được, thu hồi được
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

const todayText = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const plusDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

type Tab = 'teaching' | 'rooms' | 'qr';

function TeachingReportSection() {
  const today = todayText();
  const [from, setFrom] = useState(plusDays(today, -6));
  const [to, setTo] = useState(today);
  const report = useQuery({ queryKey: ['teaching-report', from, to], queryFn: () => readTeachingReport(from, to) });
  return (
    <section className="flex flex-col gap-3" aria-label="Tiết dạy theo giáo viên">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-label font-medium text-text">
          Từ ngày
          <input
            type="date"
            aria-label="Từ ngày"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="text-label font-medium text-text">
          Đến ngày
          <input
            type="date"
            aria-label="Đến ngày"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </div>
      {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
      {report.data ? (
        <>
          <p className="text-label text-text-secondary">{report.data.days} ngày có tiết theo thời khoá biểu.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-content" aria-label="Báo cáo tiết dạy">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Giáo viên</th>
                  <th className="px-3 py-2">Theo thời khoá biểu</th>
                  <th className="px-3 py-2">Dạy thay</th>
                  <th className="px-3 py-2">Được dạy thay</th>
                  <th className="px-3 py-2">Đổi tiết</th>
                  <th className="px-3 py-2">Thực dạy</th>
                </tr>
              </thead>
              <tbody>
                {report.data.teachers.map((row) => (
                  <tr key={row.teacher_user_id} className="border-t border-border">
                    <td className="px-3 py-2">{row.teacher_name}</td>
                    <td className="px-3 py-2">{row.planned}</td>
                    <td className="px-3 py-2">{row.substitute_taught}</td>
                    <td className="px-3 py-2">{row.substituted_away}</td>
                    <td className="px-3 py-2">{row.swapped}</td>
                    <td className="px-3 py-2 font-medium">{row.actual}</td>
                  </tr>
                ))}
                {report.data.teachers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-text-secondary">
                      Không có tiết nào trong khoảng ngày này.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

function RoomReportSection() {
  const [date, setDate] = useState(todayText());
  const report = useQuery({ queryKey: ['room-report', date], queryFn: () => readRoomReport(date) });
  const days = [1, 2, 3, 4, 5, 6];
  return (
    <section className="flex flex-col gap-3" aria-label="Dùng phòng">
      <label className="text-label font-medium text-text">
        Thời khoá biểu áp dụng vào ngày
        <input
          type="date"
          aria-label="Ngày áp dụng"
          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      {report.error ? <Alert tone="danger">{messageOf(report.error)}</Alert> : null}
      {report.data ? (
        <div className="overflow-x-auto">
          <table className="w-full text-content" aria-label="Báo cáo dùng phòng">
            <thead className="text-left text-label font-medium text-text-secondary">
              <tr>
                <th className="px-3 py-2">Phòng</th>
                <th className="px-3 py-2">Tiết/tuần</th>
                <th className="px-3 py-2">Tỉ lệ dùng</th>
                {days.map((day) => (
                  <th key={day} className="px-3 py-2">
                    {TIMETABLE_WEEKDAY_LABELS[day]}
                  </th>
                ))}
                <th className="px-3 py-2">Lớp dùng</th>
              </tr>
            </thead>
            <tbody>
              {report.data.rooms.map((room) => (
                <tr key={room.room_id} className="border-t border-border">
                  <td className="px-3 py-2">{room.room_name}</td>
                  <td className="px-3 py-2">{room.periods}</td>
                  <td className="px-3 py-2">{room.usage_percent}%</td>
                  {days.map((day) => (
                    <td key={day} className="px-3 py-2">
                      {room.by_weekday[day] ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-2">{room.classes.join(', ')}</td>
                </tr>
              ))}
              {report.data.rooms.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-2 text-text-secondary">
                    Thời khoá biểu đang áp dụng chưa xếp phòng cho tiết nào.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function QrImage({ code }: { code: LookupCode }) {
  const [image, setImage] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(lookupUrl(code.code), { margin: 1, width: 200 }).then((url) => {
      if (!cancelled) setImage(url);
    });
    return () => {
      cancelled = true;
    };
  }, [code.code]);
  return (
    <figure className="flex flex-col items-center gap-1">
      {image ? (
        <img src={image} alt={`Mã QR tra cứu thời khoá biểu ${code.target_name}`} width={200} height={200} />
      ) : null}
      <figcaption className="text-center text-label">
        {code.kind === 'class' ? 'Lớp' : 'Giáo viên'} {code.target_name}
        <a
          className="block break-all text-primary underline"
          href={lookupUrl(code.code)}
          target="_blank"
          rel="noreferrer"
        >
          {lookupUrl(code.code)}
        </a>
      </figcaption>
    </figure>
  );
}

function QrSection({ level, onMessage }: { level: SchoolLevelCode; onMessage(message: string): void }) {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.timetableManage);
  const codes = useQuery({ queryKey: ['lookup-codes'], queryFn: listLookupCodes, enabled: canManage });
  const classes = useQuery({ queryKey: ['classes', 'level', level], queryFn: () => listLevelClasses(level) });
  const teachers = useQuery({ queryKey: ['substitute-teachers'], queryFn: listSubstituteTeachers, enabled: canManage });
  const [kind, setKind] = useState<'class' | 'teacher'>('class');
  const [targetId, setTargetId] = useState('');
  const create = useMutation({
    mutationFn: () => createLookupCode(kind, targetId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lookup-codes'] });
      onMessage('Đã tạo mã QR tra cứu');
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeLookupCode(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lookup-codes'] });
      onMessage('Đã thu hồi mã; đường dẫn cũ hết hiệu lực');
    },
  });
  if (!canManage) {
    return <Alert tone="info">Chỉ người lập thời khoá biểu tạo được mã QR tra cứu.</Alert>;
  }
  const options =
    kind === 'class'
      ? (classes.data ?? []).map((item) => [item.id, item.name] as const)
      : (teachers.data ?? []).map((item) => [item.teacher_user_id, item.teacher_name] as const);
  return (
    <section className="flex flex-col gap-3" aria-label="Mã QR tra cứu">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-label font-medium text-text">
          Tra cứu theo
          <select
            aria-label="Tra cứu theo"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as typeof kind);
              setTargetId('');
            }}
          >
            <option value="class">Lớp</option>
            <option value="teacher">Giáo viên</option>
          </select>
        </label>
        <label className="text-label font-medium text-text">
          {kind === 'class' ? 'Lớp' : 'Giáo viên'}
          <select
            aria-label={kind === 'class' ? 'Lớp của mã' : 'Giáo viên của mã'}
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
          >
            <option value="">Chọn</option>
            {options.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="primary" disabled={!targetId || create.isPending} onClick={() => create.mutate()}>
          Tạo mã QR
        </Button>
        <Button onClick={() => window.print()}>In mã QR</Button>
      </div>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Các mã QR">
        {(codes.data ?? []).map((code) => (
          <li key={code.id} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3">
            <QrImage code={code} />
            <Button variant="text" disabled={revoke.isPending} onClick={() => revoke.mutate(code.id)}>
              Thu hồi
            </Button>
          </li>
        ))}
      </ul>
      {codes.data && codes.data.length === 0 ? (
        <p className="text-content text-text-secondary">Chưa có mã QR tra cứu nào.</p>
      ) : null}
    </section>
  );
}

export function TimetableReportsPage() {
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.filter((level) => level.value !== 'MN');
  const level = levels[0]?.value;
  const [tab, setTab] = useState<Tab>('teaching');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const tabs: Array<[Tab, string]> = [
    ['teaching', 'Tiết dạy theo giáo viên'],
    ['rooms', 'Dùng phòng'],
    ['qr', 'Mã QR tra cứu'],
  ];
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text print:hidden">{menuPageTitle('/timetable-reports')}</h1>
        {!level ? (
          <Alert tone="info">Trường chưa bật cấp Tiểu học, THCS hoặc THPT; bật cấp học ở 1.4 Cấu hình trường.</Alert>
        ) : (
          <>
            <div role="tablist" className="flex flex-wrap gap-2 print:hidden">
              {tabs.map(([value, label]) => (
                <Button
                  key={value}
                  role="tab"
                  aria-selected={tab === value}
                  variant={tab === value ? 'primary' : 'secondary'}
                  onClick={() => setTab(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {tab === 'teaching' ? <TeachingReportSection /> : null}
            {tab === 'rooms' ? <RoomReportSection /> : null}
            {tab === 'qr' ? <QrSection level={level} onMessage={setToastMessage} /> : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
