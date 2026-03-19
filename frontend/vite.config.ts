import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,          // describe, it, expect 등을 import 없이 사용
    environment: 'jsdom',   // 브라우저 환경 시뮬레이션
    setupFiles: './src/test/setup.ts',  // 테스트 전 초기화 파일
    css: true,
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET_URL || 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
