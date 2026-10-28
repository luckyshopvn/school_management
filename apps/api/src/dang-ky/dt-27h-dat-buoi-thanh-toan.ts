import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { MarketBookingsController, MarketBookingsService } from '../market/market-bookings.js';
import { MarketplacePaymentProvider, MockMarketplacePaymentProvider } from '../market/market-payment-provider.js';
import { MarketPaymentsAdminController, MarketPaymentsAdminService } from '../market/market-payments-admin.js';

// Đặt buổi, thanh toán giữ tiền (bộ giả lập), giải ngân, tranh chấp, hoa hồng (DT-27 phần 27h). Nhà cung cấp thật thay bộ giả lập khi
// Eric chọn tổ chức có giấy phép (E-02) và chỉ dùng được khi thu tiền thật bật
export default {
  controllers: [MarketBookingsController, MarketPaymentsAdminController],
  providers: [
    { provide: MarketplacePaymentProvider, useFactory: () => new MockMarketplacePaymentProvider() },
    MarketBookingsService,
    MarketPaymentsAdminService,
  ],
} satisfies PhanDangKy;
