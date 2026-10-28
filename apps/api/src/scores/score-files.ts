import { isValidScore } from '@school-management/shared';
import type { TableFileColumn, TableFileSheet } from '../exports/table-file.js';
import type { ImportColumn, RowError, SheetRow } from '../imports/excel.js';

// Tệp của sổ điểm một môn ở một lớp, một học kỳ (YCTD-318): tệp mẫu nhập kèm danh sách học sinh và điểm đang có, đọc tệp
// đã điền thành các dòng ghi điểm, bảng in sổ. Học sinh nhận theo mã hệ thống ở cột đầu (không đổi khi đổi tên, xếp lại);
// điểm ghi dấu phẩy hoặc dấu chấm thập phân; ô trống là chưa có điểm
export interface ScoreSheetRow {
  child_id: string;
  full_name: string;
  regular: number[];
  mid: number | null;
  final: number | null;
  average: number | null;
  result: 'pass' | 'fail' | null;
  comment: string | null;
}

export interface ScoreEntryInput {
  child_id: string;
  regular: Array<number | null>;
  mid: number | null;
  final: number | null;
  result: 'pass' | 'fail' | null;
  comment: string | null;
}

export type ScoreSubjectMode = 'score' | 'comment';

const RESULT_TEXT: Record<'pass' | 'fail', string> = { pass: 'Đạt', fail: 'Chưa đạt' };
const MAX_REGULAR = 10;

const scoreText = (value: number | null) => (value === null ? '' : String(value).replace('.', ','));

// Số cột đánh giá thường xuyên: đủ số lần tối thiểu của môn và đủ số điểm đang có nhiều nhất trong lớp
export function regularColumnCount(rows: ScoreSheetRow[], requiredRegular: number): number {
  return Math.min(MAX_REGULAR, Math.max(1, requiredRegular, ...rows.map((row) => row.regular.length)));
}

export function scoreImportColumns(mode: ScoreSubjectMode, regularCount: number): ImportColumn[] {
  const head: ImportColumn[] = [
    { key: 'child_id', header: 'Mã hệ thống', note: 'Không sửa cột này: mã nhận học sinh' },
    { key: 'no', header: 'STT', note: 'Chỉ để xem' },
    { key: 'full_name', header: 'Họ và tên', note: 'Chỉ để xem' },
  ];
  const marks: ImportColumn[] =
    mode === 'comment'
      ? [{ key: 'result', header: 'Kết quả', note: 'Ghi Đạt hoặc Chưa đạt, để trống là chưa đánh giá' }]
      : [
          ...Array.from({ length: regularCount }, (_, index) => ({
            key: `tx${index + 1}`,
            header: `TX${index + 1}`,
            note: 'Điểm đánh giá thường xuyên từ 0 đến 10, một chữ số thập phân, ví dụ 8,5',
          })),
          { key: 'mid', header: 'Giữa kỳ', note: 'Điểm từ 0 đến 10, một chữ số thập phân' },
          { key: 'final', header: 'Cuối kỳ', note: 'Điểm từ 0 đến 10, một chữ số thập phân' },
        ];
  return [...head, ...marks, { key: 'comment', header: 'Nhận xét', note: 'Tối đa 1000 ký tự' }];
}

export function scoreTemplateRows(rows: ScoreSheetRow[], regularCount: number): Array<Record<string, unknown>> {
  return rows.map((row, index) => ({
    child_id: row.child_id,
    no: index + 1,
    full_name: row.full_name,
    ...Object.fromEntries(
      Array.from({ length: regularCount }, (_, position) => [
        `tx${position + 1}`,
        scoreText(row.regular[position] ?? null),
      ]),
    ),
    mid: scoreText(row.mid),
    final: scoreText(row.final),
    result: row.result ? RESULT_TEXT[row.result] : '',
    comment: row.comment ?? '',
  }));
}

function readScore(text: string | undefined, row: number, column: string, errors: RowError[]): number | null {
  const value = (text ?? '').trim();
  if (value === '') {
    return null;
  }
  const number = Number(value.replace(',', '.'));
  if (!isValidScore(number)) {
    errors.push({ row, column, message: 'Điểm là số từ 0 đến 10, một chữ số thập phân' });
    return null;
  }
  return number;
}

// Đọc các dòng của tệp đã điền: dòng không có mã hệ thống bỏ qua (dòng trống); mã không thuộc lớp hoặc trùng là lỗi
export function readScoreRows(
  sheetRows: SheetRow[],
  input: { mode: ScoreSubjectMode; regularCount: number; studentIds: Set<string> },
): { entries: ScoreEntryInput[]; errors: RowError[] } {
  const errors: RowError[] = [];
  const entries: ScoreEntryInput[] = [];
  const seen = new Set<string>();
  for (const { row, values } of sheetRows) {
    const childId = values.child_id?.trim() ?? '';
    if (childId === '') {
      continue;
    }
    if (!input.studentIds.has(childId)) {
      errors.push({ row, column: 'Mã hệ thống', message: 'Không có học sinh này trong lớp' });
      continue;
    }
    if (seen.has(childId)) {
      errors.push({ row, column: 'Mã hệ thống', message: 'Học sinh đã có ở dòng trên' });
      continue;
    }
    seen.add(childId);
    const comment = values.comment?.trim() ?? '';
    if (comment.length > 1000) {
      errors.push({ row, column: 'Nhận xét', message: 'Nhận xét tối đa 1000 ký tự' });
    }
    if (input.mode === 'comment') {
      const resultText = values.result?.trim().toLowerCase() ?? '';
      const result =
        resultText === '' ? null : resultText === 'đạt' ? 'pass' : resultText === 'chưa đạt' ? 'fail' : undefined;
      if (result === undefined) {
        errors.push({ row, column: 'Kết quả', message: 'Ghi Đạt hoặc Chưa đạt' });
      }
      entries.push({
        child_id: childId,
        regular: [],
        mid: null,
        final: null,
        result: result ?? null,
        comment: comment || null,
      });
      continue;
    }
    // Điểm thường xuyên giữ đúng vị trí cột; ô trống ở giữa là chưa có điểm của lần đó
    const regular = Array.from({ length: input.regularCount }, (_, index) =>
      readScore(values[`tx${index + 1}`], row, `TX${index + 1}`, errors),
    );
    while (regular.length > 0 && regular.at(-1) === null) {
      regular.pop();
    }
    entries.push({
      child_id: childId,
      regular,
      mid: readScore(values.mid, row, 'Giữa kỳ', errors),
      final: readScore(values.final, row, 'Cuối kỳ', errors),
      result: null,
      comment: comment || null,
    });
  }
  return { entries, errors };
}

// Bảng in sổ điểm: STT, họ tên, điểm theo cột như màn hình, trung bình môn học kỳ, nhận xét
export function scorePrintSheet(input: {
  className: string;
  subjectName: string;
  termLabel: string;
  mode: ScoreSubjectMode;
  regularCount: number;
  rows: ScoreSheetRow[];
}): TableFileSheet {
  const columns: TableFileColumn[] = [
    { key: 'full_name', label: 'Họ và tên', width: 26 },
    ...(input.mode === 'comment'
      ? [{ key: 'result', label: 'Kết quả', width: 12 }]
      : [
          ...Array.from({ length: input.regularCount }, (_, index) => ({
            key: `tx${index + 1}`,
            label: `TX${index + 1}`,
            width: 7,
          })),
          { key: 'mid', label: 'Giữa kỳ', width: 9 },
          { key: 'final', label: 'Cuối kỳ', width: 9 },
          { key: 'average', label: 'TB môn HK', width: 11 },
        ]),
    { key: 'comment', label: 'Nhận xét', width: 34 },
  ];
  return {
    title: 'Sổ điểm',
    heading: [`Sổ điểm lớp ${input.className} · ${input.subjectName}`, input.termLabel],
    columns,
    numbered: true,
    rows: input.rows.map((row) => ({
      ...scoreTemplateRows([row], input.regularCount)[0],
      average: scoreText(row.average),
    })),
  };
}
