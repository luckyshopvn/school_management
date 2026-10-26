import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { validationError, type FieldError } from '@school-management/server';
import {
  EXAM_ATTEMPT_POLICY_LABELS,
  EXAM_CAMERA_FALLBACK_LABELS,
  EXAM_MODES,
  EXAM_RESULT_MODES,
  EXAM_SINGLE_SESSION_LABELS,
  EXAM_VARIANT_MODE_LABELS,
  EXAM_VIOLATION_ACTION_LABELS,
  PERMISSION_CODES,
  isSchoolLevelCode,
  type ExamAttemptPolicy,
  type ExamCameraFallback,
  type ExamMode,
  type ExamSingleSessionMode,
  type ExamVariantMode,
  type ExamViolationAction,
  type SchoolLevelCode,
} from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, readInteger, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import {
  ONLINE_EXAM_LEVELS,
  OnlineExamsService,
  type AssignmentChanges,
  type AssignmentInput,
} from './online-exams.js';

// Điểm cuối phía giáo viên của thi trực tuyến (DT-23 phần 23a, YCTD-211); quyền giao đề, theo dõi, chấm: P02.exam.assign
const ASSIGN = PERMISSION_CODES.examAssign;
const idPipe = () => uuidParameter('Mã không hợp lệ');

function readLevel(value: string | undefined): SchoolLevelCode {
  if (!isSchoolLevelCode(value) || !ONLINE_EXAM_LEVELS.includes(value)) {
    throw validationError([{ field: 'school_level', message: 'Cấp học là TH, THCS hoặc THPT' }]);
  }
  return value;
}

function readChoice<Value extends string>(
  body: RequestBody,
  field: string,
  values: readonly Value[],
  fallback: Value,
  errors: FieldError[],
): Value {
  const value = body?.[field] ?? fallback;
  if (!values.includes(value as Value)) {
    errors.push({ field, message: `Chọn một trong: ${values.join(', ')}` });
    return fallback;
  }
  return value as Value;
}

function readBoolean(body: RequestBody, field: string, fallback: boolean, errors: FieldError[]): boolean {
  const value = body?.[field] ?? fallback;
  if (typeof value !== 'boolean') {
    errors.push({ field, message: 'Phải là đúng hoặc sai' });
    return fallback;
  }
  return value;
}

function readInstant(body: RequestBody, field: string, errors: FieldError[]): Date {
  const value = body?.[field];
  const parsed = typeof value === 'string' ? new Date(value) : new Date(Number.NaN);
  if (Number.isNaN(parsed.getTime())) {
    errors.push({ field, message: 'Thời điểm không hợp lệ' });
    return new Date(0);
  }
  return parsed;
}

function readIdList(body: RequestBody, field: string, errors: FieldError[]): string[] {
  const value = body?.[field] ?? [];
  if (!Array.isArray(value) || value.length > 500 || !value.every(isUuid)) {
    errors.push({ field, message: 'Danh sách mã không hợp lệ (tối đa 500)' });
    return [];
  }
  return [...new Set(value as string[])];
}

export function parseAssignmentInput(body: RequestBody): AssignmentInput {
  const errors: FieldError[] = [];
  const examId = readRequiredUuid(body, 'exam_id', errors, 'Chọn đề');
  const title = typeof body?.title === 'string' && body.title.trim() !== '' ? body.title.trim() : null;
  if (title !== null && title.length > 300) {
    errors.push({ field: 'title', message: 'Tên bài thi tối đa 300 ký tự' });
  }
  const opensAt = readInstant(body, 'opens_at', errors);
  const closesAt = readInstant(body, 'closes_at', errors);
  const duration = readInteger(body, 'duration_minutes', errors, { min: 5, max: 300 });
  if (duration === undefined && body?.duration_minutes === undefined) {
    errors.push({ field: 'duration_minutes', message: 'Bắt buộc nhập thời lượng' });
  }
  const maxAttempts = readInteger(body, 'max_attempts', errors, { min: 1, max: 5 }) ?? 1;
  const maxViolations = readInteger(body, 'max_violations', errors, { min: 0, max: 20 }) ?? 3;
  const scoreSeq = readInteger(body, 'score_seq', errors, { min: 1, max: 10 }) ?? 1;
  const variantMode = readChoice<ExamVariantMode>(
    body,
    'variant_mode',
    Object.keys(EXAM_VARIANT_MODE_LABELS) as ExamVariantMode[],
    'random',
    errors,
  );
  const fixed = body?.fixed_variant_code;
  if (variantMode === 'fixed' && (typeof fixed !== 'string' || fixed.trim() === '')) {
    errors.push({ field: 'fixed_variant_code', message: 'Chọn mã đề cố định' });
  }
  const classIds = readIdList(body, 'class_ids', errors);
  const childIds = readIdList(body, 'child_ids', errors);
  if (classIds.length + childIds.length === 0) {
    errors.push({ field: 'targets', message: 'Chọn ít nhất một lớp hoặc một học sinh' });
  }
  const input: AssignmentInput = {
    exam_id: examId,
    title,
    opens_at: opensAt,
    closes_at: closesAt,
    duration_minutes: duration ?? 45,
    max_attempts: maxAttempts,
    attempt_policy: readChoice<ExamAttemptPolicy>(
      body,
      'attempt_policy',
      Object.keys(EXAM_ATTEMPT_POLICY_LABELS) as ExamAttemptPolicy[],
      'best',
      errors,
    ),
    shuffle_questions: readBoolean(body, 'shuffle_questions', true, errors),
    shuffle_options: readBoolean(body, 'shuffle_options', true, errors),
    variant_mode: variantMode,
    fixed_variant_code: typeof fixed === 'string' && fixed.trim() !== '' ? fixed.trim() : null,
    result_mode: readChoice(body, 'result_mode', EXAM_RESULT_MODES, 'after_close', errors),
    fullscreen_required: readBoolean(body, 'fullscreen_required', true, errors),
    max_violations: maxViolations,
    violation_action: readChoice<ExamViolationAction>(
      body,
      'violation_action',
      Object.keys(EXAM_VIOLATION_ACTION_LABELS) as ExamViolationAction[],
      'flag',
      errors,
    ),
    camera_enabled: readBoolean(body, 'camera_enabled', true, errors),
    camera_fallback: readChoice<ExamCameraFallback>(
      body,
      'camera_fallback',
      Object.keys(EXAM_CAMERA_FALLBACK_LABELS) as ExamCameraFallback[],
      'flag',
      errors,
    ),
    single_session_mode: readChoice<ExamSingleSessionMode>(
      body,
      'single_session_mode',
      Object.keys(EXAM_SINGLE_SESSION_LABELS) as ExamSingleSessionMode[],
      'reject_new',
      errors,
    ),
    exam_mode:
      body?.exam_mode === undefined || body.exam_mode === null
        ? null
        : readChoice<ExamMode>(body, 'exam_mode', EXAM_MODES, 'at-school', errors),
    term_type: readChoice(body, 'term_type', ['first_term', 'second_term'] as const, 'first_term', errors),
    score_kind: readChoice(body, 'score_kind', ['regular', 'mid', 'final'] as const, 'regular', errors),
    score_seq: scoreSeq,
    true_false_rule: readChoice(body, 'true_false_rule', ['tiered', 'proportional'] as const, 'tiered', errors),
    absent_policy: readChoice(body, 'absent_policy', ['skip', 'zero'] as const, 'skip', errors),
    class_ids: classIds,
    child_ids: childIds,
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

export function parseAssignmentChanges(body: RequestBody): AssignmentChanges {
  const errors: FieldError[] = [];
  const changes: AssignmentChanges = {};
  if (body?.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '' || body.title.length > 300) {
      errors.push({ field: 'title', message: 'Tên bài thi từ 1 đến 300 ký tự' });
    } else {
      changes.title = body.title.trim();
    }
  }
  if (body?.opens_at !== undefined) {
    changes.opens_at = readInstant(body, 'opens_at', errors);
  }
  if (body?.closes_at !== undefined) {
    changes.closes_at = readInstant(body, 'closes_at', errors);
  }
  if (body?.result_mode !== undefined) {
    changes.result_mode = readChoice(body, 'result_mode', EXAM_RESULT_MODES, 'after_close', errors);
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  if (Object.keys(changes).length === 0) {
    throw validationError([{ field: 'body', message: 'Không có thay đổi nào' }]);
  }
  return changes;
}

@Controller('online-exams')
export class OnlineExamsController {
  constructor(private readonly service: OnlineExamsService) {}

  // Công tắc cho học sinh đăng nhập theo cấp; xem và đặt đều ở cấu hình thi trực tuyến
  @Get('settings')
  @RequirePermission(ASSIGN)
  settings() {
    return this.service.settings();
  }

  @Put('settings/:level')
  @RequirePermission(ASSIGN)
  updateSetting(
    @Param('level') level: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const enabled = body?.student_login_enabled;
    if (typeof enabled !== 'boolean') {
      throw validationError([{ field: 'student_login_enabled', message: 'Phải là đúng hoặc sai' }]);
    }
    return this.service.updateSetting(currentUser, readLevel(level), enabled, originOf(request, currentUser));
  }

  // Cấu hình thi trực tuyến của cả trường: chế độ thi mặc định, cho phép thi từ xa, dải mạng, hạn mã phòng
  @Get('school-settings')
  @RequirePermission(ASSIGN)
  schoolSettings() {
    return this.service.schoolSettings();
  }

  @Put('school-settings')
  @RequirePermission(ASSIGN)
  updateSchoolSettings(
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const mode = readChoice<ExamMode>(body, 'default_exam_mode', EXAM_MODES, 'at-school', errors);
    const allowRemote = readBoolean(body, 'allow_remote', false, errors);
    const minutes = readInteger(body, 'room_code_minutes', errors, { min: 5, max: 720 }) ?? 60;
    const rawNetworks = body?.allowed_networks ?? [];
    let networks: string[] = [];
    if (
      !Array.isArray(rawNetworks) ||
      rawNetworks.length > 100 ||
      rawNetworks.some((item) => typeof item !== 'string')
    ) {
      errors.push({ field: 'allowed_networks', message: 'Danh sách dải mạng tối đa 100 dòng' });
    } else {
      networks = [...new Set((rawNetworks as string[]).map((item) => item.trim()).filter((item) => item !== ''))];
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.updateSchoolSettings(
      currentUser,
      { default_exam_mode: mode, allow_remote: allowRemote, allowed_networks: networks, room_code_minutes: minutes },
      originOf(request, currentUser),
    );
  }

  @Post('assignments/:id/rooms')
  @RequirePermission(ASSIGN)
  openRoom(
    @Param('id', idPipe()) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const childIds = body?.child_ids === undefined ? null : readIdList(body, 'child_ids', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.openRoom(currentUser, id, childIds, originOf(request, currentUser));
  }

  @Post('rooms/:id/close')
  @HttpCode(200)
  @RequirePermission(ASSIGN)
  closeRoom(@Param('id', idPipe()) id: string, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.closeRoom(currentUser, id, originOf(request, currentUser));
  }

  @Get('exams')
  @RequirePermission(ASSIGN)
  exams(@Query('school_level') level: string | undefined) {
    return this.service.lockedExams(readLevel(level));
  }

  @Get('classes')
  @RequirePermission(ASSIGN)
  classes(@Query('exam_id') examId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(examId)) {
      throw validationError([{ field: 'exam_id', message: 'Chọn đề' }]);
    }
    return this.service.classesFor(currentUser, examId);
  }

  @Post('assignments')
  @RequirePermission(ASSIGN)
  createAssignment(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.createAssignment(currentUser, parseAssignmentInput(body), originOf(request, currentUser));
  }

  @Get('assignments')
  @RequirePermission(ASSIGN)
  list(@Query('school_level') level: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.list(currentUser, readLevel(level));
  }

  @Get('assignments/:id')
  @RequirePermission(ASSIGN)
  detail(@Param('id', idPipe()) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.detail(currentUser, id);
  }

  @Patch('assignments/:id')
  @RequirePermission(ASSIGN)
  update(
    @Param('id', idPipe()) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.update(currentUser, id, parseAssignmentChanges(body), originOf(request, currentUser));
  }

  @Post('assignments/:id/cancel')
  @HttpCode(200)
  @RequirePermission(ASSIGN)
  cancel(@Param('id', idPipe()) id: string, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.cancel(currentUser, id, originOf(request, currentUser));
  }

  @Post('assignments/:id/release-results')
  @HttpCode(200)
  @RequirePermission(ASSIGN)
  release(@Param('id', idPipe()) id: string, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.releaseResults(currentUser, id, originOf(request, currentUser));
  }

  @Get('attempts/:id')
  @RequirePermission(ASSIGN)
  attempt(@Param('id', idPipe()) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.service.attemptDetail(currentUser, id);
  }

  @Put('attempts/:id/essay-marks')
  @RequirePermission(ASSIGN)
  markEssay(
    @Param('id', idPipe()) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const raw = body?.marks;
    const marks: Record<string, number> = {};
    const errors: FieldError[] = [];
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw) || Object.keys(raw).length === 0) {
      errors.push({ field: 'marks', message: 'Điểm tự luận ghi theo từng câu' });
    } else {
      for (const [questionId, mark] of Object.entries(raw as Record<string, unknown>)) {
        if (!isUuid(questionId) || typeof mark !== 'number' || !Number.isFinite(mark)) {
          errors.push({ field: `marks.${questionId}`, message: 'Điểm phải là số' });
          continue;
        }
        marks[questionId] = mark;
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.markEssay(currentUser, id, marks, originOf(request, currentUser));
  }

  @Post('attempts/:id/force-submit')
  @HttpCode(200)
  @RequirePermission(ASSIGN)
  forceSubmit(
    @Param('id', idPipe()) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.service.forceSubmit(currentUser, id, originOf(request, currentUser));
  }
}
