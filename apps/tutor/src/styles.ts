// Lớp và hàm dùng chung của các trang ứng dụng Gia sư theo bản thiết kế Eric duyệt ngày 2026-10-28 (YCTD-361): thẻ nền trắng bo lớn
// trên nền kem, cùng tông với Chợ gia sư
export const CARD_CLASS = 'rounded-2xl border border-border bg-card';

export const money = (value: number) => `${value.toLocaleString('vi-VN')} đồng`;
export const when = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
