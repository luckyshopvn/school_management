import { Controller, Get, Injectable, Query, Req, Res } from '@nestjs/common';
import { ApplicationError, Clock } from '@school-management/server';
import { ETHNIC_GROUPS, PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AdministrativeUnitsService } from '../administrative-units/administrative-units.js';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { fileStamp, sendWorkbook } from '../children/student-workbook.js';
import { ChildDataProtection } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import type { ImportCatalog } from '../imports/excel.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { buildMoetChildFile, loadMoetChildRows } from './moet-child-file.js';
import { logExportedFile, XLSX_TYPE } from './student-records-common.js';

// Công cụ của màn hình "4.1.2. Nhập học sinh từ Excel" (DT-16 phần 16g) cho tệp CSDL ngành 82 cột: tải file mẫu, tải file
// mẫu kèm dữ liệu (học sinh đang có để sửa rồi nhập lại), tra cứu danh mục (lớp, giới tính, trạng thái học sinh, dân tộc,
// quốc tịch, xã/phường mới, tổ/thôn/xóm đang dùng). Tải lên, kiểm tra, ghi dùng bộ nhập tệp CSDL ngành (YCTD-100)
const STUDENT_STATUSES = [
  'Đang học',
  'Chuyển đến kỳ 1',
  'Chuyển đến kỳ 2',
  'Chuyển đến trong hè',
  'Nghỉ học xin học lại kỳ 1',
  'Nghỉ học xin học lại kỳ 2',
  'Chuyển đi kỳ 1',
  'Chuyển đi kỳ 2',
  'Chuyển đi trong hè',
  'Thôi học kỳ 1',
  'Thôi học kỳ 2',
  'Thôi học trong hè',
];
const TEMPLATE_LIMIT = 2000;

@Injectable()
export class StudentImportToolsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly protection: ChildDataProtection,
    private readonly administrativeUnits: AdministrativeUnitsService,
    private readonly clock: Clock,
  ) {}

  private async scopeUnitIds(currentUser: CurrentUser) {
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.importChildren);
    return scope;
  }

  async catalogs(currentUser: CurrentUser): Promise<ImportCatalog[]> {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.scopeUnitIds(currentUser);
    let classQuery = database
      .selectFrom('classes')
      .innerJoin('org_units', 'org_units.id', 'classes.org_unit_id')
      .select(['classes.code', 'classes.name', 'org_units.name as unit_name'])
      .where('classes.status', '=', 'active');
    let hamletQuery = database
      .selectFrom('children')
      .select('children.moet_profile')
      .where('children.deleted_at', 'is', null)
      .where('children.moet_profile', 'is not', null);
    if (!scope.wholeSchool) {
      const ids = scope.orgUnitIds.length ? scope.orgUnitIds : [''];
      classQuery = classQuery.where('classes.org_unit_id', 'in', ids);
      hamletQuery = hamletQuery.where('children.org_unit_id', 'in', ids);
    }
    const classes = await classQuery.orderBy('classes.code').execute();
    // Tổ/thôn/xóm đang dùng trong hồ sơ, theo xã: chưa có danh mục tổ/thôn chính thức của Sở (Claude tự chọn)
    const hamlets = new Map<string, { code: string; name: string; note: string }>();
    for (const { moet_profile: profile } of await hamletQuery.execute()) {
      for (const prefix of ['permanent', 'hometown']) {
        const hamlet = typeof profile?.[`${prefix}_hamlet`] === 'string' ? (profile[`${prefix}_hamlet`] as string) : '';
        const ward = typeof profile?.[`${prefix}_ward`] === 'string' ? (profile[`${prefix}_ward`] as string) : '';
        if (hamlet) {
          hamlets.set(`${ward}|${hamlet}`, { code: hamlet, name: hamlet, note: ward });
        }
      }
    }
    const catalog = await this.administrativeUnits.catalog();
    return [
      {
        key: 'classes',
        title: 'Lớp học',
        column: 'Mã lớp',
        items: classes.map((row) => ({ code: row.code, name: row.name, note: row.unit_name })),
      },
      {
        key: 'genders',
        title: 'Giới tính',
        column: 'Giới tính',
        items: [
          { code: 'Nam', name: 'Nam' },
          { code: 'Nữ', name: 'Nữ' },
        ],
      },
      {
        key: 'student_statuses',
        title: 'Trạng thái học sinh',
        column: 'Trạng thái HS',
        items: STUDENT_STATUSES.map((name) => ({ code: name, name })),
      },
      {
        key: 'ethnic_groups',
        title: 'Dân tộc',
        column: 'Dân tộc, Dân tộc mẹ, Dân tộc cha',
        items: ETHNIC_GROUPS.map((name) => ({ code: name, name })),
      },
      {
        key: 'nationalities',
        title: 'Quốc tịch',
        column: 'Quốc tịch',
        items: [{ code: 'Việt Nam', name: 'Việt Nam' }],
      },
      {
        key: 'new_wards',
        title: 'Xã/Phường mới',
        column: 'Tỉnh/Thành phố, Xã/Phường của các nhóm địa chỉ',
        items: catalog
          .newWards()
          .map((ward) => ({ code: ward.code ?? '', name: ward.ward_name, note: ward.province_name })),
      },
      {
        key: 'hamlets',
        title: 'Tổ/Thôn/Xóm',
        column: 'Tổ/Thôn/Xóm (Theo địa chỉ thường trú, Theo quê quán)',
        items: [...hamlets.values()].sort((left, right) => left.note.localeCompare(right.note, 'vi')),
      },
    ];
  }

  // Tệp mẫu 82 cột; kèm dữ liệu thì điền học sinh chưa thôi học trong phạm vi (có số định danh đầy đủ nên cần quyền xem số
  // định danh và ghi nhật ký xuất)
  async template(currentUser: CurrentUser, withData: boolean, ipAddress: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const catalogs = await this.catalogs(currentUser);
    const createdAt = this.clock.now();
    if (!withData) {
      return { buffer: await buildMoetChildFile([], catalogs), fileName: 'mau-nhap-hoc-sinh-82-cot.xlsx', logId: '' };
    }
    if (!currentUser.hasPermission(PERMISSION_CODES.nationalIdView)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Tệp kèm dữ liệu có số định danh, cần quyền xem số định danh');
    }
    const scope = await this.scopeUnitIds(currentUser);
    let query = database
      .selectFrom('children')
      .select(['id', 'org_unit_id'])
      .where('deleted_at', 'is', null)
      .where('status', 'in', ['active', 'paused']);
    if (!scope.wholeSchool) {
      query = query.where('org_unit_id', 'in', scope.orgUnitIds.length ? scope.orgUnitIds : ['']);
    }
    const children = await query.orderBy('full_name').limit(TEMPLATE_LIMIT).execute();
    const rows = await loadMoetChildRows(
      database,
      this.protection,
      children.map((child) => child.id),
    );
    return logExportedFile(database, currentUser, {
      reportCode: 'import-template-moet-children',
      fileName: `mau-nhap-hoc-sinh-82-cot-kem-du-lieu-${fileStamp(createdAt)}.xlsx`,
      buffer: await buildMoetChildFile(
        rows.map((row) => row.values),
        catalogs,
      ),
      rowCount: rows.length,
      orgUnitIds: [...new Set(children.map((child) => child.org_unit_id))],
      filters: { with_data: true },
      ipAddress,
    });
  }
}

@Controller('student-imports')
export class StudentImportToolsController {
  constructor(private readonly service: StudentImportToolsService) {}

  @Get('moet-catalogs')
  @RequirePermission(PERMISSION_CODES.importChildren)
  async catalogs(@AuthenticatedUser() currentUser: CurrentUser) {
    return { items: await this.service.catalogs(currentUser) };
  }

  @Get('moet-template')
  @RequirePermission(PERMISSION_CODES.importChildren)
  async template(
    @Query('with_data') withData: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const file = await this.service.template(currentUser, withData === 'true', request.ip ?? null);
    if (file.logId) {
      sendWorkbook(response, file);
      return;
    }
    response.setHeader('content-type', XLSX_TYPE);
    response.setHeader('content-disposition', `attachment; filename="${file.fileName}"`);
    response.send(file.buffer);
  }
}
