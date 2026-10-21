import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { PROFESSIONAL_DEFAULT_FOLDERS, type MyWorkItem } from '@school-management/shared';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { deadlineState } from '../my-work/my-work-sources.js';

// Hồ sơ chuyên môn và Việc của tôi (DT-18 phần 18e, YCTD-142); kịch bản CT-18e-1 đến CT-18e-9 (kiểm thử giao diện là
// CT-18e-10). Dữ liệu mẫu là dữ liệu giả
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');

describe('Việc của tôi: hạn', () => {
  it('CT-18e-1: quá hạn khi hạn đã qua, sắp đến hạn khi còn trong 2 ngày, theo ngày Việt Nam hoặc thời điểm', () => {
    const now = new Date('2026-10-20T03:00:00Z');
    assert.deepEqual(deadlineState('2026-10-19', now), { overdue: true, due_soon: false });
    assert.deepEqual(deadlineState('2026-10-20', now), { overdue: false, due_soon: true });
    assert.deepEqual(deadlineState('2026-10-22', now), { overdue: false, due_soon: true });
    assert.deepEqual(deadlineState('2026-10-23', now), { overdue: false, due_soon: false });
    assert.deepEqual(deadlineState(new Date('2026-10-20T02:00:00Z'), now), { overdue: true, due_soon: false });
    assert.deepEqual(deadlineState(null, now), { overdue: false, due_soon: false });
  });
});

describe('Hồ sơ chuyên môn', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  const users: Record<string, LoggedInUser> = {};
  const staff: Record<string, string> = {};
  const units: Record<string, string> = {};
  const departments: Record<string, string> = {};
  const folders: Record<string, string> = {};

  const token = (name: string) => (name === 'principal' ? principal.accessToken : (users[name]?.accessToken ?? ''));
  const api = (method: string, path: string, name: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token(name), body);
  async function upload(name: string, documentId: string, note = '') {
    const form = new FormData();
    form.set('note', note);
    form.set('file', new Blob([PDF], { type: 'application/pdf' }), 'ke-hoach.pdf');
    const response = await fetch(`${environment.baseUrl}/professional-documents/${documentId}/versions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token(name)}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }
  async function create(name: string, body: Record<string, unknown>) {
    const created = await api('POST', '/professional-documents', name, body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return created.body.id as string;
  }
  const statusOf = async (id: string) =>
    (
      await schoolYear
        .selectFrom('professional_documents')
        .select('status')
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
    ).status;
  const myWork = async (name: string, query = '') =>
    (await api('GET', `/my-work${query}`, name)).body as unknown as {
      items: MyWorkItem[];
      count: { total: number; overdue: number; by_source: Record<string, number> };
      failed_sources: string[];
    };

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
      ['ĐT-A', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', 'principal', { code, name: code, unit_type: type })).body
        .id as string;
    }
    for (const name of ['Tổ Mẫu giáo lớn', 'Tổ Nhà trẻ']) {
      departments[name] = (
        await schoolYear
          .insertInto('departments')
          .values({ org_unit_id: units['ĐT-A'] ?? '', name })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    users.vice = await environment.loginAs('VT-15', units['ĐT-A'] ?? null);
    users.leader = await environment.loginAs('VT-17', units['ĐT-A'] ?? null);
    users.leader2 = await environment.loginAs('VT-17', units['ĐT-A'] ?? null);
    users.teacher = await environment.loginAs('VT-07', units['ĐT-A'] ?? null);
    users.teacher2 = await environment.loginAs('VT-07', units['ĐT-A'] ?? null);
    users.parent = await environment.loginAs('VT-14', units['ĐT-A'] ?? null);
    for (const [key, name, department] of [
      ['vice', 'Phó Hiệu Trưởng Giả', null],
      ['leader', 'Tổ Trưởng Một', 'Tổ Mẫu giáo lớn'],
      ['leader2', 'Tổ Trưởng Hai', 'Tổ Nhà trẻ'],
      ['teacher', 'Giáo Viên Một', 'Tổ Mẫu giáo lớn'],
      ['teacher2', 'Giáo Viên Hai', 'Tổ Nhà trẻ'],
    ] as const) {
      staff[key] = (
        await schoolYear
          .insertInto('staff')
          .values({
            org_unit_id: units['ĐT-A'] ?? '',
            code: `NS-${randomInt(100_000, 999_999)}`,
            full_name: name,
            start_date: addDays(vietnamToday, -200),
            department_id: department ? (departments[department] ?? null) : null,
            user_id: users[key]?.userId ?? null,
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

  it('CT-18e-2: nạp danh mục mặc định theo cấp học không tạo trùng; chỉ người quản lý kho thêm thư mục; thư mục cha phải cùng nhánh', async () => {
    const forbidden = await api('POST', '/professional-folders/defaults', 'teacher', { school_level: 'MN' });
    assert.equal(forbidden.status, 403);
    const loaded = await api('POST', '/professional-folders/defaults', 'principal', { school_level: 'MN' });
    assert.equal(loaded.status, 200, JSON.stringify(loaded.body));
    assert.deepEqual(loaded.body, { created: PROFESSIONAL_DEFAULT_FOLDERS.MN.length, skipped: 0 });
    const again = await api('POST', '/professional-folders/defaults', 'principal', { school_level: 'MN' });
    assert.deepEqual(again.body, { created: 0, skipped: PROFESSIONAL_DEFAULT_FOLDERS.MN.length });
    const list = (await api('GET', '/professional-folders', 'teacher')).body as unknown as Array<{
      id: string;
      name: string;
      branch: string;
      approval_flow: string;
      requires_signing: boolean;
      school_level: string;
    }>;
    assert.ok(list.every((folder) => folder.school_level === 'MN'));
    for (const folder of list) {
      folders[`${folder.branch}:${folder.name}`] = folder.id;
    }
    const plan = list.find((folder) => folder.name === 'Kế hoạch giáo dục năm, tháng, tuần');
    assert.equal(plan?.approval_flow, 'two_level');
    assert.equal(plan?.requires_signing, true);
    const wrong = await api('POST', '/professional-folders', 'principal', {
      branch: 'group',
      name: 'Con sai nhánh',
      parent_id: folders['personal:Sổ dự giờ'],
    });
    assert.equal(wrong.status, 400);
    const child = await api('POST', '/professional-folders', 'principal', {
      branch: 'personal',
      name: 'Giáo án tuần',
      parent_id: folders['personal:Sổ dự giờ'],
      approval_flow: 'two_level',
    });
    assert.equal(child.status, 201, JSON.stringify(child.body));
    folders.lesson = child.body.id as string;
    const deleted = await api('DELETE', `/professional-folders/${folders['personal:Sổ dự giờ']}`, 'principal');
    assert.equal(errorOf(deleted.body).rule_code, 'YCTD-142');
  });

  it('CT-18e-3: luồng tổ trưởng rồi Ban Giám hiệu duyệt; trả lại, tải phiên bản mới, nộp lại giữ phiên bản cũ; tổ khác không thấy', async () => {
    const id = await create('teacher', { folder_id: folders.lesson, title: 'Giáo án tuần 5' });
    const empty = await api('POST', `/professional-documents/${id}/submit`, 'teacher', {});
    assert.equal(errorOf(empty.body).rule_code, 'YCTD-142');
    assert.equal((await upload('teacher', id, 'Bản đầu')).status, 201);
    const submitted = await api('POST', `/professional-documents/${id}/submit`, 'teacher', {});
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    assert.equal(submitted.body.status, 'pending_leader');
    // Tổ trưởng tổ khác không thấy, không duyệt được
    assert.equal((await api('GET', `/professional-documents/${id}`, 'leader2')).status, 403);
    const review = (await api('GET', '/professional-documents?view=review', 'leader')).body as unknown as Array<{
      id: string;
    }>;
    assert.ok(review.some((row) => row.id === id));
    assert.equal((await api('POST', `/professional-documents/${id}/approve`, 'vice', {})).status, 422);
    const returned = await api('POST', `/professional-documents/${id}/return`, 'leader', { note: 'Bổ sung mục tiêu' });
    assert.equal(returned.status, 200, JSON.stringify(returned.body));
    assert.equal(returned.body.status, 'returned');
    const work = await myWork('teacher', '?source=professional');
    assert.ok(work.items.some((item) => item.kind === 'Hồ sơ bị trả lại' && item.detail === 'Bổ sung mục tiêu'));
    assert.equal((await upload('teacher', id, 'Đã bổ sung')).status, 201);
    await api('POST', `/professional-documents/${id}/submit`, 'teacher', {});
    const leaderApproved = await api('POST', `/professional-documents/${id}/leader-approve`, 'leader', { note: 'Đạt' });
    assert.equal(leaderApproved.body.status, 'pending_approval');
    const approved = await api('POST', `/professional-documents/${id}/approve`, 'vice', {});
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.status, 'approved');
    const versions = approved.body.versions as Array<{ version_no: number }>;
    assert.deepEqual(
      versions.map((version) => version.version_no),
      [2, 1],
    );
    const actions = (approved.body.events as Array<{ action: string }>).map((event) => event.action);
    assert.deepEqual(actions, [
      'create',
      'upload',
      'submit',
      'return',
      'upload',
      'submit',
      'leader_approve',
      'approve',
    ]);
    // Đã duyệt thì không tải phiên bản được nữa
    assert.equal((await upload('teacher', id)).status, 422);
  });

  it('CT-18e-4: thư mục cần kí: duyệt cuối cần chứng thư nhà trường đã đăng ký; kí nội bộ lập bản PDF đã kí', async () => {
    const id = await create('teacher', {
      folder_id: folders['personal:Kế hoạch giáo dục năm, tháng, tuần'],
      title: 'Kế hoạch giáo dục tháng 10',
    });
    await upload('teacher', id);
    await api('POST', `/professional-documents/${id}/submit`, 'teacher', {});
    await api('POST', `/professional-documents/${id}/leader-approve`, 'leader', {});
    const blocked = await api('POST', `/professional-documents/${id}/approve`, 'vice', {});
    assert.equal(blocked.status, 422);
    assert.equal(errorOf(blocked.body).rule_code, 'YCTD-142');
    assert.equal(await statusOf(id), 'pending_approval');
    const saved = await api('PUT', '/signing/certificate', 'principal', {
      signature_type: 'remote',
      provider: 'VNPT-CA',
      login_name: 'truong-thu-ho-so',
      holder_name: 'Hiệu trưởng Thử',
      holder_title: 'Hiệu trưởng',
      serial_number: 'SERI-HSCM',
      valid_from: '2026-01-01',
      valid_to: '2099-12-31',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal((await api('POST', '/signing/certificate/register', 'principal')).status, 200);
    const signed = await api('POST', `/professional-documents/${id}/approve`, 'vice', {});
    assert.equal(signed.status, 200, JSON.stringify(signed.body));
    assert.equal(signed.body.signature_method, 'internal');
    const file = await fetch(`${environment.baseUrl}/professional-documents/${id}/signed-file`, {
      headers: { authorization: `Bearer ${token('teacher')}` },
    });
    assert.equal(file.status, 200);
    assert.equal(
      Buffer.from(await file.arrayBuffer())
        .subarray(0, 4)
        .toString(),
      '%PDF',
    );
  });

  it('CT-18e-5: đợt nộp có hạn: nộp sau hạn ghi nộp trễ; thống kê đúng hạn, trễ, chưa nộp; tổ trưởng xem tổ mình; nhắc người chưa nộp; đợt đóng không nộp mới', async () => {
    const folder = folders['personal:Hồ sơ bồi dưỡng thường xuyên'];
    const onTime = await api('POST', '/professional-rounds', 'principal', {
      folder_id: folder,
      title: 'Nộp hồ sơ bồi dưỡng học kì I',
      submitter_kind: 'staff',
      org_unit_id: units['ĐT-A'],
      opens_on: addDays(vietnamToday, -5),
      due_at: `${addDays(vietnamToday, 10)}T17:00`,
    });
    assert.equal(onTime.status, 201, JSON.stringify(onTime.body));
    const late = await api('POST', '/professional-rounds', 'principal', {
      folder_id: folder,
      title: 'Nộp bổ sung đã quá hạn',
      submitter_kind: 'staff',
      org_unit_id: units['ĐT-A'],
      department_ids: [departments['Tổ Mẫu giáo lớn']],
      opens_on: addDays(vietnamToday, -10),
      due_at: `${addDays(vietnamToday, -1)}T17:00`,
    });
    assert.equal(late.status, 201);
    const wrongKind = await api('POST', '/professional-rounds', 'principal', {
      folder_id: folder,
      title: 'Sai nhánh',
      submitter_kind: 'group',
      opens_on: vietnamToday,
      due_at: `${addDays(vietnamToday, 3)}T17:00`,
    });
    assert.equal(wrongKind.status, 400);
    // Việc của tôi nhắc đợt chưa nộp, đợt quá hạn đứng đầu
    const before = await myWork('teacher', '?source=professional');
    const roundItems = before.items.filter((item) => item.kind === 'Nộp hồ sơ theo đợt');
    assert.equal(roundItems.length, 2);
    assert.equal(roundItems[0]?.title, 'Nộp bổ sung đã quá hạn');
    assert.equal(roundItems[0]?.overdue, true);
    const a = await create('teacher', { folder_id: folder, round_id: onTime.body.id, title: 'BDTX của GV Một' });
    await upload('teacher', a);
    await api('POST', `/professional-documents/${a}/submit`, 'teacher', {});
    const duplicate = await api('POST', '/professional-documents', 'teacher', {
      folder_id: folder,
      round_id: onTime.body.id,
      title: 'Trùng',
    });
    assert.equal(errorOf(duplicate.body).rule_code, 'YCTD-142');
    const b = await create('teacher', { folder_id: folder, round_id: late.body.id, title: 'Bổ sung của GV Một' });
    await upload('teacher', b);
    await api('POST', `/professional-documents/${b}/submit`, 'teacher', {});
    const lateRow = await schoolYear
      .selectFrom('professional_documents')
      .select('submitted_late')
      .where('id', '=', b)
      .executeTakeFirstOrThrow();
    assert.equal(lateRow.submitted_late, true);
    const status = await api('GET', `/professional-rounds/${onTime.body.id}/status`, 'principal');
    const submitters = status.body.submitters as Array<{ name: string; state: string }>;
    assert.equal(submitters.find((item) => item.name === 'Giáo Viên Một')?.state, 'on_time');
    assert.equal(submitters.find((item) => item.name === 'Giáo Viên Hai')?.state, 'missing');
    const leaderView = await api('GET', `/professional-rounds/${onTime.body.id}/status`, 'leader');
    assert.deepEqual((leaderView.body.submitters as Array<{ name: string }>).map((item) => item.name).sort(), [
      'Giáo Viên Một',
      'Tổ Trưởng Một',
    ]);
    assert.equal((await api('GET', `/professional-rounds/${onTime.body.id}/status`, 'teacher')).status, 403);
    const statistics = await api('GET', '/professional-records/statistics', 'vice');
    const rows = statistics.body.rounds as Array<{ title: string; on_time: number; late: number; missing: number }>;
    assert.deepEqual(
      rows.find((row) => row.title === 'Nộp bổ sung đã quá hạn'),
      { ...rows.find((row) => row.title === 'Nộp bổ sung đã quá hạn'), on_time: 0, late: 1, missing: 1 },
    );
    const reminded = await api('POST', `/professional-rounds/${onTime.body.id}/remind`, 'principal');
    assert.equal(reminded.status, 200);
    assert.ok((reminded.body.reminded as number) >= 3);
    assert.equal((await api('POST', `/professional-rounds/${onTime.body.id}/close`, 'principal')).status, 200);
    const closed = await api('POST', '/professional-documents', 'teacher2', {
      folder_id: folder,
      round_id: onTime.body.id,
      title: 'Nộp sau khi đóng',
    });
    assert.equal(errorOf(closed.body).rule_code, 'YCTD-142');
  });

  it('CT-18e-6: hồ sơ của tổ do tổ trưởng nộp bỏ bước tổ trưởng; nhóm công tác: thành viên nộp, trưởng nhóm duyệt', async () => {
    const groupFolder = folders['group:Sổ sinh hoạt tổ chuyên môn'];
    const own = await create('leader', { folder_id: groupFolder, title: 'Sổ sinh hoạt tổ tháng 10' });
    await upload('leader', own);
    const submitted = await api('POST', `/professional-documents/${own}/submit`, 'leader', {});
    assert.equal(submitted.body.status, 'pending_approval');
    const otherDepartment = await api('POST', '/professional-documents', 'teacher', {
      folder_id: groupFolder,
      title: 'Sai tổ',
      department_id: departments['Tổ Nhà trẻ'],
    });
    assert.equal(otherDepartment.status, 400);
    const group = await api('POST', '/professional-work-groups', 'principal', {
      org_unit_id: units['ĐT-A'],
      name: 'Nhóm làm đồ dùng dạy học',
      members: [
        { staff_id: staff.teacher2, is_leader: true },
        { staff_id: staff.teacher, is_leader: false },
      ],
    });
    assert.equal(group.status, 201, JSON.stringify(group.body));
    const id = await create('teacher', {
      folder_id: groupFolder,
      title: 'Biên bản nhóm',
      work_group_id: group.body.id,
    });
    await upload('teacher', id);
    assert.equal(
      (await api('POST', `/professional-documents/${id}/submit`, 'teacher', {})).body.status,
      'pending_leader',
    );
    const leaderWork = await myWork('teacher2', '?source=professional');
    assert.ok(leaderWork.items.some((item) => item.title === 'Biên bản nhóm'));
    // Tổ trưởng của tổ Mẫu giáo lớn không duyệt hồ sơ của nhóm
    assert.equal((await api('POST', `/professional-documents/${id}/leader-approve`, 'leader', {})).status, 403);
    const approved = await api('POST', `/professional-documents/${id}/leader-approve`, 'teacher2', {});
    assert.equal(approved.body.status, 'pending_approval');
  });

  it('CT-18e-7: khóa năm học chặn thêm, nộp, duyệt; mở khóa lại thao tác được; chỉ người quản lý khóa được', async () => {
    assert.equal((await api('PUT', '/professional-records/lock', 'teacher', { locked: true })).status, 403);
    const locked = await api('PUT', '/professional-records/lock', 'principal', { locked: true });
    assert.equal(locked.body.locked, true, JSON.stringify(locked.body));
    const blocked = await api('POST', '/professional-documents', 'teacher', {
      folder_id: folders.lesson,
      title: 'Khi đã khóa',
    });
    assert.equal(errorOf(blocked.body).rule_code, 'YCTD-142');
    const pending = (await api('GET', '/professional-documents?view=review', 'vice')).body as unknown as Array<{
      id: string;
    }>;
    assert.ok(pending.length > 0);
    assert.equal((await api('POST', `/professional-documents/${pending[0]!.id}/approve`, 'vice', {})).status, 422);
    assert.equal((await api('PUT', '/professional-records/lock', 'principal', { locked: false })).body.locked, false);
    assert.equal((await api('POST', `/professional-documents/${pending[0]!.id}/approve`, 'vice', {})).status, 200);
  });

  it('CT-18e-8: Việc của tôi gom việc chờ từ nhiều phân hệ, đếm theo nguồn, lọc quá hạn và tìm chữ; ai đăng nhập cũng gọi được', async () => {
    const id = await create('teacher2', { folder_id: folders.lesson, title: 'Giáo án của GV Hai' });
    await upload('teacher2', id);
    await api('POST', `/professional-documents/${id}/submit`, 'teacher2', {});
    const leaderWork = await myWork('leader2');
    assert.deepEqual(leaderWork.failed_sources, []);
    assert.ok(leaderWork.items.some((item) => item.source === 'professional' && item.title === 'Giáo án của GV Hai'));
    const count = (await api('GET', '/my-work/count', 'leader2')).body as unknown as {
      total: number;
      by_source: Record<string, number>;
    };
    assert.equal(count.total, leaderWork.count.total);
    assert.equal(count.by_source.professional, leaderWork.count.by_source.professional);
    const teacherWork = await myWork('teacher', '?state=overdue');
    assert.ok(teacherWork.items.every((item) => item.overdue));
    const search = await myWork('leader2', `?q=${encodeURIComponent('gv hai')}`);
    assert.ok(search.items.length > 0 && search.items.every((item) => /gv hai/i.test(`${item.title} ${item.detail}`)));
    const parent = await api('GET', '/my-work/count', 'parent');
    assert.equal(parent.status, 200);
    assert.equal((parent.body as { total: number }).total, 0);
  });

  it('CT-18e-9: phụ huynh không gọi được kho hồ sơ; hồ sơ cá nhân người khác không xem được; hồ sơ trường đã duyệt ai cũng xem', async () => {
    assert.equal((await api('GET', '/professional-documents', 'parent')).status, 403);
    const id = await create('principal', {
      folder_id: folders['school:Kế hoạch giáo dục nhà trường'],
      title: 'Kế hoạch giáo dục nhà trường năm học',
    });
    await upload('principal', id);
    const submitted = await api('POST', `/professional-documents/${id}/submit`, 'principal', {});
    assert.equal(submitted.body.status, 'approved');
    const school = (await api('GET', '/professional-documents?view=school', 'teacher2')).body as unknown as Array<{
      id: string;
    }>;
    assert.ok(school.some((row) => row.id === id));
    const mine = (await api('GET', '/professional-documents?view=mine', 'teacher')).body as unknown as Array<{
      id: string;
      owner_name: string;
    }>;
    assert.equal((await api('GET', `/professional-documents/${mine[0]!.id}`, 'teacher2')).status, 403);
  });
});
