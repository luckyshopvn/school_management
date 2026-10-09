import { useEffect } from 'react';

// Thông báo nổi ở góc trên bên phải, tự ẩn sau năm giây (TD-08)
export function Toast({ message, onClose }: { message: string | undefined; onClose(): void }) {
  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) {
    return null;
  }
  return (
    <div
      role="status"
      className="fixed top-4 right-4 z-50 rounded-lg border border-success/30 bg-card px-4 py-3 text-label font-medium text-success shadow-lg"
    >
      {message}
    </div>
  );
}
