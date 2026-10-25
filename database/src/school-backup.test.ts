import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { IdentityDatabase } from '../identity/schema.js';
import type { SystemDatabase } from '../system/schema.js';
import { createDatabase } from './connection.js';
import { createEmptyDatabase, dropDatabaseIfExists } from './database-administration.js';
import { dropSchool } from './provision-school.js';
import { backupSchool, drillRestore, latestBackupFile, restoreSchool, verifyBackup } from './school-backup.js';
import { moveSchoolToCluster } from './school-cluster-move.js';
import {
  connectionStringOf,
  createSchoolDatabaseLayout,
  descriptorFromRow,
  type DatabaseDescriptor,
} from './school-database-layout.js';
import {
  runProvisioningJob,
  startProvisioning,
  suspendSchool,
  type Actor,
  type LifecycleEnvironment,
} from './school-lifecycle.js';
import { startTenantTestPlatform, type TenantTestPlatform } from './tenant-test-support.js';

// Sao lưu, khôi phục, diễn tập, chuyển cụm theo từng trường (DT-SaaS phần S7b, YCTD-199) ở cả hai bố cục; dữ liệu giả, mọi cơ sở
// dữ liệu, lược đồ, thư mục tạm dựng riêng cho lần chạy và gỡ khi xong
const actor: Actor = { type: 'cli', name: 'Kiểm thử S7b' };
const PASSPHRASE = 'cum-tu-kiem-thu-gia-du-dai';

for (const layoutKind of ['schema', 'database'] as const) {
  describe(`sao lưu và khôi phục theo trường, bố cục ${layoutKind}`, () => {
    let test: TenantTestPlatform;
    let environment: LifecycleEnvironment;
    let directory: string;
    let code: string;
    let file: string;

    async function descriptorsOf(schoolCode: string): Promise<DatabaseDescriptor[]> {
      const school = await test.platform
        .selectFrom('schools')
        .select('id')
        .where('code', '=', schoolCode)
        .executeTakeFirstOrThrow();
      const rows = await test.platform
        .selectFrom('school_databases')
        .selectAll()
        .where('school_id', '=', school.id)
        .execute();
      return rows.map((row) => descriptorFromRow(row, test.masterKey));
    }

    async function usernames(schoolCode: string): Promise<string[]> {
      const identity = (await descriptorsOf(schoolCode)).find((item) => item.kind === 'identity');
      assert.ok(identity);
      const database = createDatabase<IdentityDatabase>(connectionStringOf(identity), { max: 1 });
      try {
        return (await database.selectFrom('users').select('username').orderBy('username').execute()).map(
          (row) => row.username ?? '',
        );
      } finally {
        await database.destroy();
      }
    }

    before(async () => {
      test = await startTenantTestPlatform({ schools: [], layout: layoutKind, label: `s7b${layoutKind[0]}` });
      environment = {
        platform: test.platform,
        masterKey: test.masterKey,
        layout: test.layout,
        systemDomain: 'thu.example.test',
      };
      directory = await mkdtemp(join(tmpdir(), 's7b-'));
      code = `bk-${layoutKind[0]}-${test.suffix}`;
      const started = await startProvisioning(
        environment,
        {
          code,
          name: 'Trường sao lưu (dữ liệu giả)',
          levels: ['THCS'],
          first_year_start: 2026,
          domain: { mode: 'system' },
          data_class: 'synthetic',
          admin: { full_name: 'Quản trị giả', login: 'quantri' },
          terms: { version: 'PL-04 v1', accepted: true, accepted_by_name: 'Hiệu trưởng giả' },
        },
        actor,
      );
      assert.equal((await runProvisioningJob(environment, started.jobId)).status, 'done');
    });

    after(async () => {
      const schools = await test?.platform.selectFrom('schools').select('id').execute();
      for (const school of schools ?? []) {
        await dropSchool({
          platform: test.platform,
          masterKey: test.masterKey,
          layout: test.layout,
          schoolId: school.id,
        }).catch(() => undefined);
      }
      await test?.close();
      await rm(directory, { recursive: true, force: true });
    });

    it('sao lưu đủ cơ sở dữ liệu, đọc lại kiểm tra được; sai khóa hoặc tệp bị sửa thì từ chối', async () => {
      const summary = await backupSchool({
        platform: test.platform,
        masterKey: test.masterKey,
        code,
        passphrase: PASSPHRASE,
        directory,
        actor,
      });
      file = summary.file;
      assert.equal(summary.databases, 3);
      assert.ok(summary.tables > 100);
      assert.equal(await latestBackupFile(directory, code), file);
      const contents = await verifyBackup(file, PASSPHRASE);
      assert.equal(contents.header.school.code, code);
      assert.ok(contents.header.keys);
      // Tệp mã hóa: không thấy tên trường, tên đăng nhập ở dạng rõ
      const raw = await readFile(file);
      assert.equal(raw.includes(Buffer.from('quantri')), false);
      await assert.rejects(() => verifyBackup(file, 'khoa-sai-nhung-du-dai-ky-tu'), /sai khóa hoặc tệp hỏng/);
      const tampered = join(directory, 'hong.sbak');
      const copy = Buffer.from(raw);
      copy[Math.floor(copy.length / 2)] = (copy[Math.floor(copy.length / 2)] ?? 0) ^ 0xff;
      await writeFile(tampered, copy);
      await assert.rejects(() => verifyBackup(tampered, PASSPHRASE), /sai khóa hoặc tệp hỏng/);
      const run = await test.platform
        .selectFrom('backup_runs')
        .selectAll()
        .where('school_code', '=', code)
        .where('kind', '=', 'backup')
        .executeTakeFirstOrThrow();
      assert.equal(run.status, 'done');
      assert.equal(run.file_sha256, summary.sha256);
    });

    it('khôi phục thành trường mới (để xem lại) không đụng trường gốc; tên cơ sở dữ liệu năm học đổi theo trường mới', async () => {
      const newCode = `rv-${layoutKind[0]}-${test.suffix}`;
      const result = await restoreSchool({
        environment,
        file,
        passphrase: PASSPHRASE,
        target: { mode: 'new', code: newCode },
        actor,
      });
      assert.equal(result.databases, 3);
      const school = await test.platform
        .selectFrom('schools')
        .selectAll()
        .where('code', '=', newCode)
        .executeTakeFirstOrThrow();
      assert.equal(school.status, 'suspended');
      assert.deepEqual(await usernames(newCode), ['quantri']);
      const system = (await descriptorsOf(newCode)).find((item) => item.kind === 'system');
      assert.ok(system);
      const database = createDatabase<SystemDatabase>(connectionStringOf(system), { max: 1 });
      try {
        const years = await database.selectFrom('academic_year_databases').select('database_name').execute();
        assert.ok(
          years.every((row) => row.database_name.startsWith(school.year_database_prefix)),
          JSON.stringify(years),
        );
      } finally {
        await database.destroy();
      }
      const domains = await test.platform
        .selectFrom('school_domains')
        .select('host')
        .where('school_id', '=', school.id)
        .execute();
      assert.deepEqual(
        domains.map((row) => row.host),
        [`${newCode}.thu.example.test`],
      );
      assert.deepEqual(await usernames(code), ['quantri']);
    });

    it('khôi phục vào chính trường (đang tạm dừng) trả dữ liệu về lúc sao lưu', async () => {
      const identity = (await descriptorsOf(code)).find((item) => item.kind === 'identity');
      assert.ok(identity);
      const database = createDatabase<IdentityDatabase>(connectionStringOf(identity), { max: 1 });
      try {
        await database
          .insertInto('users')
          .values({ full_name: 'Tài khoản thêm sau sao lưu (giả)', username: 'them-sau', password_hash: 'gia' })
          .execute();
      } finally {
        await database.destroy();
      }
      assert.deepEqual(await usernames(code), ['quantri', 'them-sau']);
      await assert.rejects(
        () => restoreSchool({ environment, file, passphrase: PASSPHRASE, target: { mode: 'in-place' }, actor }),
        /Tạm dừng trường/,
      );
      await suspendSchool(environment, code, actor, 'Khôi phục (giả)');
      await restoreSchool({ environment, file, passphrase: PASSPHRASE, target: { mode: 'in-place' }, actor });
      assert.deepEqual(await usernames(code), ['quantri']);
    });

    it('phạm vi active bỏ năm học chỉ đọc; diễn tập khôi phục gỡ trường tạm và ghi kết quả', async () => {
      const school = await test.platform
        .selectFrom('schools')
        .select('id')
        .where('code', '=', code)
        .executeTakeFirstOrThrow();
      await test.platform
        .updateTable('school_databases')
        .set({ status: 'read_only' })
        .where('school_id', '=', school.id)
        .where('kind', '=', 'school-year')
        .execute();
      const active = await backupSchool({
        platform: test.platform,
        masterKey: test.masterKey,
        code,
        passphrase: PASSPHRASE,
        directory,
        scope: 'active',
        actor,
        now: new Date(Date.now() + 1000),
      });
      assert.equal(active.databases, 2);
      await test.platform
        .updateTable('school_databases')
        .set({ status: 'active' })
        .where('school_id', '=', school.id)
        .where('kind', '=', 'school-year')
        .execute();

      const before = await test.platform.selectFrom('schools').select('code').execute();
      const drill = await drillRestore({ environment, file, passphrase: PASSPHRASE, actor });
      assert.ok(drill.durationMilliseconds > 0);
      const after = await test.platform.selectFrom('schools').select('code').execute();
      assert.equal(after.length, before.length);
      const run = await test.platform
        .selectFrom('backup_runs')
        .selectAll()
        .where('kind', '=', 'drill')
        .executeTakeFirstOrThrow();
      assert.equal(run.status, 'done');
      assert.ok(Number(run.rows) > 0);
    });

    it('chuyển trường sang cụm khác: chép, đổi mô tả kết nối, trả trạng thái cũ, xóa bản ở cụm nguồn', async () => {
      const url = new URL(test.adminUrl);
      const otherHost = url.hostname === '127.0.0.1' ? 'localhost' : '127.0.0.1';
      const shared = `school_cluster_${layoutKind[0]}_${test.suffix}`;
      await createEmptyDatabase(test.adminUrl, shared);
      try {
        const school = await test.platform
          .selectFrom('schools')
          .selectAll()
          .where('code', '=', code)
          .executeTakeFirstOrThrow();
        await test.platform.updateTable('schools').set({ status: 'active' }).where('id', '=', school.id).execute();
        const targetLayout = createSchoolDatabaseLayout('schema', {
          adminUrl: test.adminUrl,
          host: otherHost,
          sharedDatabase: shared,
        });
        const result = await moveSchoolToCluster({
          platform: test.platform,
          masterKey: test.masterKey,
          code,
          sourceLayout: test.layout,
          targetLayout,
          actor,
          dropSource: true,
          rename: (name) => `${name}_m`,
        });
        assert.equal(result.databases, 3);
        assert.ok(result.cluster.startsWith(otherHost));
        const moved = await descriptorsOf(code);
        assert.ok(
          moved.every((item) => item.host === otherHost && item.databaseName === shared && item.layout === 'schema'),
        );
        assert.deepEqual(await usernames(code), ['quantri']);
        const after = await test.platform
          .selectFrom('schools')
          .selectAll()
          .where('id', '=', school.id)
          .executeTakeFirstOrThrow();
        assert.equal(after.status, 'active');
        assert.notEqual(after.cluster_id, school.cluster_id);
        // Trả trường về cụm kiểm thử để bước dọn dẹp xóa được
        await moveSchoolToCluster({
          platform: test.platform,
          masterKey: test.masterKey,
          code,
          sourceLayout: targetLayout,
          targetLayout: test.layout,
          actor,
          dropSource: true,
          rename: (name) => name.replace(/_m$/, ''),
        });
      } finally {
        await dropDatabaseIfExists(test.adminUrl, shared);
      }
    });
  });
}
