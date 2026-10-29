import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Optional,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import {
  ADMIN_UNIT_LEVEL_LABELS,
  ADMIN_UNIT_LEVELS,
  AGGREGATE_CATEGORIES,
  AGGREGATE_CATEGORY_LABELS,
  aggregateForUnit,
  isAdminUnitLevel,
  isAggregateCategory,
  recordAggregateSnapshot,
  subtreeUnitIds,
  writeAudit,
  type AdminUnitLevel,
  type AggregateCategory,
  type AggregateView,
  type IdentityDatabase,
  type PlatformDatabase,
  type TenancyRuntime,
} from '@school-management/database';
import {
  ApplicationError,
  Clock,
  currentTenant,
  extractTenantHost,
  isMultiTenantMode,
  normalizeHost,
  ParentOrgTokenVerifier,
  readBearerToken,
  unauthenticatedError,
  validationError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { sql, type Kysely } from 'kysely';
import { AuthenticatedUser, PublicEndpoint, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { actorNameOf, originOf, writeAuditLog } from '../common/audit-log.js';
import { API_CONFIGURATION, TENANCY_RUNTIME, type ApiConfiguration } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { JobScheduler } from '../common/job-scheduler.js';
import { buildTableFile, CONTENT_TYPES, readTableFileFormat, type TableFileSheet } from '../exports/table-file.js';

// Đơn vị cấp trên ở máy chủ API (DT-SaaS phần S6, YCTD-202; tài liệu 32 mục 14.5 "S6"). Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11:
// - việc định kỳ `aggregate-snapshots` (mặc định 6 giờ, AGGREGATE_SNAPSHOT_INTERVAL_SECONDS) chạy trong ngữ cảnh từng trường, đọc
//   năm học đang dùng và tính bản chụp sáu nhóm (quy mô, chuyên cần 30 ngày, kết quả học tập, cơ sở vật chất, nhân sự, EMIS): chỉ
//   số đếm, không tên, không mã học sinh; ghi vào aggregate_snapshots của nền tảng;
// - quản trị của trường (P01.setting.manage) bật, tắt đồng ý theo cấp (Bộ, Sở, Phòng) và nhóm số liệu; duyệt, từ chối, rút đề
//   nghị xem chi tiết của cấp trên (rút thì kết thúc phiên xem chi tiết đang mở);
// - tài khoản cấp trên đọc số liệu tổng hợp ở `/api/v1/parent-org/*` (đường dẫn không cần trường, mã phiên cấp trên): chỉ nút trong
//   cây con của mình, chỉ trường đã đồng ý cho cấp của mình; xuất Excel, PDF; mỗi lần xem, xuất ghi nhật ký nền tảng.
export const PARENT_ORG_PATH_PREFIX = '/api/v1/parent-org/';
export const AGGREGATE_SNAPSHOT_JOB = 'aggregate-snapshots';
const ATTENDANCE_DAYS = 30;
const PRESENT_STATUSES = ['present', 'late', 'early_leave', 'late_and_early_leave'];

export function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
}

function countsBy(rows: Array<{ key: string | null; count: string | number }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.key ?? 'khac'] = Number(row.count);
  }
  return out;
}

@Injectable()
export class AggregateSnapshotService implements OnApplicationBootstrap {
  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
    @Optional() @Inject(JobScheduler) private readonly scheduler: JobScheduler | null = null,
  ) {}

  onApplicationBootstrap() {
    if (isMultiTenantMode()) {
      this.scheduler?.register({
        name: AGGREGATE_SNAPSHOT_JOB,
        intervalSeconds: this.configuration.aggregateSnapshotIntervalSeconds ?? 21_600,
        run: async () => {
          await this.capture();
        },
      });
    }
  }

  // Bản chụp của trường đang chạy (ngữ cảnh trường của bộ lập lịch); trường chưa có năm học đang dùng thì bỏ qua
  async capture(): Promise<number> {
    const tenant = currentTenant();
    const current = await this.currentSchoolYear.find();
    if (!this.tenancy || !tenant || !current) {
      return 0;
    }
    const year = current.database;
    const system = this.databases.system;
    const academicYear =
      (
        await system
          .selectFrom('academic_years')
          .select('name')
          .where('id', '=', current.academicYearId)
          .executeTakeFirst()
      )?.name ?? null;
    const since = new Date(this.clock.now().getTime() - ATTENDANCE_DAYS * 86_400_000).toISOString().slice(0, 10);
    const [classes, students, genders, grades, attendance, results, progress, rooms, roomConditions, staff, emis] =
      await Promise.all([
        year
          .selectFrom('classes')
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .where('status', '=', 'active')
          .executeTakeFirstOrThrow(),
        year
          .selectFrom('children')
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .where('status', '=', 'active')
          .where('deleted_at', 'is', null)
          .executeTakeFirstOrThrow(),
        year
          .selectFrom('children')
          .select(['gender as key', (eb) => eb.fn.countAll<string>().as('count')])
          .where('status', '=', 'active')
          .where('deleted_at', 'is', null)
          .groupBy('gender')
          .execute(),
        year
          .selectFrom('class_enrollments')
          .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
          .innerJoin('children', 'children.id', 'class_enrollments.child_id')
          .select(['classes.grade_level as key', (eb) => eb.fn.countAll<string>().as('count')])
          .where('class_enrollments.is_current', '=', true)
          .where('children.status', '=', 'active')
          .where('children.deleted_at', 'is', null)
          .groupBy('classes.grade_level')
          .execute(),
        year
          .selectFrom('attendance_records')
          .select((eb) => [
            eb.fn.countAll<string>().as('records'),
            eb.fn
              .count<string>(
                eb
                  .case()
                  .when('status', 'in', PRESENT_STATUSES as never[])
                  .then(1)
                  .end(),
              )
              .as('present'),
            eb.fn.count<string>(sql`distinct attendance_date`).as('days'),
          ])
          .where('attendance_date', '>=', since)
          .executeTakeFirstOrThrow(),
        year
          .selectFrom('subject_term_results')
          .select(['result as key', (eb) => eb.fn.countAll<string>().as('count')])
          .where('result', 'is not', null)
          .groupBy('result')
          .execute(),
        year
          .selectFrom('child_progress')
          .select(['level as key', (eb) => eb.fn.countAll<string>().as('count')])
          .groupBy('level')
          .execute(),
        year
          .selectFrom('rooms')
          .select((eb) => [
            eb.fn.countAll<string>().as('count'),
            eb.fn.sum<string>(sql`coalesce(area_m2, 0)`).as('area'),
          ])
          .where('status', '=', 'active')
          .executeTakeFirstOrThrow(),
        year
          .selectFrom('rooms')
          .select(['condition as key', (eb) => eb.fn.countAll<string>().as('count')])
          .where('status', '=', 'active')
          .groupBy('condition')
          .execute(),
        year
          .selectFrom('staff')
          .select(['gender as key', (eb) => eb.fn.countAll<string>().as('count')])
          .where('status', '=', 'active')
          .groupBy('gender')
          .execute(),
        year
          .selectFrom('emis_report_values')
          .select(['form_code as key', (eb) => eb.fn.countAll<string>().as('count')])
          .groupBy('form_code')
          .execute(),
      ]);
    const gender = countsBy(genders);
    const staffGender = countsBy(staff);
    const records = Number(attendance.records);
    const present = Number(attendance.present);
    const learning = countsBy(results);
    const forms = countsBy(emis);
    const snapshots: Record<AggregateCategory, Record<string, unknown>> = {
      scale: {
        classes: Number(classes.count),
        students: Number(students.count),
        students_male: gender.male ?? 0,
        students_female: gender.female ?? 0,
        students_by_grade: countsBy(grades),
      },
      attendance: {
        days: Number(attendance.days),
        records,
        present,
        absent: records - present,
        rate: records > 0 ? Math.round((present / records) * 1000) / 10 : 0,
      },
      learning: {
        subject_results_pass: learning.pass ?? 0,
        subject_results_fail: learning.fail ?? 0,
        progress_levels: countsBy(progress),
      },
      facilities: {
        rooms: Number(rooms.count),
        area_m2: Math.round(Number(rooms.area ?? 0) * 10) / 10,
        rooms_by_condition: countsBy(roomConditions),
      },
      staff: {
        staff: Object.values(staffGender).reduce((sum, value) => sum + value, 0),
        staff_male: staffGender.male ?? 0,
        staff_female: staffGender.female ?? 0,
      },
      emis: {
        forms: forms,
        rows: Object.values(forms).reduce((sum, value) => sum + value, 0),
      },
    };
    const now = this.clock.now();
    for (const category of AGGREGATE_CATEGORIES) {
      await recordAggregateSnapshot(
        this.tenancy.platform,
        tenant.schoolId,
        category,
        academicYear,
        snapshots[category],
        now,
      );
    }
    return AGGREGATE_CATEGORIES.length;
  }
}

// Phía trường: đồng ý theo cấp, nhóm số liệu; đề nghị xem chi tiết của cấp trên
@Injectable()
export class SchoolParentOrgService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  private context(): { platform: Kysely<PlatformDatabase>; schoolId: string } | null {
    const tenant = currentTenant();
    return this.tenancy && tenant ? { platform: this.tenancy.platform, schoolId: tenant.schoolId } : null;
  }

  private require() {
    const context = this.context();
    if (!context) {
      throw notFound();
    }
    return context;
  }

  async overview() {
    const context = this.context();
    if (!context) {
      return { available: false, chain: [], consents: [], history: [], requests: [], levels: [], categories: [] };
    }
    const { platform, schoolId } = context;
    const school = await platform
      .selectFrom('schools')
      .select('admin_unit_id')
      .where('id', '=', schoolId)
      .executeTakeFirstOrThrow();
    // Chuỗi đơn vị quản lý từ nút của trường lên Bộ
    const chain = school.admin_unit_id
      ? (
          await sql<{ id: string; code: string; name: string; level: AdminUnitLevel; depth: number }>`
            with recursive up as (
              select id, code, name, level, parent_id, 0 as depth from admin_units where id = ${school.admin_unit_id}
              union all
              select parent.id, parent.code, parent.name, parent.level, parent.parent_id, up.depth + 1
              from admin_units parent join up on parent.id = up.parent_id
            )
            select id, code, name, level, depth from up order by depth`.execute(platform)
        ).rows
      : [];
    const consents = await platform
      .selectFrom('school_aggregate_consents')
      .selectAll()
      .where('school_id', '=', schoolId)
      .orderBy('granted_at', 'desc')
      .limit(200)
      .execute();
    const requests = await platform
      .selectFrom('parent_org_access_requests')
      .selectAll()
      .where('school_id', '=', schoolId)
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute();
    return {
      available: true,
      chain,
      levels: ADMIN_UNIT_LEVELS.map((key) => ({ key, label: ADMIN_UNIT_LEVEL_LABELS[key] })),
      categories: AGGREGATE_CATEGORIES.map((key) => ({ key, label: AGGREGATE_CATEGORY_LABELS[key] })),
      consents: consents.filter((row) => !row.revoked_at),
      history: consents,
      requests,
    };
  }

  // Bật, tắt nhiều ô cùng lúc: items [{ level, category, granted }]
  async setConsents(body: Record<string, unknown> | undefined, currentUser: CurrentUser, request: Request) {
    const { platform, schoolId } = this.require();
    if (currentUser.description.support) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Phiên hỗ trợ không đổi đồng ý của trường');
    }
    const items = Array.isArray(body?.items) ? (body.items as Array<Record<string, unknown>>) : [];
    if (
      !items.length ||
      items.some(
        (item) =>
          !isAdminUnitLevel(item.level) || !isAggregateCategory(item.category) || typeof item.granted !== 'boolean',
      )
    ) {
      throw validationError([{ field: 'items', message: 'Mỗi dòng có cấp, nhóm số liệu, granted đúng hoặc sai' }]);
    }
    const now = this.clock.now();
    const actor = actorNameOf(currentUser);
    const changes: Array<{ level: string; category: string; granted: boolean }> = [];
    await platform.transaction().execute(async (transaction) => {
      for (const item of items) {
        const level = item.level as AdminUnitLevel;
        const category = item.category as AggregateCategory;
        const active = await transaction
          .selectFrom('school_aggregate_consents')
          .select('id')
          .where('school_id', '=', schoolId)
          .where('level', '=', level)
          .where('category', '=', category)
          .where('revoked_at', 'is', null)
          .executeTakeFirst();
        if (item.granted && !active) {
          await transaction
            .insertInto('school_aggregate_consents')
            .values({
              school_id: schoolId,
              level,
              category,
              granted_at: now,
              granted_by_user_id: currentUser.id,
              granted_by_name: actor,
            })
            .execute();
          changes.push({ level, category, granted: true });
        } else if (!item.granted && active) {
          await transaction
            .updateTable('school_aggregate_consents')
            .set({ revoked_at: now, revoked_by_name: actor })
            .where('id', '=', active.id)
            .execute();
          changes.push({ level, category, granted: false });
        }
      }
    });
    if (changes.length) {
      await writeAudit(platform, {
        actorType: 'system',
        action: 'parent-org.consent-changed',
        schoolId,
        details: { by: actor, changes },
      });
      await this.audit(request, currentUser, schoolId, 'update', null, { changes });
    }
    return { changed: changes.length, ...(await this.overview()) };
  }

  async decide(id: string, decision: 'approve' | 'reject' | 'revoke', currentUser: CurrentUser, request: Request) {
    const { platform, schoolId } = this.require();
    if (currentUser.description.support) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Phiên hỗ trợ không duyệt đề nghị xem chi tiết');
    }
    const row = await platform
      .selectFrom('parent_org_access_requests')
      .selectAll()
      .where('id', '=', id)
      .where('school_id', '=', schoolId)
      .executeTakeFirst();
    if (!row) {
      throw notFound();
    }
    const now = this.clock.now();
    const actor = actorNameOf(currentUser);
    if (decision === 'revoke') {
      if (row.status !== 'approved') {
        throw validationError([{ field: 'status', message: 'Chỉ rút được đề nghị đã duyệt' }]);
      }
      await platform
        .updateTable('parent_org_access_requests')
        .set({ status: 'revoked', revoked_at: now })
        .where('id', '=', id)
        .execute();
      await this.endSessions(platform, id, now);
    } else {
      if (row.status !== 'pending') {
        throw validationError([{ field: 'status', message: 'Đề nghị đã được xử lý' }]);
      }
      await platform
        .updateTable('parent_org_access_requests')
        .set({
          status: decision === 'approve' ? 'approved' : 'rejected',
          decided_at: now,
          decided_by_name: actor,
          expires_at: decision === 'approve' ? new Date(now.getTime() + row.hours * 3_600_000) : null,
        })
        .where('id', '=', id)
        .execute();
    }
    await writeAudit(platform, {
      actorType: 'system',
      action: `parent-org.access-${decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'revoked'}`,
      schoolId,
      details: { request_id: id, by: actor, user_id: row.user_id },
    });
    await this.audit(request, currentUser, id, 'update', { status: row.status }, { decision });
    return { id, decision };
  }

  // Rút đề nghị: kết thúc phiên xem chi tiết đang mở, thu hồi phiên đăng nhập của tài khoản hỗ trợ ngay
  private async endSessions(platform: Kysely<PlatformDatabase>, requestId: string, now: Date) {
    const sessions = await platform
      .updateTable('support_sessions')
      .set({ ended_at: now, end_reason: 'revoked' })
      .where('access_request_id', '=', requestId)
      .where('ended_at', 'is', null)
      .returning('identity_session_id')
      .execute();
    const ids = sessions
      .map((session) => session.identity_session_id)
      .filter((value): value is string => Boolean(value));
    const tenant = currentTenant();
    if (ids.length && this.tenancy && tenant) {
      await this.tenancy.connections
        .database<IdentityDatabase>(tenant, 'identity', 'identity')
        .updateTable('sessions')
        .set({ revoked_at: now })
        .where('id', 'in', ids)
        .where('revoked_at', 'is', null)
        .execute();
    }
  }

  private async audit(
    request: Request,
    currentUser: CurrentUser,
    id: string,
    action: 'update',
    before: unknown,
    after: unknown,
  ) {
    const current = await this.currentSchoolYear.find();
    if (current) {
      await writeAuditLog(current.database, {
        origin: originOf(request, currentUser),
        orgUnitId: null,
        entityName: 'parent_org_consents',
        entityId: id,
        action,
        before,
        after,
      });
    }
  }
}

@Controller('parent-org-consents')
export class SchoolParentOrgController {
  constructor(private readonly service: SchoolParentOrgService) {}

  @Get()
  @RequirePermission(PERMISSION_CODES.settingManage)
  overview() {
    return this.service.overview();
  }

  @Put()
  @RequirePermission(PERMISSION_CODES.settingManage)
  set(
    @Body() body: Record<string, unknown> | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    return this.service.setConsents(body, currentUser, request);
  }

  @Post('requests/:id/:decision')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.settingManage)
  decide(
    @Param('id') id: string,
    @Param('decision') decision: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Req() request: Request,
  ) {
    if (!['approve', 'reject', 'revoke'].includes(decision)) {
      throw notFound();
    }
    return this.service.decide(id, decision as 'approve' | 'reject' | 'revoke', currentUser, request);
  }
}

// Phía cấp trên: số liệu tổng hợp theo nút và nhóm; đường dẫn không cần trường, mã phiên cấp trên
@Injectable()
export class ParentOrgDataService {
  private readonly verifier: ParentOrgTokenVerifier;

  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly clock: Clock,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {
    this.verifier = new ParentOrgTokenVerifier(
      configuration.tokenPublicKeyPem,
      configuration.tokenPreviousPublicKeyPem ?? null,
    );
  }

  private get platform(): Kysely<PlatformDatabase> {
    if (!this.tenancy) {
      throw notFound();
    }
    return this.tenancy.platform;
  }

  // Chỉ phục vụ ở tên miền của cổng nền tảng như trang đăng nhập cấp trên; tên miền khác (kể cả của trường) 404
  private assertConsoleHost(request: Request): void {
    const consoleHost = normalizeHost(this.configuration.platformConsoleHost ?? undefined);
    const tenancy = this.tenancy;
    if (!tenancy || !consoleHost) {
      throw notFound();
    }
    const host = extractTenantHost(
      request.headers,
      tenancy.configuration.hostSource,
      tenancy.configuration.edgeSecret ?? undefined,
    );
    if (host !== consoleHost) {
      throw notFound();
    }
  }

  async user(request: Request) {
    this.assertConsoleHost(request);
    const userId = await this.verifier.verify(readBearerToken(request.header('authorization')), this.clock.now());
    const user = await this.platform
      .selectFrom('parent_org_users')
      .innerJoin('admin_units', 'admin_units.id', 'parent_org_users.admin_unit_id')
      .select(['parent_org_users.id', 'parent_org_users.status', 'admin_units.id as unit_id', 'admin_units.level'])
      .where('parent_org_users.id', '=', userId)
      .executeTakeFirst();
    if (!user || user.status !== 'active') {
      throw unauthenticatedError();
    }
    return user;
  }

  async view(request: Request, unitInput: unknown, categoryInput: unknown): Promise<AggregateView> {
    const user = await this.user(request);
    const unitId = typeof unitInput === 'string' && unitInput ? unitInput : user.unit_id;
    if (!isAggregateCategory(categoryInput)) {
      throw validationError([{ field: 'category', message: 'Nhóm số liệu không hợp lệ' }]);
    }
    const scope = await subtreeUnitIds(this.platform, user.unit_id);
    if (!scope.includes(unitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Nút không thuộc phạm vi của đơn vị');
    }
    const view = await aggregateForUnit(
      this.platform,
      unitId,
      user.level,
      categoryInput,
      this.configuration.parentOrgMinGroup ?? 5,
    );
    await writeAudit(this.platform, {
      actorType: 'system',
      action: 'parent-org.aggregate-view',
      details: { user_id: user.id, unit_id: unitId, category: categoryInput, schools: view.schools_count },
    });
    return view;
  }

  async exportFile(request: Request, unit: unknown, category: unknown, format: unknown) {
    const fileFormat = readTableFileFormat(format) ?? 'xlsx';
    const view = await this.view(request, unit, category);
    const buffer = await buildTableFile(
      fileFormat,
      [...aggregateSheets(view, 'compare', 'So sánh trường'), ...aggregateSheets(view, 'summary', 'Tổng hợp')],
      this.clock.now(),
    );
    return {
      buffer,
      contentType: CONTENT_TYPES[fileFormat],
      fileName: `tong-hop-${view.unit.code}-${view.category}.${fileFormat}`,
    };
  }
}

// Bảng của tệp xuất số liệu tổng hợp (DT-SaaS S6; dùng chung cho tải trực tiếp và xuất chạy nền YCTD-367): "so sánh từng trường" (trường
// đã đồng ý, mỗi dòng một trường) hoặc "tổng hợp theo đơn vị" (đơn vị và đơn vị con). Ô bị ẩn ghi "ẩn"
export type AggregateLayout = 'summary' | 'compare';

function flattenMetrics(metrics: Record<string, unknown> | null, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metrics ?? {})) {
    if (value && typeof value === 'object') {
      Object.assign(out, flattenMetrics(value as Record<string, unknown>, `${prefix}${key}.`));
    } else {
      out[`${prefix}${key}`] = value === null ? 'ẩn' : value;
    }
  }
  return out;
}

export function aggregateSheets(view: AggregateView, layout: AggregateLayout, title: string): TableFileSheet[] {
  const schools = view.schools.map((school) => ({
    name: school.name,
    code: school.code,
    ...flattenMetrics(school.metrics),
  }));
  const keys = [
    ...new Set(schools.flatMap((row) => Object.keys(row)).filter((key) => key !== 'name' && key !== 'code')),
  ];
  if (layout === 'compare') {
    return [
      {
        title,
        heading: [
          `${view.unit.name}: ${AGGREGATE_CATEGORY_LABELS[view.category]}`,
          `${view.schools_count} trường đã đồng ý; ô ít hơn ${view.min_group} người ghi "ẩn"`,
        ],
        columns: [
          { key: 'name', label: 'Trường', width: 36 },
          { key: 'code', label: 'Mã', width: 12 },
          ...keys.map((key) => ({ key, label: key, width: 14 })),
        ],
        rows: schools,
        numbered: true,
      },
    ];
  }
  return [
    {
      title,
      heading: [`${view.unit.name}: ${AGGREGATE_CATEGORY_LABELS[view.category]}`],
      columns: [
        { key: 'name', label: 'Đơn vị', width: 40 },
        { key: 'schools_count', label: 'Số trường', width: 10 },
        ...keys.map((key) => ({ key, label: key, width: 14 })),
      ],
      rows: [
        { name: view.unit.name, schools_count: view.schools_count, ...flattenMetrics(view.total) },
        ...view.children.map((child) => ({
          name: child.name,
          schools_count: child.schools_count,
          ...flattenMetrics(child.total),
        })),
      ],
    },
  ];
}

@Controller('parent-org')
@PublicEndpoint()
export class ParentOrgDataController {
  constructor(private readonly data: ParentOrgDataService) {}

  @Get('aggregate')
  aggregate(
    @Query('unit') unit: string | undefined,
    @Query('category') category: string | undefined,
    @Req() request: Request,
  ) {
    return this.data.view(request, unit, category);
  }

  @Get('aggregate/export')
  async export(
    @Query('unit') unit: string | undefined,
    @Query('category') category: string | undefined,
    @Query('format') format: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const file = await this.data.exportFile(request, unit, category, format);
    response.setHeader('content-type', file.contentType);
    response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    response.setHeader('cache-control', 'no-store');
    response.send(file.buffer);
  }
}
