import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ruleViolationError } from '@school-management/server';
import type { Kysely, Transaction } from 'kysely';
import { SettingsService } from '../settings/settings.service.js';

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

// Sĩ số tối đa áp dụng là số nhỏ hơn giữa sĩ số của lớp và cấu hình `max_class_size` của đơn vị quản lý lớp (kế thừa
// Trường chính). Vượt sĩ số thì cảnh báo, quản lý đơn vị xác nhận thì vẫn phân lớp (BR-04, AC-10, YCTD-70)
@Injectable()
export class ClassCapacity {
  constructor(private readonly settings: SettingsService) {}

  async limitOf(classRecord: { org_unit_id: string; max_size: number }): Promise<number> {
    const setting = (await this.settings.effective(classRecord.org_unit_id)).find(
      (item) => item.key === 'max_class_size',
    );
    return typeof setting?.value === 'number' ? Math.min(classRecord.max_size, setting.value) : classRecord.max_size;
  }

  async assert(
    database: Executor,
    classRecord: { id: string; org_unit_id: string; max_size: number },
    confirmed: boolean,
  ): Promise<void> {
    const limit = await this.limitOf(classRecord);
    const enrolled = await database
      .selectFrom('class_enrollments')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('class_id', '=', classRecord.id)
      .where('is_current', '=', true)
      .executeTakeFirstOrThrow();
    if (Number(enrolled.count) >= limit && !confirmed) {
      throw ruleViolationError('BR-04', 'Lớp đã đủ sĩ số, xác nhận để tiếp tục', [
        { field: 'enrolled_count', message: enrolled.count },
        { field: 'max_size', message: String(limit) },
      ]);
    }
  }
}
