import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Kho minh chứng, lát L2 (YCTD-396): nguồn là bản ghi trong phần mềm có thể là khóa ghép (lớp và học kỳ của sổ điểm, lớp và
// tháng của điểm danh, kỳ báo cáo), nên mã bản ghi lưu dạng chữ thay vì uuid. Giá trị cũ là uuid nên đổi kiểu không mất dữ liệu
export const migration: Migration = {
  async up(database) {
    await sql`alter table evidence_versions alter column record_id type text using record_id::text`.execute(database);
    await sql`alter table evidence_versions add constraint evidence_versions_record_id_length
      check (char_length(record_id) <= 200)`.execute(database);
  },
  async down(database) {
    await sql`alter table evidence_versions drop constraint evidence_versions_record_id_length`.execute(database);
    // Khóa ghép không đổi được về uuid: bỏ liên kết nguồn của các phiên bản đó, giữ nhãn và tệp đã chụp
    await sql`update evidence_versions set record_id = null, source_kind = 'upload'
      where record_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and storage_key is not null`.execute(
      database,
    );
    await sql`delete from evidence_versions
      where record_id is not null and record_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`.execute(
      database,
    );
    await sql`alter table evidence_versions alter column record_id type uuid using record_id::uuid`.execute(database);
  },
};
