import { fetchToolsConfig } from './classroom-api.js';
import { disableOffline, enableOffline } from './classroom-offline.js';
import { clearAllButConfig, flushQueue, saveConfig, type StoredConfig } from './classroom-store.js';

// Áp cấu hình ngoại tuyến của trường (DT-23 phần 23b, GD-108): trường bật thì đăng ký service worker, trường tắt thì gỡ service
// worker, xóa bộ nhớ đệm, bản chụp danh sách lớp và các dữ liệu công cụ trên máy (gửi nốt hàng đợi trước khi xóa)
export async function refreshPolicy(): Promise<StoredConfig> {
  const config = saveConfig(await fetchToolsConfig(), new Date());
  if (config.offline_enabled) {
    await enableOffline();
  } else {
    await flushQueue();
    await disableOffline();
    clearAllButConfig();
  }
  return config;
}
