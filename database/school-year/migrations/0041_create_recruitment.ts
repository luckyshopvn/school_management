import { sql, type CreateTableBuilder } from 'kysely';
import type { Migration } from 'kysely/migration';

// Tuyển dụng (P18-01 đến P18-04; BR-37, BR-69, BR-74, BR-75, BR-80; YCTD-87): đề nghị tuyển dụng trình Ban Giám hiệu, tin
// tuyển dụng công bố công khai, hồ sơ ứng viên (nộp qua trang công khai hoặc nhân sự nhập), phỏng vấn và quyết định tuyển.
// Không xóa cứng (BR-75): đề nghị, tin, ứng viên, lịch phỏng vấn chỉ đổi trạng thái. Tệp hồ sơ xin việc lưu ở bảng tệp
// dùng chung với mục đích candidate_cv
const PREVIOUS_PURPOSES = `'birth_certificate', 'photo_consent', 'import', 'pickup_photo', 'payment_voucher', 'medicine_photo', 'prescription', 'activity_photo', 'content_file'`;

function withId<Table extends string>(table: CreateTableBuilder<Table>) {
  return table.addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`));
}

function withTimestamps<Table extends string>(table: CreateTableBuilder<Table>) {
  return table
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`));
}

export const migration: Migration = {
  async up(database) {
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}, 'candidate_cv'))`.execute(database);

    // Đề nghị tuyển dụng (P18-01): trình duyệt ngay khi lập; duyệt hoặc từ chối ghi người, thời điểm, lý do (BR-80)
    await withTimestamps(
      withId(database.schema.createTable('recruitment_requests'))
        .addColumn('code', 'text', (column) => column.notNull().unique())
        .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
        .addColumn('position', 'text', (column) => column.notNull())
        .addColumn('quantity', 'integer', (column) => column.notNull())
        .addColumn('requirements', 'text', (column) => column.notNull())
        .addColumn('reason', 'text', (column) => column.notNull())
        .addColumn('needed_by', 'date')
        .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
        .addColumn('requester_id', 'uuid', (column) => column.notNull())
        .addColumn('requester_name', 'text', (column) => column.notNull())
        .addColumn('approved_by', 'uuid')
        .addColumn('approver_name', 'text')
        .addColumn('approved_at', 'timestamptz')
        .addColumn('reject_reason', 'text')
        .addColumn('closed_by', 'uuid')
        .addColumn('closed_at', 'timestamptz')
        .addColumn('close_reason', 'text'),
    )
      .addCheckConstraint('recruitment_requests_quantity_check', sql`quantity between 1 and 1000`)
      .addCheckConstraint(
        'recruitment_requests_status_check',
        sql`status in ('pending', 'approved', 'rejected', 'closed')`,
      )
      .addCheckConstraint(
        'recruitment_requests_reject_reason_check',
        sql`status <> 'rejected' or reject_reason is not null`,
      )
      .execute();
    await database.schema
      .createIndex('recruitment_requests_unit_status_index')
      .on('recruitment_requests')
      .columns(['org_unit_id', 'status'])
      .execute();

    // Tin tuyển dụng (P18-02): chỉ lập từ đề nghị đã duyệt; công bố thì người ngoài xem và nộp hồ sơ đến hết hạn nộp
    await withTimestamps(
      withId(database.schema.createTable('job_postings'))
        .addColumn('request_id', 'uuid', (column) => column.notNull().references('recruitment_requests.id'))
        .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
        .addColumn('title', 'text', (column) => column.notNull())
        .addColumn('description', 'text', (column) => column.notNull())
        .addColumn('requirements', 'text', (column) => column.notNull())
        .addColumn('deadline', 'date', (column) => column.notNull())
        .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
        .addColumn('published_at', 'timestamptz')
        .addColumn('published_by', 'uuid')
        .addColumn('closed_at', 'timestamptz')
        .addColumn('closed_by', 'uuid')
        .addColumn('created_by', 'uuid', (column) => column.notNull()),
    )
      .addCheckConstraint('job_postings_status_check', sql`status in ('draft', 'published', 'closed')`)
      .execute();
    await database.schema
      .createIndex('job_postings_status_deadline_index')
      .on('job_postings')
      .columns(['status', 'deadline'])
      .execute();

    // Hồ sơ ứng viên (P18-03): dữ liệu cá nhân, chỉ người có quyền P18 trong phạm vi đơn vị xem; mỗi số điện thoại nộp
    // một lần cho một tin. created_by trống là ứng viên tự nộp qua trang công khai (kèm thời điểm đồng ý xử lý dữ liệu)
    await withTimestamps(
      withId(database.schema.createTable('candidates'))
        .addColumn('posting_id', 'uuid', (column) => column.notNull().references('job_postings.id'))
        .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
        .addColumn('full_name', 'text', (column) => column.notNull())
        .addColumn('dob', 'date')
        .addColumn('gender', 'text')
        .addColumn('phone', 'text', (column) => column.notNull())
        .addColumn('email', 'text')
        .addColumn('address', 'text')
        .addColumn('source', 'text', (column) => column.notNull())
        .addColumn('cv_file_id', 'uuid', (column) => column.references('files.id'))
        .addColumn('cover_letter', 'text')
        .addColumn('consent_at', 'timestamptz')
        .addColumn('status', 'text', (column) => column.notNull().defaultTo('new'))
        .addColumn('status_reason', 'text')
        .addColumn('note', 'text')
        .addColumn('decided_by', 'uuid')
        .addColumn('decided_at', 'timestamptz')
        .addColumn('decision_note', 'text')
        .addColumn('staff_id', 'uuid', (column) => column.unique().references('staff.id'))
        .addColumn('created_by', 'uuid'),
    )
      .addCheckConstraint('candidates_gender_check', sql`gender is null or gender in ('male', 'female')`)
      .addCheckConstraint(
        'candidates_source_check',
        sql`source in ('website', 'referral', 'job_board', 'social_media', 'walk_in', 'other')`,
      )
      .addCheckConstraint(
        'candidates_status_check',
        sql`status in ('new', 'screening', 'interviewing', 'hired', 'rejected', 'withdrawn')`,
      )
      .addCheckConstraint('candidates_staff_check', sql`staff_id is null or status = 'hired'`)
      .addUniqueConstraint('candidates_posting_phone_unique', ['posting_id', 'phone'] as never)
      .execute();
    await database.schema
      .createIndex('candidates_unit_status_index')
      .on('candidates')
      .columns(['org_unit_id', 'status'])
      .execute();

    // Phỏng vấn (P18-04): người phỏng vấn chọn từ hồ sơ nhân sự; kết quả đạt hoặc không đạt, điểm 0 đến 10, đánh giá
    await withTimestamps(
      withId(database.schema.createTable('interviews'))
        .addColumn('candidate_id', 'uuid', (column) => column.notNull().references('candidates.id'))
        .addColumn('round', 'integer', (column) => column.notNull())
        .addColumn('scheduled_at', 'timestamptz', (column) => column.notNull())
        .addColumn('location', 'text', (column) => column.notNull())
        .addColumn('interviewer_staff_ids', sql`uuid[]`, (column) => column.notNull())
        .addColumn('status', 'text', (column) => column.notNull().defaultTo('scheduled'))
        .addColumn('result', 'text')
        .addColumn('score', 'numeric(4, 1)')
        .addColumn('evaluation', 'text')
        .addColumn('cancel_reason', 'text')
        .addColumn('recorded_by', 'uuid')
        .addColumn('recorded_at', 'timestamptz')
        .addColumn('created_by', 'uuid', (column) => column.notNull()),
    )
      .addCheckConstraint('interviews_status_check', sql`status in ('scheduled', 'completed', 'cancelled')`)
      .addCheckConstraint('interviews_result_check', sql`result is null or result in ('passed', 'failed')`)
      .addCheckConstraint('interviews_completed_check', sql`status <> 'completed' or result is not null`)
      .addCheckConstraint('interviews_score_check', sql`score is null or score between 0 and 10`)
      .execute();
    await database.schema
      .createIndex('interviews_candidate_index')
      .on('interviews')
      .columns(['candidate_id'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('interviews').execute();
    await database.schema.dropTable('candidates').execute();
    await database.schema.dropTable('job_postings').execute();
    await database.schema.dropTable('recruitment_requests').execute();
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}))`.execute(database);
  },
};
