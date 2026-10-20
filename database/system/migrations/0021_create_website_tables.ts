import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Website công khai của trường trên tên miền riêng (DT-18 phần 18f, YCTD-144; quyết định của Eric ngày 2026-10-19: mỗi
// trường một tên miền riêng, có chế độ trình diễn). Cấu hình lưu ở cơ sở dữ liệu hệ thống, không ở biến môi trường:
// - website_settings: một dòng thông tin của website (tên, địa chỉ, liên hệ, đường dẫn nộp hồ sơ tuyển sinh, chế độ trình
//   diễn, cấp học để chọn nhóm công khai);
// - website_domains: tên miền của trường; máy chủ web chỉ cấp chứng chỉ cho tên miền đã đăng ký và đang dùng. Loại chính,
//   phụ (chuyển về tên miền chính) và trình diễn (tên miền giả lập, hiện dải trình diễn, không cho máy tìm kiếm lập chỉ mục).
//   Trỏ tên miền là bước nhập tay, ghi trạng thái đánh dấu tay;
// - website_files: ảnh bìa, tệp đính kèm, ảnh album, biểu trưng, ảnh đầu trang; nội dung ở kho tệp;
// - website_posts: tin tức, thông báo, trang (giới thiệu, cơ cấu tổ chức), công khai theo quy định; nội dung HTML đã lọc;
// - website_albums: thư viện ảnh, đăng cần xác nhận ảnh có trẻ đã được cha mẹ đồng ý;
// - website_disclosure_categories: nhóm công khai theo Thông tư 09/2024/TT-BGDĐT (Điều 4 đến Điều 9), theo cấp học;
// - website_contact_messages: thư liên hệ gửi từ trang Liên hệ;
// - website_events: lịch sử soạn, gửi duyệt, đăng, gỡ.
// Bài và album đi qua bốn trạng thái: nháp, chờ duyệt, đã đăng, đã gỡ
const CONTENT_STATUS = sql`status in ('draft', 'pending', 'published', 'unpublished')`;

const DISCLOSURE_CATEGORIES = [
  { code: 'general', name: 'Thông tin chung về cơ sở giáo dục', basis: 'Điều 4', level: null },
  { code: 'finance', name: 'Thu, chi tài chính', basis: 'Điều 5', level: null },
  { code: 'mn-quality', name: 'Điều kiện bảo đảm chất lượng hoạt động giáo dục', basis: 'Điều 6', level: 'MN' },
  { code: 'mn-plan', name: 'Kế hoạch và kết quả hoạt động giáo dục', basis: 'Điều 7', level: 'MN' },
  { code: 'pt-quality', name: 'Điều kiện bảo đảm chất lượng hoạt động giáo dục', basis: 'Điều 8', level: 'PT' },
  { code: 'pt-plan', name: 'Kế hoạch và kết quả hoạt động giáo dục', basis: 'Điều 9', level: 'PT' },
  { code: 'annual-report', name: 'Báo cáo thường niên', basis: 'Chương III', level: null },
];

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('website_files')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('owner_type', 'text', (column) => column.notNull())
      .addColumn('owner_id', 'uuid')
      .addColumn('purpose', 'text', (column) => column.notNull())
      .addColumn('file_name', 'text', (column) => column.notNull())
      .addColumn('content_type', 'text', (column) => column.notNull())
      .addColumn('size_bytes', 'integer', (column) => column.notNull())
      .addColumn('sha256', 'text', (column) => column.notNull())
      .addColumn('storage_key', 'text', (column) => column.notNull())
      .addColumn('caption', 'text')
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('website_files_owner_check', sql`owner_type in ('post', 'album', 'settings')`)
      .addCheckConstraint(
        'website_files_purpose_check',
        sql`purpose in ('cover', 'attachment', 'photo', 'logo', 'banner')`,
      )
      .addCheckConstraint(
        'website_files_owner_id_check',
        sql`(owner_type = 'settings') = (owner_id is null)`,
      )
      .execute();
    await database.schema
      .createIndex('website_files_owner_index')
      .on('website_files')
      .columns(['owner_type', 'owner_id'])
      .execute();

    await database.schema
      .createTable('website_settings')
      .addColumn('id', 'smallint', (column) => column.primaryKey().defaultTo(1))
      .addColumn('site_name', 'text', (column) => column.notNull().defaultTo(''))
      .addColumn('slogan', 'text')
      .addColumn('introduction', 'text')
      .addColumn('address', 'text')
      .addColumn('phone', 'text')
      .addColumn('email', 'text')
      .addColumn('map_url', 'text')
      .addColumn('office_hours', 'text')
      .addColumn('facebook_url', 'text')
      .addColumn('admission_form_url', 'text')
      .addColumn('footer_note', 'text')
      .addColumn('primary_color', 'text', (column) => column.notNull().defaultTo('#1d4ed8'))
      .addColumn('school_levels', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{MN}'::text[]`))
      .addColumn('show_timetable', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('demo_mode', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('logo_file_id', 'uuid', (column) => column.references('website_files.id').onDelete('set null'))
      .addColumn('banner_file_id', 'uuid', (column) => column.references('website_files.id').onDelete('set null'))
      .addColumn('updated_by_name', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('website_settings_single_check', sql`id = 1`)
      .addCheckConstraint('website_settings_color_check', sql`primary_color ~ '^#[0-9a-f]{6}$'`)
      .execute();
    await sql`insert into website_settings (id) values (1)`.execute(database);

    await database.schema
      .createTable('website_domains')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('hostname', 'text', (column) => column.notNull().unique())
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('active', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('dns_confirmed_at', 'timestamptz')
      .addColumn('dns_confirmed_by_name', 'text')
      .addColumn('note', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('website_domains_kind_check', sql`kind in ('primary', 'alias', 'demo')`)
      .addCheckConstraint('website_domains_hostname_check', sql`hostname = lower(hostname)`)
      .execute();
    // Mỗi trường một tên miền chính đang dùng
    await sql`create unique index website_domains_primary_unique on website_domains (kind)
      where kind = 'primary' and active`.execute(database);

    await database.schema
      .createTable('website_disclosure_categories')
      .addColumn('code', 'text', (column) => column.primaryKey())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('legal_basis', 'text')
      .addColumn('school_level', 'text')
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('active', 'boolean', (column) => column.notNull().defaultTo(true))
      .addCheckConstraint(
        'website_disclosure_categories_level_check',
        sql`school_level is null or school_level in ('MN', 'PT')`,
      )
      .execute();
    for (const [index, category] of DISCLOSURE_CATEGORIES.entries()) {
      await database
        .insertInto('website_disclosure_categories' as never)
        .values({
          code: category.code,
          name: category.name,
          legal_basis: category.basis,
          school_level: category.level,
          order_no: index + 1,
        } as never)
        .execute();
    }

    await database.schema
      .createTable('website_posts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('page_key', 'text', (column) => column.unique())
      .addColumn('disclosure_category', 'text', (column) =>
        column.references('website_disclosure_categories.code'),
      )
      .addColumn('disclosure_year', 'text')
      .addColumn('slug', 'text', (column) => column.notNull().unique())
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('summary', 'text')
      .addColumn('body_html', 'text', (column) => column.notNull().defaultTo(''))
      .addColumn('cover_file_id', 'uuid', (column) => column.references('website_files.id').onDelete('set null'))
      .addColumn('pinned', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('return_note', 'text')
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('submitted_by_name', 'text')
      .addColumn('published_at', 'timestamptz')
      .addColumn('first_published_at', 'timestamptz')
      .addColumn('published_by_name', 'text')
      .addColumn('unpublished_at', 'timestamptz')
      .addColumn('unpublished_by_name', 'text')
      .addColumn('unpublish_reason', 'text')
      .addColumn('is_sample', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('updated_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'website_posts_kind_check',
        sql`kind in ('news', 'announcement', 'page', 'disclosure')`,
      )
      .addCheckConstraint('website_posts_status_check', CONTENT_STATUS)
      .addCheckConstraint('website_posts_page_check', sql`(kind = 'page') = (page_key is not null)`)
      .addCheckConstraint(
        'website_posts_disclosure_check',
        sql`(kind = 'disclosure') = (disclosure_category is not null)`,
      )
      .execute();
    await database.schema
      .createIndex('website_posts_list_index')
      .on('website_posts')
      .columns(['kind', 'status', 'published_at'])
      .execute();

    await database.schema
      .createTable('website_albums')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('slug', 'text', (column) => column.notNull().unique())
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('description', 'text')
      .addColumn('event_date', 'date')
      .addColumn('cover_file_id', 'uuid', (column) => column.references('website_files.id').onDelete('set null'))
      .addColumn('consent_confirmed', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('consent_confirmed_by_name', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('return_note', 'text')
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('submitted_by_name', 'text')
      .addColumn('published_at', 'timestamptz')
      .addColumn('first_published_at', 'timestamptz')
      .addColumn('published_by_name', 'text')
      .addColumn('unpublished_at', 'timestamptz')
      .addColumn('unpublished_by_name', 'text')
      .addColumn('unpublish_reason', 'text')
      .addColumn('is_sample', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('updated_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('website_albums_status_check', CONTENT_STATUS)
      .execute();

    await database.schema
      .createTable('website_contact_messages')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('full_name', 'text', (column) => column.notNull())
      .addColumn('phone', 'text')
      .addColumn('email', 'text')
      .addColumn('subject', 'text', (column) => column.notNull())
      .addColumn('message', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('new'))
      .addColumn('handled_note', 'text')
      .addColumn('handled_at', 'timestamptz')
      .addColumn('handled_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('website_contact_messages_status_check', sql`status in ('new', 'handled')`)
      .execute();
    await database.schema
      .createIndex('website_contact_messages_created_index')
      .on('website_contact_messages')
      .columns(['status', 'created_at'])
      .execute();

    await database.schema
      .createTable('website_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('target_type', 'text', (column) => column.notNull())
      .addColumn('target_id', 'uuid')
      .addColumn('action', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('actor_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'website_events_target_check',
        sql`target_type in ('post', 'album', 'settings', 'domain', 'contact')`,
      )
      .execute();
    await database.schema
      .createIndex('website_events_target_index')
      .on('website_events')
      .columns(['target_type', 'target_id', 'created_at'])
      .execute();
  },
  async down(database) {
    for (const table of [
      'website_events',
      'website_contact_messages',
      'website_albums',
      'website_posts',
      'website_disclosure_categories',
      'website_domains',
      'website_settings',
      'website_files',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
