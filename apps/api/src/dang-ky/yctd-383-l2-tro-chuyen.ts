import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { ChildAiTutorTopicsController, StudentAiTutorController } from '../ai-tutor/tutor-chat.controller.js';
import { AiTutorChatMaintenanceJob, AiTutorChatService } from '../ai-tutor/tutor-chat.js';

// Học sinh trò chuyện bằng chữ với gia sư AI; cha mẹ xem chủ đề và số lượt; việc nền hoàn lượt tạm giữ quá hạn, xóa lịch sử quá 12
// tháng (YCTD-383 lát L2)
export default {
  controllers: [StudentAiTutorController, ChildAiTutorTopicsController],
  providers: [AiTutorChatService, AiTutorChatMaintenanceJob],
} satisfies PhanDangKy;
