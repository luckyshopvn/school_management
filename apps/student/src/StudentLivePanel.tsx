import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS, VideoRoom, type VideoJoinInfo } from '@school-management/ui';
import { requestStudentJson, StudentApiError } from './student-api.js';

// Giờ học trực tuyến và phòng nhóm của học sinh (DT-28 phần 28g, YCTD-277; kênh student của 23a): vào giờ học giáo viên đã mở,
// sang phòng chia nhỏ, gọi giáo viên, nhận thông báo; mở hoặc vào phòng nhóm trong giờ mở của trường; luôn thấy khi giáo viên
// đang xem phòng (GD-149); báo cáo phòng tới nhà trường
interface LiveOverview {
  open_now: boolean;
  sessions: Array<{
    id: string;
    title: string;
    space: string;
    opens_at: string | null;
    room_id: string | null;
    breakout: { id: string; title: string; ends_at: string | null } | null;
  }>;
  groups: Array<{
    id: string;
    name: string;
    group_set_name: string;
    room: { id: string; opened_by_kind: string } | null;
    can_open: boolean;
    can_join: boolean;
  }>;
}

interface RoomState {
  id: string;
  kind: string;
  title: string;
  status: string;
  ends_at: string | null;
  teacher_watching: boolean;
  notices: Array<{ id: string; body: string; sent_by_name: string; created_at: string }>;
  breakout: { id: string; title: string; ends_at: string | null } | null;
  moved_to: string | null;
  parent_room_id: string | null;
}

const messageOf = (error: unknown) =>
  error instanceof StudentApiError ? error.message : 'Chưa vào được phòng, thử lại sau ít phút';
const post = (body: unknown = {}) => ({ method: 'POST', body: JSON.stringify(body) });

export function StudentLivePanel() {
  const [overview, setOverview] = useState<LiveOverview>();
  const [join, setJoin] = useState<VideoJoinInfo>();
  const [state, setState] = useState<RoomState>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [helpSent, setHelpSent] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [reported, setReported] = useState(false);
  const loadOverview = useCallback(() => {
    requestStudentJson<LiveOverview>('/api/v1/student/live')
      .then(setOverview)
      .catch(() => setOverview(undefined));
  }, []);
  useEffect(() => {
    if (join) {
      return undefined;
    }
    loadOverview();
    const timer = setInterval(loadOverview, 10000);
    return () => clearInterval(timer);
  }, [join, loadOverview]);
  const roomId = join?.room_id;
  useEffect(() => {
    if (!roomId) {
      return undefined;
    }
    const poll = () =>
      requestStudentJson<RoomState>(`/api/v1/student/live/rooms/${roomId}`)
        .then(setState)
        .catch(() => undefined);
    void poll();
    const timer = setInterval(() => void poll(), 5000);
    return () => clearInterval(timer);
  }, [roomId]);
  const enter = async (path: string) => {
    try {
      setErrorMessage(undefined);
      const next = await requestStudentJson<VideoJoinInfo>(path, post());
      setState(undefined);
      setHelpSent(false);
      setReporting(false);
      setReported(false);
      setJoin(next);
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  const backToList = () => {
    setJoin(undefined);
    setState(undefined);
  };
  const leave = async () => {
    if (join) {
      await requestStudentJson(`/api/v1/student/live/rooms/${join.room_id}/leave`, post()).catch(() => undefined);
    }
    backToList();
  };
  const action = async (run: () => Promise<unknown>, done: () => void) => {
    try {
      setErrorMessage(undefined);
      await run();
      done();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  const sessions = overview?.sessions ?? [];
  const groups = overview?.groups ?? [];
  if (sessions.length === 0 && groups.length === 0 && !join) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2" aria-label="Học trực tuyến trực tiếp">
      <h2 className="text-section-title font-semibold">Giờ học trực tuyến và phòng nhóm</h2>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {join ? (
        <>
          {state?.teacher_watching ? (
            <p role="status" className="self-start rounded-full bg-red-600 px-3 py-1 text-label font-medium text-white">
              Giáo viên đang xem phòng này
            </p>
          ) : null}
          {(state?.notices ?? []).map((notice) => (
            <Alert key={notice.id} tone="info">
              Thông báo của {notice.sent_by_name}: {notice.body}
            </Alert>
          ))}
          {state?.kind === 'live_session' && state.breakout ? (
            <>
              <Alert tone="info">Giáo viên đã chia phòng.</Alert>
              <div>
                <Button
                  variant="primary"
                  onClick={() => void enter(`/api/v1/student/live/rooms/${state.breakout?.id}/join`)}
                >
                  Sang phòng {state.breakout.title}
                </Button>
              </div>
            </>
          ) : null}
          {state?.kind === 'breakout' ? (
            <>
              {state.ends_at ? (
                <p className="text-label text-text-secondary">
                  Phòng kết thúc lúc{' '}
                  {new Date(state.ends_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              ) : null}
              {state.status === 'ended' ? (
                <>
                  <Alert tone="info">Phòng chia nhỏ đã kết thúc.</Alert>
                  {state.parent_room_id ? (
                    <div>
                      <Button
                        variant="primary"
                        onClick={() => void enter(`/api/v1/student/live/rooms/${state.parent_room_id}/join`)}
                      >
                        Về phòng giờ học
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div>
                  {helpSent ? (
                    <p className="text-label">Đã gọi giáo viên, thầy cô sẽ vào phòng</p>
                  ) : (
                    <Button
                      onClick={() =>
                        void action(
                          () => requestStudentJson(`/api/v1/student/live/rooms/${state.id}/help`, post()),
                          () => setHelpSent(true),
                        )
                      }
                    >
                      Gọi giáo viên
                    </Button>
                  )}
                </div>
              )}
              {state.moved_to ? (
                <>
                  <Alert tone="info">Giáo viên đã chuyển em sang phòng khác.</Alert>
                  <div>
                    <Button
                      variant="primary"
                      onClick={() => void enter(`/api/v1/student/live/rooms/${state.moved_to}/join`)}
                    >
                      Sang phòng mới
                    </Button>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
          {state && state.kind !== 'breakout' && state.status === 'ended' ? (
            <>
              <Alert tone="info">Phòng đã kết thúc.</Alert>
              <div>
                <Button onClick={backToList}>Về danh sách phòng</Button>
              </div>
            </>
          ) : null}
          <VideoRoom join={join} roleLabel="Học sinh" onLeave={() => void leave()} />
          {reported ? (
            <p className="text-label">Đã gửi báo cáo tới nhà trường</p>
          ) : reporting ? (
            <form
              aria-label="Báo cáo phòng"
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void action(
                  () => requestStudentJson(`/api/v1/student/live/rooms/${join.room_id}/report`, post({ reason })),
                  () => {
                    setReported(true);
                    setReporting(false);
                    setReason('');
                  },
                );
              }}
            >
              <label className="text-label font-medium">
                Lý do báo cáo
                <textarea
                  className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <div>
                <Button type="submit" disabled={!reason}>
                  Gửi báo cáo
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <Button variant="text" onClick={() => setReporting(true)}>
                Báo cáo phòng này
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          {overview && !overview.open_now ? (
            <Alert tone="info">Ngoài giờ mở của trường, phòng nhóm chỉ đọc.</Alert>
          ) : null}
          {sessions.map((session) => (
            <article key={session.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
              <span className="text-content font-semibold">{session.title}</span>
              <span className="text-label text-text-secondary">{session.space}</span>
              {session.breakout ? (
                <div>
                  <Button
                    variant="primary"
                    onClick={() => void enter(`/api/v1/student/live/rooms/${session.breakout?.id}/join`)}
                  >
                    Vào phòng chia nhỏ {session.breakout.title}
                  </Button>
                </div>
              ) : session.room_id ? (
                <div>
                  <Button
                    variant="primary"
                    onClick={() => void enter(`/api/v1/student/live/activities/${session.id}/join`)}
                  >
                    Vào giờ học {session.title}
                  </Button>
                </div>
              ) : (
                <span className="text-label">Giáo viên chưa mở phòng</span>
              )}
            </article>
          ))}
          {groups.map((group) => (
            <article key={group.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
              <span className="text-content font-semibold">{group.name}</span>
              <span className="text-label text-text-secondary">{group.group_set_name}</span>
              {group.room && group.can_join ? (
                <div>
                  <Button onClick={() => void enter(`/api/v1/student/live/rooms/${group.room?.id}/join`)}>
                    Vào phòng nhóm {group.name}
                  </Button>
                </div>
              ) : group.can_open ? (
                <div>
                  <Button onClick={() => void enter(`/api/v1/student/live/groups/${group.id}/open`)}>
                    Mở phòng nhóm {group.name}
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
