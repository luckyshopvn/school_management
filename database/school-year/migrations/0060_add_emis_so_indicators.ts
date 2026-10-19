import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Biểu EMIS theo đúng chỉ tiêu và mã số của Sở (DT-17 phần 17a, YCTD-132; khảo sát mục 10.4, chênh lệch E1–E11):
// - trẻ: đối tượng chính sách theo từng nghị định (chỉ tiêu 112–116 của Biểu 01.ĐN-MN);
// - nhân sự: kiêm nhiệm hỗ trợ giáo dục người khuyết tật, kiêm nhiệm vị trí việc làm chuyên môn dùng chung (152, 153, 182);
// - phòng: xây dựng mới trong năm (cột "Xây dựng mới" của 1.2.1 Báo cáo cơ sở vật chất của TP.HCM);
// - đánh dấu đã gửi từng hồ sơ ở 1.1.2 Gửi báo cáo đầu năm (bản chạy nội bộ: xuất tệp và đánh dấu, không truyền đi).
// Số liệu nhập tay theo mã cũ của thẻ Ngân sách nhà nước (6.01–6.06) và 2.3 Đề án ngoại ngữ không đổi được sang mã của Sở
// nên xóa (chưa có đơn vị nào nộp thật, tài liệu 32 mục 8.3)
const POLICY_BENEFITS = ['nd238_learning_cost', 'nd66_nursery_boarding', 'nd57_small_ethnic', 'nd105_lunch', 'nd105_allowance'];
const RECORD_TYPES = ['school', 'staff', 'class', 'child', 'health_first_term'];

export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('children')
      .addColumn('policy_benefits', sql`text[]`, (column) =>
        column
          .notNull()
          .defaultTo(sql`'{}'::text[]`)
          .check(sql`policy_benefits <@ array[${sql.join(POLICY_BENEFITS.map((value) => sql.lit(value)))}]::text[]`),
      )
      .execute();
    await database.schema
      .alterTable('staff')
      .addColumn('concurrent_disability_support', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('concurrent_shared_position', 'boolean', (column) => column.notNull().defaultTo(false))
      .execute();
    await database.schema
      .alterTable('rooms')
      .addColumn('built_this_year', 'boolean', (column) => column.notNull().defaultTo(false))
      .execute();
    await database.schema
      .createTable('emis_record_submissions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('record_type', 'text', (column) =>
        column.notNull().check(sql`record_type in (${sql.join(RECORD_TYPES.map((value) => sql.lit(value)))})`),
      )
      .addColumn('entity_id', 'uuid', (column) => column.notNull())
      .addColumn('batch_id', 'uuid', (column) => column.notNull())
      .addColumn('sent_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('sent_by', 'uuid', (column) => column.notNull())
      .addColumn('sent_by_name', 'text', (column) => column.notNull())
      .addUniqueConstraint('emis_record_submissions_entity_unique', ['record_type', 'entity_id'])
      .execute();
    await database.schema
      .createIndex('emis_record_submissions_batch_idx')
      .on('emis_record_submissions')
      .columns(['record_type', 'batch_id'])
      .execute();
    await sql`
      delete from emis_report_values
      where (form_code = 'emis-start-of-year' and tab_key = 'budget') or form_code = 'emis-foreign-language'
    `.execute(database);
  },
  async down(database) {
    await database.schema.dropTable('emis_record_submissions').execute();
    await database.schema.alterTable('rooms').dropColumn('built_this_year').execute();
    await database.schema
      .alterTable('staff')
      .dropColumn('concurrent_disability_support')
      .dropColumn('concurrent_shared_position')
      .execute();
    await database.schema.alterTable('children').dropColumn('policy_benefits').execute();
  },
};
