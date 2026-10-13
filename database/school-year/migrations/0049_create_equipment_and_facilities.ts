import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Thiết bị dạy học tối thiểu, khai báo cơ sở vật chất, hồ sơ trường (DT-14 phần 14d, YCTD-102):
// - `equipment_items`: danh mục thiết bị dùng chung toàn trường; mỗi dòng có nhóm tuổi, nhóm thiết bị, đơn vị tính, số lượng
//   tối thiểu cho một nhóm, lớp (hoặc cho một học sinh); `is_minimum` phân biệt danh mục tối thiểu của Thông tư 02/2010 (sửa
//   đổi bởi Thông tư 34/2013) với thiết bị ngoài danh mục. Dữ liệu khởi tạo chỉ là tên ngắn và số lượng gợi ý của một phần
//   danh mục, ghi chú "Cần đối chiếu văn bản"; Hiệu trưởng sửa, bổ sung trên màn hình;
// - `equipment_holdings`: số lượng hiện có nhập tay theo đơn vị (dòng không có lớp) hoặc theo lớp; nhu cầu bổ sung năm sau
//   nhập ở dòng của đơn vị;
// - `assets.equipment_item_id`: tài sản gắn với một thiết bị trong danh mục được cộng vào số hiện có;
// - `rooms`: khối phòng, loại phòng, hiện trạng, diện tích, thuộc tính theo quy chuẩn (jsonb, khóa cố định);
// - `school_profiles`: hồ sơ của Trường chính, mỗi thẻ một cột jsonb, khóa cố định do máy chủ kiểm tra
type Seed = [
  code: string,
  name: string,
  unit: string,
  group: string,
  area: string | null,
  quantity: number,
  basis: string,
];

const SEEDS: Record<string, Seed[]> = {
  nt_3_12: [
    ['NT1-DD-01', 'Giường cho trẻ', 'cái', 'do_dung', null, 0.5, 'child'],
    ['NT1-DD-02', 'Giá phơi khăn', 'cái', 'do_dung', null, 1, 'class'],
    ['NT1-DD-03', 'Tủ đựng đồ dùng cá nhân', 'cái', 'do_dung', null, 1, 'class'],
    ['NT1-DD-04', 'Ca, cốc uống nước', 'cái', 'do_dung', null, 1, 'child'],
    ['NT1-TB-01', 'Xúc xắc các loại', 'bộ', 'thiet_bi_do_choi', 'the_chat', 2, 'class'],
    ['NT1-TB-02', 'Bóng nhựa các màu', 'quả', 'thiet_bi_do_choi', 'the_chat', 10, 'class'],
    ['NT1-TB-03', 'Đồ chơi treo nôi phát ra âm thanh', 'bộ', 'thiet_bi_do_choi', 'nhan_thuc', 2, 'class'],
    ['NT1-TB-04', 'Búp bê bằng vải', 'con', 'thiet_bi_do_choi', 'tinh_cam_xa_hoi', 2, 'class'],
    ['NT1-ST-01', 'Tranh ảnh về người thân và con vật gần gũi', 'bộ', 'sach_tai_lieu', 'ngon_ngu', 1, 'class'],
  ],
  nt_12_24: [
    ['NT2-DD-01', 'Giường cho trẻ', 'cái', 'do_dung', null, 0.5, 'child'],
    ['NT2-DD-02', 'Bàn cho trẻ', 'cái', 'do_dung', null, 0.25, 'child'],
    ['NT2-DD-03', 'Ghế cho trẻ', 'cái', 'do_dung', null, 1, 'child'],
    ['NT2-DD-04', 'Giá để đồ chơi', 'cái', 'do_dung', null, 2, 'class'],
    ['NT2-TB-01', 'Xe đẩy tập đi', 'cái', 'thiet_bi_do_choi', 'the_chat', 2, 'class'],
    ['NT2-TB-02', 'Bộ xâu hạt', 'bộ', 'thiet_bi_do_choi', 'the_chat', 5, 'class'],
    ['NT2-TB-03', 'Bộ hình khối lắp ghép', 'bộ', 'thiet_bi_do_choi', 'nhan_thuc', 5, 'class'],
    ['NT2-TB-04', 'Trống con', 'cái', 'thiet_bi_do_choi', 'tham_my', 2, 'class'],
    ['NT2-ST-01', 'Sách tranh truyện cho trẻ nhà trẻ', 'quyển', 'sach_tai_lieu', 'ngon_ngu', 5, 'class'],
  ],
  nt_24_36: [
    ['NT3-DD-01', 'Giường cho trẻ', 'cái', 'do_dung', null, 0.5, 'child'],
    ['NT3-DD-02', 'Bàn cho trẻ', 'cái', 'do_dung', null, 0.25, 'child'],
    ['NT3-DD-03', 'Ghế cho trẻ', 'cái', 'do_dung', null, 1, 'child'],
    ['NT3-DD-04', 'Giá để đồ chơi và học liệu', 'cái', 'do_dung', null, 2, 'class'],
    ['NT3-TB-01', 'Cổng chui', 'cái', 'thiet_bi_do_choi', 'the_chat', 2, 'class'],
    ['NT3-TB-02', 'Bộ tranh lô tô các loại', 'bộ', 'thiet_bi_do_choi', 'nhan_thuc', 5, 'class'],
    ['NT3-TB-03', 'Bộ đồ chơi nấu ăn', 'bộ', 'thiet_bi_do_choi', 'tinh_cam_xa_hoi', 2, 'class'],
    ['NT3-TB-04', 'Bộ dụng cụ âm nhạc (xắc xô, phách tre)', 'bộ', 'thiet_bi_do_choi', 'tham_my', 1, 'class'],
    ['NT3-ST-01', 'Bộ tranh truyện theo chủ đề', 'bộ', 'sach_tai_lieu', 'ngon_ngu', 1, 'class'],
  ],
  mg_3_4: [
    ['MG3-DD-01', 'Bàn cho trẻ', 'cái', 'do_dung', null, 0.5, 'child'],
    ['MG3-DD-02', 'Ghế cho trẻ', 'cái', 'do_dung', null, 1, 'child'],
    ['MG3-DD-03', 'Giá để đồ chơi và học liệu', 'cái', 'do_dung', null, 4, 'class'],
    ['MG3-DD-04', 'Bàn, ghế giáo viên', 'bộ', 'do_dung', null, 1, 'class'],
    ['MG3-TB-01', 'Vòng thể dục', 'cái', 'thiet_bi_do_choi', 'the_chat', 1, 'child'],
    ['MG3-TB-02', 'Bộ hình học phẳng', 'bộ', 'thiet_bi_do_choi', 'nhan_thuc', 1, 'child'],
    ['MG3-TB-03', 'Lô tô các con vật', 'bộ', 'thiet_bi_do_choi', 'nhan_thuc', 5, 'class'],
    ['MG3-TB-04', 'Bộ đồ chơi bác sĩ', 'bộ', 'thiet_bi_do_choi', 'tinh_cam_xa_hoi', 1, 'class'],
    ['MG3-TB-05', 'Đất nặn', 'hộp', 'thiet_bi_do_choi', 'tham_my', 1, 'child'],
    ['MG3-ST-01', 'Bộ tranh minh họa thơ, truyện mẫu giáo 3–4 tuổi', 'bộ', 'sach_tai_lieu', 'ngon_ngu', 1, 'class'],
  ],
  mg_4_5: [
    ['MG4-DD-01', 'Bàn cho trẻ', 'cái', 'do_dung', null, 0.5, 'child'],
    ['MG4-DD-02', 'Ghế cho trẻ', 'cái', 'do_dung', null, 1, 'child'],
    ['MG4-DD-03', 'Giá để đồ chơi và học liệu', 'cái', 'do_dung', null, 4, 'class'],
    ['MG4-TB-01', 'Gậy thể dục', 'cái', 'thiet_bi_do_choi', 'the_chat', 1, 'child'],
    ['MG4-TB-02', 'Bộ que tính', 'bộ', 'thiet_bi_do_choi', 'nhan_thuc', 1, 'child'],
    ['MG4-TB-03', 'Bộ lắp ghép xây dựng', 'bộ', 'thiet_bi_do_choi', 'nhan_thuc', 3, 'class'],
    ['MG4-TB-04', 'Bộ đồ chơi bán hàng', 'bộ', 'thiet_bi_do_choi', 'tinh_cam_xa_hoi', 1, 'class'],
    ['MG4-TB-05', 'Bộ dụng cụ gõ đệm âm nhạc', 'bộ', 'thiet_bi_do_choi', 'tham_my', 1, 'class'],
    ['MG4-ST-01', 'Bộ tranh minh họa thơ, truyện mẫu giáo 4–5 tuổi', 'bộ', 'sach_tai_lieu', 'ngon_ngu', 1, 'class'],
  ],
  mg_5_6: [
    ['MG5-DD-01', 'Bàn cho trẻ', 'cái', 'do_dung', null, 0.5, 'child'],
    ['MG5-DD-02', 'Ghế cho trẻ', 'cái', 'do_dung', null, 1, 'child'],
    ['MG5-DD-03', 'Giá để đồ chơi và học liệu', 'cái', 'do_dung', null, 5, 'class'],
    ['MG5-TB-01', 'Bóng các loại', 'quả', 'thiet_bi_do_choi', 'the_chat', 0.5, 'child'],
    ['MG5-TB-02', 'Bộ chữ cái và chữ số', 'bộ', 'thiet_bi_do_choi', 'ngon_ngu', 1, 'child'],
    ['MG5-TB-03', 'Bộ đồ dùng toán học', 'bộ', 'thiet_bi_do_choi', 'nhan_thuc', 1, 'child'],
    ['MG5-TB-04', 'Bộ đồ chơi giao thông', 'bộ', 'thiet_bi_do_choi', 'tinh_cam_xa_hoi', 1, 'class'],
    ['MG5-TB-05', 'Đàn organ', 'cái', 'thiet_bi_do_choi', 'tham_my', 1, 'class'],
    ['MG5-ST-01', 'Vở làm quen với chữ cái', 'quyển', 'sach_tai_lieu', 'ngon_ngu', 1, 'child'],
    ['MG5-ST-02', 'Bộ tranh minh họa thơ, truyện mẫu giáo 5–6 tuổi', 'bộ', 'sach_tai_lieu', 'ngon_ngu', 1, 'class'],
  ],
};

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('equipment_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('unit', 'text', (column) => column.notNull())
      .addColumn('equipment_group', 'text', (column) => column.notNull())
      .addColumn('development_area', 'text')
      .addColumn('age_group', 'text', (column) => column.notNull())
      .addColumn('quantity', 'numeric(10, 2)', (column) => column.notNull())
      .addColumn('norm_basis', 'text', (column) => column.notNull().defaultTo('class'))
      .addColumn('target_users', 'text', (column) => column.notNull().defaultTo('tre'))
      .addColumn('equipment_type', 'text')
      .addColumn('is_minimum', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('is_seeded', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('note', 'text')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'equipment_items_group_check',
        sql`equipment_group in ('do_dung', 'thiet_bi_do_choi', 'sach_tai_lieu')`,
      )
      .addCheckConstraint(
        'equipment_items_age_group_check',
        sql`age_group in ('nt_3_12', 'nt_12_24', 'nt_24_36', 'mg_3_4', 'mg_4_5', 'mg_5_6')`,
      )
      .addCheckConstraint('equipment_items_quantity_check', sql`quantity >= 0`)
      .addCheckConstraint('equipment_items_basis_check', sql`norm_basis in ('class', 'child')`)
      .addCheckConstraint('equipment_items_target_check', sql`target_users in ('tre', 'giao_vien', 'tre_giao_vien')`)
      .addCheckConstraint('equipment_items_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    await database.schema
      .createTable('equipment_holdings')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('equipment_item_id', 'uuid', (column) => column.notNull().references('equipment_items.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('class_id', 'uuid', (column) => column.references('classes.id'))
      .addColumn('quantity', 'numeric(10, 2)', (column) => column.notNull().defaultTo(0))
      .addColumn('next_year_need', 'numeric(10, 2)')
      .addColumn('note', 'text')
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('equipment_holdings_quantity_check', sql`quantity >= 0`)
      .addCheckConstraint(
        'equipment_holdings_need_check',
        sql`next_year_need is null or (next_year_need >= 0 and class_id is null)`,
      )
      .execute();
    await sql`create unique index equipment_holdings_unique on equipment_holdings
      (equipment_item_id, org_unit_id, coalesce(class_id, '00000000-0000-0000-0000-000000000000'::uuid))`.execute(
      database,
    );

    await database.schema
      .alterTable('assets')
      .addColumn('equipment_item_id', 'uuid', (column) => column.references('equipment_items.id'))
      .execute();

    await database.schema
      .alterTable('rooms')
      .addColumn('room_block', 'text')
      .addColumn('room_type', 'text')
      .addColumn('condition', 'text')
      .addColumn('area_m2', 'numeric(10, 2)')
      .addColumn('facility_attributes', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .execute();
    await sql`alter table rooms
      add constraint rooms_block_check
        check (room_block is null or room_block in ('care_education', 'meal', 'support', 'administration', 'other')),
      add constraint rooms_condition_check
        check (condition is null or condition in ('permanent', 'semi_permanent', 'temporary', 'borrowed')),
      add constraint rooms_area_check check (area_m2 is null or area_m2 >= 0)`.execute(database);

    await database.schema
      .createTable('school_profiles')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().unique().references('org_units.id'))
      .addColumn('general', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('other_info', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('foreign_elements', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('internet', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('it_infrastructure', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('office_accounts', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    let order = 0;
    for (const [ageGroup, seeds] of Object.entries(SEEDS)) {
      for (const [code, name, unit, group, area, quantity, basis] of seeds) {
        order += 1;
        await sql`insert into equipment_items
          (code, name, unit, equipment_group, development_area, age_group, quantity, norm_basis, is_minimum, is_seeded, order_no,
          note)
          values (${code}, ${name}, ${unit}, ${group}, ${area}, ${ageGroup}, ${quantity}, ${basis}, true, true, ${order},
          'Cần đối chiếu văn bản')`.execute(database);
      }
    }
  },
  async down(database) {
    await database.schema.dropTable('school_profiles').execute();
    await database.schema
      .alterTable('rooms')
      .dropColumn('facility_attributes')
      .dropColumn('area_m2')
      .dropColumn('condition')
      .dropColumn('room_type')
      .dropColumn('room_block')
      .execute();
    await database.schema.alterTable('assets').dropColumn('equipment_item_id').execute();
    await database.schema.dropTable('equipment_holdings').execute();
    await database.schema.dropTable('equipment_items').execute();
  },
};
