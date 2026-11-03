import { useEffect, useState } from 'react';

// Khổ máy tính từ 1024 px (KC-09; YCTD-395 lát L4). Màn có ô nhập chỉ vẽ một bố cục theo khổ (bảng ở máy tính, thẻ ở điện thoại) để
// mỗi ô có một phần tử duy nhất mang nhãn của nó; màn chỉ đổi vị trí khung thì dùng lớp `lg:` thay cho hook này
const WIDE_QUERY = '(min-width: 1024px)';

export function useWideLayout(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide;
}
