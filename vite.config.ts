import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3020,
        host: '0.0.0.0',
        headers: {
          "Cross-Origin-Embedder-Policy": "credentialless",
          "Cross-Origin-Opener-Policy": "same-origin",
        },
      },
      optimizeDeps: {
        exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor': ['react', 'react-dom', 'lucide-react'],
              'ffmpeg': ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
              'dnd-kit': ['@dnd-kit/core', '@dnd-kit/sortable'],
            }
          }
        }
      }
    };
});
