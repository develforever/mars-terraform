import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Środowisko serwerowe
    include: ['src_backend/**/*.{test,spec}.ts'],
    setupFiles: './src_backend/test/setup.ts',
  },
})