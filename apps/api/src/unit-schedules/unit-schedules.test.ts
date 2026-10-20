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
import { expiryYear } from '../work-files/work-files.js';
import { parseEntry, sessionOf, weekStart } from './unit-schedules.js';

// Lịch đơn vị, phòng họp, mẫu lịch, lịch họp và hồ sơ công việc theo VNPT iOffice (DT-18 phần 18c, YCTD-141). Kịch bản
// CT-18c-8 đến CT-18c-12
type Body = Record<string, unknown> & { error?: Record<string, unknown> };
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const today = () => VIETNAM_DATE.format(new Date());
const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe('Đọc dữ liệu lịch, thời hạn bảo quản', () => {
  it('CT-18c-8: dòng lịch thiếu nội dung, giờ sai, phòng họp thiếu giờ đều báo lỗi; buổi theo giờ; thứ Hai đầu tuần; năm hết hạn bảo quản', () => {
    assert.throws(
      () =>
        parseEntry({
          entry_date: '2026-10-20',
          content: '',
          start_time: '25:00',
          room_id: '00000000-0000-4000-8000-000000000001',
        }),
      (error: { details?: Array<{ field: string }> }) => {
        const fields = (error.details ?? []).map((detail) => detail.field).sort();
        return fields.includes('content') && fields.includes('start_time');
      },
    );
    assert.throws(() =>
      parseEntry({ entry_date: '2026-10-20', content: 'Họp', start_time: '09:00', end_time: '08:00' }),
    );
    assert.equal(parseEntry({ entry_date: '2026-10-20', content: 'Họp', start_time: '14:00' }).session, 'afternoon');
    assert.equal(sessionOf('07:30'), 'morning');
    assert.equal(weekStart('2026-10-25'), '2026-10-19');
    assert.equal(weekStart('2026-10-19'), '2026-10-19');
    assert.equal(expiryYear({ retention: 'limited', retention_years: 5, archived_on: '2020-03-01' }), 2025);
    assert.equal(expiryYear({ retention: 'permanent', retention_years: null, archived_on: '2020-03-01' }), null);
  });
});

describe('Lịch đơn vị, phòng họp, hồ sơ công việc', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let clerk: LoggedInUser;
  let manager: LoggedInUser;
  let staffer: LoggedInUser;
  let colleague: LoggedInUser;
  let rootId = '';
  let roomId = '';
  let fileId = '';
  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, user.accessToken, body) as Promise<{
      status: number;
      body: Body;
    }>;
  const monday = weekStart(today());
  const day = (offset: number) => shift(monday, offset);

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, 'Năm học lịch đơn vị', {
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
        .values({ code: 'LDV', name: 'Trường thử lịch', unit_type: 'truong_chinh', parent_id: null })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    clerk = await environment.loginAs('VT-06', null);
    manager = await environment.loginAs('VT-03', rootId);
    staffer = await environment.loginAs('VT-09', rootId);
    colleague = await environment.loginAs('VT-11', rootId);
    for (const [index, [name, user]] of (
      [
        ['Hiệu trưởng Lịch', principal],
        ['Văn thư Lịch', clerk],
        ['Quản lý Lịch', manager],
        ['Nhân viên Hồ sơ', staffer],
        ['Đồng nghiệp Hồ sơ', colleague],
      ] as Array<[string, LoggedInUser]>
    ).entries()) {
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: rootId,
          code: `LDV-${index}`,
          full_name: name,
          start_date: '2025-08-01',
          user_id: user.userId,
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment.close();
  });

  it('CT-18c-9: phòng họp do người duyệt phòng khai; đăng ký phòng chờ duyệt, trùng giờ bị chặn, duyệt, từ chối cần lý do, hủy', async () => {
    assert.equal((await api('POST', '/meeting-rooms', staffer, { name: 'Phòng X' })).status, 403);
    const room = await api('POST', '/meeting-rooms', clerk, {
      name: 'Phòng họp số 1',
      location: 'Tầng 2',
      capacity: 20,
    });
    assert.equal(room.status, 201, JSON.stringify(room.body));
    roomId = room.body.id as string;
    assert.equal((await api('POST', '/meeting-rooms', clerk, { name: 'Phòng họp số 1' })).status, 409);
    const booking = await api('POST', '/room-bookings', staffer, {
      room_id: roomId,
      title: 'Họp tổ y tế',
      date: day(1),
      start_time: '08:00',
      end_time: '09:30',
    });
    assert.equal(booking.status, 201, JSON.stringify(booking.body));
    assert.equal(booking.body.status, 'pending');
    const clash = await api('POST', '/room-bookings', colleague, {
      room_id: roomId,
      title: 'Họp trùng',
      date: day(1),
      start_time: '09:00',
      end_time: '10:00',
    });
    assert.equal(clash.status, 422);
    assert.equal((await api('POST', `/room-bookings/${booking.body.id as string}/approve`, staffer, {})).status, 403);
    const noReason = await api('POST', `/room-bookings/${booking.body.id as string}/reject`, clerk, {});
    assert.equal(noReason.status, 400);
    const approved = await api('POST', `/room-bookings/${booking.body.id as string}/approve`, clerk, {});
    assert.equal(approved.status, 200);
    assert.equal(approved.body.status, 'approved');
    const later = await api('POST', '/room-bookings', colleague, {
      room_id: roomId,
      title: 'Họp kho',
      date: day(1),
      start_time: '09:30',
      end_time: '10:30',
    });
    assert.equal(later.status, 201);
    const cancelled = await api('POST', `/room-bookings/${later.body.id as string}/cancel`, colleague);
    assert.equal(cancelled.body.status, 'cancelled');
    const mine = await api('GET', `/room-bookings?mine=true&from=${day(0)}&to=${day(6)}`, staffer);
    assert.equal((mine.body as unknown as unknown[]).length, 1);
    assert.equal((await api('DELETE', `/meeting-rooms/${roomId}`, clerk)).status, 422);
  });

  it('CT-18c-10: đăng ký lịch tuần sáng, chiều có phòng họp, người tham dự; bản nháp chỉ người đăng ký thấy, công bố thì người tham dự có ở Lịch của tôi; trùng phòng bị chặn; xuất Excel, PDF', async () => {
    assert.equal(
      (await api('POST', '/unit-schedules', staffer, { entry_date: day(2), content: 'Không có quyền' })).status,
      403,
    );
    const wholeSchool = await api('POST', '/unit-schedules', manager, {
      entry_date: day(2),
      content: 'Lịch toàn trường',
    });
    assert.equal(wholeSchool.status, 403, 'Lịch toàn trường cần quyền toàn trường');
    const clash = await api('POST', '/unit-schedules', manager, {
      org_unit_id: rootId,
      entry_date: day(1),
      start_time: '08:30',
      end_time: '09:00',
      content: 'Họp trùng phòng',
      room_id: roomId,
    });
    assert.equal(clash.status, 422);
    const entry = await api('POST', '/unit-schedules', manager, {
      org_unit_id: rootId,
      entry_date: day(1),
      start_time: '14:00',
      end_time: '16:00',
      content: 'Họp giao ban',
      chair_name: 'Hiệu trưởng',
      participants: 'Tổ văn phòng',
      room_id: roomId,
      attendee_ids: [staffer.userId],
    });
    assert.equal(entry.status, 201, JSON.stringify(entry.body));
    assert.equal(entry.body.session, 'afternoon');
    assert.equal(entry.body.room_status, 'pending');
    assert.equal(entry.body.location, 'Phòng họp số 1, Tầng 2');
    const range = `from=${day(0)}&to=${day(6)}`;
    const before = await api('GET', `/unit-schedules?${range}&view=mine`, staffer);
    assert.equal((before.body as unknown as unknown[]).length, 0);
    const published = await api('POST', '/unit-schedules/publish', manager, {
      from: day(0),
      to: day(6),
      org_unit_id: rootId,
    });
    assert.equal(published.body.published, 1);
    const mine = await api('GET', `/unit-schedules?${range}&view=mine`, staffer);
    assert.deepEqual(
      (mine.body as unknown as Array<{ content: string }>).map((row) => row.content),
      ['Họp giao ban'],
    );
    const byRoom = await api('GET', `/unit-schedules?${range}&location=${encodeURIComponent('số 1')}`, colleague);
    assert.equal((byRoom.body as unknown as unknown[]).length, 1);
    for (const format of ['xlsx', 'pdf']) {
      const response = await fetch(`${environment.baseUrl}/unit-schedules/export?${range}&format=${format}`, {
        headers: { authorization: `Bearer ${colleague.accessToken}` },
      });
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('x-export-log-id'));
    }
    const removed = await api('DELETE', `/unit-schedules/${entry.body.id as string}`, manager);
    assert.equal(removed.status, 204);
    const booking = await environment.system
      .selectFrom('room_bookings')
      .select('status')
      .where('title', '=', 'Họp giao ban')
      .executeTakeFirstOrThrow();
    assert.equal(booking.status, 'cancelled');
  });

  it('CT-18c-11: mẫu lịch tuần áp vào tuần khác thành các dòng nháp', async () => {
    const template = await api('POST', '/unit-schedule-templates', manager, {
      name: 'Lịch tuần mẫu',
      org_unit_id: rootId,
      items: [
        { weekday: 1, session: 'morning', start_time: '07:30', content: 'Chào cờ' },
        { weekday: 5, session: 'afternoon', content: 'Sinh hoạt tổ' },
      ],
    });
    assert.equal(template.status, 201, JSON.stringify(template.body));
    const invalid = await api('POST', '/unit-schedule-templates', manager, {
      name: 'Sai',
      items: [{ weekday: 9, session: 'night', content: '' }],
    });
    assert.equal(invalid.status, 400);
    const applied = await api('POST', `/unit-schedule-templates/${template.body.id as string}/apply`, manager, {
      week_of: day(10),
      org_unit_id: rootId,
    });
    assert.equal(applied.status, 200);
    assert.deepEqual(applied.body, { created: 2, week_start: day(7) });
    const drafts = await api('GET', `/unit-schedules?from=${day(7)}&to=${day(13)}`, manager);
    assert.deepEqual(
      (drafts.body as unknown as Array<{ entry_date: string; status: string }>).map((row) => [
        row.entry_date,
        row.status,
      ]),
      [
        [day(7), 'draft'],
        [day(11), 'draft'],
      ],
    );
    const hidden = await api('GET', `/unit-schedules?from=${day(7)}&to=${day(13)}`, colleague);
    assert.equal((hidden.body as unknown as unknown[]).length, 0);
  });

  it('CT-18c-12: hồ sơ công việc cá nhân; chia sẻ xem không cập nhật được; chuyển giao; kết thúc, nộp lưu; văn thư lưu trữ tiếp nhận thành hồ sơ tài liệu; hồ sơ hết hạn bảo quản', async () => {
    const year = Number(today().slice(0, 4));
    const created = await api('POST', '/work-files', staffer, {
      code: 'HS-01',
      title: 'Hồ sơ y tế học đường',
      year,
      retention: 'limited',
      retention_years: 5,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    fileId = created.body.id as string;
    assert.equal((await api('POST', '/work-files', staffer, { code: 'HS-01', title: 'Trùng', year })).status, 409);
    const note = await api('POST', `/work-files/${fileId}/items`, staffer, {
      item_type: 'note',
      title: 'Biên bản kiểm tra',
    });
    assert.equal(note.status, 201, JSON.stringify(note.body));
    const shared = await api('PUT', `/work-files/${fileId}/shares`, staffer, {
      shares: [{ user_id: colleague.userId, permission: 'view' }],
    });
    assert.equal(shared.status, 200);
    const sharedBox = await api('GET', '/work-files?box=shared', colleague);
    assert.equal((sharedBox.body as unknown as unknown[]).length, 1);
    const viewOnly = await api('POST', `/work-files/${fileId}/items`, colleague, { item_type: 'note', title: 'Thêm' });
    assert.equal(viewOnly.status, 422);
    assert.equal((await api('GET', `/work-files/${fileId}`, manager)).status, 404);
    const transferred = await api('POST', `/work-files/${fileId}/transfer`, staffer, {
      user_id: colleague.userId,
      note: 'Bàn giao khi chuyển công tác',
    });
    assert.equal(transferred.status, 200, JSON.stringify(transferred.body));
    const box = await api('GET', '/work-files?box=transferred', colleague);
    assert.deepEqual(
      (box.body as unknown as Array<{ id: string }>).map((row) => row.id),
      [fileId],
    );
    assert.equal((await api('GET', `/work-files/${fileId}`, staffer)).status, 404);
    assert.equal((await api('POST', `/work-files/${fileId}/submit`, colleague, {})).status, 422);
    assert.equal((await api('POST', `/work-files/${fileId}/close`, colleague, {})).status, 200);
    const submitted = await api('POST', `/work-files/${fileId}/submit`, colleague, {});
    assert.equal(submitted.body.status, 'submitted');
    assert.equal((await api('GET', '/work-files?box=archive', colleague)).status, 403);
    const returned = await api('POST', `/work-files/${fileId}/return`, clerk, { note: 'Thiếu mục lục' });
    assert.equal(returned.body.status, 'returned');
    await api('POST', `/work-files/${fileId}/close`, colleague, {});
    await api('POST', `/work-files/${fileId}/submit`, colleague, {});
    const accepted = await api('POST', `/work-files/${fileId}/accept`, clerk, { code: 'LT-HS-01' });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.equal(accepted.body.status, 'archived');
    assert.equal(accepted.body.archive_record_code, 'LT-HS-01');
    const record = await environment.system
      .selectFrom('archive_records')
      .select(['title', 'status', 'retention', 'retention_years', 'handler_name'])
      .where('code', '=', 'LT-HS-01')
      .executeTakeFirstOrThrow();
    assert.deepEqual(record, {
      title: 'Hồ sơ y tế học đường',
      status: 'completed',
      retention: 'limited',
      retention_years: 5,
      handler_name: 'Đồng nghiệp Hồ sơ',
    });
    assert.equal(((await api('GET', '/work-files?box=expired', clerk)).body as unknown as unknown[]).length, 0);
    await environment.system
      .updateTable('work_files')
      .set({ archived_on: `${year - 6}-06-01` })
      .where('id', '=', fileId)
      .execute();
    const expired = await api('GET', '/work-files?box=expired', clerk);
    assert.deepEqual(
      (expired.body as unknown as Array<{ code: string; expiry_year: number }>).map((row) => [
        row.code,
        row.expiry_year,
      ]),
      [['HS-01', year - 1]],
    );
  });
});
