import { createHmac, randomBytes } from 'node:crypto';
import { decryptSecret, encryptSecret } from '@school-management/server/tenancy';
import { sql, type Kysely } from 'kysely';
import type { PlatformDatabase } from '../platform/schema.js';
import { createDatabase } from './connection.js';
import { connectionStringOf, type DatabaseDescriptor } from './school-database-layout.js';
import { schoolDescriptors, LifecycleError, type Actor, type LifecycleEnvironment } from './school-lifecycle.js';
import { writeAudit } from './provision-school.js';

// Đổi khóa mã hóa dữ liệu trẻ của trường và bọc lại khóa bằng khóa gốc mới (DT-SaaS phần S3, YCTD-195, tài liệu 47 mục 14.5).
//
// Đổi khóa của trường: mã hóa lại từng bước, ghi tiến độ sau mỗi lô nên làm tiếp được khi bị gián đoạn. Công cụ tự tìm mọi cột
// `*_encrypted` có cột `id` ở cơ sở dữ liệu hệ thống và mọi cơ sở dữ liệu năm học của trường (số định danh của trẻ và người lớn,
// khóa kết nối Zalo, mật khẩu tài khoản đồng bộ, cấu hình kết nối ngoài), nên bảng thêm sau tự được xử lý; giá trị mã hóa nằm trong
// cột jsonb thì khai ở `ENCRYPTED_JSON_COLUMNS`; cột `<tên>_hash` cùng bảng là
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

// Cột jsonb chứa giá trị mã hóa bằng khóa dữ liệu trẻ ở khóa con tên `*_encrypted`, kể cả lồng nhau: số CCCD, hộ chiếu, bảo hiểm
// xã hội trong hồ sơ CSDL ngành của trẻ và nhân viên; ảnh chụp hồ sơ nhân viên trong phiếu chuyển đi, chuyển đến
const ENCRYPTED_JSON_COLUMNS: ReadonlyArray<{ table: string; column: string }> = [
  { table: 'children', column: 'moet_profile' },
  { table: 'staff', column: 'moet_profile' },
  { table: 'staff_movements', column: 'dossier' },
];

async function encryptedJsonColumns(database: Kysely<unknown>): Promise<EncryptedColumn[]> {
  const rows = await sql<{ table_name: string; column_name: string }>`
    select table_name, column_name from information_schema.columns
    where table_schema = current_schema() and data_type = 'jsonb'`.execute(database);
  const present = new Set(rows.rows.map((row) => `${row.table_name}.${row.column_name}`));
  return ENCRYPTED_JSON_COLUMNS.filter((target) => present.has(`${target.table}.${target.column}`)).map((target) => ({
    ...target,
    hashColumn: null,
  }));
}

// Mã hóa lại mọi chuỗi ở khóa con `*_encrypted`; trả về có đổi gì không. Giá trị đã sang khóa mới thì giữ nguyên,
// không giải mã được bằng khóa nào là dữ liệu hỏng, dừng
function reencryptJson(value: unknown, keys: { oldEncryption: Buffer; newEncryption: Buffer }): boolean {
  if (Array.isArray(value)) {
    return value.map((item) => reencryptJson(item, keys)).some(Boolean);
  }
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  let changed = false;
  for (const [key, item] of Object.entries(record)) {
    if (key.endsWith('_encrypted') && typeof item === 'string') {
      let plain: string;
      try {
        plain = decryptSecret(keys.oldEncryption, item);
      } catch {
        decryptSecret(keys.newEncryption, item);
        continue;
      }
      record[key] = encryptSecret(keys.newEncryption, plain);
      changed = true;
    } else if (reencryptJson(item, keys)) {
      changed = true;
    }
  }
  return changed;
}

async function reencryptJsonColumn(
  database: Kysely<unknown>,
  target: EncryptedColumn,
  keys: { oldEncryption: Buffer; newEncryption: Buffer },
  after: string | null,
  batchSize: number,
): Promise<{ rows: number; lastId: string | null; processed: number }> {
  const table = quote(target.table);
  const column = quote(target.column);
  const where = after ? sql`and id > ${after}::uuid` : sql``;
  const batch = await sql<{ id: string; value: string }>`
    select id::text as id, ${sql.raw(column)}::text as value from ${sql.raw(table)}
    where ${sql.raw(column)}::text like '%#_encrypted"%' escape '#' ${where} order by id limit ${batchSize}`.execute(
    database,
  );
  if (batch.rows.length === 0) {
    return { rows: 0, lastId: after, processed: 0 };
  }
  let processed = 0;
  await database.transaction().execute(async (transaction) => {
    await sql`set transaction read write`.execute(transaction);
    for (const row of batch.rows) {
      const document: unknown = JSON.parse(row.value);
      if (!reencryptJson(document, keys)) {
        continue;
      }
      await sql`update ${sql.raw(table)} set ${sql.raw(column)} = ${JSON.stringify(document)}::jsonb where id = ${row.id}::uuid`.execute(
        transaction,
      );
      processed += 1;
    }
  });
  return { rows: batch.rows.length, lastId: batch.rows[batch.rows.length - 1]?.id ?? after, processed };
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
    (descriptor) => descriptor.kind === 'identity' || descriptor.kind === 'system' || descriptor.kind === 'school-year',
  );
  try {
    for (const descriptor of descriptors) {
      const database = createDatabase<unknown>(connectionStringOf(descriptor), { max: 1 });
      try {
        const steps = [
          ...(await encryptedColumns(database)).map((target) => ({ target, json: false })),
          ...(await encryptedJsonColumns(database)).map((target) => ({ target, json: true })),
        ];
        for (const { target, json } of steps) {
          const key = `${descriptor.kind}:${descriptor.name}:${target.table}.${target.column}${json ? ':json' : ''}`;
          if (progress[key] === 'done') {
            continue;
          }
          for (;;) {
            const after = progress[key] ?? null;
            const result = json
              ? await reencryptJsonColumn(database, target, keys, after, batchSize)
              : await reencryptColumn(database, target, keys, after, batchSize);
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

// Mọi cột `*_encrypted` của cơ sở dữ liệu nền tảng; kiểm thử đối chiếu danh sách này với cơ sở dữ liệu để bảng thêm sau không bị sót
export const MASTER_KEY_COLUMNS = [
  'school_keys.child_encryption_key_encrypted',
  'school_keys.child_hash_key_encrypted',
  'school_databases.password_encrypted',
  'school_key_rotations.new_encryption_key_encrypted',
  'school_key_rotations.new_hash_key_encrypted',
  'platform_operator_totp.secret_encrypted',
  'parent_org_user_totp.secret_encrypted',
  'platform_integration_secrets.values_encrypted',
  'platform_push_keys.private_key_encrypted',
  'platform_native_push_keys.credentials_encrypted',
] as const;

export interface MasterKeyRewrapCounts {
  keys: number;
  passwords: number;
  rotations: number;
  operatorTotp: number;
  parentOrgTotp: number;
  integrationSecrets: number;
  pushKeys: number;
  nativePushKeys: number;
}

// Bọc lại khóa của mọi trường (khóa mã hóa và khóa băm dữ liệu trẻ, khóa mới đang đổi dở), mật khẩu kết nối cơ sở dữ liệu, khóa
// hai lớp, khóa cổng thanh toán, AI và thông báo đẩy của nền tảng bằng khóa gốc mới; trong một giao dịch nên không bao giờ có trạng
// thái nửa cũ nửa mới. Sau đó đặt PLATFORM_MASTER_KEY thành khóa mới
export async function rewrapMasterKey(
  platform: Kysely<PlatformDatabase>,
  oldMasterKey: Buffer,
  newMasterKey: Buffer,
  actor: Actor,
): Promise<MasterKeyRewrapCounts> {
  const rewrap = (value: string) => encryptSecret(newMasterKey, decryptSecret(oldMasterKey, value));
  const counts: MasterKeyRewrapCounts = {
    keys: 0,
    passwords: 0,
    rotations: 0,
    operatorTotp: 0,
    parentOrgTotp: 0,
    integrationSecrets: 0,
    pushKeys: 0,
    nativePushKeys: 0,
  };
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
    // Khóa xác thực hai lớp của tài khoản vận hành nền tảng (DT-SaaS phần S8b)
    for (const row of await transaction
      .selectFrom('platform_operator_totp')
      .select(['operator_id', 'secret_encrypted'])
      .execute()) {
      await transaction
        .updateTable('platform_operator_totp')
        .set({ secret_encrypted: rewrap(row.secret_encrypted) })
        .where('operator_id', '=', row.operator_id)
        .execute();
      counts.operatorTotp += 1;
    }
    // Khóa xác thực hai lớp của tài khoản cấp trên (DT-SaaS phần S6)
    for (const row of await transaction
      .selectFrom('parent_org_user_totp')
      .select(['user_id', 'secret_encrypted'])
      .execute()) {
      await transaction
        .updateTable('parent_org_user_totp')
        .set({ secret_encrypted: rewrap(row.secret_encrypted) })
        .where('user_id', '=', row.user_id)
        .execute();
      counts.parentOrgTotp += 1;
    }
    // Khóa cổng thanh toán và khóa AI của nền tảng
    for (const row of await transaction
      .selectFrom('platform_integration_secrets')
      .select(['connector', 'values_encrypted'])
      .execute()) {
      await transaction
        .updateTable('platform_integration_secrets')
        .set({ values_encrypted: rewrap(row.values_encrypted) })
        .where('connector', '=', row.connector)
        .execute();
      counts.integrationSecrets += 1;
    }
    // Khóa riêng VAPID, kể cả khóa đã thôi dùng
    for (const row of await transaction
      .selectFrom('platform_push_keys')
      .select(['id', 'private_key_encrypted'])
      .execute()) {
      await transaction
        .updateTable('platform_push_keys')
        .set({ private_key_encrypted: rewrap(row.private_key_encrypted) })
        .where('id', '=', row.id)
        .execute();
      counts.pushKeys += 1;
    }
    // Khóa đẩy gốc thiết bị (FCM, APNs), kể cả khóa đã thôi dùng
    for (const row of await transaction
      .selectFrom('platform_native_push_keys')
      .select(['id', 'credentials_encrypted'])
      .execute()) {
      await transaction
        .updateTable('platform_native_push_keys')
        .set({ credentials_encrypted: rewrap(row.credentials_encrypted) })
        .where('id', '=', row.id)
        .execute();
      counts.nativePushKeys += 1;
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
