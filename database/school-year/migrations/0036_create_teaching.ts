import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Giảng dạy (P03-01 đến P03-08; BR-01, BR-15, BR-64, BR-69, BR-75; YCTD-80): lĩnh vực và nhóm bài học, chủ đề, bài học,
// giáo án hai bước duyệt, thời khóa biểu theo phiên bản tuần, kế hoạch giảng dạy, tiến độ học tập của trẻ, lịch hoạt
// động lớp. Giờ lưu dạng chữ HH:MM để so sánh trùng khung giờ
const TIME_PATTERN = '^([01][0-9]|2[0-3]):[0-5][0-9]$';

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('lesson_domains')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('lesson_domains_status_check', sql`status in ('active', 'inactive')`)
      .addUniqueConstraint('lesson_domains_name_unique', ['org_unit_id', 'name'])
      .execute();

    await database.schema
      .createTable('lesson_groups')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('domain_id', 'uuid', (column) => column.notNull().references('lesson_domains.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('lesson_groups_status_check', sql`status in ('active', 'inactive')`)
      .addUniqueConstraint('lesson_groups_name_unique', ['domain_id', 'name'])
      .execute();

    await database.schema
      .createTable('themes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('age_group', 'text')
      .addColumn('start_date', 'date', (column) => column.notNull())
      .addColumn('end_date', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('themes_status_check', sql`status in ('active', 'inactive')`)
      .addCheckConstraint('themes_range_check', sql`end_date >= start_date`)
      .execute();

    await database.schema
      .createTable('lessons')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('theme_id', 'uuid', (column) => column.references('themes.id'))
      .addColumn('domain_id', 'uuid', (column) => column.references('lesson_domains.id'))
      .addColumn('lesson_group_id', 'uuid', (column) => column.references('lesson_groups.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('age_group', 'text')
      .addColumn('objectives', 'text', (column) => column.notNull())
      .addColumn('materials', 'text')
      .addColumn('is_shared', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('lessons_status_check', sql`status in ('active', 'inactive')`)
      .execute();
    await database.schema
      .createIndex('lessons_unit_index')
      .on('lessons')
      .columns(['org_unit_id', 'domain_id'])
      .execute();

    await database.schema
      .createTable('lesson_plans')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('lesson_id', 'uuid', (column) => column.notNull().references('lessons.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('teacher_id', 'uuid', (column) => column.notNull())
      .addColumn('teacher_name', 'text', (column) => column.notNull())
      .addColumn('planned_date', 'date', (column) => column.notNull())
      .addColumn('activities', 'text', (column) => column.notNull())
      .addColumn('duration_minutes', 'integer', (column) => column.notNull())
      .addColumn('materials', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('leader_reviewed_by', 'uuid')
      .addColumn('leader_reviewed_at', 'timestamptz')
      .addColumn('approved_by', 'uuid')
      .addColumn('approved_at', 'timestamptz')
      .addColumn('review_comment', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'lesson_plans_status_check',
        sql`status in ('draft', 'submitted', 'leader_approved', 'approved', 'returned')`,
      )
      .addCheckConstraint('lesson_plans_duration_check', sql`duration_minutes between 5 and 480`)
      .execute();
    await database.schema
      .createIndex('lesson_plans_class_index')
      .on('lesson_plans')
      .columns(['class_id', 'planned_date'])
      .execute();

    await database.schema
      .createTable('lesson_plan_reviews')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('lesson_plan_id', 'uuid', (column) => column.notNull().references('lesson_plans.id'))
      .addColumn('reviewer_id', 'uuid', (column) => column.notNull())
      .addColumn('reviewer_name', 'text', (column) => column.notNull())
      .addColumn('stage', 'text', (column) => column.notNull())
      .addColumn('decision', 'text', (column) => column.notNull())
      .addColumn('comment', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('lesson_plan_reviews_stage_check', sql`stage in ('leader', 'manager')`)
      .addCheckConstraint('lesson_plan_reviews_decision_check', sql`decision in ('approved', 'returned')`)
      .execute();

    await database.schema
      .createTable('timetables')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('effective_from', 'date', (column) => column.notNull())
      .addColumn('weekday', 'integer', (column) => column.notNull())
      .addColumn('period_no', 'integer', (column) => column.notNull())
      .addColumn('start_time', 'text', (column) => column.notNull())
      .addColumn('end_time', 'text', (column) => column.notNull())
      .addColumn('activity_name', 'text', (column) => column.notNull())
      .addColumn('teacher_id', 'uuid')
      .addColumn('teacher_name', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('published_at', 'timestamptz')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('timetables_weekday_check', sql`weekday between 1 and 7`)
      .addCheckConstraint('timetables_period_check', sql`period_no between 1 and 20`)
      .addCheckConstraint(
        'timetables_time_check',
        sql`start_time ~ ${sql.lit(TIME_PATTERN)} and end_time ~ ${sql.lit(TIME_PATTERN)} and end_time > start_time`,
      )
      .addCheckConstraint('timetables_status_check', sql`status in ('draft', 'published')`)
      .addUniqueConstraint('timetables_slot_unique', ['class_id', 'effective_from', 'weekday', 'period_no'])
      .execute();

    await database.schema
      .createTable('teaching_plans')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('period_type', 'text', (column) => column.notNull())
      .addColumn('period_value', 'text', (column) => column.notNull())
      .addColumn('objectives', 'text', (column) => column.notNull())
      .addColumn('content', 'text', (column) => column.notNull())
      .addColumn('progress_note', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('planned'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('updated_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('teaching_plans_period_check', sql`period_type in ('term', 'month', 'week')`)
      .addCheckConstraint('teaching_plans_status_check', sql`status in ('planned', 'in_progress', 'completed')`)
      .addUniqueConstraint('teaching_plans_period_unique', ['class_id', 'period_type', 'period_value'])
      .execute();

    await database.schema
      .createTable('child_progress')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('period_type', 'text', (column) => column.notNull())
      .addColumn('period_value', 'text', (column) => column.notNull())
      .addColumn('domain_id', 'uuid', (column) => column.references('lesson_domains.id'))
      .addColumn('indicator_code', 'text', (column) => column.notNull())
      .addColumn('level', 'text', (column) => column.notNull())
      .addColumn('comment', 'text')
      .addColumn('recorded_by', 'uuid', (column) => column.notNull())
      .addColumn('published_at', 'timestamptz')
      .addColumn('published_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('child_progress_period_check', sql`period_type in ('term', 'month')`)
      .addCheckConstraint('child_progress_level_check', sql`level in ('achieved', 'developing', 'not_yet')`)
      .addUniqueConstraint('child_progress_indicator_unique', [
        'child_id',
        'period_type',
        'period_value',
        'indicator_code',
      ])
      .execute();

    await database.schema
      .createTable('class_activity_schedules')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('activity_date', 'date', (column) => column.notNull())
      .addColumn('start_time', 'text', (column) => column.notNull())
      .addColumn('end_time', 'text', (column) => column.notNull())
      .addColumn('activity_name', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('published_at', 'timestamptz')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'class_activity_schedules_time_check',
        sql`start_time ~ ${sql.lit(TIME_PATTERN)} and end_time ~ ${sql.lit(TIME_PATTERN)} and end_time > start_time`,
      )
      .addCheckConstraint('class_activity_schedules_status_check', sql`status in ('draft', 'published', 'cancelled')`)
      .execute();
    await database.schema
      .createIndex('class_activity_schedules_class_index')
      .on('class_activity_schedules')
      .columns(['class_id', 'activity_date'])
      .execute();
  },
  async down(database) {
    for (const table of [
      'class_activity_schedules',
      'child_progress',
      'teaching_plans',
      'timetables',
      'lesson_plan_reviews',
      'lesson_plans',
      'lessons',
      'themes',
      'lesson_groups',
      'lesson_domains',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
