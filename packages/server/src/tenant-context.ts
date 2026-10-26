import { AsyncLocalStorage } from 'node:async_hooks';

// Ngữ cảnh một trường của nền tảng nhiều trường (DT-SaaS phần S1a, tài liệu 32 mục 14). Nằm ở một tệp riêng, không phụ
// thuộc gói nào khác, để hàm đặt tên khóa (resource-names.ts) và mã nghiệp vụ dùng chung một bộ lưu ngữ cảnh

export type SchoolStatus =
  'provisioning' | 'trial' | 'active' | 'read_only' | 'suspended' | 'pending_deletion' | 'deleted';

// synthetic: dữ liệu giả; consented: dữ liệu thật đã có văn bản đồng ý (S9); production: dữ liệu thật ở hồ sơ vận hành
export type SchoolDataClass = 'synthetic' | 'consented' | 'production';

// Gói dịch vụ hiện hành của trường (DT-SaaS phần S5a): phân hệ được bật (null là mọi phân hệ) và giới hạn (null là không giới hạn)
export interface TenantPlan {
  code: string;
  name: string;
  modules: string[] | null;
  maxActiveStudents: number | null;
  maxStorageMb: number | null;
  maxSchoolLevels: number | null;
  // Hạn mức AI mỗi tháng (DT-23 phần 23d); thiếu hoặc null là không giới hạn, 0 là không dùng AI
  aiMaxRequests?: number | null;
  aiMaxTokens?: number | null;
}

export interface TenantContext {
  schoolId: string;
  // Mã trường: tên miền con, tiền tố khóa; không đổi sau khi tạo
  code: string;
  name: string;
  status: SchoolStatus;
  dataClass: SchoolDataClass;
  // Tiền tố khóa Redis, tệp và tên cơ sở dữ liệu năm học của trường; trống ở trường số 1 (bản triển khai hiện có) để khóa
  // và tên cơ sở dữ liệu hiện có còn đúng
  keyPrefix: string;
  yearDatabasePrefix: string;
  // Khóa mã hóa và khóa băm số định danh của trẻ, riêng từng trường (BM-64); chỉ có khi trường đã có khóa
  childDataEncryptionKey?: Buffer;
  childDataHashKey?: Buffer;
  // Gói hiện hành; không có là trường chưa gán gói, không giới hạn (S5a)
  plan?: TenantPlan | null;
  // Hạn dùng thử, hạn đã trả phí dạng yyyy-mm-dd (S5a)
  trialEndsOn?: string | null;
  paidUntil?: string | null;
}

export class TenantContextMissingError extends Error {
  readonly code = 'TENANT_CONTEXT_MISSING';

  constructor(what: string) {
    super(`Thiếu ngữ cảnh trường khi truy cập ${what} ở chế độ nhiều trường`);
  }
}

const storage = new AsyncLocalStorage<TenantContext>();
let multiTenantMode = false;

// Chế độ nhiều trường bật khi có PLATFORM_DATABASE_URL; chế độ một trường (mặc định) giữ nguyên hành vi hiện nay
export function setMultiTenantMode(enabled: boolean): void {
  multiTenantMode = enabled;
}

export function isMultiTenantMode(): boolean {
  return multiTenantMode;
}

export function currentTenant(): TenantContext | undefined {
  return storage.getStore();
}

// Đóng chặt khi thiếu ngữ cảnh (fail closed): ở chế độ nhiều trường thiếu ngữ cảnh là lỗi, không rơi về trường mặc định;
// ở chế độ một trường trả undefined
export function requireTenant(what: string): TenantContext | undefined {
  const tenant = storage.getStore();
  if (tenant) {
    return tenant;
  }
  if (multiTenantMode) {
    throw new TenantContextMissingError(what);
  }
  return undefined;
}

// Chạy việc (yêu cầu, việc nền) trong ngữ cảnh của một trường
export function runAsSchool<T>(tenant: TenantContext, work: () => T): T {
  return storage.run(tenant, work);
}

// Dùng ở đầu yêu cầu: các hàm xử lý sau đó (kể cả sau await) đọc cùng ngữ cảnh
export function enterSchool(tenant: TenantContext): void {
  storage.enterWith(tenant);
}
