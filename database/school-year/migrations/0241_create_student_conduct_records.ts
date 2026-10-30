import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Giám thị và rèn luyện từng học sinh, lát L2 (YCTD-391): ghi nhận vi phạm, khen của từng học sinh. Mỗi học sinh một dòng; mục
// nội quy, loại chép lại lúc ghi để đổi danh mục không đổi ghi nhận cũ. Mục nội quy có gắn tiêu chí nề nếp lớp thì ghi thêm một
// dòng điểm cho lớp (`class_conduct_entry_id`). Thu hồi không xóa dòng: ghi người, lý do, thời điểm; dòng điểm lớp đi kèm bị xóa.
// Ảnh bằng chứng là tệp mục đích `conduct_evidence`, tối đa 3 tệp. Ghi nhận không tự trừ điểm, không tự xếp mức rèn luyện
const PREVIOUS_PURPOSES = `'birth_certificate', 'photo_consent', 'import', 'pickup_photo', 'payment_voucher', 'medicine_photo', 'prescription', 'activity_photo', 'content_file', 'candidate_cv', 'final_year_document', 'admission_document', 'kpi_evidence', 'professional_record'`;

export const migration: Migration = {
  async up(database) {
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}, 'conduct_evidence'))`.execute(database);
    await database.schema
      .createTable('student_conduct_records')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('rule_item_id', 'uuid', (column) => column.notNull().references('student_rule_items.id'))
      .addColumn('rule_name', 'text', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('occurred_at', 'timestamptz', (column) => column.notNull())
      .addColumn('zone_id', 'uuid', (column) => column.references('school_zones.id'))
      .addColumn('description', 'text', (column) => column.check(sql`char_length(description) <= 500`))
      .addColumn('evidence_file_ids', sql`uuid[]`, (column) =>
        column
          .notNull()
          .defaultTo(sql`'{}'::uuid[]`)
          .check(sql`cardinality(evidence_file_ids) <= 3`),
      )
      // Nguồn: ghi tay; lát sau thêm cổng trường, cảnh báo camera
      .addColumn('source', 'text', (column) => column.notNull().defaultTo('manual'))
      .addColumn('class_conduct_entry_id', 'uuid', (column) => column.references('conduct_entries.id').onDelete('set null'))
      .addColumn('recorded_by', 'uuid', (column) => column.notNull())
      .addColumn('recorded_by_name', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('revoked_reason', 'text', (column) => column.check(sql`char_length(revoked_reason) <= 500`))
      .addColumn('revoked_by_name', 'text')
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('student_conduct_records_kind_check', sql`kind in ('violation', 'commendation')`)
      .addCheckConstraint('student_conduct_records_source_check', sql`source in ('manual', 'gate', 'camera_alert')`)
      .addCheckConstraint(
        'student_conduct_records_status_check',
        sql`(status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null and revoked_reason is not null)`,
      )
      .execute();
    await database.schema
      .createIndex('student_conduct_records_child_index')
      .on('student_conduct_records')
      .columns(['child_id', 'occurred_at'])
      .execute();
    await database.schema
      .createIndex('student_conduct_records_class_index')
      .on('student_conduct_records')
      .columns(['class_id', 'occurred_at'])
      .execute();
    await database.schema
      .createIndex('student_conduct_records_recorder_index')
      .on('student_conduct_records')
      .columns(['recorded_by', 'occurred_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('student_conduct_records').execute();
    await sql`delete from files where purpose = 'conduct_evidence'`.execute(database);
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}))`.execute(database);
  },
};
