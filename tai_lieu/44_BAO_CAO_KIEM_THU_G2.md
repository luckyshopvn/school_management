# 44. BÁO CÁO KIỂM THỬ GIAI ĐOẠN 2

- Mô tả: Kết quả chạy thật của bộ kịch bản kiểm thử `CT-...` và bộ ca kiểm thử chi tiết `CTC-...` sau giai đoạn 2, phân loại các ca chưa chạy và lỗi phát hiện khi gộp các phần, kết luận trước khi đóng gói bản ứng viên phát hành 1.1.0 (đợt DT-10, YCTD-84).
- Phiên bản: 1.0
- Ngày cập nhật: 2026-10-12
- Trạng thái: Đã đánh giá
- Người đánh giá: Claude, theo ủy quyền của Eric ngày 2026-10-11

## 1. Phạm vi

Giai đoạn 2 (G2) theo `05_PHAM_VI.md`: G2-01, G2-02, G2-04 đến G2-17 (G2-03 xe đưa đón đã bỏ, Q-62), làm trong mười phần 10a đến 10j của đợt DT-10 (YCTD-73 đến YCTD-83). Chạy lại toàn bộ kiểm thử giai đoạn 1 để kiểm hồi quy. Chức năng G3 (P16, P18, kết nối Facebook, đối soát thanh toán, sổ kế toán kép) thuộc đợt DT-11, không thuộc bản 1.1.0.

| Phần | Phân hệ | Thay đổi | Yêu cầu gộp |
|---|---|---|---|
| 10a | P10 hồ sơ, khám, sự kiện, chăm sóc, báo cáo | YCTD-74 | 43 |
| 10b | P10 thuốc | YCTD-75 | 46 |
| 10c | P12 bếp, P17-08 | YCTD-76 | 48 |
| 10d | P13 kho, tài sản, mua hàng | YCTD-77 | 45 |
| 10e | P14 hoạt động, nội dung, ngoại khóa | YCTD-78 | 49 |
| 10f | P15 tương tác, P02-11 đồ bị mất | YCTD-79 | 50 |
| 10g | P03 giảng dạy | YCTD-80 | 51 |
| 10h | P09 công việc, đánh giá; P07-03; P08-07 | YCTD-81 | 53 |
| 10i | P05-10, P05-12, P06-06, P06-07, P06-09 | YCTD-82 | 54 |
| 10j | P17-10, P17-11, P17-12 | YCTD-83 | 52 |

## 2. Môi trường và cách chạy

| Hạng mục | Nội dung |
|---|---|
| Môi trường | Như `43_BAO_CAO_KIEM_THU_CG_10.md`: máy phát triển chạy Docker và GitHub Actions; môi trường thử nghiệm trên đám mây dựng khi triển khai (việc T6) |
| Cách làm | Từ phần 10b, ba phần một lượt làm song song bằng các agent trong worktree riêng; quyền của mỗi lượt cấp trước trong một tệp định danh (0032, 0033, 0034). Người điều phối gộp nối tiếp từng phần, chạy toàn bộ kiểm thử máy chủ và giao diện trên nhánh đã gộp, rồi mở yêu cầu gộp; chỉ gộp vào `main` khi tích hợp liên tục đạt |
| Lần chạy cuối | Ngày 12/10/2026 trên nhánh `dt-10-phan-10i` (đã gồm mọi phần): máy chủ API 480/480 đạt, kiểm thử giao diện 57/57 đạt; chạy thêm bộ báo cáo và tài chính giai đoạn 2 sau khi bổ sung ca CT-041, CT-083, CT-085 |

## 3. Kết quả tổng hợp

| Bộ ca | Tổng | Đạt | Chưa chạy | Không áp dụng |
|---|---|---|---|---|
| Kịch bản kiểm thử `CT-001` đến `CT-201` | 201 | 187 | 7 | 7 |
| Ca kiểm thử chi tiết `CTC-...` | 453 | 443 | 3 | 7 |

So với cổng CG-10: thêm 13 kịch bản mới cho chức năng G2 chưa có kịch bản (CT-189 đến CT-201, kèm AC-233 đến AC-245); 43 kịch bản G2 trước đây chưa chạy nay đạt; hai ca chi tiết G2 (CTC-P01-062, CTC-P06-049) nay đạt. Mọi kịch bản thuộc chức năng G1 và G2 chạy được trên máy phát triển đều đạt.

## 4. Ca chưa chạy và quyết định xử lý

### 4.1 Ca chi tiết `CTC-...`

Ba ca CTC-DD-024, CTC-P01-058, CTC-P06-061 giữ nguyên lý do và quyết định ở mục 4.1 của `43_BAO_CAO_KIEM_THU_CG_10.md` (chờ việc T1 và T6).

### 4.2 Kịch bản `CT-...`

| Nhóm | Mã | Lý do | Quyết định |
|---|---|---|---|
| Chức năng G3 | CT-076, CT-077, CT-124 (P16 tuyển sinh) | Không thuộc bản 1.1.0 | Chạy ở đợt DT-11 |
| Hiệu năng và phục hồi | CT-086, CT-087, CT-088, CT-089 | Cần môi trường gần môi trường chạy thật và quy trình sao lưu | Chạy trên môi trường thử nghiệm khi triển khai ở việc T6 |

## 5. Lỗi phát hiện trong đợt DT-10

| Mức | Lỗi | Xử lý |
|---|---|---|
| Cao | Yêu cầu dặn thuốc tự hoàn thành sau liều cuối biến mất khỏi lịch cho uống của ngày, y tế không thấy liều vừa ghi | Đã sửa ở phần 10b: lịch gồm cả yêu cầu đã hoàn thành, khóa nút ghi liều (yêu cầu gộp số 46) |
| Trung bình | Phần làm song song trùng tên kiểu và lớp bình luận (10e, 10f), trùng mã màn hình đề xuất (MH-57 ở ba phần), mã lỗi tạm `P06-09` cho khóa kỳ tài chính | Đổi tên lớp của phần tương tác; đánh số màn hình MH-57 đến MH-62; thêm quy tắc BR-95 (YCTD-79 đến YCTD-82) |
| Trung bình | Công nợ phải trả chưa nối phiếu đi chợ của bếp vì hai phần làm song song | Nối khi gộp phần 10i, trả hai chiều, có ca kiểm thử (YCTD-82) |
| Thấp | Kiểm thử giao diện chọn món theo nhãn không khớp, thực đơn trình duyệt trước khi lưu món xong, thời gian chờ 30 giây không đủ trên máy chạy kiểm thử liên tục | Sửa kiểm thử: chọn theo vai trò hộp chọn, chờ thông báo lưu, thời gian chờ 60 giây trên máy chạy kiểm thử liên tục |
| Thấp | Xóa cơ sở dữ liệu thử thỉnh thoảng lỗi khi gặp tiến trình nền của PostgreSQL không kết thúc được (mã 42501) | Thử lại tối đa năm lần (yêu cầu gộp số 51) |

Không còn lỗi nghiêm trọng hoặc lỗi cao chưa xử lý trong phạm vi G1 và G2.

## 6. Giới hạn đã biết của bản 1.1.0

1. Các giới hạn của bản 1.0.0 ở mục 6 của `43_BAO_CAO_KIEM_THU_CG_10.md` vẫn còn (việc T1, T6).
2. Chưa có tổ chuyên môn (`/teaching-groups`): tổ trưởng chuyên môn xem và duyệt giáo án theo đơn vị được gán; tổ trưởng duyệt giáo án trên cổng quản trị, chưa có trên ứng dụng giáo viên (YCTD-80).
3. Chưa nhận ảnh đồ bị mất và tệp đính kèm tin nhắn, công việc, chứng chỉ; trao đổi với phụ huynh không theo thời gian thực (YCTD-79, YCTD-81).
4. Chưa mở lại kỳ tài chính đã chốt; nhắc nợ gửi khi kế toán bấm, chưa gửi theo lịch (YCTD-82).
5. Quyết toán nghỉ việc chưa gồm thưởng và khấu trừ (YCTD-81); ứng dụng phụ huynh chưa có danh sách riêng cho thư viện, album, hình tô màu (YCTD-78).

## 7. Kết luận

Kiểm thử giai đoạn 2 đạt ngày 12/10/2026: không còn lỗi nghiêm trọng chưa xử lý; các kịch bản thuộc tiêu chí nghiệm thu G1 và G2 chạy được trên máy phát triển đều đạt; các ca còn lại đã phân loại và có quyết định xử lý.

Bản ứng viên phát hành 1.1.0 là phiên bản tài liệu 0.42.0 trên nhánh `main`. Gắn phiên bản 1.1.0 sau khi bản 1.0.0 qua cổng CG-11 (Eric nghiệm thu, việc T6) và Eric nghiệm thu bản ứng viên 1.1.0.
