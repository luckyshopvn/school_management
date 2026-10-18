import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Put, Req } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { ChildScope } from '../children/child-scope.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection, maskNationalId } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { foldText } from '../imports/moet-columns.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { readNationalId } from './moet-child-file.js';
import { BULK_LIMIT, inScope, STUDENT_RECORDS_RULE_CODE } from './student-records-common.js';

// Thu thập, xác thực số định danh với CSDLQG về dân cư chạy nội bộ (mục 4.1.8–4.1.9 của Sở, DT-16 phần 16g). Chưa có giao
// diện lập trình của Bộ Công an (G3-09) nên nhà trường xác thực ngoài hệ thống rồi "Đánh dấu đã xác thực": hệ thống kiểm tra
// định dạng mười hai chữ số, ghi ngày và người đánh dấu; biến động cư trú ghi tay. Đổi số định danh thì phải xác thực lại.
// Tiến độ xác thực theo lớp, danh sách hồ sơ nghi trùng (mục 5.5 của Sở). Chỗ nối khi có giao diện lập trình là lớp
// `NationalIdVerifier` (bản `ManualNationalIdVerifier` không tự xác thực)
const NATIONAL_ID_PATTERN = /^\d{12}$/;
const MAXIMUM_NOTE = 1000;
const CARRIED_STATUSES = ['draft', 'pending', 'active', 'paused'] as const;

export interface NationalIdVerifier {
  // Tên cách xác thực ghi vào nhật ký
  readonly method: string;
}

// Bản chạy nội bộ: nhà trường tự xác thực ngoài hệ thống rồi đánh dấu
export class ManualNationalIdVerifier implements NationalIdVerifier {
  readonly method = 'manual';
}

@Injectable()
export class NationalIdsService {
  private readonly verifier: NationalIdVerifier = new ManualNationalIdVerifier();

  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly childScope: ChildScope,
    private readonly protection: ChildDataProtection,
    private readonly clock: Clock,
  ) {}

  private async children(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser, childIds: string[]) {
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.childApprove);
    const rows = await database
      .selectFrom('children')
      .select([
        'id',
        'org_unit_id',
        'full_name',
        'status',
        'national_id_encrypted',
        'national_id_verified_at',
        'national_id_verified_by_name',
      ])
      .where('id', 'in', childIds)
      .where('deleted_at', 'is', null)
      .execute();
    if (rows.length !== childIds.length || rows.some((row) => !inScope(scope, row.org_unit_id))) {
      throw notFoundError('Có học sinh không tồn tại hoặc nằm ngoài phạm vi của bạn', 'child');
    }
    return rows;
  }

  // "Đánh dấu đã xác thực": số định danh phải đủ mười hai chữ số; học sinh đã xác thực thì giữ ngày cũ
  async verify(currentUser: CurrentUser, childIds: string[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const rows = await this.children(database, currentUser, childIds);
    const invalid = rows.filter(
      (row) => !NATIONAL_ID_PATTERN.test(readNationalId(this.protection, row.national_id_encrypted)),
    );
    if (invalid.length > 0) {
      throw ruleViolationError(
        STUDENT_RECORDS_RULE_CODE,
        'Số định danh phải gồm mười hai chữ số trước khi đánh dấu đã xác thực',
        invalid.map((row) => ({ field: 'child_ids', message: row.full_name })),
      );
    }
    const now = this.clock.now();
    const pending = rows.filter((row) => !row.national_id_verified_at);
    await database.transaction().execute(async (transaction) => {
      for (const row of pending) {
        await transaction
          .updateTable('children')
          .set({
            national_id_verified_at: now,
            national_id_verified_by: origin.actorUserId,
            national_id_verified_by_name: origin.actorName,
            updated_at: now,
          })
          .where('id', '=', row.id)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'children',
          entityId: row.id,
          action: 'update',
          before: { national_id_verified_at: null },
          after: { national_id_verified_at: now, method: this.verifier.method },
        });
      }
    });
    return { verified: pending.length, already: rows.length - pending.length };
  }

  async unverify(currentUser: CurrentUser, childIds: string[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const rows = (await this.children(database, currentUser, childIds)).filter((row) => row.national_id_verified_at);
    await database.transaction().execute(async (transaction) => {
      for (const row of rows) {
        await transaction
          .updateTable('children')
          .set({
            national_id_verified_at: null,
            national_id_verified_by: null,
            national_id_verified_by_name: null,
            updated_at: this.clock.now(),
          })
          .where('id', '=', row.id)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'children',
          entityId: row.id,
          action: 'update',
          before: {
            national_id_verified_at: row.national_id_verified_at,
            national_id_verified_by_name: row.national_id_verified_by_name,
          },
          after: { national_id_verified_at: null },
        });
      }
    });
    return { unverified: rows.length };
  }

  // Biến động cư trú ghi tay (tra cứu ở CSDLQG ngoài hệ thống)
  async setResidenceNote(currentUser: CurrentUser, childId: string, note: string | null, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const [row] = await this.children(database, currentUser, [childId]);
    const before = await database
      .selectFrom('children')
      .select('residence_change_note')
      .where('id', '=', childId)
      .executeTakeFirstOrThrow();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('children')
        .set({ residence_change_note: note, updated_at: this.clock.now() })
        .where('id', '=', childId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: row?.org_unit_id ?? null,
        entityName: 'children',
        entityId: childId,
        action: 'update',
        before,
        after: { residence_change_note: note },
      });
    });
    return { residence_change_note: note };
  }

  // Tiến độ xác thực số định danh theo lớp (mục 5.5 của Sở): học sinh đang học trong phạm vi xem
  async progress(currentUser: CurrentUser) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { items: [], total: { total: 0, verified: 0, ratio: 0 } };
    }
    const database = current.database;
    const scope = await this.childScope.resolve(currentUser, database);
    const rows = await database
      .selectFrom('children')
      .innerJoin('org_units', 'org_units.id', 'children.org_unit_id')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select((expression) => [
        'classes.id as class_id',
        'classes.name as class_name',
        'org_units.name as org_unit_name',
        expression.fn.countAll<string>().as('total'),
        expression.fn.count<string>('children.national_id_verified_at').as('verified'),
      ])
      .where(this.childScope.filter(scope))
      .where('children.status', '=', 'active')
      .groupBy(['classes.id', 'classes.name', 'org_units.name'])
      .orderBy('org_units.name')
      .orderBy('classes.name')
      .execute();
    const ratio = (verified: number, total: number) => (total === 0 ? 0 : Math.round((verified / total) * 1000) / 10);
    const items = rows.map((row) => ({
      class_id: row.class_id,
      class_name: row.class_name ?? 'Chưa xếp lớp',
      org_unit_name: row.org_unit_name,
      total: Number(row.total),
      verified: Number(row.verified),
      ratio: ratio(Number(row.verified), Number(row.total)),
    }));
    const total = items.reduce((sum, item) => sum + item.total, 0);
    const verified = items.reduce((sum, item) => sum + item.verified, 0);
    return { items, total: { total, verified, ratio: ratio(verified, total) } };
  }

  // Danh sách trùng (mục 5.5 của Sở): số định danh không trùng được vì hệ thống chặn khi nhập (QT-01), nên liệt kê hồ sơ
  // nghi trùng cùng họ tên, ngày sinh trong phạm vi xem, kể cả nháp và tạm nghỉ
  async duplicates(currentUser: CurrentUser) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { items: [] };
    }
    const database = current.database;
    const scope = await this.childScope.resolve(currentUser, database);
    const rows = await database
      .selectFrom('children')
      .innerJoin('org_units', 'org_units.id', 'children.org_unit_id')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id',
        'children.full_name',
        'children.dob',
        'children.status',
        'children.moet_student_code',
        'children.national_id_last4',
        'classes.name as class_name',
        'org_units.name as org_unit_name',
      ])
      .where(this.childScope.filter(scope))
      .where('children.status', 'in', [...CARRIED_STATUSES])
      .orderBy('children.full_name')
      .execute();
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = `${foldText(row.full_name)}|${row.dob}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    let group = 0;
    const items = [...groups.values()]
      .filter((list) => list.length > 1)
      .flatMap((list) => {
        group += 1;
        return list.map(({ national_id_last4: lastFour, ...row }) => ({
          ...row,
          group,
          national_id_masked: maskNationalId(lastFour),
        }));
      });
    return { items };
  }
}

function readChildIds(body: RequestBody): string[] {
  const raw = body?.child_ids;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > BULK_LIMIT || !raw.every(isUuid)) {
    throw validationError([{ field: 'child_ids', message: `Chọn từ 1 đến ${BULK_LIMIT} học sinh` }]);
  }
  return [...new Set(raw as string[])];
}

@Controller()
export class NationalIdsController {
  constructor(private readonly service: NationalIdsService) {}

  @Post('national-ids/verify')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  verify(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.verify(currentUser, readChildIds(body), originOf(request, currentUser));
  }

  @Post('national-ids/unverify')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  unverify(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.unverify(currentUser, readChildIds(body), originOf(request, currentUser));
  }

  @Put('children/:id/residence-change')
  @RequirePermission(PERMISSION_CODES.childApprove)
  residence(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const raw = body?.note;
    if (raw !== null && raw !== undefined && (typeof raw !== 'string' || raw.trim().length > MAXIMUM_NOTE)) {
      errors.push({ field: 'note', message: `Tối đa ${MAXIMUM_NOTE} ký tự` });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const note = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    return this.service.setResidenceNote(currentUser, childId, note, originOf(request, currentUser));
  }

  @Get('national-ids/progress')
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  progress(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.progress(currentUser);
  }

  @Get('national-ids/duplicates')
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  duplicates(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.duplicates(currentUser);
  }
}
