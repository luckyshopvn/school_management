import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { sql, type Kysely } from 'kysely';
import { migration as removeMarketSettings } from '../platform/migrations/0255_remove_market_settings.js';
import { createDatabase } from './connection.js';
import { createEmptyDatabase, dropDatabaseIfExists } from './database-administration.js';
import { readConnectionString, replaceDatabaseName } from './environment.js';
import {
  assertRemovedDataBackedUp,
  backupTablesBeforeRemoval,
  recordRemovedDataBackup,
  verifyRemovedDataBackup,
} from './removed-data-backup.js';

// Sao lưu dữ liệu của chức năng đã bỏ trước khi xóa (YCTD-384): tệp mã hóa đọc lại đủ dòng; database migration chỉ chạy khi bản ghi sao
// lưu khớp số dòng hiện tại; bảng rỗng hoặc không còn thì không cần sao lưu
const PASSPHRASE = 'mat-khau-sao-luu-kiem-thu';
const FEATURE = 'chuc-nang-thu';
const COMMAND = 'lệnh sao lưu thử';

describe('sao lưu trước khi xóa bảng của chức năng đã bỏ (YCTD-384)', () => {
  const systemUrl = readConnectionString('system');
  const databaseName = `removed_data_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const url = replaceDatabaseName(systemUrl, databaseName);
  let database: Kysely<unknown>;
  let directory = '';

  before(async () => {
    await createEmptyDatabase(systemUrl, databaseName);
    database = createDatabase<unknown>(url, { max: 2 });
    directory = await mkdtemp(join(tmpdir(), 'sao-luu-da-bo-'));
    await sql`create table bang_mot (id int primary key, ten text)`.execute(database);
    await sql`create table bang_hai (id int primary key)`.execute(database);
    await sql`create table bang_khac (id int primary key)`.execute(database);
    await sql`insert into bang_mot values (1, 'một'), (2, 'hai'), (3, null)`.execute(database);
    await sql`insert into bang_khac values (1)`.execute(database);
  });

  after(async () => {
    await database?.destroy();
    await dropDatabaseIfExists(systemUrl, databaseName);
    await rm(directory, { recursive: true, force: true });
  });

  it('chưa sao lưu thì từ chối; bảng rỗng, bảng không còn không chặn', async () => {
    await assert.rejects(
      assertRemovedDataBackedUp(database, FEATURE, ['bang_mot', 'bang_hai', 'bang_khong_co'], COMMAND),
      /bang_mot \(3 dòng\)/,
    );
    await assertRemovedDataBackedUp(database, FEATURE, ['bang_hai', 'bang_khong_co'], COMMAND);
  });

  it('sao lưu đúng các bảng chỉ định, đọc lại đủ dòng, ghi nhận rồi cho phép xóa; thêm dòng sau sao lưu thì chặn lại', async () => {
    const backup = await backupTablesBeforeRemoval({
      connectionString: url,
      feature: FEATURE,
      tables: ['bang_mot', 'bang_hai', 'bang_khong_co'],
      directory,
      passphrase: PASSPHRASE,
    });
    assert.ok(backup);
    assert.deepEqual(
      backup.totals.map((total) => [total.table, total.rows]),
      [
        ['bang_hai', 0],
        ['bang_mot', 3],
      ],
    );
    const verified = await verifyRemovedDataBackup(backup.file, PASSPHRASE);
    assert.equal(verified.rows, 3);
    assert.equal(verified.header.feature, FEATURE);
    await assert.rejects(verifyRemovedDataBackup(backup.file, 'mat-khau-sai-khong-dung'), /sai khóa hoặc tệp hỏng/);

    await recordRemovedDataBackup(database, { feature: FEATURE, databaseName, backup });
    await assertRemovedDataBackedUp(database, FEATURE, ['bang_mot', 'bang_hai'], COMMAND);

    await sql`insert into bang_mot values (4, 'bốn')`.execute(database);
    await assert.rejects(assertRemovedDataBackedUp(database, FEATURE, ['bang_mot'], COMMAND), /bang_mot \(4 dòng\)/);
  });

  it('database migration nền tảng 0255: còn khóa market mà chưa sao lưu chợ thì dừng, đã ghi nhận thì xóa khóa', async () => {
    await sql`create table platform_settings (key text primary key, value jsonb not null)`.execute(database);
    await sql`insert into platform_settings values ('market', '{"enabled": true}'), ('ai', '{}')`.execute(database);
    await assert.rejects(removeMarketSettings.up(database), /Chưa sao lưu dữ liệu chợ gia sư/);
    await recordRemovedDataBackup(database, {
      feature: 'cho-gia-su',
      databaseName: 'school_marketplace',
      backup: null,
    });
    await removeMarketSettings.up(database);
    const keys = await sql<{ key: string }>`select key from platform_settings order by key`.execute(database);
    assert.deepEqual(
      keys.rows.map((row) => row.key),
      ['ai'],
    );
  });

  it('không còn bảng nào thì không tạo tệp', async () => {
    const backup = await backupTablesBeforeRemoval({
      connectionString: url,
      feature: FEATURE,
      tables: ['bang_khong_co'],
      directory,
      passphrase: PASSPHRASE,
    });
    assert.equal(backup, null);
  });
});
