import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Put, Query } from '@nestjs/common';
import type { DocumentBookDirection, DocumentCatalogKind, SystemDatabase } from '@school-management/database';
import { ApplicationError, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { sql, type Kysely } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { conflictOnDuplicate, notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import {
  CATALOG_KINDS,
  escapeLike,
  readBoolean,
  readDate,
  readInteger,
  readText,
  readUuid,
  readUuidList,
  throwIfAny,
} from './incoming-fields.js';

// Quản trị văn bản theo VNPT iOffice (DT-18 phần 18a, YCTD-138): sổ văn bản (tên sổ, đơn vị áp dụng, số bắt đầu, ngày áp
// dụng, ngày kết thúc, STT hiển thị, người theo dõi, người quản trị), đơn vị bên ngoài, khai báo nhóm đơn vị ban hành, danh
// mục văn bản (hình thức, độ khẩn, độ mật, lĩnh vực) và lãnh đạo nhận văn bản. Cấu hình lưu ở cơ sở dữ liệu hệ thống của
// trường, không ghi cứng trong mã. Ghi cần quyền quản trị văn bản ở phạm vi toàn trường; danh sách thì mọi người có một
// quyền của phân hệ đọc được để chọn khi vào sổ, chuyển văn bản
export const INCOMING_RULE_CODE = 'YCTD-138';
const VIEW = PERMISSION_CODES.incomingDocumentView;
const REGISTER = PERMISSION_CODES.incomingDocumentRegister;
const SEARCH = PERMISSION_CODES.incomingDocumentSearch;
const ADMIN = PERMISSION_CODES.incomingDocumentAdmin;
export const INCOMING_PERMISSIONS = [VIEW, REGISTER, SEARCH, ADMIN];
const ID_MESSAGE = 'Mã không hợp lệ';

export interface StaffAccount {
  user_id: string;
  full_name: string;
  org_unit_name: string | null;
  department_name: string | null;
  job_title_name: string | null;
}

interface CatalogInput {
  kind: DocumentCatalogKind;
  code: string;
  name: string;
  level: number;
  education_level: string | null;
  sort_order: number;
  active: boolean;
}

interface UnitInput {
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  electronic_code: string | null;
  sort_order: number;
  active: boolean;
}

interface BookInput {
  direction: DocumentBookDirection;
  name: string;
  org_unit_id: string | null;
  year: number;
  start_number: number;
  start_date: string;
  end_date: string | null;
  sort_order: number;
  follower_ids: string[];
  admin_ids: string[];
}

export function hasWholeSchool(currentUser: CurrentUser, code: string): boolean {
  return currentUser.organizationScope(code).wholeSchool;
}

@Injectable()
export class DocumentAdminService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
  ) {}

  private get system(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

  private assertAdmin(currentUser: CurrentUser): void {
    if (!hasWholeSchool(currentUser, ADMIN)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Cần quyền quản trị văn bản ở phạm vi toàn trường');
    }
  }

  // ---- Nhân sự có tài khoản: danh sách chọn người nhận, lãnh đạo, người theo dõi sổ ----

  // Nhân sự đang làm việc có tài khoản ở năm học đang dùng; chưa có năm học thì trống
  async staffAccounts(userIds?: string[]): Promise<StaffAccount[]> {
    const current = await this.currentSchoolYear.find();
    if (!current || (userIds && userIds.length === 0)) {
      return [];
    }
    let query = current.database
      .selectFrom('staff')
      .leftJoin('org_units', 'org_units.id', 'staff.org_unit_id')
      .leftJoin('departments', 'departments.id', 'staff.department_id')
      .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id')
      .select([
        'staff.user_id',
        'staff.full_name',
        'org_units.name as org_unit_name',
        'departments.name as department_name',
        'job_titles.name as job_title_name',
      ])
      .where('staff.status', '=', 'active')
      .where('staff.user_id', 'is not', null);
    if (userIds) {
      query = query.where('staff.user_id', 'in', userIds);
    }
    const rows = await query.orderBy('staff.full_name').execute();
    // Một tài khoản liên kết một hồ sơ; còn trùng (dữ liệu cũ) thì lấy dòng đầu
    const seen = new Set<string>();
    return rows.filter((row) => {
      const id = row.user_id as string;
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    }) as StaffAccount[];
  }

  // Tên người theo hồ sơ nhân sự; mã không có tài khoản đang làm việc thì báo lỗi ở ô
  async resolveAccounts(userIds: string[], field: string): Promise<Map<string, StaffAccount>> {
    const accounts = new Map((await this.staffAccounts(userIds)).map((account) => [account.user_id, account]));
    const missing = userIds.filter((id) => !accounts.has(id));
    if (missing.length > 0) {
      throw validationError([{ field, message: 'Có người không phải nhân sự đang làm việc có tài khoản' }]);
    }
    return accounts;
  }

  // ---- Danh mục văn bản ----

  listCatalog(kind: DocumentCatalogKind | null) {
    let query = this.system.selectFrom('document_catalog_items').selectAll();
    if (kind) {
      query = query.where('kind', '=', kind);
    }
    return query.orderBy('kind').orderBy('sort_order').orderBy('name').execute();
  }

  private parseCatalog(body: RequestBody): CatalogInput {
    const errors: FieldError[] = [];
    const kind = body?.kind as DocumentCatalogKind;
    if (!CATALOG_KINDS.includes(kind)) {
      errors.push({ field: 'kind', message: 'Loại danh mục không hợp lệ' });
    }
    const input: CatalogInput = {
      kind,
      code: readText(body, 'code', errors, { required: true, maximum: 50 }) ?? '',
      name: readText(body, 'name', errors, { required: true, maximum: 200 }) ?? '',
      level: readInteger(body, 'level', errors, { min: 0, max: 2 }, 0) ?? 0,
      education_level: readText(body, 'education_level', errors, { maximum: 50 }),
      sort_order: readInteger(body, 'sort_order', errors, { min: 0, max: 9999 }, 0) ?? 0,
      active: readBoolean(body, 'active', errors, true),
    };
    throwIfAny(errors);
    return input;
  }

  async createCatalog(currentUser: CurrentUser, body: RequestBody) {
    this.assertAdmin(currentUser);
    const input = this.parseCatalog(body);
    return conflictOnDuplicate(
      this.system.insertInto('document_catalog_items').values(input).returningAll().executeTakeFirstOrThrow(),
      'Mã đã có trong danh mục',
      'code',
    );
  }

  async updateCatalog(currentUser: CurrentUser, id: string, body: RequestBody) {
    this.assertAdmin(currentUser);
    const input = this.parseCatalog(body);
    const row = await conflictOnDuplicate(
      this.system
        .updateTable('document_catalog_items')
        .set({ ...input, updated_at: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst(),
      'Mã đã có trong danh mục',
      'code',
    );
    if (!row) {
      throw notFoundError('Không tìm thấy mục danh mục', 'document_catalog_item');
    }
    return row;
  }

  // Mục đã dùng ở văn bản thì không xóa, chỉ ngừng sử dụng để giữ đúng thông tin văn bản cũ
  async deleteCatalog(currentUser: CurrentUser, id: string): Promise<void> {
    this.assertAdmin(currentUser);
    const used = await this.system
      .selectFrom('incoming_documents')
      .select('id')
      .where((expression) =>
        expression.or([
          expression('form_id', '=', id),
          expression('urgency_id', '=', id),
          expression('secrecy_id', '=', id),
          expression('field_id', '=', id),
        ]),
      )
      .limit(1)
      .executeTakeFirst();
    if (used) {
      throw ruleViolationError(INCOMING_RULE_CODE, 'Mục đã dùng ở văn bản, hãy bỏ chọn "Đang sử dụng" thay vì xóa');
    }
    const result = await this.system.deleteFrom('document_catalog_items').where('id', '=', id).executeTakeFirst();
    if (result.numDeletedRows === 0n) {
      throw notFoundError('Không tìm thấy mục danh mục', 'document_catalog_item');
    }
  }

  // ---- Đơn vị bên ngoài ----

  async listUnits(search: string | null, activeOnly: boolean) {
    let query = this.system
      .selectFrom('external_units')
      .selectAll('external_units')
      .select((expression) =>
        sql<string[]>`coalesce((select array_agg(groups.name order by groups.sort_order, groups.name)
          from external_unit_group_members members join external_unit_groups groups on groups.id = members.group_id
          where members.unit_id = ${expression.ref('external_units.id')}), '{}')`.as('group_names'),
      );
    if (search) {
      const pattern = `%${escapeLike(search)}%`;
      query = query.where((expression) =>
        expression.or([expression('name', 'ilike', pattern), expression('code', 'ilike', pattern)]),
      );
    }
    if (activeOnly) {
      query = query.where('active', '=', true);
    }
    return query.orderBy('sort_order').orderBy('name').execute();
  }

  private parseUnit(body: RequestBody): UnitInput {
    const errors: FieldError[] = [];
    const input: UnitInput = {
      code: readText(body, 'code', errors, { required: true, maximum: 50 }) ?? '',
      name: readText(body, 'name', errors, { required: true, maximum: 300 }) ?? '',
      address: readText(body, 'address', errors),
      phone: readText(body, 'phone', errors, { maximum: 50 }),
      email: readText(body, 'email', errors, { maximum: 200 }),
      electronic_code: readText(body, 'electronic_code', errors, { maximum: 100 }),
      sort_order: readInteger(body, 'sort_order', errors, { min: 0, max: 9999 }, 0) ?? 0,
      active: readBoolean(body, 'active', errors, true),
    };
    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      errors.push({ field: 'email', message: 'Thư điện tử không hợp lệ' });
    }
    throwIfAny(errors);
    return input;
  }

  async createUnit(currentUser: CurrentUser, body: RequestBody) {
    this.assertAdmin(currentUser);
    return conflictOnDuplicate(
      this.system.insertInto('external_units').values(this.parseUnit(body)).returningAll().executeTakeFirstOrThrow(),
      'Mã đơn vị đã có',
      'code',
    );
  }

  async updateUnit(currentUser: CurrentUser, id: string, body: RequestBody) {
    this.assertAdmin(currentUser);
    const row = await conflictOnDuplicate(
      this.system
        .updateTable('external_units')
        .set({ ...this.parseUnit(body), updated_at: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst(),
      'Mã đơn vị đã có',
      'code',
    );
    if (!row) {
      throw notFoundError('Không tìm thấy đơn vị bên ngoài', 'external_unit');
    }
    return row;
  }

  async deleteUnit(currentUser: CurrentUser, id: string): Promise<void> {
    this.assertAdmin(currentUser);
    const used = await this.system
      .selectFrom('incoming_documents')
      .select('id')
      .where('issuer_unit_id', '=', id)
      .limit(1)
      .executeTakeFirst();
    if (used) {
      throw ruleViolationError(INCOMING_RULE_CODE, 'Đơn vị đã ban hành văn bản đến, hãy ngừng sử dụng thay vì xóa');
    }
    const result = await this.system.deleteFrom('external_units').where('id', '=', id).executeTakeFirst();
    if (result.numDeletedRows === 0n) {
      throw notFoundError('Không tìm thấy đơn vị bên ngoài', 'external_unit');
    }
  }

  // ---- Nhóm đơn vị ban hành ----

  async listGroups() {
    const groups = await this.system.selectFrom('external_unit_groups').selectAll().orderBy('sort_order').execute();
    const members = await this.system
      .selectFrom('external_unit_group_members')
      .innerJoin('external_units', 'external_units.id', 'external_unit_group_members.unit_id')
      .select(['external_unit_group_members.group_id', 'external_units.id', 'external_units.name'])
      .orderBy('external_units.sort_order')
      .orderBy('external_units.name')
      .execute();
    return groups.map((group) => {
      const units = members.filter((member) => member.group_id === group.id);
      return { ...group, unit_ids: units.map((unit) => unit.id), unit_names: units.map((unit) => unit.name) };
    });
  }

  private parseGroup(body: RequestBody) {
    const errors: FieldError[] = [];
    const input = {
      name: readText(body, 'name', errors, { required: true, maximum: 200 }) ?? '',
      note: readText(body, 'note', errors),
      sort_order: readInteger(body, 'sort_order', errors, { min: 0, max: 9999 }, 0) ?? 0,
    };
    const unitIds = readUuidList(body, 'unit_ids', errors, 1000);
    throwIfAny(errors);
    return { input, unitIds };
  }

  async saveGroup(currentUser: CurrentUser, id: string | null, body: RequestBody) {
    this.assertAdmin(currentUser);
    const { input, unitIds } = this.parseGroup(body);
    if (unitIds.length > 0) {
      const found = await this.system.selectFrom('external_units').select('id').where('id', 'in', unitIds).execute();
      if (found.length !== unitIds.length) {
        throw validationError([{ field: 'unit_ids', message: 'Có đơn vị không còn trong danh mục' }]);
      }
    }
    const groupId = await conflictOnDuplicate(
      this.system.transaction().execute(async (transaction) => {
        let saved: { id: string } | undefined;
        if (id) {
          saved = await transaction
            .updateTable('external_unit_groups')
            .set({ ...input, updated_at: new Date() })
            .where('id', '=', id)
            .returning('id')
            .executeTakeFirst();
          if (!saved) {
            throw notFoundError('Không tìm thấy nhóm đơn vị', 'external_unit_group');
          }
          await transaction.deleteFrom('external_unit_group_members').where('group_id', '=', id).execute();
        } else {
          saved = await transaction
            .insertInto('external_unit_groups')
            .values(input)
            .returning('id')
            .executeTakeFirstOrThrow();
        }
        if (unitIds.length > 0) {
          await transaction
            .insertInto('external_unit_group_members')
            .values(unitIds.map((unitId) => ({ group_id: saved.id, unit_id: unitId })))
            .execute();
        }
        return saved.id;
      }),
      'Tên nhóm đã có',
      'name',
    );
    return (await this.listGroups()).find((group) => group.id === groupId);
  }

  async deleteGroup(currentUser: CurrentUser, id: string): Promise<void> {
    this.assertAdmin(currentUser);
    const result = await this.system.deleteFrom('external_unit_groups').where('id', '=', id).executeTakeFirst();
    if (result.numDeletedRows === 0n) {
      throw notFoundError('Không tìm thấy nhóm đơn vị', 'external_unit_group');
    }
  }

  // ---- Lãnh đạo nhận văn bản ----

  listLeaders() {
    return this.system.selectFrom('document_leaders').selectAll().orderBy('sort_order').orderBy('user_name').execute();
  }

  async saveLeaders(currentUser: CurrentUser, body: RequestBody) {
    this.assertAdmin(currentUser);
    const raw = body?.leaders;
    if (!Array.isArray(raw) || raw.length > 50) {
      throw validationError([{ field: 'leaders', message: 'Danh sách tối đa 50 lãnh đạo' }]);
    }
    const errors: FieldError[] = [];
    const items = raw.map((item: RequestBody, index) => ({
      user_id: readUuid(item, 'user_id', errors, true) ?? '',
      title: readText(item, 'title', errors, { maximum: 200 }),
      sort_order: index + 1,
    }));
    if (new Set(items.map((item) => item.user_id)).size !== items.length) {
      errors.push({ field: 'leaders', message: 'Mỗi người chỉ có một dòng' });
    }
    throwIfAny(errors);
    const accounts = await this.resolveAccounts(
      items.map((item) => item.user_id),
      'leaders',
    );
    await this.system.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('document_leaders').execute();
      if (items.length > 0) {
        await transaction
          .insertInto('document_leaders')
          .values(
            items.map((item) => {
              const account = accounts.get(item.user_id) as StaffAccount;
              return { ...item, user_name: account.full_name, title: item.title ?? account.job_title_name };
            }),
          )
          .execute();
      }
    });
    return this.listLeaders();
  }

  // ---- Sổ văn bản ----

  async listBooks(direction: DocumentBookDirection, year: number | null) {
    let query = this.system
      .selectFrom('document_books')
      .selectAll('document_books')
      .select((expression) => [
        sql<number>`(select count(*)::int from incoming_documents where book_id = ${expression.ref('document_books.id')})`.as(
          'document_count',
        ),
        sql<number>`greatest(${expression.ref('document_books.start_number')},
          coalesce((select max(arrival_number) + 1 from incoming_documents
            where book_id = ${expression.ref('document_books.id')}), 0))`.as('next_number'),
      ])
      .where('direction', '=', direction);
    if (year) {
      query = query.where('year', '=', year);
    }
    const books = await query.orderBy('year', 'desc').orderBy('sort_order').orderBy('name').execute();
    const members =
      books.length > 0
        ? await this.system
            .selectFrom('document_book_members')
            .selectAll()
            .where(
              'book_id',
              'in',
              books.map((book) => book.id),
            )
            .orderBy('user_name')
            .execute()
        : [];
    const unitIds = [...new Set(books.map((book) => book.org_unit_id).filter((id): id is string => id !== null))];
    const units = new Map<string, string>();
    const current = unitIds.length > 0 ? await this.currentSchoolYear.find() : undefined;
    if (current) {
      for (const unit of await current.database
        .selectFrom('org_units')
        .select(['id', 'name'])
        .where('id', 'in', unitIds)
        .execute()) {
        units.set(unit.id, unit.name);
      }
    }
    return books.map((book) => {
      const of = (role: 'follower' | 'admin') =>
        members.filter((member) => member.book_id === book.id && member.role === role);
      return {
        ...book,
        org_unit_name: book.org_unit_id ? (units.get(book.org_unit_id) ?? null) : null,
        followers: of('follower').map(({ user_id, user_name }) => ({ user_id, user_name })),
        admins: of('admin').map(({ user_id, user_name }) => ({ user_id, user_name })),
      };
    });
  }

  private parseBook(body: RequestBody): BookInput {
    const errors: FieldError[] = [];
    const direction = (body?.direction ?? 'incoming') as DocumentBookDirection;
    if (direction !== 'incoming' && direction !== 'outgoing') {
      errors.push({ field: 'direction', message: 'Chiều sổ không hợp lệ' });
    }
    const input: BookInput = {
      direction,
      name: readText(body, 'name', errors, { required: true, maximum: 200 }) ?? '',
      org_unit_id: readUuid(body, 'org_unit_id', errors),
      year: readInteger(body, 'year', errors, { min: 2000, max: 2100 }) ?? 0,
      start_number: readInteger(body, 'start_number', errors, { min: 1, max: 9_999_999 }, 1) ?? 1,
      start_date: readDate(body, 'start_date', errors, true) ?? '',
      end_date: readDate(body, 'end_date', errors),
      sort_order: readInteger(body, 'sort_order', errors, { min: 0, max: 9999 }, 0) ?? 0,
      follower_ids: readUuidList(body, 'follower_ids', errors, 100),
      admin_ids: readUuidList(body, 'admin_ids', errors, 100),
    };
    if (!input.year && !errors.some((error) => error.field === 'year')) {
      errors.push({ field: 'year', message: 'Bắt buộc nhập' });
    }
    if (input.end_date && input.start_date && input.end_date < input.start_date) {
      errors.push({ field: 'end_date', message: 'Ngày kết thúc không trước ngày áp dụng' });
    }
    throwIfAny(errors);
    return input;
  }

  async saveBook(currentUser: CurrentUser, id: string | null, body: RequestBody) {
    this.assertAdmin(currentUser);
    const { follower_ids: followerIds, admin_ids: adminIds, ...input } = this.parseBook(body);
    if (input.org_unit_id) {
      const current = await this.currentSchoolYear.require();
      const unit = await current.database
        .selectFrom('org_units')
        .select('id')
        .where('id', '=', input.org_unit_id)
        .executeTakeFirst();
      if (!unit) {
        throw validationError([{ field: 'org_unit_id', message: 'Không tìm thấy đơn vị' }]);
      }
    }
    const accounts = await this.resolveAccounts([...new Set([...followerIds, ...adminIds])], 'follower_ids');
    const bookId = await conflictOnDuplicate(
      this.system.transaction().execute(async (transaction) => {
        let saved: { id: string } | undefined;
        if (id) {
          const before = await transaction
            .selectFrom('document_books')
            .select(['direction', 'start_number'])
            .where('id', '=', id)
            .forUpdate()
            .executeTakeFirst();
          if (!before) {
            throw notFoundError('Không tìm thấy sổ văn bản', 'document_book');
          }
          if (before.direction !== input.direction) {
            throw ruleViolationError(INCOMING_RULE_CODE, 'Không đổi chiều đến, đi của sổ đã tạo');
          }
          saved = await transaction
            .updateTable('document_books')
            .set({ ...input, updated_at: new Date() })
            .where('id', '=', id)
            .returning('id')
            .executeTakeFirstOrThrow();
          await transaction.deleteFrom('document_book_members').where('book_id', '=', id).execute();
        } else {
          saved = await transaction.insertInto('document_books').values(input).returning('id').executeTakeFirstOrThrow();
        }
        const rows = [
          ...followerIds.map((userId) => ({ user_id: userId, role: 'follower' as const })),
          ...adminIds.map((userId) => ({ user_id: userId, role: 'admin' as const })),
        ];
        if (rows.length > 0) {
          await transaction
            .insertInto('document_book_members')
            .values(
              rows.map((row) => ({
                ...row,
                book_id: saved.id,
                user_name: (accounts.get(row.user_id) as StaffAccount).full_name,
              })),
            )
            .execute();
        }
        return saved.id;
      }),
      'Tên sổ đã có trong năm',
      'name',
    );
    return (await this.listBooks(input.direction, null)).find((book) => book.id === bookId);
  }

  async deleteBook(currentUser: CurrentUser, id: string): Promise<void> {
    this.assertAdmin(currentUser);
    const used = await this.system
      .selectFrom('incoming_documents')
      .select('id')
      .where('book_id', '=', id)
      .limit(1)
      .executeTakeFirst();
    if (used) {
      throw ruleViolationError(INCOMING_RULE_CODE, 'Sổ đã có văn bản vào sổ, không xóa được');
    }
    const result = await this.system.deleteFrom('document_books').where('id', '=', id).executeTakeFirst();
    if (result.numDeletedRows === 0n) {
      throw notFoundError('Không tìm thấy sổ văn bản', 'document_book');
    }
  }
}

const readKind = (value: unknown): DocumentCatalogKind | null => {
  if (value === undefined || value === '') {
    return null;
  }
  if (!CATALOG_KINDS.includes(value as DocumentCatalogKind)) {
    throw validationError([{ field: 'kind', message: 'Loại danh mục không hợp lệ' }]);
  }
  return value as DocumentCatalogKind;
};

const readYear = (value: unknown): number | null => {
  if (value === undefined || value === '') {
    return null;
  }
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw validationError([{ field: 'year', message: 'Năm không hợp lệ' }]);
  }
  return year;
};

// Điểm cuối của Quản trị văn bản. Đọc danh mục, đơn vị, nhóm, lãnh đạo, sổ: người có một quyền của phân hệ; ghi: quyền quản
// trị văn bản (dịch vụ kiểm tra thêm phạm vi toàn trường)
@Controller()
export class DocumentAdminController {
  constructor(private readonly admin: DocumentAdminService) {}

  @Get('document-catalogs')
  @RequirePermission(...INCOMING_PERMISSIONS)
  listCatalog(@Query('kind') kind: string | undefined) {
    return this.admin.listCatalog(readKind(kind));
  }

  @Post('document-catalogs')
  @RequirePermission(ADMIN)
  createCatalog(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.admin.createCatalog(currentUser, body);
  }

  @Put('document-catalogs/:id')
  @RequirePermission(ADMIN)
  updateCatalog(
    @Param('id', uuidParameter(ID_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.admin.updateCatalog(currentUser, id, body);
  }

  @Delete('document-catalogs/:id')
  @HttpCode(204)
  @RequirePermission(ADMIN)
  async deleteCatalog(@Param('id', uuidParameter(ID_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    await this.admin.deleteCatalog(currentUser, id);
  }

  @Get('external-units')
  @RequirePermission(...INCOMING_PERMISSIONS)
  listUnits(@Query('q') search: string | undefined, @Query('active') active: string | undefined) {
    return this.admin.listUnits(search?.trim() || null, active === 'true');
  }

  @Post('external-units')
  @RequirePermission(ADMIN)
  createUnit(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.admin.createUnit(currentUser, body);
  }

  @Put('external-units/:id')
  @RequirePermission(ADMIN)
  updateUnit(
    @Param('id', uuidParameter(ID_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.admin.updateUnit(currentUser, id, body);
  }

  @Delete('external-units/:id')
  @HttpCode(204)
  @RequirePermission(ADMIN)
  async deleteUnit(@Param('id', uuidParameter(ID_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    await this.admin.deleteUnit(currentUser, id);
  }

  @Get('external-unit-groups')
  @RequirePermission(...INCOMING_PERMISSIONS)
  listGroups() {
    return this.admin.listGroups();
  }

  @Post('external-unit-groups')
  @RequirePermission(ADMIN)
  createGroup(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.admin.saveGroup(currentUser, null, body);
  }

  @Put('external-unit-groups/:id')
  @RequirePermission(ADMIN)
  updateGroup(
    @Param('id', uuidParameter(ID_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.admin.saveGroup(currentUser, id, body);
  }

  @Delete('external-unit-groups/:id')
  @HttpCode(204)
  @RequirePermission(ADMIN)
  async deleteGroup(@Param('id', uuidParameter(ID_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    await this.admin.deleteGroup(currentUser, id);
  }

  @Get('document-leaders')
  @RequirePermission(...INCOMING_PERMISSIONS)
  listLeaders() {
    return this.admin.listLeaders();
  }

  @Put('document-leaders')
  @RequirePermission(ADMIN)
  saveLeaders(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.admin.saveLeaders(currentUser, body);
  }

  @Get('document-staff')
  @RequirePermission(...INCOMING_PERMISSIONS)
  staff() {
    return this.admin.staffAccounts();
  }

  @Get('document-books')
  @RequirePermission(...INCOMING_PERMISSIONS)
  listBooks(@Query('direction') direction: string | undefined, @Query('year') year: string | undefined) {
    if (direction !== undefined && direction !== 'incoming' && direction !== 'outgoing') {
      throw validationError([{ field: 'direction', message: 'Chiều sổ không hợp lệ' }]);
    }
    return this.admin.listBooks((direction ?? 'incoming') as DocumentBookDirection, readYear(year));
  }

  @Post('document-books')
  @RequirePermission(ADMIN)
  createBook(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.admin.saveBook(currentUser, null, body);
  }

  @Put('document-books/:id')
  @RequirePermission(ADMIN)
  updateBook(
    @Param('id', uuidParameter(ID_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.admin.saveBook(currentUser, id, body);
  }

  @Delete('document-books/:id')
  @HttpCode(204)
  @RequirePermission(ADMIN)
  async deleteBook(@Param('id', uuidParameter(ID_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    await this.admin.deleteBook(currentUser, id);
  }
}
