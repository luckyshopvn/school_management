import type { QualityFrameworkSeed } from '../quality-assurance.js';

// Bộ mẫu Kiểm định chất lượng giáo dục trường tiểu học (Thông tư 17/2018, sửa đổi 2024) (YCTD-396 lát L3, Q-396-6). Tiêu chuẩn, tiêu chí, chỉ báo Mức 1 đến Mức 3 theo văn bản đã sửa đổi;
// yêu cầu Mức 4 là danh sách riêng của trường, không theo tiêu chí, chưa nạp. Chỉ báo không có ký hiệu a, b, c dùng mã "yc".
// Nguồn: https://luatvietnam.vn/giao-duc/thong-tu-17-2018-tt-bgddt-cong-nhan-dat-chuan-quoc-gia-voi-truong-tieu-hoc-167161-d1.html, https://luatvietnam.vn/giao-duc/van-ban-hop-nhat-11-vbhn-bgddt-2024-hop-nhat-thong-tu-quy-dinh-kiem-dinh-chat-luong-giao-duc-truong-tieu-hoc-387077-d5.html, https://luatvietnam.vn/giao-duc/thong-tu-22-2024-tt-bgddt-sua-doi-thong-tu-17-2018-tt-bgddt-18-2018-tt-bgddt-19-2018-tt-bgddt-378870-d1.html. Tệp sinh bằng tập lệnh từ dữ liệu đã đối chiếu; trường đối chiếu văn bản hiện hành
export const TH_KDCL_2024_STANDARDS: QualityFrameworkSeed['standards'] = [
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
              'Phù hợp mục tiêu giáo dục được quy định tại Luật giáo dục, định hướng phát triển kinh tế - xã hội của địa phương theo từng giai đoạn và các nguồn lực của nhà trường;',
          },
          { level: 1, code: 'b', content: 'Được xác định bằng văn bản và cấp có thẩm quyền phê duyệt;' },
          {
            level: 1,
            code: 'c',
            content:
              'Được công bố công khai bằng hình thức niêm yết tại nhà trường hoặc đăng tải trên trang thông tin điện tử của nhà trường (nếu có) hoặc đăng tải trên các phương tiện thông tin đại chúng của địa phương, trang thông tin điện tử của phòng giáo dục và đào tạo.',
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
              'Định kỳ rà soát, bổ sung, điều chỉnh phương hướng, chiến lược xây dựng và phát triển. Tổ chức xây dựng phương hướng, chiến lược xây dựng và phát triển có sự tham gia của các thành viên trong Hội đồng trường (Hội đồng quản trị đối với trường tư thục), cán bộ quản lý, giáo viên, nhân viên, cha mẹ học sinh và cộng đồng.',
          },
        ],
      },
      {
        code: '1.2',
        title: 'Hội đồng trường và các hội đồng khác',
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
            content: 'Các đoàn thể, tổ chức khác có đóng góp tích cực cho các hoạt động của nhà trường.',
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
            content: 'Các đoàn thể, tổ chức khác đóng góp hiệu quả cho các hoạt động của nhà trường và cộng đồng.',
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
              'Hằng năm, tổ chuyên môn đề xuất và thực hiện được ít nhất 01 (một) chuyên đề chuyên môn có tác dụng nâng cao chất lượng và hiệu quả giáo dục;',
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
              'Hoạt động của tổ chuyên môn, tổ văn phòng có đóng góp hiệu quả trong việc nâng cao chất lượng các hoạt động của nhà trường­;',
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
        title: 'Khối lớp và tổ chức lớp học',
        indicators: [
          { level: 1, code: 'a', content: 'Có đủ các khối lớp cấp tiểu học;' },
          { level: 1, code: 'b', content: 'Học sinh được tổ chức theo lớp học; lớp học được tổ chức theo quy định;' },
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
              'Lập dự toán, thực hiện thu chi, quyết toán, thống kê, báo cáo tài chính và cơ sở vật chất; công khai và định kỳ tự kiểm tra tài chính, tài sản theo quy định quy chế chi tiêu nội bộ được bổ sung, cập nhật phù hợp với điều kiện thực tế và các quy định hiện hành;',
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
              'Ứng dụng công nghệ thông tin trong công tác quản lý hành chính, tài chính và tài sản của nhà trường;',
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
              'Có kế hoạch dài hạn, trung hạn và ngắn hạn để tạo các nguồn tài chính hợp pháp phù hợp với điều kiện nhà trường, thực tế địa phương.',
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
              'Phân công, sử dụng cán bộ quản lý, giáo viên, nhân viên rõ ràng, hợp lý đảm bảo hiệu quả các hoạt động của nhà trường;',
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
          { level: 1, code: 'b', content: 'Kế hoạch giáo dục được thực hiện đầy đủ;' },
          { level: 1, code: 'c', content: 'Kế hoạch giáo dục được rà soát, đánh giá, điều chỉnh kịp thời.' },
          {
            level: 2,
            code: 'yc',
            content:
              'Các biện pháp chỉ đạo, kiểm tra, đánh giá của nhà trường đối với các hoạt động giáo dục, được cơ quan quản lý đánh giá đạt hiệu quả.',
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
              'Cán bộ quản lý, giáo viên, nhân viên và học sinh được phổ biến, hướng dẫn, thực hiện phương án đảm bảo an ninh trật tự; vệ sinh an toàn thực phẩm; an toàn phòng, chống tai nạn, thương tích; an toàn phòng, chống cháy, nổ; an toàn phòng, chống thảm họa, thiên tai; phòng, chống dịch bệnh; phòng, chống các tệ nạn xã hội và phòng, chống bạo lực trong nhà trường;',
          },
          {
            level: 2,
            code: 'b',
            content:
              'Nhà trường thường xuyên kiểm tra, thu thập, đánh giá, xử lý các thông tin, biểu hiện liên quan đến bạo lực học đường, an ninh trật tự và có biện pháp ngăn chặn kịp thời, hiệu quả.',
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
              'Trong 05 năm liên tiếp tính đến thời điểm đánh giá, đạt chuẩn hiệu trưởng ở mức khá trở lên, trong đó có ít nhất 01 năm đạt chuẩn hiệu trưởng ở mức tốt.',
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
              'Số lượng giáo viên đảm bảo để dạy các môn học và tổ chức các hoạt động giáo dục theo quy định của Chương trình giáo dục phổ thông cấp tiểu học; có giáo viên làm Tổng phụ trách Đội Thiếu niên tiền phong Hồ Chí Minh;',
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
              'Trong 05 năm liên tiếp tính đến thời điểm đánh giá, không có giáo viên bị kỷ luật từ hình thức cảnh cáo trở lên.',
          },
          {
            level: 3,
            code: 'b',
            content:
              'Trong 05 năm liên tiếp tính đến thời điểm đánh giá, có ít nhất 80% giáo viên đạt chuẩn nghề nghiệp giáo viên ở mức khá trở lên, trong đó có ít nhất 30% đạt chuẩn nghề nghiệp giáo viên ở mức tốt; đối với trường thuộc vùng khó khăn có ít nhất 70% đạt chuẩn nghề nghiệp giáo viên ở mức khá trở lên, trong đó có ít nhất 20% đạt chuẩn nghề nghiệp giáo viên ở mức tốt.',
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
          { level: 1, code: 'b', content: 'Được phân công công việc phù hợp, hợp lý theo năng lực' },
          { level: 1, code: 'c', content: 'Hoàn thành các nhiệm vụ được giao.' },
          { level: 2, code: 'a', content: 'Số lượng và cơ cấu nhân viên đảm bảo theo quy định;' },
          {
            level: 2,
            code: 'b',
            content:
              'Trong 5 năm liên tiếp tính đến thời điểm đánh giá, không có nhân viên bị kỷ luật từ hình thức cảnh cáo trở lên.',
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
          { level: 1, code: 'a', content: 'Đảm bảo về tuổi học sinh tiểu học theo quy định;' },
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
            content: 'Diện tích khu đất xây dựng trường, điểm trường; diện tích sàn xây dựng các hạng mục công trình.',
          },
        ],
      },
      {
        code: '3.2',
        title:
          'Các hạng mục công trình đảm bảo tiêu chuẩn cơ sở vật chất tối thiểu đối với trường tiểu học theo quy định của Bộ Giáo dục và Đào tạo, bao gồm',
        indicators: [
          { level: 1, code: 'a', content: 'Khối phòng hành chính quản trị;' },
          { level: 1, code: 'b', content: 'Khối phòng học tập; khối phòng hỗ trợ học tập;' },
          { level: 1, code: 'c', content: 'Khối phụ trợ; khu sân chơi, thể dục thể thao; khối phục vụ sinh hoạt.' },
          { level: 2, code: 'a', content: 'Khối phòng hành chính quản trị;' },
          { level: 2, code: 'b', content: 'Khối phòng học tập; khối phòng hỗ trợ học tập;' },
          { level: 2, code: 'c', content: 'Khối phụ trợ; khu sân chơi, thể dục thể thao; khối phục vụ sinh hoạt.' },
          { level: 3, code: 'a', content: 'Khối phòng hỗ trợ học tập;' },
          { level: 3, code: 'b', content: 'Khối phụ trợ; khu sân chơi, thể dục thể thao; khối phục vụ sinh hoạt.' },
        ],
      },
      {
        code: '3.3',
        title:
          'Hạ tầng kỹ thuật, các hạng mục công trình kiên cố và thiết bị dạy học đảm bảo tiêu chuẩn cơ sở vật chất tối thiểu đối với trường tiểu học theo quy định của Bộ Giáo dục và Đào tạo, bao gồm',
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
        title: 'Công tác tham mưu cấp ủy Đảng, chính quyền và phối hợp với các tổ chức, cá nhân của nhà trường',
        indicators: [
          {
            level: 1,
            code: 'a',
            content: 'Tham mưu cấp ủy Đảng, chính quyền để thực hiện kế hoạch giáo dục của nhà trường;',
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
              'Tham mưu cấp ủy Đảng, chính quyền để tạo điều kiện cho nhà trường thực hiện phương hướng, chiến lược xây dựng và phát triển;',
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
        title: 'Kế hoạch giáo dục của nhà trường',
        indicators: [
          {
            level: 1,
            code: 'a',
            content:
              'Đảm bảo thực hiện đúng, đủ Chương trình giáo dục phổ thông cấp tiểu học (Chương trình tiểu học) và các quy định về chuyên môn của cơ quan quản lý nhà nước về giáo dục;',
          },
          {
            level: 1,
            code: 'b',
            content:
              'Đảm bảo đáp ứng mục tiêu, yêu cầu của chương trình giáo dục, nhu cầu của học sinh và phù hợp với điều kiện thực tế của nhà trường, đảm bảo chất lượng, hiệu quả;',
          },
          {
            level: 1,
            code: 'c',
            content:
              'Giải trình khi cơ quan có thẩm quyền yêu cầu và được cơ quan có thẩm quyền xác nhận; thực hiện đầy đủ và rà soát, đánh giá, điều chỉnh kịp thời.',
          },
          {
            level: 2,
            code: 'a',
            content: 'Đảm bảo tính cập nhật các quy định về chuyên môn của cơ quan quản lý giáo dục;',
          },
          {
            level: 2,
            code: 'b',
            content:
              'Được phổ biến, công khai để giáo viên, học sinh, cha mẹ học sinh, cộng đồng biết và phối hợp, giám sát nhà trường thực hiện kế hoạch.',
          },
        ],
      },
      {
        code: '5.2',
        title: 'Thực hiện Chương trình giáo dục phổ thông cấp tiểu học',
        indicators: [
          {
            level: 1,
            code: 'a',
            content: 'Tổ chức dạy học đúng, đủ các môn học và các hoạt động giáo dục đảm bảo mục tiêu giáo dục;',
          },
          {
            level: 1,
            code: 'b',
            content:
              'Vận dụng các phương pháp, kỹ thuật dạy học, tổ chức hoạt động dạy học đảm bảo mục tiêu, nội dung giáo dục, phù hợp đối tượng học sinh và điều kiện nhà trường;',
          },
          { level: 1, code: 'c', content: 'Thực hiện đúng quy định về đánh giá học sinh tiểu học.' },
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
        code: '5.3',
        title: 'Thực hiện các hoạt động giáo dục khác',
        indicators: [
          { level: 1, code: 'a', content: 'Đảm bảo theo kế hoạch;' },
          {
            level: 1,
            code: 'b',
            content: 'Nội dung và hình thức tổ chức các hoạt động phong phú, phù hợp điều kiện của nhà trường;',
          },
          { level: 1, code: 'c', content: 'Đảm bảo cho tất cả học sinh được tham gia.' },
          {
            level: 2,
            code: 'yc',
            content: 'Được tổ chức có hiệu quả, tạo cơ hội cho học sinh tham gia tích cực, chủ động, sáng tạo.',
          },
          {
            level: 3,
            code: 'yc',
            content:
              'Nội dung và hình thức tổ chức các hoạt động phân hóa theo nhu cầu, năng lực sở trường của học sinh.',
          },
        ],
      },
      {
        code: '5.4',
        title: 'Công tác phổ cập giáo dục tiểu học',
        indicators: [
          { level: 1, code: 'a', content: 'Thực hiện nhiệm vụ phổ cập giáo dục theo phân công;' },
          {
            level: 1,
            code: 'b',
            content: 'Trong địa bàn tuyển sinh của trường tỷ lệ trẻ em 6 tuổi vào lớp 1 đạt ít nhất 90%;',
          },
          { level: 1, code: 'c', content: 'Quản lý hồ sơ, số liệu phổ cập giáo dục tiểu học đúng quy định.' },
          {
            level: 2,
            code: 'yc',
            content: 'Trong địa bàn tuyển sinh của trường tỷ lệ trẻ 6 tuổi vào lớp 1 đạt ít nhất 95%.',
          },
          {
            level: 3,
            code: 'yc',
            content: 'Trong địa bàn tuyển sinh của trường tỷ lệ trẻ 6 tuổi vào lớp 1 đạt ít nhất 98%.',
          },
        ],
      },
      {
        code: '5.5',
        title: 'Kết quả giáo dục',
        indicators: [
          { level: 1, code: 'a', content: 'Tỷ lệ học sinh hoàn thành chương trình lớp học đạt ít nhất 75%;' },
          { level: 1, code: 'b', content: 'Tỷ lệ học sinh 11 tuổi hoàn thành Chương trình tiểu học đạt ít nhất 70%;' },
          {
            level: 1,
            code: 'c',
            content:
              'Tỷ lệ trẻ em đến 14 tuổi hoàn thành chương trình tiểu học đạt ít nhất 80% đối với trường thuộc xã có điều kiện kinh tế - xã hội đặc biệt khó khăn đạt ít nhất 70%.',
          },
          { level: 2, code: 'a', content: 'Tỷ lệ học sinh hoàn thành chương trình lớp học đạt ít nhất 90%;' },
          {
            level: 2,
            code: 'b',
            content:
              'Tỷ lệ trẻ em 11 tuổi hoàn thành chương trình tiểu học đạt ít nhất 85%, đối với trường thuộc xã có điều kiện kinh tế - xã hội đặc biệt khó khăn đạt ít nhất 75%.',
          },
          { level: 3, code: 'a', content: 'Tỷ lệ học sinh hoàn thành chương trình lớp học đạt ít nhất 95%;' },
          {
            level: 3,
            code: 'b',
            content:
              'Tỷ lệ trẻ em 11 tuổi hoàn thành Chương trình tiểu học đạt ít nhất 90%, đối với trường thuộc xã có điều kiện kinh tế - xã hội đặc biệt khó khăn đạt ít nhất 80%.',
          },
        ],
      },
    ],
  },
];

export const TH_KDCL_2024_SOURCE = {
  name: 'Kiểm định chất lượng giáo dục trường tiểu học (Thông tư 17/2018, sửa đổi 2024)',
  legal_basis:
    'Thông tư 17/2018/TT-BGDĐT, sửa đổi, bổ sung bởi Thông tư 22/2024/TT-BGDĐT; văn bản hợp nhất 11/VBHN-BGDĐT ngày 31/12/2024',
  template_version: 'TH-KDCL-2024',
} as const;
