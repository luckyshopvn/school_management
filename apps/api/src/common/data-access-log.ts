import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { SettingsService } from '../settings/settings.service.js';
import type { ChangeOrigin } from './audit-log.js';
import { CurrentSchoolYearResolver } from './current-school-year.js';

// Nhật ký truy cập dữ liệu nhạy cảm; xem đầy đủ số định danh và giấy khai sinh luôn ghi, không tắt được (BR-73, BR-81)
export async function writeDataAccessLog(
  database: Kysely<SchoolYearDatabase>,
  entry: { origin: ChangeOrigin; orgUnitId: string; entityName: string; entityId: string; scope: string },
): Promise<void> {
  await database
    .insertInto('data_access_logs')
    .values({
      actor_user_id: entry.origin.actorUserId,
      actor_name: entry.origin.actorName,
      org_unit_id: entry.orgUnitId,
      entity_name: entry.entityName,
      entity_id: entry.entityId,
      scope: entry.scope,
      ip_address: entry.origin.ipAddress,
    })
    .execute();
}

// Đọc dữ liệu cá nhân của trẻ và dữ liệu tài chính chỉ ghi nhật ký khi đơn vị của trẻ bật `data_access_logging`
// (BR-73, YCTD-70); đơn vị chưa cấu hình thì theo Trường chính, chưa cấu hình nữa thì không ghi
@Injectable()
export class DataAccessLogger {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly settings: SettingsService,
  ) {}

  async recordChildRead(origin: ChangeOrigin, childId: string, scope: 'child_profile' | 'finance'): Promise<void> {
    const { database } = await this.currentSchoolYear.require();
    const child = await database
      .selectFrom('children')
      .select('org_unit_id')
      .where('id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      return;
    }
    const setting = (await this.settings.effective(child.org_unit_id)).find(
      (item) => item.key === 'data_access_logging',
    );
    if (setting?.value !== true) {
      return;
    }
    await writeDataAccessLog(database, {
      origin,
      orgUnitId: child.org_unit_id,
      entityName: 'children',
      entityId: childId,
      scope,
    });
  }
}
