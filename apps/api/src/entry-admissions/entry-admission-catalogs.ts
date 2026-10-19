import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  ADMISSION_SUPPORT_STATUS_LABELS,
  PERMISSION_CODES,
  type AdmissionSupportStatus,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { buildStudentWorkbook } from '../children/student-workbook.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection, maskNationalId } from '../common/child-data-protection.js';
import { queueNotification } from '../common/notification-queue.js';
import { conflictOnDuplicate, isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { fileStamp, sendWorkbook } from '../facilities/facilities-workbook.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { FinalYearRecordsService } from './final-year-records.js';
import { compareVietnameseNames, ENTRY_ADMISSION_RULE } from './final-year-rules.js';

// Các màn hình còn lại của phân hệ Tuyển sinh đầu cấp phần 1 (DT-17 phần 17c, khảo sát mục 10.2.5):
// - 1.8 Thông tin trường tuyển sinh theo bản đồ GIS: tọa độ, tỉnh/thành phố, phường/xã, khu phố của trường và từng điểm
//   trường; kiểm dò là đủ vĩ độ, kinh độ, tỉnh, phường, khu phố; "Xác nhận" ghi lần xác nhận của trường khi Trường chính đủ
//   thông tin. Không nhúng thư viện bản đồ: "Xem vị trí" ở cổng quản trị mở bản đồ ngoài theo tọa độ;
// - 2.1 Các dịch vụ được đăng ký tại trường: mã, tên, thứ tự; dịch vụ trùng mã với danh mục dịch vụ của phân hệ Tài chính –
//   học phí hiện tên dịch vụ tài chính để đối chiếu;
// - 3.3 Danh sách nhân sự, 3.4 Danh sách lớp: hiển thị nhân sự, lớp sẵn có theo cột của Sở (dùng chung cơ sở dữ liệu nên
//   không có "Đồng bộ dữ liệu", "Xóa"); 3.1, 3.2 cổng quản trị đọc thẳng nhóm người dùng, tài khoản ở dịch vụ định danh;
// - 5.1 Danh sách hỗ trợ tuyển sinh: yêu cầu phụ huynh gửi từ ứng dụng phụ huynh, câu trả lời của trường; "Gửi email" gửi câu
//   trả lời qua thông báo của ứng dụng phụ huynh và thư điện tử khi có nhà cung cấp gửi thư (chỗ nối AdmissionSupportMailer)
const VIEW = [PERMISSION_CODES.finalYearView, PERMISSION_CODES.finalYearManage, PERMISSION_CODES.finalYearApprove];
const MANAGE = PERMISSION_CODES.finalYearManage;
const SUPPORT = [...VIEW, PERMISSION_CODES.admissionSupportReply];
const REPLY = PERMISSION_CODES.admissionSupportReply;
const MAXIMUM_CONTENT = 2000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^0\d{9,10}$/;

// Gửi câu trả lời hỗ trợ tuyển sinh qua thư điện tử. Hệ thống chưa có nhà cung cấp gửi thư nên mặc định không gửi; khi có thì
// thay lớp này ở mô đun ứng dụng
export abstract class AdmissionSupportMailer {
  abstract readonly available: boolean;
  abstract send(input: { to: string; subject: string; body: string }): Promise<void>;
}

export class UnconfiguredAdmissionSupportMailer extends AdmissionSupportMailer {
  readonly available = false;
  async send(): Promise<void> {
    throw new ApplicationError('ERR_INTERNAL', 'Chưa cấu hình gửi thư điện tử');
  }
}

const text = (body: RequestBody, field: string, maximum: number, errors: FieldError[], required = false) => {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return value === undefined ? undefined : null;
  }
  if (typeof value !== 'string' || value.trim().length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
    return undefined;
  }
  return value.trim() || null;
};

const coordinate = (body: RequestBody, field: string, limit: number, errors: FieldError[]) => {
  const value = body?.[field];
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  const number = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  if (typeof number !== 'number' || !Number.isFinite(number) || Math.abs(number) > limit) {
    errors.push({ field, message: `Tọa độ là số từ -${limit} đến ${limit}` });
    return undefined;
  }
  return Math.round(number * 1_000_000) / 1_000_000;
};

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

export interface SchoolMapInput {
  latitude?: number | null;
  longitude?: number | null;
  province?: string | null;
  ward?: string | null;
  quarter?: string | null;
  phone?: string | null;
  address?: string | null;
}

// Kiểm dò vị trí của đơn vị: đủ vĩ độ, kinh độ, tỉnh/thành phố, phường/xã, khu phố (ba ô bắt buộc như Sở)
export function mapMissing(unit: {
  latitude: number | null;
  longitude: number | null;
  province: string | null;
  ward: string | null;
  quarter: string | null;
}): string[] {
  const missing: string[] = [];
  if (unit.latitude === null || unit.longitude === null) {
    missing.push('vĩ độ, kinh độ');
  }
  for (const [key, label] of [
    ['province', 'tỉnh/thành phố'],
    ['ward', 'phường/xã'],
    ['quarter', 'khu phố'],
  ] as const) {
    if (!unit[key]) {
      missing.push(label);
    }
  }
  return missing;
}

@Injectable()
export class EntryAdmissionCatalogsService {
  constructor(
    private readonly records: FinalYearRecordsService,
    private readonly organizationScopes: OrganizationScopes,
    private readonly protection: ChildDataProtection,
    private readonly mailer: AdmissionSupportMailer,
    private readonly clock: Clock,
  ) {}

  private database(): Promise<Kysely<SchoolYearDatabase>> {
    return this.records.database();
  }

  // 1.8: Trường chính (ô nhập) và lưới điểm trường (phân hiệu, điểm trường đang dùng)
  async schoolMap(currentUser: CurrentUser) {
    const unitIds = await this.records.scopeUnits(currentUser, VIEW);
    const database = await this.database();
    let query = database
      .selectFrom('org_units')
      .select([
        'id',
        'code',
        'name',
        'unit_type',
        'address',
        'phone',
        'latitude',
        'longitude',
        'province',
        'ward',
        'quarter',
        'map_confirmed_at',
        'map_confirmed_by_name',
      ])
      .where('status', '=', 'active')
      .orderBy('code');
    if (unitIds) {
      query = query.where('id', 'in', unitIds);
    }
    const units = (await query.execute()).map((unit) => {
      const view = {
        ...unit,
        latitude: unit.latitude === null ? null : Number(unit.latitude),
        longitude: unit.longitude === null ? null : Number(unit.longitude),
      };
      const missing = mapMissing(view);
      return { ...view, missing, check_text: missing.length ? `Thiếu ${missing.join(', ')}` : 'Đủ thông tin' };
    });
    return {
      school: units.find((unit) => unit.unit_type === 'truong_chinh') ?? null,
      sites: units.filter((unit) => unit.unit_type !== 'truong_chinh'),
    };
  }

  async saveSchoolMap(currentUser: CurrentUser, unitId: string, input: SchoolMapInput, origin: ChangeOrigin) {
    await this.organizationScopes.assertCanAccess(currentUser, MANAGE, unitId);
    const database = await this.database();
    const before = await database.selectFrom('org_units').selectAll().where('id', '=', unitId).executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy đơn vị', 'org_unit');
    }
    await database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('org_units')
        .set({ ...input, updated_at: this.clock.now() })
        .where('id', '=', unitId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: unitId,
        entityName: 'org_units',
        entityId: unitId,
        action: 'update',
        before,
        after,
      });
    });
    return this.schoolMap(currentUser);
  }

  async confirmSchoolMap(currentUser: CurrentUser, origin: ChangeOrigin) {
    const database = await this.database();
    const root = await this.records.root(database);
    await this.organizationScopes.assertCanAccess(currentUser, MANAGE, root.id);
    const { school } = await this.schoolMap(currentUser);
    if (!school || school.missing.length > 0) {
      throw ruleViolationError(
        ENTRY_ADMISSION_RULE,
        `Thông tin trường chưa đủ: thiếu ${school?.missing.join(', ') ?? 'Trường chính'}`,
      );
    }
    await database
      .updateTable('org_units')
      .set({ map_confirmed_at: this.clock.now(), map_confirmed_by_name: origin.actorName })
      .where('id', '=', root.id)
      .execute();
    return this.schoolMap(currentUser);
  }

  // 2.1: dịch vụ đăng ký tại trường, lọc theo mã, tên
  async services(currentUser: CurrentUser, filter: { code?: string; name?: string }) {
    await this.records.scopeUnits(currentUser, VIEW);
    const database = await this.database();
    let query = database
      .selectFrom('school_services')
      .leftJoin('services', 'services.code', 'school_services.code')
      .select([
        'school_services.id',
        'school_services.code',
        'school_services.name',
        'school_services.sort_order',
        'services.name as finance_service_name',
      ])
      .orderBy('school_services.sort_order')
      .orderBy('school_services.code');
    if (filter.code) {
      query = query.where('school_services.code', 'ilike', `%${filter.code.replace(/[%_\\]/g, '\\$&')}%`);
    }
    if (filter.name) {
      query = query.where('school_services.name', 'ilike', `%${filter.name.replace(/[%_\\]/g, '\\$&')}%`);
    }
    return { items: await query.execute() };
  }

  private async assertWholeSchoolManage(currentUser: CurrentUser) {
    const scope = await this.organizationScopes.resolveStaff(currentUser, MANAGE);
    if (!scope.wholeSchool) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người có phạm vi toàn trường sửa danh mục dịch vụ');
    }
  }

  async saveService(
    currentUser: CurrentUser,
    serviceId: string | null,
    input: { code: string; name: string; sort_order: number },
    origin: ChangeOrigin,
  ) {
    await this.assertWholeSchoolManage(currentUser);
    const database = await this.database();
    const root = await this.records.root(database);
    const saved = await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const before = serviceId
          ? await transaction.selectFrom('school_services').selectAll().where('id', '=', serviceId).executeTakeFirst()
          : undefined;
        if (serviceId && !before) {
          throw notFoundError('Không tìm thấy dịch vụ', 'school_service');
        }
        const after = serviceId
          ? await transaction
              .updateTable('school_services')
              .set({ ...input, updated_at: this.clock.now() })
              .where('id', '=', serviceId)
              .returningAll()
              .executeTakeFirstOrThrow()
          : await transaction
              .insertInto('school_services')
              .values({ ...input, created_by: origin.actorUserId })
              .returningAll()
              .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: root.id,
          entityName: 'school_services',
          entityId: after.id,
          action: before ? 'update' : 'create',
          before: before ?? null,
          after,
        });
        return after;
      }),
      'Mã dịch vụ đã có',
      'code',
    );
    return saved;
  }

  async removeServices(currentUser: CurrentUser, ids: string[], origin: ChangeOrigin) {
    await this.assertWholeSchoolManage(currentUser);
    const database = await this.database();
    const root = await this.records.root(database);
    const removed = await database.transaction().execute(async (transaction) => {
      const rows = await transaction.deleteFrom('school_services').where('id', 'in', ids).returningAll().execute();
      for (const row of rows) {
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: root.id,
          entityName: 'school_services',
          entityId: row.id,
          action: 'delete',
          before: row,
          after: null,
        });
      }
      return rows.length;
    });
    return { removed };
  }

  async exportServices(currentUser: CurrentUser, filter: { code?: string; name?: string }, ipAddress: string | null) {
    const { items } = await this.services(currentUser, filter);
    const database = await this.database();
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'entry_school_services',
      title: 'Các dịch vụ được đăng ký tại trường',
      fileName: `dich-vu-tai-truong-${fileStamp(createdAt)}.xlsx`,
      filters: filter,
      orgUnitIds: [],
      columns: [
        { key: 'code', label: 'Mã dịch vụ' },
        { key: 'name', label: 'Tên dịch vụ' },
        { key: 'sort_order', label: 'Thứ tự' },
        { key: 'finance_service_name', label: 'Dịch vụ tài chính cùng mã' },
      ],
      rows: items,
      ipAddress,
      createdAt,
      containsPersonalData: false,
    });
  }

  // 3.3: nhân sự đang làm việc trong phạm vi; mã định danh là mã định danh Bộ GD&ĐT, chưa có thì mã nhân sự
  async staff(currentUser: CurrentUser, filter: { code?: string; name?: string; phone?: string }) {
    const unitIds = await this.records.scopeUnits(currentUser, VIEW);
    const database = await this.database();
    let query = database
      .selectFrom('staff')
      .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id')
      .select([
        'staff.id',
        'staff.code',
        'staff.moet_staff_code',
        'staff.full_name',
        'staff.dob',
        'staff.gender',
        'staff.phone',
        'job_titles.name as job_title',
      ])
      .where('staff.status', '=', 'active');
    if (unitIds) {
      query = query.where('staff.org_unit_id', 'in', unitIds);
    }
    const rows = (await query.execute())
      .map((row) => ({ ...row, identifier: row.moet_staff_code ?? row.code }))
      .filter(
        (row) =>
          (!filter.code || row.identifier.toLowerCase().includes(filter.code.toLowerCase())) &&
          (!filter.name || row.full_name.toLocaleLowerCase('vi').includes(filter.name.toLocaleLowerCase('vi'))) &&
          (!filter.phone || (row.phone ?? '').includes(filter.phone)),
      )
      .sort((left, right) => compareVietnameseNames(left.full_name, right.full_name));
    return { items: rows };
  }

  async exportStaff(
    currentUser: CurrentUser,
    filter: { code?: string; name?: string; phone?: string },
    ipAddress: string | null,
  ) {
    const { items } = await this.staff(currentUser, filter);
    const database = await this.database();
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'entry_staff',
      title: 'Danh sách nhân sự',
      fileName: `danh-sach-nhan-su-tsdc-${fileStamp(createdAt)}.xlsx`,
      filters: filter,
      orgUnitIds: [],
      columns: [
        { key: 'identifier', label: 'Mã định danh' },
        { key: 'full_name', label: 'Họ tên' },
        { key: 'dob', label: 'Ngày sinh' },
        { key: 'gender_label', label: 'Giới tính' },
        { key: 'phone', label: 'Điện thoại' },
        { key: 'job_title', label: 'Chức vụ' },
      ],
      rows: items.map((row) => ({
        ...row,
        gender_label: row.gender === 'male' ? 'Nam' : row.gender === 'female' ? 'Nữ' : '',
      })),
      ipAddress,
      createdAt,
    });
  }

  // 3.4: lớp đang dùng trong phạm vi, lọc theo khối (bậc học); giáo viên chủ nhiệm đang phân công
  async classes(currentUser: CurrentUser, gradeLevel: string | undefined) {
    const unitIds = await this.records.scopeUnits(currentUser, VIEW);
    const database = await this.database();
    let query = database
      .selectFrom('classes')
      .innerJoin('grade_levels', 'grade_levels.code', 'classes.grade_level')
      .select([
        'classes.id',
        'classes.name',
        'classes.grade_level',
        'classes.sort_order',
        'grade_levels.name as grade_level_name',
        'grade_levels.order_no',
      ])
      .where('classes.status', '=', 'active')
      .orderBy('grade_levels.order_no')
      .orderBy('classes.sort_order')
      .orderBy('classes.name');
    if (unitIds) {
      query = query.where('classes.org_unit_id', 'in', unitIds);
    }
    if (gradeLevel) {
      query = query.where('classes.grade_level', '=', gradeLevel);
    }
    const classes = await query.execute();
    const homeroom = classes.length
      ? await database
          .selectFrom('class_staff_assignments')
          .select(['class_id', 'staff_name'])
          .where(
            'class_id',
            'in',
            classes.map((item) => item.id),
          )
          .where('assignment_role', '=', 'homeroom')
          .where('status', '=', 'active')
          .execute()
      : [];
    const grades = await database
      .selectFrom('grade_levels')
      .select(['code', 'name'])
      .where('status', '=', 'active')
      .orderBy('order_no')
      .execute();
    return {
      grade_levels: grades,
      items: classes.map((item) => ({
        ...item,
        homeroom_teachers: homeroom
          .filter((row) => row.class_id === item.id)
          .map((row) => row.staff_name)
          .join(', '),
      })),
    };
  }

  // 5.1: yêu cầu hỗ trợ trong phạm vi; số định danh của trẻ che bốn số cuối, lọc theo số đầy đủ qua mã băm
  async supportRequests(
    currentUser: CurrentUser,
    filter: { q?: string; nationalId?: string; status?: AdmissionSupportStatus },
  ) {
    const unitIds = await this.records.scopeUnits(currentUser, SUPPORT);
    const database = await this.database();
    let query = database
      .selectFrom('admission_support_requests as request')
      .leftJoin('children', 'children.id', 'request.child_id')
      .select([
        'request.id',
        'request.org_unit_id',
        'request.child_id',
        'request.requester_name',
        'request.email',
        'request.phone',
        'request.content',
        'request.status',
        'request.reply',
        'request.replied_by_name',
        'request.replied_at',
        'request.notified_at',
        'request.notified_channels',
        'request.created_at',
        'children.full_name as child_name',
        'children.dob as child_dob',
        'children.national_id_last4',
        'children.national_id_hash',
      ])
      .orderBy('request.created_at', 'desc');
    if (unitIds) {
      query = query.where('request.org_unit_id', 'in', unitIds);
    }
    if (filter.status) {
      query = query.where('request.status', '=', filter.status);
    }
    const hash = filter.nationalId ? this.protection.hash(filter.nationalId) : null;
    const q = filter.q?.toLocaleLowerCase('vi');
    const rows = (await query.execute()).filter(
      (row) =>
        (!hash || row.national_id_hash === hash) &&
        (!q ||
          row.requester_name.toLocaleLowerCase('vi').includes(q) ||
          (row.child_name ?? '').toLocaleLowerCase('vi').includes(q)),
    );
    return {
      items: rows.map((row) => {
        const item: Partial<typeof row> & { national_id: string | null } = {
          ...row,
          national_id: row.national_id_last4 ? maskNationalId(row.national_id_last4) : null,
        };
        delete item.national_id_hash;
        delete item.national_id_last4;
        return item as Omit<typeof row, 'national_id_hash' | 'national_id_last4'> & { national_id: string | null };
      }),
    };
  }

  private async findRequest(database: Kysely<SchoolYearDatabase>, requestId: string) {
    const row = await database
      .selectFrom('admission_support_requests')
      .selectAll()
      .where('id', '=', requestId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy yêu cầu hỗ trợ', 'admission_support_request');
    }
    return row;
  }

  // "Cập nhật": ghi câu trả lời; có câu trả lời là đã trả lời
  async reply(currentUser: CurrentUser, requestId: string, reply: string | null, origin: ChangeOrigin) {
    const database = await this.database();
    const before = await this.findRequest(database, requestId);
    await this.organizationScopes.assertCanAccess(currentUser, REPLY, before.org_unit_id);
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('admission_support_requests')
        .set({
          reply,
          status: reply ? 'answered' : 'pending',
          replied_by: reply ? origin.actorUserId : null,
          replied_by_name: reply ? origin.actorName : null,
          replied_at: reply ? now : null,
          updated_at: now,
        })
        .where('id', '=', requestId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'admission_support_requests',
        entityId: requestId,
        action: 'update',
        before,
        after,
      });
    });
    return { id: requestId, status: reply ? 'answered' : 'pending' };
  }

  // "Gửi email": gửi câu trả lời cho phụ huynh qua thông báo của ứng dụng phụ huynh; có nhà cung cấp gửi thư và phụ huynh có
  // địa chỉ thư thì gửi thêm thư điện tử. Yêu cầu chưa có câu trả lời thì bỏ qua
  async notify(currentUser: CurrentUser, ids: string[], origin: ChangeOrigin) {
    const database = await this.database();
    const rows = await database.selectFrom('admission_support_requests').selectAll().where('id', 'in', ids).execute();
    const skipped: Array<{ id: string; reason: string }> = [];
    let sent = 0;
    for (const id of ids) {
      const row = rows.find((item) => item.id === id);
      if (!row) {
        skipped.push({ id, reason: 'Không tìm thấy yêu cầu' });
        continue;
      }
      try {
        await this.organizationScopes.assertCanAccess(currentUser, REPLY, row.org_unit_id);
      } catch {
        skipped.push({ id, reason: 'Yêu cầu nằm ngoài phạm vi của bạn' });
        continue;
      }
      if (!row.reply) {
        skipped.push({ id, reason: 'Chưa có nội dung trả lời' });
        continue;
      }
      const channels = ['Ứng dụng phụ huynh'];
      if (this.mailer.available && row.email) {
        try {
          await this.mailer.send({ to: row.email, subject: 'Trả lời yêu cầu hỗ trợ tuyển sinh', body: row.reply });
          channels.push('Thư điện tử');
        } catch {
          // Thư lỗi vẫn gửi thông báo trong ứng dụng; kênh đã gửi ghi lại để người dùng biết
        }
      }
      const now = this.clock.now();
      await database.transaction().execute(async (transaction) => {
        await queueNotification(transaction, {
          orgUnitId: row.org_unit_id,
          templateCode: 'admission_support_reply',
          title: 'Nhà trường trả lời yêu cầu hỗ trợ tuyển sinh',
          body: row.reply as string,
          targetType: 'admission_support_request',
          targetId: row.id,
          recipients: [{ userId: row.requester_user_id, channel: 'in_app' }],
        });
        await transaction
          .updateTable('admission_support_requests')
          .set({ notified_at: now, notified_channels: channels.join(', '), updated_at: now })
          .where('id', '=', row.id)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'admission_support_requests',
          entityId: row.id,
          action: 'update',
          before: { notified_at: row.notified_at },
          after: { notified_at: now, notified_channels: channels.join(', ') },
        });
      });
      sent += 1;
    }
    return { sent, skipped, email_available: this.mailer.available };
  }

  async exportSupport(
    currentUser: CurrentUser,
    filter: { q?: string; nationalId?: string; status?: AdmissionSupportStatus },
    ipAddress: string | null,
  ) {
    const { items } = await this.supportRequests(currentUser, filter);
    const database = await this.database();
    const createdAt = this.clock.now();
    const at = (value: Date | null) => (value ? value.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'admission_support_requests',
      title: 'Danh sách hỗ trợ tuyển sinh',
      fileName: `ho-tro-tuyen-sinh-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter, nationalId: filter.nationalId ? 'có' : undefined },
      orgUnitIds: [...new Set(items.map((item) => item.org_unit_id))],
      columns: [
        { key: 'name', label: 'Họ tên' },
        { key: 'child_dob', label: 'Ngày sinh' },
        { key: 'national_id', label: 'Mã số ĐDCN' },
        { key: 'email', label: 'Địa chỉ email' },
        { key: 'phone', label: 'Điện thoại' },
        { key: 'content', label: 'Nội dung đề xuất' },
        { key: 'sent_at', label: 'Ngày gửi' },
        { key: 'reply', label: 'Nội dung câu trả lời' },
        { key: 'status_label', label: 'Trạng thái' },
        { key: 'replied_by_name', label: 'Người trả lời' },
        { key: 'replied_at_text', label: 'Thời gian trả lời' },
      ],
      rows: items.map((item) => ({
        ...item,
        name: item.child_name ?? item.requester_name,
        sent_at: at(item.created_at),
        status_label: ADMISSION_SUPPORT_STATUS_LABELS[item.status],
        replied_at_text: at(item.replied_at),
      })),
      ipAddress,
      createdAt,
    });
  }

  // Ứng dụng phụ huynh: gửi yêu cầu hỗ trợ tuyển sinh cho trường của con (chọn con) và xem các yêu cầu đã gửi
  async submitSupport(
    currentUser: CurrentUser,
    input: { childId: string; content: string; email: string | null; phone: string | null },
    origin: ChangeOrigin,
  ) {
    const database = await this.database();
    const child = await database
      .selectFrom('children')
      .select(['id', 'org_unit_id'])
      .where('id', '=', input.childId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!child || !(await this.records.isGuardian(database, currentUser.id, child.id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ gửi yêu cầu hỗ trợ cho con của bạn');
    }
    return database
      .insertInto('admission_support_requests')
      .values({
        org_unit_id: child.org_unit_id,
        child_id: child.id,
        requester_user_id: currentUser.id,
        requester_name: origin.actorName,
        email: input.email,
        phone: input.phone,
        content: input.content,
      })
      .returning(['id', 'status', 'created_at'])
      .executeTakeFirstOrThrow();
  }

  async mySupport(currentUser: CurrentUser) {
    const database = await this.database();
    return {
      items: await database
        .selectFrom('admission_support_requests as request')
        .leftJoin('children', 'children.id', 'request.child_id')
        .select([
          'request.id',
          'request.child_id',
          'children.full_name as child_name',
          'request.content',
          'request.status',
          'request.reply',
          'request.replied_at',
          'request.created_at',
        ])
        .where('request.requester_user_id', '=', currentUser.id)
        .orderBy('request.created_at', 'desc')
        .execute(),
    };
  }
}

function readSchoolMapInput(body: RequestBody, errors: FieldError[]): SchoolMapInput {
  const input: SchoolMapInput = {};
  const latitude = coordinate(body, 'latitude', 90, errors);
  const longitude = coordinate(body, 'longitude', 180, errors);
  if (latitude !== undefined) {
    input.latitude = latitude;
  }
  if (longitude !== undefined) {
    input.longitude = longitude;
  }
  for (const field of ['province', 'ward', 'quarter', 'address'] as const) {
    const value = text(body, field, 300, errors);
    if (value !== undefined) {
      input[field] = value;
    }
  }
  const phone = text(body, 'phone', 20, errors);
  if (phone !== undefined) {
    input.phone = phone;
  }
  return input;
}

function readSupportFilter(query: Record<string, unknown>, errors: FieldError[]) {
  const nationalId = typeof query.national_id === 'string' && query.national_id !== '' ? query.national_id : undefined;
  if (nationalId && !/^\d{12}$/.test(nationalId)) {
    errors.push({ field: 'national_id', message: 'Số định danh cá nhân gồm mười hai chữ số' });
  }
  const status = query.status;
  if (status !== undefined && status !== '' && status !== 'pending' && status !== 'answered') {
    errors.push({ field: 'status', message: 'Trạng thái là pending hoặc answered' });
  }
  return {
    q: typeof query.q === 'string' && query.q.trim() !== '' ? query.q.trim().slice(0, 100) : undefined,
    nationalId,
    status: (status || undefined) as AdmissionSupportStatus | undefined,
  };
}

const textFilter = (query: Record<string, unknown>, field: string) =>
  typeof query[field] === 'string' && (query[field] as string).trim() !== ''
    ? (query[field] as string).trim().slice(0, 100)
    : undefined;

@Controller()
export class EntryAdmissionCatalogsController {
  constructor(private readonly catalogs: EntryAdmissionCatalogsService) {}

  @Get('entry-school-map')
  @RequirePermission(...VIEW)
  schoolMap(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalogs.schoolMap(currentUser);
  }

  @Post('entry-school-map/confirm')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  confirmSchoolMap(@Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalogs.confirmSchoolMap(currentUser, originOf(request, currentUser));
  }

  @Put('entry-school-map/:unitId')
  @RequirePermission(MANAGE)
  saveSchoolMap(
    @Param('unitId', uuidParameter('Mã đơn vị không hợp lệ')) unitId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readSchoolMapInput(body, errors);
    check(errors);
    return this.catalogs.saveSchoolMap(currentUser, unitId, input, originOf(request, currentUser));
  }

  @Get('school-services')
  @RequirePermission(...VIEW)
  services(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalogs.services(currentUser, { code: textFilter(query, 'code'), name: textFilter(query, 'name') });
  }

  @Post('school-services')
  @RequirePermission(MANAGE)
  createService(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalogs.saveService(currentUser, null, readService(body), originOf(request, currentUser));
  }

  @Post('school-services/export')
  @HttpCode(200)
  @RequirePermission(...VIEW)
  async exportServices(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const filter = (body?.filter as Record<string, unknown>) ?? {};
    sendWorkbook(
      response,
      await this.catalogs.exportServices(
        currentUser,
        { code: textFilter(filter, 'code'), name: textFilter(filter, 'name') },
        request.ip ?? null,
      ),
    );
  }

  @Post('school-services/delete')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  removeServices(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const ids = body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || ids.some((id) => !isUuid(id))) {
      throw validationError([{ field: 'ids', message: 'Chọn từ 1 đến 500 dịch vụ' }]);
    }
    return this.catalogs.removeServices(currentUser, ids as string[], originOf(request, currentUser));
  }

  @Put('school-services/:id')
  @RequirePermission(MANAGE)
  updateService(
    @Param('id', uuidParameter('Mã dịch vụ không hợp lệ')) serviceId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.catalogs.saveService(currentUser, serviceId, readService(body), originOf(request, currentUser));
  }

  @Get('entry-admissions/staff')
  @RequirePermission(...VIEW)
  staff(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalogs.staff(currentUser, {
      code: textFilter(query, 'code'),
      name: textFilter(query, 'name'),
      phone: textFilter(query, 'phone'),
    });
  }

  @Post('entry-admissions/staff/export')
  @HttpCode(200)
  @RequirePermission(...VIEW)
  async exportStaff(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const filter = (body?.filter as Record<string, unknown>) ?? {};
    sendWorkbook(
      response,
      await this.catalogs.exportStaff(
        currentUser,
        { code: textFilter(filter, 'code'), name: textFilter(filter, 'name'), phone: textFilter(filter, 'phone') },
        request.ip ?? null,
      ),
    );
  }

  @Get('entry-admissions/classes')
  @RequirePermission(...VIEW)
  classes(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalogs.classes(currentUser, textFilter(query, 'grade_level'));
  }

  @Get('admission-support')
  @RequirePermission(...SUPPORT)
  support(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = readSupportFilter(query, errors);
    check(errors);
    return this.catalogs.supportRequests(currentUser, filter);
  }

  @Post('admission-support/notify')
  @HttpCode(200)
  @RequirePermission(REPLY)
  notify(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const ids = body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || ids.some((id) => !isUuid(id))) {
      throw validationError([{ field: 'ids', message: 'Chọn từ 1 đến 500 yêu cầu' }]);
    }
    return this.catalogs.notify(currentUser, ids as string[], originOf(request, currentUser));
  }

  @Post('admission-support/export')
  @HttpCode(200)
  @RequirePermission(...SUPPORT)
  async exportSupport(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const filter = readSupportFilter((body?.filter as Record<string, unknown>) ?? {}, errors);
    check(errors);
    sendWorkbook(response, await this.catalogs.exportSupport(currentUser, filter, request.ip ?? null));
  }

  @Put('admission-support/:id')
  @RequirePermission(REPLY)
  reply(
    @Param('id', uuidParameter('Mã yêu cầu không hợp lệ')) requestId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reply = text(body, 'reply', MAXIMUM_CONTENT, errors);
    check(errors);
    return this.catalogs.reply(currentUser, requestId, reply ?? null, originOf(request, currentUser));
  }

  // Ứng dụng phụ huynh
  @Get('parent/admission-support')
  mySupport(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalogs.mySupport(currentUser);
  }

  @Post('parent/admission-support')
  submitSupport(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const childId = body?.child_id;
    if (!isUuid(childId)) {
      errors.push({ field: 'child_id', message: 'Bắt buộc chọn con' });
    }
    const content = text(body, 'content', MAXIMUM_CONTENT, errors, true);
    const email = text(body, 'email', 200, errors);
    if (email && !EMAIL_PATTERN.test(email)) {
      errors.push({ field: 'email', message: 'Địa chỉ thư điện tử không hợp lệ' });
    }
    const phone = text(body, 'phone', 20, errors);
    if (phone && !PHONE_PATTERN.test(phone)) {
      errors.push({ field: 'phone', message: 'Số điện thoại gồm 10 hoặc 11 chữ số, bắt đầu bằng 0' });
    }
    check(errors);
    return this.catalogs.submitSupport(
      currentUser,
      { childId: childId as string, content: content as string, email: email ?? null, phone: phone ?? null },
      originOf(request, currentUser),
    );
  }
}

function readService(body: RequestBody) {
  const errors: FieldError[] = [];
  const code = text(body, 'code', 50, errors, true);
  const name = text(body, 'name', 200, errors, true);
  const order = body?.sort_order;
  if (
    order !== undefined &&
    order !== null &&
    (!Number.isInteger(order) || (order as number) < 0 || (order as number) > 9999)
  ) {
    errors.push({ field: 'sort_order', message: 'Thứ tự là số nguyên từ 0 đến 9999' });
  }
  check(errors);
  return { code: code as string, name: name as string, sort_order: (order as number | undefined) ?? 0 };
}
