import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { FileStorage } from '../files/file-storage.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { normalizeHostname, sanitizeContent, slugify, textToHtml } from './website-html.js';
import { detectAttachmentType, detectImageType } from './website-support.js';

// Website trường trên tên miền riêng (DT-18 phần 18f, YCTD-144): lọc HTML chống XSS, tên miền và kiểm tra tên miền cho máy
// chủ web, luồng soạn, gửi duyệt, đăng, trả lại, gỡ; album có xác nhận đồng ý; trang công khai chọn theo tên miền; văn bản
// công khai từ văn bản đi; công khai theo quy định; thư liên hệ; chế độ trình diễn và nội dung mẫu. Kịch bản CT-18f-1 đến
// CT-18f-10
type Body = Record<string, unknown> & { error?: Record<string, unknown> };
const errorOf = (body: Body) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string }> };
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c70000000049454e44ae426082',
  'hex',
);
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');

describe('Lọc nội dung, tên miền, loại tệp của website', () => {
  it('CT-18f-1: bỏ script, sự kiện, javascript:, iframe, style; giữ định dạng; liên kết mở thẻ mới; tên miền chuẩn hóa; nhận loại tệp theo nội dung', () => {
    const dirty =
      '<p style="color:red" onclick="x()">Chào <strong>mừng</strong><script>alert(1)</script></p>' +
      '<img src="x" onerror="alert(1)"><img src="https://anh.example.test/a.png" alt="a">' +
      '<a href="javascript:alert(1)">xấu</a><a href="https://example.test">tốt</a><iframe src="https://x"></iframe>' +
      '<svg onload="alert(1)"></svg><h2>Mục</h2><ul><li>Một</li></ul>';
    const clean = sanitizeContent(dirty);
    assert.doesNotMatch(clean, /script|onerror|onclick|javascript|iframe|svg|style=/i);
    assert.match(clean, /<p>Chào <strong>mừng<\/strong><\/p>/);
    assert.match(clean, /<img src="https:\/\/anh\.example\.test\/a\.png" alt="a" \/>/);
    assert.doesNotMatch(clean, /<img src="x"/);
    assert.match(
      clean,
      /<a href="https:\/\/example\.test" rel="noopener noreferrer nofollow" target="_blank">tốt<\/a>/,
    );
    assert.match(clean, /<h2>Mục<\/h2><ul><li>Một<\/li><\/ul>/);
    assert.equal(textToHtml('a <b>\n\nhai\ndòng'), '<p>a &lt;b&gt;</p><p>hai<br>dòng</p>');
    assert.match(slugify('Lễ khai giảng Năm học 2026–2027!'), /^le-khai-giang-nam-hoc-2026-2027-[0-9a-f]{6}$/);
    assert.equal(normalizeHostname(' Truong-Mau.Demo.TEST. '), 'truong-mau.demo.test');
    for (const bad of ['http://a.test', 'a.test:8080', 'localhost', '-a.test', 'a..test', '10.0.0.1', 'a_b.test']) {
      assert.equal(normalizeHostname(bad), null, bad);
    }
    assert.equal(detectImageType(PNG), 'image/png');
    assert.equal(detectImageType(PDF), undefined);
    assert.equal(detectAttachmentType('a.pdf', PDF), 'application/pdf');
    assert.equal(detectAttachmentType('a.exe', Buffer.from('MZ')), undefined);
  });
});

describe('Website trường trên tên miền riêng', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let deputy: LoggedInUser;
  let editor: LoggedInUser;
  let platform: LoggedInUser;
  let teacher: LoggedInUser;
  const PRIMARY = 'truong-thu.example.test';
  const ALIAS = 'www.truong-thu.example.test';
  const DEMO = 'truong-thu.demo.test';

  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, user.accessToken, body) as Promise<{
      status: number;
      body: Body;
    }>;
  const upload = async (
    path: string,
    user: LoggedInUser,
    fields: Record<string, string>,
    body = PNG,
    name = 'anh.png',
  ) => {
    const form = new FormData();
    form.append('file', new Blob([body]), name);
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${user.accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Body };
  };
  // Gọi trang công khai với tên máy tùy chọn (Host) như máy chủ web chuyển tới
  const site = (
    host: string,
    path: string,
    options: { method?: string; form?: Record<string, string>; root?: boolean } = {},
  ) =>
    new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; text: string }>(
      (resolve, reject) => {
        const url = new URL(`${environment.baseUrl}/public/site${path}`);
        const payload = options.form ? new URLSearchParams(options.form).toString() : undefined;
        const request = httpRequest(
          {
            hostname: url.hostname,
            port: url.port,
            path: `${url.pathname}${url.search}`,
            method: options.method ?? 'GET',
            headers: {
              host,
              ...(options.root ? { 'x-website-root': '1' } : {}),
              ...(payload
                ? { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(payload) }
                : {}),
            },
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () =>
              resolve({
                status: response.statusCode ?? 0,
                headers: response.headers,
                text: Buffer.concat(chunks).toString('utf8'),
              }),
            );
          },
        );
        request.on('error', reject);
        if (payload) {
          request.write(payload);
        }
        request.end();
      },
    );
  const domainCheck = async (domain: string) =>
    (await fetch(`${environment.baseUrl}/public/website/domain-check?domain=${encodeURIComponent(domain)}`)).status;
  const createPost = async (user: LoggedInUser, body: Record<string, unknown>) => {
    const created = await api('POST', '/website/posts', user, body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return created.body;
  };
  const publish = async (body: Record<string, unknown>) => {
    const id = (await createPost(editor, body)).id as string;
    assert.equal((await api('POST', `/website/posts/${id}/submit`, editor)).status, 200);
    assert.equal((await api('POST', `/website/posts/${id}/approve`, deputy)).status, 200);
    return (await api('GET', `/website/posts/${id}`, deputy)).body;
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    deputy = await environment.loginAs('VT-15', null);
    editor = await environment.loginAs('VT-12', null);
    platform = await environment.loginAs('VT-01', null);
    teacher = await environment.loginAs('VT-07', null);
    await openTestAcademicYear(environment, principal.accessToken, 'Năm học website', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const yearDatabase = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, yearDatabase.database_name),
    );
    await schoolYear
      .insertInto('org_units')
      .values({
        code: 'WEB',
        name: 'Cơ sở thử website',
        unit_type: 'truong_chinh',
        parent_id: null,
        address: 'Địa chỉ thử',
      })
      .execute();
    const saved = await api('PUT', '/website/settings', principal, {
      site_name: 'Trường thử website',
      slogan: 'Khẩu hiệu thử',
      introduction: 'Giới thiệu ngắn <b>không phải HTML</b>',
      address: 'Địa chỉ thử',
      phone: '0280000000',
      email: 'lienhe@example.test',
      primary_color: '#0F766E',
      school_levels: ['MN'],
      admission_form_url: 'https://phuhuynh.example.test/#tuyen-sinh',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  it('CT-18f-2: tên miền lưu trong cơ sở dữ liệu, chỉ người cấu hình sửa; mỗi trường một tên miền chính; máy chủ web chỉ được cấp chứng chỉ cho tên miền đang dùng', async () => {
    assert.equal((await api('GET', '/website/domains', editor)).status, 403);
    assert.equal((await api('POST', '/website/domains', teacher, { hostname: PRIMARY })).status, 403);
    const invalid = await api('POST', '/website/domains', platform, {
      hostname: 'https://truong.test/',
      kind: 'primary',
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(
      errorOf(invalid.body).details?.map((detail) => detail.field),
      ['hostname'],
    );
    const primary = await api('POST', '/website/domains', platform, {
      hostname: PRIMARY.toUpperCase(),
      kind: 'primary',
    });
    assert.equal(primary.status, 201, JSON.stringify(primary.body));
    assert.equal(primary.body.hostname, PRIMARY);
    const second = await api('POST', '/website/domains', principal, { hostname: 'khac.example.test', kind: 'primary' });
    assert.equal(second.status, 422);
    assert.equal(errorOf(second.body).rule_code, 'YCTD-144');
    assert.equal((await api('POST', '/website/domains', principal, { hostname: PRIMARY, kind: 'alias' })).status, 409);
    const alias = await api('POST', '/website/domains', principal, { hostname: ALIAS, kind: 'alias' });
    assert.equal(alias.status, 201);
    const demo = await api('POST', '/website/domains', principal, { hostname: DEMO, kind: 'demo' });
    assert.equal(demo.status, 201);
    const confirmed = await api('POST', `/website/domains/${primary.body.id}/dns-confirmation`, principal, {
      confirmed: true,
    });
    assert.equal(confirmed.status, 200);
    assert.ok(confirmed.body.dns_confirmed_at);
    assert.equal(await domainCheck(PRIMARY), 200);
    assert.equal(await domainCheck(DEMO), 200);
    assert.equal(await domainCheck('la.example.test'), 404);
    assert.equal(await domainCheck('khong hop le'), 404);
    const extra = await api('POST', '/website/domains', principal, { hostname: 'tam.example.test', kind: 'alias' });
    assert.equal((await api('PATCH', `/website/domains/${extra.body.id}`, principal, { active: false })).status, 200);
    assert.equal(await domainCheck('tam.example.test'), 404);
    assert.equal((await api('DELETE', `/website/domains/${extra.body.id}`, principal)).status, 204);
    const events = await environment.system
      .selectFrom('website_events')
      .select('action')
      .where('target_type', '=', 'domain')
      .execute();
    assert.ok(events.some((event) => event.action === 'dns_confirm'));
  });

  it('CT-18f-3: bài viết đi qua nháp, chờ duyệt, đã đăng, đã gỡ; nội dung lọc trước khi lưu; người soạn không tự đăng; bài đã đăng không sửa, không xóa', async () => {
    const created = await createPost(editor, {
      kind: 'news',
      title: 'Tin thử website',
      summary: 'Tóm tắt tin thử',
      body_html: '<p>Nội dung <em>tin</em></p><script>alert(1)</script><img src=x onerror=alert(1)>',
      pinned: true,
    });
    const id = created.id as string;
    assert.equal(created.status, 'draft');
    assert.equal(created.body_html, '<p>Nội dung <em>tin</em></p>');
    assert.equal((await api('POST', `/website/posts/${id}/approve`, deputy)).status, 422);
    assert.equal((await api('POST', `/website/posts/${id}/submit`, editor)).status, 200);
    assert.equal(
      (await api('PUT', `/website/posts/${id}`, editor, { title: 'Sửa', body_html: '<p>x</p>' })).status,
      422,
    );
    assert.equal((await api('POST', `/website/posts/${id}/approve`, editor)).status, 403);
    const returned = await api('POST', `/website/posts/${id}/return`, deputy, { note: 'Bổ sung ảnh' });
    assert.equal(returned.body.status, 'draft');
    assert.equal(returned.body.return_note, 'Bổ sung ảnh');
    assert.equal((await upload(`/website/posts/${id}/files`, editor, { purpose: 'cover' })).status, 200);
    assert.equal((await upload(`/website/posts/${id}/files`, editor, { purpose: 'cover' }, PDF, 'a.pdf')).status, 400);
    assert.equal(
      (await upload(`/website/posts/${id}/files`, editor, { purpose: 'attachment' }, PDF, 'ke-hoach.pdf')).status,
      200,
    );
    assert.equal((await api('POST', `/website/posts/${id}/submit`, editor)).status, 200);
    const approved = await api('POST', `/website/posts/${id}/approve`, deputy);
    assert.equal(approved.body.status, 'published');
    assert.ok(approved.body.first_published_at);
    assert.equal(((approved.body.files as Body[]) ?? []).length, 2);
    assert.equal((await api('DELETE', `/website/posts/${id}`, deputy)).status, 422);
    assert.equal((await api('POST', `/website/posts/${id}/unpublish`, deputy, {})).status, 400);
    const unpublished = await api('POST', `/website/posts/${id}/unpublish`, deputy, { reason: 'Cập nhật' });
    assert.equal(unpublished.body.status, 'unpublished');
    assert.equal(
      (await api('PUT', `/website/posts/${id}`, editor, { title: 'Tin thử website', body_html: '<p>Mới</p>' })).status,
      200,
    );
    assert.equal((await api('POST', `/website/posts/${id}/submit`, editor)).status, 200);
    assert.equal((await api('POST', `/website/posts/${id}/approve`, principal)).status, 200);
    const empty = await createPost(editor, { kind: 'announcement', title: 'Thông báo trống' });
    const refused = await api('POST', `/website/posts/${empty.id}/submit`, editor);
    assert.equal(refused.status, 422);
    assert.equal((await api('DELETE', `/website/posts/${empty.id}`, editor)).status, 204);
    const page = await createPost(editor, {
      kind: 'page',
      page_key: 'intro',
      title: 'Giới thiệu nhà trường',
      body_html: '<p>Lịch sử</p>',
    });
    assert.equal(
      (await api('POST', '/website/posts', editor, { kind: 'page', page_key: 'intro', title: 'Trùng' })).status,
      409,
    );
    assert.equal((await api('POST', `/website/posts/${page.id}/submit`, editor)).status, 200);
    assert.equal((await api('POST', `/website/posts/${page.id}/approve`, deputy)).status, 200);
    const list = await api('GET', '/website/posts?kind=news&status=published', editor);
    assert.ok((list.body.items as Body[]).some((item) => item.id === id));
    assert.equal((await api('GET', '/website/posts', teacher)).status, 403);
    const review = await api('GET', '/website/review', deputy);
    assert.equal(review.status, 200);
    assert.equal((await api('GET', '/website/review', editor)).status, 403);
  });

  it('CT-18f-4: trang công khai chọn theo tên miền: tên miền lạ báo không tìm thấy, tên miền phụ chuyển về tên miền chính, tên miền trình diễn có dải trình diễn và không lập chỉ mục; trang không có script', async () => {
    assert.equal((await site('la.example.test', '/')).status, 404);
    const home = await site(PRIMARY, '/');
    assert.equal(home.status, 200);
    assert.match(home.text, /Trường thử website/);
    assert.match(home.text, /Tin thử website/);
    assert.match(home.text, /Giới thiệu ngắn &lt;b&gt;không phải HTML&lt;\/b&gt;/);
    assert.doesNotMatch(home.text, /<script/i);
    assert.doesNotMatch(home.text, /Trang trình diễn/);
    assert.match(String(home.headers['content-security-policy']), /default-src 'none'/);
    assert.match(home.text, /href="\/api\/v1\/public\/site\/tin-tuc\//);
    const rooted = await site(PRIMARY, '/tin-tuc', { root: true });
    assert.match(rooted.text, /href="\/tin-tuc\/tin-thu-website-/);
    const slug = /\/tin-tuc\/(tin-thu-website-[0-9a-f]{6})/.exec(rooted.text)?.[1];
    assert.ok(slug);
    const detail = await site(PRIMARY, `/tin-tuc/${slug}`);
    assert.match(detail.text, /<p>Mới<\/p>/);
    assert.equal((await site(PRIMARY, `/thong-bao/${slug}`)).status, 404);
    const redirect = await site(`${ALIAS}:8443`, '/tin-tuc?trang=1', { root: true });
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.location, `http://${PRIMARY}/tin-tuc?trang=1`);
    const demo = await site(DEMO, '/');
    assert.match(demo.text, /Trang trình diễn/);
    assert.match(demo.text, /noindex/);
    assert.match((await site(DEMO, '/robots.txt')).text, /Disallow: \//);
    assert.match((await site(PRIMARY, '/robots.txt')).text, /Sitemap: http:\/\/truong-thu\.example\.test/);
    assert.match((await site(PRIMARY, '/sitemap.xml')).text, new RegExp(`/tin-tuc/${slug}`));
    const intro = await site(PRIMARY, '/gioi-thieu');
    assert.match(intro.text, /Lịch sử/);
    const organization = await site(PRIMARY, '/co-cau-to-chuc');
    assert.match(organization.text, /Cơ sở thử website/);
    assert.match(organization.text, /Nội dung đang được cập nhật/);
    const admissions = await site(PRIMARY, '/tuyen-sinh');
    assert.match(admissions.text, /chưa mở đợt tuyển sinh/);
    const timetable = await site(PRIMARY, '/thoi-khoa-bieu');
    assert.equal(timetable.status, 200);
    assert.doesNotMatch(home.text, /Thời khóa biểu<\/a>/);
  });

  it('CT-18f-5: album cần ảnh và xác nhận cha mẹ đồng ý trước khi gửi duyệt; ảnh chỉ công khai khi album đã đăng', async () => {
    const created = await api('POST', '/website/albums', editor, { title: 'Album thử', event_date: '2026-10-15' });
    assert.equal(created.status, 201);
    const id = created.body.id as string;
    assert.equal((await api('POST', `/website/albums/${id}/submit`, editor, { consent_confirmed: true })).status, 422);
    const uploaded = await upload(`/website/albums/${id}/files`, editor, { caption: 'Ảnh hoạt động' });
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
    const photoId = ((uploaded.body.files as Body[])[0] as Body).id as string;
    assert.equal(uploaded.body.cover_file_id, photoId);
    const noConsent = await api('POST', `/website/albums/${id}/submit`, editor, {});
    assert.equal(noConsent.status, 422);
    assert.deepEqual(
      errorOf(noConsent.body).details?.map((detail) => detail.field),
      ['consent_confirmed'],
    );
    assert.equal((await site(PRIMARY, `/tep/${photoId}`)).status, 404);
    assert.equal((await api('POST', `/website/albums/${id}/submit`, editor, { consent_confirmed: true })).status, 200);
    const approved = await api('POST', `/website/albums/${id}/approve`, principal);
    assert.equal(approved.body.status, 'published');
    assert.equal(approved.body.consent_confirmed, true);
    const albums = await site(PRIMARY, '/thu-vien-anh');
    const slug = /\/thu-vien-anh\/(album-thu-[0-9a-f]{6})/.exec(albums.text)?.[1];
    assert.ok(slug);
    const detail = await site(PRIMARY, `/thu-vien-anh/${slug}`);
    assert.match(detail.text, /Ảnh hoạt động/);
    const photo = await site(PRIMARY, `/tep/${photoId}`);
    assert.equal(photo.status, 200);
    assert.equal(photo.headers['content-type'], 'image/png');
    assert.equal((await site(PRIMARY, '/tep/khong-phai-ma')).status, 404);
    const preview = await fetch(`${environment.baseUrl}/website/files/${photoId}`, {
      headers: { authorization: `Bearer ${editor.accessToken}` },
    });
    assert.equal(preview.status, 200);
    assert.equal(preview.headers.get('content-type'), 'image/png');
  });

  it('CT-18f-6: văn bản công khai lấy từ văn bản đi đã ban hành và đã công bố; tải bản đã ký; văn bản chưa công bố không hiện', async () => {
    const storage = environment.api.get(FileStorage);
    const book = await environment.system
      .insertInto('document_books')
      .values({
        name: 'Sổ đi thử website',
        direction: 'outgoing',
        org_unit_id: null,
        year: 2026,
        start_date: '2026-01-01',
        end_date: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    // Sổ văn bản đi bắt buộc khi đã ban hành; dùng sổ vừa tạo
    const make = async (number: number, published: boolean) => {
      const document = await environment.system
        .insertInto('outgoing_documents')
        .values({
          eoffice_number: 9000 + number,
          summary: `V/v văn bản công khai thử ${number}`,
          drafter_id: principal.userId,
          drafter_name: 'Người soạn thử',
          signer_id: principal.userId,
          signer_name: 'Người ký thử',
          signer_title: 'Hiệu trưởng',
          status: 'issued',
          book_id: book.id,
          issue_number: number,
          symbol: `${number}/TB-THU`,
          issue_date: '2026-10-20',
          copies: 1,
          issued_at: new Date(),
          published,
          created_by: principal.userId,
          created_by_name: 'Người soạn thử',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return document.id;
    };
    const shown = await make(1, true);
    await make(2, false);
    await storage.put('website-test/signed.pdf', PDF, 'application/pdf');
    await environment.system
      .insertInto('outgoing_document_files')
      .values({
        document_id: shown,
        kind: 'signed',
        file_name: 'van-ban-da-ky.pdf',
        content_type: 'application/pdf',
        size_bytes: PDF.length,
        sha256: 'x',
        storage_key: 'website-test/signed.pdf',
        created_by: principal.userId,
        created_by_name: 'Người soạn thử',
      })
      .execute();
    const page = await site(PRIMARY, '/van-ban');
    assert.match(page.text, /1\/TB-THU/);
    assert.doesNotMatch(page.text, /2\/TB-THU/);
    assert.match(page.text, new RegExp(`/van-ban/${shown}/tep`));
    const searched = await site(PRIMARY, '/van-ban?q=kh%C3%B4ng%20c%C3%B3');
    assert.match(searched.text, /Chưa có văn bản công khai/);
    const file = await site(PRIMARY, `/van-ban/${shown}/tep`);
    assert.equal(file.status, 200);
    assert.equal(file.headers['content-type'], 'application/pdf');
    assert.match((await site(PRIMARY, '/')).text, /1\/TB-THU/);
  });

  it('CT-18f-7: công khai theo quy định theo Thông tư 09/2024 chỉ hiện nhóm của cấp học của trường; bài công khai gửi duyệt được khi chỉ có tệp', async () => {
    const categories = await api('GET', '/website/disclosure-categories', editor);
    assert.ok((categories.body.items as Body[]).some((item) => item.code === 'mn-quality'));
    assert.equal(
      (await api('POST', '/website/posts', editor, { kind: 'disclosure', title: 'Thiếu nhóm' })).status,
      400,
    );
    assert.equal(
      (
        await api('POST', '/website/posts', editor, {
          kind: 'disclosure',
          title: 'Sai năm',
          disclosure_category: 'finance',
          disclosure_year: '2026',
        })
      ).status,
      400,
    );
    const created = await createPost(editor, {
      kind: 'disclosure',
      title: 'Công khai thu chi năm học',
      disclosure_category: 'finance',
      disclosure_year: '2026-2027',
    });
    assert.equal((await api('POST', `/website/posts/${created.id}/submit`, editor)).status, 422);
    assert.equal(
      (await upload(`/website/posts/${created.id}/files`, editor, { purpose: 'attachment' }, PDF, 'thu-chi.pdf'))
        .status,
      200,
    );
    assert.equal((await api('POST', `/website/posts/${created.id}/submit`, editor)).status, 200);
    assert.equal((await api('POST', `/website/posts/${created.id}/approve`, deputy)).status, 200);
    const page = await site(PRIMARY, '/cong-khai');
    assert.match(page.text, /Thông tư 09\/2024\/TT-BGDĐT/);
    assert.match(page.text, /Điều 6/);
    assert.doesNotMatch(page.text, /Điều 8/);
    assert.match(page.text, /Công khai thu chi năm học/);
    assert.match(page.text, /Năm học 2026-2027/);
    const slug = /\/cong-khai\/(cong-khai-thu-chi-nam-hoc-[0-9a-f]{6})/.exec(page.text)?.[1];
    const detail = await site(PRIMARY, `/cong-khai/${slug}`);
    assert.match(detail.text, /thu-chi\.pdf/);
  });

  it('CT-18f-8: thư liên hệ: kiểm tra dữ liệu, ô bẫy bỏ qua, người duyệt đánh dấu đã xử lý', async () => {
    const invalid = await site(PRIMARY, '/lien-he', {
      method: 'POST',
      form: { full_name: '', subject: 'Hỏi', message: 'x' },
    });
    assert.equal(invalid.status, 422);
    assert.match(invalid.text, /Nhập số điện thoại hoặc thư điện tử/);
    const sent = await site(PRIMARY, '/lien-he', {
      method: 'POST',
      root: true,
      form: {
        full_name: 'Phụ huynh thử',
        phone: '0900000000',
        subject: 'Hỏi tuyển sinh',
        message: 'Xin thông tin <b>tuyển sinh</b>',
      },
    });
    assert.equal(sent.status, 303);
    assert.equal(sent.headers.location, '/lien-he?da-gui=1');
    await site(PRIMARY, '/lien-he', {
      method: 'POST',
      form: { full_name: 'Máy', phone: '0900000000', subject: 'Quảng cáo', message: 'x', website: 'http://spam.test' },
    });
    const inbox = await api('GET', '/website/contacts?status=new', editor);
    const items = inbox.body.items as Body[];
    assert.equal(items.length, 1);
    assert.equal(items[0]?.message, 'Xin thông tin <b>tuyển sinh</b>');
    assert.equal((await api('POST', `/website/contacts/${items[0]?.id}/handle`, editor, {})).status, 403);
    const handled = await api('POST', `/website/contacts/${items[0]?.id}/handle`, deputy, { note: 'Đã gọi lại' });
    assert.equal(handled.body.status, 'handled');
    assert.equal((await api('POST', `/website/contacts/${items[0]?.id}/handle`, deputy, {})).status, 422);
    const confirmation = await site(PRIMARY, '/lien-he?da-gui=1');
    assert.match(confirmation.text, /đã nhận thư liên hệ/);
  });

  it('CT-18f-9: chế độ trình diễn: nội dung mẫu chỉ tạo khi bật, chỉ hiện khi bật, xóa được; ảnh biểu trưng thay ảnh cũ', async () => {
    assert.equal((await api('POST', '/website/sample-content', principal)).status, 422);
    const settings = (await api('GET', '/website/settings', principal)).body;
    const on = await api('PUT', '/website/settings', principal, { ...settings, demo_mode: true, show_timetable: true });
    assert.equal(on.status, 200, JSON.stringify(on.body));
    const created = await api('POST', '/website/sample-content', principal);
    assert.equal(created.status, 200);
    assert.equal(created.body.sample_count, 4);
    assert.equal((await api('POST', '/website/sample-content', principal)).status, 422);
    const demoHome = await site(PRIMARY, '/');
    assert.match(demoHome.text, /\[Mẫu\] Lễ khai giảng/);
    assert.match(demoHome.text, /Trang trình diễn/);
    assert.match(demoHome.text, /Thời khóa biểu<\/a>/);
    const off = await api('PUT', '/website/settings', principal, { ...settings, demo_mode: false });
    assert.equal(off.status, 200);
    assert.doesNotMatch((await site(PRIMARY, '/')).text, /\[Mẫu\]/);
    const removed = await api('DELETE', '/website/sample-content', principal);
    assert.equal(removed.body.sample_count, 0);
    assert.equal((await api('PUT', '/website/settings', editor, settings)).status, 403);
    const badSettings = await api('PUT', '/website/settings', principal, {
      site_name: '',
      email: 'sai',
      map_url: 'javascript:alert(1)',
      primary_color: 'red',
      school_levels: [],
    });
    assert.deepEqual(
      errorOf(badSettings.body)
        .details?.map((detail) => detail.field)
        .sort(),
      ['email', 'map_url', 'primary_color', 'school_levels', 'site_name'],
    );
    const first = await upload('/website/settings/images/logo', principal, {});
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const firstId = first.body.logo_file_id as string;
    assert.equal((await site(PRIMARY, `/tep/${firstId}`)).status, 200);
    const second = await upload('/website/settings/images/logo', principal, {});
    assert.notEqual(second.body.logo_file_id, firstId);
    assert.equal((await site(PRIMARY, `/tep/${firstId}`)).status, 404);
    assert.match((await site(PRIMARY, '/')).text, new RegExp(`/tep/${second.body.logo_file_id as string}`));
  });

  it('CT-18f-10: bài nháp, chờ duyệt, đã gỡ không hiện trên website; tệp của bài chưa đăng không tải được', async () => {
    const draft = await createPost(editor, { kind: 'news', title: 'Tin còn nháp', body_html: '<p>Nháp</p>' });
    const withFile = await upload(`/website/posts/${draft.id}/files`, editor, { purpose: 'cover' });
    const coverId = withFile.body.cover_file_id as string;
    assert.equal((await site(PRIMARY, `/tep/${coverId}`)).status, 404);
    assert.doesNotMatch((await site(PRIMARY, '/tin-tuc')).text, /Tin còn nháp/);
    const published = await publish({ kind: 'announcement', title: 'Thông báo sẽ gỡ', body_html: '<p>Gỡ</p>' });
    assert.match((await site(PRIMARY, '/thong-bao')).text, /Thông báo sẽ gỡ/);
    await api('POST', `/website/posts/${published.id}/unpublish`, deputy, { reason: 'Hết hiệu lực' });
    assert.doesNotMatch((await site(PRIMARY, '/thong-bao')).text, /Thông báo sẽ gỡ/);
    assert.equal((await site(PRIMARY, `/thong-bao/${published.slug as string}`)).status, 404);
  });
});
