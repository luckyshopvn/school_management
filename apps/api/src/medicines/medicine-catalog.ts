import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readInteger,
  readOptionalText,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  readStatus,
  type RecordStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { MedicationAccess } from './medication-access.js';

// Danh mục thuốc và nhà thuốc theo đơn vị (P10-02; BR-48; YCTD-75): y tế quản lý trong phạm vi đơn vị được gán; số lượng
// tồn chỉ đặt khi tạo (tồn đầu), sau đó tăng theo phiếu mua thuốc và giảm theo phiếu cấp thuốc. Người duyệt mua thuốc và
// người xem tài chính (P06.view) xem được danh mục để duyệt và thanh toán
export const MEDICINE_VIEW_PERMISSIONS = [
  PERMISSION_CODES.medicineManage,
  PERMISSION_CODES.medicinePurchaseApprove,
  'P06.view',
];
const MAXIMUM_STOCK = 1_000_000;

interface MedicineInput {
  org_unit_id: string;
  code: string;
  name: string;
  active_ingredient: string | null;
  unit: string;
  pharmacy_id: string | null;
  stock_qty: number;
}

interface PharmacyInput {
  org_unit_id: string;
  name: string;
  phone: string | null;
  address: string | null;
}

@Injectable()
export class MedicineCatalogService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: MedicationAccess,
    private readonly clock: Clock,
  ) {}

  private async unitFilter(currentUser: CurrentUser, orgUnitId: string | null) {
    const scope = await this.access.staffScope(currentUser, MEDICINE_VIEW_PERMISSIONS);
    if (orgUnitId && !scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      await this.access.assertStaffScope(
        currentUser,
        MEDICINE_VIEW_PERMISSIONS,
        orgUnitId,
        'Đơn vị này nằm ngoài phạm vi của bạn',
      );
    }
    return scope;
  }

  async listMedicines(currentUser: CurrentUser, filter: { orgUnitId: string | null; status: RecordStatus | null }) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.unitFilter(currentUser, filter.orgUnitId);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      return [];
    }
    let query = database
      .selectFrom('medicines')
      .leftJoin('pharmacies', 'pharmacies.id', 'medicines.pharmacy_id')
      .select([
        'medicines.id',
        'medicines.org_unit_id',
        'medicines.code',
        'medicines.name',
        'medicines.active_ingredient',
        'medicines.unit',
        'medicines.pharmacy_id',
        'pharmacies.name as pharmacy_name',
        'medicines.stock_qty',
        'medicines.status',
      ])
      .orderBy('medicines.name');
    if (!scope.wholeSchool) {
      query = query.where('medicines.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.orgUnitId) {
      query = query.where('medicines.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.status) {
      query = query.where('medicines.status', '=', filter.status);
    }
    return query.execute();
  }

  async createMedicine(currentUser: CurrentUser, input: MedicineInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertManage(currentUser, input.org_unit_id);
    if (input.pharmacy_id) {
      await this.assertPharmacyOfUnit(database, input.pharmacy_id, input.org_unit_id);
    }
    return database.transaction().execute(async (transaction) => {
      const created = await conflictOnDuplicate(
        transaction
          .insertInto('medicines')
          .values({ ...input, created_by: currentUser.id })
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Mã thuốc đã có trong đơn vị',
        'code',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'medicines',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async updateMedicine(
    currentUser: CurrentUser,
    medicineId: string,
    changes: Partial<Pick<MedicineInput, 'name' | 'active_ingredient' | 'unit' | 'pharmacy_id'>> & {
      status?: RecordStatus;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const before = await database.selectFrom('medicines').selectAll().where('id', '=', medicineId).executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy thuốc', 'medicine');
    }
    await this.assertManage(currentUser, before.org_unit_id);
    if (changes.pharmacy_id) {
      await this.assertPharmacyOfUnit(database, changes.pharmacy_id, before.org_unit_id);
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('medicines')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', medicineId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'medicines',
        entityId: medicineId,
        action: 'update',
        before,
        after: updated,
      });
      return updated;
    });
  }

  async listPharmacies(currentUser: CurrentUser, filter: { orgUnitId: string | null; status: RecordStatus | null }) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.unitFilter(currentUser, filter.orgUnitId);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      return [];
    }
    let query = database
      .selectFrom('pharmacies')
      .select(['id', 'org_unit_id', 'name', 'phone', 'address', 'status'])
      .orderBy('name');
    if (!scope.wholeSchool) {
      query = query.where('org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.orgUnitId) {
      query = query.where('org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.status) {
      query = query.where('status', '=', filter.status);
    }
    return query.execute();
  }

  async createPharmacy(currentUser: CurrentUser, input: PharmacyInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertManage(currentUser, input.org_unit_id);
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('pharmacies')
        .values({ ...input, created_by: currentUser.id })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'pharmacies',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async updatePharmacy(
    currentUser: CurrentUser,
    pharmacyId: string,
    changes: Partial<Omit<PharmacyInput, 'org_unit_id'>> & { status?: RecordStatus },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const before = await database.selectFrom('pharmacies').selectAll().where('id', '=', pharmacyId).executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy nhà thuốc', 'pharmacy');
    }
    await this.assertManage(currentUser, before.org_unit_id);
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('pharmacies')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', pharmacyId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'pharmacies',
        entityId: pharmacyId,
        action: 'update',
        before,
        after: updated,
      });
      return updated;
    });
  }

  private assertManage(currentUser: CurrentUser, orgUnitId: string) {
    return this.access.assertStaffScope(
      currentUser,
      [PERMISSION_CODES.medicineManage],
      orgUnitId,
      'Bạn không có quyền quản lý thuốc của đơn vị này',
    );
  }

  private async assertPharmacyOfUnit(database: Kysely<SchoolYearDatabase>, pharmacyId: string, orgUnitId: string) {
    const pharmacy = await database
      .selectFrom('pharmacies')
      .select(['org_unit_id', 'status'])
      .where('id', '=', pharmacyId)
      .executeTakeFirst();
    if (!pharmacy || pharmacy.org_unit_id !== orgUnitId || pharmacy.status !== 'active') {
      throw validationError([{ field: 'pharmacy_id', message: 'Nhà thuốc không thuộc đơn vị hoặc đã ngừng' }]);
    }
  }
}

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

function readFilter(query: Record<string, string | undefined>) {
  const errors: FieldError[] = [];
  if (query.org_unit_id !== undefined && !isUuid(query.org_unit_id)) {
    errors.push({ field: 'org_unit_id', message: 'Mã không hợp lệ' });
  }
  const status = readStatus(query, errors) ?? null;
  check(errors);
  return { orgUnitId: query.org_unit_id ?? null, status };
}

// Bỏ các trường không gửi để chỉ cập nhật phần thay đổi
function defined<Value extends Record<string, unknown>>(value: Value): Partial<Value> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<Value>;
}

@Controller()
export class MedicineCatalogController {
  constructor(private readonly catalog: MedicineCatalogService) {}

  @Get('medicines')
  listMedicines(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalog.listMedicines(currentUser, readFilter(query));
  }

  @Post('medicines')
  @HttpCode(201)
  createMedicine(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input: MedicineInput = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      active_ingredient: readOptionalText(body, 'active_ingredient', errors) ?? null,
      unit: readRequiredText(body, 'unit', errors),
      pharmacy_id: readOptionalUuid(body, 'pharmacy_id', errors) ?? null,
      stock_qty: readInteger(body, 'stock_qty', errors, { min: 0, max: MAXIMUM_STOCK }) ?? 0,
    };
    check(errors);
    return this.catalog.createMedicine(currentUser, input, originOf(request, currentUser));
  }

  @Patch('medicines/:id')
  updateMedicine(
    @Param('id', uuidParameter('Mã thuốc không hợp lệ')) medicineId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (body?.stock_qty !== undefined) {
      errors.push({ field: 'stock_qty', message: 'Số lượng thay đổi qua phiếu mua thuốc hoặc phiếu cấp thuốc' });
    }
    const name = readOptionalText(body, 'name', errors);
    const unit = readOptionalText(body, 'unit', errors);
    if (name === null) {
      errors.push({ field: 'name', message: 'Bắt buộc nhập' });
    }
    if (unit === null) {
      errors.push({ field: 'unit', message: 'Bắt buộc nhập' });
    }
    const changes = defined({
      name: name ?? undefined,
      unit: unit ?? undefined,
      active_ingredient: readOptionalText(body, 'active_ingredient', errors),
      pharmacy_id: readOptionalUuid(body, 'pharmacy_id', errors),
      status: readStatus(body, errors),
    });
    check(errors);
    return this.catalog.updateMedicine(currentUser, medicineId, changes, originOf(request, currentUser));
  }

  @Get('pharmacies')
  listPharmacies(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalog.listPharmacies(currentUser, readFilter(query));
  }

  @Post('pharmacies')
  @HttpCode(201)
  createPharmacy(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input: PharmacyInput = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      name: readRequiredText(body, 'name', errors),
      phone: readOptionalText(body, 'phone', errors) ?? null,
      address: readOptionalText(body, 'address', errors) ?? null,
    };
    check(errors);
    return this.catalog.createPharmacy(currentUser, input, originOf(request, currentUser));
  }

  @Patch('pharmacies/:id')
  updatePharmacy(
    @Param('id', uuidParameter('Mã nhà thuốc không hợp lệ')) pharmacyId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const name = readOptionalText(body, 'name', errors);
    if (name === null) {
      errors.push({ field: 'name', message: 'Bắt buộc nhập' });
    }
    const changes = defined({
      name: name ?? undefined,
      phone: readOptionalText(body, 'phone', errors),
      address: readOptionalText(body, 'address', errors),
      status: readStatus(body, errors),
    });
    check(errors);
    return this.catalog.updatePharmacy(currentUser, pharmacyId, changes, originOf(request, currentUser));
  }
}
