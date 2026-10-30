// Biểu 04.ĐN-THPT, 04.CN-THPT theo Thông tư 25/2024/TT-BGDĐT (YCTD-385 lát L3), chép từ bản PDF gốc trên Cổng văn bản Chính
// phủ (`tai_lieu/ban_mau/yctd-385/BIEU_04_THPT.md`). Quy ước dòng như `tt25-tieu-hoc.ts`. Phần Trường chia ba nhóm theo loại
// trường (1.1 trường THPT, 1.2 trường THCS và THPT, 1.3 trường Tiểu học, THCS và THPT). Dùng cho database migration hệ thống
// 0142; không sửa sau khi migration đã chạy
import { CONDITIONS, schoolGroup, STANDARD, staffJobs } from './tt25-thcs.js';
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
const grades = ['K10', 'K11', 'K12'];
const code = (value: number) => String(value).padStart(2, '0');
const range = (from: number, count: number) => Array.from({ length: count }, (_, index) => String(from + index));

// Học sinh theo lớp và tuổi của 04.ĐN-THPT: [mã dòng lớp, tuổi đầu, tuổi cuối, mã dòng đầu tiên của tuổi, mã dòng lưu ban]
const AGE_BLOCKS: Array<[number, number, number, number, number]> = [
  [56, 14, 18, 57, 64],
  [65, 15, 19, 66, 72],
  [73, 16, 20, 74, 80],
];

function studentsByGradeAndAge(): Tt25Row[] {
  const rows: Tt25Row[] = [];
  AGE_BLOCKS.forEach(([gradeRow, from, to, firstAge, repeaterRow], index) => {
    const grade = grades[index]!;
    rows.push([code(gradeRow), `- Học sinh lớp ${index + 10}`, 'người', `students.grade=${grade}`]);
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
      rows.push(['63', '+ Học sinh mới tuyển đầu cấp', 'người', 'students.grade=K10.new_entrant']);
    }
    rows.push([code(repeaterRow), '+ Học sinh lưu ban', 'người', `students.grade=${grade}.repeater`]);
  });
  rows.push(['81', '- Tổng quy mô chia theo độ tuổi', 'người', 'students']);
  for (let age = 14; age <= 20; age += 1) {
    rows.push([String(82 + age - 14), `+ ${age} tuổi`, 'người', `students.age=${age}`]);
  }
  rows.push(['89', '+ ... (tuổi khác, tính các tuổi lớn hơn)', 'người', 'students.age_over=20']);
  return rows;
}

// Biểu THPT không có dòng trình độ cao đẳng
const QUALIFICATION_LABELS = [
  '- Đại học sư phạm',
  '- Đại học và có chứng chỉ BDNVSP',
  '- Thạc sĩ KHGD&ĐTGV',
  '- Thạc sĩ và có chứng chỉ BDNVSP',
  '- Tiến sĩ, Tiến sĩ khoa học',
  '- Khác',
];
const qualifications = (first: number): Tt25Row[] =>
  QUALIFICATION_LABELS.map((label, index) => [String(first + index), label, 'người', M]);

export const TT25_THPT: Tt25Form[] = [
  {
    code: 'tt25-04-dn-thpt',
    form_number: '04.ĐN-THPT',
    name: 'Biểu 04.ĐN-THPT: Báo cáo thống kê giáo dục trung học phổ thông (đầu năm học)',
    school_level: 'THPT',
    period: 'start_of_year',
    note: 'Theo Thông tư 25/2024/TT-BGDĐT, có tại ngày 30/9. Phần Trường: trường chỉ có THPT ghi ở nhóm 1.1, trường THCS và THPT ở nhóm 1.2, trường Tiểu học, THCS và THPT ở nhóm 1.3. Dòng 132 bản in ghi "> 60 tuổi", tính từ 60 tuổi như biểu Tiểu học, THCS; dòng 149 bản in ghi "Kiểm nhiệm", ghi theo nghĩa "Kiêm nhiệm". Tuổi tính theo năm sinh.',
    sections: [
      {
        code: 'truong',
        name: 'I. Trường',
        columns: COUNT_COLUMNS,
        rows: [
          ['01', 'Tổng số trường cấp trung học phổ thông', 'trường', 'rows:02+18+33'],
          ['02', '1.1. Trường trung học phổ thông', 'trường', 'school.type_thpt'],
          ['T01', 'Trong đó:', null, H],
          ...schoolGroup('type_thpt', 3, [
            ...STANDARD,
            ['- Trường trung học phổ thông chuyên', M],
            ['- Trường phổ thông dân tộc nội trú THPT', M],
            ...CONDITIONS,
          ]),
          ['18', '1.2. Trường trung học cơ sở và trung học phổ thông', 'trường', 'school.type_thcs_thpt'],
          ['T02', 'Trong đó:', null, H],
          ...schoolGroup('type_thcs_thpt', 19, [
            ...STANDARD,
            ['- Trường phổ thông dân tộc nội trú THCS và THPT', M],
            ...CONDITIONS,
          ]),
          ['33', '1.3. Trường tiểu học, trung học cơ sở và trung học phổ thông', 'trường', 'school.type_th_thcs_thpt'],
          ['T03', 'Trong đó:', null, H],
          ...schoolGroup('type_th_thcs_thpt', 34, [...STANDARD, ...CONDITIONS]),
        ],
      },
      {
        code: 'lop',
        name: 'II. Lớp',
        columns: COUNT_COLUMNS,
        rows: [
          ['47', 'Tổng số', 'lớp', 'classes'],
          ['T04', 'Chia ra:', null, H],
          ...grades.map((grade, index): Tt25Row => [
            String(48 + index),
            `- Lớp ${index + 10}`,
            'lớp',
            `classes.grade=${grade}`,
          ]),
          ['T05', 'Trong đó', null, H],
          ['51', '- Lớp học 2 buổi/ngày', 'lớp', 'classes.two_sessions'],
          ['52', '- Lớp trong trường THPT chuyên', 'lớp', M],
          ['53', '- Lớp THPT trong trường phổ thông dân tộc nội trú', 'lớp', M],
          ['54', '- Lớp ghép', 'lớp', 'classes.multigrade'],
        ],
      },
      {
        code: 'hoc_sinh',
        name: 'III. Học sinh',
        columns: PEOPLE_COLUMNS,
        rows: [
          ['55', '3.1. Tổng quy mô', 'người', 'students'],
          ['T06', '3.2. Quy mô chia ra theo lớp và theo tuổi', null, H],
          ...studentsByGradeAndAge(),
          ['T07', '3.3. Trong tổng quy mô có:', null, H],
          ['90', '- Tổng số học sinh lưu ban năm học trước đang học trong năm học này', 'người', 'students.repeater'],
          ['91', '- Học sinh học 2 buổi/ngày', 'người', 'students.two_sessions'],
          ['92', '- Học sinh dân tộc học nội trú', 'người', M],
          ['93', '- Học sinh khuyết tật học hòa nhập', 'người', 'students.disabled'],
          ['T08', 'Chia ra:', null, H],
          ['94', '+ Khuyết tật về nhìn', 'người', 'students.disability=vision'],
          ['95', '+ Khuyết tật về nghe, nói', 'người', 'students.disability=hearing_speech'],
          ['96', '+ Khuyết tật về trí tuệ', 'người', 'students.disability=intellectual'],
          ['97', '+ Khuyết tật về vận động', 'người', 'students.disability=mobility'],
          ['98', '+ Khuyết tật thần kinh, tâm thần', 'người', 'students.disability=neuro_mental'],
          ['99', '+ Khuyết tật khác', 'người', 'students.disability=other'],
          ['100', '- Học sinh được tư vấn giáo dục hướng nghiệp', 'người', M],
          ['101', '3.4. Học sinh thuộc đối tượng chính sách (theo quy định của Chính phủ)', 'người', M],
          ['102', '3.4.1. Học sinh được miễn học phí', 'người', M],
          ['103', '3.4.2. Học sinh được giảm học phí', 'người', M],
          ['104', '3.4.3. Học sinh được hỗ trợ chi phí học tập', 'người', M],
          ['105', '3.4.4. Học sinh dân tộc thiểu số rất ít người được hỗ trợ học tập', 'người', M],
          ['106', '3.4.5. Hỗ trợ tiền ăn, tiền nhà ở và gạo', 'người', M],
        ],
      },
      {
        code: 'doi_ngu',
        name: 'IV. Đội ngũ',
        columns: STAFF_COLUMNS,
        rows: [
          ['107', 'Tổng số', 'người', 'staff'],
          ['108', '4.1. Cán bộ quản lý', 'người', 'staff.manager'],
          ['T09', 'Chia ra:', null, H],
          ['109', '- Hiệu trưởng', 'người', 'staff.principal'],
          ['110', '- Phó hiệu trưởng', 'người', 'staff.vice_principal'],
          ['T10', 'Chia theo trình độ đào tạo:', null, H],
          ...qualifications(111),
          ['117', '4.2. Vị trí việc làm chức danh nghề nghiệp chuyên ngành', 'người', 'rows:118+137+138+139+140'],
          ['118', '4.2.1. Giáo viên', 'người', 'staff.teacher'],
          ['T11', 'Chia theo trình độ đào tạo', null, H],
          ...qualifications(119),
          ['T12', 'Chia theo chức danh nghề nghiệp', null, H],
          ['125', '- Giáo viên trung học phổ thông hạng I', 'người', 'staff.teacher.rank=1'],
          ['126', '- Giáo viên trung học phổ thông hạng II', 'người', 'staff.teacher.rank=2'],
          ['127', '- Giáo viên trung học phổ thông hạng III', 'người', 'staff.teacher.rank=3'],
          ['T13', 'Chia theo độ tuổi', null, H],
          ['128', '- Từ 20 - 29 tuổi', 'người', 'staff.teacher.age_band=20_29'],
          ['129', '- Từ 30 - 39 tuổi', 'người', 'staff.teacher.age_band=30_39'],
          ['130', '- Từ 40 - 49 tuổi', 'người', 'staff.teacher.age_band=40_49'],
          ['131', '- Từ 50 - 59 tuổi', 'người', 'staff.teacher.age_band=50_59'],
          ['132', '- > 60 tuổi (bản in; tính từ 60 tuổi)', 'người', 'staff.teacher.age_band=60'],
          ['T14', 'Trong đó:', null, H],
          ['133', '- Kiêm nhiệm làm giáo vụ', 'người', M],
          ['134', '- Kiêm nhiệm làm tư vấn học sinh', 'người', M],
          ['135', '- Kiêm nhiệm làm hỗ trợ giáo dục người khuyết tật', 'người', M],
          ['136', '- Kiêm nhiệm làm VTVL chuyên môn dùng chung', 'người', M],
          ...staffJobs(137),
        ],
      },
      {
        code: 'phong_hoc',
        name: 'V. Phòng học',
        columns: ROOM_COLUMNS,
        rows: [
          ['155', 'Tổng số', 'phòng', 'rows:156+158+168'],
          ['156', '5.1. Phòng học', 'phòng', 'rooms.classroom'],
          ['157', 'Trong đó phòng học nhờ, mượn (nếu có)', 'phòng', 'rooms.classroom.borrowed'],
          ['158', '5.2. Phòng học bộ môn', 'phòng', `rows:${range(159, 9).join('+')}`],
          ['159', '- Âm nhạc', 'phòng', M],
          ['160', '- Mỹ thuật', 'phòng', M],
          ['161', '- Công nghệ', 'phòng', M],
          ['162', '- Khoa học xã hội', 'phòng', M],
          ['163', '- Tin học', 'phòng', M],
          ['164', '- Ngoại ngữ', 'phòng', M],
          ['165', '- Vật lý', 'phòng', M],
          ['166', '- Hóa học', 'phòng', M],
          ['167', '- Sinh học', 'phòng', M],
          ['168', '5.3. Phòng đa chức năng', 'phòng', 'rooms.multi_purpose'],
        ],
      },
    ],
  },
  {
    code: 'tt25-04-cn-thpt',
    form_number: '04.CN-THPT',
    name: 'Biểu 04.CN-THPT: Báo cáo thống kê giáo dục trung học phổ thông (cuối năm học)',
    school_level: 'THPT',
    period: 'end_of_year',
    note: 'Theo Thông tư 25/2024/TT-BGDĐT, có tại ngày 31/5, Sở nhận ngày 30/6. Công nhận tốt nghiệp lấy theo kết quả xét tốt nghiệp đã xác nhận; thí sinh tự do, miễn thi nhập tay. Dòng 34 bản in ghi "cua", giữ đúng bản in.',
    sections: [
      {
        code: 'truong',
        name: 'I. Trường',
        columns: COUNT_COLUMNS,
        rows: [
          ['01', 'Tổng số trường cấp trung học phổ thông', 'trường', 'rows:02+03+04'],
          ['02', '- Trường trung học phổ thông', 'trường', 'school.type_thpt'],
          ['03', '- Trung học cơ sở và trung học phổ thông', 'trường', 'school.type_thcs_thpt'],
          ['04', '- Tiểu học, trung học cơ sở và trung học phổ thông', 'trường', 'school.type_th_thcs_thpt'],
          ['T01', 'Trong đó:', null, H],
          ['05', '- Số trường sáp nhập', 'trường', M],
          ['06', '- Số trường giải thể', 'trường', M],
          ['07', '- Số trường chia tách', 'trường', M],
          ['08', '- Số trường thành lập mới', 'trường', M],
        ],
      },
      {
        code: 'lop',
        name: 'II. Lớp',
        columns: COUNT_COLUMNS,
        rows: [
          ['09', 'Tổng số', 'lớp', 'classes'],
          ['T02', 'Chia ra :', null, H],
          ...grades.map((grade, index): Tt25Row => [
            String(10 + index),
            `- Lớp ${index + 10}`,
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
            `- Học sinh lớp ${index + 10}`,
            'người',
            `students.grade=${grade}`,
          ]),
          ['22', '3.4. Học sinh học lại, thi lại trong hè', 'người', 'students.summer_support'],
          ...grades.map((grade, index): Tt25Row => [
            String(23 + index),
            `- Lớp ${index + 10}`,
            'người',
            `students.grade=${grade}.summer_support`,
          ]),
          ['26', '3.5. Học sinh lưu ban', 'người', 'students.completion=retained'],
          ...grades.map((grade, index): Tt25Row => [
            String(27 + index),
            `- Lớp ${index + 10}`,
            'người',
            `students.grade=${grade}.completion=retained`,
          ]),
          ['T06', '3.6. Học sinh được công nhận tốt nghiệp THPT', null, H],
          ['30', '3.6.1. Số học sinh có đủ điều kiện dự thi tốt nghiệp', 'người', 'students.graduation_eligible'],
          ['T07', 'Trong đó:', null, H],
          ['31', '- Thí sinh tự do', 'người', M],
          ['32', '3.6.2. Số học sinh được công nhận tốt nghiệp THPT', 'người', 'students.graduation=graduated'],
          ['T08', 'Trong đó:', null, H],
          [
            '33',
            '- Học sinh được miễn thi tất cả các bài thi trong xét tốt nghiệp THPT (theo Quy chế thi tốt nghiệp THPT)',
            'người',
            M,
          ],
          [
            '34',
            '- Học sinh được miễn thi tất cả các bài thi cua kỳ thi THPT QG (theo Quy chế thi tốt nghiệp THPT)',
            'người',
            M,
          ],
          ['35', '- Thí sinh tự do', 'người', M],
        ],
      },
      {
        code: 'doi_ngu',
        name: 'IV. Đội ngũ',
        columns: STAFF_COLUMNS,
        rows: [
          ['36', 'Tổng số', 'người', 'staff'],
          ['37', '4.1. Cán bộ quản lý', 'người', 'staff.manager'],
          ['38', '- Hiệu trưởng', 'người', 'staff.principal'],
          ['39', '- Phó Hiệu trưởng', 'người', 'staff.vice_principal'],
          ['40', '4.2. Vị trí việc làm chức danh nghề nghiệp chuyên ngành', 'người', 'rows:41+49+50+51+52'],
          ['41', '4.2.1. Giáo viên', 'người', 'staff.teacher'],
          ['T09', 'Chia theo đánh giá chuẩn nghề nghiệp', null, H],
          ['42', '- Tốt', 'người', 'staff.teacher.standard=excellent'],
          ['43', '- Khá', 'người', 'staff.teacher.standard=good'],
          ['44', '- Đạt', 'người', 'staff.teacher.standard=met'],
          ['45', '- Chưa đạt', 'người', 'staff.teacher.standard=not_met'],
          ['T10', 'Trong đó', null, H],
          ['46', '- Giáo viên tuyển mới trong năm học', 'người', 'staff.teacher.new_hire'],
          ['47', '- Giáo viên nghỉ hưu trong năm học', 'người', 'staff.teacher.retired'],
          ['48', '- Giáo viên nghỉ hoặc chuyển đi trong năm học', 'người', 'staff.teacher.left'],
          ...staffJobs(49),
          ['67', '4.5. Số giáo viên, nhân viên được tham gia các chương trình bồi dưỡng', 'lượt người', M],
          ['68', '- Chương trình bồi dưỡng thường xuyên', 'lượt người', M],
          [
            '69',
            '- Tập huấn và tham gia giảng dạy về phòng, chống HIV trên nền tảng kỹ năng sống và giáo dục sức khỏe sinh sản.',
            'lượt người',
            M,
          ],
          [
            '70',
            'Trong đó: Số nhân viên được tập huấn và tham gia giảng dạy về phòng, chống HIV trên nền tảng kỹ năng sống và GD sức khỏe sinh sản.',
            'lượt người',
            M,
          ],
        ],
      },
    ],
  },
];
