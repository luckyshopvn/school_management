import { Injectable } from '@nestjs/common';
import { ApplicationError, ruleViolationError } from '@school-management/server';
import type { CurrentUser } from '../../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../../common/current-school-year.js';
import type { RequestBody } from '../../common/request-fields.js';
import { LearningService } from '../learning.js';

// Học khi mạng yếu (DT-28 phần 28j, YCTD-280; GD-148 đã chốt 2026-10-27): tắt mặc định, Ban Giám hiệu
// bật. Khi bật, màn hình học tập của học sinh giữ bản nháp câu trả lời, ảnh, ghi âm chờ gửi và nội dung hoạt động đã mở của chính
// em trên máy (IndexedDB theo nguồn gốc của trường), tối đa `retention_days` ngày (mặc định và tối đa 7), xoá khi nộp xong hoặc
// đăng xuất; hàng đợi gửi lại kèm mã chống trùng. Máy chủ chỉ giữ cấu hình; dữ liệu trên máy do mô-đun `offline` của ứng dụng
// học sinh lo, gỡ được riêng
export const OFFLINE_RULE_CODE = 'YCTD-280';
const CONFIG_KEY = 'learning_offline';
export const MAXIMUM_RETENTION_DAYS = 7;

export interface OfflineConfig {
  enabled: boolean;
  retention_days: number;
}

export function offlineConfigOf(value: unknown): OfflineConfig {
  const raw = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const days = raw.retention_days;
  return {
    enabled: raw.enabled === true,
    retention_days:
      typeof days === 'number' && Number.isInteger(days) && days >= 1 && days <= MAXIMUM_RETENTION_DAYS
        ? days
        : MAXIMUM_RETENTION_DAYS,
  };
}

@Injectable()
export class OfflineLearningService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly learning: LearningService,
  ) {}

  private async read() {
    const { database } = await this.currentSchoolYear.require();
    const row = await database
      .selectFrom('settings')
      .innerJoin('org_units', 'org_units.id', 'settings.org_unit_id')
      .select('settings.value')
      .where('org_units.unit_type', '=', 'truong_chinh')
      .where('settings.key', '=', CONFIG_KEY)
      .executeTakeFirst();
    return offlineConfigOf(row?.value);
  }

  private async assertLeadership(currentUser: CurrentUser) {
    const context = await this.learning.context(currentUser);
    if (!(context.canDecide || (context.canView && context.canApprove))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu bật, tắt học khi mạng yếu');
    }
  }

  async config(currentUser: CurrentUser) {
    await this.assertLeadership(currentUser);
    return this.read();
  }

  async saveConfig(currentUser: CurrentUser, body: RequestBody) {
    await this.assertLeadership(currentUser);
    const days = body?.retention_days ?? MAXIMUM_RETENTION_DAYS;
    if (
      typeof body?.enabled !== 'boolean' ||
      typeof days !== 'number' ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > MAXIMUM_RETENTION_DAYS
    ) {
      throw ruleViolationError(OFFLINE_RULE_CODE, 'Cấu hình học khi mạng yếu chưa hợp lệ', [
        { field: 'retention_days', message: `Số ngày giữ trên máy từ 1 đến ${MAXIMUM_RETENTION_DAYS}` },
      ]);
    }
    const config: OfflineConfig = { enabled: body.enabled, retention_days: days };
    const { database } = await this.currentSchoolYear.require();
    const unit = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    if (!unit) {
      throw ruleViolationError(OFFLINE_RULE_CODE, 'Chưa có Trường chính để lưu cấu hình');
    }
    await database
      .insertInto('settings')
      .values({ org_unit_id: unit.id, key: CONFIG_KEY, value_type: 'text', value: JSON.stringify(config) })
      .onConflict((conflict) => conflict.columns(['org_unit_id', 'key']).doUpdateSet({ value: JSON.stringify(config) }))
      .execute();
    return config;
  }

  // Học sinh (kênh student) đọc cấu hình để biết có giữ dữ liệu trên máy không, giữ bao lâu
  async studentConfig(currentUser: CurrentUser) {
    await this.learning.studentContext(currentUser);
    return this.read();
  }
}
