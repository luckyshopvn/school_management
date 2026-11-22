---
yctd: YCTD-399
tieu_de: Cố định đồng hồ trong kiểm thử điểm cuối bài về nhà
ngay: 2026-11-22
phien_ban_de_xuat: không
---

## 02 Nhật ký

### 2026-11-22 — Cố định đồng hồ trong kiểm thử điểm cuối bài về nhà

#### Công việc đã thực hiện

- `apps/api/src/learning/homework/homework.test.ts`: cố định đồng hồ của máy chủ API ở 10:00 ngày 3/11/2026 giờ Việt Nam trong `before`.
- Chạy trên máy: chưa sửa thì CT-28f-6, CT-28f-7, CT-28f-9 hỏng giống CI của PR 357; sau khi sửa cả năm ca CT-28f-5 đến CT-28f-9 đạt.

#### Quyết định

- Sửa kiểm thử, không sửa mã nguồn: mã nguồn tính lịch khối lượng và danh sách bài từ hôm nay là đúng đặc tả; kiểm thử dùng ngày cố định nên hỏng khi ngày chạy qua 9/11/2026. Người dùng duyệt sửa trong PR riêng ngày 2026-11-22.
- Bước xác minh token đăng nhập dùng cùng đồng hồ nhưng chỉ xét hạn hết hiệu lực, nên đồng hồ lùi về trước vẫn xác minh được.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-399.

#### Vấn đề tồn đọng

- Việc `kiem-thu` của CI không chạy ở lần chạy theo lịch hằng đêm, nên lỗi phụ thuộc ngày chỉ lộ ra khi có PR mới.

## 24 Yêu cầu thay đổi

### YCTD-399: Cố định đồng hồ trong kiểm thử điểm cuối bài về nhà – 2026-11-22

- Lý do: CT-28f-6, CT-28f-7, CT-28f-9 ghi cứng ngày tiết 2/11/2026 và hạn 9/11/2026, trong khi lịch khối lượng 7 ngày bắt đầu không sớm hơn hôm nay (`apps/api/src/learning/homework/homework.ts` dòng 222 đến 228); từ khoảng 7/11/2026 các ca này hỏng, làm việc `kiem-thu` của mọi PR hỏng.
- Nội dung thay đổi: kiểm thử cố định `Clock.now` của máy chủ API ở `2026-11-03T03:00:00Z`.
- Thành phần bị ảnh hưởng: chỉ tệp kiểm thử; không đổi mã nguồn, cơ sở dữ liệu, API, giao diện, phân quyền.
- Dữ liệu bị ảnh hưởng: không.
- Kiểm thử cần làm: chạy `homework.test.js` của máy chủ API; việc `kiem-thu` của CI đạt.
- Trạng thái: Đã triển khai
