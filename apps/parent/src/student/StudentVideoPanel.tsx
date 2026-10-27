import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, VideoRoom, type VideoJoinInfo } from '@school-management/ui';
import { requestStudentJson } from './student-api.js';

// Lớp video của học sinh (DT-27 phần 27a, YCTD-251; kênh student của 23a): buổi gia sư đang mở của chương trình đã được duyệt đơn;
// vào phòng (đợi ở phòng chờ nếu trường bật), nói và bật camera, chia sẻ màn hình khi gia sư cho
interface OpenRoom {
  room_id: string;
  title: string;
}

export function StudentVideoPanel() {
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [join, setJoin] = useState<VideoJoinInfo>();
  const [errorMessage, setErrorMessage] = useState<string>();
  useEffect(() => {
    requestStudentJson<OpenRoom[]>('/api/v1/student/video/rooms')
      .then(setRooms)
      .catch(() => setRooms([]));
  }, []);
  const enter = useCallback(async (roomId: string) => {
    try {
      setErrorMessage(undefined);
      setJoin(
        await requestStudentJson<VideoJoinInfo>(`/api/v1/student/video/rooms/${roomId}/join`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }),
      );
    } catch {
      setErrorMessage('Chưa vào được lớp video, thử lại sau ít phút');
    }
  }, []);
  useEffect(() => {
    if (join?.status !== 'waiting') {
      return undefined;
    }
    const timer = setInterval(() => void enter(join.room_id), 5000);
    return () => clearInterval(timer);
  }, [join, enter]);
  if (rooms.length === 0 && !join) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2" aria-label="Lớp video gia sư">
      <h2 className="text-section-title font-semibold">Lớp video gia sư</h2>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {join?.status === 'ready' ? <VideoRoom join={join} onLeave={() => setJoin(undefined)} /> : null}
      {join?.status === 'waiting' ? <Alert tone="info">Đang ở phòng chờ, gia sư sẽ cho vào.</Alert> : null}
      {!join
        ? rooms.map((room) => (
            <Button key={room.room_id} variant="primary" onClick={() => void enter(room.room_id)}>
              Vào lớp {room.title}
            </Button>
          ))
        : null}
    </section>
  );
}
