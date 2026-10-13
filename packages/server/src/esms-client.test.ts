import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ESMS_SEND_URL,
  EsmsClient,
  normalizeVietnamesePhone,
  readEsmsSettings,
  readSmsProviderSettings,
  removeVietnameseDiacritics,
  type EsmsSettings,
} from './esms-client.js';

// Kết nối eSMS.vn (DT-12 phần 12a, YCTD-92); kịch bản CT-12a-1 đến CT-12a-10, không gọi eSMS.vn thật
const SETTINGS: EsmsSettings = {
  apiKey: 'khoa_thu',
  secretKey: 'bi_mat_thu',
  brandname: 'TRUONG_THU',
  sandbox: false,
  unicode: false,
};

interface Captured {
  url: string;
  init: RequestInit;
  body: Record<string, string>;
}

function fakeFetch(result: unknown, captured: Captured[] = [], status = 200): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(url), init: init ?? {}, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(result), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

describe('Kết nối eSMS.vn', () => {
  it('CT-12a-1: gửi thành công trả mã tin, gửi đúng địa chỉ và các trường của eSMS.vn', async () => {
    const captured: Captured[] = [];
    const client = new EsmsClient(SETTINGS, fakeFetch({ CodeResult: '100', SMSID: 'abc-123' }, captured));
    const result = await client.send('0901 234 567', 'Ma dang nhap 123456');
    assert.deepEqual(result, { smsId: 'abc-123' });
    assert.equal(captured.length, 1);
    const [request] = captured;
    assert.equal(request?.url, ESMS_SEND_URL);
    assert.equal(request?.init.method, 'POST');
    assert.ok(request?.init.signal);
    const body = request?.body ?? {};
    assert.equal(body.ApiKey, 'khoa_thu');
    assert.equal(body.SecretKey, 'bi_mat_thu');
    assert.equal(body.Phone, '84901234567');
    assert.equal(body.Content, 'Ma dang nhap 123456');
    assert.equal(body.Brandname, 'TRUONG_THU');
    assert.equal(body.SmsType, '2');
    assert.equal(body.IsUnicode, '0');
    assert.equal(body.Sandbox, '0');
    assert.match(body.RequestId ?? '', /^[0-9a-f-]{36}$/);
  });

  it('CT-12a-2: eSMS.vn trả mã khác 100 thì báo lỗi kèm mã và nội dung lỗi', async () => {
    const client = new EsmsClient(SETTINGS, fakeFetch({ CodeResult: '101', ErrorMessage: 'Authorize Failed' }));
    await assert.rejects(client.send('0901234567', 'Xin chao'), /eSMS\.vn trả lỗi 101: Authorize Failed/);
  });

  it('CT-12a-3: eSMS.vn trả mã HTTP lỗi thì báo lỗi', async () => {
    const client = new EsmsClient(SETTINGS, fakeFetch({}, [], 500));
    await assert.rejects(client.send('0901234567', 'Xin chao'), /mã HTTP 500/);
  });

  it('CT-12a-4: mặc định bỏ dấu tiếng Việt, gồm chữ đ', async () => {
    assert.equal(
      removeVietnameseDiacritics('Mã đăng nhập của Phụ huynh ĐỖ Thị Ánh là 123456'),
      'Ma dang nhap cua Phu huynh DO Thi Anh la 123456',
    );
    const captured: Captured[] = [];
    const client = new EsmsClient(SETTINGS, fakeFetch({ CodeResult: '100' }, captured));
    await client.send('0901234567', 'Bé được đón lúc 16:30');
    assert.equal(captured[0]?.body.Content, 'Be duoc don luc 16:30');
  });

  it('CT-12a-5: bật gửi có dấu và gửi thử thì giữ nguyên nội dung, IsUnicode và Sandbox là 1', async () => {
    const captured: Captured[] = [];
    const client = new EsmsClient(
      { ...SETTINGS, unicode: true, sandbox: true },
      fakeFetch({ CodeResult: '100' }, captured),
    );
    await client.send('84901234567', 'Bé được đón lúc 16:30');
    assert.equal(captured[0]?.body.Content, 'Bé được đón lúc 16:30');
    assert.equal(captured[0]?.body.IsUnicode, '1');
    assert.equal(captured[0]?.body.Sandbox, '1');
  });

  it('CT-12a-6: chuẩn hóa số điện thoại về dạng 84, số sai dạng thì báo lỗi và không gọi eSMS.vn', async () => {
    assert.equal(normalizeVietnamesePhone('0901234567'), '84901234567');
    assert.equal(normalizeVietnamesePhone('+84 901.234.567'), '84901234567');
    assert.equal(normalizeVietnamesePhone('84901234567'), '84901234567');
    assert.throws(() => normalizeVietnamesePhone('12345'), /không đúng dạng/);
    const captured: Captured[] = [];
    const client = new EsmsClient(SETTINGS, fakeFetch({ CodeResult: '100' }, captured));
    await assert.rejects(client.send('abc', 'Xin chao'), /không đúng dạng/);
    assert.equal(captured.length, 0);
  });

  it('CT-12a-7: eSMS.vn không phản hồi trong thời hạn thì hủy yêu cầu và báo lỗi', async () => {
    const hanging = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as typeof fetch;
    const client = new EsmsClient(SETTINGS, hanging, 20);
    await assert.rejects(client.send('0901234567', 'Xin chao'), /không phản hồi sau 20 ms/);
  });

  it('CT-12a-8: chọn esms mà thiếu biến môi trường thì báo lỗi tên biến', () => {
    assert.throws(
      () => readSmsProviderSettings({ SMS_PROVIDER: 'esms', ESMS_API_KEY: 'k', ESMS_SECRET_KEY: 's' }),
      /Thiếu biến môi trường ESMS_BRANDNAME/,
    );
    assert.throws(() => readEsmsSettings({ ESMS_SECRET_KEY: 's', ESMS_BRANDNAME: 'b' }), /ESMS_API_KEY/);
    assert.throws(() => readEsmsSettings({ ESMS_API_KEY: 'k', ESMS_BRANDNAME: 'b' }), /ESMS_SECRET_KEY/);
  });

  it('CT-12a-9: đủ biến môi trường thì đọc được cấu hình eSMS.vn, kể cả ở môi trường chạy thật', () => {
    assert.deepEqual(
      readSmsProviderSettings({
        NODE_ENV: 'production',
        SMS_PROVIDER: 'esms',
        ESMS_API_KEY: 'k',
        ESMS_SECRET_KEY: 's',
        ESMS_BRANDNAME: 'b',
        ESMS_SANDBOX: 'true',
      }),
      { provider: 'esms', esms: { apiKey: 'k', secretKey: 's', brandname: 'b', sandbox: true, unicode: false } },
    );
  });

  it('CT-12a-10: mặc định là log khi phát triển; môi trường chạy thật không có nhà cung cấp thật thì dừng', () => {
    assert.deepEqual(readSmsProviderSettings({}), { provider: 'log' });
    assert.throws(() => readSmsProviderSettings({ NODE_ENV: 'production' }), /môi trường chạy thật/);
    assert.throws(() => readSmsProviderSettings({ SMS_PROVIDER: 'khac' }), /chưa được hỗ trợ/);
  });
});
