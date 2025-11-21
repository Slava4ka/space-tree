import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  html: {
    template: './index.html',
  },
  source: {
    entry: {
      index: './src/main.js',
    },
  },
  server: {
    publicDir: false, // Отключаем автокопирование, настроим вручную
  },
  output: {
    distPath: {
      root: 'dist',
    },
    assetPrefix: '/space-tree',
    sourceMap: {
      js: process.env.NODE_ENV === 'development' ? 'cheap-module-source-map' : false,
    },
    copy: [
      { from: 'media', to: 'media' },
    ],
  },
  performance: {
    chunkSplit: {
      strategy: 'split-by-experience',
      forceSplitting: {
        three: /node_modules[\\/]three/,
        lodash: /node_modules[\\/]lodash/,
      },
    },
    removeConsole: process.env.NODE_ENV === 'production',
  },
  tools: {
    rspack: {
      optimization: {
        minimize: true,
        usedExports: true, // tree shaking
      },
    },
  },
});

