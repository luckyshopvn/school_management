import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { ApplicationError } from '@school-management/server';
import { crc16, type PaymentRequestInput } from './payment-gateway.js';
import {
  cassoSignature,
  CassoPaymentGateway,
  createPaymentGateway,
  parseVietnamDateTime,
  payosDataString,
  payosOrderCode,
  PayosPaymentGateway,
  payosSignature,
  readPaymentProviderSettings,
  SepayPaymentGateway,
  VnpayPaymentGateway,
  vnpayDateTime,
  vnpayQueryString,
  vnpaySignature,
  WebhookAuthenticationError,
  type PayosSettings,
  type VnpaySettings,
} from './payment-providers.js';

// Nhà cung cấp thanh toán thật PayOS, SePay, Casso, VNPay (DT-12 phần 12b, YCTD-92): chữ ký, đọc thông báo tiền vào và
// tạo yêu cầu thanh toán với fetch giả lập; không gọi nhà cung cấp thật
const now = new Date('2026-10-13T03:04:05.000Z');
const sha256 = (key: string, text: string) => createHmac('sha256', key).update(text).digest('hex');
const sha512 = (key: string, text: string) => createHmac('sha512', key).update(text).digest('hex');

const input: PaymentRequestInput = {
  invoiceCode: 'HD-000123',
  transferContent: 'HD000123',
  amount: 1_500_000,
  childName: 'Trẻ T1',
  receivingAccountNumber: '1900123456',
  receivingAccountName: 'Trường Mầm non',
  receivingBankBin: '970436',
  payerIpAddress: '10.0.0.5',
};

const payosSettings: PayosSettings = {
  clientId: 'client-thu',
  apiKey: 'api-thu',
  checksumKey: 'checksum-thu',
  returnUrl: 'https://phuhuynh.truong.vn/thanh-toan',
  cancelUrl: 'https://phuhuynh.truong.vn/huy',
  apiUrl: 'https://api-merchant.payos.vn',
};

const vnpaySettings: VnpaySettings = {
  tmnCode: 'TMNTHU01',
  hashSecret: 'BIMATVNPAYTHU',
  returnUrl: 'https://phuhuynh.truong.vn/vnpay',
  paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  expireMinutes: 15,
};

const ruleCodeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof ApplicationError);
    return error.ruleCode;
  }
  assert.fail('Phải báo lỗi');
};

describe('Nhà cung cấp thanh toán thật (YCTD-92)', () => {
  it('CT-12b-1: PayOS ký yêu cầu tạo mã bằng HMAC-SHA256 các trường xếp theo tên và đọc mã QR, tài khoản ảo trả về', async () => {
    const calls: Array<{ url: string; headers: Record<string, string>; body: Record<string, unknown> }> = [];
    const gateway = new PayosPaymentGateway(
      payosSettings,
      async (url, init) => {
        calls.push({ url, headers: init.headers, body: JSON.parse(init.body) as Record<string, unknown> });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            code: '00',
            desc: 'success',
            data: { accountNumber: 'V3CAS1234567', qrCode: '00020101021238570010A000000727', paymentLinkId: 'abc' },
          }),
        };
      },
      () => now,
    );
    const created = await gateway.createPaymentRequest(input);
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, 'https://api-merchant.payos.vn/v2/payment-requests');
    assert.equal(call.headers['x-client-id'], 'client-thu');
    assert.equal(call.headers['x-api-key'], 'api-thu');
    const orderCode = call.body.orderCode as number;
    assert.ok(Number.isSafeInteger(orderCode) && orderCode > 0);
    assert.equal(call.body.description, 'HD000123');
    assert.equal(
      call.body.signature,
      sha256(
        'checksum-thu',
        `amount=1500000&cancelUrl=https://phuhuynh.truong.vn/huy&description=HD000123&orderCode=${orderCode}` +
          '&returnUrl=https://phuhuynh.truong.vn/thanh-toan',
      ),
    );
    assert.deepEqual(created, {
      provider: 'payos',
      providerReference: String(orderCode),
      virtualAccountNumber: 'V3CAS1234567',
      qrContent: '00020101021238570010A000000727',
      expiresAt: null,
    });
    assert.ok(payosOrderCode(new Date('2200-01-01T00:00:00Z')) < Number.MAX_SAFE_INTEGER);
  });

  it('CT-12b-2: PayOS từ chối tạo mã hoặc không kết nối được thì báo lỗi P06-11', async () => {
    const refused = new PayosPaymentGateway(payosSettings, async () => ({
      ok: true,
      status: 200,
      json: async () => ({ code: '20', desc: 'Thông tin truyền lên không đúng' }),
    }));
    assert.equal(await ruleCodeOf(refused.createPaymentRequest(input)), 'P06-11');
    const offline = new PayosPaymentGateway(payosSettings, async () => {
      throw new Error('mất mạng');
    });
    assert.equal(await ruleCodeOf(offline.createPaymentRequest(input)), 'P06-11');
  });

  it('CT-12b-3: thông báo PayOS đúng chữ ký thành giao dịch tiền vào; sai chữ ký bị từ chối; giao dịch lỗi bỏ qua', () => {
    const gateway = new PayosPaymentGateway(payosSettings);
    const data = {
      orderCode: 1760324645000123,
      amount: 1_500_000,
      description: 'CSB7T5L1 HD000123',
      accountNumber: 'V3CAS1234567',
      reference: 'FT26286000001',
      transactionDateTime: '2026-10-13 10:04:05',
      currency: 'VND',
      paymentLinkId: 'abc',
      code: '00',
      desc: 'success',
      counterAccountBankId: null,
      counterAccountName: null,
    };
    const text =
      'accountNumber=V3CAS1234567&amount=1500000&code=00&counterAccountBankId=&counterAccountName=&currency=VND' +
      '&desc=success&description=CSB7T5L1 HD000123&orderCode=1760324645000123&paymentLinkId=abc' +
      '&reference=FT26286000001&transactionDateTime=2026-10-13 10:04:05';
    assert.equal(payosDataString(data), text);
    const signature = sha256('checksum-thu', text);
    assert.equal(payosSignature('checksum-thu', data), signature);
    const incoming = gateway.parseWebhook(
      { headers: {}, body: { code: '00', desc: 'success', success: true, data, signature } },
      now,
    );
    assert.deepEqual(incoming, [
      {
        provider: 'payos',
        providerTransactionRef: 'payos-FT26286000001',
        providerReference: '1760324645000123',
        virtualAccountNumber: null,
        amount: 1_500_000,
        transferContent: 'CSB7T5L1 HD000123',
        receivedAt: new Date('2026-10-13T03:04:05.000Z'),
      },
    ]);
    assert.throws(
      () =>
        gateway.parseWebhook(
          { headers: {}, body: { code: '00', success: true, data: { ...data, amount: 15_000_000 }, signature } },
          now,
        ),
      WebhookAuthenticationError,
    );
    assert.throws(() => gateway.parseWebhook({ headers: {}, body: { data } }, now), WebhookAuthenticationError);
    const failed = { ...data, reference: '' };
    assert.deepEqual(
      gateway.parseWebhook(
        {
          headers: {},
          body: { code: '01', success: false, data: failed, signature: payosSignature('checksum-thu', failed) },
        },
        now,
      ),
      [],
    );
  });

  it('CT-12b-4: SePay dựng VietQR tới tài khoản trường; thông báo đúng khóa thành giao dịch, sai khóa bị từ chối, tiền ra bỏ qua', async () => {
    const gateway = new SepayPaymentGateway({ webhookApiKey: 'khoa-sepay' });
    assert.equal(gateway.requiresBankBin, true);
    const created = await gateway.createPaymentRequest(input);
    assert.equal(created.virtualAccountNumber, '1900123456');
    assert.ok(created.qrContent.includes('0808HD000123') && created.qrContent.includes('54071500000'));
    assert.equal(created.qrContent.slice(-4), crc16(created.qrContent.slice(0, -4)));
    const body = {
      id: 92704,
      gateway: 'Vietcombank',
      transactionDate: '2026-10-13 09:00:00',
      accountNumber: '1900123456',
      content: 'MBVCB.123 HD000123 nop hoc phi',
      transferType: 'in',
      transferAmount: 1_500_000,
      referenceCode: 'MBVCB.3278907687',
    };
    assert.deepEqual(gateway.parseWebhook({ headers: { authorization: 'Apikey khoa-sepay' }, body }, now), [
      {
        provider: 'sepay',
        providerTransactionRef: 'sepay-92704',
        virtualAccountNumber: null,
        amount: 1_500_000,
        transferContent: 'MBVCB.123 HD000123 nop hoc phi',
        receivedAt: new Date('2026-10-13T02:00:00.000Z'),
      },
    ]);
    for (const authorization of [undefined, 'Apikey sai', 'Bearer khoa-sepay']) {
      assert.throws(() => gateway.parseWebhook({ headers: { authorization }, body }, now), WebhookAuthenticationError);
    }
    assert.deepEqual(
      gateway.parseWebhook(
        { headers: { authorization: 'Apikey khoa-sepay' }, body: { ...body, transferType: 'out' } },
        now,
      ),
      [],
    );
  });

  it('CT-12b-5: Casso kiểm chữ ký HMAC-SHA512 theo mẫu chính thức; thông báo đúng thành giao dịch, sai chữ ký bị từ chối', async () => {
    // Bộ dữ liệu mẫu python.py của Casso (github.com/CassoHQ/casso-webhook-v2-verify-signature); chữ ký mẫu trong
    // javascript.js của kho này không khớp với chính dữ liệu mẫu nên không dùng
    const secret = 'mgExMrjj4i7a1p8Cs6LmFbpCd8lbw4sSX4LZXPag7TKazeIogtR90tvWYTkwQbvs';
    const body = {
      error: 0,
      data: {
        id: 0,
        reference: 'MA_GIAO_DICH_THU_NGHIEM',
        description: 'giao dich thu nghiem',
        amount: 599000,
        runningBalance: 25000000,
        transactionDateTime: '2024-10-03 15:06:37',
        accountNumber: '88888888',
        bankName: 'VPBank',
        bankAbbreviation: 'VPB',
        virtualAccountNumber: '',
        virtualAccountName: '',
        counterAccountName: 'NGUYEN VAN A',
        counterAccountNumber: '8888888888',
        counterAccountBankId: '970415',
        counterAccountBankName: 'VietinBank',
      },
    };
    const header =
      't=1727948258788,v1=ed0a4bd2e826d5cb69988cdb141e6c1a080e21f3b57eb72cd78192220042b9e7dde0868fc667faea8e224900fa7904e7c88dfa098032fb2d6b6996856e8b7ff3';
    assert.equal(cassoSignature(secret, '1727948258788', body), header.split('v1=')[1]);
    const gateway = new CassoPaymentGateway({ webhookSecret: secret });
    assert.equal(gateway.requiresBankBin, true);
    assert.deepEqual(gateway.parseWebhook({ headers: { 'x-casso-signature': header }, body }, now), [
      {
        provider: 'casso',
        providerTransactionRef: 'casso-0',
        virtualAccountNumber: null,
        amount: 599_000,
        transferContent: 'giao dich thu nghiem',
        receivedAt: new Date('2024-10-03T08:06:37.000Z'),
      },
    ]);
    assert.throws(
      () =>
        gateway.parseWebhook(
          { headers: { 'x-casso-signature': header }, body: { ...body, data: { ...body.data, amount: 1 } } },
          now,
        ),
      WebhookAuthenticationError,
    );
    assert.throws(() => gateway.parseWebhook({ headers: {}, body }, now), WebhookAuthenticationError);
    // Dạng mảng: chỉ lấy giao dịch tiền vào
    const list = {
      error: 0,
      data: [
        { id: 1, description: 'HD000123', amount: 500_000, when: '2026-10-13 08:00:00' },
        { id: 2, description: 'chi tien', amount: -200_000 },
      ],
    };
    const timestamp = '1760324645000';
    const signed = `t=${timestamp},v1=${sha512('bi-mat', `${timestamp}.{"data":[{"amount":500000,"description":"HD000123","id":1,"when":"2026-10-13 08:00:00"},{"amount":-200000,"description":"chi tien","id":2}],"error":0}`)}`;
    const rows = new CassoPaymentGateway({ webhookSecret: 'bi-mat' }).parseWebhook(
      { headers: { 'x-casso-signature': signed }, body: list },
      now,
    );
    assert.deepEqual(
      rows.map((row) => [row.providerTransactionRef, row.amount]),
      [['casso-1', 500_000]],
    );
    // Nội dung có dấu ký theo kiểu \uXXXX của mẫu python cũng được nhận
    const accented = { error: 0, data: { id: 3, description: 'Nộp HD000123', amount: 100_000 } };
    const escaped = `${timestamp}.{"data":{"amount":100000,"description":"N\\u1ed9p HD000123","id":3},"error":0}`;
    assert.equal(
      new CassoPaymentGateway({ webhookSecret: 'bi-mat' }).parseWebhook(
        { headers: { 'x-casso-signature': `t=${timestamp},v1=${sha512('bi-mat', escaped)}` }, body: accented },
        now,
      )[0]?.transferContent,
      'Nộp HD000123',
    );
  });

  it('CT-12b-6: VNPay dựng địa chỉ thanh toán đã ký HMAC-SHA512, số tiền nhân 100, giờ Việt Nam, hết hạn sau 15 phút', async () => {
    const gateway = new VnpayPaymentGateway(vnpaySettings, () => now);
    const created = await gateway.createPaymentRequest(input);
    assert.equal(created.provider, 'vnpay');
    assert.equal(created.expiresAt?.toISOString(), '2026-10-13T03:19:05.000Z');
    const url = new URL(created.qrContent);
    assert.equal(`${url.origin}${url.pathname}`, vnpaySettings.paymentUrl);
    const parameters = Object.fromEntries(url.searchParams.entries());
    assert.equal(parameters.vnp_Amount, '150000000');
    assert.equal(parameters.vnp_OrderInfo, 'HD000123');
    assert.equal(parameters.vnp_TxnRef, created.providerReference);
    assert.equal(parameters.vnp_CreateDate, '20261013100405');
    assert.equal(parameters.vnp_ExpireDate, '20261013101905');
    assert.equal(parameters.vnp_IpAddr, '10.0.0.5');
    assert.equal(parameters.vnp_ReturnUrl, vnpaySettings.returnUrl);
    const [query, hash] = created.qrContent.split('?')[1]?.split('&vnp_SecureHash=') ?? [];
    assert.equal(hash, sha512('BIMATVNPAYTHU', query ?? ''));
    assert.ok(query?.includes('vnp_ReturnUrl=https%3A%2F%2Fphuhuynh.truong.vn%2Fvnpay'));
    assert.equal(vnpayQueryString({ vnp_B: 'a b', vnp_A: 'x/y' }), 'vnp_A=x%2Fy&vnp_B=a+b');
    assert.equal(vnpayDateTime(new Date('2026-12-31T17:30:00Z')), '20270101003000');
  });

  it('CT-12b-7: VNPay IPN đúng chữ ký thành giao dịch tiền vào; sai chữ ký báo invalid_signature; thanh toán lỗi không có giao dịch', () => {
    const gateway = new VnpayPaymentGateway(vnpaySettings, () => now);
    const parameters: Record<string, string> = {
      vnp_Amount: '150000000',
      vnp_BankCode: 'NCB',
      vnp_OrderInfo: 'HD000123',
      vnp_PayDate: '20261013100500',
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'TMNTHU01',
      vnp_TransactionNo: '14000001',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: 'HD000123176032464500042',
    };
    const query = {
      ...parameters,
      vnp_SecureHashType: 'HmacSHA512',
      vnp_SecureHash: vnpaySignature('BIMATVNPAYTHU', parameters).toUpperCase(),
    };
    assert.deepEqual(gateway.parseIpn(query, now), {
      kind: 'payment',
      txnRef: 'HD000123176032464500042',
      amount: 1_500_000,
      succeeded: true,
      incoming: {
        provider: 'vnpay',
        providerTransactionRef: 'vnpay-HD000123176032464500042',
        providerReference: 'HD000123176032464500042',
        virtualAccountNumber: null,
        amount: 1_500_000,
        transferContent: 'HD000123',
        receivedAt: new Date('2026-10-13T03:05:00.000Z'),
      },
    });
    assert.deepEqual(gateway.parseIpn({ ...query, vnp_Amount: '100' }, now), { kind: 'invalid_signature' });
    const failed = { ...parameters, vnp_ResponseCode: '24', vnp_TransactionStatus: '02' };
    const result = gateway.parseIpn({ ...failed, vnp_SecureHash: vnpaySignature('BIMATVNPAYTHU', failed) }, now);
    assert.equal(result.kind === 'payment' && result.succeeded, false);
    assert.equal(result.kind === 'payment' ? result.incoming : 'x', null);
  });

  it('CT-12b-8: cổng bật mà thiếu biến môi trường thì dừng khởi động; đủ biến thì tạo được cổng của từng mã', () => {
    assert.throws(
      () => readPaymentProviderSettings(['payos', 'sepay'], { PAYOS_CLIENT_ID: 'a' }),
      /PAYOS_API_KEY, PAYOS_CHECKSUM_KEY, PAYOS_RETURN_URL, SEPAY_WEBHOOK_API_KEY/,
    );
    assert.deepEqual(readPaymentProviderSettings(['development'], {}), {});
    const settings = readPaymentProviderSettings(['payos', 'sepay', 'casso', 'vnpay'], {
      PAYOS_CLIENT_ID: 'a',
      PAYOS_API_KEY: 'b',
      PAYOS_CHECKSUM_KEY: 'c',
      PAYOS_RETURN_URL: 'https://truong.vn/tra-ve',
      SEPAY_WEBHOOK_API_KEY: 'd',
      CASSO_WEBHOOK_SECRET: 'e',
      VNPAY_TMN_CODE: 'f',
      VNPAY_HASH_SECRET: 'g',
      VNPAY_RETURN_URL: 'https://truong.vn/vnpay',
    });
    assert.equal(settings.payos?.cancelUrl, 'https://truong.vn/tra-ve');
    assert.equal(settings.payos?.apiUrl, 'https://api-merchant.payos.vn');
    assert.equal(settings.vnpay?.paymentUrl, 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
    for (const code of ['payos', 'sepay', 'casso', 'vnpay'] as const) {
      const gateway = createPaymentGateway(code, settings);
      assert.equal(gateway.provider, code);
      assert.equal(gateway.supportsWebhook, true);
    }
    assert.throws(() => createPaymentGateway('payos', {}), /payos/);
    assert.equal(parseVietnamDateTime('khong ro', now), now);
  });
});
