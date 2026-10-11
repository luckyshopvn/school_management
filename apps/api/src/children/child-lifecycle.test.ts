import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
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

// Chuyển đơn vị, thôi học, đồng ý hình ảnh, cờ trẻ con nhân viên (DT-09 phần 9b, YCTD-67); ca kiểm thử CTC-P02-049 đến
// 064, CT-012, CT-146, CT-147
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

describe('Chuyển đơn vị, thôi học, đồng ý hình ảnh', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let academicYearId = '';
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);

  async function upload(accessToken: string, unit: string, purpose: string) {
    const form = new FormData();
    form.set('org_unit_id', units[unit] ?? '');
    form.set('purpose', purpose);
    form.set('file', new Blob([PDF]), 'tep.pdf');
    const response = await fetch(`${environment.baseUrl}/files`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: form,
    });
    return ((await response.json()) as { id: string }).id;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: addDays(vietnamToday, -60), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
    });
    const yearDatabase = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, yearDatabase.database_name),
    );
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-B1', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    const unitA = units['ĐT-A1'] ?? '';
    users.manager = await environment.loginAs('VT-03', unitA);
    users.teacher = await environment.loginAs('VT-07', unitA);
    users.otherTeacher = await environment.loginAs('VT-07', unitA);
    users.admissions = await environment.loginAs('VT-12', unitA);
    users.accountant = await environment.loginAs('VT-04', unitA);
    users.parent = await environment.loginAs('VT-14', unitA);
    for (const [code, unit] of [
      ['L-A1', 'ĐT-A1'],
      ['L-B1', 'ĐT-B1'],
    ] as const) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: units[unit] ?? '',
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: 'MAM',
            max_size: 25,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classes['L-A1'] ?? '',
        staff_user_id: users.teacher?.userId ?? '',
        staff_name: 'GV-A1',
        assignment_role: 'homeroom',
        from_date: addDays(vietnamToday, -60),
      })
      .execute();
    for (const key of ['T1', 'T2', 'T3']) {
      children[key] = (
        await schoolYear
          .insertInto('children')
          .values({
            org_unit_id: unitA,
            full_name: `Trẻ ${key}`,
            dob: '2022-03-01',
            gender: 'female',
            national_id_encrypted: 'ma-hoa',
            national_id_hash: randomUUID(),
            national_id_last4: '0000',
            photo_consent: 'pending',
            status: 'active',
            enroll_date: addDays(vietnamToday, -60),
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({
          child_id: children[key] ?? '',
          class_id: classes['L-A1'] ?? '',
          from_date: addDays(vietnamToday, -60),
        })
        .execute();
    }
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ T1', phone: null, user_id: users.parent?.userId ?? null })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({ child_id: children.T1 ?? '', guardian_id: guardian.id, relationship_item_id: relationship.id })
      .execute();
    // T3 còn hóa đơn đã phát hành chưa nộp 3 000 000 (CTC-P02-049)
    ids.invoice = (
      await schoolYear
        .insertInto('invoices')
        .values({
          code: `HD-${randomInt(100_000, 999_999)}`,
          child_id: children.T3 ?? '',
          org_unit_id: unitA,
          period_year: Number(vietnamToday.slice(0, 4)),
          period_month: Number(vietnamToday.slice(5, 7)),
          invoice_kind: 'supplementary',
          status: 'issued',
          total_amount: 3_000_000,
          basis: JSON.stringify({}),
          review_flags: JSON.stringify([]),
          due_date: '2099-12-31',
          issued_at: new Date(),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    ids.category = (
      await api('POST', '/cashflow-categories', token('accountant'), {
        code: 'THU_HOC_PHI',
        name: 'Thu học phí',
        group_name: 'Hoạt động thường xuyên',
        flow_type: 'income',
      })
    ).body.id as string;
    ids.refundCategory = (
      await api('POST', '/cashflow-categories', token('accountant'), {
        code: 'HOAN_TIEN',
        name: 'Hoàn tiền',
        group_name: 'Hoạt động thường xuyên',
        flow_type: 'expense',
      })
    ).body.id as string;
    ids.account = (
      await api('POST', '/cash-accounts', token('accountant'), {
        org_unit_id: unitA,
        account_type: 'cash',
        name: 'QUY-A',
        opening_balance: 5_000_000,
      })
    ).body.id as string;
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  const receipt = (child: string, amount: number, allocations: Array<{ invoice_id: string; amount: number }>) =>
    api('POST', '/receipts', token('accountant'), {
      request_key: randomUUID(),
      child_id: children[child],
      payer_name: `Mẹ ${child}`,
      amount,
      method: 'cash',
      account_id: ids.account,
      category_id: ids.category,
      receipt_date: vietnamToday,
      allocations,
    });

  describe('P02-07 Chuyển đơn vị', () => {
    it('CTC-P02-049, CT-012: trẻ còn nợ 3 000 000 thì chuyển đơn vị bị chặn, yêu cầu tất toán trước', async () => {
      const response = await api('POST', `/children/${children.T3}/transfer-unit`, principal.accessToken, {
        class_id: classes['L-B1'],
        reason: 'Gia đình chuyển nhà',
      });
      assert.equal(response.status, 422, JSON.stringify(response.body));
      assert.equal(errorOf(response.body).rule_code, 'LP-02');
    });

    it('CTC-P02-051: quản lý đơn vị A chuyển trẻ sang đơn vị B ngoài phạm vi bị từ chối', async () => {
      const response = await api('POST', `/children/${children.T3}/transfer-unit`, token('manager'), {
        class_id: classes['L-B1'],
        reason: 'Gia đình chuyển nhà',
      });
      assert.equal(response.status, 403);
    });

    it('CTC-P02-050, CTC-P02-052: tất toán rồi Hiệu trưởng chuyển sang lớp L-B1; lịch sử ghi đơn vị, lớp cũ; quản lý, giáo viên đơn vị A không đọc được nữa', async () => {
      const paid = await receipt('T3', 3_000_000, [{ invoice_id: ids.invoice ?? '', amount: 3_000_000 }]);
      assert.equal(paid.status, 201, JSON.stringify(paid.body));
      const response = await api('POST', `/children/${children.T3}/transfer-unit`, principal.accessToken, {
        class_id: classes['L-B1'],
        reason: 'Gia đình chuyển nhà',
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.from_org_unit_id, units['ĐT-A1']);
      assert.equal(response.body.from_class_id, classes['L-A1']);
      assert.equal(response.body.to_org_unit_id, units['ĐT-B1']);
      const detail = await api('GET', `/children/${children.T3}`, principal.accessToken);
      assert.equal(detail.body.org_unit_id, units['ĐT-B1']);
      assert.equal((detail.body.current_class as { class_id: string }).class_id, classes['L-B1']);
      assert.equal((detail.body.enrollments as unknown[]).length, 2);
      assert.equal((await api('GET', `/children/${children.T3}`, token('manager'))).status, 403);
      assert.equal((await api('GET', `/children/${children.T3}`, token('teacher'))).status, 403);
    });
  });

  describe('P02-08 Thôi học', () => {
    it('CTC-P02-058: giáo viên và nhân viên tuyển sinh ghi nhận thôi học bị từ chối', async () => {
      for (const name of ['teacher', 'admissions']) {
        const response = await api('POST', `/children/${children.T2}/withdraw`, token(name), {
          reason: 'Chuyển trường',
        });
        assert.equal(response.status, 403, name);
      }
    });

    it('CTC-P02-053, CTC-P02-056: quản lý đơn vị ghi nhận thôi học; hồ sơ còn, không còn trong lớp; số thu vượt giữ thành số dư có', async () => {
      const credit = await receipt('T2', 1_200_000, []);
      assert.equal(credit.status, 201, JSON.stringify(credit.body));
      assert.equal((await api('POST', `/children/${children.T2}/withdraw`, token('manager'), {})).status, 400);
      const response = await api('POST', `/children/${children.T2}/withdraw`, token('manager'), {
        leave_date: vietnamToday,
        reason: 'Chuyển trường',
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.status, 'withdrawn');
      assert.equal(response.body.credit_amount, 1_200_000);
      const detail = await api('GET', `/children/${children.T2}`, token('manager'));
      assert.equal(detail.status, 200);
      assert.equal(detail.body.status, 'withdrawn');
      assert.equal(detail.body.current_class, null);
      const members = await api('GET', `/classes/${classes['L-A1']}/children`, token('manager'));
      assert.ok(!(members.body as unknown as Array<{ id: string }>).some((row) => row.id === children.T2));
      const payments = await schoolYear
        .selectFrom('payments')
        .select('id')
        .where('child_id', '=', children.T2 ?? '')
        .execute();
      assert.equal(payments.length, 0);
      const again = await api('POST', `/children/${children.T2}/withdraw`, token('manager'), { reason: 'Lần hai' });
      assert.equal(again.status, 422);
    });

    it('CTC-P02-055: Hiệu trưởng quyết định hoàn tiền thì phiếu chi hoàn tiền thôi học chuyển Hiệu trưởng duyệt', async () => {
      const fileId = await upload(token('accountant'), 'ĐT-A1', 'payment_voucher');
      const created = await api('POST', '/payments', token('accountant'), {
        request_key: randomUUID(),
        org_unit_id: units['ĐT-A1'],
        payment_type: 'refund',
        child_id: children.T2,
        payee_name: 'Mẹ T2',
        amount: 1_200_000,
        content: 'Hoàn tiền thôi học',
        account_id: ids.account,
        category_id: ids.refundCategory,
        file_ids: [fileId],
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const submitted = await api('POST', `/payments/${created.body.id}/submit`, token('accountant'));
      assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
      assert.equal(submitted.body.requires_principal, true);
    });
  });

  describe('P02-09 Cờ trẻ con nhân viên và đồng ý hình ảnh', () => {
    it('CTC-P02-059, CTC-P02-064: quản lý đơn vị gắn cờ trẻ con nhân viên; giáo viên bị từ chối', async () => {
      const body = {
        is_staff_child: true,
        related_staff_user_id: users.otherTeacher?.userId,
        related_staff_role_code: 'VT-07',
      };
      assert.equal((await api('PUT', `/children/${children.T1}/staff-child`, token('teacher'), body)).status, 403);
      const saved = await api('PUT', `/children/${children.T1}/staff-child`, token('manager'), body);
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      const detail = await api('GET', `/children/${children.T1}`, token('manager'));
      assert.equal(detail.body.is_staff_child, true);
      assert.equal(detail.body.related_staff_user_id, users.otherTeacher?.userId);
    });

    it('CTC-P02-060: phụ huynh đồng ý trên ứng dụng; lịch sử ghi cách đồng ý, người, thời điểm', async () => {
      const response = await api('POST', `/children/${children.T1}/photo-consent`, token('parent'), {
        action: 'grant',
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.photo_consent, 'granted');
      const latest = (
        response.body.history as Array<{ action: string; method: string; actor_user_id: string; created_at: string }>
      )[0];
      assert.equal(latest?.method, 'app');
      assert.equal(latest?.actor_user_id, users.parent?.userId);
      assert.ok(latest?.created_at);
    });

    it('CTC-P02-063, CT-147: phụ huynh của T1 đổi đồng ý của trẻ khác bị từ chối', async () => {
      const response = await api('POST', `/children/${children.T2}/photo-consent`, token('parent'), {
        action: 'grant',
      });
      assert.equal(response.status, 403);
    });

    it('CTC-P02-061: quản lý đơn vị ghi nhận giấy ký tay kèm bản chụp; thiếu bản chụp bị chặn', async () => {
      assert.equal(
        (await api('POST', `/children/${children.T2}/photo-consent`, token('manager'), { action: 'grant' })).status,
        400,
      );
      const fileId = await upload(token('manager'), 'ĐT-A1', 'photo_consent');
      const response = await api('POST', `/children/${children.T2}/photo-consent`, token('manager'), {
        action: 'grant',
        file_id: fileId,
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.photo_consent, 'granted');
      const latest = (response.body.history as Array<{ method: string; file_id: string }>)[0];
      assert.equal(latest?.method, 'paper');
      assert.equal(latest?.file_id, fileId);
    });

    it('CTC-P02-062, CT-146: phụ huynh rút đồng ý thì trạng thái không đồng ý, giáo viên lớp nhận thông báo, lịch sử còn đủ', async () => {
      const response = await api('POST', `/children/${children.T1}/photo-consent`, token('parent'), {
        action: 'withdraw',
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.photo_consent, 'refused');
      assert.deepEqual(
        (response.body.history as Array<{ action: string }>).map((row) => row.action),
        ['refused', 'granted'],
      );
      const notice = await schoolYear
        .selectFrom('notifications')
        .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
        .select('notification_recipients.user_id')
        .where('notifications.template_code', '=', 'photo_consent_withdrawn')
        .executeTakeFirstOrThrow();
      assert.equal(notice.user_id, users.teacher?.userId);
    });
  });
});
