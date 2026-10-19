import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-17 phần 17b (YCTD-133): phân hệ Quản lý kí hồ sơ theo bốn mẫu thật của Sở (khảo sát ngày 2026-10-19), vẫn là bản chạy
// nội bộ, không kí số thật:
// - kiểu chữ ký còn hai giá trị như biểu mẫu của Sở (REMOTE SIGNING, USB TOKEN); chứng thư kiểu HSM đã khai báo chuyển thành
//   REMOTE SIGNING, ghi một dòng lịch sử để người dùng biết;
// - signing_dossiers thêm tệp dữ liệu XML của hồ sơ (gốc mang mã loại HO_SO_TRUONG, HO_SO_LOP, HO_SO_NHAN_SU, HO_SO_HOC_SINH)
//   kèm mã băm; hồ sơ lập trước phần 17b không có tệp XML. Cột note là ghi chú của hồ sơ trên lưới 2.2, 2.3;
// - signing_create_errors: đối tượng tạo hồ sơ không được kèm lý do, mỗi đối tượng giữ lần lỗi gần nhất, xóa khi tạo được hồ
//   sơ; dùng cho cột Ghi chú và nút "Tải file lỗi" của 2.2.
const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000000';

export const migration: Migration = {
  async up(database) {
    const converted = await sql<{ id: string }>`update signing_certificates set signature_type = 'remote',
      updated_at = now() where signature_type = 'hsm' returning id`.execute(database);
    if (converted.rows.length > 0) {
      await sql`insert into signing_events (dossier_id, action, note, actor_id, actor_name)
        values (null, 'certificate_save', 'Chuyển kiểu chữ ký HSM thành REMOTE SIGNING theo biểu mẫu của Sở (DT-17 phần 17b)',
        ${SYSTEM_ACTOR}, 'Hệ thống')`.execute(database);
    }
    await sql`alter table signing_certificates drop constraint signing_certificates_type_check`.execute(database);
    await sql`alter table signing_certificates add constraint signing_certificates_type_check
      check (signature_type in ('remote', 'usb_token'))`.execute(database);

    await database.schema
      .alterTable('signing_dossiers')
      .addColumn('xml_file_name', 'text')
      .addColumn('xml_storage_key', 'text')
      .addColumn('xml_sha256', 'text')
      .addColumn('xml_size_bytes', 'integer')
      .addColumn('note', 'text')
      .execute();

    await database.schema
      .createTable('signing_create_errors')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('academic_year_id', 'uuid', (column) => column.notNull().references('academic_years.id'))
      .addColumn('object_type', 'text', (column) => column.notNull())
      .addColumn('object_id', 'uuid', (column) => column.notNull())
      .addColumn('period', 'text', (column) => column.notNull().defaultTo(''))
      .addColumn('object_label', 'text', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('signing_create_errors_object_unique', [
        'academic_year_id',
        'object_type',
        'object_id',
        'period',
      ])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('signing_create_errors').execute();
    await database.schema
      .alterTable('signing_dossiers')
      .dropColumn('xml_file_name')
      .dropColumn('xml_storage_key')
      .dropColumn('xml_sha256')
      .dropColumn('xml_size_bytes')
      .dropColumn('note')
      .execute();
    await sql`alter table signing_certificates drop constraint signing_certificates_type_check`.execute(database);
    await sql`alter table signing_certificates add constraint signing_certificates_type_check
      check (signature_type in ('remote', 'usb_token', 'hsm'))`.execute(database);
  },
};
