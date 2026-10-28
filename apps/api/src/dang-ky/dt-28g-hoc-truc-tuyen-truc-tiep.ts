import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { LiveLearningController, StudentLiveController } from '../learning/live/live.controller.js';
import { LiveLearningService } from '../learning/live/live.js';

// Giờ học trực tuyến, phòng video nhóm, phòng chia nhỏ (DT-28 phần 28g)
export default {
  controllers: [LiveLearningController, StudentLiveController],
  providers: [LiveLearningService],
} satisfies PhanDangKy;
