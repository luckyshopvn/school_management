---
yctd: YCTD-336
tieu_de: Cổng quản trị: Công văn của tôi và trang Văn bản đến gọn
ngay: 2026-10-29
phien_ban_de_xuat: 0.212.0
---

## 02 Nhật ký

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

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-336, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Văn bản đi chưa có hạn xử lý trong danh sách nên cột Hạn xử lý của dòng Đi để trống.
- Trang 3.1 Văn bản đi vẫn còn dòng chú thích màu, làm khi áp thiết kế cho trang văn bản đi.

## 24 Yêu cầu thay đổi

### YCTD-336: Cổng quản trị: Công văn của tôi và trang Văn bản đến gọn – 2026-10-29

- Lý do: áp thiết kế "Cổng quản trị trường" Eric duyệt ngày 2026-10-28 cho phân hệ Quản lý văn bản và điều hành: một chỗ gom việc văn bản của người dùng; trang văn bản đến bớt chú thích, nút thường trực.
- Nội dung thay đổi: trang 8. Công văn của tôi (`/my-documents`, MH-570, khóa lưới `my-documents`); 1.2, 3.1 nhận tham số `create=true` để mở sẵn biểu mẫu; trang văn bản đến bỏ chú thích màu, nhãn độ khẩn, ô chọn Vai trò, nút hàng loạt chỉ hiện khi chọn dòng.
- Thành phần bị ảnh hưởng: `packages/shared/src/portal-menu.ts`, `menu-permissions.ts`, `index.ts`; `apps/portal/src/my-documents/MyDocumentsPage.tsx`, `incoming-documents/IncomingListPages.tsx`, `incoming-documents/UrgencyBadge.tsx`, `outgoing-documents/OutgoingListPages.tsx`, `router.tsx`; `tests/e2e/70-incoming-documents.spec.ts`; tài liệu 10 (P09-11), 14 (cây menu, MH-158, MH-159, MH-180).
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-29

- Phạm vi thay đổi: trang Công văn của tôi và trang Văn bản đến gọn theo thiết kế cổng quản trị (YCTD-336).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Cổng quản trị: Công văn của tôi, trang Văn bản đến gọn | YCTD-336 |

## index Số đếm

| 14 | màn hình | +1 |
| Màn hình dự kiến | Số lượng | +1 |
| Ca kiểm thử khởi đầu | Số lượng | +1 |

## Nối dòng

| index.md | Màn hình dự kiến | MH-570 (YCTD-336) |

## Thêm dòng

| 14_DAC_TA_GIAO_DIEN.md | MH-161 | MH-570 | Công văn của tôi (YCTD-336; mục "8. Công văn của tôi" của phân hệ Quản lý văn bản và điều hành, đường dẫn `/my-documents`): nút "Vào sổ văn bản đến" (mở MH-159 với biểu mẫu mở sẵn), "Soạn văn bản đi" (mở MH-180 với MH-181 mở sẵn), mỗi nút chỉ hiện khi có quyền; thẻ "Cần tôi xử lý" (văn bản đến chờ tôi xử lý và văn bản đi chờ tôi xử lý, kèm số) và "Dự thảo của tôi"; lưới khóa `my-documents` cột Loại (Đến, Đi), Số (số đến hoặc số eOffice), Số ký hiệu, Trích yếu (nhãn Hỏa tốc, Khẩn), Nơi gửi (đơn vị ban hành hoặc đơn vị, người soạn thảo), Hạn xử lý (nhãn Quá hạn, Đến hạn); bấm dòng hoặc nút "Xem" mở MH-160 hoặc MH-182 dưới dòng; mỗi danh sách lấy tối đa 200 văn bản, nhiều hơn thì báo xem đủ ở 1.1, 3.1 | Người thấy được 1.1 hoặc 3.1 (một quyền văn bản đến hoặc văn bản đi); Vào sổ: `P09.incoming-document.register`; Soạn: `P09.outgoing-document.draft` |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1680 | P09-11 | Văn thư mở 8. Công văn của tôi, bấm "Vào sổ văn bản đến"; lãnh đạo được trình văn bản khẩn mở Công văn của tôi, bấm dòng, mở thẻ Dự thảo của tôi; 1.1 Văn bản đến: chuyên viên chọn Vai trò Xử lý chính, chọn rồi bỏ chọn dòng | 1.2 mở với biểu mẫu THÔNG TIN VĂN BẢN ĐẾN mở sẵn; dòng loại Đến có đơn vị ban hành, nhãn Khẩn, bấm dòng mở chi tiết, thẻ Dự thảo không có văn bản đến; 1.1 không còn chú thích màu, dòng có [XLC]; nút hàng loạt chỉ hiện khi có dòng chọn (YCTD-336) | Chờ CI; e2e `tests/e2e/70-incoming-documents.spec.ts` | Chờ CI |
