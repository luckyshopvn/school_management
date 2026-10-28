import { useSyncExternalStore } from 'react';

// Năm học đã đóng đang xem ở ô năm học (BC-09, YCTD-342): mỗi yêu cầu gửi mã năm ở tiêu đề `x-academic-year-id`, máy chủ đọc
// cơ sở dữ liệu năm đó và từ chối ghi. Giữ trong sessionStorage của thẻ trình duyệt để tải lại trang vẫn đang xem năm cũ;
// đăng xuất hoặc chọn lại năm đang dùng thì bỏ
export const VIEWED_ACADEMIC_YEAR_HEADER = 'x-academic-year-id';
const STORAGE_KEY = 'portal.viewed-academic-year';

export interface ViewedAcademicYear {
  id: string;
  name: string;
}

function readStored(): ViewedAcademicYear | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? 'null') as ViewedAcademicYear | null;
    return value && typeof value.id === 'string' && typeof value.name === 'string' ? value : null;
  } catch {
    return null;
  }
}

let viewed: ViewedAcademicYear | null = typeof window === 'undefined' ? null : readStored();
const listeners = new Set<() => void>();

export function viewedAcademicYear(): ViewedAcademicYear | null {
  return viewed;
}

export function setViewedAcademicYear(year: ViewedAcademicYear | null): void {
  if (viewed?.id === year?.id) {
    return;
  }
  viewed = year;
  try {
    if (year) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(year));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Trình duyệt chặn sessionStorage: vẫn xem được đến khi tải lại trang
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useViewedAcademicYear(): ViewedAcademicYear | null {
  return useSyncExternalStore(subscribe, viewedAcademicYear, () => null);
}
