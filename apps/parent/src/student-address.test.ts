import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { studentAppRedirect } from './student-address.ts';

describe('Chuyển địa chỉ cũ #hoc-sinh sang ứng dụng học sinh (YCTD-300)', () => {
  it('cùng tên miền: /hoc-sinh/ tính theo gốc tên miền, kể cả khi ứng dụng phụ huynh nằm dưới /phu-huynh/', () => {
    assert.equal(
      studentAppRedirect('https://phuhuynh.truong.test/#hoc-sinh', '/hoc-sinh/'),
      'https://phuhuynh.truong.test/hoc-sinh/',
    );
    assert.equal(
      studentAppRedirect('https://truong.test/phu-huynh/#hoc-sinh', '/hoc-sinh/'),
      'https://truong.test/hoc-sinh/',
    );
  });

  it('địa chỉ tuyệt đối khi phát triển; bỏ phần sau #hoc-sinh', () => {
    assert.equal(
      studentAppRedirect('http://localhost:5175/#hoc-sinh/bai-thi', 'http://localhost:5179/'),
      'http://localhost:5179/',
    );
  });

  it('địa chỉ khác của ứng dụng phụ huynh thì không chuyển', () => {
    assert.equal(studentAppRedirect('https://truong.test/phu-huynh/', '/hoc-sinh/'), undefined);
    assert.equal(studentAppRedirect('https://truong.test/phu-huynh/#tuyen-sinh', '/hoc-sinh/'), undefined);
  });
});
