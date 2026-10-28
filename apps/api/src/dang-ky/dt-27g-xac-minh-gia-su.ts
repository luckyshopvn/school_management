import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { MarketIdentityController, MarketIdentityService } from '../market/market-identity.js';
import { MarketListingController, MarketListingService } from '../market/market-listing.js';
import { MarketPublicController, MarketPublicService } from '../market/market-public.js';
import { MarketReviewController, MarketReviewService } from '../market/market-review.js';

// Hồ sơ gia sư, xác minh, hàng chờ duyệt, tìm gia sư (DT-27 phần 27g)
export default {
  controllers: [MarketIdentityController, MarketListingController, MarketReviewController, MarketPublicController],
  providers: [MarketIdentityService, MarketListingService, MarketReviewService, MarketPublicService],
} satisfies PhanDangKy;
