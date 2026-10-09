import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase } from '@school-management/database';
import { sql } from 'kysely';
import { sendJson, startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';
import type { AcademicYearTransitionStep, TransitionViolation } from './academic-year-transition.js';

// Ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/01_DINH_DANH_VA_P01.md mục 4.2
const calendar20262027 = {
  first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
  second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
  summer_term: { start_date: '2027-06-01', end_date: '2027-07-31' },
  school_days_of_week: [1, 2, 3, 4, 5],
};
const calendar20272028 = {
  first_term: { start_date: '2027-09-06', end_date: '2028-01-14' },
  second_term: { start_date: '2028-01-17', end_date: '2028-05-26' },
  summer_term: null,
};

// Bước chuyển năm học giả lập để kiểm tra khung kiểm tra và chuyển dữ liệu (BR-89, BR-93)
let pendingViolation: TransitionViolation | null = null;
const carryOverCalls: Array<{ hadPrevious: boolean }> = [];
const probeStep: AcademicYearTransitionStep = {
  name: 'probe',
  async check() {
    return pendingViolation;
  },
  async carryOver(context) {
    carryOverCalls.push({ hadPrevious: context.previousDatabase !== null });
    await sql`create table carried_probe (value text)`.execute(context.newDatabase);
    await sql`insert into carried_probe (value) values ('da chuyen')`.execute(context.newDatabase);
  },
};

describe('Năm học, lịch năm học và mở năm học', () => {
  let environment: ApiTestEnvironment;
  let principal: string;
  const branchA = randomUUID();

  before(async () => {
    environment = await startApiTestEnvironment({ transitionSteps: [probeStep] });
    principal = (await environment.loginAs('VT-02', null)).accessToken;
  });

  after(async () => {
    await environment.close();
  });

  const url = (path: string) => `${environment.baseUrl}/academic-years${path}`;

  async function createYear(name: string) {
    const response = await sendJson('POST', url(''), principal, { name });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.id as string;
  }

  let year20262027 = '';
  let year20272028 = '';

  it('CTC-P01-013: Hiệu trưởng tạo năm học, năm học ở trạng thái chưa mở', async () => {
    year20262027 = await createYear('2026–2027');
    const list = await sendJson('GET', url(''), principal);
    const created = (list.body as unknown as Array<Record<string, unknown>>).find((year) => year.id === year20262027);
    assert.equal(created?.status, 'draft');
  });

  it('CTC-P01-018, CTC-P01-103: QL-A và PHT-A không tạo năm học, không lưu lịch, không mở năm học', async () => {
    for (const roleCode of ['VT-03', 'VT-15']) {
      const { accessToken } = await environment.loginAs(roleCode, branchA);
      assert.equal((await sendJson('POST', url(''), accessToken, { name: `Thử ${roleCode}` })).status, 403);
      assert.equal(
        (await sendJson('PUT', url(`/${year20262027}/calendar`), accessToken, calendar20262027)).status,
        403,
      );
      assert.equal((await sendJson('POST', url(`/${year20262027}/open`), accessToken)).status, 403);
    }
  });

  it('CTC-P01-100, CTC-P01-101: lịch sai thứ tự học kỳ hoặc kỳ hè bị từ chối', async () => {
    const overlapping = await sendJson('PUT', url(`/${year20262027}/calendar`), principal, {
      ...calendar20262027,
      first_term: { start_date: '2026-09-05', end_date: '2027-01-20' },
    });
    assert.equal(overlapping.status, 400);
    assert.equal(overlapping.body.error?.code, 'ERR_VALIDATION');
    const earlySummer = await sendJson('PUT', url(`/${year20262027}/calendar`), principal, {
      ...calendar20262027,
      summer_term: { start_date: '2027-05-20', end_date: '2027-07-31' },
    });
    assert.equal(earlySummer.status, 400);
  });

  it('CTC-P01-099, CTC-P01-104: lưu lịch trước khi mở, tuần đánh số liên tục đến hết kỳ hè, ai đăng nhập cũng đọc được', async () => {
    const saved = await sendJson('PUT', url(`/${year20262027}/calendar`), principal, calendar20262027);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const teacher = (await environment.loginAs('VT-07', branchA)).accessToken;
    const calendar = await sendJson('GET', url(`/${year20262027}/calendar`), teacher);
    assert.equal(calendar.status, 200);
    assert.deepEqual(calendar.body.summer_term, calendar20262027.summer_term);

    const weeks = (await sendJson('GET', url(`/${year20262027}/weeks`), teacher)).body as unknown as Array<{
      week_no: number;
      start_date: string;
      end_date: string;
    }>;
    assert.equal(weeks[0]?.start_date, '2026-08-31');
    weeks.forEach((week, index) => assert.equal(week.week_no, index + 1));
    assert.ok((weeks.at(-1)?.end_date ?? '') >= '2027-07-31');

    const stored = await environment.system
      .selectFrom('academic_terms')
      .select('term_type')
      .where('academic_year_id', '=', year20262027)
      .execute();
    assert.equal(stored.length, 3);
  });

  it('CTC-P01-102: đánh dấu tuần chứa 08/02/2027 là tuần nghỉ Tết, số tuần không đổi', async () => {
    const before = (await sendJson('GET', url(`/${year20262027}/weeks`), principal)).body as unknown as Array<{
      week_no: number;
      start_date: string;
    }>;
    const tetWeek = before.find((week) => week.start_date === '2027-02-08');
    assert.ok(tetWeek);
    const updated = await sendJson('PATCH', url(`/${year20262027}/weeks`), principal, {
      weeks: [{ week_no: tetWeek.week_no, is_off: true, note: 'Nghỉ Tết' }],
    });
    assert.equal(updated.status, 200);
    const after = updated.body as unknown as Array<{ week_no: number; is_off: boolean; note: string | null }>;
    assert.equal(after.length, before.length);
    const marked = after.find((week) => week.week_no === tetWeek.week_no);
    assert.equal(marked?.is_off, true);
    assert.equal(marked?.note, 'Nghỉ Tết');
  });

  it('BR-91: sửa lịch thì đánh số lại tuần và giữ cờ nghỉ của tuần cùng ngày bắt đầu', async () => {
    const saved = await sendJson('PUT', url(`/${year20262027}/calendar`), principal, {
      ...calendar20262027,
      summer_term: { start_date: '2027-06-01', end_date: '2027-08-15' },
    });
    assert.equal(saved.status, 200);
    const weeks = (await sendJson('GET', url(`/${year20262027}/weeks`), principal)).body as unknown as Array<{
      start_date: string;
      is_off: boolean;
    }>;
    assert.equal(weeks.find((week) => week.start_date === '2027-02-08')?.is_off, true);
    assert.ok(weeks.some((week) => week.start_date <= '2027-08-15' && week.start_date > '2027-08-08'));
  });

  it('Mở năm học đầu tiên: tạo cơ sở dữ liệu năm học, chạy tệp thay đổi cấu trúc, ghi danh sách cơ sở dữ liệu', async () => {
    const opened = await sendJson('POST', url(`/${year20262027}/open`), principal);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    assert.equal(opened.body.status, 'open');
    assert.deepEqual(carryOverCalls, [{ hadPrevious: false }]);

    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .selectAll()
      .where('academic_year_id', '=', year20262027)
      .executeTakeFirstOrThrow();
    assert.equal(registry.database_name, `${environment.schoolYearDatabasePrefix}2026_2027`);
    assert.equal(registry.status, 'active');

    const yearDatabase = createDatabase<unknown>(
      environment.systemDatabaseUrl.replace(/\/[^/]+$/, `/${registry.database_name}`),
    );
    try {
      const migrations = await sql<{ name: string }>`select name from kysely_migration`.execute(yearDatabase);
      assert.ok(migrations.rows.some((row) => row.name === '0001_set_timezone'));
    } finally {
      await yearDatabase.destroy();
    }
  });

  it('BR-93: năm học mới phải bắt đầu sau khi năm đang dùng kết thúc', async () => {
    const overlappingYear = await createYear('Năm chồng lấn');
    await sendJson('PUT', url(`/${overlappingYear}/calendar`), principal, {
      first_term: { start_date: '2027-08-01', end_date: '2027-12-31' },
      second_term: { start_date: '2028-01-03', end_date: '2028-05-26' },
    });
    const response = await sendJson('POST', url(`/${overlappingYear}/open`), principal);
    assert.equal(response.status, 422);
    assert.equal(response.body.error?.rule_code, 'BR-93');
  });

  it('CTC-P01-096: bước kiểm tra báo vi phạm thì không mở được, không tạo cơ sở dữ liệu, năm đang dùng giữ nguyên', async () => {
    year20272028 = await createYear('2027–2028');
    await sendJson('PUT', url(`/${year20272028}/calendar`), principal, calendar20272028);
    pendingViolation = {
      ruleCode: 'BR-89',
      message: 'Còn trẻ đã thôi học có công nợ chưa tất toán',
      details: [{ field: 'children', message: 'T9: 500 000' }],
    };
    const response = await sendJson('POST', url(`/${year20272028}/open`), principal);
    pendingViolation = null;
    assert.equal(response.status, 422);
    assert.equal(response.body.error?.code, 'ERR_RULE_VIOLATION');
    assert.equal(response.body.error?.rule_code, 'BR-89');
    const stillOpen = await environment.system
      .selectFrom('academic_years')
      .select('status')
      .where('id', '=', year20262027)
      .executeTakeFirstOrThrow();
    assert.equal(stillOpen.status, 'open');
    const registered = await environment.system.selectFrom('academic_year_databases').select('id').execute();
    assert.equal(registered.length, 1);
  });

  it('CTC-P01-097, BR-93: mở năm mới thì chuyển dữ liệu, năm cũ chuyển sang đã đóng và cơ sở dữ liệu chỉ đọc', async () => {
    const response = await sendJson('POST', url(`/${year20272028}/open`), principal);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(carryOverCalls.at(-1), { hadPrevious: true });

    const years = await environment.system.selectFrom('academic_years').select(['id', 'status']).execute();
    assert.equal(years.find((year) => year.id === year20262027)?.status, 'closed');
    assert.equal(years.find((year) => year.id === year20272028)?.status, 'open');
    assert.equal(years.filter((year) => year.status === 'open').length, 1);

    const oldRegistry = await environment.system
      .selectFrom('academic_year_databases')
      .selectAll()
      .where('academic_year_id', '=', year20262027)
      .executeTakeFirstOrThrow();
    assert.equal(oldRegistry.status, 'read_only');
    assert.ok(oldRegistry.closed_at);

    const oldDatabase = createDatabase<unknown>(
      environment.systemDatabaseUrl.replace(/\/[^/]+$/, `/${oldRegistry.database_name}`),
    );
    try {
      const rows = await sql<{ value: string }>`select value from carried_probe`.execute(oldDatabase);
      assert.equal(rows.rows[0]?.value, 'da chuyen');
      await assert.rejects(
        sql`insert into carried_probe (value) values ('ghi vao nam cu')`.execute(oldDatabase),
        /read-only/,
      );
    } finally {
      await oldDatabase.destroy();
    }
  });

  it('Năm học đã đóng không sửa được lịch và tuần nghỉ', async () => {
    const calendar = await sendJson('PUT', url(`/${year20262027}/calendar`), principal, calendar20262027);
    assert.equal(calendar.status, 422);
    const weeks = await sendJson('PATCH', url(`/${year20262027}/weeks`), principal, {
      weeks: [{ week_no: 1, is_off: true }],
    });
    assert.equal(weeks.status, 422);
  });

  it('Năm học đã mở không mở lại được; năm học không tồn tại trả ERR_NOT_FOUND', async () => {
    assert.equal((await sendJson('POST', url(`/${year20272028}/open`), principal)).status, 422);
    assert.equal((await sendJson('GET', url(`/${randomUUID()}/calendar`), principal)).status, 404);
    assert.equal((await sendJson('GET', url('/khong-phai-ma/calendar'), principal)).status, 400);
  });
});
