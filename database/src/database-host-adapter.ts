// Bộ nối nơi đặt PostgreSQL của trường (DT-SaaS phần S9, YCTD-203; tài liệu 32 mục 14.4), chọn bằng DB_HOST_ADAPTER của nền tảng.
// Bộ nối chỉ quyết định địa chỉ kết nối ghi vào `school_databases` (máy chủ, cổng, tên đăng nhập) và vài lệnh tạo vai trò; mã
// nghiệp vụ và `Databases` không biết nhà cung cấp:
// - plain: máy chủ tự dựng (VPS, PgBouncer); địa chỉ lấy từ PLATFORM_ADMIN_DATABASE_URL hoặc DB_POOLER_HOST, DB_POOLER_PORT;
// - neon: kết nối qua bộ gom của Neon (PgBouncer, chế độ theo giao dịch), máy chủ có hậu tố `-pooler` sau mã điểm cuối; vai
//   trò tạo bằng SQL như máy chủ tự dựng;
// - supabase: kết nối qua bộ gom dùng chung (Supavisor, cổng 6543, chế độ theo giao dịch), tên đăng nhập `<vai trò>.<mã dự
//   án>`; không thu hồi quyền kết nối mặc định vào cơ sở dữ liệu `postgres` vì dịch vụ của Supabase dùng chung cơ sở dữ liệu đó.
// Bộ gom chế độ theo giao dịch không giữ lệnh SET giữa hai giao dịch: múi giờ và search_path đã đặt ở mức vai trò (S1a), tệp thay
// đổi cấu trúc khóa bằng pg_advisory_xact_lock trong giao dịch, thư viện pg dùng câu lệnh chuẩn bị không tên, nên chạy được
export type DatabaseHostAdapterKind = 'plain' | 'neon' | 'supabase';

export interface DatabaseHostOptions {
  adapter: DatabaseHostAdapterKind;
  poolerHost: string | null;
  poolerPort: number | null;
  // Mã dự án Supabase (phần đầu tên máy chủ `db.<mã>.supabase.co`)
  projectRef: string | null;
}

export interface DatabaseHostSettings {
  host: string;
  port: number;
  loginSuffix?: string;
  revokePublicConnect: boolean;
}

export const DEFAULT_DATABASE_HOST: DatabaseHostOptions = {
  adapter: 'plain',
  poolerHost: null,
  poolerPort: null,
  projectRef: null,
};

// Máy chủ gom kết nối của Neon: `ep-abc-123.ap-southeast-1.aws.neon.tech` thành `ep-abc-123-pooler.ap-southeast-1.aws.neon.tech`
export function neonPoolerHost(host: string): string {
  const [endpoint, ...rest] = host.split('.');
  if (!endpoint || rest.length === 0 || endpoint.endsWith('-pooler')) {
    return host;
  }
  return [`${endpoint}-pooler`, ...rest].join('.');
}

// Mã dự án Supabase từ máy chủ trực tiếp `db.<mã>.supabase.co`
export function supabaseProjectRef(host: string): string | null {
  const match = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(host);
  return match?.[1] ?? null;
}

export function readDatabaseHostOptions(values: Record<string, string | undefined>): DatabaseHostOptions {
  const adapter = (values.DB_HOST_ADAPTER?.trim() || 'plain') as DatabaseHostAdapterKind;
  if (!['plain', 'neon', 'supabase'].includes(adapter)) {
    throw new Error('DB_HOST_ADAPTER chỉ nhận plain, neon hoặc supabase');
  }
  const port = values.DB_POOLER_PORT?.trim();
  if (port && !/^\d{2,5}$/.test(port)) {
    throw new Error('DB_POOLER_PORT phải là số cổng');
  }
  return {
    adapter,
    poolerHost: values.DB_POOLER_HOST?.trim() || null,
    poolerPort: port ? Number(port) : null,
    projectRef: values.SUPABASE_PROJECT_REF?.trim() || null,
  };
}

export function databaseHostSettings(options: DatabaseHostOptions, adminUrl: string): DatabaseHostSettings {
  const url = new URL(adminUrl);
  const adminHost = url.hostname;
  const adminPort = url.port ? Number(url.port) : 5432;
  if (options.adapter === 'neon') {
    return {
      host: options.poolerHost ?? neonPoolerHost(adminHost),
      port: options.poolerPort ?? 5432,
      revokePublicConnect: true,
    };
  }
  if (options.adapter === 'supabase') {
    const projectRef = options.projectRef ?? supabaseProjectRef(adminHost);
    if (!options.poolerHost || !projectRef) {
      throw new Error(
        'DB_HOST_ADAPTER=supabase cần DB_POOLER_HOST (máy chủ gom kết nối, chép ở hộp Connect của Supabase) và SUPABASE_PROJECT_REF',
      );
    }
    return {
      host: options.poolerHost,
      port: options.poolerPort ?? 6543,
      loginSuffix: `.${projectRef}`,
      revokePublicConnect: false,
    };
  }
  return {
    host: options.poolerHost ?? adminHost,
    port: options.poolerPort ?? adminPort,
    revokePublicConnect: true,
  };
}
