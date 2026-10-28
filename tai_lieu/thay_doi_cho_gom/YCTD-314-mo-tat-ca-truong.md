---
yctd: YCTD-314
tieu_de: Mở mọi trường trong danh mục, quản trị nền tảng vào thẳng, gói cơ bản miễn phí
ngay: 2026-10-28
phien_ban_de_xuat: 0.190.0
---

## 02 Nhật ký

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

- Xem `24_YEU_CAU_THAY_DOI.md` YCTD-314, `23_LICH_SU_PHIEN_BAN.md` {PHIEN_BAN}.

#### Vấn đề tồn đọng

- Tính phí theo tin của tính năng `sms-zalo` ở phần thu phí (S5b) chưa làm; số tin đã gửi có ở `notification_recipients`.
- Bước setup của S2 vẫn tạo quản trị viên đầu tiên theo tên đăng nhập, chưa bắt số CCCD, điện thoại (GD-163 chỉ áp ở dịch vụ tài khoản).
- Luật sư rà ghi chú PL-02 Điều 5a sau khi bỏ ghi mục đích theo từng lần vào (GD-159).
- Bản nhiều trường đang chạy trên máy cần dựng lại (`pnpm build`), chạy tệp thay đổi cấu trúc nền tảng 0242 và khởi động lại để có gói miễn phí và tự khởi tạo (`scripts/chay-nhieu-truong.mjs` suy `PLATFORM_ADMIN_DATABASE_URL` từ `POSTGRES_PASSWORD`).

## 24 Yêu cầu thay đổi

### YCTD-314: Mở mọi trường trong danh mục, quản trị nền tảng vào thẳng, gói cơ bản miễn phí – 2026-10-28

- Lý do: Eric yêu cầu ngày 2026-10-28: "mặc định cấp quyền admin cho tất cả trường học. không giới hạn, không thông báo 'Đơn vị này chưa sử dụng hệ thống trên nền tảng…'. Mở tất cả trường học. Cho phép sử dụng miễn phí 1 số tính năng."
- Nội dung thay đổi: Tài khoản Admin vào mọi trường bằng một lần bấm (không lý do, không nhập lại mã hai lớp, không giới hạn giờ; vẫn ghi nhật ký hai phía); mọi đơn vị trong danh mục mở được, trường khởi tạo ở lần mở đầu tiên (an toàn khi mở cùng lúc, trạng thái "đang khởi tạo"); gói cơ bản miễn phí cho trường tự khởi tạo, tính năng trả phí (trợ lý AI, thi trực tuyến, học trực tuyến và lớp trực tiếp, gia sư, báo cáo nâng cao, tin nhắn SMS, Zalo) tắt mặc định, nền tảng bật riêng từng trường, máy chủ API chặn và giao diện báo "tính năng trả phí, liên hệ hỗ trợ". Tài khoản quản trị trường luôn đủ số CCCD, họ tên, số điện thoại. Trường demo `tc-demo` không gán gói nên giữ mọi tính năng.
- Thành phần bị ảnh hưởng: `database/platform/migrations/0242_add_free_plan_and_addon_modules.ts`, `database/platform/schema.ts`, `database/src/catalog-provisioning.ts`, `database/src/school-lifecycle.ts`, `database/src/school-plans.ts`, `packages/shared/src/plan-modules.ts`, `apps/identity/src/directory/unit-directory.ts`, `apps/identity/src/platform/catalog-provisioning.ts`, `apps/identity/src/platform/platform-catalog.ts`, `apps/identity/src/platform/platform-schools.ts`, `apps/identity/src/platform/support-sessions.ts`, `apps/identity/src/tenancy-route-policy.ts`, `apps/api/src/authentication/authentication.guard.ts`, bộ điều khiển trợ lý AI, học trực tuyến, thi trực tuyến, gia sư ở `apps/api/src`, `apps/portal/src/pages/LoginPage.tsx`, `apps/portal/src/pages/AppShell.tsx`, `apps/portal/src/school-plan/school-plan.tsx`, `apps/platform/src/OpenSchoolButton.tsx`, `apps/platform/src/CatalogPage.tsx`, `apps/platform/src/SchoolsPage.tsx`, `apps/platform/src/SupportPanel.tsx`, `tests/e2e/160-unit-directory-login.spec.ts`, `tests/e2e/136-platform-dashboard.spec.ts`, `scripts/chay-nhieu-truong.mjs`, `32_KE_HOACH_THEO_HE_THONG_SO.md` mục 16.9 đến 16.11, `01_KE_HOACH_TONG_THE.md` GD-110, `33_HO_SO_PHAP_LY/02_THOA_THUAN_XU_LY_DU_LIEU.md`.
- Trạng thái: Đã triển khai

## 23 Lịch sử phiên bản

### Phiên bản {PHIEN_BAN} – 2026-10-28

- Phạm vi thay đổi: mở mọi trường trong danh mục (khởi tạo ở lần mở đầu tiên), quản trị nền tảng vào thẳng mọi trường, gói cơ bản miễn phí và tính năng trả phí bật riêng từng trường (YCTD-314).
- Cơ sở dữ liệu nền tảng: tệp thay đổi cấu trúc 0242 (gói `co-ban-mien-phi`, `schools.addon_modules`).

## 01 Bảng phiên bản

| {PHIEN_BAN} | Mở mọi trường, quản trị nền tảng vào thẳng, gói cơ bản miễn phí | YCTD-314 |

## Thêm dòng

| 32_KE_HOACH_THEO_HE_THONG_SO.md | GD-112 | GD-159 | Quản trị nền tảng vào mọi trường không hỏi (sửa GD-110) | **Eric đã chốt 2026-10-28:** tài khoản Admin (vai trò `quan_tri`) vào thẳng mọi trường bằng một lần bấm, không hỏi mục đích, không nhập lại mã hai lớp, không giới hạn giờ (hạn kỹ thuật 30 ngày); giữ mã hai lớp lúc đăng nhập cổng vận hành, nhật ký hai phía, biểu ngữ; vai trò khác giữ GD-110 | `platform_settings.support_access_policy`, vai trò vận hành | Eric (đã chốt), luật sư |
| 32_KE_HOACH_THEO_HE_THONG_SO.md | GD-112 | GD-160 | Mở mọi đơn vị trong danh mục | **Eric đã chốt 2026-10-28:** không báo "chưa sử dụng hệ thống"; trường khởi tạo ở lần mở đầu tiên (Admin ở cổng vận hành hoặc trang đăng nhập), không dựng sẵn cả danh mục; tối đa 60 trường tự khởi tạo mỗi giờ (Claude chọn) | Không | Eric (đã chốt) |
| 32_KE_HOACH_THEO_HE_THONG_SO.md | GD-112 | GD-162 | Sổ liên lạc và tin nhắn SMS, Zalo | **Eric đã chốt 2026-10-28:** sổ liên lạc điện tử (tin trong ứng dụng, thông báo điểm, điểm danh, đẩy) miễn phí trong gói cơ bản; tin nhắn SMS, Zalo là tính năng trả phí riêng `sms-zalo`, tính theo tin cho trường (không thu phụ huynh), tắt mặc định với trường tự khởi tạo, bật riêng từng trường; không có thì thông báo chỉ qua ứng dụng, đẩy | Gói dịch vụ, `schools.addon_modules` | Eric (đã chốt) |
| 32_KE_HOACH_THEO_HE_THONG_SO.md | GD-112 | GD-163 | Tài khoản quản trị trường | **Eric đã chốt 2026-10-28:** tài khoản quản trị trường luôn đủ số CCCD, họ tên, số điện thoại; kiểm ở máy chủ khi tạo tài khoản và gán vai trò | Không | Eric (đã chốt) |
| 32_KE_HOACH_THEO_HE_THONG_SO.md | GD-112 | GD-161 | Gói cơ bản miễn phí, tính năng trả phí | **Eric đã chốt 2026-10-28:** miễn phí hồ sơ trường, cán bộ, lớp, học sinh, điểm danh, sổ liên lạc, thông báo, văn bản; trả phí trợ lý AI, thi trực tuyến, học trực tuyến và lớp trực tiếp, gia sư, báo cáo nâng cao, tắt mặc định với trường tự khởi tạo, nền tảng bật riêng từng trường. Phân hệ khác để miễn phí cho tới khi Eric chốt (Claude chọn) | Gói `co-ban-mien-phi`, `schools.addon_modules` | Eric (đã chốt phần đã nêu) |
| 01_KE_HOACH_TONG_THE.md | GD-140 đến GD-157 | GD-159 đến GD-163 | Eric đã chốt ngày 2026-10-28 (YCTD-314): Admin vào mọi trường không hỏi, vẫn ghi nhật ký (sửa GD-110); mở mọi đơn vị, khởi tạo trường ở lần mở đầu tiên; gói cơ bản miễn phí, tính năng trả phí bật riêng từng trường; sổ liên lạc điện tử miễn phí, SMS, Zalo trả phí theo tin; tài khoản quản trị trường đủ số CCCD, họ tên, số điện thoại | Eric (đã chốt) |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1531 | P19-06 | Hai lần mở đầu cùng lúc một đơn vị chưa có trường; chạy khởi tạo | một trường, một việc, chỉ một bên nhận; trường hoạt động không hạn, tên miền `dv-<mã Bộ>`, gói miễn phí, ba cơ sở dữ liệu, chưa có tài khoản; tính năng bật riêng cộng vào gói | Kiểm thử tự động `database/src/catalog-provisioning.test.ts` CT-314-1 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1532 | P19-06 | Việc khởi tạo đang chạy, bỏ dở quá 10 phút, lỗi | đang chạy không nhận hai lần; bỏ dở, lỗi thì nhận lại và chạy xong | Kiểm thử tự động CT-314-2 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1533 | P19-06 | Mã không có trong danh mục; vượt số trường tự khởi tạo mỗi giờ | không tìm thấy; từ chối, không tạo trường | Kiểm thử tự động CT-314-3 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1534 | P01-06 | Trang đăng nhập chọn đơn vị chưa có trường, gọi khởi tạo hai lần cùng lúc | không báo "chưa sử dụng"; một trường; sẵn sàng thì có tên miền đăng nhập, mã xác nhận của trường mới; ngoài tên miền chung 404 | Kiểm thử tự động `apps/identity/src/platform/catalog-open.test.ts` CT-314-4 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1535 | P19-06 | Admin bấm "Khởi tạo và vào trường" ở danh mục; vào lại ở trang chi tiết trường; nhân viên kỹ thuật thử vào | đang khởi tạo rồi vào thẳng, toàn quyền, hạn 30 ngày, không hỏi lý do, mã hai lớp; nhật ký `support.platform-admin-entry` và `support_start`; tài khoản quản trị thiếu số CCCD, điện thoại thì 400; Admin tạo tài khoản quản trị đầu tiên đủ số CCCD, họ tên, điện thoại, đăng nhập lần đầu bắt đổi mật khẩu; kỹ thuật bị 403 ở nút vào thẳng, 422 khi thiếu mã hai lớp | Kiểm thử tự động CT-314-5 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1536 | P19-06 | Bật tính năng trả phí riêng cho trường (quản trị, kế toán, kỹ thuật, mã sai) | quản trị, kế toán bật được, ghi nhật ký, ngữ cảnh trường có tính năng; kỹ thuật 403; mã sai 400 | Kiểm thử tự động CT-314-6 đạt ngày 28/10/2026 | Đạt |
| 21_KICH_BAN_KIEM_THU.md | cuối bảng 15. Ca kiểm thử chức năng bổ sung | CT-1537 | P19-06 | Trường gói cơ bản miễn phí gọi trợ lý AI, học trực tuyến, văn bản đi; bật riêng trợ lý AI | AI, học trực tuyến 403 `MODULE_NOT_IN_PLAN` kèm lời báo tính năng trả phí; văn bản đi dùng được; trường không gán gói không bị chặn; bật riêng thì AI hết chặn, học trực tuyến vẫn chặn | Kiểm thử tự động `apps/api/src/school-plan/school-plan.test.ts` CT-314-7 đạt ngày 28/10/2026 | Đạt |

## Nối dòng

| index.md | Màn hình dự kiến | YCTD-314: trạng thái "đang khởi tạo" ở MH-47, lời báo tính năng trả phí ở khung cổng quản trị, mục tính năng trả phí ở trang chi tiết trường của cổng vận hành |
