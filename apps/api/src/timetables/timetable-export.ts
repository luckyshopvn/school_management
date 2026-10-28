import { TIMETABLE_WEEKDAY_LABELS } from '@school-management/shared';
import type { TableFileColumn, TableFileSheet } from '../exports/table-file.js';

// Xuất thời khoá biểu ra Excel (YCTD-317): mỗi lớp, giáo viên hoặc phòng một trang tính dạng lưới, dòng là tiết theo khung
// giờ của cấp, cột là thứ trong tuần. Ô ghi môn và hai thông tin còn lại (lớp xem giáo viên, phòng; giáo viên xem lớp, phòng;
// phòng xem lớp, giáo viên); nhiều tiết trùng ô (học theo nhóm) nối bằng dấu chấm phẩy
export type TimetableExportGroup = 'class' | 'teacher' | 'room';

export interface ExportLesson {
  class_id: string;
  class_name: string;
  weekday: number;
  period_no: number;
  subject_name: string;
  teacher_user_id: string | null;
  teacher_name: string | null;
  room_id: string | null;
  room_name: string | null;
  group_no: number;
}

export interface ExportSlot {
  period_no: number;
  session: string;
  start_time: string;
  end_time: string;
}

const GROUP_TITLES: Record<TimetableExportGroup, string> = {
  class: 'Lớp',
  teacher: 'Giáo viên',
  room: 'Phòng',
};

const time = (value: string) => value.slice(0, 5);

function groupOf(lesson: ExportLesson, group: TimetableExportGroup): { key: string; name: string } | null {
  if (group === 'teacher') {
    return lesson.teacher_user_id ? { key: lesson.teacher_user_id, name: lesson.teacher_name ?? '' } : null;
  }
  if (group === 'room') {
    return lesson.room_id ? { key: lesson.room_id, name: lesson.room_name ?? '' } : null;
  }
  return { key: lesson.class_id, name: lesson.class_name };
}

function cellOf(lesson: ExportLesson, group: TimetableExportGroup): string {
  const others =
    group === 'class'
      ? [lesson.teacher_name, lesson.room_name]
      : group === 'teacher'
        ? [lesson.class_name, lesson.room_name]
        : [lesson.class_name, lesson.teacher_name];
  const subject = lesson.group_no > 0 ? `${lesson.subject_name} (nhóm ${lesson.group_no})` : lesson.subject_name;
  return [subject, ...others.filter((value): value is string => Boolean(value))].join(' · ');
}

// Tên trang tính tối đa 31 ký tự, không có các ký tự \ / ? * [ ] :, không trùng nhau
function sheetTitle(name: string, used: Set<string>): string {
  const base = (name.replace(/[\\/?*[\]:]/g, ' ').trim() || 'Trang').slice(0, 28);
  let title = base;
  for (let index = 2; used.has(title); index += 1) {
    title = `${base} ${index}`;
  }
  used.add(title);
  return title;
}

export function timetableSheets(input: {
  versionName: string;
  effectiveFrom: string;
  group: TimetableExportGroup;
  slots: ExportSlot[];
  lessons: ExportLesson[];
}): TableFileSheet[] {
  const { group, slots, lessons } = input;
  const weekdays = [1, 2, 3, 4, 5, 6, ...(lessons.some((lesson) => lesson.weekday === 7) ? [7] : [])];
  const periods =
    slots.length > 0
      ? slots
      : [...new Set(lessons.map((lesson) => lesson.period_no))]
          .sort((left, right) => left - right)
          .map((periodNo) => ({ period_no: periodNo, session: '', start_time: '', end_time: '' }));
  const groups = new Map<string, { name: string; lessons: ExportLesson[] }>();
  for (const lesson of lessons) {
    const owner = groupOf(lesson, group);
    if (!owner) {
      continue;
    }
    const entry = groups.get(owner.key) ?? { name: owner.name, lessons: [] };
    entry.lessons.push(lesson);
    groups.set(owner.key, entry);
  }
  const columns: TableFileColumn[] = [
    { key: 'period', label: 'Tiết', width: 8 },
    { key: 'time', label: 'Giờ', width: 13 },
    ...weekdays.map((weekday) => ({ key: `d${weekday}`, label: TIMETABLE_WEEKDAY_LABELS[weekday] ?? '', width: 28 })),
  ];
  const used = new Set<string>();
  const effective = input.effectiveFrom.split('-').reverse().join('/');
  return [...groups.values()]
    .sort((left, right) => left.name.localeCompare(right.name, 'vi', { numeric: true }))
    .map((entry) => ({
      title: sheetTitle(entry.name, used),
      heading: [
        `Thời khoá biểu ${GROUP_TITLES[group].toLowerCase()} ${entry.name}`,
        `${input.versionName} · Áp dụng từ ${effective}`,
      ],
      columns,
      rows: periods.map((slot) => {
        const row: Record<string, unknown> = {
          period: slot.period_no,
          time: slot.start_time ? `${time(slot.start_time)}–${time(slot.end_time)}` : '',
        };
        for (const weekday of weekdays) {
          row[`d${weekday}`] = entry.lessons
            .filter((lesson) => lesson.weekday === weekday && lesson.period_no === slot.period_no)
            .map((lesson) => cellOf(lesson, group))
            .join('; ');
        }
        return row;
      }),
    }));
}
