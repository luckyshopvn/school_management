import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { CandidateSource, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { PublicEndpoint } from '../authentication/authentication.guard.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { conflictOnDuplicate, notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { FilesService, MAXIMUM_FILE_BYTES } from '../files/files.js';
import { check } from '../inventory/inventory-common.js';
import {
  hrRecipients,
  LONG_TEXT,
  PublicRateLimiter,
  readDateValue,
  readEmail,
  readGender,
  readPhone,
  readString,
} from './recruitment-common.js';

// Trang tuyển dụng công khai (P18-02, P18-03; BR-69, BR-74; YCTD-87): người ngoài không cần tài khoản xem tin đã công bố
// còn hạn nộp và nộp hồ sơ kèm hồ sơ xin việc (ảnh hoặc PDF tối đa 10 MB). Mỗi địa chỉ mạng tối đa 120 lần xem mỗi phút và
// 10 lần nộp mỗi 10 phút; bắt buộc đồng ý cho nhà trường xử lý dữ liệu cá nhân để tuyển dụng. Kết quả trả về không chứa mã
// hồ sơ hay dữ liệu đã nộp. Nhân sự (VT-06) của đơn vị và của Trường chính nhận thông báo có hồ sơ mới
const READ_LIMIT = 120;
const APPLY_LIMIT = 10;
const APPLY_WINDOW = 10 * 60_000;
export const PUBLIC_SOURCES: CandidateSource[] = ['website', 'referral', 'job_board', 'social_media', 'other'];

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export interface PublicApplicationInput {
  full_name: string;
  phone: string;
  email: string | null;
  dob: string | null;
  gender: 'male' | 'female' | null;
  address: string | null;
  cover_letter: string | null;
  source: CandidateSource;
}

@Injectable()
export class PublicRecruitmentService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly files: FilesService,
    private readonly limiter: PublicRateLimiter,
    private readonly clock: Clock,
  ) {}

  limitRead(ipAddress: string) {
    this.limiter.check(`job-posts:read:${ipAddress}`, READ_LIMIT, 60_000, this.clock.now().getTime());
  }

  limitApply(ipAddress: string) {
    this.limiter.check(`job-posts:apply:${ipAddress}`, APPLY_LIMIT, APPLY_WINDOW, this.clock.now().getTime());
  }

  async list() {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    return this.openQuery(current.database).orderBy('job_postings.published_at', 'desc').execute();
  }

  async read(postingId: string) {
    const { database } = await this.currentSchoolYear.require();
    const posting = await this.openQuery(database).where('job_postings.id', '=', postingId).executeTakeFirst();
    if (!posting) {
      throw notFoundError('Tin tuyển dụng không tồn tại hoặc đã hết hạn nộp hồ sơ', 'job_posting');
    }
    return posting;
  }

  async apply(postingId: string, input: PublicApplicationInput, cv: { fileName: string; body: Buffer }) {
    const posting = await this.read(postingId);
    const { database } = await this.currentSchoolYear.require();
    const duplicate = await database
      .selectFrom('candidates')
      .select('id')
      .where('posting_id', '=', postingId)
      .where('phone', '=', input.phone)
      .executeTakeFirst();
    if (duplicate) {
      throw new ApplicationError('ERR_CONFLICT', 'Số điện thoại này đã nộp hồ sơ cho tin tuyển dụng này', [
        { field: 'phone', message: 'Đã nộp hồ sơ' },
      ]);
    }
    await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const file = await this.files.storeCandidateCv(transaction, {
          orgUnitId: posting.org_unit_id,
          fileName: cv.fileName,
          body: cv.body,
          createdBy: null,
        });
        const candidate = await transaction
          .insertInto('candidates')
          .values({
            posting_id: postingId,
            org_unit_id: posting.org_unit_id,
            full_name: input.full_name,
            phone: input.phone,
            email: input.email,
            dob: input.dob,
            gender: input.gender,
            address: input.address,
            cover_letter: input.cover_letter,
            source: input.source,
            cv_file_id: file.id,
            consent_at: this.clock.now(),
            created_by: null,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await queueNotification(transaction, {
          orgUnitId: posting.org_unit_id,
          templateCode: 'candidate_applied',
          title: 'Có hồ sơ ứng viên mới',
          body: `${input.full_name} nộp hồ sơ cho tin "${posting.title}"`,
          targetType: 'candidates',
          targetId: candidate.id,
          recipients: await hrRecipients(transaction, posting.org_unit_id),
        });
      }),
      'Số điện thoại này đã nộp hồ sơ cho tin tuyển dụng này',
      'phone',
    );
    return {
      message: `Nhà trường đã nhận hồ sơ ứng tuyển "${posting.title}". Bộ phận nhân sự sẽ liên hệ qua số điện thoại bạn cung cấp.`,
    };
  }

  // Tin đã công bố, còn hạn nộp tính theo ngày Việt Nam
  private openQuery(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('job_postings')
      .innerJoin('recruitment_requests', 'recruitment_requests.id', 'job_postings.request_id')
      .innerJoin('org_units', 'org_units.id', 'job_postings.org_unit_id')
      .select([
        'job_postings.id',
        'job_postings.org_unit_id',
        'job_postings.title',
        'job_postings.description',
        'job_postings.requirements',
        'job_postings.deadline',
        'job_postings.published_at',
        'recruitment_requests.position',
        'recruitment_requests.quantity',
        'org_units.name as unit_name',
      ])
      .where('job_postings.status', '=', 'published')
      .where('job_postings.deadline', '>=', VIETNAM_DATE.format(this.clock.now()));
  }
}

function readSource(body: RequestBody, errors: FieldError[]): CandidateSource {
  const value = body?.source;
  if (value === undefined || value === null || value === '') {
    return 'website';
  }
  if (!PUBLIC_SOURCES.includes(value as CandidateSource)) {
    errors.push({ field: 'source', message: `Nguồn là ${PUBLIC_SOURCES.join(', ')}` });
    return 'website';
  }
  return value as CandidateSource;
}

@Controller('public/job-posts')
@PublicEndpoint()
export class PublicRecruitmentController {
  constructor(private readonly recruitment: PublicRecruitmentService) {}

  @Get()
  list(@Req() request: Request) {
    this.recruitment.limitRead(request.ip ?? 'unknown');
    return this.recruitment.list();
  }

  @Get(':id')
  read(@Param('id', uuidParameter('Mã tin tuyển dụng không hợp lệ')) postingId: string, @Req() request: Request) {
    this.recruitment.limitRead(request.ip ?? 'unknown');
    return this.recruitment.read(postingId);
  }

  // Biểu mẫu nhiều phần: các trường của ứng viên và tệp hồ sơ xin việc ở trường `cv`
  @Post(':id/applications')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('cv', { limits: { fileSize: MAXIMUM_FILE_BYTES, files: 1, fields: 20 } }))
  apply(
    @Param('id', uuidParameter('Mã tin tuyển dụng không hợp lệ')) postingId: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
  ) {
    this.recruitment.limitApply(request.ip ?? 'unknown');
    const errors: FieldError[] = [];
    const input: PublicApplicationInput = {
      full_name: readString(body, 'full_name', errors, { required: true }) ?? '',
      phone: readPhone(body, errors),
      email: readEmail(body, errors),
      dob: readDateValue(body, 'dob', errors, false),
      gender: readGender(body, errors),
      address: readString(body, 'address', errors, { required: false, max: 500 }),
      cover_letter: readString(body, 'cover_letter', errors, { required: false, max: LONG_TEXT }),
      source: readSource(body, errors),
    };
    if (body?.consent !== 'true' && body?.consent !== true) {
      errors.push({ field: 'consent', message: 'Bắt buộc đồng ý cho nhà trường xử lý dữ liệu cá nhân để tuyển dụng' });
    }
    if (!file || file.size === 0) {
      errors.push({ field: 'cv', message: 'Bắt buộc đính kèm hồ sơ xin việc (ảnh hoặc PDF)' });
    }
    check(errors);
    if (!file) {
      throw validationError([{ field: 'cv', message: 'Bắt buộc đính kèm hồ sơ xin việc' }]);
    }
    return this.recruitment.apply(postingId, input, {
      fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      body: file.buffer,
    });
  }
}
