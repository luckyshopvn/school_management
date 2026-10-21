import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type {
  FoodCertificateType,
  FoodLotCategory,
  FoodLotStatus,
  FoodStorageCondition,
  SchoolYearDatabase,
} from '@school-management/database';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import {
  FOOD_CERTIFICATE_TYPES,
  FOOD_LOT_CATEGORIES,
  FOOD_LOT_STATUSES,
  FOOD_STORAGE_CONDITIONS,
  foodCertificateValidity,
  type FoodCertificateValidity,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { randomUUID } from 'node:crypto';
import { detectArchiveFileType } from '../archives/archives.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError, readOptionalUuid, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { storageKey } from '../common/resource-names.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { FileStorage } from '../files/file-storage.js';
import { MAXIMUM_FILE_BYTES } from '../files/files.js';
import { lotExpiryState, readClockTime } from './food-safety-calc.js';
import { KitchenAccess } from './kitchen-access.js';
import { check, queryDate, queryUuid, readDate, readQuantity, readText } from './kitchen-fields.js';

// Hồ sơ an toàn thực phẩm của nhà cung cấp và lô hàng nhập (DT-18 phần 22b, YCTD-146; BR-144, BR-145). Bếp (P12.kitchen.manage)
// ghi giấy tờ của nhà cung cấp kèm hạn hiệu lực và tệp quét; giấy sắp hết hạn trong 30 ngày được cảnh báo ở danh sách, ở Việc
// của tôi và khi lập phiếu đi chợ. Lô hàng tạo khi xác nhận nhập phiếu đi chợ (mỗi dòng một lô) hoặc nhập tay (hàng giao theo
// hợp đồng, tài trợ); lô chờ kiểm tra trước khi chế biến (bước 1), đạt thì dùng được cho món, không đạt thì ghi cách xử lý
interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

interface LotInput {
  ingredient_id: string;
  supplier_id: string;
  food_category: FoodLotCategory;
  received_date: string;
  received_time: string | null;
  quantity: number;
  deliverer_name: string | null;
  manufacturer: string | null;
  manufacturer_address: string | null;
  lot_number: string | null;
  production_date: string | null;
  expiry_date: string | null;
  storage_condition: FoodStorageCondition | null;
  document_number: string | null;
  document_file_id: string | null;
  veterinary_certificate: string | null;
  quarantine_certificate: string | null;
  note: string | null;
}

type LotChanges = Partial<Omit<LotInput, 'ingredient_id' | 'supplier_id' | 'quantity'>> & { quantity?: number };

// Phân loại nhóm thực phẩm của lô theo tên nguyên liệu khi tạo từ phiếu đi chợ; bếp sửa lại được
const DRY_HINTS = [
  'gạo',
  'bột',
  'đường',
  'muối',
  'dầu',
  'nước mắm',
  'sữa',
  'mì',
  'miến',
  'bún khô',
  'hạt',
  'đậu',
  'gia vị',
];

export function guessFoodCategory(name: string): FoodLotCategory {
  const lower = name.toLowerCase();
  return DRY_HINTS.some((hint) => lower.includes(hint)) ? 'dry' : 'fresh';
}

// Tạo lô cho từng dòng của phiếu đi chợ khi xác nhận nhập (gọi trong giao dịch của phiếu)
export async function createLotsForPurchase(
  transaction: Transaction<SchoolYearDatabase>,
  purchase: { id: string; org_unit_id: string; supplier_id: string; purchase_date: string },
  actorUserId: string,
  receivedAt: Date,
): Promise<string[]> {
  const items = await transaction
    .selectFrom('market_purchase_items')
    .innerJoin('ingredients', 'ingredients.id', 'market_purchase_items.ingredient_id')
    .select(['market_purchase_items.id', 'market_purchase_items.ingredient_id', 'market_purchase_items.quantity'])
    .select('ingredients.name')
    .where('market_purchase_items.purchase_id', '=', purchase.id)
    .orderBy('ingredients.name')
    .execute();
  const local = new Date(receivedAt.getTime() + 7 * 3_600_000).toISOString();
  const codes: string[] = [];
  for (const item of items) {
    const code = await nextDocumentCode(transaction, 'food_lot', 'LH');
    await transaction
      .insertInto('food_lots')
      .values({
        code,
        org_unit_id: purchase.org_unit_id,
        ingredient_id: item.ingredient_id,
        supplier_id: purchase.supplier_id,
        purchase_item_id: item.id,
        food_category: guessFoodCategory(item.name),
        received_date: local.slice(0, 10) < purchase.purchase_date ? purchase.purchase_date : local.slice(0, 10),
        received_time: local.slice(11, 16),
        quantity: item.quantity,
        created_by: actorUserId,
      })
      .execute();
    codes.push(code);
  }
  return codes;
}

// Giấy chứng nhận cơ sở đủ điều kiện an toàn thực phẩm còn hiệu lực của nhà cung cấp vào ngày (BR-144)
export async function supplierCertificateWarning(
  database: Kysely<SchoolYearDatabase>,
  supplierId: string,
  date: string,
): Promise<string | null> {
  const rows = await database
    .selectFrom('food_supplier_certificates')
    .select(['status', 'expires_on', 'issued_on'])
    .where('supplier_id', '=', supplierId)
    .where('certificate_type', '=', 'food_safety')
    .execute();
  const valid = rows.some(
    (row) =>
      (row.issued_on === null || row.issued_on <= date) &&
      foodCertificateValidity(row, date) !== 'expired' &&
      row.status === 'active',
  );
  return valid ? null : 'Nhà cung cấp chưa có giấy chứng nhận cơ sở đủ điều kiện an toàn thực phẩm còn hiệu lực';
}

function lotQuery(database: Kysely<SchoolYearDatabase>) {
  return database
    .selectFrom('food_lots')
    .innerJoin('ingredients', 'ingredients.id', 'food_lots.ingredient_id')
    .innerJoin('food_suppliers', 'food_suppliers.id', 'food_lots.supplier_id')
    .leftJoin('market_purchase_items', 'market_purchase_items.id', 'food_lots.purchase_item_id')
    .leftJoin('market_purchases', 'market_purchases.id', 'market_purchase_items.purchase_id')
    .leftJoin('food_safety_files', 'food_safety_files.id', 'food_lots.document_file_id')
    .selectAll('food_lots')
    .select([
      'ingredients.name as ingredient_name',
      'ingredients.code as ingredient_code',
      'ingredients.unit',
      'food_suppliers.name as supplier_name',
      'food_suppliers.address as supplier_address',
      'food_suppliers.phone as supplier_phone',
      'market_purchases.id as purchase_id',
      'market_purchases.code as purchase_code',
      'food_safety_files.file_name as document_file_name',
    ]);
}

function readEnum<T extends string>(
  body: RequestBody,
  field: string,
  values: ReadonlyArray<{ value: string }>,
  errors: FieldError[],
  required: boolean,
): T | null | undefined {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc chọn' });
    }
    return value === undefined ? undefined : null;
  }
  if (typeof value !== 'string' || !values.some((item) => item.value === value)) {
    errors.push({ field, message: 'Giá trị không hợp lệ' });
    return undefined;
  }
  return value as T;
}

@Injectable()
export class FoodSafetyRecordsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: KitchenAccess,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // Tệp quét giấy chứng nhận, chứng từ giao hàng: PDF hoặc ảnh, tối đa 10 MB
  async uploadFile(currentUser: CurrentUser, orgUnitId: string, file: { fileName: string; body: Buffer }) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertManage(currentUser, orgUnitId);
    if (file.body.length === 0 || file.body.length > MAXIMUM_FILE_BYTES) {
      throw validationError([{ field: 'file', message: 'Tệp tối đa 10 MB' }]);
    }
    const contentType = detectArchiveFileType(file.fileName, file.body);
    if (!contentType || !['application/pdf', 'image/jpeg', 'image/png'].includes(contentType)) {
      throw validationError([{ field: 'file', message: 'Tệp là PDF hoặc ảnh JPEG, PNG' }]);
    }
    const key = storageKey('food-safety', orgUnitId, randomUUID());
    await this.fileStorage.put(key, file.body, contentType);
    return database
      .insertInto('food_safety_files')
      .values({
        org_unit_id: orgUnitId,
        file_name: file.fileName.slice(0, 200),
        content_type: contentType,
        size_bytes: file.body.length,
        storage_key: key,
        created_by: currentUser.id,
      })
      .returning(['id', 'org_unit_id', 'file_name', 'content_type', 'size_bytes'])
      .executeTakeFirstOrThrow();
  }

  async downloadFile(currentUser: CurrentUser, id: string) {
    const { database } = await this.currentSchoolYear.require();
    const file = await database.selectFrom('food_safety_files').selectAll().where('id', '=', id).executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp', 'food_safety_file');
    }
    await this.access.assertRead(currentUser, file.org_unit_id);
    return { file, body: await this.fileStorage.get(file.storage_key) };
  }

  private async assertFile(database: Kysely<SchoolYearDatabase>, fileId: string | null | undefined, orgUnitId: string) {
    if (!fileId) {
      return;
    }
    const file = await database
      .selectFrom('food_safety_files')
      .select('org_unit_id')
      .where('id', '=', fileId)
      .executeTakeFirst();
    if (!file || file.org_unit_id !== orgUnitId) {
      throw validationError([{ field: 'file_id', message: 'Tệp phải tải lên cho đơn vị này' }]);
    }
  }

  private async supplierOf(database: Kysely<SchoolYearDatabase>, supplierId: string) {
    const supplier = await database
      .selectFrom('food_suppliers')
      .select(['id', 'org_unit_id', 'name', 'status'])
      .where('id', '=', supplierId)
      .executeTakeFirst();
    if (!supplier) {
      throw notFoundError('Không tìm thấy nhà cung cấp', 'food_supplier');
    }
    return supplier;
  }

  // Giấy tờ của nhà cung cấp thuộc đơn vị, kèm hiệu lực tại ngày xem và số ngày còn lại
  async certificates(
    currentUser: CurrentUser,
    filter: { orgUnitId: string; supplierId: string | null; validity: FoodCertificateValidity | null },
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, filter.orgUnitId);
    const rows = await database
      .selectFrom('food_supplier_certificates')
      .innerJoin('food_suppliers', 'food_suppliers.id', 'food_supplier_certificates.supplier_id')
      .leftJoin('food_safety_files', 'food_safety_files.id', 'food_supplier_certificates.file_id')
      .selectAll('food_supplier_certificates')
      .select(['food_suppliers.name as supplier_name', 'food_safety_files.file_name'])
      .where('food_suppliers.org_unit_id', '=', filter.orgUnitId)
      .$if(filter.supplierId !== null, (query) =>
        query.where('food_supplier_certificates.supplier_id', '=', filter.supplierId ?? ''),
      )
      .orderBy('food_suppliers.name')
      .orderBy('food_supplier_certificates.expires_on')
      .execute();
    const today = this.today();
    return rows
      .map((row) => this.withValidity(row, today))
      .filter((row) => filter.validity === null || row.validity === filter.validity);
  }

  private withValidity<Row extends { status: 'active' | 'revoked'; expires_on: string | null }>(
    row: Row,
    today: string,
  ) {
    return {
      ...row,
      validity: foodCertificateValidity(row, today),
      days_left:
        row.expires_on === null
          ? null
          : Math.round((Date.parse(`${row.expires_on}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000),
    };
  }

  // Tổng hợp theo nhà cung cấp: có giấy chứng nhận an toàn thực phẩm còn hiệu lực hay không, số giấy sắp hết hạn, hết hạn
  async supplierSummary(currentUser: CurrentUser, orgUnitId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, orgUnitId);
    const suppliers = await database
      .selectFrom('food_suppliers')
      .select(['id', 'name', 'food_groups', 'phone', 'address', 'status'])
      .where('org_unit_id', '=', orgUnitId)
      .orderBy('name')
      .execute();
    const certificates = await this.certificates(currentUser, { orgUnitId, supplierId: null, validity: null });
    return suppliers.map((supplier) => {
      const own = certificates.filter((row) => row.supplier_id === supplier.id);
      const foodSafety = own.filter((row) => row.certificate_type === 'food_safety');
      return {
        ...supplier,
        certificate_count: own.length,
        has_valid_food_safety: foodSafety.some((row) => row.validity === 'valid' || row.validity === 'expiring'),
        expiring_count: own.filter((row) => row.validity === 'expiring').length,
        expired_count: own.filter((row) => row.validity === 'expired').length,
        nearest_expiry:
          own
            .filter((row) => row.status === 'active' && row.expires_on !== null)
            .map((row) => row.expires_on as string)
            .sort()[0] ?? null,
      };
    });
  }

  async createCertificate(
    currentUser: CurrentUser,
    input: {
      supplier_id: string;
      certificate_type: FoodCertificateType;
      number: string;
      issued_by: string | null;
      issued_on: string | null;
      expires_on: string | null;
      scope_note: string | null;
      file_id: string | null;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const supplier = await this.supplierOf(database, input.supplier_id);
    await this.access.assertManage(currentUser, supplier.org_unit_id);
    await this.assertFile(database, input.file_id, supplier.org_unit_id);
    assertCertificateDates(input.issued_on, input.expires_on);
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('food_supplier_certificates')
        .values({ ...input, created_by: origin.actorUserId })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: supplier.org_unit_id,
        entityName: 'food_supplier_certificates',
        entityId: row.id,
        action: 'create',
        before: null,
        after: row,
      });
      return row;
    });
    return this.withValidity({ ...created, supplier_name: supplier.name }, this.today());
  }

  async updateCertificate(
    currentUser: CurrentUser,
    id: string,
    changes: Partial<{
      certificate_type: FoodCertificateType;
      number: string;
      issued_by: string | null;
      issued_on: string | null;
      expires_on: string | null;
      scope_note: string | null;
      file_id: string | null;
      status: 'active' | 'revoked';
    }>,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const before = await database
      .selectFrom('food_supplier_certificates')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy giấy tờ', 'food_supplier_certificate');
    }
    const supplier = await this.supplierOf(database, before.supplier_id);
    await this.access.assertManage(currentUser, supplier.org_unit_id);
    await this.assertFile(database, changes.file_id, supplier.org_unit_id);
    assertCertificateDates(
      changes.issued_on === undefined ? before.issued_on : changes.issued_on,
      changes.expires_on === undefined ? before.expires_on : changes.expires_on,
    );
    const after = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .updateTable('food_supplier_certificates')
        .set({ ...changes, updated_at: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: supplier.org_unit_id,
        entityName: 'food_supplier_certificates',
        entityId: id,
        action: 'update',
        before,
        after: row,
      });
      return row;
    });
    return this.withValidity({ ...after, supplier_name: supplier.name }, this.today());
  }

  // Danh sách lô của đơn vị theo khoảng ngày nhập, trạng thái, nguyên liệu; lọc lô sắp hết hạn hoặc đã hết hạn còn trong bếp
  async lots(
    currentUser: CurrentUser,
    filter: {
      orgUnitId: string;
      from: string | null;
      to: string | null;
      status: FoodLotStatus | null;
      ingredientId: string | null;
      expiry: 'expiring' | 'expired' | null;
    },
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, filter.orgUnitId);
    const rows = await lotQuery(database)
      .where('food_lots.org_unit_id', '=', filter.orgUnitId)
      .$if(filter.from !== null, (query) => query.where('food_lots.received_date', '>=', filter.from ?? ''))
      .$if(filter.to !== null, (query) => query.where('food_lots.received_date', '<=', filter.to ?? ''))
      .$if(filter.status !== null, (query) => query.where('food_lots.status', '=', filter.status ?? 'pending'))
      .$if(filter.ingredientId !== null, (query) =>
        query.where('food_lots.ingredient_id', '=', filter.ingredientId ?? ''),
      )
      .orderBy('food_lots.received_date', 'desc')
      .orderBy('food_lots.code', 'desc')
      .execute();
    const today = this.today();
    return rows
      .map((row) => this.lotView(row, today))
      .filter(
        (row) =>
          filter.expiry === null ||
          (['pending', 'accepted'].includes(row.status) && row.expiry_state === filter.expiry),
      );
  }

  // Lô theo mã kèm tên nguyên liệu, nhà cung cấp, phiếu đi chợ, tệp chứng từ
  async lotsByIds(database: Kysely<SchoolYearDatabase>, ids: string[]) {
    return ids.length === 0 ? [] : lotQuery(database).where('food_lots.id', 'in', ids).execute();
  }

  lotView<Row extends { quantity: string; expiry_date: string | null }>(row: Row, today: string) {
    return { ...row, quantity: Number(row.quantity), expiry_state: lotExpiryState(row.expiry_date, today) };
  }

  async lot(currentUser: CurrentUser, id: string) {
    const { database } = await this.currentSchoolYear.require();
    const row = await lotQuery(database).where('food_lots.id', '=', id).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy lô hàng', 'food_lot');
    }
    await this.access.assertRead(currentUser, row.org_unit_id);
    // Món đã dùng lô (bước 2) để truy xuất ngược khi thu hồi lô
    const usage = await database
      .selectFrom('food_inspection_line_lots')
      .innerJoin('food_inspection_lines', 'food_inspection_lines.id', 'food_inspection_line_lots.line_id')
      .innerJoin('food_inspections', 'food_inspections.id', 'food_inspection_lines.inspection_id')
      .select([
        'food_inspections.inspection_date',
        'food_inspection_lines.meal_type',
        'food_inspection_lines.dish_name',
        'food_inspection_lines.servings',
      ])
      .where('food_inspection_line_lots.lot_id', '=', id)
      .orderBy('food_inspections.inspection_date')
      .execute();
    const firstStep = await database
      .selectFrom('food_inspection_lines')
      .innerJoin('food_inspections', 'food_inspections.id', 'food_inspection_lines.inspection_id')
      .select([
        'food_inspections.id as inspection_id',
        'food_inspections.inspection_date',
        'food_inspections.status as inspection_status',
        'food_inspections.inspector_name',
        'food_inspection_lines.sensory_result',
        'food_inspection_lines.rapid_test_result',
        'food_inspection_lines.action',
      ])
      .where('food_inspection_lines.lot_id', '=', id)
      .executeTakeFirst();
    return { ...this.lotView(row, this.today()), inspection: firstStep ?? null, usage };
  }

  async createLot(currentUser: CurrentUser, orgUnitId: string, input: LotInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertManage(currentUser, orgUnitId);
    const supplier = await this.supplierOf(database, input.supplier_id);
    const ingredient = await database
      .selectFrom('ingredients')
      .select(['org_unit_id', 'status'])
      .where('id', '=', input.ingredient_id)
      .executeTakeFirst();
    const errors: FieldError[] = [];
    if (supplier.org_unit_id !== orgUnitId || supplier.status !== 'active') {
      errors.push({ field: 'supplier_id', message: 'Nhà cung cấp phải thuộc đơn vị và đang dùng' });
    }
    if (!ingredient || ingredient.org_unit_id !== orgUnitId || ingredient.status !== 'active') {
      errors.push({ field: 'ingredient_id', message: 'Nguyên liệu phải thuộc đơn vị và đang dùng' });
    }
    check(errors);
    await this.assertFile(database, input.document_file_id, orgUnitId);
    assertLotDates(input.received_date, input.production_date, input.expiry_date);
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('food_lots')
        .values({
          ...input,
          code: await nextDocumentCode(transaction, 'food_lot', 'LH'),
          org_unit_id: orgUnitId,
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'food_lots',
        entityId: row.id,
        action: 'create',
        before: null,
        after: row,
      });
      return row;
    });
    return this.lot(currentUser, created.id);
  }

  // Lô chờ kiểm tra sửa được mọi thông tin; lô đã kiểm tra chỉ sửa chứng từ, tệp, ghi chú (giữ đúng điều đã kiểm tra)
  async updateLot(currentUser: CurrentUser, id: string, changes: LotChanges, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const before = await database.selectFrom('food_lots').selectAll().where('id', '=', id).executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy lô hàng', 'food_lot');
    }
    await this.access.assertManage(currentUser, before.org_unit_id);
    const documentOnly = ['document_number', 'document_file_id', 'note'];
    if (before.status !== 'pending' && Object.keys(changes).some((key) => !documentOnly.includes(key))) {
      throw ruleViolationError('BR-145', 'Lô đã kiểm tra chỉ sửa được số chứng từ, tệp chứng từ và ghi chú');
    }
    if (before.purchase_item_id !== null && changes.quantity !== undefined) {
      throw ruleViolationError('BR-145', 'Khối lượng của lô tạo từ phiếu đi chợ theo phiếu, không sửa ở lô');
    }
    await this.assertFile(database, changes.document_file_id, before.org_unit_id);
    assertLotDates(
      changes.received_date ?? before.received_date,
      changes.production_date === undefined ? before.production_date : changes.production_date,
      changes.expiry_date === undefined ? before.expiry_date : changes.expiry_date,
    );
    await database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('food_lots')
        .set({ ...changes, updated_at: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'food_lots',
        entityId: id,
        action: 'update',
        before,
        after,
      });
    });
    return this.lot(currentUser, id);
  }

  // Đóng lô đã đạt: dùng hết, hoặc hủy (hết hạn, hư hỏng trong kho) kèm lý do (xử lý thực phẩm không đạt sau khi nhận)
  async closeLot(
    currentUser: CurrentUser,
    id: string,
    input: { status: 'used_up' | 'disposed'; handling_note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const before = await database.selectFrom('food_lots').selectAll().where('id', '=', id).executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy lô hàng', 'food_lot');
    }
    await this.access.assertManage(currentUser, before.org_unit_id);
    if (before.status !== 'accepted') {
      throw ruleViolationError('BR-145', 'Chỉ đóng được lô đã đạt kiểm tra');
    }
    if (input.status === 'disposed' && !input.handling_note) {
      throw validationError([{ field: 'handling_note', message: 'Hủy lô thì ghi lý do và cách hủy' }]);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('food_lots')
        .set({
          status: input.status,
          handling_note: input.handling_note,
          closed_by: origin.actorUserId,
          closed_at: new Date(),
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'food_lots',
        entityId: id,
        action: 'update',
        before: { status: before.status },
        after: input,
      });
    });
    return this.lot(currentUser, id);
  }
}

function assertCertificateDates(issuedOn: string | null, expiresOn: string | null) {
  if (issuedOn && expiresOn && expiresOn < issuedOn) {
    throw validationError([{ field: 'expires_on', message: 'Ngày hết hạn không trước ngày cấp' }]);
  }
}

// BR-145: hạn dùng không trước ngày sản xuất; nhập lô đã hết hạn dùng vào ngày nhập thì từ chối
function assertLotDates(receivedDate: string, productionDate: string | null, expiryDate: string | null) {
  const errors: FieldError[] = [];
  if (productionDate && productionDate > receivedDate) {
    errors.push({ field: 'production_date', message: 'Ngày sản xuất không sau ngày nhập' });
  }
  if (expiryDate && productionDate && expiryDate < productionDate) {
    errors.push({ field: 'expiry_date', message: 'Hạn dùng không trước ngày sản xuất' });
  }
  if (expiryDate && expiryDate < receivedDate) {
    errors.push({ field: 'expiry_date', message: 'Thực phẩm đã hết hạn dùng vào ngày nhập' });
  }
  check(errors);
}

function readCertificate(body: RequestBody, errors: FieldError[], partial: boolean) {
  const has = (field: string) => !partial || (body !== undefined && field in body);
  const values: Record<string, unknown> = {};
  if (has('certificate_type')) {
    values.certificate_type = readEnum<FoodCertificateType>(
      body,
      'certificate_type',
      FOOD_CERTIFICATE_TYPES,
      errors,
      true,
    );
  }
  if (has('number')) {
    values.number = readText(body, 'number', errors, true);
  }
  for (const field of ['issued_by', 'scope_note']) {
    if (has(field)) {
      values[field] = readText(body, field, errors);
    }
  }
  for (const field of ['issued_on', 'expires_on']) {
    if (has(field)) {
      values[field] = readDate(body, field, errors, false);
    }
  }
  if (has('file_id')) {
    values.file_id = readOptionalUuid(body, 'file_id', errors) ?? null;
  }
  if (partial && body !== undefined && 'status' in body) {
    if (body.status !== 'active' && body.status !== 'revoked') {
      errors.push({ field: 'status', message: 'Trạng thái là active hoặc revoked' });
    } else {
      values.status = body.status;
    }
  }
  return values;
}

function readLotFields(body: RequestBody, errors: FieldError[], partial: boolean): Record<string, unknown> {
  const has = (field: string) => !partial || (body !== undefined && field in body);
  const values: Record<string, unknown> = {};
  if (has('food_category')) {
    values.food_category =
      readEnum<FoodLotCategory>(body, 'food_category', FOOD_LOT_CATEGORIES, errors, false) ?? 'fresh';
  }
  if (has('received_date')) {
    values.received_date = readDate(body, 'received_date', errors, true);
  }
  if (has('received_time')) {
    values.received_time = readClockTime(body?.received_time, 'received_time', errors);
  }
  if (has('quantity')) {
    values.quantity = readQuantity(body?.quantity, 'quantity', errors);
  }
  for (const field of [
    'deliverer_name',
    'manufacturer',
    'manufacturer_address',
    'lot_number',
    'document_number',
    'veterinary_certificate',
    'quarantine_certificate',
    'note',
  ]) {
    if (has(field)) {
      values[field] = readText(body, field, errors);
    }
  }
  for (const field of ['production_date', 'expiry_date']) {
    if (has(field)) {
      values[field] = readDate(body, field, errors, false);
    }
  }
  if (has('storage_condition')) {
    values.storage_condition =
      readEnum<FoodStorageCondition>(body, 'storage_condition', FOOD_STORAGE_CONDITIONS, errors, false) ?? null;
  }
  if (has('document_file_id')) {
    values.document_file_id = readOptionalUuid(body, 'document_file_id', errors) ?? null;
  }
  return values;
}

@Controller()
export class FoodSafetyRecordsController {
  constructor(private readonly records: FoodSafetyRecordsService) {}

  @Post('food-safety/files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_FILE_BYTES, files: 1 } }))
  uploadFile(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    if (!file || file.size === 0) {
      errors.push({ field: 'file', message: 'Bắt buộc chọn tệp' });
    }
    check(errors);
    return this.records.uploadFile(currentUser, orgUnitId, {
      fileName: Buffer.from(file?.originalname ?? '', 'latin1').toString('utf8'),
      body: file?.buffer ?? Buffer.alloc(0),
    });
  }

  @Get('food-safety/files/:id')
  async downloadFile(
    @Param('id', uuidParameter('Mã tệp không hợp lệ')) id: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { file, body } = await this.records.downloadFile(currentUser, id);
    response.setHeader('content-type', file.content_type);
    response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
    response.setHeader('cache-control', 'no-store');
    response.send(body);
  }

  @Get('food-supplier-certificates')
  certificates(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    const validity = query.validity as FoodCertificateValidity | undefined;
    if (validity !== undefined && !['valid', 'expiring', 'expired', 'revoked'].includes(validity)) {
      throw validationError([{ field: 'validity', message: 'Hiệu lực là valid, expiring, expired hoặc revoked' }]);
    }
    return this.records.certificates(currentUser, {
      orgUnitId: queryUuid(query.org_unit_id, 'org_unit_id', true) ?? '',
      supplierId: queryUuid(query.supplier_id, 'supplier_id'),
      validity: validity ?? null,
    });
  }

  @Get('food-suppliers/safety-summary')
  supplierSummary(@Query('org_unit_id') orgUnitId: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.supplierSummary(currentUser, queryUuid(orgUnitId, 'org_unit_id', true) ?? '');
  }

  @Post('food-supplier-certificates')
  @HttpCode(201)
  createCertificate(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const supplierId = readRequiredUuid(body, 'supplier_id', errors, 'Bắt buộc chọn nhà cung cấp');
    const values = readCertificate(body, errors, false);
    check(errors);
    return this.records.createCertificate(
      currentUser,
      {
        ...(values as Omit<Parameters<FoodSafetyRecordsService['createCertificate']>[1], 'supplier_id'>),
        supplier_id: supplierId,
      },
      originOf(request, currentUser),
    );
  }

  @Patch('food-supplier-certificates/:id')
  updateCertificate(
    @Param('id', uuidParameter('Mã giấy tờ không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const values = readCertificate(body, errors, true);
    check(errors);
    return this.records.updateCertificate(currentUser, id, values, originOf(request, currentUser));
  }

  @Get('food-lots')
  lots(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    const status = query.status as FoodLotStatus | undefined;
    if (status !== undefined && !FOOD_LOT_STATUSES.some((item) => item.value === status)) {
      throw validationError([{ field: 'status', message: 'Trạng thái không hợp lệ' }]);
    }
    const expiry = query.expiry as 'expiring' | 'expired' | undefined;
    if (expiry !== undefined && expiry !== 'expiring' && expiry !== 'expired') {
      throw validationError([{ field: 'expiry', message: 'Hạn dùng là expiring hoặc expired' }]);
    }
    return this.records.lots(currentUser, {
      orgUnitId: queryUuid(query.org_unit_id, 'org_unit_id', true) ?? '',
      from: queryDate(query.from, 'from'),
      to: queryDate(query.to, 'to'),
      status: status ?? null,
      ingredientId: queryUuid(query.ingredient_id, 'ingredient_id'),
      expiry: expiry ?? null,
    });
  }

  @Get('food-lots/:id')
  lot(
    @Param('id', uuidParameter('Mã lô hàng không hợp lệ')) id: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.lot(currentUser, id);
  }

  @Post('food-lots')
  @HttpCode(201)
  createLot(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const ingredientId = readRequiredUuid(body, 'ingredient_id', errors, 'Bắt buộc chọn nguyên liệu');
    const supplierId = readRequiredUuid(body, 'supplier_id', errors, 'Bắt buộc chọn nhà cung cấp');
    const values = readLotFields(body, errors, false);
    check(errors);
    return this.records.createLot(
      currentUser,
      orgUnitId,
      {
        ...(values as Omit<LotInput, 'ingredient_id' | 'supplier_id'>),
        ingredient_id: ingredientId,
        supplier_id: supplierId,
      },
      originOf(request, currentUser),
    );
  }

  @Patch('food-lots/:id')
  updateLot(
    @Param('id', uuidParameter('Mã lô hàng không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const values = readLotFields(body, errors, true);
    check(errors);
    return this.records.updateLot(currentUser, id, values as LotChanges, originOf(request, currentUser));
  }

  @Post('food-lots/:id/close')
  @HttpCode(200)
  closeLot(
    @Param('id', uuidParameter('Mã lô hàng không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (body?.status !== 'used_up' && body?.status !== 'disposed') {
      errors.push({ field: 'status', message: 'Trạng thái là used_up hoặc disposed' });
    }
    const note = readText(body, 'handling_note', errors);
    check(errors);
    return this.records.closeLot(
      currentUser,
      id,
      { status: body?.status as 'used_up' | 'disposed', handling_note: note },
      originOf(request, currentUser),
    );
  }
}
