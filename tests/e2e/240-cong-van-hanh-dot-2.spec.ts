import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page, Request } from '@playwright/test';
import { expect, test } from './fixtures.js';
import { signInConsole } from './platform-console.js';

// YCTD-370 (spec 240): tám trang cổng vận hành thiết kế lại ở đợt 2. Cổng nền tảng không chạy trong môi trường e2e một trường nên spec
// tự chạy máy chủ Vite của cổng ở cổng riêng và giả lập API bằng page.route như spec 184. Kiểm phần giao diện: ẩn nút theo quyền đã có,
// hộp xác nhận trước thao tác không hoàn tác, lỗi tại ô, không gửi lặp, hộp thông tin hiện một lần, bàn phím, lỗi LOI-VH2-1 của trang Gói
// dịch vụ. Máy chủ vẫn kiểm quyền như cũ (kiểm thử máy chủ đang có). Dữ liệu giả
const PLATFORM_PORT = 5389;
const PLATFORM_URL = `http://localhost:${PLATFORM_PORT}`;
const PAGES = ['Dashboard', 'Catalog', 'Plans', 'Billing', 'Ai', 'Maintenance', 'Operators', 'OperatorPassword'];
let platformServer: ChildProcess | undefined;

type Role = 'quan_tri' | 'ho_tro' | 'ky_thuat' | 'ke_toan';
type Reply = { status?: number; body: unknown };

const captchaImage =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const notice = {
  id: 'tb-1',
  title: 'Nâng cấp máy chủ giả',
  body: 'Tạm dừng 30 phút.',
  severity: 'warning',
  starts_at: '2030-01-01T15:00:00.000Z',
  ends_at: '2030-01-01T16:00:00.000Z',
  audience: 'all',
  school_codes: [],
  created_by_name: 'Nhân viên giả',
  created_at: '2029-12-30T00:00:00.000Z',
  cancelled_at: null,
  state: 'scheduled',
};

const plans = [
  {
    id: 'p1',
    code: 'goi-gia',
    name: 'Gói giả',
    modules: null,
    max_active_students: null,
    max_storage_mb: null,
    max_school_levels: null,
    ai_max_requests: null,
    ai_max_tokens: null,
    video_max_minutes: null,
    video_max_recording_mb: null,
    trial_days: 30,
    pricing_mode: 'per_school',
    unit_price: 0,
    minimum_fee: 0,
    billing_cycle: 'monthly',
    status: 'active',
    school_count: 1,
    price_rule_id: null,
  },
];

const invoice = {
  id: 'i1',
  code: 'HD-GIA-1',
  school_code: 'truong-gia',
  school_name: 'Trường giả',
  period_start: '2030-01-01',
  period_end: '2030-01-31',
  total: 1000,
  amount_paid: 0,
  outstanding: 1000,
  status: 'issued',
  overdue: false,
  due_on: '2030-02-15',
  payment_content: 'HDGIA1',
};

// Dữ liệu giả cho từng điểm cuối của cổng; trả undefined thì 404
function fixture(role: Role, method: string, path: string): Reply | undefined {
  if (path === '/me') {
    return {
      body: { id: 'nv-1', login: 'nv-gia', full_name: 'Nhân viên giả', role, must_change_password: false, school_count: 1 },
    };
  }
  if (path === '/maintenance-notices' && method === 'GET') {
    return { body: { items: [notice] } };
  }
  if (path.startsWith('/maintenance-notices')) {
    return { body: notice };
  }
  if (path === '/dashboard') {
    return {
      body: {
        generated_at: '2030-01-01T00:00:00.000Z',
        error_alert_per_hour: 20,
        totals: {
          schools: 1,
          serving: 1,
          with_alerts: 0,
          users: 3,
          active_students: 10,
          storage_mb: 5,
          errors_last_day: 2,
          platform_errors_last_day: 1,
        },
        items: [
          {
            id: 's1',
            code: 'truong-gia',
            name: 'Trường giả',
            status: 'active',
            data_class: 'standard',
            plan: null,
            metrics: null,
            errors: { last_hour: 1, last_day: 2, last_at: null },
            failing_jobs: [],
            support: null,
            alerts: [],
          },
        ],
      },
    };
  }
  if (path.startsWith('/dashboard/errors')) {
    return { body: { hours: 24, items: [] } };
  }
  if (path === '/operators' && method === 'GET') {
    return {
      body: {
        login_rule: 'cccd',
        items: [
          {
            id: 'nv-1',
            login: '012345678901',
            full_name: 'Nhân viên giả',
            role: 'quan_tri',
            status: 'active',
            locked_until: null,
            last_login_at: null,
            totp_enrolled: true,
          },
          {
            id: 'nv-2',
            login: '012345678902',
            full_name: 'Hỗ trợ giả',
            role: 'ho_tro',
            status: 'active',
            locked_until: null,
            last_login_at: null,
            totp_enrolled: true,
          },
        ],
      },
    };
  }
  if (path === '/operators' && method === 'POST') {
    return {
      body: {
        id: 'nv-3',
        temporary_password: 'mat-khau-tam-gia',
        totp_secret: 'KHOA-GIA',
        otpauth_uri: 'otpauth://totp/gia?secret=KHOA-GIA',
        recovery_codes: ['ma-1', 'ma-2'],
      },
    };
  }
  if (path.startsWith('/operators/')) {
    return { body: { id: 'nv-2' } };
  }
  if (path === '/password') {
    return { body: {} };
  }
  if (path === '/plan-modules') {
    return { body: [] };
  }
  if (path === '/plans') {
    return { body: plans };
  }
  if (path === '/plan-schools') {
    return { body: [] };
  }
  if (path === '/billing/price-rules') {
    // Như máy chủ: quy tắc tính phí cần billing.view
    return role === 'quan_tri' || role === 'ke_toan'
      ? { body: [] }
      : { status: 403, body: { error: { code: 'ERR_FORBIDDEN', message: 'Không có quyền' } } };
  }
  if (path === '/ai') {
    return {
      body: {
        settings: { provider: 'gia', model: 'mo-hinh-gia', endpoint: null },
        key: { configured: false, enabled: false, hint: null },
        plans: [
          {
            plan_id: 'p1',
            code: 'goi-gia',
            name: 'Gói giả',
            status: 'active',
            ai_max_requests: null,
            ai_max_tokens: null,
            configured: false,
            ready: false,
            pricing: {
              freeTokens: 0,
              inputPricePer1k: null,
              outputPricePer1k: null,
              modelPrices: {},
              minimumFee: 0,
              roundingStep: 1,
            },
          },
        ],
      },
    };
  }
  if (path === '/ai/usage') {
    return { body: { rows: [] } };
  }
  if (path === '/billing') {
    return {
      body: {
        settings: {
          invoice_prefix: 'HD',
          receiving_account: { bank_bin: null, account_number: null, account_name: null },
          einvoice_provider: 'none',
          auto_issue_einvoice: false,
          remind_days_before: [],
          remind_days_after: [],
          channels: [],
        },
        einvoice_providers: ['none'],
        connectors: [
          {
            connector: 'gia',
            label: 'Cổng giả',
            configured: false,
            enabled: false,
            hints: {},
            fields: [{ name: 'api_key', label: 'Khóa cổng giả', secret: true, required: true }],
          },
        ],
        receivables: [],
        unmatched_payments: [],
        modules: [],
      },
    };
  }
  if (path.startsWith('/billing/invoices/') && method === 'GET') {
    return {
      body: {
        ...invoice,
        subtotal: 1000,
        discount_total: 0,
        vat_percent: 0,
        vat_amount: 0,
        lines: [],
        payments: [],
        einvoices: [],
      },
    };
  }
  if (path.startsWith('/billing/invoices') && method === 'GET') {
    return { body: [invoice] };
  }
  if (path === '/catalog') {
    return {
      body: {
        departments: 1,
        communes: 1,
        units: 1,
        by_level: {},
        flags: {},
        linked_schools: 0,
        runs: [],
        levels: [],
        flag_labels: {},
        department_list: [{ code: '99', name: 'Sở giả' }],
      },
    };
  }
  if (path === '/login-page') {
    return { body: { title: 'Tiêu đề giả', subtitle: '', support_lines: [] } };
  }
  if (path === '/support-policy') {
    return { body: { mode: 'any_school', default_hours: 2, max_hours: 8 } };
  }
  return undefined;
}

// Đăng nhập cổng với vai trò cho trước; trả danh sách yêu cầu ghi (POST, PUT, PATCH) đã gửi để kiểm
async function openConsole(page: Page, role: Role): Promise<Request[]> {
  const writes: Request[] = [];
  await page.route('**/api/v1/auth/platform/**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1/auth/platform', '');
    if (path === '/captcha') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ captcha_id: '00000000-0000-4000-8000-000000000000', image: captchaImage, expires_in_seconds: 300 }),
      });
    }
    if (path === '/login') {
      const body = request.postDataJSON() as { otp_code?: string };
      return route.fulfill(
        body.otp_code
          ? {
              contentType: 'application/json',
              body: JSON.stringify({ access_token: 'ma-gia', operator: { id: 'nv-1', login: 'nv-gia', full_name: 'Nhân viên giả' } }),
            }
          : {
              status: 401,
              contentType: 'application/json',
              body: JSON.stringify({
                error: { code: 'ERR_UNAUTHENTICATED', message: 'Cần mã', details: [{ field: 'otp_code', message: 'Nhập mã' }] },
              }),
            },
      );
    }
    if (request.method() !== 'GET') {
      writes.push(request);
    }
    const reply = fixture(role, request.method(), path);
    return route.fulfill({
      status: reply ? (reply.status ?? 200) : 404,
      contentType: 'application/json',
      body: JSON.stringify(reply ? reply.body : { error: { code: 'ERR_NOT_FOUND', message: 'Không có' } }),
    });
  });
  await page.goto(PLATFORM_URL);
  await signInConsole(page, 'nv-gia', 'mat-khau-gia', () => '123456', { captcha: () => 'ABCDE' });
  await expect(page.getByRole('navigation', { name: 'Menu' })).toBeVisible();
  return writes;
}

async function openPage(page: Page, label: string) {
  await page.getByRole('navigation', { name: 'Menu' }).getByRole('button', { name: label, exact: true }).click();
}

test.describe('cổng vận hành đợt 2', () => {
  test.beforeAll(async () => {
    const root = fileURLToPath(new URL('../../apps/platform/', import.meta.url));
    platformServer = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--port', String(PLATFORM_PORT), '--strictPort'],
      { cwd: root, stdio: 'ignore' },
    );
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const ready = await fetch(PLATFORM_URL)
        .then((response) => response.ok)
        .catch(() => false);
      if (ready) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error('Máy chủ Vite của cổng nền tảng không chạy');
  });

  test.afterAll(() => {
    platformServer?.kill();
  });

  test('CT-1690: Hỗ trợ, Kỹ thuật mở Gói dịch vụ thấy danh sách gói ở dạng chỉ xem (LOI-VH2-1)', async ({ page }) => {
    await openConsole(page, 'ho_tro');
    await openPage(page, 'Gói dịch vụ');
    await expect(page.getByRole('table', { name: 'Danh sách gói' })).toContainText('Gói giả');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Lập gói mới' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sửa gói Gói giả' })).toHaveCount(0);
  });

  test('CT-1691: Hỗ trợ không thấy tạo, hủy thông báo bảo trì', async ({ page: support }) => {
    await openConsole(support, 'ho_tro');
    await openPage(support, 'Bảo trì');
    await expect(support.getByRole('table', { name: 'Danh sách thông báo bảo trì' })).toContainText('Nâng cấp máy chủ giả');
    await expect(support.getByRole('form', { name: 'Tạo thông báo bảo trì' })).toHaveCount(0);
    await expect(support.getByRole('button', { name: /^Hủy thông báo/ })).toHaveCount(0);
  });

  test('CT-1700: Kế toán không bấm được số lỗi, không có ô khóa cổng thanh toán, xem nhà cung cấp AI ở dạng chỉ xem', async ({
    page: accountant,
  }) => {
    await openConsole(accountant, 'ke_toan');
    await openPage(accountant, 'Bảng điều khiển');
    await expect(accountant.getByRole('table', { name: 'Danh sách trường' })).toContainText('truong-gia');
    await expect(accountant.getByRole('button', { name: /^Xem lỗi/ })).toHaveCount(0);
    await openPage(accountant, 'Thu phí');
    await accountant.getByRole('tab', { name: 'Cấu hình' }).click();
    await expect(accountant.getByLabel('Khóa cổng giả')).toHaveCount(0);
    await openPage(accountant, 'Trợ lý AI');
    await expect(accountant.getByRole('form', { name: 'Khóa AI dùng chung của nền tảng' })).toHaveCount(0);
    await expect(accountant.getByText('Chỉ quản trị nền tảng sửa được.')).toBeVisible();
  });

  test('CT-1701: Kỹ thuật mở lỗi theo giờ của trường, thấy biểu mẫu tạo thông báo bảo trì', async ({ page: technician }) => {
    await openConsole(technician, 'ky_thuat');
    await openPage(technician, 'Bảng điều khiển');
    await technician.getByRole('button', { name: 'Xem lỗi truong-gia: 1 / 2' }).click();
    await expect(technician.getByRole('dialog', { name: 'Lỗi máy chủ 24 giờ gần nhất: truong-gia' })).toContainText(
      'Không có lỗi.',
    );
    await technician.keyboard.press('Escape');
    await openPage(technician, 'Bảo trì');
    await expect(technician.getByRole('form', { name: 'Tạo thông báo bảo trì' })).toBeVisible();
  });

  test('CT-1692: hủy thông báo hỏi xác nhận; Quay lại, Esc không gửi; tiêu điểm về nút đã mở', async ({ page }) => {
    const writes = await openConsole(page, 'quan_tri');
    await openPage(page, 'Bảo trì');
    const cancel = page.getByRole('button', { name: 'Hủy thông báo Nâng cấp máy chủ giả' });
    await cancel.click();
    const dialog = page.getByRole('dialog', { name: 'Hủy thông báo "Nâng cấp máy chủ giả"?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Quay lại' }).click();
    await expect(dialog).toBeHidden();
    await expect(cancel).toBeFocused();
    await cancel.click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(writes).toHaveLength(0);
    await cancel.click();
    await dialog.getByRole('button', { name: 'Hủy thông báo' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Đã hủy thông báo' })).toBeVisible();
    expect(writes.map((request) => new URL(request.url()).pathname)).toEqual([
      '/api/v1/auth/platform/maintenance-notices/tb-1/cancel',
    ]);
  });

  test('CT-1693: Bảo trì báo lỗi tại ô khi kết thúc trước bắt đầu; bấm nhanh hai lần chỉ tạo một thông báo', async ({ page }) => {
    const writes = await openConsole(page, 'ky_thuat');
    await openPage(page, 'Bảo trì');
    const form = page.getByRole('form', { name: 'Tạo thông báo bảo trì' });
    await form.getByLabel('Tiêu đề').fill('Thông báo giả');
    await form.getByLabel('Nội dung').fill('Nội dung giả');
    await form.getByLabel('Bắt đầu').fill('2030-01-02T10:00');
    await form.getByLabel('Kết thúc').fill('2030-01-02T09:00');
    await expect(form.getByText('Giờ kết thúc phải sau giờ bắt đầu.')).toBeVisible();
    await form.getByRole('button', { name: 'Tạo thông báo' }).click();
    expect(writes).toHaveLength(0);
    await form.getByLabel('Kết thúc').fill('2030-01-02T11:00');
    await form.getByRole('button', { name: 'Tạo thông báo' }).dblclick();
    await expect(page.getByRole('status').filter({ hasText: 'Đã tạo thông báo bảo trì.' })).toBeVisible();
    expect(writes).toHaveLength(1);
  });

  test('CT-1694: thông tin hiện một lần chỉ đóng bằng "Đã lưu, đóng", không ghi vào bộ nhớ trình duyệt; khóa nhân viên hỏi xác nhận', async ({
    page,
  }) => {
    const writes = await openConsole(page, 'quan_tri');
    await openPage(page, 'Nhân viên vận hành');
    await page.getByRole('button', { name: 'Thêm nhân viên' }).click();
    const create = page.getByRole('dialog', { name: 'Thêm nhân viên vận hành' });
    await create.getByLabel('Tên đăng nhập').fill('012345678903');
    await create.getByLabel('Họ tên').fill('Nhân viên mới giả');
    await create.getByLabel('Mã xác thực hai lớp của bạn').fill('123456');
    await create.getByRole('button', { name: 'Tạo tài khoản' }).click();
    const once = page.getByRole('dialog', { name: 'Tài khoản của Nhân viên mới giả' });
    await expect(once).toContainText('mat-khau-tam-gia');
    await page.keyboard.press('Escape');
    await expect(once).toBeVisible();
    await expect(once.getByRole('button', { name: 'Đóng', exact: true })).toHaveCount(0);
    const stored = await page.evaluate(
      `JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage))`,
    );
    expect(stored).not.toContain('KHOA-GIA');
    expect(stored).not.toContain('mat-khau-tam-gia');
    await once.getByRole('button', { name: 'Đã lưu, đóng' }).click();
    await expect(once).toBeHidden();

    await page.getByRole('button', { name: 'Khóa', exact: true }).click();
    const lock = page.getByRole('dialog', { name: 'Khóa tài khoản Hỗ trợ giả?' });
    await lock.getByRole('button', { name: 'Quay lại' }).click();
    expect(writes).toHaveLength(1);
    await page.getByRole('button', { name: 'Khóa', exact: true }).click();
    await lock.getByRole('button', { name: 'Khóa tài khoản' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Đã khóa Hỗ trợ giả.' })).toBeVisible();
    expect(writes[1]?.postDataJSON()).toEqual({ status: 'locked' });
  });

  test('CT-1695: hủy hóa đơn phải tích ô đồng ý; lý do để trống báo tại ô', async ({ page }) => {
    const writes = await openConsole(page, 'ke_toan');
    await openPage(page, 'Thu phí');
    await page.getByRole('button', { name: 'Xem hóa đơn HD-GIA-1' }).click();
    const dialog = page.getByRole('dialog', { name: 'Hóa đơn HD-GIA-1 – Trường giả' });
    await dialog.getByLabel('Việc cần làm').selectOption('void');
    const submit = dialog.getByRole('button', { name: 'Hủy hóa đơn', exact: true });
    await expect(submit).toBeDisabled();
    await dialog.getByLabel(/Tôi đã đọc và đồng ý hủy/).check();
    await submit.click();
    await expect(dialog.getByText('Nhập lý do điều chỉnh.')).toBeVisible();
    expect(writes).toHaveLength(0);
  });

  test('CT-1696: đổi mật khẩu 11 ký tự không gửi được, quy tắc dưới ô báo Chưa đủ; 12 ký tự gửi được', async ({ page }) => {
    const writes = await openConsole(page, 'ho_tro');
    await page.getByRole('navigation', { name: 'Menu' }).getByRole('button', { name: 'Đổi mật khẩu' }).click();
    const form = page.getByRole('form', { name: 'Đổi mật khẩu vận hành' });
    await form.getByLabel('Mật khẩu hiện tại').fill('mat-khau-cu-gia');
    await form.getByLabel('Mật khẩu mới', { exact: true }).fill('12345678901');
    await form.getByLabel('Nhập lại mật khẩu mới').fill('12345678901');
    await form.getByLabel(/Mã xác thực hai lớp/).fill('123456');
    await form.getByRole('button', { name: 'Đổi mật khẩu' }).click();
    // Ô mật khẩu mới có minLength nên trình duyệt chặn gửi; quy tắc dưới ô báo Chưa đủ
    await expect(form.getByText('Chưa đủ')).toBeVisible();
    expect(writes).toHaveLength(0);
    await form.getByLabel('Mật khẩu mới', { exact: true }).fill('123456789012');
    await form.getByLabel('Nhập lại mật khẩu mới').fill('123456789012');
    await form.getByRole('button', { name: 'Đổi mật khẩu' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Đã đổi mật khẩu.' })).toBeVisible();
    expect(writes).toHaveLength(1);
  });

  test('CT-1697: thẻ chọn chuyển bằng mũi tên; Kỹ thuật thấy chính sách vào trường ở dạng chỉ xem', async ({ page }) => {
    await openConsole(page, 'ky_thuat');
    await openPage(page, 'Danh mục đơn vị');
    const first = page.getByRole('tab', { name: 'Danh mục' });
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Trang đăng nhập' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Chính sách vào trường' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('form', { name: 'Chính sách vào trường của quản trị nền tảng' })).toHaveCount(0);
    await expect(page.getByText('Chỉ quản trị nền tảng sửa được.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xem nhật ký vào trường' })).toHaveCount(0);
  });

  test('CT-1698: Trợ lý AI "Sửa ở Gói dịch vụ" mở đúng gói', async ({ page }) => {
    await openConsole(page, 'ke_toan');
    await openPage(page, 'Trợ lý AI');
    await expect(page.getByRole('table', { name: 'Đơn giá AI theo gói' })).toContainText('Chưa nhập đơn giá');
    await page.getByRole('button', { name: 'Sửa đơn giá AI của gói Gói giả ở Gói dịch vụ' }).click();
    await expect(page.getByRole('heading', { name: 'Sửa gói: Gói giả' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Phí AI của gói Gói giả' })).toBeVisible();
  });

  test('CT-1699: tám trang không còn hộp nhập, hộp xác nhận của trình duyệt', () => {
    for (const name of PAGES) {
      const source = readFileSync(new URL(`../../apps/platform/src/${name}Page.tsx`, import.meta.url), 'utf8');
      expect(source, `${name}Page.tsx`).not.toMatch(/window\.(prompt|confirm)/);
    }
  });
});
