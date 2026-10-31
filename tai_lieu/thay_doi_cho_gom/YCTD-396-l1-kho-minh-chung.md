---
yctd: YCTD-396
tieu_de: Kho minh chứng dùng chung, lát L1: kho xuyên năm học, phiên bản, hiệu lực, nhật ký truy cập, chuyển minh chứng của đợt tự đánh giá
ngay: 2026-10-31
phien_ban_de_xuat: 0.260.0
---

## 02 Nhật ký

### 2026-10-31 — Kho minh chứng dùng chung, lát L1 (YCTD-396)

#### Công việc đã thực hiện

- Thêm kho minh chứng ở cơ sở dữ liệu hệ thống (sáu bảng `evidence_*`): một minh chứng dùng cho nhiều năm học, nhiều tiêu chí, nhiều bộ tiêu chí, mỗi bộ một mã `[Hn-a.b-c]`; phiên bản (tệp tải lên hoặc bản ghi được chụp lúc gắn); năm học của minh chứng; hiệu lực (còn, sắp hết trong 30 ngày, hết); lịch sử và nhật ký xem, tải tệp.
- Minh chứng của các đợt tự đánh giá (22f) chuyển sang kho một lần cho mỗi cơ sở dữ liệu năm học, lần đầu kho được mở: giữ mã, minh chứng kế thừa gộp vào minh chứng gốc, tệp dùng lại cùng khóa ở kho tệp. Phiếu, danh sách đợt, báo cáo tự đánh giá đọc minh chứng từ kho; bỏ nút "Kế thừa minh chứng năm trước".
- Ba nguồn bản ghi đã có ở 22f (hồ sơ chuyên môn đã duyệt, văn bản đến đã vào sổ, văn bản đi đã phát hành) nay chép tệp gốc vào kho lúc gắn, kiểm quyền xem nguồn, báo "Nguồn đã thay đổi" và chụp lại thành phiên bản mới.
- Phân hệ đổi tên "Minh chứng và kiểm định", menu ba nhóm: 1. Kho minh chứng, 2. Tự đánh giá, 3. Thiết lập. Trang 1.1 Danh sách minh chứng (MH-679) có chi tiết (MH-680), thêm minh chứng (MH-681), gắn vào bộ khác, thêm phiên bản, lọc theo hiệu lực.
- Ba quyền mới `P09.evidence.view`, `P09.evidence.contribute`, `P09.evidence.manage`.

#### Quyết định

- Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: lát L1 chỉ chuyển minh chứng sang cơ sở dữ liệu hệ thống; bộ tiêu chí vẫn đọc từ cơ sở dữ liệu năm học đang dùng (mã định danh giữ nguyên khi chuyển năm học), chuyển bộ tiêu chí sang kho ở lát L3 cùng bộ mẫu theo cấp học. Đường dẫn giữ `/quality/evidences`. Quyền sửa giữ quy tắc nhóm công tác của 22f, thêm người tạo, người phụ trách, đến khi có phân công ở lát L4. Bảng cũ `quality_evidences`, `quality_evidence_criteria` giữ chỉ đọc làm nguồn chuyển, xóa ở YCTD sau.
- Số database migration: hệ thống `0143`, định danh `0200`.

#### Thay đổi

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-396, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}, `07_QUY_TAC_NGHIEP_VU.md` BR-533 đến BR-542, `08_VAI_TRO_NGUOI_DUNG.md` PQ-196, `11_TIEU_CHI_NGHIEM_THU.md` AC-1420 đến AC-1427, `14_DAC_TA_GIAO_DIEN.md` MH-679 đến MH-681, `16_CO_SO_DU_LIEU.md` mục 18V, `17_DAC_TA_API.md` mục 17.17, `21_KICH_BAN_KIEM_THU.md` CT-2130 đến CT-2137.

#### Vấn đề tồn đọng

- Lát L2 (bộ đăng ký nguồn, sổ điểm, điểm danh, hồ sơ cán bộ, biểu EMIS, nút "Dùng làm minh chứng" ở trang nguồn) đến L8 chưa làm.

## 24 Yêu cầu thay đổi

### YCTD-396: Kho minh chứng dùng chung, lát L1: kho xuyên năm học, phiên bản, hiệu lực, nhật ký truy cập – 2026-10-31

- Lý do: lát L1 của YCTD-396 theo danh sách lát và câu trả lời Q-396-1 đến Q-396-10 Eric duyệt ngày 2026-10-31.
- Nội dung thay đổi: kho minh chứng ở cơ sở dữ liệu hệ thống; mã theo bộ, dùng chung tiêu chí, gắn vào bộ khác; phiên bản tệp và bản ghi; hiệu lực; nhật ký truy cập; tệp có dữ liệu cá nhân chỉ người có quyền xem nguồn tải được; chuyển minh chứng của 22f; phân hệ "Minh chứng và kiểm định".
- Thành phần bị ảnh hưởng: `apps/api/src/quality-assurance/` (thêm `evidence-store.ts`, `evidence-store.controller.ts`; `quality-assurance.ts`, `quality-assurance.controller.ts`, `quality-fields.ts` bỏ phần minh chứng theo đợt), `apps/api/src/application.module.ts`; `apps/portal/src/quality-assurance/` (thêm `EvidencePages.tsx`, `evidence-api.ts`; `QualityPages.tsx`, `quality-api.ts`), `apps/portal/src/router.tsx`; `packages/shared/src/` (`evidence-store.ts`, `portal-menu.ts`, `menu-permissions.ts`, `index.ts`).
- Dữ liệu, API, quyền bị ảnh hưởng: sáu bảng mới ở cơ sở dữ liệu hệ thống; điểm cuối `/quality/evidences` đổi giao kèo (theo bộ thay theo đợt), thêm `/frameworks`, `/sources`, `/export`, `/{id}/versions`, `/{id}/codes`, `/{id}/file`; bỏ `/quality/evidence-sources`, `/quality/assessments/{id}/inherit-evidences`; ba quyền mới.
- Ảnh hưởng chức năng cũ: minh chứng cũ hiện đủ ở kho; đổi bộ tiêu chuẩn, xóa đợt không còn bị chặn vì minh chứng (minh chứng thuộc kho); xóa minh chứng chỉ người quản lý kho, chặn khi tiêu chí đã có phiếu được duyệt.
- Kiểm thử cần thực hiện: kiểm kiểu toàn bộ; `apps/api/src/quality-assurance/*.test.ts`; e2e spec 80 và spec mới 243; database migration trên cơ sở dữ liệu sạch (CI).
- Mức: Lớn (thuộc YCTD-396). Người phê duyệt: Eric, ngày 2026-10-31 (bản mẫu, danh sách lát, Q-396-1 đến Q-396-10). Chờ Eric nghiệm thu lát L1 trước khi gộp.
- Trạng thái: Đã phê duyệt

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-31

- Phạm vi thay đổi: kho minh chứng dùng chung xuyên năm học, phiên bản, hiệu lực, nhật ký truy cập, chuyển minh chứng của đợt tự đánh giá; phân hệ "Minh chứng và kiểm định" (YCTD-396 lát L1).
- Database migration: hệ thống `0143_create_evidence_store`, định danh `0200_add_evidence_permissions`. Quay lui: chạy `down` của hai tệp; minh chứng của 22f vẫn còn ở bảng cũ nên đợt, phiếu cũ không mất dữ liệu; minh chứng thêm mới sau khi nâng cấp sẽ mất khi quay lui, cần xuất danh mục và tệp trước.

## 01 Bảng phiên bản

| {PHIEN_BAN} | Kho minh chứng dùng chung, lát L1 | YCTD-396 |

## index Số đếm

| 14 | màn hình | +3 |
| Màn hình dự kiến | Số lượng | +3 |

## Nối dòng

| 03_DANH_SACH_CONG_VIEC.md | P09 Công việc, kế hoạch và đánh giá | YCTD-396 lát L1 (kho minh chứng dùng chung xuyên năm học, phiên bản, hiệu lực, nhật ký truy cập; phân hệ "Minh chứng và kiểm định") |

## Thêm dòng

| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-533 | Mã minh chứng theo bộ (YCTD-396): mỗi minh chứng có tối đa một mã ở mỗi bộ tiêu chí, dạng `Hn-a.b-c` hiển thị `[Hn-a.b-c]`, duy nhất trong bộ; minh chứng dùng chung cho tiêu chí khác của bộ giữ mã của tiêu chí chính; gắn vào bộ khác cấp mã riêng của bộ đó |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-534 | Cấp số minh chứng (YCTD-396): số thứ tự là số nhỏ nhất chưa dùng trong tiêu chí chính của bộ, tối đa 999; số hộp mặc định là số của tiêu chuẩn, sửa được khi thêm; mã đã cấp không tự đổi khi sửa minh chứng; mã trùng thì từ chối và yêu cầu chọn số hộp khác |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-535 | Phiên bản minh chứng (YCTD-396): mỗi lần tải tệp hoặc chụp bản ghi là một phiên bản mới đánh số tăng dần; phiên bản không sửa, không xóa; thêm phiên bản đầu tiên chuyển "Chưa có" thành "Đã đủ"; tệp PDF, ảnh, Word, Excel tối đa 20 MB |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-536 | Kho xuyên năm học (YCTD-396, Q-396-2): minh chứng không thuộc đợt hay năm học; ghi các năm học minh chứng thuộc về (mặc định năm học đang dùng); minh chứng của đợt 22f chuyển sang kho một lần cho mỗi cơ sở dữ liệu năm học, từ năm cũ đến năm mới, giữ mã cũ, minh chứng kế thừa gộp vào minh chứng gốc cùng mã |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-537 | Hiệu lực minh chứng (YCTD-396): trống là không thời hạn; hết hiệu lực khi ngày hết hạn trước hôm nay; sắp hết hiệu lực khi còn không quá 30 ngày; ngày hết hạn không trước ngày ban hành; tính theo ngày Việt Nam, không lưu |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-538 | Quyền sửa minh chứng (YCTD-396): người quản lý kho (phạm vi toàn trường) sửa mọi minh chứng; người đóng góp sửa minh chứng mình tạo, mình phụ trách, hoặc của tiêu chí được phân công cho nhóm công tác của mình ở đợt chưa hoàn thành; chỉ người quản lý kho xóa |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-539 | Xóa minh chứng (YCTD-396): không xóa khi một tiêu chí của minh chứng đã có phiếu đánh giá được duyệt ở năm học đang dùng; lịch sử và nhật ký của minh chứng đã xóa vẫn giữ |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-540 | Gắn bản ghi làm minh chứng (YCTD-396, Q-396-4): cần quyền xem loại bản ghi đó ở phân hệ nguồn; hồ sơ chuyên môn phải đã duyệt, văn bản đến đã vào sổ, văn bản đi đã phát hành; tệp gốc (bản đã ký nếu có) chép vào kho lúc gắn, giữ liên kết và nhãn nguồn |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-541 | Nguồn đã thay đổi (YCTD-396): bản ghi nguồn có thời điểm sửa sau lần chụp thì chi tiết báo "Nguồn đã thay đổi"; không tự chụp lại; người sửa được chụp lại thành phiên bản mới |
| 07_QUY_TAC_NGHIEP_VU.md | BR-460 | BR-542 | Minh chứng có dữ liệu cá nhân (YCTD-396, Q-396-5, BM-271): bản chụp luôn đầy đủ; tệp chỉ người có quyền xem loại nguồn tải được, kể cả người quản lý kho; mọi lần xem, tải tệp ghi nhật ký; chỉ người quản lý kho xem nhật ký truy cập |
| 08_VAI_TRO_NGUOI_DUNG.md | PQ-191 | PQ-196 | Kho minh chứng dùng chung (YCTD-396 lát L1): `P09.evidence.view` (VT-02, VT-15, VT-03, VT-17) xem kho, tải tệp; `P09.evidence.contribute` (mọi vai trò đang có `P09.quality.use`) thêm minh chứng, phiên bản, gắn bộ khác, sửa minh chứng của mình hoặc của nhóm công tác; `P09.evidence.manage` (VT-02, VT-15, cần phạm vi toàn trường) sửa, xóa mọi minh chứng, xem nhật ký truy cập; tệp có dữ liệu cá nhân cần thêm quyền xem nguồn; VT-14 không có phân hệ |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1420 | Cho người đóng góp / Khi thêm minh chứng cho tiêu chí 1.1 của bộ kiểm định / Thì mã cấp là số nhỏ nhất chưa dùng dạng `[H1-1.1-01]`; dùng chung cho tiêu chí 1.8 thì danh sách của 1.8 có cùng mã; gắn vào bộ khác thì có mã riêng của bộ đó, gắn lần hai bị từ chối (CT-2130, CT-2131; YCTD-396 lát L1) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1421 | Cho minh chứng của đợt tự đánh giá ở năm học trước / Khi kho được mở / Thì minh chứng hiện ở kho với mã cũ và năm học cũ, mở lại nhiều lần không chép trùng (CT-2132; YCTD-396 lát L1) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1422 | Cho văn bản đến đã vào sổ / Khi gắn làm minh chứng / Thì phiên bản 1 có tệp gốc chép vào kho; văn bản sửa sau đó thì chi tiết báo "Nguồn đã thay đổi"; chụp lại tạo phiên bản 2, phiên bản 1 vẫn tải được (CT-2133; YCTD-396 lát L1) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1423 | Cho minh chứng có dữ liệu cá nhân / Khi người không có quyền xem nguồn tải tệp, kể cả người quản lý kho / Thì máy chủ trả 403; người có quyền tải được, lượt tải ghi nhật ký, chỉ người quản lý kho thấy nhật ký truy cập (CT-2134; YCTD-396 lát L1) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1424 | Cho minh chứng hết hạn hôm qua và minh chứng hết hạn sau 10 ngày / Khi lọc theo hiệu lực / Thì lần lượt ở "Hết hiệu lực" và "Sắp hết hiệu lực"; ngày hết hạn trước ngày ban hành bị từ chối (CT-2135; YCTD-396 lát L1) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1425 | Cho người đóng góp khác / Khi sửa, xóa minh chứng không phải của mình, không thuộc nhóm / Thì bị từ chối; người tạo, người quản lý sửa được; đổi tiêu chí dùng chung ghi lịch sử (CT-2136; YCTD-396 lát L1) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1426 | Cho tiêu chí đã có phiếu được duyệt / Khi người quản lý kho xóa minh chứng của tiêu chí đó / Thì bị từ chối theo quy tắc YCTD-396; người đóng góp xóa bị 403 (CT-2137; YCTD-396 lát L1) |
| 11_TIEU_CHI_NGHIEM_THU.md | AC-1137 | AC-1427 | Cho Hiệu trưởng ở trang 1.1 Danh sách minh chứng / Khi thêm minh chứng có tệp, thêm phiên bản 2, lọc theo hiệu lực / Thì chi tiết có Bản 1, Bản 2, minh chứng hiện đúng bộ lọc; giao diện đạt ở 1366, 1024, 390 điểm ảnh (CT-2137; YCTD-396 lát L1) |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-679 | Danh sách minh chứng (YCTD-396 lát L1; mục "1.1." của Minh chứng và kiểm định, `/quality/evidences`, lưới khóa `quality-evidences`, thay MH-255): chọn bộ tiêu chí, tiêu chí, trạng thái, hiệu lực, tìm theo mã, tên, số; cột mã `[Hn-a.b-c]`, tên, số và ngày ban hành, nơi ban hành (ẩn), tiêu chí (kèm dùng chung), nguồn, năm học (ẩn), hiệu lực, trạng thái; Thêm minh chứng, Xuất danh mục minh chứng; Xem mở chi tiết | Người có `P09.evidence.view`, `P09.evidence.contribute` hoặc `P09.evidence.manage` |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-680 | Chi tiết minh chứng (YCTD-396 lát L1): tên, mã, trạng thái, hiệu lực; dải "Nguồn đã thay đổi" kèm Chụp lại thành phiên bản mới; dải dữ liệu cá nhân; số, ngày, nơi ban hành, năm học, hiệu lực đến, người phụ trách, mô tả; mã theo bộ tiêu chí; Gắn vào bộ tiêu chí khác; phiên bản (Tải bản n); Thêm phiên bản (tải tệp), Sửa, Xóa (người quản lý kho); lịch sử (người quản lý thấy cả lượt xem, tải) | Như MH-679; sửa: người tạo, người phụ trách, nhóm công tác, người quản lý kho |
| 14_DAC_TA_GIAO_DIEN.md | cuối bảng 2.1 Cổng quản trị | MH-681 | Thêm minh chứng (YCTD-396 lát L1): 1. Nguồn (dữ liệu trong phần mềm với loại dữ liệu, ô tìm, ô chọn; tải tệp lên; chưa có tệp); 2. Thông tin (tên, số, ngày, nơi ban hành, năm học, hiệu lực đến, trạng thái, mô tả); 3. Tiêu chí (tiêu chí chính, số hộp, dùng chung); Ghi báo mã đã cấp | `P09.evidence.contribute`, `P09.evidence.manage` |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2130 | P09-43 | CT-22f-5 (sửa): thêm hai minh chứng tiêu chí 1.1 (một dùng chung 1.8), một hộp 7 tiêu chí 3.1; phụ huynh thêm; nguồn văn bản không có; tải tệp; danh sách theo 1.8; phiếu 1.8; xuất danh mục; xóa | `[H1-1.1-01]`, `H1-1.1-02`, `H7-3.1-01`; 403; 400; phiên bản 1, "Đã đủ"; `H1-1.1-01`; dùng chung; tệp Excel; người đóng góp 403, phiếu 1.1 đã duyệt thì từ chối, 3.1 xóa được | Kiểm thử tự động `apps/api/src/quality-assurance/quality-assurance.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2131 | P09-43 | CT-396-2: gắn minh chứng vào bộ thứ hai, gắn lần hai; phụ huynh mở kho | Mã `H2-2.1-01`, chi tiết có hai mã; từ chối YCTD-396; 403 | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2132 | P09-43 | CT-22f-8 (sửa): năm học trước có đợt cùng bộ với hai minh chứng; mở kho hai lần | Hai minh chứng mã `H1-1.2-01`, `H2-2.2-03`, năm học trước; không trùng; `evidence_imports` ghi 2 | Kiểm thử tự động `apps/api/src/quality-assurance/quality-assurance.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2133 | P09-43 | CT-396-3: gắn văn bản đến có tệp; sửa văn bản; chụp lại; tải bản 1 | Bản 1 nguồn bản ghi có tệp, "Đã đủ"; "Nguồn đã thay đổi"; bản 2; bản 1 là PDF | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2134 | P09-43 | CT-396-4: minh chứng có dữ liệu cá nhân, giáo viên có quyền nguồn tải; Hiệu trưởng không có quyền nguồn tải | 200; 403, không có nút tải; nhật ký có lượt tải, giáo viên không thấy nhật ký truy cập | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2135 | P09-43 | CT-396-1, CT-396-5: hàm hiệu lực ở biên 0, 30, 31 ngày; minh chứng hết hạn hôm qua, sau 10 ngày; hết hạn trước ngày ban hành | Đúng bốn mức; lọc đúng; 400 | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2136 | P09-43 | CT-396-6: giáo viên khác sửa, xóa; người tạo đổi tiêu chí dùng chung; Hiệu trưởng sửa | 403, 403; 200, có lịch sử gắn; 200 | Kiểm thử tự động `apps/api/src/quality-assurance/evidence-store.test.ts` | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-2137 | P09-43 | CT-396-7 (giao diện): Hiệu trưởng thêm minh chứng có tệp, hết hạn năm 2020; thêm phiên bản 2; lọc hiệu lực | Báo mã đã cấp; Bản 1, Bản 2; hiện ở "Hết hiệu lực", không ở "Còn hiệu lực" | Kiểm thử giao diện `tests/e2e/243-kho-minh-chung.spec.ts`; spec 80 sửa theo menu mới | Đạt |
| 27_MA_TRAN_TRUY_VET.md | YCTD-369 | YCTD-396 lát L1 | Kho minh chứng dùng chung, lát L1: kho xuyên năm học, phiên bản, hiệu lực, nhật ký truy cập, chuyển minh chứng của 22f | {PHIEN_BAN} | P09-43 | AC-1420 đến AC-1427 | CT-2130 đến CT-2137 | PR, commit merge ghi khi gom; tệp mã: `apps/api/src/quality-assurance/evidence-store.ts`, `apps/portal/src/quality-assurance/EvidencePages.tsx` và các tệp khác | Kiểm thử tự động trên máy ngày 31/10/2026; CI của PR |
