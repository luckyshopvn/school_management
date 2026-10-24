import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
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
import {
  isUuid,
  readInteger,
  readOptionalUuid,
  readRequiredText,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { MAXIMUM_IMPORT_BYTES } from '../imports/excel.js';
import { parseExam, parseMatrix, parsePlan, parseQuestion, readDate, readDecision } from './exam-inputs.js';
import { ExamsService } from './exams.js';

// Điểm cuối kiểm tra, đánh giá phần đề (DT-21 phần 22g1, YCTD-168)
const AUTHOR = PERMISSION_CODES.questionAuthor;
const REVIEW = PERMISSION_CODES.examReview;
const MANAGE = PERMISSION_CODES.examManage;

function readLevelQuery(value: string | undefined): SchoolLevelCode {
  if (!isSchoolLevelCode(value) || value === 'MN') {
    throw validationError([{ field: 'school_level', message: 'Cấp học là TH, THCS hoặc THPT' }]);
  }
  return value;
}

function readUuidQuery(query: Record<string, string | undefined>, fields: string[]) {
  const errors: FieldError[] = [];
  for (const field of fields) {
    if (query[field] !== undefined && query[field] !== '' && !isUuid(query[field])) {
      errors.push({ field, message: 'Mã không hợp lệ' });
    }
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

function readSeed(body: RequestBody): number | undefined {
  const value = body?.seed;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

interface UploadedPart {
  size: number;
  buffer: Buffer;
}

@Controller('question-topics')
@RequirePermission(AUTHOR, REVIEW, MANAGE)
export class QuestionTopicsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>) {
    readUuidQuery(query, ['subject_id']);
    return this.exams.topics({ subjectId: query.subject_id || undefined, gradeLevelCode: query.grade_level_code });
  }

  @Post()
  @RequirePermission(REVIEW, MANAGE)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      subject_id: readRequiredUuid(body, 'subject_id', errors, 'Bắt buộc chọn môn'),
      grade_level_code:
        typeof body?.grade_level_code === 'string' && body.grade_level_code ? body.grade_level_code : null,
      name: readRequiredText(body, 'name', errors),
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 9999 }) ?? 0,
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.exams.createTopic(input, originOf(request, currentUser));
  }
}

@Controller('questions')
@RequirePermission(AUTHOR, REVIEW, MANAGE)
export class QuestionsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    readUuidQuery(query, ['subject_id', 'topic_id']);
    return this.exams.listQuestions(currentUser, {
      subjectId: query.subject_id || undefined,
      gradeLevelCode: query.grade_level_code || undefined,
      topicId: query.topic_id || undefined,
      cognitiveLevel: query.cognitive_level || undefined,
      questionType: query.question_type || undefined,
      status: query.status || undefined,
      search: query.search?.trim() || undefined,
    });
  }

  @Get('stats')
  stats(@Query() query: Record<string, string | undefined>) {
    readUuidQuery(query, ['subject_id']);
    if (!query.subject_id || !query.grade_level_code) {
      throw validationError([{ field: 'subject_id', message: 'Cần môn và khối' }]);
    }
    return this.exams.questionStats(query.subject_id, query.grade_level_code);
  }

  @Get('import-template')
  async template(@Query('school_level') level: string | undefined, @Res() response: Response) {
    const file = await this.exams.importTemplate(readLevelQuery(level));
    response
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attachment('mau-cau-hoi.xlsx')
      .send(file);
  }

  @Post('import')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  import(
    @Query('school_level') level: string | undefined,
    @UploadedFile() file: UploadedPart | undefined,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp' }]);
    }
    return this.exams.importQuestions(currentUser, readLevelQuery(level), file.buffer, originOf(request, currentUser));
  }

  @Post()
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.exams.createQuestion(currentUser, parseQuestion(body), originOf(request, currentUser));
  }

  @Get(':id')
  read(
    @Param('id', uuidParameter('Mã câu hỏi không hợp lệ')) questionId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.question(currentUser, questionId);
  }

  @Put(':id')
  update(
    @Param('id', uuidParameter('Mã câu hỏi không hợp lệ')) questionId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.updateQuestion(currentUser, questionId, parseQuestion(body), originOf(request, currentUser));
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(
    @Param('id', uuidParameter('Mã câu hỏi không hợp lệ')) questionId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.submitQuestion(currentUser, questionId, originOf(request, currentUser));
  }

  @Post(':id/review')
  @HttpCode(200)
  @RequirePermission(REVIEW, MANAGE)
  review(
    @Param('id', uuidParameter('Mã câu hỏi không hợp lệ')) questionId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.reviewQuestion(currentUser, questionId, readDecision(body), originOf(request, currentUser));
  }

  @Post(':id/retire')
  @HttpCode(200)
  @RequirePermission(REVIEW, MANAGE)
  retire(
    @Param('id', uuidParameter('Mã câu hỏi không hợp lệ')) questionId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.retireQuestion(questionId, originOf(request, currentUser));
  }
}

@Controller('exam-matrices')
@RequirePermission(AUTHOR, REVIEW, MANAGE)
export class ExamMatricesController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>) {
    readUuidQuery(query, ['subject_id']);
    return this.exams.listMatrices({
      level: query.school_level ? readLevelQuery(query.school_level) : undefined,
      subjectId: query.subject_id || undefined,
      gradeLevelCode: query.grade_level_code || undefined,
    });
  }

  @Get(':id')
  read(@Param('id', uuidParameter('Mã ma trận không hợp lệ')) matrixId: string) {
    return this.exams.matrix(matrixId);
  }

  @Post()
  @RequirePermission(REVIEW, MANAGE)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.exams.saveMatrix(currentUser, null, parseMatrix(body), originOf(request, currentUser));
  }

  @Put(':id')
  @RequirePermission(REVIEW, MANAGE)
  update(
    @Param('id', uuidParameter('Mã ma trận không hợp lệ')) matrixId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.saveMatrix(currentUser, matrixId, parseMatrix(body), originOf(request, currentUser));
  }
}

@Controller('assessment-plans')
@RequirePermission(AUTHOR, REVIEW, MANAGE)
export class AssessmentPlansController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>) {
    return this.exams.listPlans(readLevelQuery(query.school_level), query.term || undefined);
  }

  @Post()
  @RequirePermission(REVIEW, MANAGE)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.exams.savePlan(currentUser, null, parsePlan(body), originOf(request, currentUser));
  }

  @Put(':id')
  @RequirePermission(REVIEW, MANAGE)
  update(
    @Param('id', uuidParameter('Mã kế hoạch không hợp lệ')) planId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.savePlan(currentUser, planId, parsePlan(body), originOf(request, currentUser));
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermission(REVIEW, MANAGE)
  submit(
    @Param('id', uuidParameter('Mã kế hoạch không hợp lệ')) planId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.submitPlan(planId, originOf(request, currentUser));
  }

  @Post(':id/decide')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  decide(
    @Param('id', uuidParameter('Mã kế hoạch không hợp lệ')) planId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.decidePlan(currentUser, planId, readDecision(body), originOf(request, currentUser));
  }
}

@Controller('exams')
@RequirePermission(AUTHOR, REVIEW, MANAGE)
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  list(@Query('school_level') level: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.exams.listExams(currentUser, readLevelQuery(level));
  }

  @Get('staff')
  @RequirePermission(MANAGE)
  staff() {
    return this.exams.staff();
  }

  @Post()
  @RequirePermission(MANAGE)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.exams.createExam(currentUser, parseExam(body), originOf(request, currentUser));
  }

  @Get(':id')
  read(
    @Param('id', uuidParameter('Mã đề không hợp lệ')) examId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.exam(currentUser, examId);
  }

  @Patch(':id')
  update(
    @Param('id', uuidParameter('Mã đề không hợp lệ')) examId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes = {
      title: body?.title === undefined ? undefined : readRequiredText(body, 'title', errors),
      variant_count: readInteger(body, 'variant_count', errors, { min: 1, max: 24 }),
      avoid_recent_days: readInteger(body, 'avoid_recent_days', errors, { min: 0, max: 3650 }),
      matrix_id: readOptionalUuid(body, 'matrix_id', errors),
      due_date: body?.due_date === undefined ? undefined : readDate(body, 'due_date', errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.exams.updateExam(currentUser, examId, changes, originOf(request, currentUser));
  }

  @Post(':id/generate')
  @HttpCode(200)
  generate(
    @Param('id', uuidParameter('Mã đề không hợp lệ')) examId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.generateExam(currentUser, examId, readSeed(body), originOf(request, currentUser));
  }

  @Post(':id/questions')
  @HttpCode(200)
  addQuestion(
    @Param('id', uuidParameter('Mã đề không hợp lệ')) examId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const questionId = readRequiredUuid(body, 'question_id', errors, 'Bắt buộc chọn câu hỏi');
    const score = body?.score;
    if (score !== undefined && (typeof score !== 'number' || !(score > 0) || score > 10)) {
      errors.push({ field: 'score', message: 'Điểm lớn hơn 0, không quá 10' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.exams.addExamQuestion(
      currentUser,
      examId,
      questionId,
      score as number | undefined,
      originOf(request, currentUser),
    );
  }

  @Delete(':id/questions/:questionId')
  removeQuestion(
    @Param('id', uuidParameter('Mã đề không hợp lệ')) examId: string,
    @Param('questionId', uuidParameter('Mã câu hỏi không hợp lệ')) questionId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.removeExamQuestion(currentUser, examId, questionId, originOf(request, currentUser));
  }

  @Post(':id/variants')
  @HttpCode(200)
  variants(
    @Param('id', uuidParameter('Mã đề không hợp lệ')) examId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.buildExamVariants(currentUser, examId, readSeed(body), originOf(request, currentUser));
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(
    @Param('id', uuidParameter('Mã đề không hợp lệ')) examId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.submitExam(currentUser, examId, originOf(request, currentUser));
  }

  @Post(':id/review')
  @HttpCode(200)
  review(
    @Param('id', uuidParameter('Mã đề không hợp lệ')) examId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.reviewExam(currentUser, examId, readDecision(body), originOf(request, currentUser));
  }

  @Post(':id/lock')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  lock(
    @Param('id', uuidParameter('Mã đề không hợp lệ')) examId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.exams.lockExam(currentUser, examId, originOf(request, currentUser));
  }

  @Post(':id/unlock')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  unlock(
    @Param('id', uuidParameter('Mã đề không hợp lệ')) examId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readRequiredText(body, 'reason', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.exams.unlockExam(currentUser, examId, reason, originOf(request, currentUser));
  }

  @Get(':id/export')
  async export(
    @Param('id', uuidParameter('Mã đề không hợp lệ')) examId: string,
    @Query() query: Record<string, string | undefined>,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const part = query.part === 'answers' ? 'answers' : 'paper';
    const format = query.format === 'docx' ? 'docx' : 'pdf';
    const file = await this.exams.exportExam(
      currentUser,
      examId,
      part,
      query.code,
      format,
      originOf(request, currentUser),
    );
    response.type(file.contentType).attachment(file.fileName).send(file.buffer);
  }
}
