import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
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
import { weightedTotal } from './evaluations.js';

// Công việc, kế hoạch, đánh giá, quá trình công tác, thưởng và khấu trừ (DT-10 phần 10h, YCTD-81); kịch bản đề xuất
// CT-195 đến CT-201
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const currentMonth = vietnamToday.slice(0, 7);
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };

describe('Phép tính điểm đánh giá', () => {
  it('BR-47: điểm tổng là trung bình có trọng số quy về thang 100', () => {
    assert.equal(
      weightedTotal([
        { weight: 2, max_score: 10, score: 8 },
        { weight: 1, max_score: 5, score: 5 },
      ]),
      86.67,
    );
    assert.equal(weightedTotal([]), 0);
  });
});

describe('Công việc, kế hoạch, đánh giá nhân sự, quá trình công tác, thưởng và khấu trừ', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const staff: Record<string, string> = {};

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const notificationsOf = async (userId: string, templateCode: string) =>
    schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select(['notifications.id', 'notifications.title'])
      .where('notification_recipients.user_id', '=', userId)
      .where('notifications.template_code', '=', templateCode)
      .execute();

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const firstStart = addDays(vietnamToday, -100);
    const firstEnd = addDays(vietnamToday, 120);
    const startYear = Number(firstStart.slice(0, 4));
    await openTestAcademicYear(environment, principal.accessToken, `${startYear}–${startYear + 1}`, {
      first_term: { start_date: firstStart, end_date: firstEnd },
      second_term: { start_date: addDays(firstEnd, 3), end_date: addDays(firstEnd, 120) },
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
    users.manager = await environment.loginAs('VT-03', unitA);
    users.otherManager = await environment.loginAs('VT-03', units['ĐT-B1'] ?? null);
    users.hr = await environment.loginAs('VT-06', unitA);
    users.teacher = await environment.loginAs('VT-07', unitA);
    users.otherTeacher = await environment.loginAs('VT-07', unitA);
    users.accountant = await environment.loginAs('VT-04', unitA);
    users.chiefAccountant = await environment.loginAs('VT-05', unitA);
    users.vicePrincipal = await environment.loginAs('VT-15', unitA);
    // Mọi hồ sơ vào làm từ ngày 1 tháng này để tính bảng lương tháng này không cần bảng công tháng trước
    for (const [key, name, user, unit] of [
      ['teacher', 'Nguyễn Thị Lan', 'teacher', 'ĐT-A1'],
      ['otherTeacher', 'Trần Thị Hoa', 'otherTeacher', 'ĐT-A1'],
      ['manager', 'Lê Văn Quản', 'manager', 'ĐT-A1'],
      ['noAccount', 'Phạm Văn Chưa', null, 'ĐT-A1'],
      ['unitB', 'Đỗ Thị Bình', null, 'ĐT-B1'],
    ] as const) {
      staff[key] = (
        await schoolYear
          .insertInto('staff')
          .values({
            org_unit_id: units[unit] ?? '',
            code: `NS-${randomInt(100_000, 999_999)}`,
            full_name: name,
            start_date: `${currentMonth}-01`,
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

  it('CT-195 P09-01: quản lý giao việc trong đơn vị, người nhận nhận thông báo; ngoài đơn vị hoặc không có quyền bị chặn', async () => {
    const assign = (body: Record<string, unknown>, accessToken = token('manager')) =>
      api('POST', '/tasks', accessToken, {
        title: 'Chuẩn bị hồ sơ lớp',
        description: 'Nộp trước buổi họp',
        assignee_staff_id: staff.teacher,
        due_date: addDays(vietnamToday, 7),
        priority: 'high',
        ...body,
      });
    const created = await assign({});
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.task_type, 'assigned');
    assert.equal(created.body.status, 'todo');
    assert.equal((await notificationsOf(users.teacher?.userId ?? '', 'task_assigned')).length, 1);
    assert.equal((await assign({}, token('otherManager'))).status, 403);
    assert.equal((await assign({}, token('otherTeacher'))).status, 403);
    const noAccount = await assign({ assignee_staff_id: staff.noAccount });
    assert.equal(noAccount.status, 422);
    assert.equal(errorOf(noAccount.body).rule_code, 'P09-01');
    assert.equal((await assign({ due_date: addDays(vietnamToday, -1) })).status, 400);
    assert.equal((await assign({ due_date: null })).status, 400);
    // Phòng nhân sự cũng giao được việc
    assert.equal((await assign({ title: 'Cập nhật hồ sơ nhân sự' }, token('hr'))).status, 201);

    const mine = await api('GET', '/tasks?view=mine', token('teacher'));
    assert.equal((mine.body as unknown as unknown[]).length, 2);
    const assigned = await api('GET', '/tasks?view=assigned', token('manager'));
    assert.equal((assigned.body as unknown as unknown[]).length, 1);
    assert.equal((await api('GET', `/tasks/${created.body.id}`, token('otherTeacher'))).status, 403);
    assert.equal((await api('GET', `/tasks/${created.body.id}`, token('vicePrincipal'))).status, 200);
  });

  it('CT-196 P09-02: nhân sự tự tạo việc cá nhân, chỉ mình xem và sửa', async () => {
    const created = await api('POST', '/tasks', token('teacher'), { title: 'Soạn giáo án tuần sau' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.task_type, 'personal');
    assert.equal((await api('GET', `/tasks/${created.body.id}`, token('manager'))).status, 403);
    const unit = await api('GET', '/tasks?view=unit', token('manager'));
    assert.ok(!(unit.body as unknown as Array<{ id: string }>).some((task) => task.id === created.body.id));
    assert.equal((await api('PATCH', `/tasks/${created.body.id}`, token('manager'), { title: 'Sửa hộ' })).status, 403);
    const done = await api('PATCH', `/tasks/${created.body.id}`, token('teacher'), { status: 'done' });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.progress_percent, 100);
    // Tài khoản không gắn hồ sơ nhân sự không có việc cá nhân
    assert.equal((await api('POST', '/tasks', token('accountant'), { title: 'Việc riêng' })).status, 404);
  });

  it('CT-197 P09-04: người nhận cập nhật tiến độ, đủ 100% là hoàn thành, người giao nhận thông báo; bảng tiến độ có việc quá hạn', async () => {
    const created = await api('POST', '/tasks', token('manager'), {
      title: 'Kiểm kê đồ chơi',
      assignee_staff_id: staff.otherTeacher,
      due_date: addDays(vietnamToday, 3),
    });
    const taskId = created.body.id as string;
    assert.equal(
      (await api('POST', `/tasks/${taskId}/updates`, token('teacher'), { progress_percent: 50 })).status,
      403,
    );
    const half = await api('POST', `/tasks/${taskId}/updates`, token('otherTeacher'), {
      progress_percent: 50,
      content: 'Đã kiểm một nửa',
    });
    assert.equal(half.status, 201, JSON.stringify(half.body));
    assert.equal(half.body.status, 'in_progress');
    assert.equal(
      (await api('POST', `/tasks/${taskId}/updates`, token('otherTeacher'), { progress_percent: 120 })).status,
      400,
    );
    const done = await api('POST', `/tasks/${taskId}/updates`, token('otherTeacher'), { progress_percent: 100 });
    assert.equal(done.body.status, 'done');
    assert.equal((done.body.updates as unknown[]).length, 2);
    assert.equal((await notificationsOf(users.manager?.userId ?? '', 'task_done')).length, 1);
    const again = await api('POST', `/tasks/${taskId}/updates`, token('otherTeacher'), { progress_percent: 90 });
    assert.equal(errorOf(again.body).rule_code, 'P09-04');

    // Việc quá hạn chưa xong
    await schoolYear
      .insertInto('tasks')
      .values({
        org_unit_id: units['ĐT-A1'] ?? '',
        task_type: 'assigned',
        title: 'Việc quá hạn',
        assigner_user_id: users.manager?.userId ?? '',
        assigner_name: 'Quản lý',
        assignee_staff_id: staff.otherTeacher ?? '',
        due_date: addDays(vietnamToday, -2),
      })
      .execute();
    const board = await api('GET', `/task-progress?org_unit_id=${units['ĐT-A1']}`, token('manager'));
    assert.equal(board.status, 200, JSON.stringify(board.body));
    const rows = board.body.rows as Array<{ staff_id: string; total: number; done: number; overdue: number }>;
    const row = rows.find((item) => item.staff_id === staff.otherTeacher);
    assert.equal(row?.total, 2);
    assert.equal(row?.done, 1);
    assert.equal(row?.overdue, 1);
    assert.equal((await api('GET', '/task-progress', token('teacher'))).status, 403);
    assert.equal((await api('GET', `/task-progress?org_unit_id=${units['ĐT-A1']}`, token('otherManager'))).status, 403);

    // Người giao hủy việc phải có lý do
    const toCancel = await api('POST', '/tasks', token('manager'), {
      title: 'Việc sẽ hủy',
      assignee_staff_id: staff.teacher,
      due_date: addDays(vietnamToday, 5),
    });
    assert.equal(
      (await api('PATCH', `/tasks/${toCancel.body.id}`, token('manager'), { status: 'cancelled' })).status,
      400,
    );
    const cancelled = await api('PATCH', `/tasks/${toCancel.body.id}`, token('manager'), {
      status: 'cancelled',
      cancel_reason: 'Không còn cần',
    });
    assert.equal(cancelled.body.status, 'cancelled');
    assert.equal(
      (await api('PATCH', `/tasks/${toCancel.body.id}`, token('teacher'), { title: 'Người nhận sửa' })).status,
      403,
    );
  });

  it('CT-198 P09-03: quản lý lập kế hoạch theo kỳ, kích hoạt thì giao việc cho người phụ trách, tiến độ theo việc', async () => {
    const plan = {
      org_unit_id: units['ĐT-A1'],
      period_type: 'month',
      period_value: currentMonth,
      title: 'Kế hoạch tháng',
      objectives: 'Hoàn thành hồ sơ đầu năm',
      items: [
        { content: 'Thu hồ sơ sức khỏe', owner_staff_id: staff.teacher, due_date: addDays(vietnamToday, 10) },
        { content: 'Trang trí lớp', owner_staff_id: staff.otherTeacher, due_date: addDays(vietnamToday, 12) },
      ],
    };
    assert.equal((await api('POST', '/plans', token('hr'), plan)).status, 403);
    assert.equal((await api('POST', '/plans', token('otherManager'), plan)).status, 403);
    assert.equal((await api('POST', '/plans', token('manager'), { ...plan, period_value: 'tháng 10' })).status, 400);
    assert.equal(
      (
        await api('POST', '/plans', token('manager'), {
          ...plan,
          items: [{ content: 'Ngoài đơn vị', owner_staff_id: staff.unitB, due_date: addDays(vietnamToday, 3) }],
        })
      ).status,
      400,
    );
    const created = await api('POST', '/plans', token('manager'), plan);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.status, 'draft');
    assert.equal(created.body.item_count, 2);
    const planId = created.body.id as string;
    const activated = await api('POST', `/plans/${planId}/activate`, token('manager'));
    assert.equal(activated.status, 200, JSON.stringify(activated.body));
    const items = activated.body.items as Array<{ task_id: string | null; owner_staff_id: string }>;
    assert.ok(items.every((item) => item.task_id));
    assert.equal(
      (await api('PATCH', `/plans/${planId}`, token('manager'), { title: 'Sửa sau kích hoạt' })).status,
      422,
    );
    const teacherTask = items.find((item) => item.owner_staff_id === staff.teacher)?.task_id ?? '';
    await api('POST', `/tasks/${teacherTask}/updates`, token('teacher'), { progress_percent: 100 });
    const read = await api('GET', `/plans/${planId}`, token('manager'));
    assert.equal(read.body.done_count, 1);
    assert.equal(read.body.progress_percent, 50);
    const added = await api('POST', `/plans/${planId}/items`, token('manager'), {
      content: 'Họp phụ huynh',
      owner_staff_id: staff.manager,
      due_date: addDays(vietnamToday, 15),
    });
    assert.equal(added.status, 201, JSON.stringify(added.body));
    assert.equal(added.body.item_count, 3);
    assert.equal((await api('GET', '/plans', token('vicePrincipal'))).status, 200);
    assert.equal((await api('GET', '/plans', token('teacher'))).status, 403);
    assert.equal((await api('POST', `/plans/${planId}/close`, token('manager'))).status, 200);
    const late = await api('POST', `/plans/${planId}/items`, token('manager'), {
      content: 'Thêm muộn',
      owner_staff_id: staff.teacher,
      due_date: addDays(vietnamToday, 15),
    });
    assert.equal(errorOf(late.body).rule_code, 'P09-03');
  });

  it('CT-199 P09-05, BR-47: đánh giá theo chỉ số của đơn vị, công bố xong không sửa, đánh giá lại phải có lý do', async () => {
    const criterion = (body: Record<string, unknown>, accessToken = token('hr')) =>
      api('POST', '/evaluation-criteria', accessToken, { org_unit_id: units['ĐT-A1'], ...body });
    const quality = await criterion({ code: 'cl', name: 'Chất lượng công việc', weight: 2, max_score: 10 });
    assert.equal(quality.status, 201, JSON.stringify(quality.body));
    assert.equal(quality.body.code, 'CL');
    const attitude = await criterion({ code: 'TD', name: 'Thái độ', weight: 1, max_score: 5 });
    assert.equal((await criterion({ code: 'CL', name: 'Trùng', weight: 1, max_score: 5 })).status, 409);
    assert.equal(
      (await criterion({ code: 'X', name: 'Giáo viên lập', weight: 1, max_score: 5 }, token('teacher'))).status,
      403,
    );

    const evaluate = (body: Record<string, unknown>, accessToken = token('manager')) =>
      api('POST', '/evaluations', accessToken, {
        staff_id: staff.teacher,
        period_type: 'term',
        period_value: 'HK1 2026-2027',
        comment: 'Hoàn thành tốt',
        scores: [
          { criterion_id: quality.body.id, score: 8 },
          { criterion_id: attitude.body.id, score: 5 },
        ],
        ...body,
      });
    assert.equal((await evaluate({ scores: [{ criterion_id: quality.body.id, score: 8 }] })).status, 400);
    assert.equal(
      (
        await evaluate({
          scores: [
            { criterion_id: quality.body.id, score: 11 },
            { criterion_id: attitude.body.id, score: 5 },
          ],
        })
      ).status,
      400,
    );
    assert.equal((await evaluate({}, token('otherManager'))).status, 403);
    assert.equal((await evaluate({ staff_id: staff.manager })).status, 403);
    const draft = await evaluate({});
    assert.equal(draft.status, 201, JSON.stringify(draft.body));
    assert.equal(draft.body.total_score, 86.67);
    assert.equal((await evaluate({})).status, 409);
    assert.equal(((await api('GET', '/me/evaluations', token('teacher'))).body as unknown as unknown[]).length, 0);
    assert.equal((await api('GET', `/evaluations/${draft.body.id}`, token('teacher'))).status, 403);

    const edited = await api('PATCH', `/evaluations/${draft.body.id}`, token('manager'), {
      scores: [
        { criterion_id: quality.body.id, score: 10 },
        { criterion_id: attitude.body.id, score: 5 },
      ],
    });
    assert.equal(edited.body.total_score, 100);
    const published = await api('POST', `/evaluations/${draft.body.id}/publish`, token('manager'));
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal(published.body.status, 'published');
    assert.equal((await notificationsOf(users.teacher?.userId ?? '', 'evaluation_published')).length, 1);
    const locked = await api('PATCH', `/evaluations/${draft.body.id}`, token('manager'), {
      comment: 'Sửa sau công bố',
    });
    assert.equal(errorOf(locked.body).rule_code, 'BR-47');
    const noReason = await evaluate({});
    assert.equal(errorOf(noReason.body).rule_code, 'BR-47');
    const again = await evaluate({ reevaluation_reason: 'Bổ sung minh chứng', comment: 'Đánh giá lại' });
    assert.equal(again.status, 201, JSON.stringify(again.body));
    assert.equal(again.body.replaces_id, draft.body.id);
    await api('POST', `/evaluations/${again.body.id}/publish`, token('manager'));
    const old = await api('GET', `/evaluations/${draft.body.id}`, token('manager'));
    assert.equal(old.body.status, 'superseded');
    const mine = (await api('GET', '/me/evaluations', token('teacher'))).body as unknown as Array<{ id: string }>;
    assert.deepEqual(
      mine.map((row) => row.id),
      [again.body.id],
    );
    assert.equal((await api('GET', `/evaluations?org_unit_id=${units['ĐT-A1']}`, token('vicePrincipal'))).status, 200);
    assert.equal((await api('GET', '/evaluations', token('otherTeacher'))).status, 403);
  });

  it('CT-200 P07-03, BR-37: phòng nhân sự ghi thêm quá trình công tác và chứng chỉ; nhân sự xem của mình', async () => {
    const department = await schoolYear
      .insertInto('departments')
      .values({ org_unit_id: units['ĐT-A1'] ?? '', name: 'Tổ Mầm' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const main = await api('POST', `/staff/${staff.teacher}/work-history`, token('hr'), {
      from_date: `${currentMonth}-01`,
      department_id: department.id,
      note: 'Giáo viên tổ Mầm',
    });
    assert.equal(main.status, 201, JSON.stringify(main.body));
    // Làm thêm ở đơn vị khác được ghi nhận riêng (BR-37)
    const concurrent = await api('POST', `/staff/${staff.teacher}/work-history`, token('hr'), {
      org_unit_id: units['ĐT-B1'],
      from_date: `${currentMonth}-01`,
      note: 'Dạy tăng cường tại điểm trường B1',
    });
    assert.equal(concurrent.status, 201, JSON.stringify(concurrent.body));
    assert.equal(
      (
        await api('POST', `/staff/${staff.teacher}/work-history`, token('hr'), {
          org_unit_id: units['ĐT-B1'],
          from_date: `${currentMonth}-01`,
          department_id: department.id,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api('POST', `/staff/${staff.teacher}/work-history`, token('manager'), {
          from_date: vietnamToday,
          note: 'x',
        })
      ).status,
      403,
    );
    const closed = await api('PATCH', `/staff-work-history/${concurrent.body.id}`, token('hr'), {
      to_date: addDays(`${currentMonth}-01`, 20),
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.equal(
      (await api('PATCH', `/staff-work-history/${concurrent.body.id}`, token('hr'), { to_date: vietnamToday })).status,
      409,
    );
    const certificate = await api('POST', `/staff/${staff.teacher}/certificates`, token('hr'), {
      name: 'Chứng chỉ sơ cấp cứu',
      certificate_no: 'SCC-01',
      issued_by: 'Hội Chữ thập đỏ',
      issued_date: '2025-05-01',
      expire_date: '2027-05-01',
    });
    assert.equal(certificate.status, 201, JSON.stringify(certificate.body));
    assert.equal(
      (
        await api('POST', `/staff/${staff.teacher}/certificates`, token('hr'), {
          name: 'Sai ngày',
          issued_by: 'Sở',
          issued_date: '2025-05-01',
          expire_date: '2024-05-01',
        })
      ).status,
      400,
    );
    const own = await api('GET', `/staff/${staff.teacher}/work-history`, token('teacher'));
    assert.equal(own.status, 200, JSON.stringify(own.body));
    const history = own.body.history as Array<{ is_main_unit: boolean }>;
    assert.equal(history.length, 2);
    assert.equal(history.filter((row) => !row.is_main_unit).length, 1);
    assert.equal((own.body.certificates as unknown[]).length, 1);
    assert.equal(own.body.can_manage, false);
    assert.equal((await api('GET', `/staff/${staff.teacher}/work-history`, token('otherTeacher'))).status, 403);
    assert.equal((await api('DELETE', `/staff-certificates/${certificate.body.id}`, token('teacher'))).status, 403);
    assert.equal((await api('DELETE', `/staff-certificates/${certificate.body.id}`, token('hr'))).status, 200);
  });

  it('CT-201 P08-07, BR-44, BR-45: kế toán ghi thưởng, khấu trừ có căn cứ; bảng lương tháng đó cộng trừ; trình duyệt xong thì khóa', async () => {
    await schoolYear
      .insertInto('employment_contracts')
      .values({
        staff_id: staff.teacher ?? '',
        contract_no: `HDLD-${randomInt(100_000, 999_999)}`,
        contract_type: 'indefinite',
        start_date: `${currentMonth}-01`,
        base_salary: 10_000_000,
        allowances: JSON.stringify([]),
      })
      .execute();
    const bonusType = await schoolYear
      .insertInto('pay_item_types')
      .values({ kind: 'allowance', code: 'THUONG', name: 'Thưởng thành tích', calculation_method: 'fixed_monthly' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const deductionType = await schoolYear
      .insertInto('pay_item_types')
      .values({ kind: 'deduction', code: 'KT_KHAC', name: 'Khấu trừ tạm ứng', calculation_method: 'fixed_monthly' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const record = (body: Record<string, unknown>, accessToken = token('accountant')) =>
      api('POST', '/bonus-deductions', accessToken, {
        staff_id: staff.teacher,
        pay_item_type_id: bonusType.id,
        month: currentMonth,
        amount: 1_000_000,
        basis: 'Quyết định khen thưởng số 12/QĐ',
        ...body,
      });
    assert.equal((await record({}, token('hr'))).status, 403);
    assert.equal((await record({ basis: '' })).status, 400);
    assert.equal((await record({ amount: -5 })).status, 400);
    const bonus = await record({});
    assert.equal(bonus.status, 201, JSON.stringify(bonus.body));
    assert.equal(bonus.body.kind, 'allowance');
    const deduction = await record(
      { pay_item_type_id: deductionType.id, amount: 300_000, basis: 'Thu hồi tạm ứng ngày 05' },
      token('chiefAccountant'),
    );
    assert.equal(deduction.status, 201, JSON.stringify(deduction.body));
    const wrong = await record({ amount: 50_000, basis: 'Ghi nhầm' });
    const cancelled = await api('POST', `/bonus-deductions/${wrong.body.id}/cancel`, token('accountant'), {
      reason: 'Ghi nhầm số tiền',
    });
    assert.equal(cancelled.body.status, 'cancelled');

    const payroll = await api('POST', '/payrolls', token('accountant'), { month: currentMonth });
    assert.equal(payroll.status, 201, JSON.stringify(payroll.body));
    const payslips = payroll.body.payslips as Array<{
      staff_id: string;
      net_amount: number;
      lines: Array<{ code: string; amount: number; basis: string }>;
    }>;
    const payslip = payslips.find((row) => row.staff_id === staff.teacher);
    assert.equal(payslip?.lines.find((line) => line.code === 'THUONG')?.amount, 1_000_000);
    assert.equal(payslip?.lines.find((line) => line.code === 'KT_KHAC')?.amount, -300_000);
    assert.match(payslip?.lines.find((line) => line.code === 'THUONG')?.basis ?? '', /12\/QĐ/);
    assert.ok(!payslip?.lines.some((line) => line.amount === 50_000));
    // Lương 10 000 000 + thưởng 1 000 000 dưới mức giảm trừ gia cảnh nên không có thuế
    assert.equal(payslip?.net_amount, 10_700_000);

    const listed = await api('GET', `/bonus-deductions?month=${currentMonth}`, token('chiefAccountant'));
    assert.equal((listed.body as unknown as unknown[]).length, 3);
    assert.equal((await api('POST', `/payrolls/${payroll.body.id}/submit`, token('accountant'))).status, 201);
    const late = await record({ amount: 200_000, basis: 'Thưởng bổ sung' });
    assert.equal(errorOf(late.body).rule_code, 'BR-45');
    const lateCancel = await api('POST', `/bonus-deductions/${bonus.body.id}/cancel`, token('accountant'), {
      reason: 'Hủy sau trình duyệt',
    });
    assert.equal(errorOf(lateCancel.body).rule_code, 'BR-45');
  });
});
