---
yctd: YCTD-343
tieu_de: Cổng vận hành nền tảng: chuyển loại dữ liệu, thêm hồ sơ đồng ý, vùng máy chủ ở chi tiết trường
ngay: 2026-10-28
phien_ban_de_xuat: 0.223.0
---

## 02 Nhật ký

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

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-343, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Chưa có thao tác rút hồ sơ đồng ý hay kết thúc vùng máy chủ ở cổng (máy chủ chưa có điểm cuối).
- Đề xuất: cân nhắc chặn chuyển trường `consented`, `production` về `synthetic` khi còn dữ liệu thật, vì trường dữ liệu giả có thể bị tự xóa.

## 24 Yêu cầu thay đổi

### YCTD-343: Cổng vận hành nền tảng: chuyển loại dữ liệu, thêm hồ sơ đồng ý, vùng máy chủ ở chi tiết trường – 2026-10-28

- Lý do: rà soát giao diện 2026-10-28 (T-P2, mức Cao): API đã có nhưng cổng nền tảng không cho chuyển loại dữ liệu, thêm hồ sơ đồng ý, vùng máy chủ của trường đã tạo; trái tài liệu 32 mục S2, S9.
- Nội dung thay đổi: khối loại dữ liệu, hồ sơ đồng ý, vùng máy chủ ở MH-318; ba điểm cuối chỉ cho vai trò quản trị, kỹ thuật; chi tiết trường trả `consent_gaps`.
- Thành phần bị ảnh hưởng: `apps/platform` (SchoolsPage, SchoolDataGovernance, platform-api, Application), `apps/identity` (platform-schools), e2e nhiều trường; tài liệu 14 (MH-318), 17, 21.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: cổng vận hành nền tảng chuyển được loại dữ liệu, thêm hồ sơ đồng ý, vùng máy chủ của trường đã tạo (YCTD-343).
- Chỉ vai trò vận hành quản trị, kỹ thuật được làm các thao tác này.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Cổng vận hành nền tảng: loại dữ liệu, hồ sơ đồng ý, vùng máy chủ ở chi tiết trường | YCTD-343 |

## Thêm dòng

| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1630 | P01-56 | Chi tiết trường của trường dữ liệu giả, chưa có hồ sơ | 200, `data_class` = synthetic, `consent_gaps` có 5 mục (bốn hồ sơ và vùng máy chủ) | Kiểm thử tự động `apps/identity/src/platform/school-data-class.test.ts` đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1631 | P01-56, BR-207 | Chuyển sang consented khi thiếu hồ sơ; loại dữ liệu sai; hồ sơ mã băm sai; vùng máy chủ thiếu vùng; hồ sơ đã hết hạn | 422 "Chưa đủ hồ sơ đồng ý" kèm từng mục thiếu; 400 các ca dữ liệu sai; hồ sơ hết hạn không được tính, loại dữ liệu giữ synthetic | Kiểm thử tự động `apps/identity/src/platform/school-data-class.test.ts` đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1632 | P01-56 | Vai trò hỗ trợ, kế toán ghi hồ sơ, vùng máy chủ, đổi loại dữ liệu | 403, không ghi gì | Kiểm thử tự động `apps/identity/src/platform/school-data-class.test.ts` đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1633 | P01-56, BR-207 | Quản trị ghi đủ bốn hồ sơ, kỹ thuật ghi vùng máy chủ rồi chuyển sang consented | 200, `consent_gaps` rỗng, `data_class` = consented, sự kiện vòng đời data-class-changed | Kiểm thử tự động `apps/identity/src/platform/school-data-class.test.ts` đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1634 | P01-56, BR-207 | Chuyển sang production khi `PLATFORM_DATA_POLICY=consent-required`, rồi khi `any` | 422 "không nhận loại production", loại giữ nguyên; chính sách any thì 200 | Kiểm thử tự động `apps/identity/src/platform/school-data-class.test.ts` đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1635 | P01-56 | Giao diện: kế toán mở chi tiết trường beta | Thấy loại dữ liệu, mục còn thiếu, ghi chú vai trò; không có nút Chuyển loại dữ liệu, Thêm hồ sơ đồng ý, Thêm vùng máy chủ | Kiểm thử giao diện `tests/e2e/141-school-data-class.spec.ts`, chạy ở CI | Chưa chạy |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1636 | P01-56, BR-207 | Giao diện: kỹ thuật hủy hộp xác nhận; chuyển khi thiếu hồ sơ; mã băm sai; ghi bốn hồ sơ và vùng máy chủ rồi chuyển | Hủy thì không gửi; lỗi máy chủ hiện kèm mục thiếu; lỗi mã băm; sau khi đủ thì "Đã chuyển loại dữ liệu", loại hiện "Dữ liệu thật có đồng ý" | Kiểm thử giao diện `tests/e2e/141-school-data-class.spec.ts`, chạy ở CI | Chưa chạy |
