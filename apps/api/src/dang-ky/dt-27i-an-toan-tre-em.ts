import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { MarketSafetyAdminController, MarketSafetyController, MarketSafetyService } from '../market/market-safety.js';

// An toàn trẻ em và kiểm duyệt ở chợ gia sư (DT-27 phần 27i): tin nhắn có lọc thông tin liên lạc, báo cáo vi phạm, tạm khóa gia sư,
// phòng học bắt buộc ghi hình với trẻ vị thành niên, quyền xem bản ghi, hàng chờ kiểm duyệt ở cổng nền tảng
export default {
  controllers: [MarketSafetyController, MarketSafetyAdminController],
  providers: [MarketSafetyService],
} satisfies PhanDangKy;
