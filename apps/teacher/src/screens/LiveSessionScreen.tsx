import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS, VideoRoom, type VideoJoinInfo } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Giờ học trực tuyến (DT-28 phần 28g, YCTD-277): giáo viên mở phòng giờ học, vào phòng, kết thúc; chia phòng chia nhỏ (ngẫu
// nhiên hoặc theo bộ nhóm của lớp), vào từng phòng, hỗ trợ học sinh gọi, chuyển học sinh, gửi thông báo tới mọi phòng, gọi tất
// cả về phòng chính; điểm danh gợi ý theo thời gian có mặt, giáo viên xác nhận
interface Participant {
  identity: string;
  role: string;
  display_name: string;
}

interface Breakout {
  id: string;
  title: string;
  group_id: string | null;
  ends_at: string | null;
  members: Array<{ child_id: string; full_name: string }>;
  present: Participant[];
  help: Array<{ id: string; room_id: string; child_id: string; child_name: string; created_at: string }>;
}

interface AttendanceRow {
  child_id: string;
  full_name: string;
  minutes: number;
  first_join: string | null;
  suggestion: 'present' | 'partial' | 'absent';
  result: string | null;
}

interface LiveSession {
  activity: { id: string; title: string; status: string; opens_at: string | null; duration_minutes: number };
  room: { id: string; status: string; participants: Participant[] } | null;
  breakouts: Breakout[];
  notices: Array<{ id: string; body: string; sent_by_name: string; created_at: string }>;
  attendance: AttendanceRow[];
  group_sets: Array<{ id: string; name: string }>;
}

type AttendanceStatus = 'present' | 'absent' | 'excused';

const SUGGESTION_LABELS: Record<AttendanceRow['suggestion'], string> = {
  present: 'Có mặt',
  partial: 'Vào muộn hoặc ra sớm',
  absent: 'Vắng',
};

// Kết quả đã ghi (completed, not_started, excused) đổi về lựa chọn điểm danh; chưa ghi thì theo gợi ý
const defaultStatus = (row: AttendanceRow): AttendanceStatus => {
  if (row.result === 'completed') return 'present';
  if (row.result === 'not_started') return 'absent';
  if (row.result === 'excused') return 'excused';
  return row.suggestion === 'absent' ? 'absent' : 'present';
};

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });

export function LiveSessionScreen({ activityId, onBack }: { activityId: string; onBack(): void }) {
  const [data, setData] = useState<LiveSession>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const [join, setJoin] = useState<VideoJoinInfo>();
  const [groupSetId, setGroupSetId] = useState('');
  const [count, setCount] = useState('2');
  const [minutes, setMinutes] = useState('10');
  const [moveChild, setMoveChild] = useState('');
  const [moveRoom, setMoveRoom] = useState('');
  const [notice, setNotice] = useState('');
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const load = useCallback(() => {
    requestJson<LiveSession>(`/api/v1/learning/activities/${activityId}/live`)
      .then(setData)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [activityId]);
  useEffect(load, [load]);
  const roomOpen = data?.room != null;
  useEffect(() => {
    if (!roomOpen) {
      return undefined;
    }
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [roomOpen, load]);
  const run = async (action: () => Promise<unknown>) => {
    setErrorMessage(undefined);
    try {
      await action();
      load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  const enter = (path: string) => void run(async () => setJoin(await requestJson<VideoJoinInfo>(path, post({}))));
  const room = data?.room ?? null;
  const breakouts = data?.breakouts ?? [];
  const students = breakouts.flatMap((breakout) => breakout.members);
  const statusOf = (row: AttendanceRow) => marks[row.child_id] ?? defaultStatus(row);
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
      <div>
        <Button variant="text" onClick={onBack}>
          Quay lại
        </Button>
      </div>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {data ? (
        <>
          <h1 className="text-page-title font-bold text-text">{data.activity.title}</h1>
          <p className="text-label text-text-secondary">
            {data.activity.opens_at ? `${new Date(data.activity.opens_at).toLocaleString('vi-VN')} · ` : ''}
            {data.activity.duration_minutes} phút
          </p>
          {join ? (
            <VideoRoom
              join={join}
              roleLabel={join.role === 'host' ? 'Giáo viên' : 'Vào xem'}
              onLeave={() =>
                void run(async () => {
                  await requestJson(`/api/v1/learning/live/rooms/${join.room_id}/leave`, post({}));
                  setJoin(undefined);
                })
              }
            />
          ) : null}
          {room ? (
            <>
              <p className="text-content">Đang trong phòng: {room.participants.length} người</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => enter(`/api/v1/learning/live/rooms/${room.id}/join`)}>
                  Vào phòng giờ học
                </Button>
                <Button
                  variant="danger"
                  onClick={() =>
                    void run(async () => {
                      await requestJson(`/api/v1/learning/live/rooms/${room.id}/end`, post({}));
                      setJoin(undefined);
                    })
                  }
                >
                  Kết thúc giờ học
                </Button>
              </div>
              <section aria-label="Phòng chia nhỏ" className="flex flex-col gap-3">
                <h2 className="text-section-title font-semibold text-text">Phòng chia nhỏ</h2>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-label font-medium text-text">
                    Chia theo
                    <select
                      className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                      value={groupSetId}
                      onChange={(event) => setGroupSetId(event.target.value)}
                    >
                      <option value="">Ngẫu nhiên</option>
                      {data.group_sets.map((set) => (
                        <option key={set.id} value={set.id}>
                          {set.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {groupSetId === '' ? (
                    <label className="text-label font-medium text-text">
                      Số phòng
                      <input
                        type="number"
                        min={1}
                        className={`mt-2 block w-24 ${FORM_CONTROL_CLASS}`}
                        value={count}
                        onChange={(event) => setCount(event.target.value)}
                      />
                    </label>
                  ) : null}
                  <label className="text-label font-medium text-text">
                    Thời lượng phòng chia nhỏ (phút)
                    <input
                      type="number"
                      min={1}
                      className={`mt-2 block w-24 ${FORM_CONTROL_CLASS}`}
                      value={minutes}
                      onChange={(event) => setMinutes(event.target.value)}
                    />
                  </label>
                  <Button
                    onClick={() =>
                      void run(() =>
                        requestJson(
                          `/api/v1/learning/live/rooms/${room.id}/breakouts`,
                          post({
                            ...(groupSetId ? { group_set_id: groupSetId } : { count: Number(count) }),
                            minutes: Number(minutes),
                          }),
                        ),
                      )
                    }
                  >
                    Chia phòng
                  </Button>
                </div>
                {breakouts.map((breakout) => (
                  <div
                    key={breakout.id}
                    aria-label={breakout.title}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
                  >
                    <span className="text-content font-semibold">{breakout.title}</span>
                    <span className="text-label text-text-secondary">
                      {breakout.members.map((member) => member.full_name).join(', ')}
                    </span>
                    <span className="text-label">Đang trong phòng: {breakout.present.length}</span>
                    {breakout.help.map((help) => (
                      <div key={help.id} className="flex flex-wrap items-center gap-2">
                        <span className="text-content font-medium">{help.child_name} đang gọi giáo viên</span>
                        <Button
                          variant="text"
                          onClick={() =>
                            void run(() => requestJson(`/api/v1/learning/live/help/${help.id}/resolve`, post({})))
                          }
                        >
                          Đã đến hỗ trợ
                        </Button>
                      </div>
                    ))}
                    <div>
                      <Button onClick={() => enter(`/api/v1/learning/live/rooms/${breakout.id}/join`)}>
                        Vào phòng {breakout.title}
                      </Button>
                    </div>
                  </div>
                ))}
                {breakouts.length > 0 ? (
                  <>
                    <form
                      aria-label="Chuyển học sinh"
                      className="flex flex-wrap items-end gap-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void run(() =>
                          requestJson(
                            `/api/v1/learning/live/rooms/${room.id}/move`,
                            post({ child_id: moveChild, room_id: moveRoom }),
                          ),
                        );
                      }}
                    >
                      <h3 className="w-full text-content font-semibold">Chuyển học sinh</h3>
                      <label className="text-label font-medium text-text">
                        Học sinh
                        <select
                          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                          value={moveChild}
                          onChange={(event) => setMoveChild(event.target.value)}
                        >
                          <option value="">Chọn học sinh</option>
                          {students.map((student) => (
                            <option key={student.child_id} value={student.child_id}>
                              {student.full_name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-label font-medium text-text">
                        Sang phòng
                        <select
                          className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                          value={moveRoom}
                          onChange={(event) => setMoveRoom(event.target.value)}
                        >
                          <option value="">Chọn phòng</option>
                          {breakouts.map((breakout) => (
                            <option key={breakout.id} value={breakout.id}>
                              {breakout.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button type="submit" disabled={!moveChild || !moveRoom}>
                        Chuyển
                      </Button>
                    </form>
                    <div>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          void run(() =>
                            requestJson(`/api/v1/learning/live/rooms/${room.id}/breakouts/close`, post({})),
                          )
                        }
                      >
                        Gọi tất cả về phòng chính
                      </Button>
                    </div>
                  </>
                ) : null}
                <form
                  aria-label="Gửi thông báo"
                  className="flex flex-col gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      await requestJson(`/api/v1/learning/live/rooms/${room.id}/notices`, post({ body: notice }));
                      setNotice('');
                    });
                  }}
                >
                  <label className="text-label font-medium text-text">
                    Thông báo tới mọi phòng
                    <textarea
                      className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
                      rows={2}
                      value={notice}
                      onChange={(event) => setNotice(event.target.value)}
                    />
                  </label>
                  <div>
                    <Button type="submit" disabled={!notice}>
                      Gửi thông báo
                    </Button>
                  </div>
                </form>
                {data.notices.length > 0 ? (
                  <ul className="flex flex-col gap-1 text-label" aria-label="Thông báo đã gửi">
                    {data.notices.map((item) => (
                      <li key={item.id}>
                        {new Date(item.created_at).toLocaleTimeString('vi-VN')} · {item.sent_by_name}: {item.body}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            </>
          ) : (
            <div>
              <Button variant="primary" onClick={() => enter(`/api/v1/learning/activities/${activityId}/live/open`)}>
                Mở phòng giờ học
              </Button>
            </div>
          )}
          <section aria-label="Điểm danh giờ học" className="flex flex-col gap-2">
            <h2 className="text-section-title font-semibold text-text">Điểm danh giờ học</h2>
            {statusMessage ? (
              <p role="status" className="text-label text-text-secondary">
                {statusMessage}
              </p>
            ) : null}
            <ul className="flex flex-col gap-2">
              {data.attendance.map((row) => (
                <li
                  key={row.child_id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3"
                >
                  <span className="flex-1 text-content font-semibold">{row.full_name}</span>
                  <span className="text-label text-text-secondary">
                    {row.minutes} phút · {SUGGESTION_LABELS[row.suggestion]}
                  </span>
                  <select
                    aria-label={`Điểm danh ${row.full_name}`}
                    className={FORM_CONTROL_CLASS}
                    value={statusOf(row)}
                    onChange={(event) => setMarks({ ...marks, [row.child_id]: event.target.value as AttendanceStatus })}
                  >
                    <option value="present">Có mặt</option>
                    <option value="absent">Vắng</option>
                    <option value="excused">Có phép</option>
                  </select>
                  {row.result !== null ? <span className="text-label text-text-secondary">Đã ghi</span> : null}
                </li>
              ))}
            </ul>
            {data.attendance.length > 0 ? (
              <div>
                <Button
                  variant="primary"
                  onClick={() =>
                    void run(async () => {
                      setStatusMessage(undefined);
                      await requestJson(
                        `/api/v1/learning/activities/${activityId}/live/attendance`,
                        post({
                          entries: data.attendance.map((row) => ({ child_id: row.child_id, status: statusOf(row) })),
                        }),
                      );
                      setMarks({});
                      setStatusMessage('Đã ghi điểm danh');
                    })
                  }
                >
                  Xác nhận điểm danh
                </Button>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
