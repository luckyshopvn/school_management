import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  createDatabase,
  MEAL_SERVICE_ID,
  replaceDatabaseName,
  type SchoolYearDatabase,
} from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Hoạt động, hình ảnh, tin tức, thư viện, ngoại khóa (DT-10 phần 10e, YCTD-78); kịch bản CT-069, CT-070, CT-071, CT-072,
// CT-121, CT-122, CT-123, CT-130, CT-131. Năm học kiểm thử gồm ba tháng trước tháng hiện tại (đã qua, tính được học phí)
// tới hết ba tháng sau
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function shiftMonth(offset: number) {
  const base = new Date(Date.UTC(Number(vietnamToday.slice(0, 4)), Number(vietnamToday.slice(5, 7)) - 1 + offset, 1));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1;
  const period = `${year}-${String(month).padStart(2, '0')}`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { period, year, month, first: `${period}-01`, last: `${period}-${String(lastDay).padStart(2, '0')}` };
}

type Activity = {
  id: string;
  status: string;
  media: Array<{ id: string; excluded: boolean; unconsented_children: Array<{ full_name: string }> }>;
  like_count: number;
  comment_count: number;
};
type InvoiceDetail = {
  id: string;
  invoice_kind: string;
  total_amount: number;
  items: Array<{ item_type: string; amount: number; description: string }>;
  discounts: unknown[];
};

describe('Hoạt động, hình ảnh, tin tức, thư viện, ngoại khóa', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let academicYearId = '';
  let unitId = '';
  let categoryId = '';
  let activityId = '';
  let newsId = '';
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  const media: Record<string, string> = {};
  const [monthA, monthB, monthC] = [-3, -2, -1].map(shiftMonth) as [
    ReturnType<typeof shiftMonth>,
    ReturnType<typeof shiftMonth>,
    ReturnType<typeof shiftMonth>,
  ];

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  async function upload(path: string, accessToken: string, fields: Record<string, string>) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
    form.append('file', new Blob([PNG], { type: 'image/png' }), 'anh.png');
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }
  const download = async (path: string, accessToken: string) =>
    (await fetch(`${environment.baseUrl}${path}`, { headers: { authorization: `Bearer ${accessToken}` } })).status;

  // Chốt danh sách đăng ký của kỳ rồi chốt điểm danh những ngày máy chủ báo thiếu (Q-151), mọi trẻ có mặt
  async function prepare(period: string) {
    const calculate = () => api('POST', '/fee-calculations', token('accountant'), { org_unit_id: unitId, period });
    const locked = await api('POST', '/service-registrations/lock', token('accountant'), {
      org_unit_id: unitId,
      period,
    });
    assert.equal(locked.status, 200, JSON.stringify(locked.body));
    const blocked = await calculate();
    if (blocked.status !== 422 || errorOf(blocked.body).rule_code !== 'Q-151') {
      return blocked;
    }
    const classByName = new Map(Object.entries(classes));
    for (const detail of errorOf(blocked.body).details ?? []) {
      const classId = classByName.get(detail.field) ?? '';
      await schoolYear
        .insertInto('attendance_days')
        .values({
          class_id: classId,
          attendance_date: detail.message,
          status: 'locked',
          locked_by: principal.userId,
          locked_at: new Date(),
        })
        .execute();
      const enrolled = await schoolYear
        .selectFrom('class_enrollments')
        .select('child_id')
        .where('class_id', '=', classId)
        .execute();
      if (enrolled.length > 0) {
        await schoolYear
          .insertInto('attendance_records')
          .values(
            enrolled.map((row) => ({
              child_id: row.child_id,
              class_id: classId,
              org_unit_id: unitId,
              attendance_date: detail.message,
              status: 'present' as const,
              note: null,
              source: 'manager' as const,
              recorded_by: principal.userId,
              recorded_at: new Date(),
            })),
          )
          .execute();
      }
    }
    return calculate();
  }

  async function invoicesOf(child: string, period: string): Promise<InvoiceDetail[]> {
    const list = (await api('GET', `/invoices?org_unit_id=${unitId}&period=${period}`, token('accountant')))
      .body as unknown as Array<{ id: string; child_id: string }>;
    const result: InvoiceDetail[] = [];
    for (const row of list.filter((invoice) => invoice.child_id === children[child])) {
      result.push((await api('GET', `/invoices/${row.id}`, token('accountant'))).body as unknown as InvoiceDetail);
    }
    return result;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, 'Năm học hoạt động', {
      first_term: { start_date: monthA.first, end_date: monthC.last },
      second_term: { start_date: addDays(monthC.last, 1), end_date: addDays(vietnamToday, 120) },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    await api('POST', '/org-units', principal.accessToken, { code: 'TC', name: 'TC', unit_type: 'truong_chinh' });
    unitId = (
      await api('POST', '/org-units', principal.accessToken, { code: 'ĐT-A1', name: 'ĐT-A1', unit_type: 'diem_truong' })
    ).body.id as string;
    users.manager = await environment.loginAs('VT-03', unitId);
    users.homeroom = await environment.loginAs('VT-07', unitId);
    users.subjectTeacher = await environment.loginAs('VT-08', unitId);
    users.accountant = await environment.loginAs('VT-04', unitId);
    for (const name of ['parentA', 'parentB', 'parentC']) {
      users[name] = await environment.loginAs('VT-14', unitId);
    }
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'MAM',
      name: 'Mầm',
      age_from_months: 36,
      age_to_months: 71,
    });
    for (const code of ['MAM-1', 'MAM-2']) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: 'MAM',
            max_size: 25,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    for (const [teacher, role] of [
      ['homeroom', 'homeroom'],
      ['subjectTeacher', 'subject'],
    ] as const) {
      await schoolYear
        .insertInto('class_staff_assignments')
        .values({
          class_id: classes['MAM-1'] ?? '',
          staff_user_id: users[teacher]?.userId ?? '',
          staff_name: teacher,
          assignment_role: role,
          subject_name: role === 'subject' ? 'Âm nhạc' : null,
          from_date: monthA.first,
        })
        .execute();
    }
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [key, parent, consent, classCode] of [
      ['A', 'parentA', 'granted', 'MAM-1'],
      ['B', 'parentB', 'pending', 'MAM-1'],
      ['C', 'parentC', 'granted', 'MAM-2'],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Trẻ ${key}`,
          dob: '2022-03-01',
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: consent,
          status: 'active',
          enroll_date: monthA.first,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classes[classCode] ?? '', from_date: monthA.first })
        .execute();
      const guardian = await schoolYear
        .insertInto('guardians')
        .values({
          full_name: `Mẹ ${key}`,
          phone: `090${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`,
          user_id: users[parent]?.userId ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('child_guardians')
        .values({
          child_id: child.id,
          guardian_id: guardian.id,
          relationship_item_id: relationship.id,
          is_primary: true,
        })
        .execute();
    }
    const schedule = await api('POST', '/fee-schedules', token('accountant'), {
      name: 'Biểu phí',
      effective_from: monthA.first,
      items: [
        { grade_level: 'MAM', fee_type: 'tuition', amount: 2_000_000 },
        { grade_level: 'MAM', fee_type: 'service', service_id: MEAL_SERVICE_ID, amount: 30_000 },
      ],
    });
    assert.equal(schedule.status, 201, JSON.stringify(schedule.body));
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('P14-03: quản lý đơn vị lập danh mục hoạt động; giáo viên không lập được; trùng tên bị từ chối', async () => {
    const created = await api('POST', '/activity-categories', token('manager'), {
      org_unit_id: unitId,
      name: 'Hoạt động sáng tạo',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    categoryId = created.body.id as string;
    assert.equal(
      (await api('POST', '/activity-categories', token('homeroom'), { org_unit_id: unitId, name: 'Khác' })).status,
      403,
    );
    assert.equal(
      (await api('POST', '/activity-categories', token('manager'), { org_unit_id: unitId, name: 'Hoạt động sáng tạo' }))
        .status,
      409,
    );
    const listed = await api('GET', `/activity-categories?org_unit_id=${unitId}`, token('homeroom'));
    assert.equal((listed.body as unknown as unknown[]).length, 1);
  });

  it('CT-069: giáo viên tạo hoạt động của lớp ở trạng thái chờ duyệt, chưa hiển thị cho phụ huynh', async () => {
    const created = await api('POST', '/activities', token('homeroom'), {
      class_id: classes['MAM-1'],
      category_id: categoryId,
      title: 'Bé tập làm bánh',
      content: 'Các bé nhào bột và tạo hình bánh quy',
      activity_date: vietnamToday,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.status, 'pending');
    activityId = created.body.id as string;
    const parentList = (await api('GET', '/activities', token('parentA'))).body as unknown as Activity[];
    assert.equal(parentList.length, 0);
    assert.equal((await api('GET', `/activities/${activityId}`, token('parentA'))).status, 403);
    // Giáo viên không phụ trách lớp thì không tạo được
    const other = await api('POST', '/activities', token('homeroom'), {
      class_id: classes['MAM-2'],
      category_id: categoryId,
      title: 'Lớp khác',
      content: 'Nội dung',
      activity_date: vietnamToday,
    });
    assert.equal(other.status, 403);
    assert.equal(
      (await api('POST', '/activities', token('homeroom'), { class_id: classes['MAM-1'], category_id: categoryId }))
        .status,
      400,
    );
  });

  it('CT-071: tải ảnh có trẻ chưa đồng ý hình ảnh thì cảnh báo, hình đó không được công bố', async () => {
    const mixed = await upload(`/activities/${activityId}/media`, token('homeroom'), {
      child_ids: `${children.A},${children.B}`,
      caption: 'Cả nhóm',
    });
    assert.equal(mixed.status, 201, JSON.stringify(mixed.body));
    const warnings = mixed.body.warnings as Array<{ child_id: string }>;
    assert.deepEqual(
      warnings.map((warning) => warning.child_id),
      [children.B],
    );
    assert.equal((mixed.body.media as { excluded: boolean }).excluded, true);
    media.mixed = (mixed.body.media as { id: string }).id;
    const consented = await upload(`/activities/${activityId}/media`, token('homeroom'), {
      child_ids: children.A ?? '',
    });
    assert.equal(consented.status, 201, JSON.stringify(consented.body));
    assert.deepEqual(consented.body.warnings, []);
    media.consented = (consented.body.media as { id: string }).id;
    // Trẻ lớp khác không gắn được
    assert.equal(
      (await upload(`/activities/${activityId}/media`, token('homeroom'), { child_ids: children.C ?? '' })).status,
      400,
    );
  });

  it('CT-072: giáo viên bộ môn duyệt hoạt động thì bị từ chối không có quyền', async () => {
    const response = await api('POST', `/activities/${activityId}/approve`, token('subjectTeacher'));
    assert.equal(response.status, 403);
    assert.equal(errorOf(response.body).code, 'ERR_FORBIDDEN');
    assert.equal((await api('POST', `/activities/${activityId}/approve`, token('homeroom'))).status, 403);
  });

  it('CT-070: quản lý duyệt thì phụ huynh của lớp thấy hoạt động kèm hình; hình có trẻ chưa đồng ý không hiển thị', async () => {
    const approved = await api('POST', `/activities/${activityId}/approve`, token('manager'));
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.status, 'published');
    const parentList = (await api('GET', '/activities', token('parentA'))).body as unknown as Activity[];
    assert.equal(parentList.length, 1);
    assert.deepEqual(
      parentList[0]?.media.map((item) => item.id),
      [media.consented],
    );
    assert.equal(await download(`/activity-media/${media.consented}/file`, token('parentA')), 200);
    assert.equal(await download(`/activity-media/${media.mixed}/file`, token('parentA')), 422);
    assert.equal(await download(`/activity-media/${media.mixed}/file`, token('homeroom')), 200);
    // Phụ huynh lớp khác không thấy
    assert.equal(((await api('GET', '/activities', token('parentC'))).body as unknown as Activity[]).length, 0);
    assert.equal((await api('GET', `/activities/${activityId}`, token('parentC'))).status, 403);
    // Nhân sự thấy cả hình bị loại trừ
    const staffView = (await api('GET', `/activities/${activityId}`, token('manager'))).body as unknown as Activity;
    assert.equal(staffView.media.length, 2);
    assert.equal(staffView.media.find((item) => item.id === media.mixed)?.unconsented_children[0]?.full_name, 'Trẻ B');
    const liked = await api('POST', `/activities/${activityId}/like`, token('parentA'));
    assert.equal(liked.body.like_count, 1);
    const commented = await api('POST', `/activities/${activityId}/comments`, token('parentA'), {
      content: 'Con rất vui',
    });
    assert.equal(commented.status, 201, JSON.stringify(commented.body));
    assert.equal(commented.body.is_parent, true);
    // Đã công bố thì giáo viên không sửa được (QT-10 E6)
    const edit = await api('PATCH', `/activities/${activityId}`, token('homeroom'), { title: 'Sửa' });
    assert.equal(errorOf(edit.body).rule_code, 'BR-64');
  });

  it('BR-65: phụ huynh rút đồng ý hình ảnh thì hình đã công bố có trẻ tự ẩn', async () => {
    await schoolYear
      .updateTable('children')
      .set({ photo_consent: 'refused' })
      .where('id', '=', children.A ?? '')
      .execute();
    const parentList = (await api('GET', '/activities', token('parentA'))).body as unknown as Activity[];
    assert.equal(parentList[0]?.media.length, 0);
    assert.equal(await download(`/activity-media/${media.consented}/file`, token('parentA')), 422);
    await schoolYear
      .updateTable('children')
      .set({ photo_consent: 'granted' })
      .where('id', '=', children.A ?? '')
      .execute();
  });

  it('Q-72: ẩn hoạt động đã công bố phải có lý do; phụ huynh không thấy; công bố lại', async () => {
    assert.equal((await api('POST', `/activities/${activityId}/hide`, token('manager'), {})).status, 400);
    const hidden = await api('POST', `/activities/${activityId}/hide`, token('manager'), { reason: 'Ảnh mờ' });
    assert.equal(hidden.body.status, 'hidden');
    assert.equal(((await api('GET', '/activities', token('parentA'))).body as unknown as Activity[]).length, 0);
    const again = await api('POST', `/activities/${activityId}/republish`, token('manager'));
    assert.equal(again.body.status, 'published');
  });

  it('CT-123: phụ huynh bình luận tin tức; xóa bình luận bị chặn; quản lý chỉ ẩn kèm lý do, bình luận vẫn lưu', async () => {
    const created = await api('POST', '/news', token('manager'), {
      org_unit_id: unitId,
      title: 'Lễ hội trung thu',
      content: 'Mời phụ huynh tham dự',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    newsId = created.body.id as string;
    assert.equal(((await api('GET', '/news', token('parentA'))).body as unknown as unknown[]).length, 0);
    assert.equal((await api('POST', `/news/${newsId}/publish`, token('manager'))).status, 200);
    assert.equal(((await api('GET', '/news', token('parentA'))).body as unknown as unknown[]).length, 1);
    // Tin theo lớp MAM-2 không hiển thị cho phụ huynh lớp MAM-1 (BR-69)
    const classNews = await api('POST', '/news', token('manager'), {
      org_unit_id: unitId,
      title: 'Tin lớp MAM-2',
      content: 'Nội dung',
      scope_type: 'class',
      scope_id: classes['MAM-2'],
    });
    await api('POST', `/news/${classNews.body.id}/publish`, token('manager'));
    assert.equal(((await api('GET', '/news', token('parentA'))).body as unknown as unknown[]).length, 1);
    assert.equal(((await api('GET', '/news', token('parentC'))).body as unknown as unknown[]).length, 2);
    assert.equal(
      (await api('POST', '/news', token('homeroom'), { org_unit_id: unitId, title: 'X', content: 'Y' })).status,
      403,
    );

    const comment = await api('POST', '/content-comments', token('parentB'), {
      target_type: 'news',
      target_id: newsId,
      content: 'Tổ chức kém',
    });
    assert.equal(comment.status, 201, JSON.stringify(comment.body));
    const commentId = comment.body.id as string;
    const removed = await api('DELETE', `/content-comments/${commentId}`, token('manager'));
    assert.equal(removed.status, 422);
    assert.equal(errorOf(removed.body).rule_code, 'BR-66');
    assert.equal((await api('POST', `/comments/${commentId}/hide`, token('manager'), {})).status, 400);
    assert.equal((await api('POST', `/comments/${commentId}/hide`, token('parentA'), { reason: 'x' })).status, 403);
    const hidden = await api('POST', `/comments/${commentId}/hide`, token('manager'), {
      reason: 'Ngôn từ không phù hợp',
    });
    assert.equal(hidden.status, 200, JSON.stringify(hidden.body));
    const parentView = await api('GET', `/content-comments?target_type=news&target_id=${newsId}`, token('parentA'));
    assert.equal((parentView.body as unknown as unknown[]).length, 0);
    const managerView = (await api('GET', `/content-comments?target_type=news&target_id=${newsId}`, token('manager')))
      .body as unknown as Array<{ hidden_reason: string; content: string }>;
    assert.equal(managerView.length, 1);
    assert.equal(managerView[0]?.hidden_reason, 'Ngôn từ không phù hợp');
    assert.equal(managerView[0]?.content, 'Tổ chức kém');
  });

  it('P14-06, P14-09, P14-12: thư viện, album, hình tô màu theo phạm vi; giáo viên chỉ công bố cho lớp mình', async () => {
    const file = await upload('/content-files', token('homeroom'), { org_unit_id: unitId });
    assert.equal(file.status, 201, JSON.stringify(file.body));
    const fileId = file.body.id as string;
    const topic = await api('POST', '/library-topics', token('manager'), {
      org_unit_id: unitId,
      name: 'Truyện cổ tích',
    });
    assert.equal(topic.status, 201, JSON.stringify(topic.body));
    const album = await api('POST', '/library-albums', token('manager'), {
      org_unit_id: unitId,
      title: 'Truyện tháng mười',
      topic_id: topic.body.id,
    });
    assert.equal(album.status, 201, JSON.stringify(album.body));
    const unitScoped = await api('POST', '/library-items', token('homeroom'), {
      org_unit_id: unitId,
      title: 'Tấm Cám',
      file_id: fileId,
    });
    assert.equal(unitScoped.status, 403);
    const item = await api('POST', '/library-items', token('homeroom'), {
      org_unit_id: unitId,
      title: 'Tấm Cám',
      file_id: fileId,
      topic_id: topic.body.id,
      album_id: album.body.id,
      scope_type: 'class',
      scope_id: classes['MAM-1'],
    });
    assert.equal(item.status, 201, JSON.stringify(item.body));
    assert.equal(await download(`/content-files/${fileId}`, token('parentA')), 403);
    assert.equal((await api('POST', `/library-items/${item.body.id}/publish`, token('homeroom'))).status, 200);
    assert.equal(await download(`/content-files/${fileId}`, token('parentA')), 200);
    assert.equal(await download(`/content-files/${fileId}`, token('parentC')), 403);
    const albums = (await api('GET', '/library-albums', token('parentA'))).body as unknown as Array<{
      published_item_count: number;
    }>;
    assert.equal(albums[0]?.published_item_count, 1);
    assert.equal(((await api('GET', '/library-albums', token('parentC'))).body as unknown as unknown[]).length, 0);

    const page = await api('POST', '/coloring-pages', token('manager'), {
      org_unit_id: unitId,
      title: 'Con mèo',
      topic: 'Động vật',
      age_group: '3-4 tuổi',
      file_id: fileId,
    });
    assert.equal(page.status, 201, JSON.stringify(page.body));
    await api('POST', `/coloring-pages/${page.body.id}/publish`, token('manager'));
    assert.equal(((await api('GET', '/coloring-pages', token('parentC'))).body as unknown as unknown[]).length, 1);
  });

  it('CT-121: đăng ký hoạt động ngoại khóa đã đủ chỉ tiêu thì bị từ chối, báo hết chỗ', async () => {
    const created = await api('POST', '/extracurricular-activities', token('manager'), {
      org_unit_id: unitId,
      name: 'Bơi lội',
      start_date: vietnamToday,
      end_date: addDays(vietnamToday, 60),
      quota: 1,
      fee_type: 'free',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.id as string;
    // Chưa công bố thì chưa đăng ký được
    assert.equal(
      errorOf(
        (
          await api('POST', `/extracurricular-activities/${id}/registrations`, token('parentA'), {
            child_id: children.A,
          })
        ).body,
      ).rule_code,
      'P14-11',
    );
    await api('POST', `/extracurricular-activities/${id}/publish`, token('manager'));
    const first = await api('POST', `/extracurricular-activities/${id}/registrations`, token('parentA'), {
      child_id: children.A,
    });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const full = await api('POST', `/extracurricular-activities/${id}/registrations`, token('parentB'), {
      child_id: children.B,
    });
    assert.equal(full.status, 422);
    assert.equal(errorOf(full.body).rule_code, 'P14-11');
    assert.match((full.body.error as { message: string }).message, /hết chỗ/);
    // Phụ huynh không đăng ký cho con người khác
    assert.equal(
      (await api('POST', `/extracurricular-activities/${id}/registrations`, token('parentA'), { child_id: children.B }))
        .status,
      403,
    );
    const listed = (await api('GET', '/extracurricular-activities', token('parentB'))).body as unknown as Array<{
      remaining: number;
    }>;
    assert.equal(listed[0]?.remaining, 0);
  });

  it('CT-122: đăng ký ngoại khóa có phí khi hóa đơn chính của kỳ đã phát hành thì phí vào hóa đơn bổ sung', async () => {
    const current = shiftMonth(0);
    await schoolYear
      .insertInto('invoices')
      .values({
        code: 'HD-900001',
        child_id: children.B ?? '',
        org_unit_id: unitId,
        period_year: current.year,
        period_month: current.month,
        invoice_kind: 'main',
        status: 'issued',
        total_amount: 2_000_000,
        basis: JSON.stringify({ school_days: 20 }),
        review_flags: JSON.stringify([]),
        due_date: addDays(vietnamToday, 10),
        issued_at: new Date(),
        issued_by: principal.userId,
      })
      .execute();
    const created = await api('POST', '/extracurricular-activities', token('manager'), {
      org_unit_id: unitId,
      name: 'Tham quan nông trại',
      start_date: vietnamToday,
      end_date: addDays(vietnamToday, 30),
      quota: 20,
      fee_type: 'per_activity',
      fee_amount: 150_000,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    await api('POST', `/extracurricular-activities/${created.body.id}/publish`, token('manager'));
    const registered = await api(
      'POST',
      `/extracurricular-activities/${created.body.id}/registrations`,
      token('parentB'),
      {
        child_id: children.B,
      },
    );
    assert.equal(registered.status, 201, JSON.stringify(registered.body));
    assert.equal((registered.body.charge as { invoice_kind: string }).invoice_kind, 'supplementary');
    const invoices = await invoicesOf('B', current.period);
    const supplementary = invoices.find((invoice) => invoice.invoice_kind === 'supplementary');
    assert.equal(supplementary?.total_amount, 150_000);
    assert.deepEqual(
      supplementary?.items.map((item) => [item.item_type, item.amount]),
      [['extracurricular', 150_000]],
    );
    // Hóa đơn chính giữ nguyên (BR-85)
    assert.equal(invoices.find((invoice) => invoice.invoice_kind === 'main')?.total_amount, 2_000_000);
  });

  it('CT-130, CT-131: phí ngoại khóa theo tháng có trong hóa đơn kỳ; nghỉ ba buổi, thôi giữa tháng vẫn thu đủ tháng', async () => {
    const created = await api('POST', '/extracurricular-activities', token('homeroom'), {
      org_unit_id: unitId,
      name: 'Năng khiếu vẽ',
      start_date: monthA.first,
      end_date: addDays(vietnamToday, 90),
      quota: 10,
      fee_type: 'monthly',
      fee_amount: 300_000,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.id as string;
    await api('POST', `/extracurricular-activities/${id}/publish`, token('homeroom'));
    const registrations: Record<string, string> = {};
    for (const key of ['A', 'C']) {
      const registered = await api('POST', `/extracurricular-activities/${id}/registrations`, token('homeroom'), {
        child_id: children[key],
      });
      if (key === 'C') {
        // Giáo viên không phụ trách vẫn đăng ký được trong đơn vị nhờ quyền ngoại khóa
        assert.equal(registered.status, 201, JSON.stringify(registered.body));
      }
      registrations[key] = registered.body.id as string;
    }
    // Đăng ký có hiệu lực từ đầu tháng A (dữ liệu kiểm thử lùi ngày để tính được kỳ đã qua)
    await schoolYear
      .updateTable('extracurricular_registrations')
      .set({ effective_from: monthA.first })
      .where('activity_id', '=', id)
      .execute();

    const runA = await prepare(monthA.period);
    assert.equal(runA.status, 201, JSON.stringify(runA.body));
    const invoiceA = (await invoicesOf('A', monthA.period))[0];
    const line = invoiceA?.items.find((item) => item.item_type === 'extracurricular');
    assert.equal(line?.amount, 300_000);
    assert.equal(line?.description, 'Ngoại khóa: Năng khiếu vẽ');
    assert.equal(
      invoiceA?.total_amount,
      (invoiceA?.items ?? []).reduce((sum, item) => sum + item.amount, 0),
    );

    // CT-131: trẻ C thôi giữa tháng B và nghỉ ba buổi trong tháng B
    const withdrawn = await api('POST', `/extracurricular-registrations/${registrations.C}/withdraw`, token('parentC'));
    assert.equal(withdrawn.status, 200, JSON.stringify(withdrawn.body));
    await schoolYear
      .updateTable('extracurricular_registrations')
      .set({ effective_to: addDays(monthB.first, 14) })
      .where('id', '=', registrations.C ?? '')
      .execute();
    const runB = await prepare(monthB.period);
    assert.equal(runB.status, 201, JSON.stringify(runB.body));
    const absentDays = (
      await schoolYear
        .selectFrom('attendance_records')
        .select('id')
        .where('child_id', '=', children.C ?? '')
        .where('attendance_date', '>=', monthB.first)
        .where('attendance_date', '<=', monthB.last)
        .limit(3)
        .execute()
    ).map((row) => row.id);
    assert.equal(absentDays.length, 3);
    await schoolYear
      .updateTable('attendance_records')
      .set({ status: 'absent_notified' })
      .where('id', 'in', absentDays)
      .execute();
    const rerun = await api('POST', '/fee-calculations', token('accountant'), {
      org_unit_id: unitId,
      period: monthB.period,
    });
    assert.equal(rerun.status, 201, JSON.stringify(rerun.body));
    const invoiceB = (await invoicesOf('C', monthB.period))[0];
    const lines = invoiceB?.items.filter((item) => item.item_type === 'extracurricular') ?? [];
    assert.deepEqual(
      lines.map((item) => item.amount),
      [300_000],
    );
    assert.ok((invoiceB?.items ?? []).every((item) => item.amount >= 0));
    assert.equal(invoiceB?.discounts.length, 0);

    // Tháng sau khi thôi không còn phí; trẻ A vẫn thu
    const runC = await prepare(monthC.period);
    assert.equal(runC.status, 201, JSON.stringify(runC.body));
    const invoiceC = (await invoicesOf('C', monthC.period))[0];
    assert.equal(
      invoiceC?.items.some((item) => item.item_type === 'extracurricular'),
      false,
    );
    const invoiceAC = (await invoicesOf('A', monthC.period))[0];
    assert.equal(
      invoiceAC?.items.some((item) => item.item_type === 'extracurricular'),
      true,
    );
  });
});
