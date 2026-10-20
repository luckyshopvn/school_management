import { expect, test, type Browser, type Page } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_API_PORT } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Website trường trên tên miền riêng (DT-18 phần 18f, YCTD-144): hiệu trưởng ghi thông tin website, thêm tên miền trình diễn
// (tên miền giả lập *.localhost, trình duyệt tự trỏ về máy) và đánh dấu đã trỏ; nhân viên tuyển sinh soạn tin tức, album ảnh
// có xác nhận cha mẹ đồng ý rồi gửi duyệt; hiệu trưởng duyệt và đăng; trang công khai theo tên miền hiện dải trình diễn, tin,
// album; người ngoài gửi thư liên hệ, hiệu trưởng đánh dấu đã xử lý. Dữ liệu giả
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c70000000049454e44ae426082',
  'hex',
);
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await identity.destroy();
});

async function signIn(browser: Browser, user: { username: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

test('Thiết lập website, tên miền trình diễn, soạn và duyệt tin, album, trang công khai theo tên miền, thư liên hệ', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const suffix = Date.now() % 1_000_000;
  const siteName = `Trường E2E website ${suffix}`;
  const host = `truong-e2e-${suffix}.localhost`;
  const siteUrl = `http://${host}:${E2E_API_PORT}/api/v1/public/site`;
  const newsTitle = `Tin E2E website ${suffix}`;
  const albumTitle = `Album E2E ${suffix}`;
  const subject = `Hỏi tuyển sinh E2E ${suffix}`;
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const editor = await createTestUser(identity, { roles: [{ roleCode: 'VT-12', orgUnitId: null }] });

  // Hiệu trưởng: 1.1 Thông tin website
  const page = await signIn(browser, principal);
  await openMenu(page, '/website/settings');
  await expect(page.getByRole('heading', { name: '1.1. Thông tin website' })).toBeVisible();
  await page.getByLabel('Tên website').fill(siteName);
  await page.getByLabel('Khẩu hiệu').fill('Khẩu hiệu thử nghiệm');
  await page.getByLabel('Điện thoại').fill('0280000000');
  await page.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(page.getByText('Đã ghi thông tin website')).toBeVisible();

  // 1.2 Tên miền: tên miền trình diễn, đánh dấu đã trỏ
  await openMenu(page, '/website/domains');
  await expect(page.getByRole('region', { name: 'Hướng dẫn trỏ tên miền' })).toBeVisible();
  await page.getByLabel('Tên miền *').fill(host.toUpperCase());
  await page.getByLabel('Loại', { exact: true }).selectOption({ label: 'Tên miền trình diễn' });
  await page.getByRole('button', { name: 'Thêm tên miền' }).click();
  await expect(page.getByText('Đã thêm tên miền')).toBeVisible();
  const domainRow = page.getByRole('row', { name: `Tên miền ${host}` });
  await expect(domainRow).toContainText('Chưa đánh dấu');
  await domainRow.getByRole('button', { name: 'Đánh dấu đã trỏ' }).click();
  await expect(domainRow).toContainText('Đã đánh dấu đã trỏ');

  // Nhân viên tuyển sinh: 2.1 Tin tức, soạn rồi gửi duyệt
  const editorPage = await signIn(browser, editor);
  await openMenu(editorPage, '/website/news');
  await expect(editorPage.getByRole('heading', { name: '2.1. Tin tức' })).toBeVisible();
  await editorPage.getByRole('button', { name: 'Thêm mới' }).click();
  await editorPage.getByLabel('Tiêu đề *', { exact: true }).fill(newsTitle);
  await editorPage.getByLabel('Tóm tắt').fill('Tóm tắt tin thử nghiệm');
  await editorPage.getByRole('textbox', { name: 'Nội dung bài' }).fill('Nội dung tin thử nghiệm trên website');
  await editorPage.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(editorPage.getByText(`Đã tạo bài "${newsTitle}"`)).toBeVisible();
  await editorPage.getByRole('button', { name: 'Gửi duyệt' }).click();
  await expect(editorPage.getByText('Đã gửi duyệt')).toBeVisible();

  // 2.5 Thư viện ảnh: album một ảnh, gửi duyệt phải xác nhận cha mẹ đồng ý
  await openMenu(editorPage, '/website/albums');
  await editorPage.getByRole('button', { name: 'Thêm mới' }).click();
  await editorPage.getByLabel('Tên album *', { exact: true }).fill(albumTitle);
  await editorPage.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(editorPage.getByText(`Đã tạo album "${albumTitle}"`)).toBeVisible();
  await editorPage.getByLabel('Chú thích ảnh').fill('Ảnh sân trường');
  await editorPage
    .getByLabel('Tải ảnh lên album')
    .setInputFiles({ name: 'san-truong.png', mimeType: 'image/png', buffer: PNG });
  await expect(editorPage.getByText('Đã tải ảnh lên')).toBeVisible();
  await editorPage.getByRole('button', { name: 'Gửi duyệt' }).click();
  await expect(editorPage.getByText('Bắt buộc xác nhận trước khi gửi duyệt')).toBeVisible();
  await editorPage.getByLabel('Tôi xác nhận ảnh có trẻ đã được cha mẹ đồng ý đăng công khai trên website').check();
  await editorPage.getByRole('button', { name: 'Gửi duyệt' }).click();
  await expect(editorPage.getByText('Đã gửi duyệt')).toBeVisible();

  // Trước khi duyệt, website chưa có tin
  await page.goto(`${siteUrl}/tin-tuc`);
  await expect(page.getByRole('heading', { name: 'Tin tức' })).toBeVisible();
  await expect(page.getByText(newsTitle)).toHaveCount(0);

  // Hiệu trưởng: 3.1 Nội dung chờ duyệt, duyệt và đăng tin, album
  await page.goto('/');
  await openMenu(page, '/website/review');
  for (const title of [newsTitle, albumTitle]) {
    const row = page.getByRole('row', { name: `Nội dung ${title}` });
    await row.getByRole('button', { name: 'Xem', exact: true }).click();
    await page.getByRole('button', { name: 'Duyệt và đăng' }).click();
    await expect(page.getByText('Đã duyệt và đăng')).toBeVisible();
    await expect(page.getByRole('row', { name: `Nội dung ${title}` })).toHaveCount(0);
  }

  // Trang công khai theo tên miền trình diễn
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`${siteUrl}/`);
  await expect(visitor.getByText('Trang trình diễn', { exact: false }).first()).toBeVisible();
  await expect(visitor.getByRole('heading', { name: siteName, level: 1 })).toBeVisible();
  await visitor.getByRole('link', { name: newsTitle }).click();
  await expect(visitor.getByRole('heading', { name: newsTitle })).toBeVisible();
  await expect(visitor.getByText('Nội dung tin thử nghiệm trên website')).toBeVisible();
  await visitor.getByRole('navigation', { name: 'Menu chính' }).getByRole('link', { name: 'Thư viện ảnh' }).click();
  await visitor.getByRole('link', { name: albumTitle }).click();
  await expect(visitor.getByText('Ảnh sân trường')).toBeVisible();
  await expect(visitor.getByRole('img', { name: 'Ảnh sân trường' })).toBeVisible();

  // Thư liên hệ
  await visitor.getByRole('navigation', { name: 'Menu chính' }).getByRole('link', { name: 'Liên hệ' }).click();
  await visitor.getByLabel('Họ và tên').fill('Phụ huynh thử nghiệm');
  await visitor.getByLabel('Số điện thoại').fill('0900000000');
  await visitor.getByLabel('Tiêu đề').fill(subject);
  await visitor.getByLabel('Nội dung').fill('Xin thông tin tuyển sinh năm học mới');
  await visitor.getByRole('button', { name: 'Gửi liên hệ' }).click();
  await expect(visitor.getByRole('status')).toContainText('đã nhận thư liên hệ');

  await openMenu(page, '/website/contacts');
  const message = page.getByRole('row', { name: `Thư ${subject}` });
  await expect(message).toContainText('Chưa xử lý');
  await message.getByRole('button', { name: 'Đã xử lý' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Cách xử lý').fill('Đã gọi điện tư vấn');
  await dialog.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByText('Đã đánh dấu đã xử lý')).toBeVisible();
});
