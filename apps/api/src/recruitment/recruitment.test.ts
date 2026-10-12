import assert from 'node:assert/strict';
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

// Tuyển dụng (DT-11 phần 11b, YCTD-87); kịch bản đề xuất CT-11b-1 đến CT-11b-8
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };
const PDF = Buffer.from('%PDF-1.4\n%hồ sơ xin việc\n', 'utf8');
const TEXT = Buffer.from('không phải pdf', 'utf8');

describe('Tuyển dụng: đề nghị, tin, ứng viên, phỏng vấn', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  let requestId = '';
  let postingId = '';
  let candidateId = '';
  let interviewerStaffId = '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string | undefined, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);

  async function apply(id: string, fields: Record<string, string>, file: Buffer | null = PDF) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
    if (file) {
      form.append('cv', new Blob([file], { type: 'application/pdf' }), 'ho-so.pdf');
    }
    const response = await fetch(`${environment.baseUrl}/public/job-posts/${id}/applications`, {
      method: 'POST',
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
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
    users.hr = await environment.loginAs('VT-06', unitA);
    users.otherHr = await environment.loginAs('VT-06', units['ĐT-B1'] ?? null);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.vice = await environment.loginAs('VT-15', unitA);
    users.teacher = await environment.loginAs('VT-07', unitA);
    users.principal = principal;
    interviewerStaffId = (
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: unitA,
          code: 'NV-PV',
          full_name: 'Người phỏng vấn',
          start_date: addDays(vietnamToday, -100),
          user_id: users.manager.userId,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  it('CT-11b-1: lập đề nghị tuyển dụng, người lập không tự duyệt, Phó Hiệu trưởng duyệt và ghi nhật ký (BR-80)', async () => {
    const forbidden = await api('POST', '/recruitment-requests', token('teacher'), {
      position: 'Giáo viên mầm non',
      quantity: 2,
      requirements: 'Cao đẳng sư phạm',
      reason: 'Mở thêm lớp',
    });
    assert.equal(forbidden.status, 403);
    const invalid = await api('POST', '/recruitment-requests', token('manager'), { position: '', quantity: 0 });
    assert.equal(invalid.status, 400);
    const created = await api('POST', '/recruitment-requests', token('manager'), {
      position: 'Giáo viên mầm non',
      quantity: 2,
      requirements: 'Cao đẳng sư phạm mầm non trở lên',
      reason: 'Mở thêm hai lớp mầm',
      needed_by: addDays(vietnamToday, 30),
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.status, 'pending');
    assert.match(created.body.code as string, /^DNTD-\d{6}$/);
    requestId = created.body.id as string;

    const pending = await api('GET', '/recruitment-requests?view=pending', token('vice'));
    assert.equal(pending.status, 200);
    assert.ok((pending.body as unknown as Array<{ id: string }>).some((row) => row.id === requestId));

    // Nhân sự không được tạo tin khi đề nghị chưa duyệt
    const early = await api('POST', '/job-postings', token('hr'), {
      request_id: requestId,
      title: 'Tuyển giáo viên',
      description: 'Mô tả',
      requirements: 'Yêu cầu',
      deadline: addDays(vietnamToday, 10),
    });
    assert.equal(errorOf(early.body).rule_code, 'BR-80');

    const rejectWithoutReason = await api('POST', `/recruitment-requests/${requestId}/reject`, token('vice'), {});
    assert.equal(rejectWithoutReason.status, 400);
    const hrApprove = await api('POST', `/recruitment-requests/${requestId}/approve`, token('hr'));
    assert.equal(hrApprove.status, 403);
    const approved = await api('POST', `/recruitment-requests/${requestId}/approve`, token('vice'));
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.status, 'approved');
    assert.ok(approved.body.approver_name);
    const again = await api('POST', `/recruitment-requests/${requestId}/approve`, token('principal'));
    assert.equal(errorOf(again.body).rule_code, 'BR-80');
    const log = await schoolYear
      .selectFrom('audit_logs')
      .select('after_data')
      .where('entity_name', '=', 'recruitment_requests')
      .where('entity_id', '=', requestId)
      .where('action', '=', 'update')
      .executeTakeFirstOrThrow();
    const after = log.after_data as Record<string, unknown>;
    assert.equal(after.status, 'approved');
    assert.equal(after.quantity, 2);
    assert.ok(after.approved_at);

    // Người lập không tự duyệt
    const own = await api('POST', '/recruitment-requests', token('vice'), {
      org_unit_id: units['ĐT-A1'],
      position: 'Bảo vệ',
      quantity: 1,
      requirements: 'Sức khỏe tốt',
      reason: 'Thay người nghỉ',
    });
    assert.equal(own.status, 403);
  });

  it('CT-11b-2: soạn và công bố tin; trang công khai hiện tin còn hạn, không cần tài khoản (BR-69)', async () => {
    const otherUnit = await api('POST', '/job-postings', token('otherHr'), {
      request_id: requestId,
      title: 'Tuyển giáo viên',
      description: 'Mô tả',
      requirements: 'Yêu cầu',
      deadline: addDays(vietnamToday, 10),
    });
    assert.equal(otherUnit.status, 403);
    const pastDeadline = await api('POST', '/job-postings', token('hr'), {
      request_id: requestId,
      title: 'Tuyển giáo viên',
      description: 'Mô tả',
      requirements: 'Yêu cầu',
      deadline: addDays(vietnamToday, -1),
    });
    assert.equal(pastDeadline.status, 400);
    const created = await api('POST', '/job-postings', token('hr'), {
      request_id: requestId,
      title: 'Tuyển giáo viên mầm non năm học mới',
      description: 'Dạy lớp mầm, làm việc tại điểm trường A1',
      requirements: 'Cao đẳng sư phạm mầm non',
      deadline: addDays(vietnamToday, 14),
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    postingId = created.body.id as string;
    assert.equal(created.body.status, 'draft');

    const hiddenDraft = await sendJson('GET', `${environment.baseUrl}/public/job-posts`, undefined);
    assert.equal(hiddenDraft.status, 200);
    assert.equal((hiddenDraft.body as unknown as unknown[]).length, 0);

    const published = await api('POST', `/job-postings/${postingId}/publish`, token('hr'));
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal(published.body.is_open, true);

    const publicList = await sendJson('GET', `${environment.baseUrl}/public/job-posts`, undefined);
    const rows = publicList.body as unknown as Array<Record<string, unknown>>;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.title, 'Tuyển giáo viên mầm non năm học mới');
    assert.equal(rows[0]?.position, 'Giáo viên mầm non');
    assert.equal(rows[0]?.unit_name, 'ĐT-A1');
    assert.equal(rows[0]?.created_by, undefined);
    const detail = await sendJson('GET', `${environment.baseUrl}/public/job-posts/${postingId}`, undefined);
    assert.equal(detail.status, 200);

    // Hết hạn nộp thì không còn trên trang công khai
    await schoolYear
      .updateTable('job_postings')
      .set({ deadline: addDays(vietnamToday, -1) })
      .where('id', '=', postingId)
      .execute();
    const expired = await sendJson('GET', `${environment.baseUrl}/public/job-posts/${postingId}`, undefined);
    assert.equal(expired.status, 404);
    await schoolYear
      .updateTable('job_postings')
      .set({ deadline: addDays(vietnamToday, 14) })
      .where('id', '=', postingId)
      .execute();
  });

  it('CT-11b-3: ứng viên nộp hồ sơ không cần tài khoản, kiểm tra dữ liệu vào, tệp PDF hoặc ảnh, không nộp trùng', async () => {
    const fields = {
      full_name: 'Nguyễn Thị Ứng Viên',
      phone: '0912345678',
      email: 'ungvien@example.com',
      dob: '1998-05-20',
      gender: 'female',
      cover_letter: 'Tôi yêu trẻ',
      consent: 'true',
    };
    const noConsent = await apply(postingId, { ...fields, consent: 'false' });
    assert.equal(noConsent.status, 400);
    const badPhone = await apply(postingId, { ...fields, phone: '12345' });
    assert.equal(badPhone.status, 400);
    const noFile = await apply(postingId, fields, null);
    assert.equal(noFile.status, 400);
    const wrongFile = await apply(postingId, fields, TEXT);
    assert.equal(wrongFile.status, 400);
    const accepted = await apply(postingId, fields);
    assert.equal(accepted.status, 201, JSON.stringify(accepted.body));
    assert.equal(accepted.body.id, undefined);
    const duplicate = await apply(postingId, fields);
    assert.equal(duplicate.status, 409);

    const candidate = await schoolYear
      .selectFrom('candidates')
      .selectAll()
      .where('posting_id', '=', postingId)
      .executeTakeFirstOrThrow();
    candidateId = candidate.id;
    assert.equal(candidate.status, 'new');
    assert.equal(candidate.source, 'website');
    assert.equal(candidate.created_by, null);
    assert.ok(candidate.consent_at);
    assert.ok(candidate.cv_file_id);
    const notification = await schoolYear
      .selectFrom('notifications')
      .select('id')
      .where('template_code', '=', 'candidate_applied')
      .executeTakeFirst();
    assert.ok(notification);
  });

  it('CT-11b-4: hồ sơ ứng viên chỉ người có quyền P18 trong phạm vi xem, xem chi tiết và tệp ghi nhật ký truy cập (BR-74)', async () => {
    for (const name of ['teacher', 'otherHr']) {
      const denied = await api('GET', `/candidates/${candidateId}`, token(name));
      assert.equal(denied.status, 403, name);
    }
    const teacherList = await api('GET', '/candidates', token('teacher'));
    assert.equal(teacherList.status, 403);
    const list = await api('GET', `/candidates?posting_id=${postingId}`, token('hr'));
    const rows = list.body as unknown as Array<Record<string, unknown>>;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.phone, undefined);
    assert.equal(rows[0]?.has_cv, true);
    const otherList = await api('GET', '/candidates', token('otherHr'));
    assert.equal((otherList.body as unknown as unknown[]).length, 0);

    const detail = await api('GET', `/candidates/${candidateId}`, token('manager'));
    assert.equal(detail.status, 200);
    assert.equal(detail.body.phone, '0912345678');
    const cv = await fetch(`${environment.baseUrl}/candidates/${candidateId}/cv`, {
      headers: { authorization: `Bearer ${token('hr')}` },
    });
    assert.equal(cv.status, 200);
    assert.equal(cv.headers.get('content-type'), 'application/pdf');
    const viaFiles = await fetch(`${environment.baseUrl}/files/${detail.body.cv_file_id as string}`, {
      headers: { authorization: `Bearer ${principal.accessToken}` },
    });
    assert.equal(viaFiles.status, 403);
    const logs = await schoolYear
      .selectFrom('data_access_logs')
      .select('scope')
      .where('entity_name', '=', 'candidates')
      .where('entity_id', '=', candidateId)
      .execute();
    assert.deepEqual(logs.map((log) => log.scope).sort(), ['candidate_cv', 'candidate_profile']);
  });

  it('CT-11b-5: nhân sự nhập ứng viên, sàng lọc, loại kèm lý do; không xóa hồ sơ (BR-75)', async () => {
    const created = await api('POST', '/candidates', token('hr'), {
      posting_id: postingId,
      full_name: 'Trần Văn Giới Thiệu',
      phone: '0987654321',
      source: 'referral',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const otherId = created.body.id as string;
    const managerCreate = await api('POST', '/candidates', token('manager'), {
      posting_id: postingId,
      full_name: 'Không được',
      phone: '0911111111',
      source: 'walk_in',
    });
    assert.equal(managerCreate.status, 403);
    const noReason = await api('POST', `/candidates/${otherId}/status`, token('hr'), { status: 'rejected' });
    assert.equal(noReason.status, 400);
    const rejected = await api('POST', `/candidates/${otherId}/status`, token('hr'), {
      status: 'rejected',
      reason: 'Không đủ bằng cấp',
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.status, 'rejected');
    const reopen = await api('POST', `/candidates/${otherId}/status`, token('hr'), { status: 'screening' });
    assert.equal(errorOf(reopen.body).rule_code, 'BR-75');
    const remove = await api('DELETE', `/candidates/${otherId}`, token('hr'));
    assert.equal(remove.status, 404);

    const screening = await api('POST', `/candidates/${candidateId}/status`, token('hr'), { status: 'screening' });
    assert.equal(screening.status, 200);
    assert.equal(screening.body.status, 'screening');
  });

  it('CT-11b-6: lên lịch phỏng vấn, ghi kết quả, quyết định tuyển cần lần phỏng vấn gần nhất đạt (BR-80)', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const badInterviewer = await api('POST', `/candidates/${candidateId}/interviews`, token('manager'), {
      scheduled_at: tomorrow,
      location: 'Phòng họp',
      interviewer_staff_ids: [requestId],
    });
    assert.equal(badInterviewer.status, 400);
    const teacher = await api('POST', `/candidates/${candidateId}/interviews`, token('teacher'), {
      scheduled_at: tomorrow,
      location: 'Phòng họp',
      interviewer_staff_ids: [interviewerStaffId],
    });
    assert.equal(teacher.status, 403);
    const first = await api('POST', `/candidates/${candidateId}/interviews`, token('manager'), {
      scheduled_at: tomorrow,
      location: 'Phòng họp điểm trường A1',
      interviewer_staff_ids: [interviewerStaffId],
    });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.round, 1);
    const interviewers = first.body.interviewers as Array<{ full_name: string }>;
    assert.equal(interviewers[0]?.full_name, 'Người phỏng vấn');
    const pendingDecision = await api('POST', `/candidates/${candidateId}/decision`, token('manager'), {
      result: 'hired',
    });
    assert.equal(errorOf(pendingDecision.body).rule_code, 'BR-80');
    const failed = await api('POST', `/interviews/${first.body.id as string}/result`, token('manager'), {
      result: 'failed',
      score: 4.5,
      evaluation: 'Chưa tự tin',
    });
    assert.equal(failed.status, 200, JSON.stringify(failed.body));
    assert.equal(failed.body.score, 4.5);
    const hireAfterFail = await api('POST', `/candidates/${candidateId}/decision`, token('manager'), {
      result: 'hired',
    });
    assert.equal(errorOf(hireAfterFail.body).rule_code, 'BR-80');

    const second = await api('POST', `/candidates/${candidateId}/interviews`, token('hr'), {
      scheduled_at: tomorrow,
      location: 'Lớp mầm 1, dạy thử',
      interviewer_staff_ids: [interviewerStaffId],
    });
    assert.equal(second.body.round, 2);
    const badScore = await api('POST', `/interviews/${second.body.id as string}/result`, token('manager'), {
      result: 'passed',
      score: 11,
      evaluation: 'Tốt',
    });
    assert.equal(badScore.status, 400);
    const passed = await api('POST', `/interviews/${second.body.id as string}/result`, token('manager'), {
      result: 'passed',
      score: 8.5,
      evaluation: 'Dạy thử tốt',
    });
    assert.equal(passed.status, 200);
    const hired = await api('POST', `/candidates/${candidateId}/decision`, token('manager'), {
      result: 'hired',
      note: 'Đạt vòng dạy thử',
    });
    assert.equal(hired.status, 200, JSON.stringify(hired.body));
    assert.equal(hired.body.status, 'hired');
    assert.ok(hired.body.decided_at);
    const audit = await schoolYear
      .selectFrom('audit_logs')
      .select('after_data')
      .where('entity_name', '=', 'candidates')
      .where('entity_id', '=', candidateId)
      .orderBy('created_at', 'desc')
      .executeTakeFirstOrThrow();
    assert.equal((audit.after_data as Record<string, unknown>).status, 'hired');

    const request = await api('GET', `/recruitment-requests/${requestId}`, token('manager'));
    assert.equal(request.body.hired_count, 1);
  });

  it('CT-11b-7: tạo hồ sơ nhân sự từ ứng viên đã tuyển, mỗi người một hồ sơ (BR-37)', async () => {
    const manager = await api('POST', `/candidates/${candidateId}/staff`, token('manager'), {
      code: 'GV-TD-01',
      start_date: addDays(vietnamToday, 7),
    });
    assert.equal(manager.status, 403);
    const created = await api('POST', `/candidates/${candidateId}/staff`, token('hr'), {
      code: 'GV-TD-01',
      start_date: addDays(vietnamToday, 7),
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.staff_code, 'GV-TD-01');
    const staff = await schoolYear
      .selectFrom('staff')
      .select(['full_name', 'phone', 'org_unit_id'])
      .where('code', '=', 'GV-TD-01')
      .executeTakeFirstOrThrow();
    assert.equal(staff.full_name, 'Nguyễn Thị Ứng Viên');
    assert.equal(staff.phone, '0912345678');
    assert.equal(staff.org_unit_id, units['ĐT-A1']);
    const again = await api('POST', `/candidates/${candidateId}/staff`, token('hr'), {
      code: 'GV-TD-02',
      start_date: addDays(vietnamToday, 7),
    });
    assert.equal(errorOf(again.body).rule_code, 'BR-37');
  });

  it('CT-11b-8: đóng đề nghị thì đóng tin; tin đã đóng không nhận hồ sơ; giới hạn số lần nộp theo địa chỉ mạng', async () => {
    const closeByTeacher = await api('POST', `/recruitment-requests/${requestId}/close`, token('teacher'), {
      reason: 'Đủ người',
    });
    assert.equal(closeByTeacher.status, 403);
    const closed = await api('POST', `/recruitment-requests/${requestId}/close`, token('hr'), { reason: 'Đủ người' });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.equal(closed.body.status, 'closed');
    const posting = await api('GET', `/job-postings/${postingId}`, token('hr'));
    assert.equal(posting.body.status, 'closed');
    const late = await apply(postingId, {
      full_name: 'Người nộp muộn',
      phone: '0900000001',
      consent: 'true',
    });
    assert.equal(late.status, 404);
    let limited = 0;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await apply(postingId, { full_name: '', phone: '', consent: 'true' }, null);
      if (response.status === 429) {
        limited += 1;
      }
    }
    assert.ok(limited > 0);
  });
});
