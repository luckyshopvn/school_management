import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { IMPORT_COLUMNS } from '../imports/imports.service.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Phiếu chi, duyệt theo hạn mức, hoàn tiền thôi học và sổ quỹ; ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/04_P06.md
// mục 5, 6. QUY-A có số dư đầu 5 000 000; hạn mức phiếu chi của đơn vị A là 10 000 000; T2 có số dư có 500 000 nộp
// chuyển khoản vào NH-A
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

describe('Phiếu chi và sổ quỹ', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const accounts: Record<string, string> = {};
  const categories: Record<string, string> = {};
  const payments: Record<string, string> = {};

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const balance = async (account: string) =>
    Number(
      (
        await schoolYear
          .selectFrom('cash_accounts')
          .select('current_balance')
          .where('id', '=', accounts[account] ?? '')
          .executeTakeFirstOrThrow()
      ).current_balance,
    );

  async function upload(accessToken: string, unit = 'ĐT-A1'): Promise<{ status: number; id: string }> {
    const form = new FormData();
    form.set('org_unit_id', units[unit] ?? '');
    form.set('purpose', 'payment_voucher');
    form.set('file', new Blob([PDF]), 'hoa-don.pdf');
    const response = await fetch(`${environment.baseUrl}/files`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: form,
    });
    return { status: response.status, id: ((await response.json()) as { id: string }).id };
  }

  async function draft(
    accessToken: string,
    input: {
      amount: number;
      account?: string;
      type?: string;
      child?: string;
      attach?: boolean;
      unit?: string;
      category?: string;
    },
  ) {
    const fileIds = input.attach === false ? [] : [(await upload(accessToken, input.unit)).id];
    return api('POST', '/payments', accessToken, {
      request_key: randomUUID(),
      org_unit_id: units[input.unit ?? 'ĐT-A1'],
      payment_type: input.type ?? 'regular',
      ...(input.child ? { child_id: children[input.child] } : {}),
      payee_name: 'Cửa hàng thực phẩm Xanh',
      amount: input.amount,
      content: 'Mua nguyên liệu bữa trưa',
      account_id: accounts[input.account ?? 'QUY-A'],
      category_id: categories[input.category ?? 'MUA_NGUYEN_LIEU'],
      file_ids: fileIds,
    });
  }

  async function submitted(accessToken: string, input: Parameters<typeof draft>[1]): Promise<string> {
    const created = await draft(accessToken, input);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const submit = await api('POST', `/payments/${created.body.id}/submit`, accessToken);
    assert.equal(submit.status, 200, JSON.stringify(submit.body));
    return created.body.id as string;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    savedDefaultPassword = await environment.identity.database
      .selectFrom('identity_settings')
      .select(['key', 'value', 'updated_by'])
      .where('key', '=', 'parent_default_password_hash')
      .execute();
    await sendJson('PUT', `${environment.identity.baseUrl}/auth/settings`, principal.accessToken, {
      parent_default_password: 'PhuHuynh2026',
    });
    const yearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-01', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const databaseRow = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', yearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, databaseRow.database_name),
    );
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-B1', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'MAM',
      name: 'Mầm',
      age_from_months: 48,
      age_to_months: 59,
    });
    await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'parent_relationship',
      code: 'ME',
      name: 'Mẹ',
    });
    for (const [code, unit] of [
      ['L-A1', 'ĐT-A1'],
      ['L-B1', 'ĐT-B1'],
    ] as const) {
      await api('POST', '/classes', principal.accessToken, {
        org_unit_id: units[unit],
        code,
        name: code,
        grade_level: 'MAM',
        max_size: 25,
      });
    }
    const unitA = units['ĐT-A1'] ?? null;
    users.accountant = await environment.loginAs('VT-04', unitA);
    users.cashier = await environment.loginAs('VT-16', unitA);
    users.chiefAccountant = await environment.loginAs('VT-05', unitA);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.vicePrincipal = await environment.loginAs('VT-15', unitA);
    users.teacher = await environment.loginAs('VT-07', unitA);
    users.accountantB = await environment.loginAs('VT-04', units['ĐT-B1'] ?? null);
    for (const [documentType, amount] of [
      ['payment', 10_000_000],
      ['payment_reversal', 1_000_000],
    ] as const) {
      const threshold = await api('PUT', '/approval-thresholds', principal.accessToken, {
        org_unit_id: unitA,
        document_type: documentType,
        threshold_amount: amount,
      });
      assert.equal(threshold.status, 200, JSON.stringify(threshold.body));
    }

    const book = new ExcelJS.Workbook();
    const worksheet = book.addWorksheet('Trẻ');
    worksheet.addRow(IMPORT_COLUMNS.children.map((column) => column.header));
    for (const [index, [name, unit, classCode]] of [
      ['T2', 'ĐT-A1', 'L-A1'],
      ['T3', 'ĐT-B1', 'L-B1'],
    ].entries()) {
      const row: Record<string, string> = {
        unit_code: unit ?? '',
        class_code: classCode ?? '',
        full_name: `Trẻ ${name}`,
        dob: '2022-04-18',
        gender: 'Nam',
        national_id: `087${String(Date.now() % 1_000_000).padStart(6, '0')}${String(randomInt(0, 100) * 10 + index).padStart(3, '0')}`,
        allergies: 'Không',
        enroll_date: '2026-09-01',
        guardian1_name: `Mẹ ${name}`,
        guardian1_relationship: 'Mẹ',
        guardian1_phone: randomPhone(),
      };
      worksheet.addRow(IMPORT_COLUMNS.children.map((column) => row[column.key] ?? ''));
    }
    const form = new FormData();
    form.set('type', 'children');
    form.set('file', new Blob([Buffer.from(await book.xlsx.writeBuffer())]), 'tre.xlsx');
    const uploaded = (await (
      await fetch(`${environment.baseUrl}/imports`, {
        method: 'POST',
        headers: { authorization: `Bearer ${principal.accessToken}` },
        body: form,
      })
    ).json()) as { id: string; status: string };
    assert.equal(uploaded.status, 'validated', JSON.stringify(uploaded));
    assert.equal((await api('POST', `/imports/${uploaded.id}/commit`, principal.accessToken)).status, 200);
    for (const row of await schoolYear.selectFrom('children').select(['id', 'full_name']).execute()) {
      children[row.full_name.replace('Trẻ ', '')] = row.id;
    }

    for (const [code, flowType] of [
      ['THU_HOC_PHI', 'income'],
      ['MUA_NGUYEN_LIEU', 'expense'],
      ['HOAN_TIEN', 'expense'],
    ] as const) {
      categories[code] = (
        await api('POST', '/cashflow-categories', token('accountant'), {
          code,
          name: code,
          group_name: 'Hoạt động thường xuyên',
          flow_type: flowType,
        })
      ).body.id as string;
    }
    for (const [name, unit, type, opening] of [
      ['QUY-A', 'ĐT-A1', 'cash', 5_000_000],
      ['NH-A', 'ĐT-A1', 'bank', 0],
      ['QUY-B', 'ĐT-B1', 'cash', 1_000_000],
    ] as const) {
      const created = await api('POST', '/cash-accounts', token(unit === 'ĐT-A1' ? 'accountant' : 'accountantB'), {
        org_unit_id: units[unit],
        account_type: type,
        name,
        ...(type === 'bank' ? { bank_name: 'Ngân hàng A', account_number: '0123456789' } : {}),
        opening_balance: opening,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      accounts[name] = created.body.id as string;
    }
    const credit = await api('POST', '/receipts', token('accountant'), {
      request_key: randomUUID(),
      child_id: children.T2,
      payer_name: 'Mẹ T2',
      amount: 500_000,
      method: 'transfer',
      account_id: accounts['NH-A'],
      category_id: categories.THU_HOC_PHI,
      receipt_date: vietnamToday,
    });
    assert.equal(credit.status, 201, JSON.stringify(credit.body));
  });

  after(async () => {
    const identity = environment.identity.database;
    await identity.deleteFrom('identity_settings').where('key', '=', 'parent_default_password_hash').execute();
    for (const row of savedDefaultPassword) {
      await identity
        .insertInto('identity_settings')
        .values({ key: row.key, value: JSON.stringify(row.value), updated_by: row.updated_by })
        .execute();
    }
    await schoolYear.destroy();
    await environment.close();
  });

  describe('P06-04 Phiếu chi', () => {
    it('CTC-P06-026: trình phiếu chi không có chứng từ bị chặn', async () => {
      const created = await draft(token('accountant'), { amount: 100_000, attach: false });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const submit = await api('POST', `/payments/${created.body.id}/submit`, token('accountant'));
      assert.equal(submit.status, 422);
      assert.equal(errorOf(submit.body).rule_code, 'BR-28');
      payments.noVoucher = created.body.id as string;
    });

    it('CTC-P06-036: xóa được phiếu nháp; khoản mục thu hoặc nguồn chi đơn vị khác trả ERR_VALIDATION', async () => {
      assert.equal((await api('DELETE', `/payments/${payments.noVoucher}`, token('accountant'))).status, 204);
      assert.equal((await draft(token('accountant'), { amount: 100_000, category: 'THU_HOC_PHI' })).status, 400);
      assert.equal((await draft(token('accountant'), { amount: 100_000, account: 'QUY-B' })).status, 400);
    });

    it('CTC-P06-025: phiếu chi thường 2 000 000 dưới hạn mức, Phó Hiệu trưởng duyệt thì phát hành, QUY-A còn 3 000 000', async () => {
      const paymentId = await submitted(token('accountant'), { amount: 2_000_000 });
      const pending = await api('GET', `/payments/pending?org_unit_id=${units['ĐT-A1']}`, token('vicePrincipal'));
      assert.ok((pending.body as unknown as Array<{ id: string }>).some((row) => row.id === paymentId));
      const approved = await api('POST', `/payments/${paymentId}/approve`, token('vicePrincipal'));
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      assert.equal(approved.body.status, 'issued');
      assert.match(approved.body.code as string, /^PC-\d{6}$/);
      assert.equal(approved.body.approved_by, users.vicePrincipal?.userId);
      assert.equal(approved.body.payment_date, vietnamToday);
      assert.equal((approved.body.attachments as unknown[]).length, 1);
      assert.equal(await balance('QUY-A'), 3_000_000);
      const audit = await schoolYear
        .selectFrom('audit_logs')
        .select('actor_user_id')
        .where('entity_name', '=', 'payments')
        .where('entity_id', '=', paymentId)
        .where('action', '=', 'update')
        .orderBy('created_at', 'desc')
        .executeTakeFirstOrThrow();
      assert.equal(audit.actor_user_id, users.vicePrincipal?.userId);
      payments.issued = paymentId;
    });

    it('CTC-P06-030, CTC-P06-036: duyệt lần hai bị từ chối kèm người đã duyệt; xóa phiếu đã phát hành bị từ chối', async () => {
      const again = await api('POST', `/payments/${payments.issued}/approve`, principal.accessToken);
      assert.equal(again.status, 422);
      assert.match(JSON.stringify(again.body), new RegExp(users.vicePrincipal?.userId ?? ''));
      const removed = await api('DELETE', `/payments/${payments.issued}`, token('accountant'));
      assert.equal(removed.status, 422);
      assert.equal(errorOf(removed.body).rule_code, 'BR-29');
    });

    it('CTC-P06-027: phiếu chi 4 000 000 khi QUY-A còn 3 000 000 bị chặn, phiếu vẫn chờ duyệt', async () => {
      const paymentId = await submitted(token('accountant'), { amount: 4_000_000 });
      const approve = await api('POST', `/payments/${paymentId}/approve`, token('vicePrincipal'));
      assert.equal(approve.status, 422);
      assert.equal(errorOf(approve.body).rule_code, 'BR-34');
      assert.equal((await api('GET', `/payments/${paymentId}`, token('accountant'))).body.status, 'pending');
      assert.equal(await balance('QUY-A'), 3_000_000);
      payments.tooLarge = paymentId;
    });

    it('CTC-P06-028: duyệt đồng thời hai phiếu chi 2 000 000 khi QUY-A còn 3 000 000 thì chỉ một phiếu phát hành', async () => {
      const first = await submitted(token('accountant'), { amount: 2_000_000 });
      const second = await submitted(token('accountant'), { amount: 2_000_000 });
      const responses = await Promise.all(
        [first, second].map((paymentId) => api('POST', `/payments/${paymentId}/approve`, token('vicePrincipal'))),
      );
      assert.deepEqual(responses.map((response) => response.status).sort(), [200, 422]);
      assert.equal(await balance('QUY-A'), 1_000_000);
    });

    it('CTC-P06-029: phiếu chi 15 000 000 từ hạn mức trở lên chuyển Hiệu trưởng, Phó Hiệu trưởng duyệt bị từ chối', async () => {
      const paymentId = await submitted(token('accountant'), { amount: 15_000_000 });
      const detail = await api('GET', `/payments/${paymentId}`, token('accountant'));
      assert.equal(detail.body.status, 'pending');
      assert.equal(detail.body.requires_principal, true);
      assert.equal((await api('POST', `/payments/${paymentId}/approve`, token('vicePrincipal'))).status, 403);
      const pending = await api('GET', `/payments/pending?org_unit_id=${units['ĐT-A1']}`, token('vicePrincipal'));
      assert.ok(!(pending.body as unknown as Array<{ id: string }>).some((row) => row.id === paymentId));
    });

    it('CTC-P06-031: Phó Hiệu trưởng từ chối kèm lý do thì phiếu về nháp, kế toán nhận thông báo; sửa và trình lại được', async () => {
      const withoutReason = await api('POST', `/payments/${payments.tooLarge}/reject`, token('vicePrincipal'), {});
      assert.equal(withoutReason.status, 400);
      const rejected = await api('POST', `/payments/${payments.tooLarge}/reject`, token('vicePrincipal'), {
        reason: 'Quỹ không đủ, tách làm hai lần',
      });
      assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
      assert.equal(rejected.body.status, 'draft');
      assert.equal(rejected.body.reject_reason, 'Quỹ không đủ, tách làm hai lần');
      const notice = await schoolYear
        .selectFrom('notifications')
        .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
        .select('notification_recipients.user_id')
        .where('notifications.template_code', '=', 'payment_rejected')
        .where('notifications.target_id', '=', payments.tooLarge ?? '')
        .executeTakeFirstOrThrow();
      assert.equal(notice.user_id, users.accountant?.userId);
      const file = await upload(token('accountant'));
      const edited = await api('PATCH', `/payments/${payments.tooLarge}`, token('accountant'), {
        payment_type: 'regular',
        payee_name: 'Cửa hàng thực phẩm Xanh',
        amount: 500_000,
        content: 'Mua nguyên liệu, lần một',
        account_id: accounts['QUY-A'],
        category_id: categories.MUA_NGUYEN_LIEU,
        file_ids: [file.id],
      });
      assert.equal(edited.status, 200, JSON.stringify(edited.body));
      assert.equal(edited.body.amount, 500_000);
      assert.equal((await api('POST', `/payments/${payments.tooLarge}/submit`, token('accountant'))).status, 200);
    });

    it('CTC-P06-033: phiếu chi hoàn tiền không chọn trẻ trả ERR_VALIDATION', async () => {
      const response = await draft(token('accountant'), { amount: 100_000, type: 'refund', category: 'HOAN_TIEN' });
      assert.equal(response.status, 400);
    });

    it('CTC-P06-032: hoàn tiền thôi học 500 000 cho T2 chuyển Hiệu trưởng dù dưới hạn mức; duyệt thì số dư có của T2 về 0', async () => {
      const tooMuch = await submitted(token('accountant'), {
        amount: 600_000,
        type: 'refund',
        child: 'T2',
        account: 'NH-A',
        category: 'HOAN_TIEN',
      }).catch((error: unknown) => error);
      assert.ok(tooMuch instanceof Error && /BR-24/.test(tooMuch.message));
      const paymentId = await submitted(token('accountant'), {
        amount: 500_000,
        type: 'refund',
        child: 'T2',
        account: 'NH-A',
        category: 'HOAN_TIEN',
      });
      assert.equal((await api('POST', `/payments/${paymentId}/approve`, token('vicePrincipal'))).status, 403);
      const approved = await api('POST', `/payments/${paymentId}/approve`, principal.accessToken);
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      const debt = await api('GET', `/children/${children.T2}/debt`, token('accountant'));
      assert.equal(debt.body.credit_amount, 0);
      assert.equal(await balance('NH-A'), 0);
      payments.refund = paymentId;
    });

    it('tài khoản ngân hàng không đủ số dư thì mặc định chặn duyệt (BR-34)', async () => {
      const paymentId = await submitted(token('accountant'), { amount: 100_000, account: 'NH-A' });
      const approve = await api('POST', `/payments/${paymentId}/approve`, token('vicePrincipal'));
      assert.equal(approve.status, 422);
      assert.equal(errorOf(approve.body).rule_code, 'BR-34');
    });

    it('CTC-P06-035: thủ quỹ lập và trình phiếu chi tiền mặt được; chi từ ngân hàng bị từ chối', async () => {
      const bank = await draft(token('cashier'), { amount: 100_000, account: 'NH-A' });
      assert.equal(bank.status, 403);
      const paymentId = await submitted(token('cashier'), { amount: 100_000 });
      const approved = await api('POST', `/payments/${paymentId}/approve`, token('vicePrincipal'));
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      assert.equal(await balance('QUY-A'), 900_000);
    });

    it('CTC-P06-040, CTC-P06-041, CTC-P06-042: giáo viên xem phiếu chi, kế toán A lập cho đơn vị B, quản lý đơn vị lập phiếu chi đều bị từ chối', async () => {
      assert.equal((await api('GET', '/payments', token('teacher'))).status, 403);
      assert.equal((await upload(token('accountant'), 'ĐT-B1')).status, 403);
      const forB = await api('POST', '/payments', token('accountant'), {
        request_key: randomUUID(),
        org_unit_id: units['ĐT-B1'],
        payment_type: 'regular',
        payee_name: 'Nhà cung cấp',
        amount: 100_000,
        content: 'Chi thử',
        account_id: accounts['QUY-B'],
        category_id: categories.MUA_NGUYEN_LIEU,
      });
      assert.equal(forB.status, 403);
      assert.equal((await draft(token('manager'), { amount: 100_000, attach: false })).status, 403);
      const listed = await api('GET', `/payments?org_unit_id=${units['ĐT-A1']}`, token('manager'));
      assert.equal(listed.status, 200);
    });
  });

  describe('P06-05 Sổ quỹ', () => {
    it('CTC-P06-043, CTC-P06-044: sổ quỹ của ngày có số dư đầu, các phiếu chi tiền mặt và số dư cuối bằng số dư hiện tại; phiếu thu chuyển khoản không vào QUY-A', async () => {
      const response = await api(
        'GET',
        `/cash-books?account_id=${accounts['QUY-A']}&from=${vietnamToday}&to=${vietnamToday}`,
        token('accountant'),
      );
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.opening_balance, 5_000_000);
      assert.equal(response.body.total_out, 4_100_000);
      assert.equal(response.body.total_in, 0);
      assert.equal(response.body.closing_balance, await balance('QUY-A'));
      const rows = response.body.transactions as Array<{ document_code: string; amount: number }>;
      assert.equal(rows.length, 3);
      assert.ok(rows.every((row) => /^PC-\d{6}$/.test(row.document_code) && row.amount < 0));
      const bank = await api(
        'GET',
        `/cash-books?account_id=${accounts['NH-A']}&from=${vietnamToday}&to=${vietnamToday}`,
        token('accountant'),
      );
      assert.deepEqual(
        (bank.body.transactions as Array<{ amount: number }>).map((row) => row.amount),
        [500_000, -500_000],
      );
    });

    it('CTC-P06-046: thủ quỹ xem được sổ QUY-A, sổ quỹ đơn vị B bị từ chối; giáo viên bị từ chối', async () => {
      const own = await api(
        'GET',
        `/cash-books?account_id=${accounts['QUY-A']}&from=${vietnamToday}&to=${vietnamToday}`,
        token('cashier'),
      );
      assert.equal(own.status, 200);
      const other = await api(
        'GET',
        `/cash-books?account_id=${accounts['QUY-B']}&from=${vietnamToday}&to=${vietnamToday}`,
        token('cashier'),
      );
      assert.equal(other.status, 403);
      const teacher = await api(
        'GET',
        `/cash-books?account_id=${accounts['QUY-A']}&from=${vietnamToday}&to=${vietnamToday}`,
        token('teacher'),
      );
      assert.equal(teacher.status, 403);
    });
  });
  describe('Phiếu đảo phiếu chi', () => {
    it('lập phiếu đảo không có lý do bị chặn; phiếu chưa phát hành không đảo được; thủ quỹ không lập được phiếu đảo', async () => {
      assert.equal(
        (await api('POST', `/payments/${payments.issued}/reverse`, token('accountant'), { reason: '' })).status,
        400,
      );
      const draftPayment = await draft(token('accountant'), { amount: 100_000 });
      const notIssued = await api('POST', `/payments/${draftPayment.body.id}/reverse`, token('accountant'), {
        reason: 'Thử',
      });
      assert.equal(notIssued.status, 422);
      const cashier = await api('POST', `/payments/${payments.issued}/reverse`, token('cashier'), { reason: 'Thử' });
      assert.equal(cashier.status, 403);
    });

    it('CTC-P06-037, CTC-P06-039: kế toán lập phiếu đảo phiếu chi 2 000 000 thì chờ duyệt, QUY-A chưa đổi; kế toán trưởng, kế toán, thủ quỹ duyệt bị từ chối', async () => {
      const before = await balance('QUY-A');
      const created = await api('POST', `/payments/${payments.issued}/reverse`, token('accountant'), {
        reason: 'Nhà cung cấp trả lại hàng',
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.match(created.body.code as string, /^DPC-\d{6}$/);
      assert.equal(created.body.requires_principal, true);
      assert.equal(await balance('QUY-A'), before);
      for (const name of ['chiefAccountant', 'accountant', 'cashier']) {
        const approve = await api('POST', `/payments/${payments.issued}/reverse/approve`, token(name));
        assert.equal(approve.status, 403, name);
      }
    });

    it('CTC-P06-038: phiếu đảo trên hạn mức thì Phó Hiệu trưởng bị từ chối, Hiệu trưởng duyệt được; QUY-A tăng lại 2 000 000', async () => {
      assert.equal(
        (await api('POST', `/payments/${payments.issued}/reverse/approve`, token('vicePrincipal'))).status,
        403,
      );
      const before = await balance('QUY-A');
      const approved = await api('POST', `/payments/${payments.issued}/reverse/approve`, principal.accessToken);
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      assert.equal(await balance('QUY-A'), before + 2_000_000);
      const detail = await api('GET', `/payments/${payments.issued}`, token('accountant'));
      assert.equal(detail.body.status, 'reversed');
      assert.equal((detail.body.reversals as Array<{ status: string }>)[0]?.status, 'approved');
      const book = await api(
        'GET',
        `/cash-books?account_id=${accounts['QUY-A']}&from=${vietnamToday}&to=${vietnamToday}`,
        token('accountant'),
      );
      const rows = book.body.transactions as Array<{ document_code: string; amount: number }>;
      assert.ok(rows.some((row) => /^DPC-\d{6}$/.test(row.document_code) && row.amount === 2_000_000));
    });

    it('đảo phiếu hoàn tiền: Phó Hiệu trưởng từ chối thì phiếu về đã phát hành; duyệt thì số dư có của T2 trở lại 500 000', async () => {
      await api('POST', `/payments/${payments.refund}/reverse`, token('chiefAccountant'), {
        reason: 'Phụ huynh chưa nhận',
      });
      const rejected = await api('POST', `/payments/${payments.refund}/reverse/reject`, token('vicePrincipal'), {
        reason: 'Đã có biên nhận',
      });
      assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
      assert.equal((await api('GET', `/payments/${payments.refund}`, token('accountant'))).body.status, 'issued');
      assert.equal((await api('GET', `/children/${children.T2}/debt`, token('accountant'))).body.credit_amount, 0);
      await api('POST', `/payments/${payments.refund}/reverse`, token('chiefAccountant'), { reason: 'Hoàn nhầm' });
      const pending = await api(
        'GET',
        `/payment-reversals/pending?org_unit_id=${units['ĐT-A1']}`,
        token('vicePrincipal'),
      );
      assert.equal((pending.body as unknown as unknown[]).length, 1);
      const approved = await api('POST', `/payments/${payments.refund}/reverse/approve`, token('vicePrincipal'));
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      assert.equal(
        (await api('GET', `/children/${children.T2}/debt`, token('accountant'))).body.credit_amount,
        500_000,
      );
      assert.equal(await balance('NH-A'), 500_000);
    });
  });

  // Phê duyệt theo hạn mức của đơn vị (DT-09 phần 9a): chi từ NH-A khi tắt kiểm tra số dư ngân hàng để không phụ thuộc
  // số dư của các ca trên
  describe('P01-10 Phê duyệt theo hạn mức', () => {
    before(async () => {
      const saved = await api('PUT', '/settings', principal.accessToken, {
        org_unit_id: units['ĐT-A1'],
        values: { bank_balance_check: false },
      });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
    });

    it('CTC-P01-049: tắt kiểm tra số dư ngân hàng thì duyệt được phiếu chi vượt số dư NH-A', async () => {
      const before = await balance('NH-A');
      const paymentId = await submitted(token('accountant'), { amount: before + 100_000, account: 'NH-A' });
      const approved = await api('POST', `/payments/${paymentId}/approve`, token('vicePrincipal'));
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      assert.equal(await balance('NH-A'), -100_000);
    });

    it('CTC-P01-060: phiếu chi 9 999 999 dưới hạn mức 10 000 000 thì Phó Hiệu trưởng duyệt được', async () => {
      const paymentId = await submitted(token('accountant'), { amount: 9_999_999, account: 'NH-A' });
      assert.equal((await api('GET', `/payments/${paymentId}`, token('accountant'))).body.requires_principal, false);
      const approved = await api('POST', `/payments/${paymentId}/approve`, token('vicePrincipal'));
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      assert.equal(approved.body.status, 'issued');
    });

    it('CTC-P01-061, CT-098, CTC-P01-065, CT-104: phiếu chi đúng bằng hạn mức thì Phó Hiệu trưởng bị chặn; Hiệu trưởng từ chối ghi nhật ký có người, thời điểm, giá trị, lý do', async () => {
      const paymentId = await submitted(token('accountant'), { amount: 10_000_000, account: 'NH-A' });
      const blocked = await api('POST', `/payments/${paymentId}/approve`, token('vicePrincipal'));
      assert.equal(blocked.status, 403);
      assert.equal(errorOf(blocked.body).code, 'ERR_FORBIDDEN');
      const rejected = await api('POST', `/payments/${paymentId}/reject`, principal.accessToken, {
        reason: 'Chưa có báo giá',
      });
      assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
      const log = await schoolYear
        .selectFrom('audit_logs')
        .select(['actor_user_id', 'after_data', 'created_at'])
        .where('entity_name', '=', 'payments')
        .where('entity_id', '=', paymentId)
        .orderBy('created_at', 'desc')
        .executeTakeFirstOrThrow();
      assert.equal(log.actor_user_id, principal.userId);
      assert.ok(log.created_at);
      assert.deepEqual(log.after_data, { status: 'draft', amount: 10_000_000, reason: 'Chưa có báo giá' });
      assert.equal((await api('POST', `/payments/${paymentId}/submit`, token('accountant'))).status, 200);
      const approved = await api('POST', `/payments/${paymentId}/approve`, principal.accessToken);
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
    });

    it('CTC-P01-066: Phó Hiệu trưởng gửi kèm hạn mức giả khi duyệt phiếu 15 000 000 vẫn bị từ chối', async () => {
      const paymentId = await submitted(token('accountant'), { amount: 15_000_000, account: 'NH-A' });
      const response = await api('POST', `/payments/${paymentId}/approve`, token('vicePrincipal'), {
        threshold_amount: 20_000_000,
        requires_principal: false,
      });
      assert.equal(response.status, 403);
      assert.equal((await api('GET', `/payments/${paymentId}`, token('accountant'))).body.status, 'pending');
    });

    it('CTC-P01-063, CT-099: tài khoản có cả VT-04 và VT-15 tự duyệt phiếu chi mình lập bị từ chối', async () => {
      const both = await environment.loginWithRoles([
        { roleCode: 'VT-04', orgUnitId: units['ĐT-A1'] ?? null },
        { roleCode: 'VT-15', orgUnitId: units['ĐT-A1'] ?? null },
      ]);
      const paymentId = await submitted(both.accessToken, { amount: 200_000, account: 'NH-A' });
      const response = await api('POST', `/payments/${paymentId}/approve`, both.accessToken);
      assert.equal(response.status, 403);
      assert.equal((await api('GET', `/payments/${paymentId}`, token('accountant'))).body.status, 'pending');
    });

    it('CTC-P01-064, CT-100: Phó Hiệu trưởng đơn vị B duyệt phiếu chi của đơn vị A bị từ chối', async () => {
      const vicePrincipalB = await environment.loginAs('VT-15', units['ĐT-B1'] ?? null);
      const paymentId = await submitted(token('accountant'), { amount: 300_000, account: 'NH-A' });
      assert.equal((await api('POST', `/payments/${paymentId}/approve`, vicePrincipalB.accessToken)).status, 403);
    });

    it('CTC-P06-054: ngừng khoản mục chi thì phiếu chi cũ giữ khoản mục, phiếu chi mới chọn khoản mục đó bị chặn', async () => {
      const created = await api('POST', '/cashflow-categories', token('accountant'), {
        code: 'VAN_PHONG_PHAM',
        name: 'Văn phòng phẩm',
        group_name: 'Hoạt động thường xuyên',
        flow_type: 'expense',
      });
      categories.VAN_PHONG_PHAM = created.body.id as string;
      const paymentId = await submitted(token('accountant'), {
        amount: 100_000,
        account: 'NH-A',
        category: 'VAN_PHONG_PHAM',
      });
      const stopped = await api('PATCH', `/cashflow-categories/${categories.VAN_PHONG_PHAM}`, token('accountant'), {
        status: 'inactive',
      });
      assert.equal(stopped.status, 200, JSON.stringify(stopped.body));
      const old = await api('GET', `/payments/${paymentId}`, token('accountant'));
      assert.equal(old.body.category_id, categories.VAN_PHONG_PHAM);
      const fresh = await draft(token('accountant'), { amount: 100_000, account: 'NH-A', category: 'VAN_PHONG_PHAM' });
      assert.equal(fresh.status, 400, JSON.stringify(fresh.body));
    });

    it('CT-082: tổng phiếu thu và phiếu chi tiền mặt trong ngày khớp biến động sổ quỹ QUY-A', async () => {
      const receipt = await api('POST', '/receipts', token('accountant'), {
        request_key: randomUUID(),
        child_id: children.T2,
        payer_name: 'Mẹ T2',
        amount: 200_000,
        method: 'cash',
        account_id: accounts['QUY-A'],
        category_id: categories.THU_HOC_PHI,
        receipt_date: vietnamToday,
      });
      assert.equal(receipt.status, 201, JSON.stringify(receipt.body));
      const book = await api(
        'GET',
        `/cash-books?account_id=${accounts['QUY-A']}&from=${vietnamToday}&to=${vietnamToday}`,
        token('accountant'),
      );
      const rows = book.body.transactions as Array<{ amount: number }>;
      const totalIn = rows.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0);
      const totalOut = rows.filter((row) => row.amount < 0).reduce((sum, row) => sum - row.amount, 0);
      assert.ok(totalIn >= 200_000 && totalOut > 0);
      assert.equal(book.body.total_in, totalIn);
      assert.equal(book.body.total_out, totalOut);
      assert.equal(Number(book.body.closing_balance) - Number(book.body.opening_balance), totalIn - totalOut);
      assert.equal(book.body.closing_balance, await balance('QUY-A'));
    });
  });
});
