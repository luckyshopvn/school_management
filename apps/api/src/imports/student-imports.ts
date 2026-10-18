import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { Clock } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import { ADDRESS_TYPE_LABELS, ADDRESS_TYPES, type AddressType } from '../administrative-units/address-catalog.js';
import { AdministrativeUnitsService } from '../administrative-units/administrative-units.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection } from '../common/child-data-protection.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import type { ImportCatalog, ImportColumn, RowError, SheetRow } from './excel.js';
import { foldText, normalizeIdNumber, normalizePhone } from './moet-columns.js';

// Nhập Excel của nhóm Học sinh theo hệ thống của Sở (DT-16 phần 16g), dùng bộ nhập chung của phần 16a (tải file mẫu, tải
// file mẫu kèm dữ liệu, tra cứu danh mục, chọn cột để nhập, xuất file lỗi, ghi khi không còn dòng lỗi):
// - `sms_phones`: điện thoại nhận tin của phụ huynh (mục 4.1.5): số phải là số của cha, mẹ hoặc người giám hộ đã gắn với học
//   sinh; bỏ trống là bỏ chọn;
// - `national_ids`: thu thập số định danh (mục 4.1.8): ghi số định danh mười hai chữ số; số mới cần xác thực lại;
// - `student_addresses`: danh sách học sinh kèm địa chỉ mới (mục 4.1.11): tỉnh, xã phải có trong danh mục địa danh mới.
// Học sinh tìm theo mã định danh Bộ GD&ĐT, không có thì theo số định danh, rồi theo họ tên và ngày sinh; trong phạm vi
// quyền của người nhập. Học sinh chờ duyệt không sửa được (QT-01)
export type StudentImportType = 'sms_phones' | 'national_ids' | 'student_addresses';
export const STUDENT_IMPORT_TYPES: StudentImportType[] = ['sms_phones', 'national_ids', 'student_addresses'];
export const isStudentImportType = (type: string): type is StudentImportType =>
  STUDENT_IMPORT_TYPES.includes(type as StudentImportType);

const IDENTIFY_COLUMNS: ImportColumn[] = [
  {
    key: 'moet_code',
    header: 'Mã định danh Bộ GD&ĐT',
    note: 'Mã của học sinh; để trống thì tìm theo họ tên và ngày sinh',
  },
  { key: 'full_name', header: 'Họ tên học sinh', note: 'Bắt buộc, phải khớp hồ sơ' },
  { key: 'dob', header: 'Ngày sinh', note: 'Dạng ngày/tháng/năm; bắt buộc khi không có mã định danh Bộ GD&ĐT' },
  { key: 'class_name', header: 'Lớp', note: 'Tên lớp đang học, để đối chiếu' },
];

export const STUDENT_IMPORT_COLUMNS: Record<StudentImportType, ImportColumn[]> = {
  sms_phones: [
    ...IDENTIFY_COLUMNS,
    {
      key: 'sms_phone',
      header: 'Số điện thoại nhận tin',
      note: 'Số của cha, mẹ hoặc người giám hộ đã có trong hồ sơ; để trống là bỏ chọn',
    },
  ],
  national_ids: [
    ...IDENTIFY_COLUMNS,
    {
      key: 'national_id',
      header: 'Số định danh cá nhân',
      note: 'Mười hai chữ số, không trùng học sinh khác; bắt buộc',
    },
  ],
  student_addresses: [
    ...IDENTIFY_COLUMNS,
    {
      key: 'address_type',
      header: 'Loại địa chỉ',
      note: `${ADDRESS_TYPES.map((type) => ADDRESS_TYPE_LABELS[type]).join(', ')}; bắt buộc`,
    },
    { key: 'province', header: 'Tỉnh/Thành phố mới', note: 'Tên trong danh mục địa danh mới; bắt buộc' },
    { key: 'ward', header: 'Xã/Phường mới', note: 'Tên xã/phường/đặc khu mới của tỉnh; bắt buộc' },
    { key: 'hamlet', header: 'Tổ/Thôn/Xóm', note: 'Để trống thì giữ như cũ; chỉ có ở Thường trú, Quê quán' },
  ],
};

export const STUDENT_IMPORT_LOCKED: Record<StudentImportType, string[]> = {
  sms_phones: ['moet_code', 'full_name', 'dob', 'sms_phone'],
  national_ids: ['moet_code', 'full_name', 'dob', 'national_id'],
  student_addresses: ['moet_code', 'full_name', 'dob', 'address_type', 'province', 'ward'],
};

export const STUDENT_IMPORT_TITLES: Record<StudentImportType, string> = {
  sms_phones: 'Điện thoại nhận tin',
  national_ids: 'Số định danh',
  student_addresses: 'Địa chỉ mới của học sinh',
};

// Quyền nhập: điện thoại nhận tin như chọn số nhận tin ở hồ sơ; số định danh, địa chỉ là thông tin định danh của học sinh
// đã duyệt nên cần quyền duyệt hồ sơ (QT-01 E7)
export const STUDENT_IMPORT_PERMISSIONS: Record<StudentImportType, string> = {
  sms_phones: PERMISSION_CODES.childManage,
  national_ids: PERMISSION_CODES.childApprove,
  student_addresses: PERMISSION_CODES.childApprove,
};

const PHONE_PATTERN = /^0\d{9}$/;
const NATIONAL_ID_PATTERN = /^\d{12}$/;
const HAMLET_TYPES: AddressType[] = ['permanent', 'hometown'];

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

interface StudentMatch {
  id: string;
  org_unit_id: string;
  full_name: string;
  dob: string;
  status: string;
  moet_student_code: string | null;
  moet_profile: Record<string, unknown> | null;
  class_name: string | null;
}

// Một thay đổi đã kiểm tra, ghi ở bước Ghi dữ liệu
type PlannedChange =
  | { type: 'sms_phones'; child: StudentMatch; guardianId: string | null }
  | { type: 'national_ids'; child: StudentMatch; nationalId: string }
  | {
      type: 'student_addresses';
      child: StudentMatch;
      addressType: AddressType;
      province: string;
      ward: string;
      hamlet: string;
    };

const ddmmyyyy = (value: string) => value.split('-').reverse().join('/');

function parseDay(text: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    return text;
  }
  const vn = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  return vn ? `${vn[3]}-${vn[2]?.padStart(2, '0')}-${vn[1]?.padStart(2, '0')}` : null;
}

@Injectable()
export class StudentImports {
  constructor(
    private readonly organizationScopes: OrganizationScopes,
    private readonly protection: ChildDataProtection,
    private readonly administrativeUnits: AdministrativeUnitsService,
    private readonly clock: Clock,
  ) {}

  private async students(database: Executor, currentUser: CurrentUser, type: StudentImportType) {
    const scope = await this.organizationScopes.resolve(currentUser, STUDENT_IMPORT_PERMISSIONS[type]);
    let query = database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id',
        'children.org_unit_id',
        'children.full_name',
        'children.dob',
        'children.status',
        'children.moet_student_code',
        'children.moet_profile',
        'classes.name as class_name',
      ])
      .where('children.deleted_at', 'is', null)
      .where('children.status', 'in', ['draft', 'pending', 'active', 'paused']);
    if (!scope.wholeSchool) {
      query = query.where('children.org_unit_id', 'in', scope.orgUnitIds.length ? scope.orgUnitIds : ['']);
    }
    return (await query.orderBy('classes.name').orderBy('children.full_name').execute()) as StudentMatch[];
  }

  // Dữ liệu điền sẵn của "Tải file mẫu kèm dữ liệu": học sinh trong phạm vi kèm giá trị đang có
  async templateRows(
    database: Executor,
    currentUser: CurrentUser,
    type: StudentImportType,
  ): Promise<Array<Record<string, unknown>>> {
    const students = await this.students(database, currentUser, type);
    const base = (child: StudentMatch) => ({
      moet_code: child.moet_student_code ?? '',
      full_name: child.full_name,
      dob: ddmmyyyy(child.dob),
      class_name: child.class_name ?? '',
    });
    if (type === 'sms_phones') {
      const links = students.length
        ? await database
            .selectFrom('child_guardians')
            .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
            .select(['child_guardians.child_id', 'guardians.phone'])
            .where('child_guardians.receives_sms', '=', true)
            .where(
              'child_guardians.child_id',
              'in',
              students.map((child) => child.id),
            )
            .execute()
        : [];
      return students.map((child) => ({
        ...base(child),
        sms_phone: links.find((link) => link.child_id === child.id)?.phone ?? '',
      }));
    }
    if (type === 'national_ids') {
      // Không điền số định danh đang có ra tệp (BM-64): người nhập điền số còn thiếu hoặc cần sửa
      return students.map((child) => ({ ...base(child), national_id: '' }));
    }
    return students.flatMap((child) =>
      ADDRESS_TYPES.filter((addressType) => child.moet_profile?.[`${addressType}_province`]).map((addressType) => ({
        ...base(child),
        address_type: ADDRESS_TYPE_LABELS[addressType],
        province: child.moet_profile?.[`${addressType}_province`] ?? '',
        ward: child.moet_profile?.[`${addressType}_ward`] ?? '',
        hamlet: child.moet_profile?.[`${addressType}_hamlet`] ?? '',
      })),
    );
  }

  async catalogs(database: Executor, currentUser: CurrentUser, type: StudentImportType): Promise<ImportCatalog[]> {
    const students = await this.students(database, currentUser, type);
    const classNames = [...new Set(students.map((child) => child.class_name).filter((name): name is string => !!name))];
    const catalogs: ImportCatalog[] = [
      {
        key: 'classes',
        title: 'Lớp học',
        column: 'Lớp',
        items: classNames.map((name) => ({ code: name, name })),
      },
    ];
    if (type === 'student_addresses') {
      const catalog = await this.administrativeUnits.catalog();
      catalogs.push(
        {
          key: 'address_types',
          title: 'Loại địa chỉ',
          column: 'Loại địa chỉ',
          items: ADDRESS_TYPES.map((addressType) => ({ code: addressType, name: ADDRESS_TYPE_LABELS[addressType] })),
        },
        {
          key: 'new_wards',
          title: 'Xã/Phường mới',
          column: 'Tỉnh/Thành phố mới, Xã/Phường mới',
          items: catalog.newWards().map((ward) => ({
            code: ward.code ?? '',
            name: ward.ward_name,
            note: ward.province_name,
          })),
        },
      );
    }
    return catalogs;
  }

  // Kiểm tra toàn bộ tệp; trả về dòng lỗi và các thay đổi sẽ ghi
  async validate(
    database: Executor,
    currentUser: CurrentUser,
    type: StudentImportType,
    rows: SheetRow[],
    selected: Set<string>,
  ): Promise<{ errors: RowError[]; changes: PlannedChange[] }> {
    const students = await this.students(database, currentUser, type);
    const columns = STUDENT_IMPORT_COLUMNS[type];
    const header = (key: string) => columns.find((column) => column.key === key)?.header ?? key;
    const errors: RowError[] = [];
    const changes: PlannedChange[] = [];
    const catalog = type === 'student_addresses' ? await this.administrativeUnits.catalog() : null;
    const seen = new Map<string, number>();
    const idsInFile = new Map<string, number>();
    const guardianLinks =
      type === 'sms_phones' && students.length
        ? await database
            .selectFrom('child_guardians')
            .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
            .select(['child_guardians.child_id', 'child_guardians.guardian_id', 'guardians.phone'])
            .where(
              'child_guardians.child_id',
              'in',
              students.map((child) => child.id),
            )
            .execute()
        : [];

    for (const { row, values } of rows) {
      const before = errors.length;
      const fail = (key: string, message: string) => errors.push({ row, column: header(key), message });
      const fullName = (values.full_name ?? '').trim();
      const moetCode = (values.moet_code ?? '').trim();
      const dob = values.dob ? parseDay(values.dob) : null;
      if (!fullName) {
        fail('full_name', 'Bắt buộc nhập');
      }
      if (values.dob && !dob) {
        fail('dob', 'Ngày không hợp lệ, ghi dạng ngày/tháng/năm');
      }
      if (!moetCode && !values.dob) {
        fail('dob', 'Bắt buộc nhập khi không có mã định danh Bộ GD&ĐT');
      }
      if (errors.length > before) {
        continue;
      }
      const candidates = moetCode
        ? students.filter((child) => child.moet_student_code === moetCode)
        : students.filter(
            (child) =>
              foldText(child.full_name) === foldText(fullName) &&
              child.dob === dob &&
              (!values.class_name || foldText(child.class_name ?? '') === foldText(values.class_name)),
          );
      if (candidates.length === 0) {
        fail(moetCode ? 'moet_code' : 'full_name', 'Không có học sinh nào khớp trong phạm vi của bạn');
        continue;
      }
      if (candidates.length > 1) {
        fail('full_name', 'Có nhiều học sinh cùng họ tên, ngày sinh; ghi thêm lớp hoặc mã định danh Bộ GD&ĐT');
        continue;
      }
      const child = candidates[0] as StudentMatch;
      if (moetCode && foldText(child.full_name) !== foldText(fullName)) {
        fail('full_name', `Họ tên không khớp hồ sơ (${child.full_name})`);
        continue;
      }
      if (child.status === 'pending') {
        fail('full_name', 'Hồ sơ đang chờ duyệt; cần được duyệt hoặc từ chối về nháp trước khi sửa');
        continue;
      }
      if (type === 'sms_phones') {
        const phone = values.sms_phone ? normalizePhone(values.sms_phone) : '';
        if (phone && !PHONE_PATTERN.test(phone)) {
          fail('sms_phone', 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0');
          continue;
        }
        const link = phone
          ? guardianLinks.find((item) => item.child_id === child.id && item.phone === phone)
          : undefined;
        if (phone && !link) {
          fail(
            'sms_phone',
            'Số này không phải số của cha, mẹ hoặc người giám hộ của học sinh; thêm phụ huynh ở hồ sơ trước',
          );
          continue;
        }
        if (this.duplicate(seen, child.id, row, fail)) {
          continue;
        }
        changes.push({ type, child, guardianId: link?.guardian_id ?? null });
      } else if (type === 'national_ids') {
        const nationalId = normalizeIdNumber(values.national_id ?? '');
        if (!NATIONAL_ID_PATTERN.test(nationalId)) {
          fail('national_id', 'Số định danh cá nhân gồm mười hai chữ số');
          continue;
        }
        if ((idsInFile.get(nationalId) ?? 0) > 0) {
          fail('national_id', 'Trùng với dòng khác trong tệp');
          continue;
        }
        idsInFile.set(nationalId, row);
        const owner = await database
          .selectFrom('children')
          .select('id')
          .where('national_id_hash', '=', this.protection.hash(nationalId))
          .executeTakeFirst();
        if (owner && owner.id !== child.id) {
          fail('national_id', 'Số định danh đã thuộc học sinh khác');
          continue;
        }
        if (this.duplicate(seen, child.id, row, fail)) {
          continue;
        }
        if (!owner) {
          changes.push({ type, child, nationalId });
        }
      } else {
        const label = foldText(values.address_type ?? '');
        const addressType = ADDRESS_TYPES.find(
          (item) => foldText(ADDRESS_TYPE_LABELS[item]) === label || item === values.address_type,
        );
        if (!addressType) {
          fail('address_type', 'Không có trong danh mục loại địa chỉ');
          continue;
        }
        const ward = catalog?.findNewWard(values.province ?? '', values.ward ?? '');
        if (!ward) {
          fail('ward', 'Tỉnh và xã/phường không có trong danh mục địa danh mới');
          continue;
        }
        const hamlet = selected.has('hamlet') ? (values.hamlet ?? '').trim() : '';
        if (hamlet && !HAMLET_TYPES.includes(addressType)) {
          fail('hamlet', 'Loại địa chỉ này không có tổ/thôn/xóm');
          continue;
        }
        if (this.duplicate(seen, `${child.id}:${addressType}`, row, fail)) {
          continue;
        }
        changes.push({
          type,
          child,
          addressType,
          province: ward.province_name,
          ward: ward.ward_name,
          hamlet,
        });
      }
    }
    return { errors, changes };
  }

  private duplicate(seen: Map<string, number>, key: string, row: number, fail: (key: string, message: string) => void) {
    const first = seen.get(key);
    if (first !== undefined) {
      fail('full_name', `Trùng học sinh với dòng ${first}`);
      return true;
    }
    seen.set(key, row);
    return false;
  }

  // Ghi các thay đổi đã kiểm tra; mỗi học sinh một dòng nhật ký thao tác
  async apply(
    transaction: Transaction<SchoolYearDatabase>,
    changes: PlannedChange[],
    jobId: string,
    origin: ChangeOrigin,
  ): Promise<void> {
    const now = this.clock.now();
    for (const change of changes) {
      const audit = (before: Record<string, unknown>, after: Record<string, unknown>) =>
        writeAuditLog(transaction, {
          origin,
          orgUnitId: change.child.org_unit_id,
          entityName: change.type === 'sms_phones' ? 'child_guardians' : 'children',
          entityId: change.child.id,
          action: 'update',
          before,
          after: { ...after, import_job_id: jobId },
        });
      if (change.type === 'sms_phones') {
        const previous = await transaction
          .selectFrom('child_guardians')
          .select('guardian_id')
          .where('child_id', '=', change.child.id)
          .where('receives_sms', '=', true)
          .executeTakeFirst();
        await transaction
          .updateTable('child_guardians')
          .set({ receives_sms: false, updated_at: now })
          .where('child_id', '=', change.child.id)
          .where('receives_sms', '=', true)
          .execute();
        if (change.guardianId) {
          await transaction
            .updateTable('child_guardians')
            .set({ receives_sms: true, updated_at: now })
            .where('child_id', '=', change.child.id)
            .where('guardian_id', '=', change.guardianId)
            .execute();
        }
        await audit({ sms_guardian_id: previous?.guardian_id ?? null }, { sms_guardian_id: change.guardianId });
      } else if (change.type === 'national_ids') {
        await transaction
          .updateTable('children')
          .set({
            national_id_encrypted: this.protection.encrypt(change.nationalId),
            national_id_hash: this.protection.hash(change.nationalId),
            national_id_last4: change.nationalId.slice(-4),
            national_id_verified_at: null,
            national_id_verified_by: null,
            national_id_verified_by_name: null,
            updated_at: now,
          })
          .where('id', '=', change.child.id)
          .execute();
        // Nhật ký không ghi số định danh ở dạng rõ (BM-64)
        await audit({}, { national_id_changed: true, national_id_masked: `********${change.nationalId.slice(-4)}` });
      } else {
        const profile: Record<string, unknown> = { ...(change.child.moet_profile ?? {}) };
        const prefix = change.addressType;
        const before = {
          province: profile[`${prefix}_province`] ?? null,
          district: profile[`${prefix}_district`] ?? null,
          ward: profile[`${prefix}_ward`] ?? null,
          hamlet: profile[`${prefix}_hamlet`] ?? null,
        };
        profile[`${prefix}_province`] = change.province;
        profile[`${prefix}_ward`] = change.ward;
        delete profile[`${prefix}_district`];
        if (change.hamlet) {
          profile[`${prefix}_hamlet`] = change.hamlet;
        }
        // Nhiều dòng của cùng học sinh: giữ hồ sơ đã đổi cho dòng sau
        change.child.moet_profile = profile;
        await transaction
          .updateTable('children')
          .set({ moet_profile: JSON.stringify(profile), updated_at: now })
          .where('id', '=', change.child.id)
          .execute();
        await audit(
          { address_type: prefix, ...before },
          {
            address_type: prefix,
            province: change.province,
            ward: change.ward,
            hamlet: change.hamlet || before.hamlet,
          },
        );
      }
    }
  }
}
