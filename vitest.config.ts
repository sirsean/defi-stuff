import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Enable global test utilities
    globals: true,
    // Use the same environment configuration as your project
    environment: 'node',
    // Include TypeScript files
    include: ['**/*.{test,spec}.{js,ts}'],
    // Configure coverage reporting
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', '**/dist/**', '**/*.d.ts'],
    },
  },
});