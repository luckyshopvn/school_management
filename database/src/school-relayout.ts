import type { Kysely } from 'kysely';
import { decryptSecret } from '@school-management/server/tenancy';
import type { PlatformDatabase, SchoolDatabaseKind } from '../platform/schema.js';
import { migrateToLatest } from './migrate.js';
import { registerDescriptor, storeSchoolKeys, writeAudit } from './provision-school.js';
import {
  connectionStringOf,
  descriptorFromRow,
  generatePassword,
  schoolSlug,
  type SchoolDatabaseLayout,
} from './school-database-layout.js';
import { copyDatabase } from './school-data-copy.js';
import type { Actor } from './school-lifecycle.js';

// Chuyển một trường sang nền tảng khác hoặc bố cục khác mà không sửa mã (DT-SaaS phần S9, YCTD-203; tài liệu 32 mục 14.5 "Chuyển
// lên VPS không sửa mã"): từ hồ sơ thử nghiệm (bố cục schema ở Neon, Supabase) sang hồ sơ vận hành (bố cục database ở VPS trong
// nước), hoặc ngược lại. Các bước:
// 1. trường nguồn phải đang tạm dừng hoặc chỉ đọc để dữ liệu không đổi trong lúc chép;
// 2. ở nền tảng đích: ghi trường (cùng mã, tiền tố khóa, tiền tố tên năm học), khóa dữ liệu trẻ bọc lại bằng khóa gốc của nền tảng
//    đích, tên miền, hồ sơ đồng ý, vùng máy chủ; tạo từng cơ sở dữ liệu (hoặc lược đồ) theo bố cục đích và chạy migrate;
// 3. chép dữ liệu từng bảng bằng vai trò của trường ở đích trong một giao dịch mỗi cơ sở dữ liệu (school-data-copy.ts: xóa
//    dữ liệu mặc định của migrate, tắt trigger, gỡ rồi gắn lại khóa ngoại, đặt lại bộ đếm tự tăng);
// 4. so số dòng và tổng kiểm (md5 của các dòng đã sắp) từng bảng giữa nguồn và đích; lệch thì báo lỗi, không bật trường;
// 5. trường ở đích giữ trạng thái của nguồn; đổi loại dữ liệu sang `production`, ghi vùng máy chủ mới, bật lại trường và xóa
//    trường ở nền tảng nguồn là bước của người vận hành sau khi kiểm tra (tệp chép bằng công cụ S3 như rclone, giữ nguyên khóa)
export interface RelayoutSide {
  platform: Kysely<PlatformDatabase>;
  masterKey: Buffer;
}

export interface RelayoutTarget extends RelayoutSide {
  layout: SchoolDatabaseLayout;
}

export interface RelayoutTableReport {
  database: string;
  table: string;
  rows: number;
  checksumMatches: boolean;
}

export interface RelayoutReport {
  code: string;
  databases: string[];
  tables: RelayoutTableReport[];
}

export async function relayoutSchool(options: {
  source: RelayoutSide;
  target: RelayoutTarget;
  code: string;
  actor: Actor;
  onProgress?: (line: string) => void;
}): Promise<RelayoutReport> {
  const { source, target, code, actor } = options;
  const school = await source.platform.selectFrom('schools').selectAll().where('code', '=', code).executeTakeFirst();
  if (!school) {
    throw new Error(`Không tìm thấy trường ${code} ở nền tảng nguồn`);
  }
  if (school.status !== 'suspended' && school.status !== 'read_only') {
    throw new Error(
      'Tạm dừng hoặc chuyển chỉ đọc trường nguồn trước khi chuyển (dữ liệu không được đổi trong lúc chép)',
    );
  }
  const exists = await target.platform.selectFrom('schools').select('id').where('code', '=', code).executeTakeFirst();
  if (exists) {
    throw new Error(`Nền tảng đích đã có trường ${code}; xóa trường đó trước khi chuyển lại`);
  }
  const keys = await source.platform
    .selectFrom('school_keys')
    .selectAll()
    .where('school_id', '=', school.id)
    .executeTakeFirst();
  const sourceDescriptors = (
    await source.platform
      .selectFrom('school_databases')
      .selectAll()
      .where('school_id', '=', school.id)
      .where('status', '!=', 'dropped')
      .execute()
  ).map((row) => ({ descriptor: descriptorFromRow(row, source.masterKey), status: row.status }));
  const order: SchoolDatabaseKind[] = ['identity', 'system', 'school-year'];
  sourceDescriptors.sort((left, right) => order.indexOf(left.descriptor.kind) - order.indexOf(right.descriptor.kind));

  const created = await target.platform
    .insertInto('schools')
    .values({
      code: school.code,
      name: school.name,
      status: 'provisioning',
      data_class: school.data_class,
      key_prefix: school.key_prefix,
      year_database_prefix: school.year_database_prefix,
      notes: school.notes,
      address: school.address,
      school_levels: JSON.stringify(school.school_levels ?? []),
      first_academic_year: school.first_academic_year,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  if (keys) {
    await storeSchoolKeys(target.platform, target.masterKey, created.id, {
      encryption: Buffer.from(decryptSecret(source.masterKey, keys.child_encryption_key_encrypted), 'base64'),
      hash: Buffer.from(decryptSecret(source.masterKey, keys.child_hash_key_encrypted), 'base64'),
    });
  }
  const domains = await source.platform
    .selectFrom('school_domains')
    .select([
      'host',
      'kind',
      'status',
      'verified_at',
      'provider',
      'verification_token',
      'cname_target',
      'last_checked_at',
      'check_error',
    ])
    .where('school_id', '=', school.id)
    .execute();
  for (const domain of domains) {
    await target.platform
      .insertInto('school_domains')
      .values({ ...domain, school_id: created.id })
      .execute();
  }
  // Hồ sơ đồng ý giữ nguyên; người ghi ở nền tảng nguồn không có ở đích nên chỉ giữ tên người ghi
  const consents = await source.platform
    .selectFrom('school_consents')
    .select([
      'kind',
      'template_code',
      'template_version',
      'signer_name',
      'signer_title',
      'signed_on',
      'valid_from',
      'valid_until',
      'data_scope',
      'hosting_snapshot',
      'file_sha256',
      'file_key',
      'file_name',
      'submitted_to_authority_on',
      'authority_reference',
      'recorded_by_name',
      'withdrawn_on',
    ])
    .where('school_id', '=', school.id)
    .execute();
  for (const consent of consents) {
    await target.platform
      .insertInto('school_consents')
      .values({
        ...consent,
        school_id: created.id,
        recorded_by: null,
        hosting_snapshot: JSON.stringify(consent.hosting_snapshot ?? []),
      })
      .execute();
  }
  const hostingRows = await source.platform
    .selectFrom('school_hosting')
    .select(['provider', 'service', 'region', 'role', 'stores_personal_data', 'started_on', 'ended_on'])
    .where('school_id', '=', school.id)
    .execute();
  for (const hosting of hostingRows) {
    await target.platform
      .insertInto('school_hosting')
      .values({ ...hosting, school_id: created.id })
      .execute();
  }

  const report: RelayoutReport = { code, databases: [], tables: [] };
  const slug = schoolSlug(code);
  const rolePassword = generatePassword();
  for (const { descriptor, status } of sourceDescriptors) {
    const physicalName =
      descriptor.kind === 'identity'
        ? `s_${slug}_identity`
        : descriptor.kind === 'system'
          ? `s_${slug}_system`
          : descriptor.name;
    const targetDescriptor = await target.layout.create({
      schoolCode: code,
      kind: descriptor.kind,
      logicalName: descriptor.name,
      physicalName,
      schoolRolePassword: rolePassword,
    });
    await registerDescriptor(target.platform, target.masterKey, created.id, targetDescriptor);
    const migration = await migrateToLatest(descriptor.kind, connectionStringOf(targetDescriptor));
    if (migration.error) {
      throw migration.error;
    }
    const totals = await copyDatabase(descriptor, targetDescriptor);
    for (const item of totals) {
      report.tables.push({
        database: targetDescriptor.name,
        table: item.table,
        rows: item.rows,
        checksumMatches: true,
      });
    }
    options.onProgress?.(
      `${targetDescriptor.kind}:${targetDescriptor.name}: ${totals.length} bảng đã chép, khớp số dòng và tổng kiểm`,
    );
    if (status === 'read_only') {
      await target.layout.setReadOnly(targetDescriptor, true);
      await target.platform
        .updateTable('school_databases')
        .set({ status: 'read_only' })
        .where('school_id', '=', created.id)
        .where('kind', '=', descriptor.kind)
        .where('name', '=', descriptor.name)
        .execute();
    }
    report.databases.push(`${descriptor.kind}:${descriptor.name}`);
  }

  await target.platform
    .updateTable('schools')
    .set({ status: school.status, suspended_at: school.suspended_at, updated_at: new Date() })
    .where('id', '=', created.id)
    .execute();
  await target.platform
    .insertInto('school_lifecycle_events')
    .values({
      school_id: created.id,
      event: 'relayout-imported',
      from_status: null,
      to_status: school.status,
      reason: `Chuyển từ nền tảng khác: ${report.databases.length} cơ sở dữ liệu, ${report.tables.length} bảng khớp`,
      actor_type: actor.type,
      actor_id: actor.id ?? null,
    })
    .execute();
  await writeAudit(target.platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'school.relayout-imported',
    schoolId: created.id,
    details: { code, databases: report.databases, tables: report.tables.length },
  });
  await writeAudit(source.platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'school.relayout-exported',
    schoolId: school.id,
    details: { code, databases: report.databases, tables: report.tables.length },
  });
  return report;
}
