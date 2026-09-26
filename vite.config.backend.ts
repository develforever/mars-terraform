import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
  build: {
    target: 'node22',
    outDir: 'dist_backend',
    ssr: true,
    lib: {
      // Dwa entry (T7): serwer API i skrypt migracji. Wspólne moduły trafiają do chunków obok.
      entry: {
        index: 'src_backend/index.ts',
        migrate: 'src_backend/migrate.ts'
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`
    },
    rollupOptions: {
      external: (id) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\\0') && !id.startsWith('C:') && !id.startsWith('C\\') && !id.startsWith('c:') && !id.startsWith('c\\')
    }
  }
})
