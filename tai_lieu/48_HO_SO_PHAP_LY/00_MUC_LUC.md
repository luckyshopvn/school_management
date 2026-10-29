# 48. HỒ SƠ PHÁP LÝ VÀ TUÂN THỦ (DT-SaaS phần S8a)

- Mô tả: Bộ mẫu pháp lý và hồ sơ tuân thủ cho nền tảng School Management nhiều trường (DT-SaaS), gồm mẫu dùng chung và bộ hồ sơ riêng cho trường dùng thử dữ liệu thật trên máy chủ ngoài Việt Nam; từ 2026-10-26 thêm danh sách hồ sơ cần có cho nền tảng gia sư trực tuyến (DT-27, PL-16 đến PL-21, chưa soạn nội dung).
- Phiên bản bộ mẫu: S8a-1.1 (2026-10-26: PL-02 thêm Điều 5a quyền truy cập của quản trị nền tảng, DT-24, YCTD-220); danh sách DT-27: DT27-0.1
- Ngày soạn: 2026-10-25; bổ sung 2026-10-26
- Yêu cầu thay đổi: YCTD-200 (`24_YEU_CAU_THAY_DOI.md`); kế hoạch ở `47_KE_HOACH_THEO_HE_THONG_SO.md` mục 14.3, 14.5 "S8a", 14.11. Danh sách DT-27: YCTD-250, kế hoạch ở `47` mục 19.
- Trạng thái: **Bản nháp. Luật sư của Eric phải rà trước khi dùng.** Không ký, không gửi cho trường, không nhận dữ liệu thật của trường nào khi bộ mẫu này chưa được rà.

> **Lưu ý bắt buộc khi dùng bộ mẫu**
>
> 1. Đây là mẫu do Claude soạn để làm việc với luật sư, **không phải tư vấn pháp lý**. Mọi căn cứ pháp lý ghi ở đây phải được luật sư đối chiếu lại với văn bản hiện hành tại ngày ký.
> 2. Chỗ cần điền để dạng `[ ]` kèm chú thích. **Không điền tên, số đăng ký, địa chỉ, số tài khoản, số liệu thật** vào bản lưu trong kho mã; bản đã điền lưu ngoài kho (bản quét và mã băm lưu ở `school_consents` khi S2, S9 làm xong).
> 3. Nhà cung cấp hạ tầng, vùng máy chủ, giá, thời hạn trong mẫu là **giả định** theo kế hoạch (14.11: GD-99, GD-100, GD-101). Khi Eric chốt khác thì sửa mẫu bằng YCTD mới, tăng phiên bản bộ mẫu.

## 1. Danh mục mẫu

| Mã | Tệp | Tên | Dùng khi | Ai ký hoặc phê duyệt | Lưu bằng chứng ở |
|---|---|---|---|---|---|
| PL-01 | [01_HOP_DONG_DICH_VU.md](01_HOP_DONG_DICH_VU.md) | Hợp đồng cung cấp dịch vụ phần mềm | Mọi trường dùng thật (trả phí hoặc dùng thử dữ liệu thật) | Đại diện nền tảng và Hiệu trưởng hoặc người được ủy quyền | Ngoài kho; tham chiếu ở hồ sơ trường (S4) |
| PL-02 | [02_THOA_THUAN_XU_LY_DU_LIEU.md](02_THOA_THUAN_XU_LY_DU_LIEU.md) | Thỏa thuận xử lý dữ liệu cá nhân (phụ lục hợp đồng) | Mọi trường có dữ liệu thật | Như PL-01 | `school_consents` loại `dpa` |
| PL-03 | [03_VAN_BAN_DONG_Y_DUNG_THU.md](03_VAN_BAN_DONG_Y_DUNG_THU.md) | Văn bản đồng ý dùng thử dữ liệu thật ở máy chủ ngoài Việt Nam; mẫu thông báo cho cha mẹ, người giám hộ | Trường `consented` (hồ sơ thử nghiệm) | Hiệu trưởng | `school_consents` loại `consent` |
| PL-04 | [04_DIEU_KHOAN_SU_DUNG.md](04_DIEU_KHOAN_SU_DUNG.md) | Điều khoản sử dụng | Hiện trong ứng dụng, người dùng đồng ý khi đăng nhập lần đầu và khi đổi phiên bản | Người dùng (bấm đồng ý) | Bảng ghi đồng ý của S2 |
| PL-05 | [05_CHINH_SACH_BAO_MAT.md](05_CHINH_SACH_BAO_MAT.md) | Chính sách bảo vệ dữ liệu cá nhân | Hiện trong ứng dụng và trang công khai của nền tảng | Nền tảng công bố | Bảng ghi đồng ý của S2 |
| PL-06 | [06_DANH_GIA_TAC_DONG_XU_LY.md](06_DANH_GIA_TAC_DONG_XU_LY.md) | Hồ sơ đánh giá tác động xử lý dữ liệu cá nhân | Nền tảng (bên xử lý) lập theo thỏa thuận; trường (bên kiểm soát) lập và nộp | Người đứng đầu từng bên | `school_consents` loại `impact-assessment` |
| PL-07 | [07_DANH_GIA_TAC_DONG_CHUYEN_XUYEN_BIEN_GIOI.md](07_DANH_GIA_TAC_DONG_CHUYEN_XUYEN_BIEN_GIOI.md) | Hồ sơ đánh giá tác động chuyển dữ liệu cá nhân xuyên biên giới | Trường `consented` ở máy chủ ngoài Việt Nam | Người đứng đầu bên chuyển | `school_consents` loại `impact-assessment` |
| PL-08 | [08_BAN_GHI_VUNG_MAY_CHU.md](08_BAN_GHI_VUNG_MAY_CHU.md) | Bản ghi vùng máy chủ và danh sách bên xử lý phụ | Mọi trường; bắt buộc với trường `consented` | Nền tảng lập, trường xác nhận | `school_hosting` |
| PL-09 | [09_PHIEU_CHAP_NHAN_RUI_RO.md](09_PHIEU_CHAP_NHAN_RUI_RO.md) | Phiếu chấp nhận rủi ro pháp lý về lưu trữ dữ liệu trong nước | Trước khi nhận dữ liệu thật đầu tiên ở hồ sơ thử nghiệm; gia hạn theo thời hạn ghi trên phiếu | Eric | `school_consents` loại `risk-acceptance` |
| PL-10 | [10_LO_TRINH_CHUYEN_VE_TRONG_NUOC.md](10_LO_TRINH_CHUYEN_VE_TRONG_NUOC.md) | Kế hoạch và lộ trình chuyển dữ liệu về máy chủ trong nước | Kèm PL-03, PL-09 | Nền tảng | Hồ sơ trường (S4) |
| PL-11 | [11_HO_SO_DE_XUAT_CAP_DO.md](11_HO_SO_DE_XUAT_CAP_DO.md) | Hồ sơ đề xuất cấp độ hệ thống thông tin và phương án bảo vệ | Trước khi đưa nền tảng vào vận hành; khi vượt ngưỡng | Chủ quản hệ thống (nền tảng) | Ngoài kho |
| PL-12 | [12_QUY_TRINH_SU_CO_VA_THONG_BAO.md](12_QUY_TRINH_SU_CO_VA_THONG_BAO.md) | Quy trình xử lý sự cố và thông báo vi phạm dữ liệu cá nhân | Thường trực | Nền tảng ban hành; trường phối hợp | Nhật ký sự cố |
| PL-13 | [13_CHINH_SACH_LUU_GIU_VA_XOA.md](13_CHINH_SACH_LUU_GIU_VA_XOA.md) | Chính sách lưu giữ và xóa dữ liệu | Thường trực | Nền tảng ban hành | Cấu hình `platform_settings`, `plans` |
| PL-14 | [14_HUONG_DAN_MA_HOA_DU_LIEU_TRE_EM.md](14_HUONG_DAN_MA_HOA_DU_LIEU_TRE_EM.md) | Hướng dẫn mã hóa trường dữ liệu trẻ em bằng khóa riêng của trường và giới hạn | Kèm PL-07 | Nền tảng | — |
| PL-15 | [15_DIEU_KIEN_DICH_VU_XU_LY_DU_LIEU.md](15_DIEU_KIEN_DICH_VU_XU_LY_DU_LIEU.md) | Danh mục kiểm tra điều kiện kinh doanh dịch vụ xử lý dữ liệu cá nhân của nền tảng | Trước khi nhận dữ liệu thật của trường đầu tiên | Eric, luật sư | Ngoài kho |
| PL-16 đến PL-21 | [16_DANH_SACH_HO_SO_GIA_SU.md](16_DANH_SACH_HO_SO_GIA_SU.md) | **Đã bỏ (YCTD-384):** chuyển sang sản phẩm riêng Chợ gia sư. Danh sách hồ sơ của nền tảng gia sư trực tuyến (DT-27): điều khoản gia sư, đồng ý của cha mẹ, đơn đăng ký học thêm trong trường, chính sách an toàn trẻ em, điều khoản chợ và tranh chấp, bổ sung hồ sơ dữ liệu cá nhân | Chưa soạn; từng hồ sơ soạn ở phần 27a đến 27i rồi luật sư rà | Theo từng hồ sơ | Theo từng hồ sơ |
| PL-22 | [22_TRO_LY_AI_SOAN_NHAP.md](22_TRO_LY_AI_SOAN_NHAP.md) | Bản nháp: trợ lý AI soạn câu hỏi, kế hoạch bài dạy (DT-23 phần 23d, YCTD-214) | Trước khi bật AI ở trường thật | Luật sư của Eric rà; Eric chốt nhà cung cấp | Ngoài kho; `school_hosting` khi chốt nhà cung cấp |

## 2. Thứ tự dùng cho một trường dùng thử dữ liệu thật ở máy chủ ngoài Việt Nam

1. Nền tảng hoàn tất PL-15 (điều kiện của chính nền tảng), PL-11 (cấp độ hệ thống), PL-12, PL-13 và phiếu PL-09 còn hiệu lực.
2. Ký PL-01 kèm PL-02.
3. Trường đọc PL-08, PL-10, PL-14; ký PL-03 (văn bản đồng ý); gửi thông báo cho cha mẹ, người giám hộ theo mẫu ở PL-03 phần B.
4. Trường (bên kiểm soát) lập PL-06 và PL-07 của mình, có nền tảng hỗ trợ phần kỹ thuật; nộp cơ quan chuyên trách bảo vệ dữ liệu cá nhân trong thời hạn luật định.
5. Quản trị nền tảng ghi bằng chứng vào `school_consents`, `school_hosting` rồi mới chuyển trường sang `consented` (S2, S9 chặn khi thiếu).
6. Khi một điều kiện kích hoạt ở PL-10 xảy ra thì chuyển về máy chủ trong nước.

## 3. Trường dữ liệu mà mẫu cần (để S2, S9 khớp)

Bảng `school_consents` (nền tảng, S2 và S9 làm):

| Trường dữ liệu | Lấy từ mẫu | Ghi chú |
|---|---|---|
| `school_id` | Mọi mẫu | Trường được áp dụng |
| `kind` | `dpa` (PL-02), `consent` (PL-03), `impact-assessment` (PL-06, PL-07), `risk-acceptance` (PL-09) | Một trường `consented` phải có đủ bốn loại còn hiệu lực |
| `template_code`, `template_version` | Mã và phiên bản ở đầu mỗi mẫu (ví dụ `PL-03`, `S8a-1.0`) | Để biết bản ký theo mẫu nào |
| `signer_name`, `signer_title` | Phần ký của mẫu | Người có thẩm quyền ký |
| `signed_on` | Ngày ký | |
| `valid_from`, `valid_until` | Mục thời hạn | Hết hạn thì nhắc ở bảng điều khiển (S4) |
| `data_scope` | PL-03 mục 2, PL-02 Phụ lục A | Loại dữ liệu, nhóm chủ thể |
| `hosting_snapshot` | PL-08 tại ngày ký | Danh sách bên xử lý phụ, vùng |
| `file_sha256`, `file_key` | Bản quét đã ký | Lưu tệp ở kho tệp của nền tảng, không ở kho mã |
| `submitted_to_authority_on`, `authority_reference` | PL-06, PL-07 | Ngày nộp, số tiếp nhận của cơ quan chuyên trách |
| `recorded_by` | Quản trị nền tảng ghi | |
| `withdrawn_on` | PL-03 mục 7 (rút đồng ý) | Rút đồng ý thì không còn là `consented` |

Bảng `school_hosting` (S9 làm), một dòng cho mỗi dịch vụ:

| Trường dữ liệu | Ghi chú |
|---|---|
| `school_id` | |
| `provider` | Tên nhà cung cấp (ví dụ `[nhà cung cấp cơ sở dữ liệu]`) |
| `service` | Loại dịch vụ: cơ sở dữ liệu, kho tệp, máy chủ ứng dụng, mạng biên, gửi thư, tin nhắn, thanh toán |
| `region` | Vùng máy chủ (giả định gần nhất là Singapore) |
| `role` | `subprocessor` (bên xử lý phụ) hoặc `transit` (chỉ chuyển tiếp, không lưu) |
| `stores_personal_data` | Có hay không lưu dữ liệu cá nhân |
| `started_on`, `ended_on` | |

## 4. Văn bản căn cứ đã đọc

Claude đọc ngày **2026-10-25** trên Cổng thông tin điện tử Chính phủ (`chinhphu.vn`, `vanban.chinhphu.vn`), Công báo (`congbao.chinhphu.vn`), Cơ sở dữ liệu quốc gia về pháp luật (`vbpl.vn`, Bộ Tư pháp), cổng Bộ Công an (`mps.gov.vn`, `bocongan.gov.vn`) và Báo Chính phủ (`baochinhphu.vn`). Mức độ đã đọc ghi ở cột cuối.

| Văn bản | Ngày ban hành, hiệu lực | Nguồn đã đọc | Đã đọc đến đâu |
|---|---|---|---|
| Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 | 26/06/2025; hiệu lực 01/01/2026 | `vanban.chinhphu.vn` (thuộc tính); `vbpl.vn` (toàn văn) | Toàn văn các Điều 4, 8, 9, 10, 14, 19, 20, 21, 23, 24, 30, 37, 38, 39 và mục lục (chưa đọc toàn văn Điều 12 về mã hóa) |
| Nghị định 356/2025/NĐ-CP quy định chi tiết một số điều và biện pháp thi hành Luật Bảo vệ dữ liệu cá nhân | 31/12/2025; hiệu lực 01/01/2026 | `congbao.chinhphu.vn` (thuộc tính); `vbpl.vn` (toàn văn) | Toàn văn các Điều 4, 6, 7, 12, 13, 14, 17, 18, 19, 20, 21, 22, 23, 28, 41, 42 và mục lục; **chưa đọc các Mẫu số 01a đến 10 ở Phụ lục** |
| Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân | 17/04/2023 | Điều 42 Nghị định 356/2025/NĐ-CP | **Hết hiệu lực từ 01/01/2026.** Kế hoạch 14.2, 14.5 viết theo Nghị định 13/2023; bộ mẫu này theo Luật 91/2025 và Nghị định 356/2025 |
| Luật An ninh mạng số 116/2025/QH15 | 10/12/2025; hiệu lực 01/07/2026 | `vanban.chinhphu.vn`, `congbao.chinhphu.vn` (thuộc tính) | Chỉ thuộc tính; nội dung đọc qua bài của Bộ Công an, Báo Chính phủ về các nghị định hướng dẫn |
| Nghị định 333/2026/NĐ-CP quy định chi tiết một số điều và biện pháp thi hành Luật An ninh mạng | 19/08/2026; hiệu lực 19/08/2026 | `congbao.chinhphu.vn` (thuộc tính); bài `bocongan.gov.vn` | Tóm tắt chính thức về lưu trữ dữ liệu tại Việt Nam (Điều 19, 20), thời hạn lưu; **chưa đọc toàn văn** (tệp gốc là ảnh quét) |
| Nghị định 331/2026/NĐ-CP về bảo vệ an ninh mạng đối với hệ thống thông tin | 19/08/2026; hiệu lực 19/08/2026 | `chinhphu.vn` (thuộc tính, tệp gốc); bài `mps.gov.vn`, `baochinhphu.vn` | Tiêu chí năm cấp độ, ngưỡng dữ liệu cá nhân, Điều 8, 39 qua bài của Bộ Công an; **chưa đọc toàn văn** (tệp gốc là ảnh quét) |
| Nghị định 53/2022/NĐ-CP quy định chi tiết một số điều của Luật An ninh mạng | 15/08/2022; hiệu lực 01/10/2022 | `vanban.chinhphu.vn` (thuộc tính) | **Chưa xác định được còn hiệu lực hay đã bị thay thế** sau khi Luật 116/2025 và Nghị định 333/2026 có hiệu lực; các bài chính thức không nêu điều khoản bãi bỏ. Luật sư kiểm |
| Nghị định 85/2016/NĐ-CP về bảo đảm an toàn hệ thống thông tin theo cấp độ; Thông tư 12/2022/TT-BTTTT | 01/07/2016; 12/08/2022 | Bài `mps.gov.vn` về Nghị định 331/2026 | Nghị định 331/2026 Điều 39 nhắc Nghị định 85/2016 ở phần chuyển tiếp; **chưa xác định được văn bản bãi bỏ chính thức**. Luật sư kiểm |
| Luật Trí tuệ nhân tạo số 134/2025/QH15 (bổ sung 2026-10-26, YCTD-214) | Thông qua 10/12/2025; hiệu lực 01/03/2026 | Bản Word `luatvietnam.vn`; mục lục `thuvienphapluat.vn` | **Toàn văn** 35 điều; xem PL-22 mục 1 |
| Nghị định 142/2026/NĐ-CP hướng dẫn Luật Trí tuệ nhân tạo; Quyết định 33/2026/QĐ-TTg danh mục hệ thống trí tuệ nhân tạo rủi ro cao (bổ sung 2026-10-26) | 30/04/2026; hiệu lực 15/08/2026 (Quyết định) | `thuviennhadat.vn`; báo chính thống | **Chỉ thuộc tính và tóm tắt**; chưa đọc toàn văn và phụ lục lĩnh vực giáo dục |

Những điểm Claude **chưa xác minh được** từ văn bản gốc, luật sư cần kiểm trước khi dùng:

1. Nội dung các Mẫu số 01a, 01b, 02a, 02b, 03a, 03b, 08, 09, 10 ở Phụ lục Nghị định 356/2025/NĐ-CP. PL-06, PL-07, PL-12 dựng theo **nội dung bắt buộc ở thân Nghị định** (khoản 3 Điều 18, khoản 3 Điều 19, khoản 1 Điều 28), chưa khớp từng ô của mẫu chính thức.
2. Toàn văn Nghị định 331/2026/NĐ-CP (thành phần hồ sơ đề xuất cấp độ, cơ quan thẩm định, phê duyệt) và Nghị định 333/2026/NĐ-CP (phạm vi doanh nghiệp trong nước phải lưu dữ liệu tại Việt Nam, danh mục dữ liệu).
3. Tình trạng hiệu lực của Nghị định 53/2022/NĐ-CP, Nghị định 85/2016/NĐ-CP, Thông tư 12/2022/TT-BTTTT.
4. Nền tảng có thuộc diện **kinh doanh dịch vụ xử lý dữ liệu cá nhân** cần Giấy chứng nhận đủ điều kiện (Điều 21 đến 26 Nghị định 356/2025/NĐ-CP) hay không; xem PL-15. Đây là điều kiện có thể chặn việc nhận dữ liệu thật.
5. Các văn bản chuyên ngành giáo dục về hồ sơ, sổ sách điện tử và thời hạn lưu trữ hồ sơ học sinh (chưa tra ở phần này), dùng để điền PL-13.
6. (Bổ sung 2026-10-26, YCTD-214) Toàn văn Nghị định 142/2026/NĐ-CP, phụ lục Quyết định 33/2026/QĐ-TTg về lĩnh vực giáo dục, quy định về gắn nhãn nội dung do AI tạo; Luật Bảo vệ trẻ em 2016 về bí mật đời sống riêng tư của trẻ em. Xem PL-22 mục 6.
