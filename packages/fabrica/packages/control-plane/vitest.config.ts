import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 180000, // 3 minutes for integration tests
    hookTimeout: 30000,
  },
});
