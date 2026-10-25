/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const GRANDLYON_BASE_URL = 'https://data.grandlyon.com';

export default defineConfig(({ mode }) => {
  // Préfixe '' : charge aussi les variables sans VITE_, qui ne vont jamais au navigateur.
  const env = loadEnv(mode, process.cwd(), '');
  const user = env.GRANDLYON_USER;
  const password = env.GRANDLYON_PASSWORD;

  return {
    base: process.env.BASE_PATH ?? '/',
    plugins: [react()],
    define: {
      // Le front sait seulement si le relais est configuré, jamais avec quels identifiants.
      'import.meta.env.VITE_TCL_RELAY_CONFIGURED': JSON.stringify(Boolean(user && password)),
    },
    server: {
      proxy: {
        // Relais local : /api/grandlyon/... -> data.grandlyon.com/fr/datapusher/ws/rdata/...
        // avec l'authentification ajoutée ici, côté serveur.
        '/api/grandlyon': {
          target: env.GRANDLYON_BASE_URL || GRANDLYON_BASE_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/grandlyon/, '/fr/datapusher/ws/rdata'),
          headers:
            user && password
              ? { Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}` }
              : undefined,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
