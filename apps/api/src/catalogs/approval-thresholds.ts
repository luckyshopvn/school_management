import { Body, Controller, Get, Injectable, Put, Query, Req } from '@nestjs/common';
import { Clock, validationError, type FieldError } from '@school-management/server';
import { APPROVAL_DOCUMENT_TYPES, PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { isUuid, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { CatalogAccess } from './catalog-access.js';

// Hạn mức phê duyệt theo đơn vị và loại chứng từ, có hiệu lực ngay khi lưu (P01-10, BR-77, YCTD-42).
// Không kế thừa từ Trường chính: loại chưa cấu hình thì Hiệu trưởng phê duyệt (Q-112)
export interface ApprovalThreshold {
  id: string;
  org_unit_id: string;
  document_type: string;
  threshold_amount: number;
  effective_from: string;
  updated_by: string | null;
}

const VIEW_PERMISSION = 'P01.view';
const MAXIMUM_AMOUNT = 9_999_999_999_999.99;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function hasAtMostTwoDecimals(amount: number): boolean {
  return Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6;
}

@Injectable()
export class ApprovalThresholdsService {
  constructor(
    private readonly catalogAccess: CatalogAccess,
    private readonly clock: Clock,
  ) {}

  // Chỉ trả hạn mức đang hiệu lực trong phạm vi đơn vị của người xem
  async list(currentUser: CurrentUser, orgUnitId: string | undefined): Promise<ApprovalThreshold[]> {
    if (orgUnitId) {
      await this.catalogAccess.scopeIncludes(currentUser, VIEW_PERMISSION, orgUnitId);
    }
    const database = await this.catalogAccess.currentDatabase();
    if (!database) {
      return [];
    }
    let query = database
      .selectFrom('approval_thresholds')
      .select(['id', 'org_unit_id', 'document_type', 'threshold_amount', 'effective_from', 'updated_by'])
      .where('status', '=', 'active');
    const unitIds = this.catalogAccess.unitFilter(await this.catalogAccess.scope(currentUser, VIEW_PERMISSION));
    if (unitIds) {
      query = query.where('org_unit_id', 'in', unitIds);
    }
    if (orgUnitId) {
      query = query.where('org_unit_id', '=', orgUnitId);
    }
    const rows = await query.orderBy('org_unit_id').orderBy('document_type').execute();
    return rows.map((row) => ({ ...row, threshold_amount: Number(row.threshold_amount) }));
  }

  // Lưu hạn mức mới thì bản đang hiệu lực chuyển sang hết hiệu lực; giá trị trống là gỡ hạn mức
  async save(
    currentUser: CurrentUser,
    input: { org_unit_id: string; document_type: string; threshold_amount: number | null },
    origin: ChangeOrigin,
  ): Promise<ApprovalThreshold | null> {
    const database = await this.catalogAccess.writableDatabase(
      currentUser,
      PERMISSION_CODES.approvalThresholdManage,
      input.org_unit_id,
    );
    return database.transaction().execute(async (transaction) => {
      const existing = await transaction
        .selectFrom('approval_thresholds')
        .select(['id', 'org_unit_id', 'document_type', 'threshold_amount', 'effective_from', 'updated_by'])
        .where('org_unit_id', '=', input.org_unit_id)
        .where('document_type', '=', input.document_type)
        .where('status', '=', 'active')
        .forUpdate()
        .executeTakeFirst();
      const now = this.clock.now();
      if (existing) {
        await transaction
          .updateTable('approval_thresholds')
          .set({ status: 'expired', updated_at: now, updated_by: origin.actorUserId })
          .where('id', '=', existing.id)
          .execute();
      }
      const before = existing ? { ...existing, threshold_amount: Number(existing.threshold_amount) } : null;
      if (input.threshold_amount === null) {
        if (existing) {
          await writeAuditLog(transaction, {
            origin,
            orgUnitId: input.org_unit_id,
            entityName: 'approval_thresholds',
            entityId: existing.id,
            action: 'update',
            before,
            after: { ...before, status: 'expired' },
          });
        }
        return null;
      }
      const created = await transaction
        .insertInto('approval_thresholds')
        .values({
          org_unit_id: input.org_unit_id,
          document_type: input.document_type,
          threshold_amount: input.threshold_amount,
          effective_from: VIETNAM_DATE.format(now),
          created_by: origin.actorUserId,
          updated_by: origin.actorUserId,
        })
        .returning(['id', 'org_unit_id', 'document_type', 'threshold_amount', 'effective_from', 'updated_by'])
        .executeTakeFirstOrThrow();
      const after = { ...created, threshold_amount: Number(created.threshold_amount) };
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'approval_thresholds',
        entityId: created.id,
        action: existing ? 'update' : 'create',
        before,
        after,
      });
      return after;
    });
  }
}

// Ban Giám hiệu và quản lý đơn vị xem trong phạm vi; chỉ Hiệu trưởng lưu (YCTD-42, CTC-P01-067)
@Controller('approval-thresholds')
export class ApprovalThresholdsController {
  constructor(private readonly approvalThresholdsService: ApprovalThresholdsService) {}

  @Get()
  @RequirePermission(VIEW_PERMISSION)
  list(@Query('org_unit_id') orgUnitId: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    if (orgUnitId !== undefined && !isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã không hợp lệ' }]);
    }
    return this.approvalThresholdsService.list(currentUser, orgUnitId);
  }

  @Put()
  @RequirePermission(PERMISSION_CODES.approvalThresholdManage)
  save(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const documentType = body?.document_type;
    if (!APPROVAL_DOCUMENT_TYPES.some((type) => type.code === documentType)) {
      errors.push({ field: 'document_type', message: 'Loại chứng từ không áp dụng hạn mức' });
    }
    const amount = body?.threshold_amount;
    if (amount === undefined) {
      errors.push({ field: 'threshold_amount', message: 'Bắt buộc nhập hạn mức, để trống thì gửi null' });
    } else if (
      amount !== null &&
      (typeof amount !== 'number' || !(amount > 0) || amount > MAXIMUM_AMOUNT || !hasAtMostTwoDecimals(amount))
    ) {
      errors.push({ field: 'threshold_amount', message: 'Hạn mức là số tiền lớn hơn 0, tối đa hai chữ số thập phân' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.approvalThresholdsService.save(
      currentUser,
      { org_unit_id: orgUnitId, document_type: documentType as string, threshold_amount: amount as number | null },
      originOf(request, currentUser),
    );
  }
}
