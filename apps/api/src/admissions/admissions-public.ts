import { Body, Controller, Get, Injectable, Post, Query, Req } from '@nestjs/common';
import { Clock, validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import { PublicEndpoint } from '../authentication/authentication.guard.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import { AdmissionApplicationsService } from './admission-applications.js';
import { readApplication } from './admission-fields.js';
import { PublicRateLimiter } from './public-rate-limit.js';

// Tuyển sinh trực tuyến cho phụ huynh và người ngoài trường, không cần tài khoản (G3-01, G3-07; P16-02, P16-05;
// YCTD-86): xem đợt đang nhận hồ sơ kèm tin tuyển sinh đang đăng, nộp hồ sơ, tra cứu trạng thái bằng mã hồ sơ và số điện
// thoại. Không trả số định danh, lý do xét ngoài lý do không đạt, hay thông tin nội bộ. Mỗi địa chỉ mạng bị giới hạn số
// yêu cầu (PublicRateLimiter)
const STATUS_LABELS = {
  submitted: 'Đã nộp, chờ nhà trường tiếp nhận',
  received: 'Nhà trường đã tiếp nhận, đang xét duyệt',
  passed: 'Đạt, nhà trường sẽ liên hệ nhập học',
  rejected: 'Không đạt',
  converted: 'Đã nhập học',
} as const;
const CODE_PATTERN = /^TS-\d{6}$/;
const PHONE_PATTERN = /^0\d{9}$/;

@Injectable()
export class AdmissionsPublicService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly applications: AdmissionApplicationsService,
    private readonly clock: Clock,
  ) {}

  // CT-124: đợt đang mở và trong thời gian nhận hồ sơ, kèm tin đã công bố còn trong thời hạn đăng
  async openCampaigns() {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { campaigns: [], relationships: [] };
    }
    const database = current.database;
    const today = VIETNAM_DATE.format(this.clock.now());
    const campaigns = await database
      .selectFrom('admission_campaigns')
      .innerJoin('org_units', 'org_units.id', 'admission_campaigns.org_unit_id')
      .select([
        'admission_campaigns.id',
        'admission_campaigns.name',
        'admission_campaigns.description',
        'admission_campaigns.quota',
        'admission_campaigns.open_from',
        'admission_campaigns.open_to',
        'org_units.name as org_unit_name',
        'org_units.address as org_unit_address',
      ])
      .where('admission_campaigns.status', '=', 'open')
      .where('admission_campaigns.open_from', '<=', today)
      .where('admission_campaigns.open_to', '>=', today)
      .orderBy('admission_campaigns.open_to')
      .execute();
    const posts = campaigns.length
      ? await database
          .selectFrom('admission_posts')
          .select(['id', 'campaign_id', 'title', 'content', 'publish_from', 'publish_to', 'published_at'])
          .where(
            'campaign_id',
            'in',
            campaigns.map((campaign) => campaign.id),
          )
          .where('status', '=', 'published')
          .where('publish_from', '<=', today)
          .where((expression) =>
            expression.or([expression('publish_to', 'is', null), expression('publish_to', '>=', today)]),
          )
          .orderBy('publish_from', 'desc')
          .execute()
      : [];
    const relationships = await database
      .selectFrom('catalog_items')
      .select(['id', 'name'])
      .where('catalog_type', '=', 'parent_relationship')
      .where('status', '=', 'active')
      .orderBy('name')
      .execute();
    return {
      campaigns: campaigns.map((campaign) => ({
        ...campaign,
        application_deadline: campaign.open_to,
        posts: posts
          .filter((post) => post.campaign_id === campaign.id)
          .map((post) => ({
            id: post.id,
            title: post.title,
            content: post.content,
            publish_from: post.publish_from,
            publish_to: post.publish_to,
            published_at: post.published_at,
            deadline: post.publish_to ?? campaign.open_to,
          })),
      })),
      relationships,
    };
  }

  // Tra cứu bằng mã hồ sơ và số điện thoại phụ huynh đã khai; sai một trong hai thì trả cùng một thông báo
  async lookup(code: string, phone: string) {
    const current = await this.currentSchoolYear.find();
    const row = current
      ? await current.database
          .selectFrom('admission_applications')
          .innerJoin('admission_campaigns', 'admission_campaigns.id', 'admission_applications.campaign_id')
          .select([
            'admission_applications.code',
            'admission_applications.child_full_name',
            'admission_applications.status',
            'admission_applications.reject_reason',
            'admission_applications.created_at',
            'admission_campaigns.name as campaign_name',
          ])
          .where('admission_applications.code', '=', code)
          .where('admission_applications.guardian_phone', '=', phone)
          .executeTakeFirst()
      : undefined;
    if (!row) {
      throw notFoundError('Không tìm thấy hồ sơ với mã và số điện thoại đã nhập', 'admission_application');
    }
    return {
      code: row.code,
      child_full_name: row.child_full_name,
      campaign_name: row.campaign_name,
      status: row.status,
      status_label: STATUS_LABELS[row.status],
      reject_reason: row.status === 'rejected' ? row.reject_reason : null,
      submitted_at: row.created_at,
    };
  }

  async submit(body: RequestBody, ip: string | null) {
    const created = await this.applications.submit(readApplication(body, { requireAllergyFlag: true }), {
      source: 'online',
      ip,
    });
    return {
      code: created.code,
      status: created.status,
      status_label: STATUS_LABELS[created.status],
      campaign_name: created.campaign_name,
      child_full_name: created.child_full_name,
      message: `Đã nộp hồ sơ ${created.code}. Ghi lại mã hồ sơ để tra cứu trạng thái cùng số điện thoại đã khai.`,
    };
  }
}

@Controller('public')
@PublicEndpoint()
export class AdmissionsPublicController {
  constructor(
    private readonly admissions: AdmissionsPublicService,
    private readonly limiter: PublicRateLimiter,
  ) {}

  @Get('admissions')
  campaigns(@Req() request: Request) {
    this.limiter.hit('read', request.ip);
    return this.admissions.openCampaigns();
  }

  @Post('admission-applications')
  submit(@Body() body: RequestBody, @Req() request: Request) {
    this.limiter.hit('submit', request.ip);
    return this.admissions.submit(body, request.ip ?? null);
  }

  @Get('admission-applications/lookup')
  lookup(@Query('code') code: string | undefined, @Query('phone') phone: string | undefined, @Req() request: Request) {
    this.limiter.hit('read', request.ip);
    const errors: FieldError[] = [];
    const normalizedCode = code?.trim().toUpperCase() ?? '';
    if (!CODE_PATTERN.test(normalizedCode)) {
      errors.push({ field: 'code', message: 'Mã hồ sơ dạng TS-000001' });
    }
    if (!phone || !PHONE_PATTERN.test(phone.trim())) {
      errors.push({ field: 'phone', message: 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.admissions.lookup(normalizedCode, phone?.trim() ?? '');
  }
}
