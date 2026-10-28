import { readTenancyConfiguration, TenancyRuntime } from '@school-management/database';
import { createPlatformOperatorWithTotp, operatorOtp } from '@school-management/identity/testing';
import { E2E_CONSOLE_HOST, E2E_MULTI_CONSOLE_PORT } from '../e2e-multi-environment.mjs';
import { expect, test, type Page } from './fixtures.js';
import { signInConsole } from './platform-console.js';

// YCTD-343 (spec 141), CT-1635, CT-1636: màn Chi tiết trường của cổng nền tảng cho xem và chuyển loại dữ liệu, ghi hồ sơ đồng ý,
// vùng máy chủ của trường đã tạo. Kế toán không thấy nút; kỹ thuật chuyển sang `consented` bị máy chủ từ chối khi thiếu hồ sơ, ghi
// đủ bốn hồ sơ và vùng máy chủ rồi chuyển được. Dùng trường beta, trả lại `synthetic` và xoá hồ sơ thử sau khi chạy. Chỉ chạy ở
// dự án nhiều trường; dữ liệu giả hoàn toàn
const PASSWORD = 'MatKhauVanHanh2026';
const CODE = 'beta';
const HASH = 'b'.repeat(64);
const suffix = Math.random().toString(36).slice(2, 8);

let runtime: TenancyRuntime;
let technician: Awaited<ReturnType<typeof createPlatformOperatorWithTotp>>;
let accountant: Awaited<ReturnType<typeof createPlatformOperatorWithTotp>>;

async function resetBeta(): Promise<void> {
  const school = await runtime.platform.selectFrom('schools').select('id').where('code', '=', CODE).executeTakeFirst();
  if (!school) {
    throw new Error('Chưa dựng trường beta');
  }
  await runtime.platform.deleteFrom('school_consents').where('school_id', '=', school.id).execute();
  await runtime.platform.deleteFrom('school_hosting').where('school_id', '=', school.id).execute();
  await runtime.platform.updateTable('schools').set({ data_class: 'synthetic' }).where('id', '=', school.id).execute();
}

test.beforeAll(async () => {
  const configuration = readTenancyConfiguration(process.env);
  if (!configuration) {
    throw new Error('Thiếu cấu hình nền tảng nhiều trường: chạy bằng pnpm --filter @school-management/tests e2e:multi');
  }
  runtime = new TenancyRuntime(configuration);
  await resetBeta();
  technician = await createPlatformOperatorWithTotp(runtime.platform, runtime.configuration.masterKey, {
    login: `ky-thuat-${suffix}`,
    fullName: 'Kỹ thuật giả',
    password: PASSWORD,
    role: 'ky_thuat',
  });
  accountant = await createPlatformOperatorWithTotp(runtime.platform, runtime.configuration.masterKey, {
    login: `ke-toan-${suffix}`,
    fullName: 'Kế toán giả',
    password: PASSWORD,
    role: 'ke_toan',
  });
});

test.afterAll(async () => {
  if (runtime) {
    await resetBeta();
    await runtime.close();
  }
});

async function openBeta(page: Page, login: string, operator: { id: string; secret: string }): Promise<void> {
  await page.goto('/');
  await signInConsole(page, login, PASSWORD, () => operatorOtp(runtime.platform, operator.id, operator.secret));
  await page.getByRole('navigation', { name: 'Menu' }).getByRole('button', { name: 'Trường' }).click();
  await page.getByRole('button', { name: CODE, exact: true }).click();
}

test('CT-1635: kế toán xem được loại dữ liệu nhưng không thấy nút chuyển loại, thêm hồ sơ, thêm vùng máy chủ', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: `http://${E2E_CONSOLE_HOST}:${E2E_MULTI_CONSOLE_PORT}` });
  const page = await context.newPage();
  await openBeta(page, `ke-toan-${suffix}`, accountant);
  const panel = page.getByRole('region', { name: 'Loại dữ liệu và hồ sơ đồng ý' });
  await expect(panel.getByTestId('school-data-class')).toHaveText('Dữ liệu giả');
  await expect(panel.getByTestId('consent-gaps')).toContainText('Thiếu hồ sơ dpa');
  await expect(panel.getByText(/Chỉ nhân viên vận hành vai trò quản trị hoặc kỹ thuật/)).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Chuyển loại dữ liệu' })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Thêm hồ sơ đồng ý' })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Thêm vùng máy chủ' })).toHaveCount(0);
  await context.close();
});

test('CT-1636: kỹ thuật chuyển sang dữ liệu thật: thiếu hồ sơ bị từ chối, ghi đủ hồ sơ và vùng máy chủ thì chuyển được', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL: `http://${E2E_CONSOLE_HOST}:${E2E_MULTI_CONSOLE_PORT}` });
  const page = await context.newPage();
  await openBeta(page, `ky-thuat-${suffix}`, technician);
  const panel = page.getByRole('region', { name: 'Loại dữ liệu và hồ sơ đồng ý' });
  await expect(panel.getByTestId('school-data-class')).toHaveText('Dữ liệu giả');

  // Hủy ở hộp xác nhận thì không gửi
  await panel.getByLabel('Chuyển sang loại').selectOption({ label: 'Dữ liệu thật có đồng ý' });
  page.once('dialog', (dialog) => void dialog.dismiss());
  await panel.getByRole('button', { name: 'Chuyển loại dữ liệu' }).click();
  await expect(panel.getByRole('alert')).toHaveCount(0);

  // Thiếu hồ sơ: máy chủ từ chối, trang hiện lỗi nghiệp vụ và từng mục còn thiếu
  page.once('dialog', (dialog) => void dialog.accept());
  await panel.getByRole('button', { name: 'Chuyển loại dữ liệu' }).click();
  await expect(panel.getByRole('alert')).toContainText('Chưa đủ hồ sơ đồng ý');
  await expect(panel.getByRole('alert')).toContainText('Thiếu hồ sơ risk-acceptance');
  await expect(panel.getByTestId('school-data-class')).toHaveText('Dữ liệu giả');

  // Mã băm sai: máy chủ báo lỗi trường
  await panel.getByRole('button', { name: 'Thêm hồ sơ đồng ý' }).click();
  let form = panel.getByRole('form', { name: 'Thêm hồ sơ đồng ý' });
  await form.getByLabel('Người ký', { exact: true }).fill('Hiệu trưởng giả');
  await form.getByLabel('Chức vụ người ký').fill('Hiệu trưởng');
  await form.getByLabel('Phạm vi dữ liệu').fill('Hồ sơ học sinh (dữ liệu giả)');
  await form.getByLabel('Mã băm SHA-256 của bản quét').fill('khong-phai-ma-bam');
  await form.getByRole('button', { name: 'Ghi hồ sơ đồng ý' }).click();
  await expect(panel.getByRole('alert')).toContainText('Mã băm SHA-256');

  for (const label of [
    'Thỏa thuận xử lý dữ liệu (PL-01)',
    'Văn bản đồng ý (PL-02)',
    'Đánh giá tác động (PL-03)',
    'Chấp nhận rủi ro (PL-06)',
  ]) {
    if ((await panel.getByRole('form', { name: 'Thêm hồ sơ đồng ý' }).count()) === 0) {
      await panel.getByRole('button', { name: 'Thêm hồ sơ đồng ý' }).click();
    }
    form = panel.getByRole('form', { name: 'Thêm hồ sơ đồng ý' });
    await form.getByLabel('Loại hồ sơ').selectOption({ label });
    await form.getByLabel('Người ký', { exact: true }).fill('Hiệu trưởng giả');
    await form.getByLabel('Chức vụ người ký').fill('Hiệu trưởng');
    await form.getByLabel('Phạm vi dữ liệu').fill('Hồ sơ học sinh (dữ liệu giả)');
    await form.getByLabel('Mã băm SHA-256 của bản quét').fill(HASH);
    await form.getByRole('button', { name: 'Ghi hồ sơ đồng ý' }).click();
    await expect(panel.getByRole('status')).toHaveText('Đã ghi hồ sơ đồng ý');
    await expect(panel.getByRole('table', { name: 'Hồ sơ đồng ý' })).toContainText(label);
  }
  await expect(panel.getByTestId('consent-gaps')).toContainText('school_hosting');

  await panel.getByRole('button', { name: 'Thêm vùng máy chủ' }).click();
  const hosting = panel.getByRole('form', { name: 'Thêm vùng máy chủ' });
  await hosting.getByLabel('Nhà cung cấp').fill('Nhà cung cấp giả');
  await hosting.getByLabel('Dịch vụ', { exact: true }).fill('Cơ sở dữ liệu');
  await hosting.getByLabel('Vùng', { exact: true }).fill('Singapore');
  await hosting.getByRole('button', { name: 'Ghi vùng máy chủ' }).click();
  await expect(panel.getByRole('status')).toHaveText('Đã ghi vùng máy chủ');
  await expect(panel.getByRole('table', { name: 'Vùng máy chủ' })).toContainText('Singapore');
  await expect(panel.getByTestId('consent-gaps')).toHaveText('Đủ hồ sơ đồng ý và vùng máy chủ để dùng dữ liệu thật.');

  await panel.getByLabel('Chuyển sang loại').selectOption({ label: 'Dữ liệu thật có đồng ý' });
  page.once('dialog', (dialog) => void dialog.accept());
  await panel.getByRole('button', { name: 'Chuyển loại dữ liệu' }).click();
  await expect(panel.getByRole('status')).toContainText('Đã chuyển loại dữ liệu');
  await expect(panel.getByTestId('school-data-class')).toHaveText('Dữ liệu thật có đồng ý');
  await context.close();
});
