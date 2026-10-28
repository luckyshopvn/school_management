// Mỗi khoá chỉ có một yêu cầu đang chạy: yêu cầu đến sau trong lúc yêu cầu trước chưa xong dùng lại kết quả của yêu cầu trước
// (YCTD-355). Dùng cho yêu cầu mở phiên xem camera theo bài làm: máy chủ đóng phiên cũ khi mở phiên mới, nên hai yêu cầu song song
// của cùng một bài làm làm mất phiên của nhau
export function createSingleFlight<Value>(): (key: string, start: () => Promise<Value>) => Promise<Value> {
  const pending = new Map<string, Promise<Value>>();
  return (key, start) => {
    const running = pending.get(key);
    if (running) {
      return running;
    }
    const request = start().finally(() => {
      pending.delete(key);
    });
    pending.set(key, request);
    return request;
  };
}
