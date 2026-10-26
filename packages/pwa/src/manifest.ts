// Manifest theo thương hiệu của trường (DT-26 phần 26a, YCTD-231): trỏ thẻ manifest của trang sang manifest do máy chủ sinh
// theo trường đang phục vụ (tên, màu, biểu tượng của trường, S3), rồi đặt các thẻ iOS đọc thay manifest (tên dưới biểu tượng,
// biểu tượng Apple, màu thanh trạng thái). Manifest tĩnh trong public/ vẫn là bản dự phòng khi không gọi được máy chủ
// `student`: màn hình học sinh của 23a trong ứng dụng phụ huynh (#hoc-sinh)
export type PwaApplication = 'teacher' | 'parent' | 'student';

interface BrandedManifest {
  name: string;
  short_name: string;
  theme_color: string;
  apple_touch_icon: string;
}

export function manifestUrl(application: PwaApplication, base: string): string {
  return `/api/v1/public/pwa/${application}.webmanifest?base=${encodeURIComponent(base)}`;
}

function upsertElement(selector: string, create: () => HTMLElement): HTMLElement {
  const found = document.head.querySelector<HTMLElement>(selector);
  if (found) {
    return found;
  }
  const element = create();
  document.head.append(element);
  return element;
}

function setMeta(name: string, content: string) {
  const meta = upsertElement(`meta[name="${name}"]`, () => {
    const created = document.createElement('meta');
    created.setAttribute('name', name);
    return created;
  });
  meta.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  const link = upsertElement(`link[rel="${rel}"]`, () => {
    const created = document.createElement('link');
    created.setAttribute('rel', rel);
    return created;
  });
  link.setAttribute('href', href);
}

// Nhiều lần gọi liên tiếp (ứng dụng phụ huynh rồi màn hình học sinh): chỉ lần gọi sau cùng được áp, dù phản hồi về theo thứ tự nào
let latestCall = 0;

export async function applyBrandedManifest(application: PwaApplication, base: string): Promise<void> {
  const call = ++latestCall;
  const url = manifestUrl(application, base);
  try {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) {
      return;
    }
    const manifest = (await response.json()) as BrandedManifest;
    if (call !== latestCall) {
      return;
    }
    setLink('manifest', url);
    setLink('apple-touch-icon', manifest.apple_touch_icon);
    setMeta('theme-color', manifest.theme_color);
    setMeta('apple-mobile-web-app-title', manifest.short_name);
    setMeta('apple-mobile-web-app-capable', 'yes');
    setMeta('mobile-web-app-capable', 'yes');
    setMeta('apple-mobile-web-app-status-bar-style', 'default');
  } catch {
    // Mất mạng hoặc máy chủ lỗi: giữ manifest tĩnh
  }
}
