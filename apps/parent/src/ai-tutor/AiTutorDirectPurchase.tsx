// Bản giữ chỗ của tab "Mua trực tiếp" (YCTD-383 lát L1a). Lát L1b (nền tảng bán thẳng) sẽ thay toàn bộ tệp này; khung trang gọi
// thành phần mặc định với thuộc tính `childId`.
export default function AiTutorDirectPurchase({ childId }: { childId: string }) {
  return (
    <p className="text-content text-text-secondary" data-child-id={childId}>
      Đang chuẩn bị
    </p>
  );
}
