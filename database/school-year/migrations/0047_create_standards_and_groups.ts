import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-14 phần 14c (YCTD-102): hoàn thành chương trình giáo dục mầm non của trẻ mẫu giáo 5-6 tuổi theo lớp, khóa danh sách
// khi Ban Giám hiệu xác nhận; nhóm trẻ trong đơn vị (năng khiếu, chăm sóc đặc biệt); đánh giá chuẩn nghề nghiệp giáo viên
// mầm non (Thông tư 26/2018/TT-BGDĐT) và chuẩn hiệu trưởng (Thông tư 25/2018/TT-BGDĐT) theo năm học. Danh mục tiêu chuẩn,
// tiêu chí gieo sẵn theo tên tiêu chí ở Điều 4 đến 8 của hai thông tư (YCTD-397); Hiệu trưởng sửa được khi văn bản thay đổi
type StandardType = 'teacher' | 'principal';

interface SeedStandard {
  code: string;
  name: string;
  criteria: string[];
}

// Tiêu chí trọng yếu (phải đạt Khá khi xếp Khá, đạt Tốt khi xếp Tốt) theo số tiêu chí, Điều 10 khoản 2 của Thông tư
// 26/2018 (giáo viên) và Thông tư 25/2018 (hiệu trưởng)
const KEY_CRITERIA: Record<StandardType, number[]> = {
  teacher: [1, 3, 4, 5, 6, 7, 8, 9],
  principal: [1, 4, 5, 6, 7, 9, 11, 13, 14, 15],
};

export const TEACHER_STANDARDS: SeedStandard[] = [
  { code: 'TC1', name: 'Phẩm chất nhà giáo', criteria: ['Đạo đức nhà giáo', 'Phong cách làm việc'] },
  {
    code: 'TC2',
    name: 'Phát triển chuyên môn, nghiệp vụ',
    criteria: [
      'Phát triển chuyên môn bản thân',
      'Xây dựng kế hoạch nuôi dưỡng, chăm sóc, giáo dục theo hướng phát triển toàn diện trẻ em',
      'Nuôi dưỡng và chăm sóc sức khỏe trẻ em',
      'Giáo dục phát triển toàn diện trẻ em',
      'Quan sát và đánh giá sự phát triển của trẻ em',
      'Quản lý nhóm, lớp',
    ],
  },
  {
    code: 'TC3',
    name: 'Xây dựng môi trường giáo dục',
    criteria: [
      'Xây dựng môi trường giáo dục an toàn, lành mạnh, thân thiện',
      'Thực hiện quyền dân chủ trong nhà trường',
    ],
  },
  {
    code: 'TC4',
    name: 'Phát triển mối quan hệ giữa nhà trường, gia đình và cộng đồng',
    criteria: [
      'Phối hợp với cha, mẹ hoặc người giám hộ trẻ em và cộng đồng để nâng cao chất lượng nuôi dưỡng, chăm sóc, giáo dục trẻ em',
      'Phối hợp với cha, mẹ hoặc người giám hộ trẻ em và cộng đồng để bảo vệ quyền trẻ em',
    ],
  },
  {
    code: 'TC5',
    name: 'Sử dụng ngoại ngữ hoặc tiếng dân tộc, ứng dụng công nghệ thông tin, thể hiện khả năng nghệ thuật',
    criteria: [
      'Sử dụng ngoại ngữ (ưu tiên tiếng Anh) hoặc tiếng dân tộc của trẻ em',
      'Ứng dụng công nghệ thông tin',
      'Thể hiện khả năng nghệ thuật trong hoạt động nuôi dưỡng, chăm sóc, giáo dục trẻ em',
    ],
  },
];

export const PRINCIPAL_STANDARDS: SeedStandard[] = [
  {
    code: 'TC1',
    name: 'Phẩm chất nghề nghiệp',
    criteria: [
      'Đạo đức nghề nghiệp, phong cách làm việc',
      'Tư tưởng đổi mới trong quản trị nhà trường',
      'Phát triển chuyên môn, nghiệp vụ bản thân',
    ],
  },
  {
    code: 'TC2',
    name: 'Quản trị nhà trường',
    criteria: [
      'Tổ chức xây dựng kế hoạch phát triển nhà trường',
      'Quản trị hoạt động nuôi dưỡng, chăm sóc sức khỏe của trẻ em',
      'Quản trị hoạt động giáo dục trẻ em',
      'Quản trị nhân sự nhà trường',
      'Quản trị tổ chức, hành chính nhà trường',
      'Quản trị tài chính nhà trường',
      'Quản trị cơ sở vật chất, đồ dùng, đồ chơi, thiết bị dạy học của nhà trường',
      'Quản trị chất lượng nuôi dưỡng, chăm sóc, giáo dục trẻ em trong nhà trường',
    ],
  },
  {
    code: 'TC3',
    name: 'Xây dựng môi trường giáo dục',
    criteria: [
      'Xây dựng văn hóa nhà trường',
      'Thực hiện dân chủ trong nhà trường',
      'Xây dựng trường học an toàn, phòng chống bạo lực học đường',
    ],
  },
  {
    code: 'TC4',
    name: 'Phát triển mối quan hệ giữa nhà trường, gia đình, xã hội',
    criteria: [
      'Phối hợp giữa nhà trường, gia đình, địa phương trong hoạt động nuôi dưỡng, chăm sóc, giáo dục trẻ em',
      'Phối hợp giữa nhà trường, gia đình, địa phương trong huy động và sử dụng nguồn lực để phát triển nhà trường',
    ],
  },
  {
    code: 'TC5',
    name: 'Sử dụng ngoại ngữ (hoặc tiếng dân tộc) và công nghệ thông tin',
    criteria: ['Sử dụng ngoại ngữ', 'Ứng dụng công nghệ thông tin'],
  },
];

const SEED_STANDARDS: Record<StandardType, SeedStandard[]> = {
  teacher: TEACHER_STANDARDS,
  principal: PRINCIPAL_STANDARDS,
};

// Tiêu chí gieo sẵn của một chuẩn; tiêu chí đánh số liên tục trong cả chuẩn như văn bản (Tiêu chí 1, 2, ...)
export function seedCriteria(standardType: StandardType) {
  let criterionNumber = 0;
  return SEED_STANDARDS[standardType].flatMap((standard) =>
    standard.criteria.map((name) => {
      criterionNumber += 1;
      return {
        standardCode: standard.code,
        number: criterionNumber,
        name,
        isKey: KEY_CRITERIA[standardType].includes(criterionNumber),
      };
    }),
  );
}

// Gieo danh mục tiêu chuẩn, tiêu chí
export async function seedProfessionalStandards(database: Kysely<unknown>) {
  for (const standardType of ['teacher', 'principal'] as StandardType[]) {
    const criteria = seedCriteria(standardType);
    for (const [standardIndex, standard] of SEED_STANDARDS[standardType].entries()) {
      const inserted = await sql<{
        id: string;
      }>`insert into professional_standards (standard_type, code, name, order_no)
        values (${standardType}, ${standard.code}, ${standard.name}, ${standardIndex + 1}) returning id`.execute(
        database,
      );
      const standardId = inserted.rows[0]!.id;
      for (const criterion of criteria.filter((row) => row.standardCode === standard.code)) {
        await sql`insert into professional_criteria (standard_id, standard_type, code, name, is_key, order_no)
          values (${standardId}, ${standardType}, ${String(criterion.number)}, ${criterion.name},
            ${criterion.isKey}, ${criterion.number})`.execute(database);
      }
    }
  }
}

export const migration: Migration = {
  async up(database) {
    // Hoàn thành chương trình: một kết quả mỗi trẻ trong năm học, gắn lớp lúc ghi
    await database.schema
      .createTable('program_completions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().unique().references('children.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('result', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('recorded_by', 'uuid', (column) => column.notNull())
      .addColumn('recorded_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('program_completions_result_check', sql`result in ('completed', 'not_completed')`)
      .execute();
    await database.schema
      .createIndex('program_completions_class_index')
      .on('program_completions')
      .column('class_id')
      .execute();

    // Ban Giám hiệu xác nhận danh sách của lớp thì khóa, hủy xác nhận thì xóa dòng (có nhật ký thao tác)
    await database.schema
      .createTable('program_completion_confirmations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().unique().references('classes.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('completed_count', 'integer', (column) => column.notNull())
      .addColumn('children_count', 'integer', (column) => column.notNull())
      .addColumn('confirmed_by', 'uuid', (column) => column.notNull())
      .addColumn('confirmed_by_name', 'text', (column) => column.notNull())
      .addColumn('confirmed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    // Nhóm trẻ trong đơn vị; một trẻ thuộc nhiều nhóm
    await database.schema
      .createTable('child_groups')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('description', 'text')
      .addColumn('teacher_staff_id', 'uuid', (column) => column.references('staff.id'))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('child_groups_status_check', sql`status in ('active', 'inactive')`)
      .addUniqueConstraint('child_groups_unit_name_unique', ['org_unit_id', 'name'])
      .execute();
    await database.schema
      .createTable('child_group_members')
      .addColumn('group_id', 'uuid', (column) => column.notNull().references('child_groups.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('added_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('child_group_members_pkey', ['group_id', 'child_id'])
      .execute();
    await database.schema
      .createIndex('child_group_members_child_index')
      .on('child_group_members')
      .column('child_id')
      .execute();

    // Danh mục chuẩn nghề nghiệp dùng chung toàn trường
    await database.schema
      .createTable('professional_standards')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('standard_type', 'text', (column) => column.notNull())
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('order_no', 'integer', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('professional_standards_type_check', sql`standard_type in ('teacher', 'principal')`)
      .addUniqueConstraint('professional_standards_type_code_unique', ['standard_type', 'code'])
      .execute();
    await database.schema
      .createTable('professional_criteria')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('standard_id', 'uuid', (column) => column.notNull().references('professional_standards.id'))
      .addColumn('standard_type', 'text', (column) => column.notNull())
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('is_key', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('order_no', 'integer', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('professional_criteria_type_check', sql`standard_type in ('teacher', 'principal')`)
      .addCheckConstraint('professional_criteria_status_check', sql`status in ('active', 'inactive')`)
      .addUniqueConstraint('professional_criteria_type_code_unique', ['standard_type', 'code'])
      .execute();

    // Phiếu đánh giá chuẩn nghề nghiệp: một phiếu mỗi nhân sự mỗi năm học
    await database.schema
      .createTable('professional_evaluations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().unique().references('staff.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('standard_type', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('self_assessing'))
      .addColumn('self_submitted_at', 'timestamptz')
      .addColumn('overall_level', 'text')
      .addColumn('assessor_comment', 'text')
      .addColumn('opened_by', 'uuid', (column) => column.notNull())
      .addColumn('finalized_by', 'uuid')
      .addColumn('finalized_by_name', 'text')
      .addColumn('finalized_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('professional_evaluations_type_check', sql`standard_type in ('teacher', 'principal')`)
      .addCheckConstraint(
        'professional_evaluations_status_check',
        sql`status in ('self_assessing', 'self_submitted', 'finalized')`,
      )
      .addCheckConstraint(
        'professional_evaluations_level_check',
        sql`overall_level is null or overall_level in ('not_met', 'met', 'good', 'excellent')`,
      )
      .execute();
    await database.schema
      .createIndex('professional_evaluations_unit_index')
      .on('professional_evaluations')
      .column('org_unit_id')
      .execute();
    // Tiêu chí chụp lại lúc mở phiếu để sửa danh mục không đổi phiếu đã mở
    await database.schema
      .createTable('professional_evaluation_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('evaluation_id', 'uuid', (column) => column.notNull().references('professional_evaluations.id'))
      .addColumn('criterion_id', 'uuid', (column) => column.notNull().references('professional_criteria.id'))
      .addColumn('standard_code', 'text', (column) => column.notNull())
      .addColumn('standard_name', 'text', (column) => column.notNull())
      .addColumn('criterion_code', 'text', (column) => column.notNull())
      .addColumn('criterion_name', 'text', (column) => column.notNull())
      .addColumn('is_key', 'boolean', (column) => column.notNull())
      .addColumn('order_no', 'integer', (column) => column.notNull())
      .addColumn('self_rating', 'text')
      .addColumn('self_evidence', 'text')
      .addColumn('assessor_rating', 'text')
      .addColumn('assessor_note', 'text')
      .addCheckConstraint(
        'professional_evaluation_items_self_check',
        sql`self_rating is null or self_rating in ('not_met', 'met', 'good', 'excellent')`,
      )
      .addCheckConstraint(
        'professional_evaluation_items_assessor_check',
        sql`assessor_rating is null or assessor_rating in ('not_met', 'met', 'good', 'excellent')`,
      )
      .addUniqueConstraint('professional_evaluation_items_unique', ['evaluation_id', 'criterion_id'])
      .execute();

    await seedProfessionalStandards(database);
  },
  async down(database) {
    for (const table of [
      'professional_evaluation_items',
      'professional_evaluations',
      'professional_criteria',
      'professional_standards',
      'child_group_members',
      'child_groups',
      'program_completion_confirmations',
      'program_completions',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
