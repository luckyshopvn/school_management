import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Y tế học đường phần hồ sơ, khám, sự kiện, chăm sóc (P10-01, P10-06, P10-07, P10-08, P10-10, P10-11, P10-12; BR-51 đến
// BR-53, BR-87, BR-88; YCTD-74)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('health_measurements')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('measured_on', 'date', (column) => column.notNull())
      .addColumn('height_cm', 'numeric(5, 1)')
      .addColumn('weight_kg', 'numeric(5, 2)')
      .addColumn('vision_left', 'text')
      .addColumn('vision_right', 'text')
      .addColumn('note', 'text')
      .addColumn('recorded_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'health_measurements_value_check',
        sql`height_cm is not null or weight_kg is not null or vision_left is not null or vision_right is not null`,
      )
      .execute();
    await database.schema
      .createIndex('health_measurements_child_index')
      .on('health_measurements')
      .columns(['child_id', 'measured_on'])
      .execute();

    await database.schema
      .createTable('health_standards')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('indicator_code', 'text', (column) => column.notNull())
      .addColumn('gender', 'text', (column) => column.notNull())
      .addColumn('age_month_from', 'integer', (column) => column.notNull())
      .addColumn('age_month_to', 'integer', (column) => column.notNull())
      .addColumn('lower_value', 'numeric(6, 2)', (column) => column.notNull())
      .addColumn('upper_value', 'numeric(6, 2)', (column) => column.notNull())
      .addColumn('source_document', 'text', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('health_standards_indicator_check', sql`indicator_code in ('height_cm', 'weight_kg', 'bmi')`)
      .addCheckConstraint('health_standards_gender_check', sql`gender in ('male', 'female')`)
      .addCheckConstraint(
        'health_standards_range_check',
        sql`age_month_from >= 0 and age_month_to >= age_month_from and upper_value >= lower_value`,
      )
      .execute();

    await database.schema
      .createTable('health_check_campaigns')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('from_date', 'date', (column) => column.notNull())
      .addColumn('to_date', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('open'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('health_check_campaigns_status_check', sql`status in ('open', 'closed')`)
      .addCheckConstraint('health_check_campaigns_range_check', sql`to_date >= from_date`)
      .execute();

    await database.schema
      .createTable('health_check_schedules')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('campaign_id', 'uuid', (column) => column.notNull().references('health_check_campaigns.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('check_date', 'date', (column) => column.notNull())
      .addColumn('location', 'text', (column) => column.notNull())
      .addColumn('published_at', 'timestamptz')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('health_check_schedules_campaign_class_unique', ['campaign_id', 'class_id'])
      .execute();

    await database.schema
      .createTable('health_check_results')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('campaign_id', 'uuid', (column) => column.notNull().references('health_check_campaigns.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('height_cm', 'numeric(5, 1)')
      .addColumn('weight_kg', 'numeric(5, 2)')
      .addColumn('result_data', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('conclusion', 'text')
      .addColumn('note', 'text')
      .addColumn('recorded_by', 'uuid', (column) => column.notNull())
      .addColumn('recorded_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('published_at', 'timestamptz')
      .addUniqueConstraint('health_check_results_campaign_child_unique', ['campaign_id', 'child_id'])
      .execute();

    await database.schema
      .createTable('medical_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('occurred_at', 'timestamptz', (column) => column.notNull())
      .addColumn('symptoms', 'text', (column) => column.notNull())
      .addColumn('handling', 'text', (column) => column.notNull())
      .addColumn('handler_name', 'text', (column) => column.notNull())
      .addColumn('severity', 'text', (column) => column.notNull())
      .addColumn('recorded_by', 'uuid', (column) => column.notNull())
      .addColumn('notified_guardians_at', 'timestamptz')
      .addColumn('parent_acknowledged_at', 'timestamptz')
      .addColumn('parent_acknowledged_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('medical_events_severity_check', sql`severity in ('mild', 'moderate', 'severe')`)
      .execute();
    await database.schema
      .createIndex('medical_events_child_index')
      .on('medical_events')
      .columns(['child_id', 'occurred_at'])
      .execute();

    await database.schema
      .createTable('daily_care_logs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('care_date', 'date', (column) => column.notNull())
      .addColumn('recorded_at', 'timestamptz', (column) => column.notNull())
      .addColumn('temperature', 'numeric(4, 1)')
      .addColumn('condition_note', 'text')
      .addColumn('special_care_note', 'text')
      .addColumn('recorded_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'daily_care_logs_value_check',
        sql`temperature is not null or condition_note is not null or special_care_note is not null`,
      )
      .addCheckConstraint(
        'daily_care_logs_temperature_check',
        sql`temperature is null or temperature between 34 and 43`,
      )
      .execute();
    await database.schema
      .createIndex('daily_care_logs_child_index')
      .on('daily_care_logs')
      .columns(['child_id', 'care_date'])
      .execute();

    await database.schema
      .createTable('health_report_requests')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('report_type', 'text', (column) => column.notNull())
      .addColumn('period_from', 'date', (column) => column.notNull())
      .addColumn('period_to', 'date', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('requested_by', 'uuid', (column) => column.notNull())
      .addColumn('requested_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('report_data', 'jsonb')
      .addColumn('response_note', 'text')
      .addColumn('sent_by', 'uuid')
      .addColumn('sent_at', 'timestamptz')
      .addCheckConstraint('health_report_requests_type_check', sql`report_type in ('growth', 'medical', 'full')`)
      .addCheckConstraint('health_report_requests_status_check', sql`status in ('pending', 'sent')`)
      .addCheckConstraint('health_report_requests_range_check', sql`period_to >= period_from`)
      .execute();
  },
  async down(database) {
    for (const table of [
      'health_report_requests',
      'daily_care_logs',
      'medical_events',
      'health_check_results',
      'health_check_schedules',
      'health_check_campaigns',
      'health_standards',
      'health_measurements',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
