import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { validationError, type FieldError } from '@school-management/server';
import { isSchoolLevelCode, PERMISSION_CODES, type SchoolLevelCode } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf } from '../common/audit-log.js';
import { isUuid, readInteger, readRequiredText, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readTableFileFormat } from '../exports/table-file.js';
import { MAXIMUM_IMPORT_BYTES } from '../imports/excel.js';
import { ExamGradingService, type SessionInput, type SheetBody } from './exam-grading.js';

// Điểm cuối chấm bài kiểm tra, báo cáo kết quả (DT-21 phần 22g2, YCTD-173)
const GRADE = PERMISSION_CODES.examGrade;
const REVIEW = PERMISSION_CODES.examReview;
const MANAGE = PERMISSION_CODES.examManage;

interface UploadedPart {
  size: number;
  buffer: Buffer;
}

function readLevel(value: string | undefined): SchoolLevelCode {
  if (!isSchoolLevelCode(value) || (value !== 'THCS' && value !== 'THPT')) {
    throw validationError([{ field: 'school_level', message: 'Cấp học là THCS hoặc THPT' }]);
  }
  return value;
}

function readChoice<Value extends string>(
  body: RequestBody,
  field: string,
  values: readonly Value[],
  fallback: Value | undefined,
  errors: FieldError[],
): Value {
  const value = body?.[field] ?? fallback;
  if (!values.includes(value as Value)) {
    errors.push({ field, message: `Chọn một trong: ${values.join(', ')}` });
    return values[0] as Value;
  }
  return value as Value;
}

export function parseSessionInput(body: RequestBody): SessionInput {
  const errors: FieldError[] = [];
  const examId = readRequiredUuid(body, 'exam_id', errors, 'Chọn đề');
  const classId = readRequiredUuid(body, 'class_id', errors, 'Chọn lớp');
  const termType = readChoice(body, 'term_type', ['first_term', 'second_term'] as const, undefined, errors);
  const scoreKind = readChoice(body, 'score_kind', ['regular', 'mid', 'final'] as const, undefined, errors);
  const scoreSeq = readInteger(body, 'score_seq', errors, { min: 1, max: 10 }) ?? 1;
  const rule = readChoice(body, 'true_false_rule', ['tiered', 'proportional'] as const, 'tiered', errors);
  const absentPolicy = readChoice(body, 'absent_policy', ['skip', 'zero'] as const, 'skip', errors);
  const doubleMarking = body?.double_marking ?? false;
  if (typeof doubleMarking !== 'boolean') {
    errors.push({ field: 'double_marking', message: 'Phải là đúng hoặc sai' });
  }
  const tolerance = body?.mark_tolerance ?? 1;
  if (typeof tolerance !== 'number' || !Number.isFinite(tolerance) || tolerance < 0 || tolerance > 10) {
    errors.push({ field: 'mark_tolerance', message: 'Ngưỡng lệch từ 0 đến 10 điểm' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return {
    exam_id: examId,
    class_id: classId,
    term_type: termType,
    score_kind: scoreKind,
    score_seq: scoreSeq,
    true_false_rule: rule,
    double_marking: doubleMarking as boolean,
    mark_tolerance: tolerance as number,
    absent_policy: absentPolicy,
  };
}

const readMark = (value: unknown) => (value === null || value === undefined || value === '' ? null : value);

export function parseSheetBody(body: RequestBody): SheetBody {
  const errors: FieldError[] = [];
  const absent = body?.absent ?? false;
  if (typeof absent !== 'boolean') {
    errors.push({ field: 'absent', message: 'Phải là đúng hoặc sai' });
  }
  const variantCode = body?.variant_code ?? null;
  if (variantCode !== null && typeof variantCode !== 'string') {
    errors.push({ field: 'variant_code', message: 'Mã đề không hợp lệ' });
  }
  if (!absent && (typeof variantCode !== 'string' || variantCode.trim() === '')) {
    errors.push({ field: 'variant_code', message: 'Chọn mã đề của bài làm' });
  }
  const answers: SheetBody['answers'] = {};
  const rawAnswers = body?.answers ?? {};
  if (typeof rawAnswers !== 'object' || rawAnswers === null || Array.isArray(rawAnswers)) {
    errors.push({ field: 'answers', message: 'Câu trả lời ghi theo số câu' });
  } else {
    for (const [number, values] of Object.entries(rawAnswers as Record<string, unknown>)) {
      if (!/^\d{1,3}$/.test(number) || !Array.isArray(values) || values.some((value) => typeof value !== 'string')) {
        errors.push({ field: `answers.${number}`, message: 'Câu trả lời là danh sách lựa chọn' });
        continue;
      }
      answers[number] = (values as string[]).map((value) => value.trim().slice(0, 50)).filter(Boolean);
    }
  }
  const essay: SheetBody['essay'] = {};
  const rawEssay = body?.essay ?? {};
  if (typeof rawEssay !== 'object' || rawEssay === null || Array.isArray(rawEssay)) {
    errors.push({ field: 'essay', message: 'Điểm tự luận ghi theo câu' });
  } else {
    for (const [questionId, marks] of Object.entries(rawEssay as Record<string, unknown>)) {
      const first = readMark((marks as Record<string, unknown> | null)?.first);
      const second = readMark((marks as Record<string, unknown> | null)?.second);
      if (
        !isUuid(questionId) ||
        [first, second].some((mark) => mark !== null && (typeof mark !== 'number' || !Number.isFinite(mark)))
      ) {
        errors.push({ field: `essay.${questionId}`, message: 'Điểm tự luận phải là số' });
        continue;
      }
      essay[questionId] = { first: first as number | null, second: second as number | null };
    }
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return {
    variant_code: typeof variantCode === 'string' ? variantCode.trim() : null,
    absent: absent as boolean,
    answers: absent ? {} : answers,
    essay: absent ? {} : essay,
  };
}

@Controller('exam-grading')
@RequirePermission(GRADE, REVIEW, MANAGE)
export class ExamGradingController {
  constructor(private readonly grading: ExamGradingService) {}

  // Danh sách đề đã khoá: người chấm tạo bài kiểm tra, người thẩm định xem báo cáo
  @Get('exams')
  exams(@Query('school_level') level: string | undefined) {
    return this.grading.lockedExams(readLevel(level));
  }

  @Get('classes')
  @RequirePermission(GRADE, MANAGE)
  classes(@Query('exam_id') examId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(examId)) {
      throw validationError([{ field: 'exam_id', message: 'Chọn đề' }]);
    }
    return this.grading.classesFor(currentUser, examId);
  }

  @Get('sessions')
  sessions(@Query('school_level') level: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.grading.listSessions(currentUser, readLevel(level));
  }

  @Post('sessions')
  @RequirePermission(GRADE, MANAGE)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.grading.createSession(currentUser, parseSessionInput(body), originOf(request, currentUser));
  }

  @Get('sessions/:id')
  read(
    @Param('id', uuidParameter('Mã bài kiểm tra không hợp lệ')) sessionId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.grading.session(currentUser, sessionId);
  }

  @Put('sessions/:id/sheets/:childId')
  @RequirePermission(GRADE, MANAGE)
  saveSheet(
    @Param('id', uuidParameter('Mã bài kiểm tra không hợp lệ')) sessionId: string,
    @Param('childId', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.grading.saveSheet(
      currentUser,
      sessionId,
      childId,
      parseSheetBody(body),
      originOf(request, currentUser),
    );
  }

  @Get('sessions/:id/import-template')
  async template(
    @Param('id', uuidParameter('Mã bài kiểm tra không hợp lệ')) sessionId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const file = await this.grading.importTemplate(currentUser, sessionId);
    response
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attachment('mau-ket-qua-quet-phieu.xlsx')
      .send(file);
  }

  @Post('sessions/:id/import')
  @HttpCode(200)
  @RequirePermission(GRADE, MANAGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  import(
    @Param('id', uuidParameter('Mã bài kiểm tra không hợp lệ')) sessionId: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp' }]);
    }
    return this.grading.importSheets(currentUser, sessionId, file.buffer, originOf(request, currentUser));
  }

  @Get('sessions/:id/answer-sheet')
  async answerSheet(
    @Param('id', uuidParameter('Mã bài kiểm tra không hợp lệ')) sessionId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const file = await this.grading.answerSheet(currentUser, sessionId);
    response.type(file.contentType).attachment(file.fileName).send(file.buffer);
  }

  @Post('sessions/:id/lock')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  lock(
    @Param('id', uuidParameter('Mã bài kiểm tra không hợp lệ')) sessionId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.grading.lock(currentUser, sessionId, originOf(request, currentUser));
  }

  @Post('sessions/:id/unlock')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  unlock(
    @Param('id', uuidParameter('Mã bài kiểm tra không hợp lệ')) sessionId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readRequiredText(body, 'reason', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.grading.unlock(currentUser, sessionId, reason, originOf(request, currentUser));
  }

  // Quyền ghi sổ điểm do sổ điểm 21c kiểm tra (giáo viên được phân công môn của lớp hoặc người quản lý sổ điểm)
  @Post('sessions/:id/transfer')
  @HttpCode(200)
  @RequirePermission(GRADE, MANAGE)
  transfer(
    @Param('id', uuidParameter('Mã bài kiểm tra không hợp lệ')) sessionId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.grading.transfer(currentUser, sessionId, originOf(request, currentUser));
  }

  @Get('reports/:examId')
  report(
    @Param('examId', uuidParameter('Mã đề không hợp lệ')) examId: string,
    @Query('class_id') classId: string | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (classId !== undefined && classId !== '' && !isUuid(classId)) {
      throw validationError([{ field: 'class_id', message: 'Mã lớp không hợp lệ' }]);
    }
    return this.grading.report(currentUser, examId, classId || undefined);
  }

  @Get('reports/:examId/export')
  async exportReport(
    @Param('examId', uuidParameter('Mã đề không hợp lệ')) examId: string,
    @Query() query: Record<string, string | undefined>,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const format = readTableFileFormat(query.format);
    if (!format) {
      throw validationError([{ field: 'format', message: 'Định dạng là xlsx hoặc pdf' }]);
    }
    if (query.class_id && !isUuid(query.class_id)) {
      throw validationError([{ field: 'class_id', message: 'Mã lớp không hợp lệ' }]);
    }
    const file = await this.grading.exportReport(currentUser, examId, query.class_id || undefined, format);
    response.type(file.contentType).attachment(file.fileName).send(file.buffer);
  }
}
