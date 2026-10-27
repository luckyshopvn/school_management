import { randomBytes } from 'node:crypto';
import { ruleViolationError, type FieldError } from '@school-management/server';
import type { LearningBadgeKind } from '@school-management/database';
import type { RequestBody } from '../../common/request-fields.js';
import { escapeHtml } from '../../website/website-html.js';
import { isDone, type ResultStatus } from '../learning-rules.js';

// Quy tắc thuần của huy hiệu, chứng nhận hoàn thành (DT-28 phần 28i, YCTD-279; tài liệu 32 mục 20.7). Tắt mặc định, Ban Giám
// hiệu bật (GD-155). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-279:
// - Tiêu chí tự động có sẵn: hoàn thành chương (mọi hoạt động bắt buộc của chương xong), hoàn thành khoá (mọi chương có hoạt động
//   bắt buộc xong), nộp bài đúng hạn 5 lần liên tiếp trong một lớp học trực tuyến; giáo viên trao huy hiệu kèm lý do.
// - Không bảng xếp hạng, không đếm hay so sánh huy hiệu giữa học sinh; danh sách của giáo viên xếp theo tên học sinh.
// - Chứng nhận chỉ cho khoá tự chọn đã hoàn thành; họ tên viết tắt trên trang kiểm tra là chữ đầu của họ và tên đệm, giữ tên
//   (Nguyễn Văn An thành N. V. An); mã kiểm tra 10 ký tự chữ hoa, số, bỏ các ký tự dễ nhầm (0, O, 1, I).
export const RECOGNITION_RULE_CODE = 'YCTD-279';
export const ON_TIME_STREAK = 5;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function recognitionRule(message: string, fields?: FieldError[]) {
  return ruleViolationError(RECOGNITION_RULE_CODE, message, fields);
}

// ---------- Cấu hình của trường

export interface RecognitionConfig {
  badges_enabled: boolean;
  certificates_enabled: boolean;
  certificate: { title: string; signer_title: string; signer_name: string };
}

export const DEFAULT_CONFIG: RecognitionConfig = {
  badges_enabled: false,
  certificates_enabled: false,
  certificate: { title: 'Chứng nhận hoàn thành khoá học', signer_title: 'Hiệu trưởng', signer_name: '' },
};

const text = (value: unknown, maximum: number) => (typeof value === 'string' ? value.trim().slice(0, maximum) : '');

export function configOf(value: unknown): RecognitionConfig {
  const raw = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const certificate =
    raw.certificate !== null && typeof raw.certificate === 'object' ? (raw.certificate as Record<string, unknown>) : {};
  return {
    badges_enabled: raw.badges_enabled === true,
    certificates_enabled: raw.certificates_enabled === true,
    certificate: {
      title: text(certificate.title, 120) || DEFAULT_CONFIG.certificate.title,
      signer_title: text(certificate.signer_title, 120) || DEFAULT_CONFIG.certificate.signer_title,
      signer_name: text(certificate.signer_name, 120),
    },
  };
}

export function parseConfig(body: RequestBody): RecognitionConfig {
  const errors: FieldError[] = [];
  for (const field of ['badges_enabled', 'certificates_enabled'] as const) {
    if (typeof body?.[field] !== 'boolean') errors.push({ field, message: 'Bật là true hoặc false' });
  }
  const certificate = body?.certificate as Record<string, unknown> | undefined;
  for (const field of ['title', 'signer_title', 'signer_name'] as const) {
    const value = certificate?.[field];
    if (value !== undefined && (typeof value !== 'string' || value.length > 120)) {
      errors.push({ field: `certificate.${field}`, message: 'Tối đa 120 ký tự' });
    }
  }
  if (errors.length > 0) {
    throw recognitionRule('Cấu hình huy hiệu, chứng nhận chưa hợp lệ', errors);
  }
  return configOf(body);
}

// ---------- Huy hiệu tự động

export interface SectionProgress {
  id: string;
  title: string;
  activities: Array<{ required: boolean; status: ResultStatus | string }>;
}

export interface EarnedBadge {
  kind: Exclude<LearningBadgeKind, 'teacher_award'>;
  criterion_key: string;
  section_id: string | null;
  title: string;
}

const requiredDone = (section: SectionProgress) => {
  const required = section.activities.filter((activity) => activity.required);
  return required.length > 0 && required.every((activity) => isDone(activity.status as ResultStatus));
};

// Khoá hoàn thành: có ít nhất một chương có hoạt động bắt buộc, mọi chương như vậy đều xong
export function courseCompleted(sections: SectionProgress[]): boolean {
  const counted = sections.filter((section) => section.activities.some((activity) => activity.required));
  return counted.length > 0 && counted.every(requiredDone);
}

// Chuỗi dài nhất các lần nộp đúng hạn liên tiếp (theo thời điểm nộp)
export function longestOnTimeStreak(submissions: Array<{ late: boolean; submitted_at: Date }>): number {
  let best = 0;
  let current = 0;
  for (const submission of [...submissions].sort(
    (left, right) => left.submitted_at.getTime() - right.submitted_at.getTime(),
  )) {
    current = submission.late ? 0 : current + 1;
    best = Math.max(best, current);
  }
  return best;
}

export function earnedBadges(
  sections: SectionProgress[],
  submissions: Array<{ late: boolean; submitted_at: Date }>,
): EarnedBadge[] {
  const badges: EarnedBadge[] = sections.filter(requiredDone).map((section) => ({
    kind: 'section_complete',
    criterion_key: `section:${section.id}`,
    section_id: section.id,
    title: `Hoàn thành chương: ${section.title}`.slice(0, 120),
  }));
  if (courseCompleted(sections)) {
    badges.push({ kind: 'course_complete', criterion_key: 'course', section_id: null, title: 'Hoàn thành khoá học' });
  }
  if (longestOnTimeStreak(submissions) >= ON_TIME_STREAK) {
    badges.push({
      kind: 'on_time_streak',
      criterion_key: `streak:${ON_TIME_STREAK}`,
      section_id: null,
      title: `Nộp bài đúng hạn ${ON_TIME_STREAK} lần liên tiếp`,
    });
  }
  return badges;
}

// ---------- Chứng nhận

export function abbreviateName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? '';
  const given = parts[parts.length - 1] as string;
  return [...parts.slice(0, -1).map((part) => `${part.charAt(0).toLocaleUpperCase('vi')}.`), given].join(' ');
}

export function certificateCode(source: Buffer = randomBytes(10)): string {
  return `CN-${[...source.subarray(0, 10)].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')}`;
}

export function normalizeCode(value: unknown): string | null {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^CN-[A-Z0-9]{10}$/.test(code) ? code : null;
}

const vietnamDate = (value: Date) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);

export function issuedDateText(value: Date): string {
  return vietnamDate(value);
}

// Trang kiểm tra công khai: chỉ tên khoá, ngày cấp, tên trường, họ tên viết tắt, trạng thái; không có thông tin khác của học sinh
export function verificationPage(
  code: string,
  certificate: {
    course_title: string;
    school_name: string;
    holder_short_name: string;
    issued_at: Date;
    revoked_at: Date | null;
  } | null,
): string {
  const body = certificate
    ? `<h1>${certificate.revoked_at ? 'Chứng nhận đã bị thu hồi' : 'Chứng nhận hợp lệ'}</h1>
<dl>
<dt>Mã kiểm tra</dt><dd>${escapeHtml(code)}</dd>
<dt>Khoá học</dt><dd>${escapeHtml(certificate.course_title)}</dd>
<dt>Người nhận</dt><dd>${escapeHtml(certificate.holder_short_name)}</dd>
<dt>Ngày cấp</dt><dd>${escapeHtml(vietnamDate(certificate.issued_at))}</dd>
<dt>Trường</dt><dd>${escapeHtml(certificate.school_name)}</dd>
${certificate.revoked_at ? `<dt>Ngày thu hồi</dt><dd>${escapeHtml(vietnamDate(certificate.revoked_at))}</dd>` : ''}
</dl>`
    : `<h1>Không tìm thấy chứng nhận</h1><p>Mã ${escapeHtml(code)} không có trong hệ thống của trường.</p>`;
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Kiểm tra chứng nhận</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;color:#1f2937}dt{font-weight:600;margin-top:.75rem}dd{margin:0}</style>
</head><body>${body}</body></html>`;
}
