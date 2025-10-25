import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@features': resolve(__dirname, 'src/features'),
      '@app': resolve(__dirname, 'src/app'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
