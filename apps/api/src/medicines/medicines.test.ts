import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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

// Thuốc: danh mục, dặn thuốc, nhận thuốc và cho uống, đề nghị mua, phiếu mua, phiếu cấp (DT-10 phần 10b, YCTD-75);
// kịch bản CT-053, CT-054, CT-055, CT-056, CT-116, CT-171, CT-172, CT-173
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const PDF = Buffer.from('%PDF-1.4 don thuoc');

describe('Thuốc: dặn thuốc, cho uống, mua và cấp thuốc', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let academicYearId = '';
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  let requestA = '';
  let photoA = '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);

  async function upload(accessToken: string, orgUnitId: string, purpose: string, content: Buffer = PNG) {
    const form = new FormData();
    form.set('org_unit_id', orgUnitId);
    form.set('purpose', purpose);
    form.set('file', new Blob([content]), 'anh-thuoc.png');
    const response = await fetch(`${environment.baseUrl}/files`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  const download = async (fileId: string, accessToken: string) =>
    (await fetch(`${environment.baseUrl}/files/${fileId}`, { headers: { authorization: `Bearer ${accessToken}` } }))
      .status;

  const requestBody = (childId: string, overrides: Record<string, unknown> = {}) => ({
    child_id: childId,
    medicine_name: 'Siro ho Prospan',
    dosage: '5 ml',
    times: ['08:00', '11:00'],
    from_date: vietnamToday,
    to_date: vietnamToday,
    allergy_note: 'Không dị ứng',
    ...overrides,
  });

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
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
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-B1', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    const unitA = units['ĐT-A1'] ?? '';
    const unitB = units['ĐT-B1'] ?? '';
    users.nurse = await environment.loginAs('VT-09', unitA);
    users.rootNurse = await environment.loginAs('VT-09', units.TC ?? null);
    users.homeroomA = await environment.loginAs('VT-07', unitA);
    users.homeroomB = await environment.loginAs('VT-07', unitB);
    users.vice = await environment.loginAs('VT-15', unitA);
    users.accountant = await environment.loginAs('VT-04', unitA);
    users.parentA = await environment.loginAs('VT-14', unitA);
    users.parentB = await environment.loginAs('VT-14', unitB);

    for (const [code, unit] of [
      ['MAM-1', unitA],
      ['MAM-B', unitB],
    ] as const) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unit,
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
    for (const [teacher, classCode] of [
      ['homeroomA', 'MAM-1'],
      ['homeroomB', 'MAM-B'],
    ] as const) {
      await schoolYear
        .insertInto('class_staff_assignments')
        .values({
          class_id: classes[classCode] ?? '',
          staff_user_id: users[teacher]?.userId ?? '',
          staff_name: teacher,
          assignment_role: 'homeroom',
          from_date: addDays(vietnamToday, -60),
        })
        .execute();
    }
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [key, parent, unit, classCode] of [
      ['A', 'parentA', unitA, 'MAM-1'],
      ['B', 'parentB', unitB, 'MAM-B'],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unit,
          full_name: `Trẻ ${key}`,
          dob: addDays(vietnamToday, -3 * 365),
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'pending',
          status: 'active',
          enroll_date: addDays(vietnamToday, -60),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classes[classCode] ?? '', from_date: addDays(vietnamToday, -60) })
        .execute();
      const guardian = await schoolYear
        .insertInto('guardians')
        .values({
          full_name: `Mẹ ${key}`,
          phone: `090${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`,
          user_id: users[parent]?.userId ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('child_guardians')
        .values({
          child_id: child.id,
          guardian_id: guardian.id,
          relationship_item_id: relationship.id,
          is_primary: true,
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-173: yêu cầu không có ảnh thuốc bị từ chối; có ảnh thuốc, không có đơn thì gửi được và chuyển cho y tế', async () => {
    const noPhoto = await api('POST', '/medication-requests', token('parentA'), requestBody(children.A ?? ''));
    assert.equal(noPhoto.status, 400, JSON.stringify(noPhoto.body));
    assert.ok(errorOf(noPhoto.body).details?.some((detail) => detail.field === 'medicine_photo_ids'));

    assert.equal((await upload(token('parentA'), units['ĐT-A1'] ?? '', 'medicine_photo', PDF)).status, 400);
    assert.equal((await upload(token('parentB'), units['ĐT-A1'] ?? '', 'medicine_photo')).status, 403);
    const photo = await upload(token('parentA'), units['ĐT-A1'] ?? '', 'medicine_photo');
    assert.equal(photo.status, 201, JSON.stringify(photo.body));
    photoA = photo.body.id as string;
    assert.equal(await download(photoA, token('parentB')), 403);

    const otherParent = await api(
      'POST',
      '/medication-requests',
      token('parentB'),
      requestBody(children.A ?? '', { medicine_photo_ids: [photoA] }),
    );
    assert.equal(otherParent.status, 403);
    const created = await api(
      'POST',
      '/medication-requests',
      token('parentA'),
      requestBody(children.A ?? '', { medicine_photo_ids: [photoA] }),
    );
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.status, 'pending');
    assert.equal(created.body.assigned_role, 'nurse');
    requestA = created.body.id as string;

    // Ảnh đã gắn yêu cầu: y tế và phụ huynh của trẻ xem được, phụ huynh khác không
    assert.equal(await download(photoA, token('nurse')), 200);
    assert.equal(await download(photoA, token('parentA')), 200);
    assert.equal(await download(photoA, token('parentB')), 403);

    const prescription = await upload(token('parentA'), units['ĐT-A1'] ?? '', 'prescription', PDF);
    assert.equal(prescription.status, 201, JSON.stringify(prescription.body));
    const withPrescription = await api(
      'POST',
      '/medication-requests',
      token('parentA'),
      requestBody(children.A ?? '', {
        medicine_photo_ids: [photoA],
        prescription_photo_id: prescription.body.id,
        from_date: addDays(vietnamToday, 1),
        to_date: addDays(vietnamToday, 2),
      }),
    );
    assert.equal(withPrescription.status, 201, JSON.stringify(withPrescription.body));
  });

  it('CT-053: yêu cầu thiếu giờ cho uống bị từ chối, yêu cầu bổ sung', async () => {
    for (const times of [undefined, []]) {
      const response = await api(
        'POST',
        '/medication-requests',
        token('parentA'),
        requestBody(children.A ?? '', { medicine_photo_ids: [photoA], times }),
      );
      assert.equal(response.status, 400, JSON.stringify(response.body));
      assert.ok(errorOf(response.body).details?.some((detail) => detail.field === 'times'));
    }
    const noAllergy = await api(
      'POST',
      '/medication-requests',
      token('parentA'),
      requestBody(children.A ?? '', { medicine_photo_ids: [photoA], allergy_note: '' }),
    );
    assert.equal(noAllergy.status, 400);
  });

  it('CT-172: đơn vị tắt cấu hình không có nhân viên y tế, giáo viên chủ nhiệm xác nhận nhận thuốc bị từ chối quyền', async () => {
    const response = await api('POST', `/medication-requests/${requestA}/receive`, token('homeroomA'), {});
    assert.equal(response.status, 403, JSON.stringify(response.body));
    assert.equal(errorOf(response.body).code, 'ERR_FORBIDDEN');
    const listed = await api('GET', `/medication-requests?child_id=${children.A}`, token('homeroomA'));
    assert.equal(listed.status, 200, 'giáo viên chủ nhiệm vẫn xem được yêu cầu của lớp');
  });

  it('CT-054: chưa xác nhận nhận thuốc thì chặn ghi liều', async () => {
    const response = await api('POST', '/medication-administrations', token('nurse'), {
      request_id: requestA,
      scheduled_time: '08:00',
    });
    assert.equal(response.status, 422, JSON.stringify(response.body));
    assert.equal(errorOf(response.body).rule_code, 'BR-49');
  });

  it('CT-055, CT-056, BR-88: y tế nhận thuốc, ghi liều; trùng liều bị chặn; bỏ liều cần lý do; phụ huynh xác nhận đã biết', async () => {
    assert.equal(
      (await api('POST', `/medication-requests/${requestA}/receive`, token('homeroomB'), {})).status,
      403,
      'giáo viên lớp khác không nhận được',
    );
    const received = await api('POST', `/medication-requests/${requestA}/receive`, token('nurse'), {
      received_quantity: '1 lọ 60 ml',
    });
    assert.equal(received.status, 200, JSON.stringify(received.body));
    assert.equal(
      received.body.status,
      'received',
      'QT-07: nhận thuốc chuyển sang Đã nhận thuốc, chưa phải Đang cho uống',
    );
    assert.equal(
      (await api('POST', `/medication-requests/${requestA}/receive`, token('nurse'), {})).status,
      422,
      'nhận lại phiếu đã nhận bị chặn',
    );
    assert.equal(
      (await api('POST', `/medication-requests/${requestA}/reject`, token('nurse'), { reason: 'Sai thuốc' })).status,
      422,
      'đã nhận thuốc thì không từ chối được',
    );
    const receivedNotice = await schoolYear
      .selectFrom('notifications')
      .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
      .select(['notification_recipients.user_id', 'notification_recipients.channel'])
      .where('notifications.template_code', '=', 'medication_received')
      .where('notifications.target_id', '=', requestA)
      .execute();
    assert.deepEqual(receivedNotice, [{ user_id: users.parentA?.userId, channel: 'in_app' }]);

    const first = await api('POST', '/medication-administrations', token('nurse'), {
      request_id: requestA,
      scheduled_time: '08:00',
      dose_note: 'Uống hết',
    });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const afterFirst = await api('GET', `/medication-requests/${requestA}`, token('nurse'));
    assert.equal(afterFirst.body.status, 'administering', 'liều đầu tiên chuyển sang Đang cho uống');
    // CT-1663, QT-07 mục 9: cho uống báo phụ huynh của trẻ trong ứng dụng
    const given = await schoolYear
      .selectFrom('notifications')
      .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
      .select(['notifications.title', 'notification_recipients.user_id', 'notification_recipients.channel'])
      .where('notifications.template_code', '=', 'medication_dose_given')
      .where('notifications.target_id', '=', first.body.id as string)
      .execute();
    assert.deepEqual(given, [
      { title: 'Con đã được cho uống thuốc', user_id: users.parentA?.userId, channel: 'in_app' },
    ]);
    const parentInbox = await api('GET', '/notifications?unread_only=true', token('parentA'));
    assert.ok(JSON.stringify(parentInbox.body).includes('Con đã được cho uống thuốc'));
    const otherInbox = await api('GET', '/notifications?unread_only=true', token('parentB'));
    assert.ok(!JSON.stringify(otherInbox.body).includes('Con đã được cho uống thuốc'), 'phụ huynh khác không nhận');
    const duplicate = await api('POST', '/medication-administrations', token('nurse'), {
      request_id: requestA,
      scheduled_date: vietnamToday,
      scheduled_time: '08:00',
    });
    assert.equal(duplicate.status, 409, JSON.stringify(duplicate.body));
    assert.ok(errorOf(duplicate.body).details?.some((detail) => detail.message === first.body.id));
    assert.equal(
      (
        await api('POST', '/medication-administrations', token('nurse'), {
          request_id: requestA,
          scheduled_time: '09:30',
        })
      ).status,
      400,
      'giờ không thuộc yêu cầu',
    );

    const skipWithoutReason = await api('POST', '/medication-administrations', token('nurse'), {
      request_id: requestA,
      scheduled_time: '11:00',
      is_skipped: true,
    });
    assert.equal(skipWithoutReason.status, 400, JSON.stringify(skipWithoutReason.body));
    assert.ok(errorOf(skipWithoutReason.body).details?.some((detail) => detail.field === 'skip_reason'));
    const skipped = await api('POST', '/medication-administrations', token('nurse'), {
      request_id: requestA,
      scheduled_time: '11:00',
      is_skipped: true,
      skip_reason: 'Bé ngủ say',
    });
    assert.equal(skipped.status, 201, JSON.stringify(skipped.body));
    const notified = await schoolYear
      .selectFrom('notifications')
      .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
      .select(['notification_recipients.user_id', 'notification_recipients.channel'])
      .where('notifications.template_code', '=', 'medication_dose_skipped')
      .execute();
    // QT-07 mục 9: bỏ liều báo trong ứng dụng và tin nhắn
    assert.deepEqual(notified.map((row) => row.channel).sort(), ['in_app', 'sms']);
    assert.ok(notified.every((row) => row.user_id === users.parentA?.userId));

    // Đủ liều theo lịch thì yêu cầu tự hoàn thành; phụ huynh thấy liều đã cho uống và liều bỏ
    const detail = await api('GET', `/medication-requests/${requestA}`, token('parentA'));
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.status, 'completed');
    const doses = detail.body.administrations as Array<{ id: string; is_skipped: boolean; scheduled_time: string }>;
    assert.deepEqual(
      doses.map((dose) => [dose.scheduled_time, dose.is_skipped]),
      [
        ['08:00', false],
        ['11:00', true],
      ],
    );
    assert.equal(
      (await api('POST', `/medication-administrations/${skipped.body.id}/acknowledge`, token('parentB'))).status,
      403,
    );
    assert.equal(
      (await api('POST', `/medication-administrations/${first.body.id}/acknowledge`, token('parentA'))).status,
      422,
    );
    const acknowledged = await api(
      'POST',
      `/medication-administrations/${skipped.body.id}/acknowledge`,
      token('parentA'),
    );
    assert.equal(acknowledged.status, 200, JSON.stringify(acknowledged.body));
    assert.ok(acknowledged.body.parent_acknowledged_at);
    const nurseView = await api('GET', `/medication-requests/${requestA}`, token('nurse'));
    assert.ok(
      (nurseView.body.administrations as Array<{ parent_acknowledged_at: string | null }>)[1]?.parent_acknowledged_at,
    );
    assert.equal(
      (
        await api('POST', '/medication-administrations', token('nurse'), {
          request_id: requestA,
          scheduled_time: '11:00',
          scheduled_date: addDays(vietnamToday, -1),
        })
      ).status,
      422,
      'yêu cầu đã hoàn thành',
    );
  });

  it('CT-171: đơn vị bật không có nhân viên y tế, giáo viên chủ nhiệm nhận thuốc và ghi liều; y tế cấp trên vẫn xem', async () => {
    const saved = await api('PUT', '/settings', principal.accessToken, {
      org_unit_id: units['ĐT-B1'],
      values: { no_medical_staff: true },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const photo = await upload(token('parentB'), units['ĐT-B1'] ?? '', 'medicine_photo');
    assert.equal(photo.status, 201);
    const created = await api(
      'POST',
      '/medication-requests',
      token('parentB'),
      requestBody(children.B ?? '', {
        medicine_photo_ids: [photo.body.id],
        times: ['10:00'],
        to_date: addDays(vietnamToday, 2),
      }),
    );
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.assigned_role, 'homeroom');
    const requestId = created.body.id as string;
    const notified = await schoolYear
      .selectFrom('notifications')
      .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
      .select(['notification_recipients.user_id', 'notification_recipients.role_code', 'notifications.body'])
      .where('notifications.target_id', '=', requestId)
      .execute();
    // CT-1666, QT-07 bước 3: báo cả y tế và giáo viên chủ nhiệm, ghi rõ người nhận thuốc
    assert.deepEqual(
      notified.map((row) => row.user_id ?? row.role_code).sort(),
      [users.homeroomB?.userId, 'VT-09'].sort(),
    );
    assert.ok(notified[0]?.body.includes('Người nhận thuốc: giáo viên chủ nhiệm'));

    const schedule = await api('GET', '/medication-schedules', token('homeroomB'));
    assert.equal(schedule.status, 200);
    assert.equal((schedule.body as unknown as unknown[]).length, 0, 'chưa nhận thuốc thì chưa vào danh sách cho uống');
    const received = await api('POST', `/medication-requests/${requestId}/receive`, token('homeroomB'), {});
    assert.equal(received.status, 200, JSON.stringify(received.body));
    const today = await api('GET', `/medication-schedules?date=${vietnamToday}`, token('homeroomB'));
    const rows = today.body as unknown as Array<{
      request_id: string;
      can_administer: boolean;
      administration: unknown;
    }>;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.can_administer, true);
    const dose = await api('POST', '/medication-administrations', token('homeroomB'), {
      request_id: requestId,
      scheduled_time: '10:00',
    });
    assert.equal(dose.status, 201, JSON.stringify(dose.body));

    const rootView = await api('GET', '/medication-requests', token('rootNurse'));
    assert.ok((rootView.body as unknown as Array<{ id: string }>).some((row) => row.id === requestId));
    const unitNurseView = await api('GET', '/medication-requests', token('nurse'));
    assert.ok(!(unitNurseView.body as unknown as Array<{ id: string }>).some((row) => row.id === requestId));
    const parentView = await api('GET', '/medication-requests', token('parentB'));
    assert.deepEqual(
      (parentView.body as unknown as Array<{ id: string }>).map((row) => row.id),
      [requestId],
    );

    // Tắt lại cấu hình thì giáo viên chủ nhiệm không ghi liều được nữa (BR-86)
    await api('PUT', '/settings', principal.accessToken, {
      org_unit_id: units['ĐT-B1'],
      values: { no_medical_staff: null },
    });
    const blocked = await api('POST', '/medication-administrations', token('homeroomB'), {
      request_id: requestId,
      scheduled_time: '10:00',
      scheduled_date: addDays(vietnamToday, -1),
    });
    assert.equal(blocked.status, 403, JSON.stringify(blocked.body));
  });

  it('CT-1660 đến CT-1666: trạng thái Đã nhận thuốc, vai trò, từ chối gửi tin nhắn, tự hoàn thành khi hết thời gian dùng (QT-07, YCTD-344)', async () => {
    const submit = async (overrides: Record<string, unknown> = {}) => {
      const response = await api(
        'POST',
        '/medication-requests',
        token('parentA'),
        requestBody(children.A ?? '', { medicine_photo_ids: [photoA], times: ['09:00'], ...overrides }),
      );
      assert.equal(response.status, 201, JSON.stringify(response.body));
      return response.body.id as string;
    };
    const statusOf = async (requestId: string) =>
      (await api('GET', `/medication-requests/${requestId}`, token('nurse'))).body.status;

    // CT-1660: phụ huynh, giáo viên không phải người nhận thuốc, y tế đơn vị khác không xác nhận nhận thuốc được
    const requestId = await submit({ to_date: addDays(vietnamToday, 1) });
    for (const name of ['parentA', 'parentB', 'homeroomA', 'accountant']) {
      const response = await api('POST', `/medication-requests/${requestId}/receive`, token(name), {});
      assert.equal(response.status, 403, `${name}: ${JSON.stringify(response.body)}`);
    }
    // CT-1661: phiếu chưa nhận thì không hoàn thành, không ghi liều; lịch cho uống chưa có phiếu này
    assert.equal((await api('POST', `/medication-requests/${requestId}/complete`, token('nurse'))).status, 422);
    const pendingSchedule = await api('GET', `/medication-schedules?date=${vietnamToday}`, token('nurse'));
    assert.ok(
      !(pendingSchedule.body as unknown as Array<{ request_id: string }>).some((row) => row.request_id === requestId),
    );
    // CT-1662: y tế nhận thuốc → Đã nhận thuốc, vào lịch cho uống; phụ huynh thấy trạng thái, phụ huynh khác bị chặn
    const received = await api('POST', `/medication-requests/${requestId}/receive`, token('nurse'), {
      received_quantity: '1 vỉ 10 viên',
    });
    assert.equal(received.status, 200, JSON.stringify(received.body));
    assert.equal(received.body.status, 'received');
    const listedReceived = await api('GET', '/medication-requests?status=received', token('parentA'));
    assert.equal(listedReceived.status, 200, JSON.stringify(listedReceived.body));
    assert.ok((listedReceived.body as unknown as Array<{ id: string }>).some((row) => row.id === requestId));
    assert.equal((await api('GET', `/medication-requests/${requestId}`, token('parentB'))).status, 403);
    const receivedSchedule = await api('GET', `/medication-schedules?date=${vietnamToday}`, token('nurse'));
    const row = (receivedSchedule.body as unknown as Array<{ request_id: string; can_administer: boolean }>).find(
      (item) => item.request_id === requestId,
    );
    assert.equal(row?.can_administer, true);
    for (const name of ['parentA', 'homeroomA']) {
      const response = await api('POST', '/medication-administrations', token(name), {
        request_id: requestId,
        scheduled_time: '09:00',
      });
      assert.equal(response.status, 403, `${name} không ghi liều được: ${JSON.stringify(response.body)}`);
    }
    // CT-1663: kết thúc sớm được từ Đã nhận thuốc; sau đó không ghi liều
    const completed = await api('POST', `/medication-requests/${requestId}/complete`, token('nurse'));
    assert.equal(completed.status, 200, JSON.stringify(completed.body));
    assert.equal(completed.body.status, 'completed');
    const late = await api('POST', '/medication-administrations', token('nurse'), {
      request_id: requestId,
      scheduled_time: '09:00',
    });
    assert.equal(late.status, 422, JSON.stringify(late.body));

    // CT-1664: từ chối nhận thuốc báo phụ huynh trong ứng dụng và tin nhắn kèm lý do
    const rejectedId = await submit({ from_date: addDays(vietnamToday, 1), to_date: addDays(vietnamToday, 1) });
    assert.equal(
      (await api('POST', `/medication-requests/${rejectedId}/reject`, token('nurse'), {})).status,
      400,
      'từ chối phải có lý do',
    );
    const rejected = await api('POST', `/medication-requests/${rejectedId}/reject`, token('nurse'), {
      reason: 'Thuốc không có nhãn',
    });
    assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
    const rejectNotice = await schoolYear
      .selectFrom('notifications')
      .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
      .select(['notifications.body', 'notification_recipients.user_id', 'notification_recipients.channel'])
      .where('notifications.template_code', '=', 'medication_rejected')
      .where('notifications.target_id', '=', rejectedId)
      .execute();
    assert.deepEqual(rejectNotice.map((item) => item.channel).sort(), ['in_app', 'sms']);
    assert.ok(rejectNotice.every((item) => item.user_id === users.parentA?.userId));
    assert.ok(rejectNotice[0]?.body.includes('Thuốc không có nhãn'));
    assert.equal(
      (await api('POST', `/medication-requests/${rejectedId}/receive`, token('nurse'), {})).status,
      422,
      'đã từ chối thì không nhận lại',
    );

    // CT-1665: hết thời gian dùng thuốc thì hệ thống chuyển phiếu đã nhận, đang cho uống sang hoàn thành; phiếu chờ nhận giữ nguyên
    const expired: Record<string, string> = {};
    for (const status of ['received', 'administering', 'pending'] as const) {
      expired[status] = (
        await schoolYear
          .insertInto('medication_requests')
          .values({
            child_id: children.A ?? '',
            org_unit_id: units['ĐT-A1'] ?? '',
            class_id: classes['MAM-1'] ?? null,
            requested_by: users.parentA?.userId ?? '',
            medicine_name: `Thuốc cũ ${status}`,
            dosage: '1 gói',
            times: ['08:00'],
            from_date: addDays(vietnamToday, -5),
            to_date: addDays(vietnamToday, -2),
            allergy_note: 'Không',
            medicine_photo_ids: [photoA],
            assigned_role: 'nurse',
            status,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    const listed = await api('GET', `/medication-requests?child_id=${children.A}`, token('nurse'));
    assert.equal(listed.status, 200);
    const statuses = new Map(
      (listed.body as unknown as Array<{ id: string; status: string }>).map((item) => [item.id, item.status]),
    );
    assert.equal(statuses.get(expired.received ?? ''), 'completed');
    assert.equal(statuses.get(expired.administering ?? ''), 'completed');
    assert.equal(statuses.get(expired.pending ?? ''), 'pending');
    assert.equal(await statusOf(expired.pending ?? ''), 'pending');

    // CT-1666: lọc trạng thái lạ bị từ chối
    assert.equal((await api('GET', '/medication-requests?status=waiting', token('nurse'))).status, 400);
  });

  it('P10-02, P10-05, BR-63, CT-116: danh mục thuốc, đề nghị mua duyệt theo hạn mức, ghi thuốc đã mua mười hộp tăng tồn mười', async () => {
    const unitA = units['ĐT-A1'] ?? '';
    const pharmacy = await api('POST', '/pharmacies', token('nurse'), {
      org_unit_id: unitA,
      name: 'Nhà thuốc Long Châu',
    });
    assert.equal(pharmacy.status, 201, JSON.stringify(pharmacy.body));
    const medicine = await api('POST', '/medicines', token('nurse'), {
      org_unit_id: unitA,
      code: 'PARA',
      name: 'Paracetamol 250 mg',
      active_ingredient: 'Paracetamol',
      unit: 'hộp',
      pharmacy_id: pharmacy.body.id,
      stock_qty: 5,
    });
    assert.equal(medicine.status, 201, JSON.stringify(medicine.body));
    const medicineId = medicine.body.id as string;
    assert.equal(
      (
        await api('POST', '/medicines', token('nurse'), {
          org_unit_id: unitA,
          code: 'PARA',
          name: 'Trùng',
          unit: 'hộp',
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await api('POST', '/medicines', token('nurse'), {
          org_unit_id: units['ĐT-B1'],
          code: 'X',
          name: 'X',
          unit: 'hộp',
        })
      ).status,
      403,
    );
    assert.equal((await api('PATCH', `/medicines/${medicineId}`, token('nurse'), { stock_qty: 100 })).status, 400);

    const request = await api('POST', '/medicine-purchase-requests', token('nurse'), {
      medicine_id: medicineId,
      quantity: 10,
      estimated_unit_price: 20_000,
      reason: 'Hết thuốc hạ sốt',
    });
    assert.equal(request.status, 201, JSON.stringify(request.body));
    assert.equal(request.body.requires_principal, true, 'chưa đặt hạn mức thì Hiệu trưởng duyệt');
    const requestId = request.body.id as string;
    const early = await api('POST', '/medicine-purchase-orders', token('nurse'), {
      request_id: requestId,
      pharmacy_id: pharmacy.body.id,
      items: [{ medicine_id: medicineId, quantity: 10, unit_price: 19_500 }],
    });
    assert.equal(early.status, 422, 'chưa duyệt thì chưa lập phiếu mua');
    assert.equal((await api('POST', `/medicine-purchase-requests/${requestId}/approve`, token('vice'))).status, 403);
    const approved = await api('POST', `/medicine-purchase-requests/${requestId}/approve`, principal.accessToken);
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.status, 'approved');

    const order = await api('POST', '/medicine-purchase-orders', token('nurse'), {
      request_id: requestId,
      pharmacy_id: pharmacy.body.id,
      items: [{ medicine_id: medicineId, quantity: 10, unit_price: 19_500 }],
    });
    assert.equal(order.status, 201, JSON.stringify(order.body));
    assert.match(order.body.code as string, /^MT-\d{6}$/);
    assert.equal(order.body.total_amount, 195_000);
    const stock = await schoolYear
      .selectFrom('medicines')
      .select('stock_qty')
      .where('id', '=', medicineId)
      .executeTakeFirstOrThrow();
    assert.equal(stock.stock_qty, 15);
    const again = await api('POST', '/medicine-purchase-orders', token('nurse'), {
      request_id: requestId,
      pharmacy_id: pharmacy.body.id,
      items: [{ medicine_id: medicineId, quantity: 10, unit_price: 19_500 }],
    });
    assert.equal(again.status, 422, 'một đề nghị một phiếu mua');
    const orders = await api('GET', '/medicine-purchase-orders', token('accountant'));
    assert.equal(orders.status, 200);
    assert.equal((orders.body as unknown as unknown[]).length, 1, 'kế toán xem phiếu mua để lập phiếu chi');

    const threshold = await api('PUT', '/approval-thresholds', principal.accessToken, {
      org_unit_id: unitA,
      document_type: 'purchase_request',
      threshold_amount: 1_000_000,
    });
    assert.equal(threshold.status, 200, JSON.stringify(threshold.body));
    const small = await api('POST', '/medicine-purchase-requests', token('nurse'), {
      medicine_id: medicineId,
      quantity: 5,
      estimated_unit_price: 20_000,
      reason: 'Dự phòng',
    });
    assert.equal(small.body.requires_principal, false);
    const viceApproved = await api('POST', `/medicine-purchase-requests/${small.body.id}/approve`, token('vice'));
    assert.equal(viceApproved.status, 200, JSON.stringify(viceApproved.body));
    const large = await api('POST', '/medicine-purchase-requests', token('nurse'), {
      medicine_id: medicineId,
      quantity: 50,
      estimated_unit_price: 20_000,
      reason: 'Mua cả năm',
    });
    assert.equal(large.body.requires_principal, true, 'từ hạn mức trở lên thì Hiệu trưởng duyệt');
    assert.equal(
      (await api('POST', `/medicine-purchase-requests/${large.body.id}/reject`, token('vice'), { reason: 'x' })).status,
      403,
    );
    assert.equal(
      (await api('POST', `/medicine-purchase-requests/${large.body.id}/reject`, principal.accessToken, {})).status,
      400,
    );
    const rejected = await api('POST', `/medicine-purchase-requests/${large.body.id}/reject`, principal.accessToken, {
      reason: 'Mua theo quý',
    });
    assert.equal(rejected.body.status, 'rejected');
  });

  it('P10-05: cấp thuốc trừ tồn, không cho cấp quá tồn', async () => {
    const medicine = await schoolYear
      .selectFrom('medicines')
      .select(['id', 'stock_qty'])
      .where('code', '=', 'PARA')
      .executeTakeFirstOrThrow();
    const tooMany = await api('POST', '/medicine-issues', token('nurse'), {
      medicine_id: medicine.id,
      quantity: medicine.stock_qty + 1,
      recipient: 'Lớp MAM-1',
      reason: 'Tủ thuốc lớp',
    });
    assert.equal(tooMany.status, 422, JSON.stringify(tooMany.body));
    const issued = await api('POST', '/medicine-issues', token('nurse'), {
      medicine_id: medicine.id,
      quantity: 3,
      recipient: 'Lớp MAM-1',
      reason: 'Tủ thuốc lớp',
    });
    assert.equal(issued.status, 201, JSON.stringify(issued.body));
    assert.equal(issued.body.stock_qty, medicine.stock_qty - 3);
    assert.match(issued.body.code as string, /^CTH-\d{6}$/);
    assert.equal(
      (
        await api('POST', '/medicine-issues', token('homeroomA'), {
          medicine_id: medicine.id,
          quantity: 1,
          recipient: 'a',
          reason: 'b',
        })
      ).status,
      403,
    );
  });
});
