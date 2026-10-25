import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemoryFileStorage } from '../files/file-storage.js';
import { purgeSchoolStorage } from './school-lifecycle-command.js';

// Xóa tệp của một trường khi xóa vĩnh viễn (DT-SaaS phần S2): chỉ đúng tiền tố của trường, không đụng trường có mã bắt đầu giống
describe('xóa tệp của trường ở kho tệp', () => {
  it('chỉ xóa tệp có tiền tố tenants/<tiền tố>/', async () => {
    const storage = new MemoryFileStorage();
    await storage.put('tenants/gamma/a/1.pdf', Buffer.from('a'));
    await storage.put('tenants/gamma/b/2.pdf', Buffer.from('b'));
    await storage.put('tenants/gamma-2/a/1.pdf', Buffer.from('c'));
    await storage.put('khac/gamma/1.pdf', Buffer.from('d'));
    assert.equal(await purgeSchoolStorage(storage, 'gamma'), 2);
    assert.equal(storage.has('tenants/gamma/a/1.pdf'), false);
    assert.equal(storage.has('tenants/gamma-2/a/1.pdf'), true);
    assert.equal(storage.has('khac/gamma/1.pdf'), true);
  });

  it('từ chối tiền tố rỗng hoặc có ký tự lạ', async () => {
    const storage = new MemoryFileStorage();
    await assert.rejects(() => purgeSchoolStorage(storage, ''));
    await assert.rejects(() => purgeSchoolStorage(storage, '../x'));
  });
});
