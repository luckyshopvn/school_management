# Nháp tài liệu DT-15 phần 15f1 — Phân hệ Tài chính – học phí theo lưới và biểu mẫu chung của Sở (YCTD-114)

## YCTD

### YCTD-114: Phân hệ Tài chính – học phí dùng lưới dữ liệu, biểu mẫu và hộp xác nhận xóa chung (DT-15 phần 15f1) – 2026-10-15

- Lý do: tài liệu `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 1 dòng "Đã có, Sở không có" và mục 4: phân hệ riêng của mình giữ nguyên nghiệp vụ, chỉ đổi giao diện theo mẫu chung của Sở (lưới dữ liệu dùng chung, biểu mẫu theo khối nhãn bên trái và nút Ghi, hộp xác nhận xóa, tiêu đề trang có số thứ bậc). Phần 15f chia theo phân hệ; 15f1 là phân hệ Tài chính – học phí (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11).
- Nội dung thay đổi:
  - Tiêu đề của 15 trang trong phân hệ lấy từ cây menu, có số thứ bậc, ví dụ "1.1. Biểu phí và dịch vụ", "2.3. Quỹ và ngân hàng", "3.1. Sổ kế toán" (trước là "Quỹ và tài khoản ngân hàng", "Khoản mục thu chi"… tự đặt ở từng trang).
  - Danh sách chuyển sang lưới dữ liệu dùng chung (tìm kiếm tại chỗ, "Mở rộng tìm kiếm" ở trang có bộ lọc, cấu hình cột hiển thị và số dòng mỗi trang nhớ theo người dùng, phân trang): Danh mục dịch vụ, Loại miễn giảm, Bảng tính học phí, Miễn giảm chờ duyệt, Phiếu điều chỉnh chờ duyệt, Đăng ký và hủy sau ngày chốt chờ duyệt, Danh sách công nợ, Danh sách nhắc nợ, Đề xuất xử lý công nợ quá hạn, Danh sách phiếu thu, Phiếu đảo chờ duyệt, Danh sách phiếu chi, Phiếu chi chờ duyệt, Phiếu đảo phiếu chi chờ duyệt, Quỹ và tài khoản của đơn vị, Bảng phải trả, Khoản mục và nhóm thu chi, Danh sách tài khoản kế toán, Danh sách quy tắc ghi sổ, Kỳ tài chính. Tên vùng của các danh sách giữ như cũ.
  - Bộ lọc vào "Mở rộng tìm kiếm" (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11): trạng thái của danh mục (dịch vụ, loại miễn giảm, khoản mục, quỹ), loại và trạng thái hóa đơn, "Chỉ học sinh có công nợ quá hạn" (trước là ô "Chỉ trẻ có công nợ quá hạn" cạnh ô đơn vị), "Chỉ hóa đơn cần nhắc ở mốc hiện tại", từ ngày, đến ngày và trạng thái phiếu thu, loại và trạng thái phiếu chi, trạng thái công nợ phải trả, trạng thái kỳ tài chính. Ô Đơn vị, Kỳ, Quỹ hoặc tài khoản, khoảng ngày của sổ quỹ, sổ kế toán, đối chiếu vẫn ở đầu trang vì quyết định dữ liệu được tải.
  - Danh mục dùng lưới (dịch vụ, khoản mục thu chi, quỹ và tài khoản): nút "Thêm mới" mở biểu mẫu theo khối "Thêm mới vào …", nút "Sửa" trên dòng mở biểu mẫu ngay dưới dòng; nút "Ghi" thay "Thêm", "Lưu"; cột Trạng thái và nút Ngừng sử dụng, Dùng lại giữ nguyên. Thành phần mới `apps/portal/src/catalogs/CatalogGrid.tsx`; `CatalogTable` của các danh mục ngoài phân hệ không đổi.
  - Loại miễn giảm: nút "Thêm mới" mở biểu mẫu "Thêm mới loại miễn giảm" theo khối (Mã, Tên loại miễn giảm, Cách tính, Mức giảm, Khoản áp dụng, Điều kiện áp dụng), nút "Ghi" thay "Thêm loại miễn giảm".
  - Biểu phí theo phiên bản giữ dạng bảng bậc học nhân khoản phí; tên và tháng hiệu lực nhập theo khối, nút "Ghi" thay "Lưu biểu phí"; xóa phiên bản chưa hiệu lực qua hộp xác nhận xóa.
  - Danh sách chờ duyệt (miễn giảm, phiếu điều chỉnh, đăng ký trễ, phiếu đảo phiếu thu, phiếu chi, phiếu đảo phiếu chi): mỗi yêu cầu một dòng lưới với các cột thông tin; ngay dưới dòng là nhóm thao tác mang tên như cũ ("Miễn giảm của …", "Phiếu chi cho …", "Phiếu đảo …", "Yêu cầu của …") gồm Duyệt, Lý do từ chối, Từ chối; thứ tự và quyền duyệt không đổi. Thành phần mới `apps/portal/src/finance/ApprovalQueueGrid.tsx`.
  - Hóa đơn, công nợ: nút "Chi tiết" trên dòng mở chi tiết hóa đơn, chi tiết công nợ của học sinh (lập phiếu thu, dùng số dư có, lịch sử phiếu thu) ngay dưới dòng như trước. Phiếu thu, phiếu chi: "Lập phiếu đảo" mở ô lý do và nút "Gửi duyệt phiếu đảo" dưới dòng.
  - Nhắc nợ: ô chọn của lưới thay ô chọn riêng; nút "Gửi nhắc nợ (n)" ở thanh công cụ của lưới gửi các dòng đang chọn; gửi xong bỏ lựa chọn. Đề xuất xử lý: danh sách thành lưới (Học sinh, Nợ quá hạn, Đề xuất, Quyết định, Trạng thái); ô Quyết định và nút "Ghi quyết định" ở nhóm "Quyết định cho …" dưới dòng đề xuất chờ quyết định; biểu mẫu lập đề xuất theo khối.
  - Phiếu chi: biểu mẫu "Lập phiếu chi" mở bằng nút "Thêm mới" của lưới, theo khối nhãn bên trái; "Ghi" lưu nháp (trước là "Lưu nháp"), "Ghi và trình duyệt" (trước là "Lưu và trình duyệt"); xóa phiếu chi nháp qua hộp xác nhận xóa.
  - Nợ nhà cung cấp: lập tay theo biểu mẫu khối, nút "Ghi" thay "Ghi công nợ phải trả"; "Trả …" mở biểu mẫu chọn phiếu chi dưới dòng; Hủy giữ nguyên.
  - Đối chiếu ngân hàng giữ bố cục hai bên (sao kê, giao dịch theo sổ chưa khớp); ghi dòng sao kê theo khối, nút "Ghi" thay "Ghi dòng sao kê"; xóa dòng sao kê qua hộp xác nhận xóa.
  - Sổ kế toán: thẻ Nhật ký chung, Sổ cái, Cân đối số phát sinh giữ bố cục sổ; bút toán thủ công nhập ngày, diễn giải theo khối (nút "Ghi sổ bút toán" giữ tên vì là thao tác ghi sổ). Thẻ Hệ thống tài khoản kế toán: lưới, nút "Thêm mới" mở biểu mẫu "Thêm tài khoản chi tiết" theo khối, nút "Ghi". Thẻ Quy tắc ghi sổ: biểu mẫu theo khối, nút "Ghi" thay "Lưu quy tắc"; "Bỏ quy tắc" qua hộp xác nhận xóa.
  - Cổng quản trị gọi "học sinh": tiêu đề cột "Trẻ" ở các danh sách của phân hệ đổi thành "Học sinh"; câu hướng dẫn ở Phiếu thu, ô chọn học sinh được hoàn tiền ở Phiếu chi đổi theo.
  - Sổ quỹ, Đăng ký dịch vụ (bảng học sinh nhân dịch vụ) giữ bố cục, chỉ đổi tiêu đề (và danh sách chờ duyệt của Đăng ký dịch vụ như trên).
- Thành phần bị ảnh hưởng: `14`, `24`, `16` (kiểm thử), `32` mục 6; cổng quản trị, gói dùng chung (`DATA_GRID_KEYS`), kiểm thử giao diện.
- Dữ liệu bị ảnh hưởng: không có bảng hay tệp thay đổi cấu trúc mới; cấu hình lưới của 20 lưới mới lưu ở bảng `user_grid_settings` đã có (YCTD-107).
- API bị ảnh hưởng: không có điểm cuối mới; `PUT /api/v1/me/grid-settings/{gridKey}` nhận thêm 20 khóa lưới.
- Giao diện bị ảnh hưởng: 15 trang của phân hệ Tài chính – học phí (bảng ở mục Màn hình).
- Quyền bị ảnh hưởng: không có quyền mới; mọi nút giữ điều kiện quyền như trước, máy chủ vẫn kiểm tra (AI-12).
- Ảnh hưởng chức năng cũ: nghiệp vụ, thông báo, thứ tự bước không đổi. Đổi tên nút "Thêm", "Lưu", "Lưu biểu phí", "Thêm loại miễn giảm", "Lưu quy tắc", "Thêm tài khoản chi tiết", "Ghi dòng sao kê", "Ghi công nợ phải trả" thành "Ghi"; "Lưu nháp", "Lưu và trình duyệt" thành "Ghi", "Ghi và trình duyệt". Thêm bước xác nhận khi xóa phiên bản biểu phí, phiếu chi nháp, dòng sao kê, bỏ quy tắc ghi sổ. Biểu mẫu thêm danh mục, lập phiếu chi, thêm tài khoản chi tiết mở bằng nút "Thêm mới" thay vì luôn hiện.
- Kiểm thử cần thực hiện: CT-15f1-1 đến CT-15f1-12; cập nhật `tests/e2e/13-fees.spec.ts`, `15-invoices.spec.ts`, `16-receipts.spec.ts`, `17-payments.spec.ts`, `38-finance-g2.spec.ts`.
- Trạng thái: Đã triển khai

## Bảng

Không có bảng mới, không có tệp thay đổi cấu trúc.

## Điểm cuối

Không có điểm cuối mới. `gridKey` của `GET`, `PUT /api/v1/me/grid-settings/{gridKey}` nhận thêm các khóa (`DATA_GRID_KEYS` ở `packages/shared/src/index.ts`):

| Khóa lưới                | Lưới                                         |
| ------------------------ | -------------------------------------------- |
| services                 | Danh mục dịch vụ (1.1)                       |
| discount-types           | Loại miễn giảm (1.1)                         |
| late-registrations       | Đăng ký và hủy sau ngày chốt chờ duyệt (1.2) |
| invoices                 | Bảng tính học phí (1.3)                      |
| fee-approval-discounts   | Miễn giảm chờ duyệt (1.4)                    |
| fee-approval-adjustments | Phiếu điều chỉnh chờ duyệt (1.4)             |
| debts                    | Danh sách công nợ (1.5)                      |
| debt-reminders           | Danh sách nhắc nợ (1.6)                      |
| debt-resolutions         | Đề xuất xử lý công nợ quá hạn (1.6)          |
| receipts                 | Danh sách phiếu thu (2.1)                    |
| receipt-reversals        | Phiếu đảo chờ duyệt (2.1)                    |
| payments                 | Danh sách phiếu chi (2.2)                    |
| payment-approvals        | Phiếu chi chờ duyệt (2.2)                    |
| payment-reversals        | Phiếu đảo phiếu chi chờ duyệt (2.2)          |
| cash-accounts            | Quỹ và tài khoản của đơn vị (2.3)            |
| payables                 | Bảng phải trả (2.6)                          |
| cashflow-categories      | Khoản mục và nhóm thu chi (2.7)              |
| ledger-accounts          | Danh sách tài khoản kế toán (3.1)            |
| ledger-rules             | Danh sách quy tắc ghi sổ (3.1)               |
| fiscal-periods           | Kỳ tài chính (3.2)                           |

## Màn hình

| Màn hình                                                              | Thay đổi                                                                                                                                                                                                                  | Người dùng |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| MH-04 Biểu phí và danh mục dịch vụ (1.1)                              | Tiêu đề có số; Danh mục dịch vụ, Loại miễn giảm dùng lưới, Thêm mới và Sửa theo biểu mẫu khối, nút Ghi; biểu phí giữ bảng bậc học nhân khoản phí, tên và tháng theo khối, nút Ghi, xóa có xác nhận                        | Như cũ     |
| MH-05 Đăng ký dịch vụ (1.2)                                           | Tiêu đề có số, cột Học sinh; bảng đăng ký giữ bố cục ma trận; danh sách chờ duyệt dùng lưới                                                                                                                               | Như cũ     |
| MH-06 Học phí (1.3)                                                   | Tiêu đề có số; Bảng tính học phí dùng lưới, tìm theo học sinh, số hóa đơn, mở rộng tìm kiếm theo loại, trạng thái; Chi tiết dưới dòng                                                                                     | Như cũ     |
| MH-07 Duyệt miễn giảm và điều chỉnh (1.4)                             | Tiêu đề có số; hai danh sách chờ duyệt dùng lưới                                                                                                                                                                          | Như cũ     |
| MH-08 Công nợ (1.5), Nhắc nợ và xử lý quá hạn (1.6)                   | Tiêu đề có số; danh sách công nợ, nhắc nợ (ô chọn của lưới), đề xuất xử lý dùng lưới; lọc quá hạn, cần nhắc ở Mở rộng tìm kiếm; biểu mẫu đề xuất theo khối                                                                | Như cũ     |
| MH-09 Phiếu thu (2.1)                                                 | Tiêu đề có số; danh sách phiếu thu và phiếu đảo chờ duyệt dùng lưới; khoảng ngày, trạng thái ở Mở rộng tìm kiếm. Giao dịch chuyển khoản chờ xử lý giữ nguyên                                                              | Như cũ     |
| MH-10 Phiếu chi (2.2)                                                 | Tiêu đề có số; danh sách phiếu chi, phiếu chi chờ duyệt, phiếu đảo phiếu chi chờ duyệt dùng lưới; Thêm mới mở biểu mẫu Lập phiếu chi theo khối (Ghi, Ghi và trình duyệt); xóa nháp có xác nhận                            | Như cũ     |
| MH-11 Quỹ và ngân hàng (2.3), Sổ quỹ (2.4), Đối chiếu ngân hàng (2.5) | Tiêu đề có số; quỹ và tài khoản dùng lưới (Thêm mới, Sửa theo khối); Tài khoản nhận thanh toán trực tuyến giữ nguyên; sổ quỹ giữ bố cục sổ; đối chiếu giữ bố cục hai bên, ghi dòng sao kê theo khối, xóa dòng có xác nhận | Như cũ     |
| MH-61 Nợ nhà cung cấp (2.6)                                           | Tiêu đề có số; Bảng phải trả dùng lưới; lập tay theo khối, nút Ghi                                                                                                                                                        | Như cũ     |
| MH-39 Khoản mục thu chi (2.7)                                         | Tiêu đề có số; lưới, Thêm mới và Sửa theo khối                                                                                                                                                                            | Như cũ     |
| MH-67, MH-68, MH-69 Sổ kế toán (3.1)                                  | Tiêu đề có số; nhật ký, sổ cái, cân đối giữ bố cục sổ; bút toán thủ công theo khối; hệ thống tài khoản và quy tắc ghi sổ dùng lưới, biểu mẫu khối, bỏ quy tắc có xác nhận                                                 | Như cũ     |
| MH-62 Chốt kỳ tài chính (3.2)                                         | Tiêu đề có số; danh sách kỳ dùng lưới, mở rộng tìm kiếm theo trạng thái; ô ghi chú đề nghị, lý do từ chối giữ ở đầu trang                                                                                                 | Như cũ     |

## Quyền

| PQ | Không có quyền mới, không đổi mã quyền. Nút và danh sách hiện theo đúng điều kiện quyền cũ của từng trang; máy chủ vẫn kiểm tra quyền ở mọi yêu cầu (AI-12). Cấu hình lưới không cần quyền riêng |

## Kết quả kiểm thử

Kiểm thử giao diện ngày 15/10/2026:

- CT-15f1-1: Kế toán mở 1.1, bấm Thêm mới ở Danh mục dịch vụ, nhập Mã, Tên dịch vụ, bấm Ghi: dòng STEM "Theo tháng" hiện trong lưới; dịch vụ bán trú có sẵn là Bắt buộc — đạt.
- CT-15f1-2: Tạo phiên bản biểu phí, nhập tên, tháng hiệu lực và mức phí, bấm Ghi: phiên bản "Chưa hiệu lực" với đúng mức phí — đạt.
- CT-15f1-3: Thêm mới loại miễn giảm 10% áp dụng Bán trú, bấm Ghi: dòng ANH_CHI_EM "10%" hiện trong lưới Loại miễn giảm — đạt.
- CT-15f1-4: Kế toán trưởng mở 2.7, Thêm mới khoản mục thu, Ghi; quản lý đơn vị mở 1.1: khoản mục hiện loại Thu; quản lý đơn vị không có nút Tạo phiên bản biểu phí — đạt.
- CT-15f1-5: Kế toán mở 1.3 chọn đơn vị, kỳ: dòng "Hóa đơn <học sinh>" có số hóa đơn và tổng; Chi tiết mở chi tiết hóa đơn dưới dòng, lập miễn giảm được — đạt.
- CT-15f1-6: Hiệu trưởng mở 1.4: dòng miễn giảm có căn cứ; Duyệt trong nhóm "Miễn giảm của …" thì danh sách báo "Không có miễn giảm chờ duyệt." — đạt.
- CT-15f1-7: Kế toán mở 2.3, Thêm mới quỹ với số dư đầu 1.000.000, Ghi; mở 1.5, Chi tiết công nợ, lập phiếu thu; quay lại 2.3: quỹ có số dư 1.000.000 rồi 3.893.000; công nợ "Đã thu đủ" — đạt.
- CT-15f1-8: Kế toán lập phiếu đảo phiếu thu dưới dòng; Hiệu trưởng thấy dòng phiếu đảo có lý do và "Cần Hiệu trưởng duyệt", bấm Duyệt: phiếu gốc "Đã đảo", học sinh còn phải nộp lại — đạt.
- CT-15f1-9: Kế toán mở 2.2, Thêm mới, nhập phiếu chi kèm chứng từ, bấm "Ghi và trình duyệt"; Hiệu trưởng thấy dòng chờ duyệt có nội dung chi, Duyệt; sổ quỹ có phiếu PC: trạng thái Chờ duyệt rồi Đã phát hành, số dư cuối kỳ 800.000 — đạt.
- CT-15f1-10: Kế toán lập phiếu đảo phiếu chi dưới dòng; Hiệu trưởng duyệt trong lưới phiếu đảo phiếu chi chờ duyệt: phiếu chi "Đã đảo", số dư cuối kỳ 1.000.000 — đạt.
- CT-15f1-11: Kế toán mở 1.6, tích ô chọn của dòng quá hạn, bấm "Gửi nhắc nợ (1)", lập đề xuất xử lý; Phó Hiệu trưởng ghi quyết định ở nhóm "Quyết định cho …": thông báo "Đã gửi 1 nhắc nợ", dòng về "Mốc 7"; kế toán không có nút Ghi quyết định; dòng đề xuất "Đã quyết định" kèm nội dung và số nợ 1.800.000 — đạt.
- CT-15f1-12: Kế toán trưởng mở 3.1 (tiêu đề "3.1. Sổ kế toán"), ghi sổ chứng từ, ghi bút toán thủ công lệch rồi cân; Đối chiếu ngân hàng nhập tệp sao kê, lập phiếu thu từ đề xuất: báo lỗi Nợ, Có lệch, ghi được bút toán, sổ cân; dòng sao kê "Đã khớp" có nút Bỏ khớp — đạt.

- Kiểm thử đơn vị (`pnpm -r --workspace-concurrency=1 --no-bail test`): 710/710 đạt; `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` đạt.

- Kiểm thử giao diện (`pnpm test:e2e`): 91/91 đạt.

## Hạn chế

- Không chuyển sang lưới (giữ bố cục, chỉ đổi tiêu đề và biểu mẫu) theo `logs-15f-brief.md` mục Rules: bảng đăng ký dịch vụ (ma trận học sinh nhân dịch vụ, cột thay đổi theo dịch vụ), biểu phí theo phiên bản (bảng bậc học nhân khoản phí), Sổ quỹ (sổ có số dư lũy kế), Đối chiếu ngân hàng (hai danh sách đặt cạnh nhau để khớp), thẻ Nhật ký chung, Sổ cái, Cân đối số phát sinh của Sổ kế toán (sổ kế toán). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Các phần con giữ nguyên giao diện: chi tiết hóa đơn (lập miễn giảm, phiếu điều chỉnh), biểu mẫu lập phiếu thu trong chi tiết công nợ, Giao dịch chuyển khoản chờ xử lý, Tài khoản nhận thanh toán trực tuyến, Nhập tệp sao kê, Chứng từ mua chưa ghi công nợ; sẽ đổi khi có yêu cầu riêng.
- Lưới lọc, tìm, phân trang tại chỗ trên dữ liệu đã tải (các điểm cuối hiện trả cả danh sách của đơn vị, kỳ); không đổi API.
- Chưa có nút Xuất Excel, Xuất PDF ở các lưới vì các danh sách này trước đây chưa có chức năng xuất (Sổ kế toán giữ nút xuất sẵn có).
- Danh sách chờ duyệt cho nhập lý do từ chối ở từng dòng như trước; chưa có duyệt hàng loạt.
- Ô "Tài khoản ngân hàng" của Đối chiếu ngân hàng, ô Kỳ, Đơn vị vẫn nằm ở đầu trang, không vào Mở rộng tìm kiếm vì quyết định dữ liệu tải về.
- Nút "Ghi sổ bút toán", "Ghi đã trả", "Gửi duyệt phiếu đảo", "Gửi đề xuất", "Ghi quyết định" giữ tên vì là thao tác nghiệp vụ, không phải nút lưu biểu mẫu.
