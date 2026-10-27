import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  VideoHostPanel,
  VideoRecordingList,
  VideoRoom,
  type VideoJoinInfo,
} from '@school-management/ui';
import { messageOf } from './TutoringProgramsPage.js';
import { videoApi } from './video-api.js';

// Lớp video của một buổi gia sư (DT-27 phần 27a, YCTD-251): giáo viên dạy hoặc Ban Giám hiệu mở phòng, vào phòng, cho người chờ vào,
// cho nói, cho chia sẻ màn hình, ghi hình (khi chương trình bật và cha mẹ đã đồng ý), kết thúc; xem lại bản ghi của buổi
export function VideoSessionPanel({ sessionId, notify }: { sessionId: string; notify: (text: string) => void }) {
  const queryClient = useQueryClient();
  const [join, setJoin] = useState<VideoJoinInfo>();
  const [error, setError] = useState<string>();
  const room = useQuery({
    queryKey: ['video-room', join?.room_id],
    queryFn: () => videoApi.room(join?.room_id as string),
    enabled: join !== undefined,
    refetchInterval: 5000,
  });
  const recordings = useQuery({
    queryKey: ['video-recordings', sessionId],
    queryFn: () => videoApi.recordings(sessionId),
  });
  const run = useMutation({
    mutationFn: async (work: () => Promise<string>) => work(),
    onSuccess: async (text) => {
      setError(undefined);
      notify(text);
      await queryClient.invalidateQueries({ queryKey: ['video-room'] });
      await queryClient.invalidateQueries({ queryKey: ['video-recordings', sessionId] });
    },
    onError: (caught) => setError(messageOf(caught)),
  });
  const detail = room.data;
  const usage = detail?.usage;
  return (
    <section aria-label="Lớp video của buổi" className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {join ? null : (
        <Button
          variant="primary"
          onClick={() =>
            run.mutate(async () => {
              setJoin(await videoApi.openSessionRoom(sessionId));
              return 'Đã mở lớp video';
            })
          }
        >
          Mở lớp video
        </Button>
      )}
      {join && detail?.status !== 'ended' ? (
        <>
          <VideoRoom
            join={{ ...join, recording: detail?.recording !== null && detail?.recording !== undefined }}
            onLeave={() => setJoin(undefined)}
          />
          {detail ? (
            <VideoHostPanel
              admissions={detail.admissions}
              recording={detail.recording !== null}
              minutesLeft={
                usage?.minutes_limit === null || !usage ? null : Math.max(0, usage.minutes_limit - usage.minutes_used)
              }
              onParticipant={(identity, change) =>
                run.mutate(async () => {
                  await videoApi.participant(join.room_id, identity, change);
                  return change.admit ? 'Đã cho vào phòng' : change.remove ? 'Đã mời ra' : 'Đã đổi quyền';
                })
              }
              onRecording={(start) =>
                run.mutate(async () => {
                  await videoApi.recording(join.room_id, start);
                  return start ? 'Đã bắt đầu ghi hình' : 'Đã dừng ghi hình';
                })
              }
              onEnd={() =>
                run.mutate(async () => {
                  await videoApi.end(join.room_id);
                  setJoin(undefined);
                  return 'Đã kết thúc lớp video';
                })
              }
            />
          ) : null}
        </>
      ) : null}
      <VideoRecordingList recordings={recordings.data ?? []} onView={async (id) => (await videoApi.viewLink(id)).url} />
    </section>
  );
}
