import { Injectable } from '@nestjs/common';
import { ruleViolationError } from '@school-management/server';
import { maskLoginIdentifier, PERMISSION_CODES, STUDENT_ROLE_CODE } from '@school-management/shared';
import { hashPassword } from '../authentication/password.js';
import { Infrastructure } from '../common/infrastructure.js';
import type { CallerContext } from './accounts.service.js';
import { writeIdentityAuditLog } from './identity-audit-log.js';
import { OrganizationDirectory } from './organization-directory.js';
import { assertPermissionAtUnit } from './permission-scope.js';

// Người dùng của kênh `student` (DT-23 phần 23a, YCTD-211, GD-105): máy chủ API gọi khi trường "Khởi tạo" hoặc "Cấp lại mật
// khẩu" ở 4.1.10 Tài khoản học và thi, bằng mã phiên của người thao tác. Mỗi tài khoản học và thi có đúng một người dùng định
// danh (khóa nối là tên đăng nhập học và thi, không trùng), vai trò VT-21 gắn đơn vị của học sinh, mật khẩu tạm phải đổi ở lần
// đăng nhập đầu. Gọi lại với cùng tên đăng nhập là cấp lại mật khẩu: mở khóa, thu hồi mọi phiên cũ. Học sinh không có số điện
// thoại nên không đăng nhập được bằng mã một lần của phụ huynh
export interface StudentAccountInput {
  username: string;
  full_name: string;
  password: string;
  org_unit_id: string;
}

export interface StudentAccountResult {
  username: string;
  user_id: string;
  created: boolean;
}

// Mỗi lần băm argon2id dùng 64 MiB (YCTD-311) nên chỉ băm song song 4 mật khẩu một lúc
const HASH_CHUNK = 4;

@Injectable()
export class StudentAccountsService {
  constructor(
    private readonly infrastructure: Infrastructure,
    private readonly organizationDirectory: OrganizationDirectory,
  ) {}

  private get database() {
    return this.infrastructure.database;
  }

  async sync(caller: CallerContext, inputs: StudentAccountInput[]): Promise<StudentAccountResult[]> {
    const assertCanManageUnit = (orgUnitId: string | null) =>
      assertPermissionAtUnit(
        this.database,
        this.organizationDirectory,
        caller,
        [PERMISSION_CODES.accountManage, PERMISSION_CODES.accountManageInUnit],
        orgUnitId,
        'Bạn không có quyền cấp tài khoản học sinh',
      );
    for (const orgUnitId of new Set(inputs.map((input) => input.org_unit_id))) {
      await assertCanManageUnit(orgUnitId);
    }
    const studentRole = await this.database
      .selectFrom('roles')
      .select('id')
      .where('code', '=', STUDENT_ROLE_CODE)
      .executeTakeFirstOrThrow();

    // Băm mật khẩu trước khi mở giao dịch để giữ giao dịch ngắn; argon2 chạy ở luồng riêng nên băm song song theo nhóm
    const hashes: string[] = [];
    for (let start = 0; start < inputs.length; start += HASH_CHUNK) {
      hashes.push(
        ...(await Promise.all(inputs.slice(start, start + HASH_CHUNK).map((item) => hashPassword(item.password)))),
      );
    }

    const results = await this.database.transaction().execute(async (transaction) => {
      const output: StudentAccountResult[] = [];
      for (const [index, input] of inputs.entries()) {
        const passwordHash = hashes[index] as string;
        const existing = await transaction
          .selectFrom('users')
          .select(['id'])
          .where('username', '=', input.username)
          .forUpdate()
          .executeTakeFirst();
        if (existing) {
          const link = await transaction
            .selectFrom('student_accounts')
            .select('user_id')
            .where('learning_username', '=', input.username)
            .executeTakeFirst();
          if (!link || link.user_id !== existing.id) {
            throw ruleViolationError(
              'YCTD-211',
              `Tên đăng nhập ${maskLoginIdentifier(input.username)} đã thuộc tài khoản khác của trường`,
            );
          }
          // Cấp lại mật khẩu, chuyển đơn vị: người gọi phải có quyền ở cả đơn vị hiện tại của học sinh (YCTD-378)
          const currentUnits = await transaction
            .selectFrom('user_roles')
            .select('org_unit_id')
            .where('user_id', '=', existing.id)
            .where('role_id', '=', studentRole.id)
            .execute();
          for (const orgUnitId of new Set(currentUnits.map((role) => role.org_unit_id))) {
            await assertCanManageUnit(orgUnitId);
          }
          await transaction
            .updateTable('users')
            .set({
              full_name: input.full_name,
              password_hash: passwordHash,
              must_change_password: true,
              status: 'active',
              failed_login_count: 0,
              locked_until: null,
              password_changed_at: new Date(),
              updated_at: new Date(),
            })
            .where('id', '=', existing.id)
            .execute();
          await transaction
            .updateTable('sessions')
            .set({ revoked_at: new Date() })
            .where('user_id', '=', existing.id)
            .where('revoked_at', 'is', null)
            .execute();
          await transaction
            .updateTable('user_roles')
            .set({ org_unit_id: input.org_unit_id, updated_at: new Date() })
            .where('user_id', '=', existing.id)
            .where('role_id', '=', studentRole.id)
            .execute();
          output.push({ username: input.username, user_id: existing.id, created: false });
          continue;
        }
        const user = await transaction
          .insertInto('users')
          .values({
            full_name: input.full_name,
            phone: null,
            username: input.username,
            password_hash: passwordHash,
            must_change_password: true,
            created_by: caller.claims.userId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('user_roles')
          .values({
            user_id: user.id,
            role_id: studentRole.id,
            org_unit_id: input.org_unit_id,
            created_by: caller.claims.userId,
          })
          .execute();
        await transaction
          .insertInto('student_accounts')
          .values({ user_id: user.id, learning_username: input.username })
          .execute();
        output.push({ username: input.username, user_id: user.id, created: true });
      }
      // Nhật ký chỉ ghi số lượng và tên đăng nhập dạng che (số định danh của học sinh, YCTD-353), không ghi mật khẩu
      await writeIdentityAuditLog(transaction, {
        actorUserId: caller.claims.userId,
        entityName: 'users',
        entityId: caller.claims.userId,
        action: 'student_accounts_sync',
        before: null,
        after: {
          count: output.length,
          created: output.filter((item) => item.created).length,
          usernames: output.map((item) => maskLoginIdentifier(item.username)).slice(0, 50),
        },
        ipAddress: caller.ipAddress,
      });
      return output;
    });
    return results;
  }
}
