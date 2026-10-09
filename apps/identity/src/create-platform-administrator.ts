import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { checkPasswordPolicy, hashPassword } from './authentication/password.js';

// Tạo tài khoản đầu tiên của hệ thống với vai trò VT-01 Quản trị nền tảng (PQ-10)

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

const database = createDatabase<IdentityDatabase>(readConnectionString('identity'));
try {
  const fullName = await ask('Họ tên: ');
  const username = await ask('Tên đăng nhập: ');
  if (!fullName || !username) {
    throw new Error('Họ tên và tên đăng nhập là bắt buộc');
  }
  const existing = await database.selectFrom('users').select('id').where('username', '=', username).executeTakeFirst();
  if (existing) {
    throw new Error('Tên đăng nhập đã tồn tại');
  }
  const password = await askSecret('Mật khẩu: ');
  const policyErrors = checkPasswordPolicy('password', password);
  if (policyErrors.length > 0) {
    throw new Error(policyErrors.map((error) => error.message).join('; '));
  }
  if ((await askSecret('Nhập lại mật khẩu: ')) !== password) {
    throw new Error('Hai lần nhập mật khẩu không khớp');
  }

  await database.transaction().execute(async (transaction) => {
    const user = await transaction
      .insertInto('users')
      .values({ full_name: fullName, username, password_hash: await hashPassword(password) })
      .returning('id')
      .executeTakeFirstOrThrow();
    const role = await transaction
      .selectFrom('roles')
      .select('id')
      .where('code', '=', 'VT-01')
      .executeTakeFirstOrThrow();
    await transaction
      .insertInto('user_roles')
      .values({ user_id: user.id, role_id: role.id, org_unit_id: null })
      .execute();
  });
  console.log(`Đã tạo tài khoản quản trị nền tảng ${username}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  reader.close();
  await database.destroy();
}
