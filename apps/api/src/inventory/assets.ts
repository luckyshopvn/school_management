import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { AssetLocationType, AssetStatus, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import {
  conflictOnDuplicate,
  notFoundError,
  readOptionalUuid,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import {
  check,
  InventoryAccess,
  optionalEnumQuery,
  optionalUuidQuery,
  readDate,
  readEnum,
  readMoney,
  readText,
} from './inventory-common.js';

// Danh mục tài sản, cấp phát và thu hồi, mượn trả, ghi nhận hỏng và mất, nhà cung cấp (P13-01 đến P13-04, P13-07; BR-61,
// BR-63; YCTD-77). Mỗi lần cấp phát, thu hồi, mượn, trả, hỏng, mất đều sinh phiếu có mã và người xác nhận; hỏng hoặc mất
// trình Ban Giám hiệu của đơn vị duyệt xử lý, người ghi nhận không tự duyệt
const ASSIGN_TYPES: Array<Exclude<AssetLocationType, 'store'>> = ['room', 'class', 'staff', 'unit'];
const ASSET_VIEW = [PERMISSION_CODES.assetManage, PERMISSION_CODES.purchaseRequestApprove];
const SUPPLIER_PERMISSIONS = [PERMISSION_CODES.assetManage, PERMISSION_CODES.purchaseOrderManage];

type AssetInput = {
  name: string;
  category: string;
  unit: string;
  original_cost: number;
  purchase_date: string;
};

@Injectable()
export class AssetsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: InventoryAccess,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // ---------- Nhà cung cấp (P13-07) ----------

  async listSuppliers(currentUser: CurrentUser, orgUnitId: string | null) {
    const scope = await this.access.requireScope(
      currentUser,
      SUPPLIER_PERMISSIONS,
      'Bạn không có quyền xem nhà cung cấp',
    );
    const { database } = await this.currentSchoolYear.require();
    let query = database.selectFrom('suppliers').selectAll().orderBy('name');
    if (!scope.wholeSchool) {
      query = query.where('org_unit_id', 'in', scope.orgUnitIds);
    }
    if (orgUnitId) {
      query = query.where('org_unit_id', '=', orgUnitId);
    }
    return query.execute();
  }

  async saveSupplier(
    currentUser: CurrentUser,
    supplierId: string | null,
    input: {
      org_unit_id: string;
      name: string;
      tax_code: string | null;
      contact_name: string | null;
      phone: string | null;
      address: string | null;
      payment_terms: string | null;
      status: 'active' | 'inactive' | null;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const existing = supplierId
      ? await database.selectFrom('suppliers').selectAll().where('id', '=', supplierId).executeTakeFirst()
      : undefined;
    if (supplierId && !existing) {
      throw notFoundError('Không tìm thấy nhà cung cấp', 'supplier');
    }
    const orgUnitId = existing?.org_unit_id ?? input.org_unit_id;
    await this.access.assertUnit(
      currentUser,
      SUPPLIER_PERMISSIONS,
      orgUnitId,
      'Bạn không có quyền quản lý nhà cung cấp của đơn vị này',
    );
    const values = {
      name: input.name,
      tax_code: input.tax_code,
      contact_name: input.contact_name,
      phone: input.phone,
      address: input.address,
      payment_terms: input.payment_terms,
    };
    return database.transaction().execute(async (transaction) => {
      const saved = await conflictOnDuplicate(
        existing
          ? transaction
              .updateTable('suppliers')
              .set({ ...values, status: input.status ?? existing.status, updated_at: this.clock.now() })
              .where('id', '=', existing.id)
              .returningAll()
              .executeTakeFirstOrThrow()
          : transaction
              .insertInto('suppliers')
              .values({ ...values, org_unit_id: orgUnitId, created_by: origin.actorUserId })
              .returningAll()
              .executeTakeFirstOrThrow(),
        'Đơn vị đã có nhà cung cấp cùng tên',
        'name',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'suppliers',
        entityId: saved.id,
        action: existing ? 'update' : 'create',
        before: existing ?? null,
        after: saved,
      });
      return saved;
    });
  }

  // ---------- Tài sản (P13-01) ----------

  async listAssets(
    currentUser: CurrentUser,
    filter: { orgUnitId: string | null; status: AssetStatus | null; q: string | null },
  ) {
    const scope = await this.access.requireScope(currentUser, ASSET_VIEW, 'Bạn không có quyền xem tài sản');
    const { database } = await this.currentSchoolYear.require();
    let query = database.selectFrom('assets').selectAll().orderBy('code');
    if (!scope.wholeSchool) {
      query = query.where('org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.orgUnitId) {
      query = query.where('org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.status) {
      query = query.where('status', '=', filter.status);
    }
    if (filter.q) {
      const pattern = `%${filter.q}%`;
      query = query.where((expression) =>
        expression.or([expression('code', 'ilike', pattern), expression('name', 'ilike', pattern)]),
      );
    }
    return (await query.execute()).map(formatAsset);
  }

  async readAsset(currentUser: CurrentUser, assetId: string) {
    const { database } = await this.currentSchoolYear.require();
    const asset = await this.loadAsset(database, assetId);
    await this.access.assertUnit(currentUser, ASSET_VIEW, asset.org_unit_id, 'Bạn không có quyền xem tài sản này');
    const [assignments, loans, damages] = await Promise.all([
      database
        .selectFrom('asset_assignments')
        .selectAll()
        .where('asset_id', '=', assetId)
        .orderBy('created_at', 'desc')
        .execute(),
      database
        .selectFrom('asset_loans')
        .selectAll()
        .where('asset_id', '=', assetId)
        .orderBy('created_at', 'desc')
        .execute(),
      database
        .selectFrom('asset_damages')
        .selectAll()
        .where('asset_id', '=', assetId)
        .orderBy('created_at', 'desc')
        .execute(),
    ]);
    const today = this.today();
    return {
      ...formatAsset(asset),
      assignments,
      loans: loans.map((loan) => ({ ...loan, overdue: loan.status === 'open' && loan.due_date < today })),
      damages,
    };
  }

  async createAsset(
    currentUser: CurrentUser,
    input: AssetInput & { org_unit_id: string; code: string },
    origin: ChangeOrigin,
  ) {
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.assetManage],
      input.org_unit_id,
      'Bạn không có quyền quản lý tài sản của đơn vị này',
    );
    if (input.purchase_date > this.today()) {
      throw validationError([{ field: 'purchase_date', message: 'Ngày nhập không sau hôm nay' }]);
    }
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      const created = await conflictOnDuplicate(
        transaction
          .insertInto('assets')
          .values({ ...input, created_by: origin.actorUserId })
          .returningAll()
          .executeTakeFirstOrThrow(),
        'Mã tài sản đã có',
        'code',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'assets',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return formatAsset(created);
    });
  }

  // Sửa thông tin; thanh lý (disposed) chỉ khi tài sản đang trong kho, đã hỏng hoặc đã mất
  async updateAsset(
    currentUser: CurrentUser,
    assetId: string,
    input: AssetInput & { disposed: boolean },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const asset = await this.loadAsset(database, assetId);
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.assetManage],
      asset.org_unit_id,
      'Bạn không có quyền quản lý tài sản của đơn vị này',
    );
    if (input.disposed && !['in_stock', 'damaged', 'lost', 'disposed'].includes(asset.status)) {
      throw ruleViolationError('BR-61', 'Thu hồi hoặc nhận trả tài sản trước khi thanh lý');
    }
    return database.transaction().execute(async (transaction) => {
      const { disposed, ...values } = input;
      const updated = await transaction
        .updateTable('assets')
        .set({
          ...values,
          ...(disposed
            ? { status: 'disposed' as const, location_type: 'store' as const, location_id: null, location_name: null }
            : {}),
          updated_at: this.clock.now(),
        })
        .where('id', '=', assetId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: asset.org_unit_id,
        entityName: 'assets',
        entityId: assetId,
        action: 'update',
        before: asset,
        after: updated,
      });
      return formatAsset(updated);
    });
  }

  // ---------- Cấp phát và thu hồi (P13-02) ----------

  async assign(
    currentUser: CurrentUser,
    input: {
      asset_id: string;
      assigned_to_type: Exclude<AssetLocationType, 'store'>;
      assigned_to_id: string | null;
      assigned_to_name: string;
      received_by_name: string;
      assigned_on: string;
      note: string | null;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const asset = await this.loadAsset(database, input.asset_id);
    await this.assertManage(currentUser, asset.org_unit_id);
    if (input.assigned_on > this.today()) {
      throw validationError([{ field: 'assigned_on', message: 'Ngày cấp phát không sau hôm nay' }]);
    }
    return database.transaction().execute(async (transaction) => {
      await this.claimInStock(transaction, asset.id, 'assigned', {
        location_type: input.assigned_to_type,
        location_id: input.assigned_to_id,
        location_name: input.assigned_to_name,
      });
      const created = await transaction
        .insertInto('asset_assignments')
        .values({
          ...input,
          code: await nextDocumentCode(transaction, 'asset_assignment', 'CPTS'),
          handed_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: asset.org_unit_id,
        entityName: 'asset_assignments',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async returnAssignment(
    currentUser: CurrentUser,
    assignmentId: string,
    input: { returned_on: string; returned_by_name: string; note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const assignment = await database
      .selectFrom('asset_assignments')
      .selectAll()
      .where('id', '=', assignmentId)
      .executeTakeFirst();
    if (!assignment) {
      throw notFoundError('Không tìm thấy phiếu cấp phát', 'asset_assignment');
    }
    const asset = await this.loadAsset(database, assignment.asset_id);
    await this.assertManage(currentUser, asset.org_unit_id);
    if (assignment.returned_on) {
      throw ruleViolationError('BR-61', 'Tài sản này đã được thu hồi');
    }
    if (input.returned_on < assignment.assigned_on || input.returned_on > this.today()) {
      throw validationError([{ field: 'returned_on', message: 'Ngày thu hồi từ ngày cấp phát đến hôm nay' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('asset_assignments')
        .set({
          return_code: await nextDocumentCode(transaction, 'asset_return', 'THTS'),
          returned_on: input.returned_on,
          returned_by_name: input.returned_by_name,
          return_received_by: origin.actorUserId,
          return_note: input.note,
        })
        .where('id', '=', assignmentId)
        .where('returned_on', 'is', null)
        .returningAll()
        .executeTakeFirst();
      if (!updated) {
        throw ruleViolationError('BR-61', 'Tài sản này đã được thu hồi');
      }
      await this.backToStore(transaction, asset.id);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: asset.org_unit_id,
        entityName: 'asset_assignments',
        entityId: assignmentId,
        action: 'update',
        before: assignment,
        after: updated,
      });
      return updated;
    });
  }

  // ---------- Mượn trả (P13-03) ----------

  async listLoans(
    currentUser: CurrentUser,
    filter: { orgUnitId: string | null; status: 'open' | 'overdue' | 'returned' | null },
  ) {
    const scope = await this.access.requireScope(currentUser, ASSET_VIEW, 'Bạn không có quyền xem phiếu mượn');
    const { database } = await this.currentSchoolYear.require();
    const today = this.today();
    let query = database
      .selectFrom('asset_loans')
      .innerJoin('assets', 'assets.id', 'asset_loans.asset_id')
      .selectAll('asset_loans')
      .select(['assets.code as asset_code', 'assets.name as asset_name', 'assets.org_unit_id'])
      .orderBy('asset_loans.created_at', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('assets.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.orgUnitId) {
      query = query.where('assets.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.status === 'returned') {
      query = query.where('asset_loans.status', '=', 'returned');
    } else if (filter.status) {
      query = query.where('asset_loans.status', '=', 'open');
      if (filter.status === 'overdue') {
        query = query.where('asset_loans.due_date', '<', today);
      }
    }
    return (await query.execute()).map((loan) => ({
      ...loan,
      overdue: loan.status === 'open' && loan.due_date < today,
    }));
  }

  async lend(
    currentUser: CurrentUser,
    input: {
      asset_id: string;
      borrower_name: string;
      borrower_user_id: string | null;
      from_date: string;
      due_date: string;
      note: string | null;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const asset = await this.loadAsset(database, input.asset_id);
    await this.assertManage(currentUser, asset.org_unit_id);
    if (input.due_date < input.from_date || input.from_date > this.today()) {
      throw validationError([
        { field: 'due_date', message: 'Ngày mượn không sau hôm nay, hạn trả không trước ngày mượn' },
      ]);
    }
    return database.transaction().execute(async (transaction) => {
      await this.claimInStock(transaction, asset.id, 'on_loan', {
        location_type: 'staff',
        location_id: input.borrower_user_id,
        location_name: input.borrower_name,
      });
      const created = await transaction
        .insertInto('asset_loans')
        .values({
          ...input,
          code: await nextDocumentCode(transaction, 'asset_loan', 'MTTS'),
          lent_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: asset.org_unit_id,
        entityName: 'asset_loans',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async returnLoan(
    currentUser: CurrentUser,
    loanId: string,
    input: { returned_on: string; note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const loan = await database.selectFrom('asset_loans').selectAll().where('id', '=', loanId).executeTakeFirst();
    if (!loan) {
      throw notFoundError('Không tìm thấy phiếu mượn', 'asset_loan');
    }
    const asset = await this.loadAsset(database, loan.asset_id);
    await this.assertManage(currentUser, asset.org_unit_id);
    if (loan.status !== 'open') {
      throw ruleViolationError('BR-61', 'Tài sản này đã được trả');
    }
    if (input.returned_on < loan.from_date || input.returned_on > this.today()) {
      throw validationError([{ field: 'returned_on', message: 'Ngày trả từ ngày mượn đến hôm nay' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('asset_loans')
        .set({
          status: 'returned',
          returned_on: input.returned_on,
          return_received_by: origin.actorUserId,
          return_note: input.note,
        })
        .where('id', '=', loanId)
        .where('status', '=', 'open')
        .returningAll()
        .executeTakeFirst();
      if (!updated) {
        throw ruleViolationError('BR-61', 'Tài sản này đã được trả');
      }
      await this.backToStore(transaction, asset.id);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: asset.org_unit_id,
        entityName: 'asset_loans',
        entityId: loanId,
        action: 'update',
        before: loan,
        after: updated,
      });
      return { ...updated, overdue: false, returned_late: input.returned_on > loan.due_date };
    });
  }

  // ---------- Hỏng và mất (P13-04) ----------

  async listDamages(
    currentUser: CurrentUser,
    filter: { orgUnitId: string | null; status: 'pending' | 'approved' | 'rejected' | null },
  ) {
    const scope = await this.access.requireScope(currentUser, ASSET_VIEW, 'Bạn không có quyền xem hỏng mất');
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('asset_damages')
      .innerJoin('assets', 'assets.id', 'asset_damages.asset_id')
      .selectAll('asset_damages')
      .select(['assets.code as asset_code', 'assets.name as asset_name'])
      .orderBy('asset_damages.created_at', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('asset_damages.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.orgUnitId) {
      query = query.where('asset_damages.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.status) {
      query = query.where('asset_damages.status', '=', filter.status);
    }
    return query.execute();
  }

  async reportDamage(
    currentUser: CurrentUser,
    input: {
      asset_id: string;
      incident_type: 'damaged' | 'lost';
      severity: 'minor' | 'major' | 'total';
      description: string;
      occurred_on: string;
      proposed_handling: string;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const asset = await this.loadAsset(database, input.asset_id);
    await this.assertManage(currentUser, asset.org_unit_id);
    if (input.occurred_on > this.today()) {
      throw validationError([{ field: 'occurred_on', message: 'Ngày xảy ra không sau hôm nay' }]);
    }
    if (['lost', 'disposed'].includes(asset.status)) {
      throw ruleViolationError('BR-61', 'Tài sản đã mất hoặc đã thanh lý');
    }
    const pending = await database
      .selectFrom('asset_damages')
      .select('id')
      .where('asset_id', '=', asset.id)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (pending) {
      throw ruleViolationError('BR-61', 'Tài sản đang có một ghi nhận hỏng hoặc mất chờ duyệt');
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('asset_damages')
        .values({
          ...input,
          org_unit_id: asset.org_unit_id,
          code: await nextDocumentCode(transaction, 'asset_damage', 'HMTS'),
          reported_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await queueNotification(transaction, {
        orgUnitId: asset.org_unit_id,
        templateCode: 'asset_damage_pending',
        title: input.incident_type === 'lost' ? 'Có tài sản bị mất cần duyệt xử lý' : 'Có tài sản hỏng cần duyệt xử lý',
        body: `${asset.code} ${asset.name}: ${input.description}. Đề xuất: ${input.proposed_handling}`,
        targetType: 'asset_damages',
        targetId: created.id,
        recipients: [
          { roleCode: 'VT-15', orgUnitId: asset.org_unit_id, channel: 'in_app' },
          { roleCode: 'VT-02', orgUnitId: asset.org_unit_id, channel: 'in_app' },
        ],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: asset.org_unit_id,
        entityName: 'asset_damages',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  // Duyệt thì tài sản chuyển sang hỏng hoặc mất; phiếu cấp phát và phiếu mượn đang mở được đóng kèm ghi chú
  async decideDamage(
    currentUser: CurrentUser,
    damageId: string,
    decision: { approve: boolean; note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const damage = await database.selectFrom('asset_damages').selectAll().where('id', '=', damageId).executeTakeFirst();
    if (!damage) {
      throw notFoundError('Không tìm thấy ghi nhận hỏng mất', 'asset_damage');
    }
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.purchaseRequestApprove],
      damage.org_unit_id,
      'Bạn không có quyền duyệt xử lý tài sản của đơn vị này',
    );
    if (damage.reported_by === currentUser.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Người duyệt không được là người ghi nhận');
    }
    if (damage.status !== 'pending') {
      throw ruleViolationError('BR-61', 'Ghi nhận này đã được xử lý');
    }
    if (!decision.approve && !decision.note) {
      throw validationError([{ field: 'note', message: 'Bắt buộc nhập lý do từ chối' }]);
    }
    const today = this.today();
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('asset_damages')
        .set({
          status: decision.approve ? 'approved' : 'rejected',
          decided_by: origin.actorUserId,
          decided_at: this.clock.now(),
          decision_note: decision.note,
        })
        .where('id', '=', damageId)
        .where('status', '=', 'pending')
        .returningAll()
        .executeTakeFirst();
      if (!updated) {
        throw ruleViolationError('BR-61', 'Ghi nhận này đã được xử lý');
      }
      if (decision.approve) {
        const closingNote = `Đóng theo ghi nhận ${damage.code}`;
        const openAssignment = await transaction
          .selectFrom('asset_assignments')
          .select(['id', 'assigned_on'])
          .where('asset_id', '=', damage.asset_id)
          .where('returned_on', 'is', null)
          .executeTakeFirst();
        if (openAssignment) {
          await transaction
            .updateTable('asset_assignments')
            .set({
              return_code: await nextDocumentCode(transaction, 'asset_return', 'THTS'),
              returned_on: today < openAssignment.assigned_on ? openAssignment.assigned_on : today,
              returned_by_name: damage.incident_type === 'lost' ? 'Tài sản mất' : 'Tài sản hỏng',
              return_received_by: origin.actorUserId,
              return_note: closingNote,
            })
            .where('id', '=', openAssignment.id)
            .execute();
        }
        await transaction
          .updateTable('asset_loans')
          .set({
            status: 'returned',
            returned_on: today,
            return_received_by: origin.actorUserId,
            return_note: closingNote,
          })
          .where('asset_id', '=', damage.asset_id)
          .where('status', '=', 'open')
          .execute();
        await transaction
          .updateTable('assets')
          .set({
            status: damage.incident_type,
            location_type: 'store',
            location_id: null,
            location_name: null,
            updated_at: this.clock.now(),
          })
          .where('id', '=', damage.asset_id)
          .execute();
      }
      await queueNotification(transaction, {
        orgUnitId: damage.org_unit_id,
        templateCode: decision.approve ? 'asset_damage_approved' : 'asset_damage_rejected',
        title: decision.approve ? 'Đã duyệt xử lý tài sản' : 'Từ chối xử lý tài sản',
        body: `${damage.code}${decision.note ? `: ${decision.note}` : ''}`,
        targetType: 'asset_damages',
        targetId: damageId,
        recipients: [{ userId: damage.reported_by, channel: 'in_app' }],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: damage.org_unit_id,
        entityName: 'asset_damages',
        entityId: damageId,
        action: 'update',
        before: { status: 'pending' },
        after: { status: updated.status, note: decision.note },
      });
      return updated;
    });
  }

  // ---------- Dùng chung ----------

  private async assertManage(currentUser: CurrentUser, orgUnitId: string) {
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.assetManage],
      orgUnitId,
      'Bạn không có quyền quản lý tài sản của đơn vị này',
    );
  }

  private async loadAsset(database: Kysely<SchoolYearDatabase>, assetId: string) {
    const asset = await database.selectFrom('assets').selectAll().where('id', '=', assetId).executeTakeFirst();
    if (!asset) {
      throw notFoundError('Không tìm thấy tài sản', 'asset');
    }
    return asset;
  }

  // Chỉ tài sản đang trong kho mới cấp phát hoặc cho mượn được (BR-61)
  private async claimInStock(
    transaction: Transaction<SchoolYearDatabase>,
    assetId: string,
    status: 'assigned' | 'on_loan',
    location: { location_type: AssetLocationType; location_id: string | null; location_name: string },
  ) {
    const claimed = await transaction
      .updateTable('assets')
      .set({ status, ...location, updated_at: this.clock.now() })
      .where('id', '=', assetId)
      .where('status', '=', 'in_stock')
      .returning('id')
      .executeTakeFirst();
    if (!claimed) {
      throw ruleViolationError(
        'BR-61',
        'Tài sản không ở trong kho: đang cấp phát, đang cho mượn, hỏng, mất hoặc đã thanh lý',
      );
    }
  }

  private async backToStore(transaction: Transaction<SchoolYearDatabase>, assetId: string) {
    await transaction
      .updateTable('assets')
      .set({
        status: 'in_stock',
        location_type: 'store',
        location_id: null,
        location_name: null,
        updated_at: this.clock.now(),
      })
      .where('id', '=', assetId)
      .where('status', 'in', ['assigned', 'on_loan'])
      .execute();
  }
}

function formatAsset<T extends { original_cost: string | number }>(asset: T) {
  return { ...asset, original_cost: Number(asset.original_cost) };
}

function readAssetInput(body: RequestBody, errors: FieldError[]): AssetInput {
  return {
    name: readText(body, 'name', errors, true) ?? '',
    category: readText(body, 'category', errors, true) ?? '',
    unit: readText(body, 'unit', errors, true) ?? '',
    original_cost: readMoney(body, 'original_cost', errors) ?? 0,
    purchase_date: readDate(body, 'purchase_date', errors, true) ?? '',
  };
}

function readSupplierInput(body: RequestBody, errors: FieldError[]) {
  const status = body?.status;
  if (status !== undefined && status !== 'active' && status !== 'inactive') {
    errors.push({ field: 'status', message: 'Trạng thái là active hoặc inactive' });
  }
  return {
    org_unit_id: readOptionalUuid(body, 'org_unit_id', errors) ?? '',
    name: readText(body, 'name', errors, true) ?? '',
    tax_code: readText(body, 'tax_code', errors, false),
    contact_name: readText(body, 'contact_name', errors, false),
    phone: readText(body, 'phone', errors, false),
    address: readText(body, 'address', errors, false),
    payment_terms: readText(body, 'payment_terms', errors, false),
    status: (status as 'active' | 'inactive' | undefined) ?? null,
  };
}

@Controller()
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get('suppliers')
  listSuppliers(@Query('org_unit_id') orgUnitId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.assets.listSuppliers(currentUser, optionalUuidQuery(orgUnitId, 'org_unit_id'));
  }

  @Post('suppliers')
  @HttpCode(201)
  createSupplier(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = readSupplierInput(body, errors);
    if (!input.org_unit_id) {
      errors.push({ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' });
    }
    check(errors);
    return this.assets.saveSupplier(currentUser, null, input, originOf(request, currentUser));
  }

  @Put('suppliers/:id')
  updateSupplier(
    @Param('id', uuidParameter('Mã nhà cung cấp không hợp lệ')) supplierId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readSupplierInput(body, errors);
    check(errors);
    return this.assets.saveSupplier(currentUser, supplierId, input, originOf(request, currentUser));
  }

  @Get('assets')
  listAssets(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.assets.listAssets(currentUser, {
      orgUnitId: optionalUuidQuery(query.org_unit_id, 'org_unit_id'),
      status: optionalEnumQuery(query.status, 'status', [
        'in_stock',
        'assigned',
        'on_loan',
        'damaged',
        'lost',
        'disposed',
      ] as const),
      q: query.q?.trim() || null,
    });
  }

  @Get('assets/:id')
  readAsset(
    @Param('id', uuidParameter('Mã tài sản không hợp lệ')) assetId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.assets.readAsset(currentUser, assetId);
  }

  @Post('assets')
  @HttpCode(201)
  createAsset(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      ...readAssetInput(body, errors),
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      code: readText(body, 'code', errors, true) ?? '',
    };
    check(errors);
    return this.assets.createAsset(currentUser, input, originOf(request, currentUser));
  }

  @Put('assets/:id')
  updateAsset(
    @Param('id', uuidParameter('Mã tài sản không hợp lệ')) assetId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = { ...readAssetInput(body, errors), disposed: body?.status === 'disposed' };
    if (body?.status !== undefined && body.status !== 'disposed') {
      errors.push({ field: 'status', message: 'Chỉ đổi trạng thái sang disposed (thanh lý)' });
    }
    check(errors);
    return this.assets.updateAsset(currentUser, assetId, input, originOf(request, currentUser));
  }

  @Post('asset-assignments')
  @HttpCode(201)
  assign(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      asset_id: readRequiredUuid(body, 'asset_id', errors, 'Bắt buộc chọn tài sản'),
      assigned_to_type: readEnum(body, 'assigned_to_type', ASSIGN_TYPES, errors),
      assigned_to_id: readOptionalUuid(body, 'assigned_to_id', errors) ?? null,
      assigned_to_name: readText(body, 'assigned_to_name', errors, true) ?? '',
      received_by_name: readText(body, 'received_by_name', errors, true) ?? '',
      assigned_on: readDate(body, 'assigned_on', errors, true) ?? '',
      note: readText(body, 'note', errors, false),
    };
    check(errors);
    return this.assets.assign(currentUser, input, originOf(request, currentUser));
  }

  @Post('asset-assignments/:id/return')
  @HttpCode(200)
  returnAssignment(
    @Param('id', uuidParameter('Mã phiếu cấp phát không hợp lệ')) assignmentId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      returned_on: readDate(body, 'returned_on', errors, true) ?? '',
      returned_by_name: readText(body, 'returned_by_name', errors, true) ?? '',
      note: readText(body, 'note', errors, false),
    };
    check(errors);
    return this.assets.returnAssignment(currentUser, assignmentId, input, originOf(request, currentUser));
  }

  @Get('asset-loans')
  listLoans(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.assets.listLoans(currentUser, {
      orgUnitId: optionalUuidQuery(query.org_unit_id, 'org_unit_id'),
      status: optionalEnumQuery(query.status, 'status', ['open', 'overdue', 'returned'] as const),
    });
  }

  @Post('asset-loans')
  @HttpCode(201)
  lend(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      asset_id: readRequiredUuid(body, 'asset_id', errors, 'Bắt buộc chọn tài sản'),
      borrower_name: readText(body, 'borrower_name', errors, true) ?? '',
      borrower_user_id: readOptionalUuid(body, 'borrower_user_id', errors) ?? null,
      from_date: readDate(body, 'from_date', errors, true) ?? '',
      due_date: readDate(body, 'due_date', errors, true) ?? '',
      note: readText(body, 'note', errors, false),
    };
    check(errors);
    return this.assets.lend(currentUser, input, originOf(request, currentUser));
  }

  @Post('asset-loans/:id/return')
  @HttpCode(200)
  returnLoan(
    @Param('id', uuidParameter('Mã phiếu mượn không hợp lệ')) loanId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      returned_on: readDate(body, 'returned_on', errors, true) ?? '',
      note: readText(body, 'note', errors, false),
    };
    check(errors);
    return this.assets.returnLoan(currentUser, loanId, input, originOf(request, currentUser));
  }

  @Get('asset-damages')
  listDamages(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.assets.listDamages(currentUser, {
      orgUnitId: optionalUuidQuery(query.org_unit_id, 'org_unit_id'),
      status: optionalEnumQuery(query.status, 'status', ['pending', 'approved', 'rejected'] as const),
    });
  }

  @Post('asset-damages')
  @HttpCode(201)
  reportDamage(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      asset_id: readRequiredUuid(body, 'asset_id', errors, 'Bắt buộc chọn tài sản'),
      incident_type: readEnum(body, 'incident_type', ['damaged', 'lost'] as const, errors),
      severity: readEnum(body, 'severity', ['minor', 'major', 'total'] as const, errors),
      description: readText(body, 'description', errors, true) ?? '',
      occurred_on: readDate(body, 'occurred_on', errors, true) ?? '',
      proposed_handling: readText(body, 'proposed_handling', errors, true) ?? '',
    };
    check(errors);
    return this.assets.reportDamage(currentUser, input, originOf(request, currentUser));
  }

  @Post('asset-damages/:id/approve')
  @HttpCode(200)
  approveDamage(
    @Param('id', uuidParameter('Mã ghi nhận không hợp lệ')) damageId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const note = readText(body, 'note', errors, false);
    check(errors);
    return this.assets.decideDamage(currentUser, damageId, { approve: true, note }, originOf(request, currentUser));
  }

  @Post('asset-damages/:id/reject')
  @HttpCode(200)
  rejectDamage(
    @Param('id', uuidParameter('Mã ghi nhận không hợp lệ')) damageId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const note = readText(body, 'note', errors, true);
    check(errors);
    return this.assets.decideDamage(currentUser, damageId, { approve: false, note }, originOf(request, currentUser));
  }
}
