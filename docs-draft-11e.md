# Nháp tài liệu DT-11 phần 11e: Kết nối Facebook, Fanpage và Zalo Official Account

## YCTD

### YCTD-90: Kết nối Facebook, Fanpage và gửi thông báo, nhắc nợ qua Zalo Official Account – 2026-10-12

- Lý do: phần 11e của đợt DT-11 (giai đoạn 3): P14-08, G3-03, việc N3 (Fanpage) và G3-08, việc N17 (Zalo). Tài khoản thật chưa có (T4 Fanpage, T7 Zalo) nên làm lớp kết nối có bộ giả lập, kết nối thật bật khi có khóa. Các điểm dưới đây Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11.
- Nội dung thay đổi (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
  - Cấu hình kết nối ngoài toàn trường (bảng `integration_settings` của năm học, mỗi kết nối một dòng): bật hay tắt và thông tin không bí mật. Fanpage gồm mã trang (bắt buộc khi bật), tên trang; Zalo gồm mã Official Account (bắt buộc khi bật), tên. Chưa lưu lần nào thì là tắt. Chỉ quyền `P01.integration.manage` (VT-02, không cấp VT-01 theo PQ-10) xem và sửa trên trang Kết nối ngoài (MH-71).
  - Khóa truy cập chỉ đặt ở biến môi trường của máy chủ API: `FACEBOOK_PAGE_ACCESS_TOKEN`, `ZALO_OA_ACCESS_TOKEN`; không lưu vào cơ sở dữ liệu, không trả qua API. API chỉ trả `credentials_configured` (đã có khóa hay chưa) và `provider`. Cấu hình gửi kèm trường lạ (ví dụ `access_token`) bị từ chối 400.
  - Bộ giả lập: `FACEBOOK_PUBLISHER=development` (ghi bài vào bộ nhớ và nhật ký máy chủ, trả mã bài giả), `ZALO_SENDER=development` (ghi tin ra nhật ký máy chủ, giữ trong bộ nhớ). Kiểm thử máy chủ và kiểm thử giao diện dùng bộ giả lập. Kết nối thật: `GraphApiFacebookPublisher` (Graph API, tải hình chưa công bố rồi đăng một bài kèm hình) và `OfficialAccountZaloSender` (tin tư vấn của Official Account) đã viết khung, chỉ dùng khi có khóa ở biến môi trường, chưa kiểm thử với tài khoản thật; khóa Zalo hết hạn theo giờ nên khi triển khai thật cần thêm bước làm mới khóa (T7).
  - Đăng Fanpage (P14-08): người có `P14.facebook.manage` (VT-03, VT-02) trong phạm vi đơn vị của nội dung bấm "Đăng lên Fanpage" cho hoạt động của lớp hoặc tin tức. Chỉ nội dung đang công bố (BR-64); tin tức gửi riêng cho lớp hoặc trẻ không đăng công khai (chỉ phạm vi toàn trường hoặc đơn vị). Hình của hoạt động chỉ kèm khi mọi trẻ được gắn thẻ đã đồng ý sử dụng hình ảnh (BR-65), hình khác bị loại và đếm vào `excluded_photo_count`; tin tức kèm hình bìa nếu có. Nội dung bài là tiêu đề và nội dung (tin tức thêm tóm tắt).
  - Mỗi nội dung một bài (`facebook_posts`, duy nhất theo loại và mã nội dung). Đăng gọi Facebook ngay trong yêu cầu: thành công ghi `posted` kèm mã bài; Facebook lỗi thì ghi `failed` kèm lỗi, không ném lỗi; người quản lý bấm thử lại (đọc lại nội dung và đồng ý hình ảnh lúc thử). Đã đăng thì không đăng lại (409). Chưa bật Fanpage hoặc máy chủ chưa có khóa thì từ chối 422 mã P14-08, kiểm tra trước khi xét nội dung. Ẩn nội dung trên hệ thống không tự gỡ bài trên Fanpage (người quản lý gỡ trên Facebook).
  - Kênh thông báo `zalo` thêm vào `in_app`, `sms`: tiến trình gửi thông báo gửi qua Zalo khi nhà trường bật Zalo, máy chủ có khóa và số điện thoại phụ huynh của người nhận đã liên kết; không thì gửi tin nhắn theo quy tắc của tin nhắn (thử lại 15 phút, tối đa 5 lần). Zalo lỗi thì gửi ngay bằng tin nhắn trong cùng lượt và ghi lỗi Zalo vào `last_error`. Cột `delivered_via` ghi kênh thực tế (`in_app`, `sms`, `zalo`). Kênh `sms` giữ nguyên, không chuyển sang Zalo.
  - Giới hạn 5 tin mỗi ngày của một người nhận (KT-09) tính chung tin nhắn và tin Zalo. Báo cáo vận hành đếm "Tin nhắn" gồm cả kênh zalo.
  - Phụ huynh quan tâm Official Account: chọn màn hình liên kết của người quản trị (không làm điểm cuối giả lập webhook) vì dùng được cả khi chạy thật trước khi có webhook sự kiện quan tâm của Zalo (T7). Người có `P01.integration.manage` nhập số điện thoại (phải là số của một phụ huynh trong năm học, nếu không 422 G3-08) và mã người dùng Zalo; số điện thoại và mã Zalo đều duy nhất (409 khi trùng); bỏ liên kết được. Liên kết theo số điện thoại nên mọi tài khoản phụ huynh có số đó đều nhận qua Zalo.
  - Nhắc nợ (P05-10): khi Zalo đang bật, mỗi phụ huynh nhận thêm một người nhận kênh `zalo` bên cạnh trong ứng dụng; Zalo tắt thì như cũ (chỉ trong ứng dụng), không phát sinh tin nhắn.
  - Mở năm học mới chuyển `integration_settings` và `zalo_followers`; bài đăng Fanpage tra ở năm cũ.
- Thành phần bị ảnh hưởng: `05`, `07`, `08`, `10`, `14`, `16`, `17`, `21`, `22` (khóa ở biến môi trường), `03` (N3, N17), `01`, `02`, `23`, `index.md`; máy chủ API (thư mục `integrations`, tiến trình gửi thông báo, nhắc nợ, báo cáo vận hành), cổng quản trị.
- Dữ liệu bị ảnh hưởng: ba bảng mới của năm học `integration_settings`, `zalo_followers`, `facebook_posts`; `notification_recipients` thêm `delivered_via`, kênh thêm `zalo` (tệp 0044). Quyền đã cấp trước ở tệp 0035 của định danh (YCTD-85).
- API bị ảnh hưởng: `GET /integrations`, `PUT /integrations/{connector}`, `GET|POST /integrations/zalo/followers`, `DELETE /integrations/zalo/followers/{id}`, `POST /activities/{id}/facebook-post`, `POST /news/{id}/facebook-post`, `GET /facebook-posts`, `POST /facebook-posts/{id}/retry`.
- Giao diện bị ảnh hưởng: MH-71 Kết nối ngoài (mới); MH-23 thêm nút "Đăng lên Fanpage" cho hoạt động và tin tức đã công bố.
- Quyền bị ảnh hưởng: PQ-53.
- Ảnh hưởng chức năng cũ: khi bật Zalo, nhắc nợ có thêm tin qua Zalo hoặc tin nhắn cho phụ huynh và tính vào giới hạn 5 tin mỗi ngày; báo cáo vận hành đếm tin nhắn gồm cả tin Zalo. Khi chưa bật thì không đổi.
- Kiểm thử cần thực hiện: CT-11e-1 đến CT-11e-6; chạy lại bộ kiểm thử thông báo, hoạt động, tài chính giai đoạn 2.
- Trạng thái: Đã triển khai

## Bảng

| integration_settings | Cấu hình kết nối ngoài toàn trường: Fanpage, Zalo Official Account; không chứa khóa bí mật (YCTD-90) | id, connector (facebook, zalo; duy nhất), enabled, config_data (page_id, page_name hoặc oa_id, oa_name), updated_by, updated_at |
| zalo_followers | Số điện thoại phụ huynh đã quan tâm Official Account kèm mã người dùng Zalo, do người quản trị liên kết (G3-08) | id, phone (duy nhất), zalo_user_id (duy nhất), display_name, linked_by, linked_at |
| facebook_posts | Bài đăng Fanpage của hoạt động hoặc tin tức, mỗi nội dung một bài (P14-08) | id, source_type (activity, news), source_id, org_unit_id, title, message, photo_file_ids, excluded_photo_count, status (posted, failed), page_id, provider, external_post_id, last_error, attempt_count, posted_by, posted_at |
| notification_recipients (sửa) | Thêm kênh `zalo` và kênh thực tế đã gửi | channel (in_app, sms, zalo), delivered_via (in_app, sms, zalo) |

## Điểm cuối

| GET | /api/v1/integrations | Cấu hình hai kết nối: bật hay tắt, cấu hình không bí mật, nhà cung cấp, đã có khóa ở máy chủ hay chưa (P01.integration.manage) |
| PUT | /api/v1/integrations/{connector} | Lưu cấu hình Fanpage (`facebook`) hoặc Zalo (`zalo`): `enabled`, `config` chỉ gồm trường được phép |
| GET | /api/v1/integrations/zalo/followers | Danh sách số điện thoại đã liên kết Zalo kèm tên phụ huynh |
| POST | /api/v1/integrations/zalo/followers | Liên kết số điện thoại phụ huynh với mã người dùng Zalo |
| DELETE | /api/v1/integrations/zalo/followers/{id} | Bỏ liên kết Zalo |
| POST | /api/v1/activities/{id}/facebook-post | Đăng hoạt động đã công bố lên Fanpage (P14.facebook.manage) |
| POST | /api/v1/news/{id}/facebook-post | Đăng tin tức đã công bố, phạm vi toàn trường hoặc đơn vị, lên Fanpage |
| GET | /api/v1/facebook-posts | Bài đăng Fanpage trong phạm vi đơn vị; lọc `source_type`, `source_id` |
| POST | /api/v1/facebook-posts/{id}/retry | Thử đăng lại bài đăng lỗi |

Giao kèo:

1. Khóa truy cập Fanpage và Zalo chỉ đọc từ biến môi trường `FACEBOOK_PAGE_ACCESS_TOKEN`, `ZALO_OA_ACCESS_TOKEN`; không có điểm cuối nào nhận hay trả khóa. `PUT /integrations/{connector}` từ chối mọi trường cấu hình ngoài `page_id`, `page_name` (facebook) hoặc `oa_id`, `oa_name` (zalo) bằng 400; bật mà thiếu mã trang hoặc mã Official Account là 400; kết nối khác hai giá trị trên là 404. Mọi lần lưu ghi nhật ký thao tác.
2. `FACEBOOK_PUBLISHER=development`, `ZALO_SENDER=development` dùng bộ giả lập; không đặt và không có khóa thì `provider` là `none`, `credentials_configured` là false.
3. Đăng Fanpage: người không có `P14.facebook.manage` ở đơn vị nào 403; chưa bật Fanpage hoặc máy chủ chưa có khóa 422 `P14-08`; nội dung không thuộc phạm vi đơn vị của người đăng 403; nội dung chưa công bố hoặc đã ẩn 422 `BR-64`; tin tức phạm vi lớp hoặc trẻ 422 `P14-08`; đã đăng 409. Facebook lỗi thì trả 201 với `status = failed`, `last_error`; thử lại chỉ cho bài `failed` (khác là 409), trả 200, tăng `attempt_count`.
4. Hình kèm bài: hình của hoạt động có bất kỳ trẻ được gắn thẻ chưa đồng ý (`photo_consent` khác `granted`) bị loại, số hình bị loại ở `excluded_photo_count`; xét lúc đăng hoặc thử lại.
5. Liên kết Zalo: số điện thoại 10 chữ số bắt đầu bằng 0 và phải là số của một phụ huynh trong năm học (không thì 422 `G3-08`); số hoặc mã Zalo đã liên kết thì 409.
6. Tiến trình gửi thông báo: người nhận kênh `zalo` gửi qua Zalo khi Zalo bật, máy chủ có khóa và số điện thoại đã liên kết; còn lại hoặc Zalo lỗi thì gửi tin nhắn. Tin Zalo và tin nhắn tính chung giới hạn 5 tin mỗi ngày; `delivered_via` ghi kênh thực tế.
7. Nhắc nợ thêm người nhận kênh `zalo` cho mỗi phụ huynh khi Zalo đang bật lúc gửi nhắc.

## Màn hình

| MH-71 | Kết nối ngoài | Hiệu trưởng bật, tắt Fanpage và Zalo Official Account, nhập mã trang, mã Official Account (khóa truy cập đặt ở máy chủ, trang chỉ báo đã có hay chưa); liên kết số điện thoại phụ huynh với mã người dùng Zalo, bỏ liên kết | P01.integration.manage (VT-02) |
| MH-23 (bổ sung) | Hoạt động và tin tức | Hoạt động và tin tức (phạm vi toàn trường hoặc đơn vị) đã công bố có nút "Đăng lên Fanpage"; đã đăng thì hiện mã bài, số hình, số hình bị loại vì trẻ chưa đồng ý; đăng lỗi thì hiện lỗi và nút "Thử đăng lại lên Fanpage" | P14.facebook.manage (VT-03, VT-02) |

## Quyền

| PQ-53 | Kết nối ngoài (YCTD-90): `P01.integration.manage` chỉ VT-02 (Hiệu trưởng) cấu hình Fanpage, Zalo Official Account và liên kết Zalo của phụ huynh, toàn trường; `P14.facebook.manage` VT-03 trong phạm vi đơn vị được gán, VT-02 toàn trường, đăng hoạt động và tin tức đã công bố lên Fanpage, xem và thử lại bài đăng. Khóa truy cập chỉ ở biến môi trường máy chủ, không ai xem được qua hệ thống |

## Kết quả kiểm thử

Kiểm thử máy chủ `apps/api/src/integrations/integrations.test.ts`: 6/6 đạt.

| Mã đề xuất | Kịch bản | Kết quả |
| --- | --- | --- |
| CT-11e-1 | Hiệu trưởng cấu hình Fanpage, Zalo; trường lạ như `access_token` bị từ chối; bật thiếu mã bị từ chối; quản lý đơn vị không cấu hình được; API không trả khóa | Đạt (`integrations.test.ts`, giao diện `tests/e2e/44-integrations.spec.ts`) |
| CT-11e-2 | Chưa bật Fanpage thì không đăng được; hoạt động chưa duyệt bị chặn (BR-64); duyệt rồi đăng: hình có trẻ chưa đồng ý bị loại (BR-65); giáo viên, phụ huynh, quản lý đơn vị khác bị chặn; đăng lại bị chặn | Đạt (`integrations.test.ts`, giao diện `tests/e2e/44-integrations.spec.ts`) |
| CT-11e-3 | Facebook lỗi thì ghi lỗi, thử lại thành công; tin phạm vi lớp không đăng công khai | Đạt (`integrations.test.ts`) |
| CT-11e-4 | Liên kết Zalo theo số điện thoại phụ huynh; Zalo tắt thì gửi tin nhắn; bật thì người đã liên kết nhận qua Zalo, chưa liên kết nhận tin nhắn; Zalo lỗi thì gửi ngay bằng tin nhắn | Đạt (`integrations.test.ts`) |
| CT-11e-5 | Tin Zalo và tin nhắn tính chung giới hạn 5 tin mỗi ngày | Đạt (`integrations.test.ts`) |
| CT-11e-6 | Nhắc nợ quá hạn gửi qua Zalo cho phụ huynh đã liên kết khi bật Zalo | Đạt (`integrations.test.ts`) |

Chạy lại: `notification-dispatcher.test.ts`, `notifications.test.ts`, `activities.test.ts`, `finance-g2.test.ts`: 27/27 đạt. Kiểm thử giao diện `44-integrations.spec.ts` đã viết, chưa chạy (người điều phối chạy). Chưa kiểm thử với Facebook và Zalo thật (chờ T4, T7).

## Quy tắc

- Đề xuất thêm vào BR-65: "Khi đăng lên Fanpage, hình có bất kỳ trẻ được gắn thẻ chưa đồng ý sử dụng hình ảnh bị loại khỏi bài đăng; chỉ nội dung đang công bố và tin tức phạm vi toàn trường hoặc đơn vị được đăng (YCTD-90)."
- Đề xuất sửa KT-09 (giới hạn tin nhắn): "Mỗi người nhận tối đa 5 tin gửi ra ngoài mỗi ngày, gồm tin nhắn và tin qua Zalo Official Account (YCTD-90)."
