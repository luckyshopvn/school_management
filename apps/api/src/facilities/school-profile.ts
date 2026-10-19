import { Body, Controller, Get, Injectable, Put, Req } from '@nestjs/common';
import { Clock, validationError, type FieldError } from '@school-management/server';
import {
  isValidOrganizationIdentifier,
  OFFICE_ACCOUNT_FIELDS,
  PERMISSION_CODES,
  RECOGNITION_YEAR_RANGE,
  SCHOOL_PROFILE_SECTIONS,
} from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import type { RequestBody } from '../common/request-fields.js';
import { FacilitiesData } from './facilities-data.js';
import { readProfileValues } from './facility-rules.js';

// Hồ sơ trường (khảo sát mục 3.1, dòng 1.1 và 1.5; YCTD-102): một hồ sơ mỗi năm học, gắn với Trường chính, sáu thẻ. Mỗi
// thẻ lưu một cột jsonb với khóa cố định trong gói dùng chung; máy chủ từ chối khóa lạ. Nút Ghi gửi cả sáu thẻ; thẻ không
// gửi giữ nguyên. Tài khoản văn phòng điện tử chỉ lưu tên tài khoản, người dùng, không lưu mật khẩu
const MANAGE = PERMISSION_CODES.schoolProfileManage;
const VIEW = [MANAGE, PERMISSION_CODES.emisReport];
type SectionKey = 'general' | 'other_info' | 'foreign_elements' | 'internet' | 'it_infrastructure';
const SECTION_KEYS = SCHOOL_PROFILE_SECTIONS.map((section) => section.key as SectionKey);
const MAX_OFFICE_ACCOUNTS = 50;

export interface SchoolProfileInput {
  sections: Partial<Record<SectionKey, Record<string, unknown>>>;
  office_accounts?: Array<Record<string, unknown>>;
}

export function readSchoolProfile(body: RequestBody, errors: FieldError[]): SchoolProfileInput {
  const input: SchoolProfileInput = { sections: {} };
  for (const key of Object.keys(body ?? {})) {
    if (!SECTION_KEYS.includes(key as SectionKey) && key !== 'office_accounts') {
      errors.push({ field: key, message: 'Thẻ không có trong hồ sơ trường' });
    }
  }
  for (const section of SCHOOL_PROFILE_SECTIONS) {
    const value = body?.[section.key];
    if (value !== undefined) {
      input.sections[section.key as SectionKey] = readProfileValues(value, section.fields, section.key, errors);
    }
  }
  // Mã định danh điện tử của tổ chức theo NĐ 69 có thì phải đủ 12 chữ số (DT-16 phần 16c)
  const electronicId = input.sections.general?.electronic_id_code;
  if (typeof electronicId === 'string' && electronicId !== '' && !isValidOrganizationIdentifier(electronicId)) {
    errors.push({
      field: 'general.electronic_id_code',
      message: 'Mã định danh điện tử của tổ chức gồm đúng 12 chữ số',
    });
  }
  // Năm công nhận chuẩn quốc gia, kiểm định CLGD trong khoảng hợp lệ (DT-17 phần 17e)
  for (const key of ['national_standard_year', 'accreditation_year']) {
    const year = input.sections.general?.[key];
    if (typeof year === 'number' && (year < RECOGNITION_YEAR_RANGE.min || year > RECOGNITION_YEAR_RANGE.max)) {
      errors.push({
        field: `general.${key}`,
        message: `Năm từ ${RECOGNITION_YEAR_RANGE.min} đến ${RECOGNITION_YEAR_RANGE.max}`,
      });
    }
  }
  const accounts = body?.office_accounts;
  if (accounts !== undefined) {
    if (!Array.isArray(accounts) || accounts.length > MAX_OFFICE_ACCOUNTS) {
      errors.push({ field: 'office_accounts', message: `Danh sách tối đa ${MAX_OFFICE_ACCOUNTS} tài khoản` });
    } else {
      input.office_accounts = accounts
        .map((account, index) => readProfileValues(account, OFFICE_ACCOUNT_FIELDS, `office_accounts.${index}`, errors))
        .filter((account) => Object.keys(account).length > 0);
      input.office_accounts.forEach((account, index) => {
        if (!account.account_name) {
          errors.push({ field: `office_accounts.${index}.account_name`, message: 'Bắt buộc nhập tên tài khoản' });
        }
      });
    }
  }
  return input;
}

@Injectable()
export class SchoolProfileService {
  constructor(
    private readonly data: FacilitiesData,
    private readonly clock: Clock,
  ) {}

  // Hồ sơ chưa ghi lần nào thì trả các thẻ trống, kèm tên, địa chỉ, điện thoại của Trường chính để gợi ý
  async read(currentUser: CurrentUser) {
    await this.data.units(currentUser, VIEW, null);
    const database = await this.data.database();
    const root = await this.data.root(database);
    const profile = await database
      .selectFrom('school_profiles')
      .selectAll()
      .where('org_unit_id', '=', root.id)
      .executeTakeFirst();
    return {
      org_unit: root,
      general: profile?.general ?? {},
      other_info: profile?.other_info ?? {},
      foreign_elements: profile?.foreign_elements ?? {},
      internet: profile?.internet ?? {},
      it_infrastructure: profile?.it_infrastructure ?? {},
      office_accounts: profile?.office_accounts ?? [],
      updated_at: profile?.updated_at ?? null,
    };
  }

  async save(currentUser: CurrentUser, input: SchoolProfileInput, origin: ChangeOrigin) {
    await this.data.assertWholeSchool(currentUser, [MANAGE], 'Chỉ người có phạm vi toàn trường cập nhật hồ sơ trường');
    const database = await this.data.database();
    const root = await this.data.root(database);
    await database.transaction().execute(async (transaction) => {
      const existing = await transaction
        .selectFrom('school_profiles')
        .selectAll()
        .where('org_unit_id', '=', root.id)
        .forUpdate()
        .executeTakeFirst();
      const values: Record<string, string> = {};
      for (const [key, value] of Object.entries(input.sections)) {
        values[key] = JSON.stringify(value);
      }
      if (input.office_accounts !== undefined) {
        values.office_accounts = JSON.stringify(input.office_accounts);
      }
      const saved = existing
        ? await transaction
            .updateTable('school_profiles')
            .set({ ...values, updated_by: origin.actorUserId, updated_at: this.clock.now() })
            .where('id', '=', existing.id)
            .returningAll()
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('school_profiles')
            .values({ ...values, org_unit_id: root.id, updated_by: origin.actorUserId })
            .returningAll()
            .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: root.id,
        entityName: 'school_profiles',
        entityId: saved.id,
        action: existing ? 'update' : 'create',
        before: existing ?? null,
        after: saved,
      });
    });
    return this.read(currentUser);
  }
}

@Controller('school-profile')
export class SchoolProfileController {
  constructor(private readonly profiles: SchoolProfileService) {}

  @Get()
  @RequirePermission(...VIEW)
  read(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.profiles.read(currentUser);
  }

  @Put()
  @RequirePermission(MANAGE)
  save(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = readSchoolProfile(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.profiles.save(currentUser, input, originOf(request, currentUser));
  }
}
