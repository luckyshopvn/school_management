import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { SchoolYearDatabase, StaffMovementStatus, StaffMovementType } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  readBearerToken,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { IdentityClient } from '../authentication/identity-client.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection, maskNationalId } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { conflictOnDuplicate, isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { buildTableFile, CONTENT_TYPES } from '../exports/table-file.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { MAXIMUM_IMPORT_BYTES, parseDate, readWorkbookTable, type RowError } from '../imports/excel.js';
import {
  buildMoetProfile,
  describeMoetProfile,
  foldText,
  mapMoetRows,
  MOET_STAFF_COLUMNS,
  normalizeIdNumber,
  normalizePhone,
} from '../imports/moet-columns.js';
import { MOET_STAFF_HEADERS } from '../imports/moet-imports.js';
import { optionalUuid, type QueryValues } from '../reports/report-filters.js';
import { ReportsService } from '../reports/reports.service.js';
import { buildMinistryWorkbook, type MinistryStaffRecord } from './staff-ministry-file.js';
import { STAFF_PARITY_RULE } from './staff-rules.js';

// 3.5 Biến động nhân sự (DT-16 phần 16f, mục 3.5 của Sở), bản chạy nội bộ: chưa liên thông giữa các trường nên mỗi trường
// tự ghi, hồ sơ chuyển trao tay bằng tệp.
// - Tiếp nhận nhân sự chuyển đến: chuyển từ tỉnh, xã, trường, ngày chuyển đến; có thể tải "tệp hồ sơ chuyển" (tệp 75 cột
//   theo mẫu Bộ do trường cũ xuất) để điền sẵn; "Tiếp nhận" tạo hồ sơ nhân sự nháp (đang làm việc, chưa có hợp đồng, tài
//   khoản) từ thông tin đó; xem và in PDF phiếu tiếp nhận.
// - Duyệt chuyển đi: ngày chuyển, chuyển đến trường; "Duyệt" cho nhân sự nghỉ việc từ ngày chuyển (chấm dứt hợp đồng còn hiệu
//   lực, khóa tài khoản như chấm dứt hợp đồng); "Đánh dấu trường đến đã tiếp nhận" ghi tay (đã xác nhận); xuất hồ sơ chuyển
//   dạng PDF và tệp theo mẫu Bộ để trao cho trường đến.
// - Giáo viên đi thỉnh giảng: môn dạy, trường đến, thời gian, trạng thái duyệt. Giáo viên đến thỉnh giảng: giáo viên trường
//   khác, môn dạy, thời gian, "Xác nhận".
// Người lập, duyệt: người quản lý hồ sơ nhân sự của đơn vị (P07.staff.manage); người xem: P07.staff.view (Claude tự chọn theo
// ủy quyền của Eric ngày 2026-10-11)
export const MOVEMENT_TYPES: StaffMovementType[] = ['transfer_in', 'transfer_out', 'guest_out', 'guest_in'];
const MOVEMENT_LABELS: Record<StaffMovementType, string> = {
  transfer_in: 'Tiếp nhận nhân sự chuyển đến',
  transfer_out: 'Chuyển đi',
  guest_out: 'Giáo viên đi thỉnh giảng',
  guest_in: 'Giáo viên đến thỉnh giảng',
};
const STATUS_LABELS: Record<StaffMovementType, Record<StaffMovementStatus, string>> = {
  transfer_in: { pending: 'Chờ tiếp nhận', approved: 'Đã tiếp nhận', rejected: 'Từ chối' },
  transfer_out: { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' },
  guest_out: { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' },
  guest_in: { pending: 'Chờ xác nhận', approved: 'Đã xác nhận', rejected: 'Từ chối' },
};
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAXIMUM_TEXT = 500;
const PAGE_SIZE_LIMIT = 200;
const XLSX_TYPE = CONTENT_TYPES.xlsx;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const formatDate = (value: string | null | undefined) => (value ? value.split('-').reverse().join('/') : '');

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

// Hồ sơ đi kèm biến động: bản chụp hồ sơ lúc lập phiếu chuyển đi, hoặc nội dung đọc từ tệp hồ sơ chuyển đến. Số định danh,
// số sổ BHXH chỉ lưu mã hóa kèm bốn số cuối
export interface MovementDossier {
  code?: string;
  moet_staff_code: string | null;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  email: string | null;
  phone: string | null;
  id_number_encrypted: string | null;
  id_number_last4: string | null;
  moet_profile: Record<string, unknown>;
}

export interface MovementInput {
  movementType: StaffMovementType;
  orgUnitId: string | null;
  staffId: string | null;
  fullName: string | null;
  dob: string | null;
  gender: 'male' | 'female' | null;
  otherProvince: string | null;
  otherWard: string | null;
  otherSchool: string | null;
  movementDate: string;
  endDate: string | null;
  subject: string | null;
  decisionNo: string | null;
  reason: string | null;
  note: string | null;
}

function readText(body: RequestBody, field: string, errors: FieldError[], required = false): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return null;
  }
  if (typeof value !== 'string' || value.trim().length > MAXIMUM_TEXT) {
    errors.push({ field, message: `Chữ tối đa ${MAXIMUM_TEXT} ký tự` });
    return null;
  }
  return value.trim();
}

function readDate(body: RequestBody, field: string, errors: FieldError[], required = false): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return null;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
    return null;
  }
  return value;
}

// Đọc thân yêu cầu lập biến động; ô bắt buộc theo loại biến động
export function readMovementInput(body: RequestBody, errors: FieldError[]): MovementInput {
  const movementType = body?.movement_type as StaffMovementType;
  if (!MOVEMENT_TYPES.includes(movementType)) {
    errors.push({ field: 'movement_type', message: `Loại biến động là ${MOVEMENT_TYPES.join(', ')}` });
  }
  const forStaff = movementType === 'transfer_out' || movementType === 'guest_out';
  const staffId = body?.staff_id;
  if (forStaff && !isUuid(staffId)) {
    errors.push({ field: 'staff_id', message: 'Chọn nhân sự' });
  }
  const orgUnitId = body?.org_unit_id;
  if (!forStaff && !isUuid(orgUnitId)) {
    errors.push({ field: 'org_unit_id', message: 'Chọn đơn vị tiếp nhận' });
  }
  const gender = body?.gender;
  if (gender !== undefined && gender !== null && gender !== '' && gender !== 'male' && gender !== 'female') {
    errors.push({ field: 'gender', message: 'Giới tính là male hoặc female' });
  }
  const guest = movementType === 'guest_out' || movementType === 'guest_in';
  const input: MovementInput = {
    movementType,
    orgUnitId: forStaff ? null : (orgUnitId as string),
    staffId: forStaff ? (staffId as string) : null,
    fullName: forStaff ? null : readText(body, 'full_name', errors, true),
    dob: forStaff ? null : readDate(body, 'dob', errors),
    gender: forStaff ? null : gender === 'male' || gender === 'female' ? gender : null,
    otherProvince: readText(body, 'other_province', errors),
    otherWard: readText(body, 'other_ward', errors),
    otherSchool: readText(body, 'other_school', errors, true),
    movementDate: readDate(body, 'movement_date', errors, true) ?? '',
    endDate: guest ? readDate(body, 'end_date', errors) : null,
    subject: readText(body, 'subject', errors, guest),
    decisionNo: readText(body, 'decision_no', errors),
    reason: readText(body, 'reason', errors),
    note: readText(body, 'note', errors),
  };
  if (input.endDate && input.movementDate && input.endDate < input.movementDate) {
    errors.push({ field: 'end_date', message: 'Đến ngày phải từ ngày bắt đầu trở đi' });
  }
  return input;
}

@Injectable()
export class StaffMovementsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly reports: ReportsService,
    private readonly protection: ChildDataProtection,
    private readonly identityClient: IdentityClient,
    private readonly clock: Clock,
  ) {}

  private viewScope(currentUser: CurrentUser, orgUnitId: string | null = null) {
    return this.reports.unitScope(currentUser, PERMISSION_CODES.staffView, orgUnitId, false);
  }

  private async assertManager(currentUser: CurrentUser, orgUnitId: string) {
    const scope = await this.reports.unitScope(currentUser, PERMISSION_CODES.staffManage, null, false);
    if (!scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền quản lý hồ sơ nhân sự của đơn vị này');
    }
  }

  async list(
    currentUser: CurrentUser,
    filter: {
      movementType: StaffMovementType;
      orgUnitId: string | null;
      status: StaffMovementStatus | null;
      q: string | null;
      page: number;
      pageSize: number;
    },
  ) {
    const scope = await this.viewScope(currentUser, filter.orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('staff_movements')
      .innerJoin('org_units', 'org_units.id', 'staff_movements.org_unit_id')
      .leftJoin('staff', 'staff.id', 'staff_movements.staff_id')
      .where('staff_movements.movement_type', '=', filter.movementType)
      .where('staff_movements.org_unit_id', 'in', scope.orgUnitIds.length > 0 ? scope.orgUnitIds : ['']);
    if (filter.status) {
      query = query.where('staff_movements.status', '=', filter.status);
    }
    if (filter.q) {
      const pattern = `%${filter.q.replace(/[%_\\]/g, '\\$&')}%`;
      query = query.where((expression) =>
        expression.or([
          expression('staff_movements.full_name', 'ilike', pattern),
          expression('staff_movements.other_school', 'ilike', pattern),
        ]),
      );
    }
    const counted = await query
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    const pageSize = Math.min(filter.pageSize, PAGE_SIZE_LIMIT);
    const rows = await query
      .selectAll('staff_movements')
      .select(['org_units.name as unit_name', 'staff.code as staff_code'])
      .orderBy('staff_movements.movement_date', 'desc')
      .orderBy('staff_movements.created_at', 'desc')
      .limit(pageSize)
      .offset((filter.page - 1) * pageSize)
      .execute();
    const total = Number(counted.count);
    return {
      items: rows.map((row) => this.toView(row)),
      page: filter.page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  private toView<Row extends { movement_type: StaffMovementType; status: StaffMovementStatus; dossier: unknown }>(
    row: Row,
  ) {
    const { dossier, ...rest } = row;
    return {
      ...rest,
      status_label: STATUS_LABELS[row.movement_type][row.status],
      has_dossier: dossier !== null && dossier !== undefined,
    };
  }

  private async load(database: Executor, movementId: string) {
    const row = await database
      .selectFrom('staff_movements')
      .selectAll()
      .where('id', '=', movementId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy biến động nhân sự', 'staff_movement');
    }
    return row;
  }

  async read(currentUser: CurrentUser, movementId: string) {
    const { database } = await this.currentSchoolYear.require();
    const row = await this.load(database, movementId);
    const scope = await this.viewScope(currentUser);
    if (!scope.orgUnitIds.includes(row.org_unit_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem biến động này');
    }
    const dossier = row.dossier as MovementDossier | null;
    const unit = await database
      .selectFrom('org_units')
      .select('name')
      .where('id', '=', row.org_unit_id)
      .executeTakeFirstOrThrow();
    return {
      ...this.toView(row),
      unit_name: unit.name,
      dossier: dossier
        ? {
            moet_staff_code: dossier.moet_staff_code,
            full_name: dossier.full_name,
            dob: dossier.dob,
            gender: dossier.gender,
            email: dossier.email,
            phone: dossier.phone,
            id_number_masked: dossier.id_number_last4 ? maskNationalId(dossier.id_number_last4) : null,
            entries: describeMoetProfile(dossier.moet_profile, MOET_STAFF_COLUMNS) ?? [],
          }
        : null,
    };
  }

  // Bản chụp hồ sơ nhân sự lúc lập phiếu chuyển đi, để xuất hồ sơ chuyển cả khi hồ sơ đã cho nghỉ việc
  private async snapshot(database: Executor, staffId: string): Promise<MovementDossier> {
    const staff = await database
      .selectFrom('staff')
      .select([
        'code',
        'moet_staff_code',
        'full_name',
        'dob',
        'gender',
        'email',
        'phone',
        'id_number_encrypted',
        'id_number_last4',
        'moet_profile',
      ])
      .where('id', '=', staffId)
      .executeTakeFirstOrThrow();
    return { ...staff, moet_profile: staff.moet_profile ?? {} };
  }

  async create(currentUser: CurrentUser, input: MovementInput, origin: ChangeOrigin, dossier?: MovementDossier) {
    const { database } = await this.currentSchoolYear.require();
    let orgUnitId = input.orgUnitId;
    let fullName = input.fullName ?? '';
    let dob = input.dob;
    let gender = input.gender;
    let snapshot: MovementDossier | null = dossier ?? null;
    if (input.staffId) {
      const staff = await database
        .selectFrom('staff')
        .select(['id', 'org_unit_id', 'full_name', 'dob', 'gender', 'status'])
        .where('id', '=', input.staffId)
        .executeTakeFirst();
      if (!staff) {
        throw notFoundError('Không tìm thấy hồ sơ nhân sự', 'staff');
      }
      if (staff.status !== 'active') {
        throw ruleViolationError(STAFF_PARITY_RULE, `${staff.full_name} đã nghỉ việc`);
      }
      orgUnitId = staff.org_unit_id;
      fullName = staff.full_name;
      dob = staff.dob;
      gender = staff.gender;
      if (input.movementType === 'transfer_out') {
        const open = await database
          .selectFrom('staff_movements')
          .select('id')
          .where('staff_id', '=', staff.id)
          .where('movement_type', '=', 'transfer_out')
          .where('status', '=', 'pending')
          .executeTakeFirst();
        if (open) {
          throw ruleViolationError(STAFF_PARITY_RULE, 'Nhân sự này đã có phiếu chuyển đi đang chờ duyệt');
        }
        snapshot = await this.snapshot(database, staff.id);
      }
    }
    const unitId = orgUnitId ?? '';
    await this.assertManager(currentUser, unitId);
    const unit = await database.selectFrom('org_units').select('status').where('id', '=', unitId).executeTakeFirst();
    if (!unit || unit.status !== 'active') {
      throw validationError([{ field: 'org_unit_id', message: 'Chọn đơn vị đang hoạt động' }]);
    }
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('staff_movements')
        .values({
          movement_type: input.movementType,
          org_unit_id: unitId,
          staff_id: input.staffId,
          full_name: fullName,
          dob,
          gender,
          other_province: input.otherProvince,
          other_ward: input.otherWard,
          other_school: input.otherSchool,
          movement_date: input.movementDate,
          end_date: input.endDate,
          subject: input.subject,
          decision_no: input.decisionNo,
          reason: input.reason,
          note: input.note,
          dossier: snapshot ? JSON.stringify(snapshot) : null,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: unitId,
        entityName: 'staff_movements',
        entityId: row.id,
        action: 'create',
        before: null,
        after: { ...input, fullName, has_dossier: snapshot !== null },
      });
      return row;
    });
    return this.read(currentUser, created.id);
  }

  // "Tệp hồ sơ chuyển": dòng đầu của tệp 75 cột theo mẫu Bộ do trường cũ xuất; dùng các ô của tệp làm hồ sơ nháp
  readDossierFile(body: Buffer): MovementDossier {
    const records = mapMoetRows(readWorkbookTable(body, MOET_STAFF_HEADERS), MOET_STAFF_COLUMNS);
    const record = records[0];
    if (!record || records.length > 1) {
      throw validationError([{ field: 'file', message: 'Tệp hồ sơ chuyển phải có đúng một dòng nhân sự' }]);
    }
    const errors: RowError[] = [];
    const values = record.values;
    const fullName = values.full_name ?? '';
    if (!fullName) {
      errors.push({ row: record.row, column: 'Họ tên', message: 'Bắt buộc nhập' });
    }
    const dob = values.dob ? parseDate(values.dob) : null;
    if (values.dob && !dob) {
      errors.push({ row: record.row, column: 'Ngày sinh', message: 'Ngày không hợp lệ' });
    }
    const idNumber = values.id_number ? normalizeIdNumber(values.id_number) : null;
    if (idNumber && !/^(\d{9}|\d{12})$/.test(idNumber)) {
      errors.push({ row: record.row, column: 'CMND/CCCD', message: 'Mười hai chữ số' });
    }
    const profile = buildMoetProfile(record, MOET_STAFF_COLUMNS, (plain) => this.protection.encrypt(plain), errors);
    if (errors.length > 0) {
      throw validationError(
        errors.map((error) => ({ field: 'file', message: `Dòng ${error.row}, ${error.column}: ${error.message}` })),
      );
    }
    const gender = foldText(values.gender ?? '');
    return {
      moet_staff_code: values.moet_staff_code || null,
      full_name: fullName,
      dob,
      gender: gender === 'nam' ? 'male' : gender === 'nu' ? 'female' : null,
      email: values.email || null,
      phone: values.phone ? normalizePhone(values.phone) : null,
      id_number_encrypted: idNumber ? this.protection.encrypt(idNumber) : null,
      id_number_last4: idNumber ? idNumber.slice(-4) : null,
      moet_profile: profile,
    };
  }

  // Duyệt (chuyển đi, đi thỉnh giảng), Tiếp nhận (chuyển đến), Xác nhận (đến thỉnh giảng)
  async approve(currentUser: CurrentUser, accessToken: string, movementId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const movement = await this.load(database, movementId);
    await this.assertManager(currentUser, movement.org_unit_id);
    if (movement.status !== 'pending') {
      throw ruleViolationError(STAFF_PARITY_RULE, 'Biến động này đã được xử lý');
    }
    let staffAccount: string | null = null;
    if (movement.movement_type === 'transfer_out' && movement.staff_id) {
      const staff = await database
        .selectFrom('staff')
        .select(['user_id', 'status'])
        .where('id', '=', movement.staff_id)
        .executeTakeFirstOrThrow();
      staffAccount = staff.status === 'active' ? staff.user_id : null;
      // Khóa tài khoản như chấm dứt hợp đồng (BR-05); gọi trước khi ghi để không cho nghỉ việc mà tài khoản vẫn mở
      if (staffAccount) {
        await this.identityClient.terminateEmployment(accessToken, staffAccount, movement.org_unit_id);
      }
    }
    await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        let createdStaffId: string | null = null;
        if (movement.movement_type === 'transfer_in') {
          createdStaffId = await this.receive(transaction, movement, origin);
        }
        if (movement.movement_type === 'transfer_out' && movement.staff_id) {
          await this.leave(transaction, movement.staff_id, movement.movement_date, movement.other_school);
        }
        await transaction
          .updateTable('staff_movements')
          .set({
            status: 'approved',
            ...(createdStaffId ? { staff_id: createdStaffId } : {}),
            decided_by: origin.actorUserId,
            decided_by_name: origin.actorName,
            decided_at: this.clock.now(),
            updated_at: this.clock.now(),
          })
          .where('id', '=', movementId)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: movement.org_unit_id,
          entityName: 'staff_movements',
          entityId: movementId,
          action: 'update',
          before: { status: 'pending' },
          after: { status: 'approved', staff_id: createdStaffId ?? movement.staff_id, account_locked: Boolean(staffAccount) },
        });
      }),
      'Mã định danh Bộ GD&ĐT của tệp hồ sơ chuyển đã có ở hồ sơ nhân sự khác',
      'moet_staff_code',
    );
    return this.read(currentUser, movementId);
  }

  // Tiếp nhận: tạo hồ sơ nhân sự nháp ở đơn vị tiếp nhận từ tệp hồ sơ chuyển (nếu có) hoặc thông tin đã nhập; trạng thái cán
  // bộ theo Sở là "Chuyển đến"; chưa có tài khoản, hợp đồng (lập ở 3.1.1 như nhân sự mới)
  private async receive(
    transaction: Transaction<SchoolYearDatabase>,
    movement: { org_unit_id: string; full_name: string; dob: string | null; gender: 'male' | 'female' | null; movement_date: string; dossier: unknown },
    origin: ChangeOrigin,
  ): Promise<string> {
    const dossier = movement.dossier as MovementDossier | null;
    const used = new Set((await transaction.selectFrom('staff').select('code').execute()).map((row) => row.code));
    let code: string | null = null;
    while (!code || used.has(code)) {
      code = await nextDocumentCode(transaction, 'staff_transfer_in', 'CDN');
    }
    const created = await transaction
      .insertInto('staff')
      .values({
        org_unit_id: movement.org_unit_id,
        code,
        full_name: dossier?.full_name ?? movement.full_name,
        dob: dossier?.dob ?? movement.dob,
        gender: dossier?.gender ?? movement.gender,
        email: dossier?.email ?? null,
        phone: dossier?.phone ?? null,
        id_number_encrypted: dossier?.id_number_encrypted ?? null,
        id_number_last4: dossier?.id_number_last4 ?? null,
        moet_staff_code: dossier?.moet_staff_code ?? null,
        moet_profile: JSON.stringify({
          ...(dossier?.moet_profile ?? {}),
          staff_status: 'Chuyển đến',
          status_date: movement.movement_date,
        }),
        start_date: movement.movement_date,
        created_by: origin.actorUserId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await writeAuditLog(transaction, {
      origin,
      orgUnitId: movement.org_unit_id,
      entityName: 'staff',
      entityId: created.id,
      action: 'create',
      before: null,
      after: { code, full_name: dossier?.full_name ?? movement.full_name, source: 'transfer_in' },
    });
    return created.id;
  }

  // Chuyển đi được duyệt: nghỉ việc từ ngày chuyển, chấm dứt hợp đồng còn hiệu lực, trạng thái cán bộ "Đã chuyển đi"
  private async leave(
    transaction: Transaction<SchoolYearDatabase>,
    staffId: string,
    movementDate: string,
    destination: string | null,
  ) {
    const staff = await transaction
      .selectFrom('staff')
      .select(['moet_profile', 'start_date'])
      .where('id', '=', staffId)
      .executeTakeFirstOrThrow();
    await transaction
      .updateTable('employment_contracts')
      .set({
        status: 'terminated',
        terminated_on: movementDate,
        terminate_reason: `Chuyển công tác${destination ? ` đến ${destination}` : ''}`,
        updated_at: this.clock.now(),
      })
      .where('staff_id', '=', staffId)
      .where('status', '=', 'active')
      .execute();
    await transaction
      .updateTable('staff')
      .set({
        status: 'terminated',
        end_date: movementDate < staff.start_date ? staff.start_date : movementDate,
        moet_profile: JSON.stringify({
          ...(staff.moet_profile ?? {}),
          staff_status: 'Đã chuyển đi',
          status_date: movementDate,
        }),
        updated_at: this.clock.now(),
      })
      .where('id', '=', staffId)
      .execute();
  }

  async reject(currentUser: CurrentUser, movementId: string, note: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const movement = await this.load(database, movementId);
    await this.assertManager(currentUser, movement.org_unit_id);
    if (movement.status !== 'pending') {
      throw ruleViolationError(STAFF_PARITY_RULE, 'Biến động này đã được xử lý');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('staff_movements')
        .set({
          status: 'rejected',
          decision_note: note,
          decided_by: origin.actorUserId,
          decided_by_name: origin.actorName,
          decided_at: this.clock.now(),
          updated_at: this.clock.now(),
        })
        .where('id', '=', movementId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: movement.org_unit_id,
        entityName: 'staff_movements',
        entityId: movementId,
        action: 'update',
        before: { status: 'pending' },
        after: { status: 'rejected', note },
      });
    });
    return this.read(currentUser, movementId);
  }

  // "Đánh dấu trường đến đã tiếp nhận" của phiếu chuyển đi đã duyệt (đã xác nhận); chưa liên thông nên ghi tay
  async confirm(currentUser: CurrentUser, movementId: string, confirmedOn: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const movement = await this.load(database, movementId);
    await this.assertManager(currentUser, movement.org_unit_id);
    if (movement.movement_type !== 'transfer_out' || movement.status !== 'approved') {
      throw ruleViolationError(STAFF_PARITY_RULE, 'Chỉ đánh dấu tiếp nhận cho phiếu chuyển đi đã duyệt');
    }
    if (confirmedOn > VIETNAM_DATE.format(this.clock.now())) {
      throw validationError([{ field: 'confirmed_on', message: 'Ngày tiếp nhận không sau hôm nay' }]);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('staff_movements')
        .set({ confirmed: true, confirmed_on: confirmedOn, updated_at: this.clock.now() })
        .where('id', '=', movementId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: movement.org_unit_id,
        entityName: 'staff_movements',
        entityId: movementId,
        action: 'update',
        before: { confirmed: movement.confirmed },
        after: { confirmed: true, confirmed_on: confirmedOn },
      });
    });
    return this.read(currentUser, movementId);
  }

  private async logExport(
    database: Executor,
    currentUser: CurrentUser,
    movement: { id: string; org_unit_id: string },
    reportCode: string,
    fileName: string,
    ipAddress: string | null,
  ) {
    await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: reportCode,
        filters_data: JSON.stringify({ movement_id: movement.id }),
        org_unit_ids: [movement.org_unit_id],
        row_count: 1,
        contains_personal_data: true,
        file_name: fileName,
        ip_address: ipAddress,
      })
      .execute();
  }

  // "Xem và in PDF": phiếu biến động kèm các ô của hồ sơ chuyển (số định danh, số sổ BHXH chỉ hiện bốn số cuối)
  async pdf(currentUser: CurrentUser, movementId: string, ipAddress: string | null) {
    const view = await this.read(currentUser, movementId);
    const { database } = await this.currentSchoolYear.require();
    const statusLabel = STATUS_LABELS[view.movement_type][view.status];
    const rows: Array<{ label: string; value: string }> = [
      { label: 'Loại biến động', value: MOVEMENT_LABELS[view.movement_type] },
      { label: 'Họ tên', value: view.full_name },
      { label: 'Ngày sinh', value: formatDate(view.dob) },
      { label: 'Giới tính', value: view.gender === 'male' ? 'Nam' : view.gender === 'female' ? 'Nữ' : '' },
      { label: 'Đơn vị', value: view.unit_name },
      {
        label: view.movement_type === 'transfer_in' || view.movement_type === 'guest_in' ? 'Trường cử đi' : 'Trường đến',
        value: [view.other_school, view.other_ward, view.other_province].filter(Boolean).join(', '),
      },
      { label: view.movement_type.startsWith('guest') ? 'Từ ngày' : 'Ngày chuyển', value: formatDate(view.movement_date) },
      ...(view.end_date ? [{ label: 'Đến ngày', value: formatDate(view.end_date) }] : []),
      ...(view.subject ? [{ label: 'Môn dạy, nội dung', value: view.subject }] : []),
      ...(view.decision_no ? [{ label: 'Số quyết định', value: view.decision_no }] : []),
      ...(view.reason ? [{ label: 'Lý do', value: view.reason }] : []),
      { label: 'Trạng thái', value: statusLabel },
      ...(view.decided_by_name ? [{ label: 'Người xử lý', value: view.decided_by_name }] : []),
      ...(view.movement_type === 'transfer_out'
        ? [{ label: 'Trường đến đã tiếp nhận', value: view.confirmed ? `Có, ngày ${formatDate(view.confirmed_on)}` : 'Chưa' }]
        : []),
      ...(view.dossier
        ? [
            { label: 'Mã định danh Bộ GD&ĐT', value: view.dossier.moet_staff_code ?? '' },
            { label: 'CMND/CCCD', value: view.dossier.id_number_masked ?? '' },
            { label: 'Điện thoại', value: view.dossier.phone ?? '' },
            { label: 'Email', value: view.dossier.email ?? '' },
            ...view.dossier.entries.map((entry) => ({ label: entry.label, value: entry.value })),
          ]
        : []),
    ];
    const fileName = `bien-dong-nhan-su-${view.id.slice(0, 8)}.pdf`;
    const buffer = await buildTableFile(
      'pdf',
      [
        {
          title: MOVEMENT_LABELS[view.movement_type],
          heading: [MOVEMENT_LABELS[view.movement_type].toUpperCase(), `${view.full_name} – ${statusLabel}`],
          columns: [
            { key: 'label', label: 'Nội dung', width: 40 },
            { key: 'value', label: 'Thông tin', width: 80 },
          ],
          rows,
        },
      ],
      this.clock.now(),
    );
    await this.logExport(database, currentUser, view, 'staff-movement-pdf', fileName, ipAddress);
    return { buffer, fileName, contentType: CONTENT_TYPES.pdf };
  }

  // Hồ sơ chuyển theo mẫu Bộ (tệp 75 cột một dòng) của phiếu chuyển đi, dựng từ bản chụp lúc lập phiếu; trường đến dùng
  // tệp này ở "Tiếp nhận nhân sự chuyển đến"
  async ministryFile(currentUser: CurrentUser, movementId: string, ipAddress: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const movement = await this.load(database, movementId);
    const scope = await this.viewScope(currentUser);
    if (!scope.orgUnitIds.includes(movement.org_unit_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem biến động này');
    }
    const dossier = movement.dossier as MovementDossier | null;
    if (movement.movement_type !== 'transfer_out' || !dossier) {
      throw ruleViolationError(STAFF_PARITY_RULE, 'Chỉ phiếu chuyển đi có hồ sơ chuyển');
    }
    const insurance = dossier.moet_profile.social_insurance_number_encrypted;
    const record: MinistryStaffRecord = {
      code: dossier.code ?? '',
      moet_staff_code: dossier.moet_staff_code,
      full_name: dossier.full_name,
      gender: dossier.gender,
      dob: dossier.dob,
      email: dossier.email,
      phone: dossier.phone,
      id_number: dossier.id_number_encrypted ? this.protection.decrypt(dossier.id_number_encrypted) : null,
      social_insurance_number: typeof insurance === 'string' ? this.protection.decrypt(insurance) : null,
      moet_profile: dossier.moet_profile,
    };
    const fileName = `ho-so-chuyen-${movement.id.slice(0, 8)}.xlsx`;
    const buffer = await buildMinistryWorkbook([record], { checks: true });
    await this.logExport(database, currentUser, movement, 'staff-movement-ministry', fileName, ipAddress);
    return { buffer, fileName, contentType: XLSX_TYPE };
  }
}

function sendFile(response: Response, file: { buffer: Buffer; fileName: string; contentType: string }) {
  response.setHeader('content-type', file.contentType);
  response.setHeader('content-disposition', `attachment; filename="${file.fileName}"`);
  response.setHeader('cache-control', 'no-store');
  response.send(file.buffer);
}

interface UploadedPart {
  size: number;
  buffer: Buffer;
}

@Controller('staff-movements')
export class StaffMovementsController {
  constructor(private readonly movements: StaffMovementsService) {}

  @Get()
  @RequirePermission(PERMISSION_CODES.staffView)
  list(@Query() query: QueryValues, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const movementType = query.type as StaffMovementType;
    if (!MOVEMENT_TYPES.includes(movementType)) {
      errors.push({ field: 'type', message: `Loại biến động là ${MOVEMENT_TYPES.join(', ')}` });
    }
    const orgUnitId = optionalUuid(query, 'org_unit_id', errors);
    const status = (query.status || null) as StaffMovementStatus | null;
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      errors.push({ field: 'status', message: 'Trạng thái là pending, approved hoặc rejected' });
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
    return this.movements.list(currentUser, {
      movementType,
      orgUnitId,
      status,
      q: query.q?.trim().slice(0, 100) || null,
      page,
      pageSize,
    });
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(PERMISSION_CODES.staffManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = readMovementInput(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.movements.create(currentUser, input, originOf(request, currentUser));
  }

  // Tiếp nhận chuyển đến kèm tệp hồ sơ chuyển (multipart): họ tên, ngày sinh, giới tính lấy từ tệp
  @Post('transfer-in-file')
  @HttpCode(201)
  @RequirePermission(PERMISSION_CODES.staffManage)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  createFromFile(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp hồ sơ chuyển' }]);
    }
    const dossier = this.movements.readDossierFile(file.buffer);
    const errors: FieldError[] = [];
    const input = readMovementInput(
      {
        ...body,
        movement_type: 'transfer_in',
        full_name: dossier.full_name,
        dob: dossier.dob ?? '',
        gender: dossier.gender ?? '',
      },
      errors,
    );
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.movements.create(currentUser, input, originOf(request, currentUser), dossier);
  }

  @Get(':id')
  @RequirePermission(PERMISSION_CODES.staffView)
  read(
    @Param('id', uuidParameter('Mã biến động không hợp lệ')) movementId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.movements.read(currentUser, movementId);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.staffManage)
  approve(
    @Param('id', uuidParameter('Mã biến động không hợp lệ')) movementId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.movements.approve(
      currentUser,
      readBearerToken(request.header('authorization')),
      movementId,
      originOf(request, currentUser),
    );
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.staffManage)
  reject(
    @Param('id', uuidParameter('Mã biến động không hợp lệ')) movementId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const note = readText(body, 'note', errors, true);
    if (errors.length > 0 || !note) {
      throw validationError(errors);
    }
    return this.movements.reject(currentUser, movementId, note, originOf(request, currentUser));
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.staffManage)
  confirm(
    @Param('id', uuidParameter('Mã biến động không hợp lệ')) movementId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const confirmedOn = readDate(body, 'confirmed_on', errors, true);
    if (errors.length > 0 || !confirmedOn) {
      throw validationError(errors);
    }
    return this.movements.confirm(currentUser, movementId, confirmedOn, originOf(request, currentUser));
  }

  @Get(':id/pdf')
  @RequirePermission(PERMISSION_CODES.staffView)
  async pdf(
    @Param('id', uuidParameter('Mã biến động không hợp lệ')) movementId: string,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    sendFile(response, await this.movements.pdf(currentUser, movementId, request.ip ?? null));
  }

  @Get(':id/ministry-file')
  @RequirePermission(PERMISSION_CODES.dataExport)
  async ministryFile(
    @Param('id', uuidParameter('Mã biến động không hợp lệ')) movementId: string,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    sendFile(response, await this.movements.ministryFile(currentUser, movementId, request.ip ?? null));
  }
}
