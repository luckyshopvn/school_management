import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toolboxLinkSearch, withToolboxSearch } from './toolbox-link.ts';

// Đường dẫn của Hộp công cụ giảng dạy (DT-29, YCTD-325); lọc công cụ kiểm ở apps/api/src/classroom-tools/teaching-tools.test.ts
describe('Hộp công cụ giảng dạy: đường dẫn', () => {
  it('CT-29a-4: đường dẫn mở Hộp công cụ, tên cũ đổi sang tên mới, giữ tham số khác', () => {
    assert.equal(toolboxLinkSearch('?man=hop-cong-cu'), '?man=hop-cong-cu');
    assert.equal(toolboxLinkSearch('?a=1&man=cong-cu-lop-hoc'), '?a=1&man=hop-cong-cu');
    assert.equal(toolboxLinkSearch('?man=khac'), null);
    assert.equal(toolboxLinkSearch(''), null);
    assert.equal(withToolboxSearch('?a=1', true), '?a=1&man=hop-cong-cu');
    assert.equal(withToolboxSearch('?man=hop-cong-cu', false), '');
  });
});
