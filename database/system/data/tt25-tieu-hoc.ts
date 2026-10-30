// Biểu 02.ĐN-TH, 02.CN-TH theo Thông tư 25/2024/TT-BGDĐT (YCTD-385 lát L1), chép từ bản PDF gốc trên Cổng văn bản Chính
// phủ (`tai_lieu/ban_mau/yctd-385/BIEU_02_TIEU_HOC.md`). Mỗi dòng: mã số đúng bản in, tên chỉ tiêu nguyên văn (có số thứ tự
// TT ở đầu khi bản in có), đơn vị tính, cách lấy số: công thức theo `packages/shared/src/primary-reports.ts`, `manual` (trường
// nhập vì hệ thống chưa có nguồn hoặc nguồn ở cấp trên), `heading` (dòng chữ không có số). Dòng chữ không có mã số trong bản in
// dùng mã `T<số>`. Chỗ nghi lỗi in giữ đúng bản in, ghi ở `note` của biểu. Dùng cho database migration hệ thống 0134; không
// sửa sau khi migration đã chạy (biểu mới thì thêm tệp và migration mới)

export type Tt25Row = [code: string, label: string, unit: string | null, source: string];

export interface Tt25Section {
  code: string;
  name: string;
  columns: Array<{ key: string; label: string; public_only?: boolean }>;
  rows: Tt25Row[];
}

export interface Tt25Form {
  code: string;
  form_number: string;
  name: string;
  school_level: 'TH' | 'THCS' | 'THPT';
  period: 'start_of_year' | 'end_of_year';
  note: string;
  sections: Tt25Section[];
}

export const COUNT_COLUMNS = [{ key: 'total', label: 'Số lượng' }];
export const PEOPLE_COLUMNS = [
  { key: 'total', label: 'Tổng số' },
  { key: 'female', label: 'Nữ' },
  { key: 'ethnic', label: 'Dân tộc thiểu số: Tổng số' },
  { key: 'ethnic_female', label: 'Dân tộc thiểu số: Nữ' },
];
export const STAFF_COLUMNS = [
  { key: 'total', label: 'Tổng số' },
  { key: 'indefinite', label: 'Viên chức: HĐLV không xác định thời hạn', public_only: true },
  { key: 'fixed_term', label: 'Viên chức: HĐLV xác định thời hạn', public_only: true },
  { key: 'labor_contract', label: 'Hợp đồng lao động', public_only: true },
  { key: 'female', label: 'Nữ' },
  { key: 'ethnic', label: 'Dân tộc thiểu số: Tổng số' },
  { key: 'ethnic_female', label: 'Dân tộc thiểu số: Nữ' },
];
export const ROOM_COLUMNS = [
  { key: 'total', label: 'Tổng số' },
  { key: 'permanent', label: 'Kiên cố' },
  { key: 'semi_permanent', label: 'Bán kiên cố' },
  { key: 'temporary', label: 'Tạm' },
];

const M = 'manual';
const H = 'heading';
const grades = ['K1', 'K2', 'K3', 'K4', 'K5'];

// Học sinh theo lớp và tuổi của 02.ĐN-TH: [mã dòng lớp, tuổi đầu, tuổi cuối, mã dòng đầu tiên của tuổi, mã dòng lưu ban]
const AGE_BLOCKS: Array<[number, number, number, number, number]> = [
  [30, 5, 9, 31, 39],
  [40, 6, 10, 41, 47],
  [48, 7, 12, 49, 56],
  [57, 8, 14, 58, 66],
  [67, 9, 15, 68, 76],
];
const code = (value: number) => String(value).padStart(2, '0');

function studentsByGradeAndAge(): Tt25Row[] {
  const rows: Tt25Row[] = [];
  AGE_BLOCKS.forEach(([gradeRow, from, to, firstAge, repeaterRow], index) => {
    const grade = grades[index]!;
    rows.push([code(gradeRow), `- Học sinh lớp ${index + 1}`, 'người', `students.grade=${grade}`]);
    for (let age = from; age <= to; age += 1) {
      rows.push([code(firstAge + age - from), `+ ${age} tuổi`, 'người', `students.grade=${grade}.age=${age}`]);
    }
    rows.push([
      code(firstAge + to - from + 1),
      '+ ... (tuổi khác, tính các tuổi lớn hơn)',
      'người',
      `students.grade=${grade}.age_over=${to}`,
    ]);
    rows.push([`T3${index}`, 'Trong đó:', null, H]);
    if (index === 0) {
      rows.push(['37', '+ Học sinh mới tuyển đầu cấp', 'người', 'students.grade=K1.new_entrant']);
      rows.push(['38', '+ Học sinh 6 tuổi vào lớp 1', 'người', 'students.grade=K1.new_entrant.age=6']);
    }
    rows.push([code(repeaterRow), '+ Học sinh lưu ban', 'người', `students.grade=${grade}.repeater`]);
  });
  return rows;
}

function studentsByAge(): Tt25Row[] {
  const rows: Tt25Row[] = [['77', '- Tổng quy mô chia theo độ tuổi', 'người', 'students']];
  for (let age = 5; age <= 15; age += 1) {
    rows.push([code(78 + age - 5), `+ ${age} tuổi`, 'người', `students.age=${age}`]);
  }
  rows.push(['89', '+ ... (tuổi khác, tính các tuổi lớn hơn)', 'người', 'students.age_over=15']);
  return rows;
}

// Trình độ đào tạo: hồ sơ chưa tách "sư phạm" với "có chứng chỉ bồi dưỡng nghiệp vụ sư phạm" nên các dòng này nhập tay
const QUALIFICATION_LABELS = [
  '- Cao đẳng sư phạm',
  '- Cao đẳng và có chứng chỉ BDNVSP',
  '- Đại học sư phạm',
  '- Đại học và có chứng chỉ BDNVSP',
  '- Thạc sĩ KHGD&ĐTGV',
  '- Thạc sĩ và có chứng chỉ BDNVSP',
  '- Tiến sĩ, Tiến sĩ khoa học',
  '- Khác',
];
const qualifications = (first: number): Tt25Row[] =>
  QUALIFICATION_LABELS.map((label, index) => [String(first + index), label, 'người', M]);

const SHARED_JOBS: Array<[string, string]> = [
  ['- Thư viện', 'library'],
  ['- Quản trị công sở', 'office_management'],
  ['- Kế toán', 'accounting'],
  ['- Thủ quỹ', 'treasurer'],
  ['- Văn thư', 'clerical'],
  ['- Y tế trường học', 'health'],
  ['- Công nghệ thông tin, an toàn thông tin', 'information_technology'],
];
const SUPPORT_JOBS: Array<[string, string]> = [
  ['- Nhân viên bảo vệ', 'security'],
  ['- Nhân viên nấu ăn', 'cook'],
  ['- Nhân viên phục vụ', 'service'],
  ['- Nhân viên khác', 'other_staff'],
];
const range = (from: number, count: number) => Array.from({ length: count }, (_, index) => String(from + index));

// Vị trí việc làm chuyên môn dùng chung, hỗ trợ phục vụ từ mã `shared` (dòng tổng), dùng chung cho đầu năm và cuối năm
function staffJobs(shared: number, concurrentLabel: string): Tt25Row[] {
  const support = shared + SHARED_JOBS.length + 2;
  return [
    [
      String(shared),
      '4.3. Vị trí việc làm chuyên môn dùng chung',
      'người',
      `rows:${range(shared + 1, SHARED_JOBS.length).join('+')}`,
    ],
    ['T40', 'Chia ra:', null, H],
    ...SHARED_JOBS.map(([label, job], index): Tt25Row => [
      String(shared + 1 + index),
      label,
      'người',
      `staff.job=${job}`,
    ]),
    [String(shared + SHARED_JOBS.length + 1), concurrentLabel, 'người', M],
    [
      String(support),
      '4.4. Vị trí việc làm hỗ trợ, phục vụ',
      'người',
      `rows:${range(support + 1, SUPPORT_JOBS.length).join('+')}`,
    ],
    ['T41', 'Chia ra:', null, H],
    ...SUPPORT_JOBS.map(([label, job], index): Tt25Row => [
      String(support + 1 + index),
      label,
      'người',
      `staff.job=${job}`,
    ]),
  ];
}

export const TT25_TIEU_HOC: Tt25Form[] = [
  {
    code: 'tt25-02-dn-th',
    form_number: '02.ĐN-TH',
    name: 'Biểu 02.ĐN-TH: Báo cáo thống kê giáo dục tiểu học (đầu năm học)',
    school_level: 'TH',
    period: 'start_of_year',
    note: 'Theo Thông tư 25/2024/TT-BGDĐT, có tại ngày 30/9, Sở nhận ngày 31/10. Bản in có hai dòng "Lớp ghép" (mã 27, 28), giữ đúng bản in; dòng 28 nhập tay. Tuổi tính theo năm sinh.',
    sections: [
      {
        code: 'truong',
        name: 'I. Trường',
        columns: COUNT_COLUMNS,
        rows: [
          ['01', '1.1. Tổng số', 'trường', 'school'],
          ['T01', 'Trong đó:', null, H],
          ['02', '- Trường đạt chuẩn quốc gia mức độ 1', 'trường', 'school.standard_1'],
          ['03', '- Trường đạt chuẩn quốc gia mức độ 2', 'trường', 'school.standard_2'],
          ['04', '- Trường dạy học 2 buổi trong ngày', 'trường', M],
          ['05', '- Trường phổ thông dân tộc bán trú tiểu học', 'trường', M],
          ['06', '- Trường có tổ chức học trực tuyến', 'trường', M],
          ['07', '- Trường có điện', 'trường', 'school.electricity'],
          ['08', '- Trường có internet dùng cho mục đích học tập, giảng dạy', 'trường', 'school.internet'],
          ['09', '- Trường có máy tính dùng cho mục đích học tập', 'trường', 'school.computers'],
          ['10', '- Trường có cơ sở hạ tầng và tài liệu phù hợp với học sinh khuyết tật', 'trường', M],
          ['11', '- Trường có nước uống', 'trường', 'school.drinking_water'],
          [
            '12',
            '- Trường có hệ thống vệ sinh tiện lợi và riêng rẽ cho từng giới tính',
            'trường',
            'school.separate_toilets',
          ],
          ['13', '- Trường có chỗ rửa tay thuận tiện (bao gồm nước và xà phòng)', 'trường', 'school.handwashing'],
          [
            '14',
            '- Trường có chương trình giáo dục cơ bản về giới tính, phòng chống bạo lực, xâm hại; cung cấp kiến thức về HIV',
            'trường',
            'school.sex_education',
          ],
          ['15', '- Trường có bộ phận làm công tác tư vấn tâm lý học đường', 'trường', M],
          [
            '16',
            '- Trường có kế hoạch giáo dục phòng, chống thiên tai và ứng phó biến đổi khí hậu',
            'trường',
            'school.disaster_plan',
          ],
          ['17', '1.2. Số điểm trường', 'điểm', 'sites'],
        ],
      },
      {
        code: 'lop',
        name: 'II. Lớp',
        columns: COUNT_COLUMNS,
        rows: [
          ['18', 'Tổng số', 'lớp', 'classes'],
          ['T02', 'Chia ra:', null, H],
          ...grades.map((grade, index): Tt25Row => [
            String(19 + index),
            `- Lớp ${index + 1}`,
            'lớp',
            `classes.grade=${grade}`,
          ]),
          ['T03', 'Trong đó:', null, H],
          ['24', '- Lớp học 2 buổi/ngày', 'lớp', 'classes.two_sessions'],
          ['25', '- Lớp tiểu học trong trường phổ thông dân tộc bán trú', 'lớp', M],
          ['26', '- Lớp tiểu học trong trường phổ thông nhiều cấp học', 'lớp', 'classes.multi_level'],
          ['27', '- Lớp ghép', 'lớp', 'classes.multigrade'],
          ['28', '- Lớp ghép (bản in lặp tên dòng 27)', 'lớp', M],
        ],
      },
      {
        code: 'hoc_sinh',
        name: 'III. Học sinh',
        columns: PEOPLE_COLUMNS,
        rows: [
          ['29', '3.1. Tổng quy mô', 'người', 'students'],
          ['T04', '3.2. Quy mô chia ra theo lớp và theo tuổi', null, H],
          ...studentsByGradeAndAge(),
          ...studentsByAge(),
          ['T05', '3.3. Trong tổng quy mô có:', null, H],
          [
            '90',
            '- Tổng số học sinh lưu ban năm học trước đang học lại trong năm học này',
            'người',
            'students.repeater',
          ],
          ['91', '- Học sinh học 2 buổi/ngày', 'người', 'students.two_sessions'],
          ['92', '- Học sinh dân tộc học bán trú', 'người', 'students.ethnic_boarding'],
          ['93', '- Học sinh khuyết tật học hòa nhập', 'người', 'students.disabled'],
          ['T06', 'Chia ra:', null, H],
          ['94', '+ Khuyết tật về nhìn', 'người', 'students.disability=vision'],
          ['95', '+ Khuyết tật về nghe, nói', 'người', 'students.disability=hearing_speech'],
          ['96', '+ Khuyết tật về trí tuệ', 'người', 'students.disability=intellectual'],
          ['97', '+ Khuyết tật về vận động', 'người', 'students.disability=mobility'],
          ['98', '+ Khuyết tật thần kinh, tâm thần', 'người', 'students.disability=neuro_mental'],
          ['99', '+ Khuyết tật khác', 'người', 'students.disability=other'],
          ['100', '3.4. Học sinh thuộc đối tượng chính sách (theo quy định của Chính phủ)', 'người', M],
          ['101', '3.4.1. Học sinh được hỗ trợ chi phí học tập', 'người', M],
          ['102', '3.4.2. Học sinh dân tộc thiểu số rất ít người được hỗ trợ học tập', 'người', M],
          ['103', '3.4.3. Học sinh được hỗ trợ tiền ăn, tiền nhà ở và gạo', 'người', M],
        ],
      },
      {
        code: 'doi_ngu',
        name: 'IV. Đội ngũ',
        columns: STAFF_COLUMNS,
        rows: [
          ['104', 'Tổng số', 'người', 'staff'],
          ['105', '4.1. Cán bộ quản lý', 'người', 'staff.manager'],
          ['T07', 'Chia ra', null, H],
          ['106', '- Hiệu trưởng', 'người', 'staff.principal'],
          ['107', '- Phó hiệu trưởng', 'người', 'staff.vice_principal'],
          ['T08', 'Chia theo trình độ đào tạo', null, H],
          ...qualifications(108),
          ['116', '4.2. Vị trí việc làm chức danh nghề nghiệp chuyên ngành', 'người', 'rows:117+138+139+140'],
          ['117', '4.2.1. Giáo viên', 'người', 'staff.teacher'],
          ['T09', 'Chia theo trình độ đào tạo', null, H],
          ...qualifications(118),
          ['T10', 'Chia theo chức danh nghề nghiệp', null, H],
          ['126', '- Giáo viên tiểu học hạng I', 'người', 'staff.teacher.rank=1'],
          ['127', '- Giáo viên tiểu học hạng II', 'người', 'staff.teacher.rank=2'],
          ['128', '- Giáo viên tiểu học hạng III', 'người', 'staff.teacher.rank=3'],
          ['T11', 'Chia theo độ tuổi', null, H],
          ['129', '- Từ 20 - 29 tuổi', 'người', 'staff.teacher.age_band=20_29'],
          ['130', '- Từ 30 - 39 tuổi', 'người', 'staff.teacher.age_band=30_39'],
          ['131', '- Từ 40 - 49 tuổi', 'người', 'staff.teacher.age_band=40_49'],
          ['132', '- Từ 50 - 59 tuổi', 'người', 'staff.teacher.age_band=50_59'],
          ['133', '- ≥ 60 tuổi', 'người', 'staff.teacher.age_band=60'],
          ['T12', 'Trong đó:', null, H],
          ['134', '- GV Tổng phụ trách Đội TNTP HCM', 'người', M],
          ['135', '- Kiêm nhiệm làm giáo vụ', 'người', M],
          ['136', '- Kiêm nhiệm làm tư vấn học sinh', 'người', M],
          ['137', '- Kiêm nhiệm làm hỗ trợ giáo dục người khuyết tật', 'người', M],
          ['138', '4.2.2. Giáo vụ', 'người', 'staff.job=academic_affairs'],
          ['139', '4.2.3. Tư vấn học sinh', 'người', 'staff.job=counselor'],
          ['140', '4.2.4. Hỗ trợ giáo dục người khuyết tật', 'người', 'staff.job=disability_support'],
          ...staffJobs(141, '- Kiêm nhiệm 2 hoặc 3 VTVL chuyên môn dùng chung'),
        ],
      },
      {
        code: 'phong_hoc',
        name: 'V. Phòng học tập',
        columns: ROOM_COLUMNS,
        rows: [
          ['155', 'Tổng số', 'phòng', 'rows:156+158+164'],
          ['156', '5.1. Phòng học', 'phòng', 'rooms.classroom'],
          ['157', 'Trong đó phòng học nhờ, mượn (nếu có)', 'phòng', 'rooms.classroom.borrowed'],
          ['158', '5.2. Phòng học bộ môn', 'phòng', 'rows:159+160+161+162+163'],
          ['159', '- Âm nhạc', 'phòng', M],
          ['160', '- Mỹ thuật', 'phòng', M],
          ['161', '- Khoa học - công nghệ', 'phòng', M],
          ['162', '- Tin học', 'phòng', M],
          ['163', '- Ngoại ngữ', 'phòng', M],
          ['164', '5.3. Phòng đa chức năng', 'phòng', 'rooms.multi_purpose'],
        ],
      },
    ],
  },
  {
    code: 'tt25-02-cn-th',
    form_number: '02.CN-TH',
    name: 'Biểu 02.CN-TH: Báo cáo thống kê giáo dục tiểu học (cuối năm học)',
    school_level: 'TH',
    period: 'end_of_year',
    note: 'Theo Thông tư 25/2024/TT-BGDĐT, có tại ngày 31/5, Sở nhận ngày 30/6. Bản in đặt mã 02 trên dòng "Trong đó:", giữ đúng bản in. Tuổi tính theo năm sinh.',
    sections: [
      {
        code: 'truong',
        name: 'I. Trường',
        columns: COUNT_COLUMNS,
        rows: [
          ['01', '1.1. Tổng số trường', 'trường', 'school'],
          ['02', 'Trong đó: (bản in ghi mã 02)', 'trường', M],
          ['03', '- Số trường sáp nhập', 'trường', M],
          ['04', '- Số trường giải thể', 'trường', M],
          ['05', '- Số trường chia tách', 'trường', M],
          ['06', '- Số trường thành lập mới', 'trường', M],
          ['07', '1.2. Số điểm trường', 'điểm', 'sites'],
        ],
      },
      {
        code: 'lop',
        name: 'II. Lớp',
        columns: COUNT_COLUMNS,
        rows: [
          ['08', 'Tổng số lớp', 'lớp', 'classes'],
          ['T02', 'Chia ra:', null, H],
          ...grades.map((grade, index): Tt25Row => [
            code(9 + index),
            `- Lớp ${index + 1}`,
            'lớp',
            `classes.grade=${grade}`,
          ]),
          ['T03', 'Trong đó:', null, H],
          ['14', '- Lớp học 2 buổi/ngày', 'lớp', 'classes.two_sessions'],
          ['15', '- Lớp ghép', 'lớp', 'classes.multigrade'],
        ],
      },
      {
        code: 'hoc_sinh',
        name: 'III. Học sinh',
        columns: PEOPLE_COLUMNS,
        rows: [
          ['T04', '3.1. Biến động trong năm học', null, H],
          ['16', '- Học sinh chuyển đến từ tỉnh/tp khác', 'người', 'students.transfer_in_province'],
          ['17', '- Học sinh chuyển đi ngoài địa bàn tỉnh/tp', 'người', 'leavers.transfer_out_province'],
          ['18', '- Học sinh chuyển đi ra ngoài quốc gia', 'người', M],
          ['19', '- Học sinh bỏ học', 'người', 'leavers.dropout'],
          ['20', '3.2. Tổng quy mô', 'người', 'students'],
          ['T05', '3.3. Quy mô chia theo lớp', null, H],
          ...grades.map((grade, index): Tt25Row => [
            String(21 + index),
            `- Học sinh lớp ${index + 1}`,
            'người',
            `students.grade=${grade}`,
          ]),
          ['26', '3.4. Học sinh học lại, thi lại trong hè', 'người', 'students.summer_support'],
          ...grades.map((grade, index): Tt25Row => [
            String(27 + index),
            `- Lớp ${index + 1}`,
            'người',
            `students.grade=${grade}.summer_support`,
          ]),
          ['32', '3.5. Học sinh lưu ban', 'người', 'students.completion=retained'],
          ...grades.map((grade, index): Tt25Row => [
            String(33 + index),
            `- Lớp ${index + 1}`,
            'người',
            `students.grade=${grade}.completion=retained`,
          ]),
          ['38', '3.6. Học sinh hoàn thành chương trình tiểu học', 'người', 'students.completion=level_completed'],
          ['T06', 'Chia theo tuổi:', null, H],
          ['39', '- Dưới 11 tuổi', 'người', 'students.completion=level_completed.age_under=11'],
          ['40', '- 11 tuổi', 'người', 'students.completion=level_completed.age=11'],
          ['41', '- Trên 11 tuổi', 'người', 'students.completion=level_completed.age_over=11'],
          ['T07', 'Trong đó:', null, H],
          ['42', '- Học sinh khuyết tật', 'người', 'students.completion=level_completed.disabled'],
        ],
      },
      {
        code: 'doi_ngu',
        name: 'IV. Đội ngũ',
        columns: STAFF_COLUMNS,
        rows: [
          ['43', 'Tổng số', 'người', 'staff'],
          ['44', '4.1. Cán bộ quản lý', 'người', 'staff.manager'],
          ['45', '- Hiệu trưởng', 'người', 'staff.principal'],
          ['46', '- Phó Hiệu trưởng', 'người', 'staff.vice_principal'],
          ['47', '4.2. Vị trí việc làm chức danh nghề nghiệp chuyên ngành', 'người', 'rows:48+56+57+58'],
          ['48', '4.2.1. Giáo viên', 'người', 'staff.teacher'],
          ['T08', 'Chia theo đánh giá chuẩn nghề nghiệp', null, H],
          ['49', '- Tốt', 'người', 'staff.teacher.standard=excellent'],
          ['50', '- Khá', 'người', 'staff.teacher.standard=good'],
          ['51', '- Đạt', 'người', 'staff.teacher.standard=met'],
          ['52', '- Chưa đạt', 'người', 'staff.teacher.standard=not_met'],
          ['T09', 'Trong đó', null, H],
          ['53', '- Giáo viên tuyển mới trong năm học', 'người', 'staff.teacher.new_hire'],
          ['54', '- Giáo viên nghỉ hưu trong năm học', 'người', 'staff.teacher.retired'],
          ['55', '- Giáo viên nghỉ hoặc chuyển đi trong năm học', 'người', 'staff.teacher.left'],
          ['56', '4.2.2. Giáo vụ', 'người', 'staff.job=academic_affairs'],
          ['57', '4.2.3. Tư vấn học sinh', 'người', 'staff.job=counselor'],
          ['58', '4.2.4. Hỗ trợ giáo dục người khuyết tật', 'người', 'staff.job=disability_support'],
          ...staffJobs(59, '- Kiêm nhiệm 2 hoặc 3 VTVL chuyên môn dùng chung'),
          ['73', '4.5. Số giáo viên, nhân viên được tham gia các chương trình bồi dưỡng', 'lượt người', M],
          ['74', '- Chương trình bồi dưỡng thường xuyên', 'lượt người', M],
          [
            '75',
            '- Tập huấn và tham gia giảng dạy về phòng, chống HIV trên nền tảng kỹ năng sống và giáo dục sức khỏe sinh sản.',
            'lượt người',
            M,
          ],
          [
            '76',
            '- Trong đó: Số nhân viên được tập huấn và tham gia giảng dạy về phòng, chống HIV trên nền tảng kỹ năng sống và giáo dục sức khỏe sinh sản.',
            'lượt người',
            M,
          ],
        ],
      },
    ],
  },
];
