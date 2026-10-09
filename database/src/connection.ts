import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

// Cột kiểu ngày giữ dạng chuỗi YYYY-MM-DD, không đổi sang mốc thời gian theo múi giờ của máy
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

// Mỗi loại cơ sở dữ liệu có chuỗi kết nối riêng; mã nguồn không giả định chỉ có một cơ sở dữ liệu (AI-41)
export function createDatabase<Schema>(connectionString: string): Kysely<Schema> {
  return new Kysely<Schema>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString }) }),
  });
}
