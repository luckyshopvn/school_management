import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 18d (YCTD-139): phân hệ KPI chuyển từ hệ thống KPI riêng của trường vào School Management, dùng chung nhân sự,
// đơn vị, phân quyền, thông báo, tệp, nhật ký. Mọi tham số chấm điểm là cấu hình của bộ quy tắc, có phiên bản:
// - `kpi_rule_sets`, `kpi_rule_set_versions`: bộ quy tắc và các phiên bản cấu hình (bản nháp sửa được, bản đã ban hành
//   không sửa); kỳ giữ phiên bản đã dùng;
// - `kpi_profiles`: đối tượng đánh giá của từng nhân sự (bộ quy tắc, nhóm lãnh đạo hoặc cán bộ, cấp học, vị trí việc làm,
//   người đứng đầu, cấp trên trực tiếp chấm);
// - `kpi_periods`, `kpi_period_rule_versions`: kỳ đánh giá, lịch kỳ, khóa và mở lại; phiên bản quy tắc của từng bộ trong kỳ;
// - `kpi_catalog_items`: danh mục công việc chuẩn của trường hoặc của đơn vị, chỉ báo theo vị trí việc làm và cấp học;
// - `kpi_tasks`, `kpi_task_files`: việc của từng người trong kỳ (giao, tự đăng ký, phát sinh), minh chứng, số ký hiệu văn
//   bản (chữ tự do, nối văn bản đi khi 18b gộp), tự đánh giá, chấm, ủy quyền chấm;
// - `kpi_evaluations`, `kpi_evaluation_criteria`: phiếu tự đánh giá, xếp loại của từng người trong kỳ, điểm tiêu chí chung;
// - `kpi_votes`: biểu quyết mức xếp loại;
// - `kpi_manager_actions`: hạn duyệt, chấm của người quản lý và việc làm đúng hạn hay để quá hạn.
// Hai bộ quy tắc mặc định đặt tên trung tính; danh mục nhiệm vụ của đơn vị do trường tự nhập hoặc nhập từ Excel lúc dùng
const PREVIOUS_PURPOSES = `'birth_certificate', 'photo_consent', 'import', 'pickup_photo', 'payment_voucher', 'medicine_photo', 'prescription', 'activity_photo', 'content_file', 'candidate_cv', 'final_year_document', 'admission_document'`;

// Tiêu chí chung 30 điểm theo Mẫu 01-A (lãnh đạo, quản lý) và Mẫu 01-B (cán bộ) của Hướng dẫn 06-HD/BTCTU; Eric chọn ngày
// 2026-10-20 dùng chung cho mọi bộ quy tắc. Nhóm 2 khác nhau theo nhóm đối tượng
const BOTH = ['leader', 'staff'];
const GENERAL_CRITERIA = {
  max: 30,
  groups: [
    {
      code: '1',
      title: 'Về phẩm chất chính trị, đạo đức, lối sống, thực hiện trách nhiệm nêu gương',
      items: [
        [
          '1.1',
          'Tuyệt đối trung thành với Đảng, Tổ quốc và Nhân dân; kiên định chủ nghĩa Mác - Lênin, tư tưởng Hồ Chí Minh, mục tiêu độc lập dân tộc và chủ nghĩa xã hội. Có lập trường, quan điểm, bản lĩnh chính trị vững vàng; kiên quyết bảo vệ nền tảng tư tưởng, Cương lĩnh chính trị, đường lối của Đảng, Hiến pháp, pháp luật của Nhà nước; đấu tranh phản bác các quan điểm sai trái, thù địch, các biểu hiện suy thoái, "tự diễn biến", "tự chuyển hoá".',
        ],
        [
          '1.2',
          'Có tinh thần yêu nước sâu sắc, tận tuỵ phục vụ Nhân dân, sâu sát cơ sở, luôn hành động vì lợi ích của Nhân dân. Đặt lợi ích của Đảng, quốc gia - dân tộc, Nhân dân, tập thể lên trên lợi ích cá nhân, sẵn sàng hy sinh vì sự nghiệp cách mạng của Đảng, vì độc lập, tự do của Tổ quốc, vì hạnh phúc của Nhân dân.',
        ],
        [
          '1.3',
          'Chấp hành nghiêm chủ trương, đường lối, nghị quyết, chỉ thị, quy định, nguyên tắc tổ chức, kỷ luật của Đảng, nhất là nguyên tắc tập trung dân chủ, tự phê bình và phê bình; chấp hành nghiêm pháp luật của Nhà nước và quy định của cơ quan, đơn vị. Tuyệt đối chấp hành sự phân công của tổ chức, yên tâm công tác và hoàn thành tốt mọi nhiệm vụ được giao.',
        ],
        [
          '1.4',
          'Có tinh thần tự giác, trách nhiệm cao trong nghiên cứu, học tập chủ nghĩa Mác - Lênin, tư tưởng Hồ Chí Minh, các nghị quyết, chỉ thị của Đảng và các chương trình bồi dưỡng, cập nhật kiến thức mới nhằm nâng cao trình độ về mọi mặt, đáp ứng yêu cầu, nhiệm vụ.',
        ],
        [
          '1.5',
          'Có phẩm chất đạo đức, lối sống trong sáng, trung thực, khiêm tốn, chân thành, giản dị; cần, kiệm, liêm, chính, chí công vô tư; chấp hành nghiêm quy định về chuẩn mực đạo đức cách mạng của cán bộ, đảng viên trong giai đoạn mới, trách nhiệm nêu gương; không vi phạm Quy định về những điều đảng viên không được làm. Không né tránh công việc, chạy theo thành tích; không vi phạm đạo đức, lối sống đến mức bị xử lý kỷ luật.',
        ],
        [
          '1.6',
          'Không tham vọng quyền lực; không chạy chức, chạy quyền; không tham nhũng, lãng phí, cơ hội, vụ lợi, cục bộ, lợi ích nhóm; không để gia đình, người thân và người khác lợi dụng chức vụ, vị trí công tác để trục lợi. Không có biểu hiện suy thoái về tư tưởng chính trị, đạo đức, lối sống, những biểu hiện "tự diễn biến", "tự chuyển hoá" trong nội bộ. Kiên quyết đấu tranh chống quan liêu, cửa quyền, tham nhũng, xa hoa, lãng phí, tiêu cực, chủ nghĩa cá nhân, lối sống cơ hội, thực dụng, bè phái, lợi ích nhóm, nói không đi đôi với làm.',
        ],
        [
          '1.7',
          'Có uy tín cao, tiêu biểu về phẩm chất đạo đức và phong cách công tác; là trung tâm đoàn kết, thương yêu đồng chí, đồng nghiệp.',
        ],
        [
          '1.8',
          'Có tinh thần chủ động, đổi mới sáng tạo; phấn đấu vì mục tiêu phát triển của cơ quan, đơn vị, đóng góp vào mục tiêu chung của đất nước.',
        ],
        [
          '1.9',
          'Thực hiện việc kê khai và công khai tài sản, thu nhập theo quy định. Báo cáo đầy đủ, trung thực, cung cấp thông tin chính xác, khách quan về những nội dung liên quan đến việc thực hiện chức trách, nhiệm vụ được giao và hoạt động của cơ quan, tổ chức, đơn vị với cấp trên khi được yêu cầu.',
        ],
      ].map(([code, title]) => ({ code, title, max_score: 2, subject_groups: BOTH })),
    },
    {
      code: '2',
      title: 'Tư duy đổi mới, chiến lược, khát vọng cống hiến, dám nghĩ dám làm',
      items: [
        {
          code: '2.1',
          title:
            'Có tư duy đổi mới, tầm nhìn chiến lược, khả năng lãnh đạo, chỉ đạo thích ứng với sự phát triển của thời đại và xu thế toàn cầu hoá; phương pháp làm việc khoa học, nhạy bén chính trị; có năng lực cụ thể hoá trong lãnh đạo, chỉ đạo cơ quan, đơn vị thực hiện và hoàn thành tốt chức năng, nhiệm vụ được giao.',
          max_score: 1,
          subject_groups: ['leader'],
        },
        {
          code: '2.2',
          title:
            'Luôn bám sát thực tiễn, có nhiều cách làm hay, sáng tạo, đạt hiệu quả cao trong lãnh đạo, chỉ đạo, tổ chức thực hiện nhiệm vụ; xây dựng cấp uỷ, tổ chức đảng trong sạch, vững mạnh, cơ quan, đơn vị vững mạnh toàn diện.',
          max_score: 1,
          subject_groups: ['leader'],
        },
        {
          code: '2.3',
          title:
            'Nói đi đôi với làm, dám nghĩ, dám làm, dám chịu trách nhiệm, dám đột phá vì lợi ích chung. Có khả năng phân tích, dự báo tình hình, phát hiện những khó khăn, bất cập, thời cơ, thuận lợi trong thực tiễn; đề xuất hoặc quyết định những giải pháp phù hợp, kịp thời, hiệu quả.',
          max_score: 1,
          subject_groups: ['leader'],
        },
        {
          code: '2.4',
          title:
            'Có khát vọng phấn đấu, cống hiến; có khả năng quy tụ và phát huy được sức mạnh của tập thể, cá nhân trong cơ quan, đơn vị và các cơ quan, đơn vị có liên quan.',
          max_score: 1,
          subject_groups: ['leader'],
        },
        {
          code: '2.1',
          title:
            'Có tư duy đổi mới, thích ứng với sự phát triển của thời đại và xu thế toàn cầu hoá; phương pháp làm việc khoa học, nhạy bén chính trị',
          max_score: 2,
          subject_groups: ['staff'],
        },
        {
          code: '2.2',
          title: 'Luôn bám sát thực tiễn, có nhiều cách làm hay, sáng tạo, đạt hiệu quả cao thực hiện nhiệm vụ',
          max_score: 1,
          subject_groups: ['staff'],
        },
        {
          code: '2.3',
          title:
            'Nói đi đôi với làm, dám nghĩ, dám làm, dám chịu trách nhiệm, dám đột phá vì lợi ích chung. Có khả năng phân tích, dự báo tình hình, phát hiện những khó khăn, bất cập, thời cơ, thuận lợi trong thực tiễn; kịp thời đề xuất những giải pháp phù hợp, kịp thời, hiệu quả.',
          max_score: 1,
          subject_groups: ['staff'],
        },
      ],
    },
    {
      code: '3',
      title: 'Về tự phê bình và phê bình, tự soi, tự sửa, khắc phục hạn chế, khuyết điểm',
      items: [
        [
          '3.1',
          'Chủ động, nghiêm túc thực hiện tự phê bình và phê bình, có tinh thần cầu thị và tiếp thu phản biện, góp ý.',
        ],
        ['3.2', 'Có kế hoạch rõ ràng và quyết liệt trong khắc phục hạn chế, khuyết điểm đã được chỉ ra.'],
        [
          '3.3',
          'Kết quả khắc phục hoàn thành từ ≥ 80% nội dung, có tiến bộ rõ, được tổ chức đánh giá tốt; không để tái diễn tồn tại.',
        ],
        ['3.4', 'Tự soi, tự sửa trên tinh thần trách nhiệm chính trị cao, không né tránh, không đổ lỗi.'],
      ].map(([code, title]) => ({ code, title, max_score: 2, subject_groups: BOTH })),
    },
  ],
};

const SUBJECT_GROUPS = [
  { code: 'leader', label: 'Lãnh đạo, quản lý' },
  { code: 'staff', label: 'Cán bộ, viên chức' },
];

// Bộ quy tắc 1: chấm từng việc theo tiến độ và kết quả, điểm chuẩn, hệ số độ khó; dùng cho cán bộ, công chức, viên chức
// trong hệ thống chính trị. Tham số do Eric cung cấp ngày 2026-10-19, nhập thành cấu hình
const RULE_SET_1 = {
  scoring_mode: 'progress_quality',
  total_max: 100,
  general: GENERAL_CRITERIA,
  task_part: { max: 70 },
  axes: [
    { code: '1', name: 'Thực hiện mục tiêu phát triển kinh tế - xã hội và nhiệm vụ chính trị được giao' },
    { code: '2', name: 'Hoàn thiện thể chế, đẩy mạnh phân cấp, phân quyền gắn với kiểm tra, giám sát' },
    { code: '3', name: 'Thúc đẩy phát triển khoa học, công nghệ, đổi mới sáng tạo và chuyển đổi số' },
    {
      code: '4',
      name: 'Xây dựng Đảng và hệ thống chính trị trong sạch, vững mạnh; giữ gìn đoàn kết, thống nhất nội bộ; phòng, chống tham nhũng, lãng phí, tiêu cực',
    },
    { code: '5', name: 'Phát triển văn hóa, con người, bảo đảm an sinh xã hội, nâng cao đời sống nhân dân' },
    {
      code: '6',
      name: 'Củng cố quốc phòng, an ninh, giữ vững ổn định chính trị - xã hội, nâng cao hiệu quả đối ngoại và hội nhập quốc tế',
    },
  ],
  task_types: [{ code: 'regular', name: 'Thường xuyên', standard_score: 10 }],
  difficulty_levels: [
    { code: '100', label: '100% - Việc thông thường', weight: 1 },
    { code: '110', label: '110% - Phối hợp nhiều đơn vị, khối lượng, chuyên môn cao hơn bình thường', weight: 1.1 },
    { code: '120', label: '120% - Việc trọng tâm, then chốt, phức tạp, có ảnh hưởng lớn', weight: 1.2 },
  ],
  weights: { progress: 30, quality: 70 },
  progress_levels: [
    { max_late_days: 0, percent: 100, label: 'Đúng hạn' },
    { max_late_days: 3, percent: 80, label: 'Chậm 1 đến 3 ngày làm việc' },
    { max_late_days: 5, percent: 60, label: 'Chậm 4 đến 5 ngày làm việc' },
    { max_late_days: null, percent: 0, label: 'Chậm trên 5 ngày làm việc hoặc không hoàn thành' },
  ],
  quality_levels: [
    {
      code: 'q100',
      label: 'Bảo đảm yêu cầu, được chấp nhận ngay hoặc chỉ hoàn thiện kỹ thuật, thể thức',
      percent: 100,
    },
    { code: 'q75', label: 'Cơ bản đáp ứng, chỉnh sửa một số nội dung không ảnh hưởng nội dung cốt lõi', percent: 75 },
    { code: 'q50', label: 'Chưa đáp ứng đầy đủ, chỉnh sửa nội dung cơ bản, ảnh hưởng chất lượng', percent: 50 },
    { code: 'q25', label: 'Có sai sót nghiêm trọng, phải chỉnh sửa cơ bản hoặc làm lại', percent: 25 },
    { code: 'q0', label: 'Không bảo đảm yêu cầu, không được chấp nhận', percent: 0 },
  ],
  result_levels: [],
  bonus: { rate_percent: 5, max_total: 7 },
  ranks: [
    {
      code: 'excellent',
      label: 'Hoàn thành xuất sắc nhiệm vụ',
      min_score: 90,
      require_all_on_time: true,
      min_exceeding_percent: 30,
    },
    { code: 'good', label: 'Hoàn thành tốt nhiệm vụ', min_score: 70, require_all_on_time: true },
    { code: 'pass', label: 'Hoàn thành nhiệm vụ', min_score: 50, max_zero_progress_percent: 20 },
    { code: 'fail', label: 'Không hoàn thành nhiệm vụ', min_score: 0 },
  ],
  exclusions: [
    { code: 'discipline', label: 'Bị xử lý kỷ luật trong kỳ đánh giá' },
    { code: 'degradation', label: 'Có biểu hiện suy thoái về tư tưởng chính trị, đạo đức, lối sống' },
    { code: 'corruption', label: 'Có hành vi tham nhũng, lãng phí, tiêu cực' },
    { code: 'unit_target', label: 'Đơn vị phụ trách không hoàn thành chỉ tiêu (người quản lý)' },
  ],
  excellent_quota: { percent: 20, base: 'good_or_better', exclude_heads: true, by_group: false },
  deadlines: { approval_days: 3, grading_days: 7, max_returns: 1 },
  subject_groups: SUBJECT_GROUPS,
  job_positions: [],
  indicator_targets: {},
  forms: ['task_sheet', 'self_evaluation', 'unit_summary'],
};

// Bộ quy tắc 2: viên chức trường công lập theo Nghị định 233/2026/NĐ-CP, chấm chỉ báo công việc của vị trí việc làm theo
// thang 6 mức. Mức 1,0 "vượt mức" tách khỏi 0,8 "đạt đầy đủ, đúng hạn" để giữ tỷ lệ xuất sắc; bốn mức còn lại, tên vị trí,
// mảng công việc do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, trường sửa trong cấu hình
const POSITIONS = [
  { code: 'gv-nha-tre', label: 'Giáo viên nhóm trẻ', levels: ['MN'], is_manager: false },
  { code: 'gv-mau-giao', label: 'Giáo viên lớp mẫu giáo', levels: ['MN'], is_manager: false },
  { code: 'nv-nau-an', label: 'Nhân viên nấu ăn', levels: ['MN', 'TH'], is_manager: false },
  { code: 'gv-tieu-hoc', label: 'Giáo viên tiểu học', levels: ['TH'], is_manager: false },
  { code: 'gv-thcs', label: 'Giáo viên trung học cơ sở', levels: ['THCS'], is_manager: false },
  { code: 'gv-thpt', label: 'Giáo viên trung học phổ thông', levels: ['THPT'], is_manager: false },
  { code: 'tpt-doi', label: 'Tổng phụ trách Đội', levels: ['TH', 'THCS'], is_manager: false },
  { code: 'bi-thu-doan', label: 'Bí thư Đoàn trường', levels: ['THPT'], is_manager: false },
  { code: 'nv-ban-tru', label: 'Nhân viên bán trú', levels: ['TH'], is_manager: false },
  { code: 'van-phong', label: 'Nhân viên văn phòng', levels: ['MN', 'TH', 'THCS', 'THPT'], is_manager: false },
  {
    code: 'to-truong',
    label: 'Tổ trưởng tổ chuyên môn, tổ văn phòng',
    levels: ['MN', 'TH', 'THCS', 'THPT'],
    is_manager: true,
  },
  {
    code: 'to-pho',
    label: 'Tổ phó tổ chuyên môn, tổ văn phòng',
    levels: ['MN', 'TH', 'THCS', 'THPT'],
    is_manager: true,
  },
  { code: 'quan-ly', label: 'Hiệu trưởng, Phó Hiệu trưởng', levels: ['MN', 'TH', 'THCS', 'THPT'], is_manager: true },
];

const RULE_SET_2 = {
  scoring_mode: 'level_scale',
  total_max: 100,
  general: GENERAL_CRITERIA,
  task_part: { max: 70 },
  axes: [
    { code: 'chuyen-mon', name: 'Nhiệm vụ theo vị trí việc làm' },
    { code: 'kiem-nhiem', name: 'Nhiệm vụ kiêm nhiệm, được giao thêm' },
    { code: 'quan-ly', name: 'Công tác quản lý (viên chức quản lý)' },
  ],
  task_types: [{ code: 'indicator', name: 'Chỉ báo công việc', standard_score: 10 }],
  difficulty_levels: [{ code: '100', label: '100%', weight: 1 }],
  weights: { progress: 0, quality: 100 },
  progress_levels: [],
  quality_levels: [],
  result_levels: [
    { code: 'exceed', label: 'Vượt mức yêu cầu', percent: 100, on_time: true, exceeded: true },
    { code: 'full', label: 'Đạt đầy đủ, đúng hạn', percent: 80, on_time: true },
    { code: 'late', label: 'Đạt đầy đủ nhưng chậm hạn', percent: 60 },
    { code: 'partial', label: 'Đạt một phần', percent: 40 },
    { code: 'low', label: 'Đạt thấp, phải làm lại', percent: 20 },
    { code: 'none', label: 'Không thực hiện', percent: 0, zero_progress: true },
  ],
  bonus: { rate_percent: 5, max_total: 7 },
  ranks: [
    { code: 'excellent', label: 'Hoàn thành xuất sắc nhiệm vụ', min_score: 90 },
    { code: 'good', label: 'Hoàn thành tốt nhiệm vụ', min_score: 70 },
    { code: 'pass', label: 'Hoàn thành nhiệm vụ', min_score: 50 },
    { code: 'fail', label: 'Không hoàn thành nhiệm vụ', min_score: 0 },
  ],
  exclusions: [{ code: 'discipline', label: 'Bị xử lý kỷ luật trong kỳ đánh giá' }],
  excellent_quota: { percent: 20, base: 'all', exclude_heads: false, by_group: true },
  deadlines: { approval_days: 3, grading_days: 7, max_returns: 1 },
  subject_groups: [
    { code: 'leader', label: 'Viên chức quản lý (gồm tổ trưởng, tổ phó)' },
    { code: 'staff', label: 'Viên chức' },
  ],
  job_positions: POSITIONS,
  indicator_targets: { MN: 48, TH: 65, THCS: 66, THPT: 66 },
  forms: ['task_sheet', 'self_evaluation', 'unit_summary', 'monthly_sheet', 'annual_sheet', 'regulation'],
};

const SCHOOL_LEVELS = `'MN', 'TH', 'THCS', 'THPT'`;

export const migration: Migration = {
  async up(database) {
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}, 'kpi_evidence'))`.execute(database);

    await database.schema
      .createTable('kpi_rule_sets')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) =>
        column
          .notNull()
          .unique()
          .check(sql`char_length(code) between 1 and 30`),
      )
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('description', 'text', (column) => column.check(sql`char_length(description) <= 1000`))
      .addColumn('is_default', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('active')
          .check(sql`status in ('active', 'inactive')`),
      )
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('kpi_rule_set_versions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('rule_set_id', 'uuid', (column) => column.notNull().references('kpi_rule_sets.id'))
      .addColumn('version_no', 'integer', (column) => column.notNull().check(sql`version_no >= 1`))
      .addColumn('config', 'jsonb', (column) => column.notNull())
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('draft')
          .check(sql`status in ('draft', 'published')`),
      )
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 1000`))
      .addColumn('published_at', 'timestamptz')
      .addColumn('published_by', 'uuid')
      .addColumn('published_by_name', 'text')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('kpi_rule_set_versions_number_unique', ['rule_set_id', 'version_no'])
      .execute();

    await database.schema
      .createTable('kpi_profiles')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().unique().references('staff.id'))
      .addColumn('rule_set_id', 'uuid', (column) => column.notNull().references('kpi_rule_sets.id'))
      .addColumn('subject_group', 'text', (column) =>
        column
          .notNull()
          .defaultTo('staff')
          .check(sql`subject_group in ('leader', 'staff')`),
      )
      .addColumn('school_level', 'text', (column) => column.check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)))
      .addColumn('job_position', 'text', (column) => column.check(sql`char_length(job_position) <= 50`))
      .addColumn('is_head', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('superior_staff_id', 'uuid', (column) => column.references('staff.id'))
      .addColumn('excluded', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('kpi_periods')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) =>
        column
          .notNull()
          .unique()
          .check(sql`char_length(code) between 1 and 30`),
      )
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('period_type', 'text', (column) =>
        column.notNull().check(sql`period_type in ('month', 'quarter', 'term', 'year', 'custom')`),
      )
      .addColumn('start_date', 'date', (column) => column.notNull())
      .addColumn('end_date', 'date', (column) => column.notNull())
      // Lịch kỳ: đăng ký và thực hiện, tự đánh giá, cấp trên đánh giá, tham mưu tổng hợp
      .addColumn('register_from', 'date')
      .addColumn('register_to', 'date')
      .addColumn('self_from', 'date')
      .addColumn('self_to', 'date')
      .addColumn('review_from', 'date')
      .addColumn('review_to', 'date')
      .addColumn('advisory_from', 'date')
      .addColumn('advisory_to', 'date')
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('open')
          .check(sql`status in ('open', 'locked')`),
      )
      .addColumn('locked_at', 'timestamptz')
      .addColumn('locked_by', 'uuid')
      .addColumn('locked_by_name', 'text')
      .addColumn('lock_note', 'text', (column) => column.check(sql`char_length(lock_note) <= 1000`))
      .addColumn('legacy_id', 'text')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('kpi_periods_dates_check', sql`start_date <= end_date`)
      .execute();

    await database.schema
      .createTable('kpi_period_rule_versions')
      .addColumn('period_id', 'uuid', (column) => column.notNull().references('kpi_periods.id').onDelete('cascade'))
      .addColumn('rule_set_id', 'uuid', (column) => column.notNull().references('kpi_rule_sets.id'))
      .addColumn('rule_set_version_id', 'uuid', (column) => column.notNull().references('kpi_rule_set_versions.id'))
      .addPrimaryKeyConstraint('kpi_period_rule_versions_primary_key', ['period_id', 'rule_set_id'])
      .execute();

    await database.schema
      .createTable('kpi_catalog_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      // Trống là danh mục chung của trường; có đơn vị là danh mục của đơn vị đó
      .addColumn('org_unit_id', 'uuid', (column) => column.references('org_units.id'))
      .addColumn('rule_set_id', 'uuid', (column) => column.references('kpi_rule_sets.id'))
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 30`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 1000`))
      .addColumn('output_result', 'text', (column) => column.check(sql`char_length(output_result) <= 500`))
      .addColumn('axis_code', 'text', (column) => column.notNull())
      .addColumn('task_type', 'text', (column) => column.notNull())
      .addColumn('difficulty_code', 'text', (column) => column.notNull())
      .addColumn('expected_evidence', 'text', (column) => column.check(sql`char_length(expected_evidence) <= 500`))
      .addColumn('deadline_hint', 'text', (column) => column.check(sql`char_length(deadline_hint) <= 200`))
      .addColumn('school_level', 'text', (column) => column.check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)))
      .addColumn('job_position', 'text', (column) => column.check(sql`char_length(job_position) <= 50`))
      // Nhiệm vụ đánh dấu (*) bắt buộc đăng ký; nội dung mật chỉ ghi mã hoặc số văn bản
      .addColumn('is_required', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('is_confidential', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('active')
          .check(sql`status in ('active', 'inactive', 'proposed', 'rejected')`),
      )
      .addColumn('proposed_by', 'uuid')
      .addColumn('proposed_by_name', 'text')
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_by_name', 'text')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('decision_note', 'text', (column) => column.check(sql`char_length(decision_note) <= 500`))
      .addColumn('legacy_id', 'text')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await sql`create unique index kpi_catalog_items_code_unique
      on kpi_catalog_items (coalesce(org_unit_id, '00000000-0000-0000-0000-000000000000'::uuid), code)
      where status <> 'rejected'`.execute(database);

    await database.schema
      .createTable('kpi_tasks')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('period_id', 'uuid', (column) => column.notNull().references('kpi_periods.id'))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('catalog_item_id', 'uuid', (column) => column.references('kpi_catalog_items.id'))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 1000`))
      .addColumn('output_result', 'text', (column) => column.check(sql`char_length(output_result) <= 500`))
      .addColumn('axis_code', 'text', (column) => column.notNull())
      .addColumn('task_type', 'text', (column) => column.notNull())
      .addColumn('standard_score', 'numeric(6, 2)', (column) => column.notNull().check(sql`standard_score > 0`))
      .addColumn('difficulty_code', 'text', (column) => column.notNull())
      .addColumn('difficulty_weight', 'numeric(5, 2)', (column) => column.notNull().check(sql`difficulty_weight > 0`))
      .addColumn('is_confidential', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('origin', 'text', (column) =>
        column.notNull().check(sql`origin in ('assigned', 'registered', 'arising', 'legacy')`),
      )
      // Việc thuộc danh mục đầu kỳ thì tính vào A; việc phát sinh chỉ tính vào B
      .addColumn('in_plan', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .check(
            sql`status in ('pending_approval', 'assigned', 'returned_to_assigner', 'in_progress', 'self_assessed', 'rework', 'graded', 'rejected', 'cancelled')`,
          ),
      )
      .addColumn('deadline', 'date', (column) => column.notNull())
      .addColumn('original_deadline', 'date', (column) => column.notNull())
      .addColumn('assigned_by_staff_id', 'uuid', (column) => column.references('staff.id'))
      .addColumn('assigned_by_name', 'text')
      // Người chấm được ủy quyền (vượt cấp); trống thì người giao hoặc người quản lý trong phạm vi chấm
      .addColumn('evaluator_staff_id', 'uuid', (column) => column.references('staff.id'))
      .addColumn('delegated_by', 'uuid')
      .addColumn('delegated_by_name', 'text')
      .addColumn('delegated_at', 'timestamptz')
      .addColumn('delegation_note', 'text', (column) => column.check(sql`char_length(delegation_note) <= 500`))
      .addColumn('approval_due_at', 'timestamptz')
      .addColumn('approved_at', 'timestamptz')
      .addColumn('approved_by_name', 'text')
      .addColumn('auto_approved', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('decision_note', 'text', (column) => column.check(sql`char_length(decision_note) <= 500`))
      .addColumn('return_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('return_reason', 'text', (column) => column.check(sql`char_length(return_reason) <= 500`))
      // Gia hạn: xin trước hạn, cấp trên duyệt thì tính theo hạn mới
      .addColumn('requested_deadline', 'date')
      .addColumn('extension_reason', 'text', (column) => column.check(sql`char_length(extension_reason) <= 500`))
      .addColumn('extension_status', 'text', (column) =>
        column.check(sql`extension_status in ('pending', 'approved', 'rejected')`),
      )
      // Minh chứng: mô tả, số ký hiệu văn bản (chữ tự do), tệp đính kèm
      .addColumn('actual_finish_date', 'date')
      .addColumn('evidence_text', 'text', (column) => column.check(sql`char_length(evidence_text) <= 2000`))
      .addColumn('document_number', 'text', (column) => column.check(sql`char_length(document_number) <= 200`))
      .addColumn('self_quality_code', 'text')
      .addColumn('self_result_code', 'text')
      .addColumn('self_assessed_at', 'timestamptz')
      .addColumn('bonus_proposed', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('bonus_reason', 'text', (column) => column.check(sql`char_length(bonus_reason) <= 500`))
      .addColumn('grading_due_at', 'timestamptz')
      // Kết quả chấm
      .addColumn('late_days', 'integer')
      .addColumn('progress_percent', 'numeric(5, 2)')
      .addColumn('progress_adjust_reason', 'text', (column) =>
        column.check(sql`char_length(progress_adjust_reason) <= 500`),
      )
      .addColumn('quality_code', 'text')
      .addColumn('result_code', 'text')
      .addColumn('task_percent', 'numeric(5, 2)')
      .addColumn('exceeded', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('bonus_approved', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('execution_score', 'numeric(7, 2)')
      .addColumn('converted_score', 'numeric(7, 2)')
      .addColumn('bonus_score', 'numeric(7, 2)')
      .addColumn('grader_comment', 'text', (column) => column.check(sql`char_length(grader_comment) <= 1000`))
      .addColumn('graded_at', 'timestamptz')
      .addColumn('graded_by', 'uuid')
      .addColumn('graded_by_name', 'text')
      .addColumn('auto_graded', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('rework_reason', 'text', (column) => column.check(sql`char_length(rework_reason) <= 500`))
      .addColumn('legacy_id', 'text')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('kpi_tasks_period_staff')
      .on('kpi_tasks')
      .columns(['period_id', 'staff_id'])
      .execute();

    await database.schema
      .createTable('kpi_task_files')
      .addColumn('task_id', 'uuid', (column) => column.notNull().references('kpi_tasks.id').onDelete('cascade'))
      .addColumn('file_id', 'uuid', (column) => column.notNull().references('files.id'))
      .addColumn('uploaded_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('kpi_task_files_primary_key', ['task_id', 'file_id'])
      .execute();

    await database.schema
      .createTable('kpi_evaluations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('period_id', 'uuid', (column) => column.notNull().references('kpi_periods.id'))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('rule_set_version_id', 'uuid', (column) => column.notNull().references('kpi_rule_set_versions.id'))
      .addColumn('subject_group', 'text', (column) => column.notNull().check(sql`subject_group in ('leader', 'staff')`))
      .addColumn('is_head', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('draft')
          .check(sql`status in ('draft', 'submitted', 'returned', 'concluded')`),
      )
      .addColumn('general_self', 'numeric(6, 2)', (column) => column.notNull().defaultTo(0))
      .addColumn('general_score', 'numeric(6, 2)', (column) => column.notNull().defaultTo(0))
      .addColumn('plan_max', 'numeric(8, 2)', (column) => column.notNull().defaultTo(0))
      .addColumn('actual_total', 'numeric(8, 2)', (column) => column.notNull().defaultTo(0))
      .addColumn('task_score', 'numeric(6, 2)', (column) => column.notNull().defaultTo(0))
      .addColumn('bonus_score', 'numeric(6, 2)', (column) => column.notNull().defaultTo(0))
      .addColumn('total_score', 'numeric(6, 2)', (column) => column.notNull().defaultTo(0))
      .addColumn('suggested_rank', 'text')
      .addColumn('self_rank', 'text')
      .addColumn('self_comment', 'text', (column) => column.check(sql`char_length(self_comment) <= 2000`))
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('return_reason', 'text', (column) => column.check(sql`char_length(return_reason) <= 1000`))
      .addColumn('exclusions', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('exclusion_note', 'text', (column) => column.check(sql`char_length(exclusion_note) <= 1000`))
      .addColumn('superior_rank', 'text')
      .addColumn('superior_comment', 'text', (column) => column.check(sql`char_length(superior_comment) <= 2000`))
      .addColumn('superior_by', 'uuid')
      .addColumn('superior_by_name', 'text')
      .addColumn('superior_at', 'timestamptz')
      .addColumn('advisory_rank', 'text')
      .addColumn('advisory_comment', 'text', (column) => column.check(sql`char_length(advisory_comment) <= 2000`))
      .addColumn('advisory_by_name', 'text')
      .addColumn('advisory_at', 'timestamptz')
      .addColumn('final_rank', 'text')
      .addColumn('legacy_id', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('kpi_evaluations_period_staff_unique', ['period_id', 'staff_id'])
      .execute();

    await database.schema
      .createTable('kpi_evaluation_criteria')
      .addColumn('evaluation_id', 'uuid', (column) =>
        column.notNull().references('kpi_evaluations.id').onDelete('cascade'),
      )
      .addColumn('criterion_code', 'text', (column) => column.notNull())
      .addColumn('max_score', 'numeric(5, 2)', (column) => column.notNull())
      .addColumn('self_satisfied', 'boolean', (column) => column.notNull().defaultTo(true))
      // Cấp trên điều chỉnh; trống là giữ kết quả tự đánh giá
      .addColumn('superior_satisfied', 'boolean')
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 500`))
      .addPrimaryKeyConstraint('kpi_evaluation_criteria_primary_key', ['evaluation_id', 'criterion_code'])
      .execute();

    await database.schema
      .createTable('kpi_votes')
      .addColumn('evaluation_id', 'uuid', (column) =>
        column.notNull().references('kpi_evaluations.id').onDelete('cascade'),
      )
      .addColumn('voter_user_id', 'uuid', (column) => column.notNull())
      .addColumn('voter_name', 'text', (column) => column.notNull())
      .addColumn('vote_rank', 'text', (column) => column.notNull())
      .addColumn('comment', 'text', (column) => column.check(sql`char_length(comment) <= 500`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('kpi_votes_primary_key', ['evaluation_id', 'voter_user_id'])
      .execute();

    await database.schema
      .createTable('kpi_manager_actions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('period_id', 'uuid', (column) => column.notNull().references('kpi_periods.id'))
      .addColumn('task_id', 'uuid', (column) => column.references('kpi_tasks.id').onDelete('cascade'))
      .addColumn('action', 'text', (column) => column.notNull().check(sql`action in ('approve', 'grade')`))
      // Người phải làm; trống khi chưa xác định được người quản lý
      .addColumn('manager_staff_id', 'uuid', (column) => column.references('staff.id'))
      .addColumn('manager_name', 'text')
      .addColumn('due_at', 'timestamptz', (column) => column.notNull())
      .addColumn('done_at', 'timestamptz', (column) => column.notNull())
      .addColumn('on_time', 'boolean', (column) => column.notNull())
      .addColumn('automatic', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    // Hai bộ quy tắc mặc định, mỗi bộ một phiên bản đã ban hành
    for (const [code, name, description, isDefault, config] of [
      [
        'BQT-1',
        'Bộ quy tắc 1',
        'Chấm từng việc theo tiến độ và kết quả, điểm chuẩn và hệ số độ khó; dùng cho cán bộ, công chức, viên chức trong hệ thống chính trị',
        false,
        RULE_SET_1,
      ],
      [
        'BQT-2',
        'Bộ quy tắc 2',
        'Chấm chỉ báo công việc theo vị trí việc làm, thang 6 mức; mặc định cho viên chức trường công lập theo Nghị định 233/2026/NĐ-CP',
        true,
        RULE_SET_2,
      ],
    ] as const) {
      const ruleSet = await sql<{ id: string }>`insert into kpi_rule_sets (code, name, description, is_default)
        values (${code}, ${name}, ${description}, ${isDefault}) returning id`.execute(database);
      await sql`insert into kpi_rule_set_versions (rule_set_id, version_no, config, status, note, published_at, published_by_name)
        values (${ruleSet.rows[0]?.id}, 1, ${JSON.stringify(config)}::jsonb, 'published', 'Phiên bản mặc định', now(), 'Hệ thống')`.execute(
        database,
      );
    }
  },
  async down(database) {
    for (const table of [
      'kpi_manager_actions',
      'kpi_votes',
      'kpi_evaluation_criteria',
      'kpi_evaluations',
      'kpi_task_files',
      'kpi_tasks',
      'kpi_catalog_items',
      'kpi_period_rule_versions',
      'kpi_periods',
      'kpi_profiles',
      'kpi_rule_set_versions',
      'kpi_rule_sets',
    ]) {
      await database.schema.dropTable(table).execute();
    }
    await sql`delete from files where purpose = 'kpi_evidence'`.execute(database);
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}))`.execute(database);
  },
};
