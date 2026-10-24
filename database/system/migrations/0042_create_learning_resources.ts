import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-22 phần 22h1 (YCTD-183): kho học liệu số của trường, phần lõi. Học liệu, giấy phép, chủ đề, bộ sưu tập không theo năm
// học nên ở cơ sở dữ liệu hệ thống; duyệt, báo lỗi, lượt xem theo năm ở năm học 0102. Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11:
// - Loại học liệu, giấy phép, chủ đề cấu hình được, có bộ mặc định; loại học liệu có thể buộc thêm bước Ban Giám hiệu.
// - Giấy phép: "chặn" thì không công bố; "chỉ cá nhân" (không rõ giấy phép) thì chỉ xem cá nhân; giấy phép có xin phép buộc
//   ghi nơi cấp phép và thêm bước Ban Giám hiệu.
// - Học liệu: metadata theo cấp, khối, môn (lưu mã và tên vì môn ở năm học), chủ đề, tuần, từ khoá, tác giả, ngôn ngữ, thời
//   lượng; giấy phép, nguồn gốc, người chịu trách nhiệm; phạm vi xem cá nhân, tổ, trường (giá trị liên trường `network` lưu sẵn
//   nhưng không bật, chờ DT-SaaS); trạng thái nháp, chờ tổ duyệt, chờ trường duyệt, đã công bố, trả lại, ẩn tạm, ngừng dùng.
// - Phiên bản: tệp tải lên, liên kết ngoài (chỉ lưu địa chỉ), hoặc tham chiếu kế hoạch bài dạy ở năm học (không sao chép).
// - Bộ sưu tập của giáo viên hoặc tổ, có thứ tự
const LEVELS = `'MN', 'TH', 'THCS', 'THPT'`;
const TYPES = [
  ['lesson_plan', 'Kế hoạch bài dạy', false],
  ['slides', 'Bài trình chiếu', false],
  ['video', 'Video', true],
  ['worksheet', 'Phiếu học tập', false],
  ['reference', 'Tài liệu tham khảo', false],
  ['image', 'Hình ảnh', false],
  ['test_file', 'Đề kiểm tra dạng tệp', false],
  ['other', 'Loại khác', false],
];
const LICENSES: Array<[string, string, boolean, boolean, boolean]> = [
  // mã, tên, chặn, chỉ cá nhân, cần ghi nơi cấp phép
  ['SELF', 'Tự biên soạn, dùng nội bộ', false, false, false],
  ['CC-BY', 'Creative Commons Ghi công (CC BY 4.0)', false, false, false],
  ['CC-BY-SA', 'Creative Commons Ghi công, Chia sẻ tương tự (CC BY-SA 4.0)', false, false, false],
  ['CC-BY-NC', 'Creative Commons Ghi công, Phi thương mại (CC BY-NC 4.0)', false, false, false],
  ['CC-BY-NC-SA', 'Creative Commons Ghi công, Phi thương mại, Chia sẻ tương tự (CC BY-NC-SA 4.0)', false, false, false],
  ['CC-BY-ND', 'Creative Commons Ghi công, Không phái sinh (CC BY-ND 4.0)', false, false, false],
  ['CC0', 'Creative Commons Không bảo lưu (CC0 1.0)', false, false, false],
  ['PERMISSION', 'Có xin phép tác giả, chủ sở hữu', false, false, true],
  ['STATE', 'Văn bản, tài liệu do cơ quan nhà nước ban hành', false, false, false],
  ['UNKNOWN', 'Không rõ giấy phép', false, true, false],
];

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('resource_types')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('requires_school_review', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('active')
          .check(sql`status in ('active', 'inactive')`),
      )
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createTable('resource_licenses')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 300`))
      .addColumn('blocked', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('private_only', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('requires_grant_source', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('active')
          .check(sql`status in ('active', 'inactive')`),
      )
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createTable('resource_topics')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('subject_code', 'text')
      .addColumn('grade_level_code', 'text')
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 300`))
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('active')
          .check(sql`status in ('active', 'inactive')`),
      )
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('learning_resources')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 300`))
      .addColumn('description', 'text')
      .addColumn('type_id', 'uuid', (column) => column.notNull().references('resource_types.id'))
      .addColumn('school_level', 'text', (column) => column.check(sql.raw(`school_level in (${LEVELS})`)))
      .addColumn('grade_level_code', 'text')
      .addColumn('subject_code', 'text')
      .addColumn('subject_name', 'text')
      .addColumn('topic_id', 'uuid', (column) => column.references('resource_topics.id').onDelete('set null'))
      .addColumn('week_no', 'smallint', (column) => column.check(sql`week_no between 1 and 60`))
      .addColumn('keywords', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'`))
      .addColumn('author_name', 'text')
      .addColumn('language', 'text', (column) => column.notNull().defaultTo('vi'))
      .addColumn('duration_minutes', 'integer', (column) => column.check(sql`duration_minutes between 1 and 10000`))
      .addColumn('license_id', 'uuid', (column) => column.references('resource_licenses.id'))
      .addColumn('license_source', 'text')
      .addColumn('origin', 'text')
      .addColumn('responsible_name', 'text')
      .addColumn('license_expires_on', 'date')
      .addColumn('visibility', 'text', (column) =>
        column
          .notNull()
          .defaultTo('private')
          .check(sql`visibility in ('private', 'unit', 'school', 'network')`),
      )
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('draft')
          .check(
            sql`status in ('draft', 'pending_unit', 'pending_school', 'published', 'returned', 'hidden', 'retired')`,
          ),
      )
      .addColumn('needs_school_review', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('owner_user_id', 'uuid', (column) => column.notNull())
      .addColumn('owner_name', 'text', (column) => column.notNull())
      .addColumn('department_id', 'uuid')
      .addColumn('department_name', 'text')
      .addColumn('current_version', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('published_version', 'integer')
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('published_at', 'timestamptz')
      .addColumn('return_note', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('learning_resources_owner_index')
      .on('learning_resources')
      .column('owner_user_id')
      .execute();
    await database.schema
      .createIndex('learning_resources_status_index')
      .on('learning_resources')
      .columns(['status', 'visibility'])
      .execute();

    await database.schema
      .createTable('learning_resource_versions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('resource_id', 'uuid', (column) =>
        column.notNull().references('learning_resources.id').onDelete('cascade'),
      )
      .addColumn('version_no', 'integer', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('file', 'link', 'lesson_plan')`))
      .addColumn('storage_key', 'text')
      .addColumn('file_name', 'text')
      .addColumn('content_type', 'text')
      .addColumn('size_bytes', 'integer')
      .addColumn('sha256', 'text')
      .addColumn('url', 'text')
      .addColumn('link_title', 'text')
      .addColumn('lesson_plan_id', 'uuid')
      .addColumn('lesson_plan_database', 'text')
      .addColumn('note', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('learning_resource_versions_unique', ['resource_id', 'version_no'])
      .addCheckConstraint(
        'learning_resource_versions_content_check',
        sql`(kind = 'file' and storage_key is not null) or (kind = 'link' and url is not null) or (kind = 'lesson_plan' and lesson_plan_id is not null)`,
      )
      .execute();

    await database.schema
      .createTable('resource_collections')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 300`))
      .addColumn('description', 'text')
      .addColumn('owner_user_id', 'uuid', (column) => column.notNull())
      .addColumn('owner_name', 'text', (column) => column.notNull())
      .addColumn('department_id', 'uuid')
      .addColumn('visibility', 'text', (column) =>
        column
          .notNull()
          .defaultTo('private')
          .check(sql`visibility in ('private', 'unit', 'school')`),
      )
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createTable('resource_collection_items')
      .addColumn('collection_id', 'uuid', (column) =>
        column.notNull().references('resource_collections.id').onDelete('cascade'),
      )
      .addColumn('resource_id', 'uuid', (column) =>
        column.notNull().references('learning_resources.id').onDelete('cascade'),
      )
      .addColumn('position', 'integer', (column) => column.notNull())
      .addColumn('added_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('resource_collection_items_pk', ['collection_id', 'resource_id'])
      .execute();

    await database
      .insertInto('resource_types')
      .values(
        TYPES.map(([code, name, school], index) => ({
          code,
          name,
          requires_school_review: school,
          order_no: index + 1,
        })),
      )
      .execute();
    await database
      .insertInto('resource_licenses')
      .values(
        LICENSES.map(([code, name, blocked, privateOnly, grant], index) => ({
          code,
          name,
          blocked,
          private_only: privateOnly,
          requires_grant_source: grant,
          order_no: index + 1,
        })),
      )
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('resource_collection_items').execute();
    await database.schema.dropTable('resource_collections').execute();
    await database.schema.dropTable('learning_resource_versions').execute();
    await database.schema.dropTable('learning_resources').execute();
    await database.schema.dropTable('resource_topics').execute();
    await database.schema.dropTable('resource_licenses').execute();
    await database.schema.dropTable('resource_types').execute();
  },
};
