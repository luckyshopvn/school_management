import type { Migration } from 'kysely/migration';

// Danh sách người dùng phân trang, lọc ngay trong câu truy vấn (DT-15 phần 15e, YCTD-109): sắp theo họ tên rồi mã để
// trang đầu đọc theo chỉ mục, lọc theo nhóm người dùng đọc user_roles theo vai trò
export const migration: Migration = {
  async up(database) {
    await database.schema.createIndex('users_full_name_id_index').on('users').columns(['full_name', 'id']).execute();
    await database.schema.createIndex('user_roles_role_id_index').on('user_roles').column('role_id').execute();
  },
  async down(database) {
    await database.schema.dropIndex('user_roles_role_id_index').execute();
    await database.schema.dropIndex('users_full_name_id_index').execute();
  },
};
