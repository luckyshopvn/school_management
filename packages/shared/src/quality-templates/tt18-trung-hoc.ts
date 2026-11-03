import type { QualityFrameworkSeed } from '../quality-assurance.js';

// Bộ mẫu Kiểm định chất lượng giáo dục trường trung học (Thông tư 18/2018, sửa đổi 2024) (YCTD-396 lát L3, Q-396-6). Tiêu chuẩn, tiêu chí, chỉ báo Mức 1 đến Mức 3 theo văn bản đã sửa đổi;
// yêu cầu Mức 4 là danh sách riêng của trường, không theo tiêu chí, chưa nạp. Chỉ báo không có ký hiệu a, b, c dùng mã "yc".
// Nguồn: https://luatvietnam.vn/giao-duc/thong-tu-18-2018-tt-bgddt-cong-nhan-dat-chuan-quoc-gia-voi-truong-thcs-thpt-167160-d1.html, https://luatvietnam.vn/giao-duc/van-ban-hop-nhat-12-vbhn-bgddt-2024-hop-nhat-thong-tu-ban-hanh-quy-dinh-ve-kiem-dinh-chat-luong-giao-duc-doi-voi-truong-trung-hoc-co-so-truong-trung-hoc-pho-thong-387072-d5.html, https://luatvietnam.vn/giao-duc/thong-tu-22-2024-tt-bgddt-sua-doi-thong-tu-17-2018-tt-bgddt-18-2018-tt-bgddt-19-2018-tt-bgddt-378870-d1.html. Tệp sinh bằng tập lệnh từ dữ liệu đã đối chiếu; trường đối chiếu văn bản hiện hành
export const TRUNG_HOC_KDCL_2024_STANDARDS: QualityFrameworkSeed['standards'] = [
  {
    code: '1',
    title: 'Tổ chức và quản lý nhà trường',
    criteria: [
      {
        code: '1.1',
        title: 'Phương hướng, chiến lược xây dựng và phát triển nhà trường',
        indicators: [
          {
            level: 1,
            code: 'a',
            content:
              'Phù hợp với mục tiêu giáo dục được quy định tại Luật giáo dục, định hướng phát triển kinh tế - xã hội của địa phương theo từng giai đoạn và các nguồn lực của nhà trường;',
          },
          { level: 1, code: 'b', content: 'Được xác định bằng văn bản và cấp có thẩm quyền phê duyệt;' },
          {
            level: 1,
            code: 'c',
            content:
              'Được công bố công khai bằng hình thức niêm yết tại nhà trường hoặc đăng tải trên trang thông tin điện tử của nhà trường (nếu có) hoặc đăng tải trên các phương tiện thông tin đại chúng của địa phương, trang thông tin điện tử của phòng giáo dục và đào tạo, sở giáo dục và đào tạo.',
          },
          {
            level: 2,
            code: 'yc',
            content:
              'Nhà trường có các giải pháp giám sát việc thực hiện phương hướng chiến lược xây dựng và phát triển.',
          },
          {
            level: 3,
            code: 'yc',
            content:
              'Định kỳ rà soát, bổ sung, điều chỉnh phương hướng, chiến lược xây dựng và phát triển. Tổ chức xây dựng phương hướng, chiến lược xây dựng và phát triển có sự tham gia của các thành viên trong Hội đồng trường (Hội đồng quản trị đối với trường tư thục), cán bộ quản lý, giáo viên, nhân viên, học sinh, cha mẹ học sinh và cộng đồng.',
          },
        ],
      },
      {
        code: '1.2',
        title: 'Hội đồng trường (Hội đồng quản trị đối với trường tư thục) và các hội đồng khác',
        indicators: [
          { level: 1, code: 'a', content: 'Được thành lập theo quy định;' },
          { level: 1, code: 'b', content: 'Thực hiện chức năng, nhiệm vụ và quyền hạn theo quy định;' },
          { level: 1, code: 'c', content: 'Các hoạt động được định kỳ rà soát, đánh giá.' },
          {
            level: 2,
            code: 'yc',
            content: 'Hoạt động có hiệu quả, góp phần nâng cao chất lượng giáo dục của nhà trường.',
          },
        ],
      },
      {
        code: '1.3',
        title: 'Tổ chức Đảng Cộng sản Việt Nam, các đoàn thể và tổ chức khác trong nhà trường',
        indicators: [
          {
            level: 1,
            code: 'a',
            content: 'Các đoàn thể và tổ chức khác trong nhà trường có cơ cấu tổ chức theo quy định;',
          },
          { level: 1, code: 'b', content: 'Hoạt động theo quy định;' },
          { level: 1, code: 'c', content: 'Hằng năm, các hoạt động được rà soát, đánh giá.' },
          {
            level: 2,
            code: 'a',
            content:
              'Tổ chức Đảng Cộng sản Việt Nam có cơ cấu tổ chức và hoạt động theo quy định; trong 05 năm liên tiếp tính đến thời điểm đánh giá, có ít nhất 01 năm hoàn thành tốt nhiệm vụ, các năm còn lại hoàn thành nhiệm vụ trở lên;',
          },
          {
            level: 2,
            code: 'b',
            content: 'Các đoàn thể, tổ chức khác có đóng góp tích cực trong các hoạt động của nhà trường.',
          },
          {
            level: 3,
            code: 'a',
            content:
              'Trong 05 năm liên tiếp tính đến thời điểm đánh giá, tổ chức Đảng Cộng sản Việt Nam có ít nhất 02 năm hoàn thành tốt nhiệm vụ, các năm còn lại hoàn thành nhiệm vụ trở lên;',
          },
          {
            level: 3,
            code: 'b',
            content: 'Các đoàn thể, tổ chức khác có đóng góp hiệu quả trong các hoạt động nhà trường và cộng đồng.',
          },
        ],
      },
      {
        code: '1.4',
        title: 'Hiệu trưởng, phó hiệu trưởng, tổ chuyên môn và tổ văn phòng',
        indicators: [
          { level: 1, code: 'a', content: 'Có hiệu trưởng, số lượng phó hiệu trưởng theo quy định;' },
          { level: 1, code: 'b', content: 'Tổ chuyên môn và tổ văn phòng có cơ cấu tổ chức theo quy định;' },
          {
            level: 1,
            code: 'c',
            content: 'Tổ chuyên môn, tổ văn phòng có kế hoạch hoạt động và thực hiện các nhiệm vụ theo quy định.',
          },
          {
            level: 2,
            code: 'a',
            content:
              'Hằng năm, tổ chuyên môn đề xuất và thực hiện được ít nhất 01 (một) chuyên đề có tác dụng nâng cao chất lượng và hiệu quả giáo dục;',
          },
          {
            level: 2,
            code: 'b',
            content: 'Hoạt động của tổ chuyên môn, tổ văn phòng được định kỳ rà soát, đánh giá, điều chỉnh.',
          },
          {
            level: 3,
            code: 'a',
            content:
              'Hoạt động của tổ chuyên môn, tổ văn phòng có đóng góp hiệu quả trong việc nâng cao chất lượng các hoạt động trong nhà trường;',
          },
          {
            level: 3,
            code: 'b',
            content: 'Tổ chuyên môn thực hiện hiệu quả các chuyên đề chuyên môn góp phần nâng cao chất lượng giáo dục.',
          },
        ],
      },
      {
        code: '1.5',
        title: 'Lớp học',
        indicators: [
          { level: 1, code: 'a', content: 'Có đủ các lớp của cấp học;' },
          { level: 1, code: 'b', content: 'Học sinh được tổ chức theo lớp; lớp học được tổ chức theo quy định;' },
          { level: 1, code: 'c', content: 'Lớp học hoạt động theo nguyên tắc tự quản, dân chủ.' },
        ],
      },
      {
        code: '1.6',
        title: 'Quản lý hành chính, tài chính và tài sản',
        indicators: [
          { level: 1, code: 'a', content: 'Hệ thống hồ sơ của nhà trường được lưu trữ theo quy định;' },
          {
            level: 1,
            code: 'b',
            content:
              'Lập dự toán, thực hiện thu chi, quyết toán, thống kê, báo cáo tài chính và tài sản; công khai và định kỳ tự kiểm tra tài chính, tài sản theo quy định; quy chế chi tiêu nội bộ được bổ sung, cập nhật phù hợp với điều kiện thực tế và các quy định hiện hành;',
          },
          {
            level: 1,
            code: 'c',
            content:
              'Quản lý, sử dụng tài chính, tài sản đúng mục đích và có hiệu quả để phục vụ các hoạt động giáo dục.',
          },
          {
            level: 2,
            code: 'a',
            content:
              'Ứng dụng công nghệ thông tin hiệu quả trong công tác quản lý hành chính, tài chính và tài sản của nhà trường;',
          },
          {
            level: 2,
            code: 'b',
            content:
              'Trong 05 năm liên tiếp tính đến thời điểm đánh giá, không có vi phạm liên quan đến việc quản lý hành chính, tài chính và tài sản theo kết luận của thanh tra, kiểm toán.',
          },
          {
            level: 3,
            code: 'yc',
            content:
              'Có kế hoạch ngắn hạn, trung hạn và dài hạn để tạo các nguồn tài chính hợp pháp phù hợp với điều kiện nhà trường, thực tế địa phương.',
          },
        ],
      },
      {
        code: '1.7',
        title: 'Quản lý cán bộ, giáo viên và nhân viên',
        indicators: [
          {
            level: 1,
            code: 'a',
            content: 'Có kế hoạch bồi dưỡng chuyên môn, nghiệp vụ cho đội ngũ cán bộ quản lý, giáo viên và nhân viên;',
          },
          {
            level: 1,
            code: 'b',
            content:
              'Phân công, sử dụng cán bộ quản lý, giáo viên, nhân viên rõ ràng, hợp lý đảm bảo hiệu quả hoạt động của nhà trường;',
          },
          {
            level: 1,
            code: 'c',
            content: 'Cán bộ quản lý, giáo viên và nhân viên được đảm bảo các quyền theo quy định.',
          },
          {
            level: 2,
            code: 'yc',
            content:
              'Có các biện pháp để phát huy năng lực của cán bộ quản lý, giáo viên, nhân viên trong việc xây dựng, phát triển và nâng cao chất lượng giáo dục nhà trường.',
          },
        ],
      },
      {
        code: '1.8',
        title: 'Quản lý các hoạt động giáo dục',
        indicators: [
          {
            level: 1,
            code: 'a',
            content:
              'Kế hoạch giáo dục phù hợp với quy định hiện hành, điều kiện thực tế địa phương và điều kiện của nhà trường;',
          },
          {
            level: 1,
            code: 'b',
            content:
              'Kế hoạch giáo dục được xây dựng, phê duyệt và được rà soát, đánh giá, điều chỉnh kịp thời theo quy định;',
          },
          {
            level: 1,
            code: 'c',
            content:
              'Hình thức tổ chức hoạt động giáo dục đáp ứng mục tiêu, yêu cầu của chương trình giáo dục, đảm bảo chất lượng, hiệu quả.',
          },
          {
            level: 2,
            code: 'yc',
            content:
              'Các biện pháp chỉ đạo, kiểm tra, đánh giá của nhà trường đối với các hoạt động giáo dục, được cơ quan quản lý đánh giá đạt hiệu quả. Quản lý hoạt động dạy thêm, học thêm trong nhà trường theo quy định (nếu có).',
          },
        ],
      },
      {
        code: '1.9',
        title: 'Thực hiện quy chế dân chủ cơ sở',
        indicators: [
          {
            level: 1,
            code: 'a',
            content:
              'Cán bộ quản lý, giáo viên, nhân viên được tham gia thảo luận, đóng góp ý kiến khi xây dựng kế hoạch, nội quy, quy định, quy chế liên quan đến các hoạt động của nhà trường;',
          },
          {
            level: 1,
            code: 'b',
            content:
              'Các khiếu nại, tố cáo, kiến nghị, phản ánh (nếu có) thuộc thẩm quyền xử lý của nhà trường được giải quyết đúng pháp luật;',
          },
          { level: 1, code: 'c', content: 'Hằng năm, có báo cáo thực hiện quy chế dân chủ cơ sở.' },
          {
            level: 2,
            code: 'yc',
            content:
              'Các biện pháp và cơ chế giám sát việc thực hiện quy chế dân chủ cơ sở đảm bảo công khai, minh bạch, hiệu quả.',
          },
        ],
      },
      {
        code: '1.10',
        title: 'Đảm bảo an ninh trật tự, an toàn trường học',
        indicators: [
          {
            level: 1,
            code: 'a',
            content:
              'Đảm bảo theo quy định về an ninh trật tự; an toàn vệ sinh thực phẩm; an toàn phòng, chống cháy, nổ; an toàn phòng, chống thảm họa, thiên tai; phòng, chống dịch bệnh; phòng, chống các tệ nạn xã hội và phòng, chống bạo lực trong nhà trường; an toàn phòng, chống tai nạn, thương tích;',
          },
          {
            level: 1,
            code: 'b',
            content:
              'Có hộp thư góp ý, đường dây nóng và các hình thức khác để tiếp nhận, xử lý các thông tin phản ánh của người dân; đảm bảo an toàn cho cán bộ quản lý, giáo viên, nhân viên và học sinh trong nhà trường;',
          },
          {
            level: 1,
            code: 'c',
            content:
              'Không có hiện tượng kỳ thị, hành vi bạo lực, vi phạm pháp luật về bình đẳng giới trong nhà trường.',
          },
          {
            level: 2,
            code: 'a',
            content:
              'Cán bộ quản lý, giáo viên, nhân viên và học sinh được phổ biến, hướng dẫn và thực hiện phương án đảm bảo an ninh trật tự; vệ sinh an toàn thực phẩm; an toàn phòng, chống tai nạn, thương tích; an toàn phòng, chống cháy, nổ; an toàn phòng, chống thảm họa, thiên tai; phòng, chống dịch bệnh; phòng, chống các tệ nạn xã hội và phòng, chống bạo lực trong nhà trường;',
          },
          {
            level: 2,
            code: 'b',
            content:
              'Nhà trường thường xuyên kiểm tra, thu thập, đánh giá, xử lý các thông tin, biểu hiện liên quan đến bạo lực học đường, an ninh trật tự và có biện pháp ngăn chặn kịp thời, hiệu quả',
          },
        ],
      },
    ],
  },
  {
    code: '2',
    title: 'Cán bộ quản lý, giáo viên, nhân viên và học sinh',
    criteria: [
      {
        code: '2.1',
        title: 'Đối với hiệu trưởng, phó hiệu trưởng',
        indicators: [
          { level: 1, code: 'a', content: 'Đạt tiêu chuẩn theo quy định;' },
          { level: 1, code: 'b', content: 'Được đánh giá đạt chuẩn hiệu trưởng trở lên;' },
          { level: 1, code: 'c', content: 'Được bồi dưỡng, tập huấn về chuyên môn, nghiệp vụ theo quy định.' },
          {
            level: 2,
            code: 'a',
            content:
              'Trong 05 năm liên tiếp tính đến thời điểm đánh giá, có ít nhất 02 năm được đánh giá đạt chuẩn hiệu trưởng ở mức khá trở lên;',
          },
          {
            level: 2,
            code: 'b',
            content:
              'Được bồi dưỡng, tập huấn về lý luận chính trị theo quy định; được giáo viên, nhân viên trong trường tín nhiệm.',
          },
          {
            level: 3,
            code: 'yc',
            content:
              'Trong 05 năm liên tiếp tính đến thời điểm đánh giá, được đánh giá đạt chuẩn hiệu trưởng ở mức khá trở lên, trong đó có ít nhất 01 năm được đánh giá đạt chuẩn hiệu trưởng ở mức tốt.',
          },
        ],
      },
      {
        code: '2.2',
        title: 'Đối với giáo viên',
        indicators: [
          {
            level: 1,
            code: 'a',
            content:
              'Số lượng, cơ cấu giáo viên đảm bảo thực hiện Chương trình giáo dục và tổ chức các hoạt động giáo dục;',
          },
          {
            level: 1,
            code: 'b',
            content:
              'Tỷ lệ giáo viên đạt chuẩn trình độ đào tạo đảm bảo quy định của Chính phủ và lộ trình nâng chuẩn trình độ đào tạo giáo viên theo kế hoạch của tỉnh, thành phố trực thuộc trung ương;',
          },
          {
            level: 1,
            code: 'c',
            content: 'Có ít nhất 95% giáo viên đạt chuẩn nghề nghiệp giáo viên ở mức đạt trở lên.',
          },
          {
            level: 2,
            code: 'b',
            content:
              'Trong 05 năm liên tiếp tính đến thời điểm đánh giá, có 100% giáo viên đạt chuẩn nghề nghiệp giáo viên ở mức đạt trở lên, trong đó có ít nhất 60% đạt chuẩn nghề nghiệp giáo viên ở mức khá trở lên và có ít nhất 50% ở mức khá trở lên đối với trường thuộc vùng khó khăn;',
          },
          {
            level: 2,
            code: 'c',
            content:
              'Có khả năng tổ chức các hoạt động trải nghiệm, hướng nghiệp, định hướng phân luồng cho học sinh; có khả năng hướng dẫn nghiên cứu khoa học; trong 05 năm liên tiếp tính đến thời điểm đánh giá không có giáo viên bị kỷ luật từ hình thức cảnh cáo trở lên.',
          },
          {
            level: 3,
            code: 'a',
            content:
              'Trong 05 năm liên tiếp tính đến thời điểm đánh giá, có ít nhất 80% giáo viên đạt chuẩn nghề nghiệp giáo viên ở mức khá trở lên, trong đó có ít nhất 30% đạt chuẩn nghề nghiệp giáo viên ở mức tốt; đối với trường thuộc vùng khó khăn có ít nhất 70% đạt chuẩn nghề nghiệp giáo viên ở mức khá trở lên, trong đó có ít nhất 20% đạt chuẩn nghề nghiệp giáo viên ở mức tốt;',
          },
          {
            level: 3,
            code: 'b',
            content:
              'Trong 05 năm liên tiếp tính đến thời điểm đánh giá, giáo viên có báo cáo kết quả nghiên cứu khoa học.',
          },
        ],
      },
      {
        code: '2.3',
        title: 'Đối với nhân viên',
        indicators: [
          {
            level: 1,
            code: 'a',
            content: 'Có nhân viên hoặc giáo viên kiêm nhiệm để đảm nhiệm các nhiệm vụ do hiệu trưởng phân công;',
          },
          { level: 1, code: 'b', content: 'Được phân công công việc phù hợp, hợp lý theo năng lực;' },
          { level: 1, code: 'c', content: 'Hoàn thành các nhiệm vụ được giao.' },
          { level: 2, code: 'a', content: 'Số lượng và cơ cấu nhân viên đảm bảo theo quy định;' },
          {
            level: 2,
            code: 'b',
            content:
              'Trong 05 năm liên tiếp tính đến thời điểm đánh giá, không có nhân viên bị kỷ luật từ hình thức cảnh cáo trở lên.',
          },
          { level: 3, code: 'a', content: 'Có trình độ đào tạo đáp ứng được vị trí việc làm;' },
          {
            level: 3,
            code: 'b',
            content:
              'Hằng năm, được tham gia đầy đủ các khóa, lớp tập huấn, bồi dưỡng chuyên môn, nghiệp vụ theo vị trí việc làm.',
          },
        ],
      },
      {
        code: '2.4',
        title: 'Đối với học sinh',
        indicators: [
          { level: 1, code: 'a', content: 'Đảm bảo về tuổi học sinh theo quy định;' },
          { level: 1, code: 'b', content: 'Thực hiện các nhiệm vụ theo quy định;' },
          { level: 1, code: 'c', content: 'Được đảm bảo các quyền theo quy định.' },
          {
            level: 2,
            code: 'yc',
            content:
              'Học sinh vi phạm các hành vi không được làm được phát hiện kịp thời, được áp dụng các biện pháp giáo dục phù hợp và có chuyển biến tích cực.',
          },
          {
            level: 3,
            code: 'yc',
            content:
              'Học sinh có thành tích trong học tập, rèn luyện có ảnh hưởng tích cực đến các hoạt động của lớp và nhà trường.',
          },
        ],
      },
    ],
  },
  {
    code: '3',
    title: 'Cơ sở vật chất và thiết bị dạy học',
    criteria: [
      {
        code: '3.1',
        title: 'Địa điểm, quy mô, diện tích đảm bảo theo quy định của Bộ Giáo dục và Đào tạo, bao gồm',
        indicators: [
          { level: 1, code: 'a', content: 'Vị trí đặt trường, điểm trường;' },
          { level: 1, code: 'b', content: 'Quy mô;' },
          {
            level: 1,
            code: 'c',
            content: 'Diện tích khu đất xây dựng trường, điểm trường, diện tích sàn xây dựng các hạng mục công trình.',
          },
        ],
      },
      {
        code: '3.2',
        title:
          'Các hạng mục công trình đảm bảo tiêu chuẩn cơ sở vật chất tối thiểu theo quy định của Bộ Giáo dục và Đào tạo, bao gồm',
        indicators: [
          { level: 1, code: 'a', content: 'Khối phòng hành chính quản trị;' },
          { level: 1, code: 'b', content: 'Khối phòng học tập; khối phòng hỗ trợ học tập;' },
          { level: 1, code: 'c', content: 'Khối phụ trợ; khu sân chơi, thể dục thể thao; khối phục vụ sinh hoạt.' },
          { level: 2, code: 'a', content: 'Khối phòng hành chính quản trị;' },
          { level: 2, code: 'b', content: 'Khối phòng học tập; khối phòng hỗ trợ học tập;' },
          { level: 2, code: 'c', content: 'Khối phụ trợ; khu sân chơi, thể dục thể thao; khối phục vụ sinh hoạt.' },
          { level: 3, code: 'a', content: 'Khối phòng học tập; khối phòng hỗ trợ học tập;' },
          { level: 3, code: 'b', content: 'Khối phụ trợ; khu sân chơi, thể dục thể thao.' },
        ],
      },
      {
        code: '3.3',
        title:
          'Hạ tầng kỹ thuật, các hạng mục công trình kiên cố và thiết bị dạy học đảm bảo tiêu chuẩn cơ sở vật chất tối thiểu theo quy định của Bộ Giáo dục và Đào tạo, bao gồm',
        indicators: [
          {
            level: 1,
            code: 'a',
            content:
              'Hệ thống cấp nước sạch; hệ thống cấp điện; hệ thống phòng cháy, chữa cháy; hạ tầng công nghệ thông tin, liên lạc và khu thu gom rác thải;',
          },
          { level: 1, code: 'b', content: 'Tỷ lệ các hạng mục công trình kiên cố;' },
          { level: 1, code: 'c', content: 'Thiết bị dạy học.' },
        ],
      },
    ],
  },
  {
    code: '4',
    title: 'Quan hệ giữa nhà trường, gia đình và xã hội',
    criteria: [
      {
        code: '4.1',
        title: 'Ban đại diện cha mẹ học sinh',
        indicators: [
          {
            level: 1,
            code: 'a',
            content: 'Được thành lập và hoạt động theo quy định tại Điều lệ Ban đại diện cha mẹ học sinh;',
          },
          { level: 1, code: 'b', content: 'Có kế hoạch hoạt động theo năm học;' },
          { level: 1, code: 'c', content: 'Tổ chức thực hiện kế hoạch hoạt động đúng tiến độ.' },
          {
            level: 2,
            code: 'yc',
            content:
              'Phối hợp có hiệu quả với nhà trường trong việc tổ chức thực hiện nhiệm vụ năm học và các hoạt động giáo dục; hướng dẫn, tuyên truyền, phổ biến pháp luật, chủ trương chính sách về giáo dục đối với cha mẹ học sinh; huy động học sinh đến trường, vận động học sinh đã bỏ học trở lại lớp.',
          },
          {
            level: 3,
            code: 'yc',
            content:
              'Phối hợp có hiệu quả với nhà trường, xã hội trong việc thực hiện các nhiệm vụ theo quy định của Điều lệ Ban đại diện cha mẹ học sinh.',
          },
        ],
      },
      {
        code: '4.2',
        title: 'Công tác tham mưu cấp ủy đảng, chính quyền và phối hợp với các tổ chức, cá nhân của nhà trường',
        indicators: [
          {
            level: 1,
            code: 'a',
            content: 'Tham mưu cấp ủy đảng, chính quyền để thực hiện kế hoạch giáo dục của nhà trường;',
          },
          {
            level: 1,
            code: 'b',
            content:
              'Tuyên truyền nâng cao nhận thức và trách nhiệm của cộng đồng về chủ trương, chính sách của Đảng, Nhà nước, ngành Giáo dục; về mục tiêu, nội dung và kế hoạch giáo dục của nhà trường;',
          },
          {
            level: 1,
            code: 'c',
            content: 'Huy động và sử dụng các nguồn lực hợp pháp của các tổ chức, cá nhân đúng quy định.',
          },
          {
            level: 2,
            code: 'a',
            content:
              'Tham mưu cấp ủy đảng, chính quyền để tạo điều kiện cho nhà trường thực hiện phương hướng, chiến lược xây dựng và phát triển;',
          },
          {
            level: 2,
            code: 'b',
            content:
              'Phối hợp với các tổ chức, đoàn thể, cá nhân để giáo dục truyền thống lịch sử, văn hóa, đạo đức lối sống, pháp luật, nghệ thuật, thể dục thể thao và các nội dung giáo dục khác cho học sinh; chăm sóc di tích lịch sử, cách mạng, công trình văn hóa; chăm sóc gia đình thương binh, liệt sĩ, gia đình có công với cách mạng, Bà mẹ Việt Nam anh hùng ở địa phương.',
          },
          {
            level: 3,
            code: 'yc',
            content:
              'Tham mưu cấp ủy Đảng, chính quyền và phối hợp có hiệu quả với các tổ chức, cá nhân xây dựng nhà trường trở thành trung tâm văn hóa, giáo dục của địa phương.',
          },
        ],
      },
    ],
  },
  {
    code: '5',
    title: 'Hoạt động giáo dục và kết quả giáo dục',
    criteria: [
      {
        code: '5.1',
        title: 'Thực hiện kế hoạch giáo dục',
        indicators: [
          {
            level: 1,
            code: 'a',
            content: 'Xây dựng kế hoạch giáo dục nhà trường theo quy định của Bộ Giáo dục và Đào tạo;',
          },
          {
            level: 1,
            code: 'b',
            content:
              'Tổ chức thực hiện kế hoạch giáo dục nhà trường đầy đủ theo quy định của Bộ Giáo dục và Đào tạo và phù hợp với điều kiện thực tế của nhà trường; đổi mới phương pháp, hình thức tổ chức dạy học, phát huy tính chủ động, tích cực, tự học của học sinh;',
          },
          {
            level: 1,
            code: 'c',
            content:
              'Tổ chức kiểm tra, rà soát đánh giá và điều chỉnh kế hoạch giáo dục nhà trường theo khung kế hoạch thời gian năm học theo quy định của Bộ Giáo dục và Đào tạo.',
          },
          {
            level: 2,
            code: 'a',
            content:
              'Thực hiện đúng chương trình, kế hoạch giáo dục; lựa chọn nội dung, thời lượng, phương pháp, hình thức dạy học phù hợp với từng đối tượng và đáp ứng yêu cầu, khả năng nhận thức của học sinh;',
          },
          {
            level: 2,
            code: 'b',
            content:
              'Phát hiện và bồi dưỡng học sinh có năng khiếu, phụ đạo học sinh gặp khó khăn trong học tập, rèn luyện.',
          },
          {
            level: 3,
            code: 'yc',
            content:
              'Hằng năm, rà soát, phân tích, đánh giá hiệu quả và tác động của các biện pháp, giải pháp tổ chức các hoạt động giáo dục nhằm nâng cao chất lượng dạy học của giáo viên, học sinh.',
          },
        ],
      },
      {
        code: '5.2',
        title:
          'Tổ chức hoạt động giáo dục cho học sinh có hoàn cảnh khó khăn, học sinh có năng khiếu, học sinh gặp khó khăn trong học tập và rèn luyện',
        indicators: [
          {
            level: 1,
            code: 'a',
            content:
              'Có kế hoạch giáo dục cho học sinh có hoàn cảnh khó khăn, học sinh có năng khiếu, học sinh gặp khó khăn trong học tập và rèn luyện;',
          },
          {
            level: 1,
            code: 'b',
            content:
              'Tổ chức thực hiện kế hoạch hoạt động giáo dục cho học sinh có hoàn cảnh khó khăn, học sinh có năng khiếu, học sinh gặp khó khăn trong học tập và rèn luyện;',
          },
          {
            level: 1,
            code: 'c',
            content:
              'Hằng năm rà soát, đánh giá các hoạt động giáo dục học sinh có hoàn cảnh khó khăn, học sinh có năng khiếu, học sinh gặp khó khăn trong học tập và rèn luyện.',
          },
          {
            level: 2,
            code: 'yc',
            content:
              'Học sinh có hoàn cảnh khó khăn, học sinh có năng khiếu, học sinh gặp khó khăn trong học tập và rèn luyện đáp ứng được mục tiêu giáo dục theo kế hoạch giáo dục.',
          },
          {
            level: 3,
            code: 'yc',
            content:
              'Nhà trường có học sinh năng khiếu về các môn học, thể thao, nghệ thuật được cấp có thẩm quyền ghi nhận.',
          },
        ],
      },
      {
        code: '5.3',
        title: 'Thực hiện nội dung giáo dục địa phương theo quy định',
        indicators: [
          {
            level: 2,
            code: 'yc',
            content: 'Nội dung giáo dục địa phương phù hợp với mục tiêu môn học và gắn lý luận với thực tiễn.',
          },
        ],
      },
      {
        code: '5.4',
        title: 'Các hoạt động trải nghiệm và hướng nghiệp',
        indicators: [
          {
            level: 2,
            code: 'a',
            content:
              'Tổ chức được các hoạt động trải nghiệm, hướng nghiệp với các hình thức phong phú phù hợp học sinh và đạt kết quả thiết thực;',
          },
          {
            level: 2,
            code: 'b',
            content: 'Định kỳ rà soát, đánh giá kế hoạch tổ chức các hoạt động trải nghiệm, hướng nghiệp.',
          },
        ],
      },
      {
        code: '5.5',
        title: 'Hình thành, phát triển các kỹ năng sống cho học sinh',
        indicators: [
          { level: 2, code: 'a', content: 'Hướng dẫn học sinh biết tự đánh giá kết quả học tập và rèn luyện;' },
          {
            level: 2,
            code: 'b',
            content: 'Khả năng vận dụng kiến thức vào thực tiễn của học sinh từng bước hình thành và phát triển.',
          },
          {
            level: 3,
            code: 'yc',
            content:
              'Bước đầu, học sinh có khả năng nghiên cứu khoa học, công nghệ theo người hướng dẫn, chuyên gia khoa học và người giám sát chỉ dẫn.',
          },
        ],
      },
      {
        code: '5.6',
        title: 'Kết quả giáo dục',
        indicators: [
          {
            level: 1,
            code: 'a',
            content: 'Kết quả học tập, rèn luyện của học sinh đạt yêu cầu theo kế hoạch của nhà trường;',
          },
          {
            level: 1,
            code: 'b',
            content: 'Tỷ lệ học sinh lên lớp và tốt nghiệp đạt yêu cầu theo kế hoạch của nhà trường;',
          },
          {
            level: 1,
            code: 'c',
            content: 'Định hướng phân luồng cho học sinh đạt yêu cầu theo kế hoạch của nhà trường.',
          },
          {
            level: 2,
            code: 'a',
            content:
              'Kết quả học tập, rèn luyện của học sinh có chuyển biến tích cực trong 05 năm liên tiếp tính đến thời điểm đánh giá;',
          },
          {
            level: 2,
            code: 'b',
            content:
              'Tỷ lệ học sinh lên lớp và tốt nghiệp có chuyển biến tích cực trong 05 năm liên tiếp tính đến thời điểm đánh giá.',
          },
          {
            level: 3,
            code: 'a',
            content:
              'Kết quả học tập, rèn luyện của học sinh:\n- Kết quả học tập theo mức Tốt: tỷ lệ học sinh được đánh giá theo mức Tốt của trường thuộc vùng khó khăn đạt từ 5% trở lên đối với trường trung học cơ sở, trường trung học phổ thông và từ 20% trở lên đối với trường chuyên; tỷ lệ học sinh được đánh giá theo mức Tốt của trường thuộc các vùng còn lại đạt từ 10% trở lên đối với trường trung học cơ sở, trường trung học phổ thông và từ 25% trở lên đối với trường chuyên;\n- Kết quả học tập theo mức Khá: tỷ lệ học sinh được đánh giá theo mức Khá của trường thuộc vùng khó khăn đạt từ 30% trở lên đối với trường trung học cơ sở, từ 20% trở lên đối với trường trung học phổ thông và từ 55% trở lên đối với trường chuyên; tỷ lệ học sinh được đánh giá theo mức Khá của trường thuộc các vùng còn lại đạt từ 35% trở lên đối với trường trung học cơ sở, từ 25% trở lên đối với trường trung học phổ thông và từ 60% trở lên đối với trường chuyên;\n- Kết quả học tập theo mức Chưa đạt: tỷ lệ học sinh được đánh giá theo mức Chưa đạt của trường trung học cơ sở, trường trung học phổ thông thuộc vùng khó khăn không quá 10%; tỷ lệ học sinh được đánh giá theo mức Chưa đạt của trường trung học cơ sở, trường trung học phổ thông thuộc các vùng còn lại không quá 5%; trường chuyên không có học sinh xếp loại Chưa đạt;\n- Kết quả rèn luyện: tỷ lệ học sinh trường trung học cơ sở, trường trung học phổ thông được đánh giá ở mức Khá, Tốt từ 90% trở lên và từ 98% trở lên đối với trường chuyên;',
          },
          {
            level: 3,
            code: 'b',
            content:
              'Tỷ lệ học sinh bỏ học và không được lên lớp:\n- Vùng khó khăn: không quá 3% học sinh bỏ học, không quá 5% học sinh không được lên lớp; trường chuyên không có học sinh không được lên lớp và không có học sinh bỏ học;\n- Các vùng còn lại: không quá 1% học sinh bỏ học, không quá 2% học sinh không được lên lớp; trường chuyên không có học sinh không được lên lớp và không có học sinh bỏ học.',
          },
        ],
      },
    ],
  },
];

export const TRUNG_HOC_KDCL_2024_SOURCE = {
  name: 'Kiểm định chất lượng giáo dục trường trung học (Thông tư 18/2018, sửa đổi 2024)',
  legal_basis:
    'Thông tư 18/2018/TT-BGDĐT, sửa đổi, bổ sung bởi Thông tư 22/2024/TT-BGDĐT; văn bản hợp nhất 12/VBHN-BGDĐT ngày 31/12/2024',
  template_version: 'TT18-2018-sua-doi-TT22-2024',
} as const;
