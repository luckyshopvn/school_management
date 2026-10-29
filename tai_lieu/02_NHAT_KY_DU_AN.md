# 02. NHẬT KÝ DỰ ÁN

- Mô tả: Ghi nhận công việc, quyết định, thay đổi và vấn đề tồn đọng theo ngày, ngày mới nhất ở trên cùng.
- Phiên bản: 0.83
- Ngày cập nhật: 2026-10-29
- Trạng thái: Đang cập nhật

## Quy ước ghi nhật ký

- Từ YCTD-291 (ngày 2026-10-26), mục nhật ký mới của mỗi PR nằm ở tệp mảnh trong thư mục `tai_lieu/thay_doi_cho_gom/` cho tới lần gom; PR thường không sửa tệp này. Lần gom (`node scripts/gom-thay-doi.mjs`, nhánh `gom-…`) chép các mục vào đây theo thứ tự merge. Quy ước đầy đủ ở `thay_doi_cho_gom/README.md`. Muốn biết việc mới nhất thì đọc cả các tệp ở thư mục đó.
- Mục mới ghi ở trên cùng; không sửa nội dung mục cũ.
- Từ ngày 2026-10-09, mỗi mục ghi theo mẫu của Vibecoding_Flow: công việc đã thực hiện, quyết định, thay đổi, vấn đề tồn đọng. Các mục cũ giữ nguyên dạng và tên tệp cũ.
- Mỗi mục ghi rõ ngày, người thực hiện, nội dung, tệp bị ảnh hưởng, kết quả kiểm thử.
- Không ghi thông tin tạm thời như kết quả tra cứu, đường dẫn tạm, thông báo lỗi của công cụ.

## Nhật ký theo ngày

### 2026-10-29 — Sửa các điểm lệch quy trình Vibecoding_Flow (YCTD-369)

#### Công việc đã thực hiện

- Gom 92 tệp mảnh chờ (YCTD-213 đến YCTD-367) và tệp mảnh này bằng `node scripts/gom-thay-doi.mjs` trên nhánh `gom-2026-10-29`; `02`, `03`, `23`, `24`, `01`, `index.md` và các tài liệu nhận "Thêm dòng" đã cập nhật tới YCTD-369. Phiên bản chốt theo thứ tự merge từ 0.148.0 đến 0.238.0.
- Đánh lại số bộ tài liệu theo danh mục chuẩn của quy trình (bảng đổi số ở `index.md`): `35_KET_QUA_KIEM_THU.md` thành `25_KET_QUA_KIEM_THU.md`; thêm `26_TRIEN_KHAI.md`, `27_MA_TRAN_TRUY_VET.md`; tài liệu riêng của dự án số 25 đến 34 dời sang 40 đến 49, giữ thứ tự. Đổi tên bằng `git mv`; sửa tham chiếu trong tài liệu hiện hành, `README.md`, `README.en.md`, `deploy/`, `.github/workflows/ci.yml`, 21 tệp kiểm thử và chú thích mã nguồn (commit riêng).
- Thêm `27_MA_TRAN_TRUY_VET.md`: liên kết YCTD-213 đến YCTD-369 với chức năng (`10`), tiêu chí nghiệm thu (`11`), kịch bản kiểm thử (`21`), PR và commit merge, kết quả CI, kết quả ghi ở `25`. Dữ liệu trích từ tệp mảnh trên `origin/main` `6048abc9` và `gh pr view`; chỗ không có dữ liệu ghi "chưa xác định".
- Thêm `26_TRIEN_KHAI.md`: tổng hợp các cách triển khai đang có (bản một máy, hồ sơ "Vận hành", hồ sơ thử nghiệm, bản nhiều trường trên máy), thứ tự database migration, phương án quay lui, mẫu biên bản; ghi rõ chưa có lần triển khai môi trường thật nào.
- `01` chuyển sang mô hình mười ba giai đoạn: thêm giai đoạn 12 Triển khai (CG-12), vận hành và cải tiến thành giai đoạn 13 (CG-13).
- Thêm vào `18` quy tắc AI-43 đến AI-48 (mức Lớn, merge mức Nhỏ và Vừa, tệp tạm, mã định danh riêng, sổ qua tệp mảnh, thẻ `tai-lieu-<số>`), sửa AI-40 theo ủy quyền làm việc tự chủ ngày 2026-10-11, thêm giả định đã xác nhận GD-181 đến GD-184.
- Thêm `tam_thoi/` vào `.gitignore`.
- Sửa dòng "Mã N đang dùng đến" ở `03` từ N22 thành N25 (lỗi L-17 của `25`).

#### Quyết định

- Eric duyệt ngày 2026-10-29 cách xử lý năm điểm lệch quy trình và việc đánh lại số (qua phiên điều phối): phương án B, tài liệu riêng sang dải 40 đến 49, để trống 28 đến 39 để tham chiếu cũ còn sót không trỏ nhầm; giữ nguyên số cũ trong lịch sử `02`, `23`, `24` và trong chú thích tệp database migration; sửa chú thích mã nguồn khác; sửa AI-40; cập nhật `01` sang mười ba giai đoạn.
- Số phiên bản do công cụ gom chốt theo thứ tự merge, không theo số đề xuất của tệp mảnh, nên tệp mảnh này nhận 0.238.0 thay vì 0.249.0 đề xuất.
- Thẻ mốc tài liệu dạng `tai-lieu-<số>` (Eric chọn ngày 2026-10-29), `v<số>` giữ cho bản phần mềm đã nghiệm thu; gắn 255 thẻ (`tai-lieu-0.25.4` đến `tai-lieu-0.238.0`) sau khi PR này merge, bỏ qua 0.1.0 đến 0.25.3.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-369, `23_LICH_SU_PHIEN_BAN.md` 0.238.0, `25_KET_QUA_KIEM_THU.md`, `26_TRIEN_KHAI.md`, `27_MA_TRAN_TRUY_VET.md`, `18_QUY_TAC_PHAT_TRIEN_AI.md`, `01_KE_HOACH_TONG_THE.md` mục 4, `index.md` mục "Bảng đổi số ngày 2026-10-29".

#### Vấn đề tồn đọng

- Ma trận truy vết chưa phủ YCTD-01 đến YCTD-212; nhiều dòng thiếu mã chức năng, tiêu chí nghiệm thu (xem `27` mục 5).
- Bản PDF trong `49_TONG_HOP_CHUC_NANG_HE_THONG/` còn liên kết theo đường dẫn cũ; dựng lại ở lần cập nhật tài liệu tổng hợp.
- Gắn và đẩy thẻ `tai-lieu-*` sau khi PR này merge.

### 2026-10-28 — DT-29 phần 29e: bài hát, câu chuyện của trường trong Hộp công cụ giảng dạy

#### Công việc đã thực hiện

- Cơ sở dữ liệu hệ thống `0121_add_song_story_resource_types.ts`: loại học liệu `song` (Bài hát), `story` (Câu chuyện), qua Ban Giám hiệu duyệt.
- Máy chủ API: kho học liệu nhận tệp âm thanh MP3, M4A, WAV, OGG theo chữ ký đầu tệp (`detectResourceFileType`).
- Ứng dụng giáo viên: mini app "Bài hát, câu chuyện của trường" (lớp Mầm non) liệt kê học liệu loại Bài hát, Câu chuyện đã công bố của cấp của lớp, phát âm thanh, video ngay trên lớp, chiếu ảnh, mở PDF hoặc liên kết.

#### Quyết định

- Dự án không kèm bài hát, truyện nào: nội dung do trường tải lên kho học liệu, qua luồng duyệt và kiểm bản quyền của 22h1 (Ban Giám hiệu duyệt như video). Mini app dùng lại quyền dùng học liệu, danh sách và tải tệp có sẵn của kho, không thêm điểm cuối. Chưa lưu tệp để phát khi mất mạng (tệp âm thanh, video lớn, cần mạng khi phát). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-329, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 22, `07_QUY_TAC_NGHIEP_VU.md` BR-196, `14_DAC_TA_GIAO_DIEN.md` MH-564, `16_CO_SO_DU_LIEU.md`, `21_KICH_BAN_KIEM_THU.md` CT-1561 đến CT-1563, `11_TIEU_CHI_NGHIEM_THU.md` AC-1137, `23_LICH_SU_PHIEN_BAN.md` 0.237.0.

#### Vấn đề tồn đọng

- Lưu sẵn tệp để phát khi mất mạng (tuỳ chọn) chưa làm; giới hạn 50 MB mỗi tệp của kho học liệu áp cho cả âm thanh.

### 2026-10-28 — DT-29 phần 29d: mini app THCS, THPT của Hộp công cụ giảng dạy

#### Công việc đã thực hiện

- Ứng dụng giáo viên (`apps/teacher/src/tools/mini/`): máy tính khoa học, vẽ đồ thị hàm số, bảng tuần hoàn, hình học động, bảng hằng số và đổi đơn vị; phần thuần `expression.ts` (bộ tính biểu thức tự viết), `graph-logic.ts`, `periodic-table.ts`, `geometry.ts`, `units.ts`. Danh mục `TEACHING_TOOLS` thêm năm công cụ cho lớp THCS, THPT.

#### Quyết định

- Bộ tính biểu thức tự viết, không dùng `eval` hay `Function` (không chạy mã từ chữ người dùng gõ), dùng chung cho máy tính và vẽ đồ thị. Bảng tuần hoàn: tên nguyên tố theo IUPAC như sách Khoa học tự nhiên, Hoá học chương trình 2018; khối lượng nguyên tử chuẩn rút gọn của IUPAC; La, Ac ở nhóm 3. Hằng số vật lí theo CODATA 2018, làm tròn bốn chữ số có nghĩa. Mọi dữ liệu là dữ kiện khoa học công khai, nằm trong ứng dụng, chạy khi mất mạng. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-328, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 22, `14_DAC_TA_GIAO_DIEN.md` MH-563, `21_KICH_BAN_KIEM_THU.md` CT-1555 đến CT-1560, `11_TIEU_CHI_NGHIEM_THU.md` AC-1136, `23_LICH_SU_PHIEN_BAN.md` 0.236.0.

#### Vấn đề tồn đọng

- Mô phỏng vật lí, hoá học để đợt sau (32 mục 22). Hình học động mới có tam giác; chưa có đường tròn, đa giác tự dựng.

### 2026-10-28 — DT-29 phần 29c: mini app Tiểu học của Hộp công cụ giảng dạy

#### Công việc đã thực hiện

- Ứng dụng giáo viên (`apps/teacher/src/tools/mini/`): bảng cửu chương, khung ô li (bảng trắng có kẻ dòng như vở ô li), học xem đồng hồ, phân số trực quan; phần thuần ở `primary-logic.ts`. Danh mục `TEACHING_TOOLS` thêm bốn công cụ cho lớp Tiểu học.

#### Quyết định

- Chạy trên máy, không lưu kết quả, không cần danh sách lớp. Khung ô li tự vẽ (dòng kẻ mảnh mỗi ô li, dòng đậm mỗi bốn ô li, kẻ dọc mỗi bốn ô li), không dùng phông chữ mẫu có bản quyền: giáo viên viết mẫu bằng bút cảm ứng. Đọc giờ theo cách nói ở lớp ("7 giờ rưỡi", tuỳ chọn "8 giờ kém 15 phút"). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-327, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 22, `14_DAC_TA_GIAO_DIEN.md` MH-562, `21_KICH_BAN_KIEM_THU.md` CT-1668 đến CT-1672, `11_TIEU_CHI_NGHIEM_THU.md` AC-1135, `23_LICH_SU_PHIEN_BAN.md` 0.235.0.

#### Vấn đề tồn đọng

- Khổ ô li trên màn hình theo bề rộng bảng, chưa đúng kích thước in của vở thật.

### 2026-10-29 — Cổng quản trị: Công văn của tôi và trang Văn bản đến gọn (YCTD-336)

#### Công việc đã thực hiện

- Áp thiết kế "Cổng quản trị trường" Eric duyệt ngày 2026-10-28 cho phân hệ Quản lý văn bản và điều hành.
- Trang mới "8. Công văn của tôi" (`/my-documents`, MH-570): thẻ "Cần tôi xử lý" gộp văn bản đến chờ tôi xử lý (thẻ Chờ xử lý của 1.1) và văn bản đi chờ tôi cho ý kiến hoặc ký (thẻ Chờ xử lý của 3.1), cột Loại ghi Đến hoặc Đi; thẻ "Dự thảo của tôi" (thẻ Dự thảo của 3.1). Cột Loại, Số, Số ký hiệu, Trích yếu (nhãn độ khẩn), Nơi gửi, Hạn xử lý; bấm dòng mở chi tiết văn bản có sẵn ngay dưới dòng. Nút "Vào sổ văn bản đến" (quyền `P09.incoming-document.register`) mở 1.2 với biểu mẫu vào sổ mở sẵn, "Soạn văn bản đi" (quyền `P09.outgoing-document.draft`) mở 3.1 với biểu mẫu dự thảo mở sẵn (tham số `create=true`). Mục menu hiện khi người dùng thấy được 1.1 hoặc 3.1.
- Trang 1.1 Văn bản đến gọn hơn (dùng chung cho 1.2 đến 1.7): bỏ dòng chú thích màu; độ khẩn ghi bằng nhãn chữ "Hỏa tốc", "Khẩn" và văn bản chỉ đạo có nhãn "Chỉ đạo" trong ô trích yếu, chữ trích yếu không tô màu nữa; ký hiệu [XLC], [PH], [QH], [ĐH] có tên đầy đủ khi trỏ chuột; ba nút radio vai trò thành một ô chọn "Vai trò"; các nút Kết thúc hàng loạt, Lưu hồ sơ hàng loạt, Đánh dấu (Bỏ đánh dấu, Bỏ theo dõi) chỉ hiện khi đã chọn dòng. Không bỏ chức năng nào.
- Kịch bản e2e `tests/e2e/70-incoming-documents.spec.ts`: thêm bước Công văn của tôi (CT-1680), sửa bước lọc vai trò sang ô chọn, kiểm không còn chú thích màu và nút hàng loạt chỉ hiện khi chọn dòng.

#### Quyết định

- "Công văn của tôi" là mục riêng số 8. ở cuối menu phân hệ thay vì chèn đầu nhóm 1: chèn vào nhóm 1 phải đánh lại số 1.1. đến 1.7. đã dùng trong tài liệu, kiểm thử, hướng dẫn; mục 1. đến 7. giữ số theo kiểu của Sở (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11).
- Trang gộp lấy tối đa 200 văn bản mỗi danh sách (giới hạn trang của máy chủ) rồi phân trang ở lưới; danh sách dài hơn thì trang báo xem đủ ở 1.1, 3.1. Chỉ đọc danh sách của trang người dùng được thấy (1.1 hoặc 3.1) theo cùng điều kiện quyền của menu.
- Dòng chú thích màu ở 3.1 Văn bản đi chưa bỏ trong phần này (yêu cầu chỉ nêu 1.1); trang Công văn của tôi đã dùng nhãn chữ cho cả văn bản đi.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-336, `23_LICH_SU_PHIEN_BAN.md` 0.234.0.

#### Vấn đề tồn đọng

- Văn bản đi chưa có hạn xử lý trong danh sách nên cột Hạn xử lý của dòng Đi để trống.
- Trang 3.1 Văn bản đi vẫn còn dòng chú thích màu, làm khi áp thiết kế cho trang văn bản đi.

### 2026-10-29 — Cổng quản trị: nhóm Hay dùng và ô tìm chung học sinh, cán bộ (YCTD-337)

#### Công việc đã thực hiện

- Bảng `user_recent_pages` ở cơ sở dữ liệu hệ thống (thay đổi cấu trúc 0125): trang mỗi tài khoản mở gần đây, khóa (user_id, path), giữ tối đa 20 dòng mỗi tài khoản.
- API: `GET /me/recent-pages` (tối đa 8 trang mới nhất, bỏ trang của cấp chưa bật), `POST /me/recent-pages` (ghi lần mở trang, chỉ nhận đường dẫn là mục menu của cổng quản trị), `DELETE /me/recent-pages?path=` (bỏ một trang); chỉ của chính tài khoản đang đăng nhập.
- API: `GET /search?q=` (từ khóa 2 đến 100 ký tự) tìm học sinh, cán bộ theo tên bằng chính danh sách học sinh, danh sách cán bộ nên theo đúng phạm vi xem của người dùng; tối đa 5 mỗi nhóm; không có quyền xem nhóm nào thì nhóm đó trống; chỉ trả mã, tên, lớp hoặc đơn vị, đường dẫn.
- Cổng quản trị: khung trang ghi mỗi lần mở trang là mục menu; khối "Hay dùng" trên trang chủ có nút bỏ từng trang; ô tìm ở thanh đầu trang hiện "Hay dùng" khi chưa gõ, gõ từ 2 ký tự thì có thêm nhóm Học sinh, Cán bộ, giáo viên; mở học sinh thì trang 4.1.1 điền sẵn ô tìm (`/children?q=`), mở cán bộ thì vào hồ sơ.
- Kiểm thử đơn vị CT-337-1 đến CT-337-6 (`apps/api/src/recent-pages/recent-pages.test.ts`), e2e CT-337-7 (`tests/e2e/237-hay-dung-tim-chung.spec.ts`).

#### Quyết định

- GD-180 (Eric, 2026-10-29): "Hay dùng" theo trang mỗi người dùng mở gần nhất, lưu ở máy chủ, không cấu hình theo nhóm; ô tìm chung tìm học sinh, cán bộ theo quyền xem, không trả số định danh. Ghi ở `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 21.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-337, `23_LICH_SU_PHIEN_BAN.md` 0.233.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-29 — Cổng quản trị: trang Cấu hình trường theo thiết kế mới (YCTD-335)

#### Công việc đã thực hiện

- 1.4 Cấu hình trường: ô Đơn vị ("Áp dụng cho") và nút Lưu cấu hình lên cạnh tiêu đề trang; các khối chia thành bảy nhóm (Thông tin chung; Cấp học; Học phí, dịch vụ; Nhân sự, chấm công; Y tế, bán trú, kho; Nề nếp, thi đua; Nhật ký, bảo mật), danh sách nhóm ở bên trái từ 1280 px (hẹp hơn thì ở trên cùng), bấm nhóm thì cuộn tới nhóm.
- Bảng cấu hình theo đơn vị tách theo nhóm; bỏ cột Nguồn, nguồn ghi gọn sau giá trị đang áp dụng (ví dụ "25 · mặc định", "Chưa cấu hình").
- Các đoạn giải thích dài rút thành một dòng gợi ý dưới mục liên quan, giữ quy tắc nhập ngày, "tắt cấp chỉ ẩn, lớp và học sinh giữ nguyên", ngày chốt công cố định mùng 1 tháng sau.
- Kịch bản e2e 05 kiểm danh sách nhóm, bấm nhóm cuộn tới, mục nằm đúng nhóm và cách ghi nguồn mới.

#### Quyết định

- Bấm nhóm thì cuộn tới (mọi nhóm vẫn hiện) thay vì chỉ hiện nhóm đó, để các kịch bản mở thẳng `/settings` rồi dùng thẻ "Cấp học của trường", "Nề nếp, thi đua lớp" không phải chọn nhóm trước (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11).
- Mục theo đơn vị xếp vào nhóm theo khóa (bảng ở `settings-groups.ts`); khóa mới chưa có trong bảng thì xếp theo từ khóa trong tên mục, không khớp thì vào Thông tin chung. Hộp công cụ giảng dạy xếp vào nhóm Cấp học vì công cụ hiện theo cấp của lớp.
- Một nút Lưu cấu hình ở đầu trang ghi mọi mục theo đơn vị đã sửa ở mọi nhóm (như trước là một nút cho cả bảng); các khối áp cho cả trường giữ nút Ghi, Lưu riêng và tên nút như cũ.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-335, `23_LICH_SU_PHIEN_BAN.md` 0.232.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-29 — Trang cấp trên rút đề nghị xem chi tiết, xuất báo cáo chạy nền

#### Công việc đã thực hiện

- Cơ sở dữ liệu nền tảng 0245:
  - đề nghị xem chi tiết thêm trạng thái `withdrawn` (cấp trên rút, khác `revoked` là trường rút) và cột `withdrawn_at`;
  - bảng `parent_org_exports` cho việc xuất chạy nền.
- Dịch vụ định danh: `POST /api/v1/auth/parent-org/access-requests/:id/withdraw`.
  - Chỉ người gửi rút được, với đề nghị đang chờ hoặc đã duyệt còn hạn.
  - Phiên xem chi tiết đang mở kết thúc ngay.
  - Ghi nhật ký `parent-org.access-withdrawn`.
- Máy chủ API, `parent-org-exports.ts`:
  - tạo việc xuất (nhiều nhóm số liệu trong một tệp; bố cục tổng hợp theo đơn vị hoặc so sánh từng trường; Excel hoặc PDF);
  - việc định kỳ dựng tệp, chiếm việc bằng `for update skip locked`, dựng lại việc bị dừng giữa chừng tối đa 3 lần;
  - lưu tệp ở kho tệp chung theo thư mục của đơn vị cấp trên, giữ 7 ngày rồi xóa;
  - danh sách tệp của chính tài khoản, tải về có ghi nhật ký;
  - bảng của tệp xuất dùng chung với tải trực tiếp (`aggregateSheets`).
- Trang `/cap-tren`:
  - trang Xuất báo cáo có chọn bố cục, danh sách "Tệp đã xuất" tự làm mới khi còn tệp đang tạo, nút tải về; bản triển khai chưa có kho tệp thì tải trực tiếp như trước;
  - thẻ đề nghị có "Rút đề nghị" (hỏi lại một lần), trạng thái "Bạn đã rút".
- Cổng quản trị của trường: bảng đề nghị ghi "Cấp trên đã rút".
- Kiểm thử máy chủ: CT-367-1 (xuất chạy nền), CT-367-2 (rút đề nghị chờ duyệt và đã duyệt, phiên xem chi tiết kết thúc).
- Kiểm lại trang Chợ gia sư của cổng vận hành sau YCTD-323 và YCTD-324:
  - các khối theo vai trò khớp quyền ở máy chủ;
  - ô mốc phòng học và hạn dùng gói vẫn còn.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - quyền theo tài khoản cấp trên và cây đơn vị, không theo vai trò vận hành; bảng quyền vận hành của YCTD-323 không cần mục mới;
  - mỗi tài khoản tối đa 3 tệp đang tạo; tệp giữ 7 ngày (`PARENT_ORG_EXPORT_RETENTION_DAYS`), việc định kỳ chạy mỗi 30 giây (`PARENT_ORG_EXPORT_INTERVAL_SECONDS`, 0 là tắt);
  - rút đề nghị đã duyệt là kết thúc phiên đang mở ngay, như khi trường rút.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-367, `23_LICH_SU_PHIEN_BAN.md` 0.231.0.

#### Vấn đề tồn đọng

- Không có.

### 2026-10-29 — CI tự huỷ lượt chạy cũ của cùng PR hoặc cùng nhánh (YCTD-357)

#### Công việc đã thực hiện

- Thêm khối `concurrency` ở cấp workflow của `.github/workflows/ci.yml`: khoá gồm tên workflow, loại sự kiện và số PR (nhánh khác thì ref), `cancel-in-progress: true`. Lượt chạy mới của cùng PR hoặc cùng nhánh huỷ lượt cũ đang chạy hoặc đang chờ.

#### Quyết định

- Loại sự kiện nằm trong khoá để lượt chạy đêm (schedule) và lượt push của main không huỷ lẫn nhau; khoá theo số PR để các PR nối tiếp nhau không chạy trùng hai lượt cho một head (Eric duyệt ngày 2026-10-29).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-357, `23_LICH_SU_PHIEN_BAN.md` 0.230.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-29 — Cổng quản trị: danh sách học sinh gọn theo thiết kế (YCTD-338)

#### Công việc đã thực hiện

- 4.1.1 Quản lý hồ sơ học sinh theo mẫu của YCTD-333: đầu trang chỉ còn nút chính Nhập từ Excel (mở 4.1.2, người có quyền nhập học sinh), Thêm mới; Thay đổi, Xóa, Cập nhật hàng loạt, Cấp mã định danh Bộ (ghi mã cho dòng đã chọn) ở thanh "Đã chọn" (`selectionActions`); Cấp mã định danh Bộ, Xuất Excel, Xuất file lỗi, Đồng bộ CSDL ngành ở menu Thêm (`moreActions`) cùng Xuất PDF, Cấu hình cột hiển thị.
- Cột mặc định: Mã định danh Bộ GD&ĐT, Họ tên, Ngày sinh, Giới tính, Lớp, Trạng thái, Số điện thoại liên hệ; Dân tộc, Phụ huynh, Chuyên cần, Khối ẩn mặc định (bật ở Cấu hình cột hiển thị). Cột Lớp chuyển lên sau Giới tính theo thiết kế.
- Ô mã định danh Bộ trống ghi "Chưa có" chữ xám thay nhãn đỏ; bỏ ảnh chữ cái đầu chỉ để trang trí ở ô Họ tên. Thẻ trạng thái, ô "Tìm theo họ tên", mở rộng tìm kiếm giữ nguyên.
- Sửa kịch bản e2e 51 (cột mặc định, Xuất Excel ở menu Thêm), 62 (bật cột Dân tộc ở Cấu hình cột hiển thị, nút Xóa chỉ có sau khi chọn dòng, Xuất file lỗi ở menu Thêm). Cập nhật MH-02 ở `14_DAC_TA_GIAO_DIEN.md`, ghi chú AC-201 ở `11_TIEU_CHI_NGHIEM_THU.md`.

#### Quyết định

- Không bỏ chức năng, chỉ dời chỗ. "Cấp mã định danh Bộ" có ở cả hai chỗ: ở menu Thêm mở hộp không kèm dòng (xuất tệp theo mẫu Bộ cho học sinh chưa có mã), ở thanh "Đã chọn" mở hộp ghi mã cho các dòng đã chọn, như nút cũ khi có và khi chưa có dòng chọn.
- Nhập từ Excel, Thêm mới giữ ở đầu trang (cạnh tiêu đề và dòng tổng số) như bố cục hiện có của trang học sinh, không chuyển vào thanh công cụ của lưới.
- "Đồng bộ CSDL ngành" là nút phụ trên đầu trang nên vào menu Thêm.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-338, `23_LICH_SU_PHIEN_BAN.md` 0.229.0.

#### Vấn đề tồn đọng

- Ô tìm chưa đọc tham số `?q=` trên đường dẫn (main chưa có); sẽ thêm cùng phần tìm chung nếu cần.

### 2026-10-29 — Cổng quản trị: trang Hồ sơ lớp học gọn theo thiết kế (YCTD-339)

#### Công việc đã thực hiện

- 2.1 Hồ sơ lớp học theo mẫu YCTD-333: thanh công cụ còn Nhập từ Excel (mở 2.2, chỉ hiện khi có quyền của mục 2.2), Thêm mới; Thay đổi, Giải thể lớp đã chọn, Xóa lớp ở thanh "Đã chọn" (chỉ hiện khi chọn dòng); Xuất Excel ở menu Thêm cùng Xuất PDF và Cấu hình cột hiển thị.
- Cột hiện mặc định: Tên lớp, Khối, Giáo viên chủ nhiệm, Số học sinh, Điểm trường, Phòng học. Mã lớp, Nhóm lớp, Nhóm trẻ, Nhóm tuổi, Thứ tự, Học 2 buổi/ngày, Lớp ghép, Ghép vào lớp, Lớp bán trú, Lớp giải thể ẩn mặc định (cùng Phân hiệu, Lớp mẫu giáo ghép 2 hoặc 3 độ tuổi, Sĩ số tối đa vốn đã ẩn); bật lại ở Cấu hình cột hiển thị.
- Đầu trang có liên kết "Phân công phụ trách lớp" sang 3.3 (hiện theo quyền của mục 3.3); mục menu 3.3 giữ nguyên, hai trang vẫn tách.
- Sửa kịch bản e2e 08-classes (bật cột Lớp giải thể trước khi kiểm), 54-school-classes-so (CT-15b-9 kiểm cột mặc định mới, Nhập từ Excel, liên kết 3.3, thao tác hàng loạt chưa hiện khi chưa chọn dòng, bật cột ẩn rồi kiểm, Xuất Excel qua menu Thêm).

#### Quyết định

- Không bỏ chức năng: mọi nút cũ vẫn còn, chỉ dời chỗ; thao tác trên dòng (Sửa, Giáo viên, Giải thể lớp, Mở lại) giữ ở cuối dòng.
- Giữ tên cột và thứ tự cột theo Sở (mã cột trùng mã cột tệp Excel của máy chủ); cột "Điểm trường" là cột đơn vị của lớp trên lưới. Thứ tự cột mặc định vì vậy là Điểm trường trước Phòng học.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-339, `23_LICH_SU_PHIEN_BAN.md` 0.228.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-29 — Cổng quản trị: trang Điểm danh theo thiết kế mới (YCTD-334)

#### Công việc đã thực hiện

- 4.7 Điểm danh: tiêu đề và bộ lọc một hàng; ô Đơn vị chỉ hiện khi người dùng có từ hai đơn vị; nút Hôm trước, Hôm sau cạnh ô ngày; tóm tắt thành từng ô số (số chưa đánh dấu tô màu cảnh báo khi còn); nút thao tác lên đầu bảng; thêm nút "Đánh dấu tất cả có mặt" cho các dòng chưa đánh dấu (vẫn phải bấm Lưu điểm danh; tắt khi mọi dòng đã đánh dấu).
- Kịch bản e2e 11 kiểm nút mới và nút đổi ngày.

#### Quyết định

- Giữ đủ sáu trạng thái điểm danh, chốt, mở lại kèm lý do như trước; chỉ đổi cách bày.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-334, `23_LICH_SU_PHIEN_BAN.md` 0.227.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-28 — DT-29 phần 29b: mini app chung và Mầm non của Hộp công cụ giảng dạy

#### Công việc đã thực hiện

- Ứng dụng giáo viên, thư mục `apps/teacher/src/tools/mini/`: bảng trắng, xúc xắc và bốc số (mọi cấp); đồng hồ hình ảnh, đèn giữ trật tự, bảng thưởng sao (Mầm non, Tiểu học); hình và màu, đếm và số, làm quen chữ cái (Mầm non). Phần thuần ở `mini-logic.ts`.
- Danh mục `TEACHING_TOOLS` thêm tám công cụ; màn Hộp công cụ mở các công cụ này.

#### Quyết định

- Mọi mini app chạy trên máy giáo viên, dùng được khi mất mạng, không gọi máy chủ. Đèn giữ trật tự chỉ đo mức to nhỏ của micro ngay trên máy, không ghi âm, không lưu; dừng đo thì tắt micro. Bảng sao lưu trên máy theo lớp trong ngày, xóa khi đăng xuất như dữ liệu khác của công cụ lớp học, không vào sổ điểm hay nề nếp. Hình, đồ vật tự vẽ bằng SVG; chữ cái dùng phông của máy. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-326, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 22, `14_DAC_TA_GIAO_DIEN.md` MH-561, `21_KICH_BAN_KIEM_THU.md` CT-1545 đến CT-1549, `11_TIEU_CHI_NGHIEM_THU.md` AC-1133, AC-1134, `23_LICH_SU_PHIEN_BAN.md` 0.226.0.

#### Vấn đề tồn đọng

- Ngưỡng của đèn giữ trật tự cần thử ở lớp thật với nhiều loại micro; bảng sao chưa chuyển sang bảng điểm nhanh.

### 2026-10-29 — Giao diện cổng vận hành theo thiết kế

#### Công việc đã thực hiện

- Cổng vận hành theo thiết kế Eric duyệt ngày 2026-10-29: thanh bên xanh đậm, mục chia ba nhóm Điều hành (Tổng quan, Trường học, Bảng điều khiển, Đơn vị cấp trên, Danh mục đơn vị), Kinh doanh (Gói dịch vụ, Thu phí, Chợ gia sư, Trợ lý AI), Hệ thống (Bảo trì, Nhật ký truy cập, Nhân viên vận hành); tên, vai trò của nhân viên, Đổi mật khẩu, Đăng xuất ở chân thanh bên; máy tính bảng chỉ còn biểu tượng, điện thoại là ngăn kéo. Giữ mọi trang, tính năng có sẵn và lọc menu theo vai trò của YCTD-323; trang đăng nhập giữ nguyên.
- Trang Tổng quan: bốn ô chỉ số từ dữ liệu thật (đơn vị trong danh mục, trường đã khởi tạo và số khởi tạo hôm nay, trường bật tính năng trả phí, lượt quản trị vào trường 7 ngày); ô không có nguồn thì ẩn. Bảng trường mở gần đây có nút Vào trường, mục gói tính năng, truy cập gần đây (chỉ vai trò xem được nhật ký).
- Trang Nhật ký truy cập mới: lọc theo nhóm việc (vào trường, khởi tạo, tính năng trả phí), mã trường, khoảng ngày; phân trang; xuất CSV đúng bộ lọc (có BOM, chặn công thức bảng tính). Dịch vụ định danh thêm `GET /api/v1/auth/platform/audit-log` và `GET /api/v1/auth/platform/overview`; quyền mới `audit.view` (quản trị, hỗ trợ).
- Trang Trường học: tìm theo tên, mã, mã Bộ; lọc trạng thái; phân trang 50 dòng; nhãn trạng thái; nút Vào trường cho Admin. Trang chi tiết trường có bốn thẻ: Tổng quan (thông tin, thao tác, tên miền, loại dữ liệu, phiên hỗ trợ, sao lưu, nhật ký vòng đời), Gói và tính năng (gói hiện hành, phân hệ miễn phí, công tắc từng tính năng trả phí), Tài khoản quản trị trường (mở phiên vào thẳng tới trang Tài khoản của trường để tạo tài khoản theo đúng quy tắc của trường), Nhật ký truy cập của trường.
- Cổng quản trị: trang `/support-login` nhận `next` (chỉ đường dẫn trong trang) để mở thẳng trang Tài khoản.
- Kiểm thử: CT-1571, CT-1572 ở `apps/identity/src/platform/platform-audit.test.ts`; e2e 184 sửa theo trang Tổng quan mới.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: tạo tài khoản quản trị đầu tiên làm ở cổng quản trị của trường trong phiên vào thẳng thay cho biểu mẫu riêng ở cổng vận hành, để dùng chung quy tắc tài khoản của trường (mật khẩu mặc định, mã xác nhận đổi mật khẩu lần đầu, GD-163) và nhật ký; màu nhấn dùng màu thương hiệu của trang đăng nhập cổng vận hành.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-324, `23_LICH_SU_PHIEN_BAN.md` 0.225.0.

#### Vấn đề tồn đọng

- Danh sách Trường học chỉ gồm trường đã khởi tạo; trường chưa khởi tạo vẫn tìm và mở ở Danh mục đơn vị.

### 2026-10-29 — Vai trò vận hành theo từng điểm cuối, đổi mật khẩu vận hành, mã xác nhận khi đổi mật khẩu mặc định

#### Công việc đã thực hiện

- Bảng quyền vận hành dùng chung `packages/shared/src/operator-permissions.ts` (`OPERATOR_PERMISSIONS`): mỗi việc của cổng vận hành ghi các vai trò được làm. Việc không ghi thì chỉ quản trị làm được; gọi xác thực người vận hành mà không truyền vai trò cũng chỉ cho quản trị.
  - Mọi vai trò: xem tổng quan, trường, danh mục, đơn vị cấp trên, gói, thông báo bảo trì, phiên hỗ trợ, tổng quan chợ.
  - Hỗ trợ: cấp lại liên kết kích hoạt, mở phiên hỗ trợ, duyệt hồ sơ gia sư, kiểm duyệt chợ, xem lỗi máy chủ.
  - Kỹ thuật: khởi tạo trường, tên miền, loại dữ liệu, hồ sơ đồng ý, vùng máy chủ (cùng YCTD-343), thông báo bảo trì, mở phiên hỗ trợ, xem lỗi máy chủ.
  - Kế toán: gói dịch vụ, thu phí, tính năng trả phí của trường, đơn giá và số token AI, thanh toán ở chợ.
  - Chỉ quản trị: tạm ngưng, mở lại, xóa trường; danh mục, trang đăng nhập; đơn vị cấp trên; bộ nối thanh toán; khóa và cấu hình AI; cấu hình và văn bản pháp lý của chợ; chính sách hỗ trợ; nhân viên vận hành.
- Dịch vụ định danh:
  - `PlatformOperatorsService.authorize` kiểm tên miền cổng, mã phiên, tài khoản đang hoạt động, đã đổi mật khẩu tạm, đúng vai trò.
  - Trường, đơn vị cấp trên, danh mục, bảng điều khiển, phiên hỗ trợ, gói, thu phí, AI, nhân viên vận hành gọi kèm danh sách vai trò của việc.
  - Máy chủ API: `MarketContext.operator` nhận vai trò, phần quản trị chợ chia theo cấu hình, duyệt hồ sơ, kiểm duyệt, thanh toán.
- Cổng vận hành:
  - Menu chỉ hiện trang vai trò được làm.
  - Trang Chợ gia sư chỉ hiện phần của vai trò.
- Đổi mật khẩu của nhân viên vận hành (T-P1 của rà soát giao diện):
  - Thêm `POST /api/v1/auth/platform/password`: cần mật khẩu hiện tại và mã xác thực hai lớp; mật khẩu mới theo chính sách, từ 12 ký tự, khác mật khẩu cũ.
  - Ghi nhật ký nền tảng `operator.password-change`, nhập sai mật khẩu hiện tại ghi `operator.password-change-failed`.
  - Nhân viên do quản trị tạo nhận mật khẩu tạm có cờ `must_change_password`. Còn cờ thì mọi điểm cuối của cổng (kể cả phần chợ ở máy chủ API) trả 403, cổng chỉ hiện màn Đổi mật khẩu (MH-546); đổi xong thì bỏ cờ.
  - Nút "Đổi mật khẩu" ở đầu cổng.
- Mật khẩu mặc định chung (YCTD-311, giữ theo quyết định của Eric):
  - Đổi mật khẩu lần đầu khi còn mật khẩu mặc định phải kèm mã gửi tới số điện thoại của tài khoản: `POST /api/v1/auth/change-password/code` gửi mã, `POST /api/v1/auth/change-password` nhận `otp_code`.
  - Mã dùng cấu hình hạn, số lần nhập sai, số lần gửi mỗi giờ của mã đăng nhập phụ huynh.
  - Tài khoản theo số CCCD không có số điện thoại nhận mật khẩu tạm ngẫu nhiên.
  - Hạn mật khẩu mặc định tính theo giờ: `initial_password_lifetime_hours` mặc định 24, từ 1 đến 720, thay `initial_password_lifetime_days`.
  - Migration định danh `0185`: mã một lần có mục đích `initial_password`.
  - Cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh hiện ô mã và nút gửi mã khi máy chủ đòi (thành phần `PhoneCodeField` của `packages/ui`).
- Kiểm thử:
  - CT-1524: đổi mật khẩu mặc định cần mã. CT-1514 sửa: hạn 24 giờ, không số điện thoại thì mật khẩu tạm.
  - CT-1521 thêm phần đổi mật khẩu tạm.
  - CT-1525: mọi điểm cuối vận hành của dịch vụ định danh × 4 vai trò theo bảng quyền.
  - CT-1526: phần quản trị chợ theo vai trò.
  - CT-S4-4: thông báo bảo trì do kỹ thuật tạo, hỗ trợ bị 403.
  - e2e 221: đổi mật khẩu mặc định kèm mã.

#### Quyết định

- Eric duyệt ngày 2026-10-28 theo rà soát bảo mật và rà soát giao diện (T-P1): vai trò theo từng điểm cuối, mặc định chỉ quản trị; giữ mật khẩu mặc định chung, thêm mã xác nhận, hạn 24 giờ; đổi mật khẩu vận hành cần mã hai lớp, từ 12 ký tự, có nhật ký.
- Việc của từng vai trò: Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, theo ghi chú vai trò ở migration nền tảng `0241` và nhóm menu của bản thiết kế cổng vận hành. Loại dữ liệu, hồ sơ đồng ý, vùng máy chủ giữ như YCTD-343 (quản trị, kỹ thuật).
- Bảng quyền đặt ở `packages/shared` để menu của cổng và máy chủ dùng cùng một danh sách; cổng vận hành thêm phụ thuộc `@school-management/shared`.
- Ứng dụng hiện ô mã khi máy chủ báo lỗi ở ô `otp_code`, không thêm trường vào phản hồi đăng nhập.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-323, `23_LICH_SU_PHIEN_BAN.md` 0.224.0.

#### Vấn đề tồn đọng

- Các nút ở trang chi tiết trường (tạm ngưng, tên miền, cấp lại liên kết) chưa ẩn theo vai trò; máy chủ đã chặn và báo rõ lý do.
- Nhân viên vận hành quên mật khẩu vẫn phải nhờ quản trị; chưa có điểm cuối quản trị đặt lại mật khẩu của nhân viên.

### 2026-10-29 — Cổng quản trị: lưới dữ liệu gọn và danh sách cán bộ theo thiết kế (YCTD-333)

#### Công việc đã thực hiện

- Lưới dữ liệu dùng chung (`packages/ui` DataGrid): nút "Xuất PDF" và "Cấu hình cột hiển thị" vào menu "Thêm" (menu button theo WAI-ARIA, `MoreMenu`); thêm `moreActions` (thao tác phụ của màn hình vào cùng menu) và `selectionActions` (thao tác trên dòng đã chọn, chỉ hiện ở thanh "Đã chọn" khi có dòng được chọn, kèm nút Bỏ chọn). Áp cho mọi màn hình dùng lưới.
- 3.1.1 Hồ sơ cán bộ, giáo viên: thanh công cụ còn Nhập từ Excel (mở 3.1.3), Thêm mới; Thay đổi, Xóa ở thanh "Đã chọn"; Xuất Excel, Xuất tệp theo mẫu Bộ, Xuất file lỗi ở menu Thêm; cột Ngày sinh, Giới tính, Dân tộc, Nhóm chức vụ, Hình thức hợp đồng, Trình độ chuyên môn ẩn mặc định (bật ở Cấu hình cột hiển thị); ô mã định danh Bộ trống ghi chữ xám thay nhãn đỏ.
- Trợ giúp e2e `tests/e2e/grid.ts` (`gridMoreItem`, `clickGridMoreItem`); sửa kịch bản 04, 51, 54, 55, 58, 60, 184.

#### Quyết định

- Không bỏ chức năng: mọi nút cũ vẫn còn, chỉ dời vào menu Thêm hoặc thanh "Đã chọn"; cột ẩn vẫn bật lại được và vẫn xuất Excel theo cột đang hiện.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-333, `23_LICH_SU_PHIEN_BAN.md` 0.223.0.

#### Vấn đề tồn đọng

- Áp cùng mẫu cho danh sách học sinh, lớp, văn bản, thu phí và các trang khác ở các PR sau.

### 2026-10-29 — Mã xác nhận ở đăng nhập bằng mật khẩu của ứng dụng phụ huynh

#### Công việc đã thực hiện

- Dịch vụ định danh: đăng nhập bằng mật khẩu ở kênh `parent` dùng cùng quy tắc mã xác nhận với cổng quản trị và ứng dụng giáo viên (YCTD-353). Tên đăng nhập nhập sai đủ `captcha_failure_threshold` lần trong 15 phút thì bắt nhập mã; lần sai đếm theo tên đăng nhập, cộng chung mọi kênh. Đăng nhập bằng mã một lần qua tin nhắn không đổi.
- Ứng dụng phụ huynh: màn đăng nhập bằng mật khẩu hiện ảnh mã, nút "Làm mới mã" và ô "Mã xác nhận" từ lần nhập sai đầu tiên; `api-client` lấy ảnh mã và gửi kèm câu trả lời; `session` chuyển câu trả lời đi.
- BR-121 (`07`): mã xác nhận áp dụng cả ứng dụng phụ huynh khi đăng nhập bằng mật khẩu.
- Kiểm thử: CT-1529 (sai 3 lần ở kênh phụ huynh thì phải nhập mã; có mã đúng thì vào được; đăng nhập đúng thì xóa bộ đếm).

#### Quyết định

- Phiên điều phối giao ngày 2026-10-29, tách khỏi YCTD-353 để làm việc tồn đọng của YCTD-353. Không sửa `App.tsx` và màn trang chủ của ứng dụng phụ huynh vì PR khác đang sửa hai tệp đó.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-354, `23_LICH_SU_PHIEN_BAN.md` 0.222.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-29 — Cổng quản trị: ô tìm chức năng và trang Tất cả chức năng (YCTD-332)

#### Công việc đã thực hiện

- Ô "Tìm chức năng" ở thanh đầu trang: gõ tên hoặc số thứ bậc của mục menu, gõ không dấu vẫn khớp; mũi tên lên, xuống, Enter, Esc theo mẫu combobox; chỉ tìm trong cây menu đã lọc theo quyền của mọi phân hệ người dùng được thấy; mở trang thuộc phân hệ khác thì thanh bên tự chuyển phân hệ.
- Trang "Tất cả chức năng" (`/all-functions`): toàn bộ cây menu đánh số của mọi phân hệ người dùng được thấy, phân hệ đang chọn đứng đầu, ô lọc theo tên hoặc số; đường vào ở cuối thanh bên. Đây là đường vào cho các mục sẽ gom khỏi thanh bên ở các phần áp thiết kế từng trang.
- Kịch bản e2e CT-332-1 ở `01-login.spec.ts`.

#### Quyết định

- Ô tìm ở phần này chỉ tìm chức năng (trang); tìm học sinh, cán bộ theo tên làm sau khi có điểm cuối tìm chung ở máy chủ (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-332, `23_LICH_SU_PHIEN_BAN.md` 0.221.0.

#### Vấn đề tồn đọng

- Nhóm "Hay dùng" khi chọn phân hệ (theo vai trò) chưa làm: cần nơi cấu hình phân hệ hay dùng cho từng nhóm người dùng (ở 1.2 Phân quyền nhóm theo phần mềm) và điểm cuối máy chủ tương ứng.

### 2026-10-29 — Cổng quản trị: dải thông báo, một nút ngữ cảnh, phông Be Vietnam Pro (YCTD-331)

#### Công việc đã thực hiện

- Thông báo khi vào trang (DT-16 phần 16c) đổi từ hộp bật lên che trang sang dải ở đầu nội dung: mỗi thông báo một dòng, có nút Đóng; nhắc cập nhật mã định danh tổ chức vẫn có đường dẫn "Cập nhật hồ sơ trường". Nhắc mật khẩu sắp hết hạn chỉ còn ở dải cảnh báo đầu trang (trước hiện cả hai nơi).
- Bộ chọn cấp học chuyển vào hộp ngữ cảnh "cấp · năm học · học kỳ" ở thanh đầu trang, nên thanh đầu trang chỉ còn một nút ngữ cảnh.
- Phông chữ của cổng quản trị đổi sang Be Vietnam Pro, tự phục vụ cùng ứng dụng bằng gói `@fontsource/be-vietnam-pro` 5.3.0 (giấy phép OFL-1.1), không tải từ máy chủ ngoài.
- Trợ giúp e2e `openWorkingContext`; `selectSchoolLevel` mở hộp ngữ cảnh trước; sửa kịch bản 59, 83, 86.

#### Quyết định

- Phông tự phục vụ thay Google Fonts để trình duyệt của người dùng không gửi yêu cầu ra máy chủ ngoài (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-331, `23_LICH_SU_PHIEN_BAN.md` 0.220.0.

#### Vấn đề tồn đọng

- Ô tìm chung, trang "Tất cả chức năng", nhóm "Hay dùng" làm ở PR sau; các trang theo canvas làm ở các PR sau nữa.

### 2026-10-29 — Ứng dụng phụ huynh có nút Đổi con và thanh điều hướng dưới

#### Công việc đã thực hiện

- Thanh điều hướng dưới cố định ("Điều hướng chính") bốn mục, mỗi mục cao 52 px, mục đang mở có `aria-current`:
  - Trang chủ: như trước.
  - Lịch học: thời khoá biểu của con cấp phổ thông, bảng Học tập của con Mầm non.
  - Tin nhắn: thông báo của trường, trao đổi với giáo viên của từng con.
  - Tài khoản: họ tên, cài lên màn hình chính, thông báo đẩy, liên kết đăng nhập ngoài, Đăng xuất.
- Phụ huynh có từ hai con có ô "Đổi con" ở thanh đầu. Mặc định "Tất cả các con"; chọn một con thì Trang chủ, Lịch học, Tin nhắn chỉ của con đó.
- Giữ ô chọn lớp, học sinh của phiên hỗ trợ (YCTD-315b) và tuyến `/support-login`. Không sửa màn hình đăng nhập, `api-client`, `session`.
- Kiểm thử giao diện 85 (thanh điều hướng, Lịch học theo cấp, Đổi con giữ khi về Trang chủ) và 86 (Đổi con lọc thẻ của con).

#### Quyết định

- "Đổi con" mặc định hiện mọi con. Cách này giữ thói quen cũ của phụ huynh có nhiều con và các kiểm thử giao diện đang tìm thẻ của từng con. Trang chủ giữ đủ các bảng như trước (Đăng xuất vẫn ở trang chủ); ba mục còn lại là trang gọn cho điện thoại. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, Eric đồng ý làm theo đề xuất ngày 2026-10-28.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-351, `23_LICH_SU_PHIEN_BAN.md` 0.219.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-29 — Giao diện trang đơn vị cấp trên, cấu hình và duyệt đánh giá của chợ ở cổng vận hành

#### Công việc đã thực hiện

- Trang `/cap-tren` của cổng nền tảng làm lại theo bản vẽ Eric duyệt ngày 2026-10-28 (`ParentOrgApp.tsx`, kiểu riêng `parent-org.css`):
  - đăng nhập hai bước: tên đăng nhập, mật khẩu rồi mã xác thực; có lối dùng mã khôi phục (máy chủ đã nhận mã khôi phục ở cùng ô);
  - đầu trang xanh đậm có bốn trang: Tổng hợp, So sánh trường, Xuất báo cáo, Đề nghị xem chi tiết;
  - Tổng hợp: cây phạm vi (đơn vị và đơn vị con, số trường), bốn chỉ số chính (trường có số liệu, học sinh, tỉ lệ chuyên cần, nhân sự), bảng theo nhóm số liệu có dòng cộng, chú giải ô "ẩn", khối trường chưa có số liệu (đếm, không hiện tên trường chưa đồng ý);
  - So sánh trường: bảng sắp được theo từng cột, ô ẩn và trường chưa có số liệu xếp cuối; trường đang được xem chi tiết ghi hạn, trường khác có nút đề nghị xem chi tiết;
  - Xuất báo cáo: chọn đơn vị, nhiều nhóm số liệu (mỗi nhóm một tệp), Excel hoặc PDF;
  - Đề nghị xem chi tiết: biểu mẫu, danh sách đề nghị có nhãn trạng thái; "Mở phiên xem chi tiết" mở cổng quản trị của trường ở tab mới.
- Trang Chợ gia sư của cổng vận hành:
  - biểu mẫu cấu hình thêm các mốc phòng học video (GD-164) và hạn dùng gói buổi (GD-165); biểu mẫu gửi đủ các ô để lần lưu không đưa mốc về mặc định;
  - khối "Đánh giá gia sư chờ duyệt" (`MarketReviewModeration.tsx`): hiện hoặc từ chối có lý do, xem bản gốc trước khi che thông tin liên hệ.
- Kiểm thử giao diện 139 đổi theo đăng nhập hai bước và trang So sánh trường.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - bảng số liệu, không vẽ biểu đồ (theo bản vẽ đã duyệt);
  - xuất báo cáo vẫn tải trực tiếp, mỗi nhóm một tệp; chưa làm danh sách tệp đã xuất ở máy chủ và lựa chọn bố cục "so sánh từng trường" trong tệp;
  - dùng phông Be Vietnam Pro nếu máy có, không tải phông từ dịch vụ ngoài.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-363, `23_LICH_SU_PHIEN_BAN.md` 0.218.0.

#### Vấn đề tồn đọng

- "Rút đề nghị" của cấp trên chưa làm: cần điểm cuối mới ở `apps/identity/src/platform`, đang dành cho phiên bảo mật YCTD-323.
- Danh sách tệp đã xuất và bố cục so sánh trong tệp cần API xuất nền ở máy chủ.

### 2026-10-29 — Gói buổi ở chợ gia sư

#### Công việc đã thực hiện

- Thêm GD-165 và mục 19.14 vào tài liệu 32. Cơ sở dữ liệu chợ marketplace 0051: bảng `market_packages`, giá gói ở `market_tutor_subjects`, cột `market_bookings.package_id`; cấu hình chợ `package_valid_days` (mặc định 56 ngày).
- Máy chủ API, `market-bookings.ts`:
  - mua gói, trả tiền giả lập, đặt buổi từ gói, hủy gói;
  - hủy buổi trong gói thì trả lượt về gói;
  - việc định kỳ hoàn phần buổi chưa học khi gói hết hạn; gia sư bị tạm khóa thì hoàn phần còn lại;
  - chuyển tiền của buổi trong gói dùng lệnh thu của gói.
- Hồ sơ dạy của gia sư nhận số buổi và giá cả gói cho từng môn; trang gia sư công khai và tìm gia sư trả giá gói.
- Chợ gia sư: thẻ đặt buổi chọn buổi lẻ hoặc gói; trang Buổi học của con có khối Gói buổi (trả tiền giả lập, đặt buổi từ gói, hủy gói); thẻ gia sư ghi "Có giá theo gói buổi"; buổi đặt từ gói có nhãn "Buổi trong gói".
- Ứng dụng Gia sư: hồ sơ dạy có số buổi và giá cả gói cho từng môn.
- Kiểm thử máy chủ: CT-365-1 (mua, đặt, hủy trả lượt, hết hạn hoàn phần chưa học), CT-365-2 (hủy gói trước buổi đầu hoàn đủ); kiểm thử cấu hình chợ `package_valid_days`.

#### Quyết định

- GD-165 do Eric chốt ngày 2026-10-29: dùng trong 8 tuần; hết hạn hoàn các buổi chưa học theo giá mỗi buổi của gói; hủy trước buổi đầu hoàn đủ; gia sư bị tạm khóa hoàn phần còn lại; mỗi buổi giải ngân riêng sau hạn khiếu nại; các mốc chỉnh được ở cấu hình chợ.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: giá mỗi buổi của gói là giá gói chia số buổi, làm tròn xuống, phần dư hoàn khi gói kết thúc; phụ huynh hủy buổi trong gói phải trước giờ học 24 giờ mới được trả lượt.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-365, `23_LICH_SU_PHIEN_BAN.md` 0.217.0.

#### Vấn đề tồn đọng

- Gói buổi chạy với bộ giả lập; khi có nhà cung cấp có giấy phép (E-02) cần nối giải ngân, hoàn từng phần theo một lệnh thu của gói.
- Ô chỉnh `package_valid_days` ở cổng vận hành làm cùng YCTD-363.

### 2026-10-29 — Đánh giá gia sư, mật khẩu, đăng nhập định danh của phụ huynh, con đọc tin nhắn

#### Công việc đã thực hiện

- Thêm mục 19.13 vào tài liệu 32. Cơ sở dữ liệu chợ marketplace 0050: bảng `market_reviews`, mục đích `link` của lượt chuyển hướng OIDC, cột `market_children.reads_messages`.
- Máy chủ API:
  - `market-reviews.ts`: phụ huynh đánh giá buổi đã dạy; trang gia sư có đánh giá đã duyệt và điểm trung bình; gia sư xem và trả lời một lần; nhân viên nền tảng có hàng chờ, hiện hoặc từ chối có lý do; phụ huynh bật cho con đọc tin nhắn và lấy các luồng tin chỉ đọc;
  - `market-password.ts`: đổi mật khẩu, quên mật khẩu bằng mã, xác nhận lại mật khẩu, sửa tên hiển thị;
  - `market-identity.ts` mở cho ứng dụng Chợ gia sư: phụ huynh liên kết định danh, đăng nhập bằng định danh, xem định danh đã liên kết;
  - tìm gia sư trả điểm đánh giá và sắp `rating_desc`.
- Chợ gia sư:
  - thẻ gia sư có điểm, sắp "Đánh giá cao trước"; trang gia sư có khối đánh giá kèm trả lời và nút báo cáo đánh giá;
  - buổi đã dạy có biểu mẫu đánh giá;
  - trang Hồ sơ con có tùy chọn "con đọc tin nhắn" và chế độ con đọc (chỉ đọc, thoát bằng mật khẩu), khối tài khoản (tên hiển thị, đổi mật khẩu, liên kết định danh);
  - đăng nhập có "Quên mật khẩu?" và "Đăng nhập bằng" định danh; trang `/dinh-danh` hoàn tất đăng nhập, liên kết.
- Ứng dụng Gia sư: trang Đánh giá có ô trả lời, khối Tài khoản ở trang Hồ sơ và môn dạy, "Quên mật khẩu?" ở trang đăng nhập.
- Kiểm thử máy chủ: CT-364-1 (đánh giá, con đọc tin nhắn), CT-364-2 (mật khẩu, tên hiển thị), CT-364-3 (đăng nhập định danh của phụ huynh); sửa CT-27g-2 (ứng dụng phụ huynh nay có danh sách nhà cung cấp định danh).

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
  - đánh giá chờ duyệt rồi mới hiện (theo bản vẽ đã duyệt);
  - con đọc tin nhắn trên máy của phụ huynh, bằng phiên của phụ huynh, thoát phải nhập mật khẩu; không cấp tài khoản hay đường dẫn riêng cho trẻ;
  - quên mật khẩu không cho biết tài khoản có tồn tại hay không.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-364, `23_LICH_SU_PHIEN_BAN.md` 0.216.0.

#### Vấn đề tồn đọng

- Gói buổi chưa làm, chờ Eric chốt quy tắc hạn dùng và hoàn tiền phần chưa học.
- Giao diện duyệt đánh giá ở cổng vận hành làm cùng YCTD-363; trước đó đánh giá nằm ở hàng chờ, chưa hiện.
- Đổi thư điện tử, số điện thoại của tài khoản chợ chưa làm.

### 2026-10-29 — Phòng học video của chợ gia sư (DT-27 phần 27j)

#### Công việc đã thực hiện

- Thêm phần 27j vào tài liệu 32 (mục 19.12) và GD-164 (mốc của phòng học, quyết định của Eric ngày 2026-10-29).
- Cơ sở dữ liệu chợ marketplace 0040: `market_recording_consents` (đồng ý ghi hình theo con và gia sư, rút được), `market_session_rooms` (mở, đóng, xác nhận buổi), `market_session_participants` (phòng chờ, quyền nói, chia sẻ, mời ra), `market_session_attendance` (nhật ký vào ra).
- Cấu hình chợ thêm năm mốc (mở phòng trước giờ học, vào muộn tính vắng, gia sư vắng, tỉ lệ đủ buổi, tự xác nhận); API cổng vận hành đọc, ghi được; mặc định 10 phút, 15 phút, 10 phút, 80%, 24 giờ.
- Máy chủ API `apps/api/src/market/market-rooms.ts`: trạng thái phòng của buổi, đồng ý ghi hình (con từ đủ 7 tuổi cùng xác nhận), không đồng ý thì hủy buổi và hoàn đủ, vào phòng chờ, rời phòng, báo gia sư vắng (hoàn đủ), phòng của gia sư (người trong phòng chờ, điểm danh), cho vào, cho nói, cho chia sẻ màn hình, mời ra, xác nhận đã dạy kèm nhận xét. Quy tắc thuần ở `market-room-rules.ts`.
- `session/start` của 27i dùng mốc mở phòng của cấu hình, ghi phòng đã mở và trả thông tin vào phòng của chủ phòng; `session/join` chuyển sang phòng chờ; `session/end` đóng phòng, đóng các khoảng có mặt. Sự kiện vào ra của máy chủ video với phòng `market-*` chuyển sang chợ để ghi điểm danh.
- Việc định kỳ của chợ tự xác nhận buổi gia sư không xác nhận sau mốc (`runDue` trả thêm `autoConfirmed`).
- Ứng dụng Chợ gia sư: trang phòng học (`SessionRoom`): điều kiện vào phòng, đồng ý ghi hình, chọn "Con học" hay "Tôi vào xem", phòng chờ (hỏi lại mỗi 5 giây), lớp video `VideoRoom`, báo gia sư vắng, kết thúc buổi có điểm danh và nhận xét của gia sư. Trang Hồ sơ con có danh sách đồng ý ghi hình theo gia sư, nút rút đồng ý.
- Ứng dụng Gia sư: trang phòng dạy (`TeachingRoom`): điều kiện mở phòng, lớp video, `VideoHostPanel` (phòng chờ, cho vào, cho nói, cho chia sẻ, mời ra), kết thúc, điểm danh, xác nhận đã dạy.
- `VideoHostPanel` thêm `recordingLocked`: buổi bắt buộc ghi thì không có nút dừng ghi.
- Kiểm thử: CT-27j-1 (quy tắc thuần), sửa CT-27i-5, thêm CT-27j-2 (máy chủ), spec 199 CT-27j-3 (giao diện, bộ giả lập lớp video).

#### Quyết định

- Quyết định của Eric ngày 2026-10-29 ghi ở GD-164 và mục 19.12.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: đồng ý ghi hình lúc đặt buổi (27i) vẫn giữ; vào phòng cần thêm đồng ý theo gia sư. Gia sư mời ra được cả phụ huynh vào xem. Gia sư rời lớp video là kết thúc phòng.
- Spec 199 dùng học sinh đủ 18 tuổi (không bắt buộc ghi hình) để không phụ thuộc kho lưu bản ghi của môi trường kiểm thử; luồng đồng ý và ghi hình bắt buộc có kiểm thử máy chủ.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-362, `23_LICH_SU_PHIEN_BAN.md` 0.215.0.

#### Vấn đề tồn đọng

- Cần luật sư xem lại việc con từ đủ 7 tuổi cùng xác nhận đồng ý ghi hình trước khi mở thật.
- Biểu mẫu chỉnh năm mốc ở trang Chợ gia sư của cổng vận hành làm ở YCTD-363 (đụng `apps/platform`).
- Sự kiện "ghi xong" của máy chủ video cho phòng của chợ chưa nối (bản ghi LiveKit thật ở trạng thái đang xử lý đến khi có việc nối này); bộ giả lập trả tệp ngay nên kiểm thử không bị ảnh hưởng.

### 2026-10-29 — Áp bản thiết kế cho ứng dụng Gia sư

#### Công việc đã thực hiện

- Áp bản thiết kế "Chợ gia sư, Gia sư, Cấp trên" (Eric duyệt ngày 2026-10-28) cho `apps/tutor`: khu gia sư chia bảy trang theo cột điều hướng bên trái (Buổi dạy, Lịch, Hồ sơ và môn dạy, Thu nhập, Tin nhắn, Xác minh, An toàn, kiểm duyệt) thay cho một trang dài; trang đang mở ghi ở phần `#` của địa chỉ. Hồ sơ đã duyệt thì vào Buổi dạy, chưa duyệt thì vào Xác minh.
- Khung chung `MarketShell` thêm `navigationPlacement="side"` để đặt thanh điều hướng thành cột bên trái.
- Buổi dạy: thẻ từng buổi có ô ngày giờ, nhãn trạng thái, chia nhóm Sắp tới, Đã dạy và khiếu nại, Đã xong; khung tạm khóa hiện ở đầu trang khi có.
- Lịch: lưới bảy ngày của tuần đang xem, có giờ trống hằng tuần và buổi đã đặt, chuyển tuần trước, tuần sau (trước đây chỉ có danh sách).
- Thu nhập: ba ô tóm tắt (đã giải ngân, đang chờ, hoa hồng), bảng theo từng buổi (học phí, hoa hồng, thực nhận đã giải ngân hoặc dự kiến, trạng thái), dải "Giải ngân giả lập".
- Xác minh: cột các bước có nhãn trạng thái, biểu mẫu từng bước bên phải; nói rõ nền tảng nhận gì từ nhà cung cấp định danh.
- Hồ sơ và môn dạy: giới thiệu, cơ sở dạy thêm, hồ sơ dạy có nhãn trạng thái, khai giáo viên đang dạy ở trường; thêm nút "Bỏ khai báo" gọi `DELETE /market/tutor/school-role` đã có (việc T-T2 của rà soát giao diện).
- An toàn, kiểm duyệt: khối kiểm duyệt luôn hiện (kể cả khi chưa có báo cáo), chính sách an toàn trẻ em.
- Màu giống Chợ gia sư (ghi đè biến màu trong `apps/tutor/src/index.css`).
- Sửa kiểm thử giao diện 195, 196, 197, 198 theo cột điều hướng.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: giờ trống vẫn sửa ở Hồ sơ dạy (máy chủ lưu giờ trống cùng hồ sơ dạy); trang Lịch chỉ xem, có nút sang trang sửa.
- Phòng dạy video làm ở YCTD-362; nút "Mở phòng học" giữ nguyên hành vi cũ trong phần này.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-361, `23_LICH_SU_PHIEN_BAN.md` 0.214.0.

#### Vấn đề tồn đọng

- Chưa làm vì cần API mới: ảnh hồ sơ gia sư (T-T1), giá theo gói buổi (T-M3), trả lời đánh giá, nhãn "giáo viên trường X đã xác minh" bằng liên kết tài khoản trường (T-T3), cột thuế khấu trừ ở Thu nhập, nghỉ một ngày.

### 2026-10-29 — Mã xác nhận ở ứng dụng giáo viên, che số định danh, giới hạn "Ghi nhớ"

#### Công việc đã thực hiện

- Mã xác nhận ở kênh giáo viên (L-07 của tài liệu 35):
  - Đăng nhập kênh `teacher` dùng cùng quy tắc với cổng quản trị: tên đăng nhập nhập sai đủ `captcha_failure_threshold` lần trong 15 phút thì bắt nhập mã. Lần sai đếm theo tên đăng nhập, cộng chung mọi kênh có mã.
  - Ứng dụng giáo viên hiện ảnh mã, nút "Làm mới mã" và ô "Mã xác nhận" từ lần nhập sai đầu tiên, như ứng dụng học sinh.
- Số định danh của học sinh (L-05): nhật ký cấp tài khoản học và thi (máy chủ API), nhật ký đồng bộ tài khoản học sinh và thông báo trùng tên đăng nhập (dịch vụ định danh) chỉ ghi dạng che (`maskLoginIdentifier`).
- Số CCCD của nhân sự ở dịch vụ định danh (L-08):
  - `GET /api/v1/users/:id` trả tên đăng nhập dạng che như danh sách.
  - Thêm `GET /api/v1/users/:id/login-identifier` để xem đủ: chỉ người quản lý được tài khoản đó, mỗi lần xem ghi nhật ký tài khoản `view_login_identifier` (nhật ký chỉ ghi dạng che).
  - Tìm theo từ khóa toàn chữ số chỉ khớp đủ cả tên đăng nhập, không dò được từng chữ số.
  - Cổng quản trị có nút "Xem đủ tên đăng nhập" ở chi tiết tài khoản.
- "Ghi nhớ" (L-04, quyết định của Eric, GD-172):
  - Cổng quản trị: mã làm mới giữ 30 ngày khi tích "Ghi nhớ"; `PORTAL_REMEMBER_DAYS` chỉ hạ được, không quá 30 (trước cho tới 90).
  - Cổng vận hành nền tảng: phiên tối đa 8 giờ như cũ, "Ghi nhớ" chỉ nhớ tên đăng nhập trên trình duyệt.
  - Sửa BM-05 (`22`) và BR-121 (`07`): mã xác nhận áp dụng cổng quản trị, ứng dụng giáo viên, ứng dụng học sinh, cổng vận hành.
- Kiểm thử:
  - CT-16c-3 sửa: kênh giáo viên đòi mã sau 3 lần sai; sai ở cổng rồi sang kênh giáo viên vẫn phải nhập mã.
  - CT-1527: chi tiết che số CCCD, xem đủ có nhật ký, người không quản lý bị 403, tìm một phần chữ số không ra.
  - CT-1528: trần 30 ngày của "Ghi nhớ", phiên vận hành 8 giờ.

#### Quyết định

- Eric chốt ngày 2026-10-29 (GD-172): tài khoản trường giữ phiên 30 ngày khi chọn "Ghi nhớ"; tài khoản vận hành nền tảng tối đa 8 giờ, "Ghi nhớ" không kéo dài.
- Eric duyệt ngày 2026-10-29 sửa L-05, L-07, L-08 theo rà soát quy trình (tài liệu 35, PR 250).
- Quyền xem đủ số CCCD của nhân sự là quyền quản lý được tài khoản đó (cùng điều kiện của xem chi tiết); không thêm mã quyền mới. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Giữ biến `PORTAL_REMEMBER_DAYS` để bản triển khai hạ được thời hạn, trần 30 ngày.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-353, `23_LICH_SU_PHIEN_BAN.md` 0.213.0.

#### Vấn đề tồn đọng

- Ứng dụng phụ huynh chưa có mã xác nhận ở đăng nhập bằng mật khẩu (tài khoản phụ huynh theo số CCCD); lần sai vẫn được đếm chung theo tên đăng nhập. Đã làm ở YCTD-354.

### 2026-10-29 — Sửa lỗi xem camera giám thị mất phiên khi hai yêu cầu mở phiên chạy song song (YCTD-355)

#### Công việc đã thực hiện

- Spec `154-online-exam-proctoring.spec.ts` (CT-1175, CT-23e-5) lúc đạt lúc hỏng trên CI (PR 246, PR 257): ô "Camera của …" không có "Đang xem". Dấu vết của run 40736134879 và run 40745898287 (bốn lần hỏng giống nhau) cho thấy đây là **lỗi ứng dụng, không phải lỗi kiểm thử**: ô không đang chờ mà đã ở trạng thái cuối "Không xem được", chi tiết "Phiên xem đã kết thúc".
- Nguyên nhân: ô camera (`LiveTile` ở `apps/portal/src/online-exams/ProctorPanel.tsx`) mở phiên xem ngay trong hiệu ứng. Ở bản chạy thử, StrictMode gắn hiệu ứng hai lần nên hai yêu cầu `POST /online-exams/attempts/:id/proctor/views` đi cùng một mili giây. Máy chủ (`exam-proctoring.ts`, `startView`) đóng mọi phiên xem còn mở của cùng người xem trên cùng bài làm trước khi tạo phiên mới. Hai yêu cầu được xử lý theo thứ tự đảo thì phiên của lượt hiệu ứng còn sống bị đóng (gửi tín hiệu trả 422 "Phiên xem đã kết thúc"), còn phiên sống sót thuộc lượt đã hủy và bị xoá ngay. Không còn phiên nào nên chờ bao lâu cũng không xem được. YCTD-306 chỉ chặn lượt đã hủy ghi đè trạng thái, chưa chặn đua ở máy chủ. Ở bản thật (không có StrictMode) bấm "Xem camera" hai lần nhanh cũng có thể gặp.
- Sửa ở cổng quản trị:
  - `LiveTile` hoãn mở phiên một nhịp (`setTimeout` 0) và xoá hẹn giờ khi gỡ: lượt gắn đầu của StrictMode bị gỡ trước khi hẹn giờ chạy nên chỉ một yêu cầu mở phiên.
  - Mỗi bài làm chỉ một yêu cầu mở phiên tại một thời điểm: `createSingleFlight` (`proctor-single-flight.ts`), yêu cầu đến sau dùng lại kết quả của yêu cầu trước.
  - Nút "Xem camera của …" tắt trong lúc yêu cầu mở phiên của bài làm đó đang chạy.
- Spec 154 giữ nguyên (không tăng thời gian chờ).
- Cổng quản trị có kiểm thử đơn vị như ứng dụng phụ huynh, học sinh (`node --test`, lệnh `test`, `allowImportingTsExtensions`): `proctor-single-flight.test.ts` ba ca (dùng lại kết quả, khoá riêng và gọi lại sau khi xong, lỗi truyền cho mọi bên chờ và cho thử lại).
- Kết quả trên máy ngày 2026-10-29: `pnpm --filter @school-management/portal test` 3/3 đạt; `typecheck`, `eslint`, `prettier --check` của các tệp đã sửa đạt. E2e có khoá: spec 01 đến 09 và 154 (29 ca) đạt, rồi spec 154 lặp hai lần đạt (154 đạt 3/3). Trên máy spec này trước khi sửa cũng thường đạt, nên bằng chứng chính là dấu vết CI nêu trên; cần CI của PR xác nhận.

#### Quyết định

- Sửa ở giao diện, không đổi quy tắc máy chủ "mở phiên mới thì đóng phiên cũ" (phương án đóng theo thời điểm tạo vẫn đua khi trùng mili giây). Phiên điều phối đồng ý ngày 2026-10-29.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-355, `23_LICH_SU_PHIEN_BAN.md` 0.212.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-28 — DT-29 phần 29a: Hộp công cụ giảng dạy theo cấp học

#### Công việc đã thực hiện

- Khảo sát công cụ hỗ trợ giảng dạy đã có (23b, 23c, 23a, 23d, DT-28), đăng nhập thử ba tài khoản giáo viên ở trường trình diễn, vẽ bản thiết kế Hộp công cụ giảng dạy; Eric duyệt ngày 2026-10-28 (32 mục 22).
- Gói chung: danh mục công cụ `TEACHING_TOOLS` (`packages/shared/src/teaching-tools.ts`), ba mục cấp mới `class_pickup`, `class_medication`, `school_tutoring` ở `level-features.ts`.
- Máy chủ API: cấu hình `teaching_tools_disabled` (kiểu `teaching_tool_list`), `GET /classroom-tools/config` trả thêm `disabled_tools`.
- Ứng dụng giáo viên: màn Công cụ lớp học đổi thành Hộp công cụ giảng dạy (ô công cụ theo cấp của lớp, công cụ trường tắt, tính năng gói, lối vào giáo án, sổ đầu bài, lớp học trực tuyến), đường dẫn `?man=hop-cong-cu` và chuyển đường dẫn cũ, lối tắt trong `manifest.webmanifest`; trang chủ lọc Đón trả, Dặn thuốc, Lớp học trực tuyến, Gia sư trong trường theo cấp.
- Cổng quản trị: khối Hộp công cụ giảng dạy ở trang Cấu hình (bật, tắt từng công cụ).

#### Quyết định

- Bảng điểm nhanh giữ ở mọi cấp (Mầm non đang dùng để ghi nề nếp, thi đua); Gia sư trong trường lọc như Lớp học trực tuyến. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Công tắc từng công cụ là cấu hình của trường; công cụ thuộc tính năng trả phí (lớp học trực tuyến, `online-learning` của YCTD-314) ẩn khi gói chưa bật.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-325, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 22, `07_QUY_TAC_NGHIEP_VU.md` BR-460, `11_TIEU_CHI_NGHIEM_THU.md` AC-1130 đến AC-1132, `14_DAC_TA_GIAO_DIEN.md` MH-337, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1540 đến CT-1544, `23_LICH_SU_PHIEN_BAN.md` 0.211.0.

#### Vấn đề tồn đọng

- Mini app mới theo cấp làm ở 29b đến 29e. Ứng dụng phụ huynh chưa lọc đón trả, dặn thuốc theo cấp.

### 2026-10-29 — Danh mục thiết bị tối thiểu và mẫu kế hoạch giáo dục cho Tiểu học, THCS, THPT

#### Công việc đã thực hiện

- Rà nguồn dữ liệu mẫu Mầm non: danh mục thiết bị tối thiểu là hằng trong mã (`apps/api/src/facilities/equipment-templates.ts`, mẫu `MN-TT02-2010`, 515 thiết bị, YCTD-143) cộng 56 dòng gieo sẵn của migration năm học 0049; mẫu kế hoạch giáo dục là hằng `EDUCATION_PLAN_DEFAULT_TEMPLATES` (bảy mẫu Mầm non do dự án soạn ở YCTD-147). Không có seed hay migration nào chứa dữ liệu của cấp phổ thông.
- Rà tài liệu yêu cầu (tai_lieu 06, 10, 14, 31, 32, 34 và tài liệu khảo sát 31): chỉ có số văn bản căn cứ cho Tiểu học, THCS, THPT (Thông tư 37, 38, 39/2021/TT-BGDĐT, tài liệu 32 mục 18g) và danh sách loại mẫu kế hoạch cần có (tài liệu 32 mục 22i); không có nội dung danh mục thiết bị hay nội dung mẫu kế hoạch của ba cấp này. Khảo sát hệ thống của Sở (tài liệu 31) chỉ xem cấp Mầm non.
- Thiết bị: cột `age_group` nhận thêm mã khối K1 đến K12 (migration năm học 0215, ràng buộc gắn nhóm với cấp); thiết bị có cấp học khi thêm, sửa, nhập Excel (suy từ nhóm tuổi hoặc khối); lớp của cấp phổ thông áp định mức theo mã khối; đối sánh 2.6 theo cấp đang bật, chỉ lớp của cấp đó; API mới `GET /equipment-minimum/levels` trả nguồn danh mục từng cấp. Cấp chưa bật bị từ chối (422), khối không thuộc cấp, lĩnh vực phát triển ở cấp phổ thông bị từ chối (400).
- Cổng quản trị: 2.1 thẻ Danh mục tối thiểu có ô Cấp học, Nhóm tuổi hoặc Khối, thông báo nguồn danh mục, khối "Thêm thiết bị vào danh mục tối thiểu"; 2.2 thêm ô Cấp học; 2.6 ô Cấp học chỉ có cấp đang bật, cấp chưa có danh mục chuẩn hiện "Chưa có danh mục chuẩn, trường tự nhập" kèm liên kết tới 2.1; 5.6 Thư viện mẫu kế hoạch chỉ có cấp đang bật, cấp phổ thông có nút "Nạp khung rỗng" và thông báo "Chưa có mẫu chuẩn cho cấp học này, trường tự nhập".
- Kế hoạch giáo dục: Tiểu học, THCS, THPT nạp sáu khung rỗng theo các loại mẫu nêu ở tài liệu 32 mục 22i (nhà trường, tổ chuyên môn, dự giờ thao giảng, giáo viên, chủ nhiệm, bài dạy), mỗi khung một mục văn bản trống; tạo, sửa mẫu, nạp mặc định kiểm cấp học đang bật.
- Kiểm thử máy chủ API mới `apps/api/src/facilities/equipment-levels-345.test.ts` (CT-1640 đến CT-1646); sửa `education-plans.test.ts` theo cách kiểm cấp mới.

#### Nguồn dữ liệu đã dùng và phần để trường tự nhập

| Phần | Có nguồn tài liệu | Nguồn | Để trường tự nhập |
|---|---|---|---|
| Danh mục thiết bị tối thiểu Mầm non | Có (giữ nguyên, không đổi) | Mẫu `MN-TT02-2010` của YCTD-143 | Không |
| Văn bản căn cứ danh mục Tiểu học, THCS, THPT (chỉ số văn bản) | Có | Tài liệu 32 mục 18g: Thông tư 37/2021 (TH), 38/2021 (THCS), 39/2021 (THPT) | Không |
| Danh mục thiết bị tối thiểu Tiểu học, THCS, THPT (tên, đơn vị, số lượng) | Không | Không có trong tai_lieu, kể cả tài liệu khảo sát 31 | Có: thêm từng thiết bị ở 2.1 hoặc nhập Excel; không nạp mẫu nào |
| Khối áp định mức K1 đến K12 | Có | Khối mẫu của DT-19 (`GRADE_LEVEL_TEMPLATES`, YCTD-152) | Không |
| Loại mẫu kế hoạch cấp phổ thông (tên sáu khung) | Có | Tài liệu 32 mục 22i: năm học, tổ chuyên môn gồm dự giờ, thao giảng, giáo viên, chủ nhiệm, bài dạy | Không |
| Thư mục lưu kho của khung | Có | Thư mục mặc định cấp phổ thông của kho hồ sơ chuyên môn (`PROFESSIONAL_DEFAULT_FOLDERS`, YCTD-142) | Khung dự giờ, thao giảng không gắn thư mục |
| Mục, cột, chỉ tiêu của mẫu kế hoạch cấp phổ thông | Không | Không có trong tai_lieu | Có: mỗi khung một mục trống, trường sửa mẫu, thêm mục, cột hoặc tự tạo mẫu |

#### Quyết định

- Không nạp danh mục thiết bị hay nội dung mẫu kế hoạch nào cho Tiểu học, THCS, THPT vì tài liệu dự án không có; không chép lại thông tư từ trí nhớ. Chỉ thêm mẫu khi danh mục được đưa vào tài liệu của dự án (theo quy tắc của Eric).
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: định mức cấp phổ thông áp theo khối dùng chung cột `age_group` (mã K1 đến K12), không thêm cột môn học (ghi môn ở ô Loại thiết bị); lĩnh vực phát triển chỉ cho Mầm non; khung kế hoạch cấp phổ thông có loại kế hoạch, kì, luồng duyệt theo mẫu Mầm non cùng loại, không kí nội bộ; cấp chưa bật trả 422 theo quy tắc cấp học `YCTD-152`; đối sánh không gửi cấp lấy cấp đầu tiên đang bật; số migration năm học 0215 để cách xa các PR song song; giữ tiêu đề cột Excel "Nhóm tuổi" (tệp mẫu cũ vẫn nhập được), ghi chú cột nói thêm khối.
- Không làm xuất Excel kế hoạch giáo dục (ngoài phạm vi theo giao việc).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-345, `10_YEU_CAU_CHUC_NANG.md` P09-31, P13-12, `14_DAC_TA_GIAO_DIEN.md` MH-81, MH-205, MH-235, `16_CO_SO_DU_LIEU.md` (equipment_items, migration 0215), `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1640 đến CT-1646, `32_KE_HOACH_THEO_HE_THONG_SO.md` 18g, `34_TONG_HOP_CHUC_NANG_HE_THONG/` 02, 04, 07, `23_LICH_SU_PHIEN_BAN.md` 0.210.0.

#### Vấn đề tồn đọng

- Danh mục thiết bị tối thiểu và mẫu kế hoạch chuẩn của Tiểu học, THCS, THPT cần được đưa vào tài liệu dự án (bản gốc Thông tư 37, 38, 39/2021 và hướng dẫn kế hoạch giáo dục) thì mới thêm mẫu nạp sẵn.
- Khối tự đặt mã khác K1 đến K12 chưa khớp định mức thiết bị (hiện ở cảnh báo lớp chưa xếp được); chưa có cột môn học riêng; kế hoạch giáo dục chưa xuất Excel.

### 2026-10-28 — Xem dữ liệu năm học đã đóng ở cổng quản trị

#### Công việc đã thực hiện

- Sửa lỗi mức Cao số 4 của rà soát giao diện ngày 28/10/2026: ô năm học ở thanh đầu trang liệt kê năm học đã đóng nhưng bấm không làm gì (BC-09 ghi "chưa hỗ trợ xem năm học cũ").
- Máy chủ API: tiêu đề `x-academic-year-id` gắn vào ngữ cảnh của yêu cầu; bộ giải năm học đang dùng (`CurrentSchoolYearResolver`, nơi mọi phân hệ lấy cơ sở dữ liệu năm học) trả cơ sở dữ liệu của năm đã đóng cho yêu cầu đọc, từ chối yêu cầu ghi theo BR-93; mã sai dạng 400, năm không có hoặc còn nháp 404. Bộ chặn đổi lỗi cơ sở dữ liệu chỉ đọc (25006) và thiếu bảng, cột (42703, 42P01) khi đang xem năm cũ thành lỗi nghiệp vụ BR-93 có thông điệp rõ.
- Cổng quản trị: chọn được năm đã đóng ở ô năm học; mọi yêu cầu (kể cả tải tệp) mang mã năm đang xem; đổi năm thì tải lại mọi truy vấn; nút đổi màu cảnh báo, dải "chỉ xem" ở cuối màn hình có nút về năm đang dùng; giữ năm đang xem khi tải lại trang trong cùng thẻ, bỏ khi đăng xuất.
- Kiểm thử: `apps/api/src/academic-years/viewed-year.test.ts` (CT-1620 đến CT-1624).

#### Quyết định

- Chọn năm theo tiêu đề yêu cầu và một chỗ giải năm học chung thay vì thêm tham số năm học cho từng điểm cuối: hơn 1.700 chỗ gọi đi qua bộ giải nên mọi màn đọc được năm cũ mà không sửa từng phân hệ. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Không chạy tệp thay đổi cấu trúc cho năm đã đóng (giữ QU-11): chức năng làm sau ngày đóng năm học báo "Năm học đang xem đóng trước khi có chức năng này…" thay cho lỗi hệ thống. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Năm đang xem giữ trong sessionStorage của thẻ trình duyệt (không phải localStorage) để thẻ khác và lần đăng nhập sau mặc định về năm đang dùng, tránh nhầm năm khi nhập liệu.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-342, `23_LICH_SU_PHIEN_BAN.md` 0.209.0.

#### Vấn đề tồn đọng

- Ứng dụng giáo viên, phụ huynh, học sinh chưa có ô chọn năm học; chỉ cổng quản trị xem được năm cũ.
- Màn có nút ghi vẫn hiện nút khi xem năm cũ; bấm thì máy chủ từ chối kèm thông báo. Ẩn nút theo từng màn để làm khi áp thiết kế mới.

### 2026-10-29 — Kiểm thử giao diện gói dịch vụ chờ bộ đệm ngữ cảnh trường

#### Công việc đã thực hiện

- E2e `134-school-plans.spec.ts` CT-S5a-8 hỏng ở job nhiều trường của PR 260: mục "Kho học liệu" vẫn hiện dù trường alpha chỉ có gói `education`. Ca này qua ở mọi lượt CI trước khi PR 238 merge, kể cả lượt cuối của PR 238; mã lọc menu và dữ liệu gói không đổi. Nguyên nhân là thời điểm: kiểm thử gán gói thẳng vào cơ sở dữ liệu nền tảng ở beforeAll, còn máy chủ API giữ ngữ cảnh trường (kèm gói, trạng thái) trong bộ đệm 30 giây. Các ca e2e mới của PR 238 (khởi tạo trường ở lần mở đầu, vài chục giây) đổi thời điểm chạy, nên cổng quản trị có lúc đọc gói cũ (không giới hạn).
- Sửa kiểm thử: sau khi đăng nhập, chờ `GET /api/v1/school-plan` báo gói giới hạn (trường alpha) hoặc chỉ đọc (trường beta), tối đa 45 giây, rồi tải lại trang và mới kiểm menu, dải báo. Mã ứng dụng không đổi.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: không thêm điểm cuối xóa bộ đệm chỉ để kiểm thử; kiểm thử chờ đúng hành vi đã ghi của bộ phân giải trường (đọc lại sau tối đa 30 giây).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-366, `23_LICH_SU_PHIEN_BAN.md` 0.208.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-29 — Admin đủ quyền ở mọi ứng dụng của trường

#### Công việc đã thực hiện

- Dịch vụ định danh: phiên Admin vào thẳng nhận ở `/auth/me` vai trò tổng hợp có mọi mã quyền của trường ở toàn trường và mọi phân hệ; kiểm lại ở mỗi yêu cầu theo vai trò, trạng thái hiện hành của nhân viên vận hành. Đổi đường liên kết hỗ trợ nhận kênh `portal`, `teacher`, `parent` (kênh học sinh từ chối), nhật ký phiên ghi kèm kênh.
- Ứng dụng giáo viên, phụ huynh: trang `/support-login` (thành phần dùng chung `SupportSignIn` ở `packages/ui`).
- Cổng vận hành: nhóm nút "Ứng dụng của trường" ở mục Phiên hỗ trợ của trang chi tiết trường; `scripts/chay-nhieu-truong.mjs` đặt cổng của hai ứng dụng.
- Phần 315b (Eric phàn nàn không vào được ứng dụng phụ huynh, học sinh): chế độ xem của nhân viên hỗ trợ ở hai ứng dụng: chọn lớp, rồi học sinh, chỉ đọc; kênh học sinh nhận phiên hỗ trợ; điểm cuối `/support-view` và `/student/support-view`; tiêu đề `x-support-view-child` chỉ nhận ở phiên Admin; hồ sơ trang đầu ứng dụng học sinh không chặn theo gói thi trực tuyến; nút "Ứng dụng học sinh" ở cổng vận hành.
- Kiểm thử: CT-1551, CT-1552 ở `apps/identity`; CT-1553 ở `apps/api`.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: quyền đầy đủ là vai trò tổng hợp tính khi đọc, không thêm vai trò vào cơ sở dữ liệu của trường; mã vai trò Hiệu trưởng để lớp phạm vi dữ liệu là toàn trường; mỗi ứng dụng một phiên vào thẳng riêng.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-315, `23_LICH_SU_PHIEN_BAN.md` 0.207.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-28 — Thiết kế lại cổng quản trị trường, phần khung chung (YCTD-330)

#### Công việc đã thực hiện

- Khảo sát mã `apps/portal` và bản chạy trên máy, lập danh sách yếu tố thừa về hình thức; vẽ canvas thiết kế 14 màn "Cổng quản trị trường" (khung chung, đăng nhập, bảng điều khiển, cán bộ, hồ sơ cán bộ, học sinh, lớp, điểm danh, sổ điểm, thời khóa biểu, Công văn của tôi, văn bản đến và đi, thu phí, cài đặt trường). Eric duyệt ngày 2026-10-28.
- Làm phần khung chung: thanh bên trái xanh đậm có tên trường, ô chọn phân hệ (thêm ô lọc khi có hơn 8 phân hệ) và cây menu đánh số gập mở của phân hệ đang chọn; nhóm chứa trang đang mở tự mở; dưới 1280 px thanh bên là ngăn kéo. Thanh đầu trang giữ cấp học, năm học, Việc của tôi, chuông, ứng dụng liên kết, menu người dùng. Bỏ chân trang, "Gửi phản hồi" chuyển vào menu người dùng. Trang chủ bỏ tiêu đề "Tổng quan phân hệ" và khối Lối tắt (trùng cây menu). Màu nút chính, thanh đầu trang đổi sang xanh đậm (#1f4e8c, #12304f) trong cổng quản trị.
- Đổi trợ giúp e2e `tests/e2e/menu.ts` sang thanh bên (`sideMenu`, `workspaceMenu`, `openGroup`); sửa kịch bản 01, 53, 83, 184 theo khung mới.

#### Quyết định

- GD-170: thanh bên trái thay menu ngang của DT-15 phần 15a. GD-171: giữ số thứ bậc theo Sở trên menu. Ghi ở `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 21.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-330, `23_LICH_SU_PHIEN_BAN.md` 0.206.0.

#### Vấn đề tồn đọng

- Chưa làm ở phần này: gom cấp học, năm học, học kỳ vào một nút; dải thông báo một dòng thay hộp bật lên; ô tìm chung ở đầu trang; trang "Tất cả chức năng"; nhóm "Hay dùng" khi chọn phân hệ; phông chữ Be Vietnam Pro. Các trang theo thiết kế làm ở YCTD-331 trở đi.
- Chưa xem tận mắt trên máy: bản chạy thử ở cổng riêng không nhận ra trường qua proxy; dựa vào kiểm thử giao diện trên CI.

### 2026-10-28 — Cổng vận hành nền tảng: chuyển loại dữ liệu, thêm hồ sơ đồng ý, vùng máy chủ ở chi tiết trường

#### Công việc đã thực hiện

- Sửa lỗi mức Cao T-P2 của rà soát giao diện 2026-10-28: dịch vụ định danh đã có `POST /auth/platform/schools/{mã}/consents`, `/hosting`, `/data-class` nhưng cổng nền tảng không gọi, nên trường đã tạo không chuyển được từ `synthetic` sang `consented` hay `production` (tài liệu 32 mục S2, S9 mục 7).
- Màn Chi tiết trường (MH-318) thêm khối "Loại dữ liệu, hồ sơ đồng ý và vùng máy chủ" (`apps/platform/src/SchoolDataGovernance.tsx`): loại dữ liệu hiện tại, ghi chú chính sách môi trường, danh sách còn thiếu để dùng dữ liệu thật; chọn loại mới, hỏi xác nhận rồi gửi, lỗi nghiệp vụ của máy chủ hiện kèm từng mục còn thiếu; bảng hồ sơ đồng ý (có trạng thái còn hiệu lực, hết hạn, đã rút) và biểu mẫu thêm hồ sơ; bảng vùng máy chủ và biểu mẫu thêm vùng máy chủ. Thay danh sách chỉ xem trước đây.
- Máy chủ: ba điểm cuối trên chỉ nhận vai trò vận hành `quan_tri`, `ky_thuat` (trước đây mọi vai trò); hỗ trợ, kế toán nhận 403. Cổng nền tảng ẩn nút theo cùng danh sách (`DATA_GOVERNANCE_ROLES`). Chi tiết trường trả thêm `consent_gaps` tính theo cùng quy tắc với bước chuyển sang `consented` (đủ bốn hồ sơ còn hiệu lực, có vùng máy chủ chưa kết thúc).
- Kiểm thử: `apps/identity/src/platform/school-data-class.test.ts` CT-1630 đến CT-1634 (đúng, sai, theo vai trò, chính sách môi trường); e2e nhiều trường `tests/e2e/141-school-data-class.spec.ts` CT-1635, CT-1636 (thêm số 141 vào `MULTI_TENANT_SPEC`).

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: đổi loại dữ liệu, ghi hồ sơ đồng ý và vùng máy chủ chỉ cho quản trị và kỹ thuật. Đây là bằng chứng pháp lý (Nghị định 13/2023/NĐ-CP) và bước chuyển máy chủ (S9 mục 7 do kỹ thuật làm sau `platform relayout`); hỗ trợ và kế toán không cần thao tác này.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: giữ quy tắc chuyển loại của máy chủ như cũ (đi qua cổng hồ sơ đồng ý khi sang `consented`, chính sách môi trường chặn loại không cho phép), không chặn thêm chiều về `synthetic`; giao diện hỏi xác nhận kèm cảnh báo trường dữ liệu giả có thể bị tự xóa.
- Mã băm bản quét vẫn nhập tay; tải bản quét và tự tính mã băm là T-P4, làm riêng.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-343, `23_LICH_SU_PHIEN_BAN.md` 0.205.0.

#### Vấn đề tồn đọng

- Chưa có thao tác rút hồ sơ đồng ý hay kết thúc vùng máy chủ ở cổng (máy chủ chưa có điểm cuối).
- Đề xuất: cân nhắc chặn chuyển trường `consented`, `production` về `synthetic` khi còn dữ liệu thật, vì trường dữ liệu giả có thể bị tự xóa.

### 2026-10-29 — Sửa CI nhánh chính: ảnh tham chiếu trang đăng nhập cổng quản trị (YCTD-352)

#### Công việc đã thực hiện

- Việc `kiem-thu-thiet-bi` của nhánh chính hỏng từ PR 233 (YCTD-310, giao diện đăng nhập mới): ca `180-device-frame.spec.ts:70` "Ảnh chụp tham chiếu trang đăng nhập cổng quản trị" lệch ảnh mẫu ở bốn dự án `dien-thoai`, `dien-thoai-webkit`, `may-tinh-bang-doc`, `may-tinh-bang-ngang` (lỗi L-02 ở `35_KET_QUA_KIEM_THU.md`, YCTD-321).
- Thay bốn ảnh mẫu `tests/e2e/180-device-frame.spec.ts-snapshots/dang-nhap-cong-quan-tri-*-linux.png` bằng ảnh `*-actual.png` của lần chạy CI nhánh chính 40688025038 (commit `8123bf4d`, artifact `ket-qua-kiem-thu-thiet-bi-0`), theo cách của YCTD-306.
- Ảnh thực tế ổn định: mỗi khổ có bốn bản (hai mảnh, lần chạy và lần thử lại) giống hệt nhau. Trang đăng nhập cổng quản trị không đổi từ `8123bf4d` đến `5bb5e025` (không có thay đổi ở `apps/portal/src/pages/LoginPage.tsx`, `apps/portal/src/index.css`, `packages/ui`).
- PR gắn nhãn `thiet-bi-day-du` để chạy đủ bốn dự án thiết bị.

#### Quyết định

- Không đổi ngưỡng `maxDiffPixelRatio` và không bỏ ca ảnh tham chiếu. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-352, `23_LICH_SU_PHIEN_BAN.md` 0.204.0.

#### Vấn đề tồn đọng

- PR 243 (khung chung mới của cổng quản trị) sửa `apps/portal/src/index.css`; nếu PR đó làm đổi trang đăng nhập thì sinh lại bốn ảnh này từ CI sau khi merge.

### 2026-10-28 — Rà soát lại quy trình và kiểm thử toàn bộ trên nhánh chính (YCTD-321)

#### Công việc đã thực hiện

- Chạy lại quy trình Vibecoding_Flow trên `origin/main` `8123bf4d` (sau PR 220 đến 236). Phiên rà soát: không sửa mã, không đổi nghiệp vụ, chỉ ghi lỗi và đề xuất.
- Đối chiếu bộ tài liệu với danh sách tệp bắt buộc của quy trình, quy ước tệp mảnh và `node scripts/gom-thay-doi.mjs --kiem` (44 tệp mảnh, 0 lỗi).
- Lập bảng truy xuất YCTD-295 đến YCTD-313 (tiêu chí nghiệm thu, kịch bản kiểm thử, kiểm thử tự động, kết quả).
- Chạy thật trên cơ sở dữ liệu riêng của phiên (`school_identity_rs321`, `school_system_rs321`): `pnpm format:check`, `pnpm lint`, `pnpm build`, `pnpm typecheck`, `pnpm database:migrate`, `pnpm test`, ba bộ e2e như CI (giao diện, thiết bị tập con yêu cầu kéo, nhiều trường) có giữ khoá e2e.
- Rà bảo mật theo `22_BAO_MAT.md` cho PR 233 đến 236 (đăng nhập, phiên, mật khẩu, argon2id, mã xác nhận, nhật ký, số CCCD, bí mật trong kho).
- Ghi kết quả, danh sách lỗi theo mức độ và đề xuất xử lý vào tài liệu mới `35_KET_QUA_KIEM_THU.md`.

#### Quyết định

- Kết quả kiểm thử ghi ở tệp mới số 35 vì số 25 và 26 của dự án đã dùng cho `25_QUY_TRINH_NGHIEP_VU/` và `26_SO_DO_CHUC_NANG/` (phiên điều phối đồng ý ngày 2026-10-28). Việc lệch số so với danh sách của quy trình ghi thành phát hiện mức Thấp để Eric quyết.
- Không ghi bù quyết định "mở mọi trường", "gói miễn phí" (thuộc YCTD-314 đang làm, chưa merge) và "sổ liên lạc" (không tìm thấy dữ liệu trong kho và ghi chú các phiên) để không bịa.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-321, `23_LICH_SU_PHIEN_BAN.md` 0.203.0, `35_KET_QUA_KIEM_THU.md`.

#### Vấn đề tồn đọng

- Các lỗi và đề xuất ở `35_KET_QUA_KIEM_THU.md` mục 6, chờ Eric duyệt cách xử lý.

### 2026-10-29 — Áp bản thiết kế cho Chợ gia sư phía phụ huynh

#### Công việc đã thực hiện

- Áp bản thiết kế "Chợ gia sư, Gia sư, Cấp trên" (Eric duyệt ngày 2026-10-28) cho `apps/market`: khung chung `MarketShell` (gói `packages/market-client`) có thanh đầu trang trắng, nhãn "Thanh toán giả lập", dải báo chợ chạy thử, nội dung rộng, chân trang có đường dây nóng và văn bản pháp lý; biểu mẫu đăng ký, đăng nhập, xác nhận mã nằm trong thẻ giữa trang.
- Khu phụ huynh chia năm trang theo thanh điều hướng ở đầu trang (Tìm gia sư, Buổi học của con, Tin nhắn, Hồ sơ con, An toàn) thay cho một trang dài; trang đang mở ghi ở phần `#` của địa chỉ. Tài khoản chưa có hồ sơ con thì vào thẳng trang Hồ sơ con.
- Tìm gia sư: khối tìm ở đầu trang (môn, cấp, lớp, ngày trống), bộ lọc thêm bên trái (loại nội dung, giá tối đa, huy hiệu xác minh), sắp xếp, thẻ gia sư có chữ đầu tên thay ảnh. Ô "Ngày trống" dùng tham số `weekday` máy chủ đã có từ 27g nhưng giao diện chưa gọi; lọc theo huy hiệu làm ở trình duyệt.
- Trang gia sư hai cột: hồ sơ, Mẫu 02 dạng bảng, lưới giờ trống bảy ngày; thẻ đặt buổi bên phải có tóm tắt học phí, thời lượng, hạn giữ chỗ 30 phút, nút sang thanh toán.
- Buổi học của con chia nhóm Sắp tới, Cần bạn xem, Đã xong; mỗi buổi có ô ngày giờ, nhãn trạng thái. "Thanh toán giả lập" mở khung ghi rõ "Đây là thanh toán giả lập", chỗ đặt mã QR không quét được, nút "Giả lập: đã trả thành công".
- Hồ sơ con: mỗi con một thẻ; thêm nút sửa hồ sơ con (gọi `PUT /market/children/:id` đã có, việc T-M7 của rà soát giao diện); xóa hồ sơ con phải xác nhận qua hộp thoại (sửa H-6); khối thông tin tài khoản chỉ xem.
- Trang An toàn: đường dây nóng, danh sách báo cáo phụ huynh đã gửi kèm trạng thái và kết quả (gọi `GET /market/reports` đã có, việc T-M8), chính sách an toàn trẻ em.
- Tin nhắn: hộp thư bên trái, hội thoại bên phải, tin của mình bên phải; dùng chung với ứng dụng Gia sư.
- Màu theo bản thiết kế: xanh #1f4e8c, #12304f, nền kem #fbf8f3, ghi đè biến màu trong `apps/market/src/index.css`, không sửa `packages/ui`; vùng chạm 44 px.
- Sửa kiểm thử giao diện 197, 198 theo điều hướng mới và khung thanh toán giả lập; 198 thêm bước xem báo cáo đã gửi ở trang An toàn.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: phần này chỉ đổi giao diện và nối các API máy chủ đã có; chức năng trong bản vẽ cần API mới thì chưa hiện (không vẽ nút không chạy).
- Giữ phông chữ hệ thống như cổng quản trị đã áp thiết kế (PR 239), chưa tải Be Vietnam Pro.
- Phòng học video của chợ làm ở YCTD-362; nút "Vào phòng học" giữ nguyên hành vi cũ trong phần này.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-360, `23_LICH_SU_PHIEN_BAN.md` 0.202.0.

#### Vấn đề tồn đọng

- Chưa làm vì cần API mới: đánh giá sau buổi và gia sư trả lời, sắp xếp theo đánh giá (T-M2); gói buổi (T-M3); đổi mật khẩu, sửa thông tin tài khoản, quên mật khẩu (T-M5); đăng nhập định danh cho phụ huynh (T-M6); con đọc tin nhắn khi phụ huynh cho (T-M9); nút "Giả lập: trả lỗi" (bộ giả lập chưa có đường trả lỗi).

### 2026-10-29 — Ban Giám hiệu xem và xét duyệt hồ sơ tuyển sinh

#### Công việc đã thực hiện

- Sửa lỗi ở trang `/admissions` trong phần chạy thử của rà soát giao diện ngày 28/10/2026: với Hiệu trưởng (VT-02), `GET /admission-campaigns` trả 403. Ma trận quyền (tài liệu 08 mục 3) ghi VT-02, VT-15 được phê duyệt ("D") ở P16 Tuyển sinh, nhưng migration 0035 chỉ cấp `P16.application.review` cho VT-03; Ban Giám hiệu không có quyền P16 nào.
- Migration định danh `0184_add_admission_review_for_principals`: cấp `P16.application.review` cho VT-02, VT-15. Ban Giám hiệu thấy mục 1. Tuyển sinh, xem đợt và hồ sơ, xét đạt hoặc không đạt; lập đợt, tiếp nhận hồ sơ, tin tuyển sinh vẫn của VT-12, VT-03.
- Lỗi 500 của `GET /account-directory` ghi cùng trang: điểm cuối này thuộc trang 1.4 Danh sách người dùng (`/accounts`), không phải trang tuyển sinh; bộ dò ghi theo trang đang mở nên yêu cầu của trang trước rơi vào `/admissions`. Kiểm thử nhiều trường với tài khoản VT-02 trả 200; đo truy vấn trên cơ sở dữ liệu định danh của bản trên máy (49 nghìn tài khoản) đều dưới 100 ms, nên không phải quá hạn chờ 5 giây. Chưa tái hiện được, chưa sửa mã.
- Kiểm thử: CT-1610 trong `apps/api/src/admissions/admissions.test.ts`.

#### Quyết định

- Ô "D" của VT-02, VT-15 ứng với quyền xét duyệt hồ sơ (`P16.application.review`), quyền phê duyệt duy nhất của P16; không cấp quyền lập đợt hay tiếp nhận. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-341, `23_LICH_SU_PHIEN_BAN.md` 0.201.0.

#### Vấn đề tồn đọng

- Lỗi 500 của danh sách người dùng ở bản nhiều trường trên máy: khi chạy lại, đọc nhật ký máy chủ API và dịch vụ định danh theo mã tương quan của phản hồi lỗi.
- Các vai trò "X" (chỉ xem) ở dòng P16 của ma trận (VT-04, VT-05, VT-06, VT-09) chưa có quyền xem tuyển sinh vì P16 chưa có quyền chỉ xem.

### 2026-10-29 — Dặn thuốc theo QT-07: trạng thái Đã nhận thuốc, báo phụ huynh khi cho uống, leo thang sự kiện y tế nặng

#### Công việc đã thực hiện

- Rà soát giao diện ngày 2026-10-28 (mục 3.1 C3, mức Cao) ghi `/medicines` lệch QT-07 và "chưa kiểm lại phía máy chủ". Kiểm lại máy chủ: nhận thuốc chuyển thẳng `pending` sang `administering`; cho uống không báo phụ huynh; từ chối, bỏ liều chỉ báo trong ứng dụng; gửi yêu cầu chỉ báo một bên (y tế hoặc giáo viên chủ nhiệm); không tự hoàn thành khi hết thời gian dùng; sự kiện y tế không báo quản lý đơn vị, sự kiện nặng không leo thang.
- Máy chủ (`apps/api/src/medicines/medication-requests.ts`): thêm trạng thái `received` (Đã nhận thuốc). Nhận thuốc chuyển `pending` → `received`; liều đầu tiên chuyển `received` → `administering`; ghi liều, lịch cho uống, kết thúc sớm nhận cả `received` và `administering`; từ chối chỉ từ `pending`. Hết thời gian dùng thì yêu cầu `received`, `administering` tự chuyển `completed`. Gửi yêu cầu báo cả y tế của đơn vị và giáo viên chủ nhiệm, ghi rõ người nhận thuốc. Mỗi liều cho uống báo phụ huynh trong ứng dụng (`medication_dose_given`); bỏ liều và từ chối báo thêm tin nhắn.
- Sự kiện y tế (`apps/api/src/health/health-care.ts`): mọi sự kiện báo quản lý đơn vị (VT-03) trong ứng dụng; sự kiện nặng leo thang VT-03, Hiệu trưởng (VT-02), Phó Hiệu trưởng phụ trách đơn vị (VT-15).
- Cơ sở dữ liệu năm học: migration `0224_add_medication_received_status` mở ràng buộc trạng thái, chuyển phiếu `administering` chưa có liều nào về `received`.
- Cổng quản trị `/medicines`: trạng thái Chờ nhận thuốc, Đã nhận thuốc; "Nhận thuốc" mở biểu mẫu dưới dòng (Số lượng thực nhận, Tình trạng thuốc, "Xác nhận đã nhận thuốc"); cột trạng thái hiện thuốc thực nhận; "Kết thúc" có ở phiếu đã nhận và đang cho uống. Ứng dụng phụ huynh (MP-07) hiện "Nhà trường đã nhận thuốc"; ứng dụng giáo viên (MG-09) hiện "Đã nhận thuốc" trong danh sách đang thực hiện.
- Kiểm thử: `apps/api/src/medicines/medicines.test.ts` (cập nhật CT-055, CT-171; thêm CT-1660 đến CT-1666), `apps/api/src/health/health.test.ts` (cập nhật CT-058; thêm CT-1667); e2e spec 31 thêm bước nhập thuốc thực nhận và phụ huynh thấy Nhà trường đã nhận thuốc.

#### Quyết định

Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở những chỗ QT-07 không nói rõ:

- Hoàn thành khi hết thời gian dùng: hệ thống chuyển lúc đọc danh sách, chi tiết, lịch cho uống (mọi nơi trạng thái hiện ra), không thêm việc nền theo giờ. Phiếu Đã nhận thuốc chưa ghi liều nào mà hết thời gian dùng cũng chuyển Hoàn thành (QT-07 chỉ vẽ Đang cho uống → Hoàn thành; giữ Đã nhận thuốc mãi thì danh sách đọng). Phiếu chờ nhận hết hạn giữ nguyên để người nhận thuốc từ chối kèm lý do.
- Kết thúc sớm (phụ huynh dặn ngừng thuốc) được từ Đã nhận thuốc và Đang cho uống.
- Tin nhắn cho phụ huynh khi từ chối, bỏ liều theo QT-07 mục 9; người nhận theo quy tắc chọn phụ huynh nhận tin nhắn sẵn có (như sự kiện y tế nặng). Cho uống, nhận thuốc chỉ trong ứng dụng.
- Sự kiện y tế: QT-07 mục 9 ghi kênh "trong ứng dụng và tin nhắn" cho phụ huynh; giữ quy tắc sẵn có (tin nhắn chỉ khi sự kiện nặng, YCTD-74), chỉ thêm người nhận ở trường. Quản lý đơn vị nhận mọi sự kiện (QT-07 bước 8); sự kiện nặng báo thêm Ban Giám hiệu (VT-02, VT-15 theo đơn vị). Thông báo gửi theo vai trò nên chỉ trong ứng dụng (bộ gửi tin nhắn cần tài khoản cụ thể).
- E8 (sự kiện nặng chưa xử lý quá thời gian cấu hình): sự kiện y tế bắt buộc nhập cách xử lý ngay khi ghi nên không có trạng thái "chưa xử lý"; leo thang làm ngay khi ghi sự kiện nặng thay cho cảnh báo trễ. Không thêm cấu hình thời gian.
- Nhãn trạng thái `pending` trên cổng quản trị đổi "Chờ nhận" thành "Chờ nhận thuốc" (khớp ứng dụng phụ huynh, giáo viên); trạng thái "Phụ huynh gửi" của QT-07.
- Số migration 0224 theo phiên bản đề xuất, tránh dải 0202 trở đi các phần song song có thể dùng; kho mã bật `allowUnorderedMigrations`. Không cần migration định danh.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-344, `23_LICH_SU_PHIEN_BAN.md` 0.200.0; BR-52 (sửa tại chỗ), P10-04, P10-07, MH-17, MP-07, CT-1660 đến CT-1667.

#### Vấn đề tồn đọng

- Nhắc giờ cho uống thuốc (QT-07 mục 15, việc chạy nền) chưa làm, ngoài phạm vi C3.

### 2026-10-28 — Khai báo cơ sở vật chất mở được với quyền quản lý thiết bị

#### Công việc đã thực hiện

- Sửa lỗi mức Cao số 7 của rà soát giao diện ngày 28/10/2026: mục menu 1.1 Khai báo cơ sở vật chất (`/facility-rooms`) hiện cho người có `P13.equipment.manage`, nhưng `GET /facilities/rooms` và `POST /facilities/rooms/export` chỉ nhận `P17.report.facilities` hoặc `P01.room.manage`, nên vai trò chỉ có quyền thiết bị (vai trò trường tự tạo) mở trang thì bị 403.
- Máy chủ API nhận thêm `P13.equipment.manage` cho hai điểm cuối chỉ đọc này; phạm vi đơn vị tính theo cùng bộ quyền. Thêm, sửa phòng vẫn qua danh mục phòng học (`P01.room.manage`).
- Kiểm thử: CT-14d-3 thêm vai trò thử chỉ có quyền thiết bị (xem, lọc sai bị 400, xuất được) và vai trò chỉ có quyền báo cáo EMIS (xem, xuất đều 403).

#### Quyết định

- Mở rộng quyền ở máy chủ thay vì thu hẹp menu: MH-80 và P13-11 đã ghi VT-11 (nhân viên kho, người quản lý thiết bị) được xem, và người quản lý thiết bị cần danh sách phòng để đặt thiết bị. Điểm cuối chỉ đọc, không có dữ liệu cá nhân. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-340, `23_LICH_SU_PHIEN_BAN.md` 0.199.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-28 — Điểm danh đầu ngày ở mọi cấp, điểm danh theo tiết lấy mặc định từ điểm danh đầu ngày

#### Công việc đã thực hiện

- `packages/shared/src/level-features.ts`: bật `daily_attendance` cho mọi cấp. Ứng dụng giáo viên mở bảng điểm danh theo ngày ở lớp mọi cấp (thẻ lớp, chế độ lớp học). Ứng dụng phụ huynh hiện "Điểm danh tháng này" và dòng điểm danh hôm nay ở con mọi cấp.
- Bảng điểm danh của ứng dụng giáo viên ghi "Điểm danh cả ngày" ở lớp Mầm non, "Điểm danh đầu ngày" ở lớp Tiểu học, THCS, THPT.
- `GET /class-logs/lesson`: tiết chưa ghi điểm danh lấy trạng thái theo điểm danh đầu ngày của học sinh ở lớp:
  - có mặt, đi muộn giữ nguyên;
  - về sớm là có mặt; đi muộn và về sớm là đi muộn;
  - nghỉ có báo là vắng có phép; nghỉ không báo là vắng không phép.
  Ngày chưa điểm danh đầu ngày thì như trước: có báo vắng là vắng có phép, không có là có mặt. Mỗi học sinh có thêm `status_source`, `daily_status`; ghi chú mặc định là ghi chú của điểm danh đầu ngày. Logic tách ở `apps/api/src/class-logs/period-defaults.ts`.
- Sổ đầu bài của ứng dụng giáo viên ghi "Theo điểm danh đầu ngày: …" dưới tên học sinh. Học sinh về sớm được tô màu, nhắc chọn vắng có phép ở các tiết sau. Giáo viên tiết vẫn sửa được trạng thái (điểm danh lại).
- Kiểm thử đơn vị `period-defaults.test.ts`, kiểm thử máy chủ API ở `class-logs.test.ts`. Sửa `multi-level-apps.test.ts` và kiểm thử giao diện 85 theo quy tắc mới.

#### Quyết định

- Eric chốt ngày 2026-10-28: Mầm non điểm danh cả ngày; các cấp khác điểm danh theo tiết, chủ yếu lấy từ điểm danh đầu ngày, trừ khi giáo viên muốn điểm danh lại hoặc học sinh có phép về sớm.
- Điểm danh đầu ngày đã ghi đứng trước báo vắng của phụ huynh, vì giáo viên đã xác nhận tại lớp. Về sớm không biết từ tiết nào nên các tiết vẫn mặc định có mặt; giáo viên tiết sau sửa. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-350, `23_LICH_SU_PHIEN_BAN.md` 0.198.0.

#### Vấn đề tồn đọng

- Chưa ghi giờ về sớm ở điểm danh đầu ngày; nếu cần tự đánh vắng các tiết sau giờ về thì làm phần riêng.

### 2026-10-28 — Giáo viên trả lời trao đổi trên bài nộp ở ứng dụng giáo viên

#### Công việc đã thực hiện

- Sửa lỗi mức Cao T1 của rà soát giao diện ngày 2026-10-28 (phụ lục giáo viên, phụ huynh, học sinh, mục H3): ở màn Chấm bài của Bài tập trực tuyến (MH-421), khối "Trao đổi trên bài" chỉ liệt kê, học sinh và phụ huynh hỏi được mà giáo viên không trả lời được.
- Ứng dụng giáo viên: khối "Trao đổi trên bài" luôn hiện ở màn Chấm bài, gồm các lời trao đổi (tên kèm Giáo viên, Học sinh hoặc Phụ huynh), dòng "Chưa có lời trao đổi nào" khi trống, ô "Trả lời học sinh, phụ huynh" (tối đa 2000 ký tự) và nút "Gửi trả lời". Nút khoá khi ô trống hoặc đang gửi. Gửi xong, lời trả lời hiện ngay ở cuối luồng lấy từ phản hồi của máy chủ, ô soạn được xoá, báo "Đã gửi trả lời"; lỗi báo "Chưa gửi được trả lời: <lý do của máy chủ>".
- Máy chủ API: tuyến `POST /api/v1/learning/submissions/{id}/comments` đã có từ YCTD-273 và đã kiểm đúng quyền (`P02.assignment.manage` cộng giáo viên của lớp học trực tuyến có hoạt động, qua cửa `teacherActivity` của lõi 28b); không đổi mã máy chủ, bổ sung kiểm thử.
- Kiểm thử máy chủ API (CT-28c-18): giáo viên của lớp gửi được (201, bỏ khoảng trắng hai đầu, ghi `author_kind: teacher`); giáo viên khác lớp, phụ huynh, học sinh 403; lời rỗng, thiếu nội dung, quá 2000 ký tự 422, đúng 2000 ký tự được; bài không có 404; giáo viên đọc lại bài thấy lời trả lời sau lời của học sinh; học sinh thấy lời trả lời ở lần nộp.
- Kiểm thử đơn vị ứng dụng giáo viên (CT-28c-17): hàm kiểm lời trả lời và hàm nối lời vừa gửi vào luồng.
- Kiểm thử giao diện `212-online-assignments` (CT-28c-16) thêm bước: học sinh hỏi trên bài đã trả, giáo viên mở bài thấy câu hỏi, nút gửi khoá khi ô trống, gửi trả lời, lời hiện ngay, ô soạn trống; học sinh mở lại thấy lời trả lời.

#### Quyết định

- Sau khi gửi, màn hình nối lời trả lời vào luồng từ phản hồi của máy chủ thay vì đọc lại cả bài nộp, để không ghi đè điểm, nhận xét giáo viên đang chấm dở. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Không sửa máy chủ vì tuyến đã chặn đúng giáo viên khác lớp; chỉ bổ sung kiểm thử theo vai trò. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Ô trả lời nằm ngay trong màn Chấm bài, không tách màn mới; không đụng hộp công cụ giảng dạy (PR 246).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-346, `23_LICH_SU_PHIEN_BAN.md` 0.197.0.

#### Vấn đề tồn đọng

- Chưa báo cho học sinh, phụ huynh khi giáo viên trả lời (chỉ thấy khi mở bài); cần thì làm cùng đợt thông báo của học trực tuyến.

### 2026-10-28 — Trang chủ ứng dụng phụ huynh thêm thẻ Khoản cần nộp và Điểm mới

#### Công việc đã thực hiện

- Thẻ của từng con trên trang chủ ứng dụng phụ huynh có thêm hai thẻ tóm tắt trên lưới lối tắt:
  - "Khoản cần nộp": tối đa ba hóa đơn đã phát hành còn phải nộp (tháng, số còn phải nộp), nhãn hạn nộp gần nhất, nút "Xem và thanh toán" mở bảng Học phí (có mã QR).
  - "Điểm mới" (con học THCS, THPT): tối đa ba môn có điểm ở học kỳ đã khoá gần nhất (trung bình môn hoặc Đạt, Chưa đạt), nút "Xem sổ điểm" mở bảng Điểm học tập.
- Hai thẻ dùng đúng điểm cuối của bảng Học phí (`GET /invoices?child_id=`) và Điểm học tập (`GET /scores/children/:id`); lỗi hay chưa có dữ liệu thì ẩn thẻ. Thành phần ở `apps/parent/src/screens/ChildSummaryCards.tsx`.

#### Quyết định

- Không làm nút "Đổi con" và thanh điều hướng dưới của mẫu giao diện: kiểm thử giao diện 85, 86 cần thấy thẻ của mọi con cùng lúc, ứng dụng phụ huynh chưa có điều hướng dưới (đổi khung ứng dụng là việc riêng). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-320, `23_LICH_SU_PHIEN_BAN.md` 0.196.0.

#### Vấn đề tồn đọng

- Nút "Đổi con", thanh điều hướng dưới chờ Eric quyết định có đổi khung ứng dụng phụ huynh hay không.

### 2026-10-28 — Danh sách học sinh thêm cột Phụ huynh, Chuyên cần và Đồng bộ CSDL ngành

#### Công việc đã thực hiện

- `GET /api/v1/children` trả thêm `guardian_name` (họ tên người liên hệ chính) và `attendance_rate`: phần trăm số ngày có mặt (kể cả đi muộn, về sớm) trên số ngày đã điểm danh ở năm học, làm tròn số nguyên, chưa điểm danh ngày nào là null. Xuất Excel, PDF danh sách nhận thêm cột `guardian_name` (Phụ huynh) và `attendance_rate` (Chuyên cần).
- Lưới 4.1.1. Quản lý hồ sơ học sinh thêm cột Phụ huynh và Chuyên cần (hiện mặc định, sau cột Số điện thoại liên hệ), cấu hình cột ẩn được.
- Nút "Đồng bộ CSDL ngành" (người có quyền nhập học sinh) mở hộp hướng dẫn đồng bộ bằng tệp 82 cột: "Tải tệp kèm dữ liệu để nộp" và "Nhập tệp từ CSDL ngành" (sang 4.1.2). Hệ thống không gửi dữ liệu đi.
- Kiểm thử máy chủ API cho hai trường mới.

#### Quyết định

- Đồng bộ CSDL ngành làm bản chạy nội bộ theo quyết định ngày 2026-10-16 của Eric về chức năng cần hệ thống bên ngoài: dùng tệp theo mẫu của Bộ, để sẵn chỗ nối kết nối thật.
- Chuyên cần tính trên năm học hiện tại (mỗi năm học một cơ sở dữ liệu); "có mặt" gồm đi muộn, về sớm, giống bộ đếm Có mặt của màn hình điểm danh. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-319, `23_LICH_SU_PHIEN_BAN.md` 0.195.0.

#### Vấn đề tồn đọng

- Kết nối trực tiếp CSDL ngành chờ Sở cấp giao diện kết nối.

### 2026-10-28 — Mở mọi trường trong danh mục, quản trị nền tảng vào thẳng, gói cơ bản miễn phí

#### Công việc đã thực hiện

- Thư viện `database`: `src/catalog-provisioning.ts` khởi tạo trường ở lần mở đầu tiên từ danh mục (mã `dv-<mã Bộ>`, tên miền `dv-<mã Bộ>.<tên miền chung>`, cơ sở dữ liệu định danh, hệ thống, năm học hiện tại, khóa, gói `co-ban-mien-phi`); chống trùng khi hai lần mở cùng lúc bằng ràng buộc duy nhất và bước nhận việc; việc bỏ dở quá 10 phút hoặc lỗi nhận lại được; tối đa 60 trường tự khởi tạo mỗi giờ. Việc khởi tạo của S2 nhận việc không có quản trị viên đầu tiên, đồng ý điều khoản và có bước gán gói.
- Tệp thay đổi cấu trúc nền tảng 0242: gói `co-ban-mien-phi`, cột `schools.addon_modules`, thêm mã `ai-assistant`, `online-learning` cho các gói đã có danh sách phân hệ.
- Dịch vụ định danh: `GET directory/unit` trả trạng thái trường của đơn vị, bỏ lời báo "chưa sử dụng hệ thống"; `POST directory/prepare` khởi tạo ở nền; `POST auth/platform/catalog/units/:moet/open` (Admin) khởi tạo rồi mở phiên vào thẳng; phiên hỗ trợ của vai trò `quan_tri` theo chính sách `any_school` không hỏi lý do, mã hai lớp, số giờ (hạn kỹ thuật 30 ngày), ghi `support.platform-admin-entry` ở nền tảng và `support_start` ở trường; `PUT auth/platform/schools/:code/addon-modules` bật tính năng trả phí riêng cho trường.
- Tài khoản quản trị trường (VT-01, VT-02): tạo tài khoản, gán vai trò thiếu số CCCD, họ tên hoặc số điện thoại thì 400. Bộ gửi thông báo không gửi SMS, Zalo khi gói chưa có `sms-zalo`.
- Máy chủ API: khai báo `RequirePlanModule` ở bộ điều khiển trợ lý AI, học trực tuyến (cả lớp trực tiếp), thi trực tuyến, gia sư; mọi lời gọi AI kiểm gói ở dịch vụ trợ lý AI; lời báo thống nhất "… là tính năng trả phí, trường chưa đăng ký. Liên hệ bộ phận hỗ trợ để bật." (mã lỗi `MODULE_NOT_IN_PLAN`).
- Cổng quản trị: trang đăng nhập hiện "Đang khởi tạo đơn vị…" và hỏi lại tới khi trường sẵn sàng; khung trang hiện lời báo tính năng trả phí khi mở trang của phân hệ chưa bật. Cổng vận hành: nút "Vào trường (quản trị nền tảng)" ở trang chi tiết trường, nút "Khởi tạo và vào trường" ở Danh mục đơn vị, mục "Gói dịch vụ và tính năng trả phí" bật, tắt từng tính năng.
- Kiểm thử: `database` CT-1531 đến CT-1533 (gồm hai lần mở đầu cùng lúc); `apps/identity` CT-1534 đến CT-1536 (khởi tạo từ trang đăng nhập, Admin vào thẳng, nhật ký hai phía, tạo tài khoản quản trị đầu tiên theo số CCCD, bật tính năng trả phí), sửa CT-24-6, CT-24-7, CT-S4 theo vai trò; `apps/api` CT-1537 (từ chối tính năng trả phí, bật riêng thì dùng được); e2e 160 (CT-24-9, CT-24-10), 136. E2e 01 không có lời báo cũ nên không đổi.

#### Quyết định

- Eric chốt ngày 2026-10-28: GD-159 (Admin vào mọi trường không hỏi, vẫn ghi nhật ký; sửa GD-110), GD-160 (mở mọi đơn vị, khởi tạo ở lần mở đầu tiên), GD-161 (gói cơ bản miễn phí, tính năng trả phí bật riêng từng trường), GD-162 (sổ liên lạc điện tử miễn phí; tin nhắn SMS, Zalo trả phí theo tin cho trường), GD-163 (tài khoản quản trị trường luôn đủ số CCCD, họ tên, số điện thoại).
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: dùng lại gói dịch vụ của S5a thay cho cơ chế cờ tính năng mới; phân hệ ngoài hai danh sách của Eric (tài chính, bếp, thư viện, …) để miễn phí trong gói cơ bản, người vận hành sửa gói ở cổng nền tảng nếu cần; hạn kỹ thuật 30 ngày cho phiên vào thẳng; tối đa 60 trường tự khởi tạo mỗi giờ; loại dữ liệu ban đầu `synthetic`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-314, `23_LICH_SU_PHIEN_BAN.md` 0.194.0.

#### Vấn đề tồn đọng

- Tính phí theo tin của tính năng `sms-zalo` ở phần thu phí (S5b) chưa làm; số tin đã gửi có ở `notification_recipients`.
- Bước setup của S2 vẫn tạo quản trị viên đầu tiên theo tên đăng nhập, chưa bắt số CCCD, điện thoại (GD-163 chỉ áp ở dịch vụ tài khoản).
- Luật sư rà ghi chú PL-02 Điều 5a sau khi bỏ ghi mục đích theo từng lần vào (GD-159).
- Bản nhiều trường đang chạy trên máy cần dựng lại (`pnpm build`), chạy tệp thay đổi cấu trúc nền tảng 0242 và khởi động lại để có gói miễn phí và tự khởi tạo (`scripts/chay-nhieu-truong.mjs` suy `PLATFORM_ADMIN_DATABASE_URL` từ `POSTGRES_PASSWORD`).

### 2026-10-28 — Siết kiểm duyệt và xác minh danh tính ở chợ gia sư

#### Công việc đã thực hiện

- Kiểm duyệt (27i, YCTD-259): báo cáo mức nghiêm trọng về gia sư chỉ tạm khóa ngay khi phụ huynh báo đã thực sự học với gia sư, tức có buổi đã nhận tiền hoặc luồng tin nhắn gia sư đã trả lời. Các báo cáo nghiêm trọng khác vào hàng chờ 4 giờ như trước.
- Tạm khóa tự động chỉ ẩn gia sư, chặn đặt buổi, nhắn tin, mở phòng và giữ tiền chưa giải ngân. Việc hủy buổi sắp tới (hoàn đủ) và báo phụ huynh có buổi với gia sư chỉ chạy khi nhân viên nền tảng tạm khóa hoặc quyết định tạm khóa, mỗi lần khóa một lần. Nhân viên bác hoặc cảnh cáo thì gỡ khóa như trước.
- Nhãn mức "Nghiêm trọng" ở form báo cáo đổi thành "Nghiêm trọng (xử lý trong 4 giờ)".
- Xác minh danh tính và đăng nhập OIDC (27g, YCTD-257): lúc bắt đầu, máy chủ đặt cookie httpOnly gắn lượt với trình duyệt. Lúc hoàn tất, cookie phải khớp `state`. Với mục đích xác minh còn phải có phiên của đúng tài khoản đã bắt đầu. Không khớp thì báo lượt đã hết hạn và không ghi kết quả.
- Kiểm thử:
  - CT-27i-3 sửa theo luồng giữ rồi xác nhận;
  - thêm CT-27i-7 cho người báo chưa học với gia sư, luồng chỉ phụ huynh nhắn, buổi giữ chỗ chưa trả tiền, luồng gia sư đã trả lời, bác thì gỡ khóa;
  - thêm CT-27g-6 cho hoàn tất ở trình duyệt khác, phiên của tài khoản khác, chưa đăng nhập, cookie của lượt khác;
  - e2e 198 kiểm hoàn tiền sau quyết định của nhân viên.

#### Quyết định

- Eric duyệt ngày 2026-10-28 theo kết quả rà soát bảo mật các PR ngày 2026-10-28.
- Quan hệ "đã học" không tính luồng chỉ phụ huynh nhắn và buổi giữ chỗ chưa trả tiền, vì người báo tự tạo được. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Không thêm cột: lần báo phụ huynh của mỗi lần khóa nhận ra qua nhật ký kiểm duyệt `tutor.suspend.notify` từ lúc bắt đầu khóa. Cookie chứa chính `state` (vốn đã nằm ở địa chỉ quay về), không cần lưu thêm ở cơ sở dữ liệu.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-322, `23_LICH_SU_PHIEN_BAN.md` 0.193.0.

#### Vấn đề tồn đọng

- Trong lúc chờ nhân viên xác nhận, buổi đã trả tiền của gia sư bị tạm khóa không mở phòng được nhưng chưa hủy. Hạn xử lý 4 giờ của mức nghiêm trọng giới hạn khoảng chờ này.

### 2026-10-28 — Sổ điểm nhập từ Excel và in sổ

#### Công việc đã thực hiện

- Máy chủ API thêm ba điểm cuối cho sổ điểm một môn ở một lớp, một học kỳ:
  - `GET /api/v1/scores/classes/:id/subjects/:subjectId/template?term_type=` trả `so-diem.xlsx`: cột Mã hệ thống, STT, Họ và tên, TX1…TXn (đủ số lần tối thiểu và số điểm đang có), Giữa kỳ, Cuối kỳ, Nhận xét (môn nhận xét: Kết quả, Nhận xét) kèm học sinh và điểm đang có; trang Hướng dẫn.
  - `POST /api/v1/scores/classes/:id/subjects/:subjectId/import` (biểu mẫu `term_type`, `file`) đọc tệp mẫu đã điền. Học sinh nhận theo mã hệ thống; điểm ghi dấu phẩy hoặc dấu chấm; số cột TX lấy theo tệp. Có dòng lỗi thì trả `saved: 0` và `errors` theo dòng, cột, không ghi; hợp lệ thì ghi như nút Ghi điểm (cùng quyền phân công, khoá sổ, hạn nhập).
  - `GET /api/v1/scores/classes/:id/subjects/:subjectId/print?term_type=` trả `so-diem.pdf`: tiêu đề lớp, môn, học kỳ; STT, họ tên, điểm, TB môn HK, nhận xét.
- Màn hình sổ điểm thẻ Nhập điểm thêm "Tải mẫu Excel", "Nhập từ Excel" (người được nhập môn) và "In sổ" (người xem được sổ); lỗi của tệp liệt kê theo dòng.
- Logic tệp tách ở `apps/api/src/scores/score-files.ts`, có kiểm thử đơn vị; kiểm thử máy chủ API cho cả ba điểm cuối.

#### Quyết định

- Nhập từ Excel ghi cả bảng của các học sinh có trong tệp (ô trống là chưa có điểm), giống bấm Ghi điểm sau khi sửa trên màn hình. Học sinh nhận theo mã hệ thống thay vì họ tên vì có thể trùng tên. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-318, `23_LICH_SU_PHIEN_BAN.md` 0.192.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-28 — Xuất Excel thời khoá biểu theo lớp, giáo viên, phòng

#### Công việc đã thực hiện

- Máy chủ API thêm `GET /api/v1/timetable-versions/:id/export`, cùng bộ lọc `class_id`, `teacher_user_id`, `room_id` với màn hình xem. Tệp `thoi-khoa-bieu.xlsx` có mỗi lớp, giáo viên hoặc phòng một trang tính. Mỗi trang có hai dòng tiêu đề (đối tượng; tên bản, ngày áp dụng), dòng là tiết kèm giờ theo khung giờ của cấp, cột là Thứ Hai đến Thứ Bảy (thêm Chủ nhật khi có tiết). Ô ghi môn kèm giáo viên, phòng (xem theo lớp), lớp, phòng (theo giáo viên) hoặc lớp, giáo viên (theo phòng); tiết học theo nhóm ghi "(nhóm N)". Không lọc thì mọi lớp.
- Quyền như xem thời khoá biểu (nhân sự xem được lớp); phụ huynh nhận 403.
- Màn hình 7.4. Thời khoá biểu thêm nút "Xuất Excel" cạnh ô chọn lớp, giáo viên, phòng; chưa chọn thì nút là "Xuất Excel mọi lớp".
- Dựng trang tính tách ở `apps/api/src/timetables/timetable-export.ts`, có kiểm thử đơn vị; kiểm thử máy chủ API cho đường dẫn xuất.

#### Quyết định

- Dùng bộ dựng tệp bảng dùng chung (`exports/table-file.ts`) và nhãn thứ dùng chung `TIMETABLE_WEEKDAY_LABELS` để tệp khớp màn hình. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-317, `23_LICH_SU_PHIEN_BAN.md` 0.191.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-28 — Thẻ Phân công giảng dạy ở trang hồ sơ cán bộ, giáo viên

#### Công việc đã thực hiện

- Máy chủ API thêm `GET /api/v1/staff/:id/teaching-assignments`: phân công giảng dạy, chủ nhiệm đang hiệu lực của nhân sự ở năm học hiện tại (lớp, khối, cấp, vai trò, môn, số tiết mỗi tuần, từ ngày, đến ngày) kèm tổng số tiết. Số tiết trống ở phân công thì lấy số tiết của chương trình theo khối. Phân công gắn với tài khoản nên hồ sơ chưa liên kết tài khoản trả danh sách trống kèm `has_account: false`.
- Quyền xem giống hồ sơ nhân sự: người có `P07.staff.view` trong phạm vi đơn vị của nhân sự hoặc chính nhân sự đó; người khác nhận 403.
- Trang `/staff/$staffId` thêm thẻ Phân công giảng dạy (`?tab=teaching`): bảng Lớp, Vai trò (Chủ nhiệm, Bộ môn), Môn, Số tiết/tuần, Từ ngày và dòng tổng số tiết mỗi tuần. Hồ sơ chưa liên kết tài khoản thì thẻ nhắc liên kết ở thẻ Thông tin chung. Liên kết, bỏ liên kết tài khoản làm mới danh sách.
- Kiểm thử máy chủ API: phân công đang hiệu lực, tổng số tiết, bỏ phân công đã kết thúc, chính giáo viên xem được, hồ sơ chưa liên kết trả trống, giáo viên khác bị từ chối.

#### Quyết định

- Thẻ chỉ hiện khi nhân sự có phân công đang hiệu lực hoặc hồ sơ chưa liên kết tài khoản; nhân sự đã liên kết mà không dạy lớp nào (kế toán, nhân viên) thì ẩn thẻ. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Xong việc "Chưa làm" ghi ở YCTD-309.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-316, `23_LICH_SU_PHIEN_BAN.md` 0.190.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-28 — Chọn phân hệ ở cổng quản trị thì về bảng điều khiển của phân hệ

#### Công việc đã thực hiện

- Sửa lỗi Eric báo: chọn phân hệ khác ở ô Phân hệ chỉ đổi menu ngang, vùng nội dung vẫn là trang của phân hệ cũ nên phải tự bấm.
- Theo yêu cầu "bảng điều khiển phải cập nhật theo phân hệ": chọn phân hệ khác thì về trang chủ; trang chủ có vùng "Tổng quan phân hệ" đổi theo phân hệ đang chọn. Chọn lại phân hệ đang mở thì giữ nguyên trang.
- Khối theo phân hệ, chỉ hiện khi menu đã lọc theo quyền có trang tương ứng:
  - Quản lý văn bản và điều hành: "Công văn đến của tôi" (văn bản chờ xử lý như thẻ Chờ xử lý của 1.1, số chờ xử lý, 5 dòng mới nhất) và "Công văn đi của tôi" (chờ xử lý và dự thảo của tôi), mỗi khối có "Xem tất cả".
  - Quản lý giáo dục, Tài chính, Báo cáo: bảng điều khiển MH-01; Quản lý giáo dục thêm sinh nhật trong tháng.
  - Phân hệ có trang Hồ sơ cán bộ, giáo viên: hợp đồng sắp hết hạn.
  - Mọi phân hệ: Việc cần xử lý và Lối tắt tới 8 trang đầu của phân hệ.
- Khối không có số liệu ghi "Trống" thay vì ẩn hoặc để trống.
- Khung trang chỉ tự chuyển menu theo trang khi trang không thuộc phân hệ đang chọn.
- Kiểm thử e2e: CT-15a-9 (chọn phân hệ về trang chủ, khối văn bản ghi "Trống" với tài khoản mới), kịch bản văn bản đến (khối Công văn đến hiện văn bản vừa trình lãnh đạo), kịch bản văn bản đi (khối Công văn đi hiện dự thảo chờ cho ý kiến).

#### Quyết định

- Bảng điều khiển của phân hệ nằm ở trang chủ `/` theo phân hệ đang chọn (đã lưu trên trình duyệt), không thêm đường dẫn riêng cho từng phân hệ. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Vùng ngoài đặt tên "Tổng quan phân hệ …" để không trùng tên vùng "Bảng điều khiển" của MH-01 mà kiểm thử đang dùng.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-307, `23_LICH_SU_PHIEN_BAN.md` 0.189.0.

#### Vấn đề tồn đọng

- Các phân hệ ngoài văn bản, giáo dục, tài chính, báo cáo mới có Việc cần xử lý và Lối tắt; khối số liệu riêng cần thêm khi có yêu cầu cụ thể.

### 2026-10-28 — Quy tắc tài khoản theo số CCCD và nhân viên vận hành

#### Công việc đã thực hiện

- Tên đăng nhập của tài khoản trường là số CCCD (số định danh cá nhân 12 chữ số). Dịch vụ định danh nhận `national_id` khi tạo tài khoản, hoặc nhận 12 chữ số gõ thẳng vào ô tên đăng nhập; kiểm 12 chữ số, mã tỉnh ở 3 số đầu (danh mục 63 tỉnh), năm sinh ở số thứ 4 đến 6 khi biết năm sinh; chỉ chặn khi sai rõ ràng. Phần kiểm thuần ở `packages/shared/src/national-id.ts` dùng chung cho dịch vụ định danh và máy chủ API.
- Tài khoản tạo theo số CCCD nhận mật khẩu mặc định từ biến môi trường `DEFAULT_INITIAL_PASSWORD` (chỉ ở `.env` của máy chủ, kho mã không có giá trị), phải đổi ở lần đăng nhập đầu; quá `initial_password_lifetime_days` ngày (mặc định 7, cấu hình từ 1 đến 90) mà chưa đổi thì không đăng nhập được, quản trị trường đặt lại. Cột mới `users.initial_password_expires_at`. Chưa đặt biến thì tài khoản mới nhận mật khẩu tạm ngẫu nhiên như trước, vẫn có hạn.
- Phân biệt loại tài khoản theo ứng dụng đang đăng nhập: cán bộ, giáo viên vào cổng quản trị và ứng dụng giáo viên; phụ huynh vào ứng dụng phụ huynh; học sinh chỉ vào ứng dụng học sinh. Một số CCCD vừa là giáo viên vừa là phụ huynh là một tài khoản có hai loại, mỗi ứng dụng mở phiên đúng loại; (số CCCD, loại) vì vậy là duy nhất. Sai loại thì báo như sai mật khẩu để không lộ tên đăng nhập thuộc loại nào.
- Hàng loạt: (a) "Tạo tài khoản cho nhân sự" (1.4 Danh sách người dùng, đồng bộ từ hồ sơ nhân sự) dùng số CCCD trong hồ sơ làm tên đăng nhập, hồ sơ chưa có số hợp lệ thì dùng mã nhân sự như trước; (b) "Khởi tạo" tài khoản học và thi dùng số định danh của học sinh, thiếu, sai hoặc lệch năm sinh thì dùng phương án dự phòng "hs" kèm mã Bộ GD&ĐT (CSDL ngành), rồi "hs" kèm số thứ tự; `STUDENT_USERNAME_RULE=ma_hoc_sinh` bỏ qua số định danh.
- Che số CCCD: danh sách tài khoản, danh sách tài khoản học và thi, kết quả tạo hàng loạt, nhật ký tài khoản, nhật ký thay đổi của hồ sơ nhân sự và sự kiện bảo mật (`security_events.login_identifier`) chỉ ghi `********` kèm 4 số cuối. Chi tiết tài khoản và tệp mật khẩu vừa cấp cho học sinh vẫn ghi đủ để trao tài khoản.
- Băm mật khẩu: tham số argon2id tường minh m=64 MiB, t=3, p=4 (khuyến nghị thứ hai của RFC 9106; đo trên máy phát triển khoảng 75 ms mỗi lần, mục tiêu dưới 250 ms), hạ được bằng `PASSWORD_HASH_MEMORY_KIB`, `PASSWORD_HASH_TIME_COST`, `PASSWORD_HASH_PARALLELISM` nhưng không thấp hơn mức tối thiểu OWASP (m=19 MiB, t=2). Đăng nhập đúng với giá trị băm tham số cũ thì băm lại: tài khoản trường, nhân viên vận hành nền tảng, tài khoản đơn vị cấp trên. Băm song song khi cấp tài khoản học sinh hàng loạt giảm từ 16 xuống 4 để giới hạn bộ nhớ.
- Nhân viên vận hành của công ty: thêm vai trò `platform_operators.role` (quản trị, hỗ trợ, kỹ thuật, kế toán; tài khoản đã có là quản trị). Trang "Nhân viên vận hành" ở cổng nền tảng (chỉ quản trị thấy): tạo nhân viên (đăng ký luôn xác thực hai lớp; mật khẩu tạm, khóa TOTP, mã khôi phục hiện một lần), đổi vai trò, khóa, mở khóa, cấp lại khóa hai lớp; tạo và cấp lại khóa phải nhập mã hai lớp của người thao tác. Tên đăng nhập là số CCCD, đổi sang thư điện tử công ty bằng `PLATFORM_OPERATOR_LOGIN_RULE=email`. Kế toán không mở được phiên hỗ trợ; chỉ quản trị sửa chính sách hỗ trợ. Nhân viên chỉ vào dữ liệu trường qua phiên hỗ trợ trường cấp (`support_access_grants`, `support-sessions`), không có tài khoản ở trường.
- Kiểm thử: `apps/identity/src/accounts/national-id-accounts.test.ts` CT-1511 đến CT-1518; `apps/api/src/student-records/student-records-so.test.ts` CT-1519; `apps/identity/src/platform/platform-operator-admin.test.ts` CT-1521; e2e `tests/e2e/221-tai-khoan-cccd.spec.ts` CT-1520 (lượt e2e dùng mật khẩu mặc định thử `E2E_DEFAULT_INITIAL_PASSWORD`).

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: một người có một tài khoản ở trường (khóa là số CCCD), loại tài khoản suy từ vai trò và kênh đăng nhập, không tách thành nhiều bản ghi người dùng; giữ cách gán vai trò phụ huynh vào tài khoản sẵn có của giáo viên (YCTD-44, YCTD-45), tránh hai mật khẩu cho cùng một người.
- Tài khoản quản trị tổng `Admin` (YCTD-310, đọc từ `PLATFORM_SUPERADMIN_*`) là tài khoản vận hành nền tảng, không thuộc trường nào: quy tắc số CCCD và hạn mật khẩu mặc định không áp dụng (cột hạn trống, tên đăng nhập không phải 12 chữ số). Tài khoản trường đã có (tên đăng nhập tự do, số điện thoại) giữ nguyên; quy tắc áp cho tài khoản tạo mới bằng số CCCD.
- Tên đăng nhập lưu số CCCD dạng rõ ở dịch vụ định danh vì là định danh đăng nhập (như số điện thoại hiện nay) và máy chủ API đã lưu số CCCD mã hóa kèm giá trị băm có khóa ở hồ sơ. Chưa đổi sang so khớp bằng giá trị băm có khóa ở dịch vụ định danh: mất khóa là mọi người không đăng nhập được, cần quy trình xoay khóa riêng; ghi thành đề xuất.
- Pepper (khóa bí mật trộn vào băm mật khẩu) chưa làm: thư viện có tham số `secret` nhưng giá trị băm cũ không có pepper, cần đánh dấu phiên bản băm trong chuỗi và chuyển dần khi đăng nhập, cộng quy trình giữ và xoay khóa. Đề xuất làm thành phần riêng sau khi có kho bí mật của máy chủ chạy thật.
- Mật khẩu mặc định Eric đưa chỉ đặt ở `.env` cục bộ (đã nằm trong `.gitignore`), không có trong mã, dữ liệu mẫu, e2e hay tài liệu. Máy chủ chạy thật đặt qua biến môi trường. Biến sai chính sách (dưới 8 ký tự, thiếu chữ hoặc số) thì dịch vụ định danh không khởi động.

#### Đánh giá dùng số CCCD theo Nghị định 13/2023/NĐ-CP và Luật Bảo vệ dữ liệu cá nhân 2025

- Số CCCD (số định danh cá nhân) là dữ liệu cá nhân cơ bản (khoản 3 Điều 2 Nghị định 13/2023/NĐ-CP), không phải dữ liệu nhạy cảm; Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực từ 01/01/2026) giữ cách phân loại này. Trường xử lý để định danh người dùng của hệ thống quản lý trường học theo nhiệm vụ của cơ sở giáo dục; nhà trường là bên kiểm soát dữ liệu, nhà cung cấp phần mềm là bên xử lý theo hợp đồng.
- Nguyên tắc tối thiểu và mục đích: chỉ dùng số CCCD làm tên đăng nhập, không hiện trên danh sách, nhật ký, không đưa vào đường dẫn khi tạo tài khoản; lưu mã hóa ở hồ sơ (máy chủ API), dạng rõ ở cột tên đăng nhập của dịch vụ định danh có phân quyền cơ sở dữ liệu riêng.
- Rủi ro của mật khẩu mặc định chung (bổ sung theo YCTD-323): một giá trị dùng cho mọi tài khoản tạo theo số CCCD ở mọi trường, ai từng nhận tài khoản cũng biết; số CCCD không phải bí mật. Người biết cả hai có thể đăng nhập trước chủ tài khoản trong thời hạn của mật khẩu mặc định. Eric quyết định ngày 2026-10-28 giữ mật khẩu mặc định chung, kèm các biện pháp của YCTD-323: (a) đổi mật khẩu mặc định lần đầu phải nhập mã gửi tới số điện thoại trong hồ sơ; (b) tài khoản không có số điện thoại nhận mật khẩu tạm ngẫu nhiên, không nhận mật khẩu mặc định; (c) tài khoản quản trị trường bắt buộc có số điện thoại (YCTD-314); (d) thời hạn mật khẩu mặc định rút xuống 24 giờ, cấu hình `initial_password_lifetime_hours` từ 1 đến 720 giờ. Rủi ro còn lại: người giữ được điện thoại của chủ tài khoản.
- Còn phải làm khi triển khai thật: (a) văn bản thông báo xử lý dữ liệu cá nhân của trường nêu việc dùng số CCCD làm tên đăng nhập; (b) bộ lọc "Tên đăng nhập" của danh sách người dùng đang gửi qua tham số đường dẫn, khi tìm theo số CCCD thì nên chuyển sang thân yêu cầu (đề xuất); (c) đánh giá tác động xử lý dữ liệu cá nhân của nhà trường cập nhật mục số CCCD; (d) trẻ dưới 16 tuổi (học sinh): số định danh của trẻ do cha mẹ hoặc người giám hộ cung cấp khi nhập học, cần có trong nội dung đồng ý của hồ sơ nhập học.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-311, `23_LICH_SU_PHIEN_BAN.md` 0.188.0.

#### Vấn đề tồn đọng

- Màn hình tạo tài khoản ở cổng quản trị chưa có ô "Số CCCD" riêng (gõ 12 chữ số vào ô Tên đăng nhập là đủ); màn hình cấu hình chưa có ô sửa số ngày hạn mật khẩu mặc định (đặt qua `PUT /auth/settings`).
- Nhân viên vận hành chưa có màn hình tự đổi mật khẩu tạm ở cổng nền tảng; phân vai mới chặn ở quản lý nhân viên và phiên hỗ trợ, các trang khác (gói, thu phí, trường) còn mở cho mọi vai trò. Đã làm ở YCTD-323.
- Đề xuất: so khớp tên đăng nhập bằng giá trị băm có khóa; pepper cho băm mật khẩu; chuyển bộ lọc tên đăng nhập sang thân yêu cầu.

### 2026-10-28 — Mã xác nhận ở đăng nhập cổng vận hành nền tảng

#### Công việc đã thực hiện

- Dịch vụ định danh: thêm `POST /api/v1/auth/platform/captcha` (chỉ ở tên miền cổng nền tảng, giới hạn 30 ảnh mỗi địa chỉ mỗi phút); `POST /api/v1/auth/platform/login` nhận `captcha_id`, `captcha_text` và kiểm trước mật khẩu.
- Cùng cơ chế với đăng nhập cổng quản trị (PR 233, YCTD-310): dùng lại hàm sinh ảnh và đáp án lưu Redis 5 phút, dùng một lần; trang luôn hiện ô mã; có gửi mã thì phải đúng; không gửi mã chỉ được khi tên đăng nhập nhập sai chưa tới 3 lần trong 15 phút. Khóa Redis ở nhóm "platform" vì cổng không thuộc trường nào.
- Bước nhập mã xác thực hai lớp không phải giải ảnh lần nữa: bước 1 đúng mã ảnh và đúng mật khẩu thì máy chủ cấp "lượt đã qua" gắn với mã ảnh và tên đăng nhập trong 5 phút, bước 2 gửi lại mã ảnh đó.
- Cổng vận hành: ô "nhập mã xác nhận", ảnh mã và nút "Làm mới mã" cùng một hàng như mẫu; gửi lỗi thì lấy ảnh mới; sai mã hai lớp thì quay lại bước 1 với ảnh mới.
- Kiểm thử: kiểm thử đơn vị đăng nhập vận hành (gửi sai mã bị từ chối, sai mật khẩu ba lần thì bắt buộc mã, bước mã hai lớp dùng lượt đã qua); e2e `signInConsole` đọc đáp án ở Redis (`readPlatformCaptchaAnswerForTesting`), CT-26e-3 giả lập điểm cuối mã xác nhận.

#### Quyết định

- Không thêm đường vượt mã xác nhận bằng biến môi trường: kiểm thử đọc đáp án ở Redis như PR 233; các kiểm thử gọi thẳng API đăng nhập đúng mật khẩu không cần mã vì chưa tới ngưỡng nhập sai. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-313, `23_LICH_SU_PHIEN_BAN.md` 0.187.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-28 — Giao diện đăng nhập cổng vận hành nền tảng theo mẫu đăng nhập mới

#### Công việc đã thực hiện

- Làm lại trang đăng nhập của cổng vận hành nền tảng (`apps/platform`) cùng phong cách mẫu đăng nhập Eric duyệt cho trường: thẻ trắng bo góc giữa nền xanh nhạt có chấm, tiêu đề "Đăng nhập hệ thống", dòng phụ "Cổng vận hành nền tảng", mục "Thông tin tài khoản" chữ hoa xanh có vạch dọc, ô nhập bo góc, nút xanh đậm toàn chiều rộng, hàng "Ghi nhớ" và "Quên Mật Khẩu?". Không có mục thông tin đơn vị.
- Đăng nhập hai bước: tên đăng nhập, mật khẩu; máy chủ trả lỗi đòi mã xác thực hai lớp (`details[].field = otp_code`) thì sang bước "Xác thực hai lớp" nhập mã TOTP hoặc mã khôi phục, có "Quay lại".
- "Ghi nhớ" chỉ lưu tên đăng nhập trên trình duyệt; mật khẩu để trình duyệt tự lưu qua `autocomplete`. "Quên Mật Khẩu?" mở lời dặn liên hệ quản trị viên nền tảng.
- Màu theo token của `packages/ui/src/theme.css`, chữ đạt tương phản 4,5:1; ô nhập 16 px, vùng chạm từ 44 px; thẻ co theo khổ điện thoại.
- Kiểm thử e2e: thêm `tests/e2e/platform-console.ts` (`signInConsole` đăng nhập hai bước) dùng ở các kịch bản 132, 136, 137, 139, 160, 195, 196, 197; CT-26e-3 kiểm tiêu đề mới, Quên mật khẩu, Ghi nhớ và bước mã hai lớp với máy chủ giả lập.

#### Quyết định

- Cổng nền tảng chưa dùng Tailwind và `packages/ui`; giữ CSS thuần của ứng dụng, khai báo biến màu theo đúng giá trị token chung thay vì thêm cấu hình web, vì các phiên khác đang sửa cấu hình web. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Ô mã xác nhận dạng ảnh chưa đặt: dịch vụ định danh chưa có mã xác nhận cho đăng nhập tài khoản vận hành và phiên này không sửa định danh; chỗ đặt ghi trong mã nguồn.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-312, `23_LICH_SU_PHIEN_BAN.md` 0.186.0.

#### Vấn đề tồn đọng

- Thêm ô mã xác nhận khi dịch vụ định danh hỗ trợ mã xác nhận cho đăng nhập tài khoản vận hành.

### 2026-10-28 — Trang đăng nhập theo mẫu và bản nhiều trường trên máy

#### Công việc đã thực hiện

- Thiết kế lại trang đăng nhập cổng quản trị theo ảnh mẫu của Eric: một thẻ trắng giữa nền xanh nhạt có chấm, tiêu đề "Đăng nhập hệ thống", mục THÔNG TIN ĐƠN VỊ (Sở Giáo dục và Đào tạo; Cấp và Phường / Xã cùng hàng, điện thoại xếp dọc; Trường), mục THÔNG TIN TÀI KHOẢN (Tên đăng nhập, Mật khẩu, hàng mã xác nhận có ảnh và nút làm mới dạng biểu tượng), Ghi nhớ, Quên Mật Khẩu?, nút Đăng nhập toàn chiều rộng. Bỏ cột thương hiệu bên trái; tên hệ thống, biểu trưng của trường (nếu có) đặt nhỏ phía trên thẻ.
- Tên miền chung: chọn Sở rồi Cấp (bắt buộc), Phường / Xã chỉ để lọc (có "Tất cả phường, xã" để bỏ lọc), danh sách Trường lọc theo Sở, Cấp và Phường nếu chọn; ô Cấp chỉ hiện cấp có trường trong sở (và phường nếu chọn) nhờ điểm cuối `GET /api/v1/auth/directory/levels` nhận thêm `department`, `commune`. Hàng mã xác nhận luôn hiện, ảnh của đúng trường hiện khi đã chọn trường. Tên miền của trường và chế độ một trường: mục THÔNG TIN ĐƠN VỊ chỉ đọc (tên Sở, trường, cấp, mã, năm học).
- Ghi nhớ: (a) nhớ đơn vị đã chọn (Sở, Cấp, Phường, Trường) và tên đăng nhập ở máy; (b) máy chủ định danh nhận `remember` khi đăng nhập (cả đăng nhập theo đơn vị): phiên cổng quản trị kéo dài `PORTAL_REMEMBER_DAYS` ngày (mặc định 30, từ 1 đến 90), cookie mã làm mới bền; không tích thì hạn 8 giờ như cũ và cookie là cookie phiên, hết khi đóng trình duyệt; (c) biểu mẫu thật có `autocomplete="username"`, `autocomplete="current-password"` để trình quản lý mật khẩu của trình duyệt đề nghị lưu. Trang không bao giờ tự lưu mật khẩu (localStorage, sessionStorage, cookie, IndexedDB).
- Lệnh `pnpm --filter @school-management/database nhieu-truong-cuc-bo` dựng bản nhiều trường trên máy song song bản một trường: vai trò, cơ sở dữ liệu nền tảng riêng, khoá gốc và mật khẩu sinh mới chỉ ghi vào tệp môi trường đã nằm trong `.gitignore`, nạp danh mục từ CSV theo tham số, nhận trường demo hiện có (adopt-existing, dùng lại cơ sở dữ liệu cũ), gắn trường demo vào danh mục. Lệnh dựng cũng tạo cơ sở dữ liệu chợ gia sư, khóa của chợ và bật chợ ở `cho-gia-su.truong.localhost`, ứng dụng Gia sư ở `gia-su.truong.localhost` (thu tiền thật luôn tắt). Tập lệnh `scripts/chay-nhieu-truong.mjs` chạy đủ bản nhiều trường bằng một lệnh: định danh 3101, API 3100, tiến trình nền, cổng quản trị 5190, cổng vận hành 5191, ứng dụng giáo viên 5192, phụ huynh 5193, học sinh 5194, chợ gia sư 5195, ứng dụng Gia sư 5196, tất cả ở tên miền `*.localhost`.
- Quản trị vào mọi trường trên bản nhiều trường: một tài khoản vận hành nền tảng (cơ chế DT-24, chính sách `any_school`) đăng nhập ở cổng nền tảng rồi mở phiên quản trị sang trường bất kỳ; cổng nền tảng tạo liên kết `http` ở cổng của cổng quản trị khi đặt `VITE_SCHOOL_PORTAL_PORT` (máy phát triển).
- `.gitignore` bỏ qua `.env.*` (trừ `.env.example`). Hướng dẫn ở tài liệu 32 mục 16.10 và README.

#### Quyết định

- Danh mục của DT-24 đã phân cấp Sở → Phường/Xã (mã xã 5 chữ số, không có cấp huyện): không đổi cấu trúc dữ liệu.
- Thứ tự ô theo ảnh mẫu Eric gửi sau (Cấp và Phường / Xã cùng hàng, phường không bắt buộc), thay thứ tự Sở → Phường → Cấp của yêu cầu đầu.
- Ô Tên đăng nhập, Mật khẩu, Mã xác nhận dùng chữ gợi ý như mẫu; nhãn "Số điện thoại hoặc tên đăng nhập", "Mật khẩu", "Mã xác nhận" vẫn có cho trình đọc màn hình (ngoại lệ TD-02 của riêng trang đăng nhập; chữ gợi ý màu chữ phụ, tương phản trên 4.5:1). Ô Ghi nhớ, nút làm mới mã giữ tên "Ghi nhớ tài khoản", "Làm mới mã" cho trình đọc màn hình.
- Chế độ một trường giữ cách hiện mã xác nhận đã có (theo cấu hình hoặc sau lần nhập sai đầu tiên, máy chủ bắt buộc sau số lần sai cấu hình); không thêm đường vượt mã xác nhận: e2e đọc đáp án ở kho tạm như trước.
- Không tích Ghi nhớ thì cookie mã làm mới của cổng quản trị là cookie phiên (trước đây bền 8 giờ); phiên vẫn hết hạn sau 8 giờ ở máy chủ. Máy chủ nhận ra phiên đã ghi nhớ khi làm mới bằng độ dài phiên (dài hơn 8 giờ), không thêm cột.
- Trường demo nhận vào nền tảng bằng adopt-existing, không chép dữ liệu; mã nền tảng `tc-demo` (mã nền tảng cần 3 đến 32 ký tự chữ thường), tên miền `tc.truong.localhost`; đơn vị danh mục giả `DEMO-TC` nguồn `demo-local`. Eric dừng bản một trường ngày 2026-10-28 nên việc nền chạy theo giờ bật mặc định ở bản nhiều trường; chạy lại bản một trường trên cùng cơ sở dữ liệu thì dựng với `--tat-viec-nen`.
- Quản trị vào mọi trường là một tài khoản vận hành nền tảng duy nhất tên `Admin` (không phân biệt hoa thường), mật khẩu ngẫu nhiên từ 12 ký tự theo chính sách tài khoản vận hành, xác thực hai lớp bắt buộc; mật khẩu, khóa chỉ ở `.env.nhieu-truong`, không ở kho. Cổng vận hành chỉ dùng ở bản nhiều trường (5191); cổng 5177 của bản một trường không có nền tảng.
- Ứng dụng giáo viên, phụ huynh chưa có đăng nhập theo đơn vị nên không đổi.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-310, `23_LICH_SU_PHIEN_BAN.md` 0.185.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 16.10.

#### Vấn đề tồn đọng

- Đăng nhập theo đơn vị cho ứng dụng giáo viên, phụ huynh (khi cần) là phần việc riêng.

### 2026-10-28 — Hồ sơ cán bộ, giáo viên mở ở trang riêng chia thẻ

#### Công việc đã thực hiện

- Thêm trang `/staff/$staffId` (`apps/portal/src/staff/StaffDetailPage.tsx`, đổi tên từ `StaffDetailPanel.tsx`). Đầu trang có nút quay lại danh sách, họ tên, trạng thái, dòng chức danh · phòng ban · đơn vị và mã nhân sự.
- Các thẻ: Thông tin chung (thông tin riêng của trường, tài khoản liên kết), Hồ sơ CSDL Bộ (hồ sơ cán bộ, giáo viên theo Sở, thông tin theo CSDL ngành), Hợp đồng (hợp đồng lao động, lương thỏa thuận), Lương và phụ cấp (khoản lương riêng, người phụ thuộc), Quá trình công tác (mốc công tác, chứng chỉ).
- Thẻ đang mở lưu ở `?tab=` (`moet`, `contracts`, `pay`, `history`; thẻ Thông tin chung không ghi), tải lại hay chia sẻ đường dẫn vẫn mở đúng thẻ. Thẻ ngang cuộn được trên màn hình hẹp, phím mũi tên chuyển thẻ.
- Danh sách 3.1.1 bỏ khung hồ sơ dưới dòng, lưới dùng toàn chiều rộng. Bấm dòng, nút "Thay đổi" hay liên kết "Hồ sơ" mở trang hồ sơ; tạo hồ sơ mới xong thì mở trang hồ sơ vừa tạo. Quyền, thao tác ghi, xóa, xuất giữ nguyên.
- 5.9 Thống kê hồ sơ nhân sự chưa nhập đủ: bấm tên mở trang hồ sơ ở thẻ Hồ sơ CSDL Bộ thay cho khung bên dưới lưới.
- Sửa kiểm thử giao diện 19, 55, 60 theo trang mới; thêm bước kiểm tra địa chỉ có `?tab=`, tải lại trang vẫn ở thẻ Hợp đồng, người không xem được hợp đồng không thấy thẻ Hợp đồng.

#### Quyết định

- Thẻ Hợp đồng chỉ hiện khi máy chủ trả danh sách hợp đồng (BR-46); thẻ Lương và phụ cấp, Quá trình công tác ẩn khi máy chủ từ chối quyền xem (dùng cùng truy vấn với phần bên trong).
- Chưa có thẻ Phân công giảng dạy: máy chủ chưa có API phân công theo một nhân sự (chỉ có theo lớp và tổng số tiết theo giáo viên).
- Thẻ đang mở chỉ dựng nội dung của thẻ đó, các thẻ khác tải khi mở.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-309, `23_LICH_SU_PHIEN_BAN.md` 0.184.0.

#### Vấn đề tồn đọng

- Chưa làm: thẻ Phân công giảng dạy (lớp, môn, số tiết của một giáo viên) ở trang hồ sơ cán bộ, giáo viên. Làm khi máy chủ có API trả phân công giảng dạy theo một nhân sự; hiện chỉ có phân công theo lớp (`/api/v1/teaching-assignments?class_id=`) và tổng số tiết theo giáo viên (`/api/v1/teaching-assignments/teachers`).

### 2026-10-28 — DT-27 phần 27i: an toàn trẻ em và kiểm duyệt ở chợ

#### Công việc đã thực hiện

- Đọc mục 19.2 (ghi hình, báo cáo vi phạm), 19.5 (27i), 19.6, 20.5 (lọc thông tin liên lạc của 28e) của `32_KE_HOACH_THEO_HE_THONG_SO.md`. Phiên điều phối giao ngày 2026-10-28 sau 27h (PR 229): báo cáo vi phạm, tạm khóa gia sư, lọc thông tin liên lạc (dùng lại hàm thuần `scanContactInfo` của 28e trong `packages/shared`), ghi hình bắt buộc với buổi có trẻ vị thành niên theo 19.2, quyền xem bản ghi; giao diện ở `apps/tutor`, `apps/market` và cổng nền tảng.
- Văn bản pháp lý: Luật 91/2025/QH15 Điều 24 (dữ liệu trẻ em) đã đọc toàn văn ở S8a ngày 2026-10-25 (19.2); Nghị định 356/2025 Điều 21 khoản 5 (phần mềm giáo dục có ghi hình) theo 19.2. Luật Trẻ em 102/2016 và căn cứ của Tổng đài 111 **chưa đọc lại bản gốc trong phiên này** (19.2 ghi chưa xác minh số điều); sản phẩm chỉ hướng dẫn gọi 111 và 113, không trích điều luật.
- Marketplace `0030`: `market_message_threads`, `market_messages`, `market_reports`, `market_tutor_suspensions`, `market_moderation_log`, `market_session_recordings`, `market_recording_views`, `market_evidence_exports`; thêm `recording_required`, `recording_consented` vào `market_bookings`; kiểu bảng ở `database/marketplace/schema-parts/dt-27i-an-toan-tre-em.ts`.
- Máy chủ API (đăng ký ở `src/dang-ky/dt-27i-an-toan-tre-em.ts`):
  - `market-safety-rules.ts`: hàm thuần (hạn xử lý theo mức, mức tối thiểu của an toàn trẻ em, tạm khóa ngay, trẻ vị thành niên theo năm sinh, hạn giữ bản ghi, giờ mở phòng, lọc tin nhắn, điều kiện "gia sư không bị tạm khóa");
  - `market-safety.ts`: tin nhắn, báo cáo vi phạm, kháng nghị, tạm khóa và gỡ khóa, phòng học có ghi hình qua bộ nối video của 27a, xem bản ghi, xóa bản ghi hết hạn, hàng chờ kiểm duyệt, xuất hồ sơ;
  - `market-bookings.ts` (27h): đặt buổi với trẻ vị thành niên phải đồng ý ghi hình; gia sư đang tạm khóa không đặt được; hủy buổi sắp tới khi tạm khóa (hoàn đủ); không giải ngân trong lúc tạm khóa; `market-public.ts`: ẩn gia sư đang tạm khóa.
- `packages/market-client`: `SafetyWidgets.tsx` (tin nhắn, báo cáo vi phạm, phát bản ghi, chính sách an toàn trẻ em), `marketBlob`.
- Giao diện: Chợ gia sư (đồng ý ghi hình khi đặt; Nhắn tin, Báo cáo hồ sơ ở trang gia sư; Vào phòng học, Xem bản ghi, Báo cáo vi phạm ở buổi học; Tin nhắn; Chính sách an toàn trẻ em); ứng dụng Gia sư (Kiểm duyệt và an toàn, Mở và kết thúc phòng học, Xem bản ghi, Báo cáo phụ huynh, Tin nhắn, Chính sách); cổng nền tảng (Kiểm duyệt và an toàn trẻ em: chỉ số, hàng chờ, bằng chứng, quyết định, tạm khóa ngay, xuất hồ sơ, xem bản ghi).
- Sửa cổng phát triển trùng (phiên điều phối phát hiện khi chạy toàn hệ thống): `apps/tutor` và `apps/student` cùng đặt `server.port: 5179` vì PR 223 và PR 224 gộp song song; đổi `apps/tutor` sang **5181** (5180 dành cho portal chạy nhanh). Đã rà: e2e dùng cổng riêng 5388 (không đổi), máy chủ API và dịch vụ định danh không có danh sách CORS hay origin theo cổng (giao diện gọi cùng tên miền qua proxy), `apps/mobile` chỉ chuyển cổng 5174, 5175, 5179 (không có ứng dụng Gia sư); cập nhật `README.md` và bảng cổng ở `34_TONG_HOP_CHUC_NANG_HE_THONG/01_TONG_QUAN_VA_NEN_TANG.md` (thêm dòng Chợ gia sư, Ứng dụng Gia sư). Mảnh YCTD-262 còn ghi 5179 là lịch sử, không sửa.
- Kiểm thử: CT-27i-1 (`market-safety-rules.test.ts`), CT-27i-2 đến CT-27i-5 (`market-safety.test.ts`), CT-27i-6 (e2e `198-market-safety.spec.ts`); sửa `market-bookings.test.ts` và e2e 197 cho đồng ý ghi hình.

#### Quyết định

- Tin nhắn chỉ có luồng phụ huynh với gia sư, phụ huynh mở luồng; trẻ không có tài khoản ở chợ nên không có luồng gia sư với trẻ. Chữ đã che lưu ở `body`; chữ gốc chỉ lưu khi có che, chỉ nhân viên kiểm duyệt xem (bằng chứng). Lần thứ 3 trong một luồng một người gửi thông tin liên lạc ngoài thì gắn cờ luồng và tự tạo báo cáo né hoa hồng (mức trung bình).
- Báo cáo vi phạm: năm loại (an toàn trẻ em, quấy rối, gian lận, né hoa hồng, nội dung sai), bốn mức; hạn xử lý nghiêm trọng 4 giờ, cao 24 giờ, trung bình 3 ngày, thấp 7 ngày; an toàn trẻ em không thấp hơn mức cao. Gia sư chỉ báo phụ huynh đã có buổi hoặc tin nhắn với mình.
- Mức nghiêm trọng tạm khóa gia sư ngay, không chờ nhân viên: ẩn khỏi chợ, không đặt buổi, không nhắn tin, không mở phòng, hủy buổi sắp tới (hoàn đủ như gia sư hủy), giữ tiền chưa giải ngân, báo phụ huynh đã có buổi với gia sư (kèm 111, 113). Tạm khóa là dòng riêng, không khóa tài khoản, để gia sư đăng nhập xem và kháng nghị.
- Quyết định: tạm khóa, cảnh cáo, bác; bắt buộc có lý do; cảnh cáo hoặc bác thì gỡ khóa đang có. Một lần kháng nghị trong 7 ngày (gia sư kháng nghị tạm khóa, cảnh cáo; người báo kháng nghị bác), nhân viên khác người quyết định lần đầu xét. Mọi bước ghi nhật ký kiểm duyệt.
- Ghi hình (19.2): mọi buổi có trẻ dưới 18 tuổi (theo năm sinh, năm tròn 18 vẫn tính) phải ghi; phụ huynh đồng ý khi đặt, không đồng ý thì không đặt được. Phòng chỉ mở khi bắt đầu ghi được (có bộ nối video, kho tệp, khóa mã hóa của chợ); phụ huynh chỉ vào phòng khi đang ghi. Bản ghi mã hóa AES-256-GCM bằng `MARKET_FILES_KEY`, giữ 30 ngày, giữ tiếp khi buổi đang tranh chấp, có báo cáo chưa chốt (trừ đã bác) về một trong hai bên, hoặc gia sư đang tạm khóa. Chỉ phụ huynh, gia sư của buổi, nhân viên nền tảng xem; phát `inline`, `no-store`, giao diện không có nút tải; mỗi lượt xem ghi nhật ký.
- Xuất hồ sơ cho cơ quan có thẩm quyền phải ghi cơ quan và số văn bản yêu cầu, có nhật ký; tệp xuất gồm báo cáo, tin nhắn gốc, buổi học, siêu dữ liệu bản ghi; bàn giao bản ghi theo thủ tục riêng (E-08).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-259, `23_LICH_SU_PHIEN_BAN.md` 0.183.0; BR-444 đến BR-447, PQ-191, P02-136, AC-1106 đến AC-1110, MH-543 đến MH-545, CT-1407 đến CT-1412, QĐ-49.

#### Vấn đề tồn đọng

- Chưa làm: giao diện phòng video trong ứng dụng Chợ gia sư và Gia sư (máy chủ đã cấp mã vào phòng, bộ nối của 27a), điểm danh tự động từ sự kiện vào ra; nhận sự kiện kết thúc ghi của LiveKit cho phòng của chợ (bộ giả lập trả tệp ngay; LiveKit thật để bản ghi ở trạng thái `processing`); mã hóa tệp do LiveKit Egress ghi thẳng vào kho (hiện dựa vào mã hóa của kho); danh sách từ ngữ cấm của chợ; trẻ đọc tin nhắn khi phụ huynh cho; báo cáo từ đánh giá (chưa có đánh giá sau buổi); văn bản PL-19 đầy đủ (luật sư của Eric rà, E-08); thủ tục chuyển cơ quan có thẩm quyền.
- Đọc lại bản gốc Luật Trẻ em 102/2016 và căn cứ Tổng đài 111 trước khi mở chợ.

### 2026-10-28 — DT-27 phần 27h: đặt buổi, thanh toán, tranh chấp

#### Công việc đã thực hiện

- Đọc mục 19.3 (tiền đi theo mô hình), 19.5 (27h), GD-133, GD-134 của `32_KE_HOACH_THEO_HE_THONG_SO.md`. Quyết định của Eric ngày 2026-10-28: làm mã, tiền giả lập; không bật tiền thật trước khi xong E-01 đến E-07. Giao diện phụ huynh ở `apps/market`, gia sư ở `apps/tutor`.
- Marketplace `0020`: `market_bookings`, `market_payments`, `market_payment_events`, `market_disputes`, `market_dispute_statements`, `market_commission_rules`; kiểu bảng ở `database/marketplace/schema-parts/dt-27h-dat-buoi-thanh-toan.ts`.
- Máy chủ API (đăng ký ở `src/dang-ky/dt-27h-dat-buoi-thanh-toan.ts`):
  - `market-payment-provider.ts`: lớp `MarketplacePaymentProvider` (tạo lệnh thu có giữ, giải ngân chia hoa hồng, hoàn, giữ khi tranh chấp, kiểm sự kiện có chữ ký) và bộ giả lập `MockMarketplacePaymentProvider`;
  - `market-booking-rules.ts`: hàm thuần (chọn quy tắc hoa hồng, tính hoa hồng, hoàn khi hủy theo GD-134, chia tiền, giờ Việt Nam, giờ trống, trùng giờ, điều kiện nội dung theo Thông tư 29/2024);
  - `market-bookings.ts`: đặt buổi, thanh toán giả lập, nhận sự kiện của nhà cung cấp, hủy, gia sư đánh dấu đã dạy, tranh chấp, trình bày, khiếu nại lại, việc định kỳ (nhả chỗ, giải ngân, chốt quyết định);
  - `market-payments-admin.ts`: thanh toán, tranh chấp, quy tắc hoa hồng, chạy ngay việc định kỳ ở cổng nền tảng.
- `market-tutor-rules.ts` (27g): hồ sơ gia sư không có môn `curriculum` cho cấp Tiểu học; trang công khai trả mã môn để đặt buổi.
- Giao diện: Chợ gia sư (Đặt buổi ở trang gia sư, Buổi học của con: thanh toán giả lập, hủy, tranh chấp, trình bày, khiếu nại lại); ứng dụng Gia sư (Buổi dạy và thu nhập); cổng nền tảng (Buổi học và thanh toán: tranh chấp, quyết định, chốt, quy tắc hoa hồng, chạy giải ngân).
- Kiểm thử: CT-27h-1 (`market-booking-rules.test.ts`), CT-27h-2 đến CT-27h-6 (`market-bookings.test.ts`), CT-27h-7 (e2e `197-tutor-booking.spec.ts`).

#### Quyết định

- Tiền nằm ở nhà cung cấp thanh toán, nền tảng chỉ ra lệnh (19.3); bản này chỉ có bộ giả lập `mock`, ghi sổ trong bộ nhớ, ký sự kiện HMAC-SHA256. Nhà cung cấp chuyển tiền thật bị từ chối khi cấu hình chợ chưa bật thu tiền thật (luôn tắt), kiểm ở mỗi lần đặt buổi.
- Đặt buổi lẻ trước ít nhất 2 giờ, trong 60 ngày, nằm trọn trong giờ trống của gia sư theo giờ Việt Nam, không trùng buổi khác của gia sư hoặc của con (khóa theo gia sư khi ghi); giữ chỗ 30 phút chờ trả tiền; tiền về sau khi chỗ đã nhả thì hoàn ngay.
- Hồ sơ con phải còn đồng ý của cha mẹ; cấp, lớp của con thuộc môn đã chọn; không dạy thêm môn `curriculum` cho học sinh Tiểu học (Thông tư 29/2024 khoản 1 Điều 4); gia sư đang dạy ở trường dạy môn `curriculum` thì phụ huynh cam kết con không do gia sư dạy ở trường (khoản 2 Điều 4) vì chợ chưa có phân công của trường để so khớp.
- Giá, môn, hoa hồng chụp lại lúc đặt. Quy tắc hoa hồng cụ thể nhất (theo gia sư, theo loại nội dung, chung), ngày hiệu lực gần nhất không sau ngày đặt; không có quy tắc thì theo tỷ lệ mặc định của cấu hình chợ (để trống là 0). Làm tròn đến đồng, tối thiểu, không vượt giá.
- Hủy (GD-134): phụ huynh hủy trước 24 giờ hoàn đủ, trong 24 giờ hoàn 50% (phần còn lại chia hoa hồng và gia sư), gia sư hủy hoàn đủ; từ giờ bắt đầu không hủy, chỉ mở tranh chấp.
- Gia sư đánh dấu đã dạy sau giờ kết thúc; hạn khiếu nại tính từ giờ kết thúc (GD-133); hết hạn mà không có tranh chấp thì giải ngân (trừ hoa hồng). Điểm danh bằng phòng video của 27a ở ngữ cảnh chợ chưa làm, nên giải ngân dựa vào đánh dấu của gia sư và quyền khiếu nại của phụ huynh.
- Tranh chấp: phụ huynh mở từ giờ bắt đầu đến hết hạn khiếu nại, tiền bị giữ; hai bên trình bày; nhân viên quyết định hoàn đủ, hoàn một phần hoặc giải ngân, có lý do; quyết định lần đầu chưa chuyển tiền, một bên được khiếu nại lại trong 7 ngày, do nhân viên khác xét; hết 7 ngày (hoặc nhân viên chốt) thì chuyển tiền theo quyết định.
- Việc định kỳ chạy trong máy chủ API (`MARKET_JOB_INTERVAL_SECONDS`, mặc định 300 giây); nhân viên cũng chạy ngay được ở cổng nền tảng.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-258, `23_LICH_SU_PHIEN_BAN.md` 0.182.0; BR-440 đến BR-443, PQ-190, P02-135, AC-1100 đến AC-1105, MH-540 đến MH-542, CT-1400 đến CT-1406, QĐ-48.

#### Vấn đề tồn đọng

- Chưa làm: gói nhiều buổi; phòng video của 27a ở ngữ cảnh chợ và điểm danh tự động (có bản ghi cho tranh chấp); so khớp phân công qua liên kết tài khoản trường; khấu trừ thuế (công tắc tắt, GD-138, chờ E-03) và hóa đơn hoa hồng (chờ E-09); phương án B "trả thẳng gia sư"; đánh giá sau buổi và sắp xếp theo đánh giá; báo cáo doanh thu theo gia sư.
- Nhà cung cấp thanh toán thật chờ E-02 và chỉ dùng khi xong E-01 đến E-07.

### 2026-10-28 — DT-27 phần 27g: hồ sơ, xác minh, tìm gia sư

#### Công việc đã thực hiện

- Đọc mục 19.2 (xác minh lý lịch gia sư ở chợ mở), 19.5 (27g) của `32_KE_HOACH_THEO_HE_THONG_SO.md`. Làm trên ứng dụng Gia sư `apps/tutor` (YCTD-262); phiên điều phối giao ngày 2026-10-28, ưu tiên của Eric là giao diện web.
- Bộ nối OIDC của DT-25 (`identity-provider`, `oidc-provider`, `provider-profiles` và kiểm thử) chuyển bằng `git mv` sang `packages/server/src/external-identity/` (đường nhập `@school-management/server/external-identity`) để máy chủ API dùng; dịch vụ định danh nhập từ gói, hành vi không đổi. `readProviderDefinitions` nhận tiền tố biến (`EXTERNAL_IDENTITY` mặc định, `MARKET_IDENTITY` cho chợ).
- Marketplace `0010`: thêm cột duyệt, ngôn ngữ dạy cho `market_tutor_profiles` (trạng thái thêm đã duyệt, bị từ chối); bảng `market_tutor_subjects`, `market_tutor_availability`, `market_tutor_documents`, `market_tutor_verifications`, `market_tutor_school_roles`, `market_oidc_requests`. Kiểu bảng ở `database/marketplace/schema-parts/dt-27g-xac-minh-gia-su.ts`.
- Máy chủ API (`apps/api/src/market/`, đăng ký ở `src/dang-ky/dt-27g-xac-minh-gia-su.ts`):
  - `market-identity.ts`: xác minh danh tính và đăng nhập bằng OIDC ở ứng dụng Gia sư (`/api/v1/market/identity/*`);
  - `market-listing.ts`: hồ sơ dạy, gửi duyệt, nộp giấy tờ (mã hóa AES-256-GCM bằng `MARKET_FILES_KEY`, kho chung của bản triển khai), khai giáo viên đang dạy ở trường, Mẫu 03 (`/api/v1/market/tutor/*`);
  - `market-review.ts`: hàng chờ duyệt, xem tệp có nhật ký, duyệt hoặc từ chối có lý do (`/api/v1/market/admin/reviews/*`);
  - `market-public.ts`: tìm gia sư, trang công khai theo Mẫu 02 ở Chợ gia sư (`/api/v1/market/public/tutors*`);
  - `market-tutor-rules.ts`: quy tắc thuần (kiểm hồ sơ, trạng thái xác minh có hạn, điều kiện gửi duyệt, duyệt, hiện công khai).
- `TenantFileStorage.deploymentStorage()`: kho chung của bản triển khai cho phần không thuộc trường nào (tệp của chợ không đi qua cấu hình kho riêng của trường).
- Giao diện: ứng dụng Gia sư (Xác minh, Hồ sơ dạy, Giáo viên đang dạy ở trường với báo cáo Mẫu 03 in được, đăng nhập bằng định danh, trang quay về `/xac-minh`); Chợ gia sư (Tìm gia sư, trang gia sư theo Mẫu 02); cổng nền tảng (Hàng chờ duyệt gia sư trong trang Chợ gia sư).
- Kiểm thử: CT-27g-1 (`market-tutor-rules.test.ts`), CT-27g-2 đến CT-27g-4 (`market-verification.test.ts`, nhà cung cấp OIDC giả lập), CT-27g-5 (e2e `196-tutor-verification.spec.ts`).

#### Quyết định

- Xác minh danh tính chỉ nhận nhà cung cấp khai `birthdate_claim` (chợ phải biết đủ 18 tuổi); dưới 18 tuổi hoặc không có ngày sinh thì từ chối. Chợ chỉ lưu băm của mã đối tượng, "đủ 18 tuổi", không lưu ngày sinh; một người chỉ gắn một tài khoản gia sư.
- Lượt OIDC lưu ở cơ sở dữ liệu chợ (máy chủ API không có Redis riêng của chợ), chỉ lưu băm của state, hạn 10 phút, dùng một lần; địa chỉ quay về phải là `/xac-minh` trên tên miền của ứng dụng Gia sư.
- Đăng nhập bằng OIDC chỉ cho tài khoản gia sư đã xác minh bằng đúng nhà cung cấp đó; không tự tạo tài khoản.
- Hiện công khai khi hồ sơ đã duyệt, danh tính đã xác minh, lý lịch tư pháp đã duyệt còn hiệu lực (GD-136: cấp trong 6 tháng khi nộp, hiệu lực 12 tháng từ ngày duyệt). Sửa hồ sơ đã duyệt thì về chờ duyệt, ẩn khỏi tìm kiếm.
- Môn `curriculum` cần nộp đăng ký kinh doanh trước khi gửi duyệt và cần đăng ký kinh doanh đã duyệt trước khi duyệt hồ sơ.
- Giáo viên đang dạy ở trường (Eric làm rõ ngày 2026-10-28: giáo viên dạy kèm ngoài trường dùng ứng dụng Gia sư bằng tài khoản chợ riêng): khai tên trường, công lập hay không, môn, lớp; giáo viên trường công lập không có môn `curriculum` (Thông tư 29/2024 khoản 3 Điều 4) ở cả lúc lưu hồ sơ và lúc khai; báo cáo Mẫu 03 là bản in để nộp Hiệu trưởng. Chợ không đọc dữ liệu trường.
- Trang công khai theo Mẫu 02: cơ sở đứng tên, số đăng ký kinh doanh nếu có, môn, khối lớp, thời lượng, mức thu, địa điểm (trực tuyến), hình thức, thời gian, người dạy; không có thư điện tử, số điện thoại, địa chỉ của gia sư.
- Tệp giấy tờ: nhận PDF, JPEG, PNG theo các byte đầu (không tin phần mở rộng), tối đa 10 MB; nộp lại thì thay bản cũ, xóa tệp cũ khỏi kho.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-257, `23_LICH_SU_PHIEN_BAN.md` 0.181.0; BR-430 đến BR-432, PQ-185, P02-130, AC-1090 đến AC-1094, MH-530 đến MH-533, CT-1390 đến CT-1394, QĐ-47.

#### Vấn đề tồn đọng

- Chưa làm: ảnh hồ sơ gia sư; đánh giá sau buổi và sắp xếp theo đánh giá (cần buổi đã học, 27h); liên kết tài khoản chợ với tài khoản trường để hiện nhãn "giáo viên trường X đã xác minh"; nhắc gia sư nộp lại lý lịch tư pháp trước khi hết hiệu lực.
- Nhà cung cấp định danh thật (VNeID qua tổ chức cung cấp dịch vụ xác thực) chờ E-04; bản này chỉ chạy nhà cung cấp OIDC giả lập.

### 2026-10-28 — Sửa CI nhánh chính

#### Công việc đã thực hiện

- CI trên `main` đỏ từ khoảng 2026-10-26 (37 trên 40 lần chạy gần nhất). Có ba nguyên nhân:
  - Việc `kiem-thu-thiet-bi` (hai mảnh, chỉ chạy đầy đủ trên `main` và hằng đêm) thiếu ảnh mẫu Linux của spec 180.
  - Spec 154 (CT-23e-5) hỏng chập chờn.
  - Spec 58 (CT-16a-10) đua với tiến trình xuất nền.
- Spec 180: thêm bốn ảnh mẫu `tests/e2e/180-device-frame.spec.ts-snapshots/dang-nhap-cong-quan-tri-{dien-thoai,dien-thoai-webkit,may-tinh-bang-doc,may-tinh-bang-ngang}-linux.png`. Ảnh lấy từ artifact của lần chạy CI 40626845934 trên commit 6ceff5fa. Ảnh do hai máy chạy CI độc lập (mảnh 1/2 và 2/2) sinh ra giống nhau từng byte.
- Giám thị camera:
  - Ô camera của giáo viên (`apps/portal/src/online-exams/ProctorPanel.tsx`) bỏ qua kết quả của lượt mở đã hủy.
  - Máy học sinh (`apps/student/src/proctoring.ts`) xử lý lỗi trả lời từng lời mời riêng, không để lỗi của một lời mời bỏ qua các lời mời khác trong cùng lượt hỏi.
- Spec 58 CT-16a-10: giữ khóa dòng tác vụ "Đang chờ" trong một giao dịch suốt lúc kiểm giao diện.
- CI: yêu cầu kéo gắn nhãn `thiet-bi-day-du` chạy việc `kiem-thu-thiet-bi` đầy đủ như trên `main` (hai mảnh, bốn dự án thiết bị, thêm WebKit).
  - Nhờ vậy kiểm được ca chỉ chạy trên `main` trước khi gộp.
  - Sự kiện `pull_request` mặc định không chạy lại khi gắn nhãn, nên gắn nhãn xong phải đẩy thêm một commit.

#### Quyết định

- Ảnh mẫu Linux lấy từ chính CI chứ không tách bài so ảnh khỏi lượt chạy bắt buộc:
  - CI chạy trên `ubuntu-latest` với trình duyệt cài bằng `playwright install --with-deps`, không chạy trong container Playwright. Ảnh sinh từ container có thể lệch phông chữ so với CI, còn ảnh từ chính CI khớp đúng môi trường so.
  - Hai mảnh chạy trên hai máy khác nhau cho ảnh trùng từng byte, nên kết xuất ổn định.
  - Tách bài so ảnh khỏi lượt chạy bắt buộc thì mất kiểm tra hồi quy giao diện mà YCTD-233 đặt ra.
  - Khi ảnh hệ điều hành của máy chạy CI đổi phông chữ hoặc giao diện trang đăng nhập đổi có chủ ý, tải artifact `ket-qua-kiem-thu-thiet-bi-*` của lần chạy hỏng, lấy tệp `*-actual.png` thay cho ảnh mẫu.
- Spec 154 hỏng do lỗi mã thật, không phải lỗi spec. Kiểm thử chạy cổng quản trị bằng `vite` (chế độ phát triển, có `StrictMode`) nên hiệu ứng của ô camera chạy hai lần:
  - Lượt một mở phiên xem A, lượt hai mở phiên xem B, và máy chủ đóng A khi mở B.
  - Nếu lời mời của A gửi sau khi A bị đóng, máy chủ báo "Phiên xem đã kết thúc". Lỗi này ghi đè trạng thái của ô thành "Không xem được".
  - Nếu máy học sinh thấy lời mời của A trước, lỗi khi trả lời A làm bỏ qua lời mời của B trong cùng lượt hỏi (con trỏ đã tiến), nên ô đứng mãi ở "Đang kết nối…".
  - Ngoài `StrictMode`, cùng tình huống xảy ra khi giáo viên đóng rồi mở lại ô camera nhanh.
- Spec 58: tiến trình xuất nền của máy chủ API lấy tác vụ chờ bằng `for update skip locked` và chạy ngay. Tác vụ giả không có tham số nên thành "Lỗi" trước khi trang kịp hiện "Đang chờ".
  - Spec giữ khóa dòng nên tiến trình nền bỏ qua dòng đó; điều kiện kiểm tra giữ nguyên.
  - Mã xuất nền đúng như thiết kế nên không sửa mã.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-306, `23_LICH_SU_PHIEN_BAN.md` 0.180.0.

#### Vấn đề tồn đọng

- Không có.

### 2026-10-28 — DT-28 phần 28g: giờ học trực tuyến, phòng nhóm, phòng chia nhỏ

#### Công việc đã thực hiện

- Làm phần 28g theo `32` mục 20.6, 20.7. **GD-144 Eric đã chốt 2026-10-28** ("Trường tự cấu hình"):
  - Mặc định không giới hạn giờ.
  - Mỗi trường tự đặt khung giờ mở thảo luận và phòng học nhóm; ngoài giờ chỉ đọc.
  - Đã cập nhật các chỗ của 28e còn ghi "chưa chốt" (tệp mảnh YCTD-275, chú thích mã, dòng 28e và dòng GD-144 ở 32).
- **Dùng lại 27a**, không thêm dịch vụ video:
  - Bộ nối phòng video (LiveKit, bộ giả lập khi kiểm thử), tên phòng theo trường, mã vào phòng theo vai trò.
  - Sự kiện gọi lại có chữ ký và giới hạn phút của gói. Thêm cửa `VideoRoomExtension` ở `VideoRoomsService`: sự kiện của phòng không thuộc 27a chuyển cho 28g, phút người dự của 28g cộng vào phút của gói.
- **Giờ học trực tuyến** (loại hoạt động `live_session`):
  - Giáo viên tạo ở ứng dụng giáo viên: giờ bắt đầu là `opens_at` (lịch học tập của 28e tự hiện), thời lượng 5 đến 240 phút.
  - Giáo viên mở phòng, vào làm chủ phòng; học sinh vào khi hoạt động đã giao, đang mở với em và phòng đang mở; Ban Giám hiệu, tổ trưởng vào xem.
  - Điểm danh gợi ý từ nhật ký vào ra (cả phòng chia nhỏ): có mặt khi dự từ nửa thời lượng, vào muộn hoặc ra sớm, vắng. Giáo viên xác nhận mới ghi kết quả hoạt động.
  - Không ghi hình (GD-131 của 27a giữ tắt).
- **Phòng chia nhỏ** từ phòng giờ học:
  - Chia theo bộ nhóm có sẵn hoặc ngẫu nhiên có hạt; lớp học trực tuyến gắn lớp thì lưu thành bộ nhóm `classroom`.
  - Có hạn phòng; thông báo tới mọi phòng; chuyển học sinh; học sinh "gọi giáo viên"; gọi tất cả về phòng chính.
- **Phòng nhóm** theo nhóm của bộ nhóm (28a):
  - Người lập bộ nhóm, giáo viên của lớp mở và vào bất cứ lúc nào.
  - Học sinh tự mở chỉ khi giáo viên bật cho bộ nhóm và trong giờ mở của trường.
  - Học sinh luôn thấy "Giáo viên đang xem phòng này" (GD-149).
  - Báo cáo từ phòng vào hàng chờ của 28e.
- **Giao diện:**
  - Ứng dụng giáo viên: `LiveScreen.tsx`, `LiveSessionScreen.tsx`.
  - Ứng dụng học sinh (`apps/student`, YCTD-300): `StudentLivePanel.tsx`.
  - `VideoRoom` của `packages/ui` nhận nhãn vai trò.
  - Cổng quản trị: dòng giải thích giờ mở ở 9.5 nói rõ áp dụng cho cả phòng nhóm.
- **Đăng ký theo cơ chế của YCTD-294:**
  - Kiểu bảng: `database/school-year/schema-parts/dt-28g-hoc-truc-tuyen-truc-tiep.ts`.
  - Bộ điều khiển: `apps/api/src/dang-ky/dt-28g-hoc-truc-tuyen-truc-tiep.ts`.
  - Không sửa danh sách chung.
- **Kiểm thử:**
  - 5/5 ca thuần `live-rules.test.ts`, 3/3 ca API `live.test.ts`.
  - Hồi quy `video`, `discussions`, `learning`.
  - e2e `220-live-sessions` chạy kèm spec nền 01 đến 09.

#### Quyết định

- Claude chọn theo ủy quyền (ghi ở YCTD-277):
  - Giờ mở phòng nhóm dùng chung cấu hình `discussion_open_hours` của 28e.
  - Phòng giáo viên mở không theo giờ mở; phòng học sinh tự mở thì ngoài giờ không mở, không vào được.
  - Báo cáo từ phòng gắn chủ đề hệ thống "Phòng video" (đã khoá) của nhóm hoặc của lớp học trực tuyến, để dùng nguyên hàng chờ, phạm vi xử lý của 28e.
  - "Giáo viên đang xem" theo người đang trong phòng: có khi cấp mã vào, hết khi giáo viên bấm rời phòng hoặc máy chủ video báo rời.
  - Khoá tự chọn không gắn lớp: phòng nhóm, phòng chia nhỏ theo bộ nhóm dùng các bộ nhóm do chính giáo viên lập; chia ngẫu nhiên không lưu bộ nhóm.
- Migration năm học 0187, 0188 (dải giữ sẵn); không thêm quyền.
- Mã khối riêng (BR-420, AC-1080, MH-520, CT-1380, BM-215, PQ-180, P03-65); mục mới 12Q, 18P, 17.10 đặt sau mục của 28j.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-277, `23_LICH_SU_PHIEN_BAN.md` 0.179.0; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Ghi hình giờ học của trường (GD-131) chưa làm.
- Gợi ý giờ học theo tiết của thời khoá biểu chưa làm.
- Phụ huynh chưa xem điểm danh giờ học trực tuyến riêng; kết quả hoạt động vẫn hiện như mọi hoạt động.

### 2026-10-28 — DT-27: tách ứng dụng Gia sư khỏi Chợ gia sư

#### Công việc đã thực hiện

- Quyết định của Eric ngày 2026-10-28 (qua phiên điều phối): "làm thêm ứng dụng cho gia sư". `apps/market` (27f) đang gộp khu phụ huynh và khu gia sư; tách khu gia sư thành ứng dụng riêng `apps/tutor` theo cách của `apps/teacher`, `apps/parent` (Vite, React, `packages/ui`, `packages/pwa`, PWA riêng tên "Chợ gia sư – Gia sư"). Làm trước 27g vì 27g chưa bắt đầu; 27g, 27h, 27i làm phần gia sư trên `apps/tutor`.
- `git mv` khu gia sư (`TutorArea.tsx`) sang `apps/tutor`; phần dùng chung (gọi máy chủ API của chợ, phiên của chợ, biểu mẫu đăng ký, xác nhận mã, đăng nhập, khung trang công khai và văn bản pháp lý) chuyển bằng `git mv` sang gói mới `packages/market-client` (`MarketShell`, `RegisterForm` theo vai, `LoginForm`, `VerifyForm`, `marketRequest`).
- `apps/tutor`: cổng phát triển 5179, manifest tĩnh (không theo trường), biểu tượng, service worker dùng chung với tiền tố bộ nhớ đệm `gia-su-v-`, khung cập nhật bản mới.
- Máy chủ API: cấu hình chợ thêm `tutor_host` (tên miền của ứng dụng Gia sư, bắt buộc khi bật chợ, khác tên miền của chợ); `assertMarketHost` trả vai theo tên miền; đăng ký, đăng nhập, phiên chỉ nhận tài khoản phụ huynh ở tên miền của chợ, tài khoản gia sư ở tên miền của ứng dụng Gia sư; `GET /api/v1/market/public/site` trả thêm `application`, `market_url`, `tutor_url`. Cổng nền tảng: ô tên miền của ứng dụng Gia sư.
- Triển khai: ảnh `web` dựng thêm `apps/market` (`/srv/market`), `apps/tutor` (`/srv/tutor`); ảnh máy chủ, ảnh gộp của hồ sơ thử nghiệm chép thêm `package.json` của hai ứng dụng và gói mới; hồ sơ vận hành thêm `caddy/sites.d/marketplace.caddy.example`, biến `MARKET_SITE`, `TUTOR_SITE`; cổng biên Cloudflare của hồ sơ thử nghiệm phục vụ hai ứng dụng ở gốc theo `MARKET_HOST`, `TUTOR_HOST` (`build-assets.sh` dựng thêm hai thư mục `cho-gia-su`, `gia-su`).
- Kiểm thử: CT-27f-1, CT-27f-2, CT-27f-5 cập nhật theo hai tên miền; e2e 195 thêm ứng dụng Gia sư (cổng 5388, tên miền `gia-su.e2e.localhost`); `tests/trial/edge-worker.test.mjs` thêm hai tên miền.

#### Quyết định

- Ứng dụng Gia sư ở tên miền con riêng (không ở đường dẫn con của tên miền chợ): PWA cài riêng, phạm vi service worker riêng, phiên ở `sessionStorage` riêng của nguồn gốc; máy chủ biết vai của ứng dụng theo tên miền.
- Mỗi ứng dụng một vai: tài khoản phụ huynh chỉ đăng ký, đăng nhập, dùng phiên ở Chợ gia sư; tài khoản gia sư chỉ ở ứng dụng Gia sư. Đăng nhập đúng mật khẩu ở sai ứng dụng thì 403 kèm chỉ dẫn, không mở phiên; phiên mang sang ứng dụng kia thì 401.
- Gói `packages/market-client` dùng chung thay vì chép mã; không tách thêm gói giao diện.
- Không đổi CORS, cookie: hai ứng dụng gọi `/api/v1` cùng tên miền của mình, phiên là mã trong `sessionStorage`, không có cookie. Chưa có máy khách OIDC (đăng nhập OIDC của gia sư làm ở 27g).
- Phạm vi theo lời Eric làm rõ ngày 2026-10-28 (nguyên văn): "giáo viên dạy kèm cũng dùng ứng dụng gia sư như 1 kênh ngoài. đối với học sinh trong trường vẫn cho phép giáo viên sử dụng ứng dụng giáo viên". Do đó:
  - giáo viên dạy kèm ngoài trường (kênh ngoài, chợ) dùng `apps/tutor` như mọi gia sư khác, đăng nhập bằng **tài khoản chợ riêng** (không dùng tài khoản của trường);
  - dạy kèm học sinh trong trường của mình (27a đến 27e) vẫn làm ở ứng dụng giáo viên; không bỏ chức năng nào của ứng dụng giáo viên;
  - liên kết tùy chọn tài khoản chợ với tài khoản trường để hiện nhãn "giáo viên trường X đã xác minh" làm ở 27g (cùng phần khai là giáo viên trường nào, báo cáo Mẫu 03); dữ liệu chợ và dữ liệu trường vẫn cách ly (chợ chỉ nhận kết quả xác minh, không đọc cơ sở dữ liệu trường);
  - giữ các chặn theo Thông tư 29/2024 của kế hoạch: giáo viên công lập không đứng tên cơ sở dạy thêm cho nội dung `curriculum` (27g, khi gia sư khai loại nội dung); giáo viên đang được phân công dạy trẻ thì không nhận buổi `curriculum` có thu tiền của trẻ đó (27h, so khớp qua liên kết trường của hồ sơ con).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-262, `23_LICH_SU_PHIEN_BAN.md` 0.178.0; BR-411, AC-1075, MH-513, CT-1376, QĐ-46 (QĐ-45 đã là của YCTD-300 khi gộp main).

#### Vấn đề tồn đọng

- Ảnh dựng `web` phục vụ được hai ứng dụng, nhưng tạo vai trò, cơ sở dữ liệu chợ và đặt tên miền ở môi trường thật vẫn chờ mở chợ (E-04).

### 2026-10-28 — README song ngữ

#### Công việc đã thực hiện

- Thêm `README.md` (tiếng Việt, bản chính) và `README.en.md` (tiếng Anh) ở gốc kho mã, có liên kết chuyển ngôn ngữ ở đầu mỗi tệp: giới thiệu, tính năng theo nhóm, kiến trúc (sơ đồ mermaid), chạy trên máy, kiểm thử, triển khai, quy ước đóng góp, giấy phép.
- Nội dung lấy từ `package.json`, `pnpm-workspace.yaml`, `docker-compose.yml`, `.env.example`, `deploy/`, `.github/workflows/ci.yml` và bộ tài liệu `tai_lieu/`.

#### Quyết định

- Kho chưa có tệp `LICENSE`: README ghi "chưa có giấy phép", không tự chọn giấy phép.
- `apps/student` (PR 224) và `apps/tutor` (PR 223) ghi rõ là đang tách, chưa có trên `main`; khi hai PR gộp thì cập nhật bảng thư mục.
- README không chứa khoá, mật khẩu, địa chỉ nội bộ hay dữ liệu thật, không khẳng định tuân thủ hay chứng nhận.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-305, `23_LICH_SU_PHIEN_BAN.md` 0.177.0.

#### Vấn đề tồn đọng

- Chủ dự án chọn giấy phép thì thêm `LICENSE` và sửa mục "Giấy phép" của hai README.

### 2026-10-28 — Tách riêng ứng dụng học sinh

#### Công việc đã thực hiện

- Dựng ứng dụng web `apps/student` (Vite, React, `packages/ui`, `packages/pwa`) cùng kiểu với ứng dụng giáo viên, phụ huynh. Chuyển bằng `git mv` (giữ lịch sử) toàn bộ màn hình học sinh từ `apps/parent/src/student/`: đăng nhập, đặt mật khẩu mới, thi trực tuyến có giám thị camera, bài tập, SCORM, thảo luận lớp, lớp video, hỏi đáp gia sư, khoá học ghi sẵn, học khi mạng yếu (IndexedDB), cùng `student-api.ts`, `student-session.tsx` và mô hình nhận diện khuôn mặt ở `public/models`.
- Phần dùng chung của hai ứng dụng: danh sách huy hiệu, chứng nhận (`RecognitionList`) chuyển sang `packages/ui`.
- Ứng dụng học sinh có manifest riêng (tên "… – Học sinh", mở thẳng gốc của ứng dụng), service worker riêng (tiền tố bộ nhớ đệm `hoc-sinh-v-`), đăng ký thông báo đẩy `usePushSync('student')` theo phạm vi của mình.
- Ứng dụng phụ huynh bỏ nhánh `#hoc-sinh`. Địa chỉ cũ `<ứng dụng phụ huynh>#hoc-sinh` (thẻ QR, liên kết kích hoạt, lối tắt đã cài) chuyển sang ứng dụng học sinh trước khi dựng ứng dụng phụ huynh; liên kết "Học sinh làm bài thi trực tuyến" ở màn hình đăng nhập phụ huynh trỏ thẳng sang ứng dụng học sinh, liên kết "Ứng dụng phụ huynh" ở màn hình đăng nhập học sinh trỏ ngược lại.
- Chạy thật: ảnh `web` dựng ứng dụng học sinh với đường dẫn gốc `/hoc-sinh/`, Caddy phục vụ ở `/hoc-sinh/` của tên miền phụ huynh (`deploy/caddy`, bản một trường của hồ sơ vận hành) và của tên miền trường khi `TENANT_PATHS=on`; trang học sinh mở quyền camera, micro của chính trang (giám thị camera 23e, lớp video 27a), các trang khác giữ chính sách chặt như cũ. Hồ sơ thử nghiệm: `build-assets.sh` dựng thêm `hoc-sinh`, cổng biên Cloudflare và proxy Vercel 3b nhận tiền tố `/hoc-sinh`.
- Máy chủ API: manifest `student` mở thẳng gốc của ứng dụng (bỏ `#hoc-sinh`). Dịch vụ định danh không đổi: kênh `student`, cookie làm mới riêng, xác thực địa chỉ quay về theo tên miền của yêu cầu nên ứng dụng ở cùng tên miền không cần khai thêm. CSP của tệp SCORM lấy `frame-ancestors` từ nguồn gốc trang mở gói nên tự đúng với ứng dụng mới.
- Cổng phát triển 5179, cổng e2e 5379 (chưa ứng dụng nào dùng). Vỏ ứng dụng `apps/mobile` không mở màn hình học sinh; chỉ thêm cổng 5179 vào danh sách điều hướng được và chuyển cổng khi chạy máy giả lập.
- Kiểm thử giao diện có học sinh (150, 154, 181, 212, 214, 217, 218, 219) mở thẳng ứng dụng học sinh; 181 kiểm địa chỉ cũ `#hoc-sinh` chuyển sang ứng dụng mới, manifest và service worker riêng; 180 đo thêm trang đăng nhập học sinh theo khổ thiết bị (chạy ở `kiem-thu-thiet-bi`).

#### Quyết định

- Anh Eric quyết định ngày 2026-10-28 tách riêng ứng dụng học sinh, thay ghi chú cũ của DT-23 phần 23a "không dựng ứng dụng thứ tư" (QĐ-45).
- Ứng dụng học sinh nằm ở `/hoc-sinh/` cùng tên miền với ứng dụng phụ huynh thay vì tên miền con riêng: địa chỉ cũ chuyển hướng được trong cùng tên miền, cookie kênh `student` vẫn là cookie cùng tên miền, không cần biến môi trường mới khi triển khai.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-300, `23_LICH_SU_PHIEN_BAN.md` 0.176.0.

#### Vấn đề tồn đọng

- Đăng ký đẩy của học sinh tạo trước khi tách gắn với service worker của ứng dụng phụ huynh: chạm thông báo mở ứng dụng phụ huynh; học sinh muốn nhận đẩy ở ứng dụng mới thì bật lại ở mục thông báo của ứng dụng học sinh.
- Hồ sơ vận hành bật `TENANT_PATHS=on` vẫn chờ S1b dựng các ứng dụng khác với đường dẫn gốc riêng; ứng dụng học sinh đã dựng sẵn với `/hoc-sinh/`.

### 2026-10-28 — Áp sáu màn mẫu giao diện đã duyệt

#### Công việc đã thực hiện

- Học sinh (`/children`, `ChildrenPage`): dòng tiêu đề có số học sinh theo bộ lọc và nút "Nhập từ Excel" (sang `/student-imports`, theo quyền nhập), "Thêm mới" chuyển lên dòng tiêu đề; thẻ trạng thái (Tất cả và các trạng thái hồ sơ) đồng bộ với ô "Trạng thái" ở "Mở rộng tìm kiếm"; thẻ và lưới chung một khung trắng; cột họ tên có ảnh đại diện chữ cái đầu.
- Sổ điểm (`/scores`, `ScoresPage`): dòng mô tả lớp, học kỳ, Thông tư 22/2021; bộ lọc trong khung trắng; thẻ dạng gạch chân; nhóm cột "Đánh giá thường xuyên" trên TX1..n, Giữa kỳ, Cuối kỳ, "TB môn HK", Nhận xét; nhãn tiến độ nhập theo bản nháp; ô bắt buộc chưa nhập viền cam; ghi chú công thức lấy từ hệ số cấu hình.
- Thời khoá biểu (`/timetables`, `TimetablesPage`): dòng tóm tắt phiên bản, ngày áp dụng, đối tượng đang xem, số tiết mỗi tuần; "Xem theo" thành thẻ chọn Theo lớp, Theo giáo viên, Theo phòng; nhãn số xung đột phải sửa; lưới có dải "Buổi chiều", mỗi tiết là khối màu theo môn (`lesson-tone.ts`); liên kết "Xếp tự động" theo quyền quản lý thời khoá biểu. Lưới chỉ xem dùng chung với bản xem trước ở trang xếp tự động.
- Đăng nhập (`/login`, `LoginPage`, `LoginHero`): bố cục hai cột, cột trái nền xanh có biểu trưng, tên trường màu vàng, dòng giới thiệu và ba nhãn ứng dụng; cột phải là thẻ đăng nhập; trên điện thoại hai cột xếp chồng.
- Ứng dụng giáo viên, điểm danh (`AttendanceScreen`): thanh đầu xanh có tên lớp, ngày và ba bộ đếm (Có mặt, Nghỉ có báo, Nghỉ không báo); chạm vào dòng đổi lần lượt Có mặt, Nghỉ có báo, Nghỉ không báo; nút lưu, chốt ngày ở thanh dưới cố định.
- Ứng dụng phụ huynh, trang chủ (`HomeScreen`): đầu trang xanh "Xin chào," và tên phụ huynh; thẻ của con chồng lên đầu trang, có ảnh chữ cái đầu và trạng thái điểm danh hôm nay (lấy từ điểm danh tháng, không có thì không hiện); lưới bốn lối tắt Báo vắng, Thời khoá biểu, Thực đơn, Học phí thay cho các nút cũ cùng tên.

#### Quyết định

- Chỉ đổi phần trình bày, giữ nguyên dữ liệu, truy vấn, quyền, hộp thoại, nhãn và mã kiểm thử mà kiểm thử giao diện dùng ("Lưu điểm danh", "Ban hành", "Ghi nhớ tài khoản", "Xin chào, …", "Ghi điểm").
- Phần mẫu không có dữ liệu hay chức năng phía sau thì bỏ, không tự thêm: nút "Đồng bộ CSDL ngành", cột Phụ huynh, Chuyên cần ở danh sách học sinh; "Nhập từ Excel", "In sổ" ở sổ điểm; "Xuất Excel" ở thời khoá biểu; tiết, môn ở thanh đầu điểm danh; thẻ điểm mới, khoản cần nộp, nút "Đổi con", thanh điều hướng dưới ở trang chủ phụ huynh.
- Dùng màu của `packages/ui/src/theme.css`, không ghi mã màu trong mã; liên kết mới cao tối thiểu 44 px dưới 1280 px.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-296, `23_LICH_SU_PHIEN_BAN.md` 0.175.0.

#### Vấn đề tồn đọng

- Chưa chạy kiểm thử giao diện trên máy; chờ CI.

### 2026-10-28 — Trang chủ cổng quản trị theo mẫu giao diện Tổng quan

#### Công việc đã thực hiện

- Dựng bộ mẫu giao diện trên canvas thiết kế (tổng quan Ban Giám hiệu, danh sách học sinh, đăng nhập, điểm danh trên ứng dụng giáo viên, trang chủ ứng dụng phụ huynh, sổ điểm, thời khoá biểu) theo mã màu và cỡ chữ ở `packages/ui/src/theme.css`.
- Đưa mẫu Tổng quan vào trang chủ cổng quản trị: dòng ngày trên lời chào; bảng điều khiển MH-01 đổi từ 8 thẻ nhỏ sang 5 thẻ số lớn có dòng ghi chú; thêm khối "Việc cần xử lý" theo phân hệ; xếp sinh nhật, hợp đồng sắp hết hạn vào lưới hai cột.

#### Quyết định

- Giữ tiêu đề "Xin chào, …" vì nhiều kịch bản e2e dựa vào tiêu đề này.
- Khối "Việc cần xử lý" dùng lại truy vấn đếm của nút Việc của tôi (không gọi thêm máy chủ), xếp phân hệ nhiều việc lên trước, bằng nhau thì theo thứ tự nhãn, tối đa 5 dòng. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Chưa đưa biểu đồ chuyên cần 7 ngày, bảng lớp vắng nhiều, lịch hôm nay của mẫu vì chưa có điểm cuối trả số liệu này; không dùng số liệu giả.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-295, `23_LICH_SU_PHIEN_BAN.md` 0.174.0.

#### Vấn đề tồn đọng

- Cần điểm cuối chuyên cần theo ngày và lớp vắng nhiều trong ngày để hoàn thiện mẫu Tổng quan.

### 2026-10-28 — DT-27 phần 27f: nền chợ gia sư

#### Công việc đã thực hiện

- Đọc mục 19.3 đến 19.11 (27f) của `32_KE_HOACH_THEO_HE_THONG_SO.md`. Eric quyết ngày 2026-10-28 (qua phiên điều phối): làm phần mã của chợ ngay, thanh toán chạy giả lập; không bật tiền thật trước khi xong E-01 đến E-07.
- Cơ sở dữ liệu chung mới `marketplace`: loại migration thứ năm (`database/marketplace/`, chỉ mục sinh bằng `database/sinh-chi-muc.mjs` như bốn loại cũ), `migrateToLatest('marketplace', …)`, biến `MARKETPLACE_DATABASE_URL`; `platform migrate` chạy luôn chợ khi có biến. Tệp 0001 (múi giờ) đến 0005: `market_accounts`, `market_verification_codes`, `market_sessions`, `market_external_identities`, `market_legal_documents`, `market_consents`, `market_children`, `market_school_links`, `market_tutor_profiles`, `market_providers`, `market_audit_log`.
- `provisionMarketplaceDatabase` tạo vai trò riêng (mặc định `marketplace_service`, không CREATEDB, không CREATEROLE) là chủ cơ sở dữ liệu chợ, thu quyền kết nối của PUBLIC.
- Máy chủ API `apps/api/src/market/` (đăng ký ở `src/dang-ky/dt-27f-cho-gia-su.ts`): đường dẫn `/api/v1/market/*` không cần trường; tài khoản phụ huynh, gia sư (đăng ký có đồng ý văn bản bắt buộc, mã xác nhận 6 số, đăng nhập khóa 15 phút sau 5 lần sai, phiên riêng), hồ sơ con, đồng ý của cha mẹ theo con, rút đồng ý, liên kết với trường bằng mã ký, hồ sơ gia sư và cơ sở dạy thêm tối thiểu, quản trị ở cổng nền tảng (cấu hình, đăng văn bản pháp lý, số tài khoản). Phía trường: `GET`, `POST /api/v1/children/{id}/market-link` cho cha mẹ lấy mã liên kết.
- Cấu hình chợ ở `platform_settings` khóa `market` (`database/src/marketplace/market-settings.ts`): bật tắt, tên miền dành riêng, hạn giữ bản ghi (GD-132), hạn khiếu nại (GD-133), tỷ lệ hoa hồng mặc định (E-01, để trống); thu tiền thật luôn tắt.
- `PlatformOperatorTokenVerifier` ở `packages/server` để máy chủ API kiểm mã phiên vận hành (cùng đối tượng, loại với dịch vụ định danh).
- Giao diện: ứng dụng mới `apps/market` (cổng phát triển 5178): trang giới thiệu, văn bản pháp lý, đăng ký, xác nhận, đăng nhập, khu phụ huynh (hồ sơ con, đồng ý, liên kết trường), khu gia sư; trang Chợ gia sư ở cổng nền tảng; nút Lấy mã liên kết ở khối gia sư của con (ứng dụng phụ huynh).
- Kiểm thử: CT-27f-1 (`database/src/marketplace/market-settings.test.ts`), CT-27f-2 đến CT-27f-5 (`apps/api/src/market/market.test.ts`), CT-27f-6 (e2e `195-marketplace-isolation.spec.ts`, dự án nhiều trường; bước dựng tạo cơ sở dữ liệu `school_marketplace_e2e` và vai trò `marketplace_e2e`).

#### Quyết định

- Chợ ở máy chủ API (không dựng dịch vụ thứ ba), đường dẫn không cần trường như `/api/v1/parent-org/*`: không có ngữ cảnh trường nên `Databases` không mở được kết nối của trường nào; chỉ phục vụ khi chạy nhiều trường, có `MARKETPLACE_DATABASE_URL`, chợ bật và đúng tên miền dành riêng (tên miền khác 404). Quản trị chợ cũng ở máy chủ API (`/api/v1/market/admin`), chỉ ở tên miền cổng nền tảng với mã phiên vận hành, để chỉ một tiến trình giữ vai trò của chợ.
- Phiên của chợ là chuỗi ngẫu nhiên 32 byte, chỉ lưu băm; không dùng mã phiên ký của trường nên hai bên không dùng chéo được.
- Một tài khoản một vai (phụ huynh hoặc gia sư); trẻ không có tài khoản (GD-135); hồ sơ con chỉ tên hiển thị, năm sinh, cấp, lớp (lớp đúng cấp: Tiểu học 1 đến 5, THCS 6 đến 9, THPT 10 đến 12).
- Văn bản pháp lý có phiên bản, phiên bản đã đăng không sửa; có phiên bản mới của văn bản bắt buộc thì người dùng phải đồng ý lại mới dùng tiếp (409 cho đến khi đồng ý).
- Liên kết với trường bằng mã ký HMAC hạn 10 phút do ứng dụng phụ huynh của trường cấp (`MARKET_LINK_SECRET`), mã chỉ mang mã trường, mã học sinh băm HMAC theo mã trường, cấp, lớp; chợ không gọi vào trường. Thay cho luồng chuyển đăng nhập của DT-24 và bảng định danh `0170` của kế hoạch (không cần lưu ở trường; nhật ký cấp mã ghi ở nhật ký của trường). Luồng chuyển tự động có thể thêm sau mà không đổi dạng mã.
- Mã xác nhận gửi qua hộp thư giả lập trong bộ nhớ của máy chủ (không ghi mã ra nhật ký); nối thư điện tử, tin nhắn thật làm khi mở chợ (E-04).
- Đăng nhập bằng OIDC (bộ nối DT-25) chuyển sang 27g, làm cùng xác minh danh tính gia sư; bảng `market_external_identities` đã có.
- Thu tiền thật: lưu `real_payments_enabled = true` bị từ chối, đọc cấu hình luôn trả tắt kể cả khi giá trị ở cơ sở dữ liệu bị sửa tay; bỏ chặn là thay đổi mã có YCTD riêng sau E-01 đến E-07.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-256, `23_LICH_SU_PHIEN_BAN.md` 0.173.0; BR-410, PQ-175, P02-125, AC-1070 đến AC-1074, MH-510 đến MH-512, CT-1370 đến CT-1375, QĐ-44.

#### Vấn đề tồn đọng

- Gửi mã xác nhận thật (thư điện tử, tin nhắn), đăng nhập OIDC, đặt lại mật khẩu chưa làm; giới hạn tần suất đăng ký theo địa chỉ mạng chưa làm.
- Ảnh dựng `deploy/docker/web.Dockerfile`, Caddy, hồ sơ thử nghiệm chưa phục vụ `apps/market`; tạo vai trò, cơ sở dữ liệu chợ ở môi trường thật làm khi mở chợ (E-04).

### 2026-10-28 — DT-28 phần 28j: học khi mạng yếu

#### Công việc đã thực hiện

- Làm phần 28j theo `32` mục 20.6, 20.7. **GD-148 Eric đã chốt 2026-10-27** ("Đồng ý đề xuất"):
  - Tắt mặc định, Ban Giám hiệu bật ở mục 9.3.
  - Dữ liệu chỉ ở trên máy tối đa 7 ngày (trường đặt 1 đến 7), xoá khi nộp xong, khi đăng xuất, khi quá hạn.
  - Khóa bản ghi không có tên học sinh; dữ liệu mã hoá AES-GCM khi trình duyệt có WebCrypto.
- **Mô-đun riêng** `apps/parent/src/student/offline/` (quy tắc thuần, kho IndexedDB, cửa `offline.ts`), gọi từ ba chỗ: màn hình làm bài tập, danh sách học trực tuyến, đăng xuất. Khi cần gỡ thì bỏ thư mục này và các dòng gọi; phía máy chủ chỉ là cấu hình và mã chống trùng, giữ lại không ảnh hưởng.
- **Màn hình học tập của học sinh** (khi trường bật):
  - Bản nháp câu trả lời tự lưu trên máy, mở lại thì khôi phục.
  - Nội dung hoạt động đã mở được giữ (trừ bài tập, video, gói SCORM); mất mạng thì mở lại bản đã giữ.
  - Mất mạng khi gửi tệp hoặc bấm nộp: thao tác vào hàng đợi trên máy, có mạng lại thì tự gửi theo thứ tự.
- **Máy chủ** (năm học 0193):
  - Mã chống trùng do máy sinh cho lần nộp và tệp; gửi lại cùng mã thì trả bản đã nhận, không ghi lần hai.
  - Thời điểm em bấm nộp trên máy được ghi để giáo viên xét khi bài muộn do mạng; máy chủ vẫn tính muộn theo lúc nhận.
- **Kiểm thử:** 2/2 ca thuần ở `apps/parent` (`node --test`), 2/2 ca API (`offline.test.ts`); e2e `219-offline-learning` đạt, chạy kèm spec nền 01 đến 09 (spec 04 hỏng vì tài khoản trùng tên trong cơ sở dữ liệu định danh riêng của phiên, do môi trường); hồi quy `assignments`, `homework` cùng `offline` 26/26 ca.

#### Quyết định

- Claude chọn theo ủy quyền (ghi ở YCTD-280):
  - Thời điểm bấm nộp trên máy chỉ nhận trong 7 ngày gần đây và không sau lúc nhận quá 5 phút.
  - Hàng đợi: lỗi mạng thì dừng chờ lần sau; máy chủ từ chối (bài đóng, hết lượt) thì bỏ thao tác và báo cho em.
  - Khóa mã hoá sinh trên máy, không xuất được, xoá cùng dữ liệu khi đăng xuất.
  - Nộp thay của phụ huynh chưa dùng chế độ này.
  - Gửi tệp từng phần không làm (tệp của bài nộp tối đa 10 MB, gửi một lần).
- Migration năm học 0193; không thêm quyền.
- Mã khối riêng (BR-400, AC-1060, MH-505, CT-1360, BM-210, PQ-170, P03-60); mục mới 12P, 18O, 17.9 đặt sau mục của 28i.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-280, `23_LICH_SU_PHIEN_BAN.md` 0.172.0; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Nộp thay ngoại tuyến của phụ huynh; gửi tệp từng phần.
- Giáo viên chưa thấy thời điểm bấm nộp trên máy trong danh sách bài nộp (cột đã có ở cơ sở dữ liệu).

### 2026-10-27 — DT-26 phần 26g: thông báo đẩy gốc FCM, APNs cho ứng dụng cài đặt (phần mã)

#### Công việc đã thực hiện

- Máy chủ API: bộ nối `fcm` (Firebase Cloud Messaging HTTP v1, tài khoản dịch vụ ký JWT RS256 đổi mã truy cập OAuth) và `apns` (HTTP/2, khóa `.p8` ký JWT ES256) của `PushSender`; bộ định tuyến chọn bộ nối theo loại đăng ký (`web_push`, `fcm`, `apns`); biến PUSH_NATIVE_PROVIDER (`native`, `development`), tệp khóa cho bản một trường (FCM_SERVICE_ACCOUNT_FILE, APNS_KEY_FILE, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_ENVIRONMENT).
- Đăng ký mã thiết bị qua cùng điểm cuối của 26b: `POST /push/subscriptions` nhận `kind` (`fcm`, `apns`), `token`, `origin` (địa chỉ gốc của ứng dụng web của trường); `unsubscribe` nhận `kind`, `token`; `GET /public/push/vapid-public-key` trả thêm `native` (máy chủ có khóa cho FCM, APNs chưa). Nội dung đẩy kèm `app_url` là địa chỉ gốc lúc đăng ký.
- Cơ sở dữ liệu nền tảng 0232 `platform_native_push_keys`: khóa FCM, APNs của nền tảng lưu mã hóa bằng khóa gốc; lệnh `platform set-native-push-key`, `retire-native-push-key`.
- `packages/pwa`: `native-push.ts` (xin quyền, lấy mã thiết bị qua plugin PushNotifications, gửi, thu hồi khi tắt hoặc đăng xuất, lấy lại mã khi mở ứng dụng, chạm thông báo); `push-client.ts` tự chuyển sang đẩy gốc khi chạy trong vỏ; khối Cài đặt thông báo hướng dẫn mở quyền ở cài đặt của máy.
- `apps/mobile`: plugin `@capacitor/push-notifications` 8.1.3; `MainActivity` chèn cầu nối Capacitor kèm riêng plugin đẩy vào trang của các tên miền được phép, báo trang khi bản dựng chưa có cấu hình Firebase; trang khởi động mở đúng ứng dụng của trường đã lưu khi chạm thông báo; iOS chuyển mã thiết bị APNs cho plugin (`AppDelegate.swift`).
- Kiểm thử: `native-push.test.ts` của máy chủ API (máy chủ FCM, APNs giả lập trả mã lỗi thật), `native-push.test.ts` của `packages/pwa`, e2e spec 186 (cách ly mã thiết bị giữa hai trường), sửa spec 182 theo phản hồi khóa công khai mới.

#### Quyết định

- Eric cho làm trước phần mã 26g ngày 2026-10-27 khi chưa có tài khoản nhà phát triển; bộ nối chạy với bộ giả lập, chưa nối FCM, APNs thật, không có khóa, `google-services.json`, `.p8` trong kho (QĐ-43).
- Không cần migration hệ thống 0093: bảng `push_subscriptions` của 26b đã có loại `fcm`, `apns`; mã thiết bị lưu mã hóa ở cột địa chỉ đăng ký.
- Chạy thử trên máy giả lập phát hiện gọi `register` khi bản dựng chưa có `google-services.json` làm ứng dụng dừng (Firebase chưa khởi tạo); vỏ báo trang `DAY_GOC_SAN_SANG = false`, khối Cài đặt thông báo báo hệ thống chưa bật đẩy.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-237, `23_LICH_SU_PHIEN_BAN.md` 0.171.0; BR-405, P19-12, AC-1065, AC-1066, CT-1365, CT-1366, QĐ-43.

#### Vấn đề tồn đọng

- Gửi thật cần Eric: tạo dự án Firebase (thêm ứng dụng Android `vn.schoolmanagement.demo`, tải `google-services.json` đặt vào `apps/mobile/android/app/`, tạo khóa tài khoản dịch vụ rồi nạp bằng `platform set-native-push-key --provider fcm`), tạo khóa APNs `.p8` ở Apple Developer và bật năng lực Push Notifications trong Xcode. iOS chưa dựng được (không có máy Mac). Máy chủ chưa kiểm với FCM, APNs thật.

### 2026-10-28 — DT-28 phần 28i: huy hiệu và chứng nhận hoàn thành

#### Công việc đã thực hiện

- Làm phần 28i theo `32` mục 20.6, 20.7. Tắt mặc định (GD-155); Ban Giám hiệu bật ở mục 9.3, đặt mẫu chứng nhận (tên chứng nhận, chức danh, họ tên người ký).
- **Huy hiệu nội bộ:**
  - Tự động theo tiêu chí có sẵn: hoàn thành chương, hoàn thành khoá, nộp bài đúng hạn 5 lần liên tiếp trong một lớp học trực tuyến. Máy tính khi mở danh sách, mỗi tiêu chí ghi một lần.
  - Giáo viên của lớp học trực tuyến trao huy hiệu kèm lý do, thu hồi có lý do.
  - Chỉ học sinh đó, phụ huynh, giáo viên thấy; không bảng xếp hạng, không đếm hay so sánh giữa học sinh.
- **Chứng nhận hoàn thành khoá tự chọn:**
  - Giáo viên của khoá cấp cho học sinh đã hoàn thành mọi hoạt động bắt buộc.
  - Tệp PDF theo mẫu của trường, có mã kiểm tra, đường dẫn trang kiểm tra.
  - Thu hồi có lý do; thu hồi rồi cấp lại được.
- **Trang kiểm tra công khai** `/api/v1/public/certificates/{mã}` theo tên miền của trường: chỉ tên khoá, ngày cấp, tên trường, họ tên viết tắt, trạng thái (hợp lệ, đã thu hồi); có giới hạn tần suất.
- **Giao diện:**
  - Ứng dụng giáo viên: màn hình "Huy hiệu, chứng nhận" của lớp học trực tuyến.
  - Học sinh `#hoc-sinh` và ứng dụng phụ huynh: khối huy hiệu, chứng nhận của em.
  - Cổng quản trị: khối cấu hình ở mục 9.3.
- **Kiểm thử:** 5/5 ca của `recognition-rules.test.ts`, `recognition.test.ts`; e2e `218-badges-certificates` đạt, chạy kèm spec nền 01 đến 09 (spec 04 hỏng vì tài khoản trùng tên trong cơ sở dữ liệu định danh riêng của phiên, do môi trường); hồi quy 64/64 ca (recognition, content-packages, learning, homework, progress, ma trận cách ly, school-levels), `migrate.test.ts`.

- **Sửa lỗi của lõi 28b:** `LearningService.sync` truy vấn môn với danh sách rỗng (lỗi 500 ở danh sách lớp học trực tuyến) khi trường có lớp nhưng chưa có phân công môn, tiết nào, ví dụ giáo viên chỉ dạy khoá tự chọn; nay bỏ qua truy vấn khi danh sách rỗng, có ca kiểm thử ở `recognition.test.ts`.

#### Quyết định

- Claude chọn theo ủy quyền (ghi ở YCTD-279):
  - Ngưỡng nộp đúng hạn liên tiếp là 5, mỗi lớp học trực tuyến một huy hiệu.
  - Huy hiệu tự động đã thu hồi không trao lại.
  - Họ tên viết tắt là chữ đầu của họ, tên đệm cộng tên (Nguyễn Văn An thành N. V. An), lưu sẵn lúc cấp.
  - Mã kiểm tra `CN-` cộng 10 ký tự, bỏ ký tự dễ nhầm.
  - Cấu hình lưu ở `settings` khóa `learning_recognition`.
- Migration năm học 0191 (`learning_badges`), 0192 (`course_certificates`); không thêm quyền.
- Mã khối riêng (BR-390, AC-1050, MH-500, CT-1350, BM-205, PQ-165, P03-55) để không va với PR đang mở; dòng bảng mới neo vào dòng của 28b; mục mới 12O, 18N, 17.8 đặt sau mục của 28h.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-279, `23_LICH_SU_PHIEN_BAN.md` 0.170.0; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Trang kiểm tra chỉ tra chứng nhận ở cơ sở dữ liệu năm học hiện tại; chứng nhận của năm học đã đóng chưa tra được.
- Chứng nhận cho khoá của 27d (khoá học ghi sẵn của gia sư) để khi 27d cần.
- Huy hiệu tương thích Open Badges không làm.
- Việc sau của 28h (ghi ở YCTD-278): spec nhiều trường cho gói SCORM; tên miền nội dung ở cổng biên.

### 2026-10-27 — Đăng ký bằng tệp riêng của từng phần

#### Công việc đã thực hiện

- Tệp thay đổi cấu trúc của bốn cơ sở dữ liệu (định danh, hệ thống, năm học, nền tảng) nạp từ chỉ mục sinh tự động: `database/sinh-chi-muc.mjs` đọc `database/<loại>/migrations/` rồi sinh `<loại>/migrations.generated.ts`; `<loại>/index.ts` chỉ còn xuất lại chỉ mục. Không đổi tên tệp nào.
- Kiểu bảng của từng phần đặt ở `database/<loại>/schema-parts/<phần>.ts`, thêm bảng vào `SchoolYearDatabase` (hoặc `SystemDatabase`, `PlatformDatabase`, `IdentityDatabase`) bằng `declare module '../schema.js'`; chỉ mục `<loại>/schema-parts.generated.ts` kéo các tệp này vào chương trình, `database/src/index.ts` xuất lại kiểu của chúng. Chuyển bảng `scorm_attempts` (DT-28 phần 28h) sang `school-year/schema-parts/dt-28h-goi-scorm.ts` làm mẫu.
- Máy chủ API: mỗi phần thêm `apps/api/src/dang-ky/<phần>.ts` xuất mặc định `{ controllers, providers, transitionSteps } satisfies PhanDangKy` (`src/common/dang-ky-phan.ts`); `apps/api/sinh-dang-ky.mjs` sinh `src/dang-ky.generated.ts`; `ApplicationModule` nối các phần theo thứ tự tên tệp sau danh sách có sẵn. Chuyển đăng ký của DT-28 phần 28h sang `src/dang-ky/dt-28h-goi-scorm.ts` làm mẫu.
- Bước dựng, kiểm kiểu của `database` và `apps/api` chạy tập lệnh sinh trước `tsc`; tệp `*.generated.ts` không đưa lên kho (`.gitignore`).
- CI chạy `node database/sinh-chi-muc.mjs --kiem` và `node apps/api/sinh-dang-ky.mjs --kiem`: báo lỗi khi tên tệp sai mẫu, tệp thay đổi cấu trúc thiếu `export const migration`, tệp kiểu bảng thiếu `declare module`, tệp đăng ký thiếu `export default`, bộ điều khiển (`@Controller`) chưa có ở `application.module.ts` hay tệp nào ở `src/dang-ky/`, chỉ mục đã sinh lệch với thư mục.

#### Quyết định

- Chỉ mục sinh khi dựng, không đưa lên kho: một danh sách sinh ra mà đưa lên kho vẫn xung đột khi hai PR thêm dòng liền nhau (thường gặp vì phần mới lấy số lớn nhất), nên chỉ thư mục là nguồn. Phương án đã loại: đọc thư mục lúc chạy bằng `import()` động (mất kiểm kiểu, `dist` còn tệp cũ khi xoá nguồn), `import.meta.glob`/`require.context` (máy chủ dựng bằng `tsc`, không có bộ đóng gói).
- Giữ nguyên danh sách bộ điều khiển, dịch vụ đã có ở `application.module.ts` để không đổi thứ tự đăng ký tuyến; các phần nối sau cùng nên thứ tự cũ giữ nguyên (28h vốn đứng cuối).
- Thứ tự chạy tệp thay đổi cấu trúc không đổi: Kysely xếp theo tên tệp (đã bật `allowUnorderedMigrations`). So bốn cơ sở dữ liệu migrate từ đầu bằng mã cũ và mã mới trên PostgreSQL máy phát triển: cùng số bảng (định danh 25, hệ thống 94, năm học 457, nền tảng 53), số cột (173, 1113, 5303, 524), cùng cột, chỉ mục, ràng buộc và danh sách tệp đã chạy.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-294, `23_LICH_SU_PHIEN_BAN.md` 0.169.0.

#### Vấn đề tồn đọng

- PR đang mở (DT-26, DT-27, DT-28) khi gộp main phải chuyển dòng đăng ký của mình sang tệp riêng một lần (hướng dẫn ở mô tả PR).
- Các danh sách chung khác còn sửa tại chỗ: xuất lại hằng số, kiểu ở `database/src/index.ts` (trừ kiểu bảng của phần), `MY_WORK_SOURCE_TYPES`, menu cổng quản trị.

### 2026-10-27 — DT-27 phần 27e: hỏi đáp bài tập của chương trình gia sư

#### Công việc đã thực hiện

- Đọc mục 19.4, 19.5 (27e) và 20.7 (28e) của `32_KE_HOACH_THEO_HE_THONG_SO.md`; 27e xây trên bộ máy hỏi đáp 28e (PR 207) và khoá học ghi sẵn 27d1 (PR 208).
- Năm học `0201`: `tutoring_programs.answer_hours`, `tutoring_question_marks`, `tutoring_ai_answers`, `tutoring_ai_consents`. Hệ thống `0120`: thêm loại yêu cầu AI `answer`.
- Máy chủ `apps/api/src/tutoring/tutoring-questions.ts`: hàng chờ theo chương trình, thời hạn trả lời theo chương trình, gợi ý AI nháp, gửi câu trả lời có dấu "có AI hỗ trợ", học sinh đánh dấu đã hiểu, cha mẹ xem câu hỏi của con và bật tắt AI cho con. `AiAssistantService.draftAnswer` và mẫu lời nhắc `buildAnswerPrompt` ở 23d.
- Giao diện: khối Hỏi đáp bài tập ở trang Chương trình gia sư (cổng quản trị); Hỏi đáp bài tập của con (ứng dụng phụ huynh); Hỏi đáp bài tập ở trang chủ học sinh (kênh student).
- Kiểm thử: CT-27e-1 đến CT-27e-3.

#### Quyết định

- Câu hỏi, trả lời, xác nhận câu trả lời, lọc thông tin liên lạc, báo cáo, giờ mở dùng bộ máy hỏi đáp 28e ở khoá học ghi sẵn của chương trình; 27e không dựng bảng câu hỏi thứ hai.
- Migration năm học `0201` (không phải `0158`, `0159` của kế hoạch) vì khoá ngoại tới bảng của 28e (`0182`); hệ thống `0120` (không phải dải `0100` đến `0109`) vì phải chạy sau `0111` của 28c cùng ràng buộc loại yêu cầu AI.
- Gợi ý AI qua `AiProvider` của 23d: lời nhắc chỉ có cấp, môn, chữ của câu hỏi và ghi chú của giáo viên đã quét dữ liệu cá nhân; không gửi ảnh, không gửi tên học sinh; có dữ liệu cá nhân thì từ chối. Nhật ký và hạn mức theo 23d. Bản nháp không lưu vào câu hỏi; giáo viên sửa rồi mới gửi.
- Phụ huynh tắt AI cho con; chưa chọn thì cho phép (mặc định của trường); trường tắt AI thì không có nút gợi ý.
- Học sinh báo chưa hiểu thì câu trở lại hàng chờ cho đến khi giáo viên trả lời thêm.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-255, `23_LICH_SU_PHIEN_BAN.md` 0.168.0; BR-370, PQ-155, P02-120, AC-1035 đến AC-1037, MH-490, CT-1325 đến CT-1327.

#### Vấn đề tồn đọng

- Ảnh trong câu hỏi, câu trả lời và liên kết học liệu, câu trong ngân hàng chưa làm vì bộ máy hỏi đáp 28e chưa có tệp đính kèm; nhắc quá hạn chỉ hiện trong hàng chờ, chưa gửi thông báo.

### 2026-10-27 — DT-27 phần 27d2: tiến độ của khoá học ghi sẵn

#### Công việc đã thực hiện

- Phần thứ hai của 27d (tách ở YCTD-254), làm sau khi 28d gộp (PR 206); nhánh tách từ 27d1 (PR 208).
- Máy chủ `apps/api/src/tutoring/tutoring-courses.ts`: học sinh báo phần trăm đã xem video, ghi kết quả hoạt động và nhật ký học tập của 28b; xem video ở kênh học sinh theo điều kiện mở của 28b; tiến độ của em trong khoá cho cha mẹ, học sinh; tiến độ từng học sinh cho giáo viên dạy, Ban Giám hiệu.
- Giao diện: bảng tiến độ học sinh ở khối Khoá học ghi sẵn (cổng quản trị); phần trăm đã xem từng video và tiến độ của em (ứng dụng phụ huynh, kênh học sinh); trình phát ở kênh học sinh báo phần trăm đã xem.
- Kiểm thử: CT-27d2-1, CT-27d2-2.

#### Quyết định

- Không thêm bảng, không thêm migration: tiến độ là `activity_results` (cột `progress`) và `learning_events` của 28b, nên bảng tiến độ, sổ điểm, báo cáo, tóm tắt hằng tuần của 28d tự thấy khoá học ghi sẵn như mọi khoá tự chọn. Số năm học 0157 của kế hoạch không dùng.
- Phần trăm đã xem chỉ tăng; xem từ 90% thì hoàn thành nếu cách tính của hoạt động là "xem xong" (cách tính khác chỉ ghi phần trăm); hoạt động đã xong thì giữ nguyên. Trình phát báo mỗi khi qua mốc 10% và khi xem hết.
- Chỉ học sinh (kênh student) ghi tiến độ; cha mẹ, giáo viên xem video không tính là em đã xem. Mở video ở kênh học sinh ghi nhật ký "mở", không hoàn thành ngay như hoạt động xem được thường của 28b.
- Tiến độ của em dùng cùng cách tính với danh sách học của 28b (hoạt động bắt buộc xong, quá hạn, phần trăm).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-261, `23_LICH_SU_PHIEN_BAN.md` 0.167.0; BR-351, P02-116, AC-1012, AC-1013, CT-1298, CT-1299.

#### Vấn đề tồn đọng

- Phần trăm đã xem do trình phát báo (không kiểm ở máy chủ từng đoạn đã tải); đủ cho theo dõi học tập, không dùng để chấm điểm.

### 2026-10-28 — DT-28 phần 28h: gói SCORM và gói khoá học

#### Công việc đã thực hiện

- Làm phần 28h theo `32` mục 20.6, 20.7.
- **Gói SCORM 1.2 và 2004 là học liệu loại mới `scorm` của kho 22h1.** Gói zip tải lên học liệu, qua tổ chuyên môn, Ban Giám hiệu duyệt như mọi học liệu (Thông tư 09/2021/TT-BGDĐT Điều 7 khoản 3).
- **Kiểm gói khi tải lên:**
  - Bản kê `imsmanifest.xml`, chuẩn, danh sách SCO theo tổ chức mặc định.
  - Chặn đường dẫn thoát thư mục, đường dẫn tuyệt đối, loại tệp không cho phép, zip có mật khẩu, ZIP64.
  - Gói tối đa 200 MB (GD-150).
- **Phát cô lập:**
  - Tệp của gói phục vụ theo mã truy cập ngắn hạn ký HMAC (trường, gói, hoạt động, học sinh, nguồn gốc trang cha, hạn 4 giờ).
  - CSP `sandbox allow-scripts`: tài liệu luôn ở nguồn gốc riêng, không đọc được phiên, cookie, dữ liệu của ứng dụng; chỉ nạp mã, kiểu, ảnh từ chính gói; không gửi biểu mẫu, không gọi máy chủ ngoài.
  - Khung `iframe sandbox="allow-scripts"` ở trang học sinh và trang xem trước.
  - Nguồn gốc nội dung riêng cấu hình được (`SCORM_CONTENT_ORIGIN`). Ở chế độ nhiều trường, trường lấy theo mã truy cập trong đường dẫn, rồi kiểm chữ ký và mã trường.
- **Bộ chuyển API** `API` (1.2) và `API_1484_11` (2004) gắn vào trang SCO:
  - Gửi thay đổi lên trang cha bằng `postMessage`; trang cha kiểm khung nguồn và nguồn gốc.
  - Lưu trạng thái hoàn thành, đạt, điểm (quy về thang 10), thời gian phiên, vị trí, dữ liệu tạm có giới hạn cỡ.
  - Kết quả hoạt động của lõi 28b tính từ các SCO.
  - Gói nhiều SCO chạy lần lượt, không làm trình tự và điều hướng (GD-153).
- **Hoạt động loại `scorm`** trỏ tới học liệu gói SCORM đã công bố, đặt được trong khoá học mẫu.
- **Gói khoá học** `school-management.course-package/1`:
  - Xuất khoá học mẫu kèm học liệu đã công bố mà hoạt động tham chiếu (tệp, liên kết, gói SCORM); không chứa dữ liệu học sinh.
  - Nhập thành khoá mẫu nháp của người nhập. Học liệu trùng dùng lại; học liệu mới tạo nháp và gửi duyệt theo 22h1.
- **Giao diện:**
  - Cổng quản trị, kho học liệu: khối "Gói bài giảng SCORM" (tải gói, xem trước).
  - Thêm hoạt động "Gói bài giảng SCORM" ở lớp học trực tuyến.
  - Khoá học mẫu: "Xuất gói khoá học", "Nhập gói khoá học từ trường khác".
  - Học sinh `#hoc-sinh`: trình phát gói.
- **Kiểm thử:**
  - 8/8 ca của `scorm-rules.test.ts`, `scorm.test.ts`.
  - Hồi quy `learning`, `assignments`, `learning-resources` (danh mục mặc định nay 9 loại), `school-levels`, `quick-links`, `school-plan`, ma trận cách ly nhiều trường (khai báo tuyến công khai `/scorm-content` ở `tenancy-route-policy.ts`); `migrate.test.ts`.
  - e2e `217-scorm-packages` đạt, chạy kèm spec nền 01 đến 09; spec 04 hỏng vì tài khoản trùng tên trong cơ sở dữ liệu định danh riêng của phiên, do môi trường (giáo viên tải gói và xem trước; học sinh học gói trong khung cô lập; gói không đọc được trang cha; kết quả "Đạt" ghi về máy chủ).

#### Quyết định

- Claude chọn theo ủy quyền (ghi ở YCTD-278):
  - Giải nén tối đa 2.000 tệp, 500 MB, mỗi tệp 200 MB.
  - Điểm theo `score.scaled` (2004) nếu có, không thì `raw` theo `min`, `max` (thiếu `max` coi thang 100).
  - Gói chỉ biết người học là "Học sinh" với mã ẩn danh, không biết tên thật.
  - Gói khoá học tối đa 300 MB.
  - Không có tuyến xuất riêng cho câu hỏi, thang tiêu chí vì khoá mẫu của 28b không chứa bài tập.
- Migration hệ thống 0113 (loại học liệu `scorm`, bảng `scorm_packages`), 0114 (`course_package_transfers`); năm học 0189 (`scorm_attempts`). Không dùng năm học 0190 giữ sẵn.
- Mã khối riêng (BR-380, AC-1040, MH-495, CT-1340, BM-200, PQ-160, P03-50) để không va với PR đang mở; dòng bảng mới neo vào dòng của 28b; mục mới 12N, 18M, 17.7 đặt sau mục của 28e (28f giữ 12M, 18L, 17.6).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-278, `23_LICH_SU_PHIEN_BAN.md` 0.166.0; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Chưa mở rộng `MULTI_TENANT_SPEC` bằng spec nhiều trường (mã truy cập của trường A mở ở trường B). Phần này mới có kiểm thử đơn vị: chữ ký, mã trường trong mã truy cập.
- Chưa có cấu hình tên miền nội dung ở cổng biên (Caddy, Worker) của hồ sơ triển khai; khi đặt `SCORM_CONTENT_ORIGIN` cần trỏ tên miền đó về máy chủ API.
- Trình tự và điều hướng SCORM 2004 không làm (GD-153); xAPI, cmi5, LTI để sau.

### 2026-10-28 — DT-28 phần 28f: bài về nhà và phụ huynh

#### Công việc đã thực hiện

- Làm phần 28f theo `32` mục 20.6, 20.7. Bài về nhà là bài tập 28c ngữ cảnh `homework`; soạn, chấm, trả bài dùng lại 28c.
- Giao từ sổ đầu bài:
  - Tiết đã ghi có khối "Bài về nhà của tiết" và nút "Giao bài về nhà".
  - Máy tạo hoạt động bài tập ở lớp học trực tuyến của lớp và môn, gắn `class_log_id`, nhóm của tiết.
  - Hạn mặc định là đầu tiết kế tiếp của môn theo thời khoá biểu.
- Quy tắc khối lượng do trường tự đặt (GD-143), mục 9.6 Bài về nhà:
  - Ban Giám hiệu đặt theo cấp, khối: số bài, số phút mỗi ngày, thứ không để hạn, ngày lễ, khối không giao, cảnh báo hay chặn, căn cứ.
  - Nền tảng không đặt giới hạn mặc định; bảng mẫu gợi ý (chưa xác minh) chỉ để tham khảo.
- Lịch khối lượng 7 ngày của lớp:
  - Giáo viên xem ngay trước khi phát hành bài về nhà.
  - Chủ nhiệm, giáo viên của lớp, Ban Giám hiệu xem theo lớp, tuần ở mục 9.6.
- Phát hành theo quy tắc của trường:
  - Cảnh báo thì giáo viên xác nhận "Vẫn giao".
  - Chặn thì Ban Giám hiệu cho vượt có lý do (lưu trên bài).
- Phụ huynh:
  - "Bài tập về nhà của con" theo ngày đến hạn: trạng thái, kết quả, nhận xét khi thầy cô đã trả.
  - "Đã xem cùng con".
  - Nộp thay khi con chưa có tài khoản học (chụp vở, ghi âm, gõ ngắn); bài ghi người nộp là phụ huynh.
  - Trao đổi với thầy cô trên bài đã nộp.
- Nhắc bài về nhà: việc nền 15 phút một lượt gửi bốn loại nhắc tới phụ huynh (trong ứng dụng, tin đẩy) và tài khoản học của em.
  - Đã giao, sắp đến hạn (từ 19:00 hôm trước, trường đổi được), chưa nộp khi quá hạn, đã trả.
  - Giờ yên lặng 21:00 đến 6:00; nhiều bài của một em gộp một thông báo; mỗi bài, mỗi em, mỗi loại chỉ nhắc một lần.
- Vắng có phép ngày giao: màn hình bài của giáo viên gợi ý "Gia hạn 2 ngày" hoặc "Miễn".
- Kiểm thử: 9/9 ca của `homework-rules.test.ts`, `homework.test.ts`; hồi quy 123/123 ca (`homework`, `assignments`, `discussions`, `progress`, `learning`, `school-levels`, `quick-links`, `school-plan`, `child-groups`, `class-logs`); `migrate.test.ts`; e2e `215-homework-parents` đạt (chạy kèm spec nền 01 đến 09; spec 04 hỏng vì tài khoản trùng tên trong cơ sở dữ liệu định danh riêng của phiên, do môi trường).

#### Quyết định

- Claude chọn theo ủy quyền (ghi ở YCTD-276):
  - Khối lượng tính theo ngày đến hạn (giờ Việt Nam); bài chưa ghi số phút tính 0 phút; quy tắc của khối thay quy tắc chung của cấp.
  - Bài tính vào khối lượng là bài về nhà đã phát hành của mọi môn trong lớp.
  - Hạn mặc định tìm tiết kế tiếp trong 14 ngày, bỏ ngày lễ; không thấy thì 7 giờ sáng sau 7 ngày.
  - Vượt quy tắc chặn: Ban Giám hiệu không có quyền phát hành bài tập (`P02.assignment.manage`) nên cho vượt trên bài trước, giáo viên phát hành sau.
  - Nộp thay chỉ cho bài làm cá nhân, con chưa có tài khoản học, chưa có bài nộp.
  - Phụ huynh trao đổi trên bài được cả khi con có tài khoản.
- 28f thêm bốn mẫu thông báo theo kế hoạch: `homework_assigned`, `homework_due_soon`, `homework_missing`, `homework_returned`.
- Không thêm quyền mới, không có migration định danh.
- Mã khối riêng (BR-360, AC-1020, MH-480, CT-1310, BM-190, PQ-150, P03-40) để không va với 28e, 27d1, 27d2 đang mở; dòng bảng mới neo vào dòng của 28b.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-276, `23_LICH_SU_PHIEN_BAN.md` 0.165.0; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Lịch học tập của 28e chưa tách riêng bài về nhà (bài về nhà hiện như mọi hoạt động có hạn).
- Kho chưa có tài liệu hướng dẫn sử dụng; bảng mẫu gợi ý đặt ở mục 9.6.

### 2026-10-27 — DT-26 phần 26f: vỏ ứng dụng cài đặt Capacitor, bản demo trên máy giả lập

#### Công việc đã thực hiện

- `apps/mobile` (mới): vỏ Capacitor 8.5.3 một ứng dụng cho giáo viên và phụ huynh; trang khởi động (`www/index.html`) thêm trường bằng địa chỉ hoặc máy chủ phát triển, chọn vai trò, mở ứng dụng web của trường (`/giao-vien/`, `/phu-huynh/`; máy chủ phát triển cổng 5174, 5175) trong WebView; danh sách trường lưu trên máy.
- Dự án Android (`android/`, compileSdk 36, minSdk 24) và iOS (`ios/`, Swift Package Manager) do Capacitor sinh; Android chỉ cho phép http tới `localhost`, `10.0.2.2` (cấu hình bảo mật mạng), iOS cho phép mạng cục bộ (`NSAllowsLocalNetworking`); máy chủ được mở trong ứng dụng khai ở `capacitor.config.ts`, thêm bằng biến `CAP_CHO_PHEP_MAY_CHU`.
- Script `scripts/dung-android-debug.mjs` (`pnpm --filter @school-management/mobile android:debug`, `android:run`): kiểm JDK, Android SDK (thiếu thì in danh sách cần cài và dừng), `cap sync`, dựng APK debug bằng Gradle, chuyển cổng bằng `adb reverse`, cài và mở trên máy giả lập.
- Hướng dẫn chạy demo `apps/mobile/HUONG_DAN_DEMO.md` (Android AVD, iOS Simulator trên Mac). e2e spec 185: trang khởi động ở khổ máy tính và bốn khổ thiết bị.

#### Quyết định

- Đợt 3 của DT-26 làm theo phạm vi demo trên máy giả lập (Eric, 2026-10-27: "chỉ cần thử chạy trên máy giả lập"); 26g (đẩy FCM, APNs) và 26h (ký, dựng bản trên CI, phát hành, hồ sơ cửa hàng) hoãn đến khi có tài khoản nhà phát triển Apple, Google (GD-158).
- Bản demo tải ứng dụng web của trường trong WebView thay vì đóng gói bản dựng tĩnh: đóng gói cần lớp HTTP gốc, mã làm mới lưu ở Keychain, Keystore, phiên `client_kind = native` của dịch vụ định danh (phần còn lại của 26f) (QĐ-40).
- Máy giả lập Android gọi máy chủ phát triển qua `localhost` nhờ `adb reverse` (ngữ cảnh an toàn nên service worker, PWA chạy được) thay cho `10.0.2.2`.
- Thông báo đẩy chưa hỗ trợ trong ứng dụng cài đặt: Web Push không chạy trong WebView; dùng PWA trên trình duyệt (26b).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-236, `23_LICH_SU_PHIEN_BAN.md` 0.164.0; BR-366, P19-11, AC-1027, AC-1028, CT-1320, MH-484, QĐ-40, GD-158.

#### Vấn đề tồn đọng

- Đã dựng và chạy trên máy giả lập Android ngày 2026-10-27 (Eric cho cài JDK, Android SDK, máy giả lập vào ổ D:); iOS Simulator cần máy Mac có Xcode, chưa chạy. Phần còn lại của 26f (đóng gói, đăng nhập gốc, sinh trắc học, liên kết sâu, chọn trường từ danh mục DT-24), gửi đẩy thật của 26g (phần mã đã làm ở YCTD-237) và 26h làm khi có tài khoản.

### 2026-10-27 — DT-27 phần 27d1: khoá học ghi sẵn của chương trình gia sư

#### Công việc đã thực hiện

- Đọc lại mục 19.4, 19.5 (27d) và 20 (28b, 28d) của `32_KE_HOACH_THEO_HE_THONG_SO.md`; 27d dựa trên lõi LMS của 28b và 28d (YCTD-270), 28d chưa gộp.
- Theo đồng ý của phiên điều phối ngày 2026-10-27, tách 27d thành **27d1** (phần riêng của gia sư, chỉ cần 28b, làm ở đây) và **27d2** (tiến độ đã xem, bài đã nộp, điểm cho học sinh, giáo viên, phụ huynh; làm sau khi 28d gộp).
- Năm học `0200` (sau dải 0170 đến 0199 của DT-28 vì khoá ngoại tới `course_spaces` 0172, `course_activities` 0173; dải 0150 đến 0169 của DT-27 chạy trước nên không dùng được; 27d2 không thêm bảng): `tutoring_program_courses`, `tutoring_media_views`.
- Máy chủ `apps/api/src/tutoring/tutoring-courses.ts`: gắn chương trình gia sư với khoá tự chọn của 28b, đồng bộ ghi danh khi duyệt hoặc rút đơn, bài video của khoá, đường dẫn xem ký 5 phút có nhật ký, phát theo đoạn (HTTP Range).
- Giao diện: khối Khoá học ghi sẵn ở chi tiết chương trình (cổng quản trị), khoá học của con (ứng dụng phụ huynh), khoá học gia sư (kênh học sinh); thành phần dùng chung `LessonVideoList`.
- Kiểm thử: CT-27d1-1 đến CT-27d1-3.

#### Quyết định

- Khoá học ghi sẵn là một `course_spaces` loại `elective` của 28b; chương, bài, điều kiện mở, kết quả hoạt động soạn ở Học trực tuyến của 28b; không dựng bảng khoá học thứ hai; không dùng bảng hệ thống 0101 đến 0103 (không còn phần riêng cần dùng qua nhiều năm học).
- Bài video là hoạt động `resource` của khoá trỏ tới học liệu 22h1 là tệp video đã công bố (đi qua kiểm duyệt, giấy phép của 22h1).
- Phát theo đoạn bằng đường dẫn ký 5 phút (khoá băm dữ liệu trẻ của trường), `inline`, không lưu đệm, giao diện không có nút tải; chuyển mã nhiều độ phân giải là tuỳ chọn, mặc định tắt (phát tệp gốc), chưa làm.
- Không đụng tiến độ, bảng điểm hoạt động của 28d; nhật ký xem chỉ ghi lần lấy đường dẫn.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-254, `23_LICH_SU_PHIEN_BAN.md` 0.163.0; BR-350, PQ-145, P02-115, AC-1010, AC-1011, MH-470, MH-471, CT-1295 đến CT-1297.

#### Vấn đề tồn đọng

- 27d2 sau khi 28d gộp; đọc cả tệp video vào bộ nhớ khi phát (chưa phát thẳng từ kho tệp theo đoạn); chuyển mã tuỳ chọn.

### 2026-10-28 — DT-28 phần 28e: giao tiếp trong lớp và nhóm

#### Công việc đã thực hiện

- Làm phần 28e theo `32` mục 20.6, 20.7: một bộ máy thảo luận cho thông báo lớp, diễn đàn, hỏi đáp (lớp học trực tuyến) và bảng tin của không gian học nhóm (nhóm của bộ nhóm 28a):
  - Thông báo lớp tới học sinh, phụ huynh qua hàng đợi thông báo; tin đẩy không có nội dung.
  - Diễn đàn: học sinh mở chủ đề khi giáo viên cho.
  - Hỏi đáp: câu hỏi riêng, hàng chờ câu chưa trả lời (quá 48 giờ là quá hạn), giáo viên xác nhận câu trả lời.
  - Không gian học nhóm: bảng tin, việc chia việc, ghi chú chung có phiên bản, tệp chung.
- An toàn trẻ em:
  - Giáo viên của lớp và người lập bộ nhóm luôn thấy mọi nội dung; không có nhắn riêng giữa hai học sinh.
  - Lọc che số điện thoại, thư điện tử, liên kết, mạng xã hội, từ ngữ của trường (hàm thuần `scanContactInfo` ở `packages/shared`, 27i dùng lại).
  - Giờ mở do trường tự đặt (GD-144 Eric đã chốt 2026-10-28: trường tự cấu hình, mặc định không giới hạn); xóa của học sinh là ẩn, vẫn lưu.
  - Báo cáo vi phạm, hàng chờ của trường có hạn 2 ngày; tạm khóa quyền viết.
- Phụ huynh: thông báo lớp, không gian nhóm của con theo GD-145, lịch học tập của con. Học sinh có lịch học tập tuần (thời khoá biểu, ngày mở, hạn hoạt động; không iCal, GD-157).
- Giao diện:
  - Ứng dụng giáo viên: Thông báo, thảo luận, hỏi đáp.
  - Học sinh `#hoc-sinh`: thảo luận của lớp, nhóm của em, lịch học tập.
  - Phụ huynh: thông báo lớp, nhóm, lịch của con.
  - Cổng quản trị: mục 9.5 An toàn thảo luận (hàng chờ, giờ mở, từ ngữ lọc).
- Kiểm thử: 10/10 ca của `discussion-rules.test.ts`, `discussions.test.ts`; hồi quy `learning`, `assignments`, `progress`, `quick-links`, `school-levels`, `school-plan`, `child-groups`; `migrate.test.ts`; e2e `214-class-discussions` đạt (chạy kèm spec nền 01 đến 09; spec 04 hỏng vì tài khoản trùng tên trong cơ sở dữ liệu định danh riêng của phiên, do môi trường).

#### Quyết định

- Claude chọn theo ủy quyền:
  - Báo cáo vi phạm do bộ lọc từ ngữ tự gửi (`source = filter`); thông tin liên lạc chỉ che, không gửi hàng chờ.
  - Chủ nhiệm (VT-07) có quyền xử lý nhưng máy chủ chỉ cho xem báo cáo của lớp mình; Ban Giám hiệu xem mọi báo cáo.
  - Trường chưa có vai trò người tư vấn tâm lý học đường; trường gán quyền `P02.discussion.moderate` cho vai trò đó ở phân quyền nhóm.
  - Mẫu thông báo mới `class_announcement` (trong ứng dụng) và `class_announcement_push` (đẩy, không nội dung); 28e là phần duy nhất thêm mẫu thông báo.
- Mã khối riêng (BR-340, AC-1000, MH-460, CT-1280, BM-180, PQ-140, P03-28) để không va với các PR đang mở; dòng bảng mới neo vào dòng của 28b như 28c, 28d.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-275, `23_LICH_SU_PHIEN_BAN.md` 0.162.0; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Ảnh trong câu hỏi chưa làm (chỉ chữ); 28g thêm giờ học trực tuyến vào lịch, 28f thêm bài về nhà; báo cáo liên quan con chưa tự thông báo cho phụ huynh THCS, THPT.

### 2026-10-27 — DT-26 phần 26e: bố cục máy tính bảng của cổng quản trị và cổng nền tảng

#### Công việc đã thực hiện

- `packages/ui`: `DataGrid` co giãn theo khổ (từ 768 px bảng cuộn ngang trong khung, cột đầu cố định; dưới 768 px dạng thẻ, cột chính làm tiêu đề, ba cột phụ đầu hiện ngay, các cột còn lại thu vào "Xem thêm"; cột chính khai báo bằng `primary`, không khai báo thì là cột đầu đang hiện); hộp thoại phủ kín màn hình dưới 768 px (`DIALOG_NARROW_FULL_SCREEN_CLASS`, áp cho hộp thoại của gói và ba hộp thoại của cổng quản trị); màu của bộ chủ đề đậm hơn để chữ đạt tương phản 4,5:1.
- Cổng quản trị: dưới 1280 px menu ngang thay bằng ngăn kéo bên trái mở bằng nút "Menu chức năng" (đóng bằng nút Đóng menu, nền mờ, phím Esc, khi chọn trang); dưới 1280 px vùng chạm 44 px, chữ ô nhập 16 px; dải nút Ghi, Hủy của biểu mẫu dính đáy dưới 768 px.
- Cổng nền tảng: từ 1280 px thanh bên đầy đủ; 768 đến 1279 px thanh chỉ còn biểu tượng, tên mục hiện khi rê chuột, đưa bàn phím tới hoặc chạm giữ; dưới 768 px ngăn kéo mở bằng nút ☰; nội dung rộng cuộn ngang trong vùng nội dung; vùng chạm, cỡ chữ ô nhập như cổng quản trị.
- Kiểm thử: e2e spec 184 (bốn khổ thiết bị); gỡ toàn bộ mục còn lại của đường cơ sở 26c (`tests/e2e/device-baseline.json` rỗng), spec 180 không còn cần đường cơ sở.

#### Quyết định

- Cổng quản trị không có thanh bên (từ DT-15 dùng menu ngang nhiều cấp theo mẫu của Sở) nên "thu gọn thành biểu tượng" của đặc tả áp cho cổng nền tảng; cổng quản trị dùng ngăn kéo dưới 1280 px vì menu ngang sổ xuống bằng rê chuột không hợp màn hình chạm và tràn dòng ở máy tính bảng ngang (QĐ-39).
- `DataGrid` chọn dạng bảng hay thẻ bằng `matchMedia` để chỉ dựng một dạng (dựng cả hai rồi ẩn bằng CSS làm mỗi ô có hai bản trong trang, bộ chọn của kiểm thử khớp hai phần tử).
- Đổi màu ngay ở bộ chủ đề chung (`packages/ui/src/theme.css`) thay vì ghi đè trong từng ứng dụng; ứng dụng giáo viên, phụ huynh đã ghi đè cùng giá trị ở 26d nên không đổi.
- Spec 184 tự chạy máy chủ Vite của cổng nền tảng và giả lập API đăng nhập vì môi trường e2e một trường không có cổng nền tảng; không sửa cấu hình Playwright của 26c.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-235, `23_LICH_SU_PHIEN_BAN.md` 0.161.0; BR-313, P19-10, AC-967 đến AC-969, CT-1269 đến CT-1271, MH-424, QĐ-39; màu M-01 đến M-03, M-05, C-03, T-01 đến T-05 ở `15_HE_THONG_THIET_KE.md`.

#### Vấn đề tồn đọng

- Thử trên máy tính bảng thật khi Eric có máy. Màn hình nghiệp vụ tự vẽ bảng (không dùng `DataGrid`) vẫn cuộn ngang trong khung của mình, chưa có dạng thẻ.

### 2026-10-28 — DT-28 phần 28d: tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo

#### Công việc đã thực hiện

- Làm phần 28d theo `32` mục 20.6, 20.7:
  - Tiến độ từng em và cả lớp, theo chương, danh sách cần chú ý, không xếp hạng.
  - Bảng điểm hoạt động (trung bình có trọng số chỉ tham khảo), xuất Excel, PDF.
  - Đưa điểm thường xuyên vào sổ điểm (THCS, THPT) qua `ScoresService.recordActivityScores`, nguồn `activity`.
  - Tiểu học: gợi ý mức đạt môn và nhận xét thường xuyên, giáo viên sửa rồi ghi qua sổ nhận xét của 20c (GD-141).
  - Báo cáo chủ nhiệm, tổ chuyên môn, toàn trường, hoạt động dạy của giáo viên; tóm tắt cho phụ huynh và tóm tắt hằng tuần qua hàng đợi thông báo (bật theo trường).
  - Báo cáo tổng kết dạy học trực tuyến theo học kỳ (Ban Giám hiệu nhập đánh giá, khó khăn, nguyên nhân, kiến nghị), xuất PDF, Excel; hồ sơ dạy học trực tuyến của lớp, môn theo học kỳ.
  - Lượt dùng câu hỏi của bài tập ghi `question_usages` với tỷ lệ đúng.
- Giao diện: ứng dụng giáo viên (Tiến độ và bảng điểm), cổng quản trị mục 9.4 Báo cáo học tập trực tuyến, ứng dụng phụ huynh (sắp đến hạn, nhận xét gần đây).
- Kiểm thử:
  - 12/12 ca của `progress-rules.test.ts`, `progress.test.ts`.
  - Hồi quy đạt: `assignments` (có kiểm `question_usages`), `learning`, `scores`, `assessments`, `settings`, `quick-links`, `exam-grading`, `classroom-games`.
  - `migrate.test.ts` đạt; e2e `213-learning-progress` và `212-online-assignments` đạt (chạy kèm spec nền 01 đến 09; spec 04 hỏng vì tài khoản trùng tên trong cơ sở dữ liệu định danh riêng của phiên, do môi trường).
  - Chạy với cơ sở dữ liệu định danh, hệ thống riêng của phiên.

#### Quyết định

- Claude chọn theo ủy quyền: thêm cửa `spaceAccess` ở cuối `LearningService` (như các cửa của 28c) để 28d không chép quy tắc ai xem lớp học trực tuyến.
- `ScoresService` thêm `recordActivityScores` dùng chung thân với `recordExamScores` (cùng quyền nhập, khoá sổ, hạn của 21c); 28d là phần duy nhất sửa `scores/`.
- Tiểu học ghi qua `AssessmentsService.saveSubject`, `addComment` có sẵn, giữ điểm bài kiểm tra và nhận xét môn đang có của từng em.
- Mã khối riêng (BR-320, AC-980, MH-440, CT-1260, BM-170, P03-23) để không va với các PR đang mở; dòng bảng mới neo vào dòng của 28b như 28c.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-274, `23_LICH_SU_PHIEN_BAN.md` 0.160.0; đặc tả 07, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Báo cáo tổ chuyên môn chưa tính độ phủ kế hoạch theo tuần.
- Tóm tắt hằng tuần chỉ gửi trong ứng dụng (không tin nhắn).
- Mẫu thông báo `learning_weekly_summary` không thêm vào bảng mẫu: mã mẫu là chữ tự do, trường sửa nội dung được ở bảng mẫu riêng. Kế hoạch ghi 28e là phần duy nhất thêm mẫu thông báo mới.

### 2026-10-27 — DT-27 phần 27a: lớp video trực tiếp

#### Công việc đã thực hiện

- Đọc mục 19.2 (phần 3 an toàn trẻ em và ghi hình, phần 4 hạ tầng video), 19.5 (27a), 19.11 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà coturn và cấp máy chủ ICE của 23e, mẫu bộ nối nhà cung cấp (AI của 23d, thông báo đẩy của 26b), giới hạn gói (S5a), việc nền theo trường (S1b), kho tệp, chỗ nối điểm danh `recordRoomEvents` của 27b, kênh student của 23a.
- Thêm bộ nối `VideoRoomProvider` (`livekit` tự host, `livekit-cloud` dự phòng, `mock`; SDK máy chủ `livekit-server-sdk` 2.19.1, giấy phép Apache-2.0), dịch vụ phòng, điểm cuối giáo viên, cha mẹ, học sinh, sự kiện gọi lại có chữ ký, việc nền xóa bản ghi hết hạn.
- Năm học `0160`, `0161` (thay số giữ sẵn 0150, 0151 vì phải chạy sau bảng buổi gia sư 0153 của 27b), nền tảng `0240` (giới hạn phút, dung lượng bản ghi của gói).
- Hồ sơ vận hành: dịch vụ `livekit` (v1.13.7) và `egress` (v1.14.1) ở hồ sơ `video`, TURN dùng chung coturn của 23e, biến LIVEKIT_* không bắt buộc khi tắt video.
- Giao diện: thành phần dùng chung `VideoRoom`, `VideoHostPanel`, `VideoRecordingList` (`livekit-client` 2.22.3) ở `packages/ui`; lớp video của buổi ở cổng quản trị và ứng dụng giáo viên; cha mẹ vào xem và đồng ý ghi hình ở ứng dụng phụ huynh; học sinh vào lớp ở kênh student; cấu hình lớp video của trường; giới hạn video ở trang gói của nền tảng.
- Kiểm thử: CT-27a-1 đến CT-27a-8.

#### Quyết định

- Không rẽ nhánh theo nhà cung cấp trong mã nghiệp vụ; bộ giả lập trả mã vào phòng giả và nhận sự kiện ký bằng khóa giả lập.
- Tên phòng ở máy chủ video có mã trường; sự kiện gọi lại đi qua một địa chỉ chung (đường dẫn không cần trường), trường lấy từ tên phòng.
- Phòng chờ bật mặc định; mã vào phòng dùng để vào trong 10 phút; cha mẹ, Ban Giám hiệu vào xem, nói khi gia sư cho; học sinh chia sẻ màn hình khi được cho.
- Trong trường ghi hình tắt mặc định: chương trình bật ghi hình và mọi học sinh có đơn được duyệt có đồng ý còn hiệu lực của cha mẹ; bản ghi theo `storageKey('video-recordings', …)`, giữ 30 ngày (cấu hình), xem bằng đường dẫn ký 5 phút, không có nút tải, mỗi lần xem ghi nhật ký.
- Bảng trắng tự viết bằng canvas, đồng bộ qua kênh dữ liệu của phòng, không thêm thư viện (GD-137).
- Giới hạn của gói đo từ nhật ký vào ra ở cơ sở dữ liệu của trường; vượt thì không mở phòng mới, không cấp mã vào, không ghi mới.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-251, `23_LICH_SU_PHIEN_BAN.md` 0.159.0; BR-310 đến BR-312, PQ-120, P02-110, P02-111, AC-950 đến AC-952, MH-410 đến MH-414, CT-1250 đến CT-1257.

#### Vấn đề tồn đọng

- Đo băng thông, số nhân của Egress và cú pháp TURN dùng chung của LiveKit trên máy thật (E-05); luật sư kết luận ghi hình (E-06) trước khi bật ở trường thật; bản ghi lớn đọc cả tệp vào bộ nhớ khi phát (chưa có phát theo đoạn); khóa LiveKit ở biến môi trường, chưa có trang lưu mã hóa ở `platform`.

### 2026-10-27 — DT-28 phần 28c: bài tập trực tuyến

#### Công việc đã thực hiện

- Làm phần 28c theo `32` mục 20.6, 20.7: bài tập là loại hoạt động `assignment` của lõi 28b; câu trắc nghiệm từ câu đã duyệt của 22g1 (bản chụp) chấm bằng hàm của 22g2, tự luận, ảnh hoặc tệp PDF, ghi âm, học liệu; phiên bản bài; giao lớp, nhóm, từng học sinh; hạn, nộp muộn, số lần nộp, miễn, đóng bài; bài nhóm do nhóm trưởng nộp, đánh giá đóng góp, điều chỉnh điểm cá nhân có lý do; chấm tay, thang tiêu chí 22h2, mức (Tiểu học); ngân hàng nhận xét (câu của trường 20c và câu của giáo viên); trả bài ghi kết quả hoạt động; trao đổi trên bài; gợi ý nhận xét AI qua 23d chỉ từ đề, thang tiêu chí, điểm đã chấm, ghi chú (GD-142).
- Giao diện: ứng dụng giáo viên (soạn, giao, chấm, trả, gợi ý AI), học sinh ở `#hoc-sinh` (làm, lưu nháp, ảnh vẽ lại để bỏ siêu dữ liệu, ghi âm có giới hạn, nộp, xem nhận xét, trao đổi, đánh giá đóng góp), phụ huynh (xem các lần nộp, điểm, nhận xét của con).
- Kiểm thử: 15/15 ca của `assignment-rules.test.ts`, `assignments.test.ts`; hồi quy 110/110 ca (`quick-links`, `school-plan`, `learning`, `online-exams`, `ai-assistant`, `child-groups`), `database/src/migrate.test.ts` 5/5; e2e `212-online-assignments` chưa chạy được trên máy (cổng của e2e bị tiến trình cũ chiếm), kết quả lấy ở CI. Chạy với cơ sở dữ liệu định danh, hệ thống riêng của phiên.

#### Quyết định

- Claude chọn theo ủy quyền: thêm **cửa công khai** ở cuối `LearningService` của lõi (`teacherActivity`, `studentContext`, `openActivityForChild`, `guardianOrStaff`, `writeResult`) thay vì chép quy tắc quyền của lõi sang 28c; kế hoạch ghi "không sửa lõi của 28b" để tránh va giữa các phần làm song song, đợt 2 làm tuần tự nên chỉ thêm hàm ở cuối lớp, không đổi hàm có sẵn. Mã khối riêng cho 28c (BR-300, AC-960, MH-420, CT-1230, BM-160, PQ-130) để không va với các PR đang mở; người gom đánh lại nếu cần.
- Hai kiểm thử của 28b coi `assignment` là loại chưa đăng ký nay đổi sang `discussion` (28e).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-273, `23_LICH_SU_PHIEN_BAN.md` 0.158.0; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Màn hình soạn phiên bản bài, đích nhóm, từng học sinh và thang tiêu chí ở giao diện chưa làm (máy chủ đã có); nộp thay của phụ huynh, bài về nhà từ sổ đầu bài là 28f; đưa kết quả vào sổ điểm, sổ nhận xét là 28d.

### 2026-10-27 — DT-26 phần 26d: bố cục máy tính bảng của ứng dụng giáo viên và phụ huynh

#### Công việc đã thực hiện

- Ứng dụng giáo viên: màn hình Chế độ lớp học (chọn sẵn lớp của tiết đang dạy theo thời khoá biểu, khung phải điểm danh, sổ đầu bài, công cụ lớp học, trình chiếu toàn màn hình, giữ màn hình sáng); trang chủ hai khung từ 1024 px, danh sách lớp hai cột từ 768 px; màn hình điểm danh, sổ đầu bài, công cụ lớp học có tuỳ chọn nhúng.
- Ứng dụng phụ huynh: trang chủ hai cột từ 768 px. Cả hai ứng dụng: các màn hình nới rộng từ 768 px; vùng chạm 44 px, chữ ô nhập 16 px, màu báo, chữ phụ, liên kết, nút chính đủ tương phản 4,5:1, đặt ở `index.css` của từng ứng dụng, không sửa `packages/ui`.
- Kiểm thử: `apps/teacher` 14/14 (chọn tiết đang dạy, giờ Việt Nam); e2e spec 183 (bốn khổ thiết bị) và spec 180 không còn cần đường cơ sở cho 26d.

#### Quyết định

- Yêu cầu truy cập đặt ở CSS của từng ứng dụng, viết ngoài lớp để thắng lớp tiện ích; màu của bộ chủ đề ghi đè bằng biến trong ứng dụng; `packages/ui` để phần 26e sửa (QĐ-38).
- Giờ Việt Nam tính bằng UTC+7 cố định thay cho `Intl.DateTimeFormat` vì Safari cho kết quả khác.
- Spec 183 giả lập danh sách lớp và thời khoá biểu bằng `page.route` vì việc CI theo khổ thiết bị không có năm học.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-234, `23_LICH_SU_PHIEN_BAN.md` 0.157.0; BR-306, P19-09, AC-945 đến AC-947, CT-1240 đến CT-1242, MH-402, QĐ-38.

#### Vấn đề tồn đọng

- Trò chơi kiến thức (23c) là một công cụ trong Công cụ lớp học nên có sẵn ở thẻ Công cụ lớp học và khi trình chiếu của chế độ lớp học. Thử trên máy tính bảng thật khi Eric có máy.

### 2026-10-27 — DT-27 phần 27c: thu phí và chi trả gia sư trong trường theo quy định

#### Công việc đã thực hiện

- Đọc mục 19.2, 19.4, 19.5 (27c) của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà luồng tính học phí (`fees/fee-calculation.service.ts`, mẫu phí ngoại khóa `activities/extracurricular-fees.ts`), điều chỉnh hóa đơn (`fees/discounts.service.ts`), phiếu chi hoàn, thưởng và khấu trừ của bảng lương (`staff_bonus_deductions`), biểu thuế thu nhập cá nhân, tệp Excel và nhật ký xuất.
- Thêm năm học `0155` (giá của chương trình, dòng `tutoring` trên hóa đơn, buổi đã thu, khoản trừ buổi hủy, phần trừ đã áp) và `0156` (đơn giá thù lao theo tiết, nguồn chi, người dạy buổi, thù lao đã đẩy, khoản mục lương `THU_LAO_DAY_THEM`).
- Thêm hàm thuần `packages/shared/src/tutoring-fees.ts`, phần nối vào lần tính học phí `apps/api/src/tutoring/tutoring-fees.ts`, dịch vụ và điểm cuối thu chi `tutoring-finance.ts`, trang "5. Thu chi gia sư" ở cổng quản trị, ô giá và thù lao ở biểu mẫu chương trình, chọn giáo viên đã dạy khi xác nhận điểm danh, mức thu ở ứng dụng phụ huynh.
- Kiểm thử: CT-27c-1 đến CT-27c-9 (hàm thuần, luồng có cơ sở dữ liệu ở `apps/api`, e2e 192).

#### Quyết định

- Chương trình `curriculum` không có giá và không bật được thu tiền (ràng buộc của bảng, hàm thuần, máy chủ); nguồn chi thù lao luôn là kinh phí của trường; màn hình ghi căn cứ.
- Khoản thu của chương trình `enrichment` có thu là dòng `tutoring` trên hóa đơn chính của kỳ, do lần tính học phí lập (cùng cách phí ngoại khóa): theo buổi thu các buổi chưa hủy từ ngày duyệt đơn đến hết kỳ; trọn gói thu một lần. Thu qua cổng của trường như mọi hóa đơn.
- Buổi đã thu bị hủy thành khoản trừ: mặc định trừ vào khoản gia sư kỳ sau (dòng không âm); kế toán có thể lập điều chỉnh giảm hóa đơn qua luồng điều chỉnh hiện có (chờ duyệt), hoặc đóng sau khi đã hoàn qua phiếu chi hoàn. Buổi đã xác nhận điểm danh không hủy được.
- Thù lao theo tiết của buổi đã dạy (đã xác nhận điểm danh); kế toán đẩy vào bảng lương tháng thành dòng thưởng của khoản mục "Thù lao dạy phụ đạo, bồi dưỡng", chịu thuế thu nhập cá nhân theo biểu thuế sẵn có; bảng lương đã gửi duyệt hoặc đã duyệt thì đẩy vào tháng sau.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-253, `23_LICH_SU_PHIEN_BAN.md` 0.156.0; BR-253 đến BR-255, PQ-112, P02-89, P02-90, AC-901 đến AC-903, MH-362, CT-1146 đến CT-1154.

#### Vấn đề tồn đọng

- Thông tư 29/2024 chưa đối chiếu bản gốc (E-07); hoàn tiền mặt cho buổi đã thu vẫn do kế toán lập phiếu chi hoàn rồi đóng khoản trừ; đơn giá riêng của từng giáo viên có ở API, chưa có ô trên biểu mẫu.

### 2026-10-27 — DT-23 phần 23c: trò chơi kiến thức và thẻ đáp án giấy

#### Công việc đã thực hiện

- Nhận bản dở dang của phiên trước (nhánh `dt-23-phan-23c`, kiểm thử logic ứng dụng giáo viên đạt, kiểm thử API và e2e 152 đã viết nhưng chưa chạy, chưa có tài liệu); gộp origin/main (23e, 26a, 28a, 28b), chạy kiểm thử API, e2e 152, viết tài liệu.
- Cơ sở dữ liệu: năm học `0126`, `0127`. Máy chủ API: nhóm `/classroom-games`. Ứng dụng giáo viên: thẻ Trò chơi trong Công cụ lớp học (hỏi đáp theo vòng, vòng quay, ô chữ, thẻ đáp án giấy in và quét).
- Thêm quy tắc BR-280, chức năng P02-100 đến P02-102, biện pháp BM-140 đến BM-141, màn hình MH-400 đến MH-401, kịch bản CT-1200 đến CT-1204, tiêu chí AC-940 đến AC-944. Kết quả ngày 27/10/2026: kiểm thử đơn vị ứng dụng giáo viên `apps/teacher/src/tools/games/games.test.ts` (CT-23c-1 đến CT-23c-3) và `apps/api/src/classroom-games/classroom-games.test.ts` (CT-23c-4 đến CT-23c-6) đạt; kiểm thử đơn vị toàn kho đạt (bộ 23c, 23e, 23a chạy riêng; toàn bộ để CI chạy); kiểm thử giao diện `tests/e2e/152-classroom-games.spec.ts` (CT-23c-7) đạt cùng 02, 03, 06, 08, 101, 151 (14/14); kiểm tĩnh đa thuê bao, ma trận cách ly, build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Trò chơi chạy trên máy giáo viên, học sinh không cần thiết bị; bộ đọc thẻ đáp án tự viết (không thư viện ngoài, không vấn đề giấy phép); hình quét không rời khỏi máy; điểm trò chơi không vào sổ điểm.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-213, `07_QUY_TAC_NGHIEP_VU.md` BR-280, `10_YEU_CAU_CHUC_NANG.md` P02-100 đến P02-102, `11_TIEU_CHI_NGHIEM_THU.md` AC-940 đến AC-944, `14_DAC_TA_GIAO_DIEN.md` MH-400 đến MH-401, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1200 đến CT-1204, `22_BAO_MAT.md` BM-140 đến BM-141, `23_LICH_SU_PHIEN_BAN.md` 0.155.0.

#### Vấn đề tồn đọng

- Thử đọc thẻ trên nhiều mẫu camera và ánh sáng thật ở lớp; mẫu thẻ in cần thử in thật; ô chữ chỉ sinh từ câu trả lời ngắn.

### 2026-10-27 — Tệp mảnh có mục "Thêm dòng"

#### Công việc đã thực hiện

- Thêm mục `## Thêm dòng` vào `scripts/gom-thay-doi.mjs`: mỗi dòng gồm tệp, neo (ô đầu của dòng đứng trước hoặc `cuối bảng <tiêu đề>`) và dòng bảng mới giữ nguyên văn.
- `--kiem` báo lỗi khi tệp hoặc neo không có, số ô khác bảng, mã dòng mới đã có trong tài liệu hoặc trùng với tệp mảnh khác.
- Khi gom, chèn theo thứ tự merge; nhiều tệp cùng chèn sau một neo thì giữ thứ tự merge.
- Cập nhật `tai_lieu/thay_doi_cho_gom/README.md` (quy tắc 3, mẫu, bảng quy tắc từng phần); thêm ba ca ở `tests/tai-lieu/gom-thay-doi.test.mjs`.

#### Quyết định

- Dòng bảng mới ở tài liệu đặc tả (`07`, `08`, `10`, `11`, `14`, `16`, `17`, `21`…) ghi qua "Thêm dòng" thay vì sửa tại chỗ, vì các PR song song cùng nối cuối một bảng nên xung đột mỗi lần một PR merge (gặp ở PR 196 với PR 185, 192, 197).
- Mục "Nối dòng" giữ nguyên nghĩa: chỉ nối nội dung vào ô cuối của một dòng có sẵn.
- Các PR đang mở (193, 195) giữ dòng tại chỗ, không cần chuyển.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-293.

#### Vấn đề tồn đọng

- Không.

### 2026-10-26 — DT-23 phần 23e: giám thị camera cho thi trực tuyến

#### Công việc đã thực hiện

- Đọc mục 15 của `32_KE_HOACH_THEO_HE_THONG_SO.md` (15.3, 15.4, 15.6 dòng "Học sinh gian lận khi thi ở nhà", GD-106, mục 19 về coturn dùng chung với 27a, GD-132) và mã 23a (`student-exams.ts`, `proctoring.ts`, `ExamRoom.tsx`, kho tệp, bộ lập lịch); viết mục 15.4 "23e".
- Cơ sở dữ liệu: năm học `0129`. Máy chủ API: dịch vụ giám thị (phiên xem trực tiếp, báo hiệu, đồng ý, ghi hình mã hoá, xem lại, dọn quá hạn), cấu hình máy chủ ICE. Ứng dụng phụ huynh: thông báo, bộ trả lời WebRTC, bộ ghi hình, màn hình đồng ý của phụ huynh. Cổng quản trị: lưới camera, đồng ý của cha mẹ, nhật ký người xem, xem lại bản ghi, cấu hình. Hồ sơ vận hành: coturn.
- Thêm quy tắc BR-270, chức năng P02-95 đến P02-98, quyền PQ-115, biện pháp BM-120 đến BM-122, màn hình MH-380 đến MH-382, kịch bản CT-1170 đến CT-1175, tiêu chí AC-920 đến AC-924. Kết quả ngày 26/10/2026: kiểm thử đơn vị `apps/api/src/online-exams/exam-proctoring.test.ts` (CT-23e-1a đến CT-23e-1c) và `online-exams.test.ts` (CT-23e-1 đến CT-23e-4) đạt; kiểm thử đơn vị toàn kho đạt (bộ 23e, 23a, 22g, định danh chạy riêng; toàn bộ để CI chạy); kiểm thử giao diện `tests/e2e/154-online-exam-proctoring.spec.ts` (CT-23e-5) cùng 02, 03, 06, 08, 150 đạt; toàn bộ kiểm thử giao diện để CI chạy toàn bộ; trên máy chạy riêng 02, 03, 06, 08, 101, 102, 103, 150 và 154 (14/14 đạt); kiểm tĩnh đa thuê bao, ma trận cách ly, kiểm thử hai bố cục cơ sở dữ liệu `database` và `schema`, build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 23e theo đề xuất của phiên điều phối (Eric yêu cầu): hình xem trực tiếp đi thẳng giữa hai trình duyệt, không qua máy chủ API (nhẹ tải, ít rủi ro lộ hình); báo hiệu bằng hỏi định kỳ vì máy chủ chưa có kênh web socket; ghi hình do trình duyệt học sinh tải từng đoạn (không dựng máy chủ ghi hình riêng); đồng ý của cha mẹ kiểm cả lúc xem và lúc ghi; mặc định tắt và cần luật sư rà trước khi bật ở trường thật.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-215, `07_QUY_TAC_NGHIEP_VU.md` BR-270, `08_VAI_TRO_NGUOI_DUNG.md` PQ-115, `10_YEU_CAU_CHUC_NANG.md` P02-95 đến P02-98, `11_TIEU_CHI_NGHIEM_THU.md` AC-920 đến AC-924, `14_DAC_TA_GIAO_DIEN.md` MH-380 đến MH-382, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1170 đến CT-1175, `22_BAO_MAT.md` BM-120 đến BM-122, `23_LICH_SU_PHIEN_BAN.md` 0.154.0, `33_HO_SO_PHAP_LY/` PL-13, PL-15.

#### Vấn đề tồn đọng

- Luật sư rà quy định dữ liệu trẻ em, ghi hình và giám sát (PL-15) trước khi bật ở trường thật; thử coturn và thử tải ở môi trường thật; ảnh chụp định kỳ, AI cảnh báo bất thường không làm.

### 2026-10-26 — DT-28 phần 28b: lõi hệ thống quản lý học tập

#### Công việc đã thực hiện

- Làm phần 28b theo `32` mục 20.6, 20.7: lớp học trực tuyến tự sinh từ phân công giảng dạy, khoá tự chọn, khoá học mẫu của tổ qua duyệt hai bước, chương, hoạt động (trang, liên kết, học liệu), điều kiện mở, kết quả hoạt động chung, tiến độ, kế hoạch theo tuần, nhật ký học tập, quyết định dạy học trực tuyến thay thế và nội quy theo Thông tư 09/2021/TT-BGDĐT; cổng quản trị 9.1 đến 9.3, ứng dụng giáo viên, ứng dụng phụ huynh.
- Kiểm thử: 38/38 ca API (`learning.test.ts` có CT-28b-17 học sinh, `learning-rules.test.ts`, `learning-tenancy.test.ts` hai bố cục, `school-plan.test.ts`, `online-exams.test.ts`, `working-level.test.ts`); e2e `211-online-classes` đạt (chạy kèm spec nền 01 đến 09; lần đầu hỏng vì ứng dụng phụ huynh đăng nhập bằng số điện thoại, đã sửa spec), `134-school-plans` đạt ở chế độ nhiều trường. Chạy với CSDL định danh, hệ thống riêng của phần.

#### Quyết định

- Claude chọn theo ủy quyền: phân công giảng dạy là nguồn chính để sinh lớp học trực tuyến, thời khoá biểu là nguồn phụ; đồng bộ khi mở danh sách thay vì móc vào luồng ban hành thời khoá biểu; quy tắc duyệt khoá mẫu viết lại theo đúng quy tắc của 22h1 vì 28b không sửa tệp của 22h1; cách ly kiểm ở mức API cho cả hai bố cục thay vì e2e nhiều trường.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-272, `23_LICH_SU_PHIEN_BAN.md` 0.153.0; đặc tả 07, 08, 10, 11, 12, 14, 16, 17, 21, 22, dòng của phần ở 32, 34.

#### Vấn đề tồn đọng

- Sau khi 23a gộp: thêm học sinh tự học ở kênh `student` (`/student/learning`, quyền `P02.learning.study` cho VT-21, MH-361, CT-1145) trong cùng PR; sửa CI hỏng CT-S5a-8 (quy tắc menu khoá mẫu ghi quyền kho học liệu làm tuyến kho học liệu không còn bị chặn theo gói; tuyến nhân sự `/learning` nay chặn theo gói).

### 2026-10-26 — DT-27 phần 27b: chương trình gia sư trong trường, lịch và đặt buổi, điểm danh

#### Công việc đã thực hiện

- Đọc mục 19.2, 19.3, 19.4, 19.5 (27b), 19.11 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà thời khoá biểu (`timetable_lessons`, `period_slots`, `applyingVersions`), sổ điểm (`subject_term_results`), quan hệ phụ huynh, luồng trao đổi, thông báo, góp ý, phân hệ của gói dịch vụ (S5a), mẫu phần 23a.
- Thêm năm học 0152 đến 0154, định danh 0172, hàm thuần quy định dạy thêm, máy chủ API `tutoring/`, bốn trang ở cổng quản trị, màn hình ở ứng dụng giáo viên, mục Gia sư ở ứng dụng phụ huynh, kiểm thử đơn vị và e2e 191.
- Thêm BR-245 đến BR-247, PQ-110, P02-86 đến P02-88, AC-883 đến AC-885, MH-349 đến MH-354, CT-1130 đến CT-1137; phiên bản 0.152.0.

#### Quyết định

- Quy định dạy thêm là dữ liệu có ngày hiệu lực (`tutoring_rules`); khóa kiểm ở máy chủ bằng hàm thuần dùng chung với giao diện.
- Giới hạn tiết đếm cả chương trình khác cùng môn; kiểm khi xếp buổi và khi duyệt đơn.
- Đơn đăng ký lưu bản chụp văn bản và mã băm; người duyệt là giáo viên chủ nhiệm, giáo viên dạy hoặc Ban Giám hiệu.
- Tin nhắn của chương trình dùng luồng trao đổi giáo viên với cha mẹ hiện có; không có luồng riêng với học sinh.
- Điểm danh tự động là chỗ nối `recordRoomEvents` cho 27a, có điểm cuối giả lập; không dựng video.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-252, `07_QUY_TAC_NGHIEP_VU.md` BR-245 đến BR-247, `08_VAI_TRO_NGUOI_DUNG.md` PQ-110, `10_YEU_CAU_CHUC_NANG.md` P02-86 đến P02-88, `11_TIEU_CHI_NGHIEM_THU.md` AC-883 đến AC-885, `14_DAC_TA_GIAO_DIEN.md` MH-349 đến MH-354, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1130 đến CT-1137; phiên bản 0.152.0.

#### Vấn đề tồn đọng

- Thông tư 29/2024 chưa đối chiếu bản gốc (E-07); điểm danh tự động khi 27a gộp; thu phí, thù lao ở 27c.

### 2026-10-26 — DT-28 phần 28a: mô hình nhóm dùng chung

#### Công việc đã thực hiện

- Đọc mục 20 của `32` (dòng 28a, phạm vi 20.7, ranh giới đợt 1), mã `child-groups/` (4.1.6), `classroom-tools/` và `apps/teacher/src/tools/` (23b), sổ điểm (21c), mức đạt Tiểu học (20c), tiết nhóm và tổ hợp môn (21a, 21b).
- Thêm năm học 0170 (`group_sets`, cột bộ nhóm ở `child_groups`, `role` ở thành viên, `child_group_member_events`) và 0171 (dời `classroom_groupings` sang bộ nhóm `classroom`).
- Viết hàm chia thuần `group-split.ts` (ngẫu nhiên có hạt, trộn năng lực, gom tầng, cân bằng giới, ràng buộc, nhóm trưởng, từ tiết nhóm 21b), dịch vụ và điểm cuối `/group-sets`, hàm đọc ổn định `GroupSetsReader` cho 28b, 28c, 28e; công cụ lớp học 23b đọc, lưu bộ `classroom`; thẻ Chia nhóm thêm Kiểu chia và Dùng bộ nhóm có sẵn.
- Kiểm thử đơn vị CT-28a-1 đến CT-28a-12, e2e spec 210 (CT-28a-13); tài liệu 01, 07, 16, 17, 21, 23, 24, 32, `index.md`.

#### Quyết định

- Claude chọn theo ủy quyền: GD-140 như kế hoạch (điểm trung bình môn học kỳ gần nhất có điểm, chưa đủ điểm thì trung bình cộng điểm đã có; Tiểu học mức đạt môn kỳ gần nhất); nguồn kết quả hoạt động báo lỗi đến khi 28d gộp.
- Bảng `classroom_groupings` của 23b còn được ghi song song một bản phát hành để spec 151, CT-23b-10 và bản ứng dụng cũ đọc được; máy chủ chỉ đọc bộ nhóm. Lưu bản chia không đổi thì giữ bộ cũ (tránh sinh bộ thừa).
- Sau khi 23a (PR 189) gộp: thêm đích `group` cho đề thi trực tuyến; thành viên lúc giao ghi thành dòng học sinh mang `group_id` nguồn để màn hình học sinh, danh sách học sinh của 23a không phải đổi và đổi nhóm sau đó không đổi bài đã giao.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-271, phiên bản 0.151.0.

#### Vấn đề tồn đọng

- Màn hình nhóm của con ở ứng dụng phụ huynh, của học sinh; màn hình bộ nhóm ở cổng quản trị.

### 2026-10-27 — Mở năm học nhanh hơn: chạy tệp thay đổi cấu trúc theo lô (YCTD-292)

#### Công việc đã thực hiện

- Tìm nguyên nhân e2e `02-academic-years.spec.ts` hỏng ở bước mở năm học (chờ quá 30 giây thông báo "Đã mở năm học…", CI của PR 193 và PR 196): mở năm học tạo cơ sở dữ liệu năm học mới rồi chạy toàn bộ tệp thay đổi cấu trúc ngay trong yêu cầu; `migrateToLatest` chạy mỗi tệp một giao dịch bằng `migrateUp()`, mỗi lần Kysely lại kiểm bảng ghi tệp đã chạy, bảng khóa, đọc trạng thái.
- Đo trên máy làm việc ngày 2026-10-27 với 100 tệp năm học: mỗi tệp một giao dịch 40,5 đến 41,3 giây; mọi tệp trong một giao dịch 4,7 giây; theo lô 10 tệp 8,6 giây; theo lô 20 tệp 6,3 giây. Gần 90% thời gian là chi phí lặp của từng lần chạy, không phải câu lệnh tạo bảng.
- Sửa `database/src/migrate.ts`: `migrateToLatest` chạy theo lô, mỗi lô tối đa `MIGRATIONS_PER_TRANSACTION` (10) tệp trong một giao dịch bằng `migrateTo` đến tệp cuối của lô; danh sách tệp chờ đọc một lần. Thêm kiểm thử chạy theo lô (đủ tệp, đúng thứ tự tên, lô cuối thiếu, chạy lại không còn tệp).

#### Quyết định

- Không tăng thời gian chờ của e2e: thời gian thật đã giảm khoảng 4,7 lần, còn khoảng 9 giây ở máy làm việc.
- Chọn lô 10 thay vì một giao dịch hay lô 20: vẫn tránh lỗi "out of shared memory" khi nhiều trường tạo cơ sở dữ liệu cùng lúc (lý do cũ của cách chạy từng tệp), chấp nhận chậm hơn lô 20 khoảng 2 giây.
- Không đổi mở năm học sang việc nền có theo dõi tiến trình: khi chạy nhanh như hiện nay thì chưa cần; ghi ở vấn đề tồn đọng nếu số tệp còn tăng nhiều.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-292, `23_LICH_SU_PHIEN_BAN.md` 0.150.1.

#### Vấn đề tồn đọng

- Nếu số tệp năm học tiếp tục tăng mạnh, cân nhắc dựng sẵn cơ sở dữ liệu mẫu đã chạy tệp ở môi trường vận hành hoặc đưa mở năm học sang việc nền có tiến trình.

### 2026-10-26 — DT-26 phần 26b, phần giao diện: thông báo đẩy trên ứng dụng giáo viên, phụ huynh, học sinh

#### Công việc đã thực hiện

- Service worker dùng chung (`packages/pwa/service-worker.js`) nhận đẩy: hiện thông báo từ tiêu đề, nội dung, nhóm của máy chủ; chạm thông báo đưa ứng dụng đang mở lên trước hoặc mở trang đầu; trình duyệt đổi đăng ký thì báo trang đăng ký lại.
- `packages/pwa/src/push/`: xét trạng thái đẩy của máy, đăng ký, hủy, đồng bộ, thu hồi khi đăng xuất; khối "Cài đặt thông báo" (`PushSettings`, `PushSettingsPanel`) và móc `usePushSync`.
- Nối vào ứng dụng giáo viên (Lớp của tôi), phụ huynh (trang chủ), màn hình học sinh (danh sách bài); đăng xuất ở ba nơi thu hồi đăng ký trước khi xóa phiên.
- Kiểm thử: `packages/pwa` 15/15 (trạng thái đẩy, khóa VAPID, nhãn máy, sự kiện push, notificationclick, pushsubscriptionchange của service worker); e2e spec 187 (giao diện cài đặt thông báo) chạy trên máy cùng phần máy chủ của PR 191.

#### Quyết định

- Kiểm phần nhận đẩy của service worker bằng kiểm thử đơn vị chạy tệp mẫu trong môi trường giả lập của Node: Chromium chạy ẩn của e2e không hiện thông báo hệ thống (đã thử gửi đẩy qua giao thức gỡ lỗi).
- Một phạm vi service worker chỉ có một đăng ký đẩy nên ứng dụng phụ huynh và màn hình học sinh trên cùng máy chỉ một người nhận, người bật sau cùng.
- Ứng dụng giáo viên chỉ có service worker khi trường bật ngoại tuyến (GD-108 giữ nguyên); trường tắt thì khối cài đặt báo chưa sẵn sàng, không tự đăng ký service worker riêng cho đẩy.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-239, `23_LICH_SU_PHIEN_BAN.md` 0.150.0; BR-244, P19-08, AC-891, AC-892, CT-1120, CT-1121, MH-355, BM-104, mục 12H.

#### Vấn đề tồn đọng

- Phụ thuộc phần máy chủ ở PR 191 (YCTD-232): gộp PR 191 trước PR này. Thử đẩy thật trên máy (Android Chrome, iPhone đã cài) khi Eric bật khóa VAPID ở môi trường thử.

### 2026-10-26 — DT-26 phần 26c: khung kiểm thử theo khổ thiết bị

#### Công việc đã thực hiện

- Đọc mục 18 của `32_KE_HOACH_THEO_HE_THONG_SO.md` (26c, ranh giới tệp với 26a, 26b), `tests/playwright.config.ts`, `.github/workflows/ci.yml` sau PR 177.
- `tests/playwright.config.ts`: biến `E2E_DEVICES` (`pr`, `full`); mặc định giữ dự án `chromium` như cũ. Thêm dự án `dien-thoai` (390 × 844), `may-tinh-bang-doc` (820 × 1180), `may-tinh-bang-ngang` (1180 × 820), `dien-thoai-webkit`; nhãn `@thiet-bi`, `@thiet-bi-pr`.
- `tests/e2e/device-checks.ts` (vùng chạm, cỡ chữ ô nhập, cuộn ngang, axe-core, đường cơ sở vi phạm đã biết) và `device-baseline.json`; spec 180 (`180-device-frame.spec.ts`) đo trang đăng nhập của ba ứng dụng và trang chủ cổng quản trị, ảnh chụp tham chiếu bật bằng `E2E_SCREENSHOTS=1` ở Linux.
- `.github/workflows/ci.yml`: việc `kiem-thu-thiet-bi` song song với `kiem-thu-giao-dien` (yêu cầu kéo: một mảnh, hai khổ, Chromium, nhãn `@thiet-bi-pr`; nhánh chính và lịch hằng đêm 19 giờ UTC: bốn dự án, chia hai mảnh, có WebKit); các việc nặng khác bỏ qua khi chạy theo lịch.
- Thêm thư viện kiểm thử `@axe-core/playwright` (axe-core, giấy phép MPL-2.0, chỉ dùng ở kiểm thử).
- Sửa lỗi thật bộ kiểm đo được ở màn đăng nhập phụ huynh (`apps/parent/src/screens/LoginScreen.tsx`): hai liên kết công khai nâng vùng chạm lên 44 px, không ngoại lệ.

#### Quyết định

- Bộ kiểm đã đo ra vi phạm thật ở trang đăng nhập (vùng chạm dưới 44 px, ô nhập 15 px, tương phản màu). Phần 26c không sửa giao diện ngoài liên kết phụ huynh nói trên (phần còn lại thuộc 26d cho ứng dụng giáo viên và phụ huynh, 26e cho cổng quản trị): các vi phạm đó ghi ở `device-baseline.json` kèm phần chịu trách nhiệm; spec chỉ hỏng khi có vi phạm mới ngoài đường cơ sở, xóa khỏi tệp khi đã sửa.
- Ảnh chụp tham chiếu chưa có tệp gốc trong kho (kết xuất khác nhau giữa hệ điều hành): tạo bằng `--update-snapshots` ở Linux của CI rồi đưa vào kho.
- Số phút đo của việc mới ở CI chưa có: ghi vào YCTD-233 sau lần chạy đầu của yêu cầu kéo.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-233, `21_KICH_BAN_KIEM_THU.md` CT-1112 đến CT-1114, `23_LICH_SU_PHIEN_BAN.md` 0.149.0.

#### Vấn đề tồn đọng

- Sửa các vi phạm ở đường cơ sở (26d, 26e); tạo ảnh chụp tham chiếu ở CI; đo thời gian việc `kiem-thu-thiet-bi`.

### 2026-10-26 — DT-26 phần 26b: thông báo đẩy Web Push, phần máy chủ

#### Công việc đã thực hiện

- Đọc mục 18 của `32` (26b), mã hàng đợi thông báo (`queueNotification`, `notification-dispatcher.ts`), khóa theo trường (S1a, S3), bộ lập lịch (S1b).
- Làm phần máy chủ: kênh `push`, bộ nối `PushSender`, đăng ký theo máy, tuỳ chọn theo nhóm, khóa VAPID, điểm cuối API, lệnh dòng lệnh, kiểm thử đơn vị và e2e 182.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: dùng thư viện `web-push` 3.6.7 thay vì tự viết mã hóa RFC 8291; tám nhóm loại ánh xạ theo tiền tố mã loại; loại khẩn lưu ở `notification_urgent_templates`; tối đa 20 máy mỗi người; kênh đẩy chỉ cho người nhận là tài khoản cụ thể ở phần này.
- Phiên điều phối: mở PR phần máy chủ trước, phần giao diện sau khi 26a (PR 185) gộp.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-232, `23_LICH_SU_PHIEN_BAN.md` 0.148.0.

#### Kết quả kiểm thử

- `apps/api`: `notifications/push/push.test.ts` 6/6 (CT-26b-1 đến CT-26b-6); cùng `notification-dispatcher.test.ts`, `integrations.test.ts`, `notifications.test.ts`, ma trận cách ly (`tenancy-matrix.test.ts`, `tenancy.test.ts`): 27/27.
- Kiểm tĩnh đa thuê bao, quét bí mật: đạt. Typecheck, lint, định dạng: đạt.
- e2e nhiều trường (giữ khóa `e2e.lock`): 182 1/1 (CT-26b-7); 130, 131 đạt.

#### Vấn đề tồn đọng

- Giao diện cài đặt thông báo và mã nhận đẩy ở service worker: phiên của 26a làm tiếp sau khi PR này gộp.
- Kênh đẩy cho người nhận theo vai trò (`role_code`): chưa làm.
- Thử trên máy thật (iOS 16.4 trở lên đã cài, Android Chrome): điều kiện ra của đợt 1.

### 2026-10-26 — Đổi quy ước ghi tài liệu chung sang tệp mảnh (YCTD-291)

#### Công việc đã thực hiện

- Các phiên làm song song (DT-23 đến DT-28) mỗi PR đều thêm mục vào `02`, `23`, `24`, bảng mốc phát hành ở `01`, số đếm ở `index.md` và tăng số phiên bản đầu các tài liệu này, nên mỗi lần một PR merge thì mọi PR khác xung đột tài liệu, phải gộp main và chạy lại CI (khoảng 40 phút); `gh pr update-branch` cũng không gộp được.
- Thêm thư mục `tai_lieu/thay_doi_cho_gom/` kèm `README.md` mô tả quy ước và định dạng tệp mảnh; tập lệnh `scripts/gom-thay-doi.mjs` (Node, không thêm gói) có chế độ `--kiem` và chế độ gom; kiểm thử đơn vị `tests/tai-lieu/gom-thay-doi.test.mjs` (chạy trong `pnpm test` của gói `tests`); CI thêm bước `--kiem` và bước cảnh báo PR thường sửa trực tiếp `02`, `23`, `24`, `index.md`.
- Thử gom trên bản sao `tai_lieu` với hai tệp mảnh mẫu: mục 02, 24, 23 chèn đúng chỗ theo thứ tự, phiên bản phần mềm chốt 0.145.0 rồi 0.145.1, dòng 01 chèn trước 1.0.0, số đếm và khoảng mã ở `index.md` đúng, phiên bản đầu tài liệu tăng một lần. Kết quả ngày 26/10/2026: kiểm thử đơn vị `tests/tai-lieu/gom-thay-doi.test.mjs` đạt 5/5; `node scripts/gom-thay-doi.mjs --kiem`, lint, kiểm tra định dạng đạt.

#### Quyết định

- Eric đồng ý ngày 2026-10-26 chuyển sang tệp mảnh theo từng PR, gom định kỳ. Chi tiết (tên thư mục, định dạng, cách đánh số phiên bản khi gom, cảnh báo không chặn) Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- PR này là PR cuối cùng sửa trực tiếp `02`, `24`, `index.md` theo cách cũ. Không tăng phiên bản phần mềm (chỉ đổi quy trình tài liệu và CI).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-291, `thay_doi_cho_gom/README.md`, `01_KE_HOACH_TONG_THE.md` mục 9, `19_CHI_DAN_HE_THONG_AI.md` mục 2, đầu `23_LICH_SU_PHIEN_BAN.md`, `index.md`.

#### Vấn đề tồn đọng

- Các PR đang mở (188, 191, 192, 193) đã sửa trực tiếp tài liệu chung theo cách cũ; phiên điều phối quyết định chuyển phần đó sang tệp mảnh hay để merge như cũ. Lần gom đầu tiên chưa chạy.

### 2026-10-26 — DT-26 phần 26a: vỏ ứng dụng web cài được dùng chung

#### Công việc đã thực hiện

- Tạo gói `packages/pwa`: dời service worker của 23b thành mẫu dùng chung, plugin Vite phục vụ và phát `sw.js` theo tiền tố của từng ứng dụng, thư viện đăng ký, kiểm bản mới, gỡ; `applyBrandedManifest`, `InstallPrompt`, `UpdateBanner`; hàm nhận biết cách cài theo trình duyệt có kiểm thử đơn vị.
- Máy chủ: manifest và biểu tượng SVG theo thương hiệu từng trường (`/api/v1/public/pwa/*`), cột `school_branding.app_short_name` (hệ thống 0090), ô tên ngắn ở cổng quản trị.
- Ứng dụng giáo viên chuyển sang gói chung (giữ tiền tố và công tắc ngoại tuyến của 23b); ứng dụng phụ huynh có manifest, biểu tượng, service worker; lời mời cài ở trang đầu hai ứng dụng.
- Kiểm thử: `packages/pwa` (CT-26a-1), `apps/api` `school-settings.test.ts` (CT-26a-2, CT-26a-3), e2e spec 181 (CT-26a-4) và spec 151.

#### Quyết định

- Viết tay service worker và plugin, không thêm thư viện; biểu tượng là SVG dựng ở máy chủ, PNG của sản phẩm làm dự phòng (QĐ-36).
- Ứng dụng phụ huynh luôn đăng ký service worker (chỉ giữ vỏ ứng dụng); ứng dụng giáo viên vẫn theo công tắc ngoại tuyến của trường.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-231, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.145.0; BR-238, P19-07, AC-880 đến AC-882, CT-1108 đến CT-1111, MH-348, BM-100, QĐ-36, mục 12H.

#### Vấn đề tồn đọng

- Đã nối màn hình học sinh của 23a sau khi 23a gộp (manifest `student` mở thẳng `#hoc-sinh`, lời mời cài và dải "Có bản mới" ở danh sách bài, không hiện trong phòng thi). Còn: ảnh PNG và màn hình chờ iOS theo trường, phiên bản tối thiểu do máy chủ áp để phần sau (ghi ở YCTD-231).

### 2026-10-26 — DT-25 bước 25b: giao diện đăng nhập và liên kết bằng nhà cung cấp định danh

#### Công việc đã thực hiện

- Thành phần dùng chung ở `packages/ui` cho nút đăng nhập, trang quay về `/dang-nhap/ben-ngoai`, mục liên kết tài khoản; nối vào cổng quản trị (điểm gắn của DT-24, Tài khoản của tôi, khối cấu hình ở Danh sách người dùng), ứng dụng giáo viên, ứng dụng phụ huynh.
- e2e spec 165 thêm ca giao diện: liên kết ở Tài khoản của tôi, đăng nhập bằng nút, gỡ liên kết, nút ẩn khi trường tắt. Kết quả trên máy 13/13 cùng spec 01.

#### Quyết định

- Ở tên miền chung (đăng nhập theo đơn vị) không hiện nút: cấu hình, liên kết và lượt đăng nhập theo trường, người dùng mở trang đăng nhập riêng của trường.
- Ứng dụng giáo viên chỉ có nút đăng nhập; giáo viên liên kết ở cổng quản trị. Phụ huynh liên kết ngay trong ứng dụng phụ huynh.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-226, `23_LICH_SU_PHIEN_BAN.md` 0.147.0.

#### Vấn đề tồn đọng

- Hợp đồng và tài liệu kỹ thuật của Trung tâm RAR (việc của Eric).

### 2026-10-26 — DT-23 phần 23a: thi trực tuyến cho học sinh

#### Công việc đã thực hiện

- Đọc mục 15 của `32_KE_HOACH_THEO_HE_THONG_SO.md` (15.3, 15.4 phần 23a, 15.6, GD-105, GD-106); rà kênh đăng nhập, `student_learning_accounts`, ngân hàng câu hỏi và đề (22g1), bài kiểm tra lớp và phiếu chấm (22g2), sổ điểm một cửa.
- Cơ sở dữ liệu: năm học `0120` đến `0123`, định danh `0120`, `0121`. Dịch vụ định danh: kênh `student`, vai trò VT-21, đồng bộ người dùng học sinh khi cấp tài khoản học và thi. Máy chủ API: hàm thuần (xếp câu, hạn nộp, đếm lần rời bài, lượt được tính), lõi chấm và chốt lượt, phía học sinh, phía giáo viên, đánh dấu tuyến học sinh. Cổng quản trị: phân hệ "Thi trực tuyến" (giao đề, theo dõi, cấu hình). Ứng dụng phụ huynh: màn hình học sinh (đăng nhập, mật khẩu mới, danh sách bài, phòng làm bài toàn màn hình có camera).
- Thêm quy tắc BR-237, chức năng P02-82 đến P02-85, quyền PQ-109, biện pháp BM-97 đến BM-99, màn hình MH-342 đến MH-347, kịch bản CT-1097 đến CT-1107, tiêu chí AC-874 đến AC-879. Kết quả ngày 26/10/2026: kiểm thử đơn vị `apps/api/src/online-exams/online-exam-rules.test.ts` (CT-23a-1a đến CT-23a-1h) và `online-exams.test.ts` (CT-23a-2 đến CT-23a-9) đạt; kiểm thử đơn vị toàn kho đạt (lượt đầy đủ 1.441/1.441 trước khi gộp main; sau đó bộ 23a, 22g, tenancy-matrix, định danh đạt); kiểm thử giao diện `tests/e2e/150-online-exams.spec.ts` (CT-23a-10) cùng 02, 03, 07, 58, 101 đạt; toàn bộ kiểm thử giao diện để CI chạy toàn bộ; trên máy chạy riêng 02, 03, 06, 07, 08, 58, 83, 101 và 150 đạt; kiểm tĩnh đa thuê bao, ma trận cách ly, kiểm thử hai bố cục cơ sở dữ liệu `database` và `schema`, build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 23a: học sinh đăng nhập qua kênh riêng, không dùng tài khoản phụ huynh; màn hình học sinh đặt trong ứng dụng phụ huynh (địa chỉ `#hoc-sinh`); đáp án và đồng hồ ở máy chủ; bài nộp đi vào luồng 22g2 (không luồng chuyển điểm thứ hai, giáo viên xác nhận); camera xử lý trên máy bằng mô hình nhỏ đặt cùng ứng dụng, chỉ gửi sự kiện; ảnh chụp định kỳ chưa làm. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-211, `07_QUY_TAC_NGHIEP_VU.md` BR-237, `08_VAI_TRO_NGUOI_DUNG.md` PQ-109, `10_YEU_CAU_CHUC_NANG.md` P02-82 đến P02-85, `11_TIEU_CHI_NGHIEM_THU.md` AC-874 đến AC-879, `14_DAC_TA_GIAO_DIEN.md` MH-342 đến MH-347, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1097 đến CT-1107, `22_BAO_MAT.md` BM-97 đến BM-99, `23_LICH_SU_PHIEN_BAN.md` 0.144.0.

#### Vấn đề tồn đọng

- Ảnh chụp định kỳ (cần văn bản đồng ý của cha mẹ); chuyển điểm cấp Tiểu học; việc nền chốt lượt quá hạn; giao theo nhóm học sinh; luật sư rà quy định dữ liệu trẻ em trước khi bật camera ở trường thật; thử tải khối 400 học sinh.


### 2026-10-26 — Sửa kiểm thử chập chờn (YCTD-290)

#### Công việc đã thực hiện

- Đọc nhật ký và ảnh chụp, vết chạy (trace) của các lượt CI hỏng trên nhánh chính và PR 181, PR 184; tìm nguyên nhân gốc từng ca (xem YCTD-290).
- Tái hiện cuộc đua dựng cơ sở dữ liệu mẫu bằng ba tiến trình cùng lúc trên bản sao mã (tên mẫu riêng, không đụng mẫu đang dùng): mã cũ hỏng 2/5 vòng với `23505`, mã mới 0/10 vòng.
- Sửa `migration-templates.ts` (khóa tư vấn), service worker của ứng dụng giáo viên (tra bộ nhớ đệm bỏ qua `Vary: Origin`), ca CT-22c2-12, thẻ "Nề nếp, thi đua lớp", trợ giúp menu e2e, spec 45, 54, 97, 99, 103, 151 (54 hỏng ở CI của PR 190 cùng nguyên nhân phân trang như 45).
- Chạy lặp 10 lần ba tệp thời khoá biểu, năm học (`--test-concurrency=3` như CI): 24/24 ca đạt cả 10 lần.

#### Quyết định

- Sửa nguyên nhân, không tăng thời gian chờ hay số lần chạy lại, không bỏ kiểm thử.
- Dòng "fetch failed" ở nhật ký CI là của ca cố ý tắt dịch vụ định danh, không cần sửa.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-290. Không tăng phiên bản phần mềm.

### 2026-10-26 — Kế hoạch DT-28: hệ thống quản lý học tập (LMS)

#### Công việc đã thực hiện

- Đọc mục 15, 18, 19 của `32_KE_HOACH_THEO_HE_THONG_SO.md` và mã trên nhánh chính sau PR 179, 180: phân công giảng dạy (`timetable_lessons`, `class_staff_assignments`, tổ chuyên môn của 21a), nhóm học sinh DT-14c, chia nhóm và bảng điểm nhanh của 23b, tiết nhóm 21b, sổ đầu bài, kho học liệu 22h1 (luồng duyệt tổ rồi Ban Giám hiệu), gói chia sẻ 22h2, ngân hàng câu hỏi và hàm chấm 22g1, 22g2, thang tiêu chí, sổ điểm và `ScoresService`, nhận xét Tiểu học, nhắn tin, thông báo; nhánh làm việc chưa gộp của 23a (kênh `student`, `exam_assignment_targets` chỉ có lớp và học sinh) và 23d (`AiProvider`). Toàn kho chưa có khoá học hay bài tập về nhà.
- Tra văn bản ngày 2026-10-26: **đọc toàn văn bản gốc Thông tư 09/2021/TT-BGDĐT** (dạy học trực tuyến; tệp quét ở Cổng thông tin điện tử Chính phủ, dựng ảnh từng trang để đọc) và **bản gốc một phần Thông tư 15/2026/TT-BGDĐT** (Điều lệ trường phổ thông mới, thay Thông tư 28/2020/TT-BGDĐT); Thông tư 22/2021 Điều 6, 7 qua bản đăng lại; Công văn 3977/BGDĐT-GDTH, quy định học 2 buổi/ngày, văn bản sửa Thông tư 09 năm 2025 ghi "chưa xác minh".
- Đối chiếu tính năng công khai của Moodle, Google Classroom, Canvas, K12Online (chỉ trang công khai, không đăng nhập), VNPT E-Learning (chỉ có bài báo); không tìm thấy trang công khai của "Viettel MOET LMS".
- Viết mục 20 của `32` (theo yêu cầu thứ hai của Eric cùng ngày, mở rộng từ bốn tính năng thành LMS): căn cứ, Thông tư 09/2021 ánh xạ vào sản phẩm, đối chiếu LMS và phạm vi chọn, đánh giá chuẩn SCORM 1.2, SCORM 2004, xAPI, cmi5, LTI 1.3, nguyên tắc, mười phần 28a đến 28j trong bốn đợt, phạm vi chi tiết, phương án đã loại, rủi ro, việc Eric phải quyết E-01 đến E-05, giả định GD-140 đến GD-157. Cập nhật mục 19: 27d, 27e của DT-27 xây trên lõi LMS. Thêm đợt DT-28, RR-32 đến RR-36, GD-140 đến GD-157 vào `01`; mục kế hoạch DT-28 ở `34`.

#### Quyết định

- Eric (ngày 2026-10-26): bốn tính năng chia nhóm, học nhóm trực tuyến, bài tập trực tuyến, bài về nhà; sau đó mở rộng thành hệ thống quản lý học tập, bốn tính năng là các phần.
- Eric chốt bốn giả định của DT-28 (ngày 2026-10-26): GD-141 kết quả hoạt động vào sổ cho cả Tiểu học (THCS, THPT vào điểm thường xuyên qua `ScoresService`; Tiểu học làm căn cứ gợi ý nhận xét thường xuyên và mức đạt môn, giáo viên xác nhận, không điểm số; công tắc trường mặc định bật, giáo viên chọn từng hoạt động); GD-142 AI không đọc bài làm (bỏ chế độ gửi bài làm khỏi DT-28); GD-143 quy tắc bài về nhà do trường tự cấu hình, nền tảng không đặt giới hạn mặc định (E-02 thành tuỳ chọn); GD-145 phụ huynh xem không gian nhóm theo cấp như đề xuất.
- Claude chọn theo ủy quyền: tự làm LMS gọn trong School Management (không nhúng Moodle); lớp học trực tuyến tự sinh từ phân công; khoá học mẫu ở cơ sở dữ liệu hệ thống, bản của lớp và kết quả ở năm học; khoá mẫu và học liệu qua luồng duyệt 22h1 (Thông tư 09 Điều 7 khoản 3); một bảng kết quả hoạt động chung; một mô hình nhóm mở rộng `child_groups`; điểm hoạt động chỉ vào điểm thường xuyên qua `ScoresService` khi giáo viên xác nhận; thảo luận, hỏi đáp, không gian nhóm cùng một bộ máy, không tin nhắn riêng giữa học sinh; SCORM 1.2 và 2004 (không trình tự) làm, LTI 1.3, xAPI, cmi5 để sau; huy hiệu tắt mặc định, không bảng xếp hạng; 27d, 27e của DT-27 bắt đầu sau DT-28 đợt 2.
- Số giữ sẵn: YCTD-270 (kế hoạch), YCTD-271 đến YCTD-280, dự phòng đến YCTD-289; năm học 0170 đến 0199, hệ thống 0110 đến 0119, định danh 0180 đến 0189 (nền tảng 0250 đến 0254 chỉ giữ chỗ); e2e `210-` đến `224-`; GD-140 đến GD-157, RR-32 đến RR-36.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-270, `32` mục 19 (dòng 27d, 27e), mục 20 (phiên bản 1.79), `01` (1.72), `34_TONG_HOP_CHUC_NANG_HE_THONG/01_TONG_QUAN_VA_NEN_TANG.md`, `index.md`. Chỉ đổi tài liệu, không tăng phiên bản phần mềm.

#### Vấn đề tồn đọng

- Chờ Eric: luật sư rà theo dõi tiến độ, quan sát nhóm, LTI; chọn trường thử; xác nhận thứ tự 27d, 27e; tuỳ chọn hỏi văn bản bài về nhà và văn bản sửa Thông tư 09 (E-01 đến E-05 ở `32` mục 20.12).
### 2026-10-26 — Vá lỗ hổng phụ thuộc: fast-xml-parser, multer, body-parser

#### Công việc đã thực hiện

- Job quét phụ thuộc (`pnpm audit --prod --audit-level=high`) hỏng vì cảnh báo mới: fast-xml-parser 4.4.1 (critical GHSA-m7jm-9gc2-mpf2, high GHSA-jmr7-xgp7-cmfj) qua `apps/api` > `@aws-sdk/client-s3`; multer 2.4.0 (high GHSA-q7qp-rjg7-q26m) và body-parser 2.3.0 (high GHSA-27r3-jxmh-p828) qua `@nestjs/platform-express`, công bố ngày 23/10/2026.
- Nâng `@aws-sdk/client-s3` từ 3.700.0 lên ^3.1156.0: bản mới không còn dùng fast-xml-parser. `@nestjs/platform-express` bản mới nhất vẫn khóa multer 2.4.0 nên thêm `pnpm.overrides` ở `package.json` gốc: multer ^2.5.0, body-parser ^2.4.0.
- Job `quet-phu-thuoc` còn hỏng ở bước dọn của `actions/setup-node` ("Path Validation Error"): job có `cache: pnpm` nhưng không cài gói, nên khi lockfile đổi (cache trượt) bước lưu cache không thấy thư mục store. Bỏ `cache: pnpm` khỏi job này. Giữ `continue-on-error` của bước audit theo quyết định ở YCTD-201 (báo, không chặn gộp).
- Kết quả: `pnpm audit --prod --audit-level=high` sạch (còn 6 cảnh báo mức trung bình, không chặn CI); typecheck đạt; thử thật kho tệp S3 (SeaweedFS cục bộ) ghi, đọc, xóa theo tiền tố đạt.

#### Quyết định

- Ưu tiên nâng gói gốc; chỉ dùng overrides cho gói mà bản mới nhất của gói gốc vẫn khóa bản có lỗ hổng. Gỡ overrides khi `@nestjs/platform-express` dùng multer từ 2.5.0.

#### Thay đổi

- `apps/api/package.json`, `package.json` (`pnpm.overrides`), `pnpm-lock.yaml`, `.github/workflows/ci.yml` (job `quet-phu-thuoc`). Không đổi mã nguồn, không tăng phiên bản phần mềm.

#### Vấn đề tồn đọng

- Không.

### 2026-10-26 — DT-23 phần 23d: trợ lý AI soạn nháp

#### Công việc đã thực hiện

- Đọc mục 15.2 đến 15.6, GD-102 đến GD-104 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà kho khóa kết nối của trường (S3), gói và giới hạn (S5a), quy tắc tính phí (S5b), ngân hàng câu hỏi (22g1), kho học liệu (22h1).
- Thêm tệp năm học 0128 (cờ `questions.ai_generated`), hệ thống 0071 đến 0073 (`ai_settings`, `ai_requests`, mở `integration_secrets` cho `ai`, cờ ở `learning_resources`), nền tảng 0200 đến 0202 (hạn mức AI của gói, khóa AI nền tảng, `ai_token_usage`, `plan_ai_pricing`, dòng phí `ai`).
- Mã: `apps/api/src/ai-assistant/` (bộ nối `AiProvider`: `anthropic`, `mock`; lời nhắc từ mẫu cố định và bộ quét dữ liệu cá nhân; dịch vụ, điểm cuối `/ai/*`, việc nền `ai-usage-sync`); `database/src/billing/ai-pricing.ts`, `platform-ai.ts`; thành phần AI trong `computeCharges` và `issueInvoice`; dịch vụ định danh `/auth/platform/ai`; cổng quản trị 3.8 Trợ lý AI, nút Soạn nháp bằng AI ở ngân hàng câu hỏi và kho học liệu; cổng nền tảng trang Trợ lý AI và giới hạn AI ở Gói dịch vụ; e2e spec 153.
- Đọc toàn văn Luật Trí tuệ nhân tạo 134/2025/QH15 và viết bản nháp `33_HO_SO_PHAP_LY/22_TRO_LY_AI_SOAN_NHAP.md` (PL-22), bổ sung PL-02, PL-04, PL-05, PL-08, `00_MUC_LUC.md`.
- Thêm quy tắc BR-234 đến BR-236, chức năng P01-86 đến P01-89, màn hình MH-339 đến MH-341, kịch bản CT-1084 đến CT-1096, tiêu chí AC-869 đến AC-873, bảo mật BM-92, quyết định QĐ-35, mục kiến trúc 12G, mục cơ sở dữ liệu 18E.

#### Quyết định

- Nhà cung cấp là bảng tra theo mã (`anthropic` mặc định, `mock` chỉ khi `AI_MOCK=true`, từ chối ở `NODE_ENV=production`); không có `if` theo nhà cung cấp ở mã nghiệp vụ.
- Token miễn phí trừ theo tỷ lệ vào chi phí mọi mô hình; mỗi dòng làm tròn lên theo bước; dòng phí AI không tính vào phí tối thiểu chung của quy tắc; kỳ không dùng AI thì không có dòng AI; gói chưa nhập đơn giá thì cấu hình `platform` chưa dùng được (số tiền để trống theo GD-103).
- Câu hỏi do AI soạn chỉ được duyệt khi đã gửi thẩm định và do người khác duyệt; kế hoạch bài dạy là học liệu nháp riêng tư, nội dung lưu thành tệp Markdown.
- Yêu cầu nhà cung cấp đã trả lời nhưng kết quả không dùng được vẫn tính token (đã tốn); lỗi nhà cung cấp, bị chặn, bị từ chối thì không tính.
- Hạn mức tháng của gói áp cho cả hai cấu hình (cấu hình `school` chỉ để chống lạm dụng, để trống là không giới hạn).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-214, `07_QUY_TAC_NGHIEP_VU.md` BR-234 đến BR-236, `10_YEU_CAU_CHUC_NANG.md` P01-86 đến P01-89, `11_TIEU_CHI_NGHIEM_THU.md` AC-869 đến AC-873, `12_KIEN_TRUC_HE_THONG.md` QĐ-35 và mục 12G, `14_DAC_TA_GIAO_DIEN.md` MH-339 đến MH-341, `16_CO_SO_DU_LIEU.md` mục 18E, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1084 đến CT-1096, `22_BAO_MAT.md` BM-92, `23_LICH_SU_PHIEN_BAN.md` 0.143.0.

#### Vấn đề tồn đọng

- Bản nháp pháp lý PL-22 chờ luật sư của Eric rà (mức rủi ro theo phụ lục Quyết định 33/2026/QĐ-TTg, chuyển dữ liệu ra nước ngoài, tư cách các bên); nhà cung cấp AI, vùng máy chủ và số tiền thu để trống chờ Eric.
- Bộ quét dữ liệu cá nhân so tên đầy đủ (từ hai chữ) và mẫu số, thư điện tử; không bắt được tên viết tắt hoặc thông tin định danh gián tiếp.
### 2026-10-26 — DT-25: bộ nối nhà cung cấp định danh OIDC, sẵn cho VNeID (phần máy chủ)

#### Công việc đã thực hiện

- Đọc báo cáo khảo sát tích hợp VNeID ngày 2026-10-26 (lưu ngoài `tai_lieu/`, mục 5 đến 7) và mã dịch vụ định danh (đăng nhập, xác thực hai lớp S8b, kho khóa S3, nhận diện trường S1a, kiểm tĩnh và ma trận cách ly).
- Viết mục 17 của `32`: căn cứ, nguyên tắc, hai bước 25a (máy chủ) và 25b (giao diện, sau DT-24), thiết kế, quyết định, rủi ro, giả định GD-113 đến GD-115.
- Làm phần máy chủ ở `apps/identity/src/external-identity/`: lớp `IdentityProvider`, bộ nối OIDC chung, hồ sơ `vneid`, khai báo nền tảng bằng biến môi trường, cấu hình của trường, liên kết, gỡ liên kết, đăng nhập, nhập mã hai lớp sau nhà cung cấp, nhật ký; migration định danh 0140; `Infrastructure.scopedCache` cho khóa Redis theo trường.
- Dựng nhà cung cấp OIDC giả lập cục bộ (`MockOidcServer`) cho kiểm thử đơn vị và e2e; spec 165.
- Cập nhật `22` (BM-95, BM-96), `33_HO_SO_PHAP_LY/` PL-02 (Điều 7 khoản 5, Phụ lục A) và PL-05 (mục 2, mục 5) lên S8a-1.1, `34` (bảng cách đăng nhập, mục 9), `01`, `23`, `24`.

#### Quyết định

- Không tự tạo tài khoản từ nhà cung cấp ngoài; người đã có tài khoản tự liên kết sau khi nhập lại mật khẩu và mã hai lớp; lượt liên kết gắn với phiên đã bắt đầu.
- Chỉ lưu subject mã hóa bằng khóa của trường cùng băm có khóa (đổi khóa S3 tự xử lý); không lưu số định danh, căn cước, ngày sinh.
- Nền tảng khai nhà cung cấp bằng biến môi trường; trường bật tắt (mặc định tắt), chọn nhóm vai trò (mặc định trừ học sinh); dưới 14 tuổi bị từ chối; đăng nhập bằng nhà cung cấp ngoài không thay xác thực hai lớp trừ khi trường bật và mức đảm bảo đạt.
- Tham số của RAR chưa công bố nên để cấu hình, danh sách mục "chờ tài liệu RAR" trả ở màn hình cấu hình.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-225, `23_LICH_SU_PHIEN_BAN.md` 0.142.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 17 (phiên bản 1.78).

#### Vấn đề tồn đọng

- Bước 25b (giao diện) chờ PR DT-24 gộp.
- Eric: ký hợp đồng và lấy tài liệu kỹ thuật, môi trường thử của Trung tâm RAR (văn bản gửi RAR đã soạn ở thư mục khảo sát); luật sư rà vai trò của nhà cung cấp định danh trong PL-02, PL-05 trước khi bật ở trường thật.


### 2026-10-26 — DT-24: danh mục đơn vị toàn quốc, đăng nhập theo đơn vị, quyền quản trị nền tảng

#### Công việc đã thực hiện

- Đọc báo cáo của ba phiên khảo sát (lưu ngoài kho mã), mã S1a, S1b, S2, S3, S4, S6, S8b; đếm thử bản khảo sát bằng bộ đọc mới (không in dữ liệu): 39.658 đơn vị nhập được, 11 dòng loại vì mã trùng khuôn số căn cước, 4.333 mã không chuẩn, 314 tên rỗng, 366 thiếu phường xã; nhập thử vào cơ sở dữ liệu tạm 16 giây, nhập lại 3 giây, rồi xóa cơ sở dữ liệu tạm.
- Viết mục 16 của `32` (kế hoạch DT-24) và làm trọn mã trong cùng một PR: danh mục, công cụ nhập, trang đăng nhập theo đơn vị, chuyển phiên, quyền vào mọi trường của quản trị nền tảng, trang Danh mục đơn vị của cổng nền tảng; sửa PL-02 (Điều 5a).

#### Quyết định

- Eric quyết định ngày 2026-10-26: quản trị nền tảng vào mọi trường mặc định không cần trường đồng ý, bắt buộc xác thực hai lớp, lý do, nhật ký, có hạn, biểu ngữ, chính sách cấu hình được; không commit dữ liệu thu thập; không dùng quốc huy, tên của Bộ.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: một PR; đăng nhập ở tên miền chung chuyển phiên bằng mã một lần lưu ở cơ sở dữ liệu định danh của trường; danh sách ô chọn không đánh dấu đơn vị đã dùng nền tảng; nhập lại mã xác thực hai lớp ngay lúc mở phiên không cần đồng ý; ứng dụng giáo viên, phụ huynh không đổi (màn hình đăng nhập riêng).

#### Thay đổi

- Tệp: xem YCTD-220 ở `24_YEU_CAU_THAY_DOI.md`. Phiên bản 0.141.0 (0.140.0 là của 23b, gộp trước).

#### Kết quả kiểm thử

- `database`: `school-catalog.test.ts` 5/5 (CT-24-1 đến CT-24-4).
- `apps/identity`: `directory/unit-directory.test.ts` 4/4 (CT-24-5 đến CT-24-8), `platform/support-sessions.test.ts` 4/4 (CT-S4-1 đến CT-S4-4, không sửa kỳ vọng), `tenancy-matrix.test.ts` 4/4.
- `tests/trial/edge-worker.test.mjs`: đạt (sửa kỳ vọng ca tên miền hệ thống theo hành vi mới).
- Typecheck, lint, định dạng: đạt.
- e2e nhiều trường (bố cục `database`, giữ khóa `e2e.lock`): 160 2/2 (CT-24-9, CT-24-10); 130, 131, 133, 134, 135, 136, 137, 138, 139, 140 đạt; 132 đạt sau khi đổi nhãn ô lý do ở khung truy cập của cổng nền tảng (nhãn cũ trùng chuỗi con với ô "Lý do" mà spec 132 dùng). e2e một trường (CSDL định danh riêng của phiên): 01-login 8/8, 59-portal-shell-login 5/5; 02, 03 hỏng ở bước mở năm học vượt 30 giây do máy đang chạy nhiều phiên (không liên quan đăng nhập), để CI chạy lại.

#### Vấn đề tồn đọng

- Luật sư rà PL-02 Điều 5a trước khi nhận dữ liệu thật (GD-110); quyền dùng lại danh mục lấy từ trang công khai (GD-109); tên sản phẩm cho tiêu đề trang đăng nhập (GD-111).
- Đăng nhập theo đơn vị cho ứng dụng giáo viên, phụ huynh: chưa làm, chờ Eric cần.
### 2026-10-26 — Kế hoạch DT-27: nền tảng gia sư trực tuyến

#### Công việc đã thực hiện

- Đọc mục 13 đến 15 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, `33_HO_SO_PHAP_LY/`, `34_TONG_HOP_CHUC_NANG_HE_THONG/`; đối chiếu mã trên nhánh chính: thời khoá biểu và phân công, điểm danh, học phí và cổng thanh toán theo trường (S3), bảng lương có biểu thuế, thu phí nền tảng (S5b), nhắn tin, kiến trúc đa thuê bao (mỗi trường một bộ cơ sở dữ liệu, `platform` dùng chung). Xem dải số các phiên DT-24, DT-25 đang dùng để không va.
- Tra văn bản ngày 2026-10-26: **đọc toàn văn bản gốc Thông tư 19/2026/TT-BGDĐT** (sửa Thông tư 29/2024, hiệu lực 15/05/2026; tệp quét ở Cổng thông tin điện tử Chính phủ); Thông tư 29/2024, Nghị định 52/2024, Thông tư 40/2024, Nghị định 117/2025, Luật Thương mại điện tử 122/2025 chỉ đọc được qua nguồn thứ cấp, ghi "chưa xác minh"; giá LiveKit Cloud, Cloudflare Realtime từ trang chính thức.
- Viết mục 19 của `32`: căn cứ pháp lý và ràng buộc sản phẩm, ước lượng băng thông video, nguyên tắc, chín phần 27a đến 27i trong bốn đợt, phạm vi chi tiết, phương án đã loại, rủi ro, việc Eric phải quyết E-01 đến E-10, giả định GD-130 đến GD-138.
- Thêm danh sách hồ sơ pháp lý PL-16 đến PL-21 vào `33_HO_SO_PHAP_LY/16_DANH_SACH_HO_SO_GIA_SU.md`; thêm đợt DT-27, RR-28 đến RR-31, GD-130 đến GD-138 vào `01`; mục kế hoạch DT-27 ở `34`.

#### Quyết định

- Eric (ngày 2026-10-26): làm cả gia sư trong trường (trước) và chợ gia sư mở (sau); cả ba hình thức học (video trực tiếp, khoá học ghi sẵn, hỏi đáp có gợi ý AI nháp); thu phí qua nền tảng có hoàn tiền và tranh chấp.
- Claude chọn theo ủy quyền: trong trường tiền vào thẳng tài khoản của trường, thù lao qua bảng lương; dạy thêm thuộc chương trình môn học trong trường khóa cứng "không thu tiền" (Thông tư 29/2024); chợ mở giữ và chia tiền qua tổ chức có giấy phép trung gian thanh toán (phương án A) hoặc trả thẳng gia sư (phương án B), không để tiền học vào tài khoản nền tảng; video LiveKit tự host, bộ nối đổi được; chợ dùng cơ sở dữ liệu `marketplace` và ứng dụng `apps/market` mới.
- Số giữ sẵn: YCTD-250 (kế hoạch), YCTD-251 đến YCTD-259, dự phòng đến YCTD-264; năm học 0150 đến 0169, hệ thống 0100 đến 0109, định danh 0170 đến 0179, nền tảng 0240 đến 0249, `marketplace` từ 0001; e2e `190-` đến `204-`. Dải đặt sau dải của DT-26 (PR 178); bản đầu của PR dùng YCTD-240, trùng DT-26, nên sau khi gộp nhánh chính đã đánh lại toàn bộ (YCTD, migration, e2e, GD, RR).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-250, `32` mục 19 (phiên bản 1.76), `01` (1.69), `33_HO_SO_PHAP_LY/00_MUC_LUC.md`, `33_HO_SO_PHAP_LY/16_DANH_SACH_HO_SO_GIA_SU.md`, `34_TONG_HOP_CHUC_NANG_HE_THONG/01_TONG_QUAN_VA_NEN_TANG.md`, `index.md`. Chỉ đổi tài liệu, không tăng phiên bản phần mềm.

#### Vấn đề tồn đọng

- Chờ Eric: tỷ lệ hoa hồng, chọn tổ chức thanh toán có phép, pháp nhân vận hành chợ, báo giá VPS, luật sư rà (E-01 đến E-10 ở `32` mục 19.10).
- Mục 16, 17 của `32` để cho DT-24, DT-25; mục 18 là DT-26 (đã gộp).

### 2026-10-26 — DT-23 phần 23b: công cụ lớp học trên ứng dụng giáo viên

#### Công việc đã thực hiện

- Đọc mục 15.3, 15.4 (23b), 15.6, GD-108 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà `ConductService` (DT-21), `ChildScope` của điểm danh, cấu hình trường (`settings`), đăng nhập và `api-client` của ứng dụng giáo viên, lớp hạ tầng kiểm tĩnh đa thuê bao.
- Thêm tệp năm học 0124 (`classroom_call_logs`, `classroom_groupings`) và 0125 (`classroom_score_events`); mô-đun `apps/api/src/classroom-tools` (cấu hình, danh sách lớp gọn, lượt gọi, bản chia nhóm, dòng điểm chống trùng, chuyển vào nề nếp có xác nhận); hai mục cấu hình trường `classroom_offline_enabled`, `classroom_roster_ttl_hours`.
- Ứng dụng giáo viên: màn hình Công cụ lớp học (gọi tên, chia nhóm, đồng hồ, bảng điểm nhanh), service worker `public/sw.js`, manifest, biểu tượng, bản chụp danh sách lớp gọn có hạn, hàng đợi đồng bộ, chế độ `offline` của phiên; `vite.config.ts` đặt phiên bản bộ nhớ đệm theo bản phát hành; thêm `test` cho `apps/teacher`.
- Thêm quy tắc BR-231 đến BR-233, chức năng P03-09 đến P03-11, màn hình MH-337, MH-338, kịch bản CT-1078 đến CT-1083, tiêu chí AC-864 đến AC-868, bảo mật BM-91, QĐ-34, mục kiến trúc 12G, mục cơ sở dữ liệu 18E.
- Gộp `origin/main` (PR 176) vào nhánh, không rebase; đánh số tài liệu theo nhánh chính lúc gộp.

#### Quyết định

- Máy giáo viên bốc ngẫu nhiên và giữ đồng hồ; máy chủ chỉ cấp danh sách lớp thật, ghi lượt gọi, dòng điểm và chuyển nề nếp (mọi dòng có `client_id` để gửi lại không trùng).
- Bảng điểm nhanh là nháp của giáo viên; vào `conduct_entries` chỉ khi chọn tiêu chí cùng chiều với tổng điểm và xác nhận, tổng đổi thành số lần của tiêu chí, dòng điểm giữ chỗ trước để không chuyển đôi.
- Service worker mạng trước, bộ nhớ đệm sau, không giữ `/api/`; dữ liệu ngoại tuyến là bản chụp gọn (số thứ tự, họ tên, mã, cờ vắng) có hạn 24 giờ mặc định và hàng đợi; đăng xuất, phiên hết hạn, trường tắt ngoại tuyến xóa hết.
- Không thêm quyền, không đổi kênh đăng nhập (`access-token.ts` của 23a), không sửa `MULTI_TENANT_SPEC`; đăng ký mô-đun thêm cuối `application.module.ts`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-212, `07_QUY_TAC_NGHIEP_VU.md` BR-231 đến BR-233, `10_YEU_CAU_CHUC_NANG.md` P03-09 đến P03-11, `11_TIEU_CHI_NGHIEM_THU.md` AC-864 đến AC-868, `12_KIEN_TRUC_HE_THONG.md` QĐ-34 và mục 12G, `14_DAC_TA_GIAO_DIEN.md` MH-337, MH-338, `16_CO_SO_DU_LIEU.md` mục 18E, `17_DAC_TA_API.md` nhóm `/classroom-tools`, `21_KICH_BAN_KIEM_THU.md` CT-1078 đến CT-1083, `22_BAO_MAT.md` BM-91, `23_LICH_SU_PHIEN_BAN.md` 0.140.0, `index.md`.
- Kết quả kiểm thử ngày 26/10/2026: `apps/teacher` 10/10 (`node --test`, CT-23b-1 đến CT-23b-4); `apps/api` 9/9 ca của `classroom-tools.test.ts` (CT-23b-5 đến CT-23b-13) và ma trận cách ly mọi tuyến 5/5; `database` 103/103 (tệp 0124, 0125 chạy ở cả hai bố cục `database`, `schema`); kiểm tĩnh đa thuê bao và quét bí mật đạt; `pnpm lint` đạt; typecheck, build `apps/teacher`, `apps/api` đạt; e2e spec 151 đạt (CT-23b-14) trên bố cục `database` sau chuỗi spec 02 đến 08; spec 121 (ứng dụng giáo viên) đạt, spec 09 trên máy phát triển hỏng ở bước tải tệp lên kho tệp (không liên quan phần này, CI chạy lại toàn bộ)

#### Vấn đề tồn đọng

- Tiếng báo hết giờ không vang khi màn hình tắt và trình duyệt tạm dừng trang (đồng hồ vẫn đúng); chưa có đồng bộ nền khi ứng dụng đóng (Background Sync).
- Phần 23c (trò chơi) dùng lại nhóm, bảng điểm và vỏ ngoại tuyến của phần này.

### 2026-10-26 — Kế hoạch DT-26: PWA, máy tính bảng, ứng dụng di động

#### Công việc đã thực hiện

- Đối chiếu mã trên nhánh chính sau PR 177: `apps/teacher`, `apps/parent` (React 19, Vite, Tailwind 4, bố cục một cột, chưa có manifest, service worker, thông báo đẩy), thương hiệu trường của S3, hàng đợi thông báo chung (`queueNotification`, `notification-dispatch`, kênh `in_app`, `sms`, `zalo`), `packages/ui` (`DataGrid`, `FormLayout`), cấu hình Playwright (một dự án `chromium`) và các việc CI sau PR 177. Đọc phần đang làm song song: service worker, manifest của 23b; kênh `student` và màn hình học sinh của 23a; số migration DT-24, DT-25 đang dùng trên nhánh làm việc.
- Viết mục 18 của `32`: căn cứ, nguyên tắc, tám phần 26a đến 26h chạy ba đợt (PWA, máy tính bảng, ứng dụng cài đặt), phạm vi chi tiết, quyết định thiết kế và phương án đã loại, rủi ro, quy ước, tiến độ, giả định GD-120 đến GD-127, việc Eric phải làm; đánh dấu cập nhật ở 14.6, 15.5.
- Thêm đợt DT-26, RR-25 đến RR-27, GD-120 đến GD-127 vào `01`; thêm mục 6 kế hoạch DT-26 vào `34` tệp 01.

#### Quyết định

- Eric (ngày 2026-10-26) yêu cầu làm theo thứ tự PWA, bố cục máy tính bảng, ứng dụng cài đặt iOS và Android; ứng dụng di động không còn là phương án đã loại của 14.6, 15.5.
- Claude chọn (theo ủy quyền ngày 2026-10-11): đóng gói mã web bằng Capacitor, một ứng dụng có chọn vai trò, học sinh dùng PWA; thông báo đẩy là kênh `push` của hàng đợi chung với bộ nối Web Push, FCM, APNs; nội dung đẩy không có dữ liệu cá nhân; kiểm thử thiết bị ở việc CI riêng, yêu cầu kéo chạy tập con.
- Số giữ sẵn: YCTD-230 (kế hoạch) và YCTD-231 đến YCTD-238, dự phòng đến YCTD-244; hệ thống từ 0090, năm học từ 0140, định danh từ 0160, nền tảng từ 0230; e2e từ `180-`; chừa khoảng trống cho DT-24, DT-25.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-230, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 18 (phiên bản 1.75), `01_KE_HOACH_TONG_THE.md` (1.68), `34_TONG_HOP_CHUC_NANG_HE_THONG/01_TONG_QUAN_VA_NEN_TANG.md`, `index.md`. Chỉ đổi tài liệu, không tăng phiên bản phần mềm.

#### Vấn đề tồn đọng

- Còn chờ Eric: tên ứng dụng, mã gói (GD-120), một hay hai ứng dụng (GD-121), pháp nhân và hai tài khoản nhà phát triển (Apple 99 USD mỗi năm, Google Play 25 USD một lần, GD-124), các khóa cho secrets, luật sư rà hồ sơ quyền riêng tư trước khi nộp.
- Mục 16, 17 của `32` và số giữ sẵn của DT-24, DT-25 chưa có trên nhánh chính; phiên điều phối kiểm lại dải số DT-26 khi giao phần.

### 2026-10-26 — Kế hoạch DT-23: thi trực tuyến, công cụ lớp học, trò chơi kiến thức, trợ lý AI

#### Công việc đã thực hiện

- Đọc báo cáo khảo sát hệ thống dạy học trực tuyến của bên khác (lưu ngoài `tai_lieu/`), mục 13 và 14 của `32_KE_HOACH_THEO_HE_THONG_SO.md` làm khuôn; đối chiếu mã: ngân hàng câu hỏi và đề (22g1), phiên thi và chuyển điểm (22g2), tài khoản học và thi, `SessionChannel`, ứng dụng giáo viên và phụ huynh (chưa có service worker), nề nếp (DT-21), gói và bộ nối khóa theo trường (S5a, S3).
- Viết mục 15 của `32`: căn cứ, nguyên tắc, bốn phần 23a đến 23d, phạm vi chi tiết, quyết định thiết kế, rủi ro, quy ước, tiến độ, giả định GD-102 đến GD-108; sửa các chỗ "không dùng AI" của mục 9.2, 13.1, 13.5, 13.7 và bản tổng hợp `34` theo quyết định mới.
- Thêm đợt DT-23 và RR-19, RR-20, GD-102 đến GD-108 vào `01`.

#### Quyết định

- Eric (ngày 2026-10-26) chọn đề xuất 1, 2, 3, 5 của báo cáo khảo sát; chỉ học ý tưởng tính năng, không sao chép nội dung, tên gọi, giao diện; đồng ý đưa AI vào (thành phần AI của DT-22 giữ chỗ YCTD-185 chuyển thành phần 23d).
- Bốn phần: 23a thi trực tuyến (kênh `student`), 23b công cụ lớp học (ngoại tuyến), 23c trò chơi và thẻ đáp án giấy, 23d trợ lý AI; đợt 1: 23a, 23b, 23d; đợt 2: 23c.
- Số giữ sẵn: YCTD-210 (kế hoạch) và YCTD-211 đến YCTD-214, dự phòng đến YCTD-219; năm học từ 0120, hệ thống từ 0070, định danh từ 0120, nền tảng từ 0200; e2e từ `150-`; số giữ chỗ cũ của DT-22 cho AI hết hiệu lực.
- Eric chốt thêm cùng ngày: chống gian lận khi thi trực tuyến bằng khóa toàn màn hình và camera (GD-106); Claude chọn cách làm: camera xử lý trên máy học sinh, chỉ gửi sự kiện, không gửi hình hay video, ảnh định kỳ tắt mặc định và chỉ bật khi cha mẹ đồng ý; số tiền phí AI để trống, nhập khi triển khai.
- Eric trả lời câu hỏi ngày 2026-10-26: AI có cả hai cấu hình (trường tự nhập khóa miễn phí; nền tảng giữ khóa, thu theo gói và theo token, có màn hình thiết lập riêng); học sinh tự đăng nhập ở mọi cấp học; ngoại tuyến chỉ cho công cụ lớp học. 23d phụ thuộc thêm S5b, dùng nền tảng 0200 đến 0202.
- AI: bộ nối cấu hình được (mặc định Claude), khóa theo trường lưu mã hóa, tắt mặc định, chỉ gửi nội dung chương trình, luôn là bản nháp qua luồng duyệt, hạn mức theo gói; ràng buộc pháp lý để 23d đọc văn bản gốc.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-210, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 15 (phiên bản 1.74), `01_KE_HOACH_TONG_THE.md` (1.67), `34_TONG_HOP_CHUC_NANG_HE_THONG/01_TONG_QUAN_VA_NEN_TANG.md`, `index.md`. Chỉ đổi tài liệu, không tăng phiên bản phần mềm.

#### Vấn đề tồn đọng

- Còn chờ Eric: số tiền của phí AI (GD-103) khi triển khai 23d; 23d đọc văn bản pháp luật gốc và nhờ luật sư của Eric rà trước khi bật AI ở trường thật.

### 2026-10-26 — DT-SaaS phần S6: đơn vị cấp trên

#### Công việc đã thực hiện

- Đọc mục 14.3, 14.5 (S6), 14.9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà phiên hỗ trợ của S4, xác thực hai lớp của S8b, danh mục hành chính TP.HCM sẵn có (DT-15 phần 15h1), báo cáo, EMIS hiện có làm đầu vào bản chụp.
- Thêm tệp nền tảng 0090 (`admin_units`, `parent_org_users` và xác thực hai lớp, `school_aggregate_consents`, `aggregate_snapshots`, `parent_org_access_requests`, cột `schools.admin_unit_id`, phiên hỗ trợ của cấp trên); hàm dùng chung `database/src/parent-org.ts`; dịch vụ định danh: quản lý cây, tài khoản, đăng nhập cấp trên, đề nghị xem chi tiết; máy chủ API: việc định kỳ `aggregate-snapshots`, đồng ý của trường, số liệu và xuất tệp cho cấp trên; cổng nền tảng: menu Đơn vị cấp trên, trang `/cap-tren`; cổng quản trị: Chia sẻ số liệu cấp trên (4.6); e2e spec 139.
- Thêm quy tắc BR-228 đến BR-230, chức năng P01-82 đến P01-85, màn hình MH-334 đến MH-336, kịch bản CT-1069 đến CT-1077, tiêu chí AC-860 đến AC-863, bảo mật BM-90, QĐ-33, mục kiến trúc 12F, mục cơ sở dữ liệu 18D.

#### Quyết định

- Cấp trên chỉ đọc bản chụp tổng hợp trên cơ sở dữ liệu nền tảng, không truy vấn cơ sở dữ liệu của trường; đồng ý theo cấp và nhóm, ẩn nhóm nhỏ (ngưỡng 5, giả định).
- Bằng chứng đồng ý lưu ở cơ sở dữ liệu nền tảng (mỗi lần bật một dòng, rút ghi người, thời điểm); không dùng tệp định danh 0103, hệ thống 0055 đã giữ dự phòng.
- Trang của cấp trên đặt ở cổng nền tảng (`/cap-tren`), không thêm ứng dụng mới; số liệu ở máy chủ API dưới đường dẫn không cần trường, chỉ phục vụ ở tên miền cổng.
- Bộ nút mặc định lấy từ danh mục hành chính TP.HCM đã có trong kho (văn bản chính thức); tỉnh, thành khác nạp bằng danh sách sau khi đọc văn bản gốc.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-202, `07_QUY_TAC_NGHIEP_VU.md` BR-228 đến BR-230, `10_YEU_CAU_CHUC_NANG.md` P01-82 đến P01-85, `11_TIEU_CHI_NGHIEM_THU.md` AC-860 đến AC-863, `12_KIEN_TRUC_HE_THONG.md` QĐ-33 và mục 12F, `14_DAC_TA_GIAO_DIEN.md` MH-334 đến MH-336, `16_CO_SO_DU_LIEU.md` mục 18D, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1069 đến CT-1077, `22_BAO_MAT.md` BM-90, `23_LICH_SU_PHIEN_BAN.md` 0.139.0.

#### Vấn đề tồn đọng

- Danh mục hành chính toàn quốc ngoài TP.HCM chưa nạp; ngưỡng ẩn nhóm nhỏ chờ Eric chốt; chưa có biểu đồ theo thời gian.
- Thi đua khối, cụm và cấp Phòng, Sở (22d), đánh giá ngoài (22f), nối hệ thống của Bộ, Sở làm bằng YCTD riêng như kế hoạch.

### 2026-10-25 — DT-SaaS phần S4: bảng điều khiển nền tảng

#### Công việc đã thực hiện

- Đọc mục 14.3, 14.5 (S4) của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà đăng nhập thay của 18h (`ImpersonationService`, `ImpersonationInterceptor`), bộ lập lịch của S1b, gói và giới hạn của S5a, cổng nền tảng của S1a, S2.
- Thêm tệp nền tảng 0060 (`school_metrics`, `school_error_counts`, `maintenance_notices`, `support_sessions`, `support_session_actions`), tệp hệ thống 0053 (`support_access_grants`); việc định kỳ `school-metrics`; bộ gom lỗi 5xx theo trường ở máy chủ API và dịch vụ định danh; trang Bảng điều khiển, Bảo trì và khối Phiên hỗ trợ ở cổng nền tảng; trang Cho phép hỗ trợ, trang `/support-login`, biểu ngữ bảo trì và phiên hỗ trợ ở cổng; biểu ngữ bảo trì ở ứng dụng giáo viên, phụ huynh; e2e spec 136.
- Thêm quy tắc BR-225 đến BR-227, chức năng P01-78 đến P01-81, màn hình MH-330 đến MH-333, kịch bản CT-1060 đến CT-1068, tiêu chí AC-856 đến AC-859, bảo mật BM-89, QĐ-32; bảng ở `16` mục 18A, giao kèo ở `17`; phiên bản 0.138.0.

#### Quyết định

- Số liệu thu bằng bộ lập lịch mỗi giờ (chỉ đếm, đo dung lượng, tên tệp thay đổi cấu trúc), bảng điều khiển chỉ đọc lần thu mới nhất, không mở cơ sở dữ liệu của từng trường khi xem.
- Đăng nhập hỗ trợ dùng tài khoản hỗ trợ riêng của mỗi trường (`ho-tro-nen-tang`, vai trò Hiệu trưởng, không đăng nhập bằng mật khẩu) thay vì đăng nhập thay một người dùng thật, để nhật ký của trường phân biệt rõ thao tác của nhà cung cấp (QĐ-32).
- Đồng ý của trường lưu ở cơ sở dữ liệu hệ thống của trường (bằng chứng đi theo dữ liệu của trường); phiên và thao tác ghi ở cơ sở dữ liệu nền tảng.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-197, `07_QUY_TAC_NGHIEP_VU.md` BR-225 đến BR-227, `10_YEU_CAU_CHUC_NANG.md` P01-78 đến P01-81, `11_TIEU_CHI_NGHIEM_THU.md` AC-856 đến AC-859, `12_KIEN_TRUC_HE_THONG.md` QĐ-32, `14_DAC_TA_GIAO_DIEN.md` MH-330 đến MH-333, `16_CO_SO_DU_LIEU.md` mục 18A, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1060 đến CT-1068, `22_BAO_MAT.md` BM-89; phiên bản phần mềm 0.138.0.

#### Vấn đề tồn đọng

- Chưa có biểu đồ theo thời gian (số liệu giữ 30 ngày, bảng điều khiển hiện lần thu mới nhất và số lỗi 1 giờ, 24 giờ); kết quả diễn tập khôi phục của S7b chưa hiện ở bảng điều khiển (chờ S7b gộp).
- Cảnh báo chỉ hiện trên bảng điều khiển, chưa gửi ra ngoài (email, Zalo); gửi cảnh báo thuộc giám sát của S7a.

### 2026-10-25 — DT-SaaS phần S5b: thu phí tự động

#### Công việc đã thực hiện

- Đọc mục 14.3, 14.5 (S5b), 14.9, 14.11 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà bộ nối cổng thanh toán (`payment-gateway.ts`, `payment-providers.ts`), kho khóa của S3 (`integration_secrets`, `tenant-connectors.ts`), bộ lập lịch theo trường của S1b, hàng đợi thông báo, gói và chuyển trạng thái của S5a.
- Thêm tệp nền tảng 0050 (chín bảng thu phí), quyền `P01.billing.manage` (tệp định danh 0105), thư viện `database/src/billing` (hàm tính phí, kỳ, chốt kỳ, hóa đơn, tiền vào, điều chỉnh, nhắc hạn, hóa đơn điện tử, khóa cổng của nền tảng), việc nền `billing-cycle`, điểm cuối của trường và điểm nhận tiền vào của nền tảng ở máy chủ API, nhóm `/auth/platform/billing` ở dịch vụ định danh, trang Thu phí ở cổng nền tảng, trang Hóa đơn dịch vụ ở cổng, e2e spec 135.
- Thêm BR-222 đến BR-224, PQ-107, P01-75 đến P01-77, AC-853 đến AC-855, MH-328, MH-329, CT-1049 đến CT-1059, BM-88, bảng ở `16` mục 18A, giao kèo ở `17`; phiên bản 0.137.0.

#### Quyết định

- Thu sau theo kỳ lịch; `schools.paid_until` là hạn đang chờ trả, trả đủ thì dời tới hạn của hóa đơn kỳ sau; bộ chuyển trạng thái của S5a dùng nguyên.
- Khóa cổng thanh toán của nền tảng lưu như kho khóa của S3 nhưng bằng khóa gốc của nền tảng (không thuộc trường nào), ở cơ sở dữ liệu nền tảng.
- Điểm nhận tiền vào của nền tảng đi qua đường dẫn không cần trường; chỉ PayOS, SePay, Casso (VNPay làm sau).
- Việc nền thu phí chạy theo từng trường trong ngữ cảnh của trường (cần cơ sở dữ liệu của trường để đếm học sinh), gọi luôn hàm chuyển trạng thái của S5a cho trường đó.
- Quyền mới dùng tệp định danh `0105` (dải định danh của DT-SaaS, kho mã bật allowUnorderedMigrations).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-196, `07_QUY_TAC_NGHIEP_VU.md` BR-222 đến BR-224, `08_VAI_TRO_NGUOI_DUNG.md` PQ-107, `10_YEU_CAU_CHUC_NANG.md` P01-75 đến P01-77, `11_TIEU_CHI_NGHIEM_THU.md` AC-853 đến AC-855, `14_DAC_TA_GIAO_DIEN.md` MH-328, MH-329, `16_CO_SO_DU_LIEU.md` mục 18A, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1049 đến CT-1059, `22_BAO_MAT.md` BM-88; phiên bản phần mềm 0.137.0.

#### Vấn đề tồn đọng

- Tài khoản nhận tiền và khóa cổng thật của nền tảng (GD-95), nhà cung cấp hóa đơn điện tử chưa chốt; VNPay cho thu phí của nền tảng, nhắc qua email làm sau; S4 dùng `receivables`, `listInvoices` cho bảng điều khiển.

### 2026-10-25 — DT-SaaS phần S8b: bảo mật mã

#### Công việc đã thực hiện

- Đọc mục 14.3, 14.5 (S8b), 14.9, 14.11 (GD-97) của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà đăng nhập của dịch vụ định danh, cơ chế hết hạn mật khẩu (DT-15), đăng nhập vận hành nền tảng (S1a), công cụ đổi khóa (S3), tiêu đề ở Caddy, quy trình CI.
- Thêm xác thực hai lớp, chính sách theo trường, tiêu đề bảo mật, cookie `__Secure-`, khóa ký hai pha, quét bí mật và thành phần phụ thuộc, danh sách kiểm ASVS.
- Thêm quy tắc BR-219 đến BR-221, chức năng P01-71 đến P01-74, màn hình MH-325 đến MH-327, kịch bản CT-1043 đến CT-1048, tiêu chí AC-849 đến AC-852, bảo mật BM-84 đến BM-87, QĐ-31.

#### Quyết định

- Giữ quyết định YCTD-31: xác thực hai lớp của người dùng trường chỉ tuỳ chọn, mặc định tắt (GD-97); bắt buộc chỉ cho tài khoản vận hành nền tảng.
- Tài khoản vận hành nhận khóa TOTP qua lệnh dòng lệnh khi tạo hoặc cấp lại (không có màn hình đăng ký) vì do Eric tạo trực tiếp; chưa đăng ký khóa thì không đăng nhập được.
- Chính sách theo trường đặt ở `identity_settings` (nơi dịch vụ định danh đọc) thay vì hệ thống 0054; khóa TOTP người dùng đặt cột `*_encrypted` có cột `id` để công cụ đổi khóa của S3 tự tìm thấy.
- Không thêm thư viện TOTP, tự cài RFC 6238 và kiểm bằng vectơ thử của RFC.
- Quét thành phần phụ thuộc đặt `continue-on-error` để không chặn gộp vì lỗ hổng ở thư viện bên thứ ba; quét bí mật chặn thật.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-201, `07_QUY_TAC_NGHIEP_VU.md` BR-219 đến BR-221, `10_YEU_CAU_CHUC_NANG.md` P01-71 đến P01-74, `11_TIEU_CHI_NGHIEM_THU.md` AC-849 đến AC-852

#### Vấn đề tồn đọng

- Kiểm thử xâm nhập bên ngoài chờ Eric thuê; xác thực hai lớp cho ứng dụng phụ huynh và bắt buộc cho quản trị trường chưa làm; e2e toàn bộ do CI chạy

### 2026-10-25 — DT-SaaS phần S7b: vận hành nhiều trường

#### Công việc đã thực hiện

- Đọc mục 14.3, 14.5 (S7b), 14.9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà `deploy/scripts/backup.sh`, `restore.sh`, hồ sơ vận hành của S7a và bộ chép dữ liệu của `platform relayout` (S9).
- Thêm bảng nền tảng `backup_runs` (tệp `0070_create_backup_runs`), bộ đọc và nạp dữ liệu dùng chung `school-data-copy.ts`, sao lưu và khôi phục theo trường `school-backup.ts`, chuyển cụm `school-cluster-move.ts`, năm lệnh mới của `platform` (`backup-school`, `verify-backup`, `restore-school`, `restore-drill`, `move-school`).
- Nối sao lưu theo trường vào `deploy/scripts/backup.sh`; thêm `restore-drill.sh`, lịch diễn tập hằng tháng; ảnh `docker/postgres-walg`, lớp phủ `compose.pitr.yml`, `scripts/pitr-extract-school.sh`, `PITR.md` ở hồ sơ vận hành; mục 7 và `github-actions-backup.yml.example` ở hồ sơ thử nghiệm.
- Cổng nền tảng hiện bảng "Sao lưu và khôi phục" ở chi tiết trường (20 lần gần nhất của `backup_runs`).
- Thêm quy tắc BR-217, BR-218, chức năng P01-68 đến P01-70, tiêu chí AC-845 đến AC-848, kịch bản CT-1035 đến CT-1042, bảo mật BM-83, QĐ-30, mục kiến trúc 12E.

#### Quyết định

- Sao lưu logic viết bằng Node thay cho `pg_dump`: chạy được ở cả bố cục `database` và `schema`, qua bộ gom kết nối của Neon, Supabase, không phụ thuộc phiên bản công cụ của máy chủ; mỗi trường một tệp `.sbak` mã hóa AES-256-GCM.
- Nạp dữ liệu bằng vai trò của trường, mỗi bảng một giao dịch: lần thử nạp cả cơ sở dữ liệu năm học trong một giao dịch gặp lỗi "out of shared memory" (giới hạn khóa `max_locks_per_transaction` 64); khóa ngoại gỡ trước, gắn lại sau cùng có kiểm. `platform relayout` (S9) chuyển sang cùng bộ nạp nên không còn cần quyền siêu người dùng ở đích.
- Khôi phục về một thời điểm của cả cụm bằng WAL-G (ghim phiên bản v3.0.9 và mã băm), lấy riêng một trường từ bản khôi phục tạm bằng `backup-school` đọc ở máy chủ tạm (`BACKUP_SOURCE_HOST`).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-199, `07_QUY_TAC_NGHIEP_VU.md` BR-217, BR-218, `10_YEU_CAU_CHUC_NANG.md` P01-68 đến P01-70, `11_TIEU_CHI_NGHIEM_THU.md` AC-845 đến AC-848, `12_KIEN_TRUC_HE_THONG.md` mục 12E và QĐ-30, `14_DAC_TA_GIAO_DIEN.md` MH-318, `16_CO_SO_DU_LIEU.md` mục 18C, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1035 đến CT-1042, `22_BAO_MAT.md` BM-83, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.135.0.

#### Vấn đề tồn đọng

- Chưa làm thử tải nhiều trường (50 trường giả) của kế hoạch; bảng điều khiển S4 chưa cảnh báo sao lưu, diễn tập quá hạn (dữ liệu đã có ở `backup_runs`); WAL-G, `pitr-extract-school.sh` và diễn tập trên staging chờ VPS thử để kiểm tay.
### 2026-10-25 — DT-SaaS phần S5a: gói dịch vụ và giới hạn

#### Công việc đã thực hiện

- Đọc mục 14.3, 14.5 (S5a), 14.9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà menu cổng (`PORTAL_WORKSPACES`, `MENU_PERMISSION_RULES`), `AuthenticationGuard`, các chỗ thêm trẻ (duyệt hồ sơ, nhập Excel, nhập CSDL của Bộ), cấp học, tải tệp, ngữ cảnh trường của S1a.
- Thêm gói dịch vụ (tệp nền tảng 0040), phân hệ theo gói, giới hạn, trạng thái trường và chế độ chỉ đọc, hàm chuyển trạng thái theo hạn cùng lệnh `platform plan-lifecycle`, `GET /school-plan`, trang Gói dịch vụ ở cổng nền tảng, dải báo và lọc menu ở cổng, e2e spec 134.
- Thêm quy tắc BR-214 đến BR-216, chức năng P01-65 đến P01-67, màn hình MH-323, MH-324, kịch bản CT-1027 đến CT-1034, tiêu chí AC-842 đến AC-844, bảng nền tảng ở `16` mục 18A, giao kèo ở `17`; phiên bản 0.134.0.

#### Quyết định

- Phân hệ của gói là phân hệ của menu cổng, `system` luôn bật; quyền gắn phân hệ suy từ luật menu (một nơi), không thêm bảng ánh xạ.
- Gộp phân hệ và giới hạn vào `plans`, gán gói ở `school_plans` có ngày hiệu lực (kế hoạch dự kiến `plan_modules`, `plan_limits`, `school_subscriptions`); cột tính phí (`pricing_mode` mặc định `per_student`, đơn giá, mức tối thiểu, giá theo phân hệ, kỳ thu) chừa sẵn cho S5b.
- Trường chưa gán gói không bị giới hạn; trường đã chỉ đọc hoặc tạm ngưng không tự mở lại khi gia hạn, người vận hành mở ở cổng nền tảng.
- Ở chế độ chỉ đọc vẫn cho đăng nhập, xuất dữ liệu, xem gói và nhóm `/billing` của S5b.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-194, `07_QUY_TAC_NGHIEP_VU.md` BR-214 đến BR-216, `10_YEU_CAU_CHUC_NANG.md` P01-65 đến P01-67, `11_TIEU_CHI_NGHIEM_THU.md` AC-842 đến AC-844, `14_DAC_TA_GIAO_DIEN.md` MH-323, MH-324, `16_CO_SO_DU_LIEU.md` mục 18A, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1027 đến CT-1034; phiên bản phần mềm 0.134.0.

#### Vấn đề tồn đọng

- Chưa nối `applyPlanLifecycle` vào bộ lập lịch của S1b (bộ lập lịch chạy việc theo từng trường, còn chuyển trạng thái chạy cho cả nền tảng): trước mắt chạy bằng lệnh `platform plan-lifecycle` hoặc nút ở cổng nền tảng; nhắc hạn hiện ở cổng của trường (S4 thêm ở bảng điều khiển); thu tiền, gia hạn tự động ở S5b.
- Khi gộp với S2: trường khởi tạo ở trạng thái dùng thử được đặt `trial_ends_on` theo `plan_lifecycle.default_trial_days` (mặc định 30 ngày) ở bước kích hoạt, nếu chưa đặt. Ở `24` dòng số giữ sẵn của YCTD-190 ghi S3 194, S5a 195, khác bảng ở `32` mục 14.10 (S5a 194, S3 195); phần này theo bảng ở `32` và lời giao việc.

### 2026-10-25 — DT-SaaS phần S3: cấu hình riêng từng trường

#### Công việc đã thực hiện

- Đọc mục 14.3, 14.5 (S3), 14.9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà nơi đọc khóa tích hợp (thanh toán, eSMS, Zalo, Facebook, kho tệp) ở `application.module.ts`, `ApiConfiguration`.
- Thêm `integration_secrets`, `school_branding`, `school_key_rotations`, lớp `SchoolSettings` và bộ nối theo trường, màn hình quản trị, công cụ đổi khóa và bọc lại khóa gốc.
- Thêm quy tắc BR-211 đến BR-213, chức năng P01-62 đến P01-64, màn hình MH-321, MH-322, kịch bản CT-1022 đến CT-1026, tiêu chí AC-839 đến AC-841, bảo mật BM-81, BM-82, QĐ-29.

#### Quyết định

- Giá trị kết nối lưu một đối tượng JSON mã hóa bằng khóa mã hóa của trường (cùng khóa với dữ liệu trẻ) nên đổi khóa dữ liệu trẻ mã hóa lại luôn cả cấu hình kết nối.
- Đổi khóa chỉ khi trường tạm dừng, tự tìm cột `*_encrypted` có cột `id` ở `information_schema` để không bỏ sót bảng thêm sau.
- Chế độ nhiều trường không rơi về biến môi trường; bộ giả lập đặt ở cấu hình máy chủ vẫn dùng được để các kiểm thử hiện có không đổi.
- Biểu trưng dùng lại ảnh biểu trưng của website trường thay vì thêm đường tải mới; thương hiệu chỉ thêm tên hiển thị và màu.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-195, `07_QUY_TAC_NGHIEP_VU.md` BR-211 đến BR-213, `10_YEU_CAU_CHUC_NANG.md` P01-62 đến P01-64, `11_TIEU_CHI_NGHIEM_THU.md` AC-839 đến AC-841

#### Vấn đề tồn đọng

- Kiểm tra kết nối thật cho cổng thanh toán, tên sản phẩm lấy từ cấu hình nền tảng, chuyển biến môi trường hiện có thành cấu hình của trường số 1 chưa làm; e2e toàn bộ do CI chạy

### 2026-10-25 — DT-SaaS phần S9: triển khai thử nghiệm miễn phí

#### Công việc đã thực hiện

- Đọc mục 14.3, 14.4, 14.5 (phần S9), 14.11 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, PL-00, PL-08, PL-09 của `33_HO_SO_PHAP_LY/`, Caddy và hồ sơ vận hành của S7a; tra trang chính thức của Render, Koyeb, Neon, Supabase, Cloudflare (R2, Workers, Cron Triggers, Cloudflare for SaaS, custom hostname), Vercel (Hobby, Routing Middleware, thêm tên miền) ngày 2026-10-25.
- Thêm tệp nền tảng `0100_add_database_login_name`; bộ nối `DB_HOST_ADAPTER` (`plain`, `neon`, `supabase`); bộ nối tên miền `cloudflare-saas`, `vercel-domains`; chính sách `PLATFORM_DATA_POLICY`; lệnh `platform relayout`; kho khóa trong bộ nhớ của dịch vụ định danh (`REDIS_URL=memory://`); `SMS_ALLOW_LOG`; `APP_BASE_PATH` cho ba ứng dụng; hồ sơ `deploy/profiles/trial/` (cổng biên Cloudflare Worker, container gộp, ba tổ hợp, Vercel 3a, 3b, công cụ chuyển); ảnh `trial` ở CI; spec e2e 140.
- Thêm quy tắc BR-209, BR-210, chức năng P01-59 đến P01-61, màn hình MH-320, kịch bản CT-1014 đến CT-1021, tiêu chí AC-835 đến AC-838, bảo mật BM-79, BM-80, QĐ-28, mục 12D của `12`, giao kèo ở `17`, cột mới ở `16` mục 18A; phiên bản 0.132.0.

#### Quyết định

- Hồ sơ thử nghiệm dùng cùng mã nguồn và ảnh với hồ sơ vận hành, chọn mọi khác biệt bằng biến cấu hình của nền tảng; không rẽ nhánh trong mã nghiệp vụ.
- Máy chủ có địa chỉ công khai nên nhận trường từ tiêu đề do cổng biên đặt kèm bí mật (`TENANT_HOST_SOURCE=header:x-school-host`, `EDGE_SHARED_SECRET`).
- Không dùng Redis; dịch vụ định danh dùng kho trong bộ nhớ, chỉ đúng với một bản container.
- Trường dữ liệu thật chỉ khi đủ hồ sơ theo PL-00 (`PLATFORM_DATA_POLICY=consent-required` mặc định của hồ sơ này, không nhận loại `production`); chuyển sang VPS trong nước bằng `platform relayout` rồi mới đổi sang `production`.
- Chi tiết, bảng giới hạn gói miễn phí và các điểm chưa làm ghi ở YCTD-203.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-203, `07_QUY_TAC_NGHIEP_VU.md` BR-209, BR-210, `10_YEU_CAU_CHUC_NANG.md` P01-59 đến P01-61, `11_TIEU_CHI_NGHIEM_THU.md` AC-835 đến AC-838, `14_DAC_TA_GIAO_DIEN.md` MH-320, `16_CO_SO_DU_LIEU.md` mục 18A, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1014 đến CT-1021, `22_BAO_MAT.md` BM-79, BM-80, `12_KIEN_TRUC_HE_THONG.md` mục 12D, QĐ-28; phiên bản phần mềm 0.132.0.

#### Vấn đề tồn đọng

- Chưa dựng thật trên Render, Koyeb, Neon, Supabase, Cloudflare, Vercel (cần tài khoản của Eric); dung lượng thật của một trường đo khi dựng. Cách 3b cần kiểm khả năng thêm tiêu đề trước khi dùng. `INTEGRATIONS_MODE` và cấu hình riêng từng trường làm ở S3; tự xóa trường dữ liệu giả chưa làm; rà thêm trường dữ liệu cần mã hóa ở S3, S8b.

### 2026-10-25 — DT-SaaS phần S2: khởi tạo và vòng đời trường

#### Công việc đã thực hiện

- Đọc mục 14.3, 14.4, 14.5 (phần S2), 14.7, 14.9 của `32_KE_HOACH_THEO_HE_THONG_SO.md` và PL-00 của `33_HO_SO_PHAP_LY/`; rà `provisionSchool`, `SchoolDatabaseLayout`, `TenantRegistry`, `migrateToLatest`, đăng nhập vận hành nền tảng, khung `apps/platform`, gói xuất dữ liệu của 18h, cấu hình e2e nhiều trường.
- Thêm tệp nền tảng `0020_create_school_lifecycle`, `0021_add_domain_verification`, `0022_create_school_consents` và tệp hệ thống `0050_create_terms_acceptances`; thư viện `database/src/school-lifecycle.ts` (bước setup, tiến trình khởi tạo có bước, hoàn tác, tạm dừng, mở lại, yêu cầu xóa, hủy xóa, xóa vĩnh viễn, hồ sơ đồng ý, vùng máy chủ, đổi loại dữ liệu, lời mời kích hoạt, migrate cuốn chiếu), `domain-provider.ts` (`dns-check`), `lifecycle-environment.ts`; mười một lệnh mới của `platform`; điểm cuối `/api/v1/auth/platform/schools…` và `/api/v1/auth/activate` ở dịch vụ định danh; trang Trường ở cổng nền tảng; trang Kích hoạt ở cổng quản trị; lệnh `school-lifecycle-command` (xuất, xóa vĩnh viễn kèm tệp) và `FileStorage.deletePrefix` ở máy chủ API; spec e2e 132.
- Thêm quy tắc BR-206 đến BR-208, quyền PQ-106, chức năng P01-54 đến P01-58, màn hình MH-316 đến MH-319, kịch bản CT-1004 đến CT-1013, tiêu chí AC-830 đến AC-834, bảo mật BM-77, BM-78, QĐ-27, bảng ở `16` mục 18A, giao kèo ở `17`, mục 12C của `12`; phiên bản 0.131.0.

#### Quyết định

- Tên miền mặc định của trường là `<mã trường>.<tên miền hệ thống>` (`PLATFORM_ROOT_DOMAIN`), dùng ngay; tên miền riêng do người vận hành cấu hình tay, chờ kiểm tra DNS (CNAME về `PLATFORM_INGRESS_HOST` và bản ghi TXT `_school-verify.<tên miền>`) qua bộ nối `DomainProvider` (`dns-check`; `cloudflare-saas`, `vercel-domains` là của S9) theo quyết định của Eric.
- Điểm cuối quản lý trường đặt dưới `/api/v1/auth/platform/schools` của dịch vụ định danh (nhóm không cần trường, đã có xác thực vận hành và quyền tạo cơ sở dữ liệu), không thêm dịch vụ mới.
- Quản trị viên đầu tiên (Hiệu trưởng, VT-02) tạo với mã băm của mật khẩu ngẫu nhiên đã bỏ; nhận đường liên kết kích hoạt một lần hạn 72 giờ, chỉ lưu mã băm SHA-256; không gửi mật khẩu qua kênh nào.
- Bằng chứng đồng ý dùng dữ liệu thật ghi ở `school_consents` và `school_hosting` theo PL-00 của S8a; chỉ lưu mã băm SHA-256 và khóa tệp của bản quét.
- Xóa vĩnh viễn giữ hàng của trường ở trạng thái `deleted` kèm bản ghi chứng minh đã xóa (mã băm tên, danh sách cơ sở dữ liệu, số tệp); thời gian chờ mặc định 30 ngày (`SCHOOL_DELETION_GRACE_DAYS`, giả định).
- Không đụng mã việc nền theo trường của S1b và gói, giới hạn của S5a.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-193, `07_QUY_TAC_NGHIEP_VU.md` BR-206 đến BR-208, `08_VAI_TRO_NGUOI_DUNG.md` PQ-106, `10_YEU_CAU_CHUC_NANG.md` P01-54 đến P01-58, `11_TIEU_CHI_NGHIEM_THU.md` AC-830 đến AC-834, `14_DAC_TA_GIAO_DIEN.md` MH-316 đến MH-319, `16_CO_SO_DU_LIEU.md` mục 18A, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-1004 đến CT-1013, `22_BAO_MAT.md` BM-77, BM-78, `12_KIEN_TRUC_HE_THONG.md` mục 12C, QĐ-27; phiên bản phần mềm 0.131.0.

#### Vấn đề tồn đọng

- Xóa vĩnh viễn và migrate cuốn chiếu chạy bằng lệnh theo lịch, chưa có bộ lập lịch của nền tảng (S1b); bản sao lưu của trường xóa theo thời hạn lưu ở S7b; bộ nối tên miền `cloudflare-saas`, `vercel-domains` làm ở S9; máy chủ API khác thấy trạng thái trường mới đổi sau `TENANT_CACHE_SECONDS`; xác thực hai lớp của tài khoản vận hành làm ở S8b.
### 2026-10-25 — DT-SaaS phần S1b: nền đa thuê bao, phần chạy nền và công khai

#### Công việc đã thực hiện

- Đọc mục 14.3, 14.5 (S1b), 14.7, 14.9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà năm lớp việc nền, hàng đợi máy xếp và tiến trình `apps/worker`, `domain-check`, các bộ giới hạn tần suất công khai, bốn chỗ khóa Redis của dịch vụ định danh (đã đúng tiền tố từ S1a).
- Thêm bộ lập lịch theo trường, điểm tick ngoài, hàng đợi máy xếp theo trường kèm hạn mức, domain-check theo danh mục tên miền nền tảng, trang chọn trường, giới hạn tần suất theo trường, bộ đệm ngữ cảnh trường, bảng `scheduler_state` (tệp nền tảng 0010).
- Thêm quy tắc BR-203 đến BR-205, chức năng P01-51 đến P01-53, màn hình MH-315, kịch bản CT-999 đến CT-1003, tiêu chí AC-827 đến AC-829, bảo mật BM-76, QĐ-26.

#### Quyết định

- Việc đến hạn tính từ dấu thời gian ở cơ sở dữ liệu nền tảng (chiếm nguyên tử), không đếm số lần gọi: đúng với nhiều bản máy chủ và với máy chủ ngủ.
- Việc khởi động của tiến trình (đăng ký biểu EMIS) là loại `perProcess`: kết quả chỉ nằm trong bộ nhớ của tiến trình nên không chiếm qua cơ sở dữ liệu.
- Tên biến theo kế hoạch: `SCHEDULER_MODE=external` và `INTERNAL_JOB_TOKEN`; thêm `SCHEDULER_INTERVAL_SECONDS`, `SCHEDULER_CONCURRENCY`, `TIMETABLE_MAX_ACTIVE_RUNS`, `PLATFORM_ROOT_DOMAIN`.
- Trang chọn trường là điểm cuối nhận mã trường (không liệt kê trường) vì danh sách khách hàng không được lộ ra công khai.
- Không sửa khởi tạo trường (S2) và gói, giới hạn (S5a); hạn mức máy xếp là số cấu hình tạm để S5a thay.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-192, `07_QUY_TAC_NGHIEP_VU.md` BR-203 đến BR-205, `10_YEU_CAU_CHUC_NANG.md` P01-51 đến P01-53, `11_TIEU_CHI_NGHIEM_THU.md` AC-827 đến AC-829

#### Vấn đề tồn đọng

- Số đo theo trường ở `/metrics`, bản trình diễn (18h) theo trường, biểu EMIS riêng từng trường chưa làm; không bật nhiều trường ở môi trường chạy thật trước S3; e2e toàn bộ do CI chạy

### 2026-10-25 — DT-SaaS phần S1a: nền đa thuê bao, phần lõi

#### Công việc đã thực hiện

- Đọc mục 14.3, 14.4, 14.5, 14.7, 14.9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà mã: `Databases` (142 chỗ dùng `databases.system` ở 61 tệp), cấu hình máy chủ API và dịch vụ định danh, `Infrastructure`, mã phiên, cookie mã làm mới, khóa Redis của dịch vụ định danh, `cacheKey`, `storageKey`, các tiến trình nền, `academic-years.service.ts`, `database/src/migrate.ts`, cấu hình e2e và CI.
- Thêm cơ sở dữ liệu nền tảng (tệp 0001 đến 0004), ngữ cảnh trường, nhận diện trường theo tên miền, bố cục cơ sở dữ liệu `database` và `schema`, nhóm kết nối có giới hạn, mã phiên mang `tid`, khóa dữ liệu trẻ riêng, tiền tố khóa, `adopt-existing`, đăng nhập vận hành nền tảng, khung cổng nền tảng, kiểm thử cách ly (kiểm tĩnh, ma trận tuyến, quét chuỗi mồi, hai bố cục, e2e nhiều trường), việc CI mới.
- Thêm quy tắc BR-200 đến BR-202, quyền PQ-105, chức năng P01-47 đến P01-50, màn hình MH-313, MH-314, kịch bản CT-990 đến CT-998, tiêu chí AC-823 đến AC-826, bảo mật BM-73 đến BM-75, QĐ-25, bảng nền tảng ở `16` mục 18A, giao kèo ở `17`, mục 12A của `12`; phiên bản 0.129.0.

#### Quyết định

- Claim mã trường của mã phiên là `tid`, không phải `sid` như kế hoạch viết, vì `sid` đã là mã phiên.
- Gọi nội bộ giữa máy chủ API và dịch vụ định danh (địa chỉ nội bộ, không phải tên miền trường) lấy trường theo `tid` của mã phiên đã ký khi tên miền không phân giải được; không có mã phiên thì vẫn 404.
- Đăng nhập vận hành nền tảng đặt dưới `/api/v1/auth/platform/*` (nhóm `/api/v1/auth` đã chuyển sang dịch vụ định danh ở Caddy và proxy phát triển) để không sửa `deploy/` của phần S7a; mã phiên vận hành có đối tượng riêng.
- Tên cookie mã làm mới kèm mã trường ở chế độ nhiều trường; trường số 1 có tiền tố khóa trống.
- Sáu tiến trình nền và việc khởi động theo trường không chạy ở chế độ nhiều trường cho tới S1b (ngoài yêu cầu không có ngữ cảnh trường); ghi rõ ở YCTD-191.
- Hai Dockerfile thêm `COPY apps/platform/package.json` để khớp tệp khóa pnpm (một dòng mỗi tệp, phần S7a có thể gộp xung đột nhỏ).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-191, `07_QUY_TAC_NGHIEP_VU.md` BR-200 đến BR-202, `08_VAI_TRO_NGUOI_DUNG.md` PQ-105, `10_YEU_CAU_CHUC_NANG.md` P01-47 đến P01-50, `11_TIEU_CHI_NGHIEM_THU.md` AC-823 đến AC-826, `14_DAC_TA_GIAO_DIEN.md` MH-313, MH-314, `16_CO_SO_DU_LIEU.md` mục 18A, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-990 đến CT-998, `22_BAO_MAT.md` BM-73 đến BM-75, `12_KIEN_TRUC_HE_THONG.md` mục 12A, QĐ-25; phiên bản phần mềm 0.129.0.

#### Vấn đề tồn đọng

- Không bật nhiều trường ở môi trường chạy thật trước khi S1b (việc nền, điểm cuối công khai, khóa ghép tay còn trong baseline kiểm tĩnh) và S3 (khóa tích hợp riêng từng trường) gộp; e2e toàn bộ do CI chạy (trên máy chỉ chạy spec 130 và các spec bị ảnh hưởng); `pg_advisory_lock` ở mở năm học và `Migrator` cần kiểm khi qua bộ gom kết nối theo giao dịch (S7a); S9 dùng bố cục `schema` và `DB_HOST_ADAPTER` cho Neon, Supabase.

### 2026-10-25 — DT-SaaS phần S7a: hạ tầng VPS trong nước, phần dựng sẵn

#### Công việc đã thực hiện

- Đọc mục 14.3, 14.4, 14.5, 14.9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà bộ triển khai một máy (YCTD-92) và mã có thể vướng khi gom kết nối theo giao dịch (múi giờ, `SET`, khóa tư vấn, `LISTEN`).
- Viết hồ sơ `deploy/profiles/production/`: Compose T1, T2, T3; PgBouncer (`docker/pgbouncer/`); bản sao PostgreSQL; Caddy bắt mọi tên miền; giám sát, cảnh báo, nhật ký; môi trường thử; `scripts/deploy.sh`, `scripts/check-config.sh`; README hướng dẫn vận hành.
- Thêm kịch bản CT-986 đến CT-989. Kết quả ngày 25/10/2026: `deploy/profiles/production/scripts/check-config.sh` đạt (Compose T1, T2 hai máy, T3 máy bản sao, staging cùng VPS; Caddyfile có và không có tệp `sites.d`; Prometheus, luật cảnh báo; Alertmanager đủ ba kênh và không kênh nào; Loki); dựng ảnh PgBouncer, chạy cùng PostgreSQL: kết nối `school_system` gom theo phiên giữ và mở khóa tư vấn trên cùng kết nối, `school_identity` gom theo giao dịch, sai mật khẩu bị từ chối, kiểm tra sức khỏe đạt; bản sao lấy bản sao cơ bản, máy chính báo `streaming`, bản sao đọc được dòng vừa ghi; cú pháp các script shell đạt; bản một máy cũ (`deploy/docker-compose.production.yml`) vẫn hợp lệ; kiểm tra định dạng đạt. Không có e2e (phần hạ tầng, không sửa mã nghiệp vụ); kiểm tay trên staging (CT-989) chờ dựng VPS thử.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: `school_system` gom theo phiên vì mở năm học giữ khóa tư vấn theo phiên (không sửa mã nghiệp vụ ở phần này); ảnh PgBouncer tự dựng từ gói Alpine; giám sát bằng Prometheus, Alertmanager, Loki chạy trên VPS; kênh Zalo qua webhook; việc định kỳ chỉ chạy ở `api-a`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-198, `12_KIEN_TRUC_HE_THONG.md` mục 10, 12, `21_KICH_BAN_KIEM_THU.md` CT-986 đến CT-989, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 14.10. Phiên bản 0.128.0.

#### Vấn đề tồn đọng

- Kiểm tay trên staging khi có VPS thử (CT-989); S7b đo quy mô, sao lưu theo trường; thêm kiểm tra cấu hình hồ sơ vào CI.

### 2026-10-25 — DT-SaaS phần S8a: pháp lý và hồ sơ tuân thủ (tài liệu)

#### Công việc đã thực hiện

- Đọc kế hoạch 14.3, 14.5 "S8a", "S9", 14.11; tra văn bản căn cứ trên cổng chính thống (`chinhphu.vn`, `congbao.chinhphu.vn`, `vbpl.vn`, `mps.gov.vn`, `bocongan.gov.vn`, `baochinhphu.vn`) ngày 2026-10-25: Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực 01/01/2026) và Nghị định 356/2025/NĐ-CP (hiệu lực 01/01/2026; **Nghị định 13/2023/NĐ-CP hết hiệu lực từ 01/01/2026** theo khoản 2 Điều 42); Luật An ninh mạng số 116/2025/QH15 (hiệu lực 01/07/2026), Nghị định 331/2026/NĐ-CP (cấp độ hệ thống thông tin) và Nghị định 333/2026/NĐ-CP (quy định chi tiết Luật An ninh mạng, gồm lưu trữ dữ liệu tại Việt Nam), cùng hiệu lực 19/08/2026.
- Soạn bộ mẫu `33_HO_SO_PHAP_LY/` (PL-00 đến PL-15, phiên bản S8a-1.0), bản nháp cần luật sư rà.

#### Quyết định

- Bộ mẫu theo Luật 91/2025 và Nghị định 356/2025 thay cho Nghị định 13/2023 đã hết hiệu lực; rủi ro lưu trữ trong nước ghi theo Luật An ninh mạng 116/2025 và Nghị định 333/2026; cấp độ hệ thống theo Nghị định 331/2026. Thêm PL-15 (điều kiện kinh doanh dịch vụ xử lý dữ liệu cá nhân) vì Điều 21 Nghị định 356/2025 có thể áp dụng cho nền tảng. Không tăng phiên bản phần mềm. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-200, `33_HO_SO_PHAP_LY/00_MUC_LUC.md`, `22_BAO_MAT.md` mục 9, 10, `32_KE_HOACH_THEO_HE_THONG_SO.md` 14.5, 14.10.

#### Vấn đề tồn đọng

- Luật sư của Eric rà bộ mẫu; kết luận PL-15; đọc các Mẫu số 01a đến 10 của Phụ lục Nghị định 356/2025 và toàn văn Nghị định 331/2026, 333/2026; xác định hiệu lực Nghị định 53/2022, 85/2016, Thông tư 12/2022; chưa nhận dữ liệu thật của trường nào khi chưa rà.
- S2, S9 dùng danh sách trường dữ liệu ở PL-00 mục 3 cho `school_consents`, `school_hosting`.


### 2026-10-25 — DT-21 phần 21g: báo cáo, thống kê và EMIS THCS, THPT

#### Công việc đã thực hiện

- Đọc mục 12 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà khung EMIS, thống kê Tiểu học của 20f, sổ điểm 21c, học bạ, khen thưởng, lên lớp 21e, tốt nghiệp 21f, tổ hợp, tổ bộ môn 21a.
- Cơ sở dữ liệu: tệp hệ thống `0028_add_secondary_report_forms` (bốn biểu khung); số giữ sẵn tệp năm học `0092`, định danh `0083` không dùng.
- Máy chủ API: thống kê THCS, THPT, xuất tệp; biểu EMIS theo cấp của biểu trên khung 20f.
- Cổng quản trị: 7.18 Báo cáo, thống kê, EMIS THCS, THPT.
- Thêm quy tắc BR-198 đến BR-199, chức năng P17-34 đến P17-35, màn hình MH-312, phân quyền PQ-104, kịch bản CT-981 đến CT-985, tiêu chí AC-819 đến AC-822. Kết quả ngày 25/10/2026: kiểm thử đơn vị `apps/api/src/secondary-reports/secondary-reports.test.ts` CT-21g-1 đến CT-21g-4 đạt 4/4; kiểm thử đơn vị các gói đã sửa trên máy (database 6/6, api 1080/1080) đạt, kiểm thử đang có không sửa kỳ vọng (thêm mục 7.18 vào bảng đối chiếu điều kiện cũ của CT-15e-2 và danh sách mục chỉ của THCS, THPT của CT-19c-1); e2e trên máy 02, 03, 06, 08, 94, 103, 82, 92 đạt (82, 92 sửa cách chọn để không phụ thuộc dữ liệu của 103; 103 dọn khối 10 tự tạo, đóng lớp thử); e2e toàn bộ do CI chạy; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 21g của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 12.4. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: dùng lại khung biểu của 20f, thêm bộ điều kiện theo cấp thay vì bảng mới; biểu khung chờ khảo sát Sở; thống kê dùng quyền thống kê học sinh có sẵn.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-175, `07_QUY_TAC_NGHIEP_VU.md` BR-198 đến BR-199, `08_VAI_TRO_NGUOI_DUNG.md` PQ-104, `10_YEU_CAU_CHUC_NANG.md` P17-34 đến P17-35, `11_TIEU_CHI_NGHIEM_THU.md` AC-819 đến AC-822, `14_DAC_TA_GIAO_DIEN.md` MH-312, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-981 đến CT-985, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 12.9. Phiên bản 0.127.0.

#### Vấn đề tồn đọng

- Khảo sát hệ thống của Sở cấp THCS, THPT để sửa biểu khung cho khớp (tài liệu 31); thêm biểu mới từ giao diện.

### 2026-10-25 — Kế hoạch DT-SaaS: Enterprise SaaS nhiều trường

#### Công việc đã thực hiện

- Đọc bản nháp kế hoạch SaaS ngày 2026-10-19 (mục 4 chia phần S1 đến S8, mục 4b quyết định của Eric), mục 12, 13 của `32_KE_HOACH_THEO_HE_THONG_SO.md` làm khuôn, và mã trên nhánh chính: `Databases` (`apps/api/src/common/databases.ts`), cấu hình máy chủ API và dịch vụ định danh, `cacheKey`, `storageKey`, `database/src/migrate.ts`, Caddy `on_demand_tls` của 18f, `backup.sh`, `docker-compose.production.yml`, cấu hình e2e và CI.
- Thêm mục 14 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.61): kế hoạch DT-SaaS gồm mười ba phần S1a, S1b, S2, S3, S4, S5a, S5b, S6, S7a, S7b, S8a, S8b, S9 chạy năm đợt; kiến trúc đích; phạm vi chi tiết; quyết định thiết kế; chiến lược kiểm thử cách ly; rủi ro; tiến độ; giả định chưa chốt.
- Ghi YCTD-190 (chỉ đổi tài liệu); thêm đợt DT-SaaS, RR-16 đến RR-18, GD-93 đến GD-101 vào `01_KE_HOACH_TONG_THE.md`.

#### Quyết định

- Eric chốt ngày 2026-10-25: đường dẫn trường mặc định là tên miền con `<mã trường>.<tên miền hệ thống>` (tên miền hệ thống là cấu hình), quản trị nền tảng cấu hình tay được tên miền riêng cho từng trường ở bước setup (CNAME, HTTPS cấp theo yêu cầu cho tên miền có trong danh sách); hạ tầng là VPS trong nước, một hoặc vài máy, không giả định dịch vụ đám mây quản lý, máy chủ đặt tại Việt Nam.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: tách S1 thành S1a (lõi) và S1b (chạy nền, công khai), S5 thành S5a (gói) và S5b (thu phí), S7 thành S7a (dựng sẵn, chỉ `deploy/`) và S7b (vận hành nhiều trường), S8 thành S8a (pháp lý, tài liệu) và S8b (bảo mật mã) để tối đa ba phiên song song không sửa chung tệp lõi; mỗi trường một vai trò PostgreSQL; mã phiên gắn mã trường, cặp khóa ký dùng chung; chế độ một trường là mặc định, bản triển khai hiện có thành trường số 1 không chuyển dữ liệu; ba ứng dụng chung một tên miền theo tiền tố đường dẫn; kiểm thử cách ly nhiều lớp (kiểm tĩnh, ma trận tuyến API, bản chụp cơ sở dữ liệu tìm chuỗi canary, e2e nhiều trường) với tên miền `*.localhost`, `*.test`.
- Bổ sung của Eric ngày 2026-10-25: giai đoạn đầu là thử nghiệm nên kế hoạch có hai hồ sơ triển khai dùng chung một mã nguồn, chọn bằng cấu hình: (a) thử nghiệm miễn phí trên Cloudflare và nền tảng miễn phí khác, (b) vận hành trên VPS trong nước. Claude tự chọn: thêm phần S9 triển khai thử nghiệm giao đầu đợt 3; bố cục cơ sở dữ liệu `schema` (mỗi lược đồ một vai trò, `search_path` mức vai trò) cho thử nghiệm vì gói miễn phí giới hạn số cơ sở dữ liệu; cổng biên bằng Cloudflare Worker kèm tài sản tĩnh (Vercel Hobby phi thương mại, Pages không có tên miền ký tự đại diện); một container gộp, không Redis (`BLPOP` của máy xếp tiêu hết hạn mức Upstash); việc định kỳ do Cron Triggers gọi và có việc bù; Render là lựa chọn đầu, Koyeb thứ hai, Fly.io loại; dữ liệu giả, hoặc dữ liệu thật chỉ khi có văn bản đồng ý và đủ biện pháp tuân thủ (Eric chốt ngày 2026-10-25, xem dòng sau) ở máy chủ ngoài nước.
- Eric chốt các giả định ngày 2026-10-25: GD-100 dùng cả ba phương án hồ sơ thử nghiệm viết theo kiểu bộ nối (Cloudflare Worker hoặc Vercel; Neon hoặc Supabase, R2 hoặc Supabase Storage; Render, dự phòng Koyeb) kèm ràng buộc Vercel và hai cách kết hợp với Cloudflare DNS; GD-101 trường thật dùng thử với dữ liệu thật khi có văn bản đồng ý, thay ràng buộc "chỉ dữ liệu giả" bằng biện pháp tuân thủ (hồ sơ đồng ý ở `platform`, vùng Singapore, mã hóa trường dữ liệu trẻ em theo khóa trường, đánh giá tác động Nghị định 13/2023/NĐ-CP, Eric chấp nhận rủi ro Nghị định 53/2022/NĐ-CP, lộ trình chuyển về VPS trong nước), cập nhật S8a; GD-98 S6 làm ở đợt 5 đủ ba cấp Bộ, Sở, Phòng Văn hóa – Xã hội với cây đơn vị hành chính cấu hình được; GD-94 thu phí cấu hình được, mặc định theo số học sinh.
- Phần chưa chốt (tên sản phẩm, cách tính phí, cổng thanh toán, hóa đơn điện tử, nhà cung cấp VPS) làm cấu hình được và ghi là giả định GD-93 đến GD-99.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-190, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 14, `01_KE_HOACH_TONG_THE.md` mục 5, 10, 15. Không đổi mã nguồn, không đổi phiên bản phần mềm.

#### Vấn đề tồn đọng

- Eric chốt các giả định ở 14.11 (đặc biệt cách tính phí, tên sản phẩm, nhà cung cấp VPS, xác thực hai lớp so với YCTD-31); S6 chờ xác nhận có khách cấp trên; tài liệu pháp lý của S8a là bản nháp cần luật sư rà; đọc văn bản gốc trước khi làm từng phần; không bật nhiều trường ở môi trường chạy thật trước khi S1a, S1b gộp và kiểm thử cách ly đạt; e2e toàn bộ do CI chạy.

### 2026-10-25 — DT-22 phần 22h2: kho học liệu số, câu hỏi và chia sẻ

#### Công việc đã thực hiện

- Đọc mục 13.4 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà kho học liệu 22h1 (hệ thống 0042, năm học 0102), ngân hàng câu hỏi, đề, ma trận của 22g1, lịch sử dùng câu có kết quả chấm của 22g2.
- Cơ sở dữ liệu: tệp năm học `0103`, định danh `0093`. Máy chủ API: hàm thuần rubric, gói chia sẻ; câu hỏi, đề, ma trận trong kho, bộ sưu tập, thống kê, rubric, xuất, nhập gói. Cổng quản trị: Kho học liệu 8., 9., 10.
- Thêm quy tắc BR-197, chức năng P09-56 đến P09-58, quyền PQ-103, màn hình MH-309 đến MH-311, kịch bản CT-975 đến CT-980, tiêu chí AC-816 đến AC-818. Kết quả ngày 25/10/2026: kiểm thử đơn vị `apps/api/src/learning-resources/resource-sharing.test.ts` CT-22h2-1 đến CT-22h2-5 đạt 5/5; kiểm thử đơn vị các gói đã sửa (api, database, shared) đạt (shared; database 6/6; api 1087/1087); kiểm thử giao diện `tests/e2e/123-resource-sharing.spec.ts` (CT-22h2-6) cùng 02, 03, 06, 08, 58, 96, 122 đạt; toàn bộ kiểm thử giao diện do CI chạy (trên máy: 02, 03, 06, 08, 58, 96, 122 đạt; 123 đạt sau khi sửa CSDL hệ thống của spec); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22h2 của mục 13.4: một nguồn sự thật cho câu hỏi (kho chỉ tham chiếu ngân hàng 22g1); bộ sưu tập câu hỏi, rubric ở năm học vì ngân hàng câu hỏi ở năm học; gói chia sẻ là tệp nén gzip có bản kê JSON (không thêm thư viện nén); học liệu nhập đi qua luồng duyệt 22h1; quyền mới `P09.learning-resource.share`; AI tắt. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-184, `07_QUY_TAC_NGHIEP_VU.md` BR-197, `08_VAI_TRO_NGUOI_DUNG.md` PQ-103, `10_YEU_CAU_CHUC_NANG.md` P09-56 đến P09-58, `11_TIEU_CHI_NGHIEM_THU.md` AC-816 đến AC-818, `14_DAC_TA_GIAO_DIEN.md` MH-309 đến MH-311, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-975 đến CT-980, `23_LICH_SU_PHIEN_BAN.md` 0.126.0.

#### Vấn đề tồn đọng

- Câu hỏi trong gói chia sẻ; danh mục chung liên trường (DT-SaaS).


### 2026-10-24 — DT-22 phần 22h1: kho học liệu số, phần lõi

#### Công việc đã thực hiện

- Đọc mục 13 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà kho tệp (`FileStorage`, `storageKey`), tệp đính kèm văn bản đến ở cơ sở dữ liệu hệ thống, luồng duyệt và Việc của tôi của 18e, môn học 20a, kế hoạch bài dạy (`lesson_plans`), cách thêm phân hệ của 22f.
- Cơ sở dữ liệu: tệp hệ thống `0042`, năm học `0102`, định danh `0092`. Máy chủ API: danh mục, học liệu, phiên bản (tệp, liên kết, kế hoạch bài dạy), gửi duyệt, duyệt hai bước theo rủi ro, ẩn, mở lại, ngừng dùng, tìm, xem, tải, bộ sưu tập, báo lỗi, thống kê, nguồn Việc của tôi.
- Cổng quản trị: phân hệ "Kho học liệu" (7 mục).
- Thêm quy tắc BR-196, chức năng P09-50 đến P09-55, quyền PQ-102, màn hình MH-302 đến MH-308, kịch bản CT-968 đến CT-974, tiêu chí AC-813 đến AC-815. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/learning-resources/learning-resources.test.ts` CT-22h1-1 đến CT-22h1-6 đạt 6/6; kiểm thử đơn vị các gói đã sửa đạt 37/37 (kho học liệu, system-admin-so CT-16d-3 đếm 21 phân hệ, quick-links, menu theo cấp, Việc của tôi); kiểm thử giao diện `tests/e2e/122-learning-resources.spec.ts` (CT-22h1-7) đạt; kiểm thử giao diện chạy trên máy 01, 02, 03, 58, 83, 122 đạt 18/18; e2e toàn bộ do CI chạy; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22h1 của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 13.4. Phân hệ riêng, quyền thuộc P09; học liệu, phiên bản, bộ sưu tập, danh mục ở cơ sở dữ liệu hệ thống, sự kiện duyệt, báo lỗi, lượt xem ở năm học; luồng duyệt viết theo cùng mô hình trạng thái, sự kiện, Việc của tôi của 18e (không dùng chung bảng của kho hồ sơ vì học liệu không theo năm học); thủ kho mặc định là Ban Giám hiệu, trường giao thêm ở 1.2 Phân quyền nhóm. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-183, `07_QUY_TAC_NGHIEP_VU.md` BR-196, `08_VAI_TRO_NGUOI_DUNG.md` PQ-102, `10_YEU_CAU_CHUC_NANG.md` P09-50 đến P09-55, `11_TIEU_CHI_NGHIEM_THU.md` AC-813 đến AC-815, `14_DAC_TA_GIAO_DIEN.md` MH-302 đến MH-308, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-968 đến CT-974, `23_LICH_SU_PHIEN_BAN.md` 0.125.0.

#### Vấn đề tồn đọng

- 22h2: câu hỏi, đề, rubric trong kho (tham chiếu 22g1), chia sẻ liên trường bằng gói tệp; xem trước PDF, ảnh; ứng dụng giáo viên cho kho học liệu.


### 2026-10-25 — DT-21 phần 21d: sổ đầu bài, điểm danh theo tiết THCS, THPT; sơ đồ chỗ ngồi; thi đua lớp, sao đỏ

#### Công việc đã thực hiện

- Đọc mục 12 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà sổ đầu bài 20d, nề nếp 20b, tiết nhóm và tổ hợp của 21a, 21b. Sổ đầu bài, nề nếp của DT-20 đã viết theo cấp nên phần này mở menu, thêm tiết nhóm, quy tắc theo cấp, không viết lại.
- Cơ sở dữ liệu: tệp năm học `0088_create_secondary_class_records`, tệp định danh `0079_add_secondary_class_record_permissions`.
- Máy chủ API: sổ đầu bài (tiết nhóm, quy tắc xếp loại, xuất tuần, sơ đồ trong chi tiết tiết); sơ đồ chỗ ngồi; nề nếp (tiêu chí mặc định THCS, THPT, đội sao đỏ, sao đỏ báo, điểm tiết).
- Cổng quản trị: 7.6 (nhóm, xuất, khối quy tắc xếp loại tiết), 7.16 Sơ đồ chỗ ngồi, 4.9 (chọn cấp, thẻ Đội sao đỏ, sao đỏ báo, cột điểm tiết). Ứng dụng giáo viên: sổ đầu bài hiện nhóm, nhãn, quy tắc, sơ đồ.
- Thêm quy tắc BR-192 đến BR-194, chức năng P02-76 đến P02-78, màn hình MH-300, phân quyền PQ-101, kịch bản CT-957 đến CT-962, tiêu chí AC-805 đến AC-808. Kết quả ngày 25/10/2026: kiểm thử đơn vị `apps/api/src/class-logs/secondary-class-records.test.ts` CT-21d-1 đến CT-21d-5 đạt 5/5; kiểm thử đơn vị các gói đã sửa trên máy (database 6/6, api 1052/1052) đạt, kiểm thử đang có không sửa kỳ vọng (thêm mục 7.16 vào bảng đối chiếu điều kiện cũ của CT-15e-2 và danh sách mục chỉ của THCS, THPT của CT-19c-1); e2e trên máy 02, 03, 06, 08, 58, 88, 91, 97, 99 đạt; e2e toàn bộ do CI chạy; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 21d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 12.4. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: tiết nhóm ghi sổ riêng, điểm danh theo tổ hợp; quy tắc xếp loại tiết theo cấp ở cấu hình (Tiểu học giữ như cũ); sơ đồ chỗ ngồi theo lớp, tuỳ trường theo môn; sao đỏ không có tài khoản, giáo viên trực ghi thay, không chấm lớp mình; điểm tiết vào thi đua tuỳ cấp.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-171, `07_QUY_TAC_NGHIEP_VU.md` BR-192 đến BR-194, `08_VAI_TRO_NGUOI_DUNG.md` PQ-101, `10_YEU_CAU_CHUC_NANG.md` P02-76 đến P02-78, `11_TIEU_CHI_NGHIEM_THU.md` AC-805 đến AC-808, `14_DAC_TA_GIAO_DIEN.md` MH-300, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-957 đến CT-962, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 12.9. Phiên bản 0.123.0.

#### Vấn đề tồn đọng

- Khảo sát hệ thống của Sở cấp THCS, THPT để khớp biểu mẫu sổ đầu bài, số mục menu; sơ đồ chỗ ngồi theo tiết; tài khoản học sinh hạn chế cho sao đỏ nếu Eric yêu cầu.

### 2026-10-24 — DT-22 phần 22a: thư viện trường học

#### Công việc đã thực hiện

- Đọc mục 13 của `32_KE_HOACH_THEO_HE_THONG_SO.md` (kế hoạch DT-22) và mã trên nhánh chính: học sinh, cán bộ, lớp, môn, thông báo, nhật ký xuất, tem QR của thiết bị (`equipment-locations`), kiểm kê thiết bị, kho tệp, chuyển năm học; rà bảng `library_items`, `library_albums` (Mầm non) và `asset_loans` để không dùng nhầm.
- Cơ sở dữ liệu: tệp năm học `0100`, định danh `0090`. Máy chủ API: danh mục, bản sao, tem, thanh lý, tệp số, sổ đăng ký, thẻ bạn đọc, mượn trả, đặt trước, sách giáo khoa, kiểm kê, báo cáo, chuyển năm học. Cổng quản trị: phân hệ "Thư viện" 7 trang. Ứng dụng giáo viên, phụ huynh.
- Thêm quy tắc BR-189 đến BR-191, chức năng P02-71 đến P02-75, quyền PQ-100, màn hình MH-291 đến MH-299, kịch bản CT-947 đến CT-956, tiêu chí AC-801 đến AC-804. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/library/library.test.ts` CT-22a-1 đến CT-22a-8 đạt 8/8; trên máy đã chạy kiểm thử đơn vị các gói sửa (thư viện, số phân hệ `system-admin-so`, đường dẫn nhanh, cấp học, chuyển năm học) đạt 52/52; kiểm thử giao diện chạy trên máy: 02, 03, 06, 08, 58, 81, 82, 84 và `tests/e2e/120-library.spec.ts` (CT-22a-9) đạt; kiểm thử giao diện toàn bộ do CI chạy; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt

#### Quyết định

- Thực hiện phần 22a của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 13.4. Toàn bộ ở cơ sở dữ liệu năm học (cần khóa ngoại tới học sinh, cán bộ, lớp) và chép sang năm mới; số hệ thống 0040 không dùng; không có vai trò thủ thư cố định, trường gán `P02.library.manage` cho nhóm của thủ thư; chỉ tiêu theo chuẩn để ngưỡng trống đến khi đọc văn bản gốc; không dùng AI, không gọi dịch vụ ngoài. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Khi chạy kiểm thử cục bộ dùng cơ sở dữ liệu định danh riêng `school_identity_22a` vì cơ sở dùng chung đã có tệp của phiên khác; không chạy lệnh migrate toàn bộ lên cơ sở năm học dùng chung.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-181, `07_QUY_TAC_NGHIEP_VU.md` BR-189 đến BR-191, `08_VAI_TRO_NGUOI_DUNG.md` PQ-100, `10_YEU_CAU_CHUC_NANG.md` P02-71 đến P02-75, `11_TIEU_CHI_NGHIEM_THU.md` AC-801 đến AC-804, `14_DAC_TA_GIAO_DIEN.md` MH-291 đến MH-299, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-947 đến CT-956, `23_LICH_SU_PHIEN_BAN.md` 0.122.0.

#### Vấn đề tồn đọng

- Đọc văn bản gốc về chuẩn thư viện cơ sở giáo dục phổ thông để nạp ngưỡng chỉ tiêu; nhập Excel danh mục; ghi minh chứng sang 22f; ảnh bìa, ô chọn môn ở giao diện, thẻ đã trả, đã mất ở danh sách lượt mượn.

### 2026-10-24 — DT-21 phần 22g2: kiểm tra, đánh giá, phần chấm

#### Công việc đã thực hiện

- Đọc mục 12 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà đề, mã đề, bản chụp câu của 22g1, sổ điểm 21c (quyền nhập, khoá, hạn), bộ dựng PDF (18d), tệp bảng Excel, PDF (16a), công cụ nhập Excel.
- Cơ sở dữ liệu: tệp năm học `0090`, định danh `0081`. Máy chủ API: hàm thuần chấm phiếu, thống kê câu; bài kiểm tra của lớp, phiếu trả lời, nhập bài, nhập tệp quét, khoá, chuyển sổ điểm qua `recordExamScores` của 21c, báo cáo, xuất Excel, PDF. Cổng quản trị: 8.5, 8.6.
- Thêm quy tắc BR-188, chức năng P02-69 đến P02-70, quyền PQ-99, màn hình MH-289 đến MH-290, kịch bản CT-940 đến CT-946, tiêu chí AC-798 đến AC-800. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/exam-grading/exam-grading.test.ts` CT-22g2-1 đến CT-22g2-6 đạt 6/6; kiểm thử đơn vị các gói đã sửa (api, database, shared) đạt (shared; database 6/6; api 1047/1047); kiểm thử giao diện `tests/e2e/101-exam-grading.spec.ts` (CT-22g2-7) cùng 96, 98, 02, 03, 58 đạt; toàn bộ kiểm thử giao diện do CI chạy (trên máy: 02, 03, 06, 08, 58, 59, 96, 98, 101 đạt 26/26; 101 rồi 54 đạt 14/14); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22g2 của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 12: chấm theo phiếu bằng nhập tay và nhập tệp quét theo mẫu (phương án dự phòng của mục 12), chưa nhận dạng ảnh; đúng sai bốn ý chấm bậc thang mặc định, đổi được theo bài; chuyển điểm chỉ qua sổ điểm 21c; khoá điểm dùng quyền quản lý đề của 22g1; quyền mới `P02.exam.grade`; AI tắt. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-173, `07_QUY_TAC_NGHIEP_VU.md` BR-188, `08_VAI_TRO_NGUOI_DUNG.md` PQ-99, `10_YEU_CAU_CHUC_NANG.md` P02-69 đến P02-70, `11_TIEU_CHI_NGHIEM_THU.md` AC-798 đến AC-800, `14_DAC_TA_GIAO_DIEN.md` MH-289 đến MH-290, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-940 đến CT-946, `23_LICH_SU_PHIEN_BAN.md` 0.121.0.

#### Vấn đề tồn đọng

- Nhận dạng ảnh chụp, ảnh quét phiếu (OMR) ở worker; phiếu trả lời riêng từng mã đề; mẫu phiếu theo Sở khi khảo sát.

### 2026-10-25 — DT-21 phần 21f: xét tốt nghiệp THCS, THPT và hồ sơ thi
- Đọc mục 12 của `32_KE_HOACH_THEO_HE_THONG_SO.md` và mã 20e (học bạ), 21c (sổ điểm), 21e (học bạ, lên lớp).
- Làm hàm xét tốt nghiệp dùng chung, máy chủ `graduation` (kỳ, thí sinh, hồ sơ dự thi, số báo danh, phòng thi, điểm, xét, công nhận, giấy chứng nhận, biên bản, tệp xuất, hồ sơ chuyển cấp), cổng quản trị mục 7.16 và e2e 102.
- Cơ sở dữ liệu: tệp năm học `0091`; hệ thống `0029`, định danh `0082` để trống.
- Kiểm thử: kiểm thử đơn vị `graduation.test.ts` CT-21f-1 đến CT-21f-5 đạt 5/5; chạy cùng menu, cấp học đạt 13/13; typecheck, prettier, eslint đạt; e2e CT-21f-6 (102) do CI chạy cùng e2e toàn bộ; e2e toàn bộ do CI chạy.
- Dùng quyền sẵn có của đánh giá, học bạ thay vì thêm quyền mới; cấu hình xét (hệ số, điểm đạt, điểm liệt, môn thi) lưu theo cấp và chép sang năm học mới để đổi theo quy chế từng năm; kết nối Sở, Bộ chỉ xuất tệp và đánh dấu thủ công; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-174, `23_LICH_SU_PHIEN_BAN.md` bản 0.124.0.
- Đối chiếu quy chế thi, xét tốt nghiệp hiện hành (công thức, hệ số, điểm liệt, môn thi) và mẫu giấy chứng nhận, tệp theo Bộ, Sở; nối Sở, Bộ khi có thông tin; khảo sát hệ thống của Sở cấp THCS, THPT.

### 2026-10-24 — DT-21 phần 21e: học bạ số, khen thưởng, xét lên lớp THCS, THPT

#### Công việc đã thực hiện

- Đọc mục 12 của `32_KE_HOACH_THEO_HE_THONG_SO.md` và mã 20e (`learning-records`: danh hiệu, khen thưởng, hoàn thành chương trình, học bạ, kí nội bộ, in đủ số định danh kèm kiểm quyền), sổ điểm 21c.
- Mở rộng khung 20e cho lớp THCS, THPT: kết quả cuối năm đọc từ sổ điểm (học kỳ II đã khoá, xếp loại cả năm); danh hiệu Xuất sắc, Giỏi; xét lên lớp; học bạ có điểm trung bình hai học kỳ, cả năm; cổng quản trị mục 7.8 dùng chung ba cấp; ứng dụng phụ huynh nút Học bạ.
- Cơ sở dữ liệu: tệp năm học `0089` (căn cứ danh hiệu); tệp định danh `0080` để trống.
- Kiểm thử: kiểm thử đơn vị `learning-records-secondary.test.ts` CT-21e-1 đến CT-21e-5 đạt 5/5; chạy cùng học bạ 20e, sổ điểm 21c, sổ điểm, môn học, đánh giá, menu, cấp học đạt 45/45; typecheck, prettier đạt; e2e 100, 92, 98, 58 và 02, 03, 06, 08 đạt; e2e CT-21e-6 đạt; e2e toàn bộ do CI chạy.

#### Quyết định

- Dùng lại bảng, điểm cuối, quy trình kí của 20e (rẽ nhánh theo cấp) thay vì làm module riêng để học bạ, khen thưởng, lên lớp của mọi cấp ở một nơi và kí, in số định danh giữ một cách; không thêm quyền; điều kiện danh hiệu, lên lớp là hằng số mặc định theo Thông tư 22/2021; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-172, `23_LICH_SU_PHIEN_BAN.md` bản 0.120.0.

#### Vấn đề tồn đọng

- Đối chiếu toàn văn Thông tư 22/2021 (danh hiệu, lên lớp, mẫu học bạ); mẫu học bạ THCS, THPT khớp mẫu của Bộ, Sở khi khảo sát; khảo sát hệ thống của Sở cấp THCS, THPT khi Eric có tài khoản.
### 2026-10-24 — DT-22 phần 22e: hồ sơ bồi dưỡng giáo viên

#### Công việc đã thực hiện

- Đọc mục 13 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà `staff_certificates`, mã tra cứu và trang công khai của giấy khen 22d, giới hạn tần suất của điểm cuối công khai, Việc của tôi, phân hệ Hồ sơ chuyên môn; tra văn bản: Thông tư 19/2019/TT-BGDĐT ban hành Quy chế bồi dưỡng thường xuyên giáo viên, cán bộ quản lý cơ sở giáo dục mầm non, phổ thông và giáo viên trung tâm giáo dục thường xuyên (hiệu lực 28/12/2019), sửa đổi bởi Thông tư 17/2022/TT-BGDĐT; chương trình bồi dưỡng thường xuyên giáo viên phổ thông (Thông tư 17/2019/TT-BGDĐT), mầm non (Thông tư 12/2019/TT-BGDĐT) với thời lượng 120 tiết mỗi năm học, ba chương trình mỗi chương trình khoảng 40 tiết; Khung năng lực số đối với giáo viên, cán bộ quản lí theo Thông tư 18/2026/TT-BGDĐT (ban hành 27/03/2026, hiệu lực 12/05/2026): 6 miền, 20 năng lực thành phần, 3 mức Cơ bản, Thành thạo, Nâng cao.
- Cơ sở dữ liệu: tệp hệ thống `0041`, năm học `0101`, định danh `0091`. Máy chủ API: danh mục, khoá, đăng ký, duyệt hai cấp, kết quả, chứng nhận PDF có mã QR, thu hồi, cấp lại, tra cứu công khai, chứng chỉ nhập tay, hồ sơ theo cá nhân, tổ, trường, năng lực số, nguồn Việc của tôi.
- Cổng quản trị: nhóm "6. Bồi dưỡng giáo viên" (6.1 đến 6.5), trang "Tra cứu chứng nhận bồi dưỡng". Ứng dụng giáo viên: Bồi dưỡng của tôi.
- Thêm quy tắc BR-186, chức năng P09-45 đến P09-49, quyền PQ-98, màn hình MH-282 đến MH-287, kịch bản CT-927 đến CT-933, tiêu chí AC-792 đến AC-794. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/training/training.test.ts` CT-22e-1 đến CT-22e-6 đạt 6/6; kiểm thử đơn vị các gói đã sửa (api, shared, database) đạt 1022/1022 (api 1016, database 6); kiểm thử giao diện `tests/e2e/121-teacher-training.spec.ts` (CT-22e-7) đạt; kiểm thử giao diện chạy trên máy (toàn bộ spec trên nhánh trước khi gộp 20e, 22c2) 161/164; spec 22 (bảng lương) lỗi do spec 121 thêm nhân sự làm từ năm trước vào trường gốc nên bảng lương đòi chốt công tháng trước (BR-43), đã sửa spec 121 cho nhân sự bắt đầu từ hôm nay, chạy lại 02, 03, 121, 21, 22 đạt; spec 04 (lưới Tài khoản), 76 (gói ZIP) lỗi không liên quan 22e; spec 58 đạt; e2e toàn bộ do CI chạy; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22e của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 13.4. Nhóm menu mới trong phân hệ Hồ sơ chuyên môn (không thêm phân hệ); quyền dùng, duyệt cấp tổ, quản lý thuộc P09; danh mục ở cơ sở dữ liệu hệ thống, khoá, đăng ký, năng lực số ở năm học; chứng chỉ ở một bảng `staff_certificates`; mã tra cứu và trang công khai theo cách của 22d; tổ trưởng duyệt cấp tổ tùy chọn, Ban Giám hiệu duyệt cuối; tên miền năng lực số mặc định theo bản tóm tắt vì chưa đọc được toàn văn Mục B. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-182, `07_QUY_TAC_NGHIEP_VU.md` BR-186, `08_VAI_TRO_NGUOI_DUNG.md` PQ-98, `10_YEU_CAU_CHUC_NANG.md` P09-45 đến P09-49, `11_TIEU_CHI_NGHIEM_THU.md` AC-792 đến AC-794, `14_DAC_TA_GIAO_DIEN.md` MH-282 đến MH-287, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-927 đến CT-933, `23_LICH_SU_PHIEN_BAN.md` 0.119.0.

#### Vấn đề tồn đọng

- Đối chiếu tên 6 miền, 20 năng lực thành phần với toàn văn Thông tư 18/2026/TT-BGDĐT; khai báo nhu cầu và duyệt kế hoạch bồi dưỡng qua luồng 18e; tải tệp bản sao chứng chỉ; xuất báo cáo; nối KPI 18d, thi đua 22d.


### 2026-10-24 — DT-21 phần 21b: thời khoá biểu THCS, THPT

#### Công việc đã thực hiện

- Đọc mục 12 của `32_KE_HOACH_THEO_HE_THONG_SO.md` và mã 22c1 (`timetables.ts`, `timetable-rules.ts`), 22c2 (máy xếp, dạy thay, báo cáo), 21a (tổ hợp môn, menu).
- Cơ sở dữ liệu: tệp năm học `0086`. Máy chủ API: nhóm học, luật xung đột mới, thời khoá biểu của con theo tổ hợp, cột Nhóm khi nhập Excel, máy xếp bỏ qua môn học lựa chọn, dạy thay chỉ cho tiết cả lớp, trang công khai. Cổng quản trị: menu ba cấp, khối "Tiết học nhóm". Ứng dụng giáo viên, phụ huynh ghi nhóm.
- Thêm quy tắc BR-185, chức năng P02-65, màn hình MH-281, kịch bản CT-920 đến CT-926, tiêu chí AC-791. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/timetables/secondary-timetables.test.ts` CT-21b-1 đến CT-21b-6 đạt 6/6; trên máy đã chạy kiểm thử đơn vị các gói sửa (thời khoá biểu, máy xếp, cấp học, đường dẫn nhanh, sổ đầu bài) đạt 56/56; kiểm thử giao diện chạy trên máy: 02, 03, 06, 08, 58, 89, 93, 95 và `tests/e2e/97-secondary-timetables.spec.ts` (CT-21b-7); kiểm thử giao diện toàn bộ do CI chạy; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt

#### Quyết định

- Thực hiện phần 21b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 12.4. Nhóm học là cột `group_no` của tiết (0 là cả lớp) thay vì bảng nhóm riêng; học sinh thuộc nhóm theo tổ hợp môn của 21a, lọc khi xem; máy xếp không xếp môn học lựa chọn, tiết nhóm nhập tay hoặc Excel; dạy thay, đổi tiết chỉ cho tiết cả lớp. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Khi chạy kiểm thử trên máy dùng cơ sở dữ liệu định danh riêng `school_identity_21b`; chỉ chạy các kịch bản giao diện của phần mình và bị ảnh hưởng; kiểm thử giao diện toàn bộ do CI chạy.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-169, `07_QUY_TAC_NGHIEP_VU.md` BR-185, `10_YEU_CAU_CHUC_NANG.md` P02-65, `11_TIEU_CHI_NGHIEM_THU.md` AC-791, `14_DAC_TA_GIAO_DIEN.md` MH-281, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-920 đến CT-926, `23_LICH_SU_PHIEN_BAN.md` 0.118.0.

#### Vấn đề tồn đọng

- Xếp tự động tiết nhóm; dạy thay, đổi tiết cho tiết nhóm; định mức tiết của tổ bộ môn làm cảnh báo; sổ đầu bài, điểm danh theo tiết cho tiết nhóm thuộc 21d.

### 2026-10-24 — DT-21 phần 22g1: kiểm tra, đánh giá, phần đề

#### Công việc đã thực hiện

- Đọc mục 12 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, phần 22g của kế hoạch DT-22, mục 13 (22h2 tham chiếu ngân hàng câu hỏi); rà môn học (20a), khối, cấp (DT-19), bộ dựng Word, PDF (18d), công cụ nhập Excel (16a), thời khoá biểu (22c1).
- Cơ sở dữ liệu: tệp năm học `0085`, định danh `0076`. Máy chủ API: hàm thuần của ma trận, bốc câu, trộn đề; ngân hàng câu hỏi, chủ đề, ma trận, kế hoạch, đề; xuất Word, PDF. Cổng quản trị: nhóm 8 "Kiểm tra, đánh giá" (8.1 đến 8.4) cho THCS, THPT.
- Thêm quy tắc BR-184, chức năng P02-61 đến P02-64, quyền PQ-97, màn hình MH-277 đến MH-280, kịch bản CT-911 đến CT-919, tiêu chí AC-787 đến AC-790. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/exams/exam-rules.test.ts` CT-22g1-1 đến CT-22g1-4 đạt 4/4, `apps/api/src/exams/exams.test.ts` CT-22g1-5 đến CT-22g1-8 đạt 4/4; kiểm thử đơn vị chạy trên máy các gói đã sửa: shared đạt, database 6/6, api 1018 ca đạt 1016, hai ca `children.test.ts` (CTC-P02-013, CTC-P02-057) chập chờn khi chạy chung, chạy lại riêng đạt 26/26; sau khi gộp 21a, 21c, 20f chạy lại `exams`, `working-level` đạt 16/16; kiểm thử giao diện `tests/e2e/96-exam-bank.spec.ts` (CT-22g1-9) đạt; kiểm thử giao diện trên máy chạy 02, 03, 06, 08, 58, 96 đạt 18/18; sau khi gộp 21a, 21c chạy lại 02, 03, 06, 08, 58, 59, 96 đạt 24/24; e2e toàn bộ do CI chạy (đạt 5/5 trước khi gộp 20f); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22g1 của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 12.4: ngân hàng câu hỏi là nguồn duy nhất; câu trong đề lưu bản chụp; bốn mức nhận thức, bốn dạng câu cố định trong mã, tỉ lệ cấu hình theo ma trận; mã đề đầu giữ thứ tự soạn; ba quyền mới (soạn, thẩm định, quản lý); không dùng AI. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-168, `07_QUY_TAC_NGHIEP_VU.md` BR-184, `08_VAI_TRO_NGUOI_DUNG.md` PQ-97, `10_YEU_CAU_CHUC_NANG.md` P02-61 đến P02-64, `11_TIEU_CHI_NGHIEM_THU.md` AC-787 đến AC-790, `14_DAC_TA_GIAO_DIEN.md` MH-277 đến MH-280, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-911 đến CT-919, `23_LICH_SU_PHIEN_BAN.md` 0.117.0.

#### Vấn đề tồn đọng

- 22g2: phiếu trả lời, chấm, chuyển điểm vào sổ điểm, báo cáo theo câu; 22h2 đọc câu hỏi, ma trận, đề từ đây; ảnh, công thức ký hiệu trong câu hỏi; mẫu ma trận theo văn bản khi khớp Sở.


### 2026-10-24 — DT-20 phần 20f: báo cáo, thống kê và EMIS Tiểu học

#### Công việc đã thực hiện

- Đọc mục 11 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà biểu EMIS Mầm non, luồng gửi lên cấp trên 16a, tham số cấp 19d, thống kê 5.1, 5.3, số liệu của 20b, 20c, 20d, 20e.
- Cơ sở dữ liệu: tệp hệ thống `0027_create_report_forms` (hai biểu khung Tiểu học), tệp định danh `0074_add_report_form_permission`; số tệp năm học `0083` giữ sẵn không dùng (số nhập tay dùng `emis_report_values`).
- Máy chủ API: thống kê Tiểu học, xuất tệp; biểu EMIS Tiểu học (tính, nhập tay, sửa khung, xuất, gửi lên cấp trên).
- Cổng quản trị: 7.15 Báo cáo, thống kê, EMIS Tiểu học.
- Thêm quy tắc BR-181 đến BR-183, chức năng P17-31 đến P17-33, kịch bản CT-904 đến CT-910, tiêu chí AC-783 đến AC-786. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/primary-reports/primary-reports.test.ts` CT-20f-1 đến CT-20f-6 đạt 6/6; kiểm thử đơn vị đang có không sửa kỳ vọng (thêm mục 7.15 vào bảng đối chiếu điều kiện cũ của CT-15e-2 và danh sách mục chỉ của Tiểu học của CT-19c-1); kiểm thử đơn vị toàn bộ kho mã đạt 1081/1081 trước khi gộp main lần cuối; sau khi gộp chạy lại các tệp bị ảnh hưởng (primary-reports, working-level, menu-permissions) đạt 18/18; kiểm thử giao diện `tests/e2e/94-primary-reports.spec.ts` (CT-20f-7) đạt; kiểm thử giao diện trên máy chạy các kịch bản 02, 03, 94 đạt 5/5 (trước đó 02, 03, 06, 08, 58, 94 đạt 18/18); e2e toàn bộ do CI chạy; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 20f của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.4. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: biểu EMIS Tiểu học là khung cấu hình được ở cơ sở dữ liệu hệ thống, công thức theo cú pháp đơn giản kiểm khi lưu; nạp hai biểu khung chờ khảo sát Sở; thống kê dùng quyền thống kê học sinh có sẵn.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-165, `07_QUY_TAC_NGHIEP_VU.md` BR-181 đến BR-183, `10_YEU_CAU_CHUC_NANG.md` P17-31 đến P17-33, `11_TIEU_CHI_NGHIEM_THU.md` AC-783 đến AC-786, `14_DAC_TA_GIAO_DIEN.md`, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-904 đến CT-910, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.8. Phiên bản 0.116.0.

#### Vấn đề tồn đọng

- Khảo sát hệ thống của Sở cấp Tiểu học để sửa biểu khung cho khớp (tài liệu 31); thêm biểu mới từ giao diện.

### 2026-10-24 — Sửa lỗi màn hình bán trú của ứng dụng giáo viên (DT-20 phần 20b, YCTD-159)

#### Công việc đã thực hiện

- Kiểm thử giao diện `tests/e2e/88-boarding-conduct.spec.ts` (CT-20b-7) lỗi trên CI của nhiều PR vào thứ Bảy: màn hình Bán trú của ứng dụng giáo viên hiện "2 học sinh đăng ký bán trú; 2 suất" thay cho "1 suất (đã chốt)". Tái hiện ở máy ngày thứ Bảy 2026-10-24, 19:25.
- Nguyên nhân: màn hình mở ra tải danh sách ăn của hôm nay, kịch bản đổi sang ngày học gần nhất (thứ Sáu) ngay sau đó; kết quả của lần tải hôm nay về sau ghi đè danh sách của thứ Sáu. Ngày thường hôm nay trùng ngày học nên không lộ. Đây là lỗi của màn hình (người dùng đổi ngày nhanh cũng gặp), không chỉ của kịch bản.
- Sửa `apps/teacher/src/screens/BoardingScreen.tsx`: chỉ nhận kết quả của lần tải mới nhất, bỏ kết quả cũ về sau. Kịch bản không đổi.
- Kiểm thử ở máy ngày thứ Bảy, 19:35: các kịch bản 02, 03, 06, 08, 88 đạt 10/10; typecheck, eslint ứng dụng giáo viên đạt; e2e toàn bộ do CI chạy.

#### Quyết định

- Không thêm YCTD mới (sửa lỗi trong phạm vi YCTD-159). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

### 2026-10-24 — Sửa kiểm thử chập chờn CT-22c2-12 (dạy thay, đổi tiết)

#### Công việc đã thực hiện

- Kiểm thử đơn vị CT-22c2-12 (`apps/api/src/timetables/timetable-generator.test.ts`, YCTD-164) hỏng trên CI của PR 145 (đọc `period_no` của giá trị trống) trong khi nhánh chính vẫn đạt. Nguyên nhân: ca kiểm thử chọn trước người dạy thay rồi mới tìm tiết người đó rảnh, và chọn trước một cặp tiết để đổi; với phương án ngẫu nhiên của máy xếp, có ngày mọi tiết của giáo viên 1 đều trùng tiết người dạy thay, hoặc cặp đã chọn vướng giáo viên dạy lớp khác. Không phụ thuộc thứ trong tuần (vòng tìm đã bỏ qua ngày không có tiết).
- Sửa ca kiểm thử: tìm cùng lúc ngày, tiết và người dạy thay đang rảnh trong 7 ngày tới; tiết trùng dùng để thử chặn dạy thay; đổi tiết thử lần lượt các cặp khác môn của lớp 1B tới cặp đầu tiên máy chủ nhận, các cặp bị chặn phải trả 422. Không đổi mã nghiệp vụ, không đổi kỳ vọng. Chạy lại 15 lần trên máy (ngày thứ Bảy) đều đạt 6/6.

### 2026-10-24 — DT-21 phần 21c: sổ điểm THCS, THPT

#### Công việc đã thực hiện

- Đọc mục 12 của `32_KE_HOACH_THEO_HE_THONG_SO.md` và mã 20c (`assessments`: phân quyền nhập theo phân công, hạn nhập, khoá, nhật ký, phụ huynh xem), 21a (môn THCS, THPT, phân công theo môn).
- Cơ sở dữ liệu: tệp năm học `0087` (cấu hình, điểm, kết quả môn nhận xét, xếp loại, khoá điểm); tệp định danh `0078` để trống. Gói dùng chung: hàm tính trung bình, xếp loại. Máy chủ API: `/scores`. Cổng quản trị: 7.14 Sổ điểm; ứng dụng giáo viên, ứng dụng phụ huynh.
- Kiểm thử: kiểm thử đơn vị `apps/api/src/scores/scores.test.ts` CT-21c-1 đến CT-21c-6 đạt 6/6; chạy cùng `secondary.test.ts`, `subjects.test.ts`, `working-level.test.ts`, `menu-permissions.test.ts` đạt 28/28 (đã thêm 7.14 vào danh sách mục chỉ của THCS, THPT ở CT-19c-1, CT-19c-2); typecheck, eslint, prettier đạt; e2e CT-21c-7 đạt; e2e toàn bộ do CI chạy.
- Sửa dòng "Phiên bản" thừa ở đầu các tài liệu do gộp bản 21a.

#### Quyết định

- Điểm là bảng riêng `score_entries` (không dùng bảng đánh giá Thông tư 27/2020 của 20c vì lưu mức đạt và điểm nguyên); tái dùng quyền, cách phân quyền, khoá của 20c nên không thêm quyền; điểm trung bình tính khi đọc, không lưu; xếp loại học tập gợi ý theo ngưỡng cấu hình, rèn luyện nhập tay; điểm có nguồn `exam` để 22g2 chuyển điểm vào; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-170, `23_LICH_SU_PHIEN_BAN.md` bản 0.115.0.

#### Vấn đề tồn đọng

- Hệ số, số lần đánh giá, ngưỡng xếp loại đối chiếu toàn văn Thông tư 22/2021; quy tắc gợi ý xếp loại rèn luyện; khảo sát hệ thống của Sở cấp THCS, THPT khi Eric có tài khoản.


### 2026-10-24 — DT-21 phần 21a: nền THCS, THPT

#### Công việc đã thực hiện

- Đọc mục 12 của `32_KE_HOACH_THEO_HE_THONG_SO.md` và mã 20a (`subjects`, `curriculum_subjects`, phân công theo môn, môn tự chọn), cây menu theo cấp, e2e 87.
- Cơ sở dữ liệu: tệp năm học `0084` (`subjects.option_group`, giá trị `score` của cách đánh giá, tổ hợp môn, tổ hợp học sinh đăng ký, tổ bộ môn); tệp định danh `0075` để trống. Máy chủ API: bộ môn mẫu THCS, THPT, tổ hợp môn, đăng ký và duyệt đổi tổ hợp, tổ bộ môn; chép sang năm học mới. Cổng quản trị: 7.1, 7.2 dùng chung ba cấp, 7.12 Tổ hợp môn, 7.13 Tổ bộ môn, mục "Tổ hợp môn" ở hồ sơ học sinh.
- Kiểm thử: kiểm thử đơn vị `secondary.test.ts` CT-21a-1 đến CT-21a-5 đạt 5/5 trên nhánh trước khi gộp 20d, 20e, 22c2; sau khi gộp chạy lại được CT-21a-1 và các ca menu CT-19c-1 đến CT-19c-4 (đạt), các ca cần cơ sở dữ liệu chưa chạy lại vì cơ sở dữ liệu định danh dùng chung trên máy đã chạy migration của nhánh khác; typecheck, lint, prettier đạt; e2e CT-21a-6 và e2e toàn bộ do CI chạy, chưa chạy trên máy

#### Quyết định

- Tổ hợp môn mặc định 4 môn lựa chọn thuộc ít nhất 2 nhóm (hằng `COMBINATION_RULE`, cần đối chiếu văn bản gốc); đổi tổ hợp đã duyệt chờ duyệt; duyệt xong môn tự chọn theo tổ hợp; tổ hợp đã có học sinh không đổi môn; nhóm menu 7 đổi tên "Dạy học" dùng chung ba cấp, 7.3 đến 7.5 vẫn chỉ Tiểu học; không thêm quyền mới (dùng quyền danh mục, lớp, hồ sơ học sinh), nên định danh `0075` để trống. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-167, `23_LICH_SU_PHIEN_BAN.md` bản 0.114.0.

#### Vấn đề tồn đọng

- Thời lượng, tên môn THCS, THPT và quy tắc tổ hợp đối chiếu văn bản gốc; khảo sát hệ thống của Sở cấp THCS, THPT khi Eric có tài khoản.
### 2026-10-24 — DT-20 phần 22c2: thời khoá biểu, máy xếp

#### Công việc đã thực hiện

- Đọc mục 11 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, phần 22c của kế hoạch DT-22, mã 22c1 (bản thời khoá biểu, `findTimetableConflicts`) và 20a (môn, số tiết, phân công); rà tiến trình chạy nền `apps/worker` (mới chỉ nối Redis) và cách đặt tên khóa `cacheKey`.
- Máy xếp là hàm thuần ở `packages/server`: xếp tham lam rồi tìm kiếm cục bộ kiểu luyện kim, có giới hạn thời gian, nhiều phương án; đo trên dữ liệu thử 30 lớp, 66 giáo viên, khung 5 ngày × 7 tiết lấp kín: điểm phạt 0 trong khoảng 12 giây mỗi phương án.
- Tiến trình chạy nền nhận việc qua hàng đợi Redis, báo tiến độ, ghi kết quả; máy chủ API dựng đề bài, lưu phương án, tạo bản nháp từ phương án; kiểm tra ngay khi chỉnh tay; dạy thay, đổi tiết; báo cáo; mã QR, trang tra cứu công khai. Tệp năm học `0082`; ảnh Docker `worker`.
- Thêm quy tắc BR-178, chức năng P02-51 đến P02-54, quyền PQ-96, màn hình MH-267 đến MH-270, kịch bản CT-877 đến CT-890, tiêu chí AC-773 đến AC-776. Kết quả ngày 24/10/2026: kiểm thử đơn vị máy xếp `packages/server/src/timetable-solver.test.ts` CT-22c2-1 đến CT-22c2-6 đạt 6/6, tiến trình chạy nền `apps/worker/src/timetable-generation.test.ts` CT-22c2-7 đạt, máy chủ API `apps/api/src/timetables/timetable-generator.test.ts` CT-22c2-8 đến CT-22c2-13 đạt 6/6; kiểm thử đơn vị toàn bộ kho mã 1067/1067 trước khi gộp 20d, 20e (hai ca chạy lại riêng: `leave.test.ts` lỗi hết bộ nhớ của máy, CT-22c2-12 sửa cách chọn cặp đổi tiết); sau khi gộp 20d, 20e chạy lại toàn kho …; kiểm thử giao diện `tests/e2e/93-timetable-generator.spec.ts` (CT-22c2-14) đạt; toàn bộ kiểm thử giao diện 163/163 trước khi gộp 20d, 20e; sau khi gộp 20d đạt 163/164, ca hỏng 04-accounts do cơ sở dữ liệu định danh riêng của lần chạy trước còn tài khoản trùng tên, không liên quan 22c2; sau khi gộp 20e …; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22c2 của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.4. Máy xếp tự viết (heuristic cộng tìm kiếm cục bộ), không dùng dịch vụ ngoài; tiến trình chạy nền chỉ tính toán qua Redis, không đọc cơ sở dữ liệu; kết quả chỉ là bản nháp; dạy thay, đổi tiết ghi theo ngày, không sửa bản ban hành; mã QR trỏ trang công khai của cổng quản trị theo tên miền đang mở; dùng quyền `P02.timetable.manage` của 22c1, định danh 0073 để trống. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-164, `07_QUY_TAC_NGHIEP_VU.md` BR-178, `08_VAI_TRO_NGUOI_DUNG.md` PQ-96, `10_YEU_CAU_CHUC_NANG.md` P02-51 đến P02-54, `11_TIEU_CHI_NGHIEM_THU.md` AC-773 đến AC-776, `12_KIEN_TRUC_HE_THONG.md` CB-11, `14_DAC_TA_GIAO_DIEN.md` MH-267 đến MH-270, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-877 đến CT-890, `23_LICH_SU_PHIEN_BAN.md` 0.113.0.

#### Vấn đề tồn đọng

- Máy xếp chưa giữ cố định tiết xếp tay, chưa xếp riêng một khối; chưa có định mức tiết giáo viên; dạy thay, đổi tiết chưa gửi thông báo; báo cáo chưa xuất tệp; đo lại chất lượng trên dữ liệu của trường khi có (mục 11.6).


### 2026-10-24 — DT-20 phần 20e: học bạ số, khen thưởng cuối năm, hoàn thành chương trình, lên lớp

#### Công việc đã thực hiện

- Đọc mục 11 của `32_KE_HOACH_THEO_HE_THONG_SO.md` và Thông tư 27/2020/TT-BGDĐT; rà kết quả đánh giá, khoá số liệu của 20c, luồng kí nội bộ 16k, mẫu giấy khen 22d, số định danh và nhật ký truy cập, khối kế tiếp của 19b, bước chuyển năm học.
- Cơ sở dữ liệu: tệp năm học `0081_create_student_records`, tệp định danh `0072_add_student_record_permissions`.
- Máy chủ API: danh hiệu, đề nghị, duyệt khen thưởng, giấy khen, tra cứu công khai; hoàn thành chương trình, rèn luyện, kiểm tra lại, lên lớp; học bạ (lập, nhận xét, kí nội bộ, mở lại, tải); phụ huynh xem; kết chuyển năm học.
- Cổng quản trị: 7.8 Học bạ, khen thưởng, lên lớp; ứng dụng phụ huynh: học bạ.
- Thêm quy tắc BR-175 đến BR-177, chức năng P02-48 đến P02-50, kịch bản CT-870 đến CT-876, tiêu chí AC-769 đến AC-772. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/learning-records/learning-records.test.ts` CT-20e-1 đến CT-20e-6 đạt 6/6 (gồm mở năm học mới để kiểm kết chuyển); kiểm thử đơn vị đang có không sửa kỳ vọng (thêm mục 7.8 vào bảng đối chiếu điều kiện cũ của CT-15e-2 và danh sách mục chỉ của Tiểu học của CT-19c-1); kiểm thử đơn vị toàn bộ kho mã đạt 1075/1075; kiểm thử giao diện `tests/e2e/92-learning-records.spec.ts` (CT-20e-7) đạt; toàn bộ kiểm thử giao diện ở máy trước khi gộp 20d đạt 161/163 (spec 92 mới đạt; spec 59 chập chờn; spec 89 thời khoá biểu quá thời gian ở máy, đạt ở CI của 20d), CI chạy lại toàn bộ; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 20e của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.4. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: học bạ là bản chốt dạng JSON lúc lập; người kí phải có quyền xem số định danh để in đủ như mẫu; tệp đã kí chỉ người có quyền xem số định danh hoặc phụ huynh tải được; học sinh hoàn thành tiểu học thôi học ở năm học mới khi kết chuyển.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-163, `07_QUY_TAC_NGHIEP_VU.md` BR-175 đến BR-177, `10_YEU_CAU_CHUC_NANG.md` P02-48 đến P02-50, `11_TIEU_CHI_NGHIEM_THU.md` AC-769 đến AC-772, `14_DAC_TA_GIAO_DIEN.md`, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-870 đến CT-876, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.8. Phiên bản 0.112.0.

#### Vấn đề tồn đọng

- Trang tra cứu mã giấy khen trên cổng công khai; xếp lớp năm mới tự động theo khối năm sau.

### 2026-10-24 — DT-20 phần 20d: sổ đầu bài và điểm danh theo tiết

#### Công việc đã thực hiện

- Đọc mục 11 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà thời khoá biểu của 22c1 (bản đang áp dụng, tiết theo giáo viên), điểm danh theo ngày Mầm non (`attendance_records`), báo vắng của phụ huynh (`absence_records`).
- Cơ sở dữ liệu: tệp năm học `0080`, định danh `0071`. Máy chủ API: sổ đầu bài theo tuần, tiết của tôi trong ngày, chi tiết tiết kèm điểm danh mặc định, ghi tiết, giáo viên ký tiết, Ban giám hiệu ký sổ tuần, tổng hợp chuyên cần, điểm danh theo tiết của con.
- Cổng quản trị: 7.6 Sổ đầu bài, 7.7 Chuyên cần theo tiết. Ứng dụng giáo viên: Sổ đầu bài. Ứng dụng phụ huynh: Điểm danh theo tiết, Báo vắng ở cấp phổ thông.
- Thêm quy tắc BR-174, chức năng P02-45 đến P02-47, quyền PQ-95, màn hình MH-265, MH-266, kịch bản CT-864 đến CT-869, tiêu chí AC-766 đến AC-768. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/class-logs/class-logs.test.ts` CT-20d-1 đến CT-20d-5 đạt 5/5; kiểm thử đơn vị toàn bộ kho mã đạt 1069/1069; kiểm thử giao diện `tests/e2e/91-class-logs.spec.ts` (CT-20d-6) đạt; toàn bộ kiểm thử giao diện đạt 162/163 (CT-20b-7 `88-boarding-conduct.spec.ts` lỗi chập chờn: danh sách ăn chưa làm mới sau khi đổi ngày, không liên quan 20d; lượt chạy trước cùng mã đạt); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 20d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.4. Sổ đầu bài một dòng một lớp, ngày, tiết, lấy tiết theo bản thời khoá biểu đang áp dụng; điểm danh theo tiết là bảng riêng, không đổi điểm danh theo ngày của Mầm non; mặc định vắng có phép khi phụ huynh đã báo vắng ngày đó; Ban giám hiệu ký theo tuần và khoá cả tuần; quyền ký sổ tuần cho Hiệu trưởng, Phó Hiệu trưởng. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-162, `07_QUY_TAC_NGHIEP_VU.md` BR-174, `08_VAI_TRO_NGUOI_DUNG.md` PQ-95, `10_YEU_CAU_CHUC_NANG.md` P02-45 đến P02-47, `11_TIEU_CHI_NGHIEM_THU.md` AC-766 đến AC-768, `14_DAC_TA_GIAO_DIEN.md` MH-265, MH-266, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-864 đến CT-869, `23_LICH_SU_PHIEN_BAN.md` 0.111.0.

#### Vấn đề tồn đọng

- 22c2: dạy thay, đổi tiết theo ngày để ghi sổ đầu bài cho tiết ngoài thời khoá biểu; thông báo điểm danh theo tiết cho phụ huynh; xuất sổ đầu bài.


### 2026-10-24 — Kế hoạch DT-22 thư viện, bồi dưỡng, kho học liệu số (22a, 22e, 22h)

#### Công việc đã thực hiện

- Đọc bản kế hoạch DT-22 đã được Eric duyệt (các phần còn lại 22a, 22e, 22h), mục 9 (DT-18), 11 (DT-20), 12 (DT-21, PR 140) và mã trên nhánh chính: kho hồ sơ 18e (`professional_*`, `DossierSigner`, `my-work`), `files` và `FileStorage`, giấy khen có mã tra cứu của 22d, `staff_certificates`, `lesson_plans`, `subjects` (20a); rà bảng có tên gần giống (`library_items` của Mầm non, `asset_loans`) để không dùng nhầm.
- Thêm mục 13 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.45): kế hoạch DT-22 gồm bốn phần 22a, 22e, 22h1, 22h2 chạy ba đợt; phạm vi chi tiết; quyết định thiết kế; rủi ro; bảng tiến độ.
- Ghi YCTD-180 (chỉ đổi tài liệu).

#### Quyết định

- AI là thành phần riêng, mặc định tắt (Eric chốt): ba phần của DT-22 không gọi AI, YCTD-185 giữ chỗ; khách hàng là trường đơn lẻ: chia sẻ liên trường chỉ làm gói tệp chạy nội bộ, bản thật chờ DT-SaaS. Claude tự chọn phần còn lại theo ủy quyền của Eric ngày 2026-10-11.
- Tách 22h thành 22h1 (lõi, không cần 22g1, làm ngay sau 22a hoặc 22e) và 22h2 (câu hỏi, gói; chờ 22g1 của DT-21 gộp); câu hỏi chỉ ở ngân hàng của 22g1, kho tham chiếu.
- Giữ sẵn YCTD-181 đến YCTD-185 (dự phòng đến YCTD-189), migration năm học từ 0100, hệ thống từ 0040, định danh từ 0090, e2e từ `120-`; chừa khoảng trống sau DT-21 để DT-20, DT-21 không va số.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-180, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 13. Không đổi mã nguồn, không đổi phiên bản phần mềm.

#### Vấn đề tồn đọng

- 22h2 chờ 22g1 (DT-21); đọc văn bản gốc (chuẩn thư viện phổ thông, quy chế bồi dưỡng thường xuyên, khung năng lực số, giấy phép học liệu) trước khi làm từng phần; PR này và PR 140 (YCTD-166) cùng sửa đầu `02`, `24`, `index.md` nên phần gộp sau xử lý xung đột và đánh lại số phiên bản tài liệu.

### 2026-10-24 — Kế hoạch DT-21 THCS và THPT (kèm 22g kiểm tra, đánh giá)

#### Công việc đã thực hiện

- Đọc dòng DT-21 của kế hoạch DT-18 và phần 22g của kế hoạch DT-22; đọc mục 10 (DT-19), mục 11 (DT-20) và mã trên nhánh chính: `subjects`, `curriculum_subjects`, phân công giảng dạy theo môn (20a), nề nếp và thi đua lớp (20b), khung giờ tiết, bản thời khoá biểu, hàm xung đột (22c1), khối K6 đến K12 và `curricula` (19b).
- Thêm mục 12 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.44): kế hoạch DT-21 gồm chín phần 21a, 22g1, 21b, 21c, 21d, 21e, 22g2, 21f, 21g chạy năm đợt; bảng tái dùng và làm mới; rủi ro, cách kiểm; bảng tiến độ.
- Ghi YCTD-166 (chỉ đổi tài liệu).

#### Quyết định

- THCS và THPT chung khung, tách phần theo chức năng; tách 22g thành 22g1 (đề, làm sớm) và 22g2 (chấm, chuyển điểm vào sổ điểm 21c, không có bảng điểm thứ hai); thi trực tuyến cho học sinh để lại; hồ sơ thi chạy nội bộ; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Giữ sẵn YCTD-167 đến YCTD-175, migration năm học 0084 đến 0092, hệ thống 0028 và 0029, định danh 0075 đến 0083, e2e `95-` đến `103-`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-166, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 12. Không đổi mã nguồn, không đổi phiên bản phần mềm.

#### Vấn đề tồn đọng

- Khảo sát hệ thống của Sở cấp THCS, THPT khi Eric có tài khoản; đọc toàn văn Thông tư 22/2021/TT-BGDĐT, quy chế xét tốt nghiệp, thi hiện hành trước khi làm 21c, 21e, 21f; 20c, 20d, 20e, 22c2, 20f của DT-20 chưa gộp, các phần DT-21 phụ thuộc ghi ở 12.3.

### 2026-10-23 — DT-20 phần 20c: đánh giá học sinh theo Thông tư 27/2020

#### Công việc đã thực hiện

- Đọc mục 11 của `32_KE_HOACH_THEO_HE_THONG_SO.md` và Thông tư 27/2020/TT-BGDĐT; rà môn học, chương trình, phân công theo môn của 20a, lịch học kỳ theo cấp của 19b.
- Cơ sở dữ liệu: tệp năm học `0079_create_student_assessments`, tệp định danh `0070_add_assessment_permissions`.
- Máy chủ API: cấu hình đánh giá theo cấp, nạp mặc định; nhập kết quả định kỳ theo phân công, hạn nhập, khoá số liệu; nhận xét thường xuyên; tổng hợp cuối kỳ; gợi ý, xác nhận cuối năm; phụ huynh xem; chuyển cấu hình sang năm học mới.
- Cổng quản trị: 7.3 Đánh giá học sinh; ứng dụng giáo viên: màn hình đánh giá; ứng dụng phụ huynh: kết quả đánh giá.
- Thêm quy tắc BR-171 đến BR-173, chức năng P02-42 đến P02-44, kịch bản CT-857 đến CT-863, tiêu chí AC-762 đến AC-765. Kết quả ngày 23/10/2026: kiểm thử đơn vị `apps/api/src/assessments/assessments.test.ts` CT-20c-1 đến CT-20c-6 đạt 6/6; kiểm thử đơn vị đang có không sửa kỳ vọng (thêm mục 7.3 vào bảng đối chiếu điều kiện cũ của CT-15e-2 và danh sách mục chỉ của Tiểu học của CT-19c-1); kiểm thử đơn vị toàn bộ kho mã đạt 1064/1064; kiểm thử giao diện `tests/e2e/90-student-assessments.spec.ts` (CT-20c-7) đạt; toàn bộ kiểm thử giao diện trước khi gộp 22c1 đạt 160/161 (spec 90 mới đạt; spec 38 nhắc nợ chập chờn, không liên quan), sau khi gộp chạy ở CI; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 20c của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.4. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: mức đạt có hạng để quy tắc cuối năm không phụ thuộc mã; chủ nhiệm nhập môn chưa có giáo viên bộ môn; hạn nhập trống theo ngày kết thúc học kỳ; khoá theo kỳ và lớp; phụ huynh chỉ thấy kỳ đã khoá.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-161, `07_QUY_TAC_NGHIEP_VU.md` BR-171 đến BR-173, `10_YEU_CAU_CHUC_NANG.md` P02-42 đến P02-44, `11_TIEU_CHI_NGHIEM_THU.md` AC-762 đến AC-765, `14_DAC_TA_GIAO_DIEN.md`, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-857 đến CT-863, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.8. Phiên bản 0.110.0.

#### Vấn đề tồn đọng

- Nhập Excel theo mẫu lớp × môn, xuất bảng tổng hợp ra tệp; màn hình sửa thư viện câu nhận xét, mức đạt, danh mục ở cổng (điểm cuối đã có).

### 2026-10-23 — DT-20 phần 22c1: thời khoá biểu, phần khung

#### Công việc đã thực hiện

- Đọc mục 11 của `32_KE_HOACH_THEO_HE_THONG_SO.md` và phần 22c của kế hoạch DT-22; rà bảng `timetables` của Giảng dạy, lịch theo cấp (YCTD-152), công cụ nhập Excel (16a), trang thời khoá biểu chờ sẵn của website (18f), môn học và phân công theo môn (YCTD-158).
- Cơ sở dữ liệu: tệp hệ thống `0026`, năm học `0078`, định danh `0069`. Máy chủ API: khung giờ tiết, bản thời khoá biểu, tiết theo lớp, kiểm tra xung đột (hàm thuần dùng chung với 22c2), ban hành, nhập Excel, xem bản đang áp dụng; trang website.
- Cổng quản trị: 7.3 Khung giờ tiết học, 7.4 Thời khoá biểu. Ứng dụng giáo viên: Lịch dạy của tôi. Ứng dụng phụ huynh: Thời khoá biểu của con.
- Thêm quy tắc BR-170, chức năng P02-39 đến P02-41, quyền PQ-94, màn hình MH-263, MH-264, kịch bản CT-851 đến CT-856, tiêu chí AC-759 đến AC-761. Kết quả ngày 23/10/2026: kiểm thử đơn vị `apps/api/src/timetables/timetables.test.ts` CT-22c1-1 đến CT-22c1-5 đạt 5/5; kiểm thử đơn vị toàn bộ kho mã đạt 1058/1058 (không sửa kỳ vọng của kiểm thử đang có, trừ danh sách đường dẫn của CT-19c-1); kiểm thử giao diện `tests/e2e/89-timetables.spec.ts` (CT-22c1-6) đạt; toàn bộ kiểm thử giao diện đạt 161/161; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22c1 của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.4. Thời khoá biểu theo môn là bảng mới, có phiên bản và ngày áp dụng; giáo viên của tiết theo phân công; ban hành chặn khi còn xung đột cứng; nhập Excel một dòng một tiết; khung giờ lưu ở cơ sở dữ liệu hệ thống cạnh lịch theo cấp; quyền lập, ban hành cho Hiệu trưởng, Phó Hiệu trưởng. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-160, `07_QUY_TAC_NGHIEP_VU.md` BR-170, `08_VAI_TRO_NGUOI_DUNG.md` PQ-94, `10_YEU_CAU_CHUC_NANG.md` P02-39 đến P02-41, `11_TIEU_CHI_NGHIEM_THU.md` AC-759 đến AC-761, `14_DAC_TA_GIAO_DIEN.md` MH-263, MH-264, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-851 đến CT-856, `23_LICH_SU_PHIEN_BAN.md` 0.109.0.

#### Vấn đề tồn đọng

- 22c2: máy xếp tự động, chỉnh tay có kiểm tra ngay, dạy thay, đổi tiết, định mức tiết, báo cáo tiết dạy, mã QR; 20d dùng bản đang áp dụng làm nguồn sổ đầu bài, điểm danh theo tiết.


### 2026-10-23 — DT-20 phần 20b: bán trú Tiểu học; nề nếp và thi đua lớp

#### Công việc đã thực hiện

- Đọc mục 11 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà dịch vụ bán trú, số suất của bếp (`classCounts`), kiểm thực 22b, báo cơm, tính tiền ăn theo ngày có mặt.
- Cơ sở dữ liệu: tệp năm học `0077_create_boarding_and_conduct`, tệp định danh `0068_add_boarding_conduct_permissions`.
- Máy chủ API: bán trú lớp ngoài Mầm non (danh sách ăn, cắt suất, chốt, mở lại, phụ huynh cắt suất), bếp và tiền ăn đọc danh sách bán trú; nề nếp (cấu hình, tiêu chí, ghi điểm, xếp hạng), chuyển cấu hình sang năm học mới.
- Cổng quản trị: 4.8 Bán trú, 4.9 Nề nếp, thi đua lớp (chỉ Tiểu học), thẻ nề nếp ở 1.4 Cấu hình trường; ứng dụng giáo viên, phụ huynh theo cấp.
- Thêm quy tắc BR-167 đến BR-169, chức năng P04-07, P02-37, P02-38, kịch bản CT-844 đến CT-850, tiêu chí AC-755 đến AC-758. Kết quả ngày 23/10/2026: kiểm thử đơn vị `apps/api/src/boarding/boarding.test.ts` CT-20b-1 đến CT-20b-6 đạt 6/6; kiểm thử đơn vị đang có không sửa kỳ vọng (thêm hai mục menu vào bảng đối chiếu điều kiện cũ của CT-15e-2; CT-19c-1, CT-19c-2 so cây menu Mầm non với cây gốc bỏ hai mục chỉ của Tiểu học, cây menu Mầm non giữ nguyên); kiểm thử đơn vị toàn bộ kho mã đạt 1053/1053; kiểm thử giao diện `tests/e2e/88-boarding-conduct.spec.ts` (CT-20b-7) đạt; toàn bộ kiểm thử giao diện đạt 160/160; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 20b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.4. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: giờ chốt cắt suất trong ngày dùng giờ vào học của đơn vị; danh sách ăn là đăng ký trừ cắt suất, chốt thì lưu số suất; tiền ăn lớp ngoài Mầm non theo ngày đã chốt mà không cắt suất; điểm tuần là điểm nền cộng điểm ghi, tháng và học kỳ lấy trung bình tuần.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-159, `07_QUY_TAC_NGHIEP_VU.md` BR-167 đến BR-169, `10_YEU_CAU_CHUC_NANG.md` P04-07, P02-37, P02-38, `11_TIEU_CHI_NGHIEM_THU.md` AC-755 đến AC-758, `14_DAC_TA_GIAO_DIEN.md`, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-844 đến CT-850, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.8. Phiên bản 0.108.0.

#### Vấn đề tồn đọng

- Không.

### 2026-10-23 — DT-20 phần 20a: nền Tiểu học

#### Công việc đã thực hiện

- Đọc mục 11 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà `curricula`, khối mẫu (YCTD-152), phân công phụ trách lớp, chuyển năm học, chi tiết hồ sơ học sinh; tra bảng thời lượng cấp Tiểu học của Chương trình giáo dục phổ thông 2018.
- Cơ sở dữ liệu: tệp năm học `0076_create_subjects`. Máy chủ API: môn học, nạp bộ mẫu, số tiết theo khối, phân công theo môn, tổng tiết của giáo viên, môn tự chọn; chép sang năm học mới.
- Cổng quản trị: 7.1 Môn học và hoạt động giáo dục, 7.2 Phân công giảng dạy theo môn, khối "Môn tự chọn" ở hồ sơ học sinh; nhóm menu Tiểu học.
- Thêm quy tắc BR-166, chức năng P02-34 đến P02-36, quyền PQ-93, màn hình MH-261, MH-262, kịch bản CT-838 đến CT-843, tiêu chí AC-752 đến AC-754. Kết quả ngày 23/10/2026: kiểm thử đơn vị `apps/api/src/subjects/subjects.test.ts` CT-20a-1 đến CT-20a-5 đạt 5/5; kiểm thử đơn vị toàn bộ kho mã đạt 1047/1047 (không sửa kỳ vọng của kiểm thử đang có, trừ CT-19c-1 như trên); kiểm thử giao diện `tests/e2e/87-primary-subjects.spec.ts` (CT-20a-6) đạt; toàn bộ kiểm thử giao diện 159 kịch bản: hai lượt chạy riêng cuối cùng mỗi lượt đạt 158/159, mỗi lượt hỏng một kịch bản khác nhau do môi trường máy (58 khi máy chủ giao diện từ chối kết nối, 23 khi quá thời gian 30 giây), mọi kịch bản đều đạt ở ít nhất một lượt; CI là kết quả chính; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 20a của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11.4. Danh mục môn trống, nạp bộ mẫu bằng nút; mã môn có tiền tố cấp; một môn của lớp một giáo viên, một giáo viên nhiều môn; lớp Mầm non giữ tên môn tự do; không thêm quyền (dùng quyền quản lý danh mục, quản lý lớp, quản lý hồ sơ học sinh), để trống migration định danh 0067. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-158, `07_QUY_TAC_NGHIEP_VU.md` BR-166, `08_VAI_TRO_NGUOI_DUNG.md` PQ-93, `10_YEU_CAU_CHUC_NANG.md` P02-34 đến P02-36, `11_TIEU_CHI_NGHIEM_THU.md` AC-752 đến AC-754, `14_DAC_TA_GIAO_DIEN.md` MH-261, MH-262, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-838 đến CT-843, `23_LICH_SU_PHIEN_BAN.md` 0.107.0.

#### Vấn đề tồn đọng

- 22c1 dùng phân công theo môn làm nguồn thời khoá biểu và kiểm định mức tiết; 20c dùng cách đánh giá của môn; khảo sát Sở cấp Tiểu học để đánh lại số menu, thêm trường hồ sơ.


### 2026-10-23 — DT-19 phần 19f: chuyển và kiểm dữ liệu Mầm non, dữ liệu mẫu đa cấp

#### Công việc đã thực hiện

- Đọc mục 10 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà lệnh chạy tệp thay đổi cấu trúc (năm đã đóng không chạy, QU-11), bản trình diễn 18h.
- Cơ sở dữ liệu: tệp năm học `0075_backfill_school_levels`, tệp hệ thống `0025_backfill_school_levels`, lệnh `level-check`.
- Bản trình diễn: bước "Trường liên cấp: Tiểu học, THCS".
- Thêm quy tắc BR-164 đến BR-165, chức năng P01-45 đến P01-46, kịch bản CT-833 đến CT-837, tiêu chí AC-749 đến AC-751, QĐ-24, mục 10.10 của tài liệu 32. Kết quả ngày 23/10/2026: kiểm thử đơn vị `database/src/level-check.test.ts` CT-19f-1 đến CT-19f-3 đạt 3/3, `apps/api/src/demo/administration-18h.test.ts` CT-19f-4 đạt (CT-18h-1 đến CT-18h-9 vẫn đạt); kiểm thử đơn vị toàn bộ kho mã 1042/1042; kiểm thử giao diện `tests/e2e/86-multi-level.spec.ts` (CT-19f-5) đạt; toàn bộ kiểm thử giao diện 158/158; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 19f của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.4. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: tệp vá chỉ vá phần còn thiếu, không tắt cấp; tệp định danh 0066 để trống vì phạm vi cấp không có dòng nghĩa là mọi cấp; năm đã đóng không chạy tệp năm học (QU-11), lệnh kiểm đọc được; trường liên cấp của bản trình diễn là điểm trường Hoa Mai có thêm Tiểu học, THCS vì mỗi bộ cơ sở dữ liệu là một trường.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-156, `07_QUY_TAC_NGHIEP_VU.md` BR-164 đến BR-165, `10_YEU_CAU_CHUC_NANG.md` P01-45 đến P01-46, `11_TIEU_CHI_NGHIEM_THU.md` AC-749 đến AC-751, `12_KIEN_TRUC_HE_THONG.md` QĐ-24, `14_DAC_TA_GIAO_DIEN.md`, `16_CO_SO_DU_LIEU.md`, `21_KICH_BAN_KIEM_THU.md` CT-833 đến CT-837, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.9, 10.10. Phiên bản 0.106.0.

#### Vấn đề tồn đọng

- DT-20, DT-21 bắt đầu theo mục 10.10 của tài liệu 32; khảo sát hệ thống của Sở cho Tiểu học khi Eric có tài khoản.

### 2026-10-23 — Kế hoạch DT-20 Tiểu học (kèm 22c thời khoá biểu)

#### Công việc đã thực hiện

- Đọc dòng DT-20 của kế hoạch DT-18 và phần 22c của kế hoạch DT-22 (cỡ khoảng 2 đơn vị, khung và nhập Excel trước, máy xếp sau); đọc mục 10 (DT-19) và mã hiện tại: `school_levels`, `SchoolLevelResolver`, khối, lớp, `curricula`, lịch theo cấp, `LEVEL_FEATURES`, `class_staff_assignments`, bảng `timetables` của phân hệ Giảng dạy, điểm danh theo ngày, bếp, 22b, bảng thi đua cán bộ 22d.
- Thêm mục 11 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.38): kế hoạch DT-20 gồm tám phần 20a, 20b, 22c1, 20c, 20d, 20e, 22c2, 20f chạy bốn đợt; rủi ro, cách kiểm; bảng tiến độ.
- Ghi YCTD-157 (chỉ đổi tài liệu).

#### Quyết định

- Tách 22c thành 22c1 (khung, nhập Excel, kiểm tra xung đột, ban hành) và 22c2 (máy xếp, chỉnh tay, dạy thay); thời khoá biểu theo môn là bảng mới, giữ bảng `timetables` của Mầm non; danh mục môn, mẫu nhận xét, học bạ, biểu EMIS cấu hình được vì chưa khảo sát Sở cấp Tiểu học; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Giữ sẵn YCTD-158 đến YCTD-165, migration năm học 0076 đến 0083, hệ thống 0026 và 0027, định danh 0067 đến 0074, e2e `87-` đến `94-`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-157, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 11. Không đổi mã nguồn, không đổi phiên bản phần mềm.

#### Vấn đề tồn đọng

- Khảo sát hệ thống của Sở cấp Tiểu học khi Eric có tài khoản; đọc toàn văn Thông tư 27/2020/TT-BGDĐT và văn bản về học bạ số trước khi làm 20c, 20e.


### 2026-10-23 — DT-19 phần 19e: cổng phụ huynh và ứng dụng giáo viên đa cấp

#### Công việc đã thực hiện

- Đọc mục 10 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà danh sách con, các nút chức năng của ứng dụng phụ huynh, ứng dụng giáo viên, tin tức và người nhận thông báo.
- Gói dùng chung: `LEVEL_FEATURES`, `hasLevelFeature`, `levelOf`, `matchesAudienceLevels`. Ứng dụng phụ huynh, giáo viên dùng gói dùng chung.
- Cơ sở dữ liệu: tệp năm học `0074_add_news_audience_levels`. Máy chủ API: cấp của con ở danh sách học sinh; phạm vi xem tin theo cấp con học; người nhận tin theo cấp; `POST /news-recipients/count`.
- Ứng dụng phụ huynh: tên cấp ở thẻ con khi các con học nhiều cấp; ẩn chức năng chỉ của Mầm non ở con cấp khác. Ứng dụng giáo viên: lớp xếp theo cấp, tên cấp, ẩn chức năng chỉ của Mầm non ở lớp cấp khác. Cổng quản trị: ô "Cấp nhận tin" và số người nhận ở "Thêm tin tức".
- Thêm quy tắc BR-163, chức năng P01-43 đến P01-44, quyền PQ-92, màn hình MH-260, kịch bản CT-828 đến CT-832, tiêu chí AC-746 đến AC-748. Kết quả ngày 23/10/2026: kiểm thử đơn vị `apps/api/src/school-levels/multi-level-apps.test.ts` CT-19e-1 đến CT-19e-4 đạt 4/4; kiểm thử đơn vị toàn bộ kho mã đạt 1038/1038 (không sửa kỳ vọng của kiểm thử đang có); kiểm thử giao diện `tests/e2e/85-multi-level-apps.spec.ts` (CT-19e-5) đạt; toàn bộ kiểm thử giao diện đạt 157/157; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 19e của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.4. Chức năng chỉ của Mầm non: điểm danh và báo vắng theo ngày, nhật ký, chăm sóc hằng ngày, báo cơm, báo cáo tăng trưởng theo tháng tuổi, hồ sơ cuối cấp; đưa đón, dặn thuốc, thực đơn dùng cho mọi cấp; cấp nhận tin lưu ở tin tức (chưa ở hoạt động lớp, thư viện); cấp nhận chỉ dùng cho phạm vi toàn trường, đơn vị; số người nhận đếm tài khoản phụ huynh của trẻ đang học. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-155, `07_QUY_TAC_NGHIEP_VU.md` BR-163, `08_VAI_TRO_NGUOI_DUNG.md` PQ-92, `10_YEU_CAU_CHUC_NANG.md` P01-43 đến P01-44, `11_TIEU_CHI_NGHIEM_THU.md` AC-746 đến AC-748, `14_DAC_TA_GIAO_DIEN.md` MH-260, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-828 đến CT-832, `23_LICH_SU_PHIEN_BAN.md` 0.105.0.

#### Vấn đề tồn đọng

- DT-20, DT-21 thêm chức năng của cấp khác (điểm danh theo tiết, sổ điểm, sổ đầu bài, học bạ) vào `LEVEL_FEATURES` và chặn ở máy chủ; tin gửi theo khối làm cùng DT-20.


### 2026-10-22 — DT-19 phần 19d: số liệu theo cấp học

#### Công việc đã thực hiện

- Đọc mục 10 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà các chỗ tính theo tháng tuổi, nhóm tuổi Mầm non ở thống kê, EMIS, chấm công và suất ăn, tăng trưởng, hồ sơ cuối cấp, biểu phí, nhập Excel, kí hồ sơ.
- Cơ sở dữ liệu: tệp năm học `0073_add_fee_schedule_school_level`.
- Máy chủ API: tham số cấp dùng chung, lọc cấp ở thống kê, chấm công và suất ăn; biểu mẫu Mầm non chỉ tính cấp Mầm non; biểu phí theo cấp; kí hồ sơ theo cấp; kiểm bốn mã ở danh mục văn bản.
- Cổng quản trị: ô "Cấp học" ở thống kê, báo cáo chấm công và suất ăn, biểu phí.
- Thêm quy tắc BR-160 đến BR-162, chức năng P17-29, P17-30, P05-14, kịch bản CT-820 đến CT-827, tiêu chí AC-742 đến AC-745. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/statistics/level-reports.test.ts` CT-19d-1 đến CT-19d-7 đạt 7/7; kiểm thử đơn vị đang có không sửa kỳ vọng; kiểm thử đơn vị toàn bộ kho mã 1034/1034; kiểm thử giao diện `tests/e2e/84-level-reports.spec.ts` (CT-19d-8) đạt; toàn bộ kiểm thử giao diện 154/156 ở lượt cuối trên máy (hai ca 59 quên mật khẩu, 65 gửi thiết bị lên cấp trên chập chờn, không thuộc phần sửa và đạt ở các lượt trước; spec 84 đạt), CI là kết quả chính thức; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 19d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.4. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: không có tham số cấp thì chỉ lọc khi người dùng bị giới hạn cấp; biểu mẫu Mầm non bỏ trẻ của lớp cấp khác, giữ trẻ chưa xếp lớp; biểu phí mỗi cấp một chuỗi phiên bản; lớp cấp khác ở báo cáo chấm công và suất ăn thành nhóm theo cấp.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-154, `07_QUY_TAC_NGHIEP_VU.md` BR-160 đến BR-162, `10_YEU_CAU_CHUC_NANG.md` P17-29, P17-30, P05-14, `11_TIEU_CHI_NGHIEM_THU.md` AC-742 đến AC-745, `14_DAC_TA_GIAO_DIEN.md`, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-820 đến CT-827, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.9. Phiên bản 0.104.0.

#### Vấn đề tồn đọng

- Biểu EMIS, chuẩn tăng trưởng, hồ sơ chuyển cấp của Tiểu học, THCS, THPT ở DT-20, DT-21; lệnh kiểm đối chiếu nhiều năm học ở 19f.

### 2026-10-22 — DT-19 phần 19c: menu và phân hệ theo cấp học

#### Công việc đã thực hiện

- Đọc mục 10 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà cây menu (`portal-menu.ts`), ô ngữ cảnh, cây quyền, Truy cập nhanh và các chữ "Trẻ" ghi cứng ở cổng quản trị.
- Gói dùng chung: thuộc tính `levels`, `levelTitle` ở cây menu, `portalWorkspacesForLevels`, `portalMenuPathsOutsideLevels`; bảng nhãn `SCHOOL_LEVEL_TERMS`, `schoolLevelTerms`, `workingSchoolLevels`, tham số `school_level`.
- Cơ sở dữ liệu: tệp định danh `0065_create_user_preferences`. Dịch vụ định danh: `PUT /auth/me/working-school-level`, `/auth/me` trả `working_school_level`. Máy chủ API: `SchoolLevelResolver.requested`, `GET /portal-context/school-levels` trả cấp người dùng được xem, `/me/quick-links` lọc theo cấp bật.
- Cổng quản trị: bộ chọn "Cấp học" ở thanh đầu trang, menu và tên phân hệ theo cấp đang làm việc, ô ngữ cảnh theo cấp, cây quyền theo cấp bật, nhãn "Trẻ"/"Học sinh" ở 4.7 Điểm danh, phiếu thu, trang chủ.
- Thêm quy tắc BR-159, chức năng P01-41 đến P01-42, quyền PQ-91, màn hình MH-259, kịch bản CT-811 đến CT-819, tiêu chí AC-739 đến AC-741. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/school-levels/working-level.test.ts` CT-19c-1 đến CT-19c-8 đạt 8/8; kiểm thử đơn vị toàn bộ kho mã đạt 1027/1027 (không sửa kỳ vọng của kiểm thử đang có); kiểm thử giao diện `tests/e2e/83-school-level-menu.spec.ts` (CT-19c-9) đạt; toàn bộ kiểm thử giao diện đạt 155/155; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 19c của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.4. Lưu cấp đang làm việc ở cơ sở dữ liệu định danh (giữ qua các máy) thay vì chỉ ở trình duyệt; mục gắn Mầm non gồm hồ sơ cuối cấp mầm non, biểu EMIS đầu năm, cuối năm, báo cáo giáo dục mầm non cuối năm, cân nặng chiều cao, hoàn thành chương trình; "Tất cả" ở trường liên cấp dùng thuật ngữ "Học sinh", "Lớp"; tên mục menu theo Sở giữ nguyên ở mọi cấp; Truy cập nhanh và cây quyền lọc theo cấp bật, menu lọc theo cấp đang làm việc. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-153, `07_QUY_TAC_NGHIEP_VU.md` BR-159, `08_VAI_TRO_NGUOI_DUNG.md` PQ-91, `10_YEU_CAU_CHUC_NANG.md` P01-41 đến P01-42, `11_TIEU_CHI_NGHIEM_THU.md` AC-739 đến AC-741, `14_DAC_TA_GIAO_DIEN.md` MH-259, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-811 đến CT-819, `23_LICH_SU_PHIEN_BAN.md` 0.103.0.

#### Vấn đề tồn đọng

- 19d cho thống kê, báo cáo, EMIS nhận tham số `school_level` và chuyển chữ "Trẻ" còn lại ở trang thống kê, nhập Excel, báo cáo sang bảng nhãn; 19e đưa cấp vào ứng dụng phụ huynh, giáo viên.


### 2026-10-22 — DT-19 phần 19b: cấu trúc theo cấp học

#### Công việc đã thực hiện

- Đọc mục 10 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, mã khối, lớp, đơn vị, lịch năm học, bước chuyển năm học, nhập lớp từ Excel; rà mọi chỗ đọc `academic_terms`, `school_weeks`.
- Cơ sở dữ liệu: tệp năm học `0072_add_school_level_structure`, tệp hệ thống `0024_add_school_level_calendar`.
- Máy chủ API: khối theo cấp, nạp khối mẫu, chương trình theo cấp, lớp theo cấp, cấp của đơn vị, lịch theo cấp, khối kế tiếp; chỗ đọc lịch đang có chỉ đọc lịch chung.
- Cổng quản trị: danh mục bậc học (cấp học, khối mẫu, thẻ Chương trình), biểu mẫu lớp, lịch năm học, cây đơn vị.
- Thêm quy tắc BR-155 đến BR-158, chức năng P01-37 đến P01-40, kịch bản CT-801 đến CT-810, tiêu chí AC-734 đến AC-738. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/catalogs/level-structure.test.ts` CT-19b-1 đến CT-19b-8 đạt 8/8, `apps/api/src/academic-years/year-transition.test.ts` CT-19b-9 đạt; kiểm thử đơn vị đang có không sửa kỳ vọng; kiểm thử đơn vị toàn bộ kho mã 1019/1019; kiểm thử giao diện `tests/e2e/82-level-structure.spec.ts` (CT-19b-10) đạt; toàn bộ kiểm thử giao diện 154/154; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 19b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.4. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: mã khối mẫu K1 đến K12; chương trình mặc định Mầm non `CT-GDMN`; lớp ngoài Mầm non từ chối ô riêng Mầm non thay vì bỏ qua; đơn vị mới lấy cấp của Trường chính; lịch riêng của cấp là bộ học kỳ, tuần riêng (trống là lịch chung); giao diện đa cấp chỉ hiện khi trường bật từ hai cấp.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-152, `07_QUY_TAC_NGHIEP_VU.md` BR-155 đến BR-158, `10_YEU_CAU_CHUC_NANG.md` P01-37 đến P01-40, `11_TIEU_CHI_NGHIEM_THU.md` AC-734 đến AC-738, `14_DAC_TA_GIAO_DIEN.md` (MH-34, MH-45, biểu mẫu lớp, cây đơn vị), `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-801 đến CT-810, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.9. Phiên bản 0.102.0.

#### Vấn đề tồn đọng

- Thống kê, báo cáo, EMIS, biểu phí theo cấp ở 19d; lệnh kiểm đối chiếu nhiều năm học ở 19f.

### 2026-10-22 — DT-19 phần 19a: nền cấp học của trường

#### Công việc đã thực hiện

- Đọc mục 10 của `32_KE_HOACH_THEO_HE_THONG_SO.md`; rà các cột cấp rời (18d, 18f, 18g, 22i), ô ngữ cảnh `portal-shell`, phân quyền ở dịch vụ định danh.
- Cơ sở dữ liệu: tệp hệ thống `0023_create_school_levels`, tệp định danh `0064_add_user_school_levels`.
- Máy chủ API: `SchoolLevelResolver`, `GET, PUT /school-levels`; ô ngữ cảnh, website đọc cấp từ bảng mới. Dịch vụ định danh: `/auth/me` trả phạm vi cấp, `GET, PUT /users/{id}/school-levels`.
- Cổng quản trị: thẻ "Cấp học của trường" ở 1.4 Cấu hình trường; khối "Phạm vi cấp học" ở chi tiết tài khoản (trường từ hai cấp); ô cấp học ở cấu hình website chỉ hiển thị.
- Thêm quy tắc BR-154, chức năng P01-35 đến P01-36, quyền PQ-90, màn hình MH-258, kịch bản CT-795 đến CT-800, tiêu chí AC-731 đến AC-733. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/school-levels/school-levels.test.ts` CT-19a-1 đến CT-19a-5 đạt 5/5; kiểm thử đơn vị toàn bộ kho mã 1010/1010 đạt (không sửa kỳ vọng của kiểm thử đang có); kiểm thử giao diện `tests/e2e/81-school-levels.spec.ts` (CT-19a-6) đạt; toàn bộ kiểm thử giao diện 153/153 đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 19a của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10.4. Tắt cấp chỉ ẩn, không chặn khi cấp có lớp (cảnh báo số lớp); phải bật ít nhất một cấp; quyền cấu hình cấp học chỉ cho Hiệu trưởng; phạm vi cấp do người quản lý tài khoản đặt; bộ nhớ đệm trong tiến trình 30 giây. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-151, `07_QUY_TAC_NGHIEP_VU.md` BR-154, `08_VAI_TRO_NGUOI_DUNG.md` PQ-90, `10_YEU_CAU_CHUC_NANG.md` P01-35 đến P01-36, `11_TIEU_CHI_NGHIEM_THU.md` AC-731 đến AC-733, `14_DAC_TA_GIAO_DIEN.md` MH-258, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-795 đến CT-800, `23_LICH_SU_PHIEN_BAN.md` 0.101.0.

#### Vấn đề tồn đọng

- 19b thêm cột cấp ở khối, lớp thì đổi bộ đếm lớp theo cấp sang cột mới; 19c thêm bộ chọn cấp đang làm việc và menu theo cấp.


### 2026-10-22 — DT-18 phần 22f: bảo đảm chất lượng, tự đánh giá

#### Công việc đã thực hiện

- Đọc mục 9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, kế hoạch DT-22 (phần 22f và câu 4), khảo sát mục 1.7 của Sở, mã 17e (1.7) và 18e (kho hồ sơ chuyên môn); đối chiếu cấu trúc tiêu chuẩn, tiêu chí của Thông tư 19/2018/TT-BGDĐT (kiểm định chất lượng giáo dục và công nhận đạt chuẩn quốc gia đối với trường mầm non) và các văn bản sửa đổi, bổ sung.
- Cơ sở dữ liệu: tệp năm học `0071_create_quality_assurance`, tệp định danh `0063_add_quality_assurance_permissions`.
- Máy chủ API: bộ tiêu chuẩn, đợt, hội đồng, nhóm công tác, phiếu, minh chứng (tải tệp, nguồn văn bản, kế thừa), kế hoạch cải tiến, báo cáo Word, PDF, công nhận, bước chuyển năm học.
- Cổng quản trị: phân hệ "Bảo đảm chất lượng" với 1.1 đến 1.3, 2.1, 2.2.
- Thêm quy tắc BR-151 đến BR-153, chức năng P09-40 đến P09-44, quyền PQ-89, màn hình MH-253 đến MH-257, kịch bản CT-786 đến CT-794, tiêu chí AC-725 đến AC-730. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/quality-assurance/quality-assurance.test.ts` CT-22f-1 đến CT-22f-8 đạt 8/8; kiểm thử đơn vị toàn bộ kho mã 1005/1005; kiểm thử giao diện `tests/e2e/80-quality-assurance.spec.ts` (CT-22f-9) đạt; toàn bộ kiểm thử giao diện 150/152 trên máy (01-login lỗi tiêu điểm bàn phím chỉ trên máy, chạy lại đạt; 04-accounts lỗi do tài khoản trùng của các lượt chạy trước ở cơ sở dữ liệu định danh dùng lại, không liên quan 22f; CI là chuẩn); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22f của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4 theo quyết định của Eric ngày 2026-10-19 (bộ tiêu chuẩn cấu hình được, trường tự nhập). Phân hệ riêng vì tự đánh giá là việc của cả trường, nhiều nhóm tham gia. Kế hoạch cải tiến tạo kế hoạch công việc nháp theo đơn vị của người phụ trách để Quản lý công việc giao việc. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-149, `07_QUY_TAC_NGHIEP_VU.md` BR-151 đến BR-153, `08_VAI_TRO_NGUOI_DUNG.md` PQ-89, `10_YEU_CAU_CHUC_NANG.md` P09-40 đến P09-44, `11_TIEU_CHI_NGHIEM_THU.md` AC-725 đến AC-730, `14_DAC_TA_GIAO_DIEN.md` MH-253 đến MH-257, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-786 đến CT-794, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.100.0.

#### Vấn đề tồn đọng

- Nội dung chỉ báo của bộ mẫu Mầm non chờ đối chiếu văn bản hiện hành; bộ mẫu cấp khác sau DT-19.
- Chưa có nguồn Việc của tôi, thông báo cho phiếu tiêu chí; chưa kí nội bộ báo cáo tự đánh giá; AI gợi ý chưa làm.

### 2026-10-22 — DT-18 phần 22d: thi đua, khen thưởng cán bộ, giáo viên

#### Công việc đã thực hiện

- Đọc mục 9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, kế hoạch DT-22 (phần 22d), Luật Thi đua, khen thưởng năm 2022 (Điều 22, 23, 24), Nghị định 368/2026/NĐ-CP ngày 25/9/2026 (Điều 5: tỉ lệ Chiến sĩ thi đua cơ sở không quá 10% số đạt Lao động tiên tiến), Thông tư 25/2026/TT-BNV; rà mã KPI (18d), hồ sơ chuyên môn (18e), văn bản đi (18b), kế hoạch giáo dục (22i).
- Cơ sở dữ liệu: tệp năm học `0070_create_emulation`, tệp định danh `0062_add_emulation_permissions`.
- Máy chủ API: danh mục, đợt, đăng ký, hồ sơ đề nghị (KPI, minh chứng, điều kiện), hội đồng, phiên họp, phiếu kín, biên bản, công bố, phúc khảo, khiếu nại, quyết định, tờ trình, dự thảo văn bản đi, giấy khen, tra cứu công khai, sổ nhiều năm, báo cáo, nguồn Việc của tôi, chép danh mục sang năm học mới.
- Cổng quản trị: phân hệ "Thi đua, khen thưởng" (1.1 đến 6.1) và trang tra cứu công khai.
- Thêm quy tắc BR-147 đến BR-150, chức năng P09-34 đến P09-39, quyền PQ-88, màn hình MH-241 đến MH-252, kịch bản CT-776 đến CT-785, tiêu chí AC-720 đến AC-724. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/emulation/emulation.test.ts` CT-22d-1 đến CT-22d-9 đạt 9/9 (sửa `system-admin-so.test.ts` CT-16d-3 đếm 18 phân hệ); kiểm thử đơn vị toàn bộ kho mã 997/997 đạt; kiểm thử giao diện `tests/e2e/79-emulation.spec.ts` (CT-22d-10) đạt; toàn bộ kiểm thử giao diện 151 ca: lần chạy đầu 148 đạt; spec 79 sửa bộ chọn nút rồi đạt; `61-health-nutrition-so`, `70-incoming-documents` lỗi chập chờn ở máy cục bộ, chạy lại 70 đạt, không liên quan 22d (spec 58 đếm 18 phân hệ); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4. Thêm phân hệ riêng (như KPI) thay vì gộp vào Hồ sơ chuyên môn vì có hội đồng, quyết định, sổ nhiều năm riêng. Điều kiện của danh hiệu chỉ là thông tin cho hội đồng, không chặn nộp; tỉ lệ phiếu tính trên tổng số thành viên. Sổ nhiều năm đọc mọi cơ sở dữ liệu năm học thay vì chép sổ sang năm mới. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-148, `07_QUY_TAC_NGHIEP_VU.md` BR-147 đến BR-150, `08_VAI_TRO_NGUOI_DUNG.md` PQ-88, `10_YEU_CAU_CHUC_NANG.md` P09-34 đến P09-39, `11_TIEU_CHI_NGHIEM_THU.md` AC-720 đến AC-724, `14_DAC_TA_GIAO_DIEN.md` MH-241 đến MH-252, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-776 đến CT-785, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.99.0.

#### Vấn đề tồn đọng

- Đối chiếu tiêu chuẩn, tỉ lệ mặc định với toàn văn Nghị định 368/2026/NĐ-CP, Thông tư 25/2026/TT-BNV và mẫu biểu kèm theo; chưa nhập phiếu giấy; giấy khen chưa kí số; thi đua khối, cụm và cấp trên để DT-SaaS S6.

### 2026-10-22 — Kế hoạch DT-19 nền đa cấp học

#### Công việc đã thực hiện

- Đọc mã hiện tại trước khi chia phần: lược đồ cơ sở dữ liệu hệ thống, định danh, năm học (`org_units`, `grade_levels`, `classes`, `academic_terms`, `school_weeks`, các cột `school_level`, `education_level`, `school_levels` đã có ở DT-18), nơi ngầm giả định Mầm non (nhóm tuổi, tháng tuổi, EMIS, thống kê, biểu phí, menu "Quản lý giáo dục Mầm non", `EDUCATION_LEVEL_LABEL`), hàm `cacheKey`, `storageKey`; đọc kế hoạch SaaS và dòng DT-19 của kế hoạch DT-18.
- Thêm mục 10 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.30): kế hoạch DT-19 gồm sáu phần 19a đến 19f chạy ba đợt; rủi ro và cách kiểm chuyển dữ liệu Mầm non; bảng phần mở đường cho DT-20, DT-21.
- Ghi YCTD-150 (chỉ đổi tài liệu).

#### Quyết định

- Giữ một cơ sở dữ liệu năm học cho cả trường (không tách theo cấp), một nguồn cấp học `school_levels` ở cơ sở dữ liệu hệ thống, bốn mã cấp cố định, không đổi tên bảng `children`; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Giữ sẵn YCTD-151 đến YCTD-156, migration năm học 0072 đến 0075, hệ thống 0023 đến 0025, định danh 0064 đến 0066, e2e `81-` đến `86-`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-150, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 10. Không đổi mã nguồn, không đổi phiên bản phần mềm.

#### Vấn đề tồn đọng

- Chưa làm phần nào của DT-19. Chờ gộp 22d, 22f (PR khác) để rà lại giả định Mầm non ở hai phần đó khi làm 19d.

### 2026-10-21 — DT-18 phần 22b: bán trú, kiểm thực ba bước và an toàn thực phẩm

#### Công việc đã thực hiện

- Đọc mục 9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, kế hoạch DT-22 (phần 22b), Quyết định 1246/QĐ-BYT ngày 31/3/2017 của Bộ Y tế; rà mã bếp (thực đơn, định lượng, suất ăn, phiếu đi chợ), kho, tiền ăn.
- Cơ sở dữ liệu: tệp năm học `0068_create_food_safety`, tệp định danh `0060_add_food_safety_permission`.
- Máy chủ API: lô hàng (tạo khi nhập phiếu đi chợ), hồ sơ nhà cung cấp, tệp quét, kiểm thực ba bước có gợi ý dòng, lưu và hủy mẫu, truy xuất, sổ in PDF và Excel, nguồn Việc của tôi, chuyển giấy tờ sang năm học mới.
- Cổng quản trị: nhóm "3. Bán trú và an toàn thực phẩm" với 3.1 đến 3.5; cảnh báo giấy tờ và cột lô ở phiếu đi chợ.
- Thêm quy tắc BR-143 đến BR-146, chức năng P12-11 đến P12-15, quyền PQ-87, màn hình MH-236 đến MH-240, kịch bản CT-769 đến CT-775, tiêu chí AC-715 đến AC-719. Kết quả ngày 21/10/2026: kiểm thử đơn vị `apps/api/src/kitchen/food-safety.test.ts` CT-22b-1 đến CT-22b-6 đạt 6/6; kiểm thử đơn vị toàn bộ kho mã 988/988; kiểm thử giao diện `tests/e2e/77-food-safety.spec.ts` (CT-22b-7) đạt; toàn bộ kiểm thử giao diện 150/150; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4 theo Quyết định 1246/QĐ-BYT ngày 31/3/2017 của Bộ Y tế. Lô gắn với dòng phiếu đi chợ để truy xuất tới nhà cung cấp, chứng từ; lô dùng cho món ghi ở bước 2 (có gợi ý) để truy xuất chính xác. Tệp quét lưu bảng riêng để không đụng ràng buộc mục đích tệp của phần chạy song song. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-146, `07_QUY_TAC_NGHIEP_VU.md` BR-143 đến BR-146, `08_VAI_TRO_NGUOI_DUNG.md` PQ-87, `10_YEU_CAU_CHUC_NANG.md` P12-11 đến P12-15, `11_TIEU_CHI_NGHIEM_THU.md` AC-715 đến AC-719, `14_DAC_TA_GIAO_DIEN.md` MH-236 đến MH-240, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-769 đến CT-775, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.98.0.

#### Vấn đề tồn đọng

- Tiền ăn: chưa có luồng chi trả lại số dư có cho phụ huynh khi trẻ thôi học, chưa tách số dư tiền ăn với học phí (xem YCTD-146).
- Lô chưa trừ tồn theo lô; chưa có sổ phản ánh, sự cố ngộ độc riêng; phiếu kiểm thực đã xác nhận chưa có thao tác mở lại; người xác nhận phiếu chỉ lưu mã tài khoản.

### 2026-10-21 — DT-18 phần 22i: kế hoạch giáo dục

#### Công việc đã thực hiện

- Đọc mục 9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, kế hoạch DT-22 (phần 22i), mã hồ sơ chuyên môn 18e (luồng duyệt, kho tệp, nhóm công tác, Việc của tôi), quy trình kí nội bộ 16k, 17b, kế hoạch theo kỳ của Quản lý công việc.
- Cơ sở dữ liệu: tệp năm học `0069_create_education_plans`, tệp định danh `0061_add_education_plan_permissions`.
- Máy chủ API: thư viện mẫu, nạp mẫu Mầm non; lập, sửa, trình, duyệt nhiều bước, trả lại, rút lại; kí nội bộ, lưu vào kho hồ sơ; phiên bản, so sánh; sao chép từ năm trước; xuất Word, PDF; tiến độ duyệt, xuất Excel; tạo kế hoạch công việc; nguồn Việc của tôi; bước chuyển năm học.
- Cổng quản trị: nhóm 5 của phân hệ Hồ sơ chuyên môn (sáu màn hình).
- Thêm quy tắc BR-142, chức năng P09-31 đến P09-33, quyền PQ-86, màn hình MH-230 đến MH-235, kịch bản CT-759 đến CT-768, tiêu chí AC-711 đến AC-714. Kết quả ngày 21/10/2026: kiểm thử đơn vị `apps/api/src/education-plans/education-plans.test.ts` CT-22i-1 đến CT-22i-9 đạt 9/9; kiểm thử đơn vị toàn bộ kho mã 982/982; kiểm thử giao diện `tests/e2e/78-education-plans.spec.ts` (CT-22i-10) đạt; toàn bộ kiểm thử giao diện 149/149 (148 ở lượt toàn bộ, spec 78 chạy lại sau khi sửa đạt); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 22i của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4, gộp vào phân hệ Hồ sơ chuyên môn thay vì thêm phân hệ; mẫu là cấu hình ở cơ sở dữ liệu năm học, chép sang năm mới; bản đã duyệt lưu vào kho hồ sơ 18e (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-147, `07_QUY_TAC_NGHIEP_VU.md` BR-142, `08_VAI_TRO_NGUOI_DUNG.md` PQ-86, `10_YEU_CAU_CHUC_NANG.md` P09-31 đến P09-33, `11_TIEU_CHI_NGHIEM_THU.md` AC-711 đến AC-714, `14_DAC_TA_GIAO_DIEN.md` MH-230 đến MH-235, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-759 đến CT-768.

#### Vấn đề tồn đọng

- Mẫu Tiểu học, THCS, THPT thêm sau DT-19; nội dung mẫu Mầm non chờ trường rà theo hướng dẫn năm học.

### 2026-10-21 — DT-18 phần 18h: quản trị và trình diễn

#### Công việc đã thực hiện

- Đọc mục 9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, kế hoạch DT-18 và DT-SaaS (S2, S5), mã xác thực của dịch vụ định danh, tác vụ xuất nền 16a, các bộ gửi SMS, Zalo, Fanpage, cổng thanh toán.
- Cơ sở dữ liệu: tệp định danh `0059_add_impersonation_and_data_export`, tệp hệ thống `0022_create_impersonation_export_demo_tables`.
- Dịch vụ định danh: đăng nhập thay, thoát, nhật ký; chặn thao tác mật khẩu khi đăng nhập thay; dữ liệu tài khoản cho gói ZIP; không gửi tin nhắn ở bản trình diễn.
- Máy chủ API: ghi thao tác và chặn kí số khi đăng nhập thay; dựng gói ZIP; bản trình diễn (dấu, chặn gửi tin, thanh toán), lệnh tạo và đặt lại dữ liệu trình diễn chạy máy chủ API trong tiến trình.
- Cổng quản trị: nút và hộp thoại đăng nhập thay, thanh báo, 4.1, 4.2, 4.3, trang chọn vai, dải trình diễn; ứng dụng giáo viên, phụ huynh: dải trình diễn, chọn vai.
- Triển khai: dịch vụ `demo-reset` (hồ sơ `demo`), `deploy/README.md` mục 11.
- Thêm quy tắc BR-141, chức năng P01-32 đến P01-34, quyền PQ-85, màn hình MH-225 đến MH-229, kịch bản CT-748 đến CT-758, tiêu chí AC-707 đến AC-710. Kết quả ngày 21/10/2026: kiểm thử đơn vị `apps/api/src/demo/administration-18h.test.ts` CT-18h-1 đến CT-18h-9 đạt 9/9; kiểm thử đơn vị toàn bộ kho mã 973/973 đạt; kiểm thử giao diện `tests/e2e/76-administration-demo.spec.ts` (CT-18h-10, CT-18h-11) đạt; toàn bộ kiểm thử giao diện đạt 148/148; lệnh tạo dữ liệu trình diễn chạy trên cơ sở dữ liệu riêng đạt 25/25 bước; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 18h của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4. Gói ZIP chạy ở tiến trình xuất nền của 16a theo mục 9.4; dấu bản trình diễn ở cơ sở dữ liệu thay vì biến môi trường để dùng lại cho dùng thử của DT-SaaS S5. "Quyền cao hơn" so theo thứ bậc vai trò và nhóm quyền quản trị, vì so từng quyền thì Hiệu trưởng không vào được tài khoản Quản lý đơn vị (vai trò này có quyền nghiệp vụ riêng). Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-145, `07_QUY_TAC_NGHIEP_VU.md` BR-141, `08_VAI_TRO_NGUOI_DUNG.md` PQ-85, `10_YEU_CAU_CHUC_NANG.md` P01-32 đến P01-34, `11_TIEU_CHI_NGHIEM_THU.md` AC-707 đến AC-710, `14_DAC_TA_GIAO_DIEN.md` MH-225 đến MH-229, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-748 đến CT-758, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.96.0.

#### Vấn đề tồn đọng

- Gói ZIP lớn (ZIP64, ghi luồng) và tùy chọn kèm số định danh đầy đủ để DT-SaaS S2. Đăng nhập thay ở ứng dụng giáo viên, phụ huynh chưa làm.

### 2026-10-21 — DT-18 phần 18e: hồ sơ chuyên môn và Việc của tôi

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0066_create_professional_records` tạo `professional_folders`, `professional_work_groups`, `professional_work_group_members`, `professional_rounds`, `professional_documents`, `professional_document_versions`, `professional_document_events`, `professional_record_settings`; mục đích tệp mới `professional_record`. Cơ sở dữ liệu định danh: tệp `0056_add_professional_record_permissions` (bốn quyền `P09.professional-record.*`, phân hệ `professional-records` không có ở phụ huynh).
- Máy chủ API: `apps/api/src/professional-records/` (thư mục, nhóm công tác, đợt nộp, hồ sơ, phiên bản, luồng duyệt, kí nội bộ qua `DossierSigner`, thống kê, khóa năm học, bước chuyển năm học); `apps/api/src/my-work/` (giao diện nguồn việc `MyWorkSource` và chín nguồn: văn bản đến, văn bản đi, giao việc, phòng họp, KPI, hồ sơ chuyên môn, kế hoạch bài dạy, kí hồ sơ, nghỉ phép; điểm cuối `/my-work`, `/my-work/count`).
- Cổng quản trị: phân hệ "Hồ sơ chuyên môn" (1. Việc của tôi, 2.1 đến 2.3 kho, 3.1 đến 3.3 đợt nộp, duyệt, thống kê, 4.1, 4.2 thiết lập); số việc đang chờ trên mục Việc của tôi và nút "Việc của tôi" ở đầu trang cạnh chuông thông báo.
- Thêm quy tắc BR-140, chức năng P09-28 đến P09-30, quyền PQ-84, màn hình MH-216 đến MH-224, kịch bản CT-738 đến CT-747, tiêu chí AC-702 đến AC-706. Kết quả ngày 21/10/2026: kiểm thử đơn vị `apps/api/src/professional-records/professional-records.test.ts` CT-18e-1 đến CT-18e-9 đạt 9/9; kiểm thử đơn vị toàn bộ kho mã 963/964 đạt, ca chưa đạt CTC-P06-007 (phiếu thu phát hành đồng thời, ngoài phạm vi 18e) chạy lại tệp đạt 29/29; kiểm thử giao diện `tests/e2e/74-professional-records.spec.ts` (CT-18e-10) đạt 1/1; toàn bộ e2e chưa chạy lại toàn bộ sau khi gộp 18f; spec 02, 03, 58 quản trị hệ thống, 74 đạt 9/9 (lần đầu spec 02 quá thời gian chờ mở năm học, chạy lại đạt).

#### Quyết định

- Thực hiện phần 18e của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-142: phân hệ riêng "Hồ sơ chuyên môn" chứa Việc của tôi; tổ là phòng ban đã khai báo, tổ trưởng là người có vai trò Tổ trưởng chuyên môn cùng phòng ban; kí ở bước duyệt cuối bằng chứng thư nhà trường đã đăng ký kí nội bộ; nguồn việc đọc thẳng điều kiện "chờ tôi" của từng phân hệ, không ghi dữ liệu.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-142, `07_QUY_TAC_NGHIEP_VU.md` BR-140, `08_VAI_TRO_NGUOI_DUNG.md` PQ-84, `10_YEU_CAU_CHUC_NANG.md` P09-28 đến P09-30, `11_TIEU_CHI_NGHIEM_THU.md` AC-702 đến AC-706, `14_DAC_TA_GIAO_DIEN.md` MH-216 đến MH-224, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-738 đến CT-747, `23_LICH_SU_PHIEN_BAN.md` 0.95.0.

#### Vấn đề tồn đọng

- Thông báo cho tổ trưởng gửi theo vai trò Tổ trưởng chuyên môn của đơn vị (quyền ở dịch vụ định danh nên chưa lọc theo phòng ban); danh mục thư mục mặc định Tiểu học, THCS, THPT dùng chung một bản, sẽ tách khi làm DT-19; Việc của tôi chưa gom các hàng chờ duyệt theo quyền ở tài chính, kho, tuyển sinh (thêm nguồn sau qua `MyWorkSource`).
### 2026-10-21 — DT-18 phần 18f: website trường trên tên miền riêng

#### Công việc đã thực hiện

- Đọc mục 9 của `32_KE_HOACH_THEO_HE_THONG_SO.md`, kế hoạch DT-18, mã tuyển sinh trực tuyến (YCTD-86), văn bản đi (18b, cột `published`), cấu hình Caddy của môi trường chạy thật (YCTD-92); đọc mục lục Chương II của Thông tư 09/2024/TT-BGDĐT để lập nhóm công khai.
- Cơ sở dữ liệu: tệp hệ thống `0021_create_website_tables` (8 bảng), tệp định danh `0058_add_website_permissions` (ba quyền P14).
- Máy chủ API: thiết lập, tên miền, nội dung mẫu (`website-setup.ts`), bài, album, tệp, luồng duyệt, thư liên hệ (`website-content.ts`), trang công khai theo tên miền và điểm cuối kiểm tra tên miền cho Caddy (`website-public.ts`, `website-render.ts`), lọc HTML (`website-html.ts`).
- Cổng quản trị: phân hệ Website trường, 9 màn hình (`apps/portal/src/website/`).
- Triển khai: Caddy `on_demand_tls` hỏi máy chủ API trước khi xin chứng chỉ, khối `https://` cho mọi tên miền website.
- Thêm quy tắc BR-139, chức năng P14-13 đến P14-16, quyền PQ-83, màn hình MH-206 đến MH-215, kịch bản CT-727 đến CT-737, tiêu chí AC-696 đến AC-701. Kết quả ngày 21/10/2026: kiểm thử đơn vị `apps/api/src/website/website.test.ts` CT-18f-1 đến CT-18f-10 đạt 10/10; kiểm thử đơn vị toàn bộ kho mã đạt 955/955 (CSDL riêng của 18f); kiểm thử giao diện `tests/e2e/75-school-website.spec.ts` (CT-18f-11) đạt; toàn bộ kiểm thử giao diện 144/145 trên máy (ca 04-accounts hỏng cục bộ vì cơ sở dữ liệu định danh riêng còn tài khoản trùng tên của lượt chạy trước; CI chạy trên cơ sở dữ liệu mới là kết quả chính); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt; cấu hình Caddy kiểm tra bằng `caddy validate` (Caddy 2.10) hợp lệ.

#### Quyết định

- Thực hiện phần 18f của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4 theo quyết định của Eric ngày 2026-10-19 (mỗi trường một tên miền riêng, có chế độ trình diễn). Dựng trang công khai ở máy chủ API thay vì thêm ứng dụng giao diện mới; tên miền và cấu hình website ở cơ sở dữ liệu hệ thống. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-144.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-144, `07_QUY_TAC_NGHIEP_VU.md` BR-139, `08_VAI_TRO_NGUOI_DUNG.md` PQ-83, `10_YEU_CAU_CHUC_NANG.md` P14-13 đến P14-16, `11_TIEU_CHI_NGHIEM_THU.md` AC-696 đến AC-701, `14_DAC_TA_GIAO_DIEN.md` MH-206 đến MH-215, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-727 đến CT-737, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.94.0.

#### Vấn đề tồn đọng

- Đăng ký sự kiện qua QR (mục 9.4) chưa làm. Trang thời khóa biểu nối 22c (DT-20). Tên miền thật và chứng chỉ cần máy chủ chạy thật.

### 2026-10-20 — DT-18 phần 18g: thiết bị có nơi để, tem QR, kiểm kê, đối sánh danh mục tối thiểu

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0067_add_equipment_locations_stocktakes` tạo `equipment_locations`, `equipment_stocktakes`, `equipment_stocktake_lines`, thêm cột cấp học và mã mẫu cho `equipment_items`, nơi để và mã tem cho `equipment_holdings`, `assets`. Cơ sở dữ liệu định danh: tệp `0057_add_equipment_stocktake_permission` thêm quyền `P13.equipment.stocktake`.
- Máy chủ API (`apps/api/src/facilities/`): `equipment-locations.ts` (nơi để, gán nơi để, in tem QR PDF, tra mã tem), `equipment-stocktakes.ts` (đợt kiểm kê, quét, nộp, duyệt, trả lại, hủy, chốt chênh lệch, biên bản), `equipment-minimum.ts` (danh mục mẫu, nạp mẫu, đối sánh, xuất), `equipment-templates.ts` (mẫu Mầm non 515 thiết bị), `equipment-stocktake-calc.ts` (hàm tính); bước chuyển năm học `facilities` chuyển nơi để, nơi để và mã tem của lô.
- Cổng quản trị: 2.4 Nơi để và tem QR thiết bị, 2.5 Kiểm kê thiết bị (khối quét QR dùng trên điện thoại), 2.6 Đối sánh danh mục tối thiểu. Ứng dụng giáo viên: màn hình Kiểm kê thiết bị. Gói giao diện: thành phần `QrScanner` (máy ảnh, giải mã bằng jsQR trên trình duyệt, ô nhập mã).
- Đọc văn bản gốc trước khi nhập danh mục: Thông tư 02/2010/TT-BGDĐT (danh mục sáu nhóm tuổi) và Thông tư 34/2013/TT-BGDĐT (bãi bỏ 47 thiết bị, đổi tên hai thiết bị), bản đăng trên trang văn bản pháp luật.
- Thêm quy tắc BR-138, chức năng P13-16 đến P13-18, quyền PQ-82, màn hình MH-203 đến MH-205 và MG-18, kịch bản CT-720 đến CT-726, tiêu chí AC-691 đến AC-695. Kết quả ngày 20/10/2026: kiểm thử đơn vị `apps/api/src/facilities/equipment-18g.test.ts` CT-18g-1 đến CT-18g-6 đạt 6/6; kiểm thử đơn vị toàn bộ kho mã 945/945 đạt; kiểm thử giao diện `tests/e2e/73-equipment-stocktake.spec.ts` (CT-18g-7) đạt; toàn bộ kiểm thử giao diện 144/144 đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 18g của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-143: đối tượng của tem và kiểm kê là tài sản (từng thiết bị) và lô (số hiện có của một thiết bị tại đơn vị hoặc lớp); nơi để hai cấp; mã tem `TB-` 10 ký tự không có tên miền; mỗi đơn vị một đợt chưa chốt; chốt chênh lệch lấy số dùng được làm số hiện có của lô và chuyển tài sản hỏng, mất sang luồng ghi nhận hỏng, mất của Kho và tài sản; danh mục mẫu nạp chỉ thêm mã chưa có.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-143, `07_QUY_TAC_NGHIEP_VU.md` BR-138, `08_VAI_TRO_NGUOI_DUNG.md` PQ-82, `10_YEU_CAU_CHUC_NANG.md` P13-16 đến P13-18, `11_TIEU_CHI_NGHIEM_THU.md` AC-691 đến AC-695, `14_DAC_TA_GIAO_DIEN.md` MH-203 đến MH-205, MG-18, `16_CO_SO_DU_LIEU.md` mục 14 và mục 20, `17_DAC_TA_API.md` mục 15, `21_KICH_BAN_KIEM_THU.md` CT-720 đến CT-726, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.93.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.6.

#### Vấn đề tồn đọng

- Danh mục mẫu Mầm non cần đối chiếu bản gốc trên Công báo; chưa có mẫu Tiểu học, THCS, THPT (cột khối lớp làm ở DT-19); chưa khóa dòng khi hai người cùng quét một thiết bị.

### 2026-10-20 — DT-18 phần 18c: giao việc, lịch, hồ sơ công việc, báo cáo

#### Công việc đã thực hiện

- Đọc ghi chép khảo sát VNPT iOffice ngày 2026-10-19 (Giao việc, Lịch, Hồ sơ lưu trữ, Báo cáo), mã văn bản đến của 18a, phân hệ Quản lý công việc (YCTD-81) và văn thư lưu trữ 15h2.
- Cơ sở dữ liệu: tệp năm học `0065_extend_tasks_for_directives` (mở rộng `tasks`, thêm `task_assignments`, `task_files`), tệp hệ thống `0020_create_unit_schedules_and_work_files` (9 bảng), tệp định danh `0055_add_directive_schedule_permissions` (sáu quyền P09).
- Máy chủ API: giao việc, phân công, tiến độ, phê duyệt, nhắc việc chạy nền (`apps/api/src/work/directives.ts`); lịch đơn vị, phòng họp, mẫu lịch, xuất lịch (`apps/api/src/unit-schedules/`); hồ sơ công việc nối văn thư lưu trữ (`apps/api/src/work-files/`); báo cáo (`apps/api/src/document-reports/`).
- Cổng quản trị: 16 màn hình ở nhóm 4 đến 7 của phân hệ Quản lý văn bản và điều hành (`apps/portal/src/directives/`); chi tiết văn bản đến thêm Tạo công việc, Lưu vào hồ sơ công việc.
- Thêm quy tắc BR-137, chức năng P09-24 đến P09-27, quyền PQ-81, màn hình MH-187 đến MH-202, kịch bản CT-707 đến CT-719, tiêu chí AC-685 đến AC-690. Kết quả ngày 20/10/2026: kiểm thử đơn vị `apps/api/src/work/directives.test.ts` và `apps/api/src/unit-schedules/unit-schedules.test.ts` CT-18c-1 đến CT-18c-12 đạt 12/12; kiểm thử đơn vị toàn bộ kho mã 939/939 đạt; kiểm thử giao diện `tests/e2e/72-directives.spec.ts` (CT-18c-13) đạt; toàn bộ kiểm thử giao diện 140/143 đạt trên máy (58 CT-16a-10, 68 CT-17a-6 lỗi không liên quan 18c; CI chạy lại); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 18c của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4 theo quyết định của Eric ngày 2026-10-19 (làm theo VNPT iOffice). Mở rộng bảng việc đã có thay vì tạo phân hệ việc thứ hai. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-141.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-141, `07_QUY_TAC_NGHIEP_VU.md` BR-137, `08_VAI_TRO_NGUOI_DUNG.md` PQ-81, `10_YEU_CAU_CHUC_NANG.md` P09-24 đến P09-27, `11_TIEU_CHI_NGHIEM_THU.md` AC-685 đến AC-690, `14_DAC_TA_GIAO_DIEN.md` MH-187 đến MH-202, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-707 đến CT-719, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.92.0.

#### Vấn đề tồn đọng

- Thêm văn bản đi (18b) vào thành phần hồ sơ công việc và báo cáo. Việc của tôi (18e) gom việc chờ của giao việc.

### 2026-10-20 — DT-18 phần 18b: Văn bản đi theo VNPT iOffice

#### Công việc đã thực hiện

- Cơ sở dữ liệu hệ thống: tệp `0019_create_outgoing_document_tables` tạo sáu bảng văn bản đi (văn bản, tệp, văn bản liên quan và văn bản gốc, lấy ý kiến, đơn vị nhận, lịch sử), thêm vào `incoming_documents` cột văn bản đi nguồn và đơn vị nhận, nguồn `internal` (liên thông nội bộ). Cơ sở dữ liệu định danh: tệp `0054_add_outgoing_document_permissions` thêm bốn quyền P09.
- Gói dùng chung: nhóm 3. Văn bản đi (3.1 đến 3.4) ở phân hệ "Quản lý văn bản và điều hành"; điều kiện hiện mục; nhãn ở `packages/shared/src/outgoing-documents.ts`; `PERMISSION_CODES`, `DATA_GRID_KEYS`, `PORTAL_QUICK_LINK_PATHS` thêm mục mới.
- Máy chủ API (`apps/api/src/outgoing-documents/`): `outgoing-documents.ts` (dự thảo, lấy ý kiến, trình ký, ký nội bộ, cấp số, phát hành, liên thông, public, đóng băng, lưu hồ sơ, tra cứu mã QR), `outgoing-print.ts` (phiếu trình ký PDF, sổ văn bản đi), `outgoing-fields.ts`, `outgoing-documents.controller.ts` (kèm điểm cuối công khai tra cứu mã). Dùng lại của 18a: sổ văn bản (chiều đi), danh mục văn bản, đơn vị bên ngoài, lãnh đạo nhận văn bản (danh sách người ký), chỗ nối `DocumentExchange` (thêm `send`), hàm `storageKey`; dùng lại của 16k, 17b: chứng thư nhà trường và chỗ nối `DossierSigner` (thêm mã QR ở khối xác nhận).
- Cổng quản trị: `apps/portal/src/outgoing-documents/` (danh sách 3.1 đến 3.4, biểu mẫu văn bản đi, chi tiết bốn thẻ và các hộp thoại lấy ý kiến, trình ký, ký, cấp số, lưu hồ sơ; trang công khai `/tra-cuu-van-ban`); 2.1 Sổ văn bản thêm thẻ Khai báo sổ văn bản đi, Sổ đăng ký văn bản đi; chi tiết văn bản đến ghi nguồn liên thông nội bộ.
- Thêm quy tắc BR-136, chức năng P09-20 đến P09-23, quyền PQ-80, màn hình MH-180 đến MH-186, kịch bản CT-697 đến CT-706, tiêu chí AC-679 đến AC-684. Kết quả ngày 20/10/2026: kiểm thử đơn vị `apps/api/src/outgoing-documents/outgoing-documents.test.ts` CT-18b-1 đến CT-18b-9 đạt 9/9; kiểm thử đơn vị toàn bộ kho mã 927/927 đạt; kiểm thử giao diện `tests/e2e/72-outgoing-documents.spec.ts` (CT-18b-10) và `70-incoming-documents.spec.ts` đạt; KQ18B_E2E; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 18b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4 theo khảo sát VNPT iOffice ngày 2026-10-19 (quyết định của Eric ngày 2026-10-19). Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-140: năm trạng thái văn bản đi; người ký chọn trong danh sách lãnh đạo nhận văn bản; ký cần chứng thư nhà trường đã đăng ký kí nội bộ như kí hồ sơ ở 16k; số ký hiệu là số đi ghép phần ký hiệu văn thư nhập; đơn vị nhận trong hệ thống là đơn vị trong cây đơn vị của trường (phân hiệu, điểm trường).
- Bản chạy nội bộ: không kết nối trục liên thông văn bản (văn thư gửi bằng cách khác rồi đánh dấu đã gửi; chỗ nối `DocumentExchange.send`), ký là ký xác nhận nội bộ, không phải chữ ký số.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-140, `07_QUY_TAC_NGHIEP_VU.md` BR-136, `08_VAI_TRO_NGUOI_DUNG.md` PQ-80, `10_YEU_CAU_CHUC_NANG.md` P09-20 đến P09-23, `11_TIEU_CHI_NGHIEM_THU.md` AC-679 đến AC-684, `14_DAC_TA_GIAO_DIEN.md` MH-180 đến MH-186, `16_CO_SO_DU_LIEU.md` mục 1 và mục 10, `17_DAC_TA_API.md` mục 12, `21_KICH_BAN_KIEM_THU.md` CT-697 đến CT-706, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.91.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.6.

#### Vấn đề tồn đọng

- Chưa kết nối trục liên thông văn bản và ký số của nhà cung cấp. "Tạo việc", "Tạo chỉ đạo điều hành", "Tạo lịch họp" từ văn bản đi chờ phần 18c; trang văn bản công khai của website chờ phần 18f (đọc cột `published`); ô số ký hiệu văn bản ở minh chứng KPI (18d) vẫn nhập chữ, chọn văn bản đi trong sổ làm sau.

### 2026-10-20 — DT-18 phần 18d: phân hệ KPI

#### Công việc đã thực hiện

- Khảo sát kho hệ thống KPI cũ (chỉ đọc, bản `7b2f948`): lược đồ, luồng giao việc, đăng ký, minh chứng, chấm, ủy quyền chấm, tự đánh giá, tham mưu, biểu quyết, chốt kỳ, mẫu báo cáo. Đối chiếu tiêu chí chung với Mẫu 01-A, 01-B của Hướng dẫn 06-HD/BTCTU do Eric gửi. Không mở, không chép tệp dữ liệu nào của hệ thống cũ.
- Cơ sở dữ liệu năm học: tệp `0064_create_kpi` tạo 12 bảng `kpi_*` và hai bộ quy tắc mặc định; cơ sở dữ liệu định danh: tệp `0053_add_kpi_permissions` thêm năm quyền P09.
- Gói dùng chung: kiểu cấu hình bộ quy tắc, nhãn (`packages/shared/src/kpi.ts`); phân hệ "Đánh giá KPI" 13 mục ở `PORTAL_WORKSPACES`, điều kiện hiện mục, `PERMISSION_CODES`, `DATA_GRID_KEYS`, `PORTAL_QUICK_LINK_PATHS`.
- Máy chủ API (`apps/api/src/kpi/`): máy chấm đọc mọi tham số từ cấu hình; thiết lập; danh mục; việc; phiếu đánh giá, tham mưu, biểu quyết, khóa kỳ; mẫu báo cáo Excel, Word, PDF; chuyển dữ liệu cũ. Hàm đặt tên khóa kho tệp dùng chung `resource-names.ts` (cùng tệp với phần 18a).
- Cổng quản trị: 13 trang của phân hệ "Đánh giá KPI" (`apps/portal/src/kpi/`).
- Thêm quy tắc BR-135, chức năng P09-13 đến P09-19, quyền PQ-79, màn hình MH-167 đến MH-179, kịch bản CT-678 đến CT-696, tiêu chí AC-669 đến AC-678. Kết quả ngày 20/10/2026: kiểm thử đơn vị `apps/api/src/kpi/kpi.test.ts` CT-18d-1 đến CT-18d-18 đạt 18/18; kiểm thử đơn vị toàn bộ kho mã 918/918 đạt (sau khi gộp 18a; trước khi gộp 908/908, ca CT-16d-3 đổi số phân hệ thành 15); kiểm thử giao diện `tests/e2e/71-kpi.spec.ts` (CT-18d-19) đạt; toàn bộ kiểm thử giao diện 140/141 đạt ngày 20/10/2026 trên máy (ca 04-accounts hỏng do dữ liệu cũ trùng tên trong cơ sở dữ liệu định danh dùng riêng của phần 18d, CI là nguồn chuẩn); `58-system-admin-full-so.spec.ts` sửa số phân hệ thành 15; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 18d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4 theo quyết định của Eric ngày 2026-10-19 (chuyển hẳn KPI vào, hai bộ quy tắc). Ngày 2026-10-20 Eric chọn tiêu chí chung theo Mẫu 01-A, 01-B làm tiêu chuẩn chung cho tất cả. Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-139.
- Văn bản điều chỉnh Hướng dẫn 06 hạn chế phát tán: chỉ đưa tham số chấm điểm dạng cấu hình, đặt tên "Bộ quy tắc 1".

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-139, `07_QUY_TAC_NGHIEP_VU.md` BR-135, `08_VAI_TRO_NGUOI_DUNG.md` PQ-79, `10_YEU_CAU_CHUC_NANG.md` P09-13 đến P09-19, `11_TIEU_CHI_NGHIEM_THU.md` AC-669 đến AC-678, `14_DAC_TA_GIAO_DIEN.md` MH-167 đến MH-179, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `21_KICH_BAN_KIEM_THU.md` CT-678 đến CT-696, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.90.0.

#### Vấn đề tồn đọng

- Chưa có danh sách 14 tiêu chí chung và chỉ báo theo cấp học của bản mẫu theo Nghị định 233/2026; bốn mức giữa của thang 6 mức là cấu hình tạm. Số ký hiệu văn bản nối sổ văn bản đi khi phần 18b gộp.

### 2026-10-20 — DT-18 phần 18a: Văn bản đến theo VNPT iOffice

#### Công việc đã thực hiện

- Cơ sở dữ liệu hệ thống: tệp `0018_create_incoming_document_tables` tạo 13 bảng (danh mục văn bản, đơn vị bên ngoài, nhóm đơn vị ban hành, sổ văn bản, người theo dõi và quản trị sổ, lãnh đạo nhận văn bản, văn bản đến, tệp, văn bản liên quan, luồng xử lý, đánh dấu và theo dõi, lịch sử tham mưu) kèm danh mục mặc định theo biểu mẫu của iOffice. Cơ sở dữ liệu định danh: tệp `0052_add_incoming_document_permissions` thêm bốn quyền P09, bỏ phân hệ mới khỏi nhóm VT-14.
- Gói dùng chung: phân hệ "Quản lý văn bản và điều hành" (khóa `documents`) ở `PORTAL_WORKSPACES` với nhóm 1. Văn bản đến (1.1 đến 1.7), 2. Quản trị văn bản (2.1 đến 2.5); điều kiện hiện mục ở `MENU_PERMISSION_RULES`; nhãn ở `packages/shared/src/incoming-documents.ts`; `PERMISSION_CODES`, `DATA_GRID_KEYS`, `PORTAL_QUICK_LINK_PATHS` thêm mục mới.
- Máy chủ API (`apps/api/src/incoming-documents/`): `document-admin.ts` (quản trị văn bản), `incoming-documents.ts` (vào sổ, luồng xử lý, danh sách, tệp, hạn chế xem, đánh dấu), `incoming-print.ts` (phiếu PDF, sổ văn bản đến), `document-exchange.ts` (chỗ nối trục liên thông, bản chạy nội bộ), `incoming-documents.controller.ts`; `apps/api/src/common/resource-names.ts` là hàm tạo tên chung cho khóa kho tệp và bộ nhớ đệm (viết sẵn cho đa thuê bao).
- Cổng quản trị: `apps/portal/src/incoming-documents/` (danh sách 1.1 đến 1.7, biểu mẫu THÔNG TIN VĂN BẢN ĐẾN, chi tiết văn bản có bốn thẻ và các hộp thoại chuyển, trả lại, gia hạn, lưu hồ sơ, vào sổ; năm trang Quản trị văn bản), `router.tsx`, biểu tượng phân hệ.
- Thêm quy tắc BR-134, chức năng P09-09 đến P09-12, quyền PQ-78, màn hình MH-158 đến MH-166, kịch bản CT-667 đến CT-677, tiêu chí AC-663 đến AC-668. Kết quả ngày 20/10/2026: kiểm thử đơn vị CT-18a-1 đến CT-18a-10 đạt 10/10 (cùng `menu-permissions.test.ts`, `quick-links.test.ts` 17/17 ca; sửa `system-admin-so.test.ts` CT-16d-3 đếm 14 phân hệ, 10/10 ca); kiểm thử đơn vị toàn bộ kho mã 900/900 đạt (sau khi sửa ca CT-16d-3); kiểm thử giao diện CT-18a-11 (`70-incoming-documents.spec.ts`) đạt; toàn bộ kiểm thử giao diện 140/140 đạt (spec 58 đếm 14 phân hệ); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 18a của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.4 theo khảo sát VNPT iOffice ngày 2026-10-19 (quyết định của Eric ngày 2026-10-19: sổ văn bản, luồng văn bản làm theo iOffice). Các điểm chi tiết Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-138: dữ liệu ở cơ sở dữ liệu hệ thống để giữ qua năm học; lãnh đạo nhận văn bản là danh sách cấu hình; người nhận là nhân sự đang làm việc có tài khoản; mở văn bản là đã đọc, văn bản xem để biết mở là xong; "Đến hạn" là hạn trong 2 ngày tới.
- Bản chạy nội bộ: không kết nối trục liên thông văn bản (văn thư nhập văn bản nhận được, đánh dấu tiếp nhận bằng tay rồi vào sổ; chỗ nối `DocumentExchange`); không có ký số SmartCA. "Tạo việc" từ văn bản làm ở phần 18c; văn bản trả lời ghi số ký hiệu, ngày cho tới khi phần 18b có sổ văn bản đi.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-138, `07_QUY_TAC_NGHIEP_VU.md` BR-134, `08_VAI_TRO_NGUOI_DUNG.md` PQ-78, `10_YEU_CAU_CHUC_NANG.md` P09-09 đến P09-12, `11_TIEU_CHI_NGHIEM_THU.md` AC-663 đến AC-668, `14_DAC_TA_GIAO_DIEN.md` MH-158 đến MH-166, `16_CO_SO_DU_LIEU.md` mục 1 và mục 10, `17_DAC_TA_API.md` mục 12, `21_KICH_BAN_KIEM_THU.md` CT-667 đến CT-677, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.89.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9.6.

#### Vấn đề tồn đọng

- Chưa kết nối trục liên thông văn bản và ký số; "Tạo việc", "Tạo lịch họp", "Cấp số và phát hành", báo cáo văn bản đến chờ phần 18b, 18c. Mẫu phiếu trình, phiếu xử lý, phiếu giao nhận tự đặt vì khảo sát chỉ ghi tên nút.

### 2026-10-20 — Kế hoạch DT-18 điều hành nhà trường

#### Công việc đã thực hiện

- Thêm mục 9 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.19): kế hoạch DT-18 gồm tám phần 18a đến 18h và bốn phần 22b, 22d, 22f, 22i chạy ở đợt 5; mỗi phần có phạm vi, đợt, phụ thuộc, YCTD và số migration giữ sẵn; nguyên tắc chung; bảng tiến độ.
- Ghi YCTD-137 (chỉ đổi tài liệu).

#### Quyết định

- Quyết định của Eric ngày 2026-10-19: lộ trình DT-18 → DT-19 → DT-20 → DT-21 → DT-22 → DT-SaaS; văn bản đến, đi, giao việc, lịch theo VNPT iOffice; KPI chuyển hẳn hệ thống của Eric vào School Management; website mỗi trường một tên miền riêng, có chế độ trình diễn; ký số chạy nội bộ; 22b, 22d, 22f, 22i ở đợt 5 của DT-18; AI là thành phần riêng, tắt mặc định.
- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: năm đợt, mỗi lúc tối đa hai phiên (đợt 1: 18a, 18d; đợt 2: 18b, 18c; đợt 3: 18e, 18g; đợt 4: 18f, 18h; đợt 5: 22b, 22i rồi 22d, 22f); YCTD-138 đến YCTD-149 đánh theo thứ tự đợt; migration giữ sẵn năm học 0064 đến 0071, hệ thống 0018 đến 0022, định danh 0052 đến 0063.
- Phần 18d chỉ ghi hai bộ quy tắc chấm cấu hình được (bộ HD 06-HD/BTCTU đã sửa đổi, bộ NĐ 233/2026); không đưa nội dung văn bản hạn chế phát tán vào kho, tham số chấm điểm để phiên làm 18d nhập thành cấu hình.

#### Thay đổi

- `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 9; `24_YEU_CAU_THAY_DOI.md` YCTD-137; `index.md`. Chỉ đổi tài liệu, phiên bản phần mềm giữ nguyên.

#### Vấn đề tồn đọng

- Ghi chép khảo sát VNPT iOffice lưu ngoài kho; phiên làm 18a, 18b, 18c đọc trước khi viết phạm vi chi tiết.
- Văn bản gốc của thông tư danh mục thiết bị tối thiểu, thi đua khen thưởng, bộ tiêu chuẩn kiểm định cần đọc trước khi làm 18g, 22d, 22f.

### 2026-10-20 — DT-17 phần 17d: Tuyển sinh đầu cấp phần 2

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0062_add_entry_admission_intake` thêm loại hình, năm học nhận trẻ cho `admission_campaigns`; `admission_applications` nhận nguồn `routing`, trạng thái `cancelled` và thêm các cột cư trú, cuối cấp, họ tên cha mẹ, giấy tờ đã nộp, đồng ý nhập học, trường tiên tiến, nội dung thông báo, loại hồ sơ, điểm trường nhận, mã gói tin, mã GUID, hủy nhập học; tạo `admission_application_files`, `admission_transfer_results`, `entry_admission_contacts`, `entry_admission_notices`, `entry_admission_notice_recipients`; mục đích tệp `admission_document`. Cơ sở dữ liệu định danh: tệp `0051_add_entry_intake_permissions` thêm ba quyền P02.
- Gói dùng chung: mục 1.3 đến 1.7 của phân hệ "Tuyển sinh đầu cấp" và 5.11 của phân hệ Mầm non ở `PORTAL_WORKSPACES`; điều kiện hiện mục ở `MENU_PERMISSION_RULES`; nhãn loại hình, đồng ý nhập học, trạng thái trường duyệt và xã/phường, loại hồ sơ, giấy tờ đã nộp ở `packages/shared/src/entry-admissions.ts`; `PERMISSION_CODES`, `DATA_GRID_KEYS`, `PORTAL_QUICK_LINK_PATHS` thêm mục mới.
- Máy chủ API (`apps/api/src/entry-admissions/`): `entry-intake.ts` (hồ sơ theo màn hình, bộ lọc như Sở, Cập nhật, Lưu dữ liệu, xác nhận hồ sơ trường tiên tiến, Xóa, Hủy nhập học hồ sơ chưa chuyển, nhập danh sách phân tuyến, giấy tờ, minh chứng, Excel, phiếu PDF), `entry-intake-notices.ts` (1.5), `entry-intake-transfer.ts` (1.6, 1.7, 5.11), `entry-intake.controller.ts` (nhóm `/entry-intake`); `final-year-pdf.ts` nhận tiêu đề riêng của phiếu; tra cứu hồ sơ tuyển sinh công khai có nhãn "Đã hủy nhập học".
- Cổng quản trị: 1.3 đến 1.7 của phân hệ "Tuyển sinh đầu cấp" và 5.11 của phân hệ Mầm non (`apps/portal/src/entry-admissions/EntryIntakePages.tsx`, `entry-intake-api.ts`, `router.tsx`).
- Thêm quy tắc BR-133, chức năng P02-29 đến P02-33, quyền PQ-77, màn hình MH-152 đến MH-157, kịch bản CT-655 đến CT-666, tiêu chí AC-656 đến AC-662. Kết quả ngày 20/10/2026: kiểm thử đơn vị CT-17d-1 đến CT-17d-10 và CT-17d-12 (11 ca) đạt 11/11 (cùng `admissions.test.ts`, `year-transition.test.ts` 27/27 ca); kiểm thử đơn vị toàn bộ kho mã 890/890 đạt; kiểm thử giao diện CT-17d-11 đạt; toàn bộ kiểm thử giao diện 139/139 đạt (lượt chạy trước khi thêm việc chép giấy tờ khi mở năm học và chặn `GET /files/{id}` với tệp `admission_document`, hai thay đổi không đụng giao diện, đã chạy lại tệp kiểm thử đơn vị 17d đạt); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 17d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8.3 (khảo sát tài liệu 31 mục 10.2.4, chênh lệch mục 10.7.4). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-135: dùng lại đợt và hồ sơ tuyển sinh của phân hệ Tuyển sinh (YCTD-86); danh sách phân tuyến nhập từ Excel; hồ sơ phân tuyến của đợt đại trà, khảo sát đạt ngay, của đợt tiên tiến chờ trường xác nhận ở 1.3; trạng thái xã/phường nhập tay; năm học nhận trẻ phải đang mở vì chỉ năm học đang dùng ghi được dữ liệu (BR-93); điều kiện chuyển hồ sơ: số định danh, giấy khai sinh, quan hệ của người liên hệ, khai báo dị ứng; mã gói tin `GT-…`, `HN-…`, mỗi hồ sơ một mã GUID; Hủy nhập học hồ sơ đã chuyển xóa mềm hồ sơ học sinh chưa phát sinh dữ liệu; thông báo qua ứng dụng phụ huynh và Zalo OA tới tài khoản cùng số điện thoại, SMS chờ nhà cung cấp; loại hồ sơ Có tài khoản, Tự do chỉ để lọc và hiển thị; ba quyền mới cho VT-02, VT-15, VT-12, VT-03.
- Bản chạy nội bộ: không kết nối phân tuyến của Sở, của xã/phường; không gửi SMS, thư điện tử. Phần 17d là phần cuối của DT-17; DT-17 hoàn tất.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-135, `07_QUY_TAC_NGHIEP_VU.md` BR-133, `08_VAI_TRO_NGUOI_DUNG.md` PQ-77, `10_YEU_CAU_CHUC_NANG.md` P02-29 đến P02-33, `11_TIEU_CHI_NGHIEM_THU.md` AC-656 đến AC-662, `14_DAC_TA_GIAO_DIEN.md` MH-152 đến MH-157, `16_CO_SO_DU_LIEU.md` mục 3 và mục 17, `17_DAC_TA_API.md` mục 6, `21_KICH_BAN_KIEM_THU.md` CT-655 đến CT-666, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.88.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8.5.

#### Vấn đề tồn đọng

- Chưa có kết nối phân tuyến của Sở, của xã/phường và nhà cung cấp SMS, thư điện tử; mẫu phiếu đăng ký, phiếu thông tin chờ mẫu của Sở. Kiểm thử đều đạt.

### 2026-10-19 — DT-17 phần 17c: Tuyển sinh đầu cấp phần 1

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0061_create_entry_admissions` tạo `final_year_records`, `final_year_record_files`, `final_year_record_events`, `final_year_class_confirmations`, `admission_support_requests`, `school_services`; `org_units` thêm tọa độ, tỉnh/thành phố, phường/xã, khu phố, lần xác nhận vị trí; mục đích tệp `final_year_document`. Cơ sở dữ liệu định danh: tệp `0050_add_entry_admission_permissions` thêm bốn quyền P02 và bỏ phân hệ mới khỏi nhóm VT-14.
- Gói dùng chung: phân hệ `entry-admissions` ở `PORTAL_WORKSPACES` (13 phân hệ), điều kiện hiện mục ở `MENU_PERMISSION_RULES`, nhãn và danh sách giá trị ở `packages/shared/src/entry-admissions.ts`.
- Máy chủ API (`apps/api/src/entry-admissions/`): quy tắc luồng sáu trạng thái, kiểm dò, điều kiện duyệt, hạn điều chỉnh (`final-year-rules.ts`); hồ sơ cuối cấp tự lập cho trẻ lớp năm cuối cấp, thao tác hàng loạt, giấy tờ, Excel, PDF A5 và A4 gập đôi, tệp nén, 1.2, 4.1 và điểm cuối của ứng dụng phụ huynh; 1.8, 2.1, 3.3, 3.4, 5.1 kèm chỗ nối `AdmissionSupportMailer`; `/files/{id}` từ chối giấy tờ hồ sơ cuối cấp.
- Cổng quản trị: phân hệ "Tuyển sinh đầu cấp" với 1.1, 1.2, 1.8, 2.1, 3.1 đến 3.4, 4.1, 5.1. Ứng dụng phụ huynh: nút "Hồ sơ cuối cấp" trên thẻ của con.
- Thêm quy tắc BR-132, chức năng P02-24 đến P02-28, quyền PQ-76, màn hình MH-142 đến MH-151, MP-22, kịch bản CT-642 đến CT-654, tiêu chí AC-650 đến AC-655. Kết quả ngày 19/10/2026: kiểm thử đơn vị CT-17c-1 đến CT-17c-12 đạt 12/12, cùng `menu-permissions.test.ts`, `system-admin-so.test.ts` 26/26 ca đạt (chạy cục bộ); kiểm thử đơn vị toàn bộ kho mã 874/874 đạt; kiểm thử giao diện CT-17c-13 đạt; toàn bộ kiểm thử giao diện 133/136 đạt (cục bộ; ba ca lỗi không thuộc 17c: 01-login CT-15a-7 lỗi cục bộ đã biết, 04-accounts và 59 CT-16c-17 do dữ liệu kiểm thử còn lại ở cơ sở dữ liệu định danh riêng của phần; lần chạy trước hai ca này đạt); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 17c của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8.3 (khảo sát tài liệu 31 mục 10.2, chênh lệch mục 10.7.4). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-134: luồng sáu trạng thái và cách chuyển; "Xác nhận hồ sơ" là trường xác nhận thay phụ huynh khi phụ huynh xác nhận trên giấy; kiểm dò năm mục; điều kiện duyệt; hạn điều chỉnh lưu ở `settings` khóa `final_year_edit_deadline`; danh sách Diện cư trú; tên nhóm menu 1. đến 5.; quyền cho VT-02, VT-15, VT-12, VT-03; số định danh trên lưới luôn che, tệp Excel, PDF in đủ khi có quyền xem số định danh; cột "Mật khẩu" hiện tình trạng tài khoản phụ huynh; Khởi tạo mật khẩu dùng cấp mật khẩu hàng loạt của dịch vụ định danh; Cập nhật từ Excel dùng cột ID của tệp Xuất Excel, kiểm tra cả tệp, có lỗi không ghi; PDF A5 và A4 gập đôi, Tách file là tệp nén zip; mẫu phiếu kê khai, phiếu thông tin; "Xem vị trí" mở OpenStreetMap ở thẻ mới; 3.1 đến 3.4 chỉ hiển thị, 3.1, 3.2 cần thêm quyền quản lý tài khoản; 5.1 "Gửi email" gửi qua thông báo của ứng dụng phụ huynh, thư điện tử qua chỗ nối `AdmissionSupportMailer` chưa có nhà cung cấp.
- Bản chạy nội bộ: không kết nối phân tuyến của Sở; 1.2 là đánh dấu tay kèm xuất Excel; không có trang, đăng nhập riêng như `truong-tsdc`. Mục 1.3 đến 1.7 để phần 17d.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-134, `07_QUY_TAC_NGHIEP_VU.md` BR-132, `08_VAI_TRO_NGUOI_DUNG.md` PQ-76, `10_YEU_CAU_CHUC_NANG.md` P02-24 đến P02-28, `11_TIEU_CHI_NGHIEM_THU.md` AC-650 đến AC-655, `14_DAC_TA_GIAO_DIEN.md` MH-142 đến MH-151, MP-22, `16_CO_SO_DU_LIEU.md` mục 3, `17_DAC_TA_API.md` mục 6, `21_KICH_BAN_KIEM_THU.md` CT-642 đến CT-654, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.87.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8.5.

#### Vấn đề tồn đọng

- Chưa có kết nối phân tuyến, cơ sở dữ liệu của Sở và nhà cung cấp gửi thư; Diện cư trú, mẫu phiếu PDF chờ đối chiếu danh sách, mẫu của Sở. Kiểm thử đơn vị toàn kho mã 874/874 đạt; kiểm thử giao diện CT-17c-13 đạt, toàn bộ kiểm thử giao diện 133/136 đạt (cục bộ; ba ca lỗi không thuộc 17c: 01-login CT-15a-7 lỗi cục bộ đã biết, 04-accounts và 59 CT-16c-17 do dữ liệu kiểm thử còn lại ở cơ sở dữ liệu định danh riêng của phần; lần chạy trước hai ca này đạt).

### 2026-10-19 — DT-17 phần 17a: báo cáo số liệu EMIS theo chỉ tiêu và mã số của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0060_add_emis_so_indicators` thêm `children.policy_benefits`, `staff.concurrent_disability_support`, `staff.concurrent_shared_position`, `rooms.built_this_year`, bảng `emis_record_submissions`; xóa số liệu nhập tay theo mã cũ của thẻ Ngân sách nhà nước, thẻ 1 của 1.2 và 2.3. Không có migration hệ thống, định danh; không thêm mã quyền.
- Máy chủ API: Biểu 01.ĐN-MN mã 01 đến 217, Biểu 08.ĐN-NSNN mã 1 đến 71, 1.2.1 thẻ 1 mã 01 đến 84 kèm cột Xây dựng mới, 2.1, 2.2, 2.3 theo cấu trúc của Sở, 2.4 trống ở học kỳ I; xóa số liệu của thẻ; năm điểm cuối của 1.1.2 Gửi báo cáo đầu năm; năm biểu mẫu gửi riêng thay biểu mẫu chung của 1.1.
- Cổng quản trị: trang lập theo cột, dòng của Sở, nút "Lấy dữ liệu từ hệ thống", "Xóa dữ liệu"; trang mới 1.1.2; 1.2 chỉ còn "Gửi dữ liệu"; ô mới ở hồ sơ học sinh, hồ sơ nhân sự, khai báo phòng.
- Thêm quy tắc BR-131, kịch bản CT-635 đến CT-641, tiêu chí AC-644 đến AC-649, màn hình MH-141; sửa P17-18, P17-20, P17-24 đến P17-28, PQ-63, MH-82, MH-131 đến MH-136. Kết quả ngày 19/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r --workspace-concurrency=1 --no-bail test`) 867/867 ca đạt (lượt toàn kho 853 đạt; 14 ca chạy lại riêng đạt: CT-16a-7 sửa theo biểu mẫu gửi mới và 13 ca điểm danh bị hủy do dữ liệu cũ của cơ sở dữ liệu thử cục bộ); toàn bộ kiểm thử giao diện 137/137 ca đạt (lượt toàn bộ 136 đạt; CT-641 sửa hộp xác nhận Xóa dữ liệu rồi chạy lại spec 68 đạt 2/2); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Theo quyết định của Eric ngày 2026-10-16 (làm đủ mọi tính năng đã khảo sát; tính năng cần hệ thống ngoài làm bản chạy nội bộ), 1.1.2 là bản chạy nội bộ: "Gửi hồ sơ" xuất tệp và đánh dấu đã gửi, không truyền dữ liệu lên Bộ, Sở. Các điểm chi tiết (cách tính từng chỉ tiêu, bảng ánh xạ loại phòng, nhãn tạm cho Biểu 08 mã 24 đến 55, xóa số liệu nhập tay theo mã cũ) Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-132.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-132, `07_QUY_TAC_NGHIEP_VU.md` BR-131, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.86.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8.5.

#### Vấn đề tồn đọng

- Tên mục 2 đến 5 của Biểu 08 (mã 24 đến 55), mã chi tiết khối B của 1.2.1 chờ đối chiếu; thẻ 2 đến 5 của 1.2.1, biểu 1.3, 2.4 chưa khảo sát được nội dung; 1.2.2 một dòng biểu mẫu cho cả năm thẻ (YCTD-132, Hạn chế).

### 2026-10-19 — DT-17 phần 17b: kí hồ sơ theo bốn mẫu của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu hệ thống: tệp `0017_adjust_signing_to_so_templates` (chứng thư HSM chuyển REMOTE SIGNING, `signing_dossiers` thêm tệp XML và ghi chú, bảng `signing_create_errors`). Không có migration năm học, định danh.
- Máy chủ API: nội dung bốn loại hồ sơ theo phần và mục của Sở, tệp XML qua chỗ nối `DossierXmlWriter`, điểm cuối xem hồ sơ kí, tải file lỗi, kiểm tra quyền xem số định danh với hồ sơ nhân sự, học sinh, nhà phát hành trong năm giá trị, không tạo hồ sơ sổ đầu bài mới.
- Cổng quản trị: 1.1, 2.1 có thông tin trường; 1.1 chọn nhà phát hành, lịch sử yêu cầu đăng ký; 2.2 cột theo loại, lọc khối, lớp, cửa sổ "Xem hồ sơ kí", "Tải file lỗi"; 2.3 cột theo Sở.
- Thêm quy tắc BR-130, kịch bản CT-626 đến CT-634, tiêu chí AC-640 đến AC-643; sửa P01-28 đến P01-31, PQ-75, MH-137 đến MH-140. Kết quả ngày 19/10/2026 (trước khi gộp phần 17e): kiểm thử đơn vị toàn bộ kho mã (`pnpm -r --workspace-concurrency=1 --no-bail test`) 856/856 ca đạt; toàn bộ kiểm thử giao diện 134/134 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt; CI đạt trên nhánh đã gộp.

#### Quyết định

- Eric quyết định ngày 2026-10-19: "hồ sơ kí in đầy đủ số CCCD và số định danh như Sở, nhưng chỉ người có quyền xem số định danh (P02.national-id.view hoặc quyền tương đương hiện có) mới tạo và xem được hồ sơ kí"; vẫn giữ bản chạy nội bộ, không ký số thật. Đây là ngoại lệ có kiểm soát đối với quy định che số định danh của YCTD-13 (chỉ VT-02, VT-15, VT-03, VT-12 xem đầy đủ số định danh). Các điểm chi tiết khác Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-133.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-133, `07_QUY_TAC_NGHIEP_VU.md` BR-130, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.85.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8.5.

#### Vấn đề tồn đọng

- Chưa có lược đồ XML của Bộ và nhà cung cấp kí số; một số mục của mẫu Sở chưa có dữ liệu nên để trống (YCTD-133, Hạn chế).

### 2026-10-19 — DT-17 phần 17e: 1.7 Rà soát thông tin kiểm định CLGD đủ ô như Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0063_add_accreditation_review_so_fields` thêm 12 cột được để trống vào `accreditation_reviews` (tên trường, mã trường, loại hình, cấp học; năm, ngày công nhận, mức độ chuẩn quốc gia; năm, ngày công nhận, cấp độ kiểm định CLGD; thời điểm đăng ký chuẩn quốc gia; diện tích sàn xây dựng trên học sinh) kèm ràng buộc kiểm tra. Hồ sơ trường thêm tám khóa ở jsonb `general`, không cần migration.
- Máy chủ API: `/accreditation-review`, `/accreditation-review/collect` trả, nhận thêm các ô mới; Ghi bắt buộc tên trường, mã trường, loại hình, ghi chú tối đa 500 ký tự; Lấy dữ liệu lấy tên Trường chính, mã định danh của hồ sơ trường (chưa có thì mã Trường chính), loại hình, chuẩn quốc gia, kiểm định CLGD, diện tích sàn xây dựng ở hồ sơ trường (chưa nhập thì tổng diện tích phòng đang dùng); `PUT /school-profile` từ chối năm công nhận ngoài 1900 đến 2100.
- Cổng quản trị: 1.7 có năm khối theo thứ tự của Sở (Thông tin trường, Chuẩn quốc gia, Kiểm định chất lượng giáo dục, Cơ sở vật chất và học sinh, Ghi chú) và bộ đếm ký tự của ghi chú; 1.1 Hồ sơ trường thẻ Thông tin chung có thêm tám ô.
- Thêm kịch bản CT-619 đến CT-625, tiêu chí AC-636 đến AC-639, quy tắc BR-129; không có chức năng, màn hình, quyền mới (sửa P01-15, P01-24, MH-79, MH-123). Kết quả ngày 19/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r --workspace-concurrency=1 --no-bail test`) 854/854 ca đạt; toàn bộ kiểm thử giao diện 135/135 ca đạt (chạy cục bộ); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 17e của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8 (chênh lệch R1–R5 ở tài liệu 31 mục 10.7.3). Mã mức độ, cấp độ theo Thông tư 19/2018/TT-BGDĐT; cấp học cố định "Mầm non"; tên trường lấy ở cây đơn vị, mã trường lấy mã định danh của hồ sơ trường; thời điểm đăng ký chuẩn quốc gia là chữ tự do tối đa 100 ký tự; "Diện tích xây dựng" cũ của hồ sơ trường giữ riêng với "Diện tích sàn xây dựng" mới; ghi chú đã ghi dài hơn 500 ký tự vẫn hiện nhưng phải rút gọn trước lần ghi sau. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-136.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-136, `07_QUY_TAC_NGHIEP_VU.md` BR-129, `10_YEU_CAU_CHUC_NANG.md` P01-15, P01-24, `11_TIEU_CHI_NGHIEM_THU.md` AC-636 đến AC-639, `14_DAC_TA_GIAO_DIEN.md` MH-79, MH-123, `16_CO_SO_DU_LIEU.md` mục 2, `17_DAC_TA_API.md` mục 5, 6, `21_KICH_BAN_KIEM_THU.md` CT-619 đến CT-625, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.84.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8.5.

#### Vấn đề tồn đọng

- Thời điểm đăng ký chuẩn quốc gia chưa có định dạng của Sở để kiểm tra; cách tính phòng bộ môn chưa đối chiếu biểu mẫu kiểm định chính thức. Báo cáo EMIS (phần 17a) sẽ đọc các ô hồ sơ trường mới.

### 2026-10-19 — Khảo sát bổ sung hệ thống của Sở và kế hoạch DT-17

#### Công việc đã thực hiện

- Khảo sát thêm hệ thống của Sở GD&ĐT TP.HCM: Eric đăng nhập, Claude chỉ đọc giao diện, không bấm nút ghi. Đã xem phân hệ Tuyển sinh đầu cấp (15 màn hình), nội dung bốn loại hồ sơ kí, tên và mã số chỉ tiêu Biểu 01.ĐN-MN (mã 01 đến 217), Biểu 08.ĐN-NSNN (mã 1 đến 71), báo cáo cơ sở vật chất TP.HCM (mã 01 đến 84), các biểu EMIS khác, trang gửi báo cáo, màn hình 1.7. Phân hệ Hồ sơ điện tử không được cấp cho tài khoản trường nên không xem được.
- Thêm mục 10 vào `31_KHAO_SAT_HE_THONG_SO.md` (phiên bản 1.2), gồm bảng đối chiếu với mã nguồn của DT-16 (E1–E11 EMIS, K1–K10 kí hồ sơ, R1–R5 rà soát kiểm định, Tuyển sinh đầu cấp chưa có).
- Thêm mục 8 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.14): DT-17 gồm năm phần 17a đến 17e.

#### Quyết định

- DT-17 chia năm phần, giữ sẵn YCTD-132 đến YCTD-136 và số migration riêng; chạy tối đa hai phần cùng lúc: lượt 1 gồm 17e, 17b; lượt 2 gồm 17a, 17c; lượt 3 là 17d. Thứ tự gộp 17e, 17b, 17a, 17c, 17d.
- Kí hồ sơ: ẩn sổ đầu bài ở cấp Mầm non như Sở, giữ hồ sơ sổ đầu bài đã có; nội dung hồ sơ theo bốn mẫu của Sở, in đủ số định danh theo mẫu và cần thêm quyền xem số định danh; nhà phát hành chọn trong năm giá trị của Sở.
- Tuyển sinh đầu cấp là phân hệ mới dùng chung đăng nhập; phân tuyến, gửi lên cấp trên, chuyển hồ sơ sang CSDL làm bản chạy nội bộ; dùng lại đợt và hồ sơ của tuyển sinh trực tuyến (YCTD-86).
- Hồ sơ điện tử không làm ở DT-17.
- Các lựa chọn trên Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-131 và tài liệu 32 mục 8.

#### Thay đổi

- `31_KHAO_SAT_HE_THONG_SO.md` mục 1, mục 10; `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 8; `24_YEU_CAU_THAY_DOI.md` YCTD-131; `index.md`. Chỉ đổi tài liệu, phiên bản phần mềm giữ nguyên.

#### Vấn đề tồn đọng

- Chưa đọc được thẻ 2 đến 5 của báo cáo cơ sở vật chất TP.HCM, dòng chi tiết của báo cáo sức khỏe đầu năm, cấu trúc biểu GDMN cuối năm (trống ở học kỳ I), tên các mục 2 đến 5 của chi thường xuyên trong Biểu 08.ĐN-NSNN.
- Phân hệ Hồ sơ điện tử chờ Sở cấp cho tài khoản trường.

### 2026-10-18 — DT-15 phần 15f3: các phân hệ Bếp – kho, Tương tác, Giảng dạy, Tuyển sinh – tuyển dụng, Báo cáo theo giao diện chung của Sở

#### Công việc đã thực hiện

- Đưa 8 trang của năm phân hệ Bếp – kho, mua hàng; Tương tác – truyền thông; Giảng dạy; Tuyển sinh, tuyển dụng; Báo cáo sang giao diện chung của Sở: tiêu đề có số theo menu (1. Kho và tài sản, 2. Đề nghị mua hàng, 1. Tương tác với phụ huynh, 2. Hoạt động và tin tức, 1. Bài học và giáo án, 1. Tuyển sinh, 2. Tuyển dụng, 1. Báo cáo và bảng điều khiển); 32 lưới dữ liệu chung (tồn kho, sổ kho, tài sản, hỏng và mất, kiểm kê, phiếu mua hàng, nhà cung cấp, đề nghị mua hàng, bình chọn, khảo sát, góp ý, đồ bị mất, bình luận, danh mục nội dung, tin tức, thư viện, ngoại khóa, giáo án chờ duyệt, bài học, danh mục bài học, kế hoạch giảng dạy, tuyển sinh, tuyển dụng, nhật ký xuất); nút Thêm mới mở biểu mẫu theo khối, nút Ghi. Lưới Danh mục tài sản có cột "Thiết bị dạy học" khi người dùng có quyền quản lý thiết bị dạy học, giữ phần gắn tài sản với thiết bị dạy học của DT-16 phần 16i (YCTD-128). Thêm thành phần `FormPanel.tsx` của cổng quản trị. Nghiệp vụ, điểm cuối, quyền không đổi; không có tệp thay đổi cấu trúc dữ liệu.
- Thêm kịch bản CT-611 đến CT-618, tiêu chí AC-628 đến AC-635; không có quy tắc nghiệp vụ, quy tắc phân quyền, chức năng, màn hình mới (đổi MH-20 đến MH-29, MH-36, MH-57, MH-63); thêm kiểm thử giao diện `tests/e2e/67-communication-grids.spec.ts`. Kết quả: build, kiểm tra kiểu, lint, kiểm tra định dạng đạt; kiểm thử đơn vị toàn bộ kho mã: 848/848 ca đạt; toàn bộ kiểm thử giao diện: 134/134 ca đạt.

#### Quyết định

- Phần 15f3 lấy mã YCTD-115 đã giữ cho phần này. Thẻ Duyệt hoạt động, thẻ Trao đổi, thời khóa biểu, các bảng báo cáo tổng hợp và hồ sơ ứng viên giữ bố cục vì không phải danh sách; lưới phân trang tại chỗ trên điểm cuối cũ; không thêm ô chọn dòng vì không có thao tác hàng loạt; trang Thực đơn bữa ăn (`/kitchen`, MH-18) không thuộc nhóm Bếp – kho, mua hàng nên không đổi trong 15f3. Cột "Thiết bị dạy học" của lưới Danh mục tài sản chỉ hiện khi người dùng có quyền quản lý thiết bị dạy học, cùng điều kiện với khối gắn tài sản của phần 16i. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-115.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-115, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-20 đến MH-29, MH-36, MH-57, MH-63, BC-13, BC-16, `11_TIEU_CHI_NGHIEM_THU.md` AC-628 đến AC-635, `16_CO_SO_DU_LIEU.md` mục `user_grid_settings`, `17_DAC_TA_API.md` giao kèo cấu hình lưới, `21_KICH_BAN_KIEM_THU.md` CT-611 đến CT-618, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.83.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 6.

#### Vấn đề tồn đọng

- Chưa có Xuất Excel, thao tác hàng loạt ở các lưới của năm phân hệ; duyệt, từ chối có lý do vẫn nhập ở từng dòng; danh sách rất dài vẫn tải một lần.

### 2026-10-18 — DT-15 phần 15f1: phân hệ Tài chính – học phí theo giao diện chung của Sở

#### Công việc đã thực hiện

- Đưa 15 trang của phân hệ "Tài chính – học phí" sang giao diện chung của Sở: tiêu đề có số theo menu (1.1. Biểu phí và dịch vụ đến 3.2. Chốt kỳ tài chính); 20 lưới dữ liệu chung (dịch vụ, loại miễn giảm, hóa đơn, các danh sách chờ duyệt, công nợ, nhắc nợ, đề xuất xử lý, phiếu thu, phiếu chi, quỹ, nợ nhà cung cấp, khoản mục thu chi, tài khoản kế toán, quy tắc ghi sổ, kỳ tài chính); nút Thêm mới mở biểu mẫu theo khối, nút Ghi; xóa phiên bản biểu phí, phiếu chi nháp, dòng sao kê, bỏ quy tắc ghi sổ qua hộp xác nhận xóa dùng chung. Nghiệp vụ, điểm cuối, quyền không đổi; không có tệp thay đổi cấu trúc dữ liệu.
- Thêm kịch bản CT-599 đến CT-610, tiêu chí AC-616 đến AC-627; không có quy tắc nghiệp vụ, quy tắc phân quyền, chức năng, màn hình mới (đổi MH-04, MH-05, MH-06, MH-07, MH-08, MH-09, MH-10, MH-11, MH-39, MH-61, MH-62, MH-67, MH-68, MH-69). Kết quả ngày 18/10/2026 sau khi gộp nhánh chính: build, kiểm tra kiểu, lint, kiểm tra định dạng đạt; kiểm thử đơn vị toàn bộ kho mã 848/848 ca đạt; toàn bộ kiểm thử giao diện 133/133 ca đạt.

#### Quyết định

- Phần 15f1 lấy mã YCTD-114 đã giữ sẵn. Màn hình không phải danh sách (bảng đăng ký dịch vụ, biểu phí theo phiên bản, sổ quỹ, đối chiếu ngân hàng, nhật ký chung, sổ cái, cân đối số phát sinh) giữ bố cục; lưới phân trang tại chỗ trên điểm cuối cũ; danh sách chờ duyệt đặt nhóm Duyệt, Từ chối dưới dòng. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-114.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-114, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-04, MH-05, MH-06, MH-07, MH-08, MH-09, MH-10, MH-11, MH-39, MH-61, MH-62, MH-67, MH-68, MH-69, BC-13, BC-15, BC-16, `17_DAC_TA_API.md` giao kèo cấu hình lưới, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.82.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 6.

#### Vấn đề tồn đọng

- Chưa có Xuất Excel, duyệt hàng loạt ở các lưới của phân hệ; chi tiết hóa đơn, lập phiếu thu, giao dịch chuyển khoản chờ xử lý, nhập tệp sao kê giữ giao diện cũ; danh sách rất dài vẫn tải một lần.

### 2026-10-18 — DT-15 phần 15f2: phân hệ Nhân sự – chấm công, lương theo giao diện chung của Sở

#### Công việc đã thực hiện

- Đưa 12 trang của phân hệ "Nhân sự – chấm công, lương" sang giao diện chung của Sở: tiêu đề có số theo menu (1.1. Chấm công đến 3.2. Đánh giá nhân sự); 17 lưới dữ liệu chung ở 10 trang (đơn nghỉ, quy định và số ngày phép năm, ngày lễ, lịch bù, lịch công tác, phiếu lương, quyết toán, điều chỉnh lương, khoản lương, thưởng và khấu trừ, việc, kế hoạch, chỉ số và phiếu đánh giá); nút Thêm mới mở biểu mẫu theo khối, nút Ghi; xóa ngày lễ, lịch bù, lịch công tác qua hộp xác nhận xóa dùng chung. Nghiệp vụ, điểm cuối, quyền không đổi; không có tệp thay đổi cấu trúc dữ liệu.
- Thêm kịch bản CT-431 đến CT-437, tiêu chí AC-475 đến AC-481; không có quy tắc nghiệp vụ, quy tắc phân quyền, chức năng, màn hình mới (đổi MH-13, MH-14, MH-15, MH-37, MH-44, MH-52, MH-53, MH-54, MH-56, MH-58, MH-59, MH-60). Kết quả ngày 15/10/2026 trên nhánh trước khi gộp phần 15h1: build, kiểm tra kiểu, lint, kiểm tra định dạng đạt; kiểm thử đơn vị toàn bộ kho mã 709/710 ca đạt, ca không đạt CT-15g-11 (số ngày còn lại trước khi hết hạn mật khẩu, phụ thuộc thời điểm chạy ở ranh giới ngày) không liên quan phần này, chạy lại riêng tệp `password-expiry.test.js` 5/5 ca đạt; toàn bộ kiểm thử giao diện 91/91 ca đạt.

#### Quyết định

- Thực hiện đợt 15f của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5, chia theo phân hệ thành 15f1, 15f2, 15f3 làm song song, giữ mã YCTD-113 đến YCTD-115; phần 15f2 gộp trước nên lấy YCTD-113 (bản nháp ghi YCTD-114). Màn hình không phải danh sách (bảng chấm công tháng, bảng lương tháng, bảng quyết toán, biểu thuế, phiếu lương của tôi, bảng tiến độ, kết quả đánh giá của tôi) giữ bố cục; lưới phân trang tại chỗ trên điểm cuối cũ; không thêm ô chọn dòng vì không có thao tác hàng loạt. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-113.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-113, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-13, MH-14, MH-15, MH-37, MH-44, MH-52, MH-53, MH-54, MH-56, MH-58, MH-59, MH-60, BC-13, BC-15, BC-16, `16_CO_SO_DU_LIEU.md` mục `user_grid_settings`, `17_DAC_TA_API.md` giao kèo cấu hình lưới, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.81.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 6.

#### Vấn đề tồn đọng

- Chưa có Xuất Excel, xóa hàng loạt ở các lưới của phân hệ; duyệt, từ chối có lý do và cập nhật tiến độ việc vẫn là ô nhập trong cột thao tác; danh sách rất dài vẫn tải một lần; tiêu đề cột tiền canh trái trong khi số tiền canh phải.

### 2026-10-18 — 2.1 Hồ sơ lớp học: cột và số dòng mặc định theo Sở

#### Công việc đã thực hiện

- Claude đổi cột hiện, ẩn mặc định của lưới "2.1. Hồ sơ lớp học" theo quan sát màn hình của Sở (`31_KHAO_SAT_HE_THONG_SO.md` mục 9.8, 9.9): hiện Lớp ghép, Ghép vào lớp, Lớp giải thể; ẩn Phân hiệu, Giáo viên chủ nhiệm, Điểm trường. Số dòng mặc định của lưới 2.1 là 50; cột mặc định khi xuất Excel không chọn cột đổi theo.
- Sửa CT-403, CT-406, kiểm thử `classes-so.test.ts`, `08-classes.spec.ts`, `54-school-classes-so.spec.ts`. Kết quả trên máy ngày 15/10/2026: build, kiểm tra kiểu, lint, kiểm tra định dạng đạt; `classes-so.test.ts` đạt; `08-classes.spec.ts`, `54-school-classes-so.spec.ts` đạt.

#### Quyết định

- Số dòng mặc định riêng của màn hình (50) chỉ dùng khi người dùng chưa chọn số dòng của lưới và chưa chọn số dòng mặc định chung; hằng số chung giữ 20. Cột Khối, Nhóm trẻ giữ hiện vì là hai phần của cột "Nhóm lớp" của Sở. Mã YCTD-113 đến YCTD-115 dành cho các phần 15f, YCTD-116 và phiên bản 0.66.0 đã dùng cho đợt 15h1 nên thay đổi này là YCTD-117, phiên bản 0.80.1.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-117, `14_DAC_TA_GIAO_DIEN.md` MH-03, `11_TIEU_CHI_NGHIEM_THU.md` AC-447, AC-450, `17_DAC_TA_API.md` mục 5, `21_KICH_BAN_KIEM_THU.md` CT-403, CT-406, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.80.1.

#### Vấn đề tồn đọng

- Không có.

### 2026-10-18 — DT-16 phần 16k: phân hệ Quản lý kí hồ sơ, bản chạy nội bộ

#### Công việc đã thực hiện

- Cơ sở dữ liệu hệ thống: tệp `0015_create_signing_tables` tạo `signing_certificates` (chứng thư số nhà trường, một dòng), `signing_dossiers` (hồ sơ kí theo năm học), `signing_events` (lịch sử thao tác) và dãy số `signing_dossier_code` (mã định danh hồ sơ). Cơ sở dữ liệu định danh: tệp `0049_add_signing_permissions` thêm bốn quyền `P01.signing.view`, `P01.signing.manage`, `P01.signing.sign`, `P01.signing.certificate` và bỏ phân hệ mới khỏi nhóm Phụ huynh. Không có migration năm học.
- Máy chủ API: nhóm điểm cuối `/signing` (`apps/api/src/signing/`): chứng thư số (ghi, đăng ký kí nội bộ, hủy đăng ký, ảnh con dấu, đánh dấu đồng bộ), danh sách đối tượng theo loại, tạo hồ sơ (tệp PDF dựng bằng công cụ PDF của phần 16a, mã băm SHA-256), kí xác nhận nội bộ qua chỗ nối `DossierSigner`, tải thông tin thay đổi, hủy, xác nhận hoàn thành, hủy xác nhận, đánh dấu đã gửi, tải tệp (ghi nhật ký xuất), xuất dữ liệu sổ đầu bài. Công cụ PDF dùng chung nhận thêm khổ dọc và phần cuối tài liệu.
- Cổng quản trị: phân hệ mới "Quản lý kí hồ sơ" với "1.1. Chứng thư số nhà trường", "2.1. Đồng bộ chứng thư số", "2.2. Kí hồ sơ trường, lớp, nhân sự, học sinh", "2.3. Xác nhận hoàn thành và gửi hồ sơ".
- Thêm chức năng P01-28 đến P01-31, quyền PQ-75, kịch bản CT-589 đến CT-598, tiêu chí AC-612 đến AC-615, quy tắc BR-128, màn hình MH-137 đến MH-140. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 848/848 ca đạt; toàn bộ kiểm thử giao diện 133/133 ca đạt (CI, lượt chạy 39121128162); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở (tài liệu 31); tính năng cần hệ thống ngoài làm bản chạy nội bộ, có chỗ nối để cắm kết nối thật, nút ghi đúng việc làm. Áp dụng cho kí số: không có chữ ký số thật, nút "Kí xác nhận nội bộ" thay "Ký số", không có "Đăng nhập và kí"; gửi hồ sơ là "Đánh dấu đã gửi". Thực hiện phần 16k của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7, phần cuối của DT-16. Nội dung hồ sơ PDF, tên nhóm menu, quy trình trạng thái, quyền theo vai trò (BR-128, PQ-75) do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-130.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-130, `07_QUY_TAC_NGHIEP_VU.md` BR-128, `08_VAI_TRO_NGUOI_DUNG.md` PQ-75, `10_YEU_CAU_CHUC_NANG.md` P01-28 đến P01-31, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-137 đến MH-140, `16_CO_SO_DU_LIEU.md` mục 1, 2, 20, `17_DAC_TA_API.md` mục 5, 17, 17.1, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.80.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Chưa có nhà cung cấp chữ ký số và giao diện lập trình của Bộ, Sở: tệp đã kí là xác nhận nội bộ, không có giá trị của chữ ký số; chỗ nối `DossierSigner` để thay bằng kí từ xa sau này. Khảo sát chưa có mẫu hồ sơ của Sở nên nội dung tệp PDF do Claude chọn; sổ đầu bài của trường mầm non lấy điểm danh và lịch hoạt động của lớp theo tháng.

### 2026-10-18 — DT-16 phần 16j: báo cáo số liệu EMIS theo hệ thống của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0059_create_emis_report_values` tạo bảng `emis_report_values` (số liệu nhập tay theo biểu, thẻ, mã chỉ tiêu). Không có migration hệ thống (số 0014 dành cho phần 16j không dùng), không có migration định danh.
- Máy chủ API: dịch vụ bảy biểu EMIS (`apps/api/src/emis/`) với `/reports/emis/forms/{form}` (xem), `/tabs/{tab}` (ghi), `/tabs/{tab}/fill` (Lấy dữ liệu, Lấy dữ liệu năm trước, không lưu), `/export` (Excel mỗi thẻ một trang, in tên đơn vị hành chính); bảy biểu đăng ký gửi lên cấp trên; `/upper-level-submissions/{form}/error-file` (Xuất file lỗi dùng chung); màn hình nhập khóa khi biểu đã đánh dấu đã gửi hoặc đang chờ mở khóa.
- Cổng quản trị: phân hệ "Báo cáo số liệu" có nhóm "1. Báo cáo đầu năm" (1.1, 1.2, 1.3) và "2. Báo cáo cuối năm" (2.1 đến 2.4) dùng một màn hình chung; 1.1 thêm thẻ "Ngân sách nhà nước" và danh sách gửi báo cáo bảy biểu kèm dòng "Số đã gửi, Số cần gửi, Lần gửi cuối"; mỗi dòng biểu có "Xuất file lỗi".
- Thêm chức năng P17-24 đến P17-28 (sửa P17-18, P17-20, P17-22), kịch bản CT-580 đến CT-588, tiêu chí AC-607 đến AC-611, quy tắc BR-127, màn hình MH-131 đến MH-136. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 832/832 ca đạt; toàn bộ kiểm thử giao diện 131/131 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở (tài liệu 31); tính năng cần hệ thống ngoài làm bản chạy nội bộ, nút ghi đúng việc làm ("Xuất tệp gửi", "Đánh dấu đã gửi"), không có nút "Gửi". Thực hiện phần 16j của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7. Tên, mã số chỉ tiêu và cột của bảy biểu, sáu mục I đến VI của 2.1, ba thẻ của 2.2, dữ liệu nguồn của từng thẻ, cột của 1.3 theo khảo sát, quy tắc nhập số liệu (BR-127) do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-129.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-129, `07_QUY_TAC_NGHIEP_VU.md` BR-127, `10_YEU_CAU_CHUC_NANG.md` P17-18, P17-20, P17-22 đến P17-28, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-82, MH-131 đến MH-136, `16_CO_SO_DU_LIEU.md` mục 18, 20, `17_DAC_TA_API.md` mục 5, 17, 17.1, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.79.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Chưa có giao diện lập trình của Bộ, Sở nên không truyền đi (chỗ nối `UpperLevelGateway` của phần 16a); tên, mã số chỉ tiêu của bảy biểu do Claude đặt, cần đối chiếu biểu mẫu chính thức; 1.3 đã khớp cột với khảo sát, chưa khớp dòng; 2.1, 2.4 tính tại thời điểm xem, không giữ số đầu năm; II.06 và II.07 có thể trùng (học sinh chuyển đi cũng có trạng thái thôi học); thẻ Nhà vệ sinh lấy đủ VS.01 đến VS.06 từ khai báo phòng (VS.05, VS.06 theo thuộc tính phòng vệ sinh của phần 16i: `toilet_users` = `staff`, `toilet_standard` = `met`); mức độ đạt chuẩn theo khối phòng của phần 16i chưa đưa vào biểu EMIS 1.2; thẻ Thông tin khác dùng 1, 0 cho có, không; Lấy dữ liệu năm trước cần năm học trước đã chạy migration 0059.

### 2026-10-18 — DT-16 phần 16i: cơ sở vật chất, thiết bị dạy học đủ theo hệ thống của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0058_add_facilities_so_parity` tạo bảng `facility_investments` (6.1), `facility_standard_levels` (mức độ đạt chuẩn của 1.2), `facility_import_jobs` (lần nhập phòng, danh mục thiết bị).
- Máy chủ API: 1.2 Báo cáo cơ sở vật chất kèm nhà vệ sinh, mức độ đạt chuẩn và biểu mẫu gửi `facilities-report`; 6.1 thực trạng và nhu cầu đầu tư; nhập phòng, danh mục thiết bị từ Excel (`/facility-imports`); biểu mẫu gửi `equipment-summary` cho 2.3; thuộc tính nhà vệ sinh chỉ cho Phòng vệ sinh.
- Cổng quản trị: mục mới 1.2, 2.2, 2.3 của phân hệ Cơ sở vật chất, TBDH; nhóm mới 6 (6.1, 6.2) của phân hệ Mầm non; Nhập từ Excel ở 1.1, 2.1, 2.2; khối Gắn thiết bị dạy học ở Kho, thẻ Tài sản.
- Thêm chức năng P13-13 đến P13-15, P17-23, kịch bản CT-572 đến CT-579, tiêu chí AC-602 đến AC-606, quy tắc BR-126, màn hình MH-127 đến MH-130. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 832/832 ca đạt; toàn bộ kiểm thử giao diện 130/130 ca đạt (CI, lượt chạy 39103041728; CT-15a-8 của `01-login.spec.ts` sửa theo nhóm menu mới "6. Cơ sở vật chất"); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở; tính năng cần hệ thống ngoài làm bản chạy nội bộ với nút ghi đúng việc làm ("Xuất tệp gửi", "Đánh dấu đã gửi"). Thực hiện phần 16i của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7. Mức độ đạt chuẩn theo khối do Hiệu trưởng đánh giá, mức của trường là mức thấp nhất; thông tin nhà vệ sinh lưu ở thuộc tính phòng; nhập Excel dùng bảng lần nhập riêng (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-128, `07_QUY_TAC_NGHIEP_VU.md` BR-126, `10_YEU_CAU_CHUC_NANG.md` P13-13 đến P13-15, P17-23, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-127 đến MH-130, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.78.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Gửi 1.2, 2.3 chưa nối hệ thống của Sở; mức độ đạt chuẩn và thuộc tính nhà vệ sinh cần đối chiếu biểu mẫu chính thức; thẻ nhà vệ sinh của EMIS 1.2 đọc dữ liệu này từ YCTD-129 (phần 16j).

### 2026-10-18 — DT-16 phần 16e: trường, lớp và lịch năm học theo hệ thống của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0054_create_accreditation_reviews_and_school_splits` tạo bảng `accreditation_reviews` (rà soát thông tin kiểm định CLGD), `school_split_requests`, `school_split_items` (tách trường). Cơ sở dữ liệu hệ thống: tệp `0013_add_school_week_fields_and_carry_over_time` thêm `school_weeks.term_type`, `school_weeks.is_visible`, `academic_year_databases.carried_over_at`.
- Máy chủ API: ba khóa cấu hình của Trường chính (tên trường hiển thị, tên đơn vị hành chính, tính cân nặng/chiều cao cho trẻ suy dinh dưỡng thể nhẹ cân) kèm kiểu giá trị `text`; tên trường hiển thị ở `/portal-context`, `/public/login-info`; ô cân nặng/chiều cao áp cho 4.3.2; học kỳ, hiển thị của tuần ở `/academic-years/{id}/weeks`; trạng thái chuyển hồ sơ và Hủy chuyển hồ sơ (`/academic-years/rollover/status`, `/academic-years/{id}/cancel-open`); xóa lớp, thao tác hàng loạt trên lớp (`/classes/delete`, `/classes/bulk-update`); dòng giáo viên chưa phân công ở `/class-assignments`; bảy cột lớp theo Sở khi nhập lớp; `/accreditation-review`; nhóm `/school-splits` kèm xuất hồ sơ 82 cột, 75 cột.
- Cổng quản trị: khối "Cấu hình trường" ở 1.4; mục mới "1.7. Rà soát thông tin kiểm định CLGD", "1.8. Tách trường", "3.4. Khai báo tuần", "5.7. Chuyển hồ sơ lên năm học mới"; 2.1 có ô chọn dòng, nút Thay đổi, Giải thể lớp đã chọn, Xóa lớp; 3.3 có dòng "Chưa phân công" và lọc Tình trạng phân công.
- Thêm chức năng P01-24 đến P01-27 (sửa P01-08, P01-13, P02-05), kịch bản CT-551 đến CT-571, tiêu chí AC-595 đến AC-601, quy tắc BR-125, màn hình MH-123 đến MH-126. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 825/825 ca đạt; toàn bộ kiểm thử giao diện 129/129 ca đạt (CI, lượt chạy 39086989582); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở (tài liệu 31); tính năng cần hệ thống ngoài làm bản chạy nội bộ, gồm 1.8 Tách trường. Thực hiện phần 16e của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7. Ba mục của khối "Cấu hình trường" chỉ đặt ở Trường chính; phòng bộ môn ở 1.7 là năm loại phòng giáo dục chuyên biệt, diện tích sàn là tổng diện tích phòng đang dùng; tách trường không truyền dữ liệu, xác nhận đi không đổi trạng thái hồ sơ học sinh, nhân sự; tuần đệm dùng lại cột tuần nghỉ; Hủy chuyển hồ sơ chỉ khi năm học mới chưa có dòng nào thêm hoặc sửa sau giờ chuyển xong và năm học đầu tiên không hủy được; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-127.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-127, `07_QUY_TAC_NGHIEP_VU.md` BR-125, `10_YEU_CAU_CHUC_NANG.md` P01-08, P01-13, P01-24 đến P01-27, P02-05, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-03, MH-30, MH-92, MH-93, MH-123 đến MH-126, `16_CO_SO_DU_LIEU.md` mục 2, 20, `17_DAC_TA_API.md` mục 5, 6, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.77.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Tách trường chưa nối hệ thống của Sở (chỗ nối `SchoolSplitTransport`); tên đơn vị hành chính chưa in lên đầu báo cáo (phần 16j); ô cân nặng/chiều cao cho trẻ nhẹ cân chưa áp cho so sánh hai lần cân đo và thống kê 5.3; "Hiển thị" của tuần chưa được các màn hình chọn tuần khác dùng; cách tính phòng bộ môn, diện tích sàn ở 1.7 chưa đối chiếu biểu mẫu kiểm định chính thức.

### 2026-10-18 — DT-16 phần 16g: nhóm Học sinh đủ theo hệ thống của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0056_add_student_records_so` thêm số thứ tự trong lớp, cột xóa hồ sơ, xác thực số định danh, biến động cư trú của `children`, bảng `student_learning_accounts`, `student_transfers`, ba loại nhập mới.
- Máy chủ API: mô đun `student-records` (xóa hồ sơ nháp, mã Bộ, tệp 82 cột theo mẫu Bộ, file lỗi, sắp xếp học sinh, điện thoại nhận tin hàng loạt, chuyển lớp hàng loạt, số định danh, tài khoản học và thi, chuyển trường, công cụ nhập 82 cột); nhập điện thoại nhận tin, số định danh, địa chỉ mới bằng bộ nhập chung; sửa, xóa dòng đối chiếu địa danh.
- Cổng quản trị: 4.1.1 đủ nút; màn hình mới 4.1.2, 4.1.3, 4.1.5, 4.1.8, 4.1.10, 5.4, 5.5; 4.2 chuyển lớp hàng loạt và khối chuyển trường; 4.1.11 nhập địa chỉ mới, sửa, xóa dòng đối chiếu.
- Thêm chức năng P02-18 đến P02-23, kịch bản CT-534 đến CT-550, tiêu chí AC-578 đến AC-594, quy tắc BR-124, quy tắc phân quyền PQ-74, màn hình MH-116 đến MH-122. Kết quả ngày 18/10/2026: 13 ca kiểm thử đơn vị và 4 ca kiểm thử giao diện của phần 16g đạt; kiểm thử đơn vị toàn bộ 810/810, kiểm thử giao diện toàn bộ 122/123 ca đạt (ca hỏng là CT-15a-7 của `01-login.spec.ts`: trang đăng nhập chưa hiện kịp ở đầu lượt chạy, không liên quan phần này, đạt ở các lần chạy trước và sau; ở lần chạy khác hỏng `04-accounts` do tài khoản còn lại trong cơ sở dữ liệu định danh của lần chạy trước và CT-16a-10 do tiến trình xuất nền nhận tác vụ sớm, cũng không liên quan).

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở (tài liệu 31); tính năng cần hệ thống ngoài làm bản chạy nội bộ với nhãn đúng việc làm được. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: chỉ xóa hồ sơ nháp và không xóa cứng; tài khoản học và thi lưu nội bộ vì trẻ mầm non không tự đăng nhập; danh sách trùng là hồ sơ nghi trùng cùng họ tên, ngày sinh; danh mục tổ/thôn lấy từ hồ sơ đang có; trang nhập chung đánh số 4.1.13; không dùng tệp định danh `0048`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-126, `07_QUY_TAC_NGHIEP_VU.md` BR-124, `08_VAI_TRO_NGUOI_DUNG.md` PQ-74, `10_YEU_CAU_CHUC_NANG.md` P02-18 đến P02-23, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-02, MH-40, MH-85, MH-94, MH-116 đến MH-122, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.76.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Kết nối thật tới CSDL Bộ, CSDLQG về dân cư, liên thông giữa các trường chờ giao diện lập trình; tài khoản học và thi chờ phần mềm học, thi.

### 2026-10-17 — DT-16 phần 16h: sức khỏe, dinh dưỡng và thống kê học sinh theo hệ thống của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0057_add_student_health_and_menu_fields` thêm tên thực đơn, tháng, tuần, từ ngày, đến ngày, khối áp dụng cho `menus`; tạo bảng `student_health_records` (thông tin sức khỏe học sinh theo học kỳ) và `menu_import_jobs` (lần nhập thực đơn từ Excel).
- Máy chủ API: 4.6 thông tin sức khỏe theo học kỳ (`/student-health`, "Lấy dữ liệu từ 4.3", Xuất Excel); 4.3.2 tổng hợp theo học kỳ, so sánh hai lần cân đo, số được khám định kỳ; 4.5 thông tin chung của thực đơn theo Sở, "Thay đổi" thực đơn nháp, nhập thực đơn từ Excel (`/menu-imports`); 5.3 thống kê học sinh đủ các phần, Xuất Excel, PDF (`/statistics/students`); số liệu báo cáo sức khỏe học sinh đầu năm (`/reports/emis/start-of-year-health`) làm điểm nối cho phần 16j.
- Cổng quản trị: màn hình "4.6.1. Nhập thông tin sức khỏe học sinh"; "5.3. Thống kê học sinh" sáu thẻ (dùng chung cho thẻ 5.3 của trang Thống kê theo tiêu chí ngành); 4.3.2 có ô Tổng hợp theo Tháng hoặc Học kỳ, ô So sánh với đợt, bảng so sánh, cột Được khám định kỳ; 4.5 có biểu mẫu lập thực đơn theo Sở, cột lưới mới, nút "Thay đổi", "Nhập từ Excel"; thành phần nhập Excel dùng chung nhận đường dẫn gốc riêng của phân hệ.
- Thêm chức năng P10-15, P12-10, P17-21, P17-22 (sửa P10-14), kịch bản CT-524 đến CT-533, tiêu chí AC-568 đến AC-577, quy tắc BR-123, màn hình MH-114, MH-115. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 787/787 ca đạt; toàn bộ kiểm thử giao diện 115/115 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở (tài liệu 31); tính năng cần hệ thống ngoài làm bản chạy nội bộ. Thực hiện phần 16h của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7. Kết quả giáo dục thể chất hai mức Đạt, Chưa đạt; học kỳ theo lịch năm học, chưa khai báo thì tháng 8 đến tháng 12 là học kỳ I; con thương binh, liệt sĩ nhận biết theo chữ trong đối tượng chính sách; thực đơn vẫn theo tuần, từ ngày đến ngày trong một tuần; lần nhập thực đơn dùng bảng riêng thay vì đổi ràng buộc loại nhập của `data_import_jobs`; tên và mã chỉ tiêu báo cáo sức khỏe đầu năm đặt theo dữ liệu có sẵn, màn hình và gửi lên cấp trên để phần 16j; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-125.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-125, `07_QUY_TAC_NGHIEP_VU.md` BR-123, `10_YEU_CAU_CHUC_NANG.md` P10-14, P10-15, P12-10, P17-21, P17-22, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-16, MH-17, MH-18, MH-76, MH-77, MH-114, MH-115, `16_CO_SO_DU_LIEU.md` mục 2, 11, 13, 20, `17_DAC_TA_API.md` mục 5, 13, 15, 17, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.75.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Chỉ tiêu báo cáo sức khỏe đầu năm chưa đối chiếu biểu mẫu chính thức của Sở; màn hình 1.3, xuất tệp, gửi lên cấp trên chờ phần 16j; bệnh về mắt dạng chữ trong hồ sơ CSDL ngành chưa chuyển sang bảy loại; nhập thực đơn chưa cập nhật thực đơn đã có; 4.6.1 chưa có nhập từ Excel.

### 2026-10-17 — DT-16 phần 16f: nhóm Nhân sự đủ theo hệ thống của Sở

#### Công việc đã thực hiện

- Cơ sở dữ liệu năm học: tệp `0055_add_staff_so_parity` thêm chín cột của `staff` (tài khoản ngân hàng, tên ngân hàng, mã số thuế, xã ĐBKK, trạng thái xác thực số định danh kèm ngày, người, ghi chú), hai bảng mới `staff_branch_assignments`, `staff_movements`, loại nhập `professional_ratings`. Không thêm tệp định danh (số `0047` giữ cho phần này không dùng), không thêm mã quyền.
- Gói dùng chung: danh mục của Bộ cho hồ sơ cán bộ (trạng thái cán bộ, dân tộc, tôn giáo, vị trí việc làm, nhóm chức vụ, hình thức hợp đồng, trình độ chuyên môn); biểu mẫu hồ sơ chọn theo danh mục, giữ giá trị cũ; khối "Tài khoản ngân hàng, mã số thuế", ô "Ở xã đặc biệt khó khăn (ĐBKK)"; menu thêm 3.1.2, 3.1.3, 3.1.5, 3.5, 5.2, 5.6.
- Máy chủ API: xóa hồ sơ nhập nhầm, Xuất tệp theo mẫu Bộ 75 cột kèm kiểm tra dữ liệu, Xuất file lỗi, tệp mẫu 75 cột kèm dữ liệu, tra cứu danh mục của Bộ; nhân sự phân hiệu; đánh dấu xác thực số định danh (bản chạy nội bộ, chỗ nối `IdentityVerificationGateway`), tiến độ và trùng số định danh; biến động nhân sự bốn loại; nhập mức đánh giá chuẩn nghề nghiệp từ Excel; thống kê nhân sự theo danh mục Bộ và chuẩn nghề nghiệp; 5.9 thêm tài khoản ngân hàng, mã số thuế.
- Cổng quản trị: 3.1.1 thêm Thay đổi, Xóa, Xuất tệp theo mẫu Bộ, Xuất file lỗi, lọc Xã ĐBKK, Xác thực số định danh; màn hình mới 3.1.2 Nhân sự phân hiệu, 3.1.3 Nhập nhân sự từ Excel, 3.1.5 Xác thực số định danh nhân sự với CSDLQG về dân cư, 3.5 Biến động nhân sự (bốn thẻ), 5.2 Thống kê nhân sự, 5.6 Tiến độ xác thực số định danh nhân sự; 3.2 thêm "Nhập mức đánh giá từ Excel"; 4.1.2 Nhập dữ liệu từ Excel bỏ hai phần nhân sự.
- Thêm chức năng P07-06 đến P07-10, kịch bản CT-510 đến CT-523, tiêu chí AC-554 đến AC-567, quy tắc BR-122, quy tắc phân quyền PQ-73, màn hình MH-108 đến MH-113. Kết quả ngày 17/10/2026: 10 ca kiểm thử đơn vị (`apps/api/src/staff/staff-parity.test.ts`) và 4 ca kiểm thử giao diện (`tests/e2e/60-staff-full-so.spec.ts`) của phần 16f đạt; kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 788/788 ca đạt; toàn bộ kiểm thử giao diện 118/118 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt. Kiểm thử giao diện `55-staff-so` sửa cách chọn Dân tộc, Vị trí việc làm vì hai ô thành danh sách chọn.

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở (tài liệu 31); tính năng cần hệ thống ngoài làm bản chạy nội bộ với nhãn đúng việc làm được ("Đánh dấu đã xác thực", "Xuất tệp theo mẫu Bộ"), không giả như đã gửi đi. Thực hiện phần 16f của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7. Xóa hồ sơ chỉ với hồ sơ chưa có dữ liệu liên quan; xã ĐBKK đánh dấu theo nhân sự; gán phân hiệu không đổi phạm vi quyền; duyệt chuyển đi cho nghỉ việc, chấm dứt hợp đồng, khóa tài khoản; tiếp nhận chuyển đến tạo hồ sơ nháp; không thêm mã quyền; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-124.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-124, `07_QUY_TAC_NGHIEP_VU.md` BR-122, `08_VAI_TRO_NGUOI_DUNG.md` PQ-73, `10_YEU_CAU_CHUC_NANG.md` P07-01, P07-04, P07-05, P07-06 đến P07-10, P17-17, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-12, MH-40, MH-74, MH-78, MH-108 đến MH-113, `16_CO_SO_DU_LIEU.md` mục 2, 8, 20, `17_DAC_TA_API.md` mục 11, 17, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.74.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Chưa có kết nối thật tới CSDL Bộ, CSDLQG về dân cư, liên thông giữa các trường; 5.1 vẫn giữ thẻ nhân sự cũ; danh mục của Bộ cần đối chiếu bản chính thức; xã ĐBKK chưa có cờ ở danh mục địa danh hành chính; tệp hồ sơ chuyển đến một dòng; nhập mức đánh giá tối đa 20 tiêu chí.

### 2026-10-17 — DT-16 phần 16c: khung trang và đăng nhập theo hệ thống của Sở

#### Công việc đã thực hiện

- Dịch vụ định danh: mã xác nhận dạng ảnh tự vẽ ở máy chủ cho kênh cổng quản trị (bắt buộc khi bật "luôn hiện" hoặc sau số lần nhập sai cấu hình được), quên mật khẩu tự phục vụ bằng mã gửi qua tin nhắn, lịch sử mật khẩu (bảng mới `password_history`), bốn cấu hình mới (số lần sai thì hiện mã xác nhận, số mật khẩu gần nhất không được dùng lại, luôn hiện mã xác nhận, đường dây nóng), điểm cuối công khai `/auth/login-options`, `/auth/captcha`, `/auth/password-reset/request`, `/auth/password-reset/confirm`; tệp định danh `0045` thêm quyền `P01.announcement.manage`.
- Máy chủ API: thông báo hệ thống, ứng dụng liên kết (hai bảng mới ở cơ sở dữ liệu hệ thống, tệp `0011`), ngữ cảnh trường của cổng quản trị, thông tin công khai của trang đăng nhập, kiểm tra mã định danh điện tử của tổ chức 12 chữ số (Nghị định 69/2024/NĐ-CP), người dùng tự sửa thông tin liên hệ trên hồ sơ nhân sự của mình.
- Cổng quản trị: thanh đầu trang có tên trường, ô "Cấp MN · năm học · học kỳ", nút lưới ứng dụng liên kết; menu người dùng đủ bảy mục theo Sở (thêm Hồ sơ nhân sự cá nhân, Hướng dẫn); hộp "Thông báo" khi vào trang; trang đăng nhập có tên, mã trường, ghi nhớ tài khoản, mã xác nhận, liên kết Quên mật khẩu, đường dây nóng; trang Quên mật khẩu; mục "3.6. Thông báo hệ thống", "3.7. Ứng dụng liên kết" của Quản trị hệ thống; khối "Đăng nhập và bảo mật" ở 1.4 Cấu hình trường.
- Thêm chức năng P01-21 đến P01-23, kịch bản CT-489 đến CT-509, tiêu chí AC-533 đến AC-553, quy tắc BR-121, quy tắc phân quyền PQ-72, màn hình MH-102 đến MH-107. Kết quả ngày 17/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 778/778 ca đạt; toàn bộ kiểm thử giao diện 114/114 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Ngày 2026-10-17 gộp nhánh chính có phần 16b, 16d, 16a, 15h2: đổi số tài liệu của phần này (YCTD-123, phiên bản 0.73.0, P01-21 đến P01-23, CT-489 đến CT-509, AC-533 đến AC-553, BR-121, PQ-72, MH-102 đến MH-107); hai mục của Quản trị hệ thống thành "3.6. Thông báo hệ thống", "3.7. Ứng dụng liên kết" vì 3.5 là "Tệp đã tạo" của phần 16a; nút ở khối "Đăng nhập và bảo mật" đổi tên "Lưu đăng nhập và bảo mật"; kịch bản giao diện đổi tên `tests/e2e/59-portal-shell-login.spec.ts`; sửa kiểm thử giao diện `03-org-units` tìm tên trường trong danh sách đơn vị vì thanh đầu trang nay hiện tên trường.

#### Quyết định

- Eric quyết định ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống Sở (tài liệu 31); tính năng cần hệ thống ngoài làm bản chạy nội bộ, gồm đăng nhập chọn trường của Sở. Thực hiện phần 16c của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7. Trang đăng nhập hiện tên, mã trường và năm học đang dùng thay bước chọn trường; mã xác nhận tự sinh ở máy chủ, không dùng dịch vụ ngoài; quên mật khẩu chỉ qua tin nhắn; quyền `P01.announcement.manage` cho VT-01, VT-02; không làm "Đăng nhập năm cũ"; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-123.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-123, `07_QUY_TAC_NGHIEP_VU.md` BR-121, `08_VAI_TRO_NGUOI_DUNG.md` PQ-72, `10_YEU_CAU_CHUC_NANG.md` P01-21 đến P01-23, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-47, MH-83, MH-84, MH-102 đến MH-107, `16_CO_SO_DU_LIEU.md` mục 1, 2, 20, `17_DAC_TA_API.md` mục 4, 5, 11, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.73.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Quên mật khẩu chưa có kênh thư điện tử; chưa có "Đăng nhập năm cũ"; không có đăng nhập một lần của Sở; Cấu hình hiển thị lưới vẫn chỉ có số dòng mặc định; hướng dẫn là trang tĩnh ngắn.

### 2026-10-17 — DT-15 phần 15h2: sửa các hạn chế của văn thư lưu trữ

#### Công việc đã thực hiện

- Phông, hồ sơ văn thư chia theo đơn vị và lọc theo phạm vi; người giải quyết chọn từ nhân sự; nhắc sắp đến hạn, quá hạn; hàng chờ xóa lại tệp ở kho tệp. Tệp hệ thống `0016`.
- Thêm kịch bản CT-483 đến CT-488, tiêu chí AC-527 đến AC-532, quy tắc BR-120, quy tắc phân quyền PQ-71. Kết quả: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 743/743 ca đạt, toàn bộ kiểm thử giao diện 100/100 ca đạt ngày 17/10/2026 trước khi gộp PR 94, 96, 97; sau khi gộp, build, kiểm tra kiểu, lint, kiểm tra định dạng đạt và CI chạy lại đủ kiểm thử đơn vị, giao diện.

#### Quyết định

- Eric chọn ngày 2026-10-16: sổ văn bản đến, đi và biên bản giao nộp, tiêu hủy chờ khảo sát; dùng tệp `0016`. Phạm vi đơn vị, nhắc 3 ngày trước, 20 lần thử xóa lại Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-122.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-122, `07_QUY_TAC_NGHIEP_VU.md` BR-120, `08_VAI_TRO_NGUOI_DUNG.md` PQ-71, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.72.0.

#### Vấn đề tồn đọng

- Sổ văn bản đến, đi và biên bản giao nộp, tiêu hủy chờ khảo sát bổ sung; nhắc hạn chưa gửi tin nhắn.

### 2026-10-17 — DT-16 phần 16a: công cụ xuất, nhập dùng chung và mẫu gửi lên cấp trên

#### Công việc đã thực hiện

- Thêm nút "Xuất PDF" cho lưới dữ liệu dùng chung (bật bằng thuộc tính tùy chọn, năm màn hình), tác vụ xuất nền cho danh sách lớn với màn hình "3.5. Tệp đã tạo", thành phần nhập Excel dùng chung (tải file mẫu kèm dữ liệu, tra cứu danh mục, chọn cột để nhập, xuất file lỗi) áp cho Nhập dữ liệu từ Excel và 2.2 Nhập lớp học từ Excel, mẫu "gửi lên cấp trên" chạy nội bộ áp cho Biểu 1 EMIS đầu năm. Ba bảng mới ở cơ sở dữ liệu hệ thống (tệp `0010`), không thêm quyền.
- Thêm chức năng P01-20, P17-19, P17-20, kịch bản CT-472 đến CT-482, tiêu chí AC-516 đến AC-526, quy tắc BR-119, quy tắc phân quyền PQ-70, màn hình MH-101, quy tắc bố cục BC-17. Kết quả ngày 17/10/2026 trên CI của PR 97: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 758/758 ca đạt (gồm 7 ca CT-472 đến CT-478 của `export-tools.test.ts`); toàn bộ kiểm thử giao diện 107/107 ca đạt (gồm 4 ca CT-479 đến CT-482 của `58-export-import-tools.spec.ts`; ca 23 quyết toán từng hỏng vì vượt giới hạn đăng nhập mỗi phút nên các ca 20 đến 24 chờ rồi đăng nhập lại qua `submitSignIn` của `tests/e2e/fixtures.ts`). Trên máy phát triển toàn bộ kiểm thử giao diện 107/107 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 16a của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7 theo lựa chọn của Eric ngày 2026-10-16 (bản chạy nội bộ, nút ghi đúng việc làm, để sẵn chỗ nối). Tiến trình xuất nền chạy trong máy chủ API thay cho `apps/worker`; nhập lớp học cập nhật lớp đã có theo cột được chọn; quyền mở khóa của Biểu 1 EMIS là `P01.school-profile.manage`; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-121.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-121, `07_QUY_TAC_NGHIEP_VU.md` BR-119, `08_VAI_TRO_NGUOI_DUNG.md` PQ-70, `10_YEU_CAU_CHUC_NANG.md` P01-20, P17-19, P17-20, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-40, MH-82, MH-92, MH-101, BC-17, `16_CO_SO_DU_LIEU.md` mục 1, 18, `17_DAC_TA_API.md` mục 17, 17.1, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.71.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Xuất PDF, tác vụ nền còn bật dần ở các màn hình khác (16b, lượt 2, 3); tệp mẫu kèm dữ liệu mới có ở lớp học; gửi lên cấp trên mới có Biểu 1 EMIS, chưa truyền đi được.
### 2026-10-17 — DT-16 phần 16d: quản trị hệ thống đủ theo hệ thống của Sở

#### Công việc đã thực hiện

- 1.1 Nhóm người dùng: Hiệu lực theo dữ liệu, Sửa (tên, hiệu lực), Xóa qua hộp xác nhận xóa; không ngừng hiệu lực, không xóa nhóm hệ thống, không xóa nhóm đang có người dùng; nhóm hết hiệu lực không cấp quyền, phân hệ.
- Màn hình mới 1.2 Phân quyền nhóm theo phần mềm: tích phân hệ nhóm được dùng; phân hệ không nhóm nào của tài khoản được dùng thì ẩn khỏi ô chọn phân hệ và menu; máy chủ vẫn kiểm tra quyền theo thao tác; 1.3 nhắc khi nhóm chưa được dùng phân hệ.
- 1.4 Danh sách người dùng đủ theo Sở: cột Mã nhân sự, Mã Bộ, Thời gian đổi, Ngày hết hạn mật khẩu; lọc Mã định danh, ngày hết hạn mật khẩu; Phân nhóm quyền, Cấp mật khẩu hàng loạt, Lấy danh sách CBQL/GV, Xuất Excel qua máy chủ API ghép tài khoản với hồ sơ nhân sự.
- Màn hình mới 1.6 Tài khoản đồng bộ của Bộ, của Sở (bản chạy nội bộ): lưu tên đăng nhập, mật khẩu mã hóa ở bảng thông tin kết nối, không trả mật khẩu; ghi rõ chưa đồng bộ được, để sẵn chỗ nối.
- Thêm chức năng P01-18, P01-19, kịch bản CT-458 đến CT-471, tiêu chí AC-502 đến AC-515, quy tắc BR-118, quy tắc phân quyền PQ-69, màn hình MH-99, MH-100. Kết quả ngày 17/10/2026 trên CI của PR 96: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 748/748 ca đạt (thêm 10 ca CT-458 đến CT-467); toàn bộ kiểm thử giao diện 103/103 ca đạt (thêm 4 ca CT-468 đến CT-471); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt. Trên máy phát triển kiểm thử đơn vị 748 ca đạt; kiểm thử giao diện chạy trên CI vì các phiên khác dùng chung cổng và cơ sở dữ liệu kiểm thử giao diện.

#### Quyết định

- Thực hiện phần 16d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7 theo quyết định của Eric ngày 2026-10-16 (làm đủ tính năng đã khảo sát; tính năng cần hệ thống bên ngoài làm bản chạy nội bộ). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: lưu phân hệ bị bỏ thay vì phân hệ được dùng để phân hệ mới mặc định hiện; Phụ huynh bỏ mọi phân hệ; không thêm mã quyền; 1.6 dùng quyền `P01.integration.manage` và bảng `integration_credentials`; Mã định danh khớp mã nhân sự hoặc mã Bộ.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-120, `07_QUY_TAC_NGHIEP_VU.md` BR-118, `08_VAI_TRO_NGUOI_DUNG.md` PQ-69, `10_YEU_CAU_CHUC_NANG.md` P01-18, P01-19, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-30, MH-99, MH-100, `16_CO_SO_DU_LIEU.md`, `17_DAC_TA_API.md`, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.70.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Chưa đồng bộ được lên CSDL ngành của Bộ, Sở (chưa có giao diện lập trình); 1.2 theo phân hệ của cổng quản trị, không theo sáu phần mềm của Sở; Lấy danh sách CBQL/GV dùng một nhóm quyền chung.
### 2026-10-16 — DT-16 phần 16b: lưới dữ liệu chung, hộp xác nhận xóa, Xuất Excel cho các màn hình còn lại theo hệ thống của Sở

#### Công việc đã thực hiện

- Chuyển danh sách của các màn hình còn lại sang lưới dữ liệu chung (38 khóa lưới mới): 1.1 Khai báo cơ sở vật chất, 2.1 Tổng hợp thiết bị dạy học của phân hệ Quản lý cơ sở vật chất, TBDH; 4.3.2, 5.8, 4.4, 4.1.6, 3.2, 4.5, 4.6.1, 4.6.2 của phân hệ Quản lý giáo dục Mầm non; 2.1 đến 2.5, 3.2 của phân hệ Quản trị hệ thống. Bỏ học sinh khỏi nhóm (một hoặc nhiều), bỏ món, bỏ nguyên liệu, xóa tiêu chuẩn sức khỏe, bỏ liên kết Zalo qua hộp xác nhận xóa; tiêu đề trang theo số menu.
- Thêm Xuất Excel theo cột đang hiện cho 1.2 Quản lý phân hiệu, 1.3 Quản lý điểm trường, 4.1.11 Cập nhật địa danh hành chính, 1.4 Danh sách người dùng, 1.1 Nhóm người dùng (bốn điểm cuối mới, ghi nhật ký xuất).
- Thêm kịch bản CT-451 đến CT-457, tiêu chí AC-495 đến AC-501, quy tắc BR-117. Cơ sở dữ liệu ở máy phát triển không chạy được nên kết quả lấy trên CI của PR 94 ngày 16/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 742/742 ca đạt; toàn bộ kiểm thử giao diện 99/99 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện phần 16b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7 theo yêu cầu của Eric ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của hệ thống của Sở. Không thêm bảng, quyền; tìm kiếm trên các lưới mới tìm tại chỗ; bảng nhập theo ô và bảng số liệu cố định giữ dạng bảng; xuất 1.4, 1.1 do máy chủ API đọc lại ở dịch vụ định danh bằng mã phiên của người xuất, đường dẫn `/account-exports` để cổng vào không chuyển sang dịch vụ định danh; tệp phân hiệu, điểm trường, nhóm người dùng ghi không có dữ liệu cá nhân; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-119.

- Ngày 2026-10-17 gộp nhánh chính có phần 16d (YCTD-120): Xuất Excel 1.4 dùng `POST /account-directory/export` của phần 16d (đủ cột Mã nhân sự, Mã Bộ, hạn mật khẩu), bỏ `POST /account-exports/users` của phần này và kiểm thử CT-454 (thay bằng CT-466); tệp 1.1 lấy Hiệu lực theo dữ liệu, thêm cột Số người dùng.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-119, `07_QUY_TAC_NGHIEP_VU.md` BR-117, `10_YEU_CAU_CHUC_NANG.md` P01-01, P01-06, P01-07, P02-17, `14_DAC_TA_GIAO_DIEN.md` BC-13, BC-15 và các MH ở YCTD-119, `17_DAC_TA_API.md` mục 5, 6, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.69.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 7.

#### Vấn đề tồn đọng

- Chưa có Xuất PDF trên các lưới (chờ phần 16a gộp); 1.1, 1.4 còn thiếu cột, bộ lọc, thao tác của Sở (phần 16d); các màn hình tài chính dùng bảng danh mục chung chuyển ở phần 15f1.

### 2026-10-16 — DT-15 phần 15h2: văn thư lưu trữ theo hệ thống của Sở

#### Công việc đã thực hiện

- Thêm nhóm menu "5.10. Văn thư lưu trữ" với bốn màn hình: 5.10.1 Hồ sơ tài liệu (hai thẻ Chưa hoàn thành, Hoàn thành trên lưới dữ liệu chung phân trang ở máy chủ, nhãn Quá hạn, Mở rộng tìm kiếm, biểu mẫu theo khối với nút Ghi, Xóa qua hộp xác nhận, tệp đính kèm ở kho tệp, Xuất Excel), 5.10.2 Phông lưu trữ, 5.10.3 Thông tin lưu trữ, 5.10.4 Báo cáo lưu trữ có Xuất Excel. Bốn bảng mới ở cơ sở dữ liệu hệ thống (tệp `0009`), ba quyền mới (tệp định danh `0044`).
- Thêm chức năng P09-06 đến P09-08, kịch bản CT-438 đến CT-450, tiêu chí AC-482 đến AC-494, quy tắc BR-116, quy tắc phân quyền PQ-68, màn hình MH-95 đến MH-98. Kết quả ngày 16/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 738/738 ca đạt; toàn bộ kiểm thử giao diện 99/99 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện đợt 15h2 của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5. Dữ liệu ở cơ sở dữ liệu hệ thống vì không gắn năm học, nhật ký vẫn ghi ở năm học đang dùng; thông tin lưu trữ là màn hình nhập riêng để báo cáo cộng lại; quyền `P09.archive.view`, `P09.archive.manage`, `P09.archive.export` thuộc P09, gán đủ cho VT-02, VT-04, VT-06, xem và xuất cho VT-15, xem cho VT-03; người giải quyết là chữ tự do; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-118.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-118, `07_QUY_TAC_NGHIEP_VU.md` BR-116, `08_VAI_TRO_NGUOI_DUNG.md` PQ-68, `10_YEU_CAU_CHUC_NANG.md` P09-06 đến P09-08, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-95 đến MH-98, `16_CO_SO_DU_LIEU.md` mục 2, 20, `17_DAC_TA_API.md` mục 12, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.68.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 6.

#### Vấn đề tồn đọng

- Người giải quyết chưa chọn từ danh sách nhân sự; chưa có nhắc hạn; chưa có sổ văn bản đến, đi, biên bản giao nộp, tiêu hủy; hồ sơ chưa phân theo đơn vị.

### 2026-10-16 — Kế hoạch DT-16: bổ sung đủ tính năng theo hệ thống của Sở

#### Công việc đã thực hiện

- Đối chiếu từng dòng của `31_KHAO_SAT_HE_THONG_SO.md` (mục 2 đến 7) với mã nguồn hiện tại: liệt kê màn hình, thẻ, cột, bộ lọc, nút còn thiếu hoặc mới làm một phần.
- Thêm mục 7 vào `32_KE_HOACH_THEO_HE_THONG_SO.md` (phiên bản 1.4): đợt DT-16 gồm 11 phần (16a đến 16k), chia ba lượt.

#### Quyết định

- Eric yêu cầu ngày 2026-10-16 làm đủ mọi tính năng đã khảo sát của Sở.
- Eric chọn ngày 2026-10-16: tính năng cần hệ thống bên ngoài (đồng bộ lên CSDL Bộ, Sở; xác thực với CSDLQG về dân cư; ký số; tách trường; gửi lên cấp trên; biến động liên trường; đăng nhập chọn trường) làm bản chạy nội bộ, thay cho dòng "Không áp dụng" của mục 1 tài liệu 32.
- Eric chọn ngày 2026-10-16: phân hệ Tuyển sinh đầu cấp và Hồ sơ điện tử chờ khảo sát bổ sung.

#### Thay đổi

- `32_KE_HOACH_THEO_HE_THONG_SO.md`, `02_NHAT_KY_DU_AN.md`.

#### Vấn đề tồn đọng

- Lượt 1 (16a đến 16d) đang làm; lượt 2, 3 chờ lượt trước gộp.
### 2026-10-15 — DT-15 phần 15h1: cập nhật địa danh hành chính theo hệ thống của Sở

#### Công việc đã thực hiện

- Thêm danh mục địa danh hành chính ở cơ sở dữ liệu hệ thống (đơn vị cũ, đơn vị mới, bảng đối chiếu) và gieo sẵn Thành phố Hồ Chí Minh mới: 168 đơn vị cấp xã, 441 xã cũ của Thành phố Hồ Chí Minh, Bình Dương, Bà Rịa - Vũng Tàu, 493 dòng đối chiếu, lấy từ Nghị quyết 1685/NQ-UBTVQH15 và danh mục của Cục Thống kê (mã theo Quyết định 19/2025/QĐ-TTg).
- Thêm màn hình "4.1.11. Cập nhật địa danh hành chính": lưới địa chỉ học sinh còn theo địa danh cũ ở năm loại địa chỉ, đề xuất địa danh mới, chọn xã mới khi xã cũ chia cho nhiều xã, chuyển hàng loạt có nhật ký trước và sau; bảng đối chiếu, nhập bảng đối chiếu từ Excel.
- Thêm kịch bản CT-421 đến CT-430, tiêu chí AC-465 đến AC-474, quy tắc BR-115, quy tắc phân quyền PQ-67, chức năng P02-17, màn hình MH-94. Kết quả ngày 15/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 725/727 ca đạt, hai ca CTC-DD-041, PQ-10 chỉ hỏng trên máy phát triển do cơ sở dữ liệu phát triển cho VT-01 mọi quyền, không liên quan phần này; tệp mới `administrative-units.test.ts` 8/8 ca đạt; toàn bộ kiểm thử giao diện 96/96 ca đạt (lần chạy trước 95/96, ca hỏng ở `50-facilities-emis.spec.ts` chờ thông báo "Đã lưu phòng", không liên quan, chạy lại đạt); tệp mới `56-administrative-units.spec.ts` 2/2 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện đợt 15h phần 15h1 của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5 (15h2 văn thư lưu trữ làm song song). Danh mục chỉ lấy từ văn bản và danh mục chính thức, phần chưa kiểm chứng (tỉnh khác) để người dùng nhập từ Excel; so khớp tên giữ dấu vì có tên chỉ khác dấu; dùng lại quyền lập, duyệt hồ sơ học sinh và quyền quản lý danh mục, không thêm quyền. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-116, `07_QUY_TAC_NGHIEP_VU.md` BR-115, `08_VAI_TRO_NGUOI_DUNG.md` PQ-67, `10_YEU_CAU_CHUC_NANG.md` P02-17, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-94, `16_CO_SO_DU_LIEU.md` mục P01, `17_DAC_TA_API.md` giao kèo địa danh hành chính, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.66.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 6.

#### Vấn đề tồn đọng

- Chỉ gieo sẵn Thành phố Hồ Chí Minh; chưa đọc trực tiếp phụ lục Quyết định 19/2025/QĐ-TTg; chưa có nhập danh sách học sinh kèm địa chỉ mới từ Excel, xuất Excel lưới địa chỉ, sửa từng dòng đối chiếu; nhập lại tệp CSDL ngành ghi đè địa chỉ đã chuyển.

### 2026-10-15 — DT-15 phần 15d: nhân sự theo hệ thống của Sở

#### Công việc đã thực hiện

- Đổi màn hình hồ sơ nhân sự thành "3.1.1. Hồ sơ cán bộ, giáo viên": lưới dữ liệu chung phân trang ở máy chủ với cột của Sở, xếp A–Z theo tên, Mở rộng tìm kiếm gộp mục 3.1.4 (đơn vị, phòng ban, trạng thái, giới tính, vị trí việc làm, Đảng viên, tuổi từ–đến, mã định danh Bộ, số định danh), Xuất Excel theo cột đang hiện; hồ sơ hai thẻ "Hồ sơ cán bộ, giáo viên" (bảy khối theo thứ tự cột của tệp CSDL ngành, nút Ghi) và "Thông tin riêng của trường"; biểu mẫu Thêm mới theo khối. Ba điểm cuối mới `GET /staff/search`, `POST /staff/export`, `PATCH /staff/{id}/profile`; không có tệp thay đổi cấu trúc dữ liệu, không có quyền mới.
- Thêm kịch bản CT-409 đến CT-420, tiêu chí AC-453 đến AC-464, quy tắc BR-114, quy tắc phân quyền PQ-66; không có màn hình mới (MH-12 đổi). Kết quả ngày 15/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 659/659 ca đạt; toàn bộ kiểm thử giao diện 94/94 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện đợt 15d của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5. Cột của Sở chưa có cột riêng lấy từ `staff.moet_profile` và biểu mẫu ghi lại đúng khóa của tệp CSDL ngành, không thêm cột; thêm cột Mã nhân sự của trường; gộp 3.1.4 vào Mở rộng tìm kiếm của 3.1.1; hợp đồng, lương ở thẻ riêng và chỉ người xem được hợp đồng thấy (BR-46); `GET /staff` giữ nguyên cho các màn hình khác; không làm cập nhật hàng loạt; không thêm quyền mới, Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-112.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-112, `07_QUY_TAC_NGHIEP_VU.md` BR-114, `08_VAI_TRO_NGUOI_DUNG.md` PQ-66, `10_YEU_CAU_CHUC_NANG.md` P07-01, P07-04, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-12, BC-16, `16_CO_SO_DU_LIEU.md` mục `staff`, `17_DAC_TA_API.md` giao kèo hồ sơ nhân sự, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.65.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 6.

#### Vấn đề tồn đọng

- Chưa có Đồng bộ hồ sơ lên CSDL Bộ, Xuất file lỗi, Xóa hồ sơ, Xuất PDF; chưa có bộ lọc xã ĐBKK; chưa tách 3.1.2, 3.1.3, 3.1.5, 3.5; ô theo Sở là chữ tự do, chưa có danh mục của Bộ; nhập lại tệp CSDL ngành ghi đè các ô đã sửa ở biểu mẫu.
### 2026-10-15 — Phân tích kỹ thuật hệ thống của Sở bằng REA

#### Công việc đã thực hiện

- Theo yêu cầu của Eric, Claude dùng REA tải các trang công khai của `truong.hcm.edu.vn` (đăng nhập, quên mật khẩu, đăng nhập năm cũ), không đăng nhập, không thao tác ghi; ghi kết quả vào mục 9 của `31_KHAO_SAT_HE_THONG_SO.md`: nền tảng ASP.NET Web Forms trên IIS 10, Telerik UI for ASP.NET AJAX 2025.1, tường lửa Imperva Incapsula, cách chọn đơn vị nối tầng, mã phường/xã 5 chữ số, bài học áp dụng.
- Eric tự đăng nhập trên Chrome mở cổng gỡ lỗi cục bộ; REA quan sát thụ động trang chủ phân hệ Mầm non: bảng 72 màn hình theo số mục, mã menu, đường dẫn; các phương thức trang gọi bằng JSON (ký số, xem tệp, kiểm tra dữ liệu chưa hợp lệ, xác thực tài khoản); cách đổi nhãn sau sáp nhập bằng thay chữ trên trình duyệt.
- REA quan sát thụ động màn hình 2.1 Hồ sơ lớp học do Eric tự mở: RadGrid 24 cột (10 cột ẩn mặc định), tên trường dữ liệu, phân trang 50 dòng, ô lọc Phân hiệu, Khối, Nhóm tuổi, xuất tệp bằng postback; không ghi dữ liệu trên lưới.

#### Quyết định

- Không ghi tên, mã từng trường vào tài liệu vì kho mã công khai; chỉ ghi số lượng và định dạng mã.

#### Thay đổi

- `31_KHAO_SAT_HE_THONG_SO.md` phiên bản 1.1, thêm mục 9 (9.1 đến 9.10); `index.md` cập nhật mô tả tài liệu 31.

#### Vấn đề tồn đọng

- Chưa quan sát màn hình nhập Excel, tác vụ nền và "Tệp đã tạo"; cột ẩn mặc định và 50 dòng mỗi trang của 2.1 chưa áp dụng vào School Management.

### 2026-10-15 — DT-15 phần 15b: trường học, lớp học theo hệ thống của Sở

#### Công việc đã thực hiện

- Thêm mục "1.2. Quản lý phân hiệu", "1.3. Quản lý điểm trường" (lưới theo cột của Sở, khoảng cách đến cơ sở chính, diện tích, Ngừng sử dụng, Dùng lại); chuyển "2.1. Hồ sơ lớp học" sang lưới dữ liệu chung và biểu mẫu theo khối với nhóm tuổi, nhóm lớp, thứ tự, học 2 buổi/ngày, lớp mẫu giáo ghép 2 hoặc 3 độ tuổi, lớp ghép, lớp bán trú, Mở rộng tìm kiếm, Xuất Excel, "Giải thể lớp"; tách "2.2. Nhập lớp học từ Excel" khỏi màn hình Nhập dữ liệu; thêm "3.3. Phân công phụ trách lớp" lấy từ phân công giáo viên của lớp; tiêu đề 1.1, 1.4 kèm số menu. Cột mới ở cơ sở dữ liệu năm học (tệp 0051), không có quyền mới.
- Thêm kịch bản CT-398 đến CT-408, tiêu chí AC-442 đến AC-452, quy tắc BR-111 đến BR-113, quy tắc phân quyền PQ-65, màn hình MH-90 đến MH-93. Kết quả ngày 15/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 650/650 ca đạt; toàn bộ kiểm thử giao diện 91/91 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.

#### Quyết định

- Thực hiện đợt 15b của `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5. Phân hiệu, điểm trường là hai danh sách của cây đơn vị (Trường chính vẫn tạo ở Cây đơn vị), Ngừng sử dụng thay Xóa; lớp giải thể là lớp đã đóng; nhóm tuổi bỏ trống là theo bậc học; quy tắc ghép độ tuổi, lớp ghép; phân công phụ trách lớp lấy từ phân công giáo viên của lớp, không thêm bảng; nhập lớp học tách màn hình riêng giữ mẫu cũ; không thêm quyền mới, Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-111.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-111, `07_QUY_TAC_NGHIEP_VU.md` BR-111 đến BR-113, `08_VAI_TRO_NGUOI_DUNG.md` PQ-65, `10_YEU_CAU_CHUC_NANG.md` P01-01, P01-13, P02-05, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-03, MH-32, MH-40, MH-90 đến MH-93, BC-16, `16_CO_SO_DU_LIEU.md` mục 2, 3, `17_DAC_TA_API.md` mục 5, giao kèo lớp học theo Sở, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.64.0, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 5.

#### Vấn đề tồn đọng

- 1.4 Cấu hình trường chưa có ba ô của Sở; 1.2, 1.3 chưa có Xuất Excel, chưa có Xóa; 2.1 chưa có thao tác hàng loạt, Xuất PDF, nhóm tuổi của lớp chưa dùng cho thống kê; mẫu nhập lớp học chưa có các ô mới; 3.3 chưa hiện giáo viên chưa được phân công.

### 2026-10-15 — DT-15 phần 15g: gửi phản hồi, hết hạn mật khẩu

#### Công việc đã thực hiện

- Thêm nút "Gửi phản hồi" ở chân mọi trang của cổng quản trị (hộp thoại theo biểu mẫu của Sở, kèm ảnh chụp màn hình, tối đa 10 ý kiến mỗi giờ mỗi tài khoản); mục "Danh sách ý kiến đã gửi" ở menu người dùng; mục "3.4. Ý kiến phản hồi" của Quản trị hệ thống để VT-01, VT-02 đổi trạng thái, trả lời, người gửi nhận thông báo trong ứng dụng; bảng `feedback` ở cơ sở dữ liệu hệ thống (tệp 0007), quyền mới `P01.feedback.manage`.
- Thêm hết hạn mật khẩu cho tài khoản nhân sự ở dịch vụ định danh: cột `users.password_changed_at`, chính sách số ngày hết hạn và số ngày báo trước (tệp 0042, mặc định tắt), sửa ở khối "Chính sách mật khẩu" của "1.4. Danh sách người dùng"; mật khẩu quá hạn thì bắt buộc đổi ở màn hình Đổi mật khẩu, sắp hết hạn thì đầu trang báo số ngày còn lại; cột ẩn "Thời gian đổi mật khẩu".
- Thêm kịch bản CT-382 đến CT-397, tiêu chí AC-426 đến AC-441, chức năng P01-16, P01-17, quy tắc BR-108 đến BR-110, quy tắc phân quyền PQ-64, màn hình MH-87 đến MH-89, biện pháp BM-72, XT-10. Kiểm thử đơn vị máy chủ API 642/643 ca đạt, dịch vụ định danh 45/46 ca đạt (hai ca CTC-DD-041, PQ-10 đã biết chỉ hỏng trên máy phát triển do cơ sở dữ liệu phát triển cho VT-01 mọi quyền, không liên quan phần này; ca PQ-10 đã sửa vì VT-01 nay có thêm `P01.feedback.manage`); toàn bộ kiểm thử giao diện 87/87 ca đạt ngày 15/10/2026.

#### Quyết định

- Thực hiện lựa chọn 4 của Eric ngày 13/10/2026 (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 2, 4, 5 đợt 15g): biểu mẫu Gửi phản hồi ở chân trang; hết hạn mật khẩu và bắt buộc đổi định kỳ. Các ô của biểu mẫu (thêm ảnh đính kèm, số điện thoại, thư điện tử), người xử lý ý kiến là VT-01, VT-02, giới hạn 10 ý kiến mỗi giờ, chỉ áp hết hạn mật khẩu cho tài khoản nhân sự, đặt chính sách ở Danh sách người dùng theo quyền `P01.account.manage` (không ở màn hình Cấu hình vì VT-01 không có `P01.setting.manage`), mặc định tắt Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-110.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-110, `07_QUY_TAC_NGHIEP_VU.md` BR-108 đến BR-110, `08_VAI_TRO_NGUOI_DUNG.md` PQ-10, PQ-64, `10_YEU_CAU_CHUC_NANG.md` P01-16, P01-17, `12_KIEN_TRUC_HE_THONG.md` XT-10, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-30, MH-48, MH-83, MH-84, MH-87 đến MH-89, `16_CO_SO_DU_LIEU.md` mục 1, 2 và 20, `17_DAC_TA_API.md` mục 4, 5, `22_BAO_MAT.md` BM-72, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.63.0.

#### Vấn đề tồn đọng

- Thông báo trả lời ý kiến cần năm học đang dùng; chưa gửi thư điện tử, tin nhắn; ý kiến chưa gửi về đơn vị hỗ trợ bên ngoài; đổi trạng thái, trả lời chưa ghi nhật ký thao tác; hai màn hình ý kiến phân trang ở trình duyệt.
- Ứng dụng giáo viên chưa hiện dòng "Mật khẩu đã hết hạn" và chưa báo sắp hết hạn; chưa chặn dùng lại mật khẩu cũ hơn mật khẩu hiện tại; chưa có bộ lọc Ngày hết hạn mật khẩu ở Danh sách người dùng; báo sắp hết hạn chưa là hộp thông báo bật lên như của Sở.

### 2026-10-15 — DT-15 phần 15e: quản trị hệ thống theo hệ thống của Sở

#### Công việc đã thực hiện

- Đưa phân hệ Quản trị hệ thống của cổng quản trị theo Sở: "1.1. Nhóm người dùng" trên lưới dữ liệu chung, biểu mẫu thêm nhóm theo khối; mục mới "1.3. Phân quyền nhóm theo menu" chọn quyền theo cây menu đánh số; "1.4. Danh sách người dùng" với cột, bộ lọc theo Sở; Khóa API cho đối tác và Nhật ký thao tác trên lưới dữ liệu chung; tiêu đề các màn hình quản trị kèm số menu; điều kiện hiện mục menu chuyển sang gói dùng chung `packages/shared/src/menu-permissions.ts`; dịch vụ định danh lọc, đếm, phân trang danh sách người dùng trong câu truy vấn, tệp chuyển đổi 0041 thêm hai chỉ mục của cơ sở dữ liệu định danh.
- Thêm kịch bản CT-368 đến CT-381, tiêu chí AC-412 đến AC-425, màn hình MH-86. Kiểm thử đơn vị máy chủ API 631/632 ca đạt, dịch vụ định danh 40/41 ca đạt (hai ca CTC-DD-041, PQ-10 đã biết chỉ hỏng trên máy phát triển do cơ sở dữ liệu phát triển cho VT-01 mọi quyền, không liên quan phần này); toàn bộ kiểm thử giao diện 84/84 ca đạt ngày 15/10/2026.

#### Quyết định

- Thực hiện lựa chọn 3 của Eric ngày 13/10/2026 (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 2, 3.2, 5 đợt 15e): giữ mã quyền theo thao tác, màn hình phân quyền hiển thị theo cây menu. Cách suy ra quyền của mục và quyền ở cổng (quyền ở cổng không tính là quyền của mục), cột Hiệu lực, Là nhóm quản trị, cột và bộ lọc của danh sách người dùng, việc chỉ đổi tiêu đề ở các màn hình quản trị không phải danh sách thuần Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-109.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-109, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-30, MH-31, MH-42, MH-86, `08_VAI_TRO_NGUOI_DUNG.md` PQ-13, `16_CO_SO_DU_LIEU.md` mục 2 và 20, `17_DAC_TA_API.md` mục 3, 5, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.62.0.

#### Vấn đề tồn đọng

- Chưa có cột Mã nhân sự, Mã Bộ, Thời gian đổi mật khẩu, Ngày hết hạn mật khẩu và bộ lọc Mã định danh, Ngày hết hạn mật khẩu của Sở (hết hạn mật khẩu làm ở phần 15g); chưa có Phân nhóm quyền hàng loạt, Cấp mật khẩu hàng loạt, Lấy danh sách CBQL/GV, Xuất Excel ở 1.4.
- Chưa có 1.2 Phân quyền nhóm theo phần mềm của Sở; chưa sửa, xóa, ngừng dùng nhóm người dùng (không có điểm cuối).
- Năm học, Cây đơn vị, Phòng ban và chức danh, Danh mục dùng chung, Phòng học và bậc học, Hạn mức phê duyệt, Kết nối ngoài chỉ đổi tiêu đề, chưa chuyển sang lưới dữ liệu chung; tìm theo từ khóa ở danh sách người dùng cần chỉ mục trigram khi nhiều hơn khoảng 30 nghìn tài khoản.

### 2026-10-15 — DT-15 phần 15c: học sinh theo hệ thống của Sở

#### Công việc đã thực hiện

- Đưa nhóm "4. Học sinh" của cổng quản trị theo Sở: màn hình "4.1.1. Quản lý hồ sơ học sinh" dùng lưới dữ liệu chung (cột, bộ lọc theo Sở, thứ tự A–Z theo tên, Xuất Excel theo cột đang hiện, cập nhật hàng loạt học 2 buổi/ngày và bán trú); hồ sơ học sinh hai thẻ theo khối của Sở và "Thông tin riêng của trường"; điện thoại nhận tin và chọn người nhận tin nhắn theo học sinh; mục mới "4.2. Biến động học sinh"; đổi chữ "trẻ" thành "học sinh" trên các màn hình học sinh; khối biểu mẫu dùng chung `FormBlock`, `FormRow`; tệp chuyển đổi 0050 của cơ sở dữ liệu năm học.
- Thêm kịch bản CT-354 đến CT-367, tiêu chí AC-398 đến AC-411, chức năng P02-15, P02-16, quy tắc BR-105 đến BR-107, màn hình MH-85. Kiểm thử đơn vị máy chủ API 622/623 ca đạt, dịch vụ định danh 40/41 ca đạt (hai ca CTC-DD-041, PQ-10 đã biết chỉ hỏng trên máy phát triển do cơ sở dữ liệu phát triển cho VT-01 mọi quyền, không liên quan phần này); toàn bộ kiểm thử giao diện 78/80 ca đạt, hai ca CT-365, CT-366 của `tests/e2e/51-students-so.spec.ts` hỏng do bộ chọn ô đánh dấu trong hộp cấu hình cột khớp nhiều phần tử, đã sửa và chạy lại tệp 3/3 ca đạt ngày 15/10/2026.

#### Quyết định

- Eric chọn ngày 13/10/2026 đồng bộ nhóm học sinh theo Sở và dùng chữ "học sinh" thay "trẻ" trên cổng quản trị (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 1, 5 đợt 15c); cột, bộ lọc, thứ tự A–Z, cách lưu điện thoại nhận tin, cập nhật hàng loạt và biến động học sinh dựng từ lịch sử đã có Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-108.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-108, `14_DAC_TA_GIAO_DIEN.md` mục 1.1, MH-02, MH-85 và BC-16, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.61.0.

#### Vấn đề tồn đọng

- Chưa có chuyển đến, chuyển đi giữa các trường ở mục 4.2 của Sở; chưa ghi số thứ tự cố định trong lớp; điện thoại nhận tin chưa nhập từ Excel; dân tộc, diện chính sách, khuyết tật, biết bơi chưa sửa được trên hồ sơ; chưa có Xuất PDF, Xuất file lỗi, Cấp mã định danh Bộ; thông báo lỗi của máy chủ API vẫn dùng chữ "trẻ".

### 2026-10-14 — DT-15 phần 15a: menu ngang đánh số, menu người dùng, lưới dữ liệu dùng chung

#### Công việc đã thực hiện

- Thay thanh điều hướng bên trái của cổng quản trị bằng menu ngang nhiều cấp đánh số theo phân hệ (mười một phân hệ, 66 trang), dùng được bằng chuột và bàn phím, cây menu gập trên màn hình hẹp; menu người dùng ở thanh đầu trang; lưới dữ liệu dùng chung, hộp cấu hình cột, hộp xác nhận xóa; cấu hình lưới lưu theo tài khoản ở cơ sở dữ liệu hệ thống; thí điểm lưới ở Tài khoản và Hồ sơ nhân sự; kiểm thử giao diện mở trang qua trợ giúp `tests/e2e/menu.ts`.
- Thêm kịch bản CT-340 đến CT-353. Kiểm thử đơn vị toàn bộ 667 ca, 665 đạt (hai ca PQ-10, CTC-DD-041 đã biết chỉ hỏng trên máy phát triển do cơ sở dữ liệu định danh dùng chung, không liên quan phần này); kiểm thử giao diện 77/77 đạt ngày 14/10/2026.

#### Quyết định

- Eric chọn menu ngang đánh số thay thanh điều hướng bên trái ngày 13/10/2026 (`32_KE_HOACH_THEO_HE_THONG_SO.md` mục 2, lựa chọn 1); cây menu, menu người dùng, lưới dữ liệu và bỏ lựa chọn "Tất cả chức năng" Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-107.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-107, `14_DAC_TA_GIAO_DIEN.md` mục 1.1 và BC-10 đến BC-15, `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.60.0.

#### Vấn đề tồn đọng

- Menu người dùng chưa có Hồ sơ cá nhân, Danh sách ý kiến đã gửi, Hướng dẫn; các màn hình khác chuyển sang lưới ở phần 15f; nút Xuất Excel, Xuất PDF và thao tác hàng loạt của lưới chưa làm; danh sách tài khoản ở dịch vụ định danh vẫn đọc hết rồi cắt trang.

### 2026-10-14 — DT-14 phần 14d: hồ sơ trường, khai báo cơ sở vật chất, thiết bị dạy học, biểu EMIS đầu năm

#### Công việc đã thực hiện

- Hồ sơ trường sáu thẻ gắn với Trường chính; khai báo cơ sở vật chất trên danh mục phòng học (khối, loại, hiện trạng, diện tích, thuộc tính) kèm bảng tổng hợp; danh mục thiết bị dạy học tối thiểu gieo sẵn và thiết bị ngoài danh mục, số lượng hiện có theo đơn vị, lớp, tổng hợp theo định mức; báo cáo EMIS đầu năm Biểu 1 năm thẻ; xuất Excel kèm nhật ký xuất; chuyển hồ sơ, danh mục thiết bị, số hiện có khi mở năm học mới.
- Thêm kịch bản CT-330 đến CT-339.

#### Quyết định

- Eric chọn bổ sung bốn nhóm chức năng theo hệ thống của Sở ngày 13/10/2026 (YCTD-102); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-106.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-106 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.59.0.

#### Vấn đề tồn đọng

- Danh mục thiết bị tối thiểu gieo sẵn và mã số chỉ tiêu EMIS cần đối chiếu văn bản; chưa gửi báo cáo EMIS lên Sở; chưa có thẻ Ngân sách nhà nước, biểu cuối năm; gắn tài sản với thiết bị chưa có trên màn hình Kho và tài sản.

### 2026-10-14 — DT-14 phần 14a: cân nặng, chiều cao theo chuẩn WHO, thống kê theo tiêu chí ngành, hồ sơ chưa nhập đủ

#### Công việc đã thực hiện

- Đợt cân đo, nhập cân nặng, chiều cao theo lớp và từ Excel, chỉ số Z và kênh tăng trưởng theo chuẩn WHO, biểu đồ tăng trưởng, tổng hợp cân nặng, chiều cao kèm xuất Excel; thống kê lớp học, học sinh, nhân sự theo tiêu chí ngành; hồ sơ học sinh, nhân sự chưa nhập đủ.
- Thêm kịch bản CT-320 đến CT-329.

#### Quyết định

- Eric chọn bổ sung bốn nhóm chức năng theo hệ thống của Sở ngày 13/10/2026 (YCTD-102); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-105.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-105 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.58.0.

#### Vấn đề tồn đọng

- Dân tộc, khuyết tật, trình độ và các trường tương tự chưa có cột riêng, đọc từ hồ sơ CSDL ngành đã nhập; chưa có thông báo phụ huynh khi có kết quả cân đo, chưa tổng hợp theo học kỳ.

### 2026-10-13 — DT-14 phần 14c: hoàn thành chương trình mầm non, chuẩn nghề nghiệp, nhóm học sinh

#### Công việc đã thực hiện

- Hoàn thành chương trình mầm non theo lớp 5-6 tuổi, nhóm học sinh, đánh giá chuẩn nghề nghiệp giáo viên và hiệu trưởng.
- Thêm kịch bản CT-310 đến CT-319.

#### Quyết định

- Eric chọn bổ sung bốn nhóm chức năng theo hệ thống của Sở ngày 13/10/2026 (YCTD-102); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-104.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-104 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.57.0.

#### Vấn đề tồn đọng

- Đối chiếu tên tiêu chí và quy tắc xếp loại với Thông tư 25, 26/2018/TT-BGDĐT; chưa có nhập mức đánh giá từ Excel.

### 2026-10-13 — DT-14 phần 14b: năm học ở thanh đầu trang và Truy cập nhanh trên trang chủ

#### Công việc đã thực hiện

- Ô năm học và học kỳ ở thanh đầu trang; vùng Truy cập nhanh trên trang chủ, lưu lối tắt theo tài khoản.
- Thêm kịch bản CT-300 đến CT-309.

#### Quyết định

- Eric chọn bổ sung bốn nhóm chức năng theo hệ thống của Sở ngày 13/10/2026; các điểm kỹ thuật Claude tự chọn ghi ở YCTD-102.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-102 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.56.0.

#### Vấn đề tồn đọng

- Xem năm học đã đóng cần máy chủ API đọc được cơ sở dữ liệu năm học cũ ở chế độ chỉ xem.
### 2026-10-13 — Khảo sát hệ thống thông tin quản lý giáo dục của Sở

#### Công việc đã thực hiện

- Eric đăng nhập hệ thống của Sở GD&ĐT TP.HCM; Claude đọc giao diện 6 phân hệ, 98 màn hình, không thay đổi dữ liệu, không ghi dữ liệu cá nhân; viết `31_KHAO_SAT_HE_THONG_SO.md`.

#### Quyết định

- Eric chọn bổ sung bốn nhóm chức năng (đợt DT-14, YCTD-102); các đề xuất còn lại ở mục 8.3 của tài liệu khảo sát chờ Eric chọn.

#### Thay đổi

- Thêm `31_KHAO_SAT_HE_THONG_SO.md`.

#### Vấn đề tồn đọng

- Chưa xem được phân hệ Tuyển sinh đầu cấp (chỉ mở ở học kỳ II năm 2025-2026) và nội dung chỉ tiêu các biểu EMIS.

### 2026-10-13 — DT-13 phần 13c: báo cáo điểm danh và suất ăn theo ngày, tuần, tháng

#### Công việc đã thực hiện

- Báo cáo điểm danh và suất ăn theo ngày, tuần, tháng trên màn hình và Excel theo mẫu của trường; suất ăn theo lớp cho bếp.
- Thêm kịch bản CT-289 đến CT-299.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-103.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-103 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.55.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — DT-13 phần 13a: nhập thẳng tệp học sinh, cán bộ theo mẫu CSDL ngành

#### Công việc đã thực hiện

- Nhập thẳng tệp học sinh, cán bộ theo mẫu CSDL ngành (.xls, .xlsx), lưu đủ 82 và 75 cột; chạy thử với tệp mẫu thật của trường trên cơ sở dữ liệu tạm.
- Thêm kịch bản CT-275 đến CT-288.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-100.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-100 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.54.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — Menu sổ xuống chọn phân hệ

#### Công việc đã thực hiện

- Thêm menu sổ xuống chọn phân hệ ở thanh đầu trang theo ảnh mẫu của Eric; kiểm thử giao diện 65/65 đạt.

#### Quyết định

- Eric yêu cầu ngày 2026-10-13; cách gom phân hệ Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 (YCTD-101).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-101.

#### Vấn đề tồn đọng

- Không có.

### 2026-10-13 — Giao diện tông xanh, ẩn hiện thanh điều hướng

#### Công việc đã thực hiện

- Đổi bảng màu sang tông xanh theo ảnh mẫu của Eric; thanh đầu trang xanh có nút ẩn hoặc hiện thanh điều hướng; nhóm chức năng thu gọn được, trình duyệt nhớ lựa chọn.
- Kiểm thử giao diện 64/64 đạt.

#### Quyết định

- Eric yêu cầu ngày 2026-10-13; cách trình bày Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 (YCTD-99).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-99, `15_HE_THONG_THIET_KE.md` mục 2 và KC-08.

#### Vấn đề tồn đọng

- Không có.

### 2026-10-13 — Ma trận quyền chọn nhanh, chuông thông báo, dữ liệu mẫu

#### Công việc đã thực hiện

- Ma trận quyền chọn nhanh theo nhóm, tên nhóm gồm mã và tên phân hệ; sửa lỗi báo nhầm mất kết nối ở Cây đơn vị (YCTD-96, yêu cầu gộp số 67).
- Chuông thông báo ở đầu trang cổng quản trị (YCTD-97).
- Chẩn đoán "chức năng chưa hoạt động" trên máy của Eric: cơ sở dữ liệu phát triển chưa có năm học đang dùng và tài khoản VT-01 chỉ có quyền quản lý tài khoản (PQ-10); dựng dữ liệu mẫu `pnpm demo:seed`.

#### Quyết định

- Eric yêu cầu hai thay đổi giao diện; cách trình bày Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-96, YCTD-97.

#### Vấn đề tồn đọng

- Cấp toàn quyền cho VT-01 trong mã nguồn chưa làm: Eric tự cấp trên ma trận quyền ở máy phát triển.
### 2026-10-13 — DT-12 phần 12d: cấu hình triển khai môi trường chạy thật

#### Công việc đã thực hiện

- Viết cấu hình triển khai Docker Compose, ảnh, Caddy, sao lưu và khôi phục, hướng dẫn triển khai; dựng thử, sao lưu và khôi phục thử trên máy cục bộ.
- Thêm kịch bản CT-269 đến CT-274.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-98.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-98 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.53.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — DT-12 phần 12c: Fanpage và Zalo Official Account chạy thật

#### Công việc đã thực hiện

- Nâng kết nối Fanpage lên Graph API v21.0, thêm kho khóa và làm mới khóa Zalo tự động, nút kiểm tra kết nối trên MH-71.
- Thêm kịch bản CT-261 đến CT-268.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-95.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-95 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.52.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — DT-12 phần 12b: cổng thanh toán PayOS, SePay, Casso, VNPay

#### Công việc đã thực hiện

- Viết bốn cổng thanh toán PayOS, SePay, Casso, VNPay và điểm cuối nhận thông báo; nút thanh toán VNPay trên ứng dụng phụ huynh.
- Thêm kịch bản CT-250 đến CT-260.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-94.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-94 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.51.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — DT-12 phần 12a: nối nhà cung cấp tin nhắn eSMS.vn

#### Công việc đã thực hiện

- Viết `EsmsClient` và lớp gửi eSMS.vn cho dịch vụ định danh, máy chủ API; đọc cấu hình từ biến môi trường.
- Thêm kịch bản CT-236 đến CT-249.

#### Quyết định

- Eric chọn nhà cung cấp ngày 13/10/2026 (YCTD-92); các điểm kỹ thuật Claude tự chọn ghi ở YCTD-93.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-93 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.50.0.

#### Vấn đề tồn đọng

- Kiểm với tài khoản thật khi Eric cấp khóa lúc triển khai (việc T6).

### 2026-10-13 — Nghiệm thu ba bản phát hành, chọn nhà cung cấp, lập đợt DT-12

#### Công việc đã thực hiện

- Gắn thẻ `v1.0.0`, `v1.1.0`, `v1.2.0` và tạo bản phát hành trên GitHub.
- Cập nhật bảng tiến độ phân hệ trong `03_DANH_SACH_CONG_VIEC.md` (yêu cầu gộp số 64).
- Lập đợt DT-12 bốn phần 12a đến 12d.

#### Quyết định

- Eric nghiệm thu ba bản; G3-04 chưa làm; chọn eSMS.vn, PayOS, SePay, Casso, VNPay; nối Fanpage và Zalo thật; Claude chuẩn bị cấu hình triển khai (YCTD-92).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-92 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.49.0.

#### Vấn đề tồn đọng

- Eric thuê máy chủ đám mây, cấp khóa của nhà cung cấp; triển khai, kiểm thử hiệu năng và phục hồi, xác nhận sau triển khai (việc T6, cổng CG-11).

### 2026-10-11 — DT-11: báo cáo kiểm thử giai đoạn 3, bản ứng viên 1.2.0

#### Công việc đã thực hiện

- Gộp năm phần 11a đến 11e vào `main` (yêu cầu gộp số 58 đến 62), quyền và kế hoạch ở yêu cầu gộp số 56, 57.
- Viết `30_BAO_CAO_KIEM_THU_G3.md`.
- Kết quả: máy chủ API 518/518, kiểm thử giao diện 62/62; kịch bản CT 224/235 đạt, ca chi tiết CTC 443/453 đạt.

#### Quyết định

- Claude tự chọn các điểm của YCTD-91 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-91 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.48.0.

#### Vấn đề tồn đọng

- Eric nghiệm thu ba bản ứng viên 1.0.0, 1.1.0, 1.2.0; quyết định G3-04; việc T1, T4, T6, T7.

### 2026-10-11 — DT-11 phần 11c: sổ kế toán kép

#### Công việc đã thực hiện

- Agent 11c viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 11d (đã gồm 11a, 11b, 11e), thêm chức năng P06-12 và quy tắc BR-96, đánh số bảy kịch bản mới CT-229 đến CT-235 kèm AC-273 đến AC-279, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: bốn bảng (tệp 0042). Máy chủ API: hệ thống tài khoản, quy tắc ghi sổ theo loại chứng từ và khoản mục, ghi sổ tự động một lần cho mỗi chứng từ (phiếu thu, phiếu chi, phiếu đảo, hóa đơn, miễn giảm, điều chỉnh, bảng lương, quyết toán), bút toán thủ công cân, nhật ký chung, sổ cái, bảng cân đối số phát sinh, xuất Excel; bước chuyển năm học `ledger` kết chuyển số dư đầu kỳ.
- Cổng quản trị: trang Sổ kế toán.
- Kết quả: máy chủ API 518/518, kiểm thử giao diện 62/62.

#### Quyết định

- Claude tự chọn các điểm của YCTD-88 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-88 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.47.0.

#### Vấn đề tồn đọng

- Báo cáo kiểm thử giai đoạn 3 và bản ứng viên 1.2.0.

### 2026-10-11 — DT-11 phần 11d: nhập sao kê và đối soát

#### Công việc đã thực hiện

- Agent 11d viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 11a (đã gồm 11b, 11e), đánh số bảy kịch bản mới CT-222 đến CT-228 kèm AC-266 đến AC-272, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: tệp 0043. Máy chủ API: cấu hình cột sao kê theo tài khoản, nhập tệp xlsx và CSV bỏ dòng trùng, đối soát tự động theo mã chứng từ và khoảng ngày, đề xuất lập phiếu thu cho dòng có mã hóa đơn còn nợ (kế toán xác nhận), nhiều cổng thanh toán theo tài khoản (giả lập, VietQR tĩnh).
- Cổng quản trị: phần Nhập tệp sao kê ở trang Đối chiếu ngân hàng, chọn cổng thanh toán ở trang Quỹ và ngân hàng.
- Kết quả: máy chủ API 511/511, kiểm thử giao diện 61/61.

#### Quyết định

- Claude tự chọn các điểm của YCTD-89 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-89 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.46.0.

#### Vấn đề tồn đọng

- Gộp phần 11c; báo cáo kiểm thử giai đoạn 3 và bản ứng viên 1.2.0.

### 2026-10-11 — DT-11 phần 11a: tuyển sinh trực tuyến

#### Công việc đã thực hiện

- Agent 11a viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 11b (đã gồm 11e), đổi tên bộ giới hạn số lần gọi của tuyển sinh để không trùng tuyển dụng, đặt cả hai trang công khai trên màn hình đăng nhập phụ huynh, đánh số sáu kịch bản mới CT-216 đến CT-221 kèm AC-260 đến AC-265, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: ba bảng (tệp 0040). Máy chủ API: đợt tuyển sinh có chỉ tiêu, tin tuyển sinh, nộp và tra cứu hồ sơ TS-000001 không cần tài khoản có giới hạn số lần, tiếp nhận, xét đạt theo chỉ tiêu hoặc không đạt kèm lý do, chuyển hồ sơ đạt thành hồ sơ trẻ dùng lại quy trình hồ sơ trẻ (QT-01); bước chuyển năm học `admissions`.
- Cổng quản trị: trang Tuyển sinh. Ứng dụng phụ huynh: trang Tuyển sinh trực tuyến công khai.
- Kết quả: máy chủ API 504/504, kiểm thử giao diện 60/60.

#### Quyết định

- Claude tự chọn các điểm của YCTD-86 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-86 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.45.0.

#### Vấn đề tồn đọng

- Gộp các phần 11c, 11d; báo cáo kiểm thử giai đoạn 3 và bản ứng viên 1.2.0.

### 2026-10-11 — DT-11 phần 11b: tuyển dụng

#### Công việc đã thực hiện

- Agent 11b viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 11e, đánh số tám kịch bản mới CT-208 đến CT-215 kèm AC-252 đến AC-259, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: bốn bảng (tệp 0041). Máy chủ API: đề nghị tuyển dụng DNTD-000001 duyệt bởi Ban Giám hiệu, tin tuyển dụng công khai đến hết hạn, nộp hồ sơ không cần tài khoản có giới hạn số lần, hồ sơ ứng viên có ghi nhật ký truy cập dữ liệu cá nhân, phỏng vấn nhiều vòng, quyết định tuyển, tạo hồ sơ nhân sự; bước chuyển năm học `recruitment`.
- Cổng quản trị: trang Tuyển dụng. Ứng dụng phụ huynh: trang Tuyển dụng giáo viên và nhân viên công khai.
- Kết quả: máy chủ API 494/494, kiểm thử giao diện 59/59.

#### Quyết định

- Claude tự chọn các điểm của YCTD-87 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-87 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.44.0.

#### Vấn đề tồn đọng

- Gộp các phần 11a, 11c, 11d; báo cáo kiểm thử giai đoạn 3 và bản ứng viên 1.2.0.

### 2026-10-11 — DT-11 phần 11e: kết nối Facebook và Zalo

#### Công việc đã thực hiện

- Agent 11e viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp `main`, đánh số sáu kịch bản mới CT-202 đến CT-207 kèm AC-246 đến AC-251, sửa KT-09 tính chung tin Zalo, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: tệp 0044. Máy chủ API: cấu hình kết nối ngoài (khóa chỉ ở biến môi trường), đăng hoạt động và tin tức đã công bố lên Fanpage kèm loại ảnh theo đồng ý hình ảnh, thử lại khi lỗi; kênh Zalo cho thông báo và nhắc nợ, gửi tin nhắn thay khi chưa liên kết hoặc lỗi; bước chuyển năm học `integrations`.
- Cổng quản trị: trang Kết nối ngoài (MH-71), nút Đăng lên Fanpage ở trang Hoạt động và tin tức.
- Kết quả: máy chủ API 486/486, kiểm thử giao diện 58/58.

#### Quyết định

- Claude tự chọn các điểm của YCTD-90 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-90 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.43.0.

#### Vấn đề tồn đọng

- Gộp các phần 11a đến 11d; báo cáo kiểm thử giai đoạn 3 và bản ứng viên 1.2.0.

### 2026-10-11 — DT-10: báo cáo kiểm thử giai đoạn 2, bản ứng viên 1.1.0

#### Công việc đã thực hiện

- Gộp mười phần 10a đến 10j vào `main` (yêu cầu gộp số 43, 45, 46, 48 đến 54); từ phần 10b làm song song ba phần một lượt bằng các agent, người điều phối gộp nối tiếp và chạy toàn bộ kiểm thử trước mỗi yêu cầu gộp.
- Bổ sung ca kiểm thử cho CT-041, CT-083, CT-085; đánh dấu CTC-P06-049 đạt.
- Viết `29_BAO_CAO_KIEM_THU_G2.md`.
- Kết quả: máy chủ API 480/480, kiểm thử giao diện 57/57; kịch bản CT 187/201 đạt, ca chi tiết CTC 443/453 đạt.

#### Quyết định

- Claude tự chọn các điểm của YCTD-84 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-84 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.42.0.

#### Vấn đề tồn đọng

- Eric nghiệm thu bản ứng viên 1.0.0 (0.31.0) và 1.1.0 (0.42.0); việc T1, T6; đợt DT-11 giai đoạn 3.

### 2026-10-11 — DT-10 phần 10i: tài chính giai đoạn 2

#### Công việc đã thực hiện

- Agent 10i viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 3, dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 10h (đã gồm 10b đến 10j), nối công nợ phải trả với phiếu đi chợ của bếp (thêm ca kiểm thử), đánh số màn hình MH-61, MH-62 và quy tắc mới BR-95 (thay mã lỗi tạm P06-09), chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: năm bảng (tệp 0038). Máy chủ API: nhắc nợ theo mốc, đề xuất và quyết định xử lý công nợ quá hạn, dòng sao kê và đối chiếu ngân hàng, công nợ phải trả từ phiếu mua hàng, phiếu mua thuốc, phiếu đi chợ hoặc lập tay, chốt kỳ tài chính và khóa số liệu kỳ đã chốt trên phiếu thu, phiếu chi, phiếu đảo, tính học phí, miễn giảm, điều chỉnh.
- Cổng quản trị: trang Nhắc nợ và xử lý quá hạn, Đối chiếu ngân hàng, Nợ nhà cung cấp, Chốt kỳ tài chính.
- Kết quả: máy chủ API 480/480, kiểm thử giao diện 57/57.

#### Quyết định

- Claude tự chọn các điểm của YCTD-82 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-82 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.41.0.

#### Vấn đề tồn đọng

- Kiểm thử G2 và phát hành 1.1.0.

### 2026-10-11 — DT-10 phần 10h: công việc và đánh giá

#### Công việc đã thực hiện

- Agent 10h viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 3, dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp nhánh 10j (đã gồm 10b đến 10g), thêm bảng công việc được giao vào báo cáo hoạt động và công việc, đánh số màn hình MH-58 đến MH-60 và bảy kịch bản mới CT-195 đến CT-201 kèm AC-239 đến AC-245, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: mười bảng (tệp 0037). Máy chủ API: giao việc, việc cá nhân, tiến độ, kế hoạch kích hoạt thành việc, chỉ số và phiếu đánh giá, quá trình công tác và chứng chỉ, thưởng và khấu trừ đưa vào phiếu lương; bước chuyển năm học `work`.
- Cổng quản trị: trang Công việc và kế hoạch, Đánh giá nhân sự, Thưởng và khấu trừ, mục Quá trình công tác trong hồ sơ nhân sự. Ứng dụng giáo viên: Công việc của tôi.
- Kết quả: máy chủ API 474/474, kiểm thử giao diện 56/56.

#### Quyết định

- Claude tự chọn các điểm của YCTD-81 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-81 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.40.0.

#### Vấn đề tồn đọng

- Gộp phần 10i; kiểm thử G2 và phát hành 1.1.0.

### 2026-10-11 — DT-10 phần 10j: báo cáo giai đoạn 2

#### Công việc đã thực hiện

- Agent 10j viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 3); người điều phối gộp nhánh 10g (đã gồm 10b đến 10f), thêm bảng hoạt động của lớp vào báo cáo hoạt động và công việc qua giao diện nguồn số liệu, đánh số sáu kịch bản mới CT-189 đến CT-194 kèm AC-233 đến AC-238, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: bảng `export_logs` (tệp 0039). Máy chủ API: báo cáo hoạt động và công việc theo nguồn số liệu gắn thêm được, báo cáo hợp nhất theo đơn vị không có dữ liệu cá nhân, xuất Excel bảy báo cáo có nhật ký xuất.
- Cổng quản trị: trang Báo cáo thêm ba thẻ và nút xuất Excel.
- Kết quả: máy chủ API 466/466, kiểm thử giao diện 55/55.

#### Quyết định

- Claude tự chọn các điểm của YCTD-83 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-83 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.39.0.

#### Vấn đề tồn đọng

- Gộp phần 10h (thêm bảng công việc vào báo cáo hoạt động) và 10i; kiểm thử G2 và phát hành 1.1.0.

### 2026-10-11 — DT-10 phần 10g: giảng dạy

#### Công việc đã thực hiện

- Agent 10g viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 2); người điều phối gộp các nhánh 10b đến 10f, dựng lại các tệp giao diện dùng chung từ bản của 10f cộng phần thay đổi của 10g, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: mười bảng (tệp 0036). Máy chủ API: lĩnh vực, nhóm bài học, chủ đề, bài học dùng chung hoặc riêng, giáo án duyệt hai bước (tổ trưởng rồi quản lý đơn vị), thời khóa biểu theo phiên bản tuần, kế hoạch giảng dạy, tiến độ học tập theo kỳ, lịch hoạt động lớp, trang học tập của con; bước chuyển năm học `teaching`.
- Cổng quản trị: trang Bài học và giáo án (MH-57). Ứng dụng giáo viên: Giảng dạy lớp. Ứng dụng phụ huynh: Học tập.
- Sửa thêm: kiểm thử giao diện bếp chờ lưu món xong rồi mới trình duyệt; xóa cơ sở dữ liệu thử lại khi gặp tiến trình nền của PostgreSQL không kết thúc được (mã 42501), lỗi dọn dẹp thỉnh thoảng gặp khi chạy kiểm thử.
- Kết quả: máy chủ API 458/458, kiểm thử giao diện 54/54.

#### Quyết định

- Claude tự chọn các điểm của YCTD-80 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-80 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.38.0.

#### Vấn đề tồn đọng

- Lượt 3 (10h, 10i, 10j); kiểm thử G2 và phát hành 1.1.0.

### 2026-10-11 — DT-10 phần 10f: tương tác và đồ bị mất

#### Công việc đã thực hiện

- Agent 10f viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 2); người điều phối gộp các nhánh 10b, 10c, 10d, 10e, xử lý xung đột ở các tệp đăng ký dùng chung, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Bình luận: giữ hai bảng riêng, `content_comments` của 10e cho nội dung P14 (hoạt động, tin tức, thư viện, album) và `interaction_comments` của 10f cho đối tượng P15 (bình chọn); đổi tên kiểu và lớp của phần tương tác (`InteractionCommentTargetType`, `InteractionCommentsService`) để không trùng tên. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: gộp một bảng chung cần sửa lớn cả hai phần mà không thêm giá trị cho người dùng.
- Cơ sở dữ liệu: mười ba bảng (tệp 0035). Máy chủ API: luồng trao đổi theo trẻ và tài khoản phụ huynh, góp ý ẩn danh, bình chọn, biểu quyết, khảo sát và danh mục khảo sát, bình luận có bản ghi xử lý, lượt thích, phiếu đồ bị mất `DBM-000001`; bước chuyển năm học `interactions`.
- Cổng quản trị: trang Tương tác với phụ huynh. Ứng dụng giáo viên: trao đổi và đồ bị mất của lớp. Ứng dụng phụ huynh: trao đổi, góp ý, bình chọn, mất đồ.
- Kết quả: máy chủ API 452/452, kiểm thử giao diện 53/53.

#### Quyết định

- Claude tự chọn các điểm của YCTD-79 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-79 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.37.0.

#### Vấn đề tồn đọng

- Gộp phần 10g; lượt 3 (10h, 10i, 10j).

### 2026-10-11 — DT-10 phần 10e: hoạt động và nội dung

#### Công việc đã thực hiện

- Agent 10e viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng (lượt 2, dừng giữa chừng vì giới hạn phiên rồi làm tiếp); người điều phối gộp các nhánh 10b, 10c, 10d, xử lý xung đột ở các tệp đăng ký dùng chung và kiểu `FilePurpose`, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: tệp 0034. Máy chủ API: danh mục hoạt động, hoạt động trình duyệt và công bố, ảnh gắn thẻ trẻ theo đồng ý hình ảnh, tin tức, thư viện, album, hình tô màu, bình luận và thích, ngoại khóa có chỉ tiêu và phí đưa vào hóa đơn; bước chuyển năm học `activities`.
- Cổng quản trị: trang Hoạt động và tin tức. Ứng dụng giáo viên: hoạt động lớp. Ứng dụng phụ huynh: hoạt động và tin tức.
- Kết quả: máy chủ API 443/443, kiểm thử giao diện 52/52.

#### Quyết định

- Claude tự chọn các điểm của YCTD-78 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-78 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.36.0.

#### Vấn đề tồn đọng

- Gộp phần 10f, 10g; lượt 3 (10h, 10i, 10j) đang làm.

### 2026-10-11 — DT-10 phần 10c: bếp và thực đơn

#### Công việc đã thực hiện

- Agent 10c viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng; người điều phối gộp `main` cùng các nhánh 10b, 10d, xử lý xung đột ở các tệp đăng ký dùng chung, sửa kiểm thử giao diện chọn món, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: mười một bảng bếp (tệp 0032). Máy chủ API: nguyên liệu, món ăn, định lượng, thực đơn tuần trình duyệt và công bố, suất ăn theo ngày, báo cơm, buffet, nhà cung cấp thực phẩm, phiếu đi chợ chờ thanh toán, báo cáo ăn và bếp; bước chuyển năm học `kitchen`.
- Cổng quản trị: trang Bếp và thực đơn. Ứng dụng giáo viên: báo cơm của lớp. Ứng dụng phụ huynh: thực đơn.
- Kết quả: máy chủ API 431/431, kiểm thử giao diện 51/51.

#### Quyết định

- Claude tự chọn các điểm của YCTD-76 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-76 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.35.0.

#### Vấn đề tồn đọng

- Gộp lượt 2 (10e, 10f, 10g); các phần 10h đến 10j.

### 2026-10-11 — DT-10 phần 10b: thuốc

#### Công việc đã thực hiện

- Agent 10b viết mã, kiểm thử máy chủ, nháp tài liệu trong worktree riêng; người điều phối gộp `main` và nhánh 10d, xử lý xung đột ở các tệp đăng ký dùng chung, chạy toàn bộ kiểm thử, đưa nháp vào tài liệu.
- Cơ sở dữ liệu: tám bảng thuốc (tệp 0031). Máy chủ API: danh mục thuốc, nhà thuốc, yêu cầu dặn thuốc kèm ảnh, nhận thuốc, ghi liều và bỏ liều, xác nhận đã biết bỏ liều, đề nghị mua thuốc theo hạn mức, phiếu mua thuốc, phiếu cấp thuốc; bước chuyển năm học `medicines`.
- Cổng quản trị: trang Thuốc và dặn thuốc. Ứng dụng giáo viên: màn hình dặn thuốc của lớp. Ứng dụng phụ huynh: mục dặn thuốc.
- Kết quả: máy chủ API 424/424, kiểm thử giao diện 50/50.

#### Quyết định

- Claude tự chọn các điểm của YCTD-75 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-75 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.34.0.

#### Vấn đề tồn đọng

- Gộp phần 10c; các phần 10e đến 10j.

### 2026-10-11 — DT-10 phần 10d: kho, tài sản, mua hàng

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 43 (phần 10a). Lượt song song đầu của DT-10: ba agent làm 10b, 10c, 10d trong worktree riêng (YCTD-73); agent 10d viết mã, kiểm thử máy chủ và nháp tài liệu; người điều phối soát, gộp `main`, chạy toàn bộ kiểm thử và đưa nháp vào tài liệu.
- Cơ sở dữ liệu: mười ba bảng (tệp 0033). Máy chủ API: tài sản, cấp phát, mượn trả, hỏng mất, nhà cung cấp, mặt hàng, nhập xuất, tồn ban đầu, kiểm kê, đề nghị và phiếu mua hàng; bước chuyển năm học `inventory`. Cổng quản trị: trang Kho và tài sản, trang Đề nghị mua hàng.
- Kết quả: máy chủ API 416/416, kiểm thử giao diện 49/49.

#### Quyết định

- Claude tự chọn các điểm của YCTD-77 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-77 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.33.0.

#### Vấn đề tồn đọng

- Gộp phần 10b, 10c; các phần 10e đến 10j.

### 2026-10-11 — DT-10 phần 10a: y tế học đường

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 42 (phần 9g), gắn nhãn `v1.0.0-rc.1`; lập kế hoạch DT-10 (YCTD-73); viết phần 10a trên nhánh `dt-10-phan-10a`.
- Cơ sở dữ liệu: tám bảng y tế (tệp 0030 năm học); quyền P10 (tệp 0031 định danh).
- Máy chủ API: chỉ số, tiêu chuẩn, đợt khám, lịch khám, kết quả, sự kiện y tế, chăm sóc hằng ngày, tổng hợp sức khỏe, yêu cầu báo cáo; bước chuyển năm học `health`.
- Cổng quản trị: trang Y tế học đường. Ứng dụng giáo viên: màn hình chăm sóc và y tế của lớp. Ứng dụng phụ huynh: mục sức khỏe.
- Kết quả: máy chủ API 408/408, kiểm thử giao diện 48/48.

#### Quyết định

- Claude tự chọn các điểm của YCTD-73, YCTD-74 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-73, YCTD-74 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.32.0.

#### Vấn đề tồn đọng

- Phần 10b đến 10j của đợt DT-10.

### 2026-10-11 — DT-09 phần 9g: cổng CG-10 và bản ứng viên 1.0.0

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 41 (phần 9f); viết phần 9g trên nhánh `dt-09-phan-9g`.
- Thêm kiểm thử phạm vi báo cáo thu chi của kế toán (CTC-P06-050); ghi kết quả các ca đã có kiểm thử.
- Viết `28_BAO_CAO_KIEM_THU_CG_10.md`; cập nhật trạng thái công việc và giai đoạn.
- Kết quả: máy chủ API 401/401, kiểm thử giao diện 47/47.

#### Quyết định

- Claude đánh giá CG-10 đạt theo ủy quyền của Eric ngày 2026-10-11 (YCTD-72).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-72 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.31.0.

#### Vấn đề tồn đọng

- CG-11: Eric nghiệm thu bản ứng viên; việc T1 (nhà cung cấp tin nhắn, thanh toán) và T6 (môi trường đám mây, kiểm thử hiệu năng, phục hồi, triển khai).

### 2026-10-11 — DT-09 phần 9f: tiến trình gửi thông báo

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 40 (phần 9e); viết phần 9f trên nhánh `dt-09-phan-9f`.
- Cơ sở dữ liệu: `notification_recipients` thêm cột theo dõi lần gửi (tệp 0029).
- Máy chủ API: tiến trình gửi thông báo trong ứng dụng và tin nhắn, gửi lại khi lỗi, giới hạn 5 tin mỗi ngày, nhắc ghi nhật ký theo giờ cấu hình.
- Kết quả: máy chủ API 400/400, kiểm thử giao diện 47/47.

#### Quyết định

- Claude tự chọn các điểm của YCTD-71 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-71 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.9.

#### Vấn đề tồn đọng

- Phần 9g của đợt DT-09: báo cáo cổng CG-10 và phát hành 1.0.0.

### 2026-10-11 — DT-09 phần 9e: quy tắc theo cấu hình, báo cáo thu chi theo nhóm

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 39 (phần 9d); viết phần 9e trên nhánh `dt-09-phan-9e`.
- Máy chủ API: sĩ số tối đa theo cấu hình đơn vị; ghi nhật ký truy cập khi đơn vị bật; tra nhật ký truy cập; báo cáo thu chi theo nhóm và theo tháng.
- Cổng quản trị: hai bảng mới trong báo cáo thu chi.
- Kết quả: máy chủ API 395/395, kiểm thử giao diện 47/47.

#### Quyết định

- Claude tự chọn các điểm của YCTD-70 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-70 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.8.

#### Vấn đề tồn đọng

- Phần 9f, 9g của đợt DT-09.

### 2026-10-11 — DT-09 phần 9d: chuyển dữ liệu sang năm học mới

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 38 (phần 9c); viết phần 9d trên nhánh `dt-09-phan-9d`.
- Cơ sở dữ liệu: năm học có cột `receipts.carried_over` (tệp 0028).
- Máy chủ API: bước chuyển trẻ, phụ huynh, lớp, đăng ký dịch vụ; bước chuyển quỹ, công nợ, số dư có kèm kiểm tra BR-89, BR-94; mẫu thông báo chuyển cùng cấu hình.
- Kết quả: máy chủ API 390/390.

#### Quyết định

- Claude tự chọn các điểm của YCTD-69 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-69 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.7.

#### Vấn đề tồn đọng

- Phần 9e đến 9g của đợt DT-09.

### 2026-10-11 — DT-09 phần 9c: lịch nghỉ và lịch công tác

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 37 (phần 9b); viết phần 9c trên nhánh `dt-09-phan-9c`.
- Cơ sở dữ liệu: năm học có `work_schedules` (tệp 0027); định danh có quyền `P08.work-schedule.manage` (tệp 0030).
- Máy chủ API: lập, công bố, xóa lịch; lịch của tôi; bảng công tính ngày công tác đã công bố; mở năm học mới chuyển lịch sang.
- Cổng quản trị: màn hình Lịch công tác (MH-56). Ứng dụng giáo viên: mục lịch công tác ở thẻ chấm công.
- Kết quả: máy chủ API 384/384, kiểm thử giao diện 47/47.

#### Quyết định

- Claude tự chọn các điểm của YCTD-68 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-68 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.6.

#### Vấn đề tồn đọng

- Phần 9d đến 9g của đợt DT-09.

### 2026-10-11 — DT-09 phần 9b: chuyển đơn vị, thôi học, đồng ý hình ảnh

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 36 (phần 9a); viết phần 9b trên nhánh `dt-09-phan-9b`.
- Cơ sở dữ liệu: năm học có `child_unit_transfers` (tệp 0026).
- Máy chủ API: chuyển đơn vị kèm kiểm tra công nợ, thôi học, đồng ý hình ảnh của phụ huynh và giấy ký tay, cờ trẻ con nhân viên; tính học phí và bảng đăng ký dịch vụ gồm trẻ thôi học trong kỳ.
- Cổng quản trị: các mục mới trong chi tiết trẻ. Ứng dụng phụ huynh: mục hình ảnh.
- Kết quả: máy chủ API 380/380, kiểm thử giao diện 46/46.

#### Quyết định

- Claude tự chọn các điểm của YCTD-67 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-67 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.5.

#### Vấn đề tồn đọng

- Phần 9c đến 9g của đợt DT-09.

### 2026-10-11 — DT-09 phần 9a: kiểm thử bổ sung và ghi kết quả

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 35 (phần 8b). Rà soát 108 ca kiểm thử chi tiết và 175 kịch bản kiểm thử còn Chưa chạy; viết phần 9a trên nhánh `dt-09-phan-9a`.
- Viết thêm kiểm thử tự động cho phê duyệt theo hạn mức, phiếu thu nhiều hóa đơn, nhiều quỹ, sổ quỹ, phạm vi đơn vị, phiên đăng nhập, danh mục ngừng dùng, khóa API, tình huống tính học phí theo lịch, lương, quyết toán, lưu trữ dữ liệu nhạy cảm.
- Ghi kết quả Đạt cho 69 ca kiểm thử chi tiết và 116 kịch bản kiểm thử.
- Kết quả: máy chủ API 368/368, kiểm thử giao diện 45/45.

#### Quyết định

- Claude tự chọn các điểm của YCTD-66 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-66 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.4.

#### Vấn đề tồn đọng

- Phần 9b đến 9g của đợt DT-09.
- Cổng CG-11 cần Eric: thuê hạ tầng đám mây (T6), chọn nhà cung cấp tin nhắn và cổng thanh toán (T1), ký nghiệm thu.

### 2026-10-11 — DT-08 phần 8b: nhật ký của bé

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 34 (phần 8a); viết phần 8b trên nhánh `dt-08-phan-8b`.
- Cơ sở dữ liệu: năm học có `daily_journals`, `journal_amendments` (tệp 0025).
- Máy chủ API: nhật ký của lớp theo ngày, lưu nhật ký từng trẻ, công bố cả lớp kèm cảnh báo, nhật ký của trẻ theo tháng, lịch sử sửa.
- Ứng dụng giáo viên: màn hình nhật ký của lớp (MG-03). Ứng dụng phụ huynh: nhật ký của con (MP-03).
- Kết quả: máy chủ API 327/327, kiểm thử giao diện 45/45. Hoàn thành đợt DT-08.

#### Quyết định

- Claude tự chọn các điểm của YCTD-65 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-65 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.3.

#### Vấn đề tồn đọng

- Đợt DT-09: kiểm thử toàn bộ giai đoạn 1, nghiệm thu, phát hành 1.0.0.

### 2026-10-11 — DT-08 phần 8a: trung tâm thông báo và mẫu thông báo

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 33 (phần 7b, hoàn thành DT-07); viết phần 8a trên nhánh `dt-08-phan-8a`.
- Cơ sở dữ liệu: năm học có `notification_reads`, `notification_templates` (tệp 0024); định danh có hai mã quyền P19 (tệp 0029).
- Máy chủ API: danh sách thông báo theo người nhận trực tiếp và theo vai trò, đánh dấu đã đọc, ai đã đọc, mẫu thông báo.
- Cổng quản trị: trang Thông báo (MH-55) và số chưa đọc ở thanh điều hướng; ứng dụng giáo viên và phụ huynh: khung thông báo.
- Kết quả: máy chủ API 322/322, kiểm thử giao diện 44/44.

#### Quyết định

- Claude tự chọn các điểm của YCTD-64 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-64 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.2.

#### Vấn đề tồn đọng

- Phần 8b: nhật ký của bé.

### 2026-10-11 — DT-07 phần 7b: khóa API cho đối tác

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 32 (phần 7a; lần chạy đầu của CI lỗi ngẫu nhiên ở ca kiểm thử giao diện 20, chạy lại thì đạt); viết phần 7b trên nhánh `dt-07-phan-7b`.
- Cơ sở dữ liệu định danh: bảng `api_clients`, mã quyền `P01.api-client.manage` (tệp 0028).
- Dịch vụ định danh: cấp, xem, thu hồi, kiểm tra khóa. Máy chủ API: nhóm `/partner/` với giới hạn tần suất và nhật ký truy cập dữ liệu nhạy cảm.
- Cổng quản trị: trang Khóa API cho đối tác (MH-42).
- Kết quả: máy chủ API 318/318, dịch vụ định danh 37/37, kiểm thử giao diện 43/43. Hoàn thành đợt DT-07.

#### Quyết định

- Claude tự chọn các điểm của YCTD-63 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-63 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.1.

#### Vấn đề tồn đọng

- Đợt DT-08: ứng dụng giáo viên và ứng dụng phụ huynh.

### 2026-10-11 — DT-07 phần 7a: bảng điều khiển và báo cáo cơ bản

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 31 (phần 6c-2, hoàn thành DT-06); viết phần 7a trên nhánh `dt-07-phan-7a`.
- Cơ sở dữ liệu: định danh có chín mã quyền P17 (tệp 0027).
- Máy chủ API: bảng điều khiển Ban Giám hiệu và quản lý đơn vị, sinh nhật trẻ, báo cáo học phí, công nợ, thu chi, điểm danh, chấm công, học thứ 7.
- Cổng quản trị: bảng điều khiển và sinh nhật trên trang chủ (MH-01), trang Báo cáo (MH-28).
- Kết quả: máy chủ API 314/314, kiểm thử giao diện 42/42.

#### Quyết định

- Claude tự chọn các điểm của YCTD-62 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-62 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.30.0.

#### Vấn đề tồn đọng

- Phần 7b: khóa API cho đối tác.

### 2026-10-11 — DT-06 phần 6c-2: phiếu chi lương, quyết toán, thu hồi lương, điều chỉnh kỳ sau

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 30 (phần 6c-1). Eric ủy quyền tự làm tới khi hoàn tất dự án, không chờ xác nhận; viết phần 6c-2 trên nhánh `dt-06-phan-6c-2`.
- Cơ sở dữ liệu: năm học có `payroll_settlements`, `payroll_adjustments`; `payments` có `payroll_id`, `settlement_id`; `receipts` cho phép không gắn trẻ, có `staff_id`, `settlement_id` (tệp 0023).
- Máy chủ API: phiếu chi lương từ bảng lương và bảng quyết toán, bảng quyết toán, phiếu thu thu hồi lương, khoản điều chỉnh kỳ sau đưa vào bảng lương, chuyển năm học.
- Cổng quản trị: lập phiếu chi lương ở trang Bảng lương; trang Quyết toán và điều chỉnh lương (MH-54).
- Kết quả: máy chủ API 305/305, kiểm thử giao diện 41/41. Hoàn thành đợt DT-06.

#### Quyết định

- Claude tự chọn các điểm của YCTD-61 theo ủy quyền của Eric ngày 2026-10-11.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-61 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.7.

#### Vấn đề tồn đọng

- Đợt DT-07: bảng điều khiển và báo cáo cơ bản, API chỉ đọc cho đối tác.

### 2026-10-11 — DT-06 phần 6c-1: danh mục lương, biểu thuế, bảng lương, phiếu lương

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 29 (phần 6b-2). Hỏi Eric các điểm của phần 6c; chia 6c-1 và 6c-2; viết phần 6c-1 trên nhánh `dt-06-phan-6c-1`.
- Cơ sở dữ liệu: năm học có `pay_item_types`, `staff_pay_items`, `tax_tables` (có sẵn biểu thuế hiện hành), `payrolls`, `payslips`, `payslip_lines`, `staff.dependents_count` (tệp 0022); định danh có sáu mã quyền P08 (tệp 0026).
- Máy chủ API: danh mục lương, khoản gán, số người phụ thuộc, biểu thuế, tính bảng lương toàn trường, trình, duyệt, trả lại, phiếu lương của tôi, chuyển năm học; cấu hình hệ số làm thêm.
- Cổng quản trị: trang Bảng lương (MH-15), Danh mục lương và biểu thuế (MH-53), Phiếu lương của tôi, khoản lương riêng ở hồ sơ nhân sự. Ứng dụng giáo viên: màn hình phiếu lương (MG-11).
- Kết quả: máy chủ API 299/299, kiểm thử giao diện 40/40.

#### Quyết định

- Theo YCTD-60 – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-60 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.6.

#### Vấn đề tồn đọng

- Phần 6c-2: phiếu chi lương, bảng quyết toán, phiếu thu thu hồi lương, bảng điều chỉnh kỳ sau.

### 2026-10-11 — DT-06 phần 6b-2: phép năm, đơn nghỉ phép, chốt và mở lại bảng công

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 28 (phần 6b-1); viết phần 6b-2 trên nhánh `dt-06-phan-6b-2`.
- Cơ sở dữ liệu: năm học có `leave_policies`, `leave_balances`, `leave_requests`, `timesheet_periods`, `timesheet_days`, `timesheet_reopen_requests` (tệp 0021); định danh có `P08.leave-policy.manage`, `P08.leave.approve`, `P08.timesheet-reopen.approve` (tệp 0025).
- Máy chủ API: quy định phép năm, số ngày phép, đơn nghỉ phép, chốt bảng công, đề nghị và duyệt mở lại, chặn sửa kỳ đã chốt, chuyển năm học.
- Cổng quản trị: trang Đơn nghỉ phép, trang Quy định phép năm (MH-52), phần kỳ công ở trang Chấm công. Ứng dụng giáo viên: màn hình đơn nghỉ phép.
- Kết quả: máy chủ API 290/290, kiểm thử giao diện 39/39.

#### Quyết định

- Theo YCTD-59 – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-59 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.5.

#### Vấn đề tồn đọng

- Phần 6c: tiền lương.

### 2026-10-11 — DT-06 phần 6b-1: ngày lễ, lịch học bù và nghỉ bù, chấm công

#### Công việc đã thực hiện

- Hỏi Eric các điểm của phần 6b; chia 6b-1 và 6b-2; viết phần 6b-1 trên nhánh `dt-06-phan-6b`.
- Cơ sở dữ liệu: năm học có `holidays`, `school_day_changes`, `attendance_logs`, `catalog_items.attributes` (tệp 0020); định danh có `P08.holiday.manage`, `P08.school-day-change.manage`, `P08.attendance.manage`, `P08.attendance.view` (tệp 0024).
- Máy chủ API: ngày lễ, lịch học bù và nghỉ bù; lịch ngày học của trẻ tính ngày lễ, nghỉ bù, học bù; ngày làm việc của nhân sự; chấm công tự bấm và nhập tay; cấu hình giờ làm; thuộc tính loại nghỉ; chuyển năm học.
- Cổng quản trị: trang Chấm công (MH-44, MH-13), trang Ngày lễ và lịch bù (MH-37), thuộc tính loại nghỉ ở Danh mục dùng chung. Ứng dụng giáo viên: thẻ chấm công hôm nay (MG-10).
- Kết quả: máy chủ API 279/279, kiểm thử giao diện 38/38.

#### Quyết định

- Ngày làm việc, lịch thứ bảy, ngày lễ, giờ làm, loại nghỉ, phép năm, đơn nghỉ theo YCTD-59 – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-59 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.4.

#### Vấn đề tồn đọng

- Phần 6b-2 làm ngay sau đó.

### 2026-10-10 — DT-06 phần 6a: hồ sơ nhân sự và hợp đồng lao động

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 26 (đổi cổng kiểm thử giao diện).
- Tạo `.claude/launch.json` cho các máy chủ phát triển (không đưa vào kho mã).
- Hỏi Eric bốn điểm của DT-06; chia ba phần; viết phần 6a trên nhánh `dt-06-phan-6a`.
- Cơ sở dữ liệu: năm học có `staff`, `employment_contracts`, lần nhập loại `staff` (tệp 0019); định danh có `P07.staff.manage`, `P07.staff.view`, `P07.contract.view`, `P01.import.staff` (tệp 0023).
- Dịch vụ định danh: tra tài khoản nhân sự để liên kết; khóa tài khoản và thu hồi phiên khi chấm dứt hợp đồng.
- Máy chủ API: hồ sơ nhân sự, liên kết tài khoản, hợp đồng, chấm dứt hợp đồng, cảnh báo hết hạn, hồ sơ của tôi, nhập nhân sự từ Excel, chuyển năm học.
- Cổng quản trị: trang Hồ sơ nhân sự (MH-12), mục nhân sự ở trang Nhập dữ liệu, cảnh báo hợp đồng sắp hết hạn trên trang chủ.
- Kết quả: máy chủ API 266/266, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 36/36.

#### Quyết định

- DT-06 chia ba phần; hồ sơ liên kết tài khoản có sẵn; nhân viên tự chấm công, phòng nhân sự sửa; đơn nghỉ phép do Hiệu trưởng hoặc Phó Hiệu trưởng duyệt (YCTD-58) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-58 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.3.

#### Vấn đề tồn đọng

- Không.

### 2026-10-10 — Đổi cổng kiểm thử giao diện

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 25 (phần 5f) sau khi mọi bước kiểm thử trên GitHub đạt; đợt DT-05 xong, còn bộ chuyển đổi nhà cung cấp thanh toán thật.
- Đổi cổng kiểm thử giao diện trong `tests/e2e-environment.mjs` để không trùng máy chủ phát triển đang chạy trên máy: dịch vụ định danh 3201, máy chủ API 3200, cổng quản trị 5373, ứng dụng phụ huynh 5375, ứng dụng giáo viên 5376.
- Kết quả: kiểm thử giao diện chạy trên máy đạt 35/35.

#### Quyết định

- Đổi cổng kiểm thử giao diện sang cổng khác – người quyết định: Eric.

#### Vấn đề tồn đọng

- Không.

### 2026-10-10 — DT-05 phần 5f: thanh toán trực tuyến bằng mã QR

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 24 (phần 5e-2) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric hai lượt về nhà cung cấp, tài khoản nhận, đối chiếu và phạm vi; viết phần 5f trên nhánh `dt-05-phan-5f`.
- Cơ sở dữ liệu: năm học có `payment_requests`, `online_payment_transactions`, tài khoản nhận thanh toán trực tuyến trong `cash_accounts` (tệp 0018).
- Máy chủ API: lớp nhà cung cấp có bộ giả lập; cấu hình tài khoản nhận; cấp mã QR theo hóa đơn; đối chiếu giao dịch tiền vào, tự lập phiếu thu; danh sách chờ và ghi xử lý; tách phần ghi phiếu thu để dùng chung.
- Cổng quản trị: chọn tài khoản nhận ở trang Quỹ và ngân hàng; giao dịch chờ xử lý ở trang Phiếu thu. Ứng dụng phụ huynh: nút thanh toán bằng mã QR.
- Kết quả: máy chủ API 257/257, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1; kiểm thử giao diện chạy trên CI vì cổng 5273 trên máy đang bận.

#### Quyết định

- Nhà cung cấp cấp tài khoản ảo và mã QR dùng một lần qua API, tiền về một tài khoản của trường; đối chiếu nội dung trước, số tiền sau; nội dung là mã hóa đơn bỏ gạch; điểm cuối nhận thông báo thật chờ chọn nhà cung cấp; làm đủ phần còn lại với bộ giả lập (YCTD-57) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-57 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.2.

#### Vấn đề tồn đọng

- Chọn nhà cung cấp tài khoản ảo và xác nhận chuyển khoản (T1), viết bộ chuyển đổi và điểm cuối nhận thông báo có chữ ký, địa chỉ mạng cho phép; chạy CTC-P06-061.

### 2026-10-10 — DT-05 phần 5e-2: phiếu đảo phiếu chi

#### Công việc đã thực hiện

- Sửa lỗi CI của yêu cầu gộp số 23: kiểm thử giao diện phiếu chi chờ nhãn cần Hiệu trưởng duyệt, nhưng dữ liệu kiểm thử đã đặt hạn mức phiếu chi ở `06-catalogs.spec.ts`; đổi sang kiểm tra nội dung phiếu.
- Viết phần 5e-2 trên nhánh `dt-05-phan-5e2`.
- Cơ sở dữ liệu: năm học có `payment_reversals` (tệp 0017); định danh có `P06.payment-reversal.create` (tệp 0022).
- Máy chủ API: lập, duyệt, từ chối phiếu đảo phiếu chi theo hạn mức; hoàn lại nguồn chi; đảo phiếu hoàn tiền trả lại số dư có; sổ quỹ ghi số phiếu đảo.
- Cổng quản trị: trang Phiếu chi có nút lập phiếu đảo và mục phiếu đảo phiếu chi chờ duyệt.
- Kết quả: máy chủ API 246/246, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1; kiểm thử giao diện chạy trên CI vì cổng 5273 trên máy đang bận.

#### Quyết định

- Không có quyết định mới; làm theo YCTD-55.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-56 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.1.

#### Vấn đề tồn đọng

- Không.

### 2026-10-10 — DT-05 phần 5e-1: phiếu chi và sổ quỹ

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 22 (phần 5d-2) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric bốn điểm của phần 5e; chia 5e thành 5e-1 và 5e-2; viết phần 5e-1 trên nhánh `dt-05-phan-5e`.
- Cơ sở dữ liệu: năm học có `payments`, `payment_attachments`, `payment_refund_sources`, tệp mục đích `payment_voucher` (tệp 0016); định danh có `P06.payment.manage`, `P06.payment.approve` (tệp 0021); cấu hình kiểm tra số dư ngân hàng mặc định bật.
- Máy chủ API: lập, sửa, xóa phiếu chi nháp, trình duyệt, duyệt là phát hành, từ chối; hoàn tiền trừ số dư có; sổ quỹ theo khoảng ngày; tải và xem chứng từ phiếu chi.
- Cổng quản trị: trang Phiếu chi (MH-10) có biểu mẫu kèm chứng từ, danh sách và mục chờ duyệt; trang Sổ quỹ (MH-11).
- Kết quả: máy chủ API 242/242, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1; kiểm thử giao diện chạy trên CI vì cổng 5273 trên máy đang bận.

#### Quyết định

- Hoàn tiền thôi học trừ vào số dư có; kiểm tra số dư ngân hàng mặc định chặn; chia 5e-1, 5e-2; phiếu nộp, phiếu rút để giai đoạn 2 (YCTD-55) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-55 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.29.0.

#### Vấn đề tồn đọng

- CTC-P06-034 (phiếu chi lương từ bảng lương đã duyệt) chờ phân hệ lương; CTC-P01-049 (tắt kiểm tra số dư ngân hàng) chưa có kiểm thử tự động.

### 2026-10-10 — DT-05 phần 5d-2: đảo phiếu thu và nhập công nợ đầu kỳ

#### Công việc đã thực hiện

- Sửa lỗi CI của yêu cầu gộp số 21: mục điều hướng "Quỹ và tài khoản" trùng tên với mục "Tài khoản" trong kiểm thử giao diện, đổi thành "Quỹ và ngân hàng"; gộp yêu cầu gộp số 21 sau khi mọi bước đạt.
- Hỏi Eric ba điểm của phần 5d-2; viết phần 5d-2 trên nhánh `dt-05-phan-5d2`.
- Cơ sở dữ liệu: năm học có `receipt_reversals`, hóa đơn và dòng khoản loại đầu kỳ, lần nhập loại công nợ đầu kỳ (tệp 0015); định danh có `P06.receipt-reversal.create`, `P06.receipt-reversal.approve`, `P05.opening-debt.import` (tệp 0020).
- Máy chủ API: lập, duyệt, từ chối phiếu đảo theo hạn mức, chặn khi quỹ không đủ; danh sách phiếu đảo chờ duyệt; nhập công nợ đầu kỳ từ Excel theo quy trình kiểm tra rồi ghi; hàm cấp số chứng từ dùng chung.
- Cổng quản trị: trang Phiếu thu có lập phiếu đảo và mục phiếu đảo chờ duyệt; trang Nhập dữ liệu có mục công nợ đầu kỳ cho kế toán.
- Kết quả: máy chủ API 227/227, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1; kiểm thử giao diện chạy trên CI vì cổng 5273 trên máy đang bận.

#### Quyết định

- Quỹ tiền mặt không đủ thì chặn duyệt phiếu đảo; số phiếu đảo `DPT-000001` riêng; tệp công nợ đầu kỳ dùng số định danh cá nhân, chỉ số dương (YCTD-54) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-54 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.9.

#### Vấn đề tồn đọng

- CTC-P01-082 còn phần nhập tệp nhân sự, làm khi xây dựng P07.

### 2026-10-10 — DT-05 phần 5d-1: phiếu thu, phân bổ, quỹ và công nợ

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 20 (phần 5c-2) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric bốn điểm của phần 5d; chia 5d thành 5d-1 và 5d-2; viết phần 5d-1 trên nhánh `dt-05-phan-5d1`.
- Cơ sở dữ liệu: năm học có `cash_accounts`, `receipts`, `receipt_allocations`, `account_transactions` (tệp 0014); định danh có `P06.receipt.manage`, `P06.cash-account.manage`, `P05.debt.view` (tệp 0019).
- Máy chủ API: khai báo quỹ và tài khoản; lập phiếu thu kèm phân bổ, chống gửi lặp, ghi giao dịch tài khoản, thông báo phụ huynh và báo tất toán; dùng số dư có; danh sách và chi tiết phiếu thu; công nợ theo đơn vị và theo trẻ; số đã thu và còn phải nộp của hóa đơn; chặn giảm vượt số còn phải nộp.
- Cổng quản trị: trang Công nợ (MH-08) có chi tiết của trẻ, lập phiếu thu, dùng số dư có; trang Phiếu thu (MH-09); trang Quỹ và ngân hàng (MH-11). Ứng dụng phụ huynh: số còn phải nộp, hóa đơn đã thu đủ, số dư có, lịch sử đã nộp.
- Kết quả: máy chủ API 219/219, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 31.

#### Quyết định

- Làm quỹ và tài khoản ở phần 5d; số phiếu thu `PT-000001` toàn trường; phân bổ theo hóa đơn; công nợ đầu kỳ nhập thành hóa đơn loại đầu kỳ (YCTD-53) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-53 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.8.

#### Vấn đề tồn đọng

- CTC-P06-066 (đánh số lại khi mở năm học mới) chưa có kiểm thử tự động; số phiếu nằm trong cơ sở dữ liệu năm học nên năm mới bắt đầu từ `PT-000001`.

### 2026-10-10 — DT-05 phần 5c-2: miễn giảm và phiếu điều chỉnh hóa đơn

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 19 (phần 5c-1) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric hai điểm của phần 5c-2; viết phần 5c-2 trên nhánh `dt-05-phan-5c2`.
- Cơ sở dữ liệu: năm học có `discounts`, `invoice_adjustments` (tệp 0013); định danh có `P05.discount.manage`, `P05.invoice-adjustment.create`, `P05.fee-document.approve` (tệp 0018).
- Máy chủ API: lập miễn giảm, chép miễn giảm kỳ trước, lập phiếu điều chỉnh, duyệt và từ chối theo hạn mức, danh sách chờ duyệt; số phải nộp của hóa đơn; tính lại miễn giảm chờ duyệt khi chạy lại tính học phí.
- Cổng quản trị: chi tiết hóa đơn trong MH-06 có miễn giảm, điều chỉnh, số phải nộp và biểu mẫu lập; trang MH-07 Duyệt miễn giảm và điều chỉnh. Ứng dụng phụ huynh: số phải nộp và miễn giảm đã duyệt.
- Kết quả: máy chủ API 200/200, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 30/30.

#### Quyết định

- Miễn giảm lập trên cả hóa đơn nháp và đã phát hành; lập theo từng hóa đơn, có chép từ kỳ trước (YCTD-52) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-52 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.7.

#### Vấn đề tồn đọng

- Không.

### 2026-10-10 — DT-05 phần 5c-1: tính học phí và phát hành hóa đơn

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 18 (phần 5b) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric bốn điểm của phần 5c; chia phần 5c thành 5c-1 và 5c-2; viết 5c-1 trên nhánh `dt-05-phan-5c1`.
- Sửa lỗi phân quyền của phần 5b: phụ huynh xem được bảng đăng ký của cả đơn vị vì VT-14 gán theo đơn vị của con và có `P05.view`; phạm vi xem của nhân sự nay bỏ vai trò phụ huynh.
- Cơ sở dữ liệu: năm học có `fee_calculation_runs`, `invoices`, `invoice_items`, `document_sequences` (tệp 0012); định danh có `P05.fee-calculation.manage` (tệp 0017).
- Máy chủ API: tính học phí theo kỳ và đơn vị, hóa đơn nháp và dòng cần kiểm tra, phát hành, hóa đơn bổ sung, xem hóa đơn; chặn đăng ký khi nợ quá hạn.
- Cổng quản trị: MH-06 Học phí. Ứng dụng phụ huynh: mục Học phí của con (MP-11).
- Kết quả: máy chủ API 185/185, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 30/30.

#### Quyết định

- Ngày học thực tế của BR-23 là ngày học trong thời gian đang học; tính học phí chạy ngay có ghi lần chạy; dòng cần kiểm tra theo mốc cố định; làm tròn đến đồng (YCTD-51) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-51 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.6.

#### Vấn đề tồn đọng

- CTC-P05-032 (giả lập lỗi giữa lần tính) chưa có kiểm thử tự động. Kiểm thử giao diện chưa chạy trọn luồng tính học phí vì cần một tháng đã qua chốt đủ điểm danh; đã phủ bằng kiểm thử máy chủ API.

### 2026-10-10 — DT-05 phần 5b: đăng ký dịch vụ và học hè

#### Công việc đã thực hiện

- Yêu cầu gộp số 17 (phần 5a) lần đầu thất bại trên GitHub vì kiểm thử hồ sơ trẻ sinh tên ngẫu nhiên trùng nhau; sửa bằng tên đánh số tuần tự, chạy lại đạt rồi gộp.
- Hỏi Eric hai điểm của phần 5b; viết phần 5b trên nhánh `dt-05-phan-5b`.
- Cơ sở dữ liệu: năm học có `service_registrations`, `registration_periods`, `summer_registrations` (tệp 0011); định danh có `P05.registration.manage`, `P05.late-registration.approve` (tệp 0016); cấu hình `service_registration_closing_day`.
- Máy chủ API: bảng đăng ký theo kỳ, đăng ký và hủy, đăng ký và hủy trễ chờ duyệt, chốt kỳ, học hè; điểm danh ngày hè cho trẻ đăng ký học hè.
- Cổng quản trị: MH-05 Đăng ký dịch vụ. Ứng dụng phụ huynh: mục Dịch vụ của con (MP-12).
- Kiểm thử giao diện phát hiện lỗi chạy đua khi tải dữ liệu: kết quả của tháng hoặc ngày cũ về sau ghi đè dữ liệu mới, ở màn hình dịch vụ của ứng dụng phụ huynh và bảng điểm danh của ứng dụng giáo viên; đã sửa bằng cách chỉ nhận kết quả của lần tải mới nhất.
- Kết quả: máy chủ API 174/174, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 29/29.

#### Quyết định

- Hủy dịch vụ sau ngày chốt cần Ban Giám hiệu duyệt; tháng hè không tự giữ dịch vụ không bắt buộc (YCTD-50) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-50 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.5.

#### Vấn đề tồn đọng

- CTC-P05-015 (thu theo ngày thực tế), 017, 018 (chặn khi nợ quá hạn), 065 cần tính học phí và hóa đơn; chạy ở phần 5c, 5d.

### 2026-10-10 — DT-05 phần 5a: danh mục học phí và tài chính

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 16 (phần 4b) sau khi mọi bước kiểm thử trên GitHub đạt; DT-04 xong phần điểm danh và đón trả.
- Hỏi Eric bốn điểm của DT-05; viết phần 5a trên nhánh `dt-05-phan-5a`.
- Cơ sở dữ liệu: năm học có `services` (bán trú tạo sẵn), `fee_schedules`, `fee_schedule_items`, `discount_types`, `cashflow_categories` (tệp 0010); định danh có ba quyền mới (tệp 0015). Mở năm học mới chuyển các danh mục này sang.
- Máy chủ API: dịch vụ, biểu phí theo phiên bản, loại miễn giảm, khoản mục thu chi.
- Cổng quản trị: MH-04 Biểu phí và dịch vụ, MH-39 Khoản mục thu chi.
- Kết quả: máy chủ API 158/158, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 28/28.

#### Quyết định

- DT-05 chia sáu phần; đăng ký dịch vụ tự giữ tới khi hủy; ngày chốt đăng ký là cấu hình đơn vị mặc định ngày 25; danh mục dùng chung toàn trường (YCTD-49) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-49 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.4.

#### Vấn đề tồn đọng

- CTC-P05-002, 003, 007, 045, CTC-P06-052 đến 054 có phần phụ thuộc hóa đơn, đăng ký, phiếu thu chi; chạy ở các phần sau.

### 2026-10-10 — DT-04 phần 4b: người được ủy quyền đón trẻ và đón trả

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 15 (phần 4a) sau khi mọi bước kiểm thử trên GitHub đạt.
- Hỏi Eric bốn điểm của phần 4b; viết phần 4b trên nhánh `dt-04-phan-4b`.
- Cơ sở dữ liệu: năm học có `authorized_pickups`, `pickup_confirmation_requests`, `pickup_records`, tệp mục đích `pickup_photo` (tệp 0009); định danh có quyền `P02.authorized-pickup.manage`, `P04.pickup.gate-confirm` (tệp 0014).
- Máy chủ API: khai báo, hủy người được ủy quyền; bàn giao trẻ; yêu cầu và trả lời xác nhận của phụ huynh; danh sách người đón cho bảo vệ; ảnh bàn giao.
- Ứng dụng giáo viên: màn hình Đón trả trẻ (MG-04), Xác nhận người đón tại cổng (MG-16). Ứng dụng phụ huynh: người đón của con, xác nhận người đón ngoài danh sách (MP-18). Cổng quản trị: mục người được ủy quyền trong hồ sơ trẻ.
- Kết quả: máy chủ API 142/142, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 26/26.

#### Quyết định

- Chỉ ghi bàn giao chiều; bảo vệ xác nhận độc lập; mọi phụ huynh có tài khoản của trẻ xác nhận người đón ngoài danh sách, hiệu lực trong ngày; VT-02, VT-15, VT-03 khai báo phía nhà trường (YCTD-48) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-48 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.3.

#### Vấn đề tồn đọng

- Thông báo mới vào hàng đợi; gửi thật khi làm phân hệ thông báo. Kiểm thử giao diện chưa phủ bàn giao của giáo viên vì phụ thuộc hôm nay là ngày học; đã phủ bằng kiểm thử máy chủ API.

### 2026-10-10 — DT-04 phần 4a: điểm danh và báo vắng

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 13 (phần 3c). Yêu cầu gộp số 13 được gộp nhầm khi kiểm thử trên GitHub thất bại; nguyên nhân là các tệp kiểm thử chạy song song cùng sửa mật khẩu mặc định; đã sửa ở yêu cầu gộp số 14 (kiểm thử chạy từng tệp lần lượt) và chỉ gộp khi mọi bước đạt.
- Hỏi Eric bốn điểm của DT-04; viết phần 4a trên nhánh `dt-04-phan-4a`.
- Cơ sở dữ liệu: năm học có `attendance_records`, `attendance_days`, `absence_records`, người nhận thông báo theo vai trò (tệp 0008); định danh có quyền `P04.attendance.manage` (tệp 0013).
- Máy chủ API: lịch ngày học, bảng điểm danh, lưu chống trùng, chốt và mở lại, sửa sau khi chốt kèm lý do, báo vắng, điểm danh của trẻ theo tháng; cấu hình giờ bắt đầu học.
- Ứng dụng giáo viên: đăng nhập, Lớp của tôi, Bảng điểm danh có lưu tạm khi mất mạng. Ứng dụng phụ huynh: danh sách con, báo vắng, điểm danh tháng này. Cổng quản trị: màn hình Điểm danh.
- Kết quả: máy chủ API 129/129, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 24/24.

#### Quyết định

- DT-04 chia hai phần; giờ bắt đầu học cấu hình theo đơn vị mặc định 07:30; bảng ban đầu chưa đánh dấu; chưa điểm danh kỳ hè (YCTD-47) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-47 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.2.

#### Vấn đề tồn đọng

- CTC-P04-007, 008 chờ lịch học bù thứ bảy (P08-10); CTC-P04-046 chờ đăng ký học hè (P05-13).

### 2026-10-10 — DT-03 phần 3c: nhập dữ liệu

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 12 (phần 3b) vào nhánh chính. Eric yêu cầu làm song song: viết phần sau trong lúc phần trước chạy kiểm thử trên GitHub.
- Hỏi Eric ba điểm của phần 3c; viết trên nhánh `dt-03-phan-3c`.
- Cơ sở dữ liệu: năm học có `data_import_jobs`, giấy khai sinh cho phép trống với trẻ nhập (tệp 0007); định danh có quyền `P01.import.children` (tệp 0012).
- Máy chủ API: mẫu Excel, kiểm tra và ghi tệp lớp, tệp trẻ kèm phụ huynh, nhập mã ngành, bộ lọc thiếu giấy khai sinh; tệp vượt dung lượng trả `ERR_VALIDATION`.
- Cổng quản trị: màn hình Nhập dữ liệu (MH-40); Hồ sơ trẻ có bộ lọc và bổ sung giấy khai sinh.
- Kết quả: máy chủ API 116/116, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 22/22.

#### Quyết định

- Trẻ nhập vào thẳng đang học, bổ sung giấy khai sinh sau; mẫu mã ngành của hệ thống; nhập lớp và trẻ kèm phụ huynh (YCTD-46) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-46 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.1.

#### Vấn đề tồn đọng

- CTC-P01-079, 082 (nhập công nợ, nhân sự) làm ở P05, P07; chuyển trẻ sang năm mới (GD-90) làm cùng lên lớp.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-03 phần 3b: hồ sơ trẻ

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 11 (phần 3a) vào nhánh chính.
- Hỏi Eric năm điểm của phần 3b; Eric duyệt thiết kế; viết trên nhánh `dt-03-phan-3b`.
- Hạ tầng: SeaweedFS trong docker compose và GitHub Actions; khóa mã hóa số định danh; lệnh `generate-data-keys`.
- Cơ sở dữ liệu: năm học có mười bảng của hồ sơ trẻ (tệp 0006); định danh có quyền `P02.child.manage`, `P02.national-id.view` (tệp 0011).
- Dịch vụ định danh: tạo tài khoản phụ huynh khi duyệt hồ sơ, thêm vai trò VT-14 cho tài khoản nhân sự trùng số điện thoại.
- Máy chủ API: hồ sơ trẻ, phụ huynh, sức khỏe, đồng ý hình ảnh, trình duyệt, duyệt và phân lớp, từ chối, chuyển lớp, xem đầy đủ số định danh, tệp đính kèm, hàng đợi thông báo.
- Cổng quản trị: màn hình Hồ sơ trẻ (MH-02); màn hình Lớp học hiện sĩ số đang học.
- Kết quả: máy chủ API 107/107, dịch vụ định danh 37/37, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 21/21.

#### Quyết định

- Đồng ý hình ảnh ba trạng thái; phạm vi xem trẻ theo lớp với giáo viên; kho tệp SeaweedFS thay MinIO; chuyển trẻ sang năm mới để lại đợt sau (YCTD-45) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-45 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.28.0.

#### Vấn đề tồn đọng

- CTC-P02-013 (gán mã ngành trùng qua nhập tệp) làm ở phần 3c; CTC-P02-033 cần nhà cung cấp tin nhắn.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-03 phần 3a: lớp học

#### Công việc đã thực hiện

- Gộp yêu cầu gộp số 10 (DT-02) vào nhánh chính.
- Hỏi Eric năm điểm của DT-03; Eric duyệt thiết kế phần 3a; viết trên nhánh `dt-03-phan-3a`.
- Cơ sở dữ liệu: năm học có `classes`, `class_staff_assignments` (tệp 0005); định danh có quyền `P02.class.manage` (tệp 0010).
- Dịch vụ định danh: danh bạ nhân sự theo vai trò và đơn vị.
- Máy chủ API: lớp học, phân công giáo viên, kiểm tra bậc học, phòng học, vai trò người được phân công.
- Cổng quản trị: nhóm điều hướng Trẻ và lớp, màn hình Lớp học (MH-03).
- Kết quả: máy chủ API 87/87, dịch vụ định danh 35/35, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 19/19.

#### Quyết định

- DT-03 chia ba phần; giáo viên chọn theo tài khoản; một lớp nhiều giáo viên chủ nhiệm; số điện thoại phụ huynh trùng tài khoản nhân sự thì thêm vai trò VT-14; thông báo ghi hàng đợi (YCTD-44) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-44 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.9.

#### Vấn đề tồn đọng

- Phần điểm danh của CTC-P02-042 chạy khi có P04.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-02: đăng nhập của phụ huynh

#### Công việc đã thực hiện

- Gộp các yêu cầu gộp số 4 đến 9 vào nhánh chính, hoàn tất DT-01.
- Hỏi Eric bốn điểm của DT-02; Eric duyệt thiết kế; viết trên nhánh `dt-02`.
- Cơ sở dữ liệu định danh: tệp 0009 cho mật khẩu mặc định, `sessions.login_method`, bảng `one_time_codes`.
- Dịch vụ định danh: đăng nhập bằng mật khẩu mặc định, mã một lần, lớp gửi tin nhắn, cấu hình chung mới, tạo tài khoản phụ huynh dùng mật khẩu mặc định, cookie mã làm mới riêng theo kênh.
- Cổng quản trị: màn hình Cấu hình phần Tài khoản có mật khẩu mặc định và thông số mã một lần; màn hình Tài khoản báo tài khoản phụ huynh dùng mật khẩu mặc định.
- Ứng dụng phụ huynh: đăng nhập bằng mật khẩu hoặc mã, đặt mật khẩu mới khi kích hoạt, trang chủ tạm.
- Kiểm thử giao diện phát hiện cổng quản trị và ứng dụng phụ huynh dùng chung cookie mã làm mới; đã sửa bằng cookie riêng theo kênh.
- Kết quả: dịch vụ định danh 35/35, máy chủ API 80/80, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 17/17.

#### Quyết định

- Mật khẩu mặc định toàn trường; thông số mã một lần có mặc định, Hiệu trưởng sửa được; lớp gửi tin nhắn nối sau; làm màn hình ứng dụng phụ huynh; bỏ `POST /auth/activate` (YCTD-43) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-43 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.8.

#### Vấn đề tồn đọng

- P19-06 chỉ nghiệm thu xong khi có tài khoản nhà cung cấp tin nhắn (T1).
- CTC-DD-011, 042 còn phần cần P02; CTC-DD-013, 015, 024 chưa chạy.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-10 — DT-01 phần 6b: các danh mục

#### Công việc đã thực hiện

- Hỏi Eric bốn điểm tài liệu chưa rõ trước khi thiết kế; Eric duyệt thiết kế; viết trên nhánh `dt-01-phan-6b`.
- Cơ sở dữ liệu: năm học có `departments`, `job_titles`, `catalog_items`, `approval_thresholds`, `rooms`, `grade_levels` (tệp 0004); định danh có bốn mã quyền mới (tệp 0008).
- Máy chủ API: điểm cuối của sáu danh mục, kiểm tra phạm vi đơn vị, ghi nhật ký thao tác, chuyển danh mục khi mở năm học mới.
- Cổng quản trị: MH-49 Phòng ban và chức danh, MH-50 Danh mục dùng chung, MH-33 Hạn mức phê duyệt, MH-34 Phòng học và bậc học; bộ lọc nhật ký thao tác thêm các danh mục.
- Kết quả: máy chủ API 80/80 (gồm 16 ca của danh mục), dịch vụ định danh 21/21, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 15/15.

#### Quyết định

- Danh mục dùng chung có bốn loại do hệ thống định nghĩa; VT-06 quản lý phòng ban và chức danh trong đơn vị; hạn mức có hiệu lực ngay; độ tuổi bậc học theo tháng (YCTD-42) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-42 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.7.

#### Vấn đề tồn đọng

- CTC-P01-023, 027, 060 đến 066, 068, 070, 071, 074 và phần chọn bậc học của 073 cần hồ sơ nhân sự, lớp học, chứng từ ở các đợt sau.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Ngày chốt học phí và chốt công

#### Công việc đã thực hiện

- Eric cho biết ngày chốt học phí là mùng 1 tháng sau; hỏi lại hai điểm và sửa tài liệu, mã nguồn phần 6a.

#### Quyết định

- Chốt học phí mặc định mùng 1 tháng sau, vẫn cấu hình được; chốt công cố định mùng 1 tháng sau (YCTD-41) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-41 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.6.

#### Vấn đề tồn đọng

- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — DT-01 phần 6a: cấu hình và nhật ký thao tác

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 6a. Viết trên nhánh `dt-01-phan-6a`.
- Cơ sở dữ liệu: năm học có `settings` và cột `audit_logs.actor_name`; định danh có `identity_settings`, cột `identity_audit_logs.actor_name`, quyền `P01.setting.manage` cho VT-02, VT-03.
- Máy chủ API: danh mục mười mục cấu hình, kế thừa đơn vị, Trường chính, mặc định; ghi nhật ký; chuyển cấu hình khi mở năm học; tra nhật ký thao tác theo phạm vi đơn vị.
- Dịch vụ định danh: số ngày tự khóa đọc, sửa trên cổng; khóa tài khoản lâu không đăng nhập ở lần đăng nhập kế tiếp; tra nhật ký tài khoản và quyền.
- Cổng quản trị: màn hình Cấu hình và MH-31 Nhật ký thao tác, nhật ký chỉ hiện các trường thay đổi.
- Kết quả: máy chủ API 64/64 (gồm CTC-P01-044 đến 048, 051, 053, 054), dịch vụ định danh 21/21 (gồm CTC-DD-006), cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 12/12.

#### Quyết định

- Không có quyết định mới ngoài YCTD-40.

#### Thay đổi

- `17` ghi giao kèo cấu hình và nhật ký; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.5.

#### Vấn đề tồn đọng

- CTC-P01-049, 050, 052, 055 đến 058 cần dữ liệu tài chính, lớp, hóa đơn và nhật ký truy cập ở các đợt sau.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 6a: cấu hình và nhật ký

#### Công việc đã thực hiện

- Trình thiết kế phần 6a và bốn câu hỏi về cấu hình.

#### Quyết định

- Cấu hình chưa có mặc định trong tài liệu để trống, bắt buộc cấu hình; kế thừa từ Trường chính; VT-02, VT-03 sửa cấu hình; số ngày tự khóa mặc định 90, Hiệu trưởng sửa trên cổng (YCTD-40) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-40 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.4.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 6a.

### 2026-10-09 — DT-01 phần 5: tài khoản, vai trò, quyền

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 5. Viết trên nhánh `dt-01-phan-5`.
- Cơ sở dữ liệu định danh: `0006_add_account_management` tạo `identity_audit_logs` và thêm `P01.account.manage-in-unit` cho VT-03.
- Dịch vụ định danh: tạo, sửa, khóa, mở khóa tài khoản, đặt lại mật khẩu bằng mật khẩu tạm, gán và gỡ vai trò, tạo vai trò, sửa ma trận quyền, danh sách quyền; kiểm tra phạm vi theo PQ-13 bằng cây đơn vị đọc qua máy chủ API; thu hồi phiên khi khóa, đặt lại mật khẩu, đổi vai trò; giới hạn đăng nhập đọc được từ biến môi trường `LOGIN_REQUESTS_PER_MINUTE`, mặc định 10.
- Cổng quản trị: MH-30 gồm màn hình Tài khoản và Vai trò và quyền; mục điều hướng chỉ hiện với người có quyền quản lý tài khoản; máy chủ phát triển chuyển `users`, `roles`, `permissions` sang dịch vụ định danh.
- Kết quả: máy chủ API 54/54 (gồm CTC-P01-030 đến 035, 037 đến 039, 041, 042, CTC-DD-035, 039, 040), dịch vụ định danh 20/20, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 10/10.

#### Quyết định

- Không có quyết định mới ngoài YCTD-39.

#### Thay đổi

- `17` ghi giao kèo nhóm tài khoản, vai trò, quyền, điểm cuối gỡ vai trò và quy tắc chuyển tiếp của cổng vào; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.3.

#### Vấn đề tồn đọng

- CTC-P01-036 (khóa khi chấm dứt hợp đồng) làm ở DT-06; CTC-P01-040, 043 cần điểm cuối nghiệp vụ của kế toán và hồ sơ trẻ.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 5: tài khoản, vai trò, quyền

#### Công việc đã thực hiện

- Trình thiết kế phần 5 và bốn câu hỏi về phân quyền quản lý tài khoản.

#### Quyết định

- VT-01, VT-02 quản lý mọi tài khoản và sửa ma trận quyền; VT-03 tạo tài khoản với mọi vai trò trừ VT-01, VT-02 trong đơn vị được gán; hệ thống sinh mật khẩu tạm khi đặt lại (YCTD-39) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-39 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.2.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 5.

### 2026-10-09 — DT-01 phần 4: cây đơn vị hai cấp

#### Công việc đã thực hiện

- Eric duyệt YCTD-38 và thiết kế phần 4. Viết trên nhánh `dt-01-phan-4`.
- Cơ sở dữ liệu năm học: `0002_create_org_units_and_audit_logs` tạo `org_units` có ràng buộc một Trường chính, đơn vị cấp 2 chỉ trực thuộc Trường chính ở tầng dữ liệu, và `audit_logs`. Cơ sở dữ liệu định danh: `0005_add_org_unit_permission` thêm `P01.org-unit.manage` cho VT-02.
- Máy chủ API: tạo, sửa, ngừng sử dụng đơn vị; cây và danh sách phẳng lọc theo loại; ghi nhật ký thao tác; bước chuyển cây đơn vị khi mở năm học, giữ nguyên mã định danh; lớp đơn vị của phân quyền: gán ở Trường chính là toàn trường, gán ở đơn vị cấp 2 chỉ có đơn vị đó.
- Cổng quản trị: MH-32 Cây đơn vị, dạng cây và danh sách phẳng.
- Kết quả: máy chủ API 41/41 (gồm CTC-P01-001 đến 005, 007, 008, 012 và lớp đơn vị theo CTC-P01-009 đến 011 với điểm cuối kiểm thử), dịch vụ định danh 20/20, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 7/7.

#### Quyết định

- Không có quyết định mới ngoài YCTD-38.

#### Thay đổi

- `17` ghi giao kèo nhóm điểm cuối cây đơn vị; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.1.

#### Vấn đề tồn đọng

- CTC-P01-009 đến 011 kiểm lại với danh sách lớp và trẻ ở DT-03.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 4: cây đơn vị

#### Công việc đã thực hiện

- Trình thiết kế phần 4; Eric cho biết trường chỉ có hai cấp; đánh giá ảnh hưởng và trình YCTD-38.

#### Quyết định

- Cây đơn vị hai cấp, cấp 2 chọn loại Phân hiệu hoặc Điểm trường, Trường chính có lớp, nhãn cố định; chặn ngừng sử dụng đơn vị còn đơn vị con đang hoạt động (YCTD-38) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-38 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.27.0.

#### Vấn đề tồn đọng

- Viết mã phần 4.

### 2026-10-09 — DT-01 phần 3: năm học

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 3. Viết trên nhánh `dt-01-phan-3`.
- Cơ sở dữ liệu hệ thống: `0002_create_academic_year_tables` tạo `academic_years`, `academic_terms`, `school_weeks`, `academic_year_databases`, có chỉ mục bảo đảm chỉ một năm đang dùng. Cơ sở dữ liệu định danh: `0004_add_academic_year_permission` thêm `P01.academic-year.manage` cho VT-02.
- Tài khoản `api_service` có quyền tạo cơ sở dữ liệu; bỏ cơ sở dữ liệu năm học tạo tay trong Docker và biến `SCHOOL_YEAR_DATABASE_URL`; công cụ thay đổi cấu trúc chạy trên năm học đang dùng (QU-11).
- Máy chủ API: tạo năm học, lưu lịch, đánh số tuần, đánh dấu tuần nghỉ, mở năm học gồm kiểm tra, tạo cơ sở dữ liệu, chạy tệp thay đổi cấu trúc, chuyển dữ liệu, đóng năm cũ và chuyển sang chỉ đọc; khung bước chuyển năm học để các phân hệ sau tự thêm bước.
- Cổng quản trị: màn hình Năm học gồm MH-45 và MH-43; thêm `StatusBadge`, `ConfirmDialog`, `Toast` vào `packages/ui`.
- Kiểm thử giao diện chạy trên cơ sở dữ liệu hệ thống riêng `school_system_e2e` và cổng riêng, chuẩn bị lại trước mỗi lần chạy.
- Kết quả: máy chủ API 26/26 (gồm CTC-P01-013, 018, 099 đến 104 và khung kiểm tra, chuyển dữ liệu của CTC-P01-096, 097), dịch vụ định danh 20/20, cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 5/5.

#### Quyết định

- Không có quyết định mới ngoài YCTD-37.

#### Thay đổi

- `17` ghi giao kèo nhóm điểm cuối năm học và trường `rule_code`; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.6.

#### Vấn đề tồn đọng

- CTC-P01-014 đến 017, 096 đến 098 cần dữ liệu trẻ và công nợ, chạy ở DT-03 và DT-05; CTC-P01-019 chạy khi có tệp thay đổi cấu trúc năm học thứ hai.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 3: năm học

#### Công việc đã thực hiện

- Đọc tài liệu cho phần 3, phát hiện mâu thuẫn giữa AC-194, CB-10 và BR-89, CTC-P01-096 đến 098 về việc năm cũ còn ghi được sau khi mở năm mới; trình Eric thiết kế phần 3.

#### Quyết định

- Mở năm học mới là đóng năm cũ trong một thao tác; lịch năm học sửa được cho tới khi đóng (YCTD-37) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-37 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.5.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 3.

### 2026-10-09 — DT-01 phần 2: kiểm tra mã phiên, quyền và màn hình đăng nhập

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 2. Viết trên nhánh `dt-01-phan-2`.
- Thêm gói `packages/server`: mô hình lỗi, bộ lọc lỗi, đồng hồ, kiểm tra mã phiên bằng khóa công khai; dịch vụ định danh chuyển sang dùng gói này.
- Dịch vụ định danh trả mã làm mới bằng cookie httpOnly, SameSite=Strict, Secure, đường dẫn `/api/v1/auth`; đăng xuất xóa cookie (BM-71).
- Máy chủ API: kiểm tra mã phiên ở mọi điểm cuối trừ kiểm tra sức khỏe; hỏi `GET /api/v1/auth/me` ở mỗi yêu cầu (QĐ-20); khai báo quyền cần có cho từng điểm cuối; trả phạm vi đơn vị của từng quyền; từ chối mã phiên còn bắt buộc đổi mật khẩu.
- Cổng quản trị: MH-47 Đăng nhập, MH-48 Đổi mật khẩu, khung trang điều hướng dọc bên trái, tự làm mới mã phiên, đăng xuất; thêm thành phần `Button`, `TextField`, `Alert` và mã màu theo `15` vào `packages/ui`.
- Thêm gói `tests` chạy Playwright; GitHub Actions sinh khóa tạm, cài Chromium và chạy kiểm thử giao diện.
- Kết quả: dịch vụ định danh 20/20, máy chủ API 9/9 (gồm CTC-DD-035, 036, 037, 041), cơ sở dữ liệu 3/3, tiến trình chạy nền 1/1, kiểm thử giao diện 3/3; kiểm tra kiểu, quy tắc viết mã, định dạng đạt.

#### Quyết định

- Cookie mã làm mới áp dụng cho cả ba kênh trình duyệt – người quyết định: Eric.

#### Thay đổi

- Xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.4.

#### Vấn đề tồn đọng

- CTC-DD-035 mới kiểm được phần từ chối ngay khi mất vai trò; phần thu hồi mã làm mới khi đổi quyền làm cùng điểm cuối gán vai trò ở phần 5. CTC-DD-041 kiểm lại khi có điểm cuối nghiệp vụ thật.
- Lớp đơn vị mới trả đơn vị được gán; mở rộng sang đơn vị con làm ở phần 4 khi có cây đơn vị.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Thiết kế DT-01 phần 2

#### Công việc đã thực hiện

- Trình thiết kế phần 2: máy chủ API kiểm tra mã phiên và quyền, màn hình đăng nhập và đổi mật khẩu trên cổng quản trị.

#### Quyết định

- Mã làm mới lưu trong cookie httpOnly; thêm gói `packages/server`; điều hướng dọc bên trái; làm kiểm thử Playwright ngay (YCTD-36) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-36 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.3.

#### Vấn đề tồn đọng

- Chờ Eric duyệt thiết kế phần 2.

### 2026-10-09 — DT-01 phần 1: phần lõi dịch vụ định danh

#### Công việc đã thực hiện

- Eric duyệt thiết kế phần 1. Viết trên nhánh `dt-01-phan-1`.
- Cơ sở dữ liệu định danh: tệp thay đổi cấu trúc `0002_create_account_tables` tạo `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `sessions`, `security_events`; `0003_seed_roles_and_permissions` tạo 19 vai trò và 55 mã quyền theo ma trận ở `08` mục 3.
- Dịch vụ định danh: `login`, `refresh`, `logout`, `change-password`, `me`; băm mật khẩu argon2id; mã phiên ký Ed25519; mã làm mới đổi mới sau mỗi lần làm mới; tạm khóa 15 phút sau 5 lần sai; giới hạn 10 yêu cầu đăng nhập mỗi phút trên một địa chỉ mạng; mô hình lỗi kèm mã tương quan.
- Lệnh `create-platform-administrator` tạo tài khoản VT-01 đầu tiên; lệnh `generate-token-keys` sinh cặp khóa ký mã phiên.
- Kết quả: 19/19 kiểm thử của dịch vụ định danh đạt, gồm CTC-DD-001 đến 004, 007, 008, 009, 031 đến 034, 043; toàn bộ 24 kiểm thử của dự án đạt; kiểm tra kiểu, quy tắc viết mã, định dạng đạt.

#### Quyết định

- Không có quyết định mới ngoài YCTD-35.

#### Thay đổi

- `17` ghi giao kèo nhóm điểm cuối xác thực; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.2.

#### Vấn đề tồn đọng

- Kiểm thử để lại tài khoản kiểm thử trong cơ sở dữ liệu định danh của môi trường phát triển.
- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Kế hoạch đợt DT-01

#### Công việc đã thực hiện

- Đọc tài liệu cho đợt DT-01, phát hiện DT-01 phụ thuộc phần lõi dịch vụ định danh ở DT-02; trình Eric cách chia sáu phần.

#### Quyết định

- Gộp phần lõi dịch vụ định danh vào DT-01, làm theo sáu phần (YCTD-34) – người quyết định: Eric.
- QĐ-20, QĐ-21, QĐ-22 – người quyết định: Eric.
- Mật khẩu tối thiểu 8 ký tự có chữ và số; sai 5 lần tạm khóa 15 phút rồi tự mở; mã quyền theo phân hệ và hành động; tài khoản đầu tiên là VT-01 (YCTD-35) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-34, YCTD-35 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.26.0 đến 0.26.1.

#### Vấn đề tồn đọng

- Việc tiếp theo: trình thiết kế chi tiết DT-01 phần 1.

### 2026-10-09 — Qua cổng CG-08

#### Công việc đã thực hiện

- Eric đồng ý commit; đẩy nhánh `main` và `dt-00-nen-mong` lên GitHub sau khi Eric cấp quyền ghi.
- GitHub Actions chạy kiểm thử trên yêu cầu gộp số 1: đạt.
- Cài đặt sẵn công cụ `gh`; Eric đăng nhập bằng tài khoản `luckyshopvn`.
- Eric gộp yêu cầu gộp số 1 vào `main`. M01-3 hoàn thành, CG-08 đạt.

#### Quyết định

- Eric là người bấm gộp yêu cầu gộp vào `main` (QĐ-19).

#### Thay đổi

- Xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.25.5.

#### Vấn đề tồn đọng

- Việc tiếp theo: trình thiết kế đợt DT-01 (`M01`). Các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — M01-3 nền móng kỹ thuật

#### Công việc đã thực hiện

- Eric duyệt thiết kế DT-00. Khởi tạo Git tại gốc dự án, nối kho https://github.com/luckyshopvn/school_management, làm trên nhánh `dt-00-nen-mong`.
- Dựng cấu trúc nhiều gói bằng pnpm theo `13` mục 4: `apps/api`, `apps/identity`, `apps/worker`, `apps/portal`, `apps/teacher`, `apps/parent`, `packages/shared`, `packages/ui`, `packages/config`, `database/`.
- Docker Compose chạy PostgreSQL 17 và Redis 7; tệp `docker/postgres/create-databases.sh` tạo ba cơ sở dữ liệu `school_identity`, `school_system`, `school_year_2026_2027` với hai tài khoản kết nối riêng.
- Tệp thay đổi cấu trúc đầu tiên của ba cơ sở dữ liệu đặt giờ Việt Nam; chạy bằng Kysely.
- GitHub Actions chạy kiểm tra định dạng, kiểm tra quy tắc viết mã, xây dựng, kiểm tra kiểu, chạy tệp thay đổi cấu trúc và kiểm thử.
- Kết quả trên máy: xây dựng, kiểm tra kiểu, kiểm tra quy tắc viết mã, kiểm tra định dạng đạt; tệp thay đổi cấu trúc chạy được trên ba cơ sở dữ liệu; 6/6 kiểm thử đạt: kiểm tra sức khỏe của `api` và `identity`, tệp thay đổi cấu trúc chạy hai lần không lỗi và đặt giờ Việt Nam trên ba cơ sở dữ liệu, tiến trình chạy nền kết nối Redis.

#### Quyết định

- Dùng TypeScript 6.0, NestJS 11, Vite 8, ESLint 10; không dùng TypeScript 7 và NestJS 12 vì vừa phát hành và chưa được các công cụ kiểm tra hỗ trợ.

#### Thay đổi

- `17` thêm điểm cuối `GET /api/v1/health`; xem `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.25.4.

#### Vấn đề tồn đọng

- Chưa commit, chờ Eric đồng ý.

### 2026-10-09 — Lịch năm học

#### Công việc đã thực hiện

- Eric cho biết năm học gồm hai học kỳ, bắt đầu khoảng 05/09, kết thúc khoảng tháng 5 năm sau; hỏi bốn điểm và trình thiết kế YCTD-30.
- Áp dụng YCTD-30 vào các tài liệu liên quan và thêm 15 ca vào bộ ca kiểm thử chi tiết.

#### Quyết định

- Tuần học gồm tự đánh số tuần, tuần nghỉ, ngày học trong tuần – người quyết định: Eric.
- Có kỳ hè riêng, đăng ký học hè theo từng tháng – người quyết định: Eric.
- Số phiếu thu, phiếu chi đánh theo năm học – người quyết định: Eric.
- Hiệu trưởng lập lịch năm học chung toàn trường – người quyết định: Eric.
- Đăng ký học hè đặt ở P05-13 vì gắn với tính học phí.
- Bỏ xác thực hai lớp (YCTD-31) – người quyết định: Eric.
- Chỉ dùng GitHub trước; Eric tự tạo kho riêng; môi trường phát triển chạy Docker trên máy cục bộ; GitHub Actions chỉ chạy kiểm thử; hạ tầng đám mây khi triển khai (YCTD-32) – người quyết định: Eric.
- Kho mã nguồn https://github.com/luckyshopvn/school_management; dùng Kysely (QĐ-18); nhánh theo việc, gộp qua yêu cầu gộp (QĐ-19); commit đứng tên thư công ty của Eric (YCTD-33) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-30 đến YCTD-33 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.25.0 đến 0.25.3.

#### Vấn đề tồn đọng

- Việc tiếp theo: Eric cài Docker Desktop; sau đó M01-3 dựng nền móng DT-00 để qua CG-08. Các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — N21 bộ ca kiểm thử chi tiết

#### Công việc đã thực hiện

- Lập thư mục `27_BO_CA_KIEM_THU_CHI_TIET/`; viết đợt 1 `01_DINH_DANH_VA_P01.md`: 42 ca dịch vụ định danh, 98 ca P01, bảng truy xuất tiêu chí nghiệm thu.
- Phát hiện ba điểm căn cứ chưa rõ, ghi thành Q-147 đến Q-149, áp dụng câu trả lời theo YCTD-26.
- Viết đợt 2 `02_P02_VA_P04.md`: 68 ca P02, 43 ca P04, bảng truy xuất tiêu chí nghiệm thu.
- Viết đợt 3 `03_P05.md`: 62 ca P05; phát hiện Q-150, Q-151, áp dụng câu trả lời theo YCTD-27.
- Viết đợt 4 `04_P06.md`: 65 ca P06; phát hiện Q-152, áp dụng câu trả lời theo YCTD-28.
- Khi chuẩn bị đợt 5, Q-153 làm rõ lương trả trước đầu tháng; hỏi thêm Q-154 đến Q-156; trình và áp dụng YCTD-29.
- Viết đợt 5 `05_P08.md`: 59 ca P08 theo cách chi lương trả trước.

#### Quyết định

- Đợt 1 `01_DINH_DANH_VA_P01.md`, đợt 2 `02_P02_VA_P04.md`, đợt 3 `03_P05.md`, đợt 4 `04_P06.md` và đợt 5 `05_P08.md` phiên bản 1.0 được phê duyệt; N21 hoàn thành – người quyết định: Eric.
- N21 chỉ viết cho chức năng giai đoạn 1, đặt ở thư mục 27, mã `CTC-...`, chia năm đợt và duyệt từng đợt – người quyết định: Eric.
- Q-147: phụ huynh chưa đổi mật khẩu mặc định vẫn đăng nhập bằng mã một lần và dùng bình thường – người quyết định: Eric.
- Q-148: người được đặt lại mật khẩu bắt buộc đổi ở lần đăng nhập kế tiếp – người quyết định: Eric.
- Q-149: công nợ của trẻ đã thôi học không chuyển sang năm mới; chặn đóng năm khi còn nợ loại này – người quyết định: Eric.
- Q-150: đăng ký trễ thu theo ngày thực tế tính từ ngày bắt đầu học dịch vụ – người quyết định: Eric.
- Q-151: còn ngày chưa chốt điểm danh thì chặn tính học phí – người quyết định: Eric.
- Q-152: thủ quỹ chọn hóa đơn và phân bổ khi lập phiếu thu tiền mặt – người quyết định: Eric.
- YCTD-29: lương trả trước đầu tháng, điều chỉnh theo công tháng trước; tháng trước chưa chốt công thì chặn tính lương; nhân sự mới không trả trước tháng đầu; nghỉ việc lập bảng quyết toán; vẫn chặn chốt công khi còn đơn chờ duyệt (Q-153 đến Q-156) – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-26 đến YCTD-29 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.23.0 đến 0.24.1.

#### Vấn đề tồn đọng

- N21 hoàn thành. Việc tiếp theo: M01-3 tạo kho mã nguồn và ba môi trường để qua CG-08; các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — Rà duyệt từng tài liệu

#### Công việc đã thực hiện

- Rà `04_TONG_QUAN_DU_AN.md`: sửa cây đơn vị không giới hạn cấp, bỏ nhắc ứng lương, cập nhật nhóm đối tượng theo vai trò mới, cập nhật tích hợp bên ngoài.
- Rà `05_PHAM_VI.md`: bổ sung vào giai đoạn 1 các chức năng đã gắn G1 ở tài liệu 10 (G1-17 API cho đối tác, G1-18 nhập mã định danh, làm thêm giờ, hạn mức, năm học, chuyển đơn vị, nhật ký của bé); sửa đơn vị của trẻ theo QĐ-14; cập nhật mục chưa xác minh theo Q-02, Q-08, Q-09.
- Rà `06_YEU_CAU_NGHIEP_VU.md`: sửa cây đơn vị, QTN-03 theo BR-23, QTN-12 theo Q-09, thêm vai trò mới vào các nghiệp vụ, cập nhật mục chưa xác minh; phát hiện dịch vụ học thứ bảy mâu thuẫn với lịch học bù, áp dụng YCTD-16.
- Rà `07_QUY_TAC_NGHIEP_VU.md`: sửa BR-01, BR-03, BR-20, BR-24, BR-46, BR-53, BR-73, BR-77, trạng thái đơn nghỉ phép, mục chưa xác minh; sửa ma trận quyền phân hệ Y tế; đồng bộ phiên bản quy trình QT-01, QT-02, QT-04, QT-06 trong mục lục (mục lục ghi thấp hơn tệp).
- Rà `08_VAI_TRO_NGUOI_DUNG.md`: ma trận thêm quyền duyệt của quản lý đơn vị ở P02, P08 và quyền đăng nhập của VT-19, VT-20 ở P19; thêm ghi chú lịch nghỉ thứ 7, nhập dữ liệu ban đầu; PQ-03 và phạm vi toàn trường của VT-19, VT-20; bảng phê duyệt có ngoại lệ hoàn tiền; cập nhật mục chưa xác minh. BR-01 ở tài liệu 07 sửa theo.
- Rà `09_LUONG_NGHIEP_VU.md`: nhân sự chốt công; không chặn trẻ đi học khi nợ; đăng ký giữa tháng theo BR-26; LP-11, LP-12 gắn P13; mất mạng theo Q-09; sửa sơ đồ luồng; thêm thủ quỹ; cập nhật mục chưa xác minh.
- Rà `10_YEU_CAU_CHUC_NANG.md`: sửa người dùng, quy tắc và bước phê duyệt của P01-01, P01-08, P02-03, P02-08, P04-01, P05-02, P05-03, P05-07, P05-08, P06-01, P06-04, P06-05, P08-03, P08-04, P08-06, P08-08, P17-01, P18-01, P18-03, P19-01, P19-06; cập nhật mục chưa xác minh.
- Rà `11_TIEU_CHI_NGHIEM_THU.md`: sửa AC-26, AC-29, AC-41, AC-43, AC-58, AC-89, AC-147, AC-166, AC-180; thêm AC-206 đến AC-209 và CT-162 đến CT-165; phát hiện công thức suất ăn trừ hai lần, áp dụng YCTD-20.
- Rà `12_KIEN_TRUC_HE_THONG.md`: định danh dùng cơ sở dữ liệu riêng; sơ đồ thêm đối tác, cơ sở dữ liệu theo năm học và cơ sở dữ liệu định danh; phạm vi đơn vị theo YCTD-18; nhật ký nhạy cảm theo BR-73; thêm CB-09, CB-10; sao lưu gồm mọi cơ sở dữ liệu; cập nhật mục chưa xác minh.
- Rà `13_CONG_NGHE_SU_DUNG.md`: đổi tên mục 2 thành công nghệ đã chốt; tách thư mục `database/` theo định danh và năm học; thêm QU-11; cập nhật mục chưa xác minh.
- Rà `14_DAC_TA_GIAO_DIEN.md`: sửa vai trò ở MH-05, MH-07, MH-09, MH-10, MH-11, MH-13, MH-15, MH-28, MH-29, MH-30; MH-32 theo QĐ-14; đặt nhập mã ngành, buffet, đồng ý hình ảnh vào màn hình sẵn có; sửa BC-01, BC-08, XL-05; bỏ mục xe trong sơ đồ; cập nhật mục chưa xác minh.
- Rà `15_HE_THONG_THIET_KE.md`: nâng mọi cỡ chữ lên tối thiểu 14 theo Q-89; ghi mức tương phản 4,5:1; nút chính nền cam dùng chữ tối; thêm TD-16, TD-17, MC-06; TD-14 theo Q-119; cập nhật mục chưa xác minh.
- Rà `16_CO_SO_DU_LIEU.md`: phân ba loại cơ sở dữ liệu; giữ nguyên mã khi mở năm học; thêm `sessions`, `one_time_codes`, `class_staff_assignments`, `teaching_groups`, `teaching_group_members`; thêm cột cho trẻ con nhân viên, phiếu chi, nhật ký truy cập; hóa đơn chính và bổ sung; bỏ bảng trống ở mục P11; cập nhật mục chưa xác minh.
- Rà `17_DAC_TA_API.md`: thêm điểm cuối duyệt và từ chối giảm trừ, phiếu điều chỉnh, mở lại kỳ công, đề nghị mua hàng, hồ sơ tuyển sinh; thêm điểm cuối phân công giáo viên, tổ chuyên môn, đề nghị mua thuốc, phỏng vấn, ẩn bình luận; ghi khóa API do dịch vụ định danh quản lý; thêm KT-09; bỏ bảng trống mục xe; cập nhật mục chưa xác minh.
- Rà `18_QUY_TAC_PHAT_TRIEN_AI.md`: thêm AI-41 về cơ sở dữ liệu theo năm học, AI-42 về quyết định kiến trúc; AI-13 dẫn BR-81; mục 6 dùng tên trạng thái của quy trình; AI-10 bỏ từ tiếng Anh.
- Rà `19_CHI_DAN_HE_THONG_AI.md`: cập nhật ngữ cảnh theo QĐ-14 đến QĐ-17 và thư mục 26; câu lệnh hệ thống bỏ từ tiếng Anh, thêm ngoại lệ hạn mức và nguyên tắc 17; bảng quy ước mã bỏ dạng không dùng và thêm mười bốn nhóm tiền tố.
- Rà `20_KE_HOACH_KIEM_THU.md`: thêm PV-13 đến PV-15 cho API đối tác, cơ sở dữ liệu theo năm học, nhập dữ liệu; bổ sung phạm vi đăng nhập, thanh toán mã QR, công việc, tuyển dụng; dữ liệu kiểm thử theo GD-79 và thêm DL-11 đến DL-13; đưa câu trả lời Q-101 đến Q-104 vào nội dung; bỏ mục chưa xác minh đã lỗi thời.
- Rà `21_KICH_BAN_KIEM_THU.md`: sửa CT-007, CT-021, CT-031, CT-049, CT-067, CT-082, CT-089, CT-150 cho khớp quy tắc và tiêu chí nghiệm thu; thêm AC-211 và CT-167 cho khóa API đã thu hồi; AC-194 thêm giữ nguyên mã định danh, tài liệu 11 lên phiên bản 1.1; cập nhật mục chưa xác minh.
- Rà `22_BAO_MAT.md`: BM-17 thêm Ban Giám hiệu theo BR-53; chuyển BM-61 đến BM-69 khỏi mục giám sát về đúng mục; BM-05 ghi thời hạn phiên theo Q-120; BM-19 ghi hai trường hợp luôn ghi nhật ký; BM-42 khớp SL-01 đến SL-04; SL-01 thêm cơ sở dữ liệu hệ thống, tài liệu 12 lên phiên bản 1.1; thêm BM-70 thời hạn lưu nhật ký và dòng trách nhiệm bên thứ ba; bỏ mục chưa xác minh đã lỗi thời.
- Rà `23_LICH_SU_PHIEN_BAN.md`: hạ cấp tiêu đề các mục phiên bản từ 0.4.0; quy ước 2 dùng tên mục "thay đổi API"; quy ước 5 ghi lý do giữ tên tệp cũ; `index.md` sửa phạm vi tài liệu 24 thành YCTD-01 đến YCTD-22.
- Rà `01_KE_HOACH_TONG_THE.md`: cập nhật mô tả sản phẩm, mốc 1.0.0 và 1.1.0, trạng thái cổng, phạm vi mã; tên trạng thái theo quy trình; bỏ nội dung chờ duyệt và mục chưa xác minh đã lỗi thời; xếp năm chức năng giai đoạn 1 mới vào đợt; RR-07 theo kịch bản hiệu năng của tài liệu 20.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-01_TIEP_NHAN_TRE_MOI.md`: bước 2 nhập số định danh, giấy khai sinh và từ chối trùng số định danh khi lưu; số điện thoại đã có tài khoản thì gắn phụ huynh có sẵn theo BR-08, thay cho chặn; bỏ chữ kích hoạt tài khoản và quy trình tiếp nhận lại không tồn tại; thêm AC-201.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-02_DIEM_DANH_BAO_VANG.md`: BR-56 chép đủ vế phụ huynh xác nhận người đón ngoài danh sách, sửa E6 và sơ đồ; thêm ngày học bù thứ 7 theo BR-84; thêm Ban Giám hiệu vào tác nhân; gộp dòng dữ liệu trùng, thêm ảnh bàn giao tùy chọn; quản lý đơn vị được chốt và sửa sau chốt, tài liệu 08 thêm ghi chú 15 và lên phiên bản 1.1.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-03_DANG_KY_DICH_VU_VA_TINH_HOC_PHI.md`: đăng ký trễ chờ Ban Giám hiệu duyệt và lập hóa đơn bổ sung cùng kỳ thay cho phát sinh kỳ sau; AC-29 chép theo bản đã sửa; biểu phí dùng chung toàn trường; thêm kiểm tra bán trú bắt buộc và chặn khi nợ quá hạn; quản lý đơn vị chỉ xem; Hiệu trưởng duyệt khi chưa cấu hình hạn mức; ràng buộc chống trùng áp cho hóa đơn chính.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-04_THU_HOC_PHI_VA_CONG_NO.md`: thêm thủ quỹ; luồng lỗi thanh toán mã QR E10, E11 và AC-186 đến AC-189; nhắc nợ ghi rõ giai đoạn 2; phiếu đảo chờ Ban Giám hiệu duyệt; xử lý công nợ quá hạn qua P05-12 (YCTD-23).
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-05_PHIEU_CHI_VA_QUY.md`: AC-37 theo BR-34 bắt buộc; thêm thủ quỹ và kế toán trưởng lập phiếu; phiếu chi hoàn tiền và loại chưa cấu hình hạn mức do Hiệu trưởng duyệt; phiếu đảo phiếu chi chờ Ban Giám hiệu duyệt (YCTD-24); thêm loại phiếu chi, khoản mục, nhiều quỹ; ghi rõ giai đoạn của từng phần.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-06_CHAM_CONG_VA_TINH_LUONG.md`: thêm tiền làm thêm giờ vào bước tính lương; nhân sự đề nghị và Ban Giám hiệu duyệt mở lại kỳ công; chốt công áp lịch nghỉ lễ, nghỉ thứ 7 và học bù (BR-84); phiếu chi loại lương trình duyệt theo QT-05; Hiệu trưởng duyệt khi chưa cấu hình hạn mức; thêm MH-44; chép AC-41, AC-43, AC-46 theo bản mới.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-07_DAN_THUOC_VA_CHAM_SOC_SUC_KHOE.md`: áp dụng YCTD-25: giáo viên chủ nhiệm nhận thuốc khi đơn vị không có nhân viên y tế, ảnh thuốc bắt buộc, chăm sóc hằng ngày P10-12, phụ huynh xác nhận đã biết; thêm Ban Giám hiệu vào tác nhân; GD-32 không còn hiệu lực.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-09_NHAT_KY_VA_TRAO_DOI.md`: bỏ chữ kích hoạt tài khoản; ghi nhật ký thuộc giai đoạn 1, trao đổi và góp ý thuộc giai đoạn 2; quản lý đơn vị sửa nhật ký quá hạn theo Q-67, ghi chú 15 của tài liệu 08 mở rộng và lên phiên bản 1.4.
- Rà `25_QUY_TRINH_NGHIEP_VU/QT-10_HOAT_DONG_VA_CONG_BO.md`: Ban Giám hiệu duyệt, ẩn và công bố lại hoạt động theo ma trận và Q-72, P14-02 thêm VT-15, VT-02; ẩn bình luận vi phạm kèm lý do (Q-70); tự ẩn hình khi phụ huynh rút đồng ý (BR-65, AC-190); giới hạn ảnh theo Q-71; ghi giai đoạn; tài liệu 17 thêm điểm cuối ẩn và công bố lại hoạt động.

#### Quyết định

- `04_TONG_QUAN_DU_AN.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `05_PHAM_VI.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `06_YEU_CAU_NGHIEP_VU.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- Bỏ dịch vụ học thứ bảy; thứ bảy chỉ có lịch học bù chung toàn trường do Ban Giám hiệu lập – người quyết định: Eric (YCTD-16).
- `07_QUY_TAC_NGHIEP_VU.md` phiên bản 1.0 được phê duyệt; dữ liệu sức khỏe chỉ cho giáo viên chủ nhiệm, y tế, Ban Giám hiệu, quản lý đơn vị, kế toán và phụ huynh; hoàn tiền khi trẻ thôi học luôn do Hiệu trưởng phê duyệt – người quyết định: Eric (YCTD-17).
- `08_VAI_TRO_NGUOI_DUNG.md` phiên bản 1.0 được phê duyệt; kiểm toán viên luôn xem số liệu toàn trường (Q-145) – người quyết định: Eric (YCTD-18).
- `09_LUONG_NGHIEP_VU.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `10_YEU_CAU_CHUC_NANG.md` phiên bản 1.0 được phê duyệt; phiếu chi và quỹ tiền mặt chuyển sang giai đoạn 1 – người quyết định: Eric (YCTD-19).
- `11_TIEU_CHI_NGHIEM_THU.md` phiên bản 1.0 được phê duyệt; trường không có bữa tối; ba bữa sáng, trưa, xế thuộc bán trú; số suất bằng số trẻ có mặt; buffet là tiệc theo dịp không thu riêng – người quyết định: Eric (YCTD-20).
- `12_KIEN_TRUC_HE_THONG.md` phiên bản 1.0 được phê duyệt; chốt QĐ-01, QĐ-03, QĐ-05 – người quyết định: Eric.
- `13_CONG_NGHE_SU_DUNG.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `14_DAC_TA_GIAO_DIEN.md` phiên bản 1.0 được phê duyệt; nhân sự tự phục vụ ở cả hai kênh, thêm MH-44 (Q-146) – người quyết định: Eric (YCTD-21).
- `15_HE_THONG_THIET_KE.md` phiên bản 1.0 được phê duyệt; mọi cỡ chữ tối thiểu 14 điểm ảnh – người quyết định: Eric.
- `16_CO_SO_DU_LIEU.md` phiên bản 1.0 được phê duyệt; khoản phát sinh sau phát hành lập hóa đơn bổ sung cùng kỳ (BR-85); khóa API đặt ở cơ sở dữ liệu định danh, danh sách năm học đặt ở cơ sở dữ liệu hệ thống (QĐ-17) – người quyết định: Eric (YCTD-22).
- `17_DAC_TA_API.md` phiên bản 1.0 được phê duyệt; không thêm chức năng tự lấy lại mật khẩu – người quyết định: Eric.
- `18_QUY_TAC_PHAT_TRIEN_AI.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `19_CHI_DAN_HE_THONG_AI.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `20_KE_HOACH_KIEM_THU.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `21_KICH_BAN_KIEM_THU.md` phiên bản 1.0 được phê duyệt; thêm ca kiểm thử khóa API đã thu hồi – người quyết định: Eric.
- `22_BAO_MAT.md` phiên bản 1.0 được phê duyệt – người quyết định: Eric.
- `23_LICH_SU_PHIEN_BAN.md` đã rà duyệt, giữ trạng thái Đang cập nhật theo quy định của `index.md` – người quyết định: Eric.
- `01_KE_HOACH_TONG_THE.md` phiên bản 1.0 được phê duyệt; G1-15 đến G1-19 xếp vào DT-00, DT-03, DT-05, DT-06, DT-07 theo phân hệ; kiểm thử hiệu năng theo dữ liệu môi trường thử nghiệm của tài liệu 20, không dùng dữ liệu gấp năm lần – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-01_TIEP_NHAN_TRE_MOI.md` phiên bản 1.3 được phê duyệt; phụ huynh nhiều con dùng một tài khoản – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-02_DIEM_DANH_BAO_VANG.md` phiên bản 1.4 được phê duyệt; quản lý đơn vị được chốt điểm danh ngày và sửa điểm danh đã chốt kèm lý do, ma trận P04 của VT-03 thành X, S – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-03_DANG_KY_DICH_VU_VA_TINH_HOC_PHI.md` phiên bản 1.7 được phê duyệt – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-04_THU_HOC_PHI_VA_CONG_NO.md` phiên bản 1.3 được phê duyệt; phiếu đảo phiếu thu do Ban Giám hiệu duyệt theo hạn mức; xử lý công nợ quá hạn do Ban Giám hiệu quyết, thêm P05-12 ở giai đoạn 2 (YCTD-23) – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-05_PHIEU_CHI_VA_QUY.md` phiên bản 1.2 được phê duyệt; phiếu đảo phiếu chi do Ban Giám hiệu duyệt theo hạn mức (YCTD-24) – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-06_CHAM_CONG_VA_TINH_LUONG.md` phiên bản 1.4 được phê duyệt – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-07_DAN_THUOC_VA_CHAM_SOC_SUC_KHOE.md` phiên bản 1.2 được phê duyệt; bổ sung nội dung gửi thuốc và chăm sóc sức khỏe theo YCTD-25, giữ giai đoạn 2: giáo viên nhận thuốc theo cấu hình đơn vị, ảnh thuốc bắt buộc và đơn tùy chọn, chăm sóc hằng ngày, phụ huynh xác nhận đã biết chỉ hiển thị trạng thái – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-09_NHAT_KY_VA_TRAO_DOI.md` phiên bản 1.1 được phê duyệt – người quyết định: Eric.
- `25_QUY_TRINH_NGHIEP_VU/QT-10_HOAT_DONG_VA_CONG_BO.md` phiên bản 1.1 được phê duyệt; hoàn tất rà duyệt các đặc tả QT, CG-03 đạt – người quyết định: Eric.

#### Thay đổi

- `04_TONG_QUAN_DU_AN.md`, `05_PHAM_VI.md`, `06_YEU_CAU_NGHIEP_VU.md`, `index.md`.
- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-16 đến YCTD-25 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.13.0 đến 0.22.2.

#### Vấn đề tồn đọng

- Rà duyệt toàn bộ tài liệu đã xong; CG-01 đến CG-07 đã đạt.
- Việc tiếp theo: N21 viết bộ ca kiểm thử chi tiết; M01-3 tạo kho mã nguồn và ba môi trường để qua CG-08; các việc cần tài khoản ngoài T1, T5 đến T8.

### 2026-10-09 — Xử lý hết giả định

#### Công việc đã thực hiện

- N22: hỏi Eric năm lượt (lượt 17 đến lượt 21) về giả định và các điểm cần làm rõ; cập nhật trạng thái toàn bộ 92 giả định; áp dụng các quyết định mới.
- Kiểm tra bằng truy vấn văn bản: không còn câu hỏi mở, không còn giả định chờ xác nhận, không còn quy tắc ghi chờ xác nhận; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Nhân sự chốt công; bán trú bắt buộc; đăng ký trễ do Ban Giám hiệu duyệt; trẻ nhận diện bằng số định danh và mã ngành; tài khoản phụ huynh dùng mật khẩu mặc định chung; không chia mốc trong ngày – người quyết định: Eric (YCTD-15).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-15 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.12.0.

#### Vấn đề tồn đọng

- Eric phê duyệt bộ tài liệu `04` đến `23` để qua các cổng CG-01 đến CG-07 – trạng thái: chờ xác nhận.
- N21: viết bộ ca kiểm thử chi tiết cho bốn nhóm phân hệ – trạng thái: chưa bắt đầu.
- RR-14: mật khẩu mặc định chung là rủi ro bảo mật đã được ghi nhận – trạng thái: chấp nhận theo quyết định của Eric.

### 2026-10-09 — Trả lời toàn bộ câu hỏi mở

#### Công việc đã thực hiện

- N20: hỏi Eric tám lượt (lượt 9 đến lượt 16), dùng hình thức tích chọn đề xuất cho các câu có đề xuất hợp lý và hỏi riêng các câu không được chọn; áp dụng câu trả lời vào toàn bộ bộ tài liệu.
- Sự cố khi chạy script phần A: lệnh khôi phục tự động xóa nội dung thư mục `tai_lieu` nhưng không chép lại được vì thư mục đang được dùng. Đã chép lại từ bản sao lưu ngay trước khi chạy, đối chiếu khớp hoàn toàn rồi chạy lại. Đã đổi cách chạy: script chạy trong tiến trình con và khôi phục chỉ xóa nội dung bên trong thư mục.
- Kiểm tra bằng truy vấn văn bản: không còn câu hỏi mở; không còn tham chiếu xe đưa đón ngoài các dòng ghi đã bỏ; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Bỏ phân hệ xe đưa đón; thêm năm vai trò; cây đơn vị không giới hạn cấp; mỗi năm học một cơ sở dữ liệu; API chỉ đọc cho đối tác ngay giai đoạn 1; tiền làm thêm giờ tối đa 1 giờ mỗi ngày; AI phải xin xác nhận trước mọi thay đổi mã nguồn; cùng các quyết định khác ở YCTD-14 – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-14 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.11.0.

#### Vấn đề tồn đọng

- 85 giả định chưa xác nhận – trạng thái: chờ xác nhận.
- N21: viết bộ ca kiểm thử chi tiết cho bốn nhóm phân hệ – trạng thái: chưa bắt đầu.

### 2026-10-09 — Chốt các quyết định lượt 8

#### Công việc đã thực hiện

- N19: áp dụng câu trả lời lượt 8; bỏ chức năng ứng lương theo yêu cầu, giữ mã kèm ghi chú; cập nhật quy tắc quỹ tiền mặt, đồng ý hình ảnh, số định danh của trẻ.
- Kiểm tra bằng truy vấn văn bản: không còn tham chiếu ứng lương ngoài các dòng ghi "Bỏ ngày 09/10/2026"; đếm lại câu hỏi mở, giả định, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Không cho ứng lương; lương trả một lần mỗi tháng – người quyết định: Eric (Q-54, Q-56).
- Quỹ tiền mặt không âm, bắt buộc – người quyết định: Eric (Q-19).
- Đồng ý hình ảnh trên ứng dụng hoặc giấy ký tay, rút lại được – người quyết định: Eric (Q-20).
- Lưu số định danh và giấy khai sinh của trẻ, che với vai trò không cần – người quyết định: Eric (Q-35, Q-37).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-13 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.10.0.

#### Vấn đề tồn đọng

- GD-88, GD-89 mới – trạng thái: chờ xác nhận.
- 76 câu hỏi mở và 84 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định lượt 6 và lượt 7

#### Công việc đã thực hiện

- N18: áp dụng câu trả lời lượt 6 và lượt 7; thêm P01-13, P06-11 cùng dữ liệu, điểm cuối, màn hình, biện pháp bảo mật, tiêu chí và ca kiểm thử; đổi quy tắc thu tiền sang luôn trả đủ.
- Kiểm tra bằng truy vấn văn bản: đếm lại chức năng, bảng, màn hình, câu hỏi mở, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Nhập dữ liệu ban đầu từ Excel ở giai đoạn 1 – người quyết định: Eric (Q-02).
- Zalo để giai đoạn 3 – người quyết định: Eric (Q-05).
- Mốc nhắc nợ mặc định 3, 7, 15 ngày, cấu hình được – người quyết định: Eric (Q-11, Q-45).
- Thanh toán trực tuyến bằng chuyển khoản mã QR có xác nhận tự động ở giai đoạn 1 – người quyết định: Eric (Q-48, Q-81).
- Luôn phải trả đủ – người quyết định: Eric (Q-47).
- Quản lý đơn vị không xem bảng lương – người quyết định: Eric (Q-23).
- Hiệu trưởng và kế toán trưởng cùng nghiệm thu – người quyết định: Eric (Q-129).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-12 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.9.0.

#### Vấn đề tồn đọng

- Q-142: chọn nhà cung cấp tin nhắn và dịch vụ xác nhận chuyển khoản; cần trước khi nghiệm thu P19-06 và P06-11 – trạng thái: chờ xác nhận.
- 82 câu hỏi mở và 82 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định lượt 4 và lượt 5

#### Công việc đã thực hiện

- N16: áp dụng câu trả lời lượt 4 và lượt 5; đổi điểm danh sang một lần mỗi ngày trên toàn bộ tài liệu; thêm đăng nhập bằng mã một lần cho phụ huynh; chốt hạ tầng và nơi lưu mã nguồn.
- Kiểm tra bằng truy vấn văn bản: không còn tham chiếu điểm danh theo buổi; đếm lại câu hỏi mở, giả định, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Git trên GitHub kèm tích hợp và triển khai tự động từ đợt DT-00 – người quyết định: Eric (Q-130).
- Máy chủ đám mây trong nước, dữ liệu lưu tại Việt Nam – người quyết định: Eric (Q-74, Q-76).
- Phụ huynh đăng nhập bằng mật khẩu hoặc mã một lần – người quyết định: Eric (Q-24, Q-117).
- Ứng dụng phụ huynh và giáo viên dạng web ở giai đoạn 1 – người quyết định: Eric (Q-04).
- Điểm danh một lần mỗi ngày – người quyết định: Eric (Q-38).
- Đi muộn hoặc về sớm vẫn tính đủ ngày ăn – người quyết định: Eric (Q-39).
- Chốt công và học phí ngày cuối tháng – người quyết định: Eric (Q-25).
- Chặn đăng ký dịch vụ khi nợ quá hạn cấu hình theo đơn vị – người quyết định: Eric (Q-27, Q-46).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-11 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.8.0.

#### Vấn đề tồn đọng

- T1: chọn nhà cung cấp tin nhắn, cần cho thông báo và đăng nhập bằng mã một lần – trạng thái: chờ xác nhận.
- T6: thuê máy chủ đám mây trong nước – trạng thái: chờ xác nhận.
- 93 câu hỏi mở và 82 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định lượt 3

#### Công việc đã thực hiện

- N15: áp dụng câu trả lời lượt 3; thêm P05-11, P08-11 cùng bảng dữ liệu, điểm cuối, tiêu chí nghiệm thu và ca kiểm thử.
- Kiểm tra bằng truy vấn văn bản: đếm lại câu hỏi mở, chức năng, bảng, tiêu chí, ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Sổ kế toán kép theo chế độ kế toán hành chính, sự nghiệp – người quyết định: Eric (Q-140).
- Học phí chính khóa cấu hình được, mức có thể bằng không – người quyết định: Eric (Q-141).
- Mức miễn giảm do nhà trường tự cấu hình – người quyết định: Eric (Q-16).
- Danh mục khấu trừ và số ngày phép năm do nhà trường tự cấu hình – người quyết định: Eric (Q-17, Q-18).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-10 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.7.0.

#### Vấn đề tồn đọng

- Không còn việc xây dựng nào bị chặn bởi câu hỏi nghiệp vụ. Còn 105 câu hỏi mở, 85 giả định chưa xác nhận và việc Eric phê duyệt bộ tài liệu – trạng thái: chờ xác nhận.
- Q-130: hệ thống quản lý phiên bản mã nguồn – trạng thái: chờ xác nhận.

### 2026-10-09 — Chốt các quyết định ưu tiên lượt 1 và lượt 2

#### Công việc đã thực hiện

- N14: hỏi Eric hai lượt câu hỏi ưu tiên, áp dụng câu trả lời vào quy tắc nghiệp vụ, phạm vi, kiến trúc, công nghệ, dữ liệu, quy trình QT-02, QT-03, QT-05, kế hoạch tổng thể và danh sách công việc.
- Kiểm tra bằng truy vấn văn bản: đếm lại câu hỏi mở và giả định; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Phương án lưu trữ A – người quyết định: Eric (Q-77).
- Bộ công nghệ đề xuất – người quyết định: Eric (Q-79).
- Học phí giữa tháng theo ngày học thực tế – người quyết định: Eric (Q-14, Q-41).
- Lập sổ kế toán kép ở giai đoạn 3 – người quyết định: Eric (Q-01, Q-51).
- Chưa đặt mức hạn mức, cấu hình sau – người quyết định: Eric (Q-112, Q-26).
- Nhà trường tự tạo cây đơn vị; các đơn vị dùng chung biểu phí – người quyết định: Eric (Q-113, Q-122).
- Tiền ăn thu theo ngày ăn thực tế – người quyết định: Eric (Q-15, Q-43).
- Đồng ý cách xếp ba giai đoạn – người quyết định: Eric (Q-07).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-09 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.6.0.

#### Vấn đề tồn đọng

- Q-140: sổ kế toán kép theo chế độ kế toán nào; trường công lập thường áp dụng chế độ kế toán hành chính, sự nghiệp, khác Thông tư 99/2025/TT-BTC dành cho doanh nghiệp – trạng thái: chờ xác nhận.
- Q-16: mức miễn giảm và thẩm quyền, đang chặn M05 – trạng thái: chờ xác nhận.
- Q-17, Q-18: danh mục khấu trừ và số ngày phép năm, đang chặn M08 – trạng thái: chờ xác nhận.

### 2026-10-09 — Trả lời Q-139 và xác nhận GD-86

#### Công việc đã thực hiện

- N13: cập nhật P14-11; thêm AC-175, CT-131; đánh dấu GD-86 đã xác nhận.
- Kiểm tra bằng truy vấn văn bản: không có lỗi bảng, liên kết hỏng hay khối mã lẻ; đếm lại câu hỏi mở và giả định.

#### Quyết định

- Phí ngoại khóa thu theo tháng không giảm trừ khi trẻ nghỉ buổi hoặc thôi giữa tháng – người quyết định: Eric (Q-139).
- Lịch nghỉ thứ 7 và lịch học bù áp dụng cho mọi nhân sự của đơn vị – người quyết định: Eric (GD-86).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-08 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.3.

#### Vấn đề tồn đọng

- 126 câu hỏi mở và 85 giả định chưa xác nhận – trạng thái: chờ xác nhận.

### 2026-10-09 — Bổ sung điểm cuối cho phân hệ Giảng dạy

#### Công việc đã thực hiện

- N12: thêm mục 7 Giảng dạy với mười tám điểm cuối vào `17_DAC_TA_API.md`; thêm bảng `class_activity_schedules` cho P03-07.
- Kiểm tra bằng truy vấn văn bản: không có lỗi bảng, liên kết hỏng hay khối mã lẻ; không tài liệu nào trỏ tới số mục cũ từ 7 trở đi của `17_DAC_TA_API.md`.

#### Quyết định

- Bổ sung điểm cuối cho phân hệ Giảng dạy – người quyết định: Eric (YCTD-07).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-07 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.2.

#### Vấn đề tồn đọng

- Q-139 và GD-86 – trạng thái: chờ xác nhận.
- Vấn đề thiếu điểm cuối P03 ghi ở hai mục nhật ký trước – trạng thái: đã xử lý.

### 2026-10-09 — Áp dụng câu trả lời Q-136 đến Q-138

#### Công việc đã thực hiện

- N11: cập nhật P08-10, P10-11, P14-10, P14-11 cùng dữ liệu, tiêu chí nghiệm thu và ca kiểm thử liên quan.
- Kiểm tra bằng truy vấn văn bản: đếm lại mã câu hỏi, giả định, tiêu chí và ca kiểm thử; không có lỗi bảng, liên kết hỏng hay khối mã lẻ.

#### Quyết định

- Tiêu chuẩn sức khỏe theo Bộ Y tế – người quyết định: Eric (Q-136).
- Hoạt động ngoại khóa thu phí theo từng hoạt động hoặc theo tháng – người quyết định: Eric (Q-137).
- Nghỉ thứ bảy định kỳ, trừ lịch học bù – người quyết định: Eric (Q-138).

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-06 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.1.

#### Vấn đề tồn đọng

- Q-139: phí ngoại khóa theo tháng có giảm trừ khi trẻ nghỉ không – trạng thái: chờ xác nhận.
- GD-86: lịch nghỉ thứ 7 và học bù áp dụng cho mọi nhân sự của đơn vị – trạng thái: chờ xác nhận.
- `17_DAC_TA_API.md` chưa có nhóm điểm cuối cho phân hệ P03 Giảng dạy – trạng thái: chờ xác nhận.

### 2026-10-09 — Bổ sung chức năng theo tám ảnh sơ đồ chức năng

#### Công việc đã thực hiện

- N10: đối chiếu tám ảnh sơ đồ chức năng với danh sách chức năng, tìm ra mười hai nhóm mục còn thiếu; bổ sung hai mươi chức năng cùng tiêu chí nghiệm thu, ca kiểm thử, bảng dữ liệu, điểm cuối, màn hình và phạm vi.
- N10: lưu tám ảnh vào `26_SO_DO_CHUC_NANG/`.
- N10: sửa số liệu ghi nhầm về số chức năng và số bảng dữ liệu.
- Kiểm tra bằng truy vấn văn bản: đếm lại chức năng, bảng, màn hình, mã câu hỏi và giả định; không có liên kết hỏng, hàng bảng thiếu dấu `|`, khối mã lẻ.

#### Quyết định

- Bổ sung cả mười hai nhóm mục từ ảnh vào phạm vi, theo giai đoạn đề xuất – người quyết định: Eric (YCTD-05).
- Lưu tám ảnh sơ đồ chức năng vào dự án – người quyết định: Eric.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-05 và `23_LICH_SU_PHIEN_BAN.md` phiên bản 0.5.0.

#### Vấn đề tồn đọng

- Q-136, Q-137, Q-138 – trạng thái: chờ xác nhận.
- `17_DAC_TA_API.md` chưa có nhóm điểm cuối cho phân hệ P03 Giảng dạy (bài học, giáo án, thời khóa biểu) – trạng thái: chờ xác nhận.

### 2026-10-09 — Chuyển sang quy trình Vibecoding_Flow và sửa các chỗ chưa khớp

#### Công việc đã thực hiện

- N9: chuyển bộ tài liệu từ `tai-lieu-thiet-ke/` sang `tai_lieu/`, đổi tên và đánh số lại theo Vibecoding_Flow, đổi phần đầu tài liệu sang mẫu mới, gộp mục lục quy trình vào `index.md`, tạo `24_YEU_CAU_THAY_DOI.md`.
- N9: sửa các chỗ chưa khớp: thuật ngữ cũ trong sơ đồ, số câu hỏi mở và giả định cũ, trạng thái mốc 0.3.0, số ứng dụng giao diện trong `13_CONG_NGHE_SU_DUNG.md`, bảng trỏ tới AC-94 đến AC-134 trong `11_TIEU_CHI_NGHIEM_THU.md`.
- N9: thống nhất phân cấp phê duyệt theo quyết định của Eric.
- Kiểm tra bằng truy vấn văn bản: không còn tên tệp cũ ngoài các mục lịch sử và bảng đối chiếu; không còn thuật ngữ "cơ sở" theo nghĩa đơn vị và "Chủ trường"; không có liên kết hỏng, hàng bảng thiếu dấu `|`, khối mã lẻ; có đủ 135 mã câu hỏi mở, sáu mã đã trả lời; đủ 84 giả định.

#### Quyết định

- Chuyển bộ tài liệu sang cấu trúc Vibecoding_Flow – người quyết định: Eric (YCTD-01).
- Chỉ Ban Giám hiệu phê duyệt chứng từ theo hạn mức; kế toán trưởng không nằm trong luồng phê duyệt, chỉ chốt kỳ tài chính – người quyết định: Eric (YCTD-02).
- Mã dự án đổi từ SKG thành SM – người quyết định: Eric (YCTD-03, trả lời Q-132).
- Chốt kỳ tài chính do kế toán trưởng đề nghị, Hiệu trưởng phê duyệt; quản lý đơn vị không phê duyệt chứng từ thuộc danh mục hạn mức; Ban Giám hiệu phê duyệt mở lại kỳ công – người quyết định: Eric (YCTD-04, trả lời Q-133 đến Q-135).

#### Thay đổi

- Toàn bộ bộ tài liệu: đổi tên tệp theo bảng đối chiếu ở `24_YEU_CAU_THAY_DOI.md` YCTD-01; cập nhật mọi tham chiếu, trừ các mục lịch sử.
- `07_QUY_TAC_NGHIEP_VU.md`: ghi rõ chỉ Ban Giám hiệu phê duyệt chứng từ thuộc danh mục hạn mức; Hiệu trưởng phê duyệt chốt kỳ tài chính; thêm và trả lời Q-133, Q-134.
- `08_VAI_TRO_NGUOI_DUNG.md`: VT-05 mất quyền phê duyệt, thêm ghi chú 8; VT-03 chỉ phê duyệt việc không có giá trị tiền; bảng phân cấp phê duyệt mục 5 viết lại.
- `10_YEU_CAU_CHUC_NANG.md` P06-09, `16_CO_SO_DU_LIEU.md` bảng `fiscal_periods`, `17_DAC_TA_API.md` điểm cuối chốt kỳ: theo luồng đề nghị và phê duyệt chốt kỳ.
- `QT-03`, `QT-04`, `QT-05`, `QT-06` lên phiên bản 1.1: bỏ kế toán trưởng khỏi luồng phê duyệt; QT-06 thêm và trả lời Q-135; QT-05 trả lời Q-49.
- `11_TIEU_CHI_NGHIEM_THU.md` AC-35, `21_KICH_BAN_KIEM_THU.md` CT-038, `14_DAC_TA_GIAO_DIEN.md` MH-10: theo luồng phê duyệt mới.
- `04_TONG_QUAN_DU_AN.md`, `QT-01` GD-20: mã dự án SM.
- `23_LICH_SU_PHIEN_BAN.md`: thêm phiên bản 0.4.0.

#### Vấn đề tồn đọng

- Q-06: cần Eric xem lại sơ đồ chức năng để xác nhận "hình tổ màu" có phải "hình tô màu" ở P14-09 – trạng thái: chờ xác nhận. Bốn ảnh sơ đồ chức năng không có trong thư mục dự án.
- Ghi chú của công cụ khác trong `.workbuddy-ai/` vẫn trỏ đường dẫn `tai-lieu-thiet-ke/` cũ – trạng thái: chờ xác nhận có cần cập nhật không.

### 2026-10-09 — Đổi tên dự án thành School Management

**Người thực hiện:** Minh

**Nội dung:**

- Đổi tên dự án từ Sun KinderGarten thành School Management theo yêu cầu của Eric, để khớp với tên thư mục gốc `D:\School_Management`.
- Thay thế toàn bộ 43 chỗ ghi tên cũ trên 36 tệp, gồm hai mươi bốn dòng tiêu đề "Dự án:", phần thân của `01_Tong_quan_du_an.md`, `16_Cau_lenh_he_thong_AI.md` và `21_Ke_hoach_tong_the_du_an.md`, cùng cây thư mục mã nguồn dự kiến trong `10_Cong_nghe_su_dung.md`.
- Trong cây thư mục mã nguồn dự kiến, thư mục gốc đổi từ `SunKinderGarten/` thành `School_Management/`.
- Giữ nguyên phần thân của hai mục nhật ký cũ có nhắc tên cũ, vì nhật ký chỉ ghi thêm, không ghi đè. Tên cũ trong hai mục đó là ghi chép lịch sử, không phải tham chiếu còn hiệu lực.
- Cập nhật `GD-84` trong `01_Tong_quan_du_an.md` để ghi nhận tên dự án mới; đánh dấu `Q-131` đã được trả lời; thêm câu hỏi mở `Q-132` về mã dự án.
- Thêm một hàng vào bảng "Quyết định đã chốt" của `index.md`.
- Ghi phiên bản 0.3.1 vào `20_Lich_su_thay_doi.md`; thêm mã công việc `N8` vào `Checklist_cong_viec.md`.

**Tệp bị ảnh hưởng:**

- Sửa 36 tệp trong `tai-lieu-thiet-ke/`: hai mươi mốt tài liệu đánh số, `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md`, `Quy_trinh_nghiep_vu/index.md`, `Quy_trinh_nghiep_vu/Phieu_yeu_cau.md` và mười đặc tả `QT-01` đến `QT-10`.
- Không tệp nào bị đổi tên hay di chuyển.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng truy vấn văn bản: tên cũ chỉ còn xuất hiện ở những chỗ cố ý, gồm hai mục nhật ký lịch sử, chính mục nhật ký này, mục 0.3.1 của `20_Lich_su_thay_doi.md` và câu hỏi `Q-132`; mã `SKG` vẫn giữ nguyên tại hai mươi hai chỗ.
- Đã kiểm tra khung mã ba chấm cân bằng và không có hàng bảng thiếu dấu `|` kết thúc sau khi thay thế.

**Ghi chú:**

- Mã dự án vẫn là `SKG`, vốn là chữ viết tắt của tên cũ. Đây là điểm chưa khớp, đã ghi thành `Q-132` để Eric quyết; chưa tự đổi vì mã dự án còn được dùng trong quy tắc sinh mã trẻ tại `GD-20` của `QT-01`.
- Không đổi mã phiên bản tài liệu thành số chính vì việc đổi tên không phá vỡ nội dung nghiệp vụ, thiết kế dữ liệu hay giao diện lập trình.

### 2026-10-09 — Dời thư mục dự án sang ổ D

**Người thực hiện:** Minh

**Nội dung:**

- Dời toàn bộ thư mục dự án theo yêu cầu của Eric.
- Đường dẫn cũ: `C:\Users\vinhn\WorkBuddy AI\2026-10-09-08-11-58\SunKinderGarten\`.
- Đường dẫn mới: `D:\School_Management\`.
- Cách làm: sao chép sang ổ D trước, đối chiếu mã băm của từng tệp, xác nhận khớp hoàn toàn rồi mới xóa thư mục nguồn. Không dùng lệnh dời trực tiếp vì hai ổ khác nhau nên thao tác dời sẽ là sao chép rồi xóa, dễ mất dữ liệu nếu gián đoạn.
- Sao chép kèm thư mục `.workbuddy-ai` chứa nhật ký phiên và ghi chú dài hạn, để dự án tự chứa đủ ngữ cảnh khi mở tại vị trí mới. Thư mục `.workbuddy-ai` ở vị trí cũ vẫn giữ nguyên, không xóa.
- Thêm giả định `GD-84` và câu hỏi mở `Q-131` vào `01_Tong_quan_du_an.md`: thư mục gốc đổi tên nhưng tên sản phẩm trong tài liệu chưa đổi.

**Tệp bị ảnh hưởng:**

- Toàn bộ 36 tệp trong `tai-lieu-thiet-ke/` được dời nguyên trạng sang `D:\School_Management\tai-lieu-thiet-ke\`.
- Sửa: `01_Tong_quan_du_an.md` (thêm `GD-84`, `Q-131`), `index.md` (cập nhật số đếm giả định và câu hỏi mở), `Nhat_ky_du_an.md`.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng mã băm: 36 tệp ở vị trí mới có mã băm giống từng byte so với vị trí cũ; danh sách đường dẫn tệp khớp hoàn toàn; tổng số dòng tài liệu vẫn là 6 402.
- Đã kiểm tra không có tài liệu nào chứa đường dẫn tuyệt đối tới vị trí cũ, nên việc dời không làm hỏng tham chiếu chéo. Mọi tham chiếu trong tài liệu đều là đường dẫn tương đối.

**Ghi chú:**

- Tên thư mục gốc nay là School_Management, khác tên sản phẩm Sun KinderGarten; đã ghi thành `Q-131` để Eric quyết.
- Nếu mở `D:\School_Management` làm thư mục làm việc mới, ghi chú dài hạn và nhật ký phiên nằm sẵn trong `.workbuddy-ai` ở đó.

### 2026-10-09 — Lập kế hoạch tổng thể dự án

**Người thực hiện:** Minh

**Nội dung:**

- Soạn tài liệu `21_Ke_hoach_tong_the_du_an.md`: kế hoạch tổng thể của toàn bộ dự án theo yêu cầu của Eric.
- Dựng bảng mười hai giai đoạn kèm đầu ra bắt buộc, cổng kiểm soát `CG-01` đến `CG-12` và trạng thái hiện tại của từng giai đoạn. Kết luận: dự án đang đứng ở cổng `CG-04` và `CG-05`, chưa qua được.
- Dựng bảng sáu mốc phát hành: 0.1.0, 0.2.0, 0.3.0, 1.0.0, 1.1.0, 1.2.0, gắn với ba giai đoạn sản phẩm tại `02_Pham_vi.md`.
- Dựng kế hoạch thực thi giai đoạn xây dựng thành mười hai đợt `DT-00` đến `DT-11`, mỗi đợt ghi rõ nội dung, phân hệ, mã công việc, phụ thuộc và điều kiện ra.
- Vẽ đường găng bằng sơ đồ và liệt kê bảy mắt xích đang chặn dự án, trong đó ba việc `M05`, `M06`, `M08` đang tạm dừng.
- Dựng ma trận trách nhiệm theo giai đoạn với bốn ký hiệu A, R, C, I.
- Dựng bảng ngưỡng phê duyệt thay đổi gồm sáu loại thay đổi và người phê duyệt tương ứng.
- Ghi mười hai rủi ro `RR-01` đến `RR-12` kèm mức đánh giá, ảnh hưởng và ứng phó.
- Ghi mục "Trạng thái hiện tại và việc trước mắt" với mười việc xếp theo thứ tự, ghi rõ việc nào của Eric và việc nào của Minh.
- Ghi hai giả định mới `GD-82`, `GD-83` và ba câu hỏi mở mới `Q-128` đến `Q-130`.
- Bổ sung `AI-38` và `AI-39` vào `15_Quy_tac_phat_trien_AI.md`, nguyên tắc 15 vào câu lệnh hệ thống tại `16_Cau_lenh_he_thong_AI.md`, và ba tiền tố mã `CG-xx`, `DT-xx`, `RR-xx` vào bảng quy ước mã.
- Cập nhật `index.md`: thêm tài liệu số 21, sửa số giả định từ 80 lên 83 do `GD-81` trước đây chưa được đếm, sửa số câu hỏi mở từ 127 lên 130, thêm ba hàng đếm cổng, đợt và rủi ro.
- Ghi phiên bản 0.3.0 vào `20_Lich_su_thay_doi.md`; thêm mã công việc `N7` vào `Checklist_cong_viec.md`.

**Tệp bị ảnh hưởng:**

- Tạo mới: `21_Ke_hoach_tong_the_du_an.md`.
- Sửa: `index.md`, `15_Quy_tac_phat_trien_AI.md`, `16_Cau_lenh_he_thong_AI.md`, `20_Lich_su_thay_doi.md`, `Checklist_cong_viec.md`, `Nhat_ky_du_an.md`.

**Kết quả kiểm thử:**

- Không áp dụng. Tài liệu này là kế hoạch, chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng truy vấn văn bản: mã `CG-01` đến `CG-12`, `DT-00` đến `DT-11`, `RR-01` đến `RR-12` không trùng với bất kỳ tiền tố nào đã dùng; mọi bảng trong tài liệu mới đều có hàng phân cách; khối mã và sơ đồ cân bằng.

**Ghi chú:**

- Kế hoạch dùng thứ tự và điều kiện vào, điều kiện ra thay cho hạn ngày vì chưa có nguồn lực và ngày bắt đầu được xác nhận, ghi tại `GD-83` và `Q-128`.
- Tài liệu đặt trong bộ tài liệu thiết kế dưới số 21 theo quy tắc "phát sinh tài liệu mới thì đánh số tiếp theo"; xếp vào nhóm quản lý trong `index.md` vì điều phối toàn bộ vòng đời dự án.
- Ba việc Eric cần làm trước để mở đợt đầu tiên: trả lời nhóm câu hỏi ưu tiên, chốt phương án lưu trữ nhiều đơn vị và bộ công nghệ, xác nhận cách xếp ba giai đoạn.

### 2026-10-09 — Cập nhật theo bốn yêu cầu mới

**Người thực hiện:** Minh

**Nội dung:**

- Đổi vai trò Chủ trường thành Ban Giám hiệu gồm hai vai trò tách riêng: Hiệu trưởng (VT-02) và Phó Hiệu trưởng (VT-15), vì đây là trường công lập.
- Bổ sung phân cấp phê duyệt theo hạn mức: Phó Hiệu trưởng phê duyệt chứng từ dưới hạn mức, Hiệu trưởng phê duyệt từ hạn mức trở lên; thêm BR-77 đến BR-80 tại `04_Quy_tac_nghiep_vu.md` mục 12.1 và mục 5 mới trong `05_Vai_tro_nguoi_dung.md`.
- Chuyển mô hình đơn vị tổ chức từ một cấp sang ba cấp: Trường chính, Phân hiệu, Điểm trường. Cả ba cấp đều có thể có lớp; đơn vị của trẻ là đơn vị ở cấp thấp nhất nơi trẻ học.
- Thay thuật ngữ "cơ sở" bằng "đơn vị" trên toàn bộ bộ tài liệu, giữ nguyên các cụm "cơ sở dữ liệu" và "cơ sở hạ tầng". Tổng cộng sửa 31 tệp.
- Đổi bảng `branches` thành `org_units` kèm trường `unit_type` và `parent_id` tự tham chiếu; đổi cột `branch_id` thành `org_unit_id` tại `13_Luoc_do_co_so_du_lieu.md`.
- Sửa mâu thuẫn nội bộ giữa BR-01, BR-02 và GD-05 bằng cách viết lại theo mô hình ba cấp.
- Tách hoàn toàn tầng giao diện khỏi tầng máy chủ; giao diện chỉ gọi giao diện lập trình ứng dụng, không truy cập cơ sở dữ liệu. Ghi tại `09_Kien_truc_he_thong.md` mục 1 và 2, `10_Cong_nghe_su_dung.md` mục 2 và 4, `11_Dac_ta_giao_dien.md` mục 7 mới.
- Tách dịch vụ định danh độc lập tự viết khỏi máy chủ API nghiệp vụ; ghi tại `09_Kien_truc_he_thong.md` TP-11 và mục 4, `14_Dac_ta_API.md` mục 1 và 4, `19_Bao_mat.md` BM-54 đến BM-59.
- Bổ sung mã mới: BR-77 đến BR-80, GD-61 đến GD-80, Q-112 đến Q-127, AC-135 đến AC-148, CT-091 đến CT-104, PCF-11 đến PCF-13, RG-01 đến RG-06, P01-10, MH-32 và MH-33, PV-10 đến PV-12, XT-08, QU-09 và QU-10, QĐ-06 đến QĐ-10.
- Ghi phiên bản 0.2.0 vào `20_Lich_su_thay_doi.md`.

**Tệp bị ảnh hưởng:**

- Toàn bộ bộ tài liệu: `01` đến `20`, `index.md`, `Checklist_cong_viec.md`, `Nhat_ky_du_an.md` và toàn bộ thư mục `Quy_trinh_nghiep_vu/`.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.
- Đã kiểm chứng bằng truy vấn văn bản: không còn chỗ nào dùng "cơ sở" theo nghĩa đơn vị tổ chức; không còn "Chủ trường"; các cụm "cơ sở dữ liệu" và "cơ sở hạ tầng" giữ nguyên.

**Ghi chú:**

- Bốn quyết định này do Eric chốt ngày 09/10/2026, ghi tại `09_Kien_truc_he_thong.md` QĐ-06 đến QĐ-10.
- Mức hạn mức phê duyệt cụ thể chưa có, đã ghi thành Q-112 và Q-123.
- Số Phân hiệu và Điểm trường thực tế chưa có, đã ghi thành Q-113 và Q-122.

### 2026-10-09 — Soạn bộ tài liệu thiết kế

**Người thực hiện:** Minh

**Nội dung:**

- Phân tích nguồn đầu vào: danh sách tính năng bốn nhóm và bốn ảnh sơ đồ chức năng (Tương tác và Nội dung, Chức năng dành cho giáo viên, Chức năng dành cho phụ huynh, Chức năng dành cho kế toán) do Eric gửi.
- Xác định sản phẩm là mới hoàn toàn, không kế thừa mã nguồn của hệ thống nào; ghi nhận trong `01_Tong_quan_du_an.md` mục 1.
- Xác định 19 phân hệ, mã P01 đến P19, và xếp vào ba giai đoạn tại `02_Pham_vi.md`.
- Xác định 14 vai trò người dùng, mã VT-01 đến VT-14, kèm ma trận quyền theo phân hệ tại `05_Vai_tro_nguoi_dung.md`.
- Soạn nhóm tài liệu phân tích nghiệp vụ: `01_Tong_quan_du_an.md` đến `08_Tieu_chi_nghiem_thu.md`.
- Soạn nhóm tài liệu thiết kế: `09_Kien_truc_he_thong.md` đến `14_Dac_ta_API.md`.
- Soạn nhóm tài liệu quy tắc, kiểm thử và vận hành: `15_Quy_tac_phat_trien_AI.md` đến `20_Lich_su_thay_doi.md`.
- Soạn 10 đặc tả quy trình nghiệp vụ theo khuôn đặc tả, mã QT-01 đến QT-10, mỗi tệp đủ mười lăm mục.
- Ghi nhận 76 quy tắc nghiệp vụ, 134 tiêu chí nghiệm thu, 90 ca kiểm thử khởi đầu, 60 giả định và 111 câu hỏi mở.
- Ghi nhận ba đề xuất cần phê duyệt trước khi xây dựng: mô hình nhiều đơn vị chọn phương án tách bằng cột đơn vị, bộ công nghệ đề xuất, và cách xếp giai đoạn 1, 2, 3.

**Tệp bị ảnh hưởng:**

- Toàn bộ thư mục `tai-lieu-thiet-ke/`, gồm 20 tài liệu đánh số, ba tệp quản lý và 11 tệp trong thư mục `Quy_trinh_nghiep_vu/`.

**Kết quả kiểm thử:**

- Không áp dụng. Chưa có mã nguồn để chạy thử.

**Ghi chú:**

- Mọi tài liệu để ở trạng thái Chờ duyệt, chưa có nội dung nào được phê duyệt.
- Chưa xác minh được nghiệp vụ thật của trường: không có biểu mẫu, không có phỏng vấn người dùng. Đã ghi rõ ở mục "Chưa xác minh được" của từng tài liệu phân tích.
- Các điểm cần Eric quyết định trước khi chuyển bước: công thức học phí giữa tháng, mốc giảm trừ tiền ăn, mức miễn giảm và thẩm quyền phê duyệt, mốc nhắc nợ, có lập sổ kế toán kép theo Thông tư 99/2025/TT-BTC hay không, số ngày phép năm, các khoản khấu trừ trên bảng lương.

### 2026-10-09

**Người thực hiện:**

**Nội dung:**

- Khởi tạo bộ tài liệu thiết kế cho dự án Sun KinderGarten - Hệ thống quản lý trường mầm non.

**Tệp bị ảnh hưởng:**

- Toàn bộ thư mục tai-lieu-thiet-ke.

**Kết quả kiểm thử:**

- Không áp dụng.

**Ghi chú:**

- Không có.
