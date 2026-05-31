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
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3000'
    },
    allowedHosts: ['10ac-195-136-136-86.ngrok-free.app'],
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
