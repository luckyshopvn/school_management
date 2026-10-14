import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { sql } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { MAXIMUM_FEEDBACK_PER_HOUR, parseFeedbackInput, parseFeedbackUpdate } from './feedback.js';

// Gửi phản hồi và xử lý ý kiến phản hồi (DT-15 phần 15g, YCTD-110); kịch bản CT-15g-1 đến CT-15g-8
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

const validInput = {
  feedback_type: 'bug',
  title: 'Lỗi lưu hồ sơ',
  content: 'Bấm Ghi thì trang báo lỗi',
  page_url: '/children',
};

describe('Kiểm tra biểu mẫu Gửi phản hồi', () => {
  it('nhận biểu mẫu hợp lệ, bỏ khoảng trắng, trường không bắt buộc để trống là null', () => {
    assert.deepEqual(parseFeedbackInput({ ...validInput, title: '  Lỗi lưu hồ sơ ', contact_email: '' }), {
      feedback_type: 'bug',
      title: 'Lỗi lưu hồ sơ',
      content: 'Bấm Ghi thì trang báo lỗi',
      page_url: '/children',
      contact_phone: null,
      contact_email: null,
    });
  });

  it('từ chối loại lạ, thiếu tiêu đề hoặc nội dung, đường dẫn ngoài cổng, liên hệ sai định dạng, quá dài', () => {
    for (const body of [
      { ...validInput, feedback_type: 'khac' },
      { ...validInput, title: ' ' },
      { ...validInput, content: undefined },
      { ...validInput, page_url: 'https://ví-dụ.vn/a' },
      { ...validInput, contact_phone: '12ab' },
      { ...validInput, contact_email: 'khong-phai-thu' },
      { ...validInput, title: 'a'.repeat(201) },
      { ...validInput, content: 'a'.repeat(5001) },
      undefined,
    ]) {
      assert.throws(() => parseFeedbackInput(body), { code: 'ERR_VALIDATION' });
    }
  });

  it('cập nhật cần trạng thái hợp lệ hoặc nội dung trả lời', () => {
    assert.deepEqual(parseFeedbackUpdate({ status: 'resolved', reply: ' Đã sửa ' }), {
      status: 'resolved',
      reply: 'Đã sửa',
    });
    assert.deepEqual(parseFeedbackUpdate({ reply: '' }), { reply: null });
    assert.throws(() => parseFeedbackUpdate({}), { code: 'ERR_VALIDATION' });
    assert.throws(() => parseFeedbackUpdate({ status: 'done' }), { code: 'ERR_VALIDATION' });
  });
});

describe('Điểm cuối ý kiến phản hồi', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let platformAdministrator: LoggedInUser;
  let teacher: LoggedInUser;
  let otherTeacher: LoggedInUser;
  let teacherFeedbackId: string;
  const url = (path: string) => `${environment.baseUrl}${path}`;

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    platformAdministrator = await environment.loginAs('VT-01', null);
    await openTestAcademicYear(environment, principal.accessToken, 'Năm học ý kiến', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    teacher = await environment.loginAs('VT-07', null);
    otherTeacher = await environment.loginAs('VT-07', null);
  });

  after(async () => {
    await environment.close();
  });

  it('CT-15g-1: chưa đăng nhập thì bị từ chối', async () => {
    assert.equal((await sendJson('POST', url('/user-feedback'), undefined, validInput)).status, 401);
    assert.equal((await sendJson('GET', url('/me/user-feedback'), undefined)).status, 401);
  });

  it('CT-15g-2: giáo viên gửi ý kiến, xem lại ở danh sách của mình; người khác không thấy', async () => {
    const created = await sendJson('POST', url('/user-feedback'), teacher.accessToken, {
      ...validInput,
      contact_phone: '0901234567',
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'new');
    assert.equal(created.body.user_id, teacher.userId);
    assert.equal(created.body.page_url, '/children');
    assert.equal(created.body.reply, null);
    teacherFeedbackId = created.body.id as string;

    const own = await sendJson('GET', url('/me/user-feedback'), teacher.accessToken);
    assert.equal(own.status, 200);
    const items = own.body as unknown as Array<Record<string, unknown>>;
    assert.deepEqual(
      items.map((item) => item.id),
      [teacherFeedbackId],
    );
    const others = await sendJson('GET', url('/me/user-feedback'), otherTeacher.accessToken);
    assert.deepEqual(others.body, []);
  });

  it('CT-15g-3: dữ liệu sai bị từ chối kèm trường lỗi', async () => {
    const rejected = await sendJson('POST', url('/user-feedback'), teacher.accessToken, {
      feedback_type: 'khac',
      title: '',
      content: 'Nội dung',
      contact_email: 'sai',
    });
    assert.equal(rejected.status, 400);
    assert.deepEqual(
      errorOf(rejected.body)
        .details?.map((detail) => detail.field)
        .sort(),
      ['contact_email', 'feedback_type', 'title'],
    );
  });

  it('CT-15g-4: gửi kèm ảnh chụp màn hình; người gửi và người xử lý xem được ảnh, người khác không', async () => {
    const form = new FormData();
    form.set('feedback_type', 'suggestion');
    form.set('title', 'Thêm cột ngày sinh');
    form.set('content', 'Đề nghị thêm cột');
    form.set('attachment', new Blob([PNG], { type: 'image/png' }), 'man-hinh.png');
    const response = await fetch(url('/user-feedback'), {
      method: 'POST',
      headers: { authorization: `Bearer ${teacher.accessToken}` },
      body: form,
    });
    assert.equal(response.status, 201);
    const created = (await response.json()) as { id: string; attachment_name: string };
    assert.equal(created.attachment_name, 'man-hinh.png');
    const download = (token: string) =>
      fetch(url(`/user-feedback/${created.id}/attachment`), { headers: { authorization: `Bearer ${token}` } });
    const own = await download(teacher.accessToken);
    assert.equal(own.status, 200);
    assert.equal(own.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await own.arrayBuffer()), PNG);
    assert.equal((await download(principal.accessToken)).status, 200);
    assert.equal((await download(otherTeacher.accessToken)).status, 404);

    const textForm = new FormData();
    textForm.set('feedback_type', 'bug');
    textForm.set('title', 'Tệp không phải ảnh');
    textForm.set('content', 'Nội dung');
    textForm.set('attachment', new Blob(['xin chào'], { type: 'image/png' }), 'gia.png');
    const rejected = await fetch(url('/user-feedback'), {
      method: 'POST',
      headers: { authorization: `Bearer ${teacher.accessToken}` },
      body: textForm,
    });
    assert.equal(rejected.status, 400);
  });

  it('CT-15g-5: chỉ người có quyền xử lý ý kiến mới xem tất cả, đổi trạng thái, trả lời', async () => {
    assert.equal((await sendJson('GET', url('/user-feedback'), teacher.accessToken)).status, 403);
    assert.equal(
      (await sendJson('PUT', url(`/user-feedback/${teacherFeedbackId}`), teacher.accessToken, { status: 'resolved' }))
        .status,
      403,
    );
    for (const manager of [principal, platformAdministrator]) {
      const all = await sendJson('GET', url('/user-feedback'), manager.accessToken);
      assert.equal(all.status, 200);
      assert.ok((all.body as unknown as Array<{ id: string }>).some((item) => item.id === teacherFeedbackId));
    }
    assert.equal((await sendJson('GET', url('/user-feedback?status=xong'), principal.accessToken)).status, 400);
  });

  it('CT-15g-6: trả lời, đổi trạng thái; người gửi thấy câu trả lời và nhận thông báo trong ứng dụng', async () => {
    const processing = await sendJson('PUT', url(`/user-feedback/${teacherFeedbackId}`), principal.accessToken, {
      status: 'in_progress',
    });
    assert.equal(processing.status, 200);
    assert.equal(processing.body.status, 'in_progress');
    assert.equal(processing.body.reply, null);
    const inProgress = await sendJson('GET', url('/user-feedback?status=in_progress'), principal.accessToken);
    assert.deepEqual(
      (inProgress.body as unknown as Array<{ id: string }>).map((item) => item.id),
      [teacherFeedbackId],
    );

    const replied = await sendJson('PUT', url(`/user-feedback/${teacherFeedbackId}`), principal.accessToken, {
      status: 'resolved',
      reply: 'Đã sửa lỗi lưu hồ sơ',
    });
    assert.equal(replied.status, 200);
    assert.equal(replied.body.status, 'resolved');
    assert.equal(replied.body.reply, 'Đã sửa lỗi lưu hồ sơ');
    assert.ok(replied.body.replied_by_name);
    assert.ok(replied.body.replied_at);

    const own = await sendJson('GET', url('/me/user-feedback'), teacher.accessToken);
    const mine = (own.body as unknown as Array<Record<string, unknown>>).find((item) => item.id === teacherFeedbackId);
    assert.equal(mine?.reply, 'Đã sửa lỗi lưu hồ sơ');
    assert.equal(mine?.status, 'resolved');

    const notifications = await sendJson('GET', url('/notifications'), teacher.accessToken);
    const list = notifications.body.notifications as Array<{ title: string; body: string; target_type: string }>;
    const notice = list.find((item) => item.target_type === 'feedback');
    assert.equal(notice?.title, 'Ý kiến phản hồi đã được trả lời');
    assert.match(notice?.body ?? '', /Đã sửa lỗi lưu hồ sơ/);
    const otherNotifications = await sendJson('GET', url('/notifications'), otherTeacher.accessToken);
    assert.equal(
      (otherNotifications.body.notifications as Array<{ target_type: string }>).some(
        (item) => item.target_type === 'feedback',
      ),
      false,
    );

    // Lưu lại đúng câu trả lời cũ thì không báo lần nữa
    await sendJson('PUT', url(`/user-feedback/${teacherFeedbackId}`), principal.accessToken, {
      reply: 'Đã sửa lỗi lưu hồ sơ',
    });
    const again = await sendJson('GET', url('/notifications'), teacher.accessToken);
    assert.equal(
      (again.body.notifications as Array<{ target_type: string }>).filter((item) => item.target_type === 'feedback')
        .length,
      1,
    );
  });

  it('CT-15g-7: ý kiến không tồn tại trả 404', async () => {
    const missing = await sendJson(
      'PUT',
      url('/user-feedback/00000000-0000-4000-8000-000000000000'),
      principal.accessToken,
      { status: 'resolved' },
    );
    assert.equal(missing.status, 404);
  });

  it(`CT-15g-8: gửi quá ${MAXIMUM_FEEDBACK_PER_HOUR} ý kiến trong một giờ bị chặn; sau một giờ gửi lại được`, async () => {
    const sender = await environment.loginAs('VT-07', null);
    for (let index = 0; index < MAXIMUM_FEEDBACK_PER_HOUR; index += 1) {
      const created = await sendJson('POST', url('/user-feedback'), sender.accessToken, {
        ...validInput,
        title: `Ý kiến ${index + 1}`,
      });
      assert.equal(created.status, 201);
    }
    const blocked = await sendJson('POST', url('/user-feedback'), sender.accessToken, validInput);
    assert.equal(blocked.status, 429);
    assert.equal(errorOf(blocked.body).code, 'ERR_RATE_LIMIT');
    assert.equal(errorOf(blocked.body).rule_code, 'YCTD-110');
    assert.ok(Number(blocked.body.error?.retry_after_seconds) > 0);
    // Người khác không bị ảnh hưởng
    assert.equal((await sendJson('POST', url('/user-feedback'), otherTeacher.accessToken, validInput)).status, 201);

    await sql`update feedback set created_at = now() - interval '61 minutes' where user_id = ${sender.userId}`.execute(
      environment.system,
    );
    assert.equal((await sendJson('POST', url('/user-feedback'), sender.accessToken, validInput)).status, 201);
  });
});
