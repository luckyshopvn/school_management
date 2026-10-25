import { createHmac, randomBytes } from 'node:crypto';
import { decryptSecret, encryptSecret } from '@school-management/server/tenancy';
import { sql, type Kysely } from 'kysely';
import type { PlatformDatabase } from '../platform/schema.js';
import { createDatabase } from './connection.js';
import { connectionStringOf, type DatabaseDescriptor } from './school-database-layout.js';
import { schoolDescriptors, LifecycleError, type Actor, type LifecycleEnvironment } from './school-lifecycle.js';
import { writeAudit } from './provision-school.js';

// Đổi khóa mã hóa dữ liệu trẻ của trường và bọc lại khóa bằng khóa gốc mới (DT-SaaS phần S3, YCTD-195, tài liệu 32 mục 14.5).
//
// Đổi khóa của trường: mã hóa lại từng bước, ghi tiến độ sau mỗi lô nên làm tiếp được khi bị gián đoạn. Công cụ tự tìm mọi cột
// `*_encrypted` có cột `id` ở cơ sở dữ liệu hệ thống và mọi cơ sở dữ liệu năm học của trường (số định danh của trẻ và người lớn,
// khóa kết nối Zalo, mật khẩu tài khoản đồng bộ, cấu hình kết nối ngoài), nên bảng thêm sau tự được xử lý; cột `<tên>_hash` cùng bảng là
// băm có khóa của bản rõ, tính lại bằng khóa băm mới. Trường phải đang tạm dừng (không có yêu cầu nào đọc dữ liệu bằng khóa cũ trong khi
// một phần dòng đã sang khóa mới); khóa mới chỉ thay khóa hiện tại ở `school_keys` khi xong toàn bộ.
// Làm tiếp an toàn: dòng đã sang khóa mới (giải mã bằng khóa cũ lỗi, bằng khóa mới được) được bỏ qua.
// Khóa gốc của nền tảng: `rewrapMasterKey` bọc lại khóa của mọi trường và mật khẩu kết nối cơ sở dữ liệu bằng khóa gốc mới.
const BATCH_SIZE = 200;

export interface KeyRotationOptions {
  batchSize?: number;
  onProgress?: (line: string) => void;
  // Dừng sau số lô này (dùng khi kiểm thử gián đoạn để làm tiếp)
  stopAfterBatches?: number;
}

export interface KeyRotationResult {
  rotationId: string;
  status: 'running' | 'completed';
  rowsDone: number;
  resumed: boolean;
}

interface EncryptedColumn {
  table: string;
  column: string;
  hashColumn: string | null;
}

function hashOf(key: Buffer, plainText: string): string {
  return createHmac('sha256', key).update(plainText).digest('hex');
}

async function encryptedColumns(database: Kysely<unknown>): Promise<EncryptedColumn[]> {
  const rows = await sql<{ table_name: string; column_name: string }>`
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = current_schema() and t.table_type = 'BASE TABLE' and c.column_name like '%#_encrypted' escape '#'
    order by c.table_name, c.column_name`.execute(database);
  const all = await sql<{ table_name: string; column_name: string }>`
    select table_name, column_name from information_schema.columns where table_schema = current_schema()`.execute(
    database,
  );
  const present = new Set(all.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const columns: EncryptedColumn[] = [];
  for (const row of rows.rows) {
    if (!present.has(`${row.table_name}.id`)) {
      continue;
    }
    const hash = row.column_name.replace(/_encrypted$/, '_hash');
    columns.push({
      table: row.table_name,
      column: row.column_name,
      hashColumn: present.has(`${row.table_name}.${hash}`) ? hash : null,
    });
  }
  return columns;
}

function quote(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Tên không hợp lệ: ${identifier}`);
  }
  return `"${identifier}"`;
}

async function reencryptColumn(
  database: Kysely<unknown>,
  target: EncryptedColumn,
  keys: { oldEncryption: Buffer; newEncryption: Buffer; newHash: Buffer },
  after: string | null,
  batchSize: number,
): Promise<{ rows: number; lastId: string | null; processed: number }> {
  const table = quote(target.table);
  const column = quote(target.column);
  const hashColumn = target.hashColumn ? quote(target.hashColumn) : null;
  const where = after ? sql`and id > ${after}::uuid` : sql``;
  const batch = await sql<{ id: string; value: string }>`
    select id::text as id, ${sql.raw(column)} as value from ${sql.raw(table)}
    where ${sql.raw(column)} is not null ${where} order by id limit ${batchSize}`.execute(database);
  if (batch.rows.length === 0) {
    return { rows: 0, lastId: after, processed: 0 };
  }
  let processed = 0;
  await database.transaction().execute(async (transaction) => {
    // Cơ sở dữ liệu năm học đã khóa ghi vẫn phải mã hóa lại
    await sql`set transaction read write`.execute(transaction);
    for (const row of batch.rows) {
      let plain: string;
      try {
        plain = decryptSecret(keys.oldEncryption, row.value);
      } catch {
        // Đã sang khóa mới ở lượt chạy trước bị gián đoạn: bỏ qua; không giải mã được bằng khóa nào là dữ liệu hỏng, dừng
        decryptSecret(keys.newEncryption, row.value);
        continue;
      }
      const encrypted = encryptSecret(keys.newEncryption, plain);
      if (hashColumn) {
        await sql`update ${sql.raw(table)} set ${sql.raw(column)} = ${encrypted}, ${sql.raw(hashColumn)} = ${hashOf(keys.newHash, plain)} where id = ${row.id}::uuid`.execute(
          transaction,
        );
      } else {
        await sql`update ${sql.raw(table)} set ${sql.raw(column)} = ${encrypted} where id = ${row.id}::uuid`.execute(
          transaction,
        );
      }
      processed += 1;
    }
  });
  return { rows: batch.rows.length, lastId: batch.rows[batch.rows.length - 1]?.id ?? after, processed };
}

async function loadKeys(environment: LifecycleEnvironment, schoolId: string) {
  const row = await environment.platform
    .selectFrom('school_keys')
    .selectAll()
    .where('school_id', '=', schoolId)
    .executeTakeFirst();
  if (!row) {
    throw new LifecycleError('Trường chưa có khóa mã hóa dữ liệu trẻ');
  }
  return {
    encryption: Buffer.from(decryptSecret(environment.masterKey, row.child_encryption_key_encrypted), 'base64'),
    hash: Buffer.from(decryptSecret(environment.masterKey, row.child_hash_key_encrypted), 'base64'),
  };
}

// Bắt đầu hoặc làm tiếp việc đổi khóa của một trường. Trường phải đang tạm dừng
export async function rotateChildKeys(
  environment: LifecycleEnvironment,
  code: string,
  actor: Actor,
  options: KeyRotationOptions = {},
): Promise<KeyRotationResult> {
  const { platform } = environment;
  const school = await platform
    .selectFrom('schools')
    .select(['id', 'code', 'status'])
    .where('code', '=', code)
    .executeTakeFirst();
  if (!school) {
    throw new LifecycleError(`Không có trường ${code}`);
  }
  if (school.status !== 'suspended') {
    throw new LifecycleError(
      'Chỉ đổi khóa khi trường đang tạm dừng: không có yêu cầu nào đọc dữ liệu trong lúc một phần dòng đã sang khóa mới',
    );
  }
  const current = await loadKeys(environment, school.id);
  let rotation = await platform
    .selectFrom('school_key_rotations')
    .selectAll()
    .where('school_id', '=', school.id)
    .where('status', '=', 'running')
    .executeTakeFirst();
  const resumed = rotation !== undefined;
  if (!rotation) {
    const next = { encryption: randomBytes(32), hash: randomBytes(32) };
    rotation = await platform
      .insertInto('school_key_rotations')
      .values({
        school_id: school.id,
        new_encryption_key_encrypted: encryptSecret(environment.masterKey, next.encryption.toString('base64')),
        new_hash_key_encrypted: encryptSecret(environment.masterKey, next.hash.toString('base64')),
        started_by: `${actor.type}:${actor.id ?? ''}`,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAudit(platform, {
      actorType: actor.type,
      ...(actor.id ? { actorId: actor.id } : {}),
      action: 'school.key-rotation.start',
      schoolId: school.id,
      details: { rotationId: rotation.id },
    });
  }
  const keys = {
    oldEncryption: current.encryption,
    newEncryption: Buffer.from(decryptSecret(environment.masterKey, rotation.new_encryption_key_encrypted), 'base64'),
    newHash: Buffer.from(decryptSecret(environment.masterKey, rotation.new_hash_key_encrypted), 'base64'),
  };
  const progress: Record<string, string> = { ...rotation.progress };
  let rowsDone = Number(rotation.rows_done);
  const batchSize = options.batchSize ?? BATCH_SIZE;
  let batches = 0;
  const descriptors: DatabaseDescriptor[] = (await schoolDescriptors(environment, school.id)).filter(
    (descriptor) => descriptor.kind === 'system' || descriptor.kind === 'school-year',
  );
  try {
    for (const descriptor of descriptors) {
      const database = createDatabase<unknown>(connectionStringOf(descriptor), { max: 1 });
      try {
        for (const target of await encryptedColumns(database)) {
          const key = `${descriptor.kind}:${descriptor.name}:${target.table}.${target.column}`;
          if (progress[key] === 'done') {
            continue;
          }
          for (;;) {
            const result = await reencryptColumn(database, target, keys, progress[key] ?? null, batchSize);
            if (result.rows === 0) {
              progress[key] = 'done';
              break;
            }
            progress[key] = result.lastId as string;
            rowsDone += result.processed;
            batches += 1;
            await platform
              .updateTable('school_key_rotations')
              .set({ progress: JSON.stringify(progress), rows_done: rowsDone })
              .where('id', '=', rotation.id)
              .execute();
            options.onProgress?.(`${key}: ${rowsDone} dòng`);
            if (options.stopAfterBatches !== undefined && batches >= options.stopAfterBatches) {
              return { rotationId: rotation.id, status: 'running', rowsDone, resumed };
            }
          }
          await platform
            .updateTable('school_key_rotations')
            .set({ progress: JSON.stringify(progress) })
            .where('id', '=', rotation.id)
            .execute();
        }
      } finally {
        await database.destroy();
      }
    }
  } catch (error) {
    await platform
      .updateTable('school_key_rotations')
      .set({ error: error instanceof Error ? error.message.slice(0, 500) : String(error) })
      .where('id', '=', rotation.id)
      .execute();
    throw error;
  }
  await platform.transaction().execute(async (transaction) => {
    await transaction
      .updateTable('school_keys')
      .set({
        child_encryption_key_encrypted: rotation.new_encryption_key_encrypted,
        child_hash_key_encrypted: rotation.new_hash_key_encrypted,
        rotated_at: new Date(),
      })
      .where('school_id', '=', school.id)
      .execute();
    await transaction
      .updateTable('school_key_rotations')
      .set({ status: 'completed', finished_at: new Date(), error: null })
      .where('id', '=', rotation.id)
      .execute();
  });
  await writeAudit(platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'school.key-rotation.complete',
    schoolId: school.id,
    details: { rotationId: rotation.id, rows: rowsDone },
  });
  return { rotationId: rotation.id, status: 'completed', rowsDone, resumed };
}

// Bọc lại khóa của mọi trường (khóa mã hóa và khóa băm dữ liệu trẻ, khóa mới đang đổi dở) và mật khẩu kết nối cơ sở dữ liệu bằng khóa
// gốc mới; trong một giao dịch nên không bao giờ có trạng thái nửa cũ nửa mới. Sau đó đặt PLATFORM_MASTER_KEY thành khóa mới
export async function rewrapMasterKey(
  platform: Kysely<PlatformDatabase>,
  oldMasterKey: Buffer,
  newMasterKey: Buffer,
  actor: Actor,
): Promise<{ keys: number; passwords: number; rotations: number }> {
  const rewrap = (value: string) => encryptSecret(newMasterKey, decryptSecret(oldMasterKey, value));
  const counts = { keys: 0, passwords: 0, rotations: 0 };
  await platform.transaction().execute(async (transaction) => {
    for (const row of await transaction.selectFrom('school_keys').selectAll().execute()) {
      await transaction
        .updateTable('school_keys')
        .set({
          child_encryption_key_encrypted: rewrap(row.child_encryption_key_encrypted),
          child_hash_key_encrypted: rewrap(row.child_hash_key_encrypted),
        })
        .where('school_id', '=', row.school_id)
        .execute();
      counts.keys += 1;
    }
    for (const row of await transaction.selectFrom('school_databases').select(['id', 'password_encrypted']).execute()) {
      await transaction
        .updateTable('school_databases')
        .set({ password_encrypted: rewrap(row.password_encrypted) })
        .where('id', '=', row.id)
        .execute();
      counts.passwords += 1;
    }
    for (const row of await transaction
      .selectFrom('school_key_rotations')
      .select(['id', 'new_encryption_key_encrypted', 'new_hash_key_encrypted'])
      .execute()) {
      await transaction
        .updateTable('school_key_rotations')
        .set({
          new_encryption_key_encrypted: rewrap(row.new_encryption_key_encrypted),
          new_hash_key_encrypted: rewrap(row.new_hash_key_encrypted),
        })
        .where('id', '=', row.id)
        .execute();
      counts.rotations += 1;
    }
  });
  await writeAudit(platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'platform.master-key.rewrap',
    details: counts,
  });
  return counts;
}
