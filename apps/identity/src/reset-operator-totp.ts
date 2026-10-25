import {
  createDatabase,
  readConnectionString,
  readMasterKey,
  type PlatformDatabase,
} from '@school-management/database';
import { enrollOperatorTotp } from './platform/platform-operators.js';

// Cấp lại khóa xác thực hai lớp cho tài khoản vận hành nền tảng mất điện thoại hoặc chưa đăng ký (DT-SaaS phần S8b): khóa và mã khôi phục cũ mất
// hiệu lực, in khóa mới và mã khôi phục mới một lần duy nhất. Dùng: reset-operator-totp <tên đăng nhập>; cần PLATFORM_DATABASE_URL và PLATFORM_MASTER_KEY
const login = process.argv[2]?.trim().toLowerCase();
if (!login) {
  console.error('Dùng: reset-operator-totp <tên đăng nhập>');
  process.exit(1);
}
const database = createDatabase<PlatformDatabase>(readConnectionString('platform'));
try {
  const operator = await database
    .selectFrom('platform_operators')
    .select('id')
    .where('login', '=', login)
    .executeTakeFirst();
  if (!operator) {
    throw new Error(`Không có tài khoản vận hành ${login}`);
  }
  const result = await enrollOperatorTotp(database, readMasterKey(process.env), operator.id, login);
  console.log(`Đã cấp lại khóa xác thực hai lớp cho ${login}`);
  console.log(`Khóa (nhập vào ứng dụng xác thực): ${result.secret}`);
  console.log(`Hoặc quét địa chỉ: ${result.otpauthUri}`);
  console.log(`Mã khôi phục (chỉ hiện một lần, mỗi mã dùng một lần): ${result.recoveryCodes.join(' ')}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await database.destroy();
}
