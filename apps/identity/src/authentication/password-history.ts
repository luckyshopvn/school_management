import type { IdentityDatabase } from '@school-management/database';
import { validationError } from '@school-management/server';
import type { Kysely, Transaction } from 'kysely';
import { verifyPassword } from './password.js';

// Không cho dùng lại mật khẩu gần đây (DT-16 phần 16c): mật khẩu mới phải khác mật khẩu hiện tại và khác các mật khẩu
// người dùng đã tự đặt trong số lần gần nhất theo cấu hình. Chỉ giữ tối đa MAXIMUM_KEPT bản ghi mỗi tài khoản
const MAXIMUM_KEPT = 24;

type Executor = Kysely<IdentityDatabase> | Transaction<IdentityDatabase>;

export async function assertPasswordNotReused(
  executor: Executor,
  user: { id: string; password_hash: string | null },
  newPassword: string,
  historyCount: number,
): Promise<void> {
  const previous = historyCount
    ? await executor
        .selectFrom('password_history')
        .select('password_hash')
        .where('user_id', '=', user.id)
        .orderBy('created_at', 'desc')
        .limit(historyCount)
        .execute()
    : [];
  const hashes = [...new Set([user.password_hash, ...previous.map((row) => row.password_hash)])];
  for (const hash of hashes) {
    if (hash !== null && (await verifyPassword(hash, newPassword))) {
      throw validationError([
        {
          field: 'new_password',
          message:
            historyCount > 0
              ? `Mật khẩu mới phải khác mật khẩu hiện tại và ${historyCount} mật khẩu gần nhất`
              : 'Mật khẩu mới phải khác mật khẩu hiện tại',
        },
      ]);
    }
  }
}

export async function recordPasswordHistory(
  executor: Executor,
  userId: string,
  passwordHash: string,
  now: Date,
): Promise<void> {
  await executor
    .insertInto('password_history')
    .values({ user_id: userId, password_hash: passwordHash, created_at: now })
    .execute();
  const kept = executor
    .selectFrom('password_history')
    .select('id')
    .where('user_id', '=', userId)
    .orderBy('created_at', 'desc')
    .limit(MAXIMUM_KEPT);
  await executor
    .deleteFrom('password_history')
    .where('user_id', '=', userId)
    .where('id', 'not in', kept)
    .execute();
}
