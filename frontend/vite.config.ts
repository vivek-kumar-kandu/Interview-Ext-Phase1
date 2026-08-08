import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

// Custom plugin to strip modulepreload link tags and copy manifest into dist
const removeModulePreloadPlugin = (): Plugin => ({
  name: 'remove-module-preload',
  transformIndexHtml(html: string) {
    return html.replace(/<link rel="(modulepreload|preload)"[^>]*>/g, '');
  },
  renderChunk(code: string, chunk) {
    let output = code.replace(
      /const __vitePreload = [^;]+;/g,
      'const __vitePreload = function(baseModule) { return baseModule(); };'
    ).replace(
      /function __vitePreload\([^)]*\)\s*\{[\s\S]*?\}/g,
      'function __vitePreload(baseModule) { return baseModule(); }'
    );
    if (chunk.fileName.endsWith('content.js') || chunk.name === 'content') {
      const trimmed = output.trim();
      if (!trimmed.startsWith('(()') && !trimmed.startsWith('(function')) {
        output = `(() => {\n${output}\n})();`;
      }
    }
    return output;
  },
  closeBundle() {
    const manifestSrc = resolve(__dirname, 'manifest.json');
    const manifestDest = resolve(__dirname, 'dist/manifest.json');
    if (fs.existsSync(manifestSrc)) {
      fs.copyFileSync(manifestSrc, manifestDest);
    }
  }
});

export default defineConfig({
  plugins: [react(), removeModulePreloadPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background' || chunkInfo.name === 'content') {
            return '[name].js';
          }
          return 'assets/[name].js';
        },
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
