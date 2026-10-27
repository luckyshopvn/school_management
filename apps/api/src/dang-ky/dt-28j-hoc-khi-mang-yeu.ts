import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { OfflineLearningController, StudentOfflineController } from '../learning/offline/offline.controller.js';
import { OfflineLearningService } from '../learning/offline/offline.js';

// Học khi mạng yếu (DT-28 phần 28j)
export default {
  controllers: [OfflineLearningController, StudentOfflineController],
  providers: [OfflineLearningService],
} satisfies PhanDangKy;
