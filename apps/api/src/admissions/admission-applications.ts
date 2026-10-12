import { Body, Controller, Get, HttpCode, Injectable, Logger, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { AdmissionApplicationStatus, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  readBearerToken,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { sql, type Kysely, type Transaction } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { ChildrenService } from '../children/children.service.js';
import { ClassCapacity } from '../classes/class-capacity.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection, maskNationalId } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { isUuid, notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { ADMISSION_PERMISSIONS, AdmissionAccess } from './admission-access.js';
import { readAllergyFlag, readApplication, readNationalId, readText, type ApplicationInput } from './admission-fields.js';

// Hồ sơ tuyển sinh, xét duyệt và chuyển thành hồ sơ trẻ (P16-02, P16-03, P16-04; G3-01; BR-01, BR-06, QT-01; YCTD-86).
// Trạng thái: đã nộp (trực tuyến) -> đã tiếp nhận (nhân viên tuyển sinh kiểm tra đủ điều kiện BR-06) -> đạt hoặc không
// đạt (quản lý đơn vị xét, không đạt kèm lý do; số hồ sơ đạt không vượt chỉ tiêu) -> đã chuyển thành hồ sơ trẻ. Chuyển
// thành hồ sơ trẻ dùng lại đúng luồng QT-01 của hồ sơ trẻ: tạo hồ sơ nháp, gửi trình duyệt, người có quyền duyệt ở đơn vị
// của lớp thì duyệt và phân lớp ngay (trẻ đang học, tài khoản phụ huynh VT-14 theo số điện thoại); không có quyền duyệt
// thì hồ sơ trẻ chờ quản lý đơn vị duyệt như hồ sơ trẻ thường
export const APPLICATION_DOCUMENT_TYPE = 'admission_application';
export const APPLICATION_CODE_PREFIX = 'TS';
const STATUSES: AdmissionApplicationStatus[] = ['submitted', 'received', 'passed', 'rejected', 'converted'];
const EDITABLE: AdmissionApplicationStatus[] = ['submitted', 'received'];
const PAGE_LIMIT = 500;

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export function normalizeChildName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

export interface ConvertInput {
  class_id: string;
  national_id: string | null;
  birth_certificate_file_id: string;
  relationship_item_id: string | null;
  has_allergies: boolean | null;
  confirm_possible_duplicate: boolean;
  confirm_over_capacity: boolean;
}

@Injectable()
export class AdmissionApplicationsService {
  private readonly logger = new Logger(AdmissionApplicationsService.name);

  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: AdmissionAccess,
    private readonly organizationScopes: OrganizationScopes,
    private readonly children: ChildrenService,
    private readonly capacity: ClassCapacity,
    private readonly protection: ChildDataProtection,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  async list(
    currentUser: CurrentUser,
    filter: { campaignId: string | null; status: AdmissionApplicationStatus | null; q: string | null },
  ) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    const scope = await this.access.viewScope(currentUser);
    let query = current.database
      .selectFrom('admission_applications')
      .innerJoin('admission_campaigns', 'admission_campaigns.id', 'admission_applications.campaign_id')
      .leftJoin('children', 'children.id', 'admission_applications.created_child_id')
      .select([
        'admission_applications.id',
        'admission_applications.code',
        'admission_applications.campaign_id',
        'admission_campaigns.name as campaign_name',
        'admission_applications.org_unit_id',
        'admission_applications.source',
        'admission_applications.child_full_name',
        'admission_applications.child_dob',
        'admission_applications.child_gender',
        'admission_applications.guardian_full_name',
        'admission_applications.guardian_phone',
        'admission_applications.status',
        'admission_applications.reject_reason',
        'admission_applications.created_child_id',
        'children.status as child_status',
        'admission_applications.created_at',
      ])
      .orderBy('admission_applications.created_at', 'desc')
      .limit(PAGE_LIMIT);
    if (!scope.wholeSchool) {
      query = query.where('admission_applications.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.campaignId) {
      query = query.where('admission_applications.campaign_id', '=', filter.campaignId);
    }
    if (filter.status) {
      query = query.where('admission_applications.status', '=', filter.status);
    }
    if (filter.q) {
      const pattern = `%${filter.q.replace(/[%_\\]/g, '\\$&')}%`;
      query = query.where((expression) =>
        expression.or([
          expression('admission_applications.child_full_name', 'ilike', pattern),
          expression('admission_applications.code', 'ilike', pattern),
          expression('admission_applications.guardian_phone', 'like', pattern),
        ]),
      );
    }
    return query.execute();
  }

  async get(currentUser: CurrentUser, applicationId: string) {
    const { database } = await this.currentSchoolYear.require();
    const application = await this.find(database, applicationId);
    await this.access.assertCanView(currentUser, application.org_unit_id);
    return this.detail(database, applicationId);
  }

  // Nộp hồ sơ: trực tuyến không cần tài khoản (người nộp là phụ huynh) hoặc nhân viên tuyển sinh nhập hộ (đã tiếp nhận)
  async submit(
    input: ApplicationInput,
    origin: { source: 'online'; ip: string | null } | { source: 'staff'; currentUser: CurrentUser; change: ChangeOrigin },
  ) {
    const { database } = await this.currentSchoolYear.require();
    const campaign = await this.access.findCampaign(database, input.campaign_id);
    if (origin.source === 'staff') {
      await this.access.assertCan(
        origin.currentUser,
        PERMISSION_CODES.admissionApplicationManage,
        campaign.org_unit_id,
      );
    }
    const today = this.today();
    if (campaign.status !== 'open' || today < campaign.open_from || today > campaign.open_to) {
      throw ruleViolationError('P16-02', 'Đợt tuyển sinh không trong thời gian nhận hồ sơ');
    }
    if (origin.source === 'staff' && input.child_has_allergies === null) {
      throw ruleViolationError('BR-06', 'Cần khai báo trẻ có dị ứng hay không', [
        { field: 'child_has_allergies', message: 'Cần khai báo dị ứng hoặc chọn không có dị ứng' },
      ]);
    }
    await this.assertRelationship(database, input.guardian_relationship_item_id);
    // Một trẻ chỉ một hồ sơ còn hiệu lực trong một đợt: trùng số điện thoại, họ tên và ngày sinh
    const duplicate = await database
      .selectFrom('admission_applications')
      .select('code')
      .where('campaign_id', '=', campaign.id)
      .where('guardian_phone', '=', input.guardian_phone)
      .where('child_dob', '=', input.child_dob)
      .where('status', '!=', 'rejected')
      .where(
        sql<string>`lower(regexp_replace(trim(child_full_name), '\\s+', ' ', 'g'))`,
        '=',
        normalizeChildName(input.child_full_name),
      )
      .executeTakeFirst();
    if (duplicate) {
      throw new ApplicationError('ERR_CONFLICT', `Trẻ đã có hồ sơ ${duplicate.code} trong đợt tuyển sinh này`, [
        { field: 'code', message: duplicate.code },
      ]);
    }
    const now = this.clock.now();
    const nationalId = input.child_national_id;
    return database.transaction().execute(async (transaction) => {
      const code = await nextDocumentCode(transaction, APPLICATION_DOCUMENT_TYPE, APPLICATION_CODE_PREFIX);
      const created = await transaction
        .insertInto('admission_applications')
        .values({
          code,
          campaign_id: campaign.id,
          org_unit_id: campaign.org_unit_id,
          source: origin.source,
          child_full_name: input.child_full_name,
          child_dob: input.child_dob,
          child_gender: input.child_gender,
          child_national_id_encrypted: nationalId ? this.protection.encrypt(nationalId) : null,
          child_national_id_hash: nationalId ? this.protection.hash(nationalId) : null,
          child_national_id_last4: nationalId ? nationalId.slice(-4) : null,
          child_has_allergies: input.child_has_allergies,
          child_allergies: input.child_allergies,
          guardian_full_name: input.guardian_full_name,
          guardian_phone: input.guardian_phone,
          guardian_email: input.guardian_email,
          guardian_relationship_item_id: input.guardian_relationship_item_id,
          address: input.address,
          note: input.note,
          status: origin.source === 'staff' ? 'received' : 'submitted',
          received_by: origin.source === 'staff' ? origin.change.actorUserId : null,
          received_at: origin.source === 'staff' ? now : null,
          submitted_ip: origin.source === 'online' ? origin.ip : null,
          created_by: origin.source === 'staff' ? origin.change.actorUserId : null,
        })
        .returning(['id', 'code', 'status'])
        .executeTakeFirstOrThrow();
      const change: ChangeOrigin =
        origin.source === 'staff'
          ? origin.change
          : { actorUserId: PUBLIC_APPLICANT_ID, actorName: 'Phụ huynh nộp trực tuyến', ipAddress: origin.ip };
      await writeAuditLog(transaction, {
        origin: change,
        orgUnitId: campaign.org_unit_id,
        entityName: 'admission_applications',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { ...this.auditView(input), code, status: created.status, source: origin.source },
      });
      // Hồ sơ trực tuyến mới báo nhân viên tuyển sinh của đơn vị; hồ sơ đã tiếp nhận báo quản lý đơn vị để xét
      await queueNotification(transaction, {
        orgUnitId: campaign.org_unit_id,
        templateCode: origin.source === 'online' ? 'admission_application_submitted' : 'admission_application_received',
        title: origin.source === 'online' ? 'Có hồ sơ tuyển sinh trực tuyến mới' : 'Có hồ sơ tuyển sinh chờ xét duyệt',
        body: `Hồ sơ ${code} của ${input.child_full_name} (${campaign.name})`,
        targetType: 'admission_applications',
        targetId: created.id,
        recipients: [
          {
            roleCode: origin.source === 'online' ? 'VT-12' : 'VT-03',
            orgUnitId: campaign.org_unit_id,
            channel: 'in_app',
          },
        ],
      });
      return {
        id: created.id,
        code,
        status: created.status,
        campaign_name: campaign.name,
        child_full_name: input.child_full_name,
      };
    });
  }

  // Sửa thông tin khi hồ sơ chưa xét (bổ sung số định danh, dị ứng, quan hệ)
  async update(currentUser: CurrentUser, applicationId: string, input: ApplicationInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const application = await this.find(database, applicationId);
    await this.access.assertCan(currentUser, PERMISSION_CODES.admissionApplicationManage, application.org_unit_id);
    if (!EDITABLE.includes(application.status)) {
      throw ruleViolationError('P16-02', 'Chỉ sửa được hồ sơ chưa xét duyệt');
    }
    await this.assertRelationship(database, input.guardian_relationship_item_id);
    const nationalId = input.child_national_id;
    return database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('admission_applications')
        .set({
          child_full_name: input.child_full_name,
          child_dob: input.child_dob,
          child_gender: input.child_gender,
          ...(nationalId
            ? {
                child_national_id_encrypted: this.protection.encrypt(nationalId),
                child_national_id_hash: this.protection.hash(nationalId),
                child_national_id_last4: nationalId.slice(-4),
              }
            : {}),
          child_has_allergies: input.child_has_allergies,
          child_allergies: input.child_allergies,
          guardian_full_name: input.guardian_full_name,
          guardian_phone: input.guardian_phone,
          guardian_email: input.guardian_email,
          guardian_relationship_item_id: input.guardian_relationship_item_id,
          address: input.address,
          note: input.note,
          updated_at: this.clock.now(),
        })
        .where('id', '=', applicationId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: application.org_unit_id,
        entityName: 'admission_applications',
        entityId: applicationId,
        action: 'update',
        before: { ...application, child_national_id_encrypted: undefined, child_national_id_hash: undefined },
        after: this.auditView(input),
      });
      return this.detail(transaction, applicationId);
    });
  }

  // P16-02: tiếp nhận hồ sơ trực tuyến sau khi kiểm tra đủ điều kiện tối thiểu của hồ sơ trẻ (BR-06)
  async receive(currentUser: CurrentUser, applicationId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const application = await this.find(database, applicationId);
    await this.access.assertCan(currentUser, PERMISSION_CODES.admissionApplicationManage, application.org_unit_id);
    if (application.status !== 'submitted') {
      throw ruleViolationError('P16-02', 'Chỉ tiếp nhận được hồ sơ vừa nộp trực tuyến');
    }
    if (application.child_has_allergies === null) {
      throw ruleViolationError('BR-06', 'Hồ sơ chưa đủ điều kiện tiếp nhận', [
        { field: 'child_has_allergies', message: 'Cần khai báo dị ứng hoặc chọn không có dị ứng' },
      ]);
    }
    return this.transition(database, application, 'received', origin, {
      received_by: origin.actorUserId,
      received_at: this.clock.now(),
    });
  }

  // P16-03: quản lý đơn vị xét đạt; tổng số hồ sơ đạt và đã chuyển không vượt chỉ tiêu của đợt
  async approve(
    currentUser: CurrentUser,
    applicationId: string,
    input: { note: string | null; plannedClassId: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const application = await this.find(database, applicationId);
    await this.access.assertCan(currentUser, PERMISSION_CODES.admissionApplicationReview, application.org_unit_id);
    if (application.status !== 'received') {
      throw ruleViolationError('P16-03', 'Chỉ xét được hồ sơ đã tiếp nhận');
    }
    const campaign = await this.access.findCampaign(database, application.campaign_id);
    const passed = await database
      .selectFrom('admission_applications')
      .select(sql<number>`count(*)::int`.as('count'))
      .where('campaign_id', '=', campaign.id)
      .where('status', 'in', ['passed', 'converted'])
      .executeTakeFirstOrThrow();
    if (passed.count >= campaign.quota) {
      throw ruleViolationError('P16-03', `Đợt tuyển sinh đã đủ chỉ tiêu ${campaign.quota} hồ sơ đạt`);
    }
    if (input.plannedClassId) {
      await this.findTargetClass(database, input.plannedClassId, campaign);
    }
    return this.transition(database, application, 'passed', origin, {
      reviewed_by: origin.actorUserId,
      reviewed_at: this.clock.now(),
      review_note: input.note,
      planned_class_id: input.plannedClassId,
    });
  }

  async reject(currentUser: CurrentUser, applicationId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const application = await this.find(database, applicationId);
    await this.access.assertCan(currentUser, PERMISSION_CODES.admissionApplicationReview, application.org_unit_id);
    if (!EDITABLE.includes(application.status)) {
      throw ruleViolationError('P16-03', 'Chỉ từ chối được hồ sơ chưa xét duyệt');
    }
    return this.transition(database, application, 'rejected', origin, {
      reviewed_by: origin.actorUserId,
      reviewed_at: this.clock.now(),
      reject_reason: reason,
    });
  }

  // P16-04 (QT-01): chỉ hồ sơ đạt được chuyển; sinh hồ sơ trẻ qua đúng dịch vụ hồ sơ trẻ, gắn phụ huynh, phân lớp
  async convert(
    currentUser: CurrentUser,
    accessToken: string,
    applicationId: string,
    input: ConvertInput,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const application = await this.find(database, applicationId);
    await this.access.assertCan(currentUser, PERMISSION_CODES.admissionApplicationManage, application.org_unit_id);
    if (application.status !== 'passed') {
      throw ruleViolationError(
        'P16-04',
        application.status === 'converted'
          ? 'Hồ sơ tuyển sinh đã được chuyển thành hồ sơ trẻ'
          : 'Chỉ chuyển được hồ sơ tuyển sinh đã đạt',
      );
    }
    const campaign = await this.access.findCampaign(database, application.campaign_id);
    const targetClass = await this.findTargetClass(database, input.class_id, campaign);
    const errors: FieldError[] = [];
    const nationalId =
      input.national_id ??
      (application.child_national_id_encrypted
        ? this.protection.decrypt(application.child_national_id_encrypted)
        : null);
    if (!nationalId) {
      errors.push({ field: 'national_id', message: 'Bắt buộc nhập số định danh cá nhân của trẻ' });
    }
    const relationshipId = input.relationship_item_id ?? application.guardian_relationship_item_id;
    if (!relationshipId) {
      errors.push({ field: 'relationship_item_id', message: 'Bắt buộc chọn quan hệ của phụ huynh với trẻ' });
    }
    const hasAllergies = input.has_allergies ?? application.child_has_allergies;
    if (hasAllergies === null) {
      errors.push({ field: 'has_allergies', message: 'Cần khai báo dị ứng hoặc chọn không có dị ứng' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    // Người có quyền duyệt hồ sơ trẻ ở đơn vị của lớp thì phân lớp ngay; kiểm tra sĩ số trước khi tạo hồ sơ trẻ
    const approveScope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.childApprove);
    const canApprove =
      currentUser.hasPermission(PERMISSION_CODES.childApprove) &&
      (approveScope.wholeSchool || approveScope.orgUnitIds.includes(targetClass.org_unit_id));
    if (canApprove) {
      await this.capacity.assert(database, targetClass, input.confirm_over_capacity);
    }

    const child = await this.children.create(
      currentUser,
      accessToken,
      {
        org_unit_id: targetClass.org_unit_id,
        full_name: application.child_full_name,
        dob: application.child_dob,
        gender: application.child_gender,
        place_of_birth: null,
        address: application.address,
        national_id: nationalId ?? '',
        moet_student_code: null,
        birth_certificate_file_id: input.birth_certificate_file_id,
        special_needs_note: null,
        note: application.note,
        is_staff_child: false,
        related_staff_user_id: null,
        related_staff_role_code: null,
        photo_consent: 'pending',
        photo_consent_file_id: null,
        health: {
          has_allergies: hasAllergies,
          allergies: hasAllergies ? application.child_allergies : null,
          chronic_conditions: null,
          blood_type: null,
          note: null,
        },
        guardians: [
          {
            full_name: application.guardian_full_name,
            phone: application.guardian_phone,
            relationship_item_id: relationshipId ?? '',
            is_primary: true,
            occupation: null,
            email: application.guardian_email,
            address: application.address,
          },
        ],
        confirm_possible_duplicate: input.confirm_possible_duplicate,
      },
      origin,
    );
    // Hồ sơ trẻ đã sinh thì hồ sơ tuyển sinh ghi đã chuyển ngay, các bước sau theo luồng của hồ sơ trẻ
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('admission_applications')
        .set({
          status: 'converted',
          created_child_id: child.id,
          planned_class_id: targetClass.id,
          converted_by: origin.actorUserId,
          converted_at: this.clock.now(),
          updated_at: this.clock.now(),
        })
        .where('id', '=', applicationId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: application.org_unit_id,
        entityName: 'admission_applications',
        entityId: applicationId,
        action: 'update',
        before: { status: application.status },
        after: { status: 'converted', created_child_id: child.id, class_id: targetClass.id },
      });
    });
    let latest = await this.children.submit(currentUser, accessToken, child.id, origin);
    let approvalError: string | null = null;
    if (canApprove) {
      try {
        latest = await this.children.approve(
          currentUser,
          accessToken,
          child.id,
          { classId: targetClass.id, confirmOverCapacity: input.confirm_over_capacity },
          origin,
        );
      } catch (error) {
        // Ví dụ chưa tạo được tài khoản phụ huynh: hồ sơ trẻ ở trạng thái chờ duyệt, duyệt lại ở trang Hồ sơ trẻ
        approvalError = error instanceof Error ? error.message : 'Chưa duyệt được hồ sơ trẻ';
        this.logger.warn(`Chưa phân lớp được trẻ ${child.id} sau khi chuyển hồ sơ tuyển sinh: ${approvalError}`);
      }
    }
    return {
      application: await this.detail(database, applicationId),
      child: {
        id: latest.id,
        full_name: latest.full_name,
        status: latest.status,
        current_class: latest.current_class,
        guardians: latest.guardians,
      },
      approval_error: approvalError,
    };
  }

  private async transition(
    database: Kysely<SchoolYearDatabase>,
    application: Awaited<ReturnType<AdmissionApplicationsService['find']>>,
    status: AdmissionApplicationStatus,
    origin: ChangeOrigin,
    values: {
      received_by?: string;
      received_at?: Date;
      reviewed_by?: string;
      reviewed_at?: Date;
      review_note?: string | null;
      reject_reason?: string;
      planned_class_id?: string | null;
    },
  ) {
    return database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('admission_applications')
        .set({ ...values, status, updated_at: this.clock.now() })
        .where('id', '=', application.id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: application.org_unit_id,
        entityName: 'admission_applications',
        entityId: application.id,
        action: 'update',
        before: { status: application.status },
        after: { status, ...values },
      });
      if (status === 'received' || status === 'passed') {
        await queueNotification(transaction, {
          orgUnitId: application.org_unit_id,
          templateCode: status === 'received' ? 'admission_application_received' : 'admission_application_passed',
          title: status === 'received' ? 'Có hồ sơ tuyển sinh chờ xét duyệt' : 'Hồ sơ tuyển sinh đạt, chờ chuyển hồ sơ trẻ',
          body: `Hồ sơ ${application.code} của ${application.child_full_name}`,
          targetType: 'admission_applications',
          targetId: application.id,
          recipients: [
            { roleCode: status === 'received' ? 'VT-03' : 'VT-12', orgUnitId: application.org_unit_id, channel: 'in_app' },
          ],
        });
      }
      return this.detail(transaction, application.id);
    });
  }

  // Lớp đang hoạt động thuộc đơn vị của đợt; đợt của Trường chính nhận được vào lớp của mọi đơn vị (BR-01)
  private async findTargetClass(
    database: Executor,
    classId: string,
    campaign: { org_unit_id: string; org_unit_type: string },
  ) {
    const classRecord = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'name', 'max_size', 'status'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRecord || classRecord.status !== 'active') {
      throw validationError([{ field: 'class_id', message: 'Lớp không có hoặc đã đóng' }]);
    }
    if (campaign.org_unit_type !== 'truong_chinh' && classRecord.org_unit_id !== campaign.org_unit_id) {
      throw validationError([{ field: 'class_id', message: 'Lớp không thuộc đơn vị của đợt tuyển sinh' }]);
    }
    return classRecord;
  }

  private async assertRelationship(database: Executor, relationshipId: string | null): Promise<void> {
    if (!relationshipId) {
      return;
    }
    const relationship = await database
      .selectFrom('catalog_items')
      .select('id')
      .where('id', '=', relationshipId)
      .where('catalog_type', '=', 'parent_relationship')
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!relationship) {
      throw validationError([{ field: 'guardian_relationship_item_id', message: 'Quan hệ không có trong danh mục' }]);
    }
  }

  async find(database: Executor, applicationId: string) {
    const application = await database
      .selectFrom('admission_applications')
      .selectAll()
      .where('id', '=', applicationId)
      .executeTakeFirst();
    if (!application) {
      throw notFoundError('Không tìm thấy hồ sơ tuyển sinh', 'admission_application');
    }
    return application;
  }

  private async detail(database: Executor, applicationId: string) {
    const row = await database
      .selectFrom('admission_applications')
      .innerJoin('admission_campaigns', 'admission_campaigns.id', 'admission_applications.campaign_id')
      .leftJoin('catalog_items', 'catalog_items.id', 'admission_applications.guardian_relationship_item_id')
      .leftJoin('classes', 'classes.id', 'admission_applications.planned_class_id')
      .leftJoin('children', 'children.id', 'admission_applications.created_child_id')
      .selectAll('admission_applications')
      .select([
        'admission_campaigns.name as campaign_name',
        'catalog_items.name as guardian_relationship',
        'classes.name as planned_class_name',
        'children.status as child_status',
      ])
      .where('admission_applications.id', '=', applicationId)
      .executeTakeFirstOrThrow();
    const {
      child_national_id_encrypted: _encrypted,
      child_national_id_hash: _hash,
      child_national_id_last4: lastFour,
      submitted_ip: _ip,
      ...rest
    } = row;
    return { ...rest, child_national_id_masked: lastFour ? maskNationalId(lastFour) : null };
  }

  // Nhật ký thao tác không chứa số định danh ở dạng rõ (BM-64)
  private auditView(input: ApplicationInput) {
    const { child_national_id: nationalId, ...rest } = input;
    return { ...rest, child_national_id_masked: nationalId ? maskNationalId(nationalId.slice(-4)) : null };
  }
}

// Người thực hiện ghi vào nhật ký thao tác khi phụ huynh nộp hồ sơ trực tuyến không có tài khoản
export const PUBLIC_APPLICANT_ID = '00000000-0000-4000-8000-000000000086';

function readConvert(body: RequestBody): ConvertInput {
  const errors: FieldError[] = [];
  const input: ConvertInput = {
    class_id: readRequiredUuid(body, 'class_id', errors, 'Bắt buộc chọn lớp'),
    national_id: readNationalId(body, 'national_id', errors),
    birth_certificate_file_id: readRequiredUuid(
      body,
      'birth_certificate_file_id',
      errors,
      'Bắt buộc tải bản chụp giấy khai sinh',
    ),
    relationship_item_id: null,
    has_allergies: readAllergyFlag(body, 'has_allergies', errors, false),
    confirm_possible_duplicate: body?.confirm_possible_duplicate === true,
    confirm_over_capacity: body?.confirm_over_capacity === true,
  };
  const relationship = body?.relationship_item_id;
  if (relationship !== undefined && relationship !== null && relationship !== '') {
    if (!isUuid(relationship)) {
      errors.push({ field: 'relationship_item_id', message: 'Quan hệ không hợp lệ' });
    } else {
      input.relationship_item_id = relationship;
    }
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

@Controller('admission-applications')
export class AdmissionApplicationsController {
  constructor(private readonly applications: AdmissionApplicationsService) {}

  @Get()
  @RequirePermission(...ADMISSION_PERMISSIONS)
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (query.campaign_id !== undefined && !isUuid(query.campaign_id)) {
      throw validationError([{ field: 'campaign_id', message: 'Mã không hợp lệ' }]);
    }
    if (query.status !== undefined && !STATUSES.includes(query.status as AdmissionApplicationStatus)) {
      throw validationError([{ field: 'status', message: 'Trạng thái không hợp lệ' }]);
    }
    return this.applications.list(currentUser, {
      campaignId: query.campaign_id ?? null,
      status: (query.status as AdmissionApplicationStatus | undefined) ?? null,
      q: query.q?.trim() || null,
    });
  }

  @Get(':id')
  @RequirePermission(...ADMISSION_PERMISSIONS)
  get(
    @Param('id', uuidParameter('Mã hồ sơ tuyển sinh không hợp lệ')) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.applications.get(currentUser, id);
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.admissionApplicationManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.applications.submit(readApplication(body, { requireAllergyFlag: false }), {
      source: 'staff',
      currentUser,
      change: originOf(request, currentUser),
    });
  }

  @Patch(':id')
  @RequirePermission(PERMISSION_CODES.admissionApplicationManage)
  update(
    @Param('id', uuidParameter('Mã hồ sơ tuyển sinh không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.applications.update(
      currentUser,
      id,
      readApplication({ ...body, campaign_id: '00000000-0000-4000-8000-000000000000' }, { requireAllergyFlag: false }),
      originOf(request, currentUser),
    );
  }

  @Post(':id/receive')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.admissionApplicationManage)
  receive(
    @Param('id', uuidParameter('Mã hồ sơ tuyển sinh không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.applications.receive(currentUser, id, originOf(request, currentUser));
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.admissionApplicationReview)
  approve(
    @Param('id', uuidParameter('Mã hồ sơ tuyển sinh không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const note = readText(body, 'note', errors, 1000);
    const plannedClass = body?.planned_class_id;
    if (plannedClass !== undefined && plannedClass !== null && plannedClass !== '' && !isUuid(plannedClass)) {
      errors.push({ field: 'planned_class_id', message: 'Mã lớp không hợp lệ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.applications.approve(
      currentUser,
      id,
      { note, plannedClassId: isUuid(plannedClass) ? plannedClass : null },
      originOf(request, currentUser),
    );
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.admissionApplicationReview)
  reject(
    @Param('id', uuidParameter('Mã hồ sơ tuyển sinh không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readText(body, 'reason', errors, 1000, true);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.applications.reject(currentUser, id, reason ?? '', originOf(request, currentUser));
  }

  @Post(':id/convert')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.admissionApplicationManage)
  convert(
    @Param('id', uuidParameter('Mã hồ sơ tuyển sinh không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.applications.convert(
      currentUser,
      readBearerToken(request.header('authorization')),
      id,
      readConvert(body),
      originOf(request, currentUser),
    );
  }
}
