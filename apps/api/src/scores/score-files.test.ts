import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  readScoreRows,
  regularColumnCount,
  scoreImportColumns,
  scorePrintSheet,
  scoreTemplateRows,
  type ScoreSheetRow,
} from './score-files.js';

// Tệp mẫu nhập, đọc tệp đã điền và bảng in của sổ điểm (YCTD-318)
const anh: ScoreSheetRow = {
  child_id: 'hs-anh',
  full_name: 'Nguyễn Minh Anh',
  regular: [9, 8.5],
  mid: 8.5,
  final: null,
  average: null,
  result: null,
  comment: 'Tư duy tốt',
};
const bao: ScoreSheetRow = {
  ...anh,
  child_id: 'hs-bao',
  full_name: 'Trần Gia Bảo',
  regular: [],
  mid: null,
  comment: null,
};

describe('Tệp của sổ điểm', () => {
  it('số cột TX đủ số lần tối thiểu và số điểm đang có nhiều nhất', () => {
    assert.equal(regularColumnCount([anh, bao], 3), 3);
    assert.equal(regularColumnCount([{ ...anh, regular: [1, 2, 3, 4] }], 2), 4);
    assert.equal(regularColumnCount([], 0), 1);
  });

  it('tệp mẫu: mã hệ thống, STT, họ tên, TX, Giữa kỳ, Cuối kỳ, Nhận xét; điểm ghi dấu phẩy', () => {
    assert.deepEqual(
      scoreImportColumns('score', 3).map((column) => column.header),
      ['Mã hệ thống', 'STT', 'Họ và tên', 'TX1', 'TX2', 'TX3', 'Giữa kỳ', 'Cuối kỳ', 'Nhận xét'],
    );
    assert.deepEqual(
      scoreImportColumns('comment', 3).map((column) => column.header),
      ['Mã hệ thống', 'STT', 'Họ và tên', 'Kết quả', 'Nhận xét'],
    );
    const [first] = scoreTemplateRows([anh], 3);
    assert.equal(first?.tx1, '9');
    assert.equal(first?.tx2, '8,5');
    assert.equal(first?.tx3, '');
    assert.equal(first?.mid, '8,5');
    assert.equal(first?.final, '');
  });

  it('đọc tệp: dấu phẩy, dấu chấm; ô trống là chưa có điểm; bỏ dòng không có mã', () => {
    const { entries, errors } = readScoreRows(
      [
        {
          row: 2,
          values: { child_id: 'hs-anh', tx1: '9', tx2: '8.5', tx3: '', mid: '8,5', final: '7', comment: ' Tốt ' },
        },
        { row: 3, values: { child_id: '', full_name: 'Dòng trống' } },
        { row: 4, values: { child_id: 'hs-bao', tx1: '', tx2: '6', tx3: '' } },
      ],
      { mode: 'score', regularCount: 3, studentIds: new Set(['hs-anh', 'hs-bao']) },
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(entries, [
      { child_id: 'hs-anh', regular: [9, 8.5], mid: 8.5, final: 7, result: null, comment: 'Tốt' },
      { child_id: 'hs-bao', regular: [null, 6], mid: null, final: null, result: null, comment: null },
    ]);
  });

  it('báo lỗi theo dòng: điểm ngoài 0–10 hoặc hai chữ số thập phân, mã không thuộc lớp, mã trùng, kết quả sai', () => {
    const scores = readScoreRows(
      [
        { row: 2, values: { child_id: 'hs-anh', tx1: '11', mid: '8,25' } },
        { row: 3, values: { child_id: 'hs-khac' } },
        { row: 4, values: { child_id: 'hs-anh' } },
      ],
      { mode: 'score', regularCount: 1, studentIds: new Set(['hs-anh']) },
    );
    assert.deepEqual(
      scores.errors.map((error) => [error.row, error.column]),
      [
        [2, 'TX1'],
        [2, 'Giữa kỳ'],
        [3, 'Mã hệ thống'],
        [4, 'Mã hệ thống'],
      ],
    );
    const comments = readScoreRows(
      [
        { row: 2, values: { child_id: 'hs-anh', result: 'Đạt' } },
        { row: 3, values: { child_id: 'hs-bao', result: 'Tốt' } },
      ],
      { mode: 'comment', regularCount: 1, studentIds: new Set(['hs-anh', 'hs-bao']) },
    );
    assert.equal(comments.entries[0]?.result, 'pass');
    assert.deepEqual(
      comments.errors.map((error) => [error.row, error.column]),
      [[3, 'Kết quả']],
    );
  });

  it('bảng in: tiêu đề lớp, môn, học kỳ; cột TB môn HK; có STT', () => {
    const sheet = scorePrintSheet({
      className: '7A3',
      subjectName: 'Toán',
      termLabel: 'Học kỳ I',
      mode: 'score',
      regularCount: 2,
      rows: [{ ...anh, average: 8.6 }],
    });
    assert.deepEqual(sheet.heading, ['Sổ điểm lớp 7A3 · Toán', 'Học kỳ I']);
    assert.equal(sheet.numbered, true);
    assert.deepEqual(
      sheet.columns.map((column) => column.label),
      ['Họ và tên', 'TX1', 'TX2', 'Giữa kỳ', 'Cuối kỳ', 'TB môn HK', 'Nhận xét'],
    );
    assert.equal(sheet.rows[0]?.average, '8,6');
  });
});
