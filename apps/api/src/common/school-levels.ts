import { Injectable } from '@nestjs/common';
import { ApplicationError, validationError } from '@school-management/server';
import {
  ALL_SCHOOL_LEVELS,
  DEFAULT_SCHOOL_LEVEL,
  isSchoolLevelCode,
  SCHOOL_LEVEL_PARAMETER,
  SCHOOL_LEVELS,
  schoolLevelTerms,
  visibleSchoolLevels,
  type SchoolLevelCode,
  type SchoolLevelTerms,
  type SchoolLevelView,
} from '@school-management/shared';
import type { CurrentUser } from '../authentication/current-user.js';
import { Databases } from './databases.js';
import { cacheKey } from './resource-names.js';

// Đọc cấp học của trường qua một chỗ (DT-19 phần 19a, YCTD-151; tài liệu 47 mục 10.4): danh sách cấp, cấp đang bật, cấp
// mặc định, cấp người dùng được xem. Mọi phần sau (khối, lớp, menu, báo cáo, DT-20, DT-21) đọc cấp qua lớp này, không đọc
// cột rời. Bộ nhớ đệm trong tiến trình, khóa tạo qua cacheKey, sống 30 giây và xóa ngay khi ghi ở tiến trình này (máy chủ
// API khác thấy thay đổi chậm nhất 30 giây). Bảng trống (chưa chạy migration hệ thống 0023) thì coi trường chỉ có Mầm non.
// Khóa tính ở mỗi lần gọi, trong ngữ cảnh trường của yêu cầu, để mỗi trường có mục đệm riêng ở chế độ nhiều trường
const CACHE_LIFETIME_MILLISECONDS = 30_000;
const levelsKey = () => cacheKey('school-levels', 'all');

function fallbackLevels(): SchoolLevelView[] {
  return SCHOOL_LEVELS.map((level, index) => ({
    code: level.value,
    is_enabled: level.value === DEFAULT_SCHOOL_LEVEL,
    order_no: index + 1,
    display_name: level.label,
    learner_term: level.value === 'MN' ? 'Trẻ' : 'Học sinh',
    context_label: `Cấp ${level.value}`,
    updated_by_name: null,
    updated_at: null,
  }));
}

@Injectable()
export class SchoolLevelResolver {
  private readonly cache = new Map<string, { expiresAt: number; levels: SchoolLevelView[] }>();

  constructor(private readonly databases: Databases) {}

  // Bốn cấp theo thứ tự hiển thị, cả cấp đang tắt
  async all(): Promise<SchoolLevelView[]> {
    const key = levelsKey();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.levels;
    }
    const rows = await this.databases.system
      .selectFrom('school_levels')
      .selectAll()
      .orderBy('order_no')
      .orderBy('code')
      .execute();
    const levels: SchoolLevelView[] = rows
      .filter((row) => isSchoolLevelCode(row.code))
      .map((row) => ({
        code: row.code as SchoolLevelCode,
        is_enabled: row.is_enabled,
        order_no: row.order_no,
        display_name: row.display_name,
        learner_term: row.learner_term,
        context_label: row.context_label,
        updated_by_name: row.updated_by_name,
        updated_at: row.updated_at.toISOString(),
      }));
    const result = levels.length > 0 ? levels : fallbackLevels();
    this.cache.set(key, { expiresAt: Date.now() + CACHE_LIFETIME_MILLISECONDS, levels: result });
    return result;
  }

  // Cấp đang bật theo thứ tự; không cấp nào bật (không xảy ra vì máy chủ chặn) thì coi là Mầm non
  async enabled(): Promise<SchoolLevelCode[]> {
    const codes = (await this.all()).filter((level) => level.is_enabled).map((level) => level.code);
    return codes.length > 0 ? codes : [DEFAULT_SCHOOL_LEVEL];
  }

  async enabledLevels(): Promise<SchoolLevelView[]> {
    const levels = await this.all();
    const enabled = levels.filter((level) => level.is_enabled);
    return enabled.length > 0 ? enabled : levels.filter((level) => level.code === DEFAULT_SCHOOL_LEVEL);
  }

  async isEnabled(code: string): Promise<boolean> {
    return (await this.enabled()).includes(code as SchoolLevelCode);
  }

  // Cấp mặc định khi dữ liệu không ghi cấp: cấp đầu tiên đang bật (trường mầm non là MN)
  async defaultLevel(): Promise<SchoolLevelCode> {
    return (await this.enabled())[0] ?? DEFAULT_SCHOOL_LEVEL;
  }

  // Cấp người dùng được xem: cấp đang bật thu hẹp theo phạm vi cấp của tài khoản (trống là mọi cấp)
  async forUser(currentUser: CurrentUser): Promise<SchoolLevelCode[]> {
    return visibleSchoolLevels(await this.enabled(), currentUser.schoolLevelScope());
  }

  // Hàm kiểm tra dùng chung cho API: cấp chưa bật hoặc ngoài phạm vi cấp của người dùng thì từ chối
  async assertCanAccess(currentUser: CurrentUser, code: string): Promise<void> {
    if (!(await this.forUser(currentUser)).includes(code as SchoolLevelCode)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Cấp học này chưa bật hoặc nằm ngoài phạm vi cấp học của bạn');
    }
  }

  // Cấp lọc của một yêu cầu theo tham số cấp dùng chung (DT-19 phần 19c, ?school_level=): có mã thì kiểm tra người dùng
  // được xem cấp đó rồi chỉ trả cấp đó; không gửi, trống hoặc "all" thì mọi cấp người dùng được xem (trường một cấp là cấp
  // đó, nên điểm cuối cũ trả như trước). Báo cáo, thống kê của 19d và DT-20, DT-21 đọc cấp lọc qua hàm này
  async requested(currentUser: CurrentUser, value: unknown): Promise<SchoolLevelCode[]> {
    if (value === undefined || value === null || value === '' || value === ALL_SCHOOL_LEVELS) {
      return this.forUser(currentUser);
    }
    if (!isSchoolLevelCode(value)) {
      throw validationError([{ field: SCHOOL_LEVEL_PARAMETER, message: 'Mã cấp là MN, TH, THCS, THPT hoặc all' }]);
    }
    await this.assertCanAccess(currentUser, value);
    return [value];
  }

  // Thuật ngữ của các cấp trong yêu cầu ("Trẻ" hay "Học sinh", thuật ngữ trường đặt ở 1.4), cùng cách tính với cổng quản
  // trị; dùng cho nhãn tệp xuất (YCTD-394)
  async requestedTerms(currentUser: CurrentUser, value: unknown): Promise<SchoolLevelTerms> {
    const codes = await this.requested(currentUser, value);
    return schoolLevelTerms((await this.all()).filter((level) => codes.includes(level.code)));
  }

  invalidate(): void {
    this.cache.delete(levelsKey());
  }
}
