import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { seatCapacity, type SchoolLevelCode, type SeatAssignment } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError, requestJson } from '../session/api-client.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import { DRAG_TYPE, placeChild, SeatingGrid } from './SeatingGrid.js';
import {
  createSeatingChart,
  deleteSeatingChart,
  listSeatingCharts,
  printSeatingChart,
  readSeatingChart,
  updateSeatingChart,
  type SeatingChartDetail,
} from './seating-api.js';

// 7.16 Sơ đồ chỗ ngồi (DT-21 phần 21d, YCTD-171): chọn lớp THCS, THPT, xem các bản sơ đồ theo ngày áp dụng (bản đang dùng
// đánh dấu), lập bản mới (xếp theo tên, xoay vòng từ bản đang chọn theo dãy hoặc theo bàn, hoặc để trống rồi tự xếp), kéo
// thả học sinh vào chỗ, lưu, in PDF. Giáo viên chủ nhiệm và người có quyền xếp sơ đồ sửa được; người khác chỉ xem
const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
const todayInVietnam = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const dateText = (date: string) => date.split('-').reverse().join('/');
const SECONDARY: SchoolLevelCode[] = ['THCS', 'THPT'];

function useSecondaryClasses() {
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.map((level) => level.value).filter((level) => SECONDARY.includes(level));
  return useQuery({
    queryKey: ['classes', 'seating-levels', levels.join(',')],
    queryFn: async () =>
      (
        await Promise.all(
          levels.map((level) =>
            requestJson<Array<{ id: string; name: string; school_level: SchoolLevelCode }>>(
              `/api/v1/classes?school_level=${level}&status=active`,
            ),
          ),
        )
      ).flat(),
    enabled: levels.length > 0,
  });
}

function NewChartForm({
  classId,
  level,
  fromChart,
  onCreated,
}: {
  classId: string;
  level: SchoolLevelCode;
  fromChart: SeatingChartDetail | undefined;
  onCreated(chart: SeatingChartDetail): void;
}) {
  const [effective, setEffective] = useState(todayInVietnam());
  const [columns, setColumns] = useState(String(fromChart?.desk_columns ?? 4));
  const [rows, setRows] = useState(String(fromChart?.desk_rows ?? 6));
  const [seats, setSeats] = useState(String(fromChart?.seats_per_desk ?? 2));
  const [subjectId, setSubjectId] = useState('');
  const [mode, setMode] = useState<'by_name' | 'rotate_columns' | 'rotate_rows' | 'manual'>('by_name');
  const subjects = useQuery({
    queryKey: ['subjects', level],
    queryFn: () => requestJson<Array<{ id: string; name: string }>>(`/api/v1/subjects?school_level=${level}`),
  });
  const create = useMutation({
    mutationFn: () =>
      createSeatingChart({
        class_id: classId,
        subject_id: subjectId || null,
        effective_from: effective,
        desk_columns: Number(columns),
        desk_rows: Number(rows),
        seats_per_desk: Number(seats),
        mode: mode.startsWith('rotate') ? 'rotate' : (mode as 'by_name' | 'manual'),
        from_chart_id: mode.startsWith('rotate') ? (fromChart?.id ?? null) : null,
        rotate: mode === 'rotate_rows' ? 'rows' : 'columns',
      }),
    onSuccess: onCreated,
  });
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Lập sơ đồ mới">
      <h2 className="text-section-title font-semibold text-text">Lập sơ đồ mới</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-label font-medium text-text">
          Ngày áp dụng
          <input
            type="date"
            aria-label="Ngày áp dụng"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={effective}
            onChange={(event) => setEffective(event.target.value)}
          />
        </label>
        {(
          [
            ['Số dãy', columns, setColumns, 8],
            ['Số bàn mỗi dãy', rows, setRows, 15],
            ['Số chỗ mỗi bàn', seats, setSeats, 4],
          ] as const
        ).map(([label, value, setValue, max]) => (
          <label key={label} className="text-label font-medium text-text">
            {label}
            <input
              type="number"
              min={1}
              max={max}
              aria-label={label}
              className={`mt-2 block w-24 ${FORM_CONTROL_CLASS}`}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
        ))}
        <label className="text-label font-medium text-text">
          Áp dụng cho
          <select
            aria-label="Áp dụng cho"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
          >
            <option value="">Cả lớp (mọi môn)</option>
            {(subjects.data ?? []).map((subject) => (
              <option key={subject.id} value={subject.id}>
                Riêng môn {subject.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label font-medium text-text">
          Cách xếp
          <select
            aria-label="Cách xếp"
            className={`mt-2 block ${FORM_CONTROL_CLASS}`}
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
          >
            <option value="by_name">Theo danh sách tên</option>
            {fromChart ? <option value="rotate_columns">Xoay vòng theo dãy từ bản đang chọn</option> : null}
            {fromChart ? <option value="rotate_rows">Xoay vòng theo bàn từ bản đang chọn</option> : null}
            <option value="manual">Để trống, tự xếp</option>
          </select>
        </label>
        <Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
          Lập sơ đồ
        </Button>
      </div>
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
    </section>
  );
}

export function SeatingPage() {
  const queryClient = useQueryClient();
  const classes = useSecondaryClasses();
  const [classId, setClassId] = useState('');
  const [chartId, setChartId] = useState('');
  const [draft, setDraft] = useState<SeatAssignment[]>([]);
  const [selected, setSelected] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const list = useQuery({
    queryKey: ['seating-charts', classId],
    queryFn: () => listSeatingCharts(classId),
    enabled: Boolean(classId),
  });
  const shownId = chartId || list.data?.current_chart_id || list.data?.charts[0]?.id || '';
  const chart = useQuery({
    queryKey: ['seating-chart', shownId],
    queryFn: () => readSeatingChart(shownId),
    enabled: Boolean(shownId),
  });
  useEffect(() => {
    setDraft(
      (chart.data?.assignments ?? []).map(({ child_id, column_no, row_no, seat_no }) => ({
        child_id,
        column_no,
        row_no,
        seat_no,
      })),
    );
    setSelected(undefined);
  }, [chart.data]);
  const refresh = async (nextChartId?: string) => {
    if (nextChartId) {
      setChartId(nextChartId);
    }
    await queryClient.invalidateQueries({ queryKey: ['seating-charts'] });
    await queryClient.invalidateQueries({ queryKey: ['seating-chart'] });
  };
  const save = useMutation({
    mutationFn: () => {
      const current = chart.data as SeatingChartDetail;
      return updateSeatingChart(current.id, {
        effective_from: current.effective_from,
        desk_columns: current.desk_columns,
        desk_rows: current.desk_rows,
        seats_per_desk: current.seats_per_desk,
        note: current.note,
        assignments: draft,
      });
    },
    onSuccess: async () => {
      await refresh();
      setToastMessage('Đã lưu sơ đồ chỗ ngồi');
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteSeatingChart(shownId),
    onSuccess: async () => {
      setChartId('');
      await refresh();
      setToastMessage('Đã xoá bản sơ đồ');
    },
  });
  const names = Object.fromEntries((list.data?.students ?? []).map((student) => [student.id, student.full_name]));
  const placed = new Set(draft.map((seat) => seat.child_id));
  const unplaced = (list.data?.students ?? []).filter((student) => !placed.has(student.id));
  const canManage = Boolean(list.data?.can_manage);
  const classLevel = (classes.data ?? []).find((item) => item.id === classId)?.school_level ?? 'THCS';
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/seating-charts')}</h1>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-label font-medium text-text">
            Lớp
            <select
              aria-label="Lớp"
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                setChartId('');
              }}
            >
              <option value="">Chọn lớp</option>
              {(classes.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {list.data && list.data.charts.length > 0 ? (
            <label className="text-label font-medium text-text">
              Bản sơ đồ
              <select
                aria-label="Bản sơ đồ"
                className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                value={shownId}
                onChange={(event) => setChartId(event.target.value)}
              >
                {list.data.charts.map((item) => (
                  <option key={item.id} value={item.id}>
                    Từ {dateText(item.effective_from)}
                    {item.subject_name ? ` · môn ${item.subject_name}` : ''}
                    {item.id === list.data?.current_chart_id ? ' (đang dùng)' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {list.error ? <Alert tone="danger">{messageOf(list.error)}</Alert> : null}
        {list.data && list.data.charts.length === 0 ? (
          <p className="text-content text-text-secondary">Lớp chưa có sơ đồ chỗ ngồi.</p>
        ) : null}
        {chart.data ? (
          <section className="flex flex-col gap-3" aria-label="Sơ đồ đang xem">
            <p className="text-content text-text-secondary">
              {chart.data.desk_columns} dãy, {chart.data.desk_rows} bàn mỗi dãy, {chart.data.seats_per_desk} chỗ mỗi bàn
              ({seatCapacity(chart.data)} chỗ, lớp có {list.data?.students.length ?? 0} học sinh)
              {chart.data.updated_by_name ? ` · Người xếp: ${chart.data.updated_by_name}` : ''}
            </p>
            {canManage ? (
              <div
                className="flex flex-wrap gap-2 rounded-lg border border-dashed border-border p-2"
                role="group"
                aria-label="Học sinh chưa xếp chỗ"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const dragged = event.dataTransfer.getData(DRAG_TYPE);
                  setDraft(draft.filter((seat) => seat.child_id !== dragged));
                }}
              >
                <span className="text-label text-text-secondary">Chưa xếp chỗ:</span>
                {unplaced.length === 0 ? <span className="text-label text-text-secondary">không có</span> : null}
                {unplaced.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    draggable
                    aria-pressed={selected === student.id}
                    onDragStart={(event) => event.dataTransfer.setData(DRAG_TYPE, student.id)}
                    onClick={() => setSelected(selected === student.id ? undefined : student.id)}
                    className={`rounded-md border px-2 py-1 text-content ${
                      selected === student.id ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                  >
                    {student.full_name}
                  </button>
                ))}
              </div>
            ) : null}
            <SeatingGrid
              layout={chart.data}
              assignments={draft}
              names={names}
              selected={canManage ? selected : undefined}
              onSelect={canManage ? setSelected : undefined}
              onPlace={canManage ? (childId, seat) => setDraft(placeChild(draft, childId, seat)) : undefined}
            />
            <div className="flex flex-wrap gap-2">
              {canManage ? (
                <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                  Lưu sơ đồ
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  setActionError(undefined);
                  printSeatingChart(shownId, 'pdf').catch((error: unknown) => setActionError(messageOf(error)));
                }}
              >
                In sơ đồ
              </Button>
              {canManage ? (
                <Button
                  variant="text"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm('Xoá bản sơ đồ này?')) {
                      remove.mutate();
                    }
                  }}
                >
                  Xoá bản này
                </Button>
              ) : null}
            </div>
            {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
            {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
            {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
          </section>
        ) : null}
        {classId && canManage ? (
          <NewChartForm
            key={`${classId}:${shownId}`}
            classId={classId}
            level={classLevel}
            fromChart={chart.data}
            onCreated={async (created) => {
              await refresh(created.id);
              setToastMessage('Đã lập sơ đồ chỗ ngồi');
            }}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
