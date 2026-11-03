import type { QualityFrameworkSeed } from '../quality-assurance.js';

// Bộ mẫu chuẩn hiệu trưởng cơ sở giáo dục phổ thông theo Thông tư 14/2018/TT-BGDĐT (YCTD-396 lát L11), bộ của cá nhân. Năm tiêu
// chuẩn, mười tám tiêu chí; mức 1, 2, 3 là Đạt, Khá, Tốt. Tên tiêu chuẩn, tiêu chí đối chiếu biểu mẫu tự đánh giá của Công văn
// 4529/BGDĐT-NGCBQLGD ngày 01/10/2018 (bản đăng lại, đã đọc ở báo cáo khảo sát TEMIS mục 13). Tiêu chí quan trọng khi xếp loại:
// 1, 2, 4, 5, 6, 8, 10, 12, 13, 14; Đạt khi tối thiểu 2/3 tiêu chí từ Đạt (Phụ lục III của Công văn 4529). Chưa nạp mô tả từng
// mức và ví dụ minh chứng (trường nhập từ Excel nếu cần)
export const TT14_2018_PRINCIPAL: QualityFrameworkSeed = {
  code: 'HT-PT-TT14-2018',
  name: 'Chuẩn hiệu trưởng cơ sở giáo dục phổ thông (Thông tư 14/2018)',
  legal_basis: 'Thông tư 14/2018/TT-BGDĐT ngày 20/7/2018; Công văn 4529/BGDĐT-NGCBQLGD ngày 01/10/2018',
  max_level: 3,
  template_version: 'TT14-2018',
  kind: 'principal_standard',
  subject: 'person',
  cycle_years: 1,
  standards: [
    {
      code: '1',
      title: 'Phẩm chất nghề nghiệp',
      criteria: [
        { code: '1', title: 'Đạo đức nghề nghiệp' },
        { code: '2', title: 'Tư tưởng đổi mới trong lãnh đạo, quản trị nhà trường' },
        { code: '3', title: 'Năng lực phát triển chuyên môn, nghiệp vụ bản thân' },
      ],
    },
    {
      code: '2',
      title: 'Quản trị nhà trường',
      criteria: [
        { code: '4', title: 'Tổ chức xây dựng kế hoạch phát triển nhà trường' },
        { code: '5', title: 'Quản trị hoạt động dạy học, giáo dục học sinh' },
        { code: '6', title: 'Quản trị nhân sự nhà trường' },
        { code: '7', title: 'Quản trị tổ chức, hành chính nhà trường' },
        { code: '8', title: 'Quản trị tài chính nhà trường' },
        {
          code: '9',
          title: 'Quản trị cơ sở vật chất, thiết bị và công nghệ trong dạy học, giáo dục học sinh của nhà trường',
        },
        { code: '10', title: 'Quản trị chất lượng giáo dục trong nhà trường' },
      ],
    },
    {
      code: '3',
      title: 'Xây dựng môi trường giáo dục',
      criteria: [
        { code: '11', title: 'Xây dựng văn hóa nhà trường' },
        { code: '12', title: 'Thực hiện dân chủ cơ sở trong nhà trường' },
        { code: '13', title: 'Xây dựng trường học an toàn, phòng chống bạo lực học đường' },
      ],
    },
    {
      code: '4',
      title: 'Phát triển mối quan hệ giữa nhà trường, gia đình, xã hội',
      criteria: [
        { code: '14', title: 'Phối hợp giữa nhà trường, gia đình, xã hội để thực hiện hoạt động dạy học cho học sinh' },
        {
          code: '15',
          title: 'Phối hợp giữa nhà trường, gia đình, xã hội để thực hiện giáo dục đạo đức, lối sống cho học sinh',
        },
        {
          code: '16',
          title:
            'Phối hợp giữa nhà trường, gia đình, xã hội trong huy động và sử dụng nguồn lực để phát triển nhà trường',
        },
      ],
    },
    {
      code: '5',
      title: 'Sử dụng ngoại ngữ và công nghệ thông tin',
      criteria: [
        { code: '17', title: 'Sử dụng ngoại ngữ' },
        { code: '18', title: 'Ứng dụng công nghệ thông tin' },
      ],
    },
  ],
};
