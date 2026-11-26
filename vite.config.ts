import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径，便于直接部署到 GitHub Pages 的子路径
  base: './',
  build: {
    target: 'es2022',
    // maplibre 体积较大，单独分包，避免主包被拖慢
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ['maplibre-gl'],
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  // maplibre 自带 Web Worker，dev 阶段的依赖预打包会破坏其 worker URL 解析，这里排除
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
});
