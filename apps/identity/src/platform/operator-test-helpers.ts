import { totpCode } from '@school-management/server';

// Tính mã TOTP cho kiểm thử giao diện (gói tests không phụ thuộc trực tiếp vào gói server)
export { totpCode };
import type { PlatformDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';

// Hỗ trợ kiểm thử đăng nhập vận hành nền tảng (DT-SaaS phần S8b): mật khẩu đủ dài theo mặc định nền tảng (12 ký tự trở lên) và mã TOTP mới
export const OPERATOR_TEST_PASSWORD = 'MatKhauVanHanh2026';

// Mỗi mã chỉ dùng một lần nên trước mỗi lần đăng nhập đặt lại bước đã dùng rồi tính mã của thời điểm hiện tại; chỉ dùng trong kiểm thử
export async function operatorOtp(
  platform: Kysely<PlatformDatabase>,
  operatorId: string,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  await platform
    .updateTable('platform_operator_totp')
    .set({ last_step: null })
    .where('operator_id', '=', operatorId)
    .execute();
  return totpCode(secret, now);
}
