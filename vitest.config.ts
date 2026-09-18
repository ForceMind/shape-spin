import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    exclude: ['**/._*', '**/node_modules/**', 'tests/e2e/**'],
    coverage: { provider: 'v8', include: ['src/**'] },
  },
});
