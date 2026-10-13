import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { completionRate } from '../program-completion/program-completion.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { overallLevel } from './standard-rating.js';

// Hoàn thành chương trình giáo dục mầm non, nhóm trẻ, đánh giá chuẩn nghề nghiệp (DT-14 phần 14c, YCTD-102); kịch bản
// CT-14c-1 đến CT-14c-10
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };
const rated = (ratings: string) =>
  [...ratings].map((letter, index) => ({
    rating: ({ c: 'not_met', d: 'met', k: 'good', t: 'excellent' } as const)[letter as 'c' | 'd' | 'k' | 't'],
    isKey: index < 2,
  }));

describe('Quy tắc xếp loại chuẩn nghề nghiệp và tỷ lệ hoàn thành', () => {
  it('CT-14c-1: xếp loại chung theo mức từng tiêu chí, 2/3 số tiêu chí và tiêu chí trọng yếu', () => {
    assert.equal(overallLevel(rated('ttdttt')), 'good', 'có tiêu chí Đạt nên không xếp Tốt');
    assert.equal(overallLevel(rated('ttkttt')), 'excellent');
    assert.equal(overallLevel(rated('ttkktt')), 'excellent');
    assert.equal(overallLevel(rated('ttkkkt')), 'good', 'chưa đủ 2/3 tiêu chí Tốt');
    assert.equal(overallLevel(rated('ktttttt')), 'good', 'tiêu chí trọng yếu chưa Tốt');
    assert.equal(overallLevel(rated('kkkkdd')), 'good');
    assert.equal(overallLevel(rated('kkkddd')), 'met', 'chưa đủ 2/3 tiêu chí từ Khá');
    assert.equal(overallLevel(rated('dkkkkk')), 'met', 'tiêu chí trọng yếu chỉ Đạt');
    assert.equal(overallLevel(rated('ttttc')), 'not_met');
    assert.equal(overallLevel([]), 'not_met');
    assert.equal(completionRate(2, 3), 66.67);
    assert.equal(completionRate(0, 0), 0);
  });
});

describe('Hoàn thành chương trình, nhóm trẻ, chuẩn nghề nghiệp', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let academicYearId = '';
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  const staff: Record<string, string> = {};

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
    const unitB = units['ĐT-B1'] ?? '';
    users.manager = await environment.loginAs('VT-03', unitA);
    users.otherManager = await environment.loginAs('VT-03', unitB);
    users.vicePrincipal = await environment.loginAs('VT-15', unitA);
    users.teacher = await environment.loginAs('VT-07', unitA);
    users.otherTeacher = await environment.loginAs('VT-07', unitA);

    await schoolYear
      .insertInto('grade_levels')
      .values([
        { code: 'MAM', name: 'Mầm', age_from_months: 48, age_to_months: 59 },
        { code: 'LA', name: 'Lá', age_from_months: 60, age_to_months: 71 },
      ])
      .execute();
    for (const [code, unit, grade] of [
      ['LA-1', unitA, 'LA'],
      ['MAM-1', unitA, 'MAM'],
      ['LA-B', unitB, 'LA'],
    ] as const) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unit,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: grade,
            max_size: 30,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classes['LA-1'] ?? '',
        staff_user_id: users.teacher?.userId ?? '',
        staff_name: 'Cô chủ nhiệm',
        assignment_role: 'homeroom',
        from_date: addDays(vietnamToday, -60),
      })
      .execute();
    for (const [key, unit, classCode] of [
      ['an', unitA, 'LA-1'],
      ['binh', unitA, 'LA-1'],
      ['chi', unitA, 'LA-1'],
      ['dung', unitA, 'MAM-1'],
      ['em', unitB, 'LA-B'],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unit,
          full_name: `Trẻ ${key}`,
          dob: '2020-06-01',
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '1234',
          photo_consent: 'granted',
          status: 'active',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classes[classCode] ?? '', from_date: addDays(vietnamToday, -60) })
        .execute();
    }
    for (const [key, name, user, unit] of [
      ['teacher', 'Nguyễn Thị Chuẩn', 'teacher', unitA],
      ['otherTeacher', 'Trần Thị Nhóm', 'otherTeacher', unitA],
      ['manager', 'Lê Văn Quản', 'manager', unitA],
      ['unitB', 'Đỗ Thị Bình', null, unitB],
    ] as const) {
      staff[key] = (
        await schoolYear
          .insertInto('staff')
          .values({
            org_unit_id: unit,
            code: `NS-${randomInt(100_000, 999_999)}`,
            full_name: name,
            start_date: addDays(vietnamToday, -100),
            user_id: user ? (users[user]?.userId ?? null) : null,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-14c-2: giáo viên chủ nhiệm ghi kết quả lớp mẫu giáo 5-6 tuổi của mình; lớp khác, ngoài phạm vi bị chặn', async () => {
    const listed = await api('GET', '/program-completion/classes', token('teacher'));
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    assert.deepEqual(
      (listed.body as unknown as Array<{ code: string }>).map((row) => row.code),
      ['LA-1'],
      'giáo viên chỉ thấy lớp chủ nhiệm',
    );
    const managerList = (await api('GET', '/program-completion/classes', token('manager'))).body as unknown as Array<{
      code: string;
    }>;
    assert.deepEqual(
      managerList.map((row) => row.code),
      ['LA-1'],
      'lớp Mầm không thuộc diện, lớp đơn vị khác ngoài phạm vi',
    );
    const items = [
      { child_id: children.an, result: 'completed' },
      { child_id: children.binh, result: 'not_completed', note: 'Nghỉ dài ngày' },
    ];
    const recorded = await api('PUT', `/program-completion/classes/${classes['LA-1']}`, token('teacher'), { items });
    assert.equal(recorded.status, 200, JSON.stringify(recorded.body));
    assert.equal(recorded.body.completed_count, 1);
    assert.equal(recorded.body.unmarked_count, 1);
    assert.equal(
      (await api('PUT', `/program-completion/classes/${classes['LA-1']}`, token('otherTeacher'), { items })).status,
      403,
    );
    assert.equal(
      (await api('PUT', `/program-completion/classes/${classes['LA-1']}`, token('otherManager'), { items })).status,
      403,
    );
    const nursery = await api('PUT', `/program-completion/classes/${classes['MAM-1']}`, token('manager'), {
      items: [{ child_id: children.dung, result: 'completed' }],
    });
    assert.equal(nursery.status, 422);
    assert.equal(errorOf(nursery.body).rule_code, 'YCTD-102');
    const outsider = await api('PUT', `/program-completion/classes/${classes['LA-1']}`, token('manager'), {
      items: [{ child_id: children.dung, result: 'completed' }],
    });
    assert.equal(outsider.status, 400, 'trẻ không học lớp này');
    assert.equal(
      (
        await api('PUT', `/program-completion/classes/${classes['LA-1']}`, token('manager'), {
          items: [{ child_id: children.an, result: 'done' }],
        })
      ).status,
      400,
    );
  });

  it('CT-14c-3: Ban Giám hiệu xác nhận khi đủ kết quả thì khóa danh sách; hủy xác nhận phải có lý do', async () => {
    const path = `/program-completion/classes/${classes['LA-1']}`;
    const early = await api('POST', `${path}/confirm`, token('vicePrincipal'));
    assert.equal(early.status, 422, 'còn trẻ chưa ghi kết quả');
    assert.equal((await api('POST', `${path}/confirm`, token('manager'))).status, 403);
    await api('PUT', path, token('manager'), { items: [{ child_id: children.chi, result: 'completed' }] });
    const confirmed = await api('POST', `${path}/confirm`, token('vicePrincipal'));
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body.confirmed, true);
    const locked = await api('PUT', path, token('teacher'), {
      items: [{ child_id: children.an, result: 'not_completed' }],
    });
    assert.equal(locked.status, 422);
    assert.equal((await api('POST', `${path}/unconfirm`, principal.accessToken, {})).status, 400);
    const reopened = await api('POST', `${path}/unconfirm`, principal.accessToken, { reason: 'Sửa kết quả trẻ Bình' });
    assert.equal(reopened.status, 200);
    assert.equal(reopened.body.confirmed, false);
    assert.equal((await api('POST', `${path}/confirm`, principal.accessToken)).status, 200);
  });

  it('CT-14c-4: thống kê số trẻ hoàn thành, tỷ lệ theo đơn vị; xuất Excel ghi nhật ký xuất', async () => {
    const statistics = await api('GET', '/program-completion/statistics', principal.accessToken);
    assert.equal(statistics.status, 200);
    const total = statistics.body.total as { children_count: number; completed_count: number; completion_rate: number };
    assert.equal(total.children_count, 4, '3 trẻ lớp LA-1 và 1 trẻ lớp LA-B');
    assert.equal(total.completed_count, 2);
    assert.equal(total.completion_rate, 50);
    const unitA = (statistics.body.units as Array<{ org_unit_id: string; completion_rate: number }>).find(
      (row) => row.org_unit_id === units['ĐT-A1'],
    );
    assert.equal(unitA?.completion_rate, 66.67);
    const response = await fetch(`${environment.baseUrl}/program-completion/export?class_id=${classes['LA-1']}`, {
      headers: { authorization: `Bearer ${token('manager')}` },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /spreadsheetml/);
    const log = await schoolYear
      .selectFrom('export_logs')
      .select(['report_code', 'row_count', 'contains_personal_data'])
      .where('report_code', '=', 'program-completion')
      .executeTakeFirstOrThrow();
    assert.deepEqual(log, { report_code: 'program-completion', row_count: 3, contains_personal_data: true });
    const forbidden = await fetch(`${environment.baseUrl}/program-completion/export?class_id=${classes['LA-B']}`, {
      headers: { authorization: `Bearer ${token('manager')}` },
    });
    assert.equal(forbidden.status, 403);
  });

  it('CT-14c-5: quản lý đơn vị lập nhóm trẻ có giáo viên phụ trách, thêm trẻ của đơn vị; trẻ đơn vị khác bị chặn', async () => {
    const created = await api('POST', '/child-groups', token('manager'), {
      org_unit_id: units['ĐT-A1'],
      name: 'Năng khiếu vẽ',
      description: 'Học vẽ chiều thứ Năm',
      teacher_staff_id: staff.otherTeacher,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const groupId = created.body.id as string;
    assert.equal(created.body.teacher_name, 'Trần Thị Nhóm');
    assert.equal(
      (await api('POST', '/child-groups', token('manager'), { org_unit_id: units['ĐT-A1'], name: 'Năng khiếu vẽ' }))
        .status,
      409,
    );
    assert.equal(
      (await api('POST', '/child-groups', token('otherManager'), { org_unit_id: units['ĐT-A1'], name: 'Tiếng Anh' }))
        .status,
      403,
    );
    assert.equal(
      (await api('POST', '/child-groups', token('teacher'), { org_unit_id: units['ĐT-A1'], name: 'Tiếng Anh' })).status,
      403,
    );
    assert.equal(
      (
        await api('POST', '/child-groups', token('manager'), {
          org_unit_id: units['ĐT-A1'],
          name: 'Bơi',
          teacher_staff_id: staff.unitB,
        })
      ).status,
      400,
      'giáo viên phụ trách thuộc đơn vị khác',
    );
    const added = await api('POST', `/child-groups/${groupId}/members`, token('manager'), {
      child_ids: [children.an, children.dung],
    });
    assert.equal(added.status, 200, JSON.stringify(added.body));
    assert.equal(added.body.member_count, 2);
    assert.equal(
      (await api('POST', `/child-groups/${groupId}/members`, token('manager'), { child_ids: [children.em] })).status,
      400,
    );
    // Thêm lại không trùng, một trẻ thuộc nhiều nhóm
    assert.equal(
      (await api('POST', `/child-groups/${groupId}/members`, token('manager'), { child_ids: [children.an] })).body
        .member_count,
      2,
    );
    const second = await api('POST', '/child-groups', principal.accessToken, {
      org_unit_id: units['ĐT-A1'],
      name: 'Chăm sóc đặc biệt',
    });
    await api('POST', `/child-groups/${second.body.id as string}/members`, principal.accessToken, {
      child_ids: [children.an],
    });
    const filtered = await api('GET', `/children?group_id=${groupId}`, token('manager'));
    assert.deepEqual((filtered.body.items as Array<{ full_name: string }>).map((row) => row.full_name).sort(), [
      'Trẻ an',
      'Trẻ dung',
    ]);
  });

  it('CT-14c-6: giáo viên xem nhóm có trẻ lớp mình (chỉ thấy trẻ của mình), giáo viên phụ trách thấy mọi trẻ', async () => {
    const teacherGroups = await api('GET', '/child-groups', token('teacher'));
    const visible = teacherGroups.body as unknown as Array<{ id: string; name: string; can_manage: boolean }>;
    assert.deepEqual(visible.map((row) => row.name).sort(), ['Chăm sóc đặc biệt', 'Năng khiếu vẽ']);
    const drawing = visible.find((row) => row.name === 'Năng khiếu vẽ')!;
    assert.equal(drawing.can_manage, false);
    const asTeacher = await api('GET', `/child-groups/${drawing.id}`, token('teacher'));
    assert.deepEqual(
      (asTeacher.body.members as Array<{ full_name: string }>).map((row) => row.full_name),
      ['Trẻ an'],
    );
    const inCharge = await api('GET', `/child-groups/${drawing.id}`, token('otherTeacher'));
    assert.equal((inCharge.body.members as unknown[]).length, 2);
    assert.equal((await api('GET', `/child-groups/${drawing.id}`, token('otherManager'))).status, 403);
    const removed = await api('POST', `/child-groups/${drawing.id}/members/remove`, token('manager'), {
      child_ids: [children.dung],
    });
    assert.equal(removed.body.member_count, 1);
    assert.equal(
      (
        await api('POST', `/child-groups/${drawing.id}/members/remove`, token('teacher'), {
          child_ids: [children.an],
        })
      ).status,
      403,
    );
  });

  it('CT-14c-7: danh mục gieo sẵn 15 tiêu chí giáo viên, 18 tiêu chí hiệu trưởng; chỉ Hiệu trưởng sửa', async () => {
    const catalog = await api('GET', '/professional-standards', token('teacher'));
    const standards = catalog.body as unknown as Array<{
      standard_type: string;
      criteria: Array<{ id: string; is_key: boolean }>;
    }>;
    const countOf = (type: string) =>
      standards.filter((row) => row.standard_type === type).reduce((sum, row) => sum + row.criteria.length, 0);
    assert.equal(standards.filter((row) => row.standard_type === 'teacher').length, 5);
    assert.equal(countOf('teacher'), 15);
    assert.equal(standards.filter((row) => row.standard_type === 'principal').length, 5);
    assert.equal(countOf('principal'), 18);
    const criterion = standards.find((row) => row.standard_type === 'teacher')!.criteria[0]!;
    assert.equal(criterion.is_key, true);
    assert.equal(
      (await api('PATCH', `/professional-criteria/${criterion.id}`, token('manager'), { is_key: false })).status,
      403,
    );
    const updated = await api('PATCH', `/professional-criteria/${criterion.id}`, principal.accessToken, {
      name: 'Đạo đức nhà giáo (sửa)',
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.name, 'Đạo đức nhà giáo (sửa)');
  });

  it('CT-14c-8: tự đánh giá rồi quản lý đơn vị đánh giá, chốt phiếu xếp loại chung; nhân sự nhận thông báo', async () => {
    assert.equal(
      (
        await api('POST', '/professional-evaluations', token('otherManager'), {
          standard_type: 'teacher',
          staff_ids: [staff.teacher],
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api('POST', '/professional-evaluations', token('manager'), {
          standard_type: 'principal',
          staff_ids: [staff.teacher],
        })
      ).status,
      403,
      'chuẩn hiệu trưởng chỉ Hiệu trưởng mở',
    );
    const opened = await api('POST', '/professional-evaluations', token('manager'), {
      standard_type: 'teacher',
      staff_ids: [staff.teacher, staff.otherTeacher],
    });
    assert.equal(opened.status, 201, JSON.stringify(opened.body));
    assert.equal(opened.body.created_count, 2);
    const again = await api('POST', '/professional-evaluations', token('manager'), {
      standard_type: 'teacher',
      staff_ids: [staff.teacher],
    });
    assert.deepEqual(again.body.skipped_staff_ids, [staff.teacher]);

    const mine = await api('GET', '/me/professional-evaluation', token('teacher'));
    const evaluation = mine.body.evaluation as { id: string; items: Array<{ criterion_id: string }> };
    assert.equal(evaluation.items.length, 15);
    const path = `/professional-evaluations/${evaluation.id}`;
    const ratings = (rating: string, field: string) =>
      evaluation.items.map((item) => ({ criterion_id: item.criterion_id, rating, [field]: 'Minh chứng' }));
    assert.equal(
      (await api('PUT', `${path}/self`, token('teacher'), { items: ratings('good', 'evidence').slice(0, 3) })).status,
      200,
    );
    assert.equal((await api('POST', `${path}/submit-self`, token('teacher'))).status, 422);
    assert.equal(
      (await api('PUT', `${path}/assessment`, token('manager'), { items: ratings('good', 'note') })).status,
      422,
    );
    assert.equal(
      (await api('PUT', `${path}/self`, token('manager'), { items: ratings('good', 'evidence') })).status,
      403,
    );
    await api('PUT', `${path}/self`, token('teacher'), { items: ratings('good', 'evidence') });
    const submitted = await api('POST', `${path}/submit-self`, token('teacher'));
    assert.equal(submitted.body.status, 'self_submitted');
    assert.equal(
      (await api('PUT', `${path}/assessment`, token('teacher'), { items: ratings('good', 'note') })).status,
      403,
    );
    const assessment = ratings('good', 'note');
    assessment[14] = { ...assessment[14]!, rating: 'met' };
    const saved = await api('PUT', `${path}/assessment`, token('manager'), {
      items: assessment,
      comment: 'Hoàn thành tốt',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const finalized = await api('POST', `${path}/finalize`, token('manager'));
    assert.equal(finalized.status, 200, JSON.stringify(finalized.body));
    assert.equal(finalized.body.status, 'finalized');
    assert.equal(finalized.body.overall_level, 'good');
    assert.equal(
      (await api('PUT', `${path}/self`, token('teacher'), { items: ratings('met', 'evidence') })).status,
      422,
    );
    const notified = await schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select('notifications.template_code')
      .where('notification_recipients.user_id', '=', users.teacher?.userId ?? '')
      .where('notifications.template_code', 'like', 'professional_evaluation_%')
      .execute();
    assert.equal(notified.length, 2);
  });

  it('CT-14c-9: chuẩn hiệu trưởng do Hiệu trưởng đánh giá; không tự đánh giá phiếu của mình', async () => {
    const opened = await api('POST', '/professional-evaluations', principal.accessToken, {
      standard_type: 'principal',
      staff_ids: [staff.manager],
    });
    assert.equal(opened.status, 201, JSON.stringify(opened.body));
    const mine = await api('GET', '/me/professional-evaluation', token('manager'));
    const evaluation = mine.body.evaluation as {
      id: string;
      items: Array<{ criterion_id: string }>;
      can_assess: boolean;
    };
    assert.equal(evaluation.items.length, 18);
    assert.equal(evaluation.can_assess, false, 'quản lý không tự đánh giá phiếu của mình');
    const path = `/professional-evaluations/${evaluation.id}`;
    const ratings = (rating: string) => evaluation.items.map((item) => ({ criterion_id: item.criterion_id, rating }));
    await api('PUT', `${path}/self`, token('manager'), { items: ratings('excellent') });
    await api('POST', `${path}/submit-self`, token('manager'));
    assert.equal(
      (await api('PUT', `${path}/assessment`, token('manager'), { items: ratings('excellent') })).status,
      403,
    );
    await api('PUT', `${path}/assessment`, principal.accessToken, { items: ratings('excellent') });
    const finalized = await api('POST', `${path}/finalize`, principal.accessToken);
    assert.equal(finalized.body.overall_level, 'excellent');
  });

  it('CT-14c-10: thống kê theo mức xếp loại trong phạm vi', async () => {
    const statistics = await api('GET', '/professional-evaluations/statistics', principal.accessToken);
    assert.equal(statistics.status, 200);
    const rows = statistics.body as unknown as Array<{
      standard_type: string;
      total: number;
      finalized: number;
      pending: number;
      levels: Record<string, number>;
    }>;
    const teacher = rows.find((row) => row.standard_type === 'teacher')!;
    assert.deepEqual(
      { total: teacher.total, finalized: teacher.finalized, pending: teacher.pending, good: teacher.levels.good },
      { total: 2, finalized: 1, pending: 1, good: 1 },
    );
    assert.equal(rows.find((row) => row.standard_type === 'principal')?.levels.excellent, 1);
    assert.equal((await api('GET', '/professional-evaluations/statistics', token('teacher'))).status, 403);
    const unitB = await api('GET', '/professional-evaluations', token('otherManager'));
    assert.deepEqual(unitB.body, []);
  });
});
