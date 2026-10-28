// Bài hát, câu chuyện của trường (DT-29 phần 29e, YCTD-329): chọn học liệu loại Bài hát, Câu chuyện đã công bố ở kho học liệu của
// trường cho cấp của lớp; nhận biết cách phát theo kiểu tệp. Không import gì để kiểm thử bằng node --test
export const SCHOOL_MEDIA_TYPES: readonly string[] = ['song', 'story'];

export interface ResourceSummary {
  id: string;
  title: string;
  type_code: string;
  school_level: string | null;
  published_version: number | null;
  status: string;
  author_name?: string | null;
}

// Học liệu đã công bố, loại bài hát hoặc câu chuyện, của cấp của lớp hoặc không ghi cấp; bài hát trước, theo tên
export function schoolMediaFor(resources: readonly ResourceSummary[], level: string | null): ResourceSummary[] {
  return resources
    .filter(
      (resource) =>
        SCHOOL_MEDIA_TYPES.includes(resource.type_code) &&
        resource.published_version !== null &&
        resource.status !== 'hidden' &&
        resource.status !== 'retired' &&
        (resource.school_level === null || level === null || resource.school_level === level),
    )
    .sort(
      (left, right) =>
        SCHOOL_MEDIA_TYPES.indexOf(left.type_code) - SCHOOL_MEDIA_TYPES.indexOf(right.type_code) ||
        left.title.localeCompare(right.title, 'vi'),
    );
}

export type MediaKind = 'audio' | 'video' | 'image' | 'pdf' | 'other';

export function mediaKind(contentType: string | null): MediaKind {
  const type = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf') return 'pdf';
  return 'other';
}
