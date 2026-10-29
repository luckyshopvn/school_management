import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { sql, type Kysely } from 'kysely';
import { Migrator, type Migration } from 'kysely/migration';
import { schoolYearMigrations } from '../school-year/index.js';
import { migration as dropTutoringTables } from '../school-year/migrations/0235_drop_tutoring_tables.js';
import { createDatabase } from './connection.js';
import { createEmptyDatabase, dropDatabaseIfExists } from './database-administration.js';
import { readConnectionString, replaceDatabaseName } from './environment.js';
import { MIGRATIONS_PER_TRANSACTION, migrateToLatest } from './migrate.js';
import { verifyRemovedDataBackup } from './removed-data-backup.js';
import { backupTutoringDatabase, TUTORING_TABLES } from './removed-tutoring-backup.js';

// Bỏ chương trình gia sư trong trường (YCTD-384 lát L3): database migration 0235 từ chối khi chưa sao lưu; sau khi sao lưu thì xóa bảng
// gia sư, giữ dòng hóa đơn cũ (số tiền, nội dung), xóa phòng video của buổi gia sư, giữ phòng tức thời; tệp sao lưu giữ đủ dòng liên
// kết để dựng lại. Định danh 0190 gỡ quyền, việc ẩn phân hệ gia sư
const PASSPHRASE = 'mat-khau-sao-luu-kiem-thu';
const DROP_MIGRATION = '0235_drop_tutoring_tables';

async function migrateAllExceptDrop(database: Kysely<unknown>): Promise<void> {
  const migrations: Record<string, Migration> = Object.fromEntries(
    Object.entries(schoolYearMigrations).filter(([name]) => name !== DROP_MIGRATION),
  );
  const migrator = new Migrator({
    db: database,
    provider: { getMigrations: async () => migrations },
    allowUnorderedMigrations: true,
  });
  // Chạy theo lô như migrateToLatest để không giữ khóa của mọi bảng trong một giao dịch
  const names = Object.keys(migrations).sort();
  for (
    let end = MIGRATIONS_PER_TRANSACTION;
    end < names.length + MIGRATIONS_PER_TRANSACTION;
    end += MIGRATIONS_PER_TRANSACTION
  ) {
    const step = await migrator.migrateTo(names[Math.min(end, names.length) - 1] as string);
    if (step.error) {
      throw step.error;
    }
  }
}

async function tableExists(database: Kysely<unknown>, table: string): Promise<boolean> {
  const result = await sql<{ found: boolean }>`select to_regclass(${table}) is not null as found`.execute(database);
  return result.rows[0]?.found === true;
}

describe('xóa bảng gia sư trong trường sau khi sao lưu (YCTD-384 lát L3)', () => {
  const systemUrl = readConnectionString('system');
  const databaseName = `tutoring_drop_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const url = replaceDatabaseName(systemUrl, databaseName);
  let database: Kysely<unknown>;
  let directory = '';
  const ids = { item: '', registration: '', sessionRoom: '', instantRoom: '' };

  before(async () => {
    await createEmptyDatabase(systemUrl, databaseName);
    database = createDatabase<unknown>(url, { max: 2 });
    directory = await mkdtemp(join(tmpdir(), 'sao-luu-gia-su-'));
    await migrateAllExceptDrop(database);

    const unit = await sql<{ id: string }>`
      insert into org_units (code, name, unit_type) values ('THU', 'Trường thử', 'truong_chinh') returning id`.execute(
      database,
    );
    const child = await sql<{ id: string }>`
      insert into children (org_unit_id, full_name, dob, gender, national_id_encrypted, national_id_hash, national_id_last4,
        photo_consent, status, enroll_date)
      values (${unit.rows[0]?.id}, 'Học sinh thử', '2015-01-01', 'male', 'ma-hoa', ${randomUUID()}, '0001', 'pending',
        'active', '2026-09-01') returning id`.execute(database);
    const actor = randomUUID();
    const program = await sql<{ id: string }>`
      insert into tutoring_programs (name, school_level, content_type, charges_fee, registration_form, starts_on, ends_on,
        created_by, created_by_name, fee_basis, fee_amount)
      values ('Bổ trợ tiếng Anh', 'THCS', 'enrichment', true, 'Mẫu đơn', '2026-09-01', '2026-12-31', ${actor}, 'Giáo viên',
        'per_program', 500000) returning id`.execute(database);
    const registration = await sql<{ id: string }>`
      insert into tutoring_registrations (program_id, child_id, guardian_user_id, guardian_name, form_text, form_hash, status)
      values (${program.rows[0]?.id}, ${child.rows[0]?.id}, ${actor}, 'Phụ huynh', 'Mẫu đơn', 'bam', 'approved')
      returning id`.execute(database);
    const session = await sql<{ id: string }>`
      insert into tutoring_sessions (program_id, session_date, start_time, end_time, periods, created_by)
      values (${program.rows[0]?.id}, '2026-09-10', '17:00', '18:00', 1, ${actor}) returning id`.execute(database);
    const invoice = await sql<{ id: string }>`
      insert into invoices (child_id, org_unit_id, period_year, period_month, invoice_kind, status, total_amount, basis)
      values (${child.rows[0]?.id}, ${unit.rows[0]?.id}, 2026, 9, 'main', 'draft', 500000, '{}'::jsonb) returning id`.execute(
      database,
    );
    const item = await sql<{ id: string }>`
      insert into invoice_items (invoice_id, item_type, description, quantity, unit_price, amount, tutoring_registration_id)
      values (${invoice.rows[0]?.id}, 'tutoring', 'Gia sư: Bổ trợ tiếng Anh', 1, 500000, 500000, ${registration.rows[0]?.id})
      returning id`.execute(database);
    await sql`
      insert into tutoring_charge_sessions (invoice_item_id, registration_id, amount, sessions_total)
      values (${item.rows[0]?.id}, ${registration.rows[0]?.id}, 500000, 1)`.execute(database);
    const sessionRoom = await sql<{ id: string }>`
      insert into video_rooms (kind, tutoring_session_id, title, host_user_id, host_name, provider, max_participants, lobby_enabled)
      values ('session', ${session.rows[0]?.id}, 'Buổi 1', ${actor}, 'Giáo viên', 'livekit', 8, true) returning id`.execute(
      database,
    );
    const instantRoom = await sql<{ id: string }>`
      insert into video_rooms (kind, title, host_user_id, host_name, provider, max_participants, lobby_enabled)
      values ('instant', 'Phòng tức thời', ${actor}, 'Giáo viên', 'livekit', 8, true) returning id`.execute(database);
    for (const room of [sessionRoom.rows[0]?.id, instantRoom.rows[0]?.id]) {
      await sql`
        insert into video_room_admissions (room_id, identity, role, display_name, user_id)
        values (${room}, ${`giao-vien-${room}`}, 'host', 'Giáo viên', ${actor})`.execute(database);
      await sql`
        insert into video_room_events (room_id, identity, role, kind, at, source)
        values (${room}, ${`giao-vien-${room}`}, 'host', 'join', now(), 'webhook')`.execute(database);
    }
    await sql`
      insert into video_recordings (room_id, storage_key, started_by_name, expires_at)
      values (${sessionRoom.rows[0]?.id}, 'video-recordings/thu', 'Giáo viên', now() + interval '30 days')`.execute(
      database,
    );
    ids.item = item.rows[0]?.id as string;
    ids.registration = registration.rows[0]?.id as string;
    ids.sessionRoom = sessionRoom.rows[0]?.id as string;
    ids.instantRoom = instantRoom.rows[0]?.id as string;
  });

  after(async () => {
    await database?.destroy();
    await dropDatabaseIfExists(systemUrl, databaseName);
    await rm(directory, { recursive: true, force: true });
  });

  it('chưa sao lưu thì 0235 từ chối, không đổi gì', async () => {
    await assert.rejects(
      dropTutoringTables.up(database),
      /Chưa sao lưu dữ liệu của chức năng đã bỏ "gia-su-trong-truong"/,
    );
    assert.equal(await tableExists(database, 'tutoring_programs'), true);
  });

  it('sao lưu đủ bảng và dòng liên kết; 0235 xóa bảng gia sư, giữ dòng hóa đơn, phòng tức thời', async () => {
    const result = await backupTutoringDatabase({ connectionString: url, directory, passphrase: PASSPHRASE });
    assert.ok(result.backup);
    assert.equal(result.databaseName, databaseName);
    assert.deepEqual(result.extraRows, {
      invoice_item_tutoring_links: 1,
      session_video_rooms: 1,
      session_video_room_admissions: 1,
      session_video_room_events: 1,
    });
    const counted = Object.fromEntries(result.backup.totals.map((total) => [total.table, total.rows]));
    assert.equal(result.backup.totals.length, TUTORING_TABLES.length);
    assert.equal(counted.tutoring_programs, 1);
    assert.equal(counted.tutoring_registrations, 1);
    assert.equal(counted.tutoring_charge_sessions, 1);
    assert.equal(counted.video_recordings, 1);
    assert.equal(counted.tutoring_rules, 1);
    const verified = await verifyRemovedDataBackup(result.backup.file, PASSPHRASE);
    const links = verified.header.extra.invoice_item_tutoring_links as Array<Record<string, string>>;
    assert.deepEqual(links, [{ invoice_item_id: ids.item, tutoring_registration_id: ids.registration }]);
    const rooms = verified.header.extra.session_video_rooms as Array<Record<string, string>>;
    assert.equal(rooms[0]?.id, ids.sessionRoom);
    assert.ok(rooms[0]?.tutoring_session_id);

    await dropTutoringTables.up(database);
    for (const table of TUTORING_TABLES) {
      assert.equal(await tableExists(database, table), false, table);
    }
    const item = await sql<Record<string, unknown>>`
      select * from invoice_items where id = ${ids.item}`.execute(database);
    assert.equal(item.rows[0]?.amount, '500000');
    assert.equal(item.rows[0]?.description, 'Gia sư: Bổ trợ tiếng Anh');
    assert.equal(item.rows[0]?.item_type, 'tutoring');
    assert.equal('tutoring_registration_id' in (item.rows[0] ?? {}), false);
    const remainingRooms = await sql<{ id: string }>`select id from video_rooms order by id`.execute(database);
    assert.deepEqual(
      remainingRooms.rows.map((row) => row.id),
      [ids.instantRoom],
    );
    const admissions = await sql<{ rows: string }>`select count(*) as rows from video_room_admissions`.execute(
      database,
    );
    const events = await sql<{ rows: string }>`select count(*) as rows from video_room_events`.execute(database);
    assert.equal(Number(admissions.rows[0]?.rows), 1);
    assert.equal(Number(events.rows[0]?.rows), 1);
    await assert.rejects(
      sql`insert into video_rooms (kind, title, host_user_id, host_name, provider, max_participants, lobby_enabled)
        values ('session', 'Không còn loại này', ${randomUUID()}, 'Giáo viên', 'livekit', 8, true)`.execute(database),
      /video_rooms_kind_check/,
    );
    const payItem = await sql<{ status: string }>`
      select status from pay_item_types where code = 'THU_LAO_DAY_THEM'`.execute(database);
    assert.equal(payItem.rows[0]?.status, 'inactive');
  });

  it('cơ sở dữ liệu đã xóa bảng: sao lưu lại không tạo tệp, chỉ ghi nhận đã xử lý; 0235 chạy lại không lỗi', async () => {
    const result = await backupTutoringDatabase({ connectionString: url, directory, passphrase: PASSPHRASE });
    assert.equal(result.backup, null);
    assert.deepEqual(result.extraRows, {});
    await dropTutoringTables.up(database);
  });
});

describe('gỡ quyền gia sư ở cơ sở dữ liệu định danh (YCTD-384 lát L3)', () => {
  it('định danh tạo mới chạy đủ tệp: không còn quyền P02.tutoring, không còn ẩn phân hệ gia sư', async () => {
    const systemUrl = readConnectionString('system');
    const databaseName = `identity_tutoring_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    await createEmptyDatabase(systemUrl, databaseName);
    const url = replaceDatabaseName(systemUrl, databaseName);
    try {
      const migrated = await migrateToLatest('identity', url);
      assert.equal(migrated.error, undefined);
      const database = createDatabase<unknown>(url, { max: 1 });
      try {
        const permissions = await sql<{ rows: string }>`
          select count(*) as rows from permissions where code like 'P02.tutoring.%'`.execute(database);
        const exclusions = await sql<{ rows: string }>`
          select count(*) as rows from role_workspace_exclusions where workspace_key = 'tutoring'`.execute(database);
        assert.equal(Number(permissions.rows[0]?.rows), 0);
        assert.equal(Number(exclusions.rows[0]?.rows), 0);
      } finally {
        await database.destroy();
      }
    } finally {
      await dropDatabaseIfExists(systemUrl, databaseName);
    }
  });
});
