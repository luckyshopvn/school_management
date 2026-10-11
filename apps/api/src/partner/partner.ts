import { Controller, Get, Injectable, Query, Req } from '@nestjs/common';
import { ApplicationError, Clock, validationError } from '@school-management/server';
import type { Request } from 'express';
import { PublicEndpoint } from '../authentication/authentication.guard.js';
import { IdentityClient, type ApiClientIdentity } from '../authentication/identity-client.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { ReportsService } from '../reports/reports.service.js';

// Nhóm điểm cuối chỉ đọc cho đối tác (P01-14; BR-73, BR-74; BM-65, BM-66; YCTD-63). Đối tác gửi khóa API ở tiêu đề
// `x-api-key`; máy chủ hỏi dịch vụ định danh khóa còn hiệu lực, đúng địa chỉ mạng và phạm vi. Mỗi khóa tối đa 60 yêu cầu
// mỗi phút. Đọc danh sách trẻ, phụ huynh, nhân sự và lương luôn ghi nhật ký truy cập dữ liệu kèm khóa và căn cứ pháp lý
const REQUESTS_PER_MINUTE = 60;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
type Scope = ApiClientIdentity['scopes'][number];

@Injectable()
export class PartnerService {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly identityClient: IdentityClient,
    private readonly reports: ReportsService,
    private readonly clock: Clock,
  ) {}

  async authenticate(request: Request, scope: Scope): Promise<ApiClientIdentity> {
    const key = request.header('x-api-key');
    if (!key) {
      throw new ApplicationError('ERR_UNAUTHENTICATED', 'Thiếu khóa API ở tiêu đề x-api-key');
    }
    const client = await this.identityClient.verifyApiKey(key, request.ip ?? '');
    if (!client.scopes.includes(scope)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Khóa API không có phạm vi dữ liệu này');
    }
    const now = this.clock.now().getTime();
    const window = this.windows.get(client.id);
    if (!window || now - window.start >= 60_000) {
      this.windows.set(client.id, { start: now, count: 1 });
    } else {
      window.count += 1;
      if (window.count > REQUESTS_PER_MINUTE) {
        throw new ApplicationError('ERR_RATE_LIMIT', `Mỗi khóa tối đa ${REQUESTS_PER_MINUTE} yêu cầu mỗi phút`);
      }
    }
    return client;
  }

  async summary(month: string) {
    return this.reports.dashboardForUnits(await this.allUnits(), month);
  }

  async finance(from: string, to: string) {
    const units = await this.allUnits();
    const cashFlow = await this.reports.cashFlowForUnits(units, { from, to, flowType: null, createdBy: null });
    const debts = await this.reports.debtsForUnits(units, null);
    return {
      cash_flow: { categories: cashFlow.categories, documents: cashFlow.documents, totals: cashFlow.totals },
      debts: { classes: debts.classes, totals: debts.totals },
    };
  }

  // Trẻ đang học kèm lớp và phụ huynh; không trả số định danh cá nhân
  async children(client: ApiClientIdentity, ip: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const rows = await database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .innerJoin('org_units', 'org_units.id', 'children.org_unit_id')
      .select([
        'children.id',
        'children.full_name',
        'children.dob',
        'children.gender',
        'org_units.name as unit_name',
        'classes.name as class_name',
      ])
      .where('children.status', '=', 'active')
      .orderBy('org_units.name')
      .orderBy('classes.name')
      .orderBy('children.full_name')
      .execute();
    const guardians = rows.length
      ? await database
          .selectFrom('child_guardians')
          .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
          .innerJoin('catalog_items', 'catalog_items.id', 'child_guardians.relationship_item_id')
          .select([
            'child_guardians.child_id',
            'guardians.full_name',
            'guardians.phone',
            'catalog_items.name as relationship',
            'child_guardians.is_primary',
          ])
          .where(
            'child_guardians.child_id',
            'in',
            rows.map((row) => row.id),
          )
          .execute()
      : [];
    await this.logAccess(client, ip, 'children', rows.length);
    return rows.map((row) => ({
      ...row,
      guardians: guardians
        .filter((guardian) => guardian.child_id === row.id)
        .map(({ full_name, phone, relationship, is_primary }) => ({ full_name, phone, relationship, is_primary })),
    }));
  }

  // Nhân sự đang làm kèm lương hợp đồng còn hiệu lực và thực nhận trên bảng lương đã duyệt gần nhất
  async staff(client: ApiClientIdentity, ip: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const today = VIETNAM_DATE.format(this.clock.now());
    const rows = await database
      .selectFrom('staff')
      .innerJoin('org_units', 'org_units.id', 'staff.org_unit_id')
      .leftJoin('departments', 'departments.id', 'staff.department_id')
      .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id')
      .select([
        'staff.id',
        'staff.code',
        'staff.full_name',
        'staff.start_date',
        'org_units.name as unit_name',
        'departments.name as department_name',
        'job_titles.name as job_title_name',
      ])
      .where('staff.status', '=', 'active')
      .orderBy('org_units.name')
      .orderBy('staff.full_name')
      .execute();
    const ids = rows.map((row) => row.id);
    const contracts = ids.length
      ? await database
          .selectFrom('employment_contracts')
          .select(['staff_id', 'contract_type', 'base_salary', 'start_date', 'end_date'])
          .where('staff_id', 'in', ids)
          .where('status', '=', 'active')
          .where('start_date', '<=', today)
          .execute()
      : [];
    const payslips = ids.length
      ? await database
          .selectFrom('payslips')
          .innerJoin('payrolls', 'payrolls.id', 'payslips.payroll_id')
          .select(['payslips.staff_id', 'payslips.net_amount', 'payrolls.period_year', 'payrolls.period_month'])
          .where('payslips.staff_id', 'in', ids)
          .where('payrolls.status', '=', 'approved')
          .orderBy('payrolls.period_year', 'desc')
          .orderBy('payrolls.period_month', 'desc')
          .execute()
      : [];
    await this.logAccess(client, ip, 'staff', rows.length);
    return rows.map((row) => {
      const contract = contracts.find((item) => item.staff_id === row.id);
      const payslip = payslips.find((item) => item.staff_id === row.id);
      return {
        ...row,
        contract: contract ? { ...contract, base_salary: Number(contract.base_salary) } : null,
        latest_payslip: payslip
          ? {
              period_year: payslip.period_year,
              period_month: payslip.period_month,
              net_amount: Number(payslip.net_amount),
            }
          : null,
      };
    });
  }

  private async logAccess(client: ApiClientIdentity, ip: string | null, scope: 'children' | 'staff', count: number) {
    const { database } = await this.currentSchoolYear.require();
    await database
      .insertInto('data_access_logs')
      .values({
        actor_user_id: null,
        actor_name: client.name,
        api_client_id: client.id,
        org_unit_id: null,
        entity_name: scope,
        entity_id: client.id,
        scope: `partner:${scope}`,
        record_count: count,
        purpose: client.legal_basis,
        ip_address: ip,
      })
      .execute();
  }

  private async allUnits(): Promise<string[]> {
    const { database } = await this.currentSchoolYear.require();
    return (await database.selectFrom('org_units').select('id').execute()).map((row) => row.id);
  }
}

@Controller('partner')
@PublicEndpoint()
export class PartnerController {
  constructor(private readonly partner: PartnerService) {}

  @Get('reports/summary')
  async summary(@Req() request: Request, @Query('month') month: string | undefined) {
    await this.partner.authenticate(request, 'reports');
    const chosen = month ?? VIETNAM_DATE.format(new Date()).slice(0, 7);
    if (!MONTH_PATTERN.test(chosen)) {
      throw validationError([{ field: 'month', message: 'Tháng theo dạng YYYY-MM' }]);
    }
    return this.partner.summary(chosen);
  }

  @Get('finance')
  async finance(@Req() request: Request, @Query('from') from: string | undefined, @Query('to') to: string | undefined) {
    await this.partner.authenticate(request, 'finance');
    if (!from || !to || !DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || from > to) {
      throw validationError([{ field: 'from', message: 'Khoảng ngày from, to theo dạng YYYY-MM-DD' }]);
    }
    return this.partner.finance(from, to);
  }

  @Get('children')
  async children(@Req() request: Request) {
    const client = await this.partner.authenticate(request, 'children');
    return this.partner.children(client, request.ip ?? null);
  }

  @Get('staff')
  async staff(@Req() request: Request) {
    const client = await this.partner.authenticate(request, 'staff');
    return this.partner.staff(client, request.ip ?? null);
  }
}
