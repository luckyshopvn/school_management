import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { ParentOrgExportsController, ParentOrgExportsService } from '../parent-org/parent-org-exports.js';

// Xuất báo cáo chạy nền của tài khoản cấp trên (YCTD-367)
export default {
  controllers: [ParentOrgExportsController],
  providers: [ParentOrgExportsService],
} satisfies PhanDangKy;
