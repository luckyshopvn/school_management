import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

// Bộ kiểm dùng chung theo khổ thiết bị (DT-26 phần 26c, YCTD-233). Các phần đợt 2 (26d, 26e) và phần khác gắn nhãn @thiet-bi cho spec của mình rồi gọi các hàm này.
// Mỗi hàm trả danh sách vi phạm (rỗng là đạt) để spec tự khẳng định và in được chi tiết khi hỏng. Ngoại lệ phải có lý do bằng chữ ở `exempt`.
// axe-core là thư viện mã nguồn mở giấy phép MPL-2.0, chỉ dùng ở kiểm thử, không đóng gói vào sản phẩm.

// Kiểu tối thiểu của trình duyệt cho đoạn mã chạy trong trang (tsconfig của tests không nạp thư viện DOM để không lẫn kiểu Node)
interface DomRect {
  width: number;
  height: number;
}
interface DomElement {
  tagName: string;
  textContent: string | null;
  getBoundingClientRect(): DomRect;
  getAttribute(name: string): string | null;
  closest(selector: string): DomElement | null;
  matches(selector: string): boolean;
}
interface DomStyle {
  visibility: string;
  display: string;
  fontSize: string;
}
declare const document: {
  documentElement: { scrollWidth: number; clientWidth: number };
  querySelectorAll(selector: string): ArrayLike<DomElement>;
};
declare function getComputedStyle(element: DomElement): DomStyle;

export const MINIMUM_TOUCH_TARGET = 44;
export const MINIMUM_INPUT_FONT_PX = 16;

export interface Violation {
  what: string;
  detail: string;
  // Khóa ổn định (không kèm kích thước) để so với đường cơ sở các vi phạm đã biết
  key: string;
}

export interface Exemption {
  // Bộ chọn CSS của phần tử được miễn
  selector: string;
  // Lý do bắt buộc (ví dụ: liên kết trong đoạn văn theo ngoại lệ "nội tuyến" của WCAG 2.5.8)
  reason: string;
}

// Vùng chạm của nút, liên kết, ô nhập đang hiện: tối thiểu 44 × 44 px. Liên kết nằm trong đoạn văn (p, li, td) là ngoại lệ nội tuyến
export async function touchTargetViolations(page: Page, exempt: Exemption[] = []): Promise<Violation[]> {
  for (const item of exempt) {
    if (!item.reason.trim()) {
      throw new Error(`Ngoại lệ ${item.selector} thiếu lý do`);
    }
  }
  return page.evaluate(
    ({ minimum, exempted }) => {
      const result: Violation[] = [];
      const selector =
        'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="menuitem"], [role="tab"], [role="checkbox"], [role="radio"]';
      for (const element of Array.from(document.querySelectorAll(selector))) {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        if (style.visibility === 'hidden' || style.display === 'none' || box.width === 0 || box.height === 0) {
          continue;
        }
        if (exempted.some((css) => element.matches(css))) {
          continue;
        }
        // Ô chọn, nút chọn ẩn bằng kỹ thuật chỉ đọc màn hình: tính theo nhãn bao ngoài
        const target = element.closest('label') ?? element;
        const targetBox = target.getBoundingClientRect();
        const inline =
          element.tagName === 'A' && element.closest('p, li, td, dd') !== null && style.display === 'inline';
        if (inline) {
          continue;
        }
        if (targetBox.width + 0.5 < minimum || targetBox.height + 0.5 < minimum) {
          result.push({
            what: 'vung-cham',
            key: `vung-cham:${element.tagName.toLowerCase()} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 40)}"`,
            detail: `${element.tagName.toLowerCase()} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 40)}" ${Math.round(targetBox.width)}x${Math.round(targetBox.height)}`,
          });
        }
      }
      return result;
    },
    { minimum: MINIMUM_TOUCH_TARGET, exempted: exempt.map((item) => item.selector) },
  );
}

// Cỡ chữ ô nhập tối thiểu 16 px để iOS không tự phóng to khi chạm vào ô
export async function inputFontViolations(page: Page): Promise<Violation[]> {
  return page.evaluate((minimum) => {
    const result: Violation[] = [];
    for (const element of Array.from(
      document.querySelectorAll(
        'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea',
      ),
    )) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') {
        continue;
      }
      const size = Number.parseFloat(style.fontSize);
      if (size < minimum) {
        result.push({
          what: 'co-chu-o-nhap',
          key: `co-chu-o-nhap:${element.tagName.toLowerCase()} "${(element.getAttribute('aria-label') ?? element.getAttribute('name') ?? '').slice(0, 40)}"`,
          detail: `${element.tagName.toLowerCase()} "${(element.getAttribute('aria-label') ?? element.getAttribute('name') ?? '').slice(0, 40)}" ${size}px`,
        });
      }
    }
    return result;
  }, MINIMUM_INPUT_FONT_PX);
}

// Không cuộn ngang cả trang (cho phép vùng cuộn ngang riêng như bảng bọc trong khối overflow)
export async function horizontalOverflowViolations(page: Page): Promise<Violation[]> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1
      ? [
          {
            what: 'cuon-ngang',
            key: 'cuon-ngang',
            detail: `scrollWidth ${root.scrollWidth} > clientWidth ${root.clientWidth}`,
          },
        ]
      : [];
  });
}

// Truy cập bằng axe-core: chỉ vi phạm mức nghiêm trọng và rất nghiêm trọng; `skipRules` là ngoại lệ có lý do ghi ở nơi gọi
export async function accessibilityViolations(page: Page, skipRules: string[] = []): Promise<Violation[]> {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).disableRules(skipRules).analyze();
  return result.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({
      what: `axe:${violation.id}`,
      key: `axe:${violation.id}`,
      detail: `${violation.impact}: ${violation.help} (${violation.nodes.length} phần tử, ví dụ ${violation.nodes[0]?.target.join(' ')})`,
    }));
}

export const describeViolations = (violations: Violation[]): string =>
  violations.map((violation) => `${violation.what}: ${violation.detail}`).join('\n');

// Đường cơ sở các vi phạm đã biết (device-baseline.json): theo từng trang, mỗi khóa kèm phần chịu trách nhiệm sửa (26d: ứng dụng giáo viên và phụ huynh,
// 26e: cổng quản trị và cổng nền tảng). Spec chỉ hỏng khi có vi phạm MỚI ngoài đường cơ sở; sửa xong một mục thì xóa khỏi tệp để khóa lại
export interface BaselineEntry {
  key: string;
  owner: string;
}

export function newViolations(page: string, violations: Violation[]): Violation[] {
  const baseline = JSON.parse(readFileSync(new URL('./device-baseline.json', import.meta.url), 'utf8')) as Record<
    string,
    BaselineEntry[]
  >;
  const known = new Set((baseline[page] ?? []).map((entry) => entry.key));
  return violations.filter((violation) => !known.has(violation.key));
}
