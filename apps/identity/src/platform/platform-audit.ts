import { Controller, Get, Inject, Injectable, Optional, Query, Req, Res } from '@nestjs/common';
import type { PlatformDatabase, TenancyRuntime } from '@school-management/database';
import { ApplicationError, validationError } from '@school-management/server';
import { operatorCan, operatorRolesFor } from '@school-management/shared';
import type { Request, Response } from 'express';
import { sql, type Kysely } from 'kysely';
import { TENANCY_RUNTIME } from '../common/configuration.js';
import { PlatformSchoolsService } from './platform-schools.js';

// Nhật ký truy cập và số liệu tổng quan của cổng vận hành (YCTD-324, theo thiết kế Eric duyệt ngày 2026-10-29): đọc platform_audit_log
// theo nhóm việc (vào trường, khởi tạo trường, bật tính năng trả phí, mọi việc), lọc theo trường, khoảng ngày; phân trang 50 dòng; xuất
// CSV đúng bộ lọc (tối đa 5.000 dòng). Không trả nội dung chi tiết thô: chỉ lý do, phạm vi, địa chỉ mạng đã ghi. Chỉ đọc
const PAGE_SIZE = 50;
const CSV_LIMIT = 5000;
const BOM = String.fromCharCode(0xfeff);

export const AUDIT_GROUPS = {
  entry: [
    'support.platform-admin-entry',
    'support.platform-access-requested',
    'support.session-requested',
    'support.session-started',
    'support.session-ended',
  ],
  provision: [
    'school.catalog-provision-requested',
    'school.provision-requested',
    'school.provisioned',
    'school.provision',
  ],
  features: ['school.addon-modules-changed'],
} as const;
type AuditGroup = keyof typeof AUDIT_GROUPS | 'all';

const ACTION_LABELS: Record<string, string> = {
  'support.platform-admin-entry': 'Quản trị nền tảng vào trường',
  'support.platform-access-requested': 'Vào trường với quyền quản trị nền tảng (mã hai lớp)',
  'support.session-requested': 'Mở phiên hỗ trợ theo cho phép của trường',
  'support.session-started': 'Bắt đầu phiên ở trường',
  'support.session-ended': 'Kết thúc phiên ở trường',
  'school.catalog-provision-requested': 'Khởi tạo trường ở lần mở đầu tiên',
  'school.provision-requested': 'Khởi tạo trường qua bước setup',
  'school.provisioned': 'Khởi tạo trường xong',
  'school.provision': 'Khởi tạo trường bằng lệnh',
  'school.addon-modules-changed': 'Đổi tính năng trả phí của trường',
};

function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
}

function text(value: unknown, maximum: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

export interface AuditFilter {
  group: AuditGroup;
  school: string;
  from: string | null;
  to: string | null;
  page: number;
}

export function readAuditFilter(query: Record<string, unknown>): AuditFilter {
  const group = text(query.group, 20) || 'all';
  if (group !== 'all' && !(group in AUDIT_GROUPS)) {
    throw validationError([{ field: 'group', message: 'Nhóm là entry, provision, features hoặc all' }]);
  }
  const date = (field: 'from' | 'to') => {
    const value = text(query[field], 10);
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw validationError([{ field, message: 'Ngày dạng YYYY-MM-DD' }]);
    }
    return value || null;
  };
  const page = Number(text(query.page, 6) || '1');
  if (!Number.isInteger(page) || page < 1) {
    throw validationError([{ field: 'page', message: 'Số trang từ 1' }]);
  }
  return { group: group as AuditGroup, school: text(query.school, 40), from: date('from'), to: date('to'), page };
}

function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  // Chặn công thức khi mở bằng bảng tính
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

@Injectable()
export class PlatformAuditService {
  constructor(@Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null) {}

  private get platform(): Kysely<PlatformDatabase> {
    if (!this.tenancy) {
      throw notFound();
    }
    return this.tenancy.platform;
  }

  private query(filter: AuditFilter) {
    let query = this.platform
      .selectFrom('platform_audit_log')
      .leftJoin('schools', 'schools.id', 'platform_audit_log.school_id')
      .leftJoin('platform_operators', (join) =>
        join.on(sql<boolean>`platform_operators.id::text = platform_audit_log.actor_id`),
      )
      .select([
        'platform_audit_log.id',
        'platform_audit_log.at',
        'platform_audit_log.action',
        'platform_audit_log.actor_type',
        'platform_audit_log.details',
        'schools.code as school_code',
        'schools.name as school_name',
        'platform_operators.full_name as operator_name',
      ]);
    if (filter.group !== 'all') {
      query = query.where('platform_audit_log.action', 'in', [...AUDIT_GROUPS[filter.group]]);
    }
    if (filter.school) {
      query = query.where('schools.code', '=', filter.school);
    }
    if (filter.from) {
      query = query.where('platform_audit_log.at', '>=', new Date(`${filter.from}T00:00:00+07:00`));
    }
    if (filter.to) {
      query = query.where(
        'platform_audit_log.at',
        '<',
        new Date(new Date(`${filter.to}T00:00:00+07:00`).getTime() + 86_400_000),
      );
    }
    return query.orderBy('platform_audit_log.at', 'desc').orderBy('platform_audit_log.id', 'desc');
  }

  private present(row: {
    id: string;
    at: Date;
    action: string;
    actor_type: string;
    details: unknown;
    school_code: string | null;
    school_name: string | null;
    operator_name: string | null;
  }) {
    const details = (row.details ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      at: row.at,
      action: row.action,
      label: ACTION_LABELS[row.action] ?? row.action,
      actor: row.operator_name ?? (row.actor_type === 'system' ? 'Hệ thống' : row.actor_type),
      school_code: row.school_code,
      school_name: row.school_name,
      reason: typeof details.reason === 'string' ? details.reason : null,
      scope: typeof details.scope === 'string' ? details.scope : null,
      ip: typeof details.ip === 'string' ? details.ip : null,
    };
  }

  async list(filter: AuditFilter) {
    const rows = await this.query(filter)
      .limit(PAGE_SIZE + 1)
      .offset((filter.page - 1) * PAGE_SIZE)
      .execute();
    return { items: rows.slice(0, PAGE_SIZE).map((row) => this.present(row)), has_more: rows.length > PAGE_SIZE };
  }

  async csv(filter: AuditFilter): Promise<string> {
    const rows = await this.query(filter).limit(CSV_LIMIT).execute();
    const header = ['Thời điểm', 'Việc', 'Người làm', 'Mã trường', 'Tên trường', 'Lý do', 'Phạm vi', 'Địa chỉ mạng'];
    const lines = rows.map((row) => {
      const item = this.present(row);
      return [
        item.at.toISOString(),
        item.label,
        item.actor,
        item.school_code,
        item.school_name,
        item.reason,
        item.scope,
        item.ip,
      ]
        .map(csvCell)
        .join(',');
    });
    // BOM để bảng tính đọc đúng tiếng Việt
    return BOM + `${[header.join(','), ...lines].join('\r\n')}\r\n`;
  }

  // Số liệu cho các ô ở trang Tổng quan; ô nào không có nguồn thì giao diện ẩn
  async summary(now: Date, includeActivity: boolean) {
    const since = new Date(now.getTime() - 7 * 86_400_000);
    const today = new Date(
      `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now)}T00:00:00+07:00`,
    );
    const [schools, addons, entries, recentSchools] = await Promise.all([
      this.platform
        .selectFrom('schools')
        .select([
          sql<string>`count(*)`.as('total'),
          sql<string>`count(*) filter (where created_at >= ${today})`.as('today'),
        ])
        .where('status', '!=', 'deleted')
        .executeTakeFirstOrThrow(),
      this.platform
        .selectFrom('schools')
        .select(sql<string>`count(*)`.as('count'))
        .where('status', '!=', 'deleted')
        .where(sql<boolean>`jsonb_array_length(addon_modules) > 0`)
        .executeTakeFirstOrThrow(),
      this.platform
        .selectFrom('platform_audit_log')
        .select(sql<string>`count(*)`.as('count'))
        .where('action', '=', 'support.platform-admin-entry')
        .where('at', '>=', since)
        .executeTakeFirstOrThrow(),
      this.platform
        .selectFrom('schools')
        .leftJoin('school_plans', (join) =>
          join.onRef('school_plans.school_id', '=', 'schools.id').on(sql<boolean>`school_plans.effective_to is null`),
        )
        .leftJoin('plans', 'plans.id', 'school_plans.plan_id')
        .select([
          'schools.code',
          'schools.name',
          'schools.status',
          'schools.moet_code',
          'schools.created_at',
          'plans.name as plan_name',
        ])
        .where('schools.status', '!=', 'deleted')
        .orderBy('schools.created_at', 'desc')
        .limit(8)
        .execute(),
    ]);
    return {
      schools_total: Number(schools.total),
      schools_today: Number(schools.today),
      schools_with_addons: Number(addons.count),
      admin_entries_7d: Number(entries.count),
      recent_schools: recentSchools,
      // Truy cập gần đây chỉ cho vai trò xem được nhật ký
      recent_activity: includeActivity
        ? (await this.list({ group: 'all', school: '', from: null, to: null, page: 1 })).items.slice(0, 6)
        : [],
    };
  }
}

@Controller('auth/platform')
export class PlatformAuditController {
  constructor(
    private readonly audit: PlatformAuditService,
    private readonly schools: PlatformSchoolsService,
  ) {}

  @Get('audit-log')
  async list(
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.schools.actor(request, operatorRolesFor('audit.view'));
    const filter = readAuditFilter(query);
    if (query.format === 'csv') {
      response.setHeader('content-type', 'text/csv; charset=utf-8');
      response.setHeader('content-disposition', 'attachment; filename="nhat-ky-truy-cap.csv"');
      return this.audit.csv(filter);
    }
    return this.audit.list(filter);
  }

  @Get('overview')
  async overview(@Req() request: Request) {
    const actor = await this.schools.actor(request, operatorRolesFor('overview.view'));
    return this.audit.summary(new Date(), operatorCan(actor.role, 'audit.view'));
  }
}
