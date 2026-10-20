import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 18c (YCTD-141): giao việc theo VNPT iOffice mở rộng bảng việc của phân hệ Quản lý công việc đã có, không tạo
// bảng việc thứ hai (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
// - `tasks` thêm loại 'directive' (giao việc theo cây đơn vị): lãnh đạo giao việc, số ngày thực hiện, ngày bắt đầu, nhắc việc
//   cho người giao việc, nhắc việc định kì, văn bản đến làm căn cứ (ở cơ sở dữ liệu hệ thống nên không có khóa ngoại), văn
//   bản liên quan. Việc loại này không có một người nhận nên assignee_staff_id để trống;
// - `task_assignments`: phân công thực hiện, mỗi dòng là một vai (xử lý chính, phối hợp, theo dõi) giao cho một đơn vị, một
//   phòng ban hoặc một cá nhân, có ngày bắt đầu, ngày hết hạn, tiến độ, kết quả phê duyệt; parent_id là dòng của đơn vị đã
//   phân công tiếp cho cá nhân;
// - `task_updates` thêm assignment_id: cập nhật tiến độ của từng dòng phân công;
// - `task_files`: tệp đính kèm của việc, nội dung ở kho tệp kèm mã băm SHA-256.
export const migration: Migration = {
  async up(database) {
    await sql`alter table tasks drop constraint tasks_type_check`.execute(database);
    await sql`alter table tasks add constraint tasks_type_check
      check (task_type in ('assigned', 'personal', 'directive'))`.execute(database);
    await sql`alter table tasks alter column assignee_staff_id drop not null`.execute(database);
    await sql`alter table tasks add constraint tasks_assignee_check
      check (task_type = 'directive' or assignee_staff_id is not null)`.execute(database);
    await database.schema
      .alterTable('tasks')
      .addColumn('leader_user_id', 'uuid')
      .addColumn('leader_name', 'text')
      .addColumn('start_date', 'date')
      .addColumn('duration_days', 'integer')
      .addColumn('remind_assigner', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('assigner_reminded_at', 'timestamptz')
      .addColumn('recurrence', 'text', (column) => column.notNull().defaultTo('none'))
      .addColumn('next_reminder_on', 'date')
      .addColumn('source_document_id', 'uuid')
      .addColumn('source_document_label', 'text')
      .addColumn('related_documents', 'text')
      .execute();
    await sql`alter table tasks add constraint tasks_recurrence_check
      check (recurrence in ('none', 'daily', 'weekly', 'monthly'))`.execute(database);
    await sql`alter table tasks add constraint tasks_duration_check
      check (duration_days is null or duration_days between 1 and 3650)`.execute(database);
    await database.schema
      .createIndex('tasks_source_document_index')
      .on('tasks')
      .column('source_document_id')
      .where(sql.ref('source_document_id'), 'is not', null)
      .execute();

    await database.schema
      .createTable('task_assignments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('task_id', 'uuid', (column) => column.notNull().references('tasks.id').onDelete('cascade'))
      .addColumn('parent_id', 'uuid', (column) => column.references('task_assignments.id').onDelete('set null'))
      .addColumn('role', 'text', (column) => column.notNull())
      .addColumn('target_type', 'text', (column) => column.notNull())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('department_id', 'uuid', (column) => column.references('departments.id'))
      .addColumn('staff_id', 'uuid', (column) => column.references('staff.id'))
      .addColumn('start_date', 'date', (column) => column.notNull())
      .addColumn('due_date', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('todo'))
      .addColumn('progress_percent', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('approval_result', 'text')
      .addColumn('approval_note', 'text')
      .addColumn('approved_by_name', 'text')
      .addColumn('approved_at', 'timestamptz')
      .addColumn('result_note', 'text')
      .addColumn('completed_at', 'timestamptz')
      .addColumn('assigned_by', 'uuid', (column) => column.notNull())
      .addColumn('assigned_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('task_assignments_role_check', sql`role in ('main', 'coordinate', 'follow')`)
      .addCheckConstraint(
        'task_assignments_target_check',
        sql`(target_type = 'staff' and staff_id is not null)
          or (target_type = 'unit' and staff_id is null)`,
      )
      .addCheckConstraint(
        'task_assignments_status_check',
        sql`status in ('todo', 'in_progress', 'pending_approval', 'done', 'cancelled')`,
      )
      .addCheckConstraint(
        'task_assignments_approval_check',
        sql`approval_result is null or approval_result in ('done', 'not_done')`,
      )
      .addCheckConstraint('task_assignments_progress_check', sql`progress_percent between 0 and 100`)
      .addCheckConstraint('task_assignments_dates_check', sql`due_date >= start_date`)
      .execute();
    await database.schema
      .createIndex('task_assignments_task_index')
      .on('task_assignments')
      .column('task_id')
      .execute();
    await database.schema
      .createIndex('task_assignments_staff_index')
      .on('task_assignments')
      .columns(['staff_id', 'status'])
      .execute();
    await database.schema
      .createIndex('task_assignments_unit_index')
      .on('task_assignments')
      .columns(['org_unit_id', 'status'])
      .execute();

    await database.schema
      .alterTable('task_updates')
      .addColumn('assignment_id', 'uuid', (column) => column.references('task_assignments.id').onDelete('cascade'))
      .execute();

    await database.schema
      .createTable('task_files')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('task_id', 'uuid', (column) => column.notNull().references('tasks.id').onDelete('cascade'))
      .addColumn('file_name', 'text', (column) => column.notNull())
      .addColumn('content_type', 'text', (column) => column.notNull())
      .addColumn('size_bytes', 'integer', (column) => column.notNull())
      .addColumn('sha256', 'text', (column) => column.notNull())
      .addColumn('storage_key', 'text', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema.createIndex('task_files_task_index').on('task_files').column('task_id').execute();
  },
  async down(database) {
    await database.schema.dropTable('task_files').execute();
    await database.schema.alterTable('task_updates').dropColumn('assignment_id').execute();
    await database.schema.dropTable('task_assignments').execute();
    await sql`delete from task_updates where task_id in (select id from tasks where task_type = 'directive')`.execute(
      database,
    );
    await sql`delete from tasks where task_type = 'directive'`.execute(database);
    await database.schema.dropIndex('tasks_source_document_index').execute();
    await sql`alter table tasks drop constraint tasks_duration_check`.execute(database);
    await sql`alter table tasks drop constraint tasks_recurrence_check`.execute(database);
    await database.schema
      .alterTable('tasks')
      .dropColumn('leader_user_id')
      .dropColumn('leader_name')
      .dropColumn('start_date')
      .dropColumn('duration_days')
      .dropColumn('remind_assigner')
      .dropColumn('assigner_reminded_at')
      .dropColumn('recurrence')
      .dropColumn('next_reminder_on')
      .dropColumn('source_document_id')
      .dropColumn('source_document_label')
      .dropColumn('related_documents')
      .execute();
    await sql`alter table tasks drop constraint tasks_assignee_check`.execute(database);
    await sql`alter table tasks alter column assignee_staff_id set not null`.execute(database);
    await sql`alter table tasks drop constraint tasks_type_check`.execute(database);
    await sql`alter table tasks add constraint tasks_type_check
      check (task_type in ('assigned', 'personal'))`.execute(database);
  },
};
