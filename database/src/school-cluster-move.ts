import { encryptSecret } from '@school-management/server/tenancy';
import type { Kysely } from 'kysely';
import type { PlatformDatabase, SchoolDatabaseKind, SchoolStatusValue } from '../platform/schema.js';
import { migrateToLatest } from './migrate.js';
import { writeAudit } from './provision-school.js';
import { finishBackupRun, startBackupRun } from './school-backup.js';
import { copyDatabase } from './school-data-copy.js';
import {
  connectionStringOf,
  descriptorFromRow,
  generatePassword,
  type DatabaseDescriptor,
  type SchoolDatabaseLayout,
} from './school-database-layout.js';
import type { Actor } from './school-lifecycle.js';

// Chuyển một trường sang cụm cơ sở dữ liệu khác trong cùng nền tảng (DT-SaaS phần S7b, YCTD-199; tài liệu 32 mục 14.5): dùng khi
// một máy cơ sở dữ liệu đầy. Các bước, ghi ở `backup_runs` (loại cluster-move):
// 1. tạm dừng trường (dừng ghi; người dùng nhận 503) nếu chưa tạm dừng, ghi sự kiện vòng đời;
// 2. tạo từng cơ sở dữ liệu (hoặc lược đồ) ở cụm đích theo bố cục đích, chạy migrate, chép dữ liệu bằng vai trò của trường,
//    so số dòng và tổng kiểm từng bảng;
// 3. trong một giao dịch: đổi mô tả kết nối ở `school_databases` sang cụm đích, đổi `schools.cluster_id`;
// 4. trả trường về trạng thái cũ; bộ phân giải của các tiến trình đọc mô tả mới sau TENANT_CACHE_SECONDS;
// 5. xóa cơ sở dữ liệu ở cụm nguồn khi có dropSource (mặc định giữ để đối chiếu, xóa bằng lần chạy sau).
// Lỗi ở bước 2 thì xóa phần đã tạo ở cụm đích, giữ nguyên mô tả cũ, trả trường về trạng thái cũ.
export interface ClusterMoveResult {
  code: string;
  cluster: string;
  databases: number;
  tables: number;
  rows: number;
  durationMilliseconds: number;
}

export async function moveSchoolToCluster(options: {
  platform: Kysely<PlatformDatabase>;
  masterKey: Buffer;
  code: string;
  sourceLayout: SchoolDatabaseLayout;
  targetLayout: SchoolDatabaseLayout;
  actor: Actor;
  dropSource?: boolean;
  // Tên cơ sở dữ liệu, lược đồ ở cụm đích (mặc định giữ tên cũ); cần khi hai cụm dùng chung một máy chủ PostgreSQL
  rename?: (physicalName: string) => string;
  onProgress?: (line: string) => void;
}): Promise<ClusterMoveResult> {
  const { platform, code, actor } = options;
  const started = Date.now();
  const school = await platform.selectFrom('schools').selectAll().where('code', '=', code).executeTakeFirst();
  if (!school || ['provisioning', 'deleted', 'pending_deletion'].includes(school.status)) {
    throw new Error(`Không có trường ${code} đang phục vụ hoặc tạm dừng để chuyển cụm`);
  }
  const rows = await platform
    .selectFrom('school_databases')
    .selectAll()
    .where('school_id', '=', school.id)
    .where('status', '!=', 'dropped')
    .execute();
  const order: SchoolDatabaseKind[] = ['identity', 'system', 'school-year'];
  rows.sort((left, right) => order.indexOf(left.kind) - order.indexOf(right.kind));
  const previousStatus: SchoolStatusValue = school.status;
  const runId = await startBackupRun(platform, { schoolId: school.id, code, kind: 'cluster-move', actor });
  const setStatus = async (status: SchoolStatusValue, event: string, reason: string) => {
    await platform
      .updateTable('schools')
      .set({ status, updated_at: new Date(), ...(status === 'suspended' ? { suspended_at: new Date() } : {}) })
      .where('id', '=', school.id)
      .execute();
    await platform
      .insertInto('school_lifecycle_events')
      .values({
        school_id: school.id,
        event,
        from_status: status === 'suspended' ? previousStatus : 'suspended',
        to_status: status,
        reason,
        actor_type: actor.type,
        actor_id: actor.id ?? null,
      })
      .execute();
  };
  if (previousStatus !== 'suspended') {
    await setStatus('suspended', 'suspended', 'Chuyển cụm cơ sở dữ liệu (dừng ghi trong lúc chép)');
  }
  const created: DatabaseDescriptor[] = [];
  let tables = 0;
  let copiedRows = 0;
  try {
    const rolePassword = generatePassword();
    const moved: Array<{ id: string; status: string; target: DatabaseDescriptor; source: DatabaseDescriptor }> = [];
    for (const row of rows) {
      const source = descriptorFromRow(row, options.masterKey);
      const physical = (options.rename ?? ((name: string) => name))(source.schemaName ?? source.databaseName);
      const target = await options.targetLayout.create({
        schoolCode: code,
        kind: row.kind,
        logicalName: row.name,
        physicalName: physical,
        schoolRolePassword: rolePassword,
      });
      created.push(target);
      const migration = await migrateToLatest(row.kind, connectionStringOf(target));
      if (migration.error) {
        throw migration.error;
      }
      const totals = await copyDatabase(source, target);
      tables += totals.length;
      copiedRows += totals.reduce((sum, item) => sum + item.rows, 0);
      if (row.status === 'read_only') {
        await options.targetLayout.setReadOnly(target, true);
      }
      moved.push({ id: row.id, status: row.status, target, source });
      options.onProgress?.(`${row.kind}:${row.name}: ${totals.length} bảng đã chép sang ${target.host}:${target.port}`);
    }
    const first = created[0];
    if (!first) {
      throw new Error('Trường không có cơ sở dữ liệu nào');
    }
    const clusterName = `${first.host}:${first.port}`;
    await platform.transaction().execute(async (transaction) => {
      const cluster = await transaction
        .insertInto('school_clusters')
        .values({ name: clusterName, host: first.host, port: first.port })
        .onConflict((conflict) => conflict.column('name').doUpdateSet({ host: first.host }))
        .returning('id')
        .executeTakeFirstOrThrow();
      for (const item of moved) {
        await transaction
          .updateTable('school_databases')
          .set({
            layout: item.target.layout,
            host: item.target.host,
            port: item.target.port,
            database_name: item.target.databaseName,
            schema_name: item.target.schemaName,
            role_name: item.target.roleName,
            login_name: item.target.loginName ?? null,
            password_encrypted: encryptSecret(options.masterKey, item.target.password),
            updated_at: new Date(),
          })
          .where('id', '=', item.id)
          .execute();
      }
      await transaction.updateTable('schools').set({ cluster_id: cluster.id }).where('id', '=', school.id).execute();
    });
    if (options.dropSource) {
      for (const item of moved) {
        await options.sourceLayout.drop(item.source);
      }
      await options.sourceLayout.dropSchoolRole(code);
    }
    if (previousStatus !== 'suspended') {
      await setStatus(previousStatus, 'resumed', `Chuyển cụm xong sang ${clusterName}`);
    }
    const result: ClusterMoveResult = {
      code,
      cluster: clusterName,
      databases: moved.length,
      tables,
      rows: copiedRows,
      durationMilliseconds: Date.now() - started,
    };
    await finishBackupRun(platform, runId, {
      status: 'done',
      databases: moved.length,
      tables,
      rows: copiedRows,
      details: {
        cluster: clusterName,
        dropped_source: Boolean(options.dropSource),
        duration_ms: result.durationMilliseconds,
      },
    });
    await writeAudit(platform, {
      actorType: actor.type,
      ...(actor.id ? { actorId: actor.id } : {}),
      action: 'school.cluster-moved',
      schoolId: school.id,
      details: { cluster: clusterName, databases: moved.length, tables },
    });
    return result;
  } catch (error) {
    for (const descriptor of created) {
      await options.targetLayout.drop(descriptor).catch(() => undefined);
    }
    await options.targetLayout.dropSchoolRole(code).catch(() => undefined);
    if (previousStatus !== 'suspended') {
      await setStatus(previousStatus, 'resumed', 'Chuyển cụm lỗi, giữ cụm cũ');
    }
    await finishBackupRun(platform, runId, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
