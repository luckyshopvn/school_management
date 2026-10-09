import { Controller, Get, Query } from '@nestjs/common';
import { validationError, type FieldError } from '@school-management/server';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VIEW_PERMISSION = 'P01.view';
const NO_UNIT = '00000000-0000-0000-0000-000000000000';

// Tra nhật ký thao tác của năm học đang dùng (P01-09); chỉ trả nhật ký trong phạm vi đơn vị (CTC-P01-053)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
  ) {}

  @Get()
  @RequirePermission(VIEW_PERMISSION)
  async list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    if (!Number.isInteger(page) || page < 1) {
      errors.push({ field: 'page', message: 'Số trang bắt đầu từ 1' });
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      errors.push({ field: 'page_size', message: 'Cỡ trang từ 1 đến 100' });
    }
    for (const field of ['entity_id', 'actor_user_id', 'org_unit_id']) {
      if (query[field] && !UUID_PATTERN.test(query[field] ?? '')) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    for (const field of ['from_date', 'to_date']) {
      if (query[field] && !DATE_PATTERN.test(query[field] ?? '')) {
        errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }

    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { items: [], page, page_size: pageSize, total: 0, total_pages: 1 };
    }
    const scope = await this.organizationScopes.resolve(currentUser, VIEW_PERMISSION);
    let selection = current.database.selectFrom('audit_logs');
    // Lọc phạm vi ở tầng truy vấn (BM-11, BM-12)
    if (!scope.wholeSchool) {
      selection = selection.where('org_unit_id', 'in', scope.orgUnitIds.length ? scope.orgUnitIds : [NO_UNIT]);
    }
    if (query.org_unit_id) {
      selection = selection.where('org_unit_id', '=', query.org_unit_id);
    }
    if (query.entity_name) {
      selection = selection.where('entity_name', '=', query.entity_name);
    }
    if (query.entity_id) {
      selection = selection.where('entity_id', '=', query.entity_id);
    }
    if (query.actor_user_id) {
      selection = selection.where('actor_user_id', '=', query.actor_user_id);
    }
    if (query.from_date) {
      selection = selection.where('created_at', '>=', new Date(`${query.from_date}T00:00:00+07:00`));
    }
    if (query.to_date) {
      const end = new Date(`${query.to_date}T00:00:00+07:00`).getTime() + 86_400_000;
      selection = selection.where('created_at', '<', new Date(end));
    }
    const counted = await selection
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    const total = Number(counted.count);
    const items = await selection
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute();
    return { items, page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) };
  }
}
