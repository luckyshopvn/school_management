import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { UpperLevelSubmissionAction, UpperLevelSubmissionStatus } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import type { Request, Response } from 'express';
import type { Transaction } from 'kysely';
import type { SystemDatabase } from '@school-management/database';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { notFoundError, readOptionalText, type RequestBody } from '../common/request-fields.js';
import { sendWorkbook, type ExportedFile } from '../facilities/facilities-workbook.js';
import { FileStorage } from '../files/file-storage.js';

// Mẫu "gửi lên cấp trên" chạy nội bộ (DT-16 phần 16a, khảo sát mục 2.3 của Sở; quyết định của Eric ngày 2026-10-16: tính
// năng cần hệ thống ngoài làm bản chạy nội bộ, nút ghi đúng việc làm, không giả vờ truyền đi). Mỗi biểu mẫu theo năm học có:
// - Hoàn thành dữ liệu: danh sách điều kiện do màn hình của biểu mẫu tính tại thời điểm xem;
// - Xuất tệp gửi: dựng tệp theo mẫu nộp và lưu bản chụp số liệu tại thời điểm xuất; nộp tệp bằng tay cho cấp trên;
// - Đánh dấu đã gửi: ngày gửi, người đánh dấu; biểu mẫu khóa, không xuất lại;
// - Gửi yêu cầu mở khóa: ghi yêu cầu nội bộ kèm lý do; người có quyền mở khóa đồng ý (chuyển "Cần gửi lại") hoặc từ chối;
// - Đặt trạng thái gửi lại: người có quyền mở khóa chuyển biểu mẫu đã gửi sang "Cần gửi lại".
// Chưa có giao diện lập trình của Bộ, Sở nên UpperLevelGateway chỉ có bản thủ công; khi có kết nối thật thì thay bản này.
// Các phần 16i, 16j đăng ký biểu mẫu của mình bằng UpperLevelForms.register (hướng dẫn ở tài liệu 17)
export const SUBMISSION_RULE_CODE = 'YCTD-121';
const MAXIMUM_NOTE = 500;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

export interface CompletenessItem {
  label: string;
  done: boolean;
}

export interface UpperLevelForm {
  code: string;
  name: string;
  // Quyền xem, xuất tệp gửi, đánh dấu đã gửi, gửi yêu cầu mở khóa
  permission: string;
  // Quyền mở khóa, đặt trạng thái gửi lại
  unlockPermission: string;
  // Biểu mẫu cho đánh dấu "Trường không có dữ liệu" (gửi không kèm tệp)
  allowNoData?: boolean;
  completeness(currentUser: CurrentUser): Promise<CompletenessItem[]>;
  // Dựng tệp gửi (ghi nhật ký xuất như Xuất Excel) và số liệu chụp lại tại thời điểm xuất
  snapshot(currentUser: CurrentUser, ipAddress: string | null): Promise<{ file: ExportedFile; data: unknown }>;
}

// Chỗ nối với hệ thống của Bộ, Sở. Bản thủ công không truyền gì: người dùng nộp tệp rồi đánh dấu đã gửi
export abstract class UpperLevelGateway {
  abstract readonly automatic: boolean;
  abstract readonly description: string;
}

export class ManualUpperLevelGateway extends UpperLevelGateway {
  readonly automatic = false;
  readonly description = 'Chưa có kết nối với hệ thống của Bộ, Sở: xuất tệp gửi, nộp bằng tay rồi đánh dấu đã gửi';
}

@Injectable()
export class UpperLevelForms {
  private readonly forms = new Map<string, UpperLevelForm>();

  register(form: UpperLevelForm): void {
    this.forms.set(form.code, form);
  }

  find(code: string): UpperLevelForm | undefined {
    return this.forms.get(code);
  }
}

export interface SubmissionView {
  form_code: string;
  form_name: string;
  completeness: CompletenessItem[];
  data_complete: boolean;
  status: UpperLevelSubmissionStatus;
  no_data: boolean;
  allow_no_data: boolean;
  exported_at: Date | null;
  exported_by_name: string | null;
  exported_data_complete: boolean | null;
  file_name: string | null;
  sent_on: string | null;
  sent_by_name: string | null;
  sent_note: string | null;
  unlock_reason: string | null;
  unlock_requested_by_name: string | null;
  unlock_requested_at: Date | null;
  can_manage: boolean;
  can_unlock: boolean;
  automatic_gateway: boolean;
}

type SubmissionRow = Awaited<ReturnType<UpperLevelSubmissions['row']>>;

@Injectable()
export class UpperLevelSubmissions {
  constructor(
    private readonly forms: UpperLevelForms,
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly fileStorage: FileStorage,
    private readonly gateway: UpperLevelGateway,
    private readonly clock: Clock,
  ) {}

  private form(currentUser: CurrentUser, code: string): UpperLevelForm {
    const form = this.forms.find(code);
    if (!form) {
      throw notFoundError('Không có biểu mẫu gửi lên cấp trên này', 'upper_level_form');
    }
    if (!currentUser.hasPermission(form.permission) && !currentUser.hasPermission(form.unlockPermission)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền với biểu mẫu này');
    }
    return form;
  }

  private assertCanManage(currentUser: CurrentUser, form: UpperLevelForm): void {
    if (!currentUser.hasPermission(form.permission)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xuất, gửi biểu mẫu này');
    }
  }

  private assertCanUnlock(currentUser: CurrentUser, form: UpperLevelForm): void {
    if (!currentUser.hasPermission(form.unlockPermission)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền mở khóa biểu mẫu này');
    }
  }

  private async row(academicYearId: string, formCode: string) {
    return this.databases.system
      .selectFrom('upper_level_submissions')
      .selectAll()
      .where('academic_year_id', '=', academicYearId)
      .where('form_code', '=', formCode)
      .executeTakeFirst();
  }

  // Bản ghi của biểu mẫu trong năm học; chưa có thì tạo ở trạng thái Chưa gửi
  private async ensureRow(academicYearId: string, formCode: string): Promise<NonNullable<SubmissionRow>> {
    await this.databases.system
      .insertInto('upper_level_submissions')
      .values({ academic_year_id: academicYearId, form_code: formCode })
      .onConflict((conflict) => conflict.columns(['academic_year_id', 'form_code']).doNothing())
      .execute();
    const row = await this.row(academicYearId, formCode);
    if (!row) {
      throw new Error('Không tạo được bản ghi gửi biểu mẫu');
    }
    return row;
  }

  private async view(currentUser: CurrentUser, form: UpperLevelForm, row: SubmissionRow): Promise<SubmissionView> {
    const completeness = await form.completeness(currentUser);
    return {
      form_code: form.code,
      form_name: form.name,
      completeness,
      data_complete: completeness.every((item) => item.done),
      status: row?.status ?? 'draft',
      no_data: row?.no_data ?? false,
      allow_no_data: form.allowNoData === true,
      exported_at: row?.exported_at ?? null,
      exported_by_name: row?.exported_by_name ?? null,
      exported_data_complete: row?.data_complete ?? null,
      file_name: row?.file_name ?? null,
      sent_on: row?.sent_on ?? null,
      sent_by_name: row?.sent_by_name ?? null,
      sent_note: row?.sent_note ?? null,
      unlock_reason: row?.unlock_reason ?? null,
      unlock_requested_by_name: row?.unlock_requested_by_name ?? null,
      unlock_requested_at: row?.unlock_requested_at ?? null,
      can_manage: currentUser.hasPermission(form.permission),
      can_unlock: currentUser.hasPermission(form.unlockPermission),
      automatic_gateway: this.gateway.automatic,
    };
  }

  // Danh sách biểu mẫu kèm Hoàn thành dữ liệu, Trạng thái, Ngày gửi của năm học đang dùng
  async list(currentUser: CurrentUser, formCodes: string[]): Promise<SubmissionView[]> {
    const { academicYearId } = await this.currentSchoolYear.require();
    const result: SubmissionView[] = [];
    for (const code of formCodes) {
      const form = this.form(currentUser, code);
      result.push(await this.view(currentUser, form, await this.row(academicYearId, code)));
    }
    return result;
  }

  // Xuất tệp gửi: lưu tệp và bản chụp số liệu; biểu mẫu đã gửi thì phải mở khóa trước
  async export(currentUser: CurrentUser, formCode: string, ipAddress: string | null): Promise<SubmissionView> {
    const form = this.form(currentUser, formCode);
    this.assertCanManage(currentUser, form);
    const { academicYearId } = await this.currentSchoolYear.require();
    const row = await this.ensureRow(academicYearId, formCode);
    this.assertEditable(row.status);
    const completeness = await form.completeness(currentUser);
    const { file, data } = await form.snapshot(currentUser, ipAddress);
    const storageKey = `submission/${row.id}/${randomUUID()}`;
    const contentType = file.contentType ?? 'application/octet-stream';
    await this.fileStorage.put(storageKey, file.buffer, contentType);
    await this.databases.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('upper_level_submissions')
        .set({
          snapshot: JSON.stringify(data),
          data_complete: completeness.every((item) => item.done),
          file_name: file.fileName,
          content_type: contentType,
          size_bytes: file.buffer.length,
          storage_key: storageKey,
          exported_at: this.clock.now(),
          exported_by: currentUser.id,
          exported_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
          updated_by: currentUser.id,
        })
        .where('id', '=', row.id)
        .execute();
      await this.event(transaction, row.id, 'export', file.fileName, currentUser);
    });
    if (row.storage_key) {
      await this.fileStorage.delete(row.storage_key);
    }
    return this.view(currentUser, form, await this.row(academicYearId, formCode));
  }

  async file(currentUser: CurrentUser, formCode: string): Promise<ExportedFile> {
    this.form(currentUser, formCode);
    const { academicYearId } = await this.currentSchoolYear.require();
    const row = await this.row(academicYearId, formCode);
    if (!row?.storage_key || !row.file_name) {
      throw ruleViolationError(SUBMISSION_RULE_CODE, 'Biểu mẫu chưa có tệp gửi; bấm "Xuất tệp gửi" trước');
    }
    return {
      buffer: await this.fileStorage.get(row.storage_key),
      fileName: row.file_name,
      logId: row.id,
      contentType: row.content_type ?? undefined,
    };
  }

  // Đánh dấu đã gửi: cần tệp gửi lập khi dữ liệu đã hoàn thành, trừ khi đánh dấu trường không có dữ liệu
  async markSent(
    currentUser: CurrentUser,
    formCode: string,
    input: { sentOn: string; note: string | null; noData: boolean },
  ): Promise<SubmissionView> {
    const form = this.form(currentUser, formCode);
    this.assertCanManage(currentUser, form);
    const { academicYearId } = await this.currentSchoolYear.require();
    const row = await this.ensureRow(academicYearId, formCode);
    this.assertEditable(row.status);
    if (input.noData && !form.allowNoData) {
      throw ruleViolationError(SUBMISSION_RULE_CODE, 'Biểu mẫu này không có lựa chọn "Trường không có dữ liệu"');
    }
    if (!input.noData) {
      if (!row.storage_key) {
        throw ruleViolationError(
          SUBMISSION_RULE_CODE,
          'Chưa có tệp gửi; bấm "Xuất tệp gửi" rồi nộp tệp trước khi đánh dấu',
        );
      }
      if (row.data_complete !== true) {
        throw ruleViolationError(
          SUBMISSION_RULE_CODE,
          'Tệp gửi gần nhất lập khi dữ liệu chưa hoàn thành; bổ sung dữ liệu rồi xuất tệp gửi lại',
        );
      }
    }
    if (input.sentOn > VIETNAM_DATE.format(this.clock.now())) {
      throw validationError([{ field: 'sent_on', message: 'Ngày gửi không được sau ngày hiện tại' }]);
    }
    await this.databases.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('upper_level_submissions')
        .set({
          status: 'sent',
          no_data: input.noData,
          sent_on: input.sentOn,
          sent_note: input.note,
          sent_by: currentUser.id,
          sent_by_name: currentUser.description.full_name,
          marked_sent_at: this.clock.now(),
          unlock_reason: null,
          unlock_requested_by: null,
          unlock_requested_by_name: null,
          unlock_requested_at: null,
          updated_at: this.clock.now(),
          updated_by: currentUser.id,
        })
        .where('id', '=', row.id)
        .execute();
      await this.event(
        transaction,
        row.id,
        'mark_sent',
        [`Ngày gửi ${input.sentOn}`, input.noData ? 'trường không có dữ liệu' : null, input.note]
          .filter(Boolean)
          .join('; '),
        currentUser,
      );
    });
    return this.view(currentUser, form, await this.row(academicYearId, formCode));
  }

  async requestUnlock(currentUser: CurrentUser, formCode: string, reason: string): Promise<SubmissionView> {
    const form = this.form(currentUser, formCode);
    this.assertCanManage(currentUser, form);
    const { academicYearId } = await this.currentSchoolYear.require();
    const row = await this.ensureRow(academicYearId, formCode);
    if (row.status !== 'sent') {
      throw ruleViolationError(SUBMISSION_RULE_CODE, 'Chỉ gửi yêu cầu mở khóa cho biểu mẫu đã gửi');
    }
    await this.databases.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('upper_level_submissions')
        .set({
          status: 'unlock_requested',
          unlock_reason: reason,
          unlock_requested_by: currentUser.id,
          unlock_requested_by_name: currentUser.description.full_name,
          unlock_requested_at: this.clock.now(),
          updated_at: this.clock.now(),
          updated_by: currentUser.id,
        })
        .where('id', '=', row.id)
        .execute();
      await this.event(transaction, row.id, 'unlock_request', reason, currentUser);
    });
    return this.view(currentUser, form, await this.row(academicYearId, formCode));
  }

  // Người có quyền mở khóa đồng ý (biểu mẫu chuyển Cần gửi lại) hoặc từ chối (giữ Đã gửi)
  async decideUnlock(
    currentUser: CurrentUser,
    formCode: string,
    approve: boolean,
    note: string | null,
  ): Promise<SubmissionView> {
    const form = this.form(currentUser, formCode);
    this.assertCanUnlock(currentUser, form);
    const { academicYearId } = await this.currentSchoolYear.require();
    const row = await this.ensureRow(academicYearId, formCode);
    if (row.status !== 'unlock_requested') {
      throw ruleViolationError(SUBMISSION_RULE_CODE, 'Biểu mẫu không có yêu cầu mở khóa đang chờ');
    }
    await this.setStatus(row.id, approve ? 'resend' : 'sent', approve ? 'unlock' : 'unlock_reject', note, currentUser);
    return this.view(currentUser, form, await this.row(academicYearId, formCode));
  }

  // Đặt trạng thái gửi lại: biểu mẫu đã gửi (hoặc đang chờ mở khóa) chuyển Cần gửi lại
  async setResend(currentUser: CurrentUser, formCode: string, note: string | null): Promise<SubmissionView> {
    const form = this.form(currentUser, formCode);
    this.assertCanUnlock(currentUser, form);
    const { academicYearId } = await this.currentSchoolYear.require();
    const row = await this.ensureRow(academicYearId, formCode);
    if (row.status !== 'sent' && row.status !== 'unlock_requested') {
      throw ruleViolationError(SUBMISSION_RULE_CODE, 'Chỉ đặt trạng thái gửi lại cho biểu mẫu đã gửi');
    }
    await this.setStatus(row.id, 'resend', 'resend', note, currentUser);
    return this.view(currentUser, form, await this.row(academicYearId, formCode));
  }

  async events(currentUser: CurrentUser, formCode: string) {
    this.form(currentUser, formCode);
    const { academicYearId } = await this.currentSchoolYear.require();
    const row = await this.row(academicYearId, formCode);
    if (!row) {
      return [];
    }
    return this.databases.system
      .selectFrom('upper_level_submission_events')
      .select(['id', 'action', 'note', 'actor_name', 'created_at'])
      .where('submission_id', '=', row.id)
      .orderBy('created_at', 'desc')
      .execute();
  }

  private assertEditable(status: UpperLevelSubmissionStatus): void {
    if (status === 'sent' || status === 'unlock_requested') {
      throw ruleViolationError(
        SUBMISSION_RULE_CODE,
        'Biểu mẫu đã gửi đang khóa; gửi yêu cầu mở khóa và chờ người có quyền mở khóa trước khi làm lại',
      );
    }
  }

  private async setStatus(
    id: string,
    status: UpperLevelSubmissionStatus,
    action: UpperLevelSubmissionAction,
    note: string | null,
    currentUser: CurrentUser,
  ): Promise<void> {
    await this.databases.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('upper_level_submissions')
        .set({
          status,
          ...(status === 'resend'
            ? {
                unlock_reason: null,
                unlock_requested_by: null,
                unlock_requested_by_name: null,
                unlock_requested_at: null,
              }
            : {}),
          updated_at: this.clock.now(),
          updated_by: currentUser.id,
        })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, action, note, currentUser);
    });
  }

  private async event(
    transaction: Transaction<SystemDatabase>,
    submissionId: string,
    action: UpperLevelSubmissionAction,
    note: string | null,
    currentUser: CurrentUser,
  ): Promise<void> {
    await transaction
      .insertInto('upper_level_submission_events')
      .values({
        submission_id: submissionId,
        action,
        note,
        actor_id: currentUser.id,
        actor_name: currentUser.description.full_name,
      })
      .execute();
  }
}

function readNote(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | null {
  const value = readOptionalText(body, field, errors)?.trim() || null;
  if (required && !value) {
    errors.push({ field, message: 'Bắt buộc nhập' });
  }
  if (value && value.length > MAXIMUM_NOTE) {
    errors.push({ field, message: `Tối đa ${MAXIMUM_NOTE} ký tự` });
  }
  return value;
}

// Quyền kiểm tra theo từng biểu mẫu trong dịch vụ (quyền của biểu mẫu, quyền mở khóa)
@Controller('upper-level-submissions')
export class UpperLevelSubmissionsController {
  constructor(private readonly submissions: UpperLevelSubmissions) {}

  @Get()
  async list(@Query('forms') forms: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    const codes = [
      ...new Set(
        (forms ?? '')
          .split(',')
          .map((code) => code.trim())
          .filter(Boolean),
      ),
    ];
    if (codes.length === 0) {
      throw validationError([{ field: 'forms', message: 'Chọn ít nhất một biểu mẫu' }]);
    }
    return { items: await this.submissions.list(currentUser, codes) };
  }

  @Post(':form/export')
  @HttpCode(200)
  export(@Param('form') form: string, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.submissions.export(currentUser, form, request.ip ?? null);
  }

  @Get(':form/file')
  async file(@Param('form') form: string, @Res() response: Response, @AuthenticatedUser() currentUser: CurrentUser) {
    sendWorkbook(response, await this.submissions.file(currentUser, form));
  }

  @Post(':form/mark-sent')
  @HttpCode(200)
  markSent(@Param('form') form: string, @Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const sentOn = body?.sent_on;
    if (typeof sentOn !== 'string' || !DATE_PATTERN.test(sentOn) || Number.isNaN(Date.parse(sentOn))) {
      errors.push({ field: 'sent_on', message: 'Ngày gửi dạng YYYY-MM-DD' });
    }
    const noData = body?.no_data ?? false;
    if (typeof noData !== 'boolean') {
      errors.push({ field: 'no_data', message: 'Chọn có hoặc không' });
    }
    const note = readNote(body, 'note', errors, false);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.submissions.markSent(currentUser, form, { sentOn: sentOn as string, note, noData: noData === true });
  }

  @Post(':form/unlock-request')
  @HttpCode(200)
  requestUnlock(@Param('form') form: string, @Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const reason = readNote(body, 'reason', errors, true);
    if (errors.length > 0 || !reason) {
      throw validationError(errors);
    }
    return this.submissions.requestUnlock(currentUser, form, reason);
  }

  @Post(':form/unlock')
  @HttpCode(200)
  decideUnlock(@Param('form') form: string, @Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (typeof body?.approve !== 'boolean') {
      errors.push({ field: 'approve', message: 'Chọn đồng ý hoặc từ chối' });
    }
    const note = readNote(body, 'note', errors, false);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.submissions.decideUnlock(currentUser, form, body?.approve === true, note);
  }

  @Post(':form/resend')
  @HttpCode(200)
  setResend(@Param('form') form: string, @Body() body: RequestBody, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const note = readNote(body, 'note', errors, false);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.submissions.setResend(currentUser, form, note);
  }

  @Get(':form/events')
  async events(@Param('form') form: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return { items: await this.submissions.events(currentUser, form) };
  }
}
