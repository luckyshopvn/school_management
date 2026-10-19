import { Body, Controller, Get, HttpCode, Injectable, Post, Req, Res } from '@nestjs/common';
import type { EmisRecordType, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  EMIS_DATA_COMPLETION_LABELS,
  EMIS_RECORD_TYPES,
  EMIS_START_OF_YEAR_PARTS,
  PERMISSION_CODES,
  type EmisRecordTypeCode,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import type { RequestBody } from '../common/request-fields.js';
import { FacilitiesData } from '../facilities/facilities-data.js';
import {
  buildFacilitiesWorkbook,
  fileStamp,
  sendWorkbook,
  type ExportedFile,
} from '../facilities/facilities-workbook.js';
import { loadStartOfYearHealthChildren } from '../health/emis-health-report.js';
import { SchoolTerms } from '../health/school-terms.js';
import { UpperLevelSubmissions, type SubmissionView } from '../submissions/upper-level-submissions.js';
import { EmisForms } from './emis-forms.js';
import { isHeading } from './emis-01-calc.js';

// 1.1.2 Gửi báo cáo đầu năm (DT-17 phần 17a, YCTD-132; khảo sát mục 10.4.3), bản chạy nội bộ theo quyết định của Eric ngày
// 2026-10-16 (không có kết nối với hệ thống của Bộ, Sở):
// - lưới hồ sơ: năm loại hồ sơ như Sở; Tổng số là số đối tượng đang có; Số đã gửi thành công là số đối tượng đã đánh dấu gửi ở
//   trang này hoặc có hồ sơ kí "Đã đánh dấu gửi" ở 2.3 của phân hệ Quản lý kí hồ sơ trong năm học; Số cần gửi là phần còn
//   lại. "Gửi hồ sơ" lập tệp danh sách hồ sơ cần gửi (để nộp bằng tay) và đánh dấu các hồ sơ đó đã gửi;
// - lưới biểu mẫu: bốn thẻ đầu của Biểu 01.ĐN-MN và Biểu 08.ĐN-NSNN, mỗi dòng một biểu mẫu của mẫu "gửi lên cấp trên" (16a).
//   "Gửi hồ sơ" với dòng biểu mẫu là Xuất tệp gửi rồi Đánh dấu đã gửi ngày hôm nay; dòng "Không có dữ liệu" (Biểu 08 để trống)
//   đánh dấu "Trường không có dữ liệu";
// - "Xuất file lỗi": hồ sơ thiếu mã định danh của Bộ (sức khỏe: trẻ chưa có số đo học kỳ I) và điều kiện hoàn thành dữ liệu
//   chưa đạt của biểu mẫu chọn;
// - "Đặt trạng thái gửi lại" (người có quyền mở khóa): bỏ đánh dấu đã gửi ở trang này của loại hồ sơ chọn, chuyển biểu mẫu
//   đã gửi sang "Cần gửi lại". Hồ sơ đánh dấu gửi ở phân hệ kí đặt lại ở phân hệ kí.
// "Hủy" chỉ bỏ các dòng đã chọn trên màn hình (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11)
export const SENDING_RULE_CODE = 'YCTD-132';
const PERMISSION = PERMISSION_CODES.emisReport;
const UNLOCK_PERMISSION = PERMISSION_CODES.schoolProfileManage;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const RECORD_CODES = EMIS_RECORD_TYPES.map((type) => type.value) as EmisRecordTypeCode[];
const PART_CODES = EMIS_START_OF_YEAR_PARTS.map((part) => part.code) as string[];
const SIGNING_OBJECT: Partial<Record<EmisRecordTypeCode, string>> = {
  school: 'school',
  staff: 'staff',
  class: 'class',
  child: 'child',
};

interface Entity {
  id: string;
  code: string;
  name: string;
  // Lý do không gửi được (thiếu mã định danh của Bộ...) để ghi vào file lỗi
  problem: string | null;
}

export interface RecordRow {
  record_type: EmisRecordTypeCode;
  name: string;
  total: number;
  sent: number;
  to_send: number;
  last_sent_at: Date | null;
  status: string;
}

export interface FormRow extends SubmissionView {
  completion: keyof typeof EMIS_DATA_COMPLETION_LABELS;
  completion_label: string;
}

@Injectable()
export class EmisSending {
  constructor(
    private readonly forms: EmisForms,
    private readonly submissions: UpperLevelSubmissions,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly data: FacilitiesData,
    private readonly schoolTerms: SchoolTerms,
    private readonly clock: Clock,
  ) {}

  private async assertScope(currentUser: CurrentUser): Promise<void> {
    await this.data.assertWholeSchool(
      currentUser,
      [PERMISSION],
      'Báo cáo EMIS lập cho toàn trường, cần phạm vi toàn trường',
    );
  }

  private async entities(database: Kysely<SchoolYearDatabase>, type: EmisRecordTypeCode): Promise<Entity[]> {
    if (type === 'school') {
      const root = await this.data.root(database);
      const profile = await database
        .selectFrom('school_profiles')
        .select('general')
        .where('org_unit_id', '=', root.id)
        .executeTakeFirst();
      const code = (profile?.general as Record<string, unknown> | undefined)?.moet_code;
      return [
        {
          id: root.id,
          code: typeof code === 'string' ? code : '',
          name: root.name,
          problem: typeof code === 'string' && code.trim() !== '' ? null : 'Chưa có mã định danh của trường',
        },
      ];
    }
    if (type === 'staff') {
      const rows = await database
        .selectFrom('staff')
        .select(['id', 'code', 'full_name', 'moet_staff_code'])
        .where('status', '=', 'active')
        .orderBy('full_name')
        .execute();
      return rows.map((row) => ({
        id: row.id,
        code: row.moet_staff_code ?? row.code,
        name: row.full_name,
        problem: row.moet_staff_code ? null : 'Chưa có mã định danh Bộ GD&ĐT',
      }));
    }
    if (type === 'class') {
      const rows = await database
        .selectFrom('classes')
        .select(['id', 'code', 'name'])
        .where('status', '=', 'active')
        .orderBy('name')
        .execute();
      return rows.map((row) => ({ id: row.id, code: row.code, name: row.name, problem: null }));
    }
    const children = await database
      .selectFrom('children')
      .select(['id', 'full_name', 'moet_student_code'])
      .where('status', '=', 'active')
      .where('deleted_at', 'is', null)
      .orderBy('full_name')
      .execute();
    if (type === 'child') {
      return children.map((row) => ({
        id: row.id,
        code: row.moet_student_code ?? '',
        name: row.full_name,
        problem: row.moet_student_code ? null : 'Chưa có mã học sinh của Bộ',
      }));
    }
    const terms = await this.schoolTerms.ranges();
    const health = await loadStartOfYearHealthChildren(database, terms, 'first_term');
    const measured = new Set(health.filter((child) => child.assessment !== null).map((child) => child.id));
    return children.map((row) => ({
      id: row.id,
      code: row.moet_student_code ?? '',
      name: row.full_name,
      problem: measured.has(row.id) ? null : 'Chưa có số đo của đợt cân đo thuộc học kỳ I',
    }));
  }

  // Đối tượng đã đánh dấu gửi (trang này và phân hệ kí) kèm thời điểm gửi gần nhất
  private async sentMarks(
    database: Kysely<SchoolYearDatabase>,
    academicYearId: string,
  ): Promise<Map<EmisRecordTypeCode, Map<string, Date>>> {
    const [own, signed] = await Promise.all([
      database.selectFrom('emis_record_submissions').select(['record_type', 'entity_id', 'sent_at']).execute(),
      this.databases.system
        .selectFrom('signing_dossiers')
        .select(['object_type', 'object_id', 'marked_sent_at'])
        .where('academic_year_id', '=', academicYearId)
        .where('status', '=', 'sent')
        .execute(),
    ]);
    const result = new Map<EmisRecordTypeCode, Map<string, Date>>(RECORD_CODES.map((code) => [code, new Map()]));
    const mark = (type: EmisRecordTypeCode, id: string, at: Date) => {
      const marks = result.get(type)!;
      const previous = marks.get(id);
      if (!previous || previous < at) {
        marks.set(id, at);
      }
    };
    for (const row of own) {
      mark(row.record_type, row.entity_id, row.sent_at);
    }
    for (const row of signed) {
      const type = RECORD_CODES.find((code) => SIGNING_OBJECT[code] === row.object_type);
      if (type && row.marked_sent_at) {
        mark(type, row.object_id, row.marked_sent_at);
      }
    }
    return result;
  }

  private async recordRows(currentUser: CurrentUser): Promise<RecordRow[]> {
    void currentUser;
    const { database, academicYearId } = await this.currentSchoolYear.require();
    const marks = await this.sentMarks(database, academicYearId);
    const rows: RecordRow[] = [];
    for (const type of EMIS_RECORD_TYPES) {
      const entities = await this.entities(database, type.value);
      const own = marks.get(type.value)!;
      const sentDates = entities.map((entity) => own.get(entity.id)).filter((date): date is Date => !!date);
      const sent = sentDates.length;
      const lastSent = sentDates.reduce<Date | null>(
        (found, date) => (found === null || date > found ? date : found),
        null,
      );
      rows.push({
        record_type: type.value,
        name: type.label,
        total: entities.length,
        sent,
        to_send: entities.length - sent,
        last_sent_at: lastSent,
        status:
          entities.length === 0
            ? 'Không có hồ sơ'
            : sent === entities.length
              ? 'Đã gửi đủ'
              : sent === 0
                ? 'Chưa gửi'
                : 'Còn hồ sơ cần gửi',
      });
    }
    return rows;
  }

  private async formRows(currentUser: CurrentUser): Promise<FormRow[]> {
    const [items, view] = await Promise.all([
      this.submissions.list(currentUser, PART_CODES),
      this.forms.view(currentUser, 'emis-start-of-year'),
    ]);
    return items.map((item) => {
      const part = EMIS_START_OF_YEAR_PARTS.find((entry) => entry.code === item.form_code)!;
      const tab = view.tabs.find((entry) => entry.key === part.tab);
      const empty =
        !tab || tab.rows.every((row) => isHeading(row) || Object.values(row.values).every((value) => !value));
      const completion: FormRow['completion'] = item.data_complete
        ? empty && item.allow_no_data
          ? 'no_data'
          : 'complete'
        : empty && item.allow_no_data
          ? 'no_data'
          : 'incomplete';
      return { ...item, completion, completion_label: EMIS_DATA_COMPLETION_LABELS[completion] };
    });
  }

  async overview(currentUser: CurrentUser) {
    await this.assertScope(currentUser);
    const [records, forms] = await Promise.all([this.recordRows(currentUser), this.formRows(currentUser)]);
    return {
      records,
      forms,
      can_manage: currentUser.hasPermission(PERMISSION),
      can_unlock: currentUser.hasPermission(UNLOCK_PERMISSION),
    };
  }

  // Gửi hồ sơ: lập một tệp gồm danh sách hồ sơ cần gửi của từng loại chọn và danh sách biểu mẫu đã đánh dấu gửi
  async send(
    currentUser: CurrentUser,
    selection: { records: EmisRecordTypeCode[]; forms: string[] },
    ipAddress: string | null,
  ): Promise<ExportedFile> {
    await this.assertScope(currentUser);
    const { database, academicYearId } = await this.currentSchoolYear.require();
    const formRows = (await this.formRows(currentUser)).filter((row) => selection.forms.includes(row.form_code));
    const blocked = formRows.filter((row) => row.status === 'sent' || row.status === 'unlock_requested');
    if (blocked.length > 0) {
      throw ruleViolationError(
        SENDING_RULE_CODE,
        `${blocked.map((row) => row.form_name).join(', ')} đã gửi; đặt trạng thái gửi lại trước khi gửi lần nữa`,
      );
    }
    const incomplete = formRows.filter((row) => row.completion === 'incomplete');
    if (incomplete.length > 0) {
      throw ruleViolationError(
        SENDING_RULE_CODE,
        `${incomplete.map((row) => row.form_name).join(', ')} chưa đầy đủ dữ liệu; bấm "Xuất file lỗi" để xem điều kiện còn thiếu`,
      );
    }
    const today = VIETNAM_DATE.format(this.clock.now());
    const sentForms: Array<{ order: number; name: string; file: string; result: string }> = [];
    for (const row of formRows) {
      const exported = await this.submissions.export(currentUser, row.form_code, ipAddress);
      await this.submissions.markSent(currentUser, row.form_code, {
        sentOn: today,
        note: 'Gửi ở 1.1.2 Gửi báo cáo đầu năm',
        noData: row.completion === 'no_data',
      });
      sentForms.push({
        order: sentForms.length + 1,
        name: row.form_name,
        file: exported.file_name ?? '',
        result: row.completion === 'no_data' ? 'Đã đánh dấu gửi, trường không có dữ liệu' : 'Đã đánh dấu gửi',
      });
    }
    const marks = await this.sentMarks(database, academicYearId);
    const batchId = randomUUID();
    const sheets = [];
    for (const type of EMIS_RECORD_TYPES.filter((entry) => selection.records.includes(entry.value))) {
      const pending = (await this.entities(database, type.value)).filter(
        (entity) => !marks.get(type.value)!.has(entity.id),
      );
      if (pending.length > 0) {
        await database
          .insertInto('emis_record_submissions')
          .values(
            pending.map((entity) => ({
              record_type: type.value as EmisRecordType,
              entity_id: entity.id,
              batch_id: batchId,
              sent_by: currentUser.id,
              sent_by_name: currentUser.description.full_name,
            })),
          )
          .onConflict((conflict) => conflict.columns(['record_type', 'entity_id']).doNothing())
          .execute();
      }
      sheets.push({
        title: type.label,
        heading: [
          `1.1.2 Gửi báo cáo đầu năm – ${type.label}`,
          pending.length === 0 ? 'Không còn hồ sơ cần gửi' : `${pending.length} hồ sơ đã đánh dấu gửi ngày ${today}`,
        ],
        columns: [
          { key: 'order', label: 'STT', width: 6 },
          { key: 'code', label: 'Mã', width: 18 },
          { key: 'name', label: 'Tên', width: 40 },
        ],
        rows: pending.map((entity, index) => ({ order: index + 1, code: entity.code, name: entity.name })),
      });
    }
    if (sentForms.length > 0) {
      sheets.push({
        title: 'Biểu mẫu',
        heading: [`1.1.2 Gửi báo cáo đầu năm – biểu mẫu đã đánh dấu gửi ngày ${today}`],
        columns: [
          { key: 'order', label: 'STT', width: 6 },
          { key: 'name', label: 'Biểu mẫu báo cáo', width: 44 },
          { key: 'file', label: 'Tệp gửi', width: 40 },
          { key: 'result', label: 'Kết quả', width: 40 },
        ],
        rows: sentForms,
      });
    }
    if (sheets.length === 0) {
      throw validationError([{ field: 'records', message: 'Chọn ít nhất một hồ sơ hoặc biểu mẫu' }]);
    }
    const createdAt = this.clock.now();
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: 'emis-start-of-year-send',
      fileName: `gui-bao-cao-dau-nam-${fileStamp(createdAt)}.xlsx`,
      filters: selection,
      orgUnitIds: [],
      ipAddress,
      createdAt,
      sheets,
    });
  }

  async errorFile(
    currentUser: CurrentUser,
    selection: { records: EmisRecordTypeCode[]; forms: string[] },
    ipAddress: string | null,
  ): Promise<ExportedFile> {
    await this.assertScope(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const rows: Array<{ order: number; group: string; code: string; name: string; problem: string }> = [];
    for (const type of EMIS_RECORD_TYPES.filter((entry) => selection.records.includes(entry.value))) {
      for (const entity of await this.entities(database, type.value)) {
        if (entity.problem) {
          rows.push({
            order: rows.length + 1,
            group: type.label,
            code: entity.code,
            name: entity.name,
            problem: entity.problem,
          });
        }
      }
    }
    for (const row of (await this.formRows(currentUser)).filter((item) => selection.forms.includes(item.form_code))) {
      for (const item of row.completeness.filter((entry) => !entry.done)) {
        rows.push({ order: rows.length + 1, group: row.form_name, code: '', name: '', problem: item.label });
      }
    }
    const createdAt = this.clock.now();
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: 'emis-start-of-year-errors',
      fileName: `file-loi-bao-cao-dau-nam-${fileStamp(createdAt)}.xlsx`,
      filters: selection,
      orgUnitIds: [],
      ipAddress,
      createdAt,
      sheets: [
        {
          title: 'File lỗi',
          heading: [
            '1.1.2 Gửi báo cáo đầu năm – file lỗi',
            rows.length === 0 ? 'Không có lỗi' : `${rows.length} lỗi cần bổ sung trước khi gửi`,
          ],
          columns: [
            { key: 'order', label: 'STT', width: 6 },
            { key: 'group', label: 'Hồ sơ, biểu mẫu', width: 36 },
            { key: 'code', label: 'Mã', width: 18 },
            { key: 'name', label: 'Tên', width: 36 },
            { key: 'problem', label: 'Lỗi', width: 60 },
          ],
          rows,
        },
      ],
    });
  }

  async resend(
    currentUser: CurrentUser,
    selection: { records: EmisRecordTypeCode[]; forms: string[] },
    note: string | null,
  ) {
    await this.assertScope(currentUser);
    if (!currentUser.hasPermission(UNLOCK_PERMISSION)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền đặt trạng thái gửi lại');
    }
    const { database } = await this.currentSchoolYear.require();
    if (selection.records.length > 0) {
      await database
        .deleteFrom('emis_record_submissions')
        .where('record_type', 'in', selection.records as EmisRecordType[])
        .execute();
    }
    const forms = (await this.submissions.list(currentUser, PART_CODES)).filter(
      (row) => selection.forms.includes(row.form_code) && (row.status === 'sent' || row.status === 'unlock_requested'),
    );
    for (const row of forms) {
      await this.submissions.setResend(currentUser, row.form_code, note);
    }
    return this.overview(currentUser);
  }
}

function readSelection(body: RequestBody): { records: EmisRecordTypeCode[]; forms: string[] } {
  const errors: FieldError[] = [];
  const list = (field: 'records' | 'forms', allowed: string[]) => {
    const value = body?.[field] ?? [];
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !allowed.includes(item))) {
      errors.push({ field, message: 'Danh sách không hợp lệ' });
      return [];
    }
    return [...new Set(value as string[])];
  };
  const records = list('records', RECORD_CODES) as EmisRecordTypeCode[];
  const forms = list('forms', PART_CODES);
  if (errors.length === 0 && records.length === 0 && forms.length === 0) {
    errors.push({ field: 'records', message: 'Chọn ít nhất một hồ sơ hoặc biểu mẫu' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { records, forms };
}

@Controller('reports/emis/start-of-year')
export class EmisSendingController {
  constructor(private readonly sending: EmisSending) {}

  @Get('sending')
  @RequirePermission(PERMISSION)
  overview(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.sending.overview(currentUser);
  }

  @Post('send')
  @HttpCode(200)
  @RequirePermission(PERMISSION)
  async send(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    sendWorkbook(response, await this.sending.send(currentUser, readSelection(body), request.ip ?? null));
  }

  @Post('error-file')
  @HttpCode(200)
  @RequirePermission(PERMISSION)
  async errorFile(
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    sendWorkbook(response, await this.sending.errorFile(currentUser, readSelection(body), request.ip ?? null));
  }

  @Post('resend')
  @HttpCode(200)
  @RequirePermission(PERMISSION)
  resend(@Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const note = typeof body?.note === 'string' && body.note.trim() !== '' ? body.note.trim().slice(0, 500) : null;
    return this.sending.resend(currentUser, readSelection(body), note);
  }
}
