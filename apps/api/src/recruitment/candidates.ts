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
import type { CandidateSource, CandidateStatus, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { writeDataAccessLog } from '../common/data-access-log.js';
import { queueNotification } from '../common/notification-queue.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readOptionalUuid,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { FilesService, MAXIMUM_FILE_BYTES } from '../files/files.js';
import { check, optionalEnumQuery, optionalUuidQuery } from '../inventory/inventory-common.js';
import { StaffService } from '../staff/staff.service.js';
import {
  hrRecipients,
  LONG_TEXT,
  readDateValue,
  readEmail,
  readGender,
  readPhone,
  readString,
  RecruitmentAccess,
} from './recruitment-common.js';

// Hồ sơ ứng viên, phỏng vấn và quyết định tuyển (P18-03, P18-04; BR-37, BR-74, BR-75, BR-80; YCTD-87).
// Hồ sơ ứng viên là dữ liệu cá nhân: chỉ người có quyền P18.recruitment.manage hoặc P18.interview.manage trong phạm vi đơn
// vị của tin xem; danh sách không trả số điện thoại, thư điện tử; mỗi lần xem chi tiết hoặc tải hồ sơ xin việc luôn ghi
// nhật ký truy cập dữ liệu (BR-74). Không xóa ứng viên (BR-75), chỉ đổi trạng thái: mới, đang sàng lọc, đang phỏng vấn,
// đã tuyển, không đạt, đã rút. Nhân sự (VT-06) tiếp nhận, sàng lọc; nhân sự hoặc quản lý đơn vị (VT-03) lên lịch phỏng vấn,
// ghi kết quả và quyết định tuyển (ghi người quyết định, thời điểm, lý do theo BR-80). Ứng viên đã tuyển thì nhân sự có
// thể tạo hồ sơ nhân sự từ dữ liệu ứng viên, mỗi người một hồ sơ (BR-37); hệ thống không gửi thông báo cho ứng viên vì
// ứng viên không có tài khoản, nhân sự liên hệ trực tiếp
export const CANDIDATE_STATUSES: CandidateStatus[] = [
  'new',
  'screening',
  'interviewing',
  'hired',
  'rejected',
  'withdrawn',
];
export const CANDIDATE_SOURCES: CandidateSource[] = [
  'website',
  'referral',
  'job_board',
  'social_media',
  'walk_in',
  'other',
];
const VIEW_PERMISSIONS = [PERMISSION_CODES.recruitmentManage, PERMISSION_CODES.interviewManage];
// Đổi trạng thái thủ công khi sàng lọc; đã tuyển hoặc không đạt sau phỏng vấn đi qua quyết định tuyển
const STATUS_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  new: ['screening', 'rejected', 'withdrawn'],
  screening: ['rejected', 'withdrawn'],
  interviewing: ['withdrawn'],
  hired: [],
  rejected: [],
  withdrawn: [],
};
const MANUAL_STATUSES = ['screening', 'rejected', 'withdrawn'] as const;
type ManualStatus = (typeof MANUAL_STATUSES)[number];

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

interface CandidateInput {
  posting_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  dob: string | null;
  gender: 'male' | 'female' | null;
  address: string | null;
  source: CandidateSource;
  note: string | null;
}

interface InterviewInput {
  scheduled_at: Date;
  location: string;
  interviewer_staff_ids: string[];
}

interface HireStaffInput {
  code: string;
  start_date: string;
  department_id: string | null;
  job_title_id: string | null;
}

@Injectable()
export class CandidatesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: RecruitmentAccess,
    private readonly files: FilesService,
    private readonly staff: StaffService,
    private readonly clock: Clock,
  ) {}

  // ---------- Hồ sơ ứng viên (P18-03) ----------

  async list(
    currentUser: CurrentUser,
    filter: { postingId: string | null; status: CandidateStatus | null; orgUnitId: string | null },
  ) {
    const scope = await this.access.requireScope(
      currentUser,
      VIEW_PERMISSIONS,
      'Bạn không có quyền xem hồ sơ ứng viên',
    );
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('candidates')
      .innerJoin('job_postings', 'job_postings.id', 'candidates.posting_id')
      .select([
        'candidates.id',
        'candidates.posting_id',
        'candidates.org_unit_id',
        'candidates.full_name',
        'candidates.source',
        'candidates.status',
        'candidates.staff_id',
        'candidates.created_at',
        'job_postings.title as posting_title',
      ])
      .select((expression) => [
        expression.case().when('candidates.cv_file_id', 'is not', null).then(true).else(false).end().as('has_cv'),
      ])
      .orderBy('candidates.created_at', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('candidates.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.postingId) {
      query = query.where('candidates.posting_id', '=', filter.postingId);
    }
    if (filter.status) {
      query = query.where('candidates.status', '=', filter.status);
    }
    if (filter.orgUnitId) {
      query = query.where('candidates.org_unit_id', '=', filter.orgUnitId);
    }
    return query.execute();
  }

  // Chi tiết kèm liên hệ, thư giới thiệu và các lần phỏng vấn; luôn ghi nhật ký truy cập dữ liệu cá nhân (BR-74)
  async read(currentUser: CurrentUser, candidateId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const candidate = await this.loadVisible(currentUser, database, candidateId);
    await writeDataAccessLog(database, {
      origin,
      orgUnitId: candidate.org_unit_id,
      entityName: 'candidates',
      entityId: candidateId,
      scope: 'candidate_profile',
    });
    return this.detail(database, currentUser, candidateId);
  }

  async create(currentUser: CurrentUser, input: CandidateInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const posting = await database
      .selectFrom('job_postings')
      .select(['id', 'org_unit_id', 'status', 'title'])
      .where('id', '=', input.posting_id)
      .executeTakeFirst();
    if (!posting) {
      throw notFoundError('Không tìm thấy tin tuyển dụng', 'job_posting');
    }
    await this.assertManage(currentUser, posting.org_unit_id);
    if (posting.status === 'draft') {
      throw ruleViolationError('BR-69', 'Tin tuyển dụng chưa công bố, chưa nhận hồ sơ');
    }
    const created = await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const candidate = await transaction
          .insertInto('candidates')
          .values({
            posting_id: posting.id,
            org_unit_id: posting.org_unit_id,
            full_name: input.full_name,
            phone: input.phone,
            email: input.email,
            dob: input.dob,
            gender: input.gender,
            address: input.address,
            source: input.source,
            note: input.note,
            created_by: origin.actorUserId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: posting.org_unit_id,
          entityName: 'candidates',
          entityId: candidate.id,
          action: 'create',
          before: null,
          after: candidate,
        });
        return candidate;
      }),
      'Số điện thoại này đã có hồ sơ cho tin tuyển dụng này',
      'phone',
    );
    return this.detail(database, currentUser, created.id);
  }

  // Đính kèm hoặc thay hồ sơ xin việc cho ứng viên do nhân sự nhập
  async attachCv(
    currentUser: CurrentUser,
    candidateId: string,
    cv: { fileName: string; body: Buffer },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const candidate = await this.load(database, candidateId);
    await this.assertManage(currentUser, candidate.org_unit_id);
    this.assertNotFinal(candidate.status);
    await database.transaction().execute(async (transaction) => {
      const file = await this.files.storeCandidateCv(transaction, {
        orgUnitId: candidate.org_unit_id,
        fileName: cv.fileName,
        body: cv.body,
        createdBy: origin.actorUserId,
      });
      await transaction
        .updateTable('candidates')
        .set({ cv_file_id: file.id, updated_at: this.clock.now() })
        .where('id', '=', candidateId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: candidate.org_unit_id,
        entityName: 'candidates',
        entityId: candidateId,
        action: 'update',
        before: { cv_file_id: candidate.cv_file_id },
        after: { cv_file_id: file.id },
      });
    });
    return this.detail(database, currentUser, candidateId);
  }

  async downloadCv(currentUser: CurrentUser, candidateId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const candidate = await this.loadVisible(currentUser, database, candidateId);
    if (!candidate.cv_file_id) {
      throw notFoundError('Ứng viên chưa có hồ sơ xin việc', 'file');
    }
    await writeDataAccessLog(database, {
      origin,
      orgUnitId: candidate.org_unit_id,
      entityName: 'candidates',
      entityId: candidateId,
      scope: 'candidate_cv',
    });
    return this.files.readStored(database, candidate.cv_file_id);
  }

  // Sàng lọc: chuyển sang đang sàng lọc, không đạt hoặc đã rút (kèm lý do); lịch phỏng vấn còn chờ thì hủy theo
  async changeStatus(
    currentUser: CurrentUser,
    candidateId: string,
    input: { status: ManualStatus; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const candidate = await this.load(database, candidateId);
    await this.assertManage(currentUser, candidate.org_unit_id);
    if (!STATUS_TRANSITIONS[candidate.status].includes(input.status)) {
      throw ruleViolationError('BR-75', 'Không chuyển được ứng viên sang trạng thái này');
    }
    if (input.status !== 'screening' && !input.reason) {
      throw validationError([{ field: 'reason', message: 'Bắt buộc nhập lý do' }]);
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      const claimed = await transaction
        .updateTable('candidates')
        .set({ status: input.status, status_reason: input.reason, updated_at: now })
        .where('id', '=', candidateId)
        .where('status', '=', candidate.status)
        .returning('id')
        .executeTakeFirst();
      if (!claimed) {
        throw ruleViolationError('BR-75', 'Hồ sơ ứng viên đã được người khác cập nhật');
      }
      if (input.status !== 'screening') {
        await transaction
          .updateTable('interviews')
          .set({ status: 'cancelled', cancel_reason: input.reason, updated_at: now })
          .where('candidate_id', '=', candidateId)
          .where('status', '=', 'scheduled')
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: candidate.org_unit_id,
        entityName: 'candidates',
        entityId: candidateId,
        action: 'update',
        before: { status: candidate.status },
        after: { status: input.status, reason: input.reason },
      });
    });
    return this.detail(database, currentUser, candidateId);
  }

  // ---------- Phỏng vấn (P18-04) ----------

  async scheduleInterview(currentUser: CurrentUser, candidateId: string, input: InterviewInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const candidate = await this.load(database, candidateId);
    await this.assertInterview(currentUser, candidate.org_unit_id);
    if (candidate.status !== 'screening' && candidate.status !== 'interviewing') {
      throw ruleViolationError('BR-75', 'Chỉ lên lịch phỏng vấn cho ứng viên đang sàng lọc hoặc đang phỏng vấn');
    }
    if (VIETNAM_DATE.format(input.scheduled_at) < VIETNAM_DATE.format(this.clock.now())) {
      throw validationError([{ field: 'scheduled_at', message: 'Ngày phỏng vấn không trước hôm nay' }]);
    }
    const interviewers = await database
      .selectFrom('staff')
      .select(['id', 'full_name', 'user_id'])
      .where('id', 'in', input.interviewer_staff_ids)
      .where('status', '=', 'active')
      .execute();
    if (interviewers.length !== input.interviewer_staff_ids.length) {
      throw validationError([
        { field: 'interviewer_staff_ids', message: 'Người phỏng vấn phải là nhân sự đang làm việc' },
      ]);
    }
    const created = await database.transaction().execute(async (transaction) => {
      const previous = await transaction
        .selectFrom('interviews')
        .select((expression) => expression.fn.countAll<string>().as('count'))
        .where('candidate_id', '=', candidateId)
        .where('status', '<>', 'cancelled')
        .executeTakeFirstOrThrow();
      const interview = await transaction
        .insertInto('interviews')
        .values({
          candidate_id: candidateId,
          round: Number(previous.count) + 1,
          scheduled_at: input.scheduled_at,
          location: input.location,
          interviewer_staff_ids: input.interviewer_staff_ids,
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      if (candidate.status !== 'interviewing') {
        await transaction
          .updateTable('candidates')
          .set({ status: 'interviewing', updated_at: this.clock.now() })
          .where('id', '=', candidateId)
          .execute();
      }
      await queueNotification(transaction, {
        orgUnitId: candidate.org_unit_id,
        templateCode: 'interview_scheduled',
        title: 'Bạn có lịch phỏng vấn ứng viên',
        body: `${candidate.full_name}, vòng ${interview.round}, tại ${input.location}`,
        targetType: 'interviews',
        targetId: interview.id,
        recipients: interviewers
          .filter((interviewer) => interviewer.user_id !== null)
          .map((interviewer) => ({ userId: interviewer.user_id ?? '', channel: 'in_app' as const })),
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: candidate.org_unit_id,
        entityName: 'interviews',
        entityId: interview.id,
        action: 'create',
        before: null,
        after: interview,
      });
      return interview;
    });
    return this.readInterview(database, created.id);
  }

  async recordResult(
    currentUser: CurrentUser,
    interviewId: string,
    input: { result: 'passed' | 'failed'; score: number | null; evaluation: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const { interview, candidate } = await this.loadInterview(database, interviewId);
    await this.assertInterview(currentUser, candidate.org_unit_id);
    if (interview.status !== 'scheduled') {
      throw ruleViolationError('BR-75', 'Lịch phỏng vấn này đã ghi kết quả hoặc đã hủy');
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      const claimed = await transaction
        .updateTable('interviews')
        .set({
          status: 'completed',
          result: input.result,
          score: input.score,
          evaluation: input.evaluation,
          recorded_by: origin.actorUserId,
          recorded_at: now,
          updated_at: now,
        })
        .where('id', '=', interviewId)
        .where('status', '=', 'scheduled')
        .returning('id')
        .executeTakeFirst();
      if (!claimed) {
        throw ruleViolationError('BR-75', 'Lịch phỏng vấn này đã ghi kết quả hoặc đã hủy');
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: candidate.org_unit_id,
        entityName: 'interviews',
        entityId: interviewId,
        action: 'update',
        before: { status: 'scheduled' },
        after: { status: 'completed', ...input },
      });
    });
    return this.readInterview(database, interviewId);
  }

  async cancelInterview(currentUser: CurrentUser, interviewId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const { interview, candidate } = await this.loadInterview(database, interviewId);
    await this.assertInterview(currentUser, candidate.org_unit_id);
    if (interview.status !== 'scheduled') {
      throw ruleViolationError('BR-75', 'Chỉ hủy được lịch phỏng vấn đang chờ');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('interviews')
        .set({ status: 'cancelled', cancel_reason: reason, updated_at: this.clock.now() })
        .where('id', '=', interviewId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: candidate.org_unit_id,
        entityName: 'interviews',
        entityId: interviewId,
        action: 'update',
        before: { status: 'scheduled' },
        after: { status: 'cancelled', reason },
      });
    });
    return this.readInterview(database, interviewId);
  }

  // Quyết định tuyển (P18-04, BR-80): ứng viên đang phỏng vấn, không còn lịch chờ; tuyển cần lần phỏng vấn gần nhất đạt
  async decide(
    currentUser: CurrentUser,
    candidateId: string,
    input: { result: 'hired' | 'rejected'; note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const candidate = await this.load(database, candidateId);
    await this.assertInterview(currentUser, candidate.org_unit_id);
    if (candidate.status !== 'interviewing') {
      throw ruleViolationError('BR-80', 'Chỉ quyết định tuyển cho ứng viên đang phỏng vấn');
    }
    const interviews = await database
      .selectFrom('interviews')
      .select(['status', 'result', 'round'])
      .where('candidate_id', '=', candidateId)
      .orderBy('round', 'desc')
      .execute();
    if (interviews.some((interview) => interview.status === 'scheduled')) {
      throw ruleViolationError('BR-80', 'Còn lịch phỏng vấn chưa ghi kết quả');
    }
    const latest = interviews.find((interview) => interview.status === 'completed');
    if (!latest) {
      throw ruleViolationError('BR-80', 'Ứng viên chưa có kết quả phỏng vấn');
    }
    if (input.result === 'hired' && latest.result !== 'passed') {
      throw ruleViolationError('BR-80', 'Lần phỏng vấn gần nhất không đạt, không quyết định tuyển được');
    }
    if (input.result === 'rejected' && !input.note) {
      throw validationError([{ field: 'note', message: 'Bắt buộc nhập lý do không tuyển' }]);
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      const claimed = await transaction
        .updateTable('candidates')
        .set({
          status: input.result,
          decided_by: origin.actorUserId,
          decided_at: now,
          decision_note: input.note,
          status_reason: input.result === 'rejected' ? input.note : null,
          updated_at: now,
        })
        .where('id', '=', candidateId)
        .where('status', '=', 'interviewing')
        .returning('id')
        .executeTakeFirst();
      if (!claimed) {
        throw ruleViolationError('BR-80', 'Hồ sơ ứng viên đã được người khác quyết định');
      }
      if (input.result === 'hired') {
        await queueNotification(transaction, {
          orgUnitId: candidate.org_unit_id,
          templateCode: 'candidate_hired',
          title: 'Có ứng viên được quyết định tuyển',
          body: `${candidate.full_name} được tuyển, cần tạo hồ sơ nhân sự và hợp đồng`,
          targetType: 'candidates',
          targetId: candidateId,
          recipients: await hrRecipients(transaction, candidate.org_unit_id),
        });
      }
      // BR-80: người quyết định, thời điểm, kết quả và lý do
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: candidate.org_unit_id,
        entityName: 'candidates',
        entityId: candidateId,
        action: 'update',
        before: { status: 'interviewing' },
        after: {
          status: input.result,
          decided_by: origin.actorUserId,
          decider_name: origin.actorName,
          decided_at: now.toISOString(),
          note: input.note,
        },
      });
    });
    return this.detail(database, currentUser, candidateId);
  }

  // Tạo hồ sơ nhân sự từ ứng viên đã tuyển (tùy chọn): dùng nghiệp vụ tạo hồ sơ của P07-01 nên cần P07.staff.manage;
  // số điện thoại đã có hồ sơ nhân sự thì không tạo hồ sơ thứ hai (BR-37)
  async createStaff(currentUser: CurrentUser, candidateId: string, input: HireStaffInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const candidate = await this.load(database, candidateId);
    await this.assertManage(currentUser, candidate.org_unit_id);
    if (candidate.status !== 'hired') {
      throw ruleViolationError('BR-37', 'Chỉ tạo hồ sơ nhân sự cho ứng viên đã được quyết định tuyển');
    }
    if (candidate.staff_id) {
      throw ruleViolationError('BR-37', 'Ứng viên này đã có hồ sơ nhân sự');
    }
    const existing = await database
      .selectFrom('staff')
      .select(['id', 'full_name', 'code'])
      .where('phone', '=', candidate.phone)
      .executeTakeFirst();
    if (existing) {
      throw ruleViolationError(
        'BR-37',
        `Số điện thoại đã có hồ sơ nhân sự ${existing.code} ${existing.full_name}, cập nhật hồ sơ đó thay vì tạo mới`,
      );
    }
    const staff = await this.staff.create(
      currentUser,
      {
        orgUnitId: candidate.org_unit_id,
        code: input.code,
        fullName: candidate.full_name,
        dob: candidate.dob,
        gender: candidate.gender,
        phone: candidate.phone,
        email: candidate.email,
        address: candidate.address,
        idNumber: null,
        departmentId: input.department_id,
        jobTitleId: input.job_title_id,
        startDate: input.start_date,
      },
      origin,
    );
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('candidates')
        .set({ staff_id: staff.id, updated_at: this.clock.now() })
        .where('id', '=', candidateId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: candidate.org_unit_id,
        entityName: 'candidates',
        entityId: candidateId,
        action: 'update',
        before: { staff_id: null },
        after: { staff_id: staff.id, staff_code: input.code },
      });
    });
    return this.detail(database, currentUser, candidateId);
  }

  // ---------- Dùng chung ----------

  private async detail(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser, candidateId: string) {
    const candidate = await database
      .selectFrom('candidates')
      .innerJoin('job_postings', 'job_postings.id', 'candidates.posting_id')
      .innerJoin('recruitment_requests', 'recruitment_requests.id', 'job_postings.request_id')
      .leftJoin('files', 'files.id', 'candidates.cv_file_id')
      .leftJoin('staff', 'staff.id', 'candidates.staff_id')
      .selectAll('candidates')
      .select([
        'job_postings.title as posting_title',
        'recruitment_requests.position',
        'files.file_name as cv_file_name',
        'staff.code as staff_code',
      ])
      .where('candidates.id', '=', candidateId)
      .executeTakeFirstOrThrow();
    const interviews = await database
      .selectFrom('interviews')
      .selectAll()
      .where('candidate_id', '=', candidateId)
      .orderBy('round')
      .orderBy('created_at')
      .execute();
    const staffIds = [...new Set(interviews.flatMap((interview) => interview.interviewer_staff_ids))];
    const names = staffIds.length
      ? await database.selectFrom('staff').select(['id', 'full_name']).where('id', 'in', staffIds).execute()
      : [];
    return {
      ...candidate,
      can_manage: await this.access.canAccess(currentUser, [PERMISSION_CODES.recruitmentManage], candidate.org_unit_id),
      can_interview: await this.access.canAccess(
        currentUser,
        [PERMISSION_CODES.interviewManage],
        candidate.org_unit_id,
      ),
      interviews: interviews.map((interview) => this.interviewView(interview, names)),
    };
  }

  private async readInterview(database: Kysely<SchoolYearDatabase>, interviewId: string) {
    const interview = await database
      .selectFrom('interviews')
      .selectAll()
      .where('id', '=', interviewId)
      .executeTakeFirstOrThrow();
    const names = await database
      .selectFrom('staff')
      .select(['id', 'full_name'])
      .where('id', 'in', interview.interviewer_staff_ids)
      .execute();
    return this.interviewView(interview, names);
  }

  private interviewView<Row extends { interviewer_staff_ids: string[]; score: string | null }>(
    interview: Row,
    names: Array<{ id: string; full_name: string }>,
  ) {
    return {
      ...interview,
      score: interview.score === null ? null : Number(interview.score),
      interviewers: interview.interviewer_staff_ids.map((id) => ({
        staff_id: id,
        full_name: names.find((name) => name.id === id)?.full_name ?? '',
      })),
    };
  }

  private async load(database: Kysely<SchoolYearDatabase>, candidateId: string) {
    const candidate = await database
      .selectFrom('candidates')
      .selectAll()
      .where('id', '=', candidateId)
      .executeTakeFirst();
    if (!candidate) {
      throw notFoundError('Không tìm thấy hồ sơ ứng viên', 'candidate');
    }
    return candidate;
  }

  private async loadVisible(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>, candidateId: string) {
    const candidate = await this.load(database, candidateId);
    await this.access.assertUnit(
      currentUser,
      VIEW_PERMISSIONS,
      candidate.org_unit_id,
      'Bạn không có quyền xem hồ sơ ứng viên này',
    );
    return candidate;
  }

  private async loadInterview(database: Kysely<SchoolYearDatabase>, interviewId: string) {
    const interview = await database
      .selectFrom('interviews')
      .selectAll()
      .where('id', '=', interviewId)
      .executeTakeFirst();
    if (!interview) {
      throw notFoundError('Không tìm thấy lịch phỏng vấn', 'interview');
    }
    return { interview, candidate: await this.load(database, interview.candidate_id) };
  }

  private assertNotFinal(status: CandidateStatus) {
    if (status === 'hired' || status === 'rejected' || status === 'withdrawn') {
      throw ruleViolationError('BR-75', 'Hồ sơ ứng viên đã kết thúc');
    }
  }

  private async assertManage(currentUser: CurrentUser, orgUnitId: string) {
    if (!(await this.access.canAccess(currentUser, [PERMISSION_CODES.recruitmentManage], orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền quản lý hồ sơ ứng viên của đơn vị này');
    }
  }

  private async assertInterview(currentUser: CurrentUser, orgUnitId: string) {
    if (!(await this.access.canAccess(currentUser, [PERMISSION_CODES.interviewManage], orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền phỏng vấn, quyết định tuyển ở đơn vị này');
    }
  }
}

function readEnumValue<T extends string>(
  body: RequestBody,
  field: string,
  values: readonly T[],
  errors: FieldError[],
): T {
  const value = body?.[field] as T;
  if (!values.includes(value)) {
    errors.push({ field, message: `Giá trị là ${values.join(', ')}` });
  }
  return value;
}

function readScore(body: RequestBody, errors: FieldError[]): number | null {
  const value = body?.score;
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'number' || value < 0 || value > 10 || Math.round(value * 10) !== value * 10) {
    errors.push({ field: 'score', message: 'Điểm từ 0 đến 10, tối đa một chữ số thập phân' });
    return null;
  }
  return value;
}

@Controller()
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService) {}

  @Get('candidates')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.candidates.list(currentUser, {
      postingId: optionalUuidQuery(query.posting_id, 'posting_id'),
      status: optionalEnumQuery(query.status, 'status', CANDIDATE_STATUSES),
      orgUnitId: optionalUuidQuery(query.org_unit_id, 'org_unit_id'),
    });
  }

  @Post('candidates')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input: CandidateInput = {
      posting_id: readRequiredUuid(body, 'posting_id', errors, 'Bắt buộc chọn tin tuyển dụng'),
      full_name: readString(body, 'full_name', errors, { required: true }) ?? '',
      phone: readPhone(body, errors),
      email: readEmail(body, errors),
      dob: readDateValue(body, 'dob', errors, false),
      gender: readGender(body, errors),
      address: readString(body, 'address', errors, { required: false, max: 500 }),
      source: readEnumValue(body, 'source', CANDIDATE_SOURCES, errors),
      note: readString(body, 'note', errors, { required: false, max: LONG_TEXT }),
    };
    check(errors);
    return this.candidates.create(currentUser, input, originOf(request, currentUser));
  }

  @Get('candidates/:id')
  read(
    @Param('id', uuidParameter('Mã ứng viên không hợp lệ')) candidateId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.candidates.read(currentUser, candidateId, originOf(request, currentUser));
  }

  @Post('candidates/:id/cv')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('cv', { limits: { fileSize: MAXIMUM_FILE_BYTES, files: 1 } }))
  attachCv(
    @Param('id', uuidParameter('Mã ứng viên không hợp lệ')) candidateId: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'cv', message: 'Bắt buộc chọn tệp hồ sơ xin việc' }]);
    }
    return this.candidates.attachCv(
      currentUser,
      candidateId,
      { fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'), body: file.buffer },
      originOf(request, currentUser),
    );
  }

  @Get('candidates/:id/cv')
  async downloadCv(
    @Param('id', uuidParameter('Mã ứng viên không hợp lệ')) candidateId: string,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { file, body } = await this.candidates.downloadCv(currentUser, candidateId, originOf(request, currentUser));
    response.setHeader('content-type', file.content_type);
    response.setHeader('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
    response.setHeader('cache-control', 'no-store');
    response.send(body);
  }

  @Post('candidates/:id/status')
  @HttpCode(200)
  changeStatus(
    @Param('id', uuidParameter('Mã ứng viên không hợp lệ')) candidateId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      status: readEnumValue(body, 'status', MANUAL_STATUSES, errors),
      reason: readString(body, 'reason', errors, { required: false, max: LONG_TEXT }),
    };
    check(errors);
    return this.candidates.changeStatus(currentUser, candidateId, input, originOf(request, currentUser));
  }

  @Post('candidates/:id/interviews')
  @HttpCode(201)
  scheduleInterview(
    @Param('id', uuidParameter('Mã ứng viên không hợp lệ')) candidateId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const rawTime = body?.scheduled_at;
    const scheduledAt = typeof rawTime === 'string' ? new Date(rawTime) : new Date(Number.NaN);
    if (Number.isNaN(scheduledAt.getTime())) {
      errors.push({ field: 'scheduled_at', message: 'Thời điểm phỏng vấn dạng ISO 8601' });
    }
    const location = readString(body, 'location', errors, { required: true, max: 500 }) ?? '';
    const ids = body?.interviewer_staff_ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 10 || !ids.every(isUuid)) {
      errors.push({ field: 'interviewer_staff_ids', message: 'Chọn từ 1 đến 10 người phỏng vấn' });
    }
    check(errors);
    return this.candidates.scheduleInterview(
      currentUser,
      candidateId,
      { scheduled_at: scheduledAt, location, interviewer_staff_ids: [...new Set(ids as string[])] },
      originOf(request, currentUser),
    );
  }

  @Post('interviews/:id/result')
  @HttpCode(200)
  recordResult(
    @Param('id', uuidParameter('Mã lịch phỏng vấn không hợp lệ')) interviewId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      result: readEnumValue(body, 'result', ['passed', 'failed'] as const, errors),
      score: readScore(body, errors),
      evaluation: readString(body, 'evaluation', errors, { required: true, max: LONG_TEXT }) ?? '',
    };
    check(errors);
    return this.candidates.recordResult(currentUser, interviewId, input, originOf(request, currentUser));
  }

  @Post('interviews/:id/cancel')
  @HttpCode(200)
  cancelInterview(
    @Param('id', uuidParameter('Mã lịch phỏng vấn không hợp lệ')) interviewId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readString(body, 'reason', errors, { required: true, max: LONG_TEXT }) ?? '';
    check(errors);
    return this.candidates.cancelInterview(currentUser, interviewId, reason, originOf(request, currentUser));
  }

  @Post('candidates/:id/decision')
  @HttpCode(200)
  decide(
    @Param('id', uuidParameter('Mã ứng viên không hợp lệ')) candidateId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      result: readEnumValue(body, 'result', ['hired', 'rejected'] as const, errors),
      note: readString(body, 'note', errors, { required: false, max: LONG_TEXT }),
    };
    check(errors);
    return this.candidates.decide(currentUser, candidateId, input, originOf(request, currentUser));
  }

  @Post('candidates/:id/staff')
  @HttpCode(201)
  createStaff(
    @Param('id', uuidParameter('Mã ứng viên không hợp lệ')) candidateId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input: HireStaffInput = {
      code: readString(body, 'code', errors, { required: true, max: 50 }) ?? '',
      start_date: readDateValue(body, 'start_date', errors, true) ?? '',
      department_id: readOptionalUuid(body, 'department_id', errors) ?? null,
      job_title_id: readOptionalUuid(body, 'job_title_id', errors) ?? null,
    };
    check(errors);
    return this.candidates.createStaff(currentUser, candidateId, input, originOf(request, currentUser));
  }
}
