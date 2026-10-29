// Đường dẫn yêu cầu theo cách Express 5 định tuyến: không phân biệt hoa thường, chấp nhận "/" cuối. Lệnh chặn, ghi vết theo
// đường dẫn phải so trên dạng này, nếu không thì cùng một tuyến viết hoa hoặc thêm "/" cuối sẽ lọt qua (YCTD-374)
export function routingPath(path: string): string {
  return path.toLowerCase().replace(/\/+$/, '') || '/';
}

export function matchesRoutingPath(patterns: readonly RegExp[], path: string): boolean {
  const normalized = routingPath(path);
  return patterns.some((pattern) => pattern.test(normalized));
}
