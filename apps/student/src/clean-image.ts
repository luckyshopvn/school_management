// Vẽ lại ảnh lên khung để bỏ siêu dữ liệu (EXIF, vị trí), thu nhỏ cạnh dài về 1600 điểm ảnh, lưu JPEG chất lượng 0,85. Dùng cho ảnh bài
// làm (DT-28 phần 28c) và ảnh bài tập gửi gia sư AI (YCTD-383 lát L4)
export async function cleanImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không đọc được ảnh'))), 'image/jpeg', 0.85),
  );
}
