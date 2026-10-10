import { Injectable } from '@nestjs/common';
import type { ChildGender, ChildStatus, PhotoConsent, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { sql, type Kysely, type Transaction } from 'kysely';
import { IdentityClient } from '../authentication/identity-client.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection, maskNationalId } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { writeDataAccessLog } from '../common/data-access-log.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { ChildScope } from './child-scope.js';

// Hồ sơ trẻ từ lúc tiếp nhận đến khi vào lớp (QT-01, P02-01, 02, 03, 06, 10; YCTD-45)
export interface GuardianInput {
  full_name: string;
  phone: string | null;
  relationship_item_id: string;
  is_primary: boolean;
  occupation: string | null;
  email: string | null;
  address: string | null;
}

export interface HealthInput {
  has_allergies: boolean | null;
  allergies: string | null;
  chronic_conditions: string | null;
  blood_type: string | null;
  note: string | null;
}

export interface ChildInput {
  org_unit_id: string;
  full_name: string;
  dob: string;
  gender: ChildGender;
  place_of_birth: string | null;
  address: string | null;
  national_id: string;
  moet_student_code: string | null;
  birth_certificate_file_id: string;
  special_needs_note: string | null;
  note: string | null;
  is_staff_child: boolean;
  related_staff_user_id: string | null;
  related_staff_role_code: string | null;
  photo_consent: PhotoConsent;
  photo_consent_file_id: string | null;
  health: HealthInput;
  guardians: GuardianInput[];
  confirm_possible_duplicate: boolean;
}

export type ChildChanges = Partial<
  Pick<
    ChildInput,
    | 'full_name'
    | 'dob'
    | 'gender'
    | 'place_of_birth'
    | 'address'
    | 'national_id'
    | 'moet_student_code'
    | 'birth_certificate_file_id'
    | 'special_needs_note'
    | 'note'
  >
> & { health?: Partial<HealthInput>; reason?: string | null };

// Thông tin định danh của trẻ đang học chỉ quản lý đơn vị sửa được, kèm lý do (QT-01 E7)
const IDENTITY_FIELDS = [
  'full_name',
  'dob',
  'gender',
  'place_of_birth',
  'address',
  'national_id',
  'birth_certificate_file_id',
] as const;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const PAGE_SIZE_LIMIT = 100;

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

@Injectable()
export class ChildrenService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly childScope: ChildScope,
    private readonly protection: ChildDataProtection,
    private readonly identityClient: IdentityClient,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  async list(
    currentUser: CurrentUser,
    filter: {
      orgUnitId?: string;
      classId?: string;
      status?: ChildStatus;
      q?: string;
      missingBirthCertificate?: boolean;
      page: number;
      pageSize: number;
    },
  ) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { items: [], page: filter.page, page_size: filter.pageSize, total: 0, total_pages: 1 };
    }
    const database = current.database;
    const scope = await this.childScope.resolve(currentUser, database);
    let selection = database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .where(this.childScope.filter(scope));
    if (filter.orgUnitId) {
      selection = selection.where('children.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.classId) {
      selection = selection.where('class_enrollments.class_id', '=', filter.classId);
    }
    if (filter.status) {
      selection = selection.where('children.status', '=', filter.status);
    }
    if (filter.missingBirthCertificate) {
      selection = selection.where('children.birth_certificate_file_id', 'is', null);
    }
    if (filter.q) {
      selection = selection.where('children.full_name', 'ilike', `%${filter.q.replace(/[%_\\]/g, '\\$&')}%`);
    }
    const counted = await selection
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    const total = Number(counted.count);
    const rows = await selection
      .select([
        'children.id',
        'children.org_unit_id',
        'children.full_name',
        'children.dob',
        'children.gender',
        'children.status',
        'children.national_id_last4',
        'children.moet_student_code',
        'children.photo_consent',
        'classes.id as class_id',
        'classes.name as class_name',
      ])
      .orderBy('children.full_name')
      .limit(Math.min(filter.pageSize, PAGE_SIZE_LIMIT))
      .offset((filter.page - 1) * filter.pageSize)
      .execute();
    const items = rows.map(({ national_id_last4: lastFour, ...row }) => ({
      ...row,
      national_id_masked: maskNationalId(lastFour),
    }));
    return {
      items,
      page: filter.page,
      page_size: filter.pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / filter.pageSize)),
    };
  }

  // Trùng họ tên và ngày sinh trong đơn vị chỉ cảnh báo, người dùng xác nhận thì vẫn lưu (QT-01 bước 2, E4)
  async findPossibleDuplicates(
    currentUser: CurrentUser,
    input: { orgUnitId: string; fullName: string; dob: string; exceptId?: string },
  ): Promise<Array<{ id: string; full_name: string; dob: string; status: ChildStatus }>> {
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childManage, input.orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    return this.possibleDuplicates(database, input);
  }

  private async possibleDuplicates(
    database: Executor,
    input: { orgUnitId: string; fullName: string; dob: string; exceptId?: string },
  ) {
    let query = database
      .selectFrom('children')
      .select(['id', 'full_name', 'dob', 'status'])
      .where('org_unit_id', '=', input.orgUnitId)
      .where('dob', '=', input.dob)
      .where(sql<string>`lower(regexp_replace(trim(full_name), '\\s+', ' ', 'g'))`, '=', normalizeName(input.fullName));
    if (input.exceptId) {
      query = query.where('id', '!=', input.exceptId);
    }
    return query.execute();
  }

  async create(currentUser: CurrentUser, accessToken: string, input: ChildInput, origin: ChangeOrigin) {
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childManage, input.org_unit_id);
    const { database } = await this.currentSchoolYear.require();
    const unit = await database
      .selectFrom('org_units')
      .select('status')
      .where('id', '=', input.org_unit_id)
      .executeTakeFirst();
    if (!unit || unit.status !== 'active') {
      throw validationError([{ field: 'org_unit_id', message: 'Đơn vị không có hoặc đã ngừng sử dụng' }]);
    }
    const nationalIdHash = this.protection.hash(input.national_id);
    await this.assertUniqueIdentifiers(database, nationalIdHash, input.moet_student_code, null);
    if (!input.confirm_possible_duplicate) {
      const duplicates = await this.possibleDuplicates(database, {
        orgUnitId: input.org_unit_id,
        fullName: input.full_name,
        dob: input.dob,
      });
      if (duplicates.length > 0) {
        throw ruleViolationError(
          'QT-01',
          'Đã có hồ sơ trùng họ tên và ngày sinh, kiểm tra trước khi tiếp tục',
          duplicates.map((duplicate) => ({ field: 'possible_duplicates', message: duplicate.id })),
        );
      }
    }
    await this.assertFile(database, input.birth_certificate_file_id, 'birth_certificate', input.org_unit_id, null);
    if (input.photo_consent === 'granted') {
      if (!input.photo_consent_file_id) {
        throw validationError([
          { field: 'photo_consent_file_id', message: 'Đồng ý bằng giấy ký tay cần tải bản chụp giấy đồng ý' },
        ]);
      }
      await this.assertFile(database, input.photo_consent_file_id, 'photo_consent', input.org_unit_id, null);
    }
    const relatedStaffName = await this.relatedStaffName(accessToken, input);
    await this.assertGuardians(database, input.guardians);

    const now = this.clock.now();
    return database.transaction().execute(async (transaction) => {
      const child = await transaction
        .insertInto('children')
        .values({
          org_unit_id: input.org_unit_id,
          full_name: input.full_name,
          dob: input.dob,
          gender: input.gender,
          place_of_birth: input.place_of_birth,
          address: input.address,
          national_id_encrypted: this.protection.encrypt(input.national_id),
          national_id_hash: nationalIdHash,
          national_id_last4: input.national_id.slice(-4),
          moet_student_code: input.moet_student_code,
          birth_certificate_file_id: input.birth_certificate_file_id,
          is_staff_child: input.is_staff_child,
          related_staff_user_id: input.is_staff_child ? input.related_staff_user_id : null,
          related_staff_name: input.is_staff_child ? relatedStaffName : null,
          special_needs_note: input.special_needs_note,
          note: input.note,
          photo_consent: input.photo_consent,
          photo_consent_method: input.photo_consent === 'granted' ? 'paper' : null,
          photo_consent_by: origin.actorUserId,
          photo_consent_at: now,
          photo_consent_file_id: input.photo_consent === 'granted' ? input.photo_consent_file_id : null,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto('health_profiles')
        .values({ child_id: child.id, ...input.health, created_by: origin.actorUserId })
        .execute();
      await transaction
        .insertInto('photo_consent_histories')
        .values({
          child_id: child.id,
          action: input.photo_consent,
          method: input.photo_consent === 'granted' ? 'paper' : null,
          file_id: input.photo_consent === 'granted' ? input.photo_consent_file_id : null,
          actor_user_id: origin.actorUserId,
        })
        .execute();
      const primaryIndex = Math.max(
        0,
        input.guardians.findIndex((guardian) => guardian.is_primary),
      );
      for (const [index, guardian] of input.guardians.entries()) {
        await this.attachGuardian(transaction, child.id, { ...guardian, is_primary: index === primaryIndex }, origin);
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'children',
        entityId: child.id,
        action: 'create',
        before: null,
        after: this.auditView(input),
      });
      return this.detail(transaction, currentUser, child.id);
    });
  }

  async get(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.findChild(database, childId);
    await this.childScope.assertCanRead(currentUser, database, childId);
    return this.detail(database, currentUser, childId);
  }

  async update(currentUser: CurrentUser, childId: string, changes: ChildChanges, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    if (child.status === 'pending') {
      throw ruleViolationError('QT-01', 'Hồ sơ đang chờ duyệt; cần được từ chối về nháp trước khi sửa');
    }
    // Bổ sung giấy khai sinh còn thiếu của trẻ nhập từ Excel không cần lý do (YCTD-46)
    const changesIdentity = IDENTITY_FIELDS.some(
      (field) =>
        changes[field] !== undefined &&
        !(field === 'birth_certificate_file_id' && child.birth_certificate_file_id === null),
    );
    if (child.status === 'draft') {
      await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childManage, child.org_unit_id);
    } else {
      if (!currentUser.hasPermission(PERMISSION_CODES.childApprove)) {
        throw new ApplicationError(
          'ERR_FORBIDDEN',
          'Không sửa được thông tin của trẻ đang học, cần quản lý đơn vị thực hiện',
        );
      }
      await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childApprove, child.org_unit_id);
      if (changesIdentity && !changes.reason) {
        throw validationError([
          { field: 'reason', message: 'Sửa thông tin định danh của trẻ đang học cần nhập lý do' },
        ]);
      }
    }
    const nationalIdHash = changes.national_id ? this.protection.hash(changes.national_id) : undefined;
    await this.assertUniqueIdentifiers(database, nationalIdHash ?? null, changes.moet_student_code ?? null, childId);
    if (changes.birth_certificate_file_id && changes.birth_certificate_file_id !== child.birth_certificate_file_id) {
      await this.assertFile(
        database,
        changes.birth_certificate_file_id,
        'birth_certificate',
        child.org_unit_id,
        childId,
      );
    }
    const before = await this.detail(database, currentUser, childId);
    return database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('children')
        .set({
          full_name: changes.full_name,
          dob: changes.dob,
          gender: changes.gender,
          place_of_birth: changes.place_of_birth,
          address: changes.address,
          moet_student_code: changes.moet_student_code,
          birth_certificate_file_id: changes.birth_certificate_file_id,
          special_needs_note: changes.special_needs_note,
          note: changes.note,
          ...(changes.national_id
            ? {
                national_id_encrypted: this.protection.encrypt(changes.national_id),
                national_id_hash: nationalIdHash,
                national_id_last4: changes.national_id.slice(-4),
              }
            : {}),
          updated_at: this.clock.now(),
        })
        .where('id', '=', childId)
        .execute();
      if (changes.health) {
        await transaction
          .updateTable('health_profiles')
          .set({ ...changes.health, updated_at: this.clock.now() })
          .where('child_id', '=', childId)
          .execute();
      }
      const after = await this.detail(transaction, currentUser, childId);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'children',
        entityId: childId,
        action: 'update',
        before: { ...before, guardians: undefined, enrollments: undefined },
        after: {
          ...after,
          guardians: undefined,
          enrollments: undefined,
          ...(changes.national_id ? { national_id_changed: true } : {}),
          reason: changes.reason ?? null,
        },
      });
      return after;
    });
  }

  // Gửi trình duyệt: hồ sơ phải khai báo dị ứng và có ít nhất một liên hệ có số điện thoại (BR-06)
  async submit(currentUser: CurrentUser, accessToken: string, childId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childManage, child.org_unit_id);
    if (child.status !== 'draft') {
      throw ruleViolationError('QT-01', 'Chỉ gửi trình duyệt được hồ sơ ở trạng thái nháp');
    }
    const errors: FieldError[] = [];
    const health = await database
      .selectFrom('health_profiles')
      .select('has_allergies')
      .where('child_id', '=', childId)
      .executeTakeFirst();
    if (health?.has_allergies === null || health?.has_allergies === undefined) {
      errors.push({ field: 'health.has_allergies', message: 'Cần khai báo dị ứng hoặc chọn không có dị ứng' });
    }
    const contact = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.id')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.phone', 'is not', null)
      .executeTakeFirst();
    if (!contact) {
      errors.push({ field: 'guardians', message: 'Cần ít nhất một người liên hệ có số điện thoại' });
    }
    if (errors.length > 0) {
      throw ruleViolationError('BR-06', 'Hồ sơ chưa đủ điều kiện gửi trình duyệt', errors);
    }
    const managers = await this.identityClient.listStaff(accessToken, 'VT-03', child.org_unit_id).catch(() => []);
    return database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('children')
        .set({
          status: 'pending',
          submitted_by: origin.actorUserId,
          submitted_at: this.clock.now(),
          reject_reason: null,
          updated_at: this.clock.now(),
        })
        .where('id', '=', childId)
        .execute();
      await this.writeStatusLog(transaction, origin, child, 'pending', null);
      await queueNotification(transaction, {
        orgUnitId: child.org_unit_id,
        templateCode: 'child_submitted',
        title: 'Có hồ sơ trẻ mới chờ duyệt',
        body: `Hồ sơ của ${child.full_name} đang chờ duyệt`,
        targetType: 'children',
        targetId: childId,
        recipients: managers.map((manager) => ({ userId: manager.user_id, channel: 'in_app' as const })),
      });
      return this.detail(transaction, currentUser, childId);
    });
  }

  // Duyệt và phân lớp; tạo tài khoản cho mọi phụ huynh có số điện thoại (QT-01 bước 8, 9)
  async approve(
    currentUser: CurrentUser,
    accessToken: string,
    childId: string,
    input: { classId: string; confirmOverCapacity: boolean },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childApprove, child.org_unit_id);
    if (child.status !== 'pending') {
      throw ruleViolationError('QT-01', 'Chỉ duyệt được hồ sơ đang chờ duyệt');
    }
    const targetClass = await this.findActiveClass(database, input.classId);
    // Lớp ở đơn vị khác thì người duyệt cũng phải có quyền ở đơn vị đó; đơn vị của trẻ là đơn vị của lớp (BR-03, QĐ-14)
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childApprove, targetClass.org_unit_id);
    await this.assertCapacity(database, targetClass, input.confirmOverCapacity);

    const guardians = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select(['guardians.id', 'guardians.full_name', 'guardians.phone', 'guardians.user_id'])
      .where('child_guardians.child_id', '=', childId)
      .execute();
    const accounts: Array<{ guardianId: string; userId: string; created: boolean }> = [];
    for (const guardian of guardians) {
      if (!guardian.phone) {
        continue;
      }
      const account = await this.identityClient.ensureGuardianAccount(accessToken, {
        phone: guardian.phone,
        full_name: guardian.full_name,
        org_unit_id: targetClass.org_unit_id,
      });
      accounts.push({ guardianId: guardian.id, userId: account.user_id, created: account.created });
    }
    const homeroomTeachers = await database
      .selectFrom('class_staff_assignments')
      .select('staff_user_id')
      .where('class_id', '=', targetClass.id)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .execute();
    const accountants = await this.identityClient
      .listStaff(accessToken, 'VT-04', targetClass.org_unit_id)
      .catch(() => []);
    const today = this.today();

    return database.transaction().execute(async (transaction) => {
      for (const account of accounts) {
        await transaction
          .updateTable('guardians')
          .set({ user_id: account.userId, updated_at: this.clock.now() })
          .where('id', '=', account.guardianId)
          .execute();
      }
      await transaction
        .updateTable('children')
        .set({
          status: 'active',
          org_unit_id: targetClass.org_unit_id,
          enroll_date: today,
          approved_by: origin.actorUserId,
          approved_at: this.clock.now(),
          reject_reason: null,
          updated_at: this.clock.now(),
        })
        .where('id', '=', childId)
        .execute();
      await transaction
        .insertInto('class_enrollments')
        .values({
          child_id: childId,
          class_id: targetClass.id,
          from_date: today,
          reason: 'Tiếp nhận trẻ mới',
          created_by: origin.actorUserId,
        })
        .execute();
      await this.writeStatusLog(transaction, origin, child, 'active', null, {
        class_id: targetClass.id,
        org_unit_id: targetClass.org_unit_id,
      });
      await queueNotification(transaction, {
        orgUnitId: targetClass.org_unit_id,
        templateCode: 'child_approved',
        title: 'Trẻ đã được tiếp nhận vào lớp',
        body: `${child.full_name} đã được tiếp nhận vào lớp ${targetClass.name}`,
        targetType: 'children',
        targetId: childId,
        recipients: [
          ...homeroomTeachers.map((teacher) => ({ userId: teacher.staff_user_id, channel: 'in_app' as const })),
          ...accountants.map((accountant) => ({ userId: accountant.user_id, channel: 'in_app' as const })),
          ...(child.submitted_by ? [{ userId: child.submitted_by, channel: 'in_app' as const }] : []),
        ],
      });
      // Tin nhắn báo tài khoản đã tạo, không gửi mật khẩu (QT-01 mục 9, BM-69)
      await queueNotification(transaction, {
        orgUnitId: targetClass.org_unit_id,
        templateCode: 'guardian_account_created',
        title: 'Tài khoản phụ huynh đã được tạo',
        body: 'Tài khoản ứng dụng phụ huynh đã được tạo, đăng nhập bằng mật khẩu mặc định nhà trường cung cấp',
        targetType: 'children',
        targetId: childId,
        recipients: accounts
          .filter((account) => account.created)
          .map((account) => ({ userId: account.userId, channel: 'sms' as const })),
      });
      return this.detail(transaction, currentUser, childId);
    });
  }

  async reject(currentUser: CurrentUser, childId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childApprove, child.org_unit_id);
    if (child.status !== 'pending') {
      throw ruleViolationError('QT-01', 'Chỉ từ chối được hồ sơ đang chờ duyệt');
    }
    return database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('children')
        .set({ status: 'draft', reject_reason: reason, updated_at: this.clock.now() })
        .where('id', '=', childId)
        .execute();
      await this.writeStatusLog(transaction, origin, child, 'draft', reason);
      await queueNotification(transaction, {
        orgUnitId: child.org_unit_id,
        templateCode: 'child_rejected',
        title: 'Hồ sơ trẻ bị từ chối',
        body: `Hồ sơ của ${child.full_name} bị từ chối: ${reason}`,
        targetType: 'children',
        targetId: childId,
        recipients: child.submitted_by ? [{ userId: child.submitted_by, channel: 'in_app' }] : [],
      });
      return this.detail(transaction, currentUser, childId);
    });
  }

  // Xem đầy đủ số định danh: chỉ vai trò được phép, mỗi lần xem ghi nhật ký truy cập (BR-81, BM-64)
  async nationalId(currentUser: CurrentUser, childId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.nationalIdView, child.org_unit_id);
    const row = await database
      .selectFrom('children')
      .select('national_id_encrypted')
      .where('id', '=', childId)
      .executeTakeFirstOrThrow();
    await writeDataAccessLog(database, {
      origin,
      orgUnitId: child.org_unit_id,
      entityName: 'children',
      entityId: childId,
      scope: 'national_id',
    });
    return { national_id: this.protection.decrypt(row.national_id_encrypted) };
  }

  async addGuardian(currentUser: CurrentUser, childId: string, guardian: GuardianInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    await this.assertCanEditGuardians(currentUser, child);
    await this.assertGuardians(database, [guardian]);
    return database.transaction().execute(async (transaction) => {
      if (guardian.is_primary) {
        await transaction
          .updateTable('child_guardians')
          .set({ is_primary: false })
          .where('child_id', '=', childId)
          .execute();
      }
      await this.attachGuardian(transaction, childId, guardian, origin);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'child_guardians',
        entityId: childId,
        action: 'create',
        before: null,
        after: { ...guardian, child_id: childId },
      });
      return this.detail(transaction, currentUser, childId);
    });
  }

  // Mỗi trẻ đúng một phụ huynh liên hệ chính (P02-03)
  async setPrimaryGuardian(currentUser: CurrentUser, childId: string, guardianId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    await this.assertCanEditGuardians(currentUser, child);
    const link = await database
      .selectFrom('child_guardians')
      .select(['id', 'is_primary'])
      .where('child_id', '=', childId)
      .where('guardian_id', '=', guardianId)
      .executeTakeFirst();
    if (!link) {
      throw notFoundError('Phụ huynh không gắn với trẻ này', 'child_guardian');
    }
    return database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('child_guardians')
        .set({ is_primary: false })
        .where('child_id', '=', childId)
        .execute();
      await transaction.updateTable('child_guardians').set({ is_primary: true }).where('id', '=', link.id).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'child_guardians',
        entityId: link.id,
        action: 'update',
        before: { is_primary: link.is_primary },
        after: { is_primary: true },
      });
      return this.detail(transaction, currentUser, childId);
    });
  }

  // Chuyển lớp trong cùng đơn vị; dòng lịch sử cũ giữ nguyên, thêm dòng mới (P02-06, BR-03, AC-09)
  async transferClass(
    currentUser: CurrentUser,
    childId: string,
    input: { classId: string; fromDate: string | null; reason: string; confirmOverCapacity: boolean },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.findChild(database, childId);
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childApprove, child.org_unit_id);
    if (child.status !== 'active') {
      throw ruleViolationError('BR-03', 'Chỉ chuyển lớp được trẻ đang học');
    }
    const current = await database
      .selectFrom('class_enrollments')
      .select(['id', 'class_id', 'from_date'])
      .where('child_id', '=', childId)
      .where('is_current', '=', true)
      .executeTakeFirst();
    const targetClass = await this.findActiveClass(database, input.classId);
    if (current?.class_id === targetClass.id) {
      throw validationError([{ field: 'class_id', message: 'Trẻ đang học lớp này' }]);
    }
    if (targetClass.org_unit_id !== child.org_unit_id) {
      throw ruleViolationError('LP-02', 'Lớp đích thuộc đơn vị khác; dùng chức năng chuyển đơn vị (P02-07)');
    }
    const fromDate = input.fromDate ?? this.today();
    if (current && fromDate < current.from_date) {
      throw validationError([{ field: 'from_date', message: 'Ngày hiệu lực không trước ngày vào lớp hiện tại' }]);
    }
    await this.assertCapacity(database, targetClass, input.confirmOverCapacity);
    return database.transaction().execute(async (transaction) => {
      if (current) {
        await transaction
          .updateTable('class_enrollments')
          .set({ is_current: false, to_date: fromDate, updated_at: this.clock.now() })
          .where('id', '=', current.id)
          .execute();
      }
      const created = await transaction
        .insertInto('class_enrollments')
        .values({
          child_id: childId,
          class_id: targetClass.id,
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
        before: current ? { class_id: current.class_id } : null,
        after: { child_id: childId, class_id: targetClass.id, from_date: fromDate, reason: input.reason },
      });
      return this.detail(transaction, currentUser, childId);
    });
  }

  // Danh sách trẻ của lớp: vai trò văn phòng trong đơn vị, hoặc giáo viên được phân công lớp đó (P02-10, BR-72)
  async classChildren(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRecord = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRecord) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    const scope = await this.childScope.resolve(currentUser, database);
    const allowed =
      scope.wholeSchool || scope.unitIds.includes(classRecord.org_unit_id) || scope.classIds.includes(classId);
    if (!allowed) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Lớp này nằm ngoài phạm vi của bạn');
    }
    return database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select(['children.id', 'children.full_name', 'children.dob', 'children.gender', 'children.status'])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .orderBy('children.full_name')
      .execute();
  }

  private async detail(database: Executor, currentUser: CurrentUser, childId: string) {
    const child = await database
      .selectFrom('children')
      .select([
        'id',
        'org_unit_id',
        'full_name',
        'dob',
        'gender',
        'place_of_birth',
        'address',
        'national_id_last4',
        'moet_student_code',
        'birth_certificate_file_id',
        'status',
        'is_staff_child',
        'related_staff_user_id',
        'related_staff_name',
        'special_needs_note',
        'photo_consent',
        'photo_consent_method',
        'photo_consent_file_id',
        'enroll_date',
        'note',
        'reject_reason',
        'submitted_at',
        'approved_at',
      ])
      .where('id', '=', childId)
      .executeTakeFirstOrThrow();
    const guardians = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .innerJoin('catalog_items', 'catalog_items.id', 'child_guardians.relationship_item_id')
      .select([
        'guardians.id',
        'guardians.full_name',
        'guardians.phone',
        'guardians.occupation',
        'guardians.user_id',
        'child_guardians.is_primary',
        'child_guardians.relationship_item_id',
        'catalog_items.name as relationship',
      ])
      .where('child_guardians.child_id', '=', childId)
      .orderBy('child_guardians.is_primary', 'desc')
      .orderBy('guardians.full_name')
      .execute();
    const enrollments = await database
      .selectFrom('class_enrollments')
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'class_enrollments.id',
        'class_enrollments.class_id',
        'classes.name as class_name',
        'class_enrollments.from_date',
        'class_enrollments.to_date',
        'class_enrollments.reason',
        'class_enrollments.is_current',
      ])
      .where('class_enrollments.child_id', '=', childId)
      .orderBy('class_enrollments.from_date', 'desc')
      .execute();
    // Dữ liệu sức khỏe theo BR-53; người lập hồ sơ xem được khi hồ sơ còn nháp hoặc chờ duyệt
    const canSeeHealth =
      this.childScope.canSeeHealth(currentUser) ||
      ((child.status === 'draft' || child.status === 'pending') &&
        currentUser.hasPermission(PERMISSION_CODES.childManage));
    const health = canSeeHealth
      ? ((await database
          .selectFrom('health_profiles')
          .select(['has_allergies', 'allergies', 'chronic_conditions', 'blood_type', 'note'])
          .where('child_id', '=', childId)
          .executeTakeFirst()) ?? null)
      : null;
    const { national_id_last4: lastFour, special_needs_note: specialNeeds, ...rest } = child;
    return {
      ...rest,
      national_id_masked: maskNationalId(lastFour),
      special_needs_note: canSeeHealth ? specialNeeds : null,
      health,
      guardians: guardians.map(({ user_id: userId, ...guardian }) => ({ ...guardian, has_account: userId !== null })),
      enrollments,
      current_class: enrollments.find((enrollment) => enrollment.is_current) ?? null,
    };
  }

  private async findChild(database: Executor, childId: string) {
    const child = await database
      .selectFrom('children')
      .select(['id', 'org_unit_id', 'status', 'full_name', 'birth_certificate_file_id', 'submitted_by'])
      .where('id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Hồ sơ không tồn tại hoặc đã bị xóa khỏi phạm vi của bạn', 'child');
    }
    return child;
  }

  private async findActiveClass(database: Executor, classId: string) {
    const classRecord = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'name', 'max_size', 'status'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRecord || classRecord.status !== 'active') {
      throw validationError([{ field: 'class_id', message: 'Lớp không có hoặc đã đóng' }]);
    }
    return classRecord;
  }

  // Vượt sĩ số tối đa thì cảnh báo, quản lý đơn vị xác nhận thì vẫn phân lớp (BR-04, AC-10)
  private async assertCapacity(
    database: Executor,
    classRecord: { id: string; max_size: number },
    confirmed: boolean,
  ): Promise<void> {
    const enrolled = await database
      .selectFrom('class_enrollments')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('class_id', '=', classRecord.id)
      .where('is_current', '=', true)
      .executeTakeFirstOrThrow();
    if (Number(enrolled.count) >= classRecord.max_size && !confirmed) {
      throw ruleViolationError('BR-04', 'Lớp đã đủ sĩ số, xác nhận để tiếp tục', [
        { field: 'enrolled_count', message: enrolled.count },
        { field: 'max_size', message: String(classRecord.max_size) },
      ]);
    }
  }

  private async assertUniqueIdentifiers(
    database: Executor,
    nationalIdHash: string | null,
    moetStudentCode: string | null,
    exceptId: string | null,
  ): Promise<void> {
    if (nationalIdHash) {
      let query = database.selectFrom('children').select('id').where('national_id_hash', '=', nationalIdHash);
      if (exceptId) {
        query = query.where('id', '!=', exceptId);
      }
      const duplicate = await query.executeTakeFirst();
      if (duplicate) {
        throw new ApplicationError('ERR_CONFLICT', 'Số định danh cá nhân đã có trong hồ sơ khác', [
          { field: 'national_id', message: duplicate.id },
        ]);
      }
    }
    if (moetStudentCode) {
      let query = database.selectFrom('children').select('id').where('moet_student_code', '=', moetStudentCode);
      if (exceptId) {
        query = query.where('id', '!=', exceptId);
      }
      const duplicate = await query.executeTakeFirst();
      if (duplicate) {
        throw new ApplicationError('ERR_CONFLICT', 'Mã định danh ngành đã gán cho trẻ khác', [
          { field: 'moet_student_code', message: duplicate.id },
        ]);
      }
    }
  }

  private async assertFile(
    database: Executor,
    fileId: string,
    purpose: 'birth_certificate' | 'photo_consent',
    orgUnitId: string,
    exceptChildId: string | null,
  ): Promise<void> {
    const file = await database
      .selectFrom('files')
      .select(['purpose', 'org_unit_id'])
      .where('id', '=', fileId)
      .executeTakeFirst();
    const field = purpose === 'birth_certificate' ? 'birth_certificate_file_id' : 'photo_consent_file_id';
    if (!file || file.purpose !== purpose || file.org_unit_id !== orgUnitId) {
      throw validationError([{ field, message: 'Tệp không có hoặc không đúng loại' }]);
    }
    let usage = database
      .selectFrom('children')
      .select('id')
      .where((expression) =>
        expression.or([
          expression('birth_certificate_file_id', '=', fileId),
          expression('photo_consent_file_id', '=', fileId),
        ]),
      );
    if (exceptChildId) {
      usage = usage.where('id', '!=', exceptChildId);
    }
    if (await usage.executeTakeFirst()) {
      throw validationError([{ field, message: 'Tệp đã thuộc hồ sơ khác' }]);
    }
  }

  private async relatedStaffName(accessToken: string, input: ChildInput): Promise<string | null> {
    if (!input.is_staff_child) {
      return null;
    }
    if (!input.related_staff_user_id || !input.related_staff_role_code) {
      throw validationError([
        { field: 'related_staff_user_id', message: 'Trẻ con nhân viên cần chọn nhân sự liên quan' },
      ]);
    }
    const staff = (
      await this.identityClient.listStaff(accessToken, input.related_staff_role_code, input.org_unit_id)
    ).find((entry) => entry.user_id === input.related_staff_user_id);
    if (!staff) {
      throw validationError([{ field: 'related_staff_user_id', message: 'Không tìm thấy nhân sự ở đơn vị này' }]);
    }
    return staff.full_name;
  }

  private async assertGuardians(database: Executor, guardians: GuardianInput[]): Promise<void> {
    const errors: FieldError[] = [];
    const relationshipIds = [...new Set(guardians.map((guardian) => guardian.relationship_item_id))];
    const relationships = relationshipIds.length
      ? await database
          .selectFrom('catalog_items')
          .select('id')
          .where('id', 'in', relationshipIds)
          .where('catalog_type', '=', 'parent_relationship')
          .where('status', '=', 'active')
          .execute()
      : [];
    guardians.forEach((guardian, index) => {
      if (!relationships.some((relationship) => relationship.id === guardian.relationship_item_id)) {
        errors.push({ field: `guardians.${index}.relationship_item_id`, message: 'Quan hệ không có trong danh mục' });
      }
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
  }

  // Số điện thoại đã thuộc một phụ huynh có sẵn thì gắn phụ huynh đó, không tạo mới (BR-08, QT-01 E5)
  private async attachGuardian(
    transaction: Transaction<SchoolYearDatabase>,
    childId: string,
    guardian: GuardianInput,
    origin: ChangeOrigin,
  ): Promise<void> {
    const existing = guardian.phone
      ? await transaction.selectFrom('guardians').select('id').where('phone', '=', guardian.phone).executeTakeFirst()
      : undefined;
    const guardianId =
      existing?.id ??
      (
        await transaction
          .insertInto('guardians')
          .values({
            full_name: guardian.full_name,
            phone: guardian.phone,
            occupation: guardian.occupation,
            email: guardian.email,
            address: guardian.address,
            created_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    const linked = await transaction
      .selectFrom('child_guardians')
      .select('id')
      .where('child_id', '=', childId)
      .where('guardian_id', '=', guardianId)
      .executeTakeFirst();
    if (linked) {
      throw validationError([{ field: 'guardians', message: 'Phụ huynh này đã gắn với trẻ' }]);
    }
    await transaction
      .insertInto('child_guardians')
      .values({
        child_id: childId,
        guardian_id: guardianId,
        relationship_item_id: guardian.relationship_item_id,
        is_primary: guardian.is_primary,
        created_by: origin.actorUserId,
      })
      .execute();
  }

  private async assertCanEditGuardians(
    currentUser: CurrentUser,
    child: { org_unit_id: string; status: ChildStatus },
  ): Promise<void> {
    if (child.status === 'draft') {
      await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childManage, child.org_unit_id);
      return;
    }
    if (child.status === 'pending') {
      throw ruleViolationError('QT-01', 'Hồ sơ đang chờ duyệt; cần được từ chối về nháp trước khi sửa');
    }
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childApprove, child.org_unit_id);
  }

  private async writeStatusLog(
    transaction: Transaction<SchoolYearDatabase>,
    origin: ChangeOrigin,
    child: { id: string; org_unit_id: string; status: ChildStatus },
    status: ChildStatus,
    reason: string | null,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await writeAuditLog(transaction, {
      origin,
      orgUnitId: child.org_unit_id,
      entityName: 'children',
      entityId: child.id,
      action: 'update',
      before: { status: child.status },
      after: { status, ...(reason ? { reject_reason: reason } : {}), ...extra },
    });
  }

  // Nhật ký thao tác không chứa số định danh ở dạng rõ (BM-64)
  private auditView(input: ChildInput) {
    const { national_id: nationalId, ...rest } = input;
    return { ...rest, confirm_possible_duplicate: undefined, national_id_masked: maskNationalId(nationalId.slice(-4)) };
  }
}
