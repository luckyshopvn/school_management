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

// Ghi nhận vi phạm, khen từng học sinh, lát L2 (YCTD-391): phạm vi theo phân công trực, chủ nhiệm, dạy; ghi điểm lớp theo mục
// nội quy; ảnh bằng chứng; báo giáo viên chủ nhiệm; thu hồi; kịch bản CT-391-7 đến CT-391-11
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('Ghi nhận rèn luyện từng học sinh', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let unitId = '';
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  const rules: Record<string, string> = {};
  let zoneId = '';
  let criterionId = '';
  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  async function uploadEvidence(accessToken: string) {
    const form = new FormData();
    form.append('org_unit_id', unitId);
    form.append('purpose', 'conduct_evidence');
    form.append('file', new Blob([PNG], { type: 'image/png' }), 'anh.png');
    const response = await fetch(`${environment.baseUrl}/files`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
      first_term: { start_date: addDays(vietnamToday, -60), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    unitId = (
      await api('POST', '/org-units', principal.accessToken, {
        code: 'THCS',
        name: 'Trường trung học cơ sở',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'TH' || code === 'THCS',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal.accessToken, { levels })).status, 200);
    users.supervisor = await environment.loginAs('VT-22', unitId);
    users.homeroom = await environment.loginAs('VT-07', unitId);
    users.subject = await environment.loginAs('VT-08', unitId);
    for (const grade of [
      { code: 'K6', name: 'Khối 6', school_level: 'THCS' },
      { code: 'K7', name: 'Khối 7', school_level: 'THCS' },
    ]) {
      assert.equal((await api('POST', '/grade-levels', principal.accessToken, grade)).status, 201);
    }
    for (const [code, grade] of [
      ['6A', 'K6'],
      ['7A', 'K7'],
    ] as const) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: grade,
            school_level: 'THCS',
            max_size: 40,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    for (const [key, classCode] of [
      ['An', '6A'],
      ['Bình', '6A'],
      ['Cường', '7A'],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Học sinh ${key}`,
          dob: '2014-03-01',
          gender: 'male',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
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
    }
    await schoolYear
      .insertInto('class_staff_assignments')
      .values([
        {
          class_id: classes['6A'] ?? '',
          staff_user_id: users.homeroom?.userId ?? '',
          staff_name: 'Chủ nhiệm 6A',
          assignment_role: 'homeroom',
          from_date: addDays(vietnamToday, -60),
        },
        {
          class_id: classes['7A'] ?? '',
          staff_user_id: users.subject?.userId ?? '',
          staff_name: 'Bộ môn 7A',
          assignment_role: 'subject',
          subject_name: 'Toán',
          from_date: addDays(vietnamToday, -60),
        },
      ])
      .execute();
    const staffId = (
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: unitId,
          code: `NS-${randomInt(100_000, 999_999)}`,
          full_name: 'Giám thị Tuấn',
          start_date: addDays(vietnamToday, -200),
          user_id: users.supervisor?.userId ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    zoneId = (await api('POST', '/supervision/zones', principal.accessToken, { name: 'Sân trước' })).body.id as string;
    // Giám thị trực khối 6 cả tuần
    assert.equal(
      (
        await api('POST', '/supervision/assignments', principal.accessToken, {
          staff_id: staffId,
          school_level: 'THCS',
          grade_levels: ['K6'],
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          start_time: '00:00',
          end_time: '23:59',
        })
      ).status,
      201,
    );
    assert.equal((await api('PUT', '/conduct/settings', principal.accessToken, { enabled: true, base_points: 100 })).status, 200);
    criterionId = (
      await api('POST', '/conduct/criteria', principal.accessToken, {
        code: 'TP',
        name: 'Trang phục',
        kind: 'minus',
        points: 2,
        school_level: 'THCS',
      })
    ).body.id as string;
    for (const [key, body] of [
      ['uniform', { code: 'KHAN', name: 'Không đeo khăn quàng', kind: 'violation', class_criterion_id: criterionId }],
      ['help', { code: 'GIUP', name: 'Giúp đỡ bạn', kind: 'commendation' }],
    ] as const) {
      rules[key] = (
        await api('POST', '/supervision/rule-items', principal.accessToken, { ...body, school_level: 'THCS' })
      ).body.id as string;
    }
    rules.primary = (
      await api('POST', '/supervision/rule-items', principal.accessToken, {
        code: 'KHAN',
        name: 'Không đeo khăn quàng',
        kind: 'violation',
        school_level: 'TH',
      })
    ).body.id as string;
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  it('CT-391-7: phạm vi: giám thị trực khối 6 thấy lớp 6A; giáo viên bộ môn thấy lớp mình dạy; tìm học sinh theo tên', async () => {
    const scope = await api('GET', '/supervision/my-scope', token('supervisor'));
    assert.equal(scope.status, 200);
    assert.deepEqual(
      (scope.body.classes as Array<{ name: string }>).map((row) => row.name),
      ['6A'],
    );
    const subjectScope = await api('GET', '/supervision/my-scope', token('subject'));
    assert.deepEqual(
      (subjectScope.body.classes as Array<{ name: string }>).map((row) => row.name),
      ['7A'],
    );
    const found = (await api('GET', `/supervision/students?search=${encodeURIComponent('học sinh')}`, token('supervisor')))
      .body as unknown as Array<{ full_name: string }>;
    assert.deepEqual(
      found.map((row) => row.full_name),
      ['Học sinh An', 'Học sinh Bình'],
    );
    assert.equal((await api('GET', `/supervision/students?class_id=${classes['7A']}`, token('supervisor'))).status, 403);
    assert.equal((await api('GET', '/supervision/students?search=a', token('supervisor'))).status, 400);
  });

  it('CT-391-8: giám thị ghi vi phạm cho hai học sinh; mục gắn tiêu chí nề nếp ghi thêm điểm lớp; chủ nhiệm nhận tin', async () => {
    const created = await api('POST', '/supervision/records', token('supervisor'), {
      child_ids: [children.An, children['Bình']],
      rule_item_id: rules.uniform,
      zone_id: zoneId,
      description: 'Khi chào cờ',
    });
    assert.equal(created.status, 201);
    assert.equal((created.body.record_ids as string[]).length, 2);
    assert.equal(created.body.class_points_added, true);
    const entries = await schoolYear
      .selectFrom('conduct_entries')
      .select(['points', 'criterion_id'])
      .where('class_id', '=', classes['6A'] ?? '')
      .execute();
    assert.deepEqual(
      entries.map((row) => [row.points, row.criterion_id]),
      [
        [-2, criterionId],
        [-2, criterionId],
      ],
    );
    const notified = await schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select(['notification_recipients.user_id', 'notifications.title'])
      .where('notifications.template_code', '=', 'conduct_record_created')
      .execute();
    assert.equal(notified.length, 2);
    assert.ok(notified.every((row) => row.user_id === users.homeroom?.userId));
    const commendation = await api('POST', '/supervision/records', token('supervisor'), {
      child_ids: [children.An],
      rule_item_id: rules.help,
    });
    assert.equal(commendation.body.class_points_added, false);
  });

  it('CT-391-9: học sinh ngoài phạm vi, mục khác cấp, mục ngừng dùng bị từ chối; giáo viên bộ môn ghi được lớp mình dạy', async () => {
    const outside = await api('POST', '/supervision/records', token('supervisor'), {
      child_ids: [children['Cường']],
      rule_item_id: rules.help,
    });
    assert.equal(outside.status, 403);
    const wrongLevel = await api('POST', '/supervision/records', token('supervisor'), {
      child_ids: [children.An],
      rule_item_id: rules.primary,
    });
    assert.equal(wrongLevel.status, 422);
    assert.equal(errorOf(wrongLevel.body).rule_code, 'YCTD-391');
    const noChild = await api('POST', '/supervision/records', token('supervisor'), { child_ids: [], rule_item_id: rules.help });
    assert.equal(noChild.status, 400);
    const bySubject = await api('POST', '/supervision/records', token('subject'), {
      child_ids: [children['Cường']],
      rule_item_id: rules.help,
    });
    assert.equal(bySubject.status, 201);
    const list = (await api('GET', `/supervision/records?from=${vietnamToday}`, token('homeroom'))).body as unknown as Array<{
      full_name: string;
      recorded_by_name: string;
    }>;
    assert.ok(list.length >= 3);
    assert.ok(list.every((row) => row.full_name !== 'Học sinh Cường'));
    const mine = (await api('GET', `/supervision/records?from=${vietnamToday}&mine=true`, token('subject')))
      .body as unknown as Array<{ full_name: string }>;
    assert.deepEqual(
      mine.map((row) => row.full_name),
      ['Học sinh Cường'],
    );
  });

  it('CT-391-10: ảnh bằng chứng: chỉ ảnh, chủ nhiệm xem được, người ngoài phạm vi không xem được, không gắn lại', async () => {
    const uploaded = await uploadEvidence(token('supervisor'));
    assert.equal(uploaded.status, 201);
    const fileId = uploaded.body.id as string;
    const created = await api('POST', '/supervision/records', token('supervisor'), {
      child_ids: [children.An],
      rule_item_id: rules.help,
      evidence_file_ids: [fileId],
    });
    assert.equal(created.status, 201);
    const read = await fetch(`${environment.baseUrl}/files/${fileId}`, {
      headers: { authorization: `Bearer ${token('homeroom')}` },
    });
    assert.equal(read.status, 200);
    const outsider = await fetch(`${environment.baseUrl}/files/${fileId}`, {
      headers: { authorization: `Bearer ${token('subject')}` },
    });
    assert.equal(outsider.status, 403);
    const reused = await api('POST', '/supervision/records', token('supervisor'), {
      child_ids: [children['Bình']],
      rule_item_id: rules.help,
      evidence_file_ids: [fileId],
    });
    assert.equal(reused.status, 400);
    const otherOwner = await uploadEvidence(token('homeroom'));
    const notMine = await api('POST', '/supervision/records', token('supervisor'), {
      child_ids: [children['Bình']],
      rule_item_id: rules.help,
      evidence_file_ids: [otherOwner.body.id as string],
    });
    assert.equal(notMine.status, 400);
  });

  it('CT-391-11: thu hồi: người ghi trong ngày, chủ nhiệm được; người khác không; điểm lớp đi kèm bị xóa', async () => {
    const created = await api('POST', '/supervision/records', token('supervisor'), {
      child_ids: [children.An],
      rule_item_id: rules.uniform,
    });
    const recordId = (created.body.record_ids as string[])[0] ?? '';
    const record = await schoolYear
      .selectFrom('student_conduct_records')
      .select('class_conduct_entry_id')
      .where('id', '=', recordId)
      .executeTakeFirstOrThrow();
    assert.ok(record.class_conduct_entry_id);
    const noReason = await api('POST', `/supervision/records/${recordId}/revoke`, token('supervisor'), {});
    assert.equal(noReason.status, 400);
    const bySubject = await api('POST', `/supervision/records/${recordId}/revoke`, token('subject'), { reason: 'Nhầm' });
    assert.equal(bySubject.status, 403);
    const revoked = await api('POST', `/supervision/records/${recordId}/revoke`, token('supervisor'), {
      reason: 'Ghi nhầm học sinh',
    });
    assert.equal(revoked.status, 200);
    const entry = await schoolYear
      .selectFrom('conduct_entries')
      .select('id')
      .where('id', '=', record.class_conduct_entry_id ?? '')
      .executeTakeFirst();
    assert.equal(entry, undefined);
    const twice = await api('POST', `/supervision/records/${recordId}/revoke`, token('supervisor'), { reason: 'Lần hai' });
    assert.equal(twice.status, 422);
    const subjectRecord = (
      await api('GET', `/supervision/records?from=${vietnamToday}&mine=true`, token('subject'))
    ).body as unknown as Array<{ id: string }>;
    // Ghi nhận của giáo viên bộ môn ở lớp 7A: chủ nhiệm 6A không xem, không thu hồi được
    const notHomeroom = await api(
      'POST',
      `/supervision/records/${subjectRecord[0]?.id ?? ''}/revoke`,
      token('homeroom'),
      { reason: 'Không phải lớp mình' },
    );
    assert.equal(notHomeroom.status, 403);
    const byHomeroom = (
      await api('GET', `/supervision/records?from=${vietnamToday}&mine=true`, token('supervisor'))
    ).body as unknown as Array<{ id: string; status: string }>;
    const active = byHomeroom.find((row) => row.status === 'active');
    const homeroomRevoke = await api('POST', `/supervision/records/${active?.id ?? ''}/revoke`, token('homeroom'), {
      reason: 'Chủ nhiệm xem lại',
    });
    assert.equal(homeroomRevoke.status, 200);
  });
});
