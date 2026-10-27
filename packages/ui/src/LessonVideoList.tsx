import { useRef, useState } from 'react';
import { Alert } from './Alert.js';
import { Button } from './Button.js';

// Bài video của khoá học ghi sẵn (DT-27 phần 27d1, YCTD-254) dùng chung cho cổng quản trị, ứng dụng phụ huynh (cha mẹ, học sinh): xem
// bằng đường dẫn ký ngắn hạn do máy chủ cấp (mỗi lần xem có nhật ký), trình duyệt tải theo đoạn, không có nút tải xuống. 27d2
// (YCTD-261): hiện phần trăm đã xem của em; ở kênh học sinh, trình phát báo phần trăm đã xem mỗi khi qua một mốc 10% và khi xem hết
export interface LessonVideo {
  activity_id: string;
  title: string;
  section_title: string;
}

export interface LessonVideoProgress {
  status: string;
  progress: number;
}

const DONE = new Set(['completed', 'passed', 'excused']);

function progressLabel(progress: LessonVideoProgress | undefined): string | null {
  if (!progress) {
    return null;
  }
  if (DONE.has(progress.status)) {
    return 'Đã xem xong';
  }
  return progress.progress > 0 ? `Đã xem ${progress.progress}%` : 'Chưa xem';
}

export function LessonVideoList({
  title,
  videos,
  onView,
  progress,
  onProgress,
}: {
  title: string;
  videos: LessonVideo[];
  onView: (activityId: string) => Promise<string>;
  progress?: Record<string, LessonVideoProgress>;
  onProgress?: (activityId: string, percent: number) => Promise<unknown>;
}) {
  const [playing, setPlaying] = useState<{ id: string; url: string }>();
  const [error, setError] = useState<string>();
  const reported = useRef(0);
  const report = (activityId: string, percent: number) => {
    if (!onProgress || percent <= reported.current) {
      return;
    }
    reported.current = percent;
    void onProgress(activityId, percent).catch(() => undefined);
  };
  return (
    <section aria-label={`Khoá học ${title}`} className="flex flex-col gap-2">
      <h4 className="font-semibold">Khoá học ghi sẵn: {title}</h4>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {videos.length === 0 ? (
        <p className="text-label text-text-secondary">Khoá chưa có bài video đã công bố.</p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {videos.map((video) => {
          const label = progressLabel(progress?.[video.activity_id]);
          return (
            <li key={video.activity_id} className="flex flex-wrap items-center gap-2 text-label">
              <span>
                {video.section_title} · {video.title}
              </span>
              {label ? <span className="text-text-secondary">({label})</span> : null}
              <Button
                onClick={() =>
                  onView(video.activity_id)
                    .then((url) => {
                      setError(undefined);
                      reported.current = 0;
                      setPlaying({ id: video.activity_id, url });
                    })
                    .catch((reason: unknown) =>
                      setError(reason instanceof Error && reason.message ? reason.message : 'Không mở được bài học'),
                    )
                }
              >
                Xem {video.title}
              </Button>
            </li>
          );
        })}
      </ul>
      {playing ? (
        <video
          key={playing.id}
          aria-label="Video bài học"
          src={playing.url}
          controls
          controlsList="nodownload"
          onContextMenu={(event) => event.preventDefault()}
          onTimeUpdate={(event) => {
            const { currentTime, duration } = event.currentTarget;
            if (duration > 0) {
              report(playing.id, Math.floor((currentTime / duration) * 10) * 10);
            }
          }}
          onEnded={() => report(playing.id, 100)}
          className="w-full max-w-xl rounded-lg bg-black"
        />
      ) : null}
    </section>
  );
}

// Tiến độ của em trong khoá (27d2): hoạt động bắt buộc đã xong, quá hạn, từng hoạt động và điểm (cách tính của lõi LMS 28b, 28d)
export interface LessonCourseProgressData {
  summary: { required: number; done: number; overdue: number; percent: number };
  activities: Array<{
    id: string;
    section_title: string;
    title: string;
    kind_label: string;
    required: boolean;
    open: boolean;
    status: string;
    score: number | null;
  }>;
  videos: Record<string, LessonVideoProgress>;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Chưa làm',
  in_progress: 'Đang làm',
  completed: 'Đã xong',
  passed: 'Đạt',
  failed: 'Chưa đạt',
  excused: 'Được miễn',
};

export function LessonCourseProgress({ progress }: { progress: LessonCourseProgressData }) {
  const { summary } = progress;
  return (
    <section aria-label="Tiến độ khoá học" className="flex flex-col gap-1 text-label">
      <p>
        Đã xong {summary.done}/{summary.required} hoạt động bắt buộc ({summary.percent}%)
        {summary.overdue > 0 ? `, quá hạn ${summary.overdue}` : ''}
      </p>
      <ul className="flex flex-col gap-0.5 text-text-secondary">
        {progress.activities.map((activity) => (
          <li key={activity.id}>
            {activity.section_title} · {activity.title} ({activity.kind_label}
            {activity.required ? '' : ', không bắt buộc'}): {STATUS_LABELS[activity.status] ?? activity.status}
            {activity.score !== null ? `, điểm ${activity.score}` : ''}
            {activity.open ? '' : ', chưa mở'}
          </li>
        ))}
      </ul>
    </section>
  );
}
