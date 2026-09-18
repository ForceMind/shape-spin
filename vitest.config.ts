import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    exclude: ['**/._*', '**/node_modules/**'],
    coverage: { provider: 'v8', include: ['src/**'] },
  },
});
