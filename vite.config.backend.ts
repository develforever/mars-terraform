import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
  build: {
    target: 'node22',
    outDir: 'dist_backend',
    ssr: true,
    lib: {
      entry: 'src_backend/index.ts',
      formats: ['es'],
      fileName: 'index'
    },
    rollupOptions: {
      external: (id) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\\0') && !id.startsWith('C:') && !id.startsWith('C\\') && !id.startsWith('c:') && !id.startsWith('c\\')
    }
  }
})
