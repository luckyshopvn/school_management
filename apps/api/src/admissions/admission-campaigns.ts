import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { AdmissionCampaignStatus, AdmissionPostStatus } from '@school-management/database';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { sql } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  isUuid,
  notFoundError,
  readInteger,
  readRequiredInteger,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { ADMISSION_PERMISSIONS, AdmissionAccess } from './admission-access.js';
import { readDate, readText } from './admission-fields.js';

// Đợt tuyển sinh và tin tuyển sinh (P16-01, P16-05; G3-01, G3-07; BR-01, BR-69; YCTD-86). Đợt lập ở trạng thái nháp,
// mở thì nhận hồ sơ trực tuyến trong thời gian nhận hồ sơ, đóng thì thôi nhận; chỉ tiêu không nhỏ hơn số hồ sơ đã đạt.
// Tin tuyển sinh gắn với một đợt, phạm vi công bố theo đơn vị của đợt (BR-69); công bố khi đợt chưa đóng; thời hạn
// hiển thị mặc định là hạn nhận hồ sơ của đợt
const CAMPAIGN_STATUSES: AdmissionCampaignStatus[] = ['draft', 'open', 'closed'];
const MAXIMUM_QUOTA = 10_000;

interface CampaignInput {
  org_unit_id: string;
  name: string;
  description: string | null;
  quota: number;
  open_from: string;
  open_to: string;
}

interface PostInput {
  campaign_id: string;
  title: string;
  content: string;
  publish_from: string;
  publish_to: string | null;
}

@Injectable()
export class AdmissionCampaignsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: AdmissionAccess,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  async list(currentUser: CurrentUser, filter: { orgUnitId: string | null; status: AdmissionCampaignStatus | null }) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    const scope = await this.access.viewScope(currentUser);
    let query = current.database
      .selectFrom('admission_campaigns')
      .innerJoin('org_units', 'org_units.id', 'admission_campaigns.org_unit_id')
      .selectAll('admission_campaigns')
      .select('org_units.name as org_unit_name')
      .select((expression) => [
        expression
          .selectFrom('admission_applications')
          .select(sql<number>`count(*)::int`.as('count'))
          .whereRef('admission_applications.campaign_id', '=', 'admission_campaigns.id')
          .as('application_count'),
        expression
          .selectFrom('admission_applications')
          .select(sql<number>`count(*)::int`.as('count'))
          .whereRef('admission_applications.campaign_id', '=', 'admission_campaigns.id')
          .where('admission_applications.status', 'in', ['passed', 'converted'])
          .as('passed_count'),
        expression
          .selectFrom('admission_applications')
          .select(sql<number>`count(*)::int`.as('count'))
          .whereRef('admission_applications.campaign_id', '=', 'admission_campaigns.id')
          .where('admission_applications.status', '=', 'converted')
          .as('converted_count'),
      ])
      .orderBy('admission_campaigns.open_from', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('admission_campaigns.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.orgUnitId) {
      query = query.where('admission_campaigns.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.status) {
      query = query.where('admission_campaigns.status', '=', filter.status);
    }
    return query.execute();
  }

  async create(currentUser: CurrentUser, input: CampaignInput, origin: ChangeOrigin) {
    await this.access.assertCan(currentUser, PERMISSION_CODES.admissionCampaignManage, input.org_unit_id);
    const { database } = await this.currentSchoolYear.require();
    const unit = await database
      .selectFrom('org_units')
      .select('status')
      .where('id', '=', input.org_unit_id)
      .executeTakeFirst();
    if (!unit || unit.status !== 'active') {
      throw validationError([{ field: 'org_unit_id', message: 'Đơn vị không có hoặc đã ngừng sử dụng' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('admission_campaigns')
        .values({ ...input, created_by: origin.actorUserId })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: created.org_unit_id,
        entityName: 'admission_campaigns',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async update(currentUser: CurrentUser, campaignId: string, changes: Partial<CampaignInput>, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const campaign = await this.access.findCampaign(database, campaignId);
    await this.access.assertCan(currentUser, PERMISSION_CODES.admissionCampaignManage, campaign.org_unit_id);
    if (campaign.status === 'closed') {
      throw ruleViolationError('P16-01', 'Đợt tuyển sinh đã đóng, không sửa được');
    }
    const openFrom = changes.open_from ?? campaign.open_from;
    const openTo = changes.open_to ?? campaign.open_to;
    if (openTo < openFrom) {
      throw validationError([{ field: 'open_to', message: 'Hạn nhận hồ sơ không trước ngày bắt đầu' }]);
    }
    if (changes.quota !== undefined) {
      const passed = await this.passedCount(campaignId);
      if (changes.quota < passed) {
        throw ruleViolationError('P16-01', `Chỉ tiêu không nhỏ hơn số hồ sơ đã đạt (${passed})`);
      }
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('admission_campaigns')
        .set({
          name: changes.name,
          description: changes.description,
          quota: changes.quota,
          open_from: changes.open_from,
          open_to: changes.open_to,
          updated_at: this.clock.now(),
        })
        .where('id', '=', campaignId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: campaign.org_unit_id,
        entityName: 'admission_campaigns',
        entityId: campaignId,
        action: 'update',
        before: campaign,
        after: updated,
      });
      return updated;
    });
  }

  // Mở đợt: hạn nhận hồ sơ chưa qua; đóng đợt: thôi nhận hồ sơ trực tuyến, hồ sơ đã nhận vẫn xét và chuyển được
  async changeStatus(currentUser: CurrentUser, campaignId: string, target: 'open' | 'closed', origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const campaign = await this.access.findCampaign(database, campaignId);
    await this.access.assertCan(currentUser, PERMISSION_CODES.admissionCampaignManage, campaign.org_unit_id);
    if (target === 'open') {
      if (campaign.status !== 'draft') {
        throw ruleViolationError('P16-01', 'Chỉ mở được đợt tuyển sinh ở trạng thái nháp');
      }
      if (campaign.open_to < this.today()) {
        throw ruleViolationError('P16-01', 'Hạn nhận hồ sơ đã qua, sửa thời gian trước khi mở đợt');
      }
    } else if (campaign.status !== 'open') {
      throw ruleViolationError('P16-01', 'Chỉ đóng được đợt tuyển sinh đang mở');
    }
    const now = this.clock.now();
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('admission_campaigns')
        .set(
          target === 'open'
            ? { status: 'open', opened_at: now, updated_at: now }
            : { status: 'closed', closed_at: now, updated_at: now },
        )
        .where('id', '=', campaignId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: campaign.org_unit_id,
        entityName: 'admission_campaigns',
        entityId: campaignId,
        action: 'update',
        before: { status: campaign.status },
        after: { status: target },
      });
      return updated;
    });
  }

  async passedCount(campaignId: string): Promise<number> {
    const { database } = await this.currentSchoolYear.require();
    const row = await database
      .selectFrom('admission_applications')
      .select(sql<number>`count(*)::int`.as('count'))
      .where('campaign_id', '=', campaignId)
      .where('status', 'in', ['passed', 'converted'])
      .executeTakeFirstOrThrow();
    return row.count;
  }

  // Tin tuyển sinh (P16-05)
  async listPosts(currentUser: CurrentUser, campaignId: string | null) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    const scope = await this.access.viewScope(currentUser);
    let query = current.database
      .selectFrom('admission_posts')
      .innerJoin('admission_campaigns', 'admission_campaigns.id', 'admission_posts.campaign_id')
      .selectAll('admission_posts')
      .select([
        'admission_campaigns.name as campaign_name',
        'admission_campaigns.org_unit_id',
        'admission_campaigns.open_to as application_deadline',
      ])
      .orderBy('admission_posts.publish_from', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('admission_campaigns.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (campaignId) {
      query = query.where('admission_posts.campaign_id', '=', campaignId);
    }
    return query.execute();
  }

  async createPost(currentUser: CurrentUser, input: PostInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const campaign = await this.access.findCampaign(database, input.campaign_id);
    await this.access.assertCan(currentUser, PERMISSION_CODES.admissionPostManage, campaign.org_unit_id);
    if (campaign.status === 'closed') {
      throw ruleViolationError('P16-05', 'Đợt tuyển sinh đã đóng, không lập tin được');
    }
    const publishTo = input.publish_to ?? campaign.open_to;
    if (publishTo < input.publish_from) {
      throw validationError([{ field: 'publish_to', message: 'Thời hạn không trước ngày bắt đầu đăng' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('admission_posts')
        .values({ ...input, publish_to: publishTo, created_by: origin.actorUserId })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: campaign.org_unit_id,
        entityName: 'admission_posts',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async updatePost(
    currentUser: CurrentUser,
    postId: string,
    changes: Partial<Omit<PostInput, 'campaign_id'>>,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const post = await this.findPost(postId);
    const campaign = await this.access.findCampaign(database, post.campaign_id);
    await this.access.assertCan(currentUser, PERMISSION_CODES.admissionPostManage, campaign.org_unit_id);
    const publishFrom = changes.publish_from ?? post.publish_from;
    const publishTo = changes.publish_to === undefined ? post.publish_to : (changes.publish_to ?? campaign.open_to);
    if (publishTo && publishTo < publishFrom) {
      throw validationError([{ field: 'publish_to', message: 'Thời hạn không trước ngày bắt đầu đăng' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('admission_posts')
        .set({
          title: changes.title,
          content: changes.content,
          publish_from: changes.publish_from,
          publish_to: publishTo,
          updated_at: this.clock.now(),
        })
        .where('id', '=', postId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: campaign.org_unit_id,
        entityName: 'admission_posts',
        entityId: postId,
        action: 'update',
        before: post,
        after: updated,
      });
      return updated;
    });
  }

  // Công bố khi đợt chưa đóng; ẩn tin đã công bố kèm lý do
  async changePostStatus(
    currentUser: CurrentUser,
    postId: string,
    target: Extract<AdmissionPostStatus, 'published' | 'hidden'>,
    reason: string | null,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const post = await this.findPost(postId);
    const campaign = await this.access.findCampaign(database, post.campaign_id);
    await this.access.assertCan(currentUser, PERMISSION_CODES.admissionPostManage, campaign.org_unit_id);
    if (target === 'published') {
      if (post.status === 'published') {
        throw ruleViolationError('P16-05', 'Tin đã được công bố');
      }
      if (campaign.status === 'closed') {
        throw ruleViolationError('P16-05', 'Đợt tuyển sinh đã đóng, không công bố tin được');
      }
    } else if (post.status !== 'published') {
      throw ruleViolationError('P16-05', 'Chỉ ẩn được tin đang công bố');
    }
    const now = this.clock.now();
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('admission_posts')
        .set(
          target === 'published'
            ? { status: 'published', published_at: now, hidden_reason: null, updated_at: now }
            : { status: 'hidden', hidden_reason: reason, updated_at: now },
        )
        .where('id', '=', postId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: campaign.org_unit_id,
        entityName: 'admission_posts',
        entityId: postId,
        action: 'update',
        before: { status: post.status },
        after: { status: target, hidden_reason: reason },
      });
      return updated;
    });
  }

  private async findPost(postId: string) {
    const { database } = await this.currentSchoolYear.require();
    const post = await database.selectFrom('admission_posts').selectAll().where('id', '=', postId).executeTakeFirst();
    if (!post) {
      throw notFoundError('Không tìm thấy tin tuyển sinh', 'admission_post');
    }
    return post;
  }
}

function readCampaign(body: RequestBody, partial: boolean): Partial<CampaignInput> {
  const errors: FieldError[] = [];
  const result: Partial<CampaignInput> = {};
  if (!partial) {
    result.org_unit_id = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
  }
  if (!partial || body?.name !== undefined) {
    result.name = readText(body, 'name', errors, 200, true) ?? '';
  }
  if (body?.description !== undefined) {
    result.description = readText(body, 'description', errors, 2000);
  } else if (!partial) {
    result.description = null;
  }
  if (!partial) {
    result.quota = readRequiredInteger(body, 'quota', errors, { min: 1, max: MAXIMUM_QUOTA });
  } else {
    result.quota = readInteger(body, 'quota', errors, { min: 1, max: MAXIMUM_QUOTA });
  }
  if (!partial || body?.open_from !== undefined) {
    result.open_from = readDate(body, 'open_from', errors, true);
  }
  if (!partial || body?.open_to !== undefined) {
    result.open_to = readDate(body, 'open_to', errors, true);
  }
  if (result.open_from && result.open_to && result.open_to < result.open_from) {
    errors.push({ field: 'open_to', message: 'Hạn nhận hồ sơ không trước ngày bắt đầu' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return result;
}

function readPost(body: RequestBody, partial: boolean): Partial<PostInput> {
  const errors: FieldError[] = [];
  const result: Partial<PostInput> = {};
  if (!partial) {
    result.campaign_id = readRequiredUuid(body, 'campaign_id', errors, 'Bắt buộc chọn đợt tuyển sinh');
  }
  if (!partial || body?.title !== undefined) {
    result.title = readText(body, 'title', errors, 200, true) ?? '';
  }
  if (!partial || body?.content !== undefined) {
    result.content = readText(body, 'content', errors, 10_000, true) ?? '';
  }
  if (!partial || body?.publish_from !== undefined) {
    result.publish_from = readDate(body, 'publish_from', errors, true);
  }
  if (body?.publish_to !== undefined) {
    result.publish_to = readDate(body, 'publish_to', errors, false) ?? null;
  } else if (!partial) {
    result.publish_to = null;
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return result;
}

@Controller()
export class AdmissionCampaignsController {
  constructor(private readonly campaigns: AdmissionCampaignsService) {}

  @Get('admission-campaigns')
  @RequirePermission(...ADMISSION_PERMISSIONS)
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (query.org_unit_id !== undefined && !isUuid(query.org_unit_id)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã không hợp lệ' }]);
    }
    if (query.status !== undefined && !CAMPAIGN_STATUSES.includes(query.status as AdmissionCampaignStatus)) {
      throw validationError([{ field: 'status', message: 'Trạng thái là draft, open hoặc closed' }]);
    }
    return this.campaigns.list(currentUser, {
      orgUnitId: query.org_unit_id ?? null,
      status: (query.status as AdmissionCampaignStatus | undefined) ?? null,
    });
  }

  @Post('admission-campaigns')
  @RequirePermission(PERMISSION_CODES.admissionCampaignManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.campaigns.create(
      currentUser,
      readCampaign(body, false) as CampaignInput,
      originOf(request, currentUser),
    );
  }

  @Patch('admission-campaigns/:id')
  @RequirePermission(PERMISSION_CODES.admissionCampaignManage)
  update(
    @Param('id', uuidParameter('Mã đợt tuyển sinh không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.campaigns.update(currentUser, id, readCampaign(body, true), originOf(request, currentUser));
  }

  @Post('admission-campaigns/:id/open')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.admissionCampaignManage)
  open(
    @Param('id', uuidParameter('Mã đợt tuyển sinh không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.campaigns.changeStatus(currentUser, id, 'open', originOf(request, currentUser));
  }

  @Post('admission-campaigns/:id/close')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.admissionCampaignManage)
  close(
    @Param('id', uuidParameter('Mã đợt tuyển sinh không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.campaigns.changeStatus(currentUser, id, 'closed', originOf(request, currentUser));
  }

  @Get('admission-posts')
  @RequirePermission(...ADMISSION_PERMISSIONS)
  listPosts(@Query('campaign_id') campaignId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (campaignId !== undefined && !isUuid(campaignId)) {
      throw validationError([{ field: 'campaign_id', message: 'Mã không hợp lệ' }]);
    }
    return this.campaigns.listPosts(currentUser, campaignId ?? null);
  }

  @Post('admission-posts')
  @RequirePermission(PERMISSION_CODES.admissionPostManage)
  createPost(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.campaigns.createPost(currentUser, readPost(body, false) as PostInput, originOf(request, currentUser));
  }

  @Patch('admission-posts/:id')
  @RequirePermission(PERMISSION_CODES.admissionPostManage)
  updatePost(
    @Param('id', uuidParameter('Mã tin tuyển sinh không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.campaigns.updatePost(currentUser, id, readPost(body, true), originOf(request, currentUser));
  }

  @Post('admission-posts/:id/publish')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.admissionPostManage)
  publishPost(
    @Param('id', uuidParameter('Mã tin tuyển sinh không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.campaigns.changePostStatus(currentUser, id, 'published', null, originOf(request, currentUser));
  }

  @Post('admission-posts/:id/hide')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.admissionPostManage)
  hidePost(
    @Param('id', uuidParameter('Mã tin tuyển sinh không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readText(body, 'reason', errors, 500, true);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.campaigns.changePostStatus(currentUser, id, 'hidden', reason, originOf(request, currentUser));
  }
}
