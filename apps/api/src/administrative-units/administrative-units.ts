import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  administrativeNameKey,
  type AdministrativeLevel,
  type AdministrativePeriod,
  type ChildStatus,
  type SystemDatabase,
} from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { sql, type Transaction } from 'kysely';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { readExportColumns } from '../classes/class-list.js';
import { ChildScope } from '../children/child-scope.js';
import { buildStudentWorkbook, fileStamp, sendWorkbook } from '../children/student-workbook.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { buildTemplate, MAXIMUM_IMPORT_BYTES, readSheet, type ImportColumn, type RowError } from '../imports/excel.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import {
  ADDRESS_TYPE_LABELS,
  ADDRESS_TYPES,
  AddressCatalog,
  readAddress,
  SUGGESTION_STATUSES,
  suggestionStatus,
  type AddressType,
  type CatalogUnit,
  type NewUnitChoice,
  type SuggestionStatus,
} from './address-catalog.js';
import { ADDRESS_EXPORT_COLUMNS, DEFAULT_ADDRESS_EXPORT_COLUMNS } from './address-export.js';

// 4.1.11. Cập nhật địa danh hành chính (DT-15 phần 15h1): liệt kê địa chỉ của học sinh còn theo địa danh cũ (trước sắp
// xếp đơn vị hành chính năm 2025) ở năm loại địa chỉ, đề xuất địa danh mới theo bảng đối chiếu, chuyển hàng loạt; nhập
// thêm bảng đối chiếu từ Excel. Xem và chuyển cần quyền lập hoặc duyệt hồ sơ học sinh, trong phạm vi xem trẻ (BR-72);
// nhập bảng đối chiếu cần quyền quản lý danh mục dùng chung vì danh mục dùng chung mọi năm học
export const ADMINISTRATIVE_RULE_CODE = 'YCTD-116';
const PAGE_SIZES = new Set([10, 20, 50, 100, 200]);
const CONVERT_LIMIT = 500;
const ADDRESS_EXPORT_LIMIT = 10_000;
const LISTED_STATUSES: ChildStatus[] = ['draft', 'pending', 'active', 'paused'];
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const WARD_CODE = /^\d{5}$/;

export interface AddressFilter {
  addressType: AddressType | null;
  orgUnitId: string | null;
  suggestion: SuggestionStatus | null;
  q: string | null;
}

export interface OldAddressRow {
  id: string;
  child_id: string;
  moet_student_code: string | null;
  full_name: string;
  dob: string;
  org_unit_id: string;
  class_name: string | null;
  child_status: ChildStatus;
  address_type: AddressType;
  old_province: string;
  old_district: string;
  old_ward: string;
  old_ward_code: string | null;
  suggestion: SuggestionStatus;
  candidates: NewUnitChoice[];
}

export interface ConvertItem {
  child_id: string;
  address_type: AddressType;
  new_unit_id: string | null;
}

export const MAPPING_COLUMNS: ImportColumn[] = [
  { key: 'old_province', header: 'Tỉnh/Thành phố cũ', note: 'Bắt buộc. Tên tỉnh trước sắp xếp, ví dụ Tỉnh Bình Dương' },
  { key: 'old_district', header: 'Quận/Huyện cũ', note: 'Bắt buộc. Tên quận, huyện, thị xã, thành phố thuộc tỉnh' },
  { key: 'old_ward', header: 'Xã/Phường cũ', note: 'Bắt buộc. Tên xã, phường, thị trấn trước sắp xếp' },
  { key: 'old_ward_code', header: 'Mã xã/phường cũ', note: 'Không bắt buộc. Mã số 5 chữ số theo danh mục cũ' },
  { key: 'new_province', header: 'Tỉnh/Thành phố mới', note: 'Bắt buộc. Tên tỉnh sau sắp xếp' },
  { key: 'new_ward', header: 'Xã/Phường mới', note: 'Bắt buộc. Tên xã, phường, đặc khu sau sắp xếp' },
  {
    key: 'new_ward_code',
    header: 'Mã xã/phường mới',
    note: 'Không bắt buộc. Mã số 5 chữ số theo Quyết định 19/2025/QĐ-TTg',
  },
];

export function readAddressFilter(query: Record<string, unknown>, errors: FieldError[]): AddressFilter {
  const addressType = query.address_type;
  if (addressType !== undefined && addressType !== '' && !ADDRESS_TYPES.includes(addressType as AddressType)) {
    errors.push({ field: 'address_type', message: 'Loại địa chỉ không hợp lệ' });
  }
  const suggestion = query.suggestion;
  if (suggestion !== undefined && suggestion !== '' && !SUGGESTION_STATUSES.includes(suggestion as SuggestionStatus)) {
    errors.push({ field: 'suggestion', message: 'Tình trạng đề xuất không hợp lệ' });
  }
  const orgUnitId = query.org_unit_id;
  if (orgUnitId !== undefined && orgUnitId !== '' && !isUuid(orgUnitId)) {
    errors.push({ field: 'org_unit_id', message: 'Mã không hợp lệ' });
  }
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  if (q.length > 100) {
    errors.push({ field: 'q', message: 'Tối đa 100 ký tự' });
  }
  return {
    addressType: ADDRESS_TYPES.includes(addressType as AddressType) ? (addressType as AddressType) : null,
    orgUnitId: isUuid(orgUnitId) ? orgUnitId : null,
    suggestion: SUGGESTION_STATUSES.includes(suggestion as SuggestionStatus) ? (suggestion as SuggestionStatus) : null,
    q: q || null,
  };
}

export function readConvertItems(body: RequestBody): ConvertItem[] {
  const raw = body?.items;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > CONVERT_LIMIT) {
    throw validationError([{ field: 'items', message: `Chọn từ 1 đến ${CONVERT_LIMIT} địa chỉ` }]);
  }
  const errors: FieldError[] = [];
  const seen = new Set<string>();
  const items: ConvertItem[] = [];
  raw.forEach((value: unknown, index) => {
    const item = (value ?? {}) as Record<string, unknown>;
    const newUnitId = item.new_unit_id ?? null;
    if (
      !isUuid(item.child_id) ||
      !ADDRESS_TYPES.includes(item.address_type as AddressType) ||
      (newUnitId !== null && !isUuid(newUnitId))
    ) {
      errors.push({ field: `items[${index}]`, message: 'Học sinh, loại địa chỉ hoặc địa danh mới không hợp lệ' });
      return;
    }
    const key = `${item.child_id}:${item.address_type as string}`;
    if (!seen.has(key)) {
      seen.add(key);
      items.push({
        child_id: item.child_id,
        address_type: item.address_type as AddressType,
        new_unit_id: newUnitId as string | null,
      });
    }
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return items;
}

const collator = new Intl.Collator('vi');
// Học sinh xếp A–Z theo tên (từ cuối) rồi họ tên như danh sách học sinh (YCTD-108)
const givenName = (fullName: string) => fullName.trim().split(/\s+/).pop() ?? '';

@Injectable()
export class AdministrativeUnitsService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly childScope: ChildScope,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  async catalog(): Promise<AddressCatalog> {
    const [units, mappings] = await Promise.all([
      this.databases.system
        .selectFrom('administrative_units')
        .select(['id', 'period', 'level', 'code', 'name', 'name_key', 'parent_id'])
        .execute(),
      this.databases.system.selectFrom('administrative_unit_mappings').select(['old_unit_id', 'new_unit_id']).execute(),
    ]);
    return new AddressCatalog(units, mappings);
  }

  // Mọi địa chỉ còn theo địa danh cũ của học sinh trong phạm vi xem, theo bộ lọc
  async rows(currentUser: CurrentUser, filter: AddressFilter): Promise<OldAddressRow[]> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    const database = current.database;
    const scope = await this.childScope.resolve(currentUser, database);
    let query = database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id',
        'children.moet_student_code',
        'children.full_name',
        'children.dob',
        'children.org_unit_id',
        'children.status',
        'children.moet_profile',
        'classes.name as class_name',
      ])
      .where(this.childScope.filter(scope))
      .where('children.status', 'in', LISTED_STATUSES)
      .where('children.moet_profile', 'is not', null);
    if (filter.orgUnitId) {
      query = query.where('children.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.q) {
      query = query.where('children.full_name', 'ilike', `%${filter.q.replace(/[%_\\]/g, '\\$&')}%`);
    }
    const children = await query.execute();
    const catalog = await this.catalog();
    const result: OldAddressRow[] = [];
    for (const child of children) {
      const profile = child.moet_profile ?? {};
      for (const type of filter.addressType ? [filter.addressType] : ADDRESS_TYPES) {
        const address = readAddress(profile, type);
        const classified = catalog.classify(address);
        if (classified.status !== 'old') {
          continue;
        }
        const suggestion = suggestionStatus(classified.candidates);
        if (filter.suggestion && filter.suggestion !== suggestion) {
          continue;
        }
        result.push({
          id: `${child.id}:${type}`,
          child_id: child.id,
          moet_student_code: child.moet_student_code,
          full_name: child.full_name,
          dob: child.dob,
          org_unit_id: child.org_unit_id,
          class_name: child.class_name,
          child_status: child.status,
          address_type: type,
          old_province: address.province,
          old_district: address.district,
          old_ward: address.ward,
          old_ward_code: classified.old_ward_code,
          suggestion,
          candidates: classified.candidates,
        });
      }
    }
    return result.sort(
      (left, right) =>
        collator.compare(givenName(left.full_name), givenName(right.full_name)) ||
        collator.compare(left.full_name, right.full_name) ||
        left.child_id.localeCompare(right.child_id) ||
        ADDRESS_TYPES.indexOf(left.address_type) - ADDRESS_TYPES.indexOf(right.address_type),
    );
  }

  async list(currentUser: CurrentUser, filter: AddressFilter, page: number, pageSize: number) {
    const rows = await this.rows(currentUser, { ...filter, suggestion: null });
    const counts = Object.fromEntries(
      SUGGESTION_STATUSES.map((status) => [status, rows.filter((row) => row.suggestion === status).length]),
    ) as Record<SuggestionStatus, number>;
    const filtered = filter.suggestion ? rows.filter((row) => row.suggestion === filter.suggestion) : rows;
    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      page,
      page_size: pageSize,
      total: filtered.length,
      total_pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      counts,
    };
  }

  // Xuất Excel lưới địa chỉ theo địa danh cũ (DT-16 phần 16b): cùng phạm vi, bộ lọc như khi xem; tệp có tên học sinh nên
  // ghi nhật ký xuất có dữ liệu cá nhân (BR-74). Xem lưới cần quyền lập hoặc duyệt hồ sơ, xuất cần thêm quyền xuất dữ liệu
  async exportAddresses(currentUser: CurrentUser, filter: AddressFilter, columns: string[], ipAddress: string | null) {
    if (
      !currentUser.hasPermission(PERMISSION_CODES.childManage) &&
      !currentUser.hasPermission(PERMISSION_CODES.childApprove)
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này', [
        { field: 'permission', message: `${PERMISSION_CODES.childManage}, ${PERMISSION_CODES.childApprove}` },
      ]);
    }
    const { database } = await this.currentSchoolYear.require();
    const rows = await this.rows(currentUser, filter);
    if (rows.length > ADDRESS_EXPORT_LIMIT) {
      throw ruleViolationError(
        ADMINISTRATIVE_RULE_CODE,
        `Danh sách có hơn ${ADDRESS_EXPORT_LIMIT} địa chỉ; hãy thu hẹp bộ lọc trước khi xuất`,
      );
    }
    const selected = columns.flatMap((id) => ADDRESS_EXPORT_COLUMNS.filter((column) => column.id === id));
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'administrative-addresses',
      title: 'Cập nhật địa danh hành chính',
      fileName: `dia-chi-dia-danh-cu-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter },
      orgUnitIds: [...new Set(rows.map((row) => row.org_unit_id))],
      columns: selected.map((column) => ({ key: column.id, label: column.label })),
      rows: rows.map((row) => Object.fromEntries(selected.map((column) => [column.id, column.value(row)]))),
      ipAddress,
      createdAt,
    });
  }

  // Chuyển địa chỉ đã chọn sang địa danh mới: tỉnh, xã theo tên mới, bỏ quận/huyện cũ; giữ tổ/thôn/xóm. Quyền như cập nhật
  // hàng loạt hồ sơ học sinh (YCTD-108): hồ sơ nháp cần quyền lập hồ sơ ở đơn vị, hồ sơ khác cần quyền duyệt; hồ sơ chờ
  // duyệt không sửa được. Địa chỉ không còn theo địa danh cũ, chưa có đề xuất hoặc có nhiều xã mới mà chưa chọn thì không
  // chuyển địa chỉ nào. Mỗi học sinh ghi một dòng nhật ký thao tác có giá trị trước và sau
  async convert(currentUser: CurrentUser, items: ConvertItem[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const childIds = [...new Set(items.map((item) => item.child_id))];
    const scope = await this.childScope.resolve(currentUser, database);
    const catalog = await this.catalog();
    return database.transaction().execute(async (transaction) => {
      const children = await transaction
        .selectFrom('children')
        .select(['id', 'org_unit_id', 'status', 'full_name', 'moet_profile'])
        .where('id', 'in', childIds)
        .where(this.childScope.filter(scope))
        .forUpdate()
        .execute();
      if (children.length !== childIds.length) {
        throw notFoundError('Có học sinh không tồn tại hoặc đã bị xóa khỏi phạm vi của bạn', 'child');
      }
      const pending = children.filter((child) => child.status === 'pending');
      if (pending.length > 0) {
        throw ruleViolationError(
          ADMINISTRATIVE_RULE_CODE,
          'Có hồ sơ đang chờ duyệt; cần được duyệt hoặc từ chối về nháp trước khi cập nhật',
          pending.map((child) => ({ field: 'items', message: child.full_name })),
        );
      }
      for (const child of children) {
        const permission = child.status === 'draft' ? PERMISSION_CODES.childManage : PERMISSION_CODES.childApprove;
        await this.organizationScopes.assertCanAccess(currentUser, permission, child.org_unit_id);
      }
      const byId = new Map(children.map((child) => [child.id, child]));
      const problems: FieldError[] = [];
      const targets: Array<{ item: ConvertItem; target: NewUnitChoice }> = [];
      for (const item of items) {
        const child = byId.get(item.child_id);
        const label = `${child?.full_name ?? ''} – ${ADDRESS_TYPE_LABELS[item.address_type]}`;
        const classified = catalog.classify(readAddress(child?.moet_profile ?? {}, item.address_type));
        if (classified.status !== 'old') {
          problems.push({ field: 'items', message: `${label}: địa chỉ không còn theo địa danh cũ` });
          continue;
        }
        const target = item.new_unit_id
          ? classified.candidates.find((candidate) => candidate.id === item.new_unit_id)
          : classified.candidates.length === 1
            ? classified.candidates[0]
            : undefined;
        if (!target) {
          problems.push({
            field: 'items',
            message:
              classified.candidates.length === 0
                ? `${label}: chưa có trong bảng đối chiếu`
                : item.new_unit_id
                  ? `${label}: địa danh mới không có trong bảng đối chiếu của xã cũ`
                  : `${label}: xã cũ chia cho nhiều xã mới, cần chọn một xã mới`,
          });
          continue;
        }
        targets.push({ item, target });
      }
      if (problems.length > 0) {
        throw ruleViolationError(
          ADMINISTRATIVE_RULE_CODE,
          'Có địa chỉ không chuyển được, chưa chuyển địa chỉ nào',
          problems,
        );
      }
      const now = this.clock.now();
      for (const child of children) {
        const profile: Record<string, unknown> = { ...(child.moet_profile ?? {}) };
        const before: Record<string, unknown> = {};
        const afterValues: Record<string, unknown> = {};
        for (const { item, target } of targets.filter((entry) => entry.item.child_id === child.id)) {
          const type = item.address_type;
          before[type] = readAddress(profile, type);
          profile[`${type}_province`] = target.province_name;
          profile[`${type}_ward`] = target.ward_name;
          delete profile[`${type}_district`];
          afterValues[type] = {
            province: target.province_name,
            district: '',
            ward: target.ward_name,
            code: target.code,
          };
        }
        await transaction
          .updateTable('children')
          .set({ moet_profile: JSON.stringify(profile), updated_at: now })
          .where('id', '=', child.id)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: child.org_unit_id,
          entityName: 'children',
          entityId: child.id,
          action: 'update',
          before: { moet_profile_addresses: before },
          after: { moet_profile_addresses: afterValues, administrative_unit_update: true },
        });
      }
      return { updated: targets.length, children: children.length };
    });
  }

  // Bảng đối chiếu xã cũ sang xã mới, tìm theo tên xã cũ, quận/huyện cũ hoặc xã mới. Đơn vị cũ thường là xã (cha là quận/
  // huyện, ông là tỉnh); huyện không có cấp xã thì cha là tỉnh
  async mappings(q: string | null, page: number, pageSize: number) {
    let query = this.databases.system
      .selectFrom('administrative_unit_mappings as mapping')
      .innerJoin('administrative_units as old_unit', 'old_unit.id', 'mapping.old_unit_id')
      .innerJoin('administrative_units as old_parent', 'old_parent.id', 'old_unit.parent_id')
      .leftJoin('administrative_units as old_grandparent', 'old_grandparent.id', 'old_parent.parent_id')
      .innerJoin('administrative_units as new_ward', 'new_ward.id', 'mapping.new_unit_id')
      .innerJoin('administrative_units as new_province', 'new_province.id', 'new_ward.parent_id');
    if (q) {
      const key = `%${administrativeNameKey(q).replace(/[%_\\]/g, '\\$&')}%`;
      query = query.where((expression) =>
        expression.or([
          expression('old_unit.name_key', 'like', key),
          expression('old_parent.name_key', 'like', key),
          expression('new_ward.name_key', 'like', key),
        ]),
      );
    }
    const total = await query.select((expression) => expression.fn.countAll<string>().as('count')).executeTakeFirst();
    const rows = await query
      .select([
        'mapping.id',
        'mapping.source',
        'old_unit.level as old_level',
        'old_unit.name as old_name',
        'old_unit.code as old_code',
        'old_parent.name as old_parent_name',
        'old_grandparent.name as old_grandparent_name',
        'new_province.name as new_province',
        'new_ward.name as new_ward',
        'new_ward.code as new_ward_code',
      ])
      .orderBy('new_province.name')
      .orderBy('new_ward.code')
      .orderBy('new_ward.name')
      .orderBy('old_parent.name')
      .orderBy('old_unit.name')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .execute();
    const items = rows.map((row) => {
      const isWard = row.old_level === 'ward';
      return {
        id: row.id,
        source: row.source,
        old_province: (isWard ? row.old_grandparent_name : row.old_parent_name) ?? '',
        old_district: isWard ? row.old_parent_name : row.old_name,
        old_ward: isWard ? row.old_name : '',
        old_ward_code: isWard ? row.old_code : null,
        new_province: row.new_province,
        new_ward: row.new_ward,
        new_ward_code: row.new_ward_code,
      };
    });
    const count = Number(total?.count ?? 0);
    return { items, page, page_size: pageSize, total: count, total_pages: Math.max(1, Math.ceil(count / pageSize)) };
  }

  template(): Promise<Buffer> {
    return buildTemplate('Bảng đối chiếu', MAPPING_COLUMNS);
  }

  // Xã mới để chọn khi sửa dòng đối chiếu (DT-16 phần 16g)
  async newWards() {
    return { items: (await this.catalog()).newWards() };
  }

  // Sửa dòng đối chiếu: đổi xã mới của xã cũ; trùng dòng đã có thì báo lỗi (DT-16 phần 16g, hạn chế của YCTD-116)
  async updateMapping(mappingId: string, newUnitId: string, origin: ChangeOrigin) {
    const mapping = await this.findMapping(mappingId);
    const ward = (await this.catalog()).newWard(newUnitId);
    if (!ward) {
      throw validationError([{ field: 'new_unit_id', message: 'Chọn xã/phường mới trong danh mục' }]);
    }
    const duplicate = await this.databases.system
      .selectFrom('administrative_unit_mappings')
      .select('id')
      .where('old_unit_id', '=', mapping.old_unit_id)
      .where('new_unit_id', '=', newUnitId)
      .where('id', '!=', mappingId)
      .executeTakeFirst();
    if (duplicate) {
      throw ruleViolationError(ADMINISTRATIVE_RULE_CODE, 'Xã cũ đã có dòng đối chiếu sang xã mới này');
    }
    await this.databases.system
      .updateTable('administrative_unit_mappings')
      .set({ new_unit_id: newUnitId })
      .where('id', '=', mappingId)
      .execute();
    await this.auditMapping(
      origin,
      mappingId,
      'update',
      { new_unit_id: mapping.new_unit_id },
      { new_unit_id: newUnitId, new_ward: ward.ward_name },
    );
    return { id: mappingId, new_unit_id: newUnitId, new_ward: ward.ward_name, new_province: ward.province_name };
  }

  // Xóa dòng đối chiếu sai; địa chỉ đã chuyển của học sinh không đổi
  async deleteMapping(mappingId: string, origin: ChangeOrigin) {
    const mapping = await this.findMapping(mappingId);
    await this.databases.system.deleteFrom('administrative_unit_mappings').where('id', '=', mappingId).execute();
    await this.auditMapping(origin, mappingId, 'delete', mapping, null);
    return { deleted: true };
  }

  private async findMapping(mappingId: string) {
    const mapping = await this.databases.system
      .selectFrom('administrative_unit_mappings')
      .select(['id', 'old_unit_id', 'new_unit_id', 'source'])
      .where('id', '=', mappingId)
      .executeTakeFirst();
    if (!mapping) {
      throw notFoundError('Không tìm thấy dòng đối chiếu', 'administrative_unit_mapping');
    }
    return mapping;
  }

  // Bảng đối chiếu dùng chung mọi năm học; nhật ký ghi ở năm học đang dùng như nhập bảng đối chiếu
  private async auditMapping(
    origin: ChangeOrigin,
    mappingId: string,
    action: 'update' | 'delete',
    before: unknown,
    after: unknown,
  ) {
    const current = await this.currentSchoolYear.find();
    if (current) {
      await writeAuditLog(current.database, {
        origin,
        orgUnitId: null,
        entityName: 'administrative_unit_mappings',
        entityId: mappingId,
        action,
        before,
        after,
      });
    }
  }

  // Nhập bảng đối chiếu: đơn vị chưa có thì thêm (nguồn `import`), dòng đối chiếu đã có thì bỏ qua. Có dòng lỗi thì không
  // ghi dòng nào và trả báo cáo dòng lỗi
  async importMappings(currentUser: CurrentUser, fileName: string, body: Buffer, origin: ChangeOrigin) {
    const rows = await readSheet(body, MAPPING_COLUMNS);
    const errors: RowError[] = [];
    for (const { row, values } of rows) {
      for (const column of MAPPING_COLUMNS) {
        const value = values[column.key] ?? '';
        if (!column.key.endsWith('_code') && !value) {
          errors.push({ row, column: column.header, message: 'Bắt buộc nhập' });
        } else if (value.length > 200) {
          errors.push({ row, column: column.header, message: 'Tối đa 200 ký tự' });
        } else if (column.key.endsWith('_code') && value && !WARD_CODE.test(value)) {
          errors.push({ row, column: column.header, message: 'Mã gồm 5 chữ số' });
        }
      }
    }
    const report = (created: { units: number; mappings: number }) => ({
      status: errors.length > 0 ? ('failed' as const) : ('committed' as const),
      total_rows: rows.length,
      error_rows: new Set(errors.map((error) => error.row)).size,
      errors: errors.sort((left, right) => left.row - right.row),
      created_units: created.units,
      created_mappings: created.mappings,
    });
    if (errors.length > 0) {
      return report({ units: 0, mappings: 0 });
    }
    const rollback = new Error('rollback');
    const created = { units: 0, mappings: 0 };
    try {
      await this.databases.system.transaction().execute(async (transaction) => {
        // Một lần nhập tại một thời điểm để hai tệp cùng lúc không thêm trùng đơn vị
        await sql`select pg_advisory_xact_lock(hashtext('administrative_units_import'))`.execute(transaction);
        const units = new UnitWriter(transaction, currentUser.id, this.clock.now(), errors, created);
        for (const { row, values } of rows) {
          const value = (key: string) => values[key] ?? '';
          const oldProvince = await units.find(row, 'old', 'province', null, value('old_province'), null);
          const oldDistrict =
            oldProvince && (await units.find(row, 'old', 'district', oldProvince, value('old_district'), null));
          const oldWard =
            oldDistrict &&
            (await units.find(row, 'old', 'ward', oldDistrict, value('old_ward'), value('old_ward_code') || null));
          const newProvince = await units.find(row, 'new', 'province', null, value('new_province'), null);
          const newWard =
            newProvince &&
            (await units.find(row, 'new', 'ward', newProvince, value('new_ward'), value('new_ward_code') || null));
          if (oldWard && newWard) {
            const inserted = await transaction
              .insertInto('administrative_unit_mappings')
              .values({ old_unit_id: oldWard, new_unit_id: newWard, source: 'import', created_by: currentUser.id })
              .onConflict((conflict) => conflict.columns(['old_unit_id', 'new_unit_id']).doNothing())
              .returning('id')
              .executeTakeFirst();
            created.mappings += inserted ? 1 : 0;
          }
        }
        if (errors.length > 0) {
          throw rollback;
        }
      });
    } catch (error) {
      if (error !== rollback) {
        throw error;
      }
      return report({ units: 0, mappings: 0 });
    }
    const current = await this.currentSchoolYear.find();
    if (current) {
      await writeAuditLog(current.database, {
        origin,
        orgUnitId: null,
        entityName: 'administrative_unit_mappings',
        entityId: randomUUID(),
        action: 'create',
        before: null,
        after: {
          file_name: fileName,
          total_rows: rows.length,
          created_units: created.units,
          created_mappings: created.mappings,
        },
      });
    }
    return report(created);
  }
}

// Tìm đơn vị theo tên trong đơn vị cha, chưa có thì thêm; mã số khác với danh mục là dòng lỗi
class UnitWriter {
  private readonly cache = new Map<string, Pick<CatalogUnit, 'id' | 'code'>>();

  constructor(
    private readonly transaction: Transaction<SystemDatabase>,
    private readonly userId: string,
    private readonly now: Date,
    private readonly errors: RowError[],
    private readonly created: { units: number },
  ) {}

  async find(
    row: number,
    period: AdministrativePeriod,
    level: AdministrativeLevel,
    parentId: string | null,
    name: string,
    code: string | null,
  ): Promise<string | null> {
    const nameKey = administrativeNameKey(name);
    const cacheKey = `${period}:${level}:${parentId ?? ''}:${nameKey}`;
    let unit = this.cache.get(cacheKey);
    if (!unit) {
      let query = this.transaction
        .selectFrom('administrative_units')
        .select(['id', 'code'])
        .where('period', '=', period)
        .where('level', '=', level)
        .where('name_key', '=', nameKey);
      query = parentId ? query.where('parent_id', '=', parentId) : query.where('parent_id', 'is', null);
      unit = await query.executeTakeFirst();
    }
    const column = `${level === 'ward' ? 'Xã/Phường' : level === 'district' ? 'Quận/Huyện' : 'Tỉnh/Thành phố'} ${
      period === 'old' ? 'cũ' : 'mới'
    }`;
    if (code) {
      const sameCode = await this.transaction
        .selectFrom('administrative_units')
        .select(['id', 'name'])
        .where('period', '=', period)
        .where('level', '=', level)
        .where('code', '=', code)
        .executeTakeFirst();
      if (sameCode && sameCode.id !== unit?.id) {
        this.errors.push({ row, column, message: `Mã ${code} đã dùng cho ${sameCode.name}` });
        return null;
      }
      if (unit?.code && unit.code !== code) {
        this.errors.push({ row, column, message: `Mã khác với danh mục (${unit.code})` });
        return null;
      }
    }
    if (!unit) {
      unit = await this.transaction
        .insertInto('administrative_units')
        .values({
          period,
          level,
          code,
          name: name.trim(),
          name_key: nameKey,
          parent_id: parentId,
          source: 'import',
          updated_by: this.userId,
        })
        .returning(['id', 'code'])
        .executeTakeFirstOrThrow();
      this.created.units += 1;
    } else if (code && !unit.code) {
      await this.transaction
        .updateTable('administrative_units')
        .set({ code, updated_at: this.now, updated_by: this.userId })
        .where('id', '=', unit.id)
        .execute();
      unit = { ...unit, code };
    }
    this.cache.set(cacheKey, unit);
    return unit.id;
  }
}

interface UploadedPart {
  originalname: string;
  buffer: Buffer;
}

function readPaging(query: Record<string, string | undefined>, errors: FieldError[]) {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.page_size ?? 20);
  if (!Number.isInteger(page) || page < 1) {
    errors.push({ field: 'page', message: 'Số trang bắt đầu từ 1' });
  }
  if (!PAGE_SIZES.has(pageSize)) {
    errors.push({ field: 'page_size', message: 'Cỡ trang là 10, 20, 50, 100 hoặc 200' });
  }
  return { page, pageSize };
}

@Controller('administrative-units')
export class AdministrativeUnitsController {
  constructor(private readonly service: AdministrativeUnitsService) {}

  @Get('addresses')
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  addresses(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const filter = readAddressFilter(query, errors);
    const { page, pageSize } = readPaging(query, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.list(currentUser, filter, page, pageSize);
  }

  // Xuất Excel lưới địa chỉ theo bộ lọc và các cột đang hiện (DT-16 phần 16b, BR-74)
  @Post('addresses/export')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.dataExport)
  async exportAddresses(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const filter = readAddressFilter(body ?? {}, errors);
    const columns = readExportColumns(body, ADDRESS_EXPORT_COLUMNS, DEFAULT_ADDRESS_EXPORT_COLUMNS, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    sendWorkbook(response, await this.service.exportAddresses(currentUser, filter, columns, request.ip ?? null));
  }

  @Post('addresses/convert')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  convert(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.convert(currentUser, readConvertItems(body), originOf(request, currentUser));
  }

  @Get('mappings')
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove, PERMISSION_CODES.catalogManage)
  mappings(@Query() query: Record<string, string | undefined>) {
    const errors: FieldError[] = [];
    const { page, pageSize } = readPaging(query, errors);
    const q = query.q?.trim() ?? '';
    if (q.length > 100) {
      errors.push({ field: 'q', message: 'Tối đa 100 ký tự' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.mappings(q || null, page, pageSize);
  }

  @Get('new-wards')
  @RequirePermission(PERMISSION_CODES.catalogManage)
  newWards() {
    return this.service.newWards();
  }

  @Put('mappings/:id')
  @RequirePermission(PERMISSION_CODES.catalogManage)
  updateMapping(
    @Param('id', uuidParameter('Mã dòng đối chiếu không hợp lệ')) mappingId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!isUuid(body?.new_unit_id)) {
      throw validationError([{ field: 'new_unit_id', message: 'Chọn xã/phường mới' }]);
    }
    return this.service.updateMapping(mappingId, body?.new_unit_id as string, originOf(request, currentUser));
  }

  @Delete('mappings/:id')
  @RequirePermission(PERMISSION_CODES.catalogManage)
  deleteMapping(
    @Param('id', uuidParameter('Mã dòng đối chiếu không hợp lệ')) mappingId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.deleteMapping(mappingId, originOf(request, currentUser));
  }

  @Get('mappings/template')
  @RequirePermission(PERMISSION_CODES.catalogManage)
  async template(@Res() response: Response) {
    response.setHeader('content-type', XLSX_TYPE);
    response.setHeader('content-disposition', 'attachment; filename="mau-bang-doi-chieu-dia-danh.xlsx"');
    response.send(await this.service.template());
  }

  @Post('mappings/import')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.catalogManage)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  importMappings(
    @UploadedFile() file: UploadedPart | undefined,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file) {
      throw new ApplicationError('ERR_VALIDATION', 'Chưa chọn tệp', [{ field: 'file', message: 'Chọn tệp Excel' }]);
    }
    return this.service.importMappings(
      currentUser,
      Buffer.from(file.originalname, 'latin1').toString('utf8'),
      file.buffer,
      originOf(request, currentUser),
    );
  }
}
