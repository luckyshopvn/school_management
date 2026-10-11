import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Trẻ chưa thôi học và chưa ra trường được chuyển sang năm học mới; trẻ đã thôi học, đã ra trường ở lại năm cũ (BR-89)
export const CARRIED_CHILD_STATUSES = ['draft', 'pending', 'active', 'paused'] as const;

// Mở năm học mới thì chuyển hồ sơ trẻ chưa thôi học kèm phụ huynh, sức khỏe, đồng ý hình ảnh, người được ủy quyền đón,
// lớp đang học và lịch sử lớp gần nhất (GD-90), đăng ký dịch vụ gần nhất để dịch vụ không bắt buộc giữ tiếp cho tới khi
// hủy; giữ nguyên mã định danh (QĐ-17, YCTD-69). Lịch sử lớp đầy đủ, điểm danh, đón trả, nhật ký tra ở năm cũ. Chạy sau
// bước danh mục và bước khoản thu vì hồ sơ tham chiếu quan hệ phụ huynh, phòng học, dịch vụ
export const childrenTransitionStep: AcademicYearTransitionStep = {
  name: 'children',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;

    const children = await previous
      .selectFrom('children')
      .selectAll()
      .where('status', 'in', [...CARRIED_CHILD_STATUSES])
      .execute();
    if (children.length === 0) {
      return;
    }
    const childIds = children.map((child) => child.id);
    const histories = await previous
      .selectFrom('photo_consent_histories')
      .selectAll()
      .where('child_id', 'in', childIds)
      .execute();

    // Tệp chỉ chép dòng thông tin; nội dung tệp nằm ở kho tệp dùng chung nên không chép lại
    const fileIds = new Set<string>();
    for (const child of children) {
      fileIds.add(child.birth_certificate_file_id ?? '');
      fileIds.add(child.photo_consent_file_id ?? '');
    }
    for (const history of histories) {
      fileIds.add(history.file_id ?? '');
    }
    fileIds.delete('');
    if (fileIds.size > 0) {
      for (const row of await previous
        .selectFrom('files')
        .selectAll()
        .where('id', 'in', [...fileIds])
        .execute()) {
        await next.insertInto('files').values(row).execute();
      }
    }

    for (const child of children) {
      await next.insertInto('children').values(child).execute();
    }
    for (const row of await previous
      .selectFrom('health_profiles')
      .selectAll()
      .where('child_id', 'in', childIds)
      .execute()) {
      await next.insertInto('health_profiles').values(row).execute();
    }
    const links = await previous.selectFrom('child_guardians').selectAll().where('child_id', 'in', childIds).execute();
    const guardianIds = [...new Set(links.map((link) => link.guardian_id))];
    if (guardianIds.length > 0) {
      for (const row of await previous.selectFrom('guardians').selectAll().where('id', 'in', guardianIds).execute()) {
        await next.insertInto('guardians').values(row).execute();
      }
    }
    for (const link of links) {
      await next.insertInto('child_guardians').values(link).execute();
    }
    for (const history of histories) {
      await next.insertInto('photo_consent_histories').values(history).execute();
    }
    for (const row of await previous
      .selectFrom('authorized_pickups')
      .selectAll()
      .where('child_id', 'in', childIds)
      .where('status', '=', 'active')
      .execute()) {
      await next.insertInto('authorized_pickups').values(row).execute();
    }

    // Lớp đang mở và lớp của trẻ đang học chuyển sang năm mới; nhà trường lên lớp bằng chuyển lớp ở năm mới
    const enrollments = await previous
      .selectFrom('class_enrollments')
      .selectAll()
      .where('child_id', 'in', childIds)
      .where('is_current', '=', true)
      .execute();
    const classes = await previous
      .selectFrom('classes')
      .selectAll()
      .where((builder) =>
        enrollments.length > 0
          ? builder.or([
              builder('status', '=', 'active'),
              builder(
                'id',
                'in',
                enrollments.map((row) => row.class_id),
              ),
            ])
          : builder('status', '=', 'active'),
      )
      .execute();
    for (const row of classes) {
      await next
        .insertInto('classes')
        .values({ ...row, academic_year_id: context.academicYear.id })
        .execute();
    }
    if (classes.length > 0) {
      for (const row of await previous
        .selectFrom('class_staff_assignments')
        .selectAll()
        .where(
          'class_id',
          'in',
          classes.map((item) => item.id),
        )
        .where('status', '=', 'active')
        .execute()) {
        await next.insertInto('class_staff_assignments').values(row).execute();
      }
    }
    for (const row of enrollments) {
      await next.insertInto('class_enrollments').values(row).execute();
    }

    // Dịch vụ không bắt buộc giữ từ tháng gần nhất có đăng ký nên chỉ cần dòng gần nhất của mỗi trẻ, mỗi dịch vụ
    const registrations = await previous
      .selectFrom('service_registrations')
      .selectAll()
      .where('child_id', 'in', childIds)
      .orderBy('period_year', 'desc')
      .orderBy('period_month', 'desc')
      .execute();
    const latest = new Map<string, (typeof registrations)[number]>();
    for (const row of registrations) {
      const key = `${row.child_id}:${row.service_id}`;
      if (!latest.has(key)) {
        latest.set(key, row);
      }
    }
    for (const row of latest.values()) {
      await next.insertInto('service_registrations').values(row).execute();
    }
  },
};
