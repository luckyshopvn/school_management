import { Controller, Get, Inject, Param, Query, Res } from '@nestjs/common';
import { ApplicationError } from '@school-management/server';
import type { Response } from 'express';
import { PublicEndpoint } from '../authentication/authentication.guard.js';
import type { PwaBranding } from './pwa-branding.js';
import { SchoolSettingsService } from './school-settings.controller.js';

// Manifest và biểu tượng của ứng dụng web cài được theo thương hiệu từng trường (DT-26 phần 26a, YCTD-231; tài liệu 32 mục 18.4).
// Công khai theo tên miền của trường: tên hiển thị, tên ngắn, màu chủ đạo, biểu trưng (S3). Không có dữ liệu cá nhân. Biểu tượng là
// ảnh SVG dựng ở máy chủ (nền màu của trường, biểu trưng ở giữa hoặc chữ cái đầu khi chưa có biểu trưng), không cần thư viện xử lý
// ảnh; ảnh PNG 192, 512 của sản phẩm trong thư mục public của ứng dụng là bản dự phòng để trình duyệt nào cũng cài được
// `student`: màn hình học sinh của 23a nằm trong ứng dụng phụ huynh (#hoc-sinh), cài thành ứng dụng riêng mở thẳng màn hình học sinh
export type PwaApplication = 'teacher' | 'parent' | 'student';

const APPLICATIONS: Record<PwaApplication, { label: string; suffix: string; description: string; hash: string }> = {
  teacher: { label: 'Giáo viên', suffix: 'GV', description: 'Ứng dụng giáo viên của trường', hash: '' },
  parent: { label: 'Phụ huynh', suffix: 'PH', description: 'Ứng dụng phụ huynh của trường', hash: '' },
  student: {
    label: 'Học sinh',
    suffix: 'HS',
    description: 'Thi trực tuyến cho học sinh của trường',
    hash: '#hoc-sinh',
  },
};

export const DEFAULT_THEME_COLOR = '#0a8be6';
const BASE_PATTERN = /^\/(?:[a-z0-9-]+\/){0,4}$/;
// Biểu trưng quá lớn thì không nhúng vào biểu tượng (dùng chữ cái đầu)
const MAXIMUM_EMBEDDED_LOGO_BYTES = 512 * 1024;
const EMBEDDABLE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);

// Đường dẫn gốc của ứng dụng do giao diện gửi lên (import.meta.env.BASE_URL): chỉ nhận dạng /, /giao-vien/, /phu-huynh/...
export function normalizeBase(value: unknown): string {
  return typeof value === 'string' && value.length <= 64 && BASE_PATTERN.test(value) ? value : '/';
}

export function readApplication(file: string): PwaApplication {
  const name = file.replace(/\.webmanifest$/, '');
  if (file.endsWith('.webmanifest') && (name === 'teacher' || name === 'parent' || name === 'student')) {
    return name;
  }
  throw new ApplicationError('ERR_NOT_FOUND', 'Không có ứng dụng này');
}

export function shortNameOf(application: PwaApplication, appShortName: string | null): string {
  const meta = APPLICATIONS[application];
  return appShortName ? `${appShortName} ${meta.suffix}` : meta.label;
}

export function buildManifest(application: PwaApplication, base: string, branding: PwaBranding) {
  const meta = APPLICATIONS[application];
  const icon = (variant: string) => `/api/v1/public/pwa/${variant}.svg?v=${branding.revision}`;
  return {
    id: `${base}?ung-dung=${application}`,
    name: `${branding.display_name} – ${meta.label}`,
    short_name: shortNameOf(application, branding.app_short_name),
    description: `${meta.description} ${branding.display_name}`,
    lang: 'vi',
    dir: 'ltr',
    start_url: `${base}${meta.hash}`,
    scope: base,
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: branding.primary_color ?? DEFAULT_THEME_COLOR,
    icons: [
      { src: icon('icon'), sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: icon('icon-maskable'), sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    // Không thuộc chuẩn manifest (trình duyệt bỏ qua): giao diện đặt thẻ apple-touch-icon cho iOS. iOS không đọc SVG nên dùng
    // biểu trưng khi là PNG, không thì ảnh PNG của sản phẩm
    apple_touch_icon:
      branding.logo_content_type === 'image/png' ? '/api/v1/public/branding/logo' : `${base}icon-192.png`,
  };
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

// Chữ cái đầu của từ cuối trong tên trường ("Trường Mầm non Hoa Sen" → "S"), dùng khi chưa có biểu trưng
export function initialOf(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  const last = words[words.length - 1] ?? '';
  return (Array.from(last)[0] ?? 'T').toLocaleUpperCase('vi');
}

// Biểu tượng vuông 512: nền màu của trường; biểu trưng nằm trong khung 60% (bản `maskable` 48% để nằm gọn trong vùng an toàn
// 80% khi máy cắt thành hình tròn); bản thường bo góc, bản `maskable` để vuông cho máy tự cắt
export function buildIcon(
  branding: PwaBranding,
  logo: { data: Buffer; contentType: string } | null,
  maskable: boolean,
): string {
  const color = branding.primary_color ?? DEFAULT_THEME_COLOR;
  const box = maskable ? 246 : 308;
  const offset = (512 - box) / 2;
  const background = `<rect width="512" height="512"${maskable ? '' : ' rx="96"'} fill="${escapeXml(color)}"/>`;
  const content =
    logo && EMBEDDABLE_TYPES.has(logo.contentType) && logo.data.length <= MAXIMUM_EMBEDDED_LOGO_BYTES
      ? `<rect x="${offset - 16}" y="${offset - 16}" width="${box + 32}" height="${box + 32}" rx="40" fill="#ffffff"/>` +
        `<image x="${offset}" y="${offset}" width="${box}" height="${box}" preserveAspectRatio="xMidYMid meet" ` +
        `href="data:${logo.contentType};base64,${logo.data.toString('base64')}"/>`
      : `<text x="256" y="256" dy="0.35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
        `font-weight="700" font-size="${maskable ? 200 : 260}" fill="#ffffff">${escapeXml(initialOf(branding.display_name))}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${background}${content}</svg>`;
}

@Controller('public/pwa')
@PublicEndpoint()
export class PublicPwaController {
  constructor(@Inject(SchoolSettingsService) private readonly service: SchoolSettingsService) {}

  @Get(':file')
  async file(@Param('file') file: string, @Query('base') base: unknown, @Res() response: Response) {
    if (file === 'icon.svg' || file === 'icon-maskable.svg') {
      const [branding, logo] = await Promise.all([this.service.pwaBranding(), this.service.logo()]);
      response
        .status(200)
        .type('image/svg+xml')
        // Ảnh SVG mở trực tiếp không chạy được mã hay tải gì ngoài ảnh nhúng
        .set('content-security-policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'")
        .set('cache-control', 'public, max-age=300')
        .send(buildIcon(branding, logo, file === 'icon-maskable.svg'));
      return;
    }
    const application = readApplication(file);
    const manifest = buildManifest(application, normalizeBase(base), await this.service.pwaBranding());
    response
      .status(200)
      .type('application/manifest+json')
      .set('cache-control', 'public, max-age=300')
      .send(JSON.stringify(manifest));
  }
}
