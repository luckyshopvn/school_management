import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { AiTutorParentRequestService } from '../ai-tutor/parent-requests.js';
import { AiTutorSchoolReportController, AiTutorSchoolReportService } from '../ai-tutor/school-report.js';

// Gia sư AI hoàn thiện (YCTD-383 lát L5): em gửi lời nhờ cha mẹ khi chưa có gói hoặc hết lượt; báo cáo lượt hỏi và token cho trường
export default {
  controllers: [AiTutorSchoolReportController],
  providers: [AiTutorParentRequestService, AiTutorSchoolReportService],
} satisfies PhanDangKy;
