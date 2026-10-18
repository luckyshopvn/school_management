import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Put, Req, Res } from '@nestjs/common';
import type { EmisValues, SchoolYearDatabase } from '@school-management/database';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import {
  EMIS_BUDGET_COLUMNS,
  EMIS_EQUIPMENT_COLUMNS,
  EMIS_FACILITY_COLUMNS,
  EMIS_FOREIGN_LANGUAGE_COLUMNS,
  EMIS_FORMS,
  EMIS_HEALTH_COLUMNS,
  EMIS_POPULATION_COLUMNS,
  EMIS_QUANTITY_COLUMNS,
  EMIS_STAFF_GENERAL_COLUMNS,
  EMIS_STAFF_SKILL_COLUMNS,
  EMIS_STANDARD_COLUMNS,
  EQUIPMENT_AGE_GROUPS,
  PERMISSION_CODES,
  SCHOOL_OWNERSHIP_TYPES,
  isEmisFormCode,
  type EmisColumn,
  type EmisFormCode,
  type SchoolOwnershipType,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import { childIsNursery, hasDisability } from '../facilities/emis-calc.js';
import { EmisReportService } from '../facilities/emis-report.js';
import { buildEquipmentReport } from '../facilities/equipment-report-calc.js';
import { FacilitiesData } from '../facilities/facilities-data.js';
import {
  buildFacilitiesWorkbook,
  fileStamp,
  sendWorkbook,
  type ExportedFile,
} from '../facilities/facilities-workbook.js';
import { buildStartOfYearHealthReport } from '../health/emis-health-calc.js';
import { EmisHealthReportService, loadStartOfYearHealthChildren } from '../health/emis-health-report.js';
import { SchoolTerms } from '../health/school-terms.js';
import { profileText } from '../statistics/statistics-calc.js';
import {
  UpperLevelForms,
  UpperLevelSubmissions,
  type CompletenessItem,
} from '../submissions/upper-level-submissions.js';
import {
  buildEducationResults,
  buildEndOfYearChildren,
  buildStaffReport,
  EQUIPMENT_ROWS,
  FACILITY_INFO_ROWS,
  FACILITY_ROWS,
  fillEquipment,
  fillFacilities,
  fillFacilityInfo,
  fillOtherFacilities,
  fillToilets,
  fromEmisRow,
  OTHER_FACILITY_ROWS,
  recode,
  TOILET_ROWS,
  type EmisFormRow,
  type EmisRowTemplate,
  type FacilityRoom,
  type PersonFacts,
  type YearChild,
} from './emis-form-calc.js';

// Bảy biểu của phân hệ Báo cáo số liệu Mầm non (khảo sát mục 5 của Sở; DT-16 phần 16j). Mỗi biểu gồm các thẻ:
// - thẻ tính từ dữ liệu của năm học đang dùng tại thời điểm xem (Biểu 1, sức khỏe, cuối năm, đội ngũ);
// - thẻ nhập tay (Ngân sách nhà nước của 1.1, năm thẻ của 1.2, 2.3 Đề án ngoại ngữ): "Lấy dữ liệu" điền số tính từ dữ liệu
//   của hệ thống, "Lấy dữ liệu năm trước" điền số đã ghi của năm học trước; cả hai chỉ điền vào màn hình, bấm Ghi mới lưu.
// Mọi biểu đăng ký mẫu "gửi lên cấp trên" chạy nội bộ của phần 16a: Xuất tệp gửi (Excel của biểu, lưu bản chụp số liệu),
// nộp bằng tay, Đánh dấu đã gửi; biểu đã gửi khóa cả việc ghi số liệu nhập tay cho tới khi mở khóa. Cần phạm vi toàn trường
// theo quyền P17.report.emis như Biểu 1; người có quyền P01.school-profile.manage mở khóa
const PERMISSION = PERMISSION_CODES.emisReport;
export const EMIS_RULE_CODE = 'YCTD-129';
const MAXIMUM_VALUE = 1_000_000_000_000;
const NO_ID = '00000000-0000-0000-0000-000000000000';
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const INDICATOR_NOTE = 'Mã số, tên chỉ tiêu do hệ thống đặt, cần đối chiếu biểu mẫu chính thức trước khi nộp';

const FILE_STEMS: Record<EmisFormCode, string> = {
  'emis-start-of-year': 'emis-dau-nam',
  'emis-facilities': 'emis-co-so-vat-chat',
  'emis-start-of-year-health': 'emis-suc-khoe-dau-nam',
  'emis-end-of-year': 'emis-cuoi-nam',
  'emis-staff': 'emis-doi-ngu',
  'emis-foreign-language': 'emis-de-an-ngoai-ngu',
  'emis-preschool-end-of-year': 'emis-gdmn-cuoi-nam',
};

export interface EmisTabView {
  key: string;
  label: string;
  columns: EmisColumn[];
  rows: EmisFormRow[];
  editable: boolean;
  can_fill: boolean;
  can_copy_previous_year: boolean;
  saved_at: Date | null;
  saved_by_name: string | null;
}

export interface EmisFormView {
  code: EmisFormCode;
  menu: string;
  name: string;
  school_name: string;
  administrative_unit_name: string | null;
  academic_year: string;
  generated_on: string;
  locked: boolean;
  tabs: EmisTabView[];
  warnings: string[];
  completeness: CompletenessItem[];
  // Số liệu riêng của biểu lưu vào bản chụp khi xuất tệp gửi (ví dụ loại hình trường của Biểu 1)
  extra: Record<string, unknown>;
}

interface Context {
  currentUser: CurrentUser;
  database: Kysely<SchoolYearDatabase>;
  academicYearId: string;
  rootId: string;
  ownership: SchoolOwnershipType | null;
  startYear: number;
  general: Record<string, unknown>;
  otherInfo: Record<string, unknown>;
  itInfrastructure: Record<string, unknown>;
}

interface EditableTab {
  key: string;
  label: string;
  columns: EmisColumn[];
  rows: EmisRowTemplate[];
  fill?: (context: Context) => Promise<Record<string, EmisValues>>;
  previousYear?: boolean;
}

interface Built {
  tabs: EmisTabView[];
  warnings: string[];
  completeness: CompletenessItem[];
  extra?: Record<string, unknown>;
}

interface FormDefinition {
  code: EmisFormCode;
  allowNoData?: boolean;
  editable: EditableTab[];
  build(context: Context, editable: Map<string, EmisTabView>): Promise<Built>;
}

const computed = (key: string, label: string, columns: EmisColumn[], rows: EmisFormRow[]): EmisTabView => ({
  key,
  label,
  columns,
  rows,
  editable: false,
  can_fill: false,
  can_copy_previous_year: false,
  saved_at: null,
  saved_by_name: null,
});

const BUDGET_TAB: EditableTab = {
  key: 'budget',
  label: 'Ngân sách nhà nước',
  columns: EMIS_BUDGET_COLUMNS,
  rows: [
    { code: '6.01', label: 'Tổng chi ngân sách nhà nước cho giáo dục mầm non', unit: 'Triệu đồng' },
    { code: '6.02', label: 'Chi thường xuyên', unit: 'Triệu đồng' },
    { code: '6.03', label: 'Trong đó: chi lương và các khoản có tính chất lương', unit: 'Triệu đồng' },
    { code: '6.04', label: 'Trong đó: chi cho hoạt động chuyên môn', unit: 'Triệu đồng' },
    { code: '6.05', label: 'Chi đầu tư phát triển', unit: 'Triệu đồng' },
    { code: '6.06', label: 'Chi thực hiện chính sách hỗ trợ trẻ em', unit: 'Triệu đồng' },
  ],
};

const FOREIGN_LANGUAGE_TABS: EditableTab[] = [
  {
    key: 'children',
    label: 'Trẻ làm quen tiếng Anh',
    columns: EMIS_FOREIGN_LANGUAGE_COLUMNS,
    rows: EQUIPMENT_AGE_GROUPS.filter((group) => group.value.startsWith('mg_')).map((group, index) => ({
      code: `NN.0${index + 1}`,
      label: group.label,
      unit: 'Trẻ',
    })),
    previousYear: true,
  },
  {
    key: 'teachers',
    label: 'Giáo viên dạy tiếng Anh',
    columns: EMIS_QUANTITY_COLUMNS,
    rows: [
      { code: 'GV.01', label: 'Giáo viên của trường dạy tiếng Anh', unit: 'Người' },
      { code: 'GV.02', label: 'Giáo viên thuê, hợp đồng với đơn vị bên ngoài', unit: 'Người' },
      { code: 'GV.03', label: 'Trong đó: giáo viên người nước ngoài', unit: 'Người' },
    ],
    previousYear: true,
  },
];

const savedOnce = (editable: Map<string, EmisTabView>, tab: string) => editable.get(tab)?.saved_at != null;

@Injectable()
export class EmisForms {
  private readonly definitions: Record<EmisFormCode, FormDefinition>;

  constructor(
    private readonly data: FacilitiesData,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly startOfYear: EmisReportService,
    private readonly health: EmisHealthReportService,
    private readonly schoolTerms: SchoolTerms,
    private readonly submissions: UpperLevelSubmissions,
    private readonly clock: Clock,
    forms: UpperLevelForms,
  ) {
    this.definitions = {
      'emis-start-of-year': {
        code: 'emis-start-of-year',
        editable: [BUDGET_TAB],
        build: async (context, editable) => {
          const report = await this.startOfYear.startOfYear(context.currentUser);
          return {
            tabs: [
              ...report.tabs.map((tab) =>
                computed(
                  tab.key,
                  tab.label,
                  EMIS_POPULATION_COLUMNS,
                  tab.rows.map((row) => fromEmisRow(row)),
                ),
              ),
              editable.get('budget') as EmisTabView,
            ],
            warnings: savedOnce(editable, 'budget')
              ? report.warnings
              : [...report.warnings, 'Chưa ghi thẻ Ngân sách nhà nước (trường tư thục, dân lập để trống được)'],
            completeness: [
              { label: 'Đã khai báo loại hình trường trong hồ sơ trường', done: report.ownership !== null },
              {
                label: 'Mọi nhóm, lớp đã xếp được nhóm tuổi theo bậc học',
                done: !report.warnings.some((warning) => warning.includes('chưa xếp được nhóm tuổi')),
              },
              {
                label: 'Mọi phòng đã khai báo hiện trạng',
                done: !report.warnings.some((warning) => warning.includes('chưa khai báo hiện trạng')),
              },
            ],
            extra: { ownership: report.ownership, start_year: report.start_year },
          };
        },
      },
      'emis-facilities': {
        code: 'emis-facilities',
        editable: [
          {
            key: 'facilities',
            label: 'Cơ sở vật chất',
            columns: EMIS_FACILITY_COLUMNS,
            rows: FACILITY_ROWS,
            fill: async (context) => fillFacilities(await this.rooms(context.database)),
            previousYear: true,
          },
          {
            key: 'toilets',
            label: 'Nhà vệ sinh',
            columns: EMIS_FACILITY_COLUMNS,
            rows: TOILET_ROWS,
            fill: async (context) => fillToilets(await this.rooms(context.database)),
            previousYear: true,
          },
          {
            key: 'other',
            label: 'Cơ sở vật chất khác',
            columns: EMIS_QUANTITY_COLUMNS,
            rows: OTHER_FACILITY_ROWS,
            fill: async (context) => fillOtherFacilities(await this.rooms(context.database), context.general),
            previousYear: true,
          },
          {
            key: 'equipment',
            label: 'Thiết bị dạy học',
            columns: EMIS_EQUIPMENT_COLUMNS,
            rows: EQUIPMENT_ROWS,
            fill: async (context) => fillEquipment(await this.equipment(context.database)),
            previousYear: true,
          },
          {
            key: 'info',
            label: 'Thông tin khác',
            columns: EMIS_QUANTITY_COLUMNS,
            rows: FACILITY_INFO_ROWS,
            fill: async (context) => fillFacilityInfo(context.otherInfo, context.itInfrastructure),
            previousYear: true,
          },
        ],
        build: async (_context, editable) => {
          const tabs = [...editable.values()];
          const missing = tabs.filter((tab) => tab.saved_at === null);
          return {
            tabs,
            warnings: missing.length
              ? [`Chưa ghi thẻ ${missing.map((tab) => tab.label).join(', ')}: bấm Lấy dữ liệu hoặc nhập số rồi Ghi`]
              : [],
            completeness: tabs.map((tab) => ({ label: `Đã ghi thẻ ${tab.label}`, done: tab.saved_at !== null })),
          };
        },
      },
      'emis-start-of-year-health': {
        code: 'emis-start-of-year-health',
        editable: [],
        build: async (context) => {
          const report = await this.health.startOfYearHealth(context.currentUser);
          return {
            tabs: [
              computed(
                'health',
                'Sức khỏe học sinh đầu năm',
                EMIS_HEALTH_COLUMNS,
                report.rows.map((row) => fromEmisRow(row)),
              ),
            ],
            warnings: report.warnings,
            completeness: [
              { label: 'Đã khai báo loại hình trường trong hồ sơ trường', done: report.ownership !== null },
              {
                label: 'Có đợt cân đo thuộc học kỳ I (mục 4.3.1)',
                done: !report.warnings.some((warning) => warning.startsWith('Chưa có đợt cân đo')),
              },
              {
                label: 'Có kết quả khám sức khỏe thuộc học kỳ I (mục 4.6.2)',
                done: !report.warnings.some((warning) => warning.startsWith('Chưa có kết quả khám')),
              },
            ],
            extra: { ownership: report.ownership, term_range: report.term_range },
          };
        },
      },
      'emis-end-of-year': {
        code: 'emis-end-of-year',
        editable: [],
        build: async (context) => this.endOfYear(context),
      },
      'emis-staff': {
        code: 'emis-staff',
        editable: [],
        build: async (context) => this.staffReport(context),
      },
      'emis-foreign-language': {
        code: 'emis-foreign-language',
        allowNoData: true,
        editable: FOREIGN_LANGUAGE_TABS,
        build: async (context, editable) => {
          const tabs = [...editable.values()];
          const warnings: string[] = [];
          if (context.otherInfo.english_familiarization === false) {
            warnings.push(
              'Hồ sơ trường ghi không cho trẻ làm quen tiếng Anh: đánh dấu "Trường không có dữ liệu" khi gửi',
            );
          }
          return {
            tabs,
            warnings,
            completeness: [{ label: 'Đã ghi thẻ Trẻ làm quen tiếng Anh', done: savedOnce(editable, 'children') }],
          };
        },
      },
      'emis-preschool-end-of-year': {
        code: 'emis-preschool-end-of-year',
        editable: [],
        build: async (context) => {
          const report = await this.startOfYear.startOfYear(context.currentUser);
          const children = await this.yearChildren(context);
          return {
            tabs: [
              ...report.tabs.map((tab) =>
                computed(
                  tab.key,
                  tab.label,
                  EMIS_POPULATION_COLUMNS,
                  tab.rows.map((row) => fromEmisRow(row)),
                ),
              ),
              computed(
                'education',
                'Kết quả giáo dục',
                EMIS_POPULATION_COLUMNS,
                recode(buildEducationResults(context.ownership, children), '6'),
              ),
            ],
            warnings: report.warnings,
            completeness: [
              { label: 'Đã khai báo loại hình trường trong hồ sơ trường', done: report.ownership !== null },
              {
                label: 'Đã đánh giá hoàn thành chương trình cho mọi trẻ 5–6 tuổi (mục 4.4)',
                done: !children.some((child) => child.status === 'active' && child.five_to_six && !child.completion),
              },
            ],
            extra: { ownership: report.ownership },
          };
        },
      },
    };

    for (const form of EMIS_FORMS) {
      const definition = this.definitions[form.code];
      forms.register({
        code: form.code,
        name: `${form.menu} ${form.name}`,
        permission: PERMISSION,
        unlockPermission: PERMISSION_CODES.schoolProfileManage,
        allowNoData: definition.allowNoData === true,
        completeness: async (currentUser) => (await this.view(currentUser, form.code)).completeness,
        snapshot: async (currentUser, ipAddress) => {
          const view = await this.view(currentUser, form.code);
          return { file: await this.workbook(currentUser, view, ipAddress), data: { ...view.extra, ...view } };
        },
      });
    }
  }

  private definition(code: string): FormDefinition {
    if (!isEmisFormCode(code)) {
      throw notFoundError('Không có biểu báo cáo EMIS này', 'emis_form');
    }
    return this.definitions[code];
  }

  private async context(currentUser: CurrentUser): Promise<Context> {
    await this.data.assertWholeSchool(
      currentUser,
      [PERMISSION],
      'Báo cáo EMIS lập cho toàn trường, cần phạm vi toàn trường',
    );
    const current = await this.currentSchoolYear.require();
    const database = current.database;
    const root = await this.data.root(database);
    const [profile, year] = await Promise.all([
      database
        .selectFrom('school_profiles')
        .select(['general', 'other_info', 'it_infrastructure'])
        .where('org_unit_id', '=', root.id)
        .executeTakeFirst(),
      this.databases.system
        .selectFrom('academic_years')
        .select(['name', 'start_date'])
        .where('id', '=', current.academicYearId)
        .executeTakeFirstOrThrow(),
    ]);
    const general = (profile?.general ?? {}) as Record<string, unknown>;
    const ownership = SCHOOL_OWNERSHIP_TYPES.some((type) => type.value === general.ownership_type)
      ? (general.ownership_type as SchoolOwnershipType)
      : null;
    return {
      currentUser,
      database,
      academicYearId: current.academicYearId,
      rootId: root.id,
      ownership,
      startYear: startYearOf(year.start_date as unknown, year.name, this.clock.now()),
      general,
      otherInfo: (profile?.other_info ?? {}) as Record<string, unknown>,
      itInfrastructure: (profile?.it_infrastructure ?? {}) as Record<string, unknown>,
    };
  }

  // Số liệu đã ghi của các thẻ nhập tay, gộp vào danh sách chỉ tiêu của thẻ
  private async editableTabs(context: Context, definition: FormDefinition): Promise<Map<string, EmisTabView>> {
    const result = new Map<string, EmisTabView>();
    if (definition.editable.length === 0) {
      return result;
    }
    const stored = await context.database
      .selectFrom('emis_report_values')
      .select(['tab_key', 'row_code', 'values', 'updated_at', 'updated_by_name'])
      .where('form_code', '=', definition.code)
      .execute();
    for (const tab of definition.editable) {
      const own = stored.filter((row) => row.tab_key === tab.key);
      const latest = own.reduce<(typeof own)[number] | null>(
        (found, row) => (found === null || row.updated_at > found.updated_at ? row : found),
        null,
      );
      const byCode = new Map(own.map((row) => [row.row_code, row.values]));
      result.set(tab.key, {
        key: tab.key,
        label: tab.label,
        columns: tab.columns,
        rows: tab.rows.map((row) => ({ ...row, values: pickColumns(tab.columns, byCode.get(row.code)) })),
        editable: true,
        can_fill: tab.fill !== undefined,
        can_copy_previous_year: tab.previousYear === true,
        saved_at: latest?.updated_at ?? null,
        saved_by_name: latest?.updated_by_name ?? null,
      });
    }
    return result;
  }

  async view(currentUser: CurrentUser, code: string): Promise<EmisFormView> {
    const definition = this.definition(code);
    const form = EMIS_FORMS.find((item) => item.code === definition.code)!;
    const context = await this.context(currentUser);
    const editable = await this.editableTabs(context, definition);
    const built = await definition.build(context, editable);
    const [root, administrativeUnit, year, status] = await Promise.all([
      context.database
        .selectFrom('org_units')
        .select('name')
        .where('id', '=', context.rootId)
        .executeTakeFirstOrThrow(),
      context.database
        .selectFrom('settings')
        .select('value')
        .where('org_unit_id', '=', context.rootId)
        .where('key', '=', 'administrative_unit_name')
        .executeTakeFirst(),
      this.databases.system
        .selectFrom('academic_years')
        .select('name')
        .where('id', '=', context.academicYearId)
        .executeTakeFirstOrThrow(),
      this.submissions.statusOf(definition.code),
    ]);
    return {
      code: definition.code,
      menu: form.menu,
      name: form.name,
      school_name: root.name,
      administrative_unit_name:
        typeof administrativeUnit?.value === 'string' && administrativeUnit.value !== ''
          ? administrativeUnit.value
          : null,
      academic_year: year.name,
      generated_on: VIETNAM_DATE.format(this.clock.now()),
      locked: this.submissions.isLocked(status),
      tabs: built.tabs,
      warnings: [...built.warnings, INDICATOR_NOTE],
      completeness: built.completeness,
      extra: built.extra ?? {},
    };
  }

  private editableTab(definition: FormDefinition, tabKey: string): EditableTab {
    const tab = definition.editable.find((item) => item.key === tabKey);
    if (!tab) {
      throw ruleViolationError(EMIS_RULE_CODE, 'Thẻ này tính từ dữ liệu của hệ thống, không nhập tay được');
    }
    return tab;
  }

  private async assertUnlocked(code: EmisFormCode): Promise<void> {
    if (this.submissions.isLocked(await this.submissions.statusOf(code))) {
      throw ruleViolationError(
        EMIS_RULE_CODE,
        'Biểu đã đánh dấu đã gửi đang khóa; gửi yêu cầu mở khóa và chờ người có quyền mở khóa trước khi sửa số liệu',
      );
    }
  }

  // Ghi số liệu nhập tay của một thẻ: mỗi dòng là mã chỉ tiêu và số theo mã cột (để trống là null)
  async save(
    currentUser: CurrentUser,
    code: string,
    tabKey: string,
    rows: Array<{ code: string; values: EmisValues }>,
  ): Promise<EmisFormView> {
    const definition = this.definition(code);
    const tab = this.editableTab(definition, tabKey);
    const context = await this.context(currentUser);
    await this.assertUnlocked(definition.code);
    const known = new Set(tab.rows.map((row) => row.code));
    const columns = new Set(tab.columns.map((column) => column.key));
    const errors: FieldError[] = [];
    for (const row of rows) {
      if (!known.has(row.code)) {
        errors.push({ field: `rows.${row.code}`, message: 'Không có chỉ tiêu này trong thẻ' });
      }
      for (const key of Object.keys(row.values).filter((item) => !columns.has(item))) {
        errors.push({ field: `rows.${row.code}.${key}`, message: 'Không có cột này trong thẻ' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const now = this.clock.now();
    await context.database.transaction().execute(async (transaction) => {
      for (const row of rows) {
        const values = JSON.stringify(pickColumns(tab.columns, row.values));
        await transaction
          .insertInto('emis_report_values')
          .values({
            form_code: definition.code,
            tab_key: tab.key,
            row_code: row.code,
            values,
            updated_by: currentUser.id,
            updated_by_name: currentUser.description.full_name,
          })
          .onConflict((conflict) =>
            conflict.columns(['form_code', 'tab_key', 'row_code']).doUpdateSet({
              values,
              updated_by: currentUser.id,
              updated_by_name: currentUser.description.full_name,
              updated_at: now,
            }),
          )
          .execute();
      }
    });
    return this.view(currentUser, definition.code);
  }

  // Lấy dữ liệu: số tính từ dữ liệu của hệ thống; Lấy dữ liệu năm trước: số đã ghi của năm học liền trước. Không lưu
  async fill(
    currentUser: CurrentUser,
    code: string,
    tabKey: string,
    source: 'data' | 'previous_year',
  ): Promise<{ rows: EmisFormRow[]; source_name: string }> {
    const definition = this.definition(code);
    const tab = this.editableTab(definition, tabKey);
    const context = await this.context(currentUser);
    await this.assertUnlocked(definition.code);
    let values: Record<string, EmisValues>;
    let sourceName: string;
    if (source === 'data') {
      if (!tab.fill) {
        throw ruleViolationError(EMIS_RULE_CODE, 'Thẻ này không có dữ liệu trong hệ thống để lấy, hãy nhập tay');
      }
      values = await tab.fill(context);
      sourceName = 'dữ liệu của hệ thống';
    } else {
      if (!tab.previousYear) {
        throw ruleViolationError(EMIS_RULE_CODE, 'Thẻ này không lấy dữ liệu năm trước');
      }
      const previous = await this.previousYear(context.academicYearId);
      if (!previous) {
        throw ruleViolationError(EMIS_RULE_CODE, 'Chưa có năm học trước trên hệ thống');
      }
      const stored = await this.databases
        .schoolYear<SchoolYearDatabase>(previous.database_name)
        .selectFrom('emis_report_values')
        .select(['row_code', 'values'])
        .where('form_code', '=', definition.code)
        .where('tab_key', '=', tab.key)
        .execute();
      if (stored.length === 0) {
        throw ruleViolationError(EMIS_RULE_CODE, `Năm học ${previous.name} chưa ghi số liệu của thẻ này`);
      }
      values = Object.fromEntries(stored.map((row) => [row.row_code, row.values]));
      sourceName = `năm học ${previous.name}`;
    }
    return {
      rows: tab.rows.map((row) => ({ ...row, values: pickColumns(tab.columns, values[row.code]) })),
      source_name: sourceName,
    };
  }

  private async previousYear(academicYearId: string) {
    const current = await this.databases.system
      .selectFrom('academic_years')
      .select('start_date')
      .where('id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    return this.databases.system
      .selectFrom('academic_years')
      .innerJoin('academic_year_databases', 'academic_year_databases.academic_year_id', 'academic_years.id')
      .select(['academic_years.name', 'academic_year_databases.database_name'])
      .where('academic_years.start_date', '<', current.start_date)
      .orderBy('academic_years.start_date', 'desc')
      .executeTakeFirst();
  }

  async export(currentUser: CurrentUser, code: string, ipAddress: string | null): Promise<ExportedFile> {
    return this.workbook(currentUser, await this.view(currentUser, code), ipAddress);
  }

  private async workbook(currentUser: CurrentUser, view: EmisFormView, ipAddress: string | null) {
    const createdAt = this.clock.now();
    return buildFacilitiesWorkbook({
      database: await this.data.database(),
      currentUser,
      reportCode: view.code,
      fileName: `${FILE_STEMS[view.code]}-${fileStamp(createdAt)}.xlsx`,
      filters: { form: view.code },
      orgUnitIds: [],
      ipAddress,
      createdAt,
      sheets: view.tabs.map((tab) => ({
        title: tab.label,
        heading: [
          `${view.menu} ${view.name} – ${tab.label}`,
          [
            view.administrative_unit_name ? `Đơn vị hành chính: ${view.administrative_unit_name}` : null,
            view.school_name,
            `năm học ${view.academic_year}`,
          ]
            .filter(Boolean)
            .join(', '),
          INDICATOR_NOTE,
        ],
        columns: [
          { key: 'label', label: 'Chỉ tiêu', width: 48 },
          { key: 'unit', label: 'Đơn vị', width: 12 },
          { key: 'code', label: 'Mã số', width: 10 },
          ...tab.columns.map((column) => ({ key: column.key, label: column.label })),
        ],
        rows: tab.rows.map((row) => ({ label: row.label, unit: row.unit, code: row.code, ...row.values })),
      })),
    });
  }

  private async rooms(database: Kysely<SchoolYearDatabase>): Promise<FacilityRoom[]> {
    const rows = await database
      .selectFrom('rooms')
      .select(['room_type', 'condition', 'area_m2', 'facility_attributes'])
      .where('status', '=', 'active')
      .execute();
    return rows.map((row) => ({
      room_type: row.room_type,
      condition: row.condition,
      area_m2: row.area_m2 === null ? null : Number(row.area_m2),
      attributes: row.facility_attributes ?? {},
    }));
  }

  private async equipment(database: Kysely<SchoolYearDatabase>) {
    const units = await database.selectFrom('org_units').select('id').where('status', '=', 'active').execute();
    const unitIds = units.map((unit) => unit.id);
    const [classes, items, holdings, assets] = await Promise.all([
      this.data.classes(database, unitIds),
      this.data.items(database),
      this.data.holdings(database, unitIds),
      this.data.assets(database, unitIds),
    ]);
    return buildEquipmentReport({ items, classes, holdings, assets, classId: null });
  }

  // Học sinh của năm học (đang học, đã nghỉ) kèm nhóm tuổi, khuyết tật, hoàn thành chương trình
  private async yearChildren(context: Context): Promise<YearChild[]> {
    const { database } = context;
    const units = await database.selectFrom('org_units').select('id').where('status', '=', 'active').execute();
    const classes = await this.data.classes(
      database,
      units.map((unit) => unit.id),
    );
    const classAge = new Map(classes.map((row) => [row.id, row.age_group]));
    const [children, completions] = await Promise.all([
      database
        .selectFrom('children')
        .leftJoin('class_enrollments', (join) =>
          join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
        )
        .select([
          'children.id',
          'children.status',
          'children.gender',
          'children.dob',
          'children.moet_profile',
          'children.special_needs_note',
          'class_enrollments.class_id',
        ])
        .where('children.status', 'in', ['active', 'withdrawn'])
        .execute(),
      database.selectFrom('program_completions').select(['child_id', 'result']).execute(),
    ]);
    const completion = new Map(completions.map((row) => [row.child_id, row.result]));
    const seen = new Set<string>();
    const result: YearChild[] = [];
    for (const child of children) {
      if (seen.has(child.id)) {
        continue;
      }
      seen.add(child.id);
      const dob = child.dob as unknown;
      const birthYear = dob instanceof Date ? dob.getFullYear() : Number(String(dob).slice(0, 4));
      const ageGroup = child.class_id ? (classAge.get(child.class_id) ?? null) : null;
      result.push({
        gender: child.gender,
        ethnicity: profileText(child.moet_profile, 'ethnicity'),
        status: child.status,
        nursery: childIsNursery({ age_group: ageGroup, birth_year: birthYear }, context.startYear),
        disabled:
          hasDisability(profileText(child.moet_profile, 'disability_type')) || !!child.special_needs_note?.trim(),
        five_to_six: ageGroup ? ageGroup === 'mg_5_6' : context.startYear - birthYear === 5,
        completion: completion.get(child.id) ?? null,
      });
    }
    return result;
  }

  private async transfers(context: Context, direction: 'in' | 'out'): Promise<PersonFacts[]> {
    const rows = await context.database
      .selectFrom('student_transfers')
      .leftJoin('children', 'children.id', 'student_transfers.child_id')
      .select(['children.gender', 'children.moet_profile'])
      .where('student_transfers.direction', '=', direction)
      .where('student_transfers.status', 'in', direction === 'in' ? ['received'] : ['approved'])
      .execute();
    return rows.map((row) => ({
      gender: row.gender ?? null,
      ethnicity: profileText(row.moet_profile ?? null, 'ethnicity'),
    }));
  }

  // 2.1 Báo cáo EMIS cuối năm: mục I–VI
  private async endOfYear(context: Context): Promise<Built> {
    const report = await this.startOfYear.startOfYear(context.currentUser);
    const terms = await this.schoolTerms.ranges();
    const [children, transfersIn, transfersOut, healthChildren] = await Promise.all([
      this.yearChildren(context),
      this.transfers(context, 'in'),
      this.transfers(context, 'out'),
      loadStartOfYearHealthChildren(context.database, terms, 'second_term'),
    ]);
    const health = buildStartOfYearHealthReport({ ownership: context.ownership, children: healthChildren });
    const tabOf = (key: string) =>
      report.tabs.find((tab) => tab.key === key)?.rows.map((row) => fromEmisRow(row)) ?? [];
    const healthRows = health.rows.map((row) =>
      fromEmisRow(row, row.code, row.code === '1.3.02' ? 'Số học sinh được khám sức khỏe trong học kỳ II' : row.label),
    );
    const warnings = [...report.warnings];
    if (health.warnings.some((warning) => warning.startsWith('Chưa có đợt cân đo'))) {
      warnings.push('Chưa có đợt cân đo nào thuộc học kỳ II (mục 4.3.1): mục III để trống phần cân đo');
    }
    return {
      tabs: [
        computed('school_classes', 'I. Trường, lớp', EMIS_POPULATION_COLUMNS, recode(tabOf('school_classes'), 'I')),
        computed(
          'children',
          'II. Học sinh',
          EMIS_POPULATION_COLUMNS,
          buildEndOfYearChildren(context.ownership, children, transfersIn, transfersOut),
        ),
        computed('health', 'III. Nuôi dưỡng, chăm sóc sức khỏe', EMIS_HEALTH_COLUMNS, recode(healthRows, 'III')),
        computed(
          'education',
          'IV. Kết quả giáo dục',
          EMIS_POPULATION_COLUMNS,
          buildEducationResults(context.ownership, children),
        ),
        computed('staff', 'V. Đội ngũ', EMIS_POPULATION_COLUMNS, recode(tabOf('staff'), 'V')),
        computed('rooms', 'VI. Cơ sở vật chất', EMIS_POPULATION_COLUMNS, recode(tabOf('rooms'), 'VI')),
      ],
      warnings,
      completeness: [
        { label: 'Đã khai báo loại hình trường trong hồ sơ trường', done: context.ownership !== null },
        {
          label: 'Có đợt cân đo thuộc học kỳ II (mục 4.3.1)',
          done: !health.warnings.some((warning) => warning.startsWith('Chưa có đợt cân đo')),
        },
        {
          label: 'Đã đánh giá hoàn thành chương trình cho mọi trẻ 5–6 tuổi (mục 4.4)',
          done: !children.some((child) => child.status === 'active' && child.five_to_six && !child.completion),
        },
      ],
      extra: { ownership: context.ownership },
    };
  }

  // 2.2 Báo cáo đội ngũ
  private async staffReport(context: Context): Promise<Built> {
    const { database } = context;
    const staff = await database
      .selectFrom('staff')
      .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id')
      .select(['staff.id', 'staff.gender', 'staff.moet_profile', 'job_titles.name as job_title'])
      .where('staff.status', '=', 'active')
      .execute();
    const evaluations = await database
      .selectFrom('professional_evaluations')
      .select(['standard_type', 'overall_level'])
      .where('status', '=', 'finalized')
      .where('staff_id', 'in', staff.length ? staff.map((member) => member.id) : [NO_ID])
      .execute();
    const text = (profile: Record<string, unknown> | null, key: string) => profileText(profile, key);
    const members = staff.map((member) => ({
      gender: member.gender,
      ethnicity: text(member.moet_profile, 'ethnicity'),
      position_group: text(member.moet_profile, 'position_group'),
      job_title: member.job_title,
      party_member: member.moet_profile?.party_member === true,
      qualification: text(member.moet_profile, 'professional_qualification'),
      main_foreign_language: text(member.moet_profile, 'main_foreign_language'),
      language_certificate_type: text(member.moet_profile, 'language_certificate_type'),
      language_framework_level: text(member.moet_profile, 'language_framework_level'),
      language_training_level: text(member.moet_profile, 'language_training_level'),
      it_level: text(member.moet_profile, 'it_level'),
    }));
    const report = buildStaffReport(
      context.ownership,
      members,
      evaluations.map((row) => ({ standard_type: row.standard_type, overall_level: row.overall_level })),
    );
    const withoutQualification = members.filter((member) => !member.qualification).length;
    const warnings: string[] = [];
    if (withoutQualification > 0) {
      warnings.push(
        `${withoutQualification} nhân sự chưa ghi trình độ chuyên môn (mục 3.1.1): xếp vào cột "Khác, chưa ghi"`,
      );
    }
    if (evaluations.length === 0) {
      warnings.push('Chưa có phiếu đánh giá chuẩn nghề nghiệp nào đã chốt (mục 3.2)');
    }
    return {
      tabs: [
        computed('general', 'Tổng hợp chung', EMIS_STAFF_GENERAL_COLUMNS, report.general),
        computed('skills', 'Ngoại ngữ – tin học', EMIS_STAFF_SKILL_COLUMNS, report.skills),
        computed('standards', 'Chuẩn nghề nghiệp', EMIS_STANDARD_COLUMNS, report.standards),
      ],
      warnings,
      completeness: [
        { label: 'Mọi nhân sự đã ghi trình độ chuyên môn', done: withoutQualification === 0 },
        { label: 'Có phiếu đánh giá chuẩn nghề nghiệp đã chốt', done: evaluations.length > 0 },
      ],
    };
  }
}

// Năm bắt đầu năm học (tính tuổi theo năm sinh như Biểu 1)
function startYearOf(startDate: unknown, name: string, now: Date): number {
  if (startDate instanceof Date) {
    return startDate.getFullYear();
  }
  if (typeof startDate === 'string') {
    return Number(startDate.slice(0, 4));
  }
  return Number(/d{4}/.exec(name)?.[0] ?? now.getFullYear());
}

// Chỉ giữ các cột của thẻ; giá trị không phải số hữu hạn thì để trống
function pickColumns(columns: EmisColumn[], values: EmisValues | undefined): EmisValues {
  return Object.fromEntries(
    columns.map((column) => {
      const value = values?.[column.key];
      return [column.key, typeof value === 'number' && Number.isFinite(value) ? value : null];
    }),
  );
}

function readRows(body: RequestBody): Array<{ code: string; values: EmisValues }> {
  const errors: FieldError[] = [];
  const rows = body?.rows;
  if (!Array.isArray(rows)) {
    throw validationError([{ field: 'rows', message: 'Danh sách chỉ tiêu dạng mảng' }]);
  }
  const result: Array<{ code: string; values: EmisValues }> = [];
  rows.forEach((row: unknown, index) => {
    const item = row as { code?: unknown; values?: unknown };
    if (typeof item?.code !== 'string' || item.code === '') {
      errors.push({ field: `rows.${index}.code`, message: 'Bắt buộc có mã chỉ tiêu' });
      return;
    }
    if (typeof item.values !== 'object' || item.values === null || Array.isArray(item.values)) {
      errors.push({ field: `rows.${index}.values`, message: 'Số liệu theo cột dạng đối tượng' });
      return;
    }
    const values: EmisValues = {};
    for (const [key, value] of Object.entries(item.values as Record<string, unknown>)) {
      if (value === null || value === '') {
        values[key] = null;
      } else if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAXIMUM_VALUE) {
        errors.push({ field: `rows.${index}.values.${key}`, message: 'Số không âm' });
      } else {
        values[key] = value;
      }
    }
    result.push({ code: item.code, values });
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return result;
}

@Controller('reports/emis/forms')
export class EmisFormsController {
  constructor(private readonly forms: EmisForms) {}

  @Get(':form')
  @RequirePermission(PERMISSION)
  view(@Param('form') form: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.forms.view(currentUser, form);
  }

  @Put(':form/tabs/:tab')
  @RequirePermission(PERMISSION)
  save(
    @Param('form') form: string,
    @Param('tab') tab: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.forms.save(currentUser, form, tab, readRows(body));
  }

  @Post(':form/tabs/:tab/fill')
  @HttpCode(200)
  @RequirePermission(PERMISSION)
  fill(
    @Param('form') form: string,
    @Param('tab') tab: string,
    @Body() body: RequestBody,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const source = body?.source;
    if (source !== 'data' && source !== 'previous_year') {
      throw validationError([{ field: 'source', message: 'Nguồn là data hoặc previous_year' }]);
    }
    return this.forms.fill(currentUser, form, tab, source);
  }

  @Post(':form/export')
  @HttpCode(200)
  @RequirePermission(PERMISSION)
  async export(
    @Param('form') form: string,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    sendWorkbook(response, await this.forms.export(currentUser, form, request.ip ?? null));
  }
}
