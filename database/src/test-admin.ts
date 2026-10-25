// Tài khoản quản trị PostgreSQL để dựng và gỡ cơ sở dữ liệu, vai trò của trường trong kiểm thử (DT-SaaS phần S1a). Lấy từ
// PLATFORM_ADMIN_DATABASE_URL, hoặc ghép từ PGPASSWORD (CI) hoặc POSTGRES_PASSWORD (.env phát triển); không đặt mật khẩu trong mã
export function testAdminDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.PLATFORM_ADMIN_DATABASE_URL?.trim();
  if (explicit) {
    return explicit;
  }
  const password = env.PGPASSWORD ?? env.POSTGRES_PASSWORD;
  if (!password) {
    throw new Error('Thiếu PLATFORM_ADMIN_DATABASE_URL, PGPASSWORD hoặc POSTGRES_PASSWORD cho kiểm thử nền tảng');
  }
  const user = env.POSTGRES_USER ?? 'postgres';
  let host = env.PGHOST ?? 'localhost';
  if (!env.PGHOST && env.SYSTEM_DATABASE_URL) {
    host = new URL(env.SYSTEM_DATABASE_URL).hostname;
  }
  const port = env.PGPORT ?? '5432';
  return `postgres://${user}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
}
