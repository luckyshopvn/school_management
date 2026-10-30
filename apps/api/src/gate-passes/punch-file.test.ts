import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { parseCsv, parseDirection, parseVietnamDateTime, readPunchFile, rowsToPunches } from './punch-file.js';

// Đọc tệp máy chấm công (YCTD-389 lát L2): CSV, Excel, giờ Việt Nam, giá trị biên
describe('Đọc tệp máy chấm công', () => {
  it('giờ Việt Nam ở hai dạng ngày; ngày không có thật, giờ sai bị từ chối', () => {
    assert.equal(parseVietnamDateTime('2026-10-30 07:12')?.toISOString(), '2026-10-30T00:12:00.000Z');
    assert.equal(parseVietnamDateTime('30/10/2026 07:12:05')?.toISOString(), '2026-10-30T00:12:05.000Z');
    assert.equal(parseVietnamDateTime('2026-10-30 00:30')?.toISOString(), '2026-10-29T17:30:00.000Z');
    assert.equal(parseVietnamDateTime('31/02/2026 07:00'), null);
    assert.equal(parseVietnamDateTime('2026-10-30 24:00'), null);
    assert.equal(parseVietnamDateTime('2026-10-30'), null);
  });

  it('hướng có dấu hoặc không dấu, tiếng Anh; ô trống là không có hướng', () => {
    assert.equal(parseDirection('Vào'), 'in');
    assert.equal(parseDirection('RA'), 'out');
    assert.equal(parseDirection('out'), 'out');
    assert.equal(parseDirection(''), null);
    assert.equal(parseDirection('trưa'), 'invalid');
  });

  it('CSV chấm phẩy có BOM và ô trong ngoặc kép; tiêu đề không dấu vẫn nhận', () => {
    const table = parseCsv(
      '\uFEFFMa;Thoi diem;Huong\r\n"AB;CD";2026-10-30 07:00;vao\r\n\r\nNS001;30/10/2026 16:30;ra\r\n',
    );
    const rows = rowsToPunches(table);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.code, 'AB;CD');
    assert.equal(rows[0]?.direction, 'in');
    assert.equal(rows[1]?.line, 4);
    assert.equal(rows[1]?.direction, 'out');
  });

  it('dòng thiếu mã, thời điểm sai, hướng sai có lỗi riêng; thiếu cột bắt buộc thì cả tệp lỗi', () => {
    const rows = rowsToPunches([
      ['Mã', 'Thời điểm', 'Hướng'],
      ['', '2026-10-30 07:00', ''],
      ['NS001', 'sáng nay', ''],
      ['NS001', '2026-10-30 07:00', 'trưa'],
    ]);
    assert.deepEqual(
      rows.map((row) => row.error === null),
      [false, false, false],
    );
    assert.throws(() => rowsToPunches([['Mã', 'Hướng']]), /Thời điểm/);
  });

  it('Excel xlsx: ô ngày giờ đọc theo con số trên tệp; tệp lạ bị từ chối', async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Chấm công');
    sheet.addRow(['Mã', 'Thời điểm']);
    sheet.addRow(['NS001', new Date(Date.UTC(2026, 9, 30, 7, 5, 0))]);
    sheet.addRow(['NS002', '2026-10-30 07:06']);
    const rows = await readPunchFile('may.xlsx', Buffer.from(await book.xlsx.writeBuffer()));
    assert.equal(rows[0]?.occurredAt?.toISOString(), '2026-10-30T00:05:00.000Z');
    assert.equal(rows[1]?.occurredAt?.toISOString(), '2026-10-30T00:06:00.000Z');
    await assert.rejects(readPunchFile('may.txt', Buffer.from('Mã,Thời điểm')), /CSV hoặc Excel/);
  });
});
