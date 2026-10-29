import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Chương trình gia sư trong trường (DT-27 phần 27b, YCTD-252; tài liệu 47 mục 19.2, 19.5). Khối số giữ sẵn năm học 0152 đến 0154.
// Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở chỗ kế hoạch chưa chốt:
// - `tutoring_rules`: số liệu của quy định dạy thêm là dữ liệu có ngày hiệu lực (số tiết tối đa mỗi tuần mỗi môn với nội dung
//   `curriculum`, cấp học không được tổ chức `curriculum`, độ dài một tiết mặc định theo cấp khi trường chưa khai khung giờ tiết);
//   dòng đầu theo Thông tư 19/2026/TT-BGDĐT (hiệu lực 15/05/2026) và Thông tư 29/2024/TT-BGDĐT (Tiểu học, chưa xác minh bản gốc);
//   văn bản đổi thì thêm dòng mới bằng YCTD, không sửa mã;
// - `tutoring_programs`: chương trình có loại nội dung bắt buộc (`curriculum` là môn trong chương trình chịu Thông tư 29,
//   `enrichment` là bổ trợ ngoài chương trình), nhóm đối tượng với `curriculum`, có thu tiền hay không (`curriculum` luôn không,
//   kiểm ở máy chủ và ở ràng buộc của bảng), hình thức, ngày bắt đầu, kết thúc, trạng thái duyệt; mẫu đơn đăng ký là văn bản của
//   chương trình, đơn lưu bản chụp văn bản lúc gửi;
// - `tutoring_program_teachers`, `tutoring_program_classes`: giáo viên dạy và lớp đối tượng;
// - `tutoring_program_candidates`: danh sách học sinh được đăng ký do giáo viên xác nhận (gợi ý từ kết quả môn học chưa đạt của
//   sổ điểm); chương trình có danh sách thì chỉ học sinh trong danh sách đăng ký được.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('tutoring_rules')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('effective_from', 'date', (column) => column.notNull().unique())
      .addColumn('max_curriculum_periods_per_week', 'integer', (column) => column.notNull())
      .addColumn('curriculum_blocked_levels', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('default_period_minutes', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('legal_basis', 'text', (column) => column.notNull())
      .addColumn('created_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('tutoring_rules_periods_check', sql`max_curriculum_periods_per_week between 0 and 20`)
      .execute();
    await database
      .insertInto('tutoring_rules' as never)
      .values({
        effective_from: '2026-05-15',
        max_curriculum_periods_per_week: 2,
        curriculum_blocked_levels: JSON.stringify(['TH']),
        default_period_minutes: JSON.stringify({ TH: 35, THCS: 45, THPT: 45 }),
        legal_basis:
          'Thông tư 29/2024/TT-BGDĐT sửa đổi bởi Thông tư 19/2026/TT-BGDĐT: dạy thêm trong nhà trường không thu tiền, mỗi môn không quá 02 tiết/tuần, không dạy thêm cho học sinh tiểu học',
        created_by_name: 'Hệ thống',
      } as never)
      .execute();

    await database.schema
      .createTable('tutoring_programs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('school_level', 'text', (column) => column.notNull())
      .addColumn('subject_id', 'uuid', (column) => column.references('subjects.id'))
      .addColumn('topic', 'text')
      .addColumn('content_type', 'text', (column) => column.notNull())
      .addColumn('audience', 'text')
      .addColumn('charges_fee', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('delivery', 'text', (column) => column.notNull().defaultTo('live_video'))
      .addColumn('description', 'text')
      .addColumn('registration_form', 'text', (column) => column.notNull())
      .addColumn('max_students', 'integer')
      .addColumn('starts_on', 'date', (column) => column.notNull())
      .addColumn('ends_on', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('reject_reason', 'text')
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_by_name', 'text')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('tutoring_programs_level_check', sql`school_level in ('MN', 'TH', 'THCS', 'THPT')`)
      .addCheckConstraint('tutoring_programs_content_check', sql`content_type in ('curriculum', 'enrichment')`)
      .addCheckConstraint(
        'tutoring_programs_audience_check',
        sql`audience is null or audience in ('below_standard', 'gifted', 'final_year_review')`,
      )
      .addCheckConstraint(
        'tutoring_programs_curriculum_check',
        sql`content_type <> 'curriculum' or (charges_fee = false and audience is not null and subject_id is not null)`,
      )
      .addCheckConstraint('tutoring_programs_delivery_check', sql`delivery in ('live_video', 'course', 'qa', 'mixed')`)
      .addCheckConstraint(
        'tutoring_programs_status_check',
        sql`status in ('draft', 'submitted', 'approved', 'rejected', 'closed')`,
      )
      .addCheckConstraint('tutoring_programs_dates_check', sql`ends_on >= starts_on`)
      .execute();

    await database.schema
      .createTable('tutoring_program_teachers')
      .addColumn('program_id', 'uuid', (column) =>
        column.notNull().references('tutoring_programs.id').onDelete('cascade'),
      )
      .addColumn('teacher_user_id', 'uuid', (column) => column.notNull())
      .addColumn('teacher_name', 'text', (column) => column.notNull())
      .addPrimaryKeyConstraint('tutoring_program_teachers_pkey', ['program_id', 'teacher_user_id'])
      .execute();
    await database.schema
      .createTable('tutoring_program_classes')
      .addColumn('program_id', 'uuid', (column) =>
        column.notNull().references('tutoring_programs.id').onDelete('cascade'),
      )
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addPrimaryKeyConstraint('tutoring_program_classes_pkey', ['program_id', 'class_id'])
      .execute();
    await database.schema
      .createTable('tutoring_program_candidates')
      .addColumn('program_id', 'uuid', (column) =>
        column.notNull().references('tutoring_programs.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('source', 'text', (column) => column.notNull().defaultTo('manual'))
      .addColumn('confirmed_by_name', 'text', (column) => column.notNull())
      .addColumn('confirmed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('tutoring_program_candidates_pkey', ['program_id', 'child_id'])
      .addCheckConstraint('tutoring_program_candidates_source_check', sql`source in ('suggested', 'manual')`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('tutoring_program_candidates').execute();
    await database.schema.dropTable('tutoring_program_classes').execute();
    await database.schema.dropTable('tutoring_program_teachers').execute();
    await database.schema.dropTable('tutoring_programs').execute();
    await database.schema.dropTable('tutoring_rules').execute();
  },
};
