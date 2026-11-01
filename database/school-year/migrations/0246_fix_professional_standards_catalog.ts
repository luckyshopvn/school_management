import { sql, type Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';
import { PRINCIPAL_STANDARDS, seedCriteria, TEACHER_STANDARDS } from './0047_create_standards_and_groups.js';

// Sửa danh mục chuẩn nghề nghiệp mầm non đã gieo theo bản cũ (YCTD-397, lỗi L-41): tiêu chí trọng yếu theo Điều 10 khoản 2,
// tên tiêu chí và tiêu chuẩn theo Điều 4 đến 8 của Thông tư 26/2018 (giáo viên) và Thông tư 25/2018 (hiệu trưởng). Chỉ sửa
// chuẩn mà danh mục còn nguyên bản gieo cũ (Hiệu trưởng chưa sửa gì); giữ nguyên dòng và mã tiêu chí, chỉ đổi tên, tiêu chuẩn
// và cờ trọng yếu. Phiếu đánh giá giữ bản chụp tiêu chí lúc mở nên không đổi (Eric chọn phương án A ngày 01/11/2026)
type StandardType = 'teacher' | 'principal';

interface CatalogCriterion {
  standardCode: string;
  name: string;
  isKey: boolean;
}

interface Catalog {
  standards: Record<string, string>;
  criteria: CatalogCriterion[];
}

const old = (standardCode: string, isKey: boolean, names: string[]) =>
  names.map((name) => ({ standardCode, name, isKey }));

// Bản gieo cũ của tệp 0047: tiêu chí thuộc tiêu chuẩn 1 và 2 là trọng yếu
const OLD_CATALOGS: Record<StandardType, Catalog> = {
  teacher: {
    standards: {
      TC1: 'Phẩm chất nhà giáo',
      TC2: 'Phát triển chuyên môn, nghiệp vụ',
      TC3: 'Xây dựng môi trường giáo dục',
      TC4: 'Phát triển mối quan hệ giữa nhà trường, gia đình và cộng đồng',
      TC5: 'Sử dụng ngoại ngữ hoặc tiếng dân tộc, ứng dụng công nghệ thông tin, thể hiện khả năng nghệ thuật',
    },
    criteria: [
      ...old('TC1', true, ['Đạo đức nhà giáo', 'Phong cách làm việc']),
      ...old('TC2', true, [
        'Phát triển chuyên môn bản thân',
        'Xây dựng kế hoạch nuôi dưỡng, chăm sóc, giáo dục trẻ em',
        'Nuôi dưỡng và chăm sóc sức khỏe trẻ em',
        'Giáo dục phát triển toàn diện trẻ em',
        'Quan sát và đánh giá sự phát triển của trẻ em',
        'Quản lý nhóm, lớp',
      ]),
      ...old('TC3', false, [
        'Xây dựng môi trường giáo dục an toàn, lành mạnh, thân thiện',
        'Thực hiện quyền dân chủ trong nhà trường',
      ]),
      ...old('TC4', false, [
        'Tạo dựng mối quan hệ hợp tác với cha mẹ hoặc người giám hộ của trẻ em và cộng đồng',
        'Phối hợp với cha mẹ hoặc người giám hộ của trẻ em và cộng đồng trong nuôi dưỡng, chăm sóc, giáo dục trẻ em',
      ]),
      ...old('TC5', false, [
        'Sử dụng ngoại ngữ hoặc tiếng dân tộc',
        'Ứng dụng công nghệ thông tin',
        'Thể hiện khả năng nghệ thuật trong hoạt động nuôi dưỡng, chăm sóc, giáo dục trẻ em',
      ]),
    ],
  },
  principal: {
    standards: {
      TC1: 'Phẩm chất nghề nghiệp',
      TC2: 'Quản trị nhà trường',
      TC3: 'Xây dựng môi trường giáo dục',
      TC4: 'Phát triển mối quan hệ giữa nhà trường, gia đình và xã hội',
      TC5: 'Sử dụng ngoại ngữ, công nghệ thông tin và khả năng nghệ thuật',
    },
    criteria: [
      ...old('TC1', true, [
        'Đạo đức nghề nghiệp',
        'Tư tưởng đổi mới trong lãnh đạo, quản trị nhà trường',
        'Năng lực phát triển chuyên môn, nghiệp vụ bản thân',
      ]),
      ...old('TC2', true, [
        'Tổ chức xây dựng kế hoạch phát triển nhà trường',
        'Quản trị hoạt động nuôi dưỡng, chăm sóc, giáo dục trẻ em',
        'Quản trị nhân sự nhà trường',
        'Quản trị tổ chức, hành chính nhà trường',
        'Quản trị tài chính nhà trường',
        'Quản trị cơ sở vật chất, thiết bị và công nghệ',
        'Quản trị chất lượng nuôi dưỡng, chăm sóc, giáo dục trẻ em',
      ]),
      ...old('TC3', false, [
        'Xây dựng văn hóa nhà trường',
        'Thực hiện dân chủ cơ sở trong nhà trường',
        'Xây dựng trường học an toàn, phòng chống bạo lực học đường',
      ]),
      ...old('TC4', false, [
        'Phối hợp giữa nhà trường, gia đình và xã hội trong nuôi dưỡng, chăm sóc, giáo dục trẻ em',
        'Phối hợp giữa nhà trường, gia đình và xã hội trong huy động và sử dụng nguồn lực phát triển nhà trường',
      ]),
      ...old('TC5', false, [
        'Sử dụng ngoại ngữ hoặc tiếng dân tộc',
        'Ứng dụng công nghệ thông tin',
        'Thể hiện khả năng nghệ thuật',
      ]),
    ],
  },
};

const NEW_CATALOGS: Record<StandardType, Catalog> = {
  teacher: {
    standards: Object.fromEntries(TEACHER_STANDARDS.map((standard) => [standard.code, standard.name])),
    criteria: seedCriteria('teacher'),
  },
  principal: {
    standards: Object.fromEntries(PRINCIPAL_STANDARDS.map((standard) => [standard.code, standard.name])),
    criteria: seedCriteria('principal'),
  },
};

// Danh mục hiện có của một chuẩn khớp đúng từng dòng với bản cho trước (mã, tên, tiêu chuẩn, cờ, thứ tự, đang dùng)
async function matches(database: Kysely<unknown>, standardType: StandardType, catalog: Catalog) {
  const standards = await sql<{ code: string; name: string }>`select code, name from professional_standards
    where standard_type = ${standardType} order by order_no`.execute(database);
  const criteria = await sql<{
    code: string;
    name: string;
    is_key: boolean;
    order_no: number;
    status: string;
    standard_code: string;
  }>`select criteria.code, criteria.name, criteria.is_key, criteria.order_no, criteria.status,
      standards.code as standard_code
    from professional_criteria criteria
    join professional_standards standards on standards.id = criteria.standard_id
    where criteria.standard_type = ${standardType} order by criteria.order_no`.execute(database);
  const standardCodes = Object.keys(catalog.standards);
  return (
    standards.rows.length === standardCodes.length &&
    standards.rows.every(
      (row, index) => row.code === standardCodes[index] && row.name === catalog.standards[row.code],
    ) &&
    criteria.rows.length === catalog.criteria.length &&
    criteria.rows.every((row, index) => {
      const expected = catalog.criteria[index]!;
      return (
        row.code === String(index + 1) &&
        Number(row.order_no) === index + 1 &&
        row.status === 'active' &&
        row.name === expected.name &&
        row.standard_code === expected.standardCode &&
        row.is_key === expected.isKey
      );
    })
  );
}

async function replaceCatalog(
  database: Kysely<unknown>,
  from: Record<StandardType, Catalog>,
  to: Record<StandardType, Catalog>,
) {
  for (const standardType of ['teacher', 'principal'] as StandardType[]) {
    if (!(await matches(database, standardType, from[standardType]))) {
      continue;
    }
    const target = to[standardType];
    for (const [code, name] of Object.entries(target.standards)) {
      await sql`update professional_standards set name = ${name}, updated_at = now()
        where standard_type = ${standardType} and code = ${code} and name <> ${name}`.execute(database);
    }
    for (const [index, criterion] of target.criteria.entries()) {
      await sql`update professional_criteria set name = ${criterion.name}, is_key = ${criterion.isKey},
          standard_id = (select id from professional_standards
            where standard_type = ${standardType} and code = ${criterion.standardCode}),
          updated_at = now()
        where standard_type = ${standardType} and code = ${String(index + 1)}`.execute(database);
    }
  }
}

export const migration: Migration = {
  async up(database) {
    await replaceCatalog(database, OLD_CATALOGS, NEW_CATALOGS);
  },
  async down(database) {
    await replaceCatalog(database, NEW_CATALOGS, OLD_CATALOGS);
  },
};
