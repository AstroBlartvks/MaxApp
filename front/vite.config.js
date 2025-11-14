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
      hmr: {
        host: env.VITE_PRODUCTION_DOMAIN || 'whitea.cloud',  
        clientPort: env.VITE_PRODUCTION_PROTOCOL === 'https' ? 443 : 80,       
        protocol: env.VITE_PRODUCTION_PROTOCOL === 'https' ? 'wss' : 'ws'        
      },
      proxy: {
        '/public': {
          target: `http://localhost:${env.VITE_DEV_PORT || '5173'}`,
          rewrite: (path) => '/public-profile.html'
        }
      }
    }
  };
});
