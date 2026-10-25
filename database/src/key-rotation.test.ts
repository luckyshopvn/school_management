import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { decryptSecret, encryptSecret } from '@school-management/server/tenancy';
import { sql } from 'kysely';
import { createDatabase } from './connection.js';
import { rewrapMasterKey, rotateChildKeys } from './key-rotation.js';
import { connectionStringOf } from './school-database-layout.js';
import { schoolDescriptors, type Actor, type LifecycleEnvironment } from './school-lifecycle.js';
import { startTenantTestPlatform, type TenantTestPlatform } from './tenant-test-support.js';

// Đổi khóa mã hóa dữ liệu trẻ và bọc lại khóa gốc (DT-SaaS phần S3, YCTD-195; tài liệu 32 mục 14.5). Nền tảng và trường dựng riêng cho
// lần chạy, dữ liệu giả hoàn toàn
const actor: Actor = { type: 'cli', name: 'Kiểm thử S3' };
let test: TenantTestPlatform;
let environment: LifecycleEnvironment;

before(async () => {
  test = await startTenantTestPlatform({ schools: ['alpha', 'beta'], label: 'key' });
  environment = { platform: test.platform, masterKey: test.masterKey, layout: test.layout, systemDomain: null };
});

after(async () => {
  await test.close();
});

async function keysOf(name: string) {
  const row = await test.platform
    .selectFrom('school_keys')
    .selectAll()
    .where('school_id', '=', test.school(name).schoolId)
    .executeTakeFirstOrThrow();
  return {
    encryption: Buffer.from(decryptSecret(test.masterKey, row.child_encryption_key_encrypted), 'base64'),
    hash: Buffer.from(decryptSecret(test.masterKey, row.child_hash_key_encrypted), 'base64'),
    rotatedAt: row.rotated_at,
  };
}

async function withDatabase<T>(
  name: string,
  kind: 'system' | 'identity',
  work: (database: ReturnType<typeof createDatabase>) => Promise<T>,
): Promise<T> {
  const descriptor = (await schoolDescriptors(environment, test.school(name).schoolId)).find(
    (item) => item.kind === kind,
  );
  assert.ok(descriptor);
  const database = createDatabase<unknown>(connectionStringOf(descriptor), { max: 1 });
  try {
    return await work(database);
  } finally {
    await database.destroy();
  }
}

const withSystem = <T>(name: string, work: (database: ReturnType<typeof createDatabase>) => Promise<T>) =>
  withDatabase(name, 'system', work);

const hashOf = (key: Buffer, text: string) => createHmac('sha256', key).update(text).digest('hex');

async function seed(name: string, count: number) {
  const keys = await keysOf(name);
  await withSystem(name, async (database) => {
    await sql`create table if not exists rotation_probe (id uuid primary key default gen_random_uuid(), national_id_encrypted text, national_id_hash text)`.execute(
      database,
    );
    await sql`delete from rotation_probe`.execute(database);
    for (let index = 0; index < count; index += 1) {
      const plain = `0790000${String(index).padStart(5, '0')}`;
      await sql`insert into rotation_probe (national_id_encrypted, national_id_hash) values (${encryptSecret(keys.encryption, plain)}, ${hashOf(keys.hash, plain)})`.execute(
        database,
      );
    }
    await sql`insert into integration_secrets (connector, values_encrypted) values ('esms', ${encryptSecret(keys.encryption, JSON.stringify({ api_key: 'khoa-gia' }))}) on conflict (connector) do update set values_encrypted = excluded.values_encrypted`.execute(
      database,
    );
  });
}

async function seedIdentity(name: string) {
  const keys = await keysOf(name);
  await withDatabase(name, 'identity', async (database) => {
    await sql`insert into users (full_name, phone, username, password_hash) values (${'Người xoay khóa'}, ${'0900000001'}, ${'xoay_khoa'}, ${'x'}) on conflict do nothing`.execute(
      database,
    );
    await sql`insert into user_totp (user_id, secret_encrypted) select id, ${encryptSecret(keys.encryption, 'JBSWY3DPEHPK3PXP')} from users where username = ${'xoay_khoa'} on conflict (user_id) do update set secret_encrypted = excluded.secret_encrypted`.execute(
      database,
    );
  });
}

async function expectIdentityOn(name: string, keys: { encryption: Buffer }) {
  await withDatabase(name, 'identity', async (database) => {
    const row = (await sql<{ secret_encrypted: string }>`select secret_encrypted from user_totp`.execute(database))
      .rows[0];
    assert.equal(decryptSecret(keys.encryption, row?.secret_encrypted ?? ''), 'JBSWY3DPEHPK3PXP');
  });
}

async function expectAllOn(name: string, keys: { encryption: Buffer; hash: Buffer }, count: number) {
  await withSystem(name, async (database) => {
    const rows = (
      await sql<{
        national_id_encrypted: string;
        national_id_hash: string;
      }>`select national_id_encrypted, national_id_hash from rotation_probe`.execute(database)
    ).rows;
    assert.equal(rows.length, count);
    for (const row of rows) {
      const plain = decryptSecret(keys.encryption, row.national_id_encrypted);
      assert.match(plain, /^0790000\d{5}$/);
      assert.equal(row.national_id_hash, hashOf(keys.hash, plain));
    }
    const secret = (
      await sql<{
        values_encrypted: string;
      }>`select values_encrypted from integration_secrets where connector = 'esms'`.execute(database)
    ).rows[0];
    assert.equal(JSON.parse(decryptSecret(keys.encryption, secret?.values_encrypted ?? '')).api_key, 'khoa-gia');
  });
}

describe('đổi khóa mã hóa dữ liệu trẻ', () => {
  it('chỉ đổi khi trường đang tạm dừng', async () => {
    await assert.rejects(() => rotateChildKeys(environment, test.school('alpha').code, actor), /tạm dừng/);
    await assert.rejects(() => rotateChildKeys(environment, 'khong-co', actor), /Không có trường/);
  });

  it('mã hóa lại mọi cột *_encrypted, tính lại băm, thay khóa ở school_keys, ghi nhật ký', async () => {
    await seed('alpha', 5);
    await seedIdentity('alpha');
    const before = await keysOf('alpha');
    await test.platform
      .updateTable('schools')
      .set({ status: 'suspended' })
      .where('id', '=', test.school('alpha').schoolId)
      .execute();
    const result = await rotateChildKeys(environment, test.school('alpha').code, actor, { batchSize: 2 });
    assert.equal(result.status, 'completed');
    assert.ok(result.rowsDone >= 6);
    const after = await keysOf('alpha');
    assert.notDeepEqual(after.encryption, before.encryption);
    assert.notDeepEqual(after.hash, before.hash);
    assert.ok(after.rotatedAt);
    await expectAllOn('alpha', after, 5);
    // Khóa xác thực hai lớp ở cơ sở dữ liệu định danh cũng được mã hóa lại (DT-SaaS phần S8b)
    await expectIdentityOn('alpha', after);
    const actions = (
      await test.platform
        .selectFrom('platform_audit_log')
        .select('action')
        .where('school_id', '=', test.school('alpha').schoolId)
        .execute()
    ).map((row) => row.action);
    assert.ok(actions.includes('school.key-rotation.start') && actions.includes('school.key-rotation.complete'));
    const rotation = await test.platform
      .selectFrom('school_key_rotations')
      .selectAll()
      .where('school_id', '=', test.school('alpha').schoolId)
      .executeTakeFirstOrThrow();
    assert.equal(rotation.status, 'completed');
  });

  it('gián đoạn rồi chạy lại thì làm tiếp, không mã hóa hai lần, trường khác không bị đụng', async () => {
    await seed('beta', 7);
    const betaBefore = await keysOf('beta');
    const alphaKeys = await keysOf('alpha');
    await test.platform
      .updateTable('schools')
      .set({ status: 'suspended' })
      .where('id', '=', test.school('beta').schoolId)
      .execute();
    const partial = await rotateChildKeys(environment, test.school('beta').code, actor, {
      batchSize: 2,
      stopAfterBatches: 2,
    });
    assert.equal(partial.status, 'running');
    // Khóa hiện tại chưa đổi cho tới khi xong toàn bộ
    assert.deepEqual((await keysOf('beta')).encryption, betaBefore.encryption);
    const finished = await rotateChildKeys(environment, test.school('beta').code, actor, { batchSize: 2 });
    assert.equal(finished.status, 'completed');
    assert.equal(finished.resumed, true);
    assert.equal(finished.rotationId, partial.rotationId);
    await expectAllOn('beta', await keysOf('beta'), 7);
    // Trường alpha vẫn đọc được bằng khóa của chính nó
    await expectAllOn('alpha', alphaKeys, 5);
  });
});

describe('bọc lại khóa gốc của nền tảng', () => {
  it('bọc lại khóa và mật khẩu kết nối của mọi trường; khóa gốc cũ không còn dùng được', async () => {
    const alphaBefore = await keysOf('alpha');
    const newMaster = randomBytes(32);
    const counts = await rewrapMasterKey(test.platform, test.masterKey, newMaster, actor);
    assert.ok(counts.keys >= 2 && counts.passwords >= 4);
    const row = await test.platform
      .selectFrom('school_keys')
      .selectAll()
      .where('school_id', '=', test.school('alpha').schoolId)
      .executeTakeFirstOrThrow();
    assert.deepEqual(
      Buffer.from(decryptSecret(newMaster, row.child_encryption_key_encrypted), 'base64'),
      alphaBefore.encryption,
    );
    assert.throws(() => decryptSecret(test.masterKey, row.child_encryption_key_encrypted));
    const password = await test.platform
      .selectFrom('school_databases')
      .select('password_encrypted')
      .executeTakeFirstOrThrow();
    assert.ok(decryptSecret(newMaster, password.password_encrypted));
    // Đưa về khóa cũ để bước dọn dẹp của nền tảng kiểm thử còn đọc được mật khẩu
    await rewrapMasterKey(test.platform, newMaster, test.masterKey, actor);
  });
});
