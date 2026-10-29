import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { MarketRoomsController, MarketRoomsService } from '../market/market-rooms.js';

// Phòng học video của chợ gia sư (DT-27 phần 27j, YCTD-362): đồng ý ghi hình theo gia sư, phòng chờ, vào ra, điểm danh, gia sư vắng,
// gia sư xác nhận đã dạy
export default {
  controllers: [MarketRoomsController],
  providers: [MarketRoomsService],
} satisfies PhanDangKy;
