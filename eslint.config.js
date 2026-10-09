import javascript from '@eslint/js';
import typescript from 'typescript-eslint';

export default typescript.config(
  { ignores: ['**/dist/**', 'tai_lieu/**', '**/node_modules/**'] },
  javascript.configs.recommended,
  ...typescript.configs.recommended,
);
