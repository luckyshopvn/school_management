import type { FieldError } from '@school-management/server';
import { activityKind } from './learning-activity-kinds.js';
import {
  MAX_TEMPLATE_ITEMS,
  MAX_TEMPLATE_SECTIONS,
  type CompletionRule,
  type TeachingModeValue,
} from './learning-rules.js';

// Nội dung khoá học mẫu của tổ chuyên môn và cách đẩy, cập nhật xuống lớp học trực tuyến (DT-28 phần 28b, YCTD-272). Khoá
// mẫu chỉ chứa chương và hoạt động không gắn lớp, học sinh, thời hạn; giờ mở, hạn nộp do giáo viên của lớp đặt
export interface TemplateItem {
  key: string;
  kind: string;
  title: string;
  lesson_label: string | null;
  instructions: string | null;
  required: boolean;
  estimated_minutes: number | null;
  completion_rule: CompletionRule;
  graded: boolean;
  weight: number;
  planned_week: number | null;
  teaching_mode: TeachingModeValue;
  settings: Record<string, unknown>;
}
export interface TemplateSection {
  key: string;
  title: string;
  planned_week: number | null;
  items: TemplateItem[];
}
export interface TemplateContent {
  sections: TemplateSection[];
}

const KEY_PATTERN = /^[a-z0-9-]{1,40}$/;

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value.trim().length <= max ? value.trim() : null;
}

function week(value: unknown): number | null | false {
  if (value === undefined || value === null) {
    return null;
  }
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 60 ? value : false;
}

export function emptyTemplateContent(): TemplateContent {
  return { sections: [] };
}

// Kiểm tra toàn bộ nội dung khoá mẫu gửi lên; khoá chương, khoá hoạt động là chuỗi ngắn do máy giáo viên sinh, không trùng
export function parseTemplateContent(raw: unknown, errors: FieldError[]): TemplateContent {
  const value = (raw ?? {}) as Record<string, unknown>;
  const sections = Array.isArray(value.sections) ? value.sections : null;
  if (!sections || sections.length > MAX_TEMPLATE_SECTIONS) {
    errors.push({ field: 'content.sections', message: `Khoá mẫu có tối đa ${MAX_TEMPLATE_SECTIONS} chương` });
    return emptyTemplateContent();
  }
  const keys = new Set<string>();
  let itemCount = 0;
  const parsed: TemplateSection[] = [];
  sections.forEach((sectionRaw, sectionIndex) => {
    const section = (sectionRaw ?? {}) as Record<string, unknown>;
    const field = `content.sections[${sectionIndex}]`;
    const key = typeof section.key === 'string' ? section.key : '';
    const title = text(section.title, 300);
    const plannedWeek = week(section.planned_week);
    if (!KEY_PATTERN.test(key) || keys.has(key)) {
      errors.push({ field: `${field}.key`, message: 'Khoá chương gồm chữ thường, số, gạch nối và không trùng' });
    }
    keys.add(key);
    if (!title) {
      errors.push({ field: `${field}.title`, message: 'Tên chương từ 1 đến 300 ký tự' });
    }
    if (plannedWeek === false) {
      errors.push({ field: `${field}.planned_week`, message: 'Tuần là số nguyên từ 1 đến 60' });
    }
    const items = Array.isArray(section.items) ? section.items : [];
    itemCount += items.length;
    const parsedItems: TemplateItem[] = [];
    items.forEach((itemRaw, itemIndex) => {
      const item = (itemRaw ?? {}) as Record<string, unknown>;
      const at = `${field}.items[${itemIndex}]`;
      const itemKey = typeof item.key === 'string' ? item.key : '';
      const kind = activityKind(item.kind);
      const itemTitle = text(item.title, 300);
      if (!KEY_PATTERN.test(itemKey) || keys.has(itemKey)) {
        errors.push({ field: `${at}.key`, message: 'Khoá hoạt động gồm chữ thường, số, gạch nối và không trùng' });
      }
      keys.add(itemKey);
      if (!kind || !kind.allowedInTemplate) {
        errors.push({ field: `${at}.kind`, message: 'Loại hoạt động không dùng được trong khoá mẫu' });
        return;
      }
      if (!itemTitle) {
        errors.push({ field: `${at}.title`, message: 'Tên hoạt động từ 1 đến 300 ký tự' });
      }
      const completion = (item.completion_rule ?? kind.defaultCompletion) as CompletionRule;
      if (!kind.completionRules.includes(completion)) {
        errors.push({ field: `${at}.completion_rule`, message: 'Cách tính hoàn thành không hợp với loại hoạt động' });
      }
      const minutes = item.estimated_minutes;
      if (
        minutes !== undefined &&
        minutes !== null &&
        !(Number.isInteger(minutes) && (minutes as number) >= 1 && (minutes as number) <= 600)
      ) {
        errors.push({ field: `${at}.estimated_minutes`, message: 'Thời lượng dự kiến từ 1 đến 600 phút' });
      }
      const weight = item.weight === undefined ? 1 : item.weight;
      if (typeof weight !== 'number' || weight < 0 || weight > 100) {
        errors.push({ field: `${at}.weight`, message: 'Trọng số từ 0 đến 100' });
      }
      const itemWeek = week(item.planned_week);
      if (itemWeek === false) {
        errors.push({ field: `${at}.planned_week`, message: 'Tuần là số nguyên từ 1 đến 60' });
      }
      const mode = item.teaching_mode ?? 'support';
      if (mode !== 'support' && mode !== 'replace') {
        errors.push({ field: `${at}.teaching_mode`, message: 'Hình thức là support hoặc replace' });
      }
      const instructions =
        item.instructions === undefined || item.instructions === null ? null : text(item.instructions, 5000);
      parsedItems.push({
        key: itemKey,
        kind: kind.code,
        title: itemTitle ?? '',
        lesson_label: text(item.lesson_label, 200),
        instructions,
        required: item.required !== false,
        estimated_minutes: typeof minutes === 'number' ? minutes : null,
        completion_rule: completion,
        graded: item.graded === true,
        weight: typeof weight === 'number' ? weight : 1,
        planned_week: itemWeek === false ? null : itemWeek,
        teaching_mode: mode === 'replace' ? 'replace' : 'support',
        settings: kind.parseSettings(item.settings, `${at}.settings`, errors),
      });
    });
    parsed.push({
      key,
      title: title ?? '',
      planned_week: plannedWeek === false ? null : plannedWeek,
      items: parsedItems,
    });
  });
  if (itemCount > MAX_TEMPLATE_ITEMS) {
    errors.push({ field: 'content', message: `Khoá mẫu có tối đa ${MAX_TEMPLATE_ITEMS} hoạt động` });
  }
  return { sections: parsed };
}

export interface LocalSection {
  id: string;
  template_section_key: string | null;
}
export interface LocalActivity {
  id: string;
  template_item_key: string | null;
  edited_locally: boolean;
}

// Đẩy hoặc cập nhật khoá mẫu xuống một lớp: chương, hoạt động chưa có thì thêm; hoạt động đã có mà giáo viên chưa sửa thì
// cập nhật theo mẫu; hoạt động giáo viên đã sửa giữ nguyên; hoạt động giáo viên tự thêm không đụng tới. Không xóa gì
export function planTemplateApply(content: TemplateContent, sections: LocalSection[], activities: LocalActivity[]) {
  const sectionByKey = new Map(
    sections
      .filter((section) => section.template_section_key)
      .map((section) => [section.template_section_key, section]),
  );
  const activityByKey = new Map(
    activities
      .filter((activity) => activity.template_item_key)
      .map((activity) => [activity.template_item_key, activity]),
  );
  const createSections: TemplateSection[] = [];
  const createItems: Array<{ sectionKey: string; item: TemplateItem; position: number }> = [];
  const updateItems: Array<{ activityId: string; item: TemplateItem }> = [];
  let keptLocal = 0;
  for (const section of content.sections) {
    if (!sectionByKey.has(section.key)) {
      createSections.push(section);
    }
    section.items.forEach((item, position) => {
      const existing = activityByKey.get(item.key);
      if (!existing) {
        createItems.push({ sectionKey: section.key, item, position });
      } else if (existing.edited_locally) {
        keptLocal += 1;
      } else {
        updateItems.push({ activityId: existing.id, item });
      }
    });
  }
  return { createSections, createItems, updateItems, keptLocal };
}
