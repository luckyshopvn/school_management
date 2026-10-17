// Tìm tại chỗ trên lưới dữ liệu chung (DT-15 phần 15f3): dòng khớp khi từ khóa (bỏ khoảng trắng hai đầu, không phân biệt
// hoa thường) nằm trong một trong các giá trị; từ khóa trống thì mọi dòng đều khớp
export function matchesSearch(search: string, ...values: Array<string | number | null | undefined>): boolean {
  const keyword = search.trim().toLocaleLowerCase('vi');
  return (
    keyword === '' ||
    values.some(
      (value) => value !== null && value !== undefined && String(value).toLocaleLowerCase('vi').includes(keyword),
    )
  );
}
