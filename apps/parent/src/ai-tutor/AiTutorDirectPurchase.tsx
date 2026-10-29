// Bản giữ chỗ của tab "Mua trực tiếp" (YCTD-383 lát L1a). Lát L1b (nền tảng bán thẳng) sẽ thay toàn bộ tệp này; khung trang gọi
// thành phần mặc định với thuộc tính `child`.
export default function AiTutorDirectPurchase({ child }: { child: { id: string; full_name: string } }) {
  return (
    <p className="text-content text-text-secondary" aria-label={`Mua trực tiếp cho ${child.full_name}`}>
      Đang chuẩn bị
    </p>
  );
}
