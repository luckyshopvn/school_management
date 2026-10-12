import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Kho, tài sản và mua hàng (DT-10 phần 10d, YCTD-77); kịch bản CT-066, CT-067, CT-068, CT-120 và ca chi tiết CTC-P01-062
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; message?: string };

describe('Kho, tài sản và mua hàng', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  let supplierId = '';
  let approvedRequestId = '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const unitA = () => units['PH-A'] ?? '';
  const createItem = async (code: string) => {
    const created = await api('POST', '/stock-items', token('storekeeper'), {
      org_unit_id: unitA(),
      code,
      name: `Mặt hàng ${code}`,
      unit: 'hộp',
      min_qty: 2,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return created.body.id as string;
  };
  const currentQuantity = async (itemId: string) =>
    Number(
      (
        await schoolYear
          .selectFrom('stock_items')
          .select('current_qty')
          .where('id', '=', itemId)
          .executeTakeFirstOrThrow()
      ).current_qty,
    );
  const request = (accessToken: string, quantity: number, price: number) =>
    api('POST', '/purchase-requests', accessToken, {
      org_unit_id: unitA(),
      needed_by: addDays(vietnamToday, 7),
      reason: 'Bổ sung đồ dùng',
      items: [{ item_name: 'Giấy A4', quantity, unit: 'ram', estimated_price: price }],
    });

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: addDays(vietnamToday, -60), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['PH-A', 'phan_hieu'],
      ['PH-B', 'phan_hieu'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    users.vicePrincipal = await environment.loginAs('VT-15', unitA());
    users.accountant = await environment.loginAs('VT-04', unitA());
    users.storekeeper = await environment.loginAs('VT-11', unitA());
    users.otherStorekeeper = await environment.loginAs('VT-11', units['PH-B'] ?? null);
    users.chiefAccountant = await environment.loginAs('VT-05', unitA());
    users.teacher = await environment.loginAs('VT-07', unitA());
    users.parent = await environment.loginAs('VT-14', unitA());
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CTC-P01-062: PH-A chưa có hạn mức đề nghị mua hàng, KT-A trình 1 000 thì chuyển Hiệu trưởng; PHT-A duyệt bị từ chối', async () => {
    const created = await request(token('accountant'), 1, 1000);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.status, 'pending');
    assert.equal(created.body.requires_principal, true);
    assert.equal(created.body.total_amount, 1000);
    assert.match(created.body.code as string, /^DNMH-\d{6}$/);
    const requestId = created.body.id as string;

    const vicePending = await api('GET', '/purchase-requests?view=pending', token('vicePrincipal'));
    assert.equal(vicePending.status, 200);
    assert.ok(!(vicePending.body as unknown as Array<{ id: string }>).some((row) => row.id === requestId));
    const byVice = await api('POST', `/purchase-requests/${requestId}/approve`, token('vicePrincipal'));
    assert.equal(byVice.status, 403, JSON.stringify(byVice.body));
    assert.equal(errorOf(byVice.body).code, 'ERR_FORBIDDEN');

    const principalPending = await api('GET', '/purchase-requests?view=pending', principal.accessToken);
    assert.ok((principalPending.body as unknown as Array<{ id: string }>).some((row) => row.id === requestId));
    const notifications = await schoolYear
      .selectFrom('notifications')
      .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
      .select(['notification_recipients.role_code'])
      .where('notifications.target_id', '=', requestId)
      .execute();
    assert.deepEqual(
      notifications.map((row) => row.role_code),
      ['VT-02'],
    );
    const approved = await api('POST', `/purchase-requests/${requestId}/approve`, principal.accessToken);
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.status, 'approved');
    // Người lập xem được đề nghị của mình; nhân sự khác không xem được
    assert.equal((await api('GET', `/purchase-requests/${requestId}`, token('accountant'))).status, 200);
    assert.equal((await api('GET', `/purchase-requests/${requestId}`, token('teacher'))).status, 403);
  });

  it('CT-067: đề nghị từ hạn mức trở lên chuyển Hiệu trưởng ở trạng thái chờ duyệt; dưới hạn mức Phó Hiệu trưởng duyệt', async () => {
    const threshold = await api('PUT', '/approval-thresholds', principal.accessToken, {
      org_unit_id: unitA(),
      document_type: 'purchase_request',
      threshold_amount: 5_000_000,
    });
    assert.equal(threshold.status, 200, JSON.stringify(threshold.body));

    const large = await request(token('teacher'), 2, 2_500_000);
    assert.equal(large.status, 201, JSON.stringify(large.body));
    assert.equal(large.body.status, 'pending');
    assert.equal(large.body.requires_principal, true);
    assert.equal(
      (await api('POST', `/purchase-requests/${large.body.id as string}/approve`, token('vicePrincipal'))).status,
      403,
    );
    const rejected = await api(
      'POST',
      `/purchase-requests/${large.body.id as string}/reject`,
      principal.accessToken,
      {},
    );
    assert.equal(rejected.status, 400);
    const rejectedWithReason = await api(
      'POST',
      `/purchase-requests/${large.body.id as string}/reject`,
      principal.accessToken,
      { reason: 'Chưa cần thiết' },
    );
    assert.equal(rejectedWithReason.status, 200);
    assert.equal(rejectedWithReason.body.status, 'rejected');

    const small = await request(token('teacher'), 10, 100_000);
    assert.equal(small.status, 201);
    assert.equal(small.body.requires_principal, false);
    const vicePending = await api('GET', '/purchase-requests?view=pending', token('vicePrincipal'));
    assert.ok((vicePending.body as unknown as Array<{ id: string }>).some((row) => row.id === small.body.id));
    const approved = await api('POST', `/purchase-requests/${small.body.id as string}/approve`, token('vicePrincipal'));
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    approvedRequestId = small.body.id as string;
    const again = await api('POST', `/purchase-requests/${small.body.id as string}/approve`, principal.accessToken);
    assert.equal(again.status, 422);
    assert.equal(errorOf(again.body).rule_code, 'BR-63');

    // Người lập không tự duyệt; phụ huynh không lập được đề nghị
    const own = await request(token('vicePrincipal'), 1, 50_000);
    assert.equal(own.status, 201);
    assert.equal(
      (await api('POST', `/purchase-requests/${own.body.id as string}/approve`, token('vicePrincipal'))).status,
      403,
    );
    assert.equal((await request(token('parent'), 1, 50_000)).status, 403);
    const mine = await api('GET', '/purchase-requests', token('teacher'));
    assert.equal((mine.body as unknown as unknown[]).length, 2);
  });

  it('P13-06: phiếu mua hàng chỉ lập từ đề nghị đã duyệt; nhận hàng thì tăng tồn và chờ thanh toán', async () => {
    const supplier = await api('POST', '/suppliers', token('storekeeper'), {
      org_unit_id: unitA(),
      name: 'Văn phòng phẩm Hòa Bình',
      tax_code: '0101234567',
      payment_terms: 'Thanh toán trong 30 ngày',
    });
    assert.equal(supplier.status, 201, JSON.stringify(supplier.body));
    supplierId = supplier.body.id as string;
    assert.equal(
      (await api('POST', '/suppliers', token('storekeeper'), { org_unit_id: unitA(), name: 'Văn phòng phẩm Hòa Bình' }))
        .status,
      409,
    );
    const itemId = await createItem('GIAY-A4');
    const pending = await request(token('teacher'), 1, 10_000);
    const order = (requestId: string, accessToken = token('storekeeper')) =>
      api('POST', '/purchase-orders', accessToken, {
        request_id: requestId,
        supplier_id: supplierId,
        order_date: vietnamToday,
        items: [{ item_name: 'Giấy A4', stock_item_id: itemId, quantity: 10, unit_price: 95_000 }],
      });
    const fromPending = await order(pending.body.id as string);
    assert.equal(fromPending.status, 422);
    assert.equal(errorOf(fromPending.body).rule_code, 'BR-63');
    assert.equal((await order(approvedRequestId, token('otherStorekeeper'))).status, 403);

    const created = await order(approvedRequestId);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.total_amount, 950_000);
    assert.equal(created.body.status, 'ordered');
    assert.equal(created.body.payment_status, 'awaiting_payment');
    assert.match(created.body.code as string, /^PMH-\d{6}$/);
    assert.equal((await order(approvedRequestId)).status, 422);

    const orderId = created.body.id as string;
    const received = await api('POST', `/purchase-orders/${orderId}/receive`, token('storekeeper'), {
      received_date: vietnamToday,
    });
    assert.equal(received.status, 200, JSON.stringify(received.body));
    assert.equal(received.body.status, 'received');
    assert.equal(await currentQuantity(itemId), 10);
    assert.equal(
      (await api('POST', `/purchase-orders/${orderId}/receive`, token('storekeeper'), { received_date: vietnamToday }))
        .status,
      422,
    );
    const transactions = await api('GET', `/stock-transactions?stock_item_id=${itemId}`, token('storekeeper'));
    const rows = transactions.body as unknown as Array<{
      transaction_type: string;
      reference_id: string;
      unit_price: number;
    }>;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.transaction_type, 'receipt');
    assert.equal(rows[0]?.reference_id, orderId);
    assert.equal(rows[0]?.unit_price, 95_000);

    // Kế toán thấy phiếu chờ thanh toán; gắn phiếu chi không tồn tại bị từ chối
    const awaiting = await api('GET', '/purchase-orders?payment_status=awaiting_payment', token('accountant'));
    assert.equal(awaiting.status, 200);
    assert.equal((awaiting.body as unknown as unknown[]).length, 1);
    const missingPayment = await api('POST', `/purchase-orders/${orderId}/payment`, token('accountant'), {
      payment_id: '00000000-0000-4000-8000-000000000000',
    });
    assert.equal(missingPayment.status, 404);
    assert.equal(
      (await api('POST', `/purchase-orders/${orderId}/payment`, token('storekeeper'), { payment_id: orderId })).status,
      403,
    );
  });

  it('CT-066: tồn mười, xuất mười lăm thì bị từ chối, báo vượt tồn; tồn giữ nguyên', async () => {
    const itemId = await createItem('BUT-CHI');
    const opening = await api('POST', '/stock-opening-balances', token('storekeeper'), {
      org_unit_id: unitA(),
      balance_date: vietnamToday,
      lines: [{ stock_item_id: itemId, quantity: 10, unit_price: 3_000 }],
    });
    assert.equal(opening.status, 201, JSON.stringify(opening.body));
    const issue = (quantity: number) =>
      api('POST', '/stock-transactions', token('storekeeper'), {
        org_unit_id: unitA(),
        transaction_type: 'issue',
        transaction_date: vietnamToday,
        note: 'Xuất cho lớp',
        lines: [{ stock_item_id: itemId, quantity }],
      });
    const over = await issue(15);
    assert.equal(over.status, 422, JSON.stringify(over.body));
    assert.equal(errorOf(over.body).rule_code, 'BR-62');
    assert.match(errorOf(over.body).message ?? '', /vượt tồn/);
    assert.equal(await currentQuantity(itemId), 10);
    const ok = await issue(4);
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.match(ok.body.code as string, /^PXK-\d{6}$/);
    assert.equal(await currentQuantity(itemId), 6);
    // Người ngoài đơn vị không xuất được
    const other = await api('POST', '/stock-transactions', token('otherStorekeeper'), {
      org_unit_id: unitA(),
      transaction_type: 'receipt',
      transaction_date: vietnamToday,
      lines: [{ stock_item_id: itemId, quantity: 1 }],
    });
    assert.equal(other.status, 403);
  });

  it('CT-120: nhập tồn ban đầu cho mặt hàng đã có giao dịch bị từ chối', async () => {
    const itemId = await createItem('KEO-DAN');
    const receipt = await api('POST', '/stock-transactions', token('storekeeper'), {
      org_unit_id: unitA(),
      transaction_type: 'receipt',
      transaction_date: vietnamToday,
      lines: [{ stock_item_id: itemId, quantity: 5, unit_price: 12_000 }],
    });
    assert.equal(receipt.status, 201, JSON.stringify(receipt.body));
    const opening = await api('POST', '/stock-opening-balances', token('storekeeper'), {
      org_unit_id: unitA(),
      balance_date: vietnamToday,
      lines: [{ stock_item_id: itemId, quantity: 20, unit_price: 12_000 }],
    });
    assert.equal(opening.status, 422, JSON.stringify(opening.body));
    assert.equal(errorOf(opening.body).rule_code, 'BR-62');
    assert.equal(await currentQuantity(itemId), 5);
  });

  it('CT-068: kiểm kê có chênh lệch lập biên bản chờ kế toán trưởng duyệt; duyệt xong mới điều chỉnh tồn', async () => {
    const itemId = await createItem('KHAN-GIAY');
    const matchedItem = await createItem('XA-PHONG');
    await api('POST', '/stock-opening-balances', token('storekeeper'), {
      org_unit_id: unitA(),
      balance_date: vietnamToday,
      lines: [
        { stock_item_id: itemId, quantity: 20, unit_price: 5_000 },
        { stock_item_id: matchedItem, quantity: 8, unit_price: 15_000 },
      ],
    });
    const count = await api('POST', '/stock-counts', token('storekeeper'), {
      org_unit_id: unitA(),
      count_date: vietnamToday,
      lines: [
        { stock_item_id: itemId, actual_qty: 17, note: 'Rách bao bì' },
        { stock_item_id: matchedItem, actual_qty: 8 },
      ],
    });
    assert.equal(count.status, 201, JSON.stringify(count.body));
    assert.equal(count.body.status, 'pending');
    const lines = count.body.lines as Array<{ stock_item_id: string; system_qty: number; difference: number }>;
    assert.equal(lines.find((line) => line.stock_item_id === itemId)?.difference, -3);
    assert.equal(lines.find((line) => line.stock_item_id === matchedItem)?.difference, 0);
    assert.equal(await currentQuantity(itemId), 20);

    const countId = count.body.id as string;
    assert.equal((await api('POST', `/stock-counts/${countId}/approve`, token('storekeeper'))).status, 403);
    const approved = await api('POST', `/stock-counts/${countId}/approve`, token('chiefAccountant'));
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.status, 'approved');
    assert.equal(await currentQuantity(itemId), 17);
    assert.equal(await currentQuantity(matchedItem), 8);
    assert.equal((await api('POST', `/stock-counts/${countId}/approve`, token('chiefAccountant'))).status, 422);

    const matched = await api('POST', '/stock-counts', token('storekeeper'), {
      org_unit_id: unitA(),
      count_date: vietnamToday,
      lines: [{ stock_item_id: matchedItem, actual_qty: 8 }],
    });
    assert.equal(matched.body.status, 'matched');

    const rejectedCount = await api('POST', '/stock-counts', token('storekeeper'), {
      org_unit_id: unitA(),
      count_date: vietnamToday,
      lines: [{ stock_item_id: matchedItem, actual_qty: 9 }],
    });
    const rejected = await api(
      'POST',
      `/stock-counts/${rejectedCount.body.id as string}/reject`,
      token('chiefAccountant'),
      {
        reason: 'Đếm lại',
      },
    );
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.status, 'rejected');
    assert.equal(await currentQuantity(matchedItem), 8);
  });

  it('P13-01 đến P13-04: tài sản cấp phát, thu hồi, mượn quá hạn, hỏng được Ban Giám hiệu duyệt', async () => {
    const asset = await api('POST', '/assets', token('storekeeper'), {
      org_unit_id: unitA(),
      code: 'TS-0001',
      name: 'Tivi 55 inch',
      category: 'Thiết bị điện tử',
      unit: 'chiếc',
      original_cost: 12_000_000,
      purchase_date: addDays(vietnamToday, -30),
    });
    assert.equal(asset.status, 201, JSON.stringify(asset.body));
    const assetId = asset.body.id as string;
    assert.equal(
      (
        await api('POST', '/assets', token('otherStorekeeper'), {
          org_unit_id: unitA(),
          code: 'TS-0002',
          name: 'Tủ',
          category: 'Nội thất',
          unit: 'chiếc',
          original_cost: 1,
          purchase_date: vietnamToday,
        })
      ).status,
      403,
    );
    const assign = () =>
      api('POST', '/asset-assignments', token('storekeeper'), {
        asset_id: assetId,
        assigned_to_type: 'room',
        assigned_to_name: 'Phòng âm nhạc',
        received_by_name: 'Cô Lan',
        assigned_on: vietnamToday,
      });
    const assigned = await assign();
    assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    assert.match(assigned.body.code as string, /^CPTS-\d{6}$/);
    const twice = await assign();
    assert.equal(twice.status, 422);
    assert.equal(errorOf(twice.body).rule_code, 'BR-61');
    const returned = await api(
      'POST',
      `/asset-assignments/${assigned.body.id as string}/return`,
      token('storekeeper'),
      {
        returned_on: vietnamToday,
        returned_by_name: 'Cô Lan',
      },
    );
    assert.equal(returned.status, 200, JSON.stringify(returned.body));
    assert.match(returned.body.return_code as string, /^THTS-\d{6}$/);

    const loan = await api('POST', '/asset-loans', token('storekeeper'), {
      asset_id: assetId,
      borrower_name: 'Thầy Minh',
      from_date: addDays(vietnamToday, -5),
      due_date: addDays(vietnamToday, -1),
    });
    assert.equal(loan.status, 201, JSON.stringify(loan.body));
    const overdue = await api('GET', '/asset-loans?status=overdue', token('storekeeper'));
    assert.equal((overdue.body as unknown as Array<{ id: string }>)[0]?.id, loan.body.id);

    const damage = await api('POST', '/asset-damages', token('storekeeper'), {
      asset_id: assetId,
      incident_type: 'damaged',
      severity: 'major',
      description: 'Vỡ màn hình',
      occurred_on: vietnamToday,
      proposed_handling: 'Gửi bảo hành',
    });
    assert.equal(damage.status, 201, JSON.stringify(damage.body));
    const damageId = damage.body.id as string;
    assert.equal((await api('POST', `/asset-damages/${damageId}/approve`, token('storekeeper'), {})).status, 403);
    const approved = await api('POST', `/asset-damages/${damageId}/approve`, token('vicePrincipal'), {
      note: 'Đồng ý',
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    const detail = await api('GET', `/assets/${assetId}`, token('storekeeper'));
    assert.equal(detail.body.status, 'damaged');
    const loans = detail.body.loans as Array<{ status: string }>;
    assert.equal(loans[0]?.status, 'returned');
    assert.equal((await assign()).status, 422);
    assert.equal((await api('GET', '/assets', token('teacher'))).status, 403);
  });

  it('Mở năm học mới: chuyển tài sản, mặt hàng kèm tồn, nhà cung cấp; tồn ban đầu không nhập lại được', async () => {
    const lent = await api('POST', '/assets', token('storekeeper'), {
      org_unit_id: unitA(),
      code: 'TS-0003',
      name: 'Máy chiếu',
      category: 'Thiết bị điện tử',
      unit: 'chiếc',
      original_cost: 8_000_000,
      purchase_date: vietnamToday,
    });
    const loan = await api('POST', '/asset-loans', token('storekeeper'), {
      asset_id: lent.body.id,
      borrower_name: 'Cô Hoa',
      from_date: vietnamToday,
      due_date: addDays(vietnamToday, 3),
    });
    assert.equal(loan.status, 201, JSON.stringify(loan.body));
    const newYearId = (await api('POST', '/academic-years', principal.accessToken, { name: '2027–2028' })).body
      .id as string;
    const saved = await api('PUT', `/academic-years/${newYearId}/calendar`, principal.accessToken, {
      first_term: { start_date: addDays(vietnamToday, 210), end_date: addDays(vietnamToday, 330) },
      second_term: { start_date: addDays(vietnamToday, 335), end_date: addDays(vietnamToday, 450) },
      summer_term: null,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const opened = await api('POST', `/academic-years/${newYearId}/open`, principal.accessToken);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', newYearId)
      .executeTakeFirstOrThrow();
    const newYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    try {
      const assets = await newYear.selectFrom('assets').select(['code', 'status']).orderBy('code').execute();
      assert.deepEqual(assets, [
        { code: 'TS-0001', status: 'damaged' },
        { code: 'TS-0003', status: 'on_loan' },
      ]);
      assert.equal((await newYear.selectFrom('asset_loans').select('id').execute()).length, 1);
      assert.equal((await newYear.selectFrom('suppliers').select('id').execute()).length, 1);
      const item = await newYear
        .selectFrom('stock_items')
        .select(['id', 'current_qty'])
        .where('code', '=', 'BUT-CHI')
        .executeTakeFirstOrThrow();
      assert.equal(Number(item.current_qty), 6);
      const opening = await api('POST', '/stock-opening-balances', token('storekeeper'), {
        org_unit_id: unitA(),
        balance_date: vietnamToday,
        lines: [{ stock_item_id: item.id, quantity: 1, unit_price: 1 }],
      });
      assert.equal(opening.status, 422, JSON.stringify(opening.body));
      assert.equal(errorOf(opening.body).rule_code, 'BR-62');
    } finally {
      await newYear.destroy();
    }
  });
});
