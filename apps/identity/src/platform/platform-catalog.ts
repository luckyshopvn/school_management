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
} from '@nestjs/common';
import {
  CATALOG_LEVELS,
  CATALOG_QUALITY_FLAGS,
  CatalogImportError,
  catalogDepartments,
  catalogStatistics,
  catalogUnitByCode,
  importSchoolCatalog,
  searchCatalogUnits,
  writeAudit,
  type PlatformDatabase,
  type TenancyRuntime,
} from '@school-management/database';
import { ApplicationError, validationError } from '@school-management/server';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { TENANCY_RUNTIME } from '../common/configuration.js';
import { readLoginPageSettings } from '../directory/unit-directory.js';
import { PlatformSchoolsService } from './platform-schools.js';

// Danh mục đơn vị toàn quốc ở cổng nền tảng (DT-24, YCTD-220; tài liệu 32 mục 16): xem số liệu và lần nhập, tìm đơn vị (kèm cờ chất
// lượng, trường đã gắn), nhập hoặc cập nhật từ CSV (gửi nguyên văn bản tệp, tối đa 20 MB, chạy thử được), gắn trường đã khởi tạo
// với một đơn vị (mã Bộ), cấu hình tiêu đề và chân trang của trang đăng nhập ở tên miền chung
export const CATALOG_IMPORT_PATH = '/api/v1/auth/platform/catalog/import';

function notFound(): ApplicationError {
  return new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
}

function text(value: unknown, maximum = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

@Injectable()
export class PlatformCatalogService {
  constructor(@Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null) {}

  private get platform(): Kysely<PlatformDatabase> {
    if (!this.tenancy) {
      throw notFound();
    }
    return this.tenancy.platform;
  }

  async overview() {
    return {
      ...(await catalogStatistics(this.platform)),
      levels: CATALOG_LEVELS.map((level) => ({ code: level.code, name: level.name })),
      flag_labels: CATALOG_QUALITY_FLAGS,
      department_list: await catalogDepartments(this.platform),
    };
  }

  async units(query: Record<string, unknown>) {
    const department = text(query.department, 2);
    if (!/^\d{2}$/.test(department)) {
      throw validationError([{ field: 'department', message: 'Chọn sở' }]);
    }
    const number = (value: unknown) => (typeof value === 'string' && value !== '' ? Number(value) : undefined);
    const page = await searchCatalogUnits(this.platform, {
      department,
      level: text(query.level, 10) || null,
      commune: text(query.commune, 5) || null,
      q: text(query.q, 100) || null,
      flag: text(query.flag, 40) || null,
      includeInactive: query.include_inactive === 'true',
      ...(number(query.limit) !== undefined ? { limit: number(query.limit) as number } : {}),
      ...(number(query.offset) !== undefined ? { offset: number(query.offset) as number } : {}),
    });
    const linked = page.items.length
      ? await this.platform
          .selectFrom('schools')
          .select(['code', 'moet_code'])
          .where(
            'moet_code',
            'in',
            page.items.map((item) => item.moet_code),
          )
          .where('status', '!=', 'deleted')
          .execute()
      : [];
    return {
      items: page.items.map((item) => ({
        ...item,
        school_code: linked.find((school) => school.moet_code === item.moet_code)?.code ?? null,
      })),
      has_more: page.has_more,
    };
  }

  async unit(code: string) {
    const unit = await catalogUnitByCode(this.platform, code);
    if (!unit) {
      throw notFound();
    }
    return unit;
  }

  async import(request: Request, query: Record<string, unknown>, actor: { id: string; name: string }) {
    const body = typeof request.body === 'string' ? request.body : '';
    if (!body.trim()) {
      throw validationError([{ field: 'file', message: 'Chọn tệp CSV (UTF-8)' }]);
    }
    const kind = text(query.kind, 20) === 'communes' ? 'communes' : 'units';
    try {
      return await importSchoolCatalog(this.platform, {
        ...(kind === 'units' ? { unitsCsv: body } : { communesCsv: body }),
        source: text(query.source, 60) || 'cong-nen-tang',
        fileName: text(query.file_name, 200) || null,
        dryRun: query.dry_run === 'true',
        deactivateMissing: query.deactivate_missing === 'true',
        actor: { type: 'operator', id: actor.id, name: actor.name },
      });
    } catch (error) {
      if (error instanceof CatalogImportError) {
        throw validationError([{ field: 'file', message: error.message }]);
      }
      throw error;
    }
  }

  // Gắn trường đã khởi tạo với đơn vị trong danh mục; mỗi mã chỉ một trường; gửi null để gỡ
  async linkSchool(code: string, body: Record<string, unknown> | undefined, actor: { id: string; name: string }) {
    const school = await this.platform
      .selectFrom('schools')
      .select(['id', 'moet_code'])
      .where('code', '=', code)
      .executeTakeFirst();
    if (!school) {
      throw notFound();
    }
    const moetCode = text(body?.moet_code, 40) || null;
    if (moetCode) {
      if (!(await catalogUnitByCode(this.platform, moetCode))) {
        throw validationError([{ field: 'moet_code', message: 'Mã không có trong danh mục đơn vị' }]);
      }
      const taken = await this.platform
        .selectFrom('schools')
        .select('code')
        .where('moet_code', '=', moetCode)
        .where('id', '!=', school.id)
        .executeTakeFirst();
      if (taken) {
        throw validationError([{ field: 'moet_code', message: `Mã đã gắn với trường ${taken.code}` }]);
      }
    }
    await this.platform.updateTable('schools').set({ moet_code: moetCode }).where('id', '=', school.id).execute();
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'school.catalog-unit',
      schoolId: school.id,
      details: { before: school.moet_code, after: moetCode },
    });
    this.tenancy?.registry.invalidate();
    return { code, moet_code: moetCode };
  }

  loginPage() {
    return readLoginPageSettings(this.platform);
  }

  async updateLoginPage(body: Record<string, unknown> | undefined, actor: { id: string; name: string }) {
    const title = text(body?.title, 120);
    const subtitle = text(body?.subtitle, 120);
    const lines = Array.isArray(body?.support_lines)
      ? body.support_lines.map((line) => text(line, 200)).filter((line) => line !== '')
      : [];
    if (!title) {
      throw validationError([{ field: 'title', message: 'Nhập tiêu đề trang đăng nhập' }]);
    }
    if (lines.length > 6) {
      throw validationError([{ field: 'support_lines', message: 'Tối đa 6 dòng thông tin hỗ trợ' }]);
    }
    const value = JSON.stringify({ title, subtitle, support_lines: lines });
    await this.platform
      .insertInto('platform_settings')
      .values({ key: 'login_page', value, updated_at: new Date() })
      .onConflict((conflict) => conflict.column('key').doUpdateSet({ value, updated_at: new Date() }))
      .execute();
    await writeAudit(this.platform, {
      actorType: 'operator',
      actorId: actor.id,
      action: 'platform.login-page',
      details: { title, subtitle, support_lines: lines },
    });
    return readLoginPageSettings(this.platform);
  }
}

@Controller('auth/platform')
export class PlatformCatalogController {
  constructor(
    private readonly catalog: PlatformCatalogService,
    private readonly schools: PlatformSchoolsService,
  ) {}

  private async actor(request: Request) {
    const actor = await this.schools.actor(request);
    return { id: actor.id ?? '', name: actor.name };
  }

  @Get('catalog')
  async overview(@Req() request: Request) {
    await this.actor(request);
    return this.catalog.overview();
  }

  @Get('catalog/units')
  async units(@Query() query: Record<string, unknown>, @Req() request: Request) {
    await this.actor(request);
    return this.catalog.units(query);
  }

  @Get('catalog/unit')
  async unit(@Query('code') code: string | undefined, @Req() request: Request) {
    await this.actor(request);
    return this.catalog.unit(text(code, 40));
  }

  @Post('catalog/import')
  @HttpCode(200)
  async import(@Query() query: Record<string, unknown>, @Req() request: Request) {
    return this.catalog.import(request, query, await this.actor(request));
  }

  @Put('schools/:code/catalog-unit')
  async link(@Param('code') code: string, @Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    return this.catalog.linkSchool(code, body, await this.actor(request));
  }

  @Get('login-page')
  async loginPage(@Req() request: Request) {
    await this.actor(request);
    return this.catalog.loginPage();
  }

  @Put('login-page')
  async updateLoginPage(@Body() body: Record<string, unknown> | undefined, @Req() request: Request) {
    return this.catalog.updateLoginPage(body, await this.actor(request));
  }
}
