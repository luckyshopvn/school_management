import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS, VideoRoom, type VideoJoinInfo } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import { LiveSessionScreen } from './LiveSessionScreen.js';

// Giờ học trực tuyến, phòng nhóm (DT-28 phần 28g, YCTD-277): giáo viên tạo giờ học trực tuyến (hoạt động loại giờ học, giao
// ngay) rồi mở ở màn hình giờ học; phòng nhóm theo bộ nhóm của lớp: cho học sinh tự mở phòng, giáo viên mở phòng hoặc vào xem
interface GroupRoom {
  id: string;
  opened_by_name: string | null;
  opened_by_kind: string;
  present: unknown[];
}

interface LiveGroups {
  open_now: boolean;
  sets: Array<{
    id: string;
    name: string;
    student_open: boolean;
    groups: Array<{ id: string; name: string; member_count: number; room: GroupRoom | null }>;
  }>;
}

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

export function LiveScreen({
  spaceId,
  title,
  sectionId,
  onBack,
}: {
  spaceId: string;
  title: string;
  sectionId: string | undefined;
  onBack(): void;
}) {
  const [groups, setGroups] = useState<LiveGroups>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [sessionTitle, setSessionTitle] = useState('');
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState('45');
  const [sessionId, setSessionId] = useState<string>();
  const [join, setJoin] = useState<VideoJoinInfo>();
  const load = useCallback(() => {
    requestJson<LiveGroups>(`/api/v1/learning/spaces/${spaceId}/live-groups`)
      .then(setGroups)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [spaceId]);
  useEffect(load, [load]);
  const run = async (action: () => Promise<unknown>) => {
    setErrorMessage(undefined);
    try {
      await action();
      load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };
  const enter = (path: string) =>
    void run(async () => setJoin(await requestJson<VideoJoinInfo>(path, json('POST', {}))));
  if (sessionId) {
    return (
      <LiveSessionScreen
        activityId={sessionId}
        onBack={() => {
          setSessionId(undefined);
          load();
        }}
      />
    );
  }
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
      <div>
        <Button variant="text" onClick={onBack}>
          Quay lại
        </Button>
      </div>
      <h1 className="text-page-title font-bold text-text">{title}</h1>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {join ? (
        <VideoRoom
          join={join}
          roleLabel={join.role === 'host' ? 'Giáo viên' : 'Vào xem'}
          onLeave={() =>
            void run(async () => {
              await requestJson(`/api/v1/learning/live/rooms/${join.room_id}/leave`, json('POST', {}));
              setJoin(undefined);
            })
          }
        />
      ) : null}
      {sectionId ? (
        <form
          aria-label="Thêm giờ học trực tuyến"
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const created = await requestJson<{ id: string }>(
                `/api/v1/learning/spaces/${spaceId}/activities`,
                json('POST', {
                  section_id: sectionId,
                  kind: 'live_session',
                  title: sessionTitle,
                  opens_at: start ? new Date(start).toISOString() : null,
                  settings: { duration_minutes: Number(duration) },
                }),
              );
              await requestJson(`/api/v1/learning/activities/${created.id}/publish`, json('POST', { published: true }));
              setSessionTitle('');
              setStart('');
              setSessionId(created.id);
            });
          }}
        >
          <h2 className="text-section-title font-semibold text-text">Thêm giờ học trực tuyến</h2>
          <label className="text-label font-medium text-text">
            Tên giờ học
            <input
              className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
              value={sessionTitle}
              onChange={(event) => setSessionTitle(event.target.value)}
            />
          </label>
          <label className="text-label font-medium text-text">
            Bắt đầu lúc
            <input
              type="datetime-local"
              className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          <label className="text-label font-medium text-text">
            Thời lượng (phút)
            <input
              type="number"
              min={1}
              className={`mt-2 block w-full ${FORM_CONTROL_CLASS}`}
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
          </label>
          <div>
            <Button type="submit" disabled={!sessionTitle}>
              Tạo giờ học
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-content text-text-secondary">Chưa có chương nào. Thêm chương ở cổng quản trị.</p>
      )}
      <section aria-label="Phòng nhóm" className="flex flex-col gap-3">
        <h2 className="text-section-title font-semibold text-text">Phòng nhóm</h2>
        {groups && !groups.open_now ? (
          <Alert tone="info">Ngoài giờ mở của trường: học sinh chỉ vào được phòng giáo viên mở.</Alert>
        ) : null}
        {groups && groups.sets.length === 0 ? (
          <p className="text-content text-text-secondary">Lớp chưa có bộ nhóm. Chia nhóm ở công cụ lớp học.</p>
        ) : null}
        {(groups?.sets ?? []).map((set) => (
          <div key={set.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
            <h3 className="text-content font-semibold">{set.name}</h3>
            <label className="flex items-center gap-2 text-label text-text">
              <input
                type="checkbox"
                checked={set.student_open}
                onChange={(event) =>
                  void run(() =>
                    requestJson(
                      `/api/v1/learning/live/group-sets/${set.id}`,
                      json('PUT', { student_open: event.target.checked }),
                    ),
                  )
                }
              />
              Cho học sinh tự mở phòng của {set.name}
            </label>
            <ul className="flex flex-col gap-2">
              {set.groups.map((group) => (
                <li key={group.id} className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 text-content">
                    {group.name} · {group.member_count} học sinh
                    {group.room ? ` · Đang mở · ${group.room.present.length} người` : ''}
                  </span>
                  {group.room ? (
                    <Button onClick={() => enter(`/api/v1/learning/live/rooms/${group.room?.id}/join`)}>
                      Vào xem {group.name}
                    </Button>
                  ) : (
                    <Button onClick={() => enter(`/api/v1/learning/live/groups/${group.id}/open`)}>
                      Mở phòng {group.name}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}
