import { useState } from 'react';
import { Alert } from './Alert.js';
import { Button } from './Button.js';

// Bài video của khoá học ghi sẵn (DT-27 phần 27d1, YCTD-254) dùng chung cho cổng quản trị, ứng dụng phụ huynh (cha mẹ, học sinh): xem
// bằng đường dẫn ký ngắn hạn do máy chủ cấp (mỗi lần xem có nhật ký), trình duyệt tải theo đoạn, không có nút tải xuống
export interface LessonVideo {
  activity_id: string;
  title: string;
  section_title: string;
}

export function LessonVideoList({
  title,
  videos,
  onView,
}: {
  title: string;
  videos: LessonVideo[];
  onView: (activityId: string) => Promise<string>;
}) {
  const [playing, setPlaying] = useState<{ id: string; url: string }>();
  const [error, setError] = useState<string>();
  return (
    <section aria-label={`Khoá học ${title}`} className="flex flex-col gap-2">
      <h4 className="font-semibold">Khoá học ghi sẵn: {title}</h4>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {videos.length === 0 ? (
        <p className="text-label text-text-secondary">Khoá chưa có bài video đã công bố.</p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {videos.map((video) => (
          <li key={video.activity_id} className="flex flex-wrap items-center gap-2 text-label">
            <span>
              {video.section_title} · {video.title}
            </span>
            <Button
              onClick={() =>
                onView(video.activity_id)
                  .then((url) => {
                    setError(undefined);
                    setPlaying({ id: video.activity_id, url });
                  })
                  .catch(() => setError('Không mở được bài học'))
              }
            >
              Xem {video.title}
            </Button>
          </li>
        ))}
      </ul>
      {playing ? (
        <video
          key={playing.id}
          aria-label="Video bài học"
          src={playing.url}
          controls
          controlsList="nodownload"
          onContextMenu={(event) => event.preventDefault()}
          className="w-full max-w-xl rounded-lg bg-black"
        />
      ) : null}
    </section>
  );
}
