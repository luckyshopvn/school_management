import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import { IdentityClient } from '../authentication/identity-client.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection } from '../common/child-data-protection.js';
import { queueNotification } from '../common/notification-queue.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { parseDate, readWorkbookTable, type RowError } from './excel.js';
import {
  MOET_CHILD_COLUMNS,
  MOET_STAFF_COLUMNS,
  buildMoetProfile,
  foldText,
  mapMoetRows,
  normalizeIdNumber,
  normalizePhone,
  type MoetRow,
} from './moet-columns.js';

// Nhập tệp xuất từ cơ sở dữ liệu ngành (CSDL ngành) cho trẻ và nhân sự (DT-13 phần 13a, YCTD-100).
// Người nhập chọn một đơn vị (tệp không có đơn vị); "Mã lớp" so khớp mã hoặc tên lớp đang dùng của đơn vị đó và các đơn vị
// trực thuộc (chọn Trường chính là toàn trường), không phân biệt hoa thường, dấu, khoảng trắng thừa. Kiểm tra trước, chỉ
// ghi khi không còn dòng lỗi; nhập lại cùng tệp thì cập nhật, không tạo trùng

// Tiêu đề nhận diện dòng tiêu đề của tệp CSDL ngành (dùng cả khi xuất file lỗi, DT-16 phần 16a)
export const MOET_CHILD_HEADERS = ['Mã lớp', 'Họ tên', 'Ngày sinh'];
export const MOET_STAFF_HEADERS = ['Họ tên', 'CMND/CCCD'];

const PHONE_PATTERN = /^0\d{9}$/;
const NATIONAL_ID_PATTERN = /^\d{12}$/;
// Người lớn còn có thể dùng chứng minh nhân dân chín số
const ADULT_ID_PATTERN = /^(\d{9}|\d{12})$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

// Trạng thái học sinh theo danh mục TRANG_THAI của CSDL ngành; trẻ chuyển đi, thôi học không tạo hồ sơ mới và không tự
// đổi trạng thái hồ sơ đã có (thôi học làm theo quy trình ở màn hình Hồ sơ trẻ)
const CHILD_ACTIVE_STATUSES = [
  'dang hoc',
  'chuyen den ky 1',
  'chuyen den ky 2',
  'chuyen den trong he',
  'nghi hoc xin hoc lai ky 1',
  'nghi hoc xin hoc lai ky 2',
];
const CHILD_LEFT_STATUSES = [
  'chuyen di ky 1',
  'chuyen di ky 2',
  'chuyen di trong he',
  'thoi hoc ky 1',
  'thoi hoc ky 2',
  'thoi hoc trong he',
];
// Trạng thái cán bộ theo danh mục TRANG_THAI của tệp giáo viên
const STAFF_ACTIVE_STATUSES = ['dang lam viec', 'chuyen den', 'cho nghi huu', 'da biet phai'];
const STAFF_LEFT_STATUSES = ['da chuyen di', 'da dieu dong', 'da nghi huu'];

// Quan hệ với trẻ: tìm theo tên trong danh mục, thiếu thì tạo khi ghi
const RELATIONSHIPS = {
  father: { code: 'CHA', name: 'Cha', names: ['cha', 'bo', 'ba'] },
  mother: { code: 'ME', name: 'Mẹ', names: ['me', 'ma'] },
  legal_guardian: { code: 'GIAM_HO', name: 'Người giám hộ', names: ['nguoi giam ho', 'giam ho'] },
} as const;
type GuardianRole = keyof typeof RELATIONSHIPS;

const GUARDIAN_GROUPS: Array<{ role: GuardianRole; prefix: string; noInfoKey: string | null; label: string }> = [
  { role: 'mother', prefix: 'mother', noInfoKey: 'no_mother_info', label: 'mẹ' },
  { role: 'father', prefix: 'father', noInfoKey: 'no_father_info', label: 'cha' },
  { role: 'legal_guardian', prefix: 'legal_guardian', noInfoKey: null, label: 'người giám hộ' },
];

interface GuardianPlan {
  role: GuardianRole;
  full_name: string;
  phone: string | null;
  occupation: string | null;
  birth_year: number | null;
  id_number: string | null;
}

export interface MoetChildPlan {
  row: number;
  existing_id: string | null;
  org_unit_id: string;
  class_id: string | null;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  national_id: string;
  moet_student_code: string | null;
  place_of_birth: string | null;
  address: string | null;
  enroll_date: string;
  profile: Record<string, unknown>;
  guardians: GuardianPlan[];
}

export interface MoetStaffPlan {
  row: number;
  existing_id: string | null;
  org_unit_id: string;
  moet_staff_code: string | null;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  start_date: string;
  profile: Record<string, unknown>;
}

// Kết quả kiểm tra: số dòng sẽ tạo mới, cập nhật, bỏ qua và ghi chú từng dòng (không chặn việc ghi)
export interface MoetPreview {
  created: number;
  updated: number;
  skipped: number;
  notices: RowError[];
}

export interface MoetValidation<Plan> {
  totalRows: number;
  errors: RowError[];
  preview: MoetPreview;
  plans: Plan[];
}

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const header = (key: string, columns = MOET_CHILD_COLUMNS) =>
  columns.find((column) => column.key === key)?.header ?? key;

const isYes = (value: string | undefined) => ['x', 'có', 'co', '1', 'true'].includes((value ?? '').toLowerCase());

const genderOf = (value: string | undefined) =>
  foldText(value ?? '') === 'nam' ? 'male' : foldText(value ?? '') === 'nu' ? 'female' : null;

@Injectable()
export class MoetImports {
  constructor(
    private readonly organizationScopes: OrganizationScopes,
    private readonly protection: ChildDataProtection,
    private readonly identityClient: IdentityClient,
    private readonly clock: Clock,
  ) {}

  // Đơn vị được chọn phải đang dùng và trong phạm vi người nhập; trả về đơn vị đó cùng các đơn vị trực thuộc trong phạm vi
  private async unitsOf(
    database: Executor,
    currentUser: CurrentUser,
    orgUnitId: string,
    permissionCode: string,
  ): Promise<{ unitIds: string[]; inScope(orgUnitId: string): boolean }> {
    const scope =
      permissionCode === PERMISSION_CODES.importStaff
        ? await this.organizationScopes.resolveStaff(currentUser, permissionCode)
        : await this.organizationScopes.resolve(currentUser, permissionCode);
    const inScope = (id: string) => scope.wholeSchool || scope.orgUnitIds.includes(id);
    const units = await database.selectFrom('org_units').select(['id', 'parent_id', 'unit_type', 'status']).execute();
    const unit = units.find((item) => item.id === orgUnitId);
    if (!unit || unit.status !== 'active') {
      throw new ApplicationError('ERR_VALIDATION', 'Đơn vị không có hoặc đã ngừng hoạt động', [
        { field: 'org_unit_id', message: 'Chọn đơn vị đang dùng' },
      ]);
    }
    if (!inScope(unit.id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    // Trường chính là gốc của cây hai cấp: chọn Trường chính là toàn trường
    const unitIds = [
      unit.id,
      ...units
        .filter(
          (item) =>
            item.id !== unit.id &&
            item.status === 'active' &&
            (unit.unit_type === 'truong_chinh' || item.parent_id === unit.id),
        )
        .map((item) => item.id),
    ].filter(inScope);
    return { unitIds, inScope };
  }

  // Tiếp nhận học sinh chuyển đến (DT-16 phần 16g): tệp hồ sơ chuyển theo mẫu của Bộ tạo hồ sơ nháp, không cần lớp (xếp lớp
  // khi duyệt hồ sơ), trạng thái trong tệp của trường cũ (chuyển đi) không chặn, học sinh đã có hồ sơ là dòng lỗi
  async validateChildren(
    database: Executor,
    currentUser: CurrentUser,
    orgUnitId: string,
    body: Buffer,
    options: { transferIn?: boolean } = {},
  ): Promise<MoetValidation<MoetChildPlan>> {
    const records = mapMoetRows(readWorkbookTable(body, MOET_CHILD_HEADERS), MOET_CHILD_COLUMNS, [
      ['national_id', 'citizen_id'],
    ]);
    const { unitIds, inScope } = await this.unitsOf(
      database,
      currentUser,
      orgUnitId,
      options.transferIn ? PERMISSION_CODES.childManage : PERMISSION_CODES.importChildren,
    );
    const classes = unitIds.length
      ? await database
          .selectFrom('classes')
          .select(['id', 'org_unit_id', 'code', 'name'])
          .where('status', '=', 'active')
          .where('org_unit_id', 'in', unitIds)
          .execute()
      : [];
    const today = VIETNAM_DATE.format(this.clock.now());
    const thisYear = Number(today.slice(0, 4));
    const errors: RowError[] = [];
    const notices: RowError[] = [];
    const plans: MoetChildPlan[] = [];
    let skipped = 0;

    const identifierOf = (record: MoetRow) => {
      const personal = normalizeIdNumber(record.values.national_id ?? '');
      return personal || normalizeIdNumber(record.values.citizen_id ?? '');
    };
    const count = (values: string[]) =>
      values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>());
    const idsInFile = count(records.map(identifierOf).filter(Boolean));
    const codesInFile = count(records.map((record) => record.values.moet_student_code ?? '').filter(Boolean));

    for (const record of records) {
      const { row, values } = record;
      const before = errors.length;
      const fail = (key: string, message: string) => errors.push({ row, column: header(key), message });

      const fullName = values.full_name ?? '';
      if (!fullName) {
        fail('full_name', 'Bắt buộc nhập');
      } else if (fullName.length > 100) {
        fail('full_name', 'Tối đa 100 ký tự');
      }
      const dob = values.dob ? parseDate(values.dob) : null;
      if (!values.dob) {
        fail('dob', 'Bắt buộc nhập');
      } else if (!dob || dob > today) {
        fail('dob', 'Ngày không hợp lệ hoặc lớn hơn ngày hiện tại, ghi dạng ngày/tháng/năm');
      }
      const gender = genderOf(values.gender);
      if (!gender) {
        fail('gender', 'Ghi Nam hoặc Nữ');
      }
      const status = foldText(values.student_status ?? '') || 'dang hoc';
      const left = !options.transferIn && CHILD_LEFT_STATUSES.includes(status);
      if (!options.transferIn && !left && !CHILD_ACTIVE_STATUSES.includes(status)) {
        fail('student_status', 'Không có trong danh mục trạng thái học sinh của CSDL ngành');
      }

      // Số định danh cá nhân, không có thì dùng số căn cước
      const nationalId = identifierOf(record);
      const idColumn = values.national_id ? 'national_id' : 'citizen_id';
      let existing: { id: string; org_unit_id: string; moet_student_code: string | null } | undefined;
      if (!NATIONAL_ID_PATTERN.test(nationalId)) {
        fail('national_id', 'Cần số định danh cá nhân (hoặc số CCCD) gồm mười hai chữ số');
      } else if ((idsInFile.get(nationalId) ?? 0) > 1) {
        fail(idColumn, 'Trùng với dòng khác trong tệp');
      } else {
        existing = await database
          .selectFrom('children')
          .select(['id', 'org_unit_id', 'moet_student_code'])
          .where('national_id_hash', '=', this.protection.hash(nationalId))
          .executeTakeFirst();
        if (existing && !inScope(existing.org_unit_id)) {
          fail(idColumn, 'Trẻ đã có hồ sơ ở đơn vị ngoài phạm vi của bạn');
        } else if (existing && options.transferIn) {
          fail(idColumn, 'Học sinh đã có hồ sơ ở trường; không tiếp nhận chuyển đến lại');
        }
      }
      const moetCode = values.moet_student_code || null;
      if (moetCode) {
        if ((codesInFile.get(moetCode) ?? 0) > 1) {
          fail('moet_student_code', 'Trùng với dòng khác trong tệp');
        } else {
          const owner = await database
            .selectFrom('children')
            .select('id')
            .where('moet_student_code', '=', moetCode)
            .executeTakeFirst();
          if (owner && owner.id !== existing?.id) {
            fail('moet_student_code', 'Mã học sinh đã gán cho trẻ khác');
          }
        }
      }

      if (left && !existing) {
        // Không chặn cả tệp vì trẻ đã chuyển đi hoặc thôi học
        if (errors.length === before) {
          skipped += 1;
          notices.push({
            row,
            column: header('student_status'),
            message: `Trẻ có trạng thái "${values.student_status}" chưa có hồ sơ nên không tạo mới`,
          });
        }
        continue;
      }

      // Lớp: so khớp mã hoặc tên lớp của đơn vị đã chọn
      const label = foldText(values.class_label ?? '');
      const matches = label
        ? classes.filter((item) => foldText(item.code) === label || foldText(item.name) === label)
        : [];
      const classRecord = matches.length === 1 ? matches[0] : undefined;
      if (!left && !options.transferIn) {
        if (!label) {
          fail('class_label', 'Bắt buộc nhập');
        } else if (matches.length === 0) {
          fail('class_label', 'Không có lớp đang dùng có mã hoặc tên này ở đơn vị đã chọn');
        } else if (matches.length > 1) {
          fail('class_label', 'Có nhiều lớp cùng mã hoặc tên này ở đơn vị đã chọn; chọn đơn vị cụ thể hơn');
        }
      }

      const profile = buildMoetProfile(record, MOET_CHILD_COLUMNS, (plain) => this.protection.encrypt(plain), errors);

      // Cha, mẹ, người giám hộ; bỏ qua khi tệp đánh dấu không có thông tin
      const guardians: GuardianPlan[] = [];
      for (const group of GUARDIAN_GROUPS) {
        if (group.noInfoKey && isYes(values[group.noInfoKey])) {
          continue;
        }
        const name = values[`${group.prefix}_name`] ?? '';
        const phoneText = values[`${group.prefix}_phone`] ?? '';
        const occupation = values[`${group.prefix}_occupation`] ?? '';
        const birthYearText = values[`${group.prefix}_birth_year`] ?? '';
        const idText = values[`${group.prefix}_id_number`] ?? '';
        if (!name && !phoneText && !occupation && !birthYearText && !idText) {
          continue;
        }
        if (!name) {
          fail(`${group.prefix}_name`, `Bắt buộc nhập khi có thông tin khác của ${group.label}`);
        }
        const phone = phoneText ? normalizePhone(phoneText) : null;
        if (phone && !PHONE_PATTERN.test(phone)) {
          fail(`${group.prefix}_phone`, 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0');
        }
        const birthYear = /^\d{4}/.test(birthYearText) ? Number(birthYearText.slice(0, 4)) : null;
        if (birthYearText && (!birthYear || birthYear < 1900 || birthYear > thisYear)) {
          fail(`${group.prefix}_birth_year`, 'Năm sinh gồm bốn chữ số');
        }
        const idNumber = idText ? normalizeIdNumber(idText) : null;
        if (idNumber && !ADULT_ID_PATTERN.test(idNumber)) {
          fail(`${group.prefix}_id_number`, 'Số định danh gồm mười hai chữ số hoặc chứng minh nhân dân chín chữ số');
        }
        // Người giám hộ trùng họ tên với cha hoặc mẹ là cùng một người: không tạo thêm người thân
        if (
          group.role === 'legal_guardian' &&
          guardians.some((guardian) => foldText(guardian.full_name) === foldText(name))
        ) {
          continue;
        }
        // Hai người cùng một số điện thoại: số chỉ gắn với người đầu tiên (tài khoản phụ huynh theo số điện thoại)
        const shared = phone ? guardians.find((guardian) => guardian.phone === phone) : undefined;
        if (shared) {
          notices.push({
            row,
            column: header(`${group.prefix}_phone`),
            message: `Trùng số điện thoại với ${GUARDIAN_GROUPS.find((item) => item.role === shared.role)?.label}; số chỉ gắn với người đó`,
          });
        }
        guardians.push({
          role: group.role,
          full_name: name,
          phone: shared ? null : phone,
          occupation: occupation || null,
          birth_year: birthYear,
          id_number: idNumber,
        });
      }
      // Hồ sơ mới cần ít nhất một người liên hệ có số điện thoại (BR-06); dùng số liên hệ chung cho người đầu tiên
      if (!existing && !guardians.some((guardian) => guardian.phone)) {
        const contact = values.contact_phone ? normalizePhone(values.contact_phone) : '';
        const first = guardians[0];
        if (first && PHONE_PATTERN.test(contact)) {
          first.phone = contact;
          notices.push({
            row,
            column: header('contact_phone'),
            message: 'Cha, mẹ không có số điện thoại; dùng số điện thoại liên hệ cho người liên hệ chính',
          });
        } else {
          fail('mother_phone', 'Cần ít nhất một người cha, mẹ hoặc giám hộ có số điện thoại (BR-06)');
        }
      }

      if (existing && left) {
        notices.push({
          row,
          column: header('student_status'),
          message: `Trạng thái theo CSDL ngành là "${values.student_status}"; hồ sơ giữ trạng thái hiện tại, xử lý thôi học ở màn hình Hồ sơ trẻ`,
        });
      }
      if (existing && classRecord) {
        const current = await database
          .selectFrom('class_enrollments')
          .select('class_id')
          .where('child_id', '=', existing.id)
          .where('is_current', '=', true)
          .executeTakeFirst();
        if (current && current.class_id !== classRecord.id) {
          notices.push({
            row,
            column: header('class_label'),
            message: 'Lớp trong tệp khác lớp hiện tại; không tự chuyển lớp, chuyển lớp ở màn hình Hồ sơ trẻ',
          });
        }
      }

      // Ngày vào lớp: ngày tuyển mới, hoặc ngày nhập trạng thái chuyển đến, hoặc ngày nhập dữ liệu
      const enrollDate =
        (profile.newly_enrolled_date as string | undefined) ??
        (status !== 'dang hoc' ? (profile.status_date as string | undefined) : undefined) ??
        today;

      if (errors.length === before && dob && gender) {
        plans.push({
          row,
          existing_id: existing?.id ?? null,
          org_unit_id: existing?.org_unit_id ?? classRecord?.org_unit_id ?? orgUnitId,
          class_id: classRecord?.id ?? null,
          full_name: fullName,
          dob,
          gender,
          national_id: nationalId,
          moet_student_code: moetCode,
          place_of_birth: values.place_of_birth || null,
          address: values.address || null,
          enroll_date: enrollDate,
          profile,
          guardians,
        });
      }
    }
    return {
      totalRows: records.length,
      errors,
      plans,
      preview: {
        created: plans.filter((plan) => !plan.existing_id).length,
        updated: plans.filter((plan) => plan.existing_id).length,
        skipped,
        notices,
      },
    };
  }

  // Tài khoản phụ huynh tạo trước khi ghi như nhập trẻ theo mẫu của trường; gọi lại cùng số điện thoại không tạo trùng
  // Trả về mã các hồ sơ đã tạo, cập nhật; tiếp nhận chuyển đến tạo hồ sơ nháp (DT-16 phần 16g)
  async commitChildren(
    database: Kysely<SchoolYearDatabase>,
    accessToken: string,
    plans: MoetChildPlan[],
    jobId: string,
    origin: ChangeOrigin,
    options: { asDraft?: boolean } = {},
  ): Promise<string[]> {
    const childIds: string[] = [];
    const accounts = new Map<string, { userId: string; created: boolean }>();
    for (const plan of plans) {
      for (const guardian of plan.guardians) {
        if (guardian.phone && guardian.full_name && !accounts.has(guardian.phone)) {
          const account = await this.identityClient.ensureGuardianAccount(accessToken, {
            phone: guardian.phone,
            full_name: guardian.full_name,
            org_unit_id: plan.org_unit_id,
          });
          accounts.set(guardian.phone, { userId: account.user_id, created: account.created });
        }
      }
    }
    await database.transaction().execute(async (transaction) => {
      const relationshipIds = await this.ensureRelationships(transaction, origin);
      for (const plan of plans) {
        const childId = plan.existing_id
          ? await this.updateChild(transaction, plan, origin, jobId)
          : await this.insertChild(transaction, plan, origin, jobId, options.asDraft === true);
        childIds.push(childId);
        await this.linkGuardians(transaction, childId, plan.guardians, relationshipIds, accounts, origin);
      }
      await queueNotification(transaction, {
        orgUnitId: null,
        templateCode: 'guardian_account_created',
        title: 'Tài khoản phụ huynh đã được tạo',
        body: 'Tài khoản ứng dụng phụ huynh đã được tạo, đăng nhập bằng mật khẩu mặc định nhà trường cung cấp',
        targetType: 'data_import_jobs',
        targetId: jobId,
        recipients: [...accounts.values()]
          .filter((account) => account.created)
          .map((account) => ({ userId: account.userId, channel: 'sms' as const })),
      });
      await this.markCommitted(transaction, jobId, origin);
    });
    return childIds;
  }

  private async markCommitted(transaction: Transaction<SchoolYearDatabase>, jobId: string, origin: ChangeOrigin) {
    await transaction
      .updateTable('data_import_jobs')
      .set({ status: 'committed', committed_by: origin.actorUserId, committed_at: this.clock.now() })
      .where('id', '=', jobId)
      .execute();
  }

  private async ensureRelationships(
    transaction: Transaction<SchoolYearDatabase>,
    origin: ChangeOrigin,
  ): Promise<Record<GuardianRole, string>> {
    const items = await transaction
      .selectFrom('catalog_items')
      .select(['id', 'code', 'name', 'status'])
      .where('catalog_type', '=', 'parent_relationship')
      .execute();
    const result = {} as Record<GuardianRole, string>;
    for (const role of Object.keys(RELATIONSHIPS) as GuardianRole[]) {
      const definition = RELATIONSHIPS[role];
      const found =
        items.find(
          (item) => item.status === 'active' && (definition.names as readonly string[]).includes(foldText(item.name)),
        ) ?? items.find((item) => item.code === definition.code);
      result[role] =
        found?.id ??
        (
          await transaction
            .insertInto('catalog_items')
            .values({
              catalog_type: 'parent_relationship',
              code: definition.code,
              name: definition.name,
              attributes: JSON.stringify({}),
              created_by: origin.actorUserId,
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        ).id;
    }
    return result;
  }

  // Trẻ mới vào thẳng trạng thái đang học như nhập theo mẫu của trường; dị ứng để "chưa khai báo" (bổ sung ở Hồ sơ trẻ)
  private async insertChild(
    transaction: Transaction<SchoolYearDatabase>,
    plan: MoetChildPlan,
    origin: ChangeOrigin,
    jobId: string,
    asDraft = false,
  ): Promise<string> {
    const now = this.clock.now();
    const child = await transaction
      .insertInto('children')
      .values({
        org_unit_id: plan.org_unit_id,
        full_name: plan.full_name,
        dob: plan.dob,
        gender: plan.gender,
        place_of_birth: plan.place_of_birth,
        address: plan.address,
        national_id_encrypted: this.protection.encrypt(plan.national_id),
        national_id_hash: this.protection.hash(plan.national_id),
        national_id_last4: plan.national_id.slice(-4),
        moet_student_code: plan.moet_student_code,
        moet_profile: JSON.stringify(plan.profile),
        // Học 2 buổi/ngày, bán trú lấy từ cột của tệp ngành (YCTD-108)
        two_sessions_per_day: plan.profile.two_sessions_per_day === true,
        boarding: plan.profile.boarding_class === true,
        birth_certificate_file_id: null,
        status: asDraft ? 'draft' : 'active',
        photo_consent: 'pending',
        photo_consent_by: origin.actorUserId,
        photo_consent_at: now,
        enroll_date: plan.enroll_date,
        approved_by: asDraft ? null : origin.actorUserId,
        approved_at: asDraft ? null : now,
        created_by: origin.actorUserId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await transaction
      .insertInto('health_profiles')
      .values({ child_id: child.id, has_allergies: null, allergies: null, created_by: origin.actorUserId })
      .execute();
    await transaction
      .insertInto('photo_consent_histories')
      .values({ child_id: child.id, action: 'pending', actor_user_id: origin.actorUserId })
      .execute();
    if (plan.class_id && !asDraft) {
      await transaction
        .insertInto('class_enrollments')
        .values({
          child_id: child.id,
          class_id: plan.class_id,
          from_date: plan.enroll_date,
          reason: 'Nhập từ CSDL ngành',
          created_by: origin.actorUserId,
        })
        .execute();
    }
    await writeAuditLog(transaction, {
      origin,
      orgUnitId: plan.org_unit_id,
      entityName: 'children',
      entityId: child.id,
      action: 'create',
      before: null,
      after: {
        full_name: plan.full_name,
        dob: plan.dob,
        class_id: asDraft ? null : plan.class_id,
        status: asDraft ? 'draft' : 'active',
        import_job_id: jobId,
        national_id_masked: `********${plan.national_id.slice(-4)}`,
      },
    });
    return child.id;
  }

  // Trẻ đã có: cập nhật thông tin cơ bản và toàn bộ cột CSDL ngành; không đổi đơn vị, lớp, trạng thái
  private async updateChild(
    transaction: Transaction<SchoolYearDatabase>,
    plan: MoetChildPlan,
    origin: ChangeOrigin,
    jobId: string,
  ): Promise<string> {
    const childId = plan.existing_id ?? '';
    const before = await transaction
      .selectFrom('children')
      .select(['full_name', 'dob', 'gender', 'place_of_birth', 'address', 'moet_student_code'])
      .where('id', '=', childId)
      .executeTakeFirstOrThrow();
    const changes = {
      full_name: plan.full_name,
      dob: plan.dob,
      gender: plan.gender,
      place_of_birth: plan.place_of_birth ?? before.place_of_birth,
      address: plan.address ?? before.address,
      moet_student_code: plan.moet_student_code ?? before.moet_student_code,
    };
    await transaction
      .updateTable('children')
      .set({
        ...changes,
        moet_profile: JSON.stringify(plan.profile),
        two_sessions_per_day: plan.profile.two_sessions_per_day === true,
        boarding: plan.profile.boarding_class === true,
        updated_at: this.clock.now(),
      })
      .where('id', '=', childId)
      .execute();
    await writeAuditLog(transaction, {
      origin,
      orgUnitId: plan.org_unit_id,
      entityName: 'children',
      entityId: childId,
      action: 'update',
      before,
      after: { ...changes, moet_profile_updated: true, import_job_id: jobId },
    });
    return childId;
  }

  // Người thân tìm theo số điện thoại (như nhập theo mẫu), không có số thì theo quan hệ và họ tên trong các người thân của
  // trẻ; có rồi thì bổ sung nghề nghiệp, năm sinh, số định danh; người đầu tiên của trẻ chưa có người liên hệ chính là chính
  private async linkGuardians(
    transaction: Transaction<SchoolYearDatabase>,
    childId: string,
    guardians: GuardianPlan[],
    relationshipIds: Record<GuardianRole, string>,
    accounts: Map<string, { userId: string; created: boolean }>,
    origin: ChangeOrigin,
  ): Promise<void> {
    const links = await transaction
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select([
        'guardians.id',
        'guardians.full_name',
        'child_guardians.relationship_item_id',
        'child_guardians.is_primary',
      ])
      .where('child_guardians.child_id', '=', childId)
      .execute();
    let hasPrimary = links.some((link) => link.is_primary);
    for (const guardian of guardians) {
      const relationshipId = relationshipIds[guardian.role];
      const byPhone = guardian.phone
        ? await transaction.selectFrom('guardians').select('id').where('phone', '=', guardian.phone).executeTakeFirst()
        : undefined;
      const byName = links.find(
        (link) =>
          link.relationship_item_id === relationshipId && foldText(link.full_name) === foldText(guardian.full_name),
      );
      const account = guardian.phone ? accounts.get(guardian.phone) : undefined;
      const details = {
        ...(guardian.occupation ? { occupation: guardian.occupation } : {}),
        ...(guardian.birth_year ? { birth_year: guardian.birth_year } : {}),
        ...(guardian.id_number
          ? {
              id_number_encrypted: this.protection.encrypt(guardian.id_number),
              id_number_last4: guardian.id_number.slice(-4),
            }
          : {}),
      };
      const existingId = byPhone?.id ?? byName?.id;
      let guardianId: string;
      if (existingId) {
        guardianId = existingId;
        const set = {
          ...details,
          ...(account ? { user_id: account.userId } : {}),
          ...(guardian.phone && !byPhone ? { phone: guardian.phone } : {}),
        };
        if (Object.keys(set).length > 0) {
          await transaction
            .updateTable('guardians')
            .set({ ...set, updated_at: this.clock.now() })
            .where('id', '=', guardianId)
            .execute();
        }
      } else {
        guardianId = (
          await transaction
            .insertInto('guardians')
            .values({
              full_name: guardian.full_name,
              phone: guardian.phone,
              user_id: account?.userId ?? null,
              created_by: origin.actorUserId,
              ...details,
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        ).id;
      }
      if (!links.some((link) => link.id === guardianId)) {
        await transaction
          .insertInto('child_guardians')
          .values({
            child_id: childId,
            guardian_id: guardianId,
            relationship_item_id: relationshipId,
            is_primary: !hasPrimary,
            created_by: origin.actorUserId,
          })
          .onConflict((conflict) => conflict.columns(['child_id', 'guardian_id']).doNothing())
          .execute();
        links.push({
          id: guardianId,
          full_name: guardian.full_name,
          relationship_item_id: relationshipId,
          is_primary: !hasPrimary,
        });
        hasPrimary = true;
      }
    }
  }

  async validateStaff(
    database: Executor,
    currentUser: CurrentUser,
    orgUnitId: string,
    body: Buffer,
  ): Promise<MoetValidation<MoetStaffPlan>> {
    const records = mapMoetRows(readWorkbookTable(body, MOET_STAFF_HEADERS), MOET_STAFF_COLUMNS);
    const { inScope } = await this.unitsOf(database, currentUser, orgUnitId, PERMISSION_CODES.importStaff);
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'moet_staff_code', 'id_number_encrypted', 'id_number_last4', 'status'])
      .execute();
    const today = VIETNAM_DATE.format(this.clock.now());
    const errors: RowError[] = [];
    const notices: RowError[] = [];
    const plans: MoetStaffPlan[] = [];
    let skipped = 0;
    const count = (values: string[]) =>
      values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>());
    const codesInFile = count(records.map((record) => record.values.moet_staff_code ?? '').filter(Boolean));
    const idsInFile = count(records.map((record) => normalizeIdNumber(record.values.id_number ?? '')).filter(Boolean));
    const findById = (idNumber: string) =>
      staff.find(
        (item) =>
          item.id_number_last4 === idNumber.slice(-4) &&
          item.id_number_encrypted !== null &&
          this.protection.decrypt(item.id_number_encrypted) === idNumber,
      );

    for (const record of records) {
      const { row, values } = record;
      const before = errors.length;
      const fail = (key: string, message: string) =>
        errors.push({ row, column: header(key, MOET_STAFF_COLUMNS), message });

      const fullName = values.full_name ?? '';
      if (!fullName) {
        fail('full_name', 'Bắt buộc nhập');
      }
      const dob = values.dob ? parseDate(values.dob) : null;
      if (values.dob && (!dob || dob > today)) {
        fail('dob', 'Ngày không hợp lệ, ghi dạng ngày/tháng/năm');
      }
      const gender = genderOf(values.gender);
      if (values.gender && !gender) {
        fail('gender', 'Ghi Nam hoặc Nữ');
      }
      const status = foldText(values.staff_status ?? '') || 'dang lam viec';
      const left = STAFF_LEFT_STATUSES.includes(status);
      if (!left && !STAFF_ACTIVE_STATUSES.includes(status)) {
        fail('staff_status', 'Không có trong danh mục trạng thái cán bộ của CSDL ngành');
      }
      const phone = values.phone ? normalizePhone(values.phone) : null;
      if (phone && !PHONE_PATTERN.test(phone)) {
        fail('phone', '10 chữ số bắt đầu bằng 0');
      }
      const email = values.email || null;
      if (email && !EMAIL_PATTERN.test(email)) {
        fail('email', 'Thư điện tử không đúng định dạng');
      }

      // Nhận ra nhân sự theo mã định danh Bộ GD&ĐT, không có thì theo CMND/CCCD
      const moetCode = values.moet_staff_code || null;
      const idNumber = values.id_number ? normalizeIdNumber(values.id_number) : null;
      let existing: (typeof staff)[number] | undefined;
      if (!moetCode && !idNumber) {
        fail('moet_staff_code', 'Cần mã định danh Bộ GD&ĐT hoặc CMND/CCCD để nhận ra nhân sự');
      }
      if (idNumber && !ADULT_ID_PATTERN.test(idNumber)) {
        fail('id_number', 'Mười hai chữ số, hoặc chín chữ số với chứng minh nhân dân');
      } else if (idNumber && (idsInFile.get(idNumber) ?? 0) > 1) {
        fail('id_number', 'Trùng với dòng khác trong tệp');
      }
      if (moetCode && (codesInFile.get(moetCode) ?? 0) > 1) {
        fail('moet_staff_code', 'Trùng với dòng khác trong tệp');
      }
      if (errors.length === before) {
        const byCode = moetCode ? staff.find((item) => item.moet_staff_code === moetCode) : undefined;
        const byId = idNumber ? findById(idNumber) : undefined;
        if (byCode && byId && byCode.id !== byId.id) {
          fail('id_number', 'CMND/CCCD đã thuộc nhân sự khác với mã định danh Bộ GD&ĐT của dòng này');
        } else if (!byCode && byId?.moet_staff_code && moetCode) {
          fail('id_number', 'CMND/CCCD đã thuộc nhân sự có mã định danh Bộ GD&ĐT khác');
        }
        existing = byCode ?? byId;
        if (existing && !inScope(existing.org_unit_id)) {
          fail('full_name', 'Nhân sự đã có hồ sơ ở đơn vị ngoài phạm vi của bạn');
        }
      }

      if (left && !existing) {
        if (errors.length === before) {
          skipped += 1;
          notices.push({
            row,
            column: header('staff_status', MOET_STAFF_COLUMNS),
            message: `Nhân sự có trạng thái "${values.staff_status}" chưa có hồ sơ nên không tạo mới`,
          });
        }
        continue;
      }
      const profile = buildMoetProfile(record, MOET_STAFF_COLUMNS, (plain) => this.protection.encrypt(plain), errors);
      if (existing && left && existing.status === 'active') {
        notices.push({
          row,
          column: header('staff_status', MOET_STAFF_COLUMNS),
          message: `Trạng thái theo CSDL ngành là "${values.staff_status}"; hồ sơ giữ trạng thái hiện tại, cho nghỉ việc ở màn hình Nhân sự`,
        });
      }
      const recruitmentDate = profile.recruitment_date as string | undefined;
      if (!existing && !recruitmentDate) {
        notices.push({
          row,
          column: header('recruitment_date', MOET_STAFF_COLUMNS),
          message: 'Không có ngày tuyển dụng; ngày vào làm lấy là ngày nhập',
        });
      }
      if (errors.length === before) {
        plans.push({
          row,
          existing_id: existing?.id ?? null,
          org_unit_id: existing?.org_unit_id ?? orgUnitId,
          moet_staff_code: moetCode,
          full_name: fullName,
          dob,
          gender,
          phone,
          email,
          id_number: idNumber,
          start_date: recruitmentDate ?? today,
          profile,
        });
      }
    }
    return {
      totalRows: records.length,
      errors,
      plans,
      preview: {
        created: plans.filter((plan) => !plan.existing_id).length,
        updated: plans.filter((plan) => plan.existing_id).length,
        skipped,
        notices,
      },
    };
  }

  // Không tạo tài khoản đăng nhập, không tạo hợp đồng (như nhập nhân sự theo mẫu); nhân sự đã có không đổi đơn vị, trạng
  // thái, ngày vào làm
  async commitStaff(
    database: Kysely<SchoolYearDatabase>,
    plans: MoetStaffPlan[],
    jobId: string,
    origin: ChangeOrigin,
  ): Promise<void> {
    await database.transaction().execute(async (transaction) => {
      const usedCodes = new Set(
        (await transaction.selectFrom('staff').select('code').execute()).map((row) => row.code),
      );
      for (const plan of plans) {
        const identity = plan.id_number
          ? {
              id_number_encrypted: this.protection.encrypt(plan.id_number),
              id_number_last4: plan.id_number.slice(-4),
            }
          : {};
        const common = {
          full_name: plan.full_name,
          ...(plan.dob ? { dob: plan.dob } : {}),
          ...(plan.gender ? { gender: plan.gender } : {}),
          ...(plan.phone ? { phone: plan.phone } : {}),
          ...(plan.email ? { email: plan.email } : {}),
          ...(plan.moet_staff_code ? { moet_staff_code: plan.moet_staff_code } : {}),
          ...identity,
          moet_profile: JSON.stringify(plan.profile),
        };
        if (plan.existing_id) {
          await transaction
            .updateTable('staff')
            .set({ ...common, updated_at: this.clock.now() })
            .where('id', '=', plan.existing_id)
            .execute();
          await writeAuditLog(transaction, {
            origin,
            orgUnitId: plan.org_unit_id,
            entityName: 'staff',
            entityId: plan.existing_id,
            action: 'update',
            before: null,
            after: { full_name: plan.full_name, moet_staff_code: plan.moet_staff_code, import_job_id: jobId },
          });
          continue;
        }
        let code = plan.moet_staff_code && !usedCodes.has(plan.moet_staff_code) ? plan.moet_staff_code : null;
        while (!code || usedCodes.has(code)) {
          code = await nextDocumentCode(transaction, 'staff_moet_import', 'CSDL');
        }
        usedCodes.add(code);
        const created = await transaction
          .insertInto('staff')
          .values({
            ...common,
            org_unit_id: plan.org_unit_id,
            code,
            start_date: plan.start_date,
            created_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: plan.org_unit_id,
          entityName: 'staff',
          entityId: created.id,
          action: 'create',
          before: null,
          after: { code, full_name: plan.full_name, moet_staff_code: plan.moet_staff_code, import_job_id: jobId },
        });
      }
      await this.markCommitted(transaction, jobId, origin);
    });
  }
}
