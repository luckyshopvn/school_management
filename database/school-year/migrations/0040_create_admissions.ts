import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Tuyển sinh trực tuyến: đợt tuyển sinh, hồ sơ tuyển sinh, xét duyệt, chuyển thành hồ sơ trẻ, tin tuyển sinh (P16-01 đến
// P16-05; G3-01, G3-07; BR-01, BR-06, BR-69, QT-01; YCTD-86)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('admission_campaigns')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('description', 'text')
      .addColumn('quota', 'integer', (column) => column.notNull())
      .addColumn('open_from', 'date', (column) => column.notNull())
      .addColumn('open_to', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('opened_at', 'timestamptz')
      .addColumn('closed_at', 'timestamptz')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('admission_campaigns_status_check', sql`status in ('draft', 'open', 'closed')`)
      .addCheckConstraint('admission_campaigns_quota_check', sql`quota > 0`)
      .addCheckConstraint('admission_campaigns_range_check', sql`open_to >= open_from`)
      .execute();

    await database.schema
      .createTable('admission_applications')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('campaign_id', 'uuid', (column) => column.notNull().references('admission_campaigns.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('source', 'text', (column) => column.notNull())
      .addColumn('child_full_name', 'text', (column) => column.notNull())
      .addColumn('child_dob', 'date', (column) => column.notNull())
      .addColumn('child_gender', 'text', (column) => column.notNull())
      .addColumn('child_national_id_encrypted', 'text')
      .addColumn('child_national_id_hash', 'text')
      .addColumn('child_national_id_last4', 'text')
      .addColumn('child_has_allergies', 'boolean')
      .addColumn('child_allergies', 'text')
      .addColumn('guardian_full_name', 'text', (column) => column.notNull())
      .addColumn('guardian_phone', 'text', (column) => column.notNull())
      .addColumn('guardian_email', 'text')
      .addColumn('guardian_relationship_item_id', 'uuid', (column) => column.references('catalog_items.id'))
      .addColumn('address', 'text')
      .addColumn('note', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('submitted'))
      .addColumn('received_by', 'uuid')
      .addColumn('received_at', 'timestamptz')
      .addColumn('reviewed_by', 'uuid')
      .addColumn('reviewed_at', 'timestamptz')
      .addColumn('review_note', 'text')
      .addColumn('reject_reason', 'text')
      .addColumn('planned_class_id', 'uuid', (column) => column.references('classes.id'))
      .addColumn('created_child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('converted_by', 'uuid')
      .addColumn('converted_at', 'timestamptz')
      .addColumn('submitted_ip', 'text')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('admission_applications_source_check', sql`source in ('online', 'staff')`)
      .addCheckConstraint('admission_applications_gender_check', sql`child_gender in ('male', 'female')`)
      .addCheckConstraint(
        'admission_applications_status_check',
        sql`status in ('submitted', 'received', 'passed', 'rejected', 'converted')`,
      )
      .addCheckConstraint(
        'admission_applications_reject_reason_check',
        sql`status <> 'rejected' or reject_reason is not null`,
      )
      .addCheckConstraint(
        'admission_applications_converted_check',
        sql`status <> 'converted' or created_child_id is not null`,
      )
      .execute();
    await database.schema
      .createIndex('admission_applications_campaign_index')
      .on('admission_applications')
      .columns(['campaign_id', 'status'])
      .execute();
    await database.schema
      .createIndex('admission_applications_phone_index')
      .on('admission_applications')
      .column('guardian_phone')
      .execute();

    await database.schema
      .createTable('admission_posts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('campaign_id', 'uuid', (column) => column.notNull().references('admission_campaigns.id'))
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('content', 'text', (column) => column.notNull())
      .addColumn('publish_from', 'date', (column) => column.notNull())
      .addColumn('publish_to', 'date')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('published_at', 'timestamptz')
      .addColumn('hidden_reason', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('admission_posts_status_check', sql`status in ('draft', 'published', 'hidden')`)
      .addCheckConstraint('admission_posts_range_check', sql`publish_to is null or publish_to >= publish_from`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('admission_posts').execute();
    await database.schema.dropTable('admission_applications').execute();
    await database.schema.dropTable('admission_campaigns').execute();
  },
};
