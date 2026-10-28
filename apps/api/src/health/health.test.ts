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

// Y tế học đường phần hồ sơ, khám, sự kiện, chăm sóc, báo cáo (DT-10 phần 10a, YCTD-74); kịch bản CT-057, CT-058,
// CT-117, CT-118, CT-162, CT-174, CT-175
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

describe('Y tế học đường: hồ sơ, khám, sự kiện, chăm sóc', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let academicYearId = '';
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  let campaignId = '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);

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
    users.nurse = await environment.loginAs('VT-09', unitA);
    users.otherNurse = await environment.loginAs('VT-09', units['ĐT-B1'] ?? null);
    users.homeroom = await environment.loginAs('VT-07', unitA);
    users.otherTeacher = await environment.loginAs('VT-07', unitA);
    users.subjectTeacher = await environment.loginAs('VT-08', unitA);
    users.chiefAccountant = await environment.loginAs('VT-05', unitA);
    users.hr = await environment.loginAs('VT-06', unitA);
    users.accountant = await environment.loginAs('VT-04', unitA);
    users.parentA = await environment.loginAs('VT-14', unitA);
    users.parentB = await environment.loginAs('VT-14', unitA);

    for (const [code, unit] of [
      ['MAM-1', 'ĐT-A1'],
      ['MAM-2', 'ĐT-A1'],
      ['MAM-B', 'ĐT-B1'],
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
    for (const [teacher, classCode, role] of [
      ['homeroom', 'MAM-1', 'homeroom'],
      ['otherTeacher', 'MAM-2', 'homeroom'],
      ['subjectTeacher', 'MAM-1', 'subject'],
    ] as const) {
      await schoolYear
        .insertInto('class_staff_assignments')
        .values({
          class_id: classes[classCode] ?? '',
          staff_user_id: users[teacher]?.userId ?? '',
          staff_name: teacher,
          assignment_role: role,
          subject_name: role === 'subject' ? 'Âm nhạc' : null,
          from_date: addDays(vietnamToday, -60),
        })
        .execute();
    }
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [key, parent, gender, dob] of [
      ['A', 'parentA', 'female', addDays(vietnamToday, -3 * 365)],
      ['B', 'parentB', 'male', addDays(vietnamToday, -3 * 365)],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitA,
          full_name: `Trẻ ${key}`,
          dob,
          gender,
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
        .values({ child_id: child.id, class_id: classes['MAM-1'] ?? '', from_date: addDays(vietnamToday, -60) })
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
      await schoolYear
        .insertInto('health_profiles')
        .values({ child_id: child.id, has_allergies: true, allergies: 'Tôm' })
        .execute();
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('P10-11: y tế lập tiêu chuẩn theo giới tính và tháng tuổi; khoảng trùng bị từ chối; giáo viên không lập được', async () => {
    const standard = (body: Record<string, unknown>, accessToken = token('nurse')) =>
      api('POST', '/health-standards', accessToken, {
        indicator_code: 'weight_kg',
        gender: 'female',
        age_month_from: 24,
        age_month_to: 47,
        lower_value: 11,
        upper_value: 18,
        source_document: 'Tiêu chuẩn của Bộ Y tế',
        ...body,
      });
    const created = await standard({});
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal((await standard({ age_month_from: 40, age_month_to: 60 })).status, 422);
    assert.equal((await standard({ gender: 'male' })).status, 201);
    assert.equal((await standard({ indicator_code: 'height_cm', lower_value: 85, upper_value: 105 })).status, 201);
    assert.equal((await standard({ gender: 'male', indicator_code: 'bmi' }, token('homeroom'))).status, 403);
    assert.equal((await standard({ upper_value: 5 })).status, 400);
    const listed = await api('GET', '/health-standards', token('nurse'));
    assert.equal((listed.body as unknown as unknown[]).length, 3);
  });

  it('P10-01, CT-118: y tế ghi chỉ số theo lần đo; cân nặng dưới ngưỡng được đánh dấu', async () => {
    const created = await api('POST', `/children/${children.A}/health-measurements`, token('nurse'), {
      measured_on: vietnamToday,
      height_cm: 95,
      weight_kg: 10.2,
      vision_left: '10/10',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const listed = await api('GET', `/children/${children.A}/health-measurements`, token('homeroom'));
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    const rows = listed.body as unknown as Array<{ weight_kg: number; evaluation: Record<string, string> }>;
    assert.equal(rows[0]?.weight_kg, 10.2);
    assert.deepEqual(rows[0]?.evaluation, { weight_kg: 'below', height_cm: 'normal' });

    const future = await api('POST', `/children/${children.A}/health-measurements`, token('nurse'), {
      measured_on: addDays(vietnamToday, 1),
      weight_kg: 12,
    });
    assert.equal(future.status, 400);
    const byTeacher = await api('POST', `/children/${children.A}/health-measurements`, token('homeroom'), {
      measured_on: vietnamToday,
      weight_kg: 12,
    });
    assert.equal(byTeacher.status, 403);
    const otherUnit = await api('POST', `/children/${children.A}/health-measurements`, token('otherNurse'), {
      measured_on: vietnamToday,
      weight_kg: 12,
    });
    assert.equal(otherUnit.status, 403);
  });

  it('CT-057, CT-162: giáo viên lớp khác, giáo viên bộ môn, kế toán trưởng, nhân sự không xem được sức khỏe; kế toán, phụ huynh của trẻ xem được', async () => {
    for (const name of ['otherTeacher', 'subjectTeacher', 'chiefAccountant', 'hr', 'parentB']) {
      const response = await api('GET', `/children/${children.A}/health-measurements`, token(name));
      assert.equal(response.status, 403, `${name}: ${JSON.stringify(response.body)}`);
      assert.equal((await api('GET', `/children/${children.A}/health`, token(name))).status, 403, name);
    }
    for (const name of ['accountant', 'parentA', 'homeroom', 'nurse']) {
      assert.equal((await api('GET', `/children/${children.A}/health`, token(name))).status, 200, name);
    }
  });

  it('P10-06, P10-10, CT-117: lập đợt khám, lịch khám của lớp báo phụ huynh; kết quả công bố thì phụ huynh mới thấy', async () => {
    const campaign = await api('POST', '/health-check-campaigns', token('nurse'), {
      org_unit_id: units['ĐT-A1'],
      name: 'Khám đầu năm',
      from_date: vietnamToday,
      to_date: addDays(vietnamToday, 14),
    });
    assert.equal(campaign.status, 201, JSON.stringify(campaign.body));
    campaignId = campaign.body.id as string;
    const otherUnitCampaign = await api('POST', '/health-check-campaigns', token('nurse'), {
      org_unit_id: units['ĐT-B1'],
      name: 'Khám',
      from_date: vietnamToday,
      to_date: vietnamToday,
    });
    assert.equal(otherUnitCampaign.status, 403);

    const outsideClass = await api('POST', '/health-check-schedules', token('nurse'), {
      campaign_id: campaignId,
      class_id: classes['MAM-B'],
      check_date: vietnamToday,
      location: 'Phòng y tế',
    });
    assert.equal(outsideClass.status, 400);
    const lateDate = await api('POST', '/health-check-schedules', token('nurse'), {
      campaign_id: campaignId,
      class_id: classes['MAM-1'],
      check_date: addDays(vietnamToday, 30),
      location: 'Phòng y tế',
    });
    assert.equal(lateDate.status, 400);
    const schedule = await api('POST', '/health-check-schedules', token('nurse'), {
      campaign_id: campaignId,
      class_id: classes['MAM-1'],
      check_date: addDays(vietnamToday, 2),
      location: 'Phòng y tế',
    });
    assert.equal(schedule.status, 201, JSON.stringify(schedule.body));
    assert.equal(schedule.body.notified_count, 2);
    const unread = await api('GET', '/notifications?unread_only=true', token('parentA'));
    assert.ok(JSON.stringify(unread.body).includes('Lịch khám sức khỏe'));
    const duplicate = await api('POST', '/health-check-schedules', token('nurse'), {
      campaign_id: campaignId,
      class_id: classes['MAM-1'],
      check_date: addDays(vietnamToday, 3),
      location: 'Phòng y tế',
    });
    assert.equal(duplicate.status, 409);

    const saved = await api('PUT', `/health-check-campaigns/${campaignId}/results`, token('nurse'), {
      child_id: children.A,
      height_cm: 96,
      weight_kg: 10.5,
      result_data: { 'Răng miệng': 'Sâu răng nhẹ' },
      conclusion: 'Cần theo dõi cân nặng',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const results = await api('GET', `/health-check-campaigns/${campaignId}/results`, token('nurse'));
    const rows = results.body as unknown as Array<{
      child_id: string;
      result_id: string | null;
      evaluation: Record<string, string>;
    }>;
    assert.equal(rows.length, 2);
    assert.equal(rows.find((row) => row.child_id === children.A)?.evaluation.weight_kg, 'below');
    assert.equal(rows.find((row) => row.child_id === children.B)?.result_id, null);

    const before = await api('GET', `/children/${children.A}/health`, token('parentA'));
    assert.equal((before.body.check_results as unknown[]).length, 0);
    const published = await api('POST', `/health-check-campaigns/${campaignId}/publish-results`, token('nurse'));
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal(published.body.published_count, 1);
    const afterPublish = await api('GET', `/children/${children.A}/health`, token('parentA'));
    const checkResults = afterPublish.body.check_results as Array<{
      conclusion: string;
      evaluation: Record<string, string>;
    }>;
    assert.equal(checkResults[0]?.conclusion, 'Cần theo dõi cân nặng');
    assert.equal(checkResults[0]?.evaluation.weight_kg, 'below');
    assert.equal(
      errorOf((await api('POST', `/health-check-campaigns/${campaignId}/publish-results`, token('nurse'))).body)
        .rule_code,
      'P10-06',
    );

    const closed = await api('POST', `/health-check-campaigns/${campaignId}/close`, token('nurse'));
    assert.equal(closed.status, 200);
    const afterClose = await api('PUT', `/health-check-campaigns/${campaignId}/results`, token('nurse'), {
      child_id: children.B,
      weight_kg: 14,
    });
    assert.equal(afterClose.status, 422);
  });

  it('CT-058, CT-175: giáo viên chủ nhiệm ghi sự kiện y tế, phụ huynh nhận thông báo; phụ huynh xác nhận đã biết một lần', async () => {
    const event = await api('POST', '/medical-events', token('homeroom'), {
      child_id: children.A,
      occurred_at: new Date(Date.now() - 60_000).toISOString(),
      symptoms: 'Sốt 38,5 độ',
      handling: 'Chườm mát, báo y tế',
      severity: 'severe',
    });
    assert.equal(event.status, 201, JSON.stringify(event.body));
    assert.ok(typeof event.body.handler_name === 'string' && event.body.handler_name.length > 0);
    assert.ok(event.body.notified_guardians_at);
    const recipients = await schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select(['notification_recipients.user_id', 'notification_recipients.channel'])
      .where('notifications.target_id', '=', event.body.id as string)
      .where('notifications.template_code', '=', 'medical_event')
      .execute();
    assert.deepEqual(recipients.map((row) => row.channel).sort(), ['in_app', 'sms']);
    assert.ok(recipients.every((row) => row.user_id === users.parentA?.userId));

    const otherClass = await api('POST', '/medical-events', token('otherTeacher'), {
      child_id: children.A,
      occurred_at: new Date().toISOString(),
      symptoms: 'Ho',
      handling: 'Cho uống nước',
      severity: 'mild',
    });
    assert.equal(otherClass.status, 403);

    const eventId = event.body.id as string;
    assert.equal((await api('POST', `/medical-events/${eventId}/acknowledge`, token('parentB'))).status, 403);
    const acknowledged = await api('POST', `/medical-events/${eventId}/acknowledge`, token('parentA'));
    assert.equal(acknowledged.status, 200, JSON.stringify(acknowledged.body));
    const again = await api('POST', `/medical-events/${eventId}/acknowledge`, token('parentA'));
    assert.equal(again.body.parent_acknowledged_at, acknowledged.body.parent_acknowledged_at);

    const listed = await api('GET', `/medical-events?org_unit_id=${units['ĐT-A1']}`, token('nurse'));
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    const rows = listed.body as unknown as Array<{ id: string; parent_acknowledged_at: string | null }>;
    assert.ok(rows.find((row) => row.id === eventId)?.parent_acknowledged_at);
    const reminders = await schoolYear
      .selectFrom('notifications')
      .select('id')
      .where('target_id', '=', eventId)
      .where('template_code', '=', 'medical_event')
      .execute();
    assert.equal(reminders.length, 1);
  });

  it('CT-1667: sự kiện y tế báo quản lý đơn vị; sự kiện nặng leo thang Ban Giám hiệu (QT-07 bước 8, YCTD-344)', async () => {
    const managementOf = async (eventId: string) =>
      (
        await schoolYear
          .selectFrom('notification_recipients')
          .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
          .select([
            'notifications.template_code',
            'notification_recipients.role_code',
            'notification_recipients.org_unit_id',
            'notification_recipients.channel',
          ])
          .where('notifications.target_id', '=', eventId)
          .where('notification_recipients.role_code', 'is not', null)
          .execute()
      ).sort((left, right) => (left.role_code ?? '').localeCompare(right.role_code ?? ''));
    const mild = await api('POST', '/medical-events', token('homeroom'), {
      child_id: children.B,
      occurred_at: new Date(Date.now() - 60_000).toISOString(),
      symptoms: 'Trầy gối',
      handling: 'Sát khuẩn, dán băng',
      severity: 'mild',
    });
    assert.equal(mild.status, 201, JSON.stringify(mild.body));
    assert.deepEqual(await managementOf(mild.body.id as string), [
      { template_code: 'medical_event_manager', role_code: 'VT-03', org_unit_id: units['ĐT-A1'], channel: 'in_app' },
    ]);
    const severe = await api('POST', '/medical-events', token('nurse'), {
      child_id: children.B,
      occurred_at: new Date(Date.now() - 60_000).toISOString(),
      symptoms: 'Khó thở',
      handling: 'Sơ cứu, gọi cấp cứu 115',
      severity: 'severe',
    });
    assert.equal(severe.status, 201, JSON.stringify(severe.body));
    const escalated = await managementOf(severe.body.id as string);
    assert.deepEqual(
      escalated.map((row) => `${row.template_code}:${row.role_code}:${row.channel}`),
      ['medical_event_severe:VT-02:in_app', 'medical_event_severe:VT-03:in_app', 'medical_event_severe:VT-15:in_app'],
    );
    assert.ok(escalated.every((row) => row.org_unit_id === units['ĐT-A1']));
  });

  it('P10-12, CT-174: giáo viên chủ nhiệm ghi nhiệt độ trẻ A; phụ huynh trẻ A thấy, phụ huynh trẻ B không thấy', async () => {
    const care = await api('POST', '/daily-care-logs', token('homeroom'), {
      child_id: children.A,
      temperature: 37.8,
      condition_note: 'Hơi mệt',
      special_care_note: 'Không ăn tôm theo lưu ý của mẹ',
    });
    assert.equal(care.status, 201, JSON.stringify(care.body));
    assert.equal(care.body.temperature, 37.8);
    const badTemperature = await api('POST', '/daily-care-logs', token('homeroom'), {
      child_id: children.A,
      temperature: 45,
    });
    assert.equal(badTemperature.status, 400);
    const bySubject = await api('POST', '/daily-care-logs', token('subjectTeacher'), {
      child_id: children.A,
      temperature: 37,
    });
    assert.equal(bySubject.status, 403);
    const parentView = await api('GET', `/children/${children.A}/health`, token('parentA'));
    const daily = parentView.body.daily_care as Array<{ temperature: number; special_care_note: string }>;
    assert.equal(daily[0]?.temperature, 37.8);
    assert.equal((await api('GET', `/children/${children.A}/daily-care-logs`, token('parentB'))).status, 403);
    const ownChild = await api('GET', `/children/${children.B}/health`, token('parentB'));
    assert.equal((ownChild.body.daily_care as unknown[]).length, 0);
  });

  it('P10-08: phụ huynh yêu cầu báo cáo sức khỏe; y tế tổng hợp và gửi; phụ huynh thấy báo cáo', async () => {
    const requested = await api('POST', '/health-report-requests', token('parentA'), {
      child_id: children.A,
      report_type: 'full',
      period_from: addDays(vietnamToday, -30),
      period_to: vietnamToday,
      note: 'Cần nộp cho bác sĩ',
    });
    assert.equal(requested.status, 201, JSON.stringify(requested.body));
    const duplicate = await api('POST', '/health-report-requests', token('parentA'), {
      child_id: children.A,
      report_type: 'growth',
      period_from: addDays(vietnamToday, -30),
      period_to: vietnamToday,
    });
    assert.equal(errorOf(duplicate.body).rule_code, 'P10-08');
    const forOther = await api('POST', '/health-report-requests', token('parentB'), {
      child_id: children.A,
      report_type: 'growth',
      period_from: addDays(vietnamToday, -30),
      period_to: vietnamToday,
    });
    assert.equal(forOther.status, 403);

    const pending = await api('GET', '/health-report-requests?status=pending', token('nurse'));
    assert.equal((pending.body as unknown as unknown[]).length, 1);
    assert.equal(
      (await api('POST', `/health-report-requests/${requested.body.id}/send`, token('otherNurse'))).status,
      403,
    );
    const sent = await api('POST', `/health-report-requests/${requested.body.id}/send`, token('nurse'), {
      response_note: 'Trẻ cần bổ sung dinh dưỡng',
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    assert.equal(
      errorOf((await api('POST', `/health-report-requests/${requested.body.id}/send`, token('nurse'))).body).rule_code,
      'P10-08',
    );

    const mine = await api('GET', '/health-report-requests', token('parentA'));
    const reports = mine.body as unknown as Array<{ status: string; report_data: Record<string, unknown[]> }>;
    assert.equal(reports.length, 1);
    assert.equal(reports[0]?.status, 'sent');
    assert.equal(reports[0]?.report_data.measurements?.length, 1);
    assert.equal(reports[0]?.report_data.check_results?.length, 1);
    assert.equal(reports[0]?.report_data.medical_events?.length, 1);
    assert.equal(reports[0]?.report_data.daily_care?.length, 1);
    assert.equal(
      ((await api('GET', '/health-report-requests', token('parentB'))).body as unknown as unknown[]).length,
      0,
    );
  });
});
