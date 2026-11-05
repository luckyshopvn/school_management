import type { QualityFrameworkSeed } from '../quality-assurance.js';

// Bộ mẫu chuẩn nghề nghiệp giáo viên cơ sở giáo dục phổ thông theo Thông tư 20/2018/TT-BGDĐT (YCTD-396 lát L6), cho minh
// chứng của các năm học đến hết 2025-2026; Thông tư 30/2026/TT-BGDĐT thay thế từ năm học 2026-2027. Năm tiêu chuẩn, mười lăm
// tiêu chí; mức 1, 2, 3 là Đạt, Khá, Tốt. Tiêu chí 3 đến 7 (Điều 5) là tiêu chí quan trọng khi xếp loại theo Công văn
// 4530/BGDĐT-NGCBQLGD. Chưa nạp mô tả từng mức (trường nhập từ Excel nếu cần)
export const TT20_2018_TEACHER: QualityFrameworkSeed = {
  code: 'GV-PT-TT20-2018',
  name: 'Chuẩn nghề nghiệp giáo viên phổ thông (Thông tư 20/2018)',
  legal_basis:
    'Thông tư 20/2018/TT-BGDĐT ngày 22/8/2018; Công văn 4530/BGDĐT-NGCBQLGD ngày 01/10/2018; áp dụng đến hết năm học 2025-2026',
  max_level: 3,
  template_version: 'TT20-2018',
  kind: 'teacher_standard',
  subject: 'person',
  cycle_years: 1,
  standards: [
    {
      code: '1',
      title: 'Phẩm chất nhà giáo',
      criteria: [
        { code: '1', title: 'Đạo đức nhà giáo' },
        { code: '2', title: 'Phong cách nhà giáo' },
      ],
    },
    {
      code: '2',
      title: 'Phát triển chuyên môn, nghiệp vụ',
      criteria: [
        { code: '3', title: 'Phát triển chuyên môn bản thân' },
        {
          code: '4',
          title: 'Xây dựng kế hoạch dạy học và giáo dục theo hướng phát triển phẩm chất, năng lực học sinh',
        },
        {
          code: '5',
          title: 'Sử dụng phương pháp dạy học và giáo dục theo hướng phát triển phẩm chất, năng lực học sinh',
        },
        { code: '6', title: 'Kiểm tra, đánh giá theo hướng phát triển phẩm chất, năng lực học sinh' },
        { code: '7', title: 'Tư vấn và hỗ trợ học sinh' },
      ],
    },
    {
      code: '3',
      title: 'Xây dựng môi trường giáo dục',
      criteria: [
        { code: '8', title: 'Xây dựng văn hóa nhà trường' },
        { code: '9', title: 'Thực hiện quyền dân chủ trong nhà trường' },
        { code: '10', title: 'Thực hiện và xây dựng trường học an toàn, phòng chống bạo lực học đường' },
      ],
    },
    {
      code: '4',
      title: 'Phát triển mối quan hệ giữa nhà trường, gia đình và xã hội',
      criteria: [
        {
          code: '11',
          title: 'Tạo dựng mối quan hệ hợp tác với cha mẹ hoặc người giám hộ của học sinh và các bên liên quan',
        },
        {
          code: '12',
          title: 'Phối hợp giữa nhà trường, gia đình, xã hội để thực hiện hoạt động dạy học cho học sinh',
        },
        {
          code: '13',
          title: 'Phối hợp giữa nhà trường, gia đình, xã hội để thực hiện giáo dục đạo đức, lối sống cho học sinh',
        },
      ],
    },
    {
      code: '5',
      title:
        'Sử dụng ngoại ngữ hoặc tiếng dân tộc, ứng dụng công nghệ thông tin, khai thác và sử dụng thiết bị công nghệ trong dạy học, giáo dục',
      criteria: [
        { code: '14', title: 'Sử dụng ngoại ngữ hoặc tiếng dân tộc' },
        {
          code: '15',
          title: 'Ứng dụng công nghệ thông tin, khai thác và sử dụng thiết bị công nghệ trong dạy học, giáo dục',
        },
      ],
    },
  ],
};
