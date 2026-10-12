import { sql, type CreateTableBuilder } from 'kysely';
import type { Migration } from 'kysely/migration';

// Hoạt động của lớp, hình ảnh, tin tức, thư viện, hình tô màu, ngoại khóa và bình luận (P14-01 đến P14-06, P14-09 đến
// P14-12; BR-19, BR-64, BR-65, BR-66, BR-69, BR-85; QT-10; YCTD-78). Hình chỉ lưu dòng tệp, nội dung ở kho tệp dùng chung;
// bình luận không có cột xóa, chỉ ẩn kèm lý do (BR-66)
const PREVIOUS_PURPOSES = `'birth_certificate', 'photo_consent', 'import', 'pickup_photo', 'payment_voucher', 'medicine_photo', 'prescription'`;
const SCOPE_CHECK = sql`(scope_type = 'school' and scope_id is null) or (scope_type in ('unit', 'class', 'child') and scope_id is not null)`;
const CONTENT_STATUS = sql`status in ('draft', 'published', 'hidden')`;

function withId<Table extends string>(table: CreateTableBuilder<Table>) {
  return table.addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`));
}

function withTimestamps<Table extends string>(table: CreateTableBuilder<Table>) {
  return table
    .addColumn('created_by', 'uuid', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`));
}

// Danh mục đơn giản theo đơn vị: danh mục hoạt động, danh mục tin tức, chủ đề thư viện
async function createCatalog(database: Parameters<Migration['up']>[0], table: string) {
  await withTimestamps(
    withId(database.schema.createTable(table))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active')),
  )
    .addCheckConstraint(`${table}_status_check`, sql`status in ('active', 'inactive')`)
    .addUniqueConstraint(`${table}_unit_name_unique`, ['org_unit_id', 'name'] as never)
    .execute();
}

// Cột chung của nội dung công bố theo phạm vi (BR-69): nháp, đã công bố, đã ẩn kèm lý do
function withPublishing<Table extends string>(table: CreateTableBuilder<Table>) {
  return table
    .addColumn('scope_type', 'text', (column) => column.notNull().defaultTo('unit'))
    .addColumn('scope_id', 'uuid')
    .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
    .addColumn('published_at', 'timestamptz')
    .addColumn('published_by', 'uuid')
    .addColumn('hidden_reason', 'text')
    .addColumn('hidden_by', 'uuid')
    .addColumn('hidden_at', 'timestamptz');
}

export const migration: Migration = {
  async up(database) {
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}, 'activity_photo', 'content_file'))`.execute(database);

    await createCatalog(database, 'activity_categories');
    await createCatalog(database, 'news_categories');
    await createCatalog(database, 'library_topics');

    await withTimestamps(
      withId(database.schema.createTable('activities'))
        .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
        .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
        .addColumn('category_id', 'uuid', (column) => column.notNull().references('activity_categories.id'))
        .addColumn('title', 'text', (column) => column.notNull())
        .addColumn('content', 'text', (column) => column.notNull())
        .addColumn('activity_date', 'date', (column) => column.notNull())
        .addColumn('status', 'text', (column) => column.notNull())
        .addColumn('created_by_name', 'text', (column) => column.notNull())
        .addColumn('submitted_at', 'timestamptz')
        .addColumn('approved_by', 'uuid')
        .addColumn('approved_at', 'timestamptz')
        .addColumn('reject_reason', 'text')
        .addColumn('published_at', 'timestamptz')
        .addColumn('hidden_reason', 'text')
        .addColumn('hidden_by', 'uuid')
        .addColumn('hidden_at', 'timestamptz'),
    )
      .addCheckConstraint(
        'activities_status_check',
        sql`status in ('draft', 'pending', 'published', 'rejected', 'hidden')`,
      )
      .execute();
    await database.schema
      .createIndex('activities_class_status_index')
      .on('activities')
      .columns(['class_id', 'status', 'published_at'])
      .execute();

    await withId(database.schema.createTable('activity_media'))
      .addColumn('activity_id', 'uuid', (column) => column.notNull().references('activities.id').onDelete('cascade'))
      .addColumn('file_id', 'uuid', (column) => column.notNull().references('files.id'))
      .addColumn('caption', 'text')
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    // Trẻ được gắn thẻ trong hình; hình chỉ hiển thị cho phụ huynh khi mọi trẻ được gắn đều đang đồng ý (BR-65)
    await database.schema
      .createTable('activity_media_children')
      .addColumn('media_id', 'uuid', (column) => column.notNull().references('activity_media.id').onDelete('cascade'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addPrimaryKeyConstraint('activity_media_children_pkey', ['media_id', 'child_id'])
      .execute();

    await database.schema
      .createTable('activity_likes')
      .addColumn('activity_id', 'uuid', (column) => column.notNull().references('activities.id').onDelete('cascade'))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('activity_likes_pkey', ['activity_id', 'user_id'])
      .execute();

    await withTimestamps(
      withPublishing(
        withId(database.schema.createTable('news'))
          .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
          .addColumn('category_id', 'uuid', (column) => column.references('news_categories.id'))
          .addColumn('title', 'text', (column) => column.notNull())
          .addColumn('summary', 'text')
          .addColumn('content', 'text', (column) => column.notNull())
          .addColumn('cover_file_id', 'uuid', (column) => column.references('files.id')),
      ),
    )
      .addCheckConstraint('news_scope_check', SCOPE_CHECK)
      .addCheckConstraint('news_status_check', CONTENT_STATUS)
      .execute();

    await withTimestamps(
      withId(database.schema.createTable('library_albums'))
        .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
        .addColumn('topic_id', 'uuid', (column) => column.references('library_topics.id'))
        .addColumn('title', 'text', (column) => column.notNull())
        .addColumn('cover_file_id', 'uuid', (column) => column.references('files.id'))
        .addColumn('status', 'text', (column) => column.notNull().defaultTo('active')),
    )
      .addCheckConstraint('library_albums_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    await withTimestamps(
      withPublishing(
        withId(database.schema.createTable('library_items'))
          .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
          .addColumn('topic_id', 'uuid', (column) => column.references('library_topics.id'))
          .addColumn('album_id', 'uuid', (column) => column.references('library_albums.id'))
          .addColumn('title', 'text', (column) => column.notNull())
          .addColumn('description', 'text')
          .addColumn('age_group', 'text')
          .addColumn('file_id', 'uuid', (column) => column.references('files.id')),
      ),
    )
      .addCheckConstraint('library_items_scope_check', SCOPE_CHECK)
      .addCheckConstraint('library_items_status_check', CONTENT_STATUS)
      .execute();

    await withTimestamps(
      withPublishing(
        withId(database.schema.createTable('coloring_pages'))
          .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
          .addColumn('title', 'text', (column) => column.notNull())
          .addColumn('topic', 'text')
          .addColumn('age_group', 'text')
          .addColumn('file_id', 'uuid', (column) => column.notNull().references('files.id')),
      ),
    )
      .addCheckConstraint('coloring_pages_scope_check', SCOPE_CHECK)
      .addCheckConstraint('coloring_pages_status_check', CONTENT_STATUS)
      .execute();

    // Bình luận trên hoạt động, tin tức, nội dung và album thư viện; không xóa, chỉ ẩn kèm lý do (BR-66)
    await withId(database.schema.createTable('content_comments'))
      .addColumn('target_type', 'text', (column) => column.notNull())
      .addColumn('target_id', 'uuid', (column) => column.notNull())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('author_name', 'text', (column) => column.notNull())
      .addColumn('is_parent', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('content', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('hidden_reason', 'text')
      .addColumn('hidden_by', 'uuid')
      .addColumn('hidden_at', 'timestamptz')
      .addCheckConstraint(
        'content_comments_target_check',
        sql`target_type in ('activity', 'news', 'library_item', 'library_album')`,
      )
      .execute();
    await database.schema
      .createIndex('content_comments_target_index')
      .on('content_comments')
      .columns(['target_type', 'target_id', 'created_at'])
      .execute();

    await withTimestamps(
      withId(database.schema.createTable('extracurricular_activities'))
        .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
        .addColumn('name', 'text', (column) => column.notNull())
        .addColumn('description', 'text')
        .addColumn('start_date', 'date', (column) => column.notNull())
        .addColumn('end_date', 'date', (column) => column.notNull())
        // Bậc học được đăng ký; trống là mọi trẻ của đơn vị
        .addColumn('grade_levels', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
        .addColumn('quota', 'integer', (column) => column.notNull())
        .addColumn('fee_type', 'text', (column) => column.notNull())
        .addColumn('fee_amount', 'bigint', (column) => column.notNull().defaultTo(0))
        .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft')),
    )
      .addCheckConstraint('extracurricular_activities_range_check', sql`end_date >= start_date`)
      .addCheckConstraint('extracurricular_activities_quota_check', sql`quota > 0`)
      .addCheckConstraint(
        'extracurricular_activities_fee_type_check',
        sql`fee_type in ('free', 'per_activity', 'monthly')`,
      )
      .addCheckConstraint(
        'extracurricular_activities_fee_check',
        sql`(fee_type = 'free' and fee_amount = 0) or (fee_type <> 'free' and fee_amount > 0)`,
      )
      .addCheckConstraint('extracurricular_activities_status_check', sql`status in ('draft', 'published', 'closed')`)
      .execute();

    await withId(database.schema.createTable('extracurricular_registrations'))
      .addColumn('activity_id', 'uuid', (column) => column.notNull().references('extracurricular_activities.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('registered_by', 'uuid', (column) => column.notNull())
      .addColumn('registered_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('effective_from', 'date', (column) => column.notNull())
      .addColumn('effective_to', 'date')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('withdrawn_by', 'uuid')
      .addColumn('withdrawn_at', 'timestamptz')
      .addCheckConstraint('extracurricular_registrations_status_check', sql`status in ('active', 'withdrawn')`)
      .addCheckConstraint(
        'extracurricular_registrations_range_check',
        sql`effective_to is null or effective_to >= effective_from`,
      )
      .execute();
    // Mỗi trẻ chỉ một đăng ký đang hiệu lực cho một hoạt động
    await sql`create unique index extracurricular_registrations_active_unique on extracurricular_registrations
      (activity_id, child_id) where status = 'active'`.execute(database);

    // Phí ngoại khóa là một loại dòng khoản phải thu (BR-19); dòng ghi đăng ký đã lập khoản thu để không thu trùng
    await sql`alter table invoice_items drop constraint invoice_items_type_check`.execute(database);
    await sql`alter table invoice_items add constraint invoice_items_type_check
      check (item_type in ('tuition', 'service', 'opening', 'extracurricular'))`.execute(database);
    await database.schema
      .alterTable('invoice_items')
      .addColumn('extracurricular_registration_id', 'uuid', (column) =>
        column.references('extracurricular_registrations.id'),
      )
      .execute();
  },
  async down(database) {
    await sql`delete from invoice_items where item_type = 'extracurricular'`.execute(database);
    await database.schema.alterTable('invoice_items').dropColumn('extracurricular_registration_id').execute();
    await sql`alter table invoice_items drop constraint invoice_items_type_check`.execute(database);
    await sql`alter table invoice_items add constraint invoice_items_type_check
      check (item_type in ('tuition', 'service', 'opening'))`.execute(database);
    for (const table of [
      'extracurricular_registrations',
      'extracurricular_activities',
      'content_comments',
      'coloring_pages',
      'library_items',
      'library_albums',
      'news',
      'activity_likes',
      'activity_media_children',
      'activity_media',
      'activities',
      'library_topics',
      'news_categories',
      'activity_categories',
    ]) {
      await database.schema.dropTable(table).execute();
    }
    await sql`delete from files where purpose in ('activity_photo', 'content_file')`.execute(database);
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}))`.execute(database);
  },
};
