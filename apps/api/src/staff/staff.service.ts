import { Injectable } from '@nestjs/common';
import type { ContractType, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { IdentityClient } from '../authentication/identity-client.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection, maskNationalId } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { conflictOnDuplicate, notFoundError } from '../common/request-fields.js';
import { MOET_STAFF_COLUMNS, describeMoetProfile } from '../imports/moet-columns.js';
import { buildStudentWorkbook, fileStamp } from '../children/student-workbook.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  CONTRACT_TYPE_LABELS,
  idNumberCandidates,
  findStaff,
  STAFF_EXPORT_COLUMNS,
  type StaffListFilter,
  type StaffRecord,
  type StaffRow,
} from './staff-list.js';
import { mergeProfile, profileFieldsOf, type StaffProfileChanges } from './staff-profile.js';

// Hồ sơ nhân sự và hợp đồng lao động (P07-01, P07-02, P07-04; QT-06 mục 2; BR-05, BR-37, BR-38, BR-46; YCTD-58).
// Nhân sự xem được hồ sơ và hợp đồng của chính mình; lương thỏa thuận chỉ người có quyền xem hợp đồng thấy
export interface StaffInput {
  orgUnitId: string;
  code: string;
  fullName: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  idNumber: string | null | undefined;
  departmentId: string | null;
  jobTitleId: string | null;
  startDate: string;
}

export interface ContractInput {
  contractNo: string;
  contractType: ContractType;
  startDate: string;
  endDate: string | null;
  baseSalary: number;
  allowances: Array<{ name: string; amount: number }>;
}

const PAGE_SIZE_LIMIT = 200;
const EXPORT_ROW_LIMIT = 10_000;

const STAFF_COLUMNS = [
  'staff.id',
  'staff.org_unit_id',
  'staff.code',
  'staff.full_name',
  'staff.dob',
  'staff.gender',
  'staff.phone',
  'staff.email',
  'staff.address',
  'staff.id_number_last4',
  'staff.department_id',
  'staff.job_title_id',
  'staff.start_date',
  'staff.end_date',
  'staff.status',
  'staff.user_id',
] as const;

@Injectable()
export class StaffService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly protection: ChildDataProtection,
    private readonly identityClient: IdentityClient,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  async list(
    currentUser: CurrentUser,
    filter: { orgUnitId: string | null; departmentId: string | null; status: string | null; search: string | null },
  ) {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.staffView);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem danh sách nhân sự');
    }
    if (filter.orgUnitId && !scope.wholeSchool && !scope.orgUnitIds.includes(filter.orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = this.staffQuery(database);
    if (filter.orgUnitId) {
      query = query.where('staff.org_unit_id', '=', filter.orgUnitId);
    } else if (!scope.wholeSchool) {
      query = query.where('staff.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.departmentId) {
      query = query.where('staff.department_id', '=', filter.departmentId);
    }
    if (filter.status) {
      query = query.where('staff.status', '=', filter.status as 'active');
    }
    if (filter.search) {
      const pattern = `%${filter.search.replaceAll('%', '').replaceAll('_', '')}%`;
      query = query.where((expression) =>
        expression.or([expression('staff.full_name', 'ilike', pattern), expression('staff.code', 'ilike', pattern)]),
      );
    }
    return (await query.orderBy('staff.full_name').execute()).map((row) => this.toView(row));
  }

  // Hồ sơ của một nhân sự: người có quyền xem trong phạm vi hoặc chính nhân sự đó (BR-46)
  async read(currentUser: CurrentUser, staffId: string) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await this.staffQuery(database).where('staff.id', '=', staffId).executeTakeFirst();
    if (!staff) {
      throw notFoundError('Không tìm thấy hồ sơ nhân sự', 'staff');
    }
    const isSelf = staff.user_id === currentUser.id;
    if (!isSelf && !(await this.inScope(currentUser, PERMISSION_CODES.staffView, staff.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem hồ sơ nhân sự này');
    }
    const showContracts = isSelf || (await this.inScope(currentUser, PERMISSION_CODES.contractView, staff.org_unit_id));
    const moet = await database
      .selectFrom('staff')
      .select(['moet_staff_code', 'moet_profile'])
      .where('id', '=', staffId)
      .executeTakeFirstOrThrow();
    return {
      ...this.toView(staff),
      contracts: showContracts ? await this.contracts(database, staffId) : null,
      // Thông tin theo CSDL ngành, chỉ đọc (YCTD-100)
      moet_staff_code: moet.moet_staff_code,
      moet_profile: describeMoetProfile(moet.moet_profile, MOET_STAFF_COLUMNS),
      // Giá trị gốc của các ô theo Sở cho biểu mẫu hồ sơ (YCTD-112)
      moet_fields: profileFieldsOf(moet.moet_profile),
    };
  }

  // Danh sách cán bộ, giáo viên theo mục 3.1.1, 3.1.4 của Sở (YCTD-112): phân trang ở máy chủ, bộ lọc mở rộng, A–Z
  async search(currentUser: CurrentUser, filter: StaffListFilter & { page: number; pageSize: number }) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return {
        items: [],
        page: filter.page,
        page_size: filter.pageSize,
        total: 0,
        total_pages: 1,
        contract_fields_visible: false,
      };
    }
    const pageSize = Math.min(filter.pageSize, PAGE_SIZE_LIMIT);
    const { total, rows, contractUnits } = await this.staffPage(current.database, currentUser, filter, {
      limit: pageSize,
      offset: (filter.page - 1) * pageSize,
    });
    return {
      items: await this.staffRows(current.database, rows, contractUnits),
      page: filter.page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
      // Màn hình hiện cột số hợp đồng, hạn hợp đồng, lương khi người dùng xem được hợp đồng (BR-46)
      contract_fields_visible: contractUnits.wholeSchool || contractUnits.orgUnitIds.length > 0,
    };
  }

  // Xuất Excel đúng các cột đang hiện trên lưới, theo bộ lọc đang chọn; ghi nhật ký xuất trước khi trả tệp (BR-74)
  async exportList(currentUser: CurrentUser, filter: StaffListFilter, columnIds: string[], ipAddress: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const { total, rows, contractUnits } = await this.staffPage(database, currentUser, filter, {
      limit: EXPORT_ROW_LIMIT,
      offset: 0,
    });
    if (total > EXPORT_ROW_LIMIT) {
      throw ruleViolationError(
        'YCTD-112',
        `Danh sách có hơn ${EXPORT_ROW_LIMIT} nhân sự, hãy thu hẹp bộ lọc trước khi xuất Excel`,
      );
    }
    const columns = columnIds.flatMap((id) => STAFF_EXPORT_COLUMNS.filter((column) => column.id === id));
    const items = await this.staffRows(database, rows, contractUnits);
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'staff',
      title: 'Danh sách cán bộ, giáo viên',
      fileName: `danh-sach-can-bo-giao-vien-${fileStamp(createdAt)}.xlsx`,
      // Không ghi số định danh vào nhật ký (BM-64)
      filters: { ...filter, idNumber: filter.idNumber ? 'đã nhập' : undefined, columns: columnIds },
      orgUnitIds: [...new Set(rows.map((row) => row.org_unit_id))],
      columns: columns.map((column) => ({ key: column.id, label: column.label })),
      rows: items.map((item) => Object.fromEntries(columns.map((column) => [column.id, column.value(item)]))),
      ipAddress,
      createdAt,
    });
  }

  // Ghi hồ sơ theo biểu mẫu của Sở và thông tin riêng của trường; chỉ các ô gửi lên được đổi (YCTD-112)
  async updateProfile(currentUser: CurrentUser, staffId: string, changes: StaffProfileChanges, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('staff')
      .select([
        'id',
        'org_unit_id',
        'code',
        'moet_staff_code',
        'full_name',
        'dob',
        'gender',
        'phone',
        'email',
        'address',
        'id_number_last4',
        'department_id',
        'job_title_id',
        'start_date',
        'moet_profile',
      ])
      .where('id', '=', staffId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy hồ sơ nhân sự', 'staff');
    }
    await this.assertManager(currentUser, existing.org_unit_id);
    await this.assertCatalogs(database, {
      orgUnitId: existing.org_unit_id,
      departmentId: changes.departmentId ?? null,
      jobTitleId: changes.jobTitleId ?? null,
    });
    const columns = {
      ...(changes.moetStaffCode !== undefined ? { moet_staff_code: changes.moetStaffCode } : {}),
      ...(changes.fullName !== undefined ? { full_name: changes.fullName } : {}),
      ...(changes.code !== undefined ? { code: changes.code } : {}),
      ...(changes.dob !== undefined ? { dob: changes.dob } : {}),
      ...(changes.gender !== undefined ? { gender: changes.gender } : {}),
      ...(changes.phone !== undefined ? { phone: changes.phone } : {}),
      ...(changes.email !== undefined ? { email: changes.email } : {}),
      ...(changes.address !== undefined ? { address: changes.address } : {}),
      ...(changes.departmentId !== undefined ? { department_id: changes.departmentId } : {}),
      ...(changes.jobTitleId !== undefined ? { job_title_id: changes.jobTitleId } : {}),
      ...(changes.startDate !== undefined ? { start_date: changes.startDate } : {}),
      ...(changes.idNumber !== undefined
        ? {
            id_number_encrypted: changes.idNumber ? this.protection.encrypt(changes.idNumber) : null,
            id_number_last4: changes.idNumber ? changes.idNumber.slice(-4) : null,
          }
        : {}),
    };
    const profileKeys = Object.keys(changes.profile);
    if (Object.keys(columns).length === 0 && profileKeys.length === 0) {
      throw validationError([{ field: 'moet_profile', message: 'Không có thông tin nào thay đổi' }]);
    }
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const key of Object.keys(columns)) {
      if (key === 'id_number_encrypted') {
        continue;
      }
      before[key] = existing[key as keyof typeof existing];
      after[key] = columns[key as keyof typeof columns];
    }
    // Ô bí mật không ghi giá trị vào nhật ký
    const oldProfile = profileFieldsOf(existing.moet_profile);
    for (const key of profileKeys) {
      before[`moet_profile.${key}`] = oldProfile[key] ?? null;
      after[`moet_profile.${key}`] = key === 'social_insurance_number' ? 'đã đổi' : changes.profile[key];
    }
    await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        await transaction
          .updateTable('staff')
          .set({
            ...columns,
            ...(profileKeys.length > 0
              ? {
                  moet_profile: JSON.stringify(
                    mergeProfile(existing.moet_profile, changes.profile, (plain) => this.protection.encrypt(plain)),
                  ),
                }
              : {}),
            updated_at: this.clock.now(),
          })
          .where('id', '=', staffId)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: existing.org_unit_id,
          entityName: 'staff',
          entityId: staffId,
          action: 'update',
          before,
          after,
        });
      }),
      'Mã nhân sự hoặc mã định danh Bộ GD&ĐT đã có ở hồ sơ khác',
      changes.code !== undefined ? 'code' : 'moet_staff_code',
    );
    return this.read(currentUser, staffId);
  }

  // Lọc theo phạm vi xem nhân sự; số định danh so bằng bốn số cuối rồi giải mã để so đủ mười hai số
  private async staffPage(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    filter: StaffListFilter,
    page: { limit: number; offset: number },
  ) {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.staffView);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem danh sách nhân sự');
    }
    if (filter.orgUnitId && !scope.wholeSchool && !scope.orgUnitIds.includes(filter.orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    const orgUnitIds = scope.wholeSchool ? null : scope.orgUnitIds;
    const today = VIETNAM_DATE.format(this.clock.now());
    let matchedIds: string[] | null = null;
    if (filter.idNumber) {
      const idNumber = filter.idNumber;
      const candidates = await idNumberCandidates(database, orgUnitIds, filter, today, idNumber.slice(-4));
      matchedIds = candidates
        .filter((row) => row.id_number_encrypted && this.protection.decrypt(row.id_number_encrypted) === idNumber)
        .map((row) => row.id);
    }
    const result = await findStaff(database, orgUnitIds, filter, today, matchedIds, page);
    const contractUnits = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.contractView);
    return { ...result, contractUnits };
  }

  // Dòng của lưới: che số định danh; hợp đồng còn hiệu lực chỉ với người xem được hợp đồng của đơn vị (BR-46). Hình thức
  // hợp đồng theo CSDL ngành, trống thì lấy loại hợp đồng còn hiệu lực khi được xem
  private async staffRows(
    database: Kysely<SchoolYearDatabase>,
    rows: StaffRecord[],
    contractUnits: { wholeSchool: boolean; orgUnitIds: string[] },
  ): Promise<Array<StaffRow & { id: string; org_unit_id: string }>> {
    const visible = rows.filter(
      (row) => contractUnits.wholeSchool || contractUnits.orgUnitIds.includes(row.org_unit_id),
    );
    const contracts =
      visible.length > 0
        ? await database
            .selectFrom('employment_contracts')
            .select(['staff_id', 'contract_no', 'contract_type', 'end_date', 'base_salary'])
            .where(
              'staff_id',
              'in',
              visible.map((row) => row.id),
            )
            .where('status', '=', 'active')
            .orderBy('start_date', 'desc')
            .execute()
        : [];
    return rows.map((row) => {
      const { id_number_last4: lastFour, user_id: userId, ...rest } = row;
      const contract = contracts.find((item) => item.staff_id === row.id);
      return {
        ...rest,
        id_number_masked: lastFour ? maskNationalId(lastFour) : null,
        has_account: Boolean(userId),
        contract_form: row.contract_form || (contract ? CONTRACT_TYPE_LABELS[contract.contract_type] : null),
        contract_no: contract?.contract_no ?? null,
        contract_type: contract?.contract_type ?? null,
        contract_end_date: contract?.end_date ?? null,
        base_salary: contract ? Number(contract.base_salary) : null,
      };
    });
  }

  async me(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await database
      .selectFrom('staff')
      .select('id')
      .where('user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Tài khoản chưa gắn với hồ sơ nhân sự', 'staff');
    }
    return this.read(currentUser, staff.id);
  }

  async create(currentUser: CurrentUser, input: StaffInput, origin: ChangeOrigin) {
    await this.assertManager(currentUser, input.orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    await this.assertCatalogs(database, input);
    const created = await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const row = await transaction
          .insertInto('staff')
          .values({ ...this.columns(input), created_by: origin.actorUserId })
          .returning('id')
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: input.orgUnitId,
          entityName: 'staff',
          entityId: row.id,
          action: 'create',
          before: null,
          after: this.auditable(input),
        });
        return row;
      }),
      'Mã nhân sự đã tồn tại',
      'code',
    );
    return this.read(currentUser, created.id);
  }

  async update(currentUser: CurrentUser, staffId: string, input: StaffInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const existing = await this.loadStaff(database, staffId);
    await this.assertManager(currentUser, existing.org_unit_id);
    await this.assertManager(currentUser, input.orgUnitId);
    await this.assertCatalogs(database, input);
    await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const columns = this.columns(input);
        await transaction
          .updateTable('staff')
          .set({
            ...columns,
            // Không gửi số định danh thì giữ số cũ
            ...(input.idNumber === undefined ? { id_number_encrypted: undefined, id_number_last4: undefined } : {}),
            updated_at: this.clock.now(),
          })
          .where('id', '=', staffId)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: input.orgUnitId,
          entityName: 'staff',
          entityId: staffId,
          action: 'update',
          before: { ...existing, id_number_encrypted: undefined },
          after: this.auditable(input),
        });
      }),
      'Mã nhân sự đã tồn tại',
      'code',
    );
    return this.read(currentUser, staffId);
  }

  // Liên kết tài khoản có sẵn theo tên đăng nhập hoặc số điện thoại; mỗi tài khoản gắn tối đa một hồ sơ (YCTD-58)
  async linkAccount(
    currentUser: CurrentUser,
    accessToken: string,
    staffId: string,
    login: string,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await this.loadStaff(database, staffId);
    await this.assertManager(currentUser, staff.org_unit_id);
    const account = await this.identityClient.lookupStaffAccount(accessToken, {
      login,
      org_unit_id: staff.org_unit_id,
    });
    const owner = await database
      .selectFrom('staff')
      .select(['id', 'full_name'])
      .where('user_id', '=', account.user_id)
      .executeTakeFirst();
    if (owner && owner.id !== staffId) {
      throw ruleViolationError('BR-37', `Tài khoản này đã gắn với hồ sơ của ${owner.full_name}`);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('staff')
        .set({ user_id: account.user_id, updated_at: this.clock.now() })
        .where('id', '=', staffId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: staff.org_unit_id,
        entityName: 'staff',
        entityId: staffId,
        action: 'update',
        before: { user_id: staff.user_id },
        after: { user_id: account.user_id, login },
      });
    });
    return this.read(currentUser, staffId);
  }

  async unlinkAccount(currentUser: CurrentUser, staffId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await this.loadStaff(database, staffId);
    await this.assertManager(currentUser, staff.org_unit_id);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('staff')
        .set({ user_id: null, updated_at: this.clock.now() })
        .where('id', '=', staffId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: staff.org_unit_id,
        entityName: 'staff',
        entityId: staffId,
        action: 'update',
        before: { user_id: staff.user_id },
        after: { user_id: null },
      });
    });
    return this.read(currentUser, staffId);
  }

  // Hợp đồng mới không trùng thời gian với hợp đồng còn hiệu lực của cùng nhân sự; gia hạn là lập hợp đồng kế tiếp
  async createContract(currentUser: CurrentUser, staffId: string, input: ContractInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await this.loadStaff(database, staffId);
    await this.assertManager(currentUser, staff.org_unit_id);
    if (input.contractType !== 'indefinite' && !input.endDate) {
      throw validationError([{ field: 'end_date', message: 'Hợp đồng có thời hạn bắt buộc có ngày kết thúc' }]);
    }
    if (input.endDate && input.endDate < input.startDate) {
      throw validationError([{ field: 'end_date', message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi' }]);
    }
    const overlapping = await database
      .selectFrom('employment_contracts')
      .select('contract_no')
      .where('staff_id', '=', staffId)
      .where('status', '=', 'active')
      .where((expression) =>
        expression.and([
          expression.or([expression('end_date', 'is', null), expression('end_date', '>=', input.startDate)]),
          ...(input.endDate ? [expression('start_date', '<=', input.endDate)] : []),
        ]),
      )
      .executeTakeFirst();
    if (overlapping) {
      throw ruleViolationError('BR-38', `Trùng thời gian với hợp đồng ${overlapping.contract_no} còn hiệu lực`);
    }
    const created = await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const row = await transaction
          .insertInto('employment_contracts')
          .values({
            staff_id: staffId,
            contract_no: input.contractNo,
            contract_type: input.contractType,
            start_date: input.startDate,
            end_date: input.contractType === 'indefinite' ? null : input.endDate,
            base_salary: input.baseSalary,
            allowances: JSON.stringify(input.allowances),
            created_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        if (staff.status === 'terminated') {
          await transaction
            .updateTable('staff')
            .set({ status: 'active', end_date: null, updated_at: this.clock.now() })
            .where('id', '=', staffId)
            .execute();
        }
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: staff.org_unit_id,
          entityName: 'employment_contracts',
          entityId: row.id,
          action: 'create',
          before: null,
          after: { staff_id: staffId, ...input },
        });
        return row;
      }),
      'Số hợp đồng đã tồn tại',
      'contract_no',
    );
    return this.readContract(database, created.id);
  }

  // Chấm dứt hợp đồng: khóa tài khoản ngay, báo kế toán lập bảng quyết toán cuối cùng (BR-05, BR-90, CTC-P08-043)
  async terminateContract(
    currentUser: CurrentUser,
    accessToken: string,
    contractId: string,
    input: { terminatedOn: string; reason: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const contract = await database
      .selectFrom('employment_contracts')
      .innerJoin('staff', 'staff.id', 'employment_contracts.staff_id')
      .select([
        'employment_contracts.id',
        'employment_contracts.contract_no',
        'employment_contracts.staff_id',
        'employment_contracts.start_date',
        'employment_contracts.status',
        'staff.org_unit_id',
        'staff.user_id',
        'staff.full_name',
      ])
      .where('employment_contracts.id', '=', contractId)
      .executeTakeFirst();
    if (!contract) {
      throw notFoundError('Không tìm thấy hợp đồng', 'employment_contract');
    }
    await this.assertManager(currentUser, contract.org_unit_id);
    if (contract.status !== 'active') {
      throw ruleViolationError('BR-38', 'Hợp đồng này đã chấm dứt');
    }
    if (input.terminatedOn < contract.start_date) {
      throw validationError([
        { field: 'terminated_on', message: 'Ngày chấm dứt phải từ ngày bắt đầu hợp đồng trở đi' },
      ]);
    }
    if (contract.user_id) {
      await this.identityClient.terminateEmployment(accessToken, contract.user_id, contract.org_unit_id);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('employment_contracts')
        .set({
          status: 'terminated',
          terminated_on: input.terminatedOn,
          terminate_reason: input.reason,
          updated_at: this.clock.now(),
        })
        .where('id', '=', contractId)
        .execute();
      await transaction
        .updateTable('staff')
        .set({ status: 'terminated', end_date: input.terminatedOn, updated_at: this.clock.now() })
        .where('id', '=', contract.staff_id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: contract.org_unit_id,
        entityName: 'employment_contracts',
        entityId: contractId,
        action: 'update',
        before: { status: 'active' },
        after: {
          status: 'terminated',
          terminated_on: input.terminatedOn,
          reason: input.reason,
          account_locked: Boolean(contract.user_id),
        },
      });
      await queueNotification(transaction, {
        orgUnitId: contract.org_unit_id,
        templateCode: 'contract_terminated',
        title: 'Cần lập bảng quyết toán cuối cùng',
        body: `${contract.full_name} chấm dứt hợp đồng ${contract.contract_no} từ ngày ${input.terminatedOn}`,
        targetType: 'employment_contracts',
        targetId: contractId,
        recipients: [{ roleCode: 'VT-04', orgUnitId: contract.org_unit_id, channel: 'in_app' }],
      });
    });
    return this.readContract(database, contractId);
  }

  // Hợp đồng còn hiệu lực sắp hết hạn trong số ngày cảnh báo cấu hình của đơn vị (BR-38, AC-38)
  async expiring(currentUser: CurrentUser) {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.staffView);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem hợp đồng sắp hết hạn');
    }
    const { database } = await this.currentSchoolYear.require();
    const units = scope.wholeSchool
      ? (await database.selectFrom('org_units').select('id').where('status', '=', 'active').execute()).map(
          (row) => row.id,
        )
      : scope.orgUnitIds;
    const today = VIETNAM_DATE.format(this.clock.now());
    const result = [];
    for (const orgUnitId of units) {
      const days = (await this.settings.effective(orgUnitId)).find(
        (item) => item.key === 'contract_expiry_warning_days',
      )?.value;
      if (typeof days !== 'number' || days <= 0) {
        continue;
      }
      const limit = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
      const rows = await database
        .selectFrom('employment_contracts')
        .innerJoin('staff', 'staff.id', 'employment_contracts.staff_id')
        .select([
          'employment_contracts.id',
          'employment_contracts.contract_no',
          'employment_contracts.end_date',
          'staff.id as staff_id',
          'staff.full_name',
          'staff.org_unit_id',
        ])
        .where('staff.org_unit_id', '=', orgUnitId)
        .where('employment_contracts.status', '=', 'active')
        .where('employment_contracts.end_date', '>=', today)
        .where('employment_contracts.end_date', '<=', limit)
        .orderBy('employment_contracts.end_date')
        .execute();
      result.push(...rows);
    }
    return result;
  }

  private async contracts(database: Kysely<SchoolYearDatabase>, staffId: string) {
    const rows = await database
      .selectFrom('employment_contracts')
      .selectAll()
      .where('staff_id', '=', staffId)
      .orderBy('start_date', 'desc')
      .execute();
    return rows.map((row) => ({ ...row, base_salary: Number(row.base_salary) }));
  }

  private async readContract(database: Kysely<SchoolYearDatabase>, contractId: string) {
    const row = await database
      .selectFrom('employment_contracts')
      .selectAll()
      .where('id', '=', contractId)
      .executeTakeFirstOrThrow();
    return { ...row, base_salary: Number(row.base_salary) };
  }

  private staffQuery(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('staff')
      .leftJoin('departments', 'departments.id', 'staff.department_id')
      .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id')
      .innerJoin('org_units', 'org_units.id', 'staff.org_unit_id')
      .select(STAFF_COLUMNS)
      .select([
        'departments.name as department_name',
        'job_titles.name as job_title_name',
        'org_units.name as unit_name',
      ]);
  }

  private toView<Row extends { id_number_last4: string | null; user_id: string | null }>(row: Row) {
    const { id_number_last4: lastFour, ...rest } = row;
    return { ...rest, id_number_masked: lastFour ? maskNationalId(lastFour) : null, has_account: Boolean(row.user_id) };
  }

  private columns(input: StaffInput) {
    return {
      org_unit_id: input.orgUnitId,
      code: input.code,
      full_name: input.fullName,
      dob: input.dob,
      gender: input.gender,
      phone: input.phone,
      email: input.email,
      address: input.address,
      id_number_encrypted: input.idNumber ? this.protection.encrypt(input.idNumber) : null,
      id_number_last4: input.idNumber ? input.idNumber.slice(-4) : null,
      department_id: input.departmentId,
      job_title_id: input.jobTitleId,
      start_date: input.startDate,
    };
  }

  private auditable(input: StaffInput) {
    return { ...input, idNumber: input.idNumber ? maskNationalId(input.idNumber.slice(-4)) : input.idNumber };
  }

  // Phòng ban và chức danh phải thuộc đơn vị chính của nhân sự và đang dùng
  private async assertCatalogs(
    database: Kysely<SchoolYearDatabase>,
    input: Pick<StaffInput, 'orgUnitId' | 'departmentId' | 'jobTitleId'>,
  ): Promise<void> {
    if (input.departmentId) {
      const department = await database
        .selectFrom('departments')
        .select(['org_unit_id', 'status'])
        .where('id', '=', input.departmentId)
        .executeTakeFirst();
      if (!department || department.status !== 'active' || department.org_unit_id !== input.orgUnitId) {
        throw validationError([{ field: 'department_id', message: 'Phòng ban phải đang dùng ở đơn vị của nhân sự' }]);
      }
    }
    if (input.jobTitleId) {
      const jobTitle = await database
        .selectFrom('job_titles')
        .select(['org_unit_id', 'status'])
        .where('id', '=', input.jobTitleId)
        .executeTakeFirst();
      if (!jobTitle || jobTitle.status !== 'active' || jobTitle.org_unit_id !== input.orgUnitId) {
        throw validationError([{ field: 'job_title_id', message: 'Chức danh phải đang dùng ở đơn vị của nhân sự' }]);
      }
    }
  }

  private async loadStaff(database: Kysely<SchoolYearDatabase>, staffId: string) {
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'code', 'full_name', 'status', 'user_id'])
      .where('id', '=', staffId)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Không tìm thấy hồ sơ nhân sự', 'staff');
    }
    return staff;
  }

  private async inScope(currentUser: CurrentUser, permission: string, orgUnitId: string): Promise<boolean> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
    return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
  }

  private async assertManager(currentUser: CurrentUser, orgUnitId: string): Promise<void> {
    if (!(await this.inScope(currentUser, PERMISSION_CODES.staffManage, orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền quản lý hồ sơ nhân sự của đơn vị này');
    }
  }
}
