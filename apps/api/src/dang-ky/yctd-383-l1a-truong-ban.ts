import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { AiTutorSchoolAdminController, ChildAiTutorController } from '../ai-tutor/school-sales.controller.js';
import { AiTutorSchoolSalesService } from '../ai-tutor/school-sales.js';

// Gia sư AI do trường bán: quản trị trường bán gói, phụ huynh mua cho con (YCTD-383 lát L1a)
export default {
  controllers: [AiTutorSchoolAdminController, ChildAiTutorController],
  providers: [AiTutorSchoolSalesService],
} satisfies PhanDangKy;
