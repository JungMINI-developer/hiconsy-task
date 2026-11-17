import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import vueDevTools from 'vite-plugin-vue-devtools';

// E2E(Playwright)는 개발 서버와 겹치지 않는 포트의 API로 프록시하고, devtools 오버레이를 끈다
const isE2E = process.env.E2E === 'true';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss(), ...(isE2E ? [] : [vueDevTools()])],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
    },
  },
});
