import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';

type YearDatabase = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

// Học sinh của người gọi ở kênh student: tài khoản học nối với một học sinh (DT-23 phần 23a). Chế độ xem của nhân viên hỗ trợ
// (YCTD-315b): phiên Admin vào thẳng chọn một học sinh để xem (CurrentUser.supportViewChildId), thay cho học sinh của tài khoản; phiên
// này luôn chỉ đọc nên không nộp bài, không làm bài thi thay học sinh. Trả hồ sơ học sinh hoặc undefined khi không có
export async function studentChildOf(
  database: YearDatabase,
  currentUser: CurrentUser,
): Promise<{ id: string; status: string; deleted_at: Date | null } | undefined> {
  if (currentUser.supportViewChildId) {
    return database
      .selectFrom('children')
      .select(['id', 'status', 'deleted_at'])
      .where('id', '=', currentUser.supportViewChildId)
      .executeTakeFirst();
  }
  return database
    .selectFrom('student_learning_accounts')
    .innerJoin('children', 'children.id', 'student_learning_accounts.child_id')
    .select(['children.id', 'children.status', 'children.deleted_at'])
    .where('student_learning_accounts.identity_user_id', '=', currentUser.id)
    .executeTakeFirst();
}
