import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Загружаем переменные окружения из .env файла
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    server: {
      port: parseInt(env.VITE_DEV_PORT || '5444'),
      host: true, 
      allowedHosts: [
        env.VITE_PRODUCTION_DOMAIN || 'whitea.cloud',
        `www.${env.VITE_PRODUCTION_DOMAIN || 'whitea.cloud'}`,
        'localhost'
      ],
      proxy: {
        '/api': {
          target: 'https://api.whitea.cloud',
          changeOrigin: true,
        },
        '/auth': {
          target: 'https://api.whitea.cloud',
          changeOrigin: true,
        },
        '/trades': {
          target: 'https://api.whitea.cloud',
          changeOrigin: true,
        }
      }
    }
  };
});
