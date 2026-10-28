import { useEffect, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import { ApiError, fetchWithSession, requestJson } from '../../session/api-client.js';
import { mediaKind, schoolMediaFor, type MediaKind, type ResourceSummary } from './school-media-logic.ts';

// Bài hát, câu chuyện của trường (DT-29 phần 29e, YCTD-329; Mầm non): học liệu loại Bài hát, Câu chuyện do trường tải lên kho học
// liệu số (22h1) và đã qua Ban Giám hiệu duyệt; giáo viên chọn rồi phát ngay trên lớp (âm thanh, video), chiếu ảnh hoặc mở PDF.
// Dự án không kèm bài hát, truyện nào; nội dung và bản quyền do trường chịu trách nhiệm. Cần mạng để tải danh sách và tệp
const TYPE_LABELS: Record<string, string> = { song: 'Bài hát', story: 'Câu chuyện' };

interface Opened {
  id: string;
  url: string | null;
  kind: MediaKind | 'link';
  link?: string;
}

export function SchoolMediaTool({ level, online }: { level: string | null; online: boolean }) {
  const [resources, setResources] = useState<ResourceSummary[]>();
  const [problem, setProblem] = useState<string>();
  const [opened, setOpened] = useState<Opened>();
  const [loading, setLoading] = useState<string>();

  useEffect(() => {
    if (!online) {
      return;
    }
    requestJson<ResourceSummary[]>('/api/v1/learning-resources')
      .then((rows) => setResources(schoolMediaFor(rows, level)))
      .catch((error: unknown) =>
        setProblem(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ'),
      );
  }, [level, online]);

  // Thu hồi địa chỉ tạm của tệp khi đổi bài hoặc rời công cụ
  useEffect(() => {
    const url = opened?.url;
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [opened?.url]);

  const open = async (resource: ResourceSummary) => {
    setLoading(resource.id);
    setProblem(undefined);
    try {
      const response = await fetchWithSession(`/api/v1/learning-resources/${resource.id}/download`);
      if (!response.ok) {
        throw new Error('Không mở được tệp');
      }
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = (await response.json()) as { url?: string };
        setOpened({ id: resource.id, url: null, kind: 'link', link: body.url });
      } else {
        setOpened({ id: resource.id, url: URL.createObjectURL(await response.blob()), kind: mediaKind(contentType) });
      }
    } catch {
      setProblem('Không mở được tệp, hãy thử lại khi có mạng');
    } finally {
      setLoading(undefined);
    }
  };

  if (!online) {
    return <Alert tone="info">Cần có mạng để mở bài hát, câu chuyện của trường.</Alert>;
  }
  const current = resources?.find((resource) => resource.id === opened?.id);
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <section aria-label="Danh sách bài hát, câu chuyện" className="flex flex-col gap-2 lg:w-80">
        {problem ? <Alert tone="danger">{problem}</Alert> : null}
        {resources === undefined && !problem ? (
          <div className="h-24 animate-pulse rounded bg-border" aria-hidden="true" />
        ) : null}
        {resources && resources.length === 0 ? (
          <p className="text-content text-text-secondary">
            Trường chưa có bài hát, câu chuyện nào cho cấp học này. Tải lên ở Kho học liệu của cổng quản trị, chọn loại
            Bài hát hoặc Câu chuyện; học liệu hiện ở đây sau khi được duyệt.
          </p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {(resources ?? []).map((resource) => (
            <li key={resource.id}>
              <button
                type="button"
                aria-pressed={resource.id === opened?.id}
                disabled={loading !== undefined}
                onClick={() => void open(resource)}
                className={`flex w-full flex-col items-start rounded-lg px-3 py-2 text-left ${
                  resource.id === opened?.id ? 'bg-brand text-white' : 'border border-border-strong bg-card text-text'
                }`}
              >
                <span className="text-content font-semibold">{resource.title}</span>
                <span className="text-label">
                  {TYPE_LABELS[resource.type_code] ?? ''}
                  {resource.author_name ? `, ${resource.author_name}` : ''}
                  {loading === resource.id ? ': đang mở…' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section
        aria-label="Đang phát"
        className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-4"
      >
        {!opened ? <p className="text-content text-text-secondary">Chọn một bài hát hoặc câu chuyện để phát</p> : null}
        {current ? <h3 className="text-section-title font-semibold text-text">{current.title}</h3> : null}
        {opened?.kind === 'audio' && opened.url ? (
          <audio aria-label={current?.title} controls autoPlay src={opened.url} className="w-full" />
        ) : null}
        {opened?.kind === 'video' && opened.url ? (
          <video
            aria-label={current?.title}
            controls
            autoPlay
            src={opened.url}
            className="max-h-[60vh] w-full rounded-lg"
          />
        ) : null}
        {opened?.kind === 'image' && opened.url ? (
          <img src={opened.url} alt={current?.title ?? ''} className="max-h-[60vh] rounded-lg" />
        ) : null}
        {(opened?.kind === 'pdf' || opened?.kind === 'other') && opened.url ? (
          <Button onClick={() => window.open(opened.url ?? '', '_blank', 'noopener')}>Mở tệp</Button>
        ) : null}
        {opened?.kind === 'link' && opened.link ? (
          <Button onClick={() => window.open(opened.link, '_blank', 'noopener')}>Mở liên kết</Button>
        ) : null}
      </section>
    </div>
  );
}
