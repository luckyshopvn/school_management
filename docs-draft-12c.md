# Bản nháp tài liệu DT-12 phần 12c: kết nối thật Fanpage và Zalo Official Account (YCTD-92)

Ngày 2026-10-13 anh Eric quyết định kết nối tài khoản thật cho Fanpage Facebook và Zalo Official Account; khóa truy cập điền khi triển khai. Bản nháp này để người phụ trách tài liệu đưa vào `tai_lieu/` (chưa sửa `tai_lieu/`).

## 1. Tóm tắt thay đổi

- Facebook: dùng Graph API v21.0, đổi được bằng `FACEBOOK_GRAPH_VERSION`. Bài không có hình chỉ đăng nội dung lên `/{page_id}/feed`. Bài có hình thì tải từng hình ở chế độ chưa công bố rồi đăng một bài kèm các hình, như trước. Thêm hàm `verify()` gọi `GET /{page_id}?fields=id,name`. Khóa gửi ở tiêu đề `Authorization`, không gửi trên đường dẫn.
- Lỗi Graph API thường gặp (190, 200, 10, 100, 4, 17, 32, 368) đổi sang lời báo tiếng Việt, kèm mã lỗi.
- Zalo: thêm kho khóa `ZaloTokenStore` ở cơ sở dữ liệu hệ thống, bảng `integration_credentials` (tệp `0003_create_integration_credentials`). Kho lưu khóa truy cập, hạn của khóa truy cập và khóa làm mới, mã hóa AES-256-GCM bằng `CHILD_DATA_ENCRYPTION_KEY` (dùng chung hàm mã hóa với số định danh của trẻ, nay tách ra `common/secret-encryption.ts`). Khóa dùng chung toàn trường và phải giữ qua các lần chuyển năm học nên đặt ở cơ sở dữ liệu hệ thống, không đặt ở cơ sở dữ liệu năm học.
- Làm mới khóa Zalo: gọi `POST https://oauth.zaloapp.com/v4/oa/access_token`, tiêu đề `secret_key: ZALO_APP_SECRET`, thân dạng biểu mẫu `refresh_token`, `app_id`, `grant_type=refresh_token`. Máy chủ làm mới khi khóa truy cập còn dưới 5 phút. Khi Zalo báo -216 (hoặc -124) khóa không hợp lệ, máy chủ làm mới rồi thử lại đúng một lần. Khóa làm mới mới được lưu ngay trong cùng giao dịch, vì Zalo vô hiệu khóa làm mới cũ sau mỗi lần dùng.
- Chống làm mới hai lần: trong một tiến trình, các lời gọi chờ chung một lần làm mới. Giữa nhiều tiến trình, máy chủ khóa dòng (`SELECT … FOR UPDATE`) rồi đọc lại; tiến trình đến sau thấy khóa đã mới thì dùng luôn.
- Khóa ban đầu: kho trống thì lấy `ZALO_OA_REFRESH_TOKEN` (và `ZALO_OA_ACCESS_TOKEN` nếu có, coi như còn hạn 1 giờ) ở biến môi trường.
- Gửi tin: dùng API tin tư vấn v3.0 (`/v3.0/oa/message/cs`). Các lỗi Zalo thường gặp đổi sang tiếng Việt: -216/-124 khóa không hợp lệ, -213 chưa quan tâm, -230 ngoài thời hạn tương tác, -201 tham số sai, -224 hết hạn mức gói, -32 giới hạn số lần gọi. Bộ gửi thông báo vẫn như cũ: Zalo lỗi thì gửi ngay bằng tin nhắn và ghi `Gửi Zalo lỗi, đã gửi tin nhắn: <lời báo>`.
- API mới, đều cần quyền `P01.integration.manage` (VT-02):
  - `POST /api/v1/integrations/facebook/test`: trả `{connector, ok, page_id, page_name}`. Lỗi trả 422, mã quy tắc G3-03, kèm lời báo. Chưa nhập mã trang cũng trả 422.
  - `POST /api/v1/integrations/zalo/test`: gọi `GET https://openapi.zalo.me/v2.0/oa/getoa` và trả `{connector, ok, oa_id, oa_name}`. Lỗi trả 422, mã quy tắc G3-08.
  - `PUT /api/v1/integrations/zalo/refresh-token` với thân `{refresh_token}`: lưu khóa làm mới mới (mã hóa) và bỏ khóa truy cập cũ. API không bao giờ trả lại khóa. Nhật ký thay đổi (`audit_logs` của năm học đang dùng, `entity_name = integration_credentials`) chỉ ghi "đã thay", không ghi giá trị khóa.
  - `GET /api/v1/integrations`: riêng dòng Zalo có thêm `token_status` gồm `refresh_token_configured`, `access_token_expires_at`, `refreshed_at`.
- Cổng quản lý, màn hình MH-71 Kết nối ngoài:
  - Mỗi kết nối có nút "Kiểm tra kết nối", tên truy cập là "Kiểm tra kết nối Fanpage Facebook" và "Kiểm tra kết nối Zalo Official Account". Kết quả hiện tên trang hoặc tên Official Account, hoặc lời báo lỗi.
  - Biểu mẫu mới "Khóa làm mới Zalo" có ô mật khẩu "Khóa làm mới mới" và nút "Cập nhật khóa làm mới Zalo".
  - Dòng trạng thái của Zalo cho biết đã có khóa làm mới hay chưa và giờ hết hạn của khóa truy cập.
- Khởi động:
  - `ZALO_SENDER=zalo_oa` mà thiếu `ZALO_APP_ID`, `ZALO_APP_SECRET` hoặc `ZALO_OA_REFRESH_TOKEN` thì máy chủ không khởi động.
  - `FACEBOOK_PUBLISHER=graph` mà thiếu `FACEBOOK_PAGE_ACCESS_TOKEN` thì máy chủ không khởi động.
  - `FACEBOOK_GRAPH_VERSION` sai dạng `vNN.N` thì máy chủ không khởi động.
- Thay đổi so với YCTD-90: trước đây chỉ cần đặt `ZALO_OA_ACCESS_TOKEN` là bật kết nối Zalo thật. Nay phải đặt `ZALO_SENDER=zalo_oa`.

## 2. Biến môi trường

| Biến                         | Bắt buộc      | Ý nghĩa                                                                                                                                |
| ---------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `FACEBOOK_PUBLISHER`         | không         | `development` là bộ giả lập; `graph` là kết nối thật (bắt buộc có khóa); để trống mà có khóa thì cũng dùng Graph API                   |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | khi `graph`   | Khóa trang dài hạn (Page access token)                                                                                                 |
| `FACEBOOK_GRAPH_VERSION`     | không         | Mặc định `v21.0`                                                                                                                       |
| `ZALO_SENDER`                | không         | `development` là bộ giả lập; `zalo_oa` là kết nối thật                                                                                 |
| `ZALO_APP_ID`                | khi `zalo_oa` | Mã ứng dụng Zalo (App ID)                                                                                                              |
| `ZALO_APP_SECRET`            | khi `zalo_oa` | Khóa bí mật ứng dụng (Secret key)                                                                                                      |
| `ZALO_OA_REFRESH_TOKEN`      | khi `zalo_oa` | Khóa làm mới ban đầu; chỉ dùng khi kho khóa trống                                                                                      |
| `ZALO_OA_ACCESS_TOKEN`       | không         | Khóa truy cập ban đầu (nếu có)                                                                                                         |
| `CHILD_DATA_ENCRYPTION_KEY`  | có (sẵn có)   | Khóa 32 byte mã hóa khóa Zalo trong cơ sở dữ liệu. Đổi khóa này thì khóa Zalo đã lưu không giải mã được nữa, phải dán lại khóa làm mới |

## 3. Các bước anh Eric chuẩn bị khóa

### 3.1. Khóa trang Facebook dài hạn

1. Dùng tài khoản Facebook có vai trò quản trị Fanpage. Vào developers.facebook.com, tạo ứng dụng loại Business (hoặc dùng ứng dụng sẵn có).
2. Thêm sản phẩm Facebook Login for Business. Xin các quyền `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`. Khi chỉ người có vai trò trong ứng dụng dùng thì không cần duyệt ứng dụng; để chế độ Live cần hoàn tất xác minh doanh nghiệp.
3. Trong Graph API Explorer, chọn ứng dụng, cấp các quyền trên và lấy User access token ngắn hạn.
4. Đổi sang khóa người dùng dài hạn:
   `GET https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id={app_id}&client_secret={app_secret}&fb_exchange_token={khóa_ngắn_hạn}`
5. Lấy khóa trang: `GET https://graph.facebook.com/v21.0/me/accounts?access_token={khóa_người_dùng_dài_hạn}`. Ở dòng của Fanpage, `access_token` là khóa trang (không hết hạn khi lấy từ khóa người dùng dài hạn) và `id` là mã trang.
6. Đặt `FACEBOOK_PUBLISHER=graph` và `FACEBOOK_PAGE_ACCESS_TOKEN=<khóa trang>`, rồi khởi động lại máy chủ API.
7. Trên màn hình Kết nối ngoài, nhập mã trang, bật Fanpage, lưu, rồi bấm "Kiểm tra kết nối". Đúng thì màn hình hiện tên trang.
8. Khóa trang mất hiệu lực khi người cấp đổi mật khẩu, mất vai trò quản trị trang hoặc gỡ ứng dụng. Khi đó "Kiểm tra kết nối" báo mã 190 và phải làm lại từ bước 3.

### 3.2. Zalo Official Account

1. Official Account của trường phải đã xác thực, và gói dịch vụ phải cho phép gửi tin tư vấn.
2. Vào developers.zalo.me, tạo ứng dụng. Lấy App ID (`ZALO_APP_ID`) và Secret key (`ZALO_APP_SECRET`) ở trang thông tin ứng dụng.
3. Trong ứng dụng, mục Official Account, liên kết Official Account của trường và cấp quyền gửi tin, đọc thông tin Official Account.
4. Lấy khóa lần đầu theo luồng cấp quyền của Official Account (OAuth v4):
   - Mở đường dẫn cấp quyền `https://oauth.zaloapp.com/v4/oa/permission?app_id={app_id}&redirect_uri={địa chỉ đã khai báo}`, kèm `code_challenge` nếu dùng PKCE.
   - Quản trị viên Official Account đồng ý.
   - Đổi `code` nhận được: `POST https://oauth.zaloapp.com/v4/oa/access_token`, tiêu đề `secret_key`, thân `code`, `app_id`, `grant_type=authorization_code` (kèm `code_verifier` nếu dùng PKCE).
   - Zalo trả `access_token` và `refresh_token`. Cũng có thể lấy cặp khóa này bằng công cụ API Explorer của Zalo.
5. Đặt `ZALO_SENDER=zalo_oa`, `ZALO_APP_ID`, `ZALO_APP_SECRET`, `ZALO_OA_REFRESH_TOKEN=<refresh_token>` (và `ZALO_OA_ACCESS_TOKEN` nếu muốn), rồi khởi động lại máy chủ API.
6. Trên màn hình Kết nối ngoài, nhập mã Official Account, bật Zalo, lưu, rồi bấm "Kiểm tra kết nối". Đúng thì màn hình hiện tên Official Account.
7. Từ đây máy chủ tự làm mới khóa. Nếu máy chủ ngừng quá 3 tháng, hoặc khóa làm mới bị thu hồi, lần kiểm tra hoặc gửi sau sẽ báo "Zalo từ chối làm mới khóa …". Khi đó làm lại bước 4 rồi dán `refresh_token` mới vào ô "Khóa làm mới mới", không cần khởi động lại máy chủ.
8. Không dùng cùng khóa làm mới cho hai môi trường, ví dụ máy thử và máy thật: một bên làm mới sẽ làm khóa của bên kia mất hiệu lực.

## 4. Kịch bản kiểm thử

- CT-12c-1: Kho khóa trống, gửi một tin Zalo: máy chủ làm mới bằng `ZALO_OA_REFRESH_TOKEN`, lưu khóa truy cập và khóa làm mới mới ở dạng mã hóa, hạn bằng thời điểm làm mới cộng `expires_in`. Lần gửi tiếp theo dùng lại khóa. Khi khóa còn dưới 5 phút, máy chủ làm mới bằng khóa làm mới mới nhất. Sau khi tiến trình khởi động lại, máy chủ dùng khóa đã lưu — đạt.
- CT-12c-2: Tám tin gửi đồng thời từ hai tiến trình khi chưa có khóa truy cập: Zalo chỉ nhận một lần làm mới, cả tám tin dùng chung khóa mới — đạt.
- CT-12c-3: Zalo báo -216 với khóa đang dùng: máy chủ làm mới rồi gửi lại thành công bằng khóa mới. Nếu khóa mới vẫn bị từ chối, máy chủ dừng sau một lần thử lại và báo "Khóa truy cập Zalo không hợp lệ hoặc đã hết hạn (mã -216)" — đạt.
- CT-12c-4: Tin bị Zalo từ chối với mã -230: máy chủ báo lỗi tiếng Việt về thời hạn tương tác. Khóa làm mới sai báo "Zalo từ chối làm mới khóa … nhập khóa làm mới mới". Chưa có khóa làm mới thì báo "Chưa có khóa làm mới Zalo" — đạt.
- CT-12c-5: Người quản trị dán khóa làm mới khi kho trống: dòng khóa được tạo, kiểm tra kết nối trả tên Official Account. Khi dán lại khóa, khóa truy cập cũ bị bỏ và mã dòng giữ nguyên — đạt.
- CT-12c-6: Facebook đăng bài không hình: máy chủ chỉ gọi `/v21.0/{page_id}/feed` với nội dung, không có `attached_media`. Bài có hình: máy chủ tải hình rồi đăng kèm hình. Kiểm tra kết nối gọi `?fields=id,name` với khóa ở tiêu đề và trả tên trang. Lỗi 190 báo khóa không hợp lệ hoặc hết hạn — đạt.
- CT-12c-7: `ZALO_SENDER=zalo_oa` thiếu `ZALO_APP_SECRET` và `ZALO_OA_REFRESH_TOKEN`, hoặc `FACEBOOK_PUBLISHER=graph` thiếu khóa, hoặc `FACEBOOK_GRAPH_VERSION` sai dạng: máy chủ không khởi động và báo tên biến thiếu hoặc sai — đạt.
- CT-12c-8: VT-02 kiểm tra kết nối Fanpage, Zalo và thay khóa làm mới thành công. VT-03, VT-04, VT-07, VT-14 nhận 403. Facebook lỗi trả 422 kèm lời báo. Khóa có khoảng trắng trả 400. Khóa không xuất hiện trong phản hồi, trong danh sách kết nối hay trong nhật ký. Cơ sở dữ liệu hệ thống chỉ lưu bản mã và ghi người thay — đạt.
- Hồi quy: các kịch bản CT-202 đến CT-207 (cấu hình kết nối, đăng Fanpage, Zalo lỗi thì gửi tin nhắn, giới hạn 5 tin mỗi ngày, nhắc nợ qua Zalo) và kiểm thử tiến trình gửi thông báo vẫn đạt.

## 5. Giới hạn

- Chưa thử với Fanpage và Official Account thật. Mã lỗi Zalo, Facebook đã đổi sang tiếng Việt theo tài liệu công khai; khi kết nối thật cần đối chiếu lại và bổ sung mã còn thiếu. Mã lạ vẫn hiện lời báo gốc kèm mã.
- Tin tư vấn Zalo chỉ gửi được trong thời hạn tương tác do Zalo quy định. Ngoài thời hạn, tin chuyển sang tin nhắn SMS. Chưa dùng tin giao dịch hoặc ZNS (cần đăng ký mẫu và trả phí; làm sau nếu nhà trường cần).
- Chưa có webhook nhận sự kiện quan tâm Official Account. Người quản trị vẫn liên kết số điện thoại với mã người dùng Zalo bằng tay.
- Nếu Zalo đã cấp khóa mới mà máy chủ không ghi được vào cơ sở dữ liệu (rất hiếm, ví dụ mất kết nối cơ sở dữ liệu đúng lúc đó), khóa làm mới mới bị mất. Người quản trị phải lấy khóa mới theo mục 3.2 bước 4 rồi dán lại.
- Khóa Zalo mã hóa bằng `CHILD_DATA_ENCRYPTION_KEY`. Đổi khóa này mà không mã hóa lại dữ liệu thì phải dán lại khóa làm mới Zalo.
- Khóa trang Facebook vẫn đặt ở biến môi trường. Khóa mất hiệu lực thì phải đổi biến và khởi động lại máy chủ; chưa có ô dán khóa Facebook trên màn hình.
- Chưa có Playwright cho nút kiểm tra kết nối và ô khóa làm mới. Phần này đã kiểm thử bằng kiểm thử tích hợp API.
