import type { Provider, Type } from '@nestjs/common';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';

// Đăng ký của một phần làm song song (YCTD-294): mỗi phần thêm một tệp src/dang-ky/<phần>.ts, xuất mặc định đối tượng kiểu này
// (`export default { ... } satisfies PhanDangKy`), không sửa application.module.ts. ApplicationModule gom mọi tệp theo thứ tự tên
// tệp và nối sau các bộ điều khiển, dịch vụ, bước chuyển năm học có sẵn; chỉ mục src/dang-ky.generated.ts do sinh-dang-ky.mjs sinh
// khi dựng. Dịch vụ cần cấu hình máy chủ thì dùng useFactory với inject: [API_CONFIGURATION]
export interface PhanDangKy {
  controllers?: Type[];
  providers?: Provider[];
  transitionSteps?: AcademicYearTransitionStep[];
}
