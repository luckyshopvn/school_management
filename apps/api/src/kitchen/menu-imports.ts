import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { MealType, SchoolYearDatabase } from '@school-management/database';
import { Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { FileStorage } from '../files/file-storage.js';
import {
  MAXIMUM_IMPORT_BYTES,
  buildErrorWorkbook,
  buildTemplate,
  parseDate,
  readSheet,
  type ImportCatalog,
  type ImportColumn,
  type RowError,
  type SheetRow,
} from '../imports/excel.js';
import { foldText } from '../imports/moet-columns.js';
import { KitchenAccess } from './kitchen-access.js';
import { MEAL_LABELS, MEAL_TYPES, addDays } from './kitchen-fields.js';
import { KitchenMenusService } from './kitchen-menus.js';
import { gradesOverlap, parseGradeLevels, parseMonth, resolveMenuHeader, type MenuHeader } from './menu-header.js';

// Nhập thực đơn bữa ăn từ Excel theo mục 4.5 của Sở (DT-16 phần 16h), dùng công cụ nhập chung của 16a: tải file mẫu, tra
// cứu danh mục (khối, bữa, thứ, món ăn của đơn vị), chọn cột để nhập, kiểm tra cả tệp, xuất file lỗi, ghi khi không còn
// dòng lỗi. Mỗi dòng là một món của một bữa trong một thứ; các dòng cùng tên thực đơn, từ ngày và khối áp dụng là một thực
// đơn, ghi thành thực đơn nháp để bếp trình duyệt như thực đơn lập trên màn hình. Lần nhập lưu ở bảng riêng của phân hệ bếp
// (không dùng bảng lần nhập chung để tránh đổi ràng buộc loại nhập của các phần khác)
export const MENU_IMPORT_TYPE = 'menus';
export const MENU_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'menu_name', header: 'Tên thực đơn', note: 'Bắt buộc; các dòng cùng tên, từ ngày, khối là một thực đơn' },
  { key: 'month', header: 'Tháng', note: 'MM/YYYY hoặc YYYY-MM; để trống là tháng của Từ ngày' },
  { key: 'week_no', header: 'Tuần', note: 'Số tuần học; để trống thì lấy theo khai báo tuần của năm học' },
  { key: 'from_date', header: 'Từ ngày', note: 'Bắt buộc; dạng ngày của Excel, YYYY-MM-DD hoặc DD/MM/YYYY' },
  {
    key: 'to_date',
    header: 'Đến ngày',
    note: 'Cùng tuần (thứ hai đến chủ nhật) với Từ ngày; để trống là chủ nhật của tuần',
  },
  {
    key: 'grade_levels',
    header: 'Khối áp dụng',
    note: 'Mã khối trong danh mục, nhiều khối cách nhau bằng dấu phẩy; để trống là mọi khối',
  },
  { key: 'weekday', header: 'Thứ', note: 'Bắt buộc: 2 đến 7 hoặc CN; ngày của thứ phải nằm từ ngày đến ngày' },
  { key: 'meal_type', header: 'Bữa', note: 'Bắt buộc: Bữa sáng, Bữa trưa hoặc Bữa xế (xem Tra cứu danh mục)' },
  { key: 'dish', header: 'Món ăn', note: 'Bắt buộc: tên món ăn đang dùng của đơn vị (xem Tra cứu danh mục)' },
  { key: 'note', header: 'Ghi chú', note: 'Không bắt buộc, tối đa 500 ký tự' },
];
export const LOCKED_MENU_IMPORT_COLUMNS = ['menu_name', 'from_date', 'weekday', 'meal_type', 'dish'];
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAXIMUM_NOTE = 500;

const columnHeader = (key: string) => MENU_IMPORT_COLUMNS.find((column) => column.key === key)?.header ?? null;

// Thứ: 2 đến 7 là thứ hai đến thứ bảy (1 đến 6 trong tuần), CN là chủ nhật (7)
export function parseWeekday(text: string): number | null {
  const value = foldText(text)
    .replace(/^thu\s*/, '')
    .replace(/^t(?=\d)/, '');
  if (['cn', 'chu nhat'].includes(value)) {
    return 7;
  }
  const words: Record<string, number> = { hai: 2, ba: 3, tu: 4, nam: 5, sau: 6, bay: 7 };
  const number = words[value] ?? (/^[2-7]$/.test(value) ? Number(value) : null);
  return number === null ? null : number - 1;
}

export function parseMealType(text: string): MealType | null {
  const value = foldText(text).replace(/^bua\s*/, '');
  return (
    MEAL_TYPES.find((type) => type === value || foldText(MEAL_LABELS[type]).replace(/^bua\s*/, '') === value) ?? null
  );
}

export interface ParsedMenu {
  header: MenuHeader;
  items: Array<{ weekday: number; meal_type: MealType; dish_id: string; note: string | null }>;
  rows: number[];
}

export interface MenuImportContext {
  dishes: Array<{ id: string; name: string }>;
  grades: string[];
  weekNo(weekStart: string): number | null;
  // Thực đơn đã có của đơn vị để kiểm tra trùng tuần, trùng khối
  existing: Array<{ name: string | null; week_start_date: string; grade_levels: string[] }>;
}

// Đọc các dòng thành thực đơn; trả lỗi theo dòng, cột như công cụ nhập chung. Hàm thuần, không đọc cơ sở dữ liệu
export function parseMenuRows(rows: SheetRow[], context: MenuImportContext) {
  const errors: RowError[] = [];
  const dishOf = new Map(context.dishes.map((dish) => [foldText(dish.name), dish.id]));
  const known = new Set(context.grades);
  const groups = new Map<string, ParsedMenu>();
  for (const { row, values } of rows) {
    const add = (key: string | null, message: string) =>
      errors.push({ row, column: key ? columnHeader(key) : null, message });
    const before = errors.length;
    const name = values.menu_name?.trim() ?? '';
    if (name === '') {
      add('menu_name', 'Bắt buộc nhập tên thực đơn');
    } else if (name.length > 200) {
      add('menu_name', 'Tên thực đơn tối đa 200 ký tự');
    }
    const fromDate = values.from_date ? parseDate(values.from_date) : null;
    if (!fromDate) {
      add('from_date', values.from_date ? 'Từ ngày không đúng dạng ngày' : 'Bắt buộc nhập từ ngày');
    }
    const toDate = values.to_date ? parseDate(values.to_date) : null;
    if (values.to_date && !toDate) {
      add('to_date', 'Đến ngày không đúng dạng ngày');
    }
    const month = values.month ? parseMonth(values.month) : null;
    if (values.month && !month) {
      add('month', 'Tháng dạng MM/YYYY hoặc YYYY-MM');
    }
    let weekNo: number | null = null;
    if (values.week_no) {
      const number = Number(values.week_no);
      if (!Number.isInteger(number) || number < 1 || number > 60) {
        add('week_no', 'Tuần là số nguyên từ 1 đến 60');
      } else {
        weekNo = number;
      }
    }
    const grades = parseGradeLevels(values.grade_levels ?? '') ?? [];
    const unknown = grades.filter((grade) => !known.has(grade));
    if (unknown.length > 0) {
      add('grade_levels', `Mã khối không có trong danh mục: ${unknown.join(', ')}`);
    }
    const weekday = parseWeekday(values.weekday ?? '');
    if (weekday === null) {
      add('weekday', 'Thứ là 2 đến 7 hoặc CN');
    }
    const mealType = parseMealType(values.meal_type ?? '');
    if (mealType === null) {
      add('meal_type', 'Bữa là Bữa sáng, Bữa trưa hoặc Bữa xế');
    }
    const dishId = dishOf.get(foldText(values.dish ?? ''));
    if (!dishId) {
      add('dish', values.dish ? `Không có món ăn "${values.dish}" đang dùng của đơn vị` : 'Bắt buộc nhập món ăn');
    }
    const note = values.note?.trim() || null;
    if (note && note.length > MAXIMUM_NOTE) {
      add('note', `Ghi chú tối đa ${MAXIMUM_NOTE} ký tự`);
    }
    if (errors.length > before || !fromDate || weekday === null || mealType === null || !dishId) {
      continue;
    }
    const resolved = resolveMenuHeader(
      {
        name,
        month,
        week_no: weekNo,
        from_date: fromDate,
        to_date: toDate,
        grade_levels: grades,
        week_start_date: null,
        age_group: null,
      },
      context.weekNo,
    );
    if (!resolved.header) {
      continue;
    }
    for (const error of resolved.errors) {
      add(error.field, error.message);
    }
    const header = resolved.header;
    const day = addDays(header.week_start_date, weekday - 1);
    if (day < header.from_date || day > header.to_date) {
      add('weekday', 'Ngày của thứ không nằm trong từ ngày đến ngày');
    }
    if (errors.length > before) {
      continue;
    }
    const key = `${foldText(name)}|${header.from_date}|${header.age_group}`;
    const group = groups.get(key);
    if (group) {
      if (
        group.header.to_date !== header.to_date ||
        group.header.month !== header.month ||
        group.header.week_no !== header.week_no
      ) {
        add(null, `Tháng, tuần, đến ngày phải giống các dòng khác của thực đơn "${name}" (dòng ${group.rows[0]})`);
        continue;
      }
      if (
        group.items.some((item) => item.weekday === weekday && item.meal_type === mealType && item.dish_id === dishId)
      ) {
        add('dish', 'Món này đã có ở cùng thứ, cùng bữa của thực đơn');
        continue;
      }
      group.items.push({ weekday, meal_type: mealType, dish_id: dishId, note });
      group.rows.push(row);
    } else {
      groups.set(key, { header, items: [{ weekday, meal_type: mealType, dish_id: dishId, note }], rows: [row] });
    }
  }
  // Trùng tuần, trùng khối với thực đơn đã có hoặc với thực đơn khác trong tệp
  const menus = [...groups.values()];
  menus.forEach((menu, index) => {
    const clash =
      context.existing.find(
        (other) =>
          other.week_start_date === menu.header.week_start_date &&
          gradesOverlap(other.grade_levels, menu.header.grade_levels),
      ) ??
      menus
        .slice(0, index)
        .map((other) => other.header)
        .find(
          (other) =>
            other.week_start_date === menu.header.week_start_date &&
            gradesOverlap(other.grade_levels, menu.header.grade_levels),
        );
    if (clash) {
      errors.push({
        row: menu.rows[0] ?? 0,
        column: columnHeader('grade_levels'),
        message: `Tuần này đã có thực đơn "${clash.name ?? ''}" cho cùng khối áp dụng`,
      });
    }
  });
  return { menus, errors: errors.sort((a, b) => a.row - b.row) };
}

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class MenuImportsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: KitchenAccess,
    private readonly menus: KitchenMenusService,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  columns() {
    return {
      columns: MENU_IMPORT_COLUMNS.map((column) => ({
        ...column,
        locked: LOCKED_MENU_IMPORT_COLUMNS.includes(column.key),
      })),
      updates_existing: false,
      template_with_data: false,
    };
  }

  async catalogs(currentUser: CurrentUser, orgUnitId: string | null): Promise<ImportCatalog[]> {
    const { database } = await this.currentSchoolYear.require();
    const grades = await database
      .selectFrom('grade_levels')
      .select(['code', 'name'])
      .where('status', '=', 'active')
      .orderBy('order_no')
      .execute();
    let dishes: Array<{ name: string; group_name: string | null }> = [];
    if (orgUnitId) {
      await this.access.assertRead(currentUser, orgUnitId);
      dishes = await database
        .selectFrom('dishes')
        .select(['name', 'group_name'])
        .where('org_unit_id', '=', orgUnitId)
        .where('status', '=', 'active')
        .orderBy('name')
        .execute();
    }
    return [
      {
        key: 'grade_levels',
        title: 'Khối',
        column: 'Khối áp dụng',
        items: grades.map((grade) => ({ code: grade.code, name: grade.name })),
      },
      {
        key: 'meal_types',
        title: 'Bữa',
        column: 'Bữa',
        items: MEAL_TYPES.map((type) => ({ code: MEAL_LABELS[type], name: MEAL_LABELS[type] })),
      },
      {
        key: 'weekdays',
        title: 'Thứ',
        column: 'Thứ',
        items: [
          ...[2, 3, 4, 5, 6, 7].map((day) => ({ code: String(day), name: `Thứ ${day}` })),
          { code: 'CN', name: 'Chủ nhật' },
        ],
      },
      {
        key: 'dishes',
        title: 'Món ăn của đơn vị',
        column: 'Món ăn',
        items: dishes.map((dish) => ({ code: dish.name, name: dish.name, note: dish.group_name ?? undefined })),
      },
    ];
  }

  async template(currentUser: CurrentUser, orgUnitId: string | null) {
    return buildTemplate('Thực đơn bữa ăn', MENU_IMPORT_COLUMNS, {
      catalogs: await this.catalogs(currentUser, orgUnitId),
    });
  }

  private async context(database: Kysely<SchoolYearDatabase>, orgUnitId: string): Promise<MenuImportContext> {
    const [dishes, grades, existing] = await Promise.all([
      database
        .selectFrom('dishes')
        .select(['id', 'name'])
        .where('org_unit_id', '=', orgUnitId)
        .where('status', '=', 'active')
        .execute(),
      database.selectFrom('grade_levels').select('code').execute(),
      database
        .selectFrom('menus')
        .select(['name', 'week_start_date', 'grade_levels'])
        .where('org_unit_id', '=', orgUnitId)
        .execute(),
    ]);
    return {
      dishes,
      grades: grades.map((grade) => grade.code),
      weekNo: await this.menus.weekNumbers(),
      existing: existing.map((menu) => ({ ...menu, grade_levels: menu.grade_levels ?? [] })),
    };
  }

  private view(job: {
    id: string;
    status: 'validated' | 'failed' | 'committed';
    total_rows: number;
    error_rows: number;
    errors: unknown[];
    menus: unknown[];
  }) {
    return {
      id: job.id,
      status: job.status,
      total_rows: job.total_rows,
      error_rows: job.error_rows,
      errors: job.errors as RowError[],
      menu_count: job.menus.length,
    };
  }

  // Tải tệp lên và kiểm tra cả tệp; lưu tệp gốc ở kho tệp để xuất file lỗi
  async upload(
    currentUser: CurrentUser,
    orgUnitId: string,
    fileName: string,
    body: Buffer,
    selectedKeys: string[] | undefined,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertManage(currentUser, orgUnitId);
    const selected = selectedKeys ? new Set([...LOCKED_MENU_IMPORT_COLUMNS, ...selectedKeys]) : undefined;
    const rows = await readSheet(body, MENU_IMPORT_COLUMNS, selected);
    const parsed = parseMenuRows(rows, await this.context(database, orgUnitId));
    const storageKey = `imports/menus/${randomUUID()}.xlsx`;
    await this.fileStorage.put(storageKey, body, XLSX_TYPE);
    const job = await database.transaction().execute(async (transaction) => {
      const file = await transaction
        .insertInto('files')
        .values({
          org_unit_id: orgUnitId,
          purpose: 'import',
          file_name: fileName.slice(0, 200),
          content_type: XLSX_TYPE,
          size_bytes: body.length,
          storage_key: storageKey,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return transaction
        .insertInto('menu_import_jobs')
        .values({
          org_unit_id: orgUnitId,
          file_id: file.id,
          status: parsed.errors.length > 0 ? 'failed' : 'validated',
          total_rows: rows.length,
          error_rows: new Set(parsed.errors.map((error) => error.row)).size,
          errors: JSON.stringify(parsed.errors),
          menus: JSON.stringify(parsed.errors.length > 0 ? [] : parsed.menus),
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    });
    return this.view(job);
  }

  private async findJob(database: Kysely<SchoolYearDatabase>, jobId: string) {
    const job = await database.selectFrom('menu_import_jobs').selectAll().where('id', '=', jobId).executeTakeFirst();
    if (!job) {
      throw notFoundError('Không tìm thấy lần nhập', 'menu_import_job');
    }
    return job;
  }

  // Ghi các thực đơn đọc được thành thực đơn nháp; kiểm tra lại trùng tuần, trùng khối ngay lúc ghi
  async commit(currentUser: CurrentUser, jobId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const job = await this.findJob(database, jobId);
    await this.access.assertManage(currentUser, job.org_unit_id);
    if (job.status !== 'validated') {
      throw ruleViolationError(
        'YCTD-121',
        job.status === 'committed' ? 'Lần nhập đã ghi dữ liệu' : 'Tệp còn dòng lỗi, sửa tệp rồi tải lên lại',
      );
    }
    const parsed = job.menus as ParsedMenu[];
    for (const menu of parsed) {
      if (await this.menus.overlapping(database, job.org_unit_id, menu.header, null)) {
        throw ruleViolationError(
          'YCTD-121',
          `Tuần ${menu.header.week_start_date} đã có thực đơn cho khối của "${menu.header.name}", tải tệp lên lại`,
        );
      }
      await this.menus.assertDishes(database, job.org_unit_id, menu.items);
    }
    const committed = await database.transaction().execute(async (transaction) => {
      for (const menu of parsed) {
        const created = await transaction
          .insertInto('menus')
          .values({ org_unit_id: job.org_unit_id, note: null, ...menu.header, created_by: origin.actorUserId })
          .returningAll()
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('menu_items')
          .values(menu.items.map((item) => ({ ...item, menu_id: created.id })))
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: job.org_unit_id,
          entityName: 'menus',
          entityId: created.id,
          action: 'create',
          before: null,
          after: { ...created, items: menu.items, import_job_id: jobId },
        });
      }
      return transaction
        .updateTable('menu_import_jobs')
        .set({ status: 'committed', committed_at: this.clock.now() })
        .where('id', '=', jobId)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
    return this.view(committed);
  }

  async errorFile(currentUser: CurrentUser, jobId: string) {
    const { database } = await this.currentSchoolYear.require();
    const job = await database
      .selectFrom('menu_import_jobs')
      .innerJoin('files', 'files.id', 'menu_import_jobs.file_id')
      .select(['menu_import_jobs.org_unit_id', 'menu_import_jobs.errors', 'files.storage_key', 'files.file_name'])
      .where('menu_import_jobs.id', '=', jobId)
      .executeTakeFirst();
    if (!job) {
      throw notFoundError('Không tìm thấy lần nhập', 'menu_import_job');
    }
    await this.access.assertManage(currentUser, job.org_unit_id);
    const errors = job.errors as RowError[];
    if (errors.length === 0) {
      throw ruleViolationError('YCTD-121', 'Lần nhập này không có dòng lỗi');
    }
    const body = await this.fileStorage.get(job.storage_key);
    const baseName = job.file_name.replace(/\.(xlsx|xls)$/i, '');
    return { buffer: buildErrorWorkbook(body, errors, 1), fileName: `${baseName}-loi.xlsx` };
  }
}

function readOrgUnit(value: unknown, required: boolean): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw validationError([{ field: 'org_unit_id', message: 'Chọn đơn vị' }]);
    }
    return null;
  }
  if (!isUuid(value)) {
    throw validationError([{ field: 'org_unit_id', message: 'Mã đơn vị không hợp lệ' }]);
  }
  return value;
}

function assertType(type: string) {
  if (type !== MENU_IMPORT_TYPE) {
    throw validationError([{ field: 'type', message: `Loại dữ liệu nhập là ${MENU_IMPORT_TYPE}` }]);
  }
}

// Đường dẫn cùng dạng công cụ nhập chung (/imports) để màn hình dùng chung thành phần nhập Excel của 16a
@Controller('menu-imports')
export class MenuImportsController {
  constructor(private readonly imports: MenuImportsService) {}

  @Get('templates/:type/columns')
  @RequirePermission(PERMISSION_CODES.kitchenManage)
  columns(@Param('type') type: string) {
    assertType(type);
    return this.imports.columns();
  }

  @Get('catalogs/:type')
  @RequirePermission(PERMISSION_CODES.kitchenManage)
  async catalogs(
    @Param('type') type: string,
    @Query('org_unit_id') orgUnitId: unknown,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    assertType(type);
    return { items: await this.imports.catalogs(currentUser, readOrgUnit(orgUnitId, false)) };
  }

  @Get('templates/:type')
  @RequirePermission(PERMISSION_CODES.kitchenManage)
  async template(
    @Param('type') type: string,
    @Query('org_unit_id') orgUnitId: unknown,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    assertType(type);
    const buffer = await this.imports.template(currentUser, readOrgUnit(orgUnitId, false));
    response.setHeader('content-type', XLSX_TYPE);
    response.setHeader('content-disposition', 'attachment; filename="mau-nhap-thuc-don.xlsx"');
    response.send(buffer);
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.kitchenManage)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  upload(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp' }]);
    }
    const orgUnitId = readOrgUnit(body?.org_unit_id, true) ?? '';
    const columns = body?.columns;
    if (columns !== undefined && columns !== null && columns !== '' && typeof columns !== 'string') {
      throw validationError([{ field: 'columns', message: 'Danh sách cột không hợp lệ' }]);
    }
    const keys =
      typeof columns === 'string' && columns !== ''
        ? columns
            .split(',')
            .map((key) => key.trim())
            .filter((key) => MENU_IMPORT_COLUMNS.some((column) => column.key === key))
        : undefined;
    return this.imports.upload(
      currentUser,
      orgUnitId,
      Buffer.from(file.originalname, 'latin1').toString('utf8'),
      file.buffer,
      keys,
      originOf(request, currentUser),
    );
  }

  @Post(':id/commit')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.kitchenManage)
  commit(
    @Param('id', uuidParameter('Mã lần nhập không hợp lệ')) jobId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.imports.commit(currentUser, jobId, originOf(request, currentUser));
  }

  @Get(':id/error-file')
  @RequirePermission(PERMISSION_CODES.kitchenManage)
  async errorFile(
    @Param('id', uuidParameter('Mã lần nhập không hợp lệ')) jobId: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const file = await this.imports.errorFile(currentUser, jobId);
    response.setHeader('content-type', XLSX_TYPE);
    response.setHeader(
      'content-disposition',
      `attachment; filename="tep-loi-${jobId.slice(0, 8)}.xlsx"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    response.setHeader('cache-control', 'no-store');
    response.send(file.buffer);
  }
}
