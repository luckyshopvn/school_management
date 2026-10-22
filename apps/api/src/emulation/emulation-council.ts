import { Injectable } from '@nestjs/common';
import type { EmulationNominationStatus, SchoolYearDatabase } from '@school-management/database';
import { validationError } from '@school-management/server';
import {
  agreePercent,
  EMULATION_APPEAL_KIND_LABELS,
  EMULATION_KIND_LABELS,
  EMULATION_NOMINATION_STATUS_LABELS,
  EMULATION_TARGET_LABELS,
  PERMISSION_CODES,
  type EmulationPositionCode,
} from '@school-management/shared';
import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { storageKey } from '../common/resource-names.js';
import { buildTableFile, CONTENT_TYPES, type TableFileFormat } from '../exports/table-file.js';
import { buildDocumentPdf, buildDocx, DOCX_TYPE, PDF_TYPE } from '../kpi/kpi-documents.js';
import { OutgoingDocumentsService, verificationCode } from '../outgoing-documents/outgoing-documents.js';
import { certificatePdf, decisionBlocks, minutesBlocks } from './emulation-documents.js';
import {
  emulationRule,
  EmulationService,
  forbidden,
  type CampaignRow,
  type EmulationContext,
  type Executor,
} from './emulation.js';
import type {
  AppealInput,
  DecisionInput,
  ManualAwardInput,
  MeetingInput,
  MemberInput,
  VoteInput,
} from './emulation-fields.js';

// Hội đồng thi đua, khen thưởng của đợt (DT-18 phần 22d, YCTD-148): thành viên, phiên họp bình xét bỏ phiếu kín (mỗi thành
// viên chỉ thấy phiếu của mình, kết quả chỉ ghi số phiếu), biên bản PDF; công bố kết quả mở hạn phúc khảo, khiếu nại; phúc khảo
// được chấp nhận thì hồ sơ đưa ra bỏ phiếu lại; quyết định khen thưởng của trường hoặc tờ trình đề nghị cấp trên tạo được dự
// thảo văn bản đi (18b), ban hành thì ghi sổ khen thưởng có mã tra cứu công khai; sổ theo dõi nhiều năm đọc mọi năm học; báo
// cáo đợt; nguồn Việc của tôi. Các lựa chọn chi tiết do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
const POSITION_ORDER: Record<EmulationPositionCode, number> = { chair: 0, vice_chair: 1, secretary: 2, member: 3 };
const VERIFY_PATH = '/tra-cuu-khen-thuong';
const DECIDED: EmulationNominationStatus[] = ['proposed', 'awarded', 'not_awarded'];

// Nội dung mã QR: trang tra cứu trên cổng của trường theo nguồn gửi yêu cầu (không ghi cứng tên miền); không có nguồn thì
// chỉ in mã
export function awardVerificationText(code: string, origin: string | null): string {
  if (origin && /^https?:\/\/[^/\s]+$/.test(origin)) {
    return `${origin}${VERIFY_PATH}?ma=${code}`;
  }
  return code;
}

@Injectable()
export class EmulationCouncilService {
  constructor(
    private readonly emulation: EmulationService,
    private readonly outgoing: OutgoingDocumentsService,
  ) {}

  private get clock() {
    return this.emulation.clock;
  }

  // ---- Hội đồng ----

  async council(currentUser: CurrentUser, campaignId: string) {
    const context = await this.emulation.context(currentUser);
    if (!context.canManage && !context.canDecide) {
      if (!(await this.emulation.isMember(context.database, campaignId, currentUser.id))) {
        throw forbidden('Chỉ người quản lý, thành viên hội đồng xem được hội đồng');
      }
    }
    const campaign = await this.emulation.campaign(context.database, campaignId);
    const members = await this.members(context.database, campaignId);
    const meetings = await context.database
      .selectFrom('emulation_meetings')
      .selectAll()
      .where('campaign_id', '=', campaignId)
      .orderBy('held_at', 'desc')
      .execute();
    const accepted = await context.database
      .selectFrom('emulation_nominations')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('campaign_id', '=', campaignId)
      .where('status', '=', 'accepted')
      .where('meeting_id', 'is', null)
      .executeTakeFirstOrThrow();
    return {
      campaign,
      members,
      meetings: await Promise.all(
        meetings.map(async (meeting) => ({
          ...meeting,
          nomination_count: Number(
            (
              await context.database
                .selectFrom('emulation_nominations')
                .select((eb) => eb.fn.countAll<string>().as('count'))
                .where('meeting_id', '=', meeting.id)
                .executeTakeFirstOrThrow()
            ).count,
          ),
          voted_members: Number(
            (
              await context.database
                .selectFrom('emulation_votes')
                .select((eb) => eb.fn.count<string>('member_user_id').distinct().as('count'))
                .where('meeting_id', '=', meeting.id)
                .executeTakeFirstOrThrow()
            ).count,
          ),
        })),
      ),
      waiting_count: Number(accepted.count),
    };
  }

  private async members(database: Executor, campaignId: string) {
    const rows = await database
      .selectFrom('emulation_council_members')
      .select(['id', 'user_id', 'name', 'position', 'sort_order'])
      .where('campaign_id', '=', campaignId)
      .execute();
    return rows.sort(
      (left, right) =>
        POSITION_ORDER[left.position] - POSITION_ORDER[right.position] || left.sort_order - right.sort_order,
    );
  }

  // Thành viên chọn trong nhân sự đang làm việc có tài khoản; không đổi khi đang có phiên bỏ phiếu
  async saveCouncil(currentUser: CurrentUser, campaignId: string, members: MemberInput[], origin: ChangeOrigin) {
    const context = await this.emulation.context(currentUser);
    this.emulation.assertManage(context);
    const campaign = await this.emulation.campaign(context.database, campaignId);
    if (campaign.status === 'closed') {
      throw emulationRule('Đợt thi đua đã kết thúc');
    }
    if (members.length > 0 && !members.some((member) => member.position === 'chair')) {
      throw validationError([{ field: 'members', message: 'Hội đồng cần một Chủ tịch' }]);
    }
    const staff = members.length
      ? await context.database
          .selectFrom('staff')
          .select(['user_id', 'full_name'])
          .where('status', '=', 'active')
          .where(
            'user_id',
            'in',
            members.map((member) => member.user_id),
          )
          .execute()
      : [];
    const missing = members.findIndex((member) => !staff.some((row) => row.user_id === member.user_id));
    if (missing >= 0) {
      throw validationError([
        { field: `members.${missing}.user_id`, message: 'Thành viên là nhân sự đang làm việc có tài khoản' },
      ]);
    }
    await context.database.transaction().execute(async (transaction) => {
      const voting = await transaction
        .selectFrom('emulation_meetings')
        .select('id')
        .where('campaign_id', '=', campaignId)
        .where('status', '=', 'voting')
        .executeTakeFirst();
      if (voting) {
        throw emulationRule('Đang có phiên bỏ phiếu, đóng phiên trước khi đổi thành viên hội đồng');
      }
      const before = await this.members(transaction, campaignId);
      await transaction.deleteFrom('emulation_council_members').where('campaign_id', '=', campaignId).execute();
      if (members.length > 0) {
        await transaction
          .insertInto('emulation_council_members')
          .values(
            members.map((member, index) => ({
              campaign_id: campaignId,
              user_id: member.user_id,
              name: staff.find((row) => row.user_id === member.user_id)?.full_name ?? '',
              position: member.position,
              sort_order: index,
            })),
          )
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'emulation_council_members',
        entityId: campaignId,
        action: 'update',
        before,
        after: members,
      });
    });
    return this.council(currentUser, campaignId);
  }

  // ---- Phiên họp, bỏ phiếu ----

  // Mở phiên: mọi hồ sơ đã tiếp nhận chưa bỏ phiếu đưa ra phiên; thành viên bỏ phiếu trên phần mềm
  async openMeeting(currentUser: CurrentUser, campaignId: string, input: MeetingInput) {
    const context = await this.emulation.context(currentUser);
    this.emulation.assertManage(context);
    const campaign = await this.emulation.campaign(context.database, campaignId);
    if (campaign.status !== 'launched' && campaign.status !== 'published') {
      throw emulationRule('Chỉ họp bình xét khi đợt đã phát động, chưa kết thúc');
    }
    const members = await this.members(context.database, campaignId);
    if (members.length === 0) {
      throw emulationRule('Chưa lập hội đồng thi đua của đợt');
    }
    const id = await context.database.transaction().execute(async (transaction) => {
      const voting = await transaction
        .selectFrom('emulation_meetings')
        .select('id')
        .where('campaign_id', '=', campaignId)
        .where('status', '=', 'voting')
        .executeTakeFirst();
      if (voting) {
        throw emulationRule('Đợt đang có phiên bỏ phiếu chưa đóng');
      }
      const meeting = await transaction
        .insertInto('emulation_meetings')
        .values({
          campaign_id: campaignId,
          held_at: input.held_at,
          location: input.location,
          content: input.content,
          member_count: members.length,
          created_by: currentUser.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const assigned = await transaction
        .updateTable('emulation_nominations')
        .set({ meeting_id: meeting.id, updated_at: this.clock.now() })
        .where('campaign_id', '=', campaignId)
        .where('status', '=', 'accepted')
        .where('meeting_id', 'is', null)
        .returning('id')
        .execute();
      if (assigned.length === 0) {
        throw emulationRule('Không có hồ sơ đã tiếp nhận chờ bình xét');
      }
      await queueNotification(transaction, {
        orgUnitId: null,
        templateCode: 'emulation',
        title: 'Bỏ phiếu bình xét thi đua',
        body: `${campaign.name}: ${assigned.length} hồ sơ`,
        targetType: 'emulation_meeting',
        targetId: meeting.id,
        recipients: members.map((member) => ({ userId: member.user_id, channel: 'in_app' as const })),
      });
      return meeting.id;
    });
    return this.meeting(currentUser, id);
  }

  async meeting(currentUser: CurrentUser, id: string) {
    const context = await this.emulation.context(currentUser);
    const meeting = await context.database
      .selectFrom('emulation_meetings')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!meeting) {
      throw notFoundError('Không tìm thấy phiên họp', 'emulation_meeting');
    }
    const member = await this.emulation.isMember(context.database, meeting.campaign_id, currentUser.id);
    if (!member && !context.canManage && !context.canDecide) {
      throw forbidden('Chỉ thành viên hội đồng, người quản lý xem được phiên họp');
    }
    const nominations = await context.database
      .selectFrom('emulation_nominations as nominations')
      .leftJoin('emulation_votes as mine', (join) =>
        join
          .onRef('mine.nomination_id', '=', 'nominations.id')
          .on('mine.meeting_id', '=', id)
          .on('mine.member_user_id', '=', currentUser.id),
      )
      .select([
        'nominations.id',
        'nominations.title_name',
        'nominations.target',
        'nominations.subject_name',
        'nominations.total_score',
        'nominations.kpi_rank_label',
        'nominations.eligibility',
        'nominations.vote_threshold_percent',
        'nominations.status',
        'nominations.agree_count',
        'nominations.disagree_count',
        'nominations.abstain_count',
        'nominations.agree_percent',
        'mine.choice as my_choice',
      ])
      .where('nominations.meeting_id', '=', id)
      .orderBy('nominations.title_code')
      .orderBy('nominations.subject_name')
      .execute();
    // Đang bỏ phiếu: chỉ hiện số thành viên đã bỏ phiếu, không hiện số phiếu từng lựa chọn
    const voted = await context.database
      .selectFrom('emulation_votes')
      .select((eb) => eb.fn.count<string>('member_user_id').distinct().as('count'))
      .where('meeting_id', '=', id)
      .executeTakeFirstOrThrow();
    const closed = meeting.status === 'closed';
    return {
      ...meeting,
      is_member: member,
      voted_members: Number(voted.count),
      nominations: nominations.map((row) => ({
        ...row,
        agree_count: closed ? row.agree_count : null,
        disagree_count: closed ? row.disagree_count : null,
        abstain_count: closed ? row.abstain_count : null,
        agree_percent: closed ? row.agree_percent : null,
        failed_checks: (Array.isArray(row.eligibility) ? row.eligibility : []).filter(
          (check: { state?: string }) => check.state === 'failed',
        ).length,
      })),
    };
  }

  // Phiên đang mở mà tôi là thành viên
  async voting(currentUser: CurrentUser) {
    const context = await this.emulation.context(currentUser);
    const meetings = await context.database
      .selectFrom('emulation_meetings as meetings')
      .innerJoin('emulation_council_members as members', 'members.campaign_id', 'meetings.campaign_id')
      .innerJoin('emulation_campaigns as campaigns', 'campaigns.id', 'meetings.campaign_id')
      .select(['meetings.id', 'meetings.held_at', 'meetings.location', 'campaigns.name as campaign_name'])
      .where('members.user_id', '=', currentUser.id)
      .where('meetings.status', '=', 'voting')
      .orderBy('meetings.held_at')
      .execute();
    return Promise.all(meetings.map((meeting) => this.meeting(currentUser, meeting.id)));
  }

  async vote(currentUser: CurrentUser, meetingId: string, votes: VoteInput[]) {
    const context = await this.emulation.context(currentUser);
    if (currentUser.description.impersonation) {
      throw emulationRule('Đang đăng nhập thay, không bỏ phiếu được');
    }
    const meeting = await context.database
      .selectFrom('emulation_meetings')
      .select(['id', 'campaign_id', 'status'])
      .where('id', '=', meetingId)
      .executeTakeFirst();
    if (!meeting) {
      throw notFoundError('Không tìm thấy phiên họp', 'emulation_meeting');
    }
    if (!(await this.emulation.isMember(context.database, meeting.campaign_id, currentUser.id))) {
      throw forbidden('Chỉ thành viên hội đồng của đợt bỏ phiếu');
    }
    if (meeting.status !== 'voting') {
      throw emulationRule('Phiên họp đã đóng, không bỏ phiếu được');
    }
    const ids = new Set(
      (
        await context.database
          .selectFrom('emulation_nominations')
          .select('id')
          .where('meeting_id', '=', meetingId)
          .execute()
      ).map((row) => row.id),
    );
    const invalid = votes.findIndex((vote) => !ids.has(vote.nomination_id));
    if (invalid >= 0) {
      throw validationError([{ field: `votes.${invalid}`, message: 'Hồ sơ không thuộc phiên họp này' }]);
    }
    await context.database
      .insertInto('emulation_votes')
      .values(
        votes.map((vote) => ({
          meeting_id: meetingId,
          nomination_id: vote.nomination_id,
          member_user_id: currentUser.id,
          choice: vote.choice,
        })),
      )
      .onConflict((conflict) =>
        conflict
          .columns(['meeting_id', 'nomination_id', 'member_user_id'])
          .doUpdateSet((eb) => ({ choice: eb.ref('excluded.choice'), updated_at: this.clock.now() })),
      )
      .execute();
    return this.meeting(currentUser, meetingId);
  }

  // Đóng phiên: đếm phiếu, tỉ lệ đồng ý trên tổng số thành viên so với tỉ lệ tối thiểu của danh hiệu; dựng biên bản PDF
  async closeMeeting(
    currentUser: CurrentUser,
    meetingId: string,
    input: { attendee_count: number | null; conclusion: string | null },
  ) {
    const context = await this.emulation.context(currentUser);
    this.emulation.assertManage(context);
    const meeting = await context.database
      .selectFrom('emulation_meetings')
      .selectAll()
      .where('id', '=', meetingId)
      .executeTakeFirst();
    if (!meeting) {
      throw notFoundError('Không tìm thấy phiên họp', 'emulation_meeting');
    }
    if (meeting.status !== 'voting') {
      throw emulationRule('Phiên họp đã đóng');
    }
    if (input.attendee_count !== null && input.attendee_count > meeting.member_count) {
      throw validationError([{ field: 'attendee_count', message: 'Số có mặt không quá số thành viên hội đồng' }]);
    }
    const campaign = await this.emulation.campaign(context.database, meeting.campaign_id);
    const members = await this.members(context.database, meeting.campaign_id);
    const nominations = await context.database
      .selectFrom('emulation_nominations')
      .select(['id', 'subject_name', 'title_name', 'vote_threshold_percent', 'owner_user_id', 'org_unit_id'])
      .where('meeting_id', '=', meetingId)
      .orderBy('title_code')
      .orderBy('subject_name')
      .execute();
    const votes = await context.database
      .selectFrom('emulation_votes')
      .select(['nomination_id', 'choice'])
      .where('meeting_id', '=', meetingId)
      .execute();
    const results = nominations.map((nomination) => {
      const mine = votes.filter((vote) => vote.nomination_id === nomination.id);
      const agree = mine.filter((vote) => vote.choice === 'agree').length;
      const disagree = mine.filter((vote) => vote.choice === 'disagree').length;
      const percent = agreePercent(agree, meeting.member_count);
      const threshold = Number(nomination.vote_threshold_percent);
      return {
        ...nomination,
        agree,
        disagree,
        abstain: meeting.member_count - agree - disagree,
        percent,
        threshold,
        passed: percent >= threshold,
      };
    });
    const now = this.clock.now();
    const pdf = await buildDocumentPdf(
      minutesBlocks({
        school: await this.emulation.schoolName(context.database),
        campaign_name: campaign.name,
        held_at: meeting.held_at,
        location: meeting.location,
        content: meeting.content,
        conclusion: input.conclusion,
        members,
        member_count: meeting.member_count,
        attendee_count: input.attendee_count,
        results,
        chair: members.find((member) => member.position === 'chair')?.name ?? '',
        secretary: members.find((member) => member.position === 'secretary')?.name ?? '',
      }),
      { title: 'Biên bản họp hội đồng thi đua, khen thưởng' },
    );
    const key = storageKey('emulation', 'meetings', meetingId, randomUUID());
    await this.emulation.fileStorage.put(key, pdf, CONTENT_TYPES.pdf);
    await context.database.transaction().execute(async (transaction) => {
      const file = await transaction
        .insertInto('files')
        .values({
          org_unit_id: await this.emulation.rootUnit(transaction),
          purpose: 'professional_record',
          file_name: `bien-ban-hoi-dong-${meetingId.slice(0, 8)}.pdf`,
          content_type: CONTENT_TYPES.pdf,
          size_bytes: pdf.length,
          storage_key: key,
          created_by: currentUser.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const changed = await transaction
        .updateTable('emulation_meetings')
        .set({
          status: 'closed',
          attendee_count: input.attendee_count,
          conclusion: input.conclusion,
          closed_at: now,
          closed_by_name: currentUser.description.full_name,
          minutes_file_id: file.id,
        })
        .where('id', '=', meetingId)
        .where('status', '=', 'voting')
        .executeTakeFirst();
      if (Number(changed.numUpdatedRows) !== 1) {
        throw emulationRule('Phiên họp vừa được người khác đóng');
      }
      for (const result of results) {
        await transaction
          .updateTable('emulation_nominations')
          .set({
            status: result.passed ? 'passed' : 'failed',
            agree_count: result.agree,
            disagree_count: result.disagree,
            abstain_count: result.abstain,
            agree_percent: result.percent,
            updated_at: now,
          })
          .where('id', '=', result.id)
          .execute();
      }
    });
    return this.meeting(currentUser, meetingId);
  }

  async minutesFile(currentUser: CurrentUser, meetingId: string) {
    const detail = await this.meeting(currentUser, meetingId);
    if (!detail.minutes_file_id) {
      throw notFoundError('Phiên họp chưa có biên bản', 'file');
    }
    const context = await this.emulation.context(currentUser);
    const file = await context.database
      .selectFrom('files')
      .select(['file_name', 'content_type', 'storage_key'])
      .where('id', '=', detail.minutes_file_id)
      .executeTakeFirstOrThrow();
    return { file, body: await this.emulation.fileStorage.get(file.storage_key) };
  }

  // Công bố kết quả bình xét: báo người lập, mở hạn phúc khảo, khiếu nại tính từ hôm công bố
  async publish(currentUser: CurrentUser, campaignId: string) {
    const context = await this.emulation.context(currentUser);
    this.emulation.assertManage(context);
    const campaign = await this.emulation.campaign(context.database, campaignId);
    if (campaign.status !== 'launched' && campaign.status !== 'published') {
      throw emulationRule('Đợt thi đua chưa phát động hoặc đã kết thúc');
    }
    const voting = await context.database
      .selectFrom('emulation_meetings')
      .select('id')
      .where('campaign_id', '=', campaignId)
      .where('status', '=', 'voting')
      .executeTakeFirst();
    if (voting) {
      throw emulationRule('Còn phiên bỏ phiếu chưa đóng');
    }
    const decided = await context.database
      .selectFrom('emulation_nominations')
      .select(['id', 'owner_user_id', 'title_name', 'subject_name', 'status'])
      .where('campaign_id', '=', campaignId)
      .where('status', 'in', ['passed', 'failed'])
      .execute();
    if (decided.length === 0) {
      throw emulationRule('Chưa có hồ sơ nào được hội đồng bỏ phiếu');
    }
    const deadline = this.addDays(this.emulation.today(), campaign.appeal_days);
    await context.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('emulation_campaigns')
        .set({
          status: 'published',
          published_at: this.clock.now(),
          appeal_deadline: deadline,
          updated_at: this.clock.now(),
        })
        .where('id', '=', campaignId)
        .execute();
      for (const row of decided) {
        await queueNotification(transaction, {
          orgUnitId: null,
          templateCode: 'emulation',
          title: 'Kết quả bình xét thi đua',
          body: `${row.title_name} – ${row.subject_name}: ${EMULATION_NOMINATION_STATUS_LABELS[row.status]}; phúc khảo, khiếu nại đến hết ngày ${deadline}`,
          targetType: 'emulation_nomination',
          targetId: row.id,
          recipients: [{ userId: row.owner_user_id, channel: 'in_app' }],
        });
      }
    });
    return this.emulation.campaign(context.database, campaignId);
  }

  private addDays(date: string, days: number): string {
    return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  }

  // ---- Phúc khảo, khiếu nại ----

  async appeals(currentUser: CurrentUser, view: 'mine' | 'all', campaignId: string | null) {
    const context = await this.emulation.context(currentUser);
    let query = context.database
      .selectFrom('emulation_appeals as appeals')
      .innerJoin('emulation_campaigns as campaigns', 'campaigns.id', 'appeals.campaign_id')
      .leftJoin('emulation_nominations as nominations', 'nominations.id', 'appeals.nomination_id')
      .selectAll('appeals')
      .select([
        'campaigns.name as campaign_name',
        'nominations.subject_name',
        'nominations.title_name',
        'nominations.status as nomination_status',
      ])
      .orderBy('appeals.created_at', 'desc');
    if (campaignId) {
      query = query.where('appeals.campaign_id', '=', campaignId);
    }
    if (view !== 'all' || !(context.canManage || context.canDecide)) {
      query = query.where('appeals.submitted_by', '=', currentUser.id);
    }
    return query.limit(1000).execute();
  }

  // Trong hạn sau khi công bố; phúc khảo do người lập hoặc người, tổ được đề nghị gửi cho hồ sơ của mình
  async submitAppeal(currentUser: CurrentUser, input: AppealInput) {
    const context = await this.emulation.context(currentUser);
    const campaign = await this.emulation.campaign(context.database, input.campaign_id);
    if (campaign.status !== 'published' || !campaign.appeal_deadline) {
      throw emulationRule('Chỉ phúc khảo, khiếu nại sau khi công bố kết quả bình xét');
    }
    if (campaign.appeal_deadline < this.emulation.today()) {
      throw emulationRule(`Đã hết hạn phúc khảo, khiếu nại (${campaign.appeal_deadline})`);
    }
    if (input.nomination_id) {
      const row = await this.emulation.nomination(context.database, input.nomination_id);
      const own =
        row.owner_user_id === currentUser.id ||
        (row.staff_id !== null && row.staff_id === context.staff?.id) ||
        (row.department_id !== null && context.isLeader && row.department_id === context.staff?.department_id);
      if (row.campaign_id !== campaign.id || (input.kind === 'review' && !own)) {
        throw forbidden('Chỉ phúc khảo hồ sơ của mình trong đợt này');
      }
      if (input.kind === 'review' && !['passed', 'failed'].includes(row.status)) {
        throw emulationRule('Chỉ phúc khảo hồ sơ đã có kết quả bình xét, chưa đưa vào quyết định');
      }
      const pending = await context.database
        .selectFrom('emulation_appeals')
        .select('id')
        .where('nomination_id', '=', row.id)
        .where('status', '=', 'pending')
        .executeTakeFirst();
      if (pending) {
        throw emulationRule('Hồ sơ đang có phúc khảo, khiếu nại chờ giải quyết');
      }
    }
    return context.database
      .insertInto('emulation_appeals')
      .values({
        campaign_id: campaign.id,
        nomination_id: input.nomination_id,
        kind: input.kind,
        content: input.content,
        submitted_by: currentUser.id,
        submitted_by_name: currentUser.description.full_name,
        deadline: campaign.appeal_deadline,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  // Chấp nhận phúc khảo: hồ sơ về "đã tiếp nhận, chờ bình xét", xóa kết quả cũ để đưa ra phiên bỏ phiếu lại
  async resolveAppeal(currentUser: CurrentUser, id: string, accept: boolean, response: string) {
    const context = await this.emulation.context(currentUser);
    this.emulation.assertManage(context);
    const appeal = await context.database
      .selectFrom('emulation_appeals')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!appeal) {
      throw notFoundError('Không tìm thấy phúc khảo, khiếu nại', 'emulation_appeal');
    }
    if (appeal.status !== 'pending') {
      throw emulationRule('Đã giải quyết');
    }
    await context.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('emulation_appeals')
        .set({
          status: accept ? 'accepted' : 'rejected',
          response,
          resolved_by_name: currentUser.description.full_name,
          resolved_at: this.clock.now(),
        })
        .where('id', '=', id)
        .execute();
      if (accept && appeal.kind === 'review' && appeal.nomination_id) {
        const reopened = await transaction
          .updateTable('emulation_nominations')
          .set({
            status: 'accepted',
            meeting_id: null,
            agree_count: null,
            disagree_count: null,
            abstain_count: null,
            agree_percent: null,
            council_note: `Phúc khảo được chấp nhận: ${response}`.slice(0, 2000),
            updated_at: this.clock.now(),
          })
          .where('id', '=', appeal.nomination_id)
          .where('status', 'in', ['passed', 'failed'])
          .where('decision_id', 'is', null)
          .executeTakeFirst();
        if (Number(reopened.numUpdatedRows) !== 1) {
          throw emulationRule('Hồ sơ đã đưa vào quyết định, không bình xét lại được');
        }
      }
      await queueNotification(transaction, {
        orgUnitId: null,
        templateCode: 'emulation',
        title: `${EMULATION_APPEAL_KIND_LABELS[appeal.kind]}: ${accept ? 'chấp nhận' : 'không chấp nhận'}`,
        body: response,
        targetType: 'emulation_appeal',
        targetId: id,
        recipients: [{ userId: appeal.submitted_by, channel: 'in_app' }],
      });
    });
    return context.database.selectFrom('emulation_appeals').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
  }

  // ---- Quyết định khen thưởng, tờ trình đề nghị cấp trên ----

  private async decisionRow(database: Executor, id: string) {
    const row = await database.selectFrom('emulation_decisions').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy quyết định', 'emulation_decision');
    }
    return row;
  }

  private assertElevated(context: EmulationContext): void {
    if (!context.canManage && !context.canDecide) {
      throw forbidden('Chỉ người quản lý thi đua, người ban hành xem được quyết định');
    }
  }

  async decisions(currentUser: CurrentUser, campaignId: string | null) {
    const context = await this.emulation.context(currentUser);
    this.assertElevated(context);
    let query = context.database
      .selectFrom('emulation_decisions as decisions')
      .innerJoin('emulation_campaigns as campaigns', 'campaigns.id', 'decisions.campaign_id')
      .selectAll('decisions')
      .select('campaigns.name as campaign_name')
      .select((eb) =>
        eb
          .selectFrom('emulation_nominations')
          .select((count) => count.fn.countAll<string>().as('count'))
          .whereRef('emulation_nominations.decision_id', '=', 'decisions.id')
          .as('nomination_count'),
      )
      .orderBy('decisions.created_at', 'desc');
    if (campaignId) {
      query = query.where('decisions.campaign_id', '=', campaignId);
    }
    return (await query.execute()).map((row) => ({ ...row, nomination_count: Number(row.nomination_count ?? 0) }));
  }

  // Hồ sơ đưa vào quyết định: đã được hội đồng thông qua, chưa ở quyết định khác; danh hiệu cấp trường vào quyết định của
  // trường, danh hiệu đề nghị cấp trên vào tờ trình. Phúc khảo đang chờ thì chưa đưa vào
  private async checkDecisionNominations(
    database: Executor,
    campaign: CampaignRow,
    kind: 'decision' | 'proposal',
    ids: string[],
    decisionId: string | null,
  ) {
    const rows = await database
      .selectFrom('emulation_nominations as nominations')
      .innerJoin('emulation_titles as titles', 'titles.id', 'nominations.title_id')
      .select(['nominations.id', 'nominations.status', 'nominations.decision_id', 'titles.decision_level'])
      .where('nominations.id', 'in', ids)
      .where('nominations.campaign_id', '=', campaign.id)
      .execute();
    const level = kind === 'decision' ? 'school' : 'upper';
    const pending = await database
      .selectFrom('emulation_appeals')
      .select('nomination_id')
      .where('nomination_id', 'in', ids)
      .where('status', '=', 'pending')
      .execute();
    const bad = ids.findIndex((id) => {
      const row = rows.find((item) => item.id === id);
      return (
        !row ||
        row.status !== 'passed' ||
        (row.decision_id !== null && row.decision_id !== decisionId) ||
        row.decision_level !== level ||
        pending.some((item) => item.nomination_id === id)
      );
    });
    if (bad >= 0) {
      throw validationError([
        {
          field: `nomination_ids.${bad}`,
          message:
            kind === 'decision'
              ? 'Chọn hồ sơ được thông qua, danh hiệu do trường quyết định, chưa ở quyết định khác, không có phúc khảo chờ'
              : 'Chọn hồ sơ được thông qua, danh hiệu đề nghị cấp trên, chưa ở tờ trình khác, không có phúc khảo chờ',
        },
      ]);
    }
  }

  async createDecision(currentUser: CurrentUser, input: DecisionInput, origin: ChangeOrigin) {
    const context = await this.emulation.context(currentUser);
    this.emulation.assertManage(context);
    const campaign = await this.emulation.campaign(context.database, input.campaign_id);
    if (campaign.status !== 'published') {
      throw emulationRule('Lập quyết định sau khi công bố kết quả bình xét');
    }
    const id = await context.database.transaction().execute(async (transaction) => {
      await this.checkDecisionNominations(transaction, campaign, input.kind, input.nomination_ids, null);
      const created = await transaction
        .insertInto('emulation_decisions')
        .values({
          campaign_id: campaign.id,
          kind: input.kind,
          title: input.title,
          basis: input.basis,
          signer_name: input.signer_name,
          signer_title: input.signer_title,
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await transaction
        .updateTable('emulation_nominations')
        .set({ decision_id: created.id, updated_at: this.clock.now() })
        .where('id', 'in', input.nomination_ids)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'emulation_decisions',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { ...input },
      });
      return created.id;
    });
    return this.viewDecision(currentUser, id);
  }

  async updateDecision(currentUser: CurrentUser, id: string, input: DecisionInput, origin: ChangeOrigin) {
    const context = await this.emulation.context(currentUser);
    this.emulation.assertManage(context);
    const before = await this.decisionRow(context.database, id);
    if (before.status !== 'draft') {
      throw emulationRule('Quyết định đã ban hành, không sửa được');
    }
    const campaign = await this.emulation.campaign(context.database, before.campaign_id);
    await context.database.transaction().execute(async (transaction) => {
      await this.checkDecisionNominations(transaction, campaign, before.kind, input.nomination_ids, id);
      await transaction
        .updateTable('emulation_decisions')
        .set({
          title: input.title,
          basis: input.basis,
          signer_name: input.signer_name,
          signer_title: input.signer_title,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .execute();
      await transaction
        .updateTable('emulation_nominations')
        .set({ decision_id: null })
        .where('decision_id', '=', id)
        .execute();
      await transaction
        .updateTable('emulation_nominations')
        .set({ decision_id: id, updated_at: this.clock.now() })
        .where('id', 'in', input.nomination_ids)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'emulation_decisions',
        entityId: id,
        action: 'update',
        before,
        after: { ...input },
      });
    });
    return this.viewDecision(currentUser, id);
  }

  async deleteDecision(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.emulation.context(currentUser);
    this.emulation.assertManage(context);
    const before = await this.decisionRow(context.database, id);
    if (before.status !== 'draft') {
      throw emulationRule('Quyết định đã ban hành, không xóa được');
    }
    await context.database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('emulation_decisions').where('id', '=', id).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'emulation_decisions',
        entityId: id,
        action: 'delete',
        before,
        after: null,
      });
    });
  }

  private async decisionLines(database: Executor, id: string) {
    return database
      .selectFrom('emulation_nominations as nominations')
      .leftJoin('staff', 'staff.id', 'nominations.staff_id')
      .leftJoin('departments', 'departments.id', 'staff.department_id')
      .select([
        'nominations.id',
        'nominations.subject_name',
        'nominations.title_code',
        'nominations.title_name',
        'nominations.target',
        'nominations.status',
        'nominations.staff_id',
        'nominations.department_id',
        'nominations.agree_percent',
        'departments.name as department',
      ])
      .where('nominations.decision_id', '=', id)
      .orderBy('nominations.title_code')
      .orderBy('nominations.subject_name')
      .execute();
  }

  async viewDecision(currentUser: CurrentUser, id: string) {
    const context = await this.emulation.context(currentUser);
    this.assertElevated(context);
    const row = await this.decisionRow(context.database, id);
    const outgoing = row.outgoing_document_id
      ? await this.emulation.databases.system
          .selectFrom('outgoing_documents')
          .select(['id', 'status', 'symbol', 'issue_date', 'summary'])
          .where('id', '=', row.outgoing_document_id)
          .executeTakeFirst()
      : undefined;
    const awards = await context.database
      .selectFrom('emulation_awards')
      .select(['id', 'nomination_id', 'lookup_code', 'title_name', 'subject_name'])
      .where('decision_id', '=', id)
      .execute();
    return {
      ...row,
      lines: (await this.decisionLines(context.database, id)).map((line) => ({
        ...line,
        status_label: EMULATION_NOMINATION_STATUS_LABELS[line.status],
        award: awards.find((award) => award.nomination_id === line.id) ?? null,
      })),
      outgoing: outgoing ?? null,
      can_decide: context.canDecide,
    };
  }

  private async renderDecision(context: EmulationContext, id: string, format: 'pdf' | 'docx') {
    const row = await this.decisionRow(context.database, id);
    const lines = await this.decisionLines(context.database, id);
    const blocks = decisionBlocks({
      school: await this.emulation.schoolName(context.database),
      kind: row.kind,
      title: row.title,
      basis: row.basis,
      number: row.number,
      date: row.issue_date ?? this.clock.now(),
      signer_name: row.signer_name,
      signer_title: row.signer_title,
      rows: lines.map((line) => ({
        subject_name: line.subject_name,
        department: line.target === 'individual' ? line.department : null,
        title_name: line.title_name,
        target: line.target,
      })),
    });
    const title = row.title;
    const stem = `${row.kind === 'decision' ? 'quyet-dinh' : 'to-trinh'}-khen-thuong-${row.id.slice(0, 8)}`;
    return format === 'docx'
      ? { buffer: buildDocx(blocks, { title }), contentType: DOCX_TYPE, fileName: `${stem}.docx` }
      : { buffer: await buildDocumentPdf(blocks, { title }), contentType: PDF_TYPE, fileName: `${stem}.pdf` };
  }

  async decisionDocument(currentUser: CurrentUser, id: string, format: 'pdf' | 'docx') {
    const context = await this.emulation.context(currentUser);
    this.assertElevated(context);
    return this.renderDecision(context, id, format);
  }

  // Tạo dự thảo văn bản đi (18b) kèm tệp Word của quyết định; trình ký, cấp số, phát hành làm ở phân hệ văn bản đi
  async createOutgoing(currentUser: CurrentUser, id: string) {
    const context = await this.emulation.context(currentUser);
    this.emulation.assertManage(context);
    if (!currentUser.hasPermission(PERMISSION_CODES.outgoingDocumentDraft)) {
      throw forbidden('Cần quyền soạn văn bản đi (Văn bản đi) để tạo dự thảo');
    }
    const row = await this.decisionRow(context.database, id);
    if (row.outgoing_document_id) {
      throw emulationRule('Quyết định đã có dự thảo văn bản đi');
    }
    const form = await this.emulation.databases.system
      .selectFrom('document_catalog_items')
      .select('id')
      .where('kind', '=', 'form')
      .where('active', '=', true)
      .where('name', 'ilike', row.kind === 'decision' ? 'quyết định%' : 'tờ trình%')
      .orderBy('sort_order')
      .executeTakeFirst();
    const document = await this.outgoing.create(
      currentUser,
      {
        submission_number: null,
        summary: row.title.slice(0, 500),
        form_id: form?.id ?? null,
        urgency_id: null,
        secrecy_id: null,
        field_id: null,
        document_kind: 'new',
        priority: false,
        meeting_at: null,
        meeting_place: null,
        insert_qr: true,
        drafter_id: null,
        drafting_unit_id: null,
        signer_id: null,
        content_note: 'Tạo từ phân hệ Thi đua, khen thưởng',
        reply_to_id: null,
      },
      undefined,
      undefined,
    );
    const file = await this.renderDecision(context, id, 'docx');
    await this.outgoing.addFile(currentUser, document.id, {
      fileName: file.fileName,
      body: file.buffer,
      kind: 'draft',
    });
    await context.database
      .updateTable('emulation_decisions')
      .set({ outgoing_document_id: document.id, updated_at: this.clock.now() })
      .where('id', '=', id)
      .execute();
    return this.viewDecision(currentUser, id);
  }

  // Ban hành: số, ngày lấy từ văn bản đi đã phát hành nếu có, không thì nhập tay. Quyết định của trường ghi sổ khen thưởng
  // (mã tra cứu); tờ trình chuyển hồ sơ sang "đã trình cấp trên"
  async issueDecision(
    currentUser: CurrentUser,
    id: string,
    input: { number: string | null; issue_date: string | null },
    origin: ChangeOrigin,
  ) {
    const context = await this.emulation.context(currentUser);
    if (!context.canDecide) {
      throw forbidden('Chỉ Hiệu trưởng ban hành quyết định khen thưởng');
    }
    const row = await this.decisionRow(context.database, id);
    if (row.status !== 'draft') {
      throw emulationRule('Quyết định đã ban hành');
    }
    let number = input.number;
    let issueDate = input.issue_date;
    if (row.outgoing_document_id) {
      const outgoing = await this.emulation.databases.system
        .selectFrom('outgoing_documents')
        .select(['status', 'symbol', 'issue_date'])
        .where('id', '=', row.outgoing_document_id)
        .executeTakeFirst();
      if (outgoing?.status === 'issued' && outgoing.symbol && outgoing.issue_date) {
        number = outgoing.symbol;
        issueDate = String(outgoing.issue_date).slice(0, 10);
      }
    }
    if (!number || !issueDate) {
      throw validationError([
        { field: 'number', message: 'Nhập số, ký hiệu và ngày ban hành (hoặc phát hành văn bản đi trước)' },
      ]);
    }
    const lines = await this.decisionLines(context.database, id);
    if (lines.length === 0) {
      throw emulationRule('Quyết định chưa có hồ sơ nào');
    }
    const school = await this.emulation.schoolName(context.database);
    await context.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('emulation_decisions')
        .set({
          status: 'issued',
          number,
          issue_date: issueDate,
          issued_at: this.clock.now(),
          issued_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .where('status', '=', 'draft')
        .execute();
      await transaction
        .updateTable('emulation_nominations')
        .set({ status: row.kind === 'decision' ? 'awarded' : 'proposed', updated_at: this.clock.now() })
        .where('decision_id', '=', id)
        .execute();
      if (row.kind === 'decision') {
        await this.recordAwards(transaction, context, currentUser, id, lines, {
          number,
          date: issueDate,
          issuer: school,
        });
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'emulation_decisions',
        entityId: id,
        action: 'update',
        before: row,
        after: { status: 'issued', number, issue_date: issueDate },
      });
      for (const line of lines) {
        const nomination = await this.emulation.nomination(transaction, line.id);
        await queueNotification(transaction, {
          orgUnitId: nomination.org_unit_id,
          templateCode: 'emulation',
          title: row.kind === 'decision' ? 'Quyết định khen thưởng' : 'Đã trình cấp trên khen thưởng',
          body: `${line.title_name} – ${line.subject_name}, số ${number}`,
          targetType: 'emulation_nomination',
          targetId: line.id,
          recipients: [{ userId: nomination.owner_user_id, channel: 'in_app' }],
        });
      }
    });
    return this.viewDecision(currentUser, id);
  }

  private async recordAwards(
    transaction: Executor,
    context: EmulationContext,
    currentUser: CurrentUser,
    decisionId: string,
    lines: Awaited<ReturnType<EmulationCouncilService['decisionLines']>>,
    decision: { number: string; date: string; issuer: string },
  ) {
    const titles = await transaction.selectFrom('emulation_titles').select(['code', 'kind']).execute();
    for (const line of lines) {
      await transaction
        .insertInto('emulation_awards')
        .values({
          source: 'decision',
          decision_id: decisionId,
          nomination_id: line.id,
          year_name: context.yearName,
          year_start: context.yearStart,
          title_code: line.title_code,
          title_name: line.title_name,
          title_kind: titles.find((title) => title.code === line.title_code)?.kind ?? 'title',
          target: line.target,
          staff_id: line.staff_id,
          department_id: line.department_id,
          subject_name: line.subject_name,
          decision_number: decision.number,
          decision_date: decision.date,
          issuer: decision.issuer,
          lookup_code: verificationCode(),
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })
        .execute();
    }
  }

  // Kết quả của cấp trên cho tờ trình: hồ sơ được khen ghi sổ khen thưởng, hồ sơ còn lại là cấp trên không khen
  async upperResult(
    currentUser: CurrentUser,
    id: string,
    input: { number: string; date: string; issuer: string; awarded_ids: string[] },
  ) {
    const context = await this.emulation.context(currentUser);
    this.emulation.assertManage(context);
    const row = await this.decisionRow(context.database, id);
    if (row.kind !== 'proposal' || row.status !== 'issued') {
      throw emulationRule('Chỉ ghi kết quả cấp trên cho tờ trình đã ban hành');
    }
    if (row.upper_number) {
      throw emulationRule('Đã ghi kết quả của cấp trên');
    }
    const lines = await this.decisionLines(context.database, id);
    const invalid = input.awarded_ids.findIndex((value) => !lines.some((line) => line.id === value));
    if (invalid >= 0) {
      throw validationError([{ field: `awarded_ids.${invalid}`, message: 'Hồ sơ không thuộc tờ trình này' }]);
    }
    await context.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('emulation_decisions')
        .set({
          upper_number: input.number,
          upper_date: input.date,
          upper_issuer: input.issuer,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .execute();
      const awarded = lines.filter((line) => input.awarded_ids.includes(line.id));
      if (awarded.length > 0) {
        await transaction
          .updateTable('emulation_nominations')
          .set({ status: 'awarded', updated_at: this.clock.now() })
          .where('id', 'in', input.awarded_ids)
          .execute();
      }
      const rest = lines.filter((line) => !input.awarded_ids.includes(line.id)).map((line) => line.id);
      if (rest.length > 0) {
        await transaction
          .updateTable('emulation_nominations')
          .set({ status: 'not_awarded', updated_at: this.clock.now() })
          .where('id', 'in', rest)
          .execute();
      }
      await this.recordAwards(transaction, context, currentUser, id, awarded, {
        number: input.number,
        date: input.date,
        issuer: input.issuer,
      });
    });
    return this.viewDecision(currentUser, id);
  }

  // ---- Giấy khen, tra cứu công khai ----

  private async award(database: Executor, id: string) {
    const row = await database.selectFrom('emulation_awards').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy khen thưởng', 'emulation_award');
    }
    return row;
  }

  // Người quản lý, người ban hành, người được khen (hoặc tổ trưởng của tổ được khen) tải được giấy khen
  async certificate(currentUser: CurrentUser, id: string, origin: string | null) {
    const context = await this.emulation.context(currentUser);
    const row = await this.award(context.database, id);
    const own =
      (row.staff_id !== null && row.staff_id === context.staff?.id) ||
      (row.department_id !== null && context.isLeader && row.department_id === context.staff?.department_id);
    if (!own && !context.canManage && !context.canDecide) {
      throw notFoundError('Không tìm thấy khen thưởng', 'emulation_award');
    }
    const department = row.staff_id
      ? await context.database
          .selectFrom('staff')
          .leftJoin('departments', 'departments.id', 'staff.department_id')
          .select('departments.name')
          .where('staff.id', '=', row.staff_id)
          .executeTakeFirst()
      : undefined;
    const school = await this.emulation.schoolName(context.database);
    const buffer = await certificatePdf({
      school,
      title_name: row.title_name,
      kind_label: row.title_kind === 'award' ? 'Giấy khen' : 'Giấy chứng nhận',
      subject_name: row.subject_name,
      department: department?.name ?? null,
      year_name: row.year_name,
      decision_number: row.decision_number,
      decision_date: row.decision_date,
      issuer: row.issuer,
      lookup_code: row.lookup_code,
      verification_text: awardVerificationText(row.lookup_code, origin),
    });
    return { buffer, contentType: PDF_TYPE, fileName: `giay-khen-${row.lookup_code}.pdf` };
  }

  // Tra cứu công khai theo mã in trên giấy khen: chỉ tên người, tổ được khen, danh hiệu, năm học, số và ngày quyết định
  async verify(code: string) {
    const current = await this.emulation.currentSchoolYear.find();
    const years = await this.emulation.databases.system
      .selectFrom('academic_years')
      .innerJoin('academic_year_databases', 'academic_year_databases.academic_year_id', 'academic_years.id')
      .select('academic_year_databases.database_name')
      .orderBy('academic_years.start_date', 'desc')
      .execute();
    for (const year of years) {
      const database = this.emulation.databases.schoolYear<SchoolYearDatabase>(year.database_name);
      try {
        const row = await database
          .selectFrom('emulation_awards')
          .select([
            'subject_name',
            'title_name',
            'title_kind',
            'target',
            'year_name',
            'decision_number',
            'decision_date',
            'issuer',
          ])
          .where('lookup_code', '=', code)
          .executeTakeFirst();
        if (row) {
          return {
            code,
            school_name: await this.emulation.schoolName(current?.database ?? database),
            ...row,
            target_label: EMULATION_TARGET_LABELS[row.target],
            kind_label: EMULATION_KIND_LABELS[row.title_kind],
          };
        }
      } catch {
        // Năm học cũ chưa có bảng khen thưởng thì bỏ qua
      }
    }
    throw notFoundError('Không tìm thấy khen thưởng có mã tra cứu này', 'emulation_award');
  }

  // ---- Sổ theo dõi khen thưởng nhiều năm ----

  // Mọi năm học: khen thưởng từ quyết định và khen thưởng nhập tay các năm trước. Người không quản lý chỉ xem của mình, của
  // tổ mình (tổ trưởng)
  async history(
    currentUser: CurrentUser,
    filter: {
      q: string | null;
      target: 'individual' | 'collective' | null;
      title_code: string | null;
      staff_id: string | null;
    },
  ) {
    const context = await this.emulation.context(currentUser);
    const elevated = context.canManage || context.canDecide;
    const years = await this.emulation.databases.system
      .selectFrom('academic_years')
      .innerJoin('academic_year_databases', 'academic_year_databases.academic_year_id', 'academic_years.id')
      .select(['academic_years.name', 'academic_year_databases.database_name'])
      .orderBy('academic_years.start_date', 'desc')
      .execute();
    const currentName = (await this.emulation.currentSchoolYear.require()).databaseName;
    const rows: Array<Record<string, unknown> & { year_start: number; subject_name: string }> = [];
    for (const year of years) {
      const database = this.emulation.databases.schoolYear<SchoolYearDatabase>(year.database_name);
      try {
        let query = database
          .selectFrom('emulation_awards as awards')
          .leftJoin('departments', 'departments.id', 'awards.department_id')
          .leftJoin('staff', 'staff.id', 'awards.staff_id')
          .leftJoin('departments as staff_departments', 'staff_departments.id', 'staff.department_id')
          .select([
            'awards.id',
            'awards.source',
            'awards.year_name',
            'awards.year_start',
            'awards.title_code',
            'awards.title_name',
            'awards.title_kind',
            'awards.target',
            'awards.staff_id',
            'awards.department_id',
            'awards.subject_name',
            'awards.decision_number',
            'awards.decision_date',
            'awards.issuer',
            'awards.lookup_code',
            'awards.note',
            'staff.code as staff_code',
            'staff_departments.name as staff_department',
            'departments.name as department_name',
          ]);
        if (filter.target) {
          query = query.where('awards.target', '=', filter.target);
        }
        if (filter.title_code) {
          query = query.where('awards.title_code', '=', filter.title_code);
        }
        if (filter.staff_id) {
          query = query.where('awards.staff_id', '=', filter.staff_id);
        }
        if (filter.q) {
          query = query.where('awards.subject_name', 'ilike', `%${filter.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
        }
        if (!elevated) {
          const staffId = context.staff?.id ?? null;
          const departmentId = context.isLeader ? (context.staff?.department_id ?? null) : null;
          if (!staffId && !departmentId) {
            return [];
          }
          query = query.where((eb) =>
            eb.or([
              ...(staffId ? [eb('awards.staff_id', '=', staffId)] : []),
              ...(departmentId ? [eb('awards.department_id', '=', departmentId)] : []),
            ]),
          );
        }
        const found = await query.limit(5000).execute();
        rows.push(
          ...found.map((row) => ({
            ...row,
            editable: row.source === 'manual' && year.database_name === currentName && context.canManage,
          })),
        );
      } catch {
        // Năm học cũ chưa có bảng khen thưởng thì bỏ qua
      }
    }
    rows.sort(
      (left, right) => right.year_start - left.year_start || left.subject_name.localeCompare(right.subject_name, 'vi'),
    );
    return rows;
  }

  async historyFile(
    currentUser: CurrentUser,
    filter: Parameters<EmulationCouncilService['history']>[1],
    format: TableFileFormat,
  ) {
    const rows = await this.history(currentUser, filter);
    const buffer = await buildTableFile(
      format,
      [
        {
          title: 'Sổ theo dõi khen thưởng',
          columns: [
            { key: 'year_name', label: 'Năm học', width: 12 },
            { key: 'subject_name', label: 'Cá nhân, tập thể', width: 28 },
            { key: 'unit', label: 'Tổ, bộ phận', width: 20 },
            { key: 'title_name', label: 'Danh hiệu, hình thức', width: 32 },
            { key: 'decision_number', label: 'Số quyết định', width: 16 },
            { key: 'decision_date', label: 'Ngày', width: 12 },
            { key: 'issuer', label: 'Cấp khen', width: 24 },
            { key: 'lookup_code', label: 'Mã tra cứu', width: 16 },
          ],
          rows: rows.map((row) => ({
            ...row,
            unit: (row.staff_department ?? row.department_name ?? '') as string,
          })),
          numbered: true,
        },
      ],
      this.clock.now(),
    );
    return { buffer, contentType: CONTENT_TYPES[format], fileName: `so-theo-doi-khen-thuong.${format}` };
  }

  // Khen thưởng các năm trước (trước khi dùng phần mềm, hoặc của cấp trên) nhập tay vào năm học hiện tại để xét danh hiệu cần
  // nhiều năm liên tục
  async addManualAward(currentUser: CurrentUser, input: ManualAwardInput, origin: ChangeOrigin) {
    const context = await this.emulation.context(currentUser);
    this.emulation.assertManage(context);
    if (input.year_start > context.yearStart) {
      throw validationError([{ field: 'year_name', message: 'Không nhập khen thưởng của năm học sau năm hiện tại' }]);
    }
    const subject = input.staff_id
      ? await context.database
          .selectFrom('staff')
          .select(['id', 'full_name as name'])
          .where('id', '=', input.staff_id)
          .executeTakeFirst()
      : await context.database
          .selectFrom('departments')
          .select(['id', 'name'])
          .where('id', '=', input.department_id ?? '')
          .executeTakeFirst();
    if (!subject) {
      throw validationError([
        { field: input.staff_id ? 'staff_id' : 'department_id', message: 'Không có nhân sự, tổ này' },
      ]);
    }
    return context.database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('emulation_awards')
        .values({
          source: 'manual',
          ...input,
          subject_name: subject.name,
          lookup_code: verificationCode(),
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'emulation_awards',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async deleteManualAward(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.emulation.context(currentUser);
    this.emulation.assertManage(context);
    const row = await this.award(context.database, id);
    if (row.source !== 'manual') {
      throw emulationRule('Chỉ xóa khen thưởng nhập tay; khen thưởng theo quyết định giữ ở sổ');
    }
    await context.database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('emulation_awards').where('id', '=', id).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'emulation_awards',
        entityId: id,
        action: 'delete',
        before: row,
        after: null,
      });
    });
  }

  // ---- Báo cáo đợt thi đua ----

  async report(currentUser: CurrentUser, campaignId: string) {
    const context = await this.emulation.context(currentUser);
    this.assertElevated(context);
    const campaign = await this.emulation.campaign(context.database, campaignId);
    const titles = await context.database
      .selectFrom('emulation_titles')
      .select(['id', 'code', 'name', 'target'])
      .where('id', 'in', campaign.title_ids.length > 0 ? campaign.title_ids : ['00000000-0000-0000-0000-000000000000'])
      .orderBy('sort_order')
      .execute();
    const registrations = await context.database
      .selectFrom('emulation_registrations')
      .select(['title_id', 'status'])
      .where('campaign_id', '=', campaignId)
      .execute();
    const nominations = await context.database
      .selectFrom('emulation_nominations')
      .select(['title_id', 'status'])
      .where('campaign_id', '=', campaignId)
      .execute();
    const count = <Row extends { title_id: string; status: string }>(
      rows: Row[],
      titleId: string,
      statuses?: string[],
    ) => rows.filter((row) => row.title_id === titleId && (!statuses || statuses.includes(row.status))).length;
    const byTitle = titles.map((title) => ({
      title_id: title.id,
      code: title.code,
      name: title.name,
      target_label: EMULATION_TARGET_LABELS[title.target],
      registered: count(registrations, title.id),
      registration_accepted: count(registrations, title.id, ['accepted']),
      nominated: count(nominations, title.id, ['submitted', 'accepted', 'passed', 'failed', ...DECIDED]),
      passed: count(nominations, title.id, ['passed', ...DECIDED]),
      failed: count(nominations, title.id, ['failed']),
      awarded: count(nominations, title.id, ['awarded']),
    }));
    const appeals = await context.database
      .selectFrom('emulation_appeals')
      .select(['status'])
      .where('campaign_id', '=', campaignId)
      .execute();
    const staffCount = await context.database
      .selectFrom('staff')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();
    return {
      campaign,
      staff_count: Number(staffCount.count),
      by_title: byTitle,
      appeals: {
        total: appeals.length,
        pending: appeals.filter((row) => row.status === 'pending').length,
        accepted: appeals.filter((row) => row.status === 'accepted').length,
        rejected: appeals.filter((row) => row.status === 'rejected').length,
      },
    };
  }

  async reportFile(currentUser: CurrentUser, campaignId: string, format: TableFileFormat) {
    const data = await this.report(currentUser, campaignId);
    const buffer = await buildTableFile(
      format,
      [
        {
          title: 'Kết quả thi đua, khen thưởng theo danh hiệu',
          heading: [data.campaign.name, `Số cán bộ, giáo viên, nhân viên đang làm việc: ${data.staff_count}`],
          columns: [
            { key: 'name', label: 'Danh hiệu, hình thức', width: 34 },
            { key: 'target_label', label: 'Đối tượng', width: 12 },
            { key: 'registered', label: 'Đăng ký', width: 10 },
            { key: 'registration_accepted', label: 'Đăng ký được duyệt', width: 12 },
            { key: 'nominated', label: 'Hồ sơ đề nghị', width: 12 },
            { key: 'passed', label: 'Hội đồng thông qua', width: 12 },
            { key: 'failed', label: 'Không thông qua', width: 12 },
            { key: 'awarded', label: 'Đã khen thưởng', width: 12 },
          ],
          rows: data.by_title,
          numbered: true,
        },
      ],
      this.clock.now(),
    );
    return { buffer, contentType: CONTENT_TYPES[format], fileName: `bao-cao-thi-dua-${data.campaign.code}.${format}` };
  }

  // ---- Nguồn cho Việc của tôi ----

  async pendingWork(currentUser: CurrentUser) {
    const current = await this.emulation.currentSchoolYear.find();
    const empty = { review: [], registrations: [], appeals: [], voting: [], returned: [] };
    if (!current) {
      return empty;
    }
    const database = current.database as Kysely<SchoolYearDatabase>;
    const manage = currentUser.hasPermission(PERMISSION_CODES.emulationManage);
    const review = manage
      ? await database
          .selectFrom('emulation_nominations')
          .select(['id', 'title_name', 'subject_name', 'submitted_at'])
          .where('status', '=', 'submitted')
          .orderBy('submitted_at')
          .limit(100)
          .execute()
      : [];
    const registrations = manage
      ? await database
          .selectFrom('emulation_registrations as registrations')
          .innerJoin('emulation_titles as titles', 'titles.id', 'registrations.title_id')
          .select([
            'registrations.id',
            'registrations.subject_name',
            'titles.name as title_name',
            'registrations.created_at',
          ])
          .where('registrations.status', '=', 'pending')
          .orderBy('registrations.created_at')
          .limit(100)
          .execute()
      : [];
    const appeals = manage
      ? await database
          .selectFrom('emulation_appeals')
          .select(['id', 'kind', 'submitted_by_name', 'deadline', 'created_at'])
          .where('status', '=', 'pending')
          .orderBy('created_at')
          .limit(100)
          .execute()
      : [];
    // Phiên đang bỏ phiếu mà tôi là thành viên và còn hồ sơ chưa bỏ phiếu
    const voting = await database
      .selectFrom('emulation_meetings as meetings')
      .innerJoin('emulation_council_members as members', 'members.campaign_id', 'meetings.campaign_id')
      .innerJoin('emulation_campaigns as campaigns', 'campaigns.id', 'meetings.campaign_id')
      .select(['meetings.id', 'meetings.held_at', 'campaigns.name as campaign_name'])
      .select((eb) =>
        eb
          .selectFrom('emulation_nominations as nominations')
          .select((count) => count.fn.countAll<string>().as('count'))
          .whereRef('nominations.meeting_id', '=', 'meetings.id')
          .where((inner) =>
            inner.not(
              inner.exists(
                inner
                  .selectFrom('emulation_votes as votes')
                  .select('votes.nomination_id')
                  .whereRef('votes.nomination_id', '=', 'nominations.id')
                  .whereRef('votes.meeting_id', '=', 'meetings.id')
                  .where('votes.member_user_id', '=', currentUser.id),
              ),
            ),
          )
          .as('missing'),
      )
      .where('members.user_id', '=', currentUser.id)
      .where('meetings.status', '=', 'voting')
      .execute();
    const returned = await database
      .selectFrom('emulation_nominations')
      .select(['id', 'title_name', 'subject_name', 'return_note', 'updated_at'])
      .where('owner_user_id', '=', currentUser.id)
      .where('status', '=', 'returned')
      .limit(100)
      .execute();
    return {
      review,
      registrations,
      appeals,
      voting: voting
        .filter((row) => Number(row.missing ?? 0) > 0)
        .map((row) => ({ ...row, missing: Number(row.missing) })),
      returned,
    };
  }
}
