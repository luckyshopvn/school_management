import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Tên ngắn dưới biểu tượng khi cài ứng dụng giáo viên, phụ huynh lên màn hình chính (DT-26 phần 26a, YCTD-231): tối đa 9 ký tự, ứng
// dụng thêm "GV", "PH" phía sau; trống thì dùng "Giáo viên", "Phụ huynh"
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('school_branding')
      .addColumn('app_short_name', 'text', (column) => column.check(sql`char_length(app_short_name) between 1 and 9`))
      .execute();
  },
  async down(database) {
    await database.schema.alterTable('school_branding').dropColumn('app_short_name').execute();
  },
};
