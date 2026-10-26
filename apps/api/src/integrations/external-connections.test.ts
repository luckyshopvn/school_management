import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  createDatabase,
  createMigratedTestDatabase,
  dropDatabaseIfExists,
  migrateToLatest,
  readConnectionString,
  replaceDatabaseName,
  type SystemDatabase,
} from '@school-management/database';
import type { Kysely } from 'kysely';
import { readIntegrationConfiguration } from '../common/configuration.js';
import { decryptSecret } from '../common/secret-encryption.js';
import { GraphApiFacebookPublisher, type FetchFunction } from './facebook-publisher.js';
import { OfficialAccountZaloSender, ZALO_GET_OA_URL, ZALO_MESSAGE_URL } from './zalo-sender.js';
import { ZALO_REFRESH_URL, ZaloTokenStore } from './zalo-token-store.js';

// Kết nối thật Fanpage và Zalo Official Account với lời gọi mạng giả (DT-12 phần 12c, YCTD-92): làm mới khóa Zalo luân phiên,
// gửi đồng thời chỉ làm mới một lần, lỗi -216 làm mới rồi thử lại, Facebook đăng bài không hình, kiểm tra cấu hình khởi động
interface Call {
  url: string;
  init: RequestInit | undefined;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('Kết nối thật Fanpage và Zalo Official Account', () => {
  const baseSystemUrl = readConnectionString('system');
  const databaseName = `school_system_test_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
  const key = randomBytes(32);
  let system: Kysely<SystemDatabase>;
  let now = new Date('2026-10-13T08:00:00Z');

  before(async () => {
    await createMigratedTestDatabase(baseSystemUrl, databaseName, 'system');
    const url = replaceDatabaseName(baseSystemUrl, databaseName);
    const migration = await migrateToLatest('system', url);
    if (migration.error) {
      throw migration.error;
    }
    system = createDatabase<SystemDatabase>(url);
  });

  after(async () => {
    await system.destroy();
    await dropDatabaseIfExists(baseSystemUrl, databaseName);
  });

  beforeEach(async () => {
    await system.deleteFrom('integration_credentials').execute();
    now = new Date('2026-10-13T08:00:00Z');
  });

  // Zalo giả: mỗi lần làm mới cấp khóa truy cập và khóa làm mới mới; khóa làm mới cũ dùng lại thì báo lỗi như Zalo thật
  function fakeZalo(options: { rejectAccessTokens?: Set<string>; refreshDelayMs?: number } = {}) {
    const calls: Call[] = [];
    let validRefreshToken = 'refresh-0';
    let generation = 0;
    const fetcher: FetchFunction = async (url, init) => {
      calls.push({ url, init });
      if (url === ZALO_REFRESH_URL) {
        if (options.refreshDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.refreshDelayMs));
        }
        const body = new URLSearchParams(String(init?.body));
        const headers = init?.headers as Record<string, string>;
        assert.equal(headers.secret_key, 'app-secret');
        assert.equal(body.get('app_id'), 'app-id');
        assert.equal(body.get('grant_type'), 'refresh_token');
        if (body.get('refresh_token') !== validRefreshToken) {
          return json({ error: -14014, error_description: 'Invalid refresh token' });
        }
        generation += 1;
        validRefreshToken = `refresh-${generation}`;
        return json({ access_token: `access-${generation}`, refresh_token: validRefreshToken, expires_in: '90000' });
      }
      const accessToken = (init?.headers as Record<string, string>).access_token ?? '';
      if (options.rejectAccessTokens?.has(accessToken)) {
        return json({ error: -216, message: 'Access token is invalid' });
      }
      if (url === ZALO_GET_OA_URL) {
        return json({ error: 0, message: 'Success', data: { oa_id: '4321', name: 'Trường Mầm non' } });
      }
      return json({ error: 0, message: 'Success', data: { message_id: 'm1' } });
    };
    return { calls, fetcher, refreshCalls: () => calls.filter((call) => call.url === ZALO_REFRESH_URL).length };
  }

  function store(fetcher: FetchFunction, seed: { refresh?: string | null; access?: string | null } = {}) {
    return new ZaloTokenStore(system, key, {
      appId: 'app-id',
      appSecret: 'app-secret',
      seedRefreshToken: seed.refresh === undefined ? 'refresh-0' : seed.refresh,
      seedAccessToken: seed.access ?? null,
      fetcher,
      now: () => now,
    });
  }

  const savedRow = () =>
    system.selectFrom('integration_credentials').selectAll().where('connector', '=', 'zalo').executeTakeFirstOrThrow();

  it('CT-12c-1: kho trống lấy khóa làm mới ở biến môi trường, làm mới và lưu mã hóa khóa luân phiên', async () => {
    const zalo = fakeZalo();
    const tokens = store(zalo.fetcher);
    const sender = new OfficialAccountZaloSender(tokens, zalo.fetcher);
    await sender.send('zalo-user-a', 'Xin chào');
    assert.equal(zalo.refreshCalls(), 1);
    const message = zalo.calls.find((call) => call.url === ZALO_MESSAGE_URL);
    assert.equal((message?.init?.headers as Record<string, string>).access_token, 'access-1');
    assert.deepEqual(JSON.parse(String(message?.init?.body)), {
      recipient: { user_id: 'zalo-user-a' },
      message: { text: 'Xin chào' },
    });
    const row = await savedRow();
    // Lưu bản mã, không lưu khóa ở dạng đọc được
    assert.ok(row.refresh_token_encrypted && !row.refresh_token_encrypted.includes('refresh-1'));
    assert.equal(decryptSecret(key, row.refresh_token_encrypted ?? ''), 'refresh-1');
    assert.equal(decryptSecret(key, row.access_token_encrypted ?? ''), 'access-1');
    assert.equal(row.access_token_expires_at?.getTime(), now.getTime() + 90_000_000);

    // Còn hạn thì dùng lại khóa, không làm mới
    await sender.send('zalo-user-a', 'Lần hai');
    assert.equal(zalo.refreshCalls(), 1);

    // Còn dưới 5 phút thì làm mới bằng khóa làm mới mới nhất (khóa cũ đã bị vô hiệu)
    now = new Date(now.getTime() + 90_000_000 - 4 * 60_000);
    await sender.send('zalo-user-a', 'Lần ba');
    assert.equal(zalo.refreshCalls(), 2);
    assert.equal(decryptSecret(key, (await savedRow()).refresh_token_encrypted ?? ''), 'refresh-2');

    // Tiến trình mới (kho khác) đọc khóa đã lưu, không dùng lại khóa làm mới ở biến môi trường
    const restarted = new OfficialAccountZaloSender(store(zalo.fetcher), zalo.fetcher);
    await restarted.send('zalo-user-a', 'Sau khởi động lại');
    assert.equal(zalo.refreshCalls(), 2);
  });

  it('CT-12c-2: nhiều tin gửi đồng thời chỉ làm mới khóa một lần, kể cả giữa hai tiến trình', async () => {
    const zalo = fakeZalo({ refreshDelayMs: 50 });
    const first = store(zalo.fetcher);
    const second = store(zalo.fetcher);
    const senders = [
      new OfficialAccountZaloSender(first, zalo.fetcher),
      new OfficialAccountZaloSender(second, zalo.fetcher),
    ];
    await Promise.all(
      Array.from({ length: 8 }, (_, index) => senders[index % 2]?.send(`zalo-user-${index}`, `Tin ${index}`)),
    );
    assert.equal(zalo.refreshCalls(), 1);
    const messages = zalo.calls.filter((call) => call.url === ZALO_MESSAGE_URL);
    assert.equal(messages.length, 8);
    assert.ok(messages.every((call) => (call.init?.headers as Record<string, string>).access_token === 'access-1'));
  });

  it('CT-12c-3: Zalo báo -216 thì làm mới khóa và thử lại đúng một lần', async () => {
    const zalo = fakeZalo({ rejectAccessTokens: new Set(['access-env']) });
    const tokens = store(zalo.fetcher, { access: 'access-env' });
    const sender = new OfficialAccountZaloSender(tokens, zalo.fetcher);
    await sender.send('zalo-user-a', 'Thử lại');
    assert.equal(zalo.refreshCalls(), 1);
    const tokensUsed = zalo.calls
      .filter((call) => call.url === ZALO_MESSAGE_URL)
      .map((call) => (call.init?.headers as Record<string, string>).access_token);
    assert.deepEqual(tokensUsed, ['access-env', 'access-1']);

    // Khóa mới vẫn bị từ chối: không lặp vô hạn, báo lỗi tiếng Việt
    const always = fakeZalo({ rejectAccessTokens: new Set(['access-1', 'access-2']) });
    await system.deleteFrom('integration_credentials').execute();
    const failing = new OfficialAccountZaloSender(store(always.fetcher), always.fetcher);
    await assert.rejects(
      failing.send('zalo-user-a', 'Lỗi'),
      /Khóa truy cập Zalo không hợp lệ hoặc đã hết hạn \(mã -216\)/,
    );
    assert.equal(always.refreshCalls(), 2);
  });

  it('CT-12c-4: lỗi Zalo đổi sang lời báo tiếng Việt; khóa làm mới sai báo cần nhập khóa mới', async () => {
    const outside: FetchFunction = async (url) =>
      url === ZALO_REFRESH_URL
        ? json({ access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 90000 })
        : json({ error: -230, message: 'User has not interacted with the OA' });
    await assert.rejects(
      new OfficialAccountZaloSender(store(outside), outside).send('zalo-user-a', 'Ngoài hạn'),
      /chưa tương tác với Official Account.*\(mã -230\)/,
    );
    await system.deleteFrom('integration_credentials').execute();
    const zalo = fakeZalo();
    await assert.rejects(
      new OfficialAccountZaloSender(store(zalo.fetcher, { refresh: 'khoa-sai' }), zalo.fetcher).send('u', 't'),
      /Zalo từ chối làm mới khóa.*nhập khóa làm mới mới/,
    );
    await system.deleteFrom('integration_credentials').execute();
    await assert.rejects(
      new OfficialAccountZaloSender(store(zalo.fetcher, { refresh: null }), zalo.fetcher).send('u', 't'),
      /Chưa có khóa làm mới Zalo/,
    );
  });

  it('CT-12c-5: người quản trị dán khóa làm mới mới; kiểm tra kết nối trả tên Official Account', async () => {
    const zalo = fakeZalo();
    const tokens = store(zalo.fetcher, { refresh: null });
    const first = await tokens.replaceRefreshToken('refresh-0', null);
    assert.equal(first.replaced, false);
    const sender = new OfficialAccountZaloSender(tokens, zalo.fetcher);
    assert.deepEqual(await sender.verify(), { oaId: '4321', name: 'Trường Mầm non' });
    assert.equal((await tokens.status()).refresh_token_configured, true);
    // Dán lại khóa: bỏ khóa truy cập cũ để lần sau làm mới bằng khóa vừa dán
    const second = await tokens.replaceRefreshToken('refresh-1', null);
    assert.equal(second.replaced, true);
    assert.equal(second.id, first.id);
    assert.equal((await savedRow()).access_token_encrypted, null);
  });

  it('CT-12c-6: Facebook đăng bài không hình chỉ gọi /feed; có hình thì tải hình rồi đăng; kiểm tra kết nối trả tên trang', async () => {
    const calls: Call[] = [];
    const fetcher: FetchFunction = async (url, init) => {
      calls.push({ url, init });
      if (url.includes('/photos')) {
        return json({ id: `photo-${calls.length}` });
      }
      if (url.includes('fields=id,name')) {
        return json({ id: '1234567890', name: 'Trường Mầm non' });
      }
      return json({ id: '1234567890_99' });
    };
    const publisher = new GraphApiFacebookPublisher('page-token', 'v21.0', fetcher);
    assert.deepEqual(await publisher.publish({ pageId: '1234567890', message: 'Tin không hình', photos: [] }), {
      postId: '1234567890_99',
    });
    assert.deepEqual(
      calls.map((call) => call.url),
      ['https://graph.facebook.com/v21.0/1234567890/feed'],
    );
    const form = calls[0]?.init?.body as FormData;
    assert.equal(form.get('message'), 'Tin không hình');
    assert.equal(form.get('attached_media[0]'), null);

    calls.length = 0;
    await publisher.publish({
      pageId: '1234567890',
      message: 'Tin có hình',
      photos: [{ fileName: 'a.png', contentType: 'image/png', data: Buffer.from([1, 2, 3]) }],
    });
    assert.deepEqual(
      calls.map((call) => call.url),
      ['https://graph.facebook.com/v21.0/1234567890/photos', 'https://graph.facebook.com/v21.0/1234567890/feed'],
    );
    assert.equal(
      (calls[1]?.init?.body as FormData).get('attached_media[0]'),
      JSON.stringify({ media_fbid: 'photo-1' }),
    );

    calls.length = 0;
    assert.deepEqual(await publisher.verify('1234567890'), { id: '1234567890', name: 'Trường Mầm non' });
    assert.equal(calls[0]?.url, 'https://graph.facebook.com/v21.0/1234567890?fields=id,name');
    assert.equal((calls[0]?.init?.headers as Record<string, string>).authorization, 'Bearer page-token');

    const expired = new GraphApiFacebookPublisher('old', undefined, async () =>
      json({ error: { code: 190, message: 'Error validating access token' } }, 400),
    );
    await assert.rejects(expired.verify('1'), /Khóa truy cập Fanpage không hợp lệ hoặc đã hết hạn.*\(mã 190\)/);
  });

  it('CT-12c-7: bật kết nối thật mà thiếu biến môi trường thì máy chủ không khởi động', () => {
    assert.throws(
      () => readIntegrationConfiguration({ ZALO_SENDER: 'zalo_oa', ZALO_APP_ID: '1' }),
      /ZALO_APP_SECRET, ZALO_OA_REFRESH_TOKEN/,
    );
    assert.throws(() => readIntegrationConfiguration({ FACEBOOK_PUBLISHER: 'graph' }), /FACEBOOK_PAGE_ACCESS_TOKEN/);
    assert.throws(() => readIntegrationConfiguration({ FACEBOOK_GRAPH_VERSION: '21' }), /FACEBOOK_GRAPH_VERSION/);
    const configured = readIntegrationConfiguration({
      ZALO_SENDER: 'zalo_oa',
      ZALO_APP_ID: '1',
      ZALO_APP_SECRET: 's',
      ZALO_OA_REFRESH_TOKEN: 'r',
      FACEBOOK_PAGE_ACCESS_TOKEN: 'p',
    });
    assert.equal(configured.zaloSender, 'zalo_oa');
    assert.equal(configured.facebookGraphVersion, 'v21.0');
    assert.equal(readIntegrationConfiguration({}).zaloSender, null);
  });
});
