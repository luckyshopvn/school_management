import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Mục điều hướng người dùng đang thấy (đã lọc theo quyền), để trang chủ cho ghim vào "Truy cập nhanh" (YCTD-102). Mỗi mục
// trên thanh điều hướng tự đăng ký khi hiện ra và gỡ khi biến mất
export interface NavigationEntry {
  path: string;
  label: string;
  group: string | undefined;
}

interface NavigationRegistry {
  entries: NavigationEntry[];
  register(entry: NavigationEntry): void;
  unregister(path: string): void;
}

export const NavigationRegistryContext = createContext<NavigationRegistry>({
  entries: [],
  register: () => undefined,
  unregister: () => undefined,
});

export function useNavigationRegistryState(): NavigationRegistry {
  const [byPath, setByPath] = useState<Map<string, NavigationEntry>>(() => new Map());
  const register = useCallback((entry: NavigationEntry) => {
    setByPath((previous) => {
      const existing = previous.get(entry.path);
      if (existing && existing.label === entry.label && existing.group === entry.group) {
        return previous;
      }
      return new Map(previous).set(entry.path, entry);
    });
  }, []);
  const unregister = useCallback((path: string) => {
    setByPath((previous) => {
      if (!previous.has(path)) {
        return previous;
      }
      const next = new Map(previous);
      next.delete(path);
      return next;
    });
  }, []);
  return useMemo(() => ({ entries: [...byPath.values()], register, unregister }), [byPath, register, unregister]);
}

export function useNavigationEntries(): NavigationEntry[] {
  return useContext(NavigationRegistryContext).entries;
}
