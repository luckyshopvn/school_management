import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { AiTutorSafetyFlagsController } from '../ai-tutor/safety-flags.controller.js';
import { AiTutorSafetyFlagService } from '../ai-tutor/safety-flags.js';

// Gia sư AI khóa theo phòng thi, bài tập, khung giờ; báo giáo viên chủ nhiệm khi có cờ cảnh báo, giáo viên đánh dấu đã xử lý
// (YCTD-383 lát L3)
export default {
  controllers: [AiTutorSafetyFlagsController],
  providers: [AiTutorSafetyFlagService],
} satisfies PhanDangKy;
