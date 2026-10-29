import { sql, type Kysely } from 'kysely';
import { TUTORING_FEATURE, TUTORING_TABLES } from '../school-year/migrations/0235_drop_tutoring_tables.js';
import { createDatabase } from './connection.js';
import { backupTablesBeforeRemoval, recordRemovedDataBackup, type RemovedDataBackup } from './removed-data-backup.js';
import { schoolDescriptors, type LifecycleEnvironment } from './school-lifecycle.js';
import { connectionStringOf } from './school-database-layout.js';

// Sao lưu dữ liệu chương trình gia sư trong trường của một cơ sở dữ liệu năm học trước database migration 0235 (YCTD-384 lát L3).
// Tệp gồm trọn các bảng 0235 xóa, kèm ở phần `extra` của dòng đầu các dòng bị đổi hoặc xóa ở bảng còn giữ, đủ để dựng lại liên kết:
// - `invoice_item_tutoring_links`: cặp dòng hóa đơn và đơn đăng ký gia sư (cột `invoice_items.tutoring_registration_id` bị bỏ);
// - `session_video_rooms`, `session_video_room_admissions`, `session_video_room_events`: phòng video của buổi gia sư cùng phòng chờ,
//   nhật ký vào ra của phòng đó (bị xóa).
// Kết quả ghi vào removed_data_backups của chính cơ sở dữ liệu đó để 0235 kiểm số dòng.
export {
  TUTORING_BACKUP_COMMAND,
  TUTORING_FEATURE,
  TUTORING_TABLES,
} from '../school-year/migrations/0235_drop_tutoring_tables.js';

export interface TutoringBackupResult {
  databaseName: string;
  backup: RemovedDataBackup | null;
  // Số dòng của từng mục trong phần `extra`
  extraRows: Record<string, number>;
}

async function hasColumn(database: Kysely<unknown>, table: string, column: string): Promise<boolean> {
  const result = await sql<{ found: boolean }>`
    select exists(select 1 from information_schema.columns
      where table_schema = current_schema() and table_name = ${table} and column_name = ${column}) as found`.execute(
    database,
  );
  return result.rows[0]?.found === true;
}

// Các dòng ngoài bảng bị xóa mà 0235 đổi hoặc xóa; cơ sở dữ liệu đã chạy 0235 (không còn cột nối) thì không có gì
async function linkedRows(connectionString: string): Promise<Record<string, unknown[]>> {
  const database = createDatabase<unknown>(connectionString, { max: 1 });
  try {
    const extra: Record<string, unknown[]> = {};
    if (await hasColumn(database, 'invoice_items', 'tutoring_registration_id')) {
      const links = await sql<Record<string, unknown>>`
        select id as invoice_item_id, tutoring_registration_id from invoice_items
        where tutoring_registration_id is not null order by id`.execute(database);
      if (links.rows.length > 0) {
        extra.invoice_item_tutoring_links = links.rows;
      }
    }
    if (await hasColumn(database, 'video_rooms', 'tutoring_session_id')) {
      const rooms = await sql<{ row: unknown }>`
        select row_to_json(room) as row from video_rooms room where kind = 'session' order by id`.execute(database);
      const admissions = await sql<{ row: unknown }>`
        select row_to_json(admission) as row from video_room_admissions admission
        where room_id in (select id from video_rooms where kind = 'session') order by room_id, identity`.execute(
        database,
      );
      const events = await sql<{ row: unknown }>`
        select row_to_json(event) as row from video_room_events event
        where room_id in (select id from video_rooms where kind = 'session') order by room_id, at, id`.execute(
        database,
      );
      for (const [key, result] of [
        ['session_video_rooms', rooms],
        ['session_video_room_admissions', admissions],
        ['session_video_room_events', events],
      ] as const) {
        if (result.rows.length > 0) {
          extra[key] = result.rows.map((item) => item.row);
        }
      }
    }
    return extra;
  } finally {
    await database.destroy();
  }
}

// Sao lưu rồi ghi nhận một cơ sở dữ liệu năm học. Không còn bảng, không còn dòng liên kết thì không tạo tệp, chỉ ghi nhận đã xử lý
export async function backupTutoringDatabase(options: {
  connectionString: string;
  // Tên ghi vào removed_data_backups; mặc định là tên cơ sở dữ liệu trong chuỗi kết nối
  databaseName?: string;
  directory: string;
  passphrase: string;
  now?: Date;
}): Promise<TutoringBackupResult> {
  const databaseName = options.databaseName ?? decodeURIComponent(new URL(options.connectionString).pathname.slice(1));
  const extra = await linkedRows(options.connectionString);
  const backup = await backupTablesBeforeRemoval({
    connectionString: options.connectionString,
    feature: TUTORING_FEATURE,
    tables: TUTORING_TABLES,
    directory: options.directory,
    passphrase: options.passphrase,
    extra,
    ...(options.now ? { now: options.now } : {}),
  });
  const database = createDatabase<unknown>(options.connectionString, { max: 1 });
  try {
    await recordRemovedDataBackup(database, { feature: TUTORING_FEATURE, databaseName, backup });
  } finally {
    await database.destroy();
  }
  const extraRows = Object.fromEntries(Object.entries(extra).map(([key, rows]) => [key, rows.length]));
  return { databaseName, backup, extraRows };
}

// Cơ sở dữ liệu năm học mà làn sóng migrate (migrateSchools) sẽ chạy: trường không ở trạng thái đang khởi tạo, đã xóa; năm học
// không chỉ đọc. Năm đã đóng (chỉ đọc) giữ nguyên cấu trúc nên không bị xóa bảng, không cần sao lưu
export async function schoolYearConnectionsToMigrate(
  environment: LifecycleEnvironment,
): Promise<Array<{ schoolCode: string; databaseName: string; connectionString: string }>> {
  const schools = await environment.platform
    .selectFrom('schools')
    .select(['id', 'code'])
    .where('status', 'not in', ['provisioning', 'deleted'])
    .orderBy('code')
    .execute();
  const result: Array<{ schoolCode: string; databaseName: string; connectionString: string }> = [];
  for (const school of schools) {
    const readOnly = new Set(
      (
        await environment.platform
          .selectFrom('school_databases')
          .select('name')
          .where('school_id', '=', school.id)
          .where('kind', '=', 'school-year')
          .where('status', '=', 'read_only')
          .execute()
      ).map((row) => row.name),
    );
    for (const descriptor of await schoolDescriptors(environment, school.id)) {
      if (descriptor.kind === 'school-year' && !readOnly.has(descriptor.name)) {
        result.push({
          schoolCode: school.code,
          databaseName: descriptor.name,
          connectionString: connectionStringOf(descriptor),
        });
      }
    }
  }
  return result;
}
