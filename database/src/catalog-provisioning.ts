import { sql, type Kysely } from 'kysely';
import type { PlatformDatabase, SchoolStatusValue } from '../platform/schema.js';
import { generateChildKeyPair, storeSchoolKeys, writeAudit } from './provision-school.js';
import { catalogUnitByCode } from './school-catalog.js';
import { schoolSlug } from './school-database-layout.js';
import {
  LifecycleError,
  runProvisioningJob,
  SCHOOL_LEVEL_CODES,
  systemHostOf,
  type Actor,
  type LifecycleEnvironment,
  type ProvisionJobInput,
  type ProvisionResult,
} from './school-lifecycle.js';
import { vietnamDate } from './school-plans.js';

// Mở mọi đơn vị trong danh mục, khởi tạo trường ở lần mở đầu tiên (YCTD-314, Eric yêu cầu ngày 2026-10-28; tài liệu 47 mục
// 16.11). Không dựng sẵn cả danh mục: trường chỉ được tạo (cơ sở dữ liệu định danh, hệ thống, năm học hiện tại, khóa, tên miền
// `<mã>.<tên miền hệ thống>`) khi quản trị nền tảng mở ở cổng vận hành hoặc người dùng chọn đơn vị ở trang đăng nhập.
// - Mã trường suy ra cố định từ mã Bộ (`dv-<mã Bộ>`), nên hai lần mở đầu cùng lúc đụng ràng buộc duy nhất của `schools.code` và
//   `schools.moet_code`: một lần ghi được, lần kia đọc lại trường vừa ghi. Việc khởi tạo chỉ một tiến trình chạy nhờ bước nhận việc
//   (đổi trạng thái có điều kiện); việc chạy dở quá 10 phút không cập nhật thì coi là bỏ dở và nhận lại được; việc lỗi nhận lại ở
//   lần mở sau. Các bước của runProvisioningJob vốn chạy lại được.
// - Trường mới ở trạng thái hoạt động, không hạn, gán gói `co-ban-mien-phi`; chưa có tài khoản nào: quản trị nền tảng vào trường
//   (phiên quản trị nền tảng) rồi tạo tài khoản quản trị đầu tiên theo quy tắc tài khoản của YCTD-311.
// - Loại dữ liệu ban đầu `synthetic` (chưa có dữ liệu cá nhân); người vận hành đổi loại dữ liệu khi trường nhập dữ liệu thật.
// - Chống lạm dụng từ trang đăng nhập công khai: tối đa `maxPerHour` trường tự khởi tạo mỗi giờ trên toàn nền tảng (mặc định 60).
export const CATALOG_PROVISION_RULE_CODE = 'YCTD-314';
export const FREE_PLAN_CODE = 'co-ban-mien-phi';
export const DEFAULT_CATALOG_PROVISIONS_PER_HOUR = 60;
const STALE_JOB_MINUTES = 10;
const SERVING = new Set<SchoolStatusValue>(['trial', 'active', 'read_only']);

export type CatalogSchoolState = 'not_provisioned' | 'provisioning' | 'ready' | 'unavailable';

export interface CatalogSchoolStatus {
  state: CatalogSchoolState;
  schoolId: string | null;
  code: string | null;
  status: SchoolStatusValue | null;
  jobId: string | null;
}

// Mã trường của đơn vị: chữ thường, số, gạch ngang, tối đa 32 ký tự (quy tắc mã trường của S1a)
export function catalogSchoolCode(moetCode: string): string {
  const body = moetCode
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 29)
    .replace(/-+$/, '');
  return `dv-${body}`;
}

// Năm học hiện tại theo giờ Việt Nam: từ tháng 8 là năm học mới (2026-10-28 là năm học 2026-2027)
export function currentSchoolYearStart(now: Date): number {
  const [year, month] = vietnamDate(now).split('-').map(Number) as [number, number];
  return month >= 8 ? year : year - 1;
}

export async function readCatalogSchool(
  platform: Kysely<PlatformDatabase>,
  moetCode: string,
): Promise<CatalogSchoolStatus> {
  const school = await platform
    .selectFrom('schools')
    .select(['id', 'code', 'status'])
    .where('moet_code', '=', moetCode)
    .where('status', '!=', 'deleted')
    .executeTakeFirst();
  if (!school) {
    return { state: 'not_provisioned', schoolId: null, code: null, status: null, jobId: null };
  }
  const job =
    school.status === 'provisioning'
      ? await platform
          .selectFrom('provisioning_jobs')
          .select('id')
          .where('school_id', '=', school.id)
          .where('kind', '=', 'provision')
          .orderBy('created_at', 'desc')
          .executeTakeFirst()
      : undefined;
  return {
    state: SERVING.has(school.status) ? 'ready' : school.status === 'provisioning' ? 'provisioning' : 'unavailable',
    schoolId: school.id,
    code: school.code,
    status: school.status,
    jobId: job?.id ?? null,
  };
}

// Nhận một việc khởi tạo để chạy: chỉ một bên nhận được; việc đang chạy mà quá hạn không cập nhật thì nhận lại
export async function claimProvisioningJob(
  platform: Kysely<PlatformDatabase>,
  jobId: string,
  now: Date,
): Promise<boolean> {
  const stale = new Date(now.getTime() - STALE_JOB_MINUTES * 60_000);
  const claimed = await platform
    .updateTable('provisioning_jobs')
    .set({ status: 'running', updated_at: now })
    .where('id', '=', jobId)
    .where((expression) =>
      expression.or([
        expression('status', 'in', ['pending', 'failed']),
        expression.and([expression('status', '=', 'running'), expression('updated_at', '<', stale)]),
      ]),
    )
    .executeTakeFirst();
  return Number(claimed.numUpdatedRows) === 1;
}

async function createCatalogSchool(
  environment: LifecycleEnvironment,
  moetCode: string,
  actor: Actor,
  maxPerHour: number,
  now: Date,
): Promise<void> {
  const { platform } = environment;
  const unit = await catalogUnitByCode(platform, moetCode);
  if (!unit || unit.status !== 'active') {
    throw new LifecycleError('Không tìm thấy đơn vị trong danh mục', [], 'not_found');
  }
  const code = catalogSchoolCode(moetCode);
  const host = systemHostOf(code, environment.systemDomain);
  if (!host) {
    throw new LifecycleError('Nền tảng chưa cấu hình tên miền hệ thống nên chưa tự khởi tạo trường được');
  }
  const recent = await platform
    .selectFrom('provisioning_jobs')
    .select(sql<string>`count(*)`.as('count'))
    .where('kind', '=', 'provision')
    .where(sql<string>`input->>'source'`, '=', 'catalog')
    .where('created_at', '>', new Date(now.getTime() - 3_600_000))
    .executeTakeFirstOrThrow();
  if (Number(recent.count) >= maxPerHour) {
    throw new LifecycleError(
      'Nền tảng đang khởi tạo nhiều đơn vị mới; vui lòng thử lại sau ít phút hoặc liên hệ bộ phận hỗ trợ',
    );
  }
  // Giáo dục thường xuyên dạy chương trình THCS, THPT: cấp học của trường dùng THPT khi danh mục không có cấp phổ thông
  const levels = unit.levels.filter((level) => (SCHOOL_LEVEL_CODES as readonly string[]).includes(level));
  const firstYear = currentSchoolYearStart(now);
  const input: ProvisionJobInput = {
    levels: levels.length > 0 ? levels : ['THPT'],
    first_year_start: firstYear,
    domain: { mode: 'system', host },
    status: 'active',
    admin: null,
    terms: null,
    school_name: unit.name,
    address: null,
    source: 'catalog',
    plan_code: FREE_PLAN_CODE,
  };
  const slug = schoolSlug(code);
  await platform.transaction().execute(async (transaction) => {
    // Ràng buộc duy nhất của mã trường và mã Bộ: lần mở thứ hai cùng lúc không ghi gì, đọc lại trường của lần thứ nhất
    const school = await transaction
      .insertInto('schools')
      .values({
        code,
        name: unit.name,
        status: 'provisioning',
        data_class: 'synthetic',
        key_prefix: code,
        year_database_prefix: `s_${slug}_year_`,
        school_levels: JSON.stringify(input.levels),
        first_academic_year: `${firstYear}-${firstYear + 1}`,
        moet_code: moetCode,
      })
      .onConflict((conflict) => conflict.doNothing())
      .returning('id')
      .executeTakeFirst();
    if (!school) {
      return;
    }
    await storeSchoolKeys(transaction, environment.masterKey, school.id, generateChildKeyPair());
    const job = await transaction
      .insertInto('provisioning_jobs')
      .values({
        school_id: school.id,
        school_code: code,
        kind: 'provision',
        status: 'pending',
        input: JSON.stringify(input),
        actor_type: actor.type,
        actor_id: actor.id ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await writeAudit(transaction, {
      actorType: actor.type,
      ...(actor.id ? { actorId: actor.id } : {}),
      action: 'school.catalog-provision-requested',
      schoolId: school.id,
      details: { code, moet_code: moetCode, domain: host, job_id: job.id, requested_by: actor.name },
    });
  });
}

// Lần mở một đơn vị: trường đã phục vụ thì trả ngay; chưa có thì ghi trường và việc khởi tạo; còn đang khởi tạo thì nhận việc
// nếu chưa ai chạy. `claimed` là true khi bên gọi phải chạy completeCatalogSchool (thường chạy nền)
export async function requestCatalogSchool(
  environment: LifecycleEnvironment,
  moetCode: string,
  actor: Actor,
  options: { maxPerHour?: number } = {},
): Promise<CatalogSchoolStatus & { claimed: boolean }> {
  const { platform } = environment;
  const now = environment.now ? environment.now() : new Date();
  let current = await readCatalogSchool(platform, moetCode);
  if (current.state === 'not_provisioned') {
    await createCatalogSchool(
      environment,
      moetCode,
      actor,
      options.maxPerHour ?? DEFAULT_CATALOG_PROVISIONS_PER_HOUR,
      now,
    );
    current = await readCatalogSchool(platform, moetCode);
    if (current.state === 'not_provisioned') {
      throw new LifecycleError('Mã trường của đơn vị đã được một trường khác dùng; liên hệ bộ phận hỗ trợ');
    }
  }
  if (current.state !== 'provisioning' || !current.jobId) {
    return { ...current, claimed: false };
  }
  return { ...current, claimed: await claimProvisioningJob(platform, current.jobId, now) };
}

// Chạy việc khởi tạo đã nhận; lỗi thì việc ở trạng thái `failed`, lần mở sau nhận lại
export async function completeCatalogSchool(
  environment: LifecycleEnvironment,
  jobId: string,
): Promise<ProvisionResult> {
  return runProvisioningJob(environment, jobId);
}
