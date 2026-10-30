// Biểu 03.ĐN-THCS, 03.CN-THCS theo Thông tư 25/2024/TT-BGDĐT (YCTD-385 lát L2), chép từ bản PDF gốc trên Cổng văn bản Chính
// phủ (`tai_lieu/ban_mau/yctd-385/BIEU_03_THCS.md`). Quy ước dòng như `tt25-tieu-hoc.ts`. Phần Trường chia nhóm theo loại trường
// (1.1 trường THCS, 1.2 trường tiểu học và THCS); trường có cấp cao nhất là THPT không tính vào phần này. Dùng cho database
// migration hệ thống 0136; không sửa sau khi migration đã chạy
import {
  COUNT_COLUMNS,
  PEOPLE_COLUMNS,
  ROOM_COLUMNS,
  STAFF_COLUMNS,
  type Tt25Form,
  type Tt25Row,
} from './tt25-tieu-hoc.js';

const M = 'manual';
const H = 'heading';
const grades = ['K6', 'K7', 'K8', 'K9'];
const code = (value: number) => String(value).padStart(2, '0');
const range = (from: number, count: number) => Array.from({ length: count }, (_, index) => String(from + index));

// Cờ của một nhóm trường: [nhãn, điều kiện hoặc nhập tay]; mã liên tiếp từ `first`
export function schoolGroup(type: string, first: number, flags: Array<[string, string]>): Tt25Row[] {
  return flags.map(([label, flag], index) => [
    code(first + index),
    label,
    'trường',
    flag === M ? M : `school.${type}.${flag}`,
  ]);
}
export const STANDARD: Array<[string, string]> = [
  ['- Trường đạt chuẩn quốc gia mức độ 1', 'standard_1'],
  ['- Trường đạt chuẩn quốc gia mức độ 2', 'standard_2'],
];
export const CONDITIONS: Array<[string, string]> = [
  ['- Trường có tổ chức học trực tuyến', M],
  ['- Trường có điện', 'electricity'],
  ['- Trường có internet dùng cho mục đích học tập, giảng dạy', 'internet'],
  ['- Trường có máy tính dùng cho mục đích học tập', 'computers'],
  ['- Trường có cơ sở hạ tầng và tài liệu phù hợp với học sinh khuyết tật', M],
  ['- Trường có nước uống', 'drinking_water'],
  ['- Trường có hệ thống vệ sinh tiện lợi và riêng rẽ cho từng giới tính', 'separate_toilets'],
  ['- Trường có chỗ rửa tay thuận tiện (bao gồm nước và xà phòng)', 'handwashing'],
  [
    '- Trường có chương trình giáo dục cơ bản về giới tính, phòng chống bạo lực, xâm hại; cung cấp kiến thức về HIV',
    'sex_education',
  ],
  ['- Trường có bộ phận làm công tác tư vấn tâm lý học đường', M],
  ['- Trường có kế hoạch giáo dục phòng, chống thiên tai và ứng phó biến đổi khí hậu', 'disaster_plan'],
];

// Học sinh theo lớp và tuổi của 03.ĐN-THCS: [mã dòng lớp, tuổi đầu, tuổi cuối, mã dòng đầu tiên của tuổi, mã dòng lưu ban]
const AGE_BLOCKS: Array<[number, number, number, number, number]> = [
  [43, 10, 14, 44, 51],
  [52, 11, 15, 53, 59],
  [60, 12, 16, 61, 67],
  [68, 13, 17, 69, 75],
];

function studentsByGradeAndAge(): Tt25Row[] {
  const rows: Tt25Row[] = [];
  AGE_BLOCKS.forEach(([gradeRow, from, to, firstAge, repeaterRow], index) => {
    const grade = grades[index]!;
    rows.push([code(gradeRow), `- Học sinh lớp ${index + 6}`, 'người', `students.grade=${grade}`]);
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
      rows.push(['50', '+ Học sinh mới tuyển đầu cấp', 'người', 'students.grade=K6.new_entrant']);
    }
    rows.push([code(repeaterRow), '+ Học sinh lưu ban', 'người', `students.grade=${grade}.repeater`]);
  });
  rows.push(['76', '- Tổng quy mô chia theo độ tuổi', 'người', 'students']);
  for (let age = 10; age <= 17; age += 1) {
    rows.push([String(77 + age - 10), `+ ${age} tuổi`, 'người', `students.age=${age}`]);
  }
  rows.push(['85', '+ ... (tuổi khác, tính các tuổi lớn hơn)', 'người', 'students.age_over=17']);
  return rows;
}

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

// Thứ tự vị trí chuyên môn dùng chung ở biểu THCS khác biểu Tiểu học (văn thư trước thủ quỹ, kế toán)
const SHARED_JOBS: Array<[string, string]> = [
  ['- Thư viện', 'library'],
  ['- Quản trị công sở', 'office_management'],
  ['- Văn thư', 'clerical'],
  ['- Thủ quỹ', 'treasurer'],
  ['- Kế toán', 'accounting'],
  ['- Y tế trường học', 'health'],
  ['- Công nghệ thông tin, an toàn thông tin', 'information_technology'],
];
const SUPPORT_JOBS: Array<[string, string]> = [
  ['- Nhân viên bảo vệ', 'security'],
  ['- Nhân viên nấu ăn', 'cook'],
  ['- Nhân viên phục vụ', 'service'],
  ['- Nhân viên khác', 'other_staff'],
];

// Vị trí chức danh chuyên ngành khác giáo viên, chuyên môn dùng chung, hỗ trợ phục vụ; `first` là mã dòng thiết bị, thí nghiệm
export function staffJobs(first: number): Tt25Row[] {
  const shared = first + 4;
  const support = shared + SHARED_JOBS.length + 2;
  return [
    [String(first), '4.2.2. Thiết bị, thí nghiệm', 'người', 'staff.job=equipment_lab'],
    [String(first + 1), '4.2.3. Giáo vụ', 'người', 'staff.job=academic_affairs'],
    [String(first + 2), '4.2.4. Tư vấn học sinh', 'người', 'staff.job=counselor'],
    [String(first + 3), '4.2.5. Hỗ trợ giáo dục người khuyết tật', 'người', 'staff.job=disability_support'],
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
    [String(shared + SHARED_JOBS.length + 1), '- Kiêm nhiệm 2 hoặc 3 VTVL chuyên môn dùng chung', 'người', M],
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

export const TT25_THCS: Tt25Form[] = [
  {
    code: 'tt25-03-dn-thcs',
    form_number: '03.ĐN-THCS',
    name: 'Biểu 03.ĐN-THCS: Báo cáo thống kê giáo dục trung học cơ sở (đầu năm học)',
    school_level: 'THCS',
    period: 'start_of_year',
    note: 'Theo Thông tư 25/2024/TT-BGDĐT, có tại ngày 30/9. Phần Trường: trường chỉ có THCS ghi ở nhóm 1.1, trường có Tiểu học và THCS ghi ở nhóm 1.2, trường có THPT không tính. Tuổi tính theo năm sinh.',
    sections: [
      {
        code: 'truong',
        name: 'I. Trường',
        columns: COUNT_COLUMNS,
        rows: [
          ['01', 'Tổng số trường cấp trung học cơ sở', 'trường', 'rows:02+18'],
          ['02', '1.1. Trường trung học cơ sở', 'trường', 'school.type_thcs'],
          ['T01', 'Trong đó:', null, H],
          ...schoolGroup('type_thcs', 3, [
            ...STANDARD,
            ['- Trường phổ thông dân tộc bán trú THCS', M],
            ['- Trường phổ thông dân tộc nội trú THCS', M],
            ...CONDITIONS,
          ]),
          ['18', '1.2. Trường tiểu học và trung học cơ sở', 'trường', 'school.type_th_thcs'],
          ['T02', 'Trong đó:', null, H],
          ...schoolGroup('type_th_thcs', 19, [
            ...STANDARD,
            ['- Trường phổ thông dân tộc bán trú TH&THCS', M],
            ...CONDITIONS,
          ]),
        ],
      },
      {
        code: 'lop',
        name: 'II. Lớp',
        columns: COUNT_COLUMNS,
        rows: [
          ['33', 'Tổng số', 'lớp', 'classes'],
          ['T03', 'Chia ra:', null, H],
          ...grades.map((grade, index): Tt25Row => [
            String(34 + index),
            `- Lớp ${index + 6}`,
            'lớp',
            `classes.grade=${grade}`,
          ]),
          ['T04', 'Trong đó', null, H],
          ['38', '- Lớp học 2 buổi/ngày', 'lớp', 'classes.two_sessions'],
          ['39', '- Lớp THCS trong trường phổ thông dân tộc bán trú', 'lớp', M],
          ['40', '- Lớp THCS trong trường phổ thông dân tộc nội trú', 'lớp', M],
          ['41', '- Lớp ghép', 'lớp', 'classes.multigrade'],
        ],
      },
      {
        code: 'hoc_sinh',
        name: 'III. Học sinh',
        columns: PEOPLE_COLUMNS,
        rows: [
          ['42', '3.1. Tổng quy mô', 'người', 'students'],
          ['T05', '3.2. Quy mô chia ra theo lớp và theo tuổi', null, H],
          ...studentsByGradeAndAge(),
          ['T06', '3.3. Trong tổng quy mô có:', null, H],
          ['86', '- Tổng số học sinh lưu ban năm học trước đang học trong năm học này', 'người', 'students.repeater'],
          ['87', '- Học sinh học 2 buổi/ngày', 'người', 'students.two_sessions'],
          ['88', '- Học sinh dân tộc học bán trú', 'người', M],
          ['89', '- Học sinh dân tộc học nội trú', 'người', M],
          ['90', '- Học sinh khuyết tật học hòa nhập', 'người', 'students.disabled'],
          ['T07', 'Chia ra:', null, H],
          ['91', '+ Khuyết tật về nhìn', 'người', 'students.disability=vision'],
          ['92', '+ Khuyết tật về nghe, nói', 'người', 'students.disability=hearing_speech'],
          ['93', '+ Khuyết tật về trí tuệ', 'người', 'students.disability=intellectual'],
          ['94', '+ Khuyết tật về vận động', 'người', 'students.disability=mobility'],
          ['95', '+ Khuyết tật thần kinh, tâm thần', 'người', 'students.disability=neuro_mental'],
          ['96', '+ Khuyết tật khác', 'người', 'students.disability=other'],
          ['97', '3.4. Học sinh thuộc đối tượng chính sách (theo quy định của Chính phủ)', 'người', M],
          ['98', '3.4.1. Học sinh được miễn học phí', 'người', M],
          ['99', '3.4.2. Học sinh được giảm học phí', 'người', M],
          ['100', '3.4.3. Học sinh được hỗ trợ chi phí học tập', 'người', M],
          ['101', '3.4.4. Học sinh dân tộc thiểu số rất ít người được hỗ trợ học tập', 'người', M],
          ['102', '3.4.5. Hỗ trợ tiền ăn, tiền nhà ở và gạo', 'người', M],
        ],
      },
      {
        code: 'doi_ngu',
        name: 'IV. Đội ngũ',
        columns: STAFF_COLUMNS,
        rows: [
          ['103', 'Tổng số', 'người', 'staff'],
          ['104', '4.1. Cán bộ quản lý', 'người', 'staff.manager'],
          ['T08', 'Chia ra', null, H],
          ['105', '- Hiệu trưởng', 'người', 'staff.principal'],
          ['106', '- Phó hiệu trưởng', 'người', 'staff.vice_principal'],
          ['T09', 'Chia theo trình độ đào tạo', null, H],
          ...qualifications(107),
          ['115', '4.2. Vị trí việc làm chức danh nghề nghiệp chuyên ngành', 'người', 'rows:116+138+139+140+141'],
          ['116', '4.2.1. Giáo viên', 'người', 'staff.teacher'],
          ['T10', 'Chia theo trình độ đào tạo', null, H],
          ...qualifications(117),
          ['T11', 'Chia theo chức danh nghề nghiệp', null, H],
          ['125', '- Giáo viên trung học cơ sở hạng I', 'người', 'staff.teacher.rank=1'],
          ['126', '- Giáo viên trung học cơ sở hạng II', 'người', 'staff.teacher.rank=2'],
          ['127', '- Giáo viên trung học cơ sở hạng III', 'người', 'staff.teacher.rank=3'],
          ['T12', 'Chia theo độ tuổi', null, H],
          ['128', '- Từ 20 - 29 tuổi', 'người', 'staff.teacher.age_band=20_29'],
          ['129', '- Từ 30 - 39 tuổi', 'người', 'staff.teacher.age_band=30_39'],
          ['130', '- Từ 40 - 49 tuổi', 'người', 'staff.teacher.age_band=40_49'],
          ['131', '- Từ 50 - 59 tuổi', 'người', 'staff.teacher.age_band=50_59'],
          ['132', '- ≥ 60 tuổi', 'người', 'staff.teacher.age_band=60'],
          ['T13', 'Trong đó:', null, H],
          ['133', '- GV Tổng phụ trách Đội TNTP HCM', 'người', M],
          ['134', '- Kiêm nhiệm làm giáo vụ', 'người', M],
          ['135', '- Kiêm nhiệm làm tư vấn học sinh', 'người', M],
          ['136', '- Kiêm nhiệm làm hỗ trợ giáo dục người khuyết tật', 'người', M],
          ['137', '- Kiêm nhiệm làm VTVL chuyên môn dùng chung', 'người', M],
          ...staffJobs(138),
        ],
      },
      {
        code: 'phong_hoc',
        name: 'V. Phòng học tập',
        columns: ROOM_COLUMNS,
        rows: [
          ['156', 'Tổng số', 'phòng', 'rows:157+159+167'],
          ['157', '5.1. Phòng học', 'phòng', 'rooms.classroom'],
          ['158', 'Trong đó phòng học nhờ, mượn (nếu có)', 'phòng', 'rooms.classroom.borrowed'],
          ['159', '5.2. Phòng học bộ môn', 'phòng', `rows:${range(160, 7).join('+')}`],
          ['160', '- Âm nhạc', 'phòng', M],
          ['161', '- Mỹ thuật', 'phòng', M],
          ['162', '- Công nghệ', 'phòng', M],
          ['163', '- Khoa học tự nhiên', 'phòng', M],
          ['164', '- Khoa học xã hội', 'phòng', M],
          ['165', '- Tin học', 'phòng', M],
          ['166', '- Ngoại ngữ', 'phòng', M],
          ['167', '5.3. Phòng đa chức năng', 'phòng', 'rooms.multi_purpose'],
        ],
      },
    ],
  },
  {
    code: 'tt25-03-cn-thcs',
    form_number: '03.CN-THCS',
    name: 'Biểu 03.CN-THCS: Báo cáo thống kê giáo dục trung học cơ sở (cuối năm học)',
    school_level: 'THCS',
    period: 'end_of_year',
    note: 'Theo Thông tư 25/2024/TT-BGDĐT, có tại ngày 31/5, Sở nhận ngày 30/6. Dòng 33 có mã số ở bản in nhưng là dòng nhóm của 34, 35, nhập tay. Công nhận tốt nghiệp lấy theo kết quả xét tốt nghiệp đã xác nhận.',
    sections: [
      {
        code: 'truong',
        name: 'I. Trường',
        columns: COUNT_COLUMNS,
        rows: [
          ['01', 'Tổng số trường cấp trung học cơ sở', 'trường', 'rows:02+03'],
          ['02', '- Trường trung học cơ sở', 'trường', 'school.type_thcs'],
          ['03', '- Trường tiểu học và trung học cơ sở', 'trường', 'school.type_th_thcs'],
          ['T01', 'Trong đó:', null, H],
          ['04', '- Số trường sáp nhập', 'trường', M],
          ['05', '- Số trường giải thể', 'trường', M],
          ['06', '- Số trường chia tách', 'trường', M],
          ['07', '- Số trường thành lập mới', 'trường', M],
        ],
      },
      {
        code: 'lop',
        name: 'II. Lớp',
        columns: COUNT_COLUMNS,
        rows: [
          ['08', 'Tổng số', 'lớp', 'classes'],
          ['T02', 'Chia ra:', null, H],
          ...grades.map((grade, index): Tt25Row => [
            code(9 + index),
            `- Lớp ${index + 6}`,
            'lớp',
            `classes.grade=${grade}`,
          ]),
          ['T03', 'Trong đó:', null, H],
          ['13', '- Lớp ghép', 'lớp', 'classes.multigrade'],
        ],
      },
      {
        code: 'hoc_sinh',
        name: 'III. Học sinh',
        columns: PEOPLE_COLUMNS,
        rows: [
          ['T04', '3.1. Biến động trong năm học', null, H],
          ['14', '- Học sinh chuyển đến từ tỉnh/tp khác', 'người', 'students.transfer_in_province'],
          ['15', '- Học sinh chuyển đi ngoài địa bàn tỉnh/tp', 'người', 'leavers.transfer_out_province'],
          ['16', '- Học sinh chuyển đi ra ngoài quốc gia', 'người', M],
          ['17', '- Học sinh bỏ học', 'người', 'leavers.dropout'],
          ['18', '3.2. Tổng quy mô', 'người', 'students'],
          ['T05', '3.3. Quy mô chia ra theo lớp', null, H],
          ...grades.map((grade, index): Tt25Row => [
            String(19 + index),
            `- Học sinh lớp ${index + 6}`,
            'người',
            `students.grade=${grade}`,
          ]),
          ['23', '3.4. Học sinh học lại, thi lại trong hè', 'người', 'students.summer_support'],
          ...grades.map((grade, index): Tt25Row => [
            String(24 + index),
            `- Lớp ${index + 6}`,
            'người',
            `students.grade=${grade}.summer_support`,
          ]),
          ['28', '3.5. Học sinh lưu ban', 'người', 'students.completion=retained'],
          ...grades.map((grade, index): Tt25Row => [
            String(29 + index),
            `- Lớp ${index + 6}`,
            'người',
            `students.grade=${grade}.completion=retained`,
          ]),
          ['33', '3.6. Học sinh được công nhận tốt nghiệp trung học cơ sở (dòng nhóm có mã ở bản in)', 'người', M],
          ['34', '3.6.1. Số học sinh có đủ điều kiện xét tốt nghiệp', 'người', 'students.graduation_eligible'],
          [
            '35',
            '3.6.2. Số học sinh được công nhận tốt nghiệp trung học cơ sở',
            'người',
            'students.graduation=graduated',
          ],
          ['T06', 'Trong đó:', null, H],
          ['36', '- Học sinh khuyết tật', 'người', 'students.graduation=graduated.disabled'],
        ],
      },
      {
        code: 'doi_ngu',
        name: 'IV. Đội ngũ',
        columns: STAFF_COLUMNS,
        rows: [
          ['37', 'Tổng số', 'người', 'staff'],
          ['38', '4.1. Cán bộ quản lý', 'người', 'staff.manager'],
          ['39', '- Hiệu trưởng', 'người', 'staff.principal'],
          ['40', '- Phó Hiệu trưởng', 'người', 'staff.vice_principal'],
          ['41', '4.2. Vị trí việc làm chức danh nghề nghiệp chuyên ngành', 'người', 'rows:42+50+51+52+53'],
          ['42', '4.2.1. Giáo viên', 'người', 'staff.teacher'],
          ['T07', 'Chia theo đánh giá chuẩn nghề nghiệp', null, H],
          ['43', '- Tốt', 'người', 'staff.teacher.standard=excellent'],
          ['44', '- Khá', 'người', 'staff.teacher.standard=good'],
          ['45', '- Đạt', 'người', 'staff.teacher.standard=met'],
          ['46', '- Chưa đạt', 'người', 'staff.teacher.standard=not_met'],
          ['T08', 'Trong đó', null, H],
          ['47', '- Giáo viên tuyển mới trong năm học', 'người', 'staff.teacher.new_hire'],
          ['48', '- Giáo viên nghỉ hưu trong năm học', 'người', 'staff.teacher.retired'],
          ['49', '- Giáo viên nghỉ hoặc chuyển đi trong năm học', 'người', 'staff.teacher.left'],
          ...staffJobs(50),
          ['68', '4.5. Số giáo viên, nhân viên được tham gia các chương trình bồi dưỡng', 'lượt người', M],
          ['69', '- Chương trình bồi dưỡng thường xuyên', 'lượt người', M],
          [
            '70',
            '- Tập huấn và tham gia giảng dạy về phòng, chống HIV trên nền tảng kỹ năng sống và giáo dục sức khỏe sinh sản.',
            'lượt người',
            M,
          ],
          [
            '71',
            'Trong đó: Số nhân viên được tập huấn và tham gia giảng dạy về phòng, chống HIV trên nền tảng kỹ năng sống và giáo dục sức khỏe sinh sản.',
            'lượt người',
            M,
          ],
        ],
      },
    ],
  },
];
