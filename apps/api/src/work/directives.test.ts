import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { classifyProcessing } from '../document-reports/document-reports.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { nextReminder, parseDirectiveInput, resolveDueDate, taskStatusOf } from './directive-fields.js';
import { DirectivesService } from './directives.js';

// Giao việc theo VNPT iOffice và báo cáo xử lý văn bản (DT-18 phần 18c, YCTD-141): biểu mẫu giao việc, phân công theo cây
// đơn vị (xử lý chính, phối hợp, theo dõi; phòng ban hoặc cá nhân), lọc công việc cần xử lý, phê duyệt, phân công tiếp, thu
// hồi, tạo việc từ văn bản đến, nhắc việc định kì, báo cáo. Kịch bản CT-18c-1 đến CT-18c-7
type Body = Record<string, unknown> & { error?: Record<string, unknown> };
const errorOf = (body: Body) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const today = () => VIETNAM_DATE.format(new Date());
const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe('Đọc dữ liệu giao việc, tính hạn, nhắc định kì', () => {
  it('CT-18c-1: biểu mẫu thiếu nội dung, không có xử lý chính, trùng người đều báo lỗi; hạn theo số ngày; nhắc hằng tháng giữ ngày cuối tháng; trạng thái việc theo xử lý chính; nhóm hạn của báo cáo', () => {
    const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
    assert.throws(
      () =>
        parseDirectiveInput({
          content: '',
          assignments: [
            { role: 'coordinate', target_type: 'staff', staff_id: id(1) },
            { role: 'follow', target_type: 'staff', staff_id: id(1) },
          ],
        }),
      (error: { details?: Array<{ field: string }> }) => {
        const fields = (error.details ?? []).map((detail) => detail.field);
        return fields.includes('content') && fields.filter((field) => field === 'assignments').length === 2;
      },
    );
    assert.throws(() => parseDirectiveInput({ content: 'X', assignments: [{ role: 'main', target_type: 'unit' }] }));
    const parsed = parseDirectiveInput({
      content: 'Rà soát hồ sơ\nchi tiết',
      duration_days: 5,
      recurrence: 'weekly',
      assignments: [{ role: 'main', target_type: 'staff', staff_id: id(2) }],
    });
    assert.equal(parsed.recurrence, 'weekly');
    assert.equal(resolveDueDate('2026-10-20', null, 5), '2026-10-25');
    assert.equal(resolveDueDate('2026-10-20', '2026-10-21', 5), '2026-10-21');
    assert.equal(resolveDueDate('2026-10-20', null, null), null);
    assert.equal(nextReminder('2026-01-31', 'monthly'), '2026-02-28');
    assert.equal(nextReminder('2026-10-20', 'weekly'), '2026-10-27');
    assert.equal(nextReminder('2026-10-20', 'none'), null);
    assert.deepEqual(
      taskStatusOf([
        { status: 'done', progress_percent: 100 },
        { status: 'cancelled', progress_percent: 0 },
      ]),
      { status: 'done', progress: 100 },
    );
    assert.deepEqual(
      taskStatusOf([
        { status: 'pending_approval', progress_percent: 100 },
        { status: 'todo', progress_percent: 0 },
      ]),
      { status: 'in_progress', progress: 50 },
    );
    assert.equal(
      classifyProcessing({ status: 'done', deadline: '2026-10-10', finished_on: '2026-10-11' }, '2026-10-20'),
      'done_late',
    );
    assert.equal(
      classifyProcessing({ status: 'pending', deadline: '2026-10-25', finished_on: null }, '2026-10-20'),
      'open_on_time',
    );
    assert.equal(
      classifyProcessing({ status: 'pending', deadline: '2026-10-19', finished_on: null }, '2026-10-20'),
      'open_late',
    );
  });
});

describe('Giao việc theo cây đơn vị', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let manager: LoggedInUser;
  let main: LoggedInUser;
  let partner: LoggedInUser;
  let follower: LoggedInUser;
  let outsider: LoggedInUser;
  let rootId = '';
  let departmentId = '';
  const staffIds = new Map<string, string>();
  let taskId = '';
  let documentId = '';
  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, user.accessToken, body) as Promise<{
      status: number;
      body: Body;
    }>;
  type Assignment = {
    id: string;
    role: string;
    target_type: string;
    status: string;
    staff_id: string | null;
    can_update: boolean;
    can_delegate: boolean;
    can_approve: boolean;
    approval_result: string | null;
  };
  const assignmentsOf = (body: Body) => body.assignments as Assignment[];

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, 'Năm học giao việc', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const yearDatabase = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, yearDatabase.database_name),
    );
    rootId = (
      await schoolYear
        .insertInto('org_units')
        .values({ code: 'GV', name: 'Trường thử giao việc', unit_type: 'truong_chinh', parent_id: null })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    departmentId = (
      await schoolYear
        .insertInto('departments')
        .values({ org_unit_id: rootId, name: 'Tổ Văn phòng thử', parent_id: null })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    manager = await environment.loginAs('VT-03', rootId);
    main = await environment.loginAs('VT-04', rootId);
    partner = await environment.loginAs('VT-09', rootId);
    follower = await environment.loginAs('VT-10', rootId);
    outsider = await environment.loginAs('VT-11', rootId);
    const people: Array<[string, LoggedInUser | null, string | null]> = [
      ['Hiệu trưởng Thử', principal, null],
      ['Quản lý Thử', manager, null],
      ['Chuyên viên Chính', main, null],
      ['Nhân viên Phối hợp', partner, departmentId],
      ['Nhân viên Theo dõi', follower, null],
      ['Nhân viên Ngoài', outsider, null],
      ['Nhân viên Chưa có tài khoản', null, null],
    ];
    for (const [index, [name, user, department]] of people.entries()) {
      const row = await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: rootId,
          code: `GV-${index}`,
          full_name: name,
          start_date: '2025-08-01',
          user_id: user?.userId ?? null,
          department_id: department,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      staffIds.set(name, row.id);
    }
    // Văn bản đến của 18a để tạo việc từ văn bản; Hiệu trưởng tra cứu được mọi văn bản không hạn chế xem
    const bookId = (
      await environment.system
        .insertInto('document_books')
        .values({ direction: 'incoming', name: 'Sổ thử', year: Number(today().slice(0, 4)), start_date: '2026-01-01' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    documentId = (
      await environment.system
        .insertInto('incoming_documents')
        .values({
          book_id: bookId,
          arrival_number: 1,
          summary: 'V/v triển khai kế hoạch thử',
          symbol: '45/KH-THU',
          issuer_name: 'Đơn vị thử',
          document_date: '2026-10-01',
          arrival_date: today(),
          status: 'processing',
          created_by: principal.userId,
          created_by_name: 'Hiệu trưởng Thử',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment.close();
  });

  it('CT-18c-2: lãnh đạo giao việc từ văn bản đến cho cá nhân xử lý chính, phòng ban phối hợp, cá nhân theo dõi; hạn theo số ngày; người chưa có tài khoản, người không có quyền giao việc bị chặn; văn bản ghi lịch sử tạo việc', async () => {
    const forbidden = await api('POST', '/task-directives', main, {
      content: 'Việc không được giao',
      duration_days: 3,
      assignments: [{ role: 'main', target_type: 'staff', staff_id: staffIds.get('Nhân viên Ngoài') }],
    });
    assert.equal(forbidden.status, 403);
    const noAccount = await api('POST', '/task-directives', principal, {
      content: 'Giao người chưa có tài khoản',
      duration_days: 3,
      assignments: [{ role: 'main', target_type: 'staff', staff_id: staffIds.get('Nhân viên Chưa có tài khoản') }],
    });
    assert.equal(noAccount.status, 422, JSON.stringify(noAccount.body));
    const noDue = await api('POST', '/task-directives', principal, {
      content: 'Thiếu hạn',
      assignments: [{ role: 'main', target_type: 'staff', staff_id: staffIds.get('Chuyên viên Chính') }],
    });
    assert.equal(noDue.status, 400);
    assert.ok(errorOf(noDue.body).details?.some((detail) => detail.field === 'assignments[0].due_date'));
    const options = await api('GET', '/task-directives/options', principal);
    assert.equal(options.status, 200);
    const unit = (options.body.units as Array<{ id: string; departments: unknown[]; staff: unknown[] }>)[0];
    assert.equal(unit?.departments.length, 1);
    assert.equal(unit?.staff.length, 6);
    const created = await api('POST', '/task-directives', principal, {
      content: 'Triển khai kế hoạch thử\nChi tiết theo văn bản',
      leader_user_id: principal.userId,
      priority: 'high',
      duration_days: 5,
      remind_assigner: true,
      recurrence: 'weekly',
      source_document_id: documentId,
      related_documents: 'Kế hoạch năm học',
      assignments: [
        { role: 'main', target_type: 'staff', staff_id: staffIds.get('Chuyên viên Chính') },
        { role: 'coordinate', target_type: 'unit', org_unit_id: rootId, department_id: departmentId },
        { role: 'follow', target_type: 'staff', staff_id: staffIds.get('Nhân viên Theo dõi') },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    taskId = created.body.id as string;
    assert.equal(created.body.title, 'Triển khai kế hoạch thử');
    assert.equal(created.body.task_type, 'directive');
    assert.equal(created.body.due_date, shift(today(), 5));
    assert.equal(created.body.source_document_label, '45/KH-THU – V/v triển khai kế hoạch thử');
    assert.ok(created.body.leader_name);
    assert.equal(assignmentsOf(created.body).length, 3);
    const events = await environment.system
      .selectFrom('incoming_document_events')
      .select(['action', 'note'])
      .where('document_id', '=', documentId)
      .execute();
    assert.deepEqual(events, [{ action: 'create_task', note: 'Triển khai kế hoạch thử' }]);
    const byDocument = await api('GET', `/incoming-documents/${documentId}/tasks`, principal);
    assert.deepEqual(
      (byDocument.body as unknown as Array<{ id: string }>).map((row) => row.id),
      [taskId],
    );
    const notices = await schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select(['notification_recipients.user_id', 'notification_recipients.role_code'])
      .where('notifications.target_id', '=', taskId)
      .execute();
    assert.ok(notices.some((notice) => notice.user_id === main.userId));
    assert.ok(notices.some((notice) => notice.role_code === 'VT-03'));
  });

  it('CT-18c-3: công việc cần xử lý lọc theo vai, loại; người theo dõi chỉ xem; người ngoài không thấy; quản lý đơn vị phân công tiếp cho cá nhân của phòng ban', async () => {
    const inbox = await api('GET', '/task-directives?box=inbox&role=main', main);
    assert.equal(inbox.status, 200);
    assert.equal(inbox.body.total, 1);
    const unitInbox = await api('GET', '/task-directives?box=inbox&target=unit', manager);
    assert.equal(unitInbox.body.total, 1);
    const followView = await api('GET', `/task-directives/${taskId}`, follower);
    assert.equal(followView.status, 200);
    const followRow = assignmentsOf(followView.body).find((row) => row.role === 'follow') as Assignment;
    assert.equal(followRow.can_update, false);
    const followUpdate = await api(
      'POST',
      `/task-directives/${taskId}/assignments/${followRow.id}/progress`,
      follower,
      { progress_percent: 10 },
    );
    assert.equal(followUpdate.status, 422);
    assert.equal((await api('GET', `/task-directives/${taskId}`, outsider)).status, 404);
    const managerView = await api('GET', `/task-directives/${taskId}`, manager);
    const unitRow = assignmentsOf(managerView.body).find((row) => row.target_type === 'unit') as Assignment;
    assert.equal(unitRow.can_delegate, true);
    const outsideDepartment = await api('POST', `/task-directives/${taskId}/assignments`, manager, {
      parent_id: unitRow.id,
      assignments: [{ role: 'coordinate', target_type: 'staff', staff_id: staffIds.get('Nhân viên Ngoài') }],
    });
    assert.equal(outsideDepartment.status, 400);
    const delegated = await api('POST', `/task-directives/${taskId}/assignments`, manager, {
      parent_id: unitRow.id,
      assignments: [{ role: 'coordinate', target_type: 'staff', staff_id: staffIds.get('Nhân viên Phối hợp') }],
    });
    assert.equal(delegated.status, 201, JSON.stringify(delegated.body));
    const partnerInbox = await api('GET', '/task-directives?box=inbox&role=coordinate&target=staff', partner);
    assert.equal(partnerInbox.body.total, 1);
    const partnerRow = (partnerInbox.body.items as Array<{ assignment_id: string }>)[0] as { assignment_id: string };
    const partnerDone = await api(
      'POST',
      `/task-directives/${taskId}/assignments/${partnerRow.assignment_id}/progress`,
      partner,
      { progress_percent: 100, content: 'Đã phối hợp' },
    );
    assert.equal(partnerDone.status, 200, JSON.stringify(partnerDone.body));
    const partnerAfter = assignmentsOf(partnerDone.body).find(
      (row) => row.id === partnerRow.assignment_id,
    ) as Assignment;
    assert.equal(partnerAfter.status, 'done');
  });

  it('CT-18c-4: xử lý chính báo xong thì chờ phê duyệt; duyệt chưa xử lý xong trả về đang xử lý; duyệt xử lý xong thì việc hoàn thành; lọc theo trạng thái; việc đã giao', async () => {
    const detail = await api('GET', `/task-directives/${taskId}`, main);
    const mainRow = assignmentsOf(detail.body).find((row) => row.role === 'main') as Assignment;
    const reported = await api('POST', `/task-directives/${taskId}/assignments/${mainRow.id}/progress`, main, {
      progress_percent: 100,
      content: 'Đã xong',
    });
    assert.equal(reported.status, 200);
    assert.equal((assignmentsOf(reported.body).find((row) => row.id === mainRow.id) as Assignment).status, 'pending_approval');
    const pending = await api('GET', '/task-directives?box=inbox&status=pending_approval', main);
    assert.equal(pending.body.total, 1);
    const outboxPending = await api('GET', '/task-directives?box=outbox&status=pending_approval', principal);
    assert.equal(outboxPending.body.total, 1);
    const byMain = await api('POST', `/task-directives/${taskId}/assignments/${mainRow.id}/approve`, main, {
      result: 'done',
    });
    assert.equal(byMain.status, 403);
    const notDone = await api('POST', `/task-directives/${taskId}/assignments/${mainRow.id}/approve`, principal, {
      result: 'not_done',
      note: 'Bổ sung số liệu',
    });
    assert.equal(notDone.status, 200, JSON.stringify(notDone.body));
    assert.equal((await api('GET', '/task-directives?box=inbox&status=approved_not_done', main)).body.total, 1);
    await api('POST', `/task-directives/${taskId}/assignments/${mainRow.id}/progress`, main, { progress_percent: 100 });
    const approved = await api('POST', `/task-directives/${taskId}/assignments/${mainRow.id}/approve`, principal, {
      result: 'done',
    });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.status, 'done');
    assert.equal(approved.body.progress_percent, 100);
    assert.equal((await api('GET', '/task-directives?box=inbox&status=done_on_time', main)).body.total, 1);
    assert.equal((await api('GET', '/task-directives?box=inbox&status=approved_done', main)).body.total, 1);
    const outbox = await api('GET', '/task-directives?box=outbox', principal);
    const row = (outbox.body.items as Array<Record<string, unknown>>).find((item) => item.id === taskId);
    assert.equal(row?.main_handlers, 'Chuyên viên Chính');
    assert.equal(row?.coordinate_handlers, 'Tổ Văn phòng thử');
    const late = await api('PATCH', `/task-directives/${taskId}`, principal, { priority: 'low' });
    assert.equal(late.status, 422);
  });

  it('CT-18c-5: thu hồi phối hợp, không thu hồi được xử lý chính cuối cùng; hủy việc thông báo người xử lý; việc cũ của 3.1 không mở được qua giao việc và ngược lại', async () => {
    const created = await api('POST', '/task-directives', principal, {
      content: 'Việc để thu hồi',
      duration_days: 2,
      assignments: [
        { role: 'main', target_type: 'staff', staff_id: staffIds.get('Chuyên viên Chính') },
        { role: 'coordinate', target_type: 'staff', staff_id: staffIds.get('Nhân viên Theo dõi') },
      ],
    });
    assert.equal(created.status, 201);
    const id = created.body.id as string;
    const rows = assignmentsOf(created.body);
    const mainRow = rows.find((row) => row.role === 'main') as Assignment;
    const coordinateRow = rows.find((row) => row.role === 'coordinate') as Assignment;
    const lastMain = await api('POST', `/task-directives/${id}/assignments/${mainRow.id}/revoke`, principal, {});
    assert.equal(lastMain.status, 422);
    const revoked = await api('POST', `/task-directives/${id}/assignments/${coordinateRow.id}/revoke`, principal, {
      reason: 'Không cần phối hợp',
    });
    assert.equal(revoked.status, 200);
    assert.equal((assignmentsOf(revoked.body).find((row) => row.id === coordinateRow.id) as Assignment).status, 'cancelled');
    assert.equal((await api('GET', '/task-directives?box=inbox&role=coordinate', follower)).body.total, 0);
    const cancelled = await api('POST', `/task-directives/${id}/cancel`, principal, { reason: 'Đổi kế hoạch' });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, 'cancelled');
    assert.equal((await api('GET', `/tasks/${id}`, principal)).status, 404);
    const legacy = await api('POST', '/tasks', main, { title: 'Việc cá nhân', due_date: today() });
    assert.equal(legacy.status, 201);
    assert.equal((await api('GET', `/task-directives/${legacy.body.id as string}`, main)).status, 404);
  });

  it('CT-18c-6: nhắc việc định kì gửi người xử lý rồi dời lần nhắc; nhắc người giao việc một lần khi đến hạn', async () => {
    const created = await api('POST', '/task-directives', principal, {
      content: 'Việc nhắc định kì',
      start_date: shift(today(), -3),
      remind_assigner: true,
      recurrence: 'daily',
      assignments: [{ role: 'main', target_type: 'staff', staff_id: staffIds.get('Chuyên viên Chính'), due_date: today() }],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.id as string;
    assert.equal(created.body.next_reminder_on, shift(today(), -2));
    const directives = environment.api.get(DirectivesService);
    const first = await directives.remind();
    assert.ok(first.periodic >= 1);
    assert.ok(first.assigner >= 1);
    const task = await schoolYear
      .selectFrom('tasks')
      .select(['next_reminder_on', 'assigner_reminded_at'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    assert.equal(task.next_reminder_on, shift(today(), 1));
    assert.ok(task.assigner_reminded_at);
    const second = await directives.remind();
    assert.equal(second.assigner, 0);
    const reminders = await schoolYear
      .selectFrom('notifications')
      .select('template_code')
      .where('target_id', '=', id)
      .where('template_code', 'in', ['task_directive_reminder', 'task_directive_due'])
      .execute();
    assert.equal(reminders.length, 2);
  });

  it('CT-18c-7: báo cáo thực hiện văn bản đến theo người xử lý chính; tổng hợp theo đơn vị; thống kê; xuất Excel, PDF; người không có quyền báo cáo bị chặn', async () => {
    await environment.system
      .insertInto('incoming_document_assignments')
      .values([
        {
          document_id: documentId,
          user_id: main.userId,
          user_name: 'Chuyên viên Chính',
          role: 'main',
          status: 'done',
          deadline: shift(today(), -2),
          finished_at: new Date(Date.now() - 86_400_000),
          assigned_by: principal.userId,
          assigned_by_name: 'Hiệu trưởng Thử',
        },
      ])
      .execute();
    const range = `from=${shift(today(), -30)}&to=${today()}`;
    assert.equal((await api('GET', `/document-reports/incoming?${range}`, main)).status, 403);
    const processing = await api('GET', `/document-reports/incoming?${range}`, principal);
    assert.equal(processing.status, 200, JSON.stringify(processing.body));
    const rows = processing.body.rows as Array<Record<string, unknown>>;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.handler_name, 'Chuyên viên Chính');
    assert.equal(rows[0]?.done_late, 1);
    assert.equal((processing.body.totals as Record<string, number>).on_time_rate, 0);
    const summary = await api('GET', `/document-reports/summary?${range}&org_unit_id=${rootId}`, principal);
    assert.equal(summary.status, 200);
    const unit = (summary.body.rows as Array<Record<string, number>>)[0] as Record<string, number>;
    assert.equal(unit.incoming_total, 1);
    assert.ok((unit.task_total ?? 0) >= 3);
    assert.ok((unit.task_done_on_time ?? 0) >= 2);
    const statistics = await api('GET', `/document-reports/statistics?${range}`, manager);
    assert.equal(statistics.status, 200);
    assert.equal(statistics.body.total_documents, 1);
    for (const [kind, format, type] of [
      ['incoming', 'xlsx', 'spreadsheetml'],
      ['summary', 'pdf', 'pdf'],
    ] as const) {
      const response = await fetch(
        `${environment.baseUrl}/document-reports/export?kind=${kind}&format=${format}&${range}`,
        { headers: { authorization: `Bearer ${principal.accessToken}` } },
      );
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type')?.includes(type));
    }
    const badRange = await api('GET', `/document-reports/incoming?from=${today()}&to=${shift(today(), -1)}`, principal);
    assert.equal(badRange.status, 400);
  });
});
