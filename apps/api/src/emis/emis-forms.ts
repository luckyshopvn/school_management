import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Put, Req, Res } from '@nestjs/common';
import type { EmisValues, SchoolYearDatabase } from '@school-management/database';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import {
  CLASS_AGE_GROUPS,
  EMIS_BUDGET_COLUMNS,
  EMIS_CHILD_COLUMNS,
  EMIS_EQUIPMENT_COLUMNS,
  EMIS_FACILITY_COLUMNS,
  EMIS_FORMS,
  EMIS_HCM_FACILITY_COLUMNS,
  EMIS_HEALTH_COLUMNS,
  EMIS_OWNERSHIP_COLUMNS,
  EMIS_POPULATION_COLUMNS,
  EMIS_QUANTITY_COLUMNS,
  EMIS_ROOM_COLUMNS,
  EMIS_STAFF_COLUMNS,
  EMIS_STANDARD_COLUMNS,
  EMIS_START_OF_YEAR_PARTS,
  EMIS_TOTAL_COLUMNS,
  EMIS_TOTAL_FEMALE_COLUMNS,
  PERMISSION_CODES,
  SCHOOL_OWNERSHIP_TYPES,
  isEmisFormCode,
  type ClassAgeGroupKey,
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
import { childIdsOutsideLevel } from '../common/report-levels.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import { childIsNursery, hasDisability, staffCategory } from '../facilities/emis-calc.js';
import { EmisReportService } from '../facilities/emis-report.js';
import { buildEquipmentReport } from '../facilities/equipment-report-calc.js';
import { FacilitiesData } from '../facilities/facilities-data.js';
import {
  buildFacilitiesWorkbook,
  fileStamp,
  sendWorkbook,
  type ExportedFile,
} from '../facilities/facilities-workbook.js';
import { EmisHealthReportService, loadStartOfYearHealthChildren } from '../health/emis-health-report.js';
import { SchoolTerms } from '../health/school-terms.js';
import { termOfDate } from '../health/student-health-calc.js';
import { profileText } from '../statistics/statistics-calc.js';
import {
  UpperLevelForms,
  UpperLevelSubmissions,
  type CompletenessItem,
} from '../submissions/upper-level-submissions.js';
import {
  BUDGET_PENDING_NOTE,
  BUDGET_ROWS,
  buildBieu01,
  isHeading,
  isPrincipal,
  templates,
  type Bieu01Class,
  type Bieu01Staff,
  type InstitutionType,
  type Nutrition,
} from './emis-01-calc.js';
import {
  EQUIPMENT_ROWS,
  FACILITY_INFO_ROWS,
  fillEquipment,
  fillFacilityInfo,
  fillOtherFacilities,
  buildEducationResults,
  fillToilets,
  fromEmisRow,
  OTHER_FACILITY_ROWS,
  recode,
  TOILET_ROWS,
  type EmisFormRow,
  type EmisRowTemplate,
  type FacilityRoom,
  type YearChild,
} from './emis-form-calc.js';
import {
  buildEndOfYear,
  buildHcmFacilities,
  buildStaffForms,
  fillForeignLanguage,
  FOREIGN_LANGUAGE_ROWS,
  HCM_PENDING_NOTE,
  type EndOfYearStaff,
  type HcmRoom,
  type StaffEvaluation,
  type StaffReportPerson,
} from './emis-so-calc.js';

// Bảy biểu của phân hệ Báo cáo số liệu Mầm non (khảo sát mục 5 của Sở; DT-16 phần 16j; theo chỉ tiêu, mã số của Sở từ DT-17
// phần 17a, khảo sát mục 10.4). Mỗi biểu gồm các thẻ:
// - thẻ tính từ dữ liệu của năm học đang dùng tại thời điểm xem (bốn thẻ đầu của Biểu 01.ĐN-MN, sức khỏe, cuối năm, đội ngũ);
// - thẻ nhập tay (Biểu 08.ĐN-NSNN, năm thẻ của 1.2.1, 2.3 Đề án ngoại ngữ): "Lấy dữ liệu" điền số tính từ dữ liệu của hệ
//   thống, "Lấy dữ liệu năm trước" điền số đã ghi của năm học trước; cả hai chỉ điền vào màn hình, bấm Ghi mới lưu; "Xóa dữ
//   liệu" xóa số đã ghi của thẻ khi biểu chưa gửi.
// Mọi biểu đăng ký mẫu "gửi lên cấp trên" chạy nội bộ của phần 16a: Xuất tệp gửi (Excel của biểu, lưu bản chụp số liệu),
// nộp bằng tay, Đánh dấu đã gửi; biểu đã gửi khóa cả việc ghi số liệu nhập tay cho tới khi mở khóa. 1.1 gửi theo năm dòng
// của lưới biểu mẫu 1.1.2 (bốn thẻ đầu của Biểu 01.ĐN-MN, Biểu 08.ĐN-NSNN), mỗi dòng một biểu mẫu riêng. Cần phạm vi toàn
// trường theo quyền P17.report.emis; người có quyền P01.school-profile.manage mở khóa
const PERMISSION = PERMISSION_CODES.emisReport;
export const EMIS_RULE_CODE = 'YCTD-129';
const MAXIMUM_VALUE = 1_000_000_000_000;
const NO_ID = '00000000-0000-0000-0000-000000000000';
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
// Biểu chưa khảo sát được nội dung chỉ tiêu (1.3, 2.4) giữ ghi chú của 16j
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
  // Thẻ nhập tay đang khóa vì biểu mẫu gửi của thẻ đã đánh dấu đã gửi
  locked: boolean;
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
  // Hoàn thành dữ liệu theo từng thẻ của 1.1 (năm dòng của lưới biểu mẫu 1.1.2)
  tab_completeness: Record<string, CompletenessItem[]>;
  // Số liệu riêng của biểu lưu vào bản chụp khi xuất tệp gửi (ví dụ loại hình trường của Biểu 01)
  extra: Record<string, unknown>;
}

interface Context {
  currentUser: CurrentUser;
  database: Kysely<SchoolYearDatabase>;
  academicYearId: string;
  rootId: string;
  ownership: SchoolOwnershipType | null;
  institution: InstitutionType | null;
  startYear: number;
  yearRange: { from: string; to: string };
  general: Record<string, unknown>;
  otherInfo: Record<string, unknown>;
  itInfrastructure: Record<string, unknown>;
}

interface EditableTab {
  key: string;
  label: string;
  columns: EmisColumn[];
  rows: EmisRowTemplate[];
  fill?: (context: Context, saved: Record<string, EmisValues>) => Promise<Record<string, EmisValues>>;
  previousYear?: boolean;
}

interface Built {
  tabs: EmisTabView[];
  warnings: string[];
  completeness: CompletenessItem[];
  tabCompleteness?: Record<string, CompletenessItem[]>;
  extra?: Record<string, unknown>;
}

interface FormDefinition {
  code: EmisFormCode;
  allowNoData?: boolean;
  editable: EditableTab[];
  // Ghi chú về chỉ tiêu chưa đối chiếu được với Sở, thêm vào cuối danh sách cảnh báo và đầu trang Excel
  note?: string;
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
  locked: false,
});

const BUDGET_TAB: EditableTab = {
  key: 'budget',
  label: '5. Ngân sách nhà nước',
  columns: EMIS_BUDGET_COLUMNS,
  rows: BUDGET_ROWS,
  previousYear: true,
};

// Biểu mẫu gửi của từng thẻ của 1.1 (lưới biểu mẫu 1.1.2)
const PART_OF_TAB = new Map<string, string>(EMIS_START_OF_YEAR_PARTS.map((part) => [part.tab, part.code]));

// Nhóm tuổi theo bậc học (thiết bị) sang nhóm tuổi của lớp (15b) khi lớp chưa chọn nhóm tuổi
const EQUIPMENT_TO_CLASS_AGE: Record<string, ClassAgeGroupKey> = {
  nt_3_12: 'months_3_12',
  nt_12_24: 'months_13_24',
  nt_24_36: 'months_25_36',
  mg_3_4: 'years_3_4',
  mg_4_5: 'years_4_5',
  mg_5_6: 'years_5_6',
};

const savedOnce = (editable: Map<string, EmisTabView>, tab: string) => editable.get(tab)?.saved_at != null;
const INSTITUTION_TYPES: InstitutionType[] = ['truong_mam_non', 'truong_mau_giao', 'nha_tre', 'nhom_tre_doc_lap'];
const birthYearOf = (dob: unknown): number | null => {
  if (dob instanceof Date) {
    return dob.getFullYear();
  }
  const year = Number(String(dob ?? '').slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
};
const dateText = (value: unknown): string | null =>
  value instanceof Date ? VIETNAM_DATE.format(value) : typeof value === 'string' ? value.slice(0, 10) : null;

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
        note: BUDGET_PENDING_NOTE,
        build: async (context, editable) => this.bieu01(context, editable),
      },
      'emis-facilities': {
        code: 'emis-facilities',
        note: HCM_PENDING_NOTE,
        editable: [
          {
            key: 'facilities',
            label: '1. Cơ sở vật chất',
            columns: EMIS_HCM_FACILITY_COLUMNS,
            rows: templates(buildHcmFacilities([])),
            fill: async (context) => this.hcmFacilities(context),
            previousYear: true,
          },
          {
            key: 'toilets',
            label: '2. Nhà vệ sinh',
            columns: EMIS_FACILITY_COLUMNS,
            rows: TOILET_ROWS,
            fill: async (context) => fillToilets(await this.rooms(context.database)),
            previousYear: true,
          },
          {
            key: 'other',
            label: '3. Cơ sở vật chất khác',
            columns: EMIS_QUANTITY_COLUMNS,
            rows: OTHER_FACILITY_ROWS,
            fill: async (context) => fillOtherFacilities(await this.rooms(context.database), context.general),
            previousYear: true,
          },
          {
            key: 'equipment',
            label: '4. Thiết bị dạy học',
            columns: EMIS_EQUIPMENT_COLUMNS,
            rows: EQUIPMENT_ROWS,
            fill: async (context) => fillEquipment(await this.equipment(context.database)),
            previousYear: true,
          },
          {
            key: 'info',
            label: '5. Thông tin khác',
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
        note: INDICATOR_NOTE,
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
        editable: [
          {
            key: 'indicators',
            label: 'Thống kê số trường, số trẻ',
            columns: EMIS_TOTAL_COLUMNS,
            rows: FOREIGN_LANGUAGE_ROWS,
            fill: async (context, saved) => ({
              ...(await this.foreignLanguage(context)),
              '5': { total: saved['5']?.total ?? null },
            }),
          },
        ],
        build: async (context, editable) => {
          const tabs = [...editable.values()];
          const warnings = ['Chỉ tiêu số 5: thầy/cô nhập trực tiếp vào cột Tổng số rồi bấm Ghi'];
          if (context.otherInfo.english_familiarization !== true) {
            warnings.push(
              'Hồ sơ trường chưa đánh dấu "Cho trẻ làm quen tiếng Anh": chỉ tiêu 2, 4 bằng 0; đánh dấu "Trường không có dữ liệu" khi gửi nếu trường không triển khai',
            );
          }
          return {
            tabs,
            warnings,
            completeness: [{ label: 'Đã ghi Thống kê số trường, số trẻ', done: savedOnce(editable, 'indicators') }],
          };
        },
      },
      'emis-preschool-end-of-year': {
        code: 'emis-preschool-end-of-year',
        editable: [],
        note: INDICATOR_NOTE,
        build: async (context) => this.preschoolEndOfYear(context),
      },
    };

    for (const form of EMIS_FORMS) {
      const definition = this.definitions[form.code];
      if (form.code === 'emis-start-of-year') {
        for (const part of EMIS_START_OF_YEAR_PARTS) {
          forms.register({
            code: part.code,
            name: part.name,
            permission: PERMISSION,
            unlockPermission: PERMISSION_CODES.schoolProfileManage,
            allowNoData: part.tab === 'budget',
            completeness: async (currentUser) =>
              (await this.view(currentUser, form.code)).tab_completeness[part.tab] ?? [],
            snapshot: async (currentUser, ipAddress) => {
              const view = await this.view(currentUser, form.code);
              const tab = view.tabs.find((item) => item.key === part.tab);
              return {
                file: await this.workbook(currentUser, view, ipAddress, part.tab, part.code),
                data: { ...view.extra, code: part.code, name: part.name, tab },
              };
            },
          });
        }
        continue;
      }
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

  // Biểu mẫu gửi khóa thẻ nhập tay: thẻ của 1.1 theo dòng của lưới 1.1.2, biểu khác theo chính biểu
  private submissionCodeOf(definition: FormDefinition, tabKey: string): string {
    return definition.code === 'emis-start-of-year' ? (PART_OF_TAB.get(tabKey) ?? definition.code) : definition.code;
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
        .select(['name', 'start_date', 'end_date'])
        .where('id', '=', current.academicYearId)
        .executeTakeFirstOrThrow(),
    ]);
    const general = (profile?.general ?? {}) as Record<string, unknown>;
    const ownership = SCHOOL_OWNERSHIP_TYPES.some((type) => type.value === general.ownership_type)
      ? (general.ownership_type as SchoolOwnershipType)
      : null;
    const institution = INSTITUTION_TYPES.includes(general.institution_type as InstitutionType)
      ? (general.institution_type as InstitutionType)
      : null;
    const startYear = startYearOf(year.start_date as unknown, year.name, this.clock.now());
    return {
      currentUser,
      database,
      academicYearId: current.academicYearId,
      rootId: root.id,
      ownership,
      institution,
      startYear,
      yearRange: {
        from: dateText(year.start_date) ?? `${startYear}-08-01`,
        to: dateText(year.end_date) ?? `${startYear + 1}-07-31`,
      },
      general,
      otherInfo: (profile?.other_info ?? {}) as Record<string, unknown>,
      itInfrastructure: (profile?.it_infrastructure ?? {}) as Record<string, unknown>,
    };
  }

  private async savedValues(context: Context, formCode: string, tabKey?: string) {
    let query = context.database
      .selectFrom('emis_report_values')
      .select(['tab_key', 'row_code', 'values', 'updated_at', 'updated_by_name'])
      .where('form_code', '=', formCode);
    if (tabKey) {
      query = query.where('tab_key', '=', tabKey);
    }
    return query.execute();
  }

  // Số liệu đã ghi của các thẻ nhập tay, gộp vào danh sách chỉ tiêu của thẻ
  private async editableTabs(context: Context, definition: FormDefinition): Promise<Map<string, EmisTabView>> {
    const result = new Map<string, EmisTabView>();
    if (definition.editable.length === 0) {
      return result;
    }
    const stored = await this.savedValues(context, definition.code);
    for (const tab of definition.editable) {
      const own = stored.filter((row) => row.tab_key === tab.key);
      const latest = own.reduce<(typeof own)[number] | null>(
        (found, row) => (found === null || row.updated_at > found.updated_at ? row : found),
        null,
      );
      const byCode = new Map(own.map((row) => [row.row_code, row.values]));
      const status = await this.submissions.statusOf(this.submissionCodeOf(definition, tab.key));
      result.set(tab.key, {
        key: tab.key,
        label: tab.label,
        columns: tab.columns,
        rows: tab.rows.map((row) => ({
          ...row,
          values: isHeading(row) ? {} : pickColumns(tab.columns, byCode.get(row.code)),
        })),
        editable: true,
        can_fill: tab.fill !== undefined,
        can_copy_previous_year: tab.previousYear === true,
        saved_at: latest?.updated_at ?? null,
        saved_by_name: latest?.updated_by_name ?? null,
        locked: this.submissions.isLocked(status),
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
    const [root, administrativeUnit, year] = await Promise.all([
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
    ]);
    const locked =
      definition.editable.length > 0
        ? [...editable.values()].some((tab) => tab.locked)
        : this.submissions.isLocked(await this.submissions.statusOf(definition.code));
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
      locked,
      tabs: built.tabs,
      warnings: definition.note ? [...built.warnings, definition.note] : built.warnings,
      completeness: built.completeness,
      tab_completeness: built.tabCompleteness ?? {},
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

  private async assertUnlocked(definition: FormDefinition, tabKey: string): Promise<void> {
    const code = this.submissionCodeOf(definition, tabKey);
    if (this.submissions.isLocked(await this.submissions.statusOf(code))) {
      throw ruleViolationError(
        EMIS_RULE_CODE,
        'Biểu đã đánh dấu đã gửi đang khóa; gửi yêu cầu mở khóa và chờ người có quyền mở khóa trước khi sửa số liệu',
      );
    }
  }

  // Ghi số liệu nhập tay của một thẻ: mỗi dòng là mã chỉ tiêu và số theo mã cột (để trống là null). Dòng do máy chủ tính
  // (chỉ tiêu 1 đến 4 của 2.3) ghi theo số tính lại tại thời điểm ghi, không theo số gửi lên
  async save(
    currentUser: CurrentUser,
    code: string,
    tabKey: string,
    rows: Array<{ code: string; values: EmisValues }>,
  ): Promise<EmisFormView> {
    const definition = this.definition(code);
    const tab = this.editableTab(definition, tabKey);
    const context = await this.context(currentUser);
    await this.assertUnlocked(definition, tab.key);
    const known = new Set(tab.rows.filter((row) => !isHeading(row)).map((row) => row.code));
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
    const computedCodes = tab.rows.filter((row) => row.computed).map((row) => row.code);
    const recalculated = computedCodes.length > 0 && tab.fill ? await tab.fill(context, {}) : {};
    const toSave = [
      ...rows.filter((row) => !computedCodes.includes(row.code)),
      ...computedCodes.map((rowCode) => ({ code: rowCode, values: recalculated[rowCode] ?? {} })),
    ];
    const now = this.clock.now();
    await context.database.transaction().execute(async (transaction) => {
      for (const row of toSave) {
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

  // Xóa dữ liệu (nút "Xóa dữ liệu" của trang lập, khảo sát mục 10.4.1): xóa số đã ghi của thẻ nhập tay khi biểu chưa gửi
  async clear(currentUser: CurrentUser, code: string, tabKey: string): Promise<EmisFormView> {
    const definition = this.definition(code);
    const tab = this.editableTab(definition, tabKey);
    const context = await this.context(currentUser);
    await this.assertUnlocked(definition, tab.key);
    await context.database
      .deleteFrom('emis_report_values')
      .where('form_code', '=', definition.code)
      .where('tab_key', '=', tab.key)
      .execute();
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
    await this.assertUnlocked(definition, tab.key);
    let values: Record<string, EmisValues>;
    let sourceName: string;
    if (source === 'data') {
      if (!tab.fill) {
        throw ruleViolationError(EMIS_RULE_CODE, 'Thẻ này không có dữ liệu trong hệ thống để lấy, hãy nhập tay');
      }
      const saved = await this.savedValues(context, definition.code, tab.key);
      values = await tab.fill(context, Object.fromEntries(saved.map((row) => [row.row_code, row.values])));
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
      rows: tab.rows.map((row) => ({
        ...row,
        values: isHeading(row) ? {} : pickColumns(tab.columns, values[row.code]),
      })),
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

  // Tệp Excel của biểu (mỗi thẻ một trang); onlyTab: tệp gửi của một dòng lưới biểu mẫu 1.1.2
  async workbook(
    currentUser: CurrentUser,
    view: EmisFormView,
    ipAddress: string | null,
    onlyTab?: string,
    reportCode: string = view.code,
  ) {
    const createdAt = this.clock.now();
    const note = view.warnings.find((warning) => warning === INDICATOR_NOTE || warning === HCM_PENDING_NOTE);
    return buildFacilitiesWorkbook({
      database: await this.data.database(),
      currentUser,
      reportCode,
      fileName: `${onlyTab ? reportCode : FILE_STEMS[view.code]}-${fileStamp(createdAt)}.xlsx`,
      filters: { form: view.code, ...(onlyTab ? { tab: onlyTab } : {}) },
      orgUnitIds: [],
      ipAddress,
      createdAt,
      sheets: view.tabs
        .filter((tab) => !onlyTab || tab.key === onlyTab)
        .map((tab) => ({
          title: tab.label.slice(0, 31),
          heading: [
            `${view.menu} ${view.name} – ${tab.label}`,
            [
              view.administrative_unit_name ? `Đơn vị hành chính: ${view.administrative_unit_name}` : null,
              view.school_name,
              `năm học ${view.academic_year}`,
            ]
              .filter(Boolean)
              .join(', '),
            ...(note ? [note] : []),
          ],
          columns: [
            { key: 'order', label: 'TT', width: 8 },
            { key: 'label', label: 'Chỉ tiêu', width: 56 },
            { key: 'code', label: 'Mã số', width: 10 },
            { key: 'unit', label: 'Đơn vị', width: 12 },
            ...tab.columns.map((column) => ({
              key: column.key,
              label: column.group ? `${column.group} – ${column.label}` : column.label,
            })),
          ],
          rows: tab.rows.map((row) => ({
            order: row.order ?? '',
            label: row.label,
            code: isHeading(row) ? '' : row.code,
            unit: row.unit,
            ...row.values,
          })),
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

  // Nhóm, lớp đang hoạt động kèm nhóm tuổi (của lớp, chưa chọn thì theo bậc học) và nhóm trẻ hay lớp mẫu giáo
  private async classes(context: Context): Promise<Bieu01Class[]> {
    const { database } = context;
    const units = await database.selectFrom('org_units').select('id').where('status', '=', 'active').execute();
    const [rows, calculated] = await Promise.all([
      database
        .selectFrom('classes')
        .select(['id', 'age_group', 'mixed_age_count', 'room_id', 'two_sessions_per_day', 'boarding'])
        .where('status', '=', 'active')
        // Biểu mẫu EMIS Mầm non chỉ tính lớp cấp Mầm non (DT-19 phần 19d, YCTD-154)
        .where('school_level', '=', 'MN')
        .execute(),
      this.data.classes(
        database,
        units.map((unit) => unit.id),
      ),
    ]);
    const fallback = new Map(calculated.map((row) => [row.id, row.age_group]));
    return rows
      .filter((row) => fallback.has(row.id))
      .map((row) => {
        const equipmentGroup = fallback.get(row.id);
        const ageGroup =
          (row.age_group as ClassAgeGroupKey | null) ??
          (equipmentGroup ? (EQUIPMENT_TO_CLASS_AGE[equipmentGroup] ?? null) : null);
        const stage = ageGroup ? CLASS_AGE_GROUPS.find((group) => group.key === ageGroup)?.stage : undefined;
        return {
          id: row.id,
          stage: stage === 'nhom_tre' ? 'nursery' : stage === 'mau_giao' ? 'kindergarten' : null,
          age_group: ageGroup,
          mixed_age_count: row.mixed_age_count,
          room_id: row.room_id,
          two_sessions_per_day: row.two_sessions_per_day,
          boarding: row.boarding,
        };
      });
  }

  // Nhân sự theo dạng chung của Biểu 01, 2.1, 2.2
  private async staff(context: Context, activeOnly: boolean) {
    let query = context.database
      .selectFrom('staff')
      .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id')
      .select([
        'staff.id',
        'staff.gender',
        'staff.dob',
        'staff.status',
        'staff.start_date',
        'staff.end_date',
        'staff.moet_profile',
        'staff.concurrent_disability_support',
        'staff.concurrent_shared_position',
        'job_titles.name as job_title',
      ]);
    if (activeOnly) {
      query = query.where('staff.status', '=', 'active');
    }
    const rows = await query.execute();
    return rows.map((row) => {
      const text = (key: string) => profileText(row.moet_profile, key);
      const jobPosition = text('job_position');
      const person: StaffReportPerson & { id: string; active: boolean; start: string | null; end: string | null } = {
        id: row.id,
        active: row.status === 'active',
        start: dateText(row.start_date),
        end: dateText(row.end_date),
        gender: row.gender,
        ethnicity: text('ethnicity'),
        birth_year: birthYearOf(row.dob),
        category: staffCategory({
          position_group: text('position_group') ?? jobPosition,
          job_title: row.job_title,
        }),
        job_title: row.job_title,
        job_position: jobPosition,
        teaching_group: text('teaching_group'),
        qualification: text('professional_qualification'),
        rank: text('civil_service_rank'),
        contract_form: text('contract_form'),
        concurrent_disability_support: row.concurrent_disability_support,
        concurrent_shared_position: row.concurrent_shared_position,
        civil_servant_evaluation: text('civil_servant_evaluation'),
        excellent_teacher: text('excellent_teacher'),
        language_framework_level: text('language_framework_level'),
        language_training_level: text('language_training_level'),
        language_certificate_type: text('language_certificate_type'),
        main_foreign_language: text('main_foreign_language'),
        it_level: text('it_level'),
      };
      return { person, staffStatus: text('staff_status') };
    });
  }

  // Trẻ đang học kèm lớp hiện tại; chưa có lớp thì class_id trống
  private async children(context: Context) {
    const rows = await context.database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .select([
        'children.id',
        'children.gender',
        'children.dob',
        'children.moet_profile',
        'children.special_needs_note',
        'children.two_sessions_per_day',
        'children.boarding',
        'children.policy_benefits',
        'class_enrollments.class_id',
      ])
      .where('children.status', '=', 'active')
      .where('children.deleted_at', 'is', null)
      .execute();
    // Bỏ trẻ đang học lớp ngoài cấp Mầm non (YCTD-154)
    const outside = await childIdsOutsideLevel(context.database, 'MN');
    const seen = new Set<string>();
    return rows.filter((row) => {
      if (seen.has(row.id) || outside.has(row.id)) {
        return false;
      }
      seen.add(row.id);
      return true;
    });
  }

  // Đánh giá dinh dưỡng theo số đo gần nhất của học kỳ
  private async nutrition(context: Context, term: 'first_term' | 'second_term'): Promise<Map<string, Nutrition>> {
    const terms = await this.schoolTerms.ranges();
    const children = await loadStartOfYearHealthChildren(context.database, terms, term);
    const result = new Map<string, Nutrition>();
    for (const child of children) {
      if (child.id && child.assessment) {
        result.set(child.id, {
          weight_status: child.assessment.weight_status,
          height_status: child.assessment.height_status,
          weight_height_status: child.assessment.weight_height_status,
        });
      }
    }
    return result;
  }

  // 1.1.1 Lập báo cáo đầu năm: Biểu 01.ĐN-MN bốn thẻ tính và thẻ Biểu 08.ĐN-NSNN nhập tay
  private async bieu01(context: Context, editable: Map<string, EmisTabView>): Promise<Built> {
    const { database } = context;
    const [units, classes, children, staff, rooms, nutrition] = await Promise.all([
      database.selectFrom('org_units').select('unit_type').where('status', '=', 'active').execute(),
      this.classes(context),
      this.children(context),
      this.staff(context, true),
      database
        .selectFrom('rooms')
        .select(['id', 'room_type', 'condition', 'facility_attributes'])
        .where('status', '=', 'active')
        .execute(),
      this.nutrition(context, 'first_term'),
    ]);
    const result = buildBieu01({
      school: {
        ownership: context.ownership,
        institution_type: context.institution,
        other_info: context.otherInfo,
        national_standard_level:
          typeof context.general.national_standard_level === 'string' ? context.general.national_standard_level : null,
        branches: units.filter((unit) => unit.unit_type === 'phan_hieu').length,
        sites: units.filter((unit) => unit.unit_type === 'diem_truong').length,
      },
      startYear: context.startYear,
      classes,
      children: children.map((child) => ({
        gender: child.gender,
        ethnicity: profileText(child.moet_profile, 'ethnicity'),
        birth_year: birthYearOf(child.dob) ?? context.startYear,
        class_id: child.class_id,
        disabled:
          hasDisability(profileText(child.moet_profile, 'disability_type')) || !!child.special_needs_note?.trim(),
        two_sessions_per_day: child.two_sessions_per_day,
        boarding: child.boarding,
        policy_benefits: child.policy_benefits ?? [],
        nutrition: nutrition.get(child.id) ?? null,
      })),
      staff: staff.map((member) => member.person as Bieu01Staff),
      rooms: rooms.map((room) => ({
        id: room.id,
        room_type: room.room_type,
        condition: room.condition,
        attributes: room.facility_attributes ?? {},
      })),
    });
    const budget = editable.get('budget') as EmisTabView;
    const warnings = [...result.warnings];
    if (context.ownership === null) {
      warnings.unshift(
        'Chưa khai báo loại hình trường trong hồ sơ trường: cột công lập, tư thục, dân lập của thẻ Trường – Lớp để trống',
      );
    }
    if (!savedOnce(editable, 'budget')) {
      warnings.push('Chưa ghi thẻ Ngân sách nhà nước (trường tư thục, dân lập để trống được)');
    }
    const tabCompleteness: Record<string, CompletenessItem[]> = {
      school_classes: [
        { label: 'Đã khai báo loại hình trường trong hồ sơ trường', done: context.ownership !== null },
        { label: 'Đã chọn cơ sở giáo dục mầm non trong hồ sơ trường', done: context.institution !== null },
        {
          label: 'Mọi nhóm, lớp đã xếp được nhóm tuổi',
          done: classes.every((item) => item.stage !== null),
        },
      ],
      children: [
        {
          label: 'Có số đo của đợt cân đo thuộc học kỳ I (mục 4.3.1)',
          done: nutrition.size > 0,
        },
      ],
      staff: [
        {
          label: 'Mọi nhân sự đã ghi hình thức hợp đồng (mục 3.1.1)',
          done: !result.warnings.some((warning) => warning.includes('hình thức hợp đồng')),
        },
      ],
      rooms: [
        {
          label: 'Mọi phòng đã khai báo hiện trạng',
          done: !result.warnings.some((warning) => warning.includes('chưa khai báo hiện trạng')),
        },
      ],
      budget: [{ label: 'Đã ghi thẻ Ngân sách nhà nước', done: savedOnce(editable, 'budget') }],
    };
    return {
      tabs: [
        computed('school_classes', '1. Trường – Lớp', EMIS_OWNERSHIP_COLUMNS, result.school_classes),
        computed('children', '2. Trẻ em', EMIS_CHILD_COLUMNS, result.children),
        computed('staff', '3. Đội ngũ', EMIS_STAFF_COLUMNS, result.staff),
        computed('rooms', '4. Cơ sở vật chất', EMIS_ROOM_COLUMNS, result.rooms),
        budget,
      ],
      warnings,
      completeness: Object.values(tabCompleteness).flat(),
      tabCompleteness,
      extra: { ownership: context.ownership, institution_type: context.institution, start_year: context.startYear },
    };
  }

  // Phòng của thẻ 1 của 1.2.1: nhà trẻ hay mẫu giáo theo lớp gắn với phòng, không có lớp thì theo loại trường
  private async hcmFacilities(context: Context): Promise<Record<string, EmisValues>> {
    const [rooms, classes] = await Promise.all([
      context.database
        .selectFrom('rooms')
        .select(['id', 'room_type', 'condition', 'built_this_year', 'facility_attributes'])
        .where('status', '=', 'active')
        .execute(),
      this.classes(context),
    ]);
    const stageOfRoom = new Map<string, string | null>();
    for (const item of classes) {
      if (item.room_id && !stageOfRoom.has(item.room_id)) {
        stageOfRoom.set(item.room_id, item.stage);
      }
    }
    const hcmRooms: HcmRoom[] = rooms.map((room) => {
      const stage = stageOfRoom.get(room.id);
      return {
        room_type: room.room_type,
        condition: room.condition,
        built_this_year: room.built_this_year,
        attributes: room.facility_attributes ?? {},
        nursery: stage ? stage === 'nursery' : context.institution === 'nha_tre',
      };
    });
    return Object.fromEntries(buildHcmFacilities(hcmRooms).map((row) => [row.code, row.values]));
  }

  private async foreignLanguage(context: Context): Promise<Record<string, EmisValues>> {
    const [children, classes] = await Promise.all([this.children(context), this.classes(context)]);
    const stage = new Map(classes.map((item) => [item.id, item.stage]));
    const kindergarten = children.filter((child) => {
      const value = child.class_id ? stage.get(child.class_id) : null;
      const birthYear = birthYearOf(child.dob) ?? context.startYear;
      return value
        ? value === 'kindergarten'
        : !childIsNursery({ age_group: null, birth_year: birthYear }, context.startYear);
    });
    return fillForeignLanguage({
      english_familiarization: context.otherInfo.english_familiarization === true,
      children: children.length,
      kindergarten_children: kindergarten.length,
    });
  }

  // 2.1 Lập báo cáo cuối năm theo cấu trúc của Sở
  private async endOfYear(context: Context): Promise<Built> {
    const { database } = context;
    const [units, classes, children, staff, nutrition, evaluations] = await Promise.all([
      database.selectFrom('org_units').select('unit_type').where('status', '=', 'active').execute(),
      this.classes(context),
      this.children(context),
      this.staff(context, false),
      this.nutrition(context, 'second_term'),
      database
        .selectFrom('professional_evaluations')
        .select(['staff_id', 'overall_level', 'finalized_at'])
        .where('status', '=', 'finalized')
        .where('standard_type', '=', 'teacher')
        .orderBy('finalized_at', 'asc')
        .execute(),
    ]);
    const latestLevel = new Map(evaluations.map((row) => [row.staff_id, row.overall_level]));
    const stage = new Map(classes.map((item) => [item.id, item]));
    const rows = buildEndOfYear({
      institution_type: context.institution,
      sites: units.filter((unit) => unit.unit_type === 'diem_truong').length,
      nursery_classes: classes.filter((item) => item.stage === 'nursery').length,
      kindergarten_classes: classes.filter((item) => item.stage === 'kindergarten').length,
      children: children.map((child) => {
        const item = child.class_id ? stage.get(child.class_id) : undefined;
        const birthYear = birthYearOf(child.dob) ?? context.startYear;
        const nursery = item?.stage
          ? item.stage === 'nursery'
          : childIsNursery({ age_group: null, birth_year: birthYear }, context.startYear);
        return {
          nursery,
          five_to_six: item?.age_group ? item.age_group === 'years_5_6' : context.startYear - birthYear === 5,
          nutrition: nutrition.get(child.id) ?? null,
        };
      }),
      staff: staff.map((member): EndOfYearStaff => ({
        ...member.person,
        active: member.person.active,
        start_date: member.person.start,
        end_date: member.person.end,
        staff_status: member.staffStatus,
        standard_level: latestLevel.get(member.person.id) ?? null,
      })),
      year: context.yearRange,
    });
    const warnings: string[] = [];
    if (nutrition.size === 0) {
      warnings.push('Chưa có số đo của đợt cân đo nào thuộc học kỳ II (mục 4.3.1): mục 3.2 Tình trạng dinh dưỡng để 0');
    }
    if (evaluations.length === 0) {
      warnings.push('Chưa có phiếu đánh giá chuẩn nghề nghiệp giáo viên nào đã chốt (mục 3.2): mục 4.2 để 0');
    }
    return {
      tabs: [computed('end_of_year', 'Báo cáo cuối năm', EMIS_TOTAL_COLUMNS, rows)],
      warnings,
      completeness: [
        { label: 'Đã chọn cơ sở giáo dục mầm non trong hồ sơ trường', done: context.institution !== null },
        { label: 'Có số đo của đợt cân đo thuộc học kỳ II (mục 4.3.1)', done: nutrition.size > 0 },
        { label: 'Có phiếu đánh giá chuẩn nghề nghiệp giáo viên đã chốt', done: evaluations.length > 0 },
      ],
      extra: { institution_type: context.institution },
    };
  }

  // 2.2 Báo cáo đội ngũ: ba biểu của Sở, mỗi biểu hai thẻ
  private async staffReport(context: Context): Promise<Built> {
    const { database } = context;
    const [staff, classes] = await Promise.all([this.staff(context, true), this.classes(context)]);
    const ids = staff.map((member) => member.person.id);
    const evaluations = await database
      .selectFrom('professional_evaluations')
      .select(['id', 'staff_id', 'standard_type', 'overall_level', 'finalized_at'])
      .where('status', '=', 'finalized')
      .where('staff_id', 'in', ids.length ? ids : [NO_ID])
      .orderBy('finalized_at', 'asc')
      .execute();
    // Phiếu đã chốt gần nhất của mỗi người theo từng loại chuẩn
    const latest = new Map(evaluations.map((row) => [`${row.staff_id}:${row.standard_type}`, row]));
    const chosen = [...latest.values()];
    const items = await database
      .selectFrom('professional_evaluation_items')
      .select(['evaluation_id', 'order_no', 'is_key', 'self_rating', 'assessor_rating'])
      .where('evaluation_id', 'in', chosen.length ? chosen.map((row) => row.id) : [NO_ID])
      .execute();
    const byId = new Map(staff.map((member) => [member.person.id, member.person]));
    const tabs = buildStaffForms({
      schools: 1,
      classes: classes.length,
      institution_type: context.institution,
      startYear: context.startYear,
      staff: staff.map((member) => member.person),
      evaluations: chosen.map((row): StaffEvaluation => ({
        standard_type: row.standard_type,
        vice: isPrincipal(byId.get(row.staff_id) ?? { job_title: null, job_position: null }) === 'vice',
        overall_level: row.overall_level,
        items: items.filter((item) => item.evaluation_id === row.id),
      })),
    });
    const warnings: string[] = [];
    const withoutQualification = staff.filter((member) => !member.person.qualification).length;
    if (withoutQualification > 0) {
      warnings.push(
        `${withoutQualification} nhân sự chưa ghi trình độ chuyên môn (mục 3.1.1): xếp vào dòng "Khác" của trình độ đào tạo`,
      );
    }
    if (chosen.length === 0) {
      warnings.push('Chưa có phiếu đánh giá chuẩn nghề nghiệp nào đã chốt (mục 3.2): biểu 2.2.3 để 0');
    }
    return {
      tabs: [
        computed('general_managers', '2.2.1 – 1. Cán bộ quản lý', EMIS_TOTAL_FEMALE_COLUMNS, tabs.general_managers),
        computed(
          'general_teachers',
          '2.2.1 – 2. Giáo viên – Nhân viên',
          EMIS_TOTAL_FEMALE_COLUMNS,
          tabs.general_teachers,
        ),
        computed('skills_managers', '2.2.2 – 1. Cán bộ quản lý', EMIS_TOTAL_FEMALE_COLUMNS, tabs.skills_managers),
        computed('skills_teachers', '2.2.2 – 2. Giáo viên', EMIS_TOTAL_FEMALE_COLUMNS, tabs.skills_teachers),
        computed('standards_managers', '2.2.3 – 1. Cán bộ quản lý', EMIS_STANDARD_COLUMNS, tabs.standards_managers),
        computed('standards_teachers', '2.2.3 – 2. Giáo viên', EMIS_STANDARD_COLUMNS, tabs.standards_teachers),
      ],
      warnings,
      completeness: [
        { label: 'Mọi nhân sự đã ghi trình độ chuyên môn', done: withoutQualification === 0 },
        { label: 'Có phiếu đánh giá chuẩn nghề nghiệp đã chốt', done: chosen.length > 0 },
      ],
    };
  }

  // 2.4 Lập báo cáo cuối năm GDMN: ở học kỳ I trang của Sở trống (khảo sát mục 10.4.5), nên chỉ tính từ học kỳ II
  private async preschoolEndOfYear(context: Context): Promise<Built> {
    const terms = await this.schoolTerms.ranges();
    if (termOfDate(VIETNAM_DATE.format(this.clock.now()), terms) === 'first_term') {
      return {
        tabs: [],
        warnings: ['Biểu lập ở học kỳ II như hệ thống của Sở: ở học kỳ I biểu trống'],
        completeness: [{ label: 'Đã sang học kỳ II', done: false }],
      };
    }
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
      warnings: report.warnings.filter((warning) => !warning.startsWith('Mã số và tên chỉ tiêu')),
      completeness: [
        { label: 'Đã khai báo loại hình trường trong hồ sơ trường', done: report.ownership !== null },
        {
          label: 'Đã đánh giá hoàn thành chương trình cho mọi trẻ 5–6 tuổi (mục 4.4)',
          done: !children.some((child) => child.status === 'active' && child.five_to_six && !child.completion),
        },
      ],
      extra: { ownership: report.ownership },
    };
  }

  // Học sinh của năm học (đang học, đã nghỉ) kèm nhóm tuổi, khuyết tật, hoàn thành chương trình (2.4, DT-16 phần 16j)
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
    // Bỏ trẻ đang học lớp ngoài cấp Mầm non (YCTD-154)
    const outside = await childIdsOutsideLevel(database, 'MN');
    const seen = new Set<string>();
    const result: YearChild[] = [];
    for (const child of children) {
      if (seen.has(child.id) || outside.has(child.id)) {
        continue;
      }
      seen.add(child.id);
      const birthYear = birthYearOf(child.dob) ?? context.startYear;
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
}

// Năm bắt đầu năm học (tính tuổi theo năm sinh như Biểu 1)
function startYearOf(startDate: unknown, name: string, now: Date): number {
  if (startDate instanceof Date) {
    return startDate.getFullYear();
  }
  if (typeof startDate === 'string') {
    return Number(startDate.slice(0, 4));
  }
  return Number(/\d{4}/.exec(name)?.[0] ?? now.getFullYear());
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

  @Delete(':form/tabs/:tab')
  @RequirePermission(PERMISSION)
  clear(@Param('form') form: string, @Param('tab') tab: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.forms.clear(currentUser, form, tab);
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
