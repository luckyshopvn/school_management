import { Injectable, Logger } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES, type AdmissionRecordType } from '@school-management/shared';
import { sql, type Kysely } from 'kysely';
import { randomUUID } from 'node:crypto';
import type { CurrentUser } from '../authentication/current-user.js';
import { ChildrenService } from '../children/children.service.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { maskNationalId } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { fileStamp } from '../facilities/facilities-workbook.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import {
  ENTRY_INTAKE_RULE,
  EntryIntakeService,
  isTransferable,
  type ActionResult,
  type IntakeRow,
} from './entry-intake.js';

// 1.6 Chuyển hồ sơ trúng tuyển sang CSDL, 1.7 Danh sách kết quả chuyển hồ sơ và 5.11 Danh sách trúng tuyển của phân hệ Mầm
// non (DT-17 phần 17d, khảo sát mục 10.2.4). Chuyển hồ sơ là tạo hồ sơ học sinh ở năm học nhận trẻ của đợt bằng đúng luồng
// QT-01 của hồ sơ trẻ như "chuyển thành hồ sơ trẻ" của YCTD-86: tạo hồ sơ, gửi trình duyệt, người có quyền duyệt ở đơn vị của
// lớp đã xếp thì duyệt và xếp lớp ngay (tài khoản phụ huynh theo số điện thoại). Chỉ năm học đang dùng ghi được dữ liệu
// (BR-93) nên năm học nhận trẻ phải đã tạo và đang mở; đợt tuyển sinh, hồ sơ chưa xong được chuyển sang năm học mới khi mở năm
// (bước admissions của YCTD-86). Mỗi lần chuyển một mã gói tin, mỗi hồ sơ một mã GUID; hồ sơ lỗi ghi kết quả kèm ghi chú và
// chuyển lại được ở lần sau
const TRANSFER = PERMISSION_CODES.entryIntakeTransfer;

// Bảng có cột child_id ghi khi tạo, duyệt hồ sơ học sinh hoặc thuộc phân hệ tuyển sinh; mọi bảng khác có dòng của học sinh là
// "đã phát sinh dữ liệu" (điểm danh, đón trả, học phí, sức khỏe…) nên không hủy nhập học được
const CREATION_TABLES = new Set([
  'health_profiles',
  'child_guardians',
  'class_enrollments',
  'photo_consent_histories',
  'child_group_members',
  'admission_transfer_results',
  'final_year_records',
  'admission_support_requests',
]);

export interface TransferResult {
  application_id: string;
  code: string;
  full_name: string;
  national_id: string;
  guid: string | null;
  succeeded: boolean;
  note: string;
}

function messageOf(error: unknown): string {
  if (error instanceof ApplicationError) {
    return [error.message, ...error.details.map((detail) => detail.message)].join('. ');
  }
  return error instanceof Error ? error.message : 'Lỗi không xác định';
}

@Injectable()
export class EntryIntakeTransferService {
  private readonly logger = new Logger(EntryIntakeTransferService.name);

  constructor(
    private readonly intake: EntryIntakeService,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly organizationScopes: OrganizationScopes,
    private readonly children: ChildrenService,
    private readonly clock: Clock,
  ) {}

  // Năm học nhận trẻ của đợt: chưa chọn, chưa tạo, chưa mở thì báo lỗi trước khi chuyển
  async assertTargetYear(rows: IntakeRow[]): Promise<void> {
    const current = await this.currentSchoolYear.require();
    const years = [...new Set(rows.map((row) => row.target_academic_year_id))];
    for (const yearId of years) {
      const campaign = rows.find((row) => row.target_academic_year_id === yearId)!.campaign_name;
      if (!yearId) {
        throw ruleViolationError(
          ENTRY_INTAKE_RULE,
          `Đợt tuyển sinh "${campaign}" chưa chọn năm học nhận trẻ; chọn ở nút "Đợt tuyển sinh" của 1.4`,
        );
      }
      if (yearId === current.academicYearId) {
        continue;
      }
      const year = await this.databases.system
        .selectFrom('academic_years')
        .select(['name', 'status'])
        .where('id', '=', yearId)
        .executeTakeFirst();
      throw ruleViolationError(
        ENTRY_INTAKE_RULE,
        !year
          ? `Năm học nhận trẻ của đợt "${campaign}" chưa được tạo; tạo và mở năm học trước khi chuyển hồ sơ`
          : year.status === 'closed'
            ? `Năm học ${year.name} đã đóng, không chuyển hồ sơ vào năm học đã đóng`
            : `Năm học ${year.name} chưa mở; mở năm học trước khi chuyển hồ sơ (đợt tuyển sinh chuyển sang năm học mới khi mở)`,
      );
    }
  }

  private async targetClass(database: Kysely<SchoolYearDatabase>, classId: string, row: IntakeRow) {
    const found = await database
      .selectFrom('classes')
      .select(['id', 'name', 'org_unit_id', 'status'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!found || found.status !== 'active') {
      throw validationError([{ field: 'class_id', message: 'Lớp không có hoặc đã đóng' }]);
    }
    if (row.org_unit_type !== 'truong_chinh' && found.org_unit_id !== row.org_unit_id) {
      throw validationError([{ field: 'class_id', message: 'Lớp không thuộc đơn vị của đợt tuyển sinh' }]);
    }
    return found;
  }

  // "Cập nhật" của 1.6: điểm trường nhận học sinh và loại hồ sơ (ô "Tự do") của các dòng trên lưới
  async updateRows(
    currentUser: CurrentUser,
    items: Array<{ id: string; target_org_unit_id: string | null; record_type: AdmissionRecordType }>,
    origin: ChangeOrigin,
  ): Promise<ActionResult> {
    const units = await this.intake.scopeUnits(currentUser, [TRANSFER]);
    const database = await this.intake.database();
    const rows = await this.intake.loadRows(database, { unitIds: units, ids: items.map((item) => item.id) });
    const activeUnits = await database
      .selectFrom('org_units')
      .select(['id'])
      .where('status', '=', 'active')
      .execute();
    const result: ActionResult = { done: 0, skipped: [] };
    await database.transaction().execute(async (transaction) => {
      for (const item of items) {
        const row = rows.find((candidate) => candidate.id === item.id);
        if (!row) {
          result.skipped.push({ id: item.id, full_name: '', reason: 'không có trong phạm vi của bạn' });
          continue;
        }
        if (row.status === 'converted' || row.status === 'cancelled') {
          result.skipped.push({ id: row.id, full_name: row.full_name, reason: 'đã chuyển hoặc đã hủy nhập học' });
          continue;
        }
        const unitId = item.target_org_unit_id;
        if (
          unitId &&
          (!activeUnits.some((unit) => unit.id === unitId) ||
            (row.org_unit_type !== 'truong_chinh' && unitId !== row.org_unit_id))
        ) {
          result.skipped.push({ id: row.id, full_name: row.full_name, reason: 'điểm trường không thuộc đơn vị của đợt' });
          continue;
        }
        if (unitId === row.target_org_unit_id && item.record_type === row.record_type) {
          continue;
        }
        await transaction
          .updateTable('admission_applications')
          .set({
            target_org_unit_id: unitId,
            record_type: item.record_type,
            // Lớp đã xếp ở điểm trường khác thì bỏ xếp lớp
            planned_class_id: unitId && row.planned_class_unit_id && row.planned_class_unit_id !== unitId ? null : row.planned_class_id,
            updated_at: this.clock.now(),
          })
          .where('id', '=', row.id)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'admission_applications',
          entityId: row.id,
          action: 'update',
          before: { target_org_unit_id: row.target_org_unit_id, record_type: row.record_type },
          after: { target_org_unit_id: unitId, record_type: item.record_type },
        });
        result.done += 1;
      }
    });
    return result;
  }

  // 5.11 bước 1: xếp lớp học sinh trúng tuyển (lớp trống là bỏ xếp lớp); lớp quyết định điểm trường nhận học sinh
  async arrange(
    currentUser: CurrentUser,
    ids: string[],
    classId: string | null,
    origin: ChangeOrigin,
  ): Promise<ActionResult> {
    const units = await this.intake.scopeUnits(currentUser, [TRANSFER]);
    const database = await this.intake.database();
    const rows = await this.intake.loadRows(database, { unitIds: units, ids });
    const result: ActionResult = { done: 0, skipped: [] };
    await database.transaction().execute(async (transaction) => {
      for (const id of ids) {
        const row = rows.find((candidate) => candidate.id === id);
        if (!row) {
          result.skipped.push({ id, full_name: '', reason: 'không có trong phạm vi của bạn' });
          continue;
        }
        if (!isTransferable(row)) {
          result.skipped.push({ id, full_name: row.full_name, reason: 'chưa trúng tuyển, đã chuyển hoặc phụ huynh từ chối' });
          continue;
        }
        const target = classId ? await this.targetClass(database, classId, row) : null;
        await transaction
          .updateTable('admission_applications')
          .set({
            planned_class_id: target?.id ?? null,
            target_org_unit_id: target ? target.org_unit_id : row.target_org_unit_id,
            updated_at: this.clock.now(),
          })
          .where('id', '=', id)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'admission_applications',
          entityId: id,
          action: 'update',
          before: { planned_class_id: row.planned_class_id },
          after: { planned_class_id: target?.id ?? null },
        });
        result.done += 1;
      }
    });
    return result;
  }

  // "Chuyển hồ sơ sang CSDL" (1.6) và 5.11 bước 2. clearClasses: người dùng chọn xóa lớp đã xếp ở hộp hỏi, hồ sơ học sinh chờ
  // duyệt và xếp lớp ở Hồ sơ học sinh. confirmDuplicates: vẫn chuyển hồ sơ trùng họ tên và ngày sinh với học sinh đã có
  async run(
    currentUser: CurrentUser,
    accessToken: string,
    ids: string[],
    options: { clearClasses: boolean; confirmDuplicates: boolean },
    origin: ChangeOrigin,
  ): Promise<{ package_code: string; results: TransferResult[] }> {
    const units = await this.intake.scopeUnits(currentUser, [TRANSFER]);
    const database = await this.intake.database();
    const rows = await this.intake.loadRows(database, { unitIds: units, ids, fullNationalId: true });
    if (rows.length === 0) {
      throw ruleViolationError(ENTRY_INTAKE_RULE, 'Chọn hồ sơ trúng tuyển trong phạm vi của bạn');
    }
    await this.assertTargetYear(rows);
    const packageCode = `GT-${fileStamp(this.clock.now())}-${randomUUID().slice(0, 4).toUpperCase()}`;
    const approveScope = currentUser.hasPermission(PERMISSION_CODES.childApprove)
      ? await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.childApprove)
      : null;
    const results: TransferResult[] = [];
    for (const row of rows) {
      const outcome = await this.transferOne(database, currentUser, accessToken, row, packageCode, options, origin, {
        canApprove: (unitId) => !!approveScope && (approveScope.wholeSchool || approveScope.orgUnitIds.includes(unitId)),
      });
      results.push({
        application_id: row.id,
        code: row.code,
        full_name: row.full_name,
        national_id: row.national_id ? maskNationalId(row.national_id.slice(-4)) : '',
        guid: outcome.guid,
        succeeded: outcome.succeeded,
        note: outcome.note,
      });
      await database
        .insertInto('admission_transfer_results')
        .values({
          kind: 'transfer',
          package_code: packageCode,
          application_id: row.id,
          guid: outcome.guid,
          child_id: outcome.childId,
          succeeded: outcome.succeeded,
          note: outcome.note,
          actor_user_id: origin.actorUserId,
          actor_name: origin.actorName,
        })
        .execute();
    }
    return { package_code: packageCode, results };
  }

  private async transferOne(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    accessToken: string,
    row: IntakeRow,
    packageCode: string,
    options: { clearClasses: boolean; confirmDuplicates: boolean },
    origin: ChangeOrigin,
    approval: { canApprove(unitId: string): boolean },
  ): Promise<{ guid: string | null; childId: string | null; succeeded: boolean; note: string }> {
    const fail = (note: string) => ({ guid: null, childId: null, succeeded: false, note });
    if (row.status === 'converted') {
      return fail('Hồ sơ đã chuyển sang CSDL');
    }
    if (!isTransferable(row)) {
      return fail(
        row.admission_decision === 'declined'
          ? 'Phụ huynh từ chối nhập học'
          : row.program_type === 'advanced' && row.school_review !== 'admitted'
            ? 'Trường chưa xác nhận trúng tuyển (1.3)'
            : 'Hồ sơ chưa trúng tuyển hoặc đã hủy nhập học',
      );
    }
    const missing: string[] = [];
    if (!row.has_national_id) {
      missing.push('số định danh cá nhân');
    }
    if (!row.guardian_relationship_item_id) {
      missing.push('quan hệ của người liên hệ với học sinh');
    }
    if (row.child_has_allergies === null) {
      missing.push('khai báo dị ứng');
    }
    const certificate = [...row.files].reverse().find((file) => file.kind === 'birth_certificate');
    if (!certificate) {
      missing.push('giấy khai sinh');
    }
    if (missing.length > 0) {
      return fail(`Thiếu ${missing.join(', ')}`);
    }
    const classId = options.clearClasses ? null : row.planned_class_id;
    const unitId = (classId ? row.planned_class_unit_id : null) ?? row.target_org_unit_id ?? row.org_unit_id;
    // Giấy khai sinh của hồ sơ tuyển sinh thành giấy khai sinh của hồ sơ học sinh ở điểm trường nhận
    await database
      .updateTable('files')
      .set({ purpose: 'birth_certificate', org_unit_id: unitId, updated_at: this.clock.now() })
      .where('id', '=', certificate!.id)
      .execute();
    let child: Awaited<ReturnType<ChildrenService['create']>>;
    try {
      child = await this.children.create(
        currentUser,
        accessToken,
        {
          org_unit_id: unitId,
          full_name: row.full_name,
          dob: row.dob,
          gender: row.gender,
          place_of_birth: row.place_of_birth,
          address: row.current_residence ?? row.address,
          national_id: row.national_id,
          moet_student_code: null,
          birth_certificate_file_id: certificate!.id,
          special_needs_note: null,
          note: null,
          is_staff_child: false,
          related_staff_user_id: null,
          related_staff_role_code: null,
          photo_consent: 'pending',
          photo_consent_file_id: null,
          health: {
            has_allergies: row.child_has_allergies,
            allergies: null,
            chronic_conditions: null,
            blood_type: null,
            note: null,
          },
          guardians: [
            {
              full_name: row.guardian_full_name,
              phone: row.guardian_phone,
              relationship_item_id: row.guardian_relationship_item_id ?? '',
              is_primary: true,
              occupation: null,
              email: row.guardian_email,
              address: row.current_residence ?? row.address,
            },
          ],
          confirm_possible_duplicate: options.confirmDuplicates,
        },
        origin,
      );
    } catch (error) {
      await database
        .updateTable('files')
        .set({ purpose: 'admission_document', org_unit_id: row.org_unit_id, updated_at: this.clock.now() })
        .where('id', '=', certificate!.id)
        .execute();
      return fail(messageOf(error));
    }
    const guid = randomUUID();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('admission_applications')
        .set({
          status: 'converted',
          created_child_id: child.id,
          planned_class_id: classId,
          target_org_unit_id: unitId,
          converted_by: origin.actorUserId,
          converted_at: this.clock.now(),
          transfer_package_code: packageCode,
          transfer_guid: guid,
          transferred_by_name: origin.actorName,
          updated_at: this.clock.now(),
        })
        .where('id', '=', row.id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: row.org_unit_id,
        entityName: 'admission_applications',
        entityId: row.id,
        action: 'update',
        before: { status: row.status },
        after: { status: 'converted', created_child_id: child.id, package_code: packageCode, guid },
      });
    });
    let note = 'Đã tạo hồ sơ học sinh, chờ duyệt và xếp lớp';
    try {
      await this.children.submit(currentUser, accessToken, child.id, origin);
      if (classId && approval.canApprove(unitId)) {
        await this.children.approve(
          currentUser,
          accessToken,
          child.id,
          { classId, confirmOverCapacity: false },
          origin,
        );
        note = `Đã tạo hồ sơ học sinh, xếp lớp ${row.planned_class_name ?? ''}`.trim();
      }
    } catch (error) {
      // Ví dụ lớp đủ sĩ số, chưa tạo được tài khoản phụ huynh: hồ sơ học sinh duyệt lại ở trang Hồ sơ học sinh
      this.logger.warn(`Chưa duyệt được học sinh ${child.id} sau khi chuyển hồ sơ: ${messageOf(error)}`);
      note = `Đã tạo hồ sơ học sinh; chưa xếp lớp: ${messageOf(error)}`;
    }
    return { guid, childId: child.id, succeeded: true, note };
  }

  // Bảng kết quả của một lần chuyển (1.6 "Xem kết quả đồng bộ") hoặc hủy nhập học (1.7 "Xem kết quả hủy nhập học")
  async results(currentUser: CurrentUser, kind: 'transfer' | 'cancel', packageCode: string | null) {
    const units = await this.intake.scopeUnits(currentUser, [
      PERMISSION_CODES.entryIntakeView,
      PERMISSION_CODES.entryIntakeManage,
      TRANSFER,
    ]);
    const database = await this.intake.database();
    let query = database
      .selectFrom('admission_transfer_results as r')
      .innerJoin('admission_applications as a', 'a.id', 'r.application_id')
      .leftJoin('children as ch', 'ch.id', 'r.child_id')
      .select([
        'r.id',
        'r.package_code',
        'r.guid',
        'r.succeeded',
        'r.note',
        'r.actor_name',
        'r.created_at',
        'a.id as application_id',
        'a.code',
        'a.child_full_name as full_name',
        'a.child_national_id_last4',
        'ch.moet_student_code',
      ])
      .where('r.kind', '=', kind)
      .orderBy('r.created_at', 'desc')
      .limit(2000);
    if (units) {
      query = query.where('a.org_unit_id', 'in', units);
    }
    if (packageCode) {
      query = query.where('r.package_code', '=', packageCode);
    }
    const rows = await query.execute();
    const packages = [...new Set(rows.map((row) => row.package_code))];
    return {
      packages,
      items: rows.map(({ child_national_id_last4: last4, moet_student_code: studentCode, ...row }) => ({
        ...row,
        student_code: studentCode ?? row.code,
        national_id: last4 ? maskNationalId(last4) : '',
      })),
    };
  }

  // Bảng có dữ liệu của học sinh ngoài các bảng ghi lúc tạo, duyệt hồ sơ
  async generatedDataTables(database: Kysely<SchoolYearDatabase>, childId: string): Promise<string[]> {
    const tables = await sql<{ table_name: string }>`select table_name from information_schema.columns
      where table_schema = current_schema() and column_name = 'child_id'`.execute(database);
    const found: string[] = [];
    for (const { table_name: table } of tables.rows) {
      if (CREATION_TABLES.has(table)) {
        continue;
      }
      const row = await sql`select 1 from ${sql.table(table)} where child_id = ${childId} limit 1`.execute(database);
      if (row.rows.length > 0) {
        found.push(table);
      }
    }
    return found;
  }

  // "Hủy nhập học" của 1.7: chỉ hồ sơ học sinh chưa phát sinh dữ liệu; hồ sơ học sinh xóa mềm như "Xóa" hồ sơ nháp (giải phóng
  // số định danh), bỏ khỏi lớp, hồ sơ tuyển sinh ghi đã hủy nhập học. Tài khoản phụ huynh đã cấp giữ lại vì có thể dùng cho
  // con khác
  async cancel(currentUser: CurrentUser, ids: string[], origin: ChangeOrigin) {
    const units = await this.intake.scopeUnits(currentUser, [TRANSFER]);
    const database = await this.intake.database();
    const rows = await this.intake.loadRows(database, { unitIds: units, ids });
    const packageCode = `HN-${fileStamp(this.clock.now())}-${randomUUID().slice(0, 4).toUpperCase()}`;
    const results: TransferResult[] = [];
    for (const id of ids) {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) {
        continue;
      }
      let note: string;
      let succeeded = false;
      if (row.status !== 'converted' || !row.created_child_id) {
        note = row.status === 'cancelled' ? 'Hồ sơ đã hủy nhập học' : 'Hồ sơ chưa chuyển sang CSDL; hủy ở 1.4';
      } else {
        const tables = await this.generatedDataTables(database, row.created_child_id);
        if (tables.length > 0) {
          note = `Hồ sơ học sinh đã phát sinh dữ liệu (${tables.join(', ')}); xử lý bằng thôi học ở Hồ sơ học sinh`;
        } else {
          const childId = row.created_child_id;
          await database.transaction().execute(async (transaction) => {
            const child = await transaction
              .selectFrom('children')
              .select(['national_id_hash', 'org_unit_id', 'status'])
              .where('id', '=', childId)
              .executeTakeFirstOrThrow();
            await transaction
              .updateTable('children')
              .set({
                deleted_at: this.clock.now(),
                deleted_by: origin.actorUserId,
                national_id_hash: `deleted:${childId}:${child.national_id_hash}`,
                moet_student_code: null,
                updated_at: this.clock.now(),
              })
              .where('id', '=', childId)
              .execute();
            await transaction
              .updateTable('class_enrollments')
              .set({ is_current: false, updated_at: this.clock.now() })
              .where('child_id', '=', childId)
              .where('is_current', '=', true)
              .execute();
            await transaction.deleteFrom('child_group_members').where('child_id', '=', childId).execute();
            await transaction
              .updateTable('admission_applications')
              .set({
                status: 'cancelled',
                cancelled_at: this.clock.now(),
                cancelled_by_name: origin.actorName,
                updated_at: this.clock.now(),
              })
              .where('id', '=', row.id)
              .execute();
            await writeAuditLog(transaction, {
              origin,
              orgUnitId: child.org_unit_id,
              entityName: 'children',
              entityId: childId,
              action: 'delete',
              before: { status: child.status, admission_application: row.code },
              after: { deleted: true, reason: 'Hủy nhập học' },
            });
          });
          note = 'Đã hủy nhập học';
          succeeded = true;
        }
      }
      results.push({
        application_id: row.id,
        code: row.code,
        full_name: row.full_name,
        national_id: row.national_id,
        guid: row.transfer_guid,
        succeeded,
        note,
      });
      await database
        .insertInto('admission_transfer_results')
        .values({
          kind: 'cancel',
          package_code: packageCode,
          application_id: row.id,
          guid: row.transfer_guid,
          child_id: row.created_child_id,
          succeeded,
          note,
          actor_user_id: origin.actorUserId,
          actor_name: origin.actorName,
        })
        .execute();
    }
    return { package_code: packageCode, results };
  }
}
