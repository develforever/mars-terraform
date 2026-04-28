/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const threePath = fileURLToPath(new URL('./node_modules/three', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      three: threePath,
    },
    dedupe: ['three'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    tailwindcss(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
