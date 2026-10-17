import { Body, Controller, Get, HttpCode, Injectable, Post, Query, Req } from '@nestjs/common';
import type { StaffIdVerificationStatus } from '@school-management/database';
import { Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection, maskNationalId } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { optionalUuid, type QueryValues } from '../reports/report-filters.js';
import { ReportsService } from '../reports/reports.service.js';
import { FULL_NAME_ORDER, GIVEN_NAME_ORDER } from './staff-list.js';

// Xác thực số định danh nhân sự với CSDLQG về dân cư, bản chạy nội bộ (DT-16 phần 16f, mục 3.1.5 và 5.6 của Sở). Chưa có
// giao diện lập trình của Bộ Công an nên không gửi số định danh đi đâu: người quản lý hồ sơ đối chiếu (VNeID, CCCD gốc) rồi
// "Đánh dấu đã xác thực" hoặc "Đánh dấu sai thông tin"; hệ thống kiểm tra số đủ 12 chữ số, ghi ngày, người đánh dấu, ghi
// chú. Chỗ nối là lớp IdentityVerificationGateway: khi có giao diện lập trình thì thay bản ManualIdentityVerificationGateway
// bằng bản gọi CSDLQG (trả kết quả xác thực); bản hiện tại không tự xác thực
export interface IdentityVerificationRequest {
  idNumber: string;
  fullName: string;
  dob: string | null;
}

export abstract class IdentityVerificationGateway {
  // Có tự xác thực với CSDLQG hay không; bản chạy nội bộ là không
  abstract readonly automatic: boolean;
  // Kết quả tự xác thực; null là không tự xác thực, dùng trạng thái người dùng đánh dấu
  abstract verify(request: IdentityVerificationRequest): Promise<StaffIdVerificationStatus | null>;
}

@Injectable()
export class ManualIdentityVerificationGateway extends IdentityVerificationGateway {
  readonly automatic = false;

  verify(): Promise<StaffIdVerificationStatus | null> {
    return Promise.resolve(null);
  }
}

const ID_NUMBER_PATTERN = /^\d{12}$/;
const STATUSES: StaffIdVerificationStatus[] = ['unverified', 'verified', 'invalid'];
const MAXIMUM_NOTE = 500;
const PAGE_SIZE_LIMIT = 200;

// Thông tin thường trú theo các ô của tệp CSDL ngành: tổ/thôn, xã/phường, quận/huyện cũ, tỉnh/thành phố
function permanentAddress(profile: Record<string, unknown> | null): string {
  return ['permanent_hamlet', 'permanent_ward', 'permanent_district', 'permanent_province']
    .map((key) => profile?.[key])
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .join(', ');
}

@Injectable()
export class StaffIdentityService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly reports: ReportsService,
    private readonly protection: ChildDataProtection,
    private readonly gateway: IdentityVerificationGateway,
    private readonly clock: Clock,
  ) {}

  // Lưới 3.1.5: CMND/CCCD (đã che), thông tin thường trú, trạng thái xác thực, ghi chú; A–Z theo tên
  async list(
    currentUser: CurrentUser,
    filter: {
      orgUnitId: string | null;
      status: StaffIdVerificationStatus | null;
      q: string | null;
      page: number;
      pageSize: number;
    },
  ) {
    const scope = await this.reports.unitScope(currentUser, PERMISSION_CODES.staffView, filter.orgUnitId, false);
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('staff')
      .innerJoin('org_units', 'org_units.id', 'staff.org_unit_id')
      .leftJoin('departments', 'departments.id', 'staff.department_id')
      .where('staff.org_unit_id', 'in', scope.orgUnitIds.length > 0 ? scope.orgUnitIds : [''])
      .where('staff.status', '=', 'active');
    if (filter.status) {
      query = query.where('staff.id_verification_status', '=', filter.status);
    }
    if (filter.q) {
      const pattern = `%${filter.q.replace(/[%_\\]/g, '\\$&')}%`;
      query = query.where((expression) =>
        expression.or([expression('staff.full_name', 'ilike', pattern), expression('staff.code', 'ilike', pattern)]),
      );
    }
    const counted = await query
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    const pageSize = Math.min(filter.pageSize, PAGE_SIZE_LIMIT);
    const rows = await query
      .select([
        'staff.id',
        'staff.code',
        'staff.moet_staff_code',
        'staff.full_name',
        'staff.dob',
        'staff.gender',
        'staff.id_number_last4',
        'staff.address',
        'staff.moet_profile',
        'staff.id_verification_status',
        'staff.id_verified_at',
        'staff.id_verified_by_name',
        'staff.id_verification_note',
        'org_units.name as unit_name',
        'departments.name as department_name',
      ])
      .orderBy(GIVEN_NAME_ORDER)
      .orderBy(FULL_NAME_ORDER)
      .orderBy('staff.id')
      .limit(pageSize)
      .offset((filter.page - 1) * pageSize)
      .execute();
    const total = Number(counted.count);
    return {
      items: rows.map(({ id_number_last4: lastFour, moet_profile: profile, ...row }) => ({
        ...row,
        id_number_masked: lastFour ? maskNationalId(lastFour) : null,
        permanent_address: permanentAddress(profile),
      })),
      page: filter.page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
      // Màn hình ghi rõ chưa kết nối CSDLQG khi bản chạy nội bộ
      automatic: this.gateway.automatic,
    };
  }

  // "Đánh dấu đã xác thực", "Đánh dấu sai thông tin", "Đặt lại chưa xác thực": từng hồ sơ một kết quả. Đánh dấu đã xác
  // thực cần số định danh đủ 12 chữ số; bản có giao diện lập trình dùng kết quả của CSDLQG thay cho trạng thái chọn
  async mark(
    currentUser: CurrentUser,
    input: { staffIds: string[]; status: StaffIdVerificationStatus; note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.reports.unitScope(currentUser, PERMISSION_CODES.staffManage, null, false);
    const rows = await database
      .selectFrom('staff')
      .select([
        'id',
        'org_unit_id',
        'full_name',
        'dob',
        'id_number_encrypted',
        'id_verification_status',
        'id_verification_note',
      ])
      .where('id', 'in', input.staffIds)
      .execute();
    const results: Array<{ id: string; full_name: string; status: StaffIdVerificationStatus | null; error: string | null }> =
      [];
    for (const staffId of input.staffIds) {
      const row = rows.find((item) => item.id === staffId);
      if (!row) {
        results.push({ id: staffId, full_name: '', status: null, error: 'Không tìm thấy hồ sơ' });
        continue;
      }
      if (!scope.orgUnitIds.includes(row.org_unit_id)) {
        results.push({ id: row.id, full_name: row.full_name, status: null, error: 'Hồ sơ ngoài phạm vi quản lý của bạn' });
        continue;
      }
      const idNumber = row.id_number_encrypted ? this.protection.decrypt(row.id_number_encrypted) : null;
      if (input.status === 'verified' && (!idNumber || !ID_NUMBER_PATTERN.test(idNumber))) {
        results.push({
          id: row.id,
          full_name: row.full_name,
          status: null,
          error: 'Chưa có số định danh đủ 12 chữ số, không đánh dấu đã xác thực được',
        });
        continue;
      }
      const automatic =
        input.status === 'verified' && idNumber
          ? await this.gateway.verify({ idNumber, fullName: row.full_name, dob: row.dob })
          : null;
      const status = automatic ?? input.status;
      const verifiedAt = status === 'unverified' ? null : this.clock.now();
      await database.transaction().execute(async (transaction) => {
        await transaction
          .updateTable('staff')
          .set({
            id_verification_status: status,
            id_verified_at: verifiedAt,
            id_verified_by: status === 'unverified' ? null : origin.actorUserId,
            id_verified_by_name: status === 'unverified' ? null : origin.actorName,
            id_verification_note: input.note,
            updated_at: this.clock.now(),
          })
          .where('id', '=', row.id)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'staff',
          entityId: row.id,
          action: 'update',
          before: { id_verification_status: row.id_verification_status, id_verification_note: row.id_verification_note },
          after: { id_verification_status: status, id_verification_note: input.note, manual: automatic === null },
        });
      });
      results.push({ id: row.id, full_name: row.full_name, status, error: null });
    }
    return { updated_count: results.filter((result) => result.error === null).length, results };
  }

  // 5.6 Tiến độ xác thực số định danh nhân sự theo đơn vị hoặc bộ phận (phòng ban): tổng số, đã xác thực, sai thông tin, tỷ lệ
  async progress(currentUser: CurrentUser, orgUnitId: string | null, groupBy: 'unit' | 'department') {
    const scope = await this.reports.unitScope(currentUser, PERMISSION_CODES.staffStatisticsView, orgUnitId, false);
    const { database } = await this.currentSchoolYear.require();
    const rows = await database
      .selectFrom('staff')
      .innerJoin('org_units', 'org_units.id', 'staff.org_unit_id')
      .leftJoin('departments', 'departments.id', 'staff.department_id')
      .select(['org_units.name as unit_name', 'departments.name as department_name', 'staff.id_verification_status'])
      .where('staff.org_unit_id', 'in', scope.orgUnitIds.length > 0 ? scope.orgUnitIds : [''])
      .where('staff.status', '=', 'active')
      .execute();
    const groups = new Map<string, { total: number; verified: number; invalid: number }>();
    for (const row of rows) {
      const name =
        groupBy === 'unit' ? row.unit_name : row.department_name ? `${row.unit_name} – ${row.department_name}` : `${row.unit_name} – Chưa xếp phòng ban`;
      const entry = groups.get(name) ?? { total: 0, verified: 0, invalid: 0 };
      entry.total += 1;
      entry.verified += row.id_verification_status === 'verified' ? 1 : 0;
      entry.invalid += row.id_verification_status === 'invalid' ? 1 : 0;
      groups.set(name, entry);
    }
    const rate = (part: number, whole: number) => (whole > 0 ? Math.round((part * 10000) / whole) / 100 : 0);
    const items = [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'vi'))
      .map(([name, entry]) => ({ name, ...entry, rate: rate(entry.verified, entry.total) }));
    const total = items.reduce((sum, item) => sum + item.total, 0);
    const verified = items.reduce((sum, item) => sum + item.verified, 0);
    const invalid = items.reduce((sum, item) => sum + item.invalid, 0);
    return { group_by: groupBy, items, totals: { total, verified, invalid, rate: rate(verified, total) } };
  }

  // Danh sách trùng số định danh: hồ sơ cùng bốn số cuối được giải mã để so đủ 12 số; mỗi nhóm hai hồ sơ trở lên
  async duplicates(currentUser: CurrentUser, orgUnitId: string | null) {
    const scope = await this.reports.unitScope(currentUser, PERMISSION_CODES.staffStatisticsView, orgUnitId, false);
    const { database } = await this.currentSchoolYear.require();
    const rows = await database
      .selectFrom('staff')
      .innerJoin('org_units', 'org_units.id', 'staff.org_unit_id')
      .select([
        'staff.id',
        'staff.code',
        'staff.full_name',
        'staff.dob',
        'staff.status',
        'staff.id_number_last4',
        'staff.id_number_encrypted',
        'org_units.name as unit_name',
      ])
      .where('staff.org_unit_id', 'in', scope.orgUnitIds.length > 0 ? scope.orgUnitIds : [''])
      .where('staff.id_number_last4', 'is not', null)
      .orderBy('staff.full_name')
      .execute();
    const byLastFour = new Map<string, typeof rows>();
    for (const row of rows) {
      byLastFour.set(row.id_number_last4 ?? '', [...(byLastFour.get(row.id_number_last4 ?? '') ?? []), row]);
    }
    const groups: Array<{ id_number_masked: string; staff: Array<Record<string, unknown>> }> = [];
    for (const candidates of byLastFour.values()) {
      if (candidates.length < 2) {
        continue;
      }
      const byNumber = new Map<string, typeof rows>();
      for (const row of candidates) {
        const number = row.id_number_encrypted ? this.protection.decrypt(row.id_number_encrypted) : '';
        byNumber.set(number, [...(byNumber.get(number) ?? []), row]);
      }
      for (const [number, same] of byNumber) {
        if (number && same.length > 1) {
          groups.push({
            id_number_masked: maskNationalId(number.slice(-4)),
            staff: same.map(({ id_number_encrypted: _encrypted, id_number_last4: _lastFour, ...row }) => row),
          });
        }
      }
    }
    return { groups };
  }
}

@Controller('staff-identity')
export class StaffIdentityController {
  constructor(private readonly identity: StaffIdentityService) {}

  @Get()
  @RequirePermission(PERMISSION_CODES.staffView)
  list(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = optionalUuid(query, 'org_unit_id', errors);
    const status = query.status || null;
    if (status && !STATUSES.includes(status as StaffIdVerificationStatus)) {
      errors.push({ field: 'status', message: 'Trạng thái là unverified, verified hoặc invalid' });
    }
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    if (!Number.isInteger(page) || page < 1) {
      errors.push({ field: 'page', message: 'Số trang bắt đầu từ 1' });
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > PAGE_SIZE_LIMIT) {
      errors.push({ field: 'page_size', message: 'Cỡ trang từ 1 đến 200' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.identity.list(currentUser, {
      orgUnitId,
      status: status as StaffIdVerificationStatus | null,
      q: query.q?.trim().slice(0, 100) || null,
      page,
      pageSize,
    });
  }

  @Post('mark')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.staffManage)
  mark(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = body?.staff_ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || ids.some((id) => !isUuid(id))) {
      errors.push({ field: 'staff_ids', message: 'Chọn từ 1 đến 200 hồ sơ' });
    }
    const status = body?.status;
    if (!STATUSES.includes(status as StaffIdVerificationStatus)) {
      errors.push({ field: 'status', message: 'Trạng thái là unverified, verified hoặc invalid' });
    }
    const note = typeof body?.note === 'string' ? body.note.trim() || null : null;
    if (note && note.length > MAXIMUM_NOTE) {
      errors.push({ field: 'note', message: `Tối đa ${MAXIMUM_NOTE} ký tự` });
    }
    if (status === 'invalid' && !note) {
      errors.push({ field: 'note', message: 'Ghi chú thông tin sai khi đánh dấu sai thông tin' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.identity.mark(
      currentUser,
      { staffIds: [...new Set(ids as string[])], status: status as StaffIdVerificationStatus, note },
      originOf(request, currentUser),
    );
  }

  @Get('progress')
  @RequirePermission(PERMISSION_CODES.staffStatisticsView)
  progress(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = optionalUuid(query, 'org_unit_id', errors);
    const groupBy = query.group_by || 'unit';
    if (groupBy !== 'unit' && groupBy !== 'department') {
      errors.push({ field: 'group_by', message: 'Nhóm theo unit hoặc department' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.identity.progress(currentUser, orgUnitId, groupBy as 'unit' | 'department');
  }

  @Get('duplicates')
  @RequirePermission(PERMISSION_CODES.staffStatisticsView)
  duplicates(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = optionalUuid(query, 'org_unit_id', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.identity.duplicates(currentUser, orgUnitId);
  }
}

