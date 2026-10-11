import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { openTestAcademicYear, sendJson, startApiTestEnvironment, type ApiTestEnvironment } from '../test-support.js';

// Lớp học và phân công giáo viên; ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/02_P02_VA_P04.md mục 3.5
const rows = <Row = Record<string, unknown>>(body: unknown) => body as Row[];
const errorCodeOf = (body: Record<string, unknown>) => (body.error as { code?: string } | undefined)?.code;

describe('Lớp học và phân công giáo viên', () => {
  let environment: ApiTestEnvironment;
  let principal: string;
  const units: Record<string, string> = {};
  const unit = (code: string) => units[code] ?? null;

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = (await environment.loginAs('VT-02', null)).accessToken;
    await openTestAcademicYear(environment, principal, '2026–2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['PH-A', 'phan_hieu'],
      ['PH-B', 'phan_hieu'],
    ] as const) {
      const created = await sendJson('POST', `${environment.baseUrl}/org-units`, principal, {
        code,
        name: code,
        unit_type: type,
      });
      units[code] = created.body.id as string;
    }
    for (const [code, name, from, to] of [
      ['LA', 'Lá', 60, 71],
      ['MAM', 'Mầm', 48, 59],
    ] as const) {
      await sendJson('POST', `${environment.baseUrl}/grade-levels`, principal, {
        code,
        name,
        age_from_months: from,
        age_to_months: to,
      });
    }
  });

  after(async () => {
    await environment.close();
  });

  const post = (path: string, accessToken: string, body: unknown) =>
    sendJson('POST', `${environment.baseUrl}${path}`, accessToken, body);
  const patch = (path: string, accessToken: string, body: unknown) =>
    sendJson('PATCH', `${environment.baseUrl}${path}`, accessToken, body);
  const get = (path: string, accessToken: string) => sendJson('GET', `${environment.baseUrl}${path}`, accessToken);
  const createClass = (accessToken: string, orgUnit: string, code: string, extra: Record<string, unknown> = {}) =>
    post('/classes', accessToken, {
      org_unit_id: unit(orgUnit),
      code,
      name: code,
      grade_level: 'LA',
      max_size: 25,
      ...extra,
    });

  it('CTC-P02-039: QL-A tạo lớp "Lá 1" thuộc PH-A, bậc học Lá, sĩ số tối đa 25', async () => {
    const manager = await environment.loginAs('VT-03', unit('PH-A'));
    const created = await post('/classes', manager.accessToken, {
      org_unit_id: unit('PH-A'),
      code: 'LA1',
      name: 'Lá 1',
      grade_level: 'LA',
      max_size: 25,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.org_unit_id, unit('PH-A'));
    assert.equal(created.body.max_size, 25);
    assert.equal(typeof created.body.academic_year_id, 'string');
    const duplicate = await createClass(manager.accessToken, 'PH-A', 'LA1');
    assert.equal(duplicate.status, 409);
  });

  it('CTC-P02-040: HT tạo lớp thuộc Trường chính', async () => {
    const created = await createClass(principal, 'TC', 'TC-LA1');
    assert.equal(created.status, 201, JSON.stringify(created.body));
  });

  it('CTC-P02-041: QL-A tạo lớp thuộc PH-B bị từ chối; giáo viên không tạo được lớp; PHT-A tạo được trong PH-A', async () => {
    const manager = await environment.loginAs('VT-03', unit('PH-A'));
    assert.equal((await createClass(manager.accessToken, 'PH-B', 'B1')).status, 403);
    const teacher = await environment.loginAs('VT-07', unit('PH-A'));
    assert.equal((await createClass(teacher.accessToken, 'PH-A', 'A9')).status, 403);
    const deputy = await environment.loginAs('VT-15', unit('PH-A'));
    assert.equal((await createClass(deputy.accessToken, 'PH-A', 'LA2')).status, 201);
  });

  it('P02-05, CT-105: bậc học không có trả lỗi; phòng học của đơn vị khác bị từ chối; phòng cùng đơn vị thì được', async () => {
    assert.equal((await createClass(principal, 'PH-A', 'X1', { grade_level: 'KHONG_CO' })).status, 400);
    const roomOfB = await post('/rooms', principal, {
      org_unit_id: unit('PH-B'),
      code: 'B101',
      name: 'B101',
      capacity: 30,
    });
    const crossed = await createClass(principal, 'PH-A', 'X2', { room_id: roomOfB.body.id });
    assert.equal(crossed.status, 422);
    assert.equal(errorCodeOf(crossed.body), 'ERR_RULE_VIOLATION');
    const roomOfA = await post('/rooms', principal, {
      org_unit_id: unit('PH-A'),
      code: 'A101',
      name: 'A101',
      capacity: 30,
    });
    const placed = await createClass(principal, 'PH-A', 'MAM1', { grade_level: 'MAM', room_id: roomOfA.body.id });
    assert.equal(placed.status, 201, JSON.stringify(placed.body));
    assert.equal(placed.body.room_id, roomOfA.body.id);
  });

  it('CTC-P02-042: gán hai giáo viên chủ nhiệm và một giáo viên bộ môn; giáo viên thấy lớp ở "Lớp của tôi"', async () => {
    const manager = await environment.loginAs('VT-03', unit('PH-A'));
    const created = await createClass(manager.accessToken, 'PH-A', 'LA3');
    const classId = created.body.id as string;
    const firstHomeroom = await environment.loginAs('VT-07', unit('PH-A'));
    const secondHomeroom = await environment.loginAs('VT-07', unit('PH-A'));
    const subjectTeacher = await environment.loginAs('VT-08', unit('PH-A'));
    const outsider = await environment.loginAs('VT-07', unit('PH-B'));

    for (const teacher of [firstHomeroom, secondHomeroom]) {
      const assigned = await post(`/classes/${classId}/staff-assignments`, manager.accessToken, {
        staff_user_id: teacher.userId,
        assignment_role: 'homeroom',
      });
      assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    }
    const subject = await post(`/classes/${classId}/staff-assignments`, manager.accessToken, {
      staff_user_id: subjectTeacher.userId,
      assignment_role: 'subject',
      subject_name: 'Tiếng Anh',
    });
    assert.equal(subject.status, 201, JSON.stringify(subject.body));
    assert.equal(subject.body.subject_name, 'Tiếng Anh');
    assert.equal(typeof subject.body.staff_name, 'string');

    // Người ngoài đơn vị, người không đúng vai trò, gán trùng, thiếu môn dạy
    assert.equal(
      (
        await post(`/classes/${classId}/staff-assignments`, manager.accessToken, {
          staff_user_id: outsider.userId,
          assignment_role: 'homeroom',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post(`/classes/${classId}/staff-assignments`, manager.accessToken, {
          staff_user_id: subjectTeacher.userId,
          assignment_role: 'homeroom',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post(`/classes/${classId}/staff-assignments`, manager.accessToken, {
          staff_user_id: firstHomeroom.userId,
          assignment_role: 'homeroom',
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await post(`/classes/${classId}/staff-assignments`, manager.accessToken, {
          staff_user_id: subjectTeacher.userId,
          assignment_role: 'subject',
        })
      ).status,
      400,
    );

    const mine = await get('/classes?mine=true', firstHomeroom.accessToken);
    assert.deepEqual(
      rows<{ id: string }>(mine.body).map((row) => row.id),
      [classId],
    );
    const listed = rows<{ id: string; staff: unknown[] }>(
      (await get(`/classes?org_unit_id=${unit('PH-A')}`, manager.accessToken)).body,
    );
    assert.equal(listed.find((row) => row.id === classId)?.staff.length, 3);
    assert.equal((await get(`/classes?org_unit_id=${unit('PH-B')}`, manager.accessToken)).status, 403);

    // Kết thúc phân công thì lớp không còn ở "Lớp của tôi"
    const assignments = rows<{ id: string; staff_user_id: string }>(
      (await get(`/classes/${classId}/staff-assignments`, manager.accessToken)).body,
    );
    const firstAssignment = assignments.find((row) => row.staff_user_id === firstHomeroom.userId);
    const ended = await patch(`/classes/${classId}/staff-assignments/${firstAssignment?.id}`, manager.accessToken, {
      status: 'ended',
    });
    assert.equal(ended.status, 200, JSON.stringify(ended.body));
    assert.equal(ended.body.status, 'ended');
    assert.equal(rows((await get('/classes?mine=true', firstHomeroom.accessToken)).body).length, 0);
  });

  it('CTC-P02-043: đóng lớp thì lớp còn đó ở trạng thái đã đóng, không phân công thêm; mở lại được', async () => {
    const created = await createClass(principal, 'PH-A', 'LA4');
    const classId = created.body.id as string;
    const closed = await patch(`/classes/${classId}`, principal, { status: 'closed' });
    assert.equal(closed.body.status, 'closed');
    const teacher = await environment.loginAs('VT-07', unit('PH-A'));
    const refused = await post(`/classes/${classId}/staff-assignments`, principal, {
      staff_user_id: teacher.userId,
      assignment_role: 'homeroom',
    });
    assert.equal(refused.status, 422);
    assert.ok(
      rows<{ id: string }>((await get(`/classes?status=closed`, principal)).body).some((row) => row.id === classId),
    );
    assert.equal((await patch(`/classes/${classId}`, principal, { status: 'active' })).body.status, 'active');
    const logs = await get(`/audit-logs?entity_name=classes&entity_id=${classId}`, principal);
    assert.equal((logs.body as { total: number }).total, 3);
  });

  it('CTC-P01-071: ngừng phòng học thì lớp cũ giữ phòng, lớp mới không gán được phòng đó', async () => {
    const room = await post('/rooms', principal, {
      org_unit_id: unit('PH-A'),
      code: 'A201',
      name: 'A201',
      capacity: 25,
    });
    const old = await createClass(principal, 'PH-A', 'PHONG1', { room_id: room.body.id });
    assert.equal(old.status, 201, JSON.stringify(old.body));
    assert.equal((await patch(`/rooms/${room.body.id}`, principal, { status: 'inactive' })).status, 200);
    assert.equal(
      rows<{ id: string; room_id: string }>((await get('/classes', principal)).body).find(
        (row) => row.id === old.body.id,
      )?.room_id,
      room.body.id,
    );
    const fresh = await createClass(principal, 'PH-A', 'PHONG2', { room_id: room.body.id });
    assert.ok([400, 422].includes(fresh.status), JSON.stringify(fresh.body));
  });

  it('CTC-P01-074, CT-106: ngừng bậc học đang gắn lớp thì lớp cũ giữ nguyên, tạo lớp mới với bậc học đó bị từ chối', async () => {
    const created = await post('/grade-levels', principal, {
      code: 'NHA',
      name: 'Nhà trẻ',
      age_from_months: 24,
      age_to_months: 35,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const old = await createClass(principal, 'PH-A', 'NHA1', { grade_level: 'NHA' });
    assert.equal(old.status, 201, JSON.stringify(old.body));
    assert.equal((await patch(`/grade-levels/${created.body.id}`, principal, { status: 'inactive' })).status, 200);
    const kept = rows<{ id: string; grade_level: string }>((await get('/classes', principal)).body).find(
      (row) => row.id === old.body.id,
    );
    assert.equal(kept?.grade_level, 'NHA');
    const fresh = await createClass(principal, 'PH-A', 'NHA2', { grade_level: 'NHA' });
    assert.equal(fresh.status, 400, JSON.stringify(fresh.body));
  });

  it('BR-02, YCTD-44: mở năm học mới thì lớp của năm cũ không chuyển sang', async () => {
    await openTestAcademicYear(environment, principal, '2027–2028', {
      first_term: { start_date: '2027-09-06', end_date: '2028-01-14' },
      second_term: { start_date: '2028-01-17', end_date: '2028-05-26' },
    });
    assert.equal(rows((await get('/classes', principal)).body).length, 0);
  });
});
