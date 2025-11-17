import { defineConfig } from 'vite';

export default defineConfig({
  base: '/space-tree/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    chunkSizeWarningLimit: 1000, // Увеличиваем лимит до 1MB
    rollupOptions: {
      output: {
        manualChunks: {
          // Выделяем Three.js в отдельный чанк
          'three': ['three']
        }
      }
    }
  }
});
