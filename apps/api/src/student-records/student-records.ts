import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { sql, type Kysely, type Transaction } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { ChildScope } from '../children/child-scope.js';
import { buildStudentWorkbook, fileStamp, sendWorkbook } from '../children/student-workbook.js';
import { findStudents, readStudentListFilter, type StudentListFilter } from '../children/student-list.js';
import { ClassCapacity } from '../classes/class-capacity.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, readRequiredText, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { foldText } from '../imports/moet-columns.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { buildMoetChildFile, loadMoetChildRows } from './moet-child-file.js';
import {
  assertInScope,
  BULK_LIMIT,
  inScope,
  logExportedFile,
  STUDENT_RECORDS_RULE_CODE,
  studentEditScope,
  VIETNAM_DATE,
} from './student-records-common.js';

// Hồ sơ học sinh đủ theo hệ thống của Sở (DT-16 phần 16g, khảo sát `31_KHAO_SAT_HE_THONG_SO.md` mục 3.4):
// - 4.1.1: Xóa hồ sơ nháp (không xóa cứng); "Cấp mã định danh Bộ" chạy nội bộ: nhập tay mã do Bộ cấp, xuất tệp theo mẫu
//   82 cột của Bộ cho học sinh chưa có mã để nộp; "Xuất file lỗi": hồ sơ thiếu hoặc sai ô bắt buộc của CSDL ngành;
// - 4.1.3: số thứ tự cố định trong lớp, sắp xếp A–Z theo lớp chọn hoặc tất cả lớp, đổi thứ tự bằng tay;
// - 4.1.5: chọn điện thoại nhận tin hàng loạt theo quan hệ (cha, mẹ, người giám hộ, liên hệ chính);
// - 4.2: chuyển lớp hàng loạt (chọn nhanh lớp mới cho nhiều học sinh)
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const MOET_FILE_LIMIT = 10_000;
const ORDER_CLASS_LIMIT = 500;

export type SmsRelation = 'father' | 'mother' | 'legal_guardian' | 'primary' | 'none';
const SMS_RELATIONS: SmsRelation[] = ['father', 'mother', 'legal_guardian', 'primary', 'none'];
const RELATION_NAMES: Record<'father' | 'mother' | 'legal_guardian', string[]> = {
  father: ['cha', 'bo', 'ba'],
  mother: ['me', 'ma'],
  legal_guardian: ['nguoi giam ho', 'giam ho'],
};

// A–Z theo tên (từ cuối của họ tên) rồi theo họ tên, thứ tự chữ cái tiếng Việt như danh sách học sinh (mục 4.1.3)
const GIVEN_NAME_ORDER = sql`regexp_replace(trim(children.full_name), '^.*\\s', '') collate "vi-x-icu"`;
const FULL_NAME_ORDER = sql`children.full_name collate "vi-x-icu"`;

// Ô bắt buộc của tệp CSDL ngành dùng cho "Xuất file lỗi"
export function studentRecordErrors(input: {
  status: string;
  class_name: string | null;
  profile: Record<string, unknown> | null;
  guardians: Array<{ full_name: string; phone: string | null }>;
}): string[] {
  const profile = input.profile ?? {};
  const text = (key: string) => (typeof profile[key] === 'string' ? (profile[key] as string).trim() : '');
  const errors: string[] = [];
  if (input.status === 'active' && !input.class_name) {
    errors.push('Chưa xếp lớp');
  }
  if (!text('ethnicity')) {
    errors.push('Thiếu dân tộc');
  }
  if (!text('nationality')) {
    errors.push('Thiếu quốc tịch');
  }
  if (!text('permanent_province') || !text('permanent_ward')) {
    errors.push('Thiếu tỉnh/thành phố, xã/phường thường trú');
  } else if (text('permanent_district')) {
    errors.push('Địa chỉ thường trú còn theo địa danh cũ (còn quận/huyện), chuyển ở 4.1.11');
  }
  if (input.guardians.length === 0) {
    errors.push('Thiếu thông tin cha, mẹ hoặc người giám hộ');
  } else if (!input.guardians.some((guardian) => guardian.phone)) {
    errors.push('Thiếu số điện thoại liên hệ của cha, mẹ hoặc người giám hộ');
  }
  return errors;
}

@Injectable()
export class StudentRecordsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly childScope: ChildScope,
    private readonly protection: ChildDataProtection,
    private readonly capacity: ClassCapacity,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  private async findChild(database: Executor, childId: string) {
    const child = await database
      .selectFrom('children')
      .select(['id', 'org_unit_id', 'status', 'full_name', 'national_id_hash', 'moet_student_code'])
      .where('id', '=', childId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Hồ sơ không tồn tại hoặc đã bị xóa khỏi phạm vi của bạn', 'child');
    }
    return child;
  }

  // Xóa hồ sơ (nút "Xóa" của Sở): chỉ hồ sơ nháp (gồm hồ sơ bị từ chối về nháp) vì chưa có lớp, học phí, điểm danh. Không xóa
  // cứng: ghi ngày, người xóa; số định danh và mã định danh Bộ được giải phóng để lập lại hồ sơ đúng
  async remove(currentUser: CurrentUser, childId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childManage, child.org_unit_id);
    if (child.status !== 'draft') {
      throw ruleViolationError(
        STUDENT_RECORDS_RULE_CODE,
        'Chỉ xóa được hồ sơ nháp; học sinh đã duyệt xử lý bằng thôi học hoặc chuyển trường',
      );
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('children')
        .set({
          deleted_at: this.clock.now(),
          deleted_by: origin.actorUserId,
          national_id_hash: `deleted:${child.id}:${child.national_id_hash}`,
          moet_student_code: null,
          updated_at: this.clock.now(),
        })
        .where('id', '=', child.id)
        .execute();
      await transaction.deleteFrom('child_group_members').where('child_id', '=', child.id).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'children',
        entityId: child.id,
        action: 'delete',
        before: { full_name: child.full_name, status: child.status, moet_student_code: child.moet_student_code },
        after: { deleted: true },
      });
    });
    return { deleted: true };
  }

  // "Cấp mã định danh Bộ" nhập tay: ghi mã do Bộ cấp cho từng học sinh; mã không trùng học sinh khác
  async assignMoetCodes(
    currentUser: CurrentUser,
    items: Array<{ child_id: string; moet_student_code: string }>,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.childManage);
    const children = await database
      .selectFrom('children')
      .select(['id', 'org_unit_id', 'full_name', 'moet_student_code', 'status'])
      .where(
        'id',
        'in',
        items.map((item) => item.child_id),
      )
      .where('deleted_at', 'is', null)
      .execute();
    const errors: FieldError[] = [];
    const codes = items.map((item) => item.moet_student_code);
    for (const [index, item] of items.entries()) {
      const child = children.find((row) => row.id === item.child_id);
      if (!child || !inScope(scope, child.org_unit_id)) {
        errors.push({ field: `items.${index}.child_id`, message: 'Học sinh không có trong phạm vi của bạn' });
        continue;
      }
      if (codes.indexOf(item.moet_student_code) !== index) {
        errors.push({ field: `items.${index}.moet_student_code`, message: `${child.full_name}: mã trùng dòng khác` });
        continue;
      }
      const owner = await database
        .selectFrom('children')
        .select('full_name')
        .where('moet_student_code', '=', item.moet_student_code)
        .where('id', '!=', child.id)
        .executeTakeFirst();
      if (owner) {
        errors.push({
          field: `items.${index}.moet_student_code`,
          message: `${child.full_name}: mã đã gán cho học sinh ${owner.full_name}`,
        });
      }
    }
    if (errors.length > 0) {
      throw ruleViolationError(STUDENT_RECORDS_RULE_CODE, 'Không ghi được mã định danh Bộ GD&ĐT', errors);
    }
    await database.transaction().execute(async (transaction) => {
      for (const item of items) {
        const child = children.find((row) => row.id === item.child_id);
        if (!child || child.moet_student_code === item.moet_student_code) {
          continue;
        }
        await transaction
          .updateTable('children')
          .set({ moet_student_code: item.moet_student_code, updated_at: this.clock.now() })
          .where('id', '=', child.id)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: child.org_unit_id,
          entityName: 'children',
          entityId: child.id,
          action: 'update',
          before: { moet_student_code: child.moet_student_code },
          after: { moet_student_code: item.moet_student_code, manual_assignment: true },
        });
      }
    });
    return { assigned: items.length };
  }

  // Tệp theo mẫu 82 cột của Bộ cho học sinh theo bộ lọc (mặc định học sinh chưa có mã định danh Bộ) để nộp đề nghị cấp mã.
  // Tệp có số định danh đầy đủ nên cần quyền xem số định danh cùng quyền xuất dữ liệu; ghi nhật ký xuất (BR-74)
  async moetFile(currentUser: CurrentUser, filter: StudentListFilter, ipAddress: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.childScope.resolve(currentUser, database);
    const hash = filter.nationalId ? this.protection.hash(filter.nationalId) : null;
    const { total, rows } = await findStudents(database, this.childScope, scope, filter, hash, {
      limit: MOET_FILE_LIMIT,
      offset: 0,
    });
    if (total > MOET_FILE_LIMIT) {
      throw ruleViolationError(STUDENT_RECORDS_RULE_CODE, `Tối đa ${MOET_FILE_LIMIT} học sinh mỗi tệp, thu hẹp bộ lọc`);
    }
    if (total === 0) {
      throw ruleViolationError(STUDENT_RECORDS_RULE_CODE, 'Không có học sinh nào theo bộ lọc');
    }
    const data = await loadMoetChildRows(
      database,
      this.protection,
      rows.map((row) => row.id),
    );
    const createdAt = this.clock.now();
    return logExportedFile(database, currentUser, {
      reportCode: 'moet-student-file',
      fileName: `hoc-sinh-theo-mau-bo-${fileStamp(createdAt)}.xlsx`,
      buffer: await buildMoetChildFile(data.map((row) => row.values)),
      rowCount: data.length,
      orgUnitIds: [...new Set(rows.map((row) => row.org_unit_id))],
      filters: { ...filter, nationalId: filter.nationalId ? 'đã nhập' : undefined },
      ipAddress,
    });
  }

  // "Xuất file lỗi": hồ sơ theo bộ lọc thiếu hoặc sai ô bắt buộc của tệp CSDL ngành, mỗi hồ sơ một dòng kèm nội dung lỗi
  async errorFile(currentUser: CurrentUser, filter: StudentListFilter, ipAddress: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.childScope.resolve(currentUser, database);
    const hash = filter.nationalId ? this.protection.hash(filter.nationalId) : null;
    const { total, rows } = await findStudents(database, this.childScope, scope, filter, hash, {
      limit: MOET_FILE_LIMIT,
      offset: 0,
    });
    if (total > MOET_FILE_LIMIT) {
      throw ruleViolationError(STUDENT_RECORDS_RULE_CODE, `Tối đa ${MOET_FILE_LIMIT} học sinh mỗi tệp, thu hẹp bộ lọc`);
    }
    const ids = rows.map((row) => row.id);
    const profiles = ids.length
      ? await database.selectFrom('children').select(['id', 'moet_profile']).where('id', 'in', ids).execute()
      : [];
    const guardians = ids.length
      ? await database
          .selectFrom('child_guardians')
          .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
          .select(['child_guardians.child_id', 'guardians.full_name', 'guardians.phone'])
          .where('child_guardians.child_id', 'in', ids)
          .execute()
      : [];
    const failing = rows.flatMap((row) => {
      const errors = studentRecordErrors({
        status: row.status,
        class_name: row.class_name,
        profile: profiles.find((item) => item.id === row.id)?.moet_profile ?? null,
        guardians: guardians.filter((guardian) => guardian.child_id === row.id),
      });
      return errors.length
        ? [
            {
              moet_student_code: row.moet_student_code ?? '',
              full_name: row.full_name,
              dob: row.dob.split('-').reverse().join('/'),
              class: row.class_name ?? '',
              errors: errors.join('; '),
            },
          ]
        : [];
    });
    if (failing.length === 0) {
      throw ruleViolationError(STUDENT_RECORDS_RULE_CODE, 'Không có hồ sơ nào thiếu hoặc sai ô bắt buộc theo bộ lọc');
    }
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'children-error-file',
      title: 'Hồ sơ học sinh thiếu hoặc sai thông tin',
      fileName: `hoc-sinh-file-loi-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter, nationalId: filter.nationalId ? 'đã nhập' : undefined },
      orgUnitIds: [...new Set(rows.map((row) => row.org_unit_id))],
      columns: [
        { key: 'moet_student_code', label: 'Mã định danh Bộ GD&ĐT' },
        { key: 'full_name', label: 'Họ tên' },
        { key: 'dob', label: 'Ngày sinh' },
        { key: 'class', label: 'Lớp' },
        { key: 'errors', label: 'Nội dung lỗi' },
      ],
      rows: failing,
      ipAddress,
      createdAt,
    });
  }

  // Chuyển lớp hàng loạt (mục 4.2 của Sở): mỗi học sinh đang học chọn lớp mới cùng đơn vị; kiểm tra sĩ số theo số học sinh
  // vào, ra của từng lớp. Có một dòng không hợp lệ thì không chuyển học sinh nào
  async bulkTransferClass(
    currentUser: CurrentUser,
    input: {
      items: Array<{ child_id: string; class_id: string }>;
      fromDate: string | null;
      reason: string;
      confirmOverCapacity: boolean;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.childApprove);
    const fromDate = input.fromDate ?? this.today();
    const childIds = input.items.map((item) => item.child_id);
    const children = await database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .select([
        'children.id',
        'children.org_unit_id',
        'children.full_name',
        'children.status',
        'class_enrollments.id as enrollment_id',
        'class_enrollments.class_id',
        'class_enrollments.from_date',
      ])
      .where('children.id', 'in', childIds)
      .where('children.deleted_at', 'is', null)
      .execute();
    const classIds = [...new Set(input.items.map((item) => item.class_id))];
    const classes = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'name', 'max_size', 'status'])
      .where('id', 'in', classIds)
      .execute();
    const errors: FieldError[] = [];
    for (const [index, item] of input.items.entries()) {
      const child = children.find((row) => row.id === item.child_id);
      const target = classes.find((row) => row.id === item.class_id);
      const field = `items.${index}`;
      if (!child || !inScope(scope, child.org_unit_id)) {
        errors.push({ field, message: 'Học sinh không có trong phạm vi của bạn' });
      } else if (child.status !== 'active') {
        errors.push({ field, message: `${child.full_name}: chỉ chuyển lớp được học sinh đang học` });
      } else if (!target || target.status !== 'active') {
        errors.push({ field, message: `${child.full_name}: lớp mới không có hoặc đã ngừng` });
      } else if (target.org_unit_id !== child.org_unit_id) {
        errors.push({ field, message: `${child.full_name}: lớp mới thuộc đơn vị khác, dùng chuyển đơn vị (P02-07)` });
      } else if (child.class_id === target.id) {
        errors.push({ field, message: `${child.full_name}: đang học lớp ${target.name}` });
      } else if (child.from_date && fromDate < child.from_date) {
        errors.push({ field, message: `${child.full_name}: ngày hiệu lực trước ngày vào lớp hiện tại` });
      }
    }
    if (errors.length > 0) {
      throw ruleViolationError(STUDENT_RECORDS_RULE_CODE, 'Không chuyển được lớp cho các học sinh đã chọn', errors);
    }
    // Sĩ số sau khi chuyển: số đang học cộng số vào trừ số ra
    if (!input.confirmOverCapacity) {
      for (const target of classes) {
        const incoming = input.items.filter((item) => item.class_id === target.id).length;
        const outgoing = children.filter((child) => child.class_id === target.id).length;
        const enrolled = await database
          .selectFrom('class_enrollments')
          .select((expression) => expression.fn.countAll<string>().as('count'))
          .where('class_id', '=', target.id)
          .where('is_current', '=', true)
          .executeTakeFirstOrThrow();
        const limit = await this.capacity.limitOf(target);
        if (Number(enrolled.count) + incoming - outgoing > limit) {
          throw ruleViolationError('BR-04', `Lớp ${target.name} vượt sĩ số tối đa ${limit}, xác nhận để tiếp tục`, [
            { field: 'class_id', message: target.name },
          ]);
        }
      }
    }
    await database.transaction().execute(async (transaction) => {
      for (const item of input.items) {
        const child = children.find((row) => row.id === item.child_id);
        if (!child) {
          continue;
        }
        if (child.enrollment_id) {
          await transaction
            .updateTable('class_enrollments')
            .set({ is_current: false, to_date: fromDate, updated_at: this.clock.now() })
            .where('id', '=', child.enrollment_id)
            .execute();
        }
        const created = await transaction
          .insertInto('class_enrollments')
          .values({
            child_id: child.id,
            class_id: item.class_id,
            from_date: fromDate,
            reason: input.reason,
            created_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: child.org_unit_id,
          entityName: 'class_enrollments',
          entityId: created.id,
          action: 'create',
          before: child.class_id ? { class_id: child.class_id } : null,
          after: {
            child_id: child.id,
            class_id: item.class_id,
            from_date: fromDate,
            reason: input.reason,
            bulk_transfer: true,
          },
        });
      }
    });
    return { transferred: input.items.length };
  }

  // Điện thoại nhận tin hàng loạt (mục 4.1.5 của Sở): chọn số của cha, mẹ, người giám hộ hoặc liên hệ chính cho mọi học sinh
  // đã chọn; học sinh không có người theo quan hệ đó hoặc người đó chưa có số điện thoại thì giữ nguyên và được báo lại
  async bulkSmsGuardians(currentUser: CurrentUser, childIds: string[], relation: SmsRelation, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const children = await database
      .selectFrom('children')
      .select(['id', 'org_unit_id', 'status', 'full_name'])
      .where('id', 'in', childIds)
      .where('deleted_at', 'is', null)
      .execute();
    if (children.length !== childIds.length) {
      throw notFoundError('Có học sinh không tồn tại hoặc đã bị xóa khỏi phạm vi của bạn', 'child');
    }
    const pending = children.filter((child) => child.status === 'pending');
    if (pending.length > 0) {
      throw ruleViolationError(
        STUDENT_RECORDS_RULE_CODE,
        'Có hồ sơ đang chờ duyệt; cần được duyệt hoặc từ chối về nháp trước khi cập nhật',
        pending.map((child) => ({ field: 'child_ids', message: child.full_name })),
      );
    }
    for (const child of children) {
      await this.organizationScopes.assertCanAccess(
        currentUser,
        child.status === 'draft' ? PERMISSION_CODES.childManage : PERMISSION_CODES.childApprove,
        child.org_unit_id,
      );
    }
    const links = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .innerJoin('catalog_items', 'catalog_items.id', 'child_guardians.relationship_item_id')
      .select([
        'child_guardians.id',
        'child_guardians.child_id',
        'child_guardians.guardian_id',
        'child_guardians.is_primary',
        'child_guardians.receives_sms',
        'guardians.phone',
        'catalog_items.name as relationship',
      ])
      .where('child_guardians.child_id', 'in', childIds)
      .execute();
    const skipped: string[] = [];
    const plans: Array<{ child: (typeof children)[number]; linkId: string | null; previous: string | null }> = [];
    for (const child of children) {
      const own = links.filter((link) => link.child_id === child.id);
      const previous = own.find((link) => link.receives_sms)?.guardian_id ?? null;
      if (relation === 'none') {
        plans.push({ child, linkId: null, previous });
        continue;
      }
      const target =
        relation === 'primary'
          ? own.find((link) => link.is_primary)
          : own.find((link) => RELATION_NAMES[relation].includes(foldText(link.relationship)));
      if (!target?.phone) {
        skipped.push(child.full_name);
        continue;
      }
      plans.push({ child, linkId: target.id, previous });
    }
    await database.transaction().execute(async (transaction) => {
      for (const plan of plans) {
        await transaction
          .updateTable('child_guardians')
          .set({ receives_sms: false, updated_at: this.clock.now() })
          .where('child_id', '=', plan.child.id)
          .where('receives_sms', '=', true)
          .execute();
        let guardianId: string | null = null;
        if (plan.linkId) {
          const updated = await transaction
            .updateTable('child_guardians')
            .set({ receives_sms: true, updated_at: this.clock.now() })
            .where('id', '=', plan.linkId)
            .returning('guardian_id')
            .executeTakeFirstOrThrow();
          guardianId = updated.guardian_id;
        }
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: plan.child.org_unit_id,
          entityName: 'child_guardians',
          entityId: plan.child.id,
          action: 'update',
          before: { sms_guardian_id: plan.previous },
          after: { sms_guardian_id: guardianId, bulk_relation: relation },
        });
      }
    });
    return { updated: plans.length, skipped };
  }

  // Học sinh của lớp theo số thứ tự cố định, chưa có số thì xếp sau theo A–Z (mục 4.1.3)
  async classOrder(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.findClass(database, currentUser, classId);
    const rows = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select([
        'children.id',
        'children.full_name',
        'children.dob',
        'children.gender',
        'children.moet_student_code',
        'class_enrollments.order_number',
      ])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.deleted_at', 'is', null)
      .orderBy(sql`class_enrollments.order_number nulls last`)
      .orderBy(GIVEN_NAME_ORDER)
      .orderBy(FULL_NAME_ORDER)
      .execute();
    return { class: classRecord, items: rows };
  }

  private async findClass(database: Executor, currentUser: CurrentUser, classId: string) {
    const classRecord = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'name', 'status'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRecord) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    assertInScope(
      await studentEditScope(this.organizationScopes, currentUser),
      classRecord.org_unit_id,
      'Lớp này nằm ngoài phạm vi của bạn',
    );
    return classRecord;
  }

  // "Sắp xếp học sinh (A–Z)": ghi số thứ tự theo A–Z cho lớp chọn hoặc tất cả lớp đang dùng trong phạm vi
  async sortAlphabetically(currentUser: CurrentUser, classId: string | null, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    let classIds: string[];
    let orgUnitIds: string[];
    if (classId) {
      const classRecord = await this.findClass(database, currentUser, classId);
      classIds = [classRecord.id];
      orgUnitIds = [classRecord.org_unit_id];
    } else {
      const scope = await studentEditScope(this.organizationScopes, currentUser);
      let query = database.selectFrom('classes').select(['id', 'org_unit_id']).where('status', '=', 'active');
      if (!scope.wholeSchool) {
        query = query.where('org_unit_id', 'in', scope.orgUnitIds.length ? scope.orgUnitIds : [classId ?? '']);
      }
      const classes = await query.limit(ORDER_CLASS_LIMIT).execute();
      classIds = classes.map((row) => row.id);
      orgUnitIds = [...new Set(classes.map((row) => row.org_unit_id))];
    }
    if (classIds.length === 0) {
      return { classes: 0, students: 0 };
    }
    return database.transaction().execute(async (transaction) => {
      const result = await sql<{ id: string }>`
        update class_enrollments set order_number = ranked.position, updated_at = now()
        from (
          select class_enrollments.id, row_number() over (
            partition by class_enrollments.class_id order by ${GIVEN_NAME_ORDER}, ${FULL_NAME_ORDER}, children.id
          ) as position
          from class_enrollments
          inner join children on children.id = class_enrollments.child_id
          where class_enrollments.is_current and children.deleted_at is null
            and class_enrollments.class_id in (${sql.join(classIds)})
        ) as ranked
        where class_enrollments.id = ranked.id
        returning class_enrollments.id`.execute(transaction);
      for (const orgUnitId of orgUnitIds) {
        await writeAuditLog(transaction, {
          origin,
          orgUnitId,
          entityName: 'class_enrollments',
          entityId: classId ?? orgUnitId,
          action: 'update',
          before: null,
          after: { order: 'alphabetical', class_ids: classIds.length === 1 ? classIds : 'all' },
        });
      }
      return { classes: classIds.length, students: result.rows.length };
    });
  }

  // Ghi thứ tự do người dùng sắp: danh sách phải đủ đúng các học sinh đang học của lớp
  async saveOrder(currentUser: CurrentUser, classId: string, childIds: string[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await this.findClass(database, currentUser, classId);
    const members = await database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select(['class_enrollments.id', 'class_enrollments.child_id'])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.deleted_at', 'is', null)
      .execute();
    if (members.length !== childIds.length || members.some((member) => !childIds.includes(member.child_id))) {
      throw ruleViolationError(
        STUDENT_RECORDS_RULE_CODE,
        'Danh sách sắp xếp phải gồm đúng các học sinh đang học của lớp; tải lại danh sách rồi sắp lại',
      );
    }
    await database.transaction().execute(async (transaction) => {
      for (const [index, childId] of childIds.entries()) {
        const member = members.find((item) => item.child_id === childId);
        await transaction
          .updateTable('class_enrollments')
          .set({ order_number: index + 1, updated_at: this.clock.now() })
          .where('id', '=', member?.id ?? '')
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: classRecord.org_unit_id,
        entityName: 'class_enrollments',
        entityId: classId,
        action: 'update',
        before: null,
        after: { order: 'manual', child_ids: childIds },
      });
    });
    return this.classOrder(currentUser, classId);
  }
}

function readUuidList(value: unknown, field: string, errors: FieldError[], label: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > BULK_LIMIT || !value.every(isUuid)) {
    errors.push({ field, message: `Chọn từ 1 đến ${BULK_LIMIT} ${label}` });
    return [];
  }
  return [...new Set(value as string[])];
}

@Controller()
export class StudentRecordsController {
  constructor(private readonly service: StudentRecordsService) {}

  // Nút "Xóa" của danh sách học sinh (mục 4.1.1 của Sở): hồ sơ nháp
  @Delete('children/:id')
  @RequirePermission(PERMISSION_CODES.childManage)
  remove(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.remove(currentUser, childId, originOf(request, currentUser));
  }

  // "Cấp mã định danh Bộ" nhập tay
  @Post('children/moet-codes')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childManage)
  assignMoetCodes(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const raw = body?.items;
    const items: Array<{ child_id: string; moet_student_code: string }> = [];
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > BULK_LIMIT) {
      errors.push({ field: 'items', message: `Nhập mã cho từ 1 đến ${BULK_LIMIT} học sinh` });
    } else {
      raw.forEach((item: Record<string, unknown>, index) => {
        const code = typeof item?.moet_student_code === 'string' ? item.moet_student_code.trim() : '';
        if (!isUuid(item?.child_id)) {
          errors.push({ field: `items.${index}.child_id`, message: 'Mã học sinh không hợp lệ' });
        } else if (!code || code.length > 50) {
          errors.push({
            field: `items.${index}.moet_student_code`,
            message: 'Mã định danh Bộ GD&ĐT từ 1 đến 50 ký tự',
          });
        } else {
          items.push({ child_id: item.child_id as string, moet_student_code: code });
        }
      });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.assignMoetCodes(currentUser, items, originOf(request, currentUser));
  }

  // Xuất tệp theo mẫu 82 cột của Bộ (đề nghị cấp mã định danh Bộ cho học sinh chưa có mã)
  @Post('children/moet-file')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.dataExport)
  async moetFile(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!currentUser.hasPermission(PERMISSION_CODES.nationalIdView)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Tệp theo mẫu của Bộ có số định danh, cần quyền xem số định danh');
    }
    const errors: FieldError[] = [];
    const filter = readStudentListFilter(body ?? {}, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    sendWorkbook(response, await this.service.moetFile(currentUser, filter, request.ip ?? null));
  }

  @Post('children/error-file')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.dataExport)
  async errorFile(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const filter = readStudentListFilter(body ?? {}, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    sendWorkbook(response, await this.service.errorFile(currentUser, filter, request.ip ?? null));
  }

  @Post('children/bulk-transfer-class')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  bulkTransferClass(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const raw = body?.items;
    const items: Array<{ child_id: string; class_id: string }> = [];
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > BULK_LIMIT) {
      errors.push({ field: 'items', message: `Chọn từ 1 đến ${BULK_LIMIT} học sinh` });
    } else {
      raw.forEach((item: Record<string, unknown>, index) => {
        if (!isUuid(item?.child_id) || !isUuid(item?.class_id)) {
          errors.push({ field: `items.${index}`, message: 'Chọn lớp mới' });
        } else {
          items.push({ child_id: item.child_id as string, class_id: item.class_id as string });
        }
      });
      if (new Set(items.map((item) => item.child_id)).size !== items.length) {
        errors.push({ field: 'items', message: 'Mỗi học sinh một dòng' });
      }
    }
    const reason = readRequiredText(body, 'reason', errors);
    const fromDate = body?.from_date;
    if (fromDate !== undefined && fromDate !== null && fromDate !== '') {
      if (typeof fromDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || Number.isNaN(Date.parse(fromDate))) {
        errors.push({ field: 'from_date', message: 'Ngày dạng YYYY-MM-DD' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.bulkTransferClass(
      currentUser,
      {
        items,
        fromDate: typeof fromDate === 'string' && fromDate ? fromDate : null,
        reason,
        confirmOverCapacity: body?.confirm_over_capacity === true,
      },
      originOf(request, currentUser),
    );
  }

  @Post('children/sms-guardians')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  bulkSmsGuardians(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const childIds = readUuidList(body?.child_ids, 'child_ids', errors, 'học sinh');
    const relation = body?.relation as SmsRelation;
    if (!SMS_RELATIONS.includes(relation)) {
      errors.push({ field: 'relation', message: 'Chọn cha, mẹ, người giám hộ, liên hệ chính hoặc bỏ chọn' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.bulkSmsGuardians(currentUser, childIds, relation, originOf(request, currentUser));
  }

  @Get('student-order')
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  classOrder(@Query('class_id') classId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(classId)) {
      throw validationError([{ field: 'class_id', message: 'Chọn lớp' }]);
    }
    return this.service.classOrder(currentUser, classId);
  }

  // Lớp chọn hoặc tất cả lớp (không gửi class_id)
  @Post('student-order/sort')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  sort(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const classId = body?.class_id;
    if (classId !== undefined && classId !== null && !isUuid(classId)) {
      throw validationError([{ field: 'class_id', message: 'Mã lớp không hợp lệ' }]);
    }
    return this.service.sortAlphabetically(
      currentUser,
      typeof classId === 'string' ? classId : null,
      originOf(request, currentUser),
    );
  }

  @Put('student-order/:classId')
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  saveOrder(
    @Param('classId', uuidParameter('Mã lớp không hợp lệ')) classId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const childIds = Array.isArray(body?.child_ids) ? (body.child_ids as unknown[]) : [];
    if (childIds.length === 0 || childIds.length > BULK_LIMIT || !childIds.every(isUuid)) {
      errors.push({ field: 'child_ids', message: 'Danh sách học sinh theo thứ tự không hợp lệ' });
    } else if (new Set(childIds).size !== childIds.length) {
      errors.push({ field: 'child_ids', message: 'Mỗi học sinh một lần' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.saveOrder(currentUser, classId, childIds as string[], originOf(request, currentUser));
  }
}
