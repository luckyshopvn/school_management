import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError } from '../common/request-fields.js';
import { isGuardianOf, overdueDays, unallocatedReceipts } from '../finance/receivables.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { invoiceAmounts } from './invoice-amounts.js';

// Công nợ phải thu của trẻ: còn phải nộp = phải nộp của hóa đơn đã phát hành − đã phân bổ từ phiếu thu; số dư có là
// tiền đã thu chưa phân bổ (P05-09; QT-04 bước 1, 6; BR-32, BR-33; GD-27; YCTD-53). Nhắc nợ là giai đoạn 2 (P05-10)
const VIEW_PERMISSIONS = [PERMISSION_CODES.debtView, PERMISSION_CODES.receiptManage];

type PaymentStatus = 'unpaid' | 'paid' | 'overdue';

@Injectable()
export class DebtsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  // Danh sách công nợ theo trẻ của một đơn vị, lọc theo lớp và theo trẻ còn nợ quá hạn
  async list(currentUser: CurrentUser, filter: { orgUnitId: string; classId: string | null; overdueOnly: boolean }) {
    await this.assertStaffCanView(currentUser, filter.orgUnitId);
    return this.unitRows(filter);
  }

  // Công nợ theo trẻ của một đơn vị, không kiểm tra quyền; dùng cho báo cáo công nợ đã kiểm tra quyền riêng (P17-04)
  async unitRows(filter: { orgUnitId: string; classId: string | null; overdueOnly: boolean }) {
    const { database } = await this.currentSchoolYear.require();
    let childrenQuery = database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['children.id', 'children.full_name', 'classes.id as class_id', 'classes.name as class_name'])
      .where('children.org_unit_id', '=', filter.orgUnitId);
    if (filter.classId) {
      childrenQuery = childrenQuery.where('classes.id', '=', filter.classId);
    }
    const children = await childrenQuery.orderBy('classes.name').orderBy('children.full_name').execute();
    const summaries = await this.summaries(
      database,
      children.map((child) => child.id),
    );
    return children
      .map((child) => ({ ...child, ...(summaries.get(child.id) ?? this.emptySummary()) }))
      .filter((row) => row.invoice_count > 0 || row.credit_amount > 0)
      .filter((row) => !filter.overdueOnly || row.overdue_amount > 0);
  }

  // Chi tiết công nợ của một trẻ: hóa đơn đã phát hành kèm số còn phải nộp, số dư có (AC-106, CTC-P05-061)
  async child(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    const child = await database
      .selectFrom('children')
      .select(['id', 'full_name', 'org_unit_id'])
      .where('id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy trẻ', 'child');
    }
    if (!(await this.isStaffFor(currentUser, child.org_unit_id))) {
      if (!(await isGuardianOf(database, childId, currentUser.id))) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem công nợ của trẻ này');
      }
    }
    const invoices = await this.invoiceRows(database, [childId]);
    const summary = (await this.summaries(database, [childId])).get(childId) ?? this.emptySummary();
    return { child_id: child.id, child_name: child.full_name, org_unit_id: child.org_unit_id, ...summary, invoices };
  }

  private async summaries(database: Kysely<SchoolYearDatabase>, childIds: string[]) {
    const invoices = await this.invoiceRows(database, childIds);
    const credits = await unallocatedReceipts(database, childIds);
    const result = new Map<string, ReturnType<DebtsService['emptySummary']>>();
    for (const childId of childIds) {
      const own = invoices.filter((invoice) => invoice.child_id === childId);
      const credit = credits
        .filter((receipt) => receipt.child_id === childId)
        .reduce((sum, receipt) => sum + receipt.remaining, 0);
      const outstanding = own.reduce((sum, invoice) => sum + Math.max(invoice.outstanding_amount, 0), 0);
      const overdue = own.filter((invoice) => invoice.payment_status === 'overdue');
      result.set(childId, {
        invoice_count: own.length,
        payable_amount: own.reduce((sum, invoice) => sum + invoice.payable_amount, 0),
        paid_amount: own.reduce((sum, invoice) => sum + invoice.paid_amount, 0),
        outstanding_amount: outstanding,
        credit_amount: credit,
        balance_amount: outstanding - credit,
        overdue_amount: overdue.reduce((sum, invoice) => sum + invoice.outstanding_amount, 0),
        overdue_days: Math.max(0, ...overdue.map((invoice) => invoice.overdue_days)),
      });
    }
    return result;
  }

  private emptySummary() {
    return {
      invoice_count: 0,
      payable_amount: 0,
      paid_amount: 0,
      outstanding_amount: 0,
      credit_amount: 0,
      balance_amount: 0,
      overdue_amount: 0,
      overdue_days: 0,
    };
  }

  // Trạng thái thu của hóa đơn tính từ số còn phải nộp và ngày đến hạn, không lưu riêng (QT-04 mục 7)
  private async invoiceRows(database: Kysely<SchoolYearDatabase>, childIds: string[]) {
    if (childIds.length === 0) {
      return [];
    }
    const rows = await database
      .selectFrom('invoices')
      .select([
        'id',
        'code',
        'child_id',
        'invoice_kind',
        'period_year',
        'period_month',
        'total_amount',
        'due_date',
        'issued_at',
      ])
      .where('child_id', 'in', childIds)
      .where('status', '=', 'issued')
      .orderBy('period_year')
      .orderBy('period_month')
      .orderBy('code')
      .execute();
    const amounts = await invoiceAmounts(database, rows);
    const today = VIETNAM_DATE.format(this.clock.now());
    return rows.map((row) => {
      const amount = amounts.get(row.id) ?? {
        discount_amount: 0,
        adjustment_amount: 0,
        payable_amount: Number(row.total_amount),
        paid_amount: 0,
        outstanding_amount: Number(row.total_amount),
      };
      const days = amount.outstanding_amount > 0 ? overdueDays(row.due_date, today) : 0;
      const status: PaymentStatus = amount.outstanding_amount <= 0 ? 'paid' : days > 0 ? 'overdue' : 'unpaid';
      return {
        ...row,
        total_amount: Number(row.total_amount),
        ...amount,
        payment_status: status,
        overdue_days: days,
      };
    });
  }

  private async isStaffFor(currentUser: CurrentUser, orgUnitId: string): Promise<boolean> {
    for (const permission of VIEW_PERMISSIONS) {
      const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
      if (scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId)) {
        return true;
      }
    }
    return false;
  }

  private async assertStaffCanView(currentUser: CurrentUser, orgUnitId: string): Promise<void> {
    if (!(await this.isStaffFor(currentUser, orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem công nợ của đơn vị này');
    }
  }
}
