import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Thù lao giáo viên dạy chương trình gia sư trong trường (DT-27 phần 27c, YCTD-253; tài liệu 32 mục 19.5). Claude tự chọn theo ủy
// quyền của Eric ngày 2026-10-11 ở chỗ kế hoạch chưa chốt:
// - đơn giá theo tiết, đặt ở chương trình, giáo viên có đơn giá riêng thì dùng đơn giá riêng; thù lao một buổi là số tiết quy đổi
//   của buổi nhân đơn giá, chỉ tính buổi chưa hủy đã xác nhận điểm danh;
// - nguồn chi ghi ở chương trình: `school_budget` (kinh phí hợp pháp của trường) hoặc `tutoring_fees` (từ khoản thu của chương trình
//   bổ trợ); chương trình `curriculum` luôn `school_budget` vì không thu tiền của học sinh;
// - người dạy buổi ghi khi xác nhận điểm danh;
// - đẩy vào bảng lương thành dòng thưởng của khoản mục "Thù lao dạy phụ đạo, bồi dưỡng" (chịu thuế thu nhập cá nhân theo biểu thuế
//   sẵn có, không đóng bảo hiểm) trong bảng `staff_bonus_deductions` của tháng; `tutoring_teacher_pay` ghi buổi nào đã đẩy để không
//   trả trùng; dòng thưởng bị hủy ở phân hệ lương thì buổi được đẩy lại.
export const TUTORING_PAY_ITEM_CODE = 'THU_LAO_DAY_THEM';

export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('tutoring_programs')
      .addColumn('pay_rate_per_period', 'bigint')
      .addColumn('funding_source', 'text', (column) => column.notNull().defaultTo('school_budget'))
      .execute();
    await sql`alter table tutoring_programs
      add constraint tutoring_programs_pay_rate_check check (pay_rate_per_period is null or pay_rate_per_period > 0),
      add constraint tutoring_programs_funding_check check (funding_source in ('school_budget', 'tutoring_fees')
        and (content_type <> 'curriculum' or funding_source = 'school_budget'))`.execute(database);
    await database.schema.alterTable('tutoring_program_teachers').addColumn('pay_rate_per_period', 'bigint').execute();
    await sql`alter table tutoring_program_teachers add constraint tutoring_program_teachers_pay_rate_check
      check (pay_rate_per_period is null or pay_rate_per_period > 0)`.execute(database);
    await database.schema
      .alterTable('tutoring_sessions')
      .addColumn('taught_by_user_id', 'uuid')
      .addColumn('taught_by_name', 'text')
      .execute();

    await database.schema
      .createTable('tutoring_teacher_pay')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('session_id', 'uuid', (column) => column.notNull().references('tutoring_sessions.id'))
      .addColumn('program_id', 'uuid', (column) => column.notNull().references('tutoring_programs.id'))
      .addColumn('teacher_user_id', 'uuid', (column) => column.notNull())
      .addColumn('teacher_name', 'text', (column) => column.notNull())
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('periods', 'integer', (column) => column.notNull())
      .addColumn('rate', 'bigint', (column) => column.notNull())
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('funding_source', 'text', (column) => column.notNull())
      .addColumn('bonus_deduction_id', 'uuid', (column) => column.notNull().references('staff_bonus_deductions.id'))
      .addColumn('target_year', 'integer', (column) => column.notNull())
      .addColumn('target_month', 'integer', (column) => column.notNull())
      .addColumn('pushed_by_name', 'text', (column) => column.notNull())
      .addColumn('pushed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('tutoring_teacher_pay_amount_check', sql`periods > 0 and rate > 0 and amount > 0`)
      .addCheckConstraint(
        'tutoring_teacher_pay_funding_check',
        sql`funding_source in ('school_budget', 'tutoring_fees')`,
      )
      .addCheckConstraint('tutoring_teacher_pay_month_check', sql`target_month between 1 and 12`)
      .execute();
    await database.schema
      .createIndex('tutoring_teacher_pay_session_index')
      .on('tutoring_teacher_pay')
      .column('session_id')
      .execute();
    await database.schema
      .createIndex('tutoring_teacher_pay_bonus_index')
      .on('tutoring_teacher_pay')
      .column('bonus_deduction_id')
      .execute();

    await database
      .insertInto('pay_item_types' as never)
      .values({
        kind: 'allowance',
        code: TUTORING_PAY_ITEM_CODE,
        name: 'Thù lao dạy phụ đạo, bồi dưỡng',
        calculation_method: 'fixed_monthly',
        default_amount: null,
        is_tax_exempt: false,
        is_mandatory_insurance: false,
      } as never)
      .onConflict((conflict) => conflict.column('code' as never).doNothing())
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('tutoring_teacher_pay').execute();
    await sql`delete from pay_item_types where code = ${TUTORING_PAY_ITEM_CODE}
      and not exists (select 1 from staff_bonus_deductions where pay_item_type_id = pay_item_types.id)
      and not exists (select 1 from staff_pay_items where pay_item_type_id = pay_item_types.id)`.execute(database);
    await database.schema
      .alterTable('tutoring_sessions')
      .dropColumn('taught_by_name')
      .dropColumn('taught_by_user_id')
      .execute();
    await sql`alter table tutoring_program_teachers drop constraint tutoring_program_teachers_pay_rate_check,
      drop column pay_rate_per_period`.execute(database);
    await sql`alter table tutoring_programs drop constraint tutoring_programs_funding_check,
      drop constraint tutoring_programs_pay_rate_check, drop column funding_source, drop column pay_rate_per_period`.execute(
      database,
    );
  },
};
