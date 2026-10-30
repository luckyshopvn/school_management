// Bộ giả lập máy chấm công, đầu đọc thẻ (YCTD-389 lát L2): gửi lượt qua cổng tới điểm nhận của trường như một thiết bị thật.
// Thiết bị thật (ZKTeco, Hikvision…) chưa nối; khi nối, bộ chuyển đổi của hãng gửi đúng định dạng này.
//
// Cách dùng (khóa thiết bị lấy ở cổng quản trị, trang Điểm danh, "Thiết bị điểm danh"; đặt qua biến môi trường để không lộ trong lịch
// sử lệnh):
//   THIET_BI_KHOA=tbd_... node scripts/gia-lap-may-cham-cong.mjs --url http://tc.truong.localhost:3100 --ma ABCDEFGHIJKLMNOP --huong in
//   THIET_BI_KHOA=tbd_... node scripts/gia-lap-may-cham-cong.mjs --url ... --ma NS001 --luc "2026-10-30T07:05:00+07:00"
// Nhiều mã: lặp lại --ma. Không có --huong thì dùng hướng đã khai cho thiết bị.
import { randomUUID } from 'node:crypto';

function doc(tenThamSo) {
  const ketQua = [];
  const thamSo = process.argv.slice(2);
  for (let viTri = 0; viTri < thamSo.length; viTri++) {
    if (thamSo[viTri] === tenThamSo && thamSo[viTri + 1] !== undefined) {
      ketQua.push(thamSo[viTri + 1]);
    }
  }
  return ketQua;
}

const diaChi = doc('--url')[0];
const khoa = process.env.THIET_BI_KHOA;
const cacMa = doc('--ma');
const huong = doc('--huong')[0] ?? null;
const luc = doc('--luc')[0] ?? new Date().toISOString();

if (!diaChi || !khoa || cacMa.length === 0) {
  console.error('Thiếu --url, --ma hoặc biến môi trường THIET_BI_KHOA');
  process.exit(2);
}

const phanHoi = await fetch(new URL('/api/v1/device-events', diaChi), {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-device-key': khoa },
  body: JSON.stringify({
    events: cacMa.map((ma) => ({ external_id: randomUUID(), code: ma, direction: huong, occurred_at: luc })),
  }),
});
console.log(phanHoi.status, JSON.stringify(await phanHoi.json(), null, 2));
process.exit(phanHoi.ok ? 0 : 1);
