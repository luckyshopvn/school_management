import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23b (YCTD-212): công cụ lớp học trên ứng dụng giáo viên, phần gọi tên và chia nhóm. Claude tự chọn theo ủy quyền
// của Eric ngày 2026-10-11:
// - `classroom_call_logs`: lượt gọi tên ngẫu nhiên (ai, lúc nào, của giáo viên nào). `client_id` do máy giáo viên sinh để
//   đồng bộ lại từ hàng đợi ngoại tuyến không tạo dòng trùng; `called_at` là thời điểm gọi thật trên máy, dòng sắp theo đó;
// - `classroom_groupings`: bản chia nhóm gần nhất của một giáo viên cho một lớp (một dòng mỗi lớp và giáo viên), nhóm lưu
//   dạng jsonb [{ name, child_ids }] để bảng điểm nhanh dùng lại. Không lưu họ tên: tên lấy từ danh sách lớp khi hiển thị
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('classroom_call_logs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('client_id', 'uuid', (column) => column.notNull().unique())
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('called_by', 'uuid', (column) => column.notNull())
      .addColumn('called_by_name', 'text', (column) => column.notNull())
      .addColumn('called_at', 'timestamptz', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('classroom_call_logs_class_called_index')
      .on('classroom_call_logs')
      .columns(['class_id', 'called_at'])
      .execute();

    await database.schema
      .createTable('classroom_groupings')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('owner_user_id', 'uuid', (column) => column.notNull())
      .addColumn('groups', 'jsonb', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('classroom_groupings_class_owner_unique', ['class_id', 'owner_user_id'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('classroom_groupings').execute();
    await database.schema.dropTable('classroom_call_logs').execute();
  },
};
