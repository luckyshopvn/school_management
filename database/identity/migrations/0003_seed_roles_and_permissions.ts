import { sql, type Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

// Vai trò hệ thống và quyền theo ma trận ở 08_VAI_TRO_NGUOI_DUNG.md mục 3 (PQ-09, PQ-10)

const roles: Array<{ code: string; name: string }> = [
  { code: 'VT-01', name: 'Quản trị nền tảng' },
  { code: 'VT-02', name: 'Hiệu trưởng' },
  { code: 'VT-03', name: 'Quản lý đơn vị' },
  { code: 'VT-04', name: 'Kế toán' },
  { code: 'VT-05', name: 'Kế toán trưởng' },
  { code: 'VT-06', name: 'Nhân sự' },
  { code: 'VT-07', name: 'Giáo viên chủ nhiệm' },
  { code: 'VT-08', name: 'Giáo viên bộ môn' },
  { code: 'VT-09', name: 'Nhân viên y tế' },
  { code: 'VT-10', name: 'Nhân viên bếp' },
  { code: 'VT-11', name: 'Nhân viên kho và mua hàng' },
  { code: 'VT-12', name: 'Nhân viên tuyển sinh' },
  { code: 'VT-14', name: 'Phụ huynh' },
  { code: 'VT-15', name: 'Phó Hiệu trưởng' },
  { code: 'VT-16', name: 'Thủ quỹ' },
  { code: 'VT-17', name: 'Tổ trưởng chuyên môn' },
  { code: 'VT-18', name: 'Bảo vệ' },
  { code: 'VT-19', name: 'Cán bộ quản lý cấp trên' },
  { code: 'VT-20', name: 'Kiểm toán viên' },
];

const modules: Array<{ code: string; name: string }> = [
  { code: 'P01', name: 'Nền tảng và phân quyền' },
  { code: 'P02', name: 'Trẻ, phụ huynh, lớp học' },
  { code: 'P03', name: 'Giảng dạy' },
  { code: 'P04', name: 'Điểm danh và chăm sóc' },
  { code: 'P05', name: 'Học phí và khoản thu' },
  { code: 'P06', name: 'Tài chính, quỹ, ngân hàng' },
  { code: 'P07', name: 'Nhân sự và hợp đồng' },
  { code: 'P08', name: 'Chấm công và tiền lương' },
  { code: 'P09', name: 'Công việc, kế hoạch, đánh giá' },
  { code: 'P10', name: 'Y tế học đường' },
  { code: 'P12', name: 'Bếp và dinh dưỡng' },
  { code: 'P13', name: 'Kho, tài sản, mua hàng' },
  { code: 'P14', name: 'Hoạt động, nội dung, truyền thông' },
  { code: 'P15', name: 'Tương tác và ý kiến' },
  { code: 'P16', name: 'Tuyển sinh' },
  { code: 'P17', name: 'Báo cáo và bảng điều khiển' },
  { code: 'P18', name: 'Tuyển dụng' },
  { code: 'P19', name: 'Kênh truy cập và thông báo' },
];

const actions: Array<{ code: string; name: string }> = [
  { code: 'view', name: 'Xem' },
  { code: 'edit', name: 'Tạo và sửa' },
  { code: 'approve', name: 'Phê duyệt' },
];

// Thứ tự cột như ma trận ở tài liệu 08; VT-13 đã bỏ nên bỏ qua cột của VT-13
const matrixRoleOrder = [
  'VT-02',
  'VT-15',
  'VT-03',
  'VT-04',
  'VT-05',
  'VT-06',
  'VT-07',
  'VT-08',
  'VT-09',
  'VT-10',
  'VT-11',
  'VT-12',
  'VT-13',
  'VT-14',
  'VT-16',
  'VT-17',
  'VT-18',
  'VT-19',
  'VT-20',
];

// Q toàn quyền, S tạo và sửa, D phê duyệt, X chỉ xem, "-" không truy cập; "XS" là ô "X, S", "SD" là ô "S, D", "XD" là ô "X, D"
const matrix: Record<string, string> = {
  P01: 'Q S S - - - - - - - - - - - - - - - -',
  P02: 'Q Q SD X X X S X X X X S - X - X X - -',
  P03: 'D D D - - - S S - - - - - X - D - - -',
  P04: 'X X XS X X - S X S X - - - S - X S - -',
  P05: 'D D XS Q Q - X - - - - X - X X - - - X',
  P06: 'D D X S S - - - - - - - - - S - - - X',
  P07: 'X X X X X Q X X X X X - - - - - - - -',
  P08: 'D D XD S S Q X X X X X - - - - - - - X',
  P09: 'X X S X X S S S S S S S - - S S - - -',
  P10: 'X X X X - - S - Q - - - - S - - - - -',
  P12: 'X X S X X - X - X Q X - - X - - - - -',
  P13: 'D D D X X - S - X X Q - - - - - - - -',
  P14: 'D D D - - - S S S S S S - X - S - - -',
  P15: 'X X S X X X S X X X X X - S - - - - -',
  P16: 'D D D X X X - - X - - Q - - - - - - -',
  P17: 'Q Q X X X X X X X X X X - - X X - X X',
  P18: 'D D D - - Q - - - - - X - - - - - - -',
  P19: 'Q Q S X X X S S S S S S - X X S X X X',
};

const actionsByCell: Record<string, string[]> = {
  Q: ['view', 'edit', 'approve'],
  S: ['view', 'edit'],
  D: ['view', 'approve'],
  X: ['view'],
  XS: ['view', 'edit'],
  SD: ['view', 'edit', 'approve'],
  XD: ['view', 'approve'],
  '-': [],
};

export const ACCOUNT_MANAGE_PERMISSION = 'P01.account.manage';

export function buildRolePermissionCodes(): Map<string, string[]> {
  const result = new Map<string, string[]>(roles.map((role) => [role.code, []]));
  for (const [moduleCode, row] of Object.entries(matrix)) {
    const cells = row.split(' ');
    if (cells.length !== matrixRoleOrder.length) {
      throw new Error(`Ma trận quyền sai số cột ở ${moduleCode}`);
    }
    cells.forEach((cell, index) => {
      const roleCode = matrixRoleOrder[index];
      const cellActions = actionsByCell[cell];
      if (!roleCode || !cellActions) {
        throw new Error(`Ma trận quyền sai ở ${moduleCode}, cột ${index}`);
      }
      if (roleCode === 'VT-13') {
        return;
      }
      for (const action of cellActions) {
        result.get(roleCode)?.push(`${moduleCode}.${action}`);
      }
    });
  }
  result.get('VT-01')?.push(ACCOUNT_MANAGE_PERMISSION);
  result.get('VT-02')?.push(ACCOUNT_MANAGE_PERMISSION);
  return result;
}

async function seed(database: Kysely<unknown>) {
  for (const role of roles) {
    await sql`insert into roles (code, name, is_system) values (${role.code}, ${role.name}, true)`.execute(database);
  }
  for (const module of modules) {
    for (const action of actions) {
      const code = `${module.code}.${action.code}`;
      const description = `${action.name}: ${module.name}`;
      await sql`insert into permissions (code, module_code, description) values (${code}, ${module.code}, ${description})`.execute(
        database,
      );
    }
  }
  const accountManageDescription = 'Tạo tài khoản, khóa, mở khóa, đặt lại mật khẩu, gán vai trò';
  await sql`insert into permissions (code, module_code, description) values (${ACCOUNT_MANAGE_PERMISSION}, 'P01', ${accountManageDescription})`.execute(
    database,
  );
  for (const [roleCode, permissionCodes] of buildRolePermissionCodes()) {
    for (const permissionCode of permissionCodes) {
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code = ${roleCode} and permissions.code = ${permissionCode}`.execute(database);
    }
  }
}

export const migration: Migration = {
  async up(database) {
    await seed(database);
  },
  async down(database) {
    await sql`delete from role_permissions`.execute(database);
    await sql`delete from permissions`.execute(database);
    await sql`delete from roles where is_system`.execute(database);
  },
};
