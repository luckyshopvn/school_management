import { PLATFORM_TRANSFER_HANDLER } from '../billing/platform-transfer-handler.js';
import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { AiTutorDirectPurchaseController, PlatformAiTutorAdminController } from '../ai-tutor/platform-sales.controller.js';
import { PlatformAiTutorExpiryJob, PlatformAiTutorSalesService } from '../ai-tutor/platform-sales.js';

// Nền tảng bán thẳng gói gia sư AI cho phụ huynh (YCTD-383 lát L1b): điểm cuối của phụ huynh và cổng vận hành, bộ nhận tiền vào gắn vào
// điểm nhận thông báo của cổng nền tảng, việc nền đóng giao dịch quá hạn giữ chỗ
export default {
  controllers: [AiTutorDirectPurchaseController, PlatformAiTutorAdminController],
  providers: [
    PlatformAiTutorSalesService,
    PlatformAiTutorExpiryJob,
    { provide: PLATFORM_TRANSFER_HANDLER, useExisting: PlatformAiTutorSalesService },
  ],
} satisfies PhanDangKy;
