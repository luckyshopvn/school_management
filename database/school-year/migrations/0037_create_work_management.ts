import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Công việc, kế hoạch, theo dõi tiến độ, đánh giá nhân sự theo kỳ (P09-01 đến P09-05), quá trình công tác và chứng chỉ
// (P07-03), thưởng và khấu trừ theo tháng đưa vào bảng lương (P08-07); BR-01, BR-37, BR-44, BR-45, BR-46, BR-47, BR-70;
// YCTD-81
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('plans')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('period_type', 'text', (column) => column.notNull())
      .addColumn('period_value', 'text', (column) => column.notNull())
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('objectives', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('activated_at', 'timestamptz')
      .addColumn('closed_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('plans_period_type_check', sql`period_type in ('month', 'term', 'year')`)
      .addCheckConstraint('plans_status_check', sql`status in ('draft', 'active', 'closed')`)
      .execute();

    await database.schema
      .createTable('tasks')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('task_type', 'text', (column) => column.notNull())
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('description', 'text')
      .addColumn('assigner_user_id', 'uuid', (column) => column.notNull())
      .addColumn('assigner_name', 'text', (column) => column.notNull())
      .addColumn('assignee_staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('due_date', 'date')
      .addColumn('priority', 'text', (column) => column.notNull().defaultTo('normal'))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('todo'))
      .addColumn('progress_percent', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('plan_item_id', 'uuid')
      .addColumn('completed_at', 'timestamptz')
      .addColumn('cancel_reason', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('tasks_type_check', sql`task_type in ('assigned', 'personal')`)
      .addCheckConstraint('tasks_priority_check', sql`priority in ('low', 'normal', 'high')`)
      .addCheckConstraint('tasks_status_check', sql`status in ('todo', 'in_progress', 'done', 'cancelled')`)
      .addCheckConstraint('tasks_progress_check', sql`progress_percent between 0 and 100`)
      .execute();
    await database.schema.createIndex('tasks_assignee_index').on('tasks').column('assignee_staff_id').execute();
    await database.schema.createIndex('tasks_unit_index').on('tasks').columns(['org_unit_id', 'status']).execute();

    await database.schema
      .createTable('task_updates')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('task_id', 'uuid', (column) => column.notNull().references('tasks.id'))
      .addColumn('content', 'text')
      .addColumn('progress_percent', 'integer', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('task_updates_progress_check', sql`progress_percent between 0 and 100`)
      .execute();
    await database.schema.createIndex('task_updates_task_index').on('task_updates').column('task_id').execute();

    await database.schema
      .createTable('plan_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('plan_id', 'uuid', (column) => column.notNull().references('plans.id'))
      .addColumn('content', 'text', (column) => column.notNull())
      .addColumn('owner_staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('due_date', 'date', (column) => column.notNull())
      .addColumn('task_id', 'uuid', (column) => column.references('tasks.id'))
      .addColumn('order_no', 'integer', (column) => column.notNull())
      .execute();
    await database.schema.createIndex('plan_items_plan_index').on('plan_items').column('plan_id').execute();

    await database.schema
      .createTable('evaluation_criteria')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('weight', 'numeric(6, 2)', (column) => column.notNull())
      .addColumn('max_score', 'numeric(6, 2)', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('evaluation_criteria_unit_code_unique', ['org_unit_id', 'code'])
      .addCheckConstraint('evaluation_criteria_status_check', sql`status in ('active', 'inactive')`)
      .addCheckConstraint('evaluation_criteria_values_check', sql`weight > 0 and max_score > 0`)
      .execute();

    await database.schema
      .createTable('evaluations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('period_type', 'text', (column) => column.notNull())
      .addColumn('period_value', 'text', (column) => column.notNull())
      .addColumn('total_score', 'numeric(5, 2)', (column) => column.notNull())
      .addColumn('comment', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('replaces_id', 'uuid', (column) => column.references('evaluations.id'))
      .addColumn('reevaluation_reason', 'text')
      .addColumn('evaluated_by', 'uuid', (column) => column.notNull())
      .addColumn('evaluated_by_name', 'text', (column) => column.notNull())
      .addColumn('published_by', 'uuid')
      .addColumn('published_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('evaluations_period_type_check', sql`period_type in ('month', 'term', 'year')`)
      .addCheckConstraint('evaluations_status_check', sql`status in ('draft', 'published', 'superseded')`)
      .addCheckConstraint('evaluations_score_check', sql`total_score between 0 and 100`)
      .addCheckConstraint(
        'evaluations_reevaluation_check',
        sql`replaces_id is null or (reevaluation_reason is not null and reevaluation_reason <> '')`,
      )
      .execute();
    // Mỗi nhân sự mỗi kỳ có tối đa một phiếu nháp và một phiếu đã công bố còn hiệu lực (BR-47)
    await sql`create unique index evaluations_draft_unique on evaluations (staff_id, period_type, period_value)
      where status = 'draft'`.execute(database);
    await sql`create unique index evaluations_published_unique on evaluations (staff_id, period_type, period_value)
      where status = 'published'`.execute(database);

    await database.schema
      .createTable('evaluation_scores')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('evaluation_id', 'uuid', (column) => column.notNull().references('evaluations.id'))
      .addColumn('criterion_id', 'uuid', (column) => column.notNull().references('evaluation_criteria.id'))
      .addColumn('criterion_code', 'text', (column) => column.notNull())
      .addColumn('criterion_name', 'text', (column) => column.notNull())
      .addColumn('weight', 'numeric(6, 2)', (column) => column.notNull())
      .addColumn('max_score', 'numeric(6, 2)', (column) => column.notNull())
      .addColumn('score', 'numeric(6, 2)', (column) => column.notNull())
      .addColumn('comment', 'text')
      .addUniqueConstraint('evaluation_scores_unique', ['evaluation_id', 'criterion_id'])
      .addCheckConstraint('evaluation_scores_range_check', sql`score >= 0 and score <= max_score`)
      .execute();

    await database.schema
      .createTable('staff_work_history')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('from_date', 'date', (column) => column.notNull())
      .addColumn('to_date', 'date')
      .addColumn('department_id', 'uuid', (column) => column.references('departments.id'))
      .addColumn('job_title_id', 'uuid', (column) => column.references('job_titles.id'))
      .addColumn('note', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('staff_work_history_range_check', sql`to_date is null or to_date >= from_date`)
      .execute();
    await database.schema
      .createIndex('staff_work_history_staff_index')
      .on('staff_work_history')
      .column('staff_id')
      .execute();

    await database.schema
      .createTable('staff_certificates')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('certificate_no', 'text')
      .addColumn('issued_by', 'text', (column) => column.notNull())
      .addColumn('issued_date', 'date', (column) => column.notNull())
      .addColumn('expire_date', 'date')
      .addColumn('note', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('staff_certificates_range_check', sql`expire_date is null or expire_date >= issued_date`)
      .execute();
    await database.schema
      .createIndex('staff_certificates_staff_index')
      .on('staff_certificates')
      .column('staff_id')
      .execute();

    await database.schema
      .createTable('staff_bonus_deductions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('pay_item_type_id', 'uuid', (column) => column.notNull().references('pay_item_types.id'))
      .addColumn('target_year', 'integer', (column) => column.notNull())
      .addColumn('target_month', 'integer', (column) => column.notNull())
      .addColumn('amount', 'numeric(14, 0)', (column) => column.notNull())
      .addColumn('basis', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('cancelled_by', 'uuid')
      .addColumn('cancelled_at', 'timestamptz')
      .addColumn('cancel_reason', 'text')
      .addCheckConstraint('staff_bonus_deductions_amount_check', sql`amount > 0`)
      .addCheckConstraint('staff_bonus_deductions_month_check', sql`target_month between 1 and 12`)
      .addCheckConstraint('staff_bonus_deductions_status_check', sql`status in ('active', 'cancelled')`)
      .addCheckConstraint('staff_bonus_deductions_basis_check', sql`basis <> ''`)
      .execute();
    await database.schema
      .createIndex('staff_bonus_deductions_month_index')
      .on('staff_bonus_deductions')
      .columns(['target_year', 'target_month', 'status'])
      .execute();
  },

  async down(database) {
    for (const table of [
      'staff_bonus_deductions',
      'staff_certificates',
      'staff_work_history',
      'evaluation_scores',
      'evaluations',
      'evaluation_criteria',
      'plan_items',
      'task_updates',
      'tasks',
      'plans',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
