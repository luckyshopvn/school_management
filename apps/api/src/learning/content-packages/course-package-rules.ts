import { gunzipSync, gzipSync } from 'node:zlib';
import { validationError } from '@school-management/server';
import { sha256, type PackageItem } from '../../learning-resources/resource-sharing-rules.js';
import type { TemplateContent } from '../learning-template-rules.js';

// Gói khoá học `school-management.course-package/1` (DT-28 phần 28h, YCTD-278): JSON nén gzip gồm khoá học mẫu (tên, mô tả, cấp,
// khối, môn, chương và hoạt động) và học liệu mà hoạt động tham chiếu (dạng mục của gói học liệu 22h2, thêm `ref` là mã học liệu ở
// trường nguồn để nối lại, `scorm` khi là gói SCORM). Không chứa dữ liệu học sinh, kết quả, bài nộp; giữ giấy phép, nguồn theo
// 22h1. Claude tự chọn: gói tối đa 300 MB trước nén (gói SCORM tới 200 MB)
export const COURSE_PACKAGE_FORMAT = 'school-management.course-package/1';
export const MAXIMUM_COURSE_PACKAGE_BYTES = 300 * 1024 * 1024;

export interface CoursePackageResource extends PackageItem {
  ref: string;
  scorm: boolean;
}

export interface CoursePackageManifest {
  format: string;
  package_code: string;
  source_school: string;
  created_at: string;
  template: {
    title: string;
    description: string | null;
    school_level: 'TH' | 'THCS' | 'THPT';
    grade_level_code: string | null;
    subject_code: string | null;
    subject_name: string | null;
    content: TemplateContent;
  };
  resources: CoursePackageResource[];
}

const isText = (value: unknown, maximum: number): value is string =>
  typeof value === 'string' && value.trim() !== '' && value.length <= maximum;

export function buildCoursePackage(manifest: CoursePackageManifest): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(manifest), 'utf8'));
}

// Mã học liệu mà hoạt động của khoá tham chiếu (học liệu thường và gói SCORM)
export function referencedResources(content: TemplateContent): string[] {
  const ids = content.sections.flatMap((section) =>
    section.items
      .map((item) => item.settings?.resource_id)
      .filter((value): value is string => typeof value === 'string'),
  );
  return [...new Set(ids)];
}

// Đọc và kiểm gói: định dạng, khoá mẫu, từng học liệu (tiêu đề, giấy phép, tệp có mã băm khớp); lỗi của từng học liệu trả về để
// bỏ qua học liệu đó (và hoạt động trỏ tới nó), không ném
export function readCoursePackage(body: Buffer): {
  manifest: CoursePackageManifest;
  problems: Map<string, string>;
} {
  let manifest: CoursePackageManifest;
  try {
    manifest = JSON.parse(gunzipSync(body, { maxOutputLength: MAXIMUM_COURSE_PACKAGE_BYTES * 2 }).toString('utf8'));
  } catch {
    throw validationError([{ field: 'file', message: 'Tệp không phải gói khoá học (không giải nén, đọc được)' }]);
  }
  const template = manifest?.template;
  if (
    !manifest ||
    manifest.format !== COURSE_PACKAGE_FORMAT ||
    !isText(manifest.package_code, 100) ||
    !isText(manifest.source_school, 300) ||
    !template ||
    !isText(template.title, 300) ||
    !['TH', 'THCS', 'THPT'].includes(template.school_level) ||
    !Array.isArray(template.content?.sections) ||
    !Array.isArray(manifest.resources)
  ) {
    throw validationError([{ field: 'file', message: 'Bản kê của gói khoá học không đúng định dạng' }]);
  }
  const problems = new Map<string, string>();
  for (const item of manifest.resources) {
    const ref = typeof item?.ref === 'string' ? item.ref : '';
    if (!ref) continue;
    if (!isText(item.title, 300) || !isText(item.license_code, 50) || !isText(item.type_code, 50)) {
      problems.set(ref, 'Thiếu tiêu đề, loại hoặc giấy phép');
    } else if (item.kind === 'file') {
      if (typeof item.data !== 'string' || typeof item.sha256 !== 'string' || !item.file_name) {
        problems.set(ref, 'Thiếu tệp hoặc mã băm');
      } else if (sha256(Buffer.from(item.data, 'base64')) !== item.sha256) {
        problems.set(ref, 'Mã băm tệp không khớp bản kê (tệp hỏng hoặc bị sửa)');
      }
    } else if (item.kind !== 'link' || typeof item.url !== 'string' || item.scorm) {
      problems.set(ref, 'Học liệu không phải tệp hay liên kết');
    }
  }
  return { manifest, problems };
}

// Thay mã học liệu ở trường nguồn bằng mã ở trường nhận; hoạt động trỏ tới học liệu không nhập được thì bỏ (ghi lý do)
export function remapContent(
  content: TemplateContent,
  mapping: Map<string, string>,
): { content: TemplateContent; dropped: Array<{ title: string; reason: string }> } {
  const dropped: Array<{ title: string; reason: string }> = [];
  const sections = content.sections.map((section) => ({
    ...section,
    items: section.items.flatMap((item) => {
      const ref = item.settings?.resource_id;
      if (typeof ref !== 'string') return [item];
      const next = mapping.get(ref);
      if (!next) {
        dropped.push({ title: item.title, reason: 'Học liệu của hoạt động không nhập được' });
        return [];
      }
      return [{ ...item, settings: { ...item.settings, resource_id: next } }];
    }),
  }));
  return { content: { sections }, dropped };
}
