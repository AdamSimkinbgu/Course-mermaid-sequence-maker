import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@course-dag/core': path.resolve(__dirname, '../../packages/core/src'),
      '@course-dag/expression': path.resolve(__dirname, '../../packages/expression/src'),
      '@course-dag/parser-excel': path.resolve(__dirname, '../../packages/parser-excel/src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
  },
});
