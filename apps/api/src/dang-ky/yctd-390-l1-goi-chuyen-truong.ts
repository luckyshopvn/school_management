import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { TransferPackagesController } from '../student-records/transfer-packages.controller.js';
import { TransferPackagesService } from '../student-records/transfer-packages.js';

// Gói chuyển trường: trường đi lập gói, trường đến xem trước và tiếp nhận (YCTD-390 lát L1)
export default {
  controllers: [TransferPackagesController],
  providers: [TransferPackagesService],
} satisfies PhanDangKy;
