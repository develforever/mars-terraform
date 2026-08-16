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
    allowedHosts: ['10ac-195-136-136-86.ngrok-free.app', '39bc-195-136-136-89.ngrok-free.app'],
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            const normalizedId = id.replace(/\\/g, '/');
            if (
              normalizedId.includes('/node_modules/three/') ||
              normalizedId.includes('/node_modules/@react-three/fiber/') ||
              normalizedId.includes('/node_modules/@react-three/drei/')
            ) {
              return 'vendor-three';
            }
            if (
              normalizedId.includes('/node_modules/postprocessing/') ||
              normalizedId.includes('/node_modules/@react-three/postprocessing/')
            ) {
              return 'vendor-postprocessing';
            }
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
