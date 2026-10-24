import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-22 phần 22e (YCTD-182): danh mục của hồ sơ bồi dưỡng giáo viên, dùng chung mọi năm học, cấu hình được; bộ mặc định ghi
// số hiệu văn bản, đổi văn bản thì sửa danh mục, không sửa mã. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - Thiết lập (một dòng): định mức tiết bồi dưỡng thường xuyên mỗi năm học, mặc định 120 tiết theo chương trình bồi dưỡng
//   thường xuyên (Thông tư 17/2019/TT-BGDĐT với giáo viên phổ thông, Thông tư 12/2019/TT-BGDĐT với giáo viên mầm non; quy
//   chế ở Thông tư 19/2019/TT-BGDĐT, sửa đổi bởi Thông tư 17/2022/TT-BGDĐT); mức năng lực số dưới ngưỡng thì gợi ý chuyên
//   đề; tên đơn vị cấp in trên chứng nhận (trống thì lấy tên trường).
// - Chuyên đề bồi dưỡng: ba chương trình (1: nhiệm vụ năm học, 2: yêu cầu của địa phương, 3: mô-đun phát triển nghề nghiệp
//   liên tục), mỗi chương trình khoảng 40 tiết; chuyên đề có thể gắn một miền năng lực số để gợi ý theo khoảng trống.
// - Khung năng lực số của giáo viên theo Thông tư 18/2026/TT-BGDĐT (hiệu lực 12/05/2026): 6 miền, 3 mức (Cơ bản, Thành thạo,
//   Nâng cao). Tên miền mặc định lấy theo bản tóm tắt trên cổng thông tin chính thức vì chưa đọc được toàn văn Mục B; trường
//   đối chiếu toàn văn và sửa ở danh mục
const DOMAINS = [
  ['NLS-1', 'Tổ chức dạy học trong môi trường số', 'Thiết kế, tổ chức hoạt động dạy học, giáo dục trên hạ tầng số'],
  ['NLS-2', 'Kiểm tra, đánh giá', 'Dùng công cụ số để kiểm tra, đánh giá và phản hồi kết quả học tập'],
  ['NLS-3', 'Trao quyền cho người học', 'Dùng công cụ số hỗ trợ người học tự học, học theo nhu cầu riêng'],
  ['NLS-4', 'Kĩ năng công nghệ số', 'Sử dụng thiết bị, phần mềm, dữ liệu số; bảo đảm an toàn số'],
  ['NLS-5', 'Phát triển chuyên môn', 'Giao tiếp, hợp tác, phát triển và chia sẻ học liệu số'],
  ['NLS-6', 'Trí tuệ nhân tạo (AI)', 'Ứng dụng trí tuệ nhân tạo có hiệu quả và có đạo đức trong dạy học'],
];
const LEVELS = [
  [1, 'Cơ bản', 'Sử dụng được các công cụ số thông dụng'],
  [2, 'Thành thạo', 'Thiết kế và tích hợp hiệu quả công nghệ vào dạy học'],
  [3, 'Nâng cao', 'Sáng tạo mô hình mới, hướng dẫn đồng nghiệp'],
];
const PROGRAMS = [
  ['BD-1', 'Chương trình bồi dưỡng 1: đáp ứng yêu cầu thực hiện nhiệm vụ năm học', 1],
  ['BD-2', 'Chương trình bồi dưỡng 2: đáp ứng yêu cầu phát triển giáo dục của địa phương', 2],
  ['BD-3', 'Chương trình bồi dưỡng 3: mô-đun phát triển năng lực nghề nghiệp liên tục', 3],
];

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('training_settings')
      .addColumn('id', 'smallint', (column) =>
        column
          .primaryKey()
          .defaultTo(1)
          .check(sql`id = 1`),
      )
      .addColumn('annual_required_periods', 'integer', (column) =>
        column
          .notNull()
          .defaultTo(120)
          .check(sql`annual_required_periods between 0 and 1000`),
      )
      .addColumn('competency_gap_level', 'smallint', (column) =>
        column
          .notNull()
          .defaultTo(2)
          .check(sql`competency_gap_level between 1 and 10`),
      )
      .addColumn('certificate_issuer', 'text')
      .addColumn('legal_basis', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_by', 'uuid')
      .execute();
    await database.schema
      .createTable('digital_competency_domains')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('description', 'text')
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('active')
          .check(sql`status in ('active', 'inactive')`),
      )
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createTable('digital_competency_levels')
      .addColumn('level_no', 'smallint', (column) => column.primaryKey().check(sql`level_no between 1 and 10`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 100`))
      .addColumn('description', 'text')
      .execute();
    await database.schema
      .createTable('training_topics')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 300`))
      .addColumn('program_no', 'smallint', (column) => column.notNull().check(sql`program_no between 1 and 3`))
      .addColumn('default_periods', 'integer', (column) =>
        column
          .notNull()
          .defaultTo(0)
          .check(sql`default_periods between 0 and 1000`),
      )
      .addColumn('competency_domain_code', 'text')
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('active')
          .check(sql`status in ('active', 'inactive')`),
      )
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database
      .insertInto('training_settings')
      .values({
        id: 1,
        annual_required_periods: 120,
        competency_gap_level: 2,
        legal_basis:
          'Thông tư 19/2019/TT-BGDĐT (sửa đổi bởi Thông tư 17/2022/TT-BGDĐT); Thông tư 17/2019/TT-BGDĐT, 12/2019/TT-BGDĐT; Thông tư 18/2026/TT-BGDĐT',
      })
      .execute();
    await database
      .insertInto('digital_competency_domains')
      .values(DOMAINS.map(([code, name, description], index) => ({ code, name, description, order_no: index + 1 })))
      .execute();
    await database
      .insertInto('digital_competency_levels')
      .values(LEVELS.map(([level_no, name, description]) => ({ level_no, name, description })))
      .execute();
    await database
      .insertInto('training_topics')
      .values([
        ...PROGRAMS.map(([code, name, program], index) => ({
          code,
          name,
          program_no: program,
          default_periods: 40,
          order_no: index + 1,
        })),
        ...DOMAINS.map(([code, name], index) => ({
          code: `BD-${code}`,
          name: `Năng lực số: ${name}`,
          program_no: 3,
          default_periods: 10,
          competency_domain_code: code,
          order_no: 10 + index,
        })),
      ])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('training_topics').execute();
    await database.schema.dropTable('digital_competency_levels').execute();
    await database.schema.dropTable('digital_competency_domains').execute();
    await database.schema.dropTable('training_settings').execute();
  },
};
