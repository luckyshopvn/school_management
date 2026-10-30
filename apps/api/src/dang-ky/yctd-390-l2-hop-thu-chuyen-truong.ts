import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { TransferMailboxController } from '../student-records/transfer-mailbox.controller.js';
import { TransferMailboxService } from '../student-records/transfer-mailbox.js';

// Hộp thư chuyển trường giữa các trường trên nền tảng (YCTD-390 lát L2)
export default {
  controllers: [TransferMailboxController],
  providers: [TransferMailboxService],
} satisfies PhanDangKy;
