import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { validationError, type FieldError } from '@school-management/server';
import { isUuid, readOptionalText, type RequestBody } from '../common/request-fields.js';

// Kho học liệu số, phần câu hỏi và chia sẻ (DT-22 phần 22h2, YCTD-184): hàm thuần của rubric và gói chia sẻ liên trường. Claude
// tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - rubric: 2 đến 6 mức (tên mức, điểm tăng dần từ mức thấp), 1 đến 20 tiêu chí; mỗi tiêu chí có trọng số (hệ số nhân điểm
//   mức, mặc định 1) và mô tả cho từng mức; điểm tối đa là tổng trọng số × điểm mức cao nhất;
// - gói chia sẻ: một tệp nén gzip chứa bản kê JSON (định dạng, mã gói, trường nguồn do trường tự đặt, thời điểm, danh sách học
//   liệu: metadata, mã giấy phép, nguồn gốc, mã băm SHA-256 và nội dung base64 của tệp hoặc địa chỉ liên kết). Bản kê không có
//   người sở hữu, người chịu trách nhiệm hay dữ liệu cá nhân của học sinh, phụ huynh;
// - nhập gói: kiểm định dạng, mã băm từng tệp, giấy phép có trong danh mục và không bị chặn, không "chỉ cá nhân"; loại trùng
//   theo mã băm tệp, địa chỉ liên kết đã có trong kho.
export const RESOURCE_SHARING_RULE_CODE = 'YCTD-184';
export const PACKAGE_FORMAT = 'school-management.resource-package/1';
export const MAXIMUM_PACKAGE_BYTES = 100 * 1024 * 1024;
const LEVELS = ['MN', 'TH', 'THCS', 'THPT'];

export interface RubricLevel {
  label: string;
  score: number;
}

export interface RubricCriterion {
  name: string;
  weight: number;
  descriptors: string[];
}

export interface RubricInput {
  name: string;
  description: string | null;
  school_level: 'MN' | 'TH' | 'THCS' | 'THPT' | null;
  subject_id: string | null;
  grade_level_code: string | null;
  question_id: string | null;
  visibility: 'private' | 'school';
  levels: RubricLevel[];
  criteria: RubricCriterion[];
}

const isText = (value: unknown, maximum: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum;

export function rubricMaxScore(levels: RubricLevel[], criteria: RubricCriterion[]): number {
  const top = Math.max(0, ...levels.map((level) => level.score));
  return Math.round(criteria.reduce((sum, criterion) => sum + criterion.weight * top, 0) * 100) / 100;
}

export function parseRubric(body: RequestBody): RubricInput {
  const errors: FieldError[] = [];
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!isText(name, 300)) {
    errors.push({ field: 'name', message: 'Tên rubric từ 1 đến 300 ký tự' });
  }
  const description = readOptionalText(body, 'description', errors) ?? null;
  const level = body?.school_level ?? null;
  if (level !== null && !LEVELS.includes(level as string)) {
    errors.push({ field: 'school_level', message: 'Cấp học là MN, TH, THCS hoặc THPT' });
  }
  const ids: Record<'subject_id' | 'question_id', string | null> = { subject_id: null, question_id: null };
  for (const field of ['subject_id', 'question_id'] as const) {
    const value = body?.[field];
    if (value !== undefined && value !== null && value !== '') {
      if (isUuid(value)) ids[field] = value;
      else errors.push({ field, message: 'Mã không hợp lệ' });
    }
  }
  const grade = typeof body?.grade_level_code === 'string' ? body.grade_level_code.trim() || null : null;
  const visibility = body?.visibility ?? 'school';
  if (visibility !== 'private' && visibility !== 'school') {
    errors.push({ field: 'visibility', message: 'Phạm vi là private hoặc school' });
  }
  const levels: RubricLevel[] = [];
  const rawLevels = Array.isArray(body?.levels) ? (body.levels as unknown[]) : [];
  if (rawLevels.length < 2 || rawLevels.length > 6) {
    errors.push({ field: 'levels', message: 'Rubric có từ 2 đến 6 mức' });
  }
  rawLevels.forEach((raw, index) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    if (!isText(item.label, 100) || typeof item.score !== 'number' || !Number.isFinite(item.score) || item.score < 0) {
      errors.push({ field: `levels[${index}]`, message: 'Mỗi mức có tên và điểm không âm' });
      return;
    }
    levels.push({ label: item.label.trim(), score: item.score });
  });
  if (levels.some((item, index) => index > 0 && item.score <= (levels[index - 1] as RubricLevel).score)) {
    errors.push({ field: 'levels', message: 'Điểm các mức tăng dần từ mức thấp đến mức cao' });
  }
  const criteria: RubricCriterion[] = [];
  const rawCriteria = Array.isArray(body?.criteria) ? (body.criteria as unknown[]) : [];
  if (rawCriteria.length < 1 || rawCriteria.length > 20) {
    errors.push({ field: 'criteria', message: 'Rubric có từ 1 đến 20 tiêu chí' });
  }
  rawCriteria.forEach((raw, index) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const weight = item.weight ?? 1;
    const descriptors = Array.isArray(item.descriptors) ? (item.descriptors as unknown[]) : [];
    if (
      !isText(item.name, 300) ||
      typeof weight !== 'number' ||
      !Number.isFinite(weight) ||
      weight <= 0 ||
      weight > 10 ||
      descriptors.length !== rawLevels.length ||
      descriptors.some((text) => typeof text !== 'string' || text.length > 1000)
    ) {
      errors.push({
        field: `criteria[${index}]`,
        message: 'Mỗi tiêu chí có tên, trọng số từ trên 0 đến 10, mô tả đủ cho từng mức',
      });
      return;
    }
    criteria.push({
      name: item.name.trim(),
      weight,
      descriptors: (descriptors as string[]).map((text) => text.trim()),
    });
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return {
    name,
    description,
    school_level: level as RubricInput['school_level'],
    subject_id: ids.subject_id,
    grade_level_code: grade,
    question_id: ids.question_id,
    visibility: visibility as 'private' | 'school',
    levels,
    criteria,
  };
}

// ---- Gói chia sẻ ----

export interface PackageItem {
  title: string;
  description: string | null;
  type_code: string;
  school_level: string | null;
  grade_level_code: string | null;
  subject_code: string | null;
  subject_name: string | null;
  keywords: string[];
  author_name: string | null;
  language: string;
  duration_minutes: number | null;
  license_code: string;
  license_source: string | null;
  origin: string | null;
  kind: 'file' | 'link';
  file_name: string | null;
  content_type: string | null;
  sha256: string | null;
  data: string | null;
  url: string | null;
  link_title: string | null;
}

export interface PackageManifest {
  format: string;
  package_code: string;
  source_school: string;
  created_at: string;
  items: PackageItem[];
}

export const sha256 = (body: Buffer) => createHash('sha256').update(body).digest('hex');

export function buildPackage(manifest: PackageManifest): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(manifest), 'utf8'));
}

// Đọc và kiểm gói: định dạng, trường bắt buộc, mã băm từng tệp; lỗi theo học liệu trả về để báo, không ném
export function readPackage(body: Buffer): {
  manifest: PackageManifest;
  problems: Array<{ index: number; message: string }>;
} {
  let manifest: PackageManifest;
  try {
    manifest = JSON.parse(gunzipSync(body, { maxOutputLength: MAXIMUM_PACKAGE_BYTES * 2 }).toString('utf8'));
  } catch {
    throw validationError([
      { field: 'file', message: 'Tệp không phải gói chia sẻ học liệu (không giải nén, đọc được)' },
    ]);
  }
  if (
    !manifest ||
    manifest.format !== PACKAGE_FORMAT ||
    !isText(manifest.package_code, 100) ||
    !isText(manifest.source_school, 300) ||
    !Array.isArray(manifest.items)
  ) {
    throw validationError([{ field: 'file', message: 'Bản kê của gói không đúng định dạng' }]);
  }
  const problems: Array<{ index: number; message: string }> = [];
  manifest.items.forEach((item, index) => {
    if (!isText(item?.title, 300) || !isText(item?.license_code, 50) || !isText(item?.type_code, 50)) {
      problems.push({ index, message: 'Thiếu tiêu đề, loại hoặc giấy phép' });
      return;
    }
    if (item.kind === 'file') {
      if (typeof item.data !== 'string' || typeof item.sha256 !== 'string' || !item.file_name) {
        problems.push({ index, message: 'Thiếu tệp hoặc mã băm' });
        return;
      }
      if (sha256(Buffer.from(item.data, 'base64')) !== item.sha256) {
        problems.push({ index, message: 'Mã băm tệp không khớp bản kê (tệp hỏng hoặc bị sửa)' });
      }
      return;
    }
    if (item.kind !== 'link' || typeof item.url !== 'string') {
      problems.push({ index, message: 'Học liệu không phải tệp hay liên kết' });
    }
  });
  return { manifest, problems };
}

// Chỗ trống chủ đề: chủ đề chưa có học liệu nào hoặc chưa có câu hỏi dùng được nào
export function topicGaps(
  topics: Array<{ key: string; name: string }>,
  resourceCounts: Map<string, number>,
  questionCounts: Map<string, number>,
) {
  return topics
    .map((topic) => ({
      name: topic.name,
      resources: resourceCounts.get(topic.key) ?? 0,
      questions: questionCounts.get(topic.key) ?? 0,
    }))
    .filter((row) => row.resources === 0 || row.questions === 0);
}
