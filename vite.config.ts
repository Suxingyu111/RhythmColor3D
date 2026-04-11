import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
    open: true,
  },
  build: {
    target: 'ES2020',
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
  },
  resolve: {
    alias: {
      '@': '/src',
      '@game': '/src/game',
      '@ui': '/src/ui',
      '@audio': '/src/audio',
      '@3d': '/src/3d',
      '@managers': '/src/managers',
      '@utils': '/src/utils',
    },
  },
})
