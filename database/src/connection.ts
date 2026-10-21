import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

// Cột kiểu ngày giữ dạng chuỗi YYYY-MM-DD, không đổi sang mốc thời gian theo múi giờ của máy
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

// Mỗi loại cơ sở dữ liệu có chuỗi kết nối riêng; mã nguồn không giả định chỉ có một cơ sở dữ liệu (AI-41)
export function createDatabase<Schema>(connectionString: string): Kysely<Schema> {
  const pool = new pg.Pool({ connectionString });
  // Kết nối rảnh bị máy chủ cơ sở dữ liệu đóng (ví dụ lệnh đặt lại bản trình diễn xóa và tạo lại cơ sở dữ liệu, DT-18 phần
  // 18h) chỉ bị bỏ khỏi nhóm; không bắt lỗi này thì tiến trình dừng
  pool.on('error', (error) => {
    console.warn(`Kết nối cơ sở dữ liệu rảnh bị đóng: ${error.message}`);
  });
  return new Kysely<Schema>({
    dialect: new PostgresDialect({ pool }),
  });
}
