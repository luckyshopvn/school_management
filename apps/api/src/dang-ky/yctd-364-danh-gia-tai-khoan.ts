import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { MarketPasswordController, MarketPasswordService } from '../market/market-password.js';
import { MarketReviewsController, MarketReviewsService } from '../market/market-reviews.js';

// Chợ gia sư (YCTD-364): đánh giá gia sư, gia sư trả lời, nhân viên duyệt đánh giá, con đọc tin nhắn; đổi, đặt lại mật khẩu, sửa tên
export default {
  controllers: [MarketReviewsController, MarketPasswordController],
  providers: [MarketReviewsService, MarketPasswordService],
} satisfies PhanDangKy;
