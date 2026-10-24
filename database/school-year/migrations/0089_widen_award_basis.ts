import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-21 phần 21e (YCTD-172): căn cứ danh hiệu khen thưởng của THCS, THPT theo Thông tư 22/2021 (`secondary_excellent`: học
// sinh Xuất sắc, `secondary_good`: học sinh Giỏi). Bảng học bạ, khen thưởng, hoàn thành chương trình của 20e dùng chung; học
// bạ THCS, THPT ghi thêm khối `secondary` ở nội dung JSON nên không đổi cột
export const migration: Migration = {
  async up(database) {
    await sql`alter table student_award_titles drop constraint student_award_titles_basis_check`.execute(database);
    await sql`alter table student_award_titles add constraint student_award_titles_basis_check
      check (basis is null or basis in ('excellent', 'outstanding', 'secondary_excellent', 'secondary_good'))`.execute(
      database,
    );
  },
  async down(database) {
    await sql`delete from student_award_titles where basis in ('secondary_excellent', 'secondary_good')`.execute(
      database,
    );
    await sql`alter table student_award_titles drop constraint student_award_titles_basis_check`.execute(database);
    await sql`alter table student_award_titles add constraint student_award_titles_basis_check
      check (basis is null or basis in ('excellent', 'outstanding'))`.execute(database);
  },
};
