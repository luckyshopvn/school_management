import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSingleFlight } from './proctor-single-flight.ts';

describe('Một yêu cầu mở phiên xem camera mỗi bài làm (YCTD-355)', () => {
  it('yêu cầu đến sau khi yêu cầu trước chưa xong dùng lại kết quả, chỉ gọi máy chủ một lần', async () => {
    const run = createSingleFlight<string>();
    let calls = 0;
    let finish: (value: string) => void = () => undefined;
    const start = () => {
      calls += 1;
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    };
    const first = run('bai-1', start);
    const second = run('bai-1', start);
    finish('phien-1');
    assert.deepEqual(await Promise.all([first, second]), ['phien-1', 'phien-1']);
    assert.equal(calls, 1);
  });

  it('khoá khác nhau chạy riêng; xong rồi thì yêu cầu sau gọi lại máy chủ', async () => {
    const run = createSingleFlight<string>();
    let calls = 0;
    const start = (value: string) => () => {
      calls += 1;
      return Promise.resolve(value);
    };
    assert.deepEqual(await Promise.all([run('bai-1', start('a')), run('bai-2', start('b'))]), ['a', 'b']);
    assert.equal(await run('bai-1', start('c')), 'c');
    assert.equal(calls, 3);
  });

  it('yêu cầu lỗi thì các bên chờ cùng nhận lỗi, lần sau được thử lại', async () => {
    const run = createSingleFlight<string>();
    const failing = () => Promise.reject(new Error('Phiên xem đã kết thúc'));
    const first = run('bai-1', failing);
    const second = run('bai-1', () => Promise.resolve('không gọi'));
    await assert.rejects(first, /Phiên xem đã kết thúc/);
    await assert.rejects(second, /Phiên xem đã kết thúc/);
    assert.equal(await run('bai-1', () => Promise.resolve('phien-2')), 'phien-2');
  });
});
