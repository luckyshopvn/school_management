import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import {
  createDatabase,
  readConnectionString,
  readMasterKey,
  type PlatformDatabase,
} from '@school-management/database';
import { createPlatformOperatorWithTotp } from './platform/platform-operators.js';

// Tạo tài khoản vận hành nền tảng ở cơ sở dữ liệu nền tảng (DT-SaaS phần S1a); không thuộc trường nào. Từ phần S8b kèm xác thực hai lớp bắt buộc:
// in khóa TOTP, địa chỉ cho ứng dụng xác thực và mã khôi phục một lần duy nhất; cần PLATFORM_MASTER_KEY để mã hóa khóa TOTP

let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) {
      stdout.write(chunk, encoding as BufferEncoding);
    }
    callback();
  },
});
const reader = createInterface({ input: stdin, output, terminal: true });

async function ask(question: string): Promise<string> {
  return (await reader.question(question)).trim();
}

async function askSecret(question: string): Promise<string> {
  stdout.write(question);
  muted = true;
  const answer = await reader.question('');
  muted = false;
  stdout.write('\n');
  return answer;
}

const database = createDatabase<PlatformDatabase>(readConnectionString('platform'));
try {
  const fullName = await ask('Họ tên: ');
  const login = await ask('Tên đăng nhập: ');
  if (!fullName || !login) {
    throw new Error('Họ tên và tên đăng nhập là bắt buộc');
  }
  const password = await askSecret('Mật khẩu: ');
  if ((await askSecret('Nhập lại mật khẩu: ')) !== password) {
    throw new Error('Hai lần nhập mật khẩu không khớp');
  }
  const created = await createPlatformOperatorWithTotp(database, readMasterKey(process.env), {
    login,
    fullName,
    password,
  });
  console.log(`Đã tạo tài khoản vận hành nền tảng ${login.toLowerCase()}`);
  console.log(`Khóa xác thực hai lớp (nhập vào ứng dụng xác thực): ${created.secret}`);
  console.log(`Hoặc quét địa chỉ: ${created.otpauthUri}`);
  console.log(`Mã khôi phục (chỉ hiện một lần, mỗi mã dùng một lần): ${created.recoveryCodes.join(' ')}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  reader.close();
  await database.destroy();
}
