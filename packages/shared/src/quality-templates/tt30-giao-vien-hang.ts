import type { QualityFrameworkSeed } from '../quality-assurance.js';

// Bộ mẫu chuẩn nghề nghiệp giáo viên theo hạng I, II, III của Thông tư 30/2026/TT-BGDĐT (YCTD-396 lát L6). Mỗi cấp học, mỗi
// hạng một bộ của cá nhân: tiêu chuẩn 1 Đạo đức (Điều 6), 2 Trình độ đào tạo, bồi dưỡng, 3 Năng lực chuyên môn, nghiệp vụ;
// mỗi yêu cầu (điểm a, b, c…) là một tiêu chí chỉ có đáp ứng hoặc chưa, không xếp loại (chờ hướng dẫn của Bộ). Nội dung lấy
// từ bản Công báo số 256 ngày 29/4/2026; tệp sinh bằng tập lệnh, trường đối chiếu văn bản hiện hành
export const TT30_2026_FRAMEWORKS: Record<'TH' | 'THCS' | 'THPT', QualityFrameworkSeed[]> = {
  TH: [
    {
      code: 'GV-TH-H3-2026',
      name: 'Chuẩn nghề nghiệp giáo viên tiểu học hạng III (Thông tư 30/2026)',
      legal_basis: 'Thông tư 30/2026/TT-BGDĐT ngày 14/4/2026, Điều 6, 8, 9',
      max_level: 1,
      template_version: 'TT30-2026',
      kind: 'teacher_standard',
      subject: 'person',
      cycle_years: 1,
      standards: [
        {
          code: '1',
          title: 'Tiêu chuẩn về đạo đức',
          criteria: [
            {
              code: '1.1',
              title:
                'Giữ gìn phẩm chất, uy tín, danh dự nhà giáo; có tinh thần đoàn kết, tôn trọng và hợp tác với đồng nghiệp; có lòng nhân ái, bao dung, độ lượng, tôn trọng và đối xử công bằng, đúng mực đối với học sinh; bảo vệ quyền và lợi ích hợp pháp, chính đáng của học sinh, đồng nghiệp và cộng đồng; thực hành tiết kiệm, chống tham nhũng, lãng phí',
            },
            {
              code: '1.2',
              title:
                'Tâm huyết với nghề, tận tụy với công việc; công bằng trong giảng dạy và giáo dục, đánh giá đúng thực chất năng lực của học sinh, chống bệnh thành tích; đoàn kết, giúp đỡ đồng nghiệp',
            },
            {
              code: '1.3',
              title: 'Thường xuyên trau dồi đạo đức, nêu cao tinh thần trách nhiệm; gương mẫu trước học sinh',
            },
            {
              code: '1.4',
              title:
                'Thực hiện quy tắc ứng xử của nhà giáo và tuân thủ nội quy, quy chế của cơ sở giáo dục phổ thông và các tiêu chuẩn đạo đức nghề nghiệp khác theo quy định của pháp luật',
            },
          ],
        },
        {
          code: '2',
          title: 'Tiêu chuẩn về trình độ đào tạo, bồi dưỡng',
          criteria: [
            {
              code: '2.a',
              title:
                'Có bằng cử nhân trở lên thuộc ngành đào tạo giáo viên tiểu học, trừ trường hợp quy định tại điểm b, điểm c và điểm d khoản này',
            },
            {
              code: '2.b',
              title:
                'Giáo viên giảng dạy môn Giáo dục thể chất phải có bằng cử nhân trở lên thuộc ngành đào tạo giáo viên phù hợp với môn học giảng dạy hoặc có bằng cử nhân trở lên chuyên ngành phù hợp với môn học giảng dạy và có chứng chỉ nghiệp vụ sư phạm đối với giáo viên tiểu học',
            },
            {
              code: '2.c',
              title:
                'Giáo viên giảng dạy môn Nghệ thuật (Âm nhạc, Mĩ thuật), môn Ngoại ngữ, môn Tin học và Công nghệ phải đáp ứng trình độ chuẩn được đào tạo theo quy định tại khoản 2 Điều 20 Nghị định số 93/2026/NĐ-CP ngày 31 tháng 3 năm 2026 của Chính phủ quy định chi tiết và hướng dẫn thi hành một số điều của Luật Nhà giáo',
            },
            {
              code: '2.d',
              title:
                'Giáo viên giảng dạy môn Tiếng dân tộc thiểu số phải đáp ứng trình độ chuẩn được đào tạo theo quy định tại khoản 4 Điều 20 Nghị định số 93/2026/NĐ- CP ngày 31 tháng 3 năm 2026 của Chính phủ quy định chi tiết và hướng dẫn thi hành một số điều của Luật Nhà giáo',
            },
            { code: '2.đ', title: 'Có chứng chỉ bồi dưỡng chuẩn nghề nghiệp giáo viên tiểu học' },
          ],
        },
        {
          code: '3',
          title: 'Tiêu chuẩn về năng lực chuyên môn, nghiệp vụ',
          criteria: [
            {
              code: '3.a',
              title:
                'Nắm được chủ trương, đường lối, chính sách, pháp luật của Đảng, Nhà nước, quy định và yêu cầu của ngành, địa phương về giáo dục tiểu học',
            },
            {
              code: '3.b',
              title:
                'Nắm vững kiến thức của môn học được phân công giảng dạy; xây dựng và thực hiện được kế hoạch dạy học, giáo dục phù hợp với đối tượng học sinh tiểu học, điều kiện của nhà trường và đáp ứng mục tiêu của chương trình giáo dục cấp tiểu học',
            },
            {
              code: '3.c',
              title:
                'Áp dụng được phương pháp dạy học và giáo dục, kiểm tra và đánh giá theo hướng phát triển phẩm chất, năng lực học sinh tiểu học; phát hiện hoặc nhận diện được học sinh có năng khiếu, học sinh được đánh giá chưa đạt để tiếp tục bồi dưỡng',
            },
            {
              code: '3.d',
              title:
                'Phát hiện được các vấn đề bất cập trong tổ chức hoạt động dạy học, giáo dục và đề xuất được giải pháp khắc phục hoặc có năng lực nghiên cứu khoa học, công nghệ và đổi mới sáng tạo theo yêu cầu',
            },
            {
              code: '3.đ',
              title:
                'Hiểu các đối tượng học sinh và nắm vững quy định về công tác tư vấn, hỗ trợ học sinh; thực hiện lồng ghép hoạt động tư vấn, hỗ trợ học sinh trong hoạt động dạy học và giáo dục; hoặc phát hiện được biểu hiện bất thường của học sinh lớp phụ trách trong quá trình học tập và có giải pháp tư vấn, hỗ trợ kịp thời',
            },
            {
              code: '3.e',
              title:
                'Thực hiện quy định về việc tạo dựng môi trường lớp học thân thiện, an toàn, khuyến khích học sinh sự chia sẻ và thể hiện cảm xúc; thực hiện các biện pháp giáo dục kỷ luật tích cực phù hợp với học sinh; thực hiện đầy đủ các quy định của nhà trường về trường học an toàn, phòng chống bạo lực học đường',
            },
            {
              code: '3.g',
              title:
                'Tạo dựng mối quan hệ lành mạnh, tin tưởng với cha mẹ hoặc người giám hộ của học sinh và các bên liên quan trong việc thực hiện dạy học và giáo dục',
            },
            {
              code: '3.h',
              title:
                'Ứng dụng được công nghệ thông tin, công nghệ số trong hoạt động nghề nghiệp; sử dụng được ngoại ngữ hoặc tiếng dân tộc thiểu số theo yêu cầu vị trí việc làm',
            },
          ],
        },
      ],
    },
    {
      code: 'GV-TH-H2-2026',
      name: 'Chuẩn nghề nghiệp giáo viên tiểu học hạng II (Thông tư 30/2026)',
      legal_basis: 'Thông tư 30/2026/TT-BGDĐT ngày 14/4/2026, Điều 6, 8, 9',
      max_level: 1,
      template_version: 'TT30-2026',
      kind: 'teacher_standard',
      subject: 'person',
      cycle_years: 1,
      standards: [
        {
          code: '1',
          title: 'Tiêu chuẩn về đạo đức',
          criteria: [
            {
              code: '1.1',
              title:
                'Giữ gìn phẩm chất, uy tín, danh dự nhà giáo; có tinh thần đoàn kết, tôn trọng và hợp tác với đồng nghiệp; có lòng nhân ái, bao dung, độ lượng, tôn trọng và đối xử công bằng, đúng mực đối với học sinh; bảo vệ quyền và lợi ích hợp pháp, chính đáng của học sinh, đồng nghiệp và cộng đồng; thực hành tiết kiệm, chống tham nhũng, lãng phí',
            },
            {
              code: '1.2',
              title:
                'Tâm huyết với nghề, tận tụy với công việc; công bằng trong giảng dạy và giáo dục, đánh giá đúng thực chất năng lực của học sinh, chống bệnh thành tích; đoàn kết, giúp đỡ đồng nghiệp',
            },
            {
              code: '1.3',
              title: 'Thường xuyên trau dồi đạo đức, nêu cao tinh thần trách nhiệm; gương mẫu trước học sinh',
            },
            {
              code: '1.4',
              title:
                'Thực hiện quy tắc ứng xử của nhà giáo và tuân thủ nội quy, quy chế của cơ sở giáo dục phổ thông và các tiêu chuẩn đạo đức nghề nghiệp khác theo quy định của pháp luật',
            },
          ],
        },
        {
          code: '2',
          title: 'Tiêu chuẩn về trình độ đào tạo, bồi dưỡng',
          criteria: [
            {
              code: '2.a',
              title:
                'Có bằng cử nhân trở lên thuộc ngành đào tạo giáo viên tiểu học, trừ trường hợp quy định tại điểm b khoản này',
            },
            {
              code: '2.b',
              title:
                'Giáo viên giảng dạy môn Giáo dục thể chất, môn Nghệ thuật (Âm nhạc, Mỹ thuật), môn Ngoại ngữ, môn Tin học và Công nghệ, môn Tiếng dân tộc thiểu số phải có bằng cử nhân trở lên thuộc ngành đào tạo giáo viên phù hợp với môn học giảng dạy hoặc có bằng cử nhân trở lên chuyên ngành phù hợp với môn học giảng dạy và có chứng chỉ nghiệp vụ sư phạm đối với giáo viên tiểu học',
            },
            { code: '2.c', title: 'Có chứng chỉ bồi dưỡng chuẩn nghề nghiệp giáo viên tiểu học' },
          ],
        },
        {
          code: '3',
          title: 'Tiêu chuẩn về năng lực chuyên môn, nghiệp vụ',
          criteria: [
            {
              code: '3.a',
              title:
                'Nắm được chủ trương, đường lối, chính sách, pháp luật của Đảng, Nhà nước, quy định và yêu cầu của ngành, địa phương về giáo dục tiểu học và triển khai có hiệu quả vào nhiệm vụ được giao',
            },
            {
              code: '3.b',
              title:
                'Điều chỉnh được kế hoạch dạy học và giáo dục phù hợp với điều kiện thực tế của nhà trường và địa phương; cập nhật, vận dụng linh hoạt và hiệu quả các phương pháp dạy học, giáo dục và hình thức, phương pháp, công cụ kiểm tra đánh giá theo hướng phát triển phẩm chất, năng lực học sinh',
            },
            {
              code: '3.c',
              title:
                'Tổ chức, quản lý lớp học hiệu quả, phát huy được phẩm chất, năng lực của học sinh; bồi dưỡng học sinh có năng khiếu, học sinh còn yếu; xây dựng được môi trường giáo dục thân thiện, dân chủ và an toàn vì sự phát triển của học sinh tiểu học',
            },
            {
              code: '3.d',
              title:
                'Thiết kế được các nội dung bồi dưỡng hoặc chuyên đề bồi dưỡng và sinh hoạt chuyên môn từ cấp tổ chuyên môn trở lên theo yêu cầu đổi mới nội dung, phương pháp, hình thức dạy học, kiểm tra, đánh giá và kỹ năng tổ chức các hoạt động giáo dục nhằm phát triển phẩm chất, năng lực của học sinh tiểu học',
            },
            {
              code: '3.đ',
              title:
                'Thực hiện các biện pháp tư vấn và hỗ trợ phù hợp với từng đối tượng học sinh trong hoạt động dạy học và giáo dục; lồng ghép được các hoạt động tư vấn tâm lý, hướng nghiệp vào trong hoạt động dạy học và giáo dục',
            },
            { code: '3.e', title: 'Có biện pháp xây dựng lớp học, trường học an toàn, phòng chống bạo lực học đường' },
            {
              code: '3.g',
              title:
                'Tạo được mối liên hệ chặt chẽ giữa nhà trường, gia đình, xã hội và đồng nghiệp trong giáo dục học sinh, tạo môi trường học tập giúp học sinh chủ động, tự tin, tự chủ trong học tập và rèn luyện',
            },
            {
              code: '3.h',
              title:
                'Phát hiện được các vấn đề bất cập, đề xuất được giải pháp nâng cao hiệu quả, chất lượng giảng dạy, giáo dục phù hợp với đối tượng học sinh tiểu học; hoặc có năng lực nghiên cứu khoa học, công nghệ và đổi mới sáng tạo phù hợp với chuyên môn giảng dạy, giáo dục',
            },
            {
              code: '3.i',
              title:
                'Ứng dụng được công nghệ thông tin, công nghệ số trong hoạt động nghề nghiệp; sử dụng được ngoại ngữ hoặc tiếng dân tộc thiểu số theo yêu cầu vị trí việc làm',
            },
            {
              code: '3.k',
              title:
                'Được công nhận là chiến sĩ thi đua cấp cơ sở; hoặc được nhận bằng khen, giấy khen từ cấp xã trở lên; hoặc được công nhận đạt một trong các danh hiệu: giáo viên dạy giỏi, giáo viên chủ nhiệm lớp giỏi từ cấp trường trở lên, giáo viên làm Tổng phụ trách Đội Thiếu niên tiền phong Hồ Chí Minh giỏi từ cấp xã trở lên',
            },
          ],
        },
      ],
    },
    {
      code: 'GV-TH-H1-2026',
      name: 'Chuẩn nghề nghiệp giáo viên tiểu học hạng I (Thông tư 30/2026)',
      legal_basis: 'Thông tư 30/2026/TT-BGDĐT ngày 14/4/2026, Điều 6, 8, 9',
      max_level: 1,
      template_version: 'TT30-2026',
      kind: 'teacher_standard',
      subject: 'person',
      cycle_years: 1,
      standards: [
        {
          code: '1',
          title: 'Tiêu chuẩn về đạo đức',
          criteria: [
            {
              code: '1.1',
              title:
                'Giữ gìn phẩm chất, uy tín, danh dự nhà giáo; có tinh thần đoàn kết, tôn trọng và hợp tác với đồng nghiệp; có lòng nhân ái, bao dung, độ lượng, tôn trọng và đối xử công bằng, đúng mực đối với học sinh; bảo vệ quyền và lợi ích hợp pháp, chính đáng của học sinh, đồng nghiệp và cộng đồng; thực hành tiết kiệm, chống tham nhũng, lãng phí',
            },
            {
              code: '1.2',
              title:
                'Tâm huyết với nghề, tận tụy với công việc; công bằng trong giảng dạy và giáo dục, đánh giá đúng thực chất năng lực của học sinh, chống bệnh thành tích; đoàn kết, giúp đỡ đồng nghiệp',
            },
            {
              code: '1.3',
              title: 'Thường xuyên trau dồi đạo đức, nêu cao tinh thần trách nhiệm; gương mẫu trước học sinh',
            },
            {
              code: '1.4',
              title:
                'Thực hiện quy tắc ứng xử của nhà giáo và tuân thủ nội quy, quy chế của cơ sở giáo dục phổ thông và các tiêu chuẩn đạo đức nghề nghiệp khác theo quy định của pháp luật',
            },
          ],
        },
        {
          code: '2',
          title: 'Tiêu chuẩn về trình độ đào tạo, bồi dưỡng',
          criteria: [
            {
              code: '2.a',
              title:
                'Có bằng cử nhân trở lên thuộc ngành đào tạo giáo viên tiểu học, trừ trường hợp quy định tại điểm b khoản này',
            },
            {
              code: '2.b',
              title:
                'Giáo viên giảng dạy môn Giáo dục thể chất, môn Nghệ thuật (Âm nhạc, Mỹ thuật), môn Ngoại ngữ, môn Tin học và Công nghệ, môn Tiếng dân tộc thiểu số phải có bằng cử nhân trở lên thuộc ngành đào tạo giáo viên phù hợp với môn học giảng dạy hoặc có bằng cử nhân trở lên chuyên ngành phù hợp với môn học giảng dạy và có chứng chỉ nghiệp vụ sư phạm đối với giáo viên tiểu học',
            },
            { code: '2.c', title: 'Có chứng chỉ bồi dưỡng chuẩn nghề nghiệp giáo viên tiểu học' },
          ],
        },
        {
          code: '3',
          title: 'Tiêu chuẩn về năng lực chuyên môn, nghiệp vụ',
          criteria: [
            {
              code: '3.a',
              title:
                'Có năng lực dẫn dắt chuyên môn; hướng dẫn, hỗ trợ, chia sẻ với đồng nghiệp về kiến thức, kỹ năng xây dựng, thực hiện hiệu quả kế hoạch dạy học, giáp dục; đổi mới phương pháp dạy học, giáo dục học sinh; đánh giá theo hướng phát triển phẩm chất, năng lực học sinh tiểu học; chia sẻ về phương pháp, kinh nghiệm triển khai hiệu quả hoạt động tư vấn và hỗ trợ vì sự tiến bộ của học sinh và xây dựng trường học an toàn, phòng chống bạo lực học đường',
            },
            {
              code: '3.b',
              title:
                'Chủ trì, tổ chức được hoạt động bồi dưỡng và sinh hoạt chuyên môn, chuyên đề của nhà trường; hoặc biên tập, biên soạn, phát triển được chương trình, tài liệu bồi dưỡng giáo viên, học sinh tiểu học',
            },
            {
              code: '3.c',
              title:
                'Tham gia đánh giá đề tài, sáng kiến trong hoạt động giảng dạy, giáo dục hoặc các hoạt động khoa học, công nghệ và đổi mới sáng tạo cấp trường trở lên; hoặc hướng dẫn học sinh, đồng nghiệp tìm hiểu, nghiên cứu khoa học, công nghệ và ứng dụng vào trong việc thực hiện chương trình giáo dục tiểu học',
            },
            {
              code: '3.d',
              title:
                'Chia sẻ kinh nghiệm tư vấn, hướng dẫn học sinh tiến bộ trong hoạt động dạy học và giáo dục; hoặc kinh nghiệm hoặc biện pháp lồng ghép các hoạt động tư vấn tâm lý, hướng nghiệp vào trong hoạt động dạy học và giáo dục',
            },
            {
              code: '3.đ',
              title:
                'Chia sẻ biện pháp xây dựng trường học an toàn, phòng chống bạo lực học đường; hoặc chia sẻ, hướng dẫn các biện pháp, giải pháp xử lí kịp thời các trường hợp vi phạm quy định về trường học an toàn, phòng chống bạo lực học đường',
            },
            {
              code: '3.e',
              title:
                'Huy động được cha mẹ học sinh hoặc người giám hộ và xã hội trong việc nâng cao chất lượng giảng dạy và giáo dục học sinh',
            },
            {
              code: '3.g',
              title:
                'Ứng dụng được công nghệ thông tin, công nghệ số trong hoạt động nghề nghiệp; sử dụng được ngoại ngữ hoặc tiếng dân tộc thiểu số theo yêu cầu vị trí việc làm',
            },
            {
              code: '3.h',
              title:
                'Được công nhận là chiến sĩ thi đua từ cấp Bộ, ban, ngành, tỉnh (sau đây gọi chung là cấp tỉnh) trở lên; hoặc bằng khen từ cấp tỉnh trở lên; hoặc được công nhận đạt một trong các danh hiệu: giáo viên dạy giỏi, giáo viên chủ nhiệm lớp giỏi, giáo viên làm tổng phụ trách Đội Thiếu niên tiền phong Hồ Chí Minh giỏi từ cấp tỉnh trở lên',
            },
          ],
        },
      ],
    },
  ],
  THCS: [
    {
      code: 'GV-THCS-H3-2026',
      name: 'Chuẩn nghề nghiệp giáo viên trung học cơ sở hạng III (Thông tư 30/2026)',
      legal_basis: 'Thông tư 30/2026/TT-BGDĐT ngày 14/4/2026, Điều 6, 11, 12',
      max_level: 1,
      template_version: 'TT30-2026',
      kind: 'teacher_standard',
      subject: 'person',
      cycle_years: 1,
      standards: [
        {
          code: '1',
          title: 'Tiêu chuẩn về đạo đức',
          criteria: [
            {
              code: '1.1',
              title:
                'Giữ gìn phẩm chất, uy tín, danh dự nhà giáo; có tinh thần đoàn kết, tôn trọng và hợp tác với đồng nghiệp; có lòng nhân ái, bao dung, độ lượng, tôn trọng và đối xử công bằng, đúng mực đối với học sinh; bảo vệ quyền và lợi ích hợp pháp, chính đáng của học sinh, đồng nghiệp và cộng đồng; thực hành tiết kiệm, chống tham nhũng, lãng phí',
            },
            {
              code: '1.2',
              title:
                'Tâm huyết với nghề, tận tụy với công việc; công bằng trong giảng dạy và giáo dục, đánh giá đúng thực chất năng lực của học sinh, chống bệnh thành tích; đoàn kết, giúp đỡ đồng nghiệp',
            },
            {
              code: '1.3',
              title: 'Thường xuyên trau dồi đạo đức, nêu cao tinh thần trách nhiệm; gương mẫu trước học sinh',
            },
            {
              code: '1.4',
              title:
                'Thực hiện quy tắc ứng xử của nhà giáo và tuân thủ nội quy, quy chế của cơ sở giáo dục phổ thông và các tiêu chuẩn đạo đức nghề nghiệp khác theo quy định của pháp luật',
            },
          ],
        },
        {
          code: '2',
          title: 'Tiêu chuẩn về trình độ đào tạo, bồi dưỡng',
          criteria: [
            {
              code: '2.a',
              title:
                'Có bằng cử nhân trở lên thuộc ngành đào tạo giáo viên phù hợp với môn học giảng dạy hoặc có bằng cử nhân trở lên chuyên ngành phù hợp với môn học giảng dạy và có chứng chỉ nghiệp vụ sư phạm đối với giáo viên trung học cơ sở; trừ trường hợp quy định tại điểm b, điểm c khoản này',
            },
            {
              code: '2.b',
              title:
                'Giáo viên dạy môn Nghệ thuật (Âm nhạc, Mĩ thuật) phải đáp ứng trình độ chuẩn được đào tạo theo quy định tại khoản 2 Điều 20 Nghị định số 93/2026/NĐ- CP ngày 31 tháng 3 năm 2026 của Chính phủ quy định chi tiết và hướng dẫn thi hành một số điều của Luật Nhà giáo',
            },
            {
              code: '2.c',
              title:
                'Giáo viên giảng dạy môn Tiếng dân tộc thiểu số phải đáp ứng trình độ chuẩn được đào tạo theo quy định tại khoản 4 Điều 20 Nghị định số 93/2026/NĐ- CP ngày 31 tháng 3 năm 2026 của Chính phủ quy định chi tiết và hướng dẫn thi hành một số điều của Luật Nhà giáo',
            },
            { code: '2.d', title: 'Có chứng chỉ bồi dưỡng chuẩn nghề nghiệp giáo viên trung học cơ sở' },
          ],
        },
        {
          code: '3',
          title: 'Tiêu chuẩn về năng lực chuyên môn, nghiệp vụ',
          criteria: [
            {
              code: '3.a',
              title:
                'Nắm được chủ trương, đường lối, chính sách, pháp luật của Đảng, Nhà nước, quy định và yêu cầu của ngành, địa phương về giáo dục trung học cơ sở',
            },
            {
              code: '3.b',
              title:
                'Hiểu chương trình giáo dục trung học cơ sở, nắm vững kiến thức của môn học được phân công giảng dạy; xây dựng và thực hiện được kế hoạch dạy học, giáo dục phù hợp với môn học, đối tượng học sinh trung học cơ sở, điều kiện của nhà trường và đáp ứng mục tiêu của chương trình giáo dục trung học cơ sở',
            },
            {
              code: '3.c',
              title:
                'Sử dụng phương pháp dạy học và giáo dục, phương pháp kiểm tra và đánh giá kết quả học tập, rèn luyện vì sự tiến bộ của học sinh theo hướng phát triển phẩm chất, năng lực học sinh trung học cơ sở; phát hiện học sinh được đánh giá chưa đạt để tiếp tục bồi dưỡng hoặc phát hiện, bồi dưỡng học sinh có năng khiếu',
            },
            {
              code: '3.d',
              title:
                'Phát hiện được các vấn đề bất cập, đề xuất được giải pháp nâng cao hiệu quả, chất lượng dạy học, giáo dục học sinh trung học cơ sở hoặc tham gia hoạt động khoa học, công nghệ và đổi mới sáng tạo theo yêu cầu',
            },
            {
              code: '3.đ',
              title:
                'Hiểu được đối tượng học sinh trung học cơ sở và thực hiện quy định về công tác tư vấn, hướng nghiệp và hỗ trợ học sinh; hoặc phát hiện được những biểu hiện bất thường của học sinh lớp phụ trách trong quá trình học tập và có giải pháp tư vấn, hỗ trợ kịp thời',
            },
            {
              code: '3.e',
              title:
                'Xây dựng được môi trường lớp học thân thiện, an toàn, khuyến khích học sinh phát triển năng lực; thực hiện các biện pháp giáo dục kỷ luật tích cực phù hợp với học sinh',
            },
            {
              code: '3.g',
              title:
                'Tạo dựng mối quan hệ lành mạnh, tin tưởng với cha mẹ hoặc người giám hộ của học sinh và các bên liên quan trong việc thực hiện dạy học và giáo dục',
            },
            {
              code: '3.h',
              title:
                'Ứng dụng được công nghệ thông tin, công nghệ số trong hoạt động nghề nghiệp; sử dụng được ngoại ngữ hoặc tiếng dân tộc thiểu số theo yêu cầu vị trí việc làm',
            },
          ],
        },
      ],
    },
    {
      code: 'GV-THCS-H2-2026',
      name: 'Chuẩn nghề nghiệp giáo viên trung học cơ sở hạng II (Thông tư 30/2026)',
      legal_basis: 'Thông tư 30/2026/TT-BGDĐT ngày 14/4/2026, Điều 6, 11, 12',
      max_level: 1,
      template_version: 'TT30-2026',
      kind: 'teacher_standard',
      subject: 'person',
      cycle_years: 1,
      standards: [
        {
          code: '1',
          title: 'Tiêu chuẩn về đạo đức',
          criteria: [
            {
              code: '1.1',
              title:
                'Giữ gìn phẩm chất, uy tín, danh dự nhà giáo; có tinh thần đoàn kết, tôn trọng và hợp tác với đồng nghiệp; có lòng nhân ái, bao dung, độ lượng, tôn trọng và đối xử công bằng, đúng mực đối với học sinh; bảo vệ quyền và lợi ích hợp pháp, chính đáng của học sinh, đồng nghiệp và cộng đồng; thực hành tiết kiệm, chống tham nhũng, lãng phí',
            },
            {
              code: '1.2',
              title:
                'Tâm huyết với nghề, tận tụy với công việc; công bằng trong giảng dạy và giáo dục, đánh giá đúng thực chất năng lực của học sinh, chống bệnh thành tích; đoàn kết, giúp đỡ đồng nghiệp',
            },
            {
              code: '1.3',
              title: 'Thường xuyên trau dồi đạo đức, nêu cao tinh thần trách nhiệm; gương mẫu trước học sinh',
            },
            {
              code: '1.4',
              title:
                'Thực hiện quy tắc ứng xử của nhà giáo và tuân thủ nội quy, quy chế của cơ sở giáo dục phổ thông và các tiêu chuẩn đạo đức nghề nghiệp khác theo quy định của pháp luật',
            },
          ],
        },
        {
          code: '2',
          title: 'Tiêu chuẩn về trình độ đào tạo, bồi dưỡng',
          criteria: [
            {
              code: '2.a',
              title:
                'Có bằng cử nhân trở lên thuộc ngành đào tạo giáo viên phù hợp với môn học giảng dạy hoặc có bằng cử nhân trở lên chuyên ngành phù hợp với môn học giảng dạy và có chứng chỉ nghiệp vụ sư phạm đối với giáo viên trung học cơ sở',
            },
            { code: '2.b', title: 'Có chứng chỉ bồi dưỡng chuẩn nghề nghiệp giáo viên trung học cơ sở' },
          ],
        },
        {
          code: '3',
          title: 'Tiêu chuẩn về năng lực chuyên môn, nghiệp vụ',
          criteria: [
            {
              code: '3.a',
              title:
                'Điều chỉnh kế hoạch dạy học và giáo dục phù hợp với điều kiện thực tế của nhà trường và yêu cầu của ngành, địa phương',
            },
            {
              code: '3.b',
              title:
                'Vận dụng linh hoạt và hiệu quả các phương pháp dạy học và giáo dục, các hình thức, phương pháp, công cụ kiểm tra đánh giá theo hướng phát triển phẩm chất, năng lực học sinh đáp ứng yêu cầu đổi mới, phù hợp với điều kiện thực tế',
            },
            {
              code: '3.c',
              title:
                'Tổ chức, quản lý lớp học hiệu quả, phát huy được phẩm chất, năng lực của học sinh; bồi dưỡng học sinh có năng khiếu; xây dựng được môi trường giáo dục thân thiện, dân chủ và an toàn vì sự phát triển của học sinh trung học cơ sở',
            },
            {
              code: '3.d',
              title:
                'Thiết kế được các nội dung bồi dưỡng và sinh hoạt chuyên môn hoặc chuyên đề từ cấp tổ chuyên môn trở lên theo yêu cầu đổi mới nội dung, phương pháp, hình thức dạy học, kiểm tra, đánh giá và kỹ năng tổ chức các hoạt động giáo dục nhằm phát triển phẩm chất, năng lực của học sinh trung học cơ sở',
            },
            {
              code: '3.đ',
              title:
                'Có năng lực đề xuất và ứng dụng hiệu quả giải pháp nâng cao chất lượng dạy học, giáo dục học sinh hoặc tham gia hoạt động khoa học, công nghệ và đổi mới sáng tạo phù hợp với môn học; hoặc tham gia hướng dẫn, đánh giá thực tập sư phạm của sinh viên sư phạm',
            },
            {
              code: '3.e',
              title:
                'Có biện pháp tư vấn tâm lý, hướng nghiệp cho học sinh trung học cơ sở phù hợp hoặc lồng ghép các hoạt động tư vấn tâm lý, hướng nghiệp vào trong hoạt động dạy học và giáo dục',
            },
            {
              code: '3.g',
              title:
                'Xây dựng mối quan hệ chặt chẽ giữa nhà trường, gia đình, xã hội trong giáo dục học sinh, tạo môi trường cho học sinh trung học cơ sở chủ động, tự tin, tự chủ trong học tập, rèn luyện và phát huy được năng lực, sở trường',
            },
            {
              code: '3.h',
              title:
                'Ứng dụng được công nghệ thông tin, công nghệ số trong hoạt động nghề nghiệp; sử dụng được ngoại ngữ hoặc tiếng dân tộc thiểu số theo yêu cầu vị trí việc làm',
            },
            {
              code: '3.i',
              title:
                'Được công nhận là chiến sĩ thi đua cơ sở; hoặc được nhận bằng khen, giấy khen từ cấp xã trở lên; hoặc được công nhận đạt một trong các danh hiệu: giáo viên dạy giỏi, giáo viên chủ nhiệm lớp giỏi từ cấp trường trở lên, giáo viên làm Tổng phụ trách Đội Thiếu niên tiền phong Hồ Chí Minh giỏi từ cấp xã trở lên',
            },
          ],
        },
      ],
    },
    {
      code: 'GV-THCS-H1-2026',
      name: 'Chuẩn nghề nghiệp giáo viên trung học cơ sở hạng I (Thông tư 30/2026)',
      legal_basis: 'Thông tư 30/2026/TT-BGDĐT ngày 14/4/2026, Điều 6, 11, 12',
      max_level: 1,
      template_version: 'TT30-2026',
      kind: 'teacher_standard',
      subject: 'person',
      cycle_years: 1,
      standards: [
        {
          code: '1',
          title: 'Tiêu chuẩn về đạo đức',
          criteria: [
            {
              code: '1.1',
              title:
                'Giữ gìn phẩm chất, uy tín, danh dự nhà giáo; có tinh thần đoàn kết, tôn trọng và hợp tác với đồng nghiệp; có lòng nhân ái, bao dung, độ lượng, tôn trọng và đối xử công bằng, đúng mực đối với học sinh; bảo vệ quyền và lợi ích hợp pháp, chính đáng của học sinh, đồng nghiệp và cộng đồng; thực hành tiết kiệm, chống tham nhũng, lãng phí',
            },
            {
              code: '1.2',
              title:
                'Tâm huyết với nghề, tận tụy với công việc; công bằng trong giảng dạy và giáo dục, đánh giá đúng thực chất năng lực của học sinh, chống bệnh thành tích; đoàn kết, giúp đỡ đồng nghiệp',
            },
            {
              code: '1.3',
              title: 'Thường xuyên trau dồi đạo đức, nêu cao tinh thần trách nhiệm; gương mẫu trước học sinh',
            },
            {
              code: '1.4',
              title:
                'Thực hiện quy tắc ứng xử của nhà giáo và tuân thủ nội quy, quy chế của cơ sở giáo dục phổ thông và các tiêu chuẩn đạo đức nghề nghiệp khác theo quy định của pháp luật',
            },
          ],
        },
        {
          code: '2',
          title: 'Tiêu chuẩn về trình độ đào tạo, bồi dưỡng',
          criteria: [
            {
              code: '2.a',
              title:
                'Có bằng cử nhân trở lên thuộc ngành đào tạo giáo viên phù hợp với môn học giảng dạy hoặc có bằng cử nhân trở lên chuyên ngành phù hợp với môn học giảng dạy và có chứng chỉ nghiệp vụ sư phạm đối với giáo viên trung học cơ sở',
            },
            { code: '2.b', title: 'Có chứng chỉ bồi dưỡng chuẩn nghề nghiệp giáo viên trung học cơ sở' },
          ],
        },
        {
          code: '3',
          title: 'Tiêu chuẩn về năng lực chuyên môn, nghiệp vụ',
          criteria: [
            {
              code: '3.a',
              title:
                'Hướng dẫn, hỗ trợ, chia sẻ với đồng nghiệp về kiến thức, kỹ năng xây dựng, thực hiện hiệu quả kế hoạch dạy học; chia sẻ kinh nghiệm về phương pháp dạy học, giáo dục; phương pháp đánh giá theo hướng phát triển phẩm chất, năng lực học sinh trung học cơ sở',
            },
            {
              code: '3.b',
              title:
                'Hướng dẫn, chia sẻ biện pháp về tư vấn và hỗ trợ vì sự tiến bộ của học sinh và xây dựng trường học an toàn, phòng chống bạo lực học đường, hoặc phương pháp lồng ghép tư vấn, hướng nghiệp trong hoạt động dạy học và giáo dục',
            },
            {
              code: '3.c',
              title:
                'Tổ chức được hoạt động bồi dưỡng và sinh hoạt chuyên môn, chuyên đề của nhà trường; hoặc tham gia biên tập, biên soạn, phát triển chương trình, tài liệu bồi dưỡng giáo viên, học sinh trung học cơ sở',
            },
            {
              code: '3.d',
              title:
                'Tham gia đánh giá đề tài, sáng kiến trong hoạt động giảng dạy, giáo dục hoặc các hoạt động khoa học, công nghệ và đổi mới sáng tạo cấp trường trở lên; hoặc hướng dẫn học sinh, đồng nghiệp tìm hiểu, nghiên cứu khoa học, công nghệ và ứng dụng vào trong việc thực hiện chương trình giáo dục trung học cơ sở',
            },
            {
              code: '3.đ',
              title:
                'Huy động được cha mẹ học sinh hoặc người giám hộ và xã hội trong việc nâng cao chất lượng giảng dạy và giáo dục học sinh của nhà trường',
            },
            {
              code: '3.e',
              title:
                'Ứng dụng được công nghệ thông tin, công nghệ số trong hoạt động nghề nghiệp; sử dụng được ngoại ngữ hoặc tiếng dân tộc thiểu số theo yêu cầu vị trí việc làm',
            },
            {
              code: '3.g',
              title:
                'Được công nhận là chiến sĩ thi đua từ cấp tỉnh trở lên; hoặc bằng khen từ cấp tỉnh trở lên; hoặc được công nhận đạt một trong các danh hiệu: giáo viên dạy giỏi, giáo viên chủ nhiệm lớp giỏi, giáo viên làm tổng phụ trách Đội Thiếu niên tiền phong Hồ Chí Minh giỏi từ cấp tỉnh trở lên',
            },
          ],
        },
      ],
    },
  ],
  THPT: [
    {
      code: 'GV-THPT-H3-2026',
      name: 'Chuẩn nghề nghiệp giáo viên trung học phổ thông hạng III (Thông tư 30/2026)',
      legal_basis: 'Thông tư 30/2026/TT-BGDĐT ngày 14/4/2026, Điều 6, 14, 15',
      max_level: 1,
      template_version: 'TT30-2026',
      kind: 'teacher_standard',
      subject: 'person',
      cycle_years: 1,
      standards: [
        {
          code: '1',
          title: 'Tiêu chuẩn về đạo đức',
          criteria: [
            {
              code: '1.1',
              title:
                'Giữ gìn phẩm chất, uy tín, danh dự nhà giáo; có tinh thần đoàn kết, tôn trọng và hợp tác với đồng nghiệp; có lòng nhân ái, bao dung, độ lượng, tôn trọng và đối xử công bằng, đúng mực đối với học sinh; bảo vệ quyền và lợi ích hợp pháp, chính đáng của học sinh, đồng nghiệp và cộng đồng; thực hành tiết kiệm, chống tham nhũng, lãng phí',
            },
            {
              code: '1.2',
              title:
                'Tâm huyết với nghề, tận tụy với công việc; công bằng trong giảng dạy và giáo dục, đánh giá đúng thực chất năng lực của học sinh, chống bệnh thành tích; đoàn kết, giúp đỡ đồng nghiệp',
            },
            {
              code: '1.3',
              title: 'Thường xuyên trau dồi đạo đức, nêu cao tinh thần trách nhiệm; gương mẫu trước học sinh',
            },
            {
              code: '1.4',
              title:
                'Thực hiện quy tắc ứng xử của nhà giáo và tuân thủ nội quy, quy chế của cơ sở giáo dục phổ thông và các tiêu chuẩn đạo đức nghề nghiệp khác theo quy định của pháp luật',
            },
          ],
        },
        {
          code: '2',
          title: 'Tiêu chuẩn về trình độ đào tạo, bồi dưỡng',
          criteria: [
            {
              code: '2.a',
              title:
                'Có bằng cử nhân trở lên thuộc ngành đào tạo giáo viên phù hợp với môn học giảng dạy hoặc có bằng cử nhân trở lên chuyên ngành phù hợp với môn học giảng dạy và có chứng chỉ nghiệp vụ sư phạm đối với giáo viên trung học phổ thông; trừ trường hợp quy định tại điểm b, điểm c khoản này',
            },
            {
              code: '2.b',
              title:
                'Giáo viên dạy môn Âm nhạc, môn Mĩ thuật phải đáp ứng trình độ chuẩn được đào tạo theo quy định tại khoản 2 Điều 20 Nghị định số 93/2026/NĐ-CP ngày 31 tháng 3 năm 2026 của Chính phủ quy định chi tiết và hướng dẫn thi hành một số điều của Luật Nhà giáo',
            },
            {
              code: '2.c',
              title:
                'Giáo viên giảng dạy môn Tiếng dân tộc thiểu số phải đáp ứng trình độ chuẩn được đào tạo theo quy định tại khoản 4 Điều 20 Nghị định số 93/2026/NĐ- CP ngày 31 tháng 3 năm 2026 của Chính phủ quy định chi tiết và hướng dẫn thi hành một số điều của Luật Nhà giáo',
            },
            { code: '2.d', title: 'Có chứng chỉ bồi dưỡng chuẩn nghề nghiệp giáo viên trung học phổ thông' },
          ],
        },
        {
          code: '3',
          title: 'Tiêu chuẩn về năng lực chuyên môn, nghiệp vụ',
          criteria: [
            {
              code: '3.a',
              title:
                'Nắm được chủ trương, đường lối, chính sách, pháp luật của Đảng, Nhà nước, quy định và yêu cầu của ngành, địa phương về giáo dục trung học phổ thông',
            },
            {
              code: '3.b',
              title:
                'Hiểu chương trình giáo dục trung học phổ thông, nắm vững kiến thức của môn học được phân công giảng dạy; xây dựng và thực hiện được kế hoạch dạy học, giáo dục phù hợp với đối tượng học sinh trung học phổ thông, phù hợp với điều kiện của nhà trường và đáp ứng mục tiêu của chương trình giáo dục trung học phổ thông; chuẩn bị, tổ chức dạy học, giáo dục theo quy định',
            },
            {
              code: '3.c',
              title:
                'Sử dụng phương pháp dạy học và giáo dục, kiểm tra và đánh giá theo hướng phát triển phẩm chất, năng lực học sinh trung học phổ thông; phát hiện học sinh có năng khiếu, học sinh được đánh giá chưa đạt để tiếp tục bồi dưỡng',
            },
            {
              code: '3.d',
              title:
                'Có khả năng hướng dẫn học sinh trung học phổ thông nghiên cứu khoa học, công nghệ và đổi mới sáng tạo từ cấp trường trở lên; hoặc vận dụng các sáng kiến, kết quả nghiên cứu khoa học, công nghệ và đổi mới sáng tạo vào thực tế giảng dạy, giáo dục học sinh hoặc làm đồ dùng, thiết bị dạy học cấp trung học phổ thông',
            },
            {
              code: '3.đ',
              title:
                'Hiểu biết về đặc điểm tâm lý, sinh lý của học sinh trung học phổ thông và nắm vững quy định về công tác tư vấn và hỗ trợ học sinh kịp thời; hoặc phát hiện sớm những biểu hiện bất thường của học sinh trong quá trình giảng dạy, giáo dục và có giải pháp tư vấn, hỗ trợ kịp thời',
            },
            {
              code: '3.e',
              title:
                'Xây dựng được môi trường lớp học thân thiện, an toàn, khuyến khích học sinh chia sẻ và thể hiện cảm xúc; có biện pháp giáo dục kỷ luật tích cực phù hợp với học sinh',
            },
            {
              code: '3.g',
              title:
                'Tạo dựng mối quan hệ lành mạnh, tin tưởng với cha mẹ hoặc người giám hộ của học sinh và các bên liên quan trong việc thực hiện dạy học và giáo dục',
            },
            {
              code: '3.h',
              title:
                'Ứng dụng được công nghệ thông tin, công nghệ số trong hoạt động nghề nghiệp; sử dụng được ngoại ngữ hoặc tiếng dân tộc thiểu số theo yêu cầu vị trí việc làm',
            },
          ],
        },
      ],
    },
    {
      code: 'GV-THPT-H2-2026',
      name: 'Chuẩn nghề nghiệp giáo viên trung học phổ thông hạng II (Thông tư 30/2026)',
      legal_basis: 'Thông tư 30/2026/TT-BGDĐT ngày 14/4/2026, Điều 6, 14, 15',
      max_level: 1,
      template_version: 'TT30-2026',
      kind: 'teacher_standard',
      subject: 'person',
      cycle_years: 1,
      standards: [
        {
          code: '1',
          title: 'Tiêu chuẩn về đạo đức',
          criteria: [
            {
              code: '1.1',
              title:
                'Giữ gìn phẩm chất, uy tín, danh dự nhà giáo; có tinh thần đoàn kết, tôn trọng và hợp tác với đồng nghiệp; có lòng nhân ái, bao dung, độ lượng, tôn trọng và đối xử công bằng, đúng mực đối với học sinh; bảo vệ quyền và lợi ích hợp pháp, chính đáng của học sinh, đồng nghiệp và cộng đồng; thực hành tiết kiệm, chống tham nhũng, lãng phí',
            },
            {
              code: '1.2',
              title:
                'Tâm huyết với nghề, tận tụy với công việc; công bằng trong giảng dạy và giáo dục, đánh giá đúng thực chất năng lực của học sinh, chống bệnh thành tích; đoàn kết, giúp đỡ đồng nghiệp',
            },
            {
              code: '1.3',
              title: 'Thường xuyên trau dồi đạo đức, nêu cao tinh thần trách nhiệm; gương mẫu trước học sinh',
            },
            {
              code: '1.4',
              title:
                'Thực hiện quy tắc ứng xử của nhà giáo và tuân thủ nội quy, quy chế của cơ sở giáo dục phổ thông và các tiêu chuẩn đạo đức nghề nghiệp khác theo quy định của pháp luật',
            },
          ],
        },
        {
          code: '2',
          title: 'Tiêu chuẩn về trình độ đào tạo, bồi dưỡng',
          criteria: [
            {
              code: '2.a',
              title:
                'Có bằng cử nhân trở lên thuộc ngành đào tạo giáo viên phù hợp với môn học giảng dạy hoặc có bằng cử nhân trở lên chuyên ngành phù hợp với môn học giảng dạy và có chứng chỉ nghiệp vụ sư phạm đối với giáo viên trung học phổ thông',
            },
            { code: '2.b', title: 'Có chứng chỉ bồi dưỡng chuẩn nghề nghiệp giáo viên trung học phổ thông' },
          ],
        },
        {
          code: '3',
          title: 'Tiêu chuẩn về năng lực chuyên môn, nghiệp vụ',
          criteria: [
            {
              code: '3.a',
              title:
                'Điều chỉnh được kế hoạch dạy học và giáo dục phù hợp với đối tượng học sinh, điều kiện thực tế của nhà trường và địa phương',
            },
            {
              code: '3.b',
              title:
                'Vận dụng linh hoạt và hiệu quả các phương pháp dạy học, giáo dục; các hình thức, phương pháp kiểm tra đánh giá kết quả học tập vì sự tiến bộ của học sinh theo hướng phát triển phẩm chất, năng lực học sinh, đáp ứng yêu cầu đổi mới, phù hợp với điều kiện thực tế',
            },
            {
              code: '3.c',
              title:
                'Có biện pháp tư vấn tâm lý, hướng nghiệp cho học sinh trung học phổ thông; hoặc lồng ghép các hoạt động tư vấn tâm lý, hướng nghiệp vào trong hoạt động dạy học và giáo dục',
            },
            {
              code: '3.d',
              title:
                'Tổ chức, quản lý lớp học hiệu quả, phát huy được phẩm chất, năng lực của học sinh; xây dựng được môi trường giáo dục thân thiện, dân chủ và an toàn vì sự phát triển của học sinh trung học phổ thông',
            },
            {
              code: '3.đ',
              title:
                'Xây dựng mối quan hệ chặt chẽ giữa nhà trường, gia đình, xã hội trong giáo dục học sinh, tạo môi trường cho học sinh trung học phổ thông chủ động, tự tin, tự chủ trong học tập, rèn luyện và phát huy được năng lực, sở trường',
            },
            {
              code: '3.e',
              title:
                'Thiết kế được các nội dung bồi dưỡng và sinh hoạt chuyên môn hay chuyên đề theo yêu cầu đổi mới nội dung, phương pháp, hình thức dạy học, kiểm tra, đánh giá và kỹ năng tổ chức các hoạt động giáo dục nhằm phát triển phẩm chất, năng lực của học sinh trung học phổ thông',
            },
            {
              code: '3.g',
              title:
                'Có năng lực nghiên cứu và ứng dụng khoa học, công nghệ và đổi mới sáng tạo phù hợp với môn học; hoặc hướng dẫn được học sinh tham gia hoạt động khoa học, công nghệ và đổi mới sáng tạo; hoặc tham gia đánh giá sản phẩm nghiên cứu khoa học, công nghệ và đổi mới sáng tạo của học sinh trung học phổ thông từ cấp trường trở lên',
            },
            {
              code: '3.h',
              title:
                'Ứng dụng được công nghệ thông tin, công nghệ số trong hoạt động nghề nghiệp; sử dụng được ngoại ngữ hoặc tiếng dân tộc thiểu số theo yêu cầu vị trí việc làm',
            },
            {
              code: '3.i',
              title:
                'Được công nhận là chiến sĩ thi đua cơ sở; hoặc được nhận bằng khen, giấy khen từ cấp cơ sở trở lên; hoặc được công nhận đạt một trong các danh hiệu giáo viên dạy giỏi, giáo viên chủ nhiệm lớp giỏi từ cấp trường trở lên',
            },
          ],
        },
      ],
    },
    {
      code: 'GV-THPT-H1-2026',
      name: 'Chuẩn nghề nghiệp giáo viên trung học phổ thông hạng I (Thông tư 30/2026)',
      legal_basis: 'Thông tư 30/2026/TT-BGDĐT ngày 14/4/2026, Điều 6, 14, 15',
      max_level: 1,
      template_version: 'TT30-2026',
      kind: 'teacher_standard',
      subject: 'person',
      cycle_years: 1,
      standards: [
        {
          code: '1',
          title: 'Tiêu chuẩn về đạo đức',
          criteria: [
            {
              code: '1.1',
              title:
                'Giữ gìn phẩm chất, uy tín, danh dự nhà giáo; có tinh thần đoàn kết, tôn trọng và hợp tác với đồng nghiệp; có lòng nhân ái, bao dung, độ lượng, tôn trọng và đối xử công bằng, đúng mực đối với học sinh; bảo vệ quyền và lợi ích hợp pháp, chính đáng của học sinh, đồng nghiệp và cộng đồng; thực hành tiết kiệm, chống tham nhũng, lãng phí',
            },
            {
              code: '1.2',
              title:
                'Tâm huyết với nghề, tận tụy với công việc; công bằng trong giảng dạy và giáo dục, đánh giá đúng thực chất năng lực của học sinh, chống bệnh thành tích; đoàn kết, giúp đỡ đồng nghiệp',
            },
            {
              code: '1.3',
              title: 'Thường xuyên trau dồi đạo đức, nêu cao tinh thần trách nhiệm; gương mẫu trước học sinh',
            },
            {
              code: '1.4',
              title:
                'Thực hiện quy tắc ứng xử của nhà giáo và tuân thủ nội quy, quy chế của cơ sở giáo dục phổ thông và các tiêu chuẩn đạo đức nghề nghiệp khác theo quy định của pháp luật',
            },
          ],
        },
        {
          code: '2',
          title: 'Tiêu chuẩn về trình độ đào tạo, bồi dưỡng',
          criteria: [
            {
              code: '2.a',
              title:
                'Có bằng thạc sĩ trở lên thuộc ngành đào tạo giáo viên phù hợp với môn học giảng dạy hoặc có bằng thạc sĩ trở lên chuyên ngành phù hợp với môn học giảng dạy và có chứng chỉ nghiệp vụ sư phạm đối với giáo viên trung học phổ thông',
            },
            { code: '2.b', title: 'Có chứng chỉ bồi dưỡng chuẩn nghề nghiệp giáo viên trung học phổ thông' },
          ],
        },
        {
          code: '3',
          title: 'Tiêu chuẩn về năng lực chuyên môn, nghiệp vụ',
          criteria: [
            {
              code: '3.a',
              title:
                'Hướng dẫn, hỗ trợ đồng nghiệp trong xây dựng kế hoạch và giáo dục hoặc kinh nghiệm trong việc vận dụng hiệu quả phương pháp dạy học và giáo dục theo hướng phát triển phẩm chất, năng lực học sinh; hoặc triển khai hiệu quả hoạt động tư vấn và hỗ trợ học sinh trung học phổ thông trong hoạt động dạy học và giáo dục',
            },
            {
              code: '3.b',
              title:
                'Có năng lực hướng dẫn, chia sẻ, hỗ trợ đồng nghiệp trong việc sử dụng hiệu quả các hình thức, phương pháp kiểm tra, đánh giá kết quả học tập và sự tiến bộ của học sinh theo hướng phát triển phẩm chất, năng lực học sinh',
            },
            {
              code: '3.c',
              title:
                'Đánh giá hoặc hướng dẫn đồng nghiệp thực hiện hoạt động khoa học, công nghệ và đổi mới sáng tạo; hoặc hướng dẫn, đánh giá sản phẩm nghiên cứu khoa học, công nghệ và đổi mới sáng tạo của học sinh trung học phổ thông từ cấp tỉnh trở lên',
            },
            {
              code: '3.d',
              title: 'Biên tập, biên soạn, phát triển chương trình, tài liệu bồi dưỡng giáo viên, học sinh',
            },
            {
              code: '3.đ',
              title:
                'Tổ chức được hoạt động bồi dưỡng và sinh hoạt chuyên môn, chuyên đề của nhà trường; hướng dẫn đồng nghiệp về kỹ năng xây dựng và thực hiện kế hoạch dạy học và giáo dục; kiến thức, kĩ năng và kinh nghiệm vận dụng phương pháp mới về đánh giá, dạy học và giáo dục theo hướng phát triển phẩm chất, năng lực học sinh trung học phổ thông',
            },
            {
              code: '3.e',
              title:
                'Hướng dẫn, chia sẻ biện pháp hiệu quả về tư vấn tâm lý, hướng nghiệp cho học sinh và phương thức lồng ghép trong hoạt động dạy học và giáo dục',
            },
            {
              code: '3.g',
              title:
                'Đề xuất, thực hiện và đánh giá đề tài, sáng kiến trong hoạt động giảng dạy, giáo dục hoặc các hoạt động khoa học, công nghệ và đổi mới sáng tạo cấp trường trở lên; hướng dẫn học sinh, đồng nghiệp tìm hiểu, nghiên cứu khoa học, công nghệ và ứng dụng vào trong việc thực hiện chương trình giáo dục trung học phổ thông',
            },
            {
              code: '3.h',
              title:
                'Huy động được cha mẹ học sinh hoặc người giám hộ và xã hội trong việc nâng cao chất lượng giảng dạy và giáo dục học sinh',
            },
            {
              code: '3.i',
              title:
                'Ứng dụng được công nghệ thông tin, công nghệ số trong hoạt động nghề nghiệp; sử dụng được ngoại ngữ hoặc tiếng dân tộc thiểu số theo yêu cầu vị trí việc làm',
            },
            {
              code: '3.k',
              title:
                'Được công nhận là chiến sĩ thi đua từ cấp tỉnh trở lên; hoặc bằng khen từ cấp tỉnh trở lên; hoặc được công nhận đạt một trong các danh hiệu giáo viên dạy giỏi, giáo viên chủ nhiệm lớp giỏi từ cấp tỉnh trở lên',
            },
          ],
        },
      ],
    },
  ],
};
