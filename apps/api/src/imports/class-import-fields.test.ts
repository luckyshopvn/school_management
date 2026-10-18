import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyUnderweightOption, countGrowth, type GrowthChildRow } from '../health/growth-summary.js';
import { buildMoetSheet } from './moet-export.js';
import { MOET_CHILD_COLUMNS, MOET_STAFF_COLUMNS } from './moet-columns.js';
import { parseAgeGroup, readClassSoValues } from './class-import-fields.js';

// Hàm thuần của DT-16 phần 16e: đọc cột lớp theo Sở, ô tính cân nặng/chiều cao cho trẻ nhẹ cân, bố cục tệp CSDL ngành
describe('Hàm thuần của DT-16 phần 16e', () => {
  it('CT-16e-13: nhóm tuổi nhận mã hoặc tên, cờ Có/Không, thứ tự và ghép độ tuổi báo lỗi theo cột', () => {
    assert.equal(parseAgeGroup('years_3_4'), 'years_3_4');
    assert.equal(parseAgeGroup('3 - 4 tuổi'), 'years_3_4');
    assert.equal(parseAgeGroup('13–24 THÁNG'), 'months_13_24');
    assert.equal(parseAgeGroup(''), null);
    assert.equal(parseAgeGroup('9 tuổi'), undefined);
    const errors: Array<{ row: number; column: string | null; message: string }> = [];
    const all = new Set(['age_group', 'sort_order', 'two_sessions_per_day', 'mixed_age_count', 'boarding']);
    const values = readClassSoValues(
      2,
      { age_group: '5-6 tuổi', sort_order: '3', two_sessions_per_day: 'x', mixed_age_count: '', boarding: 'Không' },
      all,
      errors,
    );
    assert.deepEqual(values, {
      age_group: 'years_5_6',
      sort_order: 3,
      mixed_age_count: null,
      two_sessions_per_day: true,
      boarding: false,
    });
    readClassSoValues(3, { sort_order: '-1', mixed_age_count: '4', boarding: 'có lẽ' }, all, errors);
    assert.deepEqual(
      errors.map((error) => error.column),
      ['Thứ tự', 'Lớp mẫu giáo ghép 2 hoặc 3 độ tuổi', 'Lớp bán trú'],
    );
    // Cột không chọn thì không đọc
    assert.deepEqual(readClassSoValues(4, { age_group: 'sai' }, new Set(), []), {});
  });

  it('CT-16e-14: tắt ô tính cân nặng/chiều cao thì trẻ nhẹ cân không xếp kênh cân nặng theo chiều cao', () => {
    const row = (id: string, weight: 'underweight' | 'normal', weightHeight: 'wasted' | 'normal') =>
      ({
        child_id: id,
        gender: 'female',
        weight_kg: 10,
        height_cm: 90,
        assessment: { weight_status: weight, height_status: 'normal', weight_height_status: weightHeight },
      }) as unknown as GrowthChildRow;
    const rows = [row('a', 'underweight', 'wasted'), row('b', 'normal', 'wasted')];
    assert.equal(countGrowth(applyUnderweightOption(rows, true)).wasted, 2);
    const off = countGrowth(applyUnderweightOption(rows, false));
    assert.equal(off.wasted, 1);
    assert.equal(off.underweight, 1);
  });

  it('CT-16e-15: tệp CSDL ngành có đúng 82 cột học sinh, 75 cột nhân sự, cột quận/huyện cũ không tên', () => {
    const children = buildMoetSheet(
      MOET_CHILD_COLUMNS,
      [{ core: { full_name: 'Trẻ A', dob: '01/02/2022' }, profile: { status_date: '2026-09-05', can_swim: true } }],
      (text) => text,
    );
    assert.equal(children.headers.length, 82);
    const blank = children.headers.indexOf('Tỉnh/Thành phố (Theo địa chỉ thường trú)') + 1;
    assert.equal(children.headers[blank], '');
    const record = children.rows[0] ?? [];
    assert.equal(record[0], '1');
    assert.equal(record[children.headers.indexOf('Ngày nhập trạng thái')], '05/09/2026');
    assert.equal(record[children.headers.indexOf('Học sinh biết bơi')], 'x');
    assert.equal(buildMoetSheet(MOET_STAFF_COLUMNS, [], (text) => text).headers.length, 75);
  });
});
