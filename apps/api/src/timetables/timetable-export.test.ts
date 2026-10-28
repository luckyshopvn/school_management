import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { timetableSheets, type ExportLesson } from './timetable-export.js';

// Xuất thời khoá biểu ra Excel (YCTD-317): lưới tiết theo thứ cho từng lớp, giáo viên, phòng
const lesson = (values: Partial<ExportLesson>): ExportLesson => ({
  class_id: 'lop-6a1',
  class_name: '6A1',
  weekday: 1,
  period_no: 1,
  subject_name: 'Toán',
  teacher_user_id: 'gv-ha',
  teacher_name: 'Nguyễn Thu Hà',
  room_id: 'phong-204',
  room_name: 'Phòng 204',
  group_no: 0,
  ...values,
});
const slots = [
  { period_no: 1, session: 'morning', start_time: '07:00:00', end_time: '07:45:00' },
  { period_no: 2, session: 'morning', start_time: '07:50:00', end_time: '08:35:00' },
];
const lessons = [
  lesson({}),
  lesson({
    weekday: 2,
    period_no: 2,
    subject_name: 'Ngữ văn',
    teacher_user_id: 'gv-phuc',
    teacher_name: 'Lê Văn Phúc',
  }),
  lesson({ class_id: 'lop-6a2', class_name: '6A2', weekday: 1, period_no: 2 }),
  lesson({
    class_id: 'lop-6a2',
    class_name: '6A2',
    weekday: 3,
    period_no: 1,
    subject_name: 'Tin học',
    group_no: 1,
    room_id: null,
    room_name: null,
  }),
];

describe('Xuất thời khoá biểu ra Excel', () => {
  it('theo lớp: mỗi lớp một trang, dòng là tiết kèm giờ, ô ghi môn, giáo viên, phòng', () => {
    const sheets = timetableSheets({
      versionName: 'Học kỳ I',
      effectiveFrom: '2026-09-07',
      group: 'class',
      slots,
      lessons,
    });
    assert.deepEqual(
      sheets.map((sheet) => sheet.title),
      ['6A1', '6A2'],
    );
    const first = sheets[0];
    assert.deepEqual(first?.heading, ['Thời khoá biểu lớp 6A1', 'Học kỳ I · Áp dụng từ 07/09/2026']);
    assert.deepEqual(
      first?.columns.map((column) => column.label),
      ['Tiết', 'Giờ', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'],
    );
    assert.equal(first?.rows[0]?.time, '07:00–07:45');
    assert.equal(first?.rows[0]?.d1, 'Toán · Nguyễn Thu Hà · Phòng 204');
    assert.equal(first?.rows[1]?.d2, 'Ngữ văn · Lê Văn Phúc · Phòng 204');
    assert.equal(sheets[1]?.rows[0]?.d3, 'Tin học (nhóm 1) · Nguyễn Thu Hà');
  });

  it('theo giáo viên: ô ghi môn, lớp, phòng; tiết không có giáo viên không có trang', () => {
    const sheets = timetableSheets({
      versionName: 'Học kỳ I',
      effectiveFrom: '2026-09-07',
      group: 'teacher',
      slots,
      lessons: [...lessons, lesson({ teacher_user_id: null, teacher_name: null, weekday: 5 })],
    });
    assert.deepEqual(
      sheets.map((sheet) => sheet.title),
      ['Lê Văn Phúc', 'Nguyễn Thu Hà'],
    );
    const ha = sheets[1];
    assert.equal(ha?.rows[1]?.d1, 'Toán · 6A2 · Phòng 204');
    assert.equal(ha?.rows[0]?.d5, '');
  });

  it('theo phòng: tiết không có phòng bỏ qua; có tiết chủ nhật thì thêm cột Chủ nhật', () => {
    const sheets = timetableSheets({
      versionName: 'Hè',
      effectiveFrom: '2026-06-01',
      group: 'room',
      slots: [],
      lessons: [...lessons, lesson({ weekday: 7, period_no: 3 })],
    });
    assert.equal(sheets.length, 1);
    assert.equal(sheets[0]?.columns.at(-1)?.label, 'Chủ nhật');
    // Không có khung giờ thì dòng lấy theo số tiết có trong bản
    assert.deepEqual(
      sheets[0]?.rows.map((row) => row.period),
      [1, 2, 3],
    );
    assert.equal(sheets[0]?.rows[2]?.d7, 'Toán · 6A1 · Nguyễn Thu Hà');
  });

  it('tên trang tính bỏ ký tự không hợp lệ và không trùng nhau', () => {
    const sheets = timetableSheets({
      versionName: 'Học kỳ I',
      effectiveFrom: '2026-09-07',
      group: 'class',
      slots,
      lessons: [lesson({ class_id: 'a', class_name: '6/1' }), lesson({ class_id: 'b', class_name: '6:1' })],
    });
    assert.deepEqual(
      sheets.map((sheet) => sheet.title),
      ['6 1', '6 1 2'],
    );
  });
});
