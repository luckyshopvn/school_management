import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Bằng chứng đồng ý xử lý dữ liệu thật và vùng máy chủ (DT-SaaS phần S2, YCTD-193), theo danh sách trường dữ liệu ở
// tai_lieu/48_HO_SO_PHAP_LY/00_MUC_LUC.md mục 3 (S8a):
// - `school_consents`: một dòng mỗi văn bản đã ký (dpa PL-02, consent PL-03, impact-assessment PL-06, PL-07, risk-acceptance
//   PL-09), có mã mẫu, phiên bản mẫu, người ký, thời hạn, phạm vi dữ liệu, ảnh chụp vùng máy chủ tại ngày ký, mã băm và khóa
//   lưu bản quét, ngày nộp cơ quan, ngày rút đồng ý. Trường `consented` phải có đủ bốn loại còn hiệu lực;
// - `school_hosting`: một dòng mỗi dịch vụ lưu, chuyển tiếp dữ liệu của trường (PL-08)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('school_consents')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('template_code', 'text', (column) => column.notNull())
      .addColumn('template_version', 'text', (column) => column.notNull())
      .addColumn('signer_name', 'text', (column) => column.notNull())
      .addColumn('signer_title', 'text', (column) => column.notNull())
      .addColumn('signed_on', 'date', (column) => column.notNull())
      .addColumn('valid_from', 'date', (column) => column.notNull())
      .addColumn('valid_until', 'date')
      .addColumn('data_scope', 'text', (column) => column.notNull())
      .addColumn('hosting_snapshot', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('file_sha256', 'text', (column) => column.notNull())
      .addColumn('file_key', 'text')
      .addColumn('file_name', 'text')
      .addColumn('submitted_to_authority_on', 'date')
      .addColumn('authority_reference', 'text')
      .addColumn('recorded_by', 'uuid')
      .addColumn('recorded_by_name', 'text', (column) => column.notNull())
      .addColumn('withdrawn_on', 'date')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'school_consents_kind_check',
        sql`kind in ('dpa', 'consent', 'impact-assessment', 'risk-acceptance')`,
      )
      .addCheckConstraint('school_consents_sha256_check', sql`file_sha256 ~ '^[0-9a-f]{64}$'`)
      .execute();

    await database.schema
      .createTable('school_hosting')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('provider', 'text', (column) => column.notNull())
      .addColumn('service', 'text', (column) => column.notNull())
      .addColumn('region', 'text', (column) => column.notNull())
      .addColumn('role', 'text', (column) => column.notNull().defaultTo('subprocessor'))
      .addColumn('stores_personal_data', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('started_on', 'date', (column) => column.notNull())
      .addColumn('ended_on', 'date')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('school_hosting_role_check', sql`role in ('subprocessor', 'transit')`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('school_hosting').execute();
    await database.schema.dropTable('school_consents').execute();
  },
};
