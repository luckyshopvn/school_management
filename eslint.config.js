import javascript from '@eslint/js';
import typescript from 'typescript-eslint';

export default typescript.config(
  {
    ignores: [
      '**/dist/**',
      'tai_lieu/**',
      '**/node_modules/**',
      '**/test-results/**',
      '**/playwright-report/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
    ],
  },
  javascript.configs.recommended,
  ...typescript.configs.recommended,
  // Tệp JavaScript chạy trên Node
  {
    files: ['**/*.mjs'],
    languageOptions: {
      // Node 24 và Cloudflare Workers có sẵn giao diện Fetch chuẩn (cổng biên, bộ định tuyến của hồ sơ thử nghiệm, DT-SaaS S9)
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        AbortController: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
);
