---
yctd: YCTD-306
tieu_de: Sửa CI nhánh chính (ảnh mẫu thiết bị, giám thị camera, tác vụ xuất nền)
ngay: 2026-10-28
phien_ban_de_xuat: 0.180.0
---

## 02 Nhật ký

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

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-306, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Không có.

## 24 Yêu cầu thay đổi

### YCTD-306: Sửa CI nhánh chính (ảnh mẫu thiết bị, giám thị camera, tác vụ xuất nền) – 2026-10-28

- Lý do: CI trên `main` đỏ liên tục từ khoảng 2026-10-26, nên các yêu cầu kéo không biết `main` có đạt hay không.
- Nội dung thay đổi:
  - Thêm ảnh mẫu Linux cho bài so ảnh của spec 180.
  - Sửa lượt mở phiên xem đã hủy ở ô camera của giáo viên và lỗi trả lời lời mời ở máy học sinh.
  - Spec 58 CT-16a-10 khóa dòng tác vụ chờ khi kiểm.
- Thành phần bị ảnh hưởng: cổng quản trị (giám thị camera), ứng dụng học sinh (trả lời xem trực tiếp), kiểm thử e2e 58, 180.
- Dữ liệu, API, giao diện, quyền bị ảnh hưởng: không đổi cấu trúc dữ liệu, API, quyền. Giao diện không đổi.
- Ảnh hưởng chức năng cũ: giáo viên mở lại ô camera nhanh không còn báo nhầm "Không xem được" hay đứng ở "Đang kết nối…".
- Kiểm thử cần thực hiện:
  - Chạy lại đầy đủ việc `kiem-thu-thiet-bi` (hai mảnh, bốn dự án thiết bị).
  - e2e 154 CT-23e-5 và e2e 58 CT-16a-10.
  - Kiểm kiểu `apps/portal`, `apps/student`, `tests`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: sửa CI nhánh chính (YCTD-306). Có ảnh mẫu Linux của spec 180, ô camera giám thị không còn hỏng khi mở lại, spec 58 không còn đua với tiến trình xuất nền.
- Không đổi cấu trúc dữ liệu, không đổi API.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Sửa CI nhánh chính: ảnh mẫu thiết bị, giám thị camera, tác vụ xuất nền | YCTD-306 |
