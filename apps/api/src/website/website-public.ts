import { Body, Controller, Get, Inject, Injectable, Optional, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { TenancyRuntime } from '@school-management/database';
import { ApplicationError, type FieldError } from '@school-management/server';
import { API_VERSION_PREFIX, WEBSITE_PAGE_KEYS } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AdmissionsPublicService } from '../admissions/admissions-public.js';
import { AdmissionsRateLimiter } from '../admissions/public-rate-limit.js';
import { PublicEndpoint } from '../authentication/authentication.guard.js';
import { TENANCY_RUNTIME } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { SchoolLevelResolver } from '../common/school-levels.js';
import { isUuid, type RequestBody } from '../common/request-fields.js';
import { FileStorage } from '../files/file-storage.js';
import { escapeLike, readText } from '../incoming-documents/incoming-fields.js';
import { escapeHtml as e, normalizeHostname, requestHostname, sanitizeContent, textToHtml } from './website-html.js';
import {
  attachments,
  formatDate,
  layout,
  link,
  notFoundPage,
  pager,
  postCards,
  postList,
  type PostCard,
  type SiteFrame,
} from './website-render.js';

// Trang công khai của website trường (DT-18 phần 18f, YCTD-144). Chọn trường theo tên máy của yêu cầu (Host, hoặc
// X-Forwarded-Host khi đi qua máy chủ web): chỉ tên miền đã đăng ký và đang dùng mới có trang; tên miền phụ chuyển về tên
// miền chính; tên miền trình diễn và chế độ trình diễn hiện dải "Trang trình diễn" và không cho máy tìm kiếm lập chỉ mục.
// Máy chủ web chuyển mọi đường dẫn của tên miền trường sang /api/v1/public/site và gửi kèm X-Website-Root: 1 để liên kết
// trong trang tính từ gốc tên miền; gọi thẳng máy chủ API (khi phát triển, kiểm thử) thì liên kết giữ tiền tố đó.
// Không hiện dữ liệu cá nhân của trẻ: tuyển sinh chỉ có đợt và tin tuyển sinh, cơ cấu tổ chức chỉ có đơn vị
const SITE_PREFIX = `${API_VERSION_PREFIX}/public/site`;
const PAGE_SIZE = 12;
const DOCUMENT_PAGE_SIZE = 20;
const EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const PHONE_PATTERN = /^[0-9+ .()-]{8,20}$/;
const UNIT_TYPE_LABELS: Record<string, string> = {
  truong_chinh: 'Trường chính',
  phan_hieu: 'Phân hiệu',
  diem_truong: 'Điểm trường',
};
const SECTIONS = { news: '/tin-tuc', announcement: '/thong-bao', disclosure: '/cong-khai' } as const;
// Chính sách bảo mật nội dung: không có script, không nhúng khung; ảnh trong bài chỉ từ https
const CONTENT_SECURITY_POLICY =
  "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

interface SiteContext {
  frame: SiteFrame;
  // Hiện nội dung mẫu khi bật chế độ trình diễn
  showSamples: boolean;
  schoolLevels: string[];
  admissionFormUrl: string | null;
  introduction: string | null;
  bannerFileId: string | null;
  logoFileId: string | null;
  mapUrl: string | null;
  origin: string;
}

class SiteRedirect {
  constructor(readonly location: string) {}
}

class SiteNotFound {
  constructor(readonly message: string) {}
}

@Injectable()
export class WebsitePublicService {
  // Đọc theo từng lần dùng để đúng trường trong ngữ cảnh ở chế độ nhiều trường (DT-SaaS phần S1a)
  private get system() {
    return this.databases.system;
  }

  constructor(
    private readonly databases: Databases,
    private readonly fileStorage: FileStorage,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly admissions: AdmissionsPublicService,
    private readonly schoolLevels: SchoolLevelResolver,
  ) {}

  // Máy chủ web hỏi trước khi xin chứng chỉ cho một tên miền (cấp chứng chỉ theo yêu cầu): chỉ tên miền đang dùng
  async isServedDomain(domain: string): Promise<boolean> {
    const hostname = normalizeHostname(domain);
    if (!hostname) {
      return false;
    }
    const row = await this.system
      .selectFrom('website_domains')
      .select('id')
      .where('hostname', '=', hostname)
      .where('active', '=', true)
      .executeTakeFirst();
    return row !== undefined;
  }

  async context(request: Request): Promise<SiteContext> {
    const hostname = requestHostname(request.hostname);
    const domain = hostname
      ? await this.system
          .selectFrom('website_domains')
          .select(['hostname', 'kind'])
          .where('hostname', '=', hostname)
          .where('active', '=', true)
          .executeTakeFirst()
      : undefined;
    if (!domain) {
      throw new SiteNotFound('Tên miền này chưa được đăng ký cho website trường nào.');
    }
    const rooted = request.header('x-website-root') === '1';
    if (domain.kind === 'alias') {
      const primary = await this.system
        .selectFrom('website_domains')
        .select('hostname')
        .where('kind', '=', 'primary')
        .where('active', '=', true)
        .executeTakeFirst();
      if (primary) {
        // Máy chủ web đã viết lại đường dẫn về tiền tố của API; bỏ tiền tố để giữ đường dẫn trên tên miền
        const path = request.originalUrl.startsWith(SITE_PREFIX)
          ? request.originalUrl.slice(SITE_PREFIX.length) || '/'
          : request.originalUrl;
        throw new SiteRedirect(`${request.protocol}://${primary.hostname}${rooted ? path : `${SITE_PREFIX}${path}`}`);
      }
    }
    const settings = await this.system
      .selectFrom('website_settings')
      .selectAll()
      .where('id', '=', 1)
      .executeTakeFirstOrThrow();
    const base = rooted ? '' : SITE_PREFIX;
    return {
      frame: {
        base,
        siteName: settings.site_name || 'Website nhà trường',
        slogan: settings.slogan,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        officeHours: settings.office_hours,
        facebookUrl: settings.facebook_url,
        mapUrl: settings.map_url,
        footerNote: settings.footer_note,
        color: settings.primary_color,
        logoUrl: settings.logo_file_id ? `${base}/tep/${settings.logo_file_id}` : null,
        demo: settings.demo_mode || domain.kind === 'demo',
        showTimetable: settings.show_timetable,
      },
      showSamples: settings.demo_mode,
      // Cấp học lấy từ nguồn chung school_levels (DT-19 phần 19a), cột cũ của website giữ làm dự phòng
      schoolLevels: await this.schoolLevels.enabled(),
      admissionFormUrl: settings.admission_form_url,
      introduction: settings.introduction,
      bannerFileId: settings.banner_file_id,
      logoFileId: settings.logo_file_id,
      mapUrl: settings.map_url,
      origin: `${request.protocol}://${request.get('host') ?? hostname}`,
    };
  }

  // Bài đã đăng; nội dung mẫu chỉ hiện khi bật chế độ trình diễn
  private published(site: SiteContext) {
    let query = this.system.selectFrom('website_posts').where('status', '=', 'published');
    if (!site.showSamples) {
      query = query.where('is_sample', '=', false);
    }
    return query;
  }

  private publishedAlbums(site: SiteContext) {
    let query = this.system.selectFrom('website_albums').where('status', '=', 'published');
    if (!site.showSamples) {
      query = query.where('is_sample', '=', false);
    }
    return query;
  }

  private cards(site: SiteContext, kind: 'news' | 'announcement', limit: number, offset = 0): Promise<PostCard[]> {
    return this.published(site)
      .select(['slug', 'title', 'summary', 'published_at', 'cover_file_id'])
      .where('kind', '=', kind)
      .orderBy('pinned', 'desc')
      .orderBy('published_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();
  }

  private publicDocuments(keyword: string | null) {
    let query = this.system
      .selectFrom('outgoing_documents')
      .where('status', '=', 'issued')
      .where('published', '=', true);
    if (keyword) {
      const pattern = `%${escapeLike(keyword)}%`;
      query = query.where((expression) =>
        expression.or([expression('summary', 'ilike', pattern), expression('symbol', 'ilike', pattern)]),
      );
    }
    return query;
  }

  async home(site: SiteContext): Promise<string> {
    const { frame } = site;
    const [news, announcements, documents, campaigns, albums] = await Promise.all([
      this.cards(site, 'news', 6),
      this.cards(site, 'announcement', 6),
      this.publicDocuments(null)
        .select(['id', 'symbol', 'summary', 'issue_date'])
        .orderBy('issue_date', 'desc')
        .orderBy('issue_number', 'desc')
        .limit(5)
        .execute(),
      this.admissions.openCampaigns(),
      this.publishedAlbums(site)
        .select(['slug', 'title', 'published_at', 'cover_file_id'])
        .orderBy('published_at', 'desc')
        .limit(3)
        .execute(),
    ]);
    const content = `
${site.bannerFileId ? `<img class="banner" src="${e(link(frame, `/tep/${site.bannerFileId}`))}" alt="">` : ''}
<h1>${e(frame.siteName)}</h1>
${site.introduction ? textToHtml(site.introduction) : ''}
${
  campaigns.campaigns.length
    ? `<div class="notice">Nhà trường đang nhận hồ sơ tuyển sinh: ${campaigns.campaigns
        .map((campaign) => e(campaign.name))
        .join(', ')}. <a href="${e(link(frame, '/tuyen-sinh'))}">Xem thông tin tuyển sinh</a></div>`
    : ''
}
<div class="cols"><section><h2>Tin tức</h2>${postCards(frame, '/tin-tuc', news, 'Chưa có tin tức.')}</section>
<aside><h2>Thông báo</h2>${postList(frame, '/thong-bao', announcements, 'Chưa có thông báo.')}
<h2>Văn bản mới</h2>${
      documents.length
        ? `<ul class="list">${documents
            .map(
              (document) =>
                `<li><strong>${e(document.symbol)}</strong> <span class="meta">${e(formatDate(document.issue_date))}</span><div>${e(document.summary)}</div></li>`,
            )
            .join('')}</ul><a href="${e(link(frame, '/van-ban'))}">Xem tất cả văn bản</a>`
        : '<p class="meta">Chưa có văn bản công khai.</p>'
    }</aside></div>
${
  albums.length
    ? `<h2>Thư viện ảnh</h2><div class="grid">${albums
        .map(
          (album) =>
            `<article class="card">${album.cover_file_id ? `<img src="${e(link(frame, `/tep/${album.cover_file_id}`))}" alt="">` : ''}<div class="body"><h3><a href="${e(link(frame, `/thu-vien-anh/${album.slug}`))}">${e(album.title)}</a></h3></div></article>`,
        )
        .join('')}</div>`
    : ''
}`;
    return layout(frame, {
      title: frame.siteName,
      active: 'home',
      content,
      description: site.introduction ?? undefined,
    });
  }

  async page(site: SiteContext, key: 'intro' | 'organization'): Promise<string> {
    const { frame } = site;
    const label = WEBSITE_PAGE_KEYS.find((page) => page.key === key)?.label ?? '';
    const post = await this.published(site)
      .select(['title', 'body_html', 'cover_file_id', 'id'])
      .where('kind', '=', 'page')
      .where('page_key', '=', key)
      .executeTakeFirst();
    let units = '';
    if (key === 'organization') {
      const current = await this.currentSchoolYear.find();
      const rows = current
        ? await current.database
            .selectFrom('org_units')
            .select(['name', 'unit_type', 'address'])
            .where('status', '=', 'active')
            .orderBy('unit_type')
            .orderBy('name')
            .execute()
        : [];
      units = rows.length
        ? `<h2>Cơ sở của trường</h2><table class="docs"><thead><tr><th>Tên</th><th>Loại</th><th>Địa chỉ</th></tr></thead><tbody>${rows
            .map(
              (row) =>
                `<tr><td>${e(row.name)}</td><td>${e(UNIT_TYPE_LABELS[row.unit_type] ?? '')}</td><td>${e(row.address)}</td></tr>`,
            )
            .join('')}</tbody></table>`
        : '';
    }
    const files = post ? await this.publicFiles('post', post.id) : [];
    const content = `<article class="article"><h1>${e(post?.title ?? label)}</h1>${
      post?.cover_file_id ? `<img class="banner" src="${e(link(frame, `/tep/${post.cover_file_id}`))}" alt="">` : ''
    }<div class="content">${post ? sanitizeContent(post.body_html) : '<p class="meta">Nội dung đang được cập nhật.</p>'}</div>${attachments(
      frame,
      files.filter((file) => file.purpose === 'attachment'),
    )}${units}</article>`;
    return layout(frame, { title: post?.title ?? label, active: key, content });
  }

  async postIndex(site: SiteContext, kind: 'news' | 'announcement', page: number): Promise<string> {
    const { frame } = site;
    const total = await this.published(site)
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('kind', '=', kind)
      .executeTakeFirstOrThrow();
    const posts = await this.cards(site, kind, PAGE_SIZE, (page - 1) * PAGE_SIZE);
    const title = kind === 'news' ? 'Tin tức' : 'Thông báo';
    const section = SECTIONS[kind];
    const content = `<h1>${title}</h1>${
      kind === 'news'
        ? postCards(frame, section, posts, 'Chưa có tin tức.')
        : postList(frame, section, posts, 'Chưa có thông báo.')
    }${pager(frame, section, page, Number(total.count), PAGE_SIZE)}`;
    return layout(frame, { title, active: kind, content });
  }

  async postDetail(site: SiteContext, kind: 'news' | 'announcement' | 'disclosure', slug: string): Promise<string> {
    const { frame } = site;
    const post = await this.published(site)
      .selectAll()
      .where('kind', '=', kind)
      .where('slug', '=', slug)
      .executeTakeFirst();
    if (!post) {
      throw new SiteNotFound('Không tìm thấy bài viết hoặc bài đã được gỡ.');
    }
    const files = await this.publicFiles('post', post.id);
    const back = kind === 'news' ? 'Tin tức' : kind === 'announcement' ? 'Thông báo' : 'Công khai theo quy định';
    const content = `<p><a href="${e(link(frame, SECTIONS[kind]))}">${back}</a></p><article class="article"><h1>${e(post.title)}</h1><div class="meta">Đăng ngày ${e(
      formatDate(post.published_at),
    )}${post.disclosure_year ? ` · Năm học ${e(post.disclosure_year)}` : ''}</div>${
      post.cover_file_id ? `<img class="banner" src="${e(link(frame, `/tep/${post.cover_file_id}`))}" alt="">` : ''
    }${post.summary ? `<p><strong>${e(post.summary)}</strong></p>` : ''}<div class="content">${sanitizeContent(post.body_html)}</div>${attachments(
      frame,
      files.filter((file) => file.purpose === 'attachment'),
    )}</article>`;
    return layout(frame, {
      title: post.title,
      active: kind,
      content,
      description: post.summary ?? undefined,
    });
  }

  async documents(site: SiteContext, page: number, keyword: string | null): Promise<string> {
    const { frame } = site;
    const total = await this.publicDocuments(keyword)
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    const rows = await this.publicDocuments(keyword)
      .select((expression) => [
        'outgoing_documents.id',
        'outgoing_documents.symbol',
        'outgoing_documents.summary',
        'outgoing_documents.issue_date',
        'outgoing_documents.signer_name',
        'outgoing_documents.signer_title',
        expression
          .selectFrom('outgoing_document_files')
          .select('outgoing_document_files.id')
          .whereRef('outgoing_document_files.document_id', '=', 'outgoing_documents.id')
          .where('outgoing_document_files.kind', '=', 'signed')
          .limit(1)
          .as('signed_file_id'),
      ])
      .orderBy('issue_date', 'desc')
      .orderBy('issue_number', 'desc')
      .limit(DOCUMENT_PAGE_SIZE)
      .offset((page - 1) * DOCUMENT_PAGE_SIZE)
      .execute();
    const query = keyword ? `q=${encodeURIComponent(keyword)}` : '';
    const content = `<h1>Văn bản công khai</h1>
<form method="get" action="${e(link(frame, '/van-ban'))}" role="search"><label>Tìm theo số ký hiệu, trích yếu <input name="q" value="${e(keyword ?? '')}"></label> <button type="submit">Tìm</button></form>
${
  rows.length
    ? `<table class="docs"><thead><tr><th>Số ký hiệu</th><th>Ngày ban hành</th><th>Trích yếu</th><th>Người ký</th><th>Tệp</th></tr></thead><tbody>${rows
        .map(
          (row) =>
            `<tr><td>${e(row.symbol)}</td><td>${e(formatDate(row.issue_date))}</td><td>${e(row.summary)}</td><td>${e(
              [row.signer_title, row.signer_name].filter(Boolean).join(' '),
            )}</td><td>${row.signed_file_id ? `<a href="${e(link(frame, `/van-ban/${row.id}/tep`))}">Tải văn bản</a>` : ''}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '<p class="meta">Chưa có văn bản công khai.</p>'
}${pager(frame, '/van-ban', page, Number(total.count), DOCUMENT_PAGE_SIZE, query)}`;
    return layout(frame, { title: 'Văn bản công khai', active: 'documents', content });
  }

  async documentFile(id: string) {
    const file = await this.publicDocuments(null)
      .innerJoin('outgoing_document_files', 'outgoing_document_files.document_id', 'outgoing_documents.id')
      .select([
        'outgoing_document_files.file_name',
        'outgoing_document_files.content_type',
        'outgoing_document_files.storage_key',
      ])
      .where('outgoing_documents.id', '=', id)
      .where('outgoing_document_files.kind', '=', 'signed')
      .executeTakeFirst();
    if (!file) {
      throw new SiteNotFound('Không tìm thấy tệp văn bản công khai.');
    }
    return {
      fileName: file.file_name,
      contentType: file.content_type,
      body: await this.fileStorage.get(file.storage_key),
    };
  }

  async admissionsPage(site: SiteContext): Promise<string> {
    const { frame } = site;
    const { campaigns } = await this.admissions.openCampaigns();
    const formLink = site.admissionFormUrl
      ? `<p><a href="${e(site.admissionFormUrl)}" rel="noopener noreferrer">Nộp hồ sơ, tra cứu hồ sơ tuyển sinh trực tuyến</a></p>`
      : '';
    const content = `<h1>Tuyển sinh</h1>${
      campaigns.length
        ? `${formLink}${campaigns
            .map(
              (campaign) =>
                `<section class="article" style="margin-bottom:16px"><h2>${e(campaign.name)}</h2><div class="meta">${e(
                  campaign.org_unit_name,
                )}${campaign.org_unit_address ? ` · ${e(campaign.org_unit_address)}` : ''}</div><p>Nhận hồ sơ từ ${e(
                  formatDate(campaign.open_from),
                )} đến ${e(formatDate(campaign.open_to))}${campaign.quota ? ` · Chỉ tiêu: ${e(campaign.quota)}` : ''}</p>${textToHtml(
                  campaign.description,
                )}${campaign.posts
                  .map((post) => `<h3>${e(post.title)}</h3>${textToHtml(post.content)}`)
                  .join('')}</section>`,
            )
            .join('')}`
        : '<p class="meta">Hiện nhà trường chưa mở đợt tuyển sinh.</p>'
    }`;
    return layout(frame, { title: 'Tuyển sinh', active: 'admissions', content });
  }

  async disclosures(site: SiteContext): Promise<string> {
    const { frame } = site;
    const levels = new Set<string | null>([null]);
    if (site.schoolLevels.includes('MN')) {
      levels.add('MN');
    }
    if (site.schoolLevels.some((level) => level !== 'MN')) {
      levels.add('PT');
    }
    const categories = (
      await this.system
        .selectFrom('website_disclosure_categories')
        .selectAll()
        .where('active', '=', true)
        .orderBy('order_no')
        .execute()
    ).filter((category) => levels.has(category.school_level));
    const posts = await this.published(site)
      .select(['slug', 'title', 'summary', 'published_at', 'cover_file_id', 'disclosure_category', 'disclosure_year'])
      .where('kind', '=', 'disclosure')
      .orderBy('disclosure_year', 'desc')
      .orderBy('published_at', 'desc')
      .execute();
    const content = `<h1>Công khai theo quy định</h1><p class="meta">Thực hiện công khai theo Thông tư 09/2024/TT-BGDĐT của Bộ Giáo dục và Đào tạo.</p>${categories
      .map((category) => {
        const items = posts.filter((post) => post.disclosure_category === category.code);
        return `<section><h2>${e(category.name)}${category.legal_basis ? ` <span class="meta">(${e(category.legal_basis)})</span>` : ''}</h2>${
          items.length
            ? `<ul class="list">${items
                .map(
                  (post) =>
                    `<li><a href="${e(link(frame, `/cong-khai/${post.slug}`))}">${e(post.title)}</a> <span class="meta">${post.disclosure_year ? `Năm học ${e(post.disclosure_year)} · ` : ''}${e(formatDate(post.published_at))}</span></li>`,
                )
                .join('')}</ul>`
            : '<p class="meta">Đang cập nhật.</p>'
        }</section>`;
      })
      .join('')}`;
    return layout(frame, { title: 'Công khai theo quy định', active: 'disclosure', content });
  }

  // Thời khoá biểu đang áp dụng của các lớp (DT-20 phần 22c1, YCTD-160): bản đã ban hành có ngày áp dụng gần nhất không sau
  // hôm nay của từng cấp; mỗi lớp một bảng thứ × tiết, ghi môn và giáo viên. Chưa ban hành bản nào thì giữ lời nhắn cũ
  async timetable(site: SiteContext): Promise<string> {
    const placeholder =
      '<h1>Thời khóa biểu</h1><p class="meta">Thời khóa biểu sẽ được cập nhật khi nhà trường đưa vào dùng phân hệ xếp thời khóa biểu.</p>';
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return layout(site.frame, { title: 'Thời khóa biểu', active: 'timetable', content: placeholder });
    }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const versions = await current.database
      .selectFrom('timetable_versions')
      .select(['id', 'school_level', 'effective_from'])
      .where('status', '=', 'published')
      .where('effective_from', '<=', today)
      .orderBy('effective_from', 'desc')
      .orderBy('published_at', 'desc')
      .execute();
    const applying = [...new Map(versions.reverse().map((version) => [version.school_level, version])).values()];
    const lessons = applying.length
      ? await current.database
          .selectFrom('timetable_lessons')
          .innerJoin('classes', 'classes.id', 'timetable_lessons.class_id')
          .innerJoin('subjects', 'subjects.id', 'timetable_lessons.subject_id')
          .select([
            'classes.id as class_id',
            'classes.name as class_name',
            'timetable_lessons.weekday',
            'timetable_lessons.period_no',
            'timetable_lessons.group_no',
            'subjects.name as subject_name',
            'timetable_lessons.teacher_name',
          ])
          .where(
            'timetable_lessons.version_id',
            'in',
            applying.map((version) => version.id),
          )
          .orderBy('classes.name')
          .execute()
      : [];
    if (lessons.length === 0) {
      return layout(site.frame, { title: 'Thời khóa biểu', active: 'timetable', content: placeholder });
    }
    const days = [...new Set(lessons.map((lesson) => lesson.weekday))].sort((left, right) => left - right);
    const periods = [...new Set(lessons.map((lesson) => lesson.period_no))].sort((left, right) => left - right);
    const dayLabel = (weekday: number) => (weekday === 7 ? 'Chủ nhật' : `Thứ ${weekday + 1}`);
    const classes = [...new Map(lessons.map((lesson) => [lesson.class_id, lesson.class_name])).entries()];
    const tables = classes
      .map(([classId, className]) => {
        const cell = (weekday: number, period: number) => {
          // Một ô có thể có nhiều tiết khi lớp tách nhóm học môn lựa chọn (THPT, DT-21 phần 21b)
          return lessons
            .filter((item) => item.class_id === classId && item.weekday === weekday && item.period_no === period)
            .map(
              (lesson) =>
                `${lesson.group_no > 0 ? `Nhóm ${lesson.group_no}: ` : ''}${e(lesson.subject_name)}${lesson.teacher_name ? `<br><span class="meta">${e(lesson.teacher_name)}</span>` : ''}`,
            )
            .join('<hr>');
        };
        const rows = periods
          .map(
            (period) =>
              `<tr><th>Tiết ${period}</th>${days.map((day) => `<td>${cell(day, period)}</td>`).join('')}</tr>`,
          )
          .join('');
        return `<section><h2>${e(className)}</h2><table><thead><tr><th></th>${days.map((day) => `<th>${dayLabel(day)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></section>`;
      })
      .join('');
    return layout(site.frame, {
      title: 'Thời khóa biểu',
      active: 'timetable',
      content: `<h1>Thời khóa biểu</h1>${tables}`,
    });
  }

  async albumIndex(site: SiteContext, page: number): Promise<string> {
    const { frame } = site;
    const total = await this.publishedAlbums(site)
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    const albums = await this.publishedAlbums(site)
      .select(['slug', 'title', 'description', 'event_date', 'published_at', 'cover_file_id'])
      .orderBy('published_at', 'desc')
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .execute();
    const content = `<h1>Thư viện ảnh</h1>${
      albums.length
        ? `<div class="grid">${albums
            .map(
              (album) =>
                `<article class="card">${album.cover_file_id ? `<img src="${e(link(frame, `/tep/${album.cover_file_id}`))}" alt="">` : ''}<div class="body"><h3><a href="${e(
                  link(frame, `/thu-vien-anh/${album.slug}`),
                )}">${e(album.title)}</a></h3><div class="meta">${e(formatDate(album.event_date ?? album.published_at))}</div></div></article>`,
            )
            .join('')}</div>`
        : '<p class="meta">Chưa có album ảnh.</p>'
    }${pager(frame, '/thu-vien-anh', page, Number(total.count), PAGE_SIZE)}`;
    return layout(frame, { title: 'Thư viện ảnh', active: 'albums', content });
  }

  async albumDetail(site: SiteContext, slug: string): Promise<string> {
    const { frame } = site;
    const album = await this.publishedAlbums(site)
      .select(['id', 'title', 'description', 'event_date', 'published_at'])
      .where('slug', '=', slug)
      .executeTakeFirst();
    if (!album) {
      throw new SiteNotFound('Không tìm thấy album hoặc album đã được gỡ.');
    }
    const photos = await this.publicFiles('album', album.id);
    const content = `<p><a href="${e(link(frame, '/thu-vien-anh'))}">Thư viện ảnh</a></p><h1>${e(album.title)}</h1><div class="meta">${e(
      formatDate(album.event_date ?? album.published_at),
    )}</div>${textToHtml(album.description)}${attachments(frame, photos)}`;
    return layout(frame, { title: album.title, active: 'albums', content });
  }

  contactPage(
    site: SiteContext,
    options: { sent?: boolean; errors?: FieldError[]; values?: Record<string, string> } = {},
  ): string {
    const { frame } = site;
    const values = options.values ?? {};
    const errorOf = (field: string) => {
      const error = options.errors?.find((item) => item.field === field);
      return error ? `<span class="error">${e(error.message)}</span>` : '';
    };
    const field = (name: string, label: string, type = 'text', required = false) =>
      `<label>${e(label)}${required ? ' *' : ''}<input name="${name}" type="${type}" value="${e(values[name] ?? '')}"${required ? ' required' : ''} maxlength="${
        name === 'subject' ? 300 : 200
      }">${errorOf(name)}</label>`;
    const content = `<h1>Liên hệ</h1>
<div class="cols"><section>
${options.sent ? '<div class="notice" role="status">Nhà trường đã nhận thư liên hệ của bạn và sẽ trả lời sớm.</div>' : ''}
<form class="contact" method="post" action="${e(link(frame, '/lien-he'))}">
${field('full_name', 'Họ và tên', 'text', true)}
${field('phone', 'Số điện thoại', 'tel')}
${field('email', 'Thư điện tử', 'email')}
${field('subject', 'Tiêu đề', 'text', true)}
<label>Nội dung *<textarea name="message" rows="6" maxlength="4000" required>${e(values.message ?? '')}</textarea>${errorOf('message')}</label>
<label class="hp" aria-hidden="true">Để trống ô này<input name="website" tabindex="-1" autocomplete="off"></label>
<button type="submit">Gửi liên hệ</button>
</form></section>
<aside><h2>Thông tin liên hệ</h2><ul class="list">
${frame.address ? `<li>Địa chỉ: ${e(frame.address)}</li>` : ''}
${frame.phone ? `<li>Điện thoại: ${e(frame.phone)}</li>` : ''}
${frame.email ? `<li>Thư điện tử: ${e(frame.email)}</li>` : ''}
${frame.officeHours ? `<li>Giờ làm việc: ${e(frame.officeHours)}</li>` : ''}
${site.mapUrl ? `<li><a href="${e(site.mapUrl)}" rel="noopener noreferrer" target="_blank">Xem bản đồ</a></li>` : ''}
</ul></aside></div>`;
    return layout(frame, { title: 'Liên hệ', active: 'contact', content });
  }

  // Thư liên hệ: ô bẫy (website) có chữ thì coi như gửi tự động, bỏ qua mà vẫn báo đã nhận
  async submitContact(body: RequestBody): Promise<{ errors: FieldError[]; values: Record<string, string> }> {
    const errors: FieldError[] = [];
    const values: Record<string, string> = {};
    for (const name of ['full_name', 'phone', 'email', 'subject', 'message']) {
      values[name] = typeof body?.[name] === 'string' ? String(body[name]).slice(0, 4000) : '';
    }
    const fullName = readText(body, 'full_name', errors, { required: true, maximum: 200 });
    const phone = readText(body, 'phone', errors, { maximum: 20 });
    const email = readText(body, 'email', errors, { maximum: 200 });
    const subject = readText(body, 'subject', errors, { required: true, maximum: 300 });
    const message = readText(body, 'message', errors, { required: true, maximum: 4000 });
    if (phone && !PHONE_PATTERN.test(phone)) {
      errors.push({ field: 'phone', message: 'Số điện thoại không hợp lệ' });
    }
    if (email && !EMAIL_PATTERN.test(email)) {
      errors.push({ field: 'email', message: 'Thư điện tử không hợp lệ' });
    }
    if (!phone && !email && !errors.some((error) => error.field === 'phone' || error.field === 'email')) {
      errors.push({ field: 'phone', message: 'Nhập số điện thoại hoặc thư điện tử để nhà trường trả lời' });
    }
    const trap = typeof body?.website === 'string' && body.website.trim() !== '';
    if (errors.length === 0 && !trap) {
      await this.system
        .insertInto('website_contact_messages')
        .values({ full_name: fullName!, phone, email, subject: subject!, message: message! })
        .execute();
    }
    return { errors, values };
  }

  // Tệp công khai: biểu trưng, ảnh đầu trang; tệp của bài, album đã đăng
  async publicFile(site: SiteContext, id: string) {
    const file = await this.system.selectFrom('website_files').selectAll().where('id', '=', id).executeTakeFirst();
    if (!file) {
      throw new SiteNotFound('Không tìm thấy tệp.');
    }
    let visible: boolean;
    if (file.owner_type === 'settings') {
      visible = file.id === site.logoFileId || file.id === site.bannerFileId;
    } else if (file.owner_type === 'post') {
      visible =
        (await this.published(site).select('id').where('id', '=', file.owner_id!).executeTakeFirst()) !== undefined;
    } else {
      visible =
        (await this.publishedAlbums(site).select('id').where('id', '=', file.owner_id!).executeTakeFirst()) !==
        undefined;
    }
    if (!visible) {
      throw new SiteNotFound('Không tìm thấy tệp.');
    }
    return {
      fileName: file.file_name,
      contentType: file.content_type,
      body: await this.fileStorage.get(file.storage_key),
    };
  }

  private publicFiles(owner: 'post' | 'album', id: string) {
    return this.system
      .selectFrom('website_files')
      .select(['id', 'purpose', 'file_name', 'content_type', 'caption'])
      .where('owner_type', '=', owner)
      .where('owner_id', '=', id)
      .where('purpose', '<>', 'cover')
      .orderBy('order_no')
      .orderBy('created_at')
      .execute();
  }

  robots(site: SiteContext): string {
    if (site.frame.demo) {
      return 'User-agent: *\nDisallow: /\n';
    }
    return `User-agent: *\nAllow: /\nSitemap: ${site.origin}${site.frame.base}/sitemap.xml\n`;
  }

  async sitemap(site: SiteContext): Promise<string> {
    const root = `${site.origin}${site.frame.base}`;
    const posts = await this.published(site)
      .select(['kind', 'slug', 'published_at'])
      .where('kind', 'in', ['news', 'announcement', 'disclosure'])
      .execute();
    const urls = [
      '/',
      '/gioi-thieu',
      '/co-cau-to-chuc',
      '/tin-tuc',
      '/thong-bao',
      '/van-ban',
      '/tuyen-sinh',
      '/cong-khai',
      '/thu-vien-anh',
      '/lien-he',
      ...posts.map((post) => `${SECTIONS[post.kind as keyof typeof SECTIONS]}/${post.slug}`),
    ];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
      .map((path) => `<url><loc>${e(`${root}${path === '/' ? '/' : path}`)}</loc></url>`)
      .join('')}</urlset>\n`;
  }
}

function readPage(value: unknown): number {
  const page = Number.parseInt(String(value ?? '1'), 10);
  return Number.isInteger(page) && page > 0 && page < 10_000 ? page : 1;
}

// Điểm cuối cho máy chủ web: 200 khi tên miền đã đăng ký và đang dùng, 404 khi không (cấp chứng chỉ theo yêu cầu)
@Controller('public/website')
@PublicEndpoint()
export class WebsiteDomainCheckController {
  constructor(
    private readonly website: WebsitePublicService,
    private readonly limiter: AdmissionsRateLimiter,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  // Chế độ nhiều trường: hỏi danh mục tên miền của nền tảng (không cần trường vì máy chủ web gọi bằng địa chỉ nội bộ); chế độ một
  // trường: tên miền website của trường
  @Get('domain-check')
  async domainCheck(@Query('domain') domain: string | undefined, @Req() request: Request, @Res() response: Response) {
    if (this.tenancy) {
      this.limiter.hit('read', request.ip);
    }
    const served =
      typeof domain === 'string' &&
      (this.tenancy ? await this.tenancy.isServedHost(domain) : await this.website.isServedDomain(domain));
    response
      .status(served ? 200 : 404)
      .type('text/plain')
      .send(served ? 'ok' : 'not found');
  }
}

@Controller('public/site')
@PublicEndpoint()
export class WebsitePublicController {
  constructor(
    private readonly website: WebsitePublicService,
    private readonly limiter: AdmissionsRateLimiter,
  ) {}

  // Dựng trang trong khối bắt lỗi chung: tên miền lạ, bài không có thì trả trang 404, tên miền phụ thì chuyển hướng
  private async render(
    request: Request,
    response: Response,
    build: (site: SiteContext) => Promise<string> | string,
  ): Promise<void> {
    try {
      const site = await this.website.context(request);
      const html = await build(site);
      this.send(response, 200, html);
    } catch (error) {
      this.fail(response, error);
    }
  }

  private send(response: Response, status: number, html: string) {
    response
      .status(status)
      .setHeader('content-security-policy', CONTENT_SECURITY_POLICY)
      .setHeader('x-content-type-options', 'nosniff')
      .setHeader('referrer-policy', 'strict-origin-when-cross-origin')
      .setHeader('cache-control', 'no-cache')
      .type('text/html; charset=utf-8')
      .send(html);
  }

  private fail(response: Response, error: unknown) {
    if (error instanceof SiteRedirect) {
      response.redirect(301, error.location);
      return;
    }
    if (error instanceof SiteNotFound) {
      this.send(response, 404, notFoundPage(error.message));
      return;
    }
    if (error instanceof ApplicationError && error.code === 'ERR_RATE_LIMIT') {
      this.send(response, 429, notFoundPage(error.message));
      return;
    }
    throw error;
  }

  @Get()
  home(@Req() request: Request, @Res() response: Response) {
    return this.render(request, response, (site) => this.website.home(site));
  }

  @Get('gioi-thieu')
  intro(@Req() request: Request, @Res() response: Response) {
    return this.render(request, response, (site) => this.website.page(site, 'intro'));
  }

  @Get('co-cau-to-chuc')
  organization(@Req() request: Request, @Res() response: Response) {
    return this.render(request, response, (site) => this.website.page(site, 'organization'));
  }

  @Get('tin-tuc')
  news(@Query('trang') page: unknown, @Req() request: Request, @Res() response: Response) {
    return this.render(request, response, (site) => this.website.postIndex(site, 'news', readPage(page)));
  }

  @Get('tin-tuc/:slug')
  newsDetail(@Param('slug') slug: string, @Req() request: Request, @Res() response: Response) {
    return this.render(request, response, (site) => this.website.postDetail(site, 'news', slug));
  }

  @Get('thong-bao')
  announcements(@Query('trang') page: unknown, @Req() request: Request, @Res() response: Response) {
    return this.render(request, response, (site) => this.website.postIndex(site, 'announcement', readPage(page)));
  }

  @Get('thong-bao/:slug')
  announcementDetail(@Param('slug') slug: string, @Req() request: Request, @Res() response: Response) {
    return this.render(request, response, (site) => this.website.postDetail(site, 'announcement', slug));
  }

  @Get('van-ban')
  documents(
    @Query('trang') page: unknown,
    @Query('q') keyword: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const text = typeof keyword === 'string' && keyword.trim() ? keyword.trim().slice(0, 200) : null;
    return this.render(request, response, (site) => this.website.documents(site, readPage(page), text));
  }

  @Get('van-ban/:id/tep')
  async documentFile(@Param('id') id: string, @Req() request: Request, @Res() response: Response) {
    try {
      await this.website.context(request);
      if (!isUuid(id)) {
        throw new SiteNotFound('Không tìm thấy tệp văn bản công khai.');
      }
      const file = await this.website.documentFile(id);
      sendFile(response, file);
    } catch (error) {
      this.fail(response, error);
    }
  }

  @Get('tuyen-sinh')
  admissions(@Req() request: Request, @Res() response: Response) {
    return this.render(request, response, (site) => this.website.admissionsPage(site));
  }

  @Get('cong-khai')
  disclosures(@Req() request: Request, @Res() response: Response) {
    return this.render(request, response, (site) => this.website.disclosures(site));
  }

  @Get('cong-khai/:slug')
  disclosureDetail(@Param('slug') slug: string, @Req() request: Request, @Res() response: Response) {
    return this.render(request, response, (site) => this.website.postDetail(site, 'disclosure', slug));
  }

  @Get('thoi-khoa-bieu')
  timetable(@Req() request: Request, @Res() response: Response) {
    return this.render(request, response, (site) => this.website.timetable(site));
  }

  @Get('thu-vien-anh')
  albums(@Query('trang') page: unknown, @Req() request: Request, @Res() response: Response) {
    return this.render(request, response, (site) => this.website.albumIndex(site, readPage(page)));
  }

  @Get('thu-vien-anh/:slug')
  albumDetail(@Param('slug') slug: string, @Req() request: Request, @Res() response: Response) {
    return this.render(request, response, (site) => this.website.albumDetail(site, slug));
  }

  @Get('lien-he')
  contact(@Query('da-gui') sent: unknown, @Req() request: Request, @Res() response: Response) {
    return this.render(request, response, (site) => this.website.contactPage(site, { sent: sent === '1' }));
  }

  @Post('lien-he')
  async submitContact(@Body() body: RequestBody, @Req() request: Request, @Res() response: Response) {
    try {
      const site = await this.website.context(request);
      this.limiter.hit('submit', request.ip);
      const result = await this.website.submitContact(body);
      if (result.errors.length > 0) {
        this.send(response, 422, this.website.contactPage(site, { errors: result.errors, values: result.values }));
        return;
      }
      response.redirect(303, `${link(site.frame, '/lien-he')}?da-gui=1`);
    } catch (error) {
      this.fail(response, error);
    }
  }

  @Get('tep/:id')
  async file(@Param('id') id: string, @Req() request: Request, @Res() response: Response) {
    try {
      const site = await this.website.context(request);
      if (!isUuid(id)) {
        throw new SiteNotFound('Không tìm thấy tệp.');
      }
      sendFile(response, await this.website.publicFile(site, id), 'public, max-age=3600');
    } catch (error) {
      this.fail(response, error);
    }
  }

  @Get('robots.txt')
  async robots(@Req() request: Request, @Res() response: Response) {
    try {
      response.type('text/plain').send(this.website.robots(await this.website.context(request)));
    } catch (error) {
      this.fail(response, error);
    }
  }

  @Get('sitemap.xml')
  async sitemap(@Req() request: Request, @Res() response: Response) {
    try {
      const site = await this.website.context(request);
      response.type('application/xml').send(await this.website.sitemap(site));
    } catch (error) {
      this.fail(response, error);
    }
  }
}

function sendFile(
  response: Response,
  file: { fileName: string; contentType: string; body: Buffer },
  cache = 'public, max-age=300',
) {
  const inline = file.contentType.startsWith('image/') || file.contentType === 'application/pdf';
  response.setHeader('content-type', file.contentType);
  response.setHeader(
    'content-disposition',
    `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
  );
  response.setHeader('cache-control', cache);
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('content-security-policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  response.send(file.body);
}
