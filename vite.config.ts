import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * maplibre 6 的自带 Web Worker 用 `new URL('./maplibre-gl-worker.mjs', import.meta.url)` 定位，
 * 也就是说这个文件必须和打包后的 chunk 同目录。Vite/Rollup 不会自己复制它，
 * 结果生产构建里 worker 404，地图完全不渲染（dev 阶段因为直接读 node_modules 才不会暴露）。
 * 该 worker 文件自包含、无二次 import，拷一份即可。
 */
function maplibreWorkerFile(): Plugin {
  return {
    name: 'maplibre-worker-file',
    apply: 'build',
    closeBundle() {
      const from = resolve(root, 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs');
      const to = resolve(root, 'dist/assets/maplibre-gl-worker.mjs');
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(from, to);
    },
  };
}

export default defineConfig({
  // 相对路径，便于直接部署到 GitHub Pages 的子路径
  base: './',
  plugins: [maplibreWorkerFile()],
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
