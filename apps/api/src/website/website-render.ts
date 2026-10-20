import { escapeHtml as e } from './website-html.js';

// Khung trang công khai của website trường (DT-18 phần 18f, YCTD-144): HTML dựng ở máy chủ, không có JavaScript; kiểu
// chữ, màu viết sẵn trong trang (chính sách bảo mật nội dung chặn mọi script). Mọi chữ lấy từ cơ sở dữ liệu đều thoát ký tự
// trước khi chèn; nội dung bài viết là HTML đã lọc (website-html.ts)
export interface SiteFrame {
  base: string;
  siteName: string;
  slogan: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  officeHours: string | null;
  facebookUrl: string | null;
  mapUrl: string | null;
  footerNote: string | null;
  color: string;
  logoUrl: string | null;
  demo: boolean;
  showTimetable: boolean;
}

export interface NavItem {
  key: string;
  label: string;
  path: string;
}

export function navigation(frame: SiteFrame): NavItem[] {
  return [
    { key: 'home', label: 'Trang chủ', path: '/' },
    { key: 'intro', label: 'Giới thiệu', path: '/gioi-thieu' },
    { key: 'organization', label: 'Cơ cấu tổ chức', path: '/co-cau-to-chuc' },
    { key: 'news', label: 'Tin tức', path: '/tin-tuc' },
    { key: 'announcement', label: 'Thông báo', path: '/thong-bao' },
    { key: 'documents', label: 'Văn bản', path: '/van-ban' },
    { key: 'admissions', label: 'Tuyển sinh', path: '/tuyen-sinh' },
    { key: 'disclosure', label: 'Công khai', path: '/cong-khai' },
    ...(frame.showTimetable ? [{ key: 'timetable', label: 'Thời khóa biểu', path: '/thoi-khoa-bieu' }] : []),
    { key: 'albums', label: 'Thư viện ảnh', path: '/thu-vien-anh' },
    { key: 'contact', label: 'Liên hệ', path: '/lien-he' },
  ];
}

export const link = (frame: SiteFrame, path: string) => `${frame.base}${path === '/' && frame.base ? '' : path}` || '/';

const STYLE = (color: string) => `
:root{--c:${color};--t:#1f2937;--m:#6b7280;--b:#e5e7eb;--bg:#f9fafb}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:var(--t);background:var(--bg);line-height:1.6}
a{color:var(--c)}img{max-width:100%;height:auto}
.wrap{max-width:1100px;margin:0 auto;padding:0 16px}
.demo{background:#fef3c7;color:#92400e;text-align:center;padding:6px 16px;font-size:14px}
header.top{background:#fff;border-bottom:3px solid var(--c)}
.brand{display:flex;align-items:center;gap:12px;padding:14px 0}.brand img{height:56px;width:auto}
.brand .name{font-size:22px;font-weight:700;color:var(--c);text-decoration:none}.brand .slogan{color:var(--m);font-size:14px}
nav.menu{background:var(--c)}nav.menu ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap}
nav.menu a{display:block;color:#fff;text-decoration:none;padding:10px 14px;font-size:15px}nav.menu a[aria-current=page],nav.menu a:hover{background:rgba(0,0,0,.18)}
main{padding:24px 0;min-height:50vh}h1{font-size:26px;margin:0 0 16px}h2{font-size:20px;margin:24px 0 12px;color:var(--c)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.card{background:#fff;border:1px solid var(--b);border-radius:8px;overflow:hidden}.card .body{padding:12px}
.card h3{font-size:17px;margin:0 0 6px}.card h3 a{color:var(--t);text-decoration:none}.meta{color:var(--m);font-size:13px}
.cols{display:grid;grid-template-columns:2fr 1fr;gap:24px}@media(max-width:800px){.cols{grid-template-columns:1fr}}
.list{list-style:none;margin:0;padding:0}.list li{background:#fff;border:1px solid var(--b);border-radius:8px;padding:10px 12px;margin-bottom:8px}
.article{background:#fff;border:1px solid var(--b);border-radius:8px;padding:20px}.article .content table{border-collapse:collapse}
.article .content td,.article .content th{border:1px solid var(--b);padding:4px 8px}
table.docs{width:100%;border-collapse:collapse;background:#fff}table.docs th,table.docs td{border:1px solid var(--b);padding:8px;text-align:left;vertical-align:top}
table.docs th{background:#f3f4f6}.pager{display:flex;gap:8px;margin-top:16px}
.banner{width:100%;max-height:360px;object-fit:cover;border-radius:8px;display:block;margin-bottom:16px}
.photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}.photos figure{margin:0;background:#fff;border:1px solid var(--b);border-radius:8px;overflow:hidden}
.photos img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}.photos figcaption{padding:6px 8px;font-size:13px;color:var(--m)}
form.contact{background:#fff;border:1px solid var(--b);border-radius:8px;padding:16px;display:grid;gap:12px;max-width:640px}
form.contact label{display:grid;gap:4px;font-weight:600;font-size:14px}form.contact input,form.contact textarea{font:inherit;padding:8px;border:1px solid #d1d5db;border-radius:6px}
form.contact .hp{position:absolute;left:-9999px}.error{color:#b91c1c;font-size:13px;font-weight:400}
.notice{background:#ecfdf5;border:1px solid #a7f3d0;padding:10px 12px;border-radius:8px;margin-bottom:12px}
button{background:var(--c);color:#fff;border:0;border-radius:6px;padding:10px 16px;font:inherit;cursor:pointer;justify-self:start}
footer{background:#111827;color:#d1d5db;padding:24px 0;font-size:14px}footer a{color:#fff}
`;

export function layout(
  frame: SiteFrame,
  options: { title: string; active: string; content: string; description?: string },
) {
  const title = options.title === frame.siteName ? frame.siteName : `${options.title} - ${frame.siteName}`;
  const items = navigation(frame)
    .map(
      (item) =>
        `<li><a href="${e(link(frame, item.path))}"${item.key === options.active ? ' aria-current="page"' : ''}>${e(item.label)}</a></li>`,
    )
    .join('');
  const contact = [
    frame.address ? `<div>Địa chỉ: ${e(frame.address)}</div>` : '',
    frame.phone
      ? `<div>Điện thoại: <a href="tel:${e(frame.phone.replace(/[^\d+]/g, ''))}">${e(frame.phone)}</a></div>`
      : '',
    frame.email ? `<div>Thư điện tử: <a href="mailto:${e(frame.email)}">${e(frame.email)}</a></div>` : '',
    frame.officeHours ? `<div>Giờ làm việc: ${e(frame.officeHours)}</div>` : '',
    frame.facebookUrl
      ? `<div><a href="${e(frame.facebookUrl)}" rel="noopener noreferrer" target="_blank">Trang mạng xã hội của trường</a></div>`
      : '',
  ].join('');
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
${options.description ? `<meta name="description" content="${e(options.description.slice(0, 300))}">` : ''}
${frame.demo ? '<meta name="robots" content="noindex, nofollow">' : ''}
<style>${STYLE(frame.color)}</style>
</head>
<body>
${frame.demo ? '<div class="demo" role="note">Trang trình diễn: nội dung chỉ để xem thử, không phải thông tin chính thức của nhà trường</div>' : ''}
<header class="top"><div class="wrap brand">
${frame.logoUrl ? `<img src="${e(frame.logoUrl)}" alt="">` : ''}
<div><a class="name" href="${e(link(frame, '/'))}">${e(frame.siteName)}</a>${frame.slogan ? `<div class="slogan">${e(frame.slogan)}</div>` : ''}</div>
</div></header>
<nav class="menu" aria-label="Menu chính"><div class="wrap"><ul>${items}</ul></div></nav>
<main><div class="wrap">${options.content}</div></main>
<footer><div class="wrap"><strong>${e(frame.siteName)}</strong>${contact}${frame.footerNote ? `<div>${e(frame.footerNote)}</div>` : ''}</div></footer>
</body>
</html>`;
}

const DATE = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return '';
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  return DATE.format(new Date(value));
}

export interface PostCard {
  slug: string;
  title: string;
  summary: string | null;
  published_at: Date | null;
  cover_file_id: string | null;
}

export function postCards(frame: SiteFrame, section: string, posts: PostCard[], empty: string): string {
  if (posts.length === 0) {
    return `<p class="meta">${e(empty)}</p>`;
  }
  return `<div class="grid">${posts
    .map(
      (post) =>
        `<article class="card">${
          post.cover_file_id ? `<img src="${e(link(frame, `/tep/${post.cover_file_id}`))}" alt="">` : ''
        }<div class="body"><h3><a href="${e(link(frame, `${section}/${post.slug}`))}">${e(post.title)}</a></h3><div class="meta">${e(
          formatDate(post.published_at),
        )}</div>${post.summary ? `<p>${e(post.summary)}</p>` : ''}</div></article>`,
    )
    .join('')}</div>`;
}

export function postList(frame: SiteFrame, section: string, posts: PostCard[], empty: string): string {
  if (posts.length === 0) {
    return `<p class="meta">${e(empty)}</p>`;
  }
  return `<ul class="list">${posts
    .map(
      (post) =>
        `<li><a href="${e(link(frame, `${section}/${post.slug}`))}">${e(post.title)}</a> <span class="meta">${e(formatDate(post.published_at))}</span></li>`,
    )
    .join('')}</ul>`;
}

export function pager(
  frame: SiteFrame,
  path: string,
  page: number,
  total: number,
  pageSize: number,
  query = '',
): string {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) {
    return '';
  }
  const href = (target: number) => e(`${link(frame, path)}?trang=${target}${query ? `&${query}` : ''}`);
  return `<nav class="pager" aria-label="Phân trang">${page > 1 ? `<a href="${href(page - 1)}">Trang trước</a>` : ''}<span class="meta">Trang ${page}/${pages}</span>${
    page < pages ? `<a href="${href(page + 1)}">Trang sau</a>` : ''
  }</nav>`;
}

export interface AttachmentView {
  id: string;
  file_name: string;
  content_type: string;
  caption: string | null;
}

export function attachments(frame: SiteFrame, files: AttachmentView[]): string {
  const images = files.filter((file) => file.content_type.startsWith('image/'));
  const documents = files.filter((file) => !file.content_type.startsWith('image/'));
  return [
    images.length
      ? `<div class="photos">${images
          .map(
            (file) =>
              `<figure><img src="${e(link(frame, `/tep/${file.id}`))}" alt="${e(file.caption ?? '')}">${file.caption ? `<figcaption>${e(file.caption)}</figcaption>` : ''}</figure>`,
          )
          .join('')}</div>`
      : '',
    documents.length
      ? `<h2>Tệp đính kèm</h2><ul class="list">${documents
          .map((file) => `<li><a href="${e(link(frame, `/tep/${file.id}`))}">${e(file.file_name)}</a></li>`)
          .join('')}</ul>`
      : '',
  ].join('');
}

export function notFoundPage(message: string): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Không tìm thấy</title><style>body{font-family:system-ui,sans-serif;max-width:640px;margin:10vh auto;padding:0 16px;color:#1f2937}</style></head><body><h1>Không tìm thấy</h1><p>${e(message)}</p></body></html>`;
}
