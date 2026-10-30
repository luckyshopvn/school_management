import { Injectable } from '@nestjs/common';
import { sql, type Kysely, type Transaction } from 'kysely';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { CurrentUser } from '../authentication/current-user.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

// Phạm vi ghi nhận, xem rèn luyện từng học sinh (YCTD-391 lát L2; Eric chọn người ghi là giám thị, giáo viên chủ nhiệm, giáo viên
// bộ môn). Lớp được ghi nhận là hợp của:
// - lớp trong phạm vi đơn vị của người có quyền quản lý rèn luyện (Ban Giám hiệu);
// - lớp mình chủ nhiệm hoặc dạy (phân công đang hiệu lực);
// - lớp thuộc cấp và khối của phân công trực đang dùng của mình, trong phạm vi đơn vị của quyền ghi nhận.
// Lớp được xem giống lớp được ghi nhận; ngoài ra ai cũng xem được ghi nhận do chính mình ghi. Lớp Mầm non không có rèn luyện
@Injectable()
export class SupervisionAccess {
  constructor(private readonly organizationScopes: OrganizationScopes) {}

  async classIds(currentUser: CurrentUser, database: Executor): Promise<Set<string>> {
    const result = new Set<string>();
    const activeClasses = () =>
      database
        .selectFrom('classes')
        .select(['id', 'org_unit_id', 'school_level', 'grade_level'])
        .where('status', '=', 'active')
        .where('school_level', '!=', 'MN');
    if (currentUser.hasPermission(PERMISSION_CODES.supervisionManage)) {
      const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.supervisionManage);
      const rows = await activeClasses()
        .$if(!scope.wholeSchool, (query) =>
          query.where('org_unit_id', 'in', [...scope.orgUnitIds, '00000000-0000-0000-0000-000000000000']),
        )
        .execute();
      rows.forEach((row) => result.add(row.id));
    }
    const taught = await database
      .selectFrom('class_staff_assignments')
      .innerJoin('classes', 'classes.id', 'class_staff_assignments.class_id')
      .select('class_staff_assignments.class_id')
      .where('class_staff_assignments.staff_user_id', '=', currentUser.id)
      .where('class_staff_assignments.status', '=', 'active')
      .where('classes.status', '=', 'active')
      .where('classes.school_level', '!=', 'MN')
      .execute();
    taught.forEach((row) => result.add(row.class_id));
    const duties = await database
      .selectFrom('supervision_assignments')
      .innerJoin('staff', 'staff.id', 'supervision_assignments.staff_id')
      .select(['supervision_assignments.school_level', 'supervision_assignments.grade_levels'])
      .where('staff.user_id', '=', currentUser.id)
      .where('staff.status', '=', 'active')
      .where('supervision_assignments.status', '=', 'active')
      .execute();
    if (duties.length > 0 && currentUser.hasPermission(PERMISSION_CODES.supervisionRecord)) {
      const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.supervisionRecord);
      const rows = await activeClasses()
        .$if(!scope.wholeSchool, (query) =>
          query.where('org_unit_id', 'in', [...scope.orgUnitIds, '00000000-0000-0000-0000-000000000000']),
        )
        .execute();
      for (const row of rows) {
        const covered = duties.some(
          (duty) =>
            duty.school_level === row.school_level &&
            (duty.grade_levels.length === 0 || duty.grade_levels.includes(row.grade_level)),
        );
        if (covered) {
          result.add(row.id);
        }
      }
    }
    return result;
  }

  async assertCanViewRecord(
    currentUser: CurrentUser,
    database: Executor,
    record: { class_id: string; recorded_by: string },
  ): Promise<void> {
    if (record.recorded_by === currentUser.id) {
      return;
    }
    if (!(await this.classIds(currentUser, database)).has(record.class_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem ghi nhận này');
    }
  }
}

// Ghi nhận có gắn tệp ảnh bằng chứng; dùng khi tải tệp mục đích `conduct_evidence`
export function conductRecordOfFile(database: Executor, fileId: string) {
  return database
    .selectFrom('student_conduct_records')
    .select(['class_id', 'recorded_by'])
    .where(sql<boolean>`evidence_file_ids @> array[${fileId}]::uuid[]`)
    .executeTakeFirst();
}
