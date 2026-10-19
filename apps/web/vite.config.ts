import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const base = loadEnv(mode, process.cwd(), 'VITE_').VITE_BASE_PATH ?? '/';
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) {
    throw new Error('VITE_BASE_PATH deve ser um caminho absoluto terminado em /, como /penshow/.');
  }
  return {
    base,
    plugins: [react()],
    server: {
      fs: {
        // Preserve Vite 8's default exclusions and block private workspace files via /@fs.
        deny: [
          '.env',
          '.env.*',
          '*.{crt,pem,key,p12,pfx,cer,der}',
          '.npmrc',
          '.yarnrc.yml',
          '**/.git/**',
          '**/data/questions/**',
          '**/data/publication-reports/**',
          '**/data/import-reports/**',
          '**/apps/server/**',
        ],
      },
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: 'http://127.0.0.1:3000', rewrite: (path) => path.replace(/^\/api/, '') },
        '/penshow/socket.io': { target: 'http://127.0.0.1:3000', ws: true },
      },
    },
  };
});
