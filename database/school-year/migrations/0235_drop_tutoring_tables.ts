import { sql, type Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';
import { assertRemovedDataBackedUp } from '../../src/removed-data-log.js';

// Bỏ chương trình gia sư trong trường DT-27 (YCTD-393 lát L3, quyết định của Eric ngày 2026-10-30): xóa các bảng gia sư do 0152 đến
// 0156, 0161, 0200, 0201 tạo. Số 0235 đến 0239 dành cho YCTD-393. Trước khi xóa, mỗi bảng còn dữ liệu phải có bản ghi sao lưu cùng số
// dòng hiện tại trong removed_data_backups của chính cơ sở dữ liệu này (lệnh TUTORING_BACKUP_COMMAND); thiếu thì dừng.
// - Hóa đơn đã phát hành giữ dòng `tutoring` cũ (số tiền, nội dung), chỉ bỏ cột nối `invoice_items.tutoring_registration_id`.
// - Phòng video của buổi gia sư (`kind = 'session'`) cùng phòng chờ, nhật ký vào ra của phòng đó bị xóa; phòng tức thời giữ nguyên.
//   Bảng ghi hình (`video_recordings`, đồng ý ghi hình, nhật ký xem) chỉ phục vụ buổi gia sư nên xóa cùng.
// - Giữ `video_settings`, `video_rooms`, `video_room_admissions`, `video_room_events`; khoản mục lương "Thù lao dạy phụ đạo, bồi
//   dưỡng" do 0156 nạp giữ lại vì dòng lương đã lập có thể trỏ tới, chỉ chuyển sang ngừng dùng.
// Không có bước lùi: dữ liệu nằm trong tệp sao lưu, khôi phục từ tệp đó.
export const TUTORING_FEATURE = 'gia-su-trong-truong';
export const TUTORING_BACKUP_COMMAND =
  'pnpm --filter @school-management/database xoa-du-lieu-da-bo -- --tinh-nang gia-su-trong-truong';

// Bảng xóa ở bước đầu: không bảng nào ngoài nhóm gia sư trỏ tới
const LEAF_TABLES = [
  'tutoring_credit_applications',
  'tutoring_credits',
  'tutoring_charge_sessions',
  'tutoring_teacher_pay',
  'tutoring_attendance',
  'tutoring_room_events',
  'video_recording_views',
  'video_recordings',
  'video_recording_consents',
  'tutoring_media_views',
  'tutoring_program_courses',
  'tutoring_question_marks',
  'tutoring_ai_answers',
  'tutoring_ai_consents',
  'tutoring_exemption_children',
  'tutoring_exemptions',
];
// Bảng xóa sau khi đã bỏ cột nối của `invoice_items`, `video_rooms`
const ROOT_TABLES = [
  'tutoring_registrations',
  'tutoring_sessions',
  'tutoring_program_teachers',
  'tutoring_program_classes',
  'tutoring_program_candidates',
  'tutoring_programs',
  'tutoring_rules',
];
// Mọi bảng bị xóa, theo thứ tự xóa
export const TUTORING_TABLES: readonly string[] = [...LEAF_TABLES, ...ROOT_TABLES];
const TUTORING_PAY_ITEM_CODE = 'THU_LAO_DAY_THEM';

async function hasColumn(database: Kysely<unknown>, table: string, column: string): Promise<boolean> {
  const result = await sql<{ found: boolean }>`
    select exists(select 1 from information_schema.columns
      where table_schema = current_schema() and table_name = ${table} and column_name = ${column}) as found`.execute(
    database,
  );
  return result.rows[0]?.found === true;
}

// Bảng cần kiểm sao lưu. `tutoring_rules` chỉ có dòng 0152 nạp sẵn (cấu hình dựng lại được từ 0152, có ở mọi cơ sở dữ liệu năm học
// kể cả năm mới tạo) thì không cần sao lưu; có dòng khác thì phải sao lưu như các bảng còn lại
async function tablesToCheck(database: Kysely<unknown>): Promise<readonly string[]> {
  const exists = await sql<{ found: boolean }>`select to_regclass('tutoring_rules') is not null as found`.execute(
    database,
  );
  if (!exists.rows[0]?.found) {
    return TUTORING_TABLES;
  }
  const other = await sql<{ found: boolean }>`
    select exists(select 1 from tutoring_rules
      where not (effective_from = date '2026-05-15' and created_by_name = 'Hệ thống')) as found`.execute(database);
  return other.rows[0]?.found ? TUTORING_TABLES : TUTORING_TABLES.filter((table) => table !== 'tutoring_rules');
}

async function dropTables(database: Kysely<unknown>, tables: readonly string[]): Promise<void> {
  for (const table of tables) {
    // Không dùng cascade: bảng ngoài nhóm gia sư còn trỏ tới thì dừng thay vì xóa ngầm ràng buộc của bảng đó
    await sql`drop table if exists ${sql.table(table)}`.execute(database);
  }
}

export const migration: Migration = {
  async up(database) {
    await assertRemovedDataBackedUp(database, TUTORING_FEATURE, await tablesToCheck(database), TUTORING_BACKUP_COMMAND);

    await sql`alter table invoice_items drop column if exists tutoring_registration_id`.execute(database);
    await dropTables(database, LEAF_TABLES);

    if (await hasColumn(database, 'video_rooms', 'tutoring_session_id')) {
      await sql`delete from video_room_events where room_id in (select id from video_rooms where kind = 'session')`.execute(
        database,
      );
      await sql`delete from video_room_admissions where room_id in (select id from video_rooms where kind = 'session')`.execute(
        database,
      );
      await sql`delete from video_rooms where kind = 'session'`.execute(database);
      await sql`alter table video_rooms drop constraint if exists video_rooms_session_check`.execute(database);
      await sql`drop index if exists video_rooms_session_unique`.execute(database);
      await sql`alter table video_rooms drop column tutoring_session_id`.execute(database);
    }
    const otherKinds = await sql<{ found: boolean }>`
      select exists(select 1 from video_rooms where kind <> 'instant') as found`.execute(database);
    if (!otherKinds.rows[0]?.found) {
      await sql`alter table video_rooms drop constraint if exists video_rooms_kind_check`.execute(database);
      await sql`alter table video_rooms add constraint video_rooms_kind_check check (kind = 'instant')`.execute(
        database,
      );
    }

    await dropTables(database, ROOT_TABLES);
    await sql`update pay_item_types set status = 'inactive', updated_at = now()
      where code = ${TUTORING_PAY_ITEM_CODE} and status <> 'inactive'`.execute(database);
  },
  async down() {},
};
