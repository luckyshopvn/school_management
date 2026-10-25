import { Controller, Get, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Clock, currentTenant } from '@school-management/server';
import { type SchoolPlanView } from '@school-management/shared';
import type { Request } from 'express';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { assertStorageCapacity, countActiveStudents, usedStorageMb } from '../common/plan-limits.js';

// Gói dịch vụ của trường ở máy chủ API (DT-SaaS phần S5a, YCTD-194; tài liệu 32 mục 14.5): ứng dụng của trường đọc gói hiện hành,
// phân hệ được bật, giới hạn, mức đang dùng, trạng thái và hạn để ẩn mục menu ngoài gói, nhắc hạn, báo chế độ chỉ đọc. Chế độ một
// trường và trường chưa gán gói trả `restricted: false`
const DAY = 86_400_000;

function vietnamToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}

@Injectable()
export class SchoolPlanService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  async view(): Promise<SchoolPlanView> {
    const tenant = currentTenant();
    const empty: SchoolPlanView = {
      restricted: false,
      status: null,
      plan: null,
      modules: null,
      limits: { max_active_students: null, max_storage_mb: null, max_school_levels: null },
      usage: { active_students: null, storage_mb: null },
      due_on: null,
      days_left: null,
      read_only: false,
    };
    if (!tenant) {
      return empty;
    }
    const status = ['trial', 'active', 'read_only', 'suspended'].includes(tenant.status)
      ? (tenant.status as SchoolPlanView['status'])
      : null;
    const dueOn = tenant.status === 'trial' ? (tenant.trialEndsOn ?? null) : (tenant.paidUntil ?? null);
    const today = vietnamToday(this.clock.now());
    const plan = tenant.plan ?? null;
    const current = await this.currentSchoolYear.find();
    const [students, storage] = plan
      ? await Promise.all([
          current ? countActiveStudents(current.database) : Promise.resolve(null),
          usedStorageMb(this.databases.system, current?.database ?? null),
        ])
      : [null, null];
    return {
      restricted: plan !== null,
      status,
      plan: plan ? { code: plan.code, name: plan.name } : null,
      modules: plan?.modules ?? null,
      limits: {
        max_active_students: plan?.maxActiveStudents ?? null,
        max_storage_mb: plan?.maxStorageMb ?? null,
        max_school_levels: plan?.maxSchoolLevels ?? null,
      },
      usage: { active_students: students, storage_mb: storage },
      due_on: dueOn,
      days_left: dueOn ? Math.round((Date.parse(`${dueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY) : null,
      read_only: tenant.status === 'read_only',
    };
  }
}

// Mọi người dùng đã đăng nhập của trường đọc được (để ẩn menu, hiện nhắc hạn); không cần quyền riêng
@Controller('school-plan')
export class SchoolPlanController {
  constructor(private readonly plans: SchoolPlanService) {}

  @Get()
  view() {
    return this.plans.view();
  }
}

// Giới hạn dung lượng tệp của gói: chặn yêu cầu tải tệp lên (multipart) khi đã hết dung lượng; không chặn xem, xóa tệp
@Injectable()
export class PlanStorageGuard implements CanActivate {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const plan = currentTenant()?.plan;
    if (!plan || plan.maxStorageMb === null || context.getType() !== 'http') {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    if (!['POST', 'PUT', 'PATCH'].includes(request.method) || !request.is('multipart/form-data')) {
      return true;
    }
    const current = await this.currentSchoolYear.find();
    await assertStorageCapacity(
      this.databases.system,
      current?.database ?? null,
      Number(request.header('content-length') ?? 0),
    );
    return true;
  }
}
