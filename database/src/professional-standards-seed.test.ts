import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { seedCriteria } from '../school-year/migrations/0047_create_standards_and_groups.js';

// Danh mục chuẩn nghề nghiệp gieo sẵn khớp văn bản gốc (YCTD-397, lỗi L-41): Thông tư 26/2018/TT-BGDĐT (giáo viên mầm non)
// và Thông tư 25/2018/TT-BGDĐT (hiệu trưởng mầm non), Điều 4 đến 8 (tiêu chí) và Điều 10 khoản 2 (tiêu chí xét ở mức Khá,
// Tốt). Kịch bản CT-2180, CT-2181
const keyNumbers = (standardType: 'teacher' | 'principal') =>
  seedCriteria(standardType)
    .filter((criterion) => criterion.isKey)
    .map((criterion) => criterion.number);

const numbersOf = (standardType: 'teacher' | 'principal', standardCode: string) =>
  seedCriteria(standardType)
    .filter((criterion) => criterion.standardCode === standardCode)
    .map((criterion) => criterion.number);

describe('Danh mục chuẩn nghề nghiệp mầm non gieo sẵn', () => {
  it('CT-2180: giáo viên mầm non 15 tiêu chí; tiêu chí xét ở mức Khá, Tốt là 1, 3, 4, 5, 6, 7, 8, 9', () => {
    assert.equal(seedCriteria('teacher').length, 15);
    assert.deepEqual(numbersOf('teacher', 'TC2'), [3, 4, 5, 6, 7, 8]);
    assert.deepEqual(numbersOf('teacher', 'TC3'), [9, 10]);
    assert.deepEqual(keyNumbers('teacher'), [1, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('CT-2181: hiệu trưởng mầm non 18 tiêu chí theo đúng tiêu chuẩn; tiêu chí xét ở mức Khá, Tốt là 1, 4, 5, 6, 7, 9, 11, 13, 14, 15', () => {
    assert.equal(seedCriteria('principal').length, 18);
    assert.deepEqual(numbersOf('principal', 'TC1'), [1, 2, 3]);
    assert.deepEqual(numbersOf('principal', 'TC2'), [4, 5, 6, 7, 8, 9, 10, 11]);
    assert.deepEqual(numbersOf('principal', 'TC3'), [12, 13, 14]);
    assert.deepEqual(numbersOf('principal', 'TC4'), [15, 16]);
    assert.deepEqual(numbersOf('principal', 'TC5'), [17, 18]);
    const byNumber = new Map(seedCriteria('principal').map((criterion) => [criterion.number, criterion.name]));
    assert.equal(byNumber.get(5), 'Quản trị hoạt động nuôi dưỡng, chăm sóc sức khỏe của trẻ em');
    assert.equal(byNumber.get(6), 'Quản trị hoạt động giáo dục trẻ em');
    assert.equal(byNumber.get(18), 'Ứng dụng công nghệ thông tin');
    assert.deepEqual(keyNumbers('principal'), [1, 4, 5, 6, 7, 9, 11, 13, 14, 15]);
  });
});
