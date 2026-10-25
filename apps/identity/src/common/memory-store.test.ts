import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemoryStore } from './memory-store.js';

// Kho khóa trong bộ nhớ của hồ sơ thử nghiệm (DT-SaaS phần S9): đúng các lệnh dịch vụ định danh dùng, có hạn sống
describe('kho khóa trong bộ nhớ', () => {
  it('set có hạn sống, incr, expire, del, multi get rồi del', async () => {
    let now = 1_000_000;
    const store = new MemoryStore(() => now);
    await store.set('captcha:1', 'ABC', 'EX', 60);
    assert.equal(await store.get('captcha:1'), 'ABC');
    now += 61_000;
    assert.equal(await store.get('captcha:1'), null);

    assert.equal(await store.incr('dem'), 1);
    assert.equal(await store.incr('dem'), 2);
    assert.equal(await store.expire('dem', 10), 1);
    now += 5_000;
    assert.equal(await store.get('dem'), '2');
    assert.equal(await store.incr('dem'), 3);
    now += 6_000;
    assert.equal(await store.get('dem'), null);
    assert.equal(await store.expire('khong-co', 10), 0);

    await store.set('captcha:2', 'XYZ', 'EX', 60);
    const results = await store.multi().get('captcha:2').del('captcha:2').exec();
    assert.deepEqual(results, [
      [null, 'XYZ'],
      [null, 1],
    ]);
    assert.equal(await store.get('captcha:2'), null);
    assert.equal(await store.del('captcha:2'), 0);
  });
});
