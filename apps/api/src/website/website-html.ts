import { randomBytes } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';

// Lọc nội dung bài viết và hàm tiện ích của website trường (DT-18 phần 18f, YCTD-144). Nội dung bài lưu HTML đã lọc theo
// danh sách cho phép (chống XSS): chỉ thẻ định dạng văn bản, bảng, liên kết http, https, mailto, tel và ảnh https; bỏ thuộc
// tính style, sự kiện, iframe, script, form. Lúc hiện trang lọc lại một lần nữa phòng dữ liệu cũ hoặc nhập thẳng vào cơ sở
// dữ liệu
const ALLOWED_TAGS = [
  'p',
  'br',
  'h2',
  'h3',
  'h4',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'img',
  'hr',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'caption',
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    // rel, target do transformTags đặt lại, giá trị người soạn ghi bị thay
    a: ['href', 'title', 'rel', 'target'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['https'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  // Ảnh chỉ nhận địa chỉ https đầy đủ; đường dẫn tương đối bỏ
  exclusiveFilter: (frame) => frame.tag === 'img' && !(frame.attribs.src ?? '').toLowerCase().startsWith('https://'),
  // Liên kết ra ngoài mở ở thẻ mới, không gửi nguồn
  transformTags: {
    a: (tagName, attributes) => ({
      tagName,
      attribs: { ...attributes, rel: 'noopener noreferrer nofollow', target: '_blank' },
    }),
  },
};

export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}

// Chữ thường của nội dung (bỏ thẻ) dùng để kiểm tra bài có nội dung hay không và làm tóm tắt
export function plainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

// Chữ có xuống dòng (tin tuyển sinh, giới thiệu ngắn) thành đoạn HTML đã thoát ký tự
export function textToHtml(value: string | null | undefined): string {
  return (value ?? '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// Đường dẫn bài: tên không dấu, nối gạch ngang, thêm đuôi ngẫu nhiên để không trùng
export function slugify(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return `${base || 'bai'}-${randomBytes(3).toString('hex')}`;
}

// Tên miền: chữ thường, các nhãn chữ, số, gạch ngang, có ít nhất một dấu chấm; không cổng, không địa chỉ IP
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export function normalizeHostname(value: string): string | null {
  const hostname = value.trim().toLowerCase().replace(/\.$/, '');
  if (hostname.length === 0 || hostname.length > 253 || !hostname.includes('.')) {
    return null;
  }
  const labels = hostname.split('.');
  if (!labels.every((label) => LABEL.test(label)) || /^\d+$/.test(labels[labels.length - 1] ?? '')) {
    return null;
  }
  return hostname;
}

// Tên máy của yêu cầu (bỏ cổng); Express đọc X-Forwarded-Host khi tin máy chủ chuyển tiếp
export function requestHostname(hostname: string | undefined): string | null {
  if (!hostname) {
    return null;
  }
  return normalizeHostname(hostname.replace(/:\d+$/, '')) ?? (hostname.split(':')[0]?.toLowerCase() || null);
}
