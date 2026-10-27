import { useCallback, useEffect, useState } from 'react';
import { VIDEO_RECORDING_CONSENT_TEXT } from '@school-management/shared';
import { Alert, Button, VideoRoom, type VideoJoinInfo } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Lớp video của con (DT-27 phần 27a, YCTD-251): cha mẹ vào xem buổi đang mở (nói khi gia sư cho), đợi ở phòng chờ nếu trường bật;
// đồng ý hoặc rút đồng ý ghi hình theo từng chương trình có ghi hình
interface OpenRoom {
  room_id: string;
  title: string;
  session_id: string;
}

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');
const post = (path: string, body: object = {}) =>
  requestJson<VideoJoinInfo>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

export function ChildVideoPanel({
  child,
  programs,
}: {
  child: { id: string; full_name: string };
  programs: Array<{ id: string; name: string; recording_enabled?: boolean; registered: boolean }>;
}) {
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [consents, setConsents] = useState<string[]>([]);
  const [join, setJoin] = useState<VideoJoinInfo>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const load = useCallback(async () => {
    try {
      setRooms(await requestJson<OpenRoom[]>(`/api/v1/children/${child.id}/video/rooms`));
      setConsents(
        (await requestJson<Array<{ program_id: string }>>(`/api/v1/children/${child.id}/video/consents`)).map(
          (row) => row.program_id,
        ),
      );
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  }, [child.id]);
  useEffect(() => {
    void load();
  }, [load]);
  const enter = useCallback(
    async (roomId: string) => {
      try {
        setErrorMessage(undefined);
        setJoin(await post(`/api/v1/children/${child.id}/video/rooms/${roomId}/join`));
      } catch (error) {
        setErrorMessage(messageOf(error));
      }
    },
    [child.id],
  );
  // Đang ở phòng chờ: hỏi lại mỗi 5 giây đến khi gia sư cho vào
  useEffect(() => {
    if (join?.status !== 'waiting') {
      return undefined;
    }
    const timer = setInterval(() => void enter(join.room_id), 5000);
    return () => clearInterval(timer);
  }, [join, enter]);
  const recordable = programs.filter((program) => program.registered && program.recording_enabled);
  return (
    <section className="flex flex-col gap-2" aria-label={`Lớp video của ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {join?.status === 'ready' ? (
        <VideoRoom join={join} onLeave={() => setJoin(undefined)} />
      ) : join?.status === 'waiting' ? (
        <Alert tone="info">Đang ở phòng chờ, gia sư sẽ cho vào.</Alert>
      ) : null}
      {rooms.length > 0 && !join ? (
        <ul className="flex flex-col gap-2" aria-label="Lớp video đang mở">
          {rooms.map((room) => (
            <li
              key={room.room_id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
            >
              <span>{room.title}</span>
              <Button variant="primary" onClick={() => void enter(room.room_id)}>
                Vào xem lớp {room.title}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {recordable.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h4 className="text-label font-semibold">Ghi hình lớp video</h4>
          <p className="text-label text-text-secondary">{VIDEO_RECORDING_CONSENT_TEXT}</p>
          {recordable.map((program) => (
            <label key={program.id} className="flex items-center gap-2 text-label">
              <input
                type="checkbox"
                checked={consents.includes(program.id)}
                onChange={(event) => {
                  // Đổi ngay trên màn hình, ghi lên máy chủ sau; máy chủ từ chối thì trả lại như cũ
                  const agree = event.target.checked;
                  const previous = consents;
                  setConsents(agree ? [...previous, program.id] : previous.filter((id) => id !== program.id));
                  void requestJson(`/api/v1/children/${child.id}/video/consents/${program.id}`, {
                    method: 'PUT',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ agree }),
                  })
                    .then(load)
                    .catch((error: unknown) => {
                      setConsents(previous);
                      setErrorMessage(messageOf(error));
                    });
                }}
              />
              Đồng ý ghi hình {program.name}
            </label>
          ))}
        </div>
      ) : null}
    </section>
  );
}
