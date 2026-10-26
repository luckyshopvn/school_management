// Vỏ ứng dụng web cài được dùng chung cho ứng dụng giáo viên và phụ huynh (DT-26 phần 26a, YCTD-231). Plugin Vite ở
// `@school-management/pwa/vite`
export { InstallPrompt, UpdateBanner, useInstallState, type InstallPromptProperties } from './InstallPrompt.js';
export { detectInstallState, dismissedRecently, type InstallEnvironment, type InstallState } from './install-state.js';
export { applyBrandedManifest, manifestUrl, type PwaApplication } from './manifest.js';
export {
  applyUpdate,
  clearCaches,
  onUpdateAvailable,
  registerServiceWorker,
  serviceWorkerSupported,
  unregisterServiceWorker,
  type ServiceWorkerOptions,
} from './service-worker-client.js';
