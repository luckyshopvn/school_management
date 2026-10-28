import { createHash, randomBytes } from 'node:crypto';
import { DEFAULT_RESERVED_SCHOOL_CODES, normalizeHost, validateSchoolCode } from '@school-management/server/tenancy';
import { sql, type Kysely } from 'kysely';
import type { IdentityDatabase } from '../identity/schema.js';
import type {
  PlatformAuditActorType,
  PlatformDatabase,
  SchoolConsentKind,
  SchoolDataClassValue,
  SchoolDatabaseKind,
  SchoolStatusValue,
} from '../platform/schema.js';
import type { SchoolYearDatabase } from '../school-year/schema.js';
import type { SystemDatabase } from '../system/schema.js';
import { createDatabase } from './connection.js';
import { migrateToLatest } from './migrate.js';
import {
  generateChildKeyPair,
  registerDescriptor,
  storeSchoolKeys,
  writeAudit,
  yearDatabaseName,
} from './provision-school.js';
import {
  connectionStringOf,
  descriptorFromRow,
  generatePassword,
  schoolSlug,
  type DatabaseDescriptor,
  type SchoolDatabaseLayout,
} from './school-database-layout.js';
import { createDomainProvider, type DomainProvider } from './domain-provider.js';
import { addDays, readPlanLifecycleSettings, vietnamDate } from './school-plans.js';

// Khởi tạo và vòng đời trường (DT-SaaS phần S2, YCTD-193; tài liệu 32 mục 14.5). Thư viện dùng chung cho cổng nền tảng (dịch vụ
// định danh), lệnh dòng lệnh `platform` và kiểm thử. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - bước setup gồm thông tin trường, tên miền (mặc định <mã>.<tên miền hệ thống> hoặc tên miền riêng cấu hình tay), loại dữ liệu
//   (dữ liệu thật phải đủ hồ sơ đồng ý), quản trị viên đầu tiên (đường liên kết kích hoạt một lần) và đồng ý điều khoản;
// - tiến trình khởi tạo có bước, mỗi bước kiểm tra việc đã làm trước khi làm nên chạy lại được; lỗi thì chạy tiếp từ bước dở
//   hoặc hoàn tác xóa sạch;
// - tạm dừng giữ dữ liệu, không đăng nhập (phần trung gian trả 503), không chạy việc nền (bộ lập lịch bỏ trường không phục vụ);
// - xóa vĩnh viễn sau thời gian chờ (mặc định 30 ngày, giả định): xóa cơ sở dữ liệu, vai trò, khóa, tên miền; giữ hàng của
//   trường ở trạng thái `deleted` kèm bản ghi chứng minh đã xóa; kho tệp, khóa Redis xóa qua hàm do lớp có hạ tầng truyền vào
export const SCHOOL_LIFECYCLE_RULE_CODE = 'BR-208';
export const SCHOOL_LEVEL_CODES = ['MN', 'TH', 'THCS', 'THPT'] as const;
export const CONSENT_KINDS: readonly SchoolConsentKind[] = ['dpa', 'consent', 'impact-assessment', 'risk-acceptance'];
export const DEFAULT_DELETION_GRACE_DAYS = 30;
export const ADMIN_INVITATION_HOURS = 72;
// Mã băm argon2id của một mật khẩu ngẫu nhiên đã bỏ: quản trị viên mới không đăng nhập được cho tới khi kích hoạt và tự đặt mật
// khẩu (không gửi mật khẩu qua bất kỳ kênh nào)
export const UNUSABLE_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$bJTLpKKMXw4TdToFGTIYqA$T9wOR35f12J7vI2onw5xIP7G39/19+skn3C9eytDodk';

export interface FieldProblem {
  field: string;
  message: string;
}

export class LifecycleError extends Error {
  constructor(
    message: string,
    readonly problems: FieldProblem[] = [],
    readonly code: 'validation' | 'rule' | 'not_found' = 'rule',
  ) {
    super(message);
  }
}

export interface ConsentInput {
  kind: SchoolConsentKind;
  template_code: string;
  template_version: string;
  signer_name: string;
  signer_title: string;
  signed_on: string;
  valid_from: string;
  valid_until?: string | null;
  data_scope: string;
  file_sha256: string;
  file_key?: string | null;
  file_name?: string | null;
  submitted_to_authority_on?: string | null;
  authority_reference?: string | null;
}

export interface HostingInput {
  provider: string;
  service: string;
  region: string;
  role?: 'subprocessor' | 'transit';
  stores_personal_data?: boolean;
  started_on: string;
  ended_on?: string | null;
}

export interface SchoolSetupInput {
  code: string;
  name: string;
  address?: string | null;
  levels: string[];
  // Năm học đầu, ví dụ 2026 nghĩa là 2026-2027; trống là chưa mở năm học
  first_year_start?: number | null;
  domain: { mode: 'system' } | { mode: 'custom'; host: string };
  data_class: SchoolDataClassValue;
  status?: 'trial' | 'active';
  consents?: ConsentInput[];
  hosting?: HostingInput[];
  admin: { full_name: string; login: string; phone?: string | null };
  terms: { version: string; accepted: boolean; accepted_by_name: string; accepted_by_title?: string | null };
  // Mã Bộ của đơn vị chọn từ danh mục toàn quốc (DT-24); có thì mã trường gợi ý theo mã Bộ, đăng nhập theo đơn vị tìm được trường
  moet_code?: string | null;
}

export interface LifecycleEnvironment {
  platform: Kysely<PlatformDatabase>;
  masterKey: Buffer;
  layout: SchoolDatabaseLayout;
  // Tên miền hệ thống (tên miền con mặc định của trường là <mã>.<tên miền hệ thống>)
  systemDomain: string | null;
  // Địa chỉ vào của nền tảng mà tên miền riêng trỏ CNAME tới
  ingressHost?: string | null;
  reservedCodes?: readonly string[];
  domainProvider?: DomainProvider;
  // Chính sách dữ liệu của môi trường (PLATFORM_DATA_POLICY, DT-SaaS phần S9); mặc định any
  dataPolicy?: DataPolicy;
  now?: () => Date;
}

// any: môi trường dựng của nhà phát triển, hồ sơ vận hành; consent-required (mặc định hồ sơ thử nghiệm): dữ liệu thật chỉ khi đủ
// hồ sơ đồng ý, không nhận loại `production` vì máy chủ ở ngoài Việt Nam; synthetic-only: chỉ dữ liệu giả
export type DataPolicy = 'any' | 'consent-required' | 'synthetic-only';

export function dataPolicyProblem(policy: DataPolicy | undefined, dataClass: string): string | null {
  if (policy === 'synthetic-only' && dataClass !== 'synthetic') {
    return 'Môi trường này chỉ nhận dữ liệu giả (PLATFORM_DATA_POLICY=synthetic-only)';
  }
  if (policy === 'consent-required' && dataClass === 'production') {
    return 'Môi trường thử nghiệm (máy chủ ngoài Việt Nam) không nhận loại production; dùng consented khi đủ hồ sơ đồng ý hoặc chuyển sang hồ sơ vận hành';
  }
  return null;
}

export interface Actor {
  type: PlatformAuditActorType;
  id?: string | null;
  name: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const IP_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max + 1) : '';
}

function nowOf(environment: LifecycleEnvironment): Date {
  return environment.now ? environment.now() : new Date();
}

// Hồ sơ đồng ý còn hiệu lực vào một ngày: chưa rút, đã có hiệu lực, chưa hết hạn
function consentEffective(
  consent: { valid_from: string; valid_until: string | null; withdrawn_on: string | null },
  day: string,
) {
  return consent.valid_from <= day && (!consent.valid_until || consent.valid_until >= day) && !consent.withdrawn_on;
}

export function validateConsent(consent: ConsentInput, prefix: string): FieldProblem[] {
  const problems: FieldProblem[] = [];
  if (!CONSENT_KINDS.includes(consent.kind)) {
    problems.push({ field: `${prefix}.kind`, message: 'Loại là dpa, consent, impact-assessment hoặc risk-acceptance' });
  }
  for (const field of ['template_code', 'template_version', 'signer_name', 'signer_title', 'data_scope'] as const) {
    const value = text(consent[field], 500);
    if (value === '' || value.length > 500) {
      problems.push({ field: `${prefix}.${field}`, message: 'Bắt buộc, tối đa 500 ký tự' });
    }
  }
  for (const field of ['signed_on', 'valid_from'] as const) {
    if (!DATE_PATTERN.test(String(consent[field] ?? ''))) {
      problems.push({ field: `${prefix}.${field}`, message: 'Ngày dạng YYYY-MM-DD' });
    }
  }
  if (consent.valid_until && !DATE_PATTERN.test(consent.valid_until)) {
    problems.push({ field: `${prefix}.valid_until`, message: 'Ngày dạng YYYY-MM-DD' });
  }
  if (!/^[0-9a-f]{64}$/.test(String(consent.file_sha256 ?? ''))) {
    problems.push({ field: `${prefix}.file_sha256`, message: 'Mã băm SHA-256 của bản quét (64 ký tự hexa thường)' });
  }
  return problems;
}

export function validateHosting(hosting: HostingInput, prefix: string): FieldProblem[] {
  const problems: FieldProblem[] = [];
  for (const field of ['provider', 'service', 'region'] as const) {
    const value = text(hosting[field], 200);
    if (value === '' || value.length > 200) {
      problems.push({ field: `${prefix}.${field}`, message: 'Bắt buộc, tối đa 200 ký tự' });
    }
  }
  if (!DATE_PATTERN.test(String(hosting.started_on ?? ''))) {
    problems.push({ field: `${prefix}.started_on`, message: 'Ngày dạng YYYY-MM-DD' });
  }
  if (hosting.role && hosting.role !== 'subprocessor' && hosting.role !== 'transit') {
    problems.push({ field: `${prefix}.role`, message: 'Vai trò là subprocessor hoặc transit' });
  }
  return problems;
}

// Thiếu gì để trường được dùng dữ liệu thật (`consented`): đủ bốn loại hồ sơ còn hiệu lực và ít nhất một dịch vụ ở PL-08
export function consentGaps(
  consents: Array<{ kind: string; valid_from: string; valid_until: string | null; withdrawn_on: string | null }>,
  hostingCount: number,
  day: string,
): string[] {
  const gaps = CONSENT_KINDS.filter(
    (kind) => !consents.some((consent) => consent.kind === kind && consentEffective(consent, day)),
  ).map((kind) => `Thiếu hồ sơ ${kind} còn hiệu lực`);
  if (hostingCount === 0) {
    gaps.push('Thiếu bản ghi vùng máy chủ, bên xử lý phụ (school_hosting)');
  }
  return gaps;
}

// Tên miền riêng: tên miền hợp lệ, không phải địa chỉ IP, không thuộc tên miền hệ thống
export function customDomainProblem(host: string | undefined, systemDomain: string | null): string | null {
  const normalized = normalizeHost(host);
  if (!normalized || !normalized.includes('.')) {
    return 'Tên miền không hợp lệ';
  }
  if (IP_PATTERN.test(normalized)) {
    return 'Không dùng địa chỉ IP làm tên miền';
  }
  if (systemDomain && (normalized === systemDomain || normalized.endsWith(`.${systemDomain}`))) {
    return 'Tên miền riêng không được thuộc tên miền hệ thống';
  }
  return null;
}

export function systemHostOf(code: string, systemDomain: string | null): string | null {
  return systemDomain ? `${code}.${systemDomain}` : null;
}

export function validateSetup(
  input: SchoolSetupInput,
  environment: Pick<LifecycleEnvironment, 'systemDomain' | 'reservedCodes' | 'dataPolicy'>,
): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const policyProblem = dataPolicyProblem(environment.dataPolicy, String(input.data_class ?? ''));
  if (policyProblem) {
    problems.push({ field: 'data_class', message: policyProblem });
  }
  const codeProblem = validateSchoolCode(
    String(input.code ?? ''),
    environment.reservedCodes ?? DEFAULT_RESERVED_SCHOOL_CODES,
  );
  if (codeProblem) {
    problems.push({ field: 'code', message: codeProblem });
  }
  const name = text(input.name, 200);
  if (name === '' || name.length > 200) {
    problems.push({ field: 'name', message: 'Tên trường bắt buộc, tối đa 200 ký tự' });
  }
  if (input.address && text(input.address, 500).length > 500) {
    problems.push({ field: 'address', message: 'Tối đa 500 ký tự' });
  }
  const levels = Array.isArray(input.levels) ? input.levels : [];
  if (levels.length === 0 || levels.some((level) => !SCHOOL_LEVEL_CODES.includes(level as never))) {
    problems.push({ field: 'levels', message: 'Chọn ít nhất một cấp học trong MN, TH, THCS, THPT' });
  }
  if (input.first_year_start !== undefined && input.first_year_start !== null) {
    if (!Number.isInteger(input.first_year_start) || input.first_year_start < 2020 || input.first_year_start > 2100) {
      problems.push({ field: 'first_year_start', message: 'Năm bắt đầu của năm học đầu từ 2020 đến 2100' });
    }
  }
  if (input.domain?.mode === 'system') {
    if (!environment.systemDomain) {
      problems.push({ field: 'domain', message: 'Nền tảng chưa cấu hình tên miền hệ thống; nhập tên miền riêng' });
    }
  } else if (input.domain?.mode === 'custom') {
    const problem = customDomainProblem(input.domain.host, environment.systemDomain);
    if (problem) {
      problems.push({ field: 'domain.host', message: problem });
    }
  } else {
    problems.push({ field: 'domain.mode', message: 'Tên miền là system (mặc định) hoặc custom (tên miền riêng)' });
  }
  if (!['synthetic', 'consented', 'production'].includes(input.data_class)) {
    problems.push({ field: 'data_class', message: 'Loại dữ liệu là synthetic, consented hoặc production' });
  }
  if (input.status && input.status !== 'trial' && input.status !== 'active') {
    problems.push({ field: 'status', message: 'Trạng thái ban đầu là trial hoặc active' });
  }
  (input.consents ?? []).forEach((consent, index) => problems.push(...validateConsent(consent, `consents[${index}]`)));
  (input.hosting ?? []).forEach((hosting, index) => problems.push(...validateHosting(hosting, `hosting[${index}]`)));
  if (input.data_class === 'consented') {
    const today = new Date().toISOString().slice(0, 10);
    const gaps = consentGaps(
      (input.consents ?? []).map((consent) => ({
        kind: consent.kind,
        valid_from: consent.valid_from,
        valid_until: consent.valid_until ?? null,
        withdrawn_on: null,
      })),
      (input.hosting ?? []).length,
      today,
    );
    for (const gap of gaps) {
      problems.push({ field: 'consents', message: gap });
    }
  }
  const adminName = text(input.admin?.full_name, 200);
  if (adminName === '' || adminName.length > 200) {
    problems.push({ field: 'admin.full_name', message: 'Họ tên quản trị viên bắt buộc, tối đa 200 ký tự' });
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(String(input.admin?.login ?? ''))) {
    problems.push({ field: 'admin.login', message: 'Tên đăng nhập 3 đến 50 ký tự chữ thường, số, dấu chấm, gạch' });
  }
  if (input.admin?.phone && !/^0\d{9}$/.test(input.admin.phone)) {
    problems.push({ field: 'admin.phone', message: 'Số điện thoại 10 chữ số, bắt đầu bằng 0' });
  }
  if (input.terms?.accepted !== true || text(input.terms?.version, 50) === '') {
    problems.push({ field: 'terms', message: 'Cần đồng ý điều khoản sử dụng (ghi phiên bản điều khoản)' });
  }
  if (text(input.terms?.accepted_by_name, 200) === '') {
    problems.push({ field: 'terms.accepted_by_name', message: 'Người đồng ý điều khoản bắt buộc' });
  }
  return problems;
}

async function recordEvent(
  platform: Kysely<PlatformDatabase>,
  schoolId: string,
  event: string,
  from: string | null,
  to: string | null,
  actor: Actor,
  reason: string | null = null,
): Promise<void> {
  await platform
    .insertInto('school_lifecycle_events')
    .values({
      school_id: schoolId,
      event,
      from_status: from,
      to_status: to,
      reason,
      actor_type: actor.type,
      actor_id: actor.id ?? null,
    })
    .execute();
  await writeAudit(platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: `school.${event}`,
    schoolId,
    details: { from, to, reason },
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Khởi tạo
// ---------------------------------------------------------------------------------------------------------------------

export const PROVISION_STEPS = [
  'database:identity',
  'migrate:identity',
  'database:system',
  'migrate:system',
  'database:year',
  'migrate:year',
  'seed:system',
  'seed:year',
  'admin',
  'domain',
  'plan',
  'activate',
] as const;
export type ProvisionStep = (typeof PROVISION_STEPS)[number];

// Ghi trường ở trạng thái `provisioning` (giữ mã), khóa dữ liệu trẻ, hồ sơ đồng ý, vùng máy chủ và việc khởi tạo; các bước nặng
// chạy ở runProvisioningJob
export async function startProvisioning(
  environment: LifecycleEnvironment,
  input: SchoolSetupInput,
  actor: Actor,
): Promise<{ jobId: string; schoolId: string }> {
  const problems = validateSetup(input, environment);
  if (problems.length > 0) {
    throw new LifecycleError('Thông tin khởi tạo chưa hợp lệ', problems, 'validation');
  }
  const { platform } = environment;
  const code = input.code;
  const host =
    input.domain.mode === 'system' ? systemHostOf(code, environment.systemDomain) : normalizeHost(input.domain.host);
  const existing = await platform.selectFrom('schools').select('id').where('code', '=', code).executeTakeFirst();
  if (existing) {
    throw new LifecycleError('Mã trường đã có', [{ field: 'code', message: 'Mã trường đã dùng' }], 'validation');
  }
  const takenHost = host
    ? await platform.selectFrom('school_domains').select('id').where('host', '=', host).executeTakeFirst()
    : undefined;
  if (takenHost) {
    throw new LifecycleError(
      'Tên miền đã dùng',
      [{ field: 'domain', message: 'Tên miền đã thuộc trường khác' }],
      'validation',
    );
  }
  const moetCode = typeof input.moet_code === 'string' && input.moet_code.trim() ? input.moet_code.trim() : null;
  if (moetCode) {
    const unit = await platform
      .selectFrom('catalog_units')
      .select('id')
      .where('moet_code', '=', moetCode)
      .executeTakeFirst();
    const linked = await platform
      .selectFrom('schools')
      .select('code')
      .where('moet_code', '=', moetCode)
      .where('status', '!=', 'deleted')
      .executeTakeFirst();
    if (!unit || linked) {
      throw new LifecycleError(
        'Đơn vị trong danh mục chưa hợp lệ',
        [
          {
            field: 'moet_code',
            message: unit ? `Đơn vị đã gắn với trường ${linked?.code ?? ''}` : 'Mã không có trong danh mục đơn vị',
          },
        ],
        'validation',
      );
    }
  }
  const slug = schoolSlug(code);
  return platform.transaction().execute(async (transaction) => {
    const school = await transaction
      .insertInto('schools')
      .values({
        code,
        name: input.name.trim(),
        status: 'provisioning',
        data_class: input.data_class,
        key_prefix: code,
        year_database_prefix: `s_${slug}_year_`,
        address: input.address?.trim() || null,
        school_levels: JSON.stringify(input.levels),
        first_academic_year: input.first_year_start ? `${input.first_year_start}-${input.first_year_start + 1}` : null,
        moet_code: moetCode,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await storeSchoolKeys(transaction, environment.masterKey, school.id, generateChildKeyPair());
    for (const consent of input.consents ?? []) {
      await insertConsent(transaction, school.id, consent, actor);
    }
    for (const hosting of input.hosting ?? []) {
      await insertHosting(transaction, school.id, hosting);
    }
    const job = await transaction
      .insertInto('provisioning_jobs')
      .values({
        school_id: school.id,
        school_code: code,
        kind: 'provision',
        status: 'pending',
        input: JSON.stringify({
          levels: input.levels,
          first_year_start: input.first_year_start ?? null,
          domain: input.domain.mode === 'system' ? { mode: 'system', host } : { mode: 'custom', host },
          status: input.status ?? 'trial',
          admin: {
            full_name: input.admin.full_name.trim(),
            login: input.admin.login,
            phone: input.admin.phone ?? null,
          },
          terms: {
            version: input.terms.version.trim(),
            accepted_by_name: input.terms.accepted_by_name.trim(),
            accepted_by_title: input.terms.accepted_by_title?.trim() || null,
            recorded_by: actor.name,
          },
          school_name: input.name.trim(),
          address: input.address?.trim() || null,
        }),
        actor_type: actor.type,
        actor_id: actor.id ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await writeAudit(transaction, {
      actorType: actor.type,
      ...(actor.id ? { actorId: actor.id } : {}),
      action: 'school.provision-requested',
      schoolId: school.id,
      details: { code, data_class: input.data_class, domain: host },
    });
    return { jobId: job.id, schoolId: school.id };
  });
}

// Trường tự khởi tạo từ danh mục (YCTD-314) không có quản trị viên đầu tiên, đồng ý điều khoản: quản trị nền tảng vào trường rồi
// tạo tài khoản đầu tiên; `plan_code` là gói gán ngay trước khi trường phục vụ
export interface ProvisionJobInput {
  levels: string[];
  first_year_start: number | null;
  domain: { mode: 'system' | 'custom'; host: string | null };
  status: 'trial' | 'active';
  admin: { full_name: string; login: string; phone: string | null } | null;
  terms: { version: string; accepted_by_name: string; accepted_by_title: string | null; recorded_by: string } | null;
  school_name: string;
  address: string | null;
  source?: 'setup' | 'catalog';
  plan_code?: string | null;
}

export interface ProvisionResult {
  jobId: string;
  status: 'done' | 'failed';
  error: string | null;
  // Mã kích hoạt một lần của quản trị viên đầu tiên: chỉ có ở lần chạy tạo lời mời, không lưu ở dạng rõ
  activationToken: string | null;
}

export async function schoolDescriptors(
  environment: LifecycleEnvironment,
  schoolId: string,
): Promise<DatabaseDescriptor[]> {
  const rows = await environment.platform
    .selectFrom('school_databases')
    .selectAll()
    .where('school_id', '=', schoolId)
    .where('status', '!=', 'dropped')
    .execute();
  return rows.map((row) => descriptorFromRow(row, environment.masterKey));
}

async function withDescriptor<D, T>(
  descriptor: DatabaseDescriptor,
  work: (database: Kysely<D>) => Promise<T>,
): Promise<T> {
  const database = createDatabase<D>(connectionStringOf(descriptor), { max: 1 });
  try {
    return await work(database);
  } finally {
    await database.destroy();
  }
}

export function hashActivationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Chạy các bước còn lại của một việc khởi tạo. Mỗi bước kiểm tra việc đã làm (mô tả kết nối đã đăng ký, bảng đã có dòng, tên
// miền đã có) nên gọi lại sau lỗi thì chạy tiếp từ bước dở
export async function runProvisioningJob(environment: LifecycleEnvironment, jobId: string): Promise<ProvisionResult> {
  const { platform } = environment;
  const job = await platform.selectFrom('provisioning_jobs').selectAll().where('id', '=', jobId).executeTakeFirst();
  if (!job || job.kind !== 'provision' || !job.school_id) {
    throw new LifecycleError('Không tìm thấy việc khởi tạo', [], 'not_found');
  }
  if (job.status === 'done' || job.status === 'rolled_back') {
    return { jobId, status: 'done', error: null, activationToken: null };
  }
  const schoolId = job.school_id;
  const input = job.input as unknown as ProvisionJobInput;
  const school = await platform.selectFrom('schools').selectAll().where('id', '=', schoolId).executeTakeFirstOrThrow();
  const done = new Set<string>(job.completed_steps as string[]);
  let activationToken: string | null = null;
  const yearName = input.first_year_start
    ? yearDatabaseName(school.year_database_prefix, input.first_year_start, input.first_year_start + 1)
    : null;
  const slug = schoolSlug(school.code);

  const mark = async (patch: {
    status?: 'running' | 'failed' | 'done';
    step?: string | null;
    error?: string | null;
  }) => {
    await platform
      .updateTable('provisioning_jobs')
      .set({
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.step !== undefined ? { current_step: patch.step } : {}),
        ...(patch.error !== undefined ? { error: patch.error } : {}),
        completed_steps: JSON.stringify([...done]),
        updated_at: nowOf(environment),
        ...(patch.status === 'done' || patch.status === 'failed' ? { finished_at: nowOf(environment) } : {}),
      })
      .where('id', '=', jobId)
      .execute();
  };

  const descriptorFor = async (kind: SchoolDatabaseKind, name: string) =>
    (await schoolDescriptors(environment, schoolId)).find((item) => item.kind === kind && item.name === name);

  const createDatabaseStep = async (kind: SchoolDatabaseKind, logicalName: string, physicalName: string) => {
    if (await descriptorFor(kind, logicalName)) {
      return;
    }
    // Bố cục database: một vai trò của trường cho mọi cơ sở dữ liệu, dùng lại mật khẩu đã cấp ở bước trước
    const existing = await schoolDescriptors(environment, schoolId);
    const schoolRolePassword =
      environment.layout.kind === 'database' && existing[0] ? existing[0].password : generatePassword();
    const descriptor = await environment.layout.create({
      schoolCode: school.code,
      kind,
      logicalName,
      physicalName,
      schoolRolePassword,
    });
    await registerDescriptor(platform, environment.masterKey, schoolId, descriptor);
    // Cụm máy chủ của trường theo cơ sở dữ liệu đầu tiên (giống provisionSchool)
    const cluster = await platform
      .insertInto('school_clusters')
      .values({ name: `${descriptor.host}:${descriptor.port}`, host: descriptor.host, port: descriptor.port })
      .onConflict((conflict) => conflict.column('name').doUpdateSet({ host: descriptor.host }))
      .returning('id')
      .executeTakeFirstOrThrow();
    await platform
      .updateTable('schools')
      .set({ cluster_id: cluster.id })
      .where('id', '=', schoolId)
      .where('cluster_id', 'is', null)
      .execute();
  };

  const migrateStep = async (kind: SchoolDatabaseKind, name: string) => {
    const descriptor = await descriptorFor(kind, name);
    if (!descriptor) {
      throw new Error(`Chưa có cơ sở dữ liệu ${kind} ${name}`);
    }
    const result = await migrateToLatest(kind, connectionStringOf(descriptor));
    if (result.error) {
      throw result.error;
    }
  };

  const steps: Record<ProvisionStep, () => Promise<void>> = {
    'database:identity': () => createDatabaseStep('identity', 'identity', `s_${slug}_identity`),
    'migrate:identity': () => migrateStep('identity', 'identity'),
    'database:system': () => createDatabaseStep('system', 'system', `s_${slug}_system`),
    'migrate:system': () => migrateStep('system', 'system'),
    'database:year': async () => {
      if (yearName) {
        await createDatabaseStep('school-year', yearName, yearName);
      }
    },
    'migrate:year': async () => {
      if (yearName) {
        await migrateStep('school-year', yearName);
      }
    },
    // Cấp học đã chọn, năm học đầu (mở sẵn), đồng ý điều khoản
    'seed:system': async () => {
      const descriptor = await descriptorFor('system', 'system');
      if (!descriptor) {
        throw new Error('Chưa có cơ sở dữ liệu hệ thống');
      }
      await withDescriptor<SystemDatabase, void>(descriptor, async (database) => {
        await database
          .updateTable('school_levels')
          .set({ is_enabled: sql<boolean>`code = any(${input.levels})` })
          .execute();
        const accepted = await database
          .selectFrom('terms_acceptances')
          .select('id')
          .where('source', '=', 'platform-setup')
          .executeTakeFirst();
        if (!accepted && input.terms) {
          await database
            .insertInto('terms_acceptances')
            .values({
              terms_version: input.terms.version,
              accepted_by_name: input.terms.accepted_by_name,
              accepted_by_title: input.terms.accepted_by_title,
              source: 'platform-setup',
              recorded_by: input.terms.recorded_by,
            })
            .execute();
        }
        if (input.first_year_start && yearName) {
          const name = `${input.first_year_start}-${input.first_year_start + 1}`;
          let year = await database
            .selectFrom('academic_years')
            .select('id')
            .where('name', '=', name)
            .executeTakeFirst();
          if (!year) {
            year = await database
              .insertInto('academic_years')
              .values({
                name,
                start_date: `${input.first_year_start}-09-05`,
                end_date: `${input.first_year_start + 1}-05-31`,
                status: 'open',
              })
              .returning('id')
              .executeTakeFirstOrThrow();
          }
          await database
            .insertInto('academic_year_databases')
            .values({
              academic_year_id: year.id,
              database_name: yearName,
              status: 'active',
              opened_at: nowOf(environment),
            })
            .onConflict((conflict) => conflict.column('academic_year_id').doNothing())
            .execute();
        }
      });
    },
    // Đơn vị gốc của trường ở năm học đầu
    'seed:year': async () => {
      if (!yearName) {
        return;
      }
      const descriptor = await descriptorFor('school-year', yearName);
      if (!descriptor) {
        throw new Error('Chưa có cơ sở dữ liệu năm học');
      }
      await withDescriptor<SchoolYearDatabase, void>(descriptor, async (database) => {
        const root = await database
          .selectFrom('org_units')
          .select('id')
          .where('unit_type', '=', 'truong_chinh')
          .executeTakeFirst();
        if (!root) {
          await database
            .insertInto('org_units')
            .values({
              code: 'TRUONG-CHINH',
              name: input.school_name,
              unit_type: 'truong_chinh',
              address: input.address,
            })
            .execute();
        }
      });
    },
    // Quản trị viên đầu tiên (Hiệu trưởng, toàn trường) chưa có mật khẩu dùng được; lời mời kích hoạt một lần
    admin: async () => {
      const admin = input.admin;
      if (!admin) {
        return;
      }
      const descriptor = await descriptorFor('identity', 'identity');
      if (!descriptor) {
        throw new Error('Chưa có cơ sở dữ liệu định danh');
      }
      const userId = await withDescriptor<IdentityDatabase, string>(descriptor, async (database) => {
        const existing = await database
          .selectFrom('users')
          .select('id')
          .where('username', '=', admin.login)
          .executeTakeFirst();
        if (existing) {
          return existing.id;
        }
        const role = await database
          .selectFrom('roles')
          .select('id')
          .where('code', '=', 'VT-02')
          .executeTakeFirstOrThrow();
        const user = await database
          .insertInto('users')
          .values({
            full_name: admin.full_name,
            username: admin.login,
            phone: admin.phone,
            password_hash: UNUSABLE_PASSWORD_HASH,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await database
          .insertInto('user_roles')
          .values({ user_id: user.id, role_id: role.id, org_unit_id: null })
          .execute();
        return user.id;
      });
      const invited = await platform
        .selectFrom('school_admin_invitations')
        .select('id')
        .where('school_id', '=', schoolId)
        .where('user_id', '=', userId)
        .executeTakeFirst();
      if (!invited) {
        activationToken = randomBytes(24).toString('base64url');
        await platform
          .insertInto('school_admin_invitations')
          .values({
            school_id: schoolId,
            user_id: userId,
            login: admin.login,
            full_name: admin.full_name,
            token_hash: hashActivationToken(activationToken),
            expires_at: new Date(nowOf(environment).getTime() + ADMIN_INVITATION_HOURS * 3_600_000),
          })
          .execute();
      }
    },
    // Tên miền: tên miền con hệ thống dùng ngay; tên miền riêng chờ kiểm tra DNS
    domain: async () => {
      const host = input.domain.host;
      if (!host) {
        return;
      }
      const existing = await platform
        .selectFrom('school_domains')
        .select('id')
        .where('host', '=', host)
        .executeTakeFirst();
      if (existing) {
        return;
      }
      if (input.domain.mode === 'system') {
        await platform
          .insertInto('school_domains')
          .values({ school_id: schoolId, host, kind: 'system', status: 'active', verified_at: nowOf(environment) })
          .execute();
      } else {
        await requestCustomDomain(environment, schoolId, host);
      }
    },
    // Gói gán sẵn của trường tự khởi tạo (YCTD-314): chưa có bản gán thì gán từ hôm nay, không hạn
    plan: async () => {
      if (!input.plan_code) {
        return;
      }
      const plan = await platform
        .selectFrom('plans')
        .select('id')
        .where('code', '=', input.plan_code)
        .executeTakeFirst();
      if (!plan) {
        throw new Error(`Chưa có gói dịch vụ ${input.plan_code}`);
      }
      const assigned = await platform
        .selectFrom('school_plans')
        .select('id')
        .where('school_id', '=', schoolId)
        .executeTakeFirst();
      if (!assigned) {
        await platform
          .insertInto('school_plans')
          .values({
            school_id: schoolId,
            plan_id: plan.id,
            effective_from: vietnamDate(nowOf(environment)),
            note: 'Gán khi tự khởi tạo từ danh mục',
          })
          .execute();
      }
    },
    activate: async () => {
      // Trường dùng thử có hạn dùng thử theo cấu hình gói dịch vụ (S5a, BR-208) nếu chưa đặt
      const trialEndsOn =
        input.status === 'trial'
          ? addDays(vietnamDate(nowOf(environment)), (await readPlanLifecycleSettings(platform)).defaultTrialDays)
          : null;
      await platform
        .updateTable('schools')
        .set((expression) => ({
          status: input.status,
          updated_at: nowOf(environment),
          ...(trialEndsOn
            ? { trial_ends_on: expression.fn.coalesce('trial_ends_on', expression.val(trialEndsOn)) }
            : {}),
        }))
        .where('id', '=', schoolId)
        .where('status', '=', 'provisioning')
        .execute();
    },
  };

  await mark({ status: 'running', error: null });
  try {
    for (const step of PROVISION_STEPS) {
      if (done.has(step)) {
        continue;
      }
      await mark({ step });
      await steps[step]();
      done.add(step);
      await mark({ step });
    }
    await mark({ status: 'done', step: null });
    await recordEvent(platform, schoolId, 'provisioned', 'provisioning', input.status, {
      type: job.actor_type,
      id: job.actor_id,
      name: input.terms?.recorded_by ?? 'Khởi tạo tự động',
    });
    return { jobId, status: 'done', error: null, activationToken };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await mark({ status: 'failed', error: message.slice(0, 2000) });
    return { jobId, status: 'failed', error: message, activationToken };
  }
}

// Hoàn tác một việc khởi tạo lỗi: xóa mọi cơ sở dữ liệu, vai trò, rồi xóa hẳn hàng của trường (chưa từng phục vụ)
export async function rollbackProvisioningJob(
  environment: LifecycleEnvironment,
  jobId: string,
  actor: Actor,
): Promise<void> {
  const { platform } = environment;
  const job = await platform.selectFrom('provisioning_jobs').selectAll().where('id', '=', jobId).executeTakeFirst();
  if (!job || job.kind !== 'provision') {
    throw new LifecycleError('Không tìm thấy việc khởi tạo', [], 'not_found');
  }
  if (job.status === 'done') {
    throw new LifecycleError('Việc khởi tạo đã xong; dùng yêu cầu xóa trường thay cho hoàn tác');
  }
  if (job.school_id) {
    await dropSchoolResources(environment, job.school_id, job.school_code);
    await platform.deleteFrom('schools').where('id', '=', job.school_id).execute();
  }
  await platform
    .updateTable('provisioning_jobs')
    .set({ status: 'rolled_back', finished_at: nowOf(environment), updated_at: nowOf(environment) })
    .where('id', '=', jobId)
    .execute();
  await writeAudit(platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'school.provision-rolled-back',
    details: { code: job.school_code, job_id: jobId },
  });
}

async function dropSchoolResources(
  environment: LifecycleEnvironment,
  schoolId: string,
  code: string,
): Promise<string[]> {
  const descriptors = await schoolDescriptors(environment, schoolId);
  for (const descriptor of descriptors) {
    await environment.layout.drop(descriptor);
  }
  await environment.layout.dropSchoolRole(code);
  await environment.platform.deleteFrom('school_databases').where('school_id', '=', schoolId).execute();
  return descriptors.map((descriptor) => `${descriptor.kind}:${descriptor.name}`);
}

// ---------------------------------------------------------------------------------------------------------------------
// Vòng đời
// ---------------------------------------------------------------------------------------------------------------------

async function loadSchool(platform: Kysely<PlatformDatabase>, code: string) {
  const school = await platform.selectFrom('schools').selectAll().where('code', '=', code).executeTakeFirst();
  if (!school) {
    throw new LifecycleError('Không tìm thấy trường', [], 'not_found');
  }
  return school;
}

async function changeStatus(
  environment: LifecycleEnvironment,
  code: string,
  allowed: SchoolStatusValue[],
  to: SchoolStatusValue,
  event: string,
  actor: Actor,
  reason: string | null,
  extra: Record<string, unknown> = {},
) {
  const school = await loadSchool(environment.platform, code);
  if (!allowed.includes(school.status)) {
    throw new LifecycleError(`Trường đang ở trạng thái ${school.status}, không ${event} được`);
  }
  await environment.platform
    .updateTable('schools')
    .set({ status: to, updated_at: nowOf(environment), ...extra })
    .where('id', '=', school.id)
    .execute();
  await recordEvent(environment.platform, school.id, event, school.status, to, actor, reason);
  return { ...school, status: to };
}

// Tạm dừng: giữ dữ liệu; phần trung gian trả 503 với mọi yêu cầu của trường, bộ lập lịch bỏ qua trường
export function suspendSchool(environment: LifecycleEnvironment, code: string, actor: Actor, reason: string | null) {
  return changeStatus(environment, code, ['trial', 'active', 'read_only'], 'suspended', 'suspended', actor, reason, {
    suspended_at: nowOf(environment),
  });
}

// Mở lại về trạng thái hoạt động
export function resumeSchool(environment: LifecycleEnvironment, code: string, actor: Actor, reason: string | null) {
  return changeStatus(environment, code, ['suspended'], 'active', 'resumed', actor, reason, { suspended_at: null });
}

// Yêu cầu xóa: trường ngừng phục vụ như tạm dừng; xóa vĩnh viễn khi quá hạn chờ, hủy được trước hạn
export function requestDeletion(
  environment: LifecycleEnvironment,
  code: string,
  actor: Actor,
  reason: string | null,
  graceDays = DEFAULT_DELETION_GRACE_DAYS,
) {
  const now = nowOf(environment);
  return changeStatus(
    environment,
    code,
    ['trial', 'active', 'read_only', 'suspended'],
    'pending_deletion',
    'deletion-requested',
    actor,
    reason,
    {
      deletion_requested_at: now,
      delete_after: new Date(now.getTime() + graceDays * 86_400_000),
    },
  );
}

export function cancelDeletion(environment: LifecycleEnvironment, code: string, actor: Actor, reason: string | null) {
  return changeStatus(environment, code, ['pending_deletion'], 'suspended', 'deletion-cancelled', actor, reason, {
    deletion_requested_at: null,
    delete_after: null,
    suspended_at: nowOf(environment),
  });
}

export interface PurgeHooks {
  // Xóa tệp của trường ở kho tệp (lớp có kho tệp truyền vào); trả số tệp đã xóa. Khóa Redis của trường đều có hạn sống tối
  // đa 2 giờ nên tự hết, không cần xóa
  purgeStorage?: (keyPrefix: string) => Promise<number>;
}

// Xóa vĩnh viễn một trường đã quá hạn chờ: cơ sở dữ liệu, vai trò, khóa, tên miền, lời mời; giữ hàng của trường ở `deleted`
// kèm bản ghi chứng minh đã xóa. Trường số 1 (nhận từ bản đang chạy) không xóa được bằng lệnh này
export async function purgeSchool(
  environment: LifecycleEnvironment,
  code: string,
  actor: Actor,
  hooks: PurgeHooks = {},
  options: { ignoreGracePeriod?: boolean } = {},
): Promise<Record<string, unknown>> {
  const { platform } = environment;
  const school = await loadSchool(platform, code);
  if (school.legacy) {
    throw new LifecycleError('Trường nhận từ bản đang chạy không xóa bằng lệnh này');
  }
  if (school.status !== 'pending_deletion') {
    throw new LifecycleError('Chỉ xóa vĩnh viễn trường đã yêu cầu xóa');
  }
  const now = nowOf(environment);
  if (!options.ignoreGracePeriod && school.delete_after && school.delete_after.getTime() > now.getTime()) {
    throw new LifecycleError(`Chưa hết thời gian chờ xóa (đến ${school.delete_after.toISOString()})`);
  }
  const job = await platform
    .insertInto('provisioning_jobs')
    .values({
      school_id: school.id,
      school_code: code,
      kind: 'purge',
      status: 'running',
      actor_type: actor.type,
      actor_id: actor.id ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  try {
    const databases = await dropSchoolResources(environment, school.id, code);
    // Gỡ tên miền riêng khỏi nhà cung cấp tên miền (Cloudflare for SaaS, Vercel) trước khi xóa danh sách của nền tảng
    const customDomains = await platform
      .selectFrom('school_domains')
      .select(['host', 'provider'])
      .where('school_id', '=', school.id)
      .where('kind', '=', 'custom')
      .execute();
    for (const domain of customDomains) {
      if (environment.domainProvider && environment.domainProvider.kind === domain.provider) {
        await environment.domainProvider.remove(domain.host);
      }
    }
    const files = hooks.purgeStorage ? await hooks.purgeStorage(school.key_prefix) : null;
    const record = {
      code,
      name_sha256: createHash('sha256').update(school.name).digest('hex'),
      deleted_at: now.toISOString(),
      deleted_by: actor.name,
      requested_at: school.deletion_requested_at?.toISOString() ?? null,
      databases,
      files_deleted: files,
      note: 'Bản sao lưu của trường xóa theo thời hạn lưu (S7b) và hợp đồng; khóa Redis của trường tự hết hạn sau tối đa 2 giờ',
    };
    await platform.transaction().execute(async (transaction) => {
      for (const table of ['school_keys', 'school_domains', 'school_admin_invitations', 'school_migrations'] as const) {
        await transaction.deleteFrom(table).where('school_id', '=', school.id).execute();
      }
      await transaction
        .updateTable('schools')
        .set({ status: 'deleted', deleted_at: now, deletion_record: JSON.stringify(record), updated_at: now })
        .where('id', '=', school.id)
        .execute();
      await transaction
        .updateTable('provisioning_jobs')
        .set({ status: 'done', finished_at: now, updated_at: now, completed_steps: JSON.stringify(['purge']) })
        .where('id', '=', job.id)
        .execute();
    });
    await recordEvent(platform, school.id, 'deleted', 'pending_deletion', 'deleted', actor, null);
    return record;
  } catch (error) {
    await platform
      .updateTable('provisioning_jobs')
      .set({
        status: 'failed',
        error: String(error instanceof Error ? error.message : error).slice(0, 2000),
        finished_at: now,
      })
      .where('id', '=', job.id)
      .execute();
    throw error;
  }
}

// Mã các trường đã quá hạn chờ xóa
export async function dueDeletions(environment: LifecycleEnvironment): Promise<string[]> {
  const rows = await environment.platform
    .selectFrom('schools')
    .select('code')
    .where('status', '=', 'pending_deletion')
    .where('delete_after', '<=', nowOf(environment))
    .where('legacy', '=', false)
    .execute();
  return rows.map((row) => row.code);
}

// ---------------------------------------------------------------------------------------------------------------------
// Tên miền riêng
// ---------------------------------------------------------------------------------------------------------------------

export async function requestCustomDomain(environment: LifecycleEnvironment, schoolId: string, rawHost: string) {
  const problem = customDomainProblem(rawHost, environment.systemDomain);
  if (problem) {
    throw new LifecycleError(problem, [{ field: 'host', message: problem }], 'validation');
  }
  const host = normalizeHost(rawHost) as string;
  const taken = await environment.platform
    .selectFrom('school_domains')
    .select('school_id')
    .where('host', '=', host)
    .executeTakeFirst();
  if (taken) {
    throw new LifecycleError(
      'Tên miền đã dùng',
      [{ field: 'host', message: 'Tên miền đã thuộc một trường' }],
      'validation',
    );
  }
  const provider = environment.domainProvider ?? createDomainProvider('dns-check');
  const request = await provider.request(host, environment.ingressHost ?? null);
  return environment.platform
    .insertInto('school_domains')
    .values({
      school_id: schoolId,
      host,
      kind: 'custom',
      status: 'pending',
      provider: provider.kind,
      verification_token: request.verificationToken,
      cname_target: request.cnameTarget,
    })
    .returning(['id', 'host', 'status', 'verification_token', 'cname_target'])
    .executeTakeFirstOrThrow();
}

// Kiểm tra một tên miền riêng đang chờ; đạt thì chuyển `active` (Caddy cấp chứng chỉ khi có truy cập đầu tiên)
export async function verifyCustomDomain(environment: LifecycleEnvironment, host: string, actor: Actor) {
  const { platform } = environment;
  const row = await platform.selectFrom('school_domains').selectAll().where('host', '=', host).executeTakeFirst();
  if (!row || row.kind !== 'custom') {
    throw new LifecycleError('Không tìm thấy tên miền riêng', [], 'not_found');
  }
  const provider =
    environment.domainProvider ?? createDomainProvider(row.provider === 'system' ? 'dns-check' : row.provider);
  const result = await provider.status(host, {
    verificationToken: row.verification_token,
    cnameTarget: row.cname_target,
  });
  const now = nowOf(environment);
  await platform
    .updateTable('school_domains')
    .set({
      status: result.verified ? 'active' : row.status === 'active' ? 'active' : 'pending',
      verified_at: result.verified ? now : row.verified_at,
      last_checked_at: now,
      check_error: result.verified ? null : result.problems.join('; ').slice(0, 1000),
      updated_at: now,
    })
    .where('id', '=', row.id)
    .execute();
  if (result.verified && row.status !== 'active') {
    await writeAudit(platform, {
      actorType: actor.type,
      ...(actor.id ? { actorId: actor.id } : {}),
      action: 'school.domain-activated',
      schoolId: row.school_id,
      details: { host },
    });
  }
  return { host, verified: result.verified, problems: result.problems };
}

// ---------------------------------------------------------------------------------------------------------------------
// Hồ sơ đồng ý, vùng máy chủ
// ---------------------------------------------------------------------------------------------------------------------

async function insertConsent(
  platform: Kysely<PlatformDatabase>,
  schoolId: string,
  consent: ConsentInput,
  actor: Actor,
) {
  await platform
    .insertInto('school_consents')
    .values({
      school_id: schoolId,
      kind: consent.kind,
      template_code: consent.template_code.trim(),
      template_version: consent.template_version.trim(),
      signer_name: consent.signer_name.trim(),
      signer_title: consent.signer_title.trim(),
      signed_on: consent.signed_on,
      valid_from: consent.valid_from,
      valid_until: consent.valid_until ?? null,
      data_scope: consent.data_scope.trim(),
      file_sha256: consent.file_sha256,
      file_key: consent.file_key ?? null,
      file_name: consent.file_name ?? null,
      submitted_to_authority_on: consent.submitted_to_authority_on ?? null,
      authority_reference: consent.authority_reference ?? null,
      recorded_by: actor.type === 'operator' ? (actor.id ?? null) : null,
      recorded_by_name: actor.name,
      hosting_snapshot: JSON.stringify(
        await platform
          .selectFrom('school_hosting')
          .select(['provider', 'service', 'region', 'role'])
          .where('school_id', '=', schoolId)
          .where('ended_on', 'is', null)
          .execute(),
      ),
    })
    .execute();
}

async function insertHosting(platform: Kysely<PlatformDatabase>, schoolId: string, hosting: HostingInput) {
  await platform
    .insertInto('school_hosting')
    .values({
      school_id: schoolId,
      provider: hosting.provider.trim(),
      service: hosting.service.trim(),
      region: hosting.region.trim(),
      role: hosting.role ?? 'subprocessor',
      stores_personal_data: hosting.stores_personal_data ?? true,
      started_on: hosting.started_on,
      ended_on: hosting.ended_on ?? null,
    })
    .execute();
}

export async function addConsent(environment: LifecycleEnvironment, code: string, consent: ConsentInput, actor: Actor) {
  const problems = validateConsent(consent, 'consent');
  if (problems.length > 0) {
    throw new LifecycleError('Hồ sơ đồng ý chưa hợp lệ', problems, 'validation');
  }
  const school = await loadSchool(environment.platform, code);
  await insertConsent(environment.platform, school.id, consent, actor);
  await writeAudit(environment.platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'school.consent-recorded',
    schoolId: school.id,
    details: { kind: consent.kind, template: consent.template_code, sha256: consent.file_sha256 },
  });
}

export async function addHosting(environment: LifecycleEnvironment, code: string, hosting: HostingInput, actor: Actor) {
  const problems = validateHosting(hosting, 'hosting');
  if (problems.length > 0) {
    throw new LifecycleError('Bản ghi vùng máy chủ chưa hợp lệ', problems, 'validation');
  }
  const school = await loadSchool(environment.platform, code);
  await insertHosting(environment.platform, school.id, hosting);
  await writeAudit(environment.platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'school.hosting-recorded',
    schoolId: school.id,
    details: { provider: hosting.provider, service: hosting.service, region: hosting.region },
  });
}

// Đổi loại dữ liệu; sang `consented` phải qua cùng cổng hồ sơ đồng ý như bước setup
export async function changeDataClass(
  environment: LifecycleEnvironment,
  code: string,
  dataClass: SchoolDataClassValue,
  actor: Actor,
) {
  const { platform } = environment;
  const school = await loadSchool(platform, code);
  const policyProblem = dataPolicyProblem(environment.dataPolicy, dataClass);
  if (policyProblem) {
    throw new LifecycleError(policyProblem, [{ field: 'data_class', message: policyProblem }]);
  }
  if (dataClass === 'consented') {
    const consents = await platform
      .selectFrom('school_consents')
      .select(['kind', 'valid_from', 'valid_until', 'withdrawn_on'])
      .where('school_id', '=', school.id)
      .execute();
    const hosting = await platform
      .selectFrom('school_hosting')
      .select('id')
      .where('school_id', '=', school.id)
      .where('ended_on', 'is', null)
      .execute();
    const gaps = consentGaps(
      consents.map((row) => ({
        kind: row.kind,
        valid_from: String(row.valid_from).slice(0, 10),
        valid_until: row.valid_until ? String(row.valid_until).slice(0, 10) : null,
        withdrawn_on: row.withdrawn_on ? String(row.withdrawn_on).slice(0, 10) : null,
      })),
      hosting.length,
      nowOf(environment).toISOString().slice(0, 10),
    );
    if (gaps.length > 0) {
      throw new LifecycleError(
        'Chưa đủ hồ sơ đồng ý để dùng dữ liệu thật',
        gaps.map((message) => ({ field: 'consents', message })),
      );
    }
  }
  await platform
    .updateTable('schools')
    .set({ data_class: dataClass, updated_at: nowOf(environment) })
    .where('id', '=', school.id)
    .execute();
  await recordEvent(platform, school.id, 'data-class-changed', school.data_class, dataClass, actor, null);
}

// ---------------------------------------------------------------------------------------------------------------------
// Kích hoạt quản trị viên đầu tiên
// ---------------------------------------------------------------------------------------------------------------------

// Đọc lời mời còn hiệu lực của trường theo mã kích hoạt (chưa dùng, chưa hết hạn)
export async function findInvitation(platform: Kysely<PlatformDatabase>, schoolId: string, token: string, now: Date) {
  const row = await platform
    .selectFrom('school_admin_invitations')
    .selectAll()
    .where('token_hash', '=', hashActivationToken(token))
    .where('school_id', '=', schoolId)
    .executeTakeFirst();
  if (!row || row.used_at || row.expires_at.getTime() <= now.getTime()) {
    return null;
  }
  return row;
}

// Đánh dấu lời mời đã dùng; trả false nếu đã có người dùng trước (hai yêu cầu cùng lúc)
export async function markInvitationUsed(platform: Kysely<PlatformDatabase>, id: string, now: Date): Promise<boolean> {
  const result = await platform
    .updateTable('school_admin_invitations')
    .set({ used_at: now })
    .where('id', '=', id)
    .where('used_at', 'is', null)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) === 1;
}

// Cấp lại lời mời (hết hạn hoặc thất lạc): hủy lời mời cũ chưa dùng, trả mã mới
export async function reissueInvitation(
  environment: LifecycleEnvironment,
  code: string,
  actor: Actor,
): Promise<string> {
  const { platform } = environment;
  const school = await loadSchool(platform, code);
  const latest = await platform
    .selectFrom('school_admin_invitations')
    .selectAll()
    .where('school_id', '=', school.id)
    .orderBy('created_at', 'desc')
    .executeTakeFirst();
  if (!latest) {
    throw new LifecycleError('Trường chưa có quản trị viên đầu tiên', [], 'not_found');
  }
  if (latest.used_at) {
    throw new LifecycleError('Quản trị viên đã kích hoạt; dùng quên mật khẩu của trường');
  }
  const token = randomBytes(24).toString('base64url');
  await platform.transaction().execute(async (transaction) => {
    await transaction
      .deleteFrom('school_admin_invitations')
      .where('school_id', '=', school.id)
      .where('used_at', 'is', null)
      .execute();
    await transaction
      .insertInto('school_admin_invitations')
      .values({
        school_id: school.id,
        user_id: latest.user_id,
        login: latest.login,
        full_name: latest.full_name,
        token_hash: hashActivationToken(token),
        expires_at: new Date(nowOf(environment).getTime() + ADMIN_INVITATION_HOURS * 3_600_000),
      })
      .execute();
  });
  await writeAudit(platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'school.admin-invitation-reissued',
    schoolId: school.id,
    details: { login: latest.login },
  });
  return token;
}

// ---------------------------------------------------------------------------------------------------------------------
// Migrate cuốn chiếu
// ---------------------------------------------------------------------------------------------------------------------

export interface RollingMigrationOptions {
  canaryCode?: string | null;
  continueOnError?: boolean;
  onProgress?: (line: string) => void;
}

export interface RollingMigrationResult {
  waveId: string;
  schools: number;
  failed: Array<{ code: string; database: string; error: string }>;
  stopped: boolean;
}

// Chạy migrate lần lượt từng trường đang có dữ liệu (không gồm đang khởi tạo, đã xóa): định danh, hệ thống, mọi năm học còn
// ghi được. Trường canary chạy đầu; lỗi thì dừng làn sóng trừ khi có continueOnError
export async function migrateSchools(
  environment: LifecycleEnvironment,
  options: RollingMigrationOptions = {},
): Promise<RollingMigrationResult> {
  const { platform } = environment;
  const waveId = (await sql<{ id: string }>`select gen_random_uuid() as id`.execute(platform)).rows[0]?.id as string;
  const schools = await platform
    .selectFrom('schools')
    .select(['id', 'code'])
    .where('status', 'not in', ['provisioning', 'deleted'])
    .orderBy('code')
    .execute();
  const ordered = options.canaryCode
    ? [
        ...schools.filter((school) => school.code === options.canaryCode),
        ...schools.filter((school) => school.code !== options.canaryCode),
      ]
    : schools;
  const result: RollingMigrationResult = { waveId, schools: 0, failed: [], stopped: false };
  for (const school of ordered) {
    const canary = school.code === options.canaryCode;
    const descriptors = (await schoolDescriptors(environment, school.id)).sort(
      (left, right) =>
        ['identity', 'system', 'school-year'].indexOf(left.kind) -
        ['identity', 'system', 'school-year'].indexOf(right.kind),
    );
    const readOnly = new Set(
      (
        await platform
          .selectFrom('school_databases')
          .select(['kind', 'name'])
          .where('school_id', '=', school.id)
          .where('status', '=', 'read_only')
          .execute()
      ).map((row) => `${row.kind}:${row.name}`),
    );
    result.schools += 1;
    for (const descriptor of descriptors) {
      if (readOnly.has(`${descriptor.kind}:${descriptor.name}`)) {
        await platform
          .insertInto('school_migrations')
          .values({
            school_id: school.id,
            wave_id: waveId,
            database_kind: descriptor.kind,
            database_name: descriptor.name,
            status: 'skipped',
            canary,
          })
          .execute();
        continue;
      }
      const migration = await migrateToLatest(descriptor.kind, connectionStringOf(descriptor));
      const applied = (migration.results ?? [])
        .filter((item) => item.status === 'Success')
        .map((item) => item.migrationName);
      const error = migration.error
        ? String(migration.error instanceof Error ? migration.error.message : migration.error)
        : null;
      await platform
        .insertInto('school_migrations')
        .values({
          school_id: school.id,
          wave_id: waveId,
          database_kind: descriptor.kind,
          database_name: descriptor.name,
          status: error ? 'failed' : 'done',
          applied: JSON.stringify(applied),
          error,
          canary,
        })
        .execute();
      options.onProgress?.(
        `${school.code} ${descriptor.kind}:${descriptor.name} ${error ? `LỖI ${error}` : `${applied.length} tệp`}`,
      );
      if (error) {
        result.failed.push({ code: school.code, database: `${descriptor.kind}:${descriptor.name}`, error });
        if (!options.continueOnError) {
          result.stopped = true;
          return result;
        }
      }
    }
  }
  return result;
}
