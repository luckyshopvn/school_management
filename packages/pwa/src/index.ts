// Vỏ ứng dụng web cài được dùng chung cho ứng dụng giáo viên và phụ huynh (DT-26 phần 26a, YCTD-231). Plugin Vite ở
// `@school-management/pwa/vite`
export { InstallPrompt, UpdateBanner, useInstallState, type InstallPromptProperties } from './InstallPrompt.js';
export { detectInstallState, dismissedRecently, type InstallEnvironment, type InstallState } from './install-state.js';
export { applyBrandedManifest, manifestUrl, type PwaApplication } from './manifest.js';
export {
  disablePush,
  enablePush,
  onServiceWorkerMessage,
  readPushState,
  revokePushOnSignOut,
  syncPush,
  type PushApplication,
  type PushRequest,
} from './push/push-client.js';
export { PushSettings, PushSettingsPanel, usePushSync, type PushSettingsProperties } from './push/PushSettings.js';
export { detectPushState, type PushState } from './push/push-state.js';
export {
  applyUpdate,
  clearCaches,
  onUpdateAvailable,
  registerServiceWorker,
  serviceWorkerSupported,
  unregisterServiceWorker,
  type ServiceWorkerOptions,
} from './service-worker-client.js';
