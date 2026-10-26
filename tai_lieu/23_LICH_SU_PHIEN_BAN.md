# 23. LỊCH SỬ PHIÊN BẢN

- Mô tả: Mã phiên bản, ngày phát hành, danh sách thay đổi, chức năng mới, lỗi đã sửa, thay đổi dữ liệu, thay đổi API, rủi ro, khả năng tương thích, phương án quay lui.
- Phiên bản: 0.64
- Ngày cập nhật: 2026-10-26
- Trạng thái: Đang cập nhật
- Đã rà duyệt: Eric, ngày 2026-10-09

## 1. Quy ước

1. Mỗi phiên bản phát hành ghi một mục, xếp mới nhất lên đầu.
2. Mỗi mục ghi rõ: mã phiên bản, ngày phát hành, phạm vi thay đổi, chức năng mới, lỗi đã sửa, thay đổi dữ liệu, thay đổi API, rủi ro, khả năng tương thích và phương án quay lui.
3. Phiên bản đánh số theo dạng chính.phụ.sửa. Tăng số chính khi thay đổi phá vỡ tương thích, tăng số phụ khi thêm chức năng, tăng số sửa khi sửa lỗi.
4. Bản phần mềm 1.0.0, 1.1.0, 1.2.0 được Eric nghiệm thu ngày 13/10/2026, gắn thẻ `v1.0.0`, `v1.1.0`, `v1.2.0` (YCTD-92), ứng với phiên bản tài liệu 0.31.0, 0.42.0, 0.48.0. Các mục dưới đây ghi các mốc của bộ tài liệu.
5. Từ phiên bản 0.4.0, mỗi mục ghi theo mẫu của Vibecoding_Flow; các mục trước giữ nguyên dạng bảng và tên tệp cũ vì là ghi nhận lịch sử.

## 2. Danh sách phiên bản

### Phiên bản 0.147.0 – 2026-10-26

- Phạm vi thay đổi: DT-25 bước 25b, giao diện đăng nhập và liên kết bằng nhà cung cấp định danh bên ngoài (YCTD-226).
- Chức năng mới: nút "Đăng nhập bằng <nhà cung cấp>" trên màn hình đăng nhập của cổng quản trị, ứng dụng giáo viên, ứng dụng phụ huynh (chỉ hiện khi trường đã bật); trang quay về `/dang-nhap/ben-ngoai` (có bước nhập mã hai lớp); mục "Liên kết tài khoản" ở Tài khoản của tôi (cổng quản trị) và màn hình chính của ứng dụng phụ huynh (liên kết, gỡ liên kết, nhật ký); khối cấu hình của trường ở Danh sách người dùng.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: không.
- Thay đổi API: không (dùng nhóm `/auth/external/*` của 0.142.0).
- Kiểm thử: e2e spec 165 thêm ca giao diện (liên kết, đăng nhập bằng nút, gỡ liên kết, nút ẩn khi trường tắt); kết quả trên máy 13/13 cùng spec 01.
- Rủi ro: thấp; ở tên miền chung (đăng nhập theo đơn vị của DT-24) không hiện nút, người dùng mở trang đăng nhập riêng của trường.
- Khả năng tương thích: trường chưa bật nhà cung cấp thì không có gì thay đổi trên màn hình.
- Phương án quay lui: tắt nhà cung cấp ở trường; hoàn lại commit gộp.

### Phiên bản 0.144.0 – 2026-10-26

- Phạm vi thay đổi: DT-23 phần 23a, thi trực tuyến cho học sinh (YCTD-211).
- Chức năng mới: kênh đăng nhập `student` và vai trò học sinh nối với tài khoản học và thi; giao đề đã khoá cho lớp, học sinh; làm bài có đồng hồ máy chủ, lưu nháp từng câu, chấm tự động; khóa toàn màn hình, camera kiểm tra có mặt và nhiều khuôn mặt ngay trên máy học sinh (chỉ gửi sự kiện); theo dõi, chấm tự luận, công bố kết quả; bài nộp vào phiếu chấm 22g2 để chuyển sổ điểm có giáo viên xác nhận; công tắc theo cấp; phân hệ "Thi trực tuyến".
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0120` đến `0123`; tệp định danh `0120`, `0121`.
- Thay đổi API: `/online-exams/…`, `/student/…`, `POST /users/student-accounts/sync`, kênh `student` của `POST /auth/login`.
- Kiểm thử: kịch bản CT-1097 đến CT-1107. Kết quả ngày 26/10/2026: kiểm thử đơn vị `apps/api/src/online-exams/online-exam-rules.test.ts` (CT-23a-1a đến CT-23a-1h) và `online-exams.test.ts` (CT-23a-2 đến CT-23a-9) đạt; kiểm thử đơn vị toàn kho đạt (lượt đầy đủ 1.441/1.441 trước khi gộp main; sau đó bộ 23a, 22g, tenancy-matrix, định danh đạt); kiểm thử giao diện `tests/e2e/150-online-exams.spec.ts` (CT-23a-10) cùng 02, 03, 07, 58, 101 đạt; toàn bộ kiểm thử giao diện để CI chạy toàn bộ; trên máy chạy riêng 02, 03, 06, 07, 08, 58, 83, 101 và 150 đạt; kiểm tĩnh đa thuê bao, ma trận cách ly, kiểm thử hai bố cục cơ sở dữ liệu `database` và `schema`, build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: học sinh xem đáp án hoặc dữ liệu bạn khác (đáp án không xuống máy học sinh, tuyến `/student/*` chỉ trả dữ liệu của chính học sinh, mã phiên kênh `student` chỉ gọi nhóm này); lộ hình ảnh trẻ em (không có hình nào rời khỏi máy học sinh); mất bài khi mất mạng (đồng hồ máy chủ, lưu nháp từng câu, làm tiếp); gian lận (khóa toàn màn hình, camera, một phiên, điểm do giáo viên xác nhận; không hứa tuyệt đối).
- Khả năng tương thích: không đổi hành vi cũ; tài khoản học và thi cấp trước cần cấp lại mật khẩu một lần để đăng nhập làm bài.
- Phương án quay lui: hoàn lại commit gộp của nhánh 23a; chạy phần quay lui của tệp năm học `0123` đến `0120` và định danh `0121`, `0120`.

### Phiên bản 0.143.0 – 2026-10-26

- Phạm vi thay đổi: DT-23 phần 23d, trợ lý AI soạn câu hỏi nháp và kế hoạch bài dạy nháp (YCTD-214).
- Chức năng mới: màn hình 3.8 Trợ lý AI của trường (P01-86, MH-339); Soạn nháp bằng AI ở ngân hàng câu hỏi và kho học liệu (P01-87, P01-88, MH-340); trang Trợ lý AI và giới hạn AI của gói ở cổng nền tảng, dòng phí AI trên hóa đơn dịch vụ (P01-89, MH-341). Quy tắc BR-234 đến BR-236, quyết định QĐ-35, bảo mật BM-92.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: năm học `0128`; hệ thống `0071` đến `0073`; nền tảng `0200` đến `0202`; xem `16_CO_SO_DU_LIEU.md` mục 18E.
- Thay đổi API: nhóm `/ai/*` ở máy chủ API, `/auth/platform/ai` ở dịch vụ định danh, kết nối `ai` ở `/school-settings/integrations`; biến `AI_MOCK`; câu hỏi trả thêm `ai_generated`.
- Kiểm thử: kịch bản CT-1084 đến CT-1096 (CT-23d-1 đến CT-23d-16, CT-AI-1, CT-AI-2 trong mã kiểm thử). Kết quả ghi ở PR 184.
- Rủi ro: dữ liệu cá nhân lọt qua bộ quét ở mô tả tự do (đã nêu ở PL-22); đơn giá và nhà cung cấp chưa nhập; mức rủi ro theo Luật Trí tuệ nhân tạo chờ luật sư.
- Khả năng tương thích: mặc định tắt nên trường hiện có không đổi; câu hỏi cũ có `ai_generated = false`.
- Phương án quay lui: tắt AI theo trường hoặc hoàn lại commit gộp của nhánh 23d; các cột thêm có mặc định nên không cần quay lui dữ liệu.
### Phiên bản 0.142.0 – 2026-10-26

- Phạm vi thay đổi: DT-25, bộ nối nhà cung cấp định danh OIDC sẵn cho VNeID, phần máy chủ (YCTD-225).
- Chức năng mới: lớp `IdentityProvider` và bộ nối OIDC chung (PKCE, state, nonce, discovery, JWKS, quay khóa), hồ sơ `vneid` cấu hình được (mục chờ tài liệu RAR); nền tảng khai nhà cung cấp, trường bật tắt, chọn nhóm vai trò, mã ứng dụng và khóa riêng; liên kết, gỡ liên kết bằng mật khẩu và mã hai lớp; đăng nhập bằng nhà cung cấp ngoài có bước nhập mã hai lớp; nhật ký liên kết.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: cơ sở dữ liệu định danh thêm `external_identity_providers`, `external_identities`, `external_identity_events` (migration 0140); `sessions.login_method` nhận thêm `external_provider`.
- Thay đổi API: nhóm `/auth/external/*` ở dịch vụ định danh; biến môi trường `EXTERNAL_IDENTITY_PROVIDERS`, `EXTERNAL_IDENTITY_<MÃ>_CLIENT_SECRET`.
- Kiểm thử: kiểm thử đơn vị `external-identity` 24 ca (khai báo 6, luồng một trường 13, cách ly hai trường 5); ma trận cách ly, các ca đăng nhập, xác thực hai lớp, nhiều trường hiện có đạt; kiểm tĩnh đa thuê bao đạt; e2e spec 165.
- Rủi ro: tham số kỹ thuật của RAR có thể khác giả định (đổi cấu hình, hoặc viết bộ nối mới theo `IdentityProvider`); vai trò pháp lý của nhà cung cấp định danh trong PL-02, PL-05 chờ luật sư.
- Khả năng tương thích: không khai nhà cung cấp hoặc trường chưa bật thì không có gì thay đổi; chưa có giao diện (bước 25b sau DT-24).
- Phương án quay lui: tắt nhà cung cấp ở trường hoặc bỏ biến `EXTERNAL_IDENTITY_PROVIDERS`; hoàn lại commit gộp; migration 0140 có `down` (xóa ba bảng, trả ràng buộc cũ).

### Phiên bản 0.141.0 – 2026-10-26

- Phạm vi thay đổi: DT-24, danh mục đơn vị toàn quốc, đăng nhập theo đơn vị, quyền vào mọi trường của quản trị nền tảng (YCTD-220).
- Chức năng mới: danh mục đơn vị (sở, cấp học, phường xã, trường theo mã Bộ) nhập từ CSV bằng lệnh `platform catalog-import`, `catalog-seed` hoặc trang Danh mục đơn vị của cổng nền tảng, có chạy thử, báo cáo, cờ chất lượng; gắn trường với mã Bộ khi khởi tạo hoặc ở chi tiết trường; trang đăng nhập bố cục "Đăng nhập hệ thống" có ô chọn Sở → Cấp học, Phường/Xã → Trường ở tên miền chung và chuyển phiên một lần sang tên miền của trường; chính sách vào mọi trường của quản trị nền tảng (mặc định bật, nhập lại mã xác thực hai lớp, lý do, có hạn, biểu ngữ, nhật ký trường xem được).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: nền tảng 0210 (`catalog_departments`, `catalog_levels`, `catalog_communes`, `catalog_units`, `catalog_unit_levels`, `catalog_import_runs`), 0211 (`schools.moet_code`, `support_sessions.access_basis`, cài đặt `support_access_policy`); định danh 0130 (`login_handoffs`).
- Thay đổi API: nhóm `/auth/directory/*`, `/auth/handoff/exchange`, `/auth/platform/catalog*`, `/auth/platform/schools/:code/catalog-unit`, `/auth/platform/login-page`, `/auth/platform/support-policy`; `support-sessions` nhận `otp_code`, `scope`, `hours`; `/platform-notices`, `/support-access` trả thêm `access_basis`, `reason`.
- Kiểm thử: CT-24-1 đến CT-24-10 trong mã kiểm thử. Kết quả ngày 26/10/2026 ghi ở `02_NHAT_KY_DU_AN.md` mục cùng ngày.
- Rủi ro: quyền vào trường không cần đồng ý phải nằm trong thỏa thuận xử lý dữ liệu đã ký (PL-02 Điều 5a), luật sư rà trước khi nhận dữ liệu thật; danh mục lấy từ trang công khai chỉ dùng làm dữ liệu tham chiếu (GD-109).
- Khả năng tương thích: tên miền của trường và chế độ một trường giữ hành vi đăng nhập; phiên hỗ trợ theo cho phép của S4 và phiên của cấp trên S6 không đổi; cổng biên thử nghiệm đổi gốc tên miền hệ thống từ trang chọn trường sang trang đăng nhập theo đơn vị (trang chọn trường vẫn ở đường dẫn cũ của API).
- Phương án quay lui: đổi chính sách sang `school_grant` ở cổng nền tảng để ngừng quyền vào không cần đồng ý mà không cần quay lui mã; hoàn lại commit gộp của nhánh DT-24 để bỏ cả tính năng (bảng danh mục để lại không ảnh hưởng).

### Phiên bản 0.140.0 – 2026-10-26

- Phạm vi thay đổi: DT-23 phần 23b, công cụ lớp học trên ứng dụng giáo viên (YCTD-212).
- Chức năng mới: gọi tên ngẫu nhiên, chia nhóm, đếm ngược và bấm giờ (P03-09, MH-337); bảng điểm nhanh gắn nề nếp, thi đua có xác nhận của giáo viên (P03-10); ngoại tuyến bằng service worker và manifest, bản chụp danh sách lớp gọn lưu 24 giờ, hàng đợi lượt gọi và điểm đồng bộ khi có mạng, công tắc tắt ngoại tuyến theo trường (P03-11, MH-338).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: cơ sở dữ liệu năm học thêm `classroom_call_logs`, `classroom_groupings` (tệp `0124`), `classroom_score_events` (tệp `0125`); hai mục cấu hình trường `classroom_offline_enabled`, `classroom_roster_ttl_hours` ở bảng `settings`; xem `16_CO_SO_DU_LIEU.md` mục 18E.
- Thay đổi API: nhóm `/classroom-tools` (cấu hình, danh sách lớp, lượt gọi, nhóm, dòng điểm, chuyển vào nề nếp) (xem `17_DAC_TA_API.md`).
- Kiểm thử: kịch bản CT-1078 đến CT-1083 (CT-23b-1 đến CT-23b-14 trong mã kiểm thử). Kết quả ngày 26/10/2026: `apps/teacher` 10/10 (`node --test`, CT-23b-1 đến CT-23b-4); `apps/api` 9/9 ca của `classroom-tools.test.ts` (CT-23b-5 đến CT-23b-13) và ma trận cách ly mọi tuyến 5/5; `database` 103/103 (tệp 0124, 0125 chạy ở cả hai bố cục `database`, `schema`); kiểm tĩnh đa thuê bao và quét bí mật đạt; `pnpm lint` đạt; typecheck, build `apps/teacher`, `apps/api` đạt; e2e spec 151 đạt (CT-23b-14) trên bố cục `database` sau chuỗi spec 02 đến 08; spec 121 (ứng dụng giáo viên) đạt, spec 09 trên máy phát triển hỏng ở bước tải tệp lên kho tệp (không liên quan phần này, CI chạy lại toàn bộ)
- Rủi ro: máy giáo viên bị mất khi bản chụp danh sách lớp chưa hết hạn (giảm bằng hạn ngắn, xóa khi đăng xuất, công tắc tắt theo trường); tiếng báo hết giờ không vang khi màn hình tắt và trình duyệt tạm dừng trang (đồng hồ vẫn đúng, tiếng báo khi mở lại hoặc khi giữ màn hình sáng); trình duyệt cũ không có service worker thì công cụ chỉ chạy khi có mạng.
- Khả năng tương thích: không đổi hành vi các phân hệ cũ; trường không dùng công cụ lớp học không thấy khác biệt ngoài một nút ở Lớp của tôi; trường tắt ngoại tuyến thì ứng dụng gỡ service worker.
- Phương án quay lui: hoàn lại commit gộp của nhánh 23b; hai tệp năm học 0124, 0125 chỉ thêm bảng nên giữ lại không ảnh hưởng.

### Phiên bản 0.139.0 – 2026-10-26

- Phạm vi thay đổi: DT-SaaS phần S6, đơn vị cấp trên (YCTD-202).
- Chức năng mới: cây đơn vị và tài khoản cấp trên ở cổng nền tảng (P01-82, MH-334); trang Đơn vị cấp trên `/cap-tren` với số liệu tổng hợp, so sánh trường, xuất Excel, PDF (P01-83, MH-335); Chia sẻ số liệu cấp trên ở cổng quản trị của trường (P01-84, MH-336); đề nghị xem chi tiết qua phiên hỗ trợ chỉ đọc (P01-85). Quy tắc BR-228 đến BR-230, quyết định QĐ-33, bảo mật BM-90.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: cơ sở dữ liệu nền tảng thêm `admin_units`, `parent_org_users`, `parent_org_user_totp`, `parent_org_user_recovery_codes`, `school_aggregate_consents`, `aggregate_snapshots`, `parent_org_access_requests`, cột `schools.admin_unit_id`, cột `support_sessions.requester_kind`, `access_request_id` (tệp nền tảng `0090`); xem `16_CO_SO_DU_LIEU.md` mục 18D.
- Thay đổi API: nhóm `/auth/platform/admin-units`, `/auth/platform/parent-org-users`, `/auth/parent-org/*` ở dịch vụ định danh; `/parent-org-consents`, `/parent-org/aggregate`, `/parent-org/aggregate/export` ở máy chủ API; biến `AGGREGATE_SNAPSHOT_INTERVAL_SECONDS`, `PARENT_ORG_MIN_GROUP`; máy chủ API đọc thêm `PLATFORM_CONSOLE_HOST`.
- Kiểm thử: kịch bản CT-1069 đến CT-1077 (CT-S6-1 đến CT-S6-9 trong mã kiểm thử). Kết quả ngày 26/10/2026: `database` 4/4 (và đổi khóa gốc 4/4); `apps/identity` 3 ca mới cùng phiên hỗ trợ S4 và ma trận cách ly đạt; `apps/api` 6 ca ở hai bố cục `database`, `schema` (CT-S6-8 ở bố cục `database`) và ma trận cách ly đạt (10/10); kiểm tra tĩnh nền đa thuê bao 6/6, `pnpm lint` đạt; e2e spec 139 và 136 ở dự án nhiều trường đạt; e2e toàn bộ do CI chạy.
- Rủi ro: số liệu trễ đến một chu kỳ bản chụp (mặc định 6 giờ); ngưỡng ẩn nhóm nhỏ là giả định, cần Eric chốt; danh mục hành chính sẵn có mới có TP.HCM, tỉnh, thành khác phải nạp từ văn bản gốc.
- Khả năng tương thích: chế độ một trường không có đơn vị cấp trên (trang đồng ý báo không áp dụng); không đổi phiên hỗ trợ của S4.
- Phương án quay lui: hoàn lại commit gộp của nhánh S6; rút mọi đồng ý là cấp trên không còn thấy số liệu mà không cần quay lui mã.

### Phiên bản 0.138.0 – 2026-10-25

- Phạm vi thay đổi: DT-SaaS phần S4, bảng điều khiển nền tảng (YCTD-197).
- Chức năng mới: bảng điều khiển nền tảng với số liệu, lỗi, cảnh báo theo trường (P01-78, MH-330); thông báo bảo trì (P01-79, MH-331); cho phép hỗ trợ của trường (P01-80, MH-332); phiên hỗ trợ của nhân viên nền tảng, đăng nhập bằng đường liên kết một lần, biểu ngữ (P01-81, MH-333).
- Lỗi đã sửa: unit gói `database` ở bố cục `schema` có lúc hỏng "out of shared memory" (53200) khi nhiều trường tạo, gỡ năm học cùng lúc: chạy tệp thay đổi cấu trúc mỗi tệp một giao dịch thay vì mọi tệp một giao dịch, gỡ lược đồ theo lô 40 bảng; CI và hồ sơ vận hành đặt `max_locks_per_transaction` 256; ghi giới hạn của Neon, Supabase ở `deploy/profiles/trial/README.md`.
- Thay đổi dữ liệu: cơ sở dữ liệu nền tảng thêm `school_metrics`, `school_error_counts`, `maintenance_notices`, `support_sessions`, `support_session_actions` (tệp nền tảng `0060`); cơ sở dữ liệu hệ thống của trường thêm `support_access_grants` (tệp hệ thống `0053`); xem `16_CO_SO_DU_LIEU.md` mục 18A.
- Thay đổi API: nhóm `/auth/platform/dashboard`, `/maintenance-notices`, `/schools/{mã}/support`, `/support-sessions`; `POST /auth/support/exchange`; `GET /platform-notices`, `/support-access`; claim `spt`, trường `support` của `/auth/me`; biến `PLATFORM_ERROR_ALERT_PER_HOUR`, `SCHOOL_METRICS_INTERVAL_SECONDS` (xem `17_DAC_TA_API.md`).
- Kiểm thử: kịch bản CT-1060 đến CT-1068 (CT-S4-1 đến CT-S4-9 trong mã kiểm thử). Kết quả ngày 25/10/2026: `apps/identity` 4 ca mới và ma trận cách ly đạt (8/8); `database` 4/4; `apps/api` 17/17 (S4, gói dịch vụ, bộ lập lịch) và menu 17/17; kiểm tra tĩnh nền đa thuê bao và `pnpm lint` đạt; e2e dự án nhiều trường 16/16 (spec 136 đạt sau khi sửa trang Cho phép hỗ trợ thiếu khung cổng quản trị); e2e toàn bộ do CI chạy.
- Rủi ro: số liệu có độ trễ đến một giờ; bộ gom lỗi ở bộ nhớ nên lỗi trong phút cuối trước khi tiến trình dừng đột ngột có thể mất; tài khoản hỗ trợ hiện trong danh sách tài khoản của trường (cố ý để trường thấy).
- Khả năng tương thích: chế độ một trường không có bảng điều khiển, cho phép hỗ trợ trả `available: false`, thông báo bảo trì rỗng; không đổi hành vi của phiên thường.
- Phương án quay lui: hoàn lại commit gộp của nhánh S4; rút mọi cho phép hỗ trợ là chặn ngay mọi phiên hỗ trợ mà không cần quay lui mã.

### Phiên bản 0.137.0 – 2026-10-25

- Phạm vi thay đổi: DT-SaaS phần S5b, thu phí tự động (YCTD-196).
- Chức năng mới: quy tắc tính phí cấu hình được, chốt số liệu kỳ, hóa đơn (P01-75); thu tiền qua mã QR và cổng của nền tảng, đối soát, gia hạn và mở lại trường, nhắc gia hạn (P01-76); trang Thu phí ở cổng nền tảng, điều chỉnh tay, hóa đơn điện tử qua bộ nối giả lập, trang Hóa đơn dịch vụ ở cổng (P01-77, MH-328, MH-329).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: nền tảng thêm `price_rules`, `usage_snapshots`, `invoices`, `invoice_lines`, `invoice_payments`, `billing_adjustments`, `einvoice_documents`, `dunning_events`, `platform_integration_secrets`, cột `plans.price_rule_id` (tệp nền tảng `0050`); định danh thêm quyền `P01.billing.manage` (tệp `0105`).
- Thay đổi API: nhóm `/billing` của trường, điểm nhận tiền vào `/platform-billing/webhooks`, nhóm `/auth/platform/billing` (xem `17_DAC_TA_API.md`).
- Kiểm thử: kịch bản CT-1049 đến CT-1059 (CT-S5b-1 đến CT-S5b-11 trong mã kiểm thử). Kết quả ngày 25/10/2026: `database` 7 ca mới (hàm tính phí, kỳ, chốt kỳ, tiền vào, điều chỉnh, nhắc hạn, hóa đơn điện tử, khóa cổng), `apps/api` 2 ca mới, `apps/identity` 1 ca mới, ca cũ đạt không sửa; e2e spec 135 cùng 130, 131, 134 ở dự án nhiều trường và các spec menu ở dự án một trường đạt; e2e toàn bộ do CI chạy.
- Rủi ro: tài khoản nhận tiền và khóa cổng thật của nền tảng chưa có (GD-95), máy chủ dùng bộ giả lập khi chưa cấu hình; nhà cung cấp hóa đơn điện tử chưa chốt (mặc định chưa nối); VNPay cho thu phí của nền tảng chưa làm; nhắc qua email chưa có (dùng thông báo trong ứng dụng, tin nhắn).
- Khả năng tương thích: chế độ một trường không đổi; trường chưa gán gói không phát sinh hóa đơn.
- Phương án quay lui: hoàn lại commit gộp của nhánh S5b; tắt thu phí bằng cách bỏ quy tắc tính phí khỏi gói (giá niêm yết bằng 0) và hủy hóa đơn chưa thu; dữ liệu trường không bị ảnh hưởng.
### Phiên bản 0.136.0 – 2026-10-25

- Phạm vi thay đổi: DT-SaaS phần S8b, bảo mật mã (YCTD-201).
- Chức năng mới: xác thực hai lớp TOTP (bắt buộc cho tài khoản vận hành nền tảng, tuỳ chọn theo trường cho người dùng trường; P01-71, P01-72, MH-325, MH-326); chính sách mật khẩu và khóa tạm theo trường (P01-73, MH-327); tiêu đề bảo mật, cookie `__Secure-`, xoay khóa ký hai pha, quét bí mật và thành phần phụ thuộc ở CI (P01-74); đổi khóa dữ liệu trẻ nay gồm cơ sở dữ liệu định danh.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: `platform_operator_totp`, `platform_operator_recovery_codes` (nền tảng `0080`, `0081`); `user_totp`, `user_recovery_codes` (định danh `0101`, `0102`); xem `16_CO_SO_DU_LIEU.md` mục 18C.
- Thay đổi API: `/auth/totp` (5 điểm cuối); `otp_code` ở đăng nhập; `totp_enabled`, ba mục chính sách mật khẩu mới; biến môi trường `TOTP_ENCRYPTION_KEY` (chế độ một trường), `TOKEN_PREVIOUS_PUBLIC_KEY`; lệnh `reset-operator-totp`; `create-platform-operator` cần `PLATFORM_MASTER_KEY` và in khóa TOTP, mã khôi phục (xem `17_DAC_TA_API.md`).
- Kiểm thử: kịch bản CT-1043 đến CT-1048. Kết quả ngày 25/10/2026: packages/server 10 ca mới (TOTP 5, tiêu đề bảo mật 3, xoay khóa ký 2); database 4 ca đổi khóa và bọc lại khóa gốc (gồm cơ sở dữ liệu định danh); apps/identity 97 ca đạt (xác thực hai lớp trường 8 ca mới, vận hành nền tảng 6 ca mới); apps/api 1142 ca đạt (2 ca mới); kiểm tĩnh và quét bí mật 8 ca; e2e nhiều trường 18 ca (spec 130 đến 140, spec 138 có 4 ca) đạt ở cả hai bố cục; e2e một trường các spec 01 đến 07 (23 ca) đạt; e2e toàn bộ do CI chạy.
- Rủi ro: tài khoản vận hành tạo trước phần này không đăng nhập được cho tới khi chạy `reset-operator-totp` (cố ý, vì bắt buộc); ứng dụng phụ huynh không dùng xác thực hai lớp (đăng nhập bằng mã một lần qua tin nhắn); đổi cookie sang `__Secure-` làm mọi người dùng phải đăng nhập lại một lần sau khi nâng cấp; chưa có kiểm thử xâm nhập bên ngoài.
- Khả năng tương thích: chế độ một trường và đăng nhập hiện có giữ nguyên khi trường chưa bật xác thực hai lớp; `GET /auth/settings/password-policy` trả thêm ba trường.
- Phương án quay lui: hoàn lại commit gộp của nhánh S8b; bốn bảng mới chỉ phần này dùng.

### Phiên bản 0.135.0 – 2026-10-25

- Phạm vi thay đổi: DT-SaaS phần S7b, vận hành nhiều trường (YCTD-199).
- Chức năng mới: sao lưu logic theo từng trường ở cả hai bố cục (P01-68); khôi phục vào chính trường hoặc thành trường mới, diễn tập khôi phục tự động (P01-69); chuyển trường sang cụm cơ sở dữ liệu khác (P01-70); khôi phục về một thời điểm của cả cụm bằng WAL-G và lấy riêng một trường; bảng "Sao lưu và khôi phục" ở chi tiết trường (MH-318).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: bảng nền tảng `backup_runs` (tệp `0070_create_backup_runs`); xem `16_CO_SO_DU_LIEU.md` mục 18C.
- Thay đổi API: chi tiết trường ở cổng nền tảng trả thêm `backups`; lệnh `platform backup-school`, `verify-backup`, `restore-school`, `restore-drill`, `move-school` (xem `17_DAC_TA_API.md`); `platform relayout` không còn cần quyền siêu người dùng ở đích.
- Kiểm thử: kịch bản CT-1035 đến CT-1042. Kết quả ngày 25/10/2026: `database/src/school-backup.test.ts` 10 ca (5 ca ở mỗi bố cục `schema`, `database`) và `school-relayout.test.ts` 1 ca đạt 11/11; kiểm tĩnh đa thuê bao 6/6; `pnpm lint` sạch; e2e nhiều trường spec 130, 131, 132, 137, 140 đạt ở bố cục database (12 ca), spec 132, 137 đạt ở bố cục schema; CT-1042 kiểm tay trên staging chờ VPS thử; e2e toàn bộ do CI chạy.
- Rủi ro: khôi phục không nằm trong một giao dịch cho mọi bảng (để không vượt giới hạn khóa của máy chủ), lỗi giữa chừng phải chạy lại; tệp sao lưu chứa khóa dữ liệu trẻ, lộ khóa sao lưu là lộ dữ liệu; WAL-G và lấy riêng một trường về một thời điểm chưa diễn tập trên máy thật; thử tải nhiều trường chưa làm nên giới hạn T1 đến T3 vẫn là giả định.
- Khả năng tương thích: chế độ một trường và `backup.sh` cũ không đổi khi không có `PLATFORM_DATABASE_URL`; lớp phủ WAL-G là tùy chọn.
- Phương án quay lui: hoàn lại commit gộp của nhánh S7b; bảng `backup_runs` chỉ do phần này dùng; tắt lớp phủ `compose.pitr.yml` để PostgreSQL chạy như trước.

### Phiên bản 0.134.0 – 2026-10-25

- Phạm vi thay đổi: DT-SaaS phần S5a, gói dịch vụ và giới hạn (YCTD-194).
- Chức năng mới: gói dịch vụ, phân hệ bật theo gói, giới hạn số học sinh, dung lượng, số cấp học (P01-65); trạng thái trường và chế độ chỉ đọc khi hết hạn (P01-66); trang Gói dịch vụ ở cổng nền tảng, dải báo và lọc menu ở cổng (P01-67, MH-323, MH-324).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: cơ sở dữ liệu nền tảng thêm `plans`, `school_plans`, ba cột của `schools` (tệp nền tảng `0040`, `16_CO_SO_DU_LIEU.md` mục 18A).
- Thay đổi API: `GET /school-plan`, nhóm gói ở `/auth/platform`; mã lỗi `MODULE_NOT_IN_PLAN`, `SCHOOL_READ_ONLY`, `PLAN_LIMIT_EXCEEDED` (xem `17_DAC_TA_API.md`).
- Kiểm thử: kịch bản CT-1027 đến CT-1034 (CT-S5a-1 đến CT-S5a-8 trong mã kiểm thử). Kết quả ngày 25/10/2026: `database` 1 ca, `packages/server` 1 ca, `apps/identity` 1 ca, `apps/api` 4 ca mới đạt, ca cũ của các gói này đạt không sửa; e2e spec 134 và 130 ở dự án nhiều trường, spec 58 và các spec menu ở dự án một trường đạt; e2e toàn bộ do CI chạy.
- Rủi ro: gói nằm trong bản đệm ngữ cảnh trường nên đổi gói, đổi trạng thái có hiệu lực sau `TENANT_CACHE_SECONDS` (mặc định 30 giây); chuyển trạng thái tự động chờ bộ lập lịch của S1b (trước đó chạy bằng lệnh hoặc nút ở cổng nền tảng); dung lượng tính trên tệp đính kèm và học liệu của năm học hiện hành.
- Khả năng tương thích: chế độ một trường và trường chưa gán gói không đổi hành vi.
- Phương án quay lui: hoàn lại commit gộp của nhánh S5a; gỡ gán gói (`school_plans`) và đặt trạng thái trường về `active` là bỏ giới hạn mà không cần quay lui mã.

### Phiên bản 0.133.0 – 2026-10-25

- Phạm vi thay đổi: DT-SaaS phần S3, cấu hình riêng từng trường (YCTD-195).
- Chức năng mới: khóa kết nối ngoài riêng từng trường lưu mã hóa (P01-62, MH-321); đổi khóa mã hóa dữ liệu trẻ có thể làm tiếp và bọc lại khóa gốc (P01-63); thương hiệu của trường (P01-64, MH-322).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: `integration_secrets`, `school_branding` ở cơ sở dữ liệu hệ thống (tệp `0051`, `0052`); `school_key_rotations` ở cơ sở dữ liệu nền tảng (tệp `0030`); xem `16_CO_SO_DU_LIEU.md` mục 18B.
- Thay đổi API: `/school-settings/integrations`, `/school-settings/branding`, `/public/branding` (xem `17_DAC_TA_API.md`); lệnh `platform rotate-child-key`, `platform rewrap-master-key`.
- Kiểm thử: kịch bản CT-1022 đến CT-1026. Kết quả ngày 25/10/2026: database 19 ca (đổi khóa 4 mới, migrate, nền tảng); apps/api 8 ca mới (kiểm tra giá trị 3, hai trường 5) cùng ma trận tuyến, toàn bộ 1136 ca đạt; e2e nhiều trường 11 ca (spec 130 đến 133) đạt ở cả hai bố cục; kiểm tĩnh 6 ca; e2e toàn bộ do CI chạy.
- Rủi ro: cấu hình đọc theo từng lần dùng nên tăng một truy vấn nhỏ (đệm 15 giây); tiến trình khác thấy thay đổi chậm tối đa chừng đó; đổi khóa dữ liệu trẻ phải tạm dừng trường (có thời gian ngừng); kiểm tra kết nối cổng thanh toán chỉ kiểm tra đủ khóa, nhà cung cấp chỉ xác nhận khi có giao dịch thật.
- Khả năng tương thích: chế độ một trường giữ nguyên (khóa ở biến môi trường vẫn dùng khi trường chưa nhập cấu hình riêng); đổi chữ ký `FacebookPublisher`, `ZaloSender` (thêm `isAvailable`, `providerName`), `PaymentGatewayRegistry` (thêm `prepare`).
- Phương án quay lui: hoàn lại commit gộp của nhánh S3; bảng mới chỉ do phần này dùng, khóa ở biến môi trường vẫn dùng được ở chế độ một trường.

### Phiên bản 0.132.0 – 2026-10-25

- Phạm vi thay đổi: DT-SaaS phần S9, triển khai thử nghiệm miễn phí (YCTD-203).
- Chức năng mới: hồ sơ thử nghiệm `deploy/profiles/trial/` với cổng biên Cloudflare Worker, container gộp, ba tổ hợp Render/Koyeb, Neon/Supabase, R2/Supabase Storage, Vercel (P01-59, MH-320); bộ nối tên miền `cloudflare-saas`, `vercel-domains` (P01-60); chính sách dữ liệu của môi trường; lệnh `platform relayout` chuyển trường sang nền tảng, bố cục khác (P01-61).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: cột `school_databases.login_name` (tệp nền tảng `0100`, `16_CO_SO_DU_LIEU.md` mục 18A).
- Thay đổi API: không thêm điểm cuối; lỗi `ERR_SERVICE_WAKING` của cổng biên; lỗi chính sách dữ liệu ở bước setup; biến `DB_HOST_ADAPTER`, `DB_POOLER_HOST`, `DB_POOLER_PORT`, `SUPABASE_PROJECT_REF`, `PLATFORM_DATA_POLICY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `MIGRATE_ON_START`, `MIGRATE_SCHOOLS_ON_START`, `SMS_ALLOW_LOG`, `APP_BASE_PATH`, `REDIS_URL=memory://`, `TARGET_PLATFORM_*` (xem `17_DAC_TA_API.md`).
- Kiểm thử: kịch bản CT-1014 đến CT-1021. Kết quả ngày 25/10/2026: `database` 8 ca mới ở `trial-adapters.test.ts`; `tests` 12 ca (`trial/edge-worker.test.mjs` 9, `trial/container-router.test.mjs` 3); `apps/identity` 1 ca mới (`memory-store.test.ts`); `packages/server` 11 ca `esms-client.test.ts`; `school-relayout.test.ts` 1 ca đạt (chép 3 cơ sở dữ liệu, khớp số dòng và tổng kiểm từng bảng); e2e nhiều trường spec 130, 131, 132, 140 đạt ở bố cục database, spec 132, 140 đạt ở bố cục schema; e2e một trường spec 01 đạt; e2e toàn bộ do CI chạy.
- Rủi ro: chưa dựng thật trên các nhà cung cấp; giới hạn gói miễn phí thay đổi; máy chủ ngủ làm lần mở đầu chậm khoảng một phút; kho khóa trong bộ nhớ không đúng khi chạy nhiều bản; dữ liệu thật ở máy chủ ngoài nước là rủi ro tồn đọng do Eric chấp nhận (PL-09).
- Khả năng tương thích: mặc định giữ hành vi cũ (`DB_HOST_ADAPTER=plain`, `PLATFORM_DATA_POLICY=any`, `APP_BASE_PATH=/`, Redis thật); cột `login_name` trống thì đăng nhập bằng tên vai trò.
- Phương án quay lui: hoàn lại commit gộp của nhánh S9; cột `login_name` để trống không ảnh hưởng mã cũ.

### Phiên bản 0.131.0 – 2026-10-25

- Phạm vi thay đổi: DT-SaaS phần S2, khởi tạo và vòng đời trường (YCTD-193).
- Chức năng mới: khởi tạo trường theo bước setup ở cổng nền tảng và lệnh `platform provision` (P01-54), vòng đời trường: tạm dừng, mở lại, yêu cầu xóa, hủy, xóa vĩnh viễn, xuất dữ liệu (P01-55), tên miền riêng qua bộ nối `DomainProvider`, hồ sơ đồng ý dữ liệu thật (P01-56), kích hoạt quản trị viên đầu tiên (P01-57), migrate cuốn chiếu (P01-58); trang Trường ở cổng nền tảng (MH-316 đến MH-318) và trang Kích hoạt ở cổng quản trị (MH-319).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp nền tảng `0020` đến `0022` (sáu bảng mới, cột mới ở `schools`, `school_domains`), tệp hệ thống `0050_create_terms_acceptances` (xem `16_CO_SO_DU_LIEU.md` mục 18A); không đổi cơ sở dữ liệu định danh, năm học.
- Thay đổi API: nhóm `/api/v1/auth/platform/schools…`, `GET, POST /api/v1/auth/activate` (xem `17_DAC_TA_API.md`); lệnh mới `platform provision`, `provision-resume`, `provision-rollback`, `suspend`, `resume`, `request-deletion`, `cancel-deletion`, `purge-due`, `reissue-invitation`, `verify-domain`, `migrate-schools` và `school-lifecycle-command.js export | purge-due` của máy chủ API.
- Kiểm thử: kịch bản CT-1004 đến CT-1013. Kết quả ngày 25/10/2026: `database` 13 ca mới (`school-lifecycle.test.ts`); `apps/identity` 7 ca mới (`platform-schools.test.ts`), vận hành nền tảng 7 ca và ma trận cách ly 4 ca chạy lại đạt; `apps/api` 2 ca mới; e2e spec 132 và 130 ở dự án nhiều trường; e2e toàn bộ do CI chạy.
- Rủi ro: xóa vĩnh viễn, migrate cuốn chiếu chạy bằng lệnh theo lịch cho tới khi có bộ lập lịch (S1b); máy chủ API khác thấy trạng thái trường đổi chậm tối đa `TENANT_CACHE_SECONDS`; khởi tạo chạy đồng bộ trong yêu cầu (vài chục giây), lỗi thì chạy tiếp hoặc hoàn tác.
- Khả năng tương thích: chế độ một trường không đổi; tệp hệ thống `0050` chỉ thêm bảng.
- Phương án quay lui: hoàn lại commit gộp của nhánh S2; bảng mới không được mã cũ đọc.
### Phiên bản 0.130.0 – 2026-10-25

- Phạm vi thay đổi: DT-SaaS phần S1b, nền đa thuê bao, phần chạy nền và công khai (YCTD-192).
- Chức năng mới: bộ lập lịch việc nền theo trường và điểm tick ngoài (P01-51); hàng đợi máy xếp theo trường và hạn mức đồng thời (P01-52); domain-check theo danh mục tên miền nền tảng, trang chọn trường, giới hạn tần suất công khai theo trường (P01-53, MH-315); bộ đệm ngữ cảnh trường cho yêu cầu nội bộ.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: bảng `scheduler_state` ở cơ sở dữ liệu nền tảng (tệp `0010`, `16_CO_SO_DU_LIEU.md` mục 18A); không đổi cơ sở dữ liệu định danh, hệ thống, năm học.
- Thay đổi API: `POST /internal/jobs/tick`, `GET /public/schools/picker`, `GET /public/schools/resolve`; `domain-check` ở chế độ nhiều trường tra danh mục nền tảng (xem `17_DAC_TA_API.md`); biến môi trường `SCHEDULER_MODE`, `SCHEDULER_INTERVAL_SECONDS`, `SCHEDULER_CONCURRENCY`, `INTERNAL_JOB_TOKEN`, `TIMETABLE_MAX_ACTIVE_RUNS`, `PLATFORM_ROOT_DOMAIN`.
- Kiểm thử: kịch bản CT-999 đến CT-1003. Kết quả ngày 25/10/2026: database 11 ca mới; apps/api 10 ca mới cùng ma trận tuyến, toàn bộ 1126 ca đạt; apps/worker 3 ca (1 mới); apps/identity 75 ca đạt; kiểm tĩnh 6 ca; spec 131 nhiều trường; e2e toàn bộ do CI chạy.
- Rủi ro: ở lượt mỗi trường mỗi việc mở kết nối của trường nên số trường lớn cần chỉnh `SCHEDULER_CONCURRENCY` và `TENANT_POOL_SCHOOLS` (S4 đo, S7 chỉnh); số đo theo trường ở `/metrics`, bản trình diễn (18h) và việc đăng ký biểu EMIS dùng chung danh mục mã giữa các trường chưa làm riêng (xem YCTD-192).
- Khả năng tương thích: chế độ một trường giữ nguyên (bộ đếm giờ riêng từng lớp, `domain-check` theo `website_domains`, không hạn mức máy xếp mới); phần tử hàng đợi máy xếp không tiền tố vẫn đọc được.
- Phương án quay lui: hoàn lại commit gộp của nhánh S1b; bảng `scheduler_state` chỉ chế độ nhiều trường dùng.

### Phiên bản 0.129.0 – 2026-10-25

- Phạm vi thay đổi: DT-SaaS phần S1a, nền đa thuê bao, phần lõi (YCTD-191).
- Chức năng mới: cơ sở dữ liệu nền tảng và nhận diện trường theo tên miền (P01-47 đến P01-50); cơ sở dữ liệu theo trường ở hai bố cục `database` và `schema`, mã phiên mang mã trường, khóa dữ liệu trẻ riêng, tiền tố khóa; nhận bản đang chạy làm trường số 1 (`platform adopt-existing`); đăng nhập vận hành nền tảng và khung cổng `apps/platform` (MH-313, MH-314); bộ kiểm thử cách ly (kiểm tĩnh, ma trận mọi tuyến, quét chuỗi mồi, e2e nhiều trường).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: cơ sở dữ liệu nền tảng mới (tệp nền tảng `0001` đến `0004`, bảng ở `16_CO_SO_DU_LIEU.md` mục 18A); không đổi cơ sở dữ liệu định danh, hệ thống, năm học hiện có.
- Thay đổi API: `POST /auth/platform/login`, `GET /auth/platform/me`; ở chế độ nhiều trường thêm mã lỗi 503 `ERR_SCHOOL_SUSPENDED` và claim `tid` của mã phiên (xem `17_DAC_TA_API.md`).
- Kiểm thử: kịch bản CT-990 đến CT-998. Kết quả ngày 25/10/2026: `packages/server` 13 ca mới; `database` 37 ca ở ba tệp `tenancy`, `adopt-existing`, `migrate` (hai bố cục, bộ phân giải, nhóm kết nối, năm học); `apps/identity` 21 ca mới (nhiều trường 10, vận hành nền tảng 7, ma trận 4); `apps/api` 25 ca mới (hai bố cục 20, ma trận mọi tuyến 5) và 1109 ca cũ đạt không sửa; kiểm tĩnh 6 ca; e2e một trường các spec 01 đến 09 (27 ca) đạt, spec 130 nhiều trường (4 ca) đạt ở cả hai bố cục; e2e toàn bộ do CI chạy.
- Rủi ro: chưa bật nhiều trường ở môi trường chạy thật vì việc nền theo trường để S1b và khóa tích hợp riêng từng trường để S3; mô tả kết nối được đệm ở từng bản máy chủ API và làm mới sau `TENANT_CACHE_SECONDS` (mặc định 30 giây), nên bản khác thấy cơ sở dữ liệu năm học mới chậm tối đa chừng đó (S1b, S7 thêm báo hiệu làm mới).
- Khả năng tương thích: chế độ một trường (không có `PLATFORM_DATABASE_URL`) giữ nguyên hành vi, mọi kiểm thử đơn vị và e2e hiện có chạy không sửa kỳ vọng; `setVietnamTimezone` giữ hành vi cũ khi tài khoản sở hữu cơ sở dữ liệu.
- Phương án quay lui: hoàn lại commit gộp của nhánh S1a; cơ sở dữ liệu nền tảng chỉ do chế độ nhiều trường dùng nên bỏ biến `PLATFORM_DATABASE_URL` là về chế độ một trường.

### Phiên bản 0.128.0 – 2026-10-25

- Phạm vi thay đổi: DT-SaaS phần S7a, hạ tầng VPS trong nước, phần dựng sẵn (YCTD-198).
- Chức năng mới: hồ sơ "Vận hành" `deploy/profiles/production/`: Compose cho T1, T2, T3; PgBouncer; Caddy bắt mọi tên miền; giám sát, cảnh báo, nhật ký tập trung; môi trường thử; triển khai không gián đoạn; hướng dẫn vận hành.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Kiểm thử: kịch bản CT-986 đến CT-989. Kết quả ngày 25/10/2026: `deploy/profiles/production/scripts/check-config.sh` đạt (Compose T1, T2 hai máy, T3 máy bản sao, staging cùng VPS; Caddyfile có và không có tệp `sites.d`; Prometheus, luật cảnh báo; Alertmanager đủ ba kênh và không kênh nào; Loki); dựng ảnh PgBouncer, chạy cùng PostgreSQL: kết nối `school_system` gom theo phiên giữ và mở khóa tư vấn trên cùng kết nối, `school_identity` gom theo giao dịch, sai mật khẩu bị từ chối, kiểm tra sức khỏe đạt; bản sao lấy bản sao cơ bản, máy chính báo `streaming`, bản sao đọc được dòng vừa ghi; cú pháp các script shell đạt; bản một máy cũ (`deploy/docker-compose.production.yml`) vẫn hợp lệ; kiểm tra định dạng đạt. Không có e2e (phần hạ tầng, không sửa mã nghiệp vụ); kiểm tay trên staging (CT-989) chờ dựng VPS thử.
- Rủi ro: quy mô, ngưỡng là giả định chưa đo.
- Khả năng tương thích: bản một máy cũ không đổi; hồ sơ mới chạy được bản một trường hiện nay.
- Phương án quay lui: tiếp tục dùng `deploy/docker-compose.production.yml`; hoàn lại commit gộp của nhánh S7a.

### Phiên bản 0.127.0 – 2026-10-25

- Phạm vi thay đổi: DT-21 phần 21g, báo cáo, thống kê và EMIS THCS, THPT (YCTD-175).
- Chức năng mới: thống kê sĩ số, tổ hợp, kết quả cuối năm, phổ điểm, theo giáo viên, tổ bộ môn THCS, THPT; xuất Excel, PDF; biểu EMIS THCS, THPT cấu hình được (7.18).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tệp hệ thống `0028_add_secondary_report_forms`.
- Thay đổi API: `/secondary-reports/enrollment`, `/results`, `/scores`, `/teachers`, `/{report}/export`; `/secondary-reports/emis` và các đường con như `/primary-reports/emis`; `/primary-reports/emis` chỉ còn biểu Tiểu học.
- Kiểm thử: kịch bản CT-981 đến CT-985. Kết quả ngày 25/10/2026: kiểm thử đơn vị `apps/api/src/secondary-reports/secondary-reports.test.ts` CT-21g-1 đến CT-21g-4 đạt 4/4; kiểm thử đơn vị các gói đã sửa trên máy (database 6/6, api 1080/1080) đạt, kiểm thử đang có không sửa kỳ vọng (thêm mục 7.18 vào bảng đối chiếu điều kiện cũ của CT-15e-2 và danh sách mục chỉ của THCS, THPT của CT-19c-1); e2e trên máy 02, 03, 06, 08, 94, 103, 82, 92 đạt (82, 92 sửa cách chọn để không phụ thuộc dữ liệu của 103; 103 dọn khối 10 tự tạo, đóng lớp thử); e2e toàn bộ do CI chạy; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: biểu khung chưa khớp Sở.
- Khả năng tương thích: không đổi điểm cuối cũ; trường chỉ có Mầm non, Tiểu học thấy như cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 21g; chạy phần quay lui của tệp hệ thống `0028`.

### Phiên bản 0.126.0 – 2026-10-25

- Phạm vi thay đổi: DT-22 phần 22h2, kho học liệu số phần câu hỏi và chia sẻ (YCTD-184).
- Chức năng mới: câu hỏi, đề, ma trận của ngân hàng hiện trong kho và trong bộ sưu tập; thống kê sử dụng câu hỏi, chỗ trống chủ đề; rubric; gói chia sẻ liên trường xuất, nhập có kiểm.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0103_create_resource_questions_and_rubrics`; tệp định danh `0093_add_learning_resource_share_permission`.
- Thay đổi API: `/resource-sharing/…`.
- Kiểm thử: kịch bản CT-975 đến CT-980. Kết quả ngày 25/10/2026: kiểm thử đơn vị `apps/api/src/learning-resources/resource-sharing.test.ts` CT-22h2-1 đến CT-22h2-5 đạt 5/5; kiểm thử đơn vị các gói đã sửa (api, database, shared) đạt (shared; database 6/6; api 1087/1087); kiểm thử giao diện `tests/e2e/123-resource-sharing.spec.ts` (CT-22h2-6) cùng 02, 03, 06, 08, 58, 96, 122 đạt; toàn bộ kiểm thử giao diện do CI chạy (trên máy: 02, 03, 06, 08, 58, 96, 122 đạt; 123 đạt sau khi sửa CSDL hệ thống của spec); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: lộ học liệu không đủ giấy phép qua gói; đã chặn giấy phép bị chặn, "không rõ", học liệu chưa công bố; học liệu nhập phải duyệt lại.
- Khả năng tương thích: không đổi hành vi cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 22h2; chạy phần quay lui của tệp năm học `0103`, định danh `0093`.

### Phiên bản 0.125.0 – 2026-10-24

- Phạm vi thay đổi: DT-22 phần 22h1, kho học liệu số phần lõi (YCTD-183).
- Chức năng mới: phân hệ Kho học liệu; tải tệp, liên kết ngoài, tham chiếu kế hoạch bài dạy, phiên bản; metadata theo cấp, khối, môn, chủ đề; giấy phép bắt buộc; kiểm duyệt phân luồng theo rủi ro; bộ sưu tập; báo lỗi; thống kê; Việc của tôi có nguồn kho học liệu.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp hệ thống `0042_create_learning_resources`; tệp năm học `0102_create_learning_resource_activity`; tệp định danh `0092_add_learning_resource_permissions`.
- Thay đổi API: `/learning-resources/*`.
- Kiểm thử: kịch bản CT-968 đến CT-974. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/learning-resources/learning-resources.test.ts` CT-22h1-1 đến CT-22h1-6 đạt 6/6; kiểm thử đơn vị các gói đã sửa đạt 37/37 (kho học liệu, system-admin-so CT-16d-3 đếm 21 phân hệ, quick-links, menu theo cấp, Việc của tôi); kiểm thử giao diện `tests/e2e/122-learning-resources.spec.ts` (CT-22h1-7) đạt; kiểm thử giao diện chạy trên máy 01, 02, 03, 58, 83, 122 đạt 18/18; e2e toàn bộ do CI chạy; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: không có thay đổi dữ liệu cũ.
- Khả năng tương thích: thêm một phân hệ; các phân hệ khác không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh 22h1; chạy phần quay lui của tệp hệ thống `0042`, năm học `0102`, định danh `0092` (xoá tệp học liệu ở kho tệp theo tiền tố `learning-resources/`).

### Phiên bản 0.124.0 – 2026-10-25
- Phạm vi thay đổi: DT-21 phần 21f, xét tốt nghiệp THCS, THPT và hồ sơ thi (YCTD-174).
- Chức năng mới: kỳ xét tốt nghiệp theo cấp; danh sách thí sinh từ lớp cuối cấp theo xếp loại cả năm; hồ sơ dự thi (bài thi, miễn thi, ưu tiên, khuyến khích), số báo danh, phòng thi, điểm thi (THPT); xét kết quả theo công thức cấu hình được; công nhận tốt nghiệp có biên bản hội đồng, giấy chứng nhận PDF; tệp xuất, đánh dấu đã gửi thủ công; hồ sơ chuyển cấp THCS; mục 7.16 của cổng quản trị.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tệp năm học `0091_create_graduation`; cấu hình xét tốt nghiệp chép sang năm học mới; tệp hệ thống `0029`, định danh `0082` để trống (dùng quyền sẵn có).
- Thay đổi API: nhóm điểm cuối mới `/graduation` (cấu hình, kỳ, thí sinh, phòng, xét, công nhận, biên bản, tệp xuất, hồ sơ chuyển cấp).
- Kiểm thử: kịch bản CT-963 đến CT-967. Kết quả ngày 25/10/2026: kiểm thử đơn vị `graduation.test.ts` CT-21f-1 đến CT-21f-5 đạt 5/5; chạy cùng menu, cấp học đạt 13/13; typecheck, prettier, eslint đạt; e2e CT-21f-6 (102) do CI chạy cùng e2e toàn bộ.
- Rủi ro: công thức, hệ số, điểm liệt, môn thi là mặc định theo quy chế nhớ, cần đối chiếu văn bản gốc của năm; mẫu giấy chứng nhận, bố cục tệp là bố cục chung, mẫu của Bộ, Sở khớp khi khảo sát; chưa nối Sở, Bộ.
- Khả năng tương thích: không đổi chức năng cũ; trường chỉ có Mầm non, Tiểu học không thấy mục 7.16.
- Phương án quay lui: hoàn lại commit gộp của nhánh 21f; chạy phần quay lui của tệp năm học `0091`.

### Phiên bản 0.123.0 – 2026-10-25

- Phạm vi thay đổi: DT-21 phần 21d, sổ đầu bài, điểm danh theo tiết THCS, THPT; sơ đồ chỗ ngồi; thi đua lớp, sao đỏ (YCTD-171).
- Chức năng mới: tiết nhóm ở sổ đầu bài; quy tắc xếp loại tiết theo cấp; xuất sổ đầu bài tuần; sơ đồ chỗ ngồi (7.16); đội sao đỏ, sao đỏ báo lỗi, điểm tiết trong xếp hạng thi đua; 7.6, 7.7, 4.9 hiện ở THCS, THPT.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tệp năm học `0088_create_secondary_class_records`; tệp định danh `0079_add_secondary_class_record_permissions`.
- Thay đổi API: `/class-logs/lesson` nhận `group_no`, trả quy tắc xếp loại, sơ đồ chỗ ngồi; `PUT /class-logs` nhận `group_no`; `/class-logs/settings`, `/class-logs/week/export`; `/seating-charts`; `/conduct/red-stars`; `POST /conduct/entries` nhận `reporter_child_id`; `/conduct/ranking` trả điểm tiết.
- Kiểm thử: kịch bản CT-957 đến CT-962. Kết quả ngày 25/10/2026: kiểm thử đơn vị `apps/api/src/class-logs/secondary-class-records.test.ts` CT-21d-1 đến CT-21d-5 đạt 5/5; kiểm thử đơn vị các gói đã sửa trên máy (database 6/6, api 1052/1052) đạt, kiểm thử đang có không sửa kỳ vọng (thêm mục 7.16 vào bảng đối chiếu điều kiện cũ của CT-15e-2 và danh sách mục chỉ của THCS, THPT của CT-19c-1); e2e trên máy 02, 03, 06, 08, 58, 88, 91, 97, 99 đạt; e2e toàn bộ do CI chạy; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: quy tắc, tiêu chí chưa khớp từng Sở, trường (sửa ở cấu hình).
- Khả năng tương thích: không đổi điểm cuối cũ (tham số mới mặc định như cũ); trường chỉ có Mầm non, Tiểu học thấy như cũ (thêm khối quy tắc xếp loại tiết cho Ban Giám hiệu ở 7.6).
- Phương án quay lui: hoàn lại commit gộp của nhánh 21d; chạy phần quay lui của tệp năm học `0088` và tệp định danh `0079`.

### Phiên bản 0.122.0 – 2026-10-24

- Phạm vi thay đổi: DT-22 phần 22a, thư viện trường học (YCTD-181).
- Chức năng mới: phân hệ "Thư viện" (danh mục ấn phẩm, bản sao có số đăng ký cá biệt và tem mã QR, thanh lý, tệp tài liệu số, sổ đăng ký cá biệt; thẻ bạn đọc cho cán bộ và học sinh; mượn, trả, gia hạn, báo mất, phạt trễ hạn, nhắc quá hạn, đặt trước; phát và thu sách giáo khoa theo bộ sách của khối; kiểm kê và xử lý bản thiếu; báo cáo, chỉ tiêu theo chuẩn thư viện có ngưỡng cấu hình; thiết lập quy định mượn); ứng dụng giáo viên "Sách tôi đang mượn", ứng dụng phụ huynh "Sách thư viện".
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0100_create_library` (15 bảng `library_*`); tệp định danh `0090_add_library_permissions`; chuyển năm học chép kho thư viện sang năm mới.
- Thay đổi API: `/library/*` (xem `17_DAC_TA_API.md`).
- Kiểm thử: kịch bản CT-947 đến CT-956. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/library/library.test.ts` CT-22a-1 đến CT-22a-8 đạt 8/8; trên máy đã chạy kiểm thử đơn vị các gói sửa (thư viện, số phân hệ `system-admin-so`, đường dẫn nhanh, cấp học, chuyển năm học) đạt 52/52; kiểm thử giao diện chạy trên máy: 02, 03, 06, 08, 58, 81, 82, 84 và `tests/e2e/120-library.spec.ts` (CT-22a-9) đạt; kiểm thử giao diện toàn bộ do CI chạy; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt
- Rủi ro: chỉ tiêu theo chuẩn thư viện chưa có ngưỡng mặc định vì chưa đọc văn bản gốc, trường tự nhập; không có thay đổi dữ liệu cũ.
- Khả năng tương thích: không đổi bảng `library_items`, `library_albums` (kho nội dung Mầm non) và `asset_loans` (mượn thiết bị); trường chỉ có Mầm non chỉ có cán bộ mượn sách.
- Phương án quay lui: hoàn lại commit gộp của nhánh 22a; chạy phần quay lui của tệp năm học `0100`, định danh `0090`.

### Phiên bản 0.121.0 – 2026-10-24

- Phạm vi thay đổi: DT-21 phần 22g2, kiểm tra, đánh giá phần chấm (YCTD-173).
- Chức năng mới: bài kiểm tra của lớp từ đề đã khoá; phiếu trả lời; nhập bài tay, nhập tệp quét; chấm tự luận hai người; khoá điểm; chuyển điểm vào sổ điểm; báo cáo theo câu, chủ đề, mức nhận thức, lớp, phân bố điểm, xuất Excel, PDF.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0090_create_exam_grading`; tệp định danh `0081_add_exam_grading_permission`.
- Thay đổi API: `/exam-grading/…`.
- Kiểm thử: kịch bản CT-940 đến CT-946. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/exam-grading/exam-grading.test.ts` CT-22g2-1 đến CT-22g2-6 đạt 6/6; kiểm thử đơn vị các gói đã sửa (api, database, shared) đạt (shared; database 6/6; api 1047/1047); kiểm thử giao diện `tests/e2e/101-exam-grading.spec.ts` (CT-22g2-7) cùng 96, 98, 02, 03, 58 đạt; toàn bộ kiểm thử giao diện do CI chạy (trên máy: 02, 03, 06, 08, 58, 59, 96, 98, 101 đạt 26/26; 101 rồi 54 đạt 14/14); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: chuyển nhầm loại điểm vào sổ điểm; đã yêu cầu khoá trước, giáo viên dạy môn xác nhận, sổ điểm kiểm tra khoá, hạn.
- Khả năng tương thích: trường không bật THCS, THPT không đổi hành vi.
- Phương án quay lui: hoàn lại commit gộp của nhánh 22g2; chạy phần quay lui của tệp năm học `0090`, định danh `0081`.
### Phiên bản 0.120.0 – 2026-10-24

- Phạm vi thay đổi: DT-21 phần 21e, học bạ số, khen thưởng, xét lên lớp THCS, THPT (YCTD-172).
- Chức năng mới: danh hiệu học sinh Xuất sắc, Giỏi theo Thông tư 22/2021 (gợi ý, đề nghị, duyệt, giấy khen có mã tra cứu); xét lên lớp, hoàn thành chương trình cấp học, rèn luyện trong hè, kiểm tra lại theo xếp loại học tập, rèn luyện cả năm; học bạ số có điểm trung bình hai học kỳ, cả năm, xếp loại, kí nội bộ in đủ số định danh kèm kiểm quyền; phụ huynh tải học bạ đã kí; mục 7.8 dùng chung Tiểu học, THCS, THPT.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tệp năm học `0089_widen_award_basis` (thêm căn cứ danh hiệu THCS, THPT); tệp định danh `0080` để trống (dùng quyền học bạ của 20e, không thêm quyền).
- Thay đổi API: không thêm điểm cuối; các điểm cuối `/learning-records` nhận lớp THCS, THPT, trả thêm `has_result`, `needs_support`, `year_label`, `learning`, `conduct`.
- Kiểm thử: kịch bản CT-934 đến CT-939. Kết quả ngày 24/10/2026: kiểm thử đơn vị `learning-records-secondary.test.ts` CT-21e-1 đến CT-21e-5 đạt 5/5; chạy cùng học bạ 20e, sổ điểm 21c, sổ điểm, môn học, đánh giá, menu, cấp học đạt 45/45; typecheck, prettier đạt; e2e 100, 92, 98, 58 và 02, 03, 06, 08 đạt; e2e CT-21e-6 đạt; e2e toàn bộ do CI chạy.
- Rủi ro: điều kiện danh hiệu Xuất sắc (6 môn từ 9,0), điều kiện lên lớp là mặc định theo Thông tư 22/2021, cần đối chiếu văn bản gốc; mẫu học bạ THCS, THPT là bố cục chung, mẫu của Bộ, Sở khớp khi khảo sát; chưa khảo sát hệ thống của Sở cấp THCS, THPT.
- Khả năng tương thích: học bạ, khen thưởng, lên lớp Tiểu học không đổi; trường chỉ có Mầm non thấy như cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 21e; chạy phần quay lui của tệp năm học `0089`.
### Phiên bản 0.119.0 – 2026-10-24

- Phạm vi thay đổi: DT-22 phần 22e, hồ sơ bồi dưỡng giáo viên (YCTD-182).
- Chức năng mới: danh mục bồi dưỡng (định mức tiết, chuyên đề theo chương trình, khung năng lực số); khoá bồi dưỡng, đăng ký, duyệt hai cấp, kết quả; chứng nhận có mã tra cứu công khai, thu hồi, cấp lại; chứng chỉ nhập tay; hồ sơ bồi dưỡng của tôi, của tổ, của trường; tự đánh giá năng lực số, xác nhận, bản đồ năng lực, gợi ý chuyên đề; ứng dụng giáo viên "Bồi dưỡng của tôi"; Việc của tôi có nguồn bồi dưỡng.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp hệ thống `0041_create_training_catalogs`; tệp năm học `0101_create_training_records` (thêm cột `staff_certificates`); tệp định danh `0091_add_training_permissions`.
- Thay đổi API: `/training/*`, `/public/training-certificates/verify`.
- Kiểm thử: kịch bản CT-927 đến CT-933. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/training/training.test.ts` CT-22e-1 đến CT-22e-6 đạt 6/6; kiểm thử đơn vị các gói đã sửa (api, shared, database) đạt 1022/1022 (api 1016, database 6); kiểm thử giao diện `tests/e2e/121-teacher-training.spec.ts` (CT-22e-7) đạt; kiểm thử giao diện chạy trên máy (toàn bộ spec trên nhánh trước khi gộp 20e, 22c2) 161/164; spec 22 (bảng lương) lỗi do spec 121 thêm nhân sự làm từ năm trước vào trường gốc nên bảng lương đòi chốt công tháng trước (BR-43), đã sửa spec 121 cho nhân sự bắt đầu từ hôm nay, chạy lại 02, 03, 121, 21, 22 đạt; spec 04 (lưới Tài khoản), 76 (gói ZIP) lỗi không liên quan 22e; spec 58 đạt; e2e toàn bộ do CI chạy; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: cột thêm của `staff_certificates` cho phép trống hoặc có mặc định, dữ liệu cũ vẫn hợp lệ.
- Khả năng tương thích: không đổi hành vi phần đã có.
- Phương án quay lui: hoàn lại commit gộp của nhánh 22e; chạy phần quay lui của tệp hệ thống `0041`, năm học `0101`, định danh `0091`.

### Phiên bản 0.118.0 – 2026-10-24

- Phạm vi thay đổi: DT-21 phần 21b, thời khoá biểu THCS, THPT (YCTD-169).
- Chức năng mới: khung giờ tiết, thời khoá biểu, máy xếp, dạy thay, báo cáo dùng chung ba cấp Tiểu học, THCS, THPT; tiết học nhóm (một lớp tách nhóm học môn lựa chọn cùng ô); luật xung đột nhóm, tiết đôi, phòng bộ môn; nhập Excel có cột Nhóm; thời khoá biểu của con, trang công khai, ứng dụng giáo viên hiện tiết nhóm theo tổ hợp môn; máy xếp bỏ qua môn học lựa chọn của THPT.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0086_add_timetable_groups` (cột `timetable_lessons.group_no`, khóa duy nhất thêm nhóm).
- Thay đổi API: `group_no` ở tiết của `/timetable-versions/{id}/classes/{classId}/lessons`, `/check`, `/lessons`, `/timetables`, `/children/{id}/timetable`; cột Nhóm của `/timetable-versions/{id}/import`.
- Kiểm thử: kịch bản CT-920 đến CT-926. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/timetables/secondary-timetables.test.ts` CT-21b-1 đến CT-21b-6 đạt 6/6; trên máy đã chạy kiểm thử đơn vị các gói sửa (thời khoá biểu, máy xếp, cấp học, đường dẫn nhanh, sổ đầu bài) đạt 56/56; kiểm thử giao diện chạy trên máy: 02, 03, 06, 08, 58, 89, 93, 95 và `tests/e2e/97-secondary-timetables.spec.ts` (CT-21b-7); kiểm thử giao diện toàn bộ do CI chạy; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt
- Rủi ro: dạy thay, đổi tiết chưa áp dụng cho tiết nhóm; xếp tự động tiết nhóm chưa có; không có thay đổi dữ liệu cũ.
- Khả năng tương thích: tiết cũ có `group_no = 0`, Mầm non, Tiểu học không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh 21b; chạy phần quay lui của tệp năm học `0086` (xóa tiết nhóm).

### Phiên bản 0.117.0 – 2026-10-24

- Phạm vi thay đổi: DT-21 phần 22g1, kiểm tra, đánh giá phần đề (YCTD-168).
- Chức năng mới: ngân hàng câu hỏi có thẩm định, nhập Excel, thống kê; ma trận và bảng đặc tả; kế hoạch kiểm tra; giao đề, bốc câu theo ma trận, đề nhiều mã, thẩm định, khoá đề; tải đề, đáp án ra Word, PDF.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0085_create_question_bank_and_exams`; tệp định danh `0076_add_exam_permissions`.
- Thay đổi API: `/question-topics`, `/questions/…`, `/exam-matrices/…`, `/assessment-plans/…`, `/exams/…`.
- Kiểm thử: kịch bản CT-911 đến CT-919. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/exams/exam-rules.test.ts` CT-22g1-1 đến CT-22g1-4 đạt 4/4, `apps/api/src/exams/exams.test.ts` CT-22g1-5 đến CT-22g1-8 đạt 4/4; kiểm thử đơn vị chạy trên máy các gói đã sửa: shared đạt, database 6/6, api 1018 ca đạt 1016, hai ca `children.test.ts` (CTC-P02-013, CTC-P02-057) chập chờn khi chạy chung, chạy lại riêng đạt 26/26; sau khi gộp 21a, 21c, 20f chạy lại `exams`, `working-level` đạt 16/16; kiểm thử giao diện `tests/e2e/96-exam-bank.spec.ts` (CT-22g1-9) đạt; kiểm thử giao diện trên máy chạy 02, 03, 06, 08, 58, 96 đạt 18/18; sau khi gộp 21a, 21c chạy lại 02, 03, 06, 08, 58, 59, 96 đạt 24/24; e2e toàn bộ do CI chạy (đạt 5/5 trước khi gộp 20f); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: lộ đề trước giờ kiểm tra; đã giới hạn người xem, ghi nhật ký tải.
- Khả năng tương thích: trường không bật THCS, THPT không đổi hành vi.
- Phương án quay lui: hoàn lại commit gộp của nhánh 22g1; chạy phần quay lui của tệp năm học `0085`, định danh `0076`.

### Phiên bản 0.116.0 – 2026-10-24

- Phạm vi thay đổi: DT-20 phần 20f, báo cáo, thống kê và EMIS Tiểu học (YCTD-165).
- Chức năng mới: thống kê sĩ số Tiểu học theo khối; kết quả đánh giá, cuối năm theo lớp, khối, trường; chuyên cần theo tiết và bán trú theo lớp; xuất Excel, PDF; khung biểu EMIS Tiểu học cấu hình được (công thức, nhập tay, sửa khung, gửi lên cấp trên).
- Lỗi đã sửa: lọc theo danh sách đơn vị dùng mã rỗng chuỗi `''` cho cột uuid gây lỗi hệ thống khi người dùng chỉ được xem một số đơn vị (thống kê Tiểu học khi chọn đơn vị; nề nếp 20b: danh sách điểm, xếp hạng; khoá số liệu 20c: danh sách lớp, khoá mọi lớp), nay dùng uuid rỗng.
- Thay đổi dữ liệu: tệp hệ thống `0027_create_report_forms`; tệp định danh `0074_add_report_form_permission`.
- Thay đổi API: `/primary-reports/enrollment`, `/assessments`, `/year-end`, `/attendance`, `/{report}/export`; `/primary-reports/emis`, `/{code}`, `/{code}/values`, `/{code}/rows`, `/{code}/export`; biểu `emis-th-dau-nam`, `emis-th-cuoi-nam` ở `/upper-level-submissions`.
- Kiểm thử: kịch bản CT-904 đến CT-910. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/primary-reports/primary-reports.test.ts` CT-20f-1 đến CT-20f-6 đạt 6/6; kiểm thử đơn vị đang có không sửa kỳ vọng (thêm mục 7.15 vào bảng đối chiếu điều kiện cũ của CT-15e-2 và danh sách mục chỉ của Tiểu học của CT-19c-1); kiểm thử đơn vị toàn bộ kho mã đạt 1081/1081 trước khi gộp main lần cuối; sau khi gộp chạy lại các tệp bị ảnh hưởng (primary-reports, working-level, menu-permissions) đạt 18/18; kiểm thử giao diện `tests/e2e/94-primary-reports.spec.ts` (CT-20f-7) đạt; kiểm thử giao diện trên máy chạy các kịch bản 02, 03, 94 đạt 5/5 (trước đó 02, 03, 06, 08, 58, 94 đạt 18/18); e2e toàn bộ do CI chạy; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: biểu khung chưa khớp Sở.
- Khả năng tương thích: không đổi điểm cuối cũ; trường chỉ có Mầm non thấy như cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 20f; chạy phần quay lui của tệp hệ thống `0027` và tệp định danh `0074`.

### Phiên bản 0.115.0 – 2026-10-24

- Phạm vi thay đổi: DT-21 phần 21c, sổ điểm THCS, THPT theo Thông tư 22/2021 (YCTD-170).
- Chức năng mới: bảng điểm (đánh giá thường xuyên, giữa kỳ, cuối kỳ, kết quả môn nhận xét), điểm trung bình môn học kỳ, cả năm, gợi ý và xác nhận xếp loại học tập, rèn luyện, khoá điểm theo học kỳ và lớp, cấu hình hệ số, số lần đánh giá, ngưỡng theo cấp; nhập ở cổng quản trị (7.14 Sổ điểm) và ứng dụng giáo viên; phụ huynh xem điểm đã khoá ở ứng dụng phụ huynh.
- Lỗi đã sửa: dòng "Phiên bản" thừa ở đầu các tài liệu 01, 02, 07, 10, 11, 14, 16, 17, 21, 23, 24, 32 do gộp bản 21a.
- Thay đổi dữ liệu: tệp năm học `0087_create_scores`; tệp định danh `0078` để trống (dùng quyền đánh giá học sinh `P02.assessment.*` của 20c, không thêm quyền).
- Thay đổi API: `/scores/config`, `/scores/classes/{id}` (`/subjects/{subjectId}`, `/summary`, `/ratings`), `/scores/locks` (`/unlock`), `/scores/children/{id}`.
- Kiểm thử: kịch bản CT-897 đến CT-903. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/scores/scores.test.ts` CT-21c-1 đến CT-21c-6 đạt 6/6; chạy cùng `secondary.test.ts`, `subjects.test.ts`, `working-level.test.ts`, `menu-permissions.test.ts` đạt 28/28 (đã thêm 7.14 vào danh sách mục chỉ của THCS, THPT ở CT-19c-1, CT-19c-2); typecheck, eslint, prettier đạt; e2e CT-21c-7 đạt (cùng 02, 03, 06, 08 chạy trước); e2e toàn bộ do CI chạy.
- Rủi ro: hệ số, số lần đánh giá, ngưỡng xếp loại là mặc định theo Thông tư 22/2021, cần đối chiếu văn bản gốc; xếp loại rèn luyện do giáo viên chủ nhiệm nhập tay (chưa có quy tắc gợi ý); chưa khảo sát hệ thống của Sở cấp THCS, THPT.
- Khả năng tương thích: trường chỉ có Mầm non hoặc Tiểu học thấy như cũ; bảng đánh giá Thông tư 27/2020 của 20c không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh 21c; chạy phần quay lui của tệp năm học `0087`.

### Phiên bản 0.114.0 – 2026-10-24

- Phạm vi thay đổi: DT-21 phần 21a, nền THCS, THPT (YCTD-167).
- Chức năng mới: bộ môn mẫu THCS (khối 6 đến 9), THPT (khối 10 đến 12) theo Chương trình giáo dục phổ thông 2018; cách đánh giá bằng điểm số; nhóm môn lựa chọn THPT; tổ hợp môn; học sinh đăng ký tổ hợp (đổi thì chờ duyệt); tổ bộ môn; phân công giảng dạy theo môn, môn học dùng chung ba cấp; mục menu 7.12 Tổ hợp môn, 7.13 Tổ bộ môn.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tệp năm học `0084_create_secondary_foundation`; tệp định danh `0075` để trống (không thêm quyền).
- Thay đổi API: `/subject-combinations`, `/subject-combinations/{id}/students`, `/children/{id}/subject-combination` (`/approve`, `/reject`), `/subject-teams` (`/members`, `/loads`); `/subjects` nhận `option_group`, `assessment` = `score`.
- Kiểm thử: kịch bản CT-891 đến CT-896. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/subjects/secondary.test.ts` CT-21a-1 đến CT-21a-5 đạt 5/5 trên nhánh trước khi gộp 20d, 20e, 22c2; sau khi gộp chạy lại được CT-21a-1 và các ca menu CT-19c-1 đến CT-19c-4 (đạt), các ca cần cơ sở dữ liệu chưa chạy lại vì cơ sở dữ liệu định danh dùng chung trên máy đã chạy migration của nhánh khác; typecheck, lint, prettier đạt; e2e CT-21a-6 và e2e toàn bộ do CI chạy, chưa chạy trên máy
- Rủi ro: số môn, số nhóm của tổ hợp và thời lượng môn là mặc định theo chương trình, cần đối chiếu văn bản gốc; chưa khảo sát hệ thống của Sở cấp THCS, THPT.
- Khả năng tương thích: trường chỉ có Mầm non hoặc Tiểu học thấy như cũ trừ tên nhóm 7 đổi thành "Dạy học"; môn cũ giữ nguyên, nhóm môn trống.
- Phương án quay lui: hoàn lại commit gộp của nhánh 21a; chạy phần quay lui của tệp năm học `0084`.
### Phiên bản 0.113.0 – 2026-10-24

- Phạm vi thay đổi: DT-20 phần 22c2, thời khoá biểu phần máy xếp (YCTD-164).
- Chức năng mới: máy xếp chạy nền có giới hạn thời gian, nhiều phương án, mức quan trọng của ràng buộc chỉnh được, quy tắc môn, tiết giáo viên báo bận; phương án thành bản nháp; chỉnh tay có kiểm tra ngay; dạy thay, đổi tiết theo ngày; báo cáo tiết dạy, dùng phòng; mã QR và trang tra cứu công khai.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0082_create_timetable_generator`.
- Thay đổi API: `/timetable-generator/…`, `/timetable-generations/…`, `/timetable-versions/{id}/classes/{classId}/check`, `/timetable-changes/…`, `/timetable-reports/…`, `/timetable-lookup-codes/…`, `/public/timetable-lookup/{code}`.
- Triển khai: ảnh Docker mới `worker` và dịch vụ `worker` (chỉ nối Redis); máy chủ API thêm biến `REDIS_URL`.
- Kiểm thử: kịch bản CT-877 đến CT-890. Kết quả ngày 24/10/2026: kiểm thử đơn vị máy xếp `packages/server/src/timetable-solver.test.ts` CT-22c2-1 đến CT-22c2-6 đạt 6/6, tiến trình chạy nền `apps/worker/src/timetable-generation.test.ts` CT-22c2-7 đạt, máy chủ API `apps/api/src/timetables/timetable-generator.test.ts` CT-22c2-8 đến CT-22c2-13 đạt 6/6; kiểm thử đơn vị toàn bộ kho mã 1067/1067 trước khi gộp 20d, 20e (hai ca chạy lại riêng: `leave.test.ts` lỗi hết bộ nhớ của máy, CT-22c2-12 sửa cách chọn cặp đổi tiết); sau khi gộp 20d, 20e chạy lại toàn kho …; kiểm thử giao diện `tests/e2e/93-timetable-generator.spec.ts` (CT-22c2-14) đạt; toàn bộ kiểm thử giao diện 163/163 trước khi gộp 20d, 20e; sau khi gộp 20d đạt 163/164, ca hỏng 04-accounts do cơ sở dữ liệu định danh riêng của lần chạy trước còn tài khoản trùng tên, không liên quan 22c2; sau khi gộp 20e …; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: máy xếp chạy lâu ở trường lớn; đã giới hạn thời gian và chạy ở tiến trình riêng.
- Khả năng tương thích: trường chỉ có Mầm non không đổi hành vi.
- Phương án quay lui: hoàn lại commit gộp của nhánh 22c2; chạy phần quay lui của tệp năm học `0082`; bỏ dịch vụ `worker`.

### Phiên bản 0.112.0 – 2026-10-24

- Phạm vi thay đổi: DT-20 phần 20e, học bạ số, khen thưởng cuối năm, hoàn thành chương trình, lên lớp (YCTD-163).
- Chức năng mới: danh hiệu khen thưởng học sinh cấu hình được, đề nghị, duyệt, giấy khen có mã tra cứu; hoàn thành chương trình lớp học, chương trình tiểu học, rèn luyện trong hè, kiểm tra lại, ở lại lớp; học bạ số lập từ kết quả đã khoá, Hiệu trưởng xác nhận và kí nội bộ; phụ huynh xem học bạ đã kí, khen thưởng; kết chuyển học bạ, danh hiệu sang năm học mới.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tệp năm học `0081_create_student_records`; tệp định danh `0072_add_student_record_permissions`.
- Thay đổi API: `/learning-records/award-titles` (`/defaults`, `/{id}`); `/learning-records/classes/{id}/awards`, `/completion`, `/learning-records`, `/learning-records/prepare`; `/learning-records/awards/{id}/decide`, `/certificate`; `/learning-records/learning-records/{id}`, `/sign`, `/reopen`, `/file`; `/learning-records/children/{id}`; `/public/student-awards/verify`.
- Kiểm thử: kịch bản CT-870 đến CT-876. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/learning-records/learning-records.test.ts` CT-20e-1 đến CT-20e-6 đạt 6/6 (gồm mở năm học mới để kiểm kết chuyển); kiểm thử đơn vị đang có không sửa kỳ vọng (thêm mục 7.8 vào bảng đối chiếu điều kiện cũ của CT-15e-2 và danh sách mục chỉ của Tiểu học của CT-19c-1); kiểm thử đơn vị toàn bộ kho mã đạt 1075/1075; kiểm thử giao diện `tests/e2e/92-learning-records.spec.ts` (CT-20e-7) đạt; toàn bộ kiểm thử giao diện ở máy trước khi gộp 20d đạt 161/163 (spec 92 mới đạt; spec 59 chập chờn; spec 89 thời khoá biểu quá thời gian ở máy, đạt ở CI của 20d), CI chạy lại toàn bộ; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: học bạ là bản chốt lúc lập.
- Khả năng tương thích: không đổi điểm cuối cũ; trường chỉ có Mầm non thấy như cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 20e; chạy phần quay lui của tệp năm học `0081` và tệp định danh `0072`.

### Phiên bản 0.111.0 – 2026-10-24

- Phạm vi thay đổi: DT-20 phần 20d, sổ đầu bài và điểm danh theo tiết (YCTD-162).
- Chức năng mới: sổ đầu bài theo thời khoá biểu (tên bài, nội dung, nhận xét, xếp loại tiết, giáo viên ký); điểm danh theo tiết ở ứng dụng giáo viên; Ban giám hiệu ký sổ tuần; phụ huynh xem điểm danh theo tiết, báo vắng ở cấp phổ thông; tổng hợp chuyên cần theo tiết đối chiếu báo vắng theo ngày.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0080_create_class_logs`; tệp định danh `0071_add_class_log_permission`.
- Thay đổi API: `/class-logs`, `/class-logs/week`, `/class-logs/mine`, `/class-logs/lesson`, `/class-logs/{id}/sign`, `/class-logs/reviews`, `/period-attendance/summary`, `/children/{id}/period-attendance`.
- Kiểm thử: kịch bản CT-864 đến CT-869. Kết quả ngày 24/10/2026: kiểm thử đơn vị `apps/api/src/class-logs/class-logs.test.ts` CT-20d-1 đến CT-20d-5 đạt 5/5; kiểm thử đơn vị toàn bộ kho mã đạt 1069/1069; kiểm thử giao diện `tests/e2e/91-class-logs.spec.ts` (CT-20d-6) đạt; toàn bộ kiểm thử giao diện đạt 162/163 (CT-20b-7 `88-boarding-conduct.spec.ts` lỗi chập chờn: danh sách ăn chưa làm mới sau khi đổi ngày, không liên quan 20d; lượt chạy trước cùng mã đạt); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: không có thay đổi dữ liệu cũ.
- Khả năng tương thích: trường chỉ có Mầm non không đổi hành vi; điểm danh Mầm non giữ nguyên.
- Phương án quay lui: hoàn lại commit gộp của nhánh 20d; chạy phần quay lui của tệp năm học `0080`, định danh `0071`.

### Phiên bản 0.110.0 – 2026-10-23

- Phạm vi thay đổi: DT-20 phần 20c, đánh giá học sinh theo Thông tư 27/2020 (YCTD-161).
- Chức năng mới: cấu hình mức đạt, phẩm chất, năng lực, kỳ đánh giá, bài kiểm tra định kỳ theo cấp (nạp mặc định của Thông tư); nhập kết quả định kỳ theo phân công ở cổng quản trị và ứng dụng giáo viên; nhận xét thường xuyên; tổng hợp cuối kỳ; gợi ý và xác nhận kết quả cuối năm; khoá, mở khoá số liệu; phụ huynh xem kết quả đã khoá.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tệp năm học `0079_create_student_assessments`; tệp định danh `0070_add_assessment_permissions`.
- Thay đổi API: `/assessment/config` (`/defaults`, `/levels`, `/items`, `/periods/{id}`, `/periods/{id}/tests`, `/templates`); `/assessment/classes/{id}`, `/subjects/{subjectId}`, `/competencies`, `/comments`, `/summary`, `/year-results`; `/assessment/comments/{id}`; `/assessment/locks`, `/locks/unlock`; `/assessment/children/{id}`.
- Kiểm thử: kịch bản CT-857 đến CT-863. Kết quả ngày 23/10/2026: kiểm thử đơn vị `apps/api/src/assessments/assessments.test.ts` CT-20c-1 đến CT-20c-6 đạt 6/6; kiểm thử đơn vị đang có không sửa kỳ vọng (thêm mục 7.3 vào bảng đối chiếu điều kiện cũ của CT-15e-2 và danh sách mục chỉ của Tiểu học của CT-19c-1); kiểm thử đơn vị toàn bộ kho mã đạt 1064/1064; kiểm thử giao diện `tests/e2e/90-student-assessments.spec.ts` (CT-20c-7) đạt; toàn bộ kiểm thử giao diện trước khi gộp 22c1 đạt 160/161 (spec 90 mới đạt; spec 38 nhắc nợ chập chờn, không liên quan), sau khi gộp chạy ở CI; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: hạn nhập mặc định theo ngày kết thúc học kỳ.
- Khả năng tương thích: không đổi điểm cuối cũ; trường chỉ có Mầm non thấy như cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 20c; chạy phần quay lui của tệp năm học `0079` và tệp định danh `0070`.

### Phiên bản 0.109.0 – 2026-10-23

- Phạm vi thay đổi: DT-20 phần 22c1, thời khoá biểu phần khung (YCTD-160).
- Chức năng mới: khung giờ tiết học theo cấp; bản thời khoá biểu có ngày áp dụng; sửa tiết theo lớp; nhập Excel; kiểm tra xung đột; ban hành; xem theo lớp, giáo viên, phòng; lịch dạy của giáo viên; thời khoá biểu của con; trang thời khoá biểu của website.
- Lỗi đã sửa: 1.1 Khai báo cơ sở vật chất (phân hệ Cơ sở vật chất) báo "Bắt buộc chọn đơn vị" khi bấm Thêm mới trước khi danh sách đơn vị tải xong; nay phòng mới nhận đơn vị mặc định khi danh sách về (lỗi làm kiểm thử giao diện 50 chập chờn).
- Thay đổi dữ liệu: tệp hệ thống `0026_create_period_slots`; tệp năm học `0078_create_timetables`; tệp định danh `0069_add_timetable_permission`.
- Thay đổi API: `/period-slots`, `/timetable-versions`, `/timetables`, `/timetables/mine`, `/children/{id}/timetable`.
- Kiểm thử: kịch bản CT-851 đến CT-856. Kết quả ngày 23/10/2026: kiểm thử đơn vị `apps/api/src/timetables/timetables.test.ts` CT-22c1-1 đến CT-22c1-5 đạt 5/5; kiểm thử đơn vị toàn bộ kho mã đạt 1058/1058 (không sửa kỳ vọng của kiểm thử đang có, trừ danh sách đường dẫn của CT-19c-1); kiểm thử giao diện `tests/e2e/89-timetables.spec.ts` (CT-22c1-6) đạt; toàn bộ kiểm thử giao diện đạt 161/161; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: không có thay đổi dữ liệu cũ.
- Khả năng tương thích: trường chỉ có Mầm non không đổi hành vi.
- Phương án quay lui: hoàn lại commit gộp của nhánh 22c1; chạy phần quay lui của tệp hệ thống `0026`, năm học `0078`, định danh `0069`.

### Phiên bản 0.108.0 – 2026-10-23

- Phạm vi thay đổi: DT-20 phần 20b, bán trú Tiểu học; nề nếp và thi đua lớp (YCTD-159).
- Chức năng mới: danh sách ăn bán trú theo ngày của lớp Tiểu học, cắt suất (giáo viên, phụ huynh), chốt và mở lại số suất; số suất bếp, tiền ăn theo ngày ăn thực tế của lớp Tiểu học; nề nếp, thi đua lớp tuỳ trường (cấu hình, tiêu chí, ghi điểm, xếp hạng tuần, tháng, học kỳ).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tệp năm học `0077_create_boarding_and_conduct`; tệp định danh `0068_add_boarding_conduct_permissions`.
- Thay đổi API: `/boarding/classes/{id}/roster`, `/cuts`, `/close`, `/reopen`; `/boarding/children/{id}/cuts`, `/{date}`; `/conduct/settings`, `/conduct/criteria`, `/defaults`, `/{id}`, `/conduct/entries`, `/{id}`, `/conduct/ranking`; nguồn số suất `boarding_closed`, `boarding_open` ở bếp.
- Kiểm thử: kịch bản CT-844 đến CT-850. Kết quả ngày 23/10/2026: kiểm thử đơn vị `apps/api/src/boarding/boarding.test.ts` CT-20b-1 đến CT-20b-6 đạt 6/6; kiểm thử đơn vị đang có không sửa kỳ vọng (thêm hai mục menu vào bảng đối chiếu điều kiện cũ của CT-15e-2; CT-19c-1, CT-19c-2 so cây menu Mầm non với cây gốc bỏ hai mục chỉ của Tiểu học, cây menu Mầm non giữ nguyên); kiểm thử đơn vị toàn bộ kho mã đạt 1053/1053; kiểm thử giao diện `tests/e2e/88-boarding-conduct.spec.ts` (CT-20b-7) đạt; toàn bộ kiểm thử giao diện đạt 160/160; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: tính tiền ăn lớp Tiểu học cần chốt suất đủ ngày học.
- Khả năng tương thích: không đổi điểm cuối cũ; trường chỉ có Mầm non thấy như cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 20b; chạy phần quay lui của tệp năm học `0077` và tệp định danh `0068`.

### Phiên bản 0.107.0 – 2026-10-23

- Phạm vi thay đổi: DT-20 phần 20a, nền Tiểu học (YCTD-158).
- Chức năng mới: danh mục môn học và hoạt động giáo dục, bộ môn mẫu Tiểu học, số tiết theo khối của chương trình, phân công giảng dạy theo môn, tổng tiết của giáo viên, môn tự chọn của học sinh; nhóm menu "7. Dạy học Tiểu học".
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0076_create_subjects`.
- Thay đổi API: `/subjects`, `/subjects/templates`, `/curricula/{id}/subjects`, `/teaching-assignments`, `/children/{id}/elective-subjects`; phân công lớp nhận `subject_id`, `periods_per_week`.
- Kiểm thử: kịch bản CT-838 đến CT-843. Kết quả ngày 23/10/2026: kiểm thử đơn vị `apps/api/src/subjects/subjects.test.ts` CT-20a-1 đến CT-20a-5 đạt 5/5; kiểm thử đơn vị toàn bộ kho mã đạt 1047/1047 (không sửa kỳ vọng của kiểm thử đang có, trừ CT-19c-1 như trên); kiểm thử giao diện `tests/e2e/87-primary-subjects.spec.ts` (CT-20a-6) đạt; toàn bộ kiểm thử giao diện 159 kịch bản: hai lượt chạy riêng cuối cùng mỗi lượt đạt 158/159, mỗi lượt hỏng một kịch bản khác nhau do môi trường máy (58 khi máy chủ giao diện từ chối kết nối, 23 khi quá thời gian 30 giây), mọi kịch bản đều đạt ở ít nhất một lượt; CI là kết quả chính; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: thay chỉ mục duy nhất của phân công lớp (thêm môn) ở mọi cơ sở dữ liệu năm học.
- Khả năng tương thích: trường chỉ có Mầm non không đổi hành vi; điểm cuối cũ chỉ thêm trường.
- Phương án quay lui: hoàn lại commit gộp của nhánh 20a; chạy phần quay lui của tệp năm học `0076`.

### Phiên bản 0.106.0 – 2026-10-23

- Phạm vi thay đổi: DT-19 phần 19f, chuyển và kiểm dữ liệu Mầm non, dữ liệu mẫu đa cấp, chuẩn bị DT-20, DT-21 (YCTD-156).
- Chức năng mới: tệp vá cấp học chạy lặp được; lệnh kiểm đối chiếu chỉ đọc `level-check`; trường liên cấp trong bản trình diễn.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0075_backfill_school_levels`; tệp hệ thống `0025_backfill_school_levels`.
- Thay đổi API: không có.
- Kiểm thử: kịch bản CT-833 đến CT-837. Kết quả ngày 23/10/2026: kiểm thử đơn vị `database/src/level-check.test.ts` CT-19f-1 đến CT-19f-3 đạt 3/3, `apps/api/src/demo/administration-18h.test.ts` CT-19f-4 đạt (CT-18h-1 đến CT-18h-9 vẫn đạt); kiểm thử đơn vị toàn bộ kho mã 1042/1042; kiểm thử giao diện `tests/e2e/86-multi-level.spec.ts` (CT-19f-5) đạt; toàn bộ kiểm thử giao diện 158/158; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: năm học đã đóng giữ cấu trúc cũ.
- Khả năng tương thích: không đổi điểm cuối; trường chỉ có Mầm non như cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 19f; hai tệp vá không có phần quay lui vì chỉ vá dữ liệu cho khớp cấu trúc.

### Phiên bản 0.105.0 – 2026-10-23

- Phạm vi thay đổi: DT-19 phần 19e, cổng phụ huynh và ứng dụng giáo viên đa cấp (YCTD-155).
- Chức năng mới: chức năng theo cấp ở ứng dụng phụ huynh, ứng dụng giáo viên (tên cấp của con, của lớp; chức năng chỉ của Mầm non chỉ ở con, lớp Mầm non); tin tức có cấp nhận; số người nhận trước khi công bố.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0074_add_news_audience_levels`.
- Thay đổi API: `GET /children` thêm `school_level`; `/news` nhận và trả `audience_levels`; mới `POST /news-recipients/count`.
- Kiểm thử: kịch bản CT-828 đến CT-832. Kết quả ngày 23/10/2026: kiểm thử đơn vị `apps/api/src/school-levels/multi-level-apps.test.ts` CT-19e-1 đến CT-19e-4 đạt 4/4; kiểm thử đơn vị toàn bộ kho mã đạt 1038/1038 (không sửa kỳ vọng của kiểm thử đang có); kiểm thử giao diện `tests/e2e/85-multi-level-apps.spec.ts` (CT-19e-5) đạt; toàn bộ kiểm thử giao diện đạt 157/157; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: tin có cấp nhận gửi theo danh sách tài khoản phụ huynh thay vì theo vai trò; trường đông học sinh có nhiều dòng người nhận hơn.
- Khả năng tương thích: trường chỉ có Mầm non không đổi hành vi; tin cũ có cấp nhận trống; điểm cuối cũ chỉ thêm trường.
- Phương án quay lui: hoàn lại commit gộp của nhánh 19e; chạy phần quay lui của tệp năm học `0074`.

### Phiên bản 0.104.0 – 2026-10-22

- Phạm vi thay đổi: DT-19 phần 19d, số liệu theo cấp học (YCTD-154).
- Chức năng mới: tham số cấp dùng chung của thống kê, báo cáo; thống kê lớp theo khối ở cấp ngoài Mầm non; báo cáo chấm công và suất ăn nhóm theo cấp; biểu phí theo cấp; ô cấp học ở thống kê, báo cáo, biểu phí.
- Lỗi đã sửa: lớp chưa có tháng tuổi (cấp ngoài Mầm non) không còn bị tính vào nhóm tuổi nhỏ nhất ở 5.1 và vào Mẫu giáo ở báo cáo chấm công và suất ăn.
- Thay đổi dữ liệu: tệp năm học `0073_add_fee_schedule_school_level`.
- Thay đổi API: tham số `school_level` ở `/statistics/classes`, `/statistics/children`, `/statistics/students`, `/statistics/missing-child-fields`, `/reports/attendance-meals`, `/fee-schedules`; `grade_groups` ở 5.1; `school_level` ở biểu phí.
- Kiểm thử: kịch bản CT-820 đến CT-827. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/statistics/level-reports.test.ts` CT-19d-1 đến CT-19d-7 đạt 7/7; kiểm thử đơn vị đang có không sửa kỳ vọng; kiểm thử đơn vị toàn bộ kho mã 1034/1034; kiểm thử giao diện `tests/e2e/84-level-reports.spec.ts` (CT-19d-8) đạt; toàn bộ kiểm thử giao diện 154/156 ở lượt cuối trên máy (hai ca 59 quên mật khẩu, 65 gửi thiết bị lên cấp trên chập chờn, không thuộc phần sửa và đạt ở các lượt trước; spec 84 đạt), CI là kết quả chính thức; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: biểu EMIS các cấp khác chưa có (DT-20, DT-21).
- Khả năng tương thích: không đổi điểm cuối cũ; trường chỉ có Mầm non thấy như cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 19d; chạy phần quay lui của tệp năm học `0073`.

### Phiên bản 0.103.0 – 2026-10-22

- Phạm vi thay đổi: DT-19 phần 19c, menu và phân hệ theo cấp học (YCTD-153).
- Chức năng mới: thuộc tính cấp ở cây menu, tên phân hệ theo cấp, bộ chọn cấp đang làm việc ở thanh đầu trang (lưu theo tài khoản), tham số cấp dùng chung `school_level`, bảng nhãn thuật ngữ theo cấp; cây quyền và Truy cập nhanh lọc theo cấp bật.
- Lỗi đã sửa: 2.5 Lãnh đạo nhận văn bản mất lựa chọn đã tích khi danh sách lãnh đạo tải sau danh sách nhân sự.
- Thay đổi dữ liệu: tệp định danh `0065_create_user_preferences`.
- Thay đổi API: `PUT /auth/me/working-school-level`; `/auth/me` thêm `working_school_level`; mới `GET /portal-context/school-levels`; `/me/quick-links` lọc theo cấp bật.
- Kiểm thử: kịch bản CT-811 đến CT-819. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/school-levels/working-level.test.ts` CT-19c-1 đến CT-19c-8 đạt 8/8; kiểm thử đơn vị toàn bộ kho mã đạt 1027/1027 (không sửa kỳ vọng của kiểm thử đang có); kiểm thử giao diện `tests/e2e/83-school-level-menu.spec.ts` (CT-19c-9) đạt; toàn bộ kiểm thử giao diện đạt 155/155; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: máy chủ API khác thấy cấp vừa bật, tắt chậm nhất 30 giây (bộ nhớ đệm của 19a).
- Khả năng tương thích: trường chỉ có Mầm non không đổi hành vi; không đổi điểm cuối cũ (chỉ thêm trường, lọc lối tắt theo cấp bật).
- Phương án quay lui: hoàn lại commit gộp của nhánh 19c; chạy phần quay lui của tệp định danh `0065`.

### Phiên bản 0.102.0 – 2026-10-22

- Phạm vi thay đổi: DT-19 phần 19b, cấu trúc theo cấp học (YCTD-152).
- Chức năng mới: khối theo cấp, tháng tuổi tùy chọn ngoài Mầm non, nạp khối mẫu Tiểu học, THCS, THPT; chương trình theo cấp; lớp lấy cấp theo khối, chương trình của lớp; cấp học của đơn vị; học kỳ, tuần, ngày học riêng từng cấp; khối kế tiếp khi lên lớp.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0072_add_school_level_structure`; tệp hệ thống `0024_add_school_level_calendar`.
- Thay đổi API: `/curricula`; `/grade-levels/templates`, `/grade-levels/next`; `/org-units/levels`, `/org-units/{id}/levels`; tham số `school_level` ở lịch, tuần, danh sách lớp, bậc học; `DELETE /academic-years/{id}/calendar`.
- Kiểm thử: kịch bản CT-801 đến CT-810. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/catalogs/level-structure.test.ts` CT-19b-1 đến CT-19b-8 đạt 8/8, `apps/api/src/academic-years/year-transition.test.ts` CT-19b-9 đạt; kiểm thử đơn vị đang có không sửa kỳ vọng; kiểm thử đơn vị toàn bộ kho mã 1019/1019; kiểm thử giao diện `tests/e2e/82-level-structure.spec.ts` (CT-19b-10) đạt; toàn bộ kiểm thử giao diện 154/154; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: thống kê, báo cáo, biểu phí chưa tách theo cấp (19d).
- Khả năng tương thích: không đổi điểm cuối cũ; trường chỉ có Mầm non thấy như cũ (thêm cột, ô "Cấp học", thẻ "Chương trình" ở danh mục bậc học).
- Phương án quay lui: hoàn lại commit gộp của nhánh 19b; chạy phần quay lui của tệp năm học `0072` và tệp hệ thống `0024`.

### Phiên bản 0.101.0 – 2026-10-22

- Phạm vi thay đổi: DT-19 phần 19a, nền cấp học của trường (YCTD-151).
- Chức năng mới: bảng cấp học của trường (bốn mã cố định, Mầm non bật sẵn), hàm dùng chung `SchoolLevelResolver`, phạm vi cấp học của người dùng, thẻ "Cấp học của trường" ở 1.4 Cấu hình trường; ô ngữ cảnh và website đọc cấp từ một nguồn.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp hệ thống `0023_create_school_levels`; tệp định danh `0064_add_user_school_levels`.
- Thay đổi API: `/school-levels`, `/users/{id}/school-levels`; `/auth/me` thêm `school_levels`.
- Kiểm thử: kịch bản CT-795 đến CT-800. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/school-levels/school-levels.test.ts` CT-19a-1 đến CT-19a-5 đạt 5/5; kiểm thử đơn vị toàn bộ kho mã 1010/1010 đạt (không sửa kỳ vọng của kiểm thử đang có); kiểm thử giao diện `tests/e2e/81-school-levels.spec.ts` (CT-19a-6) đạt; toàn bộ kiểm thử giao diện 153/153 đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: máy chủ API khác thấy thay đổi cấp chậm nhất 30 giây.
- Khả năng tương thích: trường chỉ có Mầm non không đổi hành vi; không đổi điểm cuối cũ (chỉ thêm trường).
- Phương án quay lui: hoàn lại commit gộp của nhánh 19a; chạy phần quay lui của tệp hệ thống `0023` và tệp định danh `0064`.

### Phiên bản 0.100.0 – 2026-10-22

- Phạm vi thay đổi: DT-18 phần 22f, bảo đảm chất lượng, tự đánh giá (YCTD-149).
- Chức năng mới: phân hệ "Bảo đảm chất lượng"; bộ tiêu chuẩn cấu hình được theo cấp học, bộ mẫu Mầm non; đợt tự đánh giá, hội đồng, nhóm công tác, phân công tiêu chí; phiếu đánh giá tiêu chí có chỉ báo, nộp, duyệt, trả lại; minh chứng có mã, bốn trạng thái, nguồn từ kho hồ sơ chuyên môn, văn bản đến, đi, kế thừa năm trước; kế hoạch cải tiến thành kế hoạch công việc nháp; báo cáo tự đánh giá Word, PDF; theo dõi công nhận, ghi vào 1.7.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0071_create_quality_assurance`; tệp định danh `0063_add_quality_assurance_permissions`.
- Thay đổi API: điểm cuối mới dưới `/quality`.
- Kiểm thử: kịch bản CT-786 đến CT-794. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/quality-assurance/quality-assurance.test.ts` CT-22f-1 đến CT-22f-8 đạt 8/8; kiểm thử đơn vị toàn bộ kho mã 1005/1005; kiểm thử giao diện `tests/e2e/80-quality-assurance.spec.ts` (CT-22f-9) đạt; toàn bộ kiểm thử giao diện 150/152 trên máy (01-login lỗi tiêu điểm bàn phím chỉ trên máy, chạy lại đạt; 04-accounts lỗi do tài khoản trùng của các lượt chạy trước ở cơ sở dữ liệu định danh dùng lại, không liên quan 22f; CI là chuẩn); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: bộ mẫu Mầm non chỉ có tên tiêu chuẩn, tiêu chí, cần đối chiếu văn bản hiện hành; kế hoạch cải tiến tạo kế hoạch nháp không cần quyền lập kế hoạch của người thao tác (người quản lý kế hoạch của đơn vị vẫn phải kích hoạt).
- Khả năng tương thích: không đổi điểm cuối cũ; cổng quản trị có thêm một phân hệ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 22f; chạy phần quay lui của tệp năm học `0071` và tệp định danh `0063`.

### Phiên bản 0.99.0 – 2026-10-22

- Phạm vi thay đổi: DT-18 phần 22d, thi đua, khen thưởng cán bộ, giáo viên (YCTD-148).
- Chức năng mới: phân hệ "Thi đua, khen thưởng": danh mục danh hiệu cấu hình được; đợt thi đua, phát động; đăng ký thi đua cá nhân, tập thể; hồ sơ đề nghị lấy KPI làm đầu vào, minh chứng từ kho hồ sơ chuyên môn, điều kiện của danh hiệu; hội đồng, bỏ phiếu kín, biên bản; phúc khảo, khiếu nại có hạn; quyết định khen thưởng, tờ trình cấp trên, dự thảo văn bản đi; giấy khen có mã tra cứu công khai; sổ theo dõi nhiều năm; báo cáo đợt; nguồn Việc của tôi.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0070_create_emulation`; tệp định danh `0062_add_emulation_permissions`.
- Thay đổi API: `/emulation/*`, `/public/emulation-awards/verify`.
- Kiểm thử: kịch bản CT-776 đến CT-785. Kết quả ngày 22/10/2026: kiểm thử đơn vị `apps/api/src/emulation/emulation.test.ts` CT-22d-1 đến CT-22d-9 đạt 9/9 (sửa `system-admin-so.test.ts` CT-16d-3 đếm 18 phân hệ); kiểm thử đơn vị toàn bộ kho mã 997/997 đạt; kiểm thử giao diện `tests/e2e/79-emulation.spec.ts` (CT-22d-10) đạt; toàn bộ kiểm thử giao diện 151 ca: lần chạy đầu 148 đạt; spec 79 sửa bộ chọn nút rồi đạt; `61-health-nutrition-so`, `70-incoming-documents` lỗi chập chờn ở máy cục bộ, chạy lại 70 đạt, không liên quan 22d (spec 58 đếm 18 phân hệ); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: tiêu chuẩn mặc định cần đối chiếu văn bản hiện hành; sổ nhiều năm đọc mọi cơ sở dữ liệu năm học nên chậm dần theo số năm.
- Khả năng tương thích: không đổi điểm cuối cũ; thêm phân hệ thứ 18.
- Phương án quay lui: hoàn lại commit gộp của nhánh 22d; chạy phần quay lui của tệp năm học `0070` và tệp định danh `0062`.

### Phiên bản 0.98.0 – 2026-10-21

- Phạm vi thay đổi: DT-18 phần 22b, bán trú, kiểm thực ba bước và an toàn thực phẩm (YCTD-146).
- Chức năng mới: lô hàng nhập từ phiếu đi chợ hoặc nhập tay, hạn dùng, chứng từ; hồ sơ an toàn thực phẩm của nhà cung cấp, cảnh báo sắp hết hạn; kiểm thực ba bước theo Quyết định 1246/QĐ-BYT ngày 31/3/2017 của Bộ Y tế; lưu và hủy mẫu thức ăn, giữ mẫu khi có phản ánh; truy xuất từ món ra lô và nhà cung cấp; sổ kiểm thực ba bước, sổ lưu mẫu, nhãn mẫu; nguồn Việc của tôi "Bán trú, an toàn thực phẩm".
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0068_create_food_safety`; tệp định danh `0060_add_food_safety_permission`.
- Thay đổi API: `/food-safety/files`, `/food-supplier-certificates`, `/food-suppliers/safety-summary`, `/food-lots`, `/food-inspections`, `/food-samples`, `/food-safety/trace`, `/food-safety/books`; chi tiết phiếu đi chợ thêm trường.
- Kiểm thử: kịch bản CT-769 đến CT-775. Kết quả ngày 21/10/2026: kiểm thử đơn vị `apps/api/src/kitchen/food-safety.test.ts` CT-22b-1 đến CT-22b-6 đạt 6/6; kiểm thử đơn vị toàn bộ kho mã 988/988; kiểm thử giao diện `tests/e2e/77-food-safety.spec.ts` (CT-22b-7) đạt; toàn bộ kiểm thử giao diện 150/150; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: phiếu bước 1 xác nhận thì đổi trạng thái lô nên không mở lại được; tệp quét giấy tờ chỉ người xem dữ liệu bếp của đơn vị tải được.
- Khả năng tương thích: không đổi điểm cuối cũ; chi tiết phiếu đi chợ thêm trường.
- Phương án quay lui: hoàn lại commit gộp của nhánh 22b; chạy phần quay lui của tệp năm học `0068` (xóa lô, phiếu kiểm thực, mẫu lưu, giấy tờ) và tệp định danh `0060`.

### Phiên bản 0.97.0 – 2026-10-21

- Phạm vi thay đổi: DT-18 phần 22i, kế hoạch giáo dục (YCTD-147).
- Chức năng mới: thư viện mẫu kế hoạch theo cấp học (nạp bảy mẫu Mầm non); lập kế hoạch của trường, tổ, nhóm lớp, cá nhân theo mục; duyệt nhiều cấp tổ trưởng, Phó Hiệu trưởng, Hiệu trưởng, bốn trạng thái; kí nội bộ; lưu bản đã duyệt vào kho hồ sơ chuyên môn; phiên bản, so sánh khác biệt, sao chép từ năm trước; xuất Word, PDF; bảng tiến độ duyệt, xuất Excel; tạo kế hoạch công việc; nguồn Việc của tôi.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0069_create_education_plans`; tệp định danh `0061_add_education_plan_permissions`.
- Thay đổi API: `/education-plan-templates`, `/education-plans` và các điểm cuối con.
- Kiểm thử: kịch bản CT-759 đến CT-768. Kết quả ngày 21/10/2026: kiểm thử đơn vị `apps/api/src/education-plans/education-plans.test.ts` CT-22i-1 đến CT-22i-9 đạt 9/9; kiểm thử đơn vị toàn bộ kho mã 982/982; kiểm thử giao diện `tests/e2e/78-education-plans.spec.ts` (CT-22i-10) đạt; toàn bộ kiểm thử giao diện 149/149 (148 ở lượt toàn bộ, spec 78 chạy lại sau khi sửa đạt); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: kế hoạch đã kí là văn bản nội bộ, không thay chữ kí số của nhà cung cấp; mẫu mặc định cần trường rà theo hướng dẫn năm học.
- Khả năng tương thích: không đổi điểm cuối cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 22i; chạy phần quay lui của tệp năm học `0069` và tệp định danh `0061` (hồ sơ đã lưu vào kho hồ sơ chuyên môn vẫn giữ).

### Phiên bản 0.96.0 – 2026-10-21

- Phạm vi thay đổi: DT-18 phần 18h, quản trị và trình diễn (YCTD-145).
- Chức năng mới: đăng nhập thay có lý do, thanh báo, nút thoát, nhật ký; không vào tài khoản có quyền cao hơn; gói ZIP toàn bộ dữ liệu của trường tạo ở tiến trình nền, hạn tải 48 giờ, nhật ký tải; bản trình diễn có dữ liệu giả, trang chọn vai, dải trình diễn, chặn gửi tin và thanh toán thật, lệnh tạo và tự đặt lại.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp định danh `0059_add_impersonation_and_data_export`; tệp hệ thống `0022_create_impersonation_export_demo_tables`.
- Thay đổi API: `/auth/impersonation`, `/auth/impersonation/exit`, `/auth/impersonations`, `/users/data-export`, `/impersonation-actions`, `/school-data-exports`, `/public/demo`; `/auth/me` thêm `impersonation`.
- Kiểm thử: kịch bản CT-748 đến CT-758. Kết quả ngày 21/10/2026: kiểm thử đơn vị `apps/api/src/demo/administration-18h.test.ts` CT-18h-1 đến CT-18h-9 đạt 9/9; kiểm thử đơn vị toàn bộ kho mã 973/973 đạt; kiểm thử giao diện `tests/e2e/76-administration-demo.spec.ts` (CT-18h-10, CT-18h-11) đạt; toàn bộ kiểm thử giao diện đạt 148/148; lệnh tạo dữ liệu trình diễn chạy trên cơ sở dữ liệu riêng đạt 25/25 bước; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: gói ZIP có dữ liệu cá nhân, chỉ Hiệu trưởng tạo, chỉ người tạo tải, hạn 48 giờ; lệnh trình diễn xóa dữ liệu nên có kiểm tra từ chối dữ liệu thật và chỉ chạy với `--confirm`.
- Khả năng tương thích: không đổi điểm cuối cũ; `/auth/me` thêm trường; máy chủ không có dấu trình diễn chạy như cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh 18h; chạy phần quay lui của tệp định danh `0059` (xóa phiên đăng nhập thay) và tệp hệ thống `0022` (xóa gói ZIP đã tạo); bỏ dịch vụ `demo-reset`.

### Phiên bản 0.95.0 – 2026-10-21

- Phạm vi thay đổi: DT-18 phần 18e, hồ sơ chuyên môn và Việc của tôi (YCTD-142, PR 121).
- Chức năng mới: phân hệ mới "Hồ sơ chuyên môn": Việc của tôi gom việc đang chờ ở văn bản đến, văn bản đi, giao việc, phòng họp, KPI, hồ sơ chuyên môn, kế hoạch bài dạy, kí hồ sơ, nghỉ phép, có lọc và số đếm trên menu; kho hồ sơ ba nhánh (cá nhân, tổ hoặc nhóm, trường) theo năm học, danh mục thư mục mặc định theo cấp học; đợt nộp có hạn, bảng ai chưa nộp, nhắc hạn; luồng duyệt theo thư mục (tổ trưởng rồi Ban Giám hiệu), trả lại, phiên bản khi nộp lại, kí nội bộ; thống kê nộp đúng hạn, trễ, chưa nộp; nhóm công tác; khóa năm học (YCTD-142).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0066_create_professional_records` (tám bảng mới, mục đích tệp `professional_record`); tệp định danh `0056_add_professional_record_permissions` (bốn quyền `P09.professional-record.*`, phân hệ không có ở phụ huynh).
- Thay đổi API: nhóm điểm cuối mới `/my-work`, `/professional-records`, `/professional-folders`, `/professional-work-groups`, `/professional-rounds`, `/professional-documents`; tám khóa lưới mới.
- Kiểm thử: kịch bản CT-738 đến CT-747. Kết quả ngày 21/10/2026: kiểm thử đơn vị `apps/api/src/professional-records/professional-records.test.ts` CT-18e-1 đến CT-18e-9 đạt 9/9; kiểm thử đơn vị toàn bộ kho mã 963/964 đạt, ca chưa đạt CTC-P06-007 (phiếu thu phát hành đồng thời, ngoài phạm vi 18e) chạy lại tệp đạt 29/29; kiểm thử giao diện `tests/e2e/74-professional-records.spec.ts` (CT-18e-10) đạt 1/1; toàn bộ e2e chưa chạy lại toàn bộ sau khi gộp 18f; spec 02, 03, 58 quản trị hệ thống, 74 đạt 9/9 (lần đầu spec 02 quá thời gian chờ mở năm học, chạy lại đạt).
- Rủi ro: thông báo cho tổ trưởng gửi theo vai trò Tổ trưởng chuyên môn của đơn vị; Việc của tôi đọc nhiều bảng mỗi lần đếm (làm mới mỗi phút).
- Khả năng tương thích: điểm cuối cũ không đổi; số phân hệ của 1.2 Phân quyền nhóm theo phần mềm thành 17.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-18-phan-18e`; chạy phần quay lui của tệp định danh `0056` và tệp năm học `0066` (xóa tám bảng, tệp mục đích `professional_record`).
### Phiên bản 0.94.0 – 2026-10-21

- Phạm vi thay đổi: DT-18 phần 18f, website trường trên tên miền riêng, có chế độ trình diễn (YCTD-144).
- Chức năng mới: phân hệ Website trường; tên miền lưu ở cơ sở dữ liệu, cấp chứng chỉ theo yêu cầu cho tên miền đã đăng ký; trang công khai theo tên miền (trang chủ, giới thiệu, cơ cấu tổ chức, tin tức, thông báo, văn bản công khai, tuyển sinh, công khai theo Thông tư 09/2024/TT-BGDĐT, thời khóa biểu chờ, thư viện ảnh, liên hệ); soạn, duyệt, đăng, gỡ; lọc HTML chống XSS; chế độ trình diễn và nội dung mẫu (P14-13 đến P14-16).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp hệ thống `0021_create_website_tables` (8 bảng); tệp định danh `0058_add_website_permissions` (ba quyền P14).
- Thay đổi API: nhóm điểm cuối mới `/website/*`, `/public/site/*`, `/public/website/domain-check`.
- Kiểm thử: kịch bản CT-727 đến CT-737. Kết quả ngày 21/10/2026: kiểm thử đơn vị `apps/api/src/website/website.test.ts` CT-18f-1 đến CT-18f-10 đạt 10/10; kiểm thử đơn vị toàn bộ kho mã đạt 955/955 (CSDL riêng của 18f); kiểm thử giao diện `tests/e2e/75-school-website.spec.ts` (CT-18f-11) đạt; toàn bộ kiểm thử giao diện 144/145 trên máy (ca 04-accounts hỏng cục bộ vì cơ sở dữ liệu định danh riêng còn tài khoản trùng tên của lượt chạy trước; CI chạy trên cơ sở dữ liệu mới là kết quả chính); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt; cấu hình Caddy kiểm tra bằng `caddy validate` (Caddy 2.10) hợp lệ.
- Rủi ro: tên miền lạ không có trang; trang công khai đọc dữ liệu đã duyệt, cần người duyệt rà ảnh có trẻ trước khi đăng.
- Khả năng tương thích: không đổi điểm cuối cũ; Caddyfile thêm khối `https://` cuối cùng nên các tên miền đã có giữ nguyên.
- Phương án quay lui: hoàn lại commit gộp của nhánh 18f; chạy phần quay lui của tệp định danh `0058` và tệp hệ thống `0021` (xóa 8 bảng); tệp dưới tiền tố `website/` ở kho tệp xóa tay nếu cần; bỏ khối `on_demand_tls` và `https://` khỏi Caddyfile.

### Phiên bản 0.93.0 – 2026-10-20

- Phạm vi thay đổi: DT-18 phần 18g, thiết bị có nơi để, tem QR, kiểm kê bằng điện thoại, đối sánh danh mục tối thiểu theo cấp học (YCTD-143, PR 119).
- Chức năng mới: 2.4 Nơi để và tem QR thiết bị (nơi để phòng, kho, vị trí; gán nơi để hàng loạt; in tem QR khổ A4 3 × 8, mã tem không có tên miền); 2.5 Kiểm kê thiết bị (lập đợt chụp sổ, quét QR trên ứng dụng giáo viên hoặc web di động, đối chiếu, tỷ lệ sử dụng được, nộp, duyệt, trả lại, chốt chênh lệch, biên bản PDF, Excel); 2.6 Đối sánh danh mục tối thiểu (danh mục cấu hình theo cấp học, nạp mẫu Mầm non 515 thiết bị theo TT 02/2010 sửa đổi bởi TT 34/2013, báo Đủ, Thiếu, Chưa có); màn hình Kiểm kê thiết bị của ứng dụng giáo viên (P13-16 đến P13-18).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0067_add_equipment_locations_stocktakes` (ba bảng mới, sáu cột mới của `equipment_items`, `equipment_holdings`, `assets`); tệp định danh `0057_add_equipment_stocktake_permission` (quyền `P13.equipment.stocktake`).
- Thay đổi API: nhóm điểm cuối mới `/equipment-locations`, `/equipment-placements`, `/equipment-labels`, `/equipment-qr/{code}`, `/equipment-stocktakes`, `/equipment-templates`, `/equipment-minimum`; năm khóa lưới mới.
- Kiểm thử: kịch bản CT-720 đến CT-726. Kết quả ngày 20/10/2026: kiểm thử đơn vị `apps/api/src/facilities/equipment-18g.test.ts` CT-18g-1 đến CT-18g-6 đạt 6/6; kiểm thử đơn vị toàn bộ kho mã 945/945 đạt; kiểm thử giao diện `tests/e2e/73-equipment-stocktake.spec.ts` (CT-18g-7) đạt; toàn bộ kiểm thử giao diện 144/144 đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: danh mục mẫu chép từ bản đăng trên trang văn bản pháp luật, cần đối chiếu bản gốc; chốt chênh lệch thay số hiện có của lô bằng số dùng được; quét bằng máy ảnh cần HTTPS và quyền máy ảnh của trình duyệt.
- Khả năng tương thích: điểm cuối cũ không đổi; thư viện mới `jsqr` 1.4.0 ở gói giao diện.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-18-phan-18g`; chạy phần quay lui của tệp định danh `0057` và tệp năm học `0067` (xóa ba bảng, sáu cột); thiết bị đã nạp từ mẫu (`template_code` có giá trị) và ghi nhận hỏng, mất lập khi chốt giữ lại hoặc xóa tay.

### Phiên bản 0.92.0 – 2026-10-20

- Phạm vi thay đổi: DT-18 phần 18c, giao việc, lịch đơn vị, phòng họp, hồ sơ công việc, báo cáo theo VNPT iOffice (YCTD-141).
- Chức năng mới: giao việc theo cây đơn vị (xử lý chính, phối hợp, theo dõi; phòng ban hoặc cá nhân), phân công tiếp, cập nhật tiến độ, phê duyệt, thu hồi, nhắc việc định kì, tạo việc từ văn bản đến; lịch tuần sáng, chiều, công bố, mẫu lịch, lịch họp tuần, tháng, của tôi, xuất Excel, PDF; phòng họp có duyệt và kiểm tra trùng giờ; hồ sơ công việc cá nhân, chia sẻ, chuyển giao, nộp lưu sang văn thư lưu trữ, hồ sơ hết hạn bảo quản; báo cáo thực hiện văn bản đến, tổng hợp, thống kê (P09-24 đến P09-27).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0065_extend_tasks_for_directives`; tệp hệ thống `0020_create_unit_schedules_and_work_files` (9 bảng); tệp định danh `0055_add_directive_schedule_permissions` (sáu quyền P09).
- Thay đổi API: nhóm điểm cuối mới `/task-directives`, `/meeting-rooms`, `/room-bookings`, `/unit-schedules`, `/unit-schedule-templates`, `/work-files`, `/document-reports`, `GET /incoming-documents/{id}/tasks`.
- Kiểm thử: kịch bản CT-707 đến CT-719. Kết quả ngày 20/10/2026: kiểm thử đơn vị `apps/api/src/work/directives.test.ts` và `apps/api/src/unit-schedules/unit-schedules.test.ts` CT-18c-1 đến CT-18c-12 đạt 12/12; kiểm thử đơn vị toàn bộ kho mã 939/939 đạt; kiểm thử giao diện `tests/e2e/72-directives.spec.ts` (CT-18c-13) đạt; toàn bộ kiểm thử giao diện 140/143 đạt trên máy (58 CT-16a-10, 68 CT-17a-6 lỗi không liên quan 18c; CI chạy lại); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: dòng giao cho đơn vị phụ thuộc người quản lý đơn vị được ghi ở cây đơn vị hoặc có quyền giao việc; lịch, hồ sơ công việc mang dữ liệu công tác của cán bộ.
- Khả năng tương thích: không đổi điểm cuối cũ; `/tasks` bỏ qua việc loại mới.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-18-phan-18c`; chạy phần quay lui của tệp định danh `0055`, tệp hệ thống `0020` (xóa 9 bảng) và tệp năm học `0065` (xóa việc loại mới, hai bảng, các cột thêm; trả ràng buộc); tệp đính kèm của việc dưới tiền tố `tasks/` ở kho tệp xóa tay nếu cần.

### Phiên bản 0.91.0 – 2026-10-20

- Phạm vi thay đổi: DT-18 phần 18b, văn bản đi theo VNPT iOffice (YCTD-140, PR18B_SO).
- Chức năng mới: nhóm 3. Văn bản đi của phân hệ "Quản lý văn bản và điều hành": dự thảo theo biểu mẫu văn bản đi, lấy ý kiến theo đợt, cho ý kiến, kết thúc cho ý kiến, kết thúc lấy ý kiến, trình ký, lấy lại, ký nội bộ (bản đã ký có khối xác nhận, ảnh con dấu, mã QR tra cứu), không ký, trả lại, cấp số và phát hành theo sổ văn bản đi, liên thông nội bộ thành văn bản đến chờ vào sổ của đơn vị nhận trong trường, liên thông ra ngoài bản chạy nội bộ (đánh dấu đã gửi), public lên cổng TTĐT, đóng băng, lưu hồ sơ, văn bản trả lời ghi vào văn bản đến; sổ văn bản đi, sổ đăng ký văn bản đi xuất Excel, phiếu trình ký PDF, trang tra cứu mã QR công khai (P09-20 đến P09-23).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp hệ thống `0019_create_outgoing_document_tables` (sáu bảng `outgoing_*`, ba cột mới và nguồn `internal` của `incoming_documents`); tệp định danh `0054_add_outgoing_document_permissions` (bốn quyền P09).
- Thay đổi API: nhóm điểm cuối mới `/outgoing-documents`, `/document-books/{id}/outgoing-register`, `/public/outgoing-documents/verify`; `/document-books?direction=outgoing` đếm văn bản đi.
- Kiểm thử: kịch bản CT-697 đến CT-706. Kết quả ngày 20/10/2026: kiểm thử đơn vị `apps/api/src/outgoing-documents/outgoing-documents.test.ts` CT-18b-1 đến CT-18b-9 đạt 9/9; kiểm thử đơn vị toàn bộ kho mã 927/927 đạt; kiểm thử giao diện `tests/e2e/72-outgoing-documents.spec.ts` (CT-18b-10) và `70-incoming-documents.spec.ts` đạt; KQ18B_E2E; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: bản đã ký là ký xác nhận nội bộ, không có giá trị của chữ ký số; mã QR in địa chỉ theo nguồn của cổng lúc ký nên đổi tên miền sau khi ký thì mã vẫn tra được bằng ô nhập mã.
- Khả năng tương thích: không đổi điểm cuối cũ; `DocumentExchange` thêm `send`, `DossierSigner` nhận thêm `verification` (không bắt buộc), văn bản đến nhận thêm nguồn `internal`.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-18-phan-18b`; chạy phần quay lui của tệp định danh `0054` và tệp hệ thống `0019` (xóa văn bản đến nguồn `internal`, sáu bảng, ba cột; tệp ở kho tệp dưới tiền tố `outgoing-documents/` xóa tay nếu cần).

### Phiên bản 0.90.0 – 2026-10-20

- Phạm vi thay đổi: DT-18 phần 18d, phân hệ KPI chuyển từ hệ thống KPI riêng của trường, hai bộ quy tắc chấm cấu hình được (YCTD-139).
- Chức năng mới: phân hệ "Đánh giá KPI" 13 mục: kỳ đánh giá và lịch kỳ, khóa và mở lại kỳ; bộ quy tắc có phiên bản (cấu hình JSON, kiểm tra trước khi ghi, ban hành), mẫu quy chế theo cấp học; đối tượng đánh giá; danh mục công việc chuẩn chung và của đơn vị (đề xuất, duyệt, nhập Excel); giao việc, tự đăng ký, duyệt, chuyển trả, gia hạn, minh chứng có số ký hiệu văn bản và tệp, tự đánh giá, chấm, ủy quyền chấm, hạn tự động; phiếu tự đánh giá theo Mẫu 01-A, 01-B; kết luận của cấp trên; tham mưu kèm tỷ lệ xuất sắc; biểu quyết; báo cáo Excel, Word, PDF; sổ trách nhiệm chấm, duyệt; chuyển dữ liệu từ tệp sao lưu của hệ thống cũ (P09-13 đến P09-19).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0064_create_kpi` (12 bảng `kpi_*`, hai bộ quy tắc mặc định, mục đích tệp `kpi_evidence`); tệp định danh `0053_add_kpi_permissions` (năm quyền P09).
- Thay đổi API: nhóm điểm cuối mới `/kpi`.
- Kiểm thử: kịch bản CT-678 đến CT-696. Kết quả ngày 20/10/2026: kiểm thử đơn vị `apps/api/src/kpi/kpi.test.ts` CT-18d-1 đến CT-18d-18 đạt 18/18; kiểm thử đơn vị toàn bộ kho mã 918/918 đạt (sau khi gộp 18a; trước khi gộp 908/908, ca CT-16d-3 đổi số phân hệ thành 15); kiểm thử giao diện `tests/e2e/71-kpi.spec.ts` (CT-18d-19) đạt; toàn bộ kiểm thử giao diện 140/141 đạt ngày 20/10/2026 trên máy (ca 04-accounts hỏng do dữ liệu cũ trùng tên trong cơ sở dữ liệu định danh dùng riêng của phần 18d, CI là nguồn chuẩn); `58-system-admin-full-so.spec.ts` sửa số phân hệ thành 15; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: cấu hình bộ quy tắc sửa dạng JSON nên người cấu hình cần đọc kỹ tóm tắt trước khi ban hành; tham số của bộ quy tắc 1 lấy từ văn bản hạn chế phát tán nên chỉ giữ dạng tham số; minh chứng là dữ liệu công việc của cán bộ.
- Khả năng tương thích: không đổi điểm cuối, bảng cũ; phân hệ mới hiện cho mọi vai trò chưa bị loại phân hệ ở 1.2 Phân quyền nhóm theo phần mềm.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-18-phan-18d`; chạy phần quay lui của tệp định danh `0053` (xóa năm quyền) và tệp năm học `0064` (xóa 12 bảng, xóa dòng `files` mục đích `kpi_evidence`, trả ràng buộc; tệp ở kho tệp dưới tiền tố `kpi-evidence/` xóa tay nếu cần).

### Phiên bản 0.89.0 – 2026-10-20

- Phạm vi thay đổi: DT-18 phần 18a, văn bản đến theo hệ thống quản lý văn bản và điều hành VNPT iOffice (YCTD-138).
- Chức năng mới: phân hệ "Quản lý văn bản và điều hành" (14 phân hệ trên cổng quản trị); 1.1 Văn bản đến (chờ xử lý, đã xử lý, lọc vai trò); 1.2 Quản lý văn bản đến (vào sổ theo biểu mẫu THÔNG TIN VĂN BẢN ĐẾN); luồng xử lý (trình lãnh đạo, chuyển lãnh đạo, chuyển xử lý chính, phối hợp, xem để biết, chuyển trực tiếp, luân chuyển, trả lại, từ chối, lấy lại, xử lý xong, xin gia hạn, kết thúc, kết thúc hàng loạt, lưu hồ sơ hàng loạt, văn bản trả lời, hạn chế xem, đánh dấu, theo dõi, đánh dấu chưa đọc); phiếu trình, phiếu xử lý, phiếu giao nhận PDF; sơ đồ luồng văn bản, lịch sử tham mưu; 1.3 đến 1.6 xem để biết, đánh dấu, theo dõi, tra cứu; 1.7 liên thông văn bản bản chạy nội bộ; 2.1 Sổ văn bản (sổ đăng ký, xuất Excel), 2.2 Đơn vị bên ngoài, 2.3 Khai báo nhóm đơn vị ban hành, 2.4 Danh mục văn bản, 2.5 Lãnh đạo nhận văn bản (P09-09 đến P09-12).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp hệ thống `0018_create_incoming_document_tables` (13 bảng, danh mục mặc định); tệp định danh `0052_add_incoming_document_permissions` (bốn quyền P09, bỏ phân hệ khỏi VT-14).
- Thay đổi API: các nhóm điểm cuối mới `/document-catalogs`, `/external-units`, `/external-unit-groups`, `/document-leaders`, `/document-staff`, `/document-books`, `/incoming-documents` (xem `17_DAC_TA_API.md` mục 12).
- Kiểm thử: kịch bản CT-667 đến CT-677. Kết quả ngày 20/10/2026: kiểm thử đơn vị CT-18a-1 đến CT-18a-10 đạt 10/10 (cùng `menu-permissions.test.ts`, `quick-links.test.ts` 17/17 ca; sửa `system-admin-so.test.ts` CT-16d-3 đếm 14 phân hệ, 10/10 ca); kiểm thử đơn vị toàn bộ kho mã 900/900 đạt (sau khi sửa ca CT-16d-3); kiểm thử giao diện CT-18a-11 (`70-incoming-documents.spec.ts`) đạt; toàn bộ kiểm thử giao diện 140/140 đạt (spec 58 đếm 14 phân hệ); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: văn bản đến có thể có nội dung mật; hạn chế xem chỉ che với người ngoài luồng, tệp đính kèm không mã hóa riêng ngoài kho tệp; độ mật hiện là nhãn, không tự hạn chế xem.
- Khả năng tương thích: không đổi dữ liệu, điểm cuối cũ; nhóm người dùng đã có nhận thêm phân hệ mới (trừ VT-14).
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-18-phan-18a`; chạy phần quay lui của tệp định danh `0052` (xóa bốn quyền, dòng loại trừ phân hệ) và tệp hệ thống `0018` (xóa 13 bảng); tệp ở kho tệp dưới tiền tố `incoming-documents/` xóa tay nếu cần.

### Phiên bản 0.88.0 – 2026-10-20

- Phạm vi thay đổi: DT-17 phần 17d, phân hệ Tuyển sinh đầu cấp phần 2 theo hệ thống của Sở, bản chạy nội bộ (YCTD-135). Phần cuối của DT-17.
- Chức năng mới: 1.3 Danh sách học sinh đăng ký trường tiên tiến (Xác nhận hồ sơ, Không đồng ý, Chưa xác nhận, trạng thái xã/phường nhập tay, Tải minh chứng, In phiếu, Xóa); 1.4 Tiếp nhận hồ sơ tuyển sinh (nhập danh sách phân tuyến từ Excel, ô tích giấy tờ đã nộp, phụ huynh đồng ý hoặc từ chối nhập học, Lưu dữ liệu, Cập nhật, Tải phiếu thông tin, In phiếu đăng ký, Hủy nhập học; loại hình và năm học nhận trẻ của đợt); 1.5 Gửi thông báo tuyển sinh đầu cấp (qua ứng dụng phụ huynh và Zalo OA, nội dung riêng từng người, học sinh ngoài hệ thống); 1.6 Chuyển hồ sơ trúng tuyển sang CSDL (mã gói tin, mã GUID, bảng kết quả); 1.7 Danh sách kết quả chuyển hồ sơ (Hủy nhập học hồ sơ chưa phát sinh dữ liệu, kết quả hủy); 5.11 Danh sách trúng tuyển Tuyển sinh đầu cấp ở phân hệ Mầm non (xếp lớp, chuyển sang hồ sơ học sinh) (P02-29 đến P02-33).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0062_add_entry_admission_intake` (hai cột của `admission_campaigns`; các cột mới, nguồn `routing`, trạng thái `cancelled` của `admission_applications`; năm bảng mới; mục đích tệp `admission_document`); tệp định danh `0051_add_entry_intake_permissions` (ba quyền P02).
- Thay đổi API: nhóm điểm cuối mới `/entry-intake` (đợt, danh mục, hồ sơ theo màn hình, Lưu dữ liệu, xác nhận trường tiên tiến, Xóa, Hủy nhập học, nhập danh sách phân tuyến, giấy tờ, minh chứng, Excel, phiếu PDF, thông báo, chuyển hồ sơ, xếp lớp, kết quả, hủy nhập học hồ sơ đã chuyển); tra cứu hồ sơ tuyển sinh công khai trả nhãn "Đã hủy nhập học"; `GET /files/{id}` từ chối tệp `admission_document`.
- Kiểm thử: kịch bản CT-655 đến CT-666. Kết quả ngày 20/10/2026: kiểm thử đơn vị CT-17d-1 đến CT-17d-10 và CT-17d-12 (11 ca) đạt 11/11 (cùng `admissions.test.ts`, `year-transition.test.ts` 27/27 ca); kiểm thử đơn vị toàn bộ kho mã 890/890 đạt; kiểm thử giao diện CT-17d-11 đạt; toàn bộ kiểm thử giao diện 139/139 đạt (lượt chạy trước khi thêm việc chép giấy tờ khi mở năm học và chặn `GET /files/{id}` với tệp `admission_document`, hai thay đổi không đụng giao diện, đã chạy lại tệp kiểm thử đơn vị 17d đạt); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: tệp Excel, phiếu PDF in đủ số định danh với người có `P02.national-id.view` nên cần giữ như tài liệu mật; giấy tờ của trẻ là dữ liệu cá nhân; Hủy nhập học xóa mềm hồ sơ học sinh, chỉ làm khi chưa phát sinh dữ liệu.
- Khả năng tương thích: không đổi điểm cuối cũ; đợt đã có nhận loại hình Đại trà, chưa có năm học nhận trẻ; hồ sơ đã có nhận loại hồ sơ Tự do, đồng ý nhập học "Chưa trả lời"; dữ liệu của phân hệ Tuyển sinh (YCTD-86) có thêm nguồn `routing` và trạng thái `cancelled`, trang Tuyển sinh hiện hai nhãn mới; mở năm học mới chép thêm giấy tờ của hồ sơ tuyển sinh được chuyển.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-17-phan-17d`; chạy phần quay lui của tệp định danh `0051` (xóa ba quyền) và tệp năm học `0062` (xóa năm bảng và các cột mới, đưa hồ sơ đã hủy nhập học về `passed` hoặc `converted`, hồ sơ phân tuyến về nguồn `staff`, xóa các tệp `admission_document` ở bảng tệp, trả ràng buộc; tệp ở kho tệp dưới tiền tố `admission_document/` xóa tay nếu cần; hồ sơ học sinh đã xóa mềm khi hủy nhập học giữ nguyên).

### Phiên bản 0.87.0 – 2026-10-19

- Phạm vi thay đổi: DT-17 phần 17c, phân hệ Tuyển sinh đầu cấp phần 1 theo hệ thống của Sở, bản chạy nội bộ (YCTD-134).
- Chức năng mới: phân hệ "Tuyển sinh đầu cấp" (13 phân hệ trên cổng quản trị); 1.1 Hồ sơ học sinh cuối cấp mầm non (hồ sơ tự lập cho trẻ lớp năm cuối cấp, luồng sáu trạng thái, kiểm dò năm mục, hạn điều chỉnh thông tin, Xác nhận hồ sơ thay phụ huynh, Đã chỉnh sửa thông tin, Duyệt, Hủy duyệt, Cập nhật từ Excel, Tải danh sách lỗi, Xuất Excel, Thông tin tài khoản, Khởi tạo mật khẩu, sáu nút Xuất PDF khổ A5, A4 gập đôi, tách tệp nén, In phiếu kê khai, In phiếu thông tin); màn hình "Hồ sơ cuối cấp" của ứng dụng phụ huynh (xác nhận, đề xuất sửa, tải giấy tờ, đồng ý nhập học, gửi hỗ trợ tuyển sinh); 1.2 Gửi xác nhận hoàn thành hồ sơ cuối cấp (đánh dấu tay theo lớp); 1.8 Thông tin trường tuyển sinh theo bản đồ GIS; 2.1 Các dịch vụ được đăng ký tại trường; 3.1 đến 3.4 hiển thị nhóm người dùng, người dùng, nhân sự, lớp; 4.1 Thống kê hồ sơ cuối cấp; 5.1 Danh sách hỗ trợ tuyển sinh (P02-24 đến P02-28).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0061_create_entry_admissions` (sáu bảng mới, bảy cột của `org_units`, mục đích tệp `final_year_document`); tệp định danh `0050_add_entry_admission_permissions` (bốn quyền P02, bỏ phân hệ khỏi VT-14).
- Thay đổi API: các nhóm điểm cuối mới `/final-year-records`, `/final-year-completion`, `/final-year-statistics`, `/parent/final-year-records`, `/entry-school-map`, `/school-services`, `/entry-admissions/staff`, `/entry-admissions/classes`, `/admission-support`, `/parent/admission-support`; `GET /files/{id}` từ chối tệp `final_year_document`.
- Kiểm thử: kịch bản CT-642 đến CT-654. Kết quả ngày 19/10/2026: kiểm thử đơn vị CT-17c-1 đến CT-17c-12 đạt 12/12, cùng `menu-permissions.test.ts`, `system-admin-so.test.ts` 26/26 ca đạt (chạy cục bộ); kiểm thử đơn vị toàn bộ kho mã 874/874 đạt; kiểm thử giao diện CT-17c-13 (`tests/e2e/68-entry-admissions.spec.ts`) đạt; toàn bộ kiểm thử giao diện 133/136 đạt (cục bộ; ba ca lỗi không thuộc 17c: 01-login CT-15a-7 lỗi cục bộ đã biết, 04-accounts và 59 CT-16c-17 do dữ liệu kiểm thử còn lại ở cơ sở dữ liệu định danh riêng của phần; lần chạy trước hai ca này đạt); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: tệp Excel, PDF hồ sơ cuối cấp in đủ số định danh với người có `P02.national-id.view` nên cần giữ như tài liệu mật; giấy tờ của trẻ (khai sinh, cư trú) là dữ liệu cá nhân, chỉ tải qua phân hệ.
- Khả năng tương thích: không đổi dữ liệu, điểm cuối cũ; nhóm người dùng đã có nhận thêm phân hệ mới (trừ VT-14); hồ sơ cuối cấp tự lập khi mở danh sách lần đầu.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-17-phan-17c`; chạy phần quay lui của tệp định danh `0050` (xóa bốn quyền và dòng bỏ phân hệ) và tệp năm học `0061` (xóa sáu bảng, bảy cột của `org_units`, các tệp `final_year_document` ở bảng tệp, trả ràng buộc mục đích tệp; tệp ở kho tệp dưới tiền tố `final_year_document/` xóa tay nếu cần).

### Phiên bản 0.86.0 – 2026-10-19

- Phạm vi thay đổi: DT-17 phần 17a, báo cáo số liệu EMIS theo chỉ tiêu và mã số của Sở (YCTD-132).
- Chức năng mới: 1.1.1 Lập báo cáo đầu năm theo Biểu 01.ĐN-MN năm thẻ, mã 01 đến 217, cột riêng từng thẻ, và Biểu 08.ĐN-NSNN mã 1 đến 71; 1.2.1 thẻ Cơ sở vật chất sáu khối A đến F, mã 01 đến 84, cột Xây dựng mới; 2.1, 2.2, 2.3 theo cấu trúc của Sở; 2.4 trống ở học kỳ I; nút "Xóa dữ liệu" của thẻ nhập tay; trang mới 1.1.2 Gửi báo cáo đầu năm (lưới hồ sơ, lưới biểu mẫu, Gửi hồ sơ, Xuất file lỗi, Đặt trạng thái gửi lại, Hủy), bản chạy nội bộ; ô đối tượng chính sách theo nghị định của trẻ, hai ô kiêm nhiệm của nhân sự, ô xây dựng mới trong năm của phòng (P17-18, P17-20, P17-24 đến P17-28).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0060_add_emis_so_indicators` (cột `children.policy_benefits`, `staff.concurrent_disability_support`, `staff.concurrent_shared_position`, `rooms.built_this_year`; bảng `emis_record_submissions`; xóa số liệu nhập tay theo mã cũ của thẻ Ngân sách nhà nước, thẻ 1 của 1.2 và 2.3).
- Thay đổi API: `GET /reports/emis/start-of-year/sending`, `POST /reports/emis/start-of-year/send`, `/error-file`, `/resend`, `DELETE /reports/emis/forms/{form}/tabs/{tab}`; các trường thêm như YCTD-132.
- Kiểm thử: kịch bản CT-635 đến CT-641. Kết quả ngày 19/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r --workspace-concurrency=1 --no-bail test`) 867/867 ca đạt (lượt toàn kho 853 đạt; 14 ca chạy lại riêng đạt: CT-16a-7 sửa theo biểu mẫu gửi mới và 13 ca điểm danh bị hủy do dữ liệu cũ của cơ sở dữ liệu thử cục bộ); toàn bộ kiểm thử giao diện 137/137 ca đạt (lượt toàn bộ 136 đạt; CT-641 sửa hộp xác nhận Xóa dữ liệu rồi chạy lại spec 68 đạt 2/2); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: tên mục 2 đến 5 của Biểu 08 (mã 24 đến 55) và mã chi tiết khối B của 1.2.1 chưa đối chiếu với Sở; số tính đúng khi hồ sơ trường, nhóm tuổi của lớp, vị trí việc làm và hình thức hợp đồng của nhân sự đã nhập đủ.
- Khả năng tương thích: số liệu nhập tay theo mã cũ của Ngân sách nhà nước, thẻ 1 của 1.2 và 2.3 bị xóa, phải nhập lại theo mã mới; trạng thái gửi của biểu mẫu chung `emis-start-of-year` thay bằng năm biểu mẫu riêng của 1.1.2.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-17-phan-17a` và chạy `down` của tệp `0060` (bỏ bảng `emis_record_submissions` và bốn cột mới); số liệu nhập tay đã xóa không khôi phục bằng `down`, cần lấy từ bản sao lưu.

### Phiên bản 0.85.0 – 2026-10-19

- Phạm vi thay đổi: DT-17 phần 17b, phân hệ Quản lý kí hồ sơ theo bốn mẫu hồ sơ của Sở (YCTD-133).
- Chức năng mới: nội dung hồ sơ trường, lớp, nhân sự (mười hai phần), học sinh theo phần và mục của Sở, in đủ số định danh, CCCD, sổ BHXH với người có quyền xem số định danh; tệp dữ liệu XML theo mã loại hồ sơ; cửa sổ "Xem hồ sơ kí"; kiểu chữ ký REMOTE SIGNING, USB TOKEN và năm nhà phát hành của Sở; thông tin trường, lịch sử yêu cầu đăng ký ở 1.1; lưới 2.2 cột theo loại, lọc khối, lớp, cột Ghi chú, "Tải file lỗi", trạng thái "Chờ ký"; lưới 2.3 theo cột của Sở, "Tìm kiếm", "Hủy xác nhận hoàn thành"; bỏ sổ đầu bài ở cấp Mầm non (P01-28 đến P01-31).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp hệ thống `0017_adjust_signing_to_so_templates` (chứng thư HSM chuyển REMOTE SIGNING, năm cột mới của `signing_dossiers`, bảng `signing_create_errors`).
- Thay đổi API: `GET /signing/dossiers/{id}/view`, `GET /signing/create-errors/file`, `version=xml`; các trường thêm như YCTD-133.
- Kiểm thử: kịch bản CT-626 đến CT-634. Kết quả ngày 19/10/2026 (trước khi gộp phần 17e): kiểm thử đơn vị toàn bộ kho mã (`pnpm -r --workspace-concurrency=1 --no-bail test`) 856/856 ca đạt; toàn bộ kiểm thử giao diện 134/134 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt; CI đạt trên nhánh đã gộp.
- Rủi ro: hồ sơ in đủ số định danh nên chỉ người có `P02.national-id.view` tạo, xem được hồ sơ nhân sự, học sinh; tệp tải về cần giữ như tài liệu mật.
- Khả năng tương thích: hồ sơ đã lập ở 16k giữ tệp, xem được ở cửa sổ mới, không có tệp XML; chứng thư có nhà phát hành ngoài danh sách phải chọn lại mới kí được.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-17-phan-17b` và chạy `down` của tệp `0017` (bỏ bảng `signing_create_errors` và năm cột, trả ràng buộc ba kiểu chữ ký; chứng thư đã đổi từ HSM giữ REMOTE SIGNING).

### Phiên bản 0.84.0 – 2026-10-19

- Phạm vi thay đổi: DT-17 phần 17e, 1.7 Rà soát thông tin kiểm định CLGD đủ ô như Sở (YCTD-136).
- Chức năng mới: 1.7 có năm khối theo thứ tự của Sở: Thông tin trường (Tên trường, Mã trường, Loại hình bắt buộc; Cấp học "Mầm non"; Số lớp), Chuẩn quốc gia (năm, ngày công nhận, mức độ), Kiểm định chất lượng giáo dục (năm, ngày công nhận, cấp độ), Cơ sở vật chất và học sinh (thêm Diện tích sàn xây dựng/Học sinh, Thời điểm đăng ký chuẩn quốc gia), Ghi chú tối đa 500 ký tự có bộ đếm; "Lấy dữ liệu" điền thêm từ cây đơn vị và hồ sơ trường; hồ sơ trường thêm tám ô ở thẻ Thông tin chung (diện tích sàn xây dựng, chuẩn quốc gia, kiểm định CLGD) (P01-24, P01-15).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0063_add_accreditation_review_so_fields` thêm 12 cột được để trống vào `accreditation_reviews` kèm ràng buộc kiểm tra; hồ sơ trường thêm tám khóa ở jsonb `general`, không đổi cấu trúc.
- Thay đổi API: không có điểm cuối mới; `/accreditation-review`, `/accreditation-review/collect` trả, nhận thêm các ô mới; `PUT /accreditation-review` trả `ERR_VALIDATION` khi thiếu tên trường, mã trường, loại hình hoặc ghi chú quá 500 ký tự; `PUT /school-profile` nhận tám khóa mới, từ chối năm ngoài 1900 đến 2100.
- Kiểm thử: kịch bản CT-619 đến CT-625. Kết quả ngày 19/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r --workspace-concurrency=1 --no-bail test`) 854/854 ca đạt; toàn bộ kiểm thử giao diện 135/135 ca đạt (chạy cục bộ); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: bản rà soát đã ghi có ghi chú dài hơn 500 ký tự phải rút gọn trước lần ghi sau; thời điểm đăng ký chuẩn quốc gia là chữ tự do do chưa biết định dạng của Sở.
- Khả năng tương thích: bản rà soát đã ghi giữ số cũ, các cột mới trống đến lần ghi sau; người gọi `PUT /accreditation-review` cũ phải gửi thêm `school_name`, `school_code`, `ownership_type`; hồ sơ trường chưa nhập diện tích sàn xây dựng thì Lấy dữ liệu tính như cũ; quyền không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 17e; chạy phần quay lui của tệp năm học `0063` (xóa 12 cột). Tám khóa đã lưu ở `school_profiles.general` không còn được đọc, giữ lại không ảnh hưởng.

### Phiên bản 0.83.0 – 2026-10-18

- Phạm vi thay đổi: DT-15 phần 15f3, các phân hệ Bếp – kho, mua hàng; Tương tác – truyền thông; Giảng dạy; Tuyển sinh, tuyển dụng; Báo cáo theo giao diện chung của Sở (YCTD-115).
- Chức năng mới: tiêu đề 8 trang của năm phân hệ có số theo menu (1. Kho và tài sản, 2. Đề nghị mua hàng, 1. Tương tác với phụ huynh, 2. Hoạt động và tin tức, 1. Bài học và giáo án, 1. Tuyển sinh, 2. Tuyển dụng, 1. Báo cáo và bảng điều khiển); 32 lưới dữ liệu dùng chung ở 8 trang (tìm kiếm, Mở rộng tìm kiếm, cấu hình cột và số dòng theo người dùng); nút Thêm mới mở biểu mẫu theo khối có nút Ghi, Hủy; lưới Danh mục tài sản có cột "Thiết bị dạy học" khi có quyền quản lý thiết bị dạy học (P03, P13 đến P18). Nghiệp vụ không đổi.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: không có bảng, cột mới; cấu hình lưới mới lưu ở `user_grid_settings` sẵn có.
- Thay đổi API: không có điểm cuối mới; `GET`, `PUT /me/grid-settings/{gridKey}` nhận thêm 32 khóa lưới.
- Kiểm thử: kịch bản CT-611 đến CT-618. Kết quả: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r --workspace-concurrency=1 --no-bail test`): 848/848 ca đạt; toàn bộ kiểm thử giao diện: 134/134 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: lưới lọc, phân trang tại chỗ nên danh sách rất dài vẫn tải một lần như trước; người dùng quen biểu mẫu luôn hiện phải bấm "Thêm mới" để mở biểu mẫu.
- Khả năng tương thích: đường dẫn, điểm cuối, quyền không đổi; không có quyền mới; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15f3`; không có tệp thay đổi cấu trúc dữ liệu; dòng cấu hình của 32 khóa lưới ở `user_grid_settings` để lại không ảnh hưởng (khóa lạ không còn được đọc).

### Phiên bản 0.82.0 – 2026-10-18

- Phạm vi thay đổi: DT-15 phần 15f1, phân hệ Tài chính – học phí theo giao diện chung của Sở (YCTD-114).
- Chức năng mới: tiêu đề 15 trang của phân hệ có số theo menu (1.1. Biểu phí và dịch vụ đến 3.2. Chốt kỳ tài chính); 20 lưới dữ liệu dùng chung (tìm kiếm, Mở rộng tìm kiếm, cấu hình cột và số dòng theo người dùng); nút Thêm mới mở biểu mẫu theo khối có nút Ghi; danh sách chờ duyệt thành lưới có nhóm Duyệt, Từ chối dưới dòng; nhắc nợ chọn dòng bằng ô chọn của lưới; xóa phiên bản biểu phí, phiếu chi nháp, dòng sao kê, bỏ quy tắc ghi sổ qua hộp xác nhận xóa dùng chung (P05, P06). Nghiệp vụ không đổi.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: không có bảng, cột mới; cấu hình lưới mới lưu ở `user_grid_settings` sẵn có.
- Thay đổi API: không có điểm cuối mới; `GET`, `PUT /me/grid-settings/{gridKey}` nhận thêm 20 khóa lưới.
- Rủi ro: lưới lọc, phân trang tại chỗ nên danh sách rất dài vẫn tải một lần như trước; người dùng quen nút cũ phải bấm "Thêm mới" để mở biểu mẫu; nút lưu đổi tên thành "Ghi".
- Khả năng tương thích: đường dẫn, điểm cuối, quyền không đổi; không có quyền mới; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15f1`; không có tệp thay đổi cấu trúc dữ liệu; dòng cấu hình của 20 khóa lưới ở `user_grid_settings` để lại không ảnh hưởng (khóa lạ không còn được đọc).

### Phiên bản 0.81.0 – 2026-10-18

- Phạm vi thay đổi: DT-15 phần 15f2, phân hệ Nhân sự – chấm công, lương theo giao diện chung của Sở (YCTD-113).
- Chức năng mới: tiêu đề 12 trang của phân hệ có số theo menu (1.1. Chấm công đến 3.2. Đánh giá nhân sự); 17 lưới dữ liệu dùng chung ở 10 trang (tìm kiếm, Mở rộng tìm kiếm, cấu hình cột và số dòng theo người dùng); nút Thêm mới mở biểu mẫu theo khối có nút Ghi, Hủy; xóa ngày lễ, lịch học bù hoặc nghỉ bù, lịch công tác qua hộp xác nhận xóa dùng chung (P08, P09). Nghiệp vụ không đổi.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: không có bảng, cột mới; cấu hình lưới mới lưu ở `user_grid_settings` sẵn có.
- Thay đổi API: không có điểm cuối mới; `GET`, `PUT /me/grid-settings/{gridKey}` nhận thêm 17 khóa lưới.
- Rủi ro: lưới lọc, phân trang tại chỗ nên danh sách rất dài vẫn tải một lần như trước; người dùng quen nút cũ phải bấm "Thêm mới" để mở biểu mẫu.
- Khả năng tương thích: đường dẫn, điểm cuối, quyền không đổi; không có quyền mới; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15f2`; không có tệp thay đổi cấu trúc dữ liệu; dòng cấu hình của 17 khóa lưới ở `user_grid_settings` để lại không ảnh hưởng (khóa lạ không còn được đọc).

### Phiên bản 0.80.1 – 2026-10-18

- Phạm vi thay đổi: 2.1 Hồ sơ lớp học, cột hiện mặc định và số dòng mỗi trang theo hệ thống của Sở (YCTD-117).
- Chức năng mới: không có.
- Lỗi đã sửa: lưới 2.1 hiện mặc định Lớp ghép, Ghép vào lớp, Lớp giải thể và ẩn Phân hiệu, Giáo viên chủ nhiệm, Điểm trường như Sở; 50 dòng mỗi trang khi người dùng chưa chọn số dòng; xuất Excel không chọn cột theo cột mặc định mới.
- Thay đổi dữ liệu: không có.
- Thay đổi API: `POST /classes/export` không gửi `columns` thì xuất 13 cột mặc định mới.
- Rủi ro: người dùng quen thấy tên giáo viên chủ nhiệm trên lưới phải bật lại cột.
- Khả năng tương thích: cấu hình cột, số dòng đã lưu của người dùng giữ nguyên; số dòng mặc định chung người dùng đã chọn vẫn được ưu tiên hơn 50; lưới khác không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh; không có thay đổi cơ sở dữ liệu.
### Phiên bản 0.80.0 – 2026-10-18

- Phạm vi thay đổi: DT-16 phần 16k, phân hệ Quản lý kí hồ sơ theo hệ thống của Sở, bản chạy nội bộ (YCTD-130). Phần cuối của DT-16.
- Chức năng mới: phân hệ "Quản lý kí hồ sơ" trên ô chọn phân hệ: "1.1. Chứng thư số nhà trường" (thông tin chứng thư, ảnh con dấu, Đăng ký kí nội bộ), "2.1. Đồng bộ chứng thư số" (Đánh dấu đã đồng bộ), "2.2. Kí hồ sơ trường, lớp, nhân sự, học sinh" (thẻ Trường, Lớp, Nhân sự, Học sinh, Sổ đầu bài; Tạo hồ sơ PDF, Kí xác nhận nội bộ, Tải thông tin thay đổi, Hủy hồ sơ, Xuất dữ liệu sổ đầu bài), "2.3. Xác nhận hoàn thành và gửi hồ sơ" (Xác nhận hoàn thành, Hủy xác nhận, Tải tệp gửi, Đánh dấu đã gửi) (P01-28 đến P01-31). Không có chữ ký số thật.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp hệ thống `0015_create_signing_tables` (bảng `signing_certificates`, `signing_dossiers`, `signing_events`, dãy số `signing_dossier_code`); tệp định danh `0049_add_signing_permissions` (bốn quyền P01, bỏ phân hệ mới khỏi nhóm Phụ huynh). Không có migration năm học.
- Thay đổi API: nhóm điểm cuối mới `/signing` (tài liệu 17 mục 5, mục 17); `buildPdf` của công cụ xuất dùng chung nhận thêm khổ dọc và phần cuối tài liệu.
- Kiểm thử: kịch bản CT-589 đến CT-598. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 848/848 ca đạt; toàn bộ kiểm thử giao diện 133/133 ca đạt (CI, lượt chạy 39121128162); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: tệp đã kí là xác nhận trên phần mềm, không có giá trị pháp lý của chữ ký số; nội dung hồ sơ PDF chưa đối chiếu mẫu của Sở; hồ sơ không truyền lên cấp trên, người dùng nộp tệp và đánh dấu.
- Khả năng tương thích: thêm phân hệ, không đổi chức năng cũ; nhóm người dùng tự tạo thấy phân hệ mới khi có quyền (phân hệ thêm sau mặc định hiện, YCTD-120).
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16k; chạy phần quay lui của tệp hệ thống `0015` (xóa ba bảng, dãy số) và tệp định danh `0049` (xóa quyền, dòng loại trừ phân hệ). Tệp PDF, ảnh con dấu ở kho tệp (tiền tố `signing-dossier/`, `signing-seal/`) xóa tay nếu cần.

### Phiên bản 0.79.0 – 2026-10-18

- Phạm vi thay đổi: DT-16 phần 16j, báo cáo số liệu EMIS theo hệ thống của Sở (YCTD-129).
- Chức năng mới: phân hệ "Báo cáo số liệu" đủ bảy biểu: 1.1 thêm thẻ nhập tay "Ngân sách nhà nước"; mục mới "1.2. Báo cáo cơ sở vật chất" (năm thẻ nhập tay, Lấy dữ liệu, Lấy dữ liệu năm trước), "1.3. Báo cáo sức khỏe học sinh đầu năm" (cột theo Sở), "2.1. Báo cáo EMIS cuối năm" (sáu mục I đến VI), "2.2. Báo cáo đội ngũ" (ba thẻ), "2.3. Đề án ngoại ngữ" (hai thẻ nhập tay, đánh dấu trường không có dữ liệu), "2.4. Báo cáo giáo dục mầm non cuối năm"; màn hình chung có Ghi, khóa khi đã đánh dấu đã gửi, Xuất Excel in tên đơn vị hành chính; danh sách gửi báo cáo bảy biểu kèm số đã gửi, số cần gửi, lần gửi cuối; nút "Xuất file lỗi" ở mỗi dòng biểu (P17-24 đến P17-28, sửa P17-18, P17-20, P17-22).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0059_create_emis_report_values` tạo bảng `emis_report_values`. Không có migration hệ thống, định danh.
- Thay đổi API: điểm cuối mới `GET /reports/emis/forms/{form}`, `PUT /reports/emis/forms/{form}/tabs/{tab}`, `POST /reports/emis/forms/{form}/tabs/{tab}/fill`, `POST /reports/emis/forms/{form}/export`, `POST /upper-level-submissions/{form}/error-file`; nhóm `/upper-level-submissions` nhận thêm mã sáu biểu mới; tệp gửi của 1.1 sáu trang.
- Kiểm thử: kịch bản CT-580 đến CT-588. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 832/832 ca đạt; toàn bộ kiểm thử giao diện 131/131 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: tên, mã số chỉ tiêu của bảy biểu do Claude đặt, chưa đối chiếu biểu mẫu chính thức của Sở; không truyền dữ liệu lên Bộ, Sở, người dùng phải gửi tệp và đánh dấu trạng thái; 2.1, 2.4 tính tại thời điểm xem.
- Khả năng tương thích: giữ `GET /reports/emis/start-of-year`, `POST /reports/emis/start-of-year/export`, `GET /reports/emis/start-of-year-health`; trạng thái gửi đã có của 1.1 giữ nguyên (cùng mã `emis-start-of-year`); tệp Excel 1.1 thêm trang thứ sáu ở cuối, năm trang đầu như cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16j; chạy phần quay lui của tệp năm học `0059` (xóa bảng `emis_report_values`). Dòng `upper_level_submissions` của sáu biểu mới không còn được đọc, xóa tay nếu cần.

### Phiên bản 0.78.0 – 2026-10-18

- Phạm vi thay đổi: DT-16 phần 16i, cơ sở vật chất và thiết bị dạy học đủ theo hệ thống của Sở (YCTD-128).
- Chức năng mới: mục "1.2. Báo cáo cơ sở vật chất" (số liệu phòng theo khối, loại phòng và hiện trạng; nhà vệ sinh; mức độ đạt chuẩn theo khối; Xuất Excel, Xuất PDF; gửi lên cấp trên chạy nội bộ); "6.1. Thực trạng và nhu cầu đầu tư phòng học, nhà công vụ" (lấy số liệu từ khai báo phòng, Ghi, Xuất Excel); "6.2. Nhập liệu cơ sở vật chất"; "2.2. Thiết bị ngoài danh mục tối thiểu" thành mục riêng; "2.3. Gửi thiết bị dạy học lên cấp trên" (Xuất tệp gửi, Đánh dấu đã gửi, Trường không có dữ liệu); nhập phòng và danh mục thiết bị từ Excel; thông tin nhà vệ sinh của phòng; gắn tài sản với thiết bị ở Kho.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0058_add_facilities_so_parity` tạo ba bảng `facility_investments`, `facility_standard_levels`, `facility_import_jobs`; bốn khóa nhà vệ sinh mới trong `rooms.facility_attributes` (jsonb, không đổi cấu trúc).
- Thay đổi API: điểm cuối mới `/facilities/report`, `/facilities/report/standard-levels`, `/facilities/report/export`, `/facilities/investments`, `/facilities/investments/export`, nhóm `/facility-imports`; hai biểu mẫu gửi lên cấp trên `facilities-report`, `equipment-summary`; `/rooms` nhận bốn thuộc tính nhà vệ sinh.
- Kiểm thử: kịch bản CT-572 đến CT-579. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 832/832 ca đạt; toàn bộ kiểm thử giao diện 130/130 ca đạt (CI, lượt chạy 39103041728; CT-15a-8 của `01-login.spec.ts` sửa theo nhóm menu mới "6. Cơ sở vật chất"); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: gửi lên cấp trên không truyền dữ liệu, người dùng phải nộp tệp và đánh dấu; mức độ đạt chuẩn, thuộc tính nhà vệ sinh do Claude chọn, chưa đối chiếu biểu mẫu chính thức.
- Khả năng tương thích: phòng cũ không có thuộc tính nhà vệ sinh vẫn hợp lệ; `/rooms` không gửi thuộc tính mới thì như cũ; 2.1 bỏ thẻ 2.2 nhưng dữ liệu, điểm cuối không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16i; chạy phần quay lui của tệp năm học `0058` (xóa ba bảng). Khóa nhà vệ sinh đã lưu trong `facility_attributes` khiến bản cũ từ chối khi sửa phòng đó, xóa tay các khóa này nếu quay lui.

### Phiên bản 0.77.0 – 2026-10-18

- Phạm vi thay đổi: DT-16 phần 16e, trường, lớp và lịch năm học theo hệ thống của Sở (YCTD-127).
- Chức năng mới: 1.4 khối "Cấu hình trường" (Tên trường hiển thị, Tên đơn vị hành chính, tính cân nặng/chiều cao cho trẻ suy dinh dưỡng thể nhẹ cân); mục "1.7. Rà soát thông tin kiểm định CLGD" (Lấy dữ liệu, Ghi); mục "1.8. Tách trường" bản chạy nội bộ (yêu cầu tách, xác nhận đi, đánh dấu đã tiếp nhận, xuất hồ sơ 82 cột, 75 cột theo mẫu CSDL ngành); 2.1 chọn nhiều lớp, Thay đổi hàng loạt, Giải thể lớp đã chọn, Xóa lớp; 2.2 bảy cột lớp theo Sở; 3.3 dòng giáo viên chưa phân công, lọc tình trạng phân công; mục "3.4. Khai báo tuần"; mục "5.7. Chuyển hồ sơ lên năm học mới" (Thực hiện, Hủy) (P01-24 đến P01-27, sửa P01-08, P01-13, P02-05).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0054_create_accreditation_reviews_and_school_splits` tạo ba bảng `accreditation_reviews`, `school_split_requests`, `school_split_items`; tệp hệ thống `0013_add_school_week_fields_and_carry_over_time` thêm `school_weeks.term_type`, `school_weeks.is_visible`, `academic_year_databases.carried_over_at`; bảng `settings` có thêm kiểu giá trị `text` và ba khóa của Trường chính, không đổi cấu trúc.
- Thay đổi API: điểm cuối mới `/academic-years/rollover/status`, `/academic-years/{id}/cancel-open`, `/classes/delete`, `/classes/bulk-update`, `/accreditation-review`, `/accreditation-review/collect`, nhóm `/school-splits`; `PUT /settings` nhận ba khóa mới; `/academic-years/{id}/weeks` thêm `term`, `term_type`, `is_visible`; `/class-assignments` lọc thêm `assignment`; nhập lớp thêm bảy cột; `/portal-context`, `/public/login-info` lấy tên trường hiển thị.
- Kiểm thử: kịch bản CT-551 đến CT-571. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 825/825 ca đạt; toàn bộ kiểm thử giao diện 129/129 ca đạt (CI, lượt chạy 39086989582); build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: Hủy chuyển hồ sơ xóa cơ sở dữ liệu năm học mới, không hoàn tác được (chỉ cho khi năm mới chưa phát sinh dữ liệu); tách trường không truyền dữ liệu, người dùng phải gửi tệp và đánh dấu trạng thái; phòng bộ môn, diện tích sàn ở 1.7 do Claude chọn cách tính, chưa đối chiếu biểu mẫu kiểm định.
- Khả năng tương thích: ô cân nặng/chiều cao cho trẻ nhẹ cân mặc định bật nên 4.3.2 tính như cũ; chưa đặt tên trường hiển thị thì vẫn dùng tên Trường chính; `PATCH /academic-years/{id}/weeks` không gửi `term_type`, `is_visible` thì giữ giá trị cũ; `GET /class-assignments` không gửi `assignment` vẫn trả dòng đã phân công như cũ, thêm dòng chưa phân công khi người gọi đọc được danh bạ; năm học mở trước phần 16e không có `carried_over_at` nên không hủy được.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16e; chạy phần quay lui của tệp năm học `0054` (xóa ba bảng) và tệp hệ thống `0013` (xóa ba cột). Ba khóa cấu hình đã lưu ở bảng `settings` không còn được đọc, xóa tay nếu cần.

### Phiên bản 0.76.0 – 2026-10-18

- Phạm vi thay đổi: DT-16 phần 16g, nhóm Học sinh của phân hệ Quản lý giáo dục Mầm non đủ theo hệ thống của Sở (YCTD-126).
- Chức năng mới: 4.1.1 có Thay đổi, Xóa hồ sơ nháp, Cấp mã định danh Bộ (ghi tay, xuất tệp 82 cột theo mẫu Bộ), Xuất file lỗi, sửa dân tộc, diện chính sách, khuyết tật, biết bơi; màn hình mới 4.1.2 Nhập học sinh từ Excel (mẫu 82 cột, kèm dữ liệu, tra cứu danh mục, đồng ý cập nhật), 4.1.3 Sắp xếp học sinh, 4.1.5 Điện thoại nhận tin của phụ huynh, 4.1.8 Thu thập, xác thực số định danh (nội bộ), 4.1.10 Tài khoản học và thi (nội bộ), 5.4 Mã định danh, mật khẩu mặc định, 5.5 Tiến độ xác thực số định danh học sinh; 4.1.11 nhập địa chỉ mới, sửa, xóa dòng đối chiếu, loại "Chuyển đến từ"; 4.2 chuyển lớp hàng loạt, chuyển đi, tiếp nhận chuyển đến (nội bộ).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0056_add_student_records_so` thêm `class_enrollments.order_number`, sáu cột của `children`, bảng `student_learning_accounts`, `student_transfers`, ba loại nhập mới của `data_import_jobs`.
- Thay đổi API: điểm cuối mới của xóa hồ sơ, mã Bộ, tệp theo mẫu Bộ, file lỗi, điện thoại nhận tin, chuyển lớp hàng loạt, thứ tự học sinh, số định danh, tài khoản học và thi, chuyển trường, công cụ nhập 82 cột, sửa, xóa dòng đối chiếu; `POST /imports/{id}/commit` nhận `confirm_update` (xem `17_DAC_TA_API.md`).
- Kiểm thử: kịch bản CT-534 đến CT-550. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã 810/810 ca đạt; toàn bộ kiểm thử giao diện 122/123 ca đạt (ca hỏng là CT-15a-7 của `01-login.spec.ts`: trang đăng nhập chưa hiện kịp ở đầu lượt chạy, không liên quan phần này, đạt ở các lần chạy trước và sau; ở lần chạy khác hỏng `04-accounts` do tài khoản còn lại trong cơ sở dữ liệu định danh của lần chạy trước và CT-16a-10 do tiến trình xuất nền nhận tác vụ sớm, cũng không liên quan).
- Rủi ro: chưa có kết nối thật tới CSDL Bộ, CSDLQG về dân cư, trường khác; tài khoản học và thi chưa dùng đăng nhập được; tệp CSDL ngành cập nhật học sinh đã có cần đánh dấu đồng ý nên cách nhập cũ qua giao diện lập trình phải gửi `confirm_update`.
- Khả năng tương thích: cột mới mặc định null nên hồ sơ đã có không đổi nghĩa; hồ sơ chưa sắp xếp theo A–Z như trước; trang nhập dữ liệu chung chỉ còn công nợ đầu kỳ.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16g; chạy phần quay lui của tệp `0056` (xóa lần nhập ba loại mới, trả ràng buộc loại nhập, xóa hai bảng và các cột mới).

### Phiên bản 0.75.0 – 2026-10-17

- Phạm vi thay đổi: DT-16 phần 16h, sức khỏe, dinh dưỡng và thống kê học sinh theo hệ thống của Sở (YCTD-125).
- Chức năng mới: mục "4.6.1. Nhập thông tin sức khỏe học sinh" theo học kỳ (cân nặng, chiều cao, giáo dục thể chất, biết bơi, bảy loại bệnh về mắt, "Lấy dữ liệu từ 4.3", Xuất Excel); 4.3.2 tổng hợp theo học kỳ, so sánh hai lần cân đo, cột "Được khám định kỳ"; 4.5 thực đơn có tên, tháng, tuần, từ ngày, đến ngày, nhiều khối áp dụng, nút "Thay đổi" cho thực đơn nháp, nhập thực đơn từ Excel bằng công cụ nhập chung; mục "5.3. Thống kê học sinh" sáu thẻ, Xuất Excel, Xuất PDF; số liệu báo cáo sức khỏe học sinh đầu năm (dòng 1.3) cho phần 16j (P10-15, P12-10, P17-21, P17-22).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0057_add_student_health_and_menu_fields` thêm sáu cột của `menus` (`name`, `month`, `week_no`, `from_date`, `to_date`, `grade_levels`; thực đơn cũ lấy giá trị từ tuần bắt đầu và độ tuổi) kèm hai ràng buộc kiểm tra, tạo hai bảng `menu_import_jobs`, `student_health_records`.
- Thay đổi API: điểm cuối mới `/student-health`, `/student-health/pull-growth`, `/student-health/export`, `/statistics/students`, `/statistics/students/export`, `/reports/emis/start-of-year-health`, `PUT /menus/{id}`, nhóm `/menu-imports`; `POST /menus` nhận thêm thông tin chung theo Sở; `GET /menus` lọc thêm `month`; `/reports/growth` nhận thêm `term`, `compare_round_id`, trả thêm `comparison` và số được khám định kỳ.
- Kiểm thử: kịch bản CT-524 đến CT-533. Kết quả ngày 18/10/2026: kiểm thử đơn vị toàn bộ kho mã (`pnpm -r test`) 787/787 ca đạt; toàn bộ kiểm thử giao diện 115/115 ca đạt; build, kiểm tra kiểu, lint, kiểm tra định dạng đạt.
- Rủi ro: chỉ tiêu của báo cáo sức khỏe đầu năm do Claude đặt, chưa đối chiếu biểu mẫu chính thức của Sở; con thương binh, liệt sĩ nhận biết theo chữ trong đối tượng chính sách nên có thể sót khi hồ sơ ghi cách khác.
- Khả năng tương thích: `POST /menus` vẫn nhận `week_start_date`, `age_group`; cột `age_group` giữ làm khóa không trùng; thực đơn chung và thực đơn riêng của khối cùng tuần vẫn cùng tồn tại được; `GET /statistics/children` không đổi; Y tế học đường, Thuốc và dặn thuốc đổi số mục thành 4.6.2, 4.6.3, đường dẫn giữ nguyên.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16h; chạy phần quay lui của tệp `0057` (xóa `student_health_records`, `menu_import_jobs`, hai ràng buộc và sáu cột mới của `menus`). Thực đơn lập sau khi gộp vẫn dùng được vì `week_start_date`, `age_group` vẫn được ghi.

### Phiên bản 0.74.0 – 2026-10-17

- Phạm vi thay đổi: DT-16 phần 16f, nhóm Nhân sự của phân hệ Quản lý giáo dục Mầm non đủ theo hệ thống của Sở (YCTD-124).
- Chức năng mới: 3.1.1 có Thay đổi, Xóa hồ sơ nhập nhầm, Xuất tệp theo mẫu Bộ (75 cột kèm kiểm tra dữ liệu), Xuất file lỗi, lọc xã ĐBKK và trạng thái xác thực số định danh; hồ sơ có danh mục của Bộ, tài khoản ngân hàng, mã số thuế, xã ĐBKK; 3.1.2 Nhân sự phân hiệu; 3.1.3 Nhập nhân sự từ Excel (mẫu 75 cột kèm dữ liệu, tra cứu danh mục); 3.1.5 Xác thực số định danh nhân sự (bản chạy nội bộ: Đánh dấu đã xác thực, Đánh dấu sai thông tin); 3.2 Nhập mức đánh giá từ Excel; 3.5 Biến động nhân sự (tiếp nhận chuyển đến, duyệt chuyển đi, đi thỉnh giảng, đến thỉnh giảng, bản chạy nội bộ); 5.2 Thống kê nhân sự theo danh mục Bộ và chuẩn nghề nghiệp; 5.6 Tiến độ xác thực số định danh nhân sự; 5.9 thêm tài khoản ngân hàng, mã số thuế (P07-06 đến P07-10).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp năm học `0055_add_staff_so_parity` thêm chín cột của `staff` (tài khoản ngân hàng, tên ngân hàng, mã số thuế, xã ĐBKK, trạng thái xác thực số định danh kèm ngày, người, ghi chú), tạo hai bảng `staff_branch_assignments`, `staff_movements`, cho `data_import_jobs.import_type` nhận thêm `professional_ratings`. Không đổi cơ sở dữ liệu định danh, hệ thống.
- Thay đổi API: điểm cuối mới `/staff/delete`, `/staff/ministry-export`, `/staff/ministry-errors`, `/staff/ministry-template`, `/staff/ministry-catalogs`, `/staff-branches` (bốn điểm cuối), `/staff-identity` (bốn điểm cuối), `/staff-movements` (chín điểm cuối), `/statistics/staff-so`; `/staff/search`, `/staff/export` thêm bộ lọc, cột; `PATCH /staff/{id}/profile` nhận bốn trường mới; `/imports` nhận loại `professional_ratings`; `/statistics/missing-staff-fields` thêm hai trường.
- Kiểm thử: kịch bản CT-510 đến CT-523. Kết quả ngày 17/10/2026: 10 ca kiểm thử đơn vị và 4 ca kiểm thử giao diện của phần 16f đạt; kiểm thử đơn vị toàn bộ kho mã 788/788 ca đạt; toàn bộ kiểm thử giao diện 118/118 ca đạt.
- Rủi ro: danh mục của Bộ do Claude tổng hợp, có thể lệch danh mục chính thức; duyệt chuyển đi cho nhân sự nghỉ việc, chấm dứt hợp đồng và khóa tài khoản, duyệt nhầm phải lập lại hồ sơ, hợp đồng bằng tay; tệp theo mẫu Bộ có số định danh đủ 12 chữ số nên chỉ người có quyền xuất dữ liệu tải được và mỗi lần tải ghi nhật ký xuất.
- Khả năng tương thích: các cột mới có giá trị mặc định (xã ĐBKK sai, chưa xác thực) nên hồ sơ đã có không đổi nghĩa; giá trị chữ tự do cũ của các ô nay theo danh mục vẫn giữ và hiện "(giá trị cũ, ngoài danh mục)"; phần nhập nhân sự rời khỏi 4.1.2 sang 3.1.3; 5.9 thêm hai trường; không đổi điểm cuối cũ ngoài các điểm đã nêu.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16f; chạy phần quay lui của tệp `0055` (xóa lần nhập `professional_ratings`, trả ràng buộc loại nhập, xóa hai bảng, xóa chín cột của `staff`).

### Phiên bản 0.73.0 – 2026-10-17

- Phạm vi thay đổi: DT-16 phần 16c, khung trang và đăng nhập cổng quản trị theo hệ thống của Sở (YCTD-123).
- Chức năng mới: thanh đầu trang có tên trường, ô "Cấp MN · năm học · học kỳ", lưới ứng dụng liên kết; menu người dùng đủ bảy mục (thêm Hồ sơ nhân sự cá nhân, Hướng dẫn); hộp "Thông báo" khi vào trang (thông báo hệ thống, mật khẩu sắp hết hạn, nhắc mã định danh điện tử của tổ chức theo NĐ 69); trang đăng nhập có tên, mã trường, ghi nhớ tài khoản, mã xác nhận dạng ảnh, liên kết Quên mật khẩu, đường dây nóng; trang Quên mật khẩu gửi mã qua tin nhắn; lịch sử mật khẩu; Quản trị hệ thống thêm 3.6 Thông báo hệ thống, 3.7 Ứng dụng liên kết; 1.4 Cấu hình trường thêm khối "Đăng nhập và bảo mật" (P01-21 đến P01-23).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp định danh `0045_add_password_history_and_announcement_permission` tạo bảng `password_history`, cho `one_time_codes.purpose` nhận thêm `password_reset`, thêm quyền `P01.announcement.manage` và gán cho VT-01, VT-02; tệp hệ thống `0011_create_announcements_and_app_links` tạo hai bảng `system_announcements`, `portal_app_links`; `identity_settings` có thêm bốn khóa cấu hình đăng nhập.
- Thay đổi API: điểm cuối mới của dịch vụ định danh `/auth/login-options`, `/auth/captcha`, `/auth/password-reset/request`, `/auth/password-reset/confirm`; `login` kênh cổng quản trị nhận `captcha_id`, `captcha_text`; `/auth/settings` thêm bốn cấu hình. Điểm cuối mới của máy chủ API `/system-announcements`, `/system-announcements/{id}`, `/system-announcements/active`, `/app-links`, `/portal-context`, `/public/login-info`, `/staff/me/contact`; `PUT /school-profile` kiểm tra mã định danh điện tử 12 chữ số.
- Kiểm thử: kịch bản CT-489 đến CT-509. Kết quả ngày 17/10/2026: kiểm thử đơn vị toàn bộ kho mã 778/778 ca đạt; toàn bộ kiểm thử giao diện 114/114 ca đạt.
- Rủi ro: ảnh mã xác nhận tự sinh ở mức cơ bản, không bằng dịch vụ chuyên dụng; quên mật khẩu phụ thuộc kênh tin nhắn, chưa có thư điện tử; ghi thẻ thông tin chung của hồ sơ trường cần mã định danh điện tử đúng 12 chữ số hoặc để trống.
- Khả năng tương thích: đăng nhập cổng quản trị đòi mã xác nhận từ lần thứ tư sau ba lần sai (mặc định), ứng dụng giáo viên, phụ huynh không đổi; mã một lần của phụ huynh chỉ đọc mã mục đích đăng nhập; menu người dùng thêm hai mục; không đổi điểm cuối cũ ngoài các điểm đã nêu. Tệp `0045`, `0011` có số nhỏ hơn tệp đã gộp trước (`0046`, `0016`) nhưng vẫn chạy vì công cụ chạy tệp thay đổi cấu trúc cho chạy lệch thứ tự.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16c; chạy phần quay lui của tệp `0011` (xóa hai bảng) và `0045` (gỡ quyền, xóa mã đặt lại mật khẩu, trả ràng buộc mục đích về `login`, xóa bảng `password_history`); bốn khóa cấu hình đăng nhập ở `identity_settings` không còn được đọc, xóa thủ công nếu cần.

### Phiên bản 0.72.0 – 2026-10-17

- Phạm vi thay đổi: DT-15 phần 15h2, sửa các hạn chế của văn thư lưu trữ (YCTD-122).
- Chức năng mới: phông, hồ sơ chia theo đơn vị và lọc theo phạm vi đơn vị; người giải quyết chọn từ nhân sự; nhắc sắp đến hạn, quá hạn trong ứng dụng; nhãn và bộ lọc "Sắp đến hạn"; hàng chờ xóa lại tệp ở kho tệp (P09-06 đến P09-08).
- Lỗi đã sửa: tệp đính kèm có thể còn ở kho tệp khi kho lỗi lúc xóa.
- Thay đổi dữ liệu: tệp hệ thống `0016_add_archive_units_handlers_reminders` thêm cột `org_unit_id` (phông, hồ sơ), `handler_staff_id`, `due_reminded_at`, `overdue_reminded_at` (hồ sơ), bảng `archive_file_deletions`.
- Thay đổi API: điểm cuối mới `GET /archive-handlers`; trường và bộ lọc mới `org_unit_id`, `handler_staff_id`, `due_soon`.
- Rủi ro: người chỉ có vai trò theo đơn vị không còn thấy dữ liệu văn thư toàn trường đã nhập trước.
- Khả năng tương thích: dữ liệu cũ có đơn vị trống (toàn trường), tên người giải quyết giữ nguyên; điểm cuối cũ giữ đường dẫn và nhận thêm trường không bắt buộc.
- Phương án quay lui: hoàn lại commit gộp; chạy phần quay lui của tệp `0016` (xóa cột và bảng mới).

### Phiên bản 0.71.0 – 2026-10-17

- Phạm vi thay đổi: DT-16 phần 16a, công cụ xuất, nhập dùng chung và mẫu gửi lên cấp trên chạy nội bộ theo hệ thống của Sở (YCTD-121).
- Chức năng mới: nút "Xuất PDF" của lưới dữ liệu dùng chung (bật ở 4.1.1, 4.1.9, 2.1, 3.3, 3.1.1); tác vụ xuất nền cho danh sách lớn và màn hình "3.5. Tệp đã tạo"; thành phần nhập Excel dùng chung với tải file mẫu kèm dữ liệu, tra cứu danh mục, chọn cột để nhập, xuất file lỗi (MH-40, MH-92); nhập lớp học cập nhật lớp đã có; khối "Gửi lên cấp trên" ở 1.1 Báo cáo EMIS đầu năm với Xuất tệp gửi, Đánh dấu đã gửi, Gửi yêu cầu mở khóa, Mở khóa, Đặt trạng thái gửi lại (P01-20, P17-19, P17-20).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp hệ thống `0010_create_export_jobs_and_submissions` tạo ba bảng `export_jobs`, `upper_level_submissions`, `upper_level_submission_events`. Không thêm quyền.
- Thay đổi API: điểm cuối mới `/export-jobs`, `/export-jobs/{id}/file`, `/imports/templates/{type}/columns`, `/imports/catalogs/{type}`, `/imports/{id}/error-file`, `/upper-level-submissions` và các thao tác theo biểu mẫu; điểm cuối xuất của năm danh sách nhận `format`, hai danh sách trả 202 kèm tác vụ khi lớn.
- Rủi ro: tiến trình xuất nền chạy trong máy chủ API nên tệp rất lớn dùng bộ nhớ của máy chủ API; nhập lớp học nay cập nhật lớp đã có (trước báo trùng) nên tệp cũ nhập lại sẽ ghi đè tên, sĩ số, phòng của lớp.
- Khả năng tương thích: điểm cuối cũ nhận thêm trường tùy chọn, không gửi thì như trước, trừ trả 202 thay cho 422 khi danh sách vượt 10 000 dòng; màn hình không bật Xuất PDF không đổi; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16a; chạy phần quay lui của tệp `0010` (xóa ba bảng); tệp ở kho tệp dưới khóa `export/`, `submission/` xóa thủ công nếu cần.
### Phiên bản 0.70.0 – 2026-10-17

- Phạm vi thay đổi: DT-16 phần 16d, quản trị hệ thống đủ theo hệ thống của Sở (YCTD-120).
- Chức năng mới: 1.1 Nhóm người dùng có Hiệu lực, Sửa, Xóa; màn hình 1.2 Phân quyền nhóm theo phần mềm (phân hệ nhóm được dùng, ẩn phân hệ khỏi ô chọn phân hệ và menu); 1.4 Danh sách người dùng có Mã nhân sự, Mã Bộ, Ngày hết hạn mật khẩu, lọc Mã định danh, ngày hết hạn mật khẩu, Phân nhóm quyền, Cấp mật khẩu hàng loạt, Lấy danh sách CBQL/GV, Xuất Excel; màn hình 1.6 Tài khoản đồng bộ của Bộ, của Sở (lưu mã hóa, bản chạy nội bộ).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp định danh `0046_add_role_status_and_workspaces` thêm `roles.is_active`, bảng `role_workspace_exclusions`; tệp hệ thống `0012_add_sync_account_credentials` thêm hai loại kết nối và hai cột của `integration_credentials`.
- Thay đổi API: dịch vụ định danh thêm `PATCH, DELETE /roles/{id}`, `PUT /roles/{id}/workspaces`, `POST /users/bulk-reset-password`, `POST /users/bulk-roles`, tham số mới của `GET /users`, trường `workspaces` ở `/auth/me`; máy chủ API thêm `/account-directory`, `/account-directory/export`, `/account-directory/staff-without-account`, `/account-directory/staff-accounts`, `/sync-accounts`.
- Rủi ro: ngừng hiệu lực một nhóm đang dùng làm người dùng mất quyền ngay; thao tác hàng loạt không gộp một giao dịch.
- Khả năng tương thích: điểm cuối cũ giữ nguyên dạng trả về, chỉ thêm trường; không có mã quyền mới; nhóm cũ giữ đủ phân hệ trừ Phụ huynh; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16d; chạy phần quay lui của tệp định danh `0046` (bỏ cột, bảng) và tệp hệ thống `0012` (xóa hai loại tài khoản đồng bộ, bỏ hai cột).
### Phiên bản 0.69.0 – 2026-10-16

- Phạm vi thay đổi: DT-16 phần 16b, lưới dữ liệu chung, hộp xác nhận xóa, Xuất Excel cho các màn hình còn lại theo hệ thống của Sở (YCTD-119).
- Chức năng mới: lưới dữ liệu chung (tìm kiếm, Mở rộng tìm kiếm, cấu hình cột, số dòng mỗi trang theo người dùng, tiêu đề theo menu) cho 1.1 Khai báo cơ sở vật chất, 2.1 Tổng hợp thiết bị dạy học, 4.3.2 Tổng hợp cân nặng, chiều cao, 5.8 Thống kê hồ sơ chưa nhập đủ, 4.4 Hoàn thành chương trình, 4.1.6 Nhóm học sinh (bỏ nhiều học sinh khỏi nhóm), 3.2 Đánh giá chuẩn nghề nghiệp (lọc Loại chuẩn, Trạng thái), 4.5 Thực đơn bữa ăn, 4.6.1 Y tế học đường, 4.6.2 Thuốc và dặn thuốc, 2.1 Năm học, 2.2 Cây đơn vị (danh sách phẳng), 2.3 Phòng ban và chức danh, 2.4 Danh mục dùng chung, 2.5 Phòng học và bậc học, 3.2 Kết nối ngoài; hộp xác nhận xóa cho bỏ học sinh khỏi nhóm, bỏ món, bỏ nguyên liệu, xóa tiêu chuẩn sức khỏe, bỏ liên kết Zalo; Xuất Excel theo cột đang hiện cho 1.2 Quản lý phân hiệu, 1.3 Quản lý điểm trường, 4.1.11 Cập nhật địa danh hành chính, 1.1 Nhóm người dùng (BR-117); Xuất Excel 1.4 dùng điểm cuối của phần 16d.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: không có tệp thay đổi cấu trúc dữ liệu; 38 khóa lưới mới trong `DATA_GRID_KEYS` dùng cho `user_grid_settings`; các lần xuất mới ghi `export_logs`, phân hiệu, điểm trường, nhóm người dùng ghi không có dữ liệu cá nhân.
- Thay đổi API: điểm cuối mới `POST /org-units/export`, `POST /administrative-units/addresses/export`, `POST /account-exports/roles`; `/me/grid-settings/{gridKey}` nhận thêm 38 khóa lưới.
- Rủi ro: ô tìm kiếm của các lưới mới chỉ tìm trên dữ liệu đã tải.
- Khả năng tương thích: không đổi bảng, quyền, điểm cuối cũ; điểm cuối của dịch vụ định danh không đổi; cấu hình lưới đã lưu của các lưới cũ giữ nguyên; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 16b; không có phần quay lui cơ sở dữ liệu; dòng `user_grid_settings` của 38 khóa mới không còn được đọc, xóa nếu cần.

### Phiên bản 0.68.0 – 2026-10-16

- Phạm vi thay đổi: DT-15 phần 15h2, văn thư lưu trữ theo hệ thống của Sở (YCTD-118).
- Chức năng mới: nhóm menu "5.10. Văn thư lưu trữ" của phân hệ Quản lý giáo dục Mầm non với bốn màn hình: 5.10.1 Hồ sơ tài liệu (hai thẻ Chưa hoàn thành, Hoàn thành; người giải quyết, thời hạn, nhãn Quá hạn; tệp đính kèm ở kho tệp; Xuất Excel), 5.10.2 Phông lưu trữ, 5.10.3 Thông tin lưu trữ (phông, giai đoạn, chỉnh lý, hết giá trị, thời hạn bảo quản, số bó, số hộp, số mét giá, nơi bảo quản), 5.10.4 Báo cáo lưu trữ cộng theo phông, giai đoạn có Xuất Excel (P09-06 đến P09-08).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp hệ thống `0009_create_archive_tables` tạo bốn bảng `archive_fonds`, `archive_holdings`, `archive_records`, `archive_record_files`; tệp định danh `0044_add_archive_permissions` thêm ba quyền `P09.archive.view`, `P09.archive.manage`, `P09.archive.export` và gán cho VT-02, VT-04, VT-06 (đủ ba), VT-15 (xem, xuất), VT-03 (xem).
- Thay đổi API: điểm cuối mới `/archive-fonds`, `/archive-holdings`, `/archive-report`, `/archive-report/export`, `/archive-records`, `/archive-records/export`, `/archive-records/{id}`, `/archive-records/{id}/files`, `/archive-records/{id}/files/{fileId}`.
- Rủi ro: người giải quyết là chữ tự do; xóa tệp ở kho tệp sau khi xóa dòng nên lỗi kho tệp có thể để lại tệp mồ côi.
- Khả năng tương thích: không đổi bảng, điểm cuối, màn hình cũ; kho tệp thêm thao tác xóa tệp; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh phần 15h2; chạy phần quay lui của tệp `0009` (xóa bốn bảng) và `0044` (gỡ ba quyền); tệp đính kèm đã tải lên nằm dưới khóa `archive-records/` của kho tệp, xóa thủ công nếu cần.

### Phiên bản 0.66.0 – 2026-10-15

- Phạm vi thay đổi: DT-15 phần 15h1, cập nhật địa danh hành chính theo hệ thống của Sở (YCTD-116).
- Chức năng mới: màn hình "4.1.11. Cập nhật địa danh hành chính": lưới địa chỉ của học sinh còn theo địa danh trước sắp xếp năm 2025 ở năm loại địa chỉ của tệp CSDL ngành, địa danh mới đề xuất theo bảng đối chiếu, chọn xã mới khi xã cũ chia cho nhiều xã, chuyển hàng loạt có ghi nhật ký trước và sau; bảng đối chiếu địa danh gieo sẵn Thành phố Hồ Chí Minh theo Nghị quyết 1685/NQ-UBTVQH15 và mã số của Cục Thống kê, nhập thêm từ Excel.
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: tệp `0008_create_administrative_units` của cơ sở dữ liệu hệ thống tạo `administrative_units`, `administrative_unit_mappings` và gieo 651 đơn vị, 493 dòng đối chiếu.
- Thay đổi API: điểm cuối mới `GET /administrative-units/addresses`, `POST /administrative-units/addresses/convert`, `GET /administrative-units/mappings`, `GET /administrative-units/mappings/template`, `POST /administrative-units/mappings/import`.
- Rủi ro: danh mục chỉ có Thành phố Hồ Chí Minh; mã mới lấy từ danh mục của Cục Thống kê, chưa đọc trực tiếp phụ lục Quyết định 19/2025/QĐ-TTg; nhập lại tệp CSDL ngành ghi đè địa chỉ đã chuyển.
- Khả năng tương thích: không đổi điểm cuối, màn hình đã có; không có quyền mới; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15h1`; phần quay lui của tệp 0008 xóa hai bảng; địa chỉ đã chuyển giữ nguyên, xem giá trị cũ ở nhật ký thao tác.

### Phiên bản 0.65.0 – 2026-10-15

- Phạm vi thay đổi: DT-15 phần 15d, nhân sự theo hệ thống của Sở (YCTD-112).
- Chức năng mới: màn hình hồ sơ nhân sự đổi tên "3.1.1. Hồ sơ cán bộ, giáo viên" với lưới theo cột của Sở (Mã định danh Bộ GD&ĐT, Mã nhân sự, Họ tên, Ngày sinh, Giới tính, Trạng thái, Dân tộc, Điện thoại, Vị trí việc làm, Nhóm chức vụ, Hình thức hợp đồng, Trình độ chuyên môn), phân trang ở máy chủ, xếp A–Z theo tên; Mở rộng tìm kiếm theo đơn vị, phòng ban, trạng thái, giới tính, vị trí việc làm, Đảng viên, tuổi từ–đến, mã định danh Bộ, số định danh (gộp mục 3.1.4 của Sở); Xuất Excel theo cột đang hiện; hồ sơ hai thẻ "Hồ sơ cán bộ, giáo viên" (bảy khối theo thứ tự cột của tệp CSDL ngành, nút Ghi) và "Thông tin riêng của trường" (thông tin của trường, tài khoản, hợp đồng, lương và phụ cấp, quá trình công tác); biểu mẫu Thêm mới theo khối (P07).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: không có bảng, cột mới; các ô của Sở ghi vào `staff.moet_profile` (đã có từ tệp 0046) theo khóa của tệp CSDL ngành.
- Thay đổi API: điểm cuối mới `GET /staff/search`, `POST /staff/export`, `PATCH /staff/{id}/profile`; `GET /staff/{id}` trả thêm `moet_fields`; `GET /staff` giữ nguyên.
- Rủi ro: ô theo Sở là chữ tự do, chưa có danh mục của Bộ; nhập lại tệp CSDL ngành ghi đè các ô đã sửa ở biểu mẫu; lọc số định danh giải mã các hồ sơ cùng bốn số cuối trong phạm vi.
- Khả năng tương thích: đường dẫn `/staff`, `GET /staff`, `POST /staff`, `PUT /staff/{id}` không đổi; cấu hình cột đã lưu của lưới `staff` bỏ qua mã cột không còn dùng; không có quyền mới; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15d`; không có tệp thay đổi cấu trúc dữ liệu cần quay lui, các khóa đã ghi vào `moet_profile` vẫn đọc được ở khối "Thông tin theo CSDL ngành".

### Phiên bản 0.64.0 – 2026-10-15

- Phạm vi thay đổi: DT-15 phần 15b, trường học, lớp học theo hệ thống của Sở (YCTD-111).
- Chức năng mới: mục "1.2. Quản lý phân hiệu" (`/branches`), "1.3. Quản lý điểm trường" (`/school-sites`) với lưới theo cột của Sở (Mã, Tên, Địa chỉ, Khoảng cách đến cơ sở chính, Diện tích, Điện thoại, Trạng thái), Thêm mới, Sửa theo biểu mẫu khối, Ngừng sử dụng, Dùng lại; "2.1. Hồ sơ lớp học" chuyển sang lưới dữ liệu chung với cột, Mở rộng tìm kiếm, Xuất Excel theo Sở và biểu mẫu theo khối có nhóm tuổi, thứ tự, học 2 buổi/ngày, lớp mẫu giáo ghép 2 hoặc 3 độ tuổi, lớp ghép, lớp bán trú; "2.2. Nhập lớp học từ Excel" (`/class-imports`) tách khỏi màn hình Nhập dữ liệu; "3.3. Phân công phụ trách lớp" (`/class-assignments`) liệt kê, phân công, kết thúc phân công, xuất Excel; tiêu đề 1.1, 1.4 kèm số menu (P01, P02).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: cột `org_units.distance_km`, `org_units.area_m2` và `classes.age_group`, `sort_order`, `two_sessions_per_day`, `mixed_age_count`, `is_combined`, `combined_into_class_id`, `boarding` cùng ràng buộc `classes_combined_check` ở cơ sở dữ liệu năm học (tệp `database/school-year/migrations/0051_add_so_school_and_class_fields.ts`); ba cột boolean mặc định false.
- Thay đổi API: `GET`, `POST`, `PATCH /org-units` thêm `distance_km`, `area_m2`; `GET /classes` thêm bộ lọc `q`, `stage`, `age_group`, `two_sessions_per_day`, `boarding`, `is_combined` và các cột mới, thứ tự theo `sort_order` rồi mã lớp; `POST`, `PATCH /classes` nhận các ô mới; điểm cuối mới `POST /classes/export`, `GET /class-assignments`, `POST /class-assignments/export`; `DATA_GRID_KEYS` thêm `branches`, `school-sites`, `classes`, `class-assignments`.
- Rủi ro: danh sách lớp và phân công phụ trách lớp tải cả danh sách trong phạm vi rồi phân trang ở trình duyệt; nhóm tuổi chọn riêng ở lớp chưa dùng cho thống kê nên thống kê theo bậc học có thể khác cột Nhóm tuổi; mẫu nhập lớp học chưa có các ô mới.
- Khả năng tương thích: lớp đã có không có thứ tự nên vẫn xếp theo mã lớp; nhóm tuổi trống là theo bậc học như trước; đường dẫn `/classes`, `/org-units`, `/imports` không đổi, nhập lớp học chuyển sang `/class-imports`; không có quyền mới; ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15b`; chạy phần quay lui của tệp 0051 của cơ sở dữ liệu năm học (gỡ hai cột của `org_units` và bảy cột của `classes`, mất khoảng cách, diện tích và thông tin lớp theo Sở đã nhập).

### Phiên bản 0.63.0 – 2026-10-15

- Phạm vi thay đổi: DT-15 phần 15g, gửi phản hồi và hết hạn mật khẩu theo hệ thống của Sở (YCTD-110).
- Chức năng mới: nút "Gửi phản hồi" ở chân mọi trang của cổng quản trị mở hộp thoại gửi ý kiến (Đường dẫn trang, Loại ý kiến, Tiêu đề, Nội dung, Số điện thoại, Thư điện tử, Ảnh chụp màn hình), tối đa 10 ý kiến mỗi giờ mỗi tài khoản; mục "Danh sách ý kiến đã gửi" ở menu người dùng (`/my-feedback`); mục "3.4. Ý kiến phản hồi" của Quản trị hệ thống (`/feedback`) cho VT-01, VT-02 xem mọi ý kiến, đổi trạng thái (Mới, Đang xử lý, Đã xử lý), trả lời, người gửi nhận thông báo trong ứng dụng; chính sách hết hạn mật khẩu (số ngày hết hạn, số ngày báo trước) ở khối "Chính sách mật khẩu" của "1.4. Danh sách người dùng", mật khẩu quá hạn thì bắt buộc đổi ở màn hình Đổi mật khẩu, sắp hết hạn thì đầu trang báo số ngày còn lại; cột ẩn "Thời gian đổi mật khẩu" ở danh sách người dùng (P01, P19).
- Lỗi đã sửa: không có.
- Thay đổi dữ liệu: bảng mới `feedback` ở cơ sở dữ liệu hệ thống (tệp `database/system/migrations/0007_create_feedback.ts`); cột `users.password_changed_at` (tài khoản đã có lấy thời điểm cập nhật gần nhất, không có thì thời điểm tạo) và quyền `P01.feedback.manage` gán VT-01, VT-02 ở cơ sở dữ liệu định danh (tệp `database/identity/migrations/0042_add_password_expiry_and_feedback_permission.ts`); khóa `password_max_age_days` (mặc định 0), `password_expiry_warning_days` (mặc định 7) ở `identity_settings`.
- Thay đổi API: điểm cuối mới `POST /user-feedback`, `GET /me/user-feedback`, `GET /user-feedback`, `PUT /user-feedback/{id}`, `GET /user-feedback/{id}/attachment`, `GET`, `PUT /auth/settings/password-policy`; `login`, `refresh`, `change-password` trả thêm `password_expired`, `password_expires_in_days`; `GET /users` trả thêm `password_changed_at`; `DATA_GRID_KEYS` thêm `my-feedback`, `feedback`.
- Rủi ro: bật chính sách hết hạn lần đầu thì tài khoản đã có tính hạn từ thời điểm cập nhật gần nhất, nhiều tài khoản có thể phải đổi mật khẩu ngay; thông báo trả lời ý kiến cần năm học đang dùng; hai màn hình ý kiến phân trang ở trình duyệt nên chậm khi số ý kiến rất lớn.
- Khả năng tương thích: chính sách hết hạn mặc định tắt (0 ngày) nên đăng nhập như cũ cho tới khi người quản trị đặt số ngày; tài khoản chỉ có vai trò Phụ huynh, tài khoản còn dùng mật khẩu mặc định chung và phiên đăng nhập bằng mã một lần không bị hết hạn mật khẩu; ứng dụng giáo viên dùng cờ `password_change_required` có sẵn nên vẫn bắt đổi mật khẩu; VT-01 có thêm quyền `P01.feedback.manage` (PQ-10); góp ý của phụ huynh ở phân hệ Tương tác (`/feedbacks`) không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15g`; chạy phần quay lui của tệp 0042 của cơ sở dữ liệu định danh (gỡ quyền `P01.feedback.manage` và cột `password_changed_at`; dòng chính sách đã lưu ở `identity_settings` còn lại nhưng không được đọc) và tệp 0007 của cơ sở dữ liệu hệ thống (gỡ bảng `feedback`, mất các ý kiến đã gửi; ảnh đính kèm còn ở kho tệp).

### Phiên bản 0.62.0 – 2026-10-15

- Phạm vi thay đổi: DT-15 phần 15e, quản trị hệ thống theo hệ thống của Sở: nhóm người dùng, phân quyền nhóm theo menu, danh sách người dùng (YCTD-109).
- Chức năng mới: "1.1. Nhóm người dùng" trên lưới dữ liệu chung (Mã nhóm, Tên nhóm, Hiệu lực, Là nhóm quản trị, Là nhóm hệ thống), biểu mẫu thêm nhóm theo khối, nút Phân quyền trên dòng; mục mới "1.3. Phân quyền nhóm theo menu" (`/role-permissions`): chọn quyền theo cây menu đánh số, chọn cả mục hoặc từng quyền, khối Quyền khác; "1.4. Danh sách người dùng" với cột và bộ lọc theo Sở (nhóm quyền, loại tài khoản, trạng thái đổi mật khẩu, tên đăng nhập, tên nhân sự); Khóa API cho đối tác và Nhật ký thao tác dùng lưới dữ liệu chung; tiêu đề các màn hình quản trị kèm số menu; điều kiện hiện mục menu chuyển sang gói dùng chung `packages/shared/src/menu-permissions.ts` (P01, P19).
- Lỗi đã sửa: danh sách người dùng chậm khi có khoảng 30 nghìn tài khoản (dịch vụ định danh đọc mọi tài khoản cùng vai trò, quyền rồi mới cắt trang); nay lọc, đếm, phân trang trong câu truy vấn, một trang 50 dòng dưới 1,5 giây trên máy phát triển.
- Thay đổi dữ liệu: hai chỉ mục `users_full_name_id_index` (`users (full_name, id)`) và `user_roles_role_id_index` (`user_roles (role_id)`) ở cơ sở dữ liệu định danh (tệp 0041); không đổi bảng, không đổi dữ liệu.
- Thay đổi API: `GET /users` thêm tham số `login`, `full_name`, `must_change_password`, dạng trả về giữ nguyên; `GET /audit-logs`, `GET /users/audit-logs` nhận `page_size` đến 200; `DATA_GRID_KEYS` thêm `roles`, `api-clients`, `audit-logs`. Không có điểm cuối mới, không có quyền mới.
- Rủi ro: người quản trị quen ma trận quyền theo phân hệ chức năng cần làm quen chọn quyền theo cây menu; một quyền thuộc nhiều mục nên tích ở một mục làm đổi các mục khác; tìm theo từ khóa vẫn so khớp một phần, nhiều hơn 30 nghìn tài khoản cần chỉ mục trigram.
- Khả năng tương thích: đường dẫn `/roles`, `/accounts`, `/api-clients`, `/audit-logs` giữ nguyên; điểm cuối ghi quyền `PUT /roles/{id}/permissions` không đổi; kết quả hiện, ẩn mục menu như trước; cấu hình cột đã lưu của lưới `accounts` có mã cột `username` cũ thì bỏ qua mã đó; nút "Lưu quyền của vai trò", "Tạo vai trò" đổi thành "Ghi"; bộ lọc Trạng thái, Đối tượng của Nhật ký thao tác chuyển vào "Mở rộng tìm kiếm".
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15e`; chạy phần quay lui của tệp 0041 của cơ sở dữ liệu định danh để gỡ hai chỉ mục (không mất dữ liệu).

### Phiên bản 0.61.0 – 2026-10-15

- Phạm vi thay đổi: DT-15 phần 15c, học sinh theo hệ thống của Sở: Quản lý hồ sơ học sinh, điện thoại nhận tin, học 2 buổi/ngày và bán trú, biến động học sinh (YCTD-108).
- Chức năng mới: màn hình "4.1.1. Quản lý hồ sơ học sinh" dùng lưới dữ liệu chung với cột, bộ lọc "Mở rộng tìm kiếm" theo Sở, thứ tự A–Z theo tên, Xuất Excel theo cột đang hiện; hồ sơ học sinh hai thẻ "Hồ sơ học sinh" (khối của Sở, nhãn bên trái, nút Ghi) và "Thông tin riêng của trường"; biểu mẫu Thêm mới theo khối; điện thoại nhận tin của học sinh, tin nhắn theo học sinh gửi số nhận tin; học 2 buổi/ngày, bán trú sửa ở hồ sơ hoặc cập nhật hàng loạt; mục mới "4.2. Biến động học sinh" (nhập học, chuyển lớp, chuyển đơn vị, thôi học) kèm Xuất Excel; chữ "trẻ" trên các màn hình học sinh của cổng quản trị đổi thành "học sinh" (P02, P17).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: cột mới `children.two_sessions_per_day`, `children.boarding` (giá trị ban đầu từ `moet_profile`), `child_guardians.receives_sms` và chỉ mục duy nhất `child_guardians_receives_sms_unique` ở cơ sở dữ liệu năm học (tệp 0050).
- Thay đổi API: `GET /children` thêm bộ lọc, cột, thứ tự A–Z, cỡ trang đến 200; `GET`, `PATCH /children/{id}` thêm `two_sessions_per_day`, `boarding`, `sms_phone`; thêm `POST /children/export`, `POST /children/bulk-update`, `PUT /children/{id}/sms-guardian`, `GET /student-movements`, `POST /student-movements/export`.
- Rủi ro: người dùng quen danh sách sắp theo họ tên và khung hồ sơ bên phải cần làm quen thứ tự theo tên và hồ sơ mở dưới dòng; tin nhắn theo học sinh chỉ đi tới một phụ huynh khi đã chọn số nhận tin; dân tộc, diện chính sách, khuyết tật, biết bơi trống với học sinh chưa nhập tệp CSDL ngành.
- Khả năng tương thích: đường dẫn `/children` và lối tắt Truy cập nhanh giữ nguyên; bộ lọc cũ chuyển vào "Mở rộng tìm kiếm"; nút "Tạo hồ sơ mới", "Lưu hồ sơ nháp" đổi thành "Thêm mới", "Ghi"; học sinh chưa chọn số nhận tin vẫn nhận tin như trước; thông báo lỗi của máy chủ API và ứng dụng giáo viên, phụ huynh không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15c`; chạy phần quay lui của tệp 0050 để gỡ ba cột và chỉ mục (mất lựa chọn số nhận tin, học 2 buổi/ngày, bán trú đã ghi sau khi phát hành).

### Phiên bản 0.60.0 – 2026-10-14

- Phạm vi thay đổi: DT-15 phần 15a, khung chung của cổng quản trị theo hệ thống của Sở: menu ngang đánh số, menu người dùng, lưới dữ liệu dùng chung, cấu hình lưới theo người dùng (YCTD-107).
- Chức năng mới: menu ngang nhiều cấp đánh số theo phân hệ thay thanh điều hướng bên trái, dùng được bằng chuột và bàn phím, cây menu gập trên màn hình hẹp; menu người dùng (Thông báo, Đổi mật khẩu, Cấu hình hiển thị lưới, Thoát); lưới dữ liệu dùng chung (tìm kiếm, mở rộng tìm kiếm, chọn dòng, cấu hình cột hiển thị, số dòng mỗi trang 10 đến 200) và hộp xác nhận xóa có ô "Tôi đã đọc và đồng ý xóa"; cấu hình lưới lưu theo tài khoản; thí điểm lưới ở Tài khoản và Hồ sơ nhân sự (P19, P01, P07).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng mới `user_grid_settings` ở cơ sở dữ liệu hệ thống (tệp 0005).
- Thay đổi API: thêm `GET`, `PUT /me/grid-settings/{gridKey}`; `GET /users` của dịch vụ định danh nhận `page_size` đến 200.
- Rủi ro: người dùng quen thanh điều hướng bên trái cần làm quen menu ngang; danh sách tài khoản ở dịch vụ định danh vẫn đọc hết rồi cắt trang nên có lúc chậm khi có rất nhiều tài khoản; menu cấp ba ở mục cuối thanh có thể tràn khỏi màn hình rộng vừa đủ.
- Khả năng tương thích: đường dẫn các trang và lối tắt Truy cập nhanh giữ nguyên; lựa chọn ẩn thanh điều hướng, nhóm thu gọn (YCTD-99) và lựa chọn "Tất cả chức năng" của ô Phân hệ (YCTD-101) không còn dùng, giá trị cũ đã lưu thì dùng phân hệ đầu tiên người dùng được thấy; gỡ vai trò ở Tài khoản thêm bước xác nhận.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-15-phan-15a`; bảng `user_grid_settings` để lại không ảnh hưởng.

### Phiên bản 0.59.0 – 2026-10-14

- Phạm vi thay đổi: DT-14 phần 14d, hồ sơ trường, khai báo cơ sở vật chất, thiết bị dạy học, biểu EMIS đầu năm (YCTD-106).
- Chức năng mới: hồ sơ trường sáu thẻ (P01); khai báo cơ sở vật chất theo khối phòng, loại phòng, hiện trạng kèm bảng tổng hợp, danh mục thiết bị dạy học tối thiểu và ngoài danh mục, số lượng hiện có, tổng hợp thiết bị theo định mức (P13); báo cáo EMIS đầu năm Biểu 1 năm thẻ (P17); xuất Excel kèm nhật ký xuất.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: ba bảng mới `equipment_items`, `equipment_holdings`, `school_profiles`, cột mới của `rooms` (khối, loại, hiện trạng, diện tích, thuộc tính) và `assets.equipment_item_id` (tệp 0049 của năm học); bốn quyền mới (tệp 0039 của định danh).
- Thay đổi API: thêm `/school-profile`, `/facilities/rooms`, `/facilities/rooms/export`, `/equipment-items`, `/equipment-holdings`, `/equipment-assets`, `/equipment-report`, `/equipment-report/export`, `/reports/emis/start-of-year`, `/reports/emis/start-of-year/export`; `/rooms` thêm trường khai báo cơ sở vật chất.
- Rủi ro: danh mục thiết bị tối thiểu gieo sẵn (56 thiết bị) và mã số chỉ tiêu EMIS do hệ thống đặt, cần đối chiếu văn bản; dân tộc, khuyết tật, nhóm chức vụ, đảng viên đọc từ hồ sơ CSDL ngành đã nhập (YCTD-100).
- Khả năng tương thích: chức năng cũ giữ nguyên; trường mới của phòng học không bắt buộc; mở năm học mới thêm bước chuyển hồ sơ trường, danh mục thiết bị và số hiện có.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-14-phan-14d`; bảng, cột mới để lại không ảnh hưởng.

### Phiên bản 0.58.0 – 2026-10-14

- Phạm vi thay đổi: DT-14 phần 14a, cân nặng, chiều cao theo chuẩn WHO, thống kê theo tiêu chí ngành, hồ sơ chưa nhập đủ (YCTD-105).
- Chức năng mới: đợt cân đo, nhập cân nặng, chiều cao (kể cả từ Excel), kênh tăng trưởng, biểu đồ tăng trưởng, tổng hợp cân nặng, chiều cao (P10); thống kê lớp học, học sinh, nhân sự theo tiêu chí ngành, hồ sơ học sinh, nhân sự chưa nhập đủ (P17).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng mới `growth_rounds`, cột mới `health_measurements.growth_round_id` (tệp 0048 của năm học); ba quyền mới (tệp 0038 của định danh).
- Thay đổi API: thêm `/growth-rounds`, `/children/{id}/growth`, `/reports/growth`, `/reports/growth/export`, `/statistics/classes`, `/statistics/children`, `/statistics/staff`, `/statistics/missing-child-fields`, `/statistics/missing-staff-fields`.
- Rủi ro: dân tộc, khuyết tật, trình độ và các trường tương tự đọc từ hồ sơ CSDL ngành đã nhập (YCTD-100), trường chưa nhập tệp ngành thì thống kê ở "Chưa nhập"; ngưỡng kênh cố định theo WHO.
- Khả năng tương thích: chức năng cũ giữ nguyên; mở năm học mới bỏ liên kết đợt của số đo chuyển sang.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-14-phan-14a`; bảng, cột mới để lại không ảnh hưởng.

### Phiên bản 0.57.0 – 2026-10-13

- Phạm vi thay đổi: DT-14 phần 14c, hoàn thành chương trình mầm non, chuẩn nghề nghiệp, nhóm học sinh (YCTD-104).
- Chức năng mới: hoàn thành chương trình mầm non, nhóm học sinh (P02), đánh giá chuẩn nghề nghiệp giáo viên, hiệu trưởng (P07).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tám bảng mới của năm học (tệp 0047); năm quyền mới (tệp 0037 của định danh).
- Thay đổi API: thêm `/program-completion`, `/child-groups`, `/professional-standards`, `/professional-criteria`, `/professional-evaluations`, `/me/professional-evaluation`; `GET /children` thêm lọc `group_id`.
- Rủi ro: tên tiêu chí gieo sẵn và quy tắc xếp loại cần đối chiếu Thông tư 25, 26/2018/TT-BGDĐT.
- Khả năng tương thích: chức năng cũ giữ nguyên.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-14-phan-14c`; các bảng mới để lại không ảnh hưởng.

### Phiên bản 0.56.0 – 2026-10-13

- Phạm vi thay đổi: DT-14 phần 14b, năm học ở thanh đầu trang và Truy cập nhanh (YCTD-102).
- Chức năng mới: ô năm học, học kỳ ở thanh đầu trang; Truy cập nhanh trên trang chủ (P01).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng `user_quick_links` ở cơ sở dữ liệu hệ thống (tệp 0004).
- Thay đổi API: thêm `GET`, `PUT /me/quick-links`.
- Rủi ro: học kỳ hiện tại tính theo đồng hồ trình duyệt; năm học đã đóng chưa xem được.
- Khả năng tương thích: chức năng cũ giữ nguyên; người dùng chưa ghim thì vùng Truy cập nhanh trống.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-14-phan-14b`; bảng `user_quick_links` để lại không ảnh hưởng.

### Phiên bản 0.55.0 – 2026-10-13

- Phạm vi thay đổi: DT-13 phần 13c, báo cáo điểm danh và suất ăn theo ngày, tuần, tháng (YCTD-103).
- Chức năng mới: báo cáo điểm danh và suất ăn, xuất Excel theo mẫu của trường, suất ăn cho bếp (P17-02, P12).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: thêm `GET /reports/attendance-meals`, `GET /reports/attendance-meals/children`, `POST /reports/attendance-meals/export`, `GET /kitchen/meal-counts`.
- Rủi ro: mã B suy từ lý do vắng có từ chỉ bệnh, có thể sót khi lý do ghi khác.
- Khả năng tương thích: không đổi hành vi khi chưa bật nhà cung cấp; kiểm thử giữ bộ giả lập.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-13-phan-13a`; hoặc đặt lại biến môi trường về bộ giả lập.

### Phiên bản 0.54.0 – 2026-10-13

- Phạm vi thay đổi: DT-13 phần 13a, nhập thẳng tệp học sinh, cán bộ theo mẫu CSDL ngành (YCTD-100).
- Chức năng mới: nhập tệp học sinh, cán bộ theo mẫu CSDL ngành, lưu đủ mọi cột (P01-13, P02-12, P07).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tệp 0045, 0046 của năm học: hồ sơ ngành của trẻ và nhân sự, năm sinh và số định danh của người thân, bản xem trước của lượt nhập.
- Thay đổi API: loại nhập `moet_children`, `moet_staff`; tải tệp nhận `org_unit_id`.
- Rủi ro: giá trị danh mục chưa đối chiếu danh mục của Bộ; nhập lại thay toàn bộ hồ sơ ngành.
- Khả năng tương thích: không đổi hành vi khi chưa bật nhà cung cấp; kiểm thử giữ bộ giả lập.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-13-phan-13a`; hoặc đặt lại biến môi trường về bộ giả lập.

### Phiên bản 0.53.0 – 2026-10-13

- Phạm vi thay đổi: DT-12 phần 12d, cấu hình triển khai môi trường chạy thật (YCTD-98).
- Chức năng mới: cấu hình triển khai Docker Compose, sao lưu và khôi phục, hướng dẫn triển khai (XT-04, SL-01 đến SL-05).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: chưa thử trên máy chủ thuê với tên miền và HTTPS thật.
- Khả năng tương thích: không đổi hành vi khi chưa bật nhà cung cấp; kiểm thử giữ bộ giả lập.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-12-phan-12d`; hoặc đặt lại biến môi trường về bộ giả lập.

### Phiên bản 0.52.0 – 2026-10-13

- Phạm vi thay đổi: DT-12 phần 12c, Fanpage và Zalo Official Account chạy thật (YCTD-95).
- Chức năng mới: kiểm tra kết nối Fanpage, Zalo, làm mới khóa Zalo tự động (P14-08, G3-08).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng `integration_credentials` của cơ sở dữ liệu hệ thống (tệp 0003).
- Thay đổi API: thêm `POST /api/v1/integrations/facebook/test`, `POST /api/v1/integrations/zalo/test`, `PUT /api/v1/integrations/zalo/refresh-token`.
- Rủi ro: chưa thử với Fanpage và Official Account thật; đổi `CHILD_DATA_ENCRYPTION_KEY` thì phải dán lại khóa làm mới Zalo.
- Khả năng tương thích: không đổi hành vi khi chưa bật nhà cung cấp; kiểm thử giữ bộ giả lập.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-12-phan-12c`; hoặc đặt lại biến môi trường về bộ giả lập.

### Phiên bản 0.51.0 – 2026-10-13

- Phạm vi thay đổi: DT-12 phần 12b, cổng thanh toán PayOS, SePay, Casso, VNPay (YCTD-94).
- Chức năng mới: bốn cổng thanh toán trực tuyến và điểm cuối nhận thông báo tiền vào (P06-11).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: thêm `POST /api/v1/payment-webhooks/payos`, `/sepay`, `/casso` và `GET /api/v1/payment-webhooks/vnpay-ipn`.
- Rủi ro: chưa thử với tài khoản thật của bốn nhà cung cấp; cần thử trên môi trường thử của từng nhà cung cấp trước khi chạy thật.
- Khả năng tương thích: không đổi hành vi khi chưa bật nhà cung cấp; kiểm thử giữ bộ giả lập.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-12-phan-12b`; hoặc đặt lại biến môi trường về bộ giả lập.

### Phiên bản 0.50.0 – 2026-10-13

- Phạm vi thay đổi: DT-12 phần 12a, nối nhà cung cấp tin nhắn eSMS.vn (YCTD-93).
- Chức năng mới: gửi mã đăng nhập một lần và tin nhắn thông báo qua eSMS.vn (P19-06, XT-09).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: chưa thử với tài khoản eSMS.vn thật; tên thương hiệu và mẫu tin cần đăng ký trước.
- Khả năng tương thích: không đổi hành vi khi chưa bật nhà cung cấp; kiểm thử giữ bộ giả lập.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-12-phan-12a`; hoặc đặt lại biến môi trường về bộ giả lập.

### Phiên bản 0.49.0 – 2026-10-13

- Phạm vi thay đổi: Eric nghiệm thu ba bản 1.0.0, 1.1.0, 1.2.0; quyết định G3-04; chọn nhà cung cấp; lập đợt DT-12 (YCTD-92).
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: các bản đã nghiệm thu chưa chạy thật trên máy chủ đám mây (việc T6).
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-12-ke-hoach`.

### Phiên bản 0.48.0 – 2026-10-11

- Phạm vi thay đổi: DT-11, báo cáo kiểm thử giai đoạn 3, bản ứng viên phát hành 1.2.0 (YCTD-91).
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: các giới hạn đã biết ở mục 6 của `30_BAO_CAO_KIEM_THU_G3.md`.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-11-bao-cao-g3`.

### Phiên bản 0.47.0 – 2026-10-11

- Phạm vi thay đổi: DT-11 phần 11c, sổ kế toán kép theo chế độ kế toán hành chính, sự nghiệp (YCTD-88).
- Chức năng mới: P06-12 (mới) trên máy chủ API và cổng quản trị (MH-67, MH-68, MH-69).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bốn bảng sổ kế toán của năm học kèm danh mục tài khoản và quy tắc ghi sổ khởi tạo (tệp 0042).
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: danh mục tài khoản khởi tạo cần kế toán trưởng đối chiếu văn bản gốc; kết chuyển theo năm học, không theo năm dương lịch.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-11-phan-11c`; chạy ngược tệp 0042 của cơ sở dữ liệu năm học.

### Phiên bản 0.46.0 – 2026-10-11

- Phạm vi thay đổi: DT-11 phần 11d, nhập sao kê ngân hàng, đối soát tự động, nhiều cổng thanh toán (YCTD-89).
- Chức năng mới: P06-06, P06-11 trên máy chủ API và cổng quản trị (MH-70, MH-11).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng `bank_statement_profiles`, `bank_statement_imports` của năm học (tệp 0043); cột `cash_accounts.payment_provider`, `bank_bin`, `bank_statement_lines.import_id`, `suggested_invoice_id`; cấu hình đơn vị `bank_match_days`.
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: cấu hình cột sai làm đọc sai sao kê; chỉ đọc tệp .xlsx và CSV mã UTF-8.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-11-phan-11d`; chạy ngược tệp 0043 của cơ sở dữ liệu năm học.

### Phiên bản 0.45.0 – 2026-10-11

- Phạm vi thay đổi: DT-11 phần 11a, tuyển sinh trực tuyến và tin tuyển sinh (YCTD-86).
- Chức năng mới: P16-01 đến P16-05 trên máy chủ API, cổng quản trị (MH-26, MH-63), trang tuyển sinh trực tuyến công khai trên ứng dụng phụ huynh (MP-21).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: ba bảng tuyển sinh của năm học (tệp 0040).
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: điểm cuối công khai giới hạn số lần gọi trong bộ nhớ của từng máy chủ, cần bộ nhớ chung khi chạy nhiều máy chủ (việc T6); chuyển hồ sơ gồm nhiều bước không chung một giao dịch, lỗi duyệt để lại hồ sơ trẻ chờ duyệt.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-11-phan-11a`; chạy ngược tệp 0040 của cơ sở dữ liệu năm học.

### Phiên bản 0.44.0 – 2026-10-11

- Phạm vi thay đổi: DT-11 phần 11b, tuyển dụng: đề nghị, tin, ứng viên, phỏng vấn (YCTD-87).
- Chức năng mới: P18-01 đến P18-04 trên máy chủ API, cổng quản trị (MH-27), trang tuyển dụng công khai trên ứng dụng phụ huynh (MH-65).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bốn bảng tuyển dụng của năm học (tệp 0041); thêm mục đích tệp `candidate_cv`.
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: điểm cuối công khai giới hạn số lần gọi trong bộ nhớ của từng máy chủ, cần bộ nhớ chung khi chạy nhiều máy chủ (việc T6).
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-11-phan-11b`; chạy ngược tệp 0041 của cơ sở dữ liệu năm học.

### Phiên bản 0.43.0 – 2026-10-11

- Phạm vi thay đổi: DT-11 phần 11e, kết nối Facebook, Fanpage và Zalo Official Account (YCTD-90).
- Chức năng mới: P14-08, kênh Zalo của trung tâm thông báo (P19-04) và nhắc nợ (P05-10) trên máy chủ API và cổng quản trị (MH-71, MH-23).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng `integration_settings`, `zalo_followers`, `facebook_posts` của năm học (tệp 0044); kênh `zalo` và cột `delivered_via` ở `notification_recipients`.
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: bộ chuyển đổi Graph API và Zalo Official Account thật chưa chạy với tài khoản thật; khóa truy cập chỉ đặt ở biến môi trường.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-11-phan-11e`; chạy ngược tệp 0044 của cơ sở dữ liệu năm học.

### Phiên bản 0.42.0 – 2026-10-11

- Phạm vi thay đổi: DT-10, báo cáo kiểm thử giai đoạn 2, bản ứng viên phát hành 1.1.0 (YCTD-84).
- Chức năng mới: không; bổ sung ca kiểm thử cho CT-041, CT-083, CT-085.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: các giới hạn đã biết ở mục 6 của `29_BAO_CAO_KIEM_THU_G2.md`.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-bao-cao-g2`.

### Phiên bản 0.41.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10i, nhắc nợ, xử lý công nợ quá hạn, đối chiếu ngân hàng, công nợ phải trả, chốt kỳ tài chính (YCTD-82).
- Chức năng mới: P05-10, P05-12, P06-06, P06-07, P06-09 trên máy chủ API và cổng quản trị (MH-08, MH-11, MH-61, MH-62).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: năm bảng của năm học (tệp 0038); không thêm cột vào bảng có sẵn.
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: kỳ đã chốt chặn lập và sửa chứng từ của kỳ; chưa có thao tác mở lại kỳ đã chốt.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10i`; chạy ngược tệp 0038 của cơ sở dữ liệu năm học.

### Phiên bản 0.40.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10h, công việc, kế hoạch, đánh giá nhân sự, quá trình công tác, thưởng và khấu trừ (YCTD-81).
- Chức năng mới: P09-01 đến P09-05, P07-03, P08-07 trên máy chủ API, cổng quản trị (MH-58, MH-59, MH-60, MH-12, MH-44), ứng dụng giáo viên (MG-12).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: mười bảng của năm học (tệp 0037); phiếu lương có thêm dòng thưởng và khấu trừ.
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: khoản thưởng, khấu trừ ghi khi bảng lương còn nháp cần tính lại bảng lương; quyết toán nghỉ việc chưa gồm thưởng.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10h`; chạy ngược tệp 0037 của cơ sở dữ liệu năm học.

### Phiên bản 0.39.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10j, báo cáo hoạt động và công việc, báo cáo hợp nhất, xuất dữ liệu (YCTD-83).
- Chức năng mới: P17-10, P17-11, P17-12 trên máy chủ API và cổng quản trị (MH-28, MH-29).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng `export_logs` của năm học (tệp 0039).
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: báo cáo hợp nhất tính trực tiếp từ dữ liệu gốc, chưa dùng số liệu tổng hợp sẵn; tháng có nhiều dữ liệu có thể chậm.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10j`; chạy ngược tệp 0039 của cơ sở dữ liệu năm học.

### Phiên bản 0.38.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10g, giảng dạy: bài học, giáo án, thời khóa biểu, kế hoạch, tiến độ học tập (YCTD-80).
- Chức năng mới: P03-01 đến P03-08 (trừ tổ chuyên môn) trên máy chủ API, cổng quản trị (MH-57), ứng dụng giáo viên (MG-05, MG-06), ứng dụng phụ huynh (MP-04, MP-05).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: mười bảng giảng dạy của năm học (tệp 0036).
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: tổ trưởng chuyên môn xem theo đơn vị được gán vì chưa có bảng tổ chuyên môn.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10g`; chạy ngược tệp 0036 của cơ sở dữ liệu năm học.

### Phiên bản 0.37.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10f, tương tác với phụ huynh và đồ bị mất của trẻ (YCTD-79).
- Chức năng mới: P15-01 đến P15-06 và P02-11 trên máy chủ API, cổng quản trị (MH-25), ứng dụng giáo viên (MG-08, MG-15), ứng dụng phụ huynh (MP-09, MP-10, MP-17, MP-19).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: mười ba bảng tương tác và đồ bị mất của năm học (tệp 0035).
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: trao đổi không theo thời gian thực, phụ huynh và giáo viên tải lại để thấy tin mới; chưa nhận ảnh đồ bị mất và tệp đính kèm tin nhắn.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10f`; chạy ngược tệp 0035 của cơ sở dữ liệu năm học.

### Phiên bản 0.36.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10e, hoạt động, hình ảnh, tin tức, thư viện, ngoại khóa (YCTD-78).
- Chức năng mới: P14-01 đến P14-12 trên máy chủ API, cổng quản trị (trang Hoạt động và tin tức), ứng dụng giáo viên (hoạt động lớp), ứng dụng phụ huynh (hoạt động, tin tức).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: các bảng hoạt động, nội dung, bình luận, ngoại khóa của năm học (tệp 0034); thêm mục đích tệp `activity_photo`, `content_file`; thêm loại dòng hóa đơn `extracurricular` và cột `invoice_items.extracurricular_registration_id`.
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: phí ngoại khóa đi vào lần tính học phí; đăng ký sau khi hóa đơn chính đã phát hành sinh hóa đơn bổ sung.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10e`; chạy ngược tệp 0034 của cơ sở dữ liệu năm học.

### Phiên bản 0.35.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10c, bếp, thực đơn, định lượng và báo cáo ăn (YCTD-76).
- Chức năng mới: P12-01 đến P12-09 và P17-08 trên máy chủ API, cổng quản trị (MH-18, MH-38), ứng dụng giáo viên (MG-14), ứng dụng phụ huynh (MP-15).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: mười một bảng bếp của năm học (tệp 0032).
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: số suất tạm trước khi chốt điểm danh có thể khác số chính thức; báo cáo ăn và bếp chỉ ra ngày lệch.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10c`; chạy ngược tệp 0032 của cơ sở dữ liệu năm học.

### Phiên bản 0.34.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10b, thuốc: danh mục, dặn thuốc, cho uống, mua và cấp thuốc (YCTD-75).
- Chức năng mới: P10-02, P10-03, P10-04, P10-05, P10-09 trên máy chủ API, cổng quản trị (MH-17), ứng dụng giáo viên (MG-09 phần dặn thuốc), ứng dụng phụ huynh (MP-07, MP-08 phần bỏ liều).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tám bảng thuốc của năm học (tệp 0031); thêm mục đích tệp `medicine_photo`, `prescription`.
- Thay đổi API: nhóm điểm cuối của phần trong `17`.
- Rủi ro: giáo viên chủ nhiệm chỉ nhận thuốc khi đơn vị bật cấu hình không có nhân viên y tế; cấu hình sai thì không ai nhận được yêu cầu.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10b`; chạy ngược tệp 0031 của cơ sở dữ liệu năm học.

### Phiên bản 0.33.0 – 2026-10-11

- Phạm vi thay đổi: DT-10 phần 10d, kho, tài sản, mua hàng (YCTD-77).
- Chức năng mới: P13-01 đến P13-10 trên máy chủ API và cổng quản trị (MH-20, MH-21, MH-22).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: mười ba bảng kho, tài sản, mua hàng của năm học (tệp 0033).
- Thay đổi API: nhóm điểm cuối kho, tài sản, mua hàng trong `17`.
- Rủi ro: thanh toán phiếu mua hàng phụ thuộc kế toán gắn phiếu chi; phiếu chưa gắn vẫn ở trạng thái chờ thanh toán.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10d`; chạy ngược tệp 0033 của cơ sở dữ liệu năm học.

### Phiên bản 0.32.0 – 2026-10-11

- Phạm vi thay đổi: kế hoạch DT-10 (YCTD-73); DT-10 phần 10a, y tế học đường phần hồ sơ, khám, sự kiện, chăm sóc, báo cáo (YCTD-74).
- Chức năng mới: P10-01, P10-06, P10-07, P10-08, P10-10, P10-11, P10-12 trên máy chủ API, cổng quản trị (MH-16), ứng dụng giáo viên (MG-09), ứng dụng phụ huynh (MP-08).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: tám bảng y tế của năm học; ba quyền P10.
- Thay đổi API: các điểm cuối y tế trong `17`.
- Rủi ro: tiêu chuẩn sức khỏe do y tế nhập tay theo văn bản của Bộ Y tế, nhập sai thì đánh giá sai.
- Khả năng tương thích: kế toán trưởng không còn thấy mục sức khỏe trong chi tiết hồ sơ trẻ (BR-53).
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-10-phan-10a`; chạy ngược tệp 0030 của cơ sở dữ liệu năm học và 0031 của định danh.

### Phiên bản 0.31.0 – 2026-10-11 (ứng viên phát hành 1.0.0)

- Phạm vi thay đổi: DT-09 phần 9g, báo cáo cổng CG-10 và bản ứng viên phát hành 1.0.0 (YCTD-72).
- Chức năng mới: không; toàn bộ chức năng G1 đã có ở các phiên bản 0.25.x đến 0.30.9.
- Lỗi đã sửa: tài liệu CTC-P06-050 và quyền của P06-08 lệch PQ-35.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: chưa nối nhà cung cấp tin nhắn và thanh toán thật (T1); chưa chạy kiểm thử hiệu năng và phục hồi trên môi trường thật (T6).
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: bản ứng viên chưa triển khai; khi triển khai, quay lui bằng bản sao lưu cơ sở dữ liệu trước triển khai và bản dựng trước đó.

### Phiên bản 0.30.9 – 2026-10-11

- Phạm vi thay đổi: DT-09 phần 9f, tiến trình gửi thông báo, gửi lại khi lỗi, giới hạn tin nhắn trong ngày, nhắc ghi nhật ký (YCTD-71).
- Chức năng mới: tiến trình nền CB-05, CB-07 trong máy chủ API; cấu hình `journal_reminder_time`.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `notification_recipients` thêm cột theo dõi lần gửi và trạng thái `limited`.
- Thay đổi API: không thêm điểm cuối; biến môi trường mới `NOTIFICATION_DISPATCH_INTERVAL_SECONDS`.
- Rủi ro: chưa nối nhà cung cấp tin nhắn thật (T1), tin nhắn chỉ ghi ra nhật ký máy chủ.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-09-phan-9f`; chạy ngược tệp 0029 của cơ sở dữ liệu năm học.

### Phiên bản 0.30.8 – 2026-10-11

- Phạm vi thay đổi: DT-09 phần 9e, sĩ số tối đa và nhật ký truy cập theo cấu hình, báo cáo thu chi theo nhóm và theo tháng (YCTD-70).
- Chức năng mới: `GET /data-access-logs`; bảng theo nhóm và theo tháng của báo cáo thu chi.
- Lỗi đã sửa: cấu hình `max_class_size` và `data_access_logging` trước đây lưu được nhưng không có tác dụng.
- Thay đổi dữ liệu: không.
- Thay đổi API: báo cáo thu chi có `groups`, `periods`.
- Rủi ro: bật ghi nhật ký truy cập làm tăng số dòng nhật ký; giữ tối thiểu 24 tháng (BM-70).
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-09-phan-9e`.

### Phiên bản 0.30.7 – 2026-10-11

- Phạm vi thay đổi: DT-09 phần 9d, chuyển trẻ, phụ huynh, lớp đang học, quỹ, công nợ sang năm học mới; kiểm tra BR-89, BR-94 (YCTD-69).
- Chức năng mới: hai bước chuyển năm học `children` và `finance`; mẫu thông báo chuyển cùng cấu hình.
- Lỗi đã sửa: mở năm học mới trước đây không chuyển trẻ, lớp, quỹ, công nợ, mẫu thông báo và không kiểm tra BR-89.
- Thay đổi dữ liệu: `receipts.carried_over`.
- Thay đổi API: mở năm học trả thêm mã BR-94; phiếu thu có `carried_over`.
- Rủi ro: mở năm học là thao tác một chiều; cần sao lưu trước khi mở (RR-13).
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-09-phan-9d`; chạy ngược tệp 0028 của cơ sở dữ liệu năm học.

### Phiên bản 0.30.6 – 2026-10-11

- Phạm vi thay đổi: DT-09 phần 9c, lịch nghỉ và lịch công tác (YCTD-68).
- Chức năng mới: P08-02 trên máy chủ API, cổng quản trị (MH-56), ứng dụng giáo viên (MG-10).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `work_schedules`; quyền `P08.work-schedule.manage`.
- Thay đổi API: năm điểm cuối lịch công tác; bảng công tính ngày công tác đã công bố.
- Rủi ro: ngày công tác không chấm công được tính đủ giờ chuẩn nên lịch phải lập đúng trước khi chốt công.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-09-phan-9c`; chạy ngược tệp 0027 của cơ sở dữ liệu năm học và 0030 của cơ sở dữ liệu định danh.

### Phiên bản 0.30.5 – 2026-10-11

- Phạm vi thay đổi: DT-09 phần 9b, chuyển đơn vị, thôi học, đồng ý hình ảnh, cờ trẻ con nhân viên (YCTD-67).
- Chức năng mới: P02-07, P02-08, P02-09 trên máy chủ API, cổng quản trị, ứng dụng phụ huynh.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `child_unit_transfers`.
- Thay đổi API: năm điểm cuối mới của hồ sơ trẻ.
- Rủi ro: tính học phí tháng thôi học phụ thuộc ngày thôi học nhập đúng.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-09-phan-9b`; chạy ngược tệp thay đổi cấu trúc 0026 của cơ sở dữ liệu năm học.

### Phiên bản 0.30.4 – 2026-10-11

- Phạm vi thay đổi: DT-09 phần 9a, kiểm thử bổ sung và ghi kết quả (YCTD-66).
- Chức năng mới: không.
- Lỗi đã sửa: nhật ký duyệt, từ chối phiếu chi thiếu giá trị chứng từ (BR-80).
- Thay đổi dữ liệu: không.
- Thay đổi API: không đổi giao kèo.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-09-phan-9a`.

### Phiên bản 0.30.3 – 2026-10-11

- Phạm vi thay đổi: DT-08 phần 8b, nhật ký của bé (YCTD-65).
- Chức năng mới: giáo viên chủ nhiệm ghi và công bố nhật ký của bé; phụ huynh xem nhật ký đã công bố của con.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `daily_journals`, `journal_amendments`.
- Thay đổi API: nhóm điểm cuối nhật ký.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-08-phan-8b`; chạy ngược tệp thay đổi cấu trúc 0025 của cơ sở dữ liệu năm học.

### Phiên bản 0.30.2 – 2026-10-11

- Phạm vi thay đổi: DT-08 phần 8a, trung tâm thông báo và mẫu thông báo (YCTD-64).
- Chức năng mới: thông báo của tôi trên ba kênh giao diện, đánh dấu đã đọc, ai đã đọc, mẫu thông báo.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `notification_reads`, `notification_templates`; hai mã quyền P19.
- Thay đổi API: nhóm điểm cuối `/notifications`, `/notification-templates`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-08-phan-8a`; chạy ngược tệp thay đổi cấu trúc 0024 của cơ sở dữ liệu năm học và 0029 của cơ sở dữ liệu định danh.

### Phiên bản 0.30.1 – 2026-10-11

- Phạm vi thay đổi: DT-07 phần 7b, khóa API cho đối tác chỉ đọc (YCTD-63).
- Chức năng mới: cấp, thu hồi khóa API; đối tác đọc báo cáo tổng hợp, thu chi và công nợ, danh sách trẻ và phụ huynh, nhân sự và lương theo phạm vi khóa.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `api_clients` ở cơ sở dữ liệu định danh; mã quyền `P01.api-client.manage`.
- Thay đổi API: nhóm `/api-clients` (dịch vụ định danh), nhóm `/partner/` (máy chủ API).
- Rủi ro: giới hạn tần suất giữ trong bộ nhớ của một tiến trình máy chủ API; khi chạy nhiều tiến trình cần chuyển sang Redis.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-07-phan-7b`; chạy ngược tệp thay đổi cấu trúc 0028 của cơ sở dữ liệu định danh.

### Phiên bản 0.30.0 – 2026-10-11

- Phạm vi thay đổi: DT-07 phần 7a, bảng điều khiển và báo cáo cơ bản (YCTD-62).
- Chức năng mới: bảng điều khiển Ban Giám hiệu và quản lý đơn vị, sinh nhật trẻ trong tháng, sáu báo cáo cơ bản.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: chín mã quyền P17.
- Thay đổi API: nhóm điểm cuối `/dashboard/` và `/reports/`.
- Rủi ro: báo cáo tính trực tiếp, dữ liệu lớn có thể chậm; khi cần thì thêm bảng tổng hợp.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-07-phan-7a`; chạy ngược tệp thay đổi cấu trúc 0027 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.7 – 2026-10-11

- Phạm vi thay đổi: DT-06 phần 6c-2, phiếu chi lương, quyết toán, thu hồi lương, điều chỉnh kỳ sau (YCTD-61).
- Chức năng mới: phiếu chi lương từ bảng lương và bảng quyết toán; bảng quyết toán khi chấm dứt hợp đồng; phiếu thu thu hồi lương không gắn trẻ; khoản điều chỉnh lương kỳ sau.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `payroll_settlements`, `payroll_adjustments`; cột liên kết ở `payments`, `receipts`; `receipts.child_id` được trống.
- Thay đổi API: nhóm điểm cuối quyết toán, điều chỉnh, phiếu chi lương.
- Rủi ro: phiếu thu không gắn trẻ chưa đảo được bằng chức năng đảo phiếu thu.
- Khả năng tương thích: phiếu thu cũ đều gắn trẻ, không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-06-phan-6c-2`; chạy ngược tệp thay đổi cấu trúc 0023 của cơ sở dữ liệu năm học.

### Phiên bản 0.29.6 – 2026-10-11

- Phạm vi thay đổi: DT-06 phần 6c-1, danh mục lương, biểu thuế, bảng lương toàn trường, phiếu lương (YCTD-60).
- Chức năng mới: danh mục phụ cấp, thưởng, khấu trừ; khoản gán cho nhân sự; biểu thuế thu nhập cá nhân; tính bảng lương trả trước kèm điều chỉnh; trình, duyệt theo hạn mức, trả lại; phiếu lương của tôi.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: sáu bảng tiền lương, `staff.dependents_count`; sáu mã quyền P08; cấu hình `overtime_rate_percent`.
- Thay đổi API: nhóm điểm cuối danh mục lương, biểu thuế, bảng lương, phiếu lương.
- Rủi ro: biểu thuế có sẵn phải được kế toán trưởng cập nhật khi luật thay đổi.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-06-phan-6c-1`; chạy ngược tệp thay đổi cấu trúc 0022 của cơ sở dữ liệu năm học và 0026 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.5 – 2026-10-11

- Phạm vi thay đổi: DT-06 phần 6b-2, phép năm, đơn nghỉ phép, chốt và mở lại bảng công (YCTD-59).
- Chức năng mới: quy định phép năm theo chức danh và thâm niên; số ngày phép năm; đơn nghỉ tự gửi hoặc lập hộ, duyệt, từ chối, hủy; chốt bảng công; đề nghị và duyệt mở lại kỳ công.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: sáu bảng phép năm, đơn nghỉ, bảng công; ba mã quyền P08.
- Thay đổi API: nhóm điểm cuối phép năm, đơn nghỉ, kỳ công.
- Rủi ro: kỳ đã chốt chặn sửa chấm công và đơn nghỉ của tháng đó.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-06-phan-6b-2`; chạy ngược tệp thay đổi cấu trúc 0021 của cơ sở dữ liệu năm học và 0025 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.4 – 2026-10-11

- Phạm vi thay đổi: DT-06 phần 6b-1, ngày lễ, lịch học bù và nghỉ bù, chấm công (YCTD-59).
- Chức năng mới: ngày nghỉ lễ, ngày học bù thứ bảy, ngày nghỉ bù; nhân sự tự vào ca, ra ca; phòng nhân sự nhập, sửa giờ; bảng chấm công theo tháng; cấu hình giờ làm; thuộc tính tính công của loại nghỉ.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `holidays`, `school_day_changes`, `attendance_logs`, `catalog_items.attributes`; bốn mã quyền P08; ba mục cấu hình giờ làm.
- Thay đổi API: nhóm điểm cuối ngày lễ, lịch bù, chấm công; danh mục dùng chung nhận `attributes`.
- Rủi ro: ngày lễ, nghỉ bù, học bù đổi ngày học khi điểm danh và tính học phí; chỉ lập được cho ngày từ ngày mai.
- Khả năng tương thích: chưa lập lịch thì ngày học không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-06-phan-6b`; chạy ngược tệp thay đổi cấu trúc 0020 của cơ sở dữ liệu năm học và 0024 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.3 – 2026-10-10

- Phạm vi thay đổi: DT-06 phần 6a, hồ sơ nhân sự và hợp đồng lao động (YCTD-58).
- Chức năng mới: hồ sơ nhân sự, liên kết tài khoản có sẵn, hợp đồng lao động, chấm dứt hợp đồng khóa tài khoản, cảnh báo hợp đồng sắp hết hạn, nhập nhân sự từ Excel.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `staff`, `employment_contracts`; mã quyền `P07.staff.manage`, `P07.staff.view`, `P07.contract.view`, `P01.import.staff`; cấu hình `contract_expiry_warning_days`.
- Thay đổi API: nhóm điểm cuối nhân sự và hợp đồng; hai điểm cuối mới ở dịch vụ định danh.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-06-phan-6a`; chạy ngược tệp thay đổi cấu trúc 0019 của cơ sở dữ liệu năm học và 0023 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.2 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5f, thanh toán trực tuyến bằng mã QR (YCTD-57).
- Chức năng mới: tài khoản ảo và mã QR dùng một lần theo hóa đơn; đối chiếu giao dịch tiền vào tự lập phiếu thu; danh sách giao dịch chờ kế toán xử lý; phụ huynh thanh toán bằng mã QR.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `payment_requests`, `online_payment_transactions`; `cash_accounts` thêm tài khoản nhận thanh toán trực tuyến.
- Thay đổi API: mã QR của hóa đơn, cấu hình tài khoản nhận, giao dịch chuyển khoản và xử lý, điểm cuối giả lập.
- Rủi ro: chưa nối nhà cung cấp thật; ở môi trường chạy thật không đặt `PAYMENT_GATEWAY` thì phụ huynh nhận thông báo chưa nối.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5f`; chạy ngược tệp thay đổi cấu trúc 0018 của cơ sở dữ liệu năm học.

### Phiên bản 0.29.1 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5e-2, phiếu đảo phiếu chi (YCTD-56).
- Chức năng mới: lập phiếu đảo phiếu chi kèm lý do; Ban Giám hiệu duyệt theo hạn mức; hoàn lại nguồn chi và số dư có khi đảo phiếu hoàn tiền.
- Lỗi đã sửa: kiểm thử giao diện phiếu chi không còn phụ thuộc việc đơn vị chưa đặt hạn mức.
- Thay đổi dữ liệu: `payment_reversals`; mã quyền `P06.payment-reversal.create`.
- Thay đổi API: điểm cuối đảo phiếu chi, phiếu đảo phiếu chi chờ duyệt.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5e2`; chạy ngược tệp thay đổi cấu trúc 0017 của cơ sở dữ liệu năm học và 0022 của cơ sở dữ liệu định danh.

### Phiên bản 0.29.0 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5e-1, phiếu chi và sổ quỹ (YCTD-55).
- Chức năng mới: phiếu chi kèm chứng từ, trình duyệt, Ban Giám hiệu duyệt theo hạn mức thì phát hành và trừ nguồn chi; phiếu chi hoàn tiền thôi học trừ số dư có của trẻ; sổ quỹ theo khoảng ngày.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `payments`, `payment_attachments`, `payment_refund_sources`; tệp mục đích `payment_voucher`; mã quyền `P06.payment.manage`, `P06.payment.approve`; mặc định của `bank_balance_check` là bật.
- Thay đổi API: nhóm điểm cuối phiếu chi, `GET /cash-books`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5e`; chạy ngược tệp thay đổi cấu trúc 0016 của cơ sở dữ liệu năm học và 0021 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.9 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5d-2, đảo phiếu thu và nhập công nợ đầu kỳ (YCTD-54).
- Chức năng mới: lập phiếu đảo phiếu thu, Ban Giám hiệu duyệt theo hạn mức; nhập công nợ đầu kỳ từ Excel thành hóa đơn đầu kỳ.
- Lỗi đã sửa: mục điều hướng "Quỹ và tài khoản" trùng với mục "Tài khoản", đổi thành "Quỹ và ngân hàng".
- Thay đổi dữ liệu: `receipt_reversals`; loại hóa đơn, loại dòng khoản và loại lần nhập thêm đầu kỳ; mã quyền `P06.receipt-reversal.create`, `P06.receipt-reversal.approve`, `P05.opening-debt.import`.
- Thay đổi API: điểm cuối đảo phiếu thu, phiếu đảo chờ duyệt; nhập dữ liệu nhận loại `opening_debts`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5d2`; chạy ngược tệp thay đổi cấu trúc 0015 của cơ sở dữ liệu năm học và 0020 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.8 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5d-1, phiếu thu, phân bổ, quỹ và công nợ phải thu (YCTD-53).
- Chức năng mới: khai báo quỹ tiền mặt và tài khoản ngân hàng; lập phiếu thu và phân bổ vào hóa đơn, số dư có; công nợ theo đơn vị và theo trẻ; màn hình Công nợ, Phiếu thu, Quỹ và ngân hàng; phụ huynh xem số còn phải nộp và lịch sử đã nộp.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `cash_accounts`, `receipts`, `receipt_allocations`, `account_transactions`; mã quyền `P06.receipt.manage`, `P06.cash-account.manage`, `P05.debt.view`.
- Thay đổi API: nhóm điểm cuối phiếu thu, quỹ và tài khoản, công nợ; hóa đơn thêm số đã thu và còn phải nộp; bỏ `POST /receipts/{id}/issue`.
- Rủi ro: không.
- Khả năng tương thích: miễn giảm và điều chỉnh giảm bị chặn khi vượt số còn phải nộp của hóa đơn đã thu.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5d1`; chạy ngược tệp thay đổi cấu trúc 0014 của cơ sở dữ liệu năm học và 0019 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.7 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5c-2, miễn giảm và phiếu điều chỉnh hóa đơn (YCTD-52).
- Chức năng mới: lập miễn giảm trên hóa đơn nháp và đã phát hành, chép miễn giảm kỳ trước; phiếu điều chỉnh tăng, giảm; Ban Giám hiệu duyệt theo hạn mức; số phải nộp trên hóa đơn; màn hình duyệt MH-07.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `discounts`, `invoice_adjustments`; mã quyền `P05.discount.manage`, `P05.invoice-adjustment.create`, `P05.fee-document.approve`.
- Thay đổi API: nhóm điểm cuối miễn giảm, phiếu điều chỉnh, chờ duyệt; hóa đơn thêm số phải nộp.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5c2`; chạy ngược tệp thay đổi cấu trúc 0013 của cơ sở dữ liệu năm học và 0018 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.6 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5c-1, tính học phí và phát hành hóa đơn (YCTD-51).
- Chức năng mới: tính học phí kỳ theo đơn vị; hóa đơn nháp kèm dòng cần kiểm tra; phát hành hóa đơn chính và bổ sung; xem hóa đơn trên cổng quản trị và ứng dụng phụ huynh; chặn đăng ký thêm khi nợ quá hạn.
- Lỗi đã sửa: phụ huynh xem được bảng đăng ký dịch vụ của cả đơn vị.
- Thay đổi dữ liệu: `fee_calculation_runs`, `invoices`, `invoice_items`, `document_sequences`; mã quyền `P05.fee-calculation.manage`.
- Thay đổi API: nhóm điểm cuối tính học phí và hóa đơn.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ ngoài sửa lỗi phân quyền.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5c1`; chạy ngược tệp thay đổi cấu trúc 0012 của cơ sở dữ liệu năm học và 0017 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.5 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5b, đăng ký dịch vụ và học hè (YCTD-50).
- Chức năng mới: đăng ký dịch vụ theo tháng tự giữ tới khi hủy; đăng ký và hủy sau ngày chốt chờ Ban Giám hiệu duyệt; chốt danh sách kỳ; đăng ký học hè; điểm danh ngày hè; màn hình MH-05, MP-12.
- Lỗi đã sửa: kiểm thử hồ sơ trẻ thất bại ngẫu nhiên do tên trùng; ứng dụng phụ huynh và ứng dụng giáo viên hiển thị nhầm dữ liệu của tháng hoặc ngày cũ khi kết quả tải về không theo thứ tự.
- Thay đổi dữ liệu: `service_registrations`, `registration_periods`, `summer_registrations`; cấu hình `service_registration_closing_day`; mã quyền `P05.registration.manage`, `P05.late-registration.approve`.
- Thay đổi API: nhóm điểm cuối đăng ký dịch vụ và học hè; bảng điểm danh ngày hè có dữ liệu.
- Rủi ro: không.
- Khả năng tương thích: ngày kỳ hè có bảng điểm danh cho trẻ đăng ký học hè; chức năng khác không đổi.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5b`; chạy ngược tệp thay đổi cấu trúc 0011 của cơ sở dữ liệu năm học và 0016 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.4 – 2026-10-10

- Phạm vi thay đổi: DT-05 phần 5a, danh mục học phí và tài chính (YCTD-49).
- Chức năng mới: danh mục dịch vụ có bán trú tạo sẵn; biểu phí theo phiên bản; loại miễn giảm; khoản mục thu chi; màn hình MH-04, MH-39.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `services`, `fee_schedules`, `fee_schedule_items`, `discount_types`, `cashflow_categories`; mã quyền `P05.fee-catalog.manage`, `P05.discount-type.manage`, `P06.cashflow-category.manage`.
- Thay đổi API: nhóm điểm cuối dịch vụ, biểu phí, loại miễn giảm, khoản mục thu chi.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-05-phan-5a`; chạy ngược tệp thay đổi cấu trúc 0010 của cơ sở dữ liệu năm học và 0015 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.3 – 2026-10-10

- Phạm vi thay đổi: DT-04 phần 4b, người được ủy quyền đón trẻ và đón trả (YCTD-48).
- Chức năng mới: khai báo, hủy người được ủy quyền trên ứng dụng phụ huynh và cổng quản trị; giáo viên chủ nhiệm bàn giao trẻ kèm ảnh tùy chọn; phụ huynh xác nhận người đón ngoài danh sách; bảo vệ xác nhận người đón tại cổng.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `authorized_pickups`, `pickup_confirmation_requests`, `pickup_records`; tệp mục đích `pickup_photo`; mã quyền `P02.authorized-pickup.manage`, `P04.pickup.gate-confirm`.
- Thay đổi API: nhóm điểm cuối đón trả; `POST /files` nhận ảnh bàn giao.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-04-phan-4b`; chạy ngược tệp thay đổi cấu trúc 0009 của cơ sở dữ liệu năm học và 0014 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.2 – 2026-10-10

- Phạm vi thay đổi: DT-04 phần 4a, điểm danh, chốt ngày, báo vắng (YCTD-47).
- Chức năng mới: bảng điểm danh theo ngày học; lưu chống trùng và lưu tạm khi mất mạng; chốt ngày, sửa sau khi chốt, mở lại; báo vắng nhiều ngày; ứng dụng giáo viên; màn hình báo vắng và điểm danh trong ứng dụng phụ huynh; màn hình Điểm danh trên cổng quản trị.
- Lỗi đã sửa: kiểm thử các tệp chạy song song làm hỏng cấu hình dùng chung (yêu cầu gộp số 14).
- Thay đổi dữ liệu: `attendance_records`, `attendance_days`, `absence_records`; người nhận thông báo theo vai trò; mục cấu hình `school_start_time`; mã quyền `P04.attendance.manage`.
- Thay đổi API: nhóm điểm cuối điểm danh và báo vắng.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-04-phan-4a`; chạy ngược tệp thay đổi cấu trúc 0008 của cơ sở dữ liệu năm học và 0013 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.1 – 2026-10-10

- Phạm vi thay đổi: DT-03 phần 3c, nhập dữ liệu ban đầu và mã định danh ngành (YCTD-46).
- Chức năng mới: tải mẫu Excel; nhập lớp; nhập trẻ kèm phụ huynh vào thẳng trạng thái đang học; nhập mã ngành; bộ lọc và bổ sung giấy khai sinh; màn hình Nhập dữ liệu.
- Lỗi đã sửa: tệp tải lên vượt dung lượng trả lỗi hệ thống thay vì lỗi dữ liệu.
- Thay đổi dữ liệu: bảng `data_import_jobs`; `children.birth_certificate_file_id` cho phép trống; mã quyền `P01.import.children`.
- Thay đổi API: nhóm điểm cuối `/imports`; bộ lọc `missing_birth_certificate`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-03-phan-3c`; chạy ngược tệp thay đổi cấu trúc 0007 của cơ sở dữ liệu năm học và 0012 của cơ sở dữ liệu định danh.

### Phiên bản 0.28.0 – 2026-10-10

- Phạm vi thay đổi: DT-03 phần 3b, hồ sơ trẻ từ lúc tiếp nhận đến khi vào lớp (YCTD-45).
- Chức năng mới: lập hồ sơ trẻ, phụ huynh, sức khỏe cơ bản, cờ trẻ con nhân viên, đồng ý hình ảnh; gửi trình duyệt, duyệt và phân lớp, từ chối; tạo tài khoản phụ huynh khi duyệt; chuyển lớp; xem đầy đủ số định danh có ghi nhật ký; tải giấy khai sinh; màn hình Hồ sơ trẻ.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: mười bảng mới ở cơ sở dữ liệu năm học; mã quyền `P02.child.manage`, `P02.national-id.view`.
- Thay đổi API: nhóm điểm cuối hồ sơ trẻ và tệp; `GET /classes/{id}/children`; `POST /users/guardian-accounts`; danh sách lớp trả thêm `enrolled_count`.
- Rủi ro: hai khóa mã hóa số định danh phải được sao lưu cùng cơ sở dữ liệu; mất khóa thì không giải mã được.
- Khả năng tương thích: không ảnh hưởng chức năng cũ.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-03-phan-3b`; chạy ngược tệp thay đổi cấu trúc 0006 của cơ sở dữ liệu năm học và 0011 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.9 – 2026-10-10

- Phạm vi thay đổi: DT-03 phần 3a, lớp học và phân công giáo viên (YCTD-44).
- Chức năng mới: tạo, sửa, đóng, mở lại lớp; phân công và kết thúc phân công giáo viên chủ nhiệm, bộ môn; lớp của tôi; màn hình Lớp học.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bảng `classes`, `class_staff_assignments`; mã quyền `P02.class.manage`.
- Thay đổi API: `GET`, `POST /classes`; `PATCH /classes/{id}`; `GET`, `POST /classes/{id}/staff-assignments`; `PATCH /classes/{id}/staff-assignments/{assignmentId}`; `GET /users/directory`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-03-phan-3a`; chạy ngược tệp thay đổi cấu trúc 0005 của cơ sở dữ liệu năm học và 0010 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.8 – 2026-10-10

- Phạm vi thay đổi: DT-02, đăng nhập của phụ huynh (YCTD-43).
- Chức năng mới: mật khẩu mặc định chung của phụ huynh; đăng nhập bằng mã một lần; kích hoạt tài khoản; ứng dụng phụ huynh có màn hình đăng nhập, đặt mật khẩu mới, trang chủ tạm.
- Lỗi đã sửa: ba kênh dùng chung một cookie mã làm mới.
- Thay đổi dữ liệu: `users.password_hash` cho phép để trống; `sessions.login_method`; bảng `one_time_codes`; khóa mới trong `identity_settings`.
- Thay đổi API: thêm `POST /auth/otp/request`, `POST /auth/otp/login`; bỏ `POST /auth/activate`; mở rộng `/auth/settings`, `POST /users`, `refresh`.
- Rủi ro: chưa có nhà cung cấp tin nhắn nên mã một lần chưa gửi được thật.
- Khả năng tương thích: cổng quản trị giữ nguyên cookie và cách làm mới.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-02`; chạy ngược tệp thay đổi cấu trúc 0009 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.7 – 2026-10-10

- Phạm vi thay đổi: DT-01 phần 6b, các danh mục của P01 (YCTD-42).
- Chức năng mới: phòng ban dạng cây, chức danh, danh mục dùng chung, hạn mức phê duyệt theo đơn vị và loại chứng từ, phòng học, bậc học; màn hình MH-33, MH-34, MH-49, MH-50.
- Lỗi đã sửa: tài liệu 08 mục 5 thiếu phiếu đảo phiếu thu và phiếu đảo phiếu chi.
- Thay đổi dữ liệu: sáu bảng danh mục ở cơ sở dữ liệu năm học; mã quyền `P01.department.manage`, `P01.catalog.manage`, `P01.approval-threshold.manage`, `P01.room.manage`.
- Thay đổi API: điểm cuối phòng ban, chức danh, danh mục dùng chung, hạn mức phê duyệt, phòng học, bậc học.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-6b`; chạy ngược tệp thay đổi cấu trúc 0004 của cơ sở dữ liệu năm học và 0008 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.6 – 2026-10-09

- Phạm vi thay đổi: YCTD-41, ngày chốt học phí và ngày chốt công.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bỏ mục cấu hình `attendance_closing_day`; mặc định `tuition_closing_day` là `next_month_first`.
- Thay đổi API: `GET /settings` không còn mục ngày chốt công.
- Rủi ro: không.
- Khả năng tương thích: phần 6a chưa phát hành nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-41 và danh mục cấu hình về phiên bản trước.

### Phiên bản 0.27.5 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 6a, cấu hình theo đơn vị và nhật ký thao tác.
- Chức năng mới: cấu hình theo đơn vị có kế thừa; tra nhật ký thao tác; tự khóa tài khoản lâu không đăng nhập; màn hình Cấu hình, Nhật ký thao tác.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `settings`, `identity_settings`, cột `actor_name` ở hai bảng nhật ký; mã quyền `P01.setting.manage`.
- Thay đổi API: `GET`, `PUT /settings`; `GET /audit-logs`; `GET`, `PUT /auth/settings`; `GET /users/audit-logs`.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-6a`; chạy ngược tệp thay đổi cấu trúc 0003 của cơ sở dữ liệu năm học và 0007 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.4 – 2026-10-09

- Phạm vi thay đổi: YCTD-40, cấu hình theo đơn vị và tự khóa tài khoản.
- Chức năng mới: không.
- Lỗi đã sửa: P01-08 chưa có giá trị mặc định, cách kế thừa và người sửa thống nhất với ma trận quyền.
- Thay đổi dữ liệu: `identity_settings`; mã quyền `P01.setting.manage`.
- Thay đổi API: không.
- Rủi ro: chức năng dùng cấu hình chưa có giá trị phải báo thiếu cấu hình.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-40 về phiên bản trước.

### Phiên bản 0.27.3 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 5, tài khoản, vai trò, quyền.
- Chức năng mới: quản lý tài khoản, mật khẩu tạm, gán và gỡ vai trò, ma trận quyền; màn hình Tài khoản và Vai trò và quyền.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `identity_audit_logs`; mã quyền `P01.account.manage-in-unit`.
- Thay đổi API: nhóm điểm cuối `users`, `roles`, `permissions`; thêm `DELETE /api/v1/users/{id}/roles/{assignmentId}`.
- Rủi ro: dịch vụ định danh gọi máy chủ API để đọc cây đơn vị khi quản lý tài khoản.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-5`; chạy ngược tệp thay đổi cấu trúc 0006 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.2 – 2026-10-09

- Phạm vi thay đổi: YCTD-39, phân quyền quản lý tài khoản.
- Chức năng mới: không.
- Lỗi đã sửa: P01-06 và ma trận quyền chưa thống nhất về VT-15.
- Thay đổi dữ liệu: `identity_audit_logs`; mã quyền `P01.account.manage-in-unit`.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-39 về phiên bản trước.

### Phiên bản 0.27.1 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 4, cây đơn vị hai cấp.
- Chức năng mới: quản lý cây đơn vị, nhật ký thao tác, lớp đơn vị của phân quyền, màn hình Cây đơn vị.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `org_units`, `audit_logs` ở cơ sở dữ liệu năm học; mã quyền `P01.org-unit.manage`.
- Thay đổi API: nhóm điểm cuối `org-units`.
- Rủi ro: không.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-4`; chạy ngược tệp thay đổi cấu trúc 0002 của cơ sở dữ liệu năm học và 0005 của cơ sở dữ liệu định danh.

### Phiên bản 0.27.0 – 2026-10-09

- Phạm vi thay đổi: YCTD-38, cây đơn vị hai cấp.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: `org_units.unit_type` ba giá trị cố định.
- Thay đổi API: không thêm điểm cuối; quy tắc của `org-units` đổi theo cây hai cấp.
- Rủi ro: phạm vi quyền thu hẹp: gán ở Phân hiệu không còn gồm Điểm trường.
- Khả năng tương thích: chưa có mã cây đơn vị nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-38 về phiên bản trước.

### Phiên bản 0.26.6 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 3, năm học.
- Chức năng mới: tạo năm học, lịch năm học, đánh số tuần, tuần nghỉ, mở năm học mới; màn hình Năm học trên cổng quản trị.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bốn bảng mới ở cơ sở dữ liệu hệ thống; mã quyền `P01.academic-year.manage`; cơ sở dữ liệu năm học do máy chủ API tạo.
- Thay đổi API: nhóm điểm cuối `academic-years`; phản hồi `ERR_RULE_VIOLATION` có `rule_code`.
- Rủi ro: mở năm học tạo cơ sở dữ liệu mới; lỗi giữa chừng thì xóa cơ sở dữ liệu vừa tạo và giữ nguyên năm đang dùng.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-3`; chạy ngược tệp thay đổi cấu trúc 0002 của cơ sở dữ liệu hệ thống và 0004 của cơ sở dữ liệu định danh.

### Phiên bản 0.26.5 – 2026-10-09

- Phạm vi thay đổi: YCTD-37, quy tắc mở và đóng năm học.
- Chức năng mới: không.
- Lỗi đã sửa: mâu thuẫn giữa AC-194, CB-10 và BR-89 về trạng thái năm cũ sau khi mở năm mới; `index.md` còn ghi BR-01 đến BR-85 trong khi đã có tới BR-92.
- Thay đổi dữ liệu: `academic_years.status` ba giá trị; mã quyền `P01.academic-year.manage`.
- Thay đổi API: bỏ `POST /api/v1/academic-years/{id}/close`.
- Rủi ro: không.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-37 về phiên bản trước.

### Phiên bản 0.26.4 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 2.
- Chức năng mới: máy chủ API kiểm tra mã phiên và quyền; màn hình đăng nhập, đổi mật khẩu, khung trang của cổng quản trị.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: `login`, `refresh`, `logout` dùng cookie `refresh_token`; mọi điểm cuối của máy chủ API trừ kiểm tra sức khỏe yêu cầu mã phiên.
- Rủi ro: máy chủ API phụ thuộc dịch vụ định danh ở mọi yêu cầu.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-2`.

### Phiên bản 0.26.3 – 2026-10-09

- Phạm vi thay đổi: YCTD-36, thiết kế DT-01 phần 2.
- Chức năng mới: không.
- Lỗi đã sửa: sơ đồ mục 1 của `14` ghi điều hướng ngang trái với BC-01; `14` thiếu màn hình đăng nhập và đổi mật khẩu.
- Thay đổi dữ liệu: không.
- Thay đổi API: mã làm mới chuyển sang cookie httpOnly.
- Rủi ro: không.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-36 về phiên bản trước.

### Phiên bản 0.26.2 – 2026-10-09

- Phạm vi thay đổi: DT-01 phần 1, phần lõi dịch vụ định danh.
- Chức năng mới: đăng nhập bằng mật khẩu, làm mới phiên, đăng xuất, đổi mật khẩu, đọc tài khoản và quyền hiện hành; tạo tài khoản quản trị nền tảng đầu tiên bằng lệnh.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: cơ sở dữ liệu định danh có bảy bảng mới, 19 vai trò và 55 mã quyền.
- Thay đổi API: năm điểm cuối nhóm `auth`; `17` ghi giao kèo chi tiết.
- Rủi ro: không.
- Khả năng tương thích: chưa có bên gọi nên không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của nhánh `dt-01-phan-1`; chạy ngược tệp thay đổi cấu trúc 0003, 0002 của cơ sở dữ liệu định danh.

### Phiên bản 0.26.1 – 2026-10-09

- Phạm vi thay đổi: YCTD-35, chốt giá trị cho dịch vụ định danh.
- Chức năng mới: không.
- Lỗi đã sửa: BM-03, BM-04 chưa có giá trị cụ thể; chưa có quy ước mã quyền.
- Thay đổi dữ liệu: thêm `security_events`, `users.locked_until`.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-35 về phiên bản trước.

### Phiên bản 0.26.0 – 2026-10-09

- Phạm vi thay đổi: YCTD-34, chia lại đợt DT-01 và DT-02; QĐ-20 đến QĐ-22.
- Chức năng mới: không.
- Lỗi đã sửa: DT-01 yêu cầu đăng nhập được trong khi dịch vụ định danh xếp ở đợt sau.
- Thay đổi dữ liệu: tài khoản `api_service` có quyền tạo cơ sở dữ liệu.
- Thay đổi API: không.
- Rủi ro: máy chủ API phụ thuộc dịch vụ định danh ở mọi yêu cầu; dịch vụ định danh dừng thì máy chủ API từ chối yêu cầu.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-34 về phiên bản trước.

### Phiên bản 0.25.5 – 2026-10-09

- Phạm vi thay đổi: hoàn thành đợt DT-00 (M01-3), qua cổng CG-08; mã nguồn gộp vào nhánh `main`.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: ba cơ sở dữ liệu định danh, hệ thống, năm học có tệp thay đổi cấu trúc đầu tiên đặt giờ Việt Nam.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: hoàn lại commit gộp của yêu cầu gộp số 1 trên `main`.

### Phiên bản 0.25.4 – 2026-10-09

- Phạm vi thay đổi: đợt DT-00, thêm điểm cuối kiểm tra sức khỏe.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: thêm `GET /api/v1/health` ở máy chủ API nghiệp vụ và dịch vụ định danh, không cần mã phiên.
- Rủi ro: không.
- Khả năng tương thích: không ảnh hưởng.
- Phương án quay lui: khôi phục `17` về phiên bản 1.7.

### Phiên bản 0.25.3 – 2026-10-09

- Phạm vi thay đổi: YCTD-33, chọn Kysely và quy ước nhánh.
- Chức năng mới: không.
- Lỗi đã sửa: cây thư mục ở `13` thiếu `database/system/`; `packages/shared` ghi chứa hàm dùng chung, trái ranh giới giao diện và máy chủ.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-33 về phiên bản trước.

### Phiên bản 0.25.2 – 2026-10-09

- Phạm vi thay đổi: YCTD-32, chỉ dùng GitHub trước, hạ tầng đám mây khi triển khai.
- Chức năng mới: không.
- Lỗi đã sửa: mã M01-3 trong `03` mang nội dung khác `01`; thứ tự ưu tiên trong `03` còn các việc đã xong và một dòng trùng.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: RR-08 giữ nguyên, nghiệm thu vẫn cần hạ tầng T6.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-32 về phiên bản trước.

### Phiên bản 0.25.1 – 2026-10-09

- Phạm vi thay đổi: YCTD-31, bỏ xác thực hai lớp.
- Chức năng mới: không. Bỏ xác thực hai lớp cho bốn vai trò.
- Lỗi đã sửa: việc N1 ghi chưa bắt đầu dù đã chốt.
- Thay đổi dữ liệu: `one_time_codes.purpose` chỉ còn đăng nhập.
- Thay đổi API: bỏ `/api/v1/auth/verify-otp`.
- Rủi ro: RR-15, chiếm tài khoản vai trò phê duyệt khi lộ mật khẩu.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-31 về phiên bản trước.

### Phiên bản 0.25.0 – 2026-10-09

- Phạm vi thay đổi: YCTD-30, lịch năm học có học kỳ, kỳ hè và tuần học.
- Chức năng mới: lịch năm học trong P01-02; P05-13 Đăng ký học hè.
- Lỗi đã sửa: năm học chỉ có ngày bắt đầu và kết thúc, không có học kỳ, tuần học; số phiếu theo năm tài chính không khớp cơ sở dữ liệu theo năm học.
- Thay đổi dữ liệu: thêm `academic_terms`, `school_weeks`, `summer_registrations`; `academic_years` chuyển sang cơ sở dữ liệu hệ thống.
- Thay đổi API: thêm ba điểm cuối theo YCTD-30.
- Rủi ro: lịch năm học cấu hình sai làm sai số ngày học và học phí; giảm bằng AC-228 đến AC-232.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-30 về phiên bản trước.

### Phiên bản 0.24.1 – 2026-10-09

- Phạm vi thay đổi: N21 đợt 5, thêm `27_BO_CA_KIEM_THU_CHI_TIET/05_P08.md` với 59 ca.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa tệp đợt 5.

### Phiên bản 0.24.0 – 2026-10-09

- Phạm vi thay đổi: YCTD-29, đổi cách chi lương sang trả trước đầu tháng.
- Chức năng mới: bảng quyết toán cuối cùng khi chấm dứt hợp đồng; phiếu thu thu hồi lương.
- Lỗi đã sửa: AC-40 mâu thuẫn AC-115; BR-43 chưa có công thức ngày công.
- Thay đổi dữ liệu: `payroll_periods`, `payslips`, `receipts` thêm cột theo YCTD-29.
- Thay đổi API: thêm `/api/v1/payrolls/settlements`; `/api/v1/payrolls` đổi cách tính.
- Rủi ro: tính sai phần điều chỉnh tháng trước làm sai lương thực nhận; giảm bằng AC-224 đến AC-227 và bộ ca chi tiết P08.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục các tài liệu nêu ở YCTD-29 về phiên bản trước.

### Phiên bản 0.23.3 – 2026-10-09

- Phạm vi thay đổi: N21 đợt 4, thêm `27_BO_CA_KIEM_THU_CHI_TIET/04_P06.md` với 65 ca; YCTD-28.
- Chức năng mới: không.
- Lỗi đã sửa: P06-02 thiếu thủ quỹ trong khi thủ quỹ lập phiếu thu tiền mặt.
- Thay đổi dữ liệu: không.
- Thay đổi API: không đổi đường dẫn.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa tệp đợt 4 và khôi phục các tài liệu nêu ở YCTD-28 về phiên bản trước.

### Phiên bản 0.23.2 – 2026-10-09

- Phạm vi thay đổi: N21 đợt 3, thêm `27_BO_CA_KIEM_THU_CHI_TIET/03_P05.md` với 62 ca; YCTD-27.
- Chức năng mới: không. Bổ sung hành vi đã chốt: ngày bắt đầu học dịch vụ khi đăng ký trễ; chặn tính học phí khi còn ngày chưa chốt điểm danh.
- Lỗi đã sửa: AC-199 chưa nói rõ mốc tính số ngày học còn lại.
- Thay đổi dữ liệu: `service_registrations` thêm `service_start_date`.
- Thay đổi API: không đổi đường dẫn; thêm lỗi khi còn ngày chưa chốt điểm danh.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa tệp đợt 3 và khôi phục các tài liệu nêu ở YCTD-27 về phiên bản trước.

### Phiên bản 0.23.1 – 2026-10-09

- Phạm vi thay đổi: N21 đợt 2, thêm `27_BO_CA_KIEM_THU_CHI_TIET/02_P02_VA_P04.md` với 111 ca.
- Chức năng mới: không.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa tệp đợt 2.

### Phiên bản 0.23.0 – 2026-10-09

- Phạm vi thay đổi: N21 đợt 1, thêm thư mục `27_BO_CA_KIEM_THU_CHI_TIET/`; YCTD-26.
- Chức năng mới: không. Bổ sung hành vi đã chốt: bắt buộc đổi mật khẩu sau khi đặt lại; chặn đóng năm học khi còn nợ của trẻ đã thôi học.
- Lỗi đã sửa: BM-69 và AC-203 chưa phân biệt đăng nhập bằng mật khẩu mặc định và bằng mã một lần.
- Thay đổi dữ liệu: không.
- Thay đổi API: không đổi đường dẫn; thêm lỗi BR-89 khi đóng năm học.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa thư mục 27 và khôi phục các tài liệu nêu ở YCTD-26 về phiên bản trước.

### Phiên bản 0.22.2 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-10; hoàn tất rà duyệt toàn bộ tài liệu, CG-01 đến CG-07 đạt.
- Chức năng mới: không.
- Lỗi đã sửa: QT-10 và P14-02 thiếu Ban Giám hiệu trong bước duyệt; chưa có điểm cuối ẩn hoạt động theo Q-72; thiếu ẩn bình luận, tự ẩn hình khi rút đồng ý, giới hạn ảnh.
- Thay đổi dữ liệu: không.
- Thay đổi API: thêm `/api/v1/activities/{id}/hide`, `/api/v1/activities/{id}/republish`.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-10 phiên bản 1.0, `10_YEU_CAU_CHUC_NANG.md` phiên bản 1.3 và `17_DAC_TA_API.md` phiên bản 1.3.

### Phiên bản 0.22.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-09.
- Chức năng mới: không.
- Lỗi đã sửa: QT-09 còn chữ kích hoạt tài khoản, chưa ghi giai đoạn; ma trận quyền chưa có quyền sửa nhật ký quá hạn của quản lý đơn vị theo Q-67.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-09 phiên bản 1.0 và `08_VAI_TRO_NGUOI_DUNG.md` phiên bản 1.3.

### Phiên bản 0.22.0 – 2026-10-09

- Phạm vi thay đổi: YCTD-25 bổ sung nội dung gửi thuốc và chăm sóc sức khỏe; rà duyệt và phê duyệt QT-07.
- Chức năng mới: P10-12 Theo dõi chăm sóc hằng ngày (giai đoạn 2); giáo viên nhận thuốc khi đơn vị không có y tế; ảnh thuốc; phụ huynh xác nhận đã biết.
- Lỗi đã sửa: QT-07 thiếu Ban Giám hiệu trong tác nhân.
- Thay đổi dữ liệu: thêm bảng `daily_care_logs`; thêm cột ảnh thuốc, người nhận thuốc, xác nhận của phụ huynh.
- Thay đổi API: thêm ba điểm cuối theo YCTD-25.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-07 phiên bản 1.1 và các tài liệu nêu ở YCTD-25 về phiên bản trước.

### Phiên bản 0.21.2 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-06.
- Chức năng mới: không.
- Lỗi đã sửa: QT-06 thiếu tiền làm thêm giờ, người đề nghị mở lại kỳ công, cách áp lịch nghỉ lễ và thứ 7; ba tiêu chí nghiệm thu chép bản cũ.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-06 phiên bản 1.3.

### Phiên bản 0.21.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-05; YCTD-24.
- Chức năng mới: không.
- Lỗi đã sửa: QT-05 có AC-37 trái BR-34; thiếu thủ quỹ, phiếu chi hoàn tiền, trường hợp chưa cấu hình hạn mức; bước đảo phiếu chi lệch bảng trạng thái.
- Thay đổi dữ liệu: không.
- Thay đổi API: thêm hai điểm cuối duyệt và từ chối phiếu đảo phiếu chi.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-05 phiên bản 1.1 và các tài liệu nêu ở YCTD-24 về phiên bản trước.

### Phiên bản 0.21.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-04; YCTD-23.
- Chức năng mới: P05-12 Xử lý công nợ quá hạn (giai đoạn 2); bước duyệt phiếu đảo phiếu thu.
- Lỗi đã sửa: QT-04 lệch danh mục hạn mức và thiếu chức năng cho bước xử lý công nợ; thiếu thủ quỹ và luồng lỗi thanh toán mã QR.
- Thay đổi dữ liệu: thêm bảng `debt_resolutions`; `receipts` thêm `approved_by`, `approved_at`.
- Thay đổi API: thêm bốn điểm cuối theo YCTD-23.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-04 phiên bản 1.2 và các tài liệu nêu ở YCTD-23 về phiên bản trước.

### Phiên bản 0.20.3 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-03.
- Chức năng mới: không.
- Lỗi đã sửa: QT-03 còn ghi đăng ký trễ thành phát sinh kỳ sau, biểu phí theo đơn vị, quản lý đơn vị đề xuất miễn giảm; thiếu kiểm tra bán trú bắt buộc và chặn khi nợ quá hạn.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-03 phiên bản 1.6.

### Phiên bản 0.20.2 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-02.
- Chức năng mới: không.
- Lỗi đã sửa: QT-02 chép thiếu BR-56, thiếu ngày học bù thứ 7; ma trận P04 của VT-03 lệch P04-06.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-02 phiên bản 1.3 và `08_VAI_TRO_NGUOI_DUNG.md` phiên bản 1.0.

### Phiên bản 0.20.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt QT-01.
- Chức năng mới: không.
- Lỗi đã sửa: QT-01 kiểm tra trùng số định danh muộn, chặn phụ huynh nhiều con, còn chữ kích hoạt tài khoản và tham chiếu quy trình không tồn tại.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục QT-01 phiên bản 1.2.

### Phiên bản 0.20.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 01; xếp G1-15 đến G1-19 vào các đợt xây dựng.
- Chức năng mới: không.
- Lỗi đã sửa: kế hoạch còn ghi tài liệu chờ duyệt, ba cấp đơn vị cố định, phạm vi mã cũ, mốc 1.1.0 còn phần chi của tài chính; năm chức năng giai đoạn 1 chưa thuộc đợt nào; RR-07 lệch kế hoạch kiểm thử.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `01_KE_HOACH_TONG_THE.md` phiên bản 0.4.

### Phiên bản 0.19.7 – 2026-10-09

- Phạm vi thay đổi: rà duyệt tài liệu 23; tài liệu giữ trạng thái Đang cập nhật theo quy định của `index.md`.
- Chức năng mới: không.
- Lỗi đã sửa: tiêu đề các mục phiên bản từ 0.4.0 sai cấp; quy ước 2 dùng tên mục khác với các mục phiên bản; `index.md` ghi phạm vi tài liệu 24 đến YCTD-15 trong khi đã có YCTD-22.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: đưa tiêu đề các mục phiên bản về cấp 2.

### Phiên bản 0.19.6 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 22; tài liệu 12 lên phiên bản 1.1 vì SL-01 thiếu cơ sở dữ liệu hệ thống.
- Chức năng mới: không.
- Lỗi đã sửa: BM-17 thiếu Ban Giám hiệu; biện pháp BM-61 đến BM-69 đặt sai mục giám sát; BM-05, BM-19, BM-42 chưa khớp Q-120, BR-73, SL-01 đến SL-04; câu trả lời Q-109, Q-110 chưa vào nội dung.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `22_BAO_MAT.md` phiên bản 0.4.

### Phiên bản 0.19.5 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 21; tài liệu 11 lên phiên bản 1.1.
- Chức năng mới: không. Thêm AC-211 và CT-167 kiểm tra chức năng thu hồi khóa API đã có ở G1-17.
- Lỗi đã sửa: tám ca kiểm thử lệch quy tắc nghiệp vụ hoặc tiêu chí nghiệm thu; AC-194 thiếu yêu cầu giữ nguyên mã định danh; mục chưa xác minh lỗi thời.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `21_KICH_BAN_KIEM_THU.md` phiên bản 0.4 và `11_TIEU_CHI_NGHIEM_THU.md` phiên bản 1.0.

### Phiên bản 0.19.4 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 20.
- Chức năng mới: không.
- Lỗi đã sửa: phạm vi kiểm thử thiếu API đối tác, cơ sở dữ liệu theo năm học, nhập dữ liệu; dữ liệu kiểm thử lệch GD-79 và thiếu trường hợp theo BR-24, BR-58, BR-84, BR-85; câu trả lời Q-101 đến Q-104 chưa vào nội dung.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `20_KE_HOACH_KIEM_THU.md` phiên bản 0.4.

### Phiên bản 0.19.3 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 19.
- Chức năng mới: không.
- Lỗi đã sửa: ngữ cảnh dự án còn ba cấp đơn vị và thiếu cơ sở dữ liệu theo năm học; câu lệnh hệ thống có từ tiếng Anh và thiếu ngoại lệ hạn mức; bảng quy ước mã thiếu tiền tố và có dạng mã không dùng.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `19_CHI_DAN_HE_THONG_AI.md` phiên bản 0.4.

### Phiên bản 0.19.2 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 18.
- Chức năng mới: không.
- Lỗi đã sửa: thiếu quy tắc AI cho cơ sở dữ liệu theo năm học; GD-81 đếm sai số quyết định kiến trúc; tên trạng thái lệch quy trình.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `18_QUY_TAC_PHAT_TRIEN_AI.md` phiên bản 0.4.

### Phiên bản 0.19.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 17.
- Chức năng mới: không.
- Lỗi đã sửa: thiếu điểm cuối cho các bước phê duyệt và chức năng đã duyệt; chưa ghi khóa API do dịch vụ định danh quản lý; cây đơn vị ghi ba cấp; thiếu giới hạn tin nhắn theo Q-96.
- Thay đổi dữ liệu: `one_time_codes.purpose` bỏ giá trị đặt lại mật khẩu.
- Thay đổi API: thêm mười lăm điểm cuối, chuyển một điểm cuối sang nhóm trẻ và lớp.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `17_DAC_TA_API.md` phiên bản 0.4.

### Phiên bản 0.19.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 16, xem `24_YEU_CAU_THAY_DOI.md` YCTD-22.
- Chức năng mới: hóa đơn bổ sung cùng kỳ.
- Lỗi đã sửa: bảng không theo năm học nằm chung cơ sở dữ liệu năm học; thiếu bảng phân công giáo viên, tổ chuyên môn, phiên đăng nhập, mã một lần; mục P11 còn bảng trống.
- Thay đổi dữ liệu: thêm năm bảng và bảy cột; thêm cơ sở dữ liệu hệ thống.
- Thay đổi API: thêm một điểm cuối.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-22 về phiên bản 0.18.1.

### Phiên bản 0.18.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 15.
- Chức năng mới: không.
- Lỗi đã sửa: cỡ chữ nhãn và ghi chú nhỏ hơn mức tối thiểu 14 điểm ảnh (Q-89); nút chính chữ trắng trên nền cam không đủ tương phản; thiếu thành phần cho mã ngành còn trống và số định danh đã che.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `15_HE_THONG_THIET_KE.md` phiên bản 0.4.

### Phiên bản 0.18.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 14, xem `24_YEU_CAU_THAY_DOI.md` YCTD-21.
- Chức năng mới: màn hình MH-44 Cá nhân trên cổng quản trị.
- Lỗi đã sửa: vai trò màn hình chưa theo quyết định mới; BC-01 tự mâu thuẫn; BC-08 lệch mục 6; sơ đồ còn mục xe.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-21 về phiên bản 0.17.2.

### Phiên bản 0.17.2 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 13.
- Chức năng mới: không.
- Lỗi đã sửa: cấu trúc mã nguồn và quy ước chưa tính cơ sở dữ liệu theo năm học và cơ sở dữ liệu định danh riêng; mục chưa xác minh còn điểm đã có câu trả lời.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `13_CONG_NGHE_SU_DUNG.md` phiên bản 0.4.

### Phiên bản 0.17.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 12; chốt QĐ-01, QĐ-03, QĐ-05.
- Chức năng mới: không.
- Lỗi đã sửa: nguyên tắc dùng chung cơ sở dữ liệu giữa định danh và API trái QĐ-15; sơ đồ thiếu đối tác và cơ sở dữ liệu theo năm học; phạm vi đơn vị chưa theo YCTD-18; thiếu tác vụ khóa tài khoản hết hạn và mở năm học.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `12_KIEN_TRUC_HE_THONG.md` phiên bản 0.4.

### Phiên bản 0.17.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 11, xem `24_YEU_CAU_THAY_DOI.md` YCTD-20.
- Chức năng mới: không. Chức năng bỏ: P17-15 Báo cáo ăn tối; dịch vụ ăn sáng và ăn tối.
- Lỗi đã sửa: công thức suất ăn trừ trẻ nghỉ hai lần; AC-29 trái BR-26; AC-147 trái P01-06; tiêu chí còn nhắc kích hoạt tài khoản.
- Thay đổi dữ liệu: gỡ `meal_registrations`; `buffet_registrations` thay bằng `buffet_events`.
- Thay đổi API: gỡ hai điểm cuối, đổi một điểm cuối.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-20 về phiên bản 0.16.0.

### Phiên bản 0.16.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 10, xem `24_YEU_CAU_THAY_DOI.md` YCTD-19.
- Chức năng mới: không. Chức năng đổi giai đoạn: P06-04 Phiếu chi, P06-05 Quỹ tiền mặt sang giai đoạn 1.
- Lỗi đã sửa: quản lý đơn vị tham gia miễn giảm trái Q-134; thiếu bước phê duyệt theo hạn mức ở điều chỉnh hóa đơn và bảng lương; dẫn chiếu quy tắc sai ở ba chức năng; P19-06 còn mã kích hoạt.
- Thay đổi dữ liệu: không.
- Thay đổi API: điểm cuối phiếu chi và sổ quỹ có từ giai đoạn 1.
- Rủi ro: khối lượng giai đoạn 1 tăng.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-19 về phiên bản 0.15.1.

### Phiên bản 0.15.1 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 09.
- Chức năng mới: không.
- Lỗi đã sửa: tài liệu 09 ghi kế toán chốt công, chặn trẻ đi học khi nợ, đăng ký giữa tháng chuyển kỳ sau, gắn nhầm hai luồng phụ kho vào luồng hoạt động, sơ đồ luồng sai một mũi tên.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: khôi phục `09_LUONG_NGHIEP_VU.md` phiên bản 0.4.

### Phiên bản 0.15.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 08, xem `24_YEU_CAU_THAY_DOI.md` YCTD-18.
- Chức năng mới: không.
- Lỗi đã sửa: ma trận quyền thiếu quyền duyệt của quản lý đơn vị, thiếu quyền đăng nhập của cán bộ quản lý cấp trên và kiểm toán viên; kế hoạch tổng thể ghi sai số quy tắc nghiệp vụ.
- Thay đổi dữ liệu: không.
- Thay đổi API: không thêm điểm cuối; cập nhật quyền theo ma trận.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-18 về phiên bản 0.14.0.

### Phiên bản 0.14.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 07, xem `24_YEU_CAU_THAY_DOI.md` YCTD-17.
- Chức năng mới: không.
- Lỗi đã sửa: BR-53 mâu thuẫn ma trận quyền; BR-24 mâu thuẫn Q-134; BR-01 mâu thuẫn quyền Quản trị nền tảng; mục lục ghi sai phiên bản bốn quy trình.
- Thay đổi dữ liệu: không.
- Thay đổi API: thu hẹp quyền phân hệ Y tế và quyền phê duyệt phiếu chi hoàn tiền.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-17 về phiên bản 0.13.0.

### Phiên bản 0.13.0 – 2026-10-09

- Phạm vi thay đổi: rà duyệt và phê duyệt tài liệu 04, 05, 06; bỏ dịch vụ học thứ bảy, xem `24_YEU_CAU_THAY_DOI.md` YCTD-16.
- Chức năng mới: không. Chức năng bỏ: dịch vụ học thứ bảy thu phí theo trẻ.
- Lỗi đã sửa: tài liệu 04, 05, 06 còn ghi ba cấp đơn vị cố định, còn nhắc ứng lương, thiếu chức năng giai đoạn 1 đã gắn ở tài liệu 10, còn mục chưa xác minh đã có câu trả lời; mục lục ghi sai phiên bản QT-03.
- Thay đổi dữ liệu: `saturday_schedules` dùng chung toàn trường.
- Thay đổi API: đổi quyền và mô tả hai điểm cuối.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-16 về phiên bản 0.12.0.

### Phiên bản 0.12.0 – 2026-10-09

- Phạm vi thay đổi: xử lý hết giả định, xem `24_YEU_CAU_THAY_DOI.md` YCTD-15.
- Chức năng mới: P02-12 Nhập mã định danh ngành từ tệp; duyệt đăng ký trễ trong P05-03.
- Lỗi đã sửa: GD-16 mâu thuẫn với QT-06 về người chốt công.
- Thay đổi dữ liệu: mã trẻ theo số định danh và mã ngành; cột dịch vụ bắt buộc và đăng ký trễ.
- Thay đổi API: thêm hai điểm cuối.
- Rủi ro: RR-14 mật khẩu mặc định chung.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-15 về phiên bản 0.11.0.

### Phiên bản 0.11.0 – 2026-10-09

- Phạm vi thay đổi: trả lời toàn bộ câu hỏi mở, xem `24_YEU_CAU_THAY_DOI.md` YCTD-14.
- Chức năng mới: P01-14 Khóa API cho đối tác; P08-12 Tiền làm thêm giờ; mở và đóng năm học kèm chuyển dữ liệu. Chức năng bỏ: P11-01 đến P11-07, P17-09.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: gỡ tám bảng xe đưa đón; thêm ba bảng và ba cột; mỗi năm học một cơ sở dữ liệu.
- Thay đổi API: gỡ mười điểm cuối, thêm tám điểm cuối.
- Rủi ro: RR-13 mỗi năm học một cơ sở dữ liệu; API đối tác đọc dữ liệu cá nhân.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên theo danh sách ở YCTD-14 về phiên bản 0.10.0.

### Phiên bản 0.10.0 – 2026-10-09

- Phạm vi thay đổi: áp dụng câu trả lời lượt 8, xem `24_YEU_CAU_THAY_DOI.md` YCTD-13.
- Chức năng mới: đồng ý hoặc rút đồng ý hình ảnh trên ứng dụng phụ huynh; xem đầy đủ số định danh có ghi nhật ký. Chức năng bỏ: P08-05 Ứng lương.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: gỡ `advance_requests`, `payslips.advance_amount`; thêm `photo_consent_histories` và các cột mới của `children`.
- Thay đổi API: gỡ hai điểm cuối ứng lương, thêm hai điểm cuối hồ sơ trẻ.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-13 về phiên bản 0.9.0.

### Phiên bản 0.9.0 – 2026-10-09

- Phạm vi thay đổi: áp dụng câu trả lời lượt 6 và lượt 7, xem `24_YEU_CAU_THAY_DOI.md` YCTD-12.
- Chức năng mới: P01-13 Nhập dữ liệu ban đầu từ Excel; P06-11 Thanh toán trực tuyến bằng mã QR.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: thêm `data_import_jobs`, `online_payment_transactions`; bỏ trạng thái thu một phần của hóa đơn.
- Thay đổi API: thêm tám điểm cuối.
- Rủi ro: thanh toán bằng mã QR và tin nhắn phụ thuộc nhà cung cấp chưa chọn (Q-142, T1, T5).
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-12 về phiên bản 0.8.0.

### Phiên bản 0.8.0 – 2026-10-09

- Phạm vi thay đổi: áp dụng câu trả lời lượt 4 và lượt 5, xem `24_YEU_CAU_THAY_DOI.md` YCTD-11.
- Chức năng mới: phụ huynh đăng nhập bằng mã một lần (mở rộng P19-06); cờ chặn đăng ký dịch vụ khi nợ quá hạn (mở rộng P01-08).
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: bỏ cột `session` của `attendance_records`, `absence_records`.
- Thay đổi API: thêm hai điểm cuối mã một lần; điểm danh không còn tham số buổi.
- Rủi ro: đăng nhập bằng mã một lần phụ thuộc nhà cung cấp tin nhắn chưa chọn (T1).
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-11 về phiên bản 0.7.0.

### Phiên bản 0.7.0 – 2026-10-09

- Phạm vi thay đổi: áp dụng câu trả lời lượt 3, xem `24_YEU_CAU_THAY_DOI.md` YCTD-10.
- Chức năng mới: P05-11 Danh mục loại miễn giảm; P08-11 Danh mục khấu trừ và quy định số ngày phép năm.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: thêm `discount_types`, `leave_policies`; `discounts.discount_type_id`.
- Thay đổi API: thêm hai điểm cuối.
- Rủi ro: số hiệu văn bản chế độ kế toán hành chính, sự nghiệp cần kế toán trưởng kiểm tra lại.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-10 về phiên bản 0.6.0.

### Phiên bản 0.6.0 – 2026-10-09

- Phạm vi thay đổi: chốt các quyết định ưu tiên, xem `24_YEU_CAU_THAY_DOI.md` YCTD-09.
- Chức năng mới: không. Sổ kế toán kép (G3-06) được đưa chính thức vào phạm vi giai đoạn 3.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: biểu phí dùng chung toàn trường.
- Thay đổi API: không.
- Rủi ro: chế độ kế toán chưa xác định (Q-140); mức miễn giảm chưa có (Q-16).
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-09 về phiên bản 0.5.3.

### Phiên bản 0.5.3 – 2026-10-09

- Phạm vi thay đổi: trả lời Q-139, xác nhận GD-86, xem `24_YEU_CAU_THAY_DOI.md` YCTD-08.
- Chức năng mới: không. Sửa đặc tả P14-11.
- Lỗi đã sửa: không.
- Thay đổi dữ liệu: không.
- Thay đổi API: không.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên P14-11, GD-86, Q-139 về phiên bản 0.5.2; xóa AC-175, CT-131.

### Phiên bản 0.5.2 – 2026-10-09

- Phạm vi thay đổi: bổ sung điểm cuối cho phân hệ Giảng dạy, xem `24_YEU_CAU_THAY_DOI.md` YCTD-07.
- Chức năng mới: không.
- Lỗi đã sửa: `17_DAC_TA_API.md` thiếu nhóm điểm cuối P03; chức năng P03-07 thiếu bảng dữ liệu.
- Thay đổi dữ liệu: thêm bảng `class_activity_schedules`.
- Thay đổi API: thêm mười tám điểm cuối ở mục 7; các mục sau đánh số lại từ 8 đến 21.
- Rủi ro: không.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa mục 7 của `17_DAC_TA_API.md`, đánh số lại các mục, xóa bảng `class_activity_schedules`.

### Phiên bản 0.5.1 – 2026-10-09

- Phạm vi thay đổi: áp dụng câu trả lời Q-136 đến Q-138, xem `24_YEU_CAU_THAY_DOI.md` YCTD-06.
- Chức năng mới: không. Sửa đặc tả P08-10, P10-11, P14-10, P14-11.
- Lỗi đã sửa: `01_KE_HOACH_TONG_THE.md` mục 13 còn ghi 84 giả định.
- Thay đổi dữ liệu: `saturday_schedules` theo đơn vị; thêm `fee_type`, `effective_from`, `effective_to`; đổi `health_standards.source` thành `source_document`.
- Thay đổi API: không đổi đường dẫn.
- Rủi ro: Q-139 chưa trả lời; GD-86 chưa xác nhận.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: hoàn nguyên các dòng liệt kê ở YCTD-06 về nội dung của phiên bản 0.5.0.

### Phiên bản 0.5.0 – 2026-10-09

- Phạm vi thay đổi: bổ sung hai mươi chức năng theo tám ảnh sơ đồ chức năng, xem `24_YEU_CAU_THAY_DOI.md` YCTD-05.
- Chức năng mới: P01-11, P01-12, P02-11, P03-08, P06-10, P08-09, P08-10, P10-09 đến P10-11, P12-08, P12-09, P13-10, P14-10 đến P14-12, P16-05, P17-13 đến P17-15.
- Lỗi đã sửa: số chức năng ghi nhầm 106 (thực tế 141 trước bổ sung); số bảng dữ liệu ghi nhầm 92 (thực tế 134 trước bổ sung); trả lời Q-06, Q-28, Q-29.
- Thay đổi dữ liệu: thêm mười chín bảng và sáu cột, xem YCTD-05.
- Thay đổi API: thêm hai mươi hai điểm cuối.
- Rủi ro: ba câu hỏi mới Q-136 đến Q-138; giai đoạn của các chức năng mới là đề xuất.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng.
- Phương án quay lui: xóa các dòng chức năng, tiêu chí, ca kiểm thử, bảng, điểm cuối và màn hình liệt kê ở YCTD-05.

### Phiên bản 0.4.0 – 2026-10-09

- Phạm vi thay đổi: chuyển bộ tài liệu sang cấu trúc Vibecoding_Flow; sửa các chỗ chưa khớp; thống nhất phân cấp phê duyệt; đổi mã dự án thành SM. Chi tiết ở `24_YEU_CAU_THAY_DOI.md` YCTD-01 đến YCTD-04.
- Chức năng mới: không áp dụng.
- Lỗi đã sửa: sơ đồ trong `09_LUONG_NGHIEP_VU.md` và các đặc tả QT-01, QT-03, QT-04, QT-05, QT-08, QT-09, QT-10 còn thuật ngữ cũ "cơ sở" và "Chủ trường"; `01_KE_HOACH_TONG_THE.md` và `03_DANH_SACH_CONG_VIEC.md` còn số câu hỏi mở và giả định cũ; mốc 0.3.0 còn ghi Đang soạn; `13_CONG_NGHE_SU_DUNG.md` ghi bốn ứng dụng giao diện nhưng liệt kê ba; `11_TIEU_CHI_NGHIEM_THU.md` không trỏ tới AC-94 đến AC-134; mâu thuẫn người phê duyệt phiếu chi, miễn giảm, phiếu đảo và bảng lương.
- Thay đổi dữ liệu: bảng `fiscal_periods` thêm `close_requested_by`, `close_requested_at`. Mã trẻ sinh theo dạng `SM-<mã đơn vị>-<số thứ tự>`.
- Thay đổi API: thêm `POST /api/v1/fiscal-periods/{id}/request-close`. Các điểm cuối phê duyệt chứng từ phải từ chối vai trò kế toán, kế toán trưởng và quản lý đơn vị.
- Rủi ro: việc xem "hình tổ màu" là "hình tô màu" ở P14-09 vẫn chưa được xác nhận (Q-06). Ba câu hỏi Q-133 đến Q-135 phát sinh và đã được trả lời trong cùng phiên bản.
- Khả năng tương thích: chưa có mã nguồn nên không ảnh hưởng. Mục lịch sử trong `02_NHAT_KY_DU_AN.md` và tệp này giữ nguyên tên tệp cũ.
- Phương án quay lui: đổi tên ngược theo bảng đối chiếu ở YCTD-01; hoàn nguyên QT-03 đến QT-06 về phiên bản 1.0; hoàn nguyên VT-03 và VT-05 về quyền phê duyệt.

### 0.3.1 - 2026-10-09

| Mục | Nội dung |
|---|---|
| Phạm vi thay đổi | Đổi tên dự án từ Sun KinderGarten thành School Management theo yêu cầu của Eric, để khớp với tên thư mục gốc `D:\School_Management` |
| Chức năng mới | Không áp dụng |
| Lỗi đã sửa | Không áp dụng. Đây là thay đổi cách gọi tên, không phải sửa lỗi |
| Thay đổi dữ liệu | Không áp dụng. Không có bảng, cột hay ràng buộc nào bị đổi |
| Thay đổi giao diện lập trình | Không áp dụng. Không có điểm cuối nào bị đổi |
| Rủi ro | Mã dự án vẫn là `SKG`, vốn là chữ viết tắt của tên cũ, nay không còn khớp tên mới; đã ghi thành `Q-132`. Mã này còn dùng trong quy tắc sinh mã trẻ tại `GD-20` của `QT-01`, nên nếu đổi mã thì phải sửa cả quy tắc đó |
| Khả năng tương thích | Không ảnh hưởng nội dung nghiệp vụ, lược đồ dữ liệu hay giao diện lập trình. Hai mục nhật ký cũ còn nhắc tên cũ được giữ nguyên vì nhật ký chỉ ghi thêm. Các mã đã cấp không bị tái sử dụng |
| Phương án quay lui | Thay ngược "School Management" về "Sun KinderGarten" trên cùng 36 tệp; hoàn nguyên `index.md`, `01_Tong_quan_du_an.md`, `Checklist_cong_viec.md` và `Nhat_ky_du_an.md` về trạng thái phiên bản 0.3.0 |

Nội dung đã cập nhật trong phiên bản này:

| Nhóm | Tệp |
|---|---|
| Phân tích nghiệp vụ | `01_Tong_quan_du_an.md` đến `08_Tieu_chi_nghiem_thu.md` |
| Thiết kế | `09_Kien_truc_he_thong.md` đến `14_Dac_ta_API.md`, `21_Ke_hoach_tong_the_du_an.md` |
| Quy tắc và vận hành | `15_Quy_tac_phat_trien_AI.md` đến `20_Lich_su_thay_doi.md` |
| Quy trình nghiệp vụ | `Quy_trinh_nghiep_vu/index.md`, `Phieu_yeu_cau.md` và `QT-01` đến `QT-10` |
| Quản lý | `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md` |

### 0.3.0 - 2026-10-09

| Mục | Nội dung |
|---|---|
| Phạm vi thay đổi | Lập kế hoạch tổng thể dự án theo yêu cầu của Eric: mười hai giai đoạn kèm cổng kiểm soát, sáu mốc phát hành, mười hai đợt xây dựng, đường găng, ma trận trách nhiệm, ngưỡng phê duyệt thay đổi và mười hai rủi ro |
| Chức năng mới | Không áp dụng. Đây là tài liệu kế hoạch, không sinh chức năng phần mềm |
| Lỗi đã sửa | Sửa số giả định trong `index.md` từ 80 lên 83 vì `GD-81` trong `15_Quy_tac_phat_trien_AI.md` trước đây chưa được đếm |
| Thay đổi dữ liệu | Không áp dụng. Không có bảng, cột hay ràng buộc nào bị đổi |
| Thay đổi giao diện lập trình | Không áp dụng. Không có điểm cuối nào bị đổi |
| Rủi ro | Kế hoạch chưa có mốc thời gian nên khó đo tiến độ, ghi tại `RR-12`; ba việc `M05`, `M06`, `M08` đang tạm dừng và nằm trên đường găng; kế hoạch là đề xuất, chưa được Eric phê duyệt, ghi tại `GD-82` |
| Khả năng tương thích | Không ảnh hưởng tài liệu `01` đến `20`; chỉ thêm một tài liệu mới, hai quy tắc phát triển mới và ba tiền tố mã mới. Các mã đã cấp không bị tái sử dụng |
| Phương án quay lui | Xóa `21_Ke_hoach_tong_the_du_an.md`, hoàn nguyên `index.md`, `15_Quy_tac_phat_trien_AI.md`, `16_Cau_lenh_he_thong_AI.md`, `Checklist_cong_viec.md` và `Nhat_ky_du_an.md` về trạng thái phiên bản 0.2.0 |

Nội dung đã cập nhật trong phiên bản này:

| Nhóm | Tệp |
|---|---|
| Kế hoạch | `21_Ke_hoach_tong_the_du_an.md` (tạo mới) |
| Quy tắc và vận hành | `15_Quy_tac_phat_trien_AI.md`, `16_Cau_lenh_he_thong_AI.md` |
| Quản lý | `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md` |

### 0.2.0 - 2026-10-09

| Mục | Nội dung |
|---|---|
| Phạm vi thay đổi | Cập nhật bộ tài liệu thiết kế theo bốn yêu cầu của Eric ngày 09/10/2026: đổi vai trò Chủ trường thành Ban Giám hiệu, chuyển mô hình một cấp sang ba cấp đơn vị, tách tầng giao diện khỏi tầng máy chủ, tách dịch vụ định danh |
| Chức năng mới | Quản lý cây đơn vị ba cấp (P01-01); cấu hình hạn mức phê duyệt (P01-10); màn hình cây đơn vị (MH-32); màn hình hạn mức phê duyệt (MH-33) |
| Lỗi đã sửa | Sửa mâu thuẫn giữa BR-01, BR-02 và GD-05 về cấp đơn vị; sửa cách gọi vai trò Ban Giám hiệu thành hai vai trò riêng |
| Thay đổi dữ liệu | Bảng `branches` đổi thành `org_units` kèm `unit_type` và `parent_id` tự tham chiếu; cột `branch_id` đổi thành `org_unit_id`; thêm khái niệm hạn mức phê duyệt theo đơn vị và loại chứng từ |
| Thay đổi giao diện lập trình | `/api/v1/branches` đổi thành `/api/v1/org-units`; thêm `/api/v1/org-units/tree` và `/api/v1/approval-thresholds`; `/api/v1/children/{id}/transfer-branch` đổi thành `/api/v1/children/{id}/transfer-unit`; `/api/v1/dashboard/owner` đổi thành `/api/v1/dashboard/leadership`; `/api/v1/dashboard/branch` đổi thành `/api/v1/dashboard/unit` |
| Rủi ro | Việc đổi thuật ngữ "cơ sở" thành "đơn vị" ảnh hưởng toàn bộ bộ tài liệu, cần rà soát lại khi có mã nguồn; mức hạn mức phê duyệt chưa có nên chưa kiểm thử được; số cấp đơn vị thật chưa xác nhận |
| Khả năng tương thích | Bộ tài liệu chưa có mã nguồn nên không có vấn đề tương thích; các mã đã cấp không bị tái sử dụng |
| Phương án quay lui | Giữ nguyên phiên bản 0.1.0 trong lịch sử; nếu cần, khôi phục theo mục 0.1.0 |

Nội dung đã cập nhật trong phiên bản này:

| Nhóm | Tệp |
|---|---|
| Phân tích nghiệp vụ | `01_Tong_quan_du_an.md` đến `08_Tieu_chi_nghiem_thu.md` |
| Thiết kế | `09_Kien_truc_he_thong.md`, `10_Cong_nghe_su_dung.md`, `11_Dac_ta_giao_dien.md`, `13_Luoc_do_co_so_du_lieu.md`, `14_Dac_ta_API.md` |
| Quy tắc và vận hành | `16_Cau_lenh_he_thong_AI.md`, `17_Ke_hoach_kiem_thu.md`, `18_Ca_kiem_thu.md`, `19_Bao_mat.md` |
| Quy trình nghiệp vụ | `QT-01` đến `QT-10` |
| Quản lý | `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md` |

### 0.1.0 - 2026-10-09

| Mục | Nội dung |
|---|---|
| Phạm vi thay đổi | Khởi tạo bộ tài liệu thiết kế, chưa có mã nguồn |
| Chức năng mới | Không áp dụng |
| Lỗi đã sửa | Không áp dụng |
| Thay đổi dữ liệu | Không áp dụng |
| Thay đổi giao diện lập trình | Không áp dụng |
| Rủi ro | Bộ tài liệu dựa trên danh sách tính năng và bốn ảnh sơ đồ chức năng, chưa có nghiệp vụ thật để đối chiếu; nhiều giả định và câu hỏi mở chưa được trả lời |
| Khả năng tương thích | Không áp dụng, đây là bản khởi tạo |
| Phương án quay lui | Không áp dụng |

Nội dung đã tạo trong phiên bản này:

| Nhóm | Tệp |
|---|---|
| Quản lý | `index.md`, `Nhat_ky_du_an.md`, `Checklist_cong_viec.md` |
| Phân tích nghiệp vụ | `01_Tong_quan_du_an.md` đến `08_Tieu_chi_nghiem_thu.md` |
| Thiết kế | `09_Kien_truc_he_thong.md` đến `14_Dac_ta_API.md` |
| Quy tắc và vận hành | `15_Quy_tac_phat_trien_AI.md` đến `20_Lich_su_thay_doi.md` |
| Quy trình nghiệp vụ | `Quy_trinh_nghiep_vu/QT-01` đến `QT-10` và `Quy_trinh_nghiep_vu/index.md` |

## 3. Chưa xác minh được

Không áp dụng. Tài liệu này ghi lịch sử thay đổi, không mô tả hiện trạng hệ thống.

## 4. Giả định và câu hỏi mở

| Mã | Nội dung | Cần ai trả lời |
|---|---|---|
| GD-60 | Đã xác nhận ngày 09/10/2026 (theo ghi nhận lịch sử): Phiên bản 0.1.0 đánh dấu mốc khởi tạo tài liệu, chưa phải phiên bản phần mềm | Eric |
| GD-80 | Đã xác nhận ngày 09/10/2026 (theo ghi nhận lịch sử): Phiên bản 0.2.0 ghi nhận bốn thay đổi kiến trúc và mô hình tổ chức đã được Eric chốt ngày 09/10/2026 | Eric |
| GD-82 | Đã xác nhận ngày 09/10/2026 (theo Q-07): Kế hoạch tổng thể là đề xuất, thứ tự đợt và cách xếp giai đoạn có thể đổi sau khi Eric xác nhận | Eric |
| GD-83 | Đã xác nhận ngày 09/10/2026 (theo Q-128): Kế hoạch dùng thứ tự và điều kiện vào, điều kiện ra thay cho hạn ngày | Eric |
| Q-111 | Đã trả lời ngày 09/10/2026: phiên bản 1.0 gồm các phân hệ của giai đoạn 1 theo `05_PHAM_VI.md` mục 4, đã xác nhận tại Q-07 | Eric |
| Q-127 | Đã trả lời ngày 09/10/2026: không tách bản 0.2.0 thành bản phát hành riêng | Eric |
| Q-128 | Đã trả lời ngày 09/10/2026: giữ cách dùng điều kiện vào, điều kiện ra, không đặt mốc ngày | Eric |
| Q-129 | Đã trả lời ngày 09/10/2026: Eric duyệt mọi cổng; Hiệu trưởng cùng nghiệm thu nghiệp vụ; kế toán trưởng cùng nghiệm thu phân hệ học phí, tài chính, lương | Eric |
| Q-130 | Đã trả lời ngày 09/10/2026: dùng Git trên GitHub, kho riêng; dựng tích hợp và triển khai tự động ngay từ đợt DT-00 | Eric |
| Q-132 | Đã trả lời ngày 09/10/2026: mã dự án đổi thành SM | Eric |
