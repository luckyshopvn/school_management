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
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { SettingsService } from '../settings/settings.service.js';

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
    return {
      ...this.toView(staff),
      contracts: showContracts ? await this.contracts(database, staffId) : null,
    };
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
  private async assertCatalogs(database: Kysely<SchoolYearDatabase>, input: StaffInput): Promise<void> {
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
