import type { SchoolYearDatabase, SystemDatabase } from '@school-management/database';
import { ApplicationError, currentTenant } from '@school-management/server';
import { sql, type Kysely, type Transaction } from 'kysely';

// Giới hạn của gói dịch vụ (DT-SaaS phần S5a, YCTD-194; tài liệu 47 mục 14.5): vượt giới hạn thì chặn **thêm mới** (học sinh vào
// trạng thái đang học, tệp tải lên, cấp học bật thêm), không chặn xem hay sửa dữ liệu đã có. Trường chưa gán gói hoặc chế độ một
// trường không giới hạn
type YearExecutor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

function planLimit(key: 'maxActiveStudents' | 'maxStorageMb' | 'maxSchoolLevels'): number | null {
  const plan = currentTenant()?.plan;
  return plan ? plan[key] : null;
}

export async function countActiveStudents(database: YearExecutor): Promise<number> {
  const row = await database
    .selectFrom('children')
    .select((builder) => builder.fn.countAll<string>().as('count'))
    .where('status', '=', 'active')
    .where('deleted_at', 'is', null)
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

// Gọi trước khi đưa thêm `adding` học sinh vào trạng thái đang học
export async function assertStudentCapacity(database: YearExecutor, adding: number): Promise<void> {
  const limit = planLimit('maxActiveStudents');
  if (limit === null || adding <= 0) {
    return;
  }
  const current = await countActiveStudents(database);
  if (current + adding > limit) {
    throw new ApplicationError(
      'PLAN_LIMIT_EXCEEDED',
      `Gói dịch vụ cho phép tối đa ${limit} học sinh đang học; trường đang có ${current}, thêm ${adding} sẽ vượt giới hạn`,
      [{ field: 'max_active_students', message: String(limit) }],
    );
  }
}

// Dung lượng tệp đang dùng (MB) theo bảng tệp của cơ sở dữ liệu hệ thống và năm học hiện hành
export async function usedStorageMb(system: Kysely<SystemDatabase> | null, year: YearExecutor | null): Promise<number> {
  let bytes = 0;
  if (year) {
    const row = await sql<{ total: string | null }>`select coalesce(sum(size_bytes), 0) as total from files`.execute(
      year,
    );
    bytes += Number(row.rows[0]?.total ?? 0);
  }
  if (system) {
    const row = await sql<{
      total: string | null;
    }>`select coalesce(sum(size_bytes), 0) as total from learning_resource_versions`.execute(system);
    bytes += Number(row.rows[0]?.total ?? 0);
  }
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

export async function assertStorageCapacity(
  system: Kysely<SystemDatabase> | null,
  year: YearExecutor | null,
  addingBytes: number,
): Promise<void> {
  const limit = planLimit('maxStorageMb');
  if (limit === null) {
    return;
  }
  const used = await usedStorageMb(system, year);
  if (used + addingBytes / 1024 / 1024 > limit) {
    throw new ApplicationError(
      'PLAN_LIMIT_EXCEEDED',
      `Gói dịch vụ cho phép tối đa ${limit} MB tệp; trường đang dùng ${used} MB`,
      [{ field: 'max_storage_mb', message: String(limit) }],
    );
  }
}

export function assertSchoolLevelCapacity(enabledCount: number): void {
  const limit = planLimit('maxSchoolLevels');
  if (limit !== null && enabledCount > limit) {
    throw new ApplicationError('PLAN_LIMIT_EXCEEDED', `Gói dịch vụ cho phép bật tối đa ${limit} cấp học`, [
      { field: 'max_school_levels', message: String(limit) },
    ]);
  }
}
